// test/design-tokens-v3-adoption.test.mjs
// 2026-09-15 总统筹 V3 第一批：首页面板视觉体系。
// 唯一权威：src/styles/design-tokens-v3.css（--sb-*）
// 原则：docs/design/00-principles.md
// 问题清单：docs/design/31-current-ui-audit.md
//
// 本测试锁死三件事：
//   d-1 改动文件里不再出现硬编码色值（允许的例外逐条列入白名单并说明理由）
//   d-2 选中态与 hover 态确实不同（原则 4.3：两条不同视觉通道）
//   d-3 面板圆角收敛到 20/12/8/6 四档（原则 3.4 嵌套圆角公式）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/* ── 允许的例外：逐条说明理由 ──
   1. 风格预览渐变：StylePanel 的 card.gradient 是「该风格长什么样」的示意色，
      属于**内容**而不是 UI 装饰色，必须保留原值。
   2. SSR / 无 document 时的兜底常量：正常路径一律从 --sb-* 读取，
      常量只在 typeof window === 'undefined' 时生效。 */
const STYLE_PREVIEW_FILES = ['src/pages/Home/ec/StylePanel.jsx'];

/** 去掉注释后再统计，避免「解释根因的注释里引用了旧色值」误伤自身。 */
const stripComments = source => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const countHardcoded = (source, { allowGradient = false } = {}) => {
  const clean = stripComments(source);
  /* 逐行扫描：允许风格预览渐变所在的那一行 */
  const offenders = [];
  for (const line of clean.split('\n')) {
    /* 例外 A：风格预览渐变（StylePanel 的 card.gradient 是内容示意色） */
    if (allowGradient && /gradient/i.test(line)) continue;
    /* 例外 B：占位文案里的**示例色值**（如 ph: '白色 / #F5F0EB'）——
       它是给用户看的输入示例，不是渲染样式，必须保留可读性。 */
    if (/\bph:\s*'/.test(line) || /placeholder=/.test(line)) continue;
    const hex = line.match(/#[0-9a-fA-F]{3,8}\b/g);
    const rgba = line.match(/rgba\(/g);
    if (hex) offenders.push(...hex.map(h => 'hex ' + h));
    if (rgba) offenders.push(...rgba.map(() => 'rgba()'));
  }
  return offenders;
};

/* ═══ d-1 硬编码色值清零 ═══ */

test('d-1 生成设置面板无任何硬编码色值', () => {
  const offenders = countHardcoded(read('src/pages/Home/ec/GenSettingsPanel.jsx'));
  assert.deepEqual(offenders, [], '仍有硬编码色值：' + offenders.join(', '));
});

test('d-1 内容规范 / 商品信息 / SKU / 生成约束 四面板无硬编码色值', () => {
  for (const file of ['CopyPanel', 'ParamsPanel', 'SkuPanel', 'GenerationConstraintsPanel']) {
    const offenders = countHardcoded(read('src/pages/Home/ec/' + file + '.jsx'));
    assert.deepEqual(offenders, [], file + ' 仍有硬编码色值：' + offenders.join(', '));
  }
});

test('d-1 套图方案面板无硬编码色值', () => {
  const offenders = countHardcoded(read('src/pages/Home/ec/SizingPanel.jsx'));
  assert.deepEqual(offenders, [], '仍有硬编码色值：' + offenders.join(', '));
});

test('d-1 风格面板仅保留「风格预览渐变」这一处合法例外', () => {
  const src = read('src/pages/Home/ec/StylePanel.jsx');
  const offenders = countHardcoded(src, { allowGradient: true });
  assert.deepEqual(offenders, [], '除风格预览渐变外仍有硬编码色值：' + offenders.join(', '));
  /* 例外本身要确实存在且确实是渐变（防止白名单被滥用成空壳） */
  assert.ok(/gradient: 'linear-gradient/.test(src), '风格预览渐变应保留（它是内容不是装饰）');
});

test('d-1 Home.css 的 V3 改造区块无硬编码色值', () => {
  const css = read('src/pages/Home/Home.css');
  /* 只校验本批改造的两块：主 CTA 与首页模式切换 */
  const ctaBlock = css.slice(css.indexOf('.ec-workbench-cta {'), css.indexOf('.homepage-mode-showcase {'));
  const offenders = countHardcoded(ctaBlock);
  assert.deepEqual(offenders, [], '主 CTA 区块仍有硬编码色值：' + offenders.join(', '));

  const clean = stripComments(css);
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  const modeOffenders = [];
  while ((m = re.exec(clean))) {
    if (!/homepage-mode/.test(m[1])) continue;
    if (/#[0-9a-fA-F]{3,8}\b/.test(m[2]) || /rgba\(/.test(m[2])) modeOffenders.push(m[1].trim().slice(0, 50));
  }
  assert.deepEqual(modeOffenders, [], '模式切换相关规则仍有硬编码色值：' + modeOffenders.join(', '));
});

test('d-1 主 CTA 不再使用三色渐变（渐变只留给品牌时刻）', () => {
  const css = read('src/pages/Home/Home.css');
  const block = css.slice(css.indexOf('.ec-workbench-cta {'), css.indexOf('.homepage-mode-showcase {'));
  assert.ok(/background:\s*var\(--sb-brand\)/.test(block), '底色必须是品牌紫纯色 token');
  assert.ok(!/linear-gradient/.test(block), '功能按钮不得使用渐变');
  /* 实测：backgroundImage 必须为 none —— 静态断言等价物：块内无 gradient */
  const ecMode = read('src/pages/Home/EcMode.jsx');
  const ctaJsx = ecMode.slice(ecMode.indexOf('ec-workbench-cta'), ecMode.indexOf('ec-workbench-cta') + 900);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(ctaJsx), 'CTA 的 JSX 内不得再写死颜色');
});

/* ═══ d-2 hover 与 selected 必须不同 ═══ */

test('d-2 生成设置面板：hover 走中性色，selected 走品牌色（不同通道）', () => {
  /* 2026-09-15 V3 二次更新：本面板改用预置类 .sb-opt（20-components §0.4 明示优先），
     hover/selected 的实现随之从组件内联迁到 design-tokens-v3.css §18。
     契约不变：hover 走中性色、selected 走品牌三件套、两者视觉不同、selected 持久。 */
  const css = read('src/styles/design-tokens-v3.css');
  const block = css.slice(css.indexOf('.sb-opt {'), css.indexOf('.sb-opt__title'));
  assert.ok(block.includes('--sb-l3-option-hover'), 'hover 必须用中性 hover token');
  assert.ok(block.includes('--sb-sel-bg'), 'selected 必须用品牌浅底 token');
  assert.ok(block.includes('--sb-sel-line'), 'selected 必须用品牌描边 token');
  assert.ok(block.includes('--sb-sel-ink'), 'selected 必须用品牌字色 token');
  /* 三件套与 hover 不是同一个值 → 两种状态视觉可分 */
  assert.notEqual('--sb-l3-option-hover', '--sb-sel-bg');
  /* selected 必须持久：selected+hover 只加深底色，不回落成 hover 态 */
  assert.ok(block.includes('--sb-sel-bg-hover'), 'selected+hover 必须保持选中态（持久性）');

  const src = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  assert.ok(src.includes('className={optionClass}'), '面板必须采用 .sb-opt 预置类');
});

test('d-2 套图方案面板：勾选行与 hover 行使用不同底色 token', () => {
  const src = read('src/pages/Home/ec/SizingPanel.jsx');
  assert.ok(
    /checked\s*\?\s*'var\(--sb-state-selected-bg\)'\s*:\s*hoverRow[^?]*\?\s*'var\(--sb-state-hover-bg\)'/.test(src),
    'checked 用品牌浅底、hover 用中性底，二者必须不同',
  );
});

test('d-2 首页模式切换：hover 只改描边（中性），selected 才上品牌色', () => {
  const css = read('src/pages/Home/Home.css');
  const hoverRule = css.slice(css.indexOf('.homepage-mode-card:hover {'), css.indexOf('.homepage-mode-card:active {'));
  assert.ok(hoverRule.includes('var(--sb-border-strong)'), 'hover 描边用中性 strong token');
  assert.ok(!/var\(--sb-brand/.test(hoverRule), 'hover 不得出现品牌色（原则 4.3）');
  const activeRule = css.slice(css.indexOf('.homepage-mode-card.is-active {'), css.indexOf('.homepage-mode-showcase + .surface-card'));
  assert.ok(activeRule.includes('var(--sb-state-selected-line)'), 'selected 必须用品牌描边');
  assert.ok(activeRule.includes('var(--sb-state-selected-bg)'), 'selected 必须用品牌浅底');
});

test('d-2 八个状态齐备：focus-visible 与 active 都已定义（原则 4.1/4.2）', () => {
  const css = read('src/pages/Home/Home.css');
  const cta = css.slice(css.indexOf('.ec-workbench-cta {'), css.indexOf('.homepage-mode-showcase {'));
  for (const state of [':hover:not(:disabled)', ':active:not(:disabled)', ':focus-visible', ':disabled']) {
    assert.ok(cta.includes(state), '主 CTA 缺少状态：' + state);
  }
  assert.ok(cta.includes('var(--sb-focus-ring)'), 'focus 必须用统一焦点环 token');
  assert.ok(cta.includes('var(--sb-state-disabled-bg)'), 'disabled 必须用语义 token');

  const mode = css.slice(css.indexOf('.homepage-mode-card {'), css.indexOf('.homepage-mode-showcase + .surface-card'));
  for (const state of ['.homepage-mode-card:hover', '.homepage-mode-card:active', '.homepage-mode-card:focus-visible']) {
    assert.ok(mode.includes(state), '模式卡缺少状态：' + state);
  }
});

/* ═══ d-3 圆角收敛到四档 ═══ */

test('d-3 六面板的圆角全部走 token（不再出现 7/10/4 这类自造档位）', () => {
  for (const file of ['GenSettingsPanel', 'CopyPanel', 'ParamsPanel', 'SkuPanel', 'SizingPanel', 'GenerationConstraintsPanel']) {
    const src = read('src/pages/Home/ec/' + file + '.jsx');
    const numeric = [...src.matchAll(/borderRadius:\s*(\d+)\b/g)].map(m => m[1]);
    assert.deepEqual(numeric, [], file + ' 仍有数字圆角：' + numeric.join(', '));
  }
});

test('d-3 面板圆角按嵌套公式收敛（面板 20 → 内层 12 → 更内层 8 → 微件 6）', () => {
  const tokens = read('src/styles/design-tokens-v3.css');
  /* token 文件用「语义别名 → 阶梯」两级定义（--sb-radius-panel → --sb-radius-2xl → 20px），
     故解析两级，而不是硬找字面 20px。 */
  const def = name => (tokens.match(new RegExp(name + ':\\s*([^;]+);')) || [])[1];
  const resolve = name => {
    const v = def('--' + name);
    if (!v) return null;
    const alias = v.match(/var\((--[\w-]+)\)/);
    if (!alias) return v.trim();
    const inner = def(alias[1]);
    return inner ? inner.trim() : null;
  };
  assert.equal(resolve('sb-radius-panel'), '20px', '面板 20');
  assert.equal(resolve('sb-radius-card'), '12px', '内层 12');
  assert.equal(resolve('sb-radius-control'), '8px', '更内层 8');
  assert.equal(resolve('sb-radius-chip'), '6px', '微件 6');
});

/* ═══ 原则 6.2：语义色不得当身份标识 ═══ */

test('原则 6.2 两个上传卡不再一红一蓝（同一中性规格）', () => {
  const ecMode = read('src/pages/Home/EcMode.jsx');
  assert.equal((ecMode.match(/var\(--red\)/g) || []).length, 0, '不得再用危险红作身份标识');
  assert.equal((ecMode.match(/var\(--blue\)/g) || []).length, 0, '不得再用信息蓝作身份标识');
  const css = read('src/pages/Home/Home.css');
  const card = css.slice(css.indexOf('.ec-xhs-upload-card {'), css.indexOf('.ec-xhs-card-product'));
  assert.ok(card.includes('var(--sb-border-default)'), '上传卡必须用中性描边 token');
  assert.ok(!/var\(--red\)|var\(--blue\)/.test(card), '上传卡不得出现红/蓝');
});

/* ═══ 原则 8.1：动效不做装饰 ═══ */

test('原则 8.1 描述输入框的 inputGlow 无限呼吸动画已删除', () => {
  const css = read('src/pages/Home/Home.css');
  assert.equal((css.match(/@keyframes inputGlow/g) || []).length, 0, '关键帧应已删除');
  assert.equal((css.match(/animation:\s*inputGlow/g) || []).length, 0, '引用应已删除');
  /* 焦点反馈改由 focus ring 承担 */
  const wrap = css.slice(css.indexOf('.hero-textarea-wrap {'), css.indexOf('@keyframes slideDown'));
  assert.ok(wrap.includes('var(--sb-focus-ring)'), 'focus 必须用统一焦点环');
  assert.ok(!/animation:/.test(wrap) || !/infinite/.test(wrap), '不得再有无限循环动画');
});

/* ═══ D2（40-decisions）：选中态统一用 ring，不靠加粗边框 ═══ */

test('D2 选中态用 ring，且边框宽度不随状态变化（禁止布局抖动）', () => {
  /* 决策原文：「选中/聚焦统一用 box-shadow: 0 0 0 2px var(--sb-brand-500)
     （token：--sb-shadow-ring），**不改变边框宽度**，从而没有布局抖动」。 */
  const tokens = read('src/styles/design-tokens-v3.css');
  assert.ok(/--sb-shadow-ring:/.test(tokens), 'ring token 必须存在');
  assert.ok(/--sb-focus-ring:\s*var\(--sb-shadow-ring\)/.test(tokens), 'focus ring 复用同一支');

  for (const file of ['SizingPanel', 'StylePanel', 'GenerationConstraintsPanel']) {
    const src = read('src/pages/Home/ec/' + file + '.jsx');
    assert.ok(src.includes('var(--sb-shadow-ring)'), file + ' 的选中态必须使用 ring');
  }

  /* 生成设置面板改用**预置类 .sb-opt**（20-components §0.4 明示优先用它，
     而不是手写内联 style —— 内联会覆盖声明式伪类，正是「hover 与选中长得一样」的成因）。
     ring 由该类的 CSS 提供，故这里断言类被采用 + 预置类本身带 ring。 */
  const gen = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  assert.ok(gen.includes("className={optionClass}"), '生成设置面板的选项应使用 .sb-opt 预置类');
  assert.ok(!/onMouseEnter=/.test(gen), '不应再自造 hover state（伪类由 CSS 承担）');
});

test('D2 预置类 .sb-opt 完整实现状态取色总表（含 selected+hover 持久性）', () => {
  /* 依据 20-components.md §0.4 状态取色总表逐行核对。 */
  const css = read('src/styles/design-tokens-v3.css');
  const block = css.slice(css.indexOf('.sb-opt {'), css.indexOf('.sb-opt__title'));
  assert.ok(/border:\s*1\.5px solid transparent/.test(block), 'default 边框占位（防选中位移）');
  assert.ok(/--sb-l3-option-hover/.test(block), 'hover 只换中性底色');
  assert.ok(
    /\.sb-opt\[aria-pressed="true"\][\s\S]*?box-shadow:\s*var\(--sb-shadow-ring\)/.test(block),
    'selected 必须叠 ring',
  );
  assert.ok(/--sb-sel-bg-hover/.test(block), 'selected+hover 必须只加深底色（持久性）');
  /* hover 规则内不得出现品牌紫（hover ≠ selected 的核心判据） */
  const hoverRule = block.slice(block.indexOf(':hover'), block.indexOf('/* selected'));
  assert.ok(!/--sb-sel-|--sb-brand/.test(hoverRule), 'hover 规则不得出现品牌色');
});

test('D2 任何条件边框的两分支宽度必须相同（否则选中即抖动）', () => {
  const files = ['GenSettingsPanel', 'CopyPanel', 'ParamsPanel', 'SkuPanel', 'SizingPanel', 'GenerationConstraintsPanel', 'StylePanel'];
  const offenders = [];
  for (const f of files) {
    const src = read('src/pages/Home/ec/' + f + '.jsx');
    for (const line of src.split('\n')) {
      const m = line.match(/border:\s*[^,]*?\?(.*?):(.*)$/);
      if (!m) continue;
      const w = seg => (seg.match(/([\d.]+)px\s+(solid|dashed)/) || [])[1];
      const a = w(m[1]); const b = w(m[2]);
      if (a && b && a !== b) offenders.push(f + ' ' + a + 'px vs ' + b + 'px');
    }
  }
  assert.deepEqual(offenders, [], '选中态改了边框宽度（会造成布局抖动）：' + offenders.join(', '));
});

test('D2 hover 只做底色，且与 selected 视觉不同（用户提过三次）', () => {
  /* 内联实现的三个面板：hover 与 selected 必须是不同的 token */
  for (const file of ['SizingPanel', 'StylePanel', 'ParamsPanel']) {
    const src = read('src/pages/Home/ec/' + file + '.jsx');
    assert.ok(src.includes('var(--sb-state-hover-bg)'), file + ' 的 hover 必须只走中性底色 token');
    assert.ok(src.includes('var(--sb-state-selected-bg)'), file + ' 的 selected 必须走品牌浅底 token');
  }
  /* 预置类实现的面板（GenSettingsPanel）：hover 中性、selected 品牌，两条通道值不同 */
  const css = read('src/styles/design-tokens-v3.css');
  const block = css.slice(css.indexOf('.sb-opt {'), css.indexOf('.sb-opt__title'));
  const hover = (block.match(/--sb-l3-option-hover/) || []).length;
  const sel = (block.match(/--sb-sel-bg/) || []).length;
  assert.ok(hover > 0 && sel > 0, '.sb-opt 必须同时定义中性 hover 与品牌 selected');
});

/* ═══ D7（40-decisions）：面板内禁止再套白卡 ═══ */

test('D7 面板内不得用纯白卡做分组容器（只允许控件用白）', () => {
  /* 决策原文：浮层面板内禁止直接放 --sb-surface-card 纯白卡；分组用留白 + 分组标题。
     允许的例外是**控件**（输入框/下拉/按钮/开关圆点）—— 它们本就该是白面。
     判据：白卡所在的容器若是「多子项纵向/网格分组」，即为违规。 */
  const files = ['GenSettingsPanel', 'CopyPanel', 'ParamsPanel', 'SkuPanel', 'SizingPanel', 'GenerationConstraintsPanel', 'StylePanel'];
  const offenders = [];
  for (const f of files) {
    const lines = read('src/pages/Home/ec/' + f + '.jsx').split('\n');
    lines.forEach((l, i) => {
      if (!/--sb-surface-card/.test(l)) return;
      const ctx = lines.slice(Math.max(0, i - 8), i + 1).join(' ');
      const isGroupingContainer = /flexDirection:\s*'column'|gridTemplateColumns/.test(ctx);
      if (isGroupingContainer) offenders.push(f + ':L' + (i + 1));
    });
  }
  assert.deepEqual(offenders, [], '面板内出现白卡分组容器（D7 违规）：' + offenders.join(', '));
});

test('D7 分组一律用留白 + 分组标题（不再靠卡片框出分组）', () => {
  const src = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  assert.ok(src.includes('<GroupTitle'), '分组必须用 GroupTitle 标题分区');
  assert.ok(src.includes('var(--sb-group-gap)'), '分组之间用统一留白');
  /* 分组容器本身不得是白卡 */
  const groupBlocks = src.split('<GroupTitle').slice(1);
  for (const blk of groupBlocks) {
    const head = blk.slice(0, 400);
    assert.ok(!/--sb-surface-card/.test(head), '分组容器不得用纯白卡做底');
  }
});

/* ═══ D6（40-decisions）：圆角只有 4 档 ═══ */

test('D6 六面板圆角只用 20/12/8/6（10px 退役，不出现第三种）', () => {
  const tokens = read('src/styles/design-tokens-v3.css');
  /* 允许 16（卡片）—— 决策原文「16px 用于卡片」。 */
  const allowed = new Set(['20px', '16px', '12px', '8px', '6px', '9999px', '50%']);
  const files = ['GenSettingsPanel', 'CopyPanel', 'ParamsPanel', 'SkuPanel', 'SizingPanel', 'GenerationConstraintsPanel', 'StylePanel'];
  for (const f of files) {
    const src = read('src/pages/Home/ec/' + f + '.jsx');
    /* 数字圆角一律禁止（必须走 token） */
    const numeric = [...src.matchAll(/borderRadius:\s*(\d+)\b/g)].map(m => m[1] + 'px');
    assert.deepEqual(numeric, [], f + ' 仍有数字圆角：' + numeric.join(', '));
    /* 引用的 token 必须落在四档内 */
    const used = [...src.matchAll(/--sb-radius-([a-z0-9]+)/g)].map(m => m[1]);
    for (const name of used) {
      const v = (tokens.match(new RegExp('--sb-radius-' + name + ':[^;]+;')) || [])[0] || '';
      const px = (v.match(/(\d+)px/) || [])[1];
      const alias = (v.match(/var\((--sb-radius-[a-z0-9]+)\)/) || [])[1];
      const resolved = px ? px + 'px'
        : (tokens.match(new RegExp(alias + ':[^;]+;')) || [''])[0].match(/(\d+)px/)?.[0];
      assert.ok(
        resolved === undefined || allowed.has(resolved),
        f + ' 使用了 ' + name + ' → ' + resolved + '，不在 D6 四档内',
      );
    }
  }
});

/* ═══ 原则 6.3：默认态零品牌色 ═══ */

test('原则 6.3 品牌主色调默认未锁定：中性虚线 + 占位「未锁定」', () => {
  const src = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  /* D2：宽度恒定 2px（此前 2px↔1.5px 会抖动），仍是中性虚线且零品牌紫 */
  assert.ok(src.includes('2px dashed var(--sb-border-strong)'), '未锁定用中性虚线描边（恒宽 2px）');
  assert.ok(src.includes('placeholder="未锁定"'), '占位文案与状态一致');
  assert.ok(
    /border:\s*brandLocked\s*\?\s*`2px solid \$\{pickerColor\}`/.test(src),
    '锁定态描边跟随所选颜色本身（不是固定品牌紫）',
  );
});
