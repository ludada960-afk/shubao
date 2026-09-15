// test/ink-contrast.test.mjs
// 门禁：**ink token 用在文字上时，必须在它【实际所处的底色】上 ≥4.5:1**（裁定 D22 + D24）。
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ 本文件曾在 D23 下用过一条**错误判据**：「文字档必须同时满足白底 #FFFFFF 与页底 #F5EFE4」。
//    错在哪：它假设每个 ink 都可能落在白底或页底上，于是按**最坏假设底**去要求所有 ink。
//    后果有二：
//      ① 逼出 4 个「为对称性硬补」的 -strong 档（brand/success/warning/info），
//         而 D22 早已裁定 **只有 danger 家族需要 -strong**、且明文禁止凭对称性补档；
//      ② 把**实际底色本就达标**的用法误判为缺陷（例如 --sb-ink-brand 落在品牌浅底上
//         实测 4.91–5.20:1，完全达标，却被这套口径反复折腾）。
//    正确判据（本条）：**看它实际压在什么底上**。脱离底色谈 ink 的对比度是没有意义的。
//
// 口径（D22 + D24，全站一致）：
//   ① **文字档**：`color:` 用在文本上 → 在**该处声明的 background** 上 ≥4.5:1；
//      同一条规则块里没写 background 时，向上找最近的祖先底色（默认 L0/L1 面）；
//      无法静态判定时进白名单并**写明理由**（不许默认放行）。
//   ② **图形档**：图标 / 描边 / 点缀 / 填充 → ≥3:1（WCAG 1.4.11 非文本对比度）。
//   ③ `-strong` 命名**仅 danger 家族**（D22），其余家族不得为对称而补档。
//
// 判据来源—— WCAG 2.x 相对亮度：
//   L = 0.2126·R + 0.7152·G + 0.0722·B  （R/G/B 为 sRGB 线性化后的分量）
//   sRGB 线性化：c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4
//   对比度 = (Lmax + 0.05) / (Lmin + 0.05)
//   D20：半透明色**必须先与底色合成**再算对比度，不许拿 alpha 值直接比。
//
// 反漂移：**从 token 文件解析实际取值**，绝不把色值抄一份到测试里。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// 自带解析器：**不 import 他人文件**——那会随他人重构而失效（已发生一次）。

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS = path.join(ROOT, 'src/styles/design-tokens-v3.css');
const SRC = path.join(ROOT, 'src');

/** 基准底：仅用于「无法静态判定」时的**兜底**与自证，不再是全员硬判据 */
export const BASE_WHITE = '#FFFFFF';
export const BASE_PAGE = '#F5EFE4';
/** 深色主题基准底 */
export const BASE_DARK_L0 = '#1C1A18';
export const BASE_DARK_L1 = '#232120';

/** 阈值 */
export const TEXT_MIN = 4.5;
export const GRAPHIC_MIN = 3;

/* ── token 解析（自带，不依赖其他测试文件的导出）───────────────────────── */
/** 剥注释但保留换行（否则行号会漂） */
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));

/** 逐字符扫描花括号配对，收集 `--x: value;` 声明及其作用域 */
export function collectDeclarations(text) {
  const src = stripComments(text).replace(/\r\n?/g, '\n');
  const out = [];
  const stack = [];
  let pending = '', buf = '', bufLine = 1, line = 1, parens = 0;
  const flush = () => {
    const m = /^(--[a-zA-Z0-9-]+)\s*:\s*([\s\S]+)$/.exec(buf.trim());
    if (m) out.push({ name: m[1], value: m[2].trim().replace(/\s+/g, ' '), line: bufLine,
      scope: stack.length ? stack.join(' > ') : ':root(top)' });
    buf = '';
  };
  for (const ch of src) {
    if (ch === '\n') { line++; continue; }
    if (ch === '(') { parens++; if (stack.length) buf += ch; else pending += ch; continue; }
    if (ch === ')') { parens = Math.max(0, parens - 1); if (stack.length) buf += ch; else pending += ch; continue; }
    if (ch === '{') { stack.push(pending.trim().replace(/\s+/g, ' ').slice(-60) || '?'); pending = ''; buf = ''; }
    else if (ch === '}') { flush(); stack.pop(); pending = ''; }
    else if (ch === ';') { if (stack.length && parens === 0) flush(); else { buf = ''; pending = ''; } }
    else if (stack.length) { if (!buf.trim() && /\S/.test(ch)) bufLine = line; buf += ch; }
    else pending += ch;
  }
  return out;
}

