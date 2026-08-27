/**
 * LongTaskOverlay — V4 P0-3 (D2) 长任务全屏进度条覆盖层
 *
 * 视觉:
 * - 固定全屏, z-index 1500 (在 NoteModal 9998 之上, 电商全屏 loading 9999 之下)
 * - 玻璃感 backdrop-filter blur + 半透明深色底
 * - 顶部 4px 进度条 0% → 100%, 平滑 ease-out
 * - 中央卡: LoaderCircle spinner + 任务名 + 当前步骤 + 百分比
 * - 禁止点击穿透 (pointer-events: auto), 防止用户误触画布
 *
 * 调用:
 *   import { LongTaskOverlay } from './components/ui/LongTaskOverlay';
 *   <LongTaskOverlay />  // 在 App.jsx 渲染一次即可
 *
 * 注意:
 * - 由 LongTaskProvider 注入 state, 此组件只读不写
 * - activeCount === 0 时返回 null, 不渲染 DOM
 */
import React from 'react';
import { LoaderCircle } from 'lucide-react';
import { useLongTask } from './LongTaskProvider.jsx';
import './LongTaskOverlay.css';

export function LongTaskOverlay() {
  const { displayTask, activeCount } = useLongTask();
  if (!displayTask) return null;

  const { title, stage, progress, totalSteps } = displayTask;
  const percent = Math.round(progress || 0);

  return (
    <div
      className="long-task-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`长任务: ${title}, 当前 ${percent}%`}
      data-testid="long-task-overlay"
      data-active-count={activeCount}
    >
      <div className="long-task-overlay-progress" aria-hidden="true">
        <div
          className="long-task-overlay-progress-bar"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="long-task-overlay-card">
        <LoaderCircle size={28} className="long-task-overlay-spinner is-spinning" />
        <h2 className="long-task-overlay-title">{title}</h2>
        {stage ? <p className="long-task-overlay-stage">{stage}</p> : null}
        <p className="long-task-overlay-percent" data-testid="long-task-overlay-percent">
          {percent}%<span className="long-task-overlay-sep"> · </span>
          <span className="long-task-overlay-total-steps">
            {totalSteps > 1 ? `${Math.max(1, Math.ceil((percent / 100) * totalSteps))} / ${totalSteps}` : '进行中'}
          </span>
        </p>
      </div>
    </div>
  );
}

export default LongTaskOverlay;
