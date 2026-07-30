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

function normalizeOwner(value) {
  return String(value || '').trim().toLowerCase();
}

function cleanAssetId(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function referenceMatchesAsset(value, assetId) {
  if (typeof value !== 'string') return false;
  if (value.trim() === assetId) return true;
  try {
    const parsed = new URL(value, 'https://shubao.invalid');
    return decodeURIComponent(parsed.pathname.split('/').filter(Boolean).at(-1) || '') === assetId;
  } catch {
    return false;
  }
}

function jsonReferencesAsset(value, assetId) {
  if (referenceMatchesAsset(value, assetId)) return true;
  if (Array.isArray(value)) return value.some(item => jsonReferencesAsset(item, assetId));
  if (!value || typeof value !== 'object') return false;
  return Object.values(value).some(item => jsonReferencesAsset(item, assetId));
}

function compositionLayersReferenceAsset(layers, assetId) {
  if (!Array.isArray(layers)) return false;
  return layers.some(layer => layer?.kind === 'image' && [
    layer.assetId,
    layer.maskAssetId,
    layer.sourceAssetId,
  ].some(value => referenceMatchesAsset(value, assetId)));
}

function parseJson(value) {
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}

export function createCompositionAssetAuthorizer({ db } = {}) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('db is required');
  return ({ ownerEmail, projectId, versionId, assetId }) => {
    const owner = normalizeOwner(ownerEmail);
    const normalizedAssetId = cleanAssetId(assetId);
    if (!owner || !projectId || !versionId || !normalizedAssetId) return false;
    const version = db.prepare(`SELECT pv.input_snapshot, pv.plan_snapshot
      FROM project_versions pv
      JOIN projects p ON p.id = pv.project_id
      WHERE pv.id = ? AND pv.project_id = ? AND p.owner_email = ? AND p.deleted_at IS NULL`)
      .get(versionId, projectId, owner);
    if (!version) return false;
    if (jsonReferencesAsset(parseJson(version.input_snapshot), normalizedAssetId)
      || jsonReferencesAsset(parseJson(version.plan_snapshot), normalizedAssetId)) return true;
    const projectAssets = db.prepare(`SELECT id, stable_url FROM project_assets
      WHERE owner_email = ? AND project_id = ? AND deleted_at IS NULL
        AND (version_id IS NULL OR version_id = ?)`)
      .all(owner, projectId, versionId);
    if (projectAssets.some(row => row.id === normalizedAssetId || referenceMatchesAsset(row.stable_url, normalizedAssetId))) return true;
    const compositionAssets = db.prepare(`SELECT cr.rendered_asset_id
      FROM composition_documents cd
      JOIN composition_revisions cr ON cr.document_id = cd.id
      WHERE cd.owner_email = ? AND cd.project_id = ? AND cd.version_id = ?
        AND cr.rendered_asset_id IS NOT NULL`)
      .all(owner, projectId, versionId);
    if (compositionAssets.some(row => row.rendered_asset_id === normalizedAssetId)) return true;
    const compositionLayers = db.prepare(`SELECT cr.layers
      FROM composition_documents cd
      JOIN composition_revisions cr ON cr.document_id = cd.id
      WHERE cd.owner_email = ? AND cd.project_id = ? AND cd.version_id = ?`)
      .all(owner, projectId, versionId);
    return compositionLayers.some(row => compositionLayersReferenceAsset(parseJson(row.layers), normalizedAssetId));
  };
}

async function validateLayers(layers, width, height) {
  if (!Array.isArray(layers)) throw new TypeError('layers must be an array');
  if (layers.length > MAX_LAYERS) throw new TypeError(`layers must not exceed ${MAX_LAYERS} entries`);
  return Promise.all(layers.map(async (layer, index) => {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) throw new TypeError(`layers[${index}] must be an object`);
    if (layer.pixelLayer === true) throw new TypeError('pixelLayer is server-managed');
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

export function createCompositionService({ compositionStore, generatedAssetStore, assetAuthorizer } = {}) {
  if (!compositionStore
    || typeof compositionStore.createDocument !== 'function'
    || typeof compositionStore.saveRevision !== 'function'
    || typeof compositionStore.getDocument !== 'function'
    || typeof compositionStore.listDocuments !== 'function') {
    throw new TypeError('compositionStore is required');
  }
  if (!generatedAssetStore
    || typeof generatedAssetStore.persistBuffer !== 'function'
    || typeof generatedAssetStore.read !== 'function') {
    throw new TypeError('generatedAssetStore persistBuffer and read are required');
  }
  if (typeof assetAuthorizer !== 'function') throw new TypeError('assetAuthorizer is required');

  async function assertAssetAuthorized({ ownerEmail, projectId, versionId, assetId, label }) {
    if (!await assetAuthorizer({ ownerEmail, projectId, versionId, assetId })) {
      throw codedError('ASSET_NOT_FOUND', `${label} asset not found`);
    }
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
    const authorization = {
      ownerEmail: document.ownerEmail,
      projectId: document.projectId,
      versionId: document.versionId,
    };
    if (backgroundAssetId) {
      await assertAssetAuthorized({ ...authorization, assetId: backgroundAssetId.trim(), label: 'background' });
    }
    for (const layer of layers) {
      if (layer.kind === 'image') {
        await assertAssetAuthorized({ ...authorization, assetId: layer.assetId, label: 'image layer' });
      }
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

  async function persistRenderedAsset(document, buffer) {
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
    return asset;
  }

  const api = {
    getDocument(input) {
      return compositionStore.getDocument(input);
    },

    listDocuments(input) {
      return compositionStore.listDocuments(input);
    },

    async createDocument(input = {}) {
      const width = positiveInteger(input.width, 'width');
      const height = positiveInteger(input.height, 'height');
      const layers = await validateLayers(input.layers || [], width, height);
      const backgroundAssetId = input.backgroundAssetId ?? null;
      const draft = { ...input, width, height, backgroundAssetId, layers, id: 'pending', revision: 1 };
      const buffer = await renderDocument(draft);
      const asset = await persistRenderedAsset(draft, buffer);
      const document = compositionStore.createDocument({ ...input, width, height, backgroundAssetId, renderedAssetId: asset.id, layers });
      return { document, asset };
    },

    async saveRevision(input = {}) {
      const current = compositionStore.getDocument({ ownerEmail: input.ownerEmail, documentId: input.documentId });
      if (!current) throw codedError('DOCUMENT_NOT_FOUND', 'composition document not found');
      const layers = await validateLayers(input.layers, current.width, current.height);
      const backgroundAssetId = input.backgroundAssetId === undefined ? current.backgroundAssetId : input.backgroundAssetId;
      const draft = { ...current, revision: input.expectedRevision + 1, layers, backgroundAssetId };
      const buffer = await renderDocument(draft);
      const asset = await persistRenderedAsset(draft, buffer);
      const document = compositionStore.saveRevision({ ...input, layers, backgroundAssetId, renderedAssetId: asset.id });
      return { document, asset };
    },

    renderDocument,
  };

  return api;
}
