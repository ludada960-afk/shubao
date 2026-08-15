import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'https://shuimg.cn';

function authorizationHeaders(sessionToken, extra = {}) {
  return sessionToken ? { ...extra, Authorization: `Bearer ${sessionToken}` } : extra;
}

async function verifyAuthenticatedCanaries({ root, fetchImpl, sessionToken }) {
  const request = async (path, options = {}) => {
    const response = await fetchImpl(`${root}${path}`, {
      ...options,
      headers: authorizationHeaders(sessionToken, options.headers),
      signal: options.signal || AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} returned HTTP ${response.status}`);
    return response;
  };
  const jobsResponse = await request('/api/video/jobs');
  const jobsBody = await jobsResponse.json();
  if (!Array.isArray(jobsBody.jobs)) throw new Error('Owned video jobs response is incomplete');

  const operationsResponse = await request('/api/admin/video-operations');
  const operations = await operationsResponse.json();
  if (!operations || typeof operations !== 'object') throw new Error('Video operations response is incomplete');

  const created = await request('/api/video/uploads', {
    method: 'POST',
    headers: {
      'Tus-Resumable': '1.0.0',
      'Upload-Length': '1',
      'Upload-Metadata': 'filename Y2FuYXJ5LmJpbg==,filetype YXBwbGljYXRpb24vb2N0ZXQtc3RyZWFt,kind dmlkZW8=',
    },
  });
  const location = created.headers.get('location');
  if (!location) throw new Error('Video upload canary did not return a location');
  const uploadPath = new URL(location, root).pathname;
  await request(uploadPath, { method: 'DELETE', headers: { 'Tus-Resumable': '1.0.0' } });

  return { ownedJobs: jobsBody.jobs.length, uploadCreatedAndCancelled: true, operationsVisible: true };
}

export async function verifyProductionVideo({ baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch, sessionToken = '' } = {}) {
  const root = String(baseUrl).replace(/\/+$/, '');
  const response = await fetchImpl(`${root}/api/video/capabilities`, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Video capabilities returned HTTP ${response.status}`);
  const body = await response.json();
  if (typeof body.generationEnabled !== 'boolean' || !Array.isArray(body.products)) {
    throw new Error('Video capabilities response is incomplete');
  }
  const serialized = JSON.stringify(body);
  if (/sd5-seedance|providerCostCny|credential|api[_-]?key|minimax-h3-2k/i.test(serialized)) {
    throw new Error('Video capabilities leaked an internal route or credential field');
  }
  if (body.products.some(product => product.id === 'minimax_h3_2k')) {
    throw new Error('Hidden MiniMax product is exposed before verification');
  }
  for (const product of body.products) {
    if (!['seedance_fast', 'seedance_standard'].includes(product.id)) throw new Error(`Unexpected public video product: ${product.id}`);
    if (!product.quotes?.short?.sku || !product.quotes?.long?.sku) throw new Error(`Video product ${product.id} has incomplete quotes`);
    const expected = product.id === 'seedance_fast' ? [40000, 46000] : [62000, 72000];
    if (product.quotes.short.units !== expected[0] || product.quotes.long.units !== expected[1]) throw new Error(`Video product ${product.id} quote mismatch`);
  }
  if (body.generationEnabled && !body.products.some(product => product.id === 'seedance_standard')) {
    throw new Error('Video generation is enabled without a stable public product');
  }
  const canaries = sessionToken ? await verifyAuthenticatedCanaries({ root, fetchImpl, sessionToken }) : null;
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
