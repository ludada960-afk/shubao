import { isPersistentEcommerceImageUrl } from '../../utils/workRecords.js';

export const VISUAL_CREATION_SKILLS = Object.freeze([
  Object.freeze({
    id: 'free',
    title: '自由创作',
    shortDescription: '从一句想法或参考图开始',
    preserves: '你的主体、关系与明确约束',
    outcome: '由描述自由定义画面风格与构图',
    bestFor: '概念图、插画、场景与开放需求',
    previews: Object.freeze(['/images/home/reference-card-product.png', '/images/home/reference-card-fashion.png']),
  }),
  Object.freeze({
    id: 'poster',
    title: '海报设计',
    shortDescription: '先建立焦点，再组织信息层级',
    preserves: '核心主体、品牌信息与标题优先级',
    outcome: '完整构图、清晰层级与可读排版区',
    bestFor: '活动、上新、节日与线下海报',
    previews: Object.freeze(['/images/home/reference-card-product.png', '/images/home/reference-card-video.png']),
  }),
  Object.freeze({
    id: 'social-cover',
    title: '社媒封面',
    shortDescription: '让主题在移动端一眼可读',
    preserves: '主体辨识度与标题信息优先级',
    outcome: '强视觉焦点、标题安全区与紧凑构图',
    bestFor: '小红书、公众号与短视频封面',
    previews: Object.freeze(['/images/home/reference-card-fashion.png', '/images/home/reference-card-video.png']),
  }),
  Object.freeze({
    id: 'brand-kv',
    title: '品牌主视觉',
    shortDescription: '把品牌调性扩展成统一画面语言',
    preserves: '品牌身份、产品特征与关键色',
    outcome: '可延展的场景、材质、光影与构图系统',
    bestFor: 'Campaign KV、发布会与主题传播',
    previews: Object.freeze(['/images/home/reference-card-product.png', '/images/home/reference-card-remix.png']),
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
