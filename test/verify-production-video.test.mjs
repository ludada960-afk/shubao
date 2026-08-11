import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyProductionVideo } from '../scripts/verify-production-video.mjs';

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test('production video verifier accepts a safe public catalog without making a generation request', async () => {
  let calls = 0;
  const body = {
    generationEnabled: true,
    products: [
      { id: 'seedance_fast', quotes: { short: { sku: 'video_seedance_fast_short', units: 40000 }, long: { sku: 'video_seedance_fast_long', units: 46000 } } },
      { id: 'seedance_standard', quotes: { short: { sku: 'video_seedance_standard_short', units: 62000 }, long: { sku: 'video_seedance_standard_long', units: 72000 } } },
    ],
  };
  await verifyProductionVideo({ baseUrl: 'https://example.com', fetchImpl: async url => { calls += 1; assert.match(url, /\/api\/video\/capabilities$/); return response(body); } });
  assert.equal(calls, 1);
});
test('production video verifier rejects an internal route leak', async () => {
  await assert.rejects(
    verifyProductionVideo({ fetchImpl: async () => response({ generationEnabled: false, products: [{ id: 'seedance_fast', routeId: 'sd5-seedance-2.0-fast', quotes: { short: { units: 40000 }, long: { units: 46000 } } }] }) }),
    /leaked an internal route/,
  );
});
