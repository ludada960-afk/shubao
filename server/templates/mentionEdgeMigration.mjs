// server/templates/mentionEdgeMigration.mjs
// P2 连线 ↔ @引用 合一（spec §3.5.2.1 后端半边）— 把老文档的 mentionSourceNodeIds 补成图边。
//
// 目标：图（nodes + connections）成为唯一真源，请求组装只读边，不再读 mention 数组并集。
//
// 口径：
//   - 纯函数 + 幂等：不改入参（返回新数组/新节点对象）；二次运行 connections 逐字节不变。
//   - 每个 node.mentionSourceNodeIds 里的 id：
//       空串 / 非字符串 / 指向自身 -> 丢弃（永不可能成为边）；
//       指向图内已知节点 -> 补一条 {fromNodeId: id, toNodeId: node.id, relation: 'reference'}
//         （同 from->to 去重：已有边则不补）；补成边后该 id 从 mention 数组剔除（图=唯一真源）；
//       指向未知 id（旧文档里已删节点）-> 暂留在 mention 数组里（延后：该节点若日后回来再补边），不造死边。
//   - 既有 connections 原样保留（浅拷贝 + 端点归一 fromNodeId/toNodeId），但同 from->to 只留一条
//     （spec §5“双 from->to 只一条”；P1 collectGraphEdges 同口径）。
//
// 不变式 ②：迁移纯增量 + 幂等，只“补边/去重”，不破坏既有文档的节点与边数据（旧文档读路径随时可调用）。

function nodeRefId(node) {
  if (node == null) return '';
  if (typeof node === 'string') return node.trim();
  return node.id == null ? '' : String(node.id).trim();
}

function edgeEnds(connection) {
  if (!connection || typeof connection !== 'object') return null;
  const fromId = String(connection.fromNodeId || connection.from || '').trim();
  const toId = String(connection.toNodeId || connection.to || '').trim();
  if (!fromId || !toId) return null;
  return { fromId, toId };
}

function edgeKey(fromId, toId) {
  return fromId + '\u0000' + toId;
}

export function migrateMentionsToEdges(nodes = [], connections = []) {
  const inputNodes = Array.isArray(nodes) ? nodes : [];
  const inputConnections = Array.isArray(connections) ? connections : [];
  const knownIds = new Set(inputNodes.map(nodeRefId).filter(Boolean));

  /* 1) 既有边：端点归一 + 同 from->to 去重（保留首个，P1 collectGraphEdges 口径）。 */
  const seen = new Set();
  const merged = [];
  for (const connection of inputConnections) {
    const ends = edgeEnds(connection);
    if (!ends) continue;
    const key = edgeKey(ends.fromId, ends.toId);
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...connection, fromNodeId: ends.fromId, toNodeId: ends.toId, relation: connection.relation || 'reference' });
  }

  /* 2) mention 补边（幂等核心：已存在的 from->to 不重复补）。 */
  let added = 0;
  const outNodes = inputNodes.map(node => {
    const mentions = Array.isArray(node?.mentionSourceNodeIds) ? node.mentionSourceNodeIds : null;
    if (!mentions) return node; // 无 mention 字段：原样（不改入参）
    const targetId = nodeRefId(node);
    if (!targetId) return node;
    const kept = [];
    for (const raw of mentions) {
      const sourceId = typeof raw === 'string' ? raw.trim() : '';
      if (!sourceId || sourceId === targetId) continue;        // 空 / 自引用：丢弃
      if (!knownIds.has(sourceId)) { if (!kept.includes(sourceId)) kept.push(sourceId); continue; } // 未知目标：延后（去重），不造死边
      const key = edgeKey(sourceId, targetId);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({ fromNodeId: sourceId, toNodeId: targetId, relation: 'reference' });
        added += 1;
      }
      // 已补边 / 已有边：该 mention 已被图表达 -> 剔除（图 = 唯一真源）
    }
    if (kept.length) return { ...node, mentionSourceNodeIds: kept };
    const { mentionSourceNodeIds: _dropped, ...rest } = node;
    return rest;
  });

  return { nodes: outNodes, connections: merged, added };
}
