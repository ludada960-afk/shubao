const CONTRIBUTION_MARGIN_GATE = 0.70;

// ── 分层毛利门禁（2026-08-26 调价提案 D 节，随「视频按量终案」落地）──
// - 引流档 traffic：地板 40%（规划带 40–55%，配绝对成本上限 + 频控防止被白嫖成免费接口）。
// - 主力档 core：地板 60%（收入主体，须内化视频失败重试损耗与上游 ±30% 波动）。
// - 高端稀缺档 premium：地板 70%（专业交付价格刚性强，稀缺产能贡献溢价与涨价缓冲垫）。
// 执行位从"仅测试层"提升为双保险：
//   1) assertCatalogMarginGates() 由服务端启动序列调用，违规即拒绝启动（fail closed）；
//   2) catalogMarginGateAlerts() 经 buildUnitEconomicsCatalog() 输出 admin 告警字段。
export const MARGIN_BANDS = Object.freeze({
  traffic: Object.freeze({ key: 'traffic', label: '引流档', floor: 0.40 }),
  core: Object.freeze({ key: 'core', label: '主力档', floor: 0.60 }),
  premium: Object.freeze({ key: 'premium', label: '高端稀缺档', floor: 0.70 }),
});
const TRAFFIC_PLANNED_CEILING = 0.55;        // 引流档规划上限；超出只告警不阻断（更健康无需惩罚）
const TEASER_ABSOLUTE_COST_CAP_CNY = 6;      // 补贴快试档的绝对成本上限（提案 D 防刷量条款）

function freezeCatalog(entries) {
  return Object.freeze(Object.fromEntries(
    Object.entries(entries).map(([sku, item]) => [sku, Object.freeze(item)]),
  ));
}

export const PRODUCTS = freezeCatalog({
  ec_trial_990: { sku: 'ec_trial_990', priceFen: 990, currency: 'ec_points', grantUnits: 30000, validityDays: null },
  ec_starter_29: { sku: 'ec_starter_29', priceFen: 2900, currency: 'ec_points', grantUnits: 105000, validityDays: null },
  ec_growth_79: { sku: 'ec_growth_79', priceFen: 7900, currency: 'ec_points', grantUnits: 295000, validityDays: null },
  ec_studio_199: { sku: 'ec_studio_199', priceFen: 19900, currency: 'ec_points', grantUnits: 760000, validityDays: null },
  // ── 预付月卡礼包（2026-08-26 终案新增）：一次性买断积分+赠分，无自动续订 ──
  // 基础分按最优惠面值锚（工作室包 ¥199/760000units ≈ ¥0.2618/积分）向上取整：¥39→150 分、¥59→230 分。
  // 赠分按毛利≥60% 反推：混合核销成本假设 ¥0.08/积分（图片类 ¥0.038–0.06/分 与视频类 ¥0.087–0.19/分
  // 按 7:3 保守混合），m = 1 − 3%支付费 − 总积分×0.08/售价 ≥ 60%
  //   ⇒ 总分上限 ¥39→180 分、¥59→273 分；实际取 175 分（赠 25，m=61.2%）/ 270 分（赠 40，m=60.4%）。
  // 极端情形（全部核销最贵快试视频 ¥0.262/分）会击穿 60%，属既有积分包共性的尾部风险，
  // 依赖快试每日 3 次频控与 admin 用量监控兜底，不在礼包定价内重复计提。
  ec_monthpack_39: {
    sku: 'ec_monthpack_39', priceFen: 3900, currency: 'ec_points',
    grantUnits: 175000, baseUnits: 150000, giftUnits: 25000, validityDays: 30,
  },
  ec_monthpack_59: {
    sku: 'ec_monthpack_59', priceFen: 5900, currency: 'ec_points',
    grantUnits: 270000, baseUnits: 230000, giftUnits: 40000, validityDays: 30,
  },
  xhs_entry_19: { sku: 'xhs_entry_19', priceFen: 1900, currency: 'content_sets', grantUnits: 3, validityDays: 30, regenPerWork: 5 },
  xhs_growth_49: { sku: 'xhs_growth_49', priceFen: 4900, currency: 'content_sets', grantUnits: 10, validityDays: 30, regenPerWork: 8 },
  xhs_creator_99: { sku: 'xhs_creator_99', priceFen: 9900, currency: 'content_sets', grantUnits: 25, validityDays: 30, regenPerWork: 15 },
  // 2026-08-26 §6 #8 XHS studio 60→50 套：grantUnits 60→50 收紧变相提价 20%；
  // 老客 60 天保护期由 server/billing/xhsLegacyProtection.mjs 负责（按 userId 写入 legacy_user_snapshot）。
  xhs_studio_199: { sku: 'xhs_studio_199', priceFen: 19900, currency: 'content_sets', grantUnits: 50, validityDays: 30, regenPerWork: 30 },
});

