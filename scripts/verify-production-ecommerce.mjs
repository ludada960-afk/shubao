import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { requestJson } from './verify-production-billing.mjs';

const DEFAULT_BASE_URL = 'https://shuimg.cn';
const DEFAULT_FIXTURE_PATH = fileURLToPath(new URL('../test_image.png', import.meta.url));
const TERMINAL_STATUSES = new Set(['completed', 'needs_review', 'failed', 'cancelled']);

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
        { id: 'main_3x4', ratio: '3:4', count: 1 },
        { id: 'white_background', ratio: '1:1', count: 1 },
      ],
    },
    billing_quote_id: quoteId,
  };
}

function assertCompletedTask(task) {
  if (!task || typeof task !== 'object') throw new Error('Ecommerce task response is invalid');
  if (task.status !== 'completed') throw new Error(`Ecommerce production canary ended as ${task.status || 'unknown'}`);
  if (!Array.isArray(task.assetPlan) || task.assetPlan.length !== 3) {
    throw new Error('Ecommerce production canary did not produce an exact three-item plan');
  }
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
  const workUrls = Array.isArray(work?.images)
    ? work.images.map(image => typeof image === 'string' ? image : image?.url).filter(Boolean)
    : [];
  if (!work || stableUrls.some(url => !workUrls.includes(url))) {
    throw new Error('Ecommerce production canary stable assets are missing from Works');
  }
  console.log(`Ecommerce production verification passed: task ${taskId}, 3 stable assets`);
  return { taskId, stableUrls, ownerEmail: session.email };
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
