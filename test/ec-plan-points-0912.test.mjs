// test/ec-plan-points-0912.test.mjs
// 2026-09-12 用户批注：电商生图「下一步」显示 1 积分是错的 —— 默认就是一整套图（如 10 张），
// 积分必须按整套张数算（sizing.images 为空时要回落到 resolveSizingImages 的完整清单）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');

test('整套积分口径：用 resolveSizingImages 的完整清单求和', () => {
  assert.ok(src.includes('const planned = resolveSizingImages(platform, { ...sizing, resolution })'), '计算计划清单');
  assert.ok(src.includes('Array.isArray(planned) && planned.length ? planned :'), '为空时回落到完整清单');
  assert.ok(src.includes('points: Number(((unitsPerImage * count) / 1000).toFixed(1))'), '积分 = 每张 × 张数');
});
