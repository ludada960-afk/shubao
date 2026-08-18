import { productionPromptFor } from './productionCasePrompts.js';
import { validateProductionCaseManifest } from './productionCaseManifest.js';
import {
  EARBUD_COMPOSITE_PROMPT_V3,
  EARBUD_COMPOSITE_REQUEST_KEY_V3,
  EARBUD_DETAIL_PROMPTS,
  EARBUD_SUITE_REPLAY_PROMPT,
  EARBUD_USAGE_PROMPT_V3,
  EARBUD_USAGE_REQUEST_KEY_V4,
} from './productionCasePromptLibrary.js';

function asset({ id = '', src, label, role, ratio, intent, taskId = '', requestKey = '', prompt = '', provenance = 'production', ...metadata }) {
  return Object.freeze({ id, src, label, role, ratio, intent, taskId, requestKey, prompt, provenance, ...metadata });
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

const productionAsset = ({ id, label, ratio, taskId, requestKey, intent, prompt = productionPromptFor(id), ...metadata }) => asset({
  id,
  src: `/images/visual-recipes/cases/${id}.png`,
  label,
  role: 'output',
  ratio,
  intent,
  taskId,
  requestKey,
  prompt,
  ...metadata,
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

const PRODUCT_SUITE_ASSETS = Object.freeze([
  asset({ id: 'earbuds-product-source', src: '/images/home/ecommerce-showcase/earbuds-product-source.png', label: '完整商品母图', role: 'source', ratio: '1:1', intent: 'product_suite', taskId: 'ecommerce_showcase_earbuds_20260814', requestKey: 'showcase-20260814-earbuds-suite', prompt: '为珍珠白与香槟金真无线降噪耳机生成完整商品母图，保持耳机与充电盒结构、颜色、材质和比例，不添加品牌或文字。' }),
  asset({ id: 'earbuds-suite-panel-structure', src: '/images/home/ecommerce-showcase/earbuds-suite-panel-structure.png', label: '声学结构解析', role: 'result', ratio: '3:4', intent: 'product_suite', taskId: 'showcase-20260815-earbuds-detail-suite-v2', requestKey: 'showcase-20260815-earbuds-detail-suite-v2', displayRole: 'selectorPreview', selectorKind: 'structure', isWhiteBackground: false, prompt: EARBUD_DETAIL_PROMPTS['earbuds-suite-panel-structure'] }),
  asset({ id: 'earbuds-suite-panel-usage', src: '/images/home/ecommerce-showcase/earbuds-suite-panel-model-usage.png', label: '自然佩戴场景', role: 'result', ratio: '3:4', intent: 'product_suite', taskId: 'canvas_65d1792df11385e019c60ef2a69239732fc4ca109195aedcc530d404fc601adf', requestKey: EARBUD_USAGE_REQUEST_KEY_V4, displayRole: 'selectorPreview', selectorKind: 'usage', isWhiteBackground: false, prompt: EARBUD_USAGE_PROMPT_V3 }),
  asset({ id: 'earbuds-suite-panel-scene', src: '/images/home/ecommerce-showcase/earbuds-suite-panel-scene.png', label: '清晰通话场景', role: 'result', ratio: '3:4', intent: 'product_suite', taskId: 'showcase-20260815-earbuds-detail-suite-v2', requestKey: 'showcase-20260815-earbuds-detail-suite-v2', displayRole: 'selectorPreview', selectorKind: 'scene', isWhiteBackground: false, prompt: EARBUD_DETAIL_PROMPTS['earbuds-suite-panel-scene'] }),
  asset({ id: 'earbuds-suite-panel-identity', src: '/images/home/ecommerce-showcase/earbuds-suite-panel-identity.png', label: '商品身份主视觉', role: 'result', ratio: '3:4', intent: 'product_suite', taskId: 'showcase-20260815-earbuds-detail-suite-v2', requestKey: 'showcase-20260815-earbuds-detail-suite-v2', displayRole: 'detailSource', isWhiteBackground: false, prompt: EARBUD_DETAIL_PROMPTS['earbuds-suite-panel-identity'] }),
  asset({ id: 'earbuds-suite-panel-function', src: '/images/home/ecommerce-showcase/earbuds-suite-panel-function.png', label: '续航与佩戴详情', role: 'result', ratio: '3:4', intent: 'product_suite', taskId: 'showcase-20260815-earbuds-detail-suite-v2', requestKey: 'showcase-20260815-earbuds-detail-suite-v2', displayRole: 'detailSource', isWhiteBackground: false, prompt: EARBUD_DETAIL_PROMPTS['earbuds-suite-panel-function'] }),
  asset({ id: 'earbuds-suite-composite', src: '/images/home/ecommerce-showcase/earbuds-suite-composite-v3.png', label: '完整电商套图成片', role: 'result', ratio: '4:3', intent: 'product_suite', taskId: 'canvas_9ddb1e933e598050fe014e69aa969d52b32a230623a586e6546a7ffcb02a5197', requestKey: EARBUD_COMPOSITE_REQUEST_KEY_V3, displayRole: 'finalComposite', isWhiteBackground: false, prompt: EARBUD_COMPOSITE_PROMPT_V3 }),
]);

export const PRODUCT_SUITE_MANIFEST = validateProductionCaseManifest({
  id: 'product-suite',
  title: '珍珠白降噪耳机商品套图',
  category: 'ecommerce',
  prompt: EARBUD_SUITE_REPLAY_PROMPT,
  sourceAssets: PRODUCT_SUITE_ASSETS
    .filter(item => item.role === 'source')
    .map(item => ({ id: item.id, role: 'product', url: item.src, name: item.label })),
  outputs: PRODUCT_SUITE_ASSETS
    .filter(item => item.role === 'result')
    .map(item => ({
      id: item.id,
      role: item.displayRole || 'detail',
      title: item.label,
      prompt: item.prompt,
      url: item.src,
      taskId: item.taskId,
      requestKey: item.requestKey,
      quoteId: item.quoteId || '',
      ratio: item.ratio,
      selectorKind: item.selectorKind,
      displayRole: item.displayRole,
      provenance: item.provenance,
    })),
  cover: {
    strategy: 'mosaic',
    outputIds: PRODUCT_SUITE_ASSETS
      .filter(item => ['selectorPreview', 'detailSource'].includes(item.displayRole))
      .map(item => item.id),
  },
  remix: {
    mode: 'product_suite',
    prompt: EARBUD_SUITE_REPLAY_PROMPT,
    sourceAssetRoles: ['product'],
  },
});

export const PRODUCTION_CASE_CATALOG = Object.freeze([
  Object.freeze({
    id: 'product-suite',
    status: 'production',
    assets: PRODUCT_SUITE_ASSETS,
    manifest: PRODUCT_SUITE_MANIFEST,
  }),
  Object.freeze({
    id: 'tryon-angles',
    status: 'production',
    assets: Object.freeze([
      asset({ id: 'tryon-product-flatlay', src: '/images/home/tryon-showcase/product-flatlay.png', label: '完整服饰套装', role: 'source', ratio: '3:8', intent: 'anything_tryon', taskId: 'ec_production_tryon_complete_20260814_v1', requestKey: 'production-tryon-complete-result', prompt: '完整保留炭灰长大衣、橄榄绿针织、米色长裤、帽子、包袋和鞋履的材质、颜色、数量与搭配关系。' }),
      asset({ id: 'tryon-angle-front', src: '/images/home/tryon-showcase/angle-front.png', label: '街拍正面', role: 'result', ratio: '9:16', intent: 'anything_tryon', taskId: 'ec_production_tryon_complete_20260814_v1', requestKey: 'production-tryon-complete-result', prompt: '同一套完整穿搭的正面街拍，保留全身比例与商品细节。' }),
      asset({ id: 'tryon-angle-motion', src: '/images/home/tryon-showcase/angle-motion.png', label: '动态行走', role: 'result', ratio: '9:16', intent: 'anything_tryon', taskId: 'ec_production_tryon_complete_20260814_v1', requestKey: 'production-tryon-complete-result', prompt: '同一套完整穿搭的动态行走姿态，具有时尚感且不裁切。' }),
      asset({ id: 'tryon-angle-side', src: '/images/home/tryon-showcase/angle-side.png', label: '侧面版型', role: 'result', ratio: '9:16', intent: 'anything_tryon', taskId: 'ec_production_tryon_complete_20260814_v1', requestKey: 'production-tryon-complete-result', prompt: '同一套完整穿搭的侧面版型视图，展示衣摆、裤型与配饰关系。' }),
      asset({ id: 'tryon-angle-back', src: '/images/home/tryon-showcase/angle-back.png', label: '背面细节', role: 'result', ratio: '9:16', intent: 'anything_tryon', taskId: 'ec_production_tryon_complete_20260814_v1', requestKey: 'production-tryon-complete-result', prompt: '同一套完整穿搭的背面视图，保持人物与场景连续。' }),
      asset({ id: 'tryon-angles-selector', src: '/images/home/tryon-showcase/editorial-multi-angle-fan-v7.webp?v=fan-only-v7', label: '四张模特卡片预览', role: 'result', ratio: '16:9', intent: 'anything_tryon', taskId: 'ec_production_tryon_complete_20260814_v1', requestKey: 'production-tryon-complete-result', provenance: 'production-composite', displayRole: 'selectorPreview', prompt: '四张同套穿搭模特的正面、侧面、动态与背面全身卡片，保持完整比例，不裁切、不叠加其他素材。' }),
      asset({ id: 'tryon-angles-workflow', src: '/images/home/tryon-showcase/editorial-multi-angle-workflow-v7.png?v=workflow-v11', label: '服饰素材到四角度上身成片', role: 'result', ratio: '16:9', intent: 'anything_tryon', taskId: 'ec_production_tryon_complete_20260814_v1', requestKey: 'production-tryon-complete-result', provenance: 'production-composite', displayRole: 'workflowBanner', prompt: '左侧展示与模特身上完全同套的服饰素材，中间使用一条完整连续的弯曲箭头，右侧展示四张同套穿搭的模特全身卡片，三者形成清晰的服饰素材到上身结果关系，所有内容完整且不裁切。' }),
    ]),
  }),
  Object.freeze({
    id: 'tryon-reference',
    status: 'production',
    assets: Object.freeze([
      asset({ id: 'tryon-reference-product', src: '/images/home/tryon-showcase/product-flatlay.png', label: '完整商品与穿搭', role: 'source', ratio: '3:8', intent: 'anything_tryon', taskId: 'ec_c0e0e32f-686c-4184-bdd5-27a17d0bbceb', requestKey: 'production-tryon-reference-result', prompt: '完整保留服饰套装的材质、颜色、数量与搭配关系。' }),
      asset({ id: 'tryon-reference-person', src: '/images/home/tryon-showcase/reference-person.png', label: '完整参考模特', role: 'reference', ratio: '1:4', intent: 'anything_tryon', taskId: 'ec_c0e0e32f-686c-4184-bdd5-27a17d0bbceb', requestKey: 'production-tryon-reference-result', prompt: '参考成年模特的完整全身比例、姿态与镜头高度。' }),
      asset({ id: 'tryon-reference-result', src: '/images/home/tryon-showcase/angle-motion.png', label: '时尚街拍上身结果', role: 'result', ratio: '9:16', intent: 'anything_tryon', taskId: 'ec_c0e0e32f-686c-4184-bdd5-27a17d0bbceb', requestKey: 'production-tryon-reference-result', prompt: '将完整服饰套装自然穿到参考模特身上，保持人物与商品关系清晰。' }),
      asset({ id: 'tryon-reference-workflow', src: '/images/home/tryon-showcase/tryon-reference-workflow.png', label: '商品与参考模特精准上身', role: 'result', ratio: '16:9', intent: 'anything_tryon', taskId: 'ec_c0e0e32f-686c-4184-bdd5-27a17d0bbceb', requestKey: 'production-tryon-reference-result', provenance: 'production-composite', displayRole: 'workflowBanner', prompt: '完整展示商品、参考模特与正式生产上身结果的关系。' }),
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
        productionAsset({ id: 'social-xhs-market', label: '小红书 · 早市攻略', ratio: '3:4', intent: 'social-cover', platform: 'xiaohongshu', taskId: 'canvas_d3b088adf57022db6dba1f7fa226ebf9ed3e2a051773356d9a63a274ac32dd60', requestKey: 'showcase-20260813-social-xhs-market' }),
        productionAsset({ id: 'social-wechat-workflow', label: '公众号 · AI复盘', ratio: '21:9', intent: 'social-cover', platform: 'wechat', taskId: 'canvas_2d7e1bf2bd05cb9e8ef77f7870bbccfab4bfa90b9dc9a4d5cfc1a19e99cfddb5', requestKey: 'showcase-20260813-social-wechat-workflow' }),
        productionAsset({ id: 'social-bilibili-coffee', label: 'B站 · 器具实测', ratio: '16:9', intent: 'social-cover', platform: 'bilibili', taskId: 'canvas_f38495c76aaa069c57519e807e99d8ac649da521323e5be2ea50d88e508129d4', requestKey: 'showcase-20260813-social-bilibili-coffee' }),
      ] },
      { id: 'social-formats', title: '教程、改造与决策内容', description: '全屏跟练、前后改造和数码横评分别使用步骤、结果和对比结构。', layout: { type: 'platform-fan' }, assets: [
        productionAsset({ id: 'social-xhs-rental', label: '小红书 · 租房改造', ratio: '3:4', intent: 'social-cover', platform: 'xiaohongshu', taskId: 'canvas_1406eb0ab17b7433312fbb9c431713bbeca355b029483cbfa9356e20c18db390', requestKey: 'showcase-20260813-social-xhs-rental' }),
        productionAsset({ id: 'social-bilibili-camera', label: 'B站 · 相机选择', ratio: '16:9', intent: 'social-cover', platform: 'bilibili', taskId: 'canvas_60ab45c50ad1bab858c3912af2990c2b40845fc1404aa16a5b2a4356c212f934', requestKey: 'showcase-20260813-social-bilibili-camera' }),
        productionAsset({ id: 'social-douyin-stretch', src: '/images/home/social-showcase/social-douyin-stretch-card.png', label: '抖音 · 拉伸跟练', ratio: '3:4', intent: 'social-cover', platform: 'douyin', provenance: 'production-composite', taskId: 'canvas_e92f25859c8750ae06337989ebe843d157ec62dcc387fee67739a7fd25700ede', requestKey: 'showcase-20260813-social-douyin-stretch' }),
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
