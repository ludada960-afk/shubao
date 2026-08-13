import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { get as httpsGet } from 'node:https';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { requestJson } from './verify-production-billing.mjs';
import { productionVisualCaseById } from './production-visual-case-manifest.mjs';

const DEFAULT_ROOT = 'https://shuimg.cn';
const OWNER_EMAIL = '867550189@qq.com';
const OUTPUT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../.tmp/production-visual-cases');
const PUBLIC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/images/visual-recipes/cases');

function required(value, label) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function actionId(caseItem) {
  return `showcase-${createHash('sha256').update(caseItem.requestKey).digest('hex').slice(0, 24)}`;
}

function generationSku(caseItem) {
  return caseItem.resolution === '4K' ? 'ec_image_4k' : 'ec_image_2k';
}

function workFor(caseItem, result, createdAt) {
  const image = {
    id: result.taskId,
    key: `visual_${caseItem.id}`,
    assetId: result.taskId,
    label: caseItem.title,
    displayName: caseItem.title,
    url: result.url,
    role: 'visual_creation',
    group: '自由创作',
    ratio: caseItem.ratio,
    resolution: caseItem.resolution,
    requestKey: caseItem.requestKey,
    taskId: result.taskId,
  };
  return {
    id: `production-${caseItem.id}`,
    taskId: result.taskId,
    _saveKey: `production-${caseItem.id}`,
    _ecResult: true,
    workType: 'visual',
    product_name: caseItem.title,
    title: caseItem.title,
    category: '自由创作',
    platform: caseItem.platform || '自由创作',
    prompt: caseItem.prompt,
    visualSkillId: caseItem.skillId,
    imageModel: caseItem.imageModel,
    ratio: caseItem.ratio,
    resolution: caseItem.resolution,
    generationStatus: 'completed',
    createdAt,
    referenceAssets: [],
    images: [image],
    imageRecords: [image],
    replay: {
      creationIntent: 'visual',
      skillId: caseItem.skillId,
      skillControl: '',
      panelValues: caseItem.platform ? { platform: caseItem.platform } : {},
      prompt: caseItem.prompt,
      originalPrompt: caseItem.prompt,
      imageModel: caseItem.imageModel,
      ratio: caseItem.ratio,
      resolution: caseItem.resolution,
      referenceAssets: [],
      slots: [{ taskId: result.taskId, requestKey: caseItem.requestKey, url: result.url }],
    },
  };
}

function streamAsset(url, targetPath, timeoutMs = 90_000) {
  return new Promise((resolvePromise, rejectPromise) => {
    const tempPath = `${targetPath}.partial`;
    const request = httpsGet(url, { headers: { accept: 'image/png,image/webp,image/*' } }, response => {
      if (response.statusCode !== 200) {
        response.resume();
        rejectPromise(new Error(`Asset download returned HTTP ${response.statusCode}`));
        return;
      }
      const contentType = String(response.headers['content-type'] || '').toLowerCase();
      if (!contentType.startsWith('image/')) {
        response.resume();
        rejectPromise(new Error(`Asset download returned ${contentType || 'unknown content type'}`));
        return;
      }
      const hash = createHash('sha256');
      let bytes = 0;
      const output = createWriteStream(tempPath);
      response.on('data', chunk => {
        bytes += chunk.length;
        hash.update(chunk);
      });
      response.pipe(output);
      output.on('finish', async () => {
        output.close();
        try {
          if (bytes < 10_000) throw new Error('Downloaded asset is unexpectedly small');
          await rename(tempPath, targetPath);
          resolvePromise({ bytes, sha256: hash.digest('hex'), contentType });
        } catch (error) {
          await rm(tempPath, { force: true }).catch(() => undefined);
          rejectPromise(error);
        }
      });
      output.on('error', rejectPromise);
      response.on('error', rejectPromise);
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error('Asset download timed out')));
    request.on('error', rejectPromise);
  });
}

async function downloadAsset(root, assetUrl, targetPath, { sleep = setTimeout } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await streamAsset(new URL(assetUrl, root), targetPath);
    } catch (error) {
      lastError = error;
      if (attempt === 3) throw error;
      await new Promise(resolve => sleep(resolve, 1_000 * attempt));
    }
  }
  throw lastError || new Error('Asset download failed');
}

