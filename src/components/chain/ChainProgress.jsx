// src/components/chain/ChainProgress.jsx
// 4c183cd4 续命 P-G 画布 1-click chain UI: 4 步实时进度条
// 纯展示组件, 不发请求. 由父组件 ChainOrchestrator 把 stepStatuses ['pending'|'ok'|'failed'] 喂进来.
// 跟 LongTaskProvider 心跳 overlay 互补 — 这是组件内嵌的"步骤状态条", 让用户看到 4 步真实映射.
//
// 用法:
//   <ChainProgress labels={['文案','首帧','视频','音轨+字幕']}
//                  statuses={['ok','ok','pending','pending']}
//                  activeIndex={2}
//                  failedIndex={null} />

import React from 'react';
import { Check, CircleAlert, Loader2, Circle } from 'lucide-react';

export function stepStatusLabel(status) {
  if (status === 'ok') return '已完成';
  if (status === 'failed') return '失败';
  if (status === 'active') return '进行中';
  return '待执行';
}

export function stepStatusIcon(status) {
  if (status === 'ok') return <Check size={14} />;
  if (status === 'failed') return <CircleAlert size={14} />;
  if (status === 'active') return <Loader2 size={14} className="chain-step-spin" />;
  return <Circle size={14} />;
}

// 把 statuses 推导出 activeIndex (第一个 'active'/'pending' 之前的最后 'ok')
// 若 statuses 全 ok 则 activeIndex = statuses.length-1 (全部完成)
// 若 statuses 含 failed, failedIndex 取第一个 failed 的位置
export function deriveProgressMeta(statuses) {
  const list = Array.isArray(statuses) ? statuses : [];
  let failedIndex = -1;
  for (let i = 0; i < list.length; i += 1) {
    if (list[i] === 'failed') { failedIndex = i; break; }
  }
  let activeIndex = -1;
  for (let i = 0; i < list.length; i += 1) {
    if (list[i] === 'active' || list[i] === 'pending') { activeIndex = i; break; }
  }
  if (activeIndex < 0) activeIndex = list.length - 1;
  return { failedIndex, activeIndex };
}

export default function ChainProgress({ labels, statuses, activeIndex: activeProp, failedIndex: failedProp, summaryByStep }) {
  const labelList = Array.isArray(labels) && labels.length ? labels : ['文案', '首帧', '视频', '音轨+字幕'];
  const statusList = Array.isArray(statuses) ? statuses : labelList.map(() => 'pending');
  const derived = deriveProgressMeta(statusList);
  const activeIndex = Number.isInteger(activeProp) ? activeProp : derived.activeIndex;
  const failedIndex = Number.isInteger(failedProp) ? failedProp : derived.failedIndex;
  const summary = summaryByStep && typeof summaryByStep === 'object' ? summaryByStep : {};

  return (
    <ol className="chain-progress" role="list" aria-label="链式生成 4 步进度">
      {labelList.map(function (label, i) {
        const status = statusList[i] || 'pending';
        const isActive = i === activeIndex && status !== 'ok' && status !== 'failed';
        const display = isActive ? 'active' : status;
        const cls = 'chain-step is-' + display + (i === failedIndex ? ' is-failed' : '');
        return (
          <li key={label + '-' + i} className={cls} role="listitem" aria-current={isActive ? 'step' : null}>
            <span className="chain-step-dot" aria-hidden="true">
              {stepStatusIcon(display)}
            </span>
            <span className="chain-step-meta">
              <strong className="chain-step-label">{label}</strong>
              <span className="chain-step-state">{stepStatusLabel(display)}</span>
              {summary[label] ? <span className="chain-step-summary">{summary[label]}</span> : null}
            </span>
            {i < labelList.length - 1 ? <span className="chain-step-rail" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
