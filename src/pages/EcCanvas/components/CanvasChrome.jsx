import React from 'react';
import {
  ArrowLeft,
  Download,
  FileText,
  FolderOpen,
  Hand,
  ImagePlus,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Type,
} from 'lucide-react';

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
  onSave,
  onRestore,
  onNew,
  saving = false,
  canRestore = false,
}) {
  return <header className="ec-canvas-topbar">
    <div className="ec-canvas-topbar-leading">
      <IconButton label="返回" onClick={onBack}><ArrowLeft size={17} /></IconButton>
      <div className="ec-canvas-project-title">
        <strong>{title || '电商画布'}</strong>
        <span><i className={saving ? 'is-saving' : ''} />{saving ? '正在保存' : meta}</span>
      </div>
      <nav className="ec-canvas-tabs" aria-label="画布视图">
        {[['canvas', '当前画布'], ['works', '作品集'], ['trash', '回收站']].map(([id, label]) => <button
          key={id}
          type="button"
          className={tab === id ? 'is-active' : ''}
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => onTabChange?.(id)}
        >{label}</button>)}
      </nav>
    </div>
    <div className="ec-canvas-topbar-actions">
      {tab === 'canvas' && <>
        <label className="ec-canvas-filter">
          <span className="sr-only">图片类型</span>
          <select value={activeFilter} onChange={event => onFilterChange?.(event.target.value)}>
            {filters.map(filter => <option key={filter} value={filter}>{filter}</option>)}
          </select>
        </label>
        <button type="button" className="ec-canvas-command" onClick={onExport}><Download size={15} />导出</button>
        <IconButton label="恢复已保存画布" disabled={!canRestore || saving} onClick={onRestore}><RotateCcw size={16} /></IconButton>
        <button type="button" className="ec-canvas-command is-primary" disabled={saving} onClick={onSave}><Save size={15} />{saving ? '保存中' : '保存'}</button>
      </>}
      <button type="button" className="ec-canvas-command is-dark" onClick={onNew}><Sparkles size={15} />新建生图</button>
    </div>
  </header>;
}

export function CanvasLeftRail({ addMenuOpen = false, onAddMenuToggle, onUpload, onWorks, onEcommerce, onText }) {
  const actions = [
    { id: 'upload', label: '添加图片', icon: ImagePlus, onClick: onUpload },
    { id: 'works', label: '从作品导入', icon: FolderOpen, onClick: onWorks },
    { id: 'ecommerce', label: '生成电商套图', icon: Sparkles, onClick: onEcommerce },
    { id: 'text', label: '添加文本', icon: FileText, onClick: onText },
  ];
  return <aside className="ec-canvas-left-rail" aria-label="添加内容">
    <IconButton label={addMenuOpen ? '关闭添加菜单' : '添加节点'} active={addMenuOpen} onClick={onAddMenuToggle} className="ec-canvas-rail-add"><Plus size={19} /></IconButton>
    {actions.map(action => <IconButton key={action.id} label={action.label} onClick={action.onClick}><action.icon size={18} /></IconButton>)}
  </aside>;
}

export function CanvasBottomToolbar({ activeTool, onToolChange, onImage, onText }) {
  const tools = [
    { id: 'select', label: '选择', icon: MousePointer2 },
    { id: 'hand', label: '抓手', icon: Hand },
    { id: 'image', label: '添加图片', icon: ImagePlus, onClick: onImage },
    { id: 'text', label: '添加文本', icon: Type, onClick: onText },
  ];
  return <div className="ec-canvas-bottom-toolbar" role="toolbar" aria-label="画布工具">
    {tools.map(tool => <IconButton
      key={tool.id}
      label={tool.label}
      active={activeTool === tool.id}
      onClick={() => {
        onToolChange?.(tool.id);
        tool.onClick?.();
      }}
    ><tool.icon size={18} /></IconButton>)}
  </div>;
}

export function CanvasZoomControls({ scale, onZoomOut, onZoomIn, onFit }) {
  return <div className="ec-canvas-zoom-controls" role="group" aria-label="画布缩放">
    <IconButton label="缩小" onClick={onZoomOut}><Minus size={15} /></IconButton>
    <span aria-live="polite">{Math.round(scale * 100)}%</span>
    <IconButton label="放大" onClick={onZoomIn}><Plus size={15} /></IconButton>
    <IconButton label="适配画布" onClick={onFit}><Maximize2 size={15} /></IconButton>
  </div>;
}
