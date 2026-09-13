// test/image-model-families-wiring-0913.test.mjs
// 2026-09-13 新增四族五档图片模型的后端接线（A 方案：先把路由/适配器做齐，
// 前端目录里仍是 pending —— 要通过真实付费生成验收后才进选择器）。
// 这里锁死：① 族 → provider=advanced-image、route.model=族 id（上游模型名交给 modelMap）
//          ② Midjourney 没有 4K（上游只有 1K/2K），请求 4K 时兜底降到 2K，绝不静默换模型
//          ③ 路由器按 provider 分流，jobId 前缀可跨 poll 还原，未配置时报「换模型」而不是暴露供应商
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildModelRoute, isAdvancedImageModel, selectGenerationModel } from '../server/ecommerceEngine/modelCatalog.mjs';
import { createModelProviderRouter } from '../server/ecommerceEngine/modelProviderRouter.mjs';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const FAMILIES = ['image2-5-sunburst', 'image2-5-flare', 'mdkj-super', 'gemini-3-image', 'midjourney'];

function adapter(name) { return {
  async submitEdit() { return { jobId: `${name}-job`, status: 'submitted' }; },
  async poll(jobId) { return { jobId, status: 'completed', outputUrl: `${name}.png` }; },
  async pollUntilReady(jobId) { return { jobId, status: 'completed', outputUrl: `${name}.png` }; },
}; }

test('新族走 advanced-image 通道，route.model = 族 id', () => {
  for (const family of FAMILIES) {
    assert.equal(isAdvancedImageModel(family), true, family + ' 应识别为新族');
    const route = buildModelRoute({ imageModel: family, resolution: '2K', ratio: '1:1' });
    assert.equal(route.provider, 'advanced-image', family + ' 的 provider 不对');
    assert.equal(route.model, family, family + ' 的 route.model 必须是族 id（上游模型名由 modelMap 决定）');
    assert.equal(route.resolution, '2K');
    assert.equal(route.size, '2048x2048');
  }
  // 旧的三个通道不能被改坏
  assert.equal(buildModelRoute({ imageModel: 'image2', resolution: '2K' }).provider, 'image2');
  assert.equal(buildModelRoute({ imageModel: 'nano-banana-2', resolution: '2K' }).provider, 'nano-banana');
  assert.equal(buildModelRoute({ imageModel: 'nano-banana-pro', resolution: '2K' }).model, 'gemini-3-pro-image');
  assert.equal(selectGenerationModel({ imageModel: 'image2-5-flare' }), 'image2-5-flare');
});

test('Midjourney 只有 1K/2K：请求 4K 兜底降到 2K（不静默换模型）', () => {
  const route = buildModelRoute({ imageModel: 'midjourney', resolution: '4K', ratio: '1:1' });
  assert.equal(route.resolution, '2K');
  assert.equal(route.model, 'midjourney');
  assert.equal(route.provider, 'advanced-image');
  // 其它族仍然支持 4K
  assert.equal(buildModelRoute({ imageModel: 'image2-5-sunburst', resolution: '4K' }).resolution, '4K');
});

test('适配器按「族:分辨率」映射真实模型名，Midjourney 只配到 2K', () => {
  const server = read('server/index.mjs');
  const mapBlock = server.slice(server.indexOf('const ADVANCED_IMAGE_MODELS = {'), server.indexOf('const createAdvancedImageAdapter'));
  for (const family of ['image2-5-sunburst', 'image2-5-flare', 'mdkj-super', 'gemini-3-image']) {
    for (const resolution of ['1K', '2K', '4K']) {
      assert.ok(mapBlock.includes(`'${family}:${resolution}'`), '缺少映射 ' + family + ':' + resolution);
    }
  }
  assert.ok(mapBlock.includes("'midjourney:1K'") && mapBlock.includes("'midjourney:2K'"), 'Midjourney 只有 1K/2K 映射');
  assert.ok(!mapBlock.includes("'midjourney:4K'"), 'Midjourney 不应配 4K（上游没有）');
  const adapterBlock = server.slice(server.indexOf('const createAdvancedImageAdapter'), server.indexOf('const advancedImageProviderAdapter'));
  assert.match(adapterBlock, /protocol: 'openai-images'/, '新族走同步 OpenAI 图片接口');
  assert.match(adapterBlock, /modelMap: ADVANCED_IMAGE_MODELS/, '适配器必须挂上族:分辨率映射表');
});

test('路由器把 advanced 请求分给新族适配器，并跨 poll 还原前缀', async () => {
  const router = createModelProviderRouter({
    image2: adapter('image2'),
    nanoBanana: adapter('nano'),
    advancedImage: adapter('advanced'),
  });
  const submitted = await router.submitEdit({ modelRoute: { provider: 'advanced-image' } });
  assert.equal(submitted.jobId, 'advanced:advanced-job');
  assert.equal((await router.pollUntilReady(submitted.jobId)).outputUrl, 'advanced.png');
  assert.equal((await router.poll(submitted.jobId)).outputUrl, 'advanced.png');
  // nano / image2 分流保持原样
  assert.equal((await router.submitEdit({ modelRoute: { provider: 'nano-banana' } })).jobId, 'nano:nano-job');
  assert.equal((await router.submitEdit({ modelRoute: { provider: 'image2' } })).jobId, 'image2:image2-job');
});

test('新族通道不可用时给出「换个模型」的提示，不暴露供应商', async () => {
  const router = createModelProviderRouter({ image2: adapter('image2') });
  await assert.rejects(
    () => router.submitEdit({ modelRoute: { provider: 'advanced-image' } }),
    error => {
      assert.equal(error.code, 'ADVANCED_IMAGE_PROVIDER_UNAVAILABLE');
      assert.equal(error.retryable, false);
      assert.ok(!/上游|供应商|备用|IP233|change2pro/i.test(error.message), '面向用户的文案不能露出供应商');
      assert.match(error.message, /换.*模型/);
      return true;
    },
  );
});