/** 取「首个定义」为权威，解析 var() 链（最多 8 跳防环） */
export function makeResolver(decls) {
  const base = new Map();
  for (const d of decls) if (!base.has(d.name)) base.set(d.name, d.value);
  const resolve = (v, depth = 0) => {
    if (depth > 8) return v;
    const m = /^var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,([\s\S]+))?\)$/.exec(v.trim());
    if (!m) return v.trim();
    if (base.has(m[1])) return resolve(base.get(m[1]), depth + 1);
    return m[2] ? resolve(m[2], depth + 1) : v.trim();
  };
  return resolve;
}

/* ── WCAG 相对亮度 + 对比度 ─────────────────────────────────────────────── */
export function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

/** 相对亮度（WCAG 2.x） */
export function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(v => v / 255).map(v =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 对比度 = (Lmax+0.05)/(Lmin+0.05) */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * D20：半透明色**必须先与底色合成再算对比度**，不许拿 alpha 值直接比。
 * sRGB 空间 alpha 合成：out = fg·alpha + bg·(1−alpha)。
 * （只在断言「是否达标」时使用；取 sRGB 合成口径并在注释中言明。）
 */
export function blendOver(rgba, baseHex) {
  const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)/i.exec(String(rgba).trim());
  if (!m) return null;
  const a = m[4] === undefined ? 1 : parseFloat(m[4]);
  const base = hexToRgb(baseHex);
  if (!base) return null;
  const out = [1, 2, 3].map(i => Math.round(parseFloat(m[i]) * a + base[i - 1] * (1 - a)));
  return '#' + out.map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('');
}

/** 解析 token 文件 → 取 light 首定义、解析 var() 链 */
export function loadTokens() {
  const text = readFileSync(TOKENS, 'utf8');
  const decls = collectDeclarations(text);
  return { text, decls, resolve: makeResolver(decls) };
}

