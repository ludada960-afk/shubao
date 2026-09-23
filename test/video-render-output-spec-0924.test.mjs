import assert from 'node:assert/strict';
import test from 'node:test';

import { buildFilterChain, outputFpsOf, delogoRegionsOf } from '../server/videoExportRender.mjs';

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

/* ═══ 2026-09-25 批 AJ：区域擦除（去字幕的本地实现）═══════════════════════════════════════════
   用户口径：「难道你没有什么比如 github 上的一些开源项目可以实现吗，**为什么一切都要追究模型呢**」
   ⇒ 知渔那页的「手动标记：放大视频并手动框选字幕区域」正是 ffmpeg delogo 能干的事（纯 CPU、零上游成本）。 */
const withRegion = region => ({ timeline: { clips: [{ url: 'a.mp4' }] }, replace: [region] });

test('⑤ 框选区域走 delogo，且**先擦除后缩放**（坐标是按原片像素框的，先缩放会错位）', () => {
  const chain = buildFilterChain({
    timeline: { clips: [{ url: 'a.mp4' }] },
    replace: [{ type: 'delogo', x: 120, y: 860, w: 1680, h: 160 }],
    output: { resolution: '1080p' },
  }).filterComplex;
  assert.equal(chain,
    '[0:v]concat=n=1:v=1[outv];[outv]delogo=x=120:y=860:w=1680:h=160,scale=-2:1080:flags=lanczos[final]');
});

test('⑥ 非法区域一律**不加滤镜**（宁可不动，也别把片子擦坏）', () => {
  assert.deepEqual(delogoRegionsOf(withRegion({ type: 'delogo', x: -1, y: 0, w: 100, h: 100 })), []);
  assert.deepEqual(delogoRegionsOf(withRegion({ type: 'delogo', x: 0, y: 0, w: 4, h: 100 })), [], '宽太小（<8）不擦');
  assert.deepEqual(delogoRegionsOf(withRegion({ type: 'delogo', x: 'a', y: 0, w: 100, h: 100 })), []);
  assert.deepEqual(delogoRegionsOf(withRegion({ type: 'scale', x: 0, y: 0, w: 100, h: 100 })), [], '不是 delogo 的条目不认');
  assert.equal(buildFilterChain(withRegion({ type: 'delogo', x: -5, y: 0, w: 100, h: 100 })).filterComplex,
    '[0:v]concat=n=1:v=1[outv]', '一个合法区域都没有时，滤镜链与从前一致');
  /* 多个区域按声明顺序依次擦 */
  const multi = buildFilterChain({
    timeline: { clips: [{ url: 'a.mp4' }] },
    replace: [{ type: 'delogo', x: 0, y: 0, w: 100, h: 20 }, { type: 'delogo', x: 0, y: 200, w: 100, h: 20 }],
  }).filterComplex;
  assert.equal(multi, '[0:v]concat=n=1:v=1[outv];[outv]delogo=x=0:y=0:w=100:h=20,delogo=x=0:y=200:w=100:h=20[final]');
});
