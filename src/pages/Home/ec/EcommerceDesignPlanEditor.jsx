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

const PRIMARY_SHOT_FIELD_KEYS = new Set(['objective', 'scene', 'composition', 'contentElements', 'copy']);

function ShotField({ field, shot, onChange }) {
  const primary = PRIMARY_SHOT_FIELD_KEYS.has(field.key);
  return <label className={`ec-shared-shot-field ${primary ? 'ec-shared-shot-field--primary' : 'ec-shared-shot-field--shared'}`}>
    <span>{field.label}</span>
    <textarea
      data-suite-shot-detail-field={`${shot.id}-${field.key}`}
      value={shot[field.key] || ''}
      onChange={event => onChange(field.key, event.target.value)}
      aria-label={`编辑${shot.title}的${field.label}`}
    />
  </label>;
}

function PlanSpecField({ field, plan, onChange }) {
  return <label className="ec-plan-spec-field">
    <span>{field.label}</span>
    <textarea
      data-suite-plan-field={field.key}
      value={plan[field.key] || ''}
      onChange={event => onChange(field.key, event.target.value)}
      aria-label={`编辑${field.label}`}
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
      <section className="ec-shared-shot-spec" aria-label={`${shot.title}生成规格`}>
        <div className="ec-shared-shot-spec-heading">
          <div><span>本图重点</span><p>优先调整高亮字段，决定这张图的主题、场景、镜头与信息表达。</p></div>
          <p>商品还原与生成约束会作为整套一致性规则一并传入。</p>
        </div>
        <div className="ec-shared-shot-detail-grid">
          {CANVAS_SUITE_SHOT_FIELDS.map(field => <ShotField key={field.key} field={field} shot={shot} onChange={onChange} />)}
        </div>
      </section>
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
    <section className="ec-plan-overview" aria-label="整体规划">
      <header className="ec-shared-plan-heading">
        <div><h3>整体规划</h3><p>统一整套图片的商品表达、视觉规则与文案方向。</p></div>
        <span className="ec-shared-plan-state"><Check size={14} />可编辑</span>
      </header>
      <label className="ec-shared-plan-brief">
        <span>核心叙事</span>
        <textarea data-suite-plan-field="brief" value={plan.brief || ''} onChange={event => onChange?.({ ...plan, brief: event.target.value.slice(0, 1800) })} aria-label="编辑整套执行思路" />
      </label>
      <section className="ec-plan-specification" aria-label="整套生成规格">
        <div className="ec-shared-plan-grid">
          {CANVAS_SUITE_PLAN_FIELDS.map(field => <PlanSpecField key={field.key} field={field} plan={plan} onChange={updateField} />)}
        </div>
      </section>
    </section>
    <section className="ec-shared-shot-plan" aria-label="逐张规划">
      <div className="ec-shared-shot-heading">
        <div><h3>逐张规划</h3><p>展开图片，直接调整它的主题、场景、镜头与信息表达。</p></div>
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