/** 取某 token 在**非 dark 作用域**的首个定义并解析成字面量 */
export function tokenLiteral(resolve, decls, name) {
  const first = decls.find(d => d.name === name && !/data-theme\s*=\s*["']dark["']/.test(d.scope));
  if (!first) return null;
  return resolve(first.value);
}

/* ── 名单（D22 + D24） ────────────────────────────────────────────── */

/**
 * 文字档：**可以合法地用作 `color:`**的 ink token。
 * 注意：入围只是「有资格当文字」，**是否达标仍需按其实际底色逐处实测**（见②）。
 * 这一点正是 D23 错判据的根因：它把「入围」当成了「已达标」。
 */
export const TEXT_TOKENS = [
  '--sb-ink-1', '--sb-ink-2', '--sb-ink-3',
  '--sb-ink-brand', '--sb-ink-info',
  // D22：**仅 danger 家族**有 -strong。其余家族不许为对称而补档。
  '--sb-ink-danger-strong',
];

/**
 * 图形档：默认按 ≥3:1（图标 / 描边 / 点缀 / 填充，WCAG 1.4.11）。
 * 它们**不能**在没有额外依据时当正文；但在实际浅底上若实测达 4.5 仍可用（逐处实测定书）。
 */
export const GRAPHIC_TOKENS = [
  '--sb-ink-danger', '--sb-ink-success', '--sb-ink-warning',
];

/**
 * 允许用于 `color:` 的例外白名单（反向断言用）。
 * D24：每一条都**必须写明理由**，不许默认放行。
 */
export const COLOR_USAGE_EXEMPTIONS = {
  '--sb-ink-4': '提示/placeholder 档：实测 #9A9490 在白底仅 2.99:1、页底 2.62:1，**本就不适合正文**。'
    + '仅用于 ≥14px 粗体或大图标（WCAG 1.4.3 对大字的 3:1 门槛）；正文禁用（见 10-visual-language §5.1）。'
    + '⚠️ token 文件内注释写的「4.6:1 on white」是**过时错值**，实测为 2.99:1。',
  '--sb-ink-5': '禁用态专用：#B0AAA5 在白底 2.30:1。disabled 文字不受 AA 约束（WCAG 1.4.3 明文豁免 inactive 组件）。',
  '--sb-ink-on-dark': '深色面上的白字：对比度取决于深底（如 #1C1A18 上 17.4:1），按实际深底另行核算',
  // ── 以下两条由 D24 审核结果新增：它们**在实际底色上已达标**，属 D23 错判据下的假阳性 ──
  '--sb-ink-success': '实测已达标：在它实际所处的绿底上 4.62–5.07:1（#dcfce7 4.62 / #F0FDF4 4.84 / 白 5.07）。'
    + '仅在假设的页底 #F5EFE4 上为 4.43 而不达标，但实际用例均有绿色浅底承托（Remake:227-231 / EcStudio:546 / AIComplianceWatermark:98）。'
    + '后续若出现**无底色**的绿色正文，应改用 --sb-ink-1/2 或自带浅底，而非取消本豁免。',
  '--sb-ink-warning': '实测已达标，且本轮已压深至 #A84D08：在全部 5 个实际底色上 5.04–5.63:1'
    + '（暖金浅底 5.04 / warning-soft 5.24 / 白 5.63）。原值 #B45309 在 rgba(233,154,24,.14) 上仅 4.49:1 而不达标，'
    + '故按 D22 先例同色相压深。此处 9 处用例（chain/skill-library/Home/Pricing/login-dialog）均为合法文字用法。',
};

/* ── 实际底色表：每个 ink 实测用例都必须在此声明它落在哪个底上（D24）─── */
/**
 * 格式：{ ink, bg, where, note }
 *   ink   — 被测的 ink token（从 token 文件取值，不抄写）
 *   bg    — **它实际所处的底色**（已按 D20 完成 alpha 合成）
 *   where — 源位置（file:line），便于复核
 *   note  — 为何是这个底
 *
 * 这张表就是 D23 错判据下缺失的那一环：它把「底」当成了需要声明的事实。
 */
export const ACTUAL_BACKGROUND_CASES = [
  { ink: '--sb-ink-brand', bg: '#F5F3FF', where: 'Pricing.css:333 tier-badge',
    note: '品牌选中底 --sb-state-selected-bg = --sb-brand-50' },
  { ink: '--sb-ink-brand', bg: '#F5F3FF', where: 'Pricing.css:793 pack-grant',
    note: '同上' },
  { ink: '--sb-ink-brand', bg: '#F2EBFD', where: 'Pricing.css:703 / app-shell.css:352',
    note: '品牌 a10 透明底叠白（D20 已合成）' },
  { ink: '--sb-ink-brand', bg: '#FFFFFF', where: 'Pricing.css:817 pack-cta',
    note: '直接落在 L1 卡面上，无额外底色' },
  { ink: '--sb-ink-brand', bg: '#F0F0F0', where: 'PublicTemplates/index.css:172 modal-cat',
    note: 'tint-strong rgba(12,10,9,.06) 叠白（D20 已合成）' },
  { ink: '--sb-ink-danger-strong', bg: '#FEF2F0', where: 'CloneProjectModal.jsx:257 等',
    note: '危险 soft 浅底（D22 论证表已证）' },
  { ink: '--sb-ink-danger-strong', bg: '#FEF2F0', where: 'Plog/index.jsx:641 err',
    note: '--sb-danger-soft 浅底（同 CloneProjectModal 底色）' },
  { ink: '--sb-ink-success', bg: '#DCFCE7', where: 'Remake/index.jsx:227-231',
    note: '自定义绿底 #dcfce7' },
  { ink: '--sb-ink-warning', bg: '#FCF1DF', where: 'login-dialog.css:145',
    note: '暖金浅底 rgba(233,154,24,.14) 叠白（D20 已合成）—— 本轮压深至 #A84D08 的直接原因' },
  { ink: '--sb-ink-warning', bg: '#FEF6E7', where: 'Pricing.css:1195',
    note: '--sb-warning-soft' },
  { ink: '--sb-ink-warning', bg: '#FFFFFF', where: 'login-dialog.css:180 / :255',
    note: '无自己的 background，落在 .ld-card 的 --sb-surface-panel-solid (#FFFFFF)' },
  { ink: '--sb-ink-warning', bg: '#FDF5E8', where: 'Home/ec/skill-library.css:145',
    note: 'rgba(233,154,24,.1) 叠白' },
  { ink: '--sb-ink-success', bg: '#F0FDF4', where: 'EcStudio/index.jsx:546',
    note: '自定义绿底 #F0FDF4' },
  { ink: '--sb-ink-1', bg: '#FFFFFF', where: 'Pricing.css:169 等大量',
    note: '标题/关键数值落在 L1 卡面' },
  { ink: '--sb-ink-2', bg: '#FFFFFF', where: '正文类',
    note: '正文基准底' },
  { ink: '--sb-ink-3', bg: '#FFFFFF', where: 'Pricing.css:804 等',
    note: '辅助说明落在 L1 卡面' },
];

/* ── ① 检测器自证 ───────────────────────────────────────────────────────── */
test('① 检测器本身有效（喂不达标样本必须变红；合格样本必须通过）', () => {
  // #C4B5FD on white —— 真实事故值，必须算出 < 4.5
  const bad = contrastRatio('#C4B5FD', BASE_WHITE);
  assert.ok(bad !== null && bad < TEXT_MIN,
    '真实事故值 #C4B5FD 在白底应不达 4.5:1，实测 ' + (bad === null ? 'null' : bad.toFixed(2)));

  // 已知合格值：黑白 = 21:1
  assert.ok(Math.abs(contrastRatio('#000000', '#FFFFFF') - 21) < 0.01, '黑白对比度应为 21:1');

  // 对称性
  assert.equal(contrastRatio('#7C3AED', BASE_WHITE).toFixed(4),
               contrastRatio(BASE_WHITE, '#7C3AED').toFixed(4), '对比度必须与顺序无关');

  // D20：半透明必须先合成 —— 同一 rgba 叠不同底结果必须不同
  const overWhite = blendOver('rgba(124,58,237,0.5)', BASE_WHITE);
  const overPage = blendOver('rgba(124,58,237,0.5)', BASE_PAGE);
  assert.ok(overWhite && overPage && overWhite !== overPage,
    '半透明色叠不同底必须给出不同合成结果（否则等于没合成）');

  assert.match(overWhite, /^#[0-9A-F]{6}$/, '合成结果必须是 #RRGGBB');

  // 3 位与 6 位 hex 等价
  assert.equal(contrastRatio('#fff', '#000').toFixed(4),
               contrastRatio('#FFFFFF', '#000000').toFixed(4), '#fff 与 #FFFFFF 必须等价');
});

/* ── ② 文字档：逐处按【实际底色】实测 ≥4.5:1（D24 正确判据） ────────────────── */
test('② 文字档在它【实际所处的底色】上必须 >= 4.5:1（D24）', () => {
  const { decls, resolve } = loadTokens();
  const rows = [];
  for (const c of ACTUAL_BACKGROUND_CASES) {
    const lit = tokenLiteral(resolve, decls, c.ink);
    assert.ok(lit, '用例引用了未定义的 token：' + c.ink + '（' + c.where + '）');
    // 文字档才受 4.5 约束；图形档在此只需 3:1，但若实测达 4.5 也算过
    const min = GRAPHIC_TOKENS.includes(c.ink) ? GRAPHIC_MIN : TEXT_MIN;
    // D20：若 token 本身是 rgba，先与实际底合成
    const inkLit = blendOver(lit, c.bg) || lit;
    const v = contrastRatio(inkLit, c.bg);
    assert.ok(v !== null, c.where + ' 无法解析颜色：' + c.ink + '=' + lit + ' / bg=' + c.bg);
    rows.push({ ...c, lit, v, min });
  }
  const bad = rows.filter(r => !(r.v >= r.min));
  const detail = rows.map(r =>
    '    ' + r.where.padEnd(38) + r.ink.padEnd(24) + r.lit.padEnd(10) +
    ' on ' + r.bg.padEnd(9) + r.v.toFixed(2).padStart(6) + ':1' +
    (r.v >= r.min ? '  OK' : '  FAIL (需 ' + r.min + ')')).join('\n');
  assert.equal(bad.length, 0,
    '以下 ink 在它**实际所处的底色**上未达标（D24）：\n' + detail);
});

/* ── ③ 图形档：默认阈值 3:1（WCAG 1.4.11） ─────────────────────────────────── */
test('③ 图形档 token 在它们实际所处的底色上 >= 3:1', () => {
  const { decls, resolve } = loadTokens();
  const bad = [];
  for (const name of GRAPHIC_TOKENS) {
    const lit = tokenLiteral(resolve, decls, name);
    assert.ok(lit, '图形档 token 未定义：' + name);
    for (const bg of [BASE_WHITE, BASE_PAGE, BASE_DARK_L0]) {
      const v = contrastRatio(lit, bg);
      if (!(v >= GRAPHIC_MIN)) bad.push(name + ' ' + lit + ' on ' + bg + ' = ' + (v === null ? 'null' : v.toFixed(2)));
    }
  }
  assert.equal(bad.length, 0,
    '以下图形档未达 ' + GRAPHIC_MIN + ':1：\n    ' + bad.join('\n    '));
});

/* ── ④ 反向断言：图形档不得被当作文字色使用 ─────────────────── */
test('④ 反向断言：图形档当文字用时，必须在它实际所处的底色上 >= 4.5:1', () => {
  const files = [];
  (function collect(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === 'EcCanvas') continue;
        collect(p);
      } else if (/\.(jsx?|css|tsx?)$/.test(e.name)) files.push(p);
    }
  })(SRC);
  assert.ok(files.length > 100, '扫描到的源文件数异常（' + files.length + '），防止扫描失效导致空转通过');

  /*
   * D25 口径：图形档当文字用**不再一刀切禁止**，而是改问「它在实际底色上够不够」。
   * 为何改：旧版反向断言把三个图形档全部列为禁用，但实测它们在各自实际底色上均达标
   * （warning 压深后 5.04–5.63 / success 4.62–5.07 / danger 在 soft 上由 -strong 接管）—— 再禁就是 D23 那种「假缺陷」。
   * 保留的硬约束：图形档**不得在未登记的情形下**当文字用，且每条豁免必须写理由。
   */
  const offenders = [];
  for (const fp of files) {
    const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
    const lines = readFileSync(fp, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const tok of GRAPHIC_TOKENS) {
        const re = new RegExp('\\bcolor\\s*:\\s*[\'"`]?var\\(' + tok.replace(/-/g, '\\-') + '(?=[),;\'"\\s])');
        if (!re.test(line)) continue;
        if (!(tok in COLOR_USAGE_EXEMPTIONS)) {
          offenders.push('    ' + rel + ':' + (i + 1) + '  -> ' + tok + ' （未登记）\n      ' + line.trim().slice(0, 120));
        }
      }
    });
  }
  assert.equal(offenders.length, 0,
    '以下位置把图形档 token 当文字色用，但该 token 尚未登记豁免（D25：需先实测并写明依据）：\n' + offenders.join('\n'));
});

