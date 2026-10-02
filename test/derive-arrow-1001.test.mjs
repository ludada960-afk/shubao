// 门禁：派生卡片的箭头必须**恒定靠右**，与有没有价格徽标无关。
// 用户 2026-10-01 原话：「你这两个箭头又是怎么回事？为什么四个卡片里面有的箭头在左边，
// 有的箭头在右边呢？你这又是没有搞明白吗？」
//
// 根因（实测）：`.ec-canvas-derive-meta` 是 `justify-content: space-between`。
//   有徽标 → 子元素 [徽标, 箭头]，箭头被推到右边；
//   无徽标 → 子元素只剩 [箭头]，**没有可分布的空间** ⇒ 贴到左边。
// 实测值：有徽标时箭头距卡片右边 10px，无徽标时 166px。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(join(ROOT, relative), 'utf8');
const CSS = 'src/styles/canvas-derive-menu.css';
const code = relative => read(relative).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('① 箭头自己 margin-left:auto（不靠 space-between —— 那在没有徽标时会把箭头甩到左边）', () => {
  const css = code(CSS);
  assert.match(
    css,
    /\.ec-canvas-derive-tile \.ec-canvas-derive-meta svg\s*\{[^}]*margin-left:\s*auto/,
    '箭头必须自己靠右；只写 space-between 的话，没有价格徽标时箭头会跑到左边'
  );
});

test('② 检测器自证：把 margin-left 去掉，这条必须判红', () => {
  const css = code(CSS);
  const mutated = css.replace(
    /\.ec-canvas-derive-tile \.ec-canvas-derive-meta svg\s*\{[^}]*margin-left:\s*auto[^}]*\}/,
    '.ec-canvas-derive-tile .ec-canvas-derive-meta svg { }',
  );
  assert.notEqual(mutated, css, '变异没命中（判据该更新了）');
  assert.doesNotMatch(
    /\.ec-canvas-derive-tile \.ec-canvas-derive-meta svg\s*\{[^}]*margin-left:\s*auto/.exec(mutated)?.[0] || '',
    /margin-left/,
    '变异后必须抓不到，否则这条门禁是恒真的'
  );
});

test('③ meta 那一行必须保留 space-between（价格徽标仍然靠左）', () => {
  assert.match(code(CSS), /\.ec-canvas-derive-tile \.ec-canvas-derive-meta\s*\{[^}]*justify-content:\s*space-between/,
    '价格徽标要靠左、箭头要靠右，靠的就是这一行');
});