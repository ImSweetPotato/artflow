"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Trash2, Eye, Wand2, ImageIcon, Clock, Layers, Play, Zap, X, Star, RotateCcw, ChevronDown, Check, Users, UserRound, Sparkles, AlertCircle } from "lucide-react";
import FeaturedModal from "@/components/FeaturedModal";
import { getTasks, deleteTask, retryTask, Task, getTaskOwners, TaskOwnerOption } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatError } from "@/lib/format-error";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STATUS_TABS = [
  { key: "", label: "全部" },
  { key: "succeeded", label: "已完成" },
  { key: "running", label: "进行中" },
  { key: "retrying", label: "重试中" },
  { key: "pending", label: "等待中" },
  { key: "failed", label: "失败" },
];

const STATUS_DOT: Record<string, string> = {
  pending:   "bg-yellow-400",
  running:   "bg-blue-400",
  retrying:  "bg-orange-400",
  succeeded: "bg-green-400",
  failed:    "bg-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  pending:   "等待中",
  running:   "进行中",
  retrying:  "重试中",
  succeeded: "已完成",
  failed:    "失败",
};

const PHASE_LABEL: Record<string, string> = {
  "2": "角色生成",
  "3": "背景生成",
  "4": "融合成图",
};

const MODULE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  gptimage2:         { label: "GPT-Image-2",  color: "#38bdf8", bg: "rgba(14,165,233,0.10)",  border: "rgba(14,165,233,0.28)"  },
  sketch2portrait:   { label: "原画转2D",      color: "#22d3ee", bg: "rgba(34,211,238,0.10)",  border: "rgba(34,211,238,0.28)"  },
  sketch2keyvisual:  { label: "原画转宣发图",  color: "#fb923c", bg: "rgba(251,146,60,0.10)",  border: "rgba(251,146,60,0.28)"  },
  comfyui_pet_traveler: { label: "萌宠旅人",   color: "#5eead4", bg: "rgba(20,184,166,0.10)", border: "rgba(20,184,166,0.28)" },
};

const MODULE_TABS = [
  { key: "",             label: "全部" },
  { key: "gptimage2",   label: "创作" },
  { key: "comfyui_pet_traveler", label: "ComfyUI" },
];

const OWNER_QUICK_FILTERS = [
  { key: "", label: "全部人员", hint: "查看所有账号的生图记录", icon: Users, accent: "rgba(56,189,248,0.22)", color: "#7dd3fc" },
  { key: "mine", label: "我生成的", hint: "只看当前管理员自己的记录", icon: UserRound, accent: "rgba(139,92,246,0.22)", color: "#c4b5fd" },
  { key: "others", label: "其他人生成的", hint: "排除自己，只看团队其他成员", icon: Sparkles, accent: "rgba(251,191,36,0.2)", color: "#fde68a" },
] as const;

function getInputParam(task: Task, key: string): string {
  const p = task.input_params as Record<string, unknown>;
  return p?.[key] != null ? String(p[key]) : "";
}

/** 拿任务的"主参考图"路径：优先单图字段，其次取多图数组的第一张 */
function getPrimaryRefPath(task: Task): string {
  const p = task.input_params as Record<string, unknown>;
  if (p?.image_path) return String(p.image_path);
  const arr = p?.image_paths;
  if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "string") return arr[0];
  return "";
}

/** 任务参考图总数，用于在缩略图上叠 +N 角标 */
function getRefCount(task: Task): number {
  const p = task.input_params as Record<string, unknown>;
  const arr = p?.image_paths;
  if (Array.isArray(arr)) return arr.length;
  return p?.image_path ? 1 : 0;
}

function isSafetyRejectedTask(task: Task): boolean {
  const msg = String(task.error_message || "");
  return /内容安全策略|安全策略|rejected by the safety system|content policy|safety system/i.test(msg);
}

