// test/billing-units-single-source-0914.test.mjs
// 2026-09-14 深度体检发现的 P0：前端「预估积分」与后端「实际扣费」两处硬编码，8-26 后端调价后前端没跟上，
// 用户看到 1 积分、实际扣 1.5 积分（nano 2K 档）。用户的红线是「不能有任何未确认的扣费」，
// 所以这里用**跨文件一致性测试**把两边钉死：前端 generationUnits(model, res) 必须等于
// 后端 server/billing/catalog.mjs 里 generationBillingSku 对应 SKU 的 units。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IMAGE_MODELS, generationBillingSku, generationUnits } from '../src/services/imageModelCatalog.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const catalogSource = read('server/billing/catalog.mjs');

/** 从后端计费目录里取出某个 SKU 的 units（单一事实源） */
function backendUnits(sku) {
  const match = catalogSource.match(new RegExp('\\b' + sku + ':\\s*\\{[^}]*units:\\s*(\\d+)'));
  return match ? Number(match[1]) : null;
}

test('前端预估积分与后端计费目录逐档对齐（不允许两处硬编码漂移）', () => {
  const mismatches = [];
  for (const model of IMAGE_MODELS) {
    for (const resolution of ['1K', '2K', '4K']) {
      const sku = generationBillingSku(model.id, resolution);
      const backend = backendUnits(sku);
      if (backend == null) continue; // 非图片 SKU（如 smart）跳过
      const frontend = generationUnits(model.id, resolution);
      if (frontend !== backend) mismatches.push(`${model.id}:${resolution} ${sku} 前端=${frontend} 后端=${backend}`);
    }
  }
  assert.deepEqual(mismatches, [], '预估与实际扣费必须同源，出现差异就是"悄悄多扣钱"：' + mismatches.join(' | '));
});

test('nano 2K 档已按后端 1500 units 修正（8-26 调价的回归）', () => {
  assert.equal(generationUnits('nano-banana-2', '2K'), backendUnits('ec_nano_flash_2k'));
  assert.equal(generationUnits('nano-banana-pro', '2K'), backendUnits('ec_nano_pro_2k'));
  assert.equal(generationUnits('nano-banana-2', '2K'), 1500);
});
