import React, { useEffect, useRef, useState } from 'react';
import {
  MdAutoAwesome,
  MdCheckCircle,
  MdClose,
  MdError,
  MdHourglassTop,
  MdOutlineFactCheck,
  MdSchedule,
} from 'react-icons/md';
import { useTasks } from '../../store/taskStore';
import { quoteFailedEcommerceTask, retryFailedEcommerceTask } from '../../services/api.js';
import { useDialog } from '../ui/DialogProvider.jsx';

const STATUS_META = {
  queued: { icon: MdSchedule, color: '#7c746d', label: '排队中' },
  analyzing: { icon: MdOutlineFactCheck, color: '#4778c7', label: '正在分析商品' },
  reading: { icon: MdOutlineFactCheck, color: '#4778c7', label: '正在分析商品' },
  parsing: { icon: MdOutlineFactCheck, color: '#6b5fc7', label: '正在准备方案' },
  generating: { icon: MdAutoAwesome, color: '#c97728', label: '正在生成' },
  completed: { icon: MdCheckCircle, color: '#3f8a5d', label: '已完成' },
  done: { icon: MdCheckCircle, color: '#3f8a5d', label: '已完成' },
  needs_review: { icon: MdError, color: '#bd7026', label: '整套未完成' },
  failed: { icon: MdError, color: '#c34f49', label: '生成未完成' },
  error: { icon: MdError, color: '#c34f49', label: '生成未完成' },
  cancelled: { icon: MdClose, color: '#8b8580', label: '已取消' },
};

const ACTIVE_STATES = new Set(['queued', 'analyzing', 'reading', 'parsing', 'generating']);

function progressText(task) {
  if (!task.total) return STATUS_META[task.status]?.label || '等待更新';
  if (task.failed > 0) return `本轮 ${task.total} 张未形成完整交付`;
  return `${task.done}/${task.total} 张完成`;
}

