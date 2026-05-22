"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Sparkles, X, ImageIcon,
  Download, ZoomIn, RefreshCw,
  Clock, Star, Plus, History, Brain, ChevronDown,
} from "lucide-react";
import { uploadFile, createTask, getTask } from "@/lib/api";
import FeaturedModal from "@/components/FeaturedModal";
import { formatError } from "@/lib/format-error";
import { usePreferences } from "@/hooks/usePreferences";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const MAX_REF_IMAGES = 9;

type RunPhase = "idle" | "submitting" | "running" | "done" | "error";
type Ratio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "";

// 画面比例配置：每个选项带 SVG 画框图标 + 数字 + 文字
// 不放 2K/4K 标签，避免误导（GPT-Image-2 native 最高 1.5K）
const RATIOS: { id: Ratio; label: string; sub: string; w: number; h: number }[] = [
  { id: "",     label: "自动",   sub: "auto",  w: 0,  h: 0  },  // 用虚线框表示
  { id: "1:1",  label: "1:1",    sub: "方形",  w: 16, h: 16 },
  { id: "3:4",  label: "3:4",    sub: "竖版",  w: 12, h: 16 },
  { id: "9:16", label: "9:16",   sub: "故事版", w: 9,  h: 16 },
  { id: "4:3",  label: "4:3",    sub: "横版",  w: 16, h: 12 },
  { id: "16:9", label: "16:9",   sub: "宽屏",  w: 16, h: 9  },
];

/**
 * 画面比例的画框图标 — 用 SVG 直观展示真实比例。
 * 「16:9 vs 9:16 分不清」的根本解决方案。
 */
function AspectIcon({ w, h, color, isAuto }: { w: number; h: number; color: string; isAuto?: boolean }) {
  const BOX = 22;       // 容器尺寸
  const MAX = 18;       // 矩形最大边长
  if (isAuto) {
    return (
      <svg width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`}>
        <rect
          x={2} y={2} width={BOX - 4} height={BOX - 4} rx={2}
          fill="none" stroke={color} strokeWidth={1.5}
          strokeDasharray="2.5 2"
        />
        <text
          x={BOX / 2} y={BOX / 2 + 3.5}
          fontSize={9}
          fill={color}
          textAnchor="middle"
          fontWeight="600"
          fontFamily="ui-monospace, monospace"
        >
          A
        </text>
      </svg>
    );
  }
  // 按比例缩放，长边 = MAX
  const scale = MAX / Math.max(w, h);
  const rw = w * scale;
  const rh = h * scale;
  const x = (BOX - rw) / 2;
  const y = (BOX - rh) / 2;
  return (
    <svg width={BOX} height={BOX} viewBox={`0 0 ${BOX} ${BOX}`}>
      <rect x={x} y={y} width={rw} height={rh} rx={1.5}
        fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}

// ── 历史记录条目类型 ─────────────────────────────────────────────────────────

interface ThinkingMeta {
  model: string;
  duration_ms: number;
  thinking_content: string;
  original_prompt: string;
  optimized_prompt: string;
  reasoning_effort: string;
}

interface HistoryEntry {
  id: string;           // task_id
  prompt: string;
  refPreviews: string[]; // 参考图预览 URL（本地 objectURL 或上传后的 URL）
  outputFiles: string[]; // 输出文件路径
  aspectRatio: Ratio;
  createdAt: Date;
  phase: RunPhase;
  progress: number;
  error: string;
  enableThinking: boolean;
  thinking: ThinkingMeta | null;
}

// ── 工具函数 ─────────────────────────────────────────────────────────────────

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
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── 小组件 ───────────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative flex-shrink-0"
      style={{ width: 36, height: 20 }}
    >
      <div
        className="absolute inset-0 rounded-full transition-colors duration-200"
        style={{ background: checked ? "rgba(139,92,246,0.6)" : "rgba(255,255,255,0.1)", border: `1px solid ${checked ? "rgba(139,92,246,0.8)" : "var(--border)"}` }}
      />
      <div
        className="absolute top-0.5 rounded-full transition-all duration-200"
        style={{ width: 16, height: 16, left: checked ? 18 : 2, background: checked ? "#a78bfa" : "var(--text-muted)" }}
      />
    </button>
  );
}

// ── 参考图网格 ───────────────────────────────────────────────────────────────

interface RefImageGridProps {
  previews: string[];
  onAdd: (files: FileList) => void;
  onRemove: (index: number) => void;
  disabled: boolean;
  dragging: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

function RefImageGrid({ previews, onAdd, onRemove, disabled, dragging, onDragOver, onDragLeave, onDrop }: RefImageGridProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canAdd = previews.length < MAX_REF_IMAGES && !disabled;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          参考图
          <span className="normal-case tracking-normal ml-1" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
            可选，最多 {MAX_REF_IMAGES} 张
          </span>
        </p>
        {previews.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(14,165,233,0.12)", color: "#38bdf8" }}>
            {previews.length} / {MAX_REF_IMAGES}
          </span>
        )}
      </div>

      {previews.length === 0 ? (
        /* 空状态：大拖拽区 */
        <div
          className={`rounded-2xl cursor-pointer transition-all ${dragging ? "ring-2 ring-sky-500" : ""}`}
          style={{
            minHeight: 120,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.02)",
            border: "1.5px dashed var(--border)",
            opacity: disabled ? 0.6 : 1,
            pointerEvents: disabled ? "none" : "auto",
          }}
          onClick={() => fileRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className="text-center p-5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2"
              style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)" }}
            >
              <Upload size={16} style={{ color: "#0ea5e9" }} />
            </div>
            <p className="text-sm font-medium mb-0.5" style={{ color: "var(--text-primary)" }}>拖拽或点击上传</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>JPG · PNG · WEBP，最多 {MAX_REF_IMAGES} 张</p>
          </div>
        </div>
      ) : (
        /* 有图：网格 */
        <div
          className={`rounded-2xl p-2 transition-all ${dragging ? "ring-2 ring-sky-500" : ""}`}
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1.5px dashed var(--border)",
            opacity: disabled ? 0.6 : 1,
            pointerEvents: disabled ? "none" : "auto",
          }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className="grid grid-cols-3 gap-1.5">
            {previews.map((src, idx) => (
              <div key={idx} className="relative group rounded-xl overflow-hidden" style={{ aspectRatio: "1/1" }}>
                <img src={src} alt={`参考图 ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => onRemove(idx)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(0,0,0,0.75)", color: "#fff" }}
                >
                  <X size={10} />
                </button>
                <div
                  className="absolute bottom-1 left-1 px-1 py-0.5 rounded text-xs font-bold leading-none"
                  style={{ background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.7)", fontSize: 10 }}
                >
                  {idx + 1}
                </div>
              </div>
            ))}
            {canAdd && (
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-xl flex flex-col items-center justify-center gap-1 transition-all"
                style={{
                  aspectRatio: "1/1",
                  background: "rgba(14,165,233,0.05)",
                  border: "1.5px dashed rgba(14,165,233,0.3)",
                  color: "#38bdf8",
                }}
              >
                <Plus size={16} />
                <span style={{ fontSize: 10 }}>添加</span>
              </button>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files?.length) { onAdd(e.target.files); e.target.value = ""; } }}
      />
    </div>
  );
}

