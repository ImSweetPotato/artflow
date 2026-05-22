#!/usr/bin/env node
/**
 * 灵感案例同步脚本（一次性导入 / 增量更新两用）。
 *
 * 数据来源：本地 G:\pro\awesome-gpt-image-2-prompts/cases/*.md
 *
 * 用法：
 *   cd frontend
 *   node scripts/sync-inspiration.mjs
 *
 * 行为：
 *   - 只读 7 个英文 .md（cases/{portrait,poster,character,ui,comparison,ecommerce,ad-creative}.md）
 *   - 正则解析每个 ### Case 块，提取 id/title/author/prompt/imageUrl 等
 *   - 自动判定 gameRelevance（high/medium/low/irrelevant）
 *   - 全量重写 lib/inspiration-data-imported.ts（数据始终跟仓库同步）
 *   - 用户的人工调整（中文 title 等）请放在 lib/inspiration-overrides.ts，脚本不会动它
 *   - 跟上次生成对比，报告新增/删除/改动数量
 *
 * Token 消耗：0（纯本地脚本）
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── 配置 ──────────────────────────────────────────────────────────────────────

const REPO_DIR = path.resolve(__dirname, "../../../awesome-gpt-image-2-prompts");
const CASES_DIR = path.join(REPO_DIR, "cases");
const OUT_FILE = path.resolve(__dirname, "../lib/inspiration-data-imported.ts");

// 只读这 7 个英文版（多语言 _zh-CN/_de/... 内容相同，跳过）
const FILES = ["portrait", "poster", "character", "ui", "comparison", "ecommerce", "ad-creative"];

const CATEGORY_LABEL_ZH = {
  portrait:       "人像与摄影",
  poster:         "海报与插画",
  character:      "角色设计",
  ui:             "UI / 信息版式",
  comparison:     "模型对比与社区",
  ecommerce:      "电商案例",
  "ad-creative":  "广告创意",
};

// ── 游戏相关性自动分级 ────────────────────────────────────────────────────────

/**
 * 给每个案例打一个 gameRelevance 标签：
 *   - high       游戏美术高度相关（角色、立绘、游戏 UI、3D 渲染等）
 *   - medium     可借鉴（海报、插画、风格通用）
 *   - low        弱相关（写实摄影、生活照）
 *   - irrelevant 几乎无关（电商商品、模型测试 demo）
 *
 * 灵感广场默认隐藏 irrelevant，可一键切换显示全部。
 */
function inferGameRelevance(category, prompt) {
  // 强规则：分类直接定档
  if (category === "character") return "high";
  if (category === "comparison" || category === "ecommerce") return "irrelevant";

  const lower = prompt.toLowerCase();

  // 高相关关键词
  const highKw = /\b(game|character design|warrior|knight|wizard|mage|anime|fantasy|sci-fi|mech|stylized|3d render|pixar|illustration|cartoon|chibi|isometric|pixel art|key visual|splash art|concept art|game ui|game asset|hero|villain|monster|dragon|elf|dwarf|orc|samurai|ninja)\b/;

  // 真实摄影 / 弱相关关键词
  const lowKw = /\b(35mm film|film photography|film grain|photorealistic portrait|photo of a (woman|man|girl|boy|person|model)|product shot|studio photography|realistic skin)\b/;

  if (highKw.test(lower)) return "high";
  if (lowKw.test(lower)) return "low";
  return "medium";
}

// ── markdown 解析 ─────────────────────────────────────────────────────────────

/**
 * 从一个 .md 文件中提取所有案例。
 * 文件格式参考 cases/portrait.md：
 *   ### Case N: [标题](原推链接) (by [@作者](作者主页))
 *   | Output |
 *   | :----: |
 *   | <img src="..." ...> |
 *   **Prompt:**
 *   ```
 *   prompt 内容
 *   ```
 */
function parseMarkdown(content, category) {
  const cases = [];

  // 找出所有 ### Case N: ... 的位置（不消费匹配，只为分割块）
  const headerRe = /### Case (\d+):\s*\[([^\]]+)\]\(([^)]+)\)\s*\(by\s*\[([^\]]+)\]\(([^)]+)\)\)/g;
  const headers = [];
  let m;
  while ((m = headerRe.exec(content)) !== null) {
    headers.push({
      num: parseInt(m[1], 10),
      title: m[2].trim(),
      sourceUrl: m[3].trim(),
      author: m[4].trim(),
      authorUrl: m[5].trim(),
      startIdx: m.index,
    });
  }

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const endIdx = i + 1 < headers.length ? headers[i + 1].startIdx : content.length;
    const block = content.slice(h.startIdx, endIdx);

    // 提取图片 URL（第一个 <img src="...">）
    const imgMatch = block.match(/<img\s+src="([^"]+)"/);
    const imageUrl = imgMatch ? imgMatch[1].trim() : "";

    // 提取 prompt 区块（``` ... ```，可能跨多行）
    const promptMatch = block.match(/```[a-z]*\s*\n([\s\S]*?)\n```/);
    const prompt = promptMatch ? promptMatch[1].trim() : "";

    if (!prompt) {
      console.warn(`  [warn] ${category} Case ${h.num} 没有提取到 prompt，跳过`);
      continue;
    }

    cases.push({
      num: h.num,
      id: `gh_${category}_case${h.num}`,
      category,
      categoryLabel: CATEGORY_LABEL_ZH[category] || category,
      title: h.title,
      author: h.author.startsWith("@") ? h.author : `@${h.author}`,
      authorUrl: h.authorUrl,
      prompt,
      imageUrl,
      sourceUrl: h.sourceUrl,
      gameRelevance: inferGameRelevance(category, prompt),
      folder: `${category}_case${h.num}`,
    });
  }

  return cases;
}

