import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_VIDEO_PRODUCT_ID,
  ROUTE_REACHABILITY,
  VIDEO_CATALOG_VERSION,
  VIDEO_PRODUCTS,
  durationOptionsOf,
  getVideoProduct,
  isDurationSupported,
  nearestSupportedDuration,
  publicRouteViolations,
  publicVideoProducts,
  routeReachability,
  validateVideoProductInput,
  videoFeatureSku,
} from '../server/videoCatalog.mjs';

test('video products expose one curated stable contract', () => {
  assert.match(VIDEO_CATALOG_VERSION, /^video-products-/);
  assert.equal(DEFAULT_VIDEO_PRODUCT_ID, 'seedance_standard');
  /* 产品 id 集合是稳定契约：老任务/老订单里存着这些 id，必须永远解析得出来（老数据必须可读）。
     注意这里锁的是「id 还在」，不是「id 公开」——公开与否由可达性台账决定。 */
  assert.deepEqual(Object.keys(VIDEO_PRODUCTS), [
    'seedance_fast',
    'seedance_standard',
    'minimax_h3_768p',
    'grok_fast',
    'wan_standard',
    'kling_standard',
    'kling_pro',
    'veo_fast',
    'seedance_25',
    'minimax_h3_2k',
  ]);
  assert.equal(getVideoProduct('seedance_standard').default, true);
  assert.equal(getVideoProduct('seedance_standard').label, 'Seedance 2.0 标准');
  assert.match(getVideoProduct('seedance_fast').description, /720P/);
  assert.equal(Object.isFrozen(VIDEO_PRODUCTS), true);
  assert.equal(Object.isFrozen(getVideoProduct('seedance_standard').limits), true);
  assert.throws(() => getVideoProduct('__proto__'), /未知视频产品/);
});

test('every product route is registered in the reachability ledger with evidence', () => {
  const states = new Set(['verified', 'callable', 'blocked', 'unverified', 'unreachable']);
  for (const product of Object.values(VIDEO_PRODUCTS)) {
    const entry = routeReachability(product.routeId);
    assert.ok(entry.state !== 'unknown', `产品 ${product.id} 的路由 ${product.routeId} 未登记进台账`);
    assert.ok(states.has(entry.state), `台账状态非法: ${entry.state}`);
    assert.match(String(entry.evidence || ''), /20\d\d-\d\d-\d\d/, `${product.routeId} 的台账缺证据日期`);
  }
  assert.equal(Object.isFrozen(ROUTE_REACHABILITY), true);
});

test('public products only ride routes that are verified or callable', () => {
  /* 这是防回归的核心门禁：2026-09-16 发现目录 10 条路由里 8 条视频端点根本调不通
     （只核对了「中转目录里有这个名字」，没核对端点可达），用户侧表现为「模型看着有、点了就失败」。
     从今往后，public:true 只允许台账里 verified / callable 的路由。 */
  assert.deepEqual(publicRouteViolations(), []);
  const publics = publicVideoProducts();
  /* 批 J-⑫（2026-09-19）：公开档回到 5 条 —— 下面这个 for 循环才是真正的判据
     （每一条公开档的路由台账都必须是 verified / callable）；这里锁的是**清单本身**，
     防止有人绕过台账偷偷加档。 */
  assert.deepEqual(publics.map(product => product.id), [
    'seedance_fast', 'seedance_standard', 'minimax_h3_768p', 'grok_fast', 'wan_standard',
  ]);
  for (const product of publics) {
    const entry = routeReachability(getVideoProduct(product.id).routeId);
    assert.ok(['verified', 'callable'].includes(entry.state));
  }
  assert.equal(getVideoProduct('minimax_h3_2k').public, false);
  assert.equal(getVideoProduct('kling_pro').public, false);
  assert.equal(getVideoProduct('veo_fast').public, false);
});

test('video feature sku follows product and the upstream duration whitelist', () => {
  assert.equal(videoFeatureSku({ productId: 'seedance_fast', duration: 5 }), 'video_seedance_fast_short');
  assert.equal(videoFeatureSku({ productId: 'seedance_fast', duration: 10 }), 'video_seedance_fast_long');
  assert.equal(videoFeatureSku({ productId: 'seedance_standard', duration: 15 }), 'video_seedance_standard_long');
  /* 上游按秒档位校验（seedance 2.0 只认 5/10/15），白名单外的秒数必须直接拒绝 */
  assert.throws(() => videoFeatureSku({ productId: 'seedance_fast', duration: 8 }), /只支持 5\/10\/15 秒/);
  assert.throws(() => videoFeatureSku({ productId: 'seedance_standard', duration: 9 }), /只支持 5\/10\/15 秒/);
});

test('duration whitelist snaps to legal seconds instead of clamping into an illegal value', () => {
  const standard = getVideoProduct('seedance_standard');
  assert.deepEqual(durationOptionsOf(standard), [5, 10, 15]);
  assert.equal(isDurationSupported(standard, 10), true);
  assert.equal(isDurationSupported(standard, 8), false);
  assert.equal(nearestSupportedDuration(standard, 8), 10);
  assert.equal(nearestSupportedDuration(standard, 6), 5);
  assert.equal(nearestSupportedDuration(standard, 999), 15);
  assert.equal(nearestSupportedDuration(standard, undefined), 5);
  /* 没声明白名单的产品沿用 [min,max] 夹取口径 */
  const legacy = getVideoProduct('kling_standard');
  assert.equal(durationOptionsOf(legacy), null);
  assert.equal(nearestSupportedDuration(legacy, 99), 10);
});

