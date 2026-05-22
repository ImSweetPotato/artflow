"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * 用户偏好（存 localStorage，跨设备不同步）。
 *
 * 用法：
 *   const { prefs, setPref } = usePreferences();
 *   setPref("defaultAspectRatio", "16:9");
 *   const initial = prefs.defaultAspectRatio;
 *
 * 在创作页可以这样初始化 state：
 *   const [aspect, setAspect] = useState(prefs.defaultAspectRatio);
 */

export interface UserPreferences {
  defaultAspectRatio: string;       // "" / "auto" / "1:1" / ...
  defaultOutputCount: number;       // 1-4
  defaultEnableThinking: boolean;   // 默认是否开思考优化
  nickname: string;                 // 共享账号下的"我是谁"
}

const STORAGE_KEY = "artflow_user_prefs";
const NICKNAME_KEY = "artflow_nickname"; // 单独存：拦截器要读

export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultAspectRatio: "",
  defaultOutputCount: 1,
  defaultEnableThinking: false,
  nickname: "",
};

function loadPrefs(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserPreferences>;
      // 单独存的 nickname 优先（API 拦截器也读它）
      const nickname = localStorage.getItem(NICKNAME_KEY) ?? parsed.nickname ?? "";
      return { ...DEFAULT_PREFERENCES, ...parsed, nickname };
    }
  } catch {}
  return {
    ...DEFAULT_PREFERENCES,
    nickname: localStorage.getItem(NICKNAME_KEY) ?? "",
  };
}

function savePrefs(prefs: UserPreferences) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    // nickname 同步到独立 key，方便 axios interceptor 直接读
    if (prefs.nickname) {
      localStorage.setItem(NICKNAME_KEY, prefs.nickname);
    } else {
      localStorage.removeItem(NICKNAME_KEY);
    }
  } catch {}
}

export function usePreferences() {
  const [prefs, setPrefsState] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  // 客户端 mount 后再读，避免 SSR hydration 差异
  useEffect(() => {
    setPrefsState(loadPrefs());
  }, []);

  const setPref = useCallback(<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPrefsState((prev) => {
      const next = { ...prev, [key]: value };
      savePrefs(next);
      return next;
    });
  }, []);

  const resetPrefs = useCallback(() => {
    savePrefs(DEFAULT_PREFERENCES);
    setPrefsState(DEFAULT_PREFERENCES);
  }, []);

  return { prefs, setPref, resetPrefs };
}
