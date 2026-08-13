function asset({ src, label, role, ratio, intent, taskId = '', requestKey = '' }) {
  return Object.freeze({ src, label, role, ratio, intent, taskId, requestKey });
}

export const PRODUCTION_CASE_CATALOG = Object.freeze([
  Object.freeze({
    id: 'product-suite',
    status: 'fixture',
    assets: Object.freeze([
      asset({ src: '/images/home/entry-ecommerce.png', label: '商品素材', role: 'source', ratio: '411:376', intent: 'product_suite' }),
      asset({ src: '/images/home/workspace-ecommerce.png', label: '主图视觉', role: 'result', ratio: '612:612', intent: 'product_suite' }),
      asset({ src: '/images/home/entry-ecommerce.png', label: '详情视觉', role: 'result', ratio: '411:376', intent: 'product_suite' }),
    ]),
  }),
  Object.freeze({
    id: 'tryon-angles',
    status: 'fixture',
    assets: Object.freeze([
      asset({ src: '/images/home/tryon-showcase/product-flatlay.png', label: '商品与穿搭', role: 'source', ratio: '475:1254', intent: 'anything_tryon' }),
      asset({ src: '/images/home/tryon-showcase/angle-front.png', label: '正面', role: 'result', ratio: '347:610', intent: 'anything_tryon' }),
      asset({ src: '/images/home/tryon-showcase/angle-motion.png', label: '动态', role: 'result', ratio: '347:605', intent: 'anything_tryon' }),
      asset({ src: '/images/home/tryon-showcase/angle-side.png', label: '侧面', role: 'result', ratio: '325:610', intent: 'anything_tryon' }),
      asset({ src: '/images/home/tryon-showcase/angle-back.png', label: '背面', role: 'result', ratio: '325:605', intent: 'anything_tryon' }),
    ]),
  }),
  Object.freeze({
    id: 'tryon-reference',
    status: 'fixture',
    assets: Object.freeze([
      asset({ src: '/images/home/tryon-showcase/reference-flatlay.png', label: '商品与穿搭', role: 'source', ratio: '390:1254', intent: 'anything_tryon' }),
      asset({ src: '/images/home/tryon-showcase/reference-person.png', label: '参考模特', role: 'reference', ratio: '315:1254', intent: 'anything_tryon' }),
      asset({ src: '/images/home/tryon-showcase/reference-result.png', label: '上身结果', role: 'result', ratio: '334:1254', intent: 'anything_tryon' }),
    ]),
  }),
  ...[
    ['free', 'free-input.png', '灵感素材', 'free-output.png', '完整画面'],
    ['poster', 'poster-input.png', '主体素材', 'poster-output.png', '海报成稿'],
    ['social-cover', 'social-cover-input.png', '内容素材', 'social-cover-output.png', '社媒封面'],
    ['brand-kv', 'brand-kv-input.png', '产品素材', 'brand-kv-output.png', '品牌主视觉'],
  ].map(([id, input, inputLabel, output, outputLabel]) => Object.freeze({
    id,
    status: 'fixture',
    assets: Object.freeze([
      asset({ src: `/images/visual-recipes/cases/${input}`, label: inputLabel, role: 'input', ratio: '640:480', intent: id }),
      asset({ src: `/images/visual-recipes/cases/${output}`, label: outputLabel, role: 'output', ratio: '720:480', intent: id }),
    ]),
  })),
]);

export function productionCaseById(id) {
  const item = PRODUCTION_CASE_CATALOG.find(entry => entry.id === id);
  if (!item) throw new Error(`Unknown production case: ${id}`);
  return item;
}
