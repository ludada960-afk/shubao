// test/bundle-first-payload-1001.test.mjs
// 批 CY-㊴ 之十九（2026-10-01）。首屏体积的两条硬判据。
//
// 背景：vite.config.js 里 `build.cssCodeSplit: false`，把 src 下 **62 个** CSS 文件
// 合成**一个** 844 KB 的样式表，而且它写在 index.html 里 ⇒ 每一页都要先下完它。
// 而路由本来就是 React.lazy 的（App.jsx 里 15 处）—— JS 拆了、CSS 没拆，不一致。
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const viteConfig = read('vite.config.js');
const distAssets = new URL('../dist/assets/', import.meta.url);
const hasBuild = existsSync(distAssets);

test('1. CSS 必须按 chunk 拆分（不许再合成一个全站样式表）', () => {
  assert.match(viteConfig, /cssCodeSplit:\s*true/,
    'cssCodeSplit 必须是 true —— false 会把 62 个 CSS 合成一个 844KB 的表，'
    + '每一页都要先下完它');
  assert.doesNotMatch(viteConfig, /cssCodeSplit:\s*false/,
    'cssCodeSplit 不得被改回 false');
});

test('2. 构建产物里 CSS 必须是多个文件，且首屏那一张不能太大', () => {
  if (!hasBuild) {
    console.log('    （dist 尚未构建，本条跳过；precommit 会在 build 之后跑）');
    return;
  }
  const css = readdirSync(distAssets).filter(f => f.endsWith('.css'));
  assert.ok(css.length > 1,
    '产物里只有 ' + css.length + ' 个 CSS —— 拆分没生效（index.html 直接引用的那个必须只是入口样式）');

  const html = read('dist/index.html');
  const first = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.css)"/g)].map(m => m[1]);
  assert.ok(first.length >= 1, 'index.html 里必须引用的 CSS');

  const distDir = new URL('../dist/assets/', import.meta.url);
  for (const name of first) {
    const bytes = readFileSync(new URL(name, distDir)).length;
    assert.ok(bytes < 300 * 1024,
      'index.html 引用的 CSS 有 ' + Math.round(bytes / 1024) + ' KB —— '
      + '首屏不该为用不到的页面（VideoStudio / EcCanvas）付费');
  }
});

test('3. 懒加载的 CSS 不得又被整体塞回首屏（防止"拆了但没拆掉"）', () => {
  /* 拆分本身不等于收益：只要有任何一个**急切**引入的模块把大块 CSS 拖进首屏，
     首屏就还是那个体积。这里守住"首页那一份"的规模上限。 */
  if (!hasBuild) return;
  const html = read('dist/index.html');
  const first = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.css)"/g)].map(m => m[1]);
  const distDir = new URL('../dist/assets/', import.meta.url);
  const entry = first.reduce((a, name) => a + readFileSync(new URL(name, distDir)).length, 0);
  assert.ok(entry < 200 * 1024,
    'index.html 直接引用的 CSS 合计 ' + Math.round(entry / 1024)
    + ' KB —— 单张 <link> 引用的不该这么大（拆分前的全站表是 844KB）');
});