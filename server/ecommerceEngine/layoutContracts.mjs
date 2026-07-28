function cleanString(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function roleTemplate(item) {
  const role = cleanString(item?.role);
  const type = cleanString(item?.shotIntent?.type);
  if (role === 'white_background' || role === 'transparent') return 'marketplace-isolation';
  if (/parameter|sku/.test(role)) return 'verified-fact-grid';
  if (type === 'usage_scale') return 'usage-context';
  if (type === 'material_macro') return 'macro-evidence';
  if (type === 'component_relationship' || type === 'open_state' || type === 'exploded_view') return 'component-evidence';
  if (['main', 'main_text', 'main_3x4'].includes(role)) return 'product-hero-copy-safe';
  return 'single-benefit-detail';
}

function textRegionsFor(template) {
  if (template === 'marketplace-isolation') return [];
  if (template === 'verified-fact-grid') {
    return [{ id: 'fact-grid', x: 0.08, y: 0.62, width: 0.84, height: 0.28, priority: 7, maxLines: 4 }];
  }
  if (template === 'usage-context') {
    return [{ id: 'supporting-copy', x: 0.06, y: 0.08, width: 0.42, height: 0.2, priority: 5, maxLines: 2 }];
  }
  if (template === 'macro-evidence') {
    return [{ id: 'evidence-label', x: 0.08, y: 0.76, width: 0.48, height: 0.14, priority: 5, maxLines: 2 }];
  }
  if (template === 'component-evidence') {
    return [{ id: 'component-label', x: 0.58, y: 0.1, width: 0.34, height: 0.18, priority: 5, maxLines: 2 }];
  }
  if (template === 'product-hero-copy-safe') {
    return [{ id: 'hero-copy', x: 0.06, y: 0.08, width: 0.38, height: 0.24, priority: 6, maxLines: 2 }];
  }
  return [{ id: 'benefit-copy', x: 0.08, y: 0.72, width: 0.84, height: 0.18, priority: 5, maxLines: 2 }];
}

function productRegionFor(template) {
  if (template === 'usage-context') return { x: 0.5, y: 0.12, width: 0.44, height: 0.78, priority: 10 };
  if (template === 'macro-evidence') return { x: 0.05, y: 0.05, width: 0.9, height: 0.63, priority: 10 };
  if (template === 'component-evidence') return { x: 0.06, y: 0.12, width: 0.5, height: 0.76, priority: 10 };
  if (template === 'verified-fact-grid') return { x: 0.12, y: 0.08, width: 0.76, height: 0.46, priority: 10 };
  if (template === 'product-hero-copy-safe') return { x: 0.44, y: 0.12, width: 0.5, height: 0.74, priority: 10 };
  if (template === 'single-benefit-detail') return { x: 0.12, y: 0.08, width: 0.76, height: 0.56, priority: 10 };
  return { x: 0.12, y: 0.12, width: 0.76, height: 0.76, priority: 10 };
}

function isUnitRegion(region) {
  return region
    && [region.x, region.y, region.width, region.height].every(Number.isFinite)
    && region.x >= 0
    && region.y >= 0
    && region.width > 0
    && region.height > 0
    && region.x + region.width <= 1
    && region.y + region.height <= 1;
}

export function layoutRegionsOverlap(left, right) {
  if (!isUnitRegion(left) || !isUnitRegion(right)) return true;
  const overlapWidth = Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x);
  const overlapHeight = Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y);
  return overlapWidth > 0 && overlapHeight > 0;
}

export function validateLayoutContract(contract) {
  if (!contract || !isUnitRegion(contract.productRegion) || !Array.isArray(contract.textRegions)) return false;
  return contract.textRegions.every(region => (
    isUnitRegion(region) && !layoutRegionsOverlap(contract.productRegion, region)
  ));
}

export function layoutContractFor(item = {}, { platform = '淘宝' } = {}) {
  const template = roleTemplate(item);
  const textRegions = textRegionsFor(template);
  const productRegion = productRegionFor(template);

  const contract = {
    template,
    platform,
    productRegion,
    textRegions,
    maxMarketingTextBlocks: textRegions.length ? Math.min(2, textRegions.length) : 0,
    productOcclusionPolicy: 'No text, badge, prop, or crop may cover a protected product feature.',
    compositionPolicy: 'One product story and one visual hierarchy; never a collage or multi-panel contact sheet.',
  };
  if (!validateLayoutContract(contract)) throw new Error(`invalid overlapping layout contract: ${template}`);
  return contract;
}

export function textLayerPlanFor(item = {}, context = {}) {
  const layout = context.layoutContract || layoutContractFor(item, context);
  const regions = layout.textRegions.map(region => ({ ...region }));
  return {
    mode: regions.length ? 'planned_text_regions' : 'none',
    editableLayersAvailable: false,
    requiresComposition: regions.length > 0,
    exactTextOnly: true,
    renderMarketingTextInImageModel: false,
    regions,
    typographySystem: context.typographySystem || null,
  };
}
