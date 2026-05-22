/**
 * 教程内容数据。
 *
 * 添加新教程：在对应分类的 articles 数组里追加一条 TutorialArticle。
 *
 * sections 是结构化富文本，比 markdown 更可控：
 *   - heading      二级标题
 *   - paragraph    普通段落
 *   - list         无序列表
 *   - prompt       带「在创作页打开」按钮的 prompt 卡
 *   - tip          高亮提示框（紫色）
 *   - warning      警告框（橙色）
 *   - steps        步骤条（编号列表）
 *   - keyValue     键值对表格（如对比模型参数）
 */

export type TutorialSection =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered?: boolean }
  | { type: "prompt"; label?: string; text: string; refImageUrl?: string }
  | { type: "tip"; text: string }
  | { type: "warning"; text: string }
  | { type: "steps"; items: { title: string; text: string }[] }
  | { type: "keyValue"; items: { key: string; value: string }[] };

export interface TutorialArticle {
  id: string;
  title: string;
  summary: string;
  duration: string;        // 阅读时长，如 "3 分钟"
  sections: TutorialSection[];
  tags?: string[];
}

export interface TutorialCategory {
  id: string;              // 用作 Tab key
  label: string;           // Tab 显示名
  emoji: string;           // 视觉标识
  articles: TutorialArticle[];
}

