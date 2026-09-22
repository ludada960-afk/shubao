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
    /* 2026-09-19 批 K-B 新增三档（都是当天实测能走到参数校验的活路由） */
    'sd_js900',
    'sd_js',
    'seedance_mini',
  ]);
  assert.equal(getVideoProduct('seedance_standard').default, true);
  assert.equal(getVideoProduct('seedance_standard').label, 'Seedance 2.0 标准');
  assert.match(getVideoProduct('seedance_fast').description, /720P/);
  assert.equal(Object.isFrozen(VIDEO_PRODUCTS), true);
  assert.equal(Object.isFrozen(getVideoProduct('seedance_standard').limits), true);
  assert.throws(() => getVideoProduct('__proto__'), /未知视频产品/);
});

test('every product route is registered in the reachability ledger with evidence', () => {
  /* 批 K-B 新增 retired：上游**曾经**有、现在已下架（可灵 / Veo 三条走这个状态） */
  const states = new Set(['verified', 'callable', 'blocked', 'unverified', 'unreachable', 'retired']);
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
  /* 批 K-B（2026-09-19）：公开档 5 → **10**。恢复的依据是当天重新实测：
     ① 判据纠错 —— 只用「模型名能不能走到参数校验」这一条（见 videoCatalog 文件头的判据纠错），
        上午那版把「预扣费失败」当活着的证据，导致 4 条 seedance-2.0-* 被误判成 ALIVE；
     ② 余额挡死的两条改接同族更便宜的活路由（Seedance 2.5 → sd-2.5-js2、2K → xn-minimax-h3），
        用户价分文未动；
     ③ 新增三档（sd_js900 / sd_js / seedance_mini）走的都是当天实测活着的按条路由。 */
  /* ═══ 2026-09-21：公开档 10 → **9**（判据未变，事实变了）════════════════════════════════
     用户第 22 轮原话：「视频模型有些现在下架了，你就拿走吧，没有了就不用显示出来了」。
     零成本复核（只读 /v1/models，115 个模型）：grok-imagine-video **不在**清单里
     （同批其余 12 条路由全在）⇒ 按台账口径转 retired、产品 public:false。
     这一条守的东西一个字没变：**public:true 只允许走 verified / callable 的路由**。 */
  assert.deepEqual(publics.map(product => product.id), [
    'seedance_fast', 'seedance_standard', 'minimax_h3_768p', 'wan_standard',
    'seedance_25', 'minimax_h3_2k', 'sd_js900', 'sd_js', 'seedance_mini',
  ]);
  for (const product of publics) {
    const entry = routeReachability(getVideoProduct(product.id).routeId);
    assert.ok(['verified', 'callable'].includes(entry.state));
  }
  /* 上游已下架的三条**不许**变成选项（点了必失败），但老数据仍要读得出来 */
  assert.equal(getVideoProduct('kling_standard').public, false);
  assert.equal(getVideoProduct('kling_pro').public, false);
  assert.equal(getVideoProduct('veo_fast').public, false);
  for (const id of ['kling_standard', 'kling_pro', 'veo_fast']) {
    assert.equal(routeReachability(getVideoProduct(id).routeId).state, 'retired');
  }
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
  /* 2026-09-21：grok_fast 因上游已下架转 public:false（只读 /v1/models 复核 + 用户口径），
     公开档 10 → 9；判据未变（"点了必失败的东西不许变成选项"）。 */
  assert.deepEqual(products.map(product => product.id), [
    'seedance_fast', 'seedance_standard', 'minimax_h3_768p', 'wan_standard',
    'seedance_25', 'minimax_h3_2k', 'sd_js900', 'sd_js', 'seedance_mini',
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
  assert.equal(all.length, 13);
  assert.deepEqual(all.map(product => product.id), Object.keys(VIDEO_PRODUCTS));
  assert.equal(all.filter(product => product.id === 'kling_standard').length, 1);
  assert.equal(getVideoProduct('kling_standard').public, false);
  /* 恢复上架的那三条：老数据仍可读、且现在**可公开可选** */
  assert.equal(getVideoProduct('minimax_h3_768p').public, true);
  assert.equal(getVideoProduct('wan_standard').public, true);
  /* 2026-09-21 下架：上游已无 grok-imagine-video（只读 /v1/models 复核 + 用户口径）——
     老数据仍可读（id 还在目录里），但不再出现在公开目录里。 */
  assert.equal(getVideoProduct('grok_fast').public, false);
  assert.equal(routeReachability('grok-imagine-video').state, 'retired');
  /* 批 K-B 恢复上架的两条：Seedance 2.5 与 MiniMax 2K */
  assert.equal(getVideoProduct('seedance_25').public, true);
  assert.equal(getVideoProduct('seedance_25').routeId, 'sd-2.5-js2');
  assert.deepEqual(getVideoProduct('seedance_25').limits, { images: 10, videos: 10, audios: 10, total: 30 });
  assert.equal(getVideoProduct('minimax_h3_2k').public, true);
  assert.equal(getVideoProduct('minimax_h3_2k').routeId, 'xn-minimax-h3');
  assert.deepEqual(getVideoProduct('minimax_h3_2k').limits, { images: 30, videos: 30, audios: 30, total: 90 });
  /* 新增三档的报价锚：短长同价（按条路由与时长无关） */
  const quotes = new Map(products.map(product => [product.id, product.quotes.short]));
  assert.deepEqual(quotes.get('sd_js900'), { sku: 'video_sd_js900_short', units: 17263, points: 18 });
  assert.deepEqual(quotes.get('sd_js'), { sku: 'video_sd_js_short', units: 21578, points: 22 });
  assert.deepEqual(quotes.get('seedance_mini'), { sku: 'video_seedance_mini_short', units: 31317, points: 32 });
});

/* 2026-09-23：用户原话「480P / 1080P 这个为什么不能做呢，https://new.ip233.com/docs/models
   你再好好看看文档，确定是没有的吗？」—— 复核结论分两半，这门禁把两半都钉住：
   （一）**480P 能做，而且已经开了一档**：上游文档站（数据源就是 /api/pricing，
        pricing_version=ip233-route-v2）里 routeId 逐字相同的两条在 default 分组下给出
        per_second 480p 报价，且都**不高于**各自 720p 的报价 ⇒ 同价提供不会让毛利变差：
          xn-wan3.0   480p ¥0.26/秒 vs 720p ¥0.325/秒 → 站内 wan_standard 开 480P
          （另一条是 seedance_mini，早就双档）
   （二）**1080P 只差定价决定**：同两条路由的 1080p 报价是 720p 的 1.4~2.9 倍
        （xn-wan3.0 0.455 vs 0.325；xn-seedance-2.0-second 1.859 vs 0.65），
        而站内是**按条固定价**、清晰度不进 SKU 也不进扣费口径 ⇒ 同价开 1080P 等于降价，
        属定价决定，须用户批准，故本轮**故意不开**（这个断言就是「不许偷偷开」）。 */
test('480P 档按上游文档价目开（比 720P 便宜才允许开），1080P 仍需定价批准', () => {
  const wan = getVideoProduct('wan_standard');
  assert.deepEqual(wan.resolutions, ['720p', '480p']);

  /* 与 seedance_mini 同一条规矩：720p 必须在第一位，否则前端按 resolutions[0] 兜底时
     默认档会从 720p 掉到 480p */
  for (const id of ['wan_standard', 'seedance_mini']) {
    assert.equal(getVideoProduct(id).resolutions[0], '720p', `${id} 的第一档必须是 720p`);
  }

  /* 480P 只在有文档价目证据的档位开：除此之外任何产品都不许出现 480p，除非补了新证据 */
  const with480 = Object.values(VIDEO_PRODUCTS).filter(p => p.resolutions.includes('480p')).map(p => p.id);
  assert.deepEqual(with480.sort(), ['seedance_mini', 'wan_standard']);

  /* 1080p 在站内一个公开档都不许有（上游要么是另一条 blocked 路由，要么是定价决定） */
  const with1080 = Object.values(VIDEO_PRODUCTS).filter(p => p.public === true && p.resolutions.includes('1080p'));
  assert.deepEqual(with1080, []);

  /* 上游文档里那两条**名字逐字相同**的路由，就是上面两条判断的来源 */
  assert.equal(wan.routeId, 'xn-wan3.0');
  assert.equal(routeReachability('xn-wan3.0').state, 'callable');
});
