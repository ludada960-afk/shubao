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

export function createCanvasBrowserQaState({ enabled, search = '' } = {}) {
  const qaValue = new URLSearchParams(search).get('qa');
  if (!enabled || ![QA_QUERY_VALUE, VISUAL_QA_QUERY_VALUE, PLAN_LAUNCH_QA_QUERY_VALUE].includes(qaValue)) return null;

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
        genSettings: { imageModel: 'image2' },
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
        imageModel: 'image2',
        createdAt: Date.now(),
        images: [{ key: 'visual_1', url: resultUrl, label: '公众号头图', displayName: '公众号头图', role: 'visual_creation', ratio: '21:9' }],
        imageRecords: [{ key: 'visual_1', url: resultUrl, label: '公众号头图', displayName: '公众号头图', role: 'visual_creation', ratio: '21:9' }],
        replay: {
          creationIntent: 'visual',
          skillId: 'social-cover',
          skillControl: '公众号',
          panelValues: { platform: '横向头图', headline: '结果先行' },
          prompt: '为城市夜跑专题制作公众号头图，标题为「今晚，去追风」，突出路线、节奏和人群氛围。',
          imageModel: 'image2',
          ratio: '21:9',
          resolution: '2K',
          referenceAssets: [{ assetId: 'visual-browser-qa-reference', url: referenceUrl, displayName: '夜跑素材' }],
        },
      }],
    };
  }

  return {
    browserQa: true,
    page: 'ec-canvas',
    logged: true,
    phone: '',
    genState: 'result',
    result: {
      id: 'canvas-browser-qa-readable',
      browserQa: true,
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
