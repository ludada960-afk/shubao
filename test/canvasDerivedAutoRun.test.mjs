import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANVAS_COPYWRITING_PROMPT,
  buildCanvasCopywritingRequest,
  findUpstreamCanvasCopy,
  normalizeCanvasCopywritingResult,
  resolveDerivedVideoPrompt,
} from '../src/pages/EcCanvas/canvasDerivedAutoRun.js';

const textNode = (id, text, extra = {}) => ({ id, kind: 'text', text, status: 'ready', ...extra });
const edge = (from, to) => ({ fromNodeId: from, toNodeId: to });

test('P0-1 findUpstreamCanvasCopy finds the direct text parent', () => {
  const nodes = [
    { id: 'img', kind: 'image', url: 'a.png', status: 'ready' },
    textNode('copy_1', '轻若无感 透气一整天'),
    { id: 'video_1', kind: 'video-composer', status: 'ready' },
  ];
  const connections = [edge('img', 'copy_1'), edge('copy_1', 'video_1')];
  const result = findUpstreamCanvasCopy({ nodes, connections, nodeId: 'video_1' });
  assert.deepEqual(result, { nodeId: 'copy_1', text: '轻若无感 透气一整天' });
});

test('P0-2 findUpstreamCanvasCopy walks the chain and picks the nearest copy', () => {
  const nodes = [
    { id: 'img', kind: 'image', url: 'a.png', status: 'ready' },
    textNode('copy_1', '第一段文案'),
    { id: 'frame', kind: 'image', url: 'b.png', status: 'ready' },
    textNode('copy_2', '第二段文案'),
  ];
  const connections = [
    edge('img', 'copy_1'),
    edge('copy_1', 'frame'),
    edge('frame', 'copy_2'),
  ];
  /* 从视频(挂在 copy_2 下)向上: 无入边时没有任何上游 */
  const result = findUpstreamCanvasCopy({ nodes, connections, nodeId: 'video_1' });
  assert.equal(result, null);
  /* 视频节点连在 copy_2 之后 */
  const withVideo = findUpstreamCanvasCopy({
    nodes,
    connections: [...connections, edge('copy_2', 'video_1')],
    nodeId: 'video_1',
  });
  assert.deepEqual(withVideo, { nodeId: 'copy_2', text: '第二段文案' });
  /* 图节点向上跨两级找到文案 */
  const fromFrame = findUpstreamCanvasCopy({ nodes, connections, nodeId: 'frame' });
  assert.deepEqual(fromFrame, { nodeId: 'copy_1', text: '第一段文案' });
});

test('P0-1 findUpstreamCanvasCopy skips empty text nodes and non-ready status', () => {
  const nodes = [
    { id: 'img', kind: 'image', url: 'a.png', status: 'ready' },
    textNode('copy_empty', '   '),
    textNode('copy_running', '生成中的文案', { status: 'running' }),
    textNode('copy_ok', '可用文案'),
    { id: 'video_1', kind: 'video-composer', status: 'ready' },
  ];
  const connections = [
    edge('img', 'copy_empty'),
    edge('copy_empty', 'copy_running'),
    edge('copy_running', 'copy_ok'),
    edge('copy_ok', 'video_1'),
  ];
  /* 从 video 向上: empty / running 都不可用, 命中 ready 的 copy_ok */
  const result = findUpstreamCanvasCopy({ nodes, connections, nodeId: 'video_1' });
  assert.deepEqual(result, { nodeId: 'copy_ok', text: '可用文案' });
  /* 链上没有任何可用文案时返回 null */
  const nodesWithoutOk = nodes.filter(node => node.id !== 'copy_ok');
  const result2 = findUpstreamCanvasCopy({
    nodes: nodesWithoutOk,
    connections: [edge('img', 'copy_empty'), edge('copy_empty', 'copy_running'), edge('copy_running', 'video_1')],
    nodeId: 'video_1',
  });
  assert.equal(result2, null);
});

test('P0-1 findUpstreamCanvasCopy survives cyclic connections', () => {
  const nodes = [
    { id: 'a', kind: 'image', url: 'a.png', status: 'ready' },
    { id: 'b', kind: 'image', url: 'b.png', status: 'ready' },
  ];
  const connections = [edge('a', 'b'), edge('b', 'a')];
  const result = findUpstreamCanvasCopy({ nodes, connections, nodeId: 'a' });
  assert.equal(result, null);
});

