import React from 'react';
import { Check } from 'lucide-react';
import './EcommerceDesignPlanEditor.css';
import {
  buildCanvasSuitePlan,
  CANVAS_SUITE_PLAN_FIELDS,
  updateCanvasSuitePlanField,
  updateCanvasSuitePlanShot,
} from '../../EcCanvas/canvasSuitePlanModel.js';

export function EcommerceDesignPlanEditor({ direction = {}, prompt = '', onChange }) {
  const plan = buildCanvasSuitePlan(direction, prompt);
  const updateField = (key, value) => onChange?.(updateCanvasSuitePlanField(plan, key, value));
  const shots = Array.isArray(plan.shots) ? plan.shots : [];

  return <div className="ec-shared-plan-editor" aria-label="整体设计方案编辑区">
    <header className="ec-shared-plan-heading">
      <div>
        <span className="ec-shared-plan-kicker">AI 设计方案</span>
        <h3>整体设计方案</h3>
        <p>统一整套视觉规则，再逐张调整执行重点和画面比例。</p>
      </div>
      <span className="ec-shared-plan-state"><Check size={14} />可编辑</span>
    </header>
    <label className="ec-shared-plan-brief">
      <span>整套执行思路</span>
      <textarea data-suite-plan-field="brief" value={plan.brief || ''} onChange={event => onChange?.({ ...plan, brief: event.target.value.slice(0, 1600) })} aria-label="编辑整套执行思路" />
    </label>
    <div className="ec-shared-plan-grid">
      {CANVAS_SUITE_PLAN_FIELDS.map(field => <label key={field.key}>
        <span>{field.label}</span>
        <textarea data-suite-plan-field={field.key} value={plan[field.key] || ''} onChange={event => updateField(field.key, event.target.value)} aria-label={`编辑${field.label}`} />
      </label>)}
    </div>
    <section className="ec-shared-shot-plan" aria-label="逐图计划">
      <div className="ec-shared-shot-heading"><div><span className="ec-shared-plan-kicker">执行清单</span><h4>逐图计划</h4></div><strong>{shots.length} 张</strong></div>
      {shots.length ? shots.map(shot => <article className="ec-shared-shot" key={shot.id}>
        <div className="ec-shared-shot-meta"><div><strong>{shot.title}</strong><span>{shot.group} · {shot.purpose}</span></div><b>{shot.dimension}</b></div>
        <textarea data-suite-shot-field={shot.id} aria-label={`编辑${shot.title}的执行重点`} value={shot.responsibility || ''} onChange={event => onChange?.(updateCanvasSuitePlanShot(plan, shot.id, event.target.value))} />
      </article>) : <p className="ec-shared-shot-empty">方案生成后，这里会列出每张图片的职责和尺寸。</p>}
    </section>
  </div>;
}

export function EcommerceDesignPlanPreview({ direction = {}, prompt = '' }) {
  const plan = buildCanvasSuitePlan(direction, prompt);
  const fields = [
    ['视觉方向', plan.visualDirection],
    ['商品策略', plan.productStrategy],
    ['目标人群', plan.audience],
    ['构图与光线', plan.composition],
    ['文案规则', plan.copyRules],
    ['一致性与风险', plan.qualityRisks],
  ];
  return <div className="ec-shared-plan-preview" aria-label="整体设计方案摘要">
    <div className="ec-shared-plan-preview-header"><span className="ec-shared-plan-kicker">AI 设计方案</span><strong>{plan.shots.length || '待生成'} 张图片计划</strong></div>
    <p>{plan.brief}</p>
    <div className="ec-shared-plan-preview-grid">{fields.map(([label, value]) => <div key={label}><b>{label}</b><span>{value}</span></div>)}</div>
    {plan.shots.length > 0 && <div className="ec-shared-plan-preview-shots">{plan.shots.slice(0, 6).map(shot => <div key={shot.id}><strong>{shot.title}</strong><span>{shot.dimension}</span></div>)}</div>}
  </div>;
}

export default EcommerceDesignPlanEditor;
