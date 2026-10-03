// test/entitlement-button-and-canvas-entry-1003.test.mjs
// 门禁：积分按钮的「AI 积分」只出现一次，且**全局**一致（2026-10-03）。
//
// 用户原话（第二次说同一件事，这次说清了要什么）：
//   「206.4 上面不是有个 AI 积分吗，这个**保留**，然后 206.4 **右边**的 AI 积分几个字
//     **去掉**，避免重复，所以高度还是要跟原来这样一样，但是宽度肯定就要适配紧一点了。
//     然后你现在好像只调整了画布里面的 AI 积分按钮，你要**首页和各个页面也全局去改**呀，
//     为什么只改画布里面呢。」
//
// 真因：`accountEntitlementDisplay.value` 原来是 **"206.4 AI 积分" 整串**，
// 而按钮上本来就有一行小字「AI 积分」⇒ 单位出现两次。
// 而我上一轮（2026-10-02）把 compact 下那行小字**藏了** —— 方向正好反了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { accountEntitlementDisplay } from '../src/components/billing/accountEntitlementModel.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const CONTROL = read('src/components/billing/AccountEntitlementControl.jsx');
const CHROME = read('src/pages/EcCanvas/components/CanvasChrome.jsx');

test('① 额度数字里不许再带「AI 积分」—— 单位由按钮上面那行小字承担', () => {
  const display = accountEntitlementDisplay({ logged: true, ecPoints: 206.4 });
  assert.equal(display.value, '206.4', 'value 只给数字');
  assert.doesNotMatch(String(display.value), /积分/,
    '数字后面不许再跟「AI 积分」—— 按钮上方已经有一行了，那是重复的那一次');
  assert.equal(
    accountEntitlementDisplay({ logged: true, ecPoints: 0 }).value, '0',
    '0 也要走同一条口径（不许 0 的时候又变回带单位）',
  );
});

test('② 「AI 积分」那行小字**始终**显示 —— 上一轮我把它在 compact 下藏了，方向反了', () => {
  const code = CONTROL.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.match(code, /<small>AI 积分<\/small>/,
    '那行小字必须始终渲染（不分 compact）—— 用户原话：「这个保留」');
  assert.doesNotMatch(code, /compact \? null : <small>/,
    '不许再按 compact 隐藏它：用户明确说要保留，且要全局一致');
});

test('③ 高度不变，只让宽度贴紧', () => {
  const code = CONTROL.replace(/\/\*[\s\S]*?\*\//g, '');
  /* 主态高度由 .account-entitlement-value 的 min-height 决定，compact 不许改它 */
  assert.match(code, /\.account-entitlement-value \{[^}]*min-height:\s*40px/,
    '默认高度保持 40px');
  const compact = code.match(/\.account-entitlement-control\.is-compact[^{]*\{[^}]*\}/)?.[0] || '';
  assert.doesNotMatch(compact, /min-height/, 'compact 只收内边距与间距，不许改高度');
  assert.match(compact, /padding:/, 'compact 收紧内边距 ⇒ 宽度自然贴紧');
});

test('④ 按钮的语义不能因为"藏字"而丢', () => {
  assert.match(CONTROL, /AI 积分：\$\{display\.value\}/,
    'aria-label 里仍然要写明「AI 积分：数字」—— 读屏用户拿到的信息不能因为视觉精简而丢');
  assert.match(CONTROL, /点击充值额度/);
});

test('⑤ 顶栏那颗写「我的画布」，不写「新建画布」', () => {
  /* 用户原话：「明明点击之后是到我的画布那个页面仓库去的呀，这里不该是我的画布吗」 */
  assert.match(CHROME, /我的画布<\/button>/);
  const code = CHROME.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, />新建画布</,
    '按钮文案不许再是「新建画布」—— 它开的是画布库，不是"新建一张"');
});
