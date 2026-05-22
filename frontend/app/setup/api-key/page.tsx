"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Compass, KeyRound, Loader2, Shield, Trash2 } from "lucide-react";
import { deleteSofunnyKeyApi, saveSofunnyKeyApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useBrowseOnlyMode } from "@/hooks/useBrowseOnlyMode";

export default function SetupApiKeyPage() {
  const router = useRouter();
  const { user, token, login } = useAuth();
  const { isMockBrowseOnly } = useBrowseOnlyMode();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const hasBoundKey = Boolean(user?.hasSofunnyKey);
  const isFeishuUser = user?.authProvider === "feishu";

  useEffect(() => {
    if (user?.hasSofunnyKey && !isMockBrowseOnly) {
      router.replace("/");
    }
  }, [router, user, isMockBrowseOnly]);

  if (!user || !token) return null;

  const handleSave = async () => {
    const normalized = apiKey.trim();
    if (!normalized) {
      setError("请输入 SOFUNNY_API_KEY");
      return;
    }
    if (!normalized.startsWith("sk-")) {
      setError("SOFUNNY_API_KEY 格式不正确，必须以 sk- 开头");
      return;
    }
    setSaving(true);
    setError("");
    setHint("");
    try {
      const data = await saveSofunnyKeyApi(normalized);
      login(token, data.user);
      setHint(data.message);
      router.replace("/");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    setHint("");
    try {
      const data = await deleteSofunnyKeyApi();
      login(token, data.user);
      setApiKey("");
      setHint("已移除绑定的 SOFUNNY_API_KEY");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "移除失败，请重试");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-10">
      <div
        className="rounded-3xl p-8"
        style={{
          background: "linear-gradient(145deg, rgba(20,16,40,0.9), rgba(15,23,42,0.9))",
          border: "1px solid rgba(139,92,246,0.18)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
        }}
      >
        <div className="flex justify-center mb-6">
          <img
            src="/brand/logo.png"
            alt="ArtFlow Logo"
            className="w-16 h-16 rounded-2xl object-cover"
            style={{ boxShadow: "0 0 28px rgba(139,92,246,0.28)" }}
          />
        </div>
        <div className="flex items-start gap-4 mb-6">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(124,58,237,0.28), rgba(168,85,247,0.18))",
              color: "#ede9fe",
              border: "1px solid rgba(196,181,253,0.18)",
              boxShadow: "0 10px 24px rgba(124,58,237,0.18)",
            }}
          >
            <KeyRound size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-[11px] font-semibold tracking-[0.22em] uppercase"
              style={{ color: "#c4b5fd" }}
            >
              API Key Access
            </p>
            <h1
              className="text-[2rem] font-bold mt-2 leading-tight"
              style={{ color: "#f8fafc", textShadow: "0 2px 18px rgba(0,0,0,0.18)" }}
            >
              创作功能需要绑定个人 SOFUNNY_API_KEY
            </h1>
            <p className="text-sm mt-3 leading-7" style={{ color: "rgba(226,232,240,0.88)" }}>
              登录只负责确认你的身份；真正调用 GPT-Image-2、提交生图任务、查看个人额度时，系统还需要读取你自己的 SOFUNNY_API_KEY。
              没有绑定时，你仍可以浏览案例和教程，但不能进入实际创作流程。
            </p>
          </div>
        </div>

        <div className="grid gap-4 mb-6">
          <div
            className="rounded-[24px] p-5"
            style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.24)" }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                style={{ background: "rgba(59,130,246,0.16)", color: "#dbeafe", border: "1px solid rgba(147,197,253,0.22)" }}
              >
                01
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold" style={{ color: "#eff6ff" }}>
                  先理解：为什么登录后还需要 API_KEY
                </p>
                <p className="text-sm leading-6 mt-2" style={{ color: "#dbeafe" }}>
                  飞书登录只负责确认“你是谁”；真正发起 GPT-Image-2 请求、读取个人额度、记录任务归属时，系统还要使用你自己的 SOFUNNY_API_KEY。
                </p>
              </div>
            </div>
          </div>

          <div
            className="rounded-[24px] p-5"
            style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.22)" }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                style={{ background: "rgba(52,211,153,0.14)", color: "#bbf7d0", border: "1px solid rgba(110,231,183,0.18)" }}
              >
                02
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold" style={{ color: "#ecfdf5" }}>
                  已有 API_KEY：现在填写并开通创作
                </p>
                <p className="text-sm leading-6 mt-2" style={{ color: "#d1fae5" }}>
                  如果你已经拿到了 SOFUNNY_API_KEY，直接粘贴到下方输入框即可。系统只保存加密后的 key，不回显明文；保存后会立即进入完整创作流程。
                </p>
              </div>
            </div>
          </div>

          <div
            className="rounded-[24px] p-5"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)" }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                style={{ background: "rgba(245,158,11,0.14)", color: "#fde68a", border: "1px solid rgba(253,230,138,0.18)" }}
              >
                03
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold" style={{ color: "#fffbeb" }}>
                  未有 API_KEY：先进入受限浏览模式
                </p>
                <p className="text-sm leading-6 mt-2" style={{ color: "#fef3c7" }}>
                  SOFUNNY_API_KEY 由 Sofunny AIKey 平台创建。如需正式开始创作，请先申请个人 key 并粘贴到下方。
                </p>
                <p className="text-sm leading-6 mt-2" style={{ color: "#fef3c7" }}>
                  如果你暂时还没有申请到 key，可以先浏览【首页】【灵感广场】【教程】，也可以直接使用【ComfyUI 工作流 → 萌宠旅人】。GPT-Image-2 相关按钮会友好提示你先补充 API_KEY。
                </p>
                {(isFeishuUser || isMockBrowseOnly) && (
                  <button
                    onClick={() => router.push("/workflow/pet-traveler")}
                    className="mt-4 px-4 py-2.5 rounded-2xl text-sm font-semibold flex items-center gap-2 transition-all"
                    style={{
                      background: "rgba(245,158,11,0.14)",
                      color: "#fef3c7",
                      border: "1px solid rgba(245,158,11,0.26)",
                    }}
                  >
                    <Compass size={15} />
                    {isMockBrowseOnly ? "进入模拟受限模式并打开 ComfyUI 工作流" : "打开 ComfyUI 工作流"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {hasBoundKey ? (
          <div
            className="rounded-2xl px-4 py-3 mb-5 flex items-start justify-between gap-4"
            style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.24)" }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: "#dcfce7" }}>
                当前账号已绑定 API_KEY
              </p>
              <p className="text-xs mt-1 leading-6" style={{ color: "#bbf7d0" }}>
                绑定成功后，登录会直接进入主页面。若 key 额度不足或需要换人使用，可以在这里更新或移除当前绑定。
              </p>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="block text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            SOFUNNY_API_KEY
          </label>
          <textarea
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="粘贴你自己的 SOFUNNY_API_KEY"
            rows={4}
            className="w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#f8fafc",
            }}
          />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            当前账号：{user.displayName} {user.sofunnyKeyMask ? `· 已绑定 ${user.sofunnyKeyMask}` : "· 尚未绑定"}
          </p>
        </div>

        {error && (
          <div
            className="mt-4 rounded-2xl px-4 py-3 text-sm"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5" }}
          >
            {error}
          </div>
        )}

        {hint && (
          <div
            className="mt-4 rounded-2xl px-4 py-3 text-sm flex items-start gap-2"
            style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#86efac" }}
          >
            <Check size={15} className="mt-0.5" />
            <span>{hint}</span>
          </div>
        )}

        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={handleSave}
            disabled={saving || deleting}
            className="px-5 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 transition-all"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #a855f7)",
              color: "#fff",
              opacity: saving || deleting ? 0.6 : 1,
            }}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}
            保存并继续
          </button>
          {user.hasSofunnyKey && (
            <button
              onClick={handleDelete}
              disabled={saving || deleting}
              className="px-5 py-3 rounded-2xl text-sm font-semibold flex items-center gap-2 transition-all"
              style={{
                background: "rgba(239,68,68,0.08)",
                color: "#f87171",
                border: "1px solid rgba(239,68,68,0.2)",
                opacity: saving || deleting ? 0.6 : 1,
              }}
            >
              {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              移除当前绑定
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
