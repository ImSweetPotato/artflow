"use client";

import { useState } from "react";
import { X, Star, Check, Plus, Search, Trash2, Globe } from "lucide-react";
import {
  CATEGORIES,
  InspirationCase,
} from "@/lib/inspiration-data";
import { useFeatured } from "@/hooks/useFeatured";
import { useCustomCategories } from "@/hooks/useCustomCategories";
import { useProjectCategories } from "@/hooks/useProjectCategories";
import { useAuth } from "@/contexts/AuthContext";
import PromptDisplay from "@/components/PromptDisplay";

const PRESET_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  portrait:   { bg: "rgba(244,114,182,0.12)", color: "#f472b6", border: "rgba(244,114,182,0.3)" },
  poster:     { bg: "rgba(96,165,250,0.12)",  color: "#60a5fa", border: "rgba(96,165,250,0.3)" },
  character:  { bg: "rgba(52,211,153,0.12)",  color: "#34d399", border: "rgba(52,211,153,0.3)" },
  ui:         { bg: "rgba(251,191,36,0.12)",  color: "#fbbf24", border: "rgba(251,191,36,0.3)" },
  comparison: { bg: "rgba(251,146,60,0.12)",  color: "#fb923c", border: "rgba(251,146,60,0.3)" },
  ecommerce:  { bg: "rgba(139,92,246,0.12)",  color: "#a78bfa", border: "rgba(139,92,246,0.3)" },
};
const CUSTOM_COLOR = { bg: "rgba(251,191,36,0.15)", color: "#fde68a", border: "rgba(251,191,36,0.5)" };

function loadLastCategory(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("artflow_last_featured_category") ?? "";
}

interface Props {
  imageUrl: string;
  prompt: string;
  refImageUrl?: string; // 创作时使用的原始参考图 URL
  onClose: () => void;
  onDone?: () => void;
}

