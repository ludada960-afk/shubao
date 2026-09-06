/* P0-1 派生即执行 (master-plan §4, 9-06): "生成文案"动作的纯函数层。
   点完派生菜单即自动带源素材发起文案请求, 不再让用户手动填 prompt。
   P0-2: "生成视频"composer 的 prompt 自动引用上游文案节点 (若链条里有)。
   只放纯函数, 副作用 (fetch/setState) 留在 index.jsx, 保证可被 node:test 覆盖。 */

/* 默认卖点文案指令: 无用户输入时也足够产出可用的电商文案。 */
export const CANVAS_COPYWRITING_PROMPT = '请根据参考商品图提炼电商卖点文案：突出商品核心卖点、使用场景与目标人群，写成一段可直接放进详情页头部的种草文案，120 字以内，不要使用分点符号。';

/* 沿派生连线向上 (to -> from) 找最近的可用文案节点。
   只认 kind==='text' 且 status==='ready' 且 text 非空:
   running/error 的文案节点是 P0-1 自动执行的中间态, 不能当上游输入 (防时序污染)。 */
export function findUpstreamCanvasCopy({ nodes = [], connections = [], nodeId, maxDepth = 8 } = {}) {
  const nodeById = new Map(nodes.filter(node => node?.id).map(node => [String(node.id), node]));
  const seen = new Set([String(nodeId || '')]);
  let frontier = [String(nodeId || '')];
  for (let depth = 0; depth < maxDepth && frontier.length; depth += 1) {
    const next = [];
    for (const current of frontier) {
      for (const connection of connections) {
        const fromId = String(connection?.fromNodeId || connection?.from || '');
        const toId = String(connection?.toNodeId || connection?.to || '');
        if (toId !== current || !fromId || seen.has(fromId)) continue;
        seen.add(fromId);
        const node = nodeById.get(fromId);
        if (node?.kind === 'text' && node?.status === 'ready' && String(node.text || '').trim()) {
          return { nodeId: fromId, text: String(node.text).trim() };
        }
        next.push(fromId);
      }
    }
    frontier = next;
  }
  return null;
}

/* 组装 /api/canvas/regenerate-text 请求参数。
   图/视频源: url 进 referenceImages; 文本源: 内容拼进 prompt; direction 策划有则拼入。 */
export function buildCanvasCopywritingRequest({ source } = {}) {
  const promptParts = [CANVAS_COPYWRITING_PROMPT];
  const referenceImages = [];
  const sourceUrl = String(source?.url || '').trim();
  if (sourceUrl) referenceImages.push(sourceUrl);
  const sourceText = String(source?.text || '').trim();
  if (sourceText) promptParts.push(`参考已有文案基调：\n${sourceText}`);
  const direction = source?.direction;
  if (direction) {
    const directionText = [direction.purpose, direction.composition, direction.copy]
      .map(part => String(part || '').trim())
      .filter(Boolean)
      .join('；');
    if (directionText) promptParts.push(`画面策划参考：${directionText}`);
  }
  return { prompt: promptParts.filter(Boolean).join('\n'), referenceImages, references: [] };
}

/* /api/canvas/regenerate-text 返回 { text } (api.js 已校验非空, 这里再兜底一次)。 */
export function normalizeCanvasCopywritingResult(data) {
  const text = String(data?.text || '').trim();
  if (!text) {
    const error = new Error(data?.error || '文案生成失败');
    throw error;
  }
  return text;
}

/* P0-2: 视频 composer 的 prompt 来源 = 最近上游文案; 没有就返回 '' (composer 保持默认)。 */
export function resolveDerivedVideoPrompt({ nodes, connections, sourceNodeId } = {}) {
  const upstream = findUpstreamCanvasCopy({ nodes, connections, nodeId: sourceNodeId });
  return upstream ? upstream.text : '';
}
