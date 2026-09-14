// test/token-vars-defined.test.mjs
// 幽灵变量门禁：**凡是被引用的 --sb-* 必须在样式文件里有定义**。
// ─────────────────────────────────────────────────────────────────────
// 背景（真实事故，发生过两次）：
//   ① Home.css 用 var(--sb-shadow-xl) —— 阶梯里只定义了 --sb-shadow-0…5 → 解析为 none，浮层面板阴影整体消失；
//   ② 全站 4 个文件用 var(--sb-shadow-sm/md/lg) —— 同样未定义 →
//      box-shadow 的 var() 引用 65 处里有 32 处解析为 none，**首页 4 张模式卡 / 参数 chip / 上传卡 / 主 CTA 的阴影全部消失**，
//      并且页面像素对比出现 5.53% 差异（远超「值等价」量级）。
// 为什么危险：**CSS 未定义的 var() 静默回退为初始值（阴影即 none），不报错、不告警、构建与测试都不红**。
// 所以必须由契约测试来兜底：
//   · 引用（var(--sb-x)）必须能在 src 下任何样式文件里找到定义（--sb-x: …）；
//   · 允许显式例外（确实由运行时/第三方注入的），但必须在 EXEMPT 里写明理由。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const CODE_EXT = new Set(['.css', '.jsx', '.js', '.ts', '.tsx']);

/* 运行时/第三方注入的变量，不属于我们的 token 体系 */
const EXEMPT = new Set([
  // React Flow 注入
  'xy-edge-stroke', 'xy-edge-stroke-selected', 'xy-attribution-background-color', 'xy-zoom-controls-bg',
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (CODE_EXT.has(path.extname(name))) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const defined = new Set();
const refs = []; // { name, file, line }

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/(--sb-[a-z0-9-]+)\s*:/g)) defined.add(m[1]);
    for (const m of line.matchAll(/var\(\s*(--sb-[a-z0-9-]+)/g)) {
      refs.push({ name: m[1], file: rel, line: i + 1 });
    }
  });
}

test('幽灵变量门禁：所有被引用的 --sb-* 都必须有定义（未定义 var() 会静默变成 none）', () => {
  const missing = new Map();
  for (const r of refs) {
    if (EXEMPT.has(r.name.slice(2))) continue;
    if (defined.has(r.name)) continue;
    if (!missing.has(r.name)) missing.set(r.name, []);
    missing.get(r.name).push(r.file + ':' + r.line);
  }
  const report = [...missing.entries()]
    .map(([name, where]) => name + '  ← ' + where.slice(0, 4).join(', ') + (where.length > 4 ? ' …(共' + where.length + '处)' : ''))
    .join('\n');
  assert.equal(
    missing.size,
    0,
    '发现被引用但未定义的 --sb-* token（会在浏览器里静默解析为 none，不报错）：\n' + report +
      '\n修法：在 src/styles/design-tokens-v3.css 里补定义或补别名；确属第三方注入的请加进本测试的 EXEMPT 并写理由。',
  );
});

test('幽灵变量门禁：断言本身有效（样本量合理，且确实扫到了定义）', () => {
  assert.ok(defined.size > 100, '应当解析到大量 token 定义，实际 ' + defined.size);
  assert.ok(refs.length > 100, '应当解析到大量 var() 引用，实际 ' + refs.length);
});
