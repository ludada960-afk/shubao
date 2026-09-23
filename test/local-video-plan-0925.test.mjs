import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLocalRenderManifest, billableSecondsOf, normalizeOutputResolution, normalizeRegion } from '../server/localVideoPlan.mjs';
import { buildFilterChain } from '../server/videoExportRender.mjs';

/* ═══ 2026-09-25 批 AK：本地方案的渲染清单构造器 ═══════════════════════════════════════════════
   用户口径：「全部做完呀，为什么又停下来呢，你不能持续做完需求任务吗」
   —— 这是"用户输入 → 清单"那一层的落地，纯函数、可逐值断言；接上派发层就能真出片。 */

test('① 视频高清：只给源 + 分辨率 ⇒ 清单里只有 output，且能直接喂给渲染层', () => {
  const manifest = buildLocalRenderManifest({ sourceUrl: 'https://x/a.mp4', resolution: '1080p' });
  assert.deepEqual(manifest.timeline.clips, [{ url: 'https://x/a.mp4' }]);
  assert.deepEqual(manifest.output, { resolution: '1080p' });
  assert.equal(buildFilterChain(manifest).filterComplex, '[0:v]concat=n=1:v=1[outv];[outv]scale=-2:1080:flags=lanczos[final]');
});

test('② 去字幕：只给源 + 框选区域 ⇒ 清单里只有 replace，滤镜链先擦除（不缩放）', () => {
  const manifest = buildLocalRenderManifest({ sourceUrl: 'a.mp4', regions: [{ x: 40, y: 900, w: 1200, h: 120 }] });
  assert.deepEqual(manifest.replace, [{ type: 'delogo', x: 40, y: 900, w: 1200, h: 120 }]);
  assert.equal(manifest.output, undefined);
  assert.match(buildFilterChain(manifest).filterComplex, /delogo=x=40:y=900:w=1200:h=120\[final\]$/);
});

test('③ 两件一起做（先擦后缩）与非法输入的处理', () => {
  const both = buildLocalRenderManifest({ sourceUrl: 'a.mp4', resolution: '2K', fps: 60, regions: [{ x: 0, y: 0, w: 100, h: 30 }] });
  assert.deepEqual(both.output, { resolution: '1440p', fps: 60 });
  assert.equal(buildFilterChain(both).filterComplex,
    '[0:v]concat=n=1:v=1[outv];[outv]delogo=x=0:y=0:w=100:h=30,scale=-2:1440:flags=lanczos,fps=60[final]');
  /* 非法区域被丢掉；只剩非法区域 + 没有规格 ⇒ 整个方案不成立（拒绝） */
  assert.equal(normalizeRegion({ x: -1, y: 0, w: 100, h: 100 }), null);
  assert.deepEqual(buildLocalRenderManifest({ sourceUrl: 'a.mp4', regions: [{ x: -1 }] , resolution: '720p' }).replace, undefined);
  assert.throws(() => buildLocalRenderManifest({ sourceUrl: 'a.mp4', regions: [{ x: -1 }] }), /至少需要一个规格/);
});

test('④ 白名单与兜底：不认识的写法不缩放、没有源直接拒绝、时长有上限', () => {
  assert.equal(normalizeOutputResolution('999p'), '');
  assert.equal(normalizeOutputResolution('1080P'), '1080p');
  assert.equal(normalizeOutputResolution('4k'), '2160p');
  assert.throws(() => buildLocalRenderManifest({ resolution: '1080p' }), /需要一个视频源/);
  assert.throws(() => buildLocalRenderManifest({}), /需要一个视频源/);
  const long = buildLocalRenderManifest({ sourceUrl: 'a.mp4', resolution: '720p', duration: 9999 });
  assert.equal(long.duration, 300, '时长上限 300 秒（本地渲染不许被一个超长片子拖死）');
  assert.equal(billableSecondsOf(long), 300);
  assert.equal(billableSecondsOf(buildLocalRenderManifest({ sourceUrl: 'a.mp4', resolution: '720p', duration: 12.4 })), 12);
  assert.equal(billableSecondsOf({}), 0, '算不出时长就是 0（让按秒计费那边自己决定怎么处理）');
});
