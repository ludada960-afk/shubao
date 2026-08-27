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
    grantUnits: 175000, baseUnits: 150000, giftUnits: 25000, validityDays: null,
  },
  ec_monthpack_59: {
    sku: 'ec_monthpack_59', priceFen: 5900, currency: 'ec_points',
    grantUnits: 270000, baseUnits: 230000, giftUnits: 40000, validityDays: null,
  },
  xhs_entry_19: { sku: 'xhs_entry_19', priceFen: 1900, currency: 'content_sets', grantUnits: 3, validityDays: 30, regenPerWork: 5 },
  xhs_growth_49: { sku: 'xhs_growth_49', priceFen: 4900, currency: 'content_sets', grantUnits: 10, validityDays: 30, regenPerWork: 8 },
  xhs_creator_99: { sku: 'xhs_creator_99', priceFen: 9900, currency: 'content_sets', grantUnits: 25, validityDays: 30, regenPerWork: 15 },
  xhs_studio_199: { sku: 'xhs_studio_199', priceFen: 19900, currency: 'content_sets', grantUnits: 60, validityDays: 30, regenPerWork: 30 },
});

export const FEATURE_SKUS = freezeCatalog({
  // Both middle-station dashboards label balances with "$" but settle these prices in CNY.
  // gpt-image-2 记账成本区间：¥0.038–¥0.04+/张（65535 现行 ¥0.038/张为下沿；另有 ¥0.04 级通道报价，
  // 如 auto 档 ¥0.045 起）。记账统一取 ¥0.038，对账时注意不同通道的 ¥0.04 级差异，勿据单一报价断言成本漂移。
  ec_image_2k: { units: 1000, providerCostCny: 0.038 },
  ec_image_4k: { units: 2000, providerCostCny: 0.038 },
  ec_nano_flash_1k: { units: 1000, providerCostCny: 0.06 },
  // 2026-08-26 §6 #3 nano 2K 修复：图片动价 1→1.5 积分。零售端 ¥0.262→¥0.393（+50%），
  // 终结同价异常（与 1K/4K 单价 ¥0.262 vs ¥0.131 不一致的隐性补贴）。
  // providerCostCny ¥0.06 保持不变；units 1000→1500 反映 1.5 积分扣费。
  ec_nano_flash_2k: { units: 1500, providerCostCny: 0.06 },
  ec_nano_flash_4k: { units: 2000, providerCostCny: 0.06 },
  ec_nano_pro_1k: { units: 1000, providerCostCny: 0.06 },
  ec_nano_pro_2k: { units: 1500, providerCostCny: 0.06 },
  ec_nano_pro_4k: { units: 2000, providerCostCny: 0.06 },
  // ── 视频按量终案（2026-08-26 已批准）：零售锚 priceFen（1元=100分）+ 积分扣费 units 双轨 ──
  // 积分折算锚 = 工作室包面值 ¥199/760000units ≈ ¥0.00026184/unit（见 pointsFaceAnchorCny）。
  // units = ⌈priceFen/100 ÷ 锚⌉ 向上取整到整积分，保证实付面值不低于终案现金价：
  //   ¥6.9→27 分(面值¥7.07)｜¥11.9→46 分(¥12.04)｜¥14.9→57 分(¥14.93)｜¥18.9→73 分(¥19.11)。
  // 图片 SKU 全系不动；记账成本维持已核定口径（Seedance 720p ¥5.07/条、1080p ¥6.37/条预留、MiniMax ¥0.76/条定案）。
  // 快试档：终案定价 ¥6.9 仅覆盖 fast 通道；现连路由账面 ¥5.07/条时毛利 ≈25.3%，低于引流地板 40%，
  // 按提案 D「补贴换活跃 + 绝对成本上限 + 频控」作为受管补贴档运行：每条仍正贡献 ¥1.62，
  // 且必须满足 dailyLimitPerUser>0、成本≤¥6 上限。上游切到廉价 fast/mini 候选通道（IP233 ¥3.77/¥3.12/条）后
  // 毛利回到 43–52% 正常引流带；admin marginGateAlerts 持续输出 TEASER_SUBSIDY 直到通道或价格收敛。
  // maxDurationSeconds/dailyLimitPerUser/routeRestriction/freeReruns 为终案权益口径，运行时配额执行属后续接线（遗留）。
  video_seedance_fast_short: {
    units: 27000, providerCostCny: 5.07,
    priceFen: 690, marginBand: 'traffic',
    subsidizedTeaser: true, routeRestriction: 'fast-only',
    maxDurationSeconds: 5, dailyLimitPerUser: 3, freeReruns: 0,
  },
  video_seedance_fast_long: {
    units: 27000, providerCostCny: 5.07,
    priceFen: 690, marginBand: 'traffic',
    subsidizedTeaser: true, routeRestriction: 'fast-only',
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
  // 1080p 留档未上架（IP233 ¥6.37 报价尚未接生产路由）；public=false 使其不出现在公开目录与单位经济学看板，
  // 价格页以「即将上线」展示。上架前必须复核该报价存续并补路由。
  video_seedance_1080p: {
    units: 73000, providerCostCny: 6.37,
    priceFen: 1890, marginBand: 'core',
    freeReruns: 0, public: false,
  },
  video_minimax_h3_2k_short: {
    units: 57000, providerCostCny: 0.76,
    priceFen: 1490, marginBand: 'premium',
    freeReruns: 0, public: false,
  },
  // 2026-08-26 §6 #1 H3-2K 长档定价：短档 ¥14.9 毛利 91.9%；长档若与短同价则两档重叠，
  // 按 78:68 积分比折算 ¥16.9 毛利 92.5% 仍稳，保留 5 毛溢价区隔短长。priceFen 1690 = ¥16.9，
  // 1 元 = 100 分锚。units 仍按工作室包面值 199/760000 反推后向上取整为 57000。
  video_minimax_h3_2k_long: {
    units: 57000, providerCostCny: 0.76,
    priceFen: 1690, marginBand: 'premium',
    freeReruns: 0, public: false,
  },
  video_plan_analysis: { units: 1000, providerCostCny: 0.05 },
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
  ec_smart_layer: { units: 3000, providerCostCny: 0.20 },
  ec_layer_psd: { units: 3000, providerCostCny: 0.20 },
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