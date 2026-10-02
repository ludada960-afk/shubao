import { DEFAULT_IMAGE_MODEL } from '../../services/imageModelCatalog.js';
const QA_QUERY_VALUE = 'ec-canvas';
const VISUAL_QA_QUERY_VALUE = 'visual';
/* 9-12 新增本地验收通道：?qa=ec-plan-launch —— 直接以「首页带设计方案发射」的状态进入画布。
   仅 import.meta.env.DEV 生效（见 AppContext.createInitialState），线上永远不会命中。
   用途：把「发射 → 画布装配」这条链在本地一次跑通/跑挂，避免靠读代码猜。 */
const PLAN_LAUNCH_QA_QUERY_VALUE = 'ec-plan-launch';

const QA_IMAGES = [
  {
    key: 'white-background-01',
    url: '/images/cropped_5.png',
    name: '白底商品图',
    title: '白底商品图',
    role: 'white_background',
    group: '白底图',
    ratio: '1:1',
    width: 1200,
    height: 1200,
  },
  {
    key: 'main-text-01',
    url: '/images/cook.png',
    name: '核心卖点主图',
    title: '核心卖点主图',
    role: 'main_text',
    group: '主图',
    ratio: '1:1',
    width: 1200,
    height: 1200,
  },
  {
    key: 'detail-feature-01',
    url: '/images/photographer.png',
    name: '使用场景详情图',
    title: '使用场景详情图',
    role: 'detail_feature',
    group: '详情图',
    ratio: '3:4',
    width: 1200,
    height: 1600,
  },
  {
    key: 'sku-01',
    url: '/images/meditate.png',
    name: 'SKU 规格图',
    title: 'SKU 规格图',
    role: 'sku',
    group: 'SKU',
    ratio: '1:1',
    width: 1200,
    height: 1200,
  },
  {
    key: 'transparent-01',
    url: '/images/superhero.png',
    name: '透明商品素材',
    title: '透明商品素材',
    role: 'transparent',
    group: '素材',
    ratio: '1:1',
    width: 1200,
    height: 1200,
  },
];

/* 9-17 用户批注（图8）：「点击加入资产库还是不对啊，我点击之后它为什么还是说不能加入资产库呢」。
   上一轮只修了「生成物」这条路径。剩下的来源（上传物 / 资产库导入物 / 带本地预览地址的素材）
   仍然被当成"待上传的本地文件"丢给上传接口，于是又抛「请选择 JPEG 或 PNG 原图后重试」。
   QA 通道里还叠了第二个闸门：importCanvasImageAssets 开头就 `if (… || result.browserQa) return failed`，
   于是「加入资产库」在这条通道上**永远**失败 —— 也正因为如此，这个 bug 才一直没被实测抓到。

   要给这条链做真实取证，就必须能在 QA 通道里显式选择「用真实登录态跑真请求」。
   所以新增 ?qa=ec-canvas-real：
     · 仍然复用同一套画布夹具（节点/图片都一样），保证前后可对比；
     · 但**不置 browserQa**，于是走的是完全真实的鉴权、项目、资产库接口，
       带真实会话 cookie/token 时「加入资产库」才会真的发出请求、真的入库。
   只在 import.meta.env.DEV 生效，线上永远命中不到（与其它 qa= 通道同一条约束）。 */
const REAL_QA_QUERY_VALUE = 'ec-canvas-real';

