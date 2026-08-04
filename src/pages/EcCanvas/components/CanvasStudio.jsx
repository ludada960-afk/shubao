import React, { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Check,
  Copy,
  Crop,
  Download,
  Eraser,
  FileText,
  FolderOpen,
  Grid2X2,
  ImagePlus,
  Info,
  Italic,
  Layers3,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  MessageSquareText,
  Move,
  Pencil,
  Plus,
  Redo2,
  ScanText,
  Scissors,
  Square,
  Sparkles,
  Trash2,
  Ungroup,
  Undo2,
  WandSparkles,
  X,
  ArrowUpRight,
} from 'lucide-react';
import ResponsiveImage from '../../../components/ResponsiveImage.jsx';
import ImageMentionPicker from '../../../components/creation/ImageMentionPicker.jsx';
import { CANVAS_RATIO_OPTIONS, CANVAS_RESOLUTION_OPTIONS, getCanvasNodePresentation } from '../canvasStudioModel.js';
import { getCanvasToolbarPosition, multiSelectionActionsForNodes, selectedCanvasBounds } from '../canvasInteractionModel.js';
import { createCanvasAnnotation, normalizeCanvasCropRect, normalizeCanvasPoint, updateCanvasAnnotation } from '../canvasInlineEditorModel.js';

const ACTION_ICONS = {
  'edit-text': FileText,
  'grid-split': Grid2X2,
  'layer-edit': Layers3,
  'remove-background': Eraser,
  'move-scale': Move,
  'reverse-prompt': WandSparkles,
  'image-info': Info,
  download: Download,
  'split-image': Scissors,
  'add-reference': ImagePlus,
  crop: Crop,
  annotation: ScanText,
  duplicate: Copy,
  delete: Trash2,
};

const ADD_ACTIONS = [
  { id: 'upload', label: '上传图片', description: '加入自己的商品图或参考图', icon: ImagePlus },
  { id: 'works', label: '从作品导入', description: '使用已生成的作品继续创作', icon: FolderOpen },
  { id: 'image', label: '生成图片', description: '用提示词或引用素材创建新图片', icon: WandSparkles },
  { id: 'text-generation', label: '生成文案', description: '结合提示词和参考图生成可编辑文案', icon: MessageSquareText },
  { id: 'ecommerce', label: '生成电商套图', description: '从商品素材创建完整套图', icon: Sparkles },
];

export function CanvasAddMenu({ open, onClose, onSelect, position = {} }) {
  if (!open) return null;
  return <div className="ec-canvas-add-menu" style={position} role="menu" aria-label="添加节点">
    <div className="ec-canvas-menu-heading"><strong>添加节点</strong><button type="button" aria-label="关闭添加菜单" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onClose?.(); }}><X size={15} /></button></div>
    {ADD_ACTIONS.map(item => <button key={item.id} type="button" role="menuitem" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onSelect?.(item.id); }}>
      <span><item.icon size={17} /></span>
      <span><strong>{item.label}</strong><small>{item.description}</small></span>
    </button>)}
  </div>;
}

export function CanvasObjectToolbar({ node, actions = [], viewport, bounds, onAction }) {
  if (!node || !actions.length) return null;
  const estimatedWidth = actions.reduce((total, action) => total + (['crop', 'split-image', 'download', 'delete'].includes(action.id) ? 48 : Math.max(88, String(action.label || '').length * 13 + 46)), 10);
  return <div
    className="ec-canvas-object-toolbar"
    role="toolbar"
    aria-label={`${node.name || node.displayLabel || '对象'}工具`}
    style={getCanvasToolbarPosition({ node, viewport, bounds, width: estimatedWidth, height: 48 })}
  >
    {actions.map(action => {
      const Icon = ACTION_ICONS[action.id] || WandSparkles;
      const compact = ['crop', 'split-image', 'download', 'delete'].includes(action.id);
      return <button key={action.id} type="button" className={compact ? 'is-compact' : ''} aria-label={action.label} title={action.label} onPointerDown={event => event.stopPropagation()} onClick={() => onAction?.(action, node)}>
        <Icon size={16} />{!compact && <span>{action.label}</span>}
      </button>;
    })}
  </div>;
}

export function CanvasDeriveMenu({ actions = [], position = {}, title = '引用当前素材生成', onBack, onClose, onSelect }) {
  const { x, y, ...positionStyle } = position || {};
  const menuStyle = {
    ...positionStyle,
    ...(x != null ? { left: x } : {}),
    ...(y != null ? { top: y } : {}),
  };
  return <div className="ec-canvas-derive-menu" style={menuStyle} role="menu" aria-label="从当前素材继续创作">
    <div className="ec-canvas-menu-heading">
      <span>{onBack && <button type="button" aria-label="返回创作类型" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onBack?.(); }}><ArrowLeft size={14} /></button>}{title}</span>
      <button type="button" aria-label="关闭派生菜单" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onClose?.(); }}><X size={15} /></button>
    </div>
    {actions.map(action => {
      const Icon = action.id === 'text-generation' ? MessageSquareText : action.id === 'ecommerce-suite' ? Sparkles : ImagePlus;
      return <button key={action.id} type="button" role="menuitem" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onSelect?.(action); }}>
        <span><Icon size={17} /></span>
        <span><strong>{action.label}</strong><small>{action.description}</small></span>
      </button>;
    })}
  </div>;
}

