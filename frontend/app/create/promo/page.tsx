"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Sparkles, X, CheckCircle2, Loader2,
  ImageIcon, Layers, Download, PackageOpen,
  Shuffle, Lock, AlertCircle, RefreshCw, Mountain, Wand2, ZoomIn, ChevronRight, Tag, Plus,
} from "lucide-react";
import { uploadFile, createTask, getTask } from "@/lib/api";
import { formatError } from "@/lib/format-error";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SESSION_KEY = "artflow_promo_session";

// ─── helpers ─────────────────────────────────────────────────────────────────

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
function randomTaskName() {
  const pool = ["苍穹破晓", "烈焰战神", "幻影疾风", "雷霆霸主", "冰刃极域", "暗影猎手", "龙魂觉醒", "星辰主宰"];
  const n = pool[Math.floor(Math.random() * pool.length)];
  const now = new Date();
  const ts = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"), String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0")].join("");
  return `${n}_${ts}`;
}

type PhaseStatus = "locked" | "active" | "running" | "review" | "done";

const BACKENDS: { id: "seedream" | "gemini" | "gpt-image-2"; label: string; sub: string }[] = [
  { id: "seedream", label: "Seedream", sub: "火山" },
  { id: "gemini", label: "Gemini", sub: "Sofunny" },
  { id: "gpt-image-2", label: "GPT-Image-2", sub: "Sofunny" },
];

const PHASE_DEFS = [
  { id: 1, label: "任务定义",  icon: Wand2,      color: "#8b5cf6" },
  { id: 2, label: "角色生成",  icon: ImageIcon,  color: "#60a5fa" },
  { id: 3, label: "背景生成",  icon: Mountain,   color: "#10b981" },
  { id: 4, label: "融合成图",  icon: Layers,     color: "#f59e0b" },
  { id: 5, label: "交付归档",  icon: Download,   color: "#a855f7" },
];

const BG_KEYWORD_PRESETS: { category: string; keywords: string[] }[] = [
  {
    category: "场景环境",
    keywords: [
      "古战场遗迹", "霓虹都市夜景", "魔法森林秘境", "深海神殿",
      "火山熔岩地带", "废土末日荒原", "东方古典宫殿", "星云宇宙深处",
    ],
  },
  {
    category: "光效氛围",
    keywords: [
      "史诗体积光", "黄昏余晖金光", "极光异象", "雷霆闪电", "魔法粒子光晕", "晨曦圣光",
    ],
  },
  {
    category: "风格调性",
    keywords: [
      "赛博朋克", "东方古风", "奇幻魔幻", "科幻未来", "史诗神话", "末世废墟",
    ],
  },
];

// ─── BgKeywordsSelector ───────────────────────────────────────────────────────

function BgKeywordsSelector({
  selected, onToggle, custom, onCustomChange,
}: {
  selected: string[];
  onToggle: (kw: string) => void;
  custom: string;
  onCustomChange: (v: string) => void;
}) {
  const [tab, setTab] = useState(0);
  const preset = BG_KEYWORD_PRESETS[tab];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          背景关键词 <span className="normal-case tracking-normal font-normal opacity-60">可选</span>
        </label>
        {selected.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>
            已选 {selected.length}
          </span>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5">
        {BG_KEYWORD_PRESETS.map((p, i) => (
          <button key={i} onClick={() => setTab(i)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: tab === i ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.04)",
              border: tab === i ? "1px solid rgba(139,92,246,0.45)" : "1px solid var(--border)",
              color: tab === i ? "#c4b5fd" : "var(--text-muted)",
            }}>
            {p.category}
          </button>
        ))}
      </div>

      {/* Keyword chips */}
      <div className="flex flex-wrap gap-1.5">
        {preset.keywords.map((kw) => {
          const active = selected.includes(kw);
          return (
            <button key={kw} onClick={() => onToggle(kw)}
              className="px-2.5 py-1 rounded-lg text-xs transition-all"
              style={{
                background: active ? "rgba(139,92,246,0.22)" : "rgba(255,255,255,0.04)",
                border: active ? "1px solid rgba(139,92,246,0.55)" : "1px solid var(--border)",
                color: active ? "#c4b5fd" : "var(--text-secondary)",
                fontWeight: active ? 600 : 400,
              }}>
              {kw}
            </button>
          );
        })}
      </div>

      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 py-2.5 rounded-xl"
          style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.18)" }}>
          {selected.map((kw) => (
            <span key={kw} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{ background: "rgba(139,92,246,0.2)", color: "#c4b5fd", border: "1px solid rgba(139,92,246,0.35)" }}>
              <Tag size={9} />
              {kw}
              <button onClick={() => onToggle(kw)} className="ml-0.5 opacity-70 hover:opacity-100">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Custom input */}
      <div className="space-y-1.5">
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>自定义关键词</p>
        <input
          type="text" value={custom} onChange={(e) => onCustomChange(e.target.value)}
          placeholder="输入其他关键词，如：沙漠绿洲、樱花飞舞…"
          className="w-full rounded-xl px-3 py-2.5 text-xs outline-none"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
        />
      </div>
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function MiniProgress({ value, label }: { value: number; label: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
        <span>{label}</span><span>{value}%</span>
      </div>
      <div className="w-full rounded-full h-1" style={{ background: "rgba(255,255,255,0.06)" }}>
        <motion.div className="h-1 rounded-full"
          style={{ background: "linear-gradient(90deg,#7c3aed,#a855f7,#ec4899)" }}
          animate={{ width: `${value}%` }} transition={{ duration: 0.5 }} />
      </div>
    </div>
  );
}

function useTaskPoller(
  taskId: string | null,
  onDone: (files: string[]) => void,
  onFail: (msg: string) => void,
  onPartial?: (files: string[]) => void,
) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!taskId) return;
    const poll = async () => {
      try {
        const t = await getTask(taskId);
        setProgress(t.progress);
        if (t.status === "running" || t.status === "pending") {
          const partial = (t.output as { output_files?: string[] })?.output_files ?? [];
          if (partial.length > 0 && onPartial) onPartial(partial);
        }
        if (t.status === "succeeded") {
          onDone((t.output as { output_files?: string[] })?.output_files ?? []);
          if (timerRef.current) clearInterval(timerRef.current);
        } else if (t.status === "failed") {
          onFail(formatError(t.error_message, "执行失败"));
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } catch {}
    };
    poll();
    timerRef.current = setInterval(poll, 2000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);
  return { progress };
}

