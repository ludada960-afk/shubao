import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';

const DEFAULT_BASE_URL = 'https://shuimg.cn';
const DEFAULT_TIMEOUT_MS = 300_000;

function requiredString(value, label) {
  const result = String(value || '').trim();
  if (!result) throw new Error(`${label} is required`);
  return result;
}

function positiveInteger(value, label) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result <= 0) throw new TypeError(`${label} must be a positive integer`);
  return result;
}

function imageContentType(format) {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'webp') return 'image/webp';
  if (format === 'png') return 'image/png';
  throw new Error(`Unsupported verification image format: ${format || 'unknown'}`);
}

async function request(url, {
  method = 'GET',
  headers = {},
  body,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const response = await fetchImpl(url, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response?.ok) {
    const payload = await response?.json?.().catch(() => ({}));
    throw new Error(`${method} ${new URL(String(url)).pathname} failed with HTTP ${response?.status || 0}: ${payload?.code || payload?.error || 'unknown error'}`);
  }
  return response;
}

async function requestJson(url, options = {}) {
  const response = await request(url, options);
  return response.json();
}

export function assertOwnedGeneratedAssetUrl(value, baseUrl = DEFAULT_BASE_URL) {
  const root = new URL(requiredString(baseUrl, 'baseUrl'));
  const candidate = new URL(requiredString(value, 'owned generated asset URL'), root);
  if (candidate.origin !== root.origin || !candidate.pathname.startsWith('/api/generated-assets/')) {
    throw new Error('Canvas verification requires an owned generated asset URL');
  }
  return candidate;
}

async function inspectOwnedImage({ value, baseUrl, fetchImpl, timeoutMs, requireTransparency }) {
  const assetUrl = assertOwnedGeneratedAssetUrl(value, baseUrl);
  assetUrl.searchParams.set('variant', 'full');
  assetUrl.searchParams.set('format', 'png');
  const reads = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await request(assetUrl, {
      headers: { accept: 'image/png' },
      fetchImpl,
      timeoutMs,
    });
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new Error('Canvas generated asset is empty');
    const metadata = await sharp(buffer, { failOn: 'error' }).metadata();
    if (!metadata.width || !metadata.height) throw new Error('Canvas generated asset has invalid dimensions');
    reads.push({ buffer, metadata });
  }
  const firstHash = crypto.createHash('sha256').update(reads[0].buffer).digest('hex');
  const secondHash = crypto.createHash('sha256').update(reads[1].buffer).digest('hex');
  if (firstHash !== secondHash) throw new Error('Canvas generated asset is not stable across reloads');

  const { data, info } = await sharp(reads[0].buffer, { failOn: 'error' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let visiblePixels = 0;
  let transparentPixels = 0;
  for (let index = 3; index < data.length; index += info.channels) {
    if (data[index] > 5) visiblePixels += 1;
    if (data[index] < 250) transparentPixels += 1;
  }
  const totalPixels = info.width * info.height;
  const visibleCoverage = visiblePixels / totalPixels;
  const transparentCoverage = transparentPixels / totalPixels;
  if (!visiblePixels) throw new Error('Canvas generated asset has no visible pixels');
  if (requireTransparency && transparentCoverage < 0.01) {
    throw new Error('Canvas product result has no meaningful transparent coverage and may be an opaque source copy');
  }
  if (requireTransparency && visibleCoverage < 0.01) {
    throw new Error('Canvas product result has no meaningful visible coverage');
  }
  const pixelHash = crypto.createHash('sha256')
    .update(`${info.width}x${info.height}:`)
    .update(data)
    .digest('hex');
  return {
    url: new URL(value, baseUrl).href,
    width: info.width,
    height: info.height,
    visiblePixels,
    transparentPixels,
    visibleCoverage,
    transparentCoverage,
    sha256: firstHash,
    pixelHash,
    rgba: data,
    channels: info.channels,
  };
}

function publicAssetInspection(asset) {
  const { rgba, channels, ...publicFields } = asset;
  return publicFields;
}

function normalizedBounds(layer) {
  const bounds = layer?.bounds;
  const values = [bounds?.x, bounds?.y, bounds?.width, bounds?.height].map(Number);
  if (!values.every(Number.isFinite) || values[0] < 0 || values[1] < 0 || values[2] <= 0 || values[3] <= 0
    || values[0] + values[2] > 1.000001 || values[1] + values[3] > 1.000001) {
    throw new Error(`Canvas layer ${layer?.id || 'unknown'} has invalid source bounds`);
  }
  return { x: values[0], y: values[1], width: values[2], height: values[3] };
}

function boundsIoU(left, right) {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y));
  const intersection = width * height;
  return intersection / Math.max(Number.EPSILON, left.width * left.height + right.width * right.height - intersection);
}

