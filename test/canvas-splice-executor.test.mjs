// test/canvas-splice-executor.test.mjs
// P3 后端契约测试（全契约 / 零付费）：
//   1. splice 图片拼接（本地 sharp，免费 0 扣费）—— 真实 sharp 合成 2 张小图 -> 竖向长图；
//      视频拼接 P3.1 ffmpeg 门控错误；执行器 handler 0 units（不变式① 不确认不扣费）。
//   2. 假能力诚实清理（master-plan §2.3）—— chainService deriveScript/deriveKeyframes/executeChain
//      返回体带显式 mock/isMock/provider='mock-placeholder' 标记（不静默假装走过）。
//   3. 悬空路由清零 —— 动作注册表 CANVAS_ACTIONS 的每个 execute.route 必须能在 server 路由表找到
//      （/api/canvas/one-click-video、/api/canvas/tts 原悬空两条本期消除）。
//   4. timeline 字段位（向后兼容）—— createCanvasSnapshot 带/不带 timeline 都合法，老 snapshot 照常加载。
//   5. T4/T5 诚实门控 —— video-composer/tts/lip-sync 保持 P1 白名单外（unsupported）+ 执行器无扣费入口。
// 绝不烧 Seedance/TTS 真调用；splice 走真实 sharp（本地免费）。

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
  createCanvasGraphRunExecutor,
  spliceImageStack,
  collectSpliceInputUrls,
  isVideoSpliceInput,
} from '../server/canvas/graphRunExecutor.mjs';
import { SUPPORTED_GRAPH_RUN_KINDS, buildRunPlan } from '../server/canvas/graphRunPlan.mjs';
import { BUILTIN_WORKFLOW_TEMPLATES } from '../server/templates/builtinTemplates.mjs';
import { deriveScript, deriveKeyframes, executeChain } from '../server/services/chainService.mjs';
import { CANVAS_ACTIONS } from '../src/pages/EcCanvas/canvasActionRegistry.js';
import {
  createCanvasSnapshot,
  restoreCanvasSnapshot,
  normalizeCanvasTimeline,
} from '../src/pages/EcCanvas/canvasSessionModel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ── 1. splice 图片拼接（真实 sharp，免费） ── */

async function makeTestImage({ width = 200, height = 100, r = 255, g = 0, b = 0 }) {
  return sharp({
    create: { width, height, channels: 3, background: { r, g, b } },
  }).png().toBuffer();
}

test('spliceImageStack: 2 张小图竖向 composite+flatten 出 1 张长图（真实 sharp, 0 付费）', async () => {
  const a = await makeTestImage({ width: 200, height: 100, r: 255, g: 0, b: 0 });
  const b = await makeTestImage({ width: 200, height: 50, r: 0, g: 0, b: 255 });
  const out = await spliceImageStack([a, b], { width: 200 });
  assert.ok(Buffer.isBuffer(out.buffer) && out.buffer.length > 0, '输出应为有效 buffer');
  assert.equal(out.count, 2);
  assert.equal(out.width, 200);
  assert.equal(out.height, 150, '无间距竖排: 100 + 50');
  const meta = await sharp(out.buffer).metadata();
  assert.equal(meta.width, 200);
  assert.equal(meta.height, 150);
  assert.equal(meta.format, 'png');
});

test('spliceImageStack: 统一宽度 resize + 段间留白', async () => {
  const a = await makeTestImage({ width: 100, height: 50 });
  const b = await makeTestImage({ width: 300, height: 100 });
  const out = await spliceImageStack([a, b], { width: 200, spacing: 10 });
  assert.equal(out.width, 200);
  /* a: 50*(200/100)=100; b: 100*(200/300)=66.67 -> 67; 间距 10 -> 177 */
  assert.equal(out.height, 100 + 67 + 10, 'resize 到统一宽 + 段间留白');
});

test('spliceImageStack: 少于 2 张报错（不假造单图）', async () => {
  const a = await makeTestImage({ width: 50, height: 50 });
  await assert.rejects(() => spliceImageStack([a], { width: 100 }), /at least 2 images/);
  await assert.rejects(() => spliceImageStack([], { width: 100 }), /at least 2 images/);
});

test('collectSpliceInputUrls: inputs + node.inputUrls + assets 去重保序', () => {
  const node = { inputUrls: ['/img/c.png', '/img/d.png'], assets: [{ url: '/img/d.png' }, { url: '/img/e.png' }] };
  const inputs = { n1: '/img/a.png', n2: '/img/b.png', n3: '' };
  assert.deepEqual(collectSpliceInputUrls(node, inputs), [
    '/img/a.png', '/img/b.png', '/img/c.png', '/img/d.png', '/img/e.png',
  ]);
});

