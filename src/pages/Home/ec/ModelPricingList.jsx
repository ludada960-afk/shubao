import React, { useEffect, useState } from 'react';

import { fetchBillingRules } from '../../../services/billing.js';
import { brandLogo } from '../../../services/modelLogos.js';
import ModelLogo from '../../../components/ModelLogo.jsx';
import { useModalScrollLock } from '../../../components/ui/useModalScrollLock.js';
import './model-pricing.css';

/**
 * 模型价格长清单（9-11 用户批注：照竞品那样把每个模型具体怎么收费公开透明地列出来）。
 * 数据源 = GET /api/billing/rules（后端 catalog 唯一真源），前端不写死任何价格。
 */
const SKU_BRAND = [
  [/^video_seedance/, 'bytedance'],
  [/^video_kling/, 'kuaishou'],
  [/^video_minimax/, 'minimax'],
  [/^video_veo/, 'google'],
  [/^video_grok/, 'xai'],
  [/^video_wan/, 'alibaba'],
  [/^ec_nano/, 'gemini'],
  [/^ec_image/, 'openai'],
  [/^ec_direction|^ec_ai_assistant|^ec_preview_cover/, 'openai'],
  [/^ec_tts_voice/, 'volcengine'],
];

function skuLogo(sku) {
  const hit = SKU_BRAND.find(([pattern]) => pattern.test(String(sku || '')));
  return brandLogo(hit ? hit[1] : 'openai');
}

export default function ModelPricingList({ open, onClose }) {
  const [state, setState] = useState({ loading: false, error: '', categories: [] });
  useModalScrollLock(open);
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setState(current => ({ ...current, loading: true, error: '' }));
    fetchBillingRules()
      .then(data => { if (!cancelled) setState({ loading: false, error: '', categories: Array.isArray(data?.categories) ? data.categories : [] }); })
      .catch(error => { if (!cancelled) setState({ loading: false, error: error?.message || '价格读取失败', categories: [] }); });
    return () => { cancelled = true; };
  }, [open]);
  if (!open) return null;
  const total = state.categories.reduce((sum, category) => sum + (category.items?.length || 0), 0);
  return <div className="model-pricing-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
    <section className="model-pricing-modal" role="dialog" aria-modal="true" aria-label="模型价格">
      <header className="model-pricing-head">
        <div>
          <strong>模型价格</strong>
          <span>全部能力逐项公开：单价 = 生成前报价里实际扣除的积分，生成前一次确认，失败自动退回</span>
        </div>
        <button type="button" className="model-pricing-close" aria-label="关闭模型价格" onClick={onClose}>×</button>
      </header>
      {state.error && <div className="model-pricing-error" role="alert">{state.error}</div>}
      {state.loading && <div className="model-pricing-loading">正在读取价格…</div>}
      <div className="model-pricing-body">
        {state.categories.map(category => (
          <article key={category.key} className="model-pricing-group">
            <h3>{category.label}<small>{category.items?.length || 0} 项</small></h3>
            <ul>
              {(category.items || []).map(item => (
                <li key={item.sku} className="model-pricing-row">
                  <ModelLogo logo={skuLogo(item.sku)} size={22} />
                  <span className="model-pricing-name">{item.label}</span>
                  <span className="model-pricing-unit">按{item.unit}计费</span>
                  <span className="model-pricing-price">{item.priceText}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
        {!state.loading && !state.error && <p className="model-pricing-foot">共 {total} 项能力 · 价格随上游成本变动时同步更新，不单独调价、不隐藏收费项</p>}
      </div>
    </section>
  </div>;
}