function ImageGrid({
  files, selected, onSelect, multi = false, onLightbox,
}: {
  files: string[]; selected: string | string[]; onSelect: (f: string) => void;
  multi?: boolean; onLightbox: (u: string) => void;
}) {
  if (!files.length) return null;
  const selectedSet = new Set(Array.isArray(selected) ? selected : [selected]);
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
      {files.map((f, i) => {
        const url = outputUrl(f);
        const sel = selectedSet.has(f);
        return (
          <motion.div key={i} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="relative rounded-2xl overflow-hidden group cursor-pointer"
            style={{ aspectRatio: "1/1", border: sel ? "2px solid #a78bfa" : "1.5px solid var(--border)", boxShadow: sel ? "0 0 0 3px rgba(139,92,246,0.2)" : "none" }}
            onClick={() => onSelect(f)}
          >
            <img src={url} alt={`结果 ${i + 1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
            {sel && (
              <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "#7c3aed" }}>
                <CheckCircle2 size={14} color="#fff" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center gap-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
              <button onClick={(e) => { e.stopPropagation(); onLightbox(url); }}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform hover:scale-110"
                style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
                <ZoomIn size={17} />
              </button>
              <a href={dlUrl(f)} download={fname(f)} onClick={(e) => e.stopPropagation()}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform hover:scale-110"
                style={{ background: "rgba(139,92,246,0.5)", color: "#fff" }}>
                <Download size={17} />
              </a>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── Horizontal pipeline stepper ─────────────────────────────────────────────

function PipelineStepper({
  phaseStatuses, rightView, setRightView,
}: {
  phaseStatuses: Record<number, PhaseStatus>;
  rightView: number;
  setRightView: (v: number) => void;
}) {
  return (
    <div
      className="flex-shrink-0 flex items-center px-6 gap-1 overflow-x-auto"
      style={{ height: 56, borderBottom: "1px solid var(--border)", background: "rgba(255,255,255,0.01)" }}
    >
      {PHASE_DEFS.map((ph, i) => {
        const status = phaseStatuses[ph.id] ?? "locked";
        const isActive = rightView === ph.id;
        const clickable = status !== "locked";
        const Icon = ph.icon;

        const iconColor = status === "done" ? "#34d399"
          : status === "running" ? ph.color
          : status === "review" ? "#fbbf24"
          : isActive ? ph.color
          : "var(--text-muted)";

        const labelColor = isActive ? ph.color
          : status === "done" ? "var(--text-secondary)"
          : "var(--text-muted)";

        return (
          <div key={ph.id} className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => clickable && setRightView(ph.id)}
              disabled={!clickable}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all"
              style={{
                background: isActive ? `${ph.color}15` : "transparent",
                border: isActive ? `1px solid ${ph.color}35` : "1px solid transparent",
                cursor: clickable ? "pointer" : "default",
              }}
            >
              <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                {status === "done" ? (
                  <CheckCircle2 size={14} color="#34d399" />
                ) : status === "running" ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
                    <Loader2 size={14} color={iconColor} />
                  </motion.div>
                ) : status === "locked" ? (
                  <Lock size={12} color="var(--text-muted)" />
                ) : (
                  <Icon size={14} color={iconColor} />
                )}
              </div>
              <span className="text-xs font-semibold whitespace-nowrap" style={{ color: labelColor }}>
                {ph.label}
              </span>
              {status === "review" && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
                  style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24", fontSize: 10 }}>
                  待确认
                </span>
              )}
            </button>
            {i < PHASE_DEFS.length - 1 && (
              <ChevronRight size={13} style={{ color: "var(--text-muted)", opacity: 0.4, flexShrink: 0 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PromoPage() {
  // Phase 1 config
  const [refFile, setRefFile] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [refPath, setRefPath] = useState<string | null>(null);
  const [taskName, setTaskName] = useState(randomTaskName);
  const [templateType, setTemplateType] = useState<"2d" | "3d">("2d");
  const [imageBackend, setImageBackend] = useState<"seedream" | "gemini" | "gpt-image-2">("seedream");
  const [outputCount, setOutputCount] = useState(3);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [selectedBgKeywords, setSelectedBgKeywords] = useState<string[]>([]);
  const [customBgKeyword, setCustomBgKeyword] = useState("");
  const [dragging, setDragging] = useState(false);

  // computed bg keyword string passed to API
  const bgKeywords = [...selectedBgKeywords, customBgKeyword].filter(Boolean).join("，");

  const toggleBgKeyword = useCallback((kw: string) => {
    setSelectedBgKeywords((prev) =>
      prev.includes(kw) ? prev.filter((x) => x !== kw) : [...prev, kw]
    );
  }, []);

  // Phase 2
  const [p2TaskId, setP2TaskId] = useState<string | null>(null);
  const [p2Progress, setP2Progress] = useState(0);
  const [p2Files, setP2Files] = useState<string[]>([]);
  const [p2PartialFiles, setP2PartialFiles] = useState<string[]>([]);
  const [p2Error, setP2Error] = useState("");
  const [p2Selected, setP2Selected] = useState<string>("");
  const [p2Confirmed, setP2Confirmed] = useState(false);

  // Phase 3
  const [p3TaskId, setP3TaskId] = useState<string | null>(null);
  const [p3Progress, setP3Progress] = useState(0);
  const [p3Files, setP3Files] = useState<string[]>([]);
  const [p3PartialFiles, setP3PartialFiles] = useState<string[]>([]);
  const [p3Error, setP3Error] = useState("");
  const [p3Selected, setP3Selected] = useState<string>("");

  // Phase 4
  const [p4TaskId, setP4TaskId] = useState<string | null>(null);
  const [p4Progress, setP4Progress] = useState(0);
  const [p4Files, setP4Files] = useState<string[]>([]);
  const [p4PartialFiles, setP4PartialFiles] = useState<string[]>([]);
  const [p4Error, setP4Error] = useState("");
  const [p4Selected, setP4Selected] = useState<string[]>([]);

  // UI
  const [currentPhase, setCurrentPhase] = useState(1);
  const [rightView, setRightView] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState("");

  useEffect(() => { setRightView(currentPhase); }, [currentPhase]);

  const phaseStatuses: Record<number, PhaseStatus> = {
    1: currentPhase > 1 ? "done" : "active",
    2: p2TaskId && !p2Files.length && !p2Error ? "running"
      : p2Files.length && !p2Confirmed ? "review"
      : p2Confirmed ? "done"
      : currentPhase >= 2 ? "active" : "locked",
    3: p3TaskId && !p3Files.length && !p3Error ? "running"
      : p3Files.length && !p3Selected ? "review"
      : p3Selected ? "done"
      : p2Confirmed ? "active" : "locked",
    4: p4TaskId && !p4Files.length && !p4Error ? "running"
      : p4Files.length ? "done"
      : p3Selected ? "active" : "locked",
    5: p4Files.length ? "done" : "locked",
  };

  const handleFile = (f: File) => { setRefFile(f); setRefPreview(URL.createObjectURL(f)); setRefPath(null); };

  // Phase 1 submit
  const handlePhase1Submit = useCallback(async () => {
    if ((!refFile && !refPath) || !taskName.trim()) return;
    setGeneralError(""); setUploading(true);
    try {
      const imagePath = refFile ? (await uploadFile(refFile)).path : refPath!;
      if (refFile) setRefPath(imagePath);
      const { task_id } = await createTask("sketch2keyvisual", {
        phase: 2, image_path: imagePath, task_name: taskName.trim(),
        template_type: templateType, output_count: outputCount, image_backend: imageBackend,
      });
      setP2TaskId(task_id); setCurrentPhase(2);
    } catch (e) { setGeneralError(e instanceof Error ? e.message : "提交失败"); }
    finally { setUploading(false); }
  }, [refFile, refPath, taskName, templateType, outputCount, imageBackend]);

  // Phase 2 retry
  const handlePhase2Retry = useCallback(async () => {
    if (!refPath || !taskName.trim()) return;
    setP2Error(""); setP2Progress(0); setP2TaskId(null); setP2Files([]); setP2PartialFiles([]); setP2Selected(""); setP2Confirmed(false);
    try {
      const { task_id } = await createTask("sketch2keyvisual", {
        phase: 2, image_path: refPath, task_name: taskName.trim(),
        template_type: templateType, output_count: outputCount, image_backend: imageBackend,
      });
      setP2TaskId(task_id);
    } catch (e) { setP2Error(e instanceof Error ? e.message : "重试失败"); }
  }, [refPath, taskName, templateType, outputCount, imageBackend]);

  const { progress: p2Poll } = useTaskPoller(
    p2Files.length ? null : p2TaskId,
    (files) => { setP2Files(files); setP2PartialFiles([]); setP2Selected(files[0] ?? ""); },
    (msg) => setP2Error(msg),
    (partial) => setP2PartialFiles(partial),
  );
  useEffect(() => { if (p2Poll) setP2Progress(p2Poll); }, [p2Poll]);

  // Phase 3 start
  const handlePhase3Start = useCallback(async () => {
    if (!taskName) return;
    setP3Error(""); setP3Progress(0); setP3TaskId(null); setP3Files([]); setP3PartialFiles([]); setP3Selected("");
    setP2Confirmed(true);
    try {
      const { task_id } = await createTask("sketch2keyvisual", {
        phase: 3, task_name: taskName.trim(), template_type: templateType,
        bg_keywords: bgKeywords, output_count: outputCount, aspect_ratio: aspectRatio,
        image_backend: imageBackend,
      });
      setP3TaskId(task_id); setCurrentPhase(3);
    } catch (e) { setP3Error(e instanceof Error ? e.message : "背景生成提交失败"); }
  }, [taskName, templateType, bgKeywords, outputCount, aspectRatio, imageBackend]);

  const handleP2Confirm = useCallback(async () => {
    if (!p2Selected || !taskName) return;
    await handlePhase3Start();
  }, [p2Selected, taskName, handlePhase3Start]);

  const { progress: p3Poll } = useTaskPoller(
    p3Files.length ? null : p3TaskId,
    (files) => { setP3Files(files); setP3PartialFiles([]); setP3Selected(files[0] ?? ""); setCurrentPhase(4); },
    (msg) => setP3Error(msg),
    (partial) => setP3PartialFiles(partial),
  );
  useEffect(() => { if (p3Poll) setP3Progress(p3Poll); }, [p3Poll]);

  // Phase 4 start
  const handlePhase4Start = useCallback(async (charPath: string, bgPath: string) => {
    if (!charPath || !bgPath || !taskName) return;
    setP4Error(""); setP4Progress(0); setP4TaskId(null); setP4Files([]); setP4PartialFiles([]); setP4Selected([]);
    try {
      const { task_id } = await createTask("sketch2keyvisual", {
        phase: 4, task_name: taskName.trim(), char_image_path: charPath, bg_image_path: bgPath,
        template_type: templateType, output_count: outputCount, aspect_ratio: aspectRatio,
        image_backend: imageBackend,
      });
      setP4TaskId(task_id); setCurrentPhase(4);
    } catch (e) { setP4Error(e instanceof Error ? e.message : "融合提交失败"); }
  }, [taskName, templateType, outputCount, aspectRatio, imageBackend]);

  const handleP3Confirm = useCallback(async () => {
    if (!p3Selected || !p2Selected) return;
    await handlePhase4Start(p2Selected, p3Selected);
  }, [p3Selected, p2Selected, handlePhase4Start]);

  const { progress: p4Poll } = useTaskPoller(
    p4Files.length ? null : p4TaskId,
    (files) => { setP4Files(files); setP4PartialFiles([]); setP4Selected(files); setCurrentPhase(5); },
    (msg) => setP4Error(msg),
    (partial) => setP4PartialFiles(partial),
  );
  useEffect(() => { if (p4Poll) setP4Progress(p4Poll); }, [p4Poll]);

  // Session persistence
  useEffect(() => {
    if (!p2TaskId) return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({
        taskName, templateType, imageBackend, outputCount, aspectRatio,
        selectedBgKeywords, customBgKeyword,
        refPath, currentPhase, p2TaskId, p2Selected, p2Confirmed,
        p3TaskId, p3Selected, p4TaskId, p4SelectedPaths: p4Selected,
      }));
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p2TaskId, p3TaskId, p4TaskId, p2Selected, p2Confirmed, p3Selected, p4Selected, currentPhase, refPath, selectedBgKeywords, customBgKeyword]);

  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const s = JSON.parse(raw);
        if (!s.p2TaskId) return;
        const [t2res, t3res, t4res] = await Promise.allSettled([
          getTask(s.p2TaskId),
          s.p3TaskId ? getTask(s.p3TaskId) : Promise.reject("no p3"),
          s.p4TaskId ? getTask(s.p4TaskId) : Promise.reject("no p4"),
        ]);
        if (cancelled) return;
        if (s.taskName) setTaskName(s.taskName);
        if (s.templateType) setTemplateType(s.templateType);
        if (s.imageBackend) setImageBackend(s.imageBackend as "seedream" | "gemini" | "gpt-image-2");
        if (s.outputCount) setOutputCount(s.outputCount);
        if (s.aspectRatio) setAspectRatio(s.aspectRatio);
        if (Array.isArray(s.selectedBgKeywords)) setSelectedBgKeywords(s.selectedBgKeywords);
        if (s.customBgKeyword !== undefined) setCustomBgKeyword(s.customBgKeyword);
        if (s.refPath) {
          setRefPath(s.refPath);
          setRefPreview(`${API_BASE}/uploads/${String(s.refPath).replace(/\\/g, "/").split("/").pop() ?? ""}`);
        }
        let restoredPhase = Math.max(2, s.currentPhase || 2);
        const p2Status = t2res.status === "fulfilled" ? t2res.value.status : "unknown";
        if (p2Status !== "failed") setP2TaskId(s.p2TaskId);
        if (s.p2Selected) setP2Selected(s.p2Selected);
        if (s.p2Confirmed) setP2Confirmed(true);
        if (p2Status === "succeeded") {
          const files = (t2res.status === "fulfilled" ? (t2res.value.output as { output_files?: string[] })?.output_files : null) ?? [];
          if (files.length) setP2Files(files);
        }
        if (s.p3TaskId) {
          const p3Status = t3res.status === "fulfilled" ? t3res.value.status : "unknown";
          if (p3Status !== "failed") setP3TaskId(s.p3TaskId);
          if (s.p3Selected) setP3Selected(s.p3Selected);
          if (p3Status === "succeeded") {
            const files = (t3res.status === "fulfilled" ? (t3res.value.output as { output_files?: string[] })?.output_files : null) ?? [];
            if (files.length) { setP3Files(files); restoredPhase = Math.max(restoredPhase, 3); }
          } else if (p3Status === "failed") {
            setP3Error(formatError(t3res.status === "fulfilled" ? t3res.value.error_message : null, "背景生成失败，请重新生成"));
          }
        }
        if (s.p4TaskId) {
          const p4Status = t4res.status === "fulfilled" ? t4res.value.status : "unknown";
          if (p4Status !== "failed") setP4TaskId(s.p4TaskId);
          if (p4Status === "succeeded") {
            const files = (t4res.status === "fulfilled" ? (t4res.value.output as { output_files?: string[] })?.output_files : null) ?? [];
            if (files.length) { setP4Files(files); setP4Selected(s.p4SelectedPaths?.length ? s.p4SelectedPaths : files); restoredPhase = 5; }
          } else if (p4Status === "failed") {
            setP4Error(formatError(t4res.status === "fulfilled" ? t4res.value.error_message : null, "融合生成失败，请重新融合"));
          }
        }
        setCurrentPhase(restoredPhase);
      } catch {}
    };
    restore();
    return () => { cancelled = true; };
  }, []);

  const reset = () => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentPhase(1); setRightView(1);
    setRefFile(null); setRefPreview(null); setRefPath(null); setTaskName(randomTaskName());
    setSelectedBgKeywords([]); setCustomBgKeyword("");
    setP2TaskId(null); setP2Files([]); setP2PartialFiles([]); setP2Selected(""); setP2Confirmed(false); setP2Error(""); setP2Progress(0);
    setP3TaskId(null); setP3Files([]); setP3PartialFiles([]); setP3Selected(""); setP3Error(""); setP3Progress(0);
    setP4TaskId(null); setP4Files([]); setP4PartialFiles([]); setP4Selected([]); setP4Error(""); setP4Progress(0);
    setGeneralError(""); setUploading(false);
  };

  const canSubmitP1 = (!!(refFile || refPath)) && !!taskName.trim();
  const currentColor = PHASE_DEFS.find((p) => p.id === currentPhase)?.color ?? "#8b5cf6";

  return (
    <div style={{ margin: "-2rem", height: "calc(100% + 4rem)" }} className="flex overflow-hidden">

      {/* ══ LEFT OPERATIONS PANEL ════════════════════════════════════════════ */}
      <div
        className="flex flex-col flex-shrink-0 overflow-hidden"
        style={{ width: 440, borderRight: "1px solid var(--border)", background: "rgba(255,255,255,0.015)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", boxShadow: "0 0 16px rgba(139,92,246,0.4)" }}>
              <Layers size={16} color="#fff" />
            </div>
            <div>
              <h1 className="text-base font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-rajdhani),sans-serif" }}>
                原画转宣发图
              </h1>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>五阶段 AI 生产管线</p>
            </div>
          </div>
          {currentPhase > 1 && (
            <button onClick={reset} className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition-all"
              style={{
                background: "rgba(139,92,246,0.15)",
                color: "#c4b5fd",
                border: "1px solid rgba(139,92,246,0.35)",
              }}>
              <Plus size={14} />新任务
            </button>
          )}
        </div>

        {/* Scrollable operation area */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Phase 1: full config ── */}
          {currentPhase === 1 && (
            <div className="p-6 space-y-5">
              {generalError && (
                <div className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                  <AlertCircle size={12} />{generalError}
                </div>
              )}

              {/* Upload */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-muted)" }}>原画参考图</p>
                <div
                  className={`rounded-2xl cursor-pointer transition-all ${dragging ? "ring-2 ring-purple-500" : ""}`}
                  style={{ minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.02)", border: "1.5px dashed var(--border)", position: "relative" }}
                  onClick={() => !refPreview && document.getElementById("promo-ref")?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                >
                  {refPreview ? (
                    <div className="relative w-full p-4">
                      <img src={refPreview} alt="参考图" className="w-full max-h-36 rounded-xl object-contain mx-auto" />
                      <button onClick={(e) => { e.stopPropagation(); setRefFile(null); setRefPreview(null); setRefPath(null); }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="text-center p-8">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                        style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)" }}>
                        <Upload size={22} style={{ color: "var(--accent)" }} />
                      </div>
                      <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>拖拽或点击上传</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>JPG · PNG · WEBP · 最大 20MB</p>
                    </div>
                  )}
                  <input id="promo-ref" type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                </div>
              </div>

              {/* Task name */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>任务名称</label>
                <div className="flex gap-2">
                  <input type="text" value={taskName} onChange={(e) => setTaskName(e.target.value)}
                    placeholder="宣发任务名称"
                    className="flex-1 rounded-xl px-4 py-3 text-sm outline-none transition-all"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--border)")} />
                  <button onClick={() => setTaskName(randomTaskName())}
                    className="w-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", color: "#a78bfa" }}>
                    <Shuffle size={15} />
                  </button>
                </div>
              </div>

              {/* Template type — full row */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>宣发模板</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["2d", "3d"] as const).map((t) => (
                    <button key={t} onClick={() => setTemplateType(t)}
                      className="py-3 rounded-xl text-sm font-bold transition-all"
                      style={{ background: templateType === t ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.03)", border: templateType === t ? "1.5px solid rgba(139,92,246,0.5)" : "1px solid var(--border)", color: templateType === t ? "#c4b5fd" : "var(--text-secondary)" }}>
                      {t === "2d" ? "2D 卡通" : "3D 皮克斯"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect ratio — full row, 4 columns */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>输出比例</label>
                <div className="grid grid-cols-4 gap-2">
                  {["16:9", "4:3", "1:1", "9:16"].map((r) => (
                    <button key={r} onClick={() => setAspectRatio(r)}
                      className="py-3 rounded-xl text-xs font-bold transition-all"
                      style={{ background: aspectRatio === r ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.03)", border: aspectRatio === r ? "1.5px solid rgba(139,92,246,0.5)" : "1px solid var(--border)", color: aspectRatio === r ? "#c4b5fd" : "var(--text-secondary)" }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image backend — full row */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>生图引擎</label>
                <div className="grid grid-cols-3 gap-2">
                  {BACKENDS.map((b) => {
                    const active = imageBackend === b.id;
                    return (
                      <button key={b.id} onClick={() => setImageBackend(b.id)}
                        className="py-3 px-1 rounded-xl text-center transition-all"
                        style={{ background: active ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.03)", border: active ? "1.5px solid rgba(139,92,246,0.5)" : "1px solid var(--border)" }}>
                        <p className="text-xs font-bold" style={{ color: active ? "#c4b5fd" : "var(--text-primary)" }}>{b.label}</p>
                        <p style={{ color: active ? "#a78bfa" : "var(--text-muted)", fontSize: 10, marginTop: 2 }}>{b.sub}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Output count — full row */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>生成组数</label>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>{outputCount}</span>
                </div>
                <input type="range" min={1} max={6} value={outputCount}
                  onChange={(e) => setOutputCount(Number(e.target.value))} className="w-full accent-purple-500" />
                <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>1</span><span>6</span>
                </div>
              </div>

              {/* BG Keywords — full row with preset chips */}
              <BgKeywordsSelector
                selected={selectedBgKeywords}
                onToggle={toggleBgKeyword}
                custom={customBgKeyword}
                onCustomChange={setCustomBgKeyword}
              />

              {/* Submit */}
              <button
                onClick={handlePhase1Submit} disabled={!canSubmitP1 || uploading}
                className="btn-glow w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold text-white"
                style={{ opacity: canSubmitP1 && !uploading ? 1 : 0.4, cursor: canSubmitP1 && !uploading ? "pointer" : "not-allowed" }}
              >
                {uploading
                  ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Sparkles size={16} /></motion.div>上传中…</>
                  : <><Sparkles size={16} />开始生成宣发图</>}
              </button>
            </div>
          )}

          {/* ── Phase 2–5: compact summary + current phase controls ── */}
          {currentPhase > 1 && (
            <div className="p-6 space-y-6">

              {/* Phase 1 summary */}
              <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)" }}>
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>任务配置</p>
                {refPreview && (
                  <div className="relative group cursor-pointer rounded-xl overflow-hidden"
                    onClick={() => setLightbox(refPreview)}>
                    <img src={refPreview} alt="参考图" className="w-full rounded-xl object-contain"
                      style={{ maxHeight: 200, background: "rgba(0,0,0,0.2)" }} />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"
                      style={{ background: "rgba(0,0,0,0.45)" }}>
                      <ZoomIn size={24} color="#fff" />
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    taskName,
                    templateType === "2d" ? "2D 卡通" : "3D 皮克斯",
                    imageBackend,
                    `${outputCount} 组`,
                    aspectRatio,
                    ...(bgKeywords ? [`背景: ${bgKeywords.slice(0, 20)}${bgKeywords.length > 20 ? "…" : ""}`] : []),
                  ].map((v, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-lg"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                      {v}
                    </span>
                  ))}
                </div>
              </div>

              {/* Current phase operations */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-5 rounded-full flex-shrink-0" style={{ background: currentColor }} />
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    {PHASE_DEFS.find((p) => p.id === currentPhase)?.label}
                  </p>
                </div>

                {/* Phase 2 ops */}
                {currentPhase === 2 && (
                  <div className="space-y-3">
                    {!p2TaskId && !p2Files.length && !p2Error && refPath && (
                      <button onClick={handlePhase2Retry} className="btn-glow w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white">
                        <Sparkles size={15} />开始生成角色图
                      </button>
                    )}
                    {phaseStatuses[2] === "running" && <MiniProgress value={p2Progress} label="生成角色姿态图中…" />}
                    {p2Error && (
                      <div className="space-y-2.5">
                        <p className="text-xs px-3 py-2.5 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>{p2Error}</p>
                        <button onClick={handlePhase2Retry} className="flex items-center gap-2 w-full justify-center text-sm py-2.5 rounded-xl font-semibold"
                          style={{ background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.3)", color: "#60a5fa" }}>
                          <RefreshCw size={14} />重新生成角色图
                        </button>
                      </div>
                    )}
                    {phaseStatuses[2] === "review" && (
                      <div className="space-y-3">
                        <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24" }}>
                          在右侧点击选择一张最佳角色图，再点击下方按钮确认通过
                        </div>
                        {p2Selected && (
                          <img src={outputUrl(p2Selected)} alt="已选" className="w-full rounded-xl object-cover"
                            style={{ aspectRatio: "1/1", border: "1.5px solid rgba(139,92,246,0.4)", maxHeight: 180 }} />
                        )}
                        <button onClick={handleP2Confirm} disabled={!p2Selected}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all"
                          style={{ background: p2Selected ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.04)", border: p2Selected ? "1.5px solid rgba(52,211,153,0.4)" : "1px solid var(--border)", color: p2Selected ? "#34d399" : "var(--text-muted)", cursor: p2Selected ? "pointer" : "not-allowed" }}>
                          <CheckCircle2 size={15} />确认通过，进入背景生成
                        </button>
                        <button onClick={handlePhase2Retry} className="flex items-center gap-2 w-full justify-center text-xs py-2 rounded-xl"
                          style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                          <RefreshCw size={12} />重新生成
                        </button>
                      </div>
                    )}
                    {phaseStatuses[2] === "done" && (
                      <div className="space-y-2.5">
                        {p2Selected && (
                          <img src={outputUrl(p2Selected)} alt="已选" className="w-full rounded-xl object-cover"
                            style={{ aspectRatio: "1/1", border: "1px solid rgba(52,211,153,0.3)", maxHeight: 180 }} />
                        )}
                        <p className="text-xs text-center" style={{ color: "#34d399" }}>✓ 角色图已确认</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Phase 3 ops */}
                {currentPhase === 3 && (
                  <div className="space-y-3">
                    {phaseStatuses[3] === "active" && !p3Error && (
                      <button onClick={handlePhase3Start} className="btn-glow w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white">
                        <Mountain size={15} />开始生成背景图
                      </button>
                    )}
                    {phaseStatuses[3] === "running" && <MiniProgress value={p3Progress} label="生成背景场景图中…" />}
                    {p3Error && (
                      <div className="space-y-2.5">
                        <p className="text-xs px-3 py-2.5 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>{p3Error}</p>
                        <button onClick={handlePhase3Start} className="flex items-center gap-2 w-full justify-center text-sm py-2.5 rounded-xl font-semibold"
                          style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#34d399" }}>
                          <RefreshCw size={14} />重新生成背景图
                        </button>
                      </div>
                    )}
                    {phaseStatuses[3] === "review" && (
                      <div className="space-y-3">
                        <div className="px-3 py-2.5 rounded-xl text-xs" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", color: "#fbbf24" }}>
                          在右侧点击选择一张背景图，再点击下方按钮开始融合
                        </div>
                        {p3Selected && (
                          <img src={outputUrl(p3Selected)} alt="已选背景" className="w-full rounded-xl object-cover"
                            style={{ aspectRatio: "16/9", border: "1.5px solid rgba(16,185,129,0.4)" }} />
                        )}
                        <button onClick={handleP3Confirm} disabled={!p3Selected}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all"
                          style={{ background: p3Selected ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.04)", border: p3Selected ? "1.5px solid rgba(52,211,153,0.4)" : "1px solid var(--border)", color: p3Selected ? "#34d399" : "var(--text-muted)", cursor: p3Selected ? "pointer" : "not-allowed" }}>
                          <Layers size={15} />使用选定背景，开始融合
                        </button>
                        <button onClick={handlePhase3Start} className="flex items-center gap-2 w-full justify-center text-xs py-2 rounded-xl"
                          style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                          <RefreshCw size={12} />重新生成
                        </button>
                      </div>
                    )}
                    {phaseStatuses[3] === "done" && (
                      <div className="space-y-2.5">
                        {p3Selected && (
                          <img src={outputUrl(p3Selected)} alt="已选背景" className="w-full rounded-xl object-cover"
                            style={{ aspectRatio: "16/9", border: "1px solid rgba(52,211,153,0.3)" }} />
                        )}
                        <p className="text-xs text-center" style={{ color: "#34d399" }}>✓ 背景图已选定</p>
                        <button onClick={() => setCurrentPhase(4)}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                          style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24" }}>
                          <Layers size={14} />进入融合成图
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Phase 4 ops */}
                {currentPhase === 4 && (
                  <div className="space-y-3">
                    {phaseStatuses[4] === "active" && !p4Error && p2Selected && p3Selected && (
                      <button onClick={() => handlePhase4Start(p2Selected, p3Selected)} className="btn-glow w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white">
                        <Layers size={15} />开始融合生成宣发图
                      </button>
                    )}
                    {phaseStatuses[4] === "running" && <MiniProgress value={p4Progress} label="AI 融合角色与背景中…" />}
                    {p4Error && (
                      <div className="space-y-2.5">
                        <p className="text-xs px-3 py-2.5 rounded-xl" style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>{p4Error}</p>
                        {p2Selected && p3Selected && (
                          <button onClick={() => handlePhase4Start(p2Selected, p3Selected)}
                            className="flex items-center gap-2 w-full justify-center text-sm py-2.5 rounded-xl font-semibold"
                            style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24" }}>
                            <RefreshCw size={14} />重新融合生成
                          </button>
                        )}
                      </div>
                    )}
                    {phaseStatuses[4] === "done" && (
                      <div className="px-3 py-3 rounded-xl" style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)" }}>
                        <p className="text-sm font-semibold" style={{ color: "#34d399" }}>已生成 {p4Files.length} 张宣发成品</p>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>可在右侧查看并下载</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Phase 5 ops */}
                {currentPhase === 5 && (
                  <div className="space-y-3">
                    <div className="px-4 py-3.5 rounded-2xl" style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)" }}>
                      <p className="text-sm font-bold" style={{ color: "#34d399" }}>宣发图生产完成</p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                        成品 {p4Files.length} 张 · 角色候选 {p2Files.length} 张 · 背景候选 {p3Files.length} 张
                      </p>
                    </div>
                    <button
                      onClick={() => (p4Selected.length ? p4Selected : p4Files).forEach((f, i) => setTimeout(() => {
                        const a = document.createElement("a"); a.href = dlUrl(f); a.download = fname(f);
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      }, i * 500))}
                      className="btn-glow w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold text-white"
                    >
                      <PackageOpen size={15} />下载宣发成品图
                    </button>
                    <button
                      onClick={() => [...p2Files, ...p3Files, ...p4Files].forEach((f, i) => setTimeout(() => {
                        const a = document.createElement("a"); a.href = dlUrl(f); a.download = fname(f);
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                      }, i * 500))}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ color: "#a78bfa", border: "1px solid rgba(139,92,246,0.3)" }}
                    >
                      <Download size={14} />下载全部素材
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ RIGHT OUTPUT PANEL ══════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: "var(--bg-base)" }}>

        <PipelineStepper phaseStatuses={phaseStatuses} rightView={rightView} setRightView={setRightView} />

        {/* Phase 1: onboarding */}
        {rightView === 1 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-7 p-12 select-none">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center"
              style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.12)" }}>
              <Layers size={42} style={{ color: "rgba(139,92,246,0.3)" }} />
            </div>
            <div className="text-center max-w-md">
              <p className="text-lg font-bold mb-3" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-rajdhani),sans-serif" }}>
                五阶段 AI 宣发图生产管线
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                在左侧配置任务参数，点击「开始生成」后 AI 将自动完成角色生成、背景生成、融合合成全流程。每个阶段完成后需人工审核选图。
              </p>
            </div>
            <div className="grid grid-cols-5 gap-3 w-full max-w-lg mt-2">
              {PHASE_DEFS.map((ph) => {
                const Icon = ph.icon;
                return (
                  <div key={ph.id} className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${ph.color}15`, border: `1px solid ${ph.color}30` }}>
                      <Icon size={18} color={ph.color} />
                    </div>
                    <p className="text-xs text-center font-medium" style={{ color: "var(--text-muted)", lineHeight: 1.3 }}>{ph.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Phase 2: character image grid */}
        {rightView === 2 && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between px-7 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>角色姿态候选图</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {p2Files.length > 0 ? `共 ${p2Files.length} 张，点击选择最佳角色图` : "AI 分析原画特征，批量生成宣发姿态候选"}
                </p>
              </div>
              {p2Files.length > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-xl font-semibold"
                  style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}>
                  {p2Files.length} 张
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-7">
              {phaseStatuses[2] === "running" && (
                <div className="space-y-6">
                  <MiniProgress value={p2Progress} label="AI 生成角色姿态图中…" />
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
                    {p2PartialFiles.map((f, i) => (
                      <motion.div key={f} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="rounded-2xl overflow-hidden relative"
                        style={{ aspectRatio: "1/1", border: "1.5px solid rgba(52,211,153,0.4)" }}>
                        <img src={outputUrl(f)} alt={`第 ${i + 1} 张`} className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 left-2 text-xs px-2 py-0.5 rounded-md font-semibold"
                          style={{ background: "rgba(52,211,153,0.25)", color: "#34d399", border: "1px solid rgba(52,211,153,0.4)" }}>
                          第 {i + 1} 张 ✓
                        </div>
                      </motion.div>
                    ))}
                    {Array.from({ length: Math.max(0, outputCount - p2PartialFiles.length) }).map((_, i) => (
                      <motion.div key={`sk-${i}`} className="rounded-2xl flex flex-col items-center justify-center gap-2.5"
                        style={{ aspectRatio: "1/1", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
                        animate={{ opacity: [0.45, 0.75, 0.45] }} transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.2 }}>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                          <Loader2 size={22} style={{ color: "var(--text-muted)" }} />
                        </motion.div>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          第 {p2PartialFiles.length + i + 1} 张生成中
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              {p2Files.length > 0 && !phaseStatuses[2].includes?.("running") && (
                <div className="space-y-4">
                  {!p2Confirmed && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs"
                      style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.18)", color: "#fbbf24" }}>
                      <AlertCircle size={13} />点击选择一张最佳角色图，然后在左侧操作栏确认通过
                    </div>
                  )}
                  <ImageGrid files={p2Files} selected={p2Selected}
                    onSelect={(f) => { if (!p2Confirmed) setP2Selected(f); }}
                    onLightbox={setLightbox} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phase 3: background image grid */}
        {rightView === 3 && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between px-7 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>背景场景候选图</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {p3Files.length > 0 ? `共 ${p3Files.length} 张，点击选择一张用于融合` : "生成不含角色的纯背景场景，为融合提供底图"}
                </p>
              </div>
              {p3Files.length > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-xl font-semibold"
                  style={{ background: "rgba(16,185,129,0.12)", color: "#34d399", border: "1px solid rgba(16,185,129,0.25)" }}>
                  {p3Files.length} 张
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-7">
              {phaseStatuses[3] === "running" && (
                <div className="space-y-6">
                  <MiniProgress value={p3Progress} label="AI 生成背景场景图中…" />
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                    {p3PartialFiles.map((f, i) => (
                      <motion.div key={f} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="rounded-2xl overflow-hidden relative"
                        style={{ aspectRatio: "16/9", border: "1.5px solid rgba(52,211,153,0.4)" }}>
                        <img src={outputUrl(f)} alt={`第 ${i + 1} 张`} className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 left-2 text-xs px-2 py-0.5 rounded-md font-semibold"
                          style={{ background: "rgba(52,211,153,0.25)", color: "#34d399", border: "1px solid rgba(52,211,153,0.4)" }}>
                          第 {i + 1} 张 ✓
                        </div>
                      </motion.div>
                    ))}
                    {Array.from({ length: Math.max(0, outputCount - p3PartialFiles.length) }).map((_, i) => (
                      <motion.div key={`sk-${i}`} className="rounded-2xl flex flex-col items-center justify-center gap-2.5"
                        style={{ aspectRatio: "16/9", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
                        animate={{ opacity: [0.45, 0.75, 0.45] }} transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.2 }}>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                          <Loader2 size={22} style={{ color: "var(--text-muted)" }} />
                        </motion.div>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          第 {p3PartialFiles.length + i + 1} 张生成中
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              {p3Files.length > 0 && (
                <div className="space-y-4">
                  {!p3Selected && (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs"
                      style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.18)", color: "#fbbf24" }}>
                      <AlertCircle size={13} />点击选择一张背景图，然后在左侧操作栏开始融合
                    </div>
                  )}
                  <ImageGrid files={p3Files} selected={p3Selected}
                    onSelect={(f) => { if (!p4TaskId) setP3Selected(f); }}
                    onLightbox={setLightbox} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Phase 4: fusion results */}
        {rightView === 4 && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between px-7 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>融合成图结果</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {p4Files.length > 0 ? `共 ${p4Files.length} 张宣发主视觉候选，可多选下载` : "将角色姿态图与背景场景图融合，输出宣发主视觉"}
                </p>
              </div>
              {p4Files.length > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-xl font-semibold"
                  style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.25)" }}>
                  {p4Files.length} 张
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-7">
              {p2Selected && p3Selected && p4Files.length === 0 && !p4Error && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>选定角色图</p>
                    <img src={outputUrl(p2Selected)} alt="角色" className="w-full rounded-2xl"
                      style={{ aspectRatio: "1/1", objectFit: "cover", border: "1px solid var(--border)" }} />
                  </div>
                  <div>
                    <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>选定背景图</p>
                    <img src={outputUrl(p3Selected)} alt="背景" className="w-full rounded-2xl"
                      style={{ aspectRatio: "1/1", objectFit: "cover", border: "1px solid var(--border)" }} />
                  </div>
                </div>
              )}
              {phaseStatuses[4] === "running" && (
                <div className="space-y-6">
                  <MiniProgress value={p4Progress} label="AI 融合角色与背景，生成宣发主视觉…" />
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                    {p4PartialFiles.map((f, i) => (
                      <motion.div key={f} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                        className="rounded-2xl overflow-hidden relative"
                        style={{ aspectRatio: "16/9", border: "1.5px solid rgba(245,158,11,0.4)" }}>
                        <img src={outputUrl(f)} alt={`第 ${i + 1} 张`} className="w-full h-full object-cover" />
                        <div className="absolute bottom-2 left-2 text-xs px-2 py-0.5 rounded-md font-semibold"
                          style={{ background: "rgba(245,158,11,0.2)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.35)" }}>
                          第 {i + 1} 张 ✓
                        </div>
                      </motion.div>
                    ))}
                    {Array.from({ length: Math.max(0, outputCount - p4PartialFiles.length) }).map((_, i) => (
                      <motion.div key={`sk-${i}`} className="rounded-2xl flex flex-col items-center justify-center gap-2.5"
                        style={{ aspectRatio: "16/9", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}
                        animate={{ opacity: [0.45, 0.75, 0.45] }} transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.2 }}>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                          <Loader2 size={22} style={{ color: "var(--text-muted)" }} />
                        </motion.div>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                          第 {p4PartialFiles.length + i + 1} 张生成中
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              {p4Files.length > 0 && (
                <ImageGrid files={p4Files} selected={p4Selected} multi
                  onSelect={(f) => setP4Selected((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f])}
                  onLightbox={setLightbox} />
              )}
            </div>
          </div>
        )}

        {/* Phase 5: delivery */}
        {rightView === 5 && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between px-7 py-4"
              style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>交付归档</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>宣发图全流程生产完成，预览并下载</p>
              </div>
              {p4Files.length > 0 && (
                <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-xl font-semibold"
                  style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
                  <CheckCircle2 size={12} />已完成
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-7 space-y-7">
              {p4Files.length > 0 && (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: "var(--text-muted)" }}>
                      宣发成品图 · 可多选下载
                    </p>
                    <ImageGrid files={p4Files} selected={p4Selected} multi
                      onSelect={(f) => setP4Selected((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f])}
                      onLightbox={setLightbox} />
                  </div>
                  {(p2Files.length > 0 || p3Files.length > 0) && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-muted)" }}>
                        全部素材（角色 + 背景）
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {[...p2Files, ...p3Files].map((f, i) => (
                          <div key={i} className="flex-shrink-0 w-28 rounded-xl overflow-hidden cursor-pointer"
                            style={{ border: "1px solid var(--border)" }}
                            onClick={() => setLightbox(outputUrl(f))}>
                            <img src={outputUrl(f)} alt="" className="w-full block hover:opacity-90 transition-opacity"
                              style={{ aspectRatio: "1/1", objectFit: "cover" }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
              {p4Files.length === 0 && phaseStatuses[5] === "locked" && (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <Lock size={32} style={{ color: "var(--text-muted)", opacity: 0.4 }} />
                  <p className="text-sm" style={{ color: "var(--text-muted)" }}>完成融合成图后，成品将在此交付</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(16px)" }}
            onClick={() => setLightbox(null)}>
            <button className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }} onClick={() => setLightbox(null)}>
              <X size={18} />
            </button>
            <img src={lightbox} alt="大图预览" className="rounded-2xl object-contain shadow-2xl"
              style={{ maxWidth: "min(90vw,1400px)", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
