import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import sharp from 'sharp';

import { requestJson } from './verify-production-billing.mjs';

const DEFAULT_ROOT = 'https://shuimg.cn';
const OWNER_EMAIL = '867550189@qq.com';
const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const AUDIT_ROOT = resolve(SCRIPT_ROOT, '../.tmp/production-ecommerce-showcase');
const AUDIT_PATH = resolve(AUDIT_ROOT, 'earbuds-suite.json');
const SOURCE_FIXTURE = resolve(SCRIPT_ROOT, '../public/images/home/ecommerce-showcase/earbuds-product-source.png');
const PUBLIC_ROOT = resolve(SCRIPT_ROOT, '../public/images/home/ecommerce-showcase');
const THUMB_ROOT = resolve(SCRIPT_ROOT, '../public/images/.thumbs/home/ecommerce-showcase');
const DETAIL_SUBMISSION_ID = 'showcase-20260815-earbuds-detail-suite-v2';
const COMPOSITE_REQUEST_KEY = 'showcase-20260815-earbuds-composite-v2';
const TERMINAL_STATUSES = new Set(['completed', 'needs_review', 'failed', 'cancelled']);

const DETAIL_SHOTS = Object.freeze([
  Object.freeze({ id: 'detail_identity', label: '商品品牌主视觉', file: 'earbuds-suite-panel-identity.png', purpose: '建立珍珠白与香槟金耳机的高级商品身份；商品和充电盒完整，中文克制。' }),
  Object.freeze({ id: 'detail_usage', label: '模特佩戴使用图', file: 'earbuds-suite-panel-usage.png', purpose: '成年女性在安静通勤环境中自然佩戴，完整耳机清楚可见，突出舒适与降噪使用感。' }),
  Object.freeze({ id: 'detail_structure', label: '声学结构爆炸图', file: 'earbuds-suite-panel-structure.png', purpose: '展示耳机声学腔体、动圈和金属细节的专业爆炸结构，产品结构保持一致。' }),
  Object.freeze({ id: 'detail_scene', label: '真实使用场景图', file: 'earbuds-suite-panel-scene.png', purpose: '会议或居家通话场景，人物、耳机和空间关系自然，呈现清晰通话价值。' }),
  Object.freeze({ id: 'detail_function', label: '续航与佩戴详情图', file: 'earbuds-suite-panel-function.png', purpose: '以充电盒、耳机和佩戴细节解释续航与轻盈佩戴，不编造认证、价格或未经确认的数字。' }),
]);

const COMPOSITE_PROMPT = `1:1 方形电商能力展示成片。严格使用输入的五张珍珠白与香槟金耳机详情图作为同一商品与同一视觉系统的依据，不改变耳机、充电盒、颜色、材质和金属装饰。构图参考成熟的多面板电商作品展示：上半部竖立四张有景深的详情面板，分别呈现品牌主视觉、安静通勤佩戴、声学结构和清晰通话；中央前景放大一只打开的充电盒与两只完整耳机，柔和香槟金光轨从左下贯穿到右上；左下放一个小型生成预览窗口，右下用两条简短准确中文“高效出图”“专业排版”。奶白、暖金、浅灰体系，真实高级电商质感，所有面板完整可辨，四周保留安全边距，不出现品牌 Logo、价格、水印或未经提供的参数。`;

const wait = delay => new Promise(resolvePromise => setTimeout(resolvePromise, delay));

function required(value, label) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${label} is required`);
  return text;
}

function cleanRoot(baseUrl) {
  return required(baseUrl, 'baseUrl').replace(/\/+$/, '');
}

function safeProductAsset(value) {
  return {
    assetId: required(value?.assetId, 'product asset ID'),
    url: required(value?.url, 'product asset URL'),
  };
}

export function assertStableAssets(values, expectedCount = null) {
  if (!Array.isArray(values) || values.length === 0) throw new Error('Stable asset list is required');
  if (expectedCount !== null && values.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} stable assets, received ${values.length}`);
  }
  const urls = values.map(value => required(value, 'stable asset URL'));
  if (urls.some(url => !/^\/api\/generated-assets\/[a-f0-9]{64}\.(?:png|jpg|webp)$/i.test(url))) {
    throw new Error('Production showcase returned a non-stable asset URL');
  }
  if (new Set(urls).size !== urls.length) throw new Error('Production showcase stable assets must be unique');
  return urls;
}

