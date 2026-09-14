/**
 * 定价页视觉重做 · 状态与主次契约测试（第七批）
 * 2026-09-15 总统筹批次：定价页 = 用户决定掏钱的页面，必须有主次、有状态。
 *
 * 唯一权威：src/styles/design-tokens-v3.css（--sb-*）+ docs/design/40-decisions.md（D1–D13）
 *
 * 背景（改版前实测）：
 *   「套餐卡纯白 + rgba(231,229,228,.8) 极淡边框，六卡糊成一片；
 *     『即将上线』仅靠 1px dashed 与可购买区分；hover 实测零差异；
 *     focus-visible 实测无任何可见变化（键盘用户完全看不到焦点）。」
 *
 * 本测试锁死六件事（全部按**可测行为**断言，不数关键字）：
 *   p-1 卡片有海拔：浮起类容器必须有 --sb-shadow-*，圆角走 --sb-radius-*
 *   p-2 六卡不糊：推荐档在海拔/描边/位移/尺寸至少三维与普通卡不同
 *   p-3 四态齐备：hover / selected(ring) / focus-visible / disabled
 *   p-4 hover 与 default 必须不同，且**边框宽度恒定**（D2 禁止布局抖动）
 *   p-5 即将上线：真不可点（disabled 属性）+ 明确视觉降级（不只虚线）
 *   p-6 文案不变式：用户可见文案不得出现 上游/供应商/备用/任务号
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const CSS = read('src/pages/Pricing/Pricing.css');
const JSX = read('src/pages/Pricing/index.jsx');
const TOKENS = read('src/styles/design-tokens-v3.css');

/** 取某个 CSS 规则块（选择器 → 声明体），用于逐条核对状态取色。 */
function rule(selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc + '\\s*\\{([^}]*)\\}');
  const m = CSS.match(re);
  return m ? m[1] : null;
}
/** 取组合选择器（如 .a:hover）缺失即返回 null，便于「必须存在」断言。 */
function mustRule(selector) {
  const body = rule(selector);
  assert.ok(body !== null, '缺少 CSS 规则：' + selector);
  return body;
}
/** 解析 token 的实际像素值（支持 语义别名 → 阶梯 两级）。 */
function tokenValue(name) {
  const def = n => (TOKENS.match(new RegExp('--' + n + ':\\s*([^;]+);')) || [])[1];
  const v = def(name);
  if (!v) return null;
  const alias = v.match(/var\((--[\w-]+)\)/);
  return alias ? (def(alias[1].replace('--', '')) || '').trim() : v.trim();
}

/* ═══ p-1 卡片有海拔与层次 ═══ */

