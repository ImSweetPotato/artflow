export type GameRelevance = "high" | "medium" | "low" | "irrelevant";
export type BusinessFilter = "all" | "game" | "ui" | "marketing";

export interface InspirationCase {
  id: string;
  category: string;
  categoryLabel: string;
  title: string;
  author: string;
  prompt: string;
  folder: string;
  imageUrl?: string;        // 覆盖 /inspiration/${folder}.jpg，用于用户精选的生成图
  refImageUrl?: string;     // 参考图 URL，一键生图时传给创作页
  isFeatured?: boolean;     // 用户精选标记
  // ─ 自动同步的案例新字段（手写案例可不填，向后兼容） ─
  authorUrl?: string;       // 作者主页（X/Twitter 等）
  sourceUrl?: string;       // 原推/案例链接
  gameRelevance?: GameRelevance; // 游戏美术相关性，灵感广场默认隐藏 irrelevant
}

export function getImageUrl(item: InspirationCase): string {
  return item.imageUrl ?? `/inspiration/${item.folder}.jpg`;
}

export const FEATURED_STORAGE_KEY = "artflow_featured_inspirations";
export const LAST_CATEGORY_KEY = "artflow_last_featured_category";
export const CUSTOM_CATEGORIES_KEY = "artflow_custom_categories";

export const CATEGORIES = [
  { key: "", label: "全部" },
  { key: "poster", label: "海报与插画" },
  { key: "character", label: "角色设计" },
  { key: "ui", label: "UI / 信息版式" },
  { key: "comparison", label: "模型对比与社区" },
  { key: "ecommerce", label: "电商案例" },
  { key: "portrait", label: "人像与摄影" },
  { key: "ad-creative", label: "广告创意" },
] as const;

