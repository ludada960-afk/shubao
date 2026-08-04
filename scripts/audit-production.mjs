import process from 'node:process';

const baseUrl = String(
  process.argv.find(arg => arg.startsWith('--url='))?.slice('--url='.length)
    || process.env.AUDIT_BASE_URL
    || 'http://127.0.0.1:3001',
).replace(/\/$/, '');

const checks = [];
const failures = [];
const startedAt = Date.now();

function record(name, ok, detail = '') {
  const result = { name, ok, detail };
  checks.push(result);
  if (!ok) failures.push(result);
}

async function request(path, options = {}) {
  const started = Date.now();
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'manual',
    ...options,
  });
  const text = await response.text();
  return { response, text, elapsedMs: Date.now() - started };
}

function header(response, name) {
  return response.headers.get(name) || '';
}

function assertHeader(response, name, expected) {
  const value = header(response, name);
  record(`header ${name}`, value.toLowerCase().includes(expected.toLowerCase()), value || '(missing)');
}

try {
  const root = await request('/');
  record('homepage status', root.response.status === 200, `${root.response.status} in ${root.elapsedMs}ms`);
  record('homepage has root mount', root.text.includes('id="root"'));
  record('homepage has title', /<title>[^<]+<\/title>/i.test(root.text));
  record('homepage has description', /name=["']description["'][^>]+content=/i.test(root.text));
  record('homepage has canonical', /rel=["']canonical["'][^>]+https:\/\/shuimg\.cn\//i.test(root.text));
  record('homepage has Open Graph metadata', /property=["']og:title["']/i.test(root.text));
  record('homepage does not expose secrets', !/(?:sk-[a-z0-9]|IMAGE_API_KEY|AUTH_SESSION_SECRET|SHUBAO_CANARY_SESSION_TOKEN)/i.test(root.text));
  for (const [name, expected] of [
    ['X-Content-Type-Options', 'nosniff'],
    ['X-Frame-Options', 'sameorigin'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
    ['Permissions-Policy', 'camera=()'],
  ]) assertHeader(root.response, name, expected);

  for (const path of ['/robots.txt', '/sitemap.xml', '/site.webmanifest']) {
    const asset = await request(path);
    record(`${path} status`, asset.response.status === 200, `${asset.response.status}`);
    record(`${path} non-empty`, asset.text.trim().length > 0);
  }

  const health = await request('/health');
  record('health status', health.response.status === 200, `${health.response.status} in ${health.elapsedMs}ms`);
  const healthBody = JSON.parse(health.text);
  record('health contract', healthBody.ok === true && healthBody.service === 'shubao');
  assertHeader(health.response, 'X-Content-Type-Options', 'nosniff');

  const catalog = await request('/api/billing/catalog');
  record('billing catalog status', catalog.response.status === 200, `${catalog.response.status}`);
  const catalogBody = JSON.parse(catalog.text);
  record('billing uses shared point wallet', catalogBody.billing?.primaryCurrency === 'ec_points');
  record('public catalog hides legacy content-set products', !catalogBody.products?.some(product => product.currency === 'content_sets'));
  record('public catalog hides legacy content-set features', !catalogBody.features?.some(feature => feature.currency === 'content_sets'));
  record('provider availability is explicit', Array.isArray(catalogBody.paymentProviders));

  const deniedCors = await request('/api/billing/catalog', { headers: { Origin: 'https://unexpected.example' } });
  record('untrusted CORS origin is not granted', header(deniedCors.response, 'access-control-allow-origin') === '');
  const localCors = await request('/api/billing/catalog', { headers: { Origin: 'http://127.0.0.1:5173' } });
  record('configured CORS origin is granted', header(localCors.response, 'access-control-allow-origin') === 'http://127.0.0.1:5173');
} catch (error) {
  record('audit request execution', false, error?.message || String(error));
}

const passed = checks.filter(check => check.ok).length;
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.name}${check.detail ? `: ${check.detail}` : ''}`);
}
console.log(`Production audit ${passed}/${checks.length} passed in ${Date.now() - startedAt}ms (${baseUrl})`);
if (failures.length) process.exitCode = 1;