test('p-1 套餐卡与档位卡都走 --sb-surface-* 分层 + --sb-shadow-* 海拔 + --sb-radius-* 圆角', () => {
  for (const sel of ['.pricing-pack-card', '.pricing-tier-card']) {
    const body = mustRule(sel);
    assert.match(body, /background:\s*var\(--sb-surface-/, sel + ' 必须用 --sb-surface-* 分层（不再靠白卡+淡边框）');
    assert.match(body, /box-shadow:\s*var\(--sb-shadow-/, sel + ' 浮起类容器必须有 --sb-shadow-* 阴影');
    assert.match(body, /border-radius:\s*var\(--sb-radius-/, sel + ' 圆角必须走 --sb-radius-* token');
  }
  /* 改版前是 rgba(231,229,228,.8) 这类极淡边框 —— 必须已换成暖黑 token */
  assert.ok(!/231,\s*229,\s*228/.test(CSS), '不得再出现 rgba(231,229,228,*) 极淡边框');
});

test('p-1 卡片圆角落在 D6 允许档位内（不再自造 18px）', () => {
  const packRadius = tokenValue('sb-radius-2xl');
  const tierRadius = tokenValue('sb-radius-xl');
  assert.equal(packRadius, '20px', '套餐卡圆角应为面板档 20px');
  assert.equal(tierRadius, '16px', '档位卡圆角应为卡片档 16px');
  /* 改版前档位卡是自造的 18px —— 不在任何 token 档位里。
     只校验本批改造的四条卡片规则（FAQ 箭头/modal 属他人区域，不在本批范围）。 */
  for (const sel of ['.pricing-pack-card', '.pricing-tier-card']) {
    assert.match(mustRule(sel), /border-radius:\s*var\(--sb-radius-/, sel + ' 圆角必须走 token');
  }
  assert.ok(!/\.pricing-tier-card\s*\{[^}]*border-radius:\s*18px/.test(CSS), '档位卡不得再自造 18px');
});

/* ═══ p-2 六卡不能糊成一片：推荐档必须明显更突出 ═══ */

test('p-2 推荐档在「描边 / 海拔 / 位移 / 价格字号」四个维度同时强于普通卡', () => {
  const normal = mustRule('.pricing-pack-card');
  const rec = mustRule('.pricing-pack-card.is-recommended');

  /* ① 描边：普通卡中性，推荐档品牌色 */
  assert.match(normal, /border:\s*1px solid var\(--sb-border-default\)/, '普通卡用中性默认描边（克制）');
  assert.match(rec, /border-color:\s*var\(--sb-brand-/, '推荐档必须换成品牌描边');

  /* ② 海拔：推荐档阴影层级更高（shadow-4 vs shadow-2） */
  assert.match(normal, /box-shadow:\s*var\(--sb-shadow-2\)/, '普通卡海报 shadow-2');
  assert.match(rec, /box-shadow:\s*var\(--sb-shadow-4\)/, '推荐档必须 shadow-4（更高海拔）');

  /* ③ 位移：推荐档抬升，物理上浮在同行之上 */
  const elev = rec.match(/transform:\s*translateY\(-?(\d+)px\)/);
  assert.ok(elev, '推荐档必须有抬升位移');
  assert.ok(Number(elev[1]) >= 4, '推荐档抬升需 ≥4px 才读得出主次，实际 ' + elev[1] + 'px');

  /* ④ 尺寸：推荐档价格字号更大 */
  const bigPrice = mustRule('.pricing-pack-card.is-recommended .pricing-price-number');
  const big = Number((bigPrice.match(/font-size:\s*(\d+)px/) || [])[1]);
  assert.ok(big >= 40, '推荐档价格应放大到 ≥40px，实际 ' + big);

  /* 其余卡必须克制：不能所有卡都带推荐样式 */
  assert.ok(!/\.pricing-pack-card\s*\{[^}]*--sb-brand-/.test(normal), '普通卡不得使用品牌强调色');
});

test('p-2 推荐角标与「突出」样式同源（角标在哪张，海拔就在哪张）', () => {
  /* 根因回归：数据层 plan.recommended 来自 constants/data.js 的 pop 字段（只标月卡·Pro），
     而页面视觉把「最受欢迎」给团队版 —— 两套口径打架会让角标与海拔落在不同的卡上。 */
  assert.ok(JSX.includes('HIGHLIGHT_SKU'), '页面必须有唯一的推荐档 SKU 常量');
  const decl = JSX.match(/const HIGHLIGHT_SKU = '([^']+)'/);
  assert.ok(decl, 'HIGHLIGHT_SKU 必须显式声明为 tconst');
  const sku = decl[1];
  /* 角标与 class 都必须由同一个 highlighted 布尔量驱动 */
  assert.match(JSX, /highlighted\s*=\s*Boolean\(plan\.recommended\)\s*\|\|\s*plan\.sku === HIGHLIGHT_SKU/,
    'highlighted 必须同时认数据层与页面口径');
  assert.ok(JSX.includes("highlighted ? ' is-recommended' : ''"), 'is-recommended 必须由 highlighted 驱动');
  assert.ok(JSX.includes('{highlighted &&'), '角标必须由 highlighted 驱动');
  assert.ok(sku === 'ec_growth_79', '推荐档应为团队版 ec_growth_79（与页面「最受欢迎」角标一致），实际 ' + sku);
});

/* ═══ p-3 四态齐备 ═══ */

test('p-3 hover / focus-visible / disabled 三态在 CSS 里都有实现', () => {
  mustRule('.pricing-pack-card:hover:not(.is-off)');
  mustRule('.pricing-pack-card:focus-visible');
  mustRule('.pricing-tier-card:hover');
  mustRule('.pricing-tier-card:focus-within');
  mustRule('.pricing-btn-primary:hover:not(:disabled)');
  mustRule('.pricing-btn-primary:focus-visible');
  /* 禁用态写成了选择器列表（:disabled 与 .pricing-btn-muted 共用一套观感），
     故按「列表内出现该选择器」判定，而不是要求单独成条。 */
  const disabledBody = rule('.pricing-btn-primary:disabled,\n.pricing-btn-muted');
  assert.ok(disabledBody !== null, '缺少 disabled 规则（.pricing-btn-primary:disabled / .pricing-btn-muted）');
  assert.match(disabledBody, /var\(--sb-state-disabled-bg\)/, 'disabled 必须用语义禁用底');
  assert.match(disabledBody, /var\(--sb-state-disabled-ink\)/, 'disabled 必须用语义禁用墨色');
  assert.match(disabledBody, /cursor:\s*not-allowed/, 'disabled 指针必须 not-allowed');
});

test('p-3 selected 用 D2 的 ring 方案（--sb-shadow-ring），不用加粗边框', () => {
  const sel = mustRule('.pricing-pack-card.is-selected');
  assert.match(sel, /box-shadow:\s*var\(--sb-shadow-ring\)/, 'selected 必须叠 --sb-shadow-ring');
  assert.ok(!/border-width/.test(sel), 'selected 不得改边框宽度（D2：会抖动）');
  /* ring token 本身必须存在且指向品牌环 */
  assert.match(TOKENS, /--sb-shadow-ring:\s*0 0 0 3px var\(--sb-brand-ring\)/, 'ring token 口径必须与 D2 一致');
  assert.match(TOKENS, /--sb-focus-ring:\s*var\(--sb-shadow-ring\)/, 'focus ring 复用同一支');
});

test('p-3 :focus-visible 走 --sb-focus-ring，且不再用裸 outline 抑制后无替代', () => {
  const fv = mustRule('.pricing-page :focus-visible');
  assert.match(fv, /outline:\s*0 solid transparent/, 'UA 轮廓必须以 0 宽度+透明色关闭（与审计口径一致）');
  assert.ok(CSS.includes('var(--sb-focus-ring)'), '必须提供统一的可见焦点替代（D11）');
  /* 改版前 focus 实测零差异 —— 现在必须有 box-shadow 环 */
  const ringUsage = (CSS.match(/box-shadow:\s*var\(--sb-focus-ring\)/g) || []).length;
  assert.ok(ringUsage >= 2, '焦点环应覆盖卡片与按钮，实际 ' + ringUsage + ' 处');
});

/* ═══ p-4 hover ≠ default，且边框宽度恒定（D2） ═══ */

test('p-4 hover 与默认态必须视觉不同（实测差异而非声明）', () => {
  const rest = mustRule('.pricing-pack-card');
  const hover = mustRule('.pricing-pack-card:hover:not(.is-off)');
  /* hover 至少要动海拔或描边之一 —— 改版前「实测零差异」是本次要治的病 */
  assert.ok(/--sb-shadow-/.test(hover), 'hover 必须改海拔');
  assert.ok(/--sb-border-strong/.test(hover), 'hover 必须改描边色');
  assert.notEqual(rest.trim(), hover.trim(), 'hover 声明不得与默认态相同');

  const tierHover = mustRule('.pricing-tier-card:hover');
  assert.ok(/--sb-shadow-3/.test(tierHover), '档位卡 hover 必须改海拔');
  assert.ok(/translateY\(-2px\)/.test(tierHover), '档位卡 hover 位移必须落在 -2px 档（审计：位移档位收敛）');
});

test('p-4 卡片与按钮在**所有状态**下边框宽度恒定（禁止 hover 改宽度造成抖动）', () => {
  /* 逐条扫描本批涉及的卡片/按钮规则；任何非 1px 宽度即违规。
     范围限定：FAQ 折叠箭头（1.5px 装饰线）与 modal 内部属他人区域，不在本批。 */
  const SCOPED = [
    '.pricing-pack-card', '.pricing-tier-card',
    '.pricing-btn-primary', '.pricing-btn-muted',
  ];
  const offenders = [];
  /* 取出所有 selector 里含上述前缀的规则块，逐块查 border 宽度 */
  const blockRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = blockRe.exec(CSS))) {
    const selector = m[1].trim();
    if (!SCOPED.some(s => selector.startsWith(s))) continue;
    const declRe = /(?:^|;)\s*border(?:-(?:top|right|bottom|left))?\s*:\s*([^;]+)/g;
    let d;
    while ((d = declRe.exec(m[2]))) {
      const w = d[1].trim().match(/^([\d.]+)px/);
      if (w && w[1] !== '1') offenders.push(selector + ' → ' + d[1].trim().slice(0, 40));
    }
  }
  assert.deepEqual(offenders, [], '出现非 1px 边框宽度（会随状态抖动）：' + offenders.join(' | '));

  /* 反向确认：hover/selected 规则里不得出现 border-width 改写 */
  assert.ok(!/:hover[^{]*\{[^}]*border-width/.test(CSS), 'hover 不得改边框宽度');
  assert.ok(!/is-selected[^{]*\{[^}]*border-width/.test(CSS), 'selected 不得改边框宽度（D2）');
});

/* ═══ p-5 即将上线：真不可点 + 明确视觉降级 ═══ */

test('p-5 停用卡的按钮真挂 disabled 属性（不是只降透明度）', () => {
  /* 档位卡：即将上线的按钮必须 disabled + aria-disabled */
  assert.match(JSX, /disabled\s+aria-disabled="true"[\s\S]{0,80}pricing-btn-muted/,
    '即将上线的按钮必须真 disabled + aria-disabled');
  /* 套餐卡：disabled 必须由 plan.enabled 驱动并绑定到属性 */
  assert.match(JSX, /const disabled = !plan\.enabled;/, '必须由 plan.enabled 推出 disabled');
  assert.match(JSX, /disabled=\{disabled\}/, 'disabled 必须绑到真属性');
  /* 停用卡整体标记 aria-disabled，读屏可辨 */
  assert.ok(JSX.includes('aria-disabled={soon ? true : undefined}'), '停用档位卡必须标 aria-disabled');
});

test('p-5 停用态用明确禁用配色（--sb-state-disabled-*），不是只用 opacity', () => {
  const muted = mustRule('.pricing-btn-muted');
  assert.match(muted, /background:\s*var\(--sb-state-disabled-bg\)/, '禁用底必须走语义 token');
  assert.match(muted, /color:\s*var\(--sb-state-disabled-ink\)/, '禁用字色必须走语义 token');
  assert.match(muted, /cursor:\s*not-allowed/, '禁用指针必须是 not-allowed');
  /* 反例：改版前用 opacity:.72 表达禁用 —— 卡片级 opacity 会造成「看起来只是变淡了」 */
  const off = mustRule('.pricing-tier-card.is-off');
  assert.ok(!/opacity\s*:\s*0?\.7/.test(off), '停用卡不得用 opacity 冒充禁用配色');
});

test('p-5 即将上线有一眼可辨的状态徽标 + 卡片级降级（不只靠 1px 虚线）', () => {
  const pill = mustRule('.pricing-soon-pill');
  /* 徽标用 warning 语义四件套（不再是自造金色硬编码） */
  assert.match(pill, /color:\s*var\(--sb-ink-warning\)/, '徽标文字用语义墨色 token（D10）');
  assert.match(pill, /background:\s*var\(--sb-warning-soft\)/, '徽标底用语义浅底 token');
  assert.match(pill, /border:\s*1px solid var\(--sb-warning-border\)/, '徽标描边用语义 token');
  /* 徽标自身不得再保留自造金色硬编码（改版前是 #B8862C + rgba(201,162,90,*)）。
     只扫描 .pricing-soon-pill 这一条及暗色覆写，不误伤 modal 订单状态条（他人区域）。 */
  assert.ok(!/#B8862C/.test(pill), '徽标不得再保留自造金 #B8862C');
  assert.ok(!/201,\s*162,\s*90/.test(pill), '徽标不得再保留 rgba(201,162,90,*) 自造金');
  /* 暗色可读性由 p-7 专条实算对比度并钉死「必需覆写」，此处不重复断言。 */

  /* 卡片级降级：凹槽底 + 去阴影（与在售卡的白面+海拔形成强反差） */
  const off = mustRule('.pricing-tier-card.is-off');
  assert.match(off, /background:\s*var\(--sb-surface-sunken\)/, '停用卡必须降到凹槽底');
  assert.match(off, /box-shadow:\s*none/, '停用卡必须去阴影（读作不可交互）');
  assert.match(off, /border:\s*1px dashed var\(--sb-border-strong\)/, '保留虚线作为次级信号');

  /* 不可购买不该用全对比度喊价：价格必须降级到比在售卡更弱的墨色
     （具体取到哪一档由 p-7 用 WCAG 实算钉死，这里只断言「确实降级了」）。 */
  const offPriceMatch = CSS.match(/\.pricing-tier-card\.is-off \.pricing-price-number,[\s\S]{0,240}?color:\s*var\((--sb-ink-\d)\)/);
  assert.ok(offPriceMatch, '停用卡价格必须显式降级（需有 is-off 价格墨色规则）');
  assert.notEqual(offPriceMatch[1], '--sb-ink-1',
    '停用卡价格不得沿用最高对比墨色（否则比可售档更抢眼）');
  assert.match(mustRule('.pricing-price-number'), /var\(--sb-ink-1\)/, '在售卡价格用最高对比墨色');
});

test('p-5 即将上线的卡片不含任何可点区域（无 onClick，键盘也不可达）', () => {
  /* 档位卡本身是 <article>，且不带 onClick —— 只有按钮可点，而按钮是 disabled */
  assert.match(JSX, /<article[\s\S]{0,200}className=\{'pricing-tier-card'/, '档位卡必须是 <article> 而非 button');
  const tierFn = JSX.slice(JSX.indexOf('function VideoTierCard'), JSX.indexOf('function PackCard'));
  assert.ok(tierFn.length > 100, '必须定位到 VideoTierCard 实现');
  assert.ok(!/onClick/.test(tierFn.replace(/onClick=\{onUse\}/g, '')),
    '档位卡除在售按钮外不得有其它 onClick');
  /* 停用分支必须走 disabled 按钮，而不是「有 onClick 但不响应」 */
  /* 停用分支：定位到 pricing-btn-muted 按钮，其开标签内不得有 onClick，
     且必须带 disabled（真禁用），而不是「有 onClick 但点了没反应」。 */
  const mutedIdx = tierFn.indexOf('pricing-btn-muted');
  assert.ok(mutedIdx > 0, '必须存在停用分支（pricing-btn-muted）');
  const tagStart = tierFn.lastIndexOf('<button', mutedIdx);
  const tagEnd = tierFn.indexOf('>', mutedIdx);
  assert.ok(tagStart > 0 && tagEnd > tagStart, '必须定位到停用按钮的开标签');
  const tag = tierFn.slice(tagStart, tagEnd + 1);
  assert.ok(!/onClick/.test(tag), '停用按钮不得绑定 onClick，实际: ' + tag.replace(/\s+/g, ' ').slice(0, 140));
  assert.ok(/disabled/.test(tag), '停用按钮必须带 disabled 属性，实际: ' + tag.replace(/\s+/g, ' ').slice(0, 140));
});

/* ═══ p-6 文案不变式 ═══ */

test('p-6 用户可见文案不得出现 上游/供应商/备用/任务号', () => {
  /* 只扫用户可见字符串（引号内 / JSX 文本），不误伤英文标识符与注释。 */
  const visible = [];
  for (const m of JSX.matchAll(/'([^'\\]*)'/g)) visible.push(m[1]);
  for (const m of JSX.matchAll(/"([^"\\]*)"/g)) visible.push(m[1]);
  for (const m of JSX.matchAll(/>([^<>{}\n]{2,})</g)) visible.push(m[1]);
  const banned = ['上游', '供应商', '备用', '任务号'];
  const hits = [];
  for (const s of visible) for (const w of banned) if (s.includes(w)) hits.push(w + ' ← ' + s.trim().slice(0, 40));
  assert.deepEqual(hits, [], '用户可见文案出现禁用词：' + hits.join(' | '));
});

test('p-6 页面不引入任何新的硬编码色值（只允许下调）', () => {
  /* 口径说明：docs/design/token-ratchet-baseline.json 里的 Pricing/index.jsx 记的是 13，
     而 HEAD 上实际已是 15（基线文件陈旧）。权威口径是 scripts/design-ratchet.mjs 的
     「不新增」判定，这里用同样的规则内联复核：本批改动不得让任一文件超过其**当前值**。
     故断言「改动后的值 ≤ 仓库基线（取基线文件与 15 的较大者）」并额外锁死具体分布。 */
  /* 上限只允许下调（棘轮铁律）。Pricing.css 已从 6 降到 5：
     hero 三色渐变的字面 #ec4899 已并入 --sb-brand-gradient-hero token。
     剩余 5 处均为他人区域（modal 状态条 / #FFFFFF 关键字），不在本批范围。 */
  const EXPECTED = {
    'src/pages/Pricing/Pricing.css': 5,
    'src/pages/Pricing/index.jsx': 15,
  };
  for (const [f, cap] of Object.entries(EXPECTED)) {
    const now = (read(f).match(/#[0-9a-fA-F]{3,8}\b/g) || []).length;
    assert.ok(now <= cap, f + ' 硬编码色值 ' + cap + ' → ' + now + '（只允许下调）');
  }
  /* 新增的视觉代码必须零硬编码：本批新增的规则里不得出现字面色值 */
  const css = read('src/pages/Pricing/Pricing.css');
  const newBlocks = ['.pricing-pack-card {', '.pricing-tier-card {', '.pricing-soon-pill {'];
  for (const marker of newBlocks) {
    const i = css.indexOf(marker);
    assert.ok(i >= 0, '必须定位到规则：' + marker);
    const body = css.slice(i, css.indexOf('}', i));
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(body) && !/rgba\(/.test(body),
      marker + ' 内不得有硬编码色值');
  }
});

/* ═══ p-7 可读性：按 WCAG 公式实算（D10 要求落进断言，而不是靠眼睛） ═══ */

/** 相对亮度 / 对比度 —— 与 scripts/design-audit.mjs 同公式。 */
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
/** 取某个 token 的声明体（name 传不带 -- 的名字）。 */
const decl = name => {
  const m = TOKENS.match(new RegExp('--' + name + ':\\s*([^;]+);'));
  return m ? m[1].trim() : null;
};
/** 从 token 文件取 hex 值（支持 语义别名 → 阶梯 两层解析）。 */
const tokenHex = name => {
  let v = decl(name);
  if (!v) return null;
  for (let depth = 0; depth < 3; depth++) {
    const alias = v.match(/var\(\s*--([\w-]+)\s*\)/);
    if (!alias) break;
    const next = decl(alias[1]);
    if (!next) return null;
    v = next;
  }
  const hex = v.match(/#[0-9a-fA-F]{6}/);
  return hex ? hex[0] : null;
};

test('p-7 token 解析器自检（防止断言因解析失败而空转）', () => {
  assert.equal(tokenHex('sb-neutral-150'), '#EFEAE1', '凹槽底应解析到中性 150');
  assert.equal(tokenHex('sb-ink-1'), '#1A1614', '标题墨色应经别名解析到中性 800');
  assert.equal(tokenHex('sb-surface-sunken'), '#EFEAE1', 'surface-sunken 应解析到中性 150');
});

test('p-7 停用卡片上的文字在凹槽底上仍达 WCAG AA（降级 ≠ 不可读）', () => {
  const sunken = tokenHex('sb-surface-sunken');
  assert.ok(sunken, '必须能解析凹槽底色');

  /* 前提校验：--sb-ink-4 在凹槽底上确实不达标 —— 这正是不能拿它写正文的原因 */
  const ink4 = tokenHex('sb-ink-4');
  const r4 = contrast(ink4, sunken);
  assert.ok(r4 < 4.5, '前提校验：ink-4 在凹槽底上应低于 AA（实测 ' + r4.toFixed(2) + '）');

  /* ink-3 必须达标 */
  const ink3 = tokenHex('sb-ink-3');
  const r3 = contrast(ink3, sunken);
  assert.ok(r3 >= 4.5, 'ink-3 在凹槽底上必须 ≥4.5:1，实测 ' + r3.toFixed(2));

  /* 而停用正文/价格实际用的就是达标的 ink-3 */
  assert.match(CSS, /\.pricing-tier-card\.is-off \.pricing-tier-tagline,[\s\S]{0,160}?color:\s*var\(--sb-ink-3\)/,
    '停用正文必须用 --sb-ink-3（达标）');
  assert.match(CSS, /\.pricing-tier-card\.is-off \.pricing-price-number,[\s\S]{0,240}?color:\s*var\(--sb-ink-3\)/,
    '停用价格必须用 --sb-ink-3（达标）');
});

test('p-7 金额与积分数字在白底上均达 WCAG AA', () => {
  for (const [tok, need, label] of [
    ['sb-ink-1', 4.5, '金额 / 标题'],
    ['sb-ink-3', 4.5, '积分 / 辅助'],
    ['sb-ink-info', 4.5, '积分语义色'],
  ]) {
    const hex = tokenHex(tok);
    assert.ok(hex, '必须能解析 --' + tok);
    const r = contrast(hex, '#FFFFFF');
    assert.ok(r >= need, label + '（--' + tok + '）在白底上需 ≥' + need + ':1，实测 ' + r.toFixed(2));
  }
  /* 金额必须走 --sb-ink-1（可读性要求），不得用低对比的 ink-4/5 */
  assert.match(mustRule('.pricing-price-number'), /color:\s*var\(--sb-ink-1\)/,
    '金额必须用最高对比墨色 --sb-ink-1');
});

test('p-7 即将上线徽标在亮/暗两种主题下都达 WCAG AA', () => {
  const inkWarning = tokenHex('sb-ink-warning');
  const warningSoft = tokenHex('sb-warning-soft');
  assert.ok(inkWarning && warningSoft, '必须能解析徽标亮色组合');
  const light = contrast(inkWarning, warningSoft);
  assert.ok(light >= 4.5, '亮色徽标需 ≥4.5:1，实测 ' + light.toFixed(2));

  /* 事实核对：token 文件的暗色块只重定义了 --sb-warning / --sb-ink-warning，
     --sb-warning-soft 仍继承亮色（近乎白）→ 组件必须自带暗色覆写。
     这条断言把这个「必需覆写」钉死，防止有人图省事删掉它。 */
  const darkBlock = TOKENS.slice(TOKENS.indexOf('[data-theme="dark"]'));
  assert.ok(darkBlock.length > 0, 'design-tokens-v3.css 必须提供暗色取值块');
  assert.ok(darkBlock.includes('--sb-ink-warning:'), '暗色必须重定义 --sb-ink-warning');
  assert.ok(!darkBlock.includes('--sb-warning-soft:'),
    '前提校验：--sb-warning-soft 在暗色下继承亮色值（故组件覆写必需）');

  const dark = mustRule('[data-theme="dark"] .pricing-soon-pill');
  assert.match(dark, /background:\s*var\(--sb-warning-ring\)/, '暗色徽标底必须换成半透明暖金');
  assert.match(dark, /color:\s*var\(--sb-ink-warning\)/, '暗色徽标字必须用暗色语义墨色');

  /* 暗色合成实测：字 rgb(240,178,74) on rgba(224,138,46,.3) 叠在卡片底 rgb(20,19,18) */
  const r = contrast('#F0B24A', '#51371A');
  assert.ok(r >= 4.5, '暗色徽标需 ≥4.5:1，实测 ' + r.toFixed(2));
});

/* ═══ p-8 品牌渐变必须走 token（本仓硬性：不许引入新的硬编码色值） ═══ */

test('p-8 hero 三色渐变走 --sb-brand-gradient-hero token，不留字面 hex', () => {
  const css = read('src/pages/Pricing/Pricing.css');
  assert.match(css, /\.pricing-hero-accent \{[\s\S]{0,220}?background:\s*var\(--sb-brand-gradient-hero\)/,
    'hero 渐变必须引用 --sb-brand-gradient-hero');
  /* 反向：hero 区块内不得出现任何字面色值 */
  const i = css.indexOf('.pricing-hero-accent {');
  const block = css.slice(i, css.indexOf('}', i));
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(block), 'hero 渐变色块内不得有字面 hex：' + block);
  assert.ok(!/rgba\(/.test(block), 'hero 渐变色块内不得有字面 rgba()');

  /* token 本身必须真实存在且确为三色（防 token 被改空/改单色） */
  assert.match(TOKENS, /--sb-brand-gradient-hero:\s*linear-gradient\([^;]*#7C3AED[^;]*#EC4899[^;]*#F59E0B/i,
    '--sb-brand-gradient-hero 必须是 紫→粉→橙 三色');
});
