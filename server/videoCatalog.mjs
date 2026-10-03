import { FEATURE_SKUS, quoteFeature } from './billing/catalog.mjs';

/* 批 J-⑫：v4 → v5（2026-09-19 重新实测可达性，公开档 2 → 5）。
   批 K-B：v5 → v6（2026-09-19 二次实测：改用**模型解析**判据取代「预扣费」判据，
   公开档 5 → 10；可灵/Veo 三条确认上游已下架）。 */
export const VIDEO_CATALOG_VERSION = 'video-products-2026-09-19-v6';
export const DEFAULT_VIDEO_PRODUCT_ID = 'seedance_standard';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/* ── 上游可达性台账（2026-09-16 实测复核）────────────────────────────────────
   为什么要有这张表：上一版上架时只核对了「中转 /v1/models 里有这个模型名」，
   但那份清单是全站目录，不等于本站凭证能调到。视频端点真正要求三件事同时成立：
     ① 目录里该模型声明 supported_endpoint_types 含 openai-video（否则 /v1/videos 直接拒收）；
     ② 该模型在 /api/pricing 的 enable_groups 里含本站分组（默认 default）；
     ③ 渠道真的活着：提交能被上游参数校验接住（而不是「上游不认这个模型名」）。
   2026-09-16 复核：本站目录 10 条路由只有 2 条声明 openai-video，其余 8 条永远调不通。
   判定手段全部零成本（不产生任务、不产生费用）：
     /v1/models → supported_endpoint_types ｜ /api/pricing → enable_groups + 真实报价
     ｜ 故意用非法参数提交 → 上游参数校验拦下 = 渠道活着且报文口径对得上。
   状态口径：
     verified    已真实出片（有任务号 + 成片 URL）
     callable    渠道活着、报文口径对得上，未跑真实出片
     blocked     可接入，但本站中转余额不足，提交即被预扣费拦下
     unverified  渠道活着但本站报文口径尚未确认
     unreachable 上游不认该模型名 / 无渠道 / 未定价 / 聚合条件不支持
     retired     上游**曾经**有、现在已下架（老任务仍可读，但不能再选）
   门禁：public:true 只允许 verified / callable，见 test/video-route-reachability.test.mjs。

   ⚠️ 2026-09-19 批 K-B 的**判据纠错**（这条比模型本身更重要）：
   09-19 上午那一轮把「预扣费失败（insufficient_user_quota）」当成「渠道活着」的证据，
   于是把 seedance-2.0-480p/720p/fast-480p/fast-720p 等判成了 ALIVE —— **这是错的**。
   本轮用**不存在的模型名**做对照实验才看清顺序：
     · 模型名不存在 → 503 {"code":"model_not_found","message":"No available channel for model ..."}
     · 模型名存在、时长非法 → 400 参数校验报文
     · 有些渠道**先扣费再解析模型名**，余额不足时回 403 insufficient_user_quota，
       这个报文里**看不出模型名认不认**（对照实验：同一个 403 也出现在真模型上，
       而 4 条 seedance-2.0-* 在 /v1/models 里根本没有 openai-video 声明）。
   现在只用一条判据：**该模型名能不能走到参数校验**（400 且报文是参数错 = 渠道活着）。

   ⚠️ 2026-09-23 复测（用户点名要看上游文档里的 480p/1080p，故按上面③再验一遍）：
   上面第 ① 条**不能当证据用** —— seedance-2.0-{480p,fast-480p,720p,fast-720p} 这四条
   在 /v1/models 里**在册、且明明白白声明了 openai-video**，/api/pricing 也查得到，
   但一提交就回「model <id> is not a public model name」（与 09-19 批 K-B 结论一致）：
   清单是全站目录，本站凭证/渠道并没有这些名字。**只看清单会把死路记成活路**
   （09-19 上午那版台账就是这么错的）；只有提交进到参数校验才算活。
   同日 1080p 那条报文不同：拿到的是 403 余额不足（预扣 ¥7.67 > 余额 ¥5.108880），
   不是「名字不存在」⇒ 它比上面四条更接近可用，**充值后是否真能出片仍需一次真跑**。 */
