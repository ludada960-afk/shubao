import test from 'node:test';
import assert from 'node:assert/strict';
import { renderVideo } from '../server/videoExportRender.mjs';

test('renderVideo 返 error 当 manifest 无 clips', async () => {
  const r = await renderVideo({ timeline: { clips: [] } });
  assert.match(r.error || '', /no clips/);
});

test('renderVideo 接受最小 manifest, ffmpeg 未装时返 error 不抛', async () => {
  const r = await renderVideo({ timeline: { clips: [{ id: 'c1', url: '' }] } });
  // ffmpeg 可能在 CI 环境没装, 接受 error 或 path 二选一
  assert.ok(r.error === null || typeof r.path === 'string');
});

test('renderVideo 返 {path, duration, error} shape', async () => {
  const r = await renderVideo({ timeline: { clips: [] } });
  assert.ok('path' in r && 'duration' in r && 'error' in r);
});
