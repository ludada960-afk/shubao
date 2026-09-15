// test/token-vars-defined.test.mjs
// 幽灵变量门禁：**凡是被 var() 引用的自定义属性，必须在某处有定义**。
// ─────────────────────────────────────────────────────────────────────
// 为什么需要（真实事故，已发生多次）：
//   CSS 里 var(--x) 若 --x 未定义，会**静默回退为初始值**——不报错、不告警、构建与测试都不红：
//     · var(--sb-shadow-xl) / var(--sb-shadow-sm/md/lg) → 阴影集体变 none（全站卡片浮不起来）
//     · var(--surface-raised) → 背景静默透明；var(--shadow-red) → 阴影静默失效
//     · 画布 --cvl-* 一族 26 处 → 控件尺寸静默落到初始值
//   唯一能兜住的办法就是契约测试：**引用必须能找到定义**。
//
// 定义的来源（三类都算）：
//   ① CSS 里的 `--x: …` 声明；
//   ② JSX/JS 内联样式对象里的 `'--x': …` / `"--x": …`；
//   ③ 运行时注入 `setProperty('--x', …)` / `style.setProperty("--x", …)`。
// 允许显式例外（第三方注入），但必须在 EXEMPT_PREFIX 里写明理由。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const EXT = new Set(['.css', '.jsx', '.js', '.ts', '.tsx']);

/** 第三方库注入的命名空间，不属于我们的 token 体系 */
const EXEMPT_PREFIX = [
  '--xy-',   // React Flow
  '--tw-',   // Tailwind
  '--radix-', '--rdx-', // Radix
  '--vite-',
];

const stripComments = text =>
  text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(name))) out.push(full);
  }
  return out;
}

const files = walk(SRC);
const defined = new Set();
const refs = [];

for (const file of files) {
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  const text = stripComments(readFileSync(file, 'utf8'));
  const isCss = file.endsWith('.css');
  text.split(/\r?\n/).forEach((line, i) => {
    // ① CSS 声明
    if (isCss) for (const m of line.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) defined.add(m[1]);
    // ② 内联样式键 / ③ setProperty
    for (const m of line.matchAll(/(['"`])(--[a-zA-Z0-9-]+)\1\s*:/g)) defined.add(m[2]);
    for (const m of line.matchAll(/setProperty\(\s*(['"`])(--[a-zA-Z0-9-]+)\1/g)) defined.add(m[2]);
    // 引用
    for (const m of line.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) {
      refs.push({ name: m[1], file: rel, line: i + 1 });
    }
  });
}

/**
 * 运行时**动态生成**的变量族：静态扫描看不到定义，但确实在 JS 里注入。
 * 每一条都必须写明「在哪个文件、怎么生成的」——这是白名单，不是免检区。
 */
const RUNTIME_PREFIX = [
  { prefix: '--cvl-z-', why: 'src/pages/EcCanvas/canvasVisualLanguage.js:198 用 Object.fromEntries(CANVAS_Z) 动态生成 `--cvl-z-<key>`' },
];

const isExempt = name =>
  EXEMPT_PREFIX.some(p => name.startsWith(p)) || RUNTIME_PREFIX.some(r => name.startsWith(r.prefix));

test('幽灵变量门禁：被 var() 引用的自定义属性必须有定义（未定义会静默失效，不报错）', () => {
  const missing = new Map();
  for (const r of refs) {
    if (isExempt(r.name) || defined.has(r.name)) continue;
    if (!missing.has(r.name)) missing.set(r.name, []);
    missing.get(r.name).push(r.file + ':' + r.line);
  }
  const report = [...missing.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([name, where]) => '  ' + name + '  ← ' + where.slice(0, 3).join(', ') + (where.length > 3 ? ' …(共' + where.length + ' 处)' : ''))
    .join('\n');
  assert.equal(
    missing.size,
    0,
    '发现被引用但从未定义的变量（浏览器里会静默回退，样式悄悄失效）：\n' + report +
      '\n修法：落到 token（src/styles/design-tokens-v3.css）或就地补定义；确属第三方注入的请加进 EXEMPT_PREFIX 并写理由。',
  );
});

test('幽灵变量门禁：断言本身有效（样本量合理）', () => {
  assert.ok(defined.size > 100, '应解析到大量定义，实际 ' + defined.size);
  assert.ok(refs.length > 100, '应解析到大量 var() 引用，实际 ' + refs.length);
});
