// test/image-model-family-expansion-0913.test.mjs
// 2026-09-13 用户决定（A 方案 + 要 Midjourney，随后要求**直接上线**自己跑验收）：
//   新增四族五档，全部走同一上游（IP233），已可对外选择。
//   竞品对照：2.5 放两个变体（Sunburst/Flare），与 Flova / 椒图一致。
//   Midjourney 上游只有 1K/2K → 目录里标注 resolutions，UI 按模型能力过滤清晰度（不给 4K，不静默回落）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const catalog = read('src/services/imageModelCatalog.js');

test('新增五档已在目录里，并已按用户要求上线（可被选择）', () => {
  for (const id of ['image2-5-sunburst', 'image2-5-flare', 'mdkj-super', 'gemini-3-image', 'midjourney']) {
    assert.ok(catalog.includes("id: '" + id + "'"), '缺少档位 ' + id);
  }
  /* 9-13 用户原话：「你直接上线上来吧，然后我自己去跑跑看」→ 不再 pending。
     pending 机制保留（要临时下线某档加回 pending: true 即可）。 */
  assert.equal((catalog.match(/pending: true/g) || []).length, 0, '五档都已上线，不应再有 pending');
  assert.ok(catalog.includes('SELECTABLE_IMAGE_MODELS'), '对外清单按 pending 过滤');
});

test('计费 SKU 与价目齐备（前端目录 + 后端目录）', () => {
  for (const sku of ['ec_image25_sunburst_1k', 'ec_image25_flare_2k', 'ec_mdkj_2k', 'ec_gemini3_2k', 'ec_mj_2k']) {
    assert.ok(catalog.includes(sku), '前端缺价目 ' + sku);
  }
  const backend = read('server/billing/catalog.mjs');
  for (const sku of ['ec_image25_sunburst_1k', 'ec_image25_sunburst_4k', 'ec_mdkj_1k', 'ec_gemini3_4k', 'ec_mj_1k', 'ec_mj_2k']) {
    assert.ok(backend.includes(sku + ':'), '后端缺 SKU ' + sku);
  }
  /* 价格口径：1 积分 = 1000 units；成本写在 providerCostCny 里，便于对账 */
  assert.ok(/ec_mdkj_2k: \{ units: 1000, providerCostCny: 0\.026 \}/.test(backend), 'MDKJ 成本 ¥0.026 已入账');
  assert.ok(/ec_mj_2k: \{ units: 3500, providerCostCny: 0\.39 \}/.test(backend), 'Midjourney 2K 成本已入账');
});

test('Midjourney 只给 1K/2K（不做静默回落）', () => {
  assert.ok(/resolutions: Object\.freeze\(\['1K', '2K'\]\)/.test(catalog), '目录标注支持的清晰度');
  assert.ok(catalog.includes('export function imageModelResolutions'), '导出清晰度能力函数');
  /* 光有函数不算数 —— 选择器必须真的按模型能力过滤清晰度（首页/自由创作共用面板 + 画布） */
  const panel = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  assert.ok(panel.includes('imageModelResolutions('), '生成设置面板要按模型能力过滤清晰度');
  assert.ok(panel.includes('resolutionChoices.map'), '清晰度选项必须来自过滤后的清单');
});

test('三处选择器都只列已验收档位（首页/自由创作/画布）', () => {
  const panel = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  assert.ok(panel.includes('SELECTABLE_IMAGE_MODELS.map'), '首页与自由创作共用面板已切');
  const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
  assert.ok(studio.includes('SELECTABLE_IMAGE_MODELS.map'), '画布选择器已切');
});
