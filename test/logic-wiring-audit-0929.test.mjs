// test/logic-wiring-audit-0929.test.mjs
// 2026-09-29 批 CY-⑮-e。用户要求做一次全站逻辑审计（「他们之间该串联的功能却没有进行串联」）。
// 本文件把审计里**每一条已修的**断链钉成契约，并保留每条的"怎么知道它是坏的"。
//
// 判据一律**只断言行为事实**（某个 setter 指向了正确的目标、某段清理确实在函数体里），
// 不断言"看起来像"的东西 —— 这是本批血买来的教训：
//   · 剥注释（同一个坑第三次：把源码里的**说明**当成**代码**）；
//   · 门禁的**自证**用例（判据本身必须对故意写坏的样本判红）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const code = p => strip(read(p));

/** 取一个函数体（按花括号配对，不是"到文件末尾"） */
function bodyOf(source, header) {
  const at = source.indexOf(header);
  if (at < 0) return '';
  let i = source.indexOf('{', at);
  let depth = 0;
  for (; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') { depth -= 1; if (depth === 0) return source.slice(at, i + 1); }
  }
  return '';
}

/* ═══ ① 画布：「从资产库选择」曾经把画布过滤成空白 ════════════════════════════════════════════════
   事实：`onPickFromLibrary` 写的是 `setActiveFilter('资产库')`，而 activeFilter 的取值只有
   ['全部', ...ASSET_GROUPS]（canvasState.js:40）⇒ visibleNodes 过滤成空，节点全部消失。 */
test('画布「从资产库选择」打开的是资产库，不是把图层筛选设成一个不存在的值', () => {
  const src = code('src/pages/EcCanvas/index.jsx');
  assert.doesNotMatch(src, /setActiveFilter\('资产库'\)/,
    "不得再把 activeFilter 设成「资产库」（它不在 ASSET_GROUPS 里，会让整张画布变空白）");
  assert.match(src, /onPickFromLibrary=\{\(\) => setAssetPickerOpen\(true\)\}/,
    '正确目标：打开资产库选择器');
});

/* ═══ ② 画布：删节点必须把**以它为锚**的浮层收干净 ═══════════════════════════════════════════════
   事实：`handleDelete`（键盘路径）清了 6 个浮层，`removeCanvasNode`（右键/工具条路径）只清 2 个。
   最毒的是 focusedEditor：`selectionPanelsVisible = !focusedEditor && …`
   ⇒ 一个陈旧值会让对象工具条 / 右栏 / 文字工具条 / 多选工具条**整局都不出现**。 */
test('删节点（右键/工具条路径）也清掉以它为锚的浮层', () => {
  const body = bodyOf(code('src/pages/EcCanvas/index.jsx'), 'const removeCanvasNode = ');
  assert.ok(body, '找得到 removeCanvasNode');
  for (const [setter, why] of [
    ['setFocusedEditor', 'focusedEditor 陈旧会让整局工具条消失'],
    ['setTextInspectorNodeId', '文字图层检查器'],
    ['setEditingTextNodeId', '文字工具条'],
    ['setImageInfoNode', '图片信息弹窗（它存的是整个 node 对象）'],
    ['setContextMenu', '右键菜单（它存 { x, y, node }）'],
  ]) {
    assert.ok(body.includes(setter), 'removeCanvasNode 里必须清 ' + setter + '（' + why + '）');
  }
});

/* ═══ ③ 画布：工作流节点的输出口曾经被 wrapper 吞掉 ═════════════════════════════════════════════
   事实：`workflowNodes/index.jsx` 的 CanvasWorkflowNode 收下 canDerive 却不往下传，
   下游取默认 false ⇒ showOutput 恒 false ⇒ CanvasNodeShell 的输出端口永不渲染
   ⇒ 「图片 → 应用 → 视频 → 音频」这条端口串联物理上做不出来。 */