function canSafetyRewriteRetry(task: Task): boolean {
  if (!isSafetyRejectedTask(task)) return false;
  const p = task.input_params as Record<string, unknown>;
  return task.skill_id === "gptimage2" || String(p?.image_backend || "") === "gpt-image-2";
}

function getOutputFiles(task: Task): string[] {
  const o = task.output as { output_files?: string[] } | null;
  return o?.output_files ?? [];
}

function outputToUrl(filePath: string): string {
  const rel = filePath.replace(/\\/g, "/").split("outputs/").pop();
  return `${API_BASE}/outputs/${rel}`;
}

function refImageUrl(imagePath: string): string {
  // uploads\abc.png → /uploads/abc.png served by backend static
  const name = imagePath.replace(/\\/g, "/").split("/").pop() ?? "";
  return `${API_BASE}/uploads/${name}`;
}

const STATUS_BORDER: Record<string, string> = {
  pending:   "rgba(251,191,36,0.45)",
  running:   "rgba(96,165,250,0.55)",
  retrying:  "rgba(251,146,60,0.50)",
  succeeded: "rgba(52,211,153,0.35)",
  failed:    "rgba(239,68,68,0.5)",
};
const STATUS_BORDER_HOVER: Record<string, string> = {
  pending:   "rgba(251,191,36,0.65)",
  running:   "rgba(96,165,250,0.75)",
  retrying:  "rgba(251,146,60,0.70)",
  succeeded: "rgba(52,211,153,0.55)",
  failed:    "rgba(239,68,68,0.7)",
};