function boundsContain(outer, inner, tolerance = 0.02) {
  return outer.x <= inner.x + tolerance
    && outer.y <= inner.y + tolerance
    && outer.x + outer.width + tolerance >= inner.x + inner.width
    && outer.y + outer.height + tolerance >= inner.y + inner.height;
}

export function assertInstancePixelCoverage({
  target,
  targetBounds,
  instance,
  instanceBounds,
  label = 'target image',
  minimumCoverage = 0.98,
} = {}) {
  if (!Buffer.isBuffer(target?.rgba) || !Buffer.isBuffer(instance?.rgba)) {
    throw new TypeError('Decoded target and instance pixels are required');
  }
  let visible = 0;
  let covered = 0;
  const targetChannels = Number(target.channels) || 4;
  const instanceChannels = Number(instance.channels) || 4;
  for (let y = 0; y < instance.height; y += 1) {
    for (let x = 0; x < instance.width; x += 1) {
      const instanceOffset = (y * instance.width + x) * instanceChannels;
      if (instance.rgba[instanceOffset + instanceChannels - 1] <= 5) continue;
      visible += 1;
      const sourceX = instanceBounds.x + ((x + 0.5) / instance.width) * instanceBounds.width;
      const sourceY = instanceBounds.y + ((y + 0.5) / instance.height) * instanceBounds.height;
      const targetX = Math.floor(((sourceX - targetBounds.x) / targetBounds.width) * target.width);
      const targetY = Math.floor(((sourceY - targetBounds.y) / targetBounds.height) * target.height);
      if (targetX < 0 || targetY < 0 || targetX >= target.width || targetY >= target.height) continue;
      const targetOffset = (targetY * target.width + targetX) * targetChannels;
      if (target.rgba[targetOffset + targetChannels - 1] <= 5) continue;
      const colorDelta = Math.max(
        Math.abs(target.rgba[targetOffset] - instance.rgba[instanceOffset]),
        Math.abs(target.rgba[targetOffset + 1] - instance.rgba[instanceOffset + 1]),
        Math.abs(target.rgba[targetOffset + 2] - instance.rgba[instanceOffset + 2]),
      );
      if (colorDelta <= 12) covered += 1;
    }
  }
  const coverage = covered / Math.max(1, visible);
  if (!visible || coverage < minimumCoverage) {
    throw new Error(`${label} does not cover the product instance pixels (${Math.round(coverage * 100)}%)`);
  }
  return coverage;
}

export async function verifyRestoredImageAssets({
  snapshot,
  expectedAssetsByUrl,
  baseUrl,
  fetchImpl,
  timeoutMs,
} = {}) {
  const imageNodes = Array.isArray(snapshot?.nodes)
    ? snapshot.nodes.filter(node => node?.kind === 'image' && String(node?.url || '').trim())
    : [];
  for (const node of imageNodes) {
    const absoluteUrl = new URL(String(node.url), baseUrl).href;
    const expected = expectedAssetsByUrl?.get(absoluteUrl);
    if (!expected?.pixelHash) throw new Error(`Canvas reload has no pre-save asset evidence for ${node.id || absoluteUrl}`);
    const restored = await inspectOwnedImage({
      value: node.url,
      baseUrl,
      fetchImpl,
      timeoutMs,
      requireTransparency: ['remove-background', 'product-group', 'product-instance'].includes(node.semanticType),
    });
    if (restored.pixelHash !== expected.pixelHash) {
      throw new Error(`Image asset ${node.id || absoluteUrl} changed after Canvas save and reload`);
    }
  }
}

