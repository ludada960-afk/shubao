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

/* ── CSS 变量解析器（9-18 用户要求）─────────────────────────────────────────
   规范把间距表达成「token 链」：--footer-actions-gap → var(--space-3) → 12px。
   断言必须验证**解析后的值等于 12**，而不是放宽阈值、也不是只匹配 token 名字符串 ——
   否则有人把 --space-3 改成 24px，所有断言都会照常通过（契约被悄悄改掉）。
   实现刻意避开正则转义（用 indexOf 取声明），保证在测试里行为与调试脚本完全一致。 */
const ALL_TOKENS = tokens + '\n' + read('src/styles/design-tokens-v3.css');
function resolveVar(css, name, depth = 0) {
  if (depth > 8) throw new Error('var() 解析层数过深，疑似循环：' + name);
  // 取 'name:' 之后的第一个 ';' 之前的内容
  const at = css.indexOf(name + ':');
  if (at < 0) return null;
  const end = css.indexOf(';', at);
  if (end < 0) return null;
  let value = css.slice(at + name.length + 1, end).trim();
  // 跟随 var(--x) 链（支持 var(--x, fallback)）
  if (value.startsWith('var(')) {
    const inner = value.slice(4, value.lastIndexOf(')')).trim();
    const comma = inner.indexOf(',');
    const ref = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma < 0 ? '' : inner.slice(comma + 1).trim();
    const next = ref.startsWith('--') ? resolveVar(css, ref, depth + 1) : null;
    if (next !== null) return next;
    value = fallback;
  }
  const px = value.match(/^(-?\d+(?:\.\d+)?)px$/);
  return px ? Number(px[1]) : null;
}

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

test('① 按钮间距解析后 = 12px（sp3），且硬下限 ≥ 8px', () => {
  /* 9-18 用户要求：实现已改用 --footer-actions-gap（=12px），
     断言必须验证**解析后的值等于 12**，而不是 token 名字符串、也不是放宽阈值。 */
  const gapPx = resolveVar(ALL_TOKENS, '--footer-actions-gap');
  assert.equal(gapPx, 12, '--footer-actions-gap 解析后必须 = 12px，实际 ' + gapPx);
  const minPx = resolveVar(ALL_TOKENS, '--footer-actions-gap-min');
  assert.ok(minPx !== null && minPx >= 8, '硬下限解析后 ≥ 8px，实际 ' + minPx);
  /* 同时验证它确实走 8pt 阶梯（而不是被写成裸 12px —— 阶梯是规范的组成部分） */
  assert.match(tokens, /--footer-actions-gap:\s*var\(--space-3\)/, '必须引用 --space-3 阶梯');
});

test('② 上间距解析后 = 16px、内边距解析后 20~24px', () => {
  const mt = resolveVar(ALL_TOKENS, '--footer-actions-margin-top');
  assert.equal(mt, 16, '与内容区上间距解析后必须 = 16px，实际 ' + mt);
  const pad = resolveVar(ALL_TOKENS, '--footer-actions-padding-block');
  assert.ok([20, 24].includes(pad), '内边距解析后应为 20 或 24px，实际 ' + pad);
});