export const FEATURE_SKUS = freezeCatalog({
  // Both middle-station dashboards label balances with "$" but settle these prices in CNY.
  // gpt-image-2 记账成本区间：¥0.038–¥0.04+/张（65535 现行 ¥0.038/张为下沿；另有 ¥0.04 级通道报价，
  // 如 auto 档 ¥0.045 起）。记账统一取 ¥0.038，对账时注意不同通道的 ¥0.04 级差异，勿据单一报价断言成本漂移。
  ec_image_2k: { units: 1000, providerCostCny: 0.038 },
  ec_image_4k: { units: 2000, providerCostCny: 0.038 },
  /* ── nano 成本基准复核（2026-09-15 第 18 轮，**实测**，非估价）──
     ① 0.06 这个数 = 供应商现价（3.x 档：1K/2K/4K 同价），与面板报价逐字一致；
     ② 面板上另有更便宜的 2.x 档（0.04），但**本账号分组调不了** —— 实测返回
        404 `Model "…" is not supported by any configured account in this group`，
        所以「用便宜的档省 33%」这条不存在，0.06 就是当前唯一可用的成本；
     ③ 两档模型都做过**真实生成**验证（出图 200），不是只看接口清单。
     ⚠️ 面板的「支持模型」列 ≠ 本分组**实际可调**：面板列 7 个，接口只返回 4 个。
     下次若用户反馈某档报错，第一步是拉一次上游模型清单来对，别照面板判断。 */
  ec_nano_flash_1k: { units: 1000, providerCostCny: 0.06 },
  // 2026-08-26 §6 #3 nano 2K 修复：图片动价 1→1.5 积分。零售端 ¥0.262→¥0.393（+50%），
  // 终结同价异常（与 1K/4K 单价 ¥0.262 vs ¥0.131 不一致的隐性补贴）。
  // providerCostCny ¥0.06 保持不变；units 1000→1500 反映 1.5 积分扣费。
  ec_nano_flash_2k: { units: 1500, providerCostCny: 0.06 },
  ec_nano_flash_4k: { units: 2000, providerCostCny: 0.06 },
  ec_nano_pro_1k: { units: 1000, providerCostCny: 0.06 },
  ec_nano_pro_2k: { units: 1500, providerCostCny: 0.06 },
  ec_nano_pro_4k: { units: 2000, providerCostCny: 0.06 },
  // ── 9-13 新增四族五档（同一上游 IP233；成本为其权威价目 ¥/张）──
  // GPT Image 2.5：旗舰 sunburst / 极速 flare，扣费 1.5/1.5/2 积分，毛利 76~82%
  ec_image25_sunburst_1k: { units: 1500, providerCostCny: 0.0715 },
  ec_image25_sunburst_2k: { units: 1500, providerCostCny: 0.0975 },
  ec_image25_sunburst_4k: { units: 2000, providerCostCny: 0.1235 },
  ec_image25_flare_1k: { units: 1500, providerCostCny: 0.0715 },
  ec_image25_flare_2k: { units: 1500, providerCostCny: 0.0975 },
  ec_image25_flare_4k: { units: 2000, providerCostCny: 0.1235 },
  // MDKJ Super：全场最低成本档，扣费 1/1/1.5 积分，毛利 ≈90%
  ec_mdkj_1k: { units: 1000, providerCostCny: 0.026 },
  ec_mdkj_2k: { units: 1000, providerCostCny: 0.026 },
  ec_mdkj_4k: { units: 1500, providerCostCny: 0.026 },
  // Gemini 3 图像：擅画面内文字与多参考，扣费 2/2/3 积分，毛利 71~77%
  ec_gemini3_1k: { units: 2000, providerCostCny: 0.12 },
  ec_gemini3_2k: { units: 2000, providerCostCny: 0.12 },
  ec_gemini3_4k: { units: 3000, providerCostCny: 0.15 },
  // Midjourney：差异化美学档，上游仅 1K/2K（UI 不给 4K），扣费 3/3.5 积分
  ec_mj_1k: { units: 3000, providerCostCny: 0.25 },
  ec_mj_2k: { units: 3500, providerCostCny: 0.39 },
  // ── 视频按量终案（2026-08-26 已批准）：零售锚 priceFen（1元=100分）+ 积分扣费 units 双轨 ──
  // 积分折算锚 = 工作室包面值 ¥199/760000units ≈ ¥0.00026184/unit（见 pointsFaceAnchorCny）。
  // units = ⌈priceFen/100 ÷ 锚⌉ 向上取整到整积分，保证实付面值不低于终案现金价：
  //   ¥6.9→27 分(面值¥7.07)｜¥11.9→46 分(¥12.04)｜¥14.9→57 分(¥14.93)｜¥18.9→73 分(¥19.11)。
  // 图片 SKU 全系不动；记账成本维持已核定口径（Seedance 720p ¥5.07/条、1080p ¥6.37/条预留、MiniMax ¥0.76/条定案）。
  // 快试档：终案定价 ¥6.9 仅覆盖 fast 通道。原连路由 sd5-seedance-2.0-fast 账面 ¥5.07/条时毛利 ≈25.3%，
  // 曾按提案 D「补贴换活跃 + 频控」作受管补贴档运行；9-11 经用户拍板切到 IP233 优选通道
  // agv-seedance2.0fast（¥0.91/条，/api/pricing 实测报价，同 host 同协议），面值毛利回到 ≈84%，
  // 补贴档解除（subsidizedTeaser=false），TEASER_SUBSIDY 告警随成本收敛自然消失。
  // 注意：agv 通道不支持参考视频/参考音频/首尾帧（能力口径见 videoCatalog seedance_fast），
  // 首条真实账单落库后须对账校准「按条 ¥0.91」口径（见 upstreamLedger ip233-agv-seedance-fast 备注）。
  // maxDurationSeconds/dailyLimitPerUser/routeRestriction/freeReruns 为终案权益口径，运行时配额执行属后续接线（遗留）。
  video_seedance_fast_short: {
    units: 27000, providerCostCny: 0.91,
    priceFen: 690, marginBand: 'traffic',
    subsidizedTeaser: false, routeRestriction: 'fast-only',
    maxDurationSeconds: 5, dailyLimitPerUser: 3, freeReruns: 0,
  },
  video_seedance_fast_long: {
    units: 27000, providerCostCny: 0.91,
    priceFen: 690, marginBand: 'traffic',
    subsidizedTeaser: false, routeRestriction: 'fast-only',
    maxDurationSeconds: 5, dailyLimitPerUser: 3, freeReruns: 0,
  },
  // 标准档 ¥11.9 实付面值毛利 54.9%，落在引流带规划上沿（距主力地板 60% 差 5.1pp）——
  // 这是终案定价的直接结果，非成本漂移；上调空间由 admin 报表披露，不做静默调价。
  video_seedance_standard_short: {
    units: 46000, providerCostCny: 5.07,
    priceFen: 1190, marginBand: 'traffic',
    freeReruns: 0,
  },
  // 高品质档含 1 次免费重跑：重跑兑现当条成本翻倍（63.0% → 28.9%），
  // 以主力档缓冲吸收并经 FREE_RERUN_EXPOSURE 告警字段持续披露重跑敞口。
  video_seedance_standard_long: {
    units: 57000, providerCostCny: 5.07,
    priceFen: 1490, marginBand: 'core',
    freeReruns: 1,
  },
  // 1080p 留档未上架；public=false 使其不出现在公开目录与单位经济学看板，价格页以「即将上线」展示。
  // 9-16 路由复核结论（零成本探测，未花余额）：可接入的 1080p 路由是中转 seedance-2.0-1080p，
  // 中转实时报价 ¥7.67/条（原记 ¥6.37 是更早的快照，账面成本偏乐观），链路走完渠道与参数校验后
  // 仅因预扣 ¥7.67 超过中转余额被拒（insufficient_user_quota）。
  // 同族另外三条 1080p 均不可用：sd2.0/sd2.5-1080p-official 在本站分组无渠道、
  // sd7-seedance-2.0-1080p 与 seedance2.0-F-1080p 上游不认名；xn-seedance-2.5 支持 1080p 但 5 秒预扣 ¥9.36。
  // 上架前置条件：① 中转余额 ≥ ¥7.67×并发；② 按 ¥7.67 重算毛利并把本行 providerCostCny 改准；
  // ③ 在 videoCatalog 台账里把该路由转 verified/callable（门禁才允许 public:true）。
  video_seedance_1080p: {
    units: 73000, providerCostCny: 6.37,
    priceFen: 1890, marginBand: 'core',
    freeReruns: 0, public: false,
  },
  // 9-11: MiniMax H3 768P 上架 — IP233 按条 ¥4.55, 定价 ¥9.9 (毛利 54.0%, 与标准档同带);
  // units 按工作室包面值口径 priceCny×3819 向上取整。首条真实账单落库后须对账校准。
  video_minimax_h3_768p_short: {
    units: 38000, providerCostCny: 4.55,
    priceFen: 990, marginBand: 'traffic',
    freeReruns: 0,
  },
  video_minimax_h3_768p_long: {
    units: 38000, providerCostCny: 4.55,
    priceFen: 990, marginBand: 'traffic',
    freeReruns: 0,
  },
  /* ── 9-11 用户拍板「全上」: 6 个新档位 + MiniMax 2K 开公开 (成本取 IP233 权威价目) ──
     口径: 用户价 = 成本/(1−54%), units = priceCny × 3819 向上取整; 按条成本与时长无关时短长同价。 */
  video_grok_fast_short: { units: 6900, providerCostCny: 0.83, priceFen: 179, marginBand: 'traffic', freeReruns: 0 },
  video_grok_fast_long: { units: 8600, providerCostCny: 1.04, priceFen: 223, marginBand: 'traffic', freeReruns: 0 },
  /* ═══ 2026-09-24 批 AE：**通义万相改价**（用户原话：「通义万相这条档位：改价吧」）═══════════
     为什么必须改：这条档位原来记的是「按条 ¥0.455」，而**上游文档写的是按秒**
     （xn-wan3.0 的 api_doc：「按秒计费，所选分辨率单价 × seconds」；resolution_prices：
      480p ¥0.26/秒、720p ¥0.325/秒、1080p ¥0.455/秒 —— 0.455 正是 1080p 的**每秒价**，
      不是每条的价）。⇒ 原来 4 积分（面值 ¥1.047）连 5 秒 720p 的 ¥1.625 都盖不住，**在亏**。
     新价按项目既有口径（面值 ≥ 成本/0.60，即引流档下限 40%）取**最低合规价**：
       · short（5 秒，720p 成本 ¥1.625）→ 11 积分（面值 ¥2.8765）⇒ 成本占比 56.5%、毛利 43.5% ✓
       · long（10 秒，720p 成本 ¥3.25） → 22 积分（面值 ¥5.4839，按门禁口径毛利 40.7%）✓
     ⚠️ 比 4 积分贵了 2.75~5.25 倍 —— 这不是"想涨价"，是**原来就低于成本**；
        若用户觉得太贵，正解是**下线这条档位**，而不是继续亏着卖。 */
  video_wan_standard_short: { units: 11000, providerCostCny: 1.625, priceFen: 271, marginBand: 'traffic', freeReruns: 0 },
  video_wan_standard_long: { units: 22000, providerCostCny: 3.25, priceFen: 542, marginBand: 'traffic', freeReruns: 0 },
  video_kling_standard_short: { units: 16000, providerCostCny: 1.82, priceFen: 409, marginBand: 'traffic', freeReruns: 0 },
  video_kling_standard_long: { units: 16000, providerCostCny: 1.82, priceFen: 409, marginBand: 'traffic', freeReruns: 0 },
  video_kling_pro_short: { units: 32000, providerCostCny: 3.77, priceFen: 813, marginBand: 'traffic', freeReruns: 0 },
  video_kling_pro_long: { units: 32000, providerCostCny: 3.77, priceFen: 813, marginBand: 'traffic', freeReruns: 0 },
  video_veo_fast_short: { units: 11000, providerCostCny: 1.17, priceFen: 262, marginBand: 'traffic', freeReruns: 0 },
  video_veo_fast_long: { units: 11000, providerCostCny: 1.17, priceFen: 262, marginBand: 'traffic', freeReruns: 0 },
  /* 2026-09-19 批 K-B：Seedance 2.5 改接按条活路由 sd-2.5-js2（¥3.38/条，4-30 秒，10/10/10），
     原 xn-seedance-2.5 按秒 ¥1.872（5 秒 ¥9.36）被余额挡死。**用户价分文未动**（¥11.01 / 43000 units），
     记账成本按新路由改准 5.07 → 3.38（面值毛利 54.9% → 67.0%）。 */
  video_seedance_25_short: { units: 43000, providerCostCny: 3.38, priceFen: 1101, marginBand: 'traffic', freeReruns: 0 },
  video_seedance_25_long: { units: 43000, providerCostCny: 3.38, priceFen: 1101, marginBand: 'traffic', freeReruns: 0 },
  /* 2026-09-19 批 K-B：2K 档改接 xn-minimax-h3（按条 ¥3.64，4-15 秒，480p/720p/1440p，30/30/30），
     原 minimax-h3-per-request（¥7.41）与 minimax-h3-2k（¥5.85）都被余额挡住。
     **用户价分文未动**（¥16.9 / 65000 units），记账成本 5.85 → 3.64（主力带毛利 62.6% → 75.6%）。 */
  video_minimax_h3_2k_short: {
    units: 65000, providerCostCny: 3.64,
    priceFen: 1690, marginBand: 'core',
    freeReruns: 0, public: true,
  },
  // 9-11: 成本口径更正 —— IP233 权威价目 minimax-h3-2k = ¥5.85/条（原记 0.76 是另一条 poke 路线），
  // 短档 ¥14.9 毛利 60.7%、长档 ¥16.9 毛利 65.4%，均高于高端带 70% 地板下沿? 复核见 report（仍稳）。
  // 2026-08-26 §6 #1 H3-2K 长档定价：短档 ¥14.9 毛利 91.9%；长档若与短同价则两档重叠，
  // 按 78:68 积分比折算 ¥16.9 毛利 92.5% 仍稳，保留 5 毛溢价区隔短长。priceFen 1690 = ¥16.9，
  // 1 元 = 100 分锚。units 仍按工作室包面值 199/760000 反推后向上取整为 57000。
  video_minimax_h3_2k_long: {
    units: 65000, providerCostCny: 3.64,
    priceFen: 1690, marginBand: 'core',
    freeReruns: 0, public: true,
  },
  /* ── 2026-09-19 批 K-B 新增三档（用户批注「把之前的那些模型找回来」）─────────────────────
     定价**沿用站内既有规则**，没有新造口径：
       用户价 = 记账成本 / (1 − 54%) 取整到分；units = 现金价 × 3819 向上取整（工作室包面值锚）；
       marginBand 全部引流带（floor 40%），实测面值毛利均为 51.0%。
     成本取中转 /api/pricing 今日报价（¥2.08 / ¥2.6 / ¥3.77 每条的按条版）。 */
  video_sd_js900_short: { units: 17263, providerCostCny: 2.08, priceFen: 452, marginBand: 'traffic', freeReruns: 0 },
  video_sd_js900_long: { units: 17263, providerCostCny: 2.08, priceFen: 452, marginBand: 'traffic', freeReruns: 0 },
  video_sd_js_short: { units: 21578, providerCostCny: 2.6, priceFen: 565, marginBand: 'traffic', freeReruns: 0 },
  video_sd_js_long: { units: 21578, providerCostCny: 2.6, priceFen: 565, marginBand: 'traffic', freeReruns: 0 },
  video_seedance_mini_short: { units: 31317, providerCostCny: 3.77, priceFen: 820, marginBand: 'traffic', freeReruns: 0 },
  video_seedance_mini_long: { units: 31317, providerCostCny: 3.77, priceFen: 820, marginBand: 'traffic', freeReruns: 0 },
  video_plan_analysis: { units: 1000, providerCostCny: 0.05 },
  /* ═══ 2026-09-19 批 K-C：三步方案预览（图片侧「预览」/ 视频侧「代为撰写」共用一条流水线）═══
     用户第 16 轮把定价权交给我（docs/design/62 §一）：「收多少合适？这个我感觉应该你自己来定」，
     我在 §二 定的口径是 **0.5 积分 / 次**，理由三条都在那份文档里：
       ① 比知渔（0.60 = 0.10/张素材 + 0.50/次拆解 + 0.10/条脚本）低一档；
       ② 比站内 0.2 那一档（一键解析 / AI 润色 / 方向分析）重，但远低于出一张正片；
       ③ **一次一个数**，不按张、不按步叠加，用户点之前就知道花多少。
     ⚠️ 成本 0.03 是「一次视觉模型调用」的记账口径（比 video_plan_analysis 的 0.05 低，
       因为那条要出 2600 token 的结构化分镜，这条产出更短）；面值 0.5×锚 ≈ ¥0.131，
       实测毛利 ≈74%，过得了全局 70% 地板。
     ⚠️ 老的 video_plan_analysis（1 积分）**保留**：它是同一件事的另一条入口，
       改价会动老账单口径；两个入口共用新 SKU，老 SKU 只服务历史记录。 */
  ec_plan_preview: { units: 500, providerCostCny: 0.03 },
  // One Xiaohongshu/Plog set is a cover plus eight content images.
  // It uses the same point ledger as ecommerce generation: 9 x 2K images.
  xhs_image_set_2k: { units: 9000, currency: 'ec_points', providerCostCny: 0.342 },
  ec_ai_assistant: { units: 200, providerCostCny: 0.01 },
  ec_extension_analysis: { units: 1500, providerCostCny: 0.09 },
  ec_extension_basic: { units: 3000, providerCostCny: 0.114 },
  ec_extension_standard: { units: 5000, providerCostCny: 0.19 },
  ec_extension_complete: { units: 9000, providerCostCny: 0.342 },
  ec_reverse_prompt: { units: 200, providerCostCny: 0.01 },
  ec_canvas_ocr: { units: 200, providerCostCny: 0.01 },
  ec_remove_bg: { units: 500, providerCostCny: 0.03 },
  ec_direction_refresh: { units: 1000, providerCostCny: 0.05 },
  // 2026-09-10 计费全覆盖（用户原则：凡走上游必收积分）：套图首次方向分析也是两次 VLM 调用，
  // 与"刷新"同价；画布商品识别走 VLM 实例检测；小红书/Plog 预览封面走真实图片上游。
  ec_direction_analysis: { units: 1000, providerCostCny: 0.05 },
  ec_canvas_recognize: { units: 200, providerCostCny: 0.01 },
  ec_preview_cover: { units: 500, providerCostCny: 0.038 },
  ec_smart_layer: { units: 3000, providerCostCny: 0.20 },
  ec_layer_psd: { units: 3000, providerCostCny: 0.20 },
  /* 2026-09-11: 语音合成接真上游（火山引擎/豆包语音 大模型 TTS, ¥0.0001/千字）—— 凡走上游必收积分。
     0.5 积分/条 = 500 units; 一条 200 字口播的上游成本 ≈ ¥0.00004 → 毛利 >99.9%（引流/留存档）。
     未配置真凭据时 ttsBridge 仍返回 mock(mockAudio:true), 但计费口径不变（不假装免费）。 */
  ec_tts_voice: { units: 500, providerCostCny: 0.0002 },
  content_full_set: { units: 1, currency: 'content_sets' },
});

