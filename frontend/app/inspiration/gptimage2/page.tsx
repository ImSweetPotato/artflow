"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Copy, Check, Zap, Star, Trash2, ChevronDown, ChevronUp, X, Globe, Lock, Users } from "lucide-react";
import {
  INSPIRATION_CASES,
  CATEGORIES,
  InspirationCase,
  BusinessFilter,
  getBusinessTags,
  getCategoryLabel,
  getDisplayPrompt,
  getDisplayTitle,
  getImageUrl,
  hasTranslatedPrompt,
  matchesBusinessFilter,
} from "@/lib/inspiration-data";
import { useFeatured } from "@/hooks/useFeatured";
import { useCustomCategories } from "@/hooks/useCustomCategories";
import { useProjectCategories } from "@/hooks/useProjectCategories";
import { useBrowseOnlyMode } from "@/hooks/useBrowseOnlyMode";
import { useAuth } from "@/contexts/AuthContext";
import { AdminFeatured } from "@/lib/api";

const CATEGORY_COLORS: Record<string, { bg: string; color: string; border: string; glow: string }> = {
  portrait:   { bg: "rgba(244,114,182,0.12)", color: "#f472b6", border: "rgba(244,114,182,0.35)", glow: "rgba(244,114,182,0.2)" },
  poster:     { bg: "rgba(96,165,250,0.12)",  color: "#60a5fa", border: "rgba(96,165,250,0.35)",  glow: "rgba(96,165,250,0.2)" },
  character:  { bg: "rgba(52,211,153,0.12)",  color: "#34d399", border: "rgba(52,211,153,0.35)",  glow: "rgba(52,211,153,0.2)" },
  ui:         { bg: "rgba(251,191,36,0.12)",  color: "#fbbf24", border: "rgba(251,191,36,0.35)",  glow: "rgba(251,191,36,0.2)" },
  comparison: { bg: "rgba(251,146,60,0.12)",  color: "#fb923c", border: "rgba(251,146,60,0.35)",  glow: "rgba(251,146,60,0.2)" },
  ecommerce:  { bg: "rgba(139,92,246,0.12)",  color: "#a78bfa", border: "rgba(139,92,246,0.35)",  glow: "rgba(139,92,246,0.2)" },
  "ad-creative": { bg: "rgba(45,212,191,0.12)", color: "#2dd4bf", border: "rgba(45,212,191,0.35)", glow: "rgba(45,212,191,0.2)" },
};

// 自定义分类按创建顺序循环分配亮色
const CUSTOM_PALETTE: Array<{ bg: string; color: string; border: string; glow: string }> = [
  { bg: "rgba(251,191,36,0.15)",  color: "#fde68a", border: "rgba(251,191,36,0.5)",  glow: "rgba(251,191,36,0.25)" },
  { bg: "rgba(52,211,153,0.15)",  color: "#6ee7b7", border: "rgba(52,211,153,0.5)",  glow: "rgba(52,211,153,0.25)" },
  { bg: "rgba(249,115,22,0.15)",  color: "#fdba74", border: "rgba(249,115,22,0.5)",  glow: "rgba(249,115,22,0.25)" },
  { bg: "rgba(236,72,153,0.15)",  color: "#f9a8d4", border: "rgba(236,72,153,0.5)",  glow: "rgba(236,72,153,0.25)" },
  { bg: "rgba(99,102,241,0.15)",  color: "#c7d2fe", border: "rgba(99,102,241,0.5)",  glow: "rgba(99,102,241,0.25)" },
  { bg: "rgba(20,184,166,0.15)",  color: "#99f6e4", border: "rgba(20,184,166,0.5)",  glow: "rgba(20,184,166,0.25)" },
];

function pickGridColumns(width: number): 1 | 2 | 4 | 5 {
  const candidates: Array<1 | 2 | 4 | 5> = [5, 4, 2, 1];
  const gap = 20;
  const minCardWidth = 250;
  for (const cols of candidates) {
    const cardWidth = (width - gap * (cols - 1)) / cols;
    if (cardWidth >= minCardWidth) return cols;
  }
  return 1;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // HTTP 环境降级方案
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all flex-1"
      style={{
        background: copied ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.05)",
        color: copied ? "#34d399" : "var(--text-secondary)",
        border: `1px solid ${copied ? "rgba(52,211,153,0.35)" : "var(--border)"}`,
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "已复制" : "复制提示词"}
    </button>
  );
}

