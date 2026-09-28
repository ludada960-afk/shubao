import { getSessionToken, handleSessionResponse } from './auth.js';
import { createApiError } from './apiError.js';
import { quoteBillingAction } from './billing.js';
import { stableCanvasActionId } from './api.js';

/* ═══ 「代写这一篇的文案」（概念视觉方案结果区，2026-09-28 批 DC 续-6）══════════════════════
   用户口径（逐字）：「文案这块怎么办呢，我们文案要另外生成吗，统一一起生成的话，会不会更适配呢？
   我们生成的文案能不能实现他们的那种风格呢，我们要**避免文案千篇一律**，但是也要**成功模仿他们的
   风格**」。
   ⇒ 与方案预览同一套链路：**先报价 → 用户确认 → 才请求；失败不扣**（服务端 hold → LLM → settle，
     失败释放）。定价 0.5 积分/次（SKU ec_concept_copy，server/billing/catalog.mjs 是唯一真源）。
   文案与图是两层：请求里带的是**这一篇的要素**（母体/手法/人物/补充），所以文案读起来像同一次策划；
   风格语法（句式库/密度/判重）在服务端（server/conceptCopywriting.mjs），前端不写第二份。 */
export const CONCEPT_COPY_SKU = 'ec_concept_copy';
export const CONCEPT_COPY_POINTS = 0.5;

function headers(extra = {}) {
  const token = getSessionToken();
  return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function quoteConceptCopy({ signal } = {}) {
  const { quote } = await quoteBillingAction({ sku: CONCEPT_COPY_SKU, quantity: 1 }, { signal });
  return quote;
}

/* actionId 里带 attempt（第几次出这一版）：同一次点击的重复触发由服务端幂等挡掉；
   「再来一版」是有意的新动作（attempt+1），照 0.5 积分/次 计 —— 用户在确认框里看得见价格。
   ⚠️ 2026-09-28 批 DC 续-7：**随篇首发 = attempt 0**（文案并进出图那一次提交）。
     原来这里写的是 `|| 1`，于是 0 会被吞成 1 —— 那一版就与"再来一版"撞同一个幂等键，
     服务端会把并进提交的首发当成重复请求挡回去（表现为"点了没反应"）。 */
export function conceptCopyActionId(input = {}) {
  return stableCanvasActionId([
    'concept-copy',
    String(input.theme || ''),
    (Array.isArray(input.shots) ? input.shots : []).join('\u0001'),
    String(input.person || ''),
    String(input.notes || ''),
    String(input.product || ''),
    String(Number.isFinite(Number(input.attempt)) ? Number(input.attempt) : 0),
  ]);
}

export async function generateConceptCopy(input = {}, { signal } = {}) {
  const quote = await quoteConceptCopy({ signal });
  const attempt = Number.isFinite(Number(input.attempt)) ? Number(input.attempt) : 0;
  const response = await fetch('/api/concept/copywriting', {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      theme: String(input.theme || ''),
      shots: Array.isArray(input.shots) ? input.shots : [],
      person: String(input.person || ''),
      notes: String(input.notes || ''),
      product: String(input.product || ''),
      attempt,
      billingQuoteId: quote?.quoteId,
      actionId: conceptCopyActionId(input),
    }),
    signal,
  });
  handleSessionResponse(response);
  if (!response.ok) throw await createApiError(response, '文案生成失败');
  return response.json();
}
