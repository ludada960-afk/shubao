import { galleryImg } from '../services/api';
import { Target, Zap, Layers, RotateCcw, MousePointerClick, ShieldCheck } from 'lucide-react';

/* ═══════ Gallery 展示作品 ═══════ */
const _IMG = (id, file) => galleryImg(id, file);

export const GALLERY = [
  { id:'xm', title:'熬夜总结🔥厦门3天2夜精华攻略！人均800+玩到爽！', cat:'旅游攻略', grad:'linear-gradient(135deg,#FF6B35,#F7C59F)', likes:3890, body:'谁懂啊！之前去厦门玩三天两夜，回来被问了800遍攻略！今天熬夜帮各位总结好，人均800左右就能玩得超满足～\n\n✅行程概览\nD1：鼓浪屿全天（日光岩、菽庄花园、龙头路小吃）\nD2：厦门大学+南普陀寺+沙坡尾艺术西区+猫街\nD3：黄厝沙滩日出+曾厝垵+环岛路骑行\n\n💰预算清单（人均）\n交通：约200（高铁+岛内公交）\n住宿：约300（两晚民宿，提前订）\n门票：约80（鼓浪屿船票+日光岩）\n美食：约220（沙茶面、海蛎煎、姜母鸭等）\n总计：约800起，丰俭由人\n\n⚠️实用Tips\n1️⃣ 鼓浪屿船票提前3天在「厦门轮渡」公众号买\n2️⃣ 厦大需预约，周末难约\n3️⃣ 曾厝垵推荐阿杰五香、八婆婆烧仙草\n4️⃣ 环岛路租电动车约30元/小时\n\n家人们赶紧存下来周末就出发！🌊', tags:['#厦门旅游','#厦门攻略','#旅游攻略','#3天2夜','#人均800'], hint:'厦门旅游攻略', cover_url:_IMG('xm','01-封面.png'), image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('xm','0'+n+'.png')) },
  { id:'ep', title:'实测5款百元蓝牙耳机🔥闭眼入不踩雷', cat:'好物评测', grad:'linear-gradient(135deg,#3B82F6,#6366F1)', likes:2290, body:'家人们谁懂啊！想买个百元蓝牙耳机看花眼？我帮你实测了5款热门款，直接抄作业！\n\n🎧 漫步者X2：约100元，音质均衡，续航6小时，入门首选。\n🎧 小米Air2 SE：约120元，低音强劲，触控灵敏。\n🎧 绿联HiTune：约90元，续航7小时，降噪意外好。\n🎧 倍思WM01：约80元，半入耳设计，通话清晰。\n🎧 网易云蓝牙耳机：约110元，外观潮，音质中规中矩。\n\n百元价位首选漫步者X2，预算紧张选倍思WM01！', tags:['#蓝牙耳机推荐','#百元耳机','#数码好物','#学生党必备'], hint:'百元蓝牙耳机推荐', cover_url:_IMG('ep','01-封面.png'), image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('ep','0'+n+'.png')) },
  { id:'crab', title:'人均80吃帝王蟹🦀？这家大排档也太狠了吧！', cat:'美食探店', grad:'linear-gradient(135deg,#F97316,#FBBF24)', likes:4523, body:'以前总觉得海鲜大排档又贵又坑，结果被闺蜜拉去吃了一顿，直接刷新认知😱人均才80左右就能炫到整只帝王蟹！', tags:['#海鲜大排档','#帝王蟹','#人均80','#美食探店','#性价比海鲜'], hint:'帝王蟹探店推荐', cover_url:_IMG('crab','01-封面.png'), image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('crab','0'+n+'.png')) },
  { id:'jk', title:'3套JK制服搭配🔥附价格参考！甜酷风一网打尽', cat:'穿搭分享', grad:'linear-gradient(135deg,#FFB6C1,#FF69B4)', likes:3180, body:'JK制服怎么搭才不显土？整理了3套日常又出圈的搭配！', tags:['#JK穿搭','#水手服','#百褶裙','#学生党穿搭','#甜酷风'], hint:'JK制服穿搭分享', cover_url:_IMG('jk','01-封面.png'), image_urls:[3,4,5,6,7,8,9].map(n=>_IMG('jk','0'+n+'.png')) },
  { id:'skincare', title:'25岁精简护肤🔥3步养出透亮肌！别再叠涂浪费💰', cat:'美妆护肤', grad:'linear-gradient(135deg,#DDA0DD,#FFB6C1)', likes:2670, body:'家人们谁懂啊！25岁皮肤直线下滑...精简到核心三步反而稳定透亮～', tags:['#精简护肤','#25岁护肤','#护肤步骤','#养肤','#干皮护肤','#平价好物'], hint:'25岁精简护肤步骤', cover_url:_IMG('skincare','01-封面.png'), image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('skincare','0'+n+'.png')) },
  { id:'pilates', title:'30天居家普拉提🔥腰围缩了5cm！体态逆袭', cat:'健身减肥', grad:'linear-gradient(135deg,#32CD32,#20B2AA)', likes:3540, body:'以前总觉得普拉提太温和没效果，坚持30天后，体态肉眼可见变好！', tags:['#居家普拉提','#30天蜕变','#瘦身塑形','#健身干货','#体态改善'], hint:'30天居家普拉提计划', cover_url:_IMG('pilates','01-封面.png'), image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('pilates','0'+n+'.png')) },
  { id:'livingroom', title:'500元爆改极简客厅😱朋友都以为花了几万！', cat:'家居家装', grad:'linear-gradient(135deg,#D2B48C,#F5DEB3)', likes:4120, body:'之前客厅又暗又乱，花了500元做了极简改造，邻居进门直呼高级！', tags:['#极简客厅','#小预算改造','#客厅改造','#家居好物','#改造前后'], hint:'500元极简客厅改造', cover_url:_IMG('livingroom','01-封面.png'), image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('livingroom','0'+n+'.png')) },
  { id:'rent', title:'实测300元出租屋改造🆘效果真的绝了', cat:'家居家装', grad:'linear-gradient(135deg,#E6A8D7,#C9A0DC)', likes:2890, body:'出租屋又小又旧，房东不让大改，预算只有300块！', tags:['#出租屋改造','#300元改造','#租房大改造','#家居家装','#租房党'], hint:'300元出租屋改造攻略', cover_url:_IMG('rent','01-封面.png'), image_urls:[2,3,4,5,6,7,8].map(n=>_IMG('rent','0'+n+'.png')) },
  { id:'aitools', title:'实测推荐🔥这5款AI工具让我效率翻倍！', cat:'好物评测', grad:'linear-gradient(135deg,#8B5CF6,#A78BFA)', likes:3360, body:'以前写周报要憋一小时，现在用AI工具10分钟搞定！', tags:['#AI工具','#效率神器','#免费工具','#学生党必备','#打工人必备'], hint:'AI工具推荐合集', cover_url:_IMG('aitools','01-封面.png'), image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('aitools','0'+n+'.png')) },
  { id:'mealprep', title:'打工人带饭一周🔥月省800元💰5分钟搞定', cat:'一人食', grad:'linear-gradient(135deg,#FFA500,#FFD700)', likes:2750, body:'每天点外卖三四十，一个月工资都吃没了！', tags:['#带饭','#上班族带饭','#省钱午餐','#快手菜','#一周食谱','#一人食'], hint:'上班族5天带饭食谱', cover_url:_IMG('mealprep','01-封面.png'), image_urls:[2,3,4,5,6,7,8,9].map(n=>_IMG('mealprep','0'+n+'.png')) },
  { id:'books', title:'改变认知的6本好书🔥读完格局直接炸裂', cat:'书单推荐', grad:'linear-gradient(135deg,#1E3A5F,#3B5998)', likes:4230, body:'以前总觉得读书就是消遣，直到读了这6本书，思维被彻底刷新', tags:['#书单推荐','#改变认知','#好书推荐','#认知升级','#必读书单'], hint:'改变认知的6本好书推荐', cover_url:_IMG('books','01-封面.png'), image_urls:[2,3,4,5,6,7].map(n=>_IMG('books','0'+n+'.png')) },
  { id:'tv2026', title:'格局炸裂🤯2026年必看国产剧清单🔥熬夜也得追完', cat:'影视推荐', grad:'linear-gradient(135deg,#8B0000,#FFD700)', likes:5610, body:'2026年国产剧太能打了！高分神剧扎堆上线！', tags:['#2026年国产剧','#熬夜追剧','#剧荒推荐','#国产剧推荐','#高分电视剧'], hint:'2026必看国产剧推荐', cover_url:_IMG('tv2026','01-封面.png'), image_urls:[2,3,4,5,6,7].map(n=>_IMG('tv2026','0'+n+'.png')) },
  { id:'english', title:'考研英语85分不是梦🔥学姐3个月提分秘诀！', cat:'学习干货', grad:'linear-gradient(135deg,#1E90FF,#87CEEB)', likes:3470, body:'英语基础一般，考研居然考了85分！', tags:['#考研英语','#考研经验','#英语学习方法','#考研85分','#考研上岸'], hint:'考研英语85分方法', cover_url:_IMG('english','01-封面.png'), image_urls:[2,3,4,5,6,7,8].map(n=>_IMG('english','0'+n+'.png')) },
  { id:'selfmedia', title:'裸辞做自媒体🔥3个月收入破万，我做了什么？', cat:'职场干货', grad:'linear-gradient(135deg,#C0392B,#E74C3C)', likes:4890, body:'裸辞前月薪5千，现在自媒体月入1万+，后悔没早点辞职！', tags:['#裸辞','#自媒体','#搞钱','#副业','#职场干货','#月入过万'], hint:'裸辞做自媒体搞钱思路', cover_url:_IMG('selfmedia','01-封面.png'), image_urls:[2,3,4,5,6,7].map(n=>_IMG('selfmedia','0'+n+'.png')) },
];

