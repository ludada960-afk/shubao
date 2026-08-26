import { buildCanvasNodes, defaultCanvasLayout } from './videoCanvasModel.js';

export const FLOW_NODE_TYPES = Object.freeze({
  asset: 'shubaoAsset',
  shot: 'shubaoShot',
  candidate: 'shubaoCandidate',
});

export const EDGE_KINDS = Object.freeze({
  continuation: { stroke: '#64748b', dash: '6 4', label: '续写' },
  binding: { stroke: '#94a3b8', dash: null, label: '绑定' },
  first_frame: { stroke: '#16a34a', dash: null, label: '首帧链' },
  last_frame: { stroke: '#ea580c', dash: null, label: '尾帧链' },
});

function flowNodeType(type) {
  return FLOW_NODE_TYPES[type] || 'shubaoAsset';
}

export function toFlowNodes(domainNodes = []) {
  const nodes = Array.isArray(domainNodes) ? domainNodes : [];
  const layout = defaultCanvasLayout(nodes);
  return nodes.map(node => ({
    id: node.id,
    type: flowNodeType(node.type),
    position: {
      x: Number(layout[node.id]?.x ?? 0),
      y: Number(layout[node.id]?.y ?? 0),
    },
    data: { ...node },
    draggable: true,
    selectable: true,
  }));
}

export function buildFlowNodes(input = {}) {
  return toFlowNodes(buildCanvasNodes(input));
}

export function toFlowEdges(domainEdges = [], knownNodeIds = null) {
  const known = knownNodeIds instanceof Set ? knownNodeIds : new Set(Array.isArray(knownNodeIds) ? knownNodeIds : []);
  return (Array.isArray(domainEdges) ? domainEdges : [])
    .filter(edge => edge && edge.from && edge.to)
    .filter(edge => !known.size || (known.has(edge.from) && known.has(edge.to)))
    .map(edge => {
      const styleSpec = EDGE_KINDS[edge.kind] || EDGE_KINDS.binding;
      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        label: edge.label || styleSpec.label,
        type: 'shubaoEdge',
        data: { kind: edge.kind },
        style: {
          stroke: styleSpec.stroke,
          strokeWidth: 1.7,
          ...(styleSpec.dash ? { strokeDasharray: styleSpec.dash } : {}),
        },
        labelStyle: { fontSize: 11, fill: '#475569' },
      };
    });
}

export function canvasIsValidConnection(connection, context = {}) {
  if (!connection || !connection.source || !connection.target) return false;
  if (connection.source === connection.target) return false;
  const nodes = Array.isArray(context.nodes) ? context.nodes : [];
  const byId = new Map(nodes.map(node => [node.id, node]));
  const sourceNode = byId.get(connection.source);
  const targetNode = byId.get(connection.target);
  if (!sourceNode || !targetNode) return false;
  const sourceType = sourceNode.data?.type || '';
  const targetType = targetNode.data?.type || '';
  if (sourceType === 'candidate') return false;
  if (targetType === 'candidate') return false;
  if (sourceType === 'asset' && targetType === 'shot') return true;
  if (sourceType === 'shot' && targetType === 'shot') return true;
  if (sourceType === 'asset' && targetType === 'asset') return false;
  return false;
}
