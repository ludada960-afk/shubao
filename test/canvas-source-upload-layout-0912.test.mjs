// test/canvas-source-upload-layout-0912.test.mjs
// 2026-09-12 用户批注：在生成节点里上传素材会直接出现在画布中间、很突兀；
// 竞品（流影AI）是把新素材排在左侧一列、自上而下叠好。
// 约定：上传来源素材固定落在「生成器左侧一列」，从已有来源下方继续往下排；不再按数量往左横推。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');

test('来源素材落点 = 生成器左侧固定一列（不再按数量横推）', () => {
  assert.match(page, /const columnX = Math\.round\(composer\.x - SOURCE_COLUMN_WIDTH - SOURCE_COLUMN_GAP_X\)/);
  assert.doesNotMatch(page, /x: composer\.x - importedImages\.assets\.length \* 278 - 36/, '旧的横推算法必须消失');
  assert.doesNotMatch(page, /x: composer\.x - Math\.max\(1, importedVideos\.assets\.length\) \* 360 - 36/);
});

test('多个来源自上而下叠放：从已有来源下方继续排版', () => {
  assert.match(page, /existingSourceNodes/);
  assert.match(page, /Math\.max\(\.\.\.existingSourceNodes\.map\(node => \(node\.y \|\| 0\) \+ \(node\.h \|\| 0\)\)\) \+ SOURCE_STACK_GAP_Y/);
  assert.match(page, /if \(imageNodes\.length\) stackY =/);
  assert.match(page, /if \(videoNodes\.length\) stackY =/);
});

test('音频来源同样落在左侧一列', () => {
  assert.match(page, /x: columnX, y: stackY \+ index \* 92/);
});
