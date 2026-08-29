// 4c183cd4 续命 P3 模板社区 (d429b368 18 套私有模板的公共化)
// 4c183cd4 续命 P-E 100 套 (9 类目 x 11 套, theme 12 套凑 100)
//
// 设计:
//   * 100 套 = 9 类目 x 11 套 (theme 12 套凑 100)
//   * 头部 18 套 (tpl-001 ~ tpl-018) 沿用 4c183cd4 时代手写 thumb (与 server 端 PUBLIC_TEMPLATE_CATALOG 同步)
//   * 后续 82 套 (tpl-019 ~ tpl-100) 由 svgThumb() 工厂生成, 与 server 端 cat / name 同步
//   * id 顺序与 server 端一致: 1-11=product-main, 12-22=product-scene, ..., 89-100=theme
//   * 真使用率 (likes/downloads) 会被 server/templates/usageStats.mjs 真持久化覆盖, 本文件保留 base 静态值.

const CAT_PALETTE = Object.freeze({
  "product-main":  { start: "#fff7e6", end: "#ffd591", ink: "#5a3a16" },
  "product-scene": { start: "#f0f7ff", end: "#a3c4f3", ink: "#1d3a6e" },
  "video-hook":    { start: "#fff1f0", end: "#ffa39e", ink: "#5c1011" },
  "video-camera":  { start: "#f9f0ff", end: "#d3adf7", ink: "#39124b" },
  "video-end":     { start: "#e6fffb", end: "#87e8de", ink: "#134e4a" },
  "tts":           { start: "#fff0f6", end: "#ffadd2", ink: "#5b1130" },
  "caption":       { start: "#fffbe6", end: "#ffe58f", ink: "#5c3e00" },
  "font":          { start: "#f0f0f0", end: "#bfbfbf", ink: "#1f1f1f" },
  "theme":         { start: "#10131a", end: "#3a4150", ink: "#f7f8fb" },
});

const CAT_LABEL = Object.freeze({
  "product-main": "商品主图",
  "product-scene": "商品场景",
  "video-hook": "视频开场",
  "video-camera": "视频运镜",
  "video-end": "视频结尾",
  "tts": "真人语音",
  "caption": "字幕动效",
  "font": "字体排版",
  "theme": "整体风格",
});

function svgThumb({ id, cat, name }) {
  const palette = CAT_PALETTE[cat] || CAT_PALETTE["product-main"];
  const label = CAT_LABEL[cat] || cat;
  const n = Number(String(id).split("-")[1]) || 0;
  const offset = n - 1;
  const cx = 48 + ((offset * 31) % 240);
  const cy = 56 + ((offset * 47) % 130);
  const rectX = 30 + ((offset * 23) % 220);
  const rectW = 60 + ((offset * 17) % 90);
  const rectH = 14 + ((offset * 11) % 22);
  const rectY = 100 + ((offset * 29) % 80);
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 200' preserveAspectRatio='xMidYMid slice'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='${palette.start}'/><stop offset='100%' stop-color='${palette.end}'/></linearGradient></defs><rect width='320' height='200' fill='url(%23g)'/><circle cx='${cx}' cy='${cy}' r='24' fill='${palette.ink}' fill-opacity='0.16'/><rect x='${rectX}' y='${rectY}' width='${rectW}' height='${rectH}' fill='${palette.ink}' fill-opacity='0.22'/><text x='20' y='34' font-family='PingFang SC, Microsoft YaHei, sans-serif' font-size='12' fill='${palette.ink}' fill-opacity='0.72' font-weight='600'>${label}</text><text x='20' y='178' font-family='PingFang SC, Microsoft YaHei, sans-serif' font-size='18' fill='${palette.ink}' font-weight='700'>${name}</text><text x='290' y='190' font-family='monospace' font-size='10' fill='${palette.ink}' fill-opacity='0.55' text-anchor='end'>${id}</text></svg>`;
}

