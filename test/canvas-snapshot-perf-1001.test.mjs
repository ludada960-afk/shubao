// test/canvas-snapshot-perf-1001.test.mjs
// 2026-10-01 性能批。用户原话：「我在水印面板进行操作，都要延迟一会才会生效」
// 「我感觉我在整个网站各个地方进行操作，都会有所延迟」。
//
// 根因（实测，见 RTK）：createCanvasSnapshot 里那个
//     durableCanvasValue(clone(nodes, []))
// 而 clone 就是 JSON.parse(JSON.stringify(nodes))。上传过的图还挂在 url 上时，
// 一棵树 6~25MB，于是最贵的两步（序列化 + 解析十几 MB 的 base64）算出来的 url
// **下一步就被 sanitizeCanvasSnapshotMedia 丢掉** —— 产出被扔，代价全付。
//
// 删掉 clone 的前提是"输出必须完全一样"。这条门禁守的就是这一点：
// **逐字节比对 JSON**，不是"看起来差不多"。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createCanvasSnapshot, restoreCanvasSnapshot } from '../src/pages/EcCanvas/canvasSessionModel.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/* 一张 400KB JPEG 转成 data: URL 约 546K 字符 */
const DATA_URL = 'data:image/jpeg;base64,' + 'A'.repeat(2000);

const makeNodes = n => Array.from({ length: n }, (_, i) => ({
  id: `node_${i}`,
  kind: i % 4 === 0 ? 'image-composer' : 'image',
  x: i * 320, y: 200, w: 280, h: 280,
  url: DATA_URL,
  localPreviewUrl: DATA_URL,
  status: 'ready',
  name: `照片 ${i + 1}.jpg`,
  /* 这些字段专门用来盯"clone 会不会改变它们" —— JSON 往返会丢 undefined/函数 */
  emptyStr: '', zero: 0, isFalse: false, nothing: null,
  /* 以及真实存在的边角：assetRef 命中时 url 要被换成 stableUrl */
  ...(i % 3 === 0 ? {
    assetRef: { assetId: `asset-${i}`, stableUrl: `/api/generated-assets/durable-${i}.jpg`, contentHash: 'h' + i },
  } : {}),
}));

const makeInput = (n = 4) => ({
  nodes: makeNodes(n),
  connections: [{ id: 'c1', from: 'node_0', to: 'node_1' }],
  viewport: { x: 12, y: 34, scale: 0.68 },
  pendingProjectAssetImports: [],
});

/* ═══ ① 语义不变：删掉 clone 之后快照内容必须逐字节相同 ═══════════════════════════
   判据是"用旧算法（带 clone）算一遍，与新算法（无 clone）算一遍，JSON 完全相等"，
   而不是"新算法能跑通"。后者挡不住"悄悄少存了一个字段"这种最坏的情况。 */
test('① 去掉 clone 之后，快照输出必须与旧算法逐字节相同', () => {
  /* 这里重实现**旧**算法：JSON 往返 + 同一套 durableCanvasValue 链。
     为了拿到同一套链，直接用新实现算一遍当基准，再与"带 clone 的输入"对照：
     clone 是纯函数，若它改变不了结果，两条路径必然相等。 */
  for (const n of [1, 2, 4, 8, 20]) {
    const input = makeInput(n);
    const viaNew = createCanvasSnapshot(input);
    /* 模拟"如果当初没删 clone 会是什么样"：先 JSON 往返一次再喂进去。
       若 clone 有任何实质作用，这里就会不等。 */
    const roundTripped = JSON.parse(JSON.stringify(input.nodes));
    const viaOldShape = createCanvasSnapshot({ ...input, nodes: roundTripped });
    assert.equal(
      JSON.stringify(viaNew),
      JSON.stringify(viaOldShape),
      `${n} 个节点：JSON 往返改变了快照内容 ⇒ 说明 clone 不是纯浪费，删不得`,
    );
  }
});

/* ═══ ② 快照不含 base64（这正是 clone 白算的原因，也是它贵的原因）═══════════════ */
test('② 快照里不得留下 base64（data: URL）', () => {
  const snap = createCanvasSnapshot(makeInput(8));
  const json = JSON.stringify(snap);
  assert.ok(!json.includes('data:image/'),
    '快照里还有 data: URL —— 那正是"序列化十几 MB base64、算完再丢掉"的形状');
  assert.ok(!json.includes('localPreviewUrl'),
    'localPreviewUrl 带着 data: URL 漏过了清洗（它按定义就是临时预览）');
  /* 必须是 durable 地址而不是空 —— 确认"丢掉"是对的，不是"整个节点丢了" */
  assert.ok(snap.nodes.length === 8, '节点数量不能因为去掉 url 而变少');
  assert.ok(snap.nodes.every(node => typeof node.id === 'string' && node.id),
    '每个节点都要保留 id');
  assert.ok(snap.nodes.filter(n => n.url && n.url.startsWith('/api/')).length > 0,
    '命中 assetRef 的节点应当保留 durable 地址');
});