test('③ 按钮高度解析后取 32/36/40 之一，最小宽度解析后 88px，文字不换行', () => {
  assert.equal(resolveVar(ALL_TOKENS, '--footer-actions-button-height'), 36, '常规档解析后 = 36px');
  assert.equal(resolveVar(ALL_TOKENS, '--footer-actions-button-height-sm'), 32, '小弹窗档解析后 = 32px');
  assert.equal(resolveVar(ALL_TOKENS, '--footer-actions-button-height-lg'), 40, '大弹窗档解析后 = 40px');
  assert.equal(resolveVar(ALL_TOKENS, '--footer-actions-button-min-width'), 88, '最小宽度解析后 = 88px');
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

test('④ canvas-asset-picker：已改挂契约类，且不再自写 footer 规则（9-18 覆盖面补齐）', () => {
  const jsx = read('src/pages/EcCanvas/components/CanvasAssetPickerModal.jsx');
  assert.ok(jsx.includes('className="ui-modal-footer"'), '容器挂契约类');
  assert.ok(jsx.includes('ui-modal-footer-actions'), '操作区行挂契约类');
  assert.ok(jsx.includes('ui-btn ui-btn-secondary') && jsx.includes('ui-btn ui-btn-primary'), '主次按钮挂契约类');
  /* 关键回归：原先「抄了 token 名但仍自写整套规则」的 7 条 CSS 必须已删除，不留双份真相。 */
  const css = read('src/pages/EcCanvas/components/canvas-asset-picker.css');
  assert.ok(!/\.canvas-asset-picker footer \{/.test(css), '不得再自写 .canvas-asset-picker footer 规则');
  assert.ok(!/\.canvas-asset-picker footer button \{/.test(css), '不得再自写按钮外观');
  assert.ok(!/linear-gradient\(135deg, #7454f3, #d14db5\)/.test(css), '主按钮双色渐变已退役');
});

test('④ 技能库 editor-actions：已改挂契约类，不再自写按钮外观（9-18 覆盖面补齐）', () => {
  const jsx = read('src/pages/Home/ec/SkillLibraryModal.jsx');
  assert.ok(jsx.includes('ui-modal-footer'), '挂契约容器类');
  assert.ok(jsx.includes('ui-modal-footer-actions'), '挂契约操作区类');
  assert.ok(/ui-btn ui-btn-secondary[^>]*>取消编辑/.test(jsx) || jsx.includes('ui-btn ui-btn-secondary'), '次按钮挂契约类');
  assert.ok(jsx.includes('ui-btn ui-btn-primary'), '主按钮挂契约类');
  const css = read('src/pages/Home/ec/skill-library.css');
  assert.ok(!/\.skill-editor-actions \.skill-save-btn,[\s\S]{0,80}\.skill-mini-btn \{/.test(css), '不再自写主次等重规则');
  assert.ok(!/gap: var\(--footer-actions-gap\)/.test(css.split('.skill-editor-actions')[1] || ''), '不再自写 gap（改由契约提供）');
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

test('④ video-plan-footer：已改挂契约类（is-lg 档），主按钮不再是双色渐变', () => {
  const jsx = read('src/pages/VideoStudio/index.jsx');
  assert.ok(/className="ui-modal-footer is-lg video-plan-footer"/.test(jsx), '挂契约容器类 + is-lg 档');
  assert.ok(jsx.includes('ui-modal-footer-actions'), '挂契约操作区类');
  assert.ok(jsx.includes('ui-btn ui-btn-primary'), '主按钮挂契约类');
  const css = read('src/pages/VideoStudio/VideoStudio.css');
  assert.ok(!/\.video-plan-primary \{/.test(css), '自写主按钮规则已删除');
  assert.ok(!/linear-gradient\(135deg,#7454f3,#d14db5\)/.test(css), '双色渐变主按钮已退役（视觉重量失衡根因）');
});

test('④ dw-editor-actions：补上原本缺失的 gap，且禁用态有 cursor', () => {
  const css = read('src/pages/VideoStudio/DirectorWorkbench.css');
  const actions = css.match(/\.dw-editor-actions\{([^}]*)\}/);
  assert.ok(actions, '.dw-editor-actions 规则存在');
  assert.ok(actions[1].includes('gap:var(--footer-actions-gap)'), '原来完全没有 gap 声明，现补 12px');
  const disabled = css.match(/\.dw-save-btn:disabled\{([^}]*)\}/);
  assert.ok(disabled[1].includes('cursor:not-allowed'), '禁用态补 cursor（原来只有 opacity）');
});

/* VPW 导出区本轮**未迁移**：其 JSX 与 CSS 开工时即为 dirty（他人正在改），按批次硬约束跳过。
   记录事实即可，不做会误伤同事改动的强断言。 */
test('④ VPW 导出区：确认仍存在于 JSX（本轮因 dirty 跳过，未强改）', () => {
  const jsx = read('src/pages/VideoStudio/VideoProjectWorkbench.jsx');
  assert.ok(jsx.includes('video-project-export-actions'), '导出操作区仍在（未被本轮误删）');
});

test('④ EcCanvas 导出/方向保存弹窗：底部操作区走统一规范类', () => {
  const src = read('src/pages/EcCanvas/index.jsx');
  const footerCount = (src.match(/className="ui-modal-footer"/g) || []).length;
  assert.ok(footerCount >= 2, '导出弹窗与方向保存弹窗都应挂统一底栏类，实际 ' + footerCount + ' 处');
  const tokens = read('src/styles/design-tokens.css');
  assert.ok(tokens.includes('.ui-btn-primary.is-export:not(:disabled)'), '导出主按钮保留绿色语义（且不覆盖禁用态）');
});
/* ═══════════════════════════════════════════════════════════════════════════
   9-18 追加（P0）：设计组实测「全站早有 footer 契约，但只有 5 个文件用契约类、
   9 个仍在自写 footer，残留 gap 有 8 种」→ 本轮把覆盖面补齐。
   下面锁两件事：① 每个真正的底部操作区都挂了契约类；② 契约的主按钮是**实底纯色**（非渐变）。
   ═══════════════════════════════════════════════════════════════════════════ */

/* 全站「弹窗/抽屉底部操作区」清单（容器是弹窗最后一块 + 提供取消/确认成对动作）。
   注意：视频工作台的 VideoProjectWorkbench / Modals 因**开工时即为 dirty**（他人正在改）
   被本批跳过，不在断言列表内；它们列入下方 TODO 注释，待其落地后补。 */
const FOOTER_HOSTS = [
  ['src/pages/EcCanvas/components/CanvasAssetPickerModal.jsx', '资源选择弹窗'],
  ['src/pages/VideoStudio/index.jsx', '视频方案弹窗'],
  ['src/pages/Home/ec/SkillLibraryModal.jsx', '技能库编辑器'],
  ['src/pages/PublicTemplates/index.jsx', '模板详情弹窗'],
  ['src/pages/Home/ContentResultWorkspace.jsx', '内容结果工作台'],
  ['src/pages/EcCanvas/components/CanvasStudio.jsx', '画布方案/方向/生成器'],
  ['src/pages/EcCanvas/index.jsx', '导出 + 方向保存弹窗'],
  ['src/components/ui/DialogProvider.jsx', '全局二次确认'],
  ['src/components/ProjectAssetPicker.jsx', '资产库选择（通用）'],
  ['src/pages/Plog/index.jsx', 'Plog 结果操作'],
];

test('9-18① 每个底部操作区都必须挂契约类（不得再自写 footer）', () => {
  const missing = FOOTER_HOSTS.filter(([f]) => {
    const src = read(f);
    return !(src.includes('ui-modal-footer') && src.includes('ui-btn'));
  }).map(([f, label]) => label + ' (' + f + ')');
  assert.deepEqual(missing, [], '以下底部操作区仍未接契约类：' + missing.join(' | '));
});

test('9-18② 契约主按钮必须是实底纯色，不得是双色渐变（视觉重量失衡的根因）', () => {
  const tokens = read('src/styles/design-tokens.css');
  const bg = tokens.match(/--footer-actions-primary-bg:\s*([^;]+);/);
  assert.ok(bg, '--footer-actions-primary-bg 存在');
  assert.ok(!/gradient/i.test(bg[1]), '主按钮底色不得为渐变，实际 ' + bg[1].trim());
  assert.ok(/var\(--sb-brand-600\)/.test(bg[1]), '主按钮底色应引用品牌紫 token，实际 ' + bg[1].trim());
  const primary = tokens.match(/\.ui-btn-primary \{([^}]*)\}/);
  assert.ok(!/gradient/i.test(primary[1]), '.ui-btn-primary 不得引入渐变');
});

test('9-18③ 主次按钮视觉等重：同高 / 同最小宽 / 同圆角（圆角不削弱感知间隙）', () => {
  const tokens = read('src/styles/design-tokens.css');
  const uiBtn = tokens.match(/\.ui-btn \{([^}]*)\}/)[1];
  assert.ok(uiBtn.includes('border-radius: var(--footer-actions-radius)'), '主次共用同一圆角 token');
  assert.ok(uiBtn.includes('min-width: var(--footer-actions-button-min-width)'), '主次共用同一最小宽 token');
  assert.ok(uiBtn.includes('height: var(--footer-actions-button-height)'), '主次共用同一高度 token');
  // 10px（--footer-actions-radius）必须存在且相等，不得主次分叉
  assert.equal(resolveVar(ALL_TOKENS, '--footer-actions-radius'), 10, '契约圆角解析后 = 10px');
});

test('9-18④ 迁移过的文件里不得残留自写的底部操作区 gap 魔法数字', () => {
  const offenders = [];
  for (const [f] of FOOTER_HOSTS) {
    const src = read(f);
    // 抓「className 含 ui-modal-footer 的那一行附近又出现 gap: 数字px」的写法
    const re = /className="[^"]*ui-modal-footer[^"]*"[^>]*gap:\s*['"]?(\d+)px/g;
    let m;
    while ((m = re.exec(src))) offenders.push(f + ' gap:' + m[1] + 'px');
  }
  assert.deepEqual(offenders, [], '契约容器上不得再叠自写 gap：' + offenders.join(' | '));
});