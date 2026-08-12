import { isPersistentEcommerceImageUrl } from '../../utils/workRecords.js';

export const VISUAL_CREATION_SKILLS = Object.freeze([
  Object.freeze({
    id: 'free',
    title: '自由创作',
    shortDescription: '从一句想法或参考图开始',
    preserves: '你的主体、关系与明确约束',
    outcome: '由描述自由定义画面风格与构图',
    bestFor: '概念图、插画、场景与开放需求',
    preview: '/images/visual-recipes/free.png',
    control: Object.freeze({
      label: '画面语言',
      options: Object.freeze(['智能匹配', '写实摄影', '风格插画']),
    }),
    showcases: Object.freeze([
      Object.freeze({
        title: '从灵感到完整场景',
        description: '保留主体关系，把简单素材扩展成有空间感的完整画面。',
        input: Object.freeze({ src: '/images/visual-recipes/cases/free-input.png', label: '灵感素材' }),
        output: Object.freeze({ src: '/images/visual-recipes/cases/free-output.png', label: '完整画面' }),
      }),
      Object.freeze({
        title: '让构图继续生长',
        description: '围绕主体补全光线、环境与叙事细节，结果可进入画布继续编辑。',
        output: Object.freeze({ src: '/images/visual-recipes/cases/free-output.png', label: '场景细节' }),
      }),
    ]),
  }),
  Object.freeze({
    id: 'poster',
    title: '海报设计',
    shortDescription: '先建立焦点，再组织信息层级',
    preserves: '核心主体、品牌信息与标题优先级',
    outcome: '完整构图、清晰层级与可读排版区',
    bestFor: '活动、上新、节日与线下海报',
    preview: '/images/visual-recipes/poster.png',
    control: Object.freeze({
      label: '信息重点',
      options: Object.freeze(['主标题优先', '产品优先', '活动信息优先']),
    }),
    showcases: Object.freeze([
      Object.freeze({
        title: '先聚焦，再排信息',
        description: '把主体转成视觉焦点，并为标题、卖点和行动信息留出清晰层级。',
        input: Object.freeze({ src: '/images/visual-recipes/cases/poster-input.png', label: '主体素材' }),
        output: Object.freeze({ src: '/images/visual-recipes/cases/poster-output.png', label: '海报成稿' }),
      }),
      Object.freeze({
        title: '一张图建立传播节奏',
        description: '用对比、留白和阅读顺序把视觉与文案组织成可发布海报。',
        output: Object.freeze({ src: '/images/visual-recipes/cases/poster-output.png', label: '版式细节' }),
      }),
    ]),
  }),
  Object.freeze({
    id: 'social-cover',
    title: '社媒封面',
    shortDescription: '让主题在移动端一眼可读',
    preserves: '主体辨识度与标题信息优先级',
    outcome: '强视觉焦点、标题安全区与紧凑构图',
    bestFor: '小红书、公众号与短视频封面',
    preview: '/images/visual-recipes/social-cover.png',
    control: Object.freeze({
      label: '发布平台',
      options: Object.freeze(['小红书', '公众号', 'B站封面', '抖音封面']),
    }),
    showcases: Object.freeze([
      Object.freeze({
        title: '移动端一眼读懂',
        description: '强化人物与标题焦点，并按平台阅读习惯安排安全区。',
        input: Object.freeze({ src: '/images/visual-recipes/cases/social-cover-input.png', label: '内容素材' }),
        output: Object.freeze({ src: '/images/visual-recipes/cases/social-cover-output.png', label: '社媒封面' }),
      }),
      Object.freeze({
        title: '把内容变成点击理由',
        description: '兼顾人物情绪、标题可读性和平台缩略图中的辨识度。',
        output: Object.freeze({ src: '/images/visual-recipes/cases/social-cover-output.png', label: '封面细节' }),
      }),
    ]),
  }),
  Object.freeze({
    id: 'brand-kv',
    title: '品牌主视觉',
    shortDescription: '把品牌调性扩展成统一画面语言',
    preserves: '品牌身份、产品特征与关键色',
    outcome: '可延展的场景、材质、光影与构图系统',
    bestFor: 'Campaign KV、发布会与主题传播',
    preview: '/images/visual-recipes/brand-kv.png',
    control: Object.freeze({
      label: '延展方向',
      options: Object.freeze(['产品聚焦', '场景延展', '材质叙事']),
    }),
    showcases: Object.freeze([
      Object.freeze({
        title: '从产品到品牌世界',
        description: '保留产品识别点，把品牌色、材质和空间扩展成统一主视觉。',
        input: Object.freeze({ src: '/images/visual-recipes/cases/brand-kv-input.png', label: '产品素材' }),
        output: Object.freeze({ src: '/images/visual-recipes/cases/brand-kv-output.png', label: '品牌主视觉' }),
      }),
      Object.freeze({
        title: '建立可延展的视觉系统',
        description: '统一光影、色彩与图形语言，便于后续延展到不同传播尺寸。',
        output: Object.freeze({ src: '/images/visual-recipes/cases/brand-kv-output.png', label: '系统细节' }),
      }),
    ]),
  }),
]);

