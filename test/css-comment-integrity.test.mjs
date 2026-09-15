// test/css-comment-integrity.test.mjs
// 门禁（P0 类）：**CSS 注释必须闭合得跟开得一样**。
// ─────────────────────────────────────────────────────────────────────────────
// 为什么需要（真实事故，2026-09-15 修复）：
//   CSS 注释**不能嵌套**。design-tokens-v3.css 第 672 行那条说明注释里，
//   又**字面写出**了一个注释结束符（原文是「搜 ＜开始符＞── 手机 sm...── ＜结束符＞」）。
//   于是注释在那一行**提前结束**，后面 5 行说明文字被当成 CSS **选择器前导**，
//   与下一条规则的 :root 选择器（兼容别名层）并成一个**非法选择器** →
//   浏览器把**整条规则丢弃**。
//
//   后果：35 条别名 token 全部解析为空串，240 个引用点静默失效。
//   用户可感知：首页「品牌主色」色块 width/height 取 var(--sb-control-lg) → 解析为 0 →
//   整块只剩 2px 边框，渲染成 4px 的一个点（应为 36px）。
//
//   为什么别的门禁抓不到：
//     · 幽灵变量门禁查「有没有定义」—— 文本上**确实有**；
//     · 同作用域重复定义门禁查「值不同」—— 整块当时对解析器不可见；
//     · 源码完整性门禁查「能否解析 / 花括号配平」—— 注释是合法 CSS，花括号也配平。
//   只有实机契约（test/home-panel-hitarea-live.test.mjs）抓到了它。
//   本门禁是把它变成**静态可查**的那一层。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectDeclarations } from '../scripts/lib/token-scope.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* 定界符一律用拼接构造 —— 这个文件自己的注释里也不许出现字面定界符（本门禁扫的就是全仓 .css，
   但保持同一纪律可以避免「写门禁的人自己踩坑」）。 */
const OPEN = '/' + '*';
const CLOSE = '*' + '/';
const NL = String.fromCharCode(10);

/** 逐字符扫描注释状态；返回注释内的「又出现开始符」与「文件结束时仍在注释内」。 */
export function scanCommentIntegrity(src) {
  let i = 0, inComment = false, line = 1, openLine = 0;
  const nestedOpeners = [];
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (src[i] === NL) { line += 1; i += 1; continue; }
    if (!inComment) {
      if (two === OPEN) { inComment = true; openLine = line; i += 2; continue; }
      i += 1; continue;
    }
    if (two === CLOSE) { inComment = false; i += 2; continue; }
    if (two === OPEN) nestedOpeners.push({ commentOpenedAt: openLine, nestedOpenerAt: line });
    i += 1;
  }
  return { nestedOpeners, unterminatedAt: inComment ? openLine : 0 };
}

function walkCss(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkCss(full, out);
    else if (name.endsWith('.css')) out.push(full);
  }
  return out;
}

const CSS_FILES = walkCss(path.join(ROOT, 'src'));
const TOKENS = path.join(ROOT, 'src/styles/design-tokens-v3.css');

/* 兼容别名层必须落在 :root 的这些 token（事故时它们整块被丢弃）。
   这条断言守的是**失效模式本身**：只要别名层再被任何东西吞掉，这里立刻变红。 */
const ALIAS_TOKENS = [
  '--sb-brand-hover', '--sb-brand-active', '--sb-brand-wash', '--sb-brand-line', '--sb-brand-ink',
  '--sb-brand-gradient', '--sb-brand-gradient-3',
  '--sb-text-primary', '--sb-text-secondary', '--sb-text-muted', '--sb-text-hint', '--sb-text-faint',
  '--sb-text-brand', '--sb-text-on-inverse',
  '--sb-radius-panel', '--sb-radius-card', '--sb-radius-control', '--sb-radius-chip',
  '--sb-control-sm', '--sb-control-md', '--sb-control-lg', '--sb-control-touch', '--sb-control-min-w',
  '--sb-panel-padding', '--sb-group-gap', '--sb-field-gap', '--sb-action-gap',
  '--sb-state-hover-bg', '--sb-state-active-bg', '--sb-state-selected-bg', '--sb-state-selected-line',
  '--sb-state-selected-ink', '--sb-state-disabled-bg', '--sb-state-disabled-ink', '--sb-focus-ring',
];

