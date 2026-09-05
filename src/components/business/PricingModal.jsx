// 灵图风格定价弹窗 (用户 8-30 反馈, 8-31 重构, 8-31 第 7 轮收敛)
// 用户 8-30 反馈 + 8-31 重构指令:
//   - 一套收费标准: 视频和图片共用 AI 积分, 不做两套分档
//   - 约数表达: 不写死"X 张图/Y 条视频", 写"约 X 张 / 约 Y 条"
//   - 弹窗要大, 有空间感, 有主次
//   - 标题面向最终用户, 不要"商业化档位"这种直白说法
//   - 关闭按钮失效 (Modals.jsx 已修), 选中态残留, 积分不显示
// 8-31 第 7 轮收敛 (本轮)：
//   - 删掉啰嗦的主副标题
//   - 去掉顶部 LOGO (番茄AI/薯包AI)
//   - 权益区改"一句话 + 清晰积分"（不再啰嗦列一堆权益）
//   - 套餐选中显示明确的"选中详情区"（渲染 desc 字段 + 有效期）
//   - 月卡(30天)与永久包真实区分有效期；有会过期积分时前端做到期倒计时
//   - 微信/支付宝不再直铺在页面上，改为点击"去支付"后由 Modals 弹出支付方式
//
// 设计基准: 灵图 AI (月度套餐 / 永久积分包 双tab, 价格升序, 推荐档黑色按钮)

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { MdStar, MdClose } from "react-icons/md";

function formatUnits(n) { return n.toLocaleString("zh-CN"); }
/* ── 渲染辅助: 从服务端 plans 派生展示数据 ── */
const PACK_LABEL = {
  ec_trial_990: "基础包",
  ec_starter_29: "专业包",
  ec_growth_79: "团队包",
  ec_studio_199: "工作室包",
  ec_monthpack_39: "轻月卡",
  ec_monthpack_59: "Pro 月卡",
};
const PACK_TAGLINE = {
  ec_trial_990: "0 风险试一次",
  ec_starter_29: "新手开店首选",
  ec_growth_79: "稳定出量",
  ec_studio_199: "团队级产能",
  ec_monthpack_39: "月内高频",
  ec_monthpack_59: "稳定团队",
};
/* 1 积分 = 1000 units (catalog 终案口径) */
const UNITS_PER_POINT = 1000;
/* 主力档图片成本 ¥0.038/张, 视频快试 ¥5.07/条 (catalog 终案口径) */
function unitsToPoints(units) { return Math.round(Number(units || 0) / UNITS_PER_POINT); }
function approxImages(points) { return Math.round(points); }
function approxVideos(points) { return Math.round(points / 27); }

/* 服务端套餐目录加载失败/未就绪时的兜底 (与 server/billing/catalog.mjs 终案一致)。
   用户 9-04 反馈"套餐又不见了": plans 为空时网格整个消失, 必须永远有套餐可看。 */
const FALLBACK_PLANS = [
  { sku: "ec_trial_990", name: "基础包", currency: "ec_points", priceFen: 990, grantUnits: 30000, giftUnits: 0, validityDays: null },
  { sku: "ec_starter_29", name: "专业包", currency: "ec_points", priceFen: 2900, grantUnits: 105000, giftUnits: 0, validityDays: null, recommended: true },
  { sku: "ec_growth_79", name: "团队包", currency: "ec_points", priceFen: 7900, grantUnits: 295000, giftUnits: 0, validityDays: null },
  { sku: "ec_studio_199", name: "工作室包", currency: "ec_points", priceFen: 19900, grantUnits: 760000, giftUnits: 0, validityDays: null },
  { sku: "ec_monthpack_39", name: "轻月卡", currency: "ec_points", priceFen: 3900, grantUnits: 150000, giftUnits: 25000, validityDays: 30 },
  { sku: "ec_monthpack_59", name: "Pro 月卡", currency: "ec_points", priceFen: 5900, grantUnits: 230000, giftUnits: 40000, validityDays: 30 },
];

