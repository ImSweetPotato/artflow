"""
Unified image generation backend.

Usage:
    backend = get_backend("seedream")   # or "gemini" / "gpt-image-2"
    img_bytes = backend.generate(prompt, ref_images=[bytes], ref_mimetypes=["image/png"], size="2048x2048")

All backends return raw PNG/JPEG bytes.
ref_images=None  → text-to-image
ref_images=[...]  → image-to-image
"""

import base64
import io
import json
import os
import sys
import time
import urllib.parse
from abc import ABC, abstractmethod
from pathlib import Path

import httpx
from PIL import Image

from services.errors import log_and_friendly

# ── env ───────────────────────────────────────────────────────────────────────

VOLCANO_API_KEY = os.getenv("VOLCANO_API_KEY", "")
VOLCANO_IMG_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations"
SEEDREAM_MODEL = "doubao-seedream-4-5-251128"

SOFUNNY_BASE_URL = os.getenv("SOFUNNY_BASE_URL", "http://127.0.0.1:3000")
SOFUNNY_API_KEY = os.getenv("SOFUNNY_API_KEY", "")
SOFUNNY_MODEL = os.getenv("SOFUNNY_MODEL", "gemini-3.1-flash-image-preview")
SOFUNNY_GPT_IMAGE_MODEL = os.getenv("SOFUNNY_GPT_IMAGE_MODEL", "gpt-image-2")

_MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}

# gpt-image-2 支持的尺寸（按比例映射）
# 官方支持：1024x1024 / 1536x1024 / 1024x1536 / auto
_GPT_SIZE_MAP = {
    "1:1":  "1024x1024",
    "16:9": "1536x1024",
    "4:3":  "1536x1024",
    "9:16": "1024x1536",
    "3:4":  "1024x1536",
    "auto": "auto",
    "":     "auto",  # 空字符串 = 自动
}

_ASPECT_RATIO_PAIR = {
    "1:1": (1, 1),
    "16:9": (16, 9),
    "9:16": (9, 16),
    "4:3": (4, 3),
    "3:4": (3, 4),
}

_RETRY_REASON_LABELS = {
    408: "请求超时",
    429: "服务方限流",
    500: "服务方内部错误",
    502: "服务方网关异常",
    503: "服务方暂时不可用",
    504: "服务方响应超时",
}


# ── helpers ───────────────────────────────────────────────────────────────────

def read_image(path: str) -> tuple[bytes, str]:
    p = Path(path)
    return p.read_bytes(), _MIME.get(p.suffix.lower(), "image/jpeg")


def _sofunny_v1_base() -> str:
    """返回 https://host/v1 形式的基础 URL。"""
    base = SOFUNNY_BASE_URL.rstrip("/")
    return base if base.endswith("/v1") else base + "/v1"


def _build_multipart(
    fields: list[tuple[str, str]],
    files: list[tuple[str, str, str, bytes]],
) -> tuple[str, bytes]:
    """按照 sofunny-image.js buildMultipartBody 的逻辑手动构建 multipart body。
    fields: [(name, value), ...]
    files:  [(field_name, filename, content_type, data), ...]
    返回 (boundary, body_bytes)
    """
    boundary = f"----sofunny-image-{int(time.time() * 1000):x}-{os.urandom(8).hex()}"
    chunks: list[bytes] = []

    for name, value in fields:
        chunks.append(f"--{boundary}\r\n".encode())
        chunks.append(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode())
        chunks.append(str(value).encode("utf-8"))
        chunks.append(b"\r\n")

    for field_name, filename, content_type, data in files:
        chunks.append(f"--{boundary}\r\n".encode())
        chunks.append(
            f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"\r\n'.encode()
        )
        chunks.append(f"Content-Type: {content_type}\r\n\r\n".encode())
        chunks.append(data)
        chunks.append(b"\r\n")

    chunks.append(f"--{boundary}--\r\n".encode())
    return boundary, b"".join(chunks)


