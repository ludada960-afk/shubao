import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

import { requestJson } from './verify-production-billing.mjs';

const DEFAULT_BASE_URL = 'https://shuimg.cn';
const DEFAULT_FIXTURE_PATH = fileURLToPath(new URL('../test_image.png', import.meta.url));
const TERMINAL_STATUSES = new Set(['completed', 'needs_review', 'failed', 'cancelled']);
const DELIVERY_GROUPS = new Set(['白底图', '主图', '详情图', 'SKU', '素材']);

const wait = delay => new Promise(resolve => setTimeout(resolve, delay));

function requiredString(value, label) {
  const result = String(value || '').trim();
  if (!result) throw new Error(`${label} is required`);
  return result;
}

function rootUrl(baseUrl) {
  return requiredString(baseUrl, 'baseUrl').replace(/\/+$/, '');
}

function safeAsset(asset, label) {
  if (!asset || typeof asset !== 'object') throw new Error(`${label} asset upload is invalid`);
  const assetId = requiredString(asset.assetId, `${label} asset ID`);
  const url = requiredString(asset.url, `${label} asset URL`);
  return { assetId, url };
}

function canaryPayload({ product, reference, quoteId }) {
  return {
    product_name: '生产验收红苹果',
    category: '食品饮料',
    platform: '淘宝',
    selling_points: '红色苹果，新鲜果实，部署验收专用素材。',
    direction: {
      id: 'production-canary',
      title: '真实商品展示',
      editableBrief: '展示红苹果的真实外观，三个独立电商用途，不使用拼贴。',
    },
    assets: {
      product: [product],
      reference: [reference],
    },
    sizing: {
      resolution: '2K',
      images: [
        { id: 'main_text', ratio: '1:1', count: 1 },
        { id: 'detail', ratio: '3:4', count: 1 },
        { id: 'white_background', ratio: '1:1', count: 1 },
      ],
    },
    billing_quote_id: quoteId,
  };
}

function assertPlanContract(assetPlan) {
  const expectations = [
    { name: 'main image', matches: role => role === 'main_text', ratio: '1:1', size: '2048x2048' },
    { name: 'detail image', matches: role => role.startsWith('detail_slice_'), ratio: '3:4', size: '1536x2048' },
    { name: 'white-background image', matches: role => role === 'white_background', ratio: '1:1', size: '2048x2048' },
  ];
  const duties = new Set();
  for (const expectation of expectations) {
    const matches = assetPlan.filter(item => expectation.matches(String(item?.role || '')));
    if (matches.length !== 1) throw new Error(`Ecommerce production canary has an invalid ${expectation.name} plan`);
    const item = matches[0];
    if (item.ratio !== expectation.ratio || item.generationSize !== expectation.size) {
      throw new Error(`Ecommerce production canary has invalid ${expectation.name} dimensions`);
    }
    for (const field of ['label', 'commercialDutyId', 'communicationGoal', 'purpose']) {
      if (!String(item[field] || '').trim()) throw new Error(`Ecommerce production canary ${expectation.name} is missing ${field}`);
    }
    if (item.label === item.role || /undefined|null/i.test(item.label)) {
      throw new Error(`Ecommerce production canary ${expectation.name} exposes an internal label`);
    }
    if (duties.has(item.commercialDutyId)) throw new Error('Ecommerce production canary reused a commercial duty');
    duties.add(item.commercialDutyId);
  }
}

function assertCompletedTask(task) {
  if (!task || typeof task !== 'object') throw new Error('Ecommerce task response is invalid');
  if (task.status !== 'completed') throw new Error(`Ecommerce production canary ended as ${task.status || 'unknown'}`);
  if (!Array.isArray(task.assetPlan) || task.assetPlan.length !== 3) {
    throw new Error('Ecommerce production canary did not produce an exact three-item plan');
  }
  assertPlanContract(task.assetPlan);
  if (task.quote?.units !== 3) throw new Error('Ecommerce production canary quote count does not match the plan');
  if (!Array.isArray(task.assets) || task.assets.length !== 3) {
    throw new Error('Ecommerce production canary did not expose three asset rows');
  }
  const stableUrls = task.assets.map(asset => (
    asset?.state === 'completed' && typeof asset.stableUrl === 'string' ? asset.stableUrl : ''
  ));
  if (stableUrls.some(url => !url) || new Set(stableUrls).size !== 3) {
    throw new Error('Ecommerce production canary did not persist three unique stable assets');
  }
  const analysis = task.progress?.orchestrationSnapshot;
  if (!analysis?.productTruth || !analysis?.styleReferenceProfile
    || !analysis?.visualAnalysisCache?.product || !analysis?.visualAnalysisCache?.style) {
    throw new Error('Ecommerce production canary did not checkpoint independent visual analyses');
  }
  if (analysis.visualAnalysisCache.product === analysis.visualAnalysisCache.style) {
    throw new Error('Ecommerce production canary reused a cross-type visual-analysis cache entry');
  }
  if (task.progress?.executionCount?.quoteUnits !== 3) {
    throw new Error('Ecommerce production canary execution count does not reconcile to three quoted assets');
  }
  return stableUrls;
}

