// 4c183cd4 续命 P3 模板社区 - 公开模板目录 + 复制 API
//
// 设计:
//   * 数据源 = PUBLIC_TEMPLATE_CATALOG (server-side mirror of publicTemplates.js, 18 套)
//   * GET /api/templates/public?cat=&sort=&limit=&offset= -> 分页 + 筛选 + 排序
//   * POST /api/templates/:tplId/clone -> 调 projectStore.createProjectIdempotent(
//       kind: 'video', title: '模板 <name> 复制' ), usageStats.incrementDownload
//   * 鉴权: 公开 GET 无需登录, 复制需要 authenticateOwner
//   * usageStats 真持久化 likes/downloads
//
// 不做的事:
//   * 不写 db schema, 不改 projects 字段
//   * 不计费 (clone 是免费行为, 后续生成才计费)
//   * 不触发 AI 供应商调用

import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadUsageStats } from './usageStats.mjs';

export const PUBLIC_TEMPLATE_CATALOG = Object.freeze([
  // 4c183cd4 续命 P-E 100 套 (9 类目 x 11 套, theme 12 套凑 100)
  // 商品主图 (product-main) - 11 套: tpl-001 ~ tpl-011
  { id: 'tpl-001', cat: 'product-main', name: '薯包经典白底', creator: '薯包官方', summary: '商品主图白底标准方案, 适合服饰/3C 通用主图' },
  { id: 'tpl-002', cat: 'product-main', name: '薯包高级暖光', creator: '薯包官方', summary: '主图暖光, 适合美妆/家居/食材等需要温度感的商品' },
  { id: 'tpl-003', cat: 'product-main', name: '冷调极简主图', creator: '薯包官方', summary: '冷色极简, 适合 3C/数码/科技感商品' },
  { id: 'tpl-004', cat: 'product-main', name: '粉彩少女主图', creator: '薯包官方', summary: '粉彩柔和, 适合美妆/护肤/少女系商品' },
  { id: 'tpl-005', cat: 'product-main', name: '高对比黑白主图', creator: '薯包官方', summary: '黑白高对比, 适合奢侈品/手表/高端电器' },
  { id: 'tpl-006', cat: 'product-main', name: '木纹自然主图', creator: '薯包官方', summary: '木纹自然底, 适合家居/文具/手作' },
  { id: 'tpl-007', cat: 'product-main', name: '金属质感主图', creator: '薯包官方', summary: '金属反光质感, 适合数码/首饰/工具' },
  { id: 'tpl-008', cat: 'product-main', name: '柔光丝绸主图', creator: '薯包官方', summary: '柔光丝绸, 适合服饰/丝绸/床品' },
  { id: 'tpl-009', cat: 'product-main', name: '纯色背景快闪主图', creator: '薯包官方', summary: '纯色块快闪, 适合促销/直播/速卖' },
  { id: 'tpl-010', cat: 'product-main', name: '渐变彩底主图', creator: '薯包官方', summary: '渐变彩底, 适合潮玩/年轻消费品' },
  { id: 'tpl-011', cat: 'product-main', name: '微距特写主图', creator: '薯包官方', summary: '微距特写, 适合美食/化妆品细节展示' },
  // 商品场景 (product-scene) - 11 套: tpl-012 ~ tpl-022
  { id: 'tpl-012', cat: 'product-scene', name: '客厅一角', creator: '薯包官方', summary: '客厅一角静物场景, 适合家具/小家电/装饰画' },
  { id: 'tpl-013', cat: 'product-scene', name: '厨房台面', creator: '薯包官方', summary: '厨房台面场景, 适合厨电/餐具/食材' },
  { id: 'tpl-014', cat: 'product-scene', name: '卧室床头', creator: '薯包官方', summary: '卧室床头场景, 适合床品/香薰/小夜灯' },
  { id: 'tpl-015', cat: 'product-scene', name: '浴室镜前', creator: '薯包官方', summary: '浴室镜前场景, 适合洗护/美妆/毛巾' },
  { id: 'tpl-016', cat: 'product-scene', name: '办公桌面', creator: '薯包官方', summary: '办公桌面场景, 适合文具/办公小物' },
  { id: 'tpl-017', cat: 'product-scene', name: '咖啡馆角落', creator: '薯包官方', summary: '咖啡馆角落场景, 适合饮品/零食/生活' },
  { id: 'tpl-018', cat: 'product-scene', name: '户外草地', creator: '薯包官方', summary: '户外草地场景, 适合运动/野餐/防晒' },
  { id: 'tpl-019', cat: 'product-scene', name: '街拍背景', creator: '薯包官方', summary: '街拍背景场景, 适合潮服/包/鞋' },
  { id: 'tpl-020', cat: 'product-scene', name: '货架陈列', creator: '薯包官方', summary: '货架陈列场景, 适合商超/食品/日用' },
  { id: 'tpl-021', cat: 'product-scene', name: '手心捧物', creator: '薯包官方', summary: '手心捧物特写, 适合小物件/首饰' },
  { id: 'tpl-022', cat: 'product-scene', name: '礼物盒开箱', creator: '薯包官方', summary: '礼物盒开箱场景, 适合礼盒/节日商品' },
  // 视频开场 (video-hook) - 11 套: tpl-023 ~ tpl-033
  { id: 'tpl-023', cat: 'video-hook', name: '文字飞入开场', creator: '薯包官方', summary: '3 秒文字飞入, 适合种草带货开场' },
  { id: 'tpl-024', cat: 'video-hook', name: '镜头推近开场', creator: '薯包官方', summary: '0.5 秒推近, 适合美妆/3C 焦点开场' },
  { id: 'tpl-025', cat: 'video-hook', name: '问题提问开场', creator: '薯包官方', summary: '抛出问题, 适合科普/教程开场' },
  { id: 'tpl-026', cat: 'video-hook', name: '倒计时开场', creator: '薯包官方', summary: '3-2-1 倒计时, 适合促销/直播开场' },
  { id: 'tpl-027', cat: 'video-hook', name: '对比悬念开场', creator: '薯包官方', summary: '前后对比悬念, 适合种草/对比测评' },
  { id: 'tpl-028', cat: 'video-hook', name: '手部特写入场', creator: '薯包官方', summary: '手部特写入场, 适合开箱/手作/美妆' },
  { id: 'tpl-029', cat: 'video-hook', name: '黑白闪回开场', creator: '薯包官方', summary: '黑白闪回, 适合剧情/故事化开场' },
  { id: 'tpl-030', cat: 'video-hook', name: '声音前置开场', creator: '薯包官方', summary: '先声后画, 适合 ASMR/听觉冲击' },
  { id: 'tpl-031', cat: 'video-hook', name: '价格惊吓开场', creator: '薯包官方', summary: '价格大字惊吓, 适合折扣/秒杀' },
  { id: 'tpl-032', cat: 'video-hook', name: '客户证言开场', creator: '薯包官方', summary: '客户证言前置, 适合口碑/真实反馈' },
  { id: 'tpl-033', cat: 'video-hook', name: '故事叙述开场', creator: '薯包官方', summary: '故事叙述开场, 适合品牌/剧情内容' },
  // 视频运镜 (video-camera) - 11 套: tpl-034 ~ tpl-044
  { id: 'tpl-034', cat: 'video-camera', name: '360 环绕', creator: '薯包官方', summary: '6 秒 360 度环绕, 适合立体商品展示' },
  { id: 'tpl-035', cat: 'video-camera', name: '推拉变焦', creator: '薯包官方', summary: '推拉变焦 (Dolly Zoom), 适合制造空间感' },
  { id: 'tpl-036', cat: 'video-camera', name: '手持跟拍', creator: '薯包官方', summary: '手持跟拍, 适合街拍/Vlog/真实感' },
  { id: 'tpl-037', cat: 'video-camera', name: '稳定器滑轨', creator: '薯包官方', summary: '稳定器滑轨, 适合商品展示/美妆' },
  { id: 'tpl-038', cat: 'video-camera', name: '无人机俯拍', creator: '薯包官方', summary: '无人机俯拍, 适合户外/大场景' },
  { id: 'tpl-039', cat: 'video-camera', name: '低角仰拍', creator: '薯包官方', summary: '低角仰拍, 适合人物/气场/商品高大化' },
  { id: 'tpl-040', cat: 'video-camera', name: '特写微距', creator: '薯包官方', summary: '特写微距运镜, 适合细节展示' },
  { id: 'tpl-041', cat: 'video-camera', name: '横移平移', creator: '薯包官方', summary: '横移平移, 适合空间展示/家具' },
  { id: 'tpl-042', cat: 'video-camera', name: '升降镜头', creator: '薯包官方', summary: '升降镜头, 适合仪式感/品牌片' },
  { id: 'tpl-043', cat: 'video-camera', name: '旋转切换', creator: '薯包官方', summary: '旋转镜头切换, 适合节奏感/动感' },
  { id: 'tpl-044', cat: 'video-camera', name: '固定机位长镜', creator: '薯包官方', summary: '固定机位长镜, 适合访谈/口播' },
  // 视频结尾 (video-end) - 11 套: tpl-045 ~ tpl-055
  { id: 'tpl-045', cat: 'video-end', name: 'logo 出场', creator: '薯包官方', summary: '结尾 logo 出现, 适合品牌收口' },
  { id: 'tpl-046', cat: 'video-end', name: '价格标签弹出', creator: '薯包官方', summary: '结尾价格标签, 适合促销 / 直播间切片' },
  { id: 'tpl-047', cat: 'video-end', name: '二维码引流结尾', creator: '薯包官方', summary: '二维码 + 行动号召, 适合私域引流' },
  { id: 'tpl-048', cat: 'video-end', name: '订阅引导结尾', creator: '薯包官方', summary: '订阅/关注引导, 适合内容号运营' },
  { id: 'tpl-049', cat: 'video-end', name: '彩蛋花絮结尾', creator: '薯包官方', summary: '彩蛋花絮, 适合剧情/趣味内容' },
  { id: 'tpl-050', cat: 'video-end', name: '评论引导结尾', creator: '薯包官方', summary: '引导评论/留言, 适合互动内容' },
  { id: 'tpl-051', cat: 'video-end', name: '下集预告结尾', creator: '薯包官方', summary: '下集预告, 适合系列内容' },
  { id: 'tpl-052', cat: 'video-end', name: '促销倒计时结尾', creator: '薯包官方', summary: '促销倒计时, 适合限时抢购' },
  { id: 'tpl-053', cat: 'video-end', name: '客户证言结尾', creator: '薯包官方', summary: '客户证言收尾, 适合口碑展示' },
  { id: 'tpl-054', cat: 'video-end', name: '黑屏静默结尾', creator: '薯包官方', summary: '黑屏静默, 适合艺术感/极简' },
  { id: 'tpl-055', cat: 'video-end', name: '片尾鸣谢', creator: '薯包官方', summary: '片尾鸣谢, 适合品牌片/合作内容' },
  // 真人语音 (tts) - 11 套: tpl-056 ~ tpl-066
  { id: 'tpl-056', cat: 'tts', name: '知识口播', creator: '薯包官方', summary: '知识口播 8-12 秒, 适合科普/教程类视频' },
  { id: 'tpl-057', cat: 'tts', name: '种草带货', creator: '薯包官方', summary: '种草带货 10-15 秒, 适合电商短视频' },
  { id: 'tpl-058', cat: 'tts', name: '新闻播报', creator: '薯包官方', summary: '新闻播报腔, 适合资讯/动态' },
  { id: 'tpl-059', cat: 'tts', name: '温柔女声旁白', creator: '薯包官方', summary: '温柔女声旁白, 适合美妆/家居' },
  { id: 'tpl-060', cat: 'tts', name: '磁性男声旁白', creator: '薯包官方', summary: '磁性男声, 适合 3C/数码/汽车' },
  { id: 'tpl-061', cat: 'tts', name: '方言播报', creator: '薯包官方', summary: '方言播报, 适合地域品牌/亲切感' },
  { id: 'tpl-062', cat: 'tts', name: '活泼少女音', creator: '薯包官方', summary: '活泼少女音, 适合潮玩/少女系' },
  { id: 'tpl-063', cat: 'tts', name: '儿童配音', creator: '薯包官方', summary: '儿童配音, 适合母婴/玩具' },
  { id: 'tpl-064', cat: 'tts', name: '英文播报', creator: '薯包官方', summary: '英文播报, 适合跨境出海' },
  { id: 'tpl-065', cat: 'tts', name: '双语混播', creator: '薯包官方', summary: '中英双语混播, 适合跨境内容' },
  { id: 'tpl-066', cat: 'tts', name: '独白故事', creator: '薯包官方', summary: '第一人称独白, 适合品牌故事/剧情' },
  // 字幕动效 (caption) - 11 套: tpl-067 ~ tpl-077
  { id: 'tpl-067', cat: 'caption', name: '弹入弹跳', creator: '薯包官方', summary: '字幕弹入弹跳, 适合俏皮/年轻化内容' },
  { id: 'tpl-068', cat: 'caption', name: '打字机效果', creator: '薯包官方', summary: '字幕打字机效果, 适合知识/教程/故事' },
  { id: 'tpl-069', cat: 'caption', name: '渐显渐隐', creator: '薯包官方', summary: '字幕渐显渐隐, 适合唯美/文艺' },
  { id: 'tpl-070', cat: 'caption', name: '从下飞入', creator: '薯包官方', summary: '字幕从下飞入, 适合信息密集' },
  { id: 'tpl-071', cat: 'caption', name: '卡拉OK 高亮', creator: '薯包官方', summary: '卡拉 OK 逐字高亮, 适合音乐/口型同步' },
  { id: 'tpl-072', cat: 'caption', name: '闪烁高亮', creator: '薯包官方', summary: '关键词闪烁, 适合重点强调' },
  { id: 'tpl-073', cat: 'caption', name: '甩入旋转', creator: '薯包官方', summary: '甩入旋转, 适合动感/促销' },
  { id: 'tpl-074', cat: 'caption', name: '弹幕飘过', creator: '薯包官方', summary: '弹幕飘过效果, 适合互动感内容' },
  { id: 'tpl-075', cat: 'caption', name: '双行对话', creator: '薯包官方', summary: '双行对话字幕, 适合剧情/对话' },
  { id: 'tpl-076', cat: 'caption', name: '竖排古风', creator: '薯包官方', summary: '竖排古风, 适合国风/茶道/汉服' },
  { id: 'tpl-077', cat: 'caption', name: '极简白底黑字', creator: '薯包官方', summary: '极简白底黑字, 适合访谈/纪录片' },
  // 字体排版 (font) - 11 套: tpl-078 ~ tpl-088
  { id: 'tpl-078', cat: 'font', name: '衬线大字', creator: '薯包官方', summary: '衬线大字标题, 适合调性内容/品牌' },
  { id: 'tpl-079', cat: 'font', name: '无衬线科技', creator: '薯包官方', summary: '无衬线科技字, 适合 3C / 工具类' },
  { id: 'tpl-080', cat: 'font', name: '手写体温暖', creator: '薯包官方', summary: '手写体, 适合手作/温暖/文艺' },
  { id: 'tpl-081', cat: 'font', name: '粗黑体标题', creator: '薯包官方', summary: '粗黑体标题, 适合促销/大字冲击' },
  { id: 'tpl-082', cat: 'font', name: '细体优雅', creator: '薯包官方', summary: '细体优雅, 适合美妆/服饰/轻奢' },
  { id: 'tpl-083', cat: 'font', name: '圆润萌体', creator: '薯包官方', summary: '圆润萌体, 适合母婴/儿童/可爱风' },
  { id: 'tpl-084', cat: 'font', name: '等宽科技', creator: '薯包官方', summary: '等宽科技字, 适合代码/数据/参数' },
  { id: 'tpl-085', cat: 'font', name: '繁体竖排', creator: '薯包官方', summary: '繁体竖排, 适合国风/茶道' },
  { id: 'tpl-086', cat: 'font', name: '英文衬线', creator: '薯包官方', summary: '英文衬线, 适合跨境/品牌' },
  { id: 'tpl-087', cat: 'font', name: '霓虹招牌', creator: '薯包官方', summary: '霓虹招牌, 适合夜店/酒吧/潮牌' },
  { id: 'tpl-088', cat: 'font', name: '书法体', creator: '薯包官方', summary: '书法体, 适合国风/传统/礼盒' },
  // 整体风格 (theme) - 12 套: tpl-089 ~ tpl-100 (凑 100 套)
  { id: 'tpl-089', cat: 'theme', name: '清新自然', creator: '薯包官方', summary: '清新自然主题, 适合生活方式/美妆/家居' },
  { id: 'tpl-090', cat: 'theme', name: '高级暗调', creator: '薯包官方', summary: '高级暗调主题, 适合数码/汽车/奢侈品' },
  { id: 'tpl-091', cat: 'theme', name: '国风古韵', creator: '薯包官方', summary: '国风古韵, 适合茶道/汉服/国货' },
  { id: 'tpl-092', cat: 'theme', name: '赛博朋克', creator: '薯包官方', summary: '赛博朋克, 适合游戏/潮玩/科技' },
  { id: 'tpl-093', cat: 'theme', name: '日式简约', creator: '薯包官方', summary: '日式简约, 适合家居/文具/小家电' },
  { id: 'tpl-094', cat: 'theme', name: '北欧冷淡', creator: '薯包官方', summary: '北欧冷淡, 适合家居/服饰/极简' },
  { id: 'tpl-095', cat: 'theme', name: '美式复古', creator: '薯包官方', summary: '美式复古, 适合咖啡/服饰/海报' },
  { id: 'tpl-096', cat: 'theme', name: '法式浪漫', creator: '薯包官方', summary: '法式浪漫, 适合美妆/香氛/甜品' },
  { id: 'tpl-097', cat: 'theme', name: '工业金属', creator: '薯包官方', summary: '工业金属, 适合工具/汽车/机械' },
  { id: 'tpl-098', cat: 'theme', name: '糖果甜系', creator: '薯包官方', summary: '糖果甜系, 适合零食/少女/儿童' },
  { id: 'tpl-099', cat: 'theme', name: '户外探险', creator: '薯包官方', summary: '户外探险, 适合运动/装备/旅行' },
  { id: 'tpl-100', cat: 'theme', name: '极简黑白', creator: '薯包官方', summary: '极简黑白, 适合极简品牌/艺术内容' },
]);

