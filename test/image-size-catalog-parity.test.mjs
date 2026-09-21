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

/* ═══ 2026-09-19 批 O-⑦：档位从 **6 → 8**（新增 2:3 / 3:2）══════════════════════════════
   判据一个字没变 ——「画面尺寸档位必须给满、且必须与引擎那张权威表逐值一致」。
   变的是"表里有哪几档"这个事实。依据：
     · 用户第 19 轮原话：「我希望你这个图片生成这边，你也要**全部去把这些子页面 1:1 的去把它们抄过来**」；
     · 知渔图片侧每个 app 的 ratio 字段实测是 **7 档**（1:1方图 / 2:3竖版长图 / 3:2横版摄影 /
       3:4竖版海报 / 4:3横版主图 / 9:16手机竖屏 / 16:9手机横屏；docs/design/data/quantv-image-key-specs.json）；
     · 我们原来缺 2:3 与 3:2，本批补齐（引擎尺寸表 + 客户端镜像 + skillRun 白名单 + 尺寸门禁 四处同改）。
   我们比知渔多一档 **21:9**：那是批 J-⑪ 按用户「他们会有很多很多个尺寸的规格可以给人选的，
   为什么你没有呢？」收进来的（知渔只有个别页面有 21:9，见「建筑图转视频」），保留。
   ⚠️ 这条不是"为了让测试过而改数"：真正防漂移的三条机制（deepEqual 全表 / 与服务端逐值 parity /
      validateGenerationSize 约束）一条没松，下面的字段也和 IMAGE_RATIOS 同源。
   ═══ 批 P：再 **8 → 10 档**，新增 4:5 / 5:4 ═════════════════════════════════════════════
   依据 = 用户第 20 轮「要选项的地方要选项……抄到位」+ 知渔「批量出图电商图」的 10 档比例
   （多出 4:5 小红书封面 / 5:4 产品主图 / 21:9 超横屏）。同一口径：界面能选的必须引擎认。 */
test('③ 十三档规格齐全（用户：「搞多一点尺寸规格吗」），且像素标签是给人看的写法', () => {
  /* ⚠️ 批 X 改判：10 → 13（补 9:21 / 2:1 / 1:2）。判据没变（"规格要给满、像素标签是给人看的写法"），
     事实变了：知渔的图像面板有 14 档，我们补齐到 13（差的只有「自适应」那一档 —— 它不是尺寸）。 */
  assert.equal(IMAGE_RATIOS.length, 13, '画面尺寸必须给满十三档');
  assert.deepEqual([...IMAGE_RATIOS], ['1:1', '3:4', '4:3', '9:16', '16:9', '21:9', '2:3', '3:2', '4:5', '5:4', '9:21', '2:1', '1:2']);
  assert.equal(imagePixelLabel('2K', '16:9'), '2048×1152', '标签用 × 不用 x');
  assert.equal(imagePixelLabel('4K', '1:1'), '2880×2880');
  assert.equal(imagePixelLabel('1K', '21:9'), '1008×432');
  assert.equal(imagePixelLabel('2K', '4:5'), '1536×1920', '批 P 新增：4:5 小红书封面');
  assert.equal(imagePixelLabel('4K', '5:4'), '3200×2560', '批 P 新增：5:4 产品主图');
  /* ⚠️ 批 X 改判：9:21 在本批**补进表里**了（用户：「搞多一点尺寸规格吗」）——
     所以"拿不到尺寸"的例子换成 5:3（仍然不在表里）。判据没变：非法输入不许编造尺寸。 */
  assert.equal(imageSizeOf('2K', '9:21'), '1152x2688', '9:21 本批已补进尺寸表');
  assert.equal(imageSizeOf('2K', '5:3'), '', '不在表里的比例返回空，不猜');
  assert.equal(imagePixelLabel('8K', '1:1'), LEGAL_IMAGE_SIZES['2K']['1:1'].replace('x', '×'), '未知分辨率回落到 2K');
});
