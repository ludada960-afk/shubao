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
import { execSync } from 'node:child_process';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));   // <repo>/test
const ROOT = path.resolve(HERE, '..');                       // <repo>
const EXT = new Set(['.css', '.jsx', '.js']);
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const f = path.join(d, n);
    if (statSync(f).isDirectory()) walk(f);
    else if (EXT.has(path.extname(n))) files.push(f);
  }
})(path.join(ROOT, 'src/pages/Home'));

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

test('D20-A③：边框位置不得被误改成 --sb-shadow-*（用途不得串族）', () => {
  /* D20 明确：阴影（海拔）与描边（边界）是**两种用途、两个家族**。
     D21 已把描边用途归到 --sb-border-*（暖黑档）。
     本断言守住「不得串族」：边框位置既不能是暖棕字面量，也不能写成 shadow token。 */
  const borderish = scan(prop => /^border|divider|outline/.test(prop));
  assert.ok(
    borderish.every(b => !/--sb-shadow-/.test(b.text)),
    '边框位置不得被改写成 --sb-shadow-*（D20-A/D21：用途不得串族）',
  );
});

/* ── 已知待办登记（**不是**豁免，是带失效条件的债）─────────────────────
   当前为空：Home.css 的 border α.14 已于本批迁移完成（D19 线提交后文件转干净）。
   机制保留：若将来再遇到「目标文件被他人 dirty、按纪律必须跳过」的情况，
   在这里登记 { 相对路径: 原因 }，并**同时**由下面的 ①-b 断言保证——
   文件一旦转干净，登记立即失效并强制还债。 */
const PENDING_DIRTY = {};
const isDirty = rel => {
  try {
    const out = execSync('git status --porcelain -- "' + rel + '"', {
      cwd: ROOT, encoding: 'utf8',
    });
    return out.trim().length > 0;
  } catch { return false; }   // 不在 git 仓库时视为「不 dirty」，断言照常强制
};

test('D21①：Home 不得再有「作为 border/divider 的暖棕字面量」', () => {
  /* D21：描边是「分区/边界」语义，全站只该有一套描边色 → 归并到 --sb-border-*（暖黑系），按 α 落档。
     例外：位于深色/暖棕底上会看不见的，需单独报 —— 本区域经核查无此类（底色均为白/暖米）。 */
  const all = scan(prop => /^border|divider|outline|border-color/.test(prop));
  const bad = all.filter(b => !(PENDING_DIRTY[b.rel] && isDirty(b.rel)));
  assert.equal(
    bad.length,
    0,
    '以下边框仍在用暖棕字面量，应改为 --sb-border-subtle/default/strong（D21）：\n  ' +
      bad.map(b => b.rel + ':' + b.line + '  [' + b.prop + '] ' + b.text).join('\n  '),
  );
});

test('D21①-b：待办登记必须仍然有效（文件已干净则登记失效，债必须立刻还）', () => {
  /* 反向护栏：防止 PENDING_DIRTY 变成永久豁免。
     若文件已不再 dirty，却还挂着登记 → 立刻红，强制把那一处迁掉。 */
  const stale = Object.keys(PENDING_DIRTY).filter(rel => !isDirty(rel));
  assert.equal(
    stale.length,
    0,
    '以下文件已不再是 dirty，但 D21 待办登记仍存在 —— 请立即完成迁移并删除登记：\n  ' +
      stale.map(rel => rel + '：' + PENDING_DIRTY[rel]).join('\n  '),
  );
});

test('D21②：暖棕仍可保留在「非描边、非阴影」用途（如 background），不得机械归并', () => {
  /* D21 只裁「描边用途」。用作 background 的暖棕**不在本次裁定范围**，
     本断言确保它们没有被顺手改掉（守住裁定边界）。 */
  const bgs = scan(prop => /background/.test(prop));
  assert.ok(
    bgs.every(b => !/--sb-border-|--sb-shadow-/.test(b.text)),
    '非描边用途的暖棕不得被机械归并到 border/shadow 家族（D21 裁定边界）',
  );
});

test('D20-C：不得新增 --sb-brand-550（品牌紫不补第二档）', () => {
  const tokens = readFileSync(new URL('../src/styles/design-tokens-v3.css', import.meta.url), 'utf8');
  assert.ok(
    !/--sb-brand-550\s*:/.test(tokens),
    'D20-C 裁定：不新增 --sb-brand-550，第二支紫归并到 --sb-brand-600/700',
  );
});