test('canDerive 必须一路传到 modular 层（否则工作流节点没有输出口）', () => {
  /* ⚠️ 这个文件**不能**先剥注释再找：实测剥注释函数会在这个文件里**吞掉 8.3KB**
     （某处块注释的定界符配对到了很靠后的位置），把 CanvasWorkflowNode 整个吃掉 ——
     于是「剥了注释才找得到」这个前提本身就是假的，会让断言莫名其妙地红。
     ⇒ 这里读**原文**。判据只查签名与 JSX 里的标识符，注释里出现同名也不会误判
       （canDerive 与 ModularCanvasWorkflowNode 都不是普通中文说明里会出现的词）。 */
  const src = read('src/pages/EcCanvas/components/workflowNodes/index.jsx');
  const at = src.indexOf('export function CanvasWorkflowNode');
  assert.ok(at > 0, '找得到 CanvasWorkflowNode');
  /* 取到**下一个**顶层函数为止。
     不用 bodyOf()：它的花括号配对会停在**参数列表的解构花括号**上，
     取到的只是签名、拿不到 return 那几行 —— 第一版就是这么空转的。 */
  const nextFn = src.indexOf('export function', at + 10);
  const region = src.slice(at, nextFn > 0 ? nextFn : src.length);
  const sig = region.slice(0, region.indexOf('=> {'));
  assert.ok(sig.includes('canDerive'), '签名里必须收下 canDerive');
  assert.ok(/<ModularCanvasWorkflowNode[\s\S]{0,300}canDerive=\{canDerive\}/.test(region),
    '必须把它继续传给 ModularCanvasWorkflowNode（否则 showOutput 恒 false）');
});

/* ═══ ④ 画布：统一仲裁的 switch 必须覆盖登记册里每一个 key ════════════════════════════════════════
   事实：canvasSurfaceDismiss 登记了 15 个浮层，而 dismissCanvasSurfaces 的 switch 只有 14 个 case
   （少了 connectionDraft）⇒ 它只靠另一个手写 Esc 处理器兜着，
   正是那个模块当初要消灭的「两套关闭逻辑互相打架」。 */
