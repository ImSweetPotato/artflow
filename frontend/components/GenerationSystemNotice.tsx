"use client";

import { AlertCircle, Users } from "lucide-react";

export const GENERATION_SUPPLIER_HINT = "供应商资源紧张，生图平均耗时 3-7 分钟，偶发 500 报错，重试即可。";
export const GENERATION_GLOBAL_LIMIT = 15;
export const GENERATION_PER_USER_LIMIT = 5;

export default function GenerationSystemNotice() {
  return (
    <div
      className="rounded-[24px] p-4 md:p-5"
      style={{
        background: "linear-gradient(135deg, rgba(14,165,233,0.08), rgba(245,158,11,0.06)), var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--panel-shadow)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(14,165,233,0.12)", border: "1px solid rgba(14,165,233,0.2)" }}
        >
          <AlertCircle size={17} style={{ color: "#0ea5e9" }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase" style={{ color: "#0ea5e9" }}>
            运行说明
          </p>
          <p className="text-sm font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
            首页只保留最关键的并发规则
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="rounded-2xl px-3 py-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#0ea5e9" }}>
            <Users size={11} />
            并发上限
          </div>
          <p className="text-sm font-bold mt-1" style={{ color: "var(--text-primary)" }}>
            {GENERATION_GLOBAL_LIMIT}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            全局同时运行
          </p>
        </div>
        <div className="rounded-2xl px-3 py-3" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "#d97706" }}>
            <Users size={11} />
            账号上限
          </div>
          <p className="text-sm font-bold mt-1" style={{ color: "var(--text-primary)" }}>
            {GENERATION_PER_USER_LIMIT}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
            单账号同时运行
          </p>
        </div>
      </div>
      <p className="text-[11px] leading-5 mt-3" style={{ color: "var(--text-muted)" }}>
        更完整的耗时、排队、500/429 重试说明请看「教程」。
      </p>
    </div>
  );
}