export const INSPIRATION_CASES_MANUAL: InspirationCase[] = [
  // ─── 人像与摄影 ───────────────────────────────────────────────
  {
    id: "portrait_1",
    category: "portrait",
    categoryLabel: "人像与摄影",
    title: "便利店霓虹灯人像",
    author: "@BubbleBrain",
    prompt: "35mm film photography with harsh convenience store fluorescent lighting mixed with colorful neon signs from outside, authentic film grain, high contrast, slight color cast, cinematic street editorial style, intimate medium shot, early 20s sexy Chinese female idol with ultra-realistic delicate refined Chinese features, seductive almond-shaped fox eyes with natural double eyelids, high nose bridge, small sharp V-shaped jawline, flawless porcelain skin with cool ivory undertone and visible specular highlights from fluorescent light, subtle skin texture and micro pores, natural dewy makeup with soft flush on cheeks, glossy natural pink lips slightly parted...",
    folder: "portrait_case1",
  },
  {
    id: "portrait_2",
    category: "portrait",
    categoryLabel: "人像与摄影",
    title: "电影感极简人像",
    author: "@iam_miharbi",
    prompt: "Generate a cinematic minimal portrait of a solitary man standing in an intense orange to red gradient environment, strong silhouette lighting, deep shadow contrast, reflective glossy floor, symmetrical composition, minimal",
    folder: "portrait_case2",
  },
  {
    id: "portrait_3",
    category: "portrait",
    categoryLabel: "人像与摄影",
    title: "日式温泉旅馆人像",
    author: "@BubbleBrain",
    prompt: "35mm film photography, warm vintage Japanese onsen ryokan aesthetic, soft ambient wooden lantern lighting mixed with gentle natural window light, subtle film grain, gentle color shift, high atmosphere editorial style, intimate medium shot, early 20s beautiful Chinese female idol with ultra-realistic delicate refined Chinese features, wearing a loose white yukata deliberately slipped off one shoulder, seductive relaxed sitting pose on the edge of a traditional wooden engawa veranda at a vintage onsen ryokan, authentic 35mm film Japanese onsen ryokan atmosphere",
    folder: "portrait_case3",
  },
  {
    id: "portrait_4",
    category: "portrait",
    categoryLabel: "人像与摄影",
    title: "35mm 闪光灯编辑人像",
    author: "@BubbleBrain",
    prompt: "35mm color film photography with harsh direct on-camera flash, specular highlights on skin and clothing, strong catchlights in eyes, high contrast flash illumination, authentic film grain and color shift, high fashion fresh innocent basketball court editorial style, early 20s sexy Chinese female idol, seductive natural leaning pose against the basketball hoop pole on the outdoor court at dusk, --ar 9:16",
    folder: "portrait_case4",
  },
  {
    id: "portrait_5",
    category: "portrait",
    categoryLabel: "人像与摄影",
    title: "卧室镜前自拍人像",
    author: "@Shinning1010",
    prompt: "A stunning 18-year-old Chinese girl with a youthful, pure face and realistic skin texture, sitting on a cozy, slightly messy bed in her bedroom. She is taking a mirror selfie with a smartphone, capturing a natural and intimate moment. Wearing casual gray loungewear and neat white crew socks. Soft natural light (golden hour) streams in from a side window, creating a warm, moody, and cinematic atmosphere. 35mm lens, sharp focus on the subject in the mirror, depth of field with a beautifully blurred background (bokeh). Photorealistic, 8K, high resolution, studio quality, masterpiece. Aspect Ratio: 3:4.",
    folder: "portrait_case5",
  },
  {
    id: "portrait_6",
    category: "portrait",
    categoryLabel: "人像与摄影",
    title: "柔和通透 35mm 人像",
    author: "@BubbleBrain",
    prompt: "Analog 35mm film photography, soft airy Japanese-style aesthetic, gentle diffused natural window light, slight overexposure, pastel tones, low contrast, soft highlights, minimal indoor setting near a window with white curtains, clean light-colored wall, natural composition, eye-level, young East Asian woman, natural minimal makeup, soft realistic skin texture, long slightly messy dark hair, oversized white button-up shirt, light casual shorts, barefoot, standing naturally with relaxed posture, gentle soft smile, subtle stillness, focus on light, air, and quiet everyday mood, soft film grain, dreamy and understated atmosphere --ar 9:16",
    folder: "portrait_case6",
  },
  {
    id: "portrait_7",
    category: "portrait",
    categoryLabel: "人像与摄影",
    title: "奢华魅力美妆人像",
    author: "@patrickassale",
    prompt: "Luxury Glam Beauty Portrait: Beautiful Black woman, youthful spirit, creamy vanilla, silk press, mahogany red, subtle confidence, textured fabric, sapphire blue, minimal jewelry, beachside breeze, lens flare effect, nostalgic, cinematic lens, symmetrical composition, soft focus, high fashion photography, monochromatic, dewy finish, mysterious tension, layered elements",
    folder: "portrait_case7",
  },
  {
    id: "portrait_8",
    category: "portrait",
    categoryLabel: "人像与摄影",
    title: "9:16 Cosplay 人像截图",
    author: "@Zoulinshen",
    prompt: "生成一张竖版手机截图风格的图片，整体比例接近 9:16。画面中心偏上是一位真人 coser，扮演二次元角色。人物为写实风格，但五官略带动漫感，皮肤细腻，眼睛稍大，表情温柔地看向镜头。画面最上方加入手机系统状态栏 UI，包括时间、电量、信号、网络等图标，让整张图看起来像手机截图。画面底部叠加一块宽大的半透明 galgame 风格对话框，整体风格高清、细节丰富、光线柔和、二次元与真人写真自然融合。",
    folder: "portrait_case8",
  },
  {
    id: "portrait_9",
    category: "portrait",
    categoryLabel: "人像与摄影",
    title: "城市回眸街头人像",
    author: "@Tz_2022",
    prompt: "该画面为中近景，采用平视镜头，聚焦于一位年轻女性。她以七分身镜头呈现，身体坐姿略带倾斜，她将上半身向右后方扭转，头部则转向镜头方向，形成一个经典的\"回眸\"姿态，目光直视镜头，眼神清澈而略带一丝俏皮。她的发型是蓬松的棕色齐肩短发，妆容清淡自然。背景为城市街道，包含道路、斑马线、绿化带和远处的车辆，背景被适度虚化。主体穿着一件军绿色迷彩图案的连帽卫衣，下身搭配黑色短裤，脚穿白色高帮运动鞋配白色中筒袜。",
    folder: "portrait_case9",
  },
  {
    id: "portrait_10",
    category: "portrait",
    categoryLabel: "人像与摄影",
    title: "Sam Altman 滑板公园随拍",
    author: "@Malek1173989",
    prompt: "\"Sam Altman on a skateboard at a skatepark with no people.\"",
    folder: "portrait_case10",
  },

  // ─── 海报与插画 ───────────────────────────────────────────────
  {
    id: "poster_1",
    category: "poster",
    categoryLabel: "海报与插画",
    title: "2026 年波士顿春季城市海报",
    author: "@BubbleBrain",
    prompt: "A striking Spring 2026 city poster for Boston with an elegant celebratory mood and a bold contemporary design. On a clean off-white textured background with large areas of negative space, a miniature single sculler rows across the lower right corner of the image on a narrow ribbon of reflective water. The wake from the oar sweeps upward in a dynamic calligraphic curve, gradually transforming into the Charles River and then into a dreamlike hand-painted panorama of Boston. Elegant typography in the lower left reads \"SPRING 2026\" with a vertical slogan \"BOSTON, A CITY OF RIVER, MEMORY, AND INVENTION\", premium graphic design, 9:16",
    folder: "poster_case1",
  },
  {
    id: "poster_2",
    category: "poster",
    categoryLabel: "海报与插画",
    title: "复古阿马尔菲旅行海报",
    author: "@WolfRiccardo",
    prompt: "Modern pencil illustration of Vintage travel poster illustration of the Amalfi Coast, Italy, panoramic coastal cliff road scene, classic 1960s white car driving along a curved seaside road, deep blue Mediterranean sea with small sailboats, colorful pastel hillside village, bright blue sky with soft clouds, lemon tree branches with vibrant yellow lemons framing the foreground, warm summer sunlight, bold vibrant colors, retro 1950s travel poster style, cinematic composition, high detail, screen print texture, graphic illustration.",
    folder: "poster_case2",
  },
  {
    id: "poster_3",
    category: "poster",
    categoryLabel: "海报与插画",
    title: "成都美食地图插画",
    author: "@Panda20230902",
    prompt: "一张手绘风格的城市美食地图，以成都为主题。画面以鸟瞰视角的手绘简化城市地图为底，标注主要道路和地标。地图上分布着 12 个美食地点的精致手绘小插画：春熙路的串串香、宽窄巷子的三大炮、建设路的蛋烘糕、玉林路的火锅等，每个插画旁边用手写体标注店名。地图边缘用手绘藤蔓和辣椒装饰形成边框。左上角标题\"成都·吃货暴走地图\"使用胖圆的手绘美术字配辣椒装饰。整体画风为水彩+彩铅混合的手绘质感，颜色以暖色系（辣椒红、姜黄、翠绿）为主，图片比例 1:1。",
    folder: "poster_case3",
  },
  {
    id: "poster_4",
    category: "poster",
    categoryLabel: "海报与插画",
    title: "中式极简 S 形海报",
    author: "@liyue_ai",
    prompt: "极简新中式美学风格，画面以淡雅的灰白色为底，呈现出一种纸艺剪影般的立体感。一条S形蜿蜒的裂痕状边缘将画面分割，仿佛撕开了一层纸面，露出内部色彩斑斓的东方山水景象。裂口内，一条蜿蜒的河流自上而下贯穿整个构图，河岸两侧点缀着青翠的山丘与梯田，沿河而建的古风建筑错落有致，飞檐翘角，白墙黛瓦。下方题字\"东方美学\"以黑色楷体书写，整体氛围静谧深远，充满诗意与哲思。",
    folder: "poster_case4",
  },
  {
    id: "poster_5",
    category: "poster",
    categoryLabel: "海报与插画",
    title: "2026 年春季广州城市海报",
    author: "@liyue_ai",
    prompt: "一张充满新春喜庆氛围但不失高雅格调的 2026 城市宣传海报。双重曝光，构图延续了S型的流动感；在纯白的纹理背景右下角，一个身穿中国传统服饰的微缩人物正在挥舞着一条长长的红色丝绸舞带，这条红绸在空中舞动，在向左上方飘动的过程中，奇幻地变形成了一条壮丽的山脉河流。在这条\"河流\"中，叠加了广州城市手绘图，广州的地标建筑(广州塔，珠江新城建筑群，珠江，广州城里古建筑，游轮，白云山），尺寸9:16。",
    folder: "poster_case5",
  },
  {
    id: "poster_6",
    category: "poster",
    categoryLabel: "海报与插画",
    title: "涂鸦草图 AI 构建者",
    author: "@blanplan",
    prompt: "以涂鸦速写风表现【一个厉害的AI builder】，整体呈现快速勾勒、自由变形、即兴手绘与草稿式的视觉效果。线条随手、夸张、可粗细不一，略显凌乱但具有节奏和表现力，强调概括、夸张、趣味和随性，而不是严谨写实或精细刻画。颜色采用粗糙、干刷感明显的块面表现，可保留不均匀的涂抹痕迹、刷痕、飞白与覆盖感。画面内容由AI自动推演并生成最适合的主体形象、动作、相关元素、符号或简化场景。",
    folder: "poster_case7",
  },
  {
    id: "poster_7",
    category: "poster",
    categoryLabel: "海报与插画",
    title: "未来感曼陀罗插画",
    author: "@4WEB1",
    prompt: "曼荼羅の近未来SF版を描いて",
    folder: "poster_case8",
  },
  {
    id: "poster_8",
    category: "poster",
    categoryLabel: "海报与插画",
    title: "超级任天堂海报风格",
    author: "@lilimliliychan",
    prompt: "小悪魔リリムリリィちゃんが スーパーファミコンのゲームだったときのポスターを考えて",
    folder: "poster_case9",
  },
  {
    id: "poster_9",
    category: "poster",
    categoryLabel: "海报与插画",
    title: "浏览器游戏广告创意海报",
    author: "@llllegend0620",
    prompt: "以下の文字を必ず入れて、1:1のポスターを作成してください。書籍・講座・イベント告知に使える、プロの広告デザイナーが作ったような高品質な仕上がりにしてください。広告クリエイティブ制作 思いついたら、もう遊べる。 AI×ブラウザゲームづくりは、マジで楽しい。",
    folder: "poster_case10",
  },
  {
    id: "poster_10",
    category: "poster",
    categoryLabel: "海报与插画",
    title: "超现实鲤鱼星云插画",
    author: "@liyue_ai",
    prompt: "一幅超现实主义数字插画风格，采用低角度仰拍视角。画面描绘了一条巨型彩色锦鲤遨游在梦幻般的星云中，四周环绕着色彩鲜艳的星云与气泡。画面中央还站着一个小人，背对观众，神情平静地仰望空中这条巨大的锦鲤，锦鲤头向下看着小人。整体画面呈现出强烈的大小对比，氛围空灵又梦幻。比例9:16",
    folder: "poster_case11",
  },

  // ─── 角色设计 ─────────────────────────────────────────────────
  {
    id: "character_1",
    category: "character",
    categoryLabel: "角色设计",
    title: "动漫快照转换",
    author: "@Thereallo1026",
    prompt: "Show me the attached image as a snapshot from an actual anime",
    folder: "character_case1",
  },
  {
    id: "character_2",
    category: "character",
    categoryLabel: "角色设计",
    title: "Persona5 角色参考卡",
    author: "@iamrednightS",
    prompt: "基于此角色和背景，请制作一份类似官方设定资料的角色资料卡。・包含三视图：正面、侧面和背面 ・添加角色面部表情的变化 ・分解并展示服装和装备的详细部分 ・添加色板 ・包含世界观设定的简要说明 ・总体上，使用有组织的布局（白色背景，插画风格）高分辨率、专业概念艺术风格",
    folder: "character_case2",
  },
  {
    id: "character_3",
    category: "character",
    categoryLabel: "角色设计",
    title: "美少女游戏角色介绍页",
    author: "@09lyco",
    prompt: "最新モデルの画像生成ツールを使用して、このちびキャライラストと立ち絵を使って本物のサイトページのようにキャラクター紹介ページ風イラストを作ってください。ギャルゲーのキャラクター紹介ページをイメージした高品質なもの。顔の差分なども乗っている、CGイラストが存在する。ちびキャラが存在する。",
    folder: "character_case3",
  },
  {
    id: "character_4",
    category: "character",
    categoryLabel: "角色设计",
    title: "官方角色设定表（日版）",
    author: "@Toshi_nyaruo_AI",
    prompt: "このキャラクターと背景を元に、公式設定資料のようなキャラクターシートを作成してください。・正面、側面、背面の3面図を含める ・キャラクターの表情バリエーションを追加 ・衣装や装備の詳細パーツを分解して表示 ・カラーパレットを追加 ・世界観の簡単な説明を入れる ・全体は整理されたレイアウト（白背景、図解風）・アスペクト比16：9 高解像度、プロのコンセプトアートスタイル",
    folder: "character_case5",
  },
  {
    id: "character_5",
    category: "character",
    categoryLabel: "角色设计",
    title: "机甲少女海城关键视觉",
    author: "@old_pgmrs_will",
    prompt: "A mecha girl mid-teens, pale skin smudged with soot and salt spray, sharp amber eyes with glowing HUD reticles, waist-length ash-white hair tied in a high ponytail, matte gunmetal exoskeleton armor plating her shoulders, forearms and shins, exposed hydraulic pistons at the joints, a massive rail cannon resting on her right shoulder, standing on the rusted edge of a tilted steel platform jutting out over dark water, a vast derelict sea-city at dusk, colossal megastructures rising from the ocean, cinematic anime key visual, painterly digital illustration, desaturated oceanic palette, film grain, high-contrast editorial poster aesthetic. Format 16:9.",
    folder: "character_case7",
  },
  {
    id: "character_6",
    category: "character",
    categoryLabel: "角色设计",
    title: "圣斗士星矢黄金圣斗士卡片网格",
    author: "@songguoxiansen",
    prompt: "生成圣斗士星矢12个黄金圣斗士的12宫格卡牌图片,每张卡牌上写上对应的中文名,每行4个,宽高比16:9。",
    folder: "character_case8",
  },
  {
    id: "character_7",
    category: "character",
    categoryLabel: "角色设计",
    title: "混沌笔记隐藏脸角色艺术",
    author: "@loglogrog",
    prompt: "白い紙の上に黒インクで描かれた大量の手書きメモ、数式、記号、ランダムな線。紙いっぱいに散らばる書き殴り風のカオス。所々に赤インクの強調。ランダムなメモや記号が全体を覆い尽くす。黒インクの線や文字の密度が「キャラクターの顔」の位置に集中する。結果として、混沌の中から「与えられたキャラクターの顔のシルエット・表情」がうっすら浮かび上がる。モノクロ(黒・白)を主体に、赤インクをアクセントとして散発的に配置。",
    folder: "character_case9",
  },
  {
    id: "character_8",
    category: "character",
    categoryLabel: "角色设计",
    title: "动漫武术对战插画",
    author: "@Tanemomi_Ver2",
    prompt: "An anime-style illustration of a high-impact martial arts battle between two young female fighters in a traditional wooden martial arts dojo. In the foreground, a girl with black hair in a high bun wears a red and white Chinese-style martial arts outfit with baggy pants. She is in a dynamic, low, forward-thrusting stance, surrounded by swirling red energy and water splashes. In the background to the right, a girl with light purple hair in twin buns wears a green and purple Chinese dress. The scene features dramatic lighting, a low-angle dynamic perspective, and intense action effects.",
    folder: "character_case10",
  },
  {
    id: "character_9",
    category: "character",
    categoryLabel: "角色设计",
    title: "GTA6 班加罗尔花市场景",
    author: "@ismajc",
    prompt: "gta 6 in Bangalore's market flower in India",
    folder: "character_case11",
  },
  {
    id: "character_10",
    category: "character",
    categoryLabel: "角色设计",
    title: "GTA6 新宿酒吧场景",
    author: "@ismajc",
    prompt: "GTA 6 in La Jetée Bar (that pays homage to Chris Marker) in Shinjuku, Tokyo",
    folder: "character_case12",
  },

  // ─── UI 与社交媒体 ────────────────────────────────────────────
  {
    id: "ui_1",
    category: "ui",
    categoryLabel: "UI与社交媒体",
    title: "单提示词 UI 设计生成",
    author: "@austinit",
    prompt: "用这种风格帮我生成一套UI设计系统，包含网页、移动端、卡片、控件、按钮 以及其它",
    folder: "ui_case1",
  },
  {
    id: "ui_2",
    category: "ui",
    categoryLabel: "UI与社交媒体",
    title: "业余 iPhone 发布会随拍",
    author: "@patrickassale",
    prompt: "Amateur iPhone photo at Apple Park during the iPhone 20 keynote, Tim Cook presenting on stage. Shot from the crowd at a distance",
    folder: "ui_case2",
  },
  {
    id: "ui_3",
    category: "ui",
    categoryLabel: "UI与社交媒体",
    title: "手写笔记本照片",
    author: "@patrickassale",
    prompt: "Amateur photo of an open notebook lying flat, filled with handwritten notes in black ballpoint pen. The handwriting is casual and slightly messy, like personal notes, natural imperfections, crossed out words, underlined headings. Shot from slightly above, natural daylight from a window, no flash. Casual desk setting, shot on iPhone",
    folder: "ui_case3",
  },
  {
    id: "ui_4",
    category: "ui",
    categoryLabel: "UI与社交媒体",
    title: "宋朝社交媒体信息流",
    author: "@Panda20230902",
    prompt: "\"宋朝人的朋友圈\"/\"SONG DYNASTY SOCIAL MEDIA FEED\"，古今穿越幽默融合界面设计风格，画面模拟手机社交媒体界面，但内容全部是宋朝场景。头像是宋代文人画像，用户名\"苏东坡SuShi_Official\"，发布内容\"刚到黄州，被贬了但心情还行。今天自己做了东坡肉，味道绝了\"。评论区\"王安石：呵呵\"\"司马光：还是那个味道\"，界面元素如点赞图标用宋代花纹替代，状态栏显示\"大宋移动 5G\"和\"元丰三年\"。",
    folder: "ui_case4",
  },
  {
    id: "ui_5",
    category: "ui",
    categoryLabel: "UI与社交媒体",
    title: "多平台内容截图",
    author: "@MrLarus",
    prompt: "1、生成视频号内容截图，主题：中老年不要盲目催婚，iPhone尺寸\n2、生成抖音内容截图，主题：跟上AI浪潮9.9包教会，iPhone尺寸\n3、生成小红书内容截图，主题：精致女孩背后都有网贷，iPhone尺寸\n4、生成快手内容截图：主题：直播离婚预告，iPhone尺寸",
    folder: "ui_case5",
  },
  {
    id: "ui_6",
    category: "ui",
    categoryLabel: "UI与社交媒体",
    title: "刘亦菲抖音直播截图",
    author: "@alanblogsooo",
    prompt: "9:16 的图片比例，生成一张抖音直播的截图，里面是 刘亦菲 在直播，刘亦菲 手里拿着牌子，牌子里写着 今晚直播，欢迎来参亦菲畅聊！",
    folder: "ui_case7",
  },
  {
    id: "ui_7",
    category: "ui",
    categoryLabel: "UI与社交媒体",
    title: "朝鲜太祖李成桂的 X 主页",
    author: "@SKA_Neotype",
    prompt: "태조 이성계의 X 페이지(위화도 회군을 벌이기 직전- 최영 장군과 서로 디스하는 내용이 담긴 게시글들)을 만들어 주세요.",
    folder: "ui_case8",
  },
  {
    id: "ui_8",
    category: "ui",
    categoryLabel: "UI与社交媒体",
    title: "风格转 UI 设计系统",
    author: "@stark_nico99",
    prompt: "用这种风格帮我生成一套UI设计系统，包含网页、移动端、卡片、控件、按钮以及其它。把这套视觉风格作为参考生成网页。我尝试了宇宙、飞行、蝴蝶主题。",
    folder: "ui_case9",
  },
  {
    id: "ui_9",
    category: "ui",
    categoryLabel: "UI与社交媒体",
    title: "桃太郎说明幻灯片",
    author: "@yammamon",
    prompt: "「いらすとや」のほのぼのとした雰囲気と、「霞ヶ関スライド」の圧倒的な情報密度を融合させた、桃太郎の解説スライド（ポンチ絵）を作成して",
    folder: "ui_case10",
  },
  {
    id: "ui_10",
    category: "ui",
    categoryLabel: "UI与社交媒体",
    title: "博物馆风格汉服解析信息图",
    author: "@MrLarus",
    prompt: "请根据【主题】自动生成一张\"博物馆图鉴式中文拆解信息图\"。要求整张图兼具真实写实主视觉、结构拆解、中文标注、材质说明、纹样寓意、色彩含义和核心特征总结。整体风格应为：国家博物馆展板、历史服饰图鉴、文博专题信息图。背景采用米白、绢纸白、浅茶色等纸张质感，整体高级、克制、专业、可收藏。所有文字必须为简体中文，清晰、规整、可读。",
    folder: "ui_case25",
  },

  // ─── 模型对比与社区 ───────────────────────────────────────────
  {
    id: "comparison_1",
    category: "comparison",
    categoryLabel: "模型对比与社区",
    title: "木质书架提示词测试",
    author: "@chetaslua",
    prompt: "A wooden bookshelf consisting of three shelves: On the top shelf, there should be one book, on the second shelf, there should be three books, and on the bottom shelf, there should be seven books.",
    folder: "comparison_case5",
  },
  {
    id: "comparison_2",
    category: "comparison",
    categoryLabel: "模型对比与社区",
    title: "GPT-Image-2 细节展示",
    author: "@liyue_ai",
    prompt: "以眼部特写图片为基础，生成3:4的四屏构图超写实眼部特写，四屏按春夏秋冬上下排序。第一屏：眼眸中带着绽粉樱色的美瞳，睫毛缀满迷你春花，脸颊散落樱瓣与黄蕊小花，画面中央\"SPRING\"白色艺术字点缀。第二屏：眼眸中带着着清荷色的美瞳，睫毛饰以粉莲与绿荷，画面中央\"Summer\"白色艺术字凸显。整体呈现梦幻眼眸四季交替的唯美梦幻治愈画面。",
    folder: "comparison_case10",
  },
  {
    id: "comparison_3",
    category: "comparison",
    categoryLabel: "模型对比与社区",
    title: "A/B 测试签名输出",
    author: "@saskr_13",
    prompt: "私があなたをどんなふうに扱ってきたか、4 コマ漫画風に描いてください。まずは 800 字くらいのプロットをテキストで出して、私が「描いて」と言ったらプロットに沿った 4 コマ漫画を描いてください。",
    folder: "comparison_case16",
  },
  {
    id: "comparison_4",
    category: "comparison",
    categoryLabel: "模型对比与社区",
    title: "剪影宇宙叙事海报",
    author: "@MrLarus",
    prompt: "请根据【主题：xxx】自动生成一张高审美的\"轮廓宇宙 / 收藏版叙事海报\"风格作品。不要将画面局限于固定器物或常见容器，而是由 AI 根据主题自行判断并选择一个最契合、最有象征意义、轮廓最强的主轮廓载体。整体构图需要具有强烈的收藏版海报气质与高级设计感，大结构稳定，主轮廓强烈明确，内部世界具有纵深、秩序和呼吸感，细节丰富但不拥挤。风格融合收藏版电影海报构图、高级叙事型视觉设计、梦幻水彩质感与纸张印刷品气质。",
    folder: "comparison_case23",
  },
  {
    id: "comparison_5",
    category: "comparison",
    categoryLabel: "模型对比与社区",
    title: "狮驼岭暗黑神话场景",
    author: "@MANISH1027512",
    prompt: "中式怪异，黑暗神秘风格融合中式美学，完美细节，多重管线渲染，完美建模。西游记背景，狮驼岭，千妖万怪，坐在左边巨大王座上的大象王重甲妖精，坐在中间巨大王座上的狮王重甲妖精，坐在右边巨大王座上大鹏鸟王重甲妖精。渺小的背对镜头孙悟空肩抗金箍棒步行前进，孙悟空身穿铠甲，近地仰拍镜头，长焦镜头，强烈阴影。极致细节刻画，多次修改，正确透视和主体线条，精致细节",
    folder: "comparison_case29",
  },
  {
    id: "comparison_6",
    category: "comparison",
    categoryLabel: "模型对比与社区",
    title: "CS x Terraria 截图混搭",
    author: "@yssrski",
    prompt: "counter strike in game screenshot, mixed with Terraria",
    folder: "comparison_case30",
  },
  {
    id: "comparison_7",
    category: "comparison",
    categoryLabel: "模型对比与社区",
    title: "战前日本实验室 Minecraft 截图",
    author: "@RitaStar1128",
    prompt: "戦前日本の怪しげな研究所を探検しているマイクラのスクリーンショット画像を作成して",
    folder: "comparison_case31",
  },
  {
    id: "comparison_8",
    category: "comparison",
    categoryLabel: "模型对比与社区",
    title: "伪造杰作提示词测试",
    author: "@MrLarus",
    prompt: "帮我生成xxxx真迹图片",
    folder: "comparison_case32",
  },
  {
    id: "comparison_9",
    category: "comparison",
    categoryLabel: "模型对比与社区",
    title: "多概念战斗海报组",
    author: "@joshesye",
    prompt: "1、生成不知火舞和貂蝉的游戏对战海报图\n2、生成一张K-pop团体时尚专辑封面\n3、请你生成 《斗破苍穹》 的关键人物关系图\n4、帮我截一张上传图片的抖音首页的女网红图",
    folder: "comparison_case33",
  },
  {
    id: "comparison_10",
    category: "comparison",
    categoryLabel: "模型对比与社区",
    title: "Rust 游戏内截图",
    author: "@FixlationAI",
    prompt: "an ingame screenshot of rust",
    folder: "comparison_case34",
  },

  // ─── 电商案例 ─────────────────────────────────────────────────
  {
    id: "ecommerce_1",
    category: "ecommerce",
    categoryLabel: "电商案例",
    title: "奢华琥珀香水广告",
    author: "@Polanco_IA",
    prompt: "A luxurious cinematic product photograph of a classic rectangular perfume bottle inspired by N°5 CHANEL PARIS PARFUM, placed upright on a glossy black marble surface with white veining. The bottle is centered slightly to the right, made of clear faceted glass with a large transparent crystal stopper, filled with rich amber-gold perfume that glows from within. Tiny condensation droplets cover the glass, adding texture and realism. Dramatic warm lighting from the upper left creates golden highlights, deep reflections on the marble, and a soft luminous bloom in the background. Wisps of elegant smoke curl around the bottle on both sides. Dark background, shallow depth of field, ultra-detailed studio product photography, luxury beauty campaign aesthetic.",
    folder: "poster_case113",
  },
  {
    id: "ecommerce_2",
    category: "ecommerce",
    categoryLabel: "电商案例",
    title: "护肤品专业棚拍",
    author: "@Strength04_X",
    prompt: "A soft cream-colored bottle with a pastel yellow pump stands on a matte podium, surrounded by silky foam and chamomile blossoms. The background is a pale yellow gradient with subtle bubble details. The label emphasizes organic chamomile and calming care. Fresh chamomile flowers accentuate the gentle appeal.",
    folder: "poster_case114",
  },
  {
    id: "ecommerce_3",
    category: "ecommerce",
    categoryLabel: "电商案例",
    title: "热带柑橘苏打广告海报",
    author: "@edimakorfr",
    prompt: "Create a vibrant tropical commercial poster for a citrus soda bottle, in a bright summer advertising style. Show a single large plastic bottle of Soda centered slightly to the right, tilted a little left, with a yellow cap and transparent bottle covered in cold condensation droplets, filled with glowing golden-orange soda. Use a sunny beach background with vivid blue sky, turquoise ocean, soft clouds, and blurred tropical palm leaves. Add dramatic water splashes around the base of the bottle, scattered clear ice cubes, and 5 visible citrus pieces in the foreground. Lighting should be glossy and high-energy with strong sun flare from the upper left.",
    folder: "poster_case115",
  },
  {
    id: "ecommerce_4",
    category: "ecommerce",
    categoryLabel: "电商案例",
    title: "工业设计展示页",
    author: "@ShamsAmin56",
    prompt: "A professional industrial design presentation sheet. The image should be organized into a clean grid system. Top Row: A 3x3 layout showing top-down flat lay views and close-up macro details of materials. Middle Section: Three hero shots of the product standing upright in different color ways (Matte Black, Arctic White, and accented variants). The products should be slightly tilted to show depth and form. Bottom Section: A dynamic \"floating\" composition featuring two products overlapping at opposing angles. Environment: minimalist, neutral studio gray background. 4k resolution, Unreal Engine 5 render style, hyper-realistic, clean aesthetic.",
    folder: "poster_case116",
  },
  {
    id: "ecommerce_5",
    category: "ecommerce",
    categoryLabel: "电商案例",
    title: "奢华毛边乐福鞋生活照",
    author: "@dynamicwangs",
    prompt: "A warm, editorial-style lifestyle product photo shot indoors from a low close-up angle, focused on a woman's lower legs and feet as she tries on 1 pair of black leather backless loafers with tan faux-fur lining. One loafer is worn on the right foot and the left foot is bare, hovering just above the textured cream shag rug. The shoes have smooth black leather uppers, a rounded almond toe, open mule-style heel, plush brown fur spilling out around the opening. The model wears cropped medium-blue denim jeans. Use soft natural window light, shallow depth of field, subtle film grain, realistic skin texture, muted beige and black palette, premium fashion catalog mood.",
    folder: "poster_case117",
  },
  {
    id: "ecommerce_6",
    category: "ecommerce",
    categoryLabel: "电商案例",
    title: "大理石台面奢华香水广告",
    author: "@MiguelMaestroIA",
    prompt: "A luxury e-commerce advertising photo of a premium perfume bottle on a polished gray-and-white marble vanity, shot in a warm cinematic studio style with soft golden lighting, shallow depth of field, and elegant reflections. The composition is square and high-end, with the perfume bottle centered slightly right of frame and promotional text on the left. The bottle is a tall sculpted hourglass-shaped glass flacon with smoky transparent gray glass fading darker at the base, a glossy gold spherical cap. Emphasize premium materials, realistic glass refraction, gold metallic highlights, luxury product photography.",
    folder: "poster_case118",
  },
  {
    id: "ecommerce_7",
    category: "ecommerce",
    categoryLabel: "电商案例",
    title: "微缩工人护肤品广告",
    author: "@Strength04_X",
    prompt: "A hyper-realistic miniature diorama product advertisement featuring an oversized luxury skincare pump bottle labeled \"LUXEVEIL Skin Science – Radiance Nourishing Body Lotion\" in cream/beige with a polished gold pump top, placed on a circular platform. Tiny figurine construction workers dressed in yellow coveralls and white hard hats swarm around the bottle climbing scaffolding, painting the bottle with rollers, operating a tower crane. The overall color palette is warm beige, cream, gold, and mustard yellow. Studio photography style with soft diffused lighting, no shadows, clean beige background. Tilt-shift miniature aesthetic, ultra-detailed, commercial product photography, 8K resolution, photorealistic CGI render.",
    folder: "poster_case151",
  },
  {
    id: "ecommerce_8",
    category: "ecommerce",
    categoryLabel: "电商案例",
    title: "中式传统艺术瓷瓶",
    author: "@songguoxiansen",
    prompt: "A scarf inspired by 'A Thousand Li of Rivers and Mountains', surrounded by Wang Ximeng's blue-green landscape, with a silky texture and soft lighting. A famille rose porcelain vase featuring Lady Yang Guifei enjoying flowers, with peony and butterfly patterns in the style of imperial kilns.",
    folder: "poster_case152",
  },
  {
    id: "ecommerce_9",
    category: "ecommerce",
    categoryLabel: "电商案例",
    title: "高端游戏主板专业棚拍",
    author: "@rojassartorio",
    prompt: "A high-end enthusiast ATX gaming motherboard product photo on a dark studio background, shown in a three-quarter top-down perspective. The board is mostly matte black and gunmetal with sharp geometric armor plates, brushed metal textures, and subtle RGB edge lighting in blue, purple, and magenta. Feature an exposed modern Intel-style CPU socket near the upper center, 4 black DIMM memory slots on the right, large VRM heatsinks across the top. Ultra-detailed commercial product photography, crisp focus across the board, realistic reflections on metal, premium luxury tech aesthetic, dramatic low-key lighting, clean black seamless backdrop.",
    folder: "poster_case153",
  },
  {
    id: "ecommerce_10",
    category: "ecommerce",
    categoryLabel: "电商案例",
    title: "五谷磨房核桃芝麻黑豆粉电商图",
    author: "@WooGabriel76263",
    prompt: "中国电商产品营销图，产品：五谷磨房核桃芝麻黑豆粉，包装：哑光黑色零售盒配金色中文字体。整体风格：高级暗色食品广告布局，色调：黑色、深棕色、暖金色、米色。戏剧性工作室灯光配光泽高光和暖色侧光，氛围：奢华、滋补、健康、令人垂涎。布局包含主图、详情页、冲泡方式和生活场景展示。竖版大约9:16比例，超详细的商业设计效果图，精良的电商主图+详情页，4K品质。",
    folder: "poster_case154",
  },
];

