// test/canvas-popover-anchor-authority-0920.test.mjs
// 2026-09-20 用户批注（提过三四次）：「面板依然是歪到左边去，然后依然是盖住了我们现在的素材」
// ─────────────────────────────────────────────────────────────────────────────
// 实测根因（Playwright，1440 缩放 0.68，点节点右侧「+」，修复前）：
//   菜单矩形 left=10   ← 被甩到画布最左
//   触发按钮 left=683  ← 本应锚在这里
//   菜单 style: left=-717.118px（世界坐标）
//   祖先 transform: matrix(0.68,0,0,0.68,497.64,24.4)  ← 菜单在缩放层内
// 根因：clampCanvasPickerPosition 把 **像素** 口径的 bounds.width / reservedRight
//       除以 scale 当 **世界坐标** 用（两套坐标系混用）。右侧面板一开
//       （reservedRight=508）可用宽度被砍到 ~197px，maxX 塌到锚点左边极远处。
// 修法：派生菜单改走画布唯一权威 CanvasPopoverPortal（portal 到 body + 视口像素定位）。
// ─────────────────────────────────────────────────────────────────────────────
// 口径（用户已确认，不可协商）：
//   ① 锚在触发元素上**向右展开**；
//   ② 右侧空间不足时**向下展开**，**绝不向左翻**；
//   ③ 面板矩形与源节点矩形**零相交**；
//   ④ 全画布弹层必须引用统一定位权威，不许各写各的绝对定位。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(path.join(ROOT, p), 'utf8');
const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
const index = read('src/pages/EcCanvas/index.jsx');
const vlang = read('src/pages/EcCanvas/canvasVisualLanguage.js');
const chrome = read('src/pages/EcCanvas/components/CanvasChrome.jsx');

