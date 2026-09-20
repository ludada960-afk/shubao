import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEGAL_IMAGE_SIZES,
  buildModelRoute,
  selectGenerationModel,
  validateGenerationSize,
} from '../server/ecommerceEngine/modelCatalog.mjs';

/* ═══ 2026-09-19 批 O-⑦：这条门禁的**判据没变**（尺寸表必须逐值钉死，不许偷偷改）═══════
   变的是"表里有哪些比例"这个事实：新增 **2:3 / 3:2**。
   依据 = 用户第 19 轮原话「我希望你这个图片生成这边，你也要**全部去把这些子页面 1:1 的去把它们抄过来**」，
   以及知渔图片侧每个 app 的 ratio 字段实测（inputConfigs 逐字，docs/design/data/quantv-image-key-specs.json）：
     1:1方图 | 2:3竖版长图 | 3:2横版摄影 | 3:4竖版海报 | 4:3横版主图 | 9:16手机竖屏 | 16:9手机横屏
   —— 我们原来缺 2:3 与 3:2 两档。尺寸按本仓 validateGenerationSize 的约束算（16 的倍数 / 长边≤3840 /
   像素≤8,294,400），不是估的：4K 的 2:3 若写 2560x3840 会因像素 9,830,400 超上限被拦下，所以取 2304x3456。
   ⚠️ 这条不是"为了让测试过而改" —— 改前它守的是 6 档、改后守的是 8 档，**仍旧逐值钉死**；
      真正防漂移的机制（deepEqual 全表 + parity 门禁 + validateGenerationSize）一条没松。
   ═══ 批 P：再 **8 → 10 档**，新增 4:5 / 5:4 ═════════════════════════════════════════════
   依据 = 用户第 20 轮「工作台该滑动的地方要滑动，要选项的地方要选项，该切换的地方要切换，抄到位」，
   以及知渔「批量出图电商图」的比例逐字（10 档，多了 4:5 小红书封面 / 5:4 产品主图 / 21:9 超横屏）。
   同一口径：界面能选的必须引擎认，否则选了被静默回落到 1:1。 */
test('exposes the exact legal generation size catalog', () => {
  assert.deepEqual(LEGAL_IMAGE_SIZES, {
    '1K': { '1:1': '1024x1024', '3:4': '768x1024', '4:3': '1024x768', '9:16': '576x1024', '16:9': '1024x576', '21:9': '1008x432', '2:3': '672x1008', '3:2': '1008x672', '4:5': '768x960', '5:4': '960x768' },
    '2K': { '1:1': '2048x2048', '3:4': '1536x2048', '4:3': '2048x1536', '9:16': '1152x2048', '16:9': '2048x1152', '21:9': '2048x864', '2:3': '1344x2016', '3:2': '2016x1344', '4:5': '1536x1920', '5:4': '1920x1536' },
    '4K': { '1:1': '2880x2880', '3:4': '2448x3264', '4:3': '3264x2448', '9:16': '2160x3840', '16:9': '3840x2160', '21:9': '3584x1536', '2:3': '2304x3456', '3:2': '3456x2304', '4:5': '2560x3200', '5:4': '3200x2560' },
  });
});

test('uses gpt-image-2 and a 2K square for a standard formal asset', () => {
  assert.deepEqual(buildModelRoute({ resolution: '2K', assetCount: 1, batchEligible: false }), {
    imageModel: 'smart',
    provider: 'image2',
    model: 'gpt-image-2',
    resolution: '2K',
    ratio: '1:1',
    imageSize: '2K',
    size: '2048x2048',
    async: true,
    mode: 'edit',
  });
});

test('uses gpt-image-2-n only for confirmed same-style batches', () => {
  assert.equal(
    selectGenerationModel({ assetCount: 4, campaignConfirmed: true, sameStyle: true, highRiskFacts: false }),
    'gpt-image-2-n',
  );
  assert.equal(
    selectGenerationModel({ assetCount: 4, campaignConfirmed: true, sameStyle: true, highRiskFacts: true }),
    'gpt-image-2',
  );
  assert.equal(
    selectGenerationModel({ assetCount: 4, campaignConfirmed: true, sameStyle: true, highRiskFacts: false, resolution: '4K' }),
    'gpt-image-2',
  );
});

test('requires an explicit false high-risk assessment for batch routing', () => {
  const eligibleBatch = { assetCount: 4, campaignConfirmed: true, sameStyle: true };

  assert.equal(selectGenerationModel(eligibleBatch), 'gpt-image-2');
  for (const highRiskFacts of [undefined, 'false', [], ['certification'], true, 1, null, {}]) {
    assert.equal(selectGenerationModel({ ...eligibleBatch, highRiskFacts }), 'gpt-image-2');
  }
});

test('validates legal numeric dimensions and rejects unsafe dimensions', () => {
  for (const size of Object.values(LEGAL_IMAGE_SIZES).flatMap((ratios) => Object.values(ratios))) {
    assert.equal(validateGenerationSize(size), true);
  }

  for (const size of [
    '0x1024',
    '1025x1024',
    '1000x1000',
    '3841x1024',
    '2880x2881',
    '2048x4096',
    '4096x4096',
    '4096x7280',
    '2048x2730',
    'not-a-size',
  ]) {
    assert.throws(() => validateGenerationSize(size));
  }
});

test('keeps a 1K 9:16 request in the requested portrait tier', () => {
  assert.deepEqual(buildModelRoute({ resolution: '1K', ratio: '9:16' }), {
    imageModel: 'smart',
    provider: 'image2',
    model: 'gpt-image-2',
    resolution: '1K',
    ratio: '9:16',
    imageSize: '1K',
    size: '576x1024',
    async: true,
    mode: 'edit',
  });
});

test('defaults inherited ratio keys to the legal square ratio', () => {
  assert.deepEqual(buildModelRoute({ resolution: '2K', ratio: 'toString' }), {
    imageModel: 'smart',
    provider: 'image2',
    model: 'gpt-image-2',
    resolution: '2K',
    ratio: '1:1',
    imageSize: '2K',
    size: '2048x2048',
    async: true,
    mode: 'edit',
  });
});
