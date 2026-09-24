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
    /* ═══ 2026-09-25 批 AN：1080P 两条（判据未变，事实变了）═════════════════════════════════════
       用户批了价：「1080P 我觉得是按他们那样，比 720P 高一倍的积分」。
       两条按"家族各一条独立产品"开（与 2K 档 minimax_h3_2k 同一做法）：
         · wan_1080p     —— public: true（同一条 xn-wan3.0 路由的文档价 ¥0.455/秒）
         · seedance_1080p —— public: false（预扣 ¥7.67 > 中转余额，充值后翻）
       id 仍在册 ⇒ 老任务/老订单解析不受影响（这份清单守的就是"id 还在"）。 */
    'wan_1080p',
    'seedance_1080p',
    'kling_standard',
    'kling_pro',
    'veo_fast',
    'seedance_25',
    'minimax_h3_2k',
    /* 2026-09-19 批 K-B 新增三档（都是当天实测能走到参数校验的活路由） */
    'sd_js900',
    'sd_js',
    'seedance_mini',
    /* ═══ 2026-09-25 批 AM：**本地方案**两条（判据未变，事实变了）══════════════════════════════
       「视频高清」「视频字幕去除」不走上游模型，走本机 ffmpeg（user:「为什么一切都要追究模型呢」）。
       它们仍是**产品**（有 id / 时长 / 分辨率 / SKU），所以进这份 id 清单；
       但它们**不进模型选择器**（publicVideoProducts 会跳过 localEngine）—— 见下面那条断言。 */
    'upscale_local',
    'desubtitle_local',
    /* ═══ 2026-09-26 批 AR：+1（判据未变，事实变了）—— 自动标记那条走火山 MediaKit，
       是"处理已有视频"的**上游**档（videoProcess: true），与本地那两条共用输入契约。 */
    'desubtitle_volc',
    /* ═══ 2026-09-26 批 AU：+1（判据未变，事实变了）—— 数字人（火山口型对齐）：
       同样是 videoProcess + credential 'volc'，但输入契约多一样（人物视频 + **驱动音频**）。
       ⚠️ 批 AZ：它已 **public: true**（创作台接线完成，见 videoCatalog 里的三段式记录）——
          但**仍然不进模型清单**：它不吃提示词，进了模型下拉用户就会在「视频创作」里
          选到一条点了必失败的档位（下面 isNonModelProduct 那条断言守的就是这个）。 */
    'lipsync_volc',
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
  /* ═══ 2026-09-23 批 AC：公开档 9 → **11**（判据未变，事实变了）════════════════════════════
     可灵两条恢复上架：探针回 400 invalid_duration ⇒ 名字可解析、渠道活着
     （09-19 那条 not a public model name 已不复现）。这一条守的东西一个字没变：
     **public:true 只允许走 verified / callable 的路由**（下面那个 for 循环照旧逐条核）。 */
  /* ═══ 2026-09-25 批 AN：11 → **12**（判据未变，事实变了）══════════════════════════════════════
     新增公开档：通义万相 1080P（route xn-wan3.0，本身就是 callable，下面的 for 循环照旧逐条核）。
     Seedance 1080P **不在**这份清单里 —— 它 public:false（预扣 ¥7.67 > 余额），
     等充值后翻 true，届时这条清单也要跟着改（门禁与事实同步）。 */
  assert.deepEqual(publics.map(product => product.id), [
    'seedance_fast', 'seedance_standard', 'minimax_h3_768p', 'wan_standard', 'wan_1080p',
    'kling_standard', 'kling_pro',
    'seedance_25', 'minimax_h3_2k', 'sd_js900', 'sd_js', 'seedance_mini',
  ]);
  for (const product of publics) {
    const entry = routeReachability(getVideoProduct(product.id).routeId);
    assert.ok(['verified', 'callable'].includes(entry.state));
  }
  /* 上游确实没有了的那一条**不许**变成选项（点了必失败），但老数据仍要读得出来 */
  assert.equal(getVideoProduct('veo_fast').public, false);
  assert.equal(routeReachability('veo-3.1-fast').state, 'retired');
  /* 可灵两条本轮已核实**活着**（400 invalid_duration）⇒ 不再是 retired，恢复到公开档 */
  for (const id of ['kling_standard', 'kling_pro']) {
    assert.equal(getVideoProduct(id).public, true, id + ' 已恢复上架');
    assert.equal(routeReachability(getVideoProduct(id).routeId).state, 'callable');
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
     公开档 10 → 9；判据未变（"点了必失败的东西不许变成选项"）。
     ═══ 2026-09-23 批 AC：公开档 9 → **11** —— 可灵两条本轮实测渠道活着（400 invalid_duration），
     按同一条判据（"能用才显示"）恢复上架；判据字面一个字没改。 */
  /* ═══ 2026-09-25 批 AN：公开档 11 → **12**（判据未变，事实变了）══════════════════════════════
     新增「通义万相 3.0 1080P」（用户批价：「比 720P 高一倍的积分」）——
     它走的是**已经在用的** xn-wan3.0 路由（现网正在出 720p/480p 的片子），文档价目表里
     1080p ¥0.455/秒 白纸黑字，所以这一档满足"能用才显示"。
     Seedance 1080P 不在这份清单里：预扣 ¥7.67 > 中转余额 ⇒ 建单必被上游拒 ⇒ 保持隐藏。 */
  assert.deepEqual(products.map(product => product.id), [
    'seedance_fast', 'seedance_standard', 'minimax_h3_768p', 'wan_standard', 'wan_1080p',
    'kling_standard', 'kling_pro',
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
  /* ═══ 2026-09-25 批 AM：13 → 13（**目录多了两条本地方案，但模型清单一条没多**）══════════════
     判据的本意是「模型清单 = 所有产品」，从本批起不再是 —— 本地方案不是模型：
     把它们放进模型下拉，用户会在「视频创作」里选到一条**不吃提示词**的档位（点了必失败）。
     所以这里改守两件事：① 模型清单里一条本地产品都没有；
     ② 本地产品的报价与规格走另一份只读清单 localVideoProducts（两条都在）。
     ═══ 批 AN：13 → **15**（判据未变，事实变了）—— 1080P 两条**是**模型（走上游路由、
     吃提示词、由用户选），所以进模型清单；其中 seedance_1080p 靠 public:false 挡在公开目录外
     （includeHidden:true 是管理端视角，两条都该在）。 */
  /* ═══ 批 AR：模型清单仍 15 条（判据未变，事实变了）—— 自动标记那条**不是模型**：
     它不吃提示词，进了模型下拉就会让用户在「视频创作」里选到一条点了必失败的档位。
     判据从"排除 localEngine"扩成"排除不是模型的产品（localEngine / videoProcess）"。 */
  assert.equal(all.length, 15, '模型清单 15 条（13 条原有 + 两条 1080P；非模型产品不算）');
  assert.ok(all.some(product => product.id === 'wan_1080p'), '通义万相 1080P 是模型，要在模型清单里');
  assert.ok(all.some(product => product.id === 'seedance_1080p'), 'Seedance 1080P 也是模型（隐藏档仅管理端可见）');
  const localIds = Object.keys(VIDEO_PRODUCTS).filter(id => getVideoProduct(id).localEngine === true);
  assert.deepEqual(localIds.sort(), ['desubtitle_local', 'upscale_local']);
  /* ═══ 批 AR：判据从"排除本地方案"扩成"排除**不是模型的产品**"═════════════════════════════════
     现在有两类非模型产品：localEngine（本机渲染）与 videoProcess（上游"处理已有视频"，
     目前是火山自动去字幕）。两者都**不吃提示词**，进了模型下拉 = 用户会在「视频创作」里
     选到一条点了必失败的档位 —— 守的东西一个字没变，只是这类产品多了第二个成员。 */
  const nonModelIds = Object.keys(VIDEO_PRODUCTS).filter(id => {
    const product = getVideoProduct(id);
    return product.localEngine === true || product.videoProcess === true;
  });
  assert.deepEqual(nonModelIds.sort(), ['desubtitle_local', 'desubtitle_volc', 'lipsync_volc', 'upscale_local']);
  assert.deepEqual(all.filter(product => nonModelIds.includes(product.id)), [], '非模型产品不许出现在模型清单里');
  assert.deepEqual(all.map(product => product.id), Object.keys(VIDEO_PRODUCTS).filter(id => !nonModelIds.includes(id)));
  assert.equal(all.filter(product => product.id === 'kling_standard').length, 1);
  /* ═══ 2026-09-23 批 AC：可灵两条**恢复上架**（判据反转，依据是当日实测）══════════════════════
     09-21 它们是 public:false，理由是台账 retired（上游回 not a public model name）。
     本轮零成本探针把那条结论推翻了：kling-3.0 / kling-3.0-pro 回 **400 invalid_duration**
     ⇒ 名字可解析、渠道活着。按"能用就显示"的既有做法恢复上架，用户价分文未动。 */
  assert.equal(getVideoProduct('kling_standard').public, true, '可灵 3.0 已恢复上架（2026-09-23 实测渠道活着）');
  assert.equal(getVideoProduct('kling_pro').public, true, '可灵 3.0 Pro 同上');
  assert.equal(routeReachability('kling-3.0').state, 'callable');
  assert.equal(routeReachability('kling-3.0-pro').state, 'callable');
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

  /* ═══ 2026-09-25 批 AN：**判据第二次演进** —— 用户批了 1080P 的价，于是它从"零公开档"
     变成"允许公开，但每一档都必须有**自己的价与上游证据**"（判据没有消失，只是换了形态）═══════
     过程如实记在这里：
       · 批 AM（上一条注释）：收窄为"非本地的公开档不许有 1080p"（依据是上游 1080P 更贵、
         同价开 = 降价，属定价决定）。原话提醒「1080P 同一行也在售（¥0.455/秒），但比 720p 贵
         ⇒ 同价开 1080p 是定价决定，须用户点头，本轮不动」。
       · 用户点头了：「**1080P 我觉得是按他们那样，比 720P 高一倍的积分**」+「你确保在不真跑生产
         的情况下，他的通道和逻辑都是 OK 的就好，后续我自己回去一个一个生成案例的」。
       ⇒ 现在的判据：公开的 1080P 档只允许**通义万相 1080P**（独立的 2× 价档、成本有文档出处），
         且 Seedance 1080P 必须**藏着**（预扣 ¥7.67 > 中转余额 ⇒ 建单必被上游拒）。
         逐条价格/毛利/报文/余额自洽的证据在 test/video-1080p-tiers-0925.test.mjs。 */
  const with1080 = Object.values(VIDEO_PRODUCTS)
    .filter(p => p.public === true && p.localEngine !== true && p.resolutions.includes('1080p'))
    .map(p => p.id);
  assert.deepEqual(with1080, ['wan_1080p'],
    '非本地的公开 1080P 档当前只有通义万相那一条（独立 2× 价档）；新增必须补上游证据与门禁');
  assert.equal(getVideoProduct('seedance_1080p').public, false,
    'Seedance 1080P 卡在余额（预扣 ¥7.67 > ¥4.2478），不许公开 —— 详见 video-1080p-tiers-0925 ④');
  assert.deepEqual(getVideoProduct('upscale_local').resolutions, ['720p', '1080p', '2k'],
    '本地方案照知渔那一页：输出分辨率三档一个价（成本 0，不存在"同价即降价"）');

  /* 上游文档里那两条**名字逐字相同**的路由，就是上面两条判断的来源 */
  assert.equal(wan.routeId, 'xn-wan3.0');
  assert.equal(routeReachability('xn-wan3.0').state, 'callable');
});