export const PUBLIC_TEMPLATE_CATEGORIES = Object.freeze([
  { key: 'product-main', label: '商品主图' },
  { key: 'product-scene', label: '商品场景' },
  { key: 'video-hook', label: '视频开场' },
  { key: 'video-camera', label: '视频运镜' },
  { key: 'video-end', label: '视频结尾' },
  { key: 'tts', label: '真人语音' },
  { key: 'caption', label: '字幕动效' },
  { key: 'font', label: '字体排版' },
  { key: 'theme', label: '整体风格' },
]);

// 静态 baseLikes / baseDownloads, 与 src/constants/publicTemplates.js 保持一致
// 100 套占位 base 计数: 头部 18 套沿用 4c183cd4 时代真实数据
// 其余 82 套 (tpl-019 ~ tpl-100) 用递减的稳态值, server 启动后真持久化会自动覆盖
export const PUBLIC_TEMPLATE_BASE_USAGE = Object.freeze({
  'tpl-001': { likes: 142, downloads: 89 },
  'tpl-002': { likes: 128, downloads: 76 },
  'tpl-003': { likes: 96, downloads: 64 },
  'tpl-004': { likes: 88, downloads: 52 },
  'tpl-005': { likes: 145, downloads: 102 },
  'tpl-006': { likes: 132, downloads: 95 },
  'tpl-007': { likes: 110, downloads: 78 },
  'tpl-008': { likes: 98, downloads: 67 },
  'tpl-009': { likes: 86, downloads: 54 },
  'tpl-010': { likes: 78, downloads: 48 },
  'tpl-011': { likes: 120, downloads: 88 },
  'tpl-012': { likes: 105, downloads: 72 },
  'tpl-013': { likes: 92, downloads: 65 },
  'tpl-014': { likes: 84, downloads: 56 },
  'tpl-015': { likes: 76, downloads: 50 },
  'tpl-016': { likes: 68, downloads: 44 },
  'tpl-017': { likes: 110, downloads: 80 },
  'tpl-018': { likes: 95, downloads: 68 },
  // 82 套占位 (递减稳态: 从 75/45 起步到 8/3 收尾, 占位 = 等待真实使用率)
  'tpl-019': { likes: 75, downloads: 45 },
  'tpl-020': { likes: 72, downloads: 43 },
  'tpl-021': { likes: 70, downloads: 42 },
  'tpl-022': { likes: 68, downloads: 40 },
  'tpl-023': { likes: 66, downloads: 39 },
  'tpl-024': { likes: 64, downloads: 38 },
  'tpl-025': { likes: 62, downloads: 37 },
  'tpl-026': { likes: 60, downloads: 36 },
  'tpl-027': { likes: 58, downloads: 35 },
  'tpl-028': { likes: 56, downloads: 34 },
  'tpl-029': { likes: 55, downloads: 33 },
  'tpl-030': { likes: 54, downloads: 32 },
  'tpl-031': { likes: 52, downloads: 31 },
  'tpl-032': { likes: 50, downloads: 30 },
  'tpl-033': { likes: 49, downloads: 29 },
  'tpl-034': { likes: 48, downloads: 28 },
  'tpl-035': { likes: 47, downloads: 27 },
  'tpl-036': { likes: 46, downloads: 26 },
  'tpl-037': { likes: 45, downloads: 26 },
  'tpl-038': { likes: 44, downloads: 25 },
  'tpl-039': { likes: 43, downloads: 24 },
  'tpl-040': { likes: 42, downloads: 24 },
  'tpl-041': { likes: 41, downloads: 23 },
  'tpl-042': { likes: 40, downloads: 22 },
  'tpl-043': { likes: 39, downloads: 22 },
  'tpl-044': { likes: 38, downloads: 21 },
  'tpl-045': { likes: 37, downloads: 21 },
  'tpl-046': { likes: 36, downloads: 20 },
  'tpl-047': { likes: 35, downloads: 20 },
  'tpl-048': { likes: 34, downloads: 19 },
  'tpl-049': { likes: 33, downloads: 19 },
  'tpl-050': { likes: 32, downloads: 18 },
  'tpl-051': { likes: 31, downloads: 18 },
  'tpl-052': { likes: 30, downloads: 17 },
  'tpl-053': { likes: 29, downloads: 17 },
  'tpl-054': { likes: 28, downloads: 16 },
  'tpl-055': { likes: 28, downloads: 16 },
  'tpl-056': { likes: 27, downloads: 15 },
  'tpl-057': { likes: 26, downloads: 15 },
  'tpl-058': { likes: 25, downloads: 14 },
  'tpl-059': { likes: 25, downloads: 14 },
  'tpl-060': { likes: 24, downloads: 14 },
  'tpl-061': { likes: 23, downloads: 13 },
  'tpl-062': { likes: 23, downloads: 13 },
  'tpl-063': { likes: 22, downloads: 13 },
  'tpl-064': { likes: 22, downloads: 12 },
  'tpl-065': { likes: 21, downloads: 12 },
  'tpl-066': { likes: 20, downloads: 12 },
  'tpl-067': { likes: 20, downloads: 11 },
  'tpl-068': { likes: 19, downloads: 11 },
  'tpl-069': { likes: 19, downloads: 11 },
  'tpl-070': { likes: 18, downloads: 10 },
  'tpl-071': { likes: 18, downloads: 10 },
  'tpl-072': { likes: 17, downloads: 10 },
  'tpl-073': { likes: 17, downloads: 9 },
  'tpl-074': { likes: 16, downloads: 9 },
  'tpl-075': { likes: 16, downloads: 9 },
  'tpl-076': { likes: 15, downloads: 8 },
  'tpl-077': { likes: 15, downloads: 8 },
  'tpl-078': { likes: 14, downloads: 8 },
  'tpl-079': { likes: 14, downloads: 7 },
  'tpl-080': { likes: 13, downloads: 7 },
  'tpl-081': { likes: 13, downloads: 7 },
  'tpl-082': { likes: 12, downloads: 7 },
  'tpl-083': { likes: 12, downloads: 6 },
  'tpl-084': { likes: 11, downloads: 6 },
  'tpl-085': { likes: 11, downloads: 6 },
  'tpl-086': { likes: 10, downloads: 5 },
  'tpl-087': { likes: 10, downloads: 5 },
  'tpl-088': { likes: 10, downloads: 5 },
  'tpl-089': { likes: 9, downloads: 5 },
  'tpl-090': { likes: 9, downloads: 4 },
  'tpl-091': { likes: 9, downloads: 4 },
  'tpl-092': { likes: 8, downloads: 4 },
  'tpl-093': { likes: 8, downloads: 4 },
  'tpl-094': { likes: 8, downloads: 4 },
  'tpl-095': { likes: 7, downloads: 3 },
  'tpl-096': { likes: 7, downloads: 3 },
  'tpl-097': { likes: 7, downloads: 3 },
  'tpl-098': { likes: 6, downloads: 3 },
  'tpl-099': { likes: 6, downloads: 3 },
  'tpl-100': { likes: 6, downloads: 2 },
});

