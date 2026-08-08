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

const visualResponse = JSON.stringify({
  product_observations: ['圆柱结构', '银色金属表面'],
  product_uncertainties: ['容量无法从图片确认'],
  reference_style: ['自然餐桌光线', '留白排版'],
  commercial_opportunities: ['突出通勤便携'],
});

const plannerResponse = JSON.stringify({
  directions: [{
    id: 'daily-plan',
    title: '通勤餐桌日常',
    one_liner: '从真实场景展示商品的使用收益',
    commercial_objective: '降低使用想象成本',
    audience: '通勤上班族',
    visual_tone: ['自然', '轻盈', '可信'],
    visual_system: { composition: '餐桌环境中的主体留白' },
    product_strategy: { scenario_plan: '办公桌和午餐场景' },
  }],
});

function serviceHarness({ visual = visualResponse, planner = plannerResponse } = {}) {
  const reads = [];
  const calls = [];
  const service = createDesignDirectionService({
    async readImageAsDataUrl(url, { signal } = {}) {
      reads.push({ url, signal });
      return `data:image/mock;base64,${url}`;
    },
    async completeText(request, context) {
      calls.push({ request, context });
      const response = context?.stage === 'vision' ? visual : planner;
      if (response instanceof Error) throw response;
      return typeof response === 'function' ? response(request, context) : response;
    },
  });
  return { service, reads, calls };
}

function generationInput(overrides = {}) {
  return {
    product_name: '便携焖烧杯',
    description: '突出保温和通勤便携',
    category: '家居日用',
    platform: '淘宝',
    real_shots: ['/product-front.png', '/product-side.png'],
    ref_shots: ['/reference-1.png', '/reference-2.png'],
    requested_images: requestedImages,
    ...overrides,
  };
}

test('separates bounded visual analysis from text-only direction planning', async () => {
  const { service, reads, calls } = serviceHarness();
  const controller = new AbortController();
  const result = await service.generate(generationInput(), { signal: controller.signal });

  assert.equal(calls.length, 2);
  const [vision, planner] = calls;
  assert.equal(vision.context.stage, 'vision');
  assert.deepEqual(vision.request.images, [
    { url: 'data:image/mock;base64,/product-front.png', detail: 'auto' },
    { url: 'data:image/mock;base64,/product-side.png', detail: 'auto' },
    { url: 'data:image/mock;base64,/reference-1.png', detail: 'auto' },
    { url: 'data:image/mock;base64,/reference-2.png', detail: 'auto' },
  ]);
  assert.equal(vision.request.signal, controller.signal);
  assert.match(vision.request.userPrompt, /图片 1-2：商品事实图/);
  assert.match(vision.request.userPrompt, /图片 3-4：视觉参考图/);
  assert.doesNotMatch(vision.request.systemPrompt, /deliverables/);
  assert.equal(planner.context.stage, 'planner');
  assert.deepEqual(planner.request.images, []);
  assert.equal(planner.request.maxTokens, 1800);
  assert.match(planner.request.userPrompt, /圆柱结构/);
  assert.match(planner.request.userPrompt, /white_bg（白底图）×1/);
  assert.equal(reads.every(read => read.signal === controller.signal), true);
  assert.equal(result.directions.length, 1);
  assert.equal(result.directions[0].deliverables.find(group => group.role === 'detail').count, 2);
  assert.deepEqual(result.analysis.product_observations, ['圆柱结构', '银色金属表面']);
  assert.equal(result.analysis.status, 'complete');
  assert.equal(result.degraded, false);
});

test('describes the requested target ratio instead of the promoted generation ratio', async () => {
  const { service, calls } = serviceHarness();
  const result = await service.generate(generationInput({
    requested_images: [{
      key: 'main_text',
      label: '横版商品主图',
      count: 1,
      ratio: '4:3',
      targetRatio: '16:9',
      cropPolicy: 'cover-center',
    }],
  }));

  const planner = calls.find(call => call.context?.stage === 'planner');
  assert.match(planner.request.userPrompt, /比例 16:9/);
  assert.equal(result.directions[0].deliverables[0].ratio, '16:9');
});

test('plans against the normalized platform, content type, and target language', async () => {
  const { service, calls } = serviceHarness();
  const result = await service.generate(generationInput({
    platform: 'Amazon',
    commerce_context: {
      platform: 'Amazon',
      contentType: 'detail',
      targetLanguage: 'en',
    },
  }));

  const vision = calls.find(call => call.context?.stage === 'vision');
  const planner = calls.find(call => call.context?.stage === 'planner');
  assert.match(vision.request.userPrompt, /Amazon/);
  assert.match(planner.request.userPrompt, /详情图/);
  assert.match(planner.request.userPrompt, /英语/);
  assert.deepEqual(result.commerceContext, {
    platform: 'amazon',
    contentType: 'detail',
    targetLanguage: 'en',
    locale: 'en-US',
    policyVersion: 'global-commerce-v1',
  });
  assert.ok(result.directions.every(direction => direction.commerce_context?.targetLanguage === 'en'));
});

test('binds one bounded creative route to the visible plan and planner prompt', async () => {
  const { service, calls } = serviceHarness();
  const result = await service.generate(generationInput({
    creative_attempt_id: 'attempt-visible-route',
  }));

  const planner = calls.find(call => call.context?.stage === 'planner');
  const direction = result.directions[0];
  assert.match(planner.request.userPrompt, /本次创意路线/);
  assert.match(planner.request.userPrompt, /圆柱结构/);
  assert.equal(direction.creative_attempt_id, 'attempt-visible-route');
  assert.equal(direction.route_fingerprint, result.creativeRoute.fingerprint);
  assert.match(direction.route_rationale, /便携焖烧杯/);
  assert.ok(direction.creative_route?.sceneFamily);
});

