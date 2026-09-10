/* ═══════ P2 · 工作流模板（一键铺开）前端模块 ═══════
   后端真源: server/templates/workflowTemplateRoutes.mjs（列表/实例化/点赞/自建）。
   本模块 = 纯 fetch 封装 + 纯函数（连线@引用合一的执行输入收集、
   无图回退的旧并集口径、@菜单与入边的双向同步、槽位/P3 标记）。

   硬约束（改这个文件前先读）:
   - collectRunInputs 只读图边（P0 collectNodeInputsFromEdges 语义: 入边顺序 = @图片N 编号）;
   - legacyComposerSourceIds 是 index.jsx 旧并集逻辑逐字切出的纯函数 ——
     无入边节点的回退必须与它逐字节一致（P0 无图契约的回归护栏）;
   - 不变式①: 铺开本身不收费（instantiate 只让服务端 usage+1），扣费只发生在 P1 节点执行层;
   - 不变式③: pricing.estimatedUnits 仅展示预估，结算以 P1 计费 catalog 报价为准。*/

import { getSessionToken } from '../../services/auth.js';
import { createApiError } from '../../services/apiError.js';
import { collectNodeInputsFromEdges } from './canvasGraphInputs.js';

/* 与 src/services/projects.js 同口径的 /api fetch: 相对路径 + Bearer 会话头 + 结构化错误。*/
async function requestJson(path, options = {}, fallbackMessage) {
  const token = getSessionToken();
  const response = await fetch(path, {
    ...options,
    headers: token ? { ...options.headers, Authorization: 'Bearer ' + token } : options.headers,
  });
  if (!response.ok) throw await createApiError(response, fallbackMessage);
  return response.json();
}

/* GET /api/workflow-templates?public=&category=&mine=
   返回 { templateId, slug, name, category, description, authorEmail, isBuiltIn, isPublic,
          graph:{nodes,connections}, pricing:{estimatedUnits,note}, requiresAudioVideo,
          usageCount, likeCount, ... } 列表。匿名只拉公开模板（服务端口径）。*/
export async function fetchWorkflowTemplates(options = {}) {
  /* 参数键: { public?: boolean|'0'|'1', category?, mine? } —— 键名可写 public（属性名合法），
     但形参不能直接解构出 public（strict mode 保留字）, 故整包接收。*/
  const publicFlag = options.public;
  const category = options.category;
  const mine = options.mine;
  const params = new URLSearchParams();
  if (mine) params.set('mine', String(mine).trim());
  else if (publicFlag === false || publicFlag === '0' || publicFlag === 0) params.set('public', '0');
  if (category) params.set('category', String(category).trim());
  const suffix = params.toString() ? '?' + params.toString() : '';
  const response = await requestJson('/api/workflow-templates' + suffix, {}, '暂时无法读取工作流模板');
  return Array.isArray(response?.templates) ? response.templates : [];
}

/* POST /api/workflow-templates/:slug/instantiate
   服务端 usage+1（真数口径）并返回可直接喂 createCanvasSnapshot 的 snapshot
   （{nodes, connections, viewport}）。模板本身 0 收费；本调用不做任何计费动作。*/
export async function instantiateWorkflowTemplate(slug) {
  const normalized = String(slug || '').trim();
  if (!normalized) throw new Error('请选择有效的工作流模板');
  const response = await requestJson('/api/workflow-templates/' + encodeURIComponent(normalized) + '/instantiate', { method: 'POST' }, '暂时无法铺开工作流模板');
  if (!response?.ok || !response?.snapshot?.nodes) throw new Error('模板图结构暂时不可用，请稍后重试');
  return {
    ...response,
    snapshot: {
      nodes: Array.isArray(response.snapshot.nodes) ? response.snapshot.nodes : [],
      connections: Array.isArray(response.snapshot.connections) ? response.snapshot.connections : [],
      viewport: response.snapshot.viewport || { x: 80, y: 40, scale: 1 },
    },
  };
}

/* POST /api/workflow-templates/:slug/like —— INSERT OR IGNORE 幂等（双击不重复计数），
   返回操作后的持有状态 { liked, likeCount }。*/