function assertSourceAsset(work, field, expected, label) {
  const assets = Array.isArray(work?.[field]) ? work[field] : [];
  if (!assets.some(asset => asset?.assetId === expected.assetId && asset?.url === expected.url)) {
    throw new Error(`Ecommerce production canary ${label} source is missing from Works`);
  }
}

function assertWorkContract({ work, task, stableUrls, product, reference }) {
  if (!work || typeof work !== 'object') throw new Error('Ecommerce production canary work is missing');
  assertSourceAsset(work, 'productAssets', product, 'product');
  assertSourceAsset(work, 'referenceAssets', reference, 'reference');
  for (const field of ['projectId', 'sourceVersionId', 'resultVersionId']) {
    if (!String(work[field] || '').trim() || work[field] !== task.progress?.[field]) {
      throw new Error(`Ecommerce production canary Work is missing ${field}`);
    }
  }
  const images = Array.isArray(work.images) ? work.images : [];
  if (images.length !== stableUrls.length) throw new Error('Ecommerce production canary Work does not contain the complete suite');
  for (const plan of task.assetPlan) {
    const image = images.find(candidate => candidate?.key === plan.id);
    if (!image || !stableUrls.includes(image.url)) throw new Error(`Ecommerce production canary Work is missing ${plan.id}`);
    if (!String(image.displayName || '').trim() || image.displayName === image.role || /undefined|null/i.test(image.displayName)) {
      throw new Error(`Ecommerce production canary Work has an invalid display name for ${plan.id}`);
    }
    if (!DELIVERY_GROUPS.has(image.group)) throw new Error(`Ecommerce production canary Work has an invalid group for ${plan.id}`);
    const [width, height] = plan.generationSize.split('x').map(Number);
    if (image.role !== plan.role || image.ratio !== plan.ratio || image.size !== plan.generationSize
      || image.width !== width || image.height !== height) {
      throw new Error(`Ecommerce production canary Work has invalid delivery metadata for ${plan.id}`);
    }
  }
}

async function readImageVariant({ root, stableUrl, variant, maxWidth, fetchImpl, sleep }) {
  const url = new URL(stableUrl, root);
  url.searchParams.set('variant', variant);
  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetchImpl(url, { headers: { accept: 'image/webp' } });
    if (response.ok) break;
    if (attempt < 2 && (response.status === 429 || response.status >= 500)) await sleep(250 * (attempt + 1));
    else break;
  }
  if (!response?.ok) throw new Error(`Ecommerce production canary ${variant} image variant is unavailable`);
  const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const cacheControl = String(response.headers.get('cache-control') || '').toLowerCase();
  if (contentType !== 'image/webp' || !cacheControl.includes('immutable')) {
    throw new Error(`Ecommerce production canary ${variant} image variant has invalid delivery headers`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const metadata = await sharp(buffer, { failOn: 'error' }).metadata();
  if (metadata.format !== 'webp' || !metadata.width || !metadata.height || metadata.width > maxWidth) {
    throw new Error(`Ecommerce production canary ${variant} image variant has invalid dimensions`);
  }
  return { width: metadata.width, height: metadata.height };
}

function canvasSnapshotForWork(work) {
  const sourceId = 'source-production-canary';
  const laneY = { '白底图': 80, '主图': 460, '详情图': 840, SKU: 1220, '素材': 1600 };
  const outputs = work.images.map((image, index) => ({
    id: `output-${image.key}`,
    kind: 'output',
    status: 'completed',
    assetId: image.key,
    name: image.displayName,
    displayLabel: image.displayName,
    group: image.group,
    role: image.role,
    ratio: image.ratio,
    url: image.url,
    x: 460 + index * 270,
    y: laneY[image.group],
    w: 230,
    h: image.ratio === '3:4' ? 307 : 230,
    sourceNodeIds: [sourceId],
  }));
  return {
    schemaVersion: 2,
    nodes: [{
      id: sourceId,
      kind: 'source_group',
      status: 'ready',
      name: '生产验收商品母图',
      assets: work.productAssets,
      x: 32,
      y: 80,
      w: 248,
      h: 220,
    }, ...outputs],
    connections: outputs.map(node => ({
      id: `edge-${sourceId}-${node.id}`,
      from: sourceId,
      to: node.id,
      fromNodeId: sourceId,
      toNodeId: node.id,
      relation: 'source-output',
      label: '',
    })),
    viewport: { x: 80, y: 40, scale: 1 },
  };
}

async function verifyCanvasPersistence({ root, headers, task, work, request }) {
  const snapshot = canvasSnapshotForWork(work);
  const created = await request(`${root}/api/canvas-sessions`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      projectId: task.progress.projectId,
      baseVersionId: task.progress.resultVersionId,
      snapshot,
    }),
  });
  const sessionId = requiredString(created?.session?.id, 'Ecommerce production canary Canvas session ID');
  if (created.session.revision !== 1) throw new Error('Ecommerce production canary Canvas session has an invalid initial revision');
  const savedSnapshot = { ...snapshot, viewport: { x: 24, y: 36, scale: 0.9 } };
  const saved = await request(`${root}/api/canvas-sessions/${encodeURIComponent(sessionId)}/save`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ expectedRevision: 1, snapshot: savedSnapshot }),
  });
  const restored = await request(`${root}/api/canvas-sessions/${encodeURIComponent(sessionId)}`, { headers });
  if (saved?.session?.revision !== 2 || restored?.session?.revision !== 2
    || JSON.stringify(restored.session.snapshot) !== JSON.stringify(savedSnapshot)) {
    throw new Error('Ecommerce production canary Canvas session did not persist exactly');
  }
  return sessionId;
}

