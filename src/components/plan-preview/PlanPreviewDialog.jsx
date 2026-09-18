import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  PLAN_PREVIEW_SKU,
  composePlanPreview,
  fetchPlanPreviewBalance,
  fetchPlanPreviewOptions,
  planPreviewActionId,
  quotePlanPreview,
} from '../../services/planPreview.js';
import './plan-preview.css';

/* ═══ 三步方案预览（批 K-C 图片侧「预览」/ 批 K-D 视频侧「代为撰写」）══════════════════════
   用户第 16 轮原话：「这两套东西**本质上都是一个设计方案**，只是在它里面**有不同的入口**。」
   ⇒ 所以这里是**一份组件、两个入口**（图片侧从配置面板的「预览」进，视频侧从提示词框旁进），
     只有文案不同（用户明说「文案表述可以不一样」），逻辑与布局完全一致。

   抄的是知渔「代为撰写」（docs/design/61-quantv-dawei-chuanxie.md）：
     ① 素材理解（**可编辑**，用户能纠偏）② 方向与偏好（三维档位）③ 方案预览（可改、确认后应用）
     点之前先弹计费确认（他们的弹窗原文：立即「代为撰写」/ 预计消耗积分 / 计费明细 /
     「实际扣费以任务成功结果为准，失败不扣对应项积分。」/ [取消][继续生成]）。

   ⚠️ 价格：**0.5 积分 / 次**，一次一个数（不按张、不按步叠加）—— 用户第 16 轮把定价权交给我时定的口径。 */

const COPY = {
  video: {
    entry: '代为撰写',
    confirmTitle: '立即「代为撰写」',
    steps: [
      { title: '分析素材', hint: '分析素材内容' },
      { title: '创作脚本', hint: '选择创作方向与脚本偏好' },
      { title: '预览脚本', hint: '确认脚本并应用' },
    ],
    loadingTitle: '正在分析素材',
    loadingHint: '正在分析上传图片并提炼商品洞察',
    loadingPool: ['正在提炼商品卖点和使用场景', '正在拆解画面里的关键信息', '正在识别素材中的主体与场景', '正在生成可转化为脚本的创意方向'],
    apply: '确认脚本并应用',
    detailName: '方案预览（素材理解 + 方向偏好 + 脚本生成）',
  },
  image: {
    entry: '生成预览',
    confirmTitle: '立即「生成预览」',
    steps: [
      { title: '素材理解', hint: '读懂每张素材' },
      { title: '方向与偏好', hint: '选择画面方向' },
      { title: '方案预览', hint: '确认方案并应用' },
    ],
    loadingTitle: '正在理解素材',
    loadingHint: '正在读你上传的图片并提炼画面要点',
    loadingPool: ['正在提炼商品卖点和使用场景', '正在拆解画面里的关键信息', '正在识别素材中的主体与场景', '正在生成可用的画面方向'],
    apply: '确认方案并应用',
    detailName: '方案预览（素材理解 + 方向偏好 + 方案生成）',
  },
};

function copyOf(surface) {
  return COPY[surface === 'video' ? 'video' : 'image'];
}