export function buildDetailDirectionPayload({ product }) {
  const source = safeProductAsset(product);
  return {
    product_name: '珍珠白香槟金真无线降噪耳机',
    category: '数码家电',
    platform: '淘宝',
    description: `生成一套统一、真实、可投放的高级耳机详情视觉。锁定珍珠白耳机、香槟金装饰与圆角充电盒的结构和材质，不出现品牌、价格、认证、水印或未经确认的参数。五张图依次覆盖：${DETAIL_SHOTS.map(shot => `${shot.label}（${shot.purpose}）`).join('；')}。`,
    real_shots: [source.url],
    ref_shots: [],
    requested_images: [{
      key: 'detail',
      label: '高级耳机详情图',
      count: DETAIL_SHOTS.length,
      ratio: '3:4',
      targetRatio: '3:4',
    }],
  };
}

export function buildDetailGenerationPayload({ product, direction, quoteId }) {
  const source = safeProductAsset(product);
  const safeDirection = direction && typeof direction === 'object' ? direction : {};
  return {
    product_name: '珍珠白香槟金真无线降噪耳机',
    category: '数码家电',
    platform: '淘宝',
    selling_points: '珍珠白机身、香槟金细节、主动降噪、清晰通话、轻盈佩戴与便携充电盒。不得添加未确认数字。',
    direction: {
      ...safeDirection,
      editableBrief: safeDirection.execution_guide || '五张竖版详情图使用同一商品、同一奶白暖金视觉系统；每张承担独立商业职责，商品完整且中文克制。',
    },
    assets: { product: [source], reference: [] },
    sizing: {
      smart: false,
      resolution: '2K',
      imageModel: 'image2',
      images: [{
        id: 'detail',
        ratio: '3:4',
        targetRatio: '3:4',
        cropPolicy: 'none',
        count: DETAIL_SHOTS.length,
      }],
    },
    billing_quote_id: required(quoteId, 'detail quote ID'),
  };
}

export function buildCompositePayload({ detailUrls, quoteId, requestKey = COMPOSITE_REQUEST_KEY }) {
  const stable = assertStableAssets(detailUrls, DETAIL_SHOTS.length);
  return {
    prompt: COMPOSITE_PROMPT,
    image_url: stable[0],
    reference_images: stable.slice(1),
    reference_metadata: stable.map((url, index) => ({
      url,
      mention: `@详情图 ${index + 1}`,
      role: 'reference',
    })),
    ratio: '1:1',
    resolution: '2K',
    image_model: 'image2',
    request_key: requestKey,
    creation_intent: 'visual',
    skill_id: 'free',
    billing_quote_id: required(quoteId, 'composite quote ID'),
    billing_action_id: `showcase-${requestKey}`,
  };
}

function assertDirection(response) {
  if (response?.degraded || response?.analysis?.status !== 'complete') {
    throw new Error('Production showcase detail direction was degraded');
  }
  if (!Array.isArray(response?.directions) || response.directions.length !== 1) {
    throw new Error('Production showcase requires exactly one detail direction');
  }
  return response.directions[0];
}

function completedDetailStage(task) {
  if (task?.status !== 'completed') {
    throw new Error(`Production showcase stage one ended as ${task?.status || 'timeout'}`);
  }
  const urls = (Array.isArray(task.assets) ? task.assets : []).map(asset => (
    asset?.state === 'completed' ? asset.stableUrl : ''
  ));
  return assertStableAssets(urls, DETAIL_SHOTS.length);
}

async function uploadProduct({ request, fixturePath }) {
  const bytes = await readFile(fixturePath);
  const response = await request('/api/ecommerce/assets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ role: 'product', data: `data:image/png;base64,${bytes.toString('base64')}` }),
  });
  return safeProductAsset(response?.original);
}

async function readAudit() {
  try {
    return JSON.parse(await readFile(AUDIT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

async function persistAudit(audit, enabled) {
  if (!enabled) return;
  await mkdir(AUDIT_ROOT, { recursive: true });
  await writeFile(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
}

async function downloadImage({ root, token, stableUrl, targetFile, ratio, fetchImpl }) {
  const response = await fetchImpl(`${root}${stableUrl}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'image/*' },
  });
  if (!response.ok) throw new Error(`Showcase asset download returned HTTP ${response.status}`);
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('image/')) throw new Error(`Showcase asset download returned ${contentType || 'unknown content type'}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 10_000) throw new Error('Showcase asset download was unexpectedly small');
  const metadata = await sharp(bytes).metadata();
  const [ratioWidth, ratioHeight] = ratio.split(':').map(Number);
  const expectedRatio = ratioWidth / ratioHeight;
  const actualRatio = Number(metadata.width) / Number(metadata.height);
  if (!Number.isFinite(actualRatio) || Math.abs(actualRatio - expectedRatio) > 0.03) {
    throw new Error(`Showcase asset ratio ${metadata.width}x${metadata.height} does not match ${ratio}`);
  }
  const publicPath = resolve(PUBLIC_ROOT, targetFile);
  const thumbPath = resolve(THUMB_ROOT, targetFile.replace(/\.(?:png|jpg|webp)$/i, '.webp'));
  await mkdir(PUBLIC_ROOT, { recursive: true });
  await mkdir(THUMB_ROOT, { recursive: true });
  await sharp(bytes).png().toFile(publicPath);
  await sharp(bytes)
    .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(thumbPath);
  return { publicPath, thumbPath, width: metadata.width, height: metadata.height, bytes: bytes.length };
}

async function downloadDetailStage({ audit, root, token, fetchImpl }) {
  const downloads = [];
  for (let index = 0; index < DETAIL_SHOTS.length; index += 1) {
    downloads.push(await downloadImage({
      root,
      token,
      stableUrl: audit.stageOne.stableUrls[index],
      targetFile: DETAIL_SHOTS[index].file,
      ratio: '3:4',
      fetchImpl,
    }));
  }
  audit.stageOne.downloads = downloads;
}

function defaultAudit() {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    stageOne: { status: 'pending', requestKey: DETAIL_SUBMISSION_ID },
    stageTwo: { status: 'pending', requestKey: COMPOSITE_REQUEST_KEY },
  };
}

export async function generateProductionEcommerceShowcase({
  sessionToken,
  baseUrl = DEFAULT_ROOT,
  fixturePath = SOURCE_FIXTURE,
  productAsset = null,
  request: injectedRequest = null,
  fetchImpl = fetch,
  pollIntervalMs = 2_000,
  maxPollAttempts = 300,
  resumeAudit,
  writeAudit = true,
  download = process.env.SHUBAO_SHOWCASE_DOWNLOAD === '1',
} = {}) {
  const token = required(sessionToken, 'SHUBAO_CANARY_SESSION_TOKEN');
  const root = cleanRoot(baseUrl);
  const request = injectedRequest || ((path, options = {}) => requestJson(`${root}${path}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, ...(options.headers || {}) },
    timeoutMs: options.timeoutMs ?? 180_000,
    maxAttempts: options.maxAttempts ?? 1,
  }));
  const session = await request('/api/session');
  if (String(session?.email || '').trim().toLowerCase() !== OWNER_EMAIL) {
    throw new Error('Formal ecommerce showcase must use the main owner account');
  }

  const balanceBefore = await request('/api/billing/balance');
  const savedAudit = resumeAudit || (writeAudit ? await readAudit() : null);
  const audit = savedAudit ? structuredClone(savedAudit) : defaultAudit();
  audit.generatedAt = new Date().toISOString();
  audit.balanceBefore = balanceBefore?.balances?.ec_points || null;

  if (audit.stageOne?.status === 'completed') {
    audit.stageOne.stableUrls = assertStableAssets(audit.stageOne.stableUrls, DETAIL_SHOTS.length);
  } else {
    let taskId = '';
    let quoteId = '';
    let task = null;
    try {
      const product = productAsset ? safeProductAsset(productAsset) : await uploadProduct({ request, fixturePath });
      const directionResponse = await request('/api/ecommerce/design-directions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildDetailDirectionPayload({ product })),
        timeoutMs: 120_000,
        maxAttempts: 1,
      });
      const direction = assertDirection(directionResponse);
      const quote = await request('/api/billing/quote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sku: 'ec_image_2k', quantity: DETAIL_SHOTS.length }),
        maxAttempts: 1,
      });
      if (quote?.quote?.totalUnits !== DETAIL_SHOTS.length * 1000 || !quote.quote.quoteId) {
        throw new Error('Production showcase stage-one quote is invalid');
      }
      quoteId = quote.quote.quoteId;
      const started = await request('/api/generate-ecommerce', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': DETAIL_SUBMISSION_ID },
        body: JSON.stringify(buildDetailGenerationPayload({ product, direction, quoteId })),
        maxAttempts: 1,
      });
      taskId = required(started?.taskId, 'showcase detail task ID');
      for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
        task = (await request(`/api/ecommerce/jobs/${encodeURIComponent(taskId)}`))?.task;
        if (TERMINAL_STATUSES.has(task?.status)) break;
        await wait(pollIntervalMs);
      }
      audit.stageOne = {
        status: 'completed',
        taskId,
        requestKey: DETAIL_SUBMISSION_ID,
        stableUrls: completedDetailStage(task),
        quoteId,
      };
      await persistAudit(audit, writeAudit);
      if (download) {
        await downloadDetailStage({ audit, root, token, fetchImpl });
        await persistAudit(audit, writeAudit);
      }
    } catch (cause) {
      audit.stageOne = {
        status: 'failed',
        taskId,
        requestKey: DETAIL_SUBMISSION_ID,
        quoteId,
        terminalStatus: String(task?.status || ''),
        failedAt: new Date().toISOString(),
        error: String(task?.error || cause?.message || cause),
      };
      try {
        const [balanceAfter, ledger] = await Promise.all([
          request('/api/billing/balance'),
          request('/api/billing/ledger?currency=ec_points&limit=100&offset=0'),
        ]);
        audit.balanceAfter = balanceAfter?.balances?.ec_points || null;
        audit.stageOne.ledgerEntries = (ledger?.entries || []).filter(entry => (
          [entry?.referenceId, entry?.reference_id].includes(taskId)
          || [entry?.idempotencyKey, entry?.idempotency_key].includes(DETAIL_SUBMISSION_ID)
        ));
      } catch {}
      await persistAudit(audit, writeAudit);
      const error = new Error(`Production showcase stage one failed: ${audit.stageOne.error}`, { cause });
      error.audit = audit;
      throw error;
    }
  }

  if (audit.stageTwo?.status === 'completed') {
    audit.stageTwo.stableUrl = assertStableAssets([audit.stageTwo.stableUrl], 1)[0];
    return audit;
  }

  try {
    const quote = await request('/api/billing/quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sku: 'ec_image_2k', quantity: 1 }),
      maxAttempts: 1,
    });
    if (quote?.quote?.totalUnits !== 1000 || !quote.quote.quoteId) {
      throw new Error('Production showcase stage-two quote is invalid');
    }
    const composite = await request('/api/canvas/regenerate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildCompositePayload({
        detailUrls: audit.stageOne.stableUrls,
        quoteId: quote.quote.quoteId,
        requestKey: audit.stageTwo?.requestKey || COMPOSITE_REQUEST_KEY,
      })),
      maxAttempts: 1,
    });
    const stableUrl = assertStableAssets([composite?.url], 1)[0];
    audit.stageTwo = {
      status: 'completed',
      taskId: required(composite?.taskId, 'showcase composite task ID'),
      requestKey: audit.stageTwo?.requestKey || COMPOSITE_REQUEST_KEY,
      stableUrl,
      quoteId: quote.quote.quoteId,
      billing: composite?.billing || null,
    };
    if (download) {
      audit.stageTwo.download = await downloadImage({
        root,
        token,
        stableUrl,
        targetFile: 'earbuds-suite-composite.png',
        ratio: '1:1',
        fetchImpl,
      });
    }
    const [balanceAfter, ledger] = await Promise.all([
      request('/api/billing/balance'),
      request('/api/billing/ledger?currency=ec_points&limit=100&offset=0'),
    ]);
    audit.balanceAfter = balanceAfter?.balances?.ec_points || null;
    audit.ledgerEntry = (ledger?.entries || []).find(entry => (
      [entry?.referenceId, entry?.reference_id].includes(stableUrl)
      || [entry?.referenceId, entry?.reference_id].includes(audit.stageTwo.taskId)
    )) || null;
    await persistAudit(audit, writeAudit);
    return audit;
  } catch (cause) {
    audit.stageTwo = {
      ...(audit.stageTwo || {}),
      status: 'failed',
      failedAt: new Date().toISOString(),
      error: String(cause?.message || cause),
    };
    await persistAudit(audit, writeAudit);
    const error = new Error(`Production showcase stage two failed: ${audit.stageTwo.error}`, { cause });
    error.audit = audit;
    throw error;
  }
}

function parseArguments(argv) {
  const options = {
    baseUrl: process.env.SHUBAO_BASE_URL || DEFAULT_ROOT,
    sessionToken: process.env.SHUBAO_CANARY_SESSION_TOKEN || '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--base-url') options.baseUrl = argv[++index] || options.baseUrl;
    else if (argv[index] === '--fixture-path') options.fixturePath = argv[++index] || SOURCE_FIXTURE;
  }
  return options;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  generateProductionEcommerceShowcase(parseArguments(process.argv.slice(2)))
    .then(result => {
      console.log(JSON.stringify({
        ok: true,
        stageOneTaskId: result.stageOne.taskId,
        stageOneStableUrls: result.stageOne.stableUrls,
        stageTwoTaskId: result.stageTwo.taskId,
        stageTwoStableUrl: result.stageTwo.stableUrl,
      }, null, 2));
    })
    .catch(error => {
      console.error(error?.stack || error);
      process.exitCode = 1;
    });
}
