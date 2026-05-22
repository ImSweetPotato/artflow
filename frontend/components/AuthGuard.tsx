"use client";

import { useEffect, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (isLoading) return;
    if (!user && !isLoginPage) {
      router.replace("/login");
    }
  }, [user, isLoading, isLoginPage, router]);

  // 登录页直接渲染（不带 Sidebar/TopBar）
  if (isLoginPage) return <>{children}</>;

  // 等待 auth 加载，避免闪屏
  if (isLoading || !user) return null;

  return <>{children}</>;
}