def _enforce_output_aspect_ratio(image_bytes: bytes, aspect_ratio: str) -> bytes:
    ratio = _ASPECT_RATIO_PAIR.get((aspect_ratio or "").strip())
    if not ratio:
        return image_bytes

    with Image.open(io.BytesIO(image_bytes)) as img:
        width, height = img.size
        ratio_w, ratio_h = ratio
        scale = min(width // ratio_w, height // ratio_h)
        if scale <= 0:
            return image_bytes

        target_w = ratio_w * scale
        target_h = ratio_h * scale
        if target_w == width and target_h == height:
            return image_bytes

        left = max(0, (width - target_w) // 2)
        top = max(0, (height - target_h) // 2)
        cropped = img.crop((left, top, left + target_w, top + target_h))

        out = io.BytesIO()
        fmt = (img.format or "PNG").upper()
        save_kwargs: dict[str, object] = {"format": fmt}
        if fmt in {"JPEG", "JPG"} and cropped.mode not in {"RGB", "L"}:
            cropped = cropped.convert("RGB")
        cropped.save(out, **save_kwargs)
        return out.getvalue()


def _extract_retry_reason(resp: httpx.Response) -> str:
    """提取适合展示在任务重试提示里的简短失败原因。"""
    code = resp.status_code
    label = _RETRY_REASON_LABELS.get(code, f"HTTP {code}")

    try:
        data = resp.json()
    except Exception:
        data = None

    provider_msg = ""
    if isinstance(data, dict):
        err = data.get("error")
        if isinstance(err, dict) and isinstance(err.get("message"), str):
            provider_msg = err["message"].strip()
        elif isinstance(data.get("message"), str):
            provider_msg = data["message"].strip()

    if not provider_msg:
        try:
            provider_msg = (resp.text or "").strip()
        except Exception:
            provider_msg = ""

    provider_msg = " ".join(provider_msg.split())[:120]
    if provider_msg and provider_msg.lower() not in label.lower():
        return f"{code} {label}：{provider_msg}"
    return f"{code} {label}"


def _build_retry_message(stage: str, detail: str, wait: int, attempt: int, total: int) -> str:
    return f"{stage} {detail}，{wait}s 后重试 ({attempt}/{total})..."


# ── abstract base ─────────────────────────────────────────────────────────────

class ImageBackend(ABC):
    def __init__(self, api_key: str | None = None):
        self._api_key = (api_key or "").strip()

    @abstractmethod
    def generate(
        self,
        prompt: str,
        ref_images: list[bytes] | None = None,
        ref_mimetypes: list[str] | None = None,
        size: str = "2048x2048",
        aspect_ratio: str = "1:1",
    ) -> bytes:
        """Return raw image bytes (PNG or JPEG)."""


# ── Seedream / Volcano ────────────────────────────────────────────────────────

class SeedreamBackend(ImageBackend):

    def generate(
        self,
        prompt: str,
        ref_images: list[bytes] | None = None,
        ref_mimetypes: list[str] | None = None,
        size: str = "2048x2048",
        aspect_ratio: str = "1:1",
    ) -> bytes:
        if not VOLCANO_API_KEY:
            raise RuntimeError("未配置 VOLCANO_API_KEY，无法调用 Seedream")

        payload: dict = {
            "model": SEEDREAM_MODEL,
            "prompt": prompt,
            "size": size,
            "watermark": False,
        }
        if ref_images:
            mt = (ref_mimetypes or ["image/jpeg"])[0]
            payload["image"] = f"data:{mt};base64,{base64.b64encode(ref_images[0]).decode()}"

        resp = httpx.post(
            VOLCANO_IMG_URL,
            headers={"Authorization": f"Bearer {VOLCANO_API_KEY}", "Content-Type": "application/json"},
            json=payload,
            timeout=180,
        )
        if not resp.is_success:
            print(f"[SeedreamBackend] status={resp.status_code} body={resp.text[:500]}", file=sys.stderr)
        try:
            resp.raise_for_status()
        except Exception as e:
            raise log_and_friendly(e, "Seedream") from e

        img_url = resp.json()["data"][0]["url"]
        img_resp = httpx.get(img_url, timeout=60)
        img_resp.raise_for_status()
        return _enforce_output_aspect_ratio(img_resp.content, aspect_ratio)


# ── Sofunny Gemini ────────────────────────────────────────────────────────────

class GeminiBackend(ImageBackend):

    def __init__(self, model: str | None = None, api_key: str | None = None):
        super().__init__(api_key=api_key)
        self._model = model or SOFUNNY_MODEL or "gemini-3.1-flash-image-preview"

    def generate(
        self,
        prompt: str,
        ref_images: list[bytes] | None = None,
        ref_mimetypes: list[str] | None = None,
        size: str = "2048x2048",
        aspect_ratio: str = "1:1",
    ) -> bytes:
        api_key = self._api_key or SOFUNNY_API_KEY.strip()
        if not api_key:
            raise RuntimeError("未配置 SOFUNNY_API_KEY，无法调用 Gemini")

        base = SOFUNNY_BASE_URL.rstrip("/")
        if base.endswith("/v1"):
            base = base[:-3]
        model = self._model
        endpoint = f"{base}/v1beta/models/{urllib.parse.quote(model, safe='')}:generateContent"

        parts: list[dict] = [{"text": prompt}]
        for i, img_bytes in enumerate(ref_images or []):
            mt = ((ref_mimetypes or [])[i] if ref_mimetypes and i < len(ref_mimetypes) else "image/jpeg")
            parts.append({"inlineData": {"mimeType": mt, "data": base64.b64encode(img_bytes).decode()}})

        payload: dict = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "imageConfig": {
                    "aspectRatio": aspect_ratio,
                    "imageSize": "2K",
                },
            },
        }

        print(f"[GeminiBackend] POST {endpoint} model={model} ref_images={len(ref_images or [])}", file=sys.stderr)

        for attempt in range(3):
            resp = httpx.post(
                endpoint,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
                timeout=180,
            )
            data: dict = {}
            try:
                data = resp.json()
            except Exception:
                pass

            if resp.status_code == 429:
                wait = 15 * (attempt + 1)
                retry_msg = _build_retry_message("Gemini", _extract_retry_reason(resp), wait, attempt + 1, 3)
                print(f"[GeminiBackend] {retry_msg}", file=sys.stderr)
                time.sleep(wait)
                continue

            if not resp.is_success:
                print(f"[GeminiBackend] FAILED status={resp.status_code}", file=sys.stderr)
                print(f"[GeminiBackend] body={json.dumps(data, ensure_ascii=False)[:1000]}", file=sys.stderr)
                try:
                    resp.raise_for_status()
                except Exception as e:
                    raise log_and_friendly(e, "Gemini") from e

            parts_out = (((data.get("candidates") or [{}])[0].get("content") or {}).get("parts") or [])
            image_parts = [x for x in parts_out if isinstance(x, dict) and (x.get("inlineData") or {}).get("data")]
            if not image_parts:
                texts = [x.get("text", "") for x in parts_out if isinstance(x, dict) and x.get("text")]
                raise RuntimeError(("\n".join(texts).strip()[:300]) or "Gemini 响应中没有图片数据，请重试")

            print(f"[GeminiBackend] OK got {len(image_parts)} image part(s)", file=sys.stderr)
            return _enforce_output_aspect_ratio(
                base64.b64decode(image_parts[-1]["inlineData"]["data"]),
                aspect_ratio,
            )

        raise RuntimeError("Gemini 服务方持续限流（已重试 3 次），请稍后重试")


# ── GPT-Image-2 (OpenAI-compatible images API) ───────────────────────────────

class GptImage2Backend(ImageBackend):
    """
    使用 OpenAI 兼容的图片生成接口（与 sofunny-image.js 对齐）：
      T2I → POST /v1/images/generations  (JSON body)
      I2I → POST /v1/images/edits        (multipart，字段名 "image[]")
    """

    def generate(
        self,
        prompt: str,
        ref_images: list[bytes] | None = None,
        ref_mimetypes: list[str] | None = None,
        size: str = "2048x2048",
        aspect_ratio: str = "1:1",
        on_retry: "Callable | None" = None,
    ) -> bytes:
        api_key = self._api_key or SOFUNNY_API_KEY.strip()
        if not api_key:
            raise RuntimeError("未配置 SOFUNNY_API_KEY，无法调用 GPT-Image-2")

        v1 = _sofunny_v1_base()
        gpt_size = _GPT_SIZE_MAP.get(aspect_ratio, "auto")

        if ref_images:
            endpoint = f"{v1}/images/edits"
            # 按 sofunny-image.js buildMultipartBody 逻辑手动构建：文本字段在前，文件在后
            fields = [
                ("model",  SOFUNNY_GPT_IMAGE_MODEL),
                ("prompt", prompt),
                ("n",      "1"),
                ("size",   gpt_size),
            ]
            file_parts = []
            for idx, img_data in enumerate(ref_images):
                mt = (ref_mimetypes or [])[idx] if ref_mimetypes and idx < len(ref_mimetypes) else "image/png"
                ext = {"image/jpeg": "jpg", "image/jpg": "jpg",
                       "image/png": "png", "image/webp": "webp"}.get(mt, "png")
                file_parts.append(("image[]", f"reference_{idx + 1}.{ext}", mt, img_data))
            boundary, body = _build_multipart(fields, file_parts)
            i2i_headers = {
                "Authorization":  f"Bearer {api_key}",
                "Content-Type":   f"multipart/form-data; boundary={boundary}",
                "Content-Length": str(len(body)),
            }
            print(f"[GptImage2Backend] POST {endpoint} (I2I) size={gpt_size} body={len(body)}B", file=sys.stderr)
            for attempt in range(4):
                try:
                    resp = httpx.post(endpoint, headers=i2i_headers, content=body, timeout=360)
                except httpx.TimeoutException:
                    wait = 20 * (attempt + 1)
                    retry_msg = _build_retry_message("I2I", "超时：服务方长时间未响应", wait, attempt + 1, 4)
                    print(f"[GptImage2Backend] {retry_msg}", file=sys.stderr)
                    if attempt < 3:
                        if on_retry: on_retry(-1, retry_msg)
                        time.sleep(wait)
                        continue
                    raise RuntimeError("GPT-Image-2 I2I 请求连续超时，请稍后重试")
                if resp.status_code in (429, 500, 502, 503):
                    wait = 20 * (attempt + 1)
                    retry_msg = _build_retry_message("I2I", _extract_retry_reason(resp), wait, attempt + 1, 4)
                    print(f"[GptImage2Backend] {retry_msg}", file=sys.stderr)
                    if attempt < 3:
                        if on_retry: on_retry(-1, retry_msg)
                        time.sleep(wait)
                        continue
                if not resp.is_success:
                    print(f"[GptImage2Backend] I2I FAILED status={resp.status_code} body={resp.text[:500]}", file=sys.stderr)
                    try:
                        resp.raise_for_status()
                    except Exception as e:
                        raise log_and_friendly(e, "GPT-Image-2") from e
                result = resp.json()
                item = (result.get("data") or [{}])[0]
                if item.get("b64_json"):
                    return _enforce_output_aspect_ratio(
                        base64.b64decode(item["b64_json"]),
                        aspect_ratio,
                    )
                elif item.get("url"):
                    img_resp = httpx.get(item["url"], timeout=60)
                    img_resp.raise_for_status()
                    return _enforce_output_aspect_ratio(img_resp.content, aspect_ratio)
                else:
                    raise RuntimeError(f"GPT-Image-2 响应中没有图片数据，请重试")
            raise RuntimeError("GPT-Image-2 服务方持续繁忙（已重试 4 次），请稍后重试")

        endpoint = f"{v1}/images/generations"
        payload = {
            "model":   SOFUNNY_GPT_IMAGE_MODEL,
            "prompt":  prompt,
            "n":       1,
            "size":    gpt_size,
            "quality": "medium",
        }

        print(f"[GptImage2Backend] POST {endpoint} (T2I) size={gpt_size}", file=sys.stderr)

        for attempt in range(4):
            try:
                resp = httpx.post(
                    endpoint,
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json=payload,
                    timeout=150,
                )
            except httpx.TimeoutException:
                wait = 20 * (attempt + 1)
                retry_msg = _build_retry_message("T2I", "超时：服务方长时间未响应", wait, attempt + 1, 4)
                print(f"[GptImage2Backend] {retry_msg}", file=sys.stderr)
                if attempt < 3:
                    if on_retry: on_retry(-1, retry_msg)
                    time.sleep(wait)
                    continue
                raise RuntimeError("GPT-Image-2 请求连续超时，请稍后重试")

            if resp.status_code in (429, 500, 502, 503):
                wait = 20 * (attempt + 1)
                retry_msg = _build_retry_message("T2I", _extract_retry_reason(resp), wait, attempt + 1, 4)
                print(f"[GptImage2Backend] {retry_msg}", file=sys.stderr)
                if attempt < 3:
                    if on_retry: on_retry(-1, retry_msg)
                    time.sleep(wait)
                    continue

            if not resp.is_success:
                print(f"[GptImage2Backend] FAILED status={resp.status_code} body={resp.text[:500]}", file=sys.stderr)
                try:
                    resp.raise_for_status()
                except Exception as e:
                    raise log_and_friendly(e, "GPT-Image-2") from e

            result = resp.json()
            item = (result.get("data") or [{}])[0]

            if item.get("b64_json"):
                return _enforce_output_aspect_ratio(
                    base64.b64decode(item["b64_json"]),
                    aspect_ratio,
                )
            elif item.get("url"):
                img_resp = httpx.get(item["url"], timeout=60)
                img_resp.raise_for_status()
                return _enforce_output_aspect_ratio(img_resp.content, aspect_ratio)
            else:
                raise RuntimeError("GPT-Image-2 响应中没有图片数据，请重试")

        raise RuntimeError("GPT-Image-2 服务方持续繁忙（已重试 4 次），请稍后重试")


# ── factory ───────────────────────────────────────────────────────────────────

_REGISTRY: dict[str, type[ImageBackend]] = {
    "seedream":    SeedreamBackend,
    "gemini":      GeminiBackend,
    "gpt-image-2": GptImage2Backend,
}


def get_backend(name: str = "seedream", api_key: str | None = None) -> ImageBackend:
    backend_cls = _REGISTRY.get(name) or SeedreamBackend
    if backend_cls is SeedreamBackend:
        return backend_cls()
    return backend_cls(api_key=api_key)
