import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MdAutoFixHigh,
  MdChevronRight,
  MdClose,
  MdDownload,
  MdEdit,
  MdImageSearch,
  MdLayers,
  MdLock,
  MdLockOpen,
  MdOpenWith,
  MdOutlineVisibility,
  MdVisibilityOff,
  MdRefresh,
  MdTextFields,
  MdTune,
  MdUpload,
} from 'react-icons/md';
import './workflowNodes.css';
import ModularCanvasWorkflowNode from './modular/CanvasWorkflowNode';
import { getCanvasAction } from '../../canvasActionRegistry.js';

const ICONS = {
  'smart-remix': MdImageSearch,
  'layer-edit': MdLayers,
  inpaint: MdTune,
  'remove-bg': MdAutoFixHigh,
  extend: MdOpenWith,
  translate: MdTextFields,
  upscale: MdRefresh,
};

export function CanvasPortHandle({ side = 'right', role = 'output', visible = true, active = false, connected = false, disabled = false, label, onPointerDown, onPointerUp, onClick }) {
  const title = label || (role === 'output' ? '从此处派生电商任务' : '连接到此节点');
  return (
    <button
      type="button"
      aria-label={title}
      title={title}
      disabled={disabled}
      data-canvas-control="true"
      data-canvas-port-role={role}
      className={`workflow-node-port workflow-node-port-${side} ${visible ? 'is-visible' : ''} ${active ? 'is-active' : ''} ${connected ? 'is-connected' : ''}`}
      onPointerDown={event => { event.stopPropagation(); onPointerDown?.(event); }}
      onPointerUp={event => { event.stopPropagation(); onPointerUp?.(event); }}
      onClick={event => { event.stopPropagation(); onClick?.(event); }}
    >
      <span className="workflow-node-port-dot" />
      {role === 'output' && <span className="workflow-node-port-plus">+</span>}
    </button>
  );
}

export function CanvasNodeShell({ title, subtitle, icon: Icon = MdAutoFixHigh, status = 'draft', selected = false, children, onClose, onRetry, onPointerDown, onContextMenu, onPortPointerDown, onPortPointerUp, className = '' }) {
  const statusLabel = { draft: '待配置', analyzing: '分析中', running: '处理中', ready: '可编辑', success: '已完成', error: '需要重试' }[status] || status;
  return (
    <section className={`workflow-node-shell ${selected ? 'is-selected' : ''} ${className}`} onPointerDown={event => {
      if (event.target.closest?.('button,input,textarea,select,a,[contenteditable="true"],[data-canvas-control="true"]')) return;
      onPointerDown?.(event);
    }} onContextMenu={event => { event.preventDefault(); onContextMenu?.(event); }}>
      <CanvasPortHandle side="left" role="input" visible={selected} onPointerDown={event => onPortPointerDown?.(event, 'in')} onPointerUp={event => onPortPointerUp?.(event, 'in')} />
      <CanvasPortHandle side="right" role="output" visible={selected} onPointerDown={event => onPortPointerDown?.(event, 'out')} onPointerUp={event => onPortPointerUp?.(event, 'out')} />
      <header className="workflow-node-header">
        <div className="workflow-node-title-group">
          <span className="workflow-node-icon"><Icon size={17} /></span>
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
        <div className="workflow-node-header-actions">
          <span className={`workflow-node-status status-${status}`}>{statusLabel}</span>
          {status === 'error' && <button type="button" className="workflow-node-icon-button" aria-label="重试" onClick={onRetry}><MdRefresh size={16} /></button>}
          {onClose && <button type="button" className="workflow-node-icon-button" aria-label="关闭节点" onClick={onClose}><MdClose size={16} /></button>}
        </div>
      </header>
      {children}
    </section>
  );
}

export function CanvasNodeActionPicker({ actions = [], onSelect, onClose, position }) {
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  useEffect(() => { searchRef.current?.focus(); }, []);
  const groups = useMemo(() => {
    const filtered = actions.filter(action => !query.trim() || `${action.label}${action.description}`.toLowerCase().includes(query.trim().toLowerCase()));
    return filtered.reduce((result, action) => {
      const group = action.group || '电商任务';
      (result[group] ||= []).push(action);
      return result;
    }, {});
  }, [actions, query]);
  return (
    <div className="workflow-action-picker" style={position ? { left: position.x, top: position.y, width: position.width, maxHeight: position.maxHeight } : undefined} role="dialog" aria-label="选择电商任务">
      <div className="workflow-picker-header">
        <div><strong>从素材派生</strong><span>选择一个电商处理任务</span></div>
        <button type="button" className="workflow-node-icon-button" aria-label="关闭" onClick={onClose}><MdClose size={16} /></button>
      </div>
      <input ref={searchRef} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') onClose?.(); }} placeholder="搜索电商任务" aria-label="搜索电商任务" />
      <div className="workflow-picker-list">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group}>
            <div className="workflow-picker-group">{group}</div>
            {items.map(action => {
              const Icon = ICONS[action.id] || MdAutoFixHigh;
              return <button type="button" className="workflow-picker-item" key={action.id} onClick={() => onSelect?.(action)}>
                <span className="workflow-picker-item-icon"><Icon size={17} /></span>
                <span><strong>{action.label}</strong><small>{action.description}</small></span>
                <em className="workflow-picker-price">{action.priceLabel}</em>
                <MdChevronRight size={16} />
              </button>;
            })}
          </div>
        ))}
        {!Object.keys(groups).length && <div className="workflow-picker-empty">没有匹配的电商任务</div>}
      </div>
    </div>
  );
}

