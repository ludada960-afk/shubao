/* ═══ 视频板块的 Skill 声明（单一事实源）═══════════════════════════════════════
   依据 docs/design/43-media-architecture.md §3.3 / §5 与 docs/design/44。
   用户批注（图 #9）：「视频生成的三个入口只保留智能成片和首尾帧，爆款复刻可以通过 skill 的形式
   去复刻……你要去找现在最前沿的一些视频生成相关的 skill 出来，让它们成为我们的视频 skill 库」
   「你不要真正的去跑这些案例出来，成本非常的高……你先把 UI 和 skill 内置进去，
    案例你先找一些替代的视频过来占位，后期我自己去点击生成再替换掉」。
   ⚠️ 本文件是**声明**：不含模型名（模型由路由层按 capability 过滤，见 9-16 路由可达性台账），
      只声明"这个 skill 需要什么素材、要哪些字段、走哪条既有引擎"。
   ⚠️ availability 如实标注，不许把跑不通的写成能用：
      · 'ready'     现有可调用路由（seedance_fast / seedance_standard）即可满足；
      · 'needs_ref' 需要参考素材能力（现有路由已声明支持，但未实测出片）；
      · 'blocked'   需要的能力当前不可用（例如 1080P 或余额不足档位）——**上架前必须先转 ready**。 */

export const VIDEO_CAPABILITIES = ['text', 'image', 'video', 'audio', 'frames'];
export const VIDEO_PIPELINES = [
  'videoSmart',   // 现有智能成片链路
  'videoFrame',   // 现有首尾帧链路
  'videoRemake',  // 现有爆款复刻链路
  'videoReference', // 现有全能参考（图片/视频/音频）链路
];
export const VIDEO_AVAILABILITY = ['ready', 'needs_ref', 'blocked'];

export const VIDEO_SKILLS = [
  {
    id: 'video.smart', board: 'video', name: '智能成片', category: '精品推荐', complexity: 'standard',
    summary: '一句话起步，镜头与节奏交给模型', capability: ['image', 'video', 'audio'], availability: 'ready',
    pipeline: 'videoSmart', cover: { template: 'case-3up', accent: 'accent' },
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'resolution', label: '清晰度', kind: 'segmented', required: true },
      { key: 'duration', label: '时长', kind: 'segmented', required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'video.frame', board: 'video', name: '首尾帧', category: '精品推荐', complexity: 'standard',
    summary: '两张图锁定镜头起点与终点，中间交给模型', capability: ['frames'], availability: 'ready',
    pipeline: 'videoFrame', cover: { template: 'case-3up', accent: 'cool' },
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'resolution', label: '清晰度', kind: 'segmented', required: true },
      { key: 'duration', label: '时长', kind: 'segmented', required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'video.remake', board: 'video', name: '爆款复刻', category: '热门玩法', complexity: 'standard',
    summary: '保留参考片的节奏与镜头结构，换上你的内容', capability: ['video', 'image'], availability: 'needs_ref',
    pipeline: 'videoRemake', cover: { template: 'case-3up', accent: 'warm' },
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'resolution', label: '清晰度', kind: 'segmented', required: true },
      { key: 'duration', label: '时长', kind: 'segmented', required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'video.image_to_video', board: 'video', name: '图生视频', category: '热门玩法', complexity: 'simple',
    summary: '一张商品图动起来，适合主图视频与详情动效', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'warm' },
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'resolution', label: '清晰度', kind: 'segmented', required: true },
      { key: 'duration', label: '时长', kind: 'segmented', required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'video.product_motion', board: 'video', name: '商品动态展示', category: '电商专区', complexity: 'simple',
    summary: '商品旋转、光影扫过、材质微距，用在主图与详情首屏', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'warm' },
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'resolution', label: '清晰度', kind: 'segmented', required: true },
      { key: 'duration', label: '时长', kind: 'segmented', required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'video.content_swap', board: 'video', name: '内容替换', category: '热门玩法', complexity: 'standard',
    summary: '上传人物视频和人物图片，一键换人（知渔同款玩法）', capability: ['video', 'image'], availability: 'needs_ref',
    pipeline: 'videoRemake', cover: { template: 'case-3up', accent: 'soft' },
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'resolution', label: '清晰度', kind: 'segmented', required: true },
      { key: 'duration', label: '时长', kind: 'segmented', required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'video.model_runway', board: 'video', name: '模特动态', category: '人像摄影', complexity: 'simple',
    summary: '让模特照片走起来：转身、迈步、衣摆飘动', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'hero-single', accent: 'soft' },
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'resolution', label: '清晰度', kind: 'segmented', required: true },
      { key: 'duration', label: '时长', kind: 'segmented', required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'video.camera_move', board: 'video', name: '运镜控制', category: '热门玩法', complexity: 'standard',
    summary: '推、拉、摇、移、环绕，指定镜头怎么走', capability: ['image', 'text'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'case-3up', accent: 'accent' },
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'camera', label: '运镜', kind: 'segmented', required: true },
      { key: 'resolution', label: '清晰度', kind: 'segmented', required: true },
      { key: 'duration', label: '时长', kind: 'segmented', required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'video.extend', board: 'video', name: '延长续写', category: '创意应用', complexity: 'standard',
    summary: '接着上一段往下拍，保持主体与光线连续', capability: ['video'], availability: 'blocked',
    pipeline: 'videoRemake', cover: { template: 'case-3up', accent: 'cool' },
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'resolution', label: '清晰度', kind: 'segmented', required: true },
      { key: 'duration', label: '时长', kind: 'segmented', required: true },
    ],
    cases: [], history: true,
  },
  {
    id: 'video.festival_spot', board: 'video', name: '节日营销短片', category: '创意应用', complexity: 'simple',
    summary: '节点氛围 + 商品，适合大促与节日投放', capability: ['image'], availability: 'ready',
    pipeline: 'videoReference', cover: { template: 'poster-style', accent: 'accent' },
    fields: [
      { key: 'model', label: '模型', kind: 'select', required: true },
      { key: 'resolution', label: '清晰度', kind: 'segmented', required: true },
      { key: 'duration', label: '时长', kind: 'segmented', required: true },
    ],
    cases: [], history: true,
  },
];

export const VIDEO_SKILL_CATEGORIES = [...new Set(VIDEO_SKILLS.map(skill => skill.category))];

export function getVideoSkill(id) {
  const key = typeof id === 'string' ? id.trim() : '';
  return VIDEO_SKILLS.find(skill => skill.id === key) || null;
}
