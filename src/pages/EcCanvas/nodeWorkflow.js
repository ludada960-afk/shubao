import { getCanvasAction, canCreateWorkflowFromNode } from './canvasActionRegistry.js';
import { getNodePortCenter } from './canvasGeometry.js';

const ACTION_SIZES = {
  'smart-remix': { w: 380, h: 560 },
  'layer-workbench': { w: 380, h: 420 },
  inpaint: { w: 320, h: 260 },
  'remove-bg': { w: 320, h: 220 },
  extend: { w: 320, h: 220 },
  translate: { w: 320, h: 240 },
  upscale: { w: 320, h: 220 },
};

function makeId(prefix) {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}_${uuid}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getActionById(actionId) {
  return getCanvasAction(actionId);
}

export function isDerivedAction(actionId) {
  return Boolean(getCanvasAction(actionId)?.execute?.nodeKind);
}

export function canDeriveFromNode(input = {}) {
  return canCreateWorkflowFromNode(normalizeCanvasNode(input));
}

export function getConnectionLabel(input = {}) {
  if (input.relation === 'derived' || input.type === 'derived') {
    return getActionById(input.actionId)?.label || '派生处理';
  }
  if (input.relation === 'reference' || input.type === 'reference') return '引用素材';
  return input.label || '素材关系';
}

export function shouldShowQuickCanvasAction(actionId) {
  return false;
}

export function validateWorkflowActionInputs(actionId, inputs = {}) {
  const action = getCanvasAction(actionId);
  const requirements = action?.execute?.requires || {};
  const missing = Object.entries(requirements)
    .filter(([, required]) => required)
    .map(([key]) => key)
    .filter(key => {
      const value = inputs?.[key];
      return typeof value === 'string' ? !value.trim() : value == null;
    });
  return { ok: missing.length === 0, missing };
}

/* 9-17 用户批注（图5/图9）：「我上传一个素材上来，你右边的这个功能栏总是会覆盖到上面来」。
   实测（Playwright，登录态 + 真上传，1440×900）：右侧功能栏本身**是对的**
   （面板左缘 = 画布右缘 + 14px，被面板压住的节点数 0），真正盖住节点的是**这个浮层**：
   上传后自动弹出的「引用当前素材生成」菜单落在锚点右侧、又没有约束画布右缘，
   面板 360×308 @ (588,145) 压住了 4 个节点。用户把这块浮层当成了「右边功能栏」。
   修法：给浮层加四条硬约束 ——
     ① 右缘不许越过「画布可视区右缘 - 12px」（画布打开右侧功能栏时自动让位，所以这条同时
        保证浮层与功能栏互不重叠）；
     ② 水平优先落在锚点右侧，右侧空间不够就翻到锚点左侧（仍然贴着锚点，不歪）；
     ③ 竖直方向在可视区内回夹；
     ④ 高/宽都不许超出可视区。
   浮层是「往上弹」的（CSS translate(-50%, -100%)），所以 y 传的是**面板底边**。 */
/* 右侧功能栏的让位宽度口径 —— 唯一真源。
   CSS 里 .ec-canvas-page{--canvas-right-panel-width:360px} + .ec-canvas-stage.has-right-panel
   {margin-right: calc(var + 28px)} 已经决定了「面板宽 360 + 两侧边距 28」。
   这里把它也暴露给 JS（浮层避让要用同一个数），避免两处各写一份、以后改一处漏一处。 */
export const CANVAS_RIGHT_PANEL_WIDTH_PX = 360;
export const CANVAS_RIGHT_PANEL_MARGIN_PX = 28;
export const CANVAS_RIGHT_PANEL_RESERVED_PX = CANVAS_RIGHT_PANEL_WIDTH_PX + CANVAS_RIGHT_PANEL_MARGIN_PX;

function overlapArea(rect, box) {
  const width = Math.max(0, Math.min(rect.x + rect.w, box.x + box.w) - Math.max(rect.x, box.x));
  const height = Math.max(0, Math.min(rect.y + rect.h, box.y + box.h) - Math.max(rect.y, box.y));
  return width * height;
}