export const ROUTE_REACHABILITY = deepFreeze({
  'agv-seedance2.0fast': {
    state: 'verified',
    billingMode: 'per_request',
    quoteCny: 0.91,
    evidence: '2026-09-16 真实出片：720p/5s 提交 200，156s 完成并返回成片 URL（task_MHCiB6Yo1LuYbz6wLt9g4MvCN8klJ7oM）',
  },
  'seedance-2.0': {
    state: 'callable',
    billingMode: 'per_request',
    quoteCny: 5.07,
    evidence: '2026-09-16 提交 200（中转映射上游 sd10-seedance-2.0）；同族 1080p 被分辨率白名单拒收，故本档只开 720p',
  },
  'seedance-2.0-fast': {
    state: 'callable',
    billingMode: 'per_request',
    quoteCny: 3.77,
    evidence: '2026-09-16 免费探针：非法时长被上游拦下（渠道活着 + 报文口径对得上），未跑真实出片',
  },
  'seedance-2.0-mini': {
    state: 'callable',
    billingMode: 'per_request',
    quoteCny: 3.77,
    evidence: '2026-09-16 免费探针：非法时长被上游拦下（渠道活着 + 报文口径对得上），未跑真实出片',
  },
  'seedance-2.0-1080p': {
    state: 'blocked',
    billingMode: 'per_request',
    quoteCny: 7.67,
    evidence: '2026-09-23 复测：预扣 ¥7.67 > 当前余额 ¥5.108880（insufficient_user_quota）⇒ 仍 blocked。**充值即可解**，与代码无关；报文是「余额不足」而非「名字不存在」——说明这条比四条 seedance-2.0-* 死路由更接近可用，但充值后能否真出片仍需一次真跑（零成本探针无法证明）',
  },
  'minimax-h3': {
    state: 'callable',
    billingMode: 'per_second',
    quoteCny: 0.364,
    evidence: '2026-09-19 零成本复核（minimax content 报文 + 非法时长）：上游参数校验接住并回 unsupported video duration ⇒ 渠道活着、报文口径对得上 ⇒ callable。¥0.364/秒，5 秒约 ¥1.82，低于当前中转余额',
  },
  'minimax-h3-per-request': {
    state: 'blocked',
    billingMode: 'per_request',
    quoteCny: 7.41,
    evidence: '2026-09-19 批 K-B 复测：模型名可解析（渠道活着）；预扣 ¥7.41 > 当前余额 ¥5.11 ⇒ 仍 blocked。**充值即可解**',
  },
  'xn-seedance-2.5': {
    state: 'blocked',
    billingMode: 'per_second',
    quoteCny: 1.872,
    evidence: '2026-09-19 复测：渠道活着（参数校验接住非法时长）；5 秒预扣 ¥9.36 > 当前余额 ¥5.11 ⇒ 仍 blocked。**充值即可解**，与代码无关',
  },
  /* ═══ 2026-09-19 批 K-B：本轮实测「模型名能走到参数校验」的活路由 ═══════════════════════
     全部零成本（非法时长 = 1 秒，上游参数校验在生成之前拦下，不建任务不扣费）。
     报文里带出了各自真实的时长区间，所以下面的 durations 不是猜的。 */
  'sd-2.5-js2': {
    state: 'callable',
    billingMode: 'per_request',
    quoteCny: 3.38,
    evidence: '2026-09-19 批 K-B：非法时长被上游接住并回「duration 1s out of range for sd-2.5-js2; allowed 4-30」⇒ 渠道活着、时长区间 4-30 秒是上游自己报的；按条 ¥3.38，10 图/10 视频/10 音频；站内产品 Seedance 2.5 取 5/10/15 秒（⊂4-30）',
  },
  'sd-2.0-js': {
    state: 'callable',
    billingMode: 'per_request',
    quoteCny: 2.6,
    evidence: '2026-09-19 批 K-B：上游回「duration 1s out of range for sd-2.0-js; allowed 4-15」⇒ 渠道活着、时长 4-15 秒；按条 ¥2.6，9 图/3 视频/3 音频',
  },
  'sd-2.0-js900': {
    state: 'callable',
    billingMode: 'per_request',
    quoteCny: 2.08,
    evidence: '2026-09-19 批 K-B：上游回「duration 1s out of range for sd-2.0-js900; allowed 4-15」⇒ 渠道活着且时长区间 4-15 秒；按条 ¥2.08（轻量档，仅 9 张参考图）',
  },
  'sd-2.0-as': {
    state: 'callable',
    billingMode: 'per_request',
    quoteCny: 2.21,
    evidence: '2026-09-19 批 K-B：上游回「duration 1s is not available for sd-2.0-as; allowed 5, 10, 15」⇒ 渠道活着、只认 5/10/15 秒；按条 ¥2.21（未上架）',
  },
  'sd-2.0-933-medium': {
    state: 'callable',
    billingMode: 'per_second',
    quoteCny: 0.442,
    evidence: '2026-09-19 批 K-B：上游回「duration 1s out of range for sd-2.0-933-medium; allowed 4-15」⇒ 渠道活着、时长 4-15 秒；按秒 ¥0.442（未上架：按秒 × 15 秒会击穿按条 SKU 的短长两档口径）',
  },
  'sd-2.0-933-max': {
    state: 'callable',
    billingMode: 'per_second',
    quoteCny: 0.624,
    evidence: '2026-09-19 批 K-B：上游回「duration 1s out of range for sd-2.0-933-max; allowed 4-15」⇒ 渠道活着、时长 4-15 秒；按秒 ¥0.624（同上，未上架）',
  },
  'xn-minimax-h3': {
    state: 'callable',
    billingMode: 'per_request',
    quoteCny: 3.64,
    evidence: '2026-09-19 批 K-B：非法时长被上游接住（unsupported video duration）⇒ 渠道活着；按条 ¥3.64，支持 4-15 秒、480p/720p/1440p、30 图/30 视频/30 音频参考、支持人脸',
  },
  'xn-minimax-h3-second': {
    state: 'callable',
    billingMode: 'per_second',
    quoteCny: 0.364,
    evidence: '2026-09-19 批 K-B：非法时长被上游接住（unsupported video duration）⇒ 渠道活着；按秒 ¥0.364',
  },
  'ip233-minimax-h3': {
    state: 'callable',
    billingMode: 'per_second',
    quoteCny: 0.364,
    evidence: '2026-09-19 批 K-B：上游把合法秒数直接报了出来「minimax-h3 supported seconds: 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15」⇒ 渠道活着且时长口径明确；按秒 ¥0.364，支持到 2160p',
  },
  'xn-seedance-2.0': {
    state: 'callable',
    billingMode: 'per_request',
    quoteCny: 6.63,
    evidence: '2026-09-19 批 K-B：非法时长被上游接住（unsupported video duration）⇒ 渠道活着；按条 ¥6.63（余额不足，未上架）',
  },
  'xn-seedance-2.0-fast': {
    state: 'callable',
    billingMode: 'per_second',
    quoteCny: 0.715,
    evidence: '2026-09-19 批 K-B：非法时长被上游接住（unsupported video duration）⇒ 渠道活着；按秒 ¥0.715',
  },
  'sd5-seedance-2.0': {
    state: 'unreachable',
    evidence: '2026-09-16 该 id 未声明 openai-video，/v1/videos 提交被上游拒（not a public model name）',
  },
  'sd5-seedance-2.0-fast': {
    state: 'unreachable',
    evidence: '2026-09-16 同 sd5-seedance-2.0：未声明 openai-video',
  },
  'minimax-h3-768p': {
    state: 'unreachable',
    evidence: '2026-09-16 该 id 未声明 openai-video，视频端点不可达',
  },
  /* 2026-09-19 批 K-B 更正：09-16 的「未声明 openai-video」已不成立 —— 本轮实测该模型名
     **解析得出来且已定价**（403 预扣费 ¥5.850000，正好等于 billing 里记的 ¥5.85/条），
     只是余额 ¥5.11 < ¥5.85 ⇒ blocked。**充值即可解**。 */
  'minimax-h3-2k': {
    state: 'blocked',
    billingMode: 'per_request',
    quoteCny: 5.85,
    evidence: '2026-09-19 批 K-B 实测：非法时长请求返回 403 insufficient_user_quota「需要预扣费额度: ¥5.850000」⇒ 模型名可解析、渠道在、价目与账面一致；余额 ¥5.11 不足故 blocked',
  },
  'seedance-2.0-4k': {
    state: 'blocked',
    billingMode: 'per_request',
    quoteCny: 5.85,
    evidence: '2026-09-19 批 K-B 实测：非法时长请求返回 403 insufficient_user_quota「需要预扣费额度: ¥5.850000」⇒ 渠道在、按条 ¥5.85；余额 ¥5.11 不足故 blocked',
  },
  /* 2026-09-21 复核：**上游已下架** —— /v1/models（115 个）里没有 grok-imagine-video，
     用户也确认中转站已经没有了 ⇒ 转 retired、产品 public:false（点了必失败的东西不许变成选项）。 */
  'grok-imagine-video': {
    state: 'retired',
    billingMode: 'per_request',
    quoteCny: 0.104,
    evidence: '2026-09-21 零成本复核：GET /v1/models 返回 115 个模型，其中**没有** grok-imagine-video（同批其余 12 条路由全在）；用户亦确认中转站已下架 ⇒ retired。（历史：2026-09-19 零成本探针曾走到预扣费那一步 ¥0.104/秒 ⇒ 当时是 callable）',
  },
  'grok-video': { state: 'unreachable', evidence: '2026-09-16 声明 openai-video 但上游返回 not a public model name' },
  'grok-video-1.5': { state: 'unreachable', evidence: '2026-09-16 同 grok-video' },
  'xn-wan3.0': {
    state: 'callable',
    billingMode: 'per_request',
    quoteCny: 0.455,
    evidence: '2026-09-19 零成本复核：非法时长被上游参数校验接住（unsupported video duration）⇒ 渠道活着。09-16 那次「聚合条件不支持」已不复现；¥0.455/条，低于当前中转余额',
  },
  /* 2026-09-19 批 K-B：三条**确认上游已下架**（不再是"暂未开放"）。对照实验里它们与
     伪造模型名走的是同一条路：上游回「model kling-3.0 is not a public model name」。
     这就是用户批注里「被你搞丢了」的那三条 —— 丢的原因不在我们代码，在上游没有这些模型了。 */
  /* ═══ 2026-09-23 批 AC：**可灵两条又活了**（上游重新开放），retired → callable ═══════════════
     今日零成本探针（非法时长 duration=1，参数校验在生成之前拦下）：
       kling-3.0      → 400 invalid_duration「该模型不支持此时长，请改用支持的秒数后重试。」
       kling-3.0-pro  → 400 invalid_duration（同上）
     ⇒ 名字解析成功、渠道活着（不再是 09-19 的 not a public model name）。
     文档价目同日在售：kling-3.0 ¥1.82/条、kling-3.0-pro ¥3.77/条 —— 与站内既有 SKU 记账一致
     （video_kling_standard_* 16000 units / video_kling_pro_* 32000 units），所以**价格不用动**。
     ⚠️ 这是本项目第二次出现"上游状态变了"（第一次是 09-19 的四条 seedance 变死）；
        教训是同一件事的两面：**台账是快照，不是事实**，必须定期用探针复核。 */
  'kling-3.0': { state: 'callable', evidence: '2026-09-23 批 AC 复测：提交回 400 invalid_duration（参数校验接住）⇒ 渠道活着、名字可解析；09-19 记的 not a public model name 已不复现（上游重新开放）。文档价 ¥1.82/条，与站内既有 SKU 一致' },
  'kling-3.0-pro': { state: 'callable', evidence: '2026-09-23 批 AC 复测：同 kling-3.0（400 invalid_duration）；文档价 ¥3.77/条，与站内既有 SKU 一致' },
  'veo-3.1-fast': { state: 'retired', evidence: '2026-09-19 批 K-B 复核：同 kling-3.0 —— ⚠️ 2026-09-23 没有复测 veo（可灵两条已活，veo 待下一次探针复核）' },
  /* ═══ 2026-09-23 批 AC：**视频转视频（v2v）第一次被登记** ═══════════════════════════════════
     用户问「数字人 / 视频高清 / 视频字幕去除 这些是必须上游模型有这些能力吗，难道不是因为
     skill 封装的方案吗」——他说得对：我上一轮只按**模型名里有没有关键词**下结论，漏掉了
     "用一条通用 v2v 路由 + skill 封装"这条路。今日探针把这条路找到了：
       omni-v2v / omni-v2v-no-water → 400 invalid_reference「该模型需要参考素材，请补充后重试。」
     ⇒ **渠道活着、我们的凭证能调**（这不是"名字不存在"，是"缺参考素材"的参数错）。
     文档：Omni 视频转视频 ¥1.15128/条（无水印 ¥1.3455/条）。
     ⚠️ 状态先记 callable 而**不是 verified**：输入输出契约（能不能按指定分辨率重绘 /
        能不能按提示词擦掉字幕）**没有实测过**，要一次真实出片才能定；
        在那之前不许把任何产品挂在它上面（门禁只允许 verified/callable 上架，
        但这里更严：**callable 只代表渠道活，不代表这个用途成立** —— 用途要单独实测）。 */
  /* ═══ 2026-09-25 批 AN：1080P 那条**独立模型名**的路由（Seedance 2.0 超清）═══════════════════
     状态 blocked 的判据是 9-16 的零成本实测：请求走完了渠道解析与参数校验，
     最后**只**卡在预扣（¥7.67/条 > 中转余额）—— 这与 'wan3.0-video' 那条同一类：
     "活着但余额不足，充值即开"。按本站铁律，blocked 就不许上架（点了必失败），
     所以产品与 SKU 保持 public: false，等余额充足再翻。 */
  'seedance-2.0-1080p': { state: 'blocked', evidence: '2026-09-16 批 K-B 零成本实测：渠道与参数校验均通过，仅因预扣 ¥7.67/条 > 中转余额被拒（insufficient_user_quota）⇒ 活着、余额不足，充值即开。2026-09-25 批 AN 复核价目表：该模型在册（¥7.67/条，billing_mode=per_request，声明 openai-video）。⚠️ 未做付费出片实测（用户在等他自己的案例验证）。' },
  'omni-v2v': { state: 'callable', evidence: '2026-09-23 批 AC 零成本探针：提交回 400 invalid_reference（该模型需要参考素材）⇒ 渠道活着、名字可解析；文档价 ¥1.15128/条。用途（视频高清 / 去字幕）**未实测**，上架前必须有一次真实出片' },
  'omni-v2v-no-water': { state: 'callable', evidence: '2026-09-23 批 AC：同 omni-v2v；文档价 ¥1.3455/条' },
  'omni-fast': { state: 'callable', evidence: '2026-09-23 批 AC 探针**真的建了任务**（该路由不校验非法时长，task_GewlyXIKqBqJCRqCupaPa28XlebVeB7H，扣 ¥0.86112 —— 余额 5.108880 → 4.247760 可对账）⇒ 渠道活着；**这条路由没有参数校验兜底，探针必须带真实意图**，不要再拿它试错' },
  /* ═══ 2026-09-25 批 AM：**本机渲染**（不是上游路由）═══════════════════════════════════════════
     这是台账里第一条**设备侧**的实现：视频高清（ffmpeg scale/fps）与字幕去除（ffmpeg delogo）
     不调任何上游，所以"可达性"= 这台机器上有没有 ffmpeg，而不是中转渠道活不活。
     登记为 `callable`（门禁只认 verified/callable 才允许上架）并且**如实写清证据边界**：
       · 2026-09-25 本机（Windows / ffmpeg 8.1.1）实跑通：scale / fps / delogo 三条滤镜链出片；
       · 2026-09-25 线上（114.132.157.250）apt 安装 ffmpeg 后 `ffmpeg -version` 可用 —— 见批 AM 的 RTK 记录。
     ⚠️ 与上游路由的本质差别：它**不会**因为余额/渠道抖动而失败，但会因为"这台机器没有 ffmpeg"
        而失败 —— 所以只有 ① 装机确认 + ② 建单前的 `ffmpegAvailable()` 预检（缺了就不收钱、
        直接 503）两道都在，才允许把它放进可公开的产品里。 */
  'local-ffmpeg': { state: 'callable', evidence: '2026-09-25 批 AM：本机 ffmpeg 8.1.1 与线上 apt 安装的 ffmpeg 均实测出片（scale / fps / delogo）；本地方案的上架前提是"装机 + 建单前预检"，见 server/videoLocalAdapter.mjs 的 ffmpegAvailable' },
  /* ═══ 2026-09-26 批 AR：**火山 AI MediaKit**（字幕擦除，自动标记那一档）══════════════════════════
     用户拍板：「我觉得自己接去字幕很麻烦，**不如就直接接火山API**吧」+「自动标记卖多少就按你说的来吧」。
     这是**上游**（不是本机）：站内片子先上传到 MediaKit 换 `mediakit://{file_id}`，再提交擦除任务、轮询、下载。
     ⚠️ 状态为什么是 unverified 而不是 callable：**还没真跑过一次** ——
        Key 已配好并用只读请求验真（真 Key 走到业务层、坏 Key 403，对照证据见 .tmp/zc-volc-key-contrast.mjs），
        但用户**账户未充值**（火山后付费也要余额，欠费 72h 连新任务都拒）⇒ 付费调用一次都没发。
        等跑通 `.tmp/zc-volc-subtitle-probe.mjs`（30 秒片标准版约 ¥0.20），把证据与日期写进这里再转 callable。 */
  'volc-media-kit-subtitle': { state: 'callable', evidence: '2026-09-26 真机实测出片：6 秒测试片走本地上传（取票据必须带 file_size ｜ PUT 纯二进制 ｜ mediakit://file_id），任务 amk-tool-erase-video-subtitle-1355189656834 返回 completed、result.duration=5.967 秒、result.video_url 有值；计费与文档一致（约 0.04 元）。契约细节与两处实测纠错见 server/volcSubtitleErase.mjs 注释' },
  /* ═══ 2026-09-26 批 AU：**火山 AI MediaKit 视频口型对齐**（数字人那一档）═══════════════════════
     用户对数字人的要求（原话）：「数字人要不要用对口型的，你先看一下知渔他们那边是什么策略」→
     实查结论（docs/design/72）：知渔的"数字人"就是**换口型**（模型入参只有 source_video_url +
     source_audio_url，整个 bundle 里 lipsync/heygen/hedra 全库 0 命中）⇒ 我们照同一形态做。
     上游：同一把 MediaKit Key，`POST /api/v1/tools/lip-sync`，官方口径 **1 元/分钟**
     （比阿里云 IMS 数字人的 9.9 元/分钟便宜 10 倍）。
     ⚠️ **2026-09-24 批 AX：真机跑通了一次**（用户：「数字人这个，真人视频你自己可以找呀，
        网上一大堆，我们反正只是测试呀」）——
        素材：免版权站的单人正脸片段（8.56 秒）+ 站内 TTS 合成的中文配音（7.25 秒）；
        任务 \`amk-tool-lip-sync-1401540081154\` → completed（约 92 秒）；
        成片 **7.28 秒**（= 音频时长，\`enable_video_loop: true\` 生效）、成本 ≈ **¥0.1213**；
        抽帧对比确认**嘴型真的跟着配音变了**（.tmp/dh/out/compare.jpg）。
        ⇒ 台账转 **callable**；**价也已由用户确认**（「你利润这块觉得还可以就行」）。
        ⚠️ 产品暂时仍 public:false，但**原因变了**：不再是"没实测/没定价"，而是
           **创作台那一页还没接线**（upstream-process 引擎在 VideoStudio 里还没有对应的
           音频槽位/时长探针/报价数量分支）⇒ 现在放开也点不进去。接线是最后一步，见 docs/design/74。 */
  'volc-media-kit-lipsync': { state: 'callable', evidence: '2026-09-24 真机实测出片：单人正脸素材 8.56s + 站内 TTS 中文配音 7.25s → 任务 amk-tool-lip-sync-1401540081154 completed（92 秒），成片 7.28 秒（按音频时长）、成本约 ¥0.1213；抽帧对比确认嘴型跟随配音。契约（POST /tools/lip-sync，body 只有 video_url/audio_url/enable_video_loop 等 8 个字段）见 server/volcLipSync.mjs' },
  'wan3.0-video': { state: 'blocked', evidence: '2026-09-23 批 AC 探针：403 insufficient_user_quota（预扣 ¥6.37 > 余额 ¥4.2478）⇒ 活着但余额不足，充值即开' },
  'sd8-seedance-2.5': { state: 'unreachable', evidence: '2026-09-16 该 id 未声明 openai-video，视频端点不可达' },
  /* 2026-09-19 批 K-B 复核 + 2026-09-23 复测：四条都维持 unreachable —— 提交回
     「not a public model name」。（09-23 复测已证实：这四条**在** /v1/models 里且声明了
     openai-video，所以「没声明」不是理由；真正的理由是本站凭证调不到这个名字。
     09-19 上午那版台账把它们记成 ALIVE(quota) 是判据用错了，见文件头的判据纠错。） */
  'seedance-2.0-720p': { state: 'unreachable', evidence: '2026-09-23 复测（零成本 duration=1）：提交回 model seedance-2.0-720p is not a public model name；⚠️ 该名在 /v1/models 里在册且声明 openai-video，故**声明不能当活路由的证据**' },
  'seedance-2.0-fast-720p': { state: 'unreachable', evidence: '2026-09-23 复测：同 seedance-2.0-720p（not a public model name）' },
  'seedance-2.0-480p': { state: 'unreachable', evidence: '2026-09-23 复测：同 seedance-2.0-720p（not a public model name）。用户问「480P 到底有没有」的答案：**这四条路由没有**，能调到的 480p 档是 minimax 系（见 xn-minimax-h3）与站内已公开的 Seedance 2.0 Mini' },
  'seedance-2.0-fast-480p': { state: 'unreachable', evidence: '2026-09-23 复测：同 seedance-2.0-480p' },
  'sd2.0-720p-official': { state: 'unreachable', evidence: '2026-09-16 本站分组（default/distributor）下无可用渠道' },
  'sd2.5-720p-official': { state: 'unreachable', evidence: '2026-09-16 本站分组（default/distributor）下无可用渠道' },
  'sd2.0-1080p-official': { state: 'unreachable', evidence: '2026-09-16 本站分组（default/distributor）下无可用渠道' },
  'sd2.5-1080p-official': { state: 'unreachable', evidence: '2026-09-16 本站分组（default/distributor）下无可用渠道' },
  'sd-full-1080p': { state: 'unreachable', evidence: '2026-09-16 中转未定价（模型价格尚未由管理员配置）' },
  'sd-full-720p': { state: 'unreachable', evidence: '2026-09-16 中转未定价' },
  'sd-full-fast-720p': { state: 'unreachable', evidence: '2026-09-16 中转未定价' },
  'sd-face-720p': { state: 'unreachable', evidence: '2026-09-16 中转未定价' },
});

