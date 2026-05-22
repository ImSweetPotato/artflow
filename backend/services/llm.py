"""
LLM 思考服务：用 GPT-5 思考模型优化用户的口语化生图提示词。

为什么需要：
- gpt-image-2 本身没有思考能力，对模糊或简短的中文输入效果一般
- 用 gpt-5.4 这类思考模型先理解用户意图、补全细节、转换为精准的英文 prompt
- 跟 ChatGPT 内部的"思考 → 调图工具"流程对齐
"""

import os
import re
import sys
import time
from typing import Any

import httpx

from services.errors import is_safety_rejection_message, log_and_friendly

API_KEY = os.getenv("ANTHROPIC_API_KEY", "") or os.getenv("SOFUNNY_API_KEY", "")
API_BASE_URL = os.getenv("API_BASE_URL", "https://llm-api-proxy.hnfunny.com/v1").rstrip("/")
THINKING_MODEL = os.getenv("THINKING_MODEL", "gpt-5.4")

# 配对策略：未来扩展时按 target image model 选 thinking model
_PAIR_MAP = {
    "gpt-image-2": "gpt-5.4",
}


def _build_system_prompt(has_reference: bool) -> str:
    base = (
        "You are an expert prompt engineer for the GPT-Image-2 image generation model. "
        "Your job: take the user's casual description (any language) and rewrite it into "
        "a precise, vivid English prompt that produces excellent results.\n\n"
        "Guidelines:\n"
        "- Output English only. Image models perform notably better in English.\n"
        "- Preserve the user's CORE intent. Never invent subjects they didn't ask for.\n"
        "- Add concrete details where useful: lighting, composition, color palette, camera angle, art style.\n"
        "- Be specific about style only when the user implies one (photorealistic, anime, oil painting, 3D render, etc.).\n"
        "- Keep it under ~120 words. Dense, descriptive nouns and adjectives beat long sentences.\n"
        "- Output ONLY the rewritten prompt itself. No preamble, no explanation, no quotes."
    )
    if has_reference:
        base += (
            "\n\nIMPORTANT: The user is providing reference image(s). Focus the prompt on what to "
            "CHANGE or add — do not redundantly describe what's already visible in the reference. "
            "Use phrasing like 'transform into…', 'add…', 'restyle as…' rather than 'a photo of a person…'."
        )
    return base


def _extract_thinking(message: dict) -> str:
    """从 OpenAI 兼容响应中尽力抽取 reasoning/thinking 内容。
    不同代理透传字段不一致，按常见位置依次尝试。"""
    for key in ("reasoning_content", "reasoning", "thinking"):
        v = message.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
        if isinstance(v, list):
            # 可能是 [{type, text}, ...] 形态
            parts = [item.get("text", "") if isinstance(item, dict) else str(item) for item in v]
            joined = "\n\n".join(p for p in parts if p)
            if joined.strip():
                return joined.strip()
    return ""


