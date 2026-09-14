// test/footer-actions-contract.test.mjs
// 2026-09-16 用户批注：「然后你这两个按钮做的这么近也很奇怪啊。你似乎没有一个全局的意识呀。」
// 用户骂的不是某一个弹窗，而是**全站没有统一的底部操作区规范**：
// 实测各处 gap 从 6px 到 12px 都有、内边距 8~14px 不等、按钮高度 30~38px 不等。
// 这个测试把规范锁死，防止以后又有人随手写 4px / 6px。
//
// 规范（唯一真源 = src/styles/design-tokens.css 的 --footer-actions-*）：
//   ① 按钮间距 12px（8pt 阶梯 sp3），硬下限 8px —— 不得贴近；
//   ② 操作区与内容区上间距 16px；操作区到底部内边距 20~24px；
//   ③ 按钮高度 32/36/40 之一，最小宽度 88px，文字不换行；
//   ④ 排列：次要（取消/关闭）左、主要（确认/加入）右；
//   ⑤ 主次按钮宽度/高度/圆角视觉等重；
//   ⑥ 主按钮禁用态有明确底色 + 文字色 + cursor，不是只变灰看不清。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const tokens = read('src/styles/design-tokens.css');

/* ── ① 规范本身落在共享常量文件里（不是散落各处的魔法数字） ── */
test('① 底部操作区规范沉淀在 design-tokens.css（唯一的真源）', () => {
  for (const token of [
    '--footer-actions-gap', '--footer-actions-gap-min', '--footer-actions-margin-top',
    '--footer-actions-padding-block', '--footer-actions-padding-inline',
    '--footer-actions-button-height', '--footer-actions-button-height-sm', '--footer-actions-button-height-lg',
    '--footer-actions-button-min-width', '--footer-actions-radius',
    '--footer-actions-primary-disabled-bg', '--footer-actions-primary-disabled-text',
  ]) {
    assert.ok(tokens.includes(token + ':'), '缺少规范常量 ' + token);
  }
});

test('① 按钮间距 = 12px（sp3），且硬下限 ≥ 8px', () => {
  const gap = tokens.match(/--footer-actions-gap:\s*var\(--space-(\d+)\)/);
  assert.ok(gap, '--footer-actions-gap 必须引用 --space-N 阶梯（不得写裸 px）');
  assert.equal(gap[1], '3', '--footer-actions-gap 应引用 --space-3 = 12px，实际 --space-' + gap[1]);
  const min = tokens.match(/--footer-actions-gap-min:\s*var\(--space-(\d+)\)/);
  assert.ok(min, '缺少硬下限常量');
  assert.ok(Number(min[1]) >= 2, '硬下限不得小于 --space-2 = 8px');
  // 断言 --space-3 真的是 12px（防止有人改阶梯值把契约悄悄改掉）
  assert.match(tokens, /--space-3:\s*12px/, '--space-3 必须是 12px');
});

test('② 上间距 16px、内边距 20~24px', () => {
  assert.match(tokens, /--footer-actions-margin-top:\s*var\(--space-4\)/, '与内容区上间距 = --space-4 = 16px');
  assert.match(tokens, /--space-4:\s*16px/, '--space-4 必须是 16px');
  const pad = tokens.match(/--footer-actions-padding-block:\s*var\(--space-(\d+)\)/);
  assert.ok(pad, '缺少内边距常量');
  assert.ok(['5', '6'].includes(pad[1]), '内边距应为 --space-5(20px) 或 --space-6(24px)，实际 --space-' + pad[1]);
});

test('③ 按钮高度取 32/36/40 之一，最小宽度 88px，文字不换行', () => {
  for (const h of ['--footer-actions-button-height: 36px', '--footer-actions-button-height-sm: 32px', '--footer-actions-button-height-lg: 40px']) {
    assert.ok(tokens.includes(h), '缺少高度常量 ' + h);
  }
  assert.match(tokens, /--footer-actions-button-min-width:\s*88px/, '最小宽度 88px');
  const uiBtn = tokens.match(/\.ui-btn \{([^}]*)\}/);
  assert.ok(uiBtn, '.ui-btn 基础规则存在');
  assert.ok(uiBtn[1].includes('white-space: nowrap'), '文字不换行');
  assert.ok(uiBtn[1].includes('min-width: var(--footer-actions-button-min-width)'), '.ui-btn 吃最小宽度常量');
  assert.ok(uiBtn[1].includes('height: var(--footer-actions-button-height)'), '.ui-btn 吃高度常量');
});

