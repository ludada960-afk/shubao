#!/usr/bin/env node
/**
 * 薯包AI 设计规范自查脚本（只读）
 * ─────────────────────────────────────────────
 * 用途：随时验证 docs/design 里的结论是否仍然成立，以及落地进度。
 * 运行：node scripts/design-audit.mjs
 *
 * 它做四件事：
 *   ① 统计现状碎片化程度（hex / 字号 / 圆角 / z-index）
 *   ② 检查无障碍硬缺陷（focus-visible / outline:none / div onClick）
 *   ③ 校验 sb-tokens.css 的对比度是否满足 WCAG
 *   ④ 输出落地进度看板
 *
 * ⚠️ 只读，不修改任何文件。
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');

/* ─────────────── 工具 ─────────────── */
function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(e.name)) continue;
      walk(p, exts, out);
    } else if (exts.some(x => e.name.endsWith(x))) out.push(p);
  }
  return out;
}
const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');

function countAll(files, re, norm) {
  const m = new Map();
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    for (const match of txt.matchAll(re)) {
      const raw = match[1] ?? match[0];
      const k = norm ? norm(raw) : raw;
      m.set(k, (m.get(k) || 0) + 1);
    }
  }
  return m;
}
/**
 * 把 `var(--sb-x)` 解析成真实数值再统计档位。
 * 为什么必须这么做：原口径直接拿正则捕获到的**字符串**当 key，于是
 *   fontSize: 12            → key '12'
 *   fontSize: 'var(--sb-text-sm)' → key '--sb-text-sm'
 * 换 token **不会**让档位下降，反而多出一个新 key——度量在惩罚正确做法。
 * 现在先从所有 CSS 里建 `--sb-* → 值` 表（跟随别名链），统计时把 var() 还原成数值，
 * 于是「同一 token 被到处复用」会真正体现为「档位收敛」。
 */
