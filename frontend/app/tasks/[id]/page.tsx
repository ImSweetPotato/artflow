"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getTask, getTaskLogs, retryTask, Task, TaskLog } from "@/lib/api";
import { ArrowLeft, ImageIcon, Layers, FileText, RotateCcw, Download, PackageOpen, X, Clock, Star, AlertCircle, Sparkles } from "lucide-react";
import FeaturedModal from "@/components/FeaturedModal";
import PromptDisplay from "@/components/PromptDisplay";
import { formatError } from "@/lib/format-error";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STATUS_CONFIG: Record<string, { dot: string; label: string; bg: string; color: string; bar: string }> = {
  pending:   { dot: "bg-yellow-400", label: "等待中", bg: "rgba(251,191,36,0.1)",  color: "#fbbf24", bar: "linear-gradient(90deg,#fbbf24,#f59e0b)" },
  running:   { dot: "bg-blue-400",   label: "运行中", bg: "rgba(96,165,250,0.1)",  color: "#60a5fa", bar: "linear-gradient(90deg,#60a5fa,#3b82f6)" },
  retrying:  { dot: "bg-orange-400", label: "重试中", bg: "rgba(251,146,60,0.1)",  color: "#fb923c", bar: "linear-gradient(90deg,#fb923c,#f97316)" },
  succeeded: { dot: "bg-green-400",  label: "已完成", bg: "rgba(52,211,153,0.1)",  color: "#34d399", bar: "linear-gradient(90deg,#34d399,#10b981)" },
  failed:    { dot: "bg-red-400",    label: "已失败", bg: "rgba(239,68,68,0.1)",   color: "#f87171", bar: "linear-gradient(90deg,#f87171,#ef4444)" },
};

function getInputParam(task: Task, key: string): string {
  const p = task.input_params as Record<string, unknown>;
  return p?.[key] != null ? String(p[key]) : "";
}

/** 任务的所有参考图路径（兼容 image_path 单字段和 image_paths 数组） */
function getAllRefPaths(task: Task): string[] {
  const p = task.input_params as Record<string, unknown>;
  const arr = p?.image_paths;
  if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === "string");
  if (typeof p?.image_path === "string" && p.image_path) return [p.image_path];
  return [];
}

function outputToUrl(filePath: string): string {
  const rel = filePath.replace(/\\/g, "/").split("outputs/").pop();
  return `${API_BASE}/outputs/${rel}`;
}

/** 通过后端 /api/download 接口下载，返回 Content-Disposition: attachment */
function downloadApiUrl(filePath: string): string {
  const rel = filePath.replace(/\\/g, "/").split("outputs/").pop() ?? "";
  return `${API_BASE}/api/download?path=${encodeURIComponent(rel)}`;
}

function getFilename(filePath: string): string {
  return filePath.replace(/\\/g, "/").split("/").pop() ?? "image.png";
}