// ── 合并：手写精选 + 自动同步 ────────────────────────────────────────────────
//
// 手写案例（INSPIRATION_CASES_MANUAL）有精心翻译的中文 title，应优先展示。
// 自动同步案例（IMPORTED_CASES）来自 awesome-gpt-image-2-prompts 仓库，数量大但 title 是英文。
//
// 去重策略：用 prompt 前 100 字符做指纹，重复的自动同步条目跳过（手写优先）。

import { IMPORTED_CASES } from "./inspiration-data-imported";
import { INSPIRATION_I18N } from "./inspiration-i18n";

function makeFingerprint(prompt: string): string {
  return prompt.replace(/\s+/g, " ").trim().slice(0, 100);
}

const _manualFingerprints = new Set(
  INSPIRATION_CASES_MANUAL.map((c) => makeFingerprint(c.prompt)),
);

const _filteredImported = IMPORTED_CASES.filter(
  (c) => !_manualFingerprints.has(makeFingerprint(c.prompt)),
);

export const INSPIRATION_CASES: InspirationCase[] = [
  ...INSPIRATION_CASES_MANUAL,
  ..._filteredImported,
];

const CATEGORY_LABELS: Record<string, string> = {
  portrait: "人像与摄影",
  poster: "海报与插画",
  character: "角色设计",
  ui: "UI / 信息版式",
  comparison: "模型对比与社区",
  ecommerce: "电商案例",
  "ad-creative": "广告创意",
};