export function CanvasTextToolbar({ node, viewport, bounds, onStyleChange, onDuplicate, onFullscreen, onDelete }) {
  if (!node) return null;
  const style = node.textStyle || {};
  const controls = [
    { id: 'bold', label: '加粗', icon: Bold, active: style.fontWeight === 700, change: { fontWeight: style.fontWeight === 700 ? 400 : 700 } },
    { id: 'left', label: '左对齐', icon: AlignLeft, active: (style.textAlign || 'left') === 'left', change: { textAlign: 'left' } },
    { id: 'center', label: '居中', icon: AlignCenter, active: style.textAlign === 'center', change: { textAlign: 'center' } },
    { id: 'right', label: '右对齐', icon: AlignRight, active: style.textAlign === 'right', change: { textAlign: 'right' } },
  ];
  return <div className="ec-canvas-text-toolbar" role="toolbar" aria-label="文本样式" style={getCanvasToolbarPosition({ node, viewport, bounds, width: 600, height: 48 })}>
    <label className="ec-canvas-text-color" title="文字颜色"><input type="color" aria-label="文字颜色" value={style.color || '#20242a'} onChange={event => onStyleChange?.({ color: event.target.value })} /></label>
    {['H1', 'H2', 'H3', '正文'].map((label, index) => {
      const block = ['h1', 'h2', 'h3', 'body'][index];
      const fontSize = [34, 28, 22, 18][index];
      return <button key={block} type="button" className={style.block === block ? 'is-active' : ''} title={label} onPointerDown={event => event.stopPropagation()} onClick={() => onStyleChange?.({ block, fontSize })}>{label}</button>;
    })}
    {controls.map(control => <button key={control.id} type="button" className={control.active ? 'is-active' : ''} title={control.label} aria-label={control.label} aria-pressed={control.active} onPointerDown={event => event.stopPropagation()} onClick={() => onStyleChange?.(control.change)}><control.icon size={16} /></button>)}
    <button type="button" className={style.fontStyle === 'italic' ? 'is-active' : ''} title="斜体" aria-label="斜体" onPointerDown={event => event.stopPropagation()} onClick={() => onStyleChange?.({ fontStyle: style.fontStyle === 'italic' ? 'normal' : 'italic' })}><Italic size={16} /></button>
    <button type="button" className={style.list === 'unordered' ? 'is-active' : ''} title="项目符号" aria-label="项目符号" onPointerDown={event => event.stopPropagation()} onClick={() => onStyleChange?.({ list: style.list === 'unordered' ? 'none' : 'unordered' })}><List size={16} /></button>
    <button type="button" className={style.list === 'ordered' ? 'is-active' : ''} title="编号列表" aria-label="编号列表" onPointerDown={event => event.stopPropagation()} onClick={() => onStyleChange?.({ list: style.list === 'ordered' ? 'none' : 'ordered' })}><ListOrdered size={16} /></button>
    <i />
    <button type="button" title="创建副本" aria-label="创建副本" onPointerDown={event => event.stopPropagation()} onClick={onDuplicate}><Copy size={16} /></button>
    <button type="button" title="全屏编辑" aria-label="全屏编辑" onPointerDown={event => event.stopPropagation()} onClick={onFullscreen}><Maximize2 size={16} /></button>
    <button type="button" className="is-danger" title="删除文本" aria-label="删除文本" onPointerDown={event => event.stopPropagation()} onClick={onDelete}><Trash2 size={16} /></button>
  </div>;
}

const MULTI_ICONS = {
  'align-left': AlignLeft,
  'align-center': AlignCenter,
  'align-right': AlignRight,
  'auto-layout': Grid2X2,
  'bind-elements': Link2,
  'group-elements': Ungroup,
  'export-selection': Download,
  'merge-layers': Layers3,
  'delete-selection': Trash2,
};

export function CanvasMultiSelectionToolbar({ nodes = [], selectedIds = new Set(), viewport, bounds: containerBounds, onAction }) {
  const bounds = selectedCanvasBounds(nodes, selectedIds);
  const count = selectedIds instanceof Set ? selectedIds.size : (selectedIds || []).length;
  if (!bounds || count < 2) return null;
  return <div className="ec-canvas-multi-toolbar" role="toolbar" aria-label={`${count} 个对象操作`} style={getCanvasToolbarPosition({ node: bounds, viewport, bounds: containerBounds, width: 680, height: 46 })}>
    <strong>{count} 个已选中</strong>
    {multiSelectionActionsForNodes(nodes, selectedIds).map(action => {
      const Icon = MULTI_ICONS[action.id] || WandSparkles;
      return <button key={action.id} type="button" className={action.id === 'delete-selection' ? 'is-danger' : ''} title={action.label} onPointerDown={event => event.stopPropagation()} onClick={() => onAction?.(action.id)}><Icon size={15} /><span>{action.label}</span></button>;
    })}
  </div>;
}

function ComposerSources({ sources = [], onAddSources, onRemoveSource, uploadLabel = '图片' }) {
  return <div className="ec-canvas-composer-sources" aria-label={`已引用 ${sources.length} 张图片`}>
    {sources.slice(0, 6).map((source, index) => <span className="ec-canvas-composer-source" key={source.id || source.url || index}>
      <ResponsiveImage
        src={source.url}
        alt={source.name || `引用图片 ${index + 1}`}
        variant="canvas"
        ratio={source.ratio || '1:1'}
        sizes="72px"
        style={{ width: 72, height: 72 }}
        imgStyle={{ objectFit: 'contain' }}
      />
      <b>@图片{index + 1}</b>
      {onRemoveSource && <button type="button" data-canvas-control="true" aria-label={`移除${source.name || `引用图片 ${index + 1}`}`} onClick={event => { event.stopPropagation(); onRemoveSource(source.id); }}><X size={11} /></button>}
    </span>)}
    {onAddSources && <label className="ec-canvas-composer-source-add" aria-label={`添加${uploadLabel}`} title={`添加${uploadLabel}`}>
      <ImagePlus size={20} /><small>{uploadLabel}</small><input type="file" accept="image/*" multiple hidden onChange={event => { onAddSources([...event.target.files]); event.target.value = ''; }} />
    </label>}
  </div>;
}

