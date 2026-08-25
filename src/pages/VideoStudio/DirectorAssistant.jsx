import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight, CircleAlert, LoaderCircle, Play, Sparkles } from 'lucide-react';
import {
  completeVideoSkillRunStep,
  confirmVideoSkillCheckpoint,
  previewVideoSkillRun,
  previewVideoSkillTemplate,
} from '../../services/videoWorkbench.js';

/**
 * VID-R5: director assistant pane. Implements the H3-style intake gate:
 * one lightweight form collects the required inputs before any step runs,
 * then each step exposes approve/advance actions instead of silent progress.
 */
export default function DirectorAssistant({ projectId, templates = [], runs = [], onRefresh, onError }) {
  const latestRun = runs[0] || null;
  const [expandedId, setExpandedId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [specPreview, setSpecPreview] = useState(null);
  const [previewRun, setPreviewRun] = useState(null);
  const [busy, setBusy] = useState('');
  const [localError, setLocalError] = useState('');

  const guard = async (key, action) => {
    if (busy) return;
    setBusy(key);
    setLocalError('');
    try { await action(); } catch (cause) {
      const message = cause?.message || '操作失败';
      setLocalError(message); onError?.(message);
    } finally { setBusy(''); }
  };

  const handlePreview = template => guard(`preview:${template.templateId}`, async () => {
    if (!prompt.trim()) throw new Error('启动问询：请先填写一句话创意（prompt 必填）');
    const input = negativePrompt.trim() ? { prompt: prompt.trim(), negativePrompt: negativePrompt.trim() } : { prompt: prompt.trim() };
    const run = await previewVideoSkillTemplate(projectId, template.templateId, input);
    setSpecPreview(run);
    setPreviewRun(null);
  });

  const handleStart = () => guard('start', async () => {
    if (!specPreview?.spec) throw new Error('请先预览运行方案');
    await previewVideoSkillRun(projectId, specPreview.spec);
    setPreviewRun(specPreview);
    setSpecPreview(null);
    await onRefresh?.();
  });

  const handleCompleteStep = stepId => guard(`step:${stepId}`, async () => {
    await completeVideoSkillRunStep(projectId, latestRun.id, stepId, latestRun.revision);
    await onRefresh?.();
  });

  const handleConfirmCheckpoint = checkpointId => guard(`cp:${checkpointId}`, async () => {
    await confirmVideoSkillCheckpoint(projectId, latestRun.id, checkpointId, latestRun.revision);
    await onRefresh?.();
  });

  const plan = latestRun?.plan || {};
  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  const checkpoints = Array.isArray(plan.checkpoints) ? plan.checkpoints : [];
  const executionPlan = latestRun?.executionPlan || { completedStepIds: [], readyStepIds: [], blockedStepIds: [], status: '' };

  return (
    <div className="dw-assistant-body">
      <ul className="dw-template-list">
        {templates.map(template => (
          <li key={template.templateId}>
            <button type="button" className="dw-template-toggle" onClick={() => setExpandedId(current => (current === template.templateId ? '' : template.templateId))}>
              {expandedId === template.templateId ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <strong>{template.title}</strong>
            </button>
            {expandedId === template.templateId && (
              <div className="dw-intake">
                <p className="dw-intake-semantics">{template.inputContract?.semantics}</p>
                <label className="dw-field dw-field-wide">
                  <span>一句话创意（必填）</span>
                  <textarea rows={2} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="例：秋季新品口红，模特拿起走向窗边，特写膏体光泽" />
                </label>
                <label className="dw-field dw-field-wide">
                  <span>负向提示（可选）</span>
                  <input value={negativePrompt} onChange={event => setNegativePrompt(event.target.value)} placeholder="不要多余手指，不要漂浮物" />
                </label>
                <button type="button" className="dw-check-btn" disabled={busy.startsWith('preview')} onClick={() => void handlePreview(template)}>
                  <Sparkles size={12} /> {busy.startsWith('preview') ? '生成中…' : '① 预览运行方案'}
                </button>
                {specPreview && specPreview.templateId === template.templateId && (
                  <div className="dw-spec-preview">
                    <ol>{(specPreview.plan?.steps || []).map(step => <li key={step.id}>{step.label}</li>)}</ol>
                    <button type="button" className="dw-save-btn" disabled={busy === 'start'} onClick={() => void handleStart()}>
                      <Play size={12} /> {busy === 'start' ? '启动中…' : '② 启动运行（规划模式不扣费）'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {latestRun && (
        <div className="dw-run-card">
          <h4><CircleAlert size={0} style={{ display: 'none' }} />运行 {latestRun.templateId || latestRun.skillId} · {latestRun.status}</h4>
          <ol className="dw-run-steps">
            {steps.map(step => {
              const done = executionPlan.completedStepIds.includes(step.id);
              const ready = executionPlan.readyStepIds.includes(step.id);
              return (
                <li key={step.id} className={done ? 'is-done' : ready ? 'is-ready' : 'is-blocked'}>
                  <span className="dw-step-state">{done ? '✓' : ready ? '▶' : '…'}</span>
                  <span className="dw-step-label">{step.label}</span>
                  {ready && !done && (
                    <button type="button" className="dw-lock-btn" disabled={!!busy} onClick={() => void handleCompleteStep(step.id)}>
                      {busy === `step:${step.id}` ? <LoaderCircle size={11} className="dw-spin" /> : <Check size={11} />} 完成
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          {checkpoints.map(cp => {
            const confirmed = latestRun.confirmedCheckpointIds.includes(cp.id);
            return (
              <div key={cp.id} className="dw-checkpoint">
                <span>{confirmed ? '✅' : '⏸'} {cp.label}</span>
                {!confirmed && (
                  <button type="button" className="dw-lock-btn is-locked" disabled={!!busy} onClick={() => void handleConfirmCheckpoint(cp.id)}>
                    批准并继续
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {localError && <p className="dw-error dw-assistant-error"><CircleAlert size={12} /> {localError}</p>}
    </div>
  );
}
