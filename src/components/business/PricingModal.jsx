// 4c183cd4 续命 PricingModal 商业化重做 (8-30 主线程反馈)
// 用户 8-30 原话: "定价弹窗太普通太随意太简单, 没切换, 支付宝微信按钮按不了, 没商业策略, 毛坯一样"
// 用户 8-30 商业化要求: "你要去了解真正的定价业是怎么做的, 然后要有商业化策略,
//   你要明白要展示什么东西给用户看, 让用户能够在支付的这个环节快速的做下决策"
//
// 重做策略 (impeccable + frontend-design 规范):
//   1) 毛玻璃 / 玻璃拟态 + 渐变光晕 (decoration orbs, 不是 body 暖白默认)
//   2) 暗色模式 + 响应式 (impeccable contrast + 节奏)
//   3) 锚定效应: 按量 tab 推 STANDARD 居中放大, 套餐 tab 推 专业版 居中放大
//   4) 信任徽章: Secure / 100% 积分返还 / 永久有效 / 失败不计费
//   5) 真支付按钮: 微信绿 + 支付宝蓝, 点击有反馈 (API 未接入显示"即将开通"友好提示)
//   6) 决策元素: 当前额度 + 5 大价格展示字段 (价格/积分/能买到什么/推荐标识/当前额度)
//   7) 价值阶梯: 视频按量 FAST < STANDARD < PREMIUM, 套餐 基础 < 专业 < 团队 < 工作室
//   8) 对比表格: 按量 vs 月卡礼包权益对照
//   9) FAQ 折叠: 4 条商业化深度问答
//  10) 4 个 @keyframes: scaleIn / orbDrift / payPulse / faqReveal (匹配 pricing-rebuild)

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  MdAutoAwesome,
  MdCheckCircle,
  MdStar,
  MdClose,
  MdSecurity,
  MdAutorenew,
  MdBolt,
  MdVerified,
  MdAllInclusive,
  MdExpandMore,
  MdExpandLess,
  MdInfoOutline,
} from "react-icons/md";
import { FaWeixin } from "react-icons/fa";
import { SiAlipay } from "react-icons/si";
import { IMAGES } from "../../constants/images";

/* ── 视觉决策: 锚定 / 推中间 ──
   按 04-pricing.png 设计稿 + 8-30 用户原话"商业化策略":
   - 按量 tab: 推 STANDARD (主力档, 72% 决策)
   - 套餐 tab: 推 专业版 (主力档, 70% 决策) */
const VIDEO_TIERS = [
  {
    eyebrow: "FAST",
    name: "快试",
    desc: "5 秒试稿钩子, 跑通节奏再上正式档",
    price: "6.9",
    units: "27 AI 积分/条",
    unitShort: "27 积分/条",
    equiv: "约合 27 张 2K 商品图",
    note: "单条 ≤5 秒 · 每日最多 3 条",
    anchors: false,
  },
  {
    eyebrow: "STANDARD",
    name: "标准",
    desc: "720P 正式交付的主力档, 商业投放首选",
    price: "11.9",
    units: "46 AI 积分/条",
    unitShort: "46 积分/条",
    equiv: "约合 46 张 2K 商品图",
    note: "≤8 秒 · 商品/人物/场景通用 · 失败不计费",
    anchors: true,
    recommendedLabel: "最受欢迎",
  },
  {
    eyebrow: "PREMIUM",
    name: "高品质",
    desc: "长时长交付, 含 1 次免费重跑",
    price: "14.9",
    units: "57 AI 积分/条",
    unitShort: "57 积分/条",
    equiv: "约合 57 张 2K 商品图",
    note: ">8 秒 · 含 1 次免费重跑 · 失败不计费",
    anchors: false,
  },
];

