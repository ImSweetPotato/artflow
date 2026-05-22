"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export interface Tab {
  href: string;
  label: string;
}

interface TabContextValue {
  tabs: Tab[];
  activeHref: string;
  openTab: (tab: Tab) => void;
  closeTab: (href: string) => void;
  setActiveHref: (href: string) => void;
}

const TabContext = createContext<TabContextValue>({
  tabs: [],
  activeHref: "/",
  openTab: () => {},
  closeTab: () => {},
  setActiveHref: () => {},
});

const INIT_TABS: Tab[] = [{ href: "/", label: "首页" }];

export function TabContextProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tabs, setTabs] = useState<Tab[]>(INIT_TABS);
  const [activeHref, setActiveHref] = useState("/");

  // 路由变化时同步激活态
  useEffect(() => {
    setActiveHref(pathname);
  }, [pathname]);

  const openTab = useCallback((tab: Tab) => {
    setTabs((prev) => {
      const exists = prev.find((t) => t.href === tab.href);
      if (exists) return prev;
      return [...prev, tab];
    });
    setActiveHref(tab.href);
  }, []);

  const closeTab = useCallback((href: string) => {
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex((t) => t.href === href);
      if (idx === -1) return prev;
      const next = prev.filter((t) => t.href !== href);
      // 如果关闭的是当前激活项，跳到相邻的
      if (href === activeHref) {
        const newActive = next[Math.min(idx, next.length - 1)];
        if (newActive) {
          router.push(newActive.href);
        }
      }
      return next;
    });
  }, [activeHref, router]);

  return (
    <TabContext.Provider value={{ tabs, activeHref, openTab, closeTab, setActiveHref }}>
      {children}
    </TabContext.Provider>
  );
}

export function useTabContext() {
  return useContext(TabContext);
}
