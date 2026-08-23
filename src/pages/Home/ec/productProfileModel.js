const VARIANT_FIELDS = ['label', 'color', 'spec', 'size', 'capacity', 'dimLabel'];
const FACT_FIELDS = ['productName', 'category', 'material', 'dimensions', 'baseColor', 'accentColor', 'craft', 'sellingPoints', 'restrictions', 'usage', 'targetAudience'];

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function canonicalAssetRef(image, role) {
  const candidate = image?.projectAssetRef || image?.assetRef || image;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const projectId = text(candidate.projectId);
  const projectAssetId = text(candidate.projectAssetId);
  const expectedContentHash = text(candidate.expectedContentHash || candidate.contentHash);
  if (!projectId || !projectAssetId || !expectedContentHash) return null;
  return { projectId, projectAssetId, role, expectedContentHash };
}

function profileAssetRole(value) {
  const role = text(value);
  if (role === 'reference' || role === 'person' || role === 'scene') return role;
  if (role === 'product' || role === 'generated') return 'product';
  return '';
}

function buildProfileImage(profileAsset, asset) {
  if (!profileAsset || !asset || asset.mediaKind !== 'image') return null;
  const projectId = text(profileAsset.projectId);
  const projectAssetId = text(profileAsset.projectAssetId);
  const expectedContentHash = text(profileAsset.expectedContentHash);
  const stableUrl = text(asset.stableUrl || asset.url);
  if (!projectId || !projectAssetId || !expectedContentHash
    || text(asset.projectAssetId) !== projectAssetId
    || text(asset.contentHash) !== expectedContentHash
    || !stableUrl) return null;
  const role = profileAssetRole(profileAsset.role);
  if (!role) return null;
  return {
    assetId: text(asset.assetId),
    url: stableUrl,
    previewUrl: text(asset.previewUrl || stableUrl),
    displayName: text(asset.metadata?.displayName || asset.assetId || '商品素材'),
    role,
    locked: true,
    projectAssetRef: { projectId, projectAssetId, role, expectedContentHash },
  };
}

function referenceKey(ref) {
  return `${ref.projectId}\u0000${ref.projectAssetId}\u0000${ref.role}\u0000${ref.expectedContentHash}`;
}

function normalizeVariants(skus) {
  if (!Array.isArray(skus)) return [];
  return skus.map(sku => {
    const variant = {};
    VARIANT_FIELDS.forEach(field => {
      variant[field] = text(sku?.[field]);
    });
    const count = Number(sku?.count);
    variant.count = Number.isSafeInteger(count) && count > 0 ? count : 1;
    return variant;
  }).filter(variant => VARIANT_FIELDS.some(field => variant[field]));
}

function profileFacts(editor, name, params, copywriting) {
  const source = {
    productName: name,
    category: params.category,
    material: params.material,
    dimensions: params.size,
    baseColor: params.baseColor,
    accentColor: params.accentColor,
    craft: params.craft,
    sellingPoints: copywriting.sellingPoints,
    restrictions: params.restrictions,
    usage: params.usage,
    targetAudience: params.targetAudience,
    ...(editor.facts && typeof editor.facts === 'object' ? editor.facts : {}),
  };
  return Object.fromEntries(FACT_FIELDS
    .map(field => [field, text(source[field])])
    .filter(([, value]) => value));
}

export function buildProductProfileDraft(editor = {}) {
  const params = editor.productParams && typeof editor.productParams === 'object' ? editor.productParams : {};
  const copywriting = editor.copywriting && typeof editor.copywriting === 'object' ? editor.copywriting : {};
  const name = text(editor.productName || editor.product_name || editor.description) || '未命名商品';
  const assets = [];
  const seen = new Set();
  const addAssets = (items, role) => {
    (Array.isArray(items) ? items : []).forEach(image => {
      const ref = canonicalAssetRef(image, role);
      if (!ref || seen.has(referenceKey(ref))) return;
      seen.add(referenceKey(ref));
      assets.push(ref);
    });
  };
  addAssets(editor.productImages, 'product');
  addAssets(editor.referenceImages, 'reference');
  addAssets(editor.roleImages?.items, 'product');
  addAssets(editor.roleImages?.person, 'person');
  addAssets(editor.roleImages?.scene, 'scene');
  return {
    name,
    category: text(params.category || editor.category),
    facts: profileFacts(editor, name, params, copywriting),
    variants: normalizeVariants(editor.skus),
    assets,
  };
}

export function buildProductProfileMediaState(profile = {}, resolvedAssets = []) {
  const productImages = [];
  const referenceImages = [];
  const roleImages = { items: productImages, person: [], scene: [] };
  const seen = new Set();
  const profileAssets = Array.isArray(profile.assets) ? profile.assets : [];
  const allowed = new Set(profileAssets.map(asset => `${text(asset?.projectId)}\u0000${text(asset?.projectAssetId)}\u0000${text(asset?.expectedContentHash)}`));
  for (const resolved of Array.isArray(resolvedAssets) ? resolvedAssets : []) {
    const profileAsset = resolved?.profileAsset;
    const key = `${text(profileAsset?.projectId)}\u0000${text(profileAsset?.projectAssetId)}\u0000${text(profileAsset?.expectedContentHash)}`;
    if (!allowed.has(key) || seen.has(key)) continue;
    const image = buildProfileImage(profileAsset, resolved?.asset);
    if (!image) continue;
    seen.add(key);
    if (image.role === 'reference') referenceImages.push(image);
    else if (image.role === 'person' || image.role === 'scene') roleImages[image.role].push(image);
    else productImages.push(image);
  }
  return { productImages, referenceImages, roleImages };
}

export function applyProductProfileToEditor(profile = {}, editor = {}) {
  const next = clone(editor) || {};
  const facts = profile.facts && typeof profile.facts === 'object' ? profile.facts : {};
  const currentParams = next.productParams && typeof next.productParams === 'object' ? next.productParams : {};
  next.description = text(profile.name) || next.description || '';
  next.productParams = {
    ...currentParams,
    category: text(profile.category || facts.category),
    material: text(facts.material),
    size: text(facts.dimensions || facts.size),
    baseColor: text(facts.baseColor),
    accentColor: text(facts.accentColor),
    craft: text(facts.craft),
  };
  if (facts.sellingPoints) {
    next.copywriting = { ...(next.copywriting || {}), sellingPoints: text(facts.sellingPoints) };
  }
  next.skus = Array.isArray(profile.variants)
    ? profile.variants.map(variant => {
      const result = {};
      VARIANT_FIELDS.forEach(field => {
        const value = text(variant?.[field]);
        if (value) result[field] = value;
      });
      const count = Number(variant?.count);
      result.count = Number.isSafeInteger(count) && count > 0 ? count : 1;
      return result;
    })
    : [];
  return next;
}

export function productProfileReferenceSnapshot(profile = {}) {
  const assets = Array.isArray(profile.assets) ? profile.assets : [];
  return {
    assets: assets.map(asset => ({
      projectId: text(asset?.projectId),
      projectAssetId: text(asset?.projectAssetId),
      role: text(asset?.role),
      expectedContentHash: text(asset?.expectedContentHash),
    })).filter(asset => asset.projectId && asset.projectAssetId && asset.role && asset.expectedContentHash),
  };
}

export function productProfileSummary(profile = {}) {
  const facts = profile.facts && typeof profile.facts === 'object' ? profile.facts : {};
  const variantCount = Array.isArray(profile.variants) ? profile.variants.length : 0;
  return [text(profile.name), text(profile.category), text(facts.material), text(facts.baseColor), `${variantCount} 个变体`]
    .filter(Boolean).join(' · ');
}