const TPL_100_META = Object.freeze([
  { id: "tpl-001", cat: "product-main", name: "薯包经典白底" },
  { id: "tpl-002", cat: "product-main", name: "薯包高级暖光" },
  { id: "tpl-003", cat: "product-main", name: "冷调极简主图" },
  { id: "tpl-004", cat: "product-main", name: "粉彩少女主图" },
  { id: "tpl-005", cat: "product-main", name: "高对比黑白主图" },
  { id: "tpl-006", cat: "product-main", name: "木纹自然主图" },
  { id: "tpl-007", cat: "product-main", name: "金属质感主图" },
  { id: "tpl-008", cat: "product-main", name: "柔光丝绸主图" },
  { id: "tpl-009", cat: "product-main", name: "纯色背景快闪主图" },
  { id: "tpl-010", cat: "product-main", name: "渐变彩底主图" },
  { id: "tpl-011", cat: "product-main", name: "微距特写主图" },
  { id: "tpl-012", cat: "product-scene", name: "客厅一角" },
  { id: "tpl-013", cat: "product-scene", name: "厨房台面" },
  { id: "tpl-014", cat: "product-scene", name: "卧室床头" },
  { id: "tpl-015", cat: "product-scene", name: "浴室镜前" },
  { id: "tpl-016", cat: "product-scene", name: "办公桌面" },
  { id: "tpl-017", cat: "product-scene", name: "咖啡馆角落" },
  { id: "tpl-018", cat: "product-scene", name: "户外草地" },
  { id: "tpl-019", cat: "product-scene", name: "街拍背景" },
  { id: "tpl-020", cat: "product-scene", name: "货架陈列" },
  { id: "tpl-021", cat: "product-scene", name: "手心捧物" },
  { id: "tpl-022", cat: "product-scene", name: "礼物盒开箱" },
  { id: "tpl-023", cat: "video-hook", name: "文字飞入开场" },
  { id: "tpl-024", cat: "video-hook", name: "镜头推近开场" },
  { id: "tpl-025", cat: "video-hook", name: "问题提问开场" },
  { id: "tpl-026", cat: "video-hook", name: "倒计时开场" },
  { id: "tpl-027", cat: "video-hook", name: "对比悬念开场" },
  { id: "tpl-028", cat: "video-hook", name: "手部特写入场" },
  { id: "tpl-029", cat: "video-hook", name: "黑白闪回开场" },
  { id: "tpl-030", cat: "video-hook", name: "声音前置开场" },
  { id: "tpl-031", cat: "video-hook", name: "价格惊吓开场" },
  { id: "tpl-032", cat: "video-hook", name: "客户证言开场" },
  { id: "tpl-033", cat: "video-hook", name: "故事叙述开场" },
  { id: "tpl-034", cat: "video-camera", name: "360 环绕" },
  { id: "tpl-035", cat: "video-camera", name: "推拉变焦" },
  { id: "tpl-036", cat: "video-camera", name: "手持跟拍" },
  { id: "tpl-037", cat: "video-camera", name: "稳定器滑轨" },
  { id: "tpl-038", cat: "video-camera", name: "无人机俯拍" },
  { id: "tpl-039", cat: "video-camera", name: "低角仰拍" },
  { id: "tpl-040", cat: "video-camera", name: "特写微距" },
  { id: "tpl-041", cat: "video-camera", name: "横移平移" },
  { id: "tpl-042", cat: "video-camera", name: "升降镜头" },
  { id: "tpl-043", cat: "video-camera", name: "旋转切换" },
  { id: "tpl-044", cat: "video-camera", name: "固定机位长镜" },
  { id: "tpl-045", cat: "video-end", name: "logo 出场" },
  { id: "tpl-046", cat: "video-end", name: "价格标签弹出" },
  { id: "tpl-047", cat: "video-end", name: "二维码引流结尾" },
  { id: "tpl-048", cat: "video-end", name: "订阅引导结尾" },
  { id: "tpl-049", cat: "video-end", name: "彩蛋花絮结尾" },
  { id: "tpl-050", cat: "video-end", name: "评论引导结尾" },
  { id: "tpl-051", cat: "video-end", name: "下集预告结尾" },
  { id: "tpl-052", cat: "video-end", name: "促销倒计时结尾" },
  { id: "tpl-053", cat: "video-end", name: "客户证言结尾" },
  { id: "tpl-054", cat: "video-end", name: "黑屏静默结尾" },
  { id: "tpl-055", cat: "video-end", name: "片尾鸣谢" },
  { id: "tpl-056", cat: "tts", name: "知识口播" },
  { id: "tpl-057", cat: "tts", name: "种草带货" },
  { id: "tpl-058", cat: "tts", name: "新闻播报" },
  { id: "tpl-059", cat: "tts", name: "温柔女声旁白" },
  { id: "tpl-060", cat: "tts", name: "磁性男声旁白" },
  { id: "tpl-061", cat: "tts", name: "方言播报" },
  { id: "tpl-062", cat: "tts", name: "活泼少女音" },
  { id: "tpl-063", cat: "tts", name: "儿童配音" },
  { id: "tpl-064", cat: "tts", name: "英文播报" },
  { id: "tpl-065", cat: "tts", name: "双语混播" },
  { id: "tpl-066", cat: "tts", name: "独白故事" },
  { id: "tpl-067", cat: "caption", name: "弹入弹跳" },
  { id: "tpl-068", cat: "caption", name: "打字机效果" },
  { id: "tpl-069", cat: "caption", name: "渐显渐隐" },
  { id: "tpl-070", cat: "caption", name: "从下飞入" },
  { id: "tpl-071", cat: "caption", name: "卡拉OK 高亮" },
  { id: "tpl-072", cat: "caption", name: "闪烁高亮" },
  { id: "tpl-073", cat: "caption", name: "甩入旋转" },
  { id: "tpl-074", cat: "caption", name: "弹幕飘过" },
  { id: "tpl-075", cat: "caption", name: "双行对话" },
  { id: "tpl-076", cat: "caption", name: "竖排古风" },
  { id: "tpl-077", cat: "caption", name: "极简白底黑字" },
  { id: "tpl-078", cat: "font", name: "衬线大字" },
  { id: "tpl-079", cat: "font", name: "无衬线科技" },
  { id: "tpl-080", cat: "font", name: "手写体温暖" },
  { id: "tpl-081", cat: "font", name: "粗黑体标题" },
  { id: "tpl-082", cat: "font", name: "细体优雅" },
  { id: "tpl-083", cat: "font", name: "圆润萌体" },
  { id: "tpl-084", cat: "font", name: "等宽科技" },
  { id: "tpl-085", cat: "font", name: "繁体竖排" },
  { id: "tpl-086", cat: "font", name: "英文衬线" },
  { id: "tpl-087", cat: "font", name: "霓虹招牌" },
  { id: "tpl-088", cat: "font", name: "书法体" },
  { id: "tpl-089", cat: "theme", name: "清新自然" },
  { id: "tpl-090", cat: "theme", name: "高级暗调" },
  { id: "tpl-091", cat: "theme", name: "国风古韵" },
  { id: "tpl-092", cat: "theme", name: "赛博朋克" },
  { id: "tpl-093", cat: "theme", name: "日式简约" },
  { id: "tpl-094", cat: "theme", name: "北欧冷淡" },
  { id: "tpl-095", cat: "theme", name: "美式复古" },
  { id: "tpl-096", cat: "theme", name: "法式浪漫" },
  { id: "tpl-097", cat: "theme", name: "工业金属" },
  { id: "tpl-098", cat: "theme", name: "糖果甜系" },
  { id: "tpl-099", cat: "theme", name: "户外探险" },
  { id: "tpl-100", cat: "theme", name: "极简黑白" },
]);