function baseLikesMap() {
  const out = Object.create(null);
  for (const id of Object.keys(PUBLIC_TEMPLATE_BASE_USAGE)) {
    out[id] = PUBLIC_TEMPLATE_BASE_USAGE[id].likes;
  }
  return out;
}

function baseDownloadsMap() {
  const out = Object.create(null);
  for (const id of Object.keys(PUBLIC_TEMPLATE_BASE_USAGE)) {
    out[id] = PUBLIC_TEMPLATE_BASE_USAGE[id].downloads;
  }
  return out;
}

function findTemplate(tplId) {
  if (!tplId) return null;
  return PUBLIC_TEMPLATE_CATALOG.find(t => t.id === tplId) || null;
}

function decorateUsage(template, stats) {
  if (!template) return template;
  const live = stats.snapshot(template.id);
  return { ...template, likes: live.likes, downloads: live.downloads };
}

export function listPublicTemplates({ stats, cat = 'all', sort = 'popular', limit, offset } = {}) {
  if (!stats) throw new TypeError('usage stats is required');
  let rows = PUBLIC_TEMPLATE_CATALOG.slice();
  if (cat && cat !== 'all') {
    rows = rows.filter(t => t.cat === cat);
  }
  rows = rows.map(t => decorateUsage(t, stats));
  if (sort === 'likes') {
    rows.sort((a, b) => b.likes - a.likes);
  } else if (sort === 'downloads') {
    rows.sort((a, b) => b.downloads - a.downloads);
  } else if (sort === 'newest') {
    // 静态目录没有 createdAt, 退化为按 id 倒序 (id 含数字后缀)
    rows.sort((a, b) => String(b.id).localeCompare(String(a.id)));
  } else {
    // popular = likes + 2*downloads 热度
    rows.sort((a, b) => (b.likes + 2 * b.downloads) - (a.likes + 2 * a.downloads));
  }
  const total = rows.length;
  const off = Math.max(0, Number(offset) || 0);
  // 4c183cd4 续命 P-E 100 套, 上限放宽到 100, 默认 50 (首次返回前 50, 客户端可再翻页)
  const lim = Math.max(1, Math.min(100, Number(limit) || 50));
  const page = rows.slice(off, off + lim);
  return { items: page, total, offset: off, limit: lim, sort, cat };
}

