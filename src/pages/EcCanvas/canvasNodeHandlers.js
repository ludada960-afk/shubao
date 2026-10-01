/* ═══ 批 CY-㊴ 之十八（2026-10-01）：每个节点一套**稳定**的回调 ═════════════════════
   用户原话：「我在水印面板进行操作，都要延迟一会才会生效」。

   要让节点组件 React.memo 真正生效，光包一层 memo 是不够的 —— 渲染循环里传给
   每个节点的回调**绝大多数是内联箭头**：

       onPortPointerDown={(event, side) => handlePortPointerDown(event, node.id, side)}
       onPortPointerUp={(event, side) => handlePortPointerUp(event, node.id, side)}
       onPortClick={(event, side) => handlePortClick(event, node.id, side)}
       onResizeStart={(event, corner) => handleNodeResizeStart(event, node.id, corner)}
       onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
       onDoubleClick={node => openImagePreview({ ... })}
       onReplace={... ? () => handleToolAction(replaceAction, node) : null}

   每一个箭头**每次渲染都是一个新函数** ⇒ memo 永远判定 props 变了，永远不生效。
   （实测统计：7 个节点分支共 120 个 prop，其中内联箭头约 13 处 + 内联对象 1 处 +
     内联 style 1 处；光 video 一个分支就有 38 个 prop、40 个内联箭头。）

   ⚠️ **不要**用「把箭头挪进 useCallback 并把 node.id 塞进依赖数组」的办法：
     那等于给每个节点注册一个 hook —— 违反 Hooks 规则（数量会随节点数变化），
     而且依赖一变还是要重建。

   本模块的��法：**按 node.id 缓存一个「回调包」**，第一次用到某个 id 时建一次，
   之后一直复用。包里的箭头不直接抓 handler，而是走一个 ref —— 这样即使
   底层的 handler 换了（比如它自己依赖了新的 state），这个包也**不用重建**，
   引用永远稳定。

   为什么要单独一个模块而不是直接写进 index.jsx：这里有"缓存不随节点删除而泄漏"
   的逻辑，必须能被**单测直接验证**（见 test/canvas-node-handlers-1001.test.mjs）。 */

/** 空实现占位：取不到实现时调用会立刻报错，而不是静默无反应 */
function missingHandler(name) {
  return (...args) => {
    throw new Error(`canvasNodeHandlers：回调 ${name} 尚未注入实现`);
  };
}

/**
 * 建一个「按 node.id 取稳定回调包」的缓存。
 *
 * @param {string[]} names 这个包需要包含哪些回调（键名与名字一致）
 * @param {{current: object}} implRef 装着真实 handler 的 ref（每次渲染更新它的 .current）
 * @param {Map} [store] 可选的外部 Map（配合 createPrunableNodeHandlerCache 便于 prune）
 * @returns {(nodeId: string) => Record<string, Function>} 取某个节点的回调包
 */
export function createNodeHandlerCache(names, implRef, store) {
  /* node.id -> { onPortPointerDown: fn, … } */
  const byNodeId = store || new Map();
  return function nodeHandlers(nodeId) {
    const key = String(nodeId || '');
    let pack = byNodeId.get(key);
    if (pack) return pack;
    pack = {};
    for (const name of names) {
      pack[name] = (...args) => {
        const impl = implRef?.current?.[name];
        const fn = typeof impl === 'function' ? impl : missingHandler(name);
        /* 约定的注入签名：实现方收到的第一个参数是 node.id，其余原样透传。
           这样实现方只需要写成 (nodeId, event, side) => …，不用为每个节点建闭包。 */
        return fn(key, ...args);
      };
    }
    byNodeId.set(key, pack);
    return pack;
  };
}

/**
 * 把缓存里已经没人用的 id 删掉。
 *
 * ⚠️ 为什么必须清：节点被删掉之后，它的回调包如果一直留着，
 * 就是一个**只增不减**的 Map —— 用户开着一张画布删来删去几轮，内存会慢慢涨。
 * 删不掉不会造成功能问题（只是内存），但那正是这种缓存最常见的坑。
 *
 * @param {Map} cache nodeHandlers 内部用的那个 Map
 * @param {Iterable<string>} liveIds 当前还活着的 node.id
 */
export function pruneNodeHandlerCache(cache, liveIds) {
  if (!cache || typeof cache.size !== 'number') return 0;
  const live = liveIds instanceof Set ? liveIds : new Set(liveIds || []);
  let removed = 0;
  for (const id of [...cache.keys()]) {
    if (!live.has(id)) { cache.delete(id); removed++; }
  }
  return removed;
}

/** 让 createNodeHandlerCache 的 Map 可被 pruneNodeHandlerCache 访问 */
export function createPrunableNodeHandlerCache(names, implRef) {
  const byNodeId = new Map();
  const accessor = createNodeHandlerCache(names, implRef, byNodeId);
  accessor.cache = byNodeId;
  return accessor;
}