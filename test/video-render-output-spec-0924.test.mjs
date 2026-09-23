import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFilterChain, outputFpsOf } from '../server/videoExportRender.mjs';

/* ═══ 2026-09-24 批 AH：本地渲染支持「输出规格」（视频高清的本地实现）═══════════════════════════
   用户原话：「难道你没有什么比如 github 上的一些开源项目可以实现吗，**为什么一切都要追究模型呢**」
   ⇒ 视频高清＝本地 ffmpeg 提分辨率，不依赖上游模型（上游那条 v2v 实测两次都没成功）。
   判据两条：① 没声明 output 时**逐字节与从前一致**（不许悄悄改变既有渲染）；
            ② 声明了 output 才加 scale / fps，并且 scale 走 lanczos、宽度取偶（-2）。 */

const manifest = output => ({ timeline: { clips: [{ url: 'a.mp4' }, { url: 'b.mp4' }] }, output });

test('① 没声明 output：滤镜链与从前逐字节一致（concat 直出）', () => {
  const { filterComplex, target } = buildFilterChain(manifest(undefined));
  assert.equal(filterComplex, '[0:v][1:v]concat=n=2:v=1[outv]');
  assert.equal(target, '[outv]');
});

test('② 声明 1080p：concat 之后接 scale（lanczos + 宽度取偶），映射到 [final]', () => {
  const { filterComplex, target } = buildFilterChain(manifest({ resolution: '1080p' }));
  assert.equal(filterComplex, '[0:v][1:v]concat=n=2:v=1[outv];[outv]scale=-2:1080:flags=lanczos[final]');
  assert.equal(target, '[final]');
});

test('③ 分辨率写法归一：2k / 1440p 都映射到 1440 高；未知档位不加缩放', () => {
  assert.match(buildFilterChain(manifest({ resolution: '2k' })).filterComplex, /scale=-2:1440/);
  assert.match(buildFilterChain(manifest({ resolution: '1440P' })).filterComplex, /scale=-2:1440/);
  assert.match(buildFilterChain(manifest({ resolution: '4k' })).filterComplex, /scale=-2:2160/);
  assert.equal(buildFilterChain(manifest({ resolution: '999p' })).filterComplex, '[0:v][1:v]concat=n=2:v=1[outv]',
    '不认识的档位不许瞎缩放（宁可不动，也不要把片子拉变形）');
});

test('④ fps 只接受 24~60 的整数，随 scale 一起加；单独给 fps 也能生效', () => {
  assert.equal(outputFpsOf(manifest({ fps: 60 })), 60);
  assert.equal(outputFpsOf(manifest({ fps: 12 })), null);
  assert.equal(outputFpsOf(manifest({ fps: 'abc' })), null);
  assert.match(buildFilterChain(manifest({ resolution: '1080p', fps: 60 })).filterComplex, /scale=-2:1080:flags=lanczos,fps=60/);
  assert.equal(buildFilterChain(manifest({ fps: 30 })).filterComplex, '[0:v][1:v]concat=n=2:v=1[outv];[outv]fps=30[final]');
});
