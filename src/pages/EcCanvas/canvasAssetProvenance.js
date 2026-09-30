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

/* ══════════════════════════════════════════════════════════════════════════════
   哪些图能导出 —— 2026-09-30 批 CY-㊴（用户批注：「你为什么说只能导出零张图片呢？」）
   ──────────────────────────────────────────────────────────────────────────────
   事故（用户实测）：点素材功能框最右的下载按钮、或右键「导出」，
   弹窗里写的是「**导出 0 张图片**」，而他**明明已经选中了一张图**。

   根因：这里把 `provenance === 'source'` 的节点**永远**踢出 deliverables，
   不管用户是不是**明确点了它**。于是「选中一张上传的图去导出」这条路
   在数学上恒等于 0 张 —— 用户看到的正是他自己截图里那个弹窗。

   改法：**区分「用户明确选中」与「导出整张画布」两种范围**。
     · 明确选中（selectedIds 非空）⇒ 用户要导的就是他点的那些，原图也导出。
       这是用户本轮的原话：「我明明已经选中这张图片了」。
     · 整张画布（selectedIds 为空）⇒ 继续排除原始素材。
       这一条**保留原语义**（批 CY-⑭ 引入 excludedSources 的初衷）：
       电商套图交付时不能把用户的原图混进交付清单里。

   ⚠️ 视频/音频节点仍不会被导出：它们的 provenance 是 'composition'，不在
   [generated, derived] 里，与本条无关（见 test 里的 composition 断言）。
   ══════════════════════════════════════════════════════════════════════════ */
export function selectDeliverableNodes(nodes = [], selectedIds = new Set()) {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  /* 用户是否**明确点名**了要导出的节点（多选工具条 / 逐图入口都会填这个集合） */
  const explicit = ids.size > 0;
  const candidates = explicit ? nodes.filter(node => ids.has(node.id)) : nodes;
  const deliverables = [];
  const excludedSources = [];
  candidates.forEach(node => {
    const provenance = resolveAssetProvenance(node);
    if (provenance === 'source') {
      if (!readyImage(node)) return;
      /* 明确选中 ⇒ 导出它；整张画布 ⇒ 计入"已排除的原始素材"，不混进交付清单 */
      if (explicit) deliverables.push(node);
      else excludedSources.push(node);
      return;
    }
    if (['generated', 'derived'].includes(provenance) && readyImage(node)) deliverables.push(node);
  });
  return { deliverables, excludedSources };
}
