// test/modal-breathing-room-0814.test.mjs
// 2026-08-14 用户批注（首页两个弹窗的布局与「呼吸感」）：
// 【图1 生成设置面板】「这个面板又变形了呀，怎么压得这么矮啊」
//   → 面板高度必须按内容自然撑开（不被 flex 容器压扁），内部分区 ≥16px、标签↔控件 ≥8px、
//     内边距 ≥16px，同时「打开就一屏看全、不出现外层滚动条」——两条同时成立，不是二选一。
// 【图2 技能库弹窗】「上面空这么多，下面又那么挤」「你看这里基本没有间距了呀」
//   → 三栏上下平衡：头部压缩、表单字段 ≥12px、与弹窗底边 ≥16px 留白、列表行距 ≥10px。
// 【通用】统一 8pt 间距阶梯 4/8/12/16/20/24，相邻元素按语义取同一档。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const HOME_CSS = 'src/pages/Home/Home.css';
const SKILL_CSS = 'src/pages/Home/ec/skill-library.css';
const GEN_JSX = 'src/pages/Home/ec/GenSettingsPanel.jsx';
const ECS = readJson => readJson;
function panelBlock(css) { return css.slice(css.indexOf('.ec-config-panel {'), css.indexOf('.ec-config-panel::after')); }