export async function likeWorkflowTemplate(slug) {
  const normalized = String(slug || '').trim();
  if (!normalized) throw new Error('请选择有效的工作流模板');
  const response = await requestJson('/api/workflow-templates/' + encodeURIComponent(normalized) + '/like', { method: 'POST' }, '暂时无法更新点赞');
  if (!response?.ok) throw new Error('点赞状态暂时不可用，请稍后重试');
  return { liked: response.liked === true, likeCount: Number(response.likeCount) || 0 };
}

/* ── 连线 ↔ @引用 合一（spec §3.5.2.1: 图 = 唯一真源）── */

/* 纯函数: 只读图边收集某节点的全部执行输入（P0 语义: 入边顺序 = @图片1/@图片2 编号顺序）。
   入参 nodeId 可为节点对象或字符串; 无入边时返回全空结构（sources = []），
   调用方据此回退 legacyComposerSourceIds —— 老图行为逐字节不变。*/
export function collectRunInputs(nodeId, connections, nodes) {
  return collectNodeInputsFromEdges(nodeId, connections, nodes);
}

/* 旧请求组装的并集逻辑（index.jsx 三处现场同款）逐字切出的纯函数。
   回归护栏: 无入边节点必须回退到它, 保证与 P2 改动前逐字节一致。*/
export function legacyComposerSourceIds(composer = {}) {
  return [...new Set([...(composer.sourceNodeIds || []), ...(composer.mentionSourceNodeIds || [])])];
}

/* @菜单双向同步: 拉了一条线 -> 该上游自动进 @ 菜单（入边顺序在后、与自身 mention 去重）。
   返回有序上游 id 列表（自身 mentionSourceNodeIds 优先, 入边补位）。*/
export function mergeGraphMentionSources(node, connections = []) {
  const selfId = String(node?.id ?? '').trim();
  const ids = [...new Set(
    (Array.isArray(node?.mentionSourceNodeIds) ? node.mentionSourceNodeIds : [])
      .map(id => String(id ?? '').trim()).filter(Boolean),
  )];
  for (const edge of Array.isArray(connections) ? connections : []) {
    const toId = String(edge?.toNodeId || edge?.to || '').trim();
    const fromId = String(edge?.fromNodeId || edge?.from || '').trim();
    if (toId !== selfId || !fromId || fromId === toId) continue;
    if (!ids.includes(fromId)) ids.push(fromId);
  }
  return ids;
}

/* 模板预置素材节点 = 铺开后可用「替换」一键换成自己素材的节点（用户 9-10: 替换按钮必须有）。
   数据真源: 模板的 templatePlaceholder 标记（旧模板的 isSlot/slot 兼容保留）。
   注意: 占位素材自带 url（铺开即与真实上传物一致），所以不再以空 url 判定。*/
export function workflowSlotIds(nodes = []) {
  return (Array.isArray(nodes) ? nodes : [])
    .filter(node => node?.templatePlaceholder === true || node?.isSlot === true || node?.slot === true)
    .map(node => String(node?.id ?? ''))
    .filter(Boolean);
}

/* T4/T5（requiresAudioVideo）的 P3 音视频 kind 诚实门控（不变式①: 不 mock、不发起扣费运行）。
   返回加了 p3Pending 标记的节点副本（不改入参）: 画布渲染灰态"待 P3"。
   只对 requiresAudioVideo 模板生效 —— T1/T3 的 text/splice 不算 P3 门控。*/
export const P3_MEDIA_KINDS = Object.freeze(new Set(['video', 'audio']));
export const P3_ACTION_IDS = Object.freeze(new Set(['video-composer', 'storyboard', 'tts', 'lip-sync']));
export function markP3PendingNodes(nodes = [], requiresAudioVideo = false) {
  if (!requiresAudioVideo) return Array.isArray(nodes) ? nodes : [];
  return (Array.isArray(nodes) ? nodes : []).map(node => {
    if (!node || typeof node !== 'object' || node.p3Pending) return node;
    const kind = String(node.kind || '');
    const actionId = String(node.actionId || '');
    if (P3_MEDIA_KINDS.has(kind) || P3_ACTION_IDS.has(actionId)) return { ...node, p3Pending: true };
    return node;
  });
}
