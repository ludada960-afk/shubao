import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('account entitlement control exposes accessible balance actions', async () => {
  const control = await source('../src/components/billing/AccountEntitlementControl.jsx');

  assert.match(control, /aria-label="刷新账户额度"/);
  assert.match(control, /购买额度/);
  assert.match(control, /登录后查看额度/);
  assert.match(control, /accountEntitlementDisplay/);
});

test('authoritative balance refresh tracks pending and error states behind the session gate', async () => {
  const context = await source('../src/store/AppContext.jsx');
  const refreshStart = context.indexOf('const refreshBillingBalance = useCallback');
  assert.notEqual(refreshStart, -1);
  const refreshEnd = context.indexOf('\n  },', refreshStart);
  const refresh = context.slice(refreshStart, refreshEnd);

  assert.match(context, /balanceRefreshStatus/);
  assert.match(context, /SET_BALANCE_REFRESH/);
  assert.match(refresh, /status:\s*'refreshing'/);
  assert.match(refresh, /status:\s*'ready'/);
  assert.match(refresh, /status:\s*'error'/);
  assert.match(refresh, /sessionRequestGate\.isCurrent\(/);
});