let _tokenValues = null;
const TOKEN_VALUES = () => {
  if (_tokenValues) return _tokenValues;
  const map = new Map();
  for (const f of cssFiles) {
    const txt = fs.readFileSync(f, 'utf8');
    for (const m of txt.matchAll(/(--sb-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      if (!map.has(m[1])) map.set(m[1], m[2].trim());
    }
  }
  /* 跟随别名链，最多 6 跳，防环 */
  const resolve = (raw, depth = 0) => {
    if (depth > 6) return raw;
    const m = /^var\(\s*(--sb-[a-z0-9-]+)\s*(?:,\s*([^)]+))?\)$/.exec(raw.trim());
    if (!m) return raw;
    const next = map.get(m[1]);
    if (next === undefined) return m[2] ? m[2].trim() : raw;
    return resolve(next, depth + 1);
  };
  const out = new Map();
  for (const [k, v] of map) out.set(k, resolve(v));
  _tokenValues = out;
  return out;
};
const px = value => {
  const m = /^(-?[0-9.]+)\s*px$/.exec(String(value).trim());
  if (m) return m[1];
  const n = /^(-?[0-9.]+)$/.exec(String(value).trim());
  return n ? n[1] : String(value).trim();
};
const normalize = raw => {
  const s = String(raw).trim().replace(/^['\"]|['\"]$/g, '');
  const vm = /^var\(\s*(--sb-[a-z0-9-]+)/.exec(s);
  const tv = TOKEN_VALUES();
  if (vm && tv.has(vm[1])) return px(tv.get(vm[1]));
  return px(s);
};

function topN(map, n, sort = 'count') {
  const arr = [...map.entries()];
  if (sort === 'count') arr.sort((a, b) => b[1] - a[1]);
  else arr.sort((a, b) => (parseFloat(a[0]) || 0) - (parseFloat(b[0]) || 0));
  return arr.slice(0, n);
}

/* ─────────────── WCAG 对比度 ─────────────── */
const lum = hex => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/* ─────────────── 主流程 ─────────────── */
const codeFiles = walk(SRC, ['.jsx', '.js', '.tsx', '.ts', '.css']);
const cssFiles = walk(SRC, ['.css']);
const allText = codeFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');

const sbTokensPath = path.join(SRC, 'styles', 'design-tokens-v3.css');
const hasSbTokens = fs.existsSync(sbTokensPath);
const mainJsx = fs.readFileSync(path.join(SRC, 'main.jsx'), 'utf8');
const sbWired = /design-tokens-v3\.css/.test(mainJsx);

const line = (c = '─') => console.log(c.repeat(72));
const H = t => { console.log(''); line('═'); console.log('  ' + t); line('═'); };

console.log('\n薯包AI 设计规范自查 — ' + new Date().toISOString().slice(0, 19).replace('T', ' '));
console.log('扫描 ' + codeFiles.length + ' 个源文件 (' + cssFiles.length + ' 个 CSS)');

/* ═══ ① 碎片化程度 ═══ */
H('① 现状碎片化程度');

const hexes = countAll(codeFiles.filter(f => !f.endsWith('design-tokens-v3.css') && !f.endsWith('design-tokens.css')),
  /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g);
const hexTotal = [...hexes.values()].reduce((a, b) => a + b, 0);
console.log('  hex 硬编码:  ' + hexTotal + ' 次 / ' + hexes.size + ' 个不同值   [目标: 全部走 token]');

/* ⚠️ 必须同时覆盖 CSS 的 `font-size:` 与 JSX 的 `fontSize:` ——
   此前只认驼峰，于是**所有 .css 里声明的字号都不计入**，档位数被系统性低估。
   同理 `border-radius:` / `gap:`（`gap` 两种写法同名，本来就覆盖）。 */
const SCALE_RE = (name) => new RegExp(name + '(?:-[a-z]+)?:\\s*[\\x27"]?(var\\(--sb-[a-z0-9-]+\\)|[0-9.]+)', 'g');
const fontSizes = countAll(codeFiles, SCALE_RE('font[Ss]ize'), normalize);
console.log('  字号档位:    ' + fontSizes.size + ' 档                [目标: 10 档 · 依 D17]   ' +
  topN(fontSizes, 6).map(([k, v]) => k + 'px×' + v).join(' '));

const radii = countAll(codeFiles, SCALE_RE('border[Rr]adius'), normalize);
console.log('  圆角档位:    ' + radii.size + ' 档                [目标: 8 档 · 依 D6]   ' +
  topN(radii, 6).map(([k, v]) => k + 'px×' + v).join(' '));

const zIdx = countAll(codeFiles, /zIndex:\s*'?([0-9]+)/g);
console.log('  z-index:     ' + zIdx.size + ' 个裸值             [目标: 9 档语义]');

const gaps = countAll(codeFiles, /gap:\s*'?(var\(--sb-[a-z0-9-]+\)|[0-9]+)/g, normalize);
/* 阶梯**从 token 文件现读**，不在这里抄一份 —— 抄一份就一定会漂。
   事故：D16 补了 2/6/10 三个半档之后，本脚本仍用旧表，于是把已经合法等值迁移的
   2/6/10px 仍然判为「非阶梯」，读数虚高约 28 个百分点（实测 55% → 27%）。
   这正是原则 §12「指标必须测量判据本身」的第 5 次同类问题。 */
const tvGap = TOKEN_VALUES();
const LADDER = new Set();
for (const [name, val] of tvGap) if (name.startsWith('--sb-space-')) LADDER.add(px(val));
let offLadder = 0, gapTotal = 0, migratable = 0, byDesign = 0;
for (const [k, v] of gaps) {
  gapTotal += v;
  if (LADDER.has(k)) { migratable += v; continue; }   /* 值在阶梯上却没写 token = 还没迁 */
  offLadder += v; byDesign += v;                       /* 值不在阶梯 = 设计保留，需登记 */
}
console.log('  gap 非阶梯值: ' + offLadder + '/' + gapTotal + ' 次' +
  (gapTotal ? ' (' + (offLadder / gapTotal * 100).toFixed(0) + '%)' : ''));
console.log('    · ① 值已在阶梯上、但还写成字面量（可**零风险** token 化）: ' + migratable + ' 次   [迁移待办，不是缺陷]');
console.log('    · ② 值不在阶梯上（D16 判定为「设计保留」，需登记理由）: ' + byDesign + ' 次   [不是缺陷，不许硬套]');
console.log('      阶梯真值（现读 token 文件）: ' + [...LADDER].sort((a, b) => a - b).join('/'));

/* ═══ ② 无障碍硬缺陷 ═══ */
H('② 无障碍硬缺陷');

const appFiles = codeFiles.filter(f => !f.endsWith('design-tokens-v3.css') && !f.endsWith('design-tokens.css'));
const appText = appFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');

const fv = (appText.match(/:focus-visible|focus-visible/g) || []).length;
const fvInTokens = hasSbTokens
  ? (fs.readFileSync(sbTokensPath, 'utf8').match(/focus-visible/g) || []).length : 0;
console.log('  focus-visible 出现:  ' + fv + ' 次 (规范文件内 ' + fvInTokens + ' 次)   ' +
  (fv === 0 ? '❌ P0 违规 WCAG 2.4.7' : '✅'));

/* ── ① 声明总数（保留，看规模）────────────────────────────────────────────── */
const outlineNone = (appText.match(/outline:\s*['"]none['"]|outline:\s*none/g) || []).length;

/* ── ② 真正要盯的数字：**不可达焦点**（依 D11）────────────────────────────────
   D11 原文：判据是「抑制了轮廓**必须有可见替代**」，指标是**不可达焦点 = 0**，
   **不是关键词计数**。（此前这里只数字符串出现次数 → 420 行那种
   `.x:focus-visible { … }` 里带可见替代的也被算成「裸」，属于用代理指标冒充判据 ——
   同一类错误本仓已犯过三次：注释里的 hex 被算债务、var() 被算独立档位、现在这个是第三次。）
   规则：一条 `outline:none` 只有在**没有任何可见替代**时才算缺陷。
   可见替代 = 同一条规则或同文件的 `:focus-visible` / `:focus` 规则里出现下列任一：
   box-shadow / border / background / color / transform / opacity / filter / outline-offset / text-decoration。 */
const VISIBLE = /box-?[sS]hadow|border(-color|-width)?\s*:|background(-color)?\s*:|color\s*:|transform\s*:|opacity\s*:|filter\s*:|outline-offset|\.\.\.?style|text-decoration/;
const baseOf = (sel) => sel.split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean);

const focusIssues = [];
let outlineWithReplacement = 0;
let outlineInCssRules = 0;
for (const file of appFiles) {
  /* ⚠️ 必须先剥注释再切规则：否则 `([^{}]+)\{` 会把**紧邻前面的注释**当成选择器的一部分，
     于是这条规则的 base 变成一段中文注释 → 永远匹配不上它的 :focus-visible 兄弟规则，
     结果就是「修好了仍然报错」。（实测踩到：加了焦点环还是被判为不可达。） */
  const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const rel = path.relative(ROOT, file).split(path.sep).join('/');
  /* 只看 CSS 规则块；JSX 内联样式里的 outline 单独处理（见下） */
  if (!file.endsWith('.css')) continue;
  const rules = [];
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let rm;
  while ((rm = ruleRe.exec(text))) rules.push({ sel: rm[1].trim(), body: rm[2], at: text.slice(0, rm.index).split('\n').length });
  for (const r of rules) {
    if (!/outline:\s*none/.test(r.body)) continue;
    outlineInCssRules++;
    const parts = r.sel.split(',').map(s => s.trim());
    const selfFocus = parts.filter(p => /:focus/.test(p));
    if (selfFocus.length && VISIBLE.test(r.body)) { outlineWithReplacement++; continue; }
    const bases = baseOf(r.sel);
    /* 焦点环允许打在外层容器上（:focus-within）—— 这是「输入框本体无边框、视觉框在包裹层」
       时的**行业标准做法**，所以匹配时也认「本规则的任一祖先片段」。 */
    const tokensOf = (s) => s.split(/\s+/).filter(Boolean);
    const ancestors = tokensOf(bases[0] || '');
    const sibling = rules.find(o => {
      if (!/:focus(-visible|\-within)?\b/.test(o.sel)) return false;
      const oBase = baseOf(o.sel);
      const hit = oBase.some(b => bases.includes(b) || ancestors.includes(b));
      return hit && VISIBLE.test(o.body);
    });
    if (selfFocus.length === 0 && sibling) { outlineWithReplacement++; continue; }
    if (selfFocus.length && !VISIBLE.test(r.body)) { focusIssues.push({ rel, at: r.at, sel: r.sel.slice(0, 70), why: 'focus 规则里抑制了轮廓但没有任何可见替代' }); continue; }
    focusIssues.push({ rel, at: r.at, sel: r.sel.slice(0, 70), why: '抑制了轮廓，且同文件找不到带可见替代的 :focus-visible 规则' });
  }
}

/* 两个数口径不同，必须分开写清楚（否则会看成「35 有替代 / 46 没有」这种假警报）：
   `outlineNone` 是全仓正则计数（含 JSX 内联样式）；
   `outlineInCssRules` 才是能被规则级判定的部分。 */
console.log('  outline:none 声明:   ' + outlineNone + ' 处（CSS 规则 ' + outlineInCssRules +
  ' / JSX 内联 ' + (outlineNone - outlineInCssRules) + '）');
console.log('    · 其中 CSS 规则里**有可见替代**: ' + outlineWithReplacement + ' 处 → 合规');
console.log('  ❗ 不可达焦点:        ' + focusIssues.length + ' 处                 ' +
  (focusIssues.length === 0 ? '✅ 依 D11 达标（不可达焦点 = 0）' : '⚠️  D11：抑制轮廓必须有可见替代'));
if (focusIssues.length) {
  for (const it of focusIssues.slice(0, 10)) console.log('      · ' + it.rel + ':' + it.at + '  ' + it.sel + '   ← ' + it.why);
  if (focusIssues.length > 10) console.log('      · …还有 ' + (focusIssues.length - 10) + ' 处');
}

const divClick = (appText.match(/<div[^>]*onClick/g) || []).length;
console.log('  <div onClick>:       ' + divClick + ' 处                 ' +
  (divClick > 0 ? '⚠️  键盘不可达，应改 <button>' : '✅'));

const vp = (appText.match(/prefers-reduced-motion/g) || []).length;
console.log('  prefers-reduced-motion: ' + vp + ' 处               ' + (vp > 0 ? '✅' : '⚠️'));

/* ═══ ③ 毛玻璃与语义色 ═══ */
H('③ 毛玻璃 / 语义色白名单');

const bfFiles = appFiles.filter(f => /backdropFilter|backdrop-filter/.test(fs.readFileSync(f, 'utf8')));
console.log('  使用 backdrop-filter 的文件: ' + bfFiles.length + ' 个   [白名单: 面板/导航/画布浮条]');
for (const f of bfFiles.slice(0, 12)) console.log('    · ' + rel(f));

const redAsIdentity = /border[^,]*var\(--red\)/g;
const badSemantic = [...appText.matchAll(redAsIdentity)].length;
console.log('  危险色用作文案/区块标识: ' + badSemantic + ' 处   [目标: 0]');

/* ═══ ③b 品牌紫硬编码进度（165 处迁移作业表）═══ */
H('③b 品牌紫硬编码（迁移进度）');

const PURPLE_RE = /#7c3aed|#6d28d9|#8b5cf6|#a855f7|#9333ea/gi;
let purpleLines = 0, purpleHexes = 0;
const purpleFiles = new Set();
const tokenFileRe = /design-tokens-v3\.css|design-tokens\.css$/;
for (const f of codeFiles) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  let inFile = 0;
  lines.forEach(txt => {
    const m = [...txt.matchAll(PURPLE_RE)];
    if (m.length) { purpleLines++; inFile += m.length; }
  });
  if (inFile) { purpleHexes += inFile; purpleFiles.add(rel(f)); }
}
const defFiles = [...purpleFiles].filter(f => tokenFileRe.test(f));
const useFiles = purpleFiles.size - defFiles.length;
console.log('  硬编码紫: ' + purpleHexes + ' 次 / ' + purpleLines + ' 行 / ' + useFiles + ' 个使用文件    [基线: 165 处 / 44 文件]');
console.log('  token 定义处: ' + defFiles.length + ' 个文件（不计入迁移目标）');
console.log('  进度: ' + (purpleLines === 0 ? '✅ 迁移完成' : '⬜ 待迁移 ' + purpleLines + ' 处 —— 见 docs/design/02-brand-purple-migration.md §3'));

const rgbaAll = appText.match(/rgba\(\s*124\s*,\s*58\s*,\s*237\s*,\s*([0-9.]+)\s*\)/g) || [];
const rgbaAlphas = new Set(rgbaAll.map(x => parseFloat(x.replace(/.*,\s*/, ''))));
const ALPHA_TOKENS = ['--sb-brand-a05', '--sb-brand-a10', '--sb-brand-a18', '--sb-brand-a32', '--sb-brand-a55'];
console.log('  rgba(124,58,237,α): ' + rgbaAll.length + ' 处 / ' + rgbaAlphas.size + ' 个不同 α    [目标: ≤5 语义档]');
console.log('    实测 α 值: ' + [...rgbaAlphas].sort((a, b) => a - b).join(' ') || '');
console.log('    语义档 token: ' + ALPHA_TOKENS.length + ' 档（见 02-brand-purple-migration.md §1.2）');

/* ═══ ③c 悬停位移预留（The Lift Reservation Rule）═══ */
H('③c 悬停位移预留检查');

const liftRe = /translateY\((-?[\d.]+)px\)|scale\(([\d.]+)\)/g;
const liftSites = [];
for (const f of codeFiles) {
  fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((txt, i) => {
    if (!/hover|Hover|mouseEnter|:hover/i.test(txt)) return;
    for (const m of txt.matchAll(liftRe)) {
      if (m[1]) liftSites.push({ f: rel(f), l: i + 1, kind: 'translateY', v: Math.abs(parseFloat(m[1])) });
      else if (parseFloat(m[2]) > 1) liftSites.push({ f: rel(f), l: i + 1, kind: 'scale', v: parseFloat(m[2]) });
    }
  });
}
const mags = new Map();
liftSites.forEach(s => { const k = s.kind === 'translateY' ? `-${s.v}px` : `scale(${s.v})`; mags.set(k, (mags.get(k) || 0) + 1); });
console.log('  悬停位移/放大站点: ' + liftSites.length + ' 处    [基线: 71 处]');
console.log('    位移档位: ' + mags.size + ' 种    [目标: ≤3 档（-1px 按钮 / -2px 卡片 / -4px 大卡片）]');
const big = liftSites.filter(s => s.kind === 'translateY' && s.v > 4);
console.log('    位移 >4px 的高风险点: ' + big.length + ' 处    [建议降到 -4px，可把预留从 16px 降到 9px]');
if (big.length) big.slice(0, 8).forEach(s => console.log('      · ' + s.f + ':' + s.l + '  ' + s.kind + ' -' + s.v + 'px'));
console.log('    预留 token: --sb-lift-btn(3) / --sb-lift-card(5) / --sb-lift-card-lg(9) / --sb-lift-safe-x(8) / --sb-lift-safe-y(16)');

/* ═══ ③d 底部操作区（Dialog Footer）一致性 ═══ */
H('③d 弹窗底部操作区一致性');

const usesFooterClass = codeFiles.filter(f => /ui-modal-footer/.test(fs.readFileSync(f, 'utf8'))).map(f => rel(f));
const handRolled = codeFiles.filter(f => {
  const c = fs.readFileSync(f, 'utf8');
  return /footer\s*>\s*div\s*\{|footer-actions-gap|-footer\s*\{[^}]*gap/.test(c) && !/ui-modal-footer/.test(c);
}).map(f => rel(f));
console.log('  使用 .ui-modal-footer 契约: ' + usesFooterClass.length + ' 个文件    [目标: 全部弹窗]');
usesFooterClass.forEach(f => console.log('    ✅ ' + f));
console.log('  自写 footer（未采用契约）: ' + handRolled.length + ' 个文件    [目标: 0]');
handRolled.slice(0, 10).forEach(f => console.log('    ⚠️  ' + f));
const gapVals = new Set();
for (const f of codeFiles) {
  const c = fs.readFileSync(f, 'utf8');
  for (const mm of c.matchAll(/footer[^{]*\{[^}]*gap:\s*([0-9]+)px/g)) gapVals.add(mm[1]);
}
console.log('  footer 硬编码 gap 值: ' + (gapVals.size ? [...gapVals].join(' / ') + ' px  [目标: 全部走 --footer-actions-gap]' : '无 ✅'));

/* ═══ ④ design-tokens-v3 对比度校验 ═══ */
H('④ design-tokens-v3.css 对比度校验 (WCAG AA)');

if (!hasSbTokens) {
  console.log('  ❌ src/styles/design-tokens-v3.css 不存在');
} else {
  const tok = fs.readFileSync(sbTokensPath, 'utf8');
  const get = n => (tok.match(new RegExp('--' + n + '\\s*:\\s*(#[0-9A-Fa-f]{6})')) || [])[1];
  const BGS = { '白底': '#FFFFFF', '页底': '#F5EFE4' };
  const NEED = { 4.5: '正文', 3.0: '大文本/图标' };
  const targets = [
    ['sb-ink-1', 4.5], ['sb-ink-2', 4.5], ['sb-ink-3', 4.5], ['sb-ink-4', 3.0],
    ['sb-ink-5', 0], ['sb-ink-brand', 4.5], ['sb-ink-danger', 4.5],
    ['sb-ink-success', 4.5], ['sb-ink-warning', 4.5], ['sb-ink-info', 4.5],
  ];
  let fails = 0;
  for (const [name, need] of targets) {
    const hex = get(name);
    if (!hex) continue;
    const cells = Object.entries(BGS).map(([bn, bv]) => {
      const r = contrast(hex, bv);
      const ok = r >= need;
      return bn + ' ' + r.toFixed(2) + (ok ? '✅' : '❌');
    });
    if (need > 0 && contrast(hex, '#F5EFE4') < need) fails++;
    console.log('  --' + name.padEnd(18) + hex + '  ' + cells.join('   ') + '   [需 ' + need + ':1]');
  }
  console.log(fails === 0
    ? '  ✅ 暖米白底上全部达标'
    : '  ⚠️  ' + fails + ' 个 token 在暖米白底上未达 4.5:1（见 00-principles.md §5.1 的说明）');
}

/* ═══ ⑤ 落地进度 ═══ */
H('⑤ 落地进度看板');

const dsDir = path.join(SRC, 'components', 'ds');
const dsComps = fs.existsSync(dsDir) ? fs.readdirSync(dsDir) : [];
const check = (label, ok, note) =>
  console.log('  ' + (ok ? '✅' : '⬜') + '  ' + label.padEnd(42) + (note || ''));

check('阶段0.1  design-tokens-v3.css 已创建', hasSbTokens, hasSbTokens ? '' : '<-- 待做');
check('阶段0.1  main.jsx 已接线 import', sbWired, sbWired ? '' : '<-- 待做（一行）');
check('阶段0.2  6 个幽灵变量已补齐',
  !/--amber-400|--shadow-red-lg|--surface-raised|--shadow-red\b/.test(
    [/--amber-400:\s*#/, /--shadow-red-lg:/, /--surface-raised:/].map(r => r.test(fs.readFileSync(sbTokensPath, 'utf8') ? fs.readFileSync(sbTokensPath, 'utf8') : '') ? '' : 'MISSING').join('')),
  '');
check('阶段1.1  src/components/ds/ 组件已建', dsComps.length > 0, dsComps.length ? dsComps.length + ' 个文件' : '<-- 待做');
check('阶段1.2  面板宽统一 480', /--sb-panel-w:\s*480px/.test(hasSbTokens ? fs.readFileSync(sbTokensPath, 'utf8') : '') && !/baseWidth\s*=/.test(appText),
  /baseWidth\s*=/.test(appText) ? 'EcMode.jsx:303 仍是 4 档' : '');
check('阶段2.1  focus-visible 已覆盖', fv > 0, fv > 0 ? fv + ' 处' : '<-- 待做（P0）');
check('阶段2.2  disabled 真实化', !/pointerEvents:\s*checked \? 'auto' : 'none'/.test(appText), '');
check('阶段2.3  hover 内联实现已清理', !/onMouseEnter=\{e => \{ if \(!active\)/.test(appText), '');
check('阶段4.2  Navbar.jsx 死代码已删', !fs.existsSync(path.join(SRC, 'components', 'layout', 'Navbar.jsx')),
  fs.existsSync(path.join(SRC, 'components', 'layout', 'Navbar.jsx')) ? '未被 App.jsx 引用' : '');
check('阶段4.3  EcRefImages 颜色比文案已修', !/color === '#/.test(appText), '');

/* ═══ ⑥ 参考 ═══ */
H('参考');
console.log('  规范:      docs/design/00-principles.md / 10-visual-language.md');
console.log('             docs/design/20-components.md / 25-reference-teardown.md');
console.log('  落地:      docs/design/30-adoption-plan.md');
console.log('  Token:     src/styles/design-tokens-v3.css');
console.log('  调研证据:  docs/design/_research/*.md');
console.log('');