test('video product validation rejects unsupported duration, mode, resolution, and frame audio', () => {
  assert.throws(
    () => validateVideoProductInput({ productId: 'seedance_standard', duration: 8, mode: 'script', resolution: '720p' }),
    /只支持 5\/10\/15 秒/,
  );
  assert.throws(
    () => validateVideoProductInput({ productId: 'seedance_standard', duration: 10, mode: 'unknown', resolution: '720p' }),
    /创作模式/,
  );
  assert.throws(
    () => validateVideoProductInput({ productId: 'seedance_fast', duration: 10, mode: 'script', resolution: '480p' }),
    /清晰度/,
  );
  assert.throws(
    () => validateVideoProductInput({ productId: 'minimax_h3_2k', duration: 10, mode: 'frame', resolution: '2k', generateAudio: true }),
    /首尾帧.*声音/,
  );
  assert.deepEqual(
    validateVideoProductInput({ productId: 'seedance_standard', duration: 10, mode: 'reference', resolution: '720P', generateAudio: true }),
    { productId: 'seedance_standard', duration: 10, mode: 'reference', resolution: '720p', generateAudio: true },
  );
  // 9-11 快试档切 agv 通道: 能力口径收口 —— 5s 起、仅文生/图生(无参考视频/音频、无首尾帧)
  assert.equal(getVideoProduct('seedance_fast').routeId, 'agv-seedance2.0fast');
  assert.deepEqual(getVideoProduct('seedance_fast').modes, ['script', 'reference']);
  assert.equal(getVideoProduct('seedance_fast').limits.videos, 0);
  assert.equal(getVideoProduct('seedance_fast').limits.audios, 0);
  assert.deepEqual(getVideoProduct('seedance_fast').durations, { min: 5, max: 15 });
  assert.deepEqual(getVideoProduct('seedance_fast').durationOptions, [5, 10, 15]);
  assert.throws(
    () => validateVideoProductInput({ productId: 'seedance_fast', duration: 4, mode: 'script', resolution: '720p' }),
    /只支持 5\/10\/15 秒/,
  );
  assert.throws(
    () => validateVideoProductInput({ productId: 'seedance_fast', duration: 5, mode: 'frame', resolution: '720p' }),
    /创作模式/,
  );
});

test('public products omit hidden routes and private provider details', () => {
  const products = publicVideoProducts();
  /* ⚠️ 2026-09-19 批 J-⑫：公开档 2 → **5**。
     用户批注 #10：「我说的有很多的模型，不是让你去抄他的模型，是我们原本就有很多的模型……
     我是让你把之前的那些模型找回来呀。被你搞丢了你知道吗？」
     恢复的依据不是"用户要就给"，是**当天重新实测**：三条通道的参数校验都接住了探针
     （零成本，见 ROUTE_REACHABILITY 的 2026-09-19 evidence），价格也早在 billing/catalog 里备好。
     仍然「not a public model name」的那几条（可灵 / Veo / MiniMax 2K / sd5 族）**继续留在只读清单**——
     点了必失败的东西不许变成选项。 */
  assert.deepEqual(products.map(product => product.id), [
    'seedance_fast', 'seedance_standard', 'minimax_h3_768p', 'grok_fast', 'wan_standard',
  ]);
  assert.equal(products.find(product => product.default)?.id, DEFAULT_VIDEO_PRODUCT_ID);
  assert.equal(products.every(product => !('routeId' in product) && !('credential' in product)), true);
  assert.equal(products.find(product => product.id === 'seedance_fast').providerLabel, '字节跳动');
  assert.equal(products.find(product => product.id === 'seedance_standard').providerLabel, '字节跳动');
  assert.match(products.find(product => product.id === 'seedance_standard').limitations, /5\/10\/15/);
  assert.deepEqual(products.find(product => product.id === 'seedance_fast').durationOptions, [5, 10, 15]);
  assert.deepEqual(products.find(product => product.id === 'seedance_fast').quotes.short, {
    sku: 'video_seedance_fast_short', units: 27000, points: 27,
  });
  assert.deepEqual(products.find(product => product.id === 'seedance_standard').quotes.long, {
    sku: 'video_seedance_standard_long', units: 57000, points: 57,
  });
  assert.equal(products.every(product => !JSON.stringify(product).includes('providerCostCny')), true);
  /* 隐藏档仍可查（老任务/管理端需要），但不能出现在公开目录里 */
  const all = publicVideoProducts({ includeHidden: true });
  assert.equal(all.length, 10);
  assert.deepEqual(all.map(product => product.id), Object.keys(VIDEO_PRODUCTS));
  assert.equal(all.filter(product => product.id === 'kling_standard').length, 1);
  assert.equal(getVideoProduct('kling_standard').public, false);
  /* 恢复上架的那三条：老数据仍可读、且现在**可公开可选** */
  assert.equal(getVideoProduct('minimax_h3_768p').public, true);
  assert.equal(getVideoProduct('wan_standard').public, true);
  assert.equal(getVideoProduct('grok_fast').public, true);
});