export function getPublicTemplateWithUsage({ stats, tplId }) {
  if (!stats) throw new TypeError('usage stats is required');
  const tpl = findTemplate(tplId);
  if (!tpl) return null;
  return decorateUsage(tpl, stats);
}

export function listPopularTemplates({ stats, limit = 4 } = {}) {
  const { items } = listPublicTemplates({ stats, sort: 'popular', limit });
  return items;
}

export async function clonePublicTemplate({ stats, projectStore, ownerEmail, tplId, idempotencyKey }) {
  if (!stats) throw new TypeError('usage stats is required');
  if (!projectStore || typeof projectStore.createProjectIdempotent !== 'function') {
    throw new TypeError('projectStore.createProjectIdempotent is required');
  }
  if (!ownerEmail) {
    const err = new Error('owner is required');
    err.code = 'AUTH_SESSION_INVALID';
    throw err;
  }
  const tpl = findTemplate(tplId);
  if (!tpl) {
    const err = new Error('template not found');
    err.code = 'TEMPLATE_NOT_FOUND';
    throw err;
  }
  const finalKey = String(idempotencyKey || `tpl-clone-${tplId}-${randomUUID()}`).trim();
  const value = projectStore.createProjectIdempotent({
    ownerEmail,
    idempotencyKey: finalKey,
    kind: 'video',
    title: `模板 ${tpl.name} 复制`,
  });
  // 复制计数 = downloads 真持久化 (仅非 replayed 路径才增加)
  if (!value?.replayed) {
    await stats.incrementDownload(tplId);
  }
  const project = value?.project?.id ? value.project : value;
  const live = stats.snapshot(tplId);
  return {
    projectId: project?.id || null,
    templateId: tplId,
    templateName: tpl.name,
    templateCategory: tpl.cat,
    title: project?.title || `模板 ${tpl.name} 复制`,
    projectKind: project?.kind || 'video',
    downloads: live.downloads,
    likes: live.likes,
    replayed: Boolean(value?.replayed),
  };
}