test('⑤ 主次按钮视觉等重：同高、同圆角、同最小宽度（只有配色与字重区分）', () => {
  const secondary = tokens.match(/\.ui-btn-secondary \{([^}]*)\}/);
  const primary = tokens.match(/\.ui-btn-primary \{([^}]*)\}/);
  assert.ok(secondary && primary, '主/次按钮规则都存在');
  // 两者都只覆盖配色/边框，不覆盖 height/min-width/border-radius —— 等重由 .ui-btn 统一保证
  for (const [name, rule] of [['secondary', secondary[1]], ['primary', primary[1]]]) {
    assert.ok(!/height:/.test(rule), name + ' 不得单独覆盖 height（会破坏等重）');
    assert.ok(!/min-width:/.test(rule), name + ' 不得单独覆盖 min-width（会破坏等重）');
    assert.ok(!/border-radius:/.test(rule), name + ' 不得单独覆盖 border-radius（会破坏等重）');
  }
});

test('⑥ 主按钮禁用态：明确底色 + 文字色 + cursor，不靠 opacity 变灰', () => {
  assert.match(tokens, /--footer-actions-primary-disabled-bg:\s*#e5e3e0/, '禁用底色明确');
  assert.match(tokens, /--footer-actions-primary-disabled-text:\s*#a8a39e/, '禁用文字色明确');
  const disabled = tokens.match(/\.ui-btn:disabled,[\s\S]*?\{([^}]*)\}/);
  assert.ok(disabled, '.ui-btn:disabled 规则存在');
  assert.ok(disabled[1].includes('background: var(--footer-actions-primary-disabled-bg)'), '禁用有明确底色');
  assert.ok(disabled[1].includes('color: var(--footer-actions-primary-disabled-text)'), '禁用有明确文字色');
  assert.ok(disabled[1].includes('cursor: not-allowed'), '禁用有 cursor');
  assert.ok(!/opacity:\s*0?\.[0-9]/.test(disabled[1]), '不靠 opacity 变灰（那样会看不清）');
});

/* ── ② 分布：底部操作区容器本身 ── */
test('操作区容器 .ui-modal-footer 用规范值，且操作区内部 gap 恒为 12px', () => {
  const footer = tokens.match(/\.ui-modal-footer \{([^}]*)\}/);
  assert.ok(footer, '.ui-modal-footer 规则存在');
  assert.ok(footer[1].includes('gap: var(--footer-actions-gap)'), '容器 gap 吃规范');
  assert.ok(footer[1].includes('margin-top: var(--footer-actions-margin-top)'), '上间距吃规范');
  assert.ok(footer[1].includes('padding: var(--footer-actions-padding-block) var(--footer-actions-padding-inline)'), '内边距吃规范');
  const actions = tokens.match(/\.ui-modal-footer-actions \{([^}]*)\}/);
  assert.ok(actions, '.ui-modal-footer-actions 规则存在');
  assert.ok(actions[1].includes('gap: var(--footer-actions-gap)'), '按钮间距吃规范');
  assert.ok(actions[1].includes('justify-content: flex-end'), '次要左、主要右（容器 space-between + 本行右对齐）');
});

/* ── ③ 已迁移的具体弹窗 ── */
test('从资产库选择（ProjectAssetPicker）：底部改用统一规范类，不再写魔法数字', () => {
  const picker = read('src/components/ProjectAssetPicker.jsx');
  assert.ok(picker.includes('className="ui-modal-footer"'), '挂统一底部操作区类');
  assert.ok(picker.includes('className="ui-modal-footer-actions"'), '挂统一操作区行类');
  assert.ok(picker.includes('ui-btn ui-btn-secondary'), '次要按钮用统一类（取消，在左）');
  assert.ok(picker.includes('ui-btn ui-btn-primary'), '主要按钮用统一类（确定，在右）');
  // 关键回归：不得再回到「gap: 8」这种贴近写法
  assert.ok(!/display: 'flex', gap: 8 \}\}>\s*\n\s*<button[^>]*取消/.test(picker), '不得再写 gap: 8 的贴近按钮行');
  // 次要在前、主要在后
  const order = picker.indexOf('ui-btn-secondary') < picker.indexOf('ui-btn-primary');
  assert.ok(order, '次要（取消）在左、主要（确定使用）在右');
});