export const TUTORIALS: TutorialCategory[] = [
  // ── 1. 快速上手 ────────────────────────────────────────────────────────────
  {
    id: "start",
    label: "快速上手",
    emoji: "🚀",
    articles: [
      {
        id: "first-image",
        title: "3 分钟生成你的第一张图",
        summary: "从零开始，一步步带你完成第一次创作，掌握平台核心流程。",
        duration: "3 分钟",
        tags: ["入门", "必读"],
        sections: [
          {
            type: "paragraph",
            text: "本教程会带你完成第一次完整的生图流程。完成后你会理解平台的核心交互模式。",
          },
          {
            type: "steps",
            items: [
              { title: "进入创作页", text: "左侧导航点击「创作 → GPT-Image-2 生图」，或直接点下方「打开创作页」按钮。" },
              { title: "写提示词", text: "在左侧大输入框写下你想要的画面。中文可以、英文更精准；不会写就开启上方「智能优化提示词」让 GPT-5 帮你改写。" },
              { title: "（可选）传参考图", text: "下方「参考图」区拖拽或点击上传，支持最多 9 张。不传就是文生图。" },
              { title: "选画面比例", text: "默认「自动」由模型决定。需要固定比例就选 1:1 / 9:16 等。" },
              { title: "点「开始生成」", text: "提交后页面右侧会出现一条对话气泡，可以离开此页面，结果好了再回来看。" },
            ],
          },
          {
            type: "tip",
            text: "💡 任务在后台异步执行，不需要一直盯着页面。即便关闭浏览器，下次回来也能在「生图历史」里看到结果。当前全局最多同时运行 15 个任务，单账号最多同时运行 5 个任务。",
          },
          {
            type: "heading",
            text: "试试这个示例",
          },
          {
            type: "prompt",
            label: "复古赛博朋克游戏角色",
            text: "Cyberpunk female warrior, neon pink hair, black tactical jacket with glowing circuits, holding a futuristic katana, rainy Tokyo street background with holographic billboards, cinematic lighting, 3D render, masterpiece quality, 4K",
          },
          {
            type: "paragraph",
            text: "复制上面的 prompt 或点击「在创作页打开」直接预填，然后选 9:16 比例提交即可。",
          },
        ],
      },
      {
        id: "tour",
        title: "平台导览：每个模块在做什么？",
        summary: "了解侧边栏每一项的作用，避免走错路。",
        duration: "2 分钟",
        tags: ["入门"],
        sections: [
          { type: "heading", text: "侧边栏各模块" },
          {
            type: "keyValue",
            items: [
              { key: "首页",       value: "查看版本更新、平台介绍、快速入口" },
              { key: "灵感广场",   value: "浏览社区/同事的精选 prompt 案例，可一键复用" },
              { key: "创作",       value: "核心生图入口，所有任务从这里发起" },
              { key: "生图历史",   value: "按任务维度查看所有提交记录，支持重试、复用" },
              { key: "资产",       value: "按图片维度浏览所有成功结果，支持批量下载、筛选" },
              { key: "个人中心",   value: "账号信息、偏好设置、安全（开发中）" },
              { key: "教程",       value: "你在的这里 :)" },
            ],
          },
          {
            type: "tip",
            text: "💡 创作 vs 生图历史 vs 资产：『创作』是发起入口；『历史』按任务列出（含失败的）；『资产』只看成功的图片，方便挑用。",
          },
        ],
      },
    ],
  },

  // ── 2. 提示词指南 ─────────────────────────────────────────────────────────
  {
    id: "prompt",
    label: "提示词指南",
    emoji: "📝",
    articles: [
      {
        id: "golden-formula",
        title: "提示词黄金公式",
        summary: "一个公式让你写出 80 分以上的 prompt，不用再东拼西凑。",
        duration: "5 分钟",
        tags: ["核心", "推荐"],
        sections: [
          {
            type: "paragraph",
            text: "好 prompt 不是越长越好，而是要素齐全。下面这个公式涵盖所有关键维度：",
          },
          {
            type: "tip",
            text: "✨ 黄金公式：主体 + 细节描述 + 环境/构图 + 风格 + 光影 + 画质修饰",
          },
          { type: "heading", text: "六个要素拆解" },
          {
            type: "keyValue",
            items: [
              { key: "主体",          value: "你要画什么？(一只猫 / 一个女战士 / 一个海报)" },
              { key: "细节描述",      value: "主体的特征 (姿势、服装、表情、道具)" },
              { key: "环境/构图",     value: "在哪里、什么角度 (海边、特写、俯视、留白)" },
              { key: "风格",          value: "画风类型 (写实/动漫/水墨/3D 渲染/油画)" },
              { key: "光影",          value: "时间和氛围 (黄昏暖光、电影级打光、霓虹光)" },
              { key: "画质修饰",      value: "技术词 (4K, masterpiece, sharp focus, cinematic)" },
            ],
          },
          { type: "heading", text: "对比示例" },
          {
            type: "prompt",
            label: "❌ 平庸版",
            text: "一只猫坐在窗台上",
          },
          {
            type: "prompt",
            label: "✅ 黄金公式版",
            text: "An orange tabby cat with bright green eyes, sitting elegantly on a wooden window sill, looking out toward a rainy street, cozy interior background slightly blurred, photorealistic style, soft warm afternoon light coming from the side, shallow depth of field, 4K, sharp focus, professional photography",
          },
          {
            type: "paragraph",
            text: "两个 prompt 主体相同，但细节、环境、风格、光影、画质修饰一应俱全，效果天差地别。",
          },
          {
            type: "warning",
            text: "⚠️ 注意：GPT-Image-2 在英文 prompt 下表现明显更好。如果用中文，建议开启「智能优化」让 GPT-5 帮你转译。",
          },
        ],
      },
      {
        id: "style-keywords",
        title: "8 种主流风格关键词速查",
        summary: "复制粘贴就能用的风格词，覆盖游戏美术的常见需求。",
        duration: "4 分钟",
        tags: ["速查"],
        sections: [
          { type: "paragraph", text: "下面每个风格都给了关键词组合，直接拼到你的 prompt 里。" },
          { type: "heading", text: "1. 3D 皮克斯渲染（适合 Q 版角色）" },
          { type: "prompt", label: "风格关键词", text: "3D Pixar style, soft global illumination, subsurface scattering, expressive cartoon character, cinematic render, octane render quality" },
          { type: "heading", text: "2. 2D 美式卡通（适合 IP 角色）" },
          { type: "prompt", label: "风格关键词", text: "2D American cartoon style, clean lineart, flat shading, vibrant colors, expressive character design, animation production quality" },
          { type: "heading", text: "3. 日系动漫（适合二次元）" },
          { type: "prompt", label: "风格关键词", text: "Japanese anime style, Makoto Shinkai inspired, vibrant cel shading, detailed background, soft glow, beautiful atmosphere" },
          { type: "heading", text: "4. 写实游戏 CG（适合宣发主视觉）" },
          { type: "prompt", label: "风格关键词", text: "Photorealistic game CG, Unreal Engine 5, hyper-detailed, dramatic lighting, AAA game promotional art, cinematic composition, 8K resolution" },
          { type: "heading", text: "5. 像素风（适合复古游戏）" },
          { type: "prompt", label: "风格关键词", text: "16-bit pixel art, retro game style, limited color palette, sharp pixel edges, isometric view" },
          { type: "heading", text: "6. 国风水墨（适合东方题材）" },
          { type: "prompt", label: "风格关键词", text: "Traditional Chinese ink painting, Shan Shui style, splash ink technique, minimalist composition, elegant brushwork" },
          { type: "heading", text: "7. 赛博朋克（适合未来题材）" },
          { type: "prompt", label: "风格关键词", text: "Cyberpunk style, neon-lit, holographic UI, rain reflections, dystopian atmosphere, blade runner inspired" },
          { type: "heading", text: "8. 厚涂油画（适合精修立绘）" },
          { type: "prompt", label: "风格关键词", text: "Digital oil painting, thick impasto brushstrokes, painterly style, dramatic chiaroscuro, classical composition" },
          {
            type: "tip",
            text: "💡 把这些关键词当配方：先写主体描述，再加上对应风格的整段关键词，效果立刻提升。",
          },
        ],
      },
      {
        id: "multi-image",
        title: "多图参考的正确姿势",
        summary: "上传多张参考图怎么写 prompt，让模型知道你想从每张图里提取什么。",
        duration: "4 分钟",
        tags: ["进阶"],
        sections: [
          {
            type: "paragraph",
            text: "GPT-Image-2 支持最多 9 张参考图，但很多人传了多张图却不知道怎么让模型「按你想要的方式」组合。",
          },
          { type: "heading", text: "关键技巧：在 prompt 里明确每张图的用途" },
          {
            type: "prompt",
            label: "❌ 没有引导",
            text: "Combine these references into one image",
          },
          {
            type: "paragraph",
            text: "↑ 这种写法模型不知道该取哪个的什么，结果通常很糟。",
          },
          {
            type: "prompt",
            label: "✅ 明确指示",
            text: "Use the character from image 1, the outfit style from image 2, and the background environment from image 3. Combine them into a single full-body portrait, photorealistic style, soft cinematic lighting.",
          },
          { type: "heading", text: "常见组合场景" },
          {
            type: "list",
            items: [
              "「角色 + 服装 + 场景」：3 张图分别贡献一个元素",
              "「主角 + 风格参考」：2 张图，第一张定形象、第二张定风格",
              "「连续动作」：传同一角色不同姿势，让模型保持一致性",
              "「换装」：传角色 + 服装，要求保留角色面部特征但更换装扮",
            ],
          },
          {
            type: "warning",
            text: "⚠️ 参考图越多，模型越容易「平均化」结果。一般 2–4 张是甜蜜点；超过 5 张需要更精确的 prompt 引导。",
          },
        ],
      },
    ],
  },

  // ── 3. 进阶玩法 ────────────────────────────────────────────────────────────
  {
    id: "advanced",
    label: "进阶玩法",
    emoji: "✨",
    articles: [
      {
        id: "thinking-mode",
        title: "智能优化提示词（GPT-5 思考模式）",
        summary: "什么时候该开、什么时候不该开，怎么看思考过程。",
        duration: "3 分钟",
        tags: ["核心"],
        sections: [
          {
            type: "paragraph",
            text: "「智能优化提示词」是平台的特色功能：开启后，会先调用 GPT-5 思考模型理解你的需求，自动改写为精准的英文 prompt，再发给 GPT-Image-2。",
          },
          { type: "heading", text: "什么时候开" },
          {
            type: "list",
            items: [
              "你写的是中文（GPT-Image-2 英文表现更好）",
              "你的描述比较模糊或简短（如「一只酷酷的猫」）",
              "你想画的场景比较复杂、要素多",
              "之前的 prompt 出来效果不理想，想让 AI 帮你改写",
            ],
          },
          { type: "heading", text: "什么时候不开" },
          {
            type: "list",
            items: [
              "你已经有一个调试好的精准 prompt",
              "你需要严格控制某些细节，不希望 AI 改动",
              "你在做风格批量测试（避免每次优化结果不一致）",
            ],
          },
          {
            type: "warning",
            text: "⚠️ 开启后会增加 5–30 秒思考时间。生成完成后会显示「Thought for X.X 秒」徽章，点击可看完整思考过程和优化前后的 prompt 对比。",
          },
          {
            type: "tip",
            text: "💡 第一次用强烈建议开起来对比效果，然后再决定后续是否常开。",
          },
        ],
      },
      {
        id: "iterate",
        title: "以结果为参考继续生成（迭代创作）",
        summary: "对结果不太满意？把它当参考图继续打磨，越改越好。",
        duration: "2 分钟",
        tags: ["核心", "推荐"],
        sections: [
          {
            type: "paragraph",
            text: "生图很少能一次到位。最高效的迭代方式是：把上一轮的结果图当作下一轮的参考图，配合 prompt 微调。",
          },
          { type: "heading", text: "操作步骤" },
          {
            type: "steps",
            items: [
              { title: "完成第一轮生成", text: "右侧对话流出现结果后，点击图卡展开。" },
              { title: "点「以此结果为参考图继续生成」", text: "结果区下方有这个按钮，点击后会自动把图填到左侧参考图区。" },
              { title: "改 prompt", text: "保留主要描述，加上想改进的方向（例如「同样姿势，把头发改成红色，背景换成森林」）。" },
              { title: "再次提交", text: "新的对话气泡会出现，跟之前的结果一起留在历史里方便对比。" },
            ],
          },
          {
            type: "tip",
            text: "💡 这种「迭代式生成」是 ChatGPT 同款工作流，比一次到位更可控、更省 token。",
          },
        ],
      },
      {
        id: "scheduled",
        title: "定时生成 + 自动重试",
        summary: "夜里跑批量任务，省时省心。",
        duration: "2 分钟",
        tags: ["进阶"],
        sections: [
          {
            type: "paragraph",
            text: "定时生成适合需要在特定时间执行的任务，比如夜里跑大批量、避开高峰期减少 429 限流。",
          },
          { type: "heading", text: "如何使用" },
          {
            type: "steps",
            items: [
              { title: "在创作页底部开启「定时生成」开关", text: "" },
              { title: "选执行日期和时间", text: "支持精确到分钟。" },
              { title: "设置最大重试次数", text: "失败后自动重试，建议 2–3 次。" },
              { title: "提交后任务进入「等待中」状态", text: "到时间会自动触发执行。" },
            ],
          },
          {
            type: "warning",
            text: "⚠️ 定时任务必须在系统运行时才能触发。如果服务重启，未到期的定时任务会保留，到期会重新尝试。",
          },
        ],
      },
    ],
  },

  // ── 4. FAQ ─────────────────────────────────────────────────────────────────
  {
    id: "faq",
    label: "FAQ",
    emoji: "❓",
    articles: [
      {
        id: "runtime-rules",
        title: "运行说明：并发、耗时与重试规则",
        summary: "首页只放了简版，这里是完整规则说明。",
        duration: "2 分钟",
        tags: ["必读"],
        sections: [
          {
            type: "paragraph",
            text: "为了兼顾上游服务稳定性和团队共享额度，平台对生图任务做了并发控制，同时保留失败后的手动重试能力。",
          },
          { type: "heading", text: "当前运行规则" },
          {
            type: "list",
            items: [
              "全局最多同时运行 15 个生图任务",
              "单账号最多同时运行 5 个生图任务",
              "超出上限时，提交阶段会直接提示，不会继续把任务塞进执行队列",
              "定时任务到点后也会遵守同样的并发限制",
            ],
          },
          { type: "heading", text: "耗时和排队怎么理解" },
          {
            type: "list",
            items: [
              "当前供应商资源紧张，单次生图平均耗时 3–7 分钟都算正常",
              "开启智能优化提示词后，还会额外增加 5–30 秒思考时间",
              "如果你的账号已经有 5 个任务在跑，新任务会被提示稍后再提交",
              "如果团队整体已经跑满 15 个任务，也会被提示等待，而不是无限排队",
            ],
          },
          { type: "heading", text: "遇到 500 / 429 怎么办" },
          {
            type: "list",
            items: [
              "偶发 500、超时、网关错误，通常直接重试即可",
              "429 代表上游限流，建议等 1–5 分钟后再试",
              "失败后可去「生图历史」或任务详情页手动点「重试」",
              "如果连续多次失败，再联系管理员排查后端日志或上游状态",
            ],
          },
          {
            type: "tip",
            text: "💡 首页只展示并发上限和账号上限，目的是让首屏更干净；完整运行规则统一以本页为准。",
          },
        ],
      },
      {
        id: "429-error",
        title: "为什么提示「调用太频繁，服务方限流」？",
        summary: "429 错误的成因和解决办法。",
        duration: "1 分钟",
        sections: [
          {
            type: "paragraph",
            text: "这是上游服务方做的限流（HTTP 429），跟我们平台本身的页面无关。为了减少这种情况，平台现在也限制为：全局最多同时运行 15 个任务，单账号最多同时运行 5 个任务。常见原因：",
          },
          {
            type: "list",
            items: [
              "短时间提交太多任务，超出每分钟调用上限",
              "整个团队同时大量使用，触发账号级别限流",
              "服务方临时维护或高峰期",
            ],
          },
          { type: "heading", text: "怎么办" },
          {
            type: "list",
            items: [
              "如果看到“已达并发上限”，说明平台在主动保护上游额度，等已有任务结束后再提交即可",
              "等 1–5 分钟后重试（系统会自动重试 4 次，仍失败才会标 failed）",
              "在「生图历史」找到失败任务，点击「重试」按钮",
              "减少同时提交的任务数",
              "高峰期改用定时生成，错峰执行",
            ],
          },
        ],
      },
      {
        id: "image-quality",
        title: "出图最高几 K？为什么不是 2K？",
        summary: "GPT-Image-2 的分辨率上限说明。",
        duration: "1 分钟",
        sections: [
          {
            type: "paragraph",
            text: "GPT-Image-2 官方只支持三档输出：",
          },
          {
            type: "keyValue",
            items: [
              { key: "1:1 方形",                  value: "1024 × 1024（1K）" },
              { key: "16:9 / 4:3 横版",           value: "1536 × 1024（1.5K）" },
              { key: "9:16 / 3:4 竖版",           value: "1024 × 1536（1.5K）" },
              { key: "auto 自动",                 value: "模型在以上三档挑选" },
            ],
          },
          {
            type: "tip",
            text: "💡 GPT-Image-2 出图最高 1.5K（长边 1536 像素），不是 2K。如果需要 2K+ 用于印刷或主视觉，可以用 ESRGAN/Real-CUGAN 等超分工具后处理。",
          },
        ],
      },
      {
        id: "task-stuck",
        title: "任务一直「等待中」或「进行中」不动怎么办？",
        summary: "任务卡住的几种情况。",
        duration: "1 分钟",
        sections: [
          { type: "heading", text: "可能的情况" },
          {
            type: "list",
            items: [
              "正常等待：当前供应商资源紧张，单次生图平均 3–7 分钟都正常，思考模式额外 +5–30 秒",
              "并发受限：平台全局最多同时运行 15 个任务，单账号最多同时运行 5 个，超出会先提示",
              "队列排队：前面有其他用户的任务在跑，或你的账号已有 5 个任务正在执行",
              "服务方超时 / 500：偶发情况，失败后重试通常即可",
              "服务重启：「进行中」的任务会被中断标为失败",
            ],
          },
          { type: "heading", text: "建议处理" },
          {
            type: "list",
            items: [
              "先等 3–7 分钟再看，多数情况会自动完成",
              "如果是 500 或超时，失败后点「重试」按钮再来一次",
              "如果反复失败，告知管理员检查后端日志",
            ],
          },
        ],
      },
      {
        id: "upload-issues",
        title: "上传参考图失败 / 显示不出来怎么办？",
        summary: "图片上传相关问题。",
        duration: "1 分钟",
        sections: [
          { type: "heading", text: "常见原因" },
          {
            type: "list",
            items: [
              "格式不支持：只接受 JPG / PNG / WEBP，HEIC/GIF 等需要先转格式",
              "文件过大：建议单张 < 10MB，过大会上传超时或被服务方拒绝",
              "网络问题：内网/公司网偶尔不稳",
            ],
          },
          {
            type: "tip",
            text: "💡 多张图同时上传时，每张都会单独走一次上传请求。某张失败不会影响其它图，但建议刷新页面后重试。",
          },
        ],
      },
    ],
  },
];