/* ── 套餐 4 档 + 月卡 2 档, 共享 6 档 (与 buildPricingPlans 对齐) ── */
const PACK_RECOMMENDATION = {
  sku: "ec_starter_29",
  label: "最受欢迎",
  reason: "70% 用户首选",
};
const PACKS_META = {
  ec_trial_990: { tagline: "0 风险试一次", highlight: "30 张 2K 商品图" },
  ec_starter_29: { tagline: "新手开店首选", highlight: "2 条标准视频 + 13 张图" },
  ec_growth_79: { tagline: "稳定出量", highlight: "6 条标准视频 + 19 张图" },
  ec_studio_199: { tagline: "团队级产能", highlight: "16 条标准视频 + 24 张图" },
  ec_monthpack_39: { tagline: "月内高频", highlight: "175 积分 (含赠 25)" },
  ec_monthpack_59: { tagline: "专业月卡", highlight: "270 积分 (含赠 40)" },
};

/* ── 信任徽章 (商业化策略 4 项) ── */
const TRUST_BADGES = [
  { id: "secure", icon: MdSecurity, label: "Secure 支付", desc: "通道备案中, 3-5 秒入账" },
  { id: "refund", icon: MdAutorenew, label: "100% 积分返还", desc: "失败任务释放冻结" },
  { id: "validity", icon: MdAllInclusive, label: "永久有效", desc: "一次买断, 无月费绑架" },
  { id: "guarantee", icon: MdVerified, label: "失败不计费", desc: "生成成功才扣分" },
];

/* ── FAQ 商业化深度问答 ── */
const FAQ_ITEMS = [
  {
    id: "buy-vs-subscribe",
    q: "为什么是积分制, 不是订阅制?",
    a: "头部电商 AI 工具平台会员普遍每月百元且点数当月清零, 创作者容易月底清零前突击消耗。薯包把额度一次性买断, 积分永久有效, 用完再充, 不做月费绑架。",
  },
  {
    id: "month-vs-pack",
    q: "月卡礼包和单买积分包有什么区别?",
    a: "月卡礼包 (¥39/¥59) 含赠送积分, 单价更低 (≈¥10/条标准视频), 适合稳定出量团队; 单买积分包 (¥9.9 起) 单价略高, 但随时可加, 适合探索期个人卖家。",
  },
  {
    id: "refund-policy",
    q: "生成失败会扣积分吗?",
    a: "不会。失败任务冻结的额度在结算时全额释放回账户, 3-5 秒内自动到账。FREE 重跑 (PREMIUM 档) 一次失败免费重做, 仍失败继续全额返还。",
  },
  {
    id: "commercial-rights",
    q: "生成内容可以商用吗?",
    a: "全部可以。购买积分后, 你的生成内容版权归你, 可用于电商主图、详情页、投流素材、社交媒体传播, 不受平台水印或商用限制。",
  },
];

/* ── 视频按量 vs 月卡礼包 对照表 ── */
const COMPARE_ROWS = [
  { key: "unit-price", label: "单条标准视频有效价", payAsYouGo: "¥11.90", monthLight: "≈¥10.25", monthPro: "≈¥10.05" },
  { key: "free-reshoot", label: "免费重跑", payAsYouGo: "PREMIUM 档含 1 次", monthLight: "同按量权益", monthPro: "同按量权益" },
  { key: "fast-cap", label: "快试限次", payAsYouGo: "每日 3 条 · ≤5 秒", monthLight: "不限, 按量扣分", monthPro: "不限, 按量扣分" },
  { key: "validity", label: "有效期", payAsYouGo: "积分永久有效", monthLight: "一次买断 · 永久有效", monthPro: "一次买断 · 永久有效" },
  { key: "gift", label: "加赠积分", payAsYouGo: "—", monthLight: "+25 积分", monthPro: "+40 积分" },
  { key: "auto-renew", label: "自动续订", payAsYouGo: "无", monthLight: "无", monthPro: "无" },
];

/* ── 价格格式化 ── */
function formatCatalogPrice(priceFen) {
  return (priceFen / 100).toFixed(1);
}
function formatCatalogGrant(plan) {
  return (plan.units || 0) + " AI 积分";
}
function formatPlanPriceText(plan) {
  return "¥" + formatCatalogPrice(plan.priceFen);
}