// ── 对话历史条目 ─────────────────────────────────────────────────────────────

function HistoryItem({
  entry,
  onSetLightbox,
  onSetFeatured,
  onUseAsRef,
}: {
  entry: HistoryEntry;
  onSetLightbox: (url: string) => void;
  onSetFeatured: (url: string) => void;
  onUseAsRef: (entry: HistoryEntry) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const isRunning = entry.phase === "running" || entry.phase === "submitting";
  const isDone = entry.phase === "done";
  const isError = entry.phase === "error";

  const imgAspect = entry.aspectRatio ? { aspectRatio: entry.aspectRatio.replace(":", "/") } : { aspectRatio: "1/1" };
  const thinkingDurSec = entry.thinking ? (entry.thinking.duration_ms / 1000).toFixed(1) : null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}
    >
      {/* 头部：prompt 摘要 + 状态 */}
      <div
        className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => isDone && setExpanded((v) => !v)}
        style={{ borderBottom: (isDone && expanded) ? "1px solid var(--border)" : "none" }}
      >
        {/* 参考图缩略图（最多显示 4 张 + 多余计数） */}
        {entry.refPreviews.length > 0 && (() => {
          const visible = entry.refPreviews.slice(0, 4);
          const overflow = entry.refPreviews.length - visible.length;
          // 容器宽度 = 第一张 32 + (可见张数-1) * 11 偏移 + 右侧 +N badge 预留
          const stackWidth = 32 + (visible.length - 1) * 11;
          return (
            <div className="flex-shrink-0 relative" style={{ width: stackWidth + (overflow > 0 ? 22 : 0), height: 32 }}>
              {visible.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`ref ${i + 1}`}
                  className="absolute rounded-lg object-cover"
                  style={{
                    width: 32, height: 32,
                    top: 0, left: i * 11,
                    border: "1.5px solid var(--bg-base)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                    zIndex: i,
                  }}
                />
              ))}
              {overflow > 0 && (
                <div
                  className="absolute rounded-lg flex items-center justify-center text-xs font-bold"
                  style={{
                    width: 32, height: 32,
                    top: 0, left: visible.length * 11,
                    background: "rgba(14,165,233,0.18)",
                    border: "1.5px solid var(--bg-base)",
                    color: "#7dd3fc",
                    fontSize: 11,
                    zIndex: visible.length,
                  }}
                >
                  +{overflow}
                </div>
              )}
            </div>
          );
        })()}

        <div className="flex-1 min-w-0">
          <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>
            {entry.prompt}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
              {entry.createdAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
            </span>
            {entry.aspectRatio && (
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                {entry.aspectRatio}
              </span>
            )}
          </div>
        </div>

        {/* 状态 badge */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {isRunning && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs" style={{ background: "rgba(14,165,233,0.12)", color: "#38bdf8" }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                <Sparkles size={11} />
              </motion.div>
              {entry.progress}%
            </div>
          )}
          {isDone && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: "rgba(52,211,153,0.1)", color: "#34d399" }}>
              ✓ {entry.outputFiles.length}张
            </div>
          )}
          {isError && (
            <div className="px-2 py-1 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
              失败
            </div>
          )}
          {isDone && (
            <div
              className="text-xs px-1 py-0.5 rounded transition-colors"
              style={{ color: "var(--text-muted)", transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
            >
              ▼
            </div>
          )}
        </div>
      </div>

      {/* 进度条（生成中） */}
      {isRunning && (
        <div className="px-4 pb-3 space-y-1.5">
          <div className="w-full rounded-full h-1" style={{ background: "rgba(255,255,255,0.06)" }}>
            <motion.div
              className="h-1 rounded-full"
              style={{ background: "linear-gradient(90deg,#0ea5e9,#38bdf8)" }}
              animate={{ width: entry.phase === "submitting" ? "5%" : `${entry.progress}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
          {entry.enableThinking && entry.progress > 0 && entry.progress < 10 && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: "#c4b5fd" }}>
              <Brain size={11} /> GPT-5 思考优化中...
            </p>
          )}
        </div>
      )}

      {/* Thought 徽章 + 展开内容 */}
      {entry.thinking && thinkingDurSec && (
        <div className="px-4 pb-3">
          <button
            onClick={(e) => { e.stopPropagation(); setThinkingExpanded((v) => !v); }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors"
            style={{
              background: thinkingExpanded ? "rgba(167,139,250,0.15)" : "rgba(167,139,250,0.08)",
              border: "1px solid rgba(167,139,250,0.25)",
              color: "#c4b5fd",
            }}
          >
            <Brain size={11} />
            <span>Thought for {thinkingDurSec}s</span>
            <ChevronDown
              size={11}
              style={{ transform: thinkingExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
            />
          </button>

          <AnimatePresence>
            {thinkingExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0, marginTop: 0 }}
                animate={{ height: "auto", opacity: 1, marginTop: 8 }}
                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div
                  className="rounded-xl p-3 space-y-3 text-xs"
                  style={{
                    background: "rgba(167,139,250,0.04)",
                    border: "1px solid rgba(167,139,250,0.15)",
                  }}
                >
                  {entry.thinking.thinking_content ? (
                    <div>
                      <p className="font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: "#c4b5fd" }}>
                        <Brain size={11} /> 思考过程 · {entry.thinking.model}
                      </p>
                      <p
                        className="whitespace-pre-wrap leading-relaxed"
                        style={{ color: "var(--text-secondary)", maxHeight: 280, overflowY: "auto" }}
                      >
                        {entry.thinking.thinking_content}
                      </p>
                    </div>
                  ) : (
                    <p className="italic" style={{ color: "var(--text-muted)" }}>
                      （思考过程未透传，仅记录耗时 · 模型 {entry.thinking.model}）
                    </p>
                  )}

                  <div style={{ height: 1, background: "rgba(167,139,250,0.15)" }} />

                  <div>
                    <p className="font-semibold mb-1" style={{ color: "var(--text-muted)" }}>原始输入</p>
                    <p className="leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {entry.thinking.original_prompt}
                    </p>
                  </div>

                  <div>
                    <p className="font-semibold mb-1 flex items-center gap-1.5" style={{ color: "#c4b5fd" }}>
                      <Sparkles size={11} /> 优化后的提示词（实际用于生图）
                    </p>
                    <p className="leading-relaxed" style={{ color: "var(--text-primary)" }}>
                      {entry.thinking.optimized_prompt}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 错误信息 */}
      {isError && (
        <div className="px-4 pb-3">
          <p className="text-xs" style={{ color: "#f87171" }}>{entry.error}</p>
        </div>
      )}

      {/* 展开：结果图网格 */}
      <AnimatePresence>
        {isDone && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* 完整参考图列表 */}
            {entry.refPreviews.length > 0 && (
              <div className="px-3 pt-3">
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
                  参考图 · {entry.refPreviews.length} 张
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {entry.refPreviews.map((src, i) => (
                    <div key={i} className="relative" style={{ width: 48, height: 48 }}>
                      <img
                        src={src}
                        alt={`ref ${i + 1}`}
                        className="w-full h-full rounded-lg object-cover cursor-pointer"
                        style={{ border: "1px solid var(--border)" }}
                        onClick={() => onSetLightbox(src)}
                      />
                      <div
                        className="absolute bottom-0.5 left-0.5 px-1 rounded text-xs font-bold leading-none"
                        style={{ background: "rgba(0,0,0,0.65)", color: "#fff", fontSize: 9 }}
                      >
                        {i + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 grid grid-cols-2 gap-2">
              {entry.outputFiles.map((f, i) => {
                const url = outputUrl(f);
                return (
                  <div
                    key={i}
                    className="relative rounded-xl overflow-hidden group cursor-pointer"
                    style={{ ...imgAspect, border: "1px solid var(--border)" }}
                  >
                    <img src={url} alt={`结果 ${i + 1}`} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" />
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "rgba(0,0,0,0.6)" }}
                    >
                      <button
                        onClick={() => onSetLightbox(url)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white"
                        style={{ background: "rgba(255,255,255,0.15)" }}
                      >
                        <ZoomIn size={11} />放大
                      </button>
                      <a
                        href={dlUrl(f)} download={fname(f)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white"
                        style={{ background: "rgba(14,165,233,0.4)" }}
                      >
                        <Download size={11} />下载
                      </a>
                      <button
                        onClick={() => onSetFeatured(url)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white"
                        style={{ background: "rgba(251,191,36,0.3)" }}
                      >
                        <Star size={11} />精选
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* 以此为参考 */}
            <div className="px-3 pb-3">
              <button
                onClick={() => onUseAsRef(entry)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all"
                style={{ background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.2)", color: "#38bdf8" }}
              >
                <RefreshCw size={12} />以此结果为参考图继续生成
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 主页面 ───────────────────────────────────────────────────────────────────

export default function GptImage2ClientPage() {
  const searchParams = useSearchParams();
  const fromTaskId = searchParams.get("from");
  const promptParam = searchParams.get("prompt");
  const refImageParam = searchParams.get("refImage");
  const { prefs } = usePreferences();

  // 参考图（多图）
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refPreviews, setRefPreviews] = useState<string[]>([]);
  // 克隆/灵感广场传入的已有服务端路径（非本次上传，直接作为 image_paths）
  const [clonedPaths, setClonedPaths] = useState<string[]>([]);

  const [prompt, setPrompt] = useState(() => promptParam || "");
  const [outputCount, setOutputCount] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<Ratio>("");
  const [dragging, setDragging] = useState(false);
  // 偏好是否已应用（避免覆盖用户已修改的值）
  const [prefsApplied, setPrefsApplied] = useState(false);

  // 定时生成
  const [scheduled, setScheduled] = useState(false);
  const [schedDate, setSchedDate] = useState(todayStr);
  const [schedHour, setSchedHour] = useState(12);
  const [schedMin, setSchedMin] = useState(0);
  const [schedMaxRetries, setSchedMaxRetries] = useState(2);

  // 思考模式
  const [enableThinking, setEnableThinking] = useState(false);

  // 当前运行状态（最新一次）
  const [runPhase, setRunPhase] = useState<RunPhase>("idle");
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  // 对话历史
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const historyRef = useRef<HTMLDivElement>(null);

  // Lightbox / 精选弹窗
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [featuredTarget, setFeaturedTarget] = useState<string | null>(null);
  const [featuredPrompt, setFeaturedPrompt] = useState("");

  // ── 克隆历史任务 ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!fromTaskId) return;
    getTask(fromTaskId)
      .then((task) => {
        const p = task.input_params as Record<string, unknown>;
        if (p.prompt)       setPrompt(String(p.prompt));
        if (p.output_count) setOutputCount(Number(p.output_count));
        if (p.aspect_ratio) setAspectRatio(String(p.aspect_ratio) as Ratio);
        const paths: string[] = [];
        if (Array.isArray(p.image_paths)) {
          p.image_paths.forEach((x: unknown) => typeof x === "string" && paths.push(x));
        } else if (p.image_path && typeof p.image_path === "string") {
          paths.push(p.image_path);
        }
        if (paths.length) {
          setClonedPaths(paths);
          setRefPreviews(paths.map((ip) => `${API_BASE}/uploads/${ip.replace(/\\/g, "/").split("/").pop() ?? ""}`));
        }
      })
      .catch(() => {});
  }, [fromTaskId]);

  // ── 灵感广场传入参考图 ───────────────────────────────────────────────────
  useEffect(() => {
    if (!refImageParam) return;
    setRefPreviews([refImageParam]);
    // 灵感广场传的是 URL，需要提示用户这只是预览（实际提交时用 image_url 字段兜底）
  }, [refImageParam]);

  // ── 应用用户偏好（仅当不是从历史/灵感广场跳转时） ───────────────────────
  useEffect(() => {
    if (prefsApplied) return;
    // 等 prefs 真正从 localStorage 加载完（mount 后）
    if (fromTaskId || promptParam || refImageParam) {
      setPrefsApplied(true);
      return; // 有 URL 参数时尊重原有逻辑，不应用偏好
    }
    if (prefs.defaultAspectRatio !== undefined) setAspectRatio(prefs.defaultAspectRatio as Ratio);
    if (prefs.defaultOutputCount) setOutputCount(prefs.defaultOutputCount);
    if (prefs.defaultEnableThinking) setEnableThinking(true);
    setPrefsApplied(true);
  }, [prefs, prefsApplied, fromTaskId, promptParam, refImageParam]);

  // ── 轮询任务状态 ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTaskId) return;
    const poll = async () => {
      try {
        const t = await getTask(currentTaskId);
        const progress = t.progress ?? 0;

        setHistory((prev) => {
          const idx = prev.findIndex((e) => e.id === currentTaskId);
          if (idx === -1) return prev;
          const updated = [...prev];
          if (t.status === "succeeded") {
            const out = (t.output ?? {}) as { output_files?: string[]; thinking?: ThinkingMeta | null };
            updated[idx] = {
              ...updated[idx],
              phase: "done",
              progress: 100,
              outputFiles: out.output_files ?? [],
              thinking: out.thinking ?? null,
            };
            setRunPhase("done");
          } else if (t.status === "failed") {
            updated[idx] = {
              ...updated[idx],
              phase: "error",
              error: formatError(t.error_message, "生成失败，请重试"),
            };
            setRunPhase("error");
          } else {
            updated[idx] = { ...updated[idx], progress };
          }
          return updated;
        });

        if (t.status === "succeeded" || t.status === "failed") {
          setCurrentTaskId(null);
        }
      } catch {}
    };
    poll();
    const timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, [currentTaskId]);

  // ── 参考图操作 ───────────────────────────────────────────────────────────
  const handleAddFiles = useCallback((files: FileList) => {
    const arr = Array.from(files);
    setRefFiles((prev) => {
      const remaining = MAX_REF_IMAGES - prev.length - clonedPaths.length;
      return [...prev, ...arr.slice(0, remaining)];
    });
    setRefPreviews((prev) => {
      const remaining = MAX_REF_IMAGES - prev.length;
      return [...prev, ...arr.slice(0, remaining).map((f) => URL.createObjectURL(f))];
    });
    setClonedPaths([]); // 一旦有新上传，不再用克隆路径
  }, [clonedPaths.length]);

  const handleRemoveRef = useCallback((index: number) => {
    setRefPreviews((prev) => prev.filter((_, i) => i !== index));
    if (clonedPaths.length > 0) {
      setClonedPaths((prev) => prev.filter((_, i) => i !== index));
    } else {
      setRefFiles((prev) => prev.filter((_, i) => i !== index));
    }
  }, [clonedPaths.length]);

  const clearRefs = useCallback(() => {
    setRefFiles([]);
    setRefPreviews([]);
    setClonedPaths([]);
  }, []);

  // ── 提交 ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setRunPhase("submitting");

    const now = new Date();
    const ts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
      String(now.getHours()).padStart(2, "0"),
      String(now.getMinutes()).padStart(2, "0"),
    ].join("");
    const taskName = `gpt2_${ts}`;

    // 创建历史条目（占位，后续更新）
    const entryId = `pending_${Date.now()}`;
    const newEntry: HistoryEntry = {
      id: entryId,
      prompt: prompt.trim(),
      refPreviews: [...refPreviews],
      outputFiles: [],
      aspectRatio,
      createdAt: now,
      phase: "submitting",
      progress: 0,
      error: "",
      enableThinking,
      thinking: null,
    };
    setHistory((prev) => [newEntry, ...prev]);

    // 滚动到顶
    setTimeout(() => historyRef.current?.scrollTo({ top: 0, behavior: "smooth" }), 50);

    try {
      // 上传参考图
      let imagePaths: string[] = [];
      if (clonedPaths.length > 0) {
        imagePaths = clonedPaths;
      } else if (refFiles.length > 0) {
        const uploaded = await Promise.all(refFiles.map((f) => uploadFile(f)));
        imagePaths = uploaded.map((u) => u.path);
      }

      const { task_id } = await createTask("gptimage2", {
        task_name: taskName,
        prompt: prompt.trim(),
        ...(imagePaths.length > 0 ? { image_paths: imagePaths } : {}),
        ...(refImageParam && imagePaths.length === 0 ? { image_url: refImageParam } : {}),
        output_count: outputCount,
        aspect_ratio: aspectRatio || "auto",
        ...(enableThinking ? { enable_thinking: true, reasoning_effort: "medium" } : {}),
        ...(scheduled && schedDate ? {
          scheduled_at: `${schedDate}T${String(schedHour).padStart(2, "0")}:${String(schedMin).padStart(2, "0")}:00`,
          scheduled_max_retries: schedMaxRetries,
        } : {}),
      });

      // 用真实 task_id 替换占位 id
      setHistory((prev) => prev.map((e) =>
        e.id === entryId ? { ...e, id: task_id, phase: "running" } : e
      ));
      setCurrentTaskId(task_id);
      setRunPhase("running");
    } catch (err) {
      setHistory((prev) => prev.map((e) =>
        e.id === entryId ? { ...e, phase: "error", error: formatError(err, "提交失败，请重试") } : e
      ));
      setRunPhase("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refFiles, clonedPaths, refPreviews, refImageParam, prompt, outputCount, aspectRatio, enableThinking, scheduled, schedDate, schedHour, schedMin, schedMaxRetries]);

  // ── 以历史结果为参考图 ───────────────────────────────────────────────────
  const handleUseAsRef = useCallback((entry: HistoryEntry) => {
    // 用结果图的 URL 作为预览，后端路径作为 clonedPaths
    const urls = entry.outputFiles.map(outputUrl);
    const paths = entry.outputFiles;
    setRefPreviews(urls.slice(0, MAX_REF_IMAGES));
    setClonedPaths(paths.slice(0, MAX_REF_IMAGES));
    setRefFiles([]);
    // 滚动回左侧参数区顶部（由于是全页面，无法直接滚动，但可以提示用户）
  }, []);

  const isLocked = runPhase === "running" || runPhase === "submitting";
  const schedValid = !scheduled || !!schedDate;
  const canSubmit = !!prompt.trim() && !isLocked && schedValid;

  const hasHistory = history.length > 0;

  return (
    <div style={{ margin: "-2rem", height: "calc(100% + 4rem)" }} className="flex overflow-hidden">

      {/* ── 左侧参数面板 ── */}
      <div
        className="flex flex-col flex-shrink-0 overflow-hidden"
        style={{ width: 420, borderRight: "1px solid var(--border)", background: "rgba(255,255,255,0.015)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#0ea5e9,#38bdf8)", boxShadow: "0 0 16px rgba(14,165,233,0.4)" }}
          >
            <Sparkles size={16} color="#fff" />
          </div>
          <div>
            <h1 className="text-base font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-rajdhani),sans-serif" }}>
              GPT-Image-2 生图
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>文生图 · 多图参考 · 对话式生成</p>
          </div>
        </div>

        {/* 设置区（可滚动） */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">

            {/* 克隆提示 */}
            {fromTaskId && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.2)", color: "#38bdf8" }}
              >
                <Sparkles size={11} />
                已从历史记录预填参数，可直接修改后重新生成
              </div>
            )}
            {/* 智能优化（思考模式） */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain size={14} style={{ color: enableThinking ? "#c4b5fd" : "var(--text-muted)" }} />
                  <span className="text-xs font-semibold" style={{ color: enableThinking ? "var(--text-primary)" : "var(--text-secondary)" }}>
                    智能优化提示词
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(167,139,250,0.12)", color: "#c4b5fd" }}>
                    GPT-5
                  </span>
                </div>
                <ToggleSwitch checked={enableThinking} onChange={setEnableThinking} />
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {enableThinking
                  ? "GPT-5 思考模型会先理解你的需求、改写为精准的英文 prompt 再生图。耗时增加 5–30 秒，效果通常显著提升。"
                  : "开启后由思考模型先优化提示词，对模糊或简短的输入提升明显。"}
              </p>
            </div>

            <div style={{ height: 1, background: "var(--border)" }} />

            {/* 提示词 */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                提示词
                <span className="normal-case tracking-normal px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>必填</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  // 自适应高度：内容多时自动撑高，但有上限
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 360) + "px";
                }}
                disabled={isLocked}
                placeholder="描述你想要生成的图像内容、风格、构图...&#10;&#10;支持多行；提示词越详细，生成效果越精准。&#10;开启上方「智能优化提示词」可以让 GPT-5 自动改写为精准英文 prompt。"
                rows={8}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all resize-y"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                  lineHeight: 1.7,
                  minHeight: 160,
                  maxHeight: 360,
                }}
                onFocus={(e) => (e.target.style.borderColor = "#0ea5e9")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
                  {prompt.length} 字 · 拖拽右下角可调整高度
                </span>
                {prompt && (
                  <button
                    type="button"
                    onClick={() => setPrompt("")}
                    disabled={isLocked}
                    className="text-xs transition-opacity hover:opacity-100"
                    style={{ color: "var(--text-muted)", opacity: 0.7 }}
                  >
                    清空
                  </button>
                )}
              </div>
            </div>

            <div style={{ height: 1, background: "var(--border)" }} />

            {/* 参考图多图上传 */}
            <RefImageGrid
              previews={refPreviews}
              onAdd={handleAddFiles}
              onRemove={handleRemoveRef}
              disabled={isLocked}
              dragging={dragging}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragging(false);
                if (e.dataTransfer.files.length) handleAddFiles(e.dataTransfer.files);
              }}
            />

            {/* 生成数量 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>生成数量</label>
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: "rgba(14,165,233,0.15)", color: "#38bdf8" }}>
                  {outputCount} 张
                </span>
              </div>
              <input
                type="range" min={1} max={4} value={outputCount}
                disabled={isLocked}
                onChange={(e) => setOutputCount(Number(e.target.value))}
                className="w-full accent-sky-500"
              />
              <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                <span>1 张</span><span>4 张</span>
              </div>
            </div>

            {/* 画面比例 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>画面比例</label>
                <span className="text-xs" style={{ color: "var(--text-muted)", opacity: 0.6 }}>默认自动</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {RATIOS.map((r) => {
                  const active = aspectRatio === r.id;
                  const iconColor = active ? "#7dd3fc" : "var(--text-secondary)";
                  return (
                    <button
                      key={r.id || "auto"}
                      onClick={() => setAspectRatio(r.id)}
                      disabled={isLocked}
                      className="flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl transition-all"
                      style={{
                        background: active ? "rgba(14,165,233,0.18)" : "rgba(255,255,255,0.03)",
                        border: active ? "1.5px solid rgba(14,165,233,0.5)" : "1px solid var(--border)",
                        boxShadow: active ? "0 0 0 1px rgba(14,165,233,0.15)" : "none",
                      }}
                      onMouseEnter={(e) => {
                        if (!active && !isLocked) {
                          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(14,165,233,0.3)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active && !isLocked) {
                          (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.03)";
                          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                        }
                      }}
                    >
                      <AspectIcon w={r.w} h={r.h} color={iconColor} isAuto={r.id === ""} />
                      <p className="text-xs font-bold leading-none" style={{ color: active ? "#7dd3fc" : "var(--text-primary)" }}>
                        {r.label}
                      </p>
                      <p className="text-xs leading-none" style={{ color: active ? "#38bdf8" : "var(--text-muted)", fontSize: 10, opacity: 0.85 }}>
                        {r.sub}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ height: 1, background: "var(--border)" }} />

            {/* 定时生成 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={14} style={{ color: scheduled ? "#a78bfa" : "var(--text-muted)" }} />
                  <span className="text-xs font-semibold" style={{ color: scheduled ? "var(--text-primary)" : "var(--text-secondary)" }}>定时生成</span>
                </div>
                <ToggleSwitch checked={scheduled} onChange={setScheduled} />
              </div>

              <AnimatePresence>
                {scheduled && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>执行日期</label>
                        <input
                          type="date"
                          value={schedDate}
                          min={todayStr()}
                          onChange={(e) => setSchedDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                          style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.35)", color: "var(--text-primary)" }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>时（0–23）</label>
                          <select
                            value={schedHour}
                            onChange={(e) => setSchedHour(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                            style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.35)", color: "var(--text-primary)" }}
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i} style={{ background: "#1a1a2e" }}>{String(i).padStart(2, "0")}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs mb-1.5" style={{ color: "var(--text-muted)" }}>分（0–59）</label>
                          <select
                            value={schedMin}
                            onChange={(e) => setSchedMin(Number(e.target.value))}
                            className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                            style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.35)", color: "var(--text-primary)" }}
                          >
                            {Array.from({ length: 60 }, (_, i) => (
                              <option key={i} value={i} style={{ background: "#1a1a2e" }}>{String(i).padStart(2, "0")}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs" style={{ color: "var(--text-muted)" }}>失败最大重试次数</label>
                          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
                            {schedMaxRetries} 次
                          </span>
                        </div>
                        <input
                          type="range" min={1} max={5} value={schedMaxRetries}
                          onChange={(e) => setSchedMaxRetries(Number(e.target.value))}
                          className="w-full accent-purple-500"
                        />
                        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>避免失败时无限重试消耗额度，建议 2–3 次</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>

        {/* 底部提交区 */}
        <div className="flex-shrink-0 p-5 space-y-3" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={handleSubmit} disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white transition-all"
            style={{
              background: canSubmit
                ? scheduled ? "linear-gradient(135deg,#7c3aed,#a855f7)" : "linear-gradient(135deg,#0ea5e9,#38bdf8)"
                : "rgba(255,255,255,0.06)",
              boxShadow: canSubmit ? `0 0 20px ${scheduled ? "rgba(139,92,246,0.35)" : "rgba(14,165,233,0.35)"}` : "none",
              color: canSubmit ? "#fff" : "var(--text-muted)",
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {isLocked ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Sparkles size={15} />
                </motion.div>
                生成中...
              </>
            ) : scheduled ? (
              <><Clock size={15} />提交定时任务</>
            ) : (
              <><Sparkles size={15} />开始生成</>
            )}
          </button>
        </div>
      </div>

      {/* ── 右侧：对话历史 + 空状态 ── */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>

        {!hasHistory ? (
          /* 空状态 */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-12 select-none">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center"
              style={{ background: "rgba(14,165,233,0.06)", border: "1px solid rgba(14,165,233,0.12)" }}
            >
              <ImageIcon size={40} style={{ color: "rgba(14,165,233,0.3)" }} />
            </div>
            <div className="text-center max-w-xs">
              <p className="text-base font-semibold mb-2" style={{ color: "var(--text-secondary)" }}>填写提示词，开始生图</p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                每次生成的结果和参数会在此处以对话方式记录，支持一键复用或以结果为参考继续创作。
              </p>
            </div>
            <div className="flex gap-3 mt-2">
              {["写提示词", "（可选）上传参考图", "提交生成"].map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: "rgba(14,165,233,0.15)", color: "#38bdf8", border: "1px solid rgba(14,165,233,0.3)" }}
                  >
                    {i + 1}
                  </div>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{step}</span>
                  {i < 2 && <div className="w-6 h-px" style={{ background: "var(--border)" }} />}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* 对话历史列表 */
          <>
            <div
              className="flex-shrink-0 flex items-center gap-2 px-6 py-3.5"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <History size={14} style={{ color: "var(--text-muted)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
                本次会话生成记录
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full ml-1" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-muted)" }}>
                {history.length}
              </span>
              <div className="flex-1" />
              <button
                onClick={() => setHistory([])}
                className="text-xs px-3 py-1 rounded-lg transition-colors"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                清空记录
              </button>
            </div>

            <div ref={historyRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {history.map((entry) => (
                <HistoryItem
                  key={entry.id}
                  entry={entry}
                  onSetLightbox={setLightbox}
                  onSetFeatured={(url) => { setFeaturedTarget(url); setFeaturedPrompt(entry.prompt); }}
                  onUseAsRef={handleUseAsRef}
                />
              ))}
            </div>
          </>
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

      {/* 精选弹窗 */}
      {featuredTarget && (
        <FeaturedModal
          imageUrl={featuredTarget}
          prompt={featuredPrompt}
          onClose={() => setFeaturedTarget(null)}
        />
      )}
    </div>
  );
}
