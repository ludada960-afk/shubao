const caseItem = ({ id, skillId, title, topic, platform = '', ratio, prompt, chapter }) => Object.freeze({
  id,
  skillId,
  title,
  topic,
  platform,
  ratio,
  resolution: '2K',
  imageModel: 'image2',
  chapter,
  requestKey: `showcase-20260813-${id}`,
  prompt,
});

export const PRODUCTION_VISUAL_CASES = Object.freeze([
  caseItem({
    id: 'product-earbuds-source', skillId: 'free', chapter: 'ecommerce-source', ratio: '1:1',
    title: '珍珠白降噪耳机商品母图', topic: '电商商品素材',
    prompt: '生成一张可直接作为电商套图输入的高清方形商品母图：一副原创、无品牌的珍珠白真无线降噪耳机与圆角充电盒，香槟金色金属细节，充电盒打开，两只耳机完整可见并保持合理结构。纯净暖白摄影棚背景，柔和侧逆光，真实塑料、金属和半透明声学网材质，产品居中、完整、不裁切，不出现人物、箭头、文字、标志、水印或其他商品。',
  }),
  caseItem({
    id: 'free-glass-whale', skillId: 'free', chapter: 'continuity', ratio: '4:3',
    title: '午夜博物馆', topic: '叙事场景',
    prompt: '创作一幅完整的横向电影感场景：闭馆后的自然博物馆大厅，一头透明玻璃鲸悬浮在展厅上空，体内流动着微弱星光；一名穿黄色雨衣的孩子站在中央仰望。深蓝夜色、湿润地面反光、真实空间尺度、明确前中后景，画面有故事但不出现任何文字、标志或水印。',
  }),
  caseItem({
    id: 'free-rain-library', skillId: 'free', chapter: 'continuity', ratio: '4:3',
    title: '雨中移动图书馆', topic: '连续叙事',
    prompt: '创作横向叙事插画：暴雨中的旧城区，一辆透明移动图书馆巴士停在暖黄色路灯下，车内书架和读者清晰可见，街边积水倒映出橙色灯光，一位撑红伞的老人正准备上车。构图有清楚的视线引导和空间层次，细节丰富但克制，不出现任何文字、标志或水印。',
  }),
  caseItem({
    id: 'free-paper-city', skillId: 'free', chapter: 'breadth', ratio: '1:1',
    title: '纸艺山城', topic: '材质构图',
    prompt: '方形编辑视觉：用手工剪纸与压纹纸构成一座层叠山城，索道穿过错落建筑，晨雾由半透明硫酸纸表现，红、青、米白三色形成清晰节奏。保留真实纸张纤维、折痕和投影，像高级文化杂志插页，不出现文字、标志或水印。',
  }),
  caseItem({
    id: 'free-breakfast-map', skillId: 'free', chapter: 'breadth', ratio: '4:3',
    title: '城市早餐地图', topic: '信息场景',
    prompt: '横向俯拍视觉，把六种中国城市早餐布置成一张可探索的桌面地图：肠粉、豆花、胡辣汤、锅贴、米粉和烧饼各自占据独立区域，用餐具和食材形成路径与地理节奏。自然晨光、真实食物质感、清楚分区、丰富但不拥挤，不出现文字、标志或水印。',
  }),
  caseItem({
    id: 'free-orbit-teahouse', skillId: 'free', chapter: 'breadth', ratio: '3:4',
    title: '轨道茶馆', topic: '世界观概念',
    prompt: '竖版概念场景：近未来轨道空间站里的中式茶馆，圆形舷窗外是地球弧面，木质茶桌、蒸汽、黄铜结构与洁白舱体自然融合，两位旅客安静饮茶。光线真实、材料可信、构图可继续扩展，不出现文字、标志或水印。',
  }),
  caseItem({
    id: 'free-tide-lab', skillId: 'free', chapter: 'breadth', ratio: '1:1',
    title: '潮汐实验室', topic: '科学想象',
    prompt: '方形视觉：海边废弃灯塔被改造成儿童潮汐实验室，透明水槽、贝壳标本、微型潮汐装置和海水反射共同构成明亮空间，三个孩子正在观察发光浮游生物。兼具真实摄影与温和想象力，画面完整，不出现文字、标志或水印。',
  }),

  caseItem({
    id: 'poster-jazz-night', skillId: 'poster', chapter: 'culture', ratio: '3:4',
    title: '社区爵士夜', topic: '音乐活动',
    prompt: '设计一张可直接理解用途的中文竖版活动海报。主题是社区屋顶爵士夜，主标题必须清晰准确写“天台爵士夜”，副标题写“把晚风留给即兴”，行动信息写“周六 19:30 · 城南天台”。以深夜蓝、暖黄与少量珊瑚红构成现代编辑网格，萨克斯剪影与城市天际线形成视觉焦点。中文必须可读，层级清楚，不添加其他品牌、票价或虚构信息。',
  }),
  caseItem({
    id: 'poster-bookstore', skillId: 'poster', chapter: 'culture', ratio: '3:4',
    title: '旧书店新生', topic: '空间开幕',
    prompt: '设计中文竖版开幕海报，主标题准确写“旧书店新生”，副标题写“翻开城市的下一页”，行动信息写“8月24日 · 梧桐路见”。视觉以书页、铅字和门店光影建立精致的出版物气质，墨黑、纸白、醒目绿色三色，清晰阅读顺序，可用于实体门店发布。文字必须准确可读，不出现其他品牌和水印。',
  }),
  caseItem({
    id: 'poster-tide-exhibition', skillId: 'poster', chapter: 'culture', ratio: '4:3',
    title: '潮汐标本展', topic: '展览传播',
    prompt: '横版中文展览海报，主标题准确写“潮汐标本”，副标题写“海岸线上的时间档案”，行动信息写“城市自然博物馆 · 9.01—10.20”。用海洋标本、潮线刻度和留白构成理性又诗意的博物馆视觉，青绿、黑、银灰为主。标题、日期和地点必须清晰可读，不添加票价、赞助方或水印。',
  }),
  caseItem({
    id: 'poster-night-ride', skillId: 'poster', chapter: 'public', ratio: '3:4',
    title: '城市夜骑', topic: '公共活动',
    prompt: '中文竖版城市骑行活动海报，主标题准确写“今晚去夜骑”，副标题写“沿江十二公里轻松线”，行动信息写“周五 20:00 · 北岸集合”。用反光路标、车灯轨迹和简洁路线图形组织画面，荧光绿、深灰和白色，高对比、强行动感、移动端也可读。不出现其他品牌、费用或水印。',
  }),
  caseItem({
    id: 'poster-farmers-market', skillId: 'poster', chapter: 'public', ratio: '1:1',
    title: '周末鲜集', topic: '市集招募',
    prompt: '方形中文市集海报，主标题准确写“周末鲜集”，副标题写“和本地农人见一面”，行动信息写“周日 10:00—16:00 · 河畔广场”。以真实蔬果、手写价格牌的形态但不出现具体价格，结合清爽网格和高饱和红绿对比。文字准确清晰，适合社群转发，不出现品牌与水印。',
  }),
  caseItem({
    id: 'poster-theatre', skillId: 'poster', chapter: 'public', ratio: '3:4',
    title: '一把空椅子', topic: '实验戏剧',
    prompt: '中文竖版实验戏剧海报。主标题必须准确写“一把空椅子”，副标题写“当缺席成为主角”，行动信息写“黑匣子剧场 · 9月7日 20:00”。黑色舞台、单束白光和一把红椅形成极简强焦点，字体层级像成熟剧场海报。所有中文与日期必须清晰可读，不添加演员、票价、品牌或水印。',
  }),

  caseItem({
    id: 'social-xhs-market', skillId: 'social-cover', chapter: 'platform', platform: '小红书', ratio: '3:4',
    title: '广州早市攻略', topic: '城市攻略',
    prompt: '为小红书设计3:4竖版封面，主题是广州清晨菜市场路线。大标题准确写“广州早市 4站吃透”，小标签写“本地人路线”。真实早市摊档、蒸汽早餐与年轻旅行者构成强焦点，红绿撞色，标题在手机缩略图中依然清晰。不要出现价格、店名、平台Logo或水印。',
  }),
  caseItem({
    id: 'social-wechat-workflow', skillId: 'social-cover', chapter: 'platform', platform: '公众号', ratio: '21:9',
    title: 'AI工作流复盘', topic: '职场方法',
    prompt: '设计公众号21:9超宽头图，主题是团队AI工作流复盘。主标题准确写“AI工作流，先减法再自动化”，副标题写“一个小团队的30天复盘”。用流程节点、便签和真实办公桌局部构成冷静专业的编辑视觉，标题左侧安全区清晰，右侧有信息流动感。不出现平台Logo、公司名或水印。',
  }),
  caseItem({
    id: 'social-bilibili-coffee', skillId: 'social-cover', chapter: 'platform', platform: 'B站', ratio: '16:9',
    title: '百元咖啡器具实测', topic: '产品评测',
    prompt: '设计B站16:9视频封面，主题是入门咖啡器具横评。大标题准确写“百元器具 真能打吗？”，角标写“6款实测”。三种不同器具与表情鲜明的年轻评测者形成对比，亮黄、黑、白高对比，缩略图中主体和文字一眼可读。不出现真实品牌Logo、价格数字之外的信息或水印。',
  }),
  caseItem({
    id: 'social-douyin-stretch', skillId: 'social-cover', chapter: 'platform', platform: '抖音', ratio: '9:16',
    title: '肩颈拉伸跟练', topic: '运动教程',
    prompt: '设计抖音9:16全屏竖版封面，主题是办公室肩颈拉伸。大标题准确写“坐久了 先拉这3处”，小标题写“10分钟跟练”。真实人物做清晰拉伸动作，三处动作以简洁编号提示但不堆信息，蓝绿与白色清爽对比，上下安全区适配短视频。不出现平台Logo、医疗功效承诺或水印。',
  }),
  caseItem({
    id: 'social-xhs-rental', skillId: 'social-cover', chapter: 'formats', platform: '小红书', ratio: '3:4',
    title: '出租屋低成本改造', topic: '家居改造',
    prompt: '小红书3:4竖版家居封面，大标题准确写“出租屋 3步变顺眼”，小标签写“不动硬装”。展示同一房间改造后的温暖阅读角，以前后差异的小窗与主结果形成层级，奶白、木色、钴蓝点缀，真实可执行、不奢华。文字缩略图可读，不出现价格、品牌Logo或水印。',
  }),
  caseItem({
    id: 'social-bilibili-camera', skillId: 'social-cover', chapter: 'formats', platform: 'B站', ratio: '16:9',
    title: '旅行相机选择', topic: '数码决策',
    prompt: 'B站16:9数码视频封面，主标题准确写“旅行相机 怎么选？”，副标题写“画质·重量·续航”。三台无品牌相机以重量级对决的构图排列，背景结合雪山旅行照片和参数图形，橙色与深青色对比，主体和标题在小尺寸仍清楚。不出现品牌Logo、具体虚构参数或水印。',
  }),

  caseItem({
    id: 'brand-lumen-camp', skillId: 'brand-kv', chapter: 'industries', ratio: '16:9',
    title: 'LUMEN CAMP 户外灯', topic: '户外照明',
    prompt: '为虚构户外照明品牌 LUMEN CAMP 创作16:9品牌主视觉。核心产品是一盏结构简洁的便携营灯，放在雨后森林营地，暖光照亮湿润苔藓与半透明帐篷。品牌识别色为暖黄与松针绿，材质、光线和空间形成可延展系统；只允许出现小而准确的英文品牌名“LUMEN CAMP”，不出现其他文字或水印。',
  }),
  caseItem({
    id: 'brand-suyu-tea', skillId: 'brand-kv', chapter: 'industries', ratio: '21:9',
    title: '素屿冷泡茶', topic: '新茶饮',
    prompt: '为虚构茶饮品牌“素屿”创作21:9超宽零售横幅主视觉。透明冷泡茶瓶、山雾、青梅与冰块构成清凉但克制的东方场景，品牌色为雾青与酸梅绿，留出清晰文案安全区。瓶身只出现准确中文“素屿”，不出现功效、价格、促销、其他品牌或水印。',
  }),
  caseItem({
    id: 'brand-north-helmet', skillId: 'brand-kv', chapter: 'industries', ratio: '1:1',
    title: 'NORTH 智能骑行头盔', topic: '智能硬件',
    prompt: '为虚构智能骑行品牌 NORTH 创作方形品牌主视觉。哑光银灰头盔在夜间城市高架下成为绝对焦点，环形安全灯形成红色轨迹，碳纤维、金属和雾气的质感真实。用银灰、信号红和深黑建立科技识别，只允许出现准确英文“NORTH”，不出现参数、功效承诺或水印。',
  }),
  caseItem({
    id: 'brand-slow-hotel', skillId: 'brand-kv', chapter: 'touchpoints', ratio: '3:4',
    title: '缓岛旅店', topic: '文化酒店',
    prompt: '为虚构文化旅店“缓岛”创作3:4竖版品牌主视觉。海边旧建筑的拱窗、手工陶器、亚麻床品和午后海光形成安静的人文场景，黛蓝、陶土红和暖白构成稳定品牌色。画面适合门店导视和房卡延展，只允许出现小而准确的中文“缓岛”，不出现价格或水印。',
  }),
  caseItem({
    id: 'brand-fold-furniture', skillId: 'brand-kv', chapter: 'touchpoints', ratio: '16:9',
    title: 'FOLD 模块家具', topic: '家居设计',
    prompt: '为虚构模块家具品牌 FOLD 创作16:9发布会主视觉。可拆装的钴蓝模块沙发在浅灰建筑空间中展开，连接结构与几何阴影成为图形语言，少量荧光绿标记强化识别。主视觉需能延展到网页横幅和现场屏幕，只允许出现准确英文“FOLD”，不出现参数、价格或水印。',
  }),
  caseItem({
    id: 'brand-seed-paper', skillId: 'brand-kv', chapter: 'touchpoints', ratio: '1:1',
    title: 'SEED PAPER 环保文具', topic: '可持续文具',
    prompt: '为虚构文具品牌 SEED PAPER 创作方形社媒主视觉。再生纸笔记本、植物纤维铅笔和种子纸标签摆成清晰的材料档案，苔绿、纸浆灰与朱红印记形成现代识别。强调真实纤维和循环设计感，只允许出现准确英文“SEED PAPER”，不出现环保认证、夸张承诺或水印。',
  }),
]);

export function productionVisualCaseById(id) {
  const item = PRODUCTION_VISUAL_CASES.find(candidate => candidate.id === id);
  if (!item) throw new Error(`Unknown production visual case: ${id}`);
  return item;
}
