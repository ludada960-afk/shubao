import { resolveVideoApiMode } from './videoStudioModel.js';
import { formatCanvasShotName, resolveShotPrefix } from '../../constants/canvasNames.js';

// 4c183cd4 续命 P-B 电影分镜命名: buildCanvasNodes 内部用同一份 counter,
// 保证同一项目里同前缀递增 001/002/..., 与「产品图N」客观命名一致。
const SHOT_NAME_COUNTERS = { Enclosure: 0, Breakthrough: 0, Framing: 0, Overture: 0, Voice: 0, Track: 0 };

function nextShotName(prefixKey) {
  SHOT_NAME_COUNTERS[prefixKey] = (SHOT_NAME_COUNTERS[prefixKey] || 0) + 1;
  return formatCanvasShotName(prefixKey, SHOT_NAME_COUNTERS[prefixKey]);
}

// P1 画布最小集的纯模型：节点、连线、布局、框选、生成条与审批门。
// 只做表现层编排，不触碰 provider 底座 / 队列 / 账务。

export const CANVAS_GENERATION_MODES = Object.freeze([
  { id: 'smart', label: '智能成片（文生）', hint: '一句话起步，可不选素材' },
  { id: 'reference', label: '多图参考（图生）', hint: '用框选的图片或视频作为视觉参考' },
  { id: 'frame', label: '首尾帧链', hint: '两张图片锁定镜头起点与终点，连线表达续写' },
  { id: 'remake', label: '爆款重构', hint: '保留参考视频节奏，替换为你的商品画面' },
]);

export const CAMERA_MOVE_CHIPS = Object.freeze([
  ['static', '固定'], ['pan', '横摇'], ['tilt', '纵摇'], ['dolly_in', '推进'],
  ['dolly_out', '拉远'], ['tracking', '跟拍'], ['orbit', '环绕'],
]);

export const CANVAS_NODE_SIZES = Object.freeze({
  asset: Object.freeze({ width: 184, height: 124 }),
  shot: Object.freeze({ width: 248, height: 176 }),
  candidate: Object.freeze({ width: 208, height: 158 }),
});

export function canvasNodeSize(type) {
  return CANVAS_NODE_SIZES[type] || CANVAS_NODE_SIZES.asset;
}

function assetNodeId(source, key) {
  return 'asset:' + source + ':' + key;
}

function shotNodeId(shotId) {
  return 'shot:' + shotId;
}

function candidateNodeId(shotId, candidateId) {
  return 'candidate:' + shotId + ':' + candidateId;
}

export function importedVideoAssetIds(workbench) {
  return new Set((Array.isArray(workbench?.assets) ? workbench.assets : []).flatMap(asset =>
    (Array.isArray(asset?.versions) ? asset.versions : [])
      .map(version => version?.sourceProjectAssetId)
      .filter(Boolean)));
}