test('a deliberate new direction attempt avoids the supplied recent route', async () => {
  const firstHarness = serviceHarness();
  const first = await firstHarness.service.generate(generationInput({ creative_attempt_id: 'attempt-old' }));
  const secondHarness = serviceHarness();
  const second = await secondHarness.service.generate(generationInput({
    creative_attempt_id: 'attempt-new',
    recent_creative_routes: [first.creativeRoute.route],
  }));

  assert.notEqual(second.creativeRoute.fingerprint, first.creativeRoute.fingerprint);
  assert.notEqual(second.directions[0].route_fingerprint, first.directions[0].route_fingerprint);
  assert.ok(second.directions[0].route_difference);
});

test('turns visual facts and uncertainties into editable per-shot generation constraints', async () => {
  const { service } = serviceHarness();
  const result = await service.generate(generationInput());
  const shot = result.directions[0].deliverables.find(group => group.role === 'main_text').shots[0];

  assert.match(shot.design_goal, /商品识别主图|商品主图/);
  assert.match(shot.product_focus, /圆柱结构/);
  assert.match(shot.negative_constraints, /容量无法从图片确认/);
  assert.match(shot.negative_constraints, /不得/);
  assert.match(shot.visual_style, /自然餐桌光线|留白排版/);
  assert.match(shot.composition, /主体/);
});

test('caps visual inputs at four images per role', async () => {
  const { service, calls } = serviceHarness();
  await service.generate(generationInput({
    real_shots: Array.from({ length: 12 }, (_, index) => `/product-${index}.png`),
    ref_shots: Array.from({ length: 12 }, (_, index) => `/reference-${index}.png`),
  }));

  const vision = calls.find(call => call.context?.stage === 'vision');
  assert.equal(vision.request.images.length, 8);
  assert.equal(vision.request.images.filter(image => image.url.includes('/product-')).length, 4);
  assert.equal(vision.request.images.filter(image => image.url.includes('/reference-')).length, 4);
  assert.match(vision.request.userPrompt, /图片 1-4：商品事实图/);
  assert.match(vision.request.userPrompt, /图片 5-8：视觉参考图/);
});

test('visual provider failure degrades gracefully and still plans one complete direction', async () => {
  const { service, calls } = serviceHarness({
    visual: Object.assign(new Error('provider timed out'), { code: 'VISUAL_ANALYSIS_TIMEOUT', status: 504 }),
  });
  const result = await service.generate(generationInput());

  assert.equal(calls.length, 2);
  assert.equal(calls[1].context.stage, 'planner');
  assert.match(calls[1].request.userPrompt, /视觉分析暂不可用/);
  assert.equal(result.directions.length, 1);
  assert.ok(result.directions.every(direction => direction.deliverables.length === 3));
  assert.equal(result.analysis.status, 'fallback');
  assert.equal(result.degraded, true);
});

test('invalid planner output falls back to one deterministic complete direction', async () => {
  const { service, calls } = serviceHarness({ planner: '```json\n{"directions": [invalid]}\n```' });
  const result = await service.generate(generationInput());

  assert.equal(calls.length, 2);
  assert.equal(result.directions.length, 1);
  assert.ok(result.directions.every(direction => direction.deliverables.length === 3));
  assert.equal(result.analysis.status, 'complete');
  assert.equal(result.degraded, true);
});

test('planner timeout uses the completed visual pass and local directions without degrading', async () => {
  const { service } = serviceHarness({
    planner: Object.assign(new Error('planner timed out'), {
      code: 'VISUAL_ANALYSIS_TIMEOUT',
      status: 504,
    }),
  });
  const result = await service.generate(generationInput());

  assert.equal(result.directions.length, 1);
  assert.equal(result.analysis.status, 'complete');
  assert.equal(result.planner_fallback, true);
  assert.equal(result.degraded, false);
  assert.deepEqual(result.degradedReasons, []);
  assert.ok(result.directions.every(direction => direction.deliverables.length === 3));
});

test('an empty planner entry is degraded instead of being treated as a billable refresh', async () => {
  const { service } = serviceHarness({
    planner: JSON.stringify({ directions: [{}] }),
  });
  const result = await service.generate(generationInput());

  assert.equal(result.directions.length, 1);
  assert.ok(result.directions.every(direction => direction.title.length > 0));
  assert.equal(result.degraded, true);
});

test('text-only input skips visual analysis and still produces complete directions', async () => {
  const { service, calls } = serviceHarness();
  const result = await service.generate(generationInput({ real_shots: [], ref_shots: [] }));

  assert.equal(calls.length, 1);
  assert.equal(calls[0].context.stage, 'planner');
  assert.deepEqual(calls[0].request.images, []);
  assert.equal(result.directions.length, 1);
  assert.equal(result.analysis.status, 'fallback');
  assert.equal(result.degraded, false);
});

test('route cancellation is not hidden by a degraded fallback', async () => {
  const controller = new AbortController();
  const { service } = serviceHarness({
    visual: async () => {
      controller.abort(new Error('route deadline reached'));
      throw Object.assign(new Error('cancelled'), { code: 'VISUAL_ANALYSIS_ABORTED', status: 499 });
    },
  });

  await assert.rejects(
    service.generate(generationInput(), { signal: controller.signal }),
    error => error?.code === 'VISUAL_ANALYSIS_ABORTED',
  );
});

test('rejects an empty request before making provider calls', async () => {
  const { service, calls } = serviceHarness();
  await assert.rejects(
    service.generate({}),
    error => error.status === 400 && /产品名称或上传产品图/.test(error.message),
  );
  assert.equal(calls.length, 0);
});
