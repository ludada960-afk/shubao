import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { handleGenerationAccessError } from '../src/utils/generationAccess.js';
import { loadPendingPaidAction } from '../src/utils/pendingPaidAction.js';
import { buildEcommercePendingAction } from '../src/pages/Home/ec/ecommercePlanModel.js';

test('maps insufficient credits to a resumable ecommerce paywall with authoritative quote values', () => {
  const actions = [];
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const result = handleGenerationAccessError(
    { status: 402, code: 'INSUFFICIENT_CREDITS', payload: { required: 3000, available: 1000 } },
    action => actions.push(action),
    {
      ownerEmail: 'creator@example.com',
      source: 'test-flow',
      route: '/ecommerce',
      draftId: 'draft-42',
      action: { type: 'ecommerce_generate', assetIds: ['asset-1'] },
      quoteId: 'quote-7',
      storage,
      now: () => 1000,
    },
  );

  assert.equal(result, 'credits');
  assert.deepEqual(actions, [{
    type: 'OPEN_PAYWALL',
    tab: 'ecommerce',
    reason: 'INSUFFICIENT_CREDITS',
    pendingAction: {
      version: 1,
      ownerEmail: 'creator@example.com',
      source: 'test-flow',
      route: '/ecommerce',
      draftId: 'draft-42',
      action: { type: 'ecommerce_generate', assetIds: ['asset-1'], currency: 'ec_points' },
      quoteId: 'quote-7',
      createdAt: 1000,
      billing: { required: 3000, available: 1000 },
    },
  }]);
  const { billing, ...persistedAction } = actions[0].pendingAction;
  assert.deepEqual(billing, { required: 3000, available: 1000 });
  assert.deepEqual(
    loadPendingPaidAction('creator@example.com', { storage, now: () => 1001 }),
    persistedAction,
  );
});

test('persists a sufficient sanitized ecommerce reference snapshot after a 402 interruption', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const rawFile = new File(['raw'], 'product.png', { type: 'image/png' });
  const pendingReference = buildEcommercePendingAction({
    platform: '京东',
    direction: { id: 'direction-2', description: '突出精工质感' },
    sizing: {
      smart: false,
      resolution: '2K',
      images: [{ key: 'main_text', count: 2, ratio: '1:1' }],
    },
    skus: [{ color: '银色', size: '标准版', count: 1 }],
    customColors: ['#C0C0C0'],
    originalProductAssets: [{ assetId: 'product-1', file: rawFile, url: 'blob:product' }],
    supplementalProductAssets: [{ assetId: 'product-2', dataUrl: 'data:image/png;base64,AAAA' }],
    originalReferenceAssets: [{ assetId: 'reference-1', buffer: new Uint8Array([1]) }],
    supplementalReferenceAssets: [{ assetId: 'reference-2', image: rawFile }],
    promptText: '保留商品结构，强化金属质感',
    promptReferences: [
      { key: 'product_name', text: 'Nova Hub', file: rawFile },
      { key: 'selling_points', text: '多接口扩展' },
    ],
  });
  const actions = [];

  handleGenerationAccessError({
    status: 402,
    code: 'BILLING_INSUFFICIENT_CREDITS',
    payload: { required: 2000, available: 1000 },
  }, action => actions.push(action), {
    ownerEmail: 'owner@example.com',
    source: 'ecommerce-direction',
    route: '/home',
    draftId: 'ec-draft-42',
    quoteId: 'bq1.accepted.quote',
    action: pendingReference,
    storage,
    now: () => 1000,
  });

  const persisted = loadPendingPaidAction('owner@example.com', { storage, now: () => 1001 });
  assert.equal(persisted.draftId, 'ec-draft-42');
  assert.equal(persisted.quoteId, 'bq1.accepted.quote');
  assert.deepEqual(persisted.action, {
    ...pendingReference,
    currency: 'ec_points',
  });
  assert.deepEqual(persisted.action.assetIds, {
    product: { original: ['product-1'], supplemental: ['product-2'] },
    reference: { original: ['reference-1'], supplemental: ['reference-2'] },
  });
  assert.equal(persisted.action.direction.brief, '突出精工质感');
  assert.equal(persisted.action.sizing.resolution, '2K');
  assert.equal(persisted.action.prompt.text, '保留商品结构，强化金属质感');
  const serialized = JSON.stringify(persisted);
  assert.doesNotMatch(serialized, /data:image|blob:|base64|product\.png|File|Blob|Uint8Array|buffer|dataUrl|previewUrl/);
  assert.deepEqual(actions[0].pendingAction.action.assetIds, persisted.action.assetIds);
});

