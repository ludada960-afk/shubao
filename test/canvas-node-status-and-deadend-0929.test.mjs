// test/canvas-node-status-and-deadend-0929.test.mjs
// 2026-09-29 批 CY-⑰。两条都是"用户能看见"的：
//   ① 节点徽标把**正在生成 / 被跳过 / 被阻塞**都显示成「待配置」；
//   ② EcStudio / EcAuto 的出图结果拿不回画布（死胡同）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  NODE_STATUSES, normalizeStatus, getStatusMeta,
} from '../src/pages/EcCanvas/components/workflowNodes/modular/workflowNodeViewModel.js';
import {
  buildCanvasLaunchFromUrls, canvasEntryActionsForResults, resultItemsFromImageMap,
} from '../src/pages/EcCanvas/sendResultsToCanvas.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const code = p => strip(read(p));

/* ═══ ① 节点状态徽标 ════════════════════════════════════════════════════════════════════════════
   徽标的唯一真源是 CanvasNodeShell → getStatusMeta → normalizeStatus → NODE_STATUSES。
   以前这张表只有 7 项，而引擎真的会写出来的远不止 7 种：
     · `skipped`  —— canvasGraphRunController:135 真的会把节点置成它（无执行器且无产物）
       ⇒ 以前显示**「待配置」**，而同一次运行的用户提示条就写着「跳过 N」；
       而且重试按钮的条件是 `status === 'error'`（CanvasNodeShell:49）⇒ 被跳过的节点**连重试都不给**。
     · `processing` / `uploading` / `upload-error` / `generating`
       —— index.jsx 有 **13 处**写这些状态，节点正在跑的时候徽标一律「待配置」。
     · `completed`（canvasSessionModel:245）、`done` / `failed`（终态 awaiter 认它们成功/失败）
       —— 以前也一律「待配置」。
   注意：**未知状态回落 draft 这条兜底必须保留**（`assert` 里有），不能因为补了几个就拆掉。 */
test('引擎真的会写出来的每个状态，徽标都有如实的说法', () => {
  const engineStatuses = [
    'draft', 'analyzing', 'queued', 'pending', 'submitted', 'running', 'processing',
    'generating', 'uploading', 'ready', 'success', 'completed', 'done', 'succeeded',
    'blocked', 'skipped', 'stale', 'error', 'failed', 'failure', 'upload-error',
  ];
  for (const status of engineStatuses) {
    assert.ok(NODE_STATUSES[status], `状态「${status}」必须登记（否则徽标会显示成「待配置」）`);
    assert.equal(normalizeStatus(status), status, `${status} 不该被回落成 draft`);
    const label = getStatusMeta(status).label;
    /* ⚠️ `draft` 自己显示「待配置」是对的（它就是"还没配"）。
       这里要防的是**别的**状态被说成「待配置」—— 那等于把"正在跑/被跳过/被阻塞"讲成"还没配"。 */
    if (status !== 'draft') {
      assert.ok(label && label !== '待配置',
        `状态「${status}」的徽标显示成「待配置」= 把"正在跑/被跳过/被阻塞"说成了"还没配"（${label}）`);
    }
  }
});

test('兜底仍然在：真正不认识的字符串按「待配置」处理', () => {
  assert.equal(normalizeStatus('某个从未见过的状态'), 'draft');
  assert.equal(normalizeStatus(undefined), 'draft');
  assert.equal(normalizeStatus(''), 'draft');
});

test('跳过 ≠ 待配置（这是本批最要紧的一条）', () => {
  const skipped = getStatusMeta('skipped');
  assert.equal(skipped.label, '已跳过');
  assert.equal(skipped.tone, 'warning');
  assert.notEqual(skipped.label, getStatusMeta('draft').label);
});

