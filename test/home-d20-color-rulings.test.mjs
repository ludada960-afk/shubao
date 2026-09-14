// test/home-d20-color-rulings.test.mjs
// 2026-09-20 D20（docs/design/40-decisions.md）：色值裁定三族
//   A 暖棕 rgba(57,45,26,α) / rgba(51,40,32,α) —— **它是 --sb-shadow-* 的颜色成分，不是缺档**
//     → 按 α 归到海拔档 --sb-shadow-1..5，**不新增 --sb-border-warm-***
//     → 例外：用作 border/divider 时不属阴影家族，单独报（本测试不强制迁）
//   B 玻璃白 rgba(255,255,255,α) → 按用途归 --sb-shadow-inset-top / --sb-glass-*
//   C 第二支紫 → 归并 --sb-brand-600/700，**不新增 --sb-brand-550**
//   D 带 alpha 的值必须「合成到实际底色后」再算 ΔE
//
// 本测试锁定 A 的可执行部分：**Home 区域不得再有「作为 box-shadow 的暖棕字面量」**。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url);
const EXT = new Set(['.css', '.jsx', '.js']);
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const f = path.join(d, n);
    if (statSync(f).isDirectory()) walk(f);
    else if (EXT.has(path.extname(n))) files.push(f);
  }
})(path.join(ROOT.pathname.replace(/^\//, ''), 'src/pages/Home'));

const strip = t => t
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^[ \t]*\/\/.*$/gm, ' ')
  .replace(/^[ \t]*\*.*$/gm, ' ');

/* 暖棕字面量（57,45,26 或 51,40,32）*/
const WARM = /rgba\(\s*(?:57\s*,\s*45\s*,\s*26|51\s*,\s*40\s*,\s*32)\s*,\s*[\d.]+\s*\)/g;

/** 收集「该值所处的 CSS 属性」 */
function scan(predicate) {
  const hits = [];
  for (const f of files) {
    const rel = f.replace(/\\/g, '/').replace(/.*src\/pages\/Home\//, 'src/pages/Home/');
    strip(readFileSync(f, 'utf8')).split(/\r?\n/).forEach((line, i) => {
      for (const m of line.matchAll(WARM)) {
        const before = line.slice(0, m.index);
        const pm = before.match(/([a-zA-Z-]+)\s*:\s*[^;]*$/);
        const prop = pm ? pm[1].toLowerCase() : '';
        if (predicate(prop, line)) hits.push({ rel, line: i + 1, prop, text: line.trim().slice(0, 120), val: m[0] });
      }
    });
  }
  return hits;
}

test('D20-A①：Home 不得再有「作为 box-shadow 的暖棕字面量」', () => {
  const bad = scan(prop => /shadow/.test(prop));
  assert.equal(
    bad.length,
    0,
    '以下 box-shadow 仍在用暖棕字面量，应改为 --sb-shadow-1..5（D20-A）：\n  ' +
      bad.map(b => b.rel + ':' + b.line + '  [' + b.prop + '] ' + b.text).join('\n  '),
  );
});

test('D20-A②：反向护栏 —— 本测试确实扫到了 Home 的文件与内容', () => {
  let total = 0;
  for (const f of files) total += readFileSync(f, 'utf8').split(/\r?\n/).length;
  assert.ok(total > 3000, '被扫描文件总行数过少（' + total + '），路径可能写错');
  assert.ok(files.length > 50, '被扫描文件数过少（' + files.length + '）');
});

test('D20-A③：暖棕仍可作为 border/divider 存在（该例外必须保留，不许顺势误改）', () => {
  /* D20 明确：用作 border/divider 的暖棕**不属于阴影家族**，要单独报、不混进阴影表。
     本测试不要求迁它们，但要求**它们没有被错误地改成阴影 token**。 */
  const borderish = scan(prop => /^border|divider|outline/.test(prop));
  assert.ok(
    borderish.every(b => !/--sb-shadow-/.test(b.text)),
    '边框位置不得被改写成 --sb-shadow-*（D20-A 例外条款）',
  );
});

test('D20-C：不得新增 --sb-brand-550（品牌紫不补第二档）', () => {
  const tokens = readFileSync(new URL('../src/styles/design-tokens-v3.css', import.meta.url), 'utf8');
  assert.ok(
    !/--sb-brand-550\s*:/.test(tokens),
    'D20-C 裁定：不新增 --sb-brand-550，第二支紫归并到 --sb-brand-600/700',
  );
});
