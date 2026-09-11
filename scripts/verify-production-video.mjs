import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'https://shuimg.cn';
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DEFAULT_RETRY_DELAYS_MS = Object.freeze([250, 750]);

function authorizationHeaders(sessionToken, extra = {}) {
  return sessionToken ? { ...extra, Authorization: `Bearer ${sessionToken}` } : extra;
}

async function readJson(response, context) {
  if (typeof response.text !== 'function') return response.json();
  const contentType = response.headers?.get?.('content-type') || 'unknown content-type';
  const body = await response.text();
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`${context} returned invalid JSON (${contentType}): ${body.slice(0, 180)}`);
  }
}

async function verifyAuthenticatedCanaries({ root, fetchImpl, sessionToken, sleep = delay => new Promise(resolve => setTimeout(resolve, delay)) }) {
  const request = async (path, options = {}) => {
    const method = String(options.method || 'GET').toUpperCase();
    const retryable = options.retryable ?? (method === 'GET' || method === 'DELETE');
    const maxAttempts = options.maxAttempts ?? (retryable ? DEFAULT_RETRY_DELAYS_MS.length + 1 : 1);
    let lastCause;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      let response;
      try {
        response = await fetchImpl(`${root}${path}`, {
          ...options,
          headers: authorizationHeaders(sessionToken, options.headers),
          signal: options.signal || AbortSignal.timeout(20_000),
        });
      } catch (cause) {
        lastCause = cause;
        if (retryable && attempt < maxAttempts - 1) {
          await sleep(DEFAULT_RETRY_DELAYS_MS[Math.min(attempt, DEFAULT_RETRY_DELAYS_MS.length - 1)]);
          continue;
        }
        throw new Error(`${method} ${path} fetch failed: ${cause?.message || cause}`);
      }
      if (response.ok) return response;
      // DELETE is used only for an ephemeral canary upload. A lost response can
      // leave the server already cleaned, so 404 is the desired end state.
      if (method === 'DELETE' && options.allowAlreadyGone && response.status === 404) return response;
      if (retryable && RETRYABLE_STATUS_CODES.has(response.status) && attempt < maxAttempts - 1) {
        await sleep(DEFAULT_RETRY_DELAYS_MS[Math.min(attempt, DEFAULT_RETRY_DELAYS_MS.length - 1)]);
        continue;
      }
      throw new Error(`${method} ${path} returned HTTP ${response.status}`);
    }
    throw new Error(`${method} ${path} fetch failed: ${lastCause?.message || 'request exhausted'}`);
  };
  const jobsResponse = await request('/api/video/jobs');
  const jobsBody = await readJson(jobsResponse, 'Owned video jobs response');
  if (!Array.isArray(jobsBody.jobs)) throw new Error('Owned video jobs response is incomplete');

  const operationsResponse = await request('/api/admin/video-operations');
  const operations = await readJson(operationsResponse, 'Video operations response');
  if (!operations || typeof operations !== 'object') throw new Error('Video operations response is incomplete');

  const created = await request('/api/video/uploads', {
    method: 'POST',
    headers: {
      'Tus-Resumable': '1.0.0',
      'Upload-Length': '1',
      'Upload-Metadata': 'filename Y2FuYXJ5Lm1wNA==,filetype dmlkZW8vbXA0,kind dmlkZW8=',
    },
  });
  const location = created.headers.get('location');
  if (!location) throw new Error('Video upload canary did not return a location');
  const uploadPath = new URL(location, root).pathname;
  await request(uploadPath, {
    method: 'DELETE',
    headers: { 'Tus-Resumable': '1.0.0' },
    allowAlreadyGone: true,
  });

  return { ownedJobs: jobsBody.jobs.length, uploadCreatedAndCancelled: true, operationsVisible: true };
}