export function buildCanvasNodes({ uploads = [], libraryAssets = [], workbench = null } = {}) {
  const nodes = [];
  const imported = importedVideoAssetIds(workbench);
  (Array.isArray(uploads) ? uploads : []).forEach(upload => {
    const asset = upload?.asset;
    if (!asset?.id || imported.has(asset.id)) return;
    const kind = asset.kind || 'image';
    const realName = upload.file?.name || asset.fileName || asset.name;
    nodes.push({
      id: assetNodeId('upload', asset.id),
      type: 'asset',
      source: 'upload',
      sourceKey: asset.id,
      videoAssetId: asset.id,
      kind,
      previewUrl: asset.url || '',
      // P-B: 真实文件名优先, 兜底走电影分镜命名 (Enclosure-001 / Breakthrough-001 / Voice-001)
      title: String(realName || nextShotName(resolveShotPrefix({ kind }))),
    });
  });
  (Array.isArray(libraryAssets) ? libraryAssets : []).forEach(item => {
    if (!item?.projectAssetId) return;
    const kind = item.mediaKind || 'image';
    const realName = item.metadata?.displayName || item.displayName || item.name;
    nodes.push({
      id: assetNodeId('library', (item.sourceProject?.id || '') + ':' + item.projectAssetId),
      type: 'asset',
      source: 'library',
      sourceKey: item.projectAssetId,
      projectAssetId: item.projectAssetId,
      kind,
      previewUrl: item.stableUrl || '',
      // P-B: 库内素材用 displayName 优先, 无名时走 Enclosure/Breakthrough/Voice 编号
      title: String(realName || nextShotName(resolveShotPrefix({ kind }))),
    });
  });
  (Array.isArray(workbench?.assets) ? workbench.assets : []).forEach(asset => {
    if (!asset?.id) return;
    const versions = Array.isArray(asset?.versions) ? asset.versions : [];
    const version = versions.find(item => item?.id === asset.approvedVersionId) || versions[0];
    if (!version) return;
    const subKind = asset.kind === 'voice' ? 'voice' : asset.kind === 'music' ? 'music' : null;
    const kind = subKind ? 'audio' : 'image';
    nodes.push({
      id: assetNodeId('workbench', asset.id),
      type: 'asset',
      source: 'workbench',
      sourceKey: asset.id,
      kind,
      audioKind: subKind,
      previewUrl: version.playbackUrl || version.stableUrl || '',
      // P-B: 已确认素材有 name 优先; voice 走 Voice-XXX, music 走 Track-XXX, 图片走 Enclosure-XXX
      title: String(asset.name || nextShotName(resolveShotPrefix({ kind, subKind }))),
      // W4 音频节点：把 workbench asset + approved version id 透出到节点, 让 footer 按钮可以发起音轨 POST
      sourceAssetId: asset.id,
      sourceAssetVersionId: asset.approvedVersionId || version.id,
    });
  });
  (Array.isArray(workbench?.shots) ? workbench.shots : []).forEach(shot => {
    if (!shot?.id) return;
    // P-B: shot 节点用 Framing-XXX, 有 purpose 时直接使用
    nodes.push({
      id: shotNodeId(shot.id),
      type: 'shot',
      shotId: shot.id,
      position: Number(shot.position ?? 0),
      title: String(shot.purpose || nextShotName('shot')),
    });
    (Array.isArray(shot.candidates) ? shot.candidates : []).forEach(candidate => {
      if (!candidate?.id) return;
      // P-B: candidate 节点用 Overture-XXX (前奏/候选), 任务规范中 6 类齐全
      nodes.push({
        id: candidateNodeId(shot.id, candidate.id),
        type: 'candidate',
        shotId: shot.id,
        sourceKey: candidate.id,
        previewUrl: candidate.playbackUrl || candidate.stableUrl || '',
        selected: shot.selectedCandidateId === candidate.id,
        title: nextShotName('candidate'),
      });
    });
  });
  return nodes;
}

export function defaultCanvasLayout(nodes = []) {
  const positions = {};
  let assetIndex = 0;
  let shotIndex = 0;
  (Array.isArray(nodes) ? nodes : []).forEach(node => {
    if (!node?.id || node.type === 'candidate') return;
    if (node.type === 'asset') {
      positions[node.id] = { x: 32, y: 36 + assetIndex * 152 };
      assetIndex += 1;
    } else if (node.type === 'shot') {
      positions[node.id] = { x: 392, y: 40 + shotIndex * 320 };
      shotIndex += 1;
    }
  });
  const candidateRows = new Map();
  (Array.isArray(nodes) ? nodes : []).forEach(node => {
    if (node?.type !== 'candidate') return;
    const base = positions[shotNodeId(node.shotId)] || { x: 392, y: 40 };
    const row = candidateRows.get(node.shotId) || 0;
    candidateRows.set(node.shotId, row + 1);
    positions[node.id] = {
      x: 712 + Math.floor(row / 2) * 236,
      y: base.y + 216 + (row % 2) * 186,
    };
  });
  return positions;
}



/**
 * V2 P1 1-click 派生: 按 x 坐标排序, y 坐标按行折叠
 * 抄 liblib Alt+Shift+F (V3 调研 §10.1 1-click 自动布局)
 */
export function autoLayoutNodes(nodes, options = {}) {
  if (!Array.isArray(nodes) || nodes.length === 0) return {};
  const { columnWidth = 320, rowHeight = 220, startX = 32, startY = 32, columnsPerRow = 4 } = options;
  const sorted = [...nodes].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const positions = {};
  for (let i = 0; i < sorted.length; i++) {
    const col = i % columnsPerRow;
    const row = Math.floor(i / columnsPerRow);
    positions[sorted[i].id] = { x: startX + col * columnWidth, y: startY + row * rowHeight };
  }
  return positions;
}

export function marqueeSelectAssetNodes(nodes = [], rect = null) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return [];
  return (Array.isArray(nodes) ? nodes : [])
    .filter(node => node?.type === 'asset')
    .filter(node => {
      const size = canvasNodeSize('asset');
      const x = Number(node.x) || 0;
      const y = Number(node.y) || 0;
      return x < rect.x + rect.width && x + size.width > rect.x
        && y < rect.y + rect.height && y + size.height > rect.y;
    })
    .map(node => node.id);
}