const HEAD_BASE_LIKES = {
  "tpl-001": 142, "tpl-002": 128, "tpl-003": 96, "tpl-004": 88, "tpl-005": 145,
  "tpl-006": 132, "tpl-007": 110, "tpl-008": 98, "tpl-009": 86, "tpl-010": 78,
  "tpl-011": 120, "tpl-012": 105, "tpl-013": 92, "tpl-014": 84, "tpl-015": 76,
  "tpl-016": 68, "tpl-017": 110, "tpl-018": 95,
};
const HEAD_BASE_DOWNLOADS = {
  "tpl-001": 89, "tpl-002": 76, "tpl-003": 64, "tpl-004": 52, "tpl-005": 102,
  "tpl-006": 95, "tpl-007": 78, "tpl-008": 67, "tpl-009": 54, "tpl-010": 48,
  "tpl-011": 88, "tpl-012": 72, "tpl-013": 65, "tpl-014": 56, "tpl-015": 50,
  "tpl-016": 44, "tpl-017": 80, "tpl-018": 68,
};

function baseLikesFor(id) {
  if (HEAD_BASE_LIKES[id] != null) return HEAD_BASE_LIKES[id];
  const n = Number(String(id).split("-")[1]) || 0;
  return Math.max(6, Math.round(75 - (n - 19) * 0.74));
}
function baseDownloadsFor(id) {
  if (HEAD_BASE_DOWNLOADS[id] != null) return HEAD_BASE_DOWNLOADS[id];
  const n = Number(String(id).split("-")[1]) || 0;
  return Math.max(2, Math.round(45 - (n - 19) * 0.47));
}