/* ═══════ 热门主题 ═══════ */
export const QUICK_HINTS = [
  "📍厦门3天2夜旅游攻略", "🎧百元蓝牙耳机测评", "🦀海鲜大排档人均80吃帝王蟹",
  "🎀JK穿搭分享", "🤖最新AI工具推荐合集", "📚考研英语85分方法",
  "🛏️300元出租屋改造攻略", "🧴25岁精简护肤步骤", "🍱上班族5天带饭食谱",
  "🏋️30天居家普拉提计划", "🪴500元极简客厅改造", "🎬2026必看国产剧推荐",
  "💰裸辞做自媒体搞钱思路", "📖改变认知的6本好书推荐",
];

/* ═══════ 定价方案 ═══════ */
export const PRICING_XHS = [
  { name:'入门', price:19, sets:3, regen:5, desc:'偶尔创作的博主', per:'6.3', imgs:'约27张配图' },
  { name:'进阶', price:49, sets:10, regen:8, pop:true, desc:'个人博主首选', per:'4.9', imgs:'约90张配图' },
  { name:'创作者', price:99, sets:25, regen:15, desc:'高频创作者', per:'4.0', imgs:'约225张配图' },
  { name:'工作室', price:199, sets:60, regen:30, desc:'团队批量使用', per:'3.3', imgs:'约540张配图' },
];