test('P0-1 buildCanvasCopywritingRequest sends the image as a reference', () => {
  const source = { id: 'img', kind: 'image', url: 'https://cdn/a.png', status: 'ready' };
  const request = buildCanvasCopywritingRequest({ source });
  assert.ok(request.prompt.startsWith(CANVAS_COPYWRITING_PROMPT));
  assert.deepEqual(request.referenceImages, ['https://cdn/a.png']);
  assert.deepEqual(request.references, []);
});

test('P0-1 buildCanvasCopywritingRequest folds direction hints into the prompt', () => {
  const source = {
    id: 'img',
    kind: 'image',
    url: 'https://cdn/a.png',
    status: 'ready',
    direction: { purpose: '主图种草', composition: '主体居中', copy: '' },
  };
  const request = buildCanvasCopywritingRequest({ source });
  assert.ok(request.prompt.includes('主图种草'));
  assert.ok(request.prompt.includes('主体居中'));
});

test('P0-1 buildCanvasCopywritingRequest folds source text for text nodes', () => {
  const source = textNode('copy_1', '旧文案基调', { url: '' });
  const request = buildCanvasCopywritingRequest({ source });
  assert.ok(request.prompt.includes('旧文案基调'));
  assert.deepEqual(request.referenceImages, [], 'text source has no image reference');
});

test('P0-1 normalizeCanvasCopywritingResult returns trimmed text and rejects blanks', () => {
  assert.equal(normalizeCanvasCopywritingResult({ text: '  成品文案  ' }), '成品文案');
  assert.throws(() => normalizeCanvasCopywritingResult({ text: '  ' }), /文案生成失败/);
  assert.throws(() => normalizeCanvasCopywritingResult({ text: '', error: '积分不足' }), /积分不足/);
});

test('P0-2 resolveDerivedVideoPrompt fills the video composer from upstream copy', () => {
  const nodes = [
    { id: 'img', kind: 'image', url: 'a.png', status: 'ready' },
    textNode('copy_1', '轻若无感 透气一整天'),
  ];
  const connections = [edge('img', 'copy_1'), edge('copy_1', 'video_1')];
  assert.equal(resolveDerivedVideoPrompt({ nodes, connections, sourceNodeId: 'video_1' }), '轻若无感 透气一整天');
  assert.equal(resolveDerivedVideoPrompt({ nodes, connections: [], sourceNodeId: 'video_1' }), '');
});

/* ── P0-3 TTS 配音执行链 ── */
import {
  CANVAS_TTS_DEFAULT_SCRIPT,
  buildCanvasTtsRequest,
  normalizeCanvasAudioNodeFromTts,
} from '../src/pages/EcCanvas/canvasDerivedAutoRun.js';

test('P0-3 buildCanvasTtsRequest prefers upstream copy over the video prompt', () => {
  const source = { id: 'video_1', kind: 'video', inputs: { prompt: '画面里有海' } };
  assert.deepEqual(
    buildCanvasTtsRequest({ source, upstream: { nodeId: 'copy_1', text: '正式口播稿' } }),
    { text: '正式口播稿', provider: null },
  );
  assert.deepEqual(
    buildCanvasTtsRequest({ source, upstream: null }),
    { text: '画面里有海', provider: null },
    '没有上游文案时回退到视频 prompt',
  );
});

test('P0-3 buildCanvasTtsRequest falls back to a default script so the chain always runs', () => {
  const request = buildCanvasTtsRequest({ source: { id: 'video_1', kind: 'video' }, upstream: null });
  assert.equal(request.text, CANVAS_TTS_DEFAULT_SCRIPT);
  assert.ok(request.text.length > 10);
});

test('P0-3 normalizeCanvasAudioNodeFromTts builds a playable audio node', () => {
  const sourceNode = { id: 'video_1', kind: 'video', x: 100, y: 200, w: 360, group: '素材' };
  const node = normalizeCanvasAudioNodeFromTts({
    tts: { audioUrl: 'data:audio/wav;base64,UklGR', provider: 'volcengine', durationMs: 3200, costCny: 0.01 },
    sourceNode,
  });
  assert.equal(node.kind, 'audio');
  assert.equal(node.status, 'ready');
  assert.equal(node.url, 'data:audio/wav;base64,UklGR');
  assert.equal(node.sourceNodeIds[0], 'video_1');
  assert.equal(node.w, 264);
  assert.equal(node.h, 72);
  assert.equal(node.x, 100 + 360 + 28, 'falls back to the right of the source');
  assert.equal(node.y, 200);
  assert.equal(node.ttsProvider, 'volcengine');
  assert.ok(node.name.includes('volcengine'));
});

