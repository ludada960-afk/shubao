import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { handleGenerationAccessError } from '../src/utils/generationAccess.js';
import { loadPendingPaidAction } from '../src/utils/pendingPaidAction.js';

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
      action: { type: 'ecommerce_generate', assetIds: ['asset-1'] },
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
  assert.deepEqual(pendingAction.action, { type: 'plog' });
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
  assert.deepEqual(actions[0].pendingAction.action, { type: 'ec-auto' });
  assert.deepEqual(actions[0].pendingAction.billing, { required: 4500, available: 500 });
  assert.equal(values.has('shubao.pendingPaidAction.v1'), false);
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
  assert.match(modals, /onResume=\{close\}/);
  assert.match(insufficientModal, />返回继续创作</);
  assert.doesNotMatch(insufficientModal, /继续刚才的操作/);
});