export const PRICING_EC = [
  { name:'入门', price:19, sets:5, regen:5, desc:'偶尔出图的卖家', per:'3.8', imgs:'约5~20张商品图' },
  { name:'进阶', price:49, sets:15, regen:8, pop:true, desc:'电商卖家首选', per:'3.3', imgs:'约15~60张商品图' },
  { name:'专业', price:99, sets:40, regen:15, desc:'高频出图', per:'2.5', imgs:'约40~160张商品图' },
  { name:'工作室', price:199, sets:100, regen:30, desc:'批量作业', per:'2.0', imgs:'约100~400张商品图' },
];

/* ═══════ 功能亮点 ═══════ */
export const FEATURES = [
  { icon: Target,           title:'智能识别14大赛道', desc:'自动判断旅游、美食、好物、穿搭等赛道，无需手动选择' },
  { icon: Zap,              title:'爆款公式驱动',     desc:'内置数字结果式、反差痛点式等经过验证的爆款标题和正文公式' },
  { icon: Layers,           title:'9张完整配图',      desc:'1张封面+8张内容页，带拼图排版和文字标注，下载即可发布' },
  { icon: RotateCcw,        title:'单张可重新生成',   desc:'对某张图不满意？单独刷新这一张，不浪费整套额度' },
  { icon: MousePointerClick,title:'一键复制文案',     desc:'标题、正文、标签分别复制或一键全部复制，直接粘贴发布' },
  { icon: ShieldCheck,      title:'按套计费不套路',   desc:'用多少买多少，不自动续费，套餐不过期' },
];

/* ═══════ 小知识 Tips ═══════ */
export const TIPS = [
  "标题带数字的笔记，点击率平均高出47%",
  "发布时间建议：周四/周五晚上8-9点",
  "正文前3行决定80%用户是否继续阅读",
  "每篇笔记建议5-7个精准标签",
  "封面图配色统一度直接影响账号调性",
  "评论区互动率高的笔记更容易被推荐",
  "带价格的种草笔记收藏率高出60%",
  "干货笔记的生命周期比日常分享长3倍",
  "视频笔记平均互动率比图文高23%",
  "首图加文字标签的笔记收藏率高35%",
  "互动数据好的笔记会被推荐到更大流量池",
  "9张配图比单张图片完播率高2倍",
  "笔记发布后1小时内是流量关键期",
  "合适的发布时间能让曝光翻倍",
  "带定位的探店笔记曝光率高出50%",
  "有对比的干货笔记更容易被收藏",
  "用提问式结尾能提升评论区互动率",
];

