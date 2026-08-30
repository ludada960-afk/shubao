/* ═══════ 4c183cd4 续命 画布总监督 - 节点操作条 (2026-08-30) ═══════
   Quantv NodeActionBar 复刻: focus / preview / generate-image / generate-video /
   workspace / download / analyze / add-asset / edit / face 11 项
   用户原话 8-30: "最成品, 最面向市场, 最高级的一个体验和流畅度" */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Crosshair, Eye, ImagePlus, Film, Crop, Download, FolderPlus, Edit3,
  Type, Volume2, Sparkles, Search, Lock, Trash2, ChevronUp,
} from 'lucide-react';
import { getNodeKindColor, estimateNodeCost, getNodeActionFlags } from '../canvasQuantvExtensions.js';

const ICON_MAP = Object.freeze({
  crosshair: Crosshair,
  eye: Eye,
  'image-plus': ImagePlus,
  film: Film,
  crop: Crop,
  download: Download,
  'folder-plus': FolderPlus,
  'edit-3': Edit3,
  search: Search,
  type: Type,
  'volume-2': Volume2,
  sparkles: Sparkles,
  trash: Trash2,
  lock: Lock,
});

const ACTION_LABELS = Object.freeze({
  focus: '聚焦',
  preview: '预览',
  'generate-image': '生成图片',
  'generate-video': '生成视频',
  workspace: '图片工作台',
  download: '下载素材',
  analyze: '图片分析',
  'add-asset': '加入资产库',
  rename: '重命名',
  duplicate: '创建副本',
  delete: '删除',
});

/* 判断节点是否支持某个 action (按 Quantv nodeActionFlags + 节点 kind) */
function isActionAvailable(actionId, node = {}) {
  const flags = getNodeActionFlags(node);
  switch (actionId) {
    case 'focus': return true;
    case 'preview': return ['image', 'video', 'audio', 'output'].includes(node.kind);
    case 'generate-image': return ['text', 'image', 'application', 'output'].includes(node.kind);
    case 'generate-video': return ['text', 'image', 'video', 'application', 'output'].includes(node.kind);
    case 'workspace': return Boolean(flags.workspace) || ['image', 'video'].includes(node.kind);
    case 'download': return Boolean(node.url) && ['image', 'video', 'audio', 'output'].includes(node.kind);
    case 'analyze': return Boolean(flags.analyze) || ['image', 'video'].includes(node.kind);
    case 'add-asset': return Boolean(node.url) && ['image', 'video', 'audio', 'output'].includes(node.kind);
    case 'rename': return true;
    case 'duplicate': return true;
    case 'delete': return true;
    default: return true;
  }
}

export default function CanvasNodeActionBar({ node = {}, position = null, onAction, onClose, saveStatus = 'saved' }) {
  const ref = useRef(null);
  const [hovered, setHovered] = useState(null);

  const availableActions = useMemo(() => {
    const order = ['focus', 'preview', 'generate-image', 'generate-video', 'analyze', 'workspace', 'download', 'add-asset', 'rename', 'duplicate', 'delete'];
    return order.filter(id => isActionAvailable(id, node));
  }, [node]);

  const costEstimate = useMemo(() => estimateNodeCost(node), [node]);
  const kindColor = useMemo(() => getNodeKindColor(node.kind), [node.kind]);

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

  const style = position ? { left: position.x, top: position.y } : undefined;
  const status = node.status || 'ready';
  const statusLabel = { draft: '待配置', analyzing: '分析中', running: '处理中', ready: '可编辑', success: '已完成', error: '需要重试' }[status] || status;

  return (
    <div
      ref={ref}
      className="ec-canvas-node-action-bar"
      role="toolbar"
      aria-label={`${node.name || node.displayLabel || '节点'}操作`}
      style={style}
      data-canvas-action-bar="true"
    >
      <header className="ec-canvas-node-action-bar-header" style={{ borderLeft: `3px solid ${kindColor}` }}>
        <span className="ec-canvas-node-action-bar-title">
          <span className="ec-canvas-node-action-bar-name">{node.name || node.displayLabel || '未命名'}</span>
          <em className="ec-canvas-node-action-bar-kind">{node.kind}</em>
        </span>
        <span className={`ec-canvas-node-action-bar-status status-${status}`}>{statusLabel}</span>
      </header>

      <div className="ec-canvas-node-action-bar-actions">
        {availableActions.map(id => {
          const Icon = ICON_MAP[ICON_MAP[id] === undefined ? (id === 'trash' ? 'trash' : ICON_MAP[id]) : id] || ICON_MAP[ICON_MAP[id]] || Sparkles;
          const realId = id;
          const IconComponent = (() => {
            switch (realId) {
              case 'focus': return Crosshair;
              case 'preview': return Eye;
              case 'generate-image': return ImagePlus;
              case 'generate-video': return Film;
              case 'workspace': return Crop;
              case 'download': return Download;
              case 'analyze': return Search;
              case 'add-asset': return FolderPlus;
              case 'rename': return Edit3;
              case 'duplicate': return Edit3;
              case 'delete': return Trash2;
              default: return Sparkles;
            }
          })();
          const label = ACTION_LABELS[realId];
          const danger = realId === 'delete';
          return (
            <button
              key={realId}
              type="button"
              className={`ec-canvas-node-action-bar-button ${danger ? 'is-danger' : ''} ${hovered === realId ? 'is-hovered' : ''}`}
              aria-label={label}
              title={label}
              onMouseEnter={() => setHovered(realId)}
              onMouseLeave={() => setHovered(null)}
              onClick={(event) => {
                event.stopPropagation();
                onAction?.(realId, node);
                if (realId !== 'preview' && realId !== 'add-asset' && realId !== 'analyze') onClose?.();
              }}
            >
              <IconComponent size={15} strokeWidth={1.75} />
              <span className="ec-canvas-node-action-bar-button-label">{label}</span>
            </button>
          );
        })}
      </div>

      <footer className="ec-canvas-node-action-bar-footer">
        {costEstimate > 0 && (
          <span className="ec-canvas-node-action-bar-cost" title={`预计消耗 ${costEstimate} 积分`}>
            ✦ {costEstimate}
          </span>
        )}
        <span className={`ec-canvas-node-action-bar-save status-${saveStatus}`} title={`画布保存状态: ${saveStatus}`}>
          {saveStatus === 'saved' ? '已保存' : saveStatus === 'saving' ? '保存中' : saveStatus === 'local-only' ? '本地' : '冲突'}
        </span>
        <button
          type="button"
          className="ec-canvas-node-action-bar-close"
          aria-label="关闭"
          onClick={onClose}
        >
          <ChevronUp size={14} />
        </button>
      </footer>
    </div>
  );
}