async function createQuote({ root, headers, sku, fetchImpl, timeoutMs }) {
  const data = await requestJson(`${root}/api/billing/quote`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ sku, quantity: 1 }),
    fetchImpl,
    timeoutMs,
  });
  return requiredString(data?.quote?.quoteId, `${sku} quote ID`);
}

export async function createVerifierSegmentationMasks(prompts = []) {
  if (!Array.isArray(prompts) || !prompts.length || prompts.length > 8) {
    throw new Error('Canvas segmentation plan has an invalid prompt count');
  }
  const size = 320;
  const inset = 8;
  const pixels = Buffer.alloc(size * size, 0);
  const center = (size - 1) / 2;
  const radius = center - inset;
  for (let y = inset; y < size - inset; y += 1) {
    for (let x = inset; x < size - inset; x += 1) {
      const normalizedX = (x - center) / radius;
      const normalizedY = (y - center) / radius;
      if ((normalizedX * normalizedX) + (normalizedY * normalizedY) <= 1) {
        pixels[y * size + x] = 255;
      }
    }
  }
  const png = await sharp(pixels, { raw: { width: size, height: size, channels: 1 } }).png().toBuffer();
  const data = `data:image/png;base64,${png.toString('base64')}`;
  return prompts.map((prompt, index) => {
    const promptId = requiredString(prompt?.id, `segmentation prompt ${index + 1} ID`);
    const box = Array.isArray(prompt?.box) ? prompt.box.map(Number) : [];
    if (box.length !== 4 || !box.every(Number.isSafeInteger)
      || box[0] < 0 || box[1] < 0 || box[2] <= box[0] || box[3] <= box[1]) {
      throw new Error(`Canvas segmentation prompt ${promptId} has invalid bounds`);
    }
    return { prompt_id: promptId, data };
  });
}

async function createSegmentationPlan({ root, headers, imageUrl, requiredInstances, fetchImpl, timeoutMs }) {
  const plan = await requestJson(`${root}/api/canvas/segmentation-plan`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl }),
    fetchImpl,
    timeoutMs,
  });
  const prompts = Array.isArray(plan?.prompts) ? plan.prompts : [];
  if (prompts.length < requiredInstances) {
    throw new Error(`Canvas segmentation plan did not detect the expected product instances (${prompts.length}/${requiredInstances})`);
  }
  return {
    token: requiredString(plan?.plan_token, 'Canvas segmentation plan token'),
    masks: await createVerifierSegmentationMasks(prompts),
  };
}

async function runBilledCanvasAction({
  root,
  headers,
  sku,
  path,
  imageUrl,
  actionKey,
  segmentationPlanToken,
  segmentationMasks,
  fetchImpl,
  timeoutMs,
}) {
  const quoteId = await createQuote({ root, headers, sku, fetchImpl, timeoutMs });
  return requestJson(`${root}${path}`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      segmentation_plan_token: segmentationPlanToken,
      segmentation_masks: segmentationMasks,
      billing_quote_id: quoteId,
      billing_action_id: actionKey || `canvas-verifier-${sku}-${crypto.randomUUID()}`,
    }),
    fetchImpl,
    timeoutMs,
  });
}

