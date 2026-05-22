"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Shield, Settings, LogOut, ImageIcon, Calendar,
  Star, Brain, Edit3, Save, Sparkles, Zap, AlertCircle, KeyRound, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePreferences } from "@/hooks/usePreferences";
import { getTasks, getMyFeatured, saveSofunnyKeyApi, Task } from "@/lib/api";

const ASPECT_OPTIONS = [
  { id: "",     label: "自动" },
  { id: "1:1",  label: "1:1" },
  { id: "3:4",  label: "3:4" },
  { id: "9:16", label: "9:16" },
  { id: "4:3",  label: "4:3" },
  { id: "16:9", label: "16:9" },
];

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, login, logout } = useAuth();
  const { prefs, setPref, resetPrefs } = usePreferences();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [featuredCount, setFeaturedCount] = useState(0);

  // 编辑昵称
  const [editingNickname, setEditingNickname] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [editingApiKey, setEditingApiKey] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [apiKeyError, setApiKeyError] = useState("");
  const [apiKeyHint, setApiKeyHint] = useState("");

  useEffect(() => {
    Promise.all([getTasks(), getMyFeatured()])
      .then(([t, f]) => {
        setTasks(t);
        setFeaturedCount(f.length);
      })
      .catch(() => {});
  }, []);

  // ── 数据派生 ───────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const succeeded = tasks.filter((t) => t.status === "succeeded");
    const totalImages = succeeded.reduce(
      (sum, t) => sum + (((t.output as { output_files?: string[] })?.output_files?.length) ?? 0),
      0,
    );

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const monthImages = succeeded
      .filter((t) => new Date((t.updated_at.endsWith("Z") ? t.updated_at : t.updated_at + "Z")) >= startOfMonth)
      .reduce((sum, t) => sum + (((t.output as { output_files?: string[] })?.output_files?.length) ?? 0), 0);

    const thinkingTasks = succeeded.filter((t) => !!(t.output as { thinking?: unknown })?.thinking).length;

    // 模型分布
    const modelCount: Record<string, number> = {};
    for (const t of succeeded) modelCount[t.skill_id] = (modelCount[t.skill_id] || 0) + 1;
    const topModel = Object.entries(modelCount).sort((a, b) => b[1] - a[1])[0];

    return {
      totalImages,
      monthImages,
      thinkingTasks,
      topModel: topModel ? { name: topModel[0], count: topModel[1], pct: Math.round((topModel[1] / succeeded.length) * 100) } : null,
      successRate: tasks.length > 0 ? Math.round((succeeded.length / tasks.length) * 100) : 0,
    };
  }, [tasks]);

  // ── 昵称编辑 ───────────────────────────────────────────────────────────
  const startEditNickname = () => {
    setNicknameDraft(prefs.nickname);
    setEditingNickname(true);
  };
  const saveNickname = () => {
    setPref("nickname", nicknameDraft.trim().slice(0, 64));
    setEditingNickname(false);
  };

  const startEditApiKey = () => {
    setApiKeyDraft("");
    setApiKeyError("");
    setApiKeyHint("");
    setEditingApiKey(true);
  };

  const handleSaveApiKey = async () => {
    if (!token) return;
    const normalized = apiKeyDraft.trim();
    if (!normalized) {
      setApiKeyError("请输入 SOFUNNY_API_KEY");
      return;
    }
    if (!normalized.startsWith("sk-")) {
      setApiKeyError("SOFUNNY_API_KEY 格式不正确，必须以 sk- 开头");
      return;
    }
    setApiKeySaving(true);
    setApiKeyError("");
    setApiKeyHint("");
    try {
      const data = await saveSofunnyKeyApi(normalized);
      login(token, data.user);
      setApiKeyDraft("");
      setEditingApiKey(false);
      setApiKeyHint(data.message);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setApiKeyError(msg || "保存失败，请重试");
    } finally {
      setApiKeySaving(false);
    }
  };

  // ── 退出登录 ───────────────────────────────────────────────────────────
  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  if (!user) return null;

  const avatarGradient = user.isAdmin
    ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
    : "linear-gradient(135deg, #7c3aed, #ec4899)";
  const panelStyle = {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    boxShadow: "var(--panel-shadow)",
  } as const;
  const rowDivider = "1px solid var(--divider-soft)";
  const mutedSurface = {
    background: "var(--bg-surface-soft)",
    border: "1px solid var(--border)",
  } as const;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* ── 顶部用户 banner ── */}
      <div
        className="rounded-2xl overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, rgba(124,58,237,0.16) 0%, rgba(236,72,153,0.08) 100%), var(--bg-card)",
          border: "1px solid rgba(139,92,246,0.18)",
          boxShadow: "var(--panel-shadow)",
        }}
      >
        {/* 装饰光晕 */}
        <div
          className="absolute -top-8 -right-8 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%)" }}
        />

        <div className="relative p-6 flex items-center gap-5">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 relative"
            style={{ background: avatarGradient, boxShadow: "0 8px 28px rgba(124,58,237,0.5)" }}
          >
            <User size={36} color="#fff" />
            {user.isAdmin && (
              <span
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)", border: "2px solid var(--bg-card)" }}
                title="管理员"
              >
                <Shield size={12} color="#fff" />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-rajdhani), sans-serif", color: "var(--text-primary)" }}>
                {user.displayName}
              </h1>
              <span
                className="text-xs px-2 py-0.5 rounded-md font-semibold"
                style={{
                  background: user.isAdmin ? "rgba(251,191,36,0.18)" : "rgba(139,92,246,0.15)",
                  color: user.isAdmin ? "#fbbf24" : "#a78bfa",
                  border: `1px solid ${user.isAdmin ? "rgba(251,191,36,0.35)" : "rgba(139,92,246,0.3)"}`,
                }}
              >
                {user.isAdmin ? "管理员" : "普通用户"}
              </span>
            </div>
            <p className="text-sm mt-1 font-mono" style={{ color: "var(--text-muted)" }}>@{user.username}</p>
            <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
              累计提交 {tasks.length} 个任务 · 成功率 {stats.successRate}%
            </p>
          </div>
        </div>
      </div>

      {/* ── 数据概览 ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={14} style={{ color: "#a78bfa" }} />
          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>数据概览</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "累计生图",    value: stats.totalImages,    color: "#38bdf8", icon: ImageIcon },
            { label: "本月生图",    value: stats.monthImages,    color: "#34d399", icon: Calendar },
            { label: "我的精选",    value: featuredCount,        color: "#fbbf24", icon: Star },
            { label: "思考辅助",    value: stats.thinkingTasks,  color: "#c4b5fd", icon: Brain },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-4"
              style={panelStyle}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-2"
                style={{ background: `${s.color}15`, color: s.color }}
              >
                <s.icon size={16} />
              </div>
              <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "var(--font-rajdhani), sans-serif" }}>
                {s.value}
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {stats.topModel && (
          <div
            className="mt-3 rounded-xl px-4 py-3 flex items-center gap-3"
            style={panelStyle}
          >
            <Zap size={14} style={{ color: "#38bdf8" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              最常使用的模型 ·
            </span>
            <span className="text-sm font-semibold" style={{ color: "#38bdf8" }}>
              {stats.topModel.name}
            </span>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              （占 {stats.topModel.pct}%）
            </span>
          </div>
        )}
      </div>

      {/* ── 我的昵称（共享账号场景） ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <User size={14} style={{ color: "#818cf8" }} />
          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>我的昵称</h2>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>· 共享账号下用于让管理员知道是你</span>
        </div>
        <div
          className="rounded-xl p-4"
          style={panelStyle}
        >
          <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            如果你和同事共用一个测试账号（如 <span className="font-mono" style={{ color: "#a78bfa" }}>test001</span>），
            可以在这里设置一个昵称（如「设计部张三」「项目 A 美术」）。
            后续你提交的所有任务都会带上这个昵称，管理员能在历史中看到具体是谁创建的。
            如果你使用飞书登录，这个昵称只作为补充备注，不再是主身份。
            昵称和你的 IP 一起仅对管理员可见。
          </p>
          {editingNickname ? (
            <div className="flex gap-2 items-center">
              <input
                autoFocus
                type="text"
                value={nicknameDraft}
                onChange={(e) => setNicknameDraft(e.target.value)}
                placeholder="如：设计部张三"
                maxLength={64}
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--bg-surface-soft)", border: "1px solid rgba(99,102,241,0.28)", color: "var(--text-primary)" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveNickname();
                  if (e.key === "Escape") setEditingNickname(false);
                }}
              />
              <button
                onClick={saveNickname}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "rgba(99,102,241,0.12)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.22)" }}
              >
                <Save size={11} />保存
              </button>
              <button
                onClick={() => setEditingNickname(false)}
                className="px-3 py-2 rounded-xl text-xs"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                取消
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div
                className="flex-1 px-3 py-2 rounded-xl text-sm flex items-center gap-2"
                style={mutedSurface}
              >
                {prefs.nickname ? (
                  <span style={{ color: "#6366f1", fontWeight: 600 }}>👤 {prefs.nickname}</span>
                ) : (
                  <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>未设置（管理员只能看到你的 IP）</span>
                )}
              </div>
              <button
                onClick={startEditNickname}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium"
                style={{ background: "rgba(99,102,241,0.1)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.2)" }}
              >
                <Edit3 size={11} />{prefs.nickname ? "修改" : "设置"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 偏好设置 ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Settings size={14} style={{ color: "#34d399" }} />
          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>创作偏好</h2>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>· 进入创作页时这些会作为默认值</span>
        </div>
        <div className="rounded-2xl overflow-hidden" style={panelStyle}>

          {/* 默认画面比例 */}
          <div className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>默认画面比例</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>新任务进入时自动选中</p>
            </div>
            <div className="flex gap-1 flex-wrap">
              {ASPECT_OPTIONS.map((opt) => {
                const active = prefs.defaultAspectRatio === opt.id;
                return (
                  <button
                    key={opt.id || "auto"}
                    onClick={() => setPref("defaultAspectRatio", opt.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: active ? "rgba(14,165,233,0.12)" : "var(--bg-surface-soft)",
                      color: active ? "#0284c7" : "var(--text-secondary)",
                      border: `1px solid ${active ? "rgba(14,165,233,0.22)" : "var(--border)"}`,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 默认生成数量 */}
          <div className="p-4 flex items-center gap-3" style={{ borderTop: rowDivider }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>默认生成数量</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>1–4 张</p>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((n) => {
                const active = prefs.defaultOutputCount === n;
                return (
                  <button
                    key={n}
                    onClick={() => setPref("defaultOutputCount", n)}
                    className="w-9 h-8 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: active ? "rgba(14,165,233,0.12)" : "var(--bg-surface-soft)",
                      color: active ? "#0284c7" : "var(--text-secondary)",
                      border: `1px solid ${active ? "rgba(14,165,233,0.22)" : "var(--border)"}`,
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 默认开思考 */}
          <div className="p-4 flex items-center gap-3" style={{ borderTop: rowDivider }}>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                <Brain size={12} style={{ color: "#c4b5fd" }} />
                默认开启智能优化提示词
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                进入创作页时是否自动开启 GPT-5 思考模式
              </p>
            </div>
            <button
              onClick={() => setPref("defaultEnableThinking", !prefs.defaultEnableThinking)}
              className="relative flex-shrink-0"
              style={{ width: 36, height: 20 }}
            >
              <div
                className="absolute inset-0 rounded-full transition-colors duration-200"
                style={{
                  background: prefs.defaultEnableThinking ? "rgba(167,139,250,0.28)" : "var(--bg-surface-soft)",
                  border: `1px solid ${prefs.defaultEnableThinking ? "rgba(167,139,250,0.34)" : "var(--border)"}`,
                }}
              />
              <div
                className="absolute top-0.5 rounded-full transition-all duration-200"
                style={{
                  width: 16, height: 16,
                  left: prefs.defaultEnableThinking ? 18 : 2,
                  background: prefs.defaultEnableThinking ? "#8b5cf6" : "var(--text-muted)",
                }}
              />
            </button>
          </div>

          {/* 重置 */}
          <div className="p-3 flex justify-end" style={{ borderTop: rowDivider }}>
            <button
              onClick={resetPrefs}
              className="text-xs px-3 py-1 rounded-lg transition-colors"
              style={{ color: "var(--text-secondary)", background: "var(--bg-surface-soft)" }}
            >
              重置为默认值
            </button>
          </div>
        </div>
      </div>

      {/* ── 我的 API Key ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={14} style={{ color: "#93c5fd" }} />
          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>我的 API Key</h2>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>· 用于 Sofunny 生图能力</span>
        </div>
        <div
          className="rounded-xl p-4"
          style={panelStyle}
        >
          <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            当前账号仅绑定一把个人 SOFUNNY_API_KEY。若 key 没额度或想切换到新 key，可在这里直接更新。
            系统只保存加密后的 key，不会回显明文。
          </p>

          <div
            className="rounded-xl px-3 py-2.5 flex items-center gap-2"
            style={{ background: "var(--status-info-bg)", border: "1px solid var(--status-info-border)" }}
          >
            <KeyRound size={14} style={{ color: "#93c5fd" }} />
            {user.sofunnyKeyMask ? (
              <span className="text-sm font-medium" style={{ color: "var(--status-info-text)" }}>
                当前已绑定：{user.sofunnyKeyMask}
              </span>
            ) : (
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                当前未绑定 SOFUNNY_API_KEY
              </span>
            )}
          </div>

          {apiKeyHint && (
            <div
              className="mt-3 rounded-xl px-3 py-2.5 text-xs flex items-start gap-2"
              style={{ background: "var(--status-success-bg)", border: "1px solid var(--status-success-border)", color: "var(--status-success-text)" }}
            >
              <span className="mt-0.5">✓</span>
              <span>{apiKeyHint}</span>
            </div>
          )}

          {apiKeyError && (
            <div
              className="mt-3 rounded-xl px-3 py-2.5 text-xs"
              style={{ background: "var(--status-danger-bg)", border: "1px solid var(--status-danger-border)", color: "var(--status-danger-text)" }}
            >
              {apiKeyError}
            </div>
          )}

          {editingApiKey ? (
            <div className="mt-3 space-y-3">
              <textarea
                autoFocus
                rows={4}
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
                placeholder="输入新的 SOFUNNY_API_KEY（必须以 sk- 开头）"
                className="w-full px-3 py-3 rounded-xl text-sm outline-none resize-none"
                style={{ background: "var(--bg-surface-soft)", border: "1px solid rgba(59,130,246,0.22)", color: "var(--text-primary)" }}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveApiKey}
                  disabled={apiKeySaving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: "rgba(59,130,246,0.12)", color: "var(--status-info-text)", border: "1px solid rgba(59,130,246,0.22)", opacity: apiKeySaving ? 0.7 : 1 }}
                >
                  {apiKeySaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  保存 Key
                </button>
                <button
                  onClick={() => { setEditingApiKey(false); setApiKeyDraft(""); setApiKeyError(""); }}
                  className="px-4 py-2 rounded-xl text-xs"
                  style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={startEditApiKey}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "rgba(59,130,246,0.1)", color: "var(--status-info-text)", border: "1px solid rgba(59,130,246,0.18)" }}
              >
                <Edit3 size={12} />
                {user.sofunnyKeyMask ? "更新 Key" : "绑定 Key"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 危险区 ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={14} style={{ color: "#f87171" }} />
          <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>账号操作</h2>
        </div>
        <button
          onClick={handleLogout}
          className="w-full rounded-xl p-4 flex items-center gap-3 transition-all text-left"
          style={panelStyle}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.05)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.25)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-card)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
          }}
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}
          >
            <LogOut size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "#f87171" }}>退出登录</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>下次访问需要重新输入账号密码</p>
          </div>
        </button>
      </div>
    </div>
  );
}
