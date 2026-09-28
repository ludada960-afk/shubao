/* ══════════════════════════════════════════════════════════════════════════════════════════════
   2026-09-28 批 CY-⑩ 门禁（CV-2 第 2 步·反向）：**子页面 → 画布**（逐张「送到画布」）

   用户拍板：「画布↔子页面的入口位置，可以，你你做吧」（docs/design/89 §5 第 2 步）
     · 画布 → 子页面：节点上「在完整工作台里编辑」—— 批 CY-⑨ 已落地；
     · 子页面 → 画布：这一批。

   判据守四件事：
     ① 载荷识别：只认 `kind === 'to-canvas'`（与 `ec-plan-launch` 分开 —— 两者语义不同）；
     ② 落点几何：**追加在现有内容右侧**（不许压在已有节点上），空画布从左上角开始；
     ③ **追加、不覆盖**：画布侧必须是 `[...previous, ...新节点]`（用户画布上可能有活儿在干，
        绝不能学首页"发射器"那样把整张图换掉）；
     ④ 不花钱 + 只送成品：链路里没有任何计费调用；没 url 的占位/失败项一个都不送。
   ⚠️ 纯函数用单测覆盖（边界：没图 / 空画布 / 已有节点），接线用源码断言（各只有一小段）。
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isWorkbenchInbound, workbenchInboundNodesOf } from '../src/pages/EcCanvas/canvasWorkbenchInbound.js';

const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const readCode = rel => stripComments(read(rel));

test('① 载荷识别：只认 to-canvas（与首页"发射器" ec-plan-launch 分开）', () => {
  assert.equal(isWorkbenchInbound({ kind: 'to-canvas' }), true);
  assert.equal(isWorkbenchInbound({ kind: 'ec-plan-launch' }), false, '首页发射器是另一个语义：整张图换方案');
  assert.equal(isWorkbenchInbound({ kind: 'canvas-node-edit' }), false, '画布→子页面是另一个方向');
  assert.equal(isWorkbenchInbound(null), false);
  assert.equal(isWorkbenchInbound({}), false);
});

test('② 落点：追加在**现有内容右侧**；空画布从左上角起；同批按 y 排开', () => {
  const launch = { kind: 'to-canvas', skillId: 'image.giant_product', title: '巨型产品广告', prompt: '超大山竹', images: [{ url: 'u1.png' }, { url: 'u2.png' }] };
  const nodes = workbenchInboundNodesOf({ launch, existing: [{ x: 100, y: 80, w: 240, h: 240 }], now: 1234 });
  assert.equal(nodes.length, 2, '两张都变成节点');
  assert.equal(nodes[0].x, 100 + 240 + 48, '落在最右缘 + 间隙（不压在已有节点上）');
  assert.equal(nodes[0].y, 80, '第一张对齐现有内容的顶边');
  assert.equal(nodes[1].y, 80 + 240 + 24, '同批第二张往下排（步长 = 卡片高 + 行距），互不重叠');
  const empty = workbenchInboundNodesOf({ launch, existing: [], now: 1234 });
  assert.equal(empty[0].x, 80, '空画布从左上角开始（与"铺素材"同一套坐标口径）');
});

test('③ 节点身份：是"成品"不是"素材"，并带上技能坐标（能原路回工作台）', () => {
  const launch = { kind: 'to-canvas', skillId: 'image.giant_product', title: '巨型产品广告', prompt: '超大山竹', images: [{ url: 'u1.png', assetId: 'a1' }] };
  const [node] = workbenchInboundNodesOf({ launch, existing: [], now: 9 });
  assert.equal(node.kind, 'image');
  assert.equal(node.provenance, 'generated', '它是生成出来的成品（派生/降级规则看这个字段）');
  assert.equal(node.status, 'ready');
  assert.equal(node.url, 'u1.png');
  assert.equal(node.assetId, 'a1');
  assert.equal(node.subpageSkillId, 'image.giant_product', '记下技能坐标 ⇒ 到了画布还能原路回那一页');
  assert.equal(node.subpageDomain, 'image');
  assert.equal(node.skillLabel, '巨型产品广告');
  assert.equal(node.prompt, '超大山竹');
  assert.match(node.id, /^wb_inbound_9_1$/, 'id 由时间戳 + 序号构成（调用方可以预测它，用来选中）');
});

test('④ 只送成品：没 url 的一律不送（空壳节点不许上画布）', () => {
  const base = { kind: 'to-canvas', skillId: 'image.giant_product', title: 'T' };
  assert.deepEqual(workbenchInboundNodesOf({ launch: { ...base, images: [] } }), []);
  assert.deepEqual(workbenchInboundNodesOf({ launch: { ...base, images: [{ url: '  ' }, { assetId: 'x' }] } }), [], '占位/失败项没有 url ⇒ 不送');
  assert.deepEqual(workbenchInboundNodesOf({ launch: base }), [], '连 images 都没有 ⇒ 空数组');
  assert.equal(workbenchInboundNodesOf({ launch: base, existing: [] }).length, 0);
});

test('⑤ 画布侧是**追加**不是覆盖；子页面侧只给成品、只发数据不花钱', () => {
  const idx = readCode('src/pages/EcCanvas/index.jsx');
  const start = idx.indexOf('if (isWorkbenchInbound(pendingLaunch))');
  assert.ok(start > 0, '画布侧必须有这一支（在 isPlanLaunch 之前 —— 两者语义不同，谁也别盖谁）');
  assert.ok(start < idx.indexOf('if (isPlanLaunch(pendingLaunch))'), '顺序：先处理"送到画布"，再处理发射器');
  const block = idx.slice(start, idx.indexOf('if (isPlanLaunch(pendingLaunch))'));
  assert.match(block, /setNodes\(previous => \[\s*\.\.\.previous,\s*\.\.\.workbenchInboundNodesOf\(\{ launch: pendingLaunch, existing: previous, now: stamp \}\)\.map\(normalizeCanvasNode\),?\s*\]\)/,
    '必须是 [...previous, ...新节点]（追加）—— 覆盖会把用户画布上的活儿抹掉');
  assert.match(block, /dispatch\(\{ type: 'SET_CREATION_LAUNCH', launch: null \}\);[\s\S]{0,80}launchJustAppliedRef\.current = true;/,
    '清 launch + 跳过"清空后那一跳"（少一条会看到"toast 还在、画布被重建清空"）');
  assert.doesNotMatch(block, /settle|charge|billing|hold/i, '放到画布不收费');

  const media = readCode('src/pages/MediaCreation/index.jsx');
  assert.match(media, /\{finished && Boolean\(slot\.url\) && onSendToCanvas && \(/, '只给**成品**一颗（没 url 的不给）');
  assert.match(media, /className="media-run-send-canvas"/, '按钮类名（样式与"做成动图"分开：这颗不花钱）');
  const handler = media.slice(media.indexOf('const sendResultToCanvas ='), media.indexOf('const status = ('));
  assert.match(handler, /kind: 'to-canvas'/, '发的就是 to-canvas');
  /* ⚠️ **不许写成 useCallback**：它所在的位置在 `if (!skill) return <MediaHub/>` 提前返回**之后**，
     在这里调 hook 就是"这一轮少调一个 hook"⇒ 整页塌成错误页。
     本批第一版正是这么栽的：e2e ⑱b（子页面点「返回」→ 等 `.media-hub`）15 秒超时，
     而**纯 HEAD 复跑同一条 e2e 全绿** ⇒ 锅在我这边（判别过程见 RTK 批 CY-⑩）。 */
  assert.match(handler, /const sendResultToCanvas = index => \{/, '必须是普通函数（它位于提前返回之后，不能调 hook）');
  assert.doesNotMatch(handler, /useCallback/, '这一行不许用 useCallback（hook 顺序会被提前返回破坏）');
  /* ⚠️ 必须是 **OPEN_CANVAS**（App 打开画布的规范动作），不是 `NAVIGATE page:'ec-canvas'`：
     实测用 NAVIGATE 时画布会挂载、图也加上了，但**两三秒后被弹回子页面**
     （`canvasEntryTab` / `galleryItem` 没一起复位）。判据按**事实**改到后者上，
     并在探针里加了"3 秒后仍在画布上"这一步守着。 */
  assert.match(handler, /dispatch\(\{ type: 'OPEN_CANVAS' \}\)/, '用 App 的规范动作打开画布（与侧边栏「无限画布」同一条）');
  assert.doesNotMatch(handler, /NAVIGATE', page: 'ec-canvas'/, '不许用 NAVIGATE 进画布（那会让入口态残留、把用户弹回去）');
  assert.doesNotMatch(handler, /settle|charge|billing|hold/i, '送过去不收费（铁律）');
  assert.match(read('src/pages/MediaCreation/MediaCreation.css'), /\.media-run-send-canvas \{/, '按钮要有样式（不花钱那颗用中性描边，与花钱那颗分得开）');
});
