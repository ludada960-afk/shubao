const PROVENANCE = new Set(['source', 'generated', 'derived', 'composition']);
const SOURCE_ROLES = new Set([
  'product',
  'product_original',
  'reference',
  'style_reference',
  'general_material',
  'source',
]);

function readyImage(node = {}) {
  const status = String(node.status || 'ready').toLowerCase();
  return Boolean(node.url) && ['ready', 'success', 'completed'].includes(status);
}

export function resolveAssetProvenance(node = {}) {
  const explicit = String(node.provenance || node.assetOrigin || '').toLowerCase();
  if (PROVENANCE.has(explicit)) return explicit;
  if (node.kind === 'source_group' || node.isProductSource || SOURCE_ROLES.has(String(node.sourceRole || '').toLowerCase())) return 'source';
  if (node.derivedFromId || node.derivedFromIds?.length || node.sourceNodeIds?.length || node.sourceKey === 'detail_long' || node.role === '详情长图') return 'derived';
  if (node.kind === 'output' || node.generationRunId || node.generationJobId || node.generatedAt) return 'generated';
  if (['text', 'text-composer', 'image-composer', 'suite-composer', 'layer-group'].includes(node.kind)) return 'composition';
  return node.kind === 'image' ? 'source' : 'composition';
}

export function selectDeliverableNodes(nodes = [], selectedIds = new Set()) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const candidates = ids.size ? nodes.filter(node => ids.has(node.id)) : nodes;
  const deliverables = [];
  const excludedSources = [];
  candidates.forEach(node => {
    const provenance = resolveAssetProvenance(node);
    if (provenance === 'source') {
      if (readyImage(node)) excludedSources.push(node);
      return;
    }
    if (['generated', 'derived'].includes(provenance) && readyImage(node)) deliverables.push(node);
  });
  return { deliverables, excludedSources };
}
