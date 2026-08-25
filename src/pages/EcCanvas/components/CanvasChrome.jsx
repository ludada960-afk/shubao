import React from 'react';
import {
  ArrowLeft,
  Download,
  Eye,
  EyeOff,
  Hand,
  ImagePlus,
  ImageUp,
  Layers3,
  Lock,
  LockOpen,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  RotateCcw,
  Sparkles,
  Type,
  X,
} from 'lucide-react';
import AccountEntitlementControl from '../../../components/billing/AccountEntitlementControl.jsx';

function IconButton({ label, children, active = false, disabled = false, onClick, className = '' }) {
  return <button
    type="button"
    className={`ec-canvas-icon-button ${active ? 'is-active' : ''} ${className}`}
    aria-label={label}
    title={label}
    aria-pressed={active || undefined}
    disabled={disabled}
    onClick={onClick}
  >{children}</button>;
}

export function CanvasTopBar({
  title,
  meta,
  tab,
  onTabChange,
  activeFilter,
  filters,
  onFilterChange,
  onBack,
  onExport,
  onRestore,
  onNew,
  saving = false,
  canRestore = false,
  entitlement,
}) {
  return <header className="ec-canvas-topbar">
    <div className="ec-canvas-topbar-leading">
      <IconButton label="返回" className="ec-canvas-topbar-surface" onClick={onBack}><ArrowLeft size={18} /></IconButton>
      <div className="ec-canvas-project-title">
        <strong>{title || '电商画布'}</strong>
        <span><i className={saving ? 'is-saving' : ''} />{saving ? '正在保存' : meta}</span>
      </div>
      <nav className="ec-canvas-tabs ec-canvas-topbar-surface" aria-label="画布视图">
        {[['canvas', '当前画布'], ['assets', '素材库'], ['works', '作品集'], ['trash', '回收站']].map(([id, label]) => <button
          key={id}
          type="button"
          className={tab === id ? 'is-active' : ''}
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => onTabChange?.(id)}
        >{label}</button>)}
      </nav>
    </div>
    <div className="ec-canvas-topbar-actions">
      <AccountEntitlementControl
        compact
        logged={entitlement?.logged}
        ecPoints={entitlement?.ecPoints}
        unlimited={entitlement?.unlimited}
        refreshStatus={entitlement?.refreshStatus}
        onPurchase={entitlement?.onPurchase}
        onLogin={entitlement?.onLogin}
      />
      {tab === 'canvas' && <>
        <label className="ec-canvas-filter ec-canvas-topbar-surface">
          <span className="sr-only">图片类型</span>
          <select value={activeFilter} onChange={event => onFilterChange?.(event.target.value)}>
            {filters.map(filter => <option key={filter} value={filter}>{filter}</option>)}
          </select>
        </label>
        <button type="button" className="ec-canvas-command ec-canvas-topbar-surface" onClick={onExport}><Download size={16} />导出整套图片</button>
        <IconButton label="恢复已保存画布" className="ec-canvas-topbar-surface" disabled={!canRestore || saving} onClick={onRestore}><RotateCcw size={17} /></IconButton>
      </>}
      <button type="button" className="ec-canvas-command ec-canvas-topbar-surface is-dark" onClick={onNew}><Plus size={16} />新建生图</button>
    </div>
  </header>;
}

export function CanvasLeftRail({ addMenuOpen = false, onAddMenuToggle }) {
  return <aside className="ec-canvas-left-rail" aria-label="添加内容">
    <IconButton label={addMenuOpen ? '关闭添加菜单' : '添加节点'} active={addMenuOpen} onClick={onAddMenuToggle} className="ec-canvas-rail-add"><Plus size={22} /></IconButton>
  </aside>;
}