test('从资产库选择：主按钮禁用态有明确表达（disabled 属性 + 统一禁用样式）', () => {
  const picker = read('src/components/ProjectAssetPicker.jsx');
  assert.ok(picker.includes('disabled={!selected.length}'), '未选中时禁用主按钮');
  // 禁用样式由 .ui-btn:disabled 统一提供（上面已断言），此处确认没有内联覆盖禁用配色
  assert.ok(!/selected\.length \? '#7c3aed' : '#ddd'/.test(picker), '不再内联写禁用底色（改用统一 token）');
});
/* ── ④ 全站同类排查后的迁移清单（用户骂的是「全局意识」，不是这一个弹窗） ──
   下面每一处都曾被实测出偏离规范的魔法数字，迁到统一规范后在这里锁死，防止回退。
   实测偏离记录（改前 → 改后）：
     ProjectAssetPicker    gap 8  / 34px / 上间距无 / 底 16px
     canvas-asset-picker   gap 内层未声明 / 36px / 底 12px
     技能库 editor-actions  gap 8  / 主次不等高(9px vs 5px 纵向 padding) / 上间距 4px / 底 4px
     DialogProvider 确认     gap 8  / 38px / 禁用态外观零变化 + cursor: pointer
     video-plan-footer     gap 8  / 38px
     VPW export-actions    gap 10 / 36px / 全左对齐 / 禁用态仅 opacity
     dw-editor-actions     gap 未声明 / 无固定高 / 上间距 4px / 禁用态无 cursor
     EcCanvas 导出          gap 8  / padding 13/13/16 不一致
     EcCanvas 方向保存       gap 8  / padding 14/16 不一致 */

test('④ ProjectAssetPicker：底部操作区走统一规范类', () => {
  const src = read('src/components/ProjectAssetPicker.jsx');
  assert.ok(src.includes('className="ui-modal-footer"'), '挂统一底栏类');
  assert.ok(src.includes('className="ui-modal-footer-actions"'), '挂统一操作区行类');
  assert.ok(src.includes('ui-btn ui-btn-secondary') && src.includes('ui-btn ui-btn-primary'), '主次按钮用统一类');
});

test('④ canvas-asset-picker：footer 显式 12px 间距 + 按钮吃统一 token', () => {
  const css = read('src/pages/EcCanvas/components/canvas-asset-picker.css');
  const footer = css.match(/\.canvas-asset-picker footer \{([^}]*)\}/);
  assert.ok(footer, 'footer 规则存在');
  assert.ok(footer[1].includes('gap: var(--footer-actions-gap)'), '按钮间距吃规范（原来内层无 gap 声明）');
  assert.ok(footer[1].includes('padding: 16px 22px var(--footer-actions-padding-block)'), '底内边距吃规范 20px');
  const inner = css.match(/\.canvas-asset-picker footer > div \{([^}]*)\}/);
  assert.ok(inner && inner[1].includes('gap: var(--footer-actions-gap)'), '内层按钮组显式 12px');
  const btn = css.match(/\.canvas-asset-picker footer button \{([^}]*)\}/);
  assert.ok(btn[1].includes('height: var(--footer-actions-button-height)'), '按钮高度吃规范');
  assert.ok(btn[1].includes('min-width: var(--footer-actions-button-min-width)'), '最小宽度吃规范');
  assert.ok(btn[1].includes('border-radius: var(--footer-actions-radius)'), '圆角吃规范');
});

test('④ 技能库 editor-actions：主次等重 + 间距/留白对齐规范', () => {
  const css = read('src/pages/Home/ec/skill-library.css');
  /* 注意：文件里还有 ".skill-column.is-editor .skill-editor-actions { flex: none; }" 这种组合选择器，
     必须锚定行首的裸 .skill-editor-actions，否则匹配到的是它。 */
  const actions = css.match(/^\.skill-editor-actions \{([^}]*)\}/m);
  assert.ok(actions, '.skill-editor-actions 基础规则存在');
  assert.ok(actions[1].includes('gap: var(--footer-actions-gap)'), '按钮间距 12px（原 8px）');
  assert.ok(actions[1].includes('margin-top: var(--footer-actions-margin-top)'), '上间距 16px（原 4px）');
  // 主次等重：两个按钮同吃统一高度/最小宽/圆角
  const both = css.match(/\.skill-editor-actions \.skill-save-btn,\s*\n\.skill-editor-actions \.skill-mini-btn \{([^}]*)\}/);
  assert.ok(both, '主次按钮共用一条等重规则（原来一个 9/16 padding、一个 5/9，实测差 8px）');
  assert.ok(both[1].includes('height: var(--footer-actions-button-height)'), '同高');
  assert.ok(both[1].includes('min-width: var(--footer-actions-button-min-width)'), '同最小宽');
  assert.ok(both[1].includes('border-radius: var(--footer-actions-radius)'), '同圆角');
});