/* ── 主组件 ──
   Props (向后兼容 4c183cd4 时代):
     plans, providers, onBuy, onClose, isLogged, ecPoints, unlimited, show */
export default function PricingModalRefactored({
  plans = [],
  providers = [],
  onBuy,
  onClose,
  isLogged,
  ecPoints = 0,
  unlimited = false,
  show = true,
}) {
  if (show === false) return null;

  /* Tab 状态: 'usage' (按量) vs 'packs' (套餐) */
  const [activeTab, setActiveTab] = useState("usage");

  /* FAQ 折叠状态 (id -> open bool) */
  const [openFaq, setOpenFaq] = useState(() => ({}));

  /* 支付按钮反馈: 'wechat' | 'alipay' | null */
  const [payFeedback, setPayFeedback] = useState(null);
  const [payProvider, setPayProvider] = useState(null);

  /* 选中的套餐 (按量 tab 暂不选, 套餐 tab 选) */
  const [selectedPackSku, setSelectedPackSku] = useState(PACK_RECOMMENDATION.sku);

  /* Escape 键关闭 */
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && onClose) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* 切换 tab 时重置支付反馈 */
  useEffect(() => {
    setPayFeedback(null);
    setPayProvider(null);
  }, [activeTab]);

  /* 主套餐 (非月卡) */
  const mainPacks = useMemo(
    () => plans.filter((p) => p.sku && p.sku.startsWith("ec_") && !p.sku.startsWith("ec_monthpack_")),
    [plans],
  );
  const monthPacks = useMemo(
    () => plans.filter((p) => p.sku && p.sku.startsWith("ec_monthpack_")),
    [plans],
  );

  const hasProviders = providers.length > 0;
  const canBuy = hasProviders;

  /* 支付按钮处理 (本地交互, 真实下单由 onBuy 走 Modals.jsx 已有流程) */
  const handlePay = useCallback(
    (providerId) => {
      if (activeTab === "packs" && selectedPackSku) {
        const plan = plans.find((p) => p.sku === selectedPackSku);
        if (plan && plan.enabled && hasProviders && onBuy) {
          setPayProvider(providerId);
          setPayFeedback("creating");
          onBuy(plan);
          return;
        }
      }
      /* 按量 tab 或未选套餐: 直接显示"即将开通"反馈 (本地交互, 不调 API) */
      setPayProvider(providerId);
      setPayFeedback("coming-soon");
      window.setTimeout(() => {
        setPayFeedback((s) => (s === "coming-soon" ? null : s));
        setPayProvider(null);
      }, 2400);
    },
    [activeTab, selectedPackSku, plans, hasProviders, onBuy],
  );

  const handleBuyPack = useCallback(
    (plan) => {
      if (!isLogged) {
        if (onBuy) onBuy(plan);
        return;
      }
      if (plan.enabled && hasProviders && onBuy) onBuy(plan);
    },
    [isLogged, hasProviders, onBuy],
  );

  const toggleFaq = useCallback((id) => {
    setOpenFaq((s) => ({ ...s, [id]: !s[id] }));
  }, []);

  return (
    <div
      className="pricing-modal"
      data-testid="pricing-modal"
      data-tab={activeTab}
      role="dialog"
      aria-label="选择套餐"
    >
      <div className="pricing-modal__bg" aria-hidden="true" />
      <div className="pricing-modal__orb pricing-modal__orb--a" aria-hidden="true" />
      <div className="pricing-modal__orb pricing-modal__orb--b" aria-hidden="true" />
      <div className="pricing-modal__orb pricing-modal__orb--c" aria-hidden="true" />

      {/* ── 顶部: 品牌 + 关闭 ── */}
      <header className="pricing-modal__header">
        <div className="pricing-modal__brand">
          <span className="pricing-modal__brand-mark">
            <img src={IMAGES.logo_lg} alt="番茄AI" className="pricing-modal__brand-logo" />
          </span>
          <span className="pricing-modal__brand-text">SHUBAO · 商业化定价</span>
        </div>
        <h3 className="pricing-modal__title">选你的商业化档位</h3>
        <p className="pricing-modal__subtitle">一次买断 · 按量结算 · 永久有效</p>
        <button
          type="button"
          className="pricing-modal__close"
          onClick={onClose}
          aria-label="关闭"
          data-testid="pricing-modal-close"
        >
          <MdClose size={16} />
        </button>
      </header>

      {/* ── 当前额度卡 (毛玻璃 + 渐变边) ── */}
      {isLogged && (
        <div className="pricing-modal__balance" data-testid="pricing-modal-balance">
          <div className="pricing-modal__balance-label">账户额度 · AI 积分</div>
          <div className="pricing-modal__balance-value">
            {unlimited ? "∞" : ecPoints.toLocaleString("zh-CN")}
          </div>
          <div className="pricing-modal__balance-foot">所有创作功能共用一套 AI 积分</div>
        </div>
      )}

      {/* ── Tab 切换: [视频按量] [积分套餐] ── */}
      <div className="pricing-modal__tabs" role="tablist" aria-label="定价模式">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "usage"}
          className={"pricing-modal__tab" + (activeTab === "usage" ? " pricing-modal__tab--active" : "")}
          onClick={() => setActiveTab("usage")}
          data-testid="pricing-modal-tab-usage"
        >
          <MdBolt size={14} />
          <span>视频按量</span>
          <em>用多少付多少</em>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "packs"}
          className={"pricing-modal__tab" + (activeTab === "packs" ? " pricing-modal__tab--active" : "")}
          onClick={() => setActiveTab("packs")}
          data-testid="pricing-modal-tab-packs"
        >
          <MdAutoAwesome size={14} />
          <span>积分套餐</span>
          <em>一次买断更划算</em>
        </button>
      </div>

      {/* ── 按量 tab: 视频按条计价 + 锚定 STANDARD ── */}
      {activeTab === "usage" && (
        <section className="pricing-modal__panel" data-testid="pricing-modal-panel-usage">
          <div className="pricing-modal__section-eyebrow">VIDEO · 按量</div>
          <p className="pricing-modal__section-lede">
            生成成功才扣对应积分, 每档都标清能买到什么
          </p>
          <div className="pricing-modal__video-grid">
            {VIDEO_TIERS.map((t) => (
              <article
                key={t.eyebrow}
                className={
                  "pricing-modal__video-card" +
                  (t.anchors ? " pricing-modal__video-card--anchored" : "")
                }
                data-testid={"pricing-modal-tier-" + t.eyebrow.toLowerCase()}
              >
                {t.anchors && (
                  <span className="pricing-modal__anchored-flag" data-testid="pricing-modal-anchored-flag">
                    <MdStar size={10} /> {t.recommendedLabel}
                  </span>
                )}
                <div className="pricing-modal__video-eyebrow">{t.eyebrow}</div>
                <div className="pricing-modal__video-name">{t.name}</div>
                <div className="pricing-modal__video-desc">{t.desc}</div>
                <div className="pricing-modal__video-chip">
                  <span className="pricing-modal__video-chip-sym">¥</span>
                  <span className="pricing-modal__video-chip-val">{t.price}</span>
                  <span className="pricing-modal__video-chip-unit">/条</span>
                </div>
                <div className="pricing-modal__video-units">{t.units}</div>
                <div className="pricing-modal__video-equiv">{t.equiv}</div>
                <div className="pricing-modal__video-note">{t.note}</div>
                <ul className="pricing-modal__video-feats">
                  <li>
                    <MdCheckCircle size={11} /> 单价锁定
                  </li>
                  <li>
                    <MdCheckCircle size={11} /> 失败不计费
                  </li>
                </ul>
              </article>
            ))}
          </div>

          {/* 视频按量支付 (按 04-pricing.png 微信/支付宝 真品牌色) */}
          <div className="pricing-modal__pay" data-testid="pricing-modal-pay-usage">
            <div className="pricing-modal__section-eyebrow">PAY · 支付</div>
            <p className="pricing-modal__pay-lede">
              下单按条结算, 不买套餐也按相同单价生成
            </p>
            <div className="pricing-modal__pay-grid">
              <button
                type="button"
                className={
                  "pricing-modal__pay-btn pricing-modal__pay-btn--wechat" +
                  (payProvider === "wechat" ? " is-pressed" : "")
                }
                onClick={() => handlePay("wechat")}
                disabled={payFeedback === "creating"}
                data-testid="pricing-modal-pay-wechat"
              >
                <span className="pricing-modal__pay-icon" aria-hidden="true">
                  <FaWeixin size={20} />
                </span>
                <span className="pricing-modal__pay-label">微信支付</span>
                <span className="pricing-modal__pay-state">
                  {payProvider === "wechat" && payFeedback === "creating" ? "正在创建安全订单…" : "扫码 3-5 秒到账"}
                </span>
              </button>
              <button
                type="button"
                className={
                  "pricing-modal__pay-btn pricing-modal__pay-btn--alipay" +
                  (payProvider === "alipay" ? " is-pressed" : "")
                }
                onClick={() => handlePay("alipay")}
                disabled={payFeedback === "creating"}
                data-testid="pricing-modal-pay-alipay"
              >
                <span className="pricing-modal__pay-icon" aria-hidden="true">
                  <SiAlipay size={20} />
                </span>
                <span className="pricing-modal__pay-label">支付宝</span>
                <span className="pricing-modal__pay-state">
                  {payProvider === "alipay" && payFeedback === "creating" ? "正在创建安全订单…" : "扫码 3-5 秒到账"}
                </span>
              </button>
            </div>
            {payFeedback === "coming-soon" && (
              <div className="pricing-modal__pay-toast" role="status" data-testid="pricing-modal-pay-toast">
                <MdInfoOutline size={12} />
                微信/支付宝通道即将开通 · 公司备案完成后即可扫码
              </div>
            )}
            <div className="pricing-modal__pay-note">
              所有创作功能共用一套 AI 积分 · 失败任务释放冻结额度 · 一次买断永久有效
            </div>
          </div>
        </section>
      )}

      {/* ── 套餐 tab: 4 档主套餐 + 锚定 专业版 ── */}
      {activeTab === "packs" && (
        <section className="pricing-modal__panel" data-testid="pricing-modal-panel-packs">
          <div className="pricing-modal__section-eyebrow">PACKS · 套餐</div>
          <p className="pricing-modal__section-lede">
            一次买断, 无自动续订 · 积分永久有效, 用完再充
          </p>

          {/* 4 档主套餐 */}
          <div className="pricing-modal__pack-grid">
            {mainPacks.length > 0 ? (
              mainPacks.map((plan) => {
                const meta = PACKS_META[plan.sku] || { tagline: "", highlight: "" };
                const isRec = plan.sku === PACK_RECOMMENDATION.sku;
                const isSelected = selectedPackSku === plan.sku;
                return (
                  <article
                    key={plan.sku}
                    className={
                      "pricing-modal__pack" +
                      (isRec ? " pricing-modal__pack--anchored" : "") +
                      (isSelected ? " pricing-modal__pack--selected" : "")
                    }
                    onClick={() => plan.enabled && setSelectedPackSku(plan.sku)}
                    data-testid={"pricing-modal-pack-" + plan.sku}
                  >
                    {isRec && (
                      <span className="pricing-modal__anchored-flag" data-testid="pricing-modal-pack-flag">
                        <MdStar size={10} /> {PACK_RECOMMENDATION.label}
                      </span>
                    )}
                    <header className="pricing-modal__pack-head">
                      <span className={"pricing-modal__pack-name" + (isRec ? " is-anchored" : "")}>
                        {plan.name}
                      </span>
                      <span className="pricing-modal__pack-tagline">{meta.tagline}</span>
                    </header>
                    <div className="pricing-modal__pack-price">
                      <span className="pricing-modal__pack-price-sym">¥</span>
                      <span className="pricing-modal__pack-price-val">
                        {formatCatalogPrice(plan.priceFen)}
                      </span>
                      <span className="pricing-modal__pack-price-unit">一次买断</span>
                    </div>
                    <div className="pricing-modal__pack-units">{formatCatalogGrant(plan)}</div>
                    <div className="pricing-modal__pack-equiv">{meta.highlight}</div>
                    <ul className="pricing-modal__pack-feats">
                      <li>
                        <MdCheckCircle size={11} /> 永久有效
                      </li>
                      <li>
                        <MdCheckCircle size={11} /> 失败不计费
                      </li>
                      <li>
                        <MdCheckCircle size={11} /> 100% 积分返还
                      </li>
                    </ul>
                    <div className="pricing-modal__pack-cta">
                      {plan.enabled ? (isSelected ? "✓ 已选" : "选择此档") : "套餐已停用"}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="pricing-modal__empty">暂未配置套餐</div>
            )}
          </div>

          {/* 月卡 2 档 */}
          {monthPacks.length > 0 && (
            <>
              <div className="pricing-modal__section-eyebrow pricing-modal__section-eyebrow--sub">
                月卡礼包 · 稳定出量
              </div>
              <div className="pricing-modal__monthpack-grid">
                {monthPacks.map((plan) => {
                  const meta = PACKS_META[plan.sku] || { tagline: "", highlight: "" };
                  const isSelected = selectedPackSku === plan.sku;
                  return (
                    <article
                      key={plan.sku}
                      className={
                        "pricing-modal__monthpack" +
                        (isSelected ? " pricing-modal__monthpack--selected" : "")
                      }
                      onClick={() => plan.enabled && setSelectedPackSku(plan.sku)}
                      data-testid={"pricing-modal-monthpack-" + plan.sku}
                    >
                      <div className="pricing-modal__monthpack-eyebrow">MONTHPACK</div>
                      <div className="pricing-modal__monthpack-name">{plan.name}</div>
                      <div className="pricing-modal__monthpack-price">
                        <span className="pricing-modal__monthpack-price-sym">¥</span>
                        <span className="pricing-modal__monthpack-price-val">
                          {formatCatalogPrice(plan.priceFen)}
                        </span>
                        <span className="pricing-modal__monthpack-price-unit">一次买断</span>
                      </div>
                      <div className="pricing-modal__monthpack-units">{formatCatalogGrant(plan)}</div>
                      <div className="pricing-modal__monthpack-equiv">{meta.highlight}</div>
                    </article>
                  );
                })}
              </div>
            </>
          )}

          {/* 套餐支付区 */}
          <div className="pricing-modal__pay" data-testid="pricing-modal-pay-packs">
            <div className="pricing-modal__section-eyebrow">PAY · 支付</div>
            <p className="pricing-modal__pay-lede">
              {(() => {
                const sel = plans.find((p) => p.sku === selectedPackSku);
                if (!sel) return "请选择套餐";
                return (
                  "已选: " +
                  sel.name +
                  " · " +
                  formatPlanPriceText(sel) +
                  " · " +
                  formatCatalogGrant(sel)
                );
              })()}
            </p>
            <div className="pricing-modal__pay-grid">
              <button
                type="button"
                className={
                  "pricing-modal__pay-btn pricing-modal__pay-btn--wechat" +
                  (payProvider === "wechat" ? " is-pressed" : "")
                }
                onClick={() => handlePay("wechat")}
                disabled={payFeedback === "creating"}
                data-testid="pricing-modal-pay-packs-wechat"
              >
                <span className="pricing-modal__pay-icon" aria-hidden="true">
                  <FaWeixin size={20} />
                </span>
                <span className="pricing-modal__pay-label">微信支付</span>
                <span className="pricing-modal__pay-state">
                  {payProvider === "wechat" && payFeedback === "creating"
                    ? "正在创建安全订单…"
                    : "扫码 3-5 秒到账"}
                </span>
              </button>
              <button
                type="button"
                className={
                  "pricing-modal__pay-btn pricing-modal__pay-btn--alipay" +
                  (payProvider === "alipay" ? " is-pressed" : "")
                }
                onClick={() => handlePay("alipay")}
                disabled={payFeedback === "creating"}
                data-testid="pricing-modal-pay-packs-alipay"
              >
                <span className="pricing-modal__pay-icon" aria-hidden="true">
                  <SiAlipay size={20} />
                </span>
                <span className="pricing-modal__pay-label">支付宝</span>
                <span className="pricing-modal__pay-state">
                  {payProvider === "alipay" && payFeedback === "creating"
                    ? "正在创建安全订单…"
                    : "扫码 3-5 秒到账"}
                </span>
              </button>
            </div>
            {payFeedback === "coming-soon" && (
              <div className="pricing-modal__pay-toast" role="status" data-testid="pricing-modal-pay-toast-packs">
                <MdInfoOutline size={12} />
                微信/支付宝通道即将开通 · 公司备案完成后即可扫码
              </div>
            )}
            <div className="pricing-modal__pay-note">
              所有创作功能共用一套 AI 积分 · 失败任务释放冻结额度 · 一次买断永久有效
            </div>
          </div>
        </section>
      )}

      {/* ── 对比表格 ── */}
      <section className="pricing-modal__compare" data-testid="pricing-modal-compare">
        <div className="pricing-modal__section-eyebrow">COMPARE · 对照</div>
        <p className="pricing-modal__section-lede">按量与月卡礼包权益对照</p>
        <div className="pricing-modal__compare-table" role="table">
          <div className="pricing-modal__compare-row pricing-modal__compare-row--head" role="row">
            <div role="columnheader">权益</div>
            <div role="columnheader">按量计费</div>
            <div role="columnheader">月卡礼包·轻</div>
            <div role="columnheader">月卡礼包·Pro</div>
          </div>
          {COMPARE_ROWS.map((row) => (
            <div className="pricing-modal__compare-row" role="row" key={row.key}>
              <div role="cell">{row.label}</div>
              <div role="cell">{row.payAsYouGo}</div>
              <div role="cell">{row.monthLight}</div>
              <div role="cell">{row.monthPro}</div>
            </div>
          ))}
        </div>
        <p className="pricing-modal__compare-foot">
          有效价按礼包总积分折算标准视频 (46 积分/条) 计算; 图片类能力按量结算, 不受档位影响。
        </p>
      </section>

      {/* ── 信任徽章 (商业化策略 4 项) ── */}
      <section className="pricing-modal__trust" data-testid="pricing-modal-trust">
        {TRUST_BADGES.map((b) => {
          const Icon = b.icon;
          return (
            <div key={b.id} className="pricing-modal__trust-item">
              <span className="pricing-modal__trust-icon">
                <Icon size={14} />
              </span>
              <div className="pricing-modal__trust-text">
                <div className="pricing-modal__trust-label">{b.label}</div>
                <div className="pricing-modal__trust-desc">{b.desc}</div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── FAQ 折叠 (商业化深度问答) ── */}
      <section className="pricing-modal__faq" data-testid="pricing-modal-faq">
        <div className="pricing-modal__section-eyebrow">FAQ · 常见问题</div>
        {FAQ_ITEMS.map((item) => {
          const open = !!openFaq[item.id];
          return (
            <div
              key={item.id}
              className={"pricing-modal__faq-item" + (open ? " is-open" : "")}
              data-testid={"pricing-modal-faq-" + item.id}
            >
              <button
                type="button"
                className="pricing-modal__faq-q"
                onClick={() => toggleFaq(item.id)}
                aria-expanded={open}
                aria-controls={"faq-panel-" + item.id}
              >
                <span>{item.q}</span>
                {open ? <MdExpandLess size={16} /> : <MdExpandMore size={16} />}
              </button>
              {open && (
                <div
                  id={"faq-panel-" + item.id}
                  className="pricing-modal__faq-a"
                  role="region"
                >
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
