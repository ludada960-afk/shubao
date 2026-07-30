import 'ag-psd/initialize-canvas.js';
import { readPsd, writePsdBuffer } from 'ag-psd';
import { createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';

import { renderTextLayer } from './textComposer.mjs';
import { layerCapabilities } from './layerService.mjs';

const PSD_READ_OPTIONS = Object.freeze({
  skipCompositeImageData: true,
  skipLayerImageData: true,
  skipThumbnail: true,
});

function cleanString(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 8192) {
    throw new TypeError(`${name} must be a positive integer no greater than 8192`);
  }
  return value;
}

function assertAssetStore(generatedAssetStore) {
  if (!generatedAssetStore || typeof generatedAssetStore.read !== 'function') {
    throw new TypeError('generatedAssetStore read is required');
  }
}

async function readAssetBuffer(generatedAssetStore, assetId, label) {
  const normalizedAssetId = cleanString(assetId);
  if (!normalizedAssetId) throw new TypeError(`${label} assetId is required`);
  const asset = await generatedAssetStore.read(normalizedAssetId);
  if (!asset?.buffer) throw Object.assign(new Error(`${label} asset not found`), { code: 'ASSET_NOT_FOUND' });
  return Buffer.from(asset.buffer);
}

async function pngCanvas(buffer, width, height) {
  const normalized = await sharp(buffer)
    .rotate()
    .resize(width, height, { fit: 'contain', position: 'centre' })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toBuffer();
  const image = await loadImage(normalized);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

async function assertDocumentSizedPng(generatedAssetStore, assetId, width, height, label) {
  const asset = await generatedAssetStore.read(cleanString(assetId));
  if (!asset?.buffer || asset.contentType !== 'image/png') throw new Error(`${label} must be a document-sized PNG`);
  const metadata = await sharp(asset.buffer).metadata();
  if (metadata.format !== 'png' || metadata.width !== width || metadata.height !== height) {
    throw new Error(`${label} must be a document-sized PNG`);
  }
}

async function layerToPsdChild(layer, index, { document, generatedAssetStore }) {
  const name = cleanString(layer.name, `图层 ${index + 1}`);
  if (layer.kind === 'image') {
    await assertDocumentSizedPng(generatedAssetStore, layer.assetId, document.width, document.height, 'pixel layer');
    await assertDocumentSizedPng(generatedAssetStore, layer.maskAssetId, document.width, document.height, 'pixel layer mask');
    const buffer = await readAssetBuffer(generatedAssetStore, layer.assetId, name);
    return {
      name,
      top: 0,
      left: 0,
      canvas: await pngCanvas(buffer, document.width, document.height),
    };
  }
  if (layer.kind === 'text') {
    const rendered = await renderTextLayer({
      ...layer,
      width: layer.width || document.width,
    });
    const canvas = createCanvas(document.width, document.height);
    const context = canvas.getContext('2d');
    const textPng = await sharp(Buffer.from(rendered.svg)).png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();
    const image = await loadImage(textPng);
    context.clearRect(0, 0, document.width, document.height);
    context.drawImage(image, layer.x || 0, layer.y || 0);
    return {
      name,
      top: 0,
      left: 0,
      canvas,
    };
  }
  throw new TypeError(`layers[${index}].kind must be image or text`);
}

export async function exportPsd({ document, generatedAssetStore } = {}) {
  assertAssetStore(generatedAssetStore);
  const width = positiveInteger(document?.width, 'width');
  const height = positiveInteger(document?.height, 'height');
  const layers = Array.isArray(document?.layers) ? document.layers : [];
  const capabilities = layerCapabilities({ ...document, width, height, layers });
  if (!capabilities.psdExport) throw new Error('PSD export requires verified pixel layers');
  const children = [];
  for (const [index, layer] of layers.entries()) {
    children.push(await layerToPsdChild(layer, index, { document: { ...document, width, height }, generatedAssetStore }));
  }
  const buffer = writePsdBuffer({ width, height, children }, { generateThumbnail: false });
  const structure = validatePsdStructure(buffer);
  if (structure.layerCount !== children.length) throw new Error('PSD structure validation failed');
  return buffer;
}

function flattenLayerNames(layers = [], names = []) {
  for (const layer of layers) {
    if (!layer) continue;
    if (Array.isArray(layer.children)) {
      flattenLayerNames(layer.children, names);
    } else if (cleanString(layer.name)) {
      names.push(cleanString(layer.name));
    }
  }
  return names;
}

export function validatePsdStructure(buffer) {
  const psd = readPsd(buffer, PSD_READ_OPTIONS);
  const layerNames = flattenLayerNames(psd.children || []);
  const layerCount = layerNames.length;
  const flattened = layerCount <= 1;
  if (flattened) throw new Error('PSD export requires verified pixel layers');
  return {
    width: psd.width,
    height: psd.height,
    layerNames,
    layerCount,
    flattened,
    pixelLayers: true,
  };
}