test('统一仲裁的 switch 覆盖登记册里每一个 blank/escape 浮层', () => {
  const registry = read('src/pages/EcCanvas/canvasSurfaceDismiss.js');
  const keys = [...registry.matchAll(/^\s{2}(\w+):\s*\{/gm)].map(m => m[1]);
  assert.ok(keys.length >= 14, '登记册读出来的 key 数量不对：' + keys.length);
  const body = bodyOf(code('src/pages/EcCanvas/index.jsx'), 'const dismissCanvasSurfaces = ');
  const missing = keys.filter(key => !body.includes(`case '${key}'`));
  assert.deepEqual(missing, [],
    '这些浮层在登记册里，却没有被统一仲裁的 switch 处理（会被另一个手写处理器兜着 = 两套逻辑打架）：\n  ' + missing.join('\n  '));
});

/* ═══ ⑤ 首页图片：分辨率必须跟模型能力走 ══════════════════════════════════════════════════════════
   事实：VisualSpecsPanel 的 RES 写死三档，而 GenSettingsPanel 已经做了
   `RESOLUTIONS.filter(r => imageModelResolutions(selectedModel).includes(r.key))`。
   漏了这层过滤的后果：选 Midjourney（上游只有 1K/2K）后仍能点 4K ⇒ 服务端静默降级成 2K，
   而积分是按 4K 算的 —— 「看着是 A、跑的是 B」，且**钱按 A 收、活按 B 干**。 */
test('首页图片面板的分辨率跟模型能力走（不再静默降级 + 计费错档）', () => {
  const src = code('src/pages/Home/VisualCreationMode.jsx');
  assert.match(src, /imageModelResolutions\(imageModel\)/,
    '必须按当前模型过滤分辨率档位');
  assert.match(src, /availableResolutions\.includes\(item\.key\)/,
    'RES 列表必须过一遍 availableResolutions');
  assert.ok(/imageModelResolutions[^\n]*from '\.\.\/\.\.\/services\/imageModelCatalog\.js'/.test(src)
    || /imageModelResolutions/.test(src.split('function VisualSpecsPanel')[0]),
    'imageModelResolutions 必须真的 import 进来（第一版就漏了 import）');
});

/* ═══ ⑥ 首页图片：「自适应」不许被尺寸过滤器吃掉 ════════════════════════════════════════════════════ */
test('首页图片面板的「自适应」是可见的（上一批加进去却被自己下面那行 filter 吃了）', () => {
  const src = code('src/pages/Home/VisualCreationMode.jsx');
  assert.match(src, /option\.adaptive \|\| IMAGE_RATIOS\.includes\(option\.id\)/,
    '带 adaptive 标记的选项必须放行');
  /* 自证：模型里确实有这一档，且它确实不在 IMAGE_RATIOS 里（否则这条门禁就是空转）
     ⚠️ 2026-09-29 批 DC 续-8：这一档的 id 从字面量 `'自适应'` 改成了常量 `HOME_ADAPTIVE_RATIO`
        （它现在同时是「选项表的第一项 / 首页默认比例 / resolveVisualSkillRatio 的特例」三处，
        写三份字面量就会出现"改了其中一处、另两处不一致"）。判据随之改成**验那个常量**。 */
  const model = read('src/pages/Home/visualCreationModel.js');
  assert.match(model, /export const HOME_ADAPTIVE_RATIO = '自适应';/,
    '自适应这个值必须收成一处常量（三处引用同一个值）');
  assert.match(model, /id:\s*HOME_ADAPTIVE_RATIO, label:\s*HOME_ADAPTIVE_RATIO, adaptive:\s*true/,
    '选项表里那一档要引用那个常量，并带 adaptive 标记');
  const catalog = read('src/services/imageSizeCatalog.js');
  const ratios = [...catalog.matchAll(/^\s{2}'([0-9]+:[0-9]+)':/gm)].map(m => m[1]);
  assert.ok(!ratios.includes('自适应'), '自证：自适应本来就不在尺寸表里（所以确实需要那条例外）');
});

/* ═══ ⑦ 保存作品不许静默丢 ═══════════════════════════════════════════════════════════════════════
   事实：`saveWork` 失败时**返回 null 而不抛**（services/api.js:1826）。
   · EcStudio 以前是 fire-and-forget ⇒ 图出了、界面说"生成完成"、作品没存、**一句提示都没有**；
     而且它带着 generationController.signal ⇒ 用户点「继续生成」就把它 abort 掉。
   · EcAuto 以前**根本不调** saveWork ⇒ 这一页出的图**刷新就没了**。 */
test('两条产图路径都会保存作品，且保存失败会明确告诉用户', () => {
  for (const [file, label] of [['src/pages/EcStudio/index.jsx', 'EcStudio 精修工坊'], ['src/pages/EcAuto/index.jsx', 'EcAuto 一键出图']]) {
    const src = code(file);
    assert.match(src, /await saveWork\(/, label + '：saveWork 必须被 await（fire-and-forget 会丢）');
    /* 两页的提示通道名字不一样（EcStudio 用 setErr、EcAuto 用 setError）——
       判据要认这两个真实存在的通道，而不是假设它们同名（第一版就是这么假设的，判据自己先错）。 */
    assert.ok(/if \(!saved\) (setErr|setError)\(/.test(src), label + '：返回 null（= 没存住）必须提示用户');
    assert.ok(/catch \((saveError|saveErr|e)\)/.test(src), label + '：必须 catch');
  }
  /* 自证：saveWork 确实是"失败返回 null 不抛"，否则上面两条断言就是在防不存在的问题 */
  const api = code('src/services/api.js');
  assert.match(api, /return null/, 'api.js 里确实有 return null 的降级路径（saveWork 的失败形态）');
});

/* ═══ ⑧ 部署：静态产物不许再只增不减 ════════════════════════════════════════════════════════════ */
test('部署正路径解包前必须先删 dist（tar xzf 是覆盖解包，不会删旧文件）', () => {
  const ps1 = read('scripts/deploy-production.ps1');
  const at = ps1.indexOf("tar xzf '$remoteReleaseArchive'");
  assert.ok(at > 0, '找得到正路径的解包命令');
  assert.match(ps1.slice(Math.max(0, at - 400), at), /rm -rf dist;/,
    '解包前必须 `rm -rf dist`，否则历次构建的 content-hash 文件会一直留在暂存目录里');
  assert.ok(ps1.indexOf('__REMOTE_BACKUP__/dist') < at,
    '备份必须在删 dist 之前（否则这行修复会把唯一那份回滚快照一起带走）');
});