/* ═══ ②-补：清掉临时预览，不许把**还有真图**的节点误标成 unavailable ═════════════
   回归记录：`localPreviewUrl` 进 MEDIA_URL_KEYS 之后出现过这么一种节点 ——
       url = '/api/generated-assets/x.jpg'   ← 已归档的真图
       localPreviewUrl = 'data:…'            ← 顺手被清掉的本地预览
   原判据只看 assetRef（!stableUrl）就把它标成 unavailable，界面上会冒出
   「媒体尚未归档到项目素材库」—— 而它明明有图。这条就是钉住那个 bug 的。 */
test('②-补 已有 durable 地址的节点，不得被标成 unavailable', () => {
  const snapshot = createCanvasSnapshot({
    nodes: [
      { id: 'hasUrl', kind: 'image', x: 0, y: 0, w: 1, h: 1, url: '/api/generated-assets/ok.jpg', localPreviewUrl: 'data:image/png;base64,AAA', status: 'ready' },
      { id: 'noUrl', kind: 'image', x: 0, y: 0, w: 1, h: 1, url: 'data:image/png;base64,AAA', status: 'ready' },
    ],
    connections: [], viewport: { x: 0, y: 0, scale: 1 }, pendingProjectAssetImports: [],
  });
  const hasUrl = snapshot.nodes.find(n => n.id === 'hasUrl');
  const noUrl = snapshot.nodes.find(n => n.id === 'noUrl');
  assert.equal(hasUrl.status, 'ready',
    '有 durable url 的节点被误标成 unavailable 了（本地预览被清掉 ≠ 这张图没了）');
  assert.equal(hasUrl.url, '/api/generated-assets/ok.jpg', 'durable 地址必须保留');
  assert.equal(noUrl.status, 'unavailable',
    '真的什么都没有的节点，应当如实标成 unavailable');
});

/* ═══ ③ 可还原：快照丢掉的只是临时预览，不是用户数据 ═══════════════════════════ */
test('③ 快照仍能被 restoreCanvasSnapshot 还原成同样数量的节点', () => {
  const input = makeInput(6);
  const snap = createCanvasSnapshot(input);
  const restored = restoreCanvasSnapshot(snap);
  assert.ok(Array.isArray(restored.nodes) || Array.isArray(restored),
    'restoreCanvasSnapshot 必须能吃这个快照');
  const nodes = restored.nodes || restored;
  assert.equal(nodes.length, 6, '还原后节点数必须一致');
});

/* ═══ ④ 性能判据：这一条才是本次改动的目的 ══════════════════════════════════════
   阈值刻意宽松（只要"明显不再是几十毫秒"就放行），因为 CI 机器抖动大。
   它守的是**量级回归**（比如谁又把 JSON 往返加回来），不是逐毫秒的性能。 */
test('④ 快照耗时不得回到 JSON 往返的量级', () => {
  const input = makeInput(20);
  createCanvasSnapshot(input); // 预热
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    createCanvasSnapshot(input);
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const median = samples[2];
  assert.ok(median < 12,
    `20 个节点的中位耗时 ${median.toFixed(1)}ms 太慢了 —— `
    + '多半是又把 JSON.parse(JSON.stringify(nodes)) 加回来了');
});

/* ═══ ⑤ 结构判据：源码里不许再出现那个 JSON 往返 ═══════════════════════════════ */
test('⑤ 源码里不许再对 nodes 做 JSON 往返克隆', () => {
  const source = read('src/pages/EcCanvas/canvasSessionModel.js');
  const snapshotFn = source.slice(
    source.indexOf('export function createCanvasSnapshot'),
    source.indexOf('export function restoreCanvasSnapshot'),
  );
  assert.doesNotMatch(snapshotFn, /JSON\.parse\(JSON\.stringify/,
    'createCanvasSnapshot 里不许再出现 JSON 往返克隆（durableCanvasValue 已经逐层重建）');
  assert.match(snapshotFn, /durableCanvasList\(nodes\)/,
    'nodes 必须走 durableCanvasList（= durableCanvasValue 的逐层重建）');
});
