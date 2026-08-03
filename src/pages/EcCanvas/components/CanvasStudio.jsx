import React, { useRef } from 'react';
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
import { getCanvasNodePresentation } from '../canvasStudioModel.js';
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
  { id: 'text', label: '添加文字', description: '在画布中添加可编辑文字', icon: FileText },
  { id: 'ecommerce', label: '生成电商套图', description: '从商品素材创建完整套图', icon: Sparkles },
];

export function CanvasAddMenu({ open, onClose, onSelect, position = {} }) {
  if (!open) return null;
  return <div className="ec-canvas-add-menu" style={position} role="menu" aria-label="添加节点">
    <div className="ec-canvas-menu-heading"><strong>添加节点</strong><button type="button" aria-label="关闭添加菜单" onClick={onClose}><X size={15} /></button></div>
    {ADD_ACTIONS.map(item => <button key={item.id} type="button" role="menuitem" onClick={() => onSelect?.(item.id)}>
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
      <span>{onBack && <button type="button" aria-label="返回创作类型" onClick={onBack}><ArrowLeft size={14} /></button>}{title}</span>
      <button type="button" aria-label="关闭派生菜单" onClick={onClose}><X size={15} /></button>
    </div>
    {actions.map(action => {
      const Icon = action.id === 'text-generation' ? MessageSquareText : action.id === 'ecommerce-suite' ? Sparkles : ImagePlus;
      return <button key={action.id} type="button" role="menuitem" onClick={() => onSelect?.(action)}>
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

export function CanvasTextComposer({ node, position, value = '', loading = false, onChange, onSubmit, onClose }) {
  if (!node) return null;
  return <section className="ec-canvas-node-composer ec-canvas-text-composer" style={position} aria-label="生成文案">
    <div className="ec-canvas-composer-heading"><strong>从当前内容继续创作</strong><button type="button" aria-label="关闭文案生成器" onClick={onClose}><X size={15} /></button></div>
    <textarea value={value} disabled={loading} placeholder="描述要生成的标题、卖点、详情文案或设计要求" onChange={event => onChange?.(event.target.value)} />
    <div className="ec-canvas-composer-footer"><span>电商文案</span><button type="button" disabled={loading || !value.trim()} onClick={onSubmit}>{loading ? '生成中' : <><Sparkles size={15} />生成</>}</button></div>
  </section>;
}

function ComposerSources({ sources = [], onAddSources, onRemoveSource }) {
  return <div className="ec-canvas-composer-sources" aria-label={`已引用 ${sources.length} 张图片`}>
    {sources.slice(0, 6).map((source, index) => <span className="ec-canvas-composer-source" key={source.id || source.url || index}>
      <ResponsiveImage
        src={source.url}
        alt={source.name || `引用图片 ${index + 1}`}
        variant="thumb"
        ratio="1:1"
        sizes="48px"
        style={{ width: 48, height: 48 }}
        imgStyle={{ objectFit: 'contain' }}
      />
      {onRemoveSource && <button type="button" data-canvas-control="true" aria-label={`移除${source.name || `引用图片 ${index + 1}`}`} onClick={() => onRemoveSource(source.id)}><X size={11} /></button>}
    </span>)}
    {!sources.length && <span><ImagePlus size={18} />可直接描述画面，也可先连接一张商品图</span>}
    {onAddSources && <label className="ec-canvas-composer-source-add" aria-label="添加参考图片" title="添加参考图片">
      <ImagePlus size={17} /><input type="file" accept="image/*" multiple hidden onChange={event => { onAddSources([...event.target.files]); event.target.value = ''; }} />
    </label>}
  </div>;
}

export function CanvasImageComposer({ node, sources = [], loading = false, onPointerDown, onChange, onAddSources, onRemoveSource, onGenerate, onClose }) {
  if (!node) return null;
  return <article
    data-canvas-node-id={node.id}
    className="ec-canvas-node-composer ec-canvas-image-composer"
    style={{ left: node.x, top: node.y, width: node.w, minHeight: node.h, visibility: node.hidden ? 'hidden' : 'visible' }}
  >
    <div className="ec-canvas-composer-heading" onPointerDown={event => onPointerDown?.(event, node.id)}>
      <span><WandSparkles size={16} /><strong>图片生成与编辑</strong></span>
      <button type="button" aria-label="关闭图片生成器" data-canvas-control="true" onClick={onClose}><X size={15} /></button>
    </div>
    <ComposerSources sources={sources} onAddSources={onAddSources} onRemoveSource={onRemoveSource} />
    <textarea
      data-canvas-control="true"
      value={node.prompt || ''}
      disabled={loading}
      placeholder="描述你想生成或修改的画面，商品结构、品牌和文字会优先保持一致"
      onChange={event => onChange?.({ prompt: event.target.value })}
    />
    <div className="ec-canvas-composer-footer">
      <select data-canvas-control="true" aria-label="图片比例" value={node.ratio || '1:1'} onChange={event => onChange?.({ ratio: event.target.value })}>
        {['1:1', '3:4', '4:3', '9:16'].map(ratio => <option key={ratio} value={ratio}>{ratio}</option>)}
      </select>
      <select data-canvas-control="true" aria-label="生成数量" value={node.count || 1} onChange={event => onChange?.({ count: Number(event.target.value) })}>
        {[1, 2, 3, 4].map(count => <option key={count} value={count}>{count} 张</option>)}
      </select>
      <span>GPT Image 2</span>
      <button type="button" data-canvas-control="true" disabled={loading || !String(node.prompt || '').trim()} onClick={onGenerate}>
        {loading ? '生成中' : <><Sparkles size={15} />生成</>}
      </button>
    </div>
  </article>;
}

export function CanvasEcommerceComposer({ node, sources = [], loading = false, onPointerDown, onChange, onAddSources, onRemoveSource, onGenerate, onClose }) {
  if (!node) return null;
  return <article
    data-canvas-node-id={node.id}
    className="ec-canvas-node-composer ec-canvas-suite-composer"
    style={{ left: node.x, top: node.y, width: node.w, minHeight: node.h, visibility: node.hidden ? 'hidden' : 'visible' }}
  >
    <div className="ec-canvas-composer-heading" onPointerDown={event => onPointerDown?.(event, node.id)}>
      <span><Sparkles size={16} /><strong>生成电商套图</strong></span>
      <button type="button" aria-label="关闭电商套图生成器" data-canvas-control="true" onClick={onClose}><X size={15} /></button>
    </div>
    <ComposerSources sources={sources} onAddSources={onAddSources} onRemoveSource={onRemoveSource} />
    <textarea
      data-canvas-control="true"
      value={node.prompt || ''}
      disabled={loading}
      placeholder="补充商品卖点、目标人群、使用场景或想要的视觉方向"
      onChange={event => onChange?.({ prompt: event.target.value })}
    />
    <div className="ec-canvas-suite-options">
      <label>平台<select data-canvas-control="true" value={node.platform || '淘宝'} onChange={event => onChange?.({ platform: event.target.value })}>{['淘宝', '天猫', '京东', '拼多多', '小红书'].map(platform => <option key={platform}>{platform}</option>)}</select></label>
      <label>主图比例<select data-canvas-control="true" value={node.ratio || '1:1'} onChange={event => onChange?.({ ratio: event.target.value })}>{['1:1', '3:4', '4:3'].map(ratio => <option key={ratio}>{ratio}</option>)}</select></label>
      <label>套图数量<select data-canvas-control="true" value={node.count || 6} onChange={event => onChange?.({ count: Number(event.target.value) })}>{[3, 6, 9, 12].map(count => <option key={count} value={count}>{count} 张</option>)}</select></label>
    </div>
    <div className="ec-canvas-composer-footer">
      <span>白底图、主图、详情图按用途自动分组</span>
      <button type="button" data-canvas-control="true" disabled={loading || !sources.length} onClick={onGenerate}>
        {loading ? '生成中' : <><Sparkles size={15} />开始生成</>}
      </button>
    </div>
  </article>;
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

function DerivePort({ visible, disabled, onPointerDown, onPointerUp }) {
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
  onResizeStart,
}) {
  const presentation = getCanvasNodePresentation({ selected, hovered, focusActive, related });
  return <article
    data-canvas-node-id={node.id}
    className={`ec-canvas-media-node is-${presentation.state} ${presentation.dimmed ? 'is-dimmed' : ''}`}
    style={{ left: node.x, top: node.y, width: node.w, visibility: node.hidden ? 'hidden' : 'visible' }}
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
    <DerivePort visible={presentation.handlesVisible} disabled={!node.url} onPointerDown={onPortPointerDown} onPointerUp={onPortPointerUp} />
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
    <DerivePort visible={selected} disabled={!assets.length} onPointerDown={onPortPointerDown} />
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
      data-placeholder={node.placeholder || '输入标题、卖点或生成要求'}
      style={node.textStyle || undefined}
      onFocus={() => onSelect?.(node.id)}
      onInput={event => onChange?.(node.id, event.currentTarget.textContent || '')}
      onBlur={() => onBlur?.(node.id)}
    >{node.text || ''}</div>
  </article>;
}
