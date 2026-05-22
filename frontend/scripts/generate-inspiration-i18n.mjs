#!/usr/bin/env node
/**
 * 生成灵感案例中文展示映射。
 *
 * 说明：
 * - 仅翻译自动同步案例（手写案例默认已人工整理）
 * - title 尽量翻译成中文
 * - prompt 遇到模板占位符 / 参数化结构时跳过，避免把可替换变量翻坏
 * - 产物只用于前端展示；复制 / 一键生图仍走原始 prompt
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMPORTED_FILE = path.resolve(__dirname, "../lib/inspiration-data-imported.ts");
const OUT_FILE = path.resolve(__dirname, "../lib/inspiration-i18n.ts");
const API_BASE = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=";

function loadImportedCases() {
  const raw = fs.readFileSync(IMPORTED_FILE, "utf-8");
  const js = raw
    .replace(/^import .*?;\s*/m, "")
    .replace(/export const IMPORTED_CASES:\s*InspirationCase\[\]\s*=\s*/, "globalThis.__CASES__ = ");
  const context = { globalThis: {} };
  vm.createContext(context);
  vm.runInContext(js, context, { filename: IMPORTED_FILE });
  return context.globalThis.__CASES__ ?? [];
}

function hasTemplateSyntax(text) {
  return /\{argument name=|REFERENCE_\d+|\[BRAND NAME|\[character\]|\[color\]/i.test(text);
}

function shouldTranslateTitle(title) {
  if (!title) return false;
  if (/[\u3040-\u30ff]/.test(title)) return true;
  if (/[A-Za-z]/.test(title)) return !/[\u4e00-\u9fff]{4,}/.test(title);
  return false;
}

function shouldTranslatePrompt(prompt) {
  if (!prompt || hasTemplateSyntax(prompt)) return false;
  if (/[\u3040-\u30ff]/.test(prompt)) return true;
  if (/[A-Za-z]/.test(prompt) && !/[\u4e00-\u9fff]{8,}/.test(prompt)) return true;
  return false;
}

async function translateText(text) {
  const res = await fetch(`${API_BASE}${encodeURIComponent(text)}`);
  if (!res.ok) {
    throw new Error(`translate failed: ${res.status}`);
  }
  const data = await res.json();
  return (data?.[0] ?? []).map((part) => part?.[0] ?? "").join("").trim();
}

async function main() {
  const cases = loadImportedCases();
  const out = {};

  console.log(`[i18n] loaded ${cases.length} imported cases`);

  for (let i = 0; i < cases.length; i++) {
    const item = cases[i];
    const entry = {};

    if (shouldTranslateTitle(item.title)) {
      try {
        const titleZh = await translateText(item.title);
        if (titleZh && titleZh !== item.title) entry.titleZh = titleZh;
      } catch (error) {
        console.warn(`[warn] title failed ${item.id}: ${error.message}`);
      }
    }

    if (shouldTranslatePrompt(item.prompt)) {
      try {
        const promptZh = await translateText(item.prompt);
        if (promptZh && promptZh !== item.prompt) entry.promptZh = promptZh;
      } catch (error) {
        console.warn(`[warn] prompt failed ${item.id}: ${error.message}`);
      }
    }

    if (Object.keys(entry).length > 0) {
      out[item.id] = entry;
    }

    if ((i + 1) % 25 === 0 || i === cases.length - 1) {
      console.log(`[i18n] ${i + 1}/${cases.length}`);
    }
  }

  const body = `/* eslint-disable */
/**
 * 自动生成 — 不要手动编辑。
 *
 * 生成命令：
 *   cd frontend && node scripts/generate-inspiration-i18n.mjs
 *
 * 用途：
 *   - titleZh / promptZh 仅用于前端中文展示
 *   - 原始复制 / 一键生图继续使用原始 prompt
 *   - 模板化 prompt（如 {argument ...}）默认不翻译
 */

export interface InspirationI18nEntry {
  titleZh?: string;
  promptZh?: string;
}

export const INSPIRATION_I18N: Record<string, InspirationI18nEntry> = ${JSON.stringify(out, null, 2)} as const;
`;

  fs.writeFileSync(OUT_FILE, body, "utf-8");
  console.log(`[i18n] wrote ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log(`[i18n] entries: ${Object.keys(out).length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