export function routeReachability(routeId) {
  const key = typeof routeId === 'string' ? routeId.trim() : '';
  /* 用 hasOwn 取值：避免 'constructor' / '__proto__' 这类串拿到原型上的东西 */
  if (!key || !Object.hasOwn(ROUTE_REACHABILITY, key)) {
    return { state: 'unknown', evidence: '未登记：新路由必须先补台账与证据再公开' };
  }
  return ROUTE_REACHABILITY[key];
}

/* 门禁本体：公开产品只允许走台账里 verified / callable 的路由。
   返回违规清单（空数组 = 合规），供契约测试与发布前检查调用。 */
export function publicRouteViolations() {
  const allowed = new Set(['verified', 'callable']);
  return Object.values(VIDEO_PRODUCTS)
    .filter(product => product.public === true)
    .map(product => ({ productId: product.id, routeId: product.routeId, state: routeReachability(product.routeId).state }))
    .filter(entry => !allowed.has(entry.state));
}

/* 时长白名单：上游按秒档位校验（seedance 2.0 家族只认 5/10/15 秒）。
   产品不写 durationOptions 时沿用 [min,max] 整数区间；写了就只认白名单里的秒数。 */
function durationAllowed(product, seconds) {
  const options = product.durationOptions;
  if (Array.isArray(options) && options.length) return options.includes(seconds);
  return seconds >= product.durations.min && seconds <= product.durations.max;
}

export function durationErrorMessage(product) {
  const options = product.durationOptions;
  if (Array.isArray(options) && options.length) {
    return `视频产品 ${product.label} 只支持 ${options.join('/')} 秒`;
  }
  return `视频产品 ${product.label} 支持 ${product.durations.min} 到 ${product.durations.max} 秒`;
}

export function durationOptionsOf(product) {
  const options = product?.durationOptions;
  return Array.isArray(options) && options.length ? [...options] : null;
}

export function isDurationSupported(product, seconds) {
  const value = Number(seconds);
  if (!product || !Number.isInteger(value)) return false;
  return durationAllowed(product, value);
}

/* 把秒数吸附到最近的合法档位：有白名单时只可能落在白名单里，没有时按 [min,max] 夹取。
   前端滑块/输入框与后端估算都走这里，保证「界面上能选的秒数」= 「上游接受的秒数」。 */
export function nearestSupportedDuration(product, seconds) {
  const value = Number(seconds);
  const options = durationOptionsOf(product);
  if (!options) {
    const fallback = Number.isFinite(value) ? value : product.durations.min;
    return Math.max(product.durations.min, Math.min(product.durations.max, fallback));
  }
  if (!Number.isFinite(value)) return options[0];
  return options.reduce((best, option) => (Math.abs(option - value) < Math.abs(best - value) ? option : best), options[0]);
}

/* 报价用的合法长档秒数：取白名单里第一个大于 8 秒的档位（对应计费 long 档），没有则取最大档。 */
function longQuoteSeconds(product) {
  const options = product.durationOptions;
  if (Array.isArray(options) && options.length) {
    const long = options.find(seconds => seconds > 8);
    return long || options[options.length - 1];
  }
  return Math.max(product.durations.min, Math.min(9, product.durations.max));
}

/* ═══ 2026-09-25 批 BM：模型的**家族 / 型号**两组元数据（用户批注，逐字）════════════════════════
   用户原话：「你这个模型选择……为什么 seedance 不放到一起呢？mini max 你也没有放到一起。
   **为什么会有 720P 的特定模型呢？720P 应该在生成设置里面去选的呀**。
   用户在这里就只负责选相应的模型就可以了，然后参数是在生成设置里面去做的呀。」

   改前的毛病：模型下拉**按目录书写顺序**平铺，四条 Seedance 被 MiniMax / 通义万相 / 可灵隔成
   4 段，MiniMax 的两行中间隔了 5 行；而且「Seedance 2.0 轻量 720P」「MiniMax H3 768P」
   把**分辨率写进了型号名**，看起来像"720P 是一个模型"。

   ── 两个新字段各自的职责（都不进钱路）─────────────────────────────────────────
     · family / familyLabel   —— 品牌家族，**模型下拉的分组标题**（Seedance / MiniMax / 通义万相 / 可灵）。
     · variant / variantLabel —— 型号，**下拉里的一行**。同一 variant 的多条产品 =
       "同一个型号的不同分辨率档"，在「生成设置 → 清晰度」里选，不再各占一行。
       variantLabel 是**给用户看的型号名**（不带分辨率）；
       label 保持原有的精确档位名（账单标签 / 后台 / 报错文案仍要用它认档）。

   ── 为什么分辨率仍然是"一个档位一条产品"（钱路上的事实，不是没来得及改）────────────
     站内计费 SKU 由**产品 id** 派生（video_${id}_${short|long}，见 videoFeatureSku），
     于是一条产品只能对一条价档。720P 与 1080P 的上游成本不同（通义万相 ¥0.325/秒 vs ¥0.455/秒），
     所以它们必须是两条产品 —— 这是 1080P / 2K 档（批 AN）就定下的做法。
     ⇒ 界面上"一行型号 + 分辨率档位"，钱路上"一条产品一条价档"：
        用户看到的是模型和参数，账目里仍然一条不漏。 */

