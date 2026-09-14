// test/dead-css-declarations.test.mjs
// 静默失效的声明门禁：**长度属性写了裸数字 = 无效声明，浏览器整条丢弃**。
// ─────────────────────────────────────────────────────────────────────────────
// 为什么需要（真实事故）：
//   全仓实测 **9 处** `gap: 3;` / `gap: 7;` / `gap: 5;` / `gap: 1;` —— 缺 px 单位。
//   CSS 里这是**无效声明**，浏览器直接丢掉，于是那些间距**从来没生效过**（一直是 0）。
//   它的危险在于：迁移线看到 `gap: 10;` 会以为「这是个待迁移的字面量」，
//   把它「迁成 token」——**看起来在做迁移，实际是在改一个从未生效的值**。
//   与「幽灵变量」同族：不报错、不告警、构建与测试都不红。
//
// ⚠️ 只查 `.css`：JSX 内联样式里的裸数字**是合法的**（React 会补 px）。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

/** 需要单位的「长度类」属性白名单（其余属性的裸数字是合法的：z-index / opacity / flex / order / font-weight / line-height …） */
const LENGTH_PROPS = new Set([
  'gap', 'row-gap', 'column-gap',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'font-size', 'border-radius', 'border-width', 'outline-width', 'outline-offset', 'letter-spacing',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'top', 'right', 'bottom', 'left', 'text-indent', 'flex-basis',
]);

/** 剥注释但**保留换行**，否则报出来的行号会漂（这个坑我踩过） */
const stripComments = t => t.replace(/\/\*[\s\S]*?\*\//g, s => s.replace(/[^\n]/g, ' '));

/** 找出所有「长度属性 + 裸数字（非 0）」的声明 */
export function findDeadDeclarations(text) {
  const stripped = stripComments(text);
  const out = [];
  const re = /(^|[;{\s])([a-z-]+)\s*:\s*(-?[0-9.]+)\s*(;|\})/g;
  let m;
  while ((m = re.exec(stripped))) {
    if (!LENGTH_PROPS.has(m[2])) continue;
    if (parseFloat(m[3]) === 0) continue;      /* 0 可以不带单位 */
    out.push({ prop: m[2], value: m[3], line: stripped.slice(0, m.index).split('\n').length });
  }
  return out;
}

function walkCss(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walkCss(full, out);
    else if (name.endsWith('.css')) out.push(full);
  }
  return out;
}

test('① 检测器本身有效（喂坏样本必须能抓到）', () => {
  assert.equal(findDeadDeclarations('.a { gap: 5; }').length, 1, '`gap: 5;` 必须被抓到');
  assert.equal(findDeadDeclarations('.a { gap: 5px; }').length, 0, '`gap: 5px;` 是合法的');
  assert.equal(findDeadDeclarations('.a { gap: 0; }').length, 0, '`0` 可以不带单位');
  assert.equal(findDeadDeclarations('.a { line-height: 1.5; z-index: 5; opacity: .5; }').length, 0,
    'line-height / z-index / opacity 的裸数字是合法的');
  assert.equal(findDeadDeclarations('/* .a { gap: 5; } */ .b { color: red; }').length, 0, '注释里的不算');
});

test('② 全仓 .css 不得再有「长度属性缺单位」的静默失效声明', () => {
  const files = walkCss(SRC);
  /* 样本量护栏：路径写错会扫到 0 个文件从而「空转通过」。实测全仓 ~48 个 CSS。 */
  assert.ok(files.length > 40, '扫描到的 CSS 文件数异常（' + files.length + ' 个），防止路径写错导致空转');
  const bad = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    for (const d of findDeadDeclarations(readFileSync(file, 'utf8'))) bad.push(rel + ':' + d.line + '  ' + d.prop + ': ' + d.value + ';');
  }
  assert.equal(bad.length, 0,
    '发现被浏览器**直接丢弃**的声明（样式从未生效）：\n  ' + bad.join('\n  ') +
    '\n修法：补上单位（如 `gap: 5px;`）。JSX 内联样式的裸数字是合法的，不在本门禁范围。');
});
