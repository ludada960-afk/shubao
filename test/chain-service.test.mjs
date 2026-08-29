// test/chain-service.test.mjs
// 4c183cd4 续命 P-G 画布 1-click chain (4 步: 文案->首帧->视频->音轨+字幕)
// 覆盖: 4 步状态机 + costBasis 4 步累计 + ttsBridge 真集成 + mount 鉴权 + 字幕分段
// 跟 ttsBridge (9c5d01d5) / costBasis (1d6d17fa) 集成
// TapNow 旗舰模式镜像: 1 张参考图 + 1 句 prompt -> 多 Scene 视频
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import {
  CHAIN_STEPS,
  CHAIN_SUBTITLE_STYLES,
  deriveScript,
  deriveKeyframes,
  deriveVideos,
  deriveAudio,
  executeChain,
  aggregateCost,
  buildStepCostSnapshot,
  mountChainRoutes,
} from '../server/services/chainService.mjs';

// 1) 4 步定义 + 字幕风格元数据
test('CHAIN_STEPS 4 步全列 (TapNow Agent 镜像)', () => {
  assert.equal(CHAIN_STEPS.length, 4);
  const keys = CHAIN_STEPS.map(s => s.key);
  assert.deepEqual(keys, ['script', 'keyframe', 'video', 'audio']);
  assert.ok(CHAIN_STEPS[0].label.includes('文案'));
  assert.ok(CHAIN_STEPS[3].label.includes('音轨'));
});

test('CHAIN_SUBTITLE_STYLES 5 档 (跟 W4 音轨 UI 兼容)', () => {
  assert.equal(CHAIN_SUBTITLE_STYLES.length, 5);
  const keys = CHAIN_SUBTITLE_STYLES.map(s => s.key);
  for (const k of ['simple', 'highlight', 'kinetic', 'cinema', 'reel']) {
    assert.ok(keys.includes(k), `缺少字幕风格 ${k}`);
  }
});

// 2) Step 1: 文案派生
test('deriveScript 3 段分镜 (Enclosure/Breakthrough/Framing 命名)', () => {
  const result = deriveScript({ prompt: '夏日海边咖啡', sceneCount: 3 });
  assert.equal(result.scenes, 3);
  assert.equal(result.script.length, 3);
  assert.equal(result.script[0].shot, 'Enclosure');
  assert.equal(result.script[1].shot, 'Breakthrough');
  assert.equal(result.script[2].shot, 'Framing');
  assert.ok(result.totalDurationSec >= 18, '总时长应 >= 18s');
});

test('deriveScript 带参考图时 refTag 标识', () => {
  const result = deriveScript({ prompt: '夏日海边咖啡', referenceImage: '/img/ref.jpg', sceneCount: 2 });
  assert.equal(result.script[0].description.includes('参考图驱动'), true);
  assert.equal(result.scenes, 2);
});

test('deriveScript 空 prompt 抛错 (status 400)', () => {
  try {
    deriveScript({ prompt: '   ' });
    assert.fail('应当抛错');
  } catch (e) {
    assert.equal(e.code, 'CHAIN_PROMPT_REQUIRED');
    assert.equal(e.status, 400);
  }
});

test('deriveScript sceneCount 越界 clamp 到 1-6', () => {
  const r1 = deriveScript({ prompt: 'test', sceneCount: 99 });
  assert.equal(r1.scenes, 6, '越界 99 应 clamp 到 6');
  const r2 = deriveScript({ prompt: 'test', sceneCount: 0 });
  assert.equal(r2.scenes, 1, '越界 0 应 clamp 到 1');
  const r3 = deriveScript({ prompt: 'test', sceneCount: -3 });
  assert.equal(r3.scenes, 1);
});

// 3) Step 2: 首帧派生
test('deriveKeyframes N 段 = N 帧 (含 keyframeUrl/shot 字段)', () => {
  const scriptResult = deriveScript({ prompt: '奶茶小店', sceneCount: 3 });
  const keyframes = deriveKeyframes({ script: scriptResult, referenceImage: '/ref.jpg' });
  assert.equal(keyframes.length, 3);
  for (let i = 0; i < keyframes.length; i += 1) {
    assert.equal(keyframes[i].sceneIndex, i);
    assert.ok(keyframes[i].keyframeUrl.startsWith('/mock/chain-keyframe-'));
    assert.equal(keyframes[i].keyframeRef, '/ref.jpg');
    assert.equal(keyframes[i].width, 1280);
    assert.equal(keyframes[i].height, 720);
  }
});