function CardDetailModal({
  item,
  cat,
  onClose,
  onGenerate,
  onRemove,
  onTitleSave,
}: {
  item: InspirationCase;
  cat: { bg: string; color: string; border: string; glow: string };
  onClose: () => void;
  onGenerate: () => boolean | void;
  onRemove?: () => void;
  onTitleSave?: (title: string) => void;
}) {
  const imgUrl = getImageUrl(item);
  const displayTitle = getDisplayTitle(item);
  const displayPrompt = getDisplayPrompt(item);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);

  const commitTitle = () => {
    const t = titleDraft.trim() || item.title;
    setTitleDraft(t);
    onTitleSave?.(t);
    setEditingTitle(false);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
        style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(18px)" }}
        onClick={onClose}
      >
        <div
          className="relative w-full rounded-2xl overflow-hidden flex flex-col md:flex-row"
          style={{
            maxWidth: 960,
            maxHeight: "90vh",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            boxShadow: `0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px ${cat.border}`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 关闭按钮 */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all"
            style={{ background: "rgba(0,0,0,0.6)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <X size={14} />
          </button>

          {/* 左侧：生成结果图（可点击放大） */}
          <div
            className="relative flex-shrink-0 overflow-hidden group cursor-zoom-in"
            style={{ width: "100%", maxWidth: 420, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setLightbox(imgUrl)}
          >
            <img
              src={imgUrl}
              alt={item.title}
              className="w-full transition-transform duration-300 group-hover:scale-105"
              style={{ display: "block", maxHeight: "90vh", objectFit: "contain" }}
            />
            {/* 分类标签 */}
            <span
              className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5"
              style={{ background: "rgba(0,0,0,0.72)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", backdropFilter: "blur(12px)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
              {getCategoryLabel(item.category, item.categoryLabel)}
            </span>
            {item.isFeatured && (
              <span
                className="absolute top-3 right-10 px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"
                style={{ background: "rgba(251,191,36,0.25)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.5)", backdropFilter: "blur(10px)" }}
              >
                <Star size={9} />精选
              </span>
            )}
            {/* 放大提示覆层 */}
            <div
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ background: "rgba(0,0,0,0.25)" }}
            >
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white" style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)" }}>
                <Search size={12} />点击放大
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 px-3 py-2 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }}>
              <p className="text-xs text-white font-medium truncate">{displayTitle}</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{item.author}</p>
            </div>
          </div>

          {/* 右侧：详情 */}
          <div className="flex flex-col flex-1 min-w-0 overflow-y-auto" style={{ maxHeight: "90vh" }}>
            {/* 标题区 */}
            <div className="px-5 pt-5 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
              {editingTitle ? (
                <input
                  autoFocus
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitTitle();
                    if (e.key === "Escape") { setTitleDraft(item.title); setEditingTitle(false); }
                  }}
                  className="w-full text-base font-bold leading-snug mb-0.5 pr-8 rounded-lg px-2 py-0.5 outline-none"
                  style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.4)", color: "var(--text-primary)" }}
                />
              ) : (
                <h2
                  className="text-base font-bold leading-snug mb-0.5 pr-8 rounded cursor-text select-text"
                  style={{ color: "var(--text-primary)" }}
                  onDoubleClick={() => { if (onTitleSave) { setTitleDraft(item.title); setEditingTitle(true); } }}
                  title={onTitleSave ? "双击编辑标题" : undefined}
                >
                  {editingTitle ? titleDraft : displayTitle}
                </h2>
              )}
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.author}</p>
            </div>

            <div className="p-5 space-y-5 flex-1">

              {/* 参考图 —— 若有则醒目展示 */}
              {item.refImageUrl && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2.5" style={{ color: "var(--text-muted)" }}>
                    创作参考图
                  </p>
                  <div
                    className="relative group cursor-zoom-in rounded-xl overflow-hidden"
                    style={{
                      border: `1px solid ${cat.border}`,
                      boxShadow: `0 0 16px ${cat.glow}`,
                      background: "rgba(0,0,0,0.3)",
                    }}
                    onClick={() => setLightbox(item.refImageUrl!)}
                  >
                    <img
                      src={item.refImageUrl}
                      alt="创作参考图"
                      className="w-full transition-transform duration-300 group-hover:scale-105"
                      style={{ display: "block", maxHeight: 320, objectFit: "contain" }}
                      onError={(e) => { (e.currentTarget.parentElement as HTMLDivElement).style.display = "none"; }}
                    />
                    {/* 放大提示覆层 */}
                    <div
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      style={{ background: "rgba(0,0,0,0.25)" }}
                    >
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white" style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)" }}>
                        <Search size={12} />点击放大
                      </div>
                    </div>
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-semibold pointer-events-none" style={{ background: "rgba(0,0,0,0.65)", color: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)" }}>
                      参考图
                    </div>
                  </div>
                </div>
              )}

              {/* 提示词 */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>提示词</p>
                <div
                  className="rounded-xl p-3 text-xs leading-relaxed select-text"
                  style={{ background: "var(--prompt-bg)", border: "1px solid var(--border)", color: "var(--text-primary)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                >
                  {displayPrompt}
                </div>
                {hasTranslatedPrompt(item) && (
                  <p className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    当前展示为中文译文，复制和一键生图仍使用原始提示词。
                  </p>
                )}
              </div>

              {/* 分类 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: cat.bg, color: cat.color, border: `1px solid ${cat.border}` }}
                >
                  {getCategoryLabel(item.category, item.categoryLabel)}
                </span>
              </div>
            </div>

            {/* 底部操作 */}
            <div className="p-4 flex gap-2" style={{ borderTop: "1px solid var(--border)" }}>
              <CopyButton text={item.prompt} />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const shouldClose = onGenerate();
                  if (shouldClose !== false) onClose();
                }}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all flex-1"
                style={{ background: "var(--filter-purple-bg)", color: "var(--filter-purple-text)", border: "1px solid var(--filter-purple-border)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--filter-purple-bg)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--filter-purple-shadow)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--filter-purple-bg)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
              >
                <Zap size={12} />一键生图
              </button>
              {item.isFeatured && onRemove && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(); onClose(); }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.18)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)"; }}
                >
                  <Trash2 size={12} />移除精选
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 图片 Lightbox（覆盖在弹窗之上） */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.95)", backdropFilter: "blur(20px)" }}
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full"
            style={{ background: "rgba(255,255,255,0.12)", color: "#fff" }}
            onClick={() => setLightbox(null)}
          >
            <X size={16} />
          </button>
          <img
            src={lightbox}
            alt="查看大图"
            className="rounded-2xl object-contain shadow-2xl"
            style={{ maxWidth: "min(92vw, 1400px)", maxHeight: "92vh" }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function CaseCard({
  item,
  onCardClick,
  onRemove,
  customPaletteIndex,
}: {
  item: InspirationCase;
  onCardClick: () => void;
  onRemove?: (id: string) => void;
  customPaletteIndex?: number;
}) {
  const router = useRouter();
  const { isBrowseOnly, blockCreateAction } = useBrowseOnlyMode();
  const cat = CATEGORY_COLORS[item.category]
    ?? (customPaletteIndex !== undefined ? CUSTOM_PALETTE[customPaletteIndex % CUSTOM_PALETTE.length] : null)
    ?? { bg: "rgba(255,255,255,0.08)", color: "var(--text-muted)", border: "var(--border)", glow: "transparent" };
  const imgUrl = getImageUrl(item);
  const displayTitle = getDisplayTitle(item);
  const displayPrompt = getDisplayPrompt(item);
  const businessTags = getBusinessTags(item);
  const cardRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  const handleMouseEnter = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = "translateY(-6px) scale(1.02)";
    card.style.boxShadow = `0 20px 40px rgba(0,0,0,0.35), 0 0 0 1.5px ${cat.border}, 0 0 30px ${cat.glow}`;
    card.style.borderColor = cat.border;
  }, [cat]);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = "";
    card.style.boxShadow = "";
    card.style.borderColor = "var(--border)";
  }, []);

  const handleGenerate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBrowseOnly) {
      blockCreateAction("当前为案例浏览模式，若要一键生图，请先补充 SOFUNNY_API_KEY。");
      return;
    }
    const params = new URLSearchParams({ prompt: item.prompt });
    if (item.refImageUrl) params.set("refImage", item.refImageUrl);
    router.push(`/create/gptimage2?${params.toString()}`);
  };

  const isLong = displayPrompt.length > 120;

  return (
    <div
      ref={cardRef}
      className="rounded-2xl overflow-hidden flex flex-col cursor-pointer"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--panel-shadow)",
        transition: "transform 0.25s cubic-bezier(.23,1,.32,1), box-shadow 0.25s cubic-bezier(.23,1,.32,1), border-color 0.2s",
        willChange: "transform",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onCardClick}
    >
      {/* 图片区 */}
      <div
        className="relative overflow-hidden flex-shrink-0"
        style={{ aspectRatio: "16 / 10", background: "rgba(10,10,12,0.9)" }}
      >
        <img
          src={imgUrl}
          alt={displayTitle}
          className="w-full h-full object-cover transition-transform duration-500"
          style={{ transformOrigin: "center" }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-20 pointer-events-none"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)" }}
        />
        <span
          className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5"
          style={{ background: "rgba(0,0,0,0.72)", color: "#fff", border: "1px solid rgba(255,255,255,0.18)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cat.color }} />
          {getCategoryLabel(item.category, item.categoryLabel)}
        </span>
        {item.isFeatured && (
          <span
            className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1"
            style={{
              background: (item as InspirationCase & { _isPublicFeatured?: boolean })._isPublicFeatured
                ? "rgba(52,211,153,0.2)" : "rgba(251,191,36,0.2)",
              color: (item as InspirationCase & { _isPublicFeatured?: boolean })._isPublicFeatured
                ? "#34d399" : "#fbbf24",
              border: `1px solid ${(item as InspirationCase & { _isPublicFeatured?: boolean })._isPublicFeatured
                ? "rgba(52,211,153,0.4)" : "rgba(251,191,36,0.4)"}`,
              backdropFilter: "blur(10px)",
            }}
          >
            {(item as InspirationCase & { _isPublicFeatured?: boolean })._isPublicFeatured
              ? <><Globe size={9} />公共精选</>
              : <><Star size={9} />我的精选</>
            }
          </span>
        )}
        {businessTags.length > 0 && (
          <div className="absolute left-3 bottom-3 flex flex-wrap gap-1.5">
            {businessTags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  background: "rgba(0,0,0,0.66)",
                  color: tag === "game" ? "#6ee7b7" : tag === "ui" ? "#fde68a" : "#99f6e4",
                  border: `1px solid ${tag === "game" ? "rgba(110,231,183,0.35)" : tag === "ui" ? "rgba(253,230,138,0.35)" : "rgba(153,246,228,0.35)"}`,
                }}
              >
                {tag === "game" ? "游戏" : tag === "ui" ? "UI" : "宣发"}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 内容区 */}
      <div className="p-3.5 flex flex-col gap-2.5 flex-1">
        {/* 标题 + 作者 */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[13px] font-semibold leading-snug" style={{ color: "var(--text-primary)" }}>
            {displayTitle}
          </h3>
          <span className="text-xs flex-shrink-0 pt-0.5" style={{ color: "var(--text-muted)" }}>{item.author}</span>
        </div>

        {/* 提示词（可展开） */}
        <div className="flex flex-col gap-1">
          <p
            className="text-[12px] leading-relaxed"
            style={{
              color: "var(--text-muted)",
              ...(expanded ? {} : {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 3,
                overflow: "hidden",
              }),
            }}
          >
            {displayPrompt}
          </p>
          {isLong && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="flex items-center gap-1 text-xs self-start mt-0.5 transition-opacity hover:opacity-80"
              style={{ color: cat.color }}
            >
              {expanded ? <><ChevronUp size={11} />收起</> : <><ChevronDown size={11} />展开全文</>}
            </button>
          )}
        </div>

        {/* 操作栏 */}
        <div className="flex gap-2 mt-auto pt-1" onClick={(e) => e.stopPropagation()}>
          <CopyButton text={item.prompt} />
          <button
            onClick={handleGenerate}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all flex-1"
            style={{ background: "var(--filter-purple-bg)", color: "var(--filter-purple-text)", border: "1px solid var(--filter-purple-border)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--filter-purple-bg)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--filter-purple-shadow)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--filter-purple-bg)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
          >
            <Zap size={12} />一键生图
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InspirationGptImage2Page() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [detailItem, setDetailItem] = useState<{ item: InspirationCase; customIdx: number } | null>(null);
  const [page, setPage] = useState(1);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [businessFilter, setBusinessFilter] = useState<BusinessFilter>("game");
  const [gridCols, setGridCols] = useState<1 | 2 | 4 | 5>(4);
  const { publicFeatured, myFeatured, adminAll, loadAdminAll, removeFeatured, updateFeaturedTitle, publishFeatured, unpublishFeatured } = useFeatured();
  const { customCategories } = useCustomCategories();
  const { projectCategories } = useProjectCategories();
  const { isBrowseOnly, blockCreateAction } = useBrowseOnlyMode();
  const { user } = useAuth();
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 20;

  const MY_FEATURED_KEY = "__my_featured__";
  const PUBLIC_FEATURED_KEY = "__public_featured__";

  const publicFeaturedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of publicFeatured) {
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    return counts;
  }, [publicFeatured]);

  const publicFeaturedCategories = useMemo(() => {
    return projectCategories.map((cat) => ({
      key: cat.key,
      label: cat.label,
      count: publicFeaturedCounts.get(cat.key) ?? 0,
    }));
  }, [projectCategories, publicFeaturedCounts]);

  // 当前 activeCategory 是否属于「公共精选分类」行
  const isPublicFeaturedCat = activeCategory === PUBLIC_FEATURED_KEY
    || publicFeaturedCategories.some((c) => c.key === activeCategory);

  const allCases = useMemo(() => [...INSPIRATION_CASES], []);

  const presetCategoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of allCases) {
      if (!matchesBusinessFilter(item, businessFilter)) continue;
      counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    }
    return CATEGORIES.filter((cat) => cat.key === "" || (counts.get(cat.key) ?? 0) > 0).map((cat) => ({
      ...cat,
      count: cat.key === "" ? [...counts.values()].reduce((sum, n) => sum + n, 0) : (counts.get(cat.key) ?? 0),
    }));
  }, [allCases, businessFilter]);

  useEffect(() => {
    const isPresetCategory = CATEGORIES.some((cat) => cat.key === activeCategory);
    if (!isPresetCategory || activeCategory === "") return;
    const stillVisible = presetCategoryOptions.some((cat) => cat.key === activeCategory);
    if (!stillVisible) {
      setActiveCategory("");
      setPage(1);
    }
  }, [activeCategory, presetCategoryOptions]);

  useEffect(() => {
    const node = gridRef.current;
    if (!node) return;

    const updateGrid = () => {
      const next = pickGridColumns(node.clientWidth);
      setGridCols((prev) => prev === next ? prev : next);
    };

    updateGrid();
    const observer = new ResizeObserver(updateGrid);
    observer.observe(node);
    window.addEventListener("resize", updateGrid);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateGrid);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let pool: InspirationCase[];
    const isCustomCat = customCategories.some((c) => c.key === activeCategory);
    const isOwnedFeaturedCat = activeCategory === MY_FEATURED_KEY || isCustomCat;
    const skipBusinessFilter = isPublicFeaturedCat || isOwnedFeaturedCat;

    if (activeCategory === MY_FEATURED_KEY) {
      pool = myFeatured;
    } else if (activeCategory === PUBLIC_FEATURED_KEY) {
      pool = publicFeatured as InspirationCase[];
    } else if (isPublicFeaturedCat) {
      // 公共精选分类中某个具体分类被选中
      pool = (publicFeatured as InspirationCase[]).filter((c) => c.category === activeCategory);
    } else if (isCustomCat) {
      // 自定义分类：从用户自己的精选里取（自定义分类的卡片就在 myFeatured 里）
      pool = myFeatured.filter((c) => c.category === activeCategory);
    } else {
      pool = [...allCases, ...publicFeatured.map((c) => ({ ...c, _isPublicFeatured: true } as InspirationCase))];
    }
    return pool.filter((c) => {
      const matchCat = !activeCategory
        || isPublicFeaturedCat
        || isCustomCat
        || activeCategory === MY_FEATURED_KEY
        || c.category === activeCategory;
      const displayTitle = getDisplayTitle(c).toLowerCase();
      const displayPrompt = getDisplayPrompt(c).toLowerCase();
      const matchSearch = !q || displayTitle.includes(q) || displayPrompt.includes(q) || c.title.toLowerCase().includes(q) || c.prompt.toLowerCase().includes(q) || c.author.toLowerCase().includes(q);
      const matchBusiness = skipBusinessFilter ? true : matchesBusinessFilter(c, businessFilter);
      return matchCat && matchSearch && matchBusiness;
    });
  }, [search, activeCategory, allCases, myFeatured, publicFeatured, isPublicFeaturedCat, customCategories, businessFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // 筛选条件变化时回到第 1 页
  const resetPage = useCallback(() => setPage(1), []);
  const handleSearchChange = (v: string) => { setSearch(v); resetPage(); };
  const handleCategoryChange = (k: string) => { setActiveCategory(k); resetPage(); };
  const handleBusinessFilterChange = (next: BusinessFilter) => { setBusinessFilter(next); resetPage(); };

  return (
    <>
      {/* 整体不设 max-width，撑满 main 区域 */}
      <div className="space-y-6">

        {/* ── 顶部 Header 卡片 ── */}
        <div
          className="rounded-2xl p-6"
          style={{ background: "var(--hero-panel-bg)", border: "1px solid var(--hero-panel-border)", boxShadow: "var(--panel-shadow)" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)", boxShadow: "0 0 20px rgba(124,58,237,0.4)" }}
            >
              <Zap size={18} color="#fff" />
            </div>
            <div>
              <h1
                className="text-2xl font-bold"
                style={{ color: "var(--text-primary)", fontFamily: "var(--font-rajdhani), sans-serif" }}
              >
                GPT-Image-2 提示词精选
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              来自社区的精选创作案例，复制提示词或直接一键生图 · 共 {allCases.length + publicFeatured.length + myFeatured.length} 个案例
              </p>
            </div>
          </div>

          {/* 搜索框 */}
          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="搜索提示词、标题或作者..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{
                background: "var(--field-bg)",
                border: "1px solid var(--field-border)",
                color: "var(--text-primary)",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--field-focus-border)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--field-border)"; }}
            />
          </div>

          {/* 业务筛选 */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs font-semibold flex-shrink-0" style={{ color: "var(--text-muted)" }}>
              业务方向
            </span>
            {[
              { id: "all" as const, label: "全部", desc: "不限制业务方向" },
              { id: "game" as const, label: "游戏", desc: "角色、场景、玩法、美术方向" },
              { id: "ui" as const, label: "UI", desc: "界面、版式、信息图、截图样式" },
              { id: "marketing" as const, label: "广告创意", desc: "KV、海报、品牌与活动物料" },
            ].map((opt) => {
              const active = businessFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleBusinessFilterChange(opt.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  title={opt.desc}
                  style={{
                    background: active ? "var(--filter-teal-bg)" : "var(--bg-surface-soft)",
                    color: active ? "var(--filter-teal-text)" : "var(--text-secondary)",
                    border: `${active ? "1.5px" : "1px"} solid ${active ? "var(--filter-teal-border)" : "var(--border)"}`,
                    boxShadow: active ? "var(--filter-teal-shadow)" : "none",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs font-semibold flex-shrink-0" style={{ color: "var(--text-muted)" }}>
              来源分类
            </span>
            {presetCategoryOptions.map((cat) => {
              const active = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => handleCategoryChange(cat.key)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: active ? "var(--filter-purple-bg)" : "var(--bg-surface-soft)",
                    color: active ? "var(--filter-purple-text)" : "var(--text-secondary)",
                    border: `${active ? "1.5px" : "1px"} solid ${active ? "var(--filter-purple-border)" : "var(--border)"}`,
                    boxShadow: active ? "var(--filter-purple-shadow)" : "none",
                  }}
                >
                  {cat.label}
                  {cat.key !== "" && <span className="ml-1 opacity-60">({cat.count})</span>}
                </button>
              );
            })}
            <span className="ml-auto text-xs" style={{ color: "var(--text-muted)" }}>
              当前结果 {filtered.length} 个
            </span>
          </div>
        </div>

        {/* ── 分类 Tabs ── */}
        <div className="space-y-2">
          {/* 精选分组 */}
              {(publicFeatured.length > 0 || publicFeaturedCategories.length > 0) && (
            <div
              className="public-row flex items-center flex-wrap gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: "var(--public-row-bg)", border: "1px solid var(--public-row-border)" }}
            >
              <span className="text-xs font-semibold flex-shrink-0 flex items-center gap-1.5" style={{ color: "var(--public-row-label)" }}>
                <Globe size={12} />项目精选
              </span>
              <div className="w-px h-3.5 flex-shrink-0" style={{ background: "var(--public-row-divider)" }} />

              {/* 全部 */}
              {(() => {
                const active = activeCategory === PUBLIC_FEATURED_KEY;
                return (
                  <button
                    onClick={() => handleCategoryChange(PUBLIC_FEATURED_KEY)}
                    className="px-3.5 py-1 rounded-full text-xs font-semibold transition-all"
                    style={{
                      background: active ? "var(--public-tab-active-bg)" : "var(--public-tab-bg)",
                      color: active ? "var(--public-tab-active-text)" : "var(--public-tab-text)",
                      border: `${active ? "1.5px" : "1px"} solid ${active ? "var(--public-tab-active-border)" : "var(--public-tab-border)"}`,
                      boxShadow: active ? "0 0 0 1px var(--public-tab-glow) inset, 0 0 10px var(--public-tab-glow)" : "none",
                    }}
                  >
                    全部
                    <span className="ml-1 opacity-60">({publicFeatured.length})</span>
                  </button>
                );
              })()}

              {/* 各分类 */}
              {publicFeaturedCategories.map((cat) => {
                const active = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => handleCategoryChange(cat.key)}
                    className="px-3.5 py-1 rounded-full text-xs font-semibold transition-all"
                    style={{
                      background: active ? "var(--public-tab-active-bg)" : "var(--public-tab-bg)",
                      color: active ? "var(--public-tab-active-text)" : "var(--public-tab-text)",
                      border: `${active ? "1.5px" : "1px"} solid ${active ? "var(--public-tab-active-border)" : "var(--public-tab-border)"}`,
                      boxShadow: active ? "0 0 0 1px var(--public-tab-glow) inset, 0 0 10px var(--public-tab-glow)" : "none",
                    }}
                    >
                    {cat.label}
                    <span className="ml-1 opacity-60">({cat.count})</span>
                  </button>
                );
              })}

              {/* 管理员入口 */}
              {user?.isAdmin && (
                <button
                  onClick={() => { loadAdminAll(); setShowAdminPanel(true); }}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: "var(--filter-indigo-bg)",
                    color: "var(--filter-indigo-text)",
                    border: "1px solid var(--filter-indigo-border)",
                  }}
                >
                  <Users size={11} />管理精选
                </button>
              )}
            </div>
          )}

          {/* 我的分类行（有自定义分类或私有精选才显示） */}
          {(customCategories.length > 0 || myFeatured.length > 0) && (
            <div
              className="flex items-center flex-wrap gap-2 px-3 py-2.5 rounded-xl"
              style={{ background: "var(--mine-row-bg)", border: "1px solid var(--mine-row-border)" }}
            >
              <span className="text-xs font-semibold flex-shrink-0" style={{ color: "var(--mine-row-label)" }}>
                我的分类
              </span>
              <div className="w-px h-3.5 flex-shrink-0" style={{ background: "var(--mine-row-divider)" }} />

              {/* 我的精选 tab */}
              {myFeatured.length > 0 && (() => {
                const active = activeCategory === MY_FEATURED_KEY;
                return (
                  <button
                    onClick={() => handleCategoryChange(MY_FEATURED_KEY)}
                    className="px-3.5 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1"
                    style={{
                      background: active ? "var(--filter-gold-bg)" : "rgba(251,191,36,0.08)",
                      color: active ? "var(--filter-gold-text)" : "#d97706",
                      border: `${active ? "1.5px" : "1px"} solid ${active ? "var(--filter-gold-border)" : "rgba(251,191,36,0.18)"}`,
                      boxShadow: active ? "var(--filter-gold-shadow)" : "none",
                    }}
                  >
                    <Star size={10} />
                    我的精选
                    <span className="ml-1 text-xs opacity-70">({myFeatured.length})</span>
                  </button>
                );
              })()}

              {/* 自定义分类 tabs */}
              {customCategories.map((cat) => {
                const active = activeCategory === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => handleCategoryChange(cat.key)}
                    className="px-3.5 py-1 rounded-full text-xs font-semibold transition-all"
                    style={{
                      background: active ? "var(--filter-purple-bg)" : "rgba(139,92,246,0.08)",
                      color: active ? "var(--filter-purple-text)" : "var(--mine-row-label)",
                      border: `${active ? "1.5px" : "1px"} solid ${active ? "var(--filter-purple-border)" : "rgba(139,92,246,0.18)"}`,
                      boxShadow: active ? "var(--filter-purple-shadow)" : "none",
                    }}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 卡片网格 ── */}
        {filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>
            <p className="text-sm">未找到匹配的案例</p>
          </div>
        ) : (
          <>
            <div
              ref={gridRef}
              className="grid gap-5"
              style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))` }}
            >
              {paginated.map((item) => {
                const customIdx = customCategories.findIndex((c) => c.key === item.category);
                return (
                  <CaseCard
                    key={item.id}
                    item={item}
                    onCardClick={() => setDetailItem({ item, customIdx })}
                    onRemove={item.isFeatured ? removeFeatured : undefined}
                    customPaletteIndex={customIdx >= 0 ? customIdx : undefined}
                  />
                );
              })}
            </div>

            {/* 分页控件 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: page === 1 ? "var(--pagination-disabled-bg)" : "var(--pagination-bg)",
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
                          background: p === page ? "var(--pagination-active-bg)" : "var(--bg-surface-soft)",
                          color: p === page ? "var(--pagination-active-text)" : "var(--text-secondary)",
                          border: `1px solid ${p === page ? "var(--pagination-active-border)" : "var(--border)"}`,
                          boxShadow: p === page ? "var(--pagination-active-shadow)" : "none",
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
                    background: page === totalPages ? "var(--pagination-disabled-bg)" : "var(--pagination-bg)",
                    color: page === totalPages ? "var(--text-muted)" : "var(--text-secondary)",
                    border: "1px solid var(--border)",
                    cursor: page === totalPages ? "not-allowed" : "pointer",
                    opacity: page === totalPages ? 0.5 : 1,
                  }}
                >
                  下一页
                </button>

                <span className="text-xs ml-1" style={{ color: "var(--text-muted)" }}>
                  {page} / {totalPages} 页 · {filtered.length} 个案例
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {detailItem && (() => {
        const { item, customIdx } = detailItem;
        const cat = CATEGORY_COLORS[item.category]
          ?? (customIdx >= 0 ? CUSTOM_PALETTE[customIdx % CUSTOM_PALETTE.length] : null)
          ?? { bg: "rgba(255,255,255,0.08)", color: "var(--text-muted)", border: "var(--border)", glow: "transparent" };
        const params = new URLSearchParams({ prompt: item.prompt });
        if (item.refImageUrl) params.set("refImage", item.refImageUrl);
        // 我的精选分类下，允许移除；公共精选（非我创建的）不允许移除
        const canRemove = activeCategory === MY_FEATURED_KEY;
        return (
          <CardDetailModal
            item={item}
            cat={cat}
            onClose={() => setDetailItem(null)}
            onGenerate={() => {
              if (isBrowseOnly) {
                blockCreateAction("当前为案例浏览模式，若要一键生图，请先补充 SOFUNNY_API_KEY。");
                return false;
              }
              router.push(`/create/gptimage2?${params.toString()}`);
              return true;
            }}
            onRemove={canRemove ? () => removeFeatured(item.id) : undefined}
            onTitleSave={canRemove ? (t) => updateFeaturedTitle(item.id, t) : undefined}
          />
        );
      })()}

      {/* 管理员精选管理面板 */}
      {showAdminPanel && user?.isAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(18px)" }}
          onClick={() => setShowAdminPanel(false)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl overflow-hidden flex flex-col"
            style={{
              maxHeight: "88vh",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <Users size={16} style={{ color: "#818cf8" }} />
                <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>所有用户精选管理</h2>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>（{adminAll.length} 条）</span>
              </div>
              <button onClick={() => setShowAdminPanel(false)} style={{ color: "var(--text-muted)" }}>
                <X size={16} />
              </button>
            </div>

            {/* 列表 */}
            <div className="overflow-y-auto flex-1">
              {adminAll.length === 0 ? (
                <div className="py-16 text-center text-sm" style={{ color: "var(--text-muted)" }}>暂无收藏</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>图片</th>
                      <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>标题</th>
                      <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>用户</th>
                      <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>状态</th>
                      <th className="text-left px-4 py-2.5 font-medium" style={{ color: "var(--text-muted)" }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminAll.map((item: AdminFeatured) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td className="px-4 py-2.5">
                          <img src={item.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover" style={{ background: "rgba(0,0,0,0.3)" }} />
                        </td>
                        <td className="px-4 py-2.5" style={{ color: "var(--text-primary)", maxWidth: 180 }}>
                          <p className="font-medium truncate">{item.title}</p>
                          <p className="truncate mt-0.5" style={{ color: "var(--text-muted)" }}>{item.categoryLabel}</p>
                        </td>
                        <td className="px-4 py-2.5" style={{ color: "var(--text-secondary)" }}>{item.ownerName}</td>
                        <td className="px-4 py-2.5">
                          {item.isPublic ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                              <Globe size={9} />公共
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                              <Lock size={9} />私有
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {item.isPublic ? (
                            <button
                              onClick={() => unpublishFeatured(item.id)}
                              className="px-2.5 py-1 rounded-lg text-xs transition-all"
                              style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}
                            >
                              取消公开
                            </button>
                          ) : (
                            <button
                              onClick={() => publishFeatured(item.id)}
                              className="px-2.5 py-1 rounded-lg text-xs transition-all"
                              style={{ background: "rgba(52,211,153,0.1)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}
                            >
                              推送公共
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
