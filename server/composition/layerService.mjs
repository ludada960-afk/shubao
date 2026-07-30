import sharp from 'sharp';

const MAX_DIMENSION = 8192;
const MAX_LAYERS = 64;

function positiveInteger(value, name, maximum = MAX_DIMENSION) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new TypeError(`${name} must be a positive integer no greater than ${maximum}`);
  }
  return value;
}

function coordinate(value, name, maximum) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new TypeError(`${name} must be a non-negative integer within the document`);
  }
  return value;
}

function cleanString(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function safeLayerId(layer = {}, index = 0) {
  return cleanString(layer.id, `layer-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

function normalizeSemanticLayer(layer = {}, index = 0) {
  return {
    id: safeLayerId(layer, index),
    name: cleanString(layer.name, `图层 ${index + 1}`).slice(0, 40),
    description: cleanString(layer.description).slice(0, 240),
    kind: cleanString(layer.kind, 'semantic'),
  };
}

function imageLayersHavePixels(layers = []) {
  return layers.every(layer => (
    layer?.kind === 'text'
    || (cleanString(layer?.assetId) && cleanString(layer?.maskAssetId))
  ));
}

export function layerCapabilities(document = {}) {
  const layers = Array.isArray(document.layers) ? document.layers : [];
  const semanticAnalysis = true;
  const pixelLayers = layers.length > 1 && imageLayersHavePixels(layers);
  return {
    semanticAnalysis,
    pixelLayers,
    psdExport: pixelLayers,
  };
}

export async function analyzeScene({ width, height, layers = [] } = {}) {
  return {
    width: positiveInteger(width, 'width'),
    height: positiveInteger(height, 'height'),
    layers: (Array.isArray(layers) ? layers : []).slice(0, MAX_LAYERS).map(normalizeSemanticLayer),
    capabilities: {
      semanticAnalysis: true,
      pixelLayers: false,
      psdExport: false,
    },
  };
}

function assertAssetStore(generatedAssetStore) {
  if (!generatedAssetStore
    || typeof generatedAssetStore.read !== 'function'
    || typeof generatedAssetStore.persistBuffer !== 'function') {
    throw new TypeError('generatedAssetStore read and persistBuffer are required');
  }
}

async function persistPng(generatedAssetStore, { buffer, taskId, label }) {
  const asset = await generatedAssetStore.persistBuffer({
    buffer,
    contentType: 'image/png',
    taskId,
    label,
  });
  if (!asset?.id) throw new Error('pixel layer storage did not return an asset id');
  return asset;
}

async function readImageAsset(generatedAssetStore, assetId, label) {
  const normalizedAssetId = cleanString(assetId);
  if (!normalizedAssetId) throw new TypeError(`${label} assetId is required`);
  const asset = await generatedAssetStore.read(normalizedAssetId);
  if (!asset?.buffer) throw Object.assign(new Error(`${label} asset not found`), { code: 'ASSET_NOT_FOUND' });
  return Buffer.from(asset.buffer);
}

async function createDocumentSizedLayer({ generatedAssetStore, document, layer, index }) {
  const id = safeLayerId(layer, index);
  const width = positiveInteger(document.width, 'width');
  const height = positiveInteger(document.height, 'height');
  const x = coordinate(layer.x ?? 0, `layers[${index}].x`, width);
  const y = coordinate(layer.y ?? 0, `layers[${index}].y`, height);
  const layerWidth = positiveInteger(layer.width, `layers[${index}].width`);
  const layerHeight = positiveInteger(layer.height, `layers[${index}].height`);
  if (x + layerWidth > width || y + layerHeight > height) {
    throw new TypeError(`layers[${index}] exceeds document dimensions`);
  }
  const source = await readImageAsset(generatedAssetStore, layer.assetId, `layers[${index}]`);
  const resized = await sharp(source)
    .rotate()
    .resize(layerWidth, layerHeight, { fit: 'contain', position: 'centre' })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
  const transparent = { r: 255, g: 255, b: 255, alpha: 0 };
  const opaque = { r: 255, g: 255, b: 255, alpha: 1 };
  const layerBuffer = await sharp({
    create: { width, height, channels: 4, background: transparent },
  }).composite([{ input: resized, left: x, top: y }]).png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();
  const maskRegion = await sharp({
    create: { width: layerWidth, height: layerHeight, channels: 4, background: opaque },
  }).png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();
  const maskBuffer = await sharp({
    create: { width, height, channels: 4, background: transparent },
  }).composite([{ input: maskRegion, left: x, top: y }]).png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();
  const taskId = `composition-layer-${cleanString(document.id, 'document')}-r${document.revision || 1}`;
  const [layerAsset, maskAsset] = await Promise.all([
    persistPng(generatedAssetStore, {
      buffer: layerBuffer,
      taskId,
      label: `composition_pixel_layer_${id}`,
    }),
    persistPng(generatedAssetStore, {
      buffer: maskBuffer,
      taskId,
      label: `composition_pixel_mask_${id}`,
    }),
  ]);
  return {
    ...layer,
    id,
    name: cleanString(layer.name, `图层 ${index + 1}`),
    sourceAssetId: cleanString(layer.assetId),
    assetId: layerAsset.id,
    maskAssetId: maskAsset.id,
    x: 0,
    y: 0,
    width,
    height,
    pixelLayer: true,
  };
}

export async function createPixelLayers({ document, generatedAssetStore } = {}) {
  assertAssetStore(generatedAssetStore);
  const width = positiveInteger(document?.width, 'width');
  const height = positiveInteger(document?.height, 'height');
  const layers = Array.isArray(document?.layers) ? document.layers : [];
  if (layers.length > MAX_LAYERS) throw new TypeError(`layers must not exceed ${MAX_LAYERS} entries`);
  const pixelLayers = [];
  for (const [index, layer] of layers.entries()) {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) throw new TypeError(`layers[${index}] must be an object`);
    if (layer.kind === 'image') {
      pixelLayers.push(await createDocumentSizedLayer({ generatedAssetStore, document: { ...document, width, height }, layer, index }));
      continue;
    }
    if (layer.kind === 'text') {
      pixelLayers.push({
        ...layer,
        id: safeLayerId(layer, index),
        name: cleanString(layer.name, `图层 ${index + 1}`),
      });
      continue;
    }
    throw new TypeError(`layers[${index}].kind must be image or text`);
  }
  const result = {
    ...document,
    width,
    height,
    layers: pixelLayers,
  };
  return {
    ...result,
    capabilities: layerCapabilities(result),
  };
}