function ImageRail({ label, hint, images = [], onAdd, onRemove }) {
  const inputRef = useRef(null);
  return (
    <div className="workflow-image-rail">
      <div className="workflow-section-label"><strong>{label}</strong><span>{hint}</span></div>
      <div className="workflow-image-rail-scroll">
        {images.map((image, index) => <div className="workflow-rail-image" key={image.id || image.url || index}>
          <img src={image.url} alt={image.name || label} />
          <button type="button" aria-label={`移除${label}`} onClick={() => onRemove?.(image, index)}><MdClose size={12} /></button>
        </div>)}
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={event => { onAdd?.([...event.target.files]); event.target.value = ''; }} />
        <button type="button" className="workflow-upload-tile" onClick={() => inputRef.current?.click()}><MdUpload size={17} /><span>添加</span></button>
      </div>
    </div>
  );
}

export function SmartRemixNodeCard({ node, sourceImage, prompt = '', productImages = [], referenceImages = [], outputCount = 1, status = 'draft', selected = false, error, onPromptChange, onAddProductImages, onRemoveProductImage, onAddReferenceImages, onRemoveReferenceImage, onOutputCountChange, onGenerate, onRetry, onPointerDown, onContextMenu, onPortPointerDown, onPortPointerUp }) {
  const action = getCanvasAction(node?.actionId || 'smart-remix');
  return (
    <CanvasNodeShell title={action?.label} subtitle={action?.description} icon={MdImageSearch} status={status} selected={selected} onRetry={onRetry} onPointerDown={onPointerDown} onContextMenu={onContextMenu} onPortPointerDown={onPortPointerDown} onPortPointerUp={onPortPointerUp} className="workflow-node-smart-remix">
      <div className="workflow-node-body">
        {sourceImage && <div className="workflow-source-preview"><img src={sourceImage.url} alt={sourceImage.name || '源图'} /><span>源图</span></div>}
        <label className="workflow-field-label" htmlFor={`remix-prompt-${node?.id || 'draft'}`}>生成要求 <em>可编辑</em></label>
        <textarea id={`remix-prompt-${node?.id || 'draft'}`} className="workflow-prompt-editor" value={prompt} onChange={event => onPromptChange?.(event.target.value)} placeholder="写清楚这次要怎么改、突出什么，系统会保留商品主体" rows={4} />
        <ImageRail label="产品图" hint="补充不同角度，帮助保持商品一致" images={productImages} onAdd={onAddProductImages} onRemove={onRemoveProductImage} />
        <ImageRail label="参考图" hint="可选，用于补充风格和构图" images={referenceImages} onAdd={onAddReferenceImages} onRemove={onRemoveReferenceImage} />
        <div className="workflow-node-footer-row">
          <label className="workflow-count-control">生成 <select value={outputCount} onChange={event => onOutputCountChange?.(Number(event.target.value))}><option value={1}>1 张</option><option value={2}>2 张</option><option value={4}>4 张</option></select></label>
          <button type="button" className="workflow-primary-button" onClick={onGenerate} disabled={status === 'running' || !prompt.trim()}>{status === 'running' ? '生成中…' : '生成新方案'}</button>
        </div>
        {error && <div className="workflow-error-box"><span>{error}</span><button type="button" onClick={onRetry}>重试</button></div>}
      </div>
    </CanvasNodeShell>
  );
}

