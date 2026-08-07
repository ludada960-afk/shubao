import { resolveAssetProvenance } from './canvasAssetProvenance.js';

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}
function explicitSequence(node = {}) {
  const value = node.planSequence ?? node.sequence ?? node.shotSequence ?? node.shotIndex ?? node.generationIndex;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

export function isLongDetailCandidate(node = {}) {
  if (!node.url || !['ready', 'success', 'completed'].includes(String(node.status || 'ready').toLowerCase())) return false;
  if (!['generated', 'derived'].includes(resolveAssetProvenance(node))) return false;
  return node.group === '详情图'
    || String(node.sourceKey || '').startsWith('detail_slice_')
    || String(node.role || '').includes('详情');
}

function visualRows(nodes) {
  if (!nodes.length) return [];
  const heights = nodes.map(node => Math.max(1, finite(node.h, 200))).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 200;
  const tolerance = Math.max(24, medianHeight * 0.35);
  const rows = [];
  [...nodes].sort((a, b) => finite(a.y) - finite(b.y) || finite(a.x) - finite(b.x)).forEach(node => {
    const centerY = finite(node.y) + Math.max(1, finite(node.h, medianHeight)) / 2;
    let row = rows.find(candidate => Math.abs(candidate.centerY - centerY) <= tolerance);
    if (!row) {
      row = { centerY, nodes: [] };
      rows.push(row);
    }
    row.nodes.push(node);
    row.centerY = row.nodes.reduce((sum, item) => sum + finite(item.y) + Math.max(1, finite(item.h, medianHeight)) / 2, 0) / row.nodes.length;
  });
  return rows
    .sort((a, b) => a.centerY - b.centerY)
    .flatMap(row => row.nodes.sort((a, b) => finite(a.x) - finite(b.x)));
}

export function orderDetailNodes(nodes = []) {
  const eligible = nodes.filter(isLongDetailCandidate);
  if (eligible.length < 2) return eligible;
  const sequenced = eligible.filter(node => explicitSequence(node) != null);
  if (sequenced.length === eligible.length) {
    return [...eligible].sort((a, b) => explicitSequence(a) - explicitSequence(b));
  }
  if (sequenced.length) {
    const sequenceIds = new Set(sequenced.map(node => node.id));
    return [
      ...sequenced.sort((a, b) => explicitSequence(a) - explicitSequence(b)),
      ...visualRows(eligible.filter(node => !sequenceIds.has(node.id))),
    ];
  }
  return visualRows(eligible);
}

export function moveDetailItem(ids = [], fromIndex, toIndex) {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || toIndex < 0 || fromIndex >= ids.length || toIndex >= ids.length || fromIndex === toIndex) return [...ids];
  const next = [...ids];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}