const GAME_KEYWORDS = /\b(game|gaming|gacha|splash art|key visual|concept art|character sheet|character design|anime|fantasy|sci-fi|mech|boss|monster|hero|villain|rpg|mmorpg|jrpg|visual novel|visual-novel|steam|playstation|xbox|nintendo|gta|minecraft|vtuber|pixel art|isometric|3d render)\b|游戏|角色|立绘|设定|概念图|原画|扭蛋|卡牌|战斗|场景/i;
const UI_KEYWORDS = /\b(ui|ux|landing page|dashboard|screen|interface|layout|wireframe|design system|infographic|breakdown|storyboard|slide|mockup|thumbnail|feed|livestream|screenshot)\b|界面|信息图|版式|图卡|图表|卡片|页面|海报版式|直播|截图/i;
const MARKETING_KEYWORDS = /\b(ad|advertisement|advertising|campaign|poster|promo|promotion|branding|brand|social media|social|merch|flyer|banner|creative|commercial|marketing|launch)\b|广告|宣发|宣传|物料|品牌|运营|海报|活动|社媒|主视觉/i;

export function getCategoryLabel(category: string, fallback?: string): string {
  return CATEGORY_LABELS[category] ?? fallback ?? category;
}

export function getDisplayTitle(item: InspirationCase): string {
  return INSPIRATION_I18N[item.id]?.titleZh ?? item.title;
}