function ComposerMention({ availableSources = [], sources = [], onToggleSource }) {
  return <div className="ec-canvas-composer-mention"><ImageMentionPicker images={availableSources} selectedImages={sources} onToggle={onToggleSource} /></div>;
}

export function CanvasGenerationNode({ node, selected = false, dimmed = false, onPointerDown, onContextMenu, onDoubleClick, onHoverChange, onPortPointerDown, onPortClick, onResizeStart }) {
  const isLayerGroup = node.kind === 'layer-group';
  const isText = node.kind === 'text-composer';
  const isImage = node.kind === 'image-composer' || isLayerGroup;
  const isSuite = node.kind === 'suite-composer';
  const direction = node.directions?.[node.selectedDirection || 0];
  return <article
    data-canvas-node-id={node.id}
    className={`ec-canvas-generation-node is-${isImage ? 'image' : isText ? 'text' : 'suite'} ${node.status === 'processing' ? 'is-processing' : ''} ${isLayerGroup ? 'is-layer-group' : ''} ${selected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''}`}
    style={{ left: node.x, top: node.y, width: node.w, height: node.h, visibility: node.hidden ? 'hidden' : 'visible' }}
    onPointerDown={event => onPointerDown?.(event, node.id)}
    onContextMenu={event => { event.preventDefault(); onContextMenu?.(event, node); }}
    onDoubleClick={event => { event.stopPropagation(); if (node.url) onDoubleClick?.(node); }}
    onMouseEnter={() => onHoverChange?.(node.id)}
    onMouseLeave={() => onHoverChange?.(null)}
  >
    {isImage && node.url ? <ResponsiveImage src={node.url} alt={node.name || '生成图片'} variant="canvas" ratio={node.ratio || '1:1'} style={{ width: '100%', height: '100%' }} imgStyle={{ objectFit: 'contain' }} /> : <div className="ec-canvas-generation-placeholder">
      {isText ? <MessageSquareText size={25} /> : isLayerGroup ? <Layers3 size={28} /> : isImage ? <ImagePlus size={28} /> : <Sparkles size={25} />}
      <strong>{isText ? '生成文案' : isLayerGroup ? '智能分层' : isImage ? (node.actionId ? '图片生成（编辑）' : '图片生成') : '电商套图'}</strong>
      {(isSuite || isLayerGroup) && <span>{isLayerGroup ? '识别商品、背景和文字，拖动后展开图层' : direction?.title || '在下方输入需求并发送，生成整体设计规范与图片规划'}</span>}
      {node.status === 'processing' && <small>{node.progressLabel || '正在处理...'}</small>}
      {node.error && <small className="is-error">{node.error}</small>}
    </div>}
    <ResizeHandles visible={selected && !node.locked} onResizeStart={onResizeStart} />
    <DerivePort visible={selected && Boolean(node.url)} disabled={!node.url} onPointerDown={onPortPointerDown} onClick={onPortClick} />
  </article>;
}

function ComposerPreview({ node, source, label = '图片生成', selection, onSelectionChange }) {
  const [start, setStart] = useState(null);
  const previewRef = useRef(null);
  const rect = selection?.mode === 'rectangle' ? selection.rect : null;
  const pointFromEvent = event => {
    const bounds = previewRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width))),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height))),
    };
  };
  const beginSelection = event => {
    if (node.actionId !== 'inpaint') return;
    event.stopPropagation();
    const point = pointFromEvent(event);
    setStart(point);
    onSelectionChange?.({ mode: 'rectangle', rect: { x: point.x, y: point.y, w: 0, h: 0 } });
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const moveSelection = event => {
    if (!start) return;
    event.stopPropagation();
    const point = pointFromEvent(event);
    onSelectionChange?.({ mode: 'rectangle', rect: {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      w: Math.abs(point.x - start.x),
      h: Math.abs(point.y - start.y),
    } });
  };
  const finishSelection = event => {
    event.stopPropagation();
    setStart(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  return <div className={`ec-canvas-composer-preview ${node.actionId === 'inpaint' ? 'is-selectable' : ''}`} ref={previewRef} onPointerDown={beginSelection} onPointerMove={moveSelection} onPointerUp={finishSelection} onPointerCancel={finishSelection}>
    {source?.url ? <ResponsiveImage src={source.url} alt={source.name || label} variant="canvas" ratio={source.ratio || node.ratio || '1:1'} sizes="240px" style={{ width: '100%', height: '100%' }} imgStyle={{ objectFit: 'contain' }} /> : <><ImagePlus size={24} /><span>{label}</span><small>在下方添加参考图和生成要求</small></>}
    {rect && <span className="ec-canvas-selection-rect" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }} />}
    {node.actionId === 'inpaint' && <em>拖拽框选需要修改的区域</em>}
  </div>;
}

