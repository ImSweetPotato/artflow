"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotice } from "@/components/NoticeProvider";
import { isBrowseOnlyUser } from "@/lib/access";

const DEFAULT_BLOCK_MESSAGE = "你当前处于案例浏览模式，请先补充 SOFUNNY_API_KEY 后再使用创作功能。";
const MOCK_BROWSE_ONLY_KEY = "artflow_mock_browse_only";
const MOCK_ON = "1";

function canUseMockBrowseOnly(): boolean {
  return process.env.NODE_ENV !== "production";
}

function readMockBrowseOnlyParam(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("mockBrowseOnly");
}

export function useBrowseOnlyMode() {
  const { user } = useAuth();
  const { showNotice } = useNotice();
  const [isMockBrowseOnly, setIsMockBrowseOnly] = useState(() => {
    if (!canUseMockBrowseOnly()) return false;
    if (readMockBrowseOnlyParam() === "1") return true;
    if (typeof window === "undefined") return false;
    return localStorage.getItem(MOCK_BROWSE_ONLY_KEY) === MOCK_ON;
  });
  const isRealBrowseOnly = isBrowseOnlyUser(user);

  useEffect(() => {
    if (!canUseMockBrowseOnly() || typeof window === "undefined") return;
    setIsMockBrowseOnly(localStorage.getItem(MOCK_BROWSE_ONLY_KEY) === MOCK_ON);
  }, []);

  useEffect(() => {
    if (!canUseMockBrowseOnly() || typeof window === "undefined") return;
    const syncMockFlag = () => {
      const mockFlag = readMockBrowseOnlyParam();
      if (mockFlag === "1") {
        localStorage.setItem(MOCK_BROWSE_ONLY_KEY, MOCK_ON);
        setIsMockBrowseOnly(true);
      } else if (mockFlag === "0") {
        localStorage.removeItem(MOCK_BROWSE_ONLY_KEY);
        setIsMockBrowseOnly(false);
      }
    };
    syncMockFlag();
    window.addEventListener("popstate", syncMockFlag);
    return () => window.removeEventListener("popstate", syncMockFlag);
  }, []);

  const isBrowseOnly = Boolean(user) && (isRealBrowseOnly || isMockBrowseOnly);

  const blockCreateAction = (message = DEFAULT_BLOCK_MESSAGE) => {
    if (!isBrowseOnly) return false;
    showNotice({
      title: "请先补充 API_KEY",
      message,
      tone: "warning",
    });
    return true;
  };

  const exitMockBrowseOnly = () => {
    if (!canUseMockBrowseOnly() || typeof window === "undefined") return;
    localStorage.removeItem(MOCK_BROWSE_ONLY_KEY);
    setIsMockBrowseOnly(false);
  };

  return {
    isBrowseOnly,
    isRealBrowseOnly,
    isMockBrowseOnly,
    blockCreateAction,
    exitMockBrowseOnly,
  };
}
