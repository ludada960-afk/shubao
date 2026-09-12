// test/canvas-source-upload-layout-0912.test.mjs
// 2026-09-12 用户批注：生成节点里上传素材，旧算法会落到画布中间并压在已有节点上。
// 结论：落点统一走 canvasStudioModel.resolveSourceStackPlacement（固定左侧一列 + 从已有来源下方 + 矩形避让不重叠）。
// 行为验证见 test/canvas-source-placement-0912.test.mjs；本文件锁契约（不许退回旧算法）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const model = readFileSync(new URL('../src/pages/EcCanvas/canvasStudioModel.js', import.meta.url), 'utf8');

test('落点统一走避让算法，旧横推算法不得回归', () => {
  assert.match(page, /resolveSourceStackPlacement\(\{/);
  assert.match(page, /existingNodes: nodes\.filter\(node => node\.id !== composerId\)/);
  assert.doesNotMatch(page, /x: composer\.x - importedImages\.assets\.length \* 278 - 36/, '旧横推算法必须消失');
  assert.doesNotMatch(page, /x: composer\.x - Math\.max\(1, importedVideos\.assets\.length\) \* 360 - 36/);
});

test('三种来源（图/视频/音频）统一排布：先出草稿节点，再按真实尺寸定位', () => {
  assert.match(page, /const draftImageNodes = createUploadedImageNodes\(\{/);
  assert.match(page, /const draftVideoNodes = createUploadedVideoNodes\(\{/);
  assert.match(page, /const draftAudioNodes = importedAudios\.assets\.map\(/);
  assert.match(page, /entries: draftUploadedNodes\.map\(node => \(\{ w: node\.w \|\| 240, h: node\.h \|\| 240 \}\)\)/);
});

test('算法本身保证：同列 + 从已有来源下方 + 矩形不相交', () => {
  assert.match(model, /export function resolveSourceStackPlacement\(/);
  assert.match(model, /const x = Math\.round\(Number\(anchor\.x \|\| 0\) - columnWidth - gapX\)/);
  assert.match(model, /const overlaps = \(rect, node\) =>/);
  assert.match(model, /const hit = \[\.\.\.blockers, \.\.\.placed\]\.find\(node => overlaps\(rect, node\)\)/);
});