test('徽标的四种色调都有对应 CSS 类（.statusWarning 以前**根本不存在**）', () => {
  /* CanvasNodeShell 是用 `styles['status' + tone首字母大写]` 取类的
     ⇒ tone:'warning' 会取到 styles.statusWarning，而它**以前没有定义**
     ⇒ 模板里拼出 `class="… undefined"`，已失效/已跳过/被阻塞三种徽标全都没有底色也没有字色。 */
  const css = read('src/pages/EcCanvas/components/workflowNodes/modular/CanvasWorkflowNodes.module.css');
  const tones = new Set(Object.values(NODE_STATUSES).map(meta => meta.tone));
  for (const tone of tones) {
    const className = 'status' + tone.charAt(0).toUpperCase() + tone.slice(1);
    assert.ok(css.includes('.' + className + ' {'), `CSS module 里必须有 .${className}（tone='${tone}' 的徽标现在是无样式的）`);
  }
  /* CanvasNodeShell 确实是用这套命名取类 —— 判据与实现对得上 */
  const shell = code('src/pages/EcCanvas/components/workflowNodes/modular/CanvasNodeShell.jsx');
  assert.match(shell, /status\$\{statusMeta\.tone\[0\]\.toUpperCase\(\)/,
    '取类方式变了的话，这条门禁的命名推导要跟着改');
});

/* ═══ ② 出图结果的死胡同 ════════════════════════════════════════════════════════════════════════════
   同一个产品里三条等价产图路径，以前只有 MediaCreation 能把结果接回创作流程
   （每张结果一个「送到画布」）。EcStudio / EcAuto 的结果除了下载没有第二个去处。 */
test('三条产图路径都有「送到画布」的出口', () => {
  /* MediaCreation 是最早有的那条，它直接 dispatch 两个 store 动作；
     后两条（批 CY-⑰ 加的）走**共用纯函数** canvasEntryActionsForResults ——
     所以判据分两种写法，别拿"字面量在哪"当判据（第一版就是这么误报的）。 */
  const mediaCreation = code('src/pages/MediaCreation/index.jsx');
  assert.ok(mediaCreation.includes('SET_CREATION_LAUNCH'), '技能子页：必须走 SET_CREATION_LAUNCH');
  assert.ok(mediaCreation.includes('OPEN_CANVAS'), '技能子页：必须走 OPEN_CANVAS');

  for (const [file, label] of [
    ['src/pages/EcStudio/index.jsx', '精修工坊'],
    ['src/pages/EcAuto/index.jsx', '一键出图'],
  ]) {
    const src = code(file);
    assert.ok(src.includes('canvasEntryActionsForResults'),
      label + '：必须用共用拼装器 canvasEntryActionsForResults（里面才是那对 store 动作）');
    assert.ok(src.includes('for (const action of actions) dispatch(action)'),
      label + '：必须把拼出来的动作依次 dispatch');
  }
  /* MediaCreation 那条踩过的坑：用 NAVIGATE 会被弹回子页面。
     所以这两条**都不许**用 NAVIGATE 去画布。 */
  for (const file of ['src/pages/EcStudio/index.jsx', 'src/pages/EcAuto/index.jsx']) {
    assert.ok(!/NAVIGATE[^}]*page:\s*'ec-canvas'/.test(code(file)),
      file + '：送画布不许用 NAVIGATE（MediaCreation 记录过会被弹回子页面）');
  }
});

test('送到画布的动作拼装：形状、空输入、顺序', () => {
  const launch = buildCanvasLaunchFromUrls([{ url: '/api/generated-assets/a.png', assetId: 'a' }], { title: 'T' });
  assert.equal(launch.kind, 'to-canvas');
  assert.equal(launch.images.length, 1);
  assert.equal(launch.images[0].url, '/api/generated-assets/a.png');
  assert.equal(launch.images[0].assetId, 'a');

  /* 空输入不许造出一个"空 launch"去打开画布 —— 那会开出一张空画布，比什么都不做更糟 */
  assert.equal(buildCanvasLaunchFromUrls([], {}), null);
  assert.equal(buildCanvasLaunchFromUrls([{ url: '' }], {}), null);
  assert.deepEqual(canvasEntryActionsForResults([], {}), []);

  /* 顺序有依赖：先放 launch 再开画布 */
  const actions = canvasEntryActionsForResults([{ url: '/x.png' }], {});
  assert.deepEqual(actions.map(a => a.type), ['SET_CREATION_LAUNCH', 'OPEN_CANVAS']);
});

test('结果字典能摊成条目（EcStudio / EcAuto 的结果就是这个形状）', () => {
  const items = resultItemsFromImageMap({ main_text: '/a.png', white_bg: '/b.png' }, { prefix: '图' });
  assert.equal(items.length, 2);
  assert.deepEqual(items.map(i => i.assetId).sort(), ['main_text', 'white_bg']);
  assert.ok(items.every(i => i.url));
  assert.deepEqual(resultItemsFromImageMap(null), []);
  assert.deepEqual(resultItemsFromImageMap({ a: '' }), [], '空 url 必须被丢掉');
});

/* ═══ ③ 我自己这一批差点又犯的错：用了没 import / 没声明的标识符 ═══════════════════════════════
   EcAuto 里第一版写了 `<Layers size={13}/>`（那个页面根本没 import Layers，用的是 @phosphor-icons）
   和 `productName?.trim()`（那一页的 state 叫 `input`）——
   两个都是"渲染到那一行才炸"的错。EcStudio 那版把按钮插在了错误的行上、handler 引用了不存在的名字。
   ⇒ 这条门禁把两个页面里**用到但没声明/没 import** 的标识符钉住。 */
test('EcStudio / EcAuto 的画布出口没有用未声明的标识符', () => {
  const ecAuto = code('src/pages/EcAuto/index.jsx');
  assert.ok(!/\bLayers\b/.test(ecAuto),
    'EcAuto 没有 import Layers（它用 @phosphor-icons），第一版写 <Layers/> 就是"渲染即崩"');
  assert.ok(!/\bproductName\b/.test(ecAuto),
    'EcAuto 没有 productName 这个 state（商品名就是 `input`）');
  assert.ok(/\binput\b/.test(ecAuto), 'handler 用的是真实存在的 `input`');

  const ecStudio = code('src/pages/EcStudio/index.jsx');
  for (const id of ['dispatch', 'setErr', 'sendAllResultsToCanvas', 'resultItemsFromImageMap', 'canvasEntryActionsForResults']) {
    assert.ok(ecStudio.includes(id), 'EcStudio 必须用到 ' + id);
  }
  assert.ok(!/全部送到画布[\s\S]{0,400}?onClick=\{startNewProduct\}/.test(ecStudio),
    '按钮的 onClick 必须是 sendAllResultsToCanvas（第一版插错行，按钮点不动）');
});
