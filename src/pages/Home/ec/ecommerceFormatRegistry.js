const GENERATION_RATIOS = Object.freeze(['1:1', '3:4', '4:3', '9:16']);

function format(key, label, usage, width, height, roles) {
  return Object.freeze({ key, label, usage, w: width, h: height, roles: Object.freeze(roles) });
}

const ALL_ROLES = Object.freeze(['white_bg', 'main_text', 'main_3x4', 'transparent', 'sku', 'detail']);
const PORTRAIT_ROLES = Object.freeze(['main_text', 'main_3x4', 'sku', 'detail']);
const MAIN_ROLES = Object.freeze(['main_text', 'main_3x4']);

export const ECOMMERCE_FORMATS = Object.freeze([
  format('1:1', '1:1', '方形主图 / SKU / 白底图', 18, 18, ALL_ROLES),
  format('4:5', '4:5', '商城信息流竖图', 14, 18, PORTRAIT_ROLES),
  format('3:4', '3:4', '通用电商竖图', 14, 18, PORTRAIT_ROLES),
  format('2:3', '2:3', '商品海报竖图', 12, 18, PORTRAIT_ROLES),
  format('9:16', '9:16', '手机全屏 / 详情切片', 10, 18, PORTRAIT_ROLES),
  format('4:3', '4:3', '横版商品展示', 18, 14, MAIN_ROLES),
  format('3:2', '3:2', '横版场景与横幅', 18, 12, MAIN_ROLES),
  format('16:9', '16:9', '视频封面 / 宽屏横幅', 18, 10, MAIN_ROLES),
]);

function ratioValue(value) {
  const match = /^(\d+):(\d+)$/.exec(String(value || '').trim());
  return match ? Number(match[1]) / Number(match[2]) : 1;
}

function closestGenerationRatio(targetRatio) {
  const target = ratioValue(targetRatio);
  return GENERATION_RATIOS.reduce((best, candidate) => (
    Math.abs(ratioValue(candidate) - target) < Math.abs(ratioValue(best) - target) ? candidate : best
  ), GENERATION_RATIOS[0]);
}

export function formatsFor({ role = 'main_text', platform = 'smart' } = {}) {
  const roleKey = String(role || '').trim();
  const values = roleKey === 'detail'
    ? ECOMMERCE_FORMATS
    : ECOMMERCE_FORMATS.filter(item => item.roles.includes(roleKey));
  if (platform === '亚马逊' && ['white_bg', 'transparent'].includes(roleKey)) {
    return values.filter(item => item.key === '1:1');
  }
  return values;
}

export function normalizeCommerceFormat({ ratio, targetRatio, role = 'main_text' } = {}) {
  const available = formatsFor({ role });
  const requested = String(targetRatio || ratio || '').trim();
  const target = available.some(item => item.key === requested)
    ? requested
    : role === 'detail' ? '9:16' : available[0]?.key || '1:1';
  const generationRatio = GENERATION_RATIOS.includes(target) ? target : closestGenerationRatio(target);
  return {
    targetRatio: target,
    generationRatio,
    cropPolicy: target === generationRatio ? 'none' : 'cover-center',
  };
}

export { GENERATION_RATIOS };
