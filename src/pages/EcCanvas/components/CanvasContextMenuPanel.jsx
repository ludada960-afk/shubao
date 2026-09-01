/* ═══════ 4c183cd4 续命 画布总监督 - 画布右键菜单 + 双击添加 (2026-08-30) ═══════
   Quantv CanvasMenus.contextPoint 复刻: 空白处右键 → 上传/资产库/撤销/粘贴/全选/适配/排版/主题
   双击画布空白处 → 弹出 5 种基础节点添加面板
   用户原话 8-30: "最成品, 最面向市场, 最高级的一个体验和流畅度" */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Type, ImagePlus, Film, Music, Sparkles, Folder, ClipboardPaste, Undo2, Redo2,
  CheckSquare, Maximize, LayoutGrid, Grid3x3, Sun, Plus, Search,
} from 'lucide-react';
import { CANVAS_RIGHT_CLICK_ACTIONS, getKindLabel } from '../canvasQuantvExtensions.js';

const ICON_MAP = Object.freeze({
  type: Type,
  image: ImagePlus,
  film: Film,
  music: Music,
  sparkles: Sparkles,
  folder: Folder,
  clipboard: ClipboardPaste,
  undo: Undo2,
  redo: Redo2,
  'check-square': CheckSquare,
  maximize: Maximize,
  'layout-grid': LayoutGrid,
  grid: Grid3x3,
  sun: Sun,
});

const ACTION_GROUP_LABELS = Object.freeze({
  add: '添加节点',
  edit: '编辑',
  view: '视图',
});

