const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export const MAX_DETAIL_DUTY_COUNT = 10;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function own(record, key) {
  return isRecord(record) && Object.hasOwn(record, key) ? record[key] : undefined;
}

function cleanString(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function factKey(value) {
  return cleanString(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, '');
}

function aliasSet(values) {
  return new Set(values.map(factKey).filter(Boolean));
}

const FACT_TYPE_ALIASES = Object.freeze({
  parameters: aliasSet([
    'ports', 'portCount', 'technicalSpecification', 'technicalSpecifications',
    'voltage', 'power', 'wattage', 'memory', 'storageCapacity', 'specification', 'specifications',
  ]),
  compatibility: aliasSet([
    'compatibility', 'compatibleDevice', 'compatibleDevices', 'supportedDevice',
    'supportedDevices', 'supportedPlatform', 'supportedPlatforms', 'connectorType',
    'interfaceType', 'operatingSystem',
  ]),
  shade: aliasSet([
    'color', 'colour', 'shade', 'shadeName', 'colorName', 'colourName',
    'variant', 'variantName', 'colorVariant',
  ]),
  fit: aliasSet([
    'fit', 'fitType', 'sizeRange', 'ageRange', 'petSize',
    'bodySize', 'wearingSize',
  ]),
  quantity: aliasSet([
    'quantity', 'count', 'netWeight', 'netVolume', 'packageCount',
    'pieceCount', 'servings', 'volume', 'capacity',
  ]),
  scale: aliasSet([
    'dimensions', 'dimension', 'width', 'height', 'depth', 'diameter',
    'length', 'footprint', 'clearance',
  ]),
  care: aliasSet([
    'care', 'careInstructions', 'cleaning', 'cleaningInstructions',
    'washingInstructions', 'washInstructions', 'storageInstructions', 'maintenance',
  ]),
  flavor: aliasSet([
    'flavor', 'flavour', 'taste', 'flavorVariant', 'flavourVariant',
  ]),
  identifier: aliasSet([
    'model', 'modelName', 'modelNumber', 'sku', 'skuLabel', 'productCode',
    'itemNumber', 'identifier', 'productIdentifier',
  ]),
});

const ROLE_POLICIES = Object.freeze({
  parameters: Object.freeze({ semanticFamily: 'technical_parameters', evidenceType: 'parameters' }),
  compatibility: Object.freeze({ semanticFamily: 'product_compatibility', evidenceType: 'compatibility' }),
  shade: Object.freeze({ semanticFamily: 'color_variant', evidenceType: 'shade' }),
  color_variant: Object.freeze({ semanticFamily: 'color_variant', evidenceType: 'shade' }),
  fit: Object.freeze({ semanticFamily: 'product_fit', evidenceType: 'fit' }),
  quantity: Object.freeze({ semanticFamily: 'net_quantity', evidenceType: 'quantity' }),
  scale: Object.freeze({ semanticFamily: 'physical_scale', evidenceType: 'scale' }),
  footprint: Object.freeze({ semanticFamily: 'placement_footprint', evidenceType: 'scale' }),
  length: Object.freeze({ semanticFamily: 'length_proportion', evidenceType: 'scale' }),
  care: Object.freeze({ semanticFamily: 'product_care', evidenceType: 'care' }),
  flavor: Object.freeze({ semanticFamily: 'flavor_variant', evidenceType: 'flavor' }),
  identifier: Object.freeze({ semanticFamily: 'product_identifier', evidenceType: 'identifier' }),
});

const ROLE_SEMANTIC_FAMILIES = Object.freeze({
  feature: 'visible_feature',
  texture: 'surface_texture',
  usage: 'usage_context',
  package: 'package_form',
  applicator: 'applicator_operation',
  closure: 'closure_access',
  label: 'protected_label',
  finish: 'surface_finish',
  structure: 'exterior_structure',
  controls: 'visible_controls',
  ports: 'connection_points',
  serving: 'serving_context',
  scene: 'usage_context',
  seal: 'seal_inspection',
  form: 'complete_form',
  opening: 'opening_access',
  silhouette: 'complete_form',
  material: 'visible_material',
  detail: 'construction_detail',
  hardware: 'visible_hardware',
  drape: 'fabric_drape',
  craft: 'visible_craft',
  storage: 'visible_storage',
  interaction: 'visible_interaction',
  edges: 'edge_geometry',
  grip: 'handling_grip',
  base_grip: 'base_grip',
  portability: 'portability',
  identity: 'complete_form',
});

const SAFE_FALLBACK_DUTIES = Object.freeze([
  Object.freeze({ roleName: 'visual_form', semanticFamily: 'complete_form', goal: 'What complete exterior form should the buyer recognize?' }),
  Object.freeze({ roleName: 'visible_material', semanticFamily: 'visible_material', goal: 'Which visible material cues help the buyer inspect the exterior?' }),
  Object.freeze({ roleName: 'surface_texture', semanticFamily: 'surface_texture', goal: 'Which visible surface texture can the buyer inspect?' }),
  Object.freeze({ roleName: 'surface_finish', semanticFamily: 'surface_finish', goal: 'Which visible surface finish helps the buyer compare the product?' }),
  Object.freeze({ roleName: 'exterior_structure', semanticFamily: 'exterior_structure', goal: 'How are the visible exterior sections arranged using only the shown exterior?' }),
  Object.freeze({ roleName: 'visible_feature', semanticFamily: 'visible_feature', goal: 'Which plainly visible exterior feature answers a buyer question?' }),
  Object.freeze({ roleName: 'construction_detail', semanticFamily: 'construction_detail', goal: 'Which visible construction detail helps the buyer inspect build quality?' }),
  Object.freeze({ roleName: 'edge_geometry', semanticFamily: 'edge_geometry', goal: 'Which visible edge profile or exterior geometry helps comparison?' }),
  Object.freeze({ roleName: 'visible_outline', semanticFamily: 'visible_outline', goal: 'Which complete exterior outline helps the buyer compare the product?' }),
  Object.freeze({ roleName: 'material_transition', semanticFamily: 'material_transition', goal: 'Which visible material transition can the buyer inspect on the exterior?' }),
  Object.freeze({ roleName: 'finish_reflection', semanticFamily: 'finish_reflection', goal: 'How does the visible exterior finish respond under neutral light?' }),
  Object.freeze({ roleName: 'context_placement', semanticFamily: 'context_placement', goal: 'Which neutral visible context helps the buyer understand the complete product scale?' }),
  Object.freeze({ roleName: 'exterior_proportion', semanticFamily: 'exterior_proportion', goal: 'Which visible exterior proportions help the buyer compare the complete product?' }),
]);

function confirmedUserFacts(productTruth) {
  const facts = own(productTruth, 'confirmedFacts');
  if (!isRecord(facts)) return [];
  return Object.keys(facts).flatMap((name) => {
    if (UNSAFE_KEYS.has(name.toLowerCase())) return [];
    const fact = facts[name];
    const source = cleanString(isRecord(fact) ? own(fact, 'source') : '');
    const value = cleanString(isRecord(fact) ? own(fact, 'value') : fact);
    return source === 'user' && value ? [{ name, value, normalizedName: factKey(name) }] : [];
  }).sort((left, right) => left.name.localeCompare(right.name));
}

function rolePolicy(roleName) {
  return ROLE_POLICIES[roleName] || {
    semanticFamily: ROLE_SEMANTIC_FAMILIES[roleName] || `category_${roleName}`,
    evidenceType: '',
  };
}

function matchingFacts(productTruth, evidenceType) {
  const aliases = FACT_TYPE_ALIASES[evidenceType];
  if (!aliases) return [];
  return confirmedUserFacts(productTruth)
    .filter(fact => aliases.has(fact.normalizedName))
    .map(({ name, value }) => ({ name, value }));
}

function preferredDuties(strategy, productTruth) {
  const roles = Array.isArray(strategy?.detailRoles) ? strategy.detailRoles : [];
  const questions = Array.isArray(strategy?.buyingQuestions) ? strategy.buyingQuestions : [];
  return roles.flatMap((rawRoleName, index) => {
    const roleName = cleanString(rawRoleName);
    const goal = cleanString(questions[index]);
    if (!roleName || !goal) return [];
    const policy = rolePolicy(roleName);
    const requiredFacts = policy.evidenceType
      ? matchingFacts(productTruth, policy.evidenceType)
      : [];
    if (policy.evidenceType && requiredFacts.length === 0) return [];
    return [{
      roleName,
      dutyKey: roleName,
      goal,
      purpose: goal,
      semanticFamily: policy.semanticFamily,
      evidenceType: policy.evidenceType,
      requiredFacts,
    }];
  });
}

function fallbackDuties() {
  return SAFE_FALLBACK_DUTIES.map(duty => ({
    ...duty,
    dutyKey: duty.roleName,
    purpose: duty.goal,
    evidenceType: '',
    requiredFacts: [],
  }));
}

export function isFactGatedDetailRole(roleName) {
  return Boolean(rolePolicy(cleanString(roleName).replace(/^detail_slice_/, '')).evidenceType);
}

export function resolveDetailDuties({ strategy, productTruth = {}, count } = {}) {
  if (!Number.isSafeInteger(count) || count < 0 || count > MAX_DETAIL_DUTY_COUNT) {
    throw new TypeError(`detail duty count must be an integer from 0 to ${MAX_DETAIL_DUTY_COUNT}`);
  }
  const selected = [];
  const usedFamilies = new Set();
  const usedRoles = new Set();
  const preferred = confirmedUserFacts(productTruth).length
    ? preferredDuties(strategy, productTruth)
    : [];
  for (const duty of [...preferred, ...fallbackDuties()]) {
    if (selected.length >= count) break;
    if (usedFamilies.has(duty.semanticFamily) || usedRoles.has(duty.roleName)) continue;
    selected.push(duty);
    usedFamilies.add(duty.semanticFamily);
    usedRoles.add(duty.roleName);
  }
  if (selected.length !== count) {
    throw new TypeError('evidence-safe detail duty catalog cannot satisfy the requested count');
  }
  return selected;
}

export function resolveLegacyDetailDuty({
  strategy,
  productTruth = {},
  sourceRole,
  usedSemanticFamilies = new Set(),
} = {}) {
  const sourceName = cleanString(sourceRole).toLowerCase().replace(/^detail_slice_/, '');
  const preferred = preferredDuties(strategy, productTruth);
  const exact = preferred.find(duty => duty.roleName === sourceName);
  if (exact && !usedSemanticFamilies.has(exact.semanticFamily)) {
    usedSemanticFamilies.add(exact.semanticFamily);
    return exact;
  }
  const replacement = [...preferred, ...fallbackDuties()].find(duty => (
    !usedSemanticFamilies.has(duty.semanticFamily)
  ));
  if (!replacement) throw new TypeError('legacy detail count exceeds the evidence-safe commercial duty catalog');
  usedSemanticFamilies.add(replacement.semanticFamily);
  return replacement;
}