export default function PlanPreviewDialog({
  open,
  surface = 'image',
  skillName = '',
  prompt = '',
  materials = [],
  onClose,
  onApply,
  /* ⚠️ 降级出口：模型不可用时方案正文是空的，「确认并应用」按不了 ——
     不给出口就是一个**死胡同**（用户既没拿到方案、也走不到生成）。
     这一条实测踩到过：e2e 走到这里卡住，才发现对话框把主流程堵死了。
     跳过 = 不应用任何方案、直接回到原来的生成路径（没扣费，也没什么可应用的）。 */
  onSkip,
}) {
  const copy = copyOf(surface);
  const [stage, setStage] = useState('confirm');
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState(null);
  const [understanding, setUnderstanding] = useState([]);
  const [direction, setDirection] = useState({});
  const [dimensions, setDimensions] = useState([]);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const runningRef = useRef(false);

  const materialKey = useMemo(
    () => (materials || []).map(item => String(item?.id || item?.name || '')).join('|'),
    [materials],
  );

  useEffect(() => {
    if (!open) return undefined;
    setStage('confirm');
    setStep(0);
    setPlan(null);
    setError('');
    setUnderstanding((materials || []).slice(0, 6).map((item, index) => ({
      id: String(item?.id || 'material-' + (index + 1)),
      name: String(item?.name || '素材 ' + (index + 1)),
      understanding: '',
    })));
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, materialKey]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    fetchPlanPreviewOptions(surface).then(data => {
      if (!cancelled) setDimensions(Array.isArray(data?.directions) ? data.directions : []);
    }).catch(() => { if (!cancelled) setDimensions([]); });
    fetchPlanPreviewBalance().then(value => { if (!cancelled) setBalance(value); }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, surface]);

  useEffect(() => {
    if (stage !== 'running') return undefined;
    const timer = setInterval(() => setTick(value => value + 1), 2600);
    return () => clearInterval(timer);
  }, [stage]);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStage('running');
    setError('');
    try {
      const quote = await quotePlanPreview();
      const payload = {
        surface,
        skillName,
        prompt,
        direction,
        materials: (materials || []).slice(0, 6).map((item, index) => ({
          id: String(item?.id || 'material-' + (index + 1)),
          name: String(item?.name || '素材 ' + (index + 1)),
          url: String(item?.url || ''),
        })),
        billingQuoteId: quote?.quoteId,
        billingActionId: planPreviewActionId({ surface, skillName, prompt, direction, materials }),
      };
      const result = await composePlanPreview(payload);
      const composed = result?.plan || {};
      setPlan(composed);
      if (Array.isArray(composed.materials) && composed.materials.length) setUnderstanding(composed.materials);
      setStep(0);
      setStage('ready');
    } catch (failure) {
      setError(failure?.message || '方案预览失败，请稍后重试（失败不扣积分）。');
      setStage('confirm');
    } finally {
      runningRef.current = false;
    }
  }, [surface, skillName, prompt, direction, materials]);

  if (!open) return null;

  const patchUnderstanding = (index, value) => {
    setUnderstanding(current => current.map((item, position) => (
      position === index ? { ...item, understanding: value } : item
    )));
  };
  const pick = (key, value) => setDirection(current => ({ ...current, [key]: current[key] === value ? '' : value }));
  const planText = plan?.plan?.promptText || '';
  const setPlanText = value => setPlan(current => (current ? { ...current, plan: { ...current.plan, promptText: value } } : current));

  return (
    <div className="plan-preview-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section className="plan-preview-card" role="dialog" aria-modal="true" aria-label={copy.entry}>
        <header className="plan-preview-head">
          <strong>{stage === 'confirm' ? copy.confirmTitle : copy.entry}</strong>
          <button type="button" className="plan-preview-close" aria-label="关闭" onClick={onClose}>×</button>
        </header>

        {stage === 'confirm' && (
          <div className="plan-preview-confirm">
            <div className="plan-preview-cost">
              <div><span>预计消耗积分</span><strong>≈ 0.5 积分</strong></div>
              <div><span>当前可用积分</span><strong>{balance === null ? '—' : balance + ' 积分'}</strong></div>
            </div>
            <div className="plan-preview-detail">
              <p>计费明细</p>
              <ol>
                <li><span>1</span><b>{copy.detailName}</b><em>0.5 积分 / 次</em></li>
              </ol>
            </div>
            <p className="plan-preview-note">实际扣费以方案生成为准，失败不扣积分。素材数量不额外累加。</p>
            {error && <p className="plan-preview-error" role="alert">{error}</p>}
            <footer className="plan-preview-actions">
              <button type="button" className="plan-preview-btn" onClick={onClose}>取消</button>
              <button type="button" className="plan-preview-btn is-primary" onClick={run}>继续生成</button>
            </footer>
          </div>
        )}

        {stage === 'running' && (
          <div className="plan-preview-running" role="status">
            <span className="plan-preview-ring" aria-hidden />
            <strong>{copy.loadingTitle}</strong>
            <small>{tick % 2 === 0 ? copy.loadingHint : copy.loadingPool[tick % copy.loadingPool.length]}</small>
          </div>
        )}

        {stage === 'ready' && (
          <>
            <ol className="plan-preview-steps">
              {copy.steps.map((item, index) => (
                <li key={item.title} className={index === step ? 'is-active' : (index < step ? 'is-done' : '')}>
                  <span>{index < step ? '✓' : index + 1}</span>
                  <b>{item.title}</b>
                  <small>{item.hint}</small>
                </li>
              ))}
            </ol>

            <div className="plan-preview-body">
              {step === 0 && (
                <div className="plan-preview-materials">
                  <p className="plan-preview-body-title">{plan?.degraded ? '素材还没分析成功' : '素材理解完成，可直接修改'}</p>
                  {understanding.length === 0 && <p className="plan-preview-empty">这次没有上传素材，可以直接看方案。</p>}
                  {understanding.map((item, index) => (
                    <label className="plan-preview-material" key={item.id + '-' + index}>
                      {materials[index]?.previewUrl || materials[index]?.url
                        ? <img src={materials[index].previewUrl || materials[index].url} alt="" />
                        : <span className="plan-preview-material-blank" aria-hidden />}
                      <textarea
                        value={item.understanding}
                        placeholder={'素材 ' + (index + 1) + ' 的理解（可以改成你要的意思）'}
                        onChange={event => patchUnderstanding(index, event.target.value)}
                      />
                    </label>
                  ))}
                  {plan?.degraded && <p className="plan-preview-error" role="alert">{plan.reason || '分析模型暂不可用'}（失败不扣积分）</p>}
                </div>
              )}

              {step === 1 && (
                <div className="plan-preview-directions">
                  {dimensions.map(dimension => (
                    <div className="plan-preview-direction" key={dimension.key}>
                      <p className="plan-preview-body-title">{dimension.label}</p>
                      <div className="plan-preview-options">
                        {dimension.options.map(option => (
                          <button
                            key={option.value}
                            type="button"
                            className={direction[dimension.key] === option.value ? 'is-selected' : ''}
                            onClick={() => pick(dimension.key, option.value)}
                          >{option.label}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {dimensions.length === 0 && <p className="plan-preview-empty">方向选项读取中，稍后重试。</p>}
                </div>
              )}

              {step === 2 && (
                <div className="plan-preview-plan">
                  <p className="plan-preview-body-title">{plan?.plan?.title || copy.steps[2].title}</p>
                  {plan?.plan?.summary && <p className="plan-preview-summary">{plan.plan.summary}</p>}
                  {Array.isArray(plan?.plan?.steps) && plan.plan.steps.length > 0 && (
                    <ol className="plan-preview-outline">
                      {plan.plan.steps.map(item => (
                        <li key={item.index}><b>{item.title}</b>{item.detail ? <span>{item.detail}</span> : null}</li>
                      ))}
                    </ol>
                  )}
                  <textarea
                    className="plan-preview-text"
                    value={planText}
                    placeholder="方案正文（可以直接改，改完再应用）"
                    onChange={event => setPlanText(event.target.value)}
                  />
                  {Array.isArray(plan?.plan?.notes) && plan.plan.notes.length > 0 && (
                    <ul className="plan-preview-notes">
                      {plan.plan.notes.map(note => <li key={note}>{note}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <footer className="plan-preview-actions">
              <button type="button" className="plan-preview-btn" onClick={() => (step === 0 ? onClose?.() : setStep(step - 1))}>
                {step === 0 ? '取消' : '上一步'}
              </button>
              <button type="button" className="plan-preview-btn" onClick={() => { setStage('confirm'); setError(''); }}>
                重新生成方案
              </button>
              {step < 2
                ? <button type="button" className="plan-preview-btn is-primary" onClick={() => setStep(step + 1)}>下一步</button>
                : (plan?.degraded
                  ? <button type="button" className="plan-preview-btn is-primary" onClick={() => onSkip?.()}>跳过方案，直接生成</button>
                  : (
                    <button
                      type="button"
                      className="plan-preview-btn is-primary"
                      disabled={!String(planText || '').trim()}
                      onClick={() => onApply?.(String(planText || '').trim(), plan)}
                    >{copy.apply}</button>
                  ))}
            </footer>
          </>
        )}
      </section>
    </div>
  );
}

export { PLAN_PREVIEW_SKU };