export const EC_TIPS = [
  "白底主图是电商转化率最高的图片类型",
  "淘宝主图建议 800×800 像素正方形",
  "多角度商品图能提升30%的购买转化率",
  "场景图让消费者想象使用场景，提升购买欲",
  "详情页的卖点标注不宜超过3个核心点",
  "不同平台对主图尺寸有严格规范",
  "商品图背景越干净，产品越突出",
  "光线是商品摄影的灵魂，柔和侧光最保险",
  "同一商品在不同平台的图片风格应保持一致",
  "有参考图的情况下，GPT Image 2 保真度更高",
  "上传3-5张不同角度的实拍图效果最好",
  "详情图适合用微距展示材质和工艺细节",
  "组合图把主图、细节、场景整合在一张图里",
  "促销角标要简洁——「新品」或「热卖」二字足够",
];

/* ═══════ 加载阶段 ═══════ */
export const LOADING_STAGES = [
  { img:'ready',   label:'研读素材', desc:'小薯包正在认真分析你的内容...' },
  { img:'wave',    label:'撰写文案', desc:'灵感爆发！正在打磨爆款文案' },
  { img:'walk',    label:'生成配图', desc:'正在精心绘制第 {n}/9 张图片' },
  { img:'sit',     label:'品质优化', desc:'正在精修图片细节，确保每一张都精致出彩' },
  { img:'jump',    label:'打包完成', desc:'搞定！你的爆款图文来啦' },
];

export const EC_LOADING_STAGES = [
  { img:'ready',   label:'分析商品', desc:'正在分析商品信息，匹配最佳视觉风格...' },
  { img:'photographer', label:'生成图片', desc:'AI 正在根据商品信息和参考图绘制商品图...' },
  { img:'paint',   label:'品质优化', desc:'精修每张图的细节、光影和质感...' },
  { img:'jump',    label:'打包完成', desc:'搞定！你的电商商品图来啦' },
];

/* ═══════ 电商常量 ═══════ */
export const EC_CATS = ['美妆护肤','数码3C','食品饮料','服饰穿搭','家居生活','母婴用品','宠物用品','其他'];
export const EC_STYLES = ['白底主图','场景图','详情图','组合图'];
export const EC_PLATFORMS = ['淘宝','京东','拼多多','小红书电商','抖音电商','亚马逊'];
export const EC_PLATFORM_DESC = {
  淘宝:'淘宝/天猫', 京东:'京东', 拼多多:'拼多多',
  小红书电商:'小红书商城', 抖音电商:'抖音小店', 亚马逊:'Amazon跨境',
};

/* ═══════ 电商平台尺寸映射 ═══════ */
export const EC_PLATFORM_DIMS = {
  '淘宝': { '1:1': [1440,1440], '3:4': [1440,1920] },
  '京东': { '1:1': [1440,1440], '3:4': [1440,1920] },
  '拼多多': { '1:1': [1440,1440], '3:4': [1440,1920] },
  '小红书电商': { '1:1': [1440,1440], '3:4': [1440,1920] },
  '抖音电商': { '1:1': [1440,1440], '3:4': [1440,1920] },
  '亚马逊': { '1:1': [1000,1000], '3:4': [1500,2000] },
};

/* ═══════ 图片类型 → 比例映射 ═══════ */
export const EC_IMG_RATIOS = {
  white_bg:'1:1', main_text:'1:1', main_3x4:'3:4',
  transparent:'1:1', sku:'1:1',
  detail_slice_size:'3:4', detail_slice_scene:'3:4', detail_slice_qc:'3:4',
  detail_slice_compare:'3:4', detail_slice_feature:'3:4', detail_slice_care:'3:4',
};

/* ═══════ 电商核心图片类型（精简后 4 类） ═══════ */
export const EC_MAIN_TYPES = [
  { key:'white_bg',    label:'白底图',     emoji:'⬜', maxCount:5, mandatory:true,  desc:'纯白背景，产品居中，首图规范 800×800' },
  { key:'main_text',   label:'主图 1:1',   emoji:'🖼️', maxCount:5, mandatory:false, desc:'白底1 + 卖点4，1440×1440' },
  { key:'main_3x4',    label:'主图 3:4',   emoji:'📱', maxCount:5, mandatory:false, desc:'多角度/场景，1440×1920' },
  { key:'transparent', label:'PNG透明图',  emoji:'🎯', maxCount:1, mandatory:false, desc:'去底素材 800×800' },
];

