"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, ArrowRight, FlaskConical, MessageCircle, Check } from "lucide-react";
import { getMeWithTokenApi, loginApi } from "@/lib/api";
import { AuthUser, useAuth } from "@/contexts/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_NAME = "卢锦锦";
const ADMIN_CONTACT_URL = process.env.NEXT_PUBLIC_ADMIN_CONTACT_URL?.trim() || "";

function LoginQuerySync({
  onPrefill,
  onFeishuToken,
  onFeishuUser,
  onFeishuError,
}: {
  onPrefill: (v: string) => void;
  onFeishuToken: (v: string) => void;
  onFeishuUser: (v: string) => void;
  onFeishuError: (v: string) => void;
}) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const prefill = searchParams.get("prefill");
    if (prefill) onPrefill(prefill);
    const token = searchParams.get("feishu_token");
    if (token) onFeishuToken(token);
    const feishuUser = searchParams.get("feishu_user");
    if (feishuUser) onFeishuUser(feishuUser);
    const feishuError = searchParams.get("feishu_error");
    if (feishuError) onFeishuError(feishuError);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function parseFeishuUserPayload(payload: string): AuthUser | null {
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const decoded = atob(padded);
    const bytes = Uint8Array.from(decoded, (ch) => ch.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as AuthUser;
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [feishuLoading, setFeishuLoading] = useState(false);
  const [feishuToken, setFeishuToken] = useState("");
  const [feishuUserPayload, setFeishuUserPayload] = useState("");
  const [contactCopied, setContactCopied] = useState(false);
  const { login, user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) router.replace("/");
  }, [user, isLoading, router]);

  useEffect(() => {
    if (isLoading || user || feishuLoading) return;
    if (!feishuToken) return;

    const payloadUser = feishuUserPayload ? parseFeishuUserPayload(feishuUserPayload) : null;
    if (payloadUser) {
      login(feishuToken, payloadUser);
      router.replace(payloadUser.hasSofunnyKey ? "/" : "/setup/api-key");
      return;
    }

    let cancelled = false;
    setFeishuLoading(true);
    setError("");
    getMeWithTokenApi(feishuToken)
      .then((me) => {
        if (cancelled) return;
        login(feishuToken, me);
        router.replace(me.hasSofunnyKey ? "/" : "/setup/api-key");
      })
      .catch(() => {
        if (cancelled) return;
        setError("飞书登录失败，请重试");
        setFeishuToken("");
        router.replace("/login");
      })
      .finally(() => {
        if (!cancelled) setFeishuLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [feishuLoading, feishuToken, feishuUserPayload, isLoading, login, router, user]);

  const doLogin = async (u: string, p: string) => {
    setError("");
    setLoading(true);
    try {
      const data = await loginApi(u.trim(), p);
      login(data.token, data.user);
      router.replace(data.user.hasSofunnyKey ? "/" : "/setup/api-key");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "用户名或密码错误");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    doLogin(username, password);
  };

  const startFeishuLogin = () => {
    if (loading || feishuLoading) return;
    const next = encodeURIComponent(window.location.origin);
    window.location.href = `${API_BASE}/auth/feishu/login?next=${next}`;
  };

  const handleAdminContact = async () => {
    if (loading || feishuLoading) return;
    if (ADMIN_CONTACT_URL) {
      window.open(ADMIN_CONTACT_URL, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const text = ADMIN_NAME;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus(); ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setContactCopied(true);
      setTimeout(() => setContactCopied(false), 1600);
    } catch {}
  };

  if (isLoading) return null;

  return (
    <>
      <Suspense fallback={null}>
        <LoginQuerySync
          onPrefill={setUsername}
          onFeishuToken={setFeishuToken}
          onFeishuUser={setFeishuUserPayload}
          onFeishuError={(msg) => {
            setError(msg);
            router.replace("/login");
          }}
        />
      </Suspense>

      <div
        className="min-h-screen w-full flex items-center justify-center p-6 relative overflow-hidden"
        style={{ background: "#080c16" }}
      >
        {/* 背景装饰光晕 */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 35%, rgba(124,58,237,0.18) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 50% 50% at 80% 100%, rgba(236,72,153,0.10) 0%, transparent 60%)",
          }}
        />
        {/* 网格 */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.07]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(139,92,246,0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(139,92,246,0.5) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        {/* 居中卡片 */}
        <div className="relative w-full max-w-md">
          {/* Logo + 标题 */}
          <div className="flex flex-col items-center mb-8">
            <img
              src="/brand/logo.png"
              alt="ArtFlow Logo"
              className="w-40 h-40 rounded-[34px] object-cover mb-6"
              style={{ boxShadow: "0 0 46px rgba(139,92,246,0.32)" }}
            />
            <span
              className="text-2xl font-bold tracking-wide mb-1"
              style={{
                fontFamily: "var(--font-rajdhani), sans-serif",
                background: "linear-gradient(135deg, #a78bfa, #f472b6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Sofunny ArtFlow
            </span>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              AI 创作平台 · 内部版本
            </p>
          </div>

          {/* 表单卡片 */}
          <div
            className="rounded-2xl p-7 backdrop-blur-sm"
            style={{
              background: "rgba(20,16,40,0.55)",
              border: "1px solid rgba(139,92,246,0.18)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04) inset",
            }}
          >
            <div className="mb-6">
              <h2
                className="text-xl font-bold mb-1"
                style={{ fontFamily: "var(--font-rajdhani), sans-serif", color: "#f0f0ff" }}
              >
                欢迎回来
              </h2>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                默认使用飞书登录，账号密码仅保留给兼容场景
              </p>
            </div>

            <button
              type="button"
              onClick={startFeishuLogin}
              disabled={loading || feishuLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all mb-4"
              style={{
                background: loading || feishuLoading ? "rgba(59,130,246,0.18)" : "rgba(59,130,246,0.22)",
                color: "#dbeafe",
                border: "1px solid rgba(96,165,250,0.28)",
                cursor: loading || feishuLoading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              <span
                className="w-4 h-4 rounded-full border-2 animate-spin"
                style={{
                  display: feishuLoading ? "inline-block" : "none",
                  borderColor: "rgba(255,255,255,0.28)",
                  borderTopColor: "#fff",
                }}
              />
              {feishuLoading ? "飞书登录中..." : "使用飞书登录"}
            </button>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }} />
              </div>
              <div className="relative flex justify-center">
                <span
                  className="px-3 text-[11px]"
                  style={{ background: "rgba(20,16,40,0.95)", color: "rgba(255,255,255,0.32)" }}
                >
                  或使用账号密码
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 用户名 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                  用户名
                </label>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="输入用户名"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#f0f0ff",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "rgba(139,92,246,0.6)";
                    e.currentTarget.style.background = "rgba(139,92,246,0.06)";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              {/* 密码 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                  密码
                </label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入密码"
                    className="w-full px-4 py-3 pr-12 rounded-xl text-sm outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#f0f0ff",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "rgba(139,92,246,0.6)";
                      e.currentTarget.style.background = "rgba(139,92,246,0.06)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(139,92,246,0.1)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                    style={{ color: "rgba(255,255,255,0.3)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.3)"; }}
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* 错误提示 */}
              {error && (
                <div
                  className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-xs"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    color: "#fca5a5",
                  }}
                >
                  <span className="mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full bg-red-400" />
                  {error}
                </div>
              )}

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={loading || feishuLoading || !username.trim() || !password}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: loading || feishuLoading || !username.trim() || !password
                    ? "rgba(139,92,246,0.25)"
                    : "linear-gradient(135deg, #7c3aed, #a855f7)",
                  color: loading || feishuLoading || !username.trim() || !password
                    ? "rgba(255,255,255,0.4)"
                    : "#fff",
                  cursor: loading || feishuLoading || !username.trim() || !password ? "not-allowed" : "pointer",
                  boxShadow: loading || feishuLoading || !username.trim() || !password
                    ? "none"
                    : "0 4px 24px rgba(139,92,246,0.45), 0 1px 0 rgba(255,255,255,0.1) inset",
                }}
                onMouseEnter={(e) => {
                  if (!loading && !feishuLoading && username.trim() && password) {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 32px rgba(139,92,246,0.6), 0 1px 0 rgba(255,255,255,0.1) inset";
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && !feishuLoading && username.trim() && password) {
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 24px rgba(139,92,246,0.45), 0 1px 0 rgba(255,255,255,0.1) inset";
                    (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                  }
                }}
              >
                {loading ? (
                  <>
                    <span
                      className="w-4 h-4 rounded-full border-2 animate-spin"
                      style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
                    />
                    登录中...
                  </>
                ) : (
                  <>
                    登录
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            {/* 开通说明卡 */}
            <div
              className="mt-6 rounded-xl p-4"
              style={{
                background: "rgba(52,211,153,0.06)",
                border: "1px dashed rgba(52,211,153,0.3)",
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical size={13} style={{ color: "#34d399" }} />
                <span className="text-xs font-semibold" style={{ color: "#6ee7b7" }}>
                  使用说明
                </span>
              </div>
              <p className="text-xs leading-relaxed mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>
                本平台为司内 AI 创作系统，默认使用飞书登录。如需测试账号请【飞书】联系管理员申请。管理员：{ADMIN_NAME}
              </p>

              <button
                type="button"
                onClick={handleAdminContact}
                disabled={loading || feishuLoading}
                className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: "rgba(52,211,153,0.12)",
                  border: "1px solid rgba(52,211,153,0.25)",
                  color: "#6ee7b7",
                  cursor: loading || feishuLoading ? "not-allowed" : "pointer",
                  opacity: loading || feishuLoading ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!loading && !feishuLoading) (e.currentTarget as HTMLButtonElement).style.background = "rgba(52,211,153,0.18)";
                }}
                onMouseLeave={(e) => {
                  if (!loading && !feishuLoading) (e.currentTarget as HTMLButtonElement).style.background = "rgba(52,211,153,0.12)";
                }}
              >
                {contactCopied ? <Check size={12} /> : <MessageCircle size={12} />}
                {contactCopied ? "已复制管理员信息" : ADMIN_CONTACT_URL ? "联系管理员开通" : "复制管理员信息"}
              </button>
            </div>
          </div>

          {/* 底部说明 */}
          <p className="text-center text-xs mt-6" style={{ color: "rgba(255,255,255,0.18)" }}>
            内测建议优先使用飞书登录；账号密码登录保留给兼容场景
          </p>
        </div>
      </div>
    </>
  );
}