function assertPositiveFinite(value, label) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive finite number`);
  }
}

function toDecimalRational(value, label) {
  assertPositiveFinite(value, label);
  const [mantissa, exponentText] = value.toString().toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const exponent = Number(exponentText ?? 0);
  let numerator = BigInt(`${whole}${fraction}`);
  let scale = fraction.length - exponent;
  if (scale < 0) {
    numerator *= 10n ** BigInt(-scale);
    scale = 0;
  }
  return { numerator, scale };
}

export function getProduct(sku) {
  if (!Object.hasOwn(PRODUCTS, sku)) throw new Error(`Unknown product SKU: ${sku}`);
  const product = PRODUCTS[sku];
  return { ...product };
}

export function quoteFeature(sku, quantity) {
  if (!Object.hasOwn(FEATURE_SKUS, sku)) throw new Error(`Unknown feature SKU: ${sku}`);
  const feature = FEATURE_SKUS[sku];
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new TypeError('quantity must be a positive integer');
  }
  if (feature.enabled === false) {
    throw new Error(`Feature ${sku} is not enabled`);
  }

  const totalUnits = feature.units * quantity;
  if (!Number.isSafeInteger(totalUnits)) {
    throw new RangeError('totalUnits must be a safe integer');
  }

  return {
    sku,
    quantity,
    units: feature.units,
    totalUnits,
    currency: feature.currency ?? 'ec_points',
    providerCostCny: feature.providerCostCny,
  };
}

export function assertContributionMargin(item, unitPriceCny) {
  if (!item || typeof item !== 'object') {
    throw new TypeError('feature item is required');
  }
  const unitPrice = toDecimalRational(unitPriceCny, 'unit price');
  const providerCost = toDecimalRational(item.providerCostCny, 'provider cost');
  const commonScale = Math.max(unitPrice.scale, providerCost.scale);
  const unitPriceNumerator = unitPrice.numerator * 10n ** BigInt(commonScale - unitPrice.scale);
  const providerCostNumerator = providerCost.numerator * 10n ** BigInt(commonScale - providerCost.scale);

  const margin = (unitPriceCny - unitPriceCny * 0.03 - item.providerCostCny) / unitPriceCny;
  if (providerCostNumerator * 100n > unitPriceNumerator * 27n) {
    throw new Error(`Contribution margin ${margin.toFixed(4)} is below ${CONTRIBUTION_MARGIN_GATE.toFixed(2)}`);
  }
  return margin;
}

// 最优惠面值锚：常规充值包中用户能买到的最低单价（当前为工作室包 ¥199/760000units）。
// 只统计不含赠分的常规包——月卡礼包的"折后单价"含营销让利，不能作为零售锚，
// 否则每发一档新礼包都会静默拉低全部视频 SKU 的账面面值（walletService 记账同样钉在
// 199/760000，见 settleUsage 的 unitRevenue 口径）。常规包降价仍会传导到本锚并触发门禁重估。
export function pointsFaceAnchorCny() {
  let anchor = Number.POSITIVE_INFINITY;
  for (const product of Object.values(PRODUCTS)) {
    if (product.currency !== 'ec_points') continue;
    if (product.giftUnits !== undefined) continue; // 礼包/赠分产品不参与锚定
    anchor = Math.min(anchor, (product.priceFen / 100) / product.grantUnits);
  }
  assertPositiveFinite(anchor, 'points face anchor');
  return anchor;
}

export function contributionMarginOf(item, unitPriceCny) {
  assertPositiveFinite(unitPriceCny, 'unit price');
  if (!item || typeof item !== 'object') throw new TypeError('feature item is required');
  assertPositiveFinite(item.providerCostCny, 'provider cost');
  return (unitPriceCny - unitPriceCny * 0.03 - item.providerCostCny) / unitPriceCny;
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// 六档（含新留档 1080p 共七条生成 SKU）视频门禁报表：面值按积分实付（units×锚）计算。
export function videoMarginGateReport() {
  const anchor = pointsFaceAnchorCny();
  return Object.entries(FEATURE_SKUS)
    .filter(([sku, feature]) => sku.startsWith('video_') && sku !== 'video_plan_analysis'
      && Number.isSafeInteger(feature.units) && MARGIN_BANDS[feature.marginBand])
    .map(([sku, feature]) => {
      const faceCny = feature.units * anchor;
      const margin = contributionMarginOf(feature, faceCny);
      const band = MARGIN_BANDS[feature.marginBand];
      let status = 'ok';
      if (feature.subsidizedTeaser === true) status = 'teaser_subsidy';
      else if (margin < band.floor) status = 'below_band_floor';
      const freeReruns = feature.freeReruns ?? 0;
      const rerunAdjustedMargin = freeReruns > 0
        ? contributionMarginOf({ providerCostCny: feature.providerCostCny * (freeReruns + 1) }, faceCny)
        : null;
      return {
        sku,
        band: band.key,
        bandLabel: band.label,
        floor: band.floor,
        plannedCeiling: band.key === 'traffic' ? TRAFFIC_PLANNED_CEILING : null,
        priceFen: Number.isSafeInteger(feature.priceFen) ? feature.priceFen : null,
        faceCny: round(faceCny, 6),
        providerCostCny: feature.providerCostCny,
        margin: round(margin, 6),
        freeReruns,
        rerunAdjustedMargin: rerunAdjustedMargin === null ? null : round(rerunAdjustedMargin, 6),
        status,
      };
    });
}

// admin 告警字段：非 ok 状态 + 免费重跑敞口。随 buildUnitEconomicsCatalog() 进入 admin summary。
export function catalogMarginGateAlerts() {
  const alerts = [];
  for (const row of videoMarginGateReport()) {
    if (row.status === 'teaser_subsidy') {
      alerts.push({
        sku: row.sku,
        code: 'TEASER_SUBSIDY',
        severity: 'warning',
        detail: `快试补贴档毛利 ${(row.margin * 100).toFixed(1)}% 低于引流地板 ${(row.floor * 100).toFixed(0)}%；` +
          `按频控（每日${FEATURE_SKUS[row.sku].dailyLimitPerUser}次/${FEATURE_SKUS[row.sku].maxDurationSeconds}s/仅fast）受管运行，` +
          '切换廉价 fast 通道或调价后解除',
      });
    } else if (row.status === 'below_band_floor') {
      alerts.push({
        sku: row.sku,
        code: 'BELOW_BAND_FLOOR',
        severity: 'critical',
        detail: `${row.bandLabel}毛利 ${(row.margin * 100).toFixed(1)}% 低于地板 ${(row.floor * 100).toFixed(0)}%，须立即调价或下架`,
      });
    }
    if (row.rerunAdjustedMargin !== null && row.rerunAdjustedMargin < row.floor) {
      alerts.push({
        sku: row.sku,
        code: 'FREE_RERUN_EXPOSURE',
        severity: 'warning',
        detail: `含 ${row.freeReruns} 次免费重跑：重跑全额兑现时毛利降至 ${(row.rerunAdjustedMargin * 100).toFixed(1)}%，` +
          '以主力档缓冲吸收并监控重跑率',
      });
    }
  }
  return alerts;
}

// 启动期断言（fail closed）：低于地板直接抛错拒绝启动；补贴档必须满足频控与绝对成本上限且保持正贡献。
export function assertCatalogMarginGates() {
  const anchor = pointsFaceAnchorCny();
  for (const row of videoMarginGateReport()) {
    if (row.status === 'below_band_floor') {
      throw new Error(
        `Contribution margin gate violated for ${row.sku}: ${(row.margin * 100).toFixed(1)}%` +
        ` is below the ${row.bandLabel} floor of ${(row.floor * 100).toFixed(0)}%`,
      );
    }
    if (row.status === 'teaser_subsidy') {
      const feature = FEATURE_SKUS[row.sku];
      if (!(feature.dailyLimitPerUser > 0) || !(feature.maxDurationSeconds > 0) || !feature.routeRestriction) {
        throw new Error(`Subsidized teaser SKU ${row.sku} must declare quota controls (daily limit, duration cap, route restriction)`);
      }
      if (feature.providerCostCny > TEASER_ABSOLUTE_COST_CAP_CNY) {
        throw new Error(
          `Subsidized teaser SKU ${row.sku} books ¥${feature.providerCostCny}/条, above the ¥${TEASER_ABSOLUTE_COST_CAP_CNY} absolute cost cap`,
        );
      }
      if (row.margin <= 0) {
        throw new Error(`Subsidized teaser SKU ${row.sku} must stay contribution-positive at face ¥${(feature.units * anchor).toFixed(2)}`);
      }
    }
  }
  return true;
}