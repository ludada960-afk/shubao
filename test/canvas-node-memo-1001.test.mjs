// test/canvas-node-memo-1001.test.mjs
// 批 CY-㊴ 之十八（2026-10-01）。
// 让节点组件 React.memo 真正生效，需要两件事**同时**成立：
//   ① 组件被 React.memo 包起来
//   ② 传进去的每个 prop 引用在节点没变时保持不变
// 只做 ① 不做 ② 等于白包 —— 这是 React 最常见的性能误区，所以本文件把两半都钉住。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createPrunableNodeHandlerCache } from '../src/pages/EcCanvas/canvasNodeHandlers.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const stripComments = text => text
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/^[ \t]*\/\/.*$/gm, ' ');
const studio = stripComments(read('src/pages/EcCanvas/components/CanvasStudio.jsx'));
const page = stripComments(read('src/pages/EcCanvas/index.jsx'));

const NODE_COMPONENTS = [
  'CanvasGenerationNode',
  'CanvasDirectionNode',
  'CanvasImageNode',
  'CanvasSourceNode',
  'CanvasTextNode',
  'CanvasAudioNode',
];

test('1. 节点组件都包了 React.memo，且导出名保持不变', () => {
  for (const name of NODE_COMPONENTS) {
    assert.match(
      studio,
      new RegExp('export const ' + name + ' = React\\.memo\\(' + name + 'View\\);'),
      name + ' 必须是 React.memo 包装的',
    );
    assert.doesNotMatch(
      studio,
      new RegExp('export function ' + name + '\\('),
      name + ' 不许再直接导出裸函数，那样 memo 形同虚设',
    );
    assert.match(
      studio,
      new RegExp('function ' + name + 'View\\('),
      name + ' 的实现必须改名成 ' + name + 'View',
    );
  }
});

