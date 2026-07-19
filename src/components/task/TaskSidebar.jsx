/**
 * 薯包AI 左侧常驻任务栏
 *
 * 对标椒图 AI 任务栏交互：
 * - 默认窄栏折叠，hover 展开完整面板
 * - 任务状态可视：排队、读图、解析、生成、成功、失败、重试
 * - 小红点 + 进度数值提醒
 * - 点击任务打开弹窗，永不阻塞主页面
 */

import React, { useState, useRef } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { MdAutoAwesome, MdClose, MdRotateLeft, MdChevronRight, MdAutorenew, MdCheckCircle, MdError, MdSchedule } from 'react-icons/md';
import { useTasks } from '../../store/taskStore';

const STATUS_META = {
  queued:     { icon: MdSchedule,    color: '#8B8580', label: '排队中' },
  reading:    { icon: MdAutorenew,   color: '#5275CC', label: '读图中' },
  parsing:    { icon: MdAutorenew,   color: '#6366F1', label: '解析中' },
  generating: { icon: MdAutoAwesome, color: '#F59E0B', label: '生成中' },
  done:       { icon: MdCheckCircle, color: '#5CA86C', label: '已完成' },
  error:      { icon: MdError,       color: '#E8544B', label: '失败' },
};

const SIDEBAR_WIDTH_COLLAPSED = 8;   // narrow
const SIDEBAR_WIDTH_EXPANDED = 260;  // expanded

export default function TaskSidebar({ onOpenTask }) {
  const { tasks, activeCount, errorCount, removeTask, retryTask, clearDone } = useTasks();
  const [hovered, setHovered] = useState(false);
  const sidebarRef = useRef(null);
  const timerRef = useRef(null);

  const handleMouseEnter = () => {
    clearTimeout(timerRef.current);
    setHovered(true);
  };
  const handleMouseLeave = () => {
    // 稍微延迟关闭，避免"抖动"
    timerRef.current = setTimeout(() => setHovered(false), 200);
  };

  const hasTasks = tasks.length > 0;
  const width = hovered && hasTasks ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED;

  return (
    <div
      ref={sidebarRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'fixed', left: 0, top: '50%', transform: 'translateY(-50%)',
        zIndex: 999,
        width, height: hovered && hasTasks ? 'auto' : 'auto',
        maxHeight: hovered && hasTasks ? '70vh' : 'auto',
        background: hovered && hasTasks ? 'rgba(255,255,255,0.96)' : 'transparent',
        backdropFilter: hovered && hasTasks ? 'blur(16px)' : 'none',
        borderRadius: '0 16px 16px 0',
        boxShadow: hovered && hasTasks ? '4px 4px 24px rgba(0,0,0,0.08)' : 'none',
        borderRight: hovered && hasTasks ? '1px solid rgba(0,0,0,0.04)' : 'none',
        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        padding: hovered && hasTasks ? '10px 0' : '12px 0',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        cursor: hasTasks ? 'pointer' : 'default',
      }}
    >
      {/* 窄栏按钮区 */}
      {!hovered && (
        <div
          onClick={() => hasTasks && setHovered(true)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            padding: '6px 0', position: 'relative',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: activeCount > 0 ? 'var(--accent)' : errorCount > 0 ? 'var(--red)' : 'rgba(0,0,0,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: activeCount > 0 || errorCount > 0 ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.2s',
          }}>
            {activeCount > 0 ? <MdAutorenew size={16} className="animate-spin" /> :
             errorCount > 0 ? <MdError size={16} /> :
             <ImageIcon size={16} />}
          </div>
          {(activeCount > 0 || errorCount > 0) && (
            <div style={{
              position: 'absolute', top: -2, right: -2,
              minWidth: 18, height: 18, borderRadius: 9,
              background: errorCount > 0 ? 'var(--red)' : 'var(--accent)',
              color: '#fff', fontSize: 10, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 4px', boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            }}>
              {activeCount > 0 || errorCount}
            </div>
          )}
          {activeCount > 0 && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 800 }}>进行中</span>
          )}
        </div>
      )}

      {/* 展开面板 */}
      {hovered && hasTasks && (
        <div style={{ width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* 标题栏 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 14px 8px', borderBottom: '1px solid var(--border-light)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              任务列表
              <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 6, fontWeight: 500 }}>
                ({tasks.length})
              </span>
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={(e) => { e.stopPropagation(); clearDone(); }}
                style={{ fontSize: 10, color: 'var(--text-muted)', border: 'none', background: 'transparent', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, fontFamily: 'inherit', }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                清理完成
              </button>
            </div>
          </div>

          {/* 任务列表 */}
          <div style={{
            flex: 1, overflow: 'auto', maxHeight: 'calc(70vh - 44px)',
            scrollbarWidth: 'thin',
          }}>
            {tasks.map(task => {
              const meta = STATUS_META[task.status] || STATUS_META.queued;
              const Icon = meta.icon;
              const isActive = ['reading', 'parsing', 'generating'].includes(task.status);
              return (
                <div key={task.id}
                  onClick={() => onOpenTask && onOpenTask(task.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '8px 14px', cursor: 'pointer', transition: 'all 0.1s',
                    borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                    background: isActive ? 'rgba(0,0,0,0.02)' : 'transparent',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = isActive ? 'rgba(0,0,0,0.02)' : 'transparent'}>
                  {/* 状态图标 */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: task.status === 'done' ? 'rgba(92,168,108,0.12)' :
                                task.status === 'error' ? 'rgba(232,84,75,0.12)' :
                                isActive ? 'rgba(245,158,11,0.12)' : 'rgba(0,0,0,0.04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={14} color={meta.color}
                      className={isActive ? 'animate-spin' : ''}
                    />
                  </div>

                  {/* 任务信息 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {task.type === 'ec' ? '🛒 ' + (task.params?.product_name || '电商生图') : '📝 小红书图文'}
                    </div>
                    <div style={{ fontSize: 11, color: meta.color, fontWeight: 600, marginTop: 1 }}>
                      {task.stage || meta.label}
                    </div>
                    {task.progress && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{
                          height: 3, borderRadius: 2, background: 'rgba(0,0,0,0.06)', overflow: 'hidden',
                        }}>
                          <div style={{
                            height: '100%', borderRadius: 2,
                            background: task.status === 'error' ? 'var(--red)' : 'var(--accent)',
                            width: `${Math.round((task.progress.done / task.progress.total) * 100)}%`,
                            transition: 'width 0.3s',
                          }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>
                          {task.progress.done}/{task.progress.total} 张
                        </div>
                      </div>
                    )}
                    {task.status === 'error' && task.error && (
                      <div style={{ fontSize: 10, color: 'var(--red)', marginTop: 1, lineHeight: 1.3 }}>
                        {task.error}
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }}>
                    {task.status === 'error' && (
                      <button onClick={(e) => { e.stopPropagation(); retryTask(task.id); }}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, borderRadius: 4, color: 'var(--text-muted)' }}>
                        <MdRotateLeft size={13} />
                      </button>
                    )}
                    {task.status === 'done' && (
                      <button onClick={(e) => { e.stopPropagation(); removeTask(task.id); }}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, borderRadius: 4, color: 'var(--text-muted)' }}>
                        <MdClose size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 无任务时提示 */}
      {hovered && !hasTasks && (
        <div style={{
          width: SIDEBAR_WIDTH_EXPANDED, textAlign: 'center',
          padding: '24px 16px', cursor: 'default',
        }}>
          <div style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }}>📋</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)', fontWeight: 500 }}>暂无任务</div>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>开始生图后自动出现在这里</div>
        </div>
      )}
    </div>
  );
}
