"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Wand2, FolderOpen, User, BookOpen,
  ChevronDown, ImageIcon, Megaphone, Zap, History, Workflow, Sparkles,
} from "lucide-react";
import clsx from "clsx";
import { useTabContext } from "@/contexts/TabContext";
import { useBrowseOnlyMode } from "@/hooks/useBrowseOnlyMode";

type NavLeaf = {
  label: string;
  href: string;
  icon: typeof Home;
  subtitle?: string;
  tabLabel?: string;
};

type NavItem =
  | { label: string; href: string; icon: typeof Home }
  | { label: string; icon: typeof Home; prefix: string; children: NavLeaf[] };

const navGroups: NavItem[] = [
  { label: "首页", href: "/", icon: Home },
  {
    label: "灵感广场",
    icon: Sparkles,
    prefix: "/inspiration",
    children: [
      {
        label: "GPT-Image-2",
        subtitle: "提示词精选",
        tabLabel: "GPT-Image-2 提示词精选",
        href: "/inspiration/gptimage2",
        icon: Zap,
      },
    ],
  },
  {
    label: "创作",
    icon: Wand2,
    prefix: "/create",
    children: [
      { label: "GPT-Image-2 生图", href: "/create/gptimage2", icon: Zap },
    ],
  },
  {
    label: "ComfyUI 工作流",
    icon: Workflow,
    prefix: "/workflow",
    children: [
      {
        label: "萌宠旅人",
        subtitle: "图生图 / 局部修改",
        href: "/workflow/pet-traveler",
        icon: Workflow,
      },
    ],
  },
  { label: "生图历史",  href: "/tasks",   icon: History },
  { label: "资产",      href: "/assets",  icon: FolderOpen },
  { label: "个人中心",  href: "/profile", icon: User },
  { label: "教程",      href: "/tutorial", icon: BookOpen },
];

type GroupItem = Extract<NavItem, { children: NavLeaf[] }>;

function NavGroup({ item, pathname }: { item: GroupItem; pathname: string }) {
  const isGroupActive = pathname.startsWith(item.prefix!);
  const [open, setOpen] = useState(true);
  const router = useRouter();
  const { openTab } = useTabContext();

  const navigate = (href: string, label: string) => {
    openTab({ href, label });
    router.push(href);
  };

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={clsx("sidebar-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium", isGroupActive && "active")}
        style={{
          color: isGroupActive ? "var(--nav-active-text)" : "var(--text-secondary)",
          background: isGroupActive ? "var(--nav-active-bg)" : "transparent",
        }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: isGroupActive ? "var(--bg-nav-icon-active)" : "var(--bg-nav-icon)" }}
        >
          <item.icon size={15} />
        </div>
        <span className="flex-1 text-left">{item.label}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={13} />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-5 mt-0.5 space-y-0.5 pl-3" style={{ borderLeft: "1px solid var(--border)" }}>
              {item.children.map((child) => {
                const active = pathname === child.href;
                return (
                  <div
                    key={child.href}
                    onClick={() => navigate(child.href, child.tabLabel ?? child.label)}
                    className={clsx("sidebar-item flex items-start gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer", active && "active")}
                    style={{
                      color: active ? "var(--nav-active-text)" : "var(--text-secondary)",
                      background: active ? "var(--nav-active-bg)" : "transparent",
                      fontWeight: active ? 500 : 400,
                    }}
                  >
                    <child.icon size={13} className="mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 leading-tight">
                      <div className="text-xs">{child.label}</div>
                      {child.subtitle && (
                        <div
                          className="text-[11px] mt-0.5"
                          style={{ color: active ? "var(--nav-active-subtle)" : "var(--text-muted)" }}
                        >
                          {child.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { openTab } = useTabContext();
  const { isBrowseOnly } = useBrowseOnlyMode();

  const visibleNavGroups = isBrowseOnly
    ? navGroups.filter((item) => item.label === "首页" || item.label === "灵感广场" || item.label === "教程" || item.label === "ComfyUI 工作流")
    : navGroups;

  const navigate = (href: string, label: string) => {
    openTab({ href, label });
    router.push(href);
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen z-30 flex flex-col"
      style={{
        width: "var(--sidebar-w)",
        background: "var(--bg-sidebar)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRight: "1px solid var(--border)",
        boxShadow: "var(--panel-shadow)",
      }}
    >
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-5" style={{ borderBottom: "1px solid var(--border)" }}>
        <img
          src="/brand/logo.png"
          alt="ArtFlow Logo"
          className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
          style={{ boxShadow: "0 0 12px rgba(139,92,246,0.35)" }}
        />
        <span
          className="text-lg font-bold tracking-wide"
          style={{ fontFamily: "var(--font-rajdhani), sans-serif", background: "linear-gradient(135deg, #a78bfa, #f472b6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
        >
          Sofunny ArtFlow
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {visibleNavGroups.map((item) => {
          if ("children" in item) {
            return (
              <NavGroup
                key={item.label}
                item={item}
                pathname={pathname}
              />
            );
          }
          const isActive = pathname === item.href;
          return (
            <div
              key={item.href}
              onClick={() => navigate(item.href!, item.label)}
              className={clsx("sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer", isActive && "active")}
              style={{
                color: isActive ? "var(--nav-active-text)" : "var(--text-secondary)",
                background: isActive ? "var(--nav-active-bg)" : "transparent",
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: isActive ? "var(--bg-nav-icon-active)" : "var(--bg-nav-icon)" }}
              >
                <item.icon size={15} />
              </div>
              {item.label}
            </div>
          );
        })}
      </nav>

      {/* 底部版本 */}
      <div className="px-5 py-4" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Sofunny ArtFlow v1.0</p>
      </div>
    </aside>
  );
}
