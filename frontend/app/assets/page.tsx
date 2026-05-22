"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Download, Star, Eye, X, FolderOpen, ImageIcon,
  Filter, CheckSquare, Square, Trash2, Brain, Sparkles, Calendar,
} from "lucide-react";
import FeaturedModal from "@/components/FeaturedModal";
import { getTasks, Task } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── 数据类型 ────────────────────────────────────────────────────────────────

interface AssetImage {
  id: string;            // taskId + "/" + index
  taskId: string;
  taskName: string;
  filePath: string;      // outputs/.../001.png
  url: string;           // http URL 用于显示
  dlUrl: string;         // 下载 URL
  filename: string;
  prompt: string;
  refPaths: string[];    // 参考图路径数组
  hasReference: boolean;
  hasThinking: boolean;
  aspectRatio: string;   // "1:1" / "auto" / ""
  model: string;         // skill_id
  createdAt: Date;       // 任务完成时间（用更新时间近似）
}

const MODULE_META: Record<string, { label: string; color: string }> = {
  gptimage2:        { label: "GPT-Image-2", color: "#38bdf8" },
  sketch2portrait:  { label: "原画转2D",    color: "#22d3ee" },
  sketch2keyvisual: { label: "原画转宣发图", color: "#fb923c" },
};

// ── 工具函数 ────────────────────────────────────────────────────────────────

function getInputParam(task: Task, key: string): string {
  const p = task.input_params as Record<string, unknown>;
  return p?.[key] != null ? String(p[key]) : "";
}

function getRefPaths(task: Task): string[] {
  const p = task.input_params as Record<string, unknown>;
  const arr = p?.image_paths;
  if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === "string");
  if (typeof p?.image_path === "string" && p.image_path) return [p.image_path];
  return [];
}

function getThinkingMeta(task: Task): boolean {
  const out = task.output as { thinking?: unknown } | null;
  return !!out?.thinking;
}

function fileToUrl(p: string) {
  const rel = p.replace(/\\/g, "/").split("outputs/").pop();
  return `${API_BASE}/outputs/${rel}`;
}
function fileToDlUrl(p: string) {
  const rel = p.replace(/\\/g, "/").split("outputs/").pop() ?? "";
  return `${API_BASE}/api/download?path=${encodeURIComponent(rel)}`;
}
function fileBasename(p: string) {
  return p.replace(/\\/g, "/").split("/").pop() ?? "image.png";
}

function flattenTasksToAssets(tasks: Task[]): AssetImage[] {
  const items: AssetImage[] = [];
  for (const t of tasks) {
    if (t.status !== "succeeded") continue;
    const out = t.output as { output_files?: string[] } | null;
    const files = out?.output_files ?? [];
    if (files.length === 0) continue;

    const taskName    = getInputParam(t, "task_name") || t.skill_id;
    const prompt      = getInputParam(t, "prompt") || getInputParam(t, "main_prompt");
    const aspectRatio = getInputParam(t, "aspect_ratio") || "auto";
    const refPaths    = getRefPaths(t);
    const hasThinking = getThinkingMeta(t);
    // 用 updated_at 作为完成时间，更准确
    const createdAt = new Date(
      (t.updated_at || t.created_at).endsWith("Z") ? t.updated_at : t.updated_at + "Z",
    );

    files.forEach((f, idx) => {
      items.push({
        id: `${t.id}/${idx}`,
        taskId: t.id,
        taskName,
        filePath: f,
        url: fileToUrl(f),
        dlUrl: fileToDlUrl(f),
        filename: fileBasename(f),
        prompt,
        refPaths,
        hasReference: refPaths.length > 0,
        hasThinking,
        aspectRatio,
        model: t.skill_id,
        createdAt,
      });
    });
  }
  // 按时间倒序
  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return items;
}

// ── 时间分组 ────────────────────────────────────────────────────────────────

type GroupKey = "today" | "yesterday" | "thisWeek" | "thisMonth" | "earlier";

const GROUP_LABELS: Record<GroupKey, string> = {
  today:     "今天",
  yesterday: "昨天",
  thisWeek:  "本周",
  thisMonth: "本月",
  earlier:   "更早",
};

