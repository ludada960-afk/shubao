import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDesignDirectionService,
} from '../server/ecommerceEngine/designDirectionService.mjs';

const requestedImages = [
  { key: 'white_bg', label: '白底图', count: 1, ratio: '1:1' },
  { key: 'main_text', label: '商品主图', count: 3, ratio: '1:1' },
  { key: 'detail', label: '详情图', count: 2, ratio: '3:4' },
];

function serviceHarness(response) {
  const reads = [];
  const calls = [];
  const service = createDesignDirectionService({
    async readImageAsDataUrl(url, { signal } = {}) {
      reads.push({ url, signal });
      return `data:image/mock;base64,${url}`;
    },
    async completeText(request) {
      calls.push(request);
      return typeof response === 'function' ? response(request) : response;
    },
  });
  return { service, reads, calls };
}

const validResponse = JSON.stringify({
  analysis: {
    product_observations: ['圆柱结构', '银色金属表面'],
    product_uncertainties: ['容量无法从图片确认'],
    reference_style: ['自然餐桌光线', '留白排版'],
  },
  directions: [{
    id: 'daily',
    title: '通勤餐桌日常',
    one_liner: '从通勤到午餐，展示便携和使用收益',
    commercial_objective: '降低使用想象成本',
    audience: '通勤上班族',
    visual_system: { composition: '餐桌环境中的主体留白' },
    product_strategy: { scenario_plan: '办公桌和午餐场景' },
  }],
});

test('uses one bounded multimodal request with explicit product and reference image roles', async () => {
  const { service, reads, calls } = serviceHarness(validResponse);
  const controller = new AbortController();
  const result = await service.generate({
    product_name: '便携焖烧杯',
    description: '突出保温和通勤便携',
    category: '家居日用',
    platform: '淘宝',
    real_shots: ['/product-front.png', '/product-side.png'],
    ref_shots: ['/reference-1.png', '/reference-2.png'],
    requested_images: requestedImages,
  }, { signal: controller.signal });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].images, [
    'data:image/mock;base64,/product-front.png',
    'data:image/mock;base64,/product-side.png',
    'data:image/mock;base64,/reference-1.png',
    'data:image/mock;base64,/reference-2.png',
  ]);
  assert.equal(calls[0].signal, controller.signal);
  assert.match(calls[0].userPrompt, /图片 1-2：商品事实图/);
  assert.match(calls[0].userPrompt, /图片 3-4：视觉参考图/);
  assert.match(calls[0].systemPrompt, /恰好四套/);
  assert.match(calls[0].systemPrompt, /不得修改图片类型、数量和比例/);
  assert.equal(reads.every(read => read.signal === controller.signal), true);
  assert.equal(result.directions.length, 4);
  assert.equal(result.directions[0].deliverables.find(group => group.role === 'detail').count, 2);
  assert.deepEqual(result.analysis.product_observations, ['圆柱结构', '银色金属表面']);
});

test('invalid or partial model JSON still returns four complete deterministic directions without retrying', async () => {
  const { service, calls } = serviceHarness('```json\n{"directions": [invalid]}\n```');
  const result = await service.generate({
    product_name: '便携焖烧杯',
    requested_images: requestedImages,
  });

  assert.equal(calls.length, 1);
  assert.equal(result.directions.length, 4);
  assert.equal(result.analysis.status, 'fallback');
  assert.ok(result.directions.every(direction => direction.deliverables.length === 3));
});

test('caps visual inputs deterministically while preserving both image roles', async () => {
  const { service, calls } = serviceHarness(validResponse);
  await service.generate({
    product_name: '商品',
    real_shots: Array.from({ length: 12 }, (_, index) => `/product-${index}.png`),
    ref_shots: Array.from({ length: 12 }, (_, index) => `/reference-${index}.png`),
    requested_images: requestedImages,
  });

  assert.equal(calls[0].images.length, 16);
  assert.equal(calls[0].images.filter(image => image.includes('/product-')).length, 8);
  assert.equal(calls[0].images.filter(image => image.includes('/reference-')).length, 8);
  assert.match(calls[0].userPrompt, /图片 1-8：商品事实图/);
  assert.match(calls[0].userPrompt, /图片 9-16：视觉参考图/);
});

test('rejects an empty request before making provider calls', async () => {
  const { service, calls } = serviceHarness(validResponse);
  await assert.rejects(
    service.generate({}),
    error => error.status === 400 && /产品名称或上传产品图/.test(error.message),
  );
  assert.equal(calls.length, 0);
});