test('④ DialogProvider 二次确认：启用统一底栏 + 禁用态有明确表达', () => {
  const src = read('src/components/ui/DialogProvider.jsx');
  assert.ok(src.includes('className="ui-modal-footer"'), '底栏挂统一类');
  assert.ok(src.includes('ui-btn ui-btn-secondary') && src.includes('ui-btn ui-btn-primary'), '主次按钮用统一类');
  /* 最关键的一条：确认按钮 disabled 时原来外观零变化（深色实心 + cursor: pointer） */
  assert.ok(src.includes('disabled={dialog.kind === \'text\' && !dialog.value.trim()}'), '空输入时禁用确认按钮');
  assert.ok(!/background: '#1f2937'[^}]*cursor: 'pointer'[^}]*\}>\.\{dialog\.confirmLabel\}/.test(src), '不再内联写死主按钮外观');
  const tokens = read('src/styles/design-tokens.css');
  assert.ok(tokens.includes('.ui-btn-primary.is-dark:not(:disabled)'), '近黑变体用 :not(:disabled) 排除禁用态（避免权重覆盖掉禁用样式）');
});

test('④ video-plan-footer：间距 12px + 按钮 40px 档 + 最小宽/圆角统一', () => {
  const css = read('src/pages/VideoStudio/VideoStudio.css');
  const footer = css.match(/\.video-plan-footer > div \{([^}]*)\}/);
  assert.ok(footer && footer[1].includes('gap: var(--footer-actions-gap)'), '按钮间距 12px（原 8px）');
  const btn = css.match(/\.video-plan-footer button \{([^}]*)\}/);
  assert.ok(btn[1].includes('height: var(--footer-actions-button-height-lg)'), '按钮走 40px 档（原来 38px 游离值）');
  assert.ok(btn[1].includes('min-width: var(--footer-actions-button-min-width)'), '最小宽度吃规范');
});

test('④ dw-editor-actions：补上原本缺失的 gap，且禁用态有 cursor', () => {
  const css = read('src/pages/VideoStudio/DirectorWorkbench.css');
  const actions = css.match(/\.dw-editor-actions\{([^}]*)\}/);
  assert.ok(actions, '.dw-editor-actions 规则存在');
  assert.ok(actions[1].includes('gap:var(--footer-actions-gap)'), '原来完全没有 gap 声明，现补 12px');
  const disabled = css.match(/\.dw-save-btn:disabled\{([^}]*)\}/);
  assert.ok(disabled[1].includes('cursor:not-allowed'), '禁用态补 cursor（原来只有 opacity）');
});

test('④ VPW 导出区：间距 12px + 右对齐 + 禁用态有明确底色', () => {
  const css = read('src/pages/VideoStudio/VideoProjectWorkbench.css');
  const actions = css.match(/\.video-project-export-actions \{([^}]*)\}/);
  assert.ok(actions[1].includes('gap: var(--footer-actions-gap)'), '按钮间距 12px（原 10px）');
  assert.ok(actions[1].includes('justify-content: flex-end'), '补上右对齐（原来全部左对齐）');
  const disabled = css.match(/\.video-project-export-actions button:disabled \{([^}]*)\}/);
  assert.ok(disabled[1].includes('var(--footer-actions-primary-disabled-bg)'), '禁用态改明确底色（原来只 opacity）');
});

test('④ EcCanvas 导出/方向保存弹窗：底部操作区走统一规范类', () => {
  const src = read('src/pages/EcCanvas/index.jsx');
  const footerCount = (src.match(/className="ui-modal-footer"/g) || []).length;
  assert.ok(footerCount >= 2, '导出弹窗与方向保存弹窗都应挂统一底栏类，实际 ' + footerCount + ' 处');
  const tokens = read('src/styles/design-tokens.css');
  assert.ok(tokens.includes('.ui-btn-primary.is-export:not(:disabled)'), '导出主按钮保留绿色语义（且不覆盖禁用态）');
});