test('default 402 handling derives a signed owner, current route, stable draft, and minimal action', () => {
  const values = new Map([
    ['sb-auth', JSON.stringify({
      email: ' Owner@Example.com ',
      token: 'signed-session-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
    })],
  ]);
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const firstActions = [];
  const secondActions = [];
  const error = {
    status: 402,
    code: 'BILLING_INSUFFICIENT_CREDITS',
    payload: {
      required: 1,
      available: 0,
      ownerEmail: 'attacker@example.com',
    },
  };

  handleGenerationAccessError(error, action => firstActions.push(action), {
    source: 'plog',
    storage,
    location: { pathname: '/plog', search: '?mode=quick' },
    now: () => 1000,
  });
  handleGenerationAccessError(error, action => secondActions.push(action), {
    source: 'plog',
    storage,
    location: { pathname: '/another-route', search: '?ignored=1' },
    now: () => 2000,
  });

  const pendingAction = firstActions[0].pendingAction;
  assert.equal(pendingAction.ownerEmail, 'owner@example.com');
  assert.equal(pendingAction.route, '/plog');
  assert.match(pendingAction.draftId, /^pending-/);
  assert.equal(pendingAction.draftId, secondActions[0].pendingAction.draftId);
  assert.deepEqual(pendingAction.action, { type: 'plog', currency: 'content_sets' });
  assert.deepEqual(pendingAction.billing, { required: 1, available: 0 });
  const { billing: secondBilling, ...secondPersistedAction } = secondActions[0].pendingAction;
  assert.deepEqual(secondBilling, { required: 1, available: 0 });
  assert.deepEqual(
    loadPendingPaidAction('owner@example.com', { storage, now: () => 2001 }),
    secondPersistedAction,
  );
  assert.ok(
    [...values.keys()].some(key => key.startsWith('shubao.pendingPaidDrafts.')),
    'the per-source fallback draft reference must be stored locally',
  );
});

test('fallback 402 state preserves authoritative billing without persisting an unowned record', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const actions = [];

  handleGenerationAccessError({
    status: 402,
    code: 'INSUFFICIENT_CREDITS',
    payload: { required: 4500, available: 500, email: 'attacker@example.com' },
  }, action => actions.push(action), {
    source: 'ec-auto',
    storage,
    location: { pathname: '/ec-auto' },
    now: () => 1000,
  });

  assert.equal(actions[0].type, 'OPEN_PAYWALL');
  assert.equal(actions[0].tab, 'ecommerce');
  assert.equal(actions[0].reason, 'INSUFFICIENT_CREDITS');
  assert.equal(actions[0].pendingAction.source, 'ec-auto');
  assert.equal(actions[0].pendingAction.route, '/ec-auto');
  assert.match(actions[0].pendingAction.draftId, /^pending-/);
  assert.equal(actions[0].pendingAction.createdAt, 1000);
  assert.deepEqual(actions[0].pendingAction.action, { type: 'ec-auto', currency: 'ec_points' });
  assert.deepEqual(actions[0].pendingAction.billing, { required: 4500, available: 500 });
  assert.equal(values.has('shubao.pendingPaidAction.v1'), false);
});