test('isVideoSpliceInput: 任一输入是视频 -> 门控命中（kind 或 URL 扩展名）', () => {
  assert.equal(isVideoSpliceInput({ kind: 'video' }, {}), true);
  assert.equal(isVideoSpliceInput({}, { v1: 'https://x/clip.mp4' }), true);
  assert.equal(isVideoSpliceInput({ inputUrls: ['https://x/a.mov'] }, {}), true);
  assert.equal(isVideoSpliceInput({ kind: 'image' }, { i1: 'https://x/a.png', i2: 'https://x/b.webp' }), false);
});

test('splice handler: 多图进 -> 1 张长图出，免费 0 units（不变式①）', async () => {
  const a = await makeTestImage({ width: 200, height: 100 });
  const b = await makeTestImage({ width: 200, height: 50, r: 0, g: 200, b: 0 });
  const urlBySource = { 'u-a': a, 'u-b': b };
  let persisted = null;
  const executor = createCanvasGraphRunExecutor({
    readImage: async (url) => ({ buffer: urlBySource[url] }),
    persistSpliceOutput: async ({ buffer }) => {
      persisted = buffer;
      return { url: '/api/generated-assets/test-splice.png' };
    },
  });
  const node = { id: 'detail-splice', kind: 'image', actionId: 'splice', params: { width: 200 } };
  const inputs = { scene1: 'u-a', scene2: 'u-b' };
  const ctx = { kind: 'splice', nodeId: 'detail-splice', runId: 'run-test' };
  const result = await executor(node, inputs, ctx);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.outputUrl, '/api/generated-assets/test-splice.png');
  assert.equal(result.width, 200);
  assert.equal(result.height, 150);
  assert.equal(result.imageCount, 2);
  /* 免费路径: 执行器不回报 units -> 服务按 0 结算（绝不猜价） */
  assert.equal(result.units, undefined, 'splice 免费, 不得回报 units');
  assert.ok(persisted && Buffer.isBuffer(persisted), '产物 buffer 已持久化');
  const meta = await sharp(persisted).metadata();
  assert.equal(meta.height, 150);
  assert.equal(meta.width, 200);
});

test('splice handler: 视频输入走 P3.1 ffmpeg 门控错误（不烧上游、不提供扣费入口）', async () => {
  const executor = createCanvasGraphRunExecutor({
    readImage: async () => { throw new Error('视频拼接不应读图'); },
  });
  const node = { id: 'v-splice', kind: 'image', actionId: 'splice' };
  const outVideoUrl = await executor(node, { v1: 'https://x/clip1.mp4', v2: 'https://x/clip2.mov' }, { kind: 'splice' });
  assert.equal(outVideoUrl.ok, false);
  assert.equal(outVideoUrl.error, 'video splice requires ffmpeg env (P3.1)');
  const outVideoKind = await executor({ id: 'v2', kind: 'video', actionId: 'splice' }, { v1: 'u-a' }, { kind: 'splice' });
  assert.equal(outVideoKind.error, 'video splice requires ffmpeg env (P3.1)');
});

test('splice handler: 少于 2 张图输入报错（诚实不假造）', async () => {
  const a = await makeTestImage({ width: 10, height: 10 });
  const executor = createCanvasGraphRunExecutor({
    readImage: async () => ({ buffer: a }),
  });
  const result = await executor({ id: 's1', kind: 'image', actionId: 'splice' }, { only: 'u' }, { kind: 'splice' });
  assert.equal(result.ok, false);
  assert.match(result.error, /at least 2 image inputs/);
});

/* ── 2. 假能力诚实清理（不 mock 假跑 / 不假装走过） ── */

test('deriveScript: 返回体带显式 mock 标记（isMock/mock/provider=mock-placeholder, 占位不是真 LLM）', () => {
  const result = deriveScript({ prompt: '夏日海边咖啡', sceneCount: 3 });
  assert.equal(result.scenes, 3);
  assert.equal(result.isMock, true, '显式 isMock 标记');
  assert.equal(result.mock, true, '返回体 mock 标记');
  assert.equal(result.provider, 'mock-placeholder');
  assert.ok(String(result.note || '').includes('占位'), 'note 说明这是占位');
  /* 既有口径不破坏: 分镜结构不变 */
  assert.equal(result.script[0].shot, 'Enclosure');
  assert.equal(result.script[2].shot, 'Framing');
});