test('P0-3 normalizeCanvasAudioNodeFromTts honors explicit position and rejects empty audio', () => {
  const node = normalizeCanvasAudioNodeFromTts({
    tts: { audioUrl: 'data:audio/wav;base64,UklGR', provider: 'mock' },
    sourceNode: { id: 'video_1', kind: 'video' },
    position: { x: 12, y: 34 },
  });
  assert.equal(node.x, 12);
  assert.equal(node.y, 34);
  assert.throws(() => normalizeCanvasAudioNodeFromTts({ tts: {}, sourceNode: null }), /音频地址/);
});

/* ── P0-4 字幕动效执行链 ── */
import {
  CANVAS_CAPTION_STYLES,
  buildCanvasCaptionRequest,
  normalizeCanvasSubtitleNodes,
} from '../src/pages/EcCanvas/canvasDerivedAutoRun.js';

test('P0-4 buildCanvasCaptionRequest prefers upstream copy over the video prompt', () => {
  const source = { id: 'video_1', kind: 'video', inputs: { prompt: '画面里有海' } };
  assert.deepEqual(
    buildCanvasCaptionRequest({ source, upstream: { nodeId: 'copy_1', text: '正式口播稿' } }),
    { text: '正式口播稿', scene_count: 3, style: 'simple', duration_ms: 8000 },
  );
  assert.deepEqual(
    buildCanvasCaptionRequest({ source, upstream: null }),
    { text: '画面里有海', scene_count: 3, style: 'simple', duration_ms: 8000 },
    '没有上游文案时回退到视频 prompt',
  );
});

test('P0-4 buildCanvasCaptionRequest honors explicit sceneCount/style/duration', () => {
  const req = buildCanvasCaptionRequest({
    source: { id: 'video_1', kind: 'video' },
    upstream: { nodeId: 'copy_1', text: '文案' },
    sceneCount: 5,
    style: 'kinetic',
    durationMs: 12000,
  });
  assert.equal(req.scene_count, 5);
  assert.equal(req.style, 'kinetic');
  assert.equal(req.duration_ms, 12000);
});

test('P0-4 buildCanvasCaptionRequest clamps out-of-range values', () => {
  const req = buildCanvasCaptionRequest({ source: { id: 'v', kind: 'video' }, upstream: { nodeId: 'c', text: 't' }, sceneCount: 99, durationMs: 500 });
  assert.equal(req.scene_count, 12, 'sceneCount 上限 12');
  assert.equal(req.duration_ms, 1000, 'durationMs 下限 1000');
});

test('P0-4 CANVAS_CAPTION_STYLES lists 5 styles', () => {
  assert.equal(CANVAS_CAPTION_STYLES.length, 5);
  assert.ok(CANVAS_CAPTION_STYLES.some(s => s.key === 'simple'));
  assert.ok(CANVAS_CAPTION_STYLES.some(s => s.key === 'kinetic'));
});

test('P0-4 normalizeCanvasSubtitleNodes builds a subtitle node', () => {
  const sourceNode = { id: 'video_1', kind: 'video', x: 100, y: 200, w: 360, h: 240, group: '素材' };
  const node = normalizeCanvasSubtitleNodes({
    caption: {
      subtitles: [
        { sceneIndex: 0, startChar: 0, endChar: 4, startTimeMs: 0, endTimeMs: 4000, text: '第一段', style: 'simple' },
        { sceneIndex: 1, startChar: 4, endChar: 8, startTimeMs: 4000, endTimeMs: 8000, text: '第二段', style: 'simple' },
      ],
      subtitleStyle: 'simple',
      textChars: 8,
      sceneCount: 2,
      totalDurationMs: 8000,
    },
    sourceNode,
  });
  assert.equal(node.kind, 'subtitle');
  assert.equal(node.status, 'ready');
  assert.equal(node.captionStyle, 'simple');
  assert.equal(node.sceneCount, 2);
  assert.equal(node.firstText, '第一段');
  assert.equal(node.x, 100 + 360 + 28, 'falls back to the right of the source');
  assert.equal(node.y, 200 + 240 + 16, 'below the source');
  assert.ok(node.name.includes('字幕动效'));
});

test('P0-4 normalizeCanvasSubtitleNodes honors explicit position and rejects empty subtitles', () => {
  const node = normalizeCanvasSubtitleNodes({
    caption: { subtitles: [{ sceneIndex: 0, text: '唯一段', style: 'kinetic' }], subtitleStyle: 'kinetic' },
    sourceNode: { id: 'video_1', kind: 'video' },
    position: { x: 50, y: 60 },
  });
  assert.equal(node.x, 50);
  assert.equal(node.y, 60);
  assert.equal(node.captionStyle, 'kinetic');
  assert.throws(() => normalizeCanvasSubtitleNodes({ caption: { subtitles: [] }, sourceNode: null }), /字幕生成/);
});