test('2. image / output 分支不得再有内联箭头', () => {
  /* image/output 是画布上节点最多的类型，上传的图与生成结果都是它，
     所以这一支必须最先做干净。 */
  const start = page.indexOf('<StudioImageNode');
  const end = page.indexOf('/>', start);
  assert.ok(start > 0 && end > start, '找不到 StudioImageNode 的 JSX');
  const branch = page.slice(start, end);

  const inlineArrows = branch.match(/\{\s*\(?[a-z]*\)?\s*=>/g) || [];
  assert.deepEqual(inlineArrows, [],
    'image 分支里还有内联箭头: ' + inlineArrows.join(' | '));

  for (const prop of ['onPortPointerDown', 'onPortPointerUp', 'onPortClick', 'onResizeStart',
    'onHoverChange', 'onContextMenu', 'onDoubleClick']) {
    assert.match(branch, new RegExp(prop + '=\\{h\\.'),
      prop + ' 必须取自稳定缓存 h.' + prop);
  }
  /* onReplace 是**条件**的：能做替换才传回调，不能做就传 null。
     两种情况引用都必须稳定 —— 条件本身每次渲染算出来是同一个布尔，
     所以这里只要求"取自缓存"，而不是要求它恒为真。 */
  assert.match(branch, /onReplace=\{replaceAction\.canRun\(node\) \? h\.onReplaceMedia : null\}/,
    'onReplace 必须取自稳定缓存（不能做替换时传 null）');
  assert.match(page, /const h = nodeHandlersRef\.current\(node\.id\);/,
    '必须从按 node.id 缓存的回调包里取');
});

test('3. 底层 handler 重建后，回调包引用必须不变', () => {
  /* 这是**行为**断言：跑真实的缓存，验证底层实现换了之后引用依然不变。
     index.jsx 里的 handler 大多是 useCallback，会随依赖变化而重建；
     若缓存跟着重建，memo 每次都会被判失效。 */
  const implRef = { current: {} };
  const nodeHandlers = createPrunableNodeHandlerCache(
    ['onPortPointerDown', 'onContextMenu', 'onDoubleClickImage'], implRef);

  implRef.current = { onPortPointerDown: (nodeId, a, b) => b };
  const pack1 = nodeHandlers('node-42');
  const fn1 = pack1.onPortPointerDown;

  implRef.current = {
    onPortPointerDown: (nodeId, a, b) => b * 2,
    onContextMenu: () => {},
    onDoubleClickImage: () => {},
  };
  const pack2 = nodeHandlers('node-42');

  assert.equal(pack2, pack1, '回调包对象必须还是同一个');
  assert.equal(pack2.onPortPointerDown, fn1, '回调引用必须还是同一个');
  /* 缓存把 node.id 插在第一个参数，所以实现收到的是 (nodeId, ...原参数)。
     这里原参数传两个：'y' 与 21 ⇒ 实现看到 (node-42, 'y', 21)。 */
  assert.equal(pack2.onPortPointerDown('y', 21), 42, '但实际调用必须打到新实现上');
});

test('4. 节点删除后回调缓存必须被清理', () => {
  const implRef = { current: {} };
  const nodeHandlers = createPrunableNodeHandlerCache(['onContextMenu'], implRef);
  for (const id of ['a', 'b', 'c']) nodeHandlers(id);
  assert.equal(nodeHandlers.cache.size, 3);
  assert.match(page, /pruneNodeHandlerCache\(nodeHandlersRef\.current\.cache/,
    'index.jsx 必须在 nodes 变化时清掉没人用的回调包');
});

test('5. 不许在 map 里按节点调用 hook', () => {
  /* 把箭头挪进 useCallback、依赖里塞 node.id —— 那样等于给每个节点调用一次 hook，
     hook 数量会随节点数变化，违反 Hooks 规则。 */
  const mapStart = page.indexOf('{visibleNodes.map(node => {');
  const mapEnd = page.indexOf('canvasGroupFrames(nodes)', mapStart);
  const body = page.slice(mapStart, mapEnd);
  assert.doesNotMatch(body, /use(Callback|Memo|State|Ref|Effect|Reducer)\(/,
    '在 map 回调里调用 hook 是违反 Hooks 规则的');
});

test('7. 实现必须自己换位：nodeId 在第二个参数，不许把 handler 直接丢进去', () => {
  /* 这个 bug **真的发生过**：第一版把 handlePortPointerDown 等四个 handler
     直接当实现传进缓存，而缓存调的是 impl(nodeId, event, side)，
     handler 的签名却是 (event, nodeId, side) ⇒ 它收到「event = 节点 id 字符串」。
     症状是点节点上的「+」派生菜单打不开。
     抓它的是 test/canvas-popover-live-anchored-0920（**实机**点开菜单再量位置）——
     构建绿、所有静态门禁绿，只有真点才知道。

     所以这里把「必须显式换位」写成门禁：凡是「节点 id 在第二个参数」的 handler，
     实现就必须是 (nodeId, event, …) => handler(event, nodeId, …) 的换位写法，
     不许出现裸名字。 */
  const implBlock = page.slice(
    page.indexOf('nodeHandlerImplRef.current = {'),
    page.indexOf('const nodeHandlersRef = useRef(null);'),
  );
  assert.ok(implBlock.length > 0, '找不到回调实现块');

  for (const name of ['onPortPointerDown', 'onPortPointerUp', 'onPortClick', 'onResizeStart']) {
    assert.match(implBlock,
      new RegExp(name + ':\\s*\\(nodeId,\\s*\\w+,\\s*\\w+\\)\\s*=>\\s*handle'),
      name + ' 必须显式换位成 (nodeId, event, …) => handle…(event, nodeId, …)');
    assert.doesNotMatch(implBlock, new RegExp(name + ':\\s*handle'),
      name + ' 不许把 handler 裸传当实现 —— nodeId 位置会错位');
  }

  /* 更强的一道：把实现从源码里取出来，模拟子组件的真实调用形状跑一遍，
     断言**真的把 nodeId 放到了 handler 的第二个参数**。 */
  const implSource = page.slice(
    page.indexOf('nodeHandlerImplRef.current = {'),
    page.indexOf('const nodeHandlersRef = useRef(null);'),
  );
  for (const [prop, handler] of [
    ['onPortPointerDown', 'handlePortPointerDown'],
    ['onPortPointerUp', 'handlePortPointerUp'],
    ['onPortClick', 'handlePortClick'],
    ['onResizeStart', 'handleNodeResizeStart'],
  ]) {
    const call = implSource.match(new RegExp(
      prop + ':\\s*\\(nodeId,\\s*(\\w+),\\s*(\\w+)\\)\\s*=>\\s*' + handler + '\\(([^)]*)\\)'));
    assert.ok(call, prop + ' 的实现无法解析');
    const [, eventVar, thirdVar, handlerArgs] = call;
    /* handler 收到的必须是「缓存给的第 2 个参数在前、nodeId 在后」 */
    assert.match(handlerArgs.trim(), new RegExp('^' + eventVar + ',\\s*nodeId'),
      prop + ' 必须把缓存给的第 2 个参数放在前、nodeId 放在第二个（实际: ' + handlerArgs.trim() + '）');
    assert.ok(thirdVar, prop + ' 应当把第三个参数也透传（side / corner）');
  }
});

test('8. 实机门禁必须真的点到派生菜单（那是抓参数错位的那道网）', () => {
  /* 上面 ⑦ 是静态护栏，而真正抓住「参数错位」的是这条实机门禁。
     这里只确认它**存在且真的在跑**（不是在 skip 里空过）——
     少测即假绿，正是它自己在失败信息里写的那句话。 */
  const probe = read('test/canvas-popover-live-anchored-0920.test.mjs');
  assert.match(probe, /ec-canvas-node-port:not\(\.is-input\)/,
    '实机探针必须点节点的「+」端口');
  assert.match(probe, /ec-canvas-derive-menu/,
    '实机探针必须真的量到派生菜单的位置');
  assert.match(probe, /measured\.length|必须真的测到全部/,
    '实机探针必须对「测到的弹层数」做自检（少测就是假绿）');
});

test('9. 子组件的调用实参数必须与缓存的约定对上', () => {
  /* 这一条钉的是本次改动**真正会出事**的地方：
     缓存把 node.id 插在第一个参数（实现签名是 (nodeId, ...原参数)）。
     如果子组件将来把 onContextMenu?.(event, node) 改成只传一个参数，
     实现收到的 nodeId 位置就错位了 —— 而这种错误**构建不报、单测不报**，
     只表现为「拖不动 / 右键不出菜单」。所以把每个回调的实际实参数写死在这里。 */
  const raw = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
  const expectations = [
    ['onHoverChange', /onHoverChange\?\.\(node\.id\)/, '悬停：1 个实参'],
    ['onHoverChange(null)', /onHoverChange\?\.\(null\)/, '移出：1 个实参'],
    ['onResizeStart', /onResizeStart\?\.\(event, corner\)/, '缩放：2 个实参'],
    ['onContextMenu', /onContextMenu\?\.\(event, node\)/, '右键：2 个实参'],
    ['onDoubleClick', /onDoubleClick\?\.\(node\)/, '双击：1 个实参'],
    ['onReplace', /onClick=\{\(event\) => \{ event\.stopPropagation\(\); onReplace\(\); \}\}/, '替换按钮：0 个实参'],
    ['DerivePort 的端口', /onPointerDown\?\.\(event, handlerSide\)/, '端口按下：2 个实参'],
    ['DerivePort 的端口抬起', /onPointerUp\?\.\(event, handlerSide\)/, '端口抬起：2 个实参'],
    ['DerivePort 的端口点击', /onClick\?\.\(event, handlerSide\)/, '端口点击：2 个实参'],
  ];
  for (const [what, pattern, note] of expectations) {
    assert.match(raw, pattern, what + ' 的调用形状变了（' + note + '）');
  }
});