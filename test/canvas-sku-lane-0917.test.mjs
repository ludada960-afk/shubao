// test/canvas-sku-lane-0917.test.mjs
// 2026-09-17 用户批注（SKU 必须进画布排版体系）：
//   「正常的电商店铺，一套标准电商图就是要有白底图、主图、详情图、SKU 这些必要的东西……
//    用户在套图方案里勾了主图/详情图/白底图，又在 SKU 变体里自定义了几个 SKU，
//    那最终进画布时它们都应该进入排版体系……我不确定 SKU 有没有被放进去排版。」
//
// 审计结论（本轮实测）：
//   画布的落点算法**本来就给 SKU 留了排位**（roleRows.SKU = 3），
//   服务端也**本来就会**为每个有效 SKU 变体产出 role:'sku' 的图
//   （assetPlanner.normalizeSkus → buildItem({ role: 'sku' })，
//    交付时 deliveryMetadata.ecommerceGroupForRole('sku') → 'SKU'）。
//   断点在**中间的透传**：generateEcommerceSuite 没有 skus 形参、也没往
//   generateEcommerce 传（而 generateEcommerce 早就支持并会拼进 body.skus），
//   于是画布的 skus 永远是 []，SKU 图一张都不生成，SKU 排自然永远是空的。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const api = readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8');
const canvas = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const estimate = readFileSync(new URL('../src/pages/EcCanvas/canvasPointsEstimate.js', import.meta.url), 'utf8');

function suiteBody() {
  const start = api.indexOf('export async function generateEcommerceSuite(');
  const end = api.indexOf('export async function generateEcommerce(', start);
  return api.slice(start, end);
}

test('generateEcommerceSuite 必须透传 skus（这是 SKU 能否出图的总闸门）', () => {
  const body = suiteBody();
  const signature = body.slice(0, body.indexOf(') {'));
  assert.ok(/\bskus\b/.test(signature), '形参必须包含 skus');
  assert.ok(/skus:\s*Array\.isArray\(skus\)\s*\?\s*skus\s*:\s*\[\]/.test(body),
    '必须把 skus 传给 generateEcommerce（否则 body.skus 恒为 []）');
});

test('generateEcommerce 仍然把 skus 写进请求体（底层契约不变）', () => {
  assert.ok(api.includes('skus: skus || []'), 'body.skus 必须存在');
});

test('画布套图生成必须把配置里的 skus 一起送出去', () => {
  assert.ok(canvas.includes('skus: Array.isArray(configuration.skus) ? configuration.skus : []'),
    'handleSuiteComposerGenerate 必须传 skus');
});

test('SKU 结果有自己的排位（复用既有 roleRows 约定，没有另写一套）', () => {
  /* 画布落点：y = composer.y + roleRows[group] * 390，x = 框右缘 + 80 + column*268 */
  const rowMatch = canvas.match(/const roleRows = \{([^}]*)\}/);
  assert.ok(rowMatch, 'roleRows 必须存在');
  const rows = rowMatch[1];
  assert.ok(/SKU:\s*3/.test(rows), 'SKU 必须占第 3 排（与白底图/主图/详情图并列）');
  assert.ok(/白底图:\s*0/.test(rows) && /主图:\s*1/.test(rows) && /详情图:\s*2/.test(rows),
    '其余三排的既有排位不能被改动');
});

test('SKU 排与其它排同间距、同列宽（同一套 row 约定）', () => {
  const rowExpr = canvas.match(/y: composer\.y \+ \(roleRows\[group\] \?\? 4\) \* (\d+)/);
  assert.ok(rowExpr, '落点必须走 roleRows 统一公式');
  assert.equal(rowExpr[1], '390', '行距沿用既有 390');
  const colExpr = canvas.match(/x: composer\.x \+ composer\.w \+ (\d+) \+ column \* (\d+)/);
  assert.ok(colExpr, '横向必须走统一列公式');
  assert.equal(colExpr[2], '268', '列距沿用既有 268');
});

test('报价把 SKU 变体算进去（与后端 quantity 同口径，不少报）', () => {
  assert.ok(estimate.includes('export function canvasValidSkuCount'), '必须有 SKU 计数口径');
  assert.ok(/color.*size.*capacity.*dimLabel/s.test(estimate), '只有填了真实规格字段的变体才计数');
  assert.ok(estimate.includes('totalImages + skuCount'), '套图张数必须叠加 SKU 变体数');
});
