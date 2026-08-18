import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('account entitlement control exposes accessible balance actions', async () => {
  const control = await source('../src/components/billing/AccountEntitlementControl.jsx');

  assert.doesNotMatch(control, /刷新账户额度/);
  assert.doesNotMatch(control, /account-entitlement-purchase/);
  assert.match(control, /点击充值额度/);
  assert.match(control, /登录后查看额度/);
  assert.match(control, /accountEntitlementDisplay/);
});

test('mobile account entitlement stays icon-sized without widening the topbar', async () => {
  const control = await source('../src/components/billing/AccountEntitlementControl.jsx');
  const mobile = control.slice(control.indexOf('@media (max-width: 639px)'));

  assert.match(mobile, /\.topbar-actions \.account-entitlement-copy\s*\{\s*display:\s*none/);
  assert.match(mobile, /\.topbar-actions \.account-entitlement-arrow\s*\{\s*display:\s*none/);
  assert.match(mobile, /\.topbar-actions \.account-entitlement-value\s*\{[^}]*width:\s*38px/s);
  assert.match(mobile, /\.topbar-actions \.account-entitlement-value\s*\{[^}]*justify-content:\s*center/s);
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

test('admin self-credit and direct payment settlement refresh the visible balance', async () => {
  const admin = await source('../src/pages/AdminConsole/index.jsx');
  const payment = await source('../src/components/business/Modals.jsx');
  const pricing = await source('../src/pages/Pricing/index.jsx');

  assert.match(admin, /kind === 'credits' && account\.email === actorEmail/);
  assert.match(admin, /refreshBillingBalance\(\)\.catch\(\(\) => \{\}\)/);
  assert.match(payment, /order\?\.status === 'credited'[\s\S]*?refreshBillingBalance\(\)\.catch\(\(\) => \{\}\)/);
  assert.match(pricing, /order\?\.status === 'credited'[\s\S]*?refreshBillingBalance\(\)\.catch\(\(\) => \{\}\)/);
});