export function loadDefaultUsageStats({ rootDir } = {}) {
  const filePath = resolve(rootDir || process.cwd(), 'server', 'templates', '.usage-stats.json');
  return loadUsageStats({
    filePath,
    baseLikes: baseLikesMap(),
    baseDownloads: baseDownloadsMap(),
  });
}

export function mountPublicTemplateRoutes(app, { authenticateOwner, projectStore, usageStats, runtime } = {}) {
  if (!app || typeof app.get !== 'function') throw new TypeError('app must be an express app');
  if (!projectStore) throw new TypeError('projectStore is required');
  if (!usageStats) throw new TypeError('usageStats is required');

  app.get('/api/templates/public', (req, res) => {
    try {
      const cat = typeof req.query.cat === 'string' ? req.query.cat.trim() : 'all';
      const sort = typeof req.query.sort === 'string' ? req.query.sort.trim() : 'popular';
      // 4c183cd4 P-E 100 套: 默认 limit = 50 (前端 50/页分页对齐)
      const limit = req.query.limit != null ? Number(req.query.limit) : 50;
      const offset = req.query.offset != null ? Number(req.query.offset) : 0;
      if (cat !== 'all' && !PUBLIC_TEMPLATE_CATEGORIES.find(c => c.key === cat)) {
        return res.status(400).json({ code: 'TEMPLATE_CAT_INVALID', error: '类目参数无效' });
      }
      const data = listPublicTemplates({ stats: usageStats, cat, sort, limit, offset });
      return res.json({
        ok: true,
        items: data.items,
        total: data.total,
        offset: data.offset,
        limit: data.limit,
        sort: data.sort,
        cat: data.cat,
        categories: PUBLIC_TEMPLATE_CATEGORIES,
      });
    } catch (error) {
      return res.status(500).json({ code: 'TEMPLATE_LIST_FAILED', error: error?.message || 'list failed' });
    }
  });

  app.get('/api/templates/public/:tplId', (req, res) => {
    try {
      const tpl = getPublicTemplateWithUsage({ stats: usageStats, tplId: req.params.tplId });
      if (!tpl) return res.status(404).json({ code: 'TEMPLATE_NOT_FOUND', error: '模板不存在' });
      return res.json({ ok: true, template: tpl });
    } catch (error) {
      return res.status(500).json({ code: 'TEMPLATE_GET_FAILED', error: error?.message || 'get failed' });
    }
  });

  app.post('/api/templates/public/:tplId/clone', async (req, res) => {
    try {
      if (typeof authenticateOwner !== 'function') {
        return res.status(500).json({ code: 'AUTH_UNAVAILABLE', error: 'auth not configured' });
      }
      let ownerEmail = '';
      try {
        const out = authenticateOwner(req);
        ownerEmail = typeof out === 'string' ? out : out?.email;
      } catch (authError) {
        if (authError?.code && /^AUTH_SESSION_/i.test(authError.code)) {
          return res.status(401).json({ code: authError.code, error: authError.message || '请先登录后再复制模板' });
        }
        throw authError;
      }
      if (!ownerEmail) {
        return res.status(401).json({ code: 'AUTH_SESSION_INVALID', error: '请先登录后再复制模板' });
      }
      const tplId = req.params.tplId;
      if (!findTemplate(tplId)) {
        return res.status(404).json({ code: 'TEMPLATE_NOT_FOUND', error: '模板不存在' });
      }
      const idempotencyKey = req.headers?.['idempotency-key'] || req.headers?.['Idempotency-Key'] || req.body?.idempotencyKey;
      const result = await clonePublicTemplate({
        stats: usageStats,
        projectStore,
        ownerEmail,
        tplId,
        idempotencyKey,
      });
      if (runtime?.log) runtime.log(`[public-templates] cloned ${tplId} -> project ${result.projectId} (replayed=${result.replayed})`);
      return res.status(result.replayed ? 200 : 201).json({ ok: true, ...result });
    } catch (error) {
      if (error?.code === 'TEMPLATE_NOT_FOUND') {
        return res.status(404).json({ code: 'TEMPLATE_NOT_FOUND', error: '模板不存在' });
      }
      if (error?.code === 'IDEMPOTENCY_CONFLICT') {
        return res.status(409).json({ code: 'IDEMPOTENCY_CONFLICT', error: '请求标识已用于其他项目, 请重新操作' });
      }
      if (error?.code === 'IDEMPOTENCY_KEY_REQUIRED') {
        return res.status(400).json({ code: 'IDEMPOTENCY_KEY_REQUIRED', error: '请求标识缺失, 请重试' });
      }
      return res.status(500).json({ code: 'TEMPLATE_CLONE_FAILED', error: error?.message || 'clone failed' });
    }
  });
}