export function CanvasImageComposer({ node, position, sources = [], availableSources = [], loading = false, onChange, onAddSources, onRemoveSource, onToggleSource, onGenerate }) {
  if (!node) return null;
  const source = sources[0];
  const isLocalEdit = node.actionId === 'inpaint';
  return <section className="ec-canvas-node-composer ec-canvas-context-composer ec-canvas-image-composer" style={position} aria-label={isLocalEdit ? '局部改图操作台' : '图片生成操作台'} onPointerDown={event => event.stopPropagation()}>
      {isLocalEdit && <ComposerPreview node={node} source={source} label="局部改图" selection={node.selection} onSelectionChange={selection => onChange?.({ selection })} />}
      <ComposerSources sources={sources} onAddSources={onAddSources} onRemoveSource={onRemoveSource} />
      {isLocalEdit && <div className="ec-canvas-selection-mode" role="group" aria-label="局部目标">
        <span>局部目标</span>
        {['whole', 'rectangle', 'subject'].map(mode => <button key={mode} type="button" className={node.selection?.mode === mode || (!node.selection && mode === 'whole') ? 'is-active' : ''} data-canvas-control="true" onClick={event => { event.stopPropagation(); onChange?.({ selection: { mode } }); }}>{mode === 'whole' ? '整图' : mode === 'rectangle' ? '框选' : '主体'}</button>)}
      </div>}
      <textarea
        data-canvas-control="true"
        value={node.prompt || ''}
        disabled={loading}
        placeholder={isLocalEdit ? '描述要保留和修改的内容，可选框选或主体目标' : '描述你想生成的画面，商品结构、品牌和文字会优先保持一致'}
        onChange={event => onChange?.({ prompt: event.target.value })}
      />
      <div className="ec-canvas-composer-footer">
        <select data-canvas-control="true" aria-label="图片比例" value={node.ratio || '1:1'} onChange={event => onChange?.({ ratio: event.target.value })}>{CANVAS_RATIO_OPTIONS.map((ratio, index) => <option key={ratio} value={ratio}>{index === 0 ? '自动 / 1:1' : ratio}</option>)}</select>
        <select data-canvas-control="true" aria-label="清晰度" value={node.resolution || '2K'} onChange={event => onChange?.({ resolution: event.target.value })}>{CANVAS_RESOLUTION_OPTIONS.map(value => <option key={value}>{value}</option>)}</select>
        <select data-canvas-control="true" aria-label="生成数量" value={node.count || 1} onChange={event => onChange?.({ count: Number(event.target.value) })}>{[1, 2, 3, 4].map(count => <option key={count} value={count}>x{count}</option>)}</select>
        <ComposerMention availableSources={availableSources} sources={sources} onToggleSource={onToggleSource} />
        <button type="button" data-canvas-control="true" disabled={loading || !String(node.prompt || '').trim() || (isLocalEdit && !sources.length)} onClick={event => { event.stopPropagation(); onGenerate?.(); }}>
          {loading ? '生成中' : <><Sparkles size={15} />生成</>}
        </button>
      </div>
  </section>;
}

export function CanvasTextGenerationComposer({ node, position, sources = [], availableSources = [], loading = false, onChange, onAddSources, onRemoveSource, onToggleSource, onGenerate }) {
  if (!node) return null;
  return <section className="ec-canvas-node-composer ec-canvas-context-composer ec-canvas-text-generation-composer" style={position} aria-label="文案生成操作台" onPointerDown={event => event.stopPropagation()}>
    <ComposerSources sources={sources} onAddSources={onAddSources} onRemoveSource={onRemoveSource} />
    <textarea data-canvas-control="true" value={node.prompt || ''} disabled={loading} placeholder="描述要生成的标题、卖点、详情文案或设计要求" onChange={event => onChange?.({ prompt: event.target.value })} />
    <div className="ec-canvas-composer-footer">
      <select data-canvas-control="true" aria-label="文案数量" value={node.count || 1} onChange={event => onChange?.({ count: Number(event.target.value) })}>{[1, 2, 3, 4].map(count => <option key={count} value={count}>x{count}</option>)}</select>
      <span>{sources.length ? `已引用 ${sources.length} 张图片` : '可直接编辑上方文案，或在这里继续生成'}</span>
      <ComposerMention availableSources={availableSources} sources={sources} onToggleSource={onToggleSource} />
      <button type="button" data-canvas-control="true" disabled={loading || !String(node.prompt || '').trim()} onClick={event => { event.stopPropagation(); onGenerate?.(); }}>{loading ? '生成中' : <><Sparkles size={15} />生成</>}</button>
    </div>
  </section>;
}

