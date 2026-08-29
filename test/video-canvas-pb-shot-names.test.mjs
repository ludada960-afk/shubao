// P-B 电影分镜命名契约测试 (4c183cd4 续命 / 1-2 天)
// 覆盖 6 类: Enclosure / Breakthrough / Voice / Track / Framing / Overture
// image → Enclosure, video → Breakthrough, audio voice → Voice, audio music → Track, shot → Framing, candidate → Overture
// 任务规范里的 text → Caption, group → Sequence 保留在 canvasNames.js 表中, 当前画布未触发
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCanvasNodes,
} from '../src/pages/VideoStudio/videoCanvasModel.js';
import {
  CANVAS_SHOT_PREFIXES,
  formatCanvasShotName,
  resolveShotPrefix,
} from '../src/constants/canvasNames.js';

test('P-B: 6 类电影分镜前缀全部存在', () => {
  assert.equal(CANVAS_SHOT_PREFIXES.image, 'Enclosure');
  assert.equal(CANVAS_SHOT_PREFIXES.video, 'Breakthrough');
  assert.equal(CANVAS_SHOT_PREFIXES.audio, 'Voice');
  assert.equal(CANVAS_SHOT_PREFIXES.shot, 'Framing');
  assert.equal(CANVAS_SHOT_PREFIXES.candidate, 'Overture');
  assert.equal(CANVAS_SHOT_PREFIXES.voice, 'Voice');
  assert.equal(CANVAS_SHOT_PREFIXES.music, 'Track');
  // 任务规范保留
  assert.equal(CANVAS_SHOT_PREFIXES.text, 'Caption');
  assert.equal(CANVAS_SHOT_PREFIXES.group, 'Sequence');
});

test('P-B: formatCanvasShotName 三位补零, 自增', () => {
  assert.equal(formatCanvasShotName('image', 1), 'Enclosure-001');
  assert.equal(formatCanvasShotName('image', 42), 'Enclosure-042');
  assert.equal(formatCanvasShotName('video', 7), 'Breakthrough-007');
  assert.equal(formatCanvasShotName('shot', 3), 'Framing-003');
  // 非法 counter 兜底为 1
  assert.equal(formatCanvasShotName('image', 0), 'Enclosure-001');
  assert.equal(formatCanvasShotName('image', NaN), 'Enclosure-001');
  // 未知前缀兜底为 Shot
  assert.equal(formatCanvasShotName('unknown', 1), 'Shot-001');
});

test('P-B: resolveShotPrefix 按 kind / subKind / type 路由到 6 类', () => {
  assert.equal(resolveShotPrefix({ kind: 'image' }), 'image');
  assert.equal(resolveShotPrefix({ kind: 'video' }), 'video');
  assert.equal(resolveShotPrefix({ kind: 'audio' }), 'audio');
  assert.equal(resolveShotPrefix({ kind: 'audio', subKind: 'voice' }), 'voice');
  assert.equal(resolveShotPrefix({ kind: 'audio', subKind: 'music' }), 'music');
  assert.equal(resolveShotPrefix({ type: 'shot' }), 'shot');
  assert.equal(resolveShotPrefix({ type: 'candidate' }), 'candidate');
  assert.equal(resolveShotPrefix({ kind: 'text' }), 'text');
  assert.equal(resolveShotPrefix({ kind: 'group' }), 'group');
});

test('P-B: buildCanvasNodes 无名兜底走电影分镜命名 (asset image → Enclosure-001)', () => {
  const nodes = buildCanvasNodes({
    uploads: [{ asset: { id: 'u1', kind: 'image', url: 'https://x/1' }, file: null }],
    libraryAssets: [],
    workbench: null,
  });
  const u1 = nodes.find(n => n.id === 'asset:upload:u1');
  assert.ok(u1);
  assert.equal(u1.title, 'Enclosure-001');
});

test('P-B: buildCanvasNodes video asset 兜底 Breakthrough-001', () => {
  const nodes = buildCanvasNodes({
    uploads: [{ asset: { id: 'v1', kind: 'video', url: 'https://x/v' }, file: null }],
    libraryAssets: [],
    workbench: null,
  });
  assert.equal(nodes[0].title, 'Breakthrough-001');
});

test('P-B: buildCanvasNodes library image 兜底 Enclosure-002 (counter 续)', () => {
  const nodes = buildCanvasNodes({
    uploads: [],
    libraryAssets: [{ projectAssetId: 'lib1', mediaKind: 'image', sourceProject: { id: 'p' } }],
    workbench: null,
  });
  assert.equal(nodes[0].title, 'Enclosure-002');
});