test('① 定位权威必须提供 place="right"（锚触发元素向右展开）', () => {
  assert.match(studio, /export function CanvasPopoverPortal\(\{[^}]*place = 'above'/,
    'CanvasPopoverPortal 必须暴露 place 参数');
  assert.match(studio, /if \(place === 'right'\)/, '必须实现 right 分支');
  /* 向右展开的**算法**只有一份，在 canvasVisualLanguage.resolveAnchoredRight；
     portal 必须复用它，不得自己再写一套坐标计算（那正是坐标系分裂的来源）。 */
  assert.match(studio, /resolveAnchoredRight\(\{/, 'portal 的 right 分支必须复用共用规则');
  assert.match(vlang, /export function resolveAnchoredRight\(/, '共用规则必须存在');
  assert.match(vlang, /anchor\.right\s*\?[\s\S]{0,80}?\+\s*gap|\+\s*gap/, '左缘必须 = 锚点右缘 + 间距');
});

test('② 共用规则：右展开**不许出现向左翻**（左缘不得越过锚点左缘）', () => {
  const start = vlang.indexOf('export function resolveAnchoredRight(');
  assert.ok(start > 0, '必须能找到 resolveAnchoredRight');
  const body = vlang.slice(start, start + 1400);
  assert.doesNotMatch(body, /anchor\.x\s*-\s*width/, '不得把面板放到锚点左侧（那就是「向左翻」）');
  /* 只允许向右/向下：水平取 max(左边界, min(期望右展开位, 右边界))，因此永不为负偏移 */
  assert.match(body, /Math\.max\(gutter,\s*Math\.min\(wanted,\s*maxLeft\)\)/, '水平必须左界回夹到 gutter（不出屏）');
  assert.match(body, /const maxTop = Math\.max\(gutter, vh - height - gutter\)/, '竖直必须用视口下界回夹');
  /* 回夹**只能**改变左右边界内的位置，不允许变为「锚点左侧」 */
  assert.match(body, /clampedRight:/, '必须报告是否发生右回夹（供断言与排查）');
});

test('③ 派生菜单（引用当前素材）必须走统一权威，不再自算世界坐标', () => {
  /* 修复前它是 .ec-canvas-derive-menu + position 世界坐标；现在是 portal 组件 */
  assert.match(studio, /export function CanvasDeriveMenu\(\{[^}]*anchorRect/,
    'CanvasDeriveMenu 必须接收视口矩形 anchorRect');
  assert.match(studio, /<CanvasPopoverPortal open anchor=\{anchorRect\} place="right" className="ec-canvas-derive-menu"/,
    '派生菜单必须经 CanvasPopoverPortal 渲染并声明 place="right"');
  /* 反向断言：不得再接收/使用世界坐标 position */
  assert.doesNotMatch(studio, /CanvasDeriveMenu\(\{[^}]*\bposition\b/, '不得再接收 position（世界坐标）');
});

test('④ 调用方必须传**触发元素的视口矩形**（不是 toWorldPoint 的世界坐标）', () => {
  assert.match(index, /const portEl = event\?\.currentTarget/, '必须取触发元素');
  assert.match(index, /const rect = portEl\?\.getBoundingClientRect\?\.\(\)/, '必须量它的视口矩形');
  assert.match(index, /anchorRect: rect[\s\S]{0,200}right: rect\.right/, 'anchorRect 必须含 right（右展开依赖它）');
  assert.match(index, /anchorRect=\{connectionPicker\.anchorRect\}/, '必须把 anchorRect 传下去');
});

test('⑤ 防回退：clampCanvasPickerPosition 不得再被派生菜单使用（坐标系混用的来源）', () => {
  const callSite = index.slice(index.indexOf('<CanvasDeriveMenu'), index.indexOf('<CanvasDeriveMenu') + 700);
  assert.doesNotMatch(callSite, /clampCanvasPickerPosition\(/, '派生菜单不得再调用世界坐标版本的 clamp');
});

test('⑥ 图层面板：几何**与水印面板同源**（贴底靠左），不再向右展开 —— 2026-10-01 推翻 09-20 口径', () => {
  /* 用户 2026-10-01 原话（逐字）：
     「你这个图层按钮为什么打开之后的面板是这么高呀？照理说应该是当前画布里面有多少素材，
       它就张开多少……当只有一个素材的时候，它应该整块都出现在最下面呀。它整体应该是
       **吸附在图层这个按钮上面**的，而不是悬空的。然后当素材更多的时候，他就慢慢的往上面去延展呀。
       还有就是你这个图层为什么没有往左边靠呢？……你看一下下面不是有一个**水印面板**吗？
       他是比较靠左一些的，你要照他那样子往左边靠一些，然后只要不遮住那个加号和生成进度那两个按钮就行了」

     ⚠️ 这条**推翻了本文件 2026-09-20 的口径**（当时 ⑥ 写的是「必须锚在触发元素上向右展开」）。
       推翻的理由**不是**「右展开不好」，而是**前提已经不成立**：
       09-20 那条的实测依据是「触发按钮在 x=775，而面板出现在 x=72 —— 离触发元素 700px 外」。
       而批 CY-㊴ 之十三（`b163a327`，已上线 `20261001-183428-3481d8a4`）把「图层」入口从
       **底部 dock** 搬到了**左下角缩放条的 trailing 槽** —— 触发元素现在就在左边，
       贴底靠左才是对的，向右展开反而会把面板甩到画面中间（用户说的「悬空」）。

     ⇒ 判据从「有没有走共用右展开规则」改成「**几何与水印面板同源**」——
       这正是用户那句「你要照他那样子」。钉**同源**比钉某一行写法耐改：
       两个面板一起微调时它不会红，而任何一边单独漂移它都会红。 */

  const code = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
  const css = read('src/pages/EcCanvas/EcCanvas.css');
  const wmCss = read('src/styles/canvas-watermark-panel.css');

  /* 取**顶层**那条基线规则。不要用「第一个匹配」—— 批 CY-㊴ 之三踩过：
     `[data-density="compact"] .xxx` 这类更具体的覆盖规则会被先命中，把值读错。
     这里显式要求该规则之前**括号是平的**（不在任何 @media / 嵌套块里）。 */
  const baseRule = (source, selector) => {
    const at = source.indexOf(selector + ' {');
    if (at < 0) return '';
    const before = source.slice(0, at);
    const depth = (before.match(/\{/g) || []).length - (before.match(/\}/g) || []).length;
    if (depth !== 0) return '';   // 落在嵌套块里，不是基线
    const open = source.indexOf('{', at);
    return source.slice(open + 1, source.indexOf('}', open));
  };
  const layers = baseRule(css, '.ec-canvas-layers-panel');
  const wm = baseRule(wmCss, '.ec-wm-panel');
  assert.ok(layers, '要能定位到图层面板的顶层基线规则');
  assert.ok(wm, '要能定位到水印面板的顶层基线规则');

  /* ① 同源的核心：左右与贴底方式必须与水印面板一致（用户「照他那样子往左边靠一些」）。
     注意两边**允许**有差别：图层面板给了 var() 兜底值、用 100% 而非 100vh
     （它挂在画布容器内，100% 才是容器高）。所以比的是**意图**，不是逐字节相等。 */
  for (const prop of ['position', 'left', 'width']) {
    const pick = body => (new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)')).exec(body);
    const a = pick(layers), b = pick(wm);
    assert.ok(a && b, `两边都必须声明 ${prop}`);
    assert.equal(a[1].trim(), b[1].trim(),
      `${prop} 必须与水印面板同值（现在 图层=${a[1].trim()} / 水印=${b[1].trim()}）—— 用户要的是「照他那样子」`);
  }
  /* ⚠️ 这里**不能**用 `[^)]*` 去匹配 bottom 的值：`calc(var(--a, 56px) + var(--b, 14px))`
     是**嵌套**括号，遇到第一个 `)` 就断了 —— 我第一版就是这么写的，当场判红。
     改用「不跨分号」的 `[^;]*?`，它对嵌套括号免疫（一条声明里不会有分号）。 */
  assert.match(layers, /bottom\s*:\s*calc\([^;]*--ec-canvas-bottombar-top[^;]*\+[^;]*--ec-canvas-panel-gap/,
    '贴底必须由底栏偏移 + 面板间距算出，与水印面板同一个口径（否则会压到底栏上）');
  assert.match(layers, /max-height\s*:\s*min\(720px/,
    '高度上限必须与水印面板同一档（720px）');

  /* ② 「有多少素材就张开多少」：不许再有任何 min-height 地板。
     改前 JS 里写死 `height: max(240, …)`，一个素材也撑出 240px —— 与用户要求直接冲突。 */
  assert.doesNotMatch(layers, /min-height/, '面板本体不许有 min-height 地板（那会让一个素材也撑出一块空白）');
  const list = /\.ec-canvas-layer-list\s*\{([^}]*)\}/.exec(css);
  assert.ok(list, '要能定位到图层列表规则');
  assert.match(list[1], /min-height\s*:\s*0/, '列表的 min-height 必须是 0，高度完全由内容决定');

  /* ③ 「悬空」的真凶是**内联样式压过 CSS**，不是 CSS 写错了。
     CSS 一直贴底（改前 left:72/bottom:70），是 JS 用共用规则算出的
     `position:fixed + left + bottom` 内联样式赢掉了它。⇒ 断掉内联几何，才是真的修好。
     这一条必须跑在**剥掉注释**的副本上：文件里那段解释性注释提到了共用规则的名字。 */
  const chromeCode = code(chrome);
  assert.doesNotMatch(chromeCode, /ec-canvas-layers-panel[\s\S]{0,240}style=\{\{/,
    '图层面板不许再挂内联几何 —— 那正是「悬空」的真凶（内联压过 class 规则）');
  assert.doesNotMatch(chromeCode, /resolveAnchoredRight\s*\(/,
    '图层面板不再走共用右展开规则（用户已推翻该口径）；留着调用会有人照它改一条已不生效的样式');
  assert.doesNotMatch(chromeCode, /\bLAYERS_PANEL_WIDTH\b/,
    'LAYERS_PANEL_WIDTH 随内联几何一起作废，留着会让人以为定位还在 JS 里');

  /* ④ 前提守卫：判据成立**只因为**触发元素在左下角。
     哪天有人把「图层」放回底部居中的 dock，贴底靠左就又不成立了 —— 这条会红。 */
  const indexCode = code(index);
  assert.match(indexCode, /trailing=\{[\s\S]{0,400}aria-label="图层"/,
    '「图层」入口必须挂在左下角缩放条的 trailing 槽（这是「贴底靠左」成立的前提）');
  const dockAt = indexCode.indexOf('<CanvasBottomToolbar');
  assert.ok(dockAt > 0, '底部 dock 仍应存在');
  assert.doesNotMatch(indexCode.slice(dockAt, dockAt + 900), /aria-label="图层"/,
    '「图层」不许同时留在底部 dock —— 两处入口会让上面的前提判据变成空转');
});

/* ── 本轮新迁位点（逐位点断言：不得再各自算坐标 / 不得再调世界坐标版 clamp）───────── */

test('⑧ 添加菜单（左侧「+」）必须走共用定位规则，不再自算 px', () => {
  /* 修复前：index.jsx 内自写 syncAddMenuAnchor，直接 Math.round(rect.right + 12) 拼 style。
     行为恰好是对的（实测已在触发右侧），但口径是自己一套 —— 本次收编到 resolveAnchoredRight。 */
  /* 判据而非写法：**坐标必须由共用规则产出**。
     注意这里断言的是「solved 直接来自 resolveAnchoredRight 的返回值」，
     而不是「文件里出现过 resolveAnchoredRight 这几个字」—— 后者是**假绿**：
     把规则调用塞进 `if (false)` 里、仍然自拼 left，照样能过。
     （我的第一版就是这样，变异测试当场抓出来了 —— 这正是 RTK §3.1-10 要求做变异测试的原因。） */
  assert.match(index, /const solved = resolveAnchoredRight\(\{/, '添加菜单的坐标必须直接来自共用规则的返回值');
  assert.doesNotMatch(index, /left:\\s*Math\\.round\([^)]*\.right/, '不得再用「锚点右缘 + 固定偏移」自拼 left');
  assert.doesNotMatch(index, /if \(false\)[^\n]*resolveAnchoredRight/, '不得把权威调用放进永假分支（假绿）');
});

test('⑨ 工作流动作选择器：**经核实是从不渲染的死代码**，故不迁移（附核实依据）', () => {
  /* 原计划把它迁到权威。核实时发现它**根本没有调用方**：
       · 两个实现（workflowNodes/index.jsx 的具名导出 + modular/CanvasNodeActionPicker.jsx）都是 export 了没人用；
       · 全仓只有自引用（自己的定义 + modular/index.js 的再导出）；
       · 画布页 index.jsx 只从 workflowNodes 取 CanvasPortHandle / CanvasWorkflowNode。
     对死代码做定位改造 = **零用户价值**，还增加回归面。
     这里改为**断言它仍然是死的**：一旦有人真的把它接进渲染，这条会红，提醒「接进来时必须一起迁到权威」。 */
  const g = (pattern) => {
    const hits = [];
    for (const f of [
      'src/pages/EcCanvas/components/workflowNodes/index.jsx',
      'src/pages/EcCanvas/components/workflowNodes/modular/CanvasNodeActionPicker.jsx',
      'src/pages/EcCanvas/components/workflowNodes/modular/index.js',
    ]) hits.push(read(f));
    return hits.join('\n');
  };
  const all = g();
  assert.match(all, /CanvasNodeActionPicker/, '实现仍在（若已删除，本测试应改为反向断言）');
  /* 关键判据：**没有任何“渲染调用点”** —— 只有定义与再导出 */
  const renderSites = all.split('\n').filter(l =>
    /<CanvasNodeActionPicker/.test(l) && !/export/.test(l));
  assert.deepEqual(renderSites, [], '若出现渲染调用点，必须同时把它迁到 resolveAnchoredRight（见 ⑧ 的口径）');
});

test('⑩ 跟随选中节点的三个工具栏：保留原语义，但**必须集中在一个函数里**', () => {
  /* 保留理由：object/toolbar 是「跟随选中节点」而不是「锚触发元素」——
     硬套 place='right' 会把工具栏从节点上方挪到节点右侧，改变交互语义。
     但它们**同样不许各写各的**：统一由 getCanvasToolbarPosition 产出（唯一真源）。 */
  const interaction = read('src/pages/EcCanvas/canvasInteractionModel.js');
  assert.match(interaction, /export function getCanvasToolbarPosition\(/, '工具栏定位必须是唯一真源');
  const calls = (studio.match(/getCanvasToolbarPosition/g) || []).length;
  assert.ok(calls >= 3, '三个工具栏都必须走这一个函数，实际 ' + calls);
  /* 反向断言：工具栏不得自己写 left/top 算式 */
  assert.doesNotMatch(studio, /ec-canvas-object-toolbar[^>]*style=\{\{\s*left:/, '对象工具栏不得自拼 left');
});

test('⑦ portal 化的派生菜单必须清掉「反向 scale」（否则二次缩放）', () => {
  const css = read('src/pages/EcCanvas/EcCanvas.css').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(css, /\.ec-canvas-derive-menu\.is-portaled \{[^}]*transform:\s*none/,
    'portal 化的派生菜单必须 transform: none（它已脱离缩放层）');
});
