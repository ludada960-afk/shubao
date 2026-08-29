// src/components/chain/ChainOrchestrator.jsx
// 4c183cd4 续命 P-G 画布 1-click chain UI: 4 步链式生成 (文案 -> 首帧 -> 视频 -> 音轨+字幕)
// 入口: 画布 mini-toolbar "链式生成" 按钮 (1 张参考图 + 1 句 prompt -> 多 Scene 视频)
//
// 设计要点:
// - 文案输入 (textarea) + 字幕风格下拉 + "开始链式生成" 按钮
// - 提交后 useState 维护本地 statuses ['active','pending','pending','pending'],
//   顺序用 setTimeout 50ms 模拟分步到达 (后端一次返回 4 步, 客户端渐进展示 4 步状态)
// - ChainProgress 实时显示 4 步状态
// - 完成/失败展示 chainId / cost / failedStep
// - 关闭面板 reset 回 idle 态
//
// 不引 React Query (项目不装), 用 useState + useCallback 即可.

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Sparkles, X, Loader2, CircleAlert, CheckCircle2 } from 'lucide-react';
import ChainProgress from './ChainProgress.jsx';
import {
  DEFAULT_CHAIN_INPUT,
  CHAIN_STEP_LABELS,
  executeChain,
  fetchChainCapabilities,
  normalizeChainResponse,
  stepSummary,
} from '../../services/chain.js';
import './chain.css';

const STEP_VISUAL_DELAY_MS = 380; // 每步到达动画延迟, 让用户肉眼看见推进

// 把后端一次性返回的 steps 数组, 按 index 顺序渐进 set 到本地 statuses
// 返回一个 cleanup 函数 (组件 unmount 时清掉所有 pending timeout)
function scheduleStepReveal(rawSteps, setter) {
  const timers = [];
  for (let i = 0; i < rawSteps.length; i += 1) {
    timers.push(setTimeout(function () {
      setter(function (prev) {
        const next = prev.slice();
        next[i] = rawSteps[i] && rawSteps[i].ok === false ? 'failed' : 'ok';
        return next;
      });
    }, STEP_VISUAL_DELAY_MS * (i + 1)));
  }
  return function cleanup() {
    for (let i = 0; i < timers.length; i += 1) clearTimeout(timers[i]);
  };
}