async function uploadCanaryAsset({ root, headers, role, fixturePath, request }) {
  const bytes = await readFile(fixturePath);
  const response = await request(`${root}/api/ecommerce/assets`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      role,
      data: `data:image/png;base64,${bytes.toString('base64')}`,
    }),
  });
  return safeAsset(response?.original, role);
}

export async function verifyProductionEcommerce({
  baseUrl = DEFAULT_BASE_URL,
  sessionToken = '',
  fixturePath = DEFAULT_FIXTURE_PATH,
  fetchImpl = fetch,
  pollIntervalMs = 2_000,
  maxPollAttempts = 300,
  sleep = wait,
} = {}) {
  const token = requiredString(sessionToken, 'SHUBAO_CANARY_SESSION_TOKEN');
  if (!Number.isSafeInteger(maxPollAttempts) || maxPollAttempts <= 0) {
    throw new TypeError('maxPollAttempts must be a positive safe integer');
  }
  if (!Number.isSafeInteger(pollIntervalMs) || pollIntervalMs < 0) {
    throw new TypeError('pollIntervalMs must be a non-negative safe integer');
  }
  const root = rootUrl(baseUrl);
  const headers = { authorization: `Bearer ${token}` };
  const request = (url, options = {}) => requestJson(url, {
    ...options,
    fetchImpl,
    maxAttempts: 3,
  });

  const session = await request(`${root}/api/session`, { headers });
  if (session?.ok !== true || !String(session?.email || '').trim()) {
    throw new Error('Canary session is not authenticated');
  }

  const [product, reference] = await Promise.all([
    uploadCanaryAsset({ root, headers, role: 'product', fixturePath, request }),
    uploadCanaryAsset({ root, headers, role: 'reference', fixturePath, request }),
  ]);
  const quote = await request(`${root}/api/billing/quote`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ sku: 'ec_image_2k', quantity: 3 }),
  });
  if (quote?.quote?.totalUnits !== 3000 || !quote.quote.quoteId) {
    throw new Error('Ecommerce production canary quote is invalid');
  }
  const started = await request(`${root}/api/generate-ecommerce`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify(canaryPayload({ product, reference, quoteId: quote.quote.quoteId })),
  });
  const taskId = requiredString(started?.taskId, 'Ecommerce production canary task ID');

  let task;
  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    const response = await request(`${root}/api/ecommerce/jobs/${encodeURIComponent(taskId)}`, { headers });
    task = response?.task;
    if (TERMINAL_STATUSES.has(task?.status)) break;
    await sleep(pollIntervalMs);
  }
  if (!TERMINAL_STATUSES.has(task?.status)) {
    throw new Error(`Ecommerce production canary timed out for task ${taskId}`);
  }
  const stableUrls = assertCompletedTask(task);
  const works = await request(`${root}/api/works`, { headers });
  const work = Array.isArray(works) ? works.find(candidate => candidate?.taskId === taskId) : null;
  assertWorkContract({ work, task, stableUrls, product, reference });
  const [thumb, canvas] = await Promise.all([
    readImageVariant({ root, stableUrl: stableUrls[0], variant: 'thumb', maxWidth: 512, fetchImpl, sleep }),
    readImageVariant({ root, stableUrl: stableUrls[0], variant: 'canvas', maxWidth: 1280, fetchImpl, sleep }),
  ]);
  if (thumb.width > canvas.width || thumb.height > canvas.height) {
    throw new Error('Ecommerce production canary image variants are not ordered by display size');
  }
  const canvasSessionId = await verifyCanvasPersistence({ root, headers, task, work, request });
  console.log(`Ecommerce production verification passed: task ${taskId}, 3 stable assets`);
  return { taskId, stableUrls, canvasSessionId, ownerEmail: session.email };
}

function parseArguments(argv) {
  const options = { baseUrl: DEFAULT_BASE_URL, sessionToken: process.env.SHUBAO_CANARY_SESSION_TOKEN || '', fixturePath: DEFAULT_FIXTURE_PATH };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--base-url') options.baseUrl = argv[++index] || DEFAULT_BASE_URL;
    if (argv[index] === '--session-token') options.sessionToken = argv[++index] || '';
    if (argv[index] === '--fixture-path') options.fixturePath = argv[++index] || DEFAULT_FIXTURE_PATH;
  }
  return options;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  verifyProductionEcommerce(parseArguments(process.argv.slice(2))).catch(error => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
