"use client";

import { useState, useRef, useEffect } from "react";
import { Sun, Moon, User, LogOut, RefreshCw, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "./ThemeProvider";
import { useAuth } from "@/contexts/AuthContext";
import TabBar from "./TabBar";

// 快速切换的预设账号（开发/测试用）
const QUICK_SWITCH_ACCOUNTS = [
  { username: "admin", label: "管理员", isAdmin: true },
  { username: "test001", label: "test001", isAdmin: false },
];

export default function TopBar() {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const handleQuickSwitch = (username: string) => {
    logout();
    router.replace(`/login?prefill=${encodeURIComponent(username)}`);
  };

  const otherAccounts = QUICK_SWITCH_ACCOUNTS.filter(
    (a) => a.username !== user?.username,
  );

  // 用户头像渐变
  const avatarGradient = user?.isAdmin
    ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
    : "linear-gradient(135deg, #7c3aed, #ec4899)";

  return (
    <header
      className="fixed top-0 right-0 z-20 flex items-stretch"
      style={{
        left: "var(--sidebar-w)",
        height: "var(--topbar-h)",
        background: "var(--bg-topbar)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "var(--topbar-shadow)",
      }}
    >
      {/* 顶栏底部高光（细微紫色渐变线） */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(123,92,238,0.16) 30%, rgba(244,114,182,0.1) 70%, transparent)",
        }}
      />

      {/* 左侧：Tab 条 */}
      <TabBar />

      {/* 右侧：操作控件 */}
      <div
        className="flex items-center gap-2 px-3 flex-shrink-0"
        style={{ borderLeft: "1px solid var(--border)" }}
      >
        {/* 主题切换 */}
        <button
          onClick={toggle}
          className="w-9 h-9 flex items-center justify-center rounded-lg transition-all relative group"
          style={{
            color: "var(--text-secondary)",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
          }}
          title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface-hover)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
          }}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* 用户菜单 */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl transition-all"
            style={{
              background: menuOpen ? "var(--bg-surface-hover)" : "var(--bg-surface)",
              border: `1px solid ${menuOpen ? "rgba(139,92,246,0.35)" : "var(--border)"}`,
              color: "var(--text-primary)",
              boxShadow: menuOpen ? "0 0 0 3px rgba(139,92,246,0.08)" : "none",
            }}
            onMouseEnter={(e) => {
              if (!menuOpen) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface-hover)";
            }}
            onMouseLeave={(e) => {
              if (!menuOpen) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface)";
            }}
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 relative"
              style={{ background: avatarGradient, boxShadow: "0 2px 8px rgba(124,58,237,0.35)" }}
            >
              <User size={13} color="#fff" />
              {user?.isAdmin && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                  style={{ background: "#fbbf24", border: "1.5px solid var(--bg-topbar)" }}
                  title="管理员"
                />
              )}
            </div>
            <span className="text-xs font-semibold max-w-[80px] truncate">
              {user?.displayName || "我的"}
            </span>
            <ChevronDown
              size={11}
              style={{
                color: "var(--text-muted)",
                transform: menuOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-1"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                boxShadow: "var(--panel-shadow)",
                zIndex: 50,
                backdropFilter: "blur(24px)",
              }}
            >
              {/* 当前用户信息 */}
              <div
                className="px-3 py-3"
                style={{
                  borderBottom: "1px solid var(--border)",
                  background: "linear-gradient(135deg, rgba(139,92,246,0.06), rgba(236,72,153,0.04))",
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 relative"
                    style={{ background: avatarGradient, boxShadow: "0 4px 14px rgba(124,58,237,0.4)" }}
                  >
                    <User size={16} color="#fff" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
                      {user?.displayName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        @{user?.username}
                      </span>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                        style={{
                          background: user?.isAdmin ? "rgba(251,191,36,0.15)" : "rgba(139,92,246,0.12)",
                          color: user?.isAdmin ? "#fbbf24" : "#a78bfa",
                          fontSize: 10,
                        }}
                      >
                        {user?.isAdmin ? "管理员" : "普通用户"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 快速切换区（仅管理员可见） */}
              {user?.isAdmin && otherAccounts.length > 0 && (
                <div style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="px-3 pt-2.5 pb-1 text-xs font-semibold flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                    <RefreshCw size={10} />
                    快速切换账号
                  </p>
                  <div className="pb-1">
                    {otherAccounts.map((acct) => (
                      <button
                        key={acct.username}
                        onClick={() => handleQuickSwitch(acct.username)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors"
                        style={{ color: "var(--text-secondary)" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-surface-hover)";
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                          (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
                        }}
                      >
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{
                            background: acct.isAdmin
                              ? "linear-gradient(135deg, #4f46e5, #7c3aed)"
                              : "linear-gradient(135deg, #7c3aed, #ec4899)",
                          }}
                        >
                          <User size={11} color="#fff" />
                        </div>
                        <span className="font-medium">{acct.label}</span>
                        <span className="ml-auto text-xs" style={{ color: "var(--text-muted)", fontSize: 10 }}>
                          {acct.isAdmin ? "管理员" : "普通"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 退出登录 */}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors"
                style={{ color: "#f87171" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <LogOut size={13} />
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
