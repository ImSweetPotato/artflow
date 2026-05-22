"use client";

import { useState } from "react";
import { Copy, Check, FileText } from "lucide-react";

/**
 * 通用提示词展示组件 — 带「一键复制」按钮，HTTP 环境也能用。
 *
 * 用在所有需要展示生成提示词的位置（任务详情、灵感广场、精选弹窗等）。
 */

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // 继续走兜底
    }
  }
  // HTTP / 不支持 clipboard 时的兜底方案
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(ta);
  }
}

interface CopyIconButtonProps {
  text: string;
  /** 按钮尺寸：sm 用于嵌入卡片角落；md 用于独立按钮 */
  size?: "sm" | "md";
  /** 自定义 className 叠加 */
  className?: string;
  /** 自定义提示文案，默认 "复制" */
  label?: string;
}

/** 单独的小复制按钮（图标 + 可选文字），点击后短暂变绿色 ✓ */
export function CopyIconButton({ text, size = "sm", className = "", label }: CopyIconButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const dims = size === "sm" ? "h-6 px-2 text-xs gap-1" : "h-8 px-3 text-xs gap-1.5";
  const iconSize = size === "sm" ? 11 : 13;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center rounded-md font-medium transition-all ${dims} ${className}`}
      style={{
        background: copied ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.06)",
        color: copied ? "#34d399" : "var(--text-secondary)",
        border: `1px solid ${copied ? "rgba(52,211,153,0.35)" : "var(--border)"}`,
      }}
      title={copied ? "已复制" : "复制"}
    >
      {copied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
      {label !== undefined ? (label === "" ? null : (copied ? "已复制" : label)) : (copied ? "已复制" : "复制")}
    </button>
  );
}

interface PromptDisplayProps {
  prompt: string;
  /** 顶部标签文案，默认 "提示词" */
  label?: string;
  /** 是否显示标题区（带图标 + 复制按钮）；false 则只显示内容卡 + 内嵌右上复制按钮 */
  showHeader?: boolean;
  /** 折叠：超过这个字符数时收起，点击展开 */
  collapseAt?: number;
  /** 容器额外样式 */
  className?: string;
}

/**
 * 提示词展示卡：
 *   ┌────────────────────────────────┐
 *   │ 📄 提示词                  [复制]│  (showHeader=true)
 *   ├────────────────────────────────┤
 *   │ A stunning... (内容)            │
 *   │ ...                             │
 *   └────────────────────────────────┘
 */
export default function PromptDisplay({
  prompt,
  label = "提示词",
  showHeader = true,
  collapseAt,
  className = "",
}: PromptDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  if (!prompt) return null;

  const isLong = collapseAt != null && prompt.length > collapseAt;
  const displayed = isLong && !expanded ? prompt.slice(0, collapseAt) + "…" : prompt;

  return (
    <div className={className}>
      {showHeader && (
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
            <FileText size={11} />
            {label}
          </p>
          <CopyIconButton text={prompt} label="" />
        </div>
      )}
      <div
        className="relative rounded-xl px-3 py-2.5 text-xs leading-relaxed select-text"
        style={{
          background: "var(--prompt-bg, rgba(255,255,255,0.03))",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {!showHeader && (
          <div className="absolute top-2 right-2 z-10">
            <CopyIconButton text={prompt} label="" />
          </div>
        )}
        <span className={!showHeader ? "block pr-8" : undefined}>{displayed}</span>
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="block mt-1.5 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ color: "var(--accent, #a78bfa)" }}
          >
            {expanded ? "收起" : "展开全文"}
          </button>
        )}
      </div>
    </div>
  );
}
