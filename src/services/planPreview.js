import { getSessionToken, handleSessionResponse } from './auth.js';
import { createApiError } from './apiError.js';
import { fetchBillingBalance, quoteBillingAction } from './billing.js';
import { stableCanvasActionId } from './api.js';
import { normalizeEntitlement } from '../store/entitlementState.js';

/* ═══ 三步方案预览（批 K-C / K-D）══════════════════════════════════════════════════════════
   图片侧「预览」与视频侧「代为撰写」**共用这一份客户端**（服务端也是同一份实现）。
   定价 0.5 积分/次（SKU ec_plan_preview），先报价 → 用户确认 → 才请求；失败不扣。 */
export const PLAN_PREVIEW_SKU = 'ec_plan_preview';
/* 这一步的**价格**（积分）——工作台的「生成预览」按钮上要写它（批 Q）。
   用户批注 #3-6 原话：「我不明白为什么生成一下预览就要 7 点积分，我们的竞品他们就只有 0 点几的积分，
     你为什么不把那个生成预览的积分放上去呢？」
   根因：那条按钮原来显示的是**整单出图**的报价（套图 7 积分），不是"预览这一步"的价格。
   服务端定价就在 server/billing/catalog.mjs：ec_plan_preview = 500 units = **0.5 积分/次**。 */
export const PLAN_PREVIEW_POINTS = 0.5;

function headers(extra = {}) {
  const token = getSessionToken();
  return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function request(path, options = {}) {
  const response = await fetch(path, { ...options, headers: headers(options.headers) });
  handleSessionResponse(response);
  if (!response.ok) throw await createApiError(response, '方案预览请求失败');
  return response.json();
}

export function fetchPlanPreviewOptions(surface, { signal } = {}) {
  return request(`/api/plan-preview/options?surface=${encodeURIComponent(surface || 'image')}`, { signal });
}

export async function fetchPlanPreviewBalance() {
  try {
    return normalizeEntitlement(await fetchBillingBalance()).ecPoints;
  } catch {
    return null;
  }
}

export async function quotePlanPreview({ signal } = {}) {
  const { quote } = await quoteBillingAction({ sku: PLAN_PREVIEW_SKU, quantity: 1 }, { signal });
  return quote;
}

/* 同一份「素材 + 需求 + 方向」= 同一次方案，重复点击由服务端 replay，不再扣费。 */
export function planPreviewActionId(input = {}) {
  return stableCanvasActionId([
    'plan-preview',
    input.surface || 'image',
    String(input.skillName || ''),
    String(input.prompt || '').trim(),
    JSON.stringify(input.direction || {}),
    (input.materials || []).map(item => String(item?.id || item?.name || '')).join(','),
  ].join('\u0000'));
}

export function composePlanPreview(input = {}, { signal } = {}) {
  return request('/api/plan-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  });
}
