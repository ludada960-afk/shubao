// test/focus-visible-baseline.test.mjs
// 门禁：**键盘焦点必须看得见，且不依赖浏览器**。
// ─────────────────────────────────────────────────────────────────────────────
// 判据（WCAG 2.4.11 焦点可见 / 2.4.13 焦点外观 ≥2px；原则 4.2 Hover≠Focus、D11 键盘可达是硬门槛）：
//   「任何可聚焦元素，默认都要有一个可见焦点环」。
//
// 为什么不能只靠浏览器默认环：实测全站 332 个可点选择器里只有 53 个自己声明了 :focus-visible，
// 其余 279 个靠 UA 默认环 —— 而 **Safari 对 <button> 根本不画焦点环**：
// 同一个按钮，Safari 用户 Tab 过去什么都看不见。可访问性不能交给浏览器运气。
//
// 本门禁锁的是**判据**（有元素级基线 / 环 ≥2px / 环色在主要底色上 ≥3:1 / 基线特异性为 0 不会顶掉组件），
// **不锁写法**（用什么选择器组合、放在哪一段都可以换）。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS = readFileSync(path.join(ROOT, 'src/styles/design-tokens-v3.css'), 'utf8');

const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, ' ');

/**
 * 找出**元素级全局焦点基线**：`:where(…):focus-visible { … }`（或 `:is(…)`）。
 * 返回 { selector, body } 或 null。
 * 为什么必须有 `:where()`/`:is()` 这种零特异性包裹：见断言 ④。
 */
export function findGlobalFocusBaseline(cssText) {
  const src = stripComments(cssText);
  const re = /:where\(([\s\S]*?)\)\s*:focus-visible\s*\{([\s\S]*?)\}/g;
  let m;
  while ((m = re.exec(src))) {
    /* 只有当里面装的是**元素/角色条件**时才算「全局基线」 —— 装着一堆 .class 的不是基线 */
    const inner = m[1];
    const hasElement = /(^|[\s,(])(button|input|select|textarea|summary|a\[href\]|area\[href\]|audio\[controls\]|video\[controls\]|\[role=|\[tabindex)/.test(inner);
    if (hasElement) return { selector: ':where(' + inner + ')', body: m[2].trim(), raw: m[0] };
  }
  return null;
}

/** 解析 token（含 var 链，最多 8 跳） */
function makeResolver(cssText) {
  const base = new Map();
  const re = /(--[a-zA-Z0-9-]+)\s*:\s*([^;{}]+);/g;
  let m;
  while ((m = re.exec(cssText))) if (!base.has(m[1])) base.set(m[1], m[2].trim());
  const resolve = (v, d = 0) => {
    if (d > 8) return v;
    const mm = /^var\(\s*(--[a-zA-Z0-9-]+)\s*(?:,([\s\S]+))?\)$/.exec(String(v).trim());
    if (!mm) return String(v).trim();
    if (base.has(mm[1])) return resolve(base.get(mm[1]), d + 1);
    return mm[2] ? resolve(mm[2], d + 1) : String(v).trim();
  };
  return resolve;
}

const hexToRgb = (h) => {
  const s = h.trim().replace('#', '');
  const f = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
  return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
};
const relLum = ([r, g, b]) => {
  const f = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => {
  const [l1, l2] = [relLum(hexToRgb(a)), relLum(hexToRgb(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

test('① 存在**元素级**全局焦点基线（不是只覆盖 .sb-focusable 的类基线）', () => {
  const base = findGlobalFocusBaseline(TOKENS);
  assert.ok(base, '没有找到 :where(...):focus-visible 形式的**元素级**焦点基线 —— ' +
    '只覆盖 .sb-focusable 的类基线救不了「没标注的按钮」，而 Safari 对 button 不画 UA 环。');
  const sel = base.selector;
  for (const need of ['button', 'a[href]', 'input', 'select', 'textarea', 'summary']) {
    assert.ok(sel.includes(need), '全局焦点基线未覆盖 ' + need + '（原生可聚焦元素必须默认有环）');
  }
  for (const role of ['[role="button"]', '[role="tab"]', '[role="menuitem"]', '[role="option"]', '[role="switch"]']) {
    assert.ok(sel.includes(role), '全局焦点基线未覆盖 ARIA 控件角色 ' + role);
  }
  assert.ok(sel.includes('[tabindex]:not([tabindex="-1"])'),
    '全局焦点基线必须覆盖「带 tabindex 的元素」，且**排除 tabindex="-1"**（那是脚本聚焦的容器）');
});

test('② 基线**不得**用 !important（否则会顶掉组件的自定义环）', () => {
  const base = findGlobalFocusBaseline(TOKENS);
  assert.ok(base && !/!important/.test(base.body), '焦点基线里出现 !important —— 会强行覆盖组件自己的焦点样式');
});

test('③ 环几何走 token 且满足 WCAG 2.4.13（≥2px）', () => {
  const base = findGlobalFocusBaseline(TOKENS);
  const rw = makeResolver(TOKENS)('var(--sb-focus-ring-w)');
  assert.equal(rw, '2px', '--sb-focus-ring-w 应为 2px（WCAG 2.4.13 焦点外观 ≥2px），实测 ' + rw);
  assert.match(base.body, /outline:\s*var\(--sb-focus-ring-w\)/,
    '基线里的环宽必须走 --sb-focus-ring-w token（不许写死像素）');
  assert.match(makeResolver(TOKENS)('var(--sb-focus-ring-offset)') + '', /^\d+px$/,
    '--sb-focus-ring-offset 必须是一个具体像素值');
});

test('④ 环色在主要底色上 ≥3:1（WCAG 1.4.11 非文本对比度）', () => {
  const resolve = makeResolver(TOKENS);
  const ring = resolve('var(--sb-focus-ring-color)');
  assert.match(ring, /^#[0-9a-fA-F]{3,6}$/, '焦点环色必须解析到一个具体色值，实测 ' + ring);
  /* 三个主要底色：白卡 / 暖米白页面底 / 深色面（暗色主题与画布底） */
  const surfaces = {
    '白卡 #FFFFFF': '#FFFFFF',
    '页底（暖米白）': '#F5EFE4',
    '深色面（画布/暗主题）': '#202226',
  };
  for (const [name, bg] of Object.entries(surfaces)) {
    const c = contrast(ring, bg);
    assert.ok(c >= 3, '焦点环 ' + ring + ' 在「' + name + '」上只有 ' + c.toFixed(2) + ':1（要求 ≥3:1）');
  }
});

test('⑤ 检测器自证：类基线（只覆盖 .sb-focusable）必须判为「没有全局基线」', () => {
  const classOnly = '.sb-focusable:focus-visible { outline: 2px solid red; }';
  assert.equal(findGlobalFocusBaseline(classOnly), null,
    '只覆盖某个 class 的规则被误判成「全局基线」—— 检测器失效，②③④ 会变成空转通过');
  const notZeroSpecificity = ':focus-visible { outline: 2px solid red; }';
  assert.equal(findGlobalFocusBaseline(notZeroSpecificity), null, '无 :where() 包裹的基线不算数');
  const good = ':where(button, a[href]):focus-visible { outline: var(--sb-focus-ring-w) solid red; }';
  assert.ok(findGlobalFocusBaseline(good), '合法的元素级基线必须被识别出来（否则门禁永远红）');
});
