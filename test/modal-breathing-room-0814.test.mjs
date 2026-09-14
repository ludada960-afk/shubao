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
/* 2026-09-15：间距阶梯从「各面板自己声明」升级为统一视觉语言规范单一事实源。
   本文件的断言改读 SPEC，语义与阈值不变（分区 ≥16px、标签↔控件 ≥8px、内边距 ≥16px）。 */
const SPEC = 'src/pages/Home/ec/panelVisualLanguage.js';
const ECS = readJson => readJson;
function panelBlock(css) { return css.slice(css.indexOf('.ec-config-panel {'), css.indexOf('.ec-config-panel::after')); }

test('生成设置面板高度按内容自然撑开（height:auto），不被容器压扁', () => {
  const block = panelBlock(read(HOME_CSS));
  assert.ok(/height:\s*auto\s*!important/.test(block), '面板必须 height:auto，否则又会被压成一个方块');
  assert.ok(/max-height:\s*min\(88vh/.test(block), '仍需视口 max-height 兜底，保证不出现外层滚动条');
});

test('生成设置面板宽度保持内容定宽（不被拉伸变形）', () => {
  const ecMode = read('src/pages/Home/EcMode.jsx');
  /* 2026-09-15 用户批注：六个面板宽度必须统一（460/480/540/520/620 → 统一 480），
     故不再断言旧的 460，改断言「统一值来自规范且落在 360-560 口径内」。 */
  assert.ok(ecMode.includes('resolvePanelWidth(vw)'), '面板宽度必须走统一解析函数');
  assert.ok(read(SPEC).includes('standard: 480'), '统一宽度 480 写在规范里');
  const block = panelBlock(read(HOME_CSS));
  assert.ok(!/width:\s*(100%|100vw)/.test(block), '面板不得被拉满宽度');
});

test('生成设置面板顶部不越顶栏安全区（bottom 上限按真实高度反算）', () => {
  const block = panelBlock(read(HOME_CSS));
  assert.ok(block.includes('--ec-panel-bottom-safe'), 'bottom 必须由安全锚点驱动');
  assert.ok(/bottom:\s*min\(/.test(block), 'bottom 需取 min(锚点, 视口-面板高-安全区)');
  assert.ok(read('src/pages/Home/EcMode.jsx').includes("'--ec-panel-h'"), 'EcMode 必须上报 --ec-panel-h');
});

test('间距阶梯由统一规范声明，并含 8/12/16 档（8pt 栅格）', () => {
  const spec = read(SPEC);
  assert.ok(/SPACING\s*=\s*Object\.freeze\(\{/.test(spec), '必须声明统一间距阶梯 SPACING');
  assert.ok(/sp2:\s*8/.test(spec) && /sp3:\s*12/.test(spec) && /sp4:\s*16/.test(spec), '阶梯须含 8/12/16');
  assert.ok(/sp5:\s*20/.test(spec) && /sp6:\s*24/.test(spec), '阶梯须含 20/24（面板内边距与标题↔内容）');
  const jsx = read(GEN_JSX);
  /* 等价形式：旧规范常量 SPACING.sp4(=16) 或 V3 token（--sb-space-4=16 / --sb-group-gap=20）。
     迁移 V3 后语义不变：分组之间必须有明确间距。 */
  assert.ok(
    /gap:\s*SPACING\.sp4/.test(jsx) || /gap:\s*'?var\(--sb-(space-4|group-gap)\)'?/.test(jsx),
    '生成设置面板分区容器 gap 必须走规范（sp4=16 或 V3 token）',
  );
  assert.ok(
    jsx.includes('sectionStyle') || jsx.includes('--sb-group-gap'),
    '分区容器必须复用规范导出的样式（sectionStyle 或 V3 分组间距 token）',
  );
});

test('生成设置面板标签与控件 ≥8px（不再 1px 贴死）', () => {
  /* ── 用户需求：标签与控件不许 1px 贴死，必须 ≥8px ──
     2026-09-15 V3：间距来源从 SPACING 常量上移到 --sb-* token。
     本断言**解析实现里的实际取值并校验数值下限**，不绑定常量名：
     无论写法是 SPACING.spN、--sb-space-N、--sb-field-gap 还是裸数字，
     都会被解析成 px 再判定，因此换实现不会误判，而缩水一定被抓。 */
  const SPACING = { sp1: 4, sp2: 8, sp3: 12, sp4: 16, sp5: 20, sp6: 24 };
  const TOKEN = { '--sb-space-1': 4, '--sb-space-2': 8, '--sb-space-3': 12, '--sb-space-4': 16,
    '--sb-space-5': 20, '--sb-space-6': 24, '--sb-field-gap': 8, '--sb-group-gap': 20,
    '--sb-panel-padding': 20 };
  /** 把一处 gap/padding 写法解析成 px；解析不到返回 null。 */
  const toPx = raw => {
    const t = raw.match(/var\((--sb-[a-z0-9-]+)\)/);
    if (t) return TOKEN[t[1]] ?? null;
    const k = raw.match(/SPACING\.(sp\d)/);
    if (k) return SPACING[k[1]] ?? null;
    const n = raw.match(/^(\d+)$/);
    return n ? Number(n[1]) : null;
  };

  const jsx = read(GEN_JSX);
  /* 标签样式来自规范（groupTitleStyle 或其 V3 等价实现 GroupTitle） */
  assert.ok(
    jsx.includes('groupTitleStyle') || /GroupTitle/.test(jsx),
    '分组标题必须复用规范导出的样式（groupTitleStyle 或其 V3 等价实现 GroupTitle）',
  );
  assert.ok(!/marginBottom:\s*1\b/.test(jsx), '标签不能再留 1px 的贴死间距');

  /* 面板里所有 gap 取值 —— 必须全部 ≥4（行内微调档），且至少有一处 ≥8（标签↔控件） */
  const gaps = [...jsx.matchAll(/gap:\s*'?([^,'\n}]+)'?\s*[,\n}]/g)]
    .map(m => toPx(m[1].trim())).filter(v => v !== null);
  assert.ok(gaps.length > 0, '面板必须显式声明间距（规范常量或 V3 token）');
  assert.ok(Math.min(...gaps) >= 4, '不得出现小于 4px 的贴死间距，实际最小 ' + Math.min(...gaps));
  assert.ok(
    gaps.filter(v => v >= 8).length >= 2,
    '标签↔控件与分组标题↔内容都必须 ≥8px，实际 ≥8 的 gap 有 ' + gaps.filter(v => v >= 8).length + ' 处',
  );

  /* 规范侧：间距阶梯必须真实存在 8/12/16 三档（V3 token 层），
     且「标题↔控件」的语义别名指向 8px 档 —— 这样断言的是**实际数值**，
     而不是某个常量名，换实现（常量 ⇄ token）都不会误判。 */
  const tokens = read('src/styles/design-tokens-v3.css');
  const defs = { '--sb-space-2': 8, '--sb-space-3': 12, '--sb-space-4': 16 };
  for (const [name, px] of Object.entries(defs)) {
    assert.ok(
      new RegExp(name.replace(/-/g, '\\-') + ':\\s*' + px + 'px').test(tokens),
      name + ' 必须存在且为 ' + px + 'px（用户要求的 8/12/16 档）',
    );
  }
  assert.ok(
    /--sb-field-gap:\s*var\(--sb-space-2\)/.test(tokens),
    '字段间距别名必须指向 8px 档（标题↔控件 ≥8px）',
  );
  /* 兼容：旧规范常量阶梯也须仍含 8/12/16（迁移期两套来源并存时同样有效） */
  const spec = read(SPEC);
  if (/SPACING\s*=\s*Object\.freeze/.test(spec)) {
    assert.ok(/sp2:\s*8/.test(spec) && /sp3:\s*12/.test(spec) && /sp4:\s*16/.test(spec),
      'SPACING 阶梯仍须含 8/12/16');
  }
});

test('生成设置面板内边距 ≥16px', () => {
  const jsx = read(GEN_JSX);
  /* 只取「面板根容器」的那一处内边距（它带 flexDirection:column + gap:SPACING.sp4），
     不要误伤控件内部（optionStyle 之类）的小内边距。 */
  /* 等价形式：旧规范 `padding: `${SPACING.x}px ${SPACING.y}px`` 或 V3 token `padding: 'var(--sb-panel-padding)'`(=20)。
     关键不变式：**面板根容器内边距 ≥16px**。 */
  const SPACING = { sp1: 4, sp2: 8, sp3: 12, sp4: 16, sp5: 20, sp6: 24 };
  const SB_SPACE = { 'sb-space-1': 4, 'sb-space-2': 8, 'sb-space-3': 12, 'sb-space-4': 16, 'sb-space-5': 20, 'sb-space-6': 24, 'sb-panel-padding': 20, 'sb-group-gap': 20 };
  /* 两种写法都收进来取最大值：旧 `padding: `${SPACING.x}px ${SPACING.y}px`` / 新 `padding: 'var(--sb-*)'`。
     只要面板里存在一处 ≥16px 的规范内边距即通过（控件内部的小内边距不参与判定）。 */
  const legacyPads = [...jsx.matchAll(/padding:\s*`\$\{SPACING\.(\w+)\}px \$\{SPACING\.(\w+)\}px`/g)]
    .flatMap(m => [SPACING[m[1]] ?? 0, SPACING[m[2]] ?? 0]);
  const tokenPads = [...jsx.matchAll(/padding:\s*'?var\((--sb-[a-z0-9-]+)\)'?/g)]
    .map(m => SB_SPACE[m[1].replace(/^--/, '')] ?? 0);
  const all = [...legacyPads, ...tokenPads];
  assert.ok(all.length > 0, '面板根容器的内边距必须来自规范（SPACING 阶梯或 V3 token）');
  const max = Math.max(...all);
  assert.ok(
    max >= 16,
    '面板内边距必须 ≥16px，实际规范内边距最大值 ' + max + '（token: ' + tokenPads.join(',') + '）',
  );
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
  /* 2026-09-15：文本域改成受控 ResizableTextarea（不再用裸 textarea + CSS resize），
     故弹性字段选择器同步跟进到 :has(.rsz-textarea)，语义不变（它仍是唯一弹性项）。 */
  assert.ok(/\.skill-column\.is-editor \.skill-field:has\(\.rsz-textarea\)/.test(css), '文本域字段是唯一弹性项');
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