async function verifyCanvasPersistence({ root, headers, layers, expectedAssetsByUrl, fetchImpl, timeoutMs }) {
  const idempotencyKey = `canvas-segmentation-verifier-${crypto.randomUUID()}`;
  const createdProject = await requestJson(`${root}/api/projects`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify({ kind: 'ecommerce', title: 'Canvas 分层生产验收' }),
    fetchImpl,
    timeoutMs,
  });
  const projectId = requiredString(createdProject?.project?.id, 'Canvas verification project ID');
  const createdVersion = await requestJson(`${root}/api/projects/${encodeURIComponent(projectId)}/versions`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      reason: 'canvas_save',
      inputSnapshot: { source: 'canvas-segmentation-verifier' },
      planSnapshot: { expectedLayers: layers.length },
    }),
    fetchImpl,
    timeoutMs,
  });
  const versionId = requiredString(createdVersion?.version?.id, 'Canvas verification version ID');
  const snapshot = {
    schemaVersion: 2,
    nodes: [
      {
        id: 'verified-source',
        kind: 'image',
        semanticType: 'source',
        x: 80,
        y: 80,
      },
      ...layers.map((layer, index) => ({
        id: `verified-layer-${index + 1}`,
        kind: layer.kind,
        semanticType: layer.semanticType,
        url: layer.url || '',
        text: layer.text || '',
        x: 360 + (index % 3) * 280,
        y: 80 + Math.floor(index / 3) * 340,
      })),
    ],
    connections: layers.map((_, index) => ({
      id: `verified-edge-${index + 1}`,
      fromNodeId: 'verified-source',
      toNodeId: `verified-layer-${index + 1}`,
      relation: 'derived',
    })),
    viewport: { x: 0, y: 0, scale: 1 },
  };
  const createdSession = await requestJson(`${root}/api/canvas-sessions`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ projectId, baseVersionId: versionId, snapshot }),
    fetchImpl,
    timeoutMs,
  });
  const sessionId = requiredString(createdSession?.session?.id, 'Canvas verification session ID');
  if (createdSession?.session?.revision !== 1) throw new Error('Canvas verification session has an invalid initial revision');
  const savedSnapshot = { ...snapshot, viewport: { x: 24, y: 36, scale: 0.9 } };
  const saved = await requestJson(`${root}/api/canvas-sessions/${encodeURIComponent(sessionId)}/save`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ expectedRevision: 1, snapshot: savedSnapshot }),
    fetchImpl,
    timeoutMs,
  });
  const restored = await requestJson(`${root}/api/canvas-sessions/${encodeURIComponent(sessionId)}`, {
    headers,
    fetchImpl,
    timeoutMs,
  });
  if (saved?.session?.revision !== 2 || restored?.session?.revision !== 2
    || JSON.stringify(restored?.session?.snapshot) !== JSON.stringify(savedSnapshot)) {
    throw new Error('Canvas segmentation layers did not persist exactly across save and reload');
  }
  await verifyRestoredImageAssets({
    snapshot: restored.session.snapshot,
    expectedAssetsByUrl,
    baseUrl: root,
    fetchImpl,
    timeoutMs,
  });
  return sessionId;
}