test('P-B: workbench voice 节点 → Voice-001, music 节点 → Track-001', () => {
  const nodes = buildCanvasNodes({
    uploads: [],
    libraryAssets: [],
    workbench: {
      assets: [
        { id: 'wa-voice', kind: 'voice', name: '', approvedVersionId: 'wv', versions: [{ id: 'wv', stableUrl: 'https://x/a' }] },
        { id: 'wa-music', kind: 'music', name: '', approvedVersionId: 'wm', versions: [{ id: 'wm', stableUrl: 'https://x/b' }] },
      ],
      shots: [],
    },
  });
  const voice = nodes.find(n => n.id === 'asset:workbench:wa-voice');
  const music = nodes.find(n => n.id === 'asset:workbench:wa-music');
  assert.equal(voice.title, 'Voice-001');
  assert.equal(voice.audioKind, 'voice');
  assert.equal(music.title, 'Track-001');
  assert.equal(music.audioKind, 'music');
});

test('P-B: shot 节点 → Framing-NNN, candidate 节点 → Overture-NNN', () => {
  const nodes = buildCanvasNodes({
    uploads: [],
    libraryAssets: [],
    workbench: {
      assets: [],
      shots: [
        { id: 's1', position: 0, purpose: '', candidates: [{ id: 'c1', stableUrl: 'https://x/c' }] },
        { id: 's2', position: 1, purpose: '' },
      ],
    },
  });
  const s1 = nodes.find(n => n.id === 'shot:s1');
  const s2 = nodes.find(n => n.id === 'shot:s2');
  const c1 = nodes.find(n => n.id === 'candidate:s1:c1');
  assert.equal(s1.title, 'Framing-001');
  assert.equal(s2.title, 'Framing-002');
  assert.equal(c1.title, 'Overture-001');
});

test('P-B: 真实文件名 / purpose 仍然优先, 不被电影分镜命名覆盖', () => {
  const nodes = buildCanvasNodes({
    uploads: [{ asset: { id: 'u1', kind: 'image', url: 'https://x/1' }, file: { name: 'hero.png' } }],
    libraryAssets: [{ projectAssetId: 'lib1', mediaKind: 'image', displayName: '参考图A', sourceProject: { id: 'p' } }],
    workbench: {
      assets: [{ id: 'wa1', kind: 'product', name: '商品主图', approvedVersionId: 'wv1', versions: [{ id: 'wv1', stableUrl: 'https://x/2' }] }],
      shots: [{ id: 's1', position: 0, purpose: '开场', candidates: [] }],
    },
  });
  assert.equal(nodes.find(n => n.id === 'asset:upload:u1').title, 'hero.png');
  assert.equal(nodes.find(n => n.id === 'asset:library:p:lib1').title, '参考图A');
  assert.equal(nodes.find(n => n.id === 'asset:workbench:wa1').title, '商品主图');
  assert.equal(nodes.find(n => n.id === 'shot:s1').title, '开场');
});

test('P-B: 6 类前缀全 1 同屏, 验证 6 类在同一次构建中同时出现', () => {
  const nodes = buildCanvasNodes({
    uploads: [
      { asset: { id: 'ui', kind: 'image' }, file: null },
      { asset: { id: 'uv', kind: 'video' }, file: null },
    ],
    libraryAssets: [{ projectAssetId: 'li', mediaKind: 'image', sourceProject: { id: 'p' } }],
    workbench: {
      assets: [
        { id: 'wv', kind: 'voice', name: '', approvedVersionId: 'vv', versions: [{ id: 'vv' }] },
        { id: 'wm', kind: 'music', name: '', approvedVersionId: 'vm', versions: [{ id: 'vm' }] },
      ],
      shots: [
        { id: 's1', position: 0, purpose: '', candidates: [{ id: 'c1' }] },
      ],
    },
  });
  const titles = nodes.map(n => n.title);
  // 至少包含 6 类前缀各一次: Enclosure, Breakthrough, Voice, Track, Framing, Overture
  assert.ok(titles.some(t => /^Enclosure-\d{3}$/.test(t)), '缺 Enclosure: ' + titles.join(','));
  assert.ok(titles.some(t => /^Breakthrough-\d{3}$/.test(t)), '缺 Breakthrough: ' + titles.join(','));
  assert.ok(titles.some(t => /^Voice-\d{3}$/.test(t)), '缺 Voice: ' + titles.join(','));
  assert.ok(titles.some(t => /^Track-\d{3}$/.test(t)), '缺 Track: ' + titles.join(','));
  assert.ok(titles.some(t => /^Framing-\d{3}$/.test(t)), '缺 Framing: ' + titles.join(','));
  assert.ok(titles.some(t => /^Overture-\d{3}$/.test(t)), '缺 Overture: ' + titles.join(','));
});