export async function generateProductionVisualCase({ caseId, sessionToken, baseUrl = DEFAULT_ROOT } = {}) {
  const item = productionVisualCaseById(required(caseId, 'caseId'));
  const token = required(sessionToken, 'SHUBAO_CANARY_SESSION_TOKEN');
  const root = required(baseUrl, 'baseUrl').replace(/\/+$/, '');
  const headers = { authorization: `Bearer ${token}` };
  const request = (path, options = {}) => requestJson(`${root}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    timeoutMs: 180_000,
    maxAttempts: options.maxAttempts ?? 1,
  });
  const shouldDownload = process.env.SHUBAO_VISUAL_CASE_DOWNLOAD === '1';

  const session = await request('/api/session');
  if (String(session?.email || '').trim().toLowerCase() !== OWNER_EMAIL) {
    throw new Error('Formal visual cases must use the main owner account');
  }
  const before = await request('/api/billing/balance');
  const existingWorks = await request('/api/works');
  const existing = (Array.isArray(existingWorks) ? existingWorks : [])
    .find(work => String(work?._saveKey || work?.id || '') === `production-${item.id}`);
  const existingImage = existing?.images?.[0] || existing?.imageRecords?.[0] || null;
  const existingUrl = typeof existingImage === 'string' ? existingImage : existingImage?.url || '';
  if (existing && existingUrl) {
    const existingTaskId = String(existingImage?.taskId || existing.taskId || '').trim();
    const existingResult = {
      taskId: existingTaskId,
      url: existingUrl,
      replay: true,
      ratio: item.ratio,
      resolution: item.resolution,
    };
    if (!/^\/api\/generated-assets\/[a-f0-9]{64}\.(?:png|jpg|webp)$/i.test(existingUrl)) {
      throw new Error(`Existing production visual work has an invalid stable asset: ${existingUrl}`);
    }
    const after = await request('/api/billing/balance');
    const ledger = await request('/api/billing/ledger?currency=ec_points&limit=100&offset=0');
    const entry = (ledger?.entries || []).find(candidate => candidate?.referenceId === existingUrl || candidate?.reference_id === existingUrl) || null;
    await mkdir(OUTPUT_ROOT, { recursive: true });
    await mkdir(PUBLIC_ROOT, { recursive: true });
    const publicFile = resolve(PUBLIC_ROOT, `${item.id}.png`);
    const downloaded = shouldDownload ? await downloadAsset(root, existingUrl, publicFile) : null;
    const audit = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      case: item,
      taskId: existingTaskId,
      requestKey: item.requestKey,
      billingActionId: actionId(item),
      stableUrl: existingUrl,
      replay: true,
      billing: null,
      balanceBefore: before?.balances?.ec_points || null,
      balanceAfter: after?.balances?.ec_points || null,
      ledgerEntry: entry,
      savedWorkKey: existing._saveKey || existing.id,
      publicFile: `/images/visual-recipes/cases/${item.id}.png`,
      downloaded,
      downloadPending: !downloaded,
      resumedFromWorks: true,
    };
    await writeFile(resolve(OUTPUT_ROOT, `${item.id}.json`), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
    return audit;
  }
  const quote = await request('/api/billing/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sku: generationSku(item), quantity: 1 }),
  });
  const result = await request('/api/canvas/regenerate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: item.prompt,
      image_url: '',
      reference_images: [],
      reference_metadata: [],
      ratio: item.ratio,
      resolution: item.resolution,
      image_model: item.imageModel,
      request_key: item.requestKey,
      creation_intent: 'visual',
      skill_id: item.skillId,
      billing_quote_id: quote?.quote?.quoteId,
      billing_action_id: actionId(item),
    }),
  });
  if (!/^\/api\/generated-assets\/[a-f0-9]{64}\.(?:png|jpg|webp)$/i.test(String(result?.url || ''))) {
    throw new Error('Production visual case did not return a stable asset');
  }
  if (!String(result?.taskId || '').startsWith('canvas_')) throw new Error('Production visual case did not return a task ID');

  const createdAt = Date.now();
  const work = workFor(item, result, createdAt);
  const saved = await request('/api/save-work', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ work }),
  });
  if (saved?.ok !== true) throw new Error('Production visual work was not saved');
  const after = await request('/api/billing/balance');
  const ledger = await request('/api/billing/ledger?currency=ec_points&limit=100&offset=0');
  const entry = (ledger?.entries || []).find(candidate => candidate?.referenceId === result.url || candidate?.reference_id === result.url) || null;

  await mkdir(OUTPUT_ROOT, { recursive: true });
  await mkdir(PUBLIC_ROOT, { recursive: true });
  const publicFile = resolve(PUBLIC_ROOT, `${item.id}.png`);
  const downloaded = shouldDownload ? await downloadAsset(root, result.url, publicFile) : null;
  const audit = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    case: item,
    taskId: result.taskId,
    requestKey: item.requestKey,
    billingActionId: actionId(item),
    stableUrl: result.url,
    replay: result.replay === true,
    billing: result.billing || null,
    balanceBefore: before?.balances?.ec_points || null,
    balanceAfter: after?.balances?.ec_points || null,
    ledgerEntry: entry,
    savedWorkKey: saved._saveKey || work._saveKey,
    publicFile: `/images/visual-recipes/cases/${item.id}.png`,
    downloaded,
    downloadPending: !downloaded,
  };
  await writeFile(resolve(OUTPUT_ROOT, `${item.id}.json`), `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  return audit;
}

export function parseArguments(argv, env = process.env) {
  const options = { caseId: '', sessionToken: env.SHUBAO_CANARY_SESSION_TOKEN || '', baseUrl: DEFAULT_ROOT };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--case') options.caseId = argv[++index] || '';
    else if (argv[index] === '--base-url') options.baseUrl = argv[++index] || DEFAULT_ROOT;
  }
  return options;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  generateProductionVisualCase(parseArguments(process.argv.slice(2)))
    .then(audit => console.log(JSON.stringify({
      caseId: audit.case.id,
      taskId: audit.taskId,
      stableUrl: audit.stableUrl,
      replay: audit.replay,
      billingStatus: audit.billing?.status || '',
      publicFile: audit.publicFile,
    })))
    .catch(error => {
      console.error(error?.stack || error);
      process.exitCode = 1;
    });
}
