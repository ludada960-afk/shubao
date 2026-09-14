// test/ink-contrast.test.mjs
// 门禁：**ink token 的文字档必须同时满足白底与页底 ≥4.5:1；图形档 ≥3:1**（裁定 D23）。
// ─────────────────────────────────────────────────────────────────────────────
// 为什么需要（真实缺陷，用户看得见）：
//   `--sb-ink-brand` 一度是 `#C4B5FD`，在白底只有 **1.85:1** —— 基本等于看不见。
//   更普遍的问题是：ink 档被当 `color:` 用，但从未按「白底 + 页底」两个底核算过；
//   `design-audit` ③ 实测 7 个 token 未达 4.5:1。
//
// 口径（D23，全站一致，**不按页面分档**）：
//   ① **文字档**：作为 `color:` 用在文本上 → 必须在 `#FFFFFF` 与页底 `#F5EFE4` **两个底上都 ≥4.5:1**；
//   ② **图形档**：图标 / 描边 / 点缀 / 填充 → ≥3:1（WCAG 1.4.11 非文本对比度）；
//   ③ 文字档命名用 `-strong`（沿用 D22 先例 `--sb-ink-danger-strong`），**同色相压深**；
//   ④ 原档保留作图形档，**不再允许直接当正文色**。
//
// 判据来源（写在注释里，便于复核）—— WCAG 2.x 相对亮度：
//   L = 0.2126·R + 0.7152·G + 0.0722·B  （R/G/B 为 sRGB 线性化后的分量）
//   sRGB 线性化：c <= 0.03928 ? c/12.92 : ((c+0.055)/1.055)^2.4
//   对比度 = (Lmax + 0.05) / (Lmin + 0.05)
//
// 反漂移：**从 token 文件解析实际取值**（复用 token-no-duplicate-definitions 的解析器），
//         绝不把色值抄一份到测试里 —— 那样改了 token 而测试不觉，等于没锁。
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

/** 两个基准底（D23①）：白底 + 页底（暖米白） */
export const BASE_WHITE = '#FFFFFF';
export const BASE_PAGE = '#F5EFE4';

/** 文字档 / 图形档阈值 */
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

/* ── D23 名单 ────────────────────────────────────────────────────────────── */

/** 文字档：必须两个底都 ≥4.5:1 */
export const TEXT_TOKENS = [
  '--sb-ink-1', '--sb-ink-2', '--sb-ink-3',
  // brand / info 的**原档即达标**（白 5.70 / 页 4.98；白 6.51 / 页 5.69），
  // 故原档与 -strong 档都可作文字用（-strong 为命名对称而存在，取值相同）。
  '--sb-ink-brand', '--sb-ink-info',
  '--sb-ink-brand-strong', '--sb-ink-danger-strong', '--sb-ink-success-strong',
  '--sb-ink-warning-strong', '--sb-ink-info-strong',
];

/** 图形档：≥3:1（图标 / 描边 / 点缀 / 填充） */
/**
 * 图形档：**仅指在页底上达不到文字档 4.5:1 的那三支**。
 * brand / info 虽然也作图形用，但它们在两个底上都 ≥4.5:1，**可以安全地当文字**，
 * 因此同时出现在 TEXT_TOKENS 里（本名单不是互斥分类，而是「各自适用的最低标准」）。
 */
export const GRAPHIC_TOKENS = [
  '--sb-ink-danger', '--sb-ink-success', '--sb-ink-warning',
];

/**
 * 允许用于 `color:` 的例外白名单（D23④ 反向断言用）。
 */
export const COLOR_USAGE_EXEMPTIONS = {
  '--sb-ink-4': '提示/placeholder 档：仅 ≥14px 粗体或大图标；正文禁用（见 10-visual-language §5.1）',
  '--sb-ink-5': '禁用态专用：disabled 文字不受 AA 约束（WCAG 1.4.3 明文豁免 inactive 组件）',
  '--sb-ink-on-dark': '深色面上的白字：对比度取决于深底，不适用白底/页底判据',
};

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

/* ── ② 文字档：白底 + 页底都 >= 4.5:1 ─────────────────────────────────── */
test('② 文字档 token 在白底与页底上都必须 >= 4.5:1（D23①）', () => {
  const { decls, resolve } = loadTokens();
  const rows = [];
  for (const name of TEXT_TOKENS) {
    const lit = tokenLiteral(resolve, decls, name);
    assert.ok(lit, '文字档 token 未定义：' + name);
    // D20：若解析出的是 rgba，先与底合成
    const onWhite = blendOver(lit, BASE_WHITE) || lit;
    const onPage = blendOver(lit, BASE_PAGE) || lit;
    const cw = contrastRatio(onWhite, BASE_WHITE);
    const cp = contrastRatio(onPage, BASE_PAGE);
    assert.ok(cw !== null, name + ' 的取值无法解析为颜色：' + lit);
    rows.push({ name, lit, cw, cp });
  }
  const bad = rows.filter(r => !(r.cw >= TEXT_MIN && r.cp >= TEXT_MIN));
  const detail = rows.map(r =>
    '    ' + r.name.padEnd(26) + r.lit.padEnd(10) +
    ' 白 ' + r.cw.toFixed(2) + '  页 ' + r.cp.toFixed(2) +
    (r.cw >= TEXT_MIN && r.cp >= TEXT_MIN ? '  OK' : '  FAIL')).join('\n');
  assert.equal(bad.length, 0,
    '以下文字档 token 在白底或页底上未达 ' + TEXT_MIN + ':1（D23①）：\n' + detail);
});