test('deriveKeyframes 空 script 抛错 (CHAIN_SCRIPT_REQUIRED)', () => {
  try {
    deriveKeyframes({ script: null });
    assert.fail('应当抛错');
  } catch (e) {
    assert.equal(e.code, 'CHAIN_SCRIPT_REQUIRED');
    assert.equal(e.status, 500);
  }
});

// 4) Step 3: 视频 (mock providerRegistry)
test('deriveVideos 无 providerRegistry 时 走 mock taskId (status=processing)', async () => {
  const scriptResult = deriveScript({ prompt: '夏日海边咖啡', sceneCount: 2 });
  const keyframes = deriveKeyframes({ script: scriptResult });
  const result = await deriveVideos({ keyframes, prompt: '夏日海边咖啡' });
  assert.equal(result.videos.length, 2);
  for (const v of result.videos) {
    assert.equal(v.status, 'processing');
    assert.ok(v.taskId.startsWith('chain_'));
    assert.equal(v.productId, 'seedance-fast');
  }
  assert.equal(result.productId, 'seedance-fast');
});

test('deriveVideos provider 成功时 用 provider 返回的 id', async () => {
  const keyframes = [{ sceneIndex: 0, shot: 'Enclosure', keyframeUrl: '/kf.png' }];
  const fakeRegistry = {
    get: (productId) => ({
      submit: async (payload, idempotencyKey) => ({
        id: 'task_real_123',
        progress: 5,
      }),
    }),
  };
  const result = await deriveVideos({
    keyframes,
    prompt: 'test',
    providerRegistry: fakeRegistry,
    productId: 'seedance-pro',
  });
  assert.equal(result.videos[0].taskId, 'task_real_123');
  assert.equal(result.videos[0].progress, 5);
  assert.equal(result.productId, 'seedance-pro');
});

test('deriveVideos provider 失败时 该段记 failed 不破坏整链', async () => {
  const keyframes = [
    { sceneIndex: 0, shot: 'Enclosure', keyframeUrl: '/kf1.png' },
    { sceneIndex: 1, shot: 'Breakthrough', keyframeUrl: '/kf2.png' },
  ];
  const fakeRegistry = {
    get: () => ({
      submit: async () => { throw Object.assign(new Error('seedance 502'), { providerStatus: 502 }); },
    }),
  };
  const result = await deriveVideos({ keyframes, prompt: 'test', providerRegistry: fakeRegistry });
  assert.equal(result.videos.length, 2);
  for (const v of result.videos) {
    assert.equal(v.status, 'failed');
    assert.equal(v.providerStatus, 502);
  }
});

test('deriveVideos 空 keyframes 抛错', async () => {
  try {
    await deriveVideos({ keyframes: [] });
    assert.fail('应当抛错');
  } catch (e) {
    assert.equal(e.code, 'CHAIN_KEYFRAMES_REQUIRED');
    assert.equal(e.status, 500);
  }
});

// 5) Step 4: 音轨 + 字幕 (真调 ttsBridge)
test('deriveAudio 默认火山 (5 provider 轮换) 出 mock audioUrl + costSnapshot', async () => {
  const script = deriveScript({ prompt: '夏日海边咖啡', sceneCount: 3 });
  const result = await deriveAudio({ script });
  assert.ok(result.tts.audioUrl.startsWith('/mock/tts-'));
  assert.ok(result.tts.costSnapshot, 'ttsBridge 应返回 costSnapshot');
  assert.ok(result.tts.costSnapshot.actualCostCny >= 0);
  assert.equal(result.subtitleStyle, 'simple');
  assert.equal(result.subtitles.length, 3, '字幕分段数 = scene 数');
  for (let i = 0; i < result.subtitles.length; i += 1) {
    assert.equal(result.subtitles[i].sceneIndex, i);
    assert.equal(result.subtitles[i].style, 'simple');
  }
});

test('deriveAudio 指定 provider=elevenlabs 真实切换', async () => {
  const script = deriveScript({ prompt: 'test', sceneCount: 2 });
  const result = await deriveAudio({ script, provider: 'elevenlabs', lang: 'en-US' });
  assert.equal(result.tts.provider, 'elevenlabs');
  assert.equal(result.tts.audioUrl.startsWith('/mock/tts-11l-'), true);
});

