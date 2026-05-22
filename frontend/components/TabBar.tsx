"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  X, Home, Sparkles, ClipboardList, FolderOpen, Lightbulb,
  Workflow, BookOpen, User, type LucideIcon,
} from "lucide-react";
import { useTabContext } from "@/contexts/TabContext";

/**
 * 根据 tab 的 href 推断一个图标，提升识别度。
 * 顺序很重要：精确匹配优先于前缀匹配。
 */
function iconForHref(href: string): LucideIcon {
  if (href === "/") return Home;
  if (href.startsWith("/inspiration")) return Lightbulb;
  if (href.startsWith("/workflow")) return Workflow;
  if (href.startsWith("/create")) return Sparkles;
  if (href.startsWith("/tasks")) return ClipboardList;
  if (href.startsWith("/assets")) return FolderOpen;
  if (href.startsWith("/tutorial")) return BookOpen;
  if (href.startsWith("/profile")) return User;
  return Sparkles;
}

export default function TabBar() {
  const { tabs, activeHref, closeTab } = useTabContext();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 激活的 tab 自动滚到可见区域
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>('[data-active="true"]');
    if (active) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeHref]);

  return (
    <div
      ref={scrollRef}
      className="tabbar-scroll flex items-center h-full overflow-x-auto flex-1 min-w-0 px-2 gap-1"
      style={{ scrollbarWidth: "none" }}
    >
      <style>{`.tabbar-scroll::-webkit-scrollbar{display:none}`}</style>
      {tabs.map((tab) => {
        const active = tab.href === activeHref;
        const Icon = iconForHref(tab.href);
        return (
          <div
            key={tab.href}
            data-active={active}
            className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer select-none group transition-all"
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: 10,
              background: active ? "var(--tab-active-bg)" : "transparent",
              color: active ? "var(--tab-active-text)" : "var(--text-secondary)",
              border: `1px solid ${active ? "var(--tab-active-border)" : "transparent"}`,
              boxShadow: active ? "var(--tab-active-shadow)" : "none",
              maxWidth: 200,
              transition: "background 0.18s, color 0.18s, box-shadow 0.18s, border-color 0.18s",
            }}
            onClick={() => {
              if (!active) router.push(tab.href);
            }}
            onMouseEnter={(e) => {
              if (!active) {
                (e.currentTarget as HTMLDivElement).style.background = "var(--tab-hover-bg)";
                (e.currentTarget as HTMLDivElement).style.color = "var(--text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                (e.currentTarget as HTMLDivElement).style.background = "transparent";
                (e.currentTarget as HTMLDivElement).style.color = "var(--text-secondary)";
              }
            }}
          >
            <Icon size={13} strokeWidth={active ? 2.4 : 2} className="flex-shrink-0" />
            <span
              className="text-xs font-medium truncate"
              style={{ maxWidth: 130, fontWeight: active ? 600 : 500 }}
            >
              {tab.label}
            </span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.href);
                }}
                className="flex items-center justify-center w-4 h-4 rounded flex-shrink-0 transition-all"
                style={{
                  color: active ? "var(--tab-close-active)" : "var(--text-muted)",
                  opacity: active ? 0.7 : 0,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#f87171";
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.12)";
                  (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = active ? "var(--tab-close-active)" : "var(--text-muted)";
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  (e.currentTarget as HTMLButtonElement).style.opacity = active ? "0.7" : "0";
                }}
              >
                <X size={10} />
              </button>
            )}
          </div>
        );
      })}
      {/* 让非激活 tab hover 时也能看到 X 按钮 */}
      <style>{`
        .tabbar-scroll > div:hover > button { opacity: 0.6 !important; }
      `}</style>
    </div>
  );
}
