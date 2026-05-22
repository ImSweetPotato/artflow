"use client";

import { useEffect, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { isBrowseOnlyPathAllowed } from "@/lib/access";
import { useBrowseOnlyMode } from "@/hooks/useBrowseOnlyMode";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const { isBrowseOnly, isMockBrowseOnly, isRealBrowseOnly, exitMockBrowseOnly } = useBrowseOnlyMode();
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === "/login";
  const isSetupApiKeyPage = pathname === "/setup/api-key";
  const isBarePage = isLoginPage || isSetupApiKeyPage;
  const canBrowseCurrentPath = isBrowseOnlyPathAllowed(pathname);

  useEffect(() => {
    if (isLoading) return;
    if (!user && !isLoginPage) {
      router.replace("/login");
      return;
    }
    if (isBrowseOnly) {
      if (!canBrowseCurrentPath) {
        router.replace("/setup/api-key");
      }
      return;
    }
    if (user?.hasSofunnyKey === false) {
      if (!isSetupApiKeyPage) {
        router.replace("/setup/api-key");
      }
      return;
    }
    if (user?.hasSofunnyKey && isSetupApiKeyPage) {
      router.replace("/");
    }
  }, [user, isLoading, isLoginPage, isSetupApiKeyPage, isBrowseOnly, canBrowseCurrentPath, router]);

  // 登录页 / 绑定 key 页：裸页面，不渲染 Sidebar/TopBar
  if (isBarePage) {
    return <>{children}</>;
  }

  // 等待 auth 状态恢复，避免未登录内容闪烁
  if (isLoading || !user) {
    return null;
  }
  if (isBrowseOnly) {
    if (!canBrowseCurrentPath) return null;
  } else if (user.hasSofunnyKey === false && !isSetupApiKeyPage) {
    return null;
  }
  if (!isBrowseOnly && user.hasSofunnyKey && isSetupApiKeyPage) {
    return null;
  }

  // 已登录：完整应用 Shell
  return (
    <div className="flex h-full relative z-10">
      <Sidebar />
      <div className="flex flex-col flex-1" style={{ marginLeft: "var(--sidebar-w)" }}>
        <TopBar />
        <main
          className="flex-1 overflow-y-auto p-8"
          style={{ marginTop: "var(--topbar-h)" }}
        >
          {isBrowseOnly && (
            <div
              className="mb-6 rounded-2xl px-5 py-4 flex items-start gap-3"
              style={{
                background: "linear-gradient(135deg, rgba(14,165,233,0.12), rgba(56,189,248,0.06))",
                border: "1px solid rgba(14,165,233,0.26)",
                color: "var(--text-primary)",
                boxShadow: "0 10px 30px rgba(14,165,233,0.08)",
              }}
            >
              <div
                className="mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: "#38bdf8", boxShadow: "0 0 16px rgba(56,189,248,0.5)" }}
              />
              <div className="text-sm leading-6">
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                  当前为受限访问模式。
                </span>
                <span style={{ color: "var(--text-secondary)" }}>
                  {" "}你可以浏览【首页】【灵感广场】【教程】，也可以直接使用【ComfyUI 工作流 → 萌宠旅人】。GPT-Image-2 相关创作仍需要先补充 SOFUNNY_API_KEY。
                </span>
                <Link
                  href="/setup/api-key"
                  className="ml-3 inline-flex items-center px-3 py-1 rounded-xl text-xs font-semibold transition-all align-middle"
                  style={{
                    background: "rgba(14,165,233,0.14)",
                    color: "#0369a1",
                    border: "1px solid rgba(14,165,233,0.24)",
                  }}
                >
                  去补充 API_KEY
                </Link>
                {isMockBrowseOnly && !isRealBrowseOnly && " 当前为开发模拟模式。"}
                {isMockBrowseOnly && !isRealBrowseOnly && (
                  <button
                    onClick={exitMockBrowseOnly}
                    className="ml-3 px-3 py-1 rounded-xl text-xs font-semibold"
                    style={{
                      background: "rgba(56,189,248,0.14)",
                      color: "#e0f2fe",
                      border: "1px solid rgba(56,189,248,0.24)",
                    }}
                  >
                    退出模拟
                  </button>
                )}
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
