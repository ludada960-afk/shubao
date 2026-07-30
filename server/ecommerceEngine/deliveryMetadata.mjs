function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function ecommerceGroupForRole(roleInput) {
  const role = cleanString(roleInput);
  if (role === 'white_bg' || role === 'white_background') return '白底图';
  if (role === 'sku') return 'SKU';
  if (role === 'transparent') return '素材';
  if (role.startsWith('detail')) return '详情图';
  return '主图';
}

export function ecommerceDimensionsForPlan(plan = {}) {
  const size = cleanString(plan.generationSize || plan.size || plan.outputSize || plan.dimensions);
  const match = size.match(/^(\d+)\s*[xX×]\s*(\d+)$/);
  if (!match) return { size };
  return {
    size: `${match[1]}x${match[2]}`,
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

export function ecommerceDeliveryMetadataForPlan(plan = {}) {
  const role = cleanString(plan.role) || 'generated';
  const label = cleanString(plan.label || plan.purpose) || role;
  return {
    label,
    displayName: label,
    name: label,
    role,
    group: cleanString(plan.group) || ecommerceGroupForRole(role),
    ratio: cleanString(plan.ratio || plan.aspectRatio) || '1:1',
    ...ecommerceDimensionsForPlan(plan),
  };
}
