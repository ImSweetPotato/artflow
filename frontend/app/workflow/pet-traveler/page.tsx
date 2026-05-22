"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, BookOpen, Check, ChevronDown, ClipboardList, Download, HelpCircle,
  ImageIcon, Lightbulb, Loader2, Play, RefreshCw, Settings2, SlidersHorizontal, Upload,
  Wand2, X, ZoomIn,
} from "lucide-react";
import { createTask, getTask, uploadFile } from "@/lib/api";
import { formatError } from "@/lib/format-error";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type RunPhase = "idle" | "submitting" | "running" | "done" | "error";
type WorkflowType = "all" | "text2image" | "image2image" | "edit";

interface HistoryEntry {
  id: string;
  phase: RunPhase;
  progress: number;
  prompt: string;
  imagePreview: string;
  outputFiles: string[];
  error: string;
  createdAt: Date;
}

const WORKFLOW_FILTERS: { id: WorkflowType; label: string; desc: string }[] = [
  { id: "all", label: "全部", desc: "展示所有工作流" },
  { id: "text2image", label: "文生图", desc: "无需参考图" },
  { id: "image2image", label: "图生图", desc: "基于参考图生成" },
  { id: "edit", label: "局部修改", desc: "保持主体，仅改指定区域" },
];

const PROMPT_TIP_SECTIONS = [
  {
    title: "基础修改",
    items: [
      "简单直接：把车的颜色改成红色",
      "保持风格：将画面改为白天，但保留原有绘画风格",
    ],
  },
  {
    title: "风格转换",
    intro: "原则：",
    items: [
      "明确命名风格：转换为包豪斯艺术风格",
      "描述风格特征：转换为油画风格，具有明显笔触和厚重的颜料质感",
      "保留构图：转为包豪斯风格，同时保持原始构图不变",
    ],
  },
  {
    title: "角色一致性",
    intro: "框架：",
    items: [
      "具体描述：使用“黑色短发的女人”，而不是“她”",
      "保留特征：保留相同的面部特征、发型和表情",
      "分步修改：先修改背景，再改变动作",
    ],
  },
  {
    title: "文本编辑",
    items: [
      "使用引号：将 'joy' 替换为 'BFL'",
      "保持格式：替换文本时保留相同的字体样式",
    ],
  },
];

const PROMPT_TIP_ISSUES = [
  {
    title: "角色变化过大",
    bad: "把这个人变成维京人",
    good: "将服装改为维京战士风格，同时保留原有的面部特征",
  },
  {
    title: "构图位置改变",
    bad: "把他放在沙滩上",
    good: "将背景更换为沙滩，人物保持完全相同的位置、比例和姿势",
  },
  {
    title: "风格应用不准确",
    bad: "变成素描风格",
    good: "转换为铅笔素描风格，带有自然石墨线条、交叉阴影和可见的纸张纹理",
  },
];

const PROMPT_TIP_PRINCIPLES = [
  "具体明确：使用精确的描述，避免模糊词汇",
  "分步编辑：将复杂的修改任务拆解成多个简单操作",
  "明确保留内容：清晰说明哪些部分必须保持不变",
  "动词选择准确：使用“更改”、“替换”而非“转换”这种模糊词",
];

const PROMPT_TIP_TEMPLATES = [
  "对象修改：将 [对象] 改为 [新状态]，保留 [要保持的内容] 不变",
  "风格转换：转换为 [具体风格]，同时保持 [构图/角色/其他要素] 不变",
  "背景替换：将背景更换为 [新背景]，主体保持完全相同的位置和姿势",
  "文本编辑：将 '[原始文本]' 替换为 '[新文本]'，保持字体风格一致",
];

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