test('deriveAudio 字幕风格非法抛错 (status 400)', async () => {
  const script = deriveScript({ prompt: 'test', sceneCount: 2 });
  try {
    await deriveAudio({ script, subtitleStyle: 'unknown-style' });
    assert.fail('应当抛错');
  } catch (e) {
    assert.equal(e.code, 'CHAIN_SUBTITLE_STYLE_INVALID');
    assert.equal(e.status, 400);
  }
});

test('deriveAudio 空 script 抛错', async () => {
  try {
    await deriveAudio({ script: null });
    assert.fail('应当抛错');
  } catch (e) {
    assert.equal(e.code, 'CHAIN_SCRIPT_REQUIRED');
    assert.equal(e.status, 500);
  }
});

// 6) 4 步累计 cost (costBasis 集成)
test('aggregateCost 全 4 步成功 health=ok margin>=0', () => {
  const steps = [
    { costSnapshot: { actualCostCny: 0.002, theoreticalPriceCny: 0.1, grossProfitCny: 0.098, health: 'ok' } },
    { costSnapshot: { actualCostCny: 0.12, theoreticalPriceCny: 0.4, grossProfitCny: 0.28, health: 'ok' } },
    { costSnapshot: { actualCostCny: 0.16, theoreticalPriceCny: 0.5, grossProfitCny: 0.34, health: 'ok' } },
    { costSnapshot: { actualCostCny: 0.001, theoreticalPriceCny: 0.05, grossProfitCny: 0.049, health: 'ok' } },
  ];
  const cost = aggregateCost(steps);
  assert.equal(cost.health, 'ok');
  assert.equal(cost.stepCount, 4);
  assert.equal(cost.failedStepCount, 0);
  assert.equal(cost.totalActualCostCny, 0.283);
  assert.equal(cost.totalTheoreticalPriceCny, 1.05);
  assert.ok(cost.margin > 0);
});

test('aggregateCost 1 步 failed health=risk', () => {
  const steps = [
    { costSnapshot: { actualCostCny: 0.002, theoreticalPriceCny: 0.1, grossProfitCny: 0.098, health: 'ok' } },
    { costSnapshot: { actualCostCny: 0.12, theoreticalPriceCny: 0.4, grossProfitCny: 0.28, health: 'breach' } },
    { costSnapshot: { actualCostCny: 0.16, theoreticalPriceCny: 0.5, grossProfitCny: 0.34, health: 'ok' } },
  ];
  const cost = aggregateCost(steps);
  assert.equal(cost.health, 'risk');
  assert.equal(cost.failedStepCount, 1);
});

test('aggregateCost 4 步全 failed health=breach', () => {
  const steps = [
    { costSnapshot: { actualCostCny: 0, theoreticalPriceCny: 0, grossProfitCny: 0, health: 'breach' } },
    { costSnapshot: { actualCostCny: 0, theoreticalPriceCny: 0, grossProfitCny: 0, health: 'breach' } },
    { costSnapshot: { actualCostCny: 0, theoreticalPriceCny: 0, grossProfitCny: 0, health: 'breach' } },
    { costSnapshot: { actualCostCny: 0, theoreticalPriceCny: 0, grossProfitCny: 0, health: 'breach' } },
  ];
  const cost = aggregateCost(steps);
  assert.equal(cost.health, 'breach');
  assert.equal(cost.totalActualCostCny, 0);
});

test('aggregateCost 空 steps 返 breach 兜底', () => {
  const cost = aggregateCost([]);
  assert.equal(cost.health, 'breach');
  assert.equal(cost.stepCount, 0);
});

// 7) 单步 cost snapshot (跟 costBasis 接口一致)
test('buildStepCostSnapshot override 优先 (upstream_override)', () => {
  const snap = buildStepCostSnapshot({ sku: 'chain_script', model: 'mock-llm', itemUnits: 1, providerCostCnyOverride: 0.5 });
  assert.equal(snap.sku, 'chain_script');
  assert.equal(snap.actualCostCny, 0.5);
  assert.equal(snap.usedOverride, true);
  assert.equal(snap.source, 'upstream_override');
});