function formatDate(iso: string) {
  // 后端返回 UTC 时间（无 Z 后缀），需补 Z 再转本地时区显示
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z");
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getOwnerFilterMeta(ownerFilter: string, ownerOptions: TaskOwnerOption[]) {
  const quick = OWNER_QUICK_FILTERS.find((item) => item.key === ownerFilter);
  if (quick) return { label: quick.label, hint: quick.hint };
  const owner = ownerOptions.find((item) => item.id === ownerFilter);
  if (owner) return { label: owner.displayName, hint: owner.username };
  return { label: "全部人员", hint: "查看所有账号的生图记录" };
}

export default function TasksPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState("");
  const [activeStatus, setActiveStatus] = useState("");
  const [activeModule, setActiveModule] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [featuredTarget, setFeaturedTarget] = useState<{ url: string; prompt: string; refImage?: string } | null>(null);
  const [showScheduledOnly, setShowScheduledOnly] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [ownerOptions, setOwnerOptions] = useState<TaskOwnerOption[]>([]);
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const [ownerSearch, setOwnerSearch] = useState("");
  const ownerMenuRef = useRef<HTMLDivElement>(null);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const load = useCallback(() => {
    getTasks({ search, status: activeStatus, skill_ids: activeModule, owner_filter: ownerFilter }).then((data) => {
      setTasks(data);
      // 注意：不在这里 setPage(1)！否则 5 秒轮询每次都会把用户弹回第 1 页。
      // 翻页应只在筛选条件变化时重置，见下方 useEffect。
    });
  }, [search, activeStatus, activeModule, ownerFilter]);

  // 筛选条件变化时回第 1 页
  useEffect(() => {
    setPage(1);
  }, [search, activeStatus, activeModule, showScheduledOnly, ownerFilter]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    getTaskOwners().then(setOwnerOptions).catch(() => setOwnerOptions([]));
  }, [user?.isAdmin]);

  useEffect(() => {
    if (!ownerMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (ownerMenuRef.current && !ownerMenuRef.current.contains(event.target as Node)) {
        setOwnerMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [ownerMenuOpen]);

  useEffect(() => {
    if (!ownerMenuOpen) {
      setOwnerSearch("");
    }
  }, [ownerMenuOpen]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  const handleRetry = async (id: string, mode: "normal" | "safety_rewrite" = "normal") => {
    setRetryingId(id);
    try {
      await retryTask(id, mode);
      // 立即刷新列表，让状态从 failed 变成 pending/running
      load();
    } finally {
      setRetryingId(null);
    }
  };

  const handleCloneCreate = async (task: Task) => {
    if (task.skill_id === "gptimage2") {
      router.push(`/create/gptimage2?from=${task.id}`);
    } else if (task.skill_id === "comfyui_pet_traveler") {
      router.push("/workflow/pet-traveler");
    } else if (task.skill_id === "sketch2keyvisual") {
      const taskNameStr = getInputParam(task, "task_name");
      if (taskNameStr) {
        // 查出同任务名下所有 Phase，重建 session
        const allTasks = await getTasks({ search: taskNameStr });
        const proj = allTasks.filter(
          (t) => t.skill_id === "sketch2keyvisual" && getInputParam(t, "task_name") === taskNameStr,
        );
        const p2 = proj.find((t) => getInputParam(t, "phase") === "2");
        const p3 = proj.find((t) => getInputParam(t, "phase") === "3");
        const p4 = proj.find((t) => getInputParam(t, "phase") === "4");

        if (p2) {
          const ip2 = p2.input_params as Record<string, unknown>;
          const ip3 = (p3?.input_params ?? {}) as Record<string, unknown>;
          const p2Files = p2.status === "succeeded"
            ? ((p2.output as { output_files?: string[] })?.output_files ?? []) : [];
          const p3Files = p3?.status === "succeeded"
            ? ((p3.output as { output_files?: string[] })?.output_files ?? []) : [];
          const p4Files = p4?.status === "succeeded"
            ? ((p4.output as { output_files?: string[] })?.output_files ?? []) : [];

          const p2Confirmed = p2.status === "succeeded" && !!p3;
          let currentPhase = 2;
          if (p4?.status === "running" || p4?.status === "pending") currentPhase = 4;
          else if (p3?.status === "running" || p3?.status === "pending") currentPhase = 3;
          else if (p2?.status === "running" || p2?.status === "pending") currentPhase = 2;
          else if (p4Files.length) currentPhase = 5;
          else if (p3Files.length) currentPhase = 4;
          else if (p2Files.length && p3) currentPhase = 3; // p2 已确认，p3 已创建
          else if (p2Files.length) currentPhase = 2; // p2 完成，待用户确认

          localStorage.setItem("artflow_promo_session", JSON.stringify({
            taskName: taskNameStr,
            templateType: String(ip2.template_type ?? "2d"),
            imageBackend: String(ip2.image_backend ?? "seedream"),
            outputCount: Number(ip2.output_count ?? 3),
            aspectRatio: String(ip3.aspect_ratio ?? ip2.aspect_ratio ?? "16:9"),
            selectedBgKeywords: [],
            customBgKeyword: "",
            refPath: String(ip2.image_path ?? ""),
            currentPhase,
            p2TaskId: p2.id,
            p2Selected: p2Files[0] ?? "",
            p2Confirmed,
            p3TaskId: p3?.id ?? null,
            p3Selected: p3Files[0] ?? "",
            p4TaskId: p4?.id ?? null,
            p4SelectedPaths: p4Files,
          }));
        }
      }
      router.push("/create/promo");
    } else {
      router.push(`/create/sketch2d?from=${task.id}`);
    }
  };

  // 统计（基于原始列表）
  const total = tasks.length;
  const succeeded = tasks.filter((t) => t.status === "succeeded").length;
  const running = tasks.filter((t) => t.status === "running" || t.status === "pending").length;
  const failed = tasks.filter((t) => t.status === "failed").length;

  // 客户端二次过滤：定时任务
  const displayedTasks = showScheduledOnly
    ? tasks.filter((t) => !!getInputParam(t, "scheduled_at"))
    : tasks;

  const totalPages = Math.ceil(displayedTasks.length / PAGE_SIZE);
  const pagedTasks = displayedTasks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const ownerMeta = getOwnerFilterMeta(ownerFilter, ownerOptions);
  const filteredOwnerOptions = ownerOptions.filter((owner) => {
    const keyword = ownerSearch.trim().toLowerCase();
    if (!keyword) return true;
    return owner.displayName.toLowerCase().includes(keyword) || owner.username.toLowerCase().includes(keyword);
  });

  return (
    <>
    <div className="max-w-5xl">
      {/* 页头 */}
      <div className="mb-6">
        <h1
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: "var(--font-rajdhani), sans-serif", color: "var(--text-primary)" }}
        >
          生图历史
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          管理所有创作记录，随时一键复用参数
        </p>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "总任务", value: total, color: "var(--text-primary)" },
          { label: "已完成", value: succeeded, color: "#34d399" },
          { label: "进行中", value: running, color: "#60a5fa" },
          { label: "失败", value: failed, color: "#f87171" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-4 text-center"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* 模块 Tab + 定时筛选 */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {MODULE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveModule(tab.key)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: activeModule === tab.key ? "rgba(139,92,246,0.18)" : "var(--bg-card)",
              color: activeModule === tab.key ? "#c084fc" : "var(--text-muted)",
              border: `1px solid ${activeModule === tab.key ? "rgba(139,92,246,0.4)" : "var(--border)"}`,
            }}
          >
            {tab.label}
          </button>
        ))}
        {/* 分隔线 */}
        <div className="w-px h-4 mx-1 flex-shrink-0" style={{ background: "var(--border)" }} />
        {/* 定时任务筛选 */}
        <button
          onClick={() => setShowScheduledOnly(!showScheduledOnly)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: showScheduledOnly ? "rgba(139,92,246,0.18)" : "var(--bg-card)",
            color: showScheduledOnly ? "#a78bfa" : "var(--text-muted)",
            border: `1px solid ${showScheduledOnly ? "rgba(139,92,246,0.4)" : "var(--border)"}`,
          }}
        >
          <Clock size={11} />
          定时任务
        </button>
      </div>

      {/* 搜索 + 状态筛选 */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center">
          <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索任务名..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
          />
          </div>
          {user?.isAdmin && (
            <div className="relative w-full lg:w-[280px] xl:w-[320px]" ref={ownerMenuRef}>
            <button
              type="button"
              onClick={() => setOwnerMenuOpen((open) => !open)}
              className="interactive-surface w-full h-[42px] rounded-xl px-3 py-2 text-left"
              style={{
                background: ownerMenuOpen
                  ? "linear-gradient(135deg, rgba(139,92,246,0.16), rgba(59,130,246,0.08)), var(--bg-card)"
                  : "var(--bg-card)",
                border: `1px solid ${ownerMenuOpen ? "rgba(139,92,246,0.34)" : "var(--border)"}`,
                boxShadow: ownerMenuOpen ? "0 0 0 3px rgba(139,92,246,0.08), var(--panel-shadow)" : "none",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: "linear-gradient(135deg, rgba(139,92,246,0.24), rgba(59,130,246,0.18))",
                    color: "#c4b5fd",
                    border: "1px solid rgba(139,92,246,0.24)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
                  }}
                >
                  <Users size={14} />
                </div>
                <div className="min-w-0 flex-1 flex items-center gap-2">
                  <span className="text-xs font-medium flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                    所属
                  </span>
                  <div className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {ownerMeta.label}
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  style={{
                    color: "var(--text-muted)",
                    transform: ownerMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </div>
            </button>

            {ownerMenuOpen && (
              <div
                className="absolute left-0 right-0 top-full mt-2 rounded-2xl overflow-hidden"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--panel-shadow)",
                  backdropFilter: "blur(20px)",
                  zIndex: 30,
                }}
              >
                <div className="p-2.5 space-y-2">
                  {OWNER_QUICK_FILTERS.map((option) => {
                    const active = ownerFilter === option.key;
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setOwnerFilter(option.key);
                          setOwnerMenuOpen(false);
                        }}
                        className="interactive-dropdown-item w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left"
                        style={{
                          background: active ? option.accent : "transparent",
                          border: `1px solid ${active ? option.accent : "transparent"}`,
                        }}
                        >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            background: active ? "rgba(255,255,255,0.08)" : "var(--bg-surface)",
                            color: option.color,
                          }}
                        >
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold" style={{ color: active ? option.color : "var(--text-primary)" }}>
                            {option.label}
                          </div>
                        </div>
                        {active && <Check size={14} style={{ color: option.color }} />}
                      </button>
                    );
                  })}
                </div>

                {ownerOptions.length > 0 && (
                  <div style={{ borderTop: "1px solid var(--border)" }}>
                    <div className="px-2.5 pt-2.5 pb-2">
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                        <input
                          type="text"
                          value={ownerSearch}
                          onChange={(e) => setOwnerSearch(e.target.value)}
                          placeholder="搜索人员"
                          className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none"
                          style={{
                            background: "var(--bg-surface)",
                            border: "1px solid var(--border)",
                            color: "var(--text-primary)",
                          }}
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto px-2.5 pb-2.5">
                      {filteredOwnerOptions.map((owner) => {
                        const active = ownerFilter === owner.id;
                        return (
                          <button
                            key={owner.id}
                            type="button"
                            onClick={() => {
                              setOwnerFilter(owner.id);
                              setOwnerMenuOpen(false);
                            }}
                            className="interactive-dropdown-item w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left"
                            style={{
                              background: active ? "rgba(56,189,248,0.12)" : "transparent",
                              border: `1px solid ${active ? "rgba(56,189,248,0.22)" : "transparent"}`,
                            }}
                          >
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                              style={{
                                background: active ? "rgba(56,189,248,0.16)" : "var(--bg-surface)",
                                color: active ? "#7dd3fc" : "var(--text-secondary)",
                              }}
                            >
                              {owner.displayName.slice(0, 1)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[13px] font-semibold truncate" style={{ color: active ? "#7dd3fc" : "var(--text-primary)" }}>
                                {owner.displayName}
                              </div>
                              <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                                @{owner.username}
                              </div>
                            </div>
                            {active && <Check size={14} style={{ color: "#7dd3fc" }} />}
                          </button>
                        );
                      })}
                      {filteredOwnerOptions.length === 0 && (
                        <div className="px-3 py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                          没有匹配的人员
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveStatus(tab.key)}
              className="px-3 py-2 rounded-xl text-xs font-medium transition-all"
              style={{
                background: activeStatus === tab.key ? "rgba(139,92,246,0.2)" : "var(--bg-card)",
                color: activeStatus === tab.key ? "#a78bfa" : "var(--text-muted)",
                border: `1px solid ${activeStatus === tab.key ? "rgba(139,92,246,0.4)" : "var(--border)"}`,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 列表 */}
      {displayedTasks.length === 0 ? (
        <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>
          <ImageIcon size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{showScheduledOnly ? "没有定时任务" : "暂无记录"}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {pagedTasks.map((task) => {
              const taskName = getInputParam(task, "task_name") || task.skill_id;
              const actionsCount = getInputParam(task, "actions_count");
              const isKeyvisual = task.skill_id === "sketch2keyvisual";
              const phase = getInputParam(task, "phase");
              const imagePath = isKeyvisual
                ? (getInputParam(task, "char_image_path") || getInputParam(task, "image_path"))
                : getPrimaryRefPath(task);
              const refCount = isKeyvisual ? (imagePath ? 1 : 0) : getRefCount(task);
              const imageUrlParam = getInputParam(task, "image_url"); // 从灵感广场跳转时用 URL 而非本地路径
              const outputFiles = getOutputFiles(task);
              const isDeleting = deletingId === task.id;
              const isConfirming = confirmId === task.id;

              return (
                <motion.div
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl p-4 cursor-pointer"
                  onClick={() => router.push(`/tasks/${task.id}`)}
                  onMouseEnter={() => setHoveredId(task.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    background: hoveredId === task.id ? "rgba(255,255,255,0.025)" : "var(--bg-card)",
                    border: `1.5px solid ${hoveredId === task.id ? STATUS_BORDER_HOVER[task.status] : STATUS_BORDER[task.status] ?? "var(--border)"}`,
                    boxShadow: hoveredId === task.id ? "0 4px 24px rgba(0,0,0,0.18)" : "none",
                    transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
                  }}
                >
                  <div className="flex gap-4">
                    {/* 参考图 */}
                    <div
                      className="w-16 h-16 rounded-xl flex-shrink-0 overflow-hidden relative"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
                    >
                      {(imagePath || imageUrlParam) ? (
                        <img
                          src={imagePath ? refImageUrl(imagePath) : imageUrlParam!}
                          alt="参考图"
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                          <ImageIcon size={18} style={{ color: "rgba(14,165,233,0.5)" }} />
                          <span className="text-xs leading-none" style={{ color: "var(--text-muted)", fontSize: 9 }}>
                            文生图
                          </span>
                        </div>
                      )}
                      {refCount > 1 && (
                        <div
                          className="absolute bottom-0.5 right-0.5 px-1 rounded text-xs font-bold leading-none"
                          style={{ background: "rgba(14,165,233,0.85)", color: "#fff", fontSize: 9 }}
                        >
                          +{refCount - 1}
                        </div>
                      )}
                    </div>

                    {/* 主信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="font-semibold text-sm truncate"
                              style={{ color: "var(--text-primary)" }}
                            >
                              {taskName}
                            </span>
                            {/* 模块徽标 */}
                            {MODULE_META[task.skill_id] && (
                              <span
                                className="flex-shrink-0 text-xs px-2 py-0.5 rounded-md font-semibold"
                                style={{
                                  color: MODULE_META[task.skill_id].color,
                                  background: MODULE_META[task.skill_id].bg,
                                  border: `1px solid ${MODULE_META[task.skill_id].border}`,
                                }}
                              >
                                {MODULE_META[task.skill_id].label}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <span
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[task.status] ?? "bg-gray-400"}`}
                              />
                              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {STATUS_LABEL[task.status] ?? task.status}
                              </span>
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {isKeyvisual && phase ? (
                              <span
                                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md"
                                style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}
                              >
                                <Layers size={11} />
                                {PHASE_LABEL[phase] ?? "宣发图"}
                              </span>
                            ) : !isKeyvisual && actionsCount ? (
                              <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                                <Layers size={11} />
                                {actionsCount} 组
                              </span>
                            ) : null}
                            <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                              <Clock size={11} />
                              {formatDate(task.created_at)}
                            </span>
                            {user?.isAdmin && task.ownerDisplayName && (
                              <span
                                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md"
                                style={{ background: "rgba(56,189,248,0.1)", color: "#7dd3fc", border: "1px solid rgba(56,189,248,0.22)" }}
                                title={task.ownerUsername ? `账号：${task.ownerUsername}` : undefined}
                              >
                                所属：{task.ownerDisplayName}
                              </span>
                            )}
                            {/* 定时任务徽标 */}
                            {getInputParam(task, "scheduled_at") && (
                              <span
                                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md"
                                style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}
                              >
                                <Clock size={10} />
                                定时 {(() => {
                                  const sa = getInputParam(task, "scheduled_at"); // "2026-04-30T10:55:00"
                                  const [date, time] = sa.split("T");
                                  const [y, m, d] = date.split("-");
                                  return `${parseInt(m)}/${parseInt(d)} ${time.slice(0, 5)}`;
                                })()}
                              </span>
                            )}
                            {/* 使用者追溯（仅管理员可见） */}
                            {user?.isAdmin && (task.created_by_nickname || task.created_by_ip) && (
                              <span
                                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md"
                                style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}
                                title={`IP: ${task.created_by_ip ?? "未知"}`}
                              >
                                {task.created_by_nickname ? `👤 ${task.created_by_nickname}` : `🌐 ${task.created_by_ip}`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* 继续进程 / 一键创作 */}
                          {isKeyvisual ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCloneCreate(task); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                              style={{
                                background: "rgba(96,165,250,0.12)",
                                color: "#60a5fa",
                                border: "1px solid rgba(96,165,250,0.25)",
                              }}
                              title="继续进程"
                            >
                              <Play size={12} />
                              继续进程
                            </button>
                          ) : task.skill_id === "gptimage2" ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCloneCreate(task); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                              style={{
                                background: "rgba(14,165,233,0.12)",
                                color: "#38bdf8",
                                border: "1px solid rgba(14,165,233,0.25)",
                              }}
                              title="一键创作"
                            >
                              <Zap size={12} />
                              一键创作
                            </button>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCloneCreate(task); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                              style={{
                                background: "rgba(139,92,246,0.12)",
                                color: "#a78bfa",
                                border: "1px solid rgba(139,92,246,0.25)",
                              }}
                              title="一键创作"
                            >
                              <Wand2 size={12} />
                              一键创作
                            </button>
                          )}

                          {/* 查看详情 */}
                          <button
                            onClick={(e) => { e.stopPropagation(); router.push(`/tasks/${task.id}`); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                            style={{
                              background: "rgba(96,165,250,0.1)",
                              color: "#60a5fa",
                              border: "1px solid rgba(96,165,250,0.25)",
                            }}
                          >
                            <Eye size={12} />
                            查看详情
                          </button>

                          {/* 重试（仅失败时） */}
                          {task.status === "failed" && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRetry(task.id); }}
                                disabled={retryingId === task.id}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                                style={{
                                  background: "rgba(251,146,60,0.12)",
                                  color: "#fb923c",
                                  border: "1px solid rgba(251,146,60,0.3)",
                                  cursor: retryingId === task.id ? "wait" : "pointer",
                                  opacity: retryingId === task.id ? 0.6 : 1,
                                }}
                              >
                                <RotateCcw size={12} />
                                {retryingId === task.id ? "重试中" : "重试"}
                              </button>
                              {canSafetyRewriteRetry(task) && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRetry(task.id, "safety_rewrite"); }}
                                  disabled={retryingId === task.id}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                                  style={{
                                    background: "rgba(14,165,233,0.12)",
                                    color: "#38bdf8",
                                    border: "1px solid rgba(14,165,233,0.3)",
                                    cursor: retryingId === task.id ? "wait" : "pointer",
                                    opacity: retryingId === task.id ? 0.6 : 1,
                                  }}
                                  title="先简化提示词，再重新执行一次"
                                >
                                  <Sparkles size={12} />
                                  {retryingId === task.id ? "处理中" : "安全简化后重试"}
                                </button>
                              )}
                            </>
                          )}

                          {/* 删除（仅管理员可见） */}
                          {user?.isAdmin && (isConfirming ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }}
                                disabled={isDeleting}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                                style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                              >
                                {isDeleting ? "删除中" : "确认"}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setConfirmId(null); }}
                                className="px-2 py-1.5 rounded-lg text-xs"
                                style={{ color: "var(--text-muted)" }}
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmId(task.id); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                              style={{
                                background: "rgba(239,68,68,0.08)",
                                color: "#f87171",
                                border: "1px solid rgba(239,68,68,0.2)",
                              }}
                            >
                              <Trash2 size={12} />
                              删除
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 进度条（进行中 / 重试中） */}
                      {(task.status === "running" || task.status === "pending" || task.status === "retrying") && (
                        <div className="mt-2 w-full rounded-full h-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div
                            className="h-1 rounded-full transition-all duration-500"
                            style={{
                              width: `${task.progress}%`,
                              background: task.status === "retrying"
                                ? "linear-gradient(90deg, #fb923c, #f97316)"
                                : "linear-gradient(90deg, #7c3aed, #a855f7)",
                            }}
                          />
                        </div>
                      )}

                      {/* 失败原因 */}
                      {task.status === "failed" && task.error_message && (
                        <div className="mt-2 space-y-2">
                          <p className="text-xs leading-relaxed" style={{ color: "#f87171" }}>
                            {formatError(task.error_message)}
                          </p>
                          {canSafetyRewriteRetry(task) && (
                            <div
                              className="flex items-start gap-2 rounded-xl px-3 py-2"
                              style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.18)" }}
                            >
                              <AlertCircle size={13} style={{ color: "#38bdf8", marginTop: 1, flexShrink: 0 }} />
                              <p className="text-xs leading-relaxed" style={{ color: "#7dd3fc" }}>
                                这是内容安全拦截。系统不会自动改写并重试；如需继续，可手动点击“安全简化后重试”。
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                          {outputFiles.length > 0 && (
                            <div className="flex gap-2 mt-3 flex-wrap">
                              {outputFiles.map((f, i) => (
                                <div
                                  key={i}
                                  className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 cursor-zoom-in relative group"
                                  style={{ border: "1px solid var(--border)" }}
                                >
                                  <img
                                    src={outputToUrl(f)}
                                    alt={`结果${i + 1}`}
                                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                                    onClick={(e) => { e.stopPropagation(); setLightbox(outputToUrl(f)); }}
                                  />
                                  {task.skill_id === "gptimage2" && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setFeaturedTarget({ url: outputToUrl(f), prompt: getInputParam(task, "prompt"), refImage: imagePath ? refImageUrl(imagePath) : (imageUrlParam || undefined) }); }}
                                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                      style={{ background: "rgba(0,0,0,0.55)" }}
                                      title="精选到灵感广场"
                                    >
                                      <Star size={14} style={{ color: "#fbbf24" }} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          </div>

          {/* 分页控件 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2 pb-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: "var(--bg-card)",
                  color: page === 1 ? "var(--text-muted)" : "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  cursor: page === 1 ? "not-allowed" : "pointer",
                  opacity: page === 1 ? 0.5 : 1,
                }}
              >
                上一页
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                if (totalPages <= 7 || p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className="w-8 h-8 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: p === page ? "rgba(139,92,246,0.25)" : "var(--bg-card)",
                        color: p === page ? "#c084fc" : "var(--text-secondary)",
                        border: `1px solid ${p === page ? "rgba(139,92,246,0.5)" : "var(--border)"}`,
                        boxShadow: p === page ? "0 0 10px rgba(139,92,246,0.25)" : "none",
                      }}
                    >
                      {p}
                    </button>
                  );
                }
                if (Math.abs(p - page) === 2) {
                  return <span key={p} className="text-xs" style={{ color: "var(--text-muted)" }}>…</span>;
                }
                return null;
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: "var(--bg-card)",
                  color: page === totalPages ? "var(--text-muted)" : "var(--text-secondary)",
                  border: "1px solid var(--border)",
                  cursor: page === totalPages ? "not-allowed" : "pointer",
                  opacity: page === totalPages ? 0.5 : 1,
                }}
              >
                下一页
              </button>

              <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>
                {page} / {totalPages} 页 · {displayedTasks.length} 条记录
              </span>
            </div>
          )}
        </>
      )}
    </div>

    {lightbox && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-6"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}
        onClick={() => setLightbox(null)}
      >
        <button
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}
          onClick={() => setLightbox(null)}
        >
          <X size={18} />
        </button>
        <img
          src={lightbox}
          alt="查看大图"
          className="rounded-2xl object-contain shadow-2xl"
          style={{ maxWidth: "min(90vw, 1200px)", maxHeight: "88vh" }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    )}

    {featuredTarget && (
      <FeaturedModal
        imageUrl={featuredTarget.url}
        prompt={featuredTarget.prompt}
        refImageUrl={featuredTarget.refImage}
        onClose={() => setFeaturedTarget(null)}
      />
    )}
    </>
  );
}
