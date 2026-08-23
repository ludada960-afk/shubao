import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import * as entitlementState from '../src/store/entitlementState.js';

const {
  createSessionRequestGate,
  normalizeEntitlement,
  withCreditsCompatibility,
} = entitlementState;

const appContextSource = readFileSync(
  new URL('../src/store/AppContext.jsx', import.meta.url),
  'utf8',
);

function callbackSource(name) {
  const start = appContextSource.indexOf(`const ${name} = useCallback`);
  assert.notEqual(start, -1, `${name} must exist`);
  const end = appContextSource.indexOf('\n  },', start);
  assert.notEqual(end, -1, `${name} callback must have a bounded body`);
  return appContextSource.slice(start, end);
}

test('normalizes milli-point balance records into separate human-readable entitlements', () => {
  assert.deepEqual(normalizeEntitlement({
    balances: {
      ec_points: { availableUnits: 105000, heldUnits: 0, unlimited: false },
      content_sets: { availableUnits: 10, heldUnits: 0, unlimited: false },
    },
    unlimited: false,
  }), { ecPoints: 105, contentSets: 10, unlimited: false });
});

test('normalizes compact balance payloads and keeps unlimited distinct from numeric balances', () => {
  assert.deepEqual(normalizeEntitlement({
    balances: { ec_points: 105000, content_sets: 10 },
    unlimited: false,
  }), { ecPoints: 105, contentSets: 10, unlimited: false });
  assert.deepEqual(normalizeEntitlement({ unlimited: true }), { ecPoints: null, contentSets: null, unlimited: true });
  assert.deepEqual(normalizeEntitlement({}), { ecPoints: 0, contentSets: 0, unlimited: false });
});

test('session request gate rejects responses captured before a session switch', async () => {
  assert.equal(typeof createSessionRequestGate, 'function');
  const gate = createSessionRequestGate();
  const firstSessionRequest = gate.capture();
  let resolveResponse;
  const response = new Promise((resolve) => { resolveResponse = resolve; });
  const guardedWrite = response.then((value) => (
    gate.isCurrent(firstSessionRequest) ? value : undefined
  ));

  gate.invalidate();
  resolveResponse('old-account-balance');

  assert.equal(await guardedWrite, undefined);
  const secondSessionRequest = gate.capture();
  assert.equal(gate.isCurrent(secondSessionRequest), true);
  gate.invalidate();
  assert.equal(gate.isCurrent(secondSessionRequest), false);
});

test('credits compatibility mirrors content sets including unlimited null balances', () => {
  assert.equal(typeof withCreditsCompatibility, 'function');
  assert.deepEqual(withCreditsCompatibility({
    ecPoints: 105,
    contentSets: 10,
    unlimited: false,
  }), {
    ecPoints: 105,
    contentSets: 10,
    credits: 10,
    unlimited: false,
  });
  assert.deepEqual(withCreditsCompatibility({
    ecPoints: null,
    contentSets: null,
    unlimited: true,
  }), {
    ecPoints: null,
    contentSets: null,
    credits: null,
    unlimited: true,
  });
});

test('AppContext gates every billing refresh and invalidates requests on SET_LOGGED', () => {
  for (const name of [
    'refreshBillingBalance',
    'refreshBillingCatalog',
    'refreshBillingLedger',
  ]) {
    const source = callbackSource(name);
    assert.match(source, /sessionRequestGate\.capture\(\)/, `${name} must capture the session epoch`);
    assert.match(source, /sessionRequestGate\.isCurrent\(/, `${name} must reject stale responses`);
  }
  assert.match(
    appContextSource,
    /action\?\.type === 'SET_LOGGED'[\s\S]{0,120}sessionRequestGate\.invalidate\(\)/,
    'SET_LOGGED must invalidate all in-flight billing requests',
  );
  assert.match(
    callbackSource('fetchCredits'),
    /withCreditsCompatibility\(/,
    'fetchCredits must return the legacy credits selector',
  );
});

test('SET_LOGGED false clears owner-bound creative state and returns to the public home route', () => {
  const logoutBranch = appContextSource.match(/case 'SET_LOGGED':[\s\S]*?\n    case 'SET_ACCOUNT_ACCESS':/i)?.[0] || '';
  assert.match(logoutBranch, /page:\s*'home'/, 'logout must leave protected workspaces');
  for (const field of ['result', 'genState', 'galleryItem', 'works', 'creationLaunch', 'loginIntent']) {
    assert.match(logoutBranch, new RegExp(`${field}:`), `logout must clear ${field}`);
  }
});

test('session restore ignores a response captured before logout or account switch', () => {
  const restoreEffect = appContextSource.match(/\/\/ 页面加载时从 localStorage 恢复登录状态[\s\S]*?\n  }, \[refreshBillingBalance, refreshBillingCatalog, state\.browserQa\]\);/)?.[0] || '';
  assert.match(restoreEffect, /sessionRequestGate\.capture\(\)/, 'session restore must capture its request epoch');
  assert.match(restoreEffect, /sessionRequestGate\.isCurrent\(requestEpoch\)/, 'session restore must reject stale responses');
});
