// test/canvas-node-handlers-1001.test.mjs
// 批 CY-㊴ 之十八（2026-10-01）。让节点组件的 React.memo 真正能生效的前提：
// 渲染循环里传给每个节点的回调必须**引用稳定**。
//
// 做法不是「把箭头挪进 useCallback、把 node.id 塞进依赖数组」—— 那是给每个节点
// 注册一个 hook（违反 Hooks 规则，数量随节点数变化）。而是按 node.id 缓存一个
// 「回调包」，包里每个箭头都走一个 ref 去取真实实现，于是包永远不用重建。
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createNodeHandlerCache,
  createPrunableNodeHandlerCache,
  pruneNodeHandlerCache,
} from '../src/pages/EcCanvas/canvasNodeHandlers.js';

test('① 同一个 node.id 两次取到的是**同一个函数**（这才是 memo 生效的前提）', () => {
  const implRef = { current: { onPortPointerDown: () => 'a' } };
  const nodeHandlers = createNodeHandlerCache(['onPortPointerDown'], implRef);
  const first = nodeHandlers('n1');
  const second = nodeHandlers('n1');
  assert.equal(first, second, '同一个 id 必须拿到同一个回调包对象');
  assert.equal(first.onPortPointerDown, second.onPortPointerDown,
    '同一个 id 的同一个回调必须引用相同');
});

test('② 不同 node.id 拿到不同的函数，且各自拿到自己的 id', () => {
  const seen = [];
  const implRef = { current: { onTap: id => { seen.push(id); return id; } } };
  const nodeHandlers = createNodeHandlerCache(['onTap'], implRef);

  nodeHandlers('a').onTap(1);
  nodeHandlers('b').onTap(2);
  nodeHandlers('a').onTap(3);

  assert.deepEqual(seen, ['a', 'b', 'a'], '回调必须带着自己那个节点的 id');
  assert.notEqual(nodeHandlers('a').onTap, nodeHandlers('b').onTap,
    '不同节点的回调不能是同一个函数（否则点 A 会触发 B）');
});

test('③ 底层 handler 换了之后，缓存里的引用**仍然稳定**（这才是关键）', () => {
  /* 包里的箭头走 ref，而不是在创建时把 handler 抓在闭包里。
     所以 implRef.current 换成一个全新函数之后，
     旧包仍然可用、引用仍然不变 —— memo 不会因为"依赖变了"而失效。 */
  const firstImpl = () => 'v1';
  const implRef = { current: { onTap: firstImpl } };
  const nodeHandlers = createNodeHandlerCache(['onTap'], implRef);

  const stable = nodeHandlers('n1').onTap;
  assert.equal(stable(), 'v1');

  implRef.current = { onTap: () => 'v2' };
  assert.equal(nodeHandlers('n1').onTap, stable,
    '实现换了之后，引用必须还是同一个（否则每次换实现全画布重渲染）');
  assert.equal(stable(), 'v2', '但实际调用必须打到新实现上');
});

test('④ 参数原样透传（node.id 之外的东西一个字都不能改）', () => {
  const implRef = { current: { onPort: (...args) => args } };
  const nodeHandlers = createNodeHandlerCache(['onPort'], implRef);
  const event = { type: 'pointerdown' };
  const corner = 'se';
  assert.deepEqual(nodeHandlers('n7').onPort(event, corner), ['n7', event, corner]);
});

test('⑤ 节点删掉后必须能清掉缓存（否则是只增不减的泄漏）', () => {
  const implRef = { current: { onTap: () => {} } };
  const nodeHandlers = createPrunableNodeHandlerCache(['onTap'], implRef);

  for (const id of ['a', 'b', 'c', 'd']) nodeHandlers(id);
  assert.equal(nodeHandlers.cache.size, 4);

  const removed = pruneNodeHandlerCache(nodeHandlers.cache, ['a', 'c']);
  assert.equal(removed, 2, '应当删掉 b 与 d');
  assert.equal(nodeHandlers.cache.size, 2);

  /* 清完之后再用被删掉的 id，会重新建一份（而不是拿到别人���的回调） */
  const rebuilt = nodeHandlers('b');
  assert.equal(nodeHandlers.cache.size, 3);
  assert.notEqual(rebuilt.onTap, nodeHandlers.cache.get('a').onTap,
    '重建的包必须是为 b 新建的');
});

test('⑥ 注入缺失时必须**立刻报错**，不能静默无反应', () => {
  /* 静默失败是最难查的一类：用户点了没反应，日志里什么都没有。 */
  const implRef = { current: {} };
  const nodeHandlers = createNodeHandlerCache(['onTap'], implRef);
  assert.throws(() => nodeHandlers('n1').onTap(), /尚未注入实现/,
    '实现没注入时必须抛错，而不是 call the undefined');
});