export async function verifyProductionVideo({ baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch, sessionToken = '', sleep } = {}) {
  const root = String(baseUrl).replace(/\/+$/, '');
  let response;
  try {
    response = await fetchImpl(`${root}/api/video/capabilities`, { signal: AbortSignal.timeout(20_000) });
  } catch (cause) {
    throw new Error(`GET /api/video/capabilities fetch failed: ${cause?.message || cause}`);
  }
  if (!response.ok) throw new Error(`Video capabilities returned HTTP ${response.status}`);
  const body = await readJson(response, 'Video capabilities response');
  if (typeof body.generationEnabled !== 'boolean' || !Array.isArray(body.products)) {
    throw new Error('Video capabilities response is incomplete');
  }
  const serialized = JSON.stringify(body);
  if (/sd5-seedance|providerCostCny|credential|api[_-]?key|minimax-h3-2k/i.test(serialized)) {
    throw new Error('Video capabilities leaked an internal route or credential field');
  }
  /* 9-11 用户「全上」: 公开档扩到 10 个 (Seedance 快试/标准 + MiniMax 768P/2K + Grok + 万相 + 可灵 + 可灵 Pro + Veo + Seedance 2.5)。
     原「MiniMax 2K 未验收不得公开」的护栏已由用户拍板解除, 改为校验公开集合白名单。 */
  const APPROVED_PUBLIC_PRODUCTS = Object.freeze([
    'seedance_fast', 'seedance_standard', 'minimax_h3_768p', 'grok_fast', 'wan_standard',
    'kling_standard', 'kling_pro', 'veo_fast', 'seedance_25', 'minimax_h3_2k',
  ]);
  const publicIds = body.products.map(product => product.id).sort();
  const approvedIds = [...APPROVED_PUBLIC_PRODUCTS].sort();
  if (JSON.stringify(publicIds) !== JSON.stringify(approvedIds)) {
    throw new Error(`Public video product set drifted: ${publicIds.join(', ')}`);
  }
  /* 9-11: 公开产品集合 = Seedance 快试/标准 + MiniMax H3 768P (按条 ¥4.55 → 38000 units) */
  const PUBLIC_QUOTE_UNITS = Object.freeze({
    seedance_fast: [27000, 27000],
    seedance_standard: [46000, 57000],
    minimax_h3_768p: [38000, 38000],
    grok_fast: [6900, 8600],
    wan_standard: [4000, 4000],
    kling_standard: [16000, 16000],
    kling_pro: [32000, 32000],
    veo_fast: [11000, 11000],
    seedance_25: [43000, 43000],
    minimax_h3_2k: [65000, 65000],
  });
  for (const product of body.products) {
    const expected = PUBLIC_QUOTE_UNITS[product.id];
    if (!expected) throw new Error(`Unexpected public video product: ${product.id}`);
    if (!product.quotes?.short?.sku || !product.quotes?.long?.sku) throw new Error(`Video product ${product.id} has incomplete quotes`);
    if (product.quotes.short.units !== expected[0] || product.quotes.long.units !== expected[1]) throw new Error(`Video product ${product.id} quote mismatch`);
  }
  if (body.generationEnabled && !body.products.some(product => product.id === 'seedance_standard')) {
    throw new Error('Video generation is enabled without a stable public product');
  }
  const canaries = sessionToken ? await verifyAuthenticatedCanaries({ root, fetchImpl, sessionToken, sleep }) : null;
  process.stdout.write(`Production video contract passed (${body.products.length} public products, generation ${body.generationEnabled ? 'enabled' : 'disabled'}${canaries ? ', authenticated non-billable canaries passed' : ''})\n`);
  return { ...body, canaries };
}

export function parseArguments(argv) {
  const index = argv.indexOf('--base-url');
  return {
    baseUrl: index >= 0 ? argv[index + 1] || DEFAULT_BASE_URL : DEFAULT_BASE_URL,
    sessionToken: process.env.SHUBAO_CANARY_SESSION_TOKEN || '',
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) verifyProductionVideo(parseArguments(process.argv.slice(2))).catch(error => { console.error(error?.stack || error); process.exitCode = 1; });
