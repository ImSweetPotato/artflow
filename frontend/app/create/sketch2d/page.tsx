"use client";

import { useState, useCallback, useEffect } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Sparkles, X, ImageIcon, Shuffle,
  Download, ZoomIn, AlertCircle, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { uploadFile, createTask, getTask } from "@/lib/api";
import { formatError } from "@/lib/format-error";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEFAULT_MAIN_PROMPT =
  "参考图包含角色正面与背面及道具信息。\n纯白背景，单角色单视角2D立绘，保持外形、比例与道具一致。\n卡通动漫描边（外轮廓略粗，内部线细），干净上色。\n全身完整入镜，四周留白。";

type RunPhase = "idle" | "submitting" | "running" | "done" | "error";

function outputUrl(p: string) {
  const rel = p.replace(/\\/g, "/").split("outputs/").pop();
  return `${API_BASE}/outputs/${rel}`;
}
function dlUrl(p: string) {
  const rel = p.replace(/\\/g, "/").split("outputs/").pop() ?? "";
  return `${API_BASE}/api/download?path=${encodeURIComponent(rel)}`;
}
function fname(p: string) {
  return p.replace(/\\/g, "/").split("/").pop() ?? "image.png";
}

const BACKENDS: { id: "seedream" | "gemini" | "gpt-image-2"; label: string; sub: string }[] = [
  { id: "seedream", label: "Seedream", sub: "火山引擎" },
  { id: "gemini", label: "Gemini", sub: "Sofunny" },
  { id: "gpt-image-2", label: "GPT-Image-2", sub: "Sofunny" },
];

export default function Sketch2DPageWrapper() {
  return (
    <Suspense>
      <Sketch2DPage />
    </Suspense>
  );
}

