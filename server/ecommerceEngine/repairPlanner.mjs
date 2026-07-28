const PRODUCT_REGEN_CODES = new Set([
  'blank_or_uniform',
  'product_drift',
  'product_fidelity_failed',
  'product_identity_mismatch',
  'suite_collage_layout',
  'suite_near_duplicate',
  'wrong_product',
]);
const TECHNICAL_OPERATIONS = Object.freeze({
  dimension_mismatch: 'resize',
  format_mismatch: 'convert_format',
  illegal_generation_dimensions: 'resize',
  transparent_background_missing: 'normalize_transparent_background',
  white_background_insufficient: 'normalize_white_background',
});
const COPY_REPAIR_CODES = new Set([
  'copy_or_logo_failed',
  'forbidden_text_present',
  'logo_missing',
  'logo_mutated',
  'required_text_missing',
  'text_mismatch',
]);
const VISUAL_EDIT_CODES = new Set([
  'local_artifact',
  'local_deformation',
  'too_blurry',
  'visual_quality_failed',
]);

function ownRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function issueCodes(check) {
  const record = ownRecord(check);
  if (record && Object.hasOwn(record, 'status') && record.status !== 'fail') return [];
  const values = record && Object.hasOwn(record, 'issueCodes') ? record.issueCodes : [];
  const result = [];
  const seen = new Set();
  for (const value of Array.isArray(values) ? values : []) {
    if (typeof value !== 'string') continue;
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function collect(result) {
  const checks = ownRecord(result) && Object.hasOwn(result, 'checks')
    ? ownRecord(result.checks)
    : null;
  return {
    technical: issueCodes(checks && Object.hasOwn(checks, 'technical') ? checks.technical : null),
    platform: issueCodes(checks && Object.hasOwn(checks, 'platformCompliance') ? checks.platformCompliance : null),
    product: issueCodes(checks && Object.hasOwn(checks, 'productFidelity') ? checks.productFidelity : null),
    copy: issueCodes(checks && Object.hasOwn(checks, 'copyAndLogo') ? checks.copyAndLogo : null),
    visual: issueCodes(checks && Object.hasOwn(checks, 'visualQuality') ? checks.visualQuality : null),
  };
}

export function planRepair(qualityResult) {
  const issues = collect(qualityResult);
  const productCodes = [...issues.product, ...issues.visual].filter((code) => PRODUCT_REGEN_CODES.has(code));
  if (productCodes.length) {
    return {
      type: 'regenerate_from_product_truth',
      focusIssueCodes: productCodes,
      preserveUserFacts: true,
      userCharge: false,
    };
  }

  const operations = [...issues.technical, ...issues.platform]
    .map((code) => TECHNICAL_OPERATIONS[code])
    .filter(Boolean);
  if (operations.length) {
    return {
      type: 'sharp_repair',
      operations: [...new Set(operations)],
      focusIssueCodes: [...issues.technical, ...issues.platform],
      userCharge: false,
    };
  }

  const copyCodes = issues.copy.filter((code) => COPY_REPAIR_CODES.has(code));
  if (copyCodes.length) {
    return {
      type: 'cleanup_and_overlay',
      operations: ['remove_generated_text', 'apply_deterministic_overlay'],
      focusIssueCodes: copyCodes,
      preserveUserFacts: true,
      userCharge: false,
    };
  }

  const visualCodes = issues.visual.filter((code) => VISUAL_EDIT_CODES.has(code));
  if (visualCodes.length) {
    return {
      type: 'image_edit',
      focusIssueCodes: visualCodes,
      preserveProductIdentity: true,
      userCharge: false,
    };
  }

  const allCodes = [
    ...issues.technical,
    ...issues.platform,
    ...issues.product,
    ...issues.copy,
    ...issues.visual,
  ];
  if (allCodes.length) {
    return {
      type: 'manual_review',
      focusIssueCodes: [...new Set(allCodes)],
      userCharge: false,
    };
  }

  return {
    type: 'none',
    focusIssueCodes: [],
    userCharge: false,
  };
}

export function canRetry(attempt, repairAction = {}) {
  if (!Number.isInteger(attempt) || attempt < 0) return false;
  // Sharp repairs run locally and do not spend another image-generation call.
  // Every provider-backed repair gets one bounded retry after the initial render.
  const maxRepairs = repairAction?.type === 'sharp_repair' ? 2 : 1;
  return attempt < maxRepairs;
}