export function LayerWorkbenchNodeCard({ layers = [], selectedLayerId, status = 'draft', selected = false, capabilities = {}, error, onRetry, onSelectLayer, onToggleVisibility, onToggleLock, onMoveLayer, onExportPng, onAddToCanvas, onCreatePixelLayers, onExportPsd, onPointerDown, onContextMenu, onPortPointerDown, onPortPointerUp }) {
  const selectedLayer = layers.find(layer => layer.id === selectedLayerId) || layers[0];
  const hasPixelLayers = capabilities.pixelLayers === true;
  return (
    <CanvasNodeShell title="图层编辑" subtitle="拆分元素后逐层调整" icon={MdLayers} status={status} selected={selected} onRetry={onRetry} onPointerDown={onPointerDown} onContextMenu={onContextMenu} onPortPointerDown={onPortPointerDown} onPortPointerUp={onPortPointerUp} className="workflow-node-layer-workbench">
      <div className="workflow-node-body">
        {status === 'analyzing' ? <div className="workflow-layer-skeleton"><span /><span /><span /></div> : <>
          <div className="workflow-layer-list" role="listbox" aria-label="图层列表">
            {layers.map(layer => <div role="option" aria-selected={layer.id === selectedLayer?.id} tabIndex={0} className={`workflow-layer-row ${layer.id === selectedLayer?.id ? 'is-selected' : ''}`} key={layer.id} onClick={() => onSelectLayer?.(layer.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onSelectLayer?.(layer.id); }}>
              {layer.preview_url ? <img src={layer.preview_url} alt="" /> : <span className="workflow-layer-thumb"><MdLayers size={15} /></span>}
              <span className="workflow-layer-name"><strong>{layer.name}</strong><small>{layer.kind || '元素'}</small></span>
              {hasPixelLayers && <span className="workflow-layer-actions">
                <button type="button" aria-label={layer.visible === false ? '显示图层' : '隐藏图层'} onClick={event => { event.stopPropagation(); onToggleVisibility?.(layer); }}>{layer.visible === false ? <MdVisibilityOff size={15} /> : <MdOutlineVisibility size={15} />}</button>
                <button type="button" aria-label={layer.locked ? '解锁图层' : '锁定图层'} onClick={event => { event.stopPropagation(); onToggleLock?.(layer); }}>{layer.locked ? <MdLock size={15} /> : <MdLockOpen size={15} />}</button>
              </span>}
            </div>)}
            {!layers.length && <div className="workflow-empty-state">分析完成后会显示商品、人物、背景和文字图层</div>}
          </div>
          {hasPixelLayers && selectedLayer && <div className="workflow-layer-inspector">
            <div className="workflow-section-label"><strong>{selectedLayer.name}</strong><span>当前图层</span></div>
            <div className="workflow-layer-quick-actions"><button type="button" onClick={() => onMoveLayer?.(selectedLayer, 'up')}>上移</button><button type="button" onClick={() => onMoveLayer?.(selectedLayer, 'down')}>下移</button><button type="button" onClick={() => onAddToCanvas?.(selectedLayer)} disabled={!selectedLayer.url && !selectedLayer.preview_url}>放到画布</button></div>
            <div className="workflow-layer-capabilities"><span><MdOpenWith size={14} /> 可移动</span>{selectedLayer.kind === 'text' && <span><MdEdit size={14} /> 可编辑文字</span>}</div>
          </div>}
          <div className="workflow-node-footer-row">
            {hasPixelLayers
              ? <button type="button" className="workflow-secondary-button" onClick={() => onExportPng?.(selectedLayer)} disabled={!selectedLayer}><MdDownload size={15} /> 导出当前层</button>
              : <button type="button" className="workflow-secondary-button" onClick={onCreatePixelLayers} disabled={!onCreatePixelLayers}><MdLayers size={15} /> 生成像素分层</button>}
            <button type="button" className="workflow-primary-button" onClick={onExportPsd} disabled={!capabilities.psdExport} title={capabilities.psdExport ? '下载多图层 PSD' : '完成像素分层后可导出 PSD'}><MdDownload size={15} /> 下载 PSD</button>
          </div>
          {error && <div className="workflow-error-box"><span>{error}</span></div>}
        </>}
      </div>
    </CanvasNodeShell>
  );
}

export function CompactProcessNodeCard({ title, description, sourceImage, status = 'draft', selected = false, progress = 0, resultImage, error, onRun, onRetry, onPointerDown, onContextMenu, onPortPointerDown, onPortPointerUp }) {
  return <CanvasNodeShell title={title} subtitle={description} icon={MdAutoFixHigh} status={status} selected={selected} onRetry={onRetry} onPointerDown={onPointerDown} onContextMenu={onContextMenu} onPortPointerDown={onPortPointerDown} onPortPointerUp={onPortPointerUp} className="workflow-node-compact">
    <div className="workflow-node-body workflow-compact-body">
      <div className="workflow-compact-preview">{resultImage || sourceImage ? <img src={resultImage || sourceImage} alt={title} /> : <MdAutoFixHigh size={26} />}</div>
      {status === 'running' && <div className="workflow-progress"><span style={{ width: `${Math.max(5, Math.min(100, progress))}%` }} /></div>}
      {error && <div className="workflow-error-box"><span>{error}</span><button type="button" onClick={onRetry}>重试</button></div>}
      <button type="button" className="workflow-primary-button workflow-full-button" onClick={onRun} disabled={status === 'running'}>{status === 'running' ? '处理中…' : resultImage ? '再次处理' : '开始处理'}</button>
    </div>
  </CanvasNodeShell>;
}

export function CanvasWorkflowNode({ node, sourceNode, actions, selected = false, onActionSelect, onClose, onRetry, smartRemixProps = {}, layerProps = {}, compactProps = {}, onPointerDown, onContextMenu, onPortPointerDown, onPortPointerUp }) {
  return <ModularCanvasWorkflowNode
    node={node}
    sourceNode={sourceNode}
    actions={actions}
    selected={selected}
    onRetry={onRetry}
    smartRemixProps={smartRemixProps}
    layerProps={layerProps}
    compactProps={compactProps}
    onPointerDown={onPointerDown}
    onContextMenu={onContextMenu}
    onPortPointerDown={onPortPointerDown}
    onPortPointerUp={onPortPointerUp}
  />;
}