export const PUBLIC_TEMPLATE_CATEGORIES = Object.freeze([
  { key: "product-main", label: "商品主图", count: 11 },
  { key: "product-scene", label: "商品场景", count: 11 },
  { key: "video-hook", label: "视频开场", count: 11 },
  { key: "video-camera", label: "视频运镜", count: 11 },
  { key: "video-end", label: "视频结尾", count: 11 },
  { key: "tts", label: "真人语音", count: 11 },
  { key: "caption", label: "字幕动效", count: 11 },
  { key: "font", label: "字体排版", count: 11 },
  { key: "theme", label: "整体风格", count: 12 },
]);

export const PUBLIC_TEMPLATES = Object.freeze(
  TPL_100_META.map(m => ({
    id: m.id,
    cat: m.cat,
    name: m.name,
    thumb: svgThumb({ id: m.id, cat: m.cat, name: m.name }),
    likes: baseLikesFor(m.id),
    downloads: baseDownloadsFor(m.id),
    creator: "薯包官方",
    visibility: "public",
  }))
);

export const PUBLIC_TEMPLATE_DETAILS = Object.freeze({
  "tpl-001": { tagline: "标准白底主图, 任何商品都安全", idealFor: ["服饰", "3C", "日用"], durationSec: null, modelHint: "商品主图 → gpt-image-2 白底" },
  "tpl-002": { tagline: "暖光主图, 营造商品温度感", idealFor: ["美妆", "家居", "食材"], durationSec: null, modelHint: "商品主图 → gpt-image-2 暖光" },
  "tpl-005": { tagline: "3 秒文字飞入, 种草带货开场", idealFor: ["种草", "带货", "通用"], durationSec: 3, modelHint: "Seedance 文字飞入模板" },
  "tpl-006": { tagline: "0.5 秒推近, 焦点开场", idealFor: ["美妆", "3C", "焦点"], durationSec: 4, modelHint: "Seedance 推近模板" },
  "tpl-007": { tagline: "6 秒 360 度环绕, 立体商品", idealFor: ["3C", "美妆", "立体商品"], durationSec: 6, modelHint: "Seedance 360 环绕" },
  "tpl-008": { tagline: "推拉变焦, 制造空间感", idealFor: ["服饰", "家居", "电影感"], durationSec: 4, modelHint: "Seedance 推拉变焦" },
  "tpl-009": { tagline: "结尾 logo 出现, 品牌收口", idealFor: ["品牌", "广告片", "宣传片"], durationSec: 2, modelHint: "通用视频末尾 logo" },
  "tpl-010": { tagline: "结尾价格标签, 促销/直播间", idealFor: ["促销", "直播", "优惠"], durationSec: 2, modelHint: "通用视频末尾价格标签" },
  "tpl-011": { tagline: "8-12 秒知识口播", idealFor: ["科普", "教程", "知识"], durationSec: 10, modelHint: "MiniMax H3 知识口播" },
  "tpl-012": { tagline: "10-15 秒种草带货", idealFor: ["电商", "带货", "促销"], durationSec: 12, modelHint: "MiniMax H3 种草带货" },
  "tpl-013": { tagline: "弹入弹跳字幕, 俏皮年轻化", idealFor: ["短视频", "年轻人", "节奏感"], durationSec: null, modelHint: "通用字幕弹入" },
  "tpl-014": { tagline: "打字机字幕, 知识/故事", idealFor: ["知识", "故事", "剧情"], durationSec: null, modelHint: "通用打字机字幕" },
  "tpl-015": { tagline: "衬线大字标题, 调性内容", idealFor: ["品牌", "调性", "广告"], durationSec: null, modelHint: "通用衬线字体" },
  "tpl-016": { tagline: "无衬线科技字, 3C/工具", idealFor: ["3C", "工具", "教程"], durationSec: null, modelHint: "通用科技字体" },
  "tpl-017": { tagline: "清新自然主题, 生活方式", idealFor: ["生活方式", "美妆", "家居"], durationSec: null, modelHint: "整体清新自然主题" },
  "tpl-018": { tagline: "高级暗调, 数码/汽车/奢侈品", idealFor: ["数码", "汽车", "奢侈品"], durationSec: null, modelHint: "整体暗调主题" },
});

export function templatesByCategory(cat) {
  return PUBLIC_TEMPLATES.filter(t => t.cat === cat);
}

export function getPublicTemplate(tplId) {
  return PUBLIC_TEMPLATES.find(t => t.id === tplId) || null;
}

export function getPublicTemplateDetail(tplId) {
  return PUBLIC_TEMPLATE_DETAILS[tplId] || null;
}

export function popularTemplates(limit) {
  const n = limit || 6;
  return [].concat(PUBLIC_TEMPLATES).sort(function (a, b) { return b.likes - a.likes; }).slice(0, n);
}