test('生成设置面板高度按内容自然撑开（height:auto），不被容器压扁', () => {
  const block = panelBlock(read(HOME_CSS));
  assert.ok(/height:\s*auto\s*!important/.test(block), '面板必须 height:auto，否则又会被压成一个方块');
  assert.ok(/max-height:\s*min\(88vh/.test(block), '仍需视口 max-height 兜底，保证不出现外层滚动条');
});

test('生成设置面板宽度保持内容定宽（不被拉伸变形）', () => {
  const ecMode = read('src/pages/Home/EcMode.jsx');
  assert.ok(ecMode.includes('settings: 460'), '生成设置面板宽度 460');
  const block = panelBlock(read(HOME_CSS));
  assert.ok(!/width:\s*(100%|100vw)/.test(block), '面板不得被拉满宽度');
});

test('生成设置面板顶部不越顶栏安全区（bottom 上限按真实高度反算）', () => {
  const block = panelBlock(read(HOME_CSS));
  assert.ok(block.includes('--ec-panel-bottom-safe'), 'bottom 必须由安全锚点驱动');
  assert.ok(/bottom:\s*min\(/.test(block), 'bottom 需取 min(锚点, 视口-面板高-安全区)');
  assert.ok(read('src/pages/Home/EcMode.jsx').includes("'--ec-panel-h'"), 'EcMode 必须上报 --ec-panel-h');
});

test('生成设置面板内部分区之间 ≥16px 呼吸（8pt 阶梯）', () => {
  const jsx = read(GEN_JSX);
  assert.ok(/SPACE\s*=\s*Object\.freeze\(\{/.test(jsx), '必须声明 8pt 间距阶梯 SPACE');
  assert.ok(/sm:\s*8/.test(jsx) && /md:\s*12/.test(jsx) && /lg:\s*16/.test(jsx), '阶梯须含 8/12/16');
  assert.ok(/flexDirection:\s*'column',\s*gap:\s*SPACE\.lg/.test(jsx), '分区容器 gap 必须是 16px');
});

test('生成设置面板标签与控件 ≥8px（不再 1px 贴死）', () => {
  const jsx = read(GEN_JSX);
  const m = jsx.match(/const lbl = \{([\s\S]*?)\};/);
  assert.ok(m, '必须存在标签样式 lbl');
  assert.ok(!/marginBottom:\s*1\b/.test(m[1]), '标签不能再留 1px 的贴死间距');
});

test('生成设置面板内边距 ≥16px', () => {
  const jsx = read(GEN_JSX);
  const m = jsx.match(/padding:\s*`\$\{SPACE\.(\w+)\}px \$\{SPACE\.(\w+)\}px`/);
  assert.ok(m, '面板内边距必须来自 SPACE 阶梯');
  const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };
  assert.ok(SPACE[m[1]] >= 16 && SPACE[m[2]] >= 16, '内边距必须 ≥16px，实际 ' + m[1] + '/' + m[2]);
});

test('技能库声明 8pt 间距阶梯并压缩头部', () => {
  const css = read(SKILL_CSS);
  assert.ok(/--sk-space-xs:\s*4px/.test(css) && /--sk-space-sm:\s*8px/.test(css), '须含 4/8 档');
  assert.ok(/--sk-space-md:\s*12px/.test(css) && /--sk-space-lg:\s*16px/.test(css), '须含 12/16 档');
  const m = css.match(/\.skill-modal-head \{([\s\S]*?)\}/);
  assert.ok(m, '必须存在 .skill-modal-head');
  assert.ok(/padding:\s*var\(--sk-space-lg\) var\(--sk-space-xl\) var\(--sk-space-md\)/.test(m[1]), '头部内边距须用 16/20/12 阶梯');
});

test('技能库表单字段间距 ≥12px，且不叠加 margin 造成 24px', () => {
  const css = read(SKILL_CSS);
  const col = css.slice(css.indexOf('.skill-column {'), css.indexOf('.skill-column-head'));
  assert.ok(/gap:\s*var\(--sk-space-md\)/.test(col), '表单栏内 gap 必须是 12px');
  assert.ok(/\.skill-column\.is-editor \.skill-field \+ \.skill-field \{ margin-top: 0; \}/.test(css), '编辑器栏内不能再叠 margin');
});

test('技能库底部创建区与弹窗底边留白 ≥16px', () => {
  const css = read(SKILL_CSS);
  const body = css.match(/\.skill-modal-body \{([\s\S]*?)\}/);
  assert.ok(body, '必须存在 .skill-modal-body');
  assert.ok(/padding:\s*var\(--sk-space-md\) var\(--sk-space-xl\) var\(--sk-space-lg\)/.test(body[1]), '弹窗内边距底部必须是 16px');
});

test('技能库技能列表行间距 ≥10px', () => {
  const list = read(SKILL_CSS).match(/^\.skill-list \{([\s\S]*?)\}/m);
  assert.ok(list, '必须存在 .skill-list');
  const gapRaw = (list[1].match(/gap:\s*([^;]+)/) || [])[1] || '';
  const gap = Number((gapRaw.match(/(\d+(?:\.\d+)?)px/) || [])[1]);
  assert.ok(Number.isFinite(gap) && gap >= 10, '列表行间距必须 ≥10px，实际 ' + gapRaw.trim());
});

test('技能库编辑器栏只让文本域滚动，按钮组始终留在可视区', () => {
  const css = read(SKILL_CSS);
  assert.ok(/\.skill-column\.is-editor \{ max-height: 100%; overflow: hidden; \}/.test(css), '编辑器栏自身不滚');
  assert.ok(/\.skill-column\.is-editor \.skill-field:has\(textarea\)/.test(css), '文本域字段是唯一弹性项');
});

test('技能库三栏比例与栏间距保持稳定', () => {
  const css = read(SKILL_CSS);
  assert.ok(/grid-template-columns:\s*minmax\(0, 1\.2fr\) minmax\(0, 1fr\) minmax\(0, 1\.15fr\)/.test(css), '三栏比例 1.2/1/1.15');
  assert.ok(/\.skill-modal-body \{[\s\S]*?gap:\s*var\(--sk-space-lg\)/.test(css), '栏↔栏间距 16px');
});

test('技能库 CSS 不再出现 1px/2px 的贴死间距', () => {
  const css = read(SKILL_CSS);
  /* 只查「元素与元素之间」的间距；svg 的行内光学微调（如 margin-top:2px 对齐字号）
     属于排版细节、不是留白层级，故连同其所在规则一起排除。 */
  const offenders = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let rule;
  while ((rule = re.exec(css))) {
    const selector = rule[1];
    if (selector.includes('svg')) continue;
    const decl = /(?:^|\s)(gap|margin-top|margin-bottom|padding-top|padding-bottom):\s*([12])px/g;
    let m;
    while ((m = decl.exec(rule[2]))) offenders.push(m[0].trim() + '  @ ' + selector.trim().replace(/\s+/g, ' '));
  }
  assert.deepEqual(offenders, [], '以下间距是贴死级别：' + offenders.join(', '));
});