export function getDisplayPrompt(item: InspirationCase): string {
  return INSPIRATION_I18N[item.id]?.promptZh ?? item.prompt;
}

export function hasTranslatedPrompt(item: InspirationCase): boolean {
  return Boolean(INSPIRATION_I18N[item.id]?.promptZh);
}

export function isTemplatePrompt(prompt: string): boolean {
  return /\{argument name=|REFERENCE_\d+|\[BRAND NAME|\[character\]|\[color\]/i.test(prompt);
}

export function getBusinessTags(item: Pick<InspirationCase, "category" | "title" | "prompt">): BusinessFilter[] {
  const tags = new Set<BusinessFilter>();
  const haystack = `${item.title}\n${item.prompt}`;

  if (item.category === "character" || GAME_KEYWORDS.test(haystack)) {
    tags.add("game");
  }
  if (item.category === "ui" || UI_KEYWORDS.test(haystack)) {
    tags.add("ui");
  }
  if (item.category === "ad-creative" || item.category === "poster" || MARKETING_KEYWORDS.test(haystack)) {
    tags.add("marketing");
  }

  return [...tags];
}

export function matchesBusinessFilter(item: Pick<InspirationCase, "category" | "title" | "prompt">, filter: BusinessFilter): boolean {
  if (filter === "all") return true;
  return getBusinessTags(item).includes(filter);
}

export function getEffectiveGameRelevance(item: Pick<InspirationCase, "category" | "title" | "prompt" | "gameRelevance">): GameRelevance {
  if (item.gameRelevance) return item.gameRelevance;
  if (item.category === "comparison" || item.category === "ecommerce") return "irrelevant";
  if (item.category === "portrait") return "low";
  if (item.category === "character") return "high";

  const tags = getBusinessTags(item);
  if (tags.includes("game")) return "high";
  if (tags.includes("ui") || tags.includes("marketing")) return "medium";
  return "low";
}