export function countSelectionMedia(selection = []) {
  const counts = { image: 0, video: 0, audio: 0 };
  (Array.isArray(selection) ? selection : []).forEach(node => {
    const kind = node?.kind;
    if (kind === 'image' || kind === 'video' || kind === 'audio') counts[kind] += 1;
  });
  return counts;
}

export function allowedGenerationModes(selection = []) {
  const { image, video } = countSelectionMedia(selection);
  return Object.freeze({
    smart: true,
    reference: image + video > 0,
    frame: image >= 2,
    remake: image >= 1 && video >= 1,
  });
}

// 只有「从视频上传带入」的素材节点携带可被生成链引用的 videoAssetId。
export function selectionReferencePayload(selection = []) {
  const images = [];
  const videos = [];
  const audios = [];
  (Array.isArray(selection) ? selection : []).forEach(node => {
    if (!node?.videoAssetId) return;
    if (node.kind === 'image' && images.length < 9) images.push(node.videoAssetId);
    else if (node.kind === 'video' && videos.length < 3) videos.push(node.videoAssetId);
    else if (node.kind === 'audio' && audios.length < 3) audios.push(node.videoAssetId);
  });
  return { images, videos, audios };
}

export function resolveCanvasApiMode(mode, selection = []) {
  const payload = selectionReferencePayload(selection);
  return resolveVideoApiMode(mode, { images: payload.images, videos: payload.videos, audios: payload.audios });
}

export function pointsEstimateRange(product = null) {
  const short = Number(product?.quotes?.short?.points ?? Number.NaN);
  const long = Number(product?.quotes?.long?.points ?? Number.NaN);
  if (Number.isFinite(short) && Number.isFinite(long)) {
    return { minPoints: Math.min(short, long), maxPoints: Math.max(short, long) };
  }
  if (Number.isFinite(short)) return { minPoints: short, maxPoints: short };
  return null;
}

export function planPointsRange(plan = null) {
  const candidates = (Array.isArray(plan?.routeRecommendation?.candidates) ? plan.routeRecommendation.candidates : [])
    .filter(item => item?.eligible && Number.isFinite(Number(item?.estimatedPoints)))
    .map(item => Math.ceil(Number(item.estimatedPoints)));
  const exact = Number(plan?.quote?.points ?? Number.NaN);
  if (candidates.length) {
    const values = Number.isFinite(exact) ? candidates.concat([Math.ceil(exact)]) : candidates;
    return { minPoints: Math.min(...values), maxPoints: Math.max(...values) };
  }
  if (Number.isFinite(exact)) return { minPoints: Math.ceil(exact), maxPoints: Math.ceil(exact) };
  return null;
}

// 审批门：未批准前不产生扣费任务。phase: idle | ready | approved | blocked
export function schemeGate(plan = null) {
  if (!plan || typeof plan !== 'object') return { phase: 'idle', canApprove: false, approvedPlanHash: '' };
  if (plan.status !== 'ready') {
    return { phase: 'blocked', canApprove: false, approvedPlanHash: '', blockers: Array.isArray(plan.blockers) ? plan.blockers : [] };
  }
  const approvalHash = String(plan.approval?.planHash || '');
  const approvedPlanHash = approvalHash && approvalHash === plan.planHash ? approvalHash : '';
  return {
    phase: approvedPlanHash ? 'approved' : 'ready',
    canApprove: !approvedPlanHash,
    approvedPlanHash,
  };
}

export function shotGenerationReadiness(gate, { planningOnly = false } = {}) {
  if (planningOnly) return { ok: false, reason: 'PLANNING 模式只做规划，不产生扣费任务' };
  if (!gate || gate.phase === 'idle') return { ok: false, reason: '请先在左栏检查并批准生成方案' };
  if (gate.phase === 'blocked') return { ok: false, reason: '方案暂不可生成，请先处理左栏阻断项' };
  if (gate.phase !== 'approved' || !gate.approvedPlanHash) {
    return { ok: false, reason: '未批准生成方案前不会创建扣费任务' };
  }
  return { ok: true, reason: '' };
}

