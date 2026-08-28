// 4c183cd4 续命 P3 模板社区 (d429b368 18 套私有模板的公共化)
// 主线程亲自做基础数据 + UI, 不靠子代理 (5 次派子代理都失败)

export const PUBLIC_TEMPLATE_CATEGORIES = Object.freeze([
  { key: "product-main", label: "商品主图", count: 2 },
  { key: "product-scene", label: "商品场景", count: 2 },
  { key: "video-hook", label: "视频开场", count: 2 },
  { key: "video-camera", label: "视频运镜", count: 2 },
  { key: "video-end", label: "视频结尾", count: 2 },
  { key: "tts", label: "真人语音", count: 2 },
  { key: "caption", label: "字幕动效", count: 2 },
  { key: "font", label: "字体排版", count: 2 },
  { key: "theme", label: "整体风格", count: 2 },
]);

export const PUBLIC_TEMPLATES = Object.freeze([
  { id: "tpl-001", cat: "product-main", name: "薯包经典白底", thumb: "/images/templates/white-bg.png", likes: 142, downloads: 89, creator: "薯包官方", visibility: "public" },
  { id: "tpl-002", cat: "product-main", name: "薯包高级暖光", thumb: "/images/templates/warm-light.png", likes: 128, downloads: 76, creator: "薯包官方", visibility: "public" },
  { id: "tpl-003", cat: "product-scene", name: "客厅一角", thumb: "/images/templates/living-room.png", likes: 96, downloads: 64, creator: "薯包官方", visibility: "public" },
  { id: "tpl-004", cat: "product-scene", name: "厨房台面", thumb: "/images/templates/kitchen.png", likes: 88, downloads: 52, creator: "薯包官方", visibility: "public" },
  { id: "tpl-005", cat: "video-hook", name: "文字飞入开场", thumb: "/images/templates/text-flyin.png", likes: 145, downloads: 102, creator: "薯包官方", visibility: "public" },
  { id: "tpl-006", cat: "video-hook", name: "镜头推近开场", thumb: "/images/templates/camera-push.png", likes: 132, downloads: 95, creator: "薯包官方", visibility: "public" },
  { id: "tpl-007", cat: "video-camera", name: "360 环绕", thumb: "/images/templates/orbit-360.png", likes: 110, downloads: 78, creator: "薯包官方", visibility: "public" },
  { id: "tpl-008", cat: "video-camera", name: "推拉变焦", thumb: "/images/templates/dolly-zoom.png", likes: 98, downloads: 67, creator: "薯包官方", visibility: "public" },
  { id: "tpl-009", cat: "video-end", name: "logo 出场", thumb: "/images/templates/logo-end.png", likes: 86, downloads: 54, creator: "薯包官方", visibility: "public" },
  { id: "tpl-010", cat: "video-end", name: "价格标签弹出", thumb: "/images/templates/price-tag.png", likes: 78, downloads: 48, creator: "薯包官方", visibility: "public" },
  { id: "tpl-011", cat: "tts", name: "知识口播", thumb: "/images/templates/voice-knowledge.png", likes: 120, downloads: 88, creator: "薯包官方", visibility: "public" },
  { id: "tpl-012", cat: "tts", name: "种草带货", thumb: "/images/templates/voice-selling.png", likes: 105, downloads: 72, creator: "薯包官方", visibility: "public" },
  { id: "tpl-013", cat: "caption", name: "弹入弹跳", thumb: "/images/templates/cap-bounce.png", likes: 92, downloads: 65, creator: "薯包官方", visibility: "public" },
  { id: "tpl-014", cat: "caption", name: "打字机效果", thumb: "/images/templates/cap-typewriter.png", likes: 84, downloads: 56, creator: "薯包官方", visibility: "public" },
  { id: "tpl-015", cat: "font", name: "衬线大字", thumb: "/images/templates/font-serif.png", likes: 76, downloads: 50, creator: "薯包官方", visibility: "public" },
  { id: "tpl-016", cat: "font", name: "无衬线科技", thumb: "/images/templates/font-tech.png", likes: 68, downloads: 44, creator: "薯包官方", visibility: "public" },
  { id: "tpl-017", cat: "theme", name: "清新自然", thumb: "/images/templates/theme-fresh.png", likes: 110, downloads: 80, creator: "薯包官方", visibility: "public" },
  { id: "tpl-018", cat: "theme", name: "高级暗调", thumb: "/images/templates/theme-dark.png", likes: 95, downloads: 68, creator: "薯包官方", visibility: "public" },
]);

export function templatesByCategory(cat) {
  return PUBLIC_TEMPLATES.filter(t => t.cat === cat);
}

export function getPublicTemplate(tplId) {
  return PUBLIC_TEMPLATES.find(t => t.id === tplId) || null;
}

export function popularTemplates(limit) {
  const n = limit || 6;
  return [].concat(PUBLIC_TEMPLATES).sort(function (a, b) { return b.likes - a.likes; }).slice(0, n);
}