import sharp from 'sharp';

import { imageBufferToDataUrl, imageBufferToVisionDataUrl } from './imageInput.mjs';
import { normalizeCanvasLayerPlan } from './canvasTools.mjs';
import {
  compositeMaskedAsset,
  maskIntersectionOverUnion,
  normalizeSegmentationMask,
  segmentationMaskToPng,
  unionSegmentationMasks,
} from './canvasSegmentation.mjs';

function layeringError(code, message, status = 422) {
  return Object.assign(new Error(message), { code, status });
}

function pixelBox(box, width, height) {
  const [x, y, boxWidth, boxHeight] = box;
  return [
    Math.max(0, Math.floor(x * width)),
    Math.max(0, Math.floor(y * height)),
    Math.min(width, Math.ceil((x + boxWidth) * width)),
    Math.min(height, Math.ceil((y + boxHeight) * height)),
  ];
}

function assertDependencies(deps) {
  if (typeof deps?.visionClient?.analyzeJson !== 'function') throw new TypeError('visionClient.analyzeJson is required');
  if (typeof deps?.segmentationClient?.segment !== 'function') throw new TypeError('segmentationClient.segment is required');
  if (typeof deps?.generatedAssetStore?.persistBuffer !== 'function') throw new TypeError('generatedAssetStore.persistBuffer is required');
  if (typeof deps?.imageInputReader?.read !== 'function') throw new TypeError('imageInputReader.read is required');
}

async function persistPng(generatedAssetStore, buffer, label) {
  return generatedAssetStore.persistBuffer({
    buffer,
    contentType: 'image/png',
    taskId: `canvas_layer_${Date.now()}`,
    label,
  });
}

function textLayer(block) {
  return {
    id: block.id,
    kind: 'text',
    semanticType: 'text',
    name: block.text,
    text: block.text,
    bounds: { x: block.box[0], y: block.box[1], width: block.box[2], height: block.box[3] },
    confidence: block.confidence,
    color: block.color,
    background: block.background,
    editable: true,
  };
}