export default function CanvasContextMenuPanel({
  x = 0,
  y = 0,
  onAction,
  onClose,
  onAddNode,
  viewportWidth = 1440,
  viewportHeight = 900,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose?.();
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('pointerdown', handler);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // 计算位置避免溢出
  const width = 240;
  const itemHeight = 36;
  const groupGap = 24;
  const estimatedHeight = CANVAS_RIGHT_CLICK_ACTIONS.length * itemHeight + groupGap * 3 + 40;
  const left = Math.min(viewportWidth - width - 12, Math.max(12, x));
  const top = Math.min(viewportHeight - estimatedHeight - 12, Math.max(12, y));

  // 按 group 分组
  const groupedActions = useMemo(() => {
    const groups = new Map();
    CANVAS_RIGHT_CLICK_ACTIONS.forEach(action => {
      if (!groups.has(action.group)) groups.set(action.group, []);
      groups.get(action.group).push(action);
    });
    return groups;
  }, []);

  return (
    <div
      ref={ref}
      className="ec-canvas-context-panel"
      role="menu"
      aria-label="画布操作菜单"
      style={{ left, top, width }}
    >
      <div className="ec-canvas-context-panel-header">
        <strong>画布操作</strong>
        <span>右键菜单</span>
      </div>
      <div className="ec-canvas-context-panel-list">
        {Array.from(groupedActions.entries()).map(([groupKey, actions]) => (
          <div key={groupKey} className="ec-canvas-context-panel-group">
            <div className="ec-canvas-context-panel-group-label">{ACTION_GROUP_LABELS[groupKey] || groupKey}</div>
            {actions.map(action => {
              const Icon = ICON_MAP[action.icon] || Sparkles;
              return (
                <button
                  key={action.id}
                  type="button"
                  className="ec-canvas-context-panel-item"
                  role="menuitem"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAction?.(action.id);
                    onClose?.();
                  }}
                >
                  <span className="ec-canvas-context-panel-item-icon"><Icon size={14} strokeWidth={1.75} /></span>
                  <span className="ec-canvas-context-panel-item-label">{action.label}</span>
                  {action.shortcut && <span className="ec-canvas-context-panel-item-shortcut">{action.shortcut}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════ CanvasAddNodePanel - 双击空白处弹出的添加节点面板 ═══════
   Quantv §10.2 实测: 5 个类型 + 2 资源入口 */
export function CanvasAddNodePanel({
  x = 0,
  y = 0,
  onAdd,
  onUpload,
  onPickFromLibrary,
  onClose,
  viewportWidth = 1440,
  viewportHeight = 900,
}) {
  const ref = useRef(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose?.();
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('pointerdown', handler);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // 5 种基础节点 + 1 应用
  const nodeTypes = [
    { id: 'text', label: '文本', kind: 'text', icon: Type, hint: '提示词 / 镜头脚本' },
    { id: 'image', label: '图片', kind: 'image', icon: ImagePlus, hint: '上传或生成图片' },
    { id: 'video', label: '视频', kind: 'video', icon: Film, hint: '上传或生成视频' },
    { id: 'audio', label: '音频', kind: 'audio', icon: Music, hint: '上传或录制音频' },
    { id: 'application', label: '应用', kind: 'application', icon: Sparkles, hint: '预设工作流节点' },
  ];

  // 资源入口
  const resourceTypes = [
    { id: 'upload-local', label: '本地上传', icon: ImagePlus, onClick: onUpload },
    { id: 'from-library', label: '从资产库选择', icon: Folder, onClick: onPickFromLibrary },
  ];

  const filtered = nodeTypes.filter(n => !query || n.label.includes(query) || n.hint.includes(query));

  // 位置计算
  const width = 320;
  const itemHeight = 56;
  const headerHeight = 80;
  const footerHeight = 60;
  const estimatedHeight = headerHeight + filtered.length * itemHeight + resourceTypes.length * itemHeight + footerHeight + 40;
  const left = Math.min(viewportWidth - width - 12, Math.max(12, x));
  const top = Math.min(viewportHeight - estimatedHeight - 12, Math.max(12, y));

  return (
    <div
      ref={ref}
      className="ec-canvas-add-node-panel"
      role="dialog"
      aria-label="添加节点"
      style={{ left, top, width }}
    >
      <header className="ec-canvas-add-node-panel-header">
        <div>
          <strong>添加节点</strong>
          <span>双击画布空白处</span>
        </div>
      </header>
      <div className="ec-canvas-add-node-panel-search">
        <Search size={14} strokeWidth={1.75} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索节点类型..."
          autoFocus
        />
      </div>
      <div className="ec-canvas-add-node-panel-section">
        <div className="ec-canvas-add-node-panel-section-label">节点类型</div>
        <div className="ec-canvas-add-node-panel-grid">
          {filtered.map(node => {
            const Icon = node.icon;
            return (
              <button
                key={node.id}
                type="button"
                className="ec-canvas-add-node-panel-card"
                onClick={() => {
                  onAdd?.(node.kind, node.id);
                  onClose?.();
                }}
              >
                <span className="ec-canvas-add-node-panel-card-icon"><Icon size={20} strokeWidth={1.6} /></span>
                <span className="ec-canvas-add-node-panel-card-text">
                  <strong>{node.label}</strong>
                  <small>{node.hint}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="ec-canvas-add-node-panel-section">
        <div className="ec-canvas-add-node-panel-section-label">添加资源</div>
        <div className="ec-canvas-add-node-panel-grid">
          {resourceTypes.map(res => {
            const Icon = res.icon;
            return (
              <button
                key={res.id}
                type="button"
                className="ec-canvas-add-node-panel-card is-resource"
                onClick={() => {
                  res.onClick?.();
                  onClose?.();
                }}
              >
                <span className="ec-canvas-add-node-panel-card-icon"><Icon size={20} strokeWidth={1.6} /></span>
                <span className="ec-canvas-add-node-panel-card-text">
                  <strong>{res.label}</strong>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════ CanvasShortcutHelp - 快捷键帮助面板 (按 ? 键弹出) ═══════ */
export function CanvasShortcutHelp({ onClose }) {
  const ref = useRef(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose?.();
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('pointerdown', handler);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const shortcuts = useMemo(() => import('../canvasQuantvExtensions.js').then(m => m.CANVAS_SHORTCUTS), []);
  const [shortcutsList, setShortcutsList] = useState([]);
  useEffect(() => {
    shortcuts.then(m => setShortcutsList(m.CANVAS_SHORTCUTS || []));
  }, [shortcuts]);

  const filtered = shortcutsList.filter(s =>
    !query || s.description.includes(query) || s.keys.some(k => k.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="ec-canvas-shortcut-help-overlay" role="dialog" aria-label="快捷键面板">
      <div ref={ref} className="ec-canvas-shortcut-help" style={{ width: 540 }}>
        <header>
          <strong>快捷键面板</strong>
          <button type="button" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <div className="ec-canvas-shortcut-help-search">
          <Search size={14} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索快捷键..."
            autoFocus
          />
        </div>
        <div className="ec-canvas-shortcut-help-list">
          {filtered.map(s => (
            <div key={s.id} className="ec-canvas-shortcut-help-row">
              <span className="ec-canvas-shortcut-help-keys">
                {s.keys.map((k, i) => (
                  <React.Fragment key={i}>
                    <kbd>{k}</kbd>
                    {i < s.keys.length - 1 && <span className="or-divider">/</span>}
                  </React.Fragment>
                ))}
              </span>
              <span className="ec-canvas-shortcut-help-desc">{s.description}</span>
            </div>
          ))}
          {!filtered.length && <div className="ec-canvas-shortcut-help-empty">没有匹配的快捷键</div>}
        </div>
      </div>
    </div>
  );
}

/* ═══════ CanvasMinimap - 小地图 (Quantv §1.6) ═══════ */
export function CanvasMinimap({
  nodes = [],
  connections = [],
  viewport = { x: 0, y: 0, scale: 1 },
  worldBounds = { width: 2400, height: 1600 },
  onViewportChange,
  minimapWidth = 200,
  minimapHeight = 140,
}) {
  const ref = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);

  // 计算节点比例
  const scaleX = minimapWidth / Math.max(1, worldBounds.width);
  const scaleY = minimapHeight / Math.max(1, worldBounds.height);

  const visibleRect = {
    x: -viewport.x / viewport.scale * scaleX,
    y: -viewport.y / viewport.scale * scaleY,
    w: (globalThis.innerWidth || 1440) / viewport.scale * scaleX,
    h: (globalThis.innerHeight || 900) / viewport.scale * scaleY,
  };

  function handlePointerDown(event) {
    setIsDragging(true);
    handlePointerMove(event);
  }
  function handlePointerMove(event) {
    if (!isDragging || !onViewportChange) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (event.clientX - rect.left) / scaleX * viewport.scale - (globalThis.innerWidth || 1440) / 2 / viewport.scale;
    const y = (event.clientY - rect.top) / scaleY * viewport.scale - (globalThis.innerHeight || 900) / 2 / viewport.scale;
    onViewportChange({ x: -x * viewport.scale + (globalThis.innerWidth || 1440) / 2, y: -y * viewport.scale + (globalThis.innerHeight || 900) / 2 });
  }
  function handlePointerUp() {
    setIsDragging(false);
  }

  useEffect(() => {
    if (!isDragging) return undefined;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  return (
    <div className="ec-canvas-minimap" style={{ width: minimapWidth, height: minimapHeight }}>
      <header className="ec-canvas-minimap-header">
        <strong>小地图</strong>
        <span>{nodes.length} 节点</span>
      </header>
      <div
        ref={ref}
        className="ec-canvas-minimap-canvas"
        style={{ width: minimapWidth - 8, height: minimapHeight - 36 }}
        onPointerDown={handlePointerDown}
      >
        {/* 连线简化渲染 */}
        <svg viewBox={`0 0 ${minimapWidth} ${minimapHeight}`} width={minimapWidth - 8} height={minimapHeight - 36}>
          {connections.map((conn, i) => {
            const from = nodes.find(n => n.id === (conn.fromNodeId || conn.from));
            const to = nodes.find(n => n.id === (conn.toNodeId || conn.to));
            if (!from || !to) return null;
            const x1 = (from.x + (from.w || 0) / 2) * scaleX;
            const y1 = (from.y + (from.h || 0) / 2) * scaleY;
            const x2 = (to.x + (to.w || 0) / 2) * scaleX;
            const y2 = (to.y + (to.h || 0) / 2) * scaleY;
            return <line key={conn.id || i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />;
          })}
        </svg>
        {nodes.map(node => {
          return (
            <div
              key={node.id}
              className="ec-canvas-minimap-node"
              data-kind={node.kind}
              style={{
                left: node.x * scaleX,
                top: node.y * scaleY,
                width: Math.max(2, (node.w || 100) * scaleX),
                height: Math.max(2, (node.h || 60) * scaleY),
                background: getStaticNodeColor(node.kind),
                border: hoveredNode === node.id ? '1px solid rgba(255,255,255,0.9)' : '1px solid rgba(255,255,255,0.15)',
              }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              title={node.name || node.displayLabel || node.kind}
            />
          );
        })}
        <div
          className="ec-canvas-minimap-viewport"
          style={{
            left: Math.max(0, visibleRect.x),
            top: Math.max(0, visibleRect.y),
            width: Math.min(minimapWidth - 8, visibleRect.w),
            height: Math.min(minimapHeight - 36, visibleRect.h),
          }}
        />
      </div>
    </div>
  );
}

/* 同步静态颜色映射 (避免动态 import) */
function getStaticNodeColor(kind = '') {
  const map = {
    text: '#FFE66D',
    image: '#4ECDC4',
    output: '#4ECDC4',
    video: '#FF6B6B',
    audio: '#A78BFA',
    application: '#FFA500',
    source_group: '#94A3B8',
    'layer-group': '#94A3B8',
    'image-composer': '#06B6D4',
    'text-composer': '#FFE66D',
    'video-composer': '#FF6B6B',
    'suite-composer': '#F97316',
    'smart-remix': '#EC4899',
    'layer-workbench': '#10B981',
    'remove-bg': '#22C55E',
    extend: '#3B82F6',
    inpaint: '#8B5CF6',
    translate: '#F59E0B',
    upscale: '#0EA5E9',
    sticker: '#FACC15',
  };
  return map[kind] || '#888888';
}

/* ═══════ CanvasTaskLogPanel - 任务日志面板 (Quantv §1.6) ═══════ */
export function CanvasTaskLogPanel({ tasks = [], onClose, onRetry, onDismiss, onRefund }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose?.();
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('pointerdown', handler);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const groupedByStatus = useMemo(() => {
    const groups = new Map();
    tasks.forEach(task => {
      const status = task.status || 'waiting';
      if (!groups.has(status)) groups.set(status, []);
      groups.get(status).push(task);
    });
    return groups;
  }, [tasks]);

  const statusOrder = ['waiting', 'queued', 'processing', 'transferring', 'completed', 'failed', 'refunding', 'refunded'];

  return (
    <div className="ec-canvas-task-log-overlay" role="dialog" aria-label="任务日志">
      <div ref={ref} className="ec-canvas-task-log-panel">
        <header>
          <strong>任务日志</strong>
          <span>{tasks.length} 个任务</span>
          <button type="button" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <div className="ec-canvas-task-log-list">
          {statusOrder.filter(s => groupedByStatus.has(s)).map(status => (
            <div key={status} className="ec-canvas-task-log-group">
              <div className={`ec-canvas-task-log-group-header status-${status}`}>
                {status}
                <span>({groupedByStatus.get(status).length})</span>
              </div>
              {groupedByStatus.get(status).map(task => (
                <div key={task.id} className="ec-canvas-task-log-row">
                  <div className="ec-canvas-task-log-row-main">
                    <strong>{task.title || task.name || task.id}</strong>
                    {task.message && <small>{task.message}</small>}
                  </div>
                  <div className="ec-canvas-task-log-row-actions">
                    {task.status === 'failed' && (
                      <button type="button" onClick={() => onRetry?.(task)}>重试</button>
                    )}
                    {task.status === 'completed' && (
                      <button type="button" onClick={() => onRefund?.(task)}>退款</button>
                    )}
                    <button type="button" onClick={() => onDismiss?.(task)}>关闭</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {!tasks.length && <div className="ec-canvas-task-log-empty">暂无任务</div>}
        </div>
      </div>
    </div>
  );
}

/* ═══════ SaveStatusIndicator - 保存状态指示器 (顶栏) ═══════ */
export function SaveStatusIndicator({ status = 'saved', lastSavedAt = null }) {
  const label = { saved: '已保存', saving: '保存中', 'local-only': '本地未同步', conflict: '冲突' }[status] || status;
  const dotColor = { saved: '#22C55E', saving: '#F59E0B', 'local-only': '#94A3B8', conflict: '#EF4444' }[status] || '#888';
  return (
    <span className={`ec-canvas-save-indicator status-${status}`} title={lastSavedAt ? `最近保存: ${new Date(lastSavedAt).toLocaleString()}` : label}>
      <span className="ec-canvas-save-indicator-dot" style={{ background: dotColor }} />
      <span className="ec-canvas-save-indicator-label">{label}</span>
    </span>
  );
}

/* ═══════ CanvasSticker - 便签 (Quantv CanvasStickerLayer) ═══════ */
export function CanvasSticker({ sticker = {}, onChange, onDelete, onPointerDown }) {
  const colorMap = {
    yellow: { bg: 'rgba(255, 235, 59, 0.92)', text: '#1a1a1a' },
    pink: { bg: 'rgba(255, 138, 176, 0.92)', text: '#1a1a1a' },
    blue: { bg: 'rgba(100, 181, 246, 0.92)', text: '#0d1117' },
    green: { bg: 'rgba(129, 199, 132, 0.92)', text: '#0d1117' },
    purple: { bg: 'rgba(186, 104, 200, 0.92)', text: '#ffffff' },
  };
  const colors = colorMap[sticker.color] || colorMap.yellow;
  return (
    <div
      className="ec-canvas-sticker"
      onPointerDown={onPointerDown}
      style={{
        left: sticker.x,
        top: sticker.y,
        width: sticker.w,
        minHeight: sticker.h,
        background: colors.bg,
        color: colors.text,
        transform: `rotate(${sticker.rotation || 0}deg)`,
      }}
    >
      <textarea
        className="ec-canvas-sticker-text"
        value={sticker.text || ''}
        onChange={(e) => onChange?.({ ...sticker, text: e.target.value })}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        className="ec-canvas-sticker-delete"
        aria-label="删除便签"
        onClick={(e) => { e.stopPropagation(); onDelete?.(sticker); }}
      >×</button>
    </div>
  );
}
