import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('application and canvas headers share the account entitlement control', async () => {
  const [app, chrome, canvas] = await Promise.all([
    source('../src/App.jsx'),
    source('../src/pages/EcCanvas/components/CanvasChrome.jsx'),
    source('../src/pages/EcCanvas/index.jsx'),
  ]);

  assert.match(app, /AccountEntitlementControl/);
  assert.doesNotMatch(app, /onRefresh=\{refreshBillingBalance\}/);
  assert.match(app, /type: 'SHOW_PRICE'/);
  assert.match(app, /type: 'SHOW_LOGIN'/);
  assert.match(chrome, /AccountEntitlementControl/);
  assert.match(chrome, /entitlement/);
  assert.match(canvas, /balanceRefreshStatus/);
  assert.match(canvas, /refreshBillingBalance/);
});

test('canvas entitlement layout preserves primary canvas commands on mobile', async () => {
  const [chrome, control, css] = await Promise.all([
    source('../src/pages/EcCanvas/components/CanvasChrome.jsx'),
    source('../src/components/billing/AccountEntitlementControl.jsx'),
    source('../src/pages/EcCanvas/EcCanvas.css'),
  ]);

  assert.match(chrome, /AccountEntitlementControl/);
  assert.match(control, /点击充值额度/);
  assert.doesNotMatch(control, /account-entitlement-purchase/);
  // 9-02 用户反馈: 顶部去掉"导出整套图片"按钮 (派生面板里有电商套图), "新建生图"改名"新建画布"
  assert.doesNotMatch(chrome, /导出整套图片/);
  assert.match(chrome, /新建画布/);
  const mobile = css.slice(css.indexOf('@media (max-width: 620px)'));
  assert.match(mobile, /\.account-entitlement-control\.is-compact/);
  assert.match(mobile, /\.ec-canvas-topbar-actions\s*\{[^}]*flex-wrap:\s*wrap/s);
});

test('mobile application shell constrains header content to the viewport', async () => {
  const css = await source('../src/styles/app-shell.css');
  const mobile = css.slice(css.indexOf('@media (max-width: 639px)'));

  assert.match(mobile, /\.topbar-row\s*\{[^}]*width:\s*100%/s);
  assert.match(mobile, /\.topbar-actions\s*\{[^}]*min-width:\s*0/s);
  assert.match(mobile, /\.topbar-actions\s*\{[^}]*flex-shrink:\s*1/s);
});