export const VIDEO_PRODUCTS = deepFreeze({
  seedance_fast: {
    id: 'seedance_fast',
    label: 'Seedance 2.0 Fast',
    providerLabel: '字节跳动',
    tierLabel: '快速成片',
    family: 'seedance', familyLabel: 'Seedance',
    variant: 'sd-2.0-fast', variantLabel: 'Seedance 2.0 Fast',
    description: '更快完成 720P 营销短片，适合试稿、批量迭代和节奏验证。',
    limitations: '优选通道按条计费，只出 5/10/15 秒；不支持参考视频/参考音频与首尾帧模式，这些需求请改用标准版。',
    /* 9-11 换档: 路由切到 IP233 优选通道 agv-seedance2.0fast(¥0.91/条, 实测报价),
       原 sd5-seedance-2.0-fast(¥5.07/条) 退役; 同 host 同协议(任务式 /videos)。
       9-16 复核: 该路由是目录里唯一已真实出片验证的通道, 保留公开。 */
    routeId: 'agv-seedance2.0fast',
    credential: 'seedance',
    public: true,
    default: false,
    durations: { min: 5, max: 15 },
    durationOptions: [5, 10, 15],
    resolutions: ['720p'],
    modes: ['script', 'reference'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 9, videos: 0, audios: 0, total: 9 },
    concurrency: 2,
    pollIntervalMs: 10000,
  },
  seedance_standard: {
    id: 'seedance_standard',
    label: 'Seedance 2.0 标准',
    providerLabel: '字节跳动',
    tierLabel: '正式交付',
    family: 'seedance', familyLabel: 'Seedance',
    variant: 'sd-2.0', variantLabel: 'Seedance 2.0',
    description: '稳定完成 720P 多模态营销短片，适合商品、人物与场景的正式交付。',
    limitations: '只出 5/10/15 秒；生成时间更长，高峰期会进入独立队列等待。',
    /* 9-16 路由纠错: 原 sd5-seedance-2.0 未声明 openai-video, /v1/videos 永远调不通(用户看到的是
       「模型不可用」), 实测换成 seedance-2.0 —— 中转映射上游 sd10-seedance-2.0, 提交 200。
       账面成本 ¥5.07/条与 billing/catalog.mjs 原记录一致, 因此用户价格不动。 */
    routeId: 'seedance-2.0',
    credential: 'seedance',
    public: true,
    default: true,
    durations: { min: 5, max: 15 },
    durationOptions: [5, 10, 15],
    resolutions: ['720p'],
    modes: ['script', 'reference', 'frame', 'remake'],
    generatedAudio: true,
    frameAudio: true,
    limits: { images: 9, videos: 3, audios: 3, total: 12 },
    concurrency: 2,
    pollIntervalMs: 10000,
  },
  /* ═══ 2026-09-19 批 J-⑫：**恢复上架**（用户批注 #10）═══════════════════════════════════════
     用户原话：「视频生成这边，你真的是要气死我了。**我说的有很多的模型，不是让你去抄他的模型，
     是我们原本就有很多的模型**，好吗？你之前做过有一版，它是有**很多模型**在这里的，但是你最近
     这几版不知道怎么回事，做着做着就**只剩下两个模型**了。**我是让你把之前的那些模型找回来呀。
     被你搞丢了你知道吗？**」
     上一轮（批 H-7）把它们做成了「可见但不可选」的只读清单 —— 用户还是不满意：
     他要的是**能选**。而当时的判据（09-16 台账）今天已经有两条不成立了，所以本轮**重新实测**：
       · 全部零成本（故意用非法时长提交 → 上游参数校验在**生成之前**拦下，
         不产生任务、不产生费用；两次探针的原始响应都留在这条台账的 evidence 里）；
       · 实测结果：minimax-h3（本条）/ xn-wan3.0 / grok-imagine-video 三条通道**今天都是活的**；
         kling-3.0 / kling-3.0-pro / veo-3.1-fast / minimax-h3-2k / sd5-* 仍然是
         「not a public model name」→ 那几条继续留在只读清单里（点了必失败的东西不许变成选项）。
     ⚠️ 恢复上架的前提是**价格早就备好了**：billing/catalog.mjs 里
        video_minimax_h3_768p_short/long 与 providerCostCny 一直在，只是被可达性挡着。 */
  /* 9-16 下架: minimax-h3-768p 未声明 openai-video, 视频端点不可达。
     改接同族活路由 minimax-h3(¥0.364/秒, 走 minimax content 报文), 待用该报文复核后开 public。
     9-19 复核通过（见 ROUTE_REACHABILITY 的 evidence）→ **public: true**。 */
  minimax_h3_768p: {
    id: 'minimax_h3_768p',
    label: 'MiniMax H3 768P',
    providerLabel: 'MiniMax',
    tierLabel: '主流可选',
    family: 'minimax', familyLabel: 'MiniMax',
    variant: 'minimax-h3', variantLabel: 'MiniMax H3',
    /* 批 BJ：描述缩到**一行**（用户原话：「你现在这些模型的描述全部有第二行存在……我好像只看到你这个
       mini max H3 它是有第二行的。其他的模型都没有第二行导致下面都是空的。你不如就把 mini max 的这个
       描述缩短一点。然后整体的描述变成一行就可以了。」）
       实测：行内文字区约 380px（10px 字），这一条 38 字会换行，其他档都在 30 字以内。缩短到 26 字。 */
    description: '文生/图生/多模态/首尾帧都能做，节奏与人物稳定性好。',
    /* ⚠️ 2026-09-25 批 BM-7 修正计费口径：原来写「按秒计费」是**错的** ——
       本档两条 SKU 都是按条固定价（short/long 同为 38000 units = 38 积分），
       台账的 costPerClipCny=4.55 也是按条口径。上游那条通道按秒供货 ≠ 用户按秒付费。 */
    limitations: '按条计费；480P 与 720P 双档；参考视频与参考音频不限，首尾帧需两张图。',
    routeId: 'minimax-h3',
    credential: 'minimax',
    public: true,
    default: false,
    durations: { min: 5, max: 15 },
/* 批 BM-6 追加：给 MiniMax H3 加 **480P** 档。
   证据（今天实测、零成本、只读）：从生产机的 VIDEO_API_KEY 调上游
   `GET https://api-new.ip233.com/api/pricing`（pricing_version=ip233-route-v2），
   其中 **minimax-h3 这一条**（路由名与本产品 routeId 逐字相同）的 description 原文：
     "Drama API MiniMax H3 video generation. Per-second pricing: 480p 0.108, 720p 0.162, 1080p 0.4725."
   ⇒ 480p **比现有 720p 更便宜**（¥0.108 < ¥0.162），同价提供不会让毛利变差 ——
      与批 AN 给通义万相加 480P 用的是同一条判据（站内按条固定价，清晰度不进 SKU、不进扣费口径）。
   ⚠️ 1080p（¥0.4725/秒 ≈ 720p 的 2.9 倍）**不在本轮**：那是定价决定，须用户点头，
      而且它更适合开成独立档位（一条产品一条价档，见 VIDEO_PRODUCTS 上方的契约注释）。
   ⚠️ 与 480P 同一条免责：这一档**还没有真实出片记录**。按站内口径，上游拒收不扣费，
      所以失败不会误扣；首条真实 480P 账单落库后须回来校准这一行。
   ⚠️ 720p 必须留在第一位：前端切产品时按 resolutions[0] 兜底，480p 放前面会让默认档掉到 480p。 */
    resolutions: ['720p', '480p'],
    modes: ['script', 'reference', 'frame', 'remake'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 9, videos: 3, audios: 3, total: 12 },
    concurrency: 1,
    pollIntervalMs: 10000,
  },
  /* ── 9-16 下架批次（路由复核不可达，全部 public:false；老任务数据仍可读，符合「老数据必须可读」）──
     上架时只核对了「目录里有这个名字」，没有确认视频端点可达；这批路由要么未声明 openai-video，
     要么上游不认该模型名、无本站分组渠道或未定价。恢复上架的唯一路径：台账转 verified/callable。 */
  /* ═══ 2026-09-21：**下架**（用户第 22 轮原话：「视频模型有些现在下架了，你就拿走吧，
     没有了就不用显示出来了」）═══════════════════════════════════════════════════════════════
     证据（零成本、只读）：`GET https://api-new.ip233.com/v1/models` 当日返回 **115** 个模型，
     逐条比对目录里全部 13 条路由 —— 只有 `grok-imagine-video` **不在**清单里
     （其余 public 档 seedance_fast / seedance_standard / minimax-h3 / xn-wan3.0 / sd-2.5-js2 /
      xn-minimax-h3 / sd-2.0-js900 / sd-2.0-js / seedance-2.0-mini 全在）。
     与用户的口径一致 ⇒ 按 9-16 那批下架的做法处理：**public:false**（老任务/老订单仍可读，
     计费 SKU video_grok_fast_* 保留），台账转 retired。
     ⚠️ 没有做"非法时长提交"探针：那条手法在 sd-reference-image-25 上**真的建过任务**
        （见 docs/design/61 的探针安全事故），本次只用只读 /models + 用户口径两条证据。 */
  grok_fast: {
    id: 'grok_fast',
    label: 'Grok 极速',
    providerLabel: 'xAI',
    tierLabel: '极速试稿',
    family: 'grok', familyLabel: 'Grok',
    variant: 'grok-imagine', variantLabel: 'Grok 极速',
    description: '几秒出片，适合试方向、批量试稿和节奏验证。',
    limitations: '仅 720P；不支持参考视频、参考音频与首尾帧。',
    routeId: 'grok-imagine-video',
    credential: 'seedance',
    public: false,
    default: false,
    durations: { min: 5, max: 10 },
    resolutions: ['720p'],
    modes: ['script', 'reference'],
    generatedAudio: false,
    frameAudio: false,
    limits: { images: 1, videos: 0, audios: 0, total: 1 },
    concurrency: 2,
    pollIntervalMs: 8000,
  },
  wan_standard: {
    id: 'wan_standard',
    label: '通义万相 3.0',
    providerLabel: '阿里通义',
    tierLabel: '通用性价比',
    family: 'wan', familyLabel: '通义万相',
    variant: 'wan-3.0', variantLabel: '通义万相 3.0',
    /* 批 BM：这一行是**合并行**的描述（型号"通义万相 3.0"下 720P/480P 与 1080P 两条产品共用）——
       文案必须说全三档，否则下拉里写"双档"、生成设置里却有三个药丸，两边打架。 */
    description: '国产主流路线，商品与场景稳定，480P/720P/1080P 三档可选。',
    limitations: '单张参考图；480P 与 720P 双档；不支持参考视频、参考音频与首尾帧。',
    /* 2026-09-23：补 480P 档。证据 = 上游**文档站自己的价目**（new.ip233.com/docs/models 的
       数据源就是 /api/pricing，pricing_version=ip233-route-v2），其中 **xn-wan3.0 这一行**
       （路由名与本产品 routeId 逐字相同）在 default 分组下给出：
         per_second: 480p ¥0.26/秒 ｜ 720p ¥0.325/秒 ｜ 1080p ¥0.455/秒
       ⇒ 480p 是**比现有 720p 更便宜**的一档，同价提供不会让毛利变差（站内按条固定价，
          清晰度不进 SKU 也不进扣费口径），所以这一档可以直接开。
       ⚠️ 1080p 同一行也在售（¥0.455/秒），但比 720p 贵 ⇒ 同价开 1080p 是**定价决定**，
          须用户点头，本轮不动。⚠️ 本档位尚未有真实出片记录：按站内口径，
          上游拒收不扣费，故失败不会误扣；首条真实 480p 账单落库后须回来校准这一行。 */
    routeId: 'xn-wan3.0',
    credential: 'seedance',
    public: true,
    default: false,
    durations: { min: 5, max: 10 },
    /* 720p 放第一位：与 seedance_mini 同一条规矩 —— 前端切产品时按 resolutions[0] 兜底，
       480p 放前面会让默认档悄悄掉到 480p */
    resolutions: ['720p', '480p'],
    modes: ['script', 'reference'],
    generatedAudio: false,
    frameAudio: false,
    limits: { images: 1, videos: 0, audios: 0, total: 1 },
    concurrency: 2,
    pollIntervalMs: 10000,
  },
  /* ═══ 2026-09-25 批 AN：**两条 1080P 档**（用户口径：「比 720P 高一倍的积分」）═════════════════
     为什么按"家族各一条独立产品"开，而不是在原产品上加一个 '1080p'：
       · 站内 SKU 名由产品 id 派生（`video_${id}_${short|long}`），一条产品只能对一条价档；
       · 这正是既有做法 —— 2K 档就是独立产品 `minimax_h3_2k`（resolutions: ['2k']）。
     ⚠️ resolution 走的是**同一条报文通路**：两种协议都把 job.resolution 写进请求体
        （seedance 协议 baseJobFields.resolution；minimax 协议 minimaxResolutionOf），
        routeId 相同的家族连网关都不用换 —— 这就是"通道"那半边，门禁直接断言报文。
     ⚠️ 哪条能开、哪条只能先藏着，判据是**上游证据 + 余额**，逐条写在各自注释里。 */
  wan_1080p: {
    id: 'wan_1080p',
    label: '通义万相 3.0 1080P',
    providerLabel: '阿里通义',
    tierLabel: '全高清',
    family: 'wan', familyLabel: '通义万相',
    variant: 'wan-3.0', variantLabel: '通义万相 3.0',
    description: '同一条通义万相路线的高清档：1080P 全高清输出，商品与场景稳定性好。',
    /* 面向用户的限制只写"用户能做什么"（模型菜单里直接展示这一行）：
       不写我们的上游单价与余额 —— 那是内部账，用户要的是"能出多久的片子"。
       内部的余额约束与算式写在下面那段注释里（给人看代码时用）。 */
    limitations: '1080P 全高清档，当前支持 5-9 秒；单张参考图，不支持参考视频、参考音频与首尾帧。',
    /* 证据：xn-wan3.0 的文档价目表逐字给出 per_second 1080p ¥0.455/秒（与 720p ¥0.325 同一张表，
       原文记在 wan_standard 的注释里）；同一条路由现网已在出 720p/480p 的片子 ⇒ 通道已验证过，
       这一档只是把请求里的 resolution 换成 1080p。
       ⚠️ durations.max = 9（不是 10）：1080P 的上游预扣 = ¥0.455 × 秒数，10 秒 = ¥4.55 >
          当前记账余额 ¥4.2478 ⇒ 会被上游以 insufficient_user_quota 拒。宁可先给 5-9 秒，
          也不放一个"点了必失败"的 10 秒档；余额充上来后把这里改成 10 即可（一处数字）。 */
    routeId: 'xn-wan3.0',
    credential: 'seedance',
    public: true,
    default: false,
    durations: { min: 5, max: 9 },
    resolutions: ['1080p'],
    modes: ['script', 'reference'],
    generatedAudio: false,
    frameAudio: false,
    limits: { images: 1, videos: 0, audios: 0, total: 1 },
    concurrency: 2,
    pollIntervalMs: 10000,
  },
  seedance_1080p: {
    id: 'seedance_1080p',
    label: 'Seedance 2.0 1080P',
    providerLabel: '字节跳动',
    tierLabel: '全高清',
    family: 'seedance', familyLabel: 'Seedance',
    variant: 'sd-2.0', variantLabel: 'Seedance 2.0',
    description: 'Seedance 2.0 的 1080p 超清路线（中转独立模型名 seedance-2.0-1080p）。',
    limitations: '1080P 超清档（当前未开放，通道就绪后上架）。',
    /* ═══ 为什么这条是 public: false（不是"忘了开"）═════════════════════════════════════════════
       9-16 零成本实测（原文记在 billing/catalog 的 video_seedance_1080p 注释里）：这条路由
       **渠道与参数校验都过了**，只因**预扣 ¥7.67 超过中转余额**被上游拒（insufficient_user_quota）。
       ⇒ 台账状态 blocked（活着、余额不足）；产品与两条 SKU 全部 public: false ——
          现在公开它 = 用户点了必失败（铁律）。充值到 ≥ ¥7.67×并发 后，
          把这里与两条 SKU 的 public 一起翻 true 即可（价格与 SKU 都已按 2× 建好）。 */
    routeId: 'seedance-2.0-1080p',
    credential: 'seedance',
    public: false,
    default: false,
    durations: { min: 5, max: 15 },
    durationOptions: [5, 10, 15],
    resolutions: ['1080p'],
    modes: ['script', 'reference'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 9, videos: 0, audios: 0, total: 9 },
    concurrency: 2,
    pollIntervalMs: 10000,
  },
  kling_standard: {
    id: 'kling_standard',
    label: '可灵 3.0',
    providerLabel: '快手可灵',
    tierLabel: '主流第三方',
    family: 'kling', familyLabel: '可灵',
    variant: 'kling-3.0', variantLabel: '可灵 3.0',
    description: '人物动作与镜头运动自然，适合剧情与口播。',
    limitations: '仅 720P；不支持参考视频、参考音频与首尾帧。',
    routeId: 'kling-3.0',
    credential: 'seedance',
    /* ═══ 2026-09-23 批 AC：**恢复上架**（09-21 曾按"上游没有这个模型"下架）═══════════════════
       下架依据（09-21）：台账 state: retired（提交回 not a public model name）。
       本轮实测推翻了它：探针回 400 invalid_duration ⇒ 名字可解析、渠道活着。
       ⇒ 照本项目"恢复上架"的既有做法（批 J-⑫ / K-B 都做过）：台账转 callable、产品 public:true。
       ⚠️ 用户价**分文未动**：video_kling_standard_* 的 SKU 与 units 一个字没改
          （文档价 ¥1.82/条与它记账一致），这不是新增收费项，是把既有档位重新可见。 */
    public: true,
    default: false,
    durations: { min: 5, max: 10 },
    resolutions: ['720p'],
    modes: ['script', 'reference'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 2, videos: 0, audios: 0, total: 2 },
    concurrency: 1,
    pollIntervalMs: 10000,
  },
  kling_pro: {
    id: 'kling_pro',
    label: '可灵 3.0 Pro',
    providerLabel: '快手可灵',
    tierLabel: '第三方精制',
    family: 'kling', familyLabel: '可灵',
    variant: 'kling-3.0-pro', variantLabel: '可灵 3.0 Pro',
    description: '可灵高质量档，细节与一致性更好，适合品牌片与人物口播。',
    limitations: '仅 720P；不支持参考视频与参考音频。',
    routeId: 'kling-3.0-pro',
    credential: 'seedance',
    /* 2026-09-23 批 AC：同 kling_standard —— 探针回 invalid_duration ⇒ 渠道活着，恢复上架；
       用户价分文未动（video_kling_pro_* 的 SKU 与 units 未改）。 */
    public: true,
    default: false,
    durations: { min: 5, max: 10 },
    resolutions: ['720p'],
    modes: ['script', 'reference'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 2, videos: 0, audios: 0, total: 2 },
    concurrency: 1,
    pollIntervalMs: 10000,
  },
  veo_fast: {
    id: 'veo_fast',
    label: 'Veo 3.1 Fast',
    providerLabel: 'Google',
    tierLabel: '国际路线',
    family: 'veo', familyLabel: 'Veo',
    variant: 'veo-3.1-fast', variantLabel: 'Veo 3.1 Fast',
    description: 'Google Veo 快速档，物理运动与真实感强，适合写实场景与产品演示。',
    limitations: '单张参考图；仅 720P；不支持参考视频、参考音频与首尾帧。',
    routeId: 'veo-3.1-fast',
    credential: 'seedance',
    public: false,
    default: false,
    durations: { min: 5, max: 8 },
    resolutions: ['720p'],
    modes: ['script', 'reference'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 1, videos: 0, audios: 0, total: 1 },
    concurrency: 1,
    pollIntervalMs: 10000,
  },
  /* ═══ 2026-09-19 批 K-B：**恢复上架**（用户批注「把之前的那些模型找回来呀」）═══════════
     原路由 xn-seedance-2.5（¥1.872/秒，5 秒 ¥9.36）被中转余额挡死，属于"充值才能解"；
     本轮在**同族按条版**里找到更便宜且今天实测活着的 sd-2.5-js2（¥3.38/条，4-30 秒，
     10 图/10 视频/10 音频）。成本降 33%，**用户价分文未动**（¥11.01 / 43000 units）。
     时长区间 4-30 秒是上游报文自己报出来的（见 ROUTE_REACHABILITY 的 evidence），不是猜的。 */
  seedance_25: {
    id: 'seedance_25',
    label: 'Seedance 2.5',
    providerLabel: '字节跳动',
    tierLabel: '画质升级',
    family: 'seedance', familyLabel: 'Seedance',
    variant: 'sd-2.5', variantLabel: 'Seedance 2.5',
    description: '新一代画质与一致性，细节和材质表现更好，适合品牌主推片。',
    limitations: '仅 720P；参考视频与参考音频各最多 10 个；生成时间更长，高峰期排队更久。',
    routeId: 'sd-2.5-js2',
    credential: 'seedance',
    public: true,
    default: false,
    durations: { min: 5, max: 30 },
    durationOptions: [5, 10, 15],
    resolutions: ['720p'],
    modes: ['script', 'reference'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 10, videos: 10, audios: 10, total: 30 },
    concurrency: 1,
    pollIntervalMs: 12000,
  },
  /* ═══ 2026-09-19 批 K-B：**恢复上架** ═══════════════════════════════════════════════
     两条 2K 级路由今天都实测到了：
       · minimax-h3-per-request（¥7.41/条）→ 预扣 ¥7.41 > 余额 ¥5.11，**仍 blocked**；
       · minimax-h3-2k（¥5.85/条）→ 预扣 ¥5.85 > 余额 ¥5.11，**仍 blocked**；
       · xn-minimax-h3（¥3.64/条，4-15 秒，480p/720p/1440p，30 图/30 视频/30 音频）→ 活着且余额够。
     于是改接 xn-minimax-h3：**用户价分文未动**（¥16.9 / 65000 units），成本从 ¥5.85 降到 ¥3.64。
     ⚠️ 输出档位是 1440p（中转 minimax 主路由的分档是 720p/1440p/2160p，没有 '2K' 这个写法），
       报文里由 videoProviders 的 MINIMAX_RESOLUTION 把 '2k' 映射成 '1440p'。 */
  minimax_h3_2k: {
    id: 'minimax_h3_2k',
    label: 'MiniMax H3 2K',
    providerLabel: 'MiniMax',
    tierLabel: '2K 精制',
    family: 'minimax', familyLabel: 'MiniMax',
    /* ═══ 2026-09-25 批 BO：**2K 是独立模型行，不并进 MiniMax H3**（用户指示，逐字）═══════════
       用户原话：「如果这个 2k 真的只有迷你麦克斯有的话，那你还不如**直接在模型里面加个 Mini max 2k
       的版本**。」——这条与"通义万相 1080P 并进 3.0"并不矛盾，两者由同一条判据决定：
         · 通义万相的 1080p 与 720p **同路由**（xn-wan3.0，上游说明明文 480p/720p/1080p）⇒ 是参数；
         · MiniMax 的 2K 走**另一条路由**（xn-minimax-h3），且参考素材额度不同（30/30/30 vs 9/3/3）
           ⇒ 是**另一档供给**，用户选它等于选另一个版本 ⇒ 独立成行。
       判据：**同路由的档位 = 参数（进清晰度）；不同路由的档位 = 另一个模型（进模型行）**。 */
    variant: 'minimax-h3-2k', variantLabel: 'MiniMax H3 2K',
    description: '支持 1440P 精制输出、多模态参考与首尾帧，适合高质量短片与品牌主推片。',
    limitations: '按条计费；输出 1440P；参考图/视频/音频各最多 30 个；生成时间更长。',
    routeId: 'xn-minimax-h3',
    credential: 'minimax',
    public: true,
    default: false,
    durations: { min: 5, max: 15 },
    durationOptions: [5, 10, 15],
    resolutions: ['2k'],
    modes: ['script', 'reference', 'frame', 'remake'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 30, videos: 30, audios: 30, total: 90 },
    concurrency: 1,
    pollIntervalMs: 10000,
  },
  /* ═══ 2026-09-19 批 K-B 新增三档：都是今天实测「模型名能走到参数校验」的活路由 ═══════════
     定价沿用站内既有规则（成本/(1−54%) 取整到分，units = 现金价 × 3819 向上取整，
     引流带 floor 40%）——**没有新造规则，也没有动任何老价格**。 */
  sd_js900: {
    id: 'sd_js900',
    label: 'Seedance 2.0 轻量 720P',
    providerLabel: '字节跳动',
    tierLabel: '轻量按条',
    family: 'seedance', familyLabel: 'Seedance',
    variant: 'sd-2.0-js900', variantLabel: 'Seedance 2.0 轻量',
    description: '按条计费的轻量通道，固定 720P，出片稳定，适合批量试稿与日常更新。',
    limitations: '按条计费；仅支持 9 张参考图，不支持参考视频与参考音频。',
    routeId: 'sd-2.0-js900',
    credential: 'seedance',
    public: true,
    default: false,
    durations: { min: 5, max: 15 },
    durationOptions: [5, 10, 15],
    resolutions: ['720p'],
    modes: ['script', 'reference'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 9, videos: 0, audios: 0, total: 9 },
    concurrency: 2,
    pollIntervalMs: 10000,
  },
  sd_js: {
    id: 'sd_js',
    label: 'Seedance 2.0 满参数 720P',
    providerLabel: '字节跳动',
    tierLabel: '多模态按条',
    family: 'seedance', familyLabel: 'Seedance',
    variant: 'sd-2.0-js', variantLabel: 'Seedance 2.0 满参数',
    description: '固定 720P 的满参数按条通道，参考图、参考视频、参考音频都能带，适合复杂镜头。',
    limitations: '按条计费；仅 720P；参考图最多 9 张、参考视频与参考音频各最多 3 个。',
    routeId: 'sd-2.0-js',
    credential: 'seedance',
    public: true,
    default: false,
    durations: { min: 5, max: 15 },
    durationOptions: [5, 10, 15],
    resolutions: ['720p'],
    modes: ['script', 'reference'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 9, videos: 3, audios: 3, total: 15 },
    concurrency: 2,
    pollIntervalMs: 10000,
  },
  seedance_mini: {
    id: 'seedance_mini',
    label: 'Seedance 2.0 Mini',
    providerLabel: '字节跳动',
    tierLabel: '轻量多模态',
    family: 'seedance', familyLabel: 'Seedance',
    variant: 'sd-2.0-mini', variantLabel: 'Seedance 2.0 Mini',
    description: '轻量版多模态通道，文生/图生/多模态/首尾帧都能做，480P 与 720P 双档可选。',
    limitations: '按条计费；输出最高 720P；首尾帧模式不支持生成声音。',
    routeId: 'seedance-2.0-mini',
    credential: 'seedance',
    public: true,
    default: false,
    durations: { min: 5, max: 15 },
    durationOptions: [5, 10, 15],
    /* 720p 放第一位：前端切产品时按 resolutions[0] 兜底，480p 放前面会让默认档掉到 480p */
    resolutions: ['720p', '480p'],
    modes: ['script', 'reference', 'frame', 'remake'],
    generatedAudio: true,
    frameAudio: false,
    limits: { images: 9, videos: 3, audios: 3, total: 15 },
    concurrency: 2,
    pollIntervalMs: 10000,
  },
  /* ═══ 2026-09-25 批 AM：**本地方案的两条产品**（流程的最后一步接线）═══════════════════════════
     用户口径（两轮前那句方向性纠正，也是 docs/design/69 的立论）：
       「难道你没有什么比如 github 上的一些开源项目可以实现吗，**为什么一切都要追究模型呢**，
       你确定这是最佳的路径吗」「全部做完」
     ⇒ 「视频高清」「视频字幕去除」不是两条上游模型，而是两个**方案**：
         · upscale_local   = 上传视频 → 本机 ffmpeg scale（+fps）→ 交付（0.50 积分/条）
         · desubtitle_local = 上传视频 →（手动框选字幕区域）→ 本机 ffmpeg delogo → 交付（0.04 积分/秒）

     ⚠️ 三条设计约束（都不是随手写的）：
       ① `localEngine: true` —— 作业流水线**按这个标记**选本地适配器（videoGeneration.providerForJob）；
          SKU 名由 `video_${id}_${short|long}` 派生，所以 id 必须正好是 `upscale_local` /
          `desubtitle_local`，才能对上 billing/catalog 里那四条已批准的收费项（价格一分未动）。
       ② **不进模型选择器**：publicVideoProducts() 会跳过 localEngine 产品（它们不是模型，
          用户从各自的 skill 子页面进入，那两页本来就没有模型格 —— 照知渔）。
          报价走 localVideoProducts()，给子页面用。
       ③ `modes: ['local']` —— 本地方案不接受"文生视频/参考素材"那套模式：
          它要吃的是**一条源视频 + 规格/区域**，不是提示词。所以 createJob 里对 localEngine
          走 validateLocalPlanInput 那一条校验（提示词/比例/方案闸门都不适用）。
     ⚠️ `durations: { min: 1, max: 300 }` = 源视频秒数（不是"要生成几秒"）：上限 300 与
        localVideoPlan.MAX_DURATION_SECONDS 同源；短/长档仍按 ≤8 秒分界（两条 L 档同价，
        去字幕那一档按秒计费 —— 见 billing/catalog 的 billableQuantity）。 */
  upscale_local: {
    id: 'upscale_local',
    label: '视频高清',
    providerLabel: '本机渲染',
    tierLabel: '本地处理',
    description: '提升视频清晰度与画面质量。',
    limitations: '按本机重采样提升分辨率与帧率（近似超分），不做 AI 细节重建；按条计费。',
    routeId: 'local-ffmpeg',
    credential: 'local',
    localEngine: true,
    public: true,
    default: false,
    durations: { min: 1, max: 300 },
    resolutions: ['720p', '1080p', '2k'],
    modes: ['local'],
    /* 本地方案自己的规格声明（用户字段只有这两格，照知渔「视频设置」那一块） */
    localSpec: { resolution: true, fps: true, regions: false },
    generatedAudio: false,
    frameAudio: false,
    limits: { images: 0, videos: 1, audios: 0, total: 1 },
    concurrency: 2,
    /* 本地渲染是同步的（submit 返回即成片），这个值只为满足既有契约的字段形状 */
    pollIntervalMs: 1000,
  },
  desubtitle_local: {
    id: 'desubtitle_local',
    label: '视频字幕去除',
    providerLabel: '本机渲染',
    tierLabel: '本地处理',
    description: '上传视频，去除画面中的字幕。',
    limitations: '当前支持手动框选字幕区域（本机 delogo 区域擦除）；自动识别待接通；按秒计费。',
    routeId: 'local-ffmpeg',
    credential: 'local',
    localEngine: true,
    public: true,
    default: false,
    durations: { min: 1, max: 300 },
    /* 去字幕不改分辨率（原样交付），所以这一格**没有**可选档位；留空数组让"没有这一格"可断言 */
    resolutions: [],
    modes: ['local'],
    localSpec: { resolution: false, fps: false, regions: true },
    generatedAudio: false,
    frameAudio: false,
    limits: { images: 0, videos: 1, audios: 0, total: 1 },
    concurrency: 2,
    pollIntervalMs: 1000,
  },
  /* ═══ 2026-09-26 批 AR：**自动标记**（火山 AI MediaKit 字幕擦除）═════════════════════════════════
     与 `desubtitle_local` 是**同一件事的两条实现**（用户口径：「自动标记卖多少就按你说的来吧」）：
       · desubtitle_local —— 手动框选区域 → 本机 ffmpeg delogo（0.04 积分/秒，成本 0）
       · desubtitle_volc  —— 自动检测 → 火山 MediaKit 擦除（0.05 积分/秒，成本 0.4 元/分钟）
     为什么是**两个产品**而不是一个产品里加个开关：站内 SKU 名由产品 id 派生（`video_${id}_${short|long}`），
     两条路成本不同、价也不同，只能各自一条档（与 1080P、2K 档"一族一条产品"同一做法）。

     ⚠️ `videoProcess: true` = **"处理已有视频"这一类产品**的声明（本次新引入的类别）：
        输入契约与本地方案一样（**一条源视频 + 时长**，没有提示词、没有比例、不要拍摄方案），
        区别只在**在哪儿执行**（localEngine → 本机；credential 'volc' → 火山）。
        createJob 按这个标记走 processProduct 那条校验；派发时再按 localEngine / credential 分流。
     ⚠️ `localSpec: { auto: true }` —— 这一档**没有用户要填的规格**：自动检测由上游完成
        （官方边界：字幕须在画面下方 50% 以内且横向偏中央、文字高占画面 1%~10%、白色、仅中英文）。
     ✅ 2026-09-26 翻 public：**真机实测跑通一次**（6 秒片 → completed、拿到成片地址、扣费约 0.04 元），
        台账同步转 callable —— 按铁律这就是"能出片"的证据。 */
  desubtitle_volc: {
    id: 'desubtitle_volc',
    label: '视频字幕去除 · 自动',
    providerLabel: '火山引擎',
    tierLabel: '智能去字幕',
    description: '上传视频，自动识别并去除画面中的字幕（火山 AI MediaKit 字幕擦除）。',
    limitations: '自动识别只认画面下方 50% 以内、横向偏中央、白色、中英文的字幕；按秒计费。',
    routeId: 'volc-media-kit-subtitle',
    credential: 'volc',
    videoProcess: true,
    public: true,
    default: false,
    durations: { min: 1, max: 300 },
    resolutions: [],
    modes: ['process'],
    localSpec: { resolution: false, fps: false, regions: false, auto: true },
    generatedAudio: false,
    frameAudio: false,
    limits: { images: 0, videos: 1, audios: 0, total: 1 },
    concurrency: 2,
    pollIntervalMs: 5000,
  },
  /* ═══ 2026-09-27 批 DC-4：**「做成动图」**（静图 → 上游图生视频最短档 → 本地裁到 2~3 秒）═══════
     用户口径（逐字）：「**动图选 A 吧**」（工作台里对已生成的那张给一颗「做成动图」：静图 →
     2~3 秒循环短片、可下载、电脑端可直接传）+「即便是在服务端做，**你也要收费呀**……而且你确定
     你的方案没有成本吗，**你这个不是用到图生视频吗**」。
     ⇒ 这是一条**真的走上游图生视频**的产品（不是本机微动效那条免费路，那条在小红书图文页
        「让它动」），所以它有独立价档（video_live_photo_short，面价 ¥3.90 / 成本 ¥0.91）。

     为什么把它登记成**产品**而不是在页面里直连上游：
       · 路由、时长白名单、参考素材上限、清晰度都只能有一处声明 —— 就是这里；
       · SKU 名由产品 id 派生（`video_${id}_${short|long}`）⇒ 有了这条产品，账上才会出现
         `video_live_photo_short`，与既有 20 多条视频档同一套派生规则，不新造命名法。
     为什么**不走**方案闸门（见 videoGeneration.createJob 里的分支）：闸门存在的理由是
       "方案是收了钱的、收了钱就必须影响产出"，而这一档**不收方案费**（用户给的是**一张成品图**，
       他手上没有可确认的拍摄方案），与"处理已有视频"那两条同一档待遇。

     `stillToMotion: true` 的含义（见 isNonModelProduct）：**它不是用户在「视频创作」里选的模型**，
     入口只有概念视觉方案结果区那一颗按钮 —— 进了模型下拉，用户会选到一条"点了其实是在给旧图做动图"
     的档位（同 localEngine / videoProcess 那条纪律）。 */
  live_photo: {
    id: 'live_photo',
    label: '做成动图',
    providerLabel: '字节跳动',
    tierLabel: '静图微动',
    family: 'seedance', familyLabel: 'Seedance',
    variant: 'sd-2.0-fast', variantLabel: 'Seedance 2.0 Fast',
    description: '把一张成品图做成 2~3 秒的循环短片，可直接发小红书。',
    limitations: '按次计费；成片 2~3 秒、原图比例；只吃一张成品图，不支持提示词与其它素材。',
    /* 与 seedance_fast **同一条已真实出片验证过的通道**（台账 verified，2026-09-16 出片证据）。
       同一条通道意味着：同一个 model 名、同一份报文（seedance 协议）、同一把凭证 ——
       "不要新造第二条上游通道"这条纪律就是靠这里只写一个 routeId 落地的。 */
    routeId: 'agv-seedance2.0fast',
    credential: 'seedance',
    stillToMotion: true,
    public: true,
    default: false,
    /* 上游**按秒档位校验**，这一条通道只认 5/10/15 秒 ⇒ 我们按最短档 5 秒买，
       交付前在本地裁到 2~3 秒（成本只在 5 秒那一档，裁切是本机 ffmpeg，不额外花钱）。 */
    durations: { min: 5, max: 5 },
    durationOptions: [5],
    resolutions: ['720p'],
    modes: ['reference'],
    generatedAudio: false,
    frameAudio: false,
    limits: { images: 1, videos: 0, audios: 0, total: 1 },
    concurrency: 2,
    pollIntervalMs: 10000,
  },
  /* ═══ 2026-09-26 批 AU：**数字人（火山口型对齐）**═════════════════════════════════════════════
     与 `desubtitle_volc` 同一类（`videoProcess: true` + `credential: 'volc'`），但输入契约**多一样**：
     它要 **一条真人视频 + 一段驱动音频**（`localSpec: { audio: true }` ⇒ createJob 多校验一个音频）。
     为什么音频是硬要求而不是可选：口型对齐的产出长度由**音频**决定，没有音频这条链路无事可做 ——
     放成"有就传、没有也能点"会让用户点了才失败（铁律：不可用的功能不许变成选项）。

     ⚠️ 时长口径：这一档的 `durations` 是**音频时长**（1 秒 ~ 30 分钟，照官方上限），
        与源视频时长无关；计费按秒（见 SKU video_lipsync_volc_*）。
        官方限制"仅支持单人真人出镜视频"，超出这个前提上游会失败 —— 写在 limitations 里，
        用户在建单前就能看到，而不是失败之后才知道。
     ⚠️ **public 的三次变化，每一次都是事实变了**：
        ① 批 AU 起步 public:false —— 一次真调用都没跑过 + 价未经签字；
        ② 批 AX 两条都清了（真机跑通：任务 amk-tool-lip-sync-1401540081154，成片 7.28 秒，
           成本约 ¥0.12，抽帧确认嘴型跟随；价由用户确认：「数字人价格我不清楚，你调研过知渔
           他们收多少钱吗，**你利润这块觉得还可以就行**」）—— 但**创作台还没接线**，仍 false；
        ③ 批 AZ（本批）把创作台接完 ⇒ **public: true**。接线内容（全在 VideoStudio 的
           process 产品分支上）：音频槽位的时长探针、报价数量取**音频秒数**、生成闸门按
           `capabilities.digitalHuman.available` 放开、按钮上的价目说明从目录派生。
        ⇒ 这一页现在与「视频高清 / 视频字幕去除」走**同一条**分支（processPlan），
          不会再落到"上游生成"那条默认分支上（那条会拿默认模型出一段普通视频并照常扣费）。 */
  lipsync_volc: {
    id: 'lipsync_volc',
    label: '数字人 · 口型对齐',
    providerLabel: '火山引擎',
    tierLabel: '口型对齐',
    description: '上传一段真人出镜视频与一段配音，让人物按配音开口说这段话。',
    limitations: '只支持单人真人出镜的 MP4 视频（正脸、水平转动不超过 45 度）；配音支持 mp3/wav/m4a 等；按配音时长计费；上游平均耗时约是配音时长的 6~8 倍。',
    routeId: 'volc-media-kit-lipsync',
    credential: 'volc',
    videoProcess: true,
    public: true,
    default: false,
    durations: { min: 1, max: 1800 },
    resolutions: [],
    modes: ['process'],
    localSpec: { resolution: false, fps: false, regions: false, auto: true, audio: true },
    generatedAudio: false,
    frameAudio: false,
    limits: { images: 0, videos: 1, audios: 1, total: 2 },
    concurrency: 2,
    pollIntervalMs: 5000,
  },
});

