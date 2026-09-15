/**
 * 薯包AI 可折叠生图弹窗
 *
 * 融合灵图AI 精细化进度 + 椒图AI 任务常驻交互：
 * - 主动唤起、可随时折叠、不阻塞主页面
 * - 读图解析进度（5 阶段）
 * - 批量生图进度（双层进度条）
 * - 折叠后进程常驻左侧任务栏
 */

import React from 'react';
import { MdClose, MdFullscreenExit, MdFullscreen, MdAutoAwesome } from 'react-icons/md';
import { useTasks } from '../../store/taskStore';
import ReadProgress from './ReadProgress';
import BatchProgress from './BatchProgress';

export default function GenModal({ activeTaskId, onClose, onMinimize }) {
  const { tasks, retryTask, removeTask, updateTask } = useTasks();
  const task = activeTaskId ? tasks.find(t => t.id === activeTaskId) : null;

  if (!task) return null;

  const isActive = ['reading', 'parsing', 'generating'].includes(task.status);

  return (
    <div style={{
      position: 'fixed', bottom: 0, right: 0,
      zIndex: 'var(--sb-z-panel)',
      width: 380, maxHeight: 'calc(100vh - 80px)',
      background: 'var(--sb-neutral-0)', borderRadius: '16px 0 0 0',
      boxShadow: '-4px 0 24px rgba(12,10,9,0.08), 0 -4px 24px rgba(12,10,9,0.06)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      animation: 'fadeUp 0.2s ease',
    }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: '1px solid var(--sb-border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--sb-radius-lg)',
            background: isActive ? 'rgba(245,158,11,0.12)' :
                        task.status === 'done' ? 'rgba(92,168,108,0.12)' : 'rgba(12,10,9,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <MdAutoAwesome size={16} color={isActive ? 'var(--sb-warning)' : task.status === 'done' ? 'var(--sb-success)' : 'var(--sb-ink-3)'}
              className={isActive ? 'animate-spin' : ''} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sb-ink-1)' }}>
              {task.type === 'ec' ? '电商生图' : '小红书图文'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--sb-ink-5)', fontWeight: 500 }}>
              {task.stage || (STATUS_LABELS[task.status] || task.status)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onMinimize}
            style={{
              width: 30, height: 30, borderRadius: 8, border: 'none',
              background: 'transparent', color: 'var(--sb-ink-3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(12,10,9,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <MdFullscreenExit size={14} />
          </button>
          <button onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8, border: 'none',
              background: 'transparent', color: 'var(--sb-ink-3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(12,10,9,0.04)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <MdClose size={14} />
          </button>
        </div>
      </div>

      {/* 内容区 */}
      <div style={{
        flex: 1, overflow: 'auto', padding: '0 16px',
        scrollbarWidth: 'thin',
      }}>
        {/* 读图解析进度 */}
        {(task.status === 'queued' || task.status === 'reading' || task.status === 'parsing') && (
          <ReadProgress
            currentStage={task.status === 'reading' ? 'uploading' : task.status === 'parsing' ? 'style_analysis' : 'uploading'}
            error={task.status === 'error' ? task.error : null}
          />
        )}

        {/* 批量生图进度 */}
        {(task.status === 'generating' || task.status === 'done' || task.status === 'error') && (
          <BatchProgress
            task={task}
            onRetry={() => retryTask(task.id)}
            onCancel={() => removeTask(task.id)}
          />
        )}

        {/* 队列等待 */}
        {task.status === 'queued' && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--sb-text-3xl)', marginBottom: 8, opacity: 0.4 }}>⏳</div>
            <div style={{ fontSize: 'var(--sb-text-md)', fontWeight: 600, color: 'var(--sb-ink-2)' }}>排队等待中</div>
            <div style={{ fontSize: 'var(--sb-text-xs)', color: 'var(--sb-ink-5)', marginTop: 4 }}>
              前面还有任务，请稍候…
            </div>
          </div>
        )}
      </div>

      {/* 底部提示 */}
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--sb-border-subtle)',
        fontSize: 10, color: 'var(--sb-ink-5)', textAlign: 'center',
        fontWeight: 500,
      }}>
        生图进程持续后台运行，可随时折叠或关闭
      </div>
    </div>
  );
}

const STATUS_LABELS = {
  queued: '排队中',
  reading: '读图解析中…',
  parsing: '参数适配中…',
  generating: '生成中…',
  done: '已完成',
  error: '生成失败',
};
