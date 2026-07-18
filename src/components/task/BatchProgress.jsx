/**
 * 批量生图进度区
 *
 * 双层进度展示：
 * - 总进度条（10/20 张完成）
 * - 单张进度（当前第 N 张生成进度）
 * - 批量控制按钮
 */

import React from 'react';
import { Loader, CheckCircle, AlertCircle, X, RotateCcw, Pause, Play } from 'lucide-react';

export default function BatchProgress({ task, onRetry, onCancel, onPause, onResume }) {
  const { progress, status, stage } = task;
  const total = progress?.total || 0;
  const done = progress?.done || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isActive = status === 'generating';
  const isPaused = status === 'paused';
  const isDone = status === 'done';
  const isError = status === 'error';

  if (total === 0) return null;

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>
        🖼️ 批量生图
      </div>

      {/* 总进度 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            总进度
          </span>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: isDone ? '#5CA86C' : isError ? 'var(--red)' : 'var(--accent)',
          }}>
            {done}/{total} 张 ({pct}%)
          </span>
        </div>
        <div style={{
          height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.06)', overflow: 'hidden',
          position: 'relative',
        }}>
          <div style={{
            height: '100%', borderRadius: 4, transition: 'width 0.3s',
            background: isDone ? 'linear-gradient(90deg, #5CA86C, #7CCF8C)' :
                       isError ? 'var(--red)' :
                       'linear-gradient(90deg, var(--accent), #555)',
            width: `${pct}%`,
          }} />
        </div>
      </div>

      {/* 当前生成信息 */}
      {isActive && (
        <div style={{
          padding: '8px 12px', borderRadius: 8,
          background: 'rgba(245,158,11,0.06)',
          marginBottom: 12, fontSize: 11, color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}>
          <span style={{ fontWeight: 600 }}>正在生成</span>
          <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
            第 {done + 1} 张 / 共 {total} 张
          </span>
          {stage && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{stage}</div>}
        </div>
      )}

      {/* 完成信息 */}
      {isDone && (
        <div style={{
          padding: '8px 12px', borderRadius: 8,
          background: 'rgba(92,168,108,0.06)',
          marginBottom: 12, fontSize: 11, color: '#5CA86C', fontWeight: 600,
        }}>
          ✅ {total} 张全部生成完成
        </div>
      )}

      {/* 错误信息 */}
      {isError && task.error && (
        <div style={{
          padding: '8px 12px', borderRadius: 8,
          background: '#FEF2F0', marginBottom: 12,
          fontSize: 11, color: 'var(--red)', lineHeight: 1.5, fontWeight: 500,
        }}>
          {task.error}
        </div>
      )}

      {/* 控制按钮 */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {isActive && (
          <ControlBtn icon={<Pause size={13} />} label="暂停" onClick={onPause} />
        )}
        {isPaused && (
          <ControlBtn icon={<Play size={13} />} label="继续" onClick={onResume} />
        )}
        {isError && (
          <ControlBtn icon={<RotateCcw size={13} />} label="重试" onClick={onRetry} primary />
        )}
        {(isActive || isPaused) && (
          <ControlBtn icon={<X size={13} />} label="终止" onClick={onCancel} danger />
        )}
        {isDone && (
          <ControlBtn icon={<X size={13} />} label="清除" onClick={onCancel} />
        )}
      </div>
    </div>
  );
}

function ControlBtn({ icon, label, onClick, primary, danger }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        height: 30, padding: '0 10px', borderRadius: 8,
        border: 'none',
        background: primary ? 'var(--accent)' : danger ? '#FEF2F0' : 'rgba(0,0,0,0.04)',
        color: primary ? '#fff' : danger ? 'var(--red)' : 'var(--text-secondary)',
        fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
      {icon} {label}
    </button>
  );
}
