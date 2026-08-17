import { pathToFileURL } from 'node:url';

const DEFAULT_BASE_URL = 'https://shuimg.cn';
const DEFAULT_TIMEOUT_MS = 20_000;
const CANARY_OWNER_EMAIL = '867550189@qq.com';

const wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

async function request(url, {
  method = 'GET',
  headers = {},
  body,
  fetchImpl = fetch,
  maxAttempts = 3,
  retryDelayMs = 1_000,
  sleep = wait,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method,
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`${method} ${url} returned HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) throw error;
      console.warn(`Production probe attempt ${attempt} failed: ${error.message}`);
      await sleep(retryDelayMs * attempt);
    }
  }
  throw lastError;
}

export async function requestJson(url, options = {}) {
  const response = await request(url, options);
  return response.json();
}

export async function verifyProduction({ baseUrl = DEFAULT_BASE_URL, sessionToken = '' } = {}) {
  if (!String(sessionToken || '').trim()) throw new Error('SHUBAO_CANARY_SESSION_TOKEN is required');
  const root = baseUrl.replace(/\/+$/, '');
  const homepage = await requestJson(`${root}/health`);
  if (homepage.ok !== true && !['ok', 'healthy'].includes(homepage.status)) {
    throw new Error('Health endpoint is not ready');
  }
  if (homepage.imageQueue == null) throw new Error('Health endpoint has no imageQueue state');

  await request(root);

  const catalog = await requestJson(`${root}/api/billing/catalog`);
  if (!catalog.products) throw new Error('Billing catalog has no products');
  if ((catalog.providers || []).some((provider) => provider.enabled === true)) {
    throw new Error('Production catalog exposes an enabled payment provider');
  }

  const headers = { authorization: `Bearer ${sessionToken}` };
  const session = await requestJson(`${root}/api/session`, { headers });
  if (String(session?.email || '').trim().toLowerCase() !== CANARY_OWNER_EMAIL) {
    throw new Error('Production verification must use the main owner account');
  }
  const balanceBefore = await requestJson(`${root}/api/billing/balance`, { headers });
  const pointsBalance = balanceBefore.balances?.ec_points;
  if (balanceBefore.unlimited !== false || !pointsBalance || pointsBalance.unlimited !== false) {
    throw new Error('Canary owner does not use the real ec_points wallet');
  }
  // Quotes are non-reserving: the wallet is checked only when a generation
  // creates a hold. Keep this probe valid for an exhausted canary wallet so a
  // previous generation cannot make an otherwise healthy release unverifiable.
  if (!Number.isSafeInteger(pointsBalance.availableUnits) || pointsBalance.availableUnits < 0
    || !Number.isSafeInteger(pointsBalance.heldUnits) || pointsBalance.heldUnits < 0) {
    throw new Error('Canary owner ec_points balance has an invalid numeric shape');
  }
  const quoteResponse = await requestJson(`${root}/api/billing/quote`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ sku: 'ec_reverse_prompt', quantity: 1 }),
  });
  if (!quoteResponse.quote?.quoteId || quoteResponse.quote.totalUnits !== 200) {
    throw new Error('Billing quote response is invalid');
  }
  const balanceAfter = await requestJson(`${root}/api/billing/balance`, { headers });
  if (JSON.stringify(balanceBefore) !== JSON.stringify(balanceAfter)) {
    throw new Error('Balance changed after quote-only request');
  }

  console.log(`Production verification passed for ${root}`);
}

export function parseArguments(argv, env = process.env) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    sessionToken: env.SHUBAO_CANARY_SESSION_TOKEN || '',
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--base-url') options.baseUrl = argv[++index] || DEFAULT_BASE_URL;
    if (argv[index] === '--session-token') options.sessionToken = argv[++index] || '';
  }
  return options;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  verifyProduction(parseArguments(process.argv.slice(2))).catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}
