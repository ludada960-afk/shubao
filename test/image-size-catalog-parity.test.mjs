import assert from 'node:assert/strict';
import test from 'node:test';

import { LEGAL_IMAGE_SIZES as SERVER_SIZES, resolveGenerationSize } from '../server/ecommerceEngine/modelCatalog.mjs';
import { IMAGE_RATIOS, LEGAL_IMAGE_SIZES, imagePixelLabel, imageSizeOf } from '../src/services/imageSizeCatalog.js';

/* ═══ 批 J-⑪：画面规格的选项**恰好等于**服务端能生成的尺寸（用户批注 #7-4）══════════════════
   用户原话：「他们会有**很多很多个尺寸的规格**可以给人选的，为什么你没有呢？你只有这四个吗？」
   「你这些尺寸的样式啊做的实在太差了，你不能照抄他们的样子吗？」
   为什么要有这条门禁：服务端 resolveGenerationSize 对**不在表里的比例会静默回落成 1:1** ——
   UI 多给一个选项，用户就是"选了 A 拿到 B"，而且全程无提示。
   所以"能给几个"这件事只能有一个答案：**两边是同一张表**。 */

test('① 前端镜像与后端 LEGAL_IMAGE_SIZES 逐值相等（不可能各自漂移）', () => {
  assert.deepEqual(
    JSON.parse(JSON.stringify(LEGAL_IMAGE_SIZES)),
    JSON.parse(JSON.stringify(SERVER_SIZES)),
    '两份尺寸表必须逐值相等',
  );
});

test('② 画面规格给的每一档，服务端都真的会照做（不是静默回落）', () => {
  for (const resolution of Object.keys(SERVER_SIZES)) {
    for (const ratio of IMAGE_RATIOS) {
      const resolved = resolveGenerationSize({ resolution, ratio, imageModel: 'image2' });
      assert.equal(resolved.ratio, ratio, resolution + ' + ' + ratio + ' 被服务端改成了 ' + resolved.ratio);
      assert.equal(resolved.size, SERVER_SIZES[resolution][ratio], resolution + ' + ' + ratio + ' 的真实尺寸');
      assert.equal(resolved.resolution, resolution, resolution + ' + ' + ratio + ' 的分辨率档被改动');
    }
  }
});

test('③ 六档规格齐全（用户："你只有这四个吗"），且像素标签是给人看的写法', () => {
  assert.equal(IMAGE_RATIOS.length, 6, '画面尺寸必须给满六档');
  assert.deepEqual([...IMAGE_RATIOS], ['1:1', '3:4', '4:3', '9:16', '16:9', '21:9']);
  assert.equal(imagePixelLabel('2K', '16:9'), '2048×1152', '标签用 × 不用 x');
  assert.equal(imagePixelLabel('4K', '1:1'), '2880×2880');
  assert.equal(imagePixelLabel('1K', '21:9'), '1008×432');
  /* 非法输入不许编造一个尺寸出来 */
  assert.equal(imageSizeOf('2K', '5:4'), '', '不在表里的比例返回空，不猜');
  assert.equal(imagePixelLabel('8K', '1:1'), LEGAL_IMAGE_SIZES['2K']['1:1'].replace('x', '×'), '未知分辨率回落到 2K');
});