function productId(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!Object.hasOwn(VIDEO_PRODUCTS, normalized)) throw new Error(`未知视频产品: ${normalized || 'empty'}`);
  return normalized;
}

export function getVideoProduct(value) {
  return VIDEO_PRODUCTS[productId(value)];
}

export function videoFeatureSku({ productId: requestedProductId, duration } = {}) {
  const product = getVideoProduct(requestedProductId);
  const seconds = Number(duration);
  if (!Number.isInteger(seconds) || !durationAllowed(product, seconds)) {
    throw new Error(durationErrorMessage(product));
  }
  return `video_${product.id}_${seconds <= 8 ? 'short' : 'long'}`;
}

export function validateVideoProductInput({
  productId: requestedProductId,
  duration,
  mode,
  resolution,
  generateAudio = true,
} = {}) {
  const product = getVideoProduct(requestedProductId);
  const seconds = Number(duration);
  if (!Number.isInteger(seconds) || !durationAllowed(product, seconds)) {
    throw new Error(durationErrorMessage(product));
  }
  const normalizedMode = typeof mode === 'string' ? mode.trim().toLowerCase() : '';
  if (!product.modes.includes(normalizedMode)) throw new Error(`视频产品不支持该创作模式: ${normalizedMode || 'empty'}`);
  const normalizedResolution = typeof resolution === 'string' ? resolution.trim().toLowerCase() : '';
  if (!product.resolutions.includes(normalizedResolution)) {
    throw new Error(`视频产品不支持该清晰度: ${normalizedResolution || 'empty'}`);
  }
  if (typeof generateAudio !== 'boolean') throw new TypeError('generateAudio must be boolean');
  if (normalizedMode === 'frame' && generateAudio && product.frameAudio === false) {
    throw new Error('该产品的首尾帧模式暂不支持生成声音');
  }
  return {
    productId: product.id,
    duration: seconds,
    mode: normalizedMode,
    resolution: normalizedResolution,
    generateAudio,
  };
}

