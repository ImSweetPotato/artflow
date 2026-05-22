"""
友好错误消息转换。

目的：把第三方 API（httpx）抛出的原始错误转成给最终用户看的简洁中文消息。
原始消息形如：
    Client error '429 Too Many Requests' for url 'https://...' For more information check: https://developer.mozilla.org/...
对用户既冗长又无用。这里统一映射到带行动建议的简短文案。
"""

import json
import re
import sys

import httpx


# ── 状态码 → 友好消息 ────────────────────────────────────────────────────────

_STATUS_HINTS = {
    400: "请求参数有误，请检查提示词长度和格式",
    401: "API 密钥失效或未授权，请联系管理员",
    403: "无权访问该模型，请联系管理员",
    404: "服务地址或模型不存在",
    408: "请求超时，请稍后重试",
    413: "上传内容过大，请压缩参考图后重试",
    422: "请求被服务方拒绝（参数不符合要求）",
    429: "调用太频繁，服务方限流。建议等待 1–5 分钟后再试，或减少同时提交的任务数",
    499: "请求被中断",
    500: "服务方内部错误，请稍后重试",
    502: "服务方网关异常（502），请稍后重试",
    503: "服务方临时不可用（503），请稍后重试",
    504: "服务方响应超时（504），请稍后重试",
}


def _extract_provider_message(body: str) -> str | None:
    """从 OpenAI 兼容错误响应中提取 message 字段。"""
    if not body:
        return None
    try:
        data = json.loads(body)
    except Exception:
        return None
    if isinstance(data, dict):
        err = data.get("error")
        if isinstance(err, dict):
            msg = err.get("message")
            if isinstance(msg, str) and msg.strip():
                return msg.strip()
        if isinstance(data.get("message"), str):
            return data["message"]
    return None


def _detect_moderation(text: str) -> bool:
    """检测是否是内容审核类错误。"""
    if not text:
        return False
    t = text.lower()
    keywords = [
        "moderation", "safety", "policy", "blocked", "violat",
        "审核", "违规", "内容策略", "敏感", "禁止",
    ]
    return any(k in t for k in keywords)


def is_safety_rejection_message(text: str) -> bool:
    """对外暴露的审核拒绝判断，兼容已友好化中文消息与原始 provider 报错。"""
    if not text:
        return False
    t = text.lower()
    markers = [
        "内容安全策略",
        "安全策略",
        "审核拒绝",
        "safety system",
        "content policy",
        "policy violation",
        "violates our content policy",
        "rejected by the safety system",
    ]
    return _detect_moderation(text) or any(m in t for m in markers)


def friendly_api_error(exc: Exception, source: str = "服务方") -> RuntimeError:
    """
    把第三方 API 抛出的异常转成可以直接放进 task.error_message 的友好消息。

    参数:
        exc: 原始异常（httpx.HTTPStatusError / httpx.TimeoutException / 其他）
        source: 出错的服务方简短名（如 "GPT-Image-2"、"GPT-5 思考模型"）

    返回:
        新的 RuntimeError，message 已友好化
    """
    # 1. 超时类
    if isinstance(exc, httpx.TimeoutException):
        return RuntimeError(f"{source} 响应超时，可能是网络较慢或服务方繁忙，请稍后重试")

    # 2. 网络/连接错误
    if isinstance(exc, (httpx.ConnectError, httpx.NetworkError)):
        return RuntimeError(f"无法连接到 {source}，请检查网络后重试")

    # 3. HTTP 状态码错误
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        body = ""
        try:
            body = exc.response.text or ""
        except Exception:
            pass

        provider_msg = _extract_provider_message(body)

        # 内容审核单独识别（通常是 400/422 + 特定关键字）
        if status in (400, 422) and (_detect_moderation(provider_msg or "") or _detect_moderation(body)):
            return RuntimeError(
                f"提示词或参考图触发了 {source} 的内容安全策略，请调整后重试"
                + (f"（{provider_msg}）" if provider_msg and len(provider_msg) < 200 else "")
            )

        hint = _STATUS_HINTS.get(status, f"服务方返回错误（HTTP {status}）")

        # 拼接服务方原始 message（短的才拼，长的丢掉避免污染）
        if provider_msg and len(provider_msg) < 200 and provider_msg.lower() not in hint.lower():
            return RuntimeError(f"{source}：{hint}（{provider_msg}）")
        return RuntimeError(f"{source}：{hint}")

    # 4. 已经是 RuntimeError 且消息看起来已友好 → 透传
    raw = str(exc)
    if isinstance(exc, RuntimeError) and not _looks_like_raw_http_error(raw):
        return exc  # 透传，不再包一层

    # 5. 其他异常：剔除 URL/MDN 链接等噪音
    cleaned = _strip_noise(raw)
    if not cleaned:
        cleaned = "未知错误"
    return RuntimeError(f"{source}：{cleaned}")


def _looks_like_raw_http_error(s: str) -> bool:
    """粗判断字符串是否包含未处理的 httpx 风格错误（URL + status code）。"""
    return bool(re.search(r"(Client|Server) error '\d{3}", s)) or "developer.mozilla.org" in s


def _strip_noise(s: str) -> str:
    """剔除典型噪音：URL、MDN 文档链接、httpx 模板词。"""
    if not s:
        return ""
    s = re.sub(r"For more information check:\s*https?://\S+", "", s)
    s = re.sub(r"https?://\S+", "", s)
    s = re.sub(r"for url\s*['\"]?\S*['\"]?", "", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def log_and_friendly(exc: Exception, source: str = "服务方") -> RuntimeError:
    """打印原始异常到 stderr 后返回友好版本。便于排查。"""
    print(f"[friendly_api_error] [{source}] raw: {type(exc).__name__}: {exc}", file=sys.stderr)
    return friendly_api_error(exc, source)