export const VISUAL_RATIO_OPTIONS = Object.freeze([
  Object.freeze({ id: '1:1', label: '方形 1:1' }),
  Object.freeze({ id: '3:4', label: '竖版 3:4' }),
  Object.freeze({ id: '4:3', label: '横版 4:3' }),
  Object.freeze({ id: '9:16', label: '竖屏 9:16' }),
]);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function visualSkillById(skillId) {
  return VISUAL_CREATION_SKILLS.find(skill => skill.id === skillId) || VISUAL_CREATION_SKILLS[0];
}

export function createVisualRun({ runId, count = 1, createdAt = Date.now() } = {}) {
  const id = cleanString(runId) || `visual-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  const slotCount = Math.max(1, Math.min(4, Number.parseInt(count, 10) || 1));
  return {
    id,
    createdAt,
    slots: Array.from({ length: slotCount }, (_, index) => ({
      id: `${id}:${index + 1}`,
      requestKey: `${id}:${index + 1}`,
      status: 'pending',
      url: '',
      taskId: '',
      error: '',
    })),
  };
}

export function updateVisualRunSlot(run, slotIndex, patch = {}) {
  if (!run || !Array.isArray(run.slots)) throw new TypeError('visual run is required');
  const index = Number(slotIndex);
  if (!Number.isSafeInteger(index) || index < 0 || index >= run.slots.length) {
    throw new RangeError('visual run slot is out of range');
  }
  return {
    ...run,
    slots: run.slots.map((slot, currentIndex) => currentIndex === index ? {
      ...slot,
      ...patch,
      id: slot.id,
      requestKey: slot.requestKey,
    } : slot),
  };
}

export function visualPendingIndexes(run) {
  return (run?.slots || []).flatMap((slot, index) => slot.status === 'pending' ? [index] : []);
}

export function visualRetryIndexes(run) {
  return (run?.slots || []).flatMap((slot, index) => slot.status === 'failed' ? [index] : []);
}

export function visualRunIsBusy(run) {
  return (run?.slots || []).some(slot => slot.status === 'uploading' || slot.status === 'generating');
}

export function buildVisualWorkRecord({
  run,
  prompt = '',
  skillId = 'free',
  model = 'image2',
  ratio = '1:1',
  resolution = '2K',
  referenceAssets = [],
} = {}) {
  if (!run?.id || !Array.isArray(run.slots)) throw new TypeError('visual run is required');
  const completedSlots = run.slots.filter(slot => slot.status === 'completed' && isPersistentEcommerceImageUrl(slot.url));
  if (!completedSlots.length) throw new Error('没有可保存的稳定图片');
  const skill = visualSkillById(skillId);
  const images = completedSlots.map((slot, index) => ({
    id: slot.taskId || slot.id,
    key: `visual_${index + 1}`,
    assetId: slot.taskId || '',
    label: `${skill.title} ${index + 1}`,
    displayName: `${skill.title} ${index + 1}`,
    url: slot.url,
    role: 'visual_creation',
    group: '自由创作',
    ratio,
    resolution,
    requestKey: slot.requestKey,
  }));
  const generationStatus = completedSlots.length === run.slots.length ? 'completed' : 'needs_review';
  return {
    id: run.id,
    taskId: run.id,
    _saveKey: run.id,
    _ecResult: true,
    workType: 'visual',
    product_name: skill.title,
    title: skill.title,
    category: '自由创作',
    platform: '自由创作',
    prompt: cleanString(prompt),
    visualSkillId: skill.id,
    imageModel: model,
    ratio,
    resolution,
    generationStatus,
    createdAt: run.createdAt,
    referenceAssets: Array.isArray(referenceAssets) ? referenceAssets : [],
    images,
    imageRecords: images,
  };
}

export function buildVisualCanvasResult(work, { importId } = {}) {
  const imageRecords = Array.isArray(work?.imageRecords) ? work.imageRecords : Array.isArray(work?.images) ? work.images : [];
  return {
    ...work,
    _ecResult: true,
    workType: 'visual',
    images: Object.fromEntries(imageRecords.map((image, index) => [image.key || `visual_${index + 1}`, image.url])),
    imageRecords,
    productAssets: [],
    referenceAssets: Array.isArray(work?.referenceAssets) ? work.referenceAssets : [],
    canvasImportId: importId || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  };
}