function publicQuote(sku) {
  const quote = quoteFeature(sku, 1);
  return { sku, units: quote.totalUnits, points: Math.ceil(quote.totalUnits / 1000) };
}

/* ═══ 本地方案（localEngine）**不进模型选择器**（2026-09-25 批 AM）═════════════════════════════
   判据只有一条：它不是模型，是方案（docs/design/69）。
     · 「视频高清」「视频字幕去除」的用户入口是各自的 skill 子页面（那两页没有模型格，照知渔）；
       把它们塞进模型下拉，用户会在"视频创作"里选到一条**不吃提示词**的档位 —— 点了必失败。
     · 它们的报价与规格走 localVideoProducts()，形状与模型清单分开，前端按需取。
   ⚠️ 这不是"藏起来"：产品本身 public: true（可建单、SKU 可报价），只是不出现在**模型**清单里。 */
export function isLocalEngineProduct(product) {
  return product?.localEngine === true;
}

/* ═══ 2026-09-26 批 AR：**"不是模型"的产品**（不进模型选择器）══════════════════════════════════
   · localEngine   —— 本机渲染（视频高清 / 手动去字幕）
   · videoProcess  —— 处理已有视频的上游档（火山自动去字幕 / 数字人）
   · stillToMotion —— 静图做成动图（概念视觉方案结果区那颗按钮，2026-09-27 批 DC-4）
   共同点：都**不吃用户在「视频创作」里写的那套输入**（提示词 / 比例 / 素材位），
   入口是各自的页面或按钮。放进模型下拉＝用户会在「视频创作」里选到一条点了必失败（或者
   拿着他的提示词去干一件完全不相干的事）的档位。 */
