// ═══ 2026-10-01：JSX 里的裸注释会变成界面文案 ═══════════════════════════════════════════════
//
// 用户批注（对着画布派生面板的截图）：
//   「什么情况啊，你为什么还是把这些暴露出来啊，不是说鼠标放上去按钮再显示提示文案吗，
//     你现在怎么还乱码了呀」
//
// 真因：批 CY-㊴ 在派生卡片里加了一行说明，写成了**裸的**块注释起始符（斜杠 + 星号）。
// JSX 里那不是注释 —— 它被当成**文本子节点**渲染出来，于是整段内部批注变成了卡片上显示的
// 文案，用户看到的就是"乱码"。正确写法是花括号包起来的 JSX 注释。
//
// 这一类**编译得过、单测也查不出**（文本节点本来就合法），只在界面上现形。
//
// 判据为什么用 esbuild 而不是正则：第一版用正则（"左边不是花括号的注释起始符就是裸注释"）
// 噪声大到没法看 —— 文件头的正常块注释、accept 属性里的通配符全被算进来，
// 一次报几百条备份目录里的历史副本。**噪声太大的门禁等于没有门禁。**
// esbuild 转换后的产物把区别摆得清清楚楚：
//
//   裸注释   → createElement("button", null, "<注释文本>", …)   ← 多出一个字符串子节点
//   JSX 注释 → createElement("button", null, createElement(…))  ← 什么都不留
//   块注释   → 直接被剥掉
//
// ⇒ 判据：产物里出现「整体被注释定界符包住的字符串字面量」就判红。
// 真实界面文案不可能整体被注释定界符包着，所以这个特征不会误伤正常内容。
// esbuild 是 vite 的依赖、构建链本来就在用它，所以这个依赖是稳的。
//
// ⚠️⚠️ 写这份文件时我连着三次把自己写挂：注释里为了举例写出了注释的起始/结束定界符，
// 把块注释提前闭合，剩下的当成了代码。**注释里绝不能出现注释定界符** —— 现��这段用
// 行注释逐行写，就是为了从根上杜绝这件事。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const esbuild = require('esbuild');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(join(ROOT, relative), 'utf8');

const SLASH = String.fromCharCode(47);
const STAR = String.fromCharCode(42);
const OPEN = SLASH + STAR;          // 注释起始符
const CLOSE = STAR + SLASH;         // 注释结束符

// 泄漏签名：被当成文本渲染的注释，会变成一个「被定界符整体包住」的字符串字面量。
// ⚠️ 拼正则时星号要转义，不然 new RegExp 会报 "Nothing to repeat"（斜杠不用转义，
//    因为这里用的是字符串构造、不是 /…/ 字面量，没有分隔符）。
const OPEN_RE = SLASH + '\\' + STAR;
const CLOSE_RE = '\\' + STAR + SLASH;
const LEAKED = new RegExp('"(\\s*' + OPEN_RE + '[\\s\\S]{0,400}?' + CLOSE_RE + '\\s*)"', 'g');

function leakedCommentStrings(source) {
  const out = esbuild.transformSync(source, { loader: 'jsx', jsx: 'transform', logLevel: 'silent' }).code;
  const hits = [];
  let m;
  LEAKED.lastIndex = 0;
  while ((m = LEAKED.exec(out))) hits.push(m[1].trim().slice(0, 80));
  return hits;
}

// 只扫 src：仓库还跟踪着一批 backup-src-… / export_to_claude / screenshots 里的
// 历史归档副本，它们不进构建、也不上屏。
const files = execSync('git ls-files "src/**/*.jsx"', { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  .split(/\r?\n/).map(s => s.trim()).filter(Boolean);

test('① src 下不得有裸注释（它会被当成文本节点渲染到界面上）', () => {
  assert.ok(files.length > 20, `只扫到 ${files.length} 个 src 下的 jsx —— 目录写错了，这条门禁会恒真`);
  const hits = [];
  for (const file of files) {
    let out;
    try { out = leakedCommentStrings(read(file)); } catch { continue; }
    for (const text of out) hits.push(`${file}  →  ${text}`);
  }
  assert.deepEqual(hits, [],
    '这些位置的裸注释被 esbuild 渲染成了字符串子节点，也就是会出现在界面上'
    + '（用户 2026-10-01 实测在派生面板看到整段内部批注）：\n  ' + hits.join('\n  '));
});

test('② 检测器自证：三种样本，只抓出问题那一种', () => {
  const bare = OPEN + ' 内部批注不该出现在界面上 ' + CLOSE;
  const jsxComment = '{' + bare + '}';

  // ① 裸注释 —— 必须抓到
  const bad = leakedCommentStrings(
    'export default function X(){ return (<button>\n  ' + bare + '\n  <span>hi</span>\n</button>); }');
  assert.equal(bad.length, 1, '裸注释必须被抓到，实际：' + JSON.stringify(bad));

  // ② 正确写法 —— 不得误报
  assert.deepEqual(leakedCommentStrings(
    'export default function X(){ return (<button>\n  ' + jsxComment + '\n  <span>hi</span>\n</button>); }'),
  [], '花括号包住的 JSX 注释不得误报');

  // ③ 普通块注释与属性里的通配符 —— 这两类曾把第一版的正则判据淹掉，不得误报
  assert.deepEqual(leakedCommentStrings(
    bare + '\nexport default function X(){ return <img accept="image' + OPEN + '" alt="" />; }'),
  [], '文件头块注释与 accept 属性里的通配符不得误报');
});

test('③ 派生卡片：描述走 hover，且界面上确实不显示', () => {
  /* 用户要的是「鼠标放上去按钮再显示提示文案」。批 CY-㊴ 定的做法是：
     元素保留（读屏仍拿得到）+ CSS `display:none` 收起 —— 门禁
     canvas-right-panel-hint-1001 钉的就是它，我这里不重复发明，只补上
     「不许退回成可见」这一半（那一半原来没人钉）。 */
  const src = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
  const css = read('src/styles/canvas-derive-menu.css');
  const tile = /className="ec-canvas-derive-tile"[\s\S]{0,1600}?<\/button>/.exec(src);
  assert.ok(tile, '要能定位到派生卡片的 button');
  assert.match(tile[0], /title=\{action\.description\}/,
    '整块 tile 必须挂 title —— 鼠标停在卡片上（含价格那半截）都要能拿到完整句子');
  assert.match(tile[0], /<small aria-hidden="true">\{action\.description\}<\/small>/,
    '描述元素要留着（批 CY-㊴ 的决定：读屏仍拿得到），由 CSS 收起而不是删掉');
  const small = /\.ec-canvas-derive-copy small \{([^}]*)\}/.exec(css);
  assert.ok(small, '要能读到描述元素的 CSS');
  assert.match(small[1], /display:\s*none/,
    '描述不许在界面上可见 —— 用户原话「不是说鼠标放上去按钮再显示提示文案吗」');
  assert.doesNotMatch(small[1], /-webkit-line-clamp/,
    '两行截断读不全，正是批 CY-㊴ 要去掉的「堆满小字」那条路');
});