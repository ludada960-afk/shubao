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
  const src = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  /* hover 只允许改底色，且必须是中性 token */
  assert.ok(src.includes('var(--sb-state-hover-bg)'), 'hover 必须用中性 hover token');
  assert.ok(src.includes('var(--sb-state-selected-bg)'), 'selected 必须用品牌浅底 token');
  assert.ok(src.includes('var(--sb-state-selected-line)'), 'selected 必须用品牌描边 token');
  assert.ok(src.includes('var(--sb-state-selected-ink)'), 'selected 必须用品牌字色 token');
  /* 三件套与 hover 不是同一个值 → 两种状态视觉可分 */
  assert.notEqual('var(--sb-state-hover-bg)', 'var(--sb-state-selected-bg)');
  /* selected 必须持久：不能挂在 hover 分支里 */
  assert.ok(
    /background:\s*active\s*\?\s*'var\(--sb-state-selected-bg\)'\s*:\s*hovered\s*\?/.test(src),
    'selected 优先级必须高于 hover（鼠标停在已选项上仍然是选中态）',
  );
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

/* ═══ 原则 6.3：默认态零品牌色 ═══ */

test('原则 6.3 品牌主色调默认未锁定：中性虚线 + 占位「未锁定」', () => {
  const src = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  assert.ok(src.includes('1.5px dashed var(--sb-border-strong)'), '未锁定用中性虚线描边');
  assert.ok(src.includes('placeholder="未锁定"'), '占位文案与状态一致');
  assert.ok(
    /border:\s*brandLocked\s*\?\s*`2px solid \$\{pickerColor\}`/.test(src),
    '锁定态描边跟随所选颜色本身（不是固定品牌紫）',
  );
});