export function isNonModelProduct(product) {
  return product?.localEngine === true || product?.videoProcess === true || product?.stillToMotion === true;
}

/* 「做成动图」那一档的判据（产品声明只有一处：VIDEO_PRODUCTS.live_photo）。
   ⚠️ 单独一个函数而不是各处 `product.stillToMotion === true`：建单分流、交付裁切、门禁
     都要用它，散着写迟早会出现"少改一处 → 某条链路当成普通视频任务处理"。 */
export function isStillMotionProduct(product) {
  return product?.stillToMotion === true;
}

/* 「做成动图」的产品 id（只读常量，给服务端模块与门禁引用；页面不写第二份名单） */
export const STILL_MOTION_PRODUCT_ID = 'live_photo';

export function publicVideoProducts({ includeHidden = false } = {}) {
  return Object.values(VIDEO_PRODUCTS)
    .filter(product => product.public === true || includeHidden)
    .filter(product => !isNonModelProduct(product))
    .map(product => ({
      id: product.id,
      label: product.label,
      providerLabel: product.providerLabel,
      tierLabel: product.tierLabel,
      /* 批 BM：分组与型号合并靠这四个字段（前端 buildVideoModelRows 消费，见该函数注释） */
      family: product.family,
      familyLabel: product.familyLabel,
      variant: product.variant,
      variantLabel: product.variantLabel,
      description: product.description,
      limitations: product.limitations,
      public: true,
      default: product.default === true,
      durations: { ...product.durations },
      /* 上游按秒档位校验，白名单必须透传到前端，否则用户会选到上游拒收的秒数 */
      durationOptions: Array.isArray(product.durationOptions) ? [...product.durationOptions] : null,
      resolutions: [...product.resolutions],
      modes: [...product.modes],
      generatedAudio: product.generatedAudio,
      frameAudio: product.frameAudio,
      limits: { ...product.limits },
      quotes: {
        /* 长档报价取白名单里第一个 >8 秒的合法档位(没有白名单时沿用 9 秒上限口径)，
           避免报出一个上游根本不接受的时长。 */
        short: publicQuote(videoFeatureSku({ productId: product.id, duration: product.durations.min })),
        long: publicQuote(videoFeatureSku({ productId: product.id, duration: longQuoteSeconds(product) })),
      },
    }));
}