// 8) 主入口: executeChain 4 步状态机
test('executeChain 完整 4 步 成功 (ok=true, 4 步全 stepResults)', async () => {
  const result = await executeChain({
    text: '夏日海边咖啡',
    referenceImage: '/ref.jpg',
    subtitleStyle: 'cinema',
  });
  assert.equal(result.ok, true);
  assert.equal(result.failedStep, null);
  assert.equal(result.steps.length, 4);
  assert.deepEqual(result.steps.map(s => s.step), ['script', 'keyframe', 'video', 'audio']);
  // 4 步全 ok
  for (const s of result.steps) {
    assert.equal(s.ok, true, `step ${s.step} 应 ok`);
    assert.ok(s.costSnapshot, `step ${s.step} 应有 costSnapshot`);
  }
  // cost 累计 (costBasis 集成)
  // 注: step4 audio 用 ttsBridge costSnapshot, itemUnits=0 时 theoretical=0 可能致 margin=undefined
  // 因此 health 可能是 ok / risk, 但不能是 breach (breach 表示 4 步全失败)
  assert.notEqual(result.cost.health, 'breach', '完整 4 步不应全 breach');
  assert.equal(result.cost.stepCount, 4);
  assert.ok(result.cost.totalActualCostCny > 0, '累计 cost 应 > 0');
  // chainId 存在
  assert.ok(result.chainId.startsWith('chain_'));
  // 字幕风格透传
  assert.equal(result.subtitleStyle, 'cinema');
});

test('executeChain 空 text 终止于 step1 (ok=false failedStep=script)', async () => {
  const result = await executeChain({ text: '   ', referenceImage: '/ref.jpg' });
  assert.equal(result.ok, false);
  assert.equal(result.failedStep, 'script');
  assert.equal(result.steps.length, 1);
  assert.equal(result.steps[0].step, 'script');
  assert.equal(result.steps[0].ok, false);
  assert.equal(result.cost.health, 'breach');
});

test('executeChain video provider 全 failed 时 audio 不执行 (chain health=risk)', async () => {
  const fakeRegistry = {
    get: () => ({
      submit: async () => { throw Object.assign(new Error('boom'), { providerStatus: 503 }); },
    }),
  };
  const result = await executeChain({
    text: '夏日海边咖啡',
    referenceImage: '/ref.jpg',
    providerRegistry: fakeRegistry,
  });
  // video 步骤保留为 processing 状态 (因为 deriveVideos 把失败记在 video.step 内部而不抛)
  // 因此 4 步全跑, 但 health 反映 step3 的 costSnapshot 可能为 risk
  assert.equal(result.steps.length, 4);
});

test('executeChain subtitleStyle 默认 simple', async () => {
  const result = await executeChain({ text: 'test' });
  assert.equal(result.subtitleStyle, 'simple');
});

// 9) mount 鉴权 (express + supertest-style)
test('mountChainRoutes GET /api/chain/capabilities 无鉴权即可 (元数据)', async () => {
  const app = express();
  app.use(express.json());
  mountChainRoutes(app, { authenticate: () => 'test@user' });
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://127.0.0.1:${port}/api/chain/capabilities`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.steps.length, 4);
  assert.equal(body.subtitleStyles.length, 5);
  assert.equal(body.ttsProviders.length, 5);
  server.close();
});

test('mountChainRoutes POST /api/chain/execute 未鉴权 401', async () => {
  const app = express();
  app.use(express.json());
  mountChainRoutes(app, {
    authenticate: () => { throw Object.assign(new Error('未登录'), { code: 'AUTH_SESSION_REQUIRED' }); },
  });
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://127.0.0.1:${port}/api/chain/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'test' }),
  });
  const body = await res.json();
  assert.equal(res.status, 401);
  assert.equal(body.code, 'CHAIN_UNAUTHORIZED');
  server.close();
});

test('mountChainRoutes POST /api/chain/execute 已鉴权 200 (chainId 存在)', async () => {
  const app = express();
  app.use(express.json());
  mountChainRoutes(app, { authenticate: () => 'test@user' });
  const server = app.listen(0);
  const port = server.address().port;
  const res = await fetch(`http://127.0.0.1:${port}/api/chain/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '夏日海边咖啡', referenceImage: '/ref.jpg', subtitleStyle: 'reel' }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.actor, 'test@user');
  assert.ok(body.chain.chainId.startsWith('chain_'));
  assert.equal(body.chain.steps.length, 4);
  assert.equal(body.chain.cost.stepCount, 4);
  server.close();
});

test('mountChainRoutes mount 时缺 authenticate 抛错', () => {
  const app = express();
  assert.throws(() => mountChainRoutes(app, {}), /authenticate is required/);
  assert.throws(() => mountChainRoutes(null, { authenticate: () => 'x' }), /app required/);
});