export default function FeaturedModal({ imageUrl, prompt, refImageUrl: refImgUrl, onClose, onDone }: Props) {
  const { user } = useAuth();
  const { addFeatured, publishFeatured } = useFeatured();
  const { customCategories, addCustomCategory, removeCustomCategory } = useCustomCategories();
  const { projectCategories, addSharedProjectCategory, removeSharedProjectCategory } = useProjectCategories();

  const [title, setTitle] = useState(() => {
    const d = new Date();
    return `精选_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [selectedCategory, setSelectedCategory] = useState(() => loadLastCategory());
  const [saved, setSaved] = useState(false);

  // 新建分类相关
  const [showNewInput, setShowNewInput] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [showNewProjectInput, setShowNewProjectInput] = useState(false);
  const [newProjectLabel, setNewProjectLabel] = useState("");

  // 内置 Lightbox（点击图片放大）
  const [lightbox, setLightbox] = useState<string | null>(null);

  const presetCategories = CATEGORIES.filter((c) => c.key !== "");
  const isAdmin = Boolean(user?.isAdmin);
  const selectedProjectCategory = projectCategories.find((c) => c.key === selectedCategory);
  const selectedPresetCategory = presetCategories.find((c) => c.key === selectedCategory);
  const selectedCustomCategory = customCategories.find((c) => c.key === selectedCategory);
  const isProjectSelection = Boolean(selectedProjectCategory);

  const handleConfirm = async () => {
    if (!selectedCategory) return;

    const categoryLabel = selectedProjectCategory?.label ?? selectedPresetCategory?.label ?? selectedCustomCategory?.label ?? selectedCategory;

    const newItem: InspirationCase = {
      id: `featured_${Date.now()}`,
      category: selectedCategory,
      categoryLabel,
      title: title.trim() || "我的精选",
      author: "我的精选",
      prompt,
      folder: "",
      imageUrl,
      ...(refImgUrl ? { refImageUrl: refImgUrl } : {}),
      isFeatured: true,
    };
    setSaved(true);
    localStorage.setItem("artflow_last_featured_category", selectedCategory);
    const created = await addFeatured(newItem);
    if (!created) {
      setSaved(false);
      return;
    }
    if (isAdmin && isProjectSelection) {
      await publishFeatured(created.id);
    }
    setTimeout(() => {
      onDone?.();
      onClose();
    }, 900);
  };

  const handleAddCategory = async () => {
    const label = newLabel.trim();
    if (!label) return;
    const newCat = await addCustomCategory(label);
    setSelectedCategory(newCat.key);
    setNewLabel("");
    setShowNewInput(false);
  };

  const handleAddProjectCategory = async () => {
    const label = newProjectLabel.trim();
    if (!label) return;
    const newCat = await addSharedProjectCategory(label);
    setSelectedCategory(newCat.key);
    setNewProjectLabel("");
    setShowNewProjectInput(false);
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
            maxWidth: 980,
            maxHeight: "90vh",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(251,191,36,0.25)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 关闭 */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-all"
            style={{ background: "rgba(0,0,0,0.6)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
          >
            <X size={14} />
          </button>

          {/* ── 左侧：生成结果图（可点击放大） ── */}
          <div
            className="relative flex-shrink-0 overflow-hidden group cursor-zoom-in"
            style={{
              width: "100%",
              maxWidth: 440,
              background: "rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 320,
            }}
            onClick={() => setLightbox(imageUrl)}
          >
            <img
              src={imageUrl}
              alt="精选预览"
              className="w-full transition-transform duration-300 group-hover:scale-105"
              style={{ display: "block", maxHeight: "90vh", objectFit: "contain" }}
            />
            {/* 顶部标签 */}
            <div
              className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5"
              style={{ background: "rgba(251,191,36,0.25)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.5)", backdropFilter: "blur(10px)" }}
            >
              <Star size={10} />精选预览
            </div>
            {/* 放大提示覆层 */}
            <div
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ background: "rgba(0,0,0,0.25)" }}
            >
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white" style={{ background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)" }}>
                <Search size={12} />点击放大
              </div>
            </div>
          </div>

          {/* ── 右侧：表单 ── */}
          <div className="flex flex-col flex-1 min-w-0 overflow-y-auto" style={{ maxHeight: "90vh" }}>
            {/* 头部 */}
            <div className="flex items-center gap-2 px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
              <Star size={16} style={{ color: "#fbbf24" }} />
              <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>精选到灵感广场</span>
            </div>

            <div className="p-5 space-y-4 flex-1">
              {/* 创作参考图（如有） */}
              {refImgUrl && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
                    创作时使用的参考图
                  </p>
                  <div
                    className="relative group cursor-zoom-in rounded-xl overflow-hidden"
                    style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.3)" }}
                    onClick={() => setLightbox(refImgUrl)}
                  >
                    <img
                      src={refImgUrl}
                      alt="参考图"
                      className="w-full transition-transform duration-300 group-hover:scale-105"
                      style={{ display: "block", maxHeight: 180, objectFit: "contain" }}
                      onError={(e) => { (e.currentTarget.parentElement as HTMLDivElement).style.display = "none"; }}
                    />
                    <div
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      style={{ background: "rgba(0,0,0,0.25)" }}
                    >
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-white" style={{ background: "rgba(0,0,0,0.6)" }}>
                        <Search size={11} />放大
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 提示词 */}
              <PromptDisplay prompt={prompt} label="提示词" />

              {/* 标题 */}
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  标题
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  onFocus={(e) => (e.target.style.borderColor = "rgba(139,92,246,0.5)")}
                  onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
                />
              </div>

              {/* 分类选择 */}
              <div>
                <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                  分类 <span style={{ color: "#f87171" }}>*</span>
                </label>

                {isAdmin && (
                  <div className="mb-3 rounded-2xl p-3" style={{ background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.18)" }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Globe size={13} style={{ color: "#5eead4" }} />
                      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#99f6e4" }}>
                        项目精选分类
                      </span>
                    </div>
                    {projectCategories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {projectCategories.map((cat) => {
                          const active = selectedCategory === cat.key;
                          return (
                            <div
                              key={cat.key}
                              className="group flex items-center gap-1 rounded-xl text-xs font-medium transition-all cursor-pointer select-none"
                              style={{
                                background: active ? "rgba(45,212,191,0.16)" : "rgba(255,255,255,0.03)",
                                color: active ? "#99f6e4" : "var(--text-secondary)",
                                border: `1px solid ${active ? "rgba(45,212,191,0.45)" : "var(--border)"}`,
                                padding: "6px 10px",
                              }}
                              onClick={() => setSelectedCategory(cat.key)}
                            >
                              {cat.label}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeSharedProjectCategory(cat.key);
                                  if (selectedCategory === cat.key) setSelectedCategory("");
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
                                style={{ color: "rgba(239,68,68,0.7)" }}
                                title="删除项目分类"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {showNewProjectInput ? (
                      <div className="flex gap-1.5">
                        <input
                          autoFocus
                          type="text"
                          value={newProjectLabel}
                          onChange={(e) => setNewProjectLabel(e.target.value)}
                          placeholder="项目分类名称，如：项目精选A组"
                          className="flex-1 px-3 py-1.5 rounded-xl text-xs outline-none"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(45,212,191,0.35)", color: "var(--text-primary)" }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddProjectCategory();
                            if (e.key === "Escape") { setShowNewProjectInput(false); setNewProjectLabel(""); }
                          }}
                        />
                        <button
                          onClick={handleAddProjectCategory}
                          disabled={!newProjectLabel.trim()}
                          className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                          style={{
                            background: newProjectLabel.trim() ? "rgba(45,212,191,0.16)" : "rgba(255,255,255,0.03)",
                            color: newProjectLabel.trim() ? "#99f6e4" : "var(--text-muted)",
                            border: `1px solid ${newProjectLabel.trim() ? "rgba(45,212,191,0.42)" : "var(--border)"}`,
                          }}
                        >
                          确认
                        </button>
                        <button
                          onClick={() => { setShowNewProjectInput(false); setNewProjectLabel(""); }}
                          className="px-3 py-1.5 rounded-xl text-xs"
                          style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowNewProjectInput(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all"
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          color: "#99f6e4",
                          border: "1px dashed rgba(45,212,191,0.35)",
                        }}
                      >
                        <Plus size={11} />
                        新建项目分类
                      </button>
                    )}
                  </div>
                )}

                {/* 预设分类 */}
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  {presetCategories.map((cat) => {
                    const active = selectedCategory === cat.key;
                    const colors = PRESET_COLORS[cat.key] ?? { bg: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", border: "var(--border)" };
                    return (
                      <button
                        key={cat.key}
                        onClick={() => setSelectedCategory(cat.key)}
                        className="py-2 px-2 rounded-xl text-xs font-medium text-center transition-all"
                        style={{
                          background: active ? colors.bg : "rgba(255,255,255,0.03)",
                          color: active ? colors.color : "var(--text-secondary)",
                          border: `1px solid ${active ? colors.border : "var(--border)"}`,
                        }}
                      >
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                {/* 自定义分类 */}
                {customCategories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {customCategories.map((cat) => {
                      const active = selectedCategory === cat.key;
                      return (
                        <div
                          key={cat.key}
                          className="group flex items-center gap-1 rounded-xl text-xs font-medium transition-all cursor-pointer select-none"
                          style={{
                            background: active ? CUSTOM_COLOR.bg : "rgba(255,255,255,0.03)",
                            color: active ? CUSTOM_COLOR.color : "var(--text-secondary)",
                            border: `1px solid ${active ? CUSTOM_COLOR.border : "var(--border)"}`,
                            padding: "6px 10px",
                          }}
                          onClick={() => setSelectedCategory(cat.key)}
                        >
                          {cat.label}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCustomCategory(cat.key);
                              if (selectedCategory === cat.key) setSelectedCategory("");
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
                            style={{ color: "rgba(239,68,68,0.7)" }}
                            title="删除分类"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 新建分类 */}
                {showNewInput ? (
                  <div className="flex gap-1.5">
                    <input
                      autoFocus
                      type="text"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="分类名称，如：项目A、UI设计2026"
                      className="flex-1 px-3 py-1.5 rounded-xl text-xs outline-none"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,179,237,0.4)", color: "var(--text-primary)" }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddCategory();
                        if (e.key === "Escape") { setShowNewInput(false); setNewLabel(""); }
                      }}
                    />
                    <button
                      onClick={handleAddCategory}
                      disabled={!newLabel.trim()}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                      style={{
                        background: newLabel.trim() ? CUSTOM_COLOR.bg : "rgba(255,255,255,0.03)",
                        color: newLabel.trim() ? CUSTOM_COLOR.color : "var(--text-muted)",
                        border: `1px solid ${newLabel.trim() ? CUSTOM_COLOR.border : "var(--border)"}`,
                      }}
                    >
                      确认
                    </button>
                    <button
                      onClick={() => { setShowNewInput(false); setNewLabel(""); }}
                      className="px-3 py-1.5 rounded-xl text-xs"
                      style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewInput(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      color: "var(--text-muted)",
                      border: "1px dashed var(--border)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = CUSTOM_COLOR.border;
                      (e.currentTarget as HTMLButtonElement).style.color = CUSTOM_COLOR.color;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
                    }}
                  >
                    <Plus size={11} />
                    新建自定义分类
                  </button>
                )}
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex gap-2 px-5 py-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedCategory || saved}
                className="flex-[2] flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: saved
                    ? "rgba(52,211,153,0.2)"
                    : selectedCategory
                      ? "linear-gradient(135deg, rgba(251,191,36,0.25), rgba(245,158,11,0.25))"
                      : "rgba(255,255,255,0.04)",
                  color: saved ? "#34d399" : selectedCategory ? "#fde68a" : "var(--text-muted)",
                  border: `1px solid ${saved ? "rgba(52,211,153,0.4)" : selectedCategory ? "rgba(251,191,36,0.5)" : "var(--border)"}`,
                  cursor: !selectedCategory ? "not-allowed" : "pointer",
                  boxShadow: selectedCategory && !saved ? "0 0 16px rgba(251,191,36,0.2)" : "none",
                }}
              >
                {saved ? <><Check size={13} />{isProjectSelection ? "已推送到项目精选" : "已收藏"}</> : <><Star size={13} />{isProjectSelection ? "推送到项目精选" : "收藏精选"}</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox（覆盖在弹窗之上） */}
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
            alt="放大预览"
            className="rounded-2xl object-contain shadow-2xl"
            style={{ maxWidth: "min(92vw, 1400px)", maxHeight: "92vh" }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