/* 到期倒计时文案: 传最早到期时间 ISO + 当前时间戳, 返回 "X 天 Y 小时 / X 小时 Y 分 / X 分" */
function countdownText(expiresAt, nowMs) {
  const diff = Date.parse(expiresAt) - nowMs;
  if (!Number.isFinite(diff) || diff <= 0) return "即将到期";
  const totalMin = Math.floor(diff / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${mins} 分`;
  return `${mins} 分`;
}

/* ── 主组件 (props 向后兼容 4c183cd4 时代) ── */
export default function PricingModalRefactored({
  plans = [],
  providers = [],
  onBuy,
  onClose,
  isLogged,
  ecPoints = 0,
  ecPointsExpiring = 0,
  ecPointsExpiresAt = null,
  unlimited = false,
  show = true,
}) {
  if (show === false) return null;

  /* Tab: 'permanent' (永久积分包) | 'monthly' (月卡套餐) - 灵图风格双tab */
  const [activeTab, setActiveTab] = useState("permanent");
  const [selectedId, setSelectedId] = useState("ec_starter_29");
  /* 到期倒计时秒级 ticker */
  const [now, setNow] = useState(() => Date.now());

  /* 从服务端 plans props 派生当前 tab 的 SKU (currency=ec_points 的才是积分包);
     服务端目录未就绪时用内置兜底, 套餐永远可见 (用户 9-04 反馈) */
  const sourcePlans = (plans && plans.length ? plans : FALLBACK_PLANS);
  const planCatalog = sourcePlans.filter((p) => p && p.currency === "ec_points");
  const permanentPacks = planCatalog.filter((p) => !String(p.sku || "").startsWith("ec_monthpack_"));
  const monthlyPacks = planCatalog.filter((p) => String(p.sku || "").startsWith("ec_monthpack_"));
  const currentPacks = activeTab === "permanent" ? permanentPacks : monthlyPacks;
  /* 推荐档: ec_starter_29 (基于 server/billing/catalog.mjs 终案) */
  const recommended = currentPacks.find((p) => p.sku === "ec_starter_29") || currentPacks.find((p) => p.recommended) || currentPacks[Math.min(1, currentPacks.length - 1)];
  const selectedPack = currentPacks.find((p) => p && p.sku === selectedId) || recommended;

  /* Escape 关闭 */
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* 倒计时 tick (弹窗可见时每秒刷新) */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /* 切 tab 时自动选中推荐档 (避免切换 tab 后旧选中残留) */
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setSelectedId(tab === "permanent" ? "ec_starter_29" : "ec_monthpack_39");
  }, []);

  /* 选套餐时记录选中 SKU */
  const handleSelectPack = useCallback((sku) => {
    setSelectedId(sku);
  }, []);

  /* 会过期积分拆分: 登录 + 非 unlimited + 有会过期积分 + 有到期时间 */
  const hasExpiring = Boolean(isLogged && !unlimited && Number(ecPointsExpiring) > 0 && ecPointsExpiresAt);
  const expiryCountdown = hasExpiring ? countdownText(ecPointsExpiresAt, now) : "";

  /* 用户 9-05 定稿 (参考竞品): 每张卡片自带"立即开通", 点击直达支付方式,
     不再需要底部大按钮和选中详情区 — 弹窗一屏看全所有信息 */
  const handlePay = useCallback((pack) => {
    const target = pack || selectedPack;
    if (!target) return;
    if (onBuy) onBuy(target);
  }, [onBuy, selectedPack]);

  return (
    <div className="pricing-modal" data-testid="pricing-modal" data-tab={activeTab} role="dialog" aria-label="选择积分包">
      {/* 装饰: 渐变光晕 (灵图风格的彩色柔光) */}
      <div className="pricing-modal__orb pricing-modal__orb--a" aria-hidden="true" />
      <div className="pricing-modal__orb pricing-modal__orb--b" aria-hidden="true" />

      {/* 顶部: 仅关闭按钮 (LOGO 已按用户要求去掉) */}
      <header className="pricing-modal__header">
        <button
          type="button"
          className="pricing-modal__close"
          onClick={onClose}
          aria-label="关闭"
          data-testid="pricing-modal-close"
        >
          <MdClose size={18} />
        </button>
      </header>

      {/* 主标题 (8-31 第 8 轮: 砍掉眉题/副题, 标题行从 6 行收敛到 2 行) */}
      <h2 className="pricing-modal__title">积分<em>充值</em></h2>

      {/* 一句话 + 清晰积分 (不再啰嗦列一堆权益 / 主副标题) */}
      <div className="pricing-modal__hero" data-testid="pricing-modal-hero">
        <div className="pricing-modal__hero-line">
          一次买断 · 视频图片共用一套 AI 积分，用完再充
        </div>
        <div className="pricing-modal__hero-note" style={{ marginTop: 4, fontSize: 11, color: 'var(--text-hint, #6b7280)' }}>
          所有创作功能共用一套 AI 积分 · 失败任务自动返还
        </div>
        <div className="pricing-modal__hero-meta">
          {!isLogged
            ? <span className="pricing-modal__balance-login">登录后查看积分</span>
            : unlimited
              ? <span>我的积分: <strong>∞</strong></span>
              : <span>我的积分: <strong>{formatUnits(ecPoints)}</strong></span>
          }
          {hasExpiring && (
            <span className="pricing-modal__hero-expiring">
              <span className="pricing-modal__hero-dot">·</span>
              其中 {formatUnits(ecPointsExpiring)} 积分 {expiryCountdown} 后到期
            </span>
          )}
        </div>
      </div>

      {/* 双 Tab: 永久积分包 / 月卡套餐 (灵图风格) */}
      <div className="pricing-modal__tabs" role="tablist" aria-label="积分包类型">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "permanent"}
          className={"pricing-modal__tab" + (activeTab === "permanent" ? " pricing-modal__tab--active" : "")}
          onClick={() => handleTabChange("permanent")}
          data-testid="pricing-modal-tab-permanent"
        >
          <span className="pricing-modal__tab-name">永久积分包</span>
          <em className="pricing-modal__tab-sub">一次买断, 永不失效</em>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "monthly"}
          className={"pricing-modal__tab" + (activeTab === "monthly" ? " pricing-modal__tab--active" : "")}
          onClick={() => handleTabChange("monthly")}
          data-testid="pricing-modal-tab-monthly"
        >
          <span className="pricing-modal__tab-name">月卡套餐</span>
          <em className="pricing-modal__tab-sub">月内高频, 30 天有效</em>
        </button>
      </div>

      {/* 套餐网格 (升序, 推荐档居中放大, 黑色 CTA) */}
      <div className="pricing-modal__pack-grid" data-testid="pricing-modal-packs">
        {currentPacks.map((pack) => {
          const sku = String(pack.sku || "");
          const isSelected = selectedId === sku;
          const isRec = sku === "ec_starter_29" || pack.recommended === true;
          const points = unitsToPoints(pack.grantUnits);
          const giftPoints = pack.giftUnits ? unitsToPoints(pack.giftUnits) : 0;
          const imgCount = approxImages(points);
          const vidCount = approxVideos(points);
          const label = PACK_LABEL[sku] || sku;
          const tagline = PACK_TAGLINE[sku] || "";
          const validity = Number.isInteger(pack.validityDays) && pack.validityDays > 0
            ? `${pack.validityDays} 天有效`
            : "永久有效";
          return (
            <article
              key={sku}
              className={
                "pricing-modal__pack" +
                (isRec ? " pricing-modal__pack--anchored" : "") +
                (isSelected ? " pricing-modal__pack--selected" : "")
              }
              onClick={() => handleSelectPack(sku)}
              data-testid={"pricing-modal-pack-" + sku}
            >
              {isRec && (
                <span className="pricing-modal__pack-flag" data-testid="pricing-modal-pack-flag">
                  <MdStar size={10} /> 推荐
                </span>
              )}
              <span className="pricing-modal__pack-icon" aria-hidden="true"><MdStar size={22} /></span>
              <div className="pricing-modal__pack-tagline">{tagline}</div>
              <div className="pricing-modal__pack-name">{label}</div>
              <div className="pricing-modal__pack-price">
                <span className="pricing-modal__pack-price-sym">¥</span>
                <span className="pricing-modal__pack-price-val">{(pack.priceFen / 100).toFixed(1)}</span>
                <span className="pricing-modal__pack-price-period">{pack.validityDays ? "/月" : "/一次"}</span>
              </div>
              <div className="pricing-modal__pack-units">{formatUnits(points)}<small> 积分</small></div>
              <span className="pricing-modal__pack-validity">{validity}</span>
              <p className="pricing-modal__pack-desc">可生成约 {imgCount} 张图片 · 约 {vidCount} 条视频</p>
              <ul className="pricing-modal__pack-list">
                <li>
                  <span className="pricing-modal__pack-list-icon">🖼</span>
                  <span className="pricing-modal__pack-list-val">约 {imgCount}</span>
                  <span className="pricing-modal__pack-list-unit">张图片</span>
                </li>
                <li>
                  <span className="pricing-modal__pack-list-icon">🎬</span>
                  <span className="pricing-modal__pack-list-val">约 {vidCount}</span>
                  <span className="pricing-modal__pack-list-unit">条视频</span>
                </li>
                <li className="pricing-modal__pack-list-meta">
                  {pack.validityDays
                    ? <><span className="pricing-modal__pack-validity">{validity}</span>{giftPoints > 0 && <span> · 含赠 <strong>{giftPoints}</strong> 积分</span>}</>
                    : giftPoints > 0
                      ? <span>含赠 <strong>{giftPoints}</strong> 积分</span>
                      : <span>一次买断, 永久有效</span>
                  }
                </li>
              </ul>
              <button
                type="button"
                className={
                  "pricing-modal__pack-cta" +
                  (isSelected ? " pricing-modal__pack-cta--selected" : "") +
                  (isRec && !isSelected ? " pricing-modal__pack-cta--anchored" : "")
                }
                onClick={(e) => { e.stopPropagation(); handleSelectPack(sku); handlePay(pack); }}
                data-testid={"pricing-modal-pack-cta-" + sku}
              >
                立即开通
              </button>
            </article>
          );
        })}
      </div>

      {/* 用户 9-05 定稿: 底部"去支付"大按钮和选中详情区已移除 —
          每张套餐卡片自带"立即开通"(直达支付方式弹层), 弹窗一屏看全全部信息 */}
    </div>
  );
}
