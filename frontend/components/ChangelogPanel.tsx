"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, ChevronDown, Sparkles, Wrench, Bug } from "lucide-react";
import { CHANGELOG, type ChangelogTag } from "@/lib/changelog";

const TAG_META: Record<ChangelogTag, { label: string; color: string; bg: string; border: string; icon: typeof Sparkles }> = {
  new:     { label: "新增", color: "#38bdf8", bg: "rgba(14,165,233,0.12)",  border: "rgba(14,165,233,0.3)",  icon: Sparkles },
  improve: { label: "优化", color: "#a78bfa", bg: "rgba(139,92,246,0.12)",  border: "rgba(139,92,246,0.3)",  icon: Wrench },
  fix:     { label: "修复", color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)",  icon: Bug },
};

function formatDate(iso: string): string {
  // "2026-05-07" → "2026/05/07"
  return iso.replace(/-/g, "/");
}

export default function ChangelogPanel() {
  const [expandedSet, setExpandedSet] = useState<Set<string>>(
    () => new Set([CHANGELOG[0]?.version].filter(Boolean) as string[])
  );
  const [showAllSet, setShowAllSet] = useState<Set<string>>(new Set());

  const toggle = (version: string) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  const toggleShowAll = (version: string) => {
    setShowAllSet((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  if (CHANGELOG.length === 0) return null;

  return (
    <div
      className="glass rounded-[24px] p-3"
      style={{
        background: "var(--bg-card)",
      }}
    >
      <div
        className="flex items-center gap-2.5 px-3 py-3 rounded-2xl"
        style={{ background: "var(--bg-surface-soft)" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)", boxShadow: "0 0 14px rgba(245,158,11,0.4)" }}
        >
          <Megaphone size={13} color="#fff" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
            版本更新公告
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            最新 {CHANGELOG[0].version} · {formatDate(CHANGELOG[0].date)}
          </p>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ background: "rgba(245,158,11,0.12)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.25)" }}
        >
          NEW
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {CHANGELOG.map((ver, idx) => {
          const expanded = expandedSet.has(ver.version);
          const showAll = showAllSet.has(ver.version);
          const counts = {
            new: ver.items.filter((i) => i.type === "new").length,
            improve: ver.items.filter((i) => i.type === "improve").length,
            fix: ver.items.filter((i) => i.type === "fix").length,
          };
          return (
            <div
              key={ver.version}
              className="rounded-2xl overflow-hidden"
              style={{ background: expanded ? "var(--bg-surface-soft)" : "transparent", border: "1px solid var(--border)", alignSelf: "start" }}
            >
              <button
                onClick={() => toggle(ver.version)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors"
                style={{ background: expanded ? "var(--bg-surface-soft)" : "transparent" }}
                onMouseEnter={(e) => {
                  if (!expanded) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface-soft)";
                }}
                onMouseLeave={(e) => {
                  if (!expanded) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <span
                  className="text-xs font-mono font-bold px-2 py-0.5 rounded-md flex-shrink-0"
                  style={{
                    background: idx === 0 ? "var(--filter-purple-bg)" : "var(--bg-surface-soft)",
                    color: idx === 0 ? "var(--filter-purple-text)" : "var(--text-muted)",
                  }}
                >
                  {ver.version}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold leading-5" style={{ color: "var(--text-primary)" }}>
                    {ver.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs" style={{ color: "var(--text-muted)", opacity: 0.7 }}>
                      {formatDate(ver.date)}
                    </span>
                    {(["new", "improve", "fix"] as ChangelogTag[]).map((t) =>
                      counts[t] > 0 ? (
                        <span
                          key={t}
                          className="text-xs"
                          style={{ color: TAG_META[t].color, opacity: 0.85 }}
                        >
                          · {TAG_META[t].label} {counts[t]}
                        </span>
                      ) : null,
                    )}
                  </div>
                </div>
                <ChevronDown
                  size={14}
                  style={{
                    color: "var(--text-muted)",
                    transform: expanded ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                    flexShrink: 0,
                  }}
                />
              </button>

              {/* 条目列表 */}
              <AnimatePresence initial={false}>
                {expanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 space-y-2">
                      {(showAll ? ver.items : ver.items.slice(0, 4)).map((item, i) => {
                        const meta = TAG_META[item.type];
                        const Icon = meta.icon;
                        return (
                          <div key={i} className="flex items-start gap-2.5">
                            <span
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold flex-shrink-0 mt-0.5"
                              style={{
                                background: meta.bg,
                                color: meta.color,
                                border: `1px solid ${meta.border}`,
                              }}
                            >
                              <Icon size={9} />
                              {meta.label}
                            </span>
                            <p
                              className="text-xs leading-relaxed flex-1"
                              style={{ color: "var(--text-secondary)" }}
                            >
                              {item.text}
                            </p>
                          </div>
                        );
                      })}
                      {ver.items.length > 4 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleShowAll(ver.version);
                          }}
                          className="text-xs pl-[3.8rem] transition-colors"
                          style={{ color: "var(--accent)" }}
                        >
                          {showAll
                            ? "收起完整版本记录"
                            : `还有 ${ver.items.length - 4} 条更新，点击查看完整版本记录`}
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