function groupByDate(items: AssetImage[]): { key: GroupKey; items: AssetImage[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - 6 * 86400000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const buckets: Record<GroupKey, AssetImage[]> = {
    today: [], yesterday: [], thisWeek: [], thisMonth: [], earlier: [],
  };
  for (const it of items) {
    const t = it.createdAt.getTime();
    if (t >= startOfToday.getTime()) buckets.today.push(it);
    else if (t >= startOfYesterday.getTime()) buckets.yesterday.push(it);
    else if (t >= startOfWeek.getTime()) buckets.thisWeek.push(it);
    else if (t >= startOfMonth.getTime()) buckets.thisMonth.push(it);
    else buckets.earlier.push(it);
  }
  return (["today", "yesterday", "thisWeek", "thisMonth", "earlier"] as GroupKey[])
    .filter((k) => buckets[k].length > 0)
    .map((k) => ({ key: k, items: buckets[k] }));
}

// ── 主页面 ──────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterModel, setFilterModel] = useState<string>("");
  const [filterAspect, setFilterAspect] = useState<string>("");
  const [filterRefOnly, setFilterRefOnly] = useState(false);
  const [filterThinkingOnly, setFilterThinkingOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const [lightbox, setLightbox] = useState<AssetImage | null>(null);
  const [featuredTarget, setFeaturedTarget] = useState<AssetImage | null>(null);

  // ── 拉数据 ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const data = await getTasks({ status: "succeeded" });
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 8000); // 较低频率轮询，新生成会出现
    return () => clearInterval(timer);
  }, [load]);

  // ── 派生数据 ────────────────────────────────────────────────────────────
  const allAssets = useMemo(() => flattenTasksToAssets(tasks), [tasks]);

  const availableModels = useMemo(() => {
    const set = new Set<string>();
    for (const a of allAssets) set.add(a.model);
    return Array.from(set);
  }, [allAssets]);

  const availableAspects = useMemo(() => {
    const set = new Set<string>();
    for (const a of allAssets) set.add(a.aspectRatio || "auto");
    return Array.from(set).sort();
  }, [allAssets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allAssets.filter((a) => {
      if (filterModel && a.model !== filterModel) return false;
      if (filterAspect && (a.aspectRatio || "auto") !== filterAspect) return false;
      if (filterRefOnly && !a.hasReference) return false;
      if (filterThinkingOnly && !a.hasThinking) return false;
      if (q) {
        const inPrompt = a.prompt.toLowerCase().includes(q);
        const inName = a.taskName.toLowerCase().includes(q);
        if (!inPrompt && !inName) return false;
      }
      return true;
    });
  }, [allAssets, search, filterModel, filterAspect, filterRefOnly, filterThinkingOnly]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  // 统计：总数、本月、有参考图、思考模式
  const stats = useMemo(() => {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    return {
      total: allAssets.length,
      thisMonth: allAssets.filter((a) => a.createdAt.getTime() >= startOfMonth).length,
      withRef: allAssets.filter((a) => a.hasReference).length,
      withThinking: allAssets.filter((a) => a.hasThinking).length,
    };
  }, [allAssets]);

  const activeFiltersCount = (filterModel ? 1 : 0) + (filterAspect ? 1 : 0)
    + (filterRefOnly ? 1 : 0) + (filterThinkingOnly ? 1 : 0);

  // ── 多选操作 ───────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(filtered.map((a) => a.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const exitSelectMode = () => {
    setSelectMode(false);
    clearSelection();
  };

  const batchDownload = async () => {
    if (selectedIds.size === 0) return;
    setDownloading(true);
    try {
      const items = filtered.filter((a) => selectedIds.has(a.id));
      // 串行触发，避免浏览器限流
      for (let i = 0; i < items.length; i++) {
        const a = items[i];
        const link = document.createElement("a");
        link.href = a.dlUrl;
        link.download = a.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        await new Promise((r) => setTimeout(r, 500));
      }
    } finally {
      setDownloading(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setFilterModel("");
    setFilterAspect("");
    setFilterRefOnly(false);
    setFilterThinkingOnly(false);
  };

  // ── 渲染 ───────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-5">
        {/* ── 页头 ── */}
        <div>
          <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "var(--font-rajdhani), sans-serif", color: "var(--text-primary)" }}>
            图片资产库
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            按图片维度浏览所有成功生成的图，支持筛选、批量下载、收藏精选
          </p>
        </div>

        {/* ── 统计条 ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "总图片",   value: stats.total,        color: "var(--text-primary)", icon: ImageIcon },
            { label: "本月新增", value: stats.thisMonth,    color: "#34d399", icon: Calendar },
            { label: "图生图",   value: stats.withRef,      color: "#38bdf8", icon: FolderOpen },
            { label: "思考辅助", value: stats.withThinking, color: "#c4b5fd", icon: Brain },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${s.color}15`, color: s.color }}
              >
                <s.icon size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none" style={{ color: s.color, fontFamily: "var(--font-rajdhani), sans-serif" }}>
                  {s.value}
                </p>
                <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── 工具栏：搜索 + 筛选 + 多选切换 ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索提示词或任务名..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-colors"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(139,92,246,0.5)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </div>

          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
            style={{
              background: filtersOpen || activeFiltersCount > 0 ? "rgba(139,92,246,0.18)" : "var(--bg-card)",
              color: filtersOpen || activeFiltersCount > 0 ? "#c084fc" : "var(--text-secondary)",
              border: `1px solid ${filtersOpen || activeFiltersCount > 0 ? "rgba(139,92,246,0.45)" : "var(--border)"}`,
            }}
          >
            <Filter size={13} />
            筛选
            {activeFiltersCount > 0 && (
              <span className="ml-0.5 px-1.5 rounded-full font-bold" style={{ background: "rgba(139,92,246,0.3)", color: "#c084fc", fontSize: 10 }}>
                {activeFiltersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { if (selectMode) exitSelectMode(); else setSelectMode(true); }}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all"
            style={{
              background: selectMode ? "rgba(14,165,233,0.18)" : "var(--bg-card)",
              color: selectMode ? "#38bdf8" : "var(--text-secondary)",
              border: `1px solid ${selectMode ? "rgba(14,165,233,0.45)" : "var(--border)"}`,
            }}
          >
            {selectMode ? <CheckSquare size={13} /> : <Square size={13} />}
            {selectMode ? "退出多选" : "多选"}
          </button>
        </div>

        {/* ── 筛选展开区 ── */}
        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl p-4 space-y-3" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                {/* 模型 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold w-16 flex-shrink-0" style={{ color: "var(--text-muted)" }}>模型</span>
                  <button
                    onClick={() => setFilterModel("")}
                    className="px-3 py-1 rounded-full text-xs"
                    style={{
                      background: !filterModel ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.04)",
                      color: !filterModel ? "#c084fc" : "var(--text-secondary)",
                      border: `1px solid ${!filterModel ? "rgba(139,92,246,0.4)" : "var(--border)"}`,
                    }}
                  >
                    全部
                  </button>
                  {availableModels.map((m) => {
                    const meta = MODULE_META[m] ?? { label: m, color: "var(--text-secondary)" };
                    const active = filterModel === m;
                    return (
                      <button
                        key={m}
                        onClick={() => setFilterModel(m)}
                        className="px-3 py-1 rounded-full text-xs"
                        style={{
                          background: active ? `${meta.color}20` : "rgba(255,255,255,0.04)",
                          color: active ? meta.color : "var(--text-secondary)",
                          border: `1px solid ${active ? `${meta.color}50` : "var(--border)"}`,
                        }}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>

                {/* 画面比例 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold w-16 flex-shrink-0" style={{ color: "var(--text-muted)" }}>比例</span>
                  <button
                    onClick={() => setFilterAspect("")}
                    className="px-3 py-1 rounded-full text-xs"
                    style={{
                      background: !filterAspect ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.04)",
                      color: !filterAspect ? "#c084fc" : "var(--text-secondary)",
                      border: `1px solid ${!filterAspect ? "rgba(139,92,246,0.4)" : "var(--border)"}`,
                    }}
                  >
                    全部
                  </button>
                  {availableAspects.map((a) => {
                    const active = filterAspect === a;
                    return (
                      <button
                        key={a}
                        onClick={() => setFilterAspect(a)}
                        className="px-3 py-1 rounded-full text-xs font-mono"
                        style={{
                          background: active ? "rgba(14,165,233,0.18)" : "rgba(255,255,255,0.04)",
                          color: active ? "#38bdf8" : "var(--text-secondary)",
                          border: `1px solid ${active ? "rgba(14,165,233,0.4)" : "var(--border)"}`,
                        }}
                      >
                        {a || "auto"}
                      </button>
                    );
                  })}
                </div>

                {/* 开关筛选 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold w-16 flex-shrink-0" style={{ color: "var(--text-muted)" }}>属性</span>
                  <button
                    onClick={() => setFilterRefOnly(!filterRefOnly)}
                    className="flex items-center gap-1 px-3 py-1 rounded-full text-xs"
                    style={{
                      background: filterRefOnly ? "rgba(14,165,233,0.18)" : "rgba(255,255,255,0.04)",
                      color: filterRefOnly ? "#38bdf8" : "var(--text-secondary)",
                      border: `1px solid ${filterRefOnly ? "rgba(14,165,233,0.4)" : "var(--border)"}`,
                    }}
                  >
                    <FolderOpen size={11} />
                    仅图生图
                  </button>
                  <button
                    onClick={() => setFilterThinkingOnly(!filterThinkingOnly)}
                    className="flex items-center gap-1 px-3 py-1 rounded-full text-xs"
                    style={{
                      background: filterThinkingOnly ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.04)",
                      color: filterThinkingOnly ? "#c4b5fd" : "var(--text-secondary)",
                      border: `1px solid ${filterThinkingOnly ? "rgba(167,139,250,0.4)" : "var(--border)"}`,
                    }}
                  >
                    <Brain size={11} />
                    仅思考辅助
                  </button>
                  {activeFiltersCount > 0 && (
                    <button
                      onClick={resetFilters}
                      className="ml-auto text-xs"
                      style={{ color: "var(--text-muted)", textDecoration: "underline", textUnderlineOffset: 3 }}
                    >
                      重置全部
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 多选模式条 ── */}
        <AnimatePresence>
          {selectMode && (
            <motion.div
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{ background: "rgba(14,165,233,0.08)", border: "1px solid rgba(14,165,233,0.25)" }}
            >
              <span className="text-xs font-semibold" style={{ color: "#38bdf8" }}>
                已选 {selectedIds.size} 张
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>· 当前可选 {filtered.length} 张</span>
              <div className="flex-1" />
              <button onClick={selectAllVisible} className="text-xs px-2 py-1 rounded-md transition-colors" style={{ color: "var(--text-secondary)" }}>
                全选
              </button>
              <button onClick={clearSelection} className="text-xs px-2 py-1 rounded-md transition-colors" style={{ color: "var(--text-secondary)" }}>
                清空
              </button>
              <button
                onClick={batchDownload}
                disabled={selectedIds.size === 0 || downloading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: selectedIds.size > 0 ? "rgba(14,165,233,0.2)" : "rgba(255,255,255,0.04)",
                  color: selectedIds.size > 0 ? "#38bdf8" : "var(--text-muted)",
                  border: `1px solid ${selectedIds.size > 0 ? "rgba(14,165,233,0.4)" : "var(--border)"}`,
                  cursor: selectedIds.size === 0 || downloading ? "not-allowed" : "pointer",
                }}
              >
                <Download size={11} />
                {downloading ? "下载中..." : "批量下载"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 网格 ── */}
        {loading ? (
          <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>
            <p className="text-sm">加载中...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 rounded-2xl" style={{ background: "var(--bg-card)", border: "1px dashed var(--border)" }}>
            <ImageIcon size={40} className="mx-auto mb-3 opacity-30" style={{ color: "var(--text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {allAssets.length === 0 ? "还没有任何资产，去创作第一张图吧" : "没有匹配的图片，试试调整筛选条件"}
            </p>
            {activeFiltersCount > 0 && (
              <button
                onClick={resetFilters}
                className="mt-3 px-4 py-1.5 rounded-lg text-xs"
                style={{ background: "rgba(139,92,246,0.15)", color: "#c084fc", border: "1px solid rgba(139,92,246,0.3)" }}
              >
                重置筛选
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-7">
            {grouped.map((group) => (
              <div key={group.key}>
                <div className="flex items-baseline gap-2 mb-3">
                  <h2 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    {GROUP_LABELS[group.key]}
                  </h2>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>· {group.items.length} 张</span>
                </div>
                <div
                  className="grid gap-3"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
                >
                  {group.items.map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      selectMode={selectMode}
                      selected={selectedIds.has(asset.id)}
                      onToggleSelect={() => toggleSelect(asset.id)}
                      onLightbox={() => setLightbox(asset)}
                      onFeatured={() => setFeaturedTarget(asset)}
                      onJumpTask={() => router.push(`/tasks/${asset.taskId}`)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(16px)" }}
            onClick={() => setLightbox(null)}
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full"
              style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}
            >
              <X size={18} />
            </button>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <a
                href={lightbox.dlUrl}
                download={lightbox.filename}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: "rgba(14,165,233,0.7)", backdropFilter: "blur(10px)" }}
              >
                <Download size={14} />下载
              </a>
              <button
                onClick={() => { router.push(`/tasks/${lightbox.taskId}`); setLightbox(null); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)" }}
              >
                <Eye size={14} />查看任务
              </button>
            </div>
            <img
              src={lightbox.url}
              alt="放大预览"
              className="rounded-2xl object-contain shadow-2xl"
              style={{ maxWidth: "min(92vw, 1500px)", maxHeight: "85vh" }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 精选弹窗 */}
      {featuredTarget && (
        <FeaturedModal
          imageUrl={featuredTarget.url}
          prompt={featuredTarget.prompt}
          refImageUrl={featuredTarget.refPaths[0] ? `${API_BASE}/uploads/${featuredTarget.refPaths[0].replace(/\\/g, "/").split("/").pop()}` : undefined}
          onClose={() => setFeaturedTarget(null)}
        />
      )}
    </>
  );
}

// ── 单张资产卡 ──────────────────────────────────────────────────────────────

function ActionIconButton({
  title, icon, onClick, accent,
}: {
  title: string;
  icon: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-white transition-all"
      style={{
        background: accent ? `${accent}cc` : "rgba(255,255,255,0.2)",
        backdropFilter: "blur(10px)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = accent ? accent : "rgba(255,255,255,0.32)";
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = accent ? `${accent}cc` : "rgba(255,255,255,0.2)";
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
      }}
    >
      {icon}
    </button>
  );
}

function AssetCard({
  asset, selectMode, selected,
  onToggleSelect, onLightbox, onFeatured, onJumpTask,
}: {
  asset: AssetImage;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onLightbox: () => void;
  onFeatured: () => void;
  onJumpTask: () => void;
}) {
  const meta = MODULE_META[asset.model] ?? { label: asset.model, color: "var(--text-secondary)" };

  // 显示比例：用 aspect_ratio 反映真实图比例
  const ratioStyle = (() => {
    const a = asset.aspectRatio;
    if (a && a !== "auto" && a.includes(":")) return { aspectRatio: a.replace(":", "/") };
    return { aspectRatio: "1/1" };
  })();

  const handleClick = () => {
    if (selectMode) onToggleSelect();
    else onLightbox();
  };

  return (
    <div
      className="relative rounded-xl overflow-hidden cursor-pointer transition-all group"
      style={{
        ...ratioStyle,
        border: `2px solid ${selected ? "#38bdf8" : "transparent"}`,
        boxShadow: selected ? "0 0 0 2px rgba(56,189,248,0.25)" : "none",
        background: "rgba(255,255,255,0.04)",
      }}
      onClick={handleClick}
    >
      <img
        src={asset.url}
        alt={asset.filename}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.2"; }}
      />

      {/* 选择框（多选模式） */}
      {selectMode && (
        <div
          className="absolute top-2 left-2 w-5 h-5 rounded flex items-center justify-center transition-all"
          style={{
            background: selected ? "#38bdf8" : "rgba(0,0,0,0.55)",
            border: `1.5px solid ${selected ? "#38bdf8" : "rgba(255,255,255,0.4)"}`,
          }}
        >
          {selected && <CheckSquare size={11} color="#fff" />}
        </div>
      )}

      {/* 标签：思考模式 / 模型 */}
      {!selectMode && (
        <div className="absolute top-2 left-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <span
            className="px-1.5 py-0.5 rounded text-xs font-medium leading-none"
            style={{ background: "rgba(0,0,0,0.65)", color: meta.color, fontSize: 10, backdropFilter: "blur(8px)" }}
          >
            {meta.label}
          </span>
          {asset.hasThinking && (
            <span
              className="w-5 h-5 rounded flex items-center justify-center"
              style={{ background: "rgba(167,139,250,0.85)", color: "#fff", backdropFilter: "blur(8px)" }}
              title="思考辅助"
            >
              <Brain size={9} />
            </span>
          )}
        </div>
      )}

      {/* 时间标 */}
      {!selectMode && (
        <div
          className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(0,0,0,0.65)", color: "rgba(255,255,255,0.85)", fontSize: 10, backdropFilter: "blur(8px)" }}
        >
          {asset.createdAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}

      {/* hover 操作浮层 */}
      {!selectMode && (
        <div
          className="absolute inset-0 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 50%, transparent 100%)" }}
        >
          {/* 底部操作栏：紧凑水平图标按钮 — 任意比例图都能放下 */}
          <div className="flex items-center justify-center gap-1.5 p-2.5">
            <ActionIconButton
              title="放大"
              icon={<Eye size={13} />}
              onClick={(e) => { e.stopPropagation(); onLightbox(); }}
            />
            <a
              href={asset.dlUrl}
              download={asset.filename}
              onClick={(e) => e.stopPropagation()}
              title="下载"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white transition-all"
              style={{ background: "rgba(14,165,233,0.7)", backdropFilter: "blur(10px)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(14,165,233,0.9)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(14,165,233,0.7)"; }}
            >
              <Download size={13} />
            </a>
            <ActionIconButton
              title="精选"
              icon={<Star size={13} />}
              onClick={(e) => { e.stopPropagation(); onFeatured(); }}
              accent="#fbbf24"
            />
            <ActionIconButton
              title="查看任务"
              icon={<Sparkles size={13} />}
              onClick={(e) => { e.stopPropagation(); onJumpTask(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
