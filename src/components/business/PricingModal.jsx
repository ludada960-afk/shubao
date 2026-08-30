// 灵图风格定价弹窗 (用户 8-30 反馈, 8-31 重构)
// 用户 8-30 反馈 + 8-31 重构指令:
//   - 一套收费标准: 视频和图片共用 AI 积分, 不做两套分档
//   - 约数表达: 不写死"X 张图/Y 条视频", 写"约 X 张 / 约 Y 条"
//   - 弹窗要大, 有空间感, 有主次
//   - 标题面向最终用户, 不要"商业化档位"这种直白说法
//   - 关闭按钮失效 (Modals.jsx 已修), 选中态残留, 积分不显示
//
// 设计基准: 灵图 AI (月度套餐 / 永久积分包 双tab, 价格升序 4 档, 推荐档黑色按钮)

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { MdCheckCircle, MdStar, MdClose } from "react-icons/md";
import { FaWeixin } from "react-icons/fa";
import { SiAlipay } from "react-icons/si";
import { IMAGES } from "../../constants/images";

/* ── 共享积分体系 (一套收费: 视频+图片共用 AI 积分) ── */
const POINTS_PER_IMAGE = 3;
const POINTS_PER_VIDEO = 46;

function approxImages(units) { return Math.round(units / POINTS_PER_IMAGE); }
function approxVideos(units) { return Math.round(units / POINTS_PER_VIDEO); }
function formatUnits(n) { return n.toLocaleString("zh-CN"); }
function formatPriceYuan(p) { return p.toFixed(1); }

const PACK_LABEL = {
  trial:        "基础包",
  starter:      "专业包",
  growth:       "团队包",
  studio:       "工作室包",
  month_light:  "轻月卡",
  month_pro:    "Pro 月卡",
};

/* ── 4 档永久积分包 (升序, 专业包推荐) ── */
const PERMANENT_PACKS = [
  { id: "trial",   price: 9.9,   units: 300,  tagline: "0 风险试一次",  recommended: false },
  { id: "starter", price: 29,    units: 900,  tagline: "新手开店首选",  recommended: true  },
  { id: "growth",  price: 79,    units: 2400, tagline: "稳定出量",      recommended: false },
  { id: "studio",  price: 199,   units: 6000, tagline: "团队级产能",    recommended: false },
];

/* ── 2 档月卡 (积分当月有效, 含赠) ── */
const MONTHLY_PACKS = [
  { id: "month_light", price: 39, units: 175, gift: 25, tagline: "月内高频" },
  { id: "month_pro",   price: 59, units: 270, gift: 40, tagline: "稳定团队" },
];

