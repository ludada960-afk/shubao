import sharp from 'sharp';

import { renderTextLayer } from './textComposer.mjs';

const MAX_DIMENSION = 8192;
const MAX_LAYERS = 64;

function codedError(code, message) {
  return Object.assign(new Error(message), { code });
}

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

async function validateLayers(layers, width, height) {
  if (!Array.isArray(layers)) throw new TypeError('layers must be an array');
  if (layers.length > MAX_LAYERS) throw new TypeError(`layers must not exceed ${MAX_LAYERS} entries`);
  return Promise.all(layers.map(async (layer, index) => {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) throw new TypeError(`layers[${index}] must be an object`);
    const kind = layer.kind;
    if (kind !== 'text' && kind !== 'image') throw new TypeError(`layers[${index}].kind must be text or image`);
    const x = coordinate(layer.x ?? 0, `layers[${index}].x`, width);
    const y = coordinate(layer.y ?? 0, `layers[${index}].y`, height);
    if (kind === 'image') {
      if (typeof layer.assetId !== 'string' || !layer.assetId.trim()) throw new TypeError(`layers[${index}].assetId is required`);
      const layerWidth = positiveInteger(layer.width, `layers[${index}].width`);
      const layerHeight = positiveInteger(layer.height, `layers[${index}].height`);
      if (x + layerWidth > width || y + layerHeight > height) throw new TypeError(`layers[${index}] exceeds document dimensions`);
      return { ...layer, assetId: layer.assetId.trim(), x, y, width: layerWidth, height: layerHeight };
    }
    const layerWidth = positiveInteger(layer.width, `layers[${index}].width`);
    if (x + layerWidth > width) throw new TypeError(`layers[${index}] exceeds document width`);
    const normalized = { ...layer, x, y, width: layerWidth };
    const rendered = await renderTextLayer(normalized);
    if (y + rendered.metrics.height > height) throw new TypeError(`layers[${index}] exceeds document height`);
    return normalized;
  }));
}

export function createCompositionService({ compositionStore, generatedAssetStore } = {}) {
  if (!compositionStore
    || typeof compositionStore.createDocument !== 'function'
    || typeof compositionStore.saveRevision !== 'function'
    || typeof compositionStore.getDocument !== 'function'
    || typeof compositionStore.linkRenderedAsset !== 'function') {
    throw new TypeError('compositionStore is required');
  }
  if (!generatedAssetStore
    || typeof generatedAssetStore.persistBuffer !== 'function'
    || typeof generatedAssetStore.read !== 'function') {
    throw new TypeError('generatedAssetStore persistBuffer and read are required');
  }

  async function readAsset(assetId, label) {
    const asset = await generatedAssetStore.read(assetId);
    if (!asset?.buffer) throw codedError('ASSET_NOT_FOUND', `${label} asset not found`);
    return asset.buffer;
  }

  async function renderDocument(document) {
    const width = positiveInteger(document?.width, 'width');
    const height = positiveInteger(document?.height, 'height');
    const layers = await validateLayers(document?.layers || [], width, height);
    const backgroundAssetId = document?.backgroundAssetId;
    if (backgroundAssetId !== null && backgroundAssetId !== undefined
      && (typeof backgroundAssetId !== 'string' || !backgroundAssetId.trim())) {
      throw new TypeError('backgroundAssetId must be a non-empty string or null');
    }
    let base;
    if (backgroundAssetId) {
      const background = await readAsset(backgroundAssetId.trim(), 'background');
      base = sharp(background).rotate().resize(width, height, { fit: 'cover', position: 'centre' }).ensureAlpha();
    } else {
      base = sharp({
        create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
      });
    }

    const composites = [];
    for (const layer of layers) {
      if (layer.visible === false) continue;
      if (layer.kind === 'image') {
        const source = await readAsset(layer.assetId, 'image layer');
        const input = await sharp(source)
          .rotate()
          .resize(layer.width, layer.height, { fit: 'contain', position: 'centre' })
          .png({ compressionLevel: 9, adaptiveFiltering: false })
          .toBuffer();
        composites.push({ input, left: layer.x, top: layer.y });
        continue;
      }
      const rendered = await renderTextLayer(layer);
      if (layer.y + rendered.metrics.height > height) throw new TypeError(`text layer ${layer.id || ''} exceeds document height`.trim());
      composites.push({ input: rendered.svg, left: layer.x, top: layer.y });
    }

    return base
      .composite(composites)
      .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
      .toBuffer();
  }

  async function renderAndLink(document, buffer) {
    const asset = await generatedAssetStore.persistBuffer({
      buffer,
      contentType: 'image/png',
      taskId: `composition-${document.id}-r${document.revision}`,
      label: 'ecommerce_text_composition',
    });
    const stored = await generatedAssetStore.read(asset.id);
    if (!stored?.buffer || !stored.buffer.equals(buffer)) {
      throw codedError('GENERATED_ASSET_INTEGRITY_ERROR', 'rendered composition integrity check failed');
    }
    compositionStore.linkRenderedAsset({
      ownerEmail: document.ownerEmail,
      documentId: document.id,
      revision: document.revision,
      renderedAssetId: asset.id,
    });
    return {
      document: compositionStore.getDocument({ ownerEmail: document.ownerEmail, documentId: document.id }),
      asset,
    };
  }

  const api = {
    getDocument(input) {
      return compositionStore.getDocument(input);
    },

    async createDocument(input = {}) {
      const width = positiveInteger(input.width, 'width');
      const height = positiveInteger(input.height, 'height');
      const layers = await validateLayers(input.layers || [], width, height);
      const backgroundAssetId = input.backgroundAssetId ?? null;
      const buffer = await renderDocument({ width, height, backgroundAssetId, layers });
      const document = compositionStore.createDocument({ ...input, width, height, backgroundAssetId, layers });
      return renderAndLink(document, buffer);
    },

    async saveRevision(input = {}) {
      const current = compositionStore.getDocument({ ownerEmail: input.ownerEmail, documentId: input.documentId });
      if (!current) throw codedError('DOCUMENT_NOT_FOUND', 'composition document not found');
      const layers = await validateLayers(input.layers, current.width, current.height);
      const backgroundAssetId = input.backgroundAssetId === undefined ? current.backgroundAssetId : input.backgroundAssetId;
      const buffer = await renderDocument({ ...current, layers, backgroundAssetId });
      const document = compositionStore.saveRevision({ ...input, layers });
      return renderAndLink(document, buffer);
    },

    renderDocument,
  };

  return api;
}