def improve_image_prompt(
    user_prompt: str,
    has_reference: bool = False,
    target_model: str = "gpt-image-2",
    reasoning_effort: str = "medium",
    timeout: float = 120.0,
) -> dict[str, Any]:
    """
    用思考模型把用户的口语化输入改写成精准的英文 prompt。

    返回:
        {
            "optimized_prompt": str,   # 改写后的 prompt（用于实际生图）
            "original_prompt":  str,   # 原始输入
            "thinking_content": str,   # 思考过程文本（可能为空，看代理是否透传）
            "duration_ms":      int,   # 端到端耗时
            "model":            str,   # 使用的模型
        }
    """
    if not API_KEY:
        raise RuntimeError("未配置 ANTHROPIC_API_KEY/SOFUNNY_API_KEY，无法调用思考模型")

    model = _PAIR_MAP.get(target_model, THINKING_MODEL)
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": _build_system_prompt(has_reference)},
            {"role": "user", "content": user_prompt},
        ],
        "reasoning_effort": reasoning_effort,
        "max_tokens": 1024,
    }

    print(f"[LLM] POST /chat/completions model={model} effort={reasoning_effort}", file=sys.stderr)
    started = time.time()
    try:
        resp = httpx.post(
            f"{API_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json=payload,
            timeout=timeout,
        )
    except (httpx.TimeoutException, httpx.NetworkError, httpx.ConnectError) as e:
        raise log_and_friendly(e, "GPT-5 思考模型") from e
    duration_ms = int((time.time() - started) * 1000)

    if not resp.is_success:
        body = resp.text[:500]
        print(f"[LLM] FAILED status={resp.status_code} body={body}", file=sys.stderr)
        try:
            resp.raise_for_status()
        except Exception as e:
            raise log_and_friendly(e, "GPT-5 思考模型") from e

    data = resp.json()
    choice = (data.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    optimized = (message.get("content") or "").strip()
    thinking = _extract_thinking(message)

    if not optimized:
        raise RuntimeError("思考模型返回为空")

    # 容错：去掉模型可能加的引号包裹
    if (optimized.startswith('"') and optimized.endswith('"')) or \
       (optimized.startswith('“') and optimized.endswith('”')):
        optimized = optimized[1:-1].strip()

    print(f"[LLM] OK duration={duration_ms}ms thinking_chars={len(thinking)}", file=sys.stderr)

    return {
        "optimized_prompt": optimized,
        "original_prompt":  user_prompt,
        "thinking_content": thinking,
        "duration_ms":      duration_ms,
        "model":            model,
    }


def _fallback_safety_prompt(user_prompt: str, has_reference: bool) -> str:
    """在思考模型不可用时做保守降级，尽量保留构图与风格，去掉高风险措辞。"""
    text = re.sub(r"\s+", " ", user_prompt or "").strip()
    replacements = [
        (r"血腥|喷血|断肢|内脏|开膛|尸体|虐杀|斩首|爆头|重伤", "dramatic action"),
        (r"色情|裸露|全裸|半裸|内衣|胸部|臀部|挑逗|性[爱交行为]", "stylized costume"),
        (r"未成年|幼女|萝莉|正太|少女", "young adult"),
        (r"枪击|枪战|刺杀|谋杀|自杀|吸毒", "cinematic tension"),
    ]
    for pattern, repl in replacements:
        text = re.sub(pattern, repl, text, flags=re.IGNORECASE)
    text = text[:280].strip(" ,.;，。；")
    prefix = (
        "Use the reference image only for identity, outfit, and proportions. "
        if has_reference else ""
    )
    suffix = (
        " Clean composition, non-graphic, non-sexual, policy-safe visual treatment, focus on style, pose, lighting, and composition."
    )
    return (prefix + text + suffix).strip()


def sanitize_image_prompt_for_safety(
    user_prompt: str,
    has_reference: bool = False,
    target_model: str = "gpt-image-2",
    refusal_message: str = "",
    timeout: float = 90.0,
) -> dict[str, Any]:
    """
    将原始提示词改写为更容易通过图片安全审核的版本。

    优先使用思考模型做保守重写；若不可用，则退回本地规则化简。
    """
    if not user_prompt.strip():
        raise ValueError("缺少 user_prompt")

    if not API_KEY:
        sanitized = _fallback_safety_prompt(user_prompt, has_reference)
        return {
            "sanitized_prompt": sanitized,
            "original_prompt": user_prompt,
            "reason": "fallback-no-api-key",
            "duration_ms": 0,
            "model": "local-fallback",
        }

    model = _PAIR_MAP.get(target_model, THINKING_MODEL)
    system_prompt = (
        "You rewrite image-generation prompts so they remain useful while becoming easier to pass a strict safety review.\n"
        "Rules:\n"
        "- Output English only.\n"
        "- Preserve benign creative intent, composition, style, lighting, and subject identity.\n"
        "- Remove or soften terms that imply graphic violence, self-harm, nudity, sexualization, minors, extremist praise, illegal activity, or public-figure likeness if not essential.\n"
        "- If the user mentions action or combat, convert it to non-graphic cinematic action.\n"
        "- If reference images are present, avoid re-describing the entire person; focus on allowed edits and visual treatment.\n"
        "- Keep it under 90 words.\n"
        "- Output ONLY the rewritten prompt."
    )
    user_message = (
        f"Original prompt:\n{user_prompt.strip()}\n\n"
        f"Safety refusal message:\n{refusal_message.strip() or 'N/A'}\n\n"
        "Rewrite now."
    )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "reasoning_effort": "low",
        "max_tokens": 512,
    }

    started = time.time()
    try:
        resp = httpx.post(
            f"{API_BASE_URL}/chat/completions",
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            json=payload,
            timeout=timeout,
        )
        if not resp.is_success:
            resp.raise_for_status()
        data = resp.json()
        message = ((data.get("choices") or [{}])[0].get("message") or {})
        sanitized = (message.get("content") or "").strip()
        if not sanitized:
            raise RuntimeError("safety rewrite empty")
        if is_safety_rejection_message(sanitized):
            raise RuntimeError("safety rewrite invalid")
        if (sanitized.startswith('"') and sanitized.endswith('"')) or (
            sanitized.startswith("“") and sanitized.endswith("”")
        ):
            sanitized = sanitized[1:-1].strip()
        return {
            "sanitized_prompt": sanitized,
            "original_prompt": user_prompt,
            "reason": "llm-rewrite",
            "duration_ms": int((time.time() - started) * 1000),
            "model": model,
        }
    except Exception as e:
        print(f"[LLM] safety rewrite failed, fallback to local sanitizer: {e}", file=sys.stderr)
        sanitized = _fallback_safety_prompt(user_prompt, has_reference)
        return {
            "sanitized_prompt": sanitized,
            "original_prompt": user_prompt,
            "reason": "fallback-after-error",
            "duration_ms": int((time.time() - started) * 1000),
            "model": "local-fallback",
        }