/* ═══ 本地方案的**只读**清单（给两条 skill 子页面用）══════════════════════════════════════════
   形状与模型清单（publicVideoProducts）分开：模型清单进"模型选择器"，这份进 skill 子页面。
   每一项都带**页面要用的三样事实**：
     · quotes        —— 价格从目录来（不许在页面里写死"0.50 积分"）；
     · billingQuantity —— 计费数量规则（'clip' = 一条一次 / 'seconds' = 按秒 ×数量，见 billableQuantity）；
     · localSpec     —— 这一页暴露哪几格（分辨率 / 帧率 / 区域）。
   ⚠️ 报的价是**单价**：按秒那一档的 quotes.short.units 是「每单位（每秒）的 units」，
      页面自己乘秒数（乘完再向上取整到积分显示），乘错了不会报错、只会少收/多收 ——
      所以 test/video-local-dispatch-0925 会逐值比对它与 billing/catalog 的 billableQuantity。 */
export function localVideoProducts({ includeHidden = false } = {}) {
  return Object.values(VIDEO_PRODUCTS)
    .filter(isLocalEngineProduct)
    .filter(product => product.public === true || includeHidden)
    .map(product => {
      const skuShort = videoFeatureSku({ productId: product.id, duration: product.durations.min });
      const skuLong = videoFeatureSku({ productId: product.id, duration: longQuoteSeconds(product) });
      const shortQuote = quoteFeature(skuShort, 1);
      const longQuote = quoteFeature(skuLong, 1);
      /* 计费数量规则由 SKU 的 perSecond 标记派生（billing/catalog 的 billableQuantity 是它的执行者）：
         'seconds' ⇒ 页面按"秒数 × 单价"报价；'clip' ⇒ 一条一次。
         ⚠️ 2026-10-04：**平价规则也必须发下去**（`flatUnits` / `flatMaxSeconds`）。
            去字幕「智能擦除」是"≤60 秒一律 3 积分/次，超了才按秒"，页面要显示固定价就得知道封顶在哪 ——
            页面上自己写一个 60 就是"目录之外还有第二份真相"，而扣费在服务端，两边漂移就是看���便宜、扣得贵。 */
      const quantityOf = sku => (FEATURE_SKUS[sku]?.perSecond === true ? 'seconds' : 'clip');
      const flatOf = sku => ({
        flatUnits: Number.isSafeInteger(FEATURE_SKUS[sku]?.flatUnits) ? FEATURE_SKUS[sku].flatUnits : null,
        flatMaxSeconds: Number.isFinite(FEATURE_SKUS[sku]?.flatMaxSeconds) ? FEATURE_SKUS[sku].flatMaxSeconds : null,
      });
      return {
        id: product.id,
        label: product.label,
        description: product.description,
        limitations: product.limitations,
        public: true,
        durations: { ...product.durations },
        resolutions: [...product.resolutions],
        modes: [...product.modes],
        localSpec: { ...product.localSpec },
        billingQuantity: quantityOf(skuShort),
        flatMaxSeconds: flatOf(skuShort).flatMaxSeconds,
        quotes: {
          short: { sku: skuShort, units: shortQuote.units, points: Math.ceil(shortQuote.units / 1000), perSecond: quantityOf(skuShort) === 'seconds', ...flatOf(skuShort) },
          long: { sku: skuLong, units: longQuote.units, points: Math.ceil(longQuote.units / 1000), perSecond: quantityOf(skuLong) === 'seconds', ...flatOf(skuLong) },
        },
      };
    });
}

/* ═══ 未上架模型清单（只读，给界面一句实话用）══════════════════════════════════════════
   2026-09-19 批 H-7。为什么需要它：用户问「我们之前明明做了特别多的模型啊，起码有差不多 10 个，
   为什么现在都不见了呢？」—— 目录里**确实有 10 个**，但只有 2 个 public:true，
   另外 8 个被上游可达性 / 中转余额挡住，而界面上**一个字都没说**，于是看起来像"被删了"。
   ⚠️ 这份清单**只能用来显示**，绝不允许拿它生成 / 路由 / 计费：
      id / label / tierLabel / reason 四项都是只读的展示字段，没有任何可提交的字段。
      "能选"与"只是告诉你它在接通"是两件事，混在一起就是"用户选了会失败"的老问题。
   ⚠️ reason 按**路由台账状态**给（ROUTE_REACHABILITY），不是手写的安慰话：
      unreachable 上游不认 / blocked 余额不足 / unverified 报文待确认。 */
const UNAVAILABLE_REASON = Object.freeze({
  unreachable: "上游暂未开放该模型",
  retired: "上游已下架该模型",
  blocked: "中转账户余额不足",
  unverified: "上游报文口径确认中",
});

export function unavailableVideoProducts() {
  return Object.values(VIDEO_PRODUCTS)
    .filter(product => product.public !== true)
    .map(product => {
      const state = ROUTE_REACHABILITY[product.routeId]?.state || "unverified";
      return {
        id: product.id,
        label: product.label,
        tierLabel: product.tierLabel || "",
        routeState: state,
        reason: UNAVAILABLE_REASON[state] || UNAVAILABLE_REASON.unverified,
      };
    });
}