function refImageUrl(imagePath: string): string {
  const name = imagePath.replace(/\\/g, "/").split("/").pop() ?? "";
  return `${API_BASE}/uploads/${name}`;
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

function parseApiDate(iso: string): Date {
  return new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
}

function formatDate(iso: string) {
  const d = parseApiDate(iso);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}小时 ${minutes}分 ${seconds}秒`;
  if (minutes > 0) return `${minutes}分 ${seconds}秒`;
  return `${seconds}秒`;
}

function batchDownload(files: string[]) {
  files.forEach((filePath, i) => {
    setTimeout(() => {
      const a = document.createElement("a");
      a.href = downloadApiUrl(filePath);
      a.download = getFilename(filePath);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, i * 600);
  });
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [retrying, setRetrying] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [featuredTarget, setFeaturedTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = () => {
      getTask(id).then(setTask);
      getTaskLogs(id).then(setLogs);
    };
    load();
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [id]);

  const handleRetry = async (mode: "normal" | "safety_rewrite" = "normal") => {
    if (!id) return;
    setRetrying(true);
    await retryTask(id, mode);
    setRetrying(false);
  };

  if (!task) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" style={{ color: "var(--text-muted)" }}>
        加载中...
      </div>
    );
  }

  const sc = STATUS_CONFIG[task.status] ?? {
    dot: "bg-gray-400", label: task.status,
    bg: "rgba(255,255,255,0.05)", color: "var(--text-muted)", bar: "var(--border)",
  };
  const outputFiles: string[] = (task.output as { output_files?: string[] })?.output_files ?? [];
  const taskName    = getInputParam(task, "task_name") || task.skill_id;
  const refPaths    = getAllRefPaths(task);
  const firstRef    = refPaths[0] ?? "";

  // skill-specific params
  const isGptImage2  = task.skill_id === "gptimage2";
  const isComfyUiPetTraveler = task.skill_id === "comfyui_pet_traveler";
  const actionsCount = getInputParam(task, "actions_count");
  const mainPrompt   = getInputParam(task, "main_prompt");
  const prompt       = getInputParam(task, "prompt");
  const aspectRatio  = getInputParam(task, "aspect_ratio");
  const outputCount  = getInputParam(task, "output_count");
  const scheduledAt  = getInputParam(task, "scheduled_at");
  const scheduledMaxRetries = getInputParam(task, "scheduled_max_retries");
  const createdAtDate = parseApiDate(task.created_at);
  const updatedAtDate = parseApiDate(task.updated_at);
  const durationEnd = (task.status === "running" || task.status === "pending" || task.status === "retrying")
    ? new Date()
    : updatedAtDate;
  const totalDuration = formatDurationMs(durationEnd.getTime() - createdAtDate.getTime());

  return (
    <>
    <div className="max-w-3xl space-y-3">

      {/* 返回 */}
      <button
        onClick={() => router.push("/tasks")}
        className="flex items-center gap-1.5 text-sm mb-1 transition-opacity hover:opacity-70"
        style={{ color: "var(--text-muted)" }}
      >
        <ArrowLeft size={14} />返回列表
      </button>

      {/* ── 主信息卡片 ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        {/* 顶部状态色条 */}
        <div className="h-0.5" style={{ background: sc.bar }} />

        <div className="p-5 space-y-4">
          {/* 标题行 */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate" style={{ fontFamily: "var(--font-rajdhani), sans-serif", color: "var(--text-primary)" }}>
                {taskName}
              </h1>
              <p className="text-xs font-mono mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{task.id}</p>
            </div>
            <span
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0"
              style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}40` }}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
              {sc.label}
            </span>
          </div>

          {/* 时间 */}
          <div className="flex gap-5 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>创建 {formatDate(task.created_at)}</span>
            <span>更新 {formatDate(task.updated_at)}</span>
            <span>总耗时 {totalDuration}</span>
          </div>

          {/* 使用者追溯（仅管理员可见） */}
          {user?.isAdmin && (task.created_by_nickname || task.created_by_ip) && (
            <div
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs"
              style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}
            >
              <span className="font-semibold" style={{ color: "#818cf8" }}>使用者追溯</span>
              {task.created_by_nickname && (
                <span style={{ color: "var(--text-secondary)" }}>
                  👤 {task.created_by_nickname}
                </span>
              )}
              {task.created_by_ip && (
                <span style={{ color: "var(--text-secondary)" }} className="font-mono">
                  🌐 {task.created_by_ip}
                </span>
              )}
            </div>
          )}

          {/* 进度条 */}
          {(task.status === "running" || task.status === "pending" || task.status === "retrying") && (
            <div>
              <div className="flex justify-between text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>
                <span>进度</span><span>{task.progress}%</span>
              </div>
              <div className="w-full rounded-full h-1.5" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${task.progress}%`, background: "linear-gradient(90deg,#7c3aed,#a855f7)" }} />
              </div>
            </div>
          )}

          {/* 失败信息 */}
          {task.status === "failed" && (
            <div className="rounded-xl p-3 flex items-start gap-3"
              style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div className="flex-1 space-y-2">
                <p className="text-xs leading-relaxed" style={{ color: "#f87171" }}>{formatError(task.error_message)}</p>
                {canSafetyRewriteRetry(task) && (
                  <div
                    className="flex items-start gap-2 rounded-xl px-3 py-2"
                    style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.18)" }}
                  >
                    <AlertCircle size={13} style={{ color: "#38bdf8", marginTop: 1, flexShrink: 0 }} />
                    <p className="text-xs leading-relaxed" style={{ color: "#7dd3fc" }}>
                      这是内容安全拦截。系统不会自动改写并重试；如需继续，可手动触发“安全简化后重试”。
                    </p>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => handleRetry()} disabled={retrying}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}
                >
                  <RotateCcw size={11} />{retrying ? "重试中" : "重新执行"}
                </button>
                {canSafetyRewriteRetry(task) && (
                  <button
                    onClick={() => handleRetry("safety_rewrite")} disabled={retrying}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                    style={{ background: "rgba(14,165,233,0.12)", color: "#38bdf8", border: "1px solid rgba(14,165,233,0.3)" }}
                  >
                    <Sparkles size={11} />{retrying ? "处理中" : "安全简化后重试"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 输入参数 ── */}
      <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--text-muted)" }}>输入参数</p>
        <div className="flex gap-4">
          {/* 参考图（支持多张） */}
          <div className="flex-shrink-0">
            {refPaths.length === 0 ? (
              <div className="w-[88px] h-[88px] rounded-xl flex flex-col items-center justify-center gap-1"
                style={{ background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.18)" }}>
                <ImageIcon size={22} style={{ color: "rgba(14,165,233,0.55)" }} />
                <span className="text-xs" style={{ color: "var(--text-muted)", fontSize: 10 }}>文生图</span>
              </div>
            ) : (
              <div className={`grid ${refPaths.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-1.5`} style={{ width: refPaths.length > 1 ? 184 : 88 }}>
                {refPaths.slice(0, 4).map((p, i) => (
                  <div
                    key={i}
                    className="relative rounded-xl overflow-hidden cursor-zoom-in"
                    style={{ width: 88, height: 88, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
                    onClick={() => setLightbox(refImageUrl(p))}
                  >
                    <img src={refImageUrl(p)} alt={`参考图 ${i + 1}`}
                      className="w-full h-full object-cover hover:opacity-80 transition-opacity"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    {refPaths.length > 4 && i === 3 && (
                      <div
                        className="absolute inset-0 flex items-center justify-center text-sm font-bold"
                        style={{ background: "rgba(0,0,0,0.65)", color: "#fff" }}
                      >
                        +{refPaths.length - 3}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs mt-1.5 text-center" style={{ color: "var(--text-muted)" }}>
              {refPaths.length === 0 ? "参考图" : `参考图 ×${refPaths.length}`}
            </p>
          </div>

          {/* 参数 — 按 skill_id 分支 */}
          <div className="flex-1 space-y-2.5">
            {isGptImage2 ? (
              <>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>任务名称</p>
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{taskName}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>画面比例</p>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{aspectRatio || "1:1"}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>生成数量</p>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{outputCount || "1"} 张</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>模型</p>
                    <p className="text-sm font-semibold" style={{ color: "#38bdf8" }}>GPT-Image-2</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>重试次数</p>
                    <p className="text-sm font-semibold" style={{ color: task.retry_count > 0 ? "#fb923c" : "var(--text-primary)" }}>
                      {task.retry_count}
                    </p>
                  </div>
                </div>
                {prompt && <PromptDisplay prompt={prompt} label="提示词" />}
                {scheduledAt && (
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl p-3" style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)" }}>
                      <p className="text-xs mb-1 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                        <Clock size={10} />定时时间
                      </p>
                      <p className="text-sm font-semibold" style={{ color: "#a78bfa" }}>
                        {(() => {
                          const [date, time] = scheduledAt.split("T");
                          return `${date.replace(/-/g, "/")} ${time.slice(0, 5)}`;
                        })()}
                      </p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)" }}>
                      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>最大重试次数</p>
                      <p className="text-sm font-semibold" style={{ color: "#a78bfa" }}>
                        {scheduledMaxRetries || "2"} 次
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : isComfyUiPetTraveler ? (
              <>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>工作流</p>
                    <p className="text-sm font-semibold" style={{ color: "#5eead4" }}>萌宠旅人</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>生成数量</p>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{outputCount || "1"} 张</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Seed</p>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{getInputParam(task, "seed") || "-1"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2.5">
                  {[
                    ["Steps", getInputParam(task, "steps") || "20"],
                    ["CFG", getInputParam(task, "cfg") || "1"],
                    ["Denoise", getInputParam(task, "denoise") || "1"],
                    ["Guidance", getInputParam(task, "guidance") || "2.5"],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Sampler / Scheduler</p>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {getInputParam(task, "sampler_name") || "euler"} / {getInputParam(task, "scheduler") || "simple"}
                    </p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>翻译方向</p>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {getInputParam(task, "from_translate") || "chinese (simplified)"} → {getInputParam(task, "to_translate") || "english"}
                    </p>
                  </div>
                </div>
                {prompt && <PromptDisplay prompt={prompt} label="提示词" />}
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>任务名称</p>
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{taskName}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <p className="text-xs mb-1 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                      <Layers size={10} />动作组数
                    </p>
                    <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {actionsCount ? `${actionsCount} 组` : "—"}
                    </p>
                  </div>
                </div>
                {mainPrompt && <PromptDisplay prompt={mainPrompt} label="主提示词" />}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 生成结果 ── */}
      {outputFiles.length > 0 && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>生成结果</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>共 {outputFiles.length} 张</p>
            </div>
            <button
              onClick={() => batchDownload(outputFiles)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)" }}
            >
              <PackageOpen size={12} />批量下载 ({outputFiles.length})
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {outputFiles.map((filePath, i) => {
              const previewUrl = outputToUrl(filePath);
              const dlUrl = downloadApiUrl(filePath);
              const fname = getFilename(filePath);
              return (
                <div key={i} className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid var(--border)" }}>
                  {/* 可点击放大的图片 */}
                  <div className="relative overflow-hidden cursor-zoom-in"
                    onClick={() => setLightbox(previewUrl)}>
                    <img src={previewUrl} alt={`结果 ${i + 1}`} className="w-full block hover:scale-105 transition-transform duration-300" />
                  </div>
                  {/* 文件名 + 下载按钮 */}
                  <div className="flex items-center gap-2 px-2.5 py-2"
                    style={{ borderTop: "1px solid var(--border)" }}>
                    <p className="text-xs truncate flex-1" style={{ color: "var(--text-muted)" }}>{fname}</p>
                    {isGptImage2 && (
                      <button
                        onClick={() => setFeaturedTarget(previewUrl)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0"
                        style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" }}
                      >
                        <Star size={10} />精选
                      </button>
                    )}
                    <a
                      href={dlUrl}
                      download={fname}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium flex-shrink-0"
                      style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.25)" }}
                    >
                      <Download size={11} />下载
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 执行日志 ── */}
      <div className="rounded-2xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>执行日志</p>
        <div className="font-mono text-xs rounded-xl p-3 max-h-60 overflow-y-auto space-y-0.5"
          style={{ background: "rgba(0,0,0,0.15)" }}>
          {logs.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>暂无日志</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex gap-2.5"
                style={{ color: log.level === "ERROR" ? "#f87171" : log.level === "WARN" ? "#fbbf24" : "var(--text-secondary)" }}>
                <span className="flex-shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {new Date(log.created_at).toLocaleTimeString()}
                </span>
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

    </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full transition-colors"
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
          imageUrl={featuredTarget}
          prompt={prompt}
          refImageUrl={firstRef ? refImageUrl(firstRef) : undefined}
          onClose={() => setFeaturedTarget(null)}
        />
      )}
    </>
  );
}