export function clampCanvasPickerPosition({ world = {}, viewport = {}, bounds = {}, preferredWidth = 360, preferredHeight = 460, anchor = 'corner', nodes = [], gap = 18, reservedRight = 0 } = {}) {
  const scale = Number.isFinite(viewport.scale) && viewport.scale > 0 ? viewport.scale : 1;
  const viewportX = Number.isFinite(viewport.x) ? viewport.x : 0;
  const viewportY = Number.isFinite(viewport.y) ? viewport.y : 0;
  const boundsWidth = Number.isFinite(bounds.width) && bounds.width > 0 ? bounds.width : preferredWidth * scale;
  const boundsHeight = Number.isFinite(bounds.height) && bounds.height > 0 ? bounds.height : preferredHeight * scale;
  const gutter = 10 / scale;
  /* 硬右界：画布可视区右缘再让开 reservedRight（打开右侧功能栏时 = 面板宽 + 两侧边距）。
     浮层与功能栏因此永远不重叠，也不会越过画布右缘画到功能栏上面去。 */
  const reservedWorld = Math.max(0, Number(reservedRight) || 0) / scale;
  /* 没有让位需求时，宽度口径必须与历史完全一致（bounds/scale - gutter*2）——
     下面只在**确实要避让**时才把可用宽度收紧，避免影响其它调用方与既有契约。 */
  const usableWidth = reservedWorld > 0
    ? Math.max(180 * scale, boundsWidth - reservedWorld - gutter * 2 * scale)
    : boundsWidth;
  const width = Math.min(preferredWidth, Math.max(180, usableWidth / scale - gutter * 2));
  const height = Math.min(preferredHeight, Math.max(240, boundsHeight / scale - gutter * 2));
  const minX = (0 - viewportX) / scale + gutter;
  const minY = (0 - viewportY) / scale + gutter;
  const maxRight = (usableWidth - viewportX) / scale;
  const maxX = Math.max(minX, maxRight - width - gutter);
  const maxY = Math.max(minY, (boundsHeight - viewportY) / scale - height - gutter);
  const anchorX = Number.isFinite(world.x) ? world.x : minX;
  const anchorY = Number.isFinite(world.y) ? world.y : minY;
  if (anchor === 'above') {
    /* 只做「上方有没有空间」的粗判：真实高度由组件渲染后复测（放不下会自动翻到下方，仍然居中），
        所以这里门槛放到最小可视高度，避免把「居中在按钮上方」这条规则直接跳过。 */
    const minimumAbove = Math.min(height, 120);
    if (anchorY - minY >= minimumAbove) {
      /* ① 先试「锚点正上方 + 水平居中于锚点」（9-13 口径，只有一个节点在附近时就是它） */
      const centered = Math.min(maxX + width / 2, Math.max(minX + width / 2, anchorX));
      /* ② 上方放得下但会压住已有节点 → 仍然居中，把整体上抬到被压节点之上 */
      const list = Array.isArray(nodes) ? nodes.filter(item => item && item.hidden !== true) : [];
      if (list.length) {
        const top = anchorY - height;
        const probe = { x: centered - width / 2, y: top, w: width, h: height };
        const blockers = list.filter(item => overlapArea(probe, { x: item.x, y: item.y, w: item.w, h: item.h }) > 0);
        if (blockers.length) {
          const ceiling = Math.min(...blockers.map(item => item.y)) - gap;
          const lifted = Math.max(minY, ceiling - height);
          const clear = { x: centered - width / 2, y: lifted, w: width, h: height };
          const stillBlocked = list.some(item => overlapArea(clear, { x: item.x, y: item.y, w: item.w, h: item.h }) > 0);
          if (!stillBlocked) return { x: centered, y: lifted + height, width, maxHeight: height, placement: 'above' };
        }
      }
      return { x: centered, y: anchorY, width, maxHeight: height, placement: 'above' };
    }
  }
  return {
    x: Math.min(maxX, Math.max(minX, anchorX)),
    y: Math.min(maxY, Math.max(minY, anchorY)),
    width,
    maxHeight: height,
  };
}

export function getCanvasPortCenter(node = {}, port = 'output') {
  const normalized = normalizeCanvasNode(node);
  return getNodePortCenter(normalized, port);
}

export function normalizeCanvasNode(input = {}) {
  const node = { ...input };
  const kind = input.kind || (input.nodeKind ? input.nodeKind : 'image');
  const isImage = kind === 'image';
  return {
    ...node,
    kind,
    status: input.status || (isImage ? 'ready' : 'draft'),
    sourceNodeIds: Array.isArray(input.sourceNodeIds) ? [...input.sourceNodeIds] : [],
    actionId: input.actionId || null,
    inputs: input.inputs && typeof input.inputs === 'object' ? { ...input.inputs } : {},
    output: input.output ?? null,
    editable: input.editable !== false,
    x: Number.isFinite(input.x) ? input.x : 0,
    y: Number.isFinite(input.y) ? input.y : 0,
    w: Number.isFinite(input.w) ? input.w : (isImage ? 200 : 320),
    h: Number.isFinite(input.h) ? input.h : (isImage ? 200 : 220),
  };
}

export function normalizeCanvasConnection(input = {}) {
  const fromNodeId = input.fromNodeId || input.from || '';
  const toNodeId = input.toNodeId || input.to || '';
  const relation = input.relation || input.type || 'reference';
  const fromPort = input.fromPort || 'output';
  const toPort = input.toPort || 'input';
  const id = input.id || `edge_${fromNodeId}_${toNodeId}_${relation}`;
  return {
    ...input,
    id,
    fromNodeId,
    fromPort,
    toNodeId,
    toPort,
    relation,
    from: input.from || fromNodeId,
    to: input.to || toNodeId,
    type: input.type || relation,
  };
}

export function createDerivedNode({ sourceNodeIds = [], actionId, x = 0, y = 0, inputs = {}, id, imageWatermark, videoWatermark } = {}) {
  const action = getActionById(actionId);
  if (!action) throw new Error(`Unknown canvas action: ${actionId}`);
  const size = ACTION_SIZES[action.execute.nodeKind] || ACTION_SIZES['remove-bg'];
  return normalizeCanvasNode({
    id: id || makeId('node'),
    kind: action.execute.nodeKind,
    status: 'draft',
    actionId: action.execute?.nodeActionId || action.id,
    sourceNodeIds: [...sourceNodeIds],
    inputs: { ...inputs },
    output: null,
    x,
    y,
    w: size.w,
    h: size.h,
    title: action.label,
    description: action.description,
    ...(imageWatermark ? { imageWatermark: structuredClone(imageWatermark) } : {}),
    ...(videoWatermark ? { videoWatermark: structuredClone(videoWatermark) } : {}),
  });
}

export function createChildConnection(fromNodeId, toNodeId, actionId = 'derived') {
  return normalizeCanvasConnection({
    id: makeId('edge'),
    fromNodeId,
    fromPort: 'output',
    toNodeId,
    toPort: 'input',
    relation: 'derived',
    actionId,
  });
}