// 「产品图N」客观命名语义：迁入左栏素材带入卡。
export function materialNaming(items = []) {
  const counters = { image: 0, video: 0, audio: 0 };
  const prefixes = { image: '产品图', video: '视频', audio: '音频' };
  const badges = { image: '商品图 × 参考图', video: '节奏参考', audio: '声音参考' };
  return (Array.isArray(items) ? items : []).map(item => {
    const kind = counters[item?.kind] !== undefined ? item.kind : 'image';
    counters[kind] += 1;
    return {
      ...item,
      objectiveName: prefixes[kind] + String(counters[kind]),
      badge: badges[kind],
    };
  });
}

const BINDING_ROLE_LABELS = Object.freeze({
  subject: '主体', product: '商品', wardrobe: '服饰', scene: '场景', prop: '道具',
  style: '风格', voice: '声线', music: '音乐', first_frame: '首帧',
  last_frame: '尾帧', motion_reference: '动作参考',
});

export function bindingRoleLabel(role) {
  return BINDING_ROLE_LABELS[role] || '素材';
}

function refEdgeLabel(refKey) {
  return refKey === 'firstFrameRef' ? '首帧链' : '尾帧';
}

// ── W1-TapNow 工具：节点级纯函数（不触碰 provider / 账务） ──────────────
// 计算复制后的摆位偏移，避免覆盖原节点（沿用 TapNow 拖拽复制的体感）。
export const DUPLICATE_OFFSET = Object.freeze({ x: 24, y: 24 });

export function duplicateNodePosition(original = {}) {
  return {
    x: Math.max(0, Number(original.x) || 0) + DUPLICATE_OFFSET.x,
    y: Math.max(0, Number(original.y) || 0) + DUPLICATE_OFFSET.y,
  };
}

// 节点可重命名：asset→title (派生自 asset.name)，shot→title (purpose)，candidate→固定「候选」
// 返回 null 表示该类型不支持重命名。
export function nodeRenameTarget(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.type === 'asset') return { field: 'title', current: String(node.title || ''), kind: 'asset' };
  if (node.type === 'shot') return { field: 'title', current: String(node.title || ''), kind: 'shot' };
  return null;
}

// z-order 调整：返回新的 positions map，只调整目标节点 + 周围节点。
// 这里只调整 zIndex 字段（CSS 用 z-index），不改变 x/y。
export function bringNodeToLayer(currentPositions = {}, targetId, layer) {
  const out = { ...currentPositions };
  const target = out[targetId];
  if (!target) return out;
  if (layer === 'front') {
    out[targetId] = { ...target, zIndex: 10 };
  } else if (layer === 'back') {
    out[targetId] = { ...target, zIndex: 1 };
  }
  return out;
}

// 锁定集合：纯函数化 helper，便于 React state 直接使用。
export function toggleLockedSet(set, id) {
  const next = new Set(set || []);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

export function isLockedInSet(set, id) {
  return Boolean(set && typeof set.has === 'function' && set.has(id));
}

// 连线表达续写与首尾帧关系（P1 仅视觉，逻辑绑定后置）。
export function buildCanvasEdges(workbench = null) {
  const edges = [];
  const shots = (Array.isArray(workbench?.shots) ? [...workbench.shots] : [])
    .sort((left, right) => Number(left?.position ?? 0) - Number(right?.position ?? 0));
  shots.forEach((shot, index) => {
    if (!shot?.id) return;
    if (index > 0 && shots[index - 1]?.id) {
      edges.push({
        id: 'continue:' + shots[index - 1].id + ':' + shot.id,
        from: shotNodeId(shots[index - 1].id),
        to: shotNodeId(shot.id),
        kind: 'continuation',
        label: '续写',
      });
    }
    (Array.isArray(shot.bindings) ? shot.bindings : []).forEach(binding => {
      if (!binding?.assetId) return;
      edges.push({
        id: 'bind:' + shot.id + ':' + binding.assetId + ':' + binding.role,
        from: assetNodeId('workbench', binding.assetId),
        to: shotNodeId(shot.id),
        kind: binding.role === 'first_frame' ? 'first_frame' : binding.role === 'last_frame' ? 'last_frame' : 'binding',
        label: bindingRoleLabel(binding.role),
      });
    });
    ['firstFrameRef', 'lastFrameRef'].forEach(refKey => {
      const ref = shot[refKey];
      if (!ref?.projectAssetId) return;
      edges.push({
        id: 'ref:' + shot.id + ':' + refKey,
        from: '',
        fromProjectAssetId: ref.projectAssetId,
        to: shotNodeId(shot.id),
        kind: refKey === 'firstFrameRef' ? 'first_frame' : 'last_frame',
        label: refEdgeLabel(refKey),
      });
    });
  });
  return edges;
}
