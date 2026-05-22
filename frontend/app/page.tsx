"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, BookOpen, FolderOpen, Sparkles, Wand2, Zap } from "lucide-react";
import ChangelogPanel from "@/components/ChangelogPanel";
import GenerationSystemNotice from "@/components/GenerationSystemNotice";
import { useBrowseOnlyMode } from "@/hooks/useBrowseOnlyMode";

const supportCardsDefault = [
  {
    title: "灵感广场",
    desc: "从精选提示词案例里直接找构图、风格和游戏向表达方式。",
    href: "/inspiration/gptimage2",
    icon: Sparkles,
    accent: "#14b8a6",
  },
  {
    title: "我的资产",
    desc: "集中查看当前账号生成的图片成果，方便回看与继续加工。",
    href: "/assets",
    icon: FolderOpen,
    accent: "#f59e0b",
  },
  {
    title: "使用教程",
    desc: "快速了解平台用法、推荐流程和适合司内项目的使用方式。",
    href: "/tutorial",
    icon: BookOpen,
    accent: "#6366f1",
  },
];

const stats = [
  { value: "Prompt → Image", label: "核心链路" },
  { value: "Game-ready", label: "面向游戏项目" },
  { value: "Async Queue", label: "异步生成" },
  { value: "Internal Beta", label: "司内测试中" },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function Home() {
  const { isBrowseOnly, blockCreateAction } = useBrowseOnlyMode();
  const supportCards = isBrowseOnly
    ? [
        {
          title: "ComfyUI 工作流",
          desc: "无需 SOFUNNY_API_KEY，直接进入萌宠旅人工作流进行图生图与局部修改。",
          href: "/workflow/pet-traveler",
          icon: Wand2,
          accent: "#14b8a6",
        },
        {
          title: "灵感广场",
          desc: "从精选提示词案例里直接找构图、风格和游戏向表达方式。",
          href: "/inspiration/gptimage2",
          icon: Sparkles,
          accent: "#14b8a6",
        },
        {
          title: "使用教程",
          desc: "快速了解平台用法、推荐流程和适合司内项目的使用方式。",
          href: "/tutorial",
          icon: BookOpen,
          accent: "#6366f1",
        },
        {
          title: "补充 API_KEY",
          desc: "需要使用 GPT-Image-2 时，回到绑定页补充个人 SOFUNNY_API_KEY。",
          href: "/setup/api-key",
          icon: FolderOpen,
          accent: "#f59e0b",
        },
      ]
    : supportCardsDefault;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="relative max-w-6xl mx-auto space-y-6 pb-8"
      style={{ zIndex: 1 }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-16 -left-10 w-[32rem] h-[32rem] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(139,92,246,0.12), transparent 68%)" }}
        />
        <div
          className="absolute top-24 right-0 w-[26rem] h-[26rem] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(56,189,248,0.1), transparent 70%)" }}
        />
        <div
          className="absolute bottom-10 left-1/3 w-[24rem] h-[24rem] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(236,72,153,0.08), transparent 70%)" }}
        />
      </div>

      <motion.section variants={item}>
        <div
          className="glass rounded-[32px] p-6 md:p-8 lg:p-10 relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, rgba(124,58,237,0.16), rgba(56,189,248,0.08) 52%, rgba(236,72,153,0.08)), var(--bg-card)",
          }}
        >
          <div
            className="absolute top-0 right-0 w-72 h-72 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08), transparent 72%)" }}
          />

          <div className="relative grid gap-7 lg:gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:items-start">
            <div className="space-y-6 lg:space-y-8 pt-1">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-[0.22em] uppercase"
                style={{ background: "var(--brand-badge-bg)", color: "var(--brand-badge-text)", border: "1px solid var(--brand-badge-border)" }}>
                <Wand2 size={12} />
                Sofunny ArtFlow
              </div>

              <div className="space-y-4 max-w-[40rem]">
                <h1
                  className="font-bold"
                  style={{
                    fontFamily: "var(--font-rajdhani), sans-serif",
                    color: "var(--text-primary)",
                    fontSize: "clamp(2.9rem, 5.3vw, 4.45rem)",
                    lineHeight: 0.94,
                    letterSpacing: "-0.035em",
                  }}
                >
                  <span
                    className="block text-[0.31em] font-semibold uppercase tracking-[0.18em] mb-4 md:mb-5"
                    style={{ color: "var(--text-secondary)", letterSpacing: "0.14em", lineHeight: 1.15 }}
                  >
                    给游戏项目组的
                  </span>
                  <span className="block gradient-text">AI 视觉创作台</span>
                </h1>
                <p className="max-w-[34rem] text-[15px] md:text-[15.5px] leading-7" style={{ color: "var(--text-secondary)" }}>
                  把灵感、提示词、原画和工作流收进一个统一界面里。更快试方向，更快出可讨论的图，更适合内部项目协作。
                </p>
              </div>

              <div className="flex flex-wrap gap-3 pt-1.5">
                {isBrowseOnly ? (
                  <Link href="/workflow/pet-traveler">
                    <div className="btn-glow inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-white">
                      打开 ComfyUI 工作流
                      <ArrowRight size={15} />
                    </div>
                  </Link>
                ) : (
                  <Link href="/create/gptimage2">
                    <div className="btn-glow inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold text-white">
                      开始创作
                      <ArrowRight size={15} />
                    </div>
                  </Link>
                )}
                <Link href="/inspiration/gptimage2">
                  <div
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold"
                    style={{ background: "var(--bg-surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  >
                    查看提示词精选
                    <Sparkles size={15} />
                  </div>
                </Link>
              </div>

              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 pt-2 max-w-[44rem]">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-2xl px-4 py-3.5 min-h-[84px] flex flex-col justify-between"
                    style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                  >
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-rajdhani), sans-serif" }}>
                      {stat.value}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:pt-1">
              <div
                className="rounded-[28px] p-5 md:p-6 relative overflow-hidden"
                style={{
                  background:
                    "linear-gradient(160deg, rgba(14,165,233,0.08), rgba(139,92,246,0.08) 48%, rgba(236,72,153,0.06)), var(--bg-card)",
                  border: "1px solid var(--border)",
                  boxShadow: "var(--panel-shadow)",
                }}
              >
                <div
                  className="absolute -top-10 -right-8 w-36 h-36 rounded-full"
                  style={{ background: "radial-gradient(circle, rgba(56,189,248,0.16), transparent 70%)" }}
                />
                <div className="relative space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>
                        Current Focus
                      </p>
                      <p className="text-lg font-bold mt-1" style={{ color: "var(--text-primary)" }}>
                        GPT-Image-2 Pipeline
                      </p>
                    </div>
                    <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.2)" }}>
                      <Zap size={18} style={{ color: "#0ea5e9" }} />
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: "提示词构思", hint: "灵感广场 / 快速复制", color: "#8b5cf6" },
                      { label: "生成与复用", hint: "任务记录 / 一键再创作", color: "#38bdf8" },
                      { label: "项目宣发延展", hint: "原画转宣发图工作流", color: "#ec4899" },
                    ].map((row) => (
                      <div
                        key={row.label}
                        className="rounded-2xl px-4 py-3 flex items-center justify-between"
                        style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: row.color, boxShadow: `0 0 12px ${row.color}` }} />
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{row.label}</p>
                            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{row.hint}</p>
                          </div>
                        </div>
                        <ArrowRight size={14} style={{ color: "var(--text-muted)" }} />
                      </div>
                    ))}
                  </div>

                  <div
                    className="pt-5"
                    style={{ borderTop: "1px solid var(--divider-soft)" }}
                  >
                    <GenerationSystemNotice />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.section variants={item} className="space-y-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-2" style={{ color: "var(--text-muted)" }}>
            版本动态
          </p>
          <h2
            className="text-[1.8rem] font-bold"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-rajdhani), sans-serif" }}
          >
            最近更新
          </h2>
        </div>
        <ChangelogPanel />
      </motion.section>

      <motion.section variants={item} className="space-y-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-2" style={{ color: "var(--text-muted)" }}>
            支撑入口
          </p>
          <h2
            className="text-[1.8rem] font-bold"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-rajdhani), sans-serif" }}
          >
            {isBrowseOnly ? "找灵感、看教程、准备创作" : "找灵感、看资产、快速上手"}
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {supportCards.map((card) => (
            <Link key={card.href} href={card.href}>
              <motion.div whileHover={{ y: -3 }} className="glass rounded-[24px] p-5 h-full group">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: `${card.accent}16` }}
                >
                  <card.icon size={18} style={{ color: card.accent }} />
                </div>
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
                  {card.title}
                </h3>
                <p className="text-sm mt-2 leading-6" style={{ color: "var(--text-secondary)" }}>
                  {card.desc}
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: card.accent }}>
                  前往查看
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}