export default function ChainOrchestrator({ open, onClose, referenceImage = null, onComplete }) {
  const [text, setText] = useState('');
  const [subtitleStyle, setSubtitleStyle] = useState('simple');
  const [subtitleOptions, setSubtitleOptions] = useState([
    { key: 'simple', label: '极简白字' },
    { key: 'highlight', label: '关键词高亮' },
    { key: 'kinetic', label: '动态字弹' },
    { key: 'cinema', label: '电影底栏' },
    { key: 'reel', label: '短视频竖屏' },
  ]);
  const [phase, setPhase] = useState('idle'); // idle | running | done | error
  const [statuses, setStatuses] = useState(CHAIN_STEP_LABELS.map(function () { return 'pending'; }));
  const [activeIndex, setActiveIndex] = useState(-1);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [summaryByStep, setSummaryByStep] = useState({});
  const cleanupRef = useRef(null);

  // 懒加载 capabilities (字幕风格列表, 跟 W4 ttsBridge 5 档对齐)
  const refreshCapabilities = useCallback(function () {
    fetchChainCapabilities().then(function (cap) {
      if (cap && Array.isArray(cap.subtitleStyles) && cap.subtitleStyles.length) {
        setSubtitleOptions(cap.subtitleStyles);
      }
    }).catch(function () { /* silent: 用本地兜底 */ });
  }, []);

  // 组件首次 mount 拉一次 capabilities (open 切到 true 时)
  React.useEffect(function () {
    if (open) refreshCapabilities();
  }, [open, refreshCapabilities]);

  const trimmedText = text.trim();
  const canRun = phase === 'idle' || phase === 'done' || phase === 'error';
  const canSubmit = canRun && trimmedText.length > 0;

  const reset = useCallback(function () {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    setPhase('idle');
    setStatuses(CHAIN_STEP_LABELS.map(function () { return 'pending'; }));
    setActiveIndex(-1);
    setResult(null);
    setErrorMsg('');
    setSummaryByStep({});
  }, []);

  const handleClose = useCallback(function () {
    if (phase === 'running') return; // 跑中禁止关闭
    reset();
    if (typeof onClose === 'function') onClose();
  }, [phase, reset, onClose]);

  const handleRun = useCallback(function () {
    if (!canSubmit) return;
    if (cleanupRef.current) { cleanupRef.current(); }
    setPhase('running');
    setErrorMsg('');
    setResult(null);
    setSummaryByStep({});
    // 4 步全 pending → 把第 0 步立刻置 active, 其余 pending
    setStatuses(['active', 'pending', 'pending', 'pending']);
    setActiveIndex(0);

    executeChain({
      text: trimmedText,
      referenceImage: referenceImage || null,
      subtitleStyle: subtitleStyle || 'simple',
    }).then(function (payload) {
      const normalized = normalizeChainResponse(payload);
      const raw = (normalized.raw && normalized.raw.steps) || [];
      setResult(normalized);
      const summary = {};
      for (let i = 0; i < raw.length; i += 1) {
        const label = normalized.stepLabels[i] || CHAIN_STEP_LABELS[i];
        summary[label] = stepSummary(raw[i]);
      }
      setSummaryByStep(summary);
      cleanupRef.current = scheduleStepReveal(raw, setStatuses);
      // 全部 reveal 完 (raw.length 步) 之后切到 done
      const finalizeMs = STEP_VISUAL_DELAY_MS * (raw.length + 1) + 50;
      setTimeout(function () {
        setPhase(normalized.ok ? 'done' : 'error');
        setActiveIndex(-1);
        if (typeof onComplete === 'function') onComplete(normalized);
      }, finalizeMs);
    }).catch(function (e) {
      setErrorMsg((e && e.message) || '链式生成失败');
      setStatuses(['failed', 'pending', 'pending', 'pending']);
      setActiveIndex(-1);
      setPhase('error');
    });
  }, [canSubmit, trimmedText, referenceImage, subtitleStyle, onComplete]);

  const phaseBadge = useMemo(function () {
    if (phase === 'running') return <span className="chain-phase-badge is-running"><Loader2 size={12} className="chain-step-spin" /> 链式生成中</span>;
    if (phase === 'done') return <span className="chain-phase-badge is-done"><CheckCircle2 size={12} /> 已完成</span>;
    if (phase === 'error') return <span className="chain-phase-badge is-error"><CircleAlert size={12} /> 失败</span>;
    return <span className="chain-phase-badge is-idle">待开始</span>;
  }, [phase]);

  if (!open) return null;

  return (
    <div className="chain-orchestrator" role="dialog" aria-modal="true" aria-label="链式生成 4 步面板">
      <header className="chain-orchestrator-head">
        <h3><Sparkles size={16} /> 链式生成 · 1 句 prompt → 多 Scene 视频</h3>
        {phaseBadge}
        <button type="button" className="chain-close" aria-label="关闭" onClick={handleClose} disabled={phase === 'running'}><X size={16} /></button>
      </header>

      <div className="chain-orchestrator-body">
        <label className="chain-field">
          <span>视频描述 (prompt)</span>
          <textarea
            value={text}
            onChange={function (e) { setText(e.target.value); }}
            placeholder="例如: 夏日海边咖啡馆 30 秒治愈短片"
            rows={3}
            maxLength={500}
            disabled={phase === 'running'}
            aria-label="链式生成文案输入"
          />
          <small className="chain-hint">建议 1 句话讲清场景 + 情绪 + 受众。{trimmedText.length}/500</small>
        </label>

        <div className="chain-row">
          <label className="chain-field">
            <span>字幕风格</span>
            <select
              value={subtitleStyle}
              onChange={function (e) { setSubtitleStyle(e.target.value); }}
              disabled={phase === 'running'}
              aria-label="字幕风格"
            >
              {subtitleOptions.map(function (opt) {
                return <option key={opt.key} value={opt.key}>{opt.label}</option>;
              })}
            </select>
          </label>
          {referenceImage ? (
            <div className="chain-ref" role="status">
              <span className="chain-ref-label">参考图:</span>
              <img src={referenceImage} alt="参考图" />
              <small>已带入首帧驱动</small>
            </div>
          ) : (
            <div className="chain-ref is-empty" role="status">
              <span className="chain-ref-label">参考图:</span>
              <small>未选 (将用纯 prompt 派生)</small>
            </div>
          )}
        </div>

        <ChainProgress
          labels={CHAIN_STEP_LABELS}
          statuses={statuses}
          activeIndex={activeIndex}
          summaryByStep={summaryByStep}
        />

        {errorMsg ? <p className="chain-error" role="alert"><CircleAlert size={14} /> {errorMsg}</p> : null}

        {result && phase === 'done' ? (
          <div className="chain-result" role="status">
            <strong>链 ID: {result.chainId || 'pending'}</strong>
            <span>成本: ¥{result.totalCost.toFixed(4)} · 理论: ¥{result.theoreticalPrice.toFixed(4)} · 毛利 {(result.margin * 100).toFixed(1)}%</span>
            <span className={'chain-health is-' + result.health}>{result.health === 'ok' ? '毛利健康' : result.health === 'risk' ? '部分失败' : '毛利告警'}</span>
          </div>
        ) : null}
      </div>

      <footer className="chain-orchestrator-foot">
        <button type="button" className="chain-secondary" onClick={handleClose} disabled={phase === 'running'}>关闭</button>
        <button type="button" className="chain-primary" onClick={handleRun} disabled={!canSubmit}>
          {phase === 'running' ? <><Loader2 size={14} className="chain-step-spin" /> 生成中…</> : <><Sparkles size={14} /> 开始链式生成</>}
        </button>
      </footer>
    </div>
  );
}

// 默认链输入, 供父组件 (VideoCanvasWorkbench) 复用
export { DEFAULT_CHAIN_INPUT, CHAIN_STEP_LABELS };
