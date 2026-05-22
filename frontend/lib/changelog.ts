/**
 * 版本更新公告。
 *
 * 添加新版本只改这个文件——按时间倒序排列，最新版放最上面。
 * 文案面向最终用户，避免技术黑话。type 决定标签颜色：
 *   - new      新增功能（蓝）
 *   - improve  体验优化（紫）
 *   - fix      问题修复（绿）
 */

export type ChangelogTag = "new" | "improve" | "fix";

export interface ChangelogItem {
  type: ChangelogTag;
  text: string;
}

export interface ChangelogVersion {
  version: string;       // 如 "v0.5.0"
  date: string;          // ISO 日期 "2026-05-07"
  title: string;         // 版本主题，一句话
  items: ChangelogItem[];
}

export const CHANGELOG: ChangelogVersion[] = [
  {
    version: "v0.8.0",
    date: "2026-05-11",
    title: "受限浏览模式 · 项目精选分类 · 管理与生图链路继续完善",
    items: [
      { type: "new", text: "飞书登录但未绑定个人 SOFUNNY_API_KEY 的用户，现在可进入受限浏览模式：支持浏览首页、灵感广场、教程，创作操作会友好引导先补 key" },
      { type: "new", text: "API_KEY 绑定页重做为三段卡片式引导：为什么需要 key、已有 key 如何开通、未有 key 如何先浏览精选案例" },
      { type: "new", text: "管理员生图历史新增所属人员筛选：支持查看我生成的、其他人生成的，或按具体成员下拉筛选" },
      { type: "new", text: "项目精选升级为共享项目分类：管理员可直接把图片推送到指定项目组标签，不再依赖个人自定义分类" },
      { type: "improve", text: "资产库、任务页、分类下拉、全站可点击控件补齐 hover 与指针反馈，整体交互更统一" },
      { type: "improve", text: "灵感广场项目精选筛选逻辑调整：点击项目标签时不再被业务方向筛选误伤，标签数量与实际内容保持一致" },
      { type: "improve", text: "创作结果现在会更严格遵守所选画面比例，减少生成成图与参数设置不一致的情况" },
      { type: "fix", text: "修复退出登录后在 /login 与 /setup/api-key 之间来回跳转闪烁的问题" },
      { type: "fix", text: "修复浏览模式下创作按钮仍弹浏览器原生丑提示框的问题，改为站内统一提示样式" },
      { type: "fix", text: "修复已公开的项目精选在灵感广场分类中偶现点击后看不到内容的问题" },
    ],
  },
  {
    version: "v0.7.0",
    date: "2026-05-09",
    title: "飞书登录 · 个人 API Key · 首页与浅色模式全面升级",
    items: [
      { type: "new", text: "飞书登录正式接入：支持司内成员通过飞书授权进入系统，不再依赖测试账号为主" },
      { type: "new", text: "个人 SOFUNNY_API_KEY 绑定上线：首次登录可引导绑定，后续生图按个人 key 扣费" },
      { type: "new", text: "个人中心新增 API Key 管理：可查看当前绑定状态并随时更新 key" },
      { type: "new", text: "登录页新增管理员联系入口，默认引导使用飞书登录，测试账号信息不再直接暴露" },
      { type: "improve", text: "首页重构：主视觉、版本动态与支撑入口重新排版，去掉冗余模块与生硬线条" },
      { type: "improve", text: "浅色模式全面校正：导航、Tab、筛选项、教程页、个人中心等界面的文字与选中态对比度显著提升" },
      { type: "improve", text: "灵感广场筛选重做：业务方向、来源分类、项目精选与我的分类在深浅模式下都有更明确的选中边框与文字色" },
      { type: "improve", text: "品牌视觉统一：站点 Logo、浏览器图标、登录页与侧边栏入口全部换成正式品牌图" },
      { type: "fix", text: "修复飞书登录回跳后长时间停留在“登录中”状态的问题" },
      { type: "fix", text: "修复版本动态中“查看完整版本记录”提示不可点击的问题" },
    ],
  },
  {
    version: "v0.6.0",
    date: "2026-05-08",
    title: "资产库 · 教程中心 · 个人中心 · 灵感广场全量同步",
    items: [
      { type: "new", text: "资产模块上线：按图片维度浏览所有成功结果，时间分组 + 多维筛选 + 批量下载" },
      { type: "new", text: "教程模块上线：快速上手 / 提示词指南 / 进阶玩法 / FAQ 四大类，含 11 篇核心内容，prompt 卡可一键带入创作页" },
      { type: "new", text: "个人中心上线：数据概览、创作偏好（默认比例/数量/思考自动应用）、修改密码、我的昵称" },
      { type: "new", text: "使用者追溯：管理员可在历史与详情查看每个任务的提交者 IP 和自定义昵称（共享账号场景下定位到具体人）" },
      { type: "new", text: "灵感广场全量同步：从社区精选仓库自动导入 361 条业界案例，按游戏相关性自动分级" },
      { type: "new", text: "灵感广场新增「相关性」筛选：推荐 / 仅游戏强相关 / 显示全部，每张卡带 🎮 ✦ 📷 ⊘ 角标" },
      { type: "new", text: "生图历史失败任务加「重试」按钮，一键重新执行" },
      { type: "new", text: "全局提示词组件：任务详情、灵感广场、精选弹窗等所有展示提示词的位置都支持一键复制" },
      { type: "improve", text: "画面比例选项加 SVG 画框图标，「故事版」与「宽屏」一眼区分不再搞混" },
      { type: "improve", text: "创作页提示词输入框增高且自适应内容高度，长 prompt 写起来更舒服" },
      { type: "improve", text: "TopBar 整体重设计：胶囊式 Tab + 图标 + 用户菜单玻璃质感升级" },
      { type: "improve", text: "FeaturedModal 大改：左右两栏布局，参考图和结果图都支持点击放大查看" },
      { type: "improve", text: "资产卡片 hover 操作按钮改紧凑水平排，任意比例图都能完整显示" },
      { type: "improve", text: "历史任务整卡可点击进详情，删除按钮仅管理员可见" },
      { type: "improve", text: "错误提示前后端两层友好化：429 限流、超时等不再显示原始 API 报错" },
      { type: "fix", text: "灵感广场点击「我的分类」下的自定义标签无筛选效果" },
      { type: "fix", text: "生图历史每 5 秒轮询把用户从其他分页弹回第 1 页" },
      { type: "fix", text: "历史与任务详情中多图任务的参考图缩略图未显示" },
    ],
  },
  {
    version: "v0.5.0",
    date: "2026-05-07",
    title: "对话式生成 · 智能优化 · 体验全面升级",
    items: [
      { type: "new", text: "GPT-Image-2 支持最多 9 张参考图同时上传，一次组合多个素材生成" },
      { type: "new", text: "对话式生成历史：每次生成的参数和结果以聊天流形式呈现，可一键回溯" },
      { type: "new", text: "智能优化提示词（GPT-5 思考模式）：模糊或简短的描述自动改写为精准 prompt" },
      { type: "new", text: "画面比例新增「自动」「3:4」「4:3」选项，更贴近创作需求" },
      { type: "improve", text: "登录页改为水平垂直居中，并提供测试账号一键登录" },
      { type: "improve", text: "历史任务整卡可点击查看详情，删除按钮仅管理员可见" },
      { type: "improve", text: "失败提示改为友好中文，不再显示原始 API 报错" },
      { type: "fix", text: "历史任务列表中多图任务的参考图缩略图正确显示" },
      { type: "fix", text: "精选卡片悬停后边框残留、复制提示词按钮在 HTTP 环境下失效" },
    ],
  },
  {
    version: "v0.4.0",
    date: "2026-04-30",
    title: "登录系统 · 数据隔离 · 公共精选",
    items: [
      { type: "new", text: "上线多账号登录系统，每个用户的任务和收藏完全隔离" },
      { type: "new", text: "灵感广场：管理员可推送公共精选，所有人可见；用户可建私有收藏" },
      { type: "new", text: "定时生成：可指定未来时间自动执行任务，失败自动重试" },
      { type: "new", text: "工作流：原画转 2D 立绘、原画转宣发主视觉" },
      { type: "improve", text: "管理员支持快速切换账号，方便联调和测试" },
    ],
  },
];