/* ── ③ 图形档：>= 3:1 ─────────────────────────────────────────────────── */
test('③ 图形档 token 在页底上 >= 3:1（WCAG 1.4.11）', () => {
  const { decls, resolve } = loadTokens();
  const bad = [];
  for (const name of GRAPHIC_TOKENS) {
    const lit = tokenLiteral(resolve, decls, name);
    assert.ok(lit, '图形档 token 未定义：' + name);
    const onPage = blendOver(lit, BASE_PAGE) || lit;
    const cp = contrastRatio(onPage, BASE_PAGE);
    if (!(cp >= GRAPHIC_MIN)) bad.push(name + ' ' + lit + ' 页 ' + (cp === null ? 'null' : cp.toFixed(2)));
  }
  assert.equal(bad.length, 0,
    '以下图形档 token 在页底上未达 ' + GRAPHIC_MIN + ':1：\n    ' + bad.join('\n    '));
});

/* ── ④ 反向断言：color: 不得引用图形档 ────────────────────────────────── */
test('④ 反向断言：color: 用法不得引用图形档 token（白名单除外，D23④）', () => {
  const allowed = new Set([...TEXT_TOKENS, ...Object.keys(COLOR_USAGE_EXEMPTIONS)]);
  const forbidden = GRAPHIC_TOKENS.filter(t => !allowed.has(t));

  // 收集源码文件（跳过冻结目录 src/pages/EcCanvas 与构建产物）
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

  const offenders = [];
  for (const fp of files) {
    const rel = path.relative(ROOT, fp).replace(/\\/g, '/');
    const lines = readFileSync(fp, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const tok of forbidden) {
        // 只匹配 `color:` 后紧跟该 token 的用法（不含 background/border/stroke/fill）
        const re = new RegExp('\\bcolor\\s*:\\s*[\'"`]?var\\(' + tok.replace(/-/g, '\\-') + '(?=[),;\'"\\s])');
        if (re.test(line)) {
          offenders.push('    ' + rel + ':' + (i + 1) + '  -> ' + tok + '\n      ' + line.trim().slice(0, 120));
        }
      }
    });
  }
  assert.equal(offenders.length, 0,
    '以下位置把**图形档** token 当文字色用（应改用对应的 -strong 文字档）：\n' + offenders.join('\n'));
});

/* ── ⑤ 名单自证 ───────────────────────────────────────────────────────── */
test('⑤ 名单自证：图形档都不得出现在文字白名单，且每个图形档都有配对的 -strong', () => {
  // ④ 的 forbidden 正是「图形档 - 文字白名单」，这里断言其非空且与名单一致
  const allowed = new Set([...TEXT_TOKENS, ...Object.keys(COLOR_USAGE_EXEMPTIONS)]);
  const forbidden = GRAPHIC_TOKENS.filter(t => !allowed.has(t));
  assert.deepEqual(forbidden, GRAPHIC_TOKENS,
    '每个图形档都应【不在】文字白名单里（否则反向断言形同虚设）');

  const { decls, resolve } = loadTokens();
  for (const g of GRAPHIC_TOKENS) {
    const strong = g + '-strong';
    const lit = tokenLiteral(resolve, decls, strong);
    assert.ok(lit, '图形档 ' + g + ' 缺少配对的文字档 ' + strong);
  }
});

/* ── ⑥ 色相保持：-strong 必须是同色相压深（D23②） ──────────────────────── */
test('⑥ -strong 与图形档同色相（Delta H <= 8 度，D23② 不许换色相）', () => {
  const { decls, resolve } = loadTokens();
  const hue = (hex) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    const [r0, g0, b0] = rgb.map(v => v / 255);
    const mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0);
    if (mx === mn) return 0;
    const d = mx - mn;
    let h;
    if (mx === r0) h = ((g0 - b0) / d + (g0 < b0 ? 6 : 0));
    else if (mx === g0) h = ((b0 - r0) / d + 2);
    else h = ((r0 - g0) / d + 4);
    return Math.round(h * 60);
  };
  const bad = [];
  for (const g of GRAPHIC_TOKENS) {
    const base = tokenLiteral(resolve, decls, g);
    const strong = tokenLiteral(resolve, decls, g + '-strong');
    if (!base || !strong) continue;
    const hb = hue(base), hs = hue(strong);
    if (hb === null || hs === null) continue;
    const dh = Math.min(Math.abs(hb - hs), 360 - Math.abs(hb - hs));
    if (dh > 8) bad.push(g + ' H' + hb + '  ->  ' + g + '-strong H' + hs + '  (Delta H=' + dh + ')');
  }
  assert.equal(bad.length, 0,
    '-strong 必须与图形档同色相（压深而非换色相）：\n    ' + bad.join('\n    '));
});