// ── 读取上次生成的文件（用于增量对比） ──────────────────────────────────────

function loadExistingIds() {
  if (!fs.existsSync(OUT_FILE)) return { ids: new Set(), exists: false };
  try {
    const txt = fs.readFileSync(OUT_FILE, "utf-8");
    const ids = new Set();
    const re = /id:\s*"(gh_[^"]+)"/g;
    let m;
    while ((m = re.exec(txt)) !== null) ids.add(m[1]);
    return { ids, exists: true };
  } catch {
    return { ids: new Set(), exists: false };
  }
}

// ── 字符串转义（生成 TS 时用） ────────────────────────────────────────────────

function escapeForTsString(s) {
  if (s == null) return "";
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, " ");
}

// ── 主流程 ────────────────────────────────────────────────────────────────────

function main() {
  console.log(`[sync-inspiration] 仓库目录: ${REPO_DIR}`);
  if (!fs.existsSync(CASES_DIR)) {
    console.error(`错误：找不到 ${CASES_DIR}`);
    console.error("请确认 awesome-gpt-image-2-prompts 仓库已克隆到 G:\\pro\\");
    process.exit(1);
  }

  const previous = loadExistingIds();
  console.log(`[sync-inspiration] 上次生成 ${previous.ids.size} 条（${previous.exists ? "已存在" : "首次运行"}）\n`);

  const allCases = [];
  for (const cat of FILES) {
    const filePath = path.join(CASES_DIR, `${cat}.md`);
    if (!fs.existsSync(filePath)) {
      console.warn(`[skip] ${filePath} 不存在`);
      continue;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    const cases = parseMarkdown(content, cat);
    console.log(`  [${cat.padEnd(13)}] 解析 ${String(cases.length).padStart(3)} 条`);
    allCases.push(...cases);
  }

  // 按 category 顺序 + case number 排序，保证文件稳定
  const orderMap = Object.fromEntries(FILES.map((f, i) => [f, i]));
  allCases.sort((a, b) => {
    const oa = orderMap[a.category] ?? 99;
    const ob = orderMap[b.category] ?? 99;
    if (oa !== ob) return oa - ob;
    return a.num - b.num;
  });

  // 增量统计
  const newIds = new Set(allCases.map((c) => c.id));
  const added = allCases.filter((c) => !previous.ids.has(c.id));
  const removed = [...previous.ids].filter((id) => !newIds.has(id));

  console.log(`\n[统计]`);
  console.log(`  本次解析:  ${allCases.length}`);
  console.log(`  新增:      ${added.length}`);
  console.log(`  已删除:    ${removed.length}（上游仓库已不存在的 case）`);

  // 按 gameRelevance 分布
  const dist = { high: 0, medium: 0, low: 0, irrelevant: 0 };
  for (const c of allCases) dist[c.gameRelevance]++;
  console.log(`\n[游戏相关性分布]`);
  console.log(`  high       (强相关): ${dist.high}`);
  console.log(`  medium     (可借鉴): ${dist.medium}`);
  console.log(`  low        (弱相关): ${dist.low}`);
  console.log(`  irrelevant (无关):   ${dist.irrelevant}（默认隐藏）`);

  // 生成 TS
  const ts = `/* eslint-disable */
/**
 * 自动生成 — 不要手动编辑。
 *
 * 同步执行：
 *   cd frontend && node scripts/sync-inspiration.mjs
 *
 * 数据源：https://github.com/EvoLinkAI/awesome-gpt-image-2-API-and-Prompts
 * 生成时间：${new Date().toISOString()}
 * 案例总数：${allCases.length}
 *
 * 字段说明：
 *   - id: gh_<category>_case<N>，跟仓库 image 文件夹名对齐
 *   - sourceUrl: 原始推特链接
 *   - authorUrl: 作者主页
 *   - imageUrl: GitHub raw 直链（不需要本地存储图片）
 *   - gameRelevance: 自动判定的游戏相关性（high/medium/low/irrelevant）
 *
 * 用户人工调整请放在 inspiration-overrides.ts，脚本不会覆盖它。
 */
import type { InspirationCase } from "./inspiration-data";

export const IMPORTED_CASES: InspirationCase[] = [
${allCases.map((c) => `  {
    id: "${c.id}",
    category: "${c.category}",
    categoryLabel: "${escapeForTsString(c.categoryLabel)}",
    title: "${escapeForTsString(c.title)}",
    author: "${escapeForTsString(c.author)}",
    authorUrl: "${escapeForTsString(c.authorUrl)}",
    prompt: "${escapeForTsString(c.prompt)}",
    imageUrl: "${escapeForTsString(c.imageUrl)}",
    sourceUrl: "${escapeForTsString(c.sourceUrl)}",
    gameRelevance: "${c.gameRelevance}",
    folder: "${c.folder}",
  },`).join("\n")}
];
`;

  fs.writeFileSync(OUT_FILE, ts, "utf-8");
  console.log(`\n✓ 已写入 ${path.relative(process.cwd(), OUT_FILE)}`);
  if (added.length > 0 && previous.exists) {
    console.log(`\n[本次新增的 case]`);
    for (const c of added.slice(0, 20)) {
      console.log(`  + ${c.id} - ${c.title}`);
    }
    if (added.length > 20) console.log(`  ... 还有 ${added.length - 20} 条`);
  }
}

main();