test('deriveKeyframes: 数组级 + 条目级 mock 标记（/mock/ 占位 URL 不假装真生图）', () => {
  const scriptResult = deriveScript({ prompt: '奶茶小店', sceneCount: 3 });
  const keyframes = deriveKeyframes({ script: scriptResult });
  assert.ok(Array.isArray(keyframes));
  assert.equal(keyframes.length, 3, '迭代口径不变');
  assert.equal(keyframes.isMock, true, '数组级显式标记');
  assert.equal(keyframes.mock, true);
  assert.equal(keyframes.provider, 'mock-placeholder');
  for (const frame of keyframes) {
    assert.ok(frame.keyframeUrl.startsWith('/mock/chain-keyframe-'), '占位 URL 口径不变');
    assert.equal(frame.isMock, true, '条目级标记');
  }
  /* JSON 序列化（路由返回体）后条目级标记仍在 —— 数组级附加属性 JSON.stringify 会丢,
     故诚实标记的持久口径 = 条目级 + 步骤级 + 顶层 (executeChain mockSteps), 三者可识别占位 */
  const parsed = JSON.parse(JSON.stringify(keyframes));
  assert.equal(parsed[0].isMock, true, '条目级标记在 JSON 返回体可识别');
  assert.equal(parsed[0].provider, 'mock-placeholder');
  assert.equal(parsed.length, 3);
});

test('executeChain: 默认占位链全步 mock 标记（0 真上游调用, 不静默假装走过）', async () => {
  const result = await executeChain({ text: '夏日海边咖啡', subtitleStyle: 'simple' });
  assert.equal(result.ok, true);
  assert.equal(result.isMock, true, '顶层 isMock 标记');
  assert.equal(result.mock, true, '默认链 4 步全占位');
  assert.deepEqual(result.mockSteps, ['script', 'keyframe', 'video', 'audio']);
  assert.equal(result.provider, 'mock-placeholder');
  for (const step of result.steps) {
    assert.equal(step.mock, true, 'step ' + step.step + ' 应显式 mock');
  }
});

test('executeChain: 注入 providerRegistry 后 video 步转真（标记随之收窄, 其余仍诚实标注）', async () => {
  const fakeRegistry = {
    get: () => ({ submit: async (payload, key) => ({ id: 'task-real-1', progress: 5 }) }),
  };
  const result = await executeChain({ text: 'test', providerRegistry: fakeRegistry });
  assert.equal(result.isMock, true, 'script/keyframe/audio 仍是占位');
  assert.equal(result.mock, false, 'video 步已走真 provider, 不再是全占位');
  assert.ok(!result.mockSteps.includes('video'), 'video 移出 mockSteps');
  assert.ok(result.mockSteps.includes('script'));
  assert.ok(result.mockSteps.includes('keyframe'));
});

/* ── 3. 悬空路由清零（注册表 execute.route 全部有 handler） ── */

function collectServerRoutePaths() {
  const routes = new Set();
  const re = /\bapp\.(get|post|put|delete)\(\s*['"\u0060]([^'"\u0060]+)['"\u0060]/g;
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue;
      if (entry.name.startsWith('cache') || entry.name.startsWith('generated-assets')
        || entry.name.startsWith('extension_downloads') || entry.name.startsWith('video-assets')
        || entry.name.startsWith('uploads')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.name.endsWith('.mjs') && !entry.name.endsWith('.js')) continue;
      let source = '';
      try {
        source = readFileSync(full, 'utf8');
      } catch {
        continue;
      }
      for (const match of source.matchAll(re)) routes.add(match[2]);
    }
  };
  walk(join(ROOT, 'server'));
  return routes;
}

test('动作注册表悬空路由清零: 每个 execute.route 在 server 路由表存在（one-click-video / tts 原悬空两条已消除）', () => {
  const routes = collectServerRoutePaths();
  assert.ok(routes.has('/api/canvas/one-click-video'), 'POST /api/canvas/one-click-video 已实现（chainService 4 步占位链）');
  assert.ok(routes.has('/api/canvas/tts'), 'POST /api/canvas/tts 已实现（ttsBridge 诚实门控）');
  assert.ok(routes.has('/api/canvas/caption'), '/api/canvas/caption 既有路由仍在');
  const dangling = [];
  for (const action of CANVAS_ACTIONS) {
    const route = action.execute && action.execute.route;
    if (typeof route !== 'string' || !route.startsWith('/api/')) continue;
    if (!routes.has(route)) dangling.push(action.id + ' -> ' + route);
  }
  assert.deepEqual(dangling, [], '动作注册表不允许再留悬空路由: ' + dangling.join(', '));
});

/* ── 4. timeline 字段位（向后兼容, 老 snapshot 无字段照常加载） ── */

test('createCanvasSnapshot: 不带 timeline 字段位 -> 字段缺失（老口径不变）', () => {
  const snapshot = createCanvasSnapshot({
    nodes: [{ id: 'n1', kind: 'image', url: '/a.png' }],
    connections: [],
    viewport: { x: 0, y: 0, scale: 1 },
  });
  assert.equal('timeline' in snapshot, false, '未传 timeline 不落字段');
  const restored = restoreCanvasSnapshot(snapshot);
  assert.equal(restored.nodes.length, 1);
  assert.equal('timeline' in restored, false);
});

