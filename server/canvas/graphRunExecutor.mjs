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
//
// P3: 图片拼接 splice（本地 sharp 免费，0 扣费）内置在本执行器：多图竖排 composite/flatten
// 输出 1 张详情长图；视频拼接需 ffmpeg 环境（node_modules 无静态二进制）→ P3.1 门控，
// 执行器返回 { ok:false, error:'video splice requires ffmpeg env (P3.1)' }，不提供扣费入口。

import sharp from 'sharp';

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

/* ── P3 splice（图片拼接，本地 sharp 免费，0 扣费） ── */

const VIDEO_INPUT_EXTENSIONS = /\.(mp4|mov|webm|m4v|avi|mkv|flv)(\?|#|$)/i;

/* 收集拼接输入 URL：inputs[上游id]=url（保持入边顺序）+ 节点自带 inputUrls/assets，去重保序。 */
export function collectSpliceInputUrls(node = {}, inputs = {}) {
  const urls = [];
  for (const value of Object.values(inputs || {})) {
    const url = cleanString(value);
    if (url && !urls.includes(url)) urls.push(url);
  }
  for (const value of Array.isArray(node?.inputUrls) ? node.inputUrls : []) {
    const url = cleanString(value);
    if (url && !urls.includes(url)) urls.push(url);
  }
  for (const asset of Array.isArray(node?.assets) ? node.assets : []) {
    const url = cleanString(asset?.url);
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

/* 视频输入识别（任一输入是视频 -> 整组走 ffmpeg 门控，不假跑图片拼接）。 */
export function isVideoSpliceInput(node = {}, inputs = {}) {
  if (String(node?.kind || node?.mediaKind || '') === 'video') return true;
  for (const value of Object.values(inputs || {})) {
    if (VIDEO_INPUT_EXTENSIONS.test(cleanString(value))) return true;
  }
  const own = Array.isArray(node?.inputUrls) ? node.inputUrls : [];
  for (const value of own) {
    if (VIDEO_INPUT_EXTENSIONS.test(cleanString(value))) return true;
  }
  return false;
}

/* 竖排拼接核心（纯 sharp，免费）：多图 resize 到统一宽度后竖向 composite + flatten，
   输出 1 张 PNG 长图。spacing 段间留白；background 画布底色。不读网络、不花钱。 */
export async function spliceImageStack(imageBuffers, { width = 1080, spacing = 0, background = { r: 255, g: 255, b: 255 } } = {}) {
  const buffers = Array.isArray(imageBuffers) ? imageBuffers : [];
  if (buffers.length < 2) throw new Error('spliceImageStack requires at least 2 images');
  const targetWidth = Math.max(64, Number(width) || 1080);
  const layerSpecs = [];
  let totalHeight = 0;
  for (let i = 0; i < buffers.length; i += 1) {
    const buffer = buffers[i];
    if (!Buffer.isBuffer(buffer)) throw new Error(`spliceImageStack: input ${i} is not a buffer`);
    const meta = await sharp(buffer).metadata();
    const sourceWidth = Number(meta.width) || targetWidth;
    const sourceHeight = Number(meta.height) || sourceWidth;
    const scale = targetWidth / sourceWidth;
    const layerHeight = Math.max(1, Math.round(sourceHeight * scale));
    layerSpecs.push({ top: totalHeight, height: layerHeight, index: i });
    totalHeight += layerHeight;
    if (i < buffers.length - 1) totalHeight += Math.max(0, Number(spacing) || 0);
  }
  const composites = [];
  for (const spec of layerSpecs) {
    composites.push(await sharp(buffers[spec.index]).resize({ width: targetWidth }).toBuffer());
  }
  const output = await sharp({
    create: { width: targetWidth, height: totalHeight, channels: 3, background },
  })
    .composite(composites.map((input, i) => ({ input, top: layerSpecs[i].top, left: 0 })))
    .flatten({ background })
    .png()
    .toBuffer();
  return { buffer: output, width: targetWidth, height: totalHeight, count: buffers.length };
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
      if (!imageUrl) return { ok: false, error: '抠图需要先提供一张图片' };
      const out = await deps.removeBackground({ imageUrl, node, ctx });
      return normalizeExecutorResult(out, 'remove-bg');
    });
  }
  if (typeof deps.upscale === 'function') {
    handlers.set('upscale', async (node, inputs, ctx) => {
      const imageUrl = firstInputUrl(inputs) || cleanString(node?.url);
      if (!imageUrl) return { ok: false, error: '放大需要先提供一张图片' };
      const out = await deps.upscale({ imageUrl, node, ctx });
      return normalizeExecutorResult(out, 'upscale');
    });
  }
  if (typeof deps.extend === 'function') {
    handlers.set('extend', async (node, inputs, ctx) => {
      const imageUrl = firstInputUrl(inputs) || cleanString(node?.url);
      if (!imageUrl) return { ok: false, error: '扩图需要先提供一张图片' };
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
  /* P3 splice：图片竖排拼接（本地 sharp，免费 0 扣费）。readImage = url -> { buffer }（生产接线
     imageInputReader.read）；persistSpliceOutput = { buffer, contentType } -> { url }（生产接线
     generatedAssetStore.persistBuffer）。任一输入是视频 -> P3.1 ffmpeg 门控（不提供扣费入口）。 */
  if (typeof deps.readImage === 'function') {
    handlers.set('splice', async (node, inputs, ctx) => {
      if (isVideoSpliceInput(node, inputs)) {
        return { ok: false, error: 'video splice requires ffmpeg env (P3.1)' };
      }
      const urls = collectSpliceInputUrls(node, inputs);
      if (urls.length < 2) {
        return { ok: false, error: 'splice requires at least 2 image inputs' };
      }
      const buffers = [];
      for (const url of urls) {
        const read = await deps.readImage(url, ctx);
        buffers.push(Buffer.isBuffer(read) ? read : (read && Buffer.isBuffer(read.buffer) ? read.buffer : null));
      }
      if (buffers.includes(null)) return { ok: false, error: 'splice input is not a readable image' };
      const composed = await spliceImageStack(buffers, {
        width: Number(node?.params?.width) || 1080,
        spacing: Number(node?.params?.spacing) || 0,
      });
      if (typeof deps.persistSpliceOutput === 'function') {
        const asset = await deps.persistSpliceOutput({
          buffer: composed.buffer,
          contentType: 'image/png',
          taskId: `canvas_graph_splice_${Date.now()}`,
          label: 'canvas_graph_splice',
          ctx,
        });
        const outputUrl = cleanString(asset?.url || (asset && typeof asset === 'string' ? asset : ''));
        if (!outputUrl) return { ok: false, error: 'splice output persist returned no url' };
        return {
          ok: true,
          outputUrl,
          width: composed.width,
          height: composed.height,
          imageCount: composed.count,
        };
      }
      return {
        ok: true,
        outputUrl: `data:image/png;base64,${composed.buffer.toString('base64')}`,
        buffer: composed.buffer,
        width: composed.width,
        height: composed.height,
        imageCount: composed.count,
      };
    });
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
   -> upscale（本地 sharp 放大）。
   P3 splice 接线（index.mjs）：readImage: url => imageInputReader.read(url)（返回 { buffer }）
   + persistSpliceOutput: ({ buffer, contentType, taskId, label }) =>
     generatedAssetStore.persistBuffer({ buffer, contentType, taskId, label }) -> { url }。
   视频拼接不接线：执行器对视频输入固定返回 ffmpeg P3.1 门控错误。见 graphRunRoutes.mjs 顶部 WIRE-IN。 */