/* ── 主组件 (props 向后兼容 4c183cd4 时代) ── */
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

  /* Tab: 'permanent' (永久积分包) | 'monthly' (月卡套餐) - 灵图风格双tab */
  const [activeTab, setActiveTab] = useState("permanent");
  const [selectedId, setSelectedId] = useState("starter");
  const [payProvider, setPayProvider] = useState(null);

  const currentPacks = activeTab === "permanent" ? PERMANENT_PACKS : MONTHLY_PACKS;
  const recommended = currentPacks.find((p) => p.recommended) || currentPacks[Math.min(1, currentPacks.length - 1)];
  const selectedPack = currentPacks.find((p) => p.id === selectedId) || currentPacks[0];

  /* Escape 关闭 */
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onKey = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /* 切 tab 时自动选中推荐档 (避免切换 tab 后旧选中残留) */
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setSelectedId(tab === "permanent" ? "starter" : "month_light");
    setPayProvider(null);
  }, []);

  /* 选套餐时清支付态 */
  const handleSelectPack = useCallback((id) => {
    setSelectedId(id);
    setPayProvider(null);
  }, []);

  const handlePay = useCallback(
    (provider) => {
      setPayProvider(provider);
      if (onBuy) onBuy({ id: selectedId, activeTab, provider });
      window.setTimeout(() => setPayProvider(null), 30000);
    },
    [onBuy, selectedId, activeTab]
  );

  return (
    <div className="pricing-modal" data-testid="pricing-modal" data-tab={activeTab} role="dialog" aria-label="选择积分包">
      {/* 装饰: 渐变光晕 (灵图风格的彩色柔光) */}
      <div className="pricing-modal__orb pricing-modal__orb--a" aria-hidden="true" />
      <div className="pricing-modal__orb pricing-modal__orb--b" aria-hidden="true" />

      {/* 顶部: 品牌 + 关闭 */}
      <header className="pricing-modal__header">
        <div className="pricing-modal__brand">
          <img src={IMAGES.logo_lg} alt="番茄AI" className="pricing-modal__brand-logo" />
          <span className="pricing-modal__brand-text">番茄 AI</span>
        </div>
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

      <h3 className="pricing-modal__title">给创作充点能量</h3>
      <p className="pricing-modal__subtitle">一次买断 · 视频和图片共用一套积分 · 用完再充</p>

      {/* 当前额度卡 (未登录也显示, 不再"积分不显示") */}
      <div className="pricing-modal__balance" data-testid="pricing-modal-balance">
        <div className="pricing-modal__balance-label">我的积分</div>
        <div className="pricing-modal__balance-value">
          {!isLogged
            ? <span className="pricing-modal__balance-login">登录后查看</span>
            : unlimited ? "∞" : formatUnits(ecPoints)
          }
        </div>
        <div className="pricing-modal__balance-foot">
          {isLogged ? "跨设备同步, 永不失效" : "登录购买可永久累积, 跨设备同步"}
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
          <em className="pricing-modal__tab-sub">月内高频更划算</em>
        </button>
      </div>

      {/* 套餐网格 (升序, 推荐档居中放大, 黑色 CTA) */}
      <div className="pricing-modal__pack-grid" data-testid="pricing-modal-packs">
        {currentPacks.map((pack) => {
          const isSelected = selectedId === pack.id;
          const isRec = pack.recommended;
          const imgCount = approxImages(pack.units);
          const vidCount = approxVideos(pack.units);
          return (
            <article
              key={pack.id}
              className={
                "pricing-modal__pack" +
                (isRec ? " pricing-modal__pack--anchored" : "") +
                (isSelected ? " pricing-modal__pack--selected" : "")
              }
              onClick={() => handleSelectPack(pack.id)}
              data-testid={"pricing-modal-pack-" + pack.id}
            >
              {isRec && (
                <span className="pricing-modal__pack-flag" data-testid="pricing-modal-pack-flag">
                  <MdStar size={10} /> 推荐
                </span>
              )}
              <div className="pricing-modal__pack-tagline">{pack.tagline}</div>
              <div className="pricing-modal__pack-name">{PACK_LABEL[pack.id]}</div>
              <div className="pricing-modal__pack-price">
                <span className="pricing-modal__pack-price-sym">¥</span>
                <span className="pricing-modal__pack-price-val">{formatPriceYuan(pack.price)}</span>
              </div>
              <div className="pricing-modal__pack-units">{formatUnits(pack.units)} 积分</div>
              <div className="pricing-modal__pack-equiv">
                {pack.gift
                  ? "含赠 " + pack.gift + " 积分"
                  : "约 " + imgCount + " 张图 / 约 " + vidCount + " 条视频"
                }
              </div>
              <button
                type="button"
                className={
                  "pricing-modal__pack-cta" +
                  (isSelected ? " pricing-modal__pack-cta--selected" : "") +
                  (isRec && !isSelected ? " pricing-modal__pack-cta--anchored" : "")
                }
                onClick={(e) => { e.stopPropagation(); handleSelectPack(pack.id); }}
                data-testid={"pricing-modal-pack-cta-" + pack.id}
              >
                {isSelected ? "✓ 已选" : "选这个"}
              </button>
            </article>
          );
        })}
      </div>

      {/* 支付区 */}
      <div className="pricing-modal__pay" data-testid="pricing-modal-pay">
        <div className="pricing-modal__pay-summary">
          已选: <strong>{PACK_LABEL[selectedPack.id]}</strong> · ¥{formatPriceYuan(selectedPack.price)} · {formatUnits(selectedPack.units)} 积分
        </div>
        <div className="pricing-modal__pay-grid">
          <button
            type="button"
            className={"pricing-modal__pay-btn pricing-modal__pay-btn--wechat" + (payProvider === "wechat" ? " is-pressed" : "")}
            onClick={() => handlePay("wechat")}
            data-testid="pricing-modal-pay-wechat"
          >
            <FaWeixin size={20} />
            <span>微信支付</span>
          </button>
          <button
            type="button"
            className={"pricing-modal__pay-btn pricing-modal__pay-btn--alipay" + (payProvider === "alipay" ? " is-pressed" : "")}
            onClick={() => handlePay("alipay")}
            data-testid="pricing-modal-pay-alipay"
          >
            <SiAlipay size={20} />
            <span>支付宝</span>
          </button>
        </div>
        <p className="pricing-modal__pay-note">
          所有创作功能共用一套 AI 积分 · 失败任务自动返还 · 一次买断永久有效
        </p>
      </div>
    </div>
  );
}
