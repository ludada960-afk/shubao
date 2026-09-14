// test/source-syntax-integrity.test.mjs
// 门禁：**源码文件必须是"能编译的完整文件"**。
// ─────────────────────────────────────────────────────────────────────────────
// 为什么需要（真实事故，构建全红而单测全绿）：
//   `7a807673`（D18 批6：45+ 文件的机械圆角改写）把 `src/pages/EcStudio/index.jsx` 的
//   **文件头 57 行整段删掉**（头注释 + 全部 import + 样式常量对象），第 1 行只剩一个孤儿片段 `nter',`。
//   结果：`npm run build` 报 `Unterminated string literal` —— **站点直接起不来**；
//   而**单元测试全绿**（没有任何断言覆盖"文件头还在不在"）。
//   另一类同族事故：文件被工具**压成一行**（60KB 无换行），人眼看不见、diff 也难发现。
//
// 判据（原则 §12：指标必须测量判据本身）：
//   ① 每个源文件都能被**真实编译器**解析（用项目里已有的 esbuild，不是自己写正则猜语法）；
//   ② 每个源文件都"像人写的"—— 60KB 却只有 1 行 = 被工具压平，视为损坏；
//   ③ CSS 的花括号必须配平（截断/压平都会失衡）。
// ⚠️ 并发工作区提示：若本门禁报红，**先重跑一次** —— 可能是别人正在写文件的中间态（RTK §3.1-6）。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', 'dist', '.git']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!SKIP.has(e.name)) walk(p, out); }
    else out.push(p);
  }
  return out;
}

/** 判断一个文件是否"被压平/截断" —— 返回 null 表示正常，否则返回原因 */
export function detectFlattened(text, rel) {
  const lines = text.split('\n');
  const chars = text.length;
  if (chars > 4000 && lines.length <= 3) {
    return rel + '：' + chars + ' 字节却只有 ' + lines.length + ' 行 —— 文件被**压成一行**（工具损坏），不是人写的文件';
  }
  if (/\.[cm]?jsx?$/.test(rel) && !/^\s*(\/\*|\/\/|import|export|const|let|var|function|class|"use |'use )/.test(lines[0] || '')) {
    return rel + '：第 1 行不是合法的文件起始（实测 ' + JSON.stringify((lines[0] || '').slice(0, 40)) + '）—— 文件头疑似被删';
  }
  return null;
}

/** CSS 花括号配平（剥注释与字符串后计数） */
export function cssBracesBalanced(text) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/"[^"]*"|'[^']*'/g, '""');
  return (clean.match(/\{/g) || []).length === (clean.match(/\}/g) || []).length;
}

const FILES = walk(path.join(ROOT, 'src'));

test('① 检测器自证：压平/截断的文件必须被判为损坏', () => {
  assert.ok(detectFlattened('x'.repeat(6000), 'a.jsx'), '6000 字节却只有 1 行 → 必须报损坏');
  assert.equal(detectFlattened('nter\',\n    flexShrink: 0,\n', 'a.jsx') !== null, true,
    '文件头被删（首行是孤儿片段）→ 必须报损坏');
  assert.equal(detectFlattened('/**\n * ok\n */\nimport x from "y";\nconst a = 1;\n', 'a.jsx'), null,
    '正常文件不得误报');
  assert.equal(cssBracesBalanced('.a { color: red; }'), true);
  assert.equal(cssBracesBalanced('.a { color: red; '), false, 'CSS 截断必须被抓到');
});

test('② 全部源码文件都能被 esbuild 解析（能编译 = 完整）', () => {
  const jsFiles = FILES.filter(f => /\.(jsx?|mjs|cjs)$/.test(f));
  assert.ok(jsFiles.length > 100, '只扫到 ' + jsFiles.length + ' 个 js 文件，样本量异常');
  const broken = [];
  for (const f of jsFiles) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/');
    let code;
    try { code = fs.readFileSync(f, 'utf8'); } catch { continue; }
    const flat = detectFlattened(code, rel);
    if (flat) { broken.push(flat); continue; }
    try {
      esbuild.transformSync(code, { loader: 'jsx', jsx: 'automatic', logLevel: 'silent' });
    } catch (e) {
      broken.push(rel + '：' + String(e.message || e).split('\n').slice(0, 3).join(' / '));
    }
  }
  assert.equal(broken.length, 0,
    '以下源文件**编译不过**（站点会直接起不来，而单测可能全绿）：\n  ' + broken.join('\n  ') +
    '\n  ⚠️ 若这是并发写入的中间态，**先重跑一次**再定性（RTK §3.1-6）。');
});

test('③ 全部 CSS 文件花括号配平（截断会让整段样式失效）', () => {
  const cssFiles = FILES.filter(f => f.endsWith('.css'));
  assert.ok(cssFiles.length > 20, '只扫到 ' + cssFiles.length + ' 个 css 文件，样本量异常');
  const bad = [];
  for (const f of cssFiles) {
    const rel = path.relative(ROOT, f).split(path.sep).join('/');
    const text = fs.readFileSync(f, 'utf8');
    if (!cssBracesBalanced(text)) bad.push(rel);
  }
  assert.equal(bad.length, 0, '以下 CSS 花括号不配平（多半是截断）：\n  ' + bad.join('\n  '));
});