/* ═══════ 详情长图切片类型（用户勾选决定切片内容） ═══════ */
export const EC_DETAIL_SLICES = [
  { key:'detail_slice_size',    label:'尺寸标注图', emoji:'📏', desc:'引线标毫米/厘米' },
  { key:'detail_slice_scene',   label:'场景拍摄图', emoji:'🌄', desc:'产品在真实环境' },
  { key:'detail_slice_qc',      label:'质检报告图', emoji:'✅', desc:'合格证/检测信息' },
  { key:'detail_slice_compare', label:'优势对比图', emoji:'↔️', desc:'vs 同款差异' },
  { key:'detail_slice_feature', label:'细节功能图', emoji:'🔍', desc:'功能点 callout' },
  { key:'detail_slice_care',    label:'保养维护图', emoji:'🧴', desc:'保养说明' },
];

/* ═══════ SKU 变体行字段定义 ═══════ */
export const EC_SKU_FIELDS = [
  { key:'color',    label:'颜色',      placeholder:'月岩白',     maxLen:4 },
  { key:'size',     label:'规格/尺码', placeholder:'M / 100ml',  maxLen:10 },
  { key:'capacity', label:'容量/数量', placeholder:'500ml / 3件装', maxLen:10 },
  { key:'dimLabel', label:'标注尺寸',  placeholder:'20×10×5cm',  maxLen:12 },
];
export const EC_PLATFORM_SPECS = {
  '淘宝': {
    name:'淘宝/天猫',
    desc:'通用电商平台，800×800主图占比最大',
    tips:'主图可叠加促销角标（左上/右上），详情页支持长图',
    sizes:{ '白底主图':'800×800 · 1:1', '场景图':'750×1000 · 3:4', '详情图':'750×1000 · 3:4', '组合图':'750×1000 · 3:4' },
    rules:'白底主图背景须纯白(RGB#FFFFFF)，产品占比60-70%，禁止出现文字/Logo/水印/人物',
  },
  '京东': {
    name:'京东',
    desc:'品质电商，偏高端质感，主图1000×1000推荐',
    tips:'京东对商品图清晰度要求较高，不建议加过多角标',
    sizes:{ '白底主图':'800×800 · 1:1', '场景图':'800×800 · 1:1', '详情图':'790×1024 · 3:4', '组合图':'800×800 · 1:1' },
    rules:'白底主图背景纯白，不可出现促销文字，品质感优先',
  },
  '拼多多': {
    name:'拼多多',
    desc:'社交电商，主图促销感强，强调价格优势',
    tips:'主图建议体现价格/优惠信息(通过AI标注)，视觉偏热闹',
    sizes:{ '白底主图':'480×480 · 1:1', '场景图':'750×1000 · 3:4', '详情图':'750×1000 · 3:4', '组合图':'750×1000 · 3:4' },
    rules:'主图可含促销文字信息，色彩鲜明，吸引眼球',
  },
  '小红书电商': {
    name:'小红书商城',
    desc:'种草电商，场景图/生活方式感强，3:4竖版',
    tips:'小红书注重审美与氛围，场景图最受欢迎',
    sizes:{ '白底主图':'800×800 · 1:1', '场景图':'1242×1660 · 3:4', '详情图':'1242×1660 · 3:4', '组合图':'1242×1660 · 3:4' },
    rules:'全部图片建议3:4竖版，与信息流一致，审美调性优先',
  },
  '抖音电商': {
    name:'抖音小店',
    desc:'直播/短视频电商，视觉冲击力强',
    tips:'主图可以更动态/视觉冲击强，适配直播场景',
    sizes:{ '白底主图':'800×800 · 1:1', '场景图':'720×960 · 3:4', '详情图':'720×1280 · 9:16', '组合图':'720×1280 · 9:16' },
    rules:'短视频场景适配，可适当使用动态感构图',
  },
  '亚马逊': {
    name:'Amazon',
    desc:'跨境电商，规则最严格，纯白底+无文字',
    tips:'白底主图须纯白(RGB#FFFFFF)，产品占图85%+，零文字/Logo/水印，场景图2000×2000推荐',
    sizes:{ '白底主图':'1000×1000 · 1:1', '场景图':'2000×2000 · 1:1', '详情图':'2000×2000 · 1:1', '组合图':'2000×2000 · 1:1' },
    rules:'严格禁止白底主图上出现任何文字/促销信息/水印/报价/Logo，产品≥85%画面',
  },
};