test('insufficient-balance currency follows safe caller, action, and source precedence', () => {
  const values = new Map([
    ['sb-auth', JSON.stringify({
      email: 'owner@example.com',
      token: 'signed-session-token',
      expiresAt: '2099-01-01T00:00:00.000Z',
    })],
  ]);
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
  const open = (source, options = {}) => {
    const actions = [];
    handleGenerationAccessError({
      status: 402,
      code: 'INSUFFICIENT_CREDITS',
      payload: { required: 2, available: 0 },
    }, action => actions.push(action), {
      source,
      storage,
      location: { pathname: `/${source}` },
      now: () => 1000,
      ...options,
    });
    return actions[0];
  };

  for (const source of ['plog', 'xhs-content', 'xhs-plog']) {
    const paywall = open(source);
    assert.equal(paywall.tab, 'content', source);
    assert.equal(paywall.pendingAction.action.currency, 'content_sets', source);
  }

  const ecommerce = open('ecommerce-direction');
  assert.equal(ecommerce.tab, 'ecommerce');
  assert.equal(ecommerce.pendingAction.action.currency, 'ec_points');

  const actionOverride = open('ecommerce-direction', {
    action: { type: 'content-regenerate', currency: 'content_sets' },
  });
  assert.equal(actionOverride.tab, 'content');
  assert.equal(actionOverride.pendingAction.action.currency, 'content_sets');

  const callerOverride = open('plog', {
    currency: 'ec_points',
    action: { type: 'plog', currency: 'content_sets' },
  });
  assert.equal(callerOverride.tab, 'ecommerce');
  assert.equal(callerOverride.pendingAction.action.currency, 'ec_points');

  const invalidOverride = open('xhs-content', {
    currency: 'attacker_currency',
    action: { type: 'xhs-content', currency: 'also_invalid' },
  });
  assert.equal(invalidOverride.tab, 'content');
  assert.equal(invalidOverride.pendingAction.action.currency, 'content_sets');
});

test('maps beta access failures to the login modal without changing form state', () => {
  const actions = [];
  const result = handleGenerationAccessError({ status: 403 }, action => actions.push(action));

  assert.equal(result, 'login');
  assert.deepEqual(actions, [{ type: 'SHOW_LOGIN', show: true }]);
});

test('production restores owner-bound pending state and the sufficient-balance action only returns to the form', () => {
  const appContext = readFileSync(new URL('../src/store/AppContext.jsx', import.meta.url), 'utf8');
  const modals = readFileSync(new URL('../src/components/business/Modals.jsx', import.meta.url), 'utf8');
  const insufficientModal = readFileSync(new URL('../src/components/billing/InsufficientBalanceModal.jsx', import.meta.url), 'utf8');

  assert.match(appContext, /import\s+\{[^}]*clearPendingPaidAction[^}]*loadPendingPaidAction[^}]*\}/s);
  assert.match(appContext, /case 'RESTORE_PENDING_PAID_ACTION'/);
  assert.match(appContext, /loadPendingPaidAction\(session\.email/);
  assert.match(appContext, /type:\s*'RESTORE_PENDING_PAID_ACTION'/);
  assert.match(
    appContext,
    /action\?\.type === 'SET_LOGGED' && !action\.logged[\s\S]{0,100}clearPendingPaidAction\(\)/,
  );
  assert.match(
    appContext,
    /action\?\.type === 'CLEAR_PAYWALL'[\s\S]{0,100}clearPendingPaidAction\(\)/,
    'an explicit page-level completion clear must remove the persisted pending action',
  );
  assert.doesNotMatch(modals, /RESUME_PENDING_PAID_ACTION/);
  assert.match(
    modals,
    /const close = \(\) => dispatch\(\{ type: 'SHOW_PRICE', show: false \}\)/,
    'closing or returning to the form must only hide the modal',
  );
  assert.match(modals, /required=\{pendingAction\?\.billing\?\.required\}/);
  assert.match(modals, /available=\{pendingAction\?\.billing\?\.available\}/);
  assert.match(
    modals,
    /resolvePendingActionCurrency\(\{[\s\S]{0,120}action:\s*pendingAction\?\.action,[\s\S]{0,120}source:\s*pendingAction\?\.source/,
  );
  assert.match(modals, /onResume=\{close\}/);
  assert.match(insufficientModal, />返回继续创作</);
  assert.doesNotMatch(insufficientModal, /继续刚才的操作/);
});