function todayName() {
  const d = new Date();
  return `萌宠旅人_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
      {children}
    </p>
  );
}

function NumberInput({
  label,
  paramName,
  description,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  paramName?: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{label}</p>
          {paramName && (
            <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{paramName}</p>
          )}
        </div>
        {description && (
          <span
            title={description}
            className="mt-0.5 inline-flex w-5 h-5 items-center justify-center rounded-full flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
          >
            <HelpCircle size={12} />
          </span>
        )}
      </div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
        style={{ background: "var(--bg-surface-soft)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
      />
      {description && (
        <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {description}
        </p>
      )}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  paramName,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  paramName?: string;
  description?: string;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className="flex items-center justify-between gap-3 w-full rounded-xl px-3 py-2.5 text-sm"
        style={{ background: "var(--bg-surface-soft)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
      >
        <span className="min-w-0 text-left">
          <span className="block">{label}</span>
          {paramName && <span className="block text-[11px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{paramName}</span>}
        </span>
        <span
          className="relative rounded-full flex-shrink-0"
          style={{ width: 36, height: 20, background: checked ? "rgba(20,184,166,0.55)" : "rgba(255,255,255,0.1)", border: "1px solid var(--border)" }}
        >
          <span
            className="absolute top-0.5 rounded-full transition-all"
            style={{ width: 16, height: 16, left: checked ? 18 : 2, background: checked ? "#5eead4" : "var(--text-muted)" }}
          />
        </span>
      </button>
      {description && (
        <p className="mt-1.5 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {description}
        </p>
      )}
    </div>
  );
}

function PromptTipsPanel() {
  const [activeTipTab, setActiveTipTab] = useState<"write" | "avoid" | "template">("write");
  const [expanded, setExpanded] = useState(false);
  const tabs = [
    { id: "write" as const, label: "写法", icon: BookOpen },
    { id: "avoid" as const, label: "避坑", icon: AlertTriangle },
    { id: "template" as const, label: "模板", icon: ClipboardList },
  ];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(251,191,36,0.18)",
        boxShadow: "0 18px 48px rgba(0,0,0,0.18)",
      }}
    >
      <div
        className="px-4 py-3"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "linear-gradient(135deg, rgba(251,191,36,0.08), rgba(20,184,166,0.04))",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "var(--filter-gold-bg)", color: "var(--filter-gold-text)", border: "1px solid var(--filter-gold-border)" }}>
              <Lightbulb size={15} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                Flux Kontext 提示词技巧
              </h2>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                用更明确的指令保持画面一致性
              </p>
            </div>
          </div>
          <span className="text-[11px] px-2 py-1 rounded-full flex-shrink-0" style={{ color: "var(--filter-gold-text)", background: "var(--filter-gold-bg)", border: "1px solid var(--filter-gold-border)" }}>
            只读说明
          </span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 w-full rounded-xl px-3 py-2.5 text-xs font-semibold flex items-center justify-between gap-3 transition-all"
          style={{
            background: expanded ? "var(--filter-gold-bg)" : "rgba(255,255,255,0.04)",
            color: expanded ? "var(--filter-gold-text)" : "var(--text-secondary)",
            border: `1px solid ${expanded ? "var(--filter-gold-border)" : "var(--border)"}`,
          }}
        >
          <span className="text-left">
            <span className="block">{expanded ? "收起技巧" : "展开技巧"}</span>
            {!expanded && (
              <span className="block text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                查看写法、避坑和模板
              </span>
            )}
          </span>
          <ChevronDown size={14} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
        </button>

      </div>

      {expanded && (
        <>
          <div className="p-3">
            <div className="grid grid-cols-3 gap-1 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)" }}>
              {tabs.map((tab) => {
                const active = activeTipTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTipTab(tab.id)}
                    className="h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                    style={{
                      background: active ? "var(--filter-gold-bg)" : "transparent",
                      color: active ? "var(--filter-gold-text)" : "var(--text-secondary)",
                      border: active ? "1px solid var(--filter-gold-border)" : "1px solid transparent",
                      boxShadow: active ? "var(--filter-gold-shadow)" : "none",
                    }}
                  >
                    <Icon size={12} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-4 pb-4 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {activeTipTab === "write" && (
              <div className="space-y-3">
                <div className="grid gap-2">
                  {PROMPT_TIP_SECTIONS.map((section) => (
                    <section
                      key={section.title}
                      className="rounded-xl p-3"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}
                    >
                      <h3 className="font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>{section.title}</h3>
                      {section.items.slice(0, 2).map((item) => (
                        <p key={item} className="flex gap-2">
                          <span className="mt-2 w-1 h-1 rounded-full flex-shrink-0" style={{ background: "var(--filter-gold-text)" }} />
                          <span>{item}</span>
                        </p>
                      ))}
                      {section.items.length > 2 && (
                        <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                          关键点：保留构图，描述风格特征。
                        </p>
                      )}
                    </section>
                  ))}
                </div>

                <section className="rounded-xl p-3" style={{ background: "rgba(20,184,166,0.06)", border: "1px solid rgba(20,184,166,0.18)" }}>
                  <h3 className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>核心原则</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {PROMPT_TIP_PRINCIPLES.map((item) => (
                      <span key={item} className="px-2 py-1 rounded-full text-[11px] font-medium" style={{ background: "var(--filter-teal-bg)", color: "var(--filter-teal-text)", border: "1px solid var(--filter-teal-border)" }}>
                        {item.split("：")[0]}
                      </span>
                    ))}
                  </div>
                </section>
              </div>
            )}

            {activeTipTab === "avoid" && (
              <div className="space-y-2">
                {PROMPT_TIP_ISSUES.map((issue) => (
                  <div key={issue.title} className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{issue.title}</p>
                    <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.14)" }}>
                      <p className="text-[11px] font-semibold mb-0.5" style={{ color: "#f87171" }}>错误示例</p>
                      <p>{issue.bad}</p>
                    </div>
                    <div className="rounded-lg px-2.5 py-2" style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.14)" }}>
                      <p className="text-[11px] font-semibold mb-0.5" style={{ color: "#34d399" }}>正确示例</p>
                      <p>{issue.good}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTipTab === "template" && (
              <div className="space-y-2">
                {PROMPT_TIP_TEMPLATES.map((item) => (
                  <p key={item} className="rounded-xl px-3 py-2.5 text-[11px]" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                    {item}
                  </p>
                ))}
                <p className="rounded-xl px-3 py-2.5" style={{ background: "rgba(251,191,36,0.08)", color: "var(--text-primary)", border: "1px solid rgba(251,191,36,0.16)" }}>
                  描述越具体越好，Kontext 擅长理解详细、清晰的指令，并保持画面一致性。
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function PetTravelerWorkflowPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeFilter, setActiveFilter] = useState<WorkflowType>("all");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [taskName, setTaskName] = useState(todayName);
  const [prompt, setPrompt] = useState("白色背景，仅仅把角色的尾巴变为红色，其他不变。");
  const [outputCount, setOutputCount] = useState(1);
  const [seed, setSeed] = useState(-1);
  const [steps, setSteps] = useState(20);
  const [cfg, setCfg] = useState(1);
  const [denoise, setDenoise] = useState(1);
  const [guidance, setGuidance] = useState(2.5);
  const [matchImageSize, setMatchImageSize] = useState(true);

  const [runPhase, setRunPhase] = useState<RunPhase>("idle");
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState("");

  const disabled = runPhase === "submitting" || runPhase === "running";
  const visibleWorkflows = activeFilter === "text2image" ? [] : ["pet-traveler"];

  useEffect(() => {
    if (!currentTaskId) return;
    const poll = async () => {
      try {
        const t = await getTask(currentTaskId);
        setHistory((prev) => {
          const idx = prev.findIndex((entry) => entry.id === currentTaskId);
          if (idx === -1) return prev;
          const next = [...prev];
          if (t.status === "succeeded") {
            const out = (t.output ?? {}) as { output_files?: string[] };
            next[idx] = { ...next[idx], phase: "done", progress: 100, outputFiles: out.output_files ?? [] };
            setRunPhase("done");
            setCurrentTaskId(null);
          } else if (t.status === "failed") {
            next[idx] = { ...next[idx], phase: "error", error: formatError(t.error_message, "ComfyUI 生成失败") };
            setError(formatError(t.error_message, "ComfyUI 生成失败"));
            setRunPhase("error");
            setCurrentTaskId(null);
          } else {
            next[idx] = { ...next[idx], phase: "running", progress: t.progress ?? 0 };
            setRunPhase("running");
          }
          return next;
        });
      } catch {}
    };
    poll();
    const timer = setInterval(poll, 2500);
    return () => clearInterval(timer);
  }, [currentTaskId]);

  const handleFile = useCallback((file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (!imageFile) {
      setError("请先上传一张参考图。这个 ComfyUI 工作流使用 LoadImage 节点，当前不支持纯文生图。");
      return;
    }
    if (!prompt.trim()) {
      setError("请填写提示词。");
      return;
    }

    setRunPhase("submitting");
    try {
      const uploaded = await uploadFile(imageFile);
      const params = {
        task_name: taskName.trim() || todayName(),
        image_path: uploaded.path,
        prompt: prompt.trim(),
        output_count: outputCount,
        seed,
        steps,
        cfg,
        denoise,
        guidance,
        sampler_name: "euler",
        scheduler: "simple",
        from_translate: "chinese (simplified)",
        to_translate: "english",
        translation_service: "GoogleTranslator",
        stitch_direction: "right",
        match_image_size: matchImageSize,
        spacing_width: 0,
        spacing_color: "white",
      };
      const { task_id } = await createTask("comfyui_pet_traveler", params);
      setHistory((prev) => [{
        id: task_id,
        phase: "running",
        progress: 0,
        prompt,
        imagePreview,
        outputFiles: [],
        error: "",
        createdAt: new Date(),
      }, ...prev]);
      setCurrentTaskId(task_id);
      setRunPhase("running");
    } catch (e) {
      setRunPhase("error");
      setError(formatError(e, "提交失败"));
    }
  };

  return (
    <>
      <div className="w-full max-w-[1600px] space-y-5">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-rajdhani), sans-serif", color: "var(--text-primary)" }}>
            ComfyUI 工作流
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            萌宠旅人 · 固定化工作流
          </p>
        </div>

        <div className="rounded-2xl p-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal size={15} style={{ color: "#2dd4bf" }} />
            <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>工作流筛选</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {WORKFLOW_FILTERS.map((filter) => {
              const active = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className="px-3.5 py-2 rounded-full text-xs font-medium transition-all"
                  title={filter.desc}
                  style={{
                    background: active ? "var(--filter-teal-bg)" : "var(--bg-surface-soft)",
                    color: active ? "var(--filter-teal-text)" : "var(--text-secondary)",
                    border: `${active ? "1.5px" : "1px"} solid ${active ? "var(--filter-teal-border)" : "var(--border)"}`,
                    boxShadow: active ? "var(--filter-teal-shadow)" : "none",
                  }}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        {visibleWorkflows.length === 0 ? (
          <div className="rounded-2xl p-12 text-center" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
            当前工作流包含 LoadImage 节点，暂不属于纯文生图。
          </div>
        ) : (
          <div className="grid lg:grid-cols-[420px_minmax(0,1fr)] 2xl:grid-cols-[420px_minmax(0,1fr)_340px] gap-5 items-start">
            <div className="space-y-4">
              <div className="rounded-2xl overflow-hidden" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2">
                    <Wand2 size={16} style={{ color: "#2dd4bf" }} />
                    <div>
                      <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>萌宠旅人</h2>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>图生图 / 局部修改</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: "var(--filter-teal-bg)", color: "var(--filter-teal-text)", border: "1px solid var(--filter-teal-border)" }}>
                    Flux Kontext
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  <label className="block">
                    <FieldLabel>任务名称</FieldLabel>
                    <input
                      value={taskName}
                      onChange={(e) => setTaskName(e.target.value)}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      style={{ background: "var(--bg-surface-soft)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    />
                  </label>

                  <div>
                    <FieldLabel>加载图片</FieldLabel>
                    {imagePreview ? (
                      <div className="relative rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.2)" }}>
                        <img src={imagePreview} alt="参考图" className="w-full block object-contain" style={{ maxHeight: 260 }} />
                        <button
                          type="button"
                          onClick={() => { setImageFile(null); setImagePreview(""); }}
                          className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="w-full rounded-2xl p-8 flex flex-col items-center justify-center gap-2 transition-all"
                        style={{ border: "1.5px dashed var(--border)", background: "rgba(255,255,255,0.02)", color: "var(--text-secondary)" }}
                      >
                        <Upload size={20} style={{ color: "#38bdf8" }} />
                        <span className="text-sm font-medium">拖拽或点击上传参考图</span>
                        <span className="text-xs" style={{ color: "var(--text-muted)" }}>JPG / PNG / WEBP</span>
                      </button>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </div>

                  <label className="block">
                    <FieldLabel>提示词</FieldLabel>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={5}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                      style={{ background: "var(--bg-surface-soft)", border: "1px solid var(--border)", color: "var(--text-primary)", lineHeight: 1.7 }}
                    />
                  </label>

                  <NumberInput
                    label="生成数量"
                    paramName="output_count"
                    description="同一组参数连续提交的出图次数。数量越多，等待时间和 ComfyUI 队列占用越高。"
                    value={outputCount}
                    min={1}
                    max={4}
                    onChange={setOutputCount}
                  />

                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((v) => !v)}
                    className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  >
                    <span className="flex items-center gap-2"><Settings2 size={14} />高级参数设置</span>
                    <span style={{ color: "var(--text-muted)" }}>{advancedOpen ? "收起" : "展开"}</span>
                  </button>

                  {advancedOpen && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <NumberInput
                          label="采样步数"
                          paramName="Steps"
                          description="控制采样迭代次数。更高通常细节更充分，但耗时更长；当前工作流 16-30 较常用。"
                          value={steps}
                          min={1}
                          max={80}
                          onChange={setSteps}
                        />
                        <NumberInput
                          label="随机种子"
                          paramName="Seed"
                          description="控制随机性。填 -1 表示每次随机；固定同一个值更利于复现或微调同一方向。"
                          value={seed}
                          min={-1}
                          step={1}
                          onChange={setSeed}
                        />
                        <NumberInput
                          label="提示词相关性"
                          paramName="CFG"
                          description="控制模型服从提示词的力度。Flux 类工作流通常不需要太高，过高可能让画面发硬或偏离参考图。"
                          value={cfg}
                          min={0}
                          max={20}
                          step={0.1}
                          onChange={setCfg}
                        />
                        <NumberInput
                          label="重绘强度"
                          paramName="Denoise"
                          description="控制对参考图的改动幅度。越低越保守，越高越容易重绘；局部修改建议先从 0.55-0.85 试。"
                          value={denoise}
                          min={0}
                          max={1}
                          step={0.05}
                          onChange={setDenoise}
                        />
                        <NumberInput
                          label="Flux 引导强度"
                          paramName="Guidance"
                          description="对应 FluxGuidance 节点，影响提示词条件对结果的引导强弱。过高可能削弱参考图稳定性。"
                          value={guidance}
                          min={0}
                          max={20}
                          step={0.1}
                          onChange={setGuidance}
                        />
                        <div>
                          <FieldLabel>尺寸匹配</FieldLabel>
                          <Toggle
                            checked={matchImageSize}
                            onChange={setMatchImageSize}
                            label="匹配图片尺寸"
                            paramName="match_image_size"
                            description="来自 ImageStitch 节点。开启后拼接/送入后续节点时尽量匹配参考图尺寸，通常建议保持开启。"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.25)" }}>
                      {error}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={disabled}
                    onClick={handleSubmit}
                    className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold transition-all"
                    style={{
                      background: disabled ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#14b8a6,#38bdf8)",
                      color: disabled ? "var(--text-muted)" : "#03131a",
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {disabled ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                    {disabled ? "生成中..." : "提交 ComfyUI 工作流"}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl p-4 min-h-[360px]" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>生成记录</h2>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>本页提交的 ComfyUI 任务会显示在这里</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistory([])}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                    style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                  >
                    <RefreshCw size={12} />清空
                  </button>
                </div>

                {history.length === 0 ? (
                  <div className="h-[280px] rounded-2xl flex flex-col items-center justify-center text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed var(--border)", color: "var(--text-muted)" }}>
                    <ImageIcon size={28} />
                    <p className="mt-3 text-sm">还没有生成记录</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((entry) => {
                      const running = entry.phase === "running" || entry.phase === "submitting";
                      return (
                        <div key={entry.id} className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "rgba(255,255,255,0.02)" }}>
                          <div className="p-3 flex items-start gap-3" style={{ borderBottom: entry.outputFiles.length ? "1px solid var(--border)" : "none" }}>
                            <img src={entry.imagePreview} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" style={{ border: "1px solid var(--border)" }} />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs line-clamp-2" style={{ color: "var(--text-secondary)" }}>{entry.prompt}</p>
                              <p className="text-xs mt-1 font-mono truncate" style={{ color: "var(--text-muted)" }}>{entry.id}</p>
                            </div>
                            <div className="flex-shrink-0">
                              {running && (
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs" style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8" }}>
                                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                                    <Loader2 size={11} />
                                  </motion.div>
                                  {entry.progress}%
                                </div>
                              )}
                              {entry.phase === "done" && (
                                <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: "rgba(52,211,153,0.1)", color: "#34d399" }}>
                                  <Check size={11} />{entry.outputFiles.length}张
                                </div>
                              )}
                              {entry.phase === "error" && (
                                <div className="px-2 py-1 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.1)", color: "#f87171" }}>
                                  失败
                                </div>
                              )}
                            </div>
                          </div>

                          {running && (
                            <div className="px-3 pb-3">
                              <div className="w-full rounded-full h-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                                <div className="h-1 rounded-full transition-all" style={{ width: `${entry.progress}%`, background: "linear-gradient(90deg,#14b8a6,#38bdf8)" }} />
                              </div>
                            </div>
                          )}

                          {entry.error && (
                            <div className="px-3 pb-3 text-xs" style={{ color: "#f87171" }}>{entry.error}</div>
                          )}

                          {entry.outputFiles.length > 0 && (
                            <div className="p-3 grid grid-cols-2 gap-2">
                              {entry.outputFiles.map((file, index) => {
                                const url = outputUrl(file);
                                return (
                                  <div key={file} className="relative rounded-xl overflow-hidden group" style={{ border: "1px solid var(--border)" }}>
                                    <img src={url} alt={`结果 ${index + 1}`} className="w-full block" />
                                    <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.55)" }}>
                                      <button
                                        type="button"
                                        onClick={() => setLightbox(url)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-white"
                                        style={{ background: "rgba(255,255,255,0.15)" }}
                                      >
                                        <ZoomIn size={11} />放大
                                      </button>
                                      <a
                                        href={dlUrl(file)}
                                        download={fname(file)}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-white"
                                        style={{ background: "rgba(20,184,166,0.45)" }}
                                      >
                                        <Download size={11} />下载
                                      </a>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <aside
              className="lg:col-span-2 2xl:col-span-1 2xl:sticky 2xl:top-24"
            >
              <PromptTipsPanel />
            </aside>
          </div>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.92)" }} onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}>
            <X size={16} />
          </button>
          <img src={lightbox} alt="查看大图" className="max-w-full max-h-full rounded-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
