import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import './EcommerceDesignPlanEditor.css';
import {
  buildCanvasSuitePlan,
  CANVAS_SUITE_PLAN_FIELDS,
  CANVAS_SUITE_SHOT_FIELDS,
  updateCanvasSuitePlanField,
  updateCanvasSuitePlanShot,
} from '../../EcCanvas/canvasSuitePlanModel.js';

function ShotField({ field, shot, onChange }) {
  return <label className="ec-shared-shot-field">
    <span>{field.label}</span>
    <textarea
      data-suite-shot-detail-field={`${shot.id}-${field.key}`}
      value={shot[field.key] || ''}
      onChange={event => onChange(field.key, event.target.value)}
      aria-label={`编辑${shot.title}的${field.label}`}
    />
  </label>;
}

function EditableShot({ shot, expanded, onToggle, onChange }) {
  return <article className={`ec-shared-shot ${expanded ? 'is-expanded' : ''}`}>
    <button type="button" className="ec-shared-shot-toggle" aria-expanded={expanded} onClick={onToggle}>
      <span className="ec-shared-shot-index">{Number(shot.index) + 1 || '•'}</span>
      <span className="ec-shared-shot-summary">
        <strong>{shot.title}</strong>
        <span>{shot.group} · {shot.purpose}</span>
      </span>
      <b className="ec-shared-shot-ratio">{shot.dimension}</b>
      {expanded ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
    </button>
    {expanded && <div className="ec-shared-shot-body">
      <label className="ec-shared-shot-title-field">
        <span>图片标题</span>
        <input
          data-suite-shot-field={shot.id}
          value={shot.title || ''}
          onChange={event => onChange('title', event.target.value)}
          aria-label={`编辑${shot.title}的标题`}
        />
      </label>
      <div className="ec-shared-shot-detail-grid">
        {CANVAS_SUITE_SHOT_FIELDS.map(field => <ShotField key={field.key} field={field} shot={shot} onChange={onChange} />)}
      </div>
    </div>}
  </article>;
}

export function EcommerceDesignPlanEditor({ direction = {}, prompt = '', onChange }) {
  const plan = buildCanvasSuitePlan(direction, prompt);
  const [expandedShotId, setExpandedShotId] = useState(null);
  const updateField = (key, value) => onChange?.(updateCanvasSuitePlanField(plan, key, value));
  const updateShot = (shotId, key, value) => onChange?.(updateCanvasSuitePlanShot(plan, shotId, { [key]: value }));
  const shots = Array.isArray(plan.shots) ? plan.shots : [];

  return <div className="ec-shared-plan-editor" aria-label="整体设计方案编辑区">
    <header className="ec-shared-plan-heading">
      <div>
        <span className="ec-shared-plan-kicker">AI 设计方案</span>
        <h3>整体设计方案</h3>
        <p>先统一整套视觉规则，再逐张确认标题、画面重点和生成约束。</p>
      </div>
      <span className="ec-shared-plan-state"><Check size={14} />可编辑</span>
    </header>
    <label className="ec-shared-plan-brief">
      <span>整套执行思路</span>
      <textarea data-suite-plan-field="brief" value={plan.brief || ''} onChange={event => onChange?.({ ...plan, brief: event.target.value.slice(0, 1800) })} aria-label="编辑整套执行思路" />
    </label>
    <div className="ec-shared-plan-grid">
      {CANVAS_SUITE_PLAN_FIELDS.map(field => <label key={field.key}>
        <span>{field.label}</span>
        <textarea data-suite-plan-field={field.key} value={plan[field.key] || ''} onChange={event => updateField(field.key, event.target.value)} aria-label={`编辑${field.label}`} />
      </label>)}
    </div>
    <section className="ec-shared-shot-plan" aria-label="逐图计划">
      <div className="ec-shared-shot-heading">
        <div><span className="ec-shared-plan-kicker">执行清单</span><h4>逐图计划</h4><p>点击一张图片展开，标题和详细执行内容都可以修改。</p></div>
        <strong>{shots.length} 张</strong>
      </div>
      {shots.length ? shots.map((shot, index) => <EditableShot
        key={shot.id}
        shot={{ ...shot, index }}
        expanded={expandedShotId === shot.id}
        onToggle={() => setExpandedShotId(current => current === shot.id ? null : shot.id)}
        onChange={(key, value) => updateShot(shot.id, key, value)}
      />) : <p className="ec-shared-shot-empty">方案生成后，这里会列出每张图片的职责和尺寸。</p>}
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
    <div className="ec-shared-plan-preview-header"><div><span className="ec-shared-plan-kicker">AI 设计方案</span><strong>整体设计规范</strong></div><span>{plan.shots.length || '待生成'} 张图片计划</span></div>
    <p className="ec-shared-plan-preview-brief">{plan.brief}</p>
    <div className="ec-shared-plan-preview-grid">{fields.map(([label, value]) => <div key={label}><b>{label}</b><span>{value}</span></div>)}</div>
    {plan.shots.length > 0 && <div className="ec-shared-plan-preview-shots">
      <div className="ec-shared-plan-preview-shots-title"><b>逐图计划</b><span>点击节点后可继续编辑</span></div>
      {plan.shots.map((shot, index) => <div key={shot.id}><i>{index + 1}</i><strong>{shot.title}</strong><span>{shot.dimension}</span></div>)}
    </div>}
  </div>;
}

export default EcommerceDesignPlanEditor;