export function CanvasEcommerceComposer({ node, position, sources = [], availableSources = [], loading = false, onChange, onAddSources, onRemoveSource, onToggleSource, onGenerate, onChooseDirection }) {
  if (!node) return null;
  const directions = Array.isArray(node.directions) ? node.directions : [];
  const planning = node.suiteStep === 'directions';
  return <section data-canvas-control="true" className="ec-canvas-node-composer ec-canvas-context-composer ec-canvas-suite-composer" style={position} aria-label={planning ? '选择设计方案' : '电商套图操作台'} onPointerDown={event => event.stopPropagation()}>
    {!planning && <div className="ec-canvas-suite-source-rows">
      <ComposerSources sources={sources.filter(source => (node.sourceRoles?.[source.id] || source.role) === 'product')} onAddSources={files => onAddSources?.(files, 'product')} onRemoveSource={onRemoveSource} uploadLabel="产品图" />
      <ComposerSources sources={sources.filter(source => (node.sourceRoles?.[source.id] || source.role) !== 'product')} onAddSources={files => onAddSources?.(files, 'reference')} onRemoveSource={onRemoveSource} uploadLabel="参考图" />
    </div>}
    {!planning ? <>
      <textarea data-canvas-control="true" value={node.prompt || ''} disabled={loading} placeholder="补充商品卖点、目标人群、使用场景或想要的视觉方向" onChange={event => onChange?.({ prompt: event.target.value })} />
      <div className="ec-canvas-suite-options">
        <label>目标平台<select data-canvas-control="true" value={node.platform || '淘宝'} onChange={event => onChange?.({ platform: event.target.value })}>{['淘宝', '天猫', '京东', '拼多多', '小红书'].map(platform => <option key={platform}>{platform}</option>)}</select></label>
        <label>主图比例<select data-canvas-control="true" value={node.ratio || '1:1'} onChange={event => onChange?.({ ratio: event.target.value })}>{CANVAS_RATIO_OPTIONS.slice(0, 3).map(ratio => <option key={ratio}>{ratio}</option>)}</select></label>
        <label>清晰度<select data-canvas-control="true" aria-label="清晰度" value={node.resolution || '2K'} onChange={event => onChange?.({ resolution: event.target.value })}>{CANVAS_RESOLUTION_OPTIONS.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>语言<select data-canvas-control="true" value={node.language || '中文'} onChange={event => onChange?.({ language: event.target.value })}><option>中文</option><option>英文</option></select></label>
        <label>套图数量<select data-canvas-control="true" aria-label="套图数量" value={node.count || 6} onChange={event => onChange?.({ count: Number(event.target.value) })}>{[3, 6, 9, 12].map(value => <option key={value} value={value}>{value} 张</option>)}</select></label>
      </div>
    </> : <div className="ec-canvas-direction-list" aria-label="设计方案">
      {directions.map((direction, index) => <button key={direction.id || index} type="button" data-canvas-control="true" className={node.selectedDirection === index ? 'is-selected' : ''} onClick={event => { event.stopPropagation(); onChooseDirection?.(direction, index); }}><strong>{direction.title || direction.name || `方案 ${index + 1}`}</strong><small>{direction.hook || direction.description || direction.summary || '保留商品主体，生成一套完整电商视觉'}</small></button>)}
      {!directions.length && <p>正在整理商品卖点和视觉方向...</p>}
    </div>}
    <div className="ec-canvas-composer-footer">
      <span>{planning ? '选中方案后再生成套图' : '先分析商品与参考图，再进入设计方案'}</span>
      <ComposerMention availableSources={availableSources} sources={sources} onToggleSource={(source) => onToggleSource?.(source, node.sourceRoles?.[source.id] || 'reference')} />
      <button type="button" data-canvas-control="true" disabled={loading || (!planning && !sources.length) || (!planning && !String(node.prompt || '').trim()) || (planning && node.selectedDirection == null)} onClick={event => { event.stopPropagation(); onGenerate?.(); }}>{loading ? '处理中' : <><Sparkles size={15} />{planning ? '开始生成' : '生成设计方案'}</>}</button>
    </div>
  </section>;
}

const FOCUSED_EDITOR_LABELS = {
  crop: '裁剪图片',
  'split-image': '分割图片',
  annotation: '图片标注',
  'move-scale': '移动缩放',
  'grid-split': '宫格切分',
};

export function CanvasFocusedEditor({ mode, node, options = {}, onOptionChange, onCancel, onConfirm }) {
  const gestureRef = useRef(null);
  useEffect(() => {
    if (mode !== 'annotation') return undefined;
    const handleKeyDown = event => {
      if (!(event.ctrlKey || event.metaKey) || !['z', 'y'].includes(event.key.toLowerCase())) return;
      event.preventDefault();
      const annotations = options.annotations || [];
      if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
        const history = [...(options.annotationHistory || [])];
        if (!history.length) return;
        const previous = history.pop();
        onOptionChange?.({ ...options, annotations: previous, annotationHistory: history, annotationFuture: [annotations, ...(options.annotationFuture || [])].slice(0, 20) });
      } else {
        const future = [...(options.annotationFuture || [])];
        if (!future.length) return;
        const next = future.shift();
        onOptionChange?.({ ...options, annotations: next, annotationHistory: [...(options.annotationHistory || []), annotations].slice(-20), annotationFuture: future });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, onOptionChange, options]);
  if (!mode || !node?.url) return null;
  const isGrid = mode === 'grid-split';
  const isSplit = mode === 'split-image';
  const isAnnotation = mode === 'annotation';
  const isMoveScale = mode === 'move-scale';
  const ratios = mode === 'crop' ? ['原比例', '自由', '1:1', '3:4', '4:3', '9:16'] : [];
  const annotations = options.annotations || [];
  const cropRect = normalizeCanvasCropRect(options.cropRect || { x: 0.08, y: 0.08, w: 0.84, h: 0.84 });
  const pointFromEvent = event => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return normalizeCanvasPoint({
      x: (event.clientX - bounds.left) / Math.max(1, bounds.width),
      y: (event.clientY - bounds.top) / Math.max(1, bounds.height),
    });
  };
  const commitAnnotations = next => onOptionChange?.({
    ...options,
    annotations: next,
    annotationHistory: [...(options.annotationHistory || []), annotations].slice(-20),
    annotationFuture: [],
  });
  const undoAnnotation = () => {
    const history = [...(options.annotationHistory || [])];
    if (!history.length) return;
    const previous = history.pop();
    onOptionChange?.({ ...options, annotations: previous, annotationHistory: history, annotationFuture: [annotations, ...(options.annotationFuture || [])].slice(0, 20) });
  };
  const redoAnnotation = () => {
    const future = [...(options.annotationFuture || [])];
    if (!future.length) return;
    const next = future.shift();
    onOptionChange?.({ ...options, annotations: next, annotationHistory: [...(options.annotationHistory || []), annotations].slice(-20), annotationFuture: future });
  };
  const setCropRatio = ratio => {
    if (ratio === '原比例' || ratio === '自由') {
      onOptionChange?.({ ...options, ratio, cropRect: ratio === '原比例' ? { x: 0, y: 0, w: 1, h: 1 } : cropRect });
      return;
    }
    const [rw, rh] = ratio.split(':').map(Number);
    const target = rw / rh;
    const source = Math.max(0.01, Number(node.w) / Math.max(1, Number(node.h)));
    const rect = target >= source
      ? { x: 0, y: (1 - source / target) / 2, w: 1, h: source / target }
      : { x: (1 - target / source) / 2, y: 0, w: target / source, h: 1 };
    onOptionChange?.({ ...options, ratio, cropRect: normalizeCanvasCropRect(rect) });
  };
  const onStagePointerDown = event => {
    event.stopPropagation();
    const point = pointFromEvent(event);
    if (isAnnotation) {
      const shape = createCanvasAnnotation(options.annotationTool || 'pen', point, {
        color: options.annotationColor,
        width: options.annotationWidth,
        text: options.annotation,
      });
      commitAnnotations([...annotations, shape]);
      if (shape.tool !== 'text') gestureRef.current = { kind: 'annotation', id: shape.id };
    } else if (isSplit) {
      const splitPosition = (options.direction || 'vertical') === 'vertical' ? point.x : point.y;
      onOptionChange?.({ ...options, splitPosition });
      gestureRef.current = { kind: 'split' };
    } else if (mode === 'crop') {
      onOptionChange?.({ ...options, ratio: '自由', cropRect: { x: point.x, y: point.y, w: 0, h: 0 } });
      gestureRef.current = { kind: 'crop', start: point };
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onStagePointerMove = event => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    event.stopPropagation();
    const point = pointFromEvent(event);
    if (gesture.kind === 'annotation') {
      const current = options.annotations || [];
      onOptionChange?.({ ...options, annotations: current.map(shape => shape.id === gesture.id ? updateCanvasAnnotation(shape, point) : shape) });
    } else if (gesture.kind === 'split') {
      onOptionChange?.({ ...options, splitPosition: (options.direction || 'vertical') === 'vertical' ? point.x : point.y });
    } else if (gesture.kind === 'crop') {
      onOptionChange?.({
        ...options,
        ratio: '自由',
        cropRect: normalizeCanvasCropRect({
          x: Math.min(gesture.start.x, point.x),
          y: Math.min(gesture.start.y, point.y),
          w: Math.abs(point.x - gesture.start.x),
          h: Math.abs(point.y - gesture.start.y),
        }),
      });
    }
  };
  const finishGesture = event => {
    event.stopPropagation();
    gestureRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  const previewTransform = isMoveScale
    ? `translate(${Number(options.offsetX) || 0}px, ${Number(options.offsetY) || 0}px) scale(${Number(options.scale) || 1})`
    : undefined;
  return <div className={`ec-canvas-focused-editor is-${mode}`} aria-label={FOCUSED_EDITOR_LABELS[mode] || '图片编辑'} style={{ left: node.x, top: node.y, width: node.w, height: node.h }} onPointerDown={event => event.stopPropagation()}>
    <div className="ec-canvas-focused-stage" onPointerDown={onStagePointerDown} onPointerMove={onStagePointerMove} onPointerUp={finishGesture} onPointerCancel={finishGesture}>
      <ResponsiveImage src={node.url} alt={node.name || '待编辑图片'} variant="canvas" sizes={`${Math.ceil(node.w)}px`} style={{ width: '100%', height: '100%', transform: previewTransform }} imgStyle={{ objectFit: 'contain' }} />
      {mode === 'crop' && <div className="ec-canvas-crop-frame" style={{ left: `${cropRect.x * 100}%`, top: `${cropRect.y * 100}%`, width: `${cropRect.w * 100}%`, height: `${cropRect.h * 100}%` }}><i /><i /><i /><i /></div>}
      {isSplit && <span className={`ec-canvas-split-guide is-${options.direction || 'vertical'}`} style={(options.direction || 'vertical') === 'vertical' ? { left: `${(options.splitPosition ?? 0.5) * 100}%` } : { top: `${(options.splitPosition ?? 0.5) * 100}%` }} />}
      {isGrid && <span className={`ec-canvas-grid-guide is-grid-${options.grid || 3}`} />}
      {isAnnotation && <svg className={`ec-canvas-annotation-layer is-${options.annotationTool || 'pen'}`} aria-label="标注区域" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <defs><marker id="ec-canvas-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="context-stroke" /></marker></defs>
        {annotations.map(shape => {
          const strokeWidth = Math.max(2, Number(shape.width || 3) * 2);
          if (shape.tool === 'pen') return <polyline key={shape.id} points={(shape.points || []).map(point => `${point.x * 1000},${point.y * 1000}`).join(' ')} fill="none" stroke={shape.color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
          if (shape.tool === 'rectangle') return <rect key={shape.id} x={shape.x * 1000} y={shape.y * 1000} width={shape.w * 1000} height={shape.h * 1000} fill="none" stroke={shape.color} strokeWidth={strokeWidth} />;
          if (shape.tool === 'arrow') return <line key={shape.id} x1={shape.x1 * 1000} y1={shape.y1 * 1000} x2={shape.x2 * 1000} y2={shape.y2 * 1000} stroke={shape.color} strokeWidth={strokeWidth} strokeLinecap="round" markerEnd="url(#ec-canvas-arrow)" />;
          return <text key={shape.id} x={shape.x * 1000} y={shape.y * 1000} fill={shape.color} fontSize={Math.max(32, strokeWidth * 8)} fontWeight="700">{shape.text}</text>;
        })}
      </svg>}
    </div>
    <div className="ec-canvas-focused-toolbar" role="toolbar" aria-label={FOCUSED_EDITOR_LABELS[mode]}>
      <strong>{FOCUSED_EDITOR_LABELS[mode]}</strong>
      {ratios.map(ratio => <button key={ratio} type="button" className={(options.ratio || '原比例') === ratio ? 'is-active' : ''} onClick={() => setCropRatio(ratio)}>{ratio}</button>)}
      {isGrid && [2, 3, 4, 5].map(grid => <button key={grid} type="button" className={(options.grid || 3) === grid ? 'is-active' : ''} onClick={() => onOptionChange?.({ ...options, grid })}>{grid} x {grid}</button>)}
      {isSplit && ['vertical', 'horizontal'].map(direction => <button key={direction} type="button" className={(options.direction || 'vertical') === direction ? 'is-active' : ''} onClick={() => onOptionChange?.({ ...options, direction })}>{direction === 'vertical' ? '垂直分割' : '水平分割'}</button>)}
      {isAnnotation && <>
        {[
          ['pen', '画笔', Pencil],
          ['rectangle', '矩形', Square],
          ['arrow', '箭头', ArrowUpRight],
          ['text', '文字', FileText],
        ].map(([tool, label, Icon]) => <button key={tool} type="button" title={label} aria-label={label} className={(options.annotationTool || 'pen') === tool ? 'is-active' : ''} onClick={() => onOptionChange?.({ ...options, annotationTool: tool })}><Icon size={15} /></button>)}
        <label className="ec-canvas-focused-field is-icon-only" title="标注颜色"><span className="sr-only">颜色</span><input type="color" aria-label="标注颜色" value={options.annotationColor || '#ef4444'} onChange={event => onOptionChange?.({ ...options, annotationColor: event.target.value })} /></label>
        <label className="ec-canvas-focused-field is-icon-only" title={`标注粗细 ${options.annotationWidth || 3}px`}><span className="sr-only">粗细</span><input type="range" aria-label="标注粗细" min="1" max="12" value={options.annotationWidth || 3} onChange={event => onOptionChange?.({ ...options, annotationWidth: Number(event.target.value) })} /></label>
        <input className="ec-canvas-focused-text is-compact" type="text" aria-label="标注说明" title="标注文字" placeholder="文字" value={options.annotation || ''} onChange={event => onOptionChange?.({ ...options, annotation: event.target.value })} />
        <button type="button" title="撤销" aria-label="撤销" disabled={!options.annotationHistory?.length} onClick={undoAnnotation}><Undo2 size={15} /></button>
        <button type="button" title="重做" aria-label="重做" disabled={!options.annotationFuture?.length} onClick={redoAnnotation}><Redo2 size={15} /></button>
        <button type="button" title="清除标注" aria-label="清除标注" onClick={() => commitAnnotations([])}><Eraser size={15} /></button>
      </>}
      {isMoveScale && <>
        <label className="ec-canvas-focused-field is-wide"><span>缩放</span><input type="range" aria-label="缩放比例" min="0.5" max="2" step="0.05" value={options.scale || 1} onChange={event => onOptionChange?.({ ...options, scale: Number(event.target.value) })} /><output>{Math.round((options.scale || 1) * 100)}%</output></label>
        <label className="ec-canvas-focused-field"><span>水平</span><input type="number" aria-label="水平偏移" value={options.offsetX || 0} onChange={event => onOptionChange?.({ ...options, offsetX: Number(event.target.value) })} /></label>
        <label className="ec-canvas-focused-field"><span>垂直</span><input type="number" aria-label="垂直偏移" value={options.offsetY || 0} onChange={event => onOptionChange?.({ ...options, offsetY: Number(event.target.value) })} /></label>
      </>}
      <i />
      <button type="button" onClick={onCancel}><X size={15} />取消</button>
      <button type="button" className="is-primary" onClick={onConfirm}><Check size={15} />完成</button>
    </div>
  </div>;
}

function DerivePort({ visible, disabled, onPointerDown, onPointerUp, onClick }) {
  return <button
    type="button"
    className="ec-canvas-node-port"
    data-canvas-control="true"
    data-canvas-port-role="output"
    aria-label="从当前素材继续创作"
    title="继续创作"
    disabled={disabled}
    tabIndex={visible ? 0 : -1}
    style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? 'auto' : 'none' }}
    onPointerDown={event => { event.stopPropagation(); onPointerDown?.(event); }}
    onPointerUp={event => { onPointerUp?.(event); }}
    onClick={event => { event.stopPropagation(); onClick?.(event); }}
  ><Plus size={16} /></button>;
}

function ResizeHandles({ visible, onResizeStart }) {
  if (!visible) return null;
  return ['nw', 'ne', 'se', 'sw'].map(corner => <button
    key={corner}
    type="button"
    aria-label={`从${corner}调整尺寸`}
    className={`ec-canvas-resize-handle is-${corner}`}
    data-canvas-control="true"
    onPointerDown={event => { event.stopPropagation(); onResizeStart?.(event, corner); }}
  />);
}

export function CanvasImageNode({
  node,
  selected = false,
  hovered = false,
  focusActive = false,
  related = false,
  onPointerDown,
  onContextMenu,
  onDoubleClick,
  onHoverChange,
  onPortPointerDown,
  onPortPointerUp,
  onPortClick,
  onResizeStart,
}) {
  const presentation = getCanvasNodePresentation({ selected, hovered, focusActive, related });
  return <article
    data-canvas-node-id={node.id}
    className={`ec-canvas-media-node is-${presentation.state} ${presentation.dimmed ? 'is-dimmed' : ''}`}
    style={{ left: node.x, top: node.y, width: node.w, zIndex: Number.isFinite(node.zIndex) ? node.zIndex : undefined, visibility: node.hidden ? 'hidden' : 'visible' }}
    onPointerDown={event => onPointerDown?.(event, node.id)}
    onContextMenu={event => { event.preventDefault(); onContextMenu?.(event, node); }}
    onDoubleClick={event => { event.stopPropagation(); onDoubleClick?.(node); }}
    onMouseEnter={() => onHoverChange?.(node.id)}
    onMouseLeave={() => onHoverChange?.(null)}
  >
    <div className="ec-canvas-media-frame" style={{ height: node.h }}>
      <ResponsiveImage
        src={node.url}
        alt={node.name || node.displayLabel || '电商图片'}
        variant="canvas"
        sizes={`${Math.ceil(node.w)}px`}
        ratio={node.ratio}
        style={{ width: '100%', height: '100%' }}
        imgStyle={{ objectFit: 'contain', objectPosition: 'center', transform: `${node.flipX ? 'scaleX(-1)' : ''} ${node.flipY ? 'scaleY(-1)' : ''}`.trim() || undefined }}
      />
    </div>
    {node.showMeta !== false && <footer>
      <strong>{node.name || node.displayLabel || '未命名图片'}</strong>
      <span>{[node.group, node.ratio, node.size].filter(Boolean).join(' · ')}</span>
    </footer>}
    <ResizeHandles visible={selected && !node.locked} onResizeStart={onResizeStart} />
    <DerivePort visible={presentation.handlesVisible} disabled={!node.url} onPointerDown={onPortPointerDown} onPointerUp={onPortPointerUp} onClick={onPortClick} />
  </article>;
}

export function CanvasSourceNode({
  node,
  selected = false,
  dimmed = false,
  onPointerDown,
  onContextMenu,
  onDoubleClick,
  onHoverChange,
  onPortPointerDown,
  onPortClick,
}) {
  const assets = (node.assets || []).filter(asset => asset?.url);
  return <article
    data-canvas-node-id={node.id}
    className={`ec-canvas-source-node ${selected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''}`}
    style={{ left: node.x, top: node.y, width: node.w, minHeight: node.h }}
    onPointerDown={event => onPointerDown?.(event, node.id)}
    onContextMenu={event => { event.preventDefault(); onContextMenu?.(event, node); }}
    onDoubleClick={event => { event.stopPropagation(); if (assets[0]) onDoubleClick?.({ ...node, url: assets[0].url }); }}
    onMouseEnter={() => onHoverChange?.(node.id)}
    onMouseLeave={() => onHoverChange?.(null)}
  >
    <div className="ec-canvas-source-heading"><span>商品素材</span><strong>{node.name || '产品母图'}</strong></div>
    <div className="ec-canvas-source-grid">
      {assets.slice(0, 4).map((asset, index) => <ResponsiveImage
        key={asset.assetId || asset.id || index}
        src={asset.url}
        alt={asset.name || `商品素材 ${index + 1}`}
        variant="thumb"
        ratio="1:1"
        sizes="112px"
        style={{ width: '100%', height: '100%' }}
        imgStyle={{ objectFit: 'contain' }}
      />)}
      {!assets.length && <div className="ec-canvas-source-empty">商品原图暂不可用</div>}
    </div>
    <DerivePort visible={selected} disabled={!assets.length} onPointerDown={onPortPointerDown} onClick={onPortClick} />
  </article>;
}

export function CanvasTextNode({ node, selected = false, editing = false, dimmed = false, onPointerDown, onContextMenu, onChange, onSelect, onDoubleClick, onBlur }) {
  return <article
    data-canvas-node-id={node.id}
    className={`ec-canvas-copy-node ${selected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''}`}
    style={{ left: node.x, top: node.y, width: node.w, minHeight: node.h }}
    onPointerDown={event => { if (!editing) onPointerDown?.(event, node.id); }}
    onDoubleClick={event => { event.stopPropagation(); onDoubleClick?.(node.id); }}
    onContextMenu={event => { event.preventDefault(); onContextMenu?.(event, node); }}
  >
    <div
      contentEditable={editing}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder={node.placeholder || '输入文字'}
      style={node.textStyle || undefined}
      onFocus={() => onSelect?.(node.id)}
      onInput={event => onChange?.(node.id, event.currentTarget.textContent || '')}
      onBlur={() => onBlur?.(node.id)}
    >{node.text || ''}</div>
  </article>;
}