test('① 检测器自证：注释内再出现开始符必须被数出来；干净样本不得误报', () => {
  const bad = 'a { color: red; } ' + OPEN + ' 说明：搜 ' + OPEN + ' 手机 sm ' + CLOSE + ' 这块 ' + CLOSE;
  const r1 = scanCommentIntegrity(bad);
  assert.equal(r1.nestedOpeners.length, 1, '注释内又出现开始符 —— 必须数出来');
  assert.equal(r1.nestedOpeners[0].nestedOpenerAt, 1, '必须报出嵌套开始符所在行');

  const good = OPEN + ' 正常注释，提到 token --sb-control-lg ' + CLOSE + NL + ':root { --x: 1; }';
  assert.equal(scanCommentIntegrity(good).nestedOpeners.length, 0, '干净注释不得误报');

  const unterminated = ':root { --x: 1; }' + NL + OPEN + ' 这个注释没有闭合';
  assert.equal(scanCommentIntegrity(unterminated).unterminatedAt, 2, '未闭合注释必须被报出');
});

test('② 全仓 CSS：注释里不得再出现注释开始符（CSS 注释不能嵌套）', () => {
  const bad = [];
  for (const f of CSS_FILES) {
    const r = scanCommentIntegrity(fs.readFileSync(f, 'utf8'));
    for (const h of r.nestedOpeners) {
      bad.push(path.relative(ROOT, f).split(path.sep).join('/') + ' 注释开于第 ' + h.commentOpenedAt + ' 行，第 ' + h.nestedOpenerAt + ' 行又出现开始符');
    }
  }
  assert.equal(bad.length, 0,
    'CSS 注释内不得出现注释开始符 —— 它会让注释**提前结束**，' + NL +
    '  后面的说明文字会被当成选择器前导，把紧随其后的规则整条吞掉，' + NL +
    '  而幽灵变量/重复定义/源码完整性三条门禁**都看不见**（真实事故见本文件头）。' + NL +
    '  修法：注释里不要写定界符，改用文字表述（如「注释开始符」）。' + NL + bad.join(NL));
});

test('③ 全仓 CSS：注释定界符必须配平，且文件结束时不得仍在注释内', () => {
  const bad = [];
  for (const f of CSS_FILES) {
    const src = fs.readFileSync(f, 'utf8');
    const opens = src.split(OPEN).length - 1;
    const closes = src.split(CLOSE).length - 1;
    const r = scanCommentIntegrity(src);
    if (opens !== closes) bad.push(path.relative(ROOT, f).split(path.sep).join('/') + ' 开始符 ' + opens + ' ≠ 结束符 ' + closes);
    if (r.unterminatedAt) bad.push(path.relative(ROOT, f).split(path.sep).join('/') + ' 第 ' + r.unterminatedAt + ' 行起的注释没有闭合');
  }
  assert.equal(bad.length, 0, '注释定界符不配平（会吞掉后续规则）：' + NL + bad.join(NL));
});

test('④ 作用域自证：兼容别名层必须真的落在 :root（防「整块被吞」复发）', () => {
  const decls = collectDeclarations(fs.readFileSync(TOKENS, 'utf8'));
  const scopeOf = name => (decls.find(d => d.name === name) || {}).scope;
  const misplaced = ALIAS_TOKENS.filter(n => scopeOf(n) !== ':root');
  assert.equal(misplaced.length, 0,
    '这 ' + misplaced.length + ' 条别名 token 不在 :root 作用域 —— 说明兼容别名层又整块失效了：' + NL +
    misplaced.map(n => '    ' + n + '  scope=' + JSON.stringify(scopeOf(n))).join(NL) + NL +
    '  （历史上它被一段提前闭合的注释吞掉过整整 35 条，见本文件头。）');
});

test('⑤ 反向保险：必须真的扫到足量 CSS 文件（防目录写错后静默全绿）', () => {
  assert.ok(CSS_FILES.length >= 40, '只扫到 ' + CSS_FILES.length + ' 个 CSS，样本量异常（扫描根目录可能写错）');
  assert.ok(CSS_FILES.some(f => f.endsWith(path.join('styles', 'design-tokens-v3.css'))), 'token 权威文件必须在扫描范围内');
});