export default function TaskSidebar({ onOpenTask }) {
  const { tasks, activeCount, errorCount, loadError, refreshTasks } = useTasks();
  const { confirm } = useDialog();
  const [open, setOpen] = useState(false);
  const [retryingTaskId, setRetryingTaskId] = useState('');
  const [retryErrors, setRetryErrors] = useState({});
  const dockRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = event => {
      if (!dockRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const noticeCount = errorCount || activeCount;

  const retryFailedAssets = async task => {
    if (!task?.id || retryingTaskId) return;
    setRetryingTaskId(task.id);
    setRetryErrors(current => ({ ...current, [task.id]: '' }));
    try {
      const retryQuote = await quoteFailedEcommerceTask(task.id);
      const confirmed = await confirm({
        title: '确认重新生成整套',
        message: `本轮未交付的 ${retryQuote.quantity} 张将重新完整生成，成功后消耗 ${retryQuote.quote.totalUnits} 电商图片 / 画布 AI 积分。`,
        confirmLabel: '重新生成整套',
      });
      if (!confirmed) return;
      await retryFailedEcommerceTask(task.id, { billingQuoteId: retryQuote.quote.quoteId });
      await refreshTasks();
    } catch (error) {
      setRetryErrors(current => ({
        ...current,
        [task.id]: error?.message || '重新生成整套失败，请稍后重试',
      }));
    } finally {
      setRetryingTaskId('');
    }
  };

  return (
    <div
      className="task-sidebar"
      ref={dockRef}
      style={{
        position: 'fixed',
        left: 16,
        bottom: 86,
        zIndex: 999,
        display: 'flex',
        alignItems: 'flex-end',
        gap: 10,
      }}
    >
      <button
        type="button"
        aria-label="打开任务列表"
        aria-expanded={open}
        aria-controls="global-task-dock-panel"
        onClick={() => setOpen(value => !value)}
        style={{
          position: 'relative',
          width: 46,
          height: 46,
          border: '1px solid rgba(70, 52, 38, 0.1)',
          borderRadius: 15,
          background: activeCount > 0 ? '#1f8a83' : '#fffaf4',
          color: activeCount > 0 ? '#fff' : '#554a42',
          boxShadow: '0 12px 30px rgba(84, 55, 35, 0.16)',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {activeCount > 0
          ? <MdHourglassTop size={20} className="animate-spin" />
          : errorCount > 0 ? <MdError size={20} /> : <MdAutoAwesome size={20} />}
        {noticeCount > 0 && (
          <span style={{
            position: 'absolute',
            top: -7,
            right: -7,
            minWidth: 20,
            height: 20,
            padding: '0 5px',
            borderRadius: 10,
            background: errorCount > 0 ? '#c34f49' : '#db7c2d',
            color: '#fff',
            border: '2px solid #fffaf4',
            fontSize: 11,
            fontWeight: 800,
            lineHeight: '16px',
          }}>
            {noticeCount}
          </span>
        )}
      </button>

      {open && (
        <section
          id="global-task-dock-panel"
          aria-label="最近的生成任务"
          style={{
            width: 'min(350px, calc(100vw - 84px))',
            maxHeight: 'min(620px, calc(100vh - 150px))',
            overflow: 'hidden',
            border: '1px solid rgba(70, 52, 38, 0.1)',
            borderRadius: 20,
            background: 'rgba(255, 252, 247, 0.98)',
            backdropFilter: 'blur(18px)',
            boxShadow: '0 22px 60px rgba(70, 44, 28, 0.2)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <header style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '15px 16px 12px',
            borderBottom: '1px solid rgba(70, 52, 38, 0.08)',
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#342b25' }}>生成任务</div>
              <div style={{ marginTop: 2, fontSize: 11, color: '#867970' }}>离开当前页面也会继续更新</div>
            </div>
            <button
              type="button"
              aria-label="关闭任务列表"
              onClick={() => setOpen(false)}
              style={{
                width: 32,
                height: 32,
                border: 0,
                borderRadius: 10,
                background: 'rgba(70, 52, 38, 0.06)',
                color: '#6c6058',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <MdClose size={17} />
            </button>
          </header>

          <div style={{ overflowY: 'auto', padding: 10 }}>
            {loadError && (
              <div role="alert" style={{
                margin: '2px 2px 10px',
                padding: '10px 12px',
                borderRadius: 12,
                background: '#fff0ed',
                color: '#a8403a',
                fontSize: 12,
              }}>
                {loadError}
                <button type="button" onClick={refreshTasks} style={{ marginLeft: 8 }}>重新加载</button>
              </div>
            )}

            {tasks.length === 0 ? (
              <div style={{ padding: '34px 20px', textAlign: 'center' }}>
                <MdAutoAwesome size={28} color="#b6a89d" />
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: '#5f534b' }}>还没有生成任务</div>
                <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.6, color: '#93867d' }}>开始生成后，可在这里随时查看进度和失败原因。</div>
              </div>
            ) : tasks.map(task => {
              const meta = STATUS_META[task.status] || STATUS_META.queued;
              const Icon = meta.icon;
              const active = ACTIVE_STATES.has(task.status);
              const percent = task.total > 0 ? Math.min(100, Math.round((task.done / task.total) * 100)) : 0;
              const assetErrors = (task.assets || []).filter(asset => asset.error);
              const retryError = retryErrors[task.id];
              const retrying = retryingTaskId === task.id;
              return (
                <article
                  key={task.id}
                  style={{
                    marginBottom: 8,
                    padding: 12,
                    border: '1px solid rgba(70, 52, 38, 0.08)',
                    borderRadius: 15,
                    background: '#fff',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onOpenTask?.(task.id)}
                    style={{
                      width: '100%',
                      padding: 0,
                      border: 0,
                      background: 'transparent',
                      color: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{
                        width: 32,
                        height: 32,
                        flex: '0 0 32px',
                        borderRadius: 11,
                        background: `${meta.color}18`,
                        color: meta.color,
                        display: 'grid',
                        placeItems: 'center',
                      }}>
                        <Icon size={17} className={active ? 'animate-spin' : ''} />
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: '#3a302a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {task.title || task.params?.product_name || '电商套图'}
                        </span>
                        <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: meta.color, fontWeight: 700 }}>
                          {meta.label}
                        </span>
                      </span>
                    </div>

                    {task.total > 0 && (
                      <span style={{ display: 'block', marginTop: 10 }}>
                        <span style={{ display: 'block', height: 5, overflow: 'hidden', borderRadius: 3, background: '#eee8e2' }}>
                          <span style={{ display: 'block', width: `${percent}%`, height: '100%', borderRadius: 3, background: task.failed > 0 ? '#bd7026' : '#1f8a83' }} />
                        </span>
                        <span style={{ display: 'block', marginTop: 5, fontSize: 11, color: '#7d7169' }}>{progressText(task)}</span>
                      </span>
                    )}
                  </button>

                  {(task.error || assetErrors.length > 0) && (
                    <div role="alert" style={{ marginTop: 9, padding: '8px 10px', borderRadius: 10, background: '#fff3ee', color: '#9f493c', fontSize: 11, lineHeight: 1.5 }}>
                      {task.error && <div>{task.error}</div>}
                      {assetErrors.map(asset => (
                        <div key={asset.id} style={{ marginTop: task.error ? 5 : 0 }}>
                          <strong>{asset.label}</strong>：{asset.error}
                        </div>
                      ))}
                    </div>
                  )}

                  {retryError && (
                    <div role="alert" style={{ marginTop: 9, padding: '8px 10px', borderRadius: 10, background: '#fff3ee', color: '#9f493c', fontSize: 11, lineHeight: 1.5 }}>
                      {retryError}
                    </div>
                  )}

                  {task.actions?.includes('retry_failed') && (
                    <button
                      type="button"
                      onClick={() => retryFailedAssets(task)}
                      disabled={retrying || Boolean(retryingTaskId)}
                      style={{
                        marginTop: 9,
                        width: '100%',
                        minHeight: 34,
                        border: '1px solid rgba(189, 112, 38, 0.25)',
                        borderRadius: 10,
                        background: '#fff8ef',
                        color: '#9a591f',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: retrying || retryingTaskId ? 'wait' : 'pointer',
                        opacity: retrying || retryingTaskId ? 0.65 : 1,
                      }}
                    >
                      {retrying ? '正在确认费用…' : '重新生成整套'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
