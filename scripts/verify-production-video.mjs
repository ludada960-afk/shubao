import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'https://shuimg.cn';

export async function verifyProductionVideo({ baseUrl = DEFAULT_BASE_URL, fetchImpl = fetch } = {}) {
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
  process.stdout.write(`Production video contract passed (${body.products.length} public products, generation ${body.generationEnabled ? 'enabled' : 'disabled'})\n`);
  return body;
}

export function parseArguments(argv) {
  const index = argv.indexOf('--base-url');
  return { baseUrl: index >= 0 ? argv[index + 1] || DEFAULT_BASE_URL : DEFAULT_BASE_URL };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) verifyProductionVideo(parseArguments(process.argv.slice(2))).catch(error => { console.error(error?.stack || error); process.exitCode = 1; });
