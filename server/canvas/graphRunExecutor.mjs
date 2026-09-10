// server/canvas/graphRunExecutor.mjs
// P1 里程碑生产执行器适配（薄层）：把既有免费/本地服务接到 graph-run 编排器。
//
// 契约（与 createCanvasGraphRunService 的 executeNode 注入点一致）：
//   executeNode(node, inputs, ctx) -> { ok, outputUrl?, units?, error? }
//   - inputs[上游nodeId] = 上游产物 URL；ctx = { ownerEmail, docId, runId, nodeId, kind, action, stepIndex }
//   - 不变式 ③：units 只在"实际发生扣费"时由执行器回报（价格只来自后端计费目录
//     quoteFeature/buildBillingRules，如 ec_remove_bg 免费额度或 image SKU 报价）；
//     本地免费路径一律不返回 units（服务按 0 结算，绝不猜价）。
//
// 未接线的 kind 一律返回 { ok:false, error:'executor not wired for kind X' }——
// 默认路径零成本：本文件不 import 任何付费 SDK，不发起任何网络调用。

const GENERATE_KINDS = Object.freeze(['image-composer', 'smart-remix', 'suite-composer']);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function firstInputUrl(inputs) {
  if (!inputs || typeof inputs !== 'object') return '';
  for (const value of Object.values(inputs)) {
    const url = cleanString(value);
    if (url) return url;
  }
  return '';
}

/* 归一化执行器结果：缺 URL 视为失败；units 只保留 >0 的有限数字（不变式 ③）。 */
function normalizeExecutorResult(out, kind) {
  if (!out || typeof out !== 'object') {
    return { ok: false, error: `executor for kind ${kind} returned an invalid result` };
  }
  if (out.ok === false) return { ok: false, error: cleanString(out.error) || 'executor failed' };
  const outputUrl = cleanString(out.outputUrl || out.result_url || out.url);
  if (!outputUrl) return { ok: false, error: `executor for kind ${kind} did not return an output url` };
  const units = Number(out.units);
  return {
    ok: true,
    outputUrl,
    ...(Number.isFinite(units) && units > 0 ? { units } : {}),
  };
}

export function createCanvasGraphRunExecutor(deps = {}) {
  const handlers = new Map();

  if (typeof deps.removeBackground === 'function') {
    handlers.set('remove-bg', async (node, inputs, ctx) => {
      const imageUrl = firstInputUrl(inputs) || cleanString(node?.url);
      if (!imageUrl) return { ok: false, error: 'remove-bg requires an upstream image input' };
      const out = await deps.removeBackground({ imageUrl, node, ctx });
      return normalizeExecutorResult(out, 'remove-bg');
    });
  }
  if (typeof deps.upscale === 'function') {
    handlers.set('upscale', async (node, inputs, ctx) => {
      const imageUrl = firstInputUrl(inputs) || cleanString(node?.url);
      if (!imageUrl) return { ok: false, error: 'upscale requires an upstream image input' };
      const out = await deps.upscale({ imageUrl, node, ctx });
      return normalizeExecutorResult(out, 'upscale');
    });
  }
  if (typeof deps.extend === 'function') {
    handlers.set('extend', async (node, inputs, ctx) => {
      const imageUrl = firstInputUrl(inputs) || cleanString(node?.url);
      if (!imageUrl) return { ok: false, error: 'extend requires an upstream image input' };
      const out = await deps.extend({ imageUrl, node, ctx });
      return normalizeExecutorResult(out, 'extend');
    });
  }
  if (typeof deps.inpaint === 'function') {
    handlers.set('inpaint', async (node, inputs, ctx) => {
      const out = await deps.inpaint({ node, inputs, ctx });
      return normalizeExecutorResult(out, 'inpaint');
    });
  }
  if (typeof deps.translate === 'function') {
    handlers.set('translate', async (node, inputs, ctx) => {
      const out = await deps.translate({ node, inputs, ctx });
      return normalizeExecutorResult(out, 'translate');
    });
  }
  if (typeof deps.layerWorkbench === 'function') {
    handlers.set('layer-workbench', async (node, inputs, ctx) => {
      const out = await deps.layerWorkbench({ node, inputs, ctx });
      return normalizeExecutorResult(out, 'layer-workbench');
    });
  }
  if (typeof deps.generate === 'function') {
    for (const kind of GENERATE_KINDS) {
      handlers.set(kind, async (node, inputs, ctx) => {
        const out = await deps.generate({ kind, node, inputs, ctx });
        return normalizeExecutorResult(out, kind);
      });
    }
  }

  return async function executeNode(node, inputs, ctx) {
    const kind = String(ctx?.kind || node?.actionId || node?.kind || '');
    const handler = handlers.get(kind);
    if (!handler) return { ok: false, error: `executor not wired for kind ${kind}` };
    try {
      return await handler(node, inputs, ctx);
    } catch (error) {
      return { ok: false, error: error?.message || String(error) };
    }
  };
}

/* P1 旗舰白底链的接线示例（供 index.mjs WIRE-IN 参照；本文件自身零付费调用）：
   商品图 source -> remove-bg（本地免费 removeLightBackground 或 canvasLayeringService 分段去背）
   -> upscale（本地 sharp 放大）。见 graphRunRoutes.mjs 顶部 WIRE-IN 注释块。 */