function Sketch2DPage() {
  const searchParams = useSearchParams();
  const fromTaskId = searchParams.get("from");

  // Config
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [clonedImagePath, setClonedImagePath] = useState<string | null>(null);
  const [taskName, setTaskName] = useState("");
  const [actionsCount, setActionsCount] = useState(4);
  const [imageBackend, setImageBackend] = useState<"seedream" | "gemini" | "gpt-image-2">("seedream");
  const [mainPrompt] = useState(DEFAULT_MAIN_PROMPT);
  const [dragging, setDragging] = useState(false);
  const [cloneLoading, setCloneLoading] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  // Task state
  const [runPhase, setRunPhase] = useState<RunPhase>("idle");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [outputFiles, setOutputFiles] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  function randomTaskName() {
    const pool = [
      "疾风斩", "雷霆击", "烈焰拳", "冰刃旋", "破空踢",
      "幻影步", "铁壁挡", "龙吟斩", "暗影突", "苍穹跃",
    ];
    const now = new Date();
    const ts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
    ].join("");
    setTaskName(`${pool[Math.floor(Math.random() * pool.length)]}_${ts}`);
  }

  // Clone from history
  useEffect(() => {
    if (!fromTaskId) { randomTaskName(); return; }
    setCloneLoading(true);
    getTask(fromTaskId)
      .then((task) => {
        const p = task.input_params as Record<string, unknown>;
        const origName = String(p.task_name ?? "");
        const prefix = origName.replace(/_\d{12}$/, "");
        const now = new Date();
        const ts = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0"), String(now.getHours()).padStart(2, "0"), String(now.getMinutes()).padStart(2, "0")].join("");
        setTaskName(`${prefix}_${ts}`);
        if (p.actions_count) setActionsCount(Number(p.actions_count));
        if (p.image_backend) setImageBackend(String(p.image_backend) as "seedream" | "gemini" | "gpt-image-2");
        if (p.image_path) {
          const imgPath = String(p.image_path);
          setClonedImagePath(imgPath);
          setPreview(`${API_BASE}/uploads/${imgPath.replace(/\\/g, "/").split("/").pop() ?? ""}`);
        }
      })
      .catch(() => randomTaskName())
      .finally(() => setCloneLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromTaskId]);

  // Polling
  useEffect(() => {
    if (!taskId || runPhase !== "running") return;
    const poll = async () => {
      try {
        const t = await getTask(taskId);
        setProgress(t.progress ?? 0);
        if (t.status === "succeeded") {
          setOutputFiles((t.output as { output_files?: string[] })?.output_files ?? []);
          setRunPhase("done");
        } else if (t.status === "failed") {
          setError(formatError(t.error_message, "生成失败，请重试"));
          setRunPhase("error");
        }
      } catch {}
    };
    poll();
    const timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, [taskId, runPhase]);

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setClonedImagePath(null);
  };

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setRunPhase("submitting");
    setError("");
    setOutputFiles([]);
    setProgress(0);
    try {
      const imagePath = file ? (await uploadFile(file)).path : clonedImagePath!;
      const { task_id } = await createTask("sketch2portrait", {
        image_path: imagePath,
        task_name: taskName.trim(),
        actions_count: actionsCount,
        main_prompt: mainPrompt.trim() || undefined,
        image_backend: imageBackend,
      });
      setTaskId(task_id);
      setRunPhase("running");
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败，请重试");
      setRunPhase("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, clonedImagePath, taskName, actionsCount, mainPrompt, imageBackend]);

  const isLocked = runPhase === "running" || runPhase === "submitting";
  const canSubmit = (!!file || !!clonedImagePath) && !!taskName.trim() && actionsCount >= 1 && !isLocked;

  return (
    // Escape main's p-8, fill full viewport height
    <div style={{ margin: "-2rem", height: "calc(100% + 4rem)" }} className="flex overflow-hidden">

      {/* ── LEFT SETTINGS PANEL ──────────────────────────────────── */}
      <div
        className="flex flex-col flex-shrink-0 overflow-hidden"
        style={{ width: 440, borderRight: "1px solid var(--border)", background: "rgba(255,255,255,0.015)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-7 py-6 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 16px rgba(139,92,246,0.4)" }}
          >
            <ImageIcon size={16} color="#fff" />
          </div>
          <div>
            <h1 className="text-base font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-rajdhani),sans-serif" }}>
              原画转2D
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>AI 批量生成动作插画</p>
          </div>
        </div>

        {/* Scrollable settings body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">

            {/* Clone hint */}
            {fromTaskId && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", color: "#a78bfa" }}
              >
                <Sparkles size={11} />
                {cloneLoading ? "正在读取历史参数..." : "已从历史记录预填参数，可直接修改"}
              </div>
            )}

            {/* Upload zone */}
            <div>
              <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>参考图</p>
              <div
                className={`rounded-2xl cursor-pointer transition-all ${dragging ? "ring-2 ring-purple-500" : ""}`}
                style={{
                  minHeight: 180,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "rgba(255,255,255,0.02)",
                  border: "1.5px dashed var(--border)",
                  position: "relative",
                  opacity: isLocked ? 0.6 : 1,
                  pointerEvents: isLocked ? "none" : "auto",
                }}
                onClick={() => !preview && document.getElementById("s2d-file")?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              >
                {preview ? (
                  <div className="relative w-full p-3">
                    <img src={preview} alt="预览" className="w-full max-h-44 rounded-xl object-contain mx-auto" />
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); setClonedImagePath(null); }}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="text-center p-8">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                      style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}
                    >
                      <Upload size={20} style={{ color: "var(--accent)" }} />
                    </div>
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>拖拽或点击上传</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>JPG · PNG · WEBP · 最大 20MB</p>
                  </div>
                )}
                <input
                  id="s2d-file" type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "var(--border)" }} />

            {/* Task name */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                任务名称
                <span className="normal-case tracking-normal px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>必填</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text" value={taskName} onChange={(e) => setTaskName(e.target.value)}
                  disabled={isLocked} placeholder="战士角色动作组"
                  className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                />
                <button
                  onClick={randomTaskName} disabled={isLocked} title="随机名称"
                  className="w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", color: "#a78bfa" }}
                >
                  <Shuffle size={14} />
                </button>
              </div>
            </div>

            {/* Actions count */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>动作组数</label>
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-lg"
                  style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}
                >
                  {actionsCount} 组
                </span>
              </div>
              <input
                type="range" min={1} max={10} value={actionsCount}
                disabled={isLocked}
                onChange={(e) => setActionsCount(Number(e.target.value))}
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                <span>1 组</span><span>10 组</span>
              </div>
            </div>

            {/* Model picker */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>生图引擎</label>
              <div className="grid grid-cols-3 gap-1.5">
                {BACKENDS.map((b) => {
                  const active = imageBackend === b.id;
                  return (
                    <button
                      key={b.id} onClick={() => setImageBackend(b.id)} disabled={isLocked}
                      className="py-2.5 px-1 rounded-xl text-center transition-all"
                      style={{
                        background: active ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.03)",
                        border: active ? "1.5px solid rgba(139,92,246,0.5)" : "1px solid var(--border)",
                        boxShadow: active ? "0 0 0 1px rgba(139,92,246,0.15)" : "none",
                      }}
                    >
                      <p className="text-xs font-bold" style={{ color: active ? "#c4b5fd" : "var(--text-primary)" }}>{b.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: active ? "#a78bfa" : "var(--text-muted)", opacity: 0.9 }}>{b.sub}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Prompt (collapsible) */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1.25rem" }}>
              <button
                onClick={() => setPromptOpen((o) => !o)}
                className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wide mb-2 transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                <span>主提示词</span>
                {promptOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
              <AnimatePresence>
                {promptOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <pre
                      className="w-full rounded-xl px-3 py-3 text-xs whitespace-pre-wrap"
                      style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "inherit", lineHeight: 1.7 }}
                    >
                      {mainPrompt}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex-shrink-0 p-6 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
          {error && (
            <div
              className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}
            >
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <button
            onClick={handleSubmit} disabled={!canSubmit}
            className="btn-glow w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white"
          >
            {isLocked ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Sparkles size={15} />
                </motion.div>
                AI 生成中...
              </>
            ) : (
              <><Sparkles size={15} />开始生成</>
            )}
          </button>
          {(runPhase === "done" || runPhase === "error") && (
            <button
              onClick={() => { setRunPhase("idle"); setOutputFiles([]); setTaskId(null); setError(""); setProgress(0); }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs transition-colors"
              style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
            >
              <RefreshCw size={12} />重新配置
            </button>
          )}
        </div>
      </div>

      {/* ── RIGHT OUTPUT PANEL ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>

        {/* IDLE */}
        {runPhase === "idle" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-12 select-none">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center"
              style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.12)" }}
            >
              <ImageIcon size={40} style={{ color: "rgba(139,92,246,0.3)" }} />
            </div>
            <div className="text-center max-w-xs">
              <p className="text-base font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>
                配置参数，开始创作
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                在左侧上传角色原画，设置动作组数和生图引擎，点击「开始生成」即可批量生成高质量 2D 动作插画
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              {["上传参考图", "配置参数", "开始生成"].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}
                  >
                    {i + 1}
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{step}</span>
                  {i < 2 && <div className="w-6 h-px" style={{ background: "var(--border)" }} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUBMITTING / RUNNING */}
        {(runPhase === "submitting" || runPhase === "running") && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Progress header */}
            <div className="flex-shrink-0 px-8 pt-8 pb-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>AI 正在生成角色动作插画</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {runPhase === "submitting" ? "正在提交任务..." : `已完成 ${progress}%，预计 1–3 分钟`}
                  </p>
                </div>
                <span
                  className="text-sm font-bold px-3 py-1 rounded-xl"
                  style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}
                >
                  {runPhase === "submitting" ? "提交中" : `${progress}%`}
                </span>
              </div>
              <div className="w-full rounded-full h-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                <motion.div
                  className="h-1 rounded-full"
                  style={{ background: "linear-gradient(90deg,#7c3aed,#a855f7,#ec4899)" }}
                  animate={{ width: runPhase === "submitting" ? "5%" : `${progress}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            </div>
            {/* Skeleton grid */}
            <div className="flex-1 overflow-y-auto px-8 pb-8">
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                {Array.from({ length: actionsCount }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="rounded-2xl"
                    style={{ aspectRatio: "1/1", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.12 }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ERROR */}
        {runPhase === "error" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 p-12">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <AlertCircle size={36} color="#f87171" />
            </div>
            <div className="text-center max-w-sm">
              <p className="text-base font-semibold mb-2" style={{ color: "#f87171" }}>生成失败</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{error}</p>
            </div>
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}
            >
              <RefreshCw size={14} />重新生成
            </button>
          </div>
        )}

        {/* DONE */}
        {runPhase === "done" && outputFiles.length > 0 && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Output header */}
            <div
              className="flex-shrink-0 flex items-center justify-between px-8 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  已生成 {outputFiles.length} 张角色动作插画
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  悬停图片可放大预览或下载
                </p>
              </div>
              <button
                onClick={() => outputFiles.forEach((f, i) => setTimeout(() => {
                  const a = document.createElement("a"); a.href = dlUrl(f); a.download = fname(f);
                  document.body.appendChild(a); a.click(); document.body.removeChild(a);
                }, i * 500))}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.3)", color: "#a78bfa" }}
              >
                <Download size={13} />全部下载
              </button>
            </div>
            {/* Image grid */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                {outputFiles.map((f, i) => {
                  const url = outputUrl(f);
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.06, duration: 0.3 }}
                      className="relative rounded-2xl overflow-hidden group cursor-pointer"
                      style={{ aspectRatio: "1/1", border: "1px solid var(--border)" }}
                    >
                      <img
                        src={url} alt={`结果 ${i + 1}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {/* Hover overlay */}
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
                      >
                        <button
                          onClick={() => setLightbox(url)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:scale-105"
                          style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}
                        >
                          <ZoomIn size={13} />放大查看
                        </button>
                        <a
                          href={dlUrl(f)} download={fname(f)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:scale-105"
                          style={{ background: "rgba(139,92,246,0.4)", border: "1px solid rgba(139,92,246,0.5)" }}
                        >
                          <Download size={13} />下载
                        </a>
                      </div>
                      {/* Index badge */}
                      <div
                        className="absolute top-2 left-2 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.7)" }}
                      >
                        {i + 1}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(16px)" }}
            onClick={() => setLightbox(null)}
          >
            <button
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full transition-colors"
              style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}
              onClick={() => setLightbox(null)}
            >
              <X size={18} />
            </button>
            <img
              src={lightbox} alt="大图预览"
              className="rounded-2xl object-contain shadow-2xl"
              style={{ maxWidth: "min(90vw,1400px)", maxHeight: "90vh" }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
