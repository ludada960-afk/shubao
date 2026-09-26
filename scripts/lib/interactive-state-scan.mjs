// scripts/lib/interactive-state-scan.mjs
// ─────────────────────────────────────────────────────────────────────────────
// 「可点必有 hover / 可点必有键盘焦点」的**唯一扫描实现**。
// 为什么抽出来：口径必须只有一份 —— 审计脚本（scripts/design-audit.mjs）与门禁测试
// （test/interactive-state-coverage.test.mjs）各自复制一份扫描逻辑，迟早会漂移，
// 而漂移的指标比没有指标更糟（原则 §12：指标必须测量判据本身）。
//
// 判据（原则 4.1 八态 / 4.2 Hover≠Focus 的可执行化）：
//   「凡是**可点**的东西，必须看得到 hover 与键盘焦点」。
//   怎么识别「可点」：`cursor: pointer` —— 作者自己声明的「这里能点」，比按类名猜可靠。
//   ⚠️ 不把「有没有 disabled」当成所有元素的要求：装饰性可点区（遮罩/卡片）本来就不禁用。
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';

/* ── 登记豁免（**不是缺陷**）：有理由地保留 cursor:pointer 而不提供 hover ─────────
   这类元素「真的可点」，但交互语义是「取消/关闭」而非「选中/提交」，且**占满整屏**。
   三条路里选第三条（另两条经实测否决）：
     ① 加 hover → 整屏闪一下，比无反馈更差；
     ② 去掉 pointer → 没人知道「点外面能关」，可发现性下降；
     ③ 保留 pointer + **豁免并写明理由**（本节即理由，对应原则 4.7 第三类）。
   口径（原则 §12）：指标必须**分别**报「未登记缺陷」与「登记豁免」——
   混成一个数，第 4 个未登记的出现时没人会发现。
   ⚠️ 本表是**白名单**：只有登记过的选择器才被豁免；新增条目必须写明理由与证据位置。
   表过期（登记了但已不适用）会被 `staleExemptions` 抓出来，防止表烂掉。 */
export const HOVER_EXEMPT = new Map([
  ['.a11y-backdrop', '整屏遮罩，点击=关闭（Modals.jsx / Plog/index.jsx：aria-label="关闭预览" onClick={onClose}）'],
  ['.tpl-modal-backdrop', '整屏遮罩，点击=关闭（PublicTemplates/index.jsx：onClick={onClose}）'],
  ['.ec-profile-rail-scrim', '整屏遮罩，点击=关闭（EcProfileRail.jsx：aria-label="关闭商品档案抽屉"）；且 z-index:-1，反馈会被抽屉盖掉'],
]);

/** 剥注释（保留换行，行号不漂）后收集「选择器 → { body, rel, at }」 */
export function collectStateRules(cssFiles, root) {
  const rules = [];
  for (const file of cssFiles) {
    const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    const rel = path.relative(root, file).split(path.sep).join('/');
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(text))) rules.push({ rel, sel: m[1].trim(), body: m[2], at: text.slice(0, m.index).split('\n').length });
  }
  return rules;
}

const baseName = (sel) => sel.split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean);

/** 允许「状态挂在容器上」的写法：找该 base 的任一祖先片段是否已有该状态 */
function lacks(set, base) {
  const parts = base.split(/\s+/).filter(Boolean);
  for (let i = parts.length; i >= 1; i--) if (set.has(parts.slice(0, i).join(' '))) return false;
  return true;
}

/**
 * @returns {{ clickables, noHover, noFocus, exempt, unregistered, staleExemptions,
 *             explicitFocus, coverage }}
 */
/* ═══ 2026-09-26 批 BT：滚动悬停守卫前缀对"状态覆盖率"是**透明**的 ═══════════════════════════════
   规则形如 `html:not([data-scrolling]) .x:hover { … }`，含义是"滚动那 150ms 不呈现悬停"；
   若按原文解析，`s.split(':')[0]` 会把 base 认成 `html` ⇒ 该控件被误判成"没有 hover"。
   ⇒ 解析前统一剥掉这个前缀。⚠️ 不是放宽判据：剥掉之后仍然要求"该控件必须有 :hover 规则"。 */
const SCROLL_GUARD_PREFIX = /^html:not\(\[data-scrolling\]\)\s+/;
export function stripScrollGuardPrefix(selector) {
  return String(selector).split(',').map(part => part.trim().replace(SCROLL_GUARD_PREFIX, '')).join(', ');
}

export function scanInteractiveState(cssFiles, root) {
  const rules = collectStateRules(cssFiles, root).map(rule => ({ ...rule, sel: stripScrollGuardPrefix(rule.sel) }));
  const hasState = { hover: new Set(), focus: new Set(), disabled: new Set() };
  for (const r of rules) {
    for (const s of r.sel.split(',').map(x => x.trim())) {
      const b = s.split(':')[0].trim();
      if (/:hover\b/.test(s)) hasState.hover.add(b);
      if (/:focus(-visible|-within)?\b/.test(s)) hasState.focus.add(b);
      if (/:disabled\b|\[disabled\]|\[aria-disabled/.test(s)) hasState.disabled.add(b);
    }
  }
  const clickables = new Map();   /* base -> { rel, at } 首次出现位置 */
  for (const r of rules) {
    if (!/cursor:\s*pointer/.test(r.body)) continue;
    for (const b of baseName(r.sel)) if (b && !clickables.has(b)) clickables.set(b, { rel: r.rel, at: r.at });
  }
  const noHover = [], noFocus = [];
  for (const [base, loc] of clickables) {
    if (lacks(hasState.hover, base)) noHover.push({ base, ...loc });
    if (lacks(hasState.focus, base)) noFocus.push({ base, ...loc });
  }
  const exempt = [], unregistered = [];
  for (const it of noHover) (HOVER_EXEMPT.has(it.base) ? exempt : unregistered).push(it);
  const noHoverBases = new Set(noHover.map(it => it.base));
  const staleExemptions = [...HOVER_EXEMPT.keys()].filter(k => !noHoverBases.has(k));
  const explicitFocus = clickables.size - noFocus.length;
  return {
    clickables, noHover, noFocus, exempt, unregistered, staleExemptions,
    explicitFocus,
    coverage: clickables.size ? Math.round(explicitFocus / clickables.size * 100) : 100,
  };
}