export function createCanvasBrowserQaState({ enabled, search = '' } = {}) {
  const qaValue = new URLSearchParams(search).get('qa');
  if (!enabled || ![QA_QUERY_VALUE, VISUAL_QA_QUERY_VALUE, PLAN_LAUNCH_QA_QUERY_VALUE, REAL_QA_QUERY_VALUE].includes(qaValue)) return null;

  if (qaValue === PLAN_LAUNCH_QA_QUERY_VALUE) {
    return {
      browserQa: true,
      logged: true,
      phone: 'browser-qa@local',
      page: 'ec-canvas',
      genState: 'idle',
      creationLaunch: {
        kind: 'ec-plan-launch',
        quick: false,
        draftId: 'qa-plan-launch',
        description: '保留商品结构，换成夏日场景',
        productName: '电商商品',
        realShots: [{ assetId: 'qa-product-1', url: '/images/curator.png', name: '产品图 1' }],
        refShots: [{ assetId: 'qa-ref-1', url: '/images/home/entry-xhs.png', name: '参考图 1' }],
        platform: 'taobao',
        sizing: { resolution: '2K' },
        genSettings: { imageModel: DEFAULT_IMAGE_MODEL },
      },
    };
  }

  if (qaValue === VISUAL_QA_QUERY_VALUE) {
    const referenceUrl = '/images/visual-recipes/cases/social-cover-input.png';
    const resultUrl = '/images/visual-recipes/cases/social-cover-output.png';
    return {
      browserQa: true,
      page: 'home',
      mode: 'visual',
      logged: false,
      phone: '',
      works: [{
        id: 'visual-browser-qa-work',
        _saveKey: 'visual-browser-qa-work',
        workType: 'visual',
        product_name: '社媒封面',
        title: '社媒封面',
        prompt: '为城市夜跑专题制作公众号头图，标题为「今晚，去追风」，突出路线、节奏和人群氛围。',
        visualSkillId: 'social-cover',
        ratio: '21:9',
        resolution: '2K',
        imageModel: DEFAULT_IMAGE_MODEL,
        createdAt: Date.now(),
        images: [{ key: 'visual_1', url: resultUrl, label: '公众号头图', displayName: '公众号头图', role: 'visual_creation', ratio: '21:9' }],
        imageRecords: [{ key: 'visual_1', url: resultUrl, label: '公众号头图', displayName: '公众号头图', role: 'visual_creation', ratio: '21:9' }],
        replay: {
          creationIntent: 'visual',
          skillId: 'social-cover',
          skillControl: '公众号',
          panelValues: { platform: '横向头图', headline: '结果先行' },
          prompt: '为城市夜跑专题制作公众号头图，标题为「今晚，去追风」，突出路线、节奏和人群氛围。',
          imageModel: DEFAULT_IMAGE_MODEL,
          ratio: '21:9',
          resolution: '2K',
          referenceAssets: [{ assetId: 'visual-browser-qa-reference', url: referenceUrl, displayName: '夜跑素材' }],
        },
      }],
    };
  }

  /* ?qa=ec-canvas-real：同一套夹具，但不设 browserQa —— 走真实鉴权与真实接口。
     画布上的节点/图片与 ?qa=ec-canvas 完全一致，所以两条通道可以逐像素对比。 */
  const realSession = qaValue === REAL_QA_QUERY_VALUE;
  /* 注意：AppContext.createInitialState 只在 **没有** browserQa 时才按 pathname 决定初始 page，
     而真实态这条通道恰恰没有 browserQa —— 所以光设 page 不够，pathname（'/'）会在
     createInitialState 里把它覆盖回 home。这里在初始化期把 URL 也钉到 /ec-canvas，
     两条路一起保证「真实登录态 + 画布」这个组合能起来。仅在 DEV + 该 qa 值下执行。 */
  if (realSession && typeof globalThis !== 'undefined' && globalThis.history?.replaceState) {
    const current = globalThis.location?.pathname || '';
    if (current !== '/ec-canvas') {
      globalThis.history.replaceState(null, '', `/ec-canvas${globalThis.location?.search || ''}`);
    }
  }
  return {
    ...(realSession ? {} : { browserQa: true }),
    page: 'ec-canvas',
    ...(realSession ? { qaPagePinned: true } : {}),
    logged: true,
    phone: '',
    genState: 'result',
    result: {
      id: 'canvas-browser-qa-readable',
      ...(realSession ? {} : { browserQa: true }),
      _ecResult: true,
      product_name: '电商商品套图验收',
      platform: '淘宝',
      productAssets: [{
        key: 'product-original',
        assetId: 'product-original',
        url: '/images/curator.png',
        name: '商品原图',
        ratio: '1:1',
        width: 1200,
        height: 1200,
      }],
      images: QA_IMAGES.map(image => ({ ...image })),
      imageRecords: QA_IMAGES.map(image => ({ ...image })),
    },
  };
}
