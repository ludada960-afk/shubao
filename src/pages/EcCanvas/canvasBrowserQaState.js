const QA_QUERY_VALUE = 'ec-canvas';

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
  if (!enabled || new URLSearchParams(search).get('qa') !== QA_QUERY_VALUE) return null;

  return {
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
