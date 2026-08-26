// 跨域投递纯模型（P2 连边 1+6）：EcCanvas / 电商套图 → 视频项目（推式）。
// 只做表现层编排：引用规范化、目标项目与镜头首帧选择、投递计划校验。
// 复用既有 importProjectAssetVersion 契约，不触碰 provider 底座 / 队列 / 账务。

export const DELIVERY_SOURCE_SURFACES = Object.freeze({
  ecCanvas: 'ec-canvas',
  ecommerceWorkbench: 'ecommerce-workbench',
});

export const DELIVERY_METADATA_SOURCE = 'canvas-delivery';

function cleanText(value, max = 200) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > max || /[\u0000-\u001F\u007F]/.test(normalized)) return '';
  return normalized;
}

export function deliveryRefKey(ref) {
  if (!ref) return '';
  return [ref.projectId, ref.projectAssetId, ref.contentHash].map(part => String(part || '')).join(':');
}

// 从 EcCanvas 节点 / 作品图记录提取可跨域投递的 canonical 引用。
// 三要素齐备（源项目 + 项目素材 + 内容哈希）才可投递，缺一不可。
export function deliverableRefFrom(value = {}) {
  const ref = value?.assetRef && typeof value.assetRef === 'object' ? value.assetRef : value;
  const projectId = cleanText(ref?.projectId || ref?.project_id, 256);
  const projectAssetId = cleanText(ref?.projectAssetId || ref?.project_asset_id, 256);
  const contentHash = cleanText(ref?.contentHash || ref?.content_hash || ref?.expectedContentHash, 256);
  if (!projectId || !projectAssetId || !contentHash) return null;
  const rawKind = String(ref?.mediaKind || ref?.kind || 'image').toLowerCase();
  const mediaKind = ['image', 'video', 'audio'].includes(rawKind) ? rawKind : 'image';
  return Object.freeze({
    projectId,
    projectAssetId,
    contentHash,
    stableUrl: cleanText(ref?.stableUrl || ref?.stable_url || ref?.url, 2048),
    mediaKind,
    name: cleanText(ref?.name || ref?.displayName || ref?.label, 120),
  });
}

export function deliverableRefsFromNodes(nodes = []) {
  const refs = [];
  const seen = new Set();
  (Array.isArray(nodes) ? nodes : []).forEach(node => {
    const ref = deliverableRefFrom(node);
    if (!ref) return;
    const key = deliveryRefKey(ref);
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  });
  return refs;
}

// 投递到视频工作台时的素材角色（与画布左栏导入语义一致）。
export function deliveryWorkbenchKind(mediaKind) {
  if (mediaKind === 'video') return 'scene';
  if (mediaKind === 'audio') return 'music';
  return 'product';
}

export function deliveryBindingRole(mediaKind) {
  // 图片默认绑镜头首帧；视频/音频仅入素材库作参考。
  return mediaKind === 'image' ? 'first_frame' : 'reference';
}

export function buildDeliveryMetadata(ref, surface) {
  return {
    source: DELIVERY_METADATA_SOURCE,
    sourceSurface: Object.values(DELIVERY_SOURCE_SURFACES).includes(surface) ? surface : '',
    displayName: ref?.name || '',
    deliveredAt: new Date().toISOString(),
  };
}

// 目标项目候选：只允许 kind==='video'，新更新的在前。
export function videoTargetProjects(projects = []) {
  const timeValue = value => Date.parse(String(value || '')) || 0;
  return (Array.isArray(projects) ? projects : [])
    .filter(project => project?.id && project.kind === 'video')
    .sort((left, right) => timeValue(right.updatedAt || right.createdAt)
      - timeValue(left.updatedAt || left.createdAt));
}

// 首帧绑定候选：按 position 升序的镜头列表。
export function shotFirstFrameChoices(shots = []) {
  return (Array.isArray(shots) ? shots : [])
    .filter(shot => shot?.id)
    .sort((left, right) => Number(left.position ?? 0) - Number(right.position ?? 0))
    .map((shot, index) => ({
      shotId: shot.id,
      position: Number(shot.position ?? index),
      label: '镜头 ' + String(index + 1).padStart(2, '0') + (shot.purpose ? ' · ' + shot.purpose : ''),
    }));
}

// 投递计划校验：返回可读错误文案，空串表示可执行。
export function validateDeliveryPlan({ refs = [], targetProjectId = '', surface = '' } = {}) {
  const list = Array.isArray(refs) ? refs.filter(Boolean) : [];
  if (!list.length) return '没有可投递的素材：只有已登记到项目的图片/视频/音频才能跨域投递';
  if (!Object.values(DELIVERY_SOURCE_SURFACES).includes(surface)) return '缺少投递来源标识';
  if (!cleanText(targetProjectId, 256)) return '请选择或新建一个视频项目';
  return '';
}

// 单个引用的投递步骤描述（UI 进度展示 + 测试契约）。
export function deliveryStepPlan(ref, { bindShotId = '' } = {}) {
  const role = deliveryBindingRole(ref?.mediaKind);
  return [
    { step: 'create-asset', summary: '在视频项目建立素材卡' },
    { step: 'import-version', summary: '按 canonical 引用拉取源素材版本' },
    { step: 'approve', summary: '确认素材版本' },
    ...(role === 'first_frame' && bindShotId ? [{ step: 'bind-shot', summary: '绑为镜头首帧' }] : []),
  ];
}
