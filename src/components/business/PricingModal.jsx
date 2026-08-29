// 4c183cd4 续命 PricingModal 组件 (4 视角重构)
// 用户原话 8-29 23:35: "这定价页你也还是没重构啊, 我之前的要求你完全没做呀"
// 4c183cd4 时代 + 8d608493 子代理没改, 现在主线程亲自做 4c183cd4 续命 真重构

import React from "react";
import { MdAutoAwesome, MdCheckCircle, MdStar } from "react-icons/md";

const colors = [
  "linear-gradient(135deg, #f59e0b, #f97316)",
  "linear-gradient(135deg, #6366f1, #8b5cf6)",
  "linear-gradient(135deg, #ec4899, #f43f5e)",
  "linear-gradient(135deg, #0f766e, #14b8a6)",
];

function formatCatalogPrice(priceFen) {
  return (priceFen / 100).toFixed(1);
}

function formatCatalogGrant(plan) {
  const units = plan.units || 0;
  return units + " AI 积分";
}

export default function PricingModalRefactored({ plans = [], providers = [], onBuy, onClose, isLogged, ecPoints = 0, unlimited = false }) {
  return (
    <div className="pricing-modal" data-testid="pricing-modal">
      <div className="pricing-modal__bg" />
      
      {/* 头部 */}
      <header className="pricing-modal__header">
        <h3 className="pricing-modal__title">
          套餐
          <span className="pricing-modal__badge">4c183cd4 续命</span>
        </h3>
        <p className="pricing-modal__subtitle">一次买断,按量结算</p>
      </header>

      {/* 用户额度卡 (4c183cd4 续命: 毛玻璃) */}
      {isLogged && (
        <div className="pricing-modal__balance">
          <div className="pricing-modal__balance-label">账户额度 · AI 积分</div>
          <div className="pricing-modal__balance-value">{unlimited ? "∞" : ecPoints}</div>
        </div>
      )}

      {/* 4 档 4 视角 1: 资深美工视角 4 档并排 + 推荐角标 */}
      <div className="pricing-modal__grid">
        {plans.map((plan, idx) => (
          <article
            key={plan.id || plan.sku || idx}
            className={
              "pricing-modal__card" +
              (plan.recommended ? " pricing-modal__card--recommended" : "")
            }
            onClick={plan.enabled && providers.length > 0 ? () => onBuy && onBuy(plan) : undefined}
          >
            {/* 资深美工视角: 顶部 icon + 推荐角标 */}
            <header className="pricing-modal__card-header">
              <span className="pricing-modal__card-icon" style={{ background: colors[idx % colors.length] }}>
                <MdAutoAwesome size={22} color="#fff" fill="#fff" />
              </span>
              {plan.recommended && (
                <span className="pricing-modal__card-recommend">
                  <MdStar size={11} /> 推荐
                </span>
              )}
            </header>

            <h4 className="pricing-modal__card-name">{plan.name}</h4>
            <div className="pricing-modal__card-units">{formatCatalogGrant(plan)}</div>
            <div className="pricing-modal__card-validity">
              {plan.validityDays ? plan.validityDays + " 天有效" : "永久有效"}
            </div>
            <p className="pricing-modal__card-desc">{plan.description}</p>

            {/* 产品经理视角: 4 个 checkbox 列出包含内容 */}
            <ul className="pricing-modal__card-features">
              <li><MdCheckCircle size={12} /> 电商套图 / XHS / 画布</li>
              <li><MdCheckCircle size={12} /> 4 步 1-click chain (TTS + 字幕)</li>
              <li><MdCheckCircle size={12} /> 100+ 公共模板</li>
              <li><MdCheckCircle size={12} /> 失败任务释放冻结</li>
            </ul>

            <div className="pricing-modal__card-price">
              <span className="pricing-modal__card-price-symbol">¥</span>
              <span className="pricing-modal__card-price-value">{formatCatalogPrice(plan.priceFen)}</span>
            </div>
            <div className="pricing-modal__card-cta">
              {plan.enabled ? (providers.length > 0 ? "选择套餐" : "即将开放") : "套餐已停用"}
            </div>
          </article>
        ))}
      </div>

      {/* 商业化高手视角: 取消"内测味"文案 */}
      <div className="pricing-modal__notice">
        <strong>AI 积分通用, 失败任务释放冻结</strong>
        {providers.length === 0 && (
          <p>微信/支付宝, 扫码 3-5 秒到账, 失败释放冻结额度</p>
        )}
      </div>

      <button type="button" className="pricing-modal__close" onClick={onClose}>关闭</button>
    </div>
  );
}