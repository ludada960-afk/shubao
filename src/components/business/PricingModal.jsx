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

// 4c183cd4 续命 P-Modals (主线程亲自加 4c183cd4 时代 1af0762d0 漏的守卫):
// 用户 8-30 反馈 "一打开网站定价弹窗就一直显示, 关不掉, 不是首页"
// 根因 4c183cd4 时代老 PricingModal 函数缺守卫, Refactored 也没加, 任意 mount 路径都 DOM 渲染
// 加 show prop 守卫, 默认 undefined 保持向后兼容; 显式 show={false} 直接 return null
// Modals.jsx L312 外层已有 `if (!state.showPrice) return null`, 这里再加一层保险 (Refactored 自身守卫)
export default function PricingModalRefactored({ plans = [], providers = [], onBuy, onClose, isLogged, ecPoints = 0, unlimited = false, show = true }) {
  if (show === false) return null;
  return (
    <div className="pricing-modal" data-testid="pricing-modal">
      <div className="pricing-modal__bg" />
      
      {/* 头部 */}
      <header className="pricing-modal__header">
        <h3 className="pricing-modal__title">
          选择套餐
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


      {/* 视频按量档 (按 04-pricing.png 设计稿) */}
      <div className="pricing-modal__video">
        <div className="pricing-modal__section-eyebrow">Video · 按量</div>
        <div className="pricing-modal__video-grid">
          {[
            { eyebrow: 'FAST', name: '快试', desc: '5 秒试稿钩子', price: '6.9', units: '27 积分/条', note: '单条 ≤5 秒 · 每日最多 3 条', chip: '¥6.9/条' },
            { eyebrow: 'STANDARD', name: '标准', desc: '720P 正式交付主力', price: '11.9', units: '46 积分/条', note: '≤8 秒 · 商品/人物/场景通用', chip: '¥11.9/条', rec: true },
            { eyebrow: 'PREMIUM', name: '高品质', desc: '长时长交付', price: '14.9', units: '57 积分/条', note: '>8 秒 · 含 1 次免费重跑', chip: '¥14.9/条' },
          ].map(t => (
            <div key={t.eyebrow} className={"pricing-modal__video-card" + (t.rec ? " pricing-modal__video-card--rec" : "")}>
              <div className="pricing-modal__video-eyebrow">{t.eyebrow}</div>
              <div className="pricing-modal__video-name">{t.name}</div>
              <div className="pricing-modal__video-chip">{t.chip}</div>
              <div className="pricing-modal__video-units">{t.units}</div>
              <div className="pricing-modal__video-note">{t.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 4 档积分套餐 (按 04-pricing.png 设计稿) */}
      <div className="pricing-modal__section-eyebrow">Packs · 套餐</div>
      {/* 4 档套餐 */}
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

      {/* 商业化高手视角: 微信/支付宝 真品牌色 (按 04-pricing.png) */}
      <div className="pricing-modal__pay">
        <div className="pricing-modal__section-eyebrow">Pay · 支付</div>
        <div className="pricing-modal__pay-grid">
          <div className="pricing-modal__pay-card">
            <div className="pricing-modal__pay-brand pricing-modal__pay-brand--wechat">微信支付</div>
            <div className="pricing-modal__pay-state">扫码 3-5 秒到账</div>
          </div>
          <div className="pricing-modal__pay-card">
            <div className="pricing-modal__pay-brand pricing-modal__pay-brand--alipay">支付宝</div>
            <div className="pricing-modal__pay-state">扫码 3-5 秒到账</div>
          </div>
        </div>
        <div className="pricing-modal__pay-note">AI 积分通用 · 失败任务释放冻结额度 · 一次买断永久有效</div>
      </div>

      <button type="button" className="pricing-modal__close" onClick={onClose}>关闭</button>
    </div>
  );
}