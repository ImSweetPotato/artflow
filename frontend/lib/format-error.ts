/**
 * 错误消息友好化（前端最后的安全网）。
 *
 * 后端会在 services/errors.py 把第三方 API 错误转成中文消息。
 * 但万一漏网（比如老任务、其它路径），前端也兜一层：
 * - 剔除 URL 和 MDN 文档链接
 * - 把 'Client error 429' 这类英文映射到中文
 * - 截断过长的 JSON dump
 */

const STATUS_HINTS: Record<string, string> = {
  "400": "请求参数有误，请检查提示词长度和格式",
  "401": "API 密钥失效或未授权，请联系管理员",
  "403": "无权访问该模型，请联系管理员",
  "404": "服务地址或模型不存在",
  "408": "请求超时，请稍后重试",
  "413": "上传内容过大，请压缩参考图后重试",
  "422": "请求被服务方拒绝（参数不符合要求）",
  "429": "调用太频繁，服务方限流。建议等待 1–5 分钟后再试",
  "500": "服务方内部错误，请稍后重试",
  "502": "服务方网关异常，请稍后重试",
  "503": "服务方临时不可用，请稍后重试",
  "504": "服务方响应超时，请稍后重试",
};

const MAX_LEN = 200;

/**
 * 把任意原始错误消息转成给最终用户看的友好版本。
 * 已经友好的消息直接透传（短 + 中文 + 不含 URL）。
 */
export function formatError(raw: unknown, fallback = "操作失败，请稍后重试"): string {
  if (raw == null) return fallback;
  let s = String(raw).trim();
  if (!s) return fallback;

  // 已经是友好中文消息（无 URL、长度合理）→ 透传
  if (!/(https?:\/\/|developer\.mozilla\.org)/i.test(s) && s.length <= MAX_LEN && /[一-龥]/.test(s)) {
    return s;
  }

  // 剔除 MDN 链接尾巴
  s = s.replace(/For more information check:\s*https?:\/\/\S+/i, "").trim();
  // 剔除 'for url '...''
  s = s.replace(/for url\s*['"]?\S*['"]?/gi, "").trim();
  // 剔除剩余 URL
  s = s.replace(/https?:\/\/\S+/g, "").trim();

  // 识别 'Client error 'XXX'/Server error 'XXX''
  const httpMatch = s.match(/(?:Client|Server) error\s+'?(\d{3})/i);
  if (httpMatch) {
    const code = httpMatch[1];
    const hint = STATUS_HINTS[code] ?? `服务方返回错误（HTTP ${code}）`;
    return hint;
  }

  // axios/fetch 风格 'Request failed with status code 429'
  const reqMatch = s.match(/status code (\d{3})/i);
  if (reqMatch) {
    return STATUS_HINTS[reqMatch[1]] ?? `服务方返回错误（HTTP ${reqMatch[1]}）`;
  }

  // 截断过长的 JSON dump 等
  if (s.length > MAX_LEN) {
    s = s.slice(0, MAX_LEN) + "…";
  }

  return s || fallback;
}
