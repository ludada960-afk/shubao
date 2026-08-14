import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { requestJson } from './verify-production-billing.mjs';

const DEFAULT_ROOT = 'https://shuimg.cn';
const OWNER_EMAIL = '867550189@qq.com';
const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const AUDIT_ROOT = resolve(SCRIPT_ROOT, '../.tmp/production-visual-cases');
const TERMINAL_STATUSES = new Set(['completed', 'needs_review', 'failed', 'cancelled']);

function productionTryOnConfig(overrides = {}) {
  const caseId = overrides.caseId || process.env.SHUBAO_TRYON_CASE_ID || 'tryon-reference-result';
  return {
    caseId,
    productName: overrides.productName || process.env.SHUBAO_TRYON_PRODUCT_NAME || '赤陶夹克城市穿搭',
    itemFixture: resolve(SCRIPT_ROOT, overrides.itemFixture || process.env.SHUBAO_TRYON_ITEM_FIXTURE || '../public/images/home/tryon-showcase/reference-flatlay.png'),
    personFixture: resolve(SCRIPT_ROOT, overrides.personFixture || process.env.SHUBAO_TRYON_PERSON_FIXTURE || '../public/images/home/tryon-showcase/reference-person.png'),
    personMode: overrides.personMode || process.env.SHUBAO_TRYON_PERSON_MODE || 'reference',
    ratio: overrides.ratio || process.env.SHUBAO_TRYON_RATIO || '3:4',
    brief: overrides.brief || process.env.SHUBAO_TRYON_BRIEF || '商品组合完整自然上身，人物与空间连续，画面不添加文字。',
    submissionId: overrides.submissionId || process.env.SHUBAO_TRYON_SUBMISSION_ID || `ec_production_${caseId.replace(/[^a-z0-9_-]/gi, '_')}`,
  };
}

const wait = delay => new Promise(resolve => setTimeout(resolve, delay));

function required(value, label) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function stableAssetUrl(value) {
  const url = String(value || '').trim();
  if (!/^\/api\/generated-assets\/[a-f0-9]{64}\.(?:png|jpg|webp)$/i.test(url)) {
    throw new Error('Production try-on did not return a stable asset');
  }
  return url;
}

function safeAsset(value, label) {
  return {
    assetId: required(value?.assetId, `${label} asset ID`),
    url: required(value?.url, `${label} asset URL`),
  };
}

async function uploadAsset({ request, fixturePath, role }) {
  const bytes = await readFile(fixturePath);
  const response = await request('/api/ecommerce/assets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role, data: `data:image/png;base64,${bytes.toString('base64')}` }),
  });
  return safeAsset(response?.original, role);
}

export function productionTryOnDirectionPayload({ item, person = null, personMode = 'reference', productName = '赤陶夹克城市穿搭', ratio = '3:4', brief = '' }) {
  return {
    product_name: productName,
    category: '服饰穿搭',
    platform: '淘宝',
    description: brief || `把${productName}完整穿到参考模特身上，保持人物身份、姿态与场景，商品颜色、材质、版型、图案和数量不得改变。`,
    ability_recipe: {
      id: 'anything_tryon',
      version: 1,
      constraints: { preserveMaterial: true, preservePattern: true, consistentPersonScene: true },
    },
    person_mode: personMode,
    items: [item.url],
    person: person ? [person.url] : [],
    scene: [],
    real_shots: [item.url],
    ref_shots: [],
    requested_images: [{ key: 'main_3x4', label: '上身成片', count: 1, ratio, targetRatio: ratio }],
  };
}

export function productionTryOnGenerationPayload({ item, person = null, personMode = 'reference', direction, quoteId, productName = '赤陶夹克城市穿搭', ratio = '3:4', brief = '' }) {
  const abilityRecipe = {
    id: 'anything_tryon',
    version: 1,
    constraints: { preserveMaterial: true, preservePattern: true, consistentPersonScene: true },
  };
  return {
    product_name: productName,
    category: '服饰穿搭',
    platform: '淘宝',
    selling_points: brief || `完整复现${productName}；参考人物身份、体态、姿势和场景光线。`,
    direction: {
      ...direction,
      editableBrief: brief || direction?.execution_guide || direction?.one_liner || '商品组合完整自然上身，人物与空间连续，画面不添加文字。',
    },
    ability_recipe: abilityRecipe,
    person_mode: personMode,
    assets: { items: [item], person: person ? [person] : [], scene: [] },
    asset_roles: [
      { assetId: item.assetId, role: 'items', ordinal: 0 },
      ...(person ? [{ assetId: person.assetId, role: 'person', ordinal: 0 }] : []),
    ],
    sizing: {
      smart: false,
      resolution: '2K',
      imageModel: 'image2',
      images: [{ id: 'main_3x4', ratio, targetRatio: ratio, cropPolicy: 'none', count: 1 }],
    },
    billing_quote_id: quoteId,
  };
}