test('老 snapshot（无 timeline 字段）加载不报错（不变式② 老文档只读可用）', () => {
  const legacy = {
    nodes: [{ id: 'old-1', kind: 'text', text: '老数据' }],
    connections: [{ id: 'e1', fromNodeId: 'old-1', toNodeId: 'old-2' }],
    viewport: { x: 80, y: 40, scale: 1 },
  };
  const restored = restoreCanvasSnapshot(legacy);
  assert.equal(restored.nodes[0].id, 'old-1');
  assert.equal(restored.connections.length, 1);
  assert.equal('timeline' in restored, false, '不补造 timeline');
});

test('createCanvasSnapshot: 合法 timeline 落字段（video/audio 轨道 + nodeId/start/end）', () => {
  const snapshot = createCanvasSnapshot({
    nodes: [{ id: 'v1', kind: 'video' }, { id: 'a1', kind: 'audio' }],
    connections: [],
    timeline: {
      tracks: [
        { kind: 'video', items: [{ nodeId: 'v1', start: 0, end: 5000 }] },
        { kind: 'audio', items: [{ nodeId: 'a1', start: 0, end: 3000 }, { nodeId: '', start: 1, end: 2 }] },
      ],
    },
  });
  assert.equal(snapshot.timeline.tracks.length, 2);
  assert.deepEqual(snapshot.timeline.tracks[0].items, [{ nodeId: 'v1', start: 0, end: 5000 }]);
  assert.deepEqual(snapshot.timeline.tracks[1].items, [{ nodeId: 'a1', start: 0, end: 3000 }], '非法 item (空 nodeId) 被过滤');
  /* 向后兼容往返: restore 归一化透传 */
  const restored = restoreCanvasSnapshot(snapshot);
  assert.deepEqual(restored.timeline, snapshot.timeline);
});

test('normalizeCanvasTimeline: 非法输入一律不落字段（不造假数据）', () => {
  assert.equal(normalizeCanvasTimeline(undefined), undefined);
  assert.equal(normalizeCanvasTimeline(null), undefined);
  assert.equal(normalizeCanvasTimeline('tracks'), undefined);
  assert.equal(normalizeCanvasTimeline({}), undefined);
  assert.equal(normalizeCanvasTimeline({ tracks: [] }), undefined);
  assert.equal(normalizeCanvasTimeline({ tracks: [{ kind: 'image', items: [] }] }), undefined, '非 video/audio 轨道不认');
  assert.equal(normalizeCanvasTimeline({ tracks: [{ kind: 'video', items: [{ nodeId: 'x' }] }] }).tracks[0].items[0].start, 0, '缺省 start/end = 0');
});

/* ── 5. T4/T5 诚实门控（音视频真生成 = P3.1, 本期不开放） ── */

test('门控: splice 进白名单; video-composer/tts/lip-sync 保持 unsupported（P3.1）', () => {
  assert.ok(SUPPORTED_GRAPH_RUN_KINDS.includes('splice'), 'splice 已接线');
  for (const gated of ['video-composer', 'tts', 'lip-sync', 'video', 'audio']) {
    assert.ok(!SUPPORTED_GRAPH_RUN_KINDS.includes(gated), gated + ' 必须保持 P3 白名单外');
  }
  const nodes = [
    { id: 'vc', kind: 'image', actionId: 'video-composer' },
    { id: 't', kind: 'audio', actionId: 'tts' },
    { id: 'ls', kind: 'video', actionId: 'lip-sync' },
    { id: 'sp', kind: 'image', actionId: 'splice' },
  ];
  const plan = buildRunPlan({ nodes, connections: [] });
  assert.deepEqual(plan.executableNodeIds, ['sp'], '只有 splice 可执行');
  assert.deepEqual(plan.unsupportedNodeIds.sort(), ['ls', 't', 'vc'], '音视频生成类全部门控');
});

test('门控: 执行器对 lip-sync 等无扣费入口（未接线 kind 一律 executor not wired, 0 成本）', async () => {
  const executor = createCanvasGraphRunExecutor({});
  for (const kind of ['lip-sync', 'video-composer', 'tts']) {
    const out = await executor({ id: 'x', kind }, {}, { kind });
    assert.equal(out.ok, false);
    assert.equal(out.error, 'executor not wired for kind ' + kind, '未接线 = 无扣费入口');
  }
});

test('P2 T3 模板: detail-splice 节点本期可跑（plan 层 executable, 白名单已含 splice）', () => {
  const t3 = BUILTIN_WORKFLOW_TEMPLATES.find(t => t.slug === 'scene-detail');
  const plan = buildRunPlan({ nodes: t3.graph.nodes, connections: t3.graph.connections });
  assert.ok(plan.executableNodeIds.includes('detail-splice'), 'T3 详情拼接节点可执行');
  assert.equal(t3.requiresAudioVideo, false, 'T3 requiresAudioVideo 门控口径不变');
});
