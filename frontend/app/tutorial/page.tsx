"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Clock, Search, ChevronDown, ChevronRight,
  Lightbulb, AlertCircle, Sparkles, ExternalLink, Hash,
} from "lucide-react";
import { TUTORIALS, type TutorialArticle, type TutorialSection } from "@/lib/tutorials";
import { CopyIconButton } from "@/components/PromptDisplay";
import { useBrowseOnlyMode } from "@/hooks/useBrowseOnlyMode";

export default function TutorialPage() {
  const router = useRouter();
  const { blockCreateAction } = useBrowseOnlyMode();
  const [activeTab, setActiveTab] = useState<string>(TUTORIALS[0]?.id ?? "");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const currentCategory = TUTORIALS.find((c) => c.id === activeTab) ?? TUTORIALS[0];

  // 全文搜索：跨分类搜索 title/summary/sections.text
  const matched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;

    const results: { catLabel: string; catEmoji: string; article: TutorialArticle }[] = [];
    for (const cat of TUTORIALS) {
      for (const art of cat.articles) {
        const inTitle = art.title.toLowerCase().includes(q);
        const inSummary = art.summary.toLowerCase().includes(q);
        const inSections = art.sections.some((s) => {
          if ("text" in s && s.text.toLowerCase().includes(q)) return true;
          if (s.type === "list") return s.items.some((i) => i.toLowerCase().includes(q));
          if (s.type === "steps") return s.items.some((i) => (i.title + i.text).toLowerCase().includes(q));
          if (s.type === "keyValue") return s.items.some((i) => (i.key + i.value).toLowerCase().includes(q));
          return false;
        });
        if (inTitle || inSummary || inSections) {
          results.push({ catLabel: cat.label, catEmoji: cat.emoji, article: art });
        }
      }
    }
    return results;
  }, [search]);

  const toggleArticle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openInCreate = (prompt: string, refImageUrl?: string) => {
    if (blockCreateAction("你当前处于案例浏览模式，请先补充 SOFUNNY_API_KEY 后再把 Prompt 带入创作页。")) {
      return;
    }
    const params = new URLSearchParams({ prompt });
    if (refImageUrl) params.set("refImage", refImageUrl);
    router.push(`/create/gptimage2?${params.toString()}`);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── Hero ── */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(236,72,153,0.08) 100%)",
          border: "1px solid rgba(139,92,246,0.25)",
        }}
      >
        {/* 装饰 */}
        <div
          className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.18), transparent 70%)" }}
        />

        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)", boxShadow: "0 0 20px rgba(124,58,237,0.4)" }}
            >
              <BookOpen size={18} color="#fff" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-rajdhani), sans-serif", color: "var(--text-primary)" }}>
                ArtFlow 知识中心
              </h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                从 0 到精通：快速上手、提示词指南、进阶玩法、常见问题
              </p>
            </div>
          </div>

          {/* 搜索 */}
          <div className="relative max-w-md">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="搜索教程内容、关键词、技巧..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(139,92,246,0.25)",
                color: "var(--text-primary)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.55)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(139,92,246,0.25)")}
            />
          </div>
        </div>
      </div>

      {/* ── 搜索结果 / 分类 Tab ── */}
      {matched ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Search size={14} style={{ color: "var(--text-muted)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              找到 {matched.length} 篇相关教程
            </span>
            {matched.length === 0 && (
              <button
                onClick={() => setSearch("")}
                className="ml-2 text-xs underline"
                style={{ color: "#a78bfa", textUnderlineOffset: 3 }}
              >
                清空搜索
              </button>
            )}
          </div>
          <div className="space-y-3">
            {matched.map(({ catLabel, catEmoji, article }) => (
              <ArticleCard
                key={article.id}
                article={article}
                expanded={expandedIds.has(article.id)}
                onToggle={() => toggleArticle(article.id)}
                onOpenCreate={openInCreate}
                tagPrefix={`${catEmoji} ${catLabel}`}
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* 分类 Tab */}
          <div className="flex items-center gap-2 flex-wrap">
            {TUTORIALS.map((cat) => {
              const active = activeTab === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: active
                      ? "var(--filter-purple-bg)"
                      : "var(--bg-card)",
                    color: active ? "var(--filter-purple-text)" : "var(--text-secondary)",
                    border: `${active ? "1.5px" : "1px"} solid ${active ? "var(--filter-purple-border)" : "var(--border)"}`,
                    boxShadow: active ? "var(--filter-purple-shadow)" : "none",
                  }}
                >
                  <span style={{ fontSize: 16 }}>{cat.emoji}</span>
                  {cat.label}
                  <span
                    className="ml-1 text-xs opacity-70"
                    style={{ fontSize: 10 }}
                  >
                    {cat.articles.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 文章列表 */}
          <div className="space-y-3">
            {currentCategory.articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                expanded={expandedIds.has(article.id)}
                onToggle={() => toggleArticle(article.id)}
                onOpenCreate={openInCreate}
              />
            ))}
          </div>
        </>
      )}

      {/* 底部跳转创作页 */}
      <div
        className="rounded-2xl p-5 flex items-center gap-4"
        style={{ background: "var(--bg-card)", border: "1px dashed var(--border)" }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(14,165,233,0.12)", color: "#38bdf8" }}
        >
          <Sparkles size={18} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            学完了？去试试吧
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            打开创作页，把刚学到的技巧用起来
          </p>
        </div>
        <button
          onClick={() => {
            if (blockCreateAction("你当前处于案例浏览模式，请先补充 SOFUNNY_API_KEY 后再开始创作。")) {
              return;
            }
            router.push("/create/gptimage2");
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: "linear-gradient(135deg, #0ea5e9, #38bdf8)",
            color: "#fff",
            boxShadow: "0 4px 16px rgba(14,165,233,0.35)",
          }}
        >
          <Sparkles size={13} />
          开始创作
          <ExternalLink size={11} />
        </button>
      </div>
    </div>
  );
}

// ── 单篇文章卡 ──────────────────────────────────────────────────────────────

function ArticleCard({
  article, expanded, onToggle, onOpenCreate, tagPrefix,
}: {
  article: TutorialArticle;
  expanded: boolean;
  onToggle: () => void;
  onOpenCreate: (prompt: string, refImageUrl?: string) => void;
  tagPrefix?: string;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: "var(--bg-card)",
        border: `1px solid ${expanded ? "rgba(139,92,246,0.35)" : "var(--border)"}`,
        boxShadow: expanded ? "0 4px 24px rgba(124,58,237,0.12)" : "none",
      }}
    >
      {/* 头部 */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 px-5 py-4 text-left transition-colors"
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{
            background: expanded ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)",
            color: expanded ? "#c4b5fd" : "var(--text-muted)",
          }}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {tagPrefix && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", fontSize: 10 }}>
                {tagPrefix}
              </span>
            )}
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              {article.title}
            </h3>
            {article.tags?.map((t) => (
              <span
                key={t}
                className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{
                  background: t === "必读" || t === "推荐" ? "rgba(251,191,36,0.15)" : "rgba(139,92,246,0.1)",
                  color: t === "必读" || t === "推荐" ? "#fbbf24" : "#a78bfa",
                  fontSize: 10,
                }}
              >
                {t}
              </span>
            ))}
          </div>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {article.summary}
          </p>
          <div className="flex items-center gap-1 mt-1.5 text-xs" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
            <Clock size={10} />
            <span>{article.duration}</span>
          </div>
        </div>
      </button>

      {/* 展开内容 */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div
              className="px-5 pb-5 pt-1 space-y-3.5"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              {article.sections.map((section, i) => (
                <SectionRenderer key={i} section={section} onOpenCreate={onOpenCreate} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 富文本 Section 渲染器 ───────────────────────────────────────────────────

function SectionRenderer({
  section, onOpenCreate,
}: {
  section: TutorialSection;
  onOpenCreate: (prompt: string, refImageUrl?: string) => void;
}) {
  if (section.type === "heading") {
    return (
      <h4 className="text-sm font-bold flex items-center gap-1.5 mt-2" style={{ color: "var(--text-primary)" }}>
        <Hash size={11} style={{ color: "#a78bfa" }} />
        {section.text}
      </h4>
    );
  }

  if (section.type === "paragraph") {
    return (
      <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {section.text}
      </p>
    );
  }

  if (section.type === "list") {
    const Tag = section.ordered ? "ol" : "ul";
    return (
      <Tag className={`text-sm space-y-1.5 ${section.ordered ? "list-decimal" : "list-disc"} pl-5`} style={{ color: "var(--text-secondary)" }}>
        {section.items.map((it, i) => (
          <li key={i} className="leading-relaxed">{it}</li>
        ))}
      </Tag>
    );
  }

  if (section.type === "tip") {
    return (
      <div
        className="rounded-xl p-3 flex items-start gap-2.5"
        style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.25)" }}
      >
        <Lightbulb size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#c4b5fd" }} />
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {section.text}
        </p>
      </div>
    );
  }

  if (section.type === "warning") {
    return (
      <div
        className="rounded-xl p-3 flex items-start gap-2.5"
        style={{ background: "rgba(251,146,60,0.08)", border: "1px solid rgba(251,146,60,0.25)" }}
      >
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#fb923c" }} />
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {section.text}
        </p>
      </div>
    );
  }

  if (section.type === "steps") {
    return (
      <div className="space-y-2">
        {section.items.map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5"
              style={{
                background: "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(236,72,153,0.2))",
                color: "#e9d5ff",
                border: "1px solid rgba(139,92,246,0.4)",
              }}
            >
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {step.title}
              </p>
              {step.text && (
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {step.text}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (section.type === "keyValue") {
    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: "1px solid var(--border)" }}
      >
        {section.items.map((row, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-4 py-2.5"
            style={{
              background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
              borderTop: i > 0 ? "1px solid var(--border)" : "none",
            }}
          >
            <span className="text-xs font-semibold flex-shrink-0" style={{ color: "var(--text-muted)", minWidth: 90 }}>
              {row.key}
            </span>
            <span className="text-xs flex-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {row.value}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (section.type === "prompt") {
    return (
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "rgba(14,165,233,0.04)",
          border: "1px solid rgba(14,165,233,0.25)",
        }}
      >
        {section.label && (
          <div
            className="flex items-center justify-between px-3 py-2"
            style={{ borderBottom: "1px solid rgba(14,165,233,0.15)", background: "rgba(14,165,233,0.06)" }}
          >
            <span className="text-xs font-semibold" style={{ color: "#7dd3fc" }}>
              {section.label}
            </span>
            <CopyIconButton text={section.text} label="" />
          </div>
        )}
        <div className="px-3 py-2.5">
          <p
            className="text-xs leading-relaxed font-mono select-text"
            style={{ color: "var(--text-primary)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
          >
            {section.text}
          </p>
          <button
            onClick={() => onOpenCreate(section.text, section.refImageUrl)}
            className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, rgba(14,165,233,0.2), rgba(56,189,248,0.15))",
              color: "#7dd3fc",
              border: "1px solid rgba(14,165,233,0.4)",
            }}
          >
            <Sparkles size={11} />
            在创作页打开此 Prompt
            <ExternalLink size={10} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