function existingTryOnWork(works, productName) {
  return (Array.isArray(works) ? works : []).find(work => (
    work?.abilityRecipe?.id === 'anything_tryon'
    && String(work?.product_name || '') === productName
    && Array.isArray(work?.images)
    && work.images.some(image => image?.url)
  ));
}

async function auditResult({ request, work, balanceBefore, balanceAfter, replay, config }) {
  const image = work.images.find(candidate => candidate?.url) || {};
  const stableUrl = stableAssetUrl(image.url);
  const taskId = required(work.taskId, 'try-on task ID');
  const ledger = await request('/api/billing/ledger?currency=ec_points&limit=100&offset=0');
  const ledgerEntry = (ledger?.entries || []).find(entry => (
    [entry?.referenceId, entry?.reference_id].includes(stableUrl)
    || [entry?.referenceId, entry?.reference_id].includes(stableUrl.split('/').at(-1))
  )) || null;
  const audit = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    case: { id: config.caseId, title: config.productName, ratio: image.ratio || config.ratio, skillId: 'anything_tryon' },
    taskId,
    requestKey: `production-${config.caseId}`,
    stableUrl,
    replay,
    billing: ledgerEntry,
    balanceBefore: balanceBefore?.balances?.ec_points || null,
    balanceAfter: balanceAfter?.balances?.ec_points || null,
    itemAsset: work.itemAssets?.[0] || null,
    personAsset: work.personAssets?.[0] || null,
    savedWorkKey: work._saveKey || work.id,
    publicFile: `/images/visual-recipes/cases/${config.caseId}.png`,
  };
  await mkdir(AUDIT_ROOT, { recursive: true });
  await writeFile(resolve(AUDIT_ROOT, `${config.caseId}.json`), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  return audit;
}

export async function generateProductionTryOnCase({ sessionToken, baseUrl = DEFAULT_ROOT, ...overrides } = {}) {
  const config = productionTryOnConfig(overrides);
  const token = required(sessionToken, 'SHUBAO_CANARY_SESSION_TOKEN');
  const root = required(baseUrl, 'baseUrl').replace(/\/+$/, '');
  const request = (path, options = {}) => requestJson(`${root}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, ...(options.headers || {}) },
    timeoutMs: options.timeoutMs ?? 180_000,
    maxAttempts: options.maxAttempts ?? 1,
  });
  const session = await request('/api/session');
  if (String(session?.email || '').trim().toLowerCase() !== OWNER_EMAIL) {
    throw new Error('Formal try-on case must use the main owner account');
  }

  const balanceBefore = await request('/api/billing/balance');
  const existing = existingTryOnWork(await request('/api/works'), config.productName);
  if (existing) {
    return auditResult({ request, work: existing, balanceBefore, balanceAfter: await request('/api/billing/balance'), replay: true, config });
  }

  const item = await uploadAsset({ request, fixturePath: config.itemFixture, role: 'product' });
  const person = config.personMode === 'reference'
    ? await uploadAsset({ request, fixturePath: config.personFixture, role: 'person' })
    : null;
  const directionResponse = await request('/api/ecommerce/design-directions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(productionTryOnDirectionPayload({ item, person, personMode: config.personMode, productName: config.productName, ratio: config.ratio, brief: config.brief })),
    timeoutMs: 120_000,
  });
  if (directionResponse?.degraded || !Array.isArray(directionResponse?.directions) || directionResponse.directions.length !== 1) {
    throw new Error('Production try-on design direction was degraded');
  }
  const quote = await request('/api/billing/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sku: 'ec_image_2k', quantity: 1 }),
  });
  if (quote?.quote?.totalUnits !== 1000 || !quote.quote.quoteId) throw new Error('Production try-on quote is invalid');
  const started = await request('/api/generate-ecommerce', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': config.submissionId },
    body: JSON.stringify(productionTryOnGenerationPayload({
      item,
      person,
      personMode: config.personMode,
      direction: directionResponse.directions[0],
      quoteId: quote.quote.quoteId,
      productName: config.productName,
      ratio: config.ratio,
      brief: config.brief,
    })),
  });
  const taskId = required(started?.taskId, 'try-on task ID');
  let task;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    task = (await request(`/api/ecommerce/jobs/${encodeURIComponent(taskId)}`))?.task;
    if (TERMINAL_STATUSES.has(task?.status)) break;
    await wait(2_000);
  }
  if (task?.status !== 'completed') throw new Error(`Production try-on ended as ${task?.status || 'timeout'}`);
  const work = existingTryOnWork(await request('/api/works'), config.productName);
  if (!work || work.taskId !== taskId) throw new Error('Production try-on work was not persisted');
  return auditResult({ request, work, balanceBefore, balanceAfter: await request('/api/billing/balance'), replay: false, config });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  generateProductionTryOnCase({
    sessionToken: process.env.SHUBAO_CANARY_SESSION_TOKEN || '',
    baseUrl: process.env.SHUBAO_BASE_URL || DEFAULT_ROOT,
  }).then(result => {
    console.log(JSON.stringify({ ok: true, taskId: result.taskId, stableUrl: result.stableUrl, replay: result.replay }, null, 2));
  }).catch(error => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
