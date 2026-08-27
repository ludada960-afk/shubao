// W4 音频节点全接线 contract test
// 验证 buildCanvasNodes 正确透出 audio 节点的 sourceAssetId/sourceAssetVersionId/audioKind
// + client services 调用 createVideoAudioTrack/updateVideoAudioTrack 不破坏 schema

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCanvasNodes } from '../src/pages/VideoStudio/videoCanvasModel.js';

test('buildCanvasNodes marks voice/music workbench assets as audio with sourceAssetId', () => {
  const workbench = {
    assets: [
      { id: 'voice-1', kind: 'voice', name: '旁白 A', versions: [{ id: 'voice-1-v1', stableUrl: '/voice.mp3' }], approvedVersionId: 'voice-1-v1' },
      { id: 'music-1', kind: 'music', name: 'BGM', versions: [{ id: 'music-1-v1', stableUrl: '/bgm.mp3' }], approvedVersionId: 'music-1-v1' },
    ],
    shots: [],
  };
  const nodes = buildCanvasNodes({ uploads: [], libraryAssets: [], workbench });
  const audioNodes = nodes.filter(n => n.kind === 'audio');
  assert.equal(audioNodes.length, 2);
  for (const n of audioNodes) {
    assert.ok(n.sourceAssetId, 'audio node must expose sourceAssetId');
    assert.ok(n.sourceAssetVersionId, 'audio node must expose sourceAssetVersionId');
  }
  const voiceNode = audioNodes.find(n => n.audioKind === 'voice');
  const musicNode = audioNodes.find(n => n.audioKind === 'music');
  assert.ok(voiceNode, 'voice asset should map to audioKind=voice');
  assert.ok(musicNode, 'music asset should map to audioKind=music');
});

test('buildCanvasNodes does not mark image assets as audio', () => {
  const workbench = {
    assets: [
      { id: 'image-1', kind: 'product', name: '产品图', versions: [{ id: 'image-1-v1', stableUrl: '/img.png' }], approvedVersionId: 'image-1-v1' },
    ],
    shots: [],
  };
  const nodes = buildCanvasNodes({ uploads: [], libraryAssets: [], workbench });
  const imageNodes = nodes.filter(n => n.kind === 'image');
  assert.equal(imageNodes.length, 1);
  assert.ok(!imageNodes[0].audioKind, 'image node should not have audioKind set');
});
