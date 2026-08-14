import { productionPromptFor } from './productionCasePrompts.js';

function asset({ id = '', src, label, role, ratio, intent, taskId = '', requestKey = '', prompt = '' }) {
  return Object.freeze({ id, src, label, role, ratio, intent, taskId, requestKey, prompt });
}

function chapter({ id, title, description, layout, assets }) {
  return Object.freeze({
    id,
    title,
    description,
    layout: Object.freeze(layout),
    assets: Object.freeze(assets),
  });
}

const productionAsset = ({ id, label, ratio, taskId, requestKey, intent, prompt = productionPromptFor(id) }) => asset({
  id,
  src: `/images/visual-recipes/cases/${id}.png`,
  label,
  role: 'output',
  ratio,
  intent,
  taskId,
  requestKey,
  prompt,
});

function visualProductionCase({ id, chapters }) {
  const frozenChapters = Object.freeze(chapters.map(item => chapter(item)));
  return Object.freeze({
    id,
    status: 'production',
    chapters: frozenChapters,
    assets: Object.freeze(frozenChapters.flatMap(item => item.assets)),
  });
}

export const PRODUCTION_CASE_CATALOG = Object.freeze([
  Object.freeze({
    id: 'product-suite',
    status: 'curated-showcase',
    assets: Object.freeze([
      asset({ id: 'cobalt-lamp-source', src: '/images/home/product-suite/cobalt-lamp-source.webp', label: '完整商品素材', role: 'source', ratio: '1:1', intent: 'product_suite', prompt: '保留钴蓝玻璃灯罩、暖色灯芯与拉丝金属底座的完整结构和材质。' }),
      asset({ id: 'cobalt-lamp-main', src: '/images/home/product-suite/cobalt-lamp-main.webp', label: '场景主图', role: 'result', ratio: '1:1', intent: 'product_suite', prompt: '为钴蓝玻璃台灯制作高端夜间家居场景主图，完整展示产品，不裁切，不添加文字。' }),
      asset({ id: 'cobalt-lamp-detail', src: '/images/home/product-suite/cobalt-lamp-detail.webp', label: '长页详情视觉', role: 'result', ratio: '9:16', intent: 'product_suite', prompt: '制作完整9:16详情长图，依次展示产品全貌、玻璃灯罩、灯芯光效、金属底座和夜间场景，保持产品一致。' }),
    ]),
  }),
  Object.freeze({
    id: 'tryon-angles',
    status: 'curated-showcase',
    assets: Object.freeze([
      asset({ id: 'editorial-flatlay-angle', src: '/images/home/tryon-showcase/editorial-flatlay-v3.webp', label: '完整穿搭素材', role: 'source', ratio: '3:4', intent: 'anything_tryon', prompt: '完整保留黑色长大衣、针织上衣、米色长裤、皮鞋和包袋。' }),
      asset({ id: 'editorial-multi-angle', src: '/images/home/tryon-showcase/editorial-multi-angle-v3.webp', label: '街拍多视角成片', role: 'result', ratio: '16:9', intent: 'anything_tryon', prompt: '创建虚构成年时尚模特，在欧洲街头完整穿着全部商品，以正面、四分之三、侧面和背面形成四张完整大卡片。' }),
    ]),
  }),
  Object.freeze({
    id: 'tryon-reference',
    status: 'curated-showcase',
    assets: Object.freeze([
      asset({ id: 'editorial-flatlay-reference', src: '/images/home/tryon-showcase/editorial-flatlay-v3.webp', label: '完整商品与穿搭', role: 'source', ratio: '3:4', intent: 'anything_tryon', prompt: '完整保留黑色长大衣、针织上衣、米色长裤、皮鞋和包袋的材质、颜色、数量与搭配关系。' }),
      asset({ id: 'editorial-model-reference', src: '/images/home/tryon-showcase/editorial-model-v3.webp', label: '完整参考模特', role: 'reference', ratio: '3:4', intent: 'anything_tryon', prompt: '参考成年模特的完整全身比例、街头行走姿态、镜头高度和自然城市光线。' }),
      asset({ id: 'editorial-street-result', src: '/images/home/tryon-showcase/editorial-street-result-v3.webp', label: '时尚街拍上身结果', role: 'result', ratio: '3:4', intent: 'anything_tryon', prompt: '创建一位虚构成年时尚模特，完整穿着全部商品，在城市街头以具有张力的行走姿态拍摄，保留从头到脚的完整构图，不添加文字。' }),
    ]),
  }),
  visualProductionCase({
    id: 'free',
    chapters: [
      { id: 'free-continuity', title: '让一句想法长出不同世界', description: '叙事摄影、连续场景与未来概念，题材变化但每张都有完整空间关系。', layout: { type: 'story-map' }, assets: [
        productionAsset({ id: 'free-glass-whale', label: '午夜博物馆', ratio: '4:3', intent: 'free', taskId: 'canvas_b10d8c5cfea6b52ec930492af5de948797bb53cfa70b5a3df6f8f57451403376', requestKey: 'showcase-20260813-free-glass-whale' }),
        productionAsset({ id: 'free-rain-library', label: '雨中移动图书馆', ratio: '4:3', intent: 'free', taskId: 'canvas_8abbe3f8ef68e4efc2dd52552ce45157063bdeb71198407174ac9a63e04b290f', requestKey: 'showcase-20260813-free-rain-library' }),
        productionAsset({ id: 'free-orbit-teahouse', label: '轨道茶馆', ratio: '3:4', intent: 'free', taskId: 'canvas_178961c096ffdb06c6fe94bf2fa14f6f64f1f1dad0ceaa720b21a66020e7263d', requestKey: 'showcase-20260813-free-orbit-teahouse' }),
      ] },
      { id: 'free-breadth', title: '材质、信息与科学想象', description: '从纸艺城市到早餐地图和儿童实验室，展示开放创作不依赖单一模板。', layout: { type: 'editorial-grid' }, assets: [
        productionAsset({ id: 'free-paper-city', label: '纸艺山城', ratio: '1:1', intent: 'free', taskId: 'canvas_2fb8832770088d2da101f7eafc6130bf5a7d6d36e76da097de313a59ddb6d93f', requestKey: 'showcase-20260813-free-paper-city' }),
        productionAsset({ id: 'free-breakfast-map', label: '城市早餐地图', ratio: '4:3', intent: 'free', taskId: 'canvas_ac101f1a50f39b77b1e909bfb0188eb53033aa55c2951a5fda996a2723143809', requestKey: 'showcase-20260813-free-breakfast-map' }),
        productionAsset({ id: 'free-tide-lab', label: '潮汐实验室', ratio: '1:1', intent: 'free', taskId: 'canvas_858ec735e23ed173058f7183dfe16ed69e9c4e3ae8727f8c5215a87140347c37', requestKey: 'showcase-20260813-free-tide-lab' }),
      ] },
    ],
  }),
  visualProductionCase({
    id: 'poster',
    chapters: [
      { id: 'poster-culture', title: '文化内容，也有不同的阅读节奏', description: '音乐、书店和自然展览分别使用夜场、出版物与博物馆视觉语言。', layout: { type: 'print-wall' }, assets: [
        productionAsset({ id: 'poster-jazz-night', label: '天台爵士夜', ratio: '3:4', intent: 'poster', taskId: 'canvas_9b7455a468c7acd6444d963babbf3e7e691869e8c0eedff8279e034593e8f8e1', requestKey: 'showcase-20260813-poster-jazz-night' }),
        productionAsset({ id: 'poster-bookstore', label: '旧书店新生', ratio: '3:4', intent: 'poster', taskId: 'canvas_d4db09b4dacb5c674e8397a73a6bd19b7fbe93e630b367b047e373589ad5a68c', requestKey: 'showcase-20260813-poster-bookstore' }),
        productionAsset({ id: 'poster-tide-exhibition', label: '潮汐标本展', ratio: '4:3', intent: 'poster', taskId: 'canvas_251c241316922efc28c463250f7c2831839d8fee168441e16db684bac681e396', requestKey: 'showcase-20260813-poster-tide-exhibition' }),
      ] },
      { id: 'poster-public', title: '从行动号召到舞台焦点', description: '夜骑、市集和实验戏剧都有准确中文、清晰层级与真实发布用途。', layout: { type: 'print-wall' }, assets: [
        productionAsset({ id: 'poster-night-ride', label: '城市夜骑', ratio: '3:4', intent: 'poster', taskId: 'canvas_461bc871fe3c02a0d33ee034666d82b724f9713e85d72304dbc1a58d91f56e8c', requestKey: 'showcase-20260813-poster-night-ride' }),
        productionAsset({ id: 'poster-farmers-market', label: '周末鲜集', ratio: '1:1', intent: 'poster', taskId: 'canvas_52844c7185e2296dd630b4a6dd86cec8cc01c7f975732482ca083d98ea906ab0', requestKey: 'showcase-20260813-poster-farmers-market' }),
        productionAsset({ id: 'poster-theatre', label: '一把空椅子', ratio: '3:4', intent: 'poster', taskId: 'canvas_366bc82fdf27c76f440a84d5db400bbbe9ac5d5d1a236b279e277513b008113b', requestKey: 'showcase-20260813-poster-theatre' }),
      ] },
    ],
  }),
  visualProductionCase({
    id: 'social-cover',
    chapters: [
      { id: 'social-platform', title: '同一个内容目标，不同平台有不同重心', description: '小红书攻略、公众号头图与 B 站评测分别采用原生比例和标题密度。', layout: { type: 'platform-fan' }, assets: [
        productionAsset({ id: 'social-xhs-market', label: '小红书 · 早市攻略', ratio: '3:4', intent: 'social-cover', taskId: 'canvas_d3b088adf57022db6dba1f7fa226ebf9ed3e2a051773356d9a63a274ac32dd60', requestKey: 'showcase-20260813-social-xhs-market' }),
        productionAsset({ id: 'social-wechat-workflow', label: '公众号 · AI复盘', ratio: '21:9', intent: 'social-cover', taskId: 'canvas_2d7e1bf2bd05cb9e8ef77f7870bbccfab4bfa90b9dc9a4d5cfc1a19e99cfddb5', requestKey: 'showcase-20260813-social-wechat-workflow' }),
        productionAsset({ id: 'social-bilibili-coffee', label: 'B站 · 器具实测', ratio: '16:9', intent: 'social-cover', taskId: 'canvas_f38495c76aaa069c57519e807e99d8ac649da521323e5be2ea50d88e508129d4', requestKey: 'showcase-20260813-social-bilibili-coffee' }),
      ] },
      { id: 'social-formats', title: '教程、改造与决策内容', description: '全屏跟练、前后改造和数码横评分别使用步骤、结果和对比结构。', layout: { type: 'platform-fan' }, assets: [
        productionAsset({ id: 'social-douyin-stretch', label: '抖音 · 拉伸跟练', ratio: '9:16', intent: 'social-cover', taskId: 'canvas_e92f25859c8750ae06337989ebe843d157ec62dcc387fee67739a7fd25700ede', requestKey: 'showcase-20260813-social-douyin-stretch' }),
        productionAsset({ id: 'social-xhs-rental', label: '小红书 · 租房改造', ratio: '3:4', intent: 'social-cover', taskId: 'canvas_1406eb0ab17b7433312fbb9c431713bbeca355b029483cbfa9356e20c18db390', requestKey: 'showcase-20260813-social-xhs-rental' }),
        productionAsset({ id: 'social-bilibili-camera', label: 'B站 · 相机选择', ratio: '16:9', intent: 'social-cover', taskId: 'canvas_60ab45c50ad1bab858c3912af2990c2b40845fc1404aa16a5b2a4356c212f934', requestKey: 'showcase-20260813-social-bilibili-camera' }),
      ] },
    ],
  }),
  visualProductionCase({
    id: 'brand-kv',
    chapters: [
      { id: 'brand-industries', title: '不同产业，先建立自己的识别语言', description: '户外照明、茶饮与智能硬件分别用光、清凉感和信号色形成品牌世界。', layout: { type: 'touchpoint-board' }, assets: [
        productionAsset({ id: 'brand-lumen-camp', label: '户外照明 · LUMEN CAMP', ratio: '16:9', intent: 'brand-kv', taskId: 'canvas_ae3cc5f520b7d2f166a03be00efa3702ee60d0df96dfac5dd13acdc3da1869e5', requestKey: 'showcase-20260813-brand-lumen-camp' }),
        productionAsset({ id: 'brand-suyu-tea', label: '茶饮横幅 · 素屿', ratio: '21:9', intent: 'brand-kv', taskId: 'canvas_9d44807d1d5be0bc2153e7ecac89bd7c8febef4d3d33f791e721cb978d2bddc8', requestKey: 'showcase-20260813-brand-suyu-tea' }),
        productionAsset({ id: 'brand-north-helmet', label: '智能硬件 · NORTH', ratio: '1:1', intent: 'brand-kv', taskId: 'canvas_fb693b6398028450b103a40aab1f7e204fc88c8e2e25cfabfe2a394e6e798526', requestKey: 'showcase-20260813-brand-north-helmet' }),
      ] },
      { id: 'brand-touchpoints', title: '品牌语言可以落在不同触点', description: '旅店导视、家具发布与文具材料档案都保留各自核心识别。', layout: { type: 'touchpoint-board' }, assets: [
        productionAsset({ id: 'brand-slow-hotel', label: '文化旅店 · 缓岛', ratio: '3:4', intent: 'brand-kv', taskId: 'canvas_d392edf469054d85d758416aa0906b694d0399e82a5a7c67e5b1c8dfef5795ac', requestKey: 'showcase-20260813-brand-slow-hotel' }),
        productionAsset({ id: 'brand-fold-furniture', label: '模块家具 · FOLD', ratio: '16:9', intent: 'brand-kv', taskId: 'canvas_c06a33cefc5f362ce2a14b8becf88aa7cce4a6139f74de13ed14665c534019e3', requestKey: 'showcase-20260813-brand-fold-furniture' }),
        productionAsset({ id: 'brand-seed-paper', label: '环保文具 · SEED PAPER', ratio: '1:1', intent: 'brand-kv', taskId: 'canvas_412aeeffa11c280aed5203988d16433e7dd377d238c1d237867806c62d729509', requestKey: 'showcase-20260813-brand-seed-paper' }),
      ] },
    ],
  }),
]);

export function productionCaseById(id) {
  const item = PRODUCTION_CASE_CATALOG.find(entry => entry.id === id);
  if (!item) throw new Error(`Unknown production case: ${id}`);
  return item;
}
