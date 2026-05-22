"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, X } from "lucide-react";

type NoticeTone = "info" | "warning";

type NoticeState = {
  title: string;
  message: string;
  tone: NoticeTone;
} | null;

type NoticeContextValue = {
  showNotice: (input: { title: string; message: string; tone?: NoticeTone }) => void;
  hideNotice: () => void;
};

const NoticeContext = createContext<NoticeContextValue | null>(null);

export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<NoticeState>(null);

  const hideNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const showNotice = useCallback((input: { title: string; message: string; tone?: NoticeTone }) => {
    setNotice({
      title: input.title,
      message: input.message,
      tone: input.tone ?? "info",
    });
  }, []);

  const value = useMemo(() => ({ showNotice, hideNotice }), [showNotice, hideNotice]);
  const accent = notice?.tone === "warning"
    ? { bg: "rgba(251,146,60,0.14)", border: "rgba(251,146,60,0.32)", text: "#fdba74", glow: "rgba(251,146,60,0.18)" }
    : { bg: "rgba(56,189,248,0.14)", border: "rgba(56,189,248,0.28)", text: "#7dd3fc", glow: "rgba(56,189,248,0.18)" };

  return (
    <NoticeContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {notice && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-center justify-center p-6"
            style={{ background: "rgba(3,8,20,0.58)", backdropFilter: "blur(14px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={hideNotice}
          >
            <motion.div
              className="relative w-full max-w-md rounded-[28px] overflow-hidden"
              style={{
                background: "linear-gradient(180deg, rgba(18,24,38,0.96), rgba(12,18,30,0.98))",
                border: `1px solid ${accent.border}`,
                boxShadow: `0 24px 64px rgba(0,0,0,0.45), 0 0 0 1px ${accent.glow}`,
              }}
              initial={{ opacity: 0, y: 18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="absolute inset-x-0 top-0 h-24 pointer-events-none"
                style={{ background: `radial-gradient(circle at top, ${accent.glow}, transparent 72%)` }}
              />

              <button
                onClick={hideNotice}
                className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all"
                style={{ background: "rgba(255,255,255,0.05)", color: "var(--text-muted)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <X size={14} />
              </button>

              <div className="px-6 pt-6 pb-5">
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: accent.bg, color: accent.text, border: `1px solid ${accent.border}` }}
                  >
                    <AlertCircle size={18} />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                      {notice.title}
                    </p>
                    <p className="text-sm mt-2 leading-6" style={{ color: "var(--text-secondary)" }}>
                      {notice.message}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={hideNotice}
                    className="px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all"
                    style={{
                      background: accent.bg,
                      color: accent.text,
                      border: `1px solid ${accent.border}`,
                      boxShadow: `0 8px 24px ${accent.glow}`,
                    }}
                  >
                    我知道了
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </NoticeContext.Provider>
  );
}

export function useNotice() {
  const ctx = useContext(NoticeContext);
  if (!ctx) throw new Error("useNotice must be used inside NoticeProvider");
  return ctx;
}
