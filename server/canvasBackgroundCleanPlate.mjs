import crypto from 'node:crypto';

import sharp from 'sharp';

import { resolveGenerationSize } from './ecommerceEngine/modelCatalog.mjs';

const SUPPORTED_RATIOS = Object.freeze([
  ['1:1', 1],
  ['3:4', 3 / 4],
  ['4:3', 4 / 3],
  ['9:16', 9 / 16],
]);

function providerError(code, message, status = 502) {
  return Object.assign(new Error(message), { code, status, retryable: status >= 500 });
}

export function nearestCanvasGenerationRatio(width, height) {
  const sourceWidth = Number(width);
  const sourceHeight = Number(height);
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0 || !Number.isFinite(sourceHeight) || sourceHeight <= 0) {
    throw new TypeError('source width and height are required');
  }
  const aspect = sourceWidth / sourceHeight;
  return SUPPORTED_RATIOS.reduce((best, candidate) => (
    Math.abs(Math.log(aspect / candidate[1])) < Math.abs(Math.log(aspect / best[1])) ? candidate : best
  ))[0];
}

export function createCanvasBackgroundCleanPlate({
  providerAdapter,
  imageInputReader,
  model = 'gpt-image-2',
} = {}) {
  if (typeof providerAdapter?.submitEdit !== 'function' || typeof providerAdapter?.pollUntilReady !== 'function') {
    throw new TypeError('providerAdapter submitEdit and pollUntilReady are required');
  }
  if (typeof imageInputReader?.read !== 'function') throw new TypeError('imageInputReader.read is required');

  return async function generateCanvasBackgroundCleanPlate({
    sourceBuffer,
    maskBuffer,
    textBlocks = [],
    signal,
  } = {}) {
    if (!Buffer.isBuffer(sourceBuffer) || !sourceBuffer.length || !Buffer.isBuffer(maskBuffer) || !maskBuffer.length) {
      throw new TypeError('sourceBuffer and maskBuffer are required');
    }
    const metadata = await sharp(sourceBuffer, { failOn: 'error' }).metadata();
    const ratio = nearestCanvasGenerationRatio(metadata.width, metadata.height);
    const selectedSize = resolveGenerationSize({ resolution: '2K', ratio });
    const visibleText = textBlocks
      .map(block => String(block?.text || '').trim())
      .filter(Boolean)
      .slice(0, 12)
      .join(' / ');
    const prompt = [
      'Create a clean background plate for ecommerce image editing.',
      'Image 1 is the authoritative original. Image 2 is a binary product mask: white pixels mark every product pixel that must be removed and reconstructed; black pixels must remain spatially consistent.',
      'Remove all masked products and reconstruct the occluded background naturally. Preserve the original camera, lighting, table, props, perspective, color and composition. Do not invent replacement products.',
      visibleText ? `Also remove these visible marketing texts while preserving the surrounding background: ${visibleText}.` : '',
    ].filter(Boolean).join(' ');
    const digest = crypto.createHash('sha256')
      .update(sourceBuffer)
      .update(maskBuffer)
      .update(prompt)
      .digest('hex');
    const submitted = await providerAdapter.submitEdit({
      idempotencyKey: `canvas-clean-plate-${digest}`,
      prompt,
      modelRoute: {
        model,
        size: selectedSize.size,
        async: true,
        mode: 'edit',
      },
      inputAssets: [
        { buffer: sourceBuffer, contentType: 'image/png', fileName: 'canvas-source.png' },
        { buffer: maskBuffer, contentType: 'image/png', fileName: 'canvas-product-mask.png' },
      ],
    });
    const jobId = String(submitted?.jobId || '').trim();
    if (!jobId) throw providerError('PROVIDER_JOB_INVALID', '背景净版任务提交失败');
    const completed = await providerAdapter.pollUntilReady(jobId, { signal });
    if (String(completed?.jobId || '').trim() !== jobId) {
      throw providerError('PROVIDER_JOB_ID_MISMATCH', '背景净版任务结果不匹配');
    }
    if (completed?.status !== 'completed' || !completed?.outputUrl) {
      throw providerError('BACKGROUND_CLEAN_PLATE_FAILED', completed?.error || '背景净版生成失败');
    }
    const output = await imageInputReader.read(completed.outputUrl);
    if (!Buffer.isBuffer(output?.buffer) || !output.buffer.length) {
      throw providerError('BACKGROUND_CLEAN_PLATE_INVALID', '背景净版结果无效');
    }
    return output.buffer;
  };
}