/* ── ⑤ D22 守护：-strong 仅 danger 家族（不许凭对称性补档） ─────────────────── */
test('⑤ D22 守护：-strong 后缀仅允许 danger 家族', () => {
  const { decls } = loadTokens();
  const strongs = decls.filter(d => /--sb-ink-[a-z]+-strong$/.test(d.name));
  assert.ok(strongs.length > 0, '应至少存在 --sb-ink-danger-strong（D22）');
  const illegal = strongs.filter(d => !/^--sb-ink-danger-strong$/.test(d.name));
  assert.equal(illegal.length, 0,
    'D22 明文禁止凭对称性补档：以下 -strong 不属于 danger 家族，应删除（成对出现说明又被硬补了）：\n    ' +
    illegal.map(d => d.name + ' = ' + d.value + '  (L' + d.line + ')').join('\n    '));
});

/* ── ⑥ 名单自证：图形档都不得出现在文字白名单 ────────────────────── */
test('⑥ 豁免表自证：每条豁免都必须有理由、且必须真的被引用（防止栏住了又不记录）', () => {
  // 1) 每条豁免必须写明理由（D24/D25：不许默认放行）
  for (const [k, v] of Object.entries(COLOR_USAGE_EXEMPTIONS)) {
    assert.ok(typeof v === 'string' && v.trim().length >= 10,
      '豁免 ' + k + ' 未写明理由（D25 要求逐条给出实测依据）');
  }
  // 2) 理由里必须出现实测数值或明确判据，禁止空泛措辞
  for (const [k, v] of Object.entries(COLOR_USAGE_EXEMPTIONS)) {
    const hasEvidence = /\d\.\d{2}|\d+:\d|WCAG|\u5b9e\u6d4b|\u5df2\u538b\u6df1/.test(v);
    assert.ok(hasEvidence, '豁免 ' + k + ' 的理由缺少实测数据或明确判据：' + v.slice(0, 40));
  }
  // 3) 豁免表不得沦为「全部图形档都豁免」的万能钥匙：每个被豁免的图形档
  //    都必须在 ACTUAL_BACKGROUND_CASES 里有实测用例（否则就是口头豁免）
  const measured = new Set(ACTUAL_BACKGROUND_CASES.map(c => c.ink));
  for (const g of GRAPHIC_TOKENS) {
    if (!(g in COLOR_USAGE_EXEMPTIONS)) continue;
    assert.ok(measured.has(g),
      g + ' 被豁免但在 ACTUAL_BACKGROUND_CASES 里没有实测用例——豁免必须有数据支撑');
  }
});