export function createCanvasLayeringService(deps = {}) {
  assertDependencies(deps);
  const {
    visionClient,
    segmentationClient,
    generatedAssetStore,
    imageInputReader,
    createBackgroundCleanPlate,
  } = deps;

  async function segmentProducts({ imageUrl, signal }) {
    const sourceInput = await imageInputReader.read(imageUrl);
    const sourceBuffer = await sharp(sourceInput.buffer, { failOn: 'error' }).rotate().png().toBuffer();
    const metadata = await sharp(sourceBuffer).metadata();
    const width = metadata.width;
    const height = metadata.height;
    if (!width || !height) throw layeringError('CANVAS_LAYER_SOURCE_INVALID', '源图片尺寸无效', 400);
    const visionImage = await imageBufferToVisionDataUrl({ buffer: sourceBuffer });
    const rawPlan = await visionClient.analyzeJson({
      systemPrompt: [
        '你是电商商品实例检测与 OCR 引擎。只返回 JSON，不要解释。',
        '识别商家要售卖的全部商品实例；餐盘、食物、桌面、餐具和装饰属于背景，不得标成 product。',
        'JSON: {"productGroup":{"name":"","box":[x,y,w,h],"confidence":0},"instances":[{"id":"","name":"","kind":"product|background","box":[x,y,w,h],"confidence":0}],"textBlocks":[{"id":"","text":"","box":[x,y,w,h],"confidence":0,"color":"#000000","background":"#ffffff"}]}。坐标为 0 到 1。',
      ].join('\n'),
      userPrompt: '识别商品整组、每个独立商品实例和真实可见文字。不要把背景道具当作商品。',
      images: [visionImage],
      maxTokens: 1800,
      temperature: 0.1,
      signal,
    });
    const plan = normalizeCanvasLayerPlan(rawPlan);
    if (!plan.instances.length) throw layeringError('CANVAS_LAYER_PRODUCTS_NOT_FOUND', '没有识别到可分离的商品主体');
    const prompts = plan.instances.map(instance => ({ id: instance.id, box: pixelBox(instance.box, width, height) }));
    const segmented = await segmentationClient.segment({
      imageUrl: imageBufferToDataUrl({ buffer: sourceBuffer, contentType: 'image/png' }),
      prompts,
      maxMasks: prompts.length,
      signal,
    });
    const instanceById = new Map(plan.instances.map(instance => [instance.id, instance]));
    const accepted = [];
    for (const [index, rawMask] of segmented.masks.entries()) {
      const instance = instanceById.get(rawMask.promptId) || plan.instances[index];
      if (!instance || (rawMask.score != null && Number(rawMask.score) < 0.5)) continue;
      try {
        const maskInput = await imageInputReader.read(rawMask.url);
        const mask = await normalizeSegmentationMask(maskInput.buffer, { width, height });
        if (accepted.some(item => maskIntersectionOverUnion(item.mask, mask) >= 0.85)) continue;
        accepted.push({ instance, mask, confidence: rawMask.score == null ? instance.confidence : Number(rawMask.score) });
      } catch (error) {
        if (!String(error?.code || '').startsWith('SEGMENTATION_MASK_')) throw error;
      }
    }
    if (!accepted.length) throw layeringError('CANVAS_LAYER_MASKS_INVALID', '没有得到可靠的商品像素层');
    return { sourceBuffer, width, height, plan, accepted, requestId: segmented.requestId || '' };
  }

  async function persistProductLayers(segmented) {
    const instanceLayers = [];
    for (const { instance, mask, confidence } of segmented.accepted) {
      const composed = await compositeMaskedAsset(segmented.sourceBuffer, mask);
      const asset = await persistPng(generatedAssetStore, composed.buffer, `canvas_layer_product_${instance.id}`);
      instanceLayers.push({
        id: instance.id,
        kind: 'image',
        semanticType: 'product-instance',
        name: instance.name,
        url: asset.url,
        assetId: asset.id,
        bounds: composed.bounds,
        pixelWidth: composed.width,
        pixelHeight: composed.height,
        confidence,
        editable: true,
      });
    }
    const groupMask = unionSegmentationMasks(segmented.accepted.map(item => item.mask));
    const groupComposed = await compositeMaskedAsset(segmented.sourceBuffer, groupMask);
    const groupAsset = await persistPng(generatedAssetStore, groupComposed.buffer, 'canvas_layer_product_group');
    const groupLayer = {
      id: 'product-group',
      kind: 'image',
      semanticType: 'product-group',
      name: segmented.plan.productGroup?.name || '商品主体',
      url: groupAsset.url,
      assetId: groupAsset.id,
      bounds: groupComposed.bounds,
      pixelWidth: groupComposed.width,
      pixelHeight: groupComposed.height,
      confidence: segmented.plan.productGroup?.confidence || Math.min(...segmented.accepted.map(item => item.confidence)),
      editable: true,
    };
    return { groupMask, groupLayer, instanceLayers };
  }

  return {
    async removeBackground({ imageUrl, signal } = {}) {
      const segmented = await segmentProducts({ imageUrl, signal });
      const groupMask = unionSegmentationMasks(segmented.accepted.map(item => item.mask));
      const composed = await compositeMaskedAsset(segmented.sourceBuffer, groupMask);
      const asset = await persistPng(generatedAssetStore, composed.buffer, 'canvas_remove_bg_sam3');
      return {
        url: asset.url,
        result_url: asset.url,
        assetId: asset.id,
        method: 'sam3',
        subjectCount: segmented.accepted.length,
        bounds: composed.bounds,
        pixelWidth: composed.width,
        pixelHeight: composed.height,
      };
    },

    async createLayers({ imageUrl, signal } = {}) {
      const segmented = await segmentProducts({ imageUrl, signal });
      const { groupMask, groupLayer, instanceLayers } = await persistProductLayers(segmented);
      const layers = [groupLayer, ...instanceLayers];
      const warnings = [];
      let backgroundCleanPlate = false;
      if (typeof createBackgroundCleanPlate === 'function') {
        try {
          const maskBuffer = await segmentationMaskToPng(groupMask);
          const cleanPlateResult = await createBackgroundCleanPlate({
            sourceBuffer: segmented.sourceBuffer,
            maskBuffer,
            textBlocks: segmented.plan.textBlocks,
            signal,
          });
          const cleanPlateBuffer = Buffer.isBuffer(cleanPlateResult) ? cleanPlateResult : cleanPlateResult?.buffer;
          if (!Buffer.isBuffer(cleanPlateBuffer) || !cleanPlateBuffer.length) throw new Error('empty clean plate');
          const normalizedBackground = await sharp(cleanPlateBuffer, { failOn: 'error' })
            .rotate()
            .resize(segmented.width, segmented.height, { fit: 'fill' })
            .png()
            .toBuffer();
          const asset = await persistPng(generatedAssetStore, normalizedBackground, 'canvas_layer_background_clean');
          layers.push({
            id: 'background',
            kind: 'image',
            semanticType: 'background',
            name: '背景净版',
            url: asset.url,
            assetId: asset.id,
            bounds: { x: 0, y: 0, width: 1, height: 1 },
            pixelWidth: segmented.width,
            pixelHeight: segmented.height,
            confidence: 1,
            editable: true,
          });
          backgroundCleanPlate = true;
        } catch {
          warnings.push('背景净版生成失败');
        }
      } else {
        warnings.push('背景净版生成失败');
      }
      layers.push(...segmented.plan.textBlocks.map(textLayer));
      return {
        status: warnings.length ? 'partial' : 'complete',
        layers,
        capabilities: {
          movableLayers: true,
          productGroup: true,
          productInstances: instanceLayers.length,
          backgroundCleanPlate,
          editableText: segmented.plan.textBlocks.length,
          psdExport: false,
        },
        warnings,
        segmentation: { method: 'sam3', requestId: segmented.requestId },
      };
    },
  };
}