export async function verifyCanvasSegmentation({
  baseUrl = DEFAULT_BASE_URL,
  sessionToken = '',
  imagePath,
  expectedInstances = 3,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  const root = requiredString(baseUrl, 'baseUrl').replace(/\/+$/, '');
  const token = requiredString(sessionToken, 'SHUBAO_CANARY_SESSION_TOKEN');
  const requiredInstances = positiveInteger(expectedInstances, 'expectedInstances');
  const bytes = await readFile(requiredString(imagePath, 'imagePath'));
  const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
  const sourceDataUrl = `data:${imageContentType(metadata.format)};base64,${bytes.toString('base64')}`;
  const sourcePixels = await sharp(bytes, { failOn: 'error' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const sourcePixelHash = crypto.createHash('sha256')
    .update(`${sourcePixels.info.width}x${sourcePixels.info.height}:`)
    .update(sourcePixels.data)
    .digest('hex');
  // The verifier can be interrupted after the request reaches the server. Derive
  // billing ids from the exact source pixels so a retry replays the same charge.
  const verifierActionPrefix = `canvas-verifier-${sourcePixelHash.slice(0, 32)}`;
  const sourceAsset = {
    rgba: sourcePixels.data,
    width: sourcePixels.info.width,
    height: sourcePixels.info.height,
    channels: sourcePixels.info.channels,
  };
  const headers = { authorization: `Bearer ${token}` };
  const session = await requestJson(`${root}/api/session`, { headers, fetchImpl, timeoutMs });
  if (session?.ok !== true) throw new Error('Canvas verification session is invalid');
  const segmentation = await createSegmentationPlan({
    root,
    headers,
    imageUrl: sourceDataUrl,
    requiredInstances,
    fetchImpl,
    timeoutMs,
  });

  const removeResult = await runBilledCanvasAction({
    root,
    headers,
    sku: 'ec_remove_bg',
    path: '/api/remove-bg',
    imageUrl: sourceDataUrl,
    actionKey: `${verifierActionPrefix}-remove-bg`,
    segmentationPlanToken: segmentation.token,
    segmentationMasks: segmentation.masks,
    fetchImpl,
    timeoutMs,
  });
  if (Number(removeResult?.subjectCount) < requiredInstances) {
    throw new Error(`Remove Background did not preserve the expected three product instances (${removeResult?.subjectCount || 0}/${requiredInstances})`);
  }
  const removedAsset = await inspectOwnedImage({
    value: removeResult?.url || removeResult?.result_url,
    baseUrl: root,
    fetchImpl,
    timeoutMs,
    requireTransparency: true,
  });
  if (removedAsset.pixelHash === sourcePixelHash) throw new Error('Remove Background returned an unchanged source copy');
  const removedBounds = normalizedBounds({ id: 'remove-background', bounds: removeResult?.bounds });

  const layerResult = await runBilledCanvasAction({
    root,
    headers,
    sku: 'ec_smart_layer',
    path: '/api/canvas/analyze-layers',
    imageUrl: sourceDataUrl,
    actionKey: `${verifierActionPrefix}-smart-layer`,
    segmentationPlanToken: segmentation.token,
    segmentationMasks: segmentation.masks,
    fetchImpl,
    timeoutMs,
  });
  const layers = Array.isArray(layerResult?.layers) ? layerResult.layers : [];
  const groups = layers.filter(layer => layer?.semanticType === 'product-group' && layer?.kind === 'image');
  const instances = layers.filter(layer => layer?.semanticType === 'product-instance' && layer?.kind === 'image');
  if (groups.length !== 1) throw new Error(`Smart Layering must return exactly one product group, received ${groups.length}`);
  if (instances.length < requiredInstances) {
    throw new Error(`Smart Layering did not return the expected three product instances (${instances.length}/${requiredInstances})`);
  }
  const instanceIds = instances.map(layer => requiredString(layer?.id, 'product instance ID'));
  if (new Set(instanceIds).size !== instanceIds.length) throw new Error('Smart Layering returned duplicate product instance IDs');
  const groupBounds = normalizedBounds(groups[0]);
  const instanceBounds = instances.map(normalizedBounds);
  for (let index = 0; index < instanceBounds.length; index += 1) {
    if (!boundsContain(groupBounds, instanceBounds[index])) {
      throw new Error(`Product group bounds do not contain instance ${instanceIds[index]}`);
    }
    for (let other = index + 1; other < instanceBounds.length; other += 1) {
      if (boundsIoU(instanceBounds[index], instanceBounds[other]) >= 0.9) {
        throw new Error('Smart Layering returned duplicate product instance bounds');
      }
    }
  }
  if (Number(layerResult?.capabilities?.productInstances) < requiredInstances) {
    throw new Error('Smart Layering capability count does not match the returned product layers');
  }
  const imageLayers = layers.filter(layer => layer?.kind === 'image');
  const inspectedLayers = [];
  for (const layer of imageLayers) {
    inspectedLayers.push({
      id: layer.id,
      semanticType: layer.semanticType,
      ...(await inspectOwnedImage({
        value: layer.url,
        baseUrl: root,
        fetchImpl,
        timeoutMs,
        requireTransparency: ['product-group', 'product-instance'].includes(layer.semanticType),
      })),
    });
  }
  const inspectedById = new Map(inspectedLayers.map(layer => [String(layer.id), layer]));
  const instancePixelHashes = instances.map(layer => inspectedById.get(String(layer.id))?.pixelHash);
  if (instancePixelHashes.some(hash => !hash) || new Set(instancePixelHashes).size !== instancePixelHashes.length) {
    throw new Error('Smart Layering returned duplicate product instance pixels');
  }
  const groupPixelHash = inspectedById.get(String(groups[0].id))?.pixelHash;
  if (!groupPixelHash || instancePixelHashes.includes(groupPixelHash)) {
    throw new Error('Product group is not distinct from its product instances');
  }
  const groupAsset = inspectedById.get(String(groups[0].id));
  instances.forEach((layer, index) => {
    const instanceAsset = inspectedById.get(String(layer.id));
    assertInstancePixelCoverage({
      target: sourceAsset,
      targetBounds: { x: 0, y: 0, width: 1, height: 1 },
      instance: instanceAsset,
      instanceBounds: instanceBounds[index],
      label: 'Source image',
    });
    assertInstancePixelCoverage({
      target: groupAsset,
      targetBounds: groupBounds,
      instance: instanceAsset,
      instanceBounds: instanceBounds[index],
      label: 'Product group',
    });
    assertInstancePixelCoverage({
      target: removedAsset,
      targetBounds: removedBounds,
      instance: instanceAsset,
      instanceBounds: instanceBounds[index],
      label: 'Remove Background result',
    });
  });
  const persistenceLayers = [
    {
      id: 'verified-remove-background',
      kind: 'image',
      semanticType: 'remove-background',
      url: removedAsset.url,
    },
    ...layers,
  ];
  const expectedAssetsByUrl = new Map([
    [removedAsset.url, removedAsset],
    ...inspectedLayers.map(asset => [asset.url, asset]),
  ]);
  const canvasSessionId = await verifyCanvasPersistence({
    root,
    headers,
    layers: persistenceLayers,
    expectedAssetsByUrl,
    fetchImpl,
    timeoutMs,
  });
  return {
    baseUrl: root,
    removeBackground: {
      method: removeResult.method,
      subjectCount: Number(removeResult.subjectCount),
      asset: publicAssetInspection(removedAsset),
    },
    smartLayers: {
      status: layerResult.status,
      productInstances: instances.length,
      productGroup: groups.length === 1,
      backgroundCleanPlate: layerResult?.capabilities?.backgroundCleanPlate === true,
      editableText: Number(layerResult?.capabilities?.editableText) || 0,
      warnings: Array.isArray(layerResult?.warnings) ? layerResult.warnings : [],
      assets: inspectedLayers.map(publicAssetInspection),
    },
    canvasSessionId,
  };
}

function parseArguments(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    sessionToken: process.env.SHUBAO_CANARY_SESSION_TOKEN || '',
    imagePath: '',
    expectedInstances: 3,
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--base-url') options.baseUrl = argv[++index] || DEFAULT_BASE_URL;
    else if (argv[index] === '--session-token') options.sessionToken = argv[++index] || '';
    else if (argv[index] === '--image') options.imagePath = argv[++index] || '';
    else if (argv[index] === '--expected-instances') options.expectedInstances = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return options;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  verifyCanvasSegmentation(parseArguments(process.argv.slice(2)))
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      console.log(`Canvas segmentation verification passed: ${result.smartLayers.productInstances} product instances, session ${result.canvasSessionId}`);
    })
    .catch(error => {
      console.error(error?.stack || error);
      process.exitCode = 1;
    });
}