export function CanvasBottomToolbar({ activeTool, onToolChange, onImage, onText, layersOpen = false, onLayers }) {
  const tools = [
    { id: 'select', label: '选择工具：拖拽框选 / Shift+点击多选', icon: MousePointer2 },
    { id: 'hand', label: '抓手', icon: Hand },
    { id: 'image', label: '添加图片', icon: ImageUp, onClick: onImage },
    { id: 'text', label: '添加文本', icon: Type, onClick: onText },
    { id: 'layers', label: '图层', icon: Layers3, onClick: onLayers },
  ];
  return <div className="ec-canvas-bottom-dock">
    <div className="ec-canvas-bottom-toolbar" role="toolbar" aria-label="画布工具">
      {tools.map(tool => <IconButton
        key={tool.id}
        label={tool.label}
        active={tool.id === 'layers' ? layersOpen : activeTool === tool.id}
        onClick={() => {
          if (tool.id !== 'layers') onToolChange?.(tool.id);
          tool.onClick?.();
        }}
      ><tool.icon size={18} /></IconButton>)}
    </div>
  </div>;
}

const LAYER_KIND_LABELS = Object.freeze({
  source_group: '商品素材',
  image: '图片',
  output: '生成图片',
  text: '文本',
  'layer-workbench': '智能分层',
  'remove-bg': '去除背景',
  'smart-remix': '商品图改造',
  extend: '智能扩图',
  inpaint: '局部改图',
  translate: '图片翻译',
  upscale: '高清修复',
});

function canvasLayerName(node = {}) {
  return node.name || node.displayLabel || node.title || LAYER_KIND_LABELS[node.kind] || '画布对象';
}

export function CanvasLayersPanel({
  open = false,
  nodes = [],
  selectedIds = new Set(),
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onClose,
}) {
  if (!open) return null;
  const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
  const layers = nodes.filter(node => !['image-composer', 'suite-composer'].includes(node.kind)).slice().reverse();
  return <aside className="ec-canvas-layers-panel" data-canvas-control="true" aria-label="图层">
    <header>
      <span><Layers3 size={16} /><strong>图层</strong></span>
      <button type="button" aria-label="关闭图层面板" title="关闭" onClick={onClose}><X size={16} /></button>
    </header>
    <div className="ec-canvas-layer-list">
      {!layers.length && <p>画布中还没有对象</p>}
      {layers.map(node => <div key={node.id} className={`ec-canvas-layer-row ${selected.has(node.id) ? 'is-selected' : ''}`}>
        <button type="button" className="ec-canvas-layer-main" onClick={() => onSelect?.(node.id)}>
          <span className="ec-canvas-layer-mark"><Layers3 size={15} /></span>
          <span><strong>{canvasLayerName(node)}</strong><small>{LAYER_KIND_LABELS[node.kind] || '画布对象'}</small></span>
        </button>
        <button type="button" aria-label={node.hidden ? `显示${canvasLayerName(node)}` : `隐藏${canvasLayerName(node)}`} title={node.hidden ? '显示' : '隐藏'} onClick={() => onToggleVisibility?.(node.id)}>
          {node.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        <button type="button" aria-label={node.locked ? `解锁${canvasLayerName(node)}` : `锁定${canvasLayerName(node)}`} title={node.locked ? '解锁' : '锁定'} onClick={() => onToggleLock?.(node.id)}>
          {node.locked ? <Lock size={15} /> : <LockOpen size={15} />}
        </button>
      </div>)}
    </div>
  </aside>;
}

export function CanvasZoomControls({ scale, onZoomOut, onZoomIn, onFit }) {
  return <div className="ec-canvas-zoom-controls" role="group" aria-label="画布缩放">
    <IconButton label="缩小" onClick={onZoomOut}><Minus size={15} /></IconButton>
    <span aria-live="polite">{Math.round(scale * 100)}%</span>
    <IconButton label="放大" onClick={onZoomIn}><Plus size={15} /></IconButton>
    <IconButton label="适配画布" onClick={onFit}><Maximize2 size={15} /></IconButton>
  </div>;
}
