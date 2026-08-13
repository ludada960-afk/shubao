function asset({ src, label, role, ratio, intent, taskId = '', requestKey = '' }) {
  return Object.freeze({ src, label, role, ratio, intent, taskId, requestKey });
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
    chapters: Object.freeze([
      chapter({
        id: `${id}-breadth`,
        title: id === 'social-cover' ? '按平台重排内容' : '从意图到成片',
        description: id === 'social-cover' ? '不同平台使用各自的画幅、标题密度和视觉重心。' : '用多个独立案例证明这套配方的能力宽度。',
        layout: { type: id === 'social-cover' ? 'platform-fan' : 'editorial-grid' },
        assets: [
          asset({ src: `/images/visual-recipes/cases/${input}`, label: inputLabel, role: 'input', ratio: id === 'social-cover' ? '3:4' : '4:3', intent: id }),
          asset({ src: `/images/visual-recipes/cases/${output}`, label: outputLabel, role: 'output', ratio: id === 'social-cover' ? '21:9' : '3:4', intent: id }),
          asset({ src: `/images/visual-recipes/cases/${output}`, label: id === 'social-cover' ? 'B站封面' : '延展结果', role: 'output', ratio: id === 'social-cover' ? '16:9' : '1:1', intent: id }),
        ],
      }),
      chapter({
        id: `${id}-depth`,
        title: id === 'social-cover' ? '内容类型覆盖' : '继续扩展视觉系统',
        description: id === 'social-cover' ? '攻略、评测、清单和教程分别采用不同的封面结构。' : '从另一个任务类型验证结果不是单一模板的重复。',
        layout: { type: id === 'brand-kv' ? 'touchpoint-board' : id === 'poster' ? 'print-wall' : 'story-map' },
        assets: [
          asset({ src: `/images/visual-recipes/cases/${output}`, label: id === 'social-cover' ? '小红书攻略' : '主案例', role: 'output', ratio: '3:4', intent: id }),
          asset({ src: `/images/visual-recipes/cases/${input}`, label: id === 'social-cover' ? '抖音封面' : '辅助案例', role: 'input', ratio: id === 'brand-kv' ? '16:9' : '1:1', intent: id }),
          asset({ src: `/images/visual-recipes/cases/${output}`, label: id === 'social-cover' ? '公众号头图' : '细节结果', role: 'output', ratio: id === 'brand-kv' ? '21:9' : '4:3', intent: id }),
        ],
      }),
    ]),
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
