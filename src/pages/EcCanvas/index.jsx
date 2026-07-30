import React, { useState, useEffect, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import { MdArrowBack, MdDownload, MdGridOn, MdCollections, MdAdd, MdDelete, MdOpenInNew, MdZoomIn, MdZoomOut, MdFitScreen, MdClose, MdLink, MdAutoFixHigh, MdImageSearch, MdEdit, MdCategory, MdMergeType, MdCheckBoxOutlineBlank, MdCheckBox, MdCrop, MdTextFields, MdLayers, MdTune, MdTranslate, MdHighQuality, MdAspectRatio, MdFileDownload, MdAddPhotoAlternate, MdCenterFocusStrong, MdSave, MdRestore } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import { loadWorks, saveWork, proxyImg, deleteWork as softDeleteWork, loadTrash, restoreWork, reversePrompt, removeBg, stitchLongImage, regenerateCanvasImage, transformCanvasImage, analyzeCanvasLayers, uploadECTempImages, createTextComposition, listTextCompositions, saveTextCompositionRevision, createCanvasPixelLayers, exportCanvasPsd } from '../../services/api';
import {
  ASSET_GROUPS,
  addConnection,
  bindNonPassiveWheel,
  canStitch,
  canvasCursorForState,
  fitViewport,
  getCanvasPointerIntent,
  getAssetMeta,
  moveSelectedNodes,
  normalizeAsset,
  removeConnectionsForNodes,
  selectNodesInRect,
  zoomAroundCursor,
} from './canvasState';
import {
  createChildConnection,
  createDerivedNode,
  canDeriveFromNode,
  clampCanvasPickerPosition,
  getCanvasPortCenter,
  normalizeCanvasConnection,
  normalizeCanvasNode,
  validateWorkflowActionInputs,
} from './nodeWorkflow';
import { CanvasNodeActionPicker, CanvasPortHandle, CanvasWorkflowNode } from './components/workflowNodes';
import { normalizeWorkImages } from '../../utils/workImages.js';
import { handleGenerationAccessError } from '../../utils/generationAccess.js';
import { createCanvasSession, loadCanvasSession, saveCanvasSession } from '../../services/projects.js';
import { useDialog } from '../../components/ui/DialogProvider.jsx';
import ContextMenu from './ContextMenu.jsx';
import { actionsForSurface, getCanvasAction } from './canvasActionRegistry.js';
import { createCanvasSnapshot, createFreshCanvasSession, restoreCanvasSnapshot } from './canvasSessionModel.js';
import { buildCanvasImportResult, normalizeCanvasWorkPanel } from './canvasWorkModel.js';
import { cleanupLegacyCanvasStorage } from '../Works/retentionModel.js';
import TextLayerInspector from './components/TextLayerInspector.jsx';
import ResponsiveImage from '../../components/ResponsiveImage.jsx';
import { canvasDraftKey, loadCanvasDraft, saveCanvasDraft } from './canvasDraftRepository.js';

function generatedAssetIdFromUrl(url = '') {
  return String(url).match(/\/api\/generated-assets\/([a-f0-9]{64}\.(?:jpg|png|webp))(?:[?#]|$)/i)?.[1] || '';
}

function compositionSizeForNode(node = {}) {
  if (node.compositionDocument?.width && node.compositionDocument?.height) {
    return { width: node.compositionDocument.width, height: node.compositionDocument.height };
  }
  if (node.ratio === '3:4') return { width: 1200, height: 1600 };
  if (node.ratio === '9:16') return { width: 1080, height: 1920 };
  if (node.ratio === '长图') return { width: 1200, height: 2400 };
  return { width: 1200, height: 1200 };
}

function defaultTextLayerForNode(node = {}) {
  const existing = node.compositionDocument?.layers?.find(layer => layer.kind === 'text');
  if (existing) return existing;
  const { width } = compositionSizeForNode(node);
  const inset = Math.round(width * 0.08);
  return {
    id: 'title',
    kind: 'text',
    text: '',
    fontId: 'fallback-sans',
    fontSize: Math.max(32, Math.round(width * 0.055)),
    color: '#111111',
    width: width - inset * 2,
    align: 'center',
    lineHeight: 1.2,
    x: inset,
    y: inset,
  };
}

function parseImages(images, platform) {
  const entries = normalizeWorkImages(images).map(image => ({ ...image, sourceKey: image.key || image.label || '' }));
  if (!entries.length) return [];
  const counters = {};
  return entries.map((input, i) => {
    const asset = normalizeAsset(input, i, counters);
    const info = getAssetMeta(asset.sourceKey);
    return { ...asset, title: info.name, platform };
  });
}

function productAssetsForCanvas(result = {}) {
  const sources = result.productAssets || result.product_assets || result.productImages || result.source_images || result.sourceImages || [];
  return normalizeWorkImages(sources).map((asset, index) => ({
    ...asset,
    assetId: asset.assetId || asset.id || asset.key || `product-${index + 1}`,
    name: asset.name || asset.label || `产品素材 ${index + 1}`,
  }));
}

const NODE_W = 200;
const GAP = 28;

function normalizeLayerItems(layers, nodeId) {
  return (layers || []).map((layer, index) => ({
    id: layer.id || `layer_${nodeId}_${index + 1}`,
    name: layer.name || `图层 ${index + 1}`,
    kind: layer.kind || '元素',
    description: layer.description || '',
    visible: layer.visible !== false,
    locked: Boolean(layer.locked),
    preview_url: layer.preview_url || '',
  }));
}

const ACTION_ICONS = {
  'adjust-requirements': MdEdit,
  regenerate: MdAutoFixHigh,
  download: MdDownload,
  'image-info': MdCategory,
  'add-reference': MdAddPhotoAlternate,
  delete: MdDelete,
  'product-remix': MdImageSearch,
  outpaint: MdAspectRatio,
  inpaint: MdTune,
  'remove-background': MdAutoFixHigh,
  'layer-edit': MdLayers,
  translate: MdTranslate,
  upscale: MdHighQuality,
  crop: MdCrop,
  'grid-split': MdGridOn,
  annotation: MdTextFields,
};

const PLATFORM_PRESETS = {
  淘宝: ['1:1 主图', '3:4 主图', '详情长图'],
  天猫: ['1:1 主图', '3:4 主图', '详情长图'],
  京东: ['1:1 主图', '详情长图'],
  抖音: ['1:1 商品卡', '3:4 商品卡', '9:16 竖版素材'],
  小红书: ['3:4 种草图', '1:1 封面'],
  亚马逊: ['1:1 白底主图', '1:1 A+配图'],
};

/* A7: 按 category 分组的智能排版 */
function autoLayout(imageList) {
  // 按 group 分组
  const groups = {};
  imageList.forEach(img => {
    const g = img.group || '其他';
    if (!groups[g]) groups[g] = [];
    groups[g].push(img);
  });

  const groupOrder = ASSET_GROUPS;
  const sortedGroups = groupOrder.filter(g => groups[g]);

  const nodes = [];
  let groupY = 0;

  for (const groupName of sortedGroups) {
    const imgs = groups[groupName];
    const cols = Math.min(Math.ceil(Math.sqrt(imgs.length)), 5);
    let maxRowH = 0;

    imgs.forEach((img, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const h = img.ratio === '3:4' ? Math.round(NODE_W * 4 / 3) : NODE_W;
      maxRowH = Math.max(maxRowH, h + 60);
      nodes.push({
        ...img,
        id: img.id || `node_${img.sourceKey}_${i}`,
        assetId: img.assetId || `asset_${img.sourceKey}_${i}`,
        x: col * (NODE_W + GAP),
        y: groupY + row * (h + 60 + GAP),
        w: NODE_W,
        h,
        loaded: false,
      });
    });

    // 下一组从下方开始，留出组间距
    const rows = Math.ceil(imgs.length / cols);
    groupY += rows * (maxRowH + GAP) + 40; // 组间距 40px
  }

  return nodes;
}

function SkeletonCard({ w, h }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, width: w, height: h, borderRadius: '12px 12px 0 0', background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'skeletonShimmer 1.4s infinite' }}>
    </div>
  );
}

/* A8: 图片加载骨架屏 + 错误重试 + C3: proxyImg 代理显示 */
function ImageNode({ node, selected, multiSelected, dimmed, hoverActions = [], onAction, onPointerDown, onContextMenu, onToggleSelect, onPortPointerDown, onPortPointerUp, onInspect, onHoverChange }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-canvas-node-id={node.id}
      onPointerDown={e => onPointerDown(e, node.id)}
      onDoubleClick={e => { e.stopPropagation(); onInspect?.(node); }}
      onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, node); }}
      onMouseEnter={() => { setHovered(true); onHoverChange?.(node.id); }}
      onMouseLeave={() => { setHovered(false); onHoverChange?.(null); }}
      style={{
        position: 'absolute', left: node.x, top: node.y, width: node.w,
        cursor: 'grab', userSelect: 'none', borderRadius: 12,
        boxShadow: selected ? '0 0 0 2.5px #7c3aed, 0 8px 32px rgba(124,58,237,0.25)' : '0 4px 16px rgba(0,0,0,0.10)',
        background: '#fff', opacity: dimmed ? 0.34 : 1, transition: 'box-shadow 0.15s, opacity 0.16s', touchAction: 'none',
      }}
    >
      <button
        type="button"
        aria-label={selected ? '取消选择' : '选择节点'}
        onPointerDown={e => { e.stopPropagation(); onToggleSelect?.(e, node.id); }}
        style={{ position: 'absolute', zIndex: 3, left: 8, top: 8, width: 22, height: 22, border: 0, borderRadius: 6, background: 'rgba(255,255,255,.92)', color: selected ? '#7c3aed' : '#777', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 7px rgba(0,0,0,.16)' }}
      >
        {selected ? <MdCheckBox size={17} /> : <MdCheckBoxOutlineBlank size={17} />}
      </button>
      {hovered && hoverActions.length > 0 && <div style={{ position: 'absolute', zIndex: 4, top: 8, right: 8, display: 'flex', gap: 5 }}>
        {hoverActions.map(action => {
          const Icon = ACTION_ICONS[action.id] || MdAutoFixHigh;
          return <button key={action.id} type="button" data-canvas-control="true" aria-label={action.label} title={action.label} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onAction?.(action.id, node); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: 0, borderRadius: 7, padding: '5px 7px', color: '#fff', background: 'rgba(17,24,39,.82)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}><Icon size={13} />{action.label}</button>;
        })}
      </div>}
      <div data-canvas-port-role="input" style={{ position: 'absolute', zIndex: 2, left: -7, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#fff', border: '2px solid #7c3aed', cursor: 'crosshair', opacity: selected ? 1 : 0, pointerEvents: selected ? 'auto' : 'none' }} onPointerDown={e => { e.stopPropagation(); onPortPointerDown?.(e, node.id, 'in'); }} onPointerUp={e => { e.stopPropagation(); onPortPointerUp?.(e, node.id, 'in'); }} />
      <div data-canvas-port-role="output" style={{ position: 'absolute', zIndex: 2, right: -7, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#7c3aed', border: '2px solid #fff', cursor: 'crosshair', opacity: selected ? 1 : 0, pointerEvents: selected ? 'auto' : 'none' }} onPointerDown={e => { e.stopPropagation(); onPortPointerDown?.(e, node.id, 'out'); }} onPointerUp={e => { e.stopPropagation(); onPortPointerUp?.(e, node.id, 'out'); }} />
      <div style={{ position: 'relative', width: '100%', borderRadius: '12px 12px 0 0', overflow: 'hidden', background: '#f5f5f5' }}>
        {!loaded && !error && <SkeletonCard w={node.w} h={node.h} />}
        {error && (
          <div style={{ width: '100%', height: node.h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#fef2f2' }}>
            <div style={{ fontSize: 24, opacity: 0.45 }}>!</div>
            <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>原图已失效</div>
            <div style={{ fontSize: 9, color: '#9f1239', textAlign: 'center', padding: '0 12px' }}>可用右键“再次生成”创建稳定新图</div>
            <div onClick={() => { setError(false); setLoaded(false); setRetryKey(k => k + 1); }} style={{ fontSize: 11, color: '#7c3aed', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, background: 'rgba(124,58,237,0.08)' }}>点击重试</div>
          </div>
        )}
        <ResponsiveImage
          key={retryKey}
          src={node.url}
          alt={node.label}
          variant="canvas"
          ratio={node.ratio}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{ width: '100%', height: node.h, borderRadius: '12px 12px 0 0', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
          imgStyle={{ objectFit: 'contain', objectPosition: node.crop?.grid ? `${(node.crop.index % 2) * 100}% ${Math.floor(node.crop.index / 2) * 100}%` : 'center' }}
        />
        {node.crop?.grid === 2 && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(90deg, transparent 49.5%, rgba(255,255,255,.9) 49.5%, rgba(255,255,255,.9) 50.5%, transparent 50.5%), linear-gradient(0deg, transparent 49.5%, rgba(255,255,255,.9) 49.5%, rgba(255,255,255,.9) 50.5%, transparent 50.5%)' }} />}
        {node.annotations?.length > 0 && <div style={{ position: 'absolute', right: 8, bottom: 8, maxWidth: '82%', padding: '4px 6px', borderRadius: 6, background: 'rgba(17,24,39,.78)', color: '#fff', fontSize: 9, lineHeight: 1.4 }}>{node.annotations[0].text}</div>}
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name || node.displayLabel}</div>
          <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, color: '#7c3aed', background: 'rgba(124,58,237,.08)', borderRadius: 999, padding: '2px 5px' }}>{node.group}</span>
        </div>
        <div style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>{node.ratio}{node.size ? ` · ${node.size}` : ''}</div>
        {node.usage && <div style={{ fontSize: 9, color: '#b45309', marginTop: 5, lineHeight: 1.5, background: 'rgba(180,83,9,0.06)', borderRadius: 5, padding: '3px 6px' }}>{node.usage}</div>}
        {node.layerStatus && <div style={{ fontSize: 9, color: '#2563eb', marginTop: 5 }}>▦ {node.layerStatus} · {node.layers?.length || 0} 层</div>}
      </div>
    </div>
  );
}

function SourceGroupNode({ node, selected, dimmed, onPointerDown, onContextMenu, onPortPointerDown, onPortPointerUp, onHoverChange }) {
  return <section data-canvas-node-id={node.id} onPointerDown={event => onPointerDown(event, node.id)} onContextMenu={event => { event.preventDefault(); onContextMenu?.(event, node); }} onMouseEnter={() => onHoverChange?.(node.id)} onMouseLeave={() => onHoverChange?.(null)} style={{ position: 'absolute', left: node.x, top: node.y, width: node.w, minHeight: node.h, boxSizing: 'border-box', padding: 13, border: selected ? '2px solid #6558e8' : '1px solid rgba(101,88,232,.28)', borderRadius: 15, color: '#1f2937', background: '#fafaff', boxShadow: selected ? '0 0 0 3px rgba(101,88,232,.14), 0 12px 30px rgba(15,23,42,.10)' : '0 8px 22px rgba(15,23,42,.08)', cursor: 'grab', userSelect: 'none', opacity: dimmed ? 0.34 : 1, transition: 'opacity 0.16s, box-shadow 0.15s' }}>
    <CanvasPortHandle side="right" role="output" visible={selected} disabled={!canDeriveFromNode(node)} label="从产品素材派生工作流" onPointerDown={event => onPortPointerDown?.(event, node.id, 'out')} onPointerUp={event => onPortPointerUp?.(event, node.id, 'out')} />
    <div style={{ fontSize: 10, fontWeight: 800, color: '#6558e8', letterSpacing: '.05em' }}>产品素材组</div>
    <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name || '产品母图'}</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7, marginTop: 11 }}>
      {(node.assets || []).slice(0, 4).map((asset, index) => <ResponsiveImage key={asset.assetId || asset.id || index} src={asset.url} alt={asset.name || '产品素材'} variant="thumb" ratio="1:1" style={{ width: '100%', borderRadius: 8, background: '#e8eaf2' }} imgStyle={{ objectFit: 'contain' }} />)}
      {!node.assets?.length && <div style={{ gridColumn: '1 / -1', padding: '15px 8px', borderRadius: 8, color: '#8a93a4', background: '#f0f2f8', fontSize: 11, textAlign: 'center' }}>未找到产品原图</div>}
    </div>
  </section>;
}

/* A6: 连线 SVG 层 */
function ConnectionLines({ connections, nodes, viewport, onRemove, focusNodeIds }) {
  if (!connections?.length) return null;
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const styles = {
    reference: { stroke: '#7c3aed', dash: undefined },
    variant: { stroke: '#2563eb', dash: '6 4' },
    merge: { stroke: '#374151', dash: undefined },
    derived: { stroke: '#6558e8', dash: undefined },
  };
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'auto', overflow: 'visible' }}>
      {connections.map((conn, i) => {
        const from = nodeMap.get(conn.fromNodeId || conn.from);
        const to = nodeMap.get(conn.toNodeId || conn.to);
        if (!from || !to) return null;
        const fromPort = getCanvasPortCenter(from, conn.fromPort || 'output');
        const toPort = getCanvasPortCenter(to, conn.toPort || 'input');
        const x1 = fromPort.x * viewport.scale + viewport.x;
        const y1 = fromPort.y * viewport.scale + viewport.y;
        const x2 = toPort.x * viewport.scale + viewport.x;
        const y2 = toPort.y * viewport.scale + viewport.y;
        const mx = (x1 + x2) / 2;
        const style = styles[conn.relation || conn.type] || styles.reference;
        const isFocused = !focusNodeIds || (focusNodeIds.has(from.id) && focusNodeIds.has(to.id));
        return (
          <g key={i}>
            <path d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke={style.stroke} strokeWidth={isFocused ? 2.8 : 2.1} fill="none" strokeDasharray={style.dash} opacity={isFocused ? 0.9 : 0.14} onDoubleClick={() => onRemove?.(conn)} style={{ cursor: 'pointer', transition: 'opacity 0.16s, stroke-width 0.16s' }} />
            <circle cx={x2} cy={y2} r={4} fill={style.stroke} opacity={isFocused ? 0.9 : 0.14} />
          </g>
        );
      })}
    </svg>
  );
}

function ConnectionDraftLine({ draft, nodes, viewport }) {
  if (!draft?.sourceNodeId || !draft.pointer) return null;
  const source = nodes.find(node => node.id === draft.sourceNodeId);
  if (!source) return null;
  const sourcePort = getCanvasPortCenter(source, 'output');
  const x1 = sourcePort.x * viewport.scale + viewport.x;
  const y1 = sourcePort.y * viewport.scale + viewport.y;
  const x2 = draft.pointer.x * viewport.scale + viewport.x;
  const y2 = draft.pointer.y * viewport.scale + viewport.y;
  const mx = (x1 + x2) / 2;
  return (
    <svg aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 12 }}>
      <path d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke="#6558e8" strokeWidth="2.5" strokeDasharray="7 5" fill="none" />
      <circle cx={x2} cy={y2} r="5" fill="#6558e8" />
    </svg>
  );
}

function SelectionActionBar({ node, actions, onAction, onClose }) {
  if (!node) return null;
  return (
    <div style={{ position: 'absolute', zIndex: 70, left: node.x, top: Math.max(0, node.y - 52), display: 'flex', alignItems: 'center', gap: 3, padding: 5, borderRadius: 11, background: '#fff', border: '1px solid rgba(15,23,42,.08)', boxShadow: '0 10px 30px rgba(15,23,42,.16)', whiteSpace: 'nowrap' }}>
      {actions.map(action => {
        const Icon = ACTION_ICONS[action.id] || MdAutoFixHigh;
        return <button key={action.id} type="button" title={action.description || action.label} aria-label={action.label} onClick={() => onAction(action.id, node)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, borderRadius: 7, padding: '7px 8px', background: 'transparent', color: '#374151', fontSize: 10, fontWeight: 700, cursor: 'pointer' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,.08)'; e.currentTarget.style.color = '#7c3aed'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#374151'; }}><Icon size={14} />{action.label}</button>;
      })}
      <button type="button" title="关闭工具条" onClick={onClose} style={{ border: 0, background: 'rgba(0,0,0,.05)', borderRadius: 7, width: 25, height: 25, cursor: 'pointer', color: '#999' }}>×</button>
    </div>
  );
}

function ReferenceComposer({ references, promptText, setPromptText, onRemoveReference, onAddReferenceFiles, onGenerate, loading }) {
  const inputRef = useRef(null);
  return (
    <div style={{ position: 'fixed', zIndex: 10004, right: 20, bottom: 20, width: 'min(520px, calc(100vw - 40px))', background: '#fff', border: '1px solid rgba(15,23,42,.10)', boxShadow: '0 18px 55px rgba(15,23,42,.20)', borderRadius: 16, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div><div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>引用素材生成</div><div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>保留商品主体，按新的电商用途重新生成</div></div>
        <span style={{ fontSize: 10, color: '#7c3aed', background: 'rgba(124,58,237,.08)', padding: '4px 7px', borderRadius: 999 }}>{references.length} 张参考图</span>
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8 }}>
        {references.map(node => <div key={node.id} style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}><img src={proxyImg(node.url)} alt={node.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} /><button type="button" onClick={() => onRemoveReference(node.id)} style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, border: 0, borderRadius: '50%', background: '#111827', color: '#fff', fontSize: 11, cursor: 'pointer' }}>×</button></div>)}
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={event => { onAddReferenceFiles?.([...event.target.files]); event.target.value = ''; }} />
        <button type="button" onClick={() => inputRef.current?.click()} style={{ width: 48, height: 48, flexShrink: 0, border: '1px dashed #c4b5fd', borderRadius: 8, background: '#faf5ff', color: '#7c3aed', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>+ 添加</button>
      </div>
      <textarea value={promptText} onChange={e => setPromptText(e.target.value)} placeholder="例如：保留产品外观，制作一张 3:4 的核心卖点场景图，突出防水和便携" rows={3} style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', border: '1px solid #e5e7eb', borderRadius: 10, padding: '9px 10px', fontSize: 12, lineHeight: 1.6 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
        <div style={{ display: 'flex', gap: 5 }}>
          {['淘宝', '抖音', '小红书', '亚马逊'].map(platform => <span key={platform} style={{ fontSize: 10, color: '#6b7280', background: '#f3f4f6', padding: '4px 7px', borderRadius: 999 }}>{platform}</span>)}
        </div>
        <button type="button" onClick={onGenerate} disabled={loading || !promptText.trim()} style={{ border: 0, borderRadius: 9, padding: '9px 14px', background: loading ? '#c4b5fd' : '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 800, cursor: loading ? 'wait' : 'pointer' }}>{loading ? '生成中…' : '生成电商图'}</button>
      </div>
    </div>
  );
}

export default function EcCanvas() {
  const { state, dispatch } = useApp();
  const dialog = useDialog();
  const result = state.result || {};
  const phone = state.phone || '';
  const [viewport, setViewport] = useState({ x: 80, y: 40, scale: 1 });
  const [nodes, setNodes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [multiSelected, setMultiSelected] = useState(new Set());
  const [connections, setConnections] = useState([]);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [pointerMode, setPointerMode] = useState(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [shiftPressed, setShiftPressed] = useState(false);
  const [marquee, setMarquee] = useState(null);
  const [connectionDraft, setConnectionDraft] = useState(null);
  const [activeFilter, setActiveFilter] = useState('全部');
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [directionDraft, setDirectionDraft] = useState(null);
  const [directionTitle, setDirectionTitle] = useState('');
  const [directionPurpose, setDirectionPurpose] = useState('');
  const [directionComposition, setDirectionComposition] = useState('');
  const [directionCopy, setDirectionCopy] = useState('');
  const [directionRatio, setDirectionRatio] = useState('3:4');
  const [nodeNameDraft, setNodeNameDraft] = useState('');
  const [groupDraft, setGroupDraft] = useState('详情图');
  const [toolNodeId, setToolNodeId] = useState(null);
  const [composerNodes, setComposerNodes] = useState([]);
  const [composerText, setComposerText] = useState('');
  const [cropNode, setCropNode] = useState(null);
  const [cropRatio, setCropRatio] = useState('3:4');
  const [annotationNode, setAnnotationNode] = useState(null);
  const [annotationText, setAnnotationText] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('PNG');
  const [exportMode, setExportMode] = useState('逐张导出');
  const [alignMode, setAlignMode] = useState('left');
  const [connectionPicker, setConnectionPicker] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);     // A6: 右键菜单
  const [tab, setTab] = useState('canvas');
  const [pastWorks, setPastWorks] = useState([]);
  const [trashWorks, setTrashWorks] = useState([]);
  const [zoomImg, setZoomImg] = useState(null);
  const [toast, setToast] = useState(null);
  const [promptPanel, setPromptPanel] = useState(null);
  const [promptText, setPromptText] = useState('');
  const [promptReferences, setPromptReferences] = useState([]);
  const [promptLoading, setPromptLoading] = useState(false);
  const [composerAction, setComposerAction] = useState('');
  const [imageInfoNode, setImageInfoNode] = useState(null);
  const [imageInfoName, setImageInfoName] = useState('');
  const [imageInfoGroup, setImageInfoGroup] = useState('其他');
  const [imageInfoUsage, setImageInfoUsage] = useState('');
  const [outpaintDraft, setOutpaintDraft] = useState(null);
  const [textInspectorNodeId, setTextInspectorNodeId] = useState(null);
  const [textCompositionSaving, setTextCompositionSaving] = useState(false);
  const [textCompositionError, setTextCompositionError] = useState('');
  const [canvasSession, setCanvasSession] = useState(null);
  const [canvasSessionBusy, setCanvasSessionBusy] = useState(false);
  const containerRef = useRef(null);
  const canvasSaveKeyRef = useRef(null);
  const touchPointsRef = useRef(new Map());
  const dragFrameRef = useRef(null);
  const pendingDragRef = useRef(null);
  const draftReadyRef = useRef(false);
  const sourceUploadRef = useRef(null);
  const canvasSessionRef = useRef(null);
  const remoteSaveTimerRef = useRef(null);
  const remoteSnapshotRef = useRef('');

  const imageList = parseImages(result.images || {}, result.platform || '淘宝');
  const hasCurrent = imageList.length > 0;
  const visibleNodes = activeFilter === '全部' ? nodes : nodes.filter(node => node.group === activeFilter);
  const selectedNode = selected ? nodes.find(node => node.id === selected) : null;
  const textInspectorNode = textInspectorNodeId ? nodes.find(node => node.id === textInspectorNodeId) : null;
  const connectionNodes = nodes;
  const focusedNodeIds = hoveredNodeId ? (() => {
    const related = new Set([hoveredNodeId]);
    connections.forEach(connection => {
      const fromId = connection.fromNodeId || connection.from;
      const toId = connection.toNodeId || connection.to;
      if (fromId === hoveredNodeId) related.add(toId);
      if (toId === hoveredNodeId) related.add(fromId);
    });
    return related;
  })() : null;

  // toast helper
  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!hasCurrent) {
      setNodes([]);
      setConnections([]);
      return () => { cancelled = true; };
    }
    draftReadyRef.current = false;
    const session = createFreshCanvasSession({
      work: result,
      productAssets: productAssetsForCanvas(result),
      outputs: imageList,
    });
    const draftKey = canvasDraftKey(result);
    canvasSaveKeyRef.current = draftKey;
    const draft = loadCanvasDraft(draftKey);
    const initialSnapshot = draft ? restoreCanvasSnapshot(draft) : null;
    const newNodes = (initialSnapshot?.nodes?.length ? initialSnapshot.nodes : session.nodes).map(normalizeCanvasNode);
    setNodes(newNodes);
    setConnections((initialSnapshot?.connections?.length ? initialSnapshot.connections : session.connections).map(normalizeCanvasConnection));
    setSelected(null);
    setMultiSelected(new Set());
    setConnectionDraft(null);
    setConnectionPicker(null);
    setCanvasSession(result.canvasSession?.id
      ? result.canvasSession
      : result.canvasSessionId ? { id: result.canvasSessionId, revision: result.canvasSessionRevision || 1 } : null);
    const persistedSessionId = result.canvasSession?.id || result.canvasSessionId;
    if (!draft && persistedSessionId) {
      void loadCanvasSession(persistedSessionId).then(remoteSession => {
        if (cancelled) return;
        const snapshot = restoreCanvasSnapshot(remoteSession.snapshot);
        if (!snapshot.nodes.length) return;
        setNodes(snapshot.nodes.map(normalizeCanvasNode));
        setConnections(snapshot.connections.map(normalizeCanvasConnection));
        setViewport(snapshot.viewport);
        setCanvasSession(remoteSession);
      }).catch(() => {});
    }
    if (result.projectId && (result.resultVersionId || result.sourceVersionId)) {
      void listTextCompositions({
        projectId: result.projectId,
        versionId: result.resultVersionId || result.sourceVersionId,
      }).then(documents => {
        if (cancelled || !Array.isArray(documents) || !documents.length) return;
        const byBackground = new Map(documents.map(document => [document.backgroundAssetId, document]));
        setNodes(previous => previous.map(node => {
          const compositionBackgroundAssetId = generatedAssetIdFromUrl(node.url);
          const compositionDocument = byBackground.get(compositionBackgroundAssetId);
          if (!compositionDocument) return node;
          return {
            ...node,
            compositionBackgroundAssetId,
            compositionDocument,
            url: compositionDocument.renderedAssetId
              ? `/api/generated-assets/${compositionDocument.renderedAssetId}`
              : node.url,
            loaded: false,
          };
        }));
      }).catch(() => {});
    }
    requestAnimationFrame(() => {
      const next = initialSnapshot?.viewport || fitViewport(newNodes, containerRef.current?.getBoundingClientRect());
      if (next) setViewport(next);
      draftReadyRef.current = true;
    });
    return () => { cancelled = true; };
  }, [result.id, result._saveKey, result.taskId, result.product_name, result.canvasImportId, imageList.length]);

  useEffect(() => {
    if (!draftReadyRef.current || !canvasSaveKeyRef.current || !nodes.length) return undefined;
    const snapshot = createCanvasSnapshot({ nodes, connections, viewport });
    const timer = setTimeout(() => saveCanvasDraft(canvasSaveKeyRef.current, snapshot), 350);
    return () => clearTimeout(timer);
  }, [connections, nodes, viewport]);

  useEffect(() => {
    canvasSessionRef.current = canvasSession;
  }, [canvasSession]);

  useEffect(() => {
    if (!draftReadyRef.current || !nodes.length || canvasSessionBusy) return undefined;
    const projectId = result.projectId;
    const baseVersionId = result.resultVersionId || result.sourceVersionId;
    if (!projectId || !baseVersionId) return undefined;
    const snapshot = createCanvasSnapshot({ nodes, connections, viewport });
    const fingerprint = JSON.stringify(snapshot);
    if (fingerprint === remoteSnapshotRef.current) return undefined;

    remoteSaveTimerRef.current = setTimeout(async () => {
      setCanvasSessionBusy(true);
      try {
        const currentSession = canvasSessionRef.current;
        const session = currentSession?.id
          ? await saveCanvasSession(currentSession.id, { expectedRevision: currentSession.revision, snapshot })
          : await createCanvasSession({ projectId, baseVersionId, snapshot });
        remoteSnapshotRef.current = fingerprint;
        canvasSessionRef.current = session;
        setCanvasSession(session);
        if (result._saveKey) {
          const workResult = { ...result };
          delete workResult.canvasSession;
          await saveWork({ ...workResult, canvasSessionId: session.id, canvasSessionRevision: session.revision }, phone);
        }
        dispatch({
          type: 'SET_RESULT',
          result: { ...result, canvasSession: session, canvasSessionId: session.id, canvasSessionRevision: session.revision },
        });
      } catch {
        // The local draft is already durable; retry on the next canvas change.
      } finally {
        setCanvasSessionBusy(false);
      }
    }, 1200);
    return () => clearTimeout(remoteSaveTimerRef.current);
  }, [canvasSessionBusy, connections, dispatch, nodes, phone, result, viewport]);

  useEffect(() => {
    cleanupLegacyCanvasStorage(localStorage);
  }, []);

  useEffect(() => {
    const load = async () => {
      let localWorks = [];
      let serverWorks = [];
      try {
        const parsed = JSON.parse(localStorage.getItem('shubao_ec_works') || '[]');
        localWorks = Array.isArray(parsed) ? parsed : [];
      } catch {}
      try { 
        serverWorks = await loadWorks(phone);
      } catch {}
      const localTrash = (() => {
        try { return JSON.parse(localStorage.getItem('shubao_ec_trash') || '[]'); } catch { return []; }
      })();
      const serverTrash = await loadTrash(phone);
      const trashKeys = new Set(serverTrash.map(item => String(item._saveKey || item.id)));
      setPastWorks(normalizeCanvasWorkPanel({ localWorks, serverWorks, ownerEmail: phone }));
      setTrashWorks([...normalizeCanvasWorkPanel({ localWorks: localTrash, serverWorks: [], ownerEmail: phone }).filter(item => !trashKeys.has(String(item._saveKey || item.id))), ...serverTrash]);
    };
    load();
  }, [phone]);

  // B10: 全局键盘快捷键（使用 ref 避免循环依赖）
  // 注意：ref 初始值为空函数，在下面的 useEffect 中更新
  const handleDeleteRef = useRef(() => {});
  const fitViewRef = useRef(() => {});

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if (e.code === 'Space' && !isTyping && tab === 'canvas') {
        e.preventDefault();
        setSpacePressed(true);
      }
      if (e.key === 'Shift' && tab === 'canvas') setShiftPressed(true);
      // Esc: 取消所有选中/连线/菜单
      if (e.key === 'Escape') {
        setConnectionDraft(null);
        setPointerMode(null);
        setMarquee(null);
        setContextMenu(null);
        setSelected(null);
        setMultiSelected(new Set());
        return;
      }
      // 只在画布 tab 处理
      if (tab !== 'canvas') return;
      // Delete/Backspace: 删除选中节点
      if ((e.key === 'Delete' || e.key === 'Backspace') && (selected || multiSelected.size > 0)) {
        e.preventDefault();
        handleDeleteRef.current?.();
        return;
      }
      // Ctrl+A / Cmd+A: 全选
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setMultiSelected(new Set(nodes.map(n => n.id)));
        setSelected(null);
        return;
      }
      // Ctrl+D / Cmd+D: 取消全选
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setSelected(null);
        setMultiSelected(new Set());
        return;
      }
      // F: 适配视口
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        fitViewRef.current?.();
        return;
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === 'Space') setSpacePressed(false);
      if (e.key === 'Shift') setShiftPressed(false);
    };
    const handleWindowBlur = () => { setSpacePressed(false); setShiftPressed(false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [tab, selected, multiSelected, nodes]);

  // B3: 清理 wheel RAF
  useEffect(() => {
    return () => { if (wheelRafRef.current) cancelAnimationFrame(wheelRafRef.current); };
  }, []);

  const toWorldPoint = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    return {
      x: ((e.clientX - (rect?.left || 0)) - viewport.x) / viewport.scale,
      y: ((e.clientY - (rect?.top || 0)) - viewport.y) / viewport.scale,
    };
  }, [viewport.x, viewport.y, viewport.scale]);

  const flushDragFrame = useCallback(() => {
    dragFrameRef.current = null;
    const pending = pendingDragRef.current;
    pendingDragRef.current = null;
    if (!pending) return;
    const dx = pending.point.x - pending.start.x;
    const dy = pending.point.y - pending.start.y;
    if (!dx && !dy) return;
    setNodes(previous => moveSelectedNodes(previous, pending.ids, dx, dy));
    setPointerMode(previous => previous?.kind === 'drag' ? { ...previous, start: pending.point } : previous);
  }, []);

  useEffect(() => () => {
    if (dragFrameRef.current) cancelAnimationFrame(dragFrameRef.current);
  }, []);

  const handlePointerDown = useCallback((e) => {
    if (e.pointerType === 'touch') {
      touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchPointsRef.current.size === 2) {
        const [a, b] = [...touchPointsRef.current.values()];
        const rect = containerRef.current?.getBoundingClientRect();
        const center = { x: (a.x + b.x) / 2 - (rect?.left || 0), y: (a.y + b.y) / 2 - (rect?.top || 0) };
        setPointerMode({
          kind: 'pinch',
          distance: Math.hypot(b.x - a.x, b.y - a.y),
          center,
          world: { x: (center.x - viewport.x) / viewport.scale, y: (center.y - viewport.y) / viewport.scale },
          scale: viewport.scale,
        });
        try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
        return;
      }
    }
    const interactiveTarget = e.target?.closest?.('button,input,textarea,select,a,[contenteditable="true"],[data-canvas-control="true"]');
    const intent = getCanvasPointerIntent({
      button: e.button,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      spaceKey: spacePressed,
      isInteractive: Boolean(interactiveTarget),
    });
    if (intent === 'ignore') return;
    e.preventDefault();
    if (intent === 'marquee') {
      const point = toWorldPoint(e);
      setPointerMode({ kind: 'marquee', start: point, additive: e.ctrlKey || e.metaKey });
      setMarquee({ x: point.x, y: point.y, w: 0, h: 0 });
    } else {
      setPointerMode({ kind: 'pan', startX: e.clientX, startY: e.clientY, vpX: viewport.x, vpY: viewport.y });
      setSelected(null);
      setMultiSelected(new Set());
      setToolNodeId(null);
      setContextMenu(null);
    }
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
  }, [spacePressed, toWorldPoint, viewport.x, viewport.y]);

  const handlePointerMove = useCallback((e) => {
    if (!pointerMode) return;
    if (e.pointerType === 'touch' && touchPointsRef.current.has(e.pointerId)) {
      touchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pointerMode.kind === 'pinch' && touchPointsRef.current.size >= 2) {
      const [a, b] = [...touchPointsRef.current.values()];
      const distance = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
      const nextScale = Math.max(0.15, Math.min(4, pointerMode.scale * distance / Math.max(1, pointerMode.distance)));
      setViewport({
        scale: nextScale,
        x: pointerMode.center.x - pointerMode.world.x * nextScale,
        y: pointerMode.center.y - pointerMode.world.y * nextScale,
      });
      return;
    }
    if (pointerMode.kind === 'connect') {
      const point = toWorldPoint(e);
      setConnectionDraft(prev => prev ? { ...prev, pointer: point } : prev);
      return;
    }
    if (pointerMode.kind === 'pan') {
      setViewport(v => ({ ...v, x: pointerMode.vpX + (e.clientX - pointerMode.startX), y: pointerMode.vpY + (e.clientY - pointerMode.startY) }));
      return;
    }
    if (pointerMode.kind === 'marquee') {
      const point = toWorldPoint(e);
      setMarquee({ x: pointerMode.start.x, y: pointerMode.start.y, w: point.x - pointerMode.start.x, h: point.y - pointerMode.start.y });
      return;
    }
    if (pointerMode.kind === 'drag') {
      const point = toWorldPoint(e);
      pendingDragRef.current = { ids: pointerMode.ids, start: pointerMode.start, point };
      if (!dragFrameRef.current) dragFrameRef.current = requestAnimationFrame(flushDragFrame);
    }
  }, [flushDragFrame, pointerMode, toWorldPoint]);

  const handlePointerUp = useCallback((e) => {
    if (dragFrameRef.current) {
      cancelAnimationFrame(dragFrameRef.current);
      flushDragFrame();
    }
    if (e?.pointerType === 'touch') touchPointsRef.current.delete(e.pointerId);
    if (pointerMode?.kind === 'connect' && connectionDraft) {
      if (e?.type === 'pointercancel') {
        setConnectionDraft(null);
        setPointerMode(null);
        return;
      }
      const point = toWorldPoint(e);
      setConnectionPicker({
        sourceNodeId: connectionDraft.sourceNodeId || connectionDraft.from,
        world: point,
      });
      setConnectionDraft(null);
      setPointerMode(null);
      return;
    }
    if (pointerMode?.kind === 'marquee' && marquee) {
      const ids = new Set(selectNodesInRect(nodes, marquee));
      setMultiSelected(pointerMode.additive ? new Set([...multiSelected, ...ids]) : ids);
      setSelected(null);
    }
    setPointerMode(null);
    setMarquee(null);
  }, [connectionDraft, flushDragFrame, marquee, multiSelected, nodes, pointerMode, toWorldPoint]);

  // B3: 使用 requestAnimationFrame 节流 wheel 事件
  const wheelRafRef = useRef(null);
  const handleWheel = useCallback((e) => {
    try { e.preventDefault(); } catch {}
    if (wheelRafRef.current) return; // 已有一帧在排队
    const rect = e.currentTarget.getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const factor = e.deltaY > 0 ? 0.92 : 1.09;
    wheelRafRef.current = requestAnimationFrame(() => {
      wheelRafRef.current = null;
      setViewport(v => zoomAroundCursor(v, point, factor));
    });
  }, []);

  const handleCanvasActionError = useCallback((error, action = {}) => {
    const accessResult = handleGenerationAccessError(error, dispatch, {
      source: 'canvas',
      ownerEmail: state.phone,
      route: globalThis.location?.pathname || '/',
      draftId: canvasSaveKeyRef.current || `canvas-${result.product_name || 'workspace'}`,
      action: { type: action.type || 'canvas-action', nodeId: action.nodeId || '', currency: 'ec_points' },
    });
    if (accessResult) return true;
    showToast(error?.message || '处理失败，请重试', 'error');
    return false;
  }, [dispatch, result.product_name, showToast, state.phone]);

  useEffect(() => bindNonPassiveWheel(containerRef.current, handleWheel), [handleWheel, tab]);

  // 节点点击：Ctrl/Cmd 切换多选，拖动已选节点会批量移动
  const handleNodeDown = useCallback((e, id) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      setMultiSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
      return next;
      });
      setSelected(null);
      return;
    }
    const ids = multiSelected.has(id) ? multiSelected : new Set([id]);
    setSelected(ids.size === 1 ? id : null);
    setMultiSelected(ids);
    setToolNodeId(id);
    setPointerMode({ kind: 'drag', ids, start: toWorldPoint(e) });
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
  }, [multiSelected, toWorldPoint]);

  const handleToggleSelect = useCallback((e, id) => {
    const next = new Set(multiSelected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setMultiSelected(next);
    setSelected(next.size === 1 ? [...next][0] : null);
  }, [multiSelected]);

  const handlePortPointerDown = useCallback((e, nodeId, side) => {
    if (side !== 'out') return;
    const source = nodes.find(node => node.id === nodeId);
    if (!canDeriveFromNode(source)) {
      showToast('完成当前处理后，可从生成结果继续派生', 'info');
      return;
    }
    // 输出端口不能捕获指针，否则空白处松手时 pointerup 仍会落在端口上，
    // 画布就无法打开“从素材派生”的任务选择器。
    setConnectionPicker(null);
    setConnectionDraft({ from: nodeId, sourceNodeId: nodeId, type: 'reference', pointer: toWorldPoint(e) });
    setPointerMode({ kind: 'connect', from: nodeId });
  }, [nodes, showToast, toWorldPoint]);

  const handlePortPointerUp = useCallback((e, nodeId, side) => {
    const sourceNodeId = connectionDraft?.sourceNodeId || connectionDraft?.from;
    if (side !== 'in' || !sourceNodeId || sourceNodeId === nodeId) return;
    setConnections(prev => addConnection(prev, sourceNodeId, nodeId, connectionDraft.type));
    setConnectionDraft(null);
    setConnectionPicker(null);
    setPointerMode(null);
    showToast('已建立素材关系', 'success');
  }, [connectionDraft, showToast]);

  const handleCreateDerivedNode = useCallback((sourceNodeId, action, world, initialInputs = {}) => {
    const source = nodes.find(node => node.id === sourceNodeId);
    const actionSpec = getCanvasAction(action?.id || action);
    if (!source || !actionSpec?.execute?.nodeKind || !canDeriveFromNode(source)) return;
    const sourceUrl = source.url || source.assets?.find(asset => asset?.url)?.url || null;
    const nodeActionId = actionSpec.execute.nodeActionId;
    const promptSeed = source.direction
      ? [source.direction.purpose, source.direction.composition, source.direction.copy].filter(Boolean).join('\n')
      : '';
    const child = createDerivedNode({
      sourceNodeIds: [source.id],
      actionId: actionSpec.id,
      x: Math.max(16, world?.x ?? source.x + source.w + GAP * 2),
      y: Math.max(16, world?.y ?? source.y),
      inputs: {
        sourceNodeId: source.id,
        sourceUrl,
        prompt: promptSeed,
        productImages: source.kind === 'source_group' ? (source.assets || []) : [],
        referenceImages: [],
        instruction: '',
        outputCount: 1,
        layers: [],
        selectedLayerId: null,
        compositionDocument: nodeActionId === 'layer-edit' ? source.compositionDocument || null : null,
        ...initialInputs,
      },
    });
    child.group = source.group || '其他';
    setNodes(prev => [...prev, child]);
    setConnections(prev => [...prev, createChildConnection(source.id, child.id, actionSpec.id)]);
    setSelected(child.id);
    setMultiSelected(new Set([child.id]));
    setConnectionDraft(null);
    setConnectionPicker(null);
    showToast(`已创建${actionSpec.label}节点`, 'success');

    if (nodeActionId === 'smart-remix' && sourceUrl) {
      setNodes(prev => prev.map(node => node.id === child.id ? { ...node, status: 'analyzing' } : node));
      reversePrompt({ image_url: sourceUrl, product_name: source.name || source.displayLabel || '电商图片' })
        .then(data => setNodes(prev => prev.map(node => node.id === child.id ? { ...node, status: 'ready', inputs: { ...(node.inputs || {}), prompt: data.prompt || promptSeed } } : node)))
        .catch(error => setNodes(prev => prev.map(node => node.id === child.id ? { ...node, status: 'error', error: error.message || '画面描述生成失败' } : node)));
    }
    if (nodeActionId === 'layer-edit' && sourceUrl) {
      setNodes(prev => prev.map(node => node.id === child.id ? { ...node, status: 'analyzing' } : node));
      analyzeCanvasLayers(sourceUrl)
        .then(data => {
          const layers = normalizeLayerItems(data.layers, child.id);
          setNodes(prev => prev.map(node => node.id === child.id ? { ...node, status: 'ready', inputs: { ...(node.inputs || {}), layers, selectedLayerId: layers[0]?.id || null, capabilities: data.capabilities } } : node));
        })
        .catch(error => setNodes(prev => prev.map(node => node.id === child.id ? { ...node, status: 'error', error: error.message || '图层分析失败' } : node)));
    }
  }, [nodes, showToast]);

  const updateWorkflowNode = useCallback((nodeId, patch) => {
    setNodes(prev => prev.map(node => node.id === nodeId ? { ...node, ...patch } : node));
  }, []);

  const updateWorkflowInputs = useCallback((nodeId, patch) => {
    setNodes(prev => prev.map(node => node.id === nodeId ? { ...node, inputs: { ...(node.inputs || {}), ...patch } } : node));
  }, []);

  const handleWorkflowGenerate = useCallback(async (node) => {
    const source = nodes.find(item => item.id === node.sourceNodeIds?.[0]);
    const sourceUrl = node.inputs?.sourceUrl || source?.url || source?.assets?.find(asset => asset?.url)?.url || '';
    const prompt = [node.inputs?.prompt, node.inputs?.instruction].filter(Boolean).join('\n').trim();
    if (!sourceUrl || !prompt || promptLoading) {
      showToast('请先补充可编辑的画面描述', 'info');
      return;
    }
    updateWorkflowNode(node.id, { status: 'running', error: null });
    setPromptLoading(true);
    try {
      const count = Math.max(1, Math.min(4, Number(node.inputs?.outputCount) || 1));
      const referenceImages = [
        ...(node.inputs?.productImages || []),
        ...(node.inputs?.referenceImages || []),
      ].map(image => image?.url || image?.src || image?.image_url).filter(Boolean);
      const urls = await Promise.all(Array.from({ length: count }, () => regenerateCanvasImage({
        prompt,
        imageUrl: sourceUrl,
        referenceImages,
        ratio: node.inputs?.ratio || source.ratio,
      })));
      const outputs = urls.map((url, index) => normalizeCanvasNode({
        ...source,
        id: `node_output_${Date.now()}_${index}`,
        kind: 'image',
        status: 'ready',
        url,
        x: node.x + node.w + GAP * 2,
        y: node.y + index * (source.h + 76),
        name: `${source.name || source.displayLabel || '电商图'}-二创结果${count > 1 ? `-${index + 1}` : ''}`,
        displayLabel: `${source.name || source.displayLabel || '电商图'}-二创结果${count > 1 ? `-${index + 1}` : ''}`,
        sourceNodeIds: [node.id],
      }));
      setNodes(prev => prev.map(item => item.id === node.id ? { ...item, status: 'success', output: { nodeIds: outputs.map(output => output.id), urls } } : item).concat(outputs));
      setConnections(prev => outputs.reduce((edges, output) => [...edges, createChildConnection(node.id, output.id, 'smart-remix-output')], prev));
      setSelected(outputs[0].id);
      setMultiSelected(new Set(outputs.map(output => output.id)));
      showToast(`已生成 ${outputs.length} 张新的电商图`, 'success');
    } catch (error) {
      updateWorkflowNode(node.id, { status: 'error', error: error.message || '生成失败，请重试' });
      handleCanvasActionError(error, { type: 'smart-remix', nodeId: node.id });
    } finally {
      setPromptLoading(false);
    }
  }, [nodes, promptLoading, showToast, updateWorkflowNode, handleCanvasActionError]);

  const handleWorkflowRetry = useCallback((node) => {
    const source = nodes.find(item => item.id === node.sourceNodeIds?.[0]);
    const sourceUrl = node.inputs?.sourceUrl || source?.url || source?.assets?.find(asset => asset?.url)?.url || '';
    updateWorkflowNode(node.id, { status: 'draft', error: null });
    if (!sourceUrl) return;
    if (node.actionId === 'smart-remix') {
      updateWorkflowNode(node.id, { status: 'analyzing' });
      reversePrompt({ image_url: sourceUrl, product_name: source.name || source.displayLabel || '电商图片' })
        .then(data => updateWorkflowNode(node.id, { status: 'ready', inputs: { ...(node.inputs || {}), prompt: data.prompt || '' } }))
        .catch(error => updateWorkflowNode(node.id, { status: 'error', error: error.message || '画面描述生成失败' }));
    } else if (node.actionId === 'layer-edit') {
      updateWorkflowNode(node.id, { status: 'analyzing' });
      analyzeCanvasLayers(sourceUrl)
        .then(data => {
          const layers = normalizeLayerItems(data.layers, node.id);
          updateWorkflowNode(node.id, { status: 'ready', inputs: { ...(node.inputs || {}), layers, selectedLayerId: layers[0]?.id || null, capabilities: data.capabilities } });
        })
        .catch(error => updateWorkflowNode(node.id, { status: 'error', error: error.message || '图层分析失败' }));
    }
  }, [nodes, updateWorkflowNode]);

  const handleWorkflowAddImages = useCallback(async (nodeId, field, files = []) => {
    if (!files.length) return;
    setPromptLoading(true);
    try {
      const dataUrls = await Promise.all(files.slice(0, 20).map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('读取图片失败'));
        reader.readAsDataURL(file);
      })));
      const urls = await uploadECTempImages(dataUrls);
      const images = urls.map((url, index) => ({ id: `workflow_ref_${Date.now()}_${index}`, url, name: files[index]?.name || '追加素材' }));
      setNodes(prev => prev.map(node => node.id === nodeId ? { ...node, inputs: { ...(node.inputs || {}), [field]: [...(node.inputs?.[field] || []), ...images] } } : node));
      showToast(`已添加 ${images.length} 张素材`, 'success');
    } catch (error) {
      showToast(error.message || '素材上传失败', 'error');
    } finally {
      setPromptLoading(false);
    }
  }, [showToast]);

  const handleComposerAddImages = useCallback(async (files = []) => {
    if (!files.length || promptLoading) return;
    setPromptLoading(true);
    try {
      const dataUrls = await Promise.all(files.slice(0, 15).map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('读取图片失败'));
        reader.readAsDataURL(file);
      })));
      const urls = await uploadECTempImages(dataUrls);
      const images = urls.map((url, index) => ({ id: `composer_ref_${Date.now()}_${index}`, url, name: files[index]?.name || '补充参考图' }));
      setComposerNodes(prev => [...prev, ...images]);
      showToast(`已添加 ${images.length} 张参考图`, 'success');
    } catch (error) {
      showToast(error.message || '参考图上传失败', 'error');
    } finally {
      setPromptLoading(false);
    }
  }, [promptLoading, showToast]);

  const handlePromptAddImages = useCallback(async (files = []) => {
    if (!files.length || promptLoading) return;
    setPromptLoading(true);
    try {
      const dataUrls = await Promise.all(files.slice(0, 15).map(file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('读取图片失败'));
        reader.readAsDataURL(file);
      })));
      const urls = await uploadECTempImages(dataUrls);
      setPromptReferences(prev => [...prev, ...urls.map((url, index) => ({
        id: `prompt_ref_${Date.now()}_${index}`,
        url,
        name: files[index]?.name || '补充参考图',
      }))]);
      showToast(`已添加 ${urls.length} 张参考图`, 'success');
    } catch (error) {
      showToast(error.message || '参考图上传失败', 'error');
    } finally {
      setPromptLoading(false);
    }
  }, [promptLoading, showToast]);

  const handleWorkflowProcess = useCallback(async (node) => {
    const source = nodes.find(item => item.id === node.sourceNodeIds?.[0]);
    const sourceUrl = node.inputs?.sourceUrl || source?.url || source?.assets?.find(asset => asset?.url)?.url || '';
    if (!sourceUrl || promptLoading) {
      showToast('源图片暂不可用，请稍后重试', 'info');
      return;
    }
    const validation = validateWorkflowActionInputs(node.actionId, node.inputs);
    if (!validation.ok) {
      const labels = validation.missing.map(key => ({ ratio: '目标比例', prompt: '处理要求' }[key] || key));
      const message = `请先填写${labels.join('和')}`;
      updateWorkflowNode(node.id, { status: 'draft', error: message });
      showToast(message, 'info');
      return;
    }
    updateWorkflowNode(node.id, { status: 'running', error: null });
    setPromptLoading(true);
    try {
      const actionId = node.actionId;
      const prompt = [node.inputs?.prompt, node.inputs?.instruction].filter(Boolean).join('\n').trim();
      let url = '';
      if (actionId === 'remove-bg') {
        const data = await removeBg({ image_url: sourceUrl });
        url = data.result_url || data.url || '';
      } else if (actionId === 'inpaint') {
        url = await regenerateCanvasImage({ prompt, imageUrl: sourceUrl, ratio: node.inputs?.ratio || source.ratio });
      } else {
        const data = await transformCanvasImage({ action: actionId, prompt, imageUrl: sourceUrl, ratio: node.inputs?.ratio || source.ratio });
        url = data.url || data.result_url || '';
      }
      if (!url) throw new Error('处理结果为空');
      const output = normalizeCanvasNode({
        ...source,
        id: `node_output_${Date.now()}`,
        kind: 'image',
        status: 'ready',
        url,
        x: node.x + node.w + GAP * 2,
        y: node.y,
        name: `${source.name || source.displayLabel || '电商图'}-${node.title || '处理结果'}`,
        displayLabel: `${source.name || source.displayLabel || '电商图'}-${node.title || '处理结果'}`,
        sourceNodeIds: [node.id],
      });
      setNodes(prev => prev.map(item => item.id === node.id ? { ...item, status: 'success', output: { nodeId: output.id, url } } : item).concat(output));
      setConnections(prev => [...prev, createChildConnection(node.id, output.id, `${actionId}-output`)]);
      setSelected(output.id);
      setMultiSelected(new Set([output.id]));
      showToast(`${node.title || '电商处理'}已完成`, 'success');
    } catch (error) {
      updateWorkflowNode(node.id, { status: 'error', error: error.message || '处理失败，请重试' });
      handleCanvasActionError(error, { type: node.actionId, nodeId: node.id });
    } finally {
      setPromptLoading(false);
    }
  }, [nodes, promptLoading, showToast, updateWorkflowNode, handleCanvasActionError]);

  const updateWorkflowLayers = useCallback((nodeId, updater) => {
    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId) return node;
      const layers = updater(node.inputs?.layers || []);
      return { ...node, inputs: { ...(node.inputs || {}), layers } };
    }));
  }, []);

  const handleWorkflowLayerExport = useCallback((layer) => {
    if (!layer?.preview_url) {
      showToast('当前接口只返回图层识别结果，像素图层导出尚未就绪', 'info');
      return;
    }
    const link = document.createElement('a');
    link.href = proxyImg(layer.preview_url);
    link.download = `${layer.name || '图层'}.png`;
    link.click();
  }, [showToast]);

  const handleWorkflowPixelLayers = useCallback(async (node) => {
    const compositionDocument = node.inputs?.compositionDocument;
    if (!compositionDocument?.id) {
      showToast('先在文字编辑中保存真实图层，才能生成像素分层', 'info');
      return;
    }
    updateWorkflowNode(node.id, { status: 'running', error: null });
    try {
      const response = await createCanvasPixelLayers({
        documentId: compositionDocument.id,
        expectedRevision: compositionDocument.revision,
      });
      const nextDocument = response.document;
      const layers = normalizeLayerItems(nextDocument.layers, node.id);
      updateWorkflowNode(node.id, {
        status: 'ready',
        inputs: {
          ...(node.inputs || {}),
          compositionDocument: nextDocument,
          layers,
          selectedLayerId: layers[0]?.id || null,
          capabilities: nextDocument.capabilities,
        },
      });
      showToast('真实像素分层已生成，可以下载 PSD', 'success');
    } catch (error) {
      updateWorkflowNode(node.id, { status: 'error', error: error.message || '像素分层生成失败' });
    }
  }, [showToast, updateWorkflowNode]);

  const handleWorkflowPsdExport = useCallback(async (node) => {
    const compositionDocument = node.inputs?.compositionDocument;
    if (!compositionDocument?.id || !node.inputs?.capabilities?.psdExport) {
      showToast('完成真实像素分层后才可导出 PSD', 'info');
      return;
    }
    try {
      const result = await exportCanvasPsd({ documentId: compositionDocument.id });
      const url = URL.createObjectURL(new Blob([result.buffer], { type: result.contentType }));
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
      showToast('多图层 PSD 已开始下载', 'success');
    } catch (error) {
      updateWorkflowNode(node.id, { status: 'error', error: error.message || 'PSD 导出失败' });
    }
  }, [showToast, updateWorkflowNode]);

  const zoomTo = useCallback((s) => { setViewport(v => ({ ...v, scale: Math.max(0.15, Math.min(4, s)) })); }, []);

  const handleDownload = (id) => {
    const n = id ? nodes.find(n => n.id === id) : nodes.find(n => n.id === selected);
    if (n) {
      const a = document.createElement('a');
      // B2: 走代理 URL 避免跨域 404
      a.href = proxyImg(n.url);
      a.download = `${n.name || n.displayLabel || n.label}.png`;
      a.target = '_blank';
      a.click();
    }
  };

  // A6: 多选下载 (B2: 走代理 URL)
  const handleMultiDownload = () => {
    multiSelected.forEach(id => {
      const n = nodes.find(n => n.id === id);
      if (n) {
        const a = document.createElement('a');
        a.href = proxyImg(n.url);
        a.download = `${n.name || n.displayLabel || n.label}.png`;
        a.target = '_blank';
        a.click();
      }
    });
  };

  // A6: 右键菜单动作
  const handleContextAction = async (action, node) => {
    if (action?.startsWith('create:')) {
      const actionId = action.slice('create:'.length);
      const sourceIndex = Math.max(0, nodes.findIndex(item => item.id === node?.id));
      const source = nodes[sourceIndex] || node;
      if (!canDeriveFromNode(source)) {
        showToast('完成当前处理后，可从生成结果继续派生', 'info');
        return;
      }
      const child = createDerivedNode({
        sourceNodeIds: [source.id],
        actionId,
        x: source.x + source.w + GAP * 2,
        y: source.y,
        inputs: { sourceNodeId: source.id, sourceUrl: source.url || null },
      });
      setNodes(prev => [...prev, child]);
      setConnections(prev => [...prev, createChildConnection(source.id, child.id, actionId)]);
      setSelected(child.id);
      setMultiSelected(new Set([child.id]));
      showToast(`已创建${child.title}节点`, 'success');
      return;
    }
    switch (action) {
      case 'download':
        handleDownload(node.id);
        break;
      case 'rename': {
        const next = await dialog.text({ title: '修改图片名称', message: '按投放位置或画面用途命名，后续查找和交付会更清楚。', defaultValue: node.name || node.displayLabel || '', placeholder: '例如：详情页核心卖点图' });
        if (next?.trim()) {
          setNodes(ns => ns.map(n => n.id === node.id ? { ...n, name: next.trim(), displayLabel: next.trim() } : n));
          showToast('已更新图片名称', 'success');
        }
        break;
      }
      case 'classify': {
        const next = await dialog.text({ title: '修改图片用途', message: `可选用途：${ASSET_GROUPS.join('、')}`, defaultValue: node.group, placeholder: ASSET_GROUPS.join(' / ') });
        if (ASSET_GROUPS.includes(next)) {
          setNodes(ns => ns.map(n => n.id === node.id ? { ...n, group: next } : n));
          showToast(`已归入${next}`, 'success');
        }
        break;
      }
      case 'edit-direction':
        setDirectionDraft(node);
        setDirectionTitle(node.direction?.title || node.name || '');
        setDirectionPurpose(node.direction?.purpose || node.usage || '');
        setDirectionComposition(node.direction?.composition || '');
        setDirectionCopy(node.direction?.copy || '');
        setDirectionRatio(node.ratio || '3:4');
        break;
      case 'remove-bg':
        showToast('AI 抠图中…请稍候', 'info');
        try {
          const data = await removeBg({ image_url: node.url });
          const resultUrl = data.result_url || data.url;
          if (resultUrl) {
            setNodes(ns => ns.map(n => n.id === node.id ? { ...n, url: resultUrl, loaded: false } : n));
            showToast('抠图完成！', 'success');
          } else {
            showToast(data.error || '抠图返回为空', 'error');
          }
        } catch (e) {
          handleCanvasActionError(e, { type: 'remove-bg', nodeId: node.id });
        }
        break;
      case 'reverse-prompt':
        showToast('AI 反向提示词分析中…', 'info');
        try {
          setPromptLoading(true);
          const data = await reversePrompt({ image_url: node.url, product_name: node.name || node.displayLabel || node.label });
          if (!data.prompt) throw new Error('未得到可编辑的提示词');
           setPromptPanel(node);
           setPromptText(data.prompt);
           setPromptReferences([]);
           showToast('已生成可编辑提示词', 'success');
        } catch (e) {
          handleCanvasActionError(e, { type: 'reverse-prompt', nodeId: node.id });
        } finally {
          setPromptLoading(false);
        }
        break;
      case 'copy-url':
        navigator.clipboard?.writeText(node.url);
        showToast('链接已复制', 'success');
        break;
      case 'delete':
        setNodes(ns => ns.filter(n => n.id !== node.id));
        setConnections(prev => removeConnectionsForNodes(prev, new Set([node.id])));
        break;
      default:
        // 裁切、宫格切图、卖点标注、引用生成等统一复用顶部工具条的真实处理链路。
        await handleToolAction(action, node);
        break;
    }
  };

  const handleToolAction = async (action, node) => {
    if (!node) return;
    const actionSpec = getCanvasAction(action?.id || action);
    const actionId = actionSpec?.id || String(action || '');
    const handler = actionSpec?.execute?.handler || actionId;
    setToolNodeId(node.id);
    if (handler.startsWith('create:')) {
      if (actionSpec) handleCreateDerivedNode(node.id, actionSpec, { x: node.x + node.w + GAP * 2, y: node.y });
      return;
    }
    if (handler === 'copy-url') {
      navigator.clipboard?.writeText(node.url);
      showToast('图片链接已复制', 'success');
      return;
    }
    if (handler === 'delete') {
      await handleContextAction('delete', node);
      setSelected(null);
      return;
    }
    if (handler === 'download') {
      await handleContextAction('download', node);
      return;
    }
    if (handler === 'image-info') {
      setImageInfoNode(node);
      setImageInfoName(node.name || node.displayLabel || '');
      setImageInfoGroup(node.group || '其他');
      setImageInfoUsage(node.usage || node.direction?.purpose || '');
      return;
    }
    if (handler === 'adjust-requirements') {
      setPromptPanel(node);
      setPromptText([
        node.direction?.purpose,
        node.direction?.composition,
        node.direction?.copy,
      ].filter(Boolean).join('\n') || '保留商品主体与品牌信息，调整画面表达：');
      setPromptReferences([]);
      return;
    }
    if (handler === 'regenerate') {
      if (promptLoading) return;
      setPromptLoading(true);
      try {
        const prompt = [node.direction?.purpose, node.direction?.composition, node.direction?.copy]
          .filter(Boolean).join('\n') || '保持商品、品牌和文字准确，重新生成同一商业用途的电商图片。';
        const url = await regenerateCanvasImage({ prompt, imageUrl: node.url, ratio: node.ratio });
        const output = normalizeCanvasNode({
          ...node,
          id: `node_regenerated_${Date.now()}`,
          kind: 'image',
          status: 'ready',
          url,
          x: node.x + node.w + GAP * 2,
          y: node.y,
          name: `${node.name || node.displayLabel || '电商图'}-重新生成`,
          displayLabel: `${node.name || node.displayLabel || '电商图'}-重新生成`,
          sourceNodeIds: [node.id],
        });
        setNodes(prev => [...prev, output]);
        setConnections(prev => [...prev, createChildConnection(node.id, output.id, actionId)]);
        setSelected(output.id);
        setMultiSelected(new Set([output.id]));
        showToast('新图片已生成并加入画布', 'success');
      } catch (error) {
        handleCanvasActionError(error, { type: actionId, nodeId: node.id });
      } finally {
        setPromptLoading(false);
      }
      return;
    }
    if (handler === 'crop') {
      setCropNode(node);
      setCropRatio(node.ratio === '1:1' ? '1:1' : '3:4');
      return;
    }
    if (handler === 'annotation') {
      setAnnotationNode(node);
      setAnnotationText(node.annotations?.[0]?.text || '');
      return;
    }
    if (handler === 'grid-split') {
      setPromptLoading(true);
      try {
        const data = await transformCanvasImage({ action: actionId, imageUrl: node.url });
        const parts = (data.urls || []).map(({ url }, index) => ({
          ...node,
          id: `${node.id}_grid_${index + 1}_${Date.now()}`,
          assetId: `${node.assetId}_grid_${index + 1}`,
          url,
          name: `${node.name || '电商图'}-切片${index + 1}`,
          displayLabel: `${node.name || '电商图'}-切片${index + 1}`,
          role: '详情切片',
          group: '详情图',
          sourceKey: `${node.sourceKey}_grid_${index + 1}`,
          x: node.x + (index % 2) * (node.w + GAP),
          y: node.y + Math.floor(index / 2) * (node.h + 76),
          crop: null,
          loaded: false,
        }));
        if (!parts.length) throw new Error('没有生成切片');
        setNodes(prev => [...prev, ...parts]);
        setConnections(prev => parts.reduce((acc, child) => addConnection(acc, node.id, child.id, 'variant'), prev));
        showToast('已生成 4 张独立切片', 'success');
      } catch (error) {
        showToast(error.message || '宫格切图失败', 'error');
      } finally {
        setPromptLoading(false);
      }
      return;
    }
    if (handler === 'layer-edit') {
      setPromptLoading(true);
      try {
        const data = await analyzeCanvasLayers(node.url);
        setNodes(prev => prev.map(n => n.id === node.id ? { ...n, layers: data.layers || [], layerStatus: data.status || '已识别' } : n));
        showToast(`已识别 ${data.layers?.length || 0} 个图层`, 'success');
      } catch (error) {
        showToast(error.message || '图层分析失败', 'error');
      } finally {
        setPromptLoading(false);
      }
      return;
    }
    if (handler === 'add-reference') {
      setComposerNodes(prev => prev.some(item => item.id === node.id) ? prev : [...prev, node]);
      setComposerText('');
      setComposerAction('');
      showToast('已加入引用素材，可继续补充生成要求', 'success');
      return;
    }
    const prompts = {
      translate: '把画面中的文案翻译成目标语言，保持字体层级、版式和商品主体不变：',
      upscale: '输出一张高清电商交付图，提升细节和清晰度，不改变商品外观：',
    };
    if (prompts[actionId]) {
      setComposerNodes(prev => prev.some(item => item.id === node.id) ? prev : [...prev, node]);
      setComposerText(prompts[actionId]);
      setComposerAction(actionId);
      showToast(`已进入${actionSpec?.label || '图片编辑'}流程`, 'info');
    }
  };

  const handleSaveCrop = async () => {
    if (!cropNode) return;
    setPromptLoading(true);
    try {
      const data = await transformCanvasImage({ action: 'crop', imageUrl: cropNode.url, ratio: cropRatio });
      setNodes(prev => prev.map(node => node.id === cropNode.id ? { ...node, url: data.url, ratio: cropRatio, crop: null, loaded: false } : node));
      setCropNode(null);
      showToast(`已生成 ${cropRatio} 稳定裁切图`, 'success');
    } catch (error) {
      showToast(error.message || '裁切失败', 'error');
    } finally {
      setPromptLoading(false);
    }
  };

  const handleSaveAnnotation = async () => {
    if (!annotationNode) return;
    const text = annotationText.trim();
    if (!text) {
      setNodes(prev => prev.map(node => node.id === annotationNode.id ? { ...node, annotations: [] } : node));
      setAnnotationNode(null);
      return;
    }
    setPromptLoading(true);
    try {
      const data = await transformCanvasImage({ action: 'annotation', imageUrl: annotationNode.url, annotation: text });
      setNodes(prev => prev.map(node => node.id === annotationNode.id ? { ...node, url: data.url, annotations: [{ id: `annotation_${Date.now()}`, text, kind: '卖点标注' }], loaded: false } : node));
      setAnnotationNode(null);
      showToast('标注已写入图片', 'success');
    } catch (error) {
      showToast(error.message || '标注失败', 'error');
    } finally {
      setPromptLoading(false);
    }
  };

  const handleAlignSelected = (mode) => {
    const selectedNodes = nodes.filter(node => multiSelected.has(node.id));
    if (selectedNodes.length < 2) return;
    const anchor = selectedNodes[0];
    setNodes(prev => prev.map(node => {
      if (!multiSelected.has(node.id) || node.id === anchor.id) return node;
      if (mode === 'left') return { ...node, x: anchor.x };
      if (mode === 'right') return { ...node, x: anchor.x + anchor.w - node.w };
      if (mode === 'center') return { ...node, x: anchor.x + (anchor.w - node.w) / 2 };
      if (mode === 'top') return { ...node, y: anchor.y };
      if (mode === 'bottom') return { ...node, y: anchor.y + anchor.h - node.h };
      return node;
    }));
    setAlignMode(mode);
    showToast('已按电商排版规范对齐', 'success');
  };

  const handleExport = async () => {
    const exportNodes = nodes.filter(node => multiSelected.size ? multiSelected.has(node.id) : true);
    if (!exportNodes.length) return;
    try {
      if (exportMode === '合并为详情长图') {
        const detailNodes = exportNodes.filter(node => node.group === '详情图');
        if (detailNodes.length < 2) throw new Error('请至少选择 2 张详情图再合并');
        const data = await stitchLongImage(detailNodes.map(node => node.url));
        if (!data.url) throw new Error('详情长图合成失败');
        const link = document.createElement('a');
        link.href = proxyImg(data.url);
        link.download = `${result.product_name || '商品'}-详情长图.png`;
        link.click();
        showToast('详情长图已导出', 'success');
      } else if (exportMode === '素材包清单') {
        const zip = new JSZip();
        const manifest = exportNodes.map(node => ({ name: node.name, group: node.group, role: node.role, ratio: node.ratio, usage: node.usage, sourceDirectionId: node.sourceDirectionId || null }));
        zip.file('素材清单.json', JSON.stringify({ product: result.product_name || '商品', platform: result.platform || '淘宝', assets: manifest }, null, 2));
        for (const node of exportNodes) {
          try {
            const response = await fetch(proxyImg(node.url));
            if (response.ok) zip.file(`${node.name || node.id}.${exportFormat.toLowerCase()}`, await response.blob());
          } catch {}
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${result.product_name || '商品'}-电商素材包.zip`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('电商素材包已导出', 'success');
      } else {
        exportNodes.forEach(node => {
          const link = document.createElement('a');
          link.href = proxyImg(node.url);
          link.download = `${node.name || node.id}.${exportFormat.toLowerCase()}`;
          link.click();
        });
        showToast(`已导出 ${exportNodes.length} 张${exportFormat}素材`, 'success');
      }
      setExportOpen(false);
    } catch (error) {
      showToast(error.message || '导出失败', 'error');
    }
  };

  const handleComposerGenerate = async () => {
    if (!composerNodes.length || !composerText.trim() || promptLoading) return;
    setPromptLoading(true);
    try {
      const source = composerNodes[0];
      const data = composerAction
        ? await transformCanvasImage({ action: composerAction, prompt: composerText, imageUrl: source.url, ratio: source.ratio })
        : { url: await regenerateCanvasImage({ prompt: composerText, imageUrl: source.url, referenceImages: composerNodes.slice(1).map(node => node.url).filter(Boolean), ratio: source.ratio }) };
      const url = data.url;
      const newNode = {
        ...source,
        id: `node_edit_${Date.now()}`,
        assetId: `asset_edit_${Date.now()}`,
        url,
        name: `${source.name || '电商图'}-编辑稿`,
        displayLabel: `${source.name || '电商图'}-编辑稿`,
        sourceDirectionId: source.sourceDirectionId,
        x: source.x + source.w + 56,
        y: source.y,
      };
      setNodes(prev => [...prev, newNode]);
      setConnections(prev => addConnection(prev, source.id, newNode.id, 'variant'));
      setComposerNodes([]);
      setComposerText('');
      setComposerAction('');
      showToast('编辑稿已生成并加入画布', 'success');
    } catch (error) {
      showToast(error.message || '图片编辑失败', 'error');
    } finally {
      setPromptLoading(false);
    }
  };

  const handleNew = () => {
    dispatch({ type: 'SET_MODE', mode: 'ecommerce' });
    dispatch({ type: 'NAVIGATE', page: 'home' });
  };
  const handleCanvasSourceUpload = async event => {
    const files = [...(event.target?.files || [])].filter(file => file.type.startsWith('image/')).slice(0, 8);
    event.target.value = '';
    if (!files.length) return;
    const assets = await Promise.all(files.map((file, index) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({
        assetId: `upload-${Date.now()}-${index}`,
        name: file.name || `商品原图 ${index + 1}`,
        url: String(reader.result || ''),
        sourceRole: 'product_original',
      });
      reader.onerror = () => reject(new Error('图片读取失败'));
      reader.readAsDataURL(file);
    })));
    const sourceNode = {
      id: `source-upload-${Date.now()}`,
      kind: 'source_group',
      status: 'ready',
      name: '商品原图',
      title: '商品原图',
      platform: result.platform || '淘宝',
      assets,
      x: 80,
      y: 100,
      w: 248,
      h: Math.max(200, 116 + Math.ceil(assets.length / 2) * 86),
      editable: true,
      sourceRole: 'product_original',
    };
    draftReadyRef.current = true;
    canvasSaveKeyRef.current ||= canvasDraftKey({ ...result, canvasImportId: `upload-${Date.now()}` });
    setNodes(previous => [...previous, sourceNode]);
    setSelected(sourceNode.id);
    setMultiSelected(new Set([sourceNode.id]));
    showToast('商品原图已加入画布，可从右侧端口创建电商处理', 'success');
  };
  const handleBack = () => dispatch({ type: 'NAVIGATE', page: 'home' });
  const openWork = (work) => {
    dispatch({ type: 'SET_RESULT', result: buildCanvasImportResult(work) });
    setTab('canvas');
  };
  const deleteWork = async (id) => {
    const work = pastWorks.find(x => x.id === id);
    if (!work) return;
    if (work._saveKey) await softDeleteWork(work._saveKey);
    const trashItem = { ...work, deletedAt: Date.now() };
    const next = pastWorks.filter(x => x.id !== id);
    setPastWorks(next);
    setTrashWorks(prev => [trashItem, ...prev.filter(item => String(item._saveKey || item.id) !== String(work._saveKey || work.id))]);
    localStorage.setItem('shubao_ec_works', JSON.stringify(next));
    try {
      const localTrash = JSON.parse(localStorage.getItem('shubao_ec_trash') || '[]');
      localStorage.setItem('shubao_ec_trash', JSON.stringify([trashItem, ...localTrash.filter(item => String(item._saveKey || item.id) !== String(work._saveKey || work.id))]));
    } catch {}
    showToast('已移入回收站，可恢复', 'success');
  };

  const restoreDeletedWork = async (work) => {
    if (!work) return;
    if (work._saveKey) {
      const ok = await restoreWork(work._saveKey);
      if (!ok) return showToast('恢复失败，请重试', 'error');
    }
    setPastWorks(prev => [...prev, {
      id: work.id,
      name: work.product_name || work.name || '历史作品',
      images: normalizeWorkImages(work.images),
      createdAt: work.at || '',
      _saveKey: work._saveKey,
    }]);
    setTrashWorks(prev => prev.filter(item => String(item._saveKey || item.id) !== String(work._saveKey || work.id)));
    try {
      const localTrash = JSON.parse(localStorage.getItem('shubao_ec_trash') || '[]');
      localStorage.setItem('shubao_ec_trash', JSON.stringify(localTrash.filter(item => String(item._saveKey || item.id) !== String(work._saveKey || work.id))));
    } catch {}
    showToast('作品已恢复', 'success');
  };

  // A6: 适配视口（提前定义以避免循环依赖）
  const fitView = useCallback(() => {
    const next = fitViewport(nodes, containerRef.current?.getBoundingClientRect());
    if (next) setViewport(next);
  }, [nodes]);

  const handleRemoveConnection = useCallback((connection) => {
    setConnections(prev => prev.filter(edge => edge !== connection));
    showToast('已删除素材关系', 'success');
  }, [showToast]);

  const handleStitch = async () => {
    const selectedNodes = nodes.filter(node => multiSelected.has(node.id) && node.group === '详情图');
    if (selectedNodes.length < 2) return;
    try {
      showToast('正在合成长详情图…', 'info');
      const data = await stitchLongImage(selectedNodes.map(node => node.url));
      if (!data.url) throw new Error('合成结果为空');
      const y = Math.max(...nodes.map(node => node.y + node.h + 120), 0);
      const counter = nodes.filter(node => node.role === '详情长图').length + 1;
      const merged = normalizeAsset({
        id: `node_long_${Date.now()}`,
        assetId: `asset_long_${Date.now()}`,
        url: data.url,
        sourceKey: 'detail_long',
        name: `详情长图-${String(counter).padStart(2, '0')}`,
        group: '详情图',
        role: '详情长图',
        ratio: '长图',
        w: 240,
        h: Math.round(240 * ((data.height || 1200) / (data.width || 800))),
        x: 0,
        y,
      }, nodes.length);
      setNodes(prev => [...prev, merged]);
      setConnections(prev => selectedNodes.reduce((acc, source) => addConnection(acc, source.id, merged.id, 'merge'), prev));
      setMultiSelected(new Set());
      showToast('详情长图已加入画布', 'success');
    } catch (error) { showToast(error.message || '合成长图失败', 'error'); }
  };

  const handlePromptRegenerate = async () => {
    if (!promptPanel || !promptText.trim() || promptLoading) return;
    setPromptLoading(true);
    try {
      const direction = directionDraft ? {
        id: directionDraft.direction?.id || `direction_${Date.now()}`,
        title: directionTitle || directionDraft.name,
        purpose: directionPurpose,
        composition: directionComposition,
        copy: directionCopy,
        ratio: directionRatio,
      } : null;
      const url = await regenerateCanvasImage({
        prompt: promptText,
        imageUrl: promptPanel.url,
        referenceImages: promptReferences.map(node => node.url).filter(Boolean),
        ratio: promptPanel.ratio,
        sourceDirectionId: direction?.id,
      });
      const newNode = {
        ...promptPanel,
        id: `node_regenerated_${Date.now()}`,
        assetId: `asset_regenerated_${Date.now()}`,
        url,
        x: promptPanel.x + promptPanel.w + 48,
        y: promptPanel.y,
        name: `${promptPanel.name || promptPanel.displayLabel || '电商图'}-二次生成`,
        displayLabel: `${promptPanel.name || promptPanel.displayLabel || '电商图'}-二次生成`,
        sourceDirectionId: direction?.id,
        direction,
      };
      setNodes(prev => [...prev, newNode]);
      setConnections(prev => addConnection(prev, promptPanel.id, newNode.id, 'variant'));
      setPromptPanel(null);
      setPromptReferences([]);
      setDirectionDraft(null);
      showToast('新图已加入画布', 'success');
    } catch (error) { showToast(error.message, 'error'); }
    finally { setPromptLoading(false); }
  };

  const handleDirectionSave = () => {
    if (!directionDraft) return;
    const direction = {
      id: directionDraft.direction?.id || directionDraft.sourceDirectionId || `direction_${Date.now()}`,
      title: directionTitle.trim() || directionDraft.name || '电商设计方案',
      purpose: directionPurpose.trim(),
      composition: directionComposition.trim(),
      copy: directionCopy.trim(),
      ratio: directionRatio,
      platform: result.platform || '淘宝',
    };
    setNodes(prev => prev.map(node => node.id === directionDraft.id ? { ...node, direction, ratio: direction.ratio } : node));
    setDirectionDraft(null);
    setPromptPanel({ ...directionDraft, direction });
    setPromptText([direction.purpose, direction.composition, direction.copy].filter(Boolean).join('\n'));
    showToast('设计方案已更新，可继续生成变体', 'success');
  };

  const handleBatchClassify = (group) => {
    if (!ASSET_GROUPS.includes(group) || !multiSelected.size) return;
    setNodes(prev => prev.map(node => multiSelected.has(node.id) ? { ...node, group } : node));
    setGroupDraft(group);
    setInspectorOpen(false);
    showToast(`已将 ${multiSelected.size} 张图归入${group}`, 'success');
  };

  // 删除节点（提前定义以避免循环依赖）
  const handleDelete = useCallback(() => {
    const ids = new Set([...multiSelected, ...(selected ? [selected] : [])]);
    if (!ids.size) return;
    setNodes(ns => ns.filter(n => !ids.has(n.id)));
    setConnections(prev => removeConnectionsForNodes(prev, ids));
    setSelected(null);
    setMultiSelected(new Set());
  }, [selected, multiSelected]);

  const handleSaveTextLayer = useCallback(async (layer) => {
    const node = nodes.find(item => item.id === textInspectorNodeId);
    if (!node || textCompositionSaving) return;
    const projectId = result.projectId;
    const versionId = result.resultVersionId || result.sourceVersionId;
    const backgroundAssetId = node.compositionBackgroundAssetId || generatedAssetIdFromUrl(node.url);
    const { width, height } = compositionSizeForNode(node);
    if (!projectId || !versionId || !backgroundAssetId) {
      setTextCompositionError('当前素材缺少可编辑项目版本或稳定素材地址');
      return;
    }
    setTextCompositionSaving(true);
    setTextCompositionError('');
    try {
      const current = node.compositionDocument;
      const sourceImageLayer = {
        id: 'source-image',
        kind: 'image',
        assetId: backgroundAssetId,
        name: '原始画面',
        x: 0,
        y: 0,
        width,
        height,
      };
      const layers = current
        ? [...current.layers.filter(item => item.kind === 'image'), layer]
        : [sourceImageLayer, layer];
      const response = current
        ? await saveTextCompositionRevision({
          documentId: current.id,
          expectedRevision: current.revision,
          layers,
        })
        : await createTextComposition({
          projectId,
          versionId,
          width,
          height,
          backgroundAssetId,
          layers,
        });
      setNodes(previous => previous.map(item => item.id === node.id ? {
        ...item,
        url: response.asset.url,
        loaded: false,
        compositionBackgroundAssetId: backgroundAssetId,
        compositionDocument: response.document,
      } : item));
      showToast(`文字版本 ${response.document.revision} 已保存`, 'success');
    } catch (error) {
      setTextCompositionError(error?.message || '文字保存失败');
    } finally {
      setTextCompositionSaving(false);
    }
  }, [nodes, result.projectId, result.resultVersionId, result.sourceVersionId, showToast, textCompositionSaving, textInspectorNodeId]);

  const handleImageInfoSave = useCallback(() => {
    if (!imageInfoNode || !imageInfoName.trim()) return;
    const name = imageInfoName.trim();
    const usage = imageInfoUsage.trim();
    setNodes(previous => previous.map(node => node.id === imageInfoNode.id ? {
      ...node,
      name,
      displayLabel: name,
      group: imageInfoGroup,
      usage,
      direction: {
        ...(node.direction || {}),
        title: name,
        purpose: usage,
      },
    } : node));
    setImageInfoNode(null);
    showToast('图片信息已更新', 'success');
  }, [imageInfoGroup, imageInfoName, imageInfoNode, imageInfoUsage, showToast]);

  const handleCanvasSessionSave = useCallback(async () => {
    const projectId = result.projectId;
    const baseVersionId = result.resultVersionId || result.sourceVersionId;
    if (!projectId || !baseVersionId) {
      showToast('当前作品缺少可保存的项目版本', 'error');
      return;
    }
    setCanvasSessionBusy(true);
    try {
      const snapshot = createCanvasSnapshot({ nodes, connections, viewport });
      const session = canvasSession?.id
        ? await saveCanvasSession(canvasSession.id, { expectedRevision: canvasSession.revision, snapshot })
        : await createCanvasSession({ projectId, baseVersionId, snapshot });
      setCanvasSession(session);
      if (result._saveKey) {
        const workResult = { ...result };
        delete workResult.canvasSession;
        await saveWork({
          ...workResult,
          canvasSessionId: session.id,
          canvasSessionRevision: session.revision,
        }, phone);
      }
      dispatch({
        type: 'SET_RESULT',
        result: { ...result, canvasSession: session, canvasSessionId: session.id, canvasSessionRevision: session.revision },
      });
      showToast('画布已保存', 'success');
    } catch (error) {
      showToast(error?.message || '画布保存失败', 'error');
    } finally {
      setCanvasSessionBusy(false);
    }
  }, [canvasSession, connections, dispatch, nodes, phone, result, showToast, viewport]);

  const handleCanvasSessionRestore = useCallback(async () => {
    const sessionId = canvasSession?.id || result.canvasSessionId;
    if (!sessionId) {
      showToast('请先保存画布，再使用恢复命令', 'info');
      return;
    }
    setCanvasSessionBusy(true);
    try {
      const session = await loadCanvasSession(sessionId);
      const snapshot = restoreCanvasSnapshot(session.snapshot);
      setNodes(snapshot.nodes.map(normalizeCanvasNode));
      setConnections(snapshot.connections.map(normalizeCanvasConnection));
      setViewport(snapshot.viewport);
      setSelected(null);
      setMultiSelected(new Set());
      setCanvasSession(session);
      showToast('已恢复保存的画布', 'success');
    } catch (error) {
      showToast(error?.message || '画布恢复失败', 'error');
    } finally {
      setCanvasSessionBusy(false);
    }
  }, [canvasSession?.id, result.canvasSessionId, showToast]);

  // 更新 ref（在函数定义之后）
  useEffect(() => { handleDeleteRef.current = handleDelete; }, [handleDelete]);
  useEffect(() => { fitViewRef.current = fitView; }, [fitView]);

  // 选中状态（单选 or 多选）
  const isNodeSelected = (id) => selected === id || multiSelected.has(id);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#F0EEE9', display: 'flex', flexDirection: 'column' }}>
      {/* ── 顶部工具栏 ── */}
      <div className="canvas-toolbar" style={{ height: 58, flexShrink: 0, background: 'rgba(255,255,255,0.94)', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, zIndex: 100 }}>
        <div onClick={handleBack} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><MdArrowBack size={16} color="#666" /></div>
        <div style={{ flexShrink: 0, marginLeft: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{tab === 'canvas' ? (result.product_name || '画布') : tab === 'trash' ? '回收站' : '我的作品集'}</div>
          <div style={{ fontSize: 11, color: '#999' }}>{tab === 'canvas' ? `${nodes.length} 张资产${multiSelected.size > 0 ? ` · ${multiSelected.size} 已选中` : ''}` : `${tab === 'trash' ? trashWorks.length : pastWorks.length} 个作品`}</div>
        </div>
        <div className="canvas-tabs" style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'rgba(0,0,0,0.05)', marginLeft: 12, flexShrink: 0 }}>
          {[['canvas','当前画布'],['works','作品集'],['trash','回收站']].map(([id,label]) => (
            <div key={id} onClick={() => setTab(id)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: tab===id ? '#fff' : 'transparent', color: tab===id ? '#1a1a1a' : '#999', boxShadow: tab===id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{label}</div>
          ))}
        </div>
        <div className="canvas-toolbar-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {tab === 'canvas' && (
            <>
              <div className="canvas-filters" style={{ display: 'flex', gap: 4, alignItems: 'center', marginRight: 6 }}>
                {['全部', ...ASSET_GROUPS].map(group => (
                  <button key={group} type="button" onClick={() => setActiveFilter(group)} style={{ border: 0, borderRadius: 999, padding: '6px 9px', background: activeFilter === group ? '#1f2937' : 'rgba(0,0,0,.05)', color: activeFilter === group ? '#fff' : '#666', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{group}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 3, borderRadius: 8, background: 'rgba(0,0,0,0.05)' }}>
                <div onClick={() => zoomTo(viewport.scale * 0.8)} style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666' }}><MdZoomOut size={16} /></div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#666', minWidth: 38, textAlign: 'center' }}>{Math.round(viewport.scale * 100)}%</div>
                <div onClick={() => zoomTo(viewport.scale * 1.25)} style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666' }}><MdZoomIn size={16} /></div>
                <div onClick={fitView} style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666' }} title="适配视口"><MdFitScreen size={16} /></div>
              </div>
              {multiSelected.size > 0 && (
                <div onClick={handleMultiDownload} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', borderRadius: 8, background: 'rgba(124,58,237,0.08)', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <MdDownload size={14} /> 批量下载({multiSelected.size})
                </div>
              )}
              {canStitch(nodes, multiSelected) && (
                <div onClick={handleStitch} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', borderRadius: 8, background: '#1f2937', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  <MdCollections size={14} /> 合并详情图
                </div>
              )}
              {multiSelected.size > 0 && (
                <div onClick={() => setInspectorOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', borderRadius: 8, background: 'rgba(37,99,235,.08)', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  <MdCategory size={14} /> 批量分类
                </div>
              )}
              {selectedNode?.kind === 'image' && (
                <button type="button" onClick={() => { setTextInspectorNodeId(selectedNode.id); setTextCompositionError(''); }} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 11px', border: 0, borderRadius: 8, background: 'rgba(15,118,110,.10)', color: '#0f766e', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  <MdTextFields size={15} /> 文字图层
                </button>
              )}
              <div onClick={() => setExportOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 12px', borderRadius: 8, background: 'rgba(16,185,129,.10)', color: '#047857', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <MdFileDownload size={14} /> 交付导出
              </div>
              <button type="button" onClick={handleCanvasSessionSave} disabled={canvasSessionBusy} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 11px', border: 0, borderRadius: 8, background: 'rgba(37,99,235,.08)', color: '#2563eb', fontSize: 12, fontWeight: 700, cursor: canvasSessionBusy ? 'wait' : 'pointer' }}>
                <MdSave size={15} /> 保存画布
              </button>
              <button type="button" onClick={handleCanvasSessionRestore} disabled={canvasSessionBusy || !(canvasSession?.id || result.canvasSessionId)} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 11px', border: 0, borderRadius: 8, background: 'rgba(107,114,128,.09)', color: '#4b5563', fontSize: 12, fontWeight: 700, cursor: canvasSessionBusy ? 'wait' : 'pointer' }}>
                <MdRestore size={15} /> 恢复画布
              </button>
              {(selected || multiSelected.size > 0) && (
                <div onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <MdDelete size={14} /> 删除
                </div>
              )}
            </>
          )}
          <div onClick={handleNew} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', borderRadius: 8, background: 'var(--command)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--focus-ring)', boxShadow: '0 3px 12px rgba(37,99,235,0.30)' }}>
            <MdAdd size={14} /> 新建生图
          </div>
        </div>
      </div>

      {tab === 'canvas' ? (
        <div
          ref={containerRef}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#f6f5f2', backgroundImage: 'radial-gradient(rgba(58, 50, 39, .16) 1px, transparent 1px)', backgroundSize: '18px 18px', cursor: canvasCursorForState({ pointerKind: pointerMode?.kind, shiftKey: shiftPressed }), userSelect: 'none', touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={event => {
            if (!nodes.length && !event.target?.closest?.('button,input,textarea,select,a')) sourceUploadRef.current?.click();
          }}
        >
          <input ref={sourceUploadRef} type="file" accept="image/*" multiple onChange={handleCanvasSourceUpload} style={{ display: 'none' }} />
          {!nodes.length && (
            <div className="canvas-empty-state" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#374151', marginBottom: 7 }}>双击画布导入商品素材</div>
              <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 18 }}>从商品原图开始，再生成主图、详情图和 SKU 素材</div>
              <div style={{ display: 'flex', gap: 9 }}>
                <button type="button" onClick={() => sourceUploadRef.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 15px', borderRadius: 8, border: 0, background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}><MdAddPhotoAlternate size={16} /> 上传商品原图</button>
                <button type="button" onClick={() => setTab('works')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 15px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}><MdCollections size={16} /> 从我的作品导入</button>
              </div>
            </div>
          )}

          <ConnectionLines connections={connections} nodes={connectionNodes} viewport={viewport} onRemove={handleRemoveConnection} focusNodeIds={focusedNodeIds} />
          <ConnectionDraftLine draft={connectionDraft} nodes={connectionNodes} viewport={viewport} />

          <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`, transformOrigin: '0 0', willChange: 'transform' }}>
            {(() => {
              const groups = {};
              visibleNodes.forEach(n => { if (!groups[n.group]) groups[n.group] = n.y; });
              return Object.entries(groups).map(([group, y]) => (
                <div key={group} style={{ position: 'absolute', left: 0, top: y - 28, fontSize: 14, fontWeight: 800, color: 'rgba(0,0,0,0.35)', pointerEvents: 'none', userSelect: 'none' }}>
                  {group}
                </div>
              ));
            })()}
            {visibleNodes.map(node => {
              const selectedNodeState = isNodeSelected(node.id);
              const nodeSource = nodes.find(source => source.id === node.sourceNodeIds?.[0]);
              const sourcePreviewUrl = nodeSource?.url || nodeSource?.assets?.find(asset => asset?.url)?.url || '';
              const sourcePreview = sourcePreviewUrl ? { ...nodeSource, url: proxyImg(sourcePreviewUrl) } : null;
              const workflowPortDown = (event, side) => handlePortPointerDown(event, node.id, side);
              const workflowPortUp = (event, side) => handlePortPointerUp(event, node.id, side);
              const workflowContext = event => setContextMenu({ x: event.clientX, y: event.clientY, node });
              if (node.kind === 'source_group') {
                return <SourceGroupNode
                  key={node.id}
                  node={node}
                  selected={selectedNodeState}
                  dimmed={Boolean(focusedNodeIds && !focusedNodeIds.has(node.id))}
                  onPointerDown={handleNodeDown}
                  onPortPointerDown={handlePortPointerDown}
                  onPortPointerUp={handlePortPointerUp}
                  onHoverChange={setHoveredNodeId}
                  onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
                  onInspect={node => setZoomImg({ url: node.url, label: node.name || node.displayLabel || '图片预览' })}
                />;
              }
              if (node.kind === 'image' || node.kind === 'output') {
                return <ImageNode
                  key={node.id}
                  node={node}
                  selected={selectedNodeState}
                  multiSelected={multiSelected.has(node.id)}
                  dimmed={Boolean(focusedNodeIds && !focusedNodeIds.has(node.id))}
                  hoverActions={actionsForSurface({ surface: 'hover', node })}
                  onAction={handleToolAction}
                  onPointerDown={handleNodeDown}
                  onToggleSelect={handleToggleSelect}
                  onPortPointerDown={handlePortPointerDown}
                  onPortPointerUp={handlePortPointerUp}
                  onHoverChange={setHoveredNodeId}
                  onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
                />;
              }
              const productImages = (node.inputs?.productImages || []).map(image => ({ ...image, url: proxyImg(image.url) }));
              const referenceImages = (node.inputs?.referenceImages || []).map(image => ({ ...image, url: proxyImg(image.url) }));
              const workflowAction = getCanvasAction(node.actionId);
              return <div key={node.id} data-canvas-node-id={node.id} onMouseEnter={() => setHoveredNodeId(node.id)} onMouseLeave={() => setHoveredNodeId(null)} style={{ position: 'absolute', left: node.x, top: node.y, width: node.w, minHeight: node.h, opacity: focusedNodeIds && !focusedNodeIds.has(node.id) ? 0.34 : 1, transition: 'opacity 0.16s' }}>
                <CanvasWorkflowNode
                  node={node}
                  sourceNode={sourcePreview}
                  actions={actionsForSurface({ surface: 'port', node })}
                  selected={selectedNodeState}
                  onPointerDown={event => handleNodeDown(event, node.id)}
                  onContextMenu={workflowContext}
                  onRetry={() => handleWorkflowRetry(node)}
                  onPortPointerDown={workflowPortDown}
                  onPortPointerUp={workflowPortUp}
                  canDerive={canDeriveFromNode(node)}
                  smartRemixProps={node.kind === 'smart-remix' ? {
                    prompt: node.inputs?.prompt || '',
                    productImages,
                    referenceImages,
                    instruction: node.inputs?.instruction || '',
                    outputCount: node.inputs?.outputCount || 1,
                    error: node.error,
                    onPromptChange: value => updateWorkflowInputs(node.id, { prompt: value }),
                    onAddProductImages: files => handleWorkflowAddImages(node.id, 'productImages', files),
                    onRemoveProductImage: image => updateWorkflowInputs(node.id, { productImages: (node.inputs?.productImages || []).filter(item => item.id !== image.id) }),
                    onAddReferenceImages: files => handleWorkflowAddImages(node.id, 'referenceImages', files),
                    onRemoveReferenceImage: image => updateWorkflowInputs(node.id, { referenceImages: (node.inputs?.referenceImages || []).filter(item => item.id !== image.id) }),
                    onInstructionChange: value => updateWorkflowInputs(node.id, { instruction: value }),
                    onOutputCountChange: value => updateWorkflowInputs(node.id, { outputCount: value }),
                    onGenerate: () => handleWorkflowGenerate(node),
                  } : undefined}
                  layerProps={node.kind === 'layer-workbench' ? {
                    layers: node.inputs?.layers || [],
                    selectedLayerId: node.inputs?.selectedLayerId,
                    capabilities: node.inputs?.capabilities || {},
                    onSelectLayer: layerId => updateWorkflowInputs(node.id, { selectedLayerId: layerId }),
                    onToggleVisibility: layer => updateWorkflowLayers(node.id, layers => layers.map(item => item.id === layer.id ? { ...item, visible: item.visible === false } : item)),
                    onToggleLock: layer => updateWorkflowLayers(node.id, layers => layers.map(item => item.id === layer.id ? { ...item, locked: !item.locked } : item)),
                    onMoveLayer: (layer, direction) => updateWorkflowLayers(node.id, layers => {
                      const index = layers.findIndex(item => item.id === layer.id);
                      const nextIndex = direction === 'up' ? index - 1 : index + 1;
                      if (index < 0 || nextIndex < 0 || nextIndex >= layers.length) return layers;
                      const next = [...layers];
                      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
                      return next;
                    }),
                    onExportPng: handleWorkflowLayerExport,
                    onCreatePixelLayers: node.inputs?.compositionDocument ? () => handleWorkflowPixelLayers(node) : undefined,
                    onExportPsd: () => handleWorkflowPsdExport(node),
                  } : undefined}
                  compactProps={node.kind !== 'smart-remix' && node.kind !== 'layer-workbench' ? {
                    sourceImage: sourcePreview?.url,
                    resultImage: node.output?.url ? proxyImg(node.output.url) : '',
                    error: node.error,
                    prompt: node.inputs?.prompt || '',
                    ratio: node.inputs?.ratio || '',
                    requirements: workflowAction?.execute?.requires || {},
                    onPromptChange: value => updateWorkflowInputs(node.id, { prompt: value }),
                    onRatioChange: value => updateWorkflowInputs(node.id, { ratio: value }),
                    onRun: () => handleWorkflowProcess(node),
                  } : undefined}
                />
              </div>;
            })}
            {selectedNode && actionsForSurface({ surface: 'selection', node: selectedNode }).length > 0 && toolNodeId === selectedNode.id && <SelectionActionBar node={selectedNode} actions={actionsForSurface({ surface: 'selection', node: selectedNode })} onAction={handleToolAction} onClose={() => setToolNodeId(null)} />}
            {connectionPicker && <CanvasNodeActionPicker
              actions={actionsForSurface({ surface: 'port', node: nodes.find(item => item.id === connectionPicker.sourceNodeId) })}
              position={clampCanvasPickerPosition({
                world: { x: connectionPicker.world.x + 14, y: connectionPicker.world.y + 14 },
                viewport,
                bounds: containerRef.current?.getBoundingClientRect(),
              })}
              onClose={() => { setConnectionPicker(null); setConnectionDraft(null); }}
              onSelect={action => handleCreateDerivedNode(connectionPicker.sourceNodeId, action, connectionPicker.world)}
            />}
          </div>

          {marquee && (
            <div style={{ position: 'absolute', left: marquee.x * viewport.scale + viewport.x, top: marquee.y * viewport.scale + viewport.y, width: Math.abs(marquee.w) * viewport.scale, height: Math.abs(marquee.h) * viewport.scale, transform: `translate(${marquee.w < 0 ? marquee.w * viewport.scale : 0}px,${marquee.h < 0 ? marquee.h * viewport.scale : 0})`, border: '1px solid #7c3aed', background: 'rgba(124,58,237,.10)', pointerEvents: 'none', zIndex: 20 }} />
          )}

          {connectionDraft && (
            <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, background: '#1f2937', color: '#fff', padding: '7px 12px', borderRadius: 9, fontSize: 11, zIndex: 40 }}>
              <span>正在连接素材</span><span style={{ opacity: .65 }}>拖到目标节点完成连接，松开空白处创建电商任务</span>
            </div>
          )}

          {/* 操作提示 */}
          <div style={{ position: 'absolute', bottom: 16, right: 16, fontSize: 11, color: 'rgba(0,0,0,0.28)', pointerEvents: 'none', textAlign: 'right', lineHeight: 1.6 }}>
            空白拖拽平移 · Shift 拖拽框选 · Space/Alt/中键平移 · 滚轮缩放<br/>
            Ctrl/Shift 多选 · 端口连线
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 20px 72px' }}>
          {((tab === 'trash' ? trashWorks : pastWorks).length === 0) ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.15 }}>{tab === 'trash' ? '🗑️' : '📁'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#999' }}>{tab === 'trash' ? '回收站是空的' : '还没有作品'}</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
              {(tab === 'trash' ? trashWorks : pastWorks).map(work => (
                <div key={work.id} style={{ borderRadius: 16, overflow: 'hidden', background: '#fff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{work.name}</div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{work.images?.length || 0} 张图片</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <div onClick={() => openWork(work)} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7c3aed' }}><MdOpenInNew size={14} /></div>
                      {tab === 'trash' ? (
                        <div onClick={() => restoreDeletedWork(work)} title="恢复作品" style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(16,185,129,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#059669', fontSize: 11, fontWeight: 700 }}>恢复</div>
                      ) : (
                        <div onClick={() => deleteWork(work.id)} title="移入回收站" style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(239,68,68,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}><MdDelete size={14} /></div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, padding: '0 14px 12px', overflowX: 'auto' }}>
                    {(work.images || []).slice(0, 6).map((img, i) => (
                      <img key={i} src={proxyImg(img)} alt="" onClick={() => setZoomImg({ url: proxyImg(img), label: img.label || '' })} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)', flexShrink: 0, cursor: 'pointer' }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* A6: 右键上下文菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          actions={actionsForSurface({ surface: 'context', node: contextMenu.node })}
          onClose={() => setContextMenu(null)}
          onAction={handleToolAction}
        />
      )}

      {imageInfoNode && (
        <div role="dialog" aria-modal="true" aria-labelledby="canvas-image-info-title" style={{ position: 'fixed', inset: 0, zIndex: 10005, background: 'rgba(15,23,42,.38)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <div style={{ width: 'min(430px, 100%)', boxSizing: 'border-box', background: '#fff', borderRadius: 8, boxShadow: '0 24px 70px rgba(15,23,42,.24)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div id="canvas-image-info-title" style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>图片信息</div>
                <div style={{ marginTop: 3, fontSize: 11, color: '#6b7280' }}>名称与用途会显示在画布和交付信息中</div>
              </div>
              <button type="button" aria-label="关闭图片信息" onClick={() => setImageInfoNode(null)} style={{ width: 30, height: 30, border: 0, borderRadius: 7, background: '#f3f4f6', color: '#4b5563', cursor: 'pointer' }}><MdClose size={17} /></button>
            </div>
            <label style={{ display: 'block', marginBottom: 12, fontSize: 11, fontWeight: 700, color: '#4b5563' }}>
              图片名称
              <input autoFocus value={imageInfoName} maxLength={80} onChange={event => setImageInfoName(event.target.value)} style={{ display: 'block', width: '100%', height: 38, boxSizing: 'border-box', marginTop: 6, padding: '0 10px', border: '1px solid #d1d5db', borderRadius: 7, font: '12px inherit' }} />
            </label>
            <label style={{ display: 'block', marginBottom: 12, fontSize: 11, fontWeight: 700, color: '#4b5563' }}>
              图片类型
              <select value={imageInfoGroup} onChange={event => setImageInfoGroup(event.target.value)} style={{ display: 'block', width: '100%', height: 38, boxSizing: 'border-box', marginTop: 6, padding: '0 10px', border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', font: '12px inherit' }}>
                {ASSET_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}
              </select>
            </label>
            <label style={{ display: 'block', marginBottom: 16, fontSize: 11, fontWeight: 700, color: '#4b5563' }}>
              展示用途
              <textarea value={imageInfoUsage} maxLength={240} rows={3} onChange={event => setImageInfoUsage(event.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: 7, resize: 'vertical', font: '12px/1.55 inherit' }} />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setImageInfoNode(null)} style={{ border: 0, borderRadius: 7, padding: '9px 14px', background: '#f3f4f6', color: '#4b5563', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>取消</button>
              <button type="button" disabled={!imageInfoName.trim()} onClick={handleImageInfoSave} style={{ border: 0, borderRadius: 7, padding: '9px 16px', background: imageInfoName.trim() ? '#2563eb' : '#9ca3af', color: '#fff', fontSize: 12, fontWeight: 700, cursor: imageInfoName.trim() ? 'pointer' : 'not-allowed' }}>保存</button>
            </div>
          </div>
        </div>
      )}

      {textInspectorNode && (
        <TextLayerInspector
          layer={defaultTextLayerForNode(textInspectorNode)}
          saving={textCompositionSaving}
          error={textCompositionError}
          onSave={handleSaveTextLayer}
          onClose={() => { setTextInspectorNodeId(null); setTextCompositionError(''); }}
        />
      )}

      {inspectorOpen && multiSelected.size > 0 && (
        <div style={{ position: 'fixed', top: 70, right: 18, zIndex: 10003, width: 220, background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 12, boxShadow: '0 12px 36px rgba(0,0,0,.16)', padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#1f2937', marginBottom: 8 }}>批量修改分类</div>
          <div style={{ fontSize: 11, color: '#777', marginBottom: 10 }}>已选 {multiSelected.size} 张资产</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {ASSET_GROUPS.map(group => <button key={group} type="button" onClick={() => handleBatchClassify(group)} style={{ border: 0, borderRadius: 8, padding: '8px 6px', background: groupDraft === group ? 'rgba(124,58,237,.12)' : 'rgba(0,0,0,.04)', color: groupDraft === group ? '#7c3aed' : '#555', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{group}</button>)}
          </div>
        </div>
      )}

      {directionDraft && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10005, background: 'rgba(15,23,42,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: 'min(540px, 100%)', background: '#fff', borderRadius: 16, boxShadow: '0 24px 70px rgba(15,23,42,.24)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>再次编辑设计方案</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>修改后可继续生成变体，原图不会被覆盖</div>
              </div>
              <button type="button" onClick={() => setDirectionDraft(null)} style={{ border: 0, background: 'rgba(0,0,0,.05)', borderRadius: 8, width: 30, height: 30, cursor: 'pointer' }}>×</button>
            </div>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 5 }}>方案名称<input value={directionTitle} readOnly aria-readonly="true" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 10px', fontSize: 12, background: '#f7f7f8', color: '#6b7280', cursor: 'default' }} /></label>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 5 }}>电商用途<textarea value={directionPurpose} onChange={e => setDirectionPurpose(e.target.value)} rows={2} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 10px', fontSize: 12, resize: 'vertical' }} /></label>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 5 }}>构图与视觉<textarea value={directionComposition} onChange={e => setDirectionComposition(e.target.value)} rows={3} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 10px', fontSize: 12, resize: 'vertical' }} /></label>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 10 }}>文案要求<textarea value={directionCopy} onChange={e => setDirectionCopy(e.target.value)} rows={2} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 10px', fontSize: 12, resize: 'vertical' }} /></label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>画面比例</span>
              {['1:1', '3:4', '9:16', '长图'].map(ratio => <button key={ratio} type="button" onClick={() => setDirectionRatio(ratio)} style={{ border: 0, borderRadius: 999, padding: '5px 9px', background: directionRatio === ratio ? '#1f2937' : 'rgba(0,0,0,.05)', color: directionRatio === ratio ? '#fff' : '#666', fontSize: 10, cursor: 'pointer' }}>{ratio}</button>)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setDirectionDraft(null)} style={{ border: 0, borderRadius: 8, padding: '9px 14px', background: 'rgba(0,0,0,.05)', color: '#555', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>取消</button>
              <button type="button" onClick={handleDirectionSave} style={{ border: 0, borderRadius: 8, padding: '9px 16px', background: '#7c3aed', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>保存方案并继续编辑</button>
            </div>
          </div>
        </div>
      )}

      {promptPanel && (
        <div style={{ position: 'fixed', zIndex: 10004, right: 22, bottom: 22, width: 'min(440px, calc(100vw - 44px))', background: '#fff', border: '1px solid rgba(0,0,0,.1)', boxShadow: '0 18px 50px rgba(0,0,0,.18)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}><strong style={{ fontSize: 14 }}>反推提示词并重新生成</strong><button type="button" onClick={() => { setPromptPanel(null); setPromptReferences([]); }} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 18 }}>×</button></div>
          <div style={{ fontSize: 11, color: '#777', marginBottom: 8 }}>以当前图片为参考，保留商品本体，按你的修改生成新图。</div>
          <textarea value={promptText} onChange={e => setPromptText(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 140, resize: 'vertical', padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,.15)', font: '12px/1.6 inherit' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, overflowX: 'auto' }}>
            {promptReferences.map(reference => <div key={reference.id} style={{ position: 'relative', width: 42, height: 42, flexShrink: 0 }}><img src={proxyImg(reference.url)} alt={reference.name || '补充参考图'} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 7 }} /><button type="button" aria-label="移除补充参考图" onClick={() => setPromptReferences(prev => prev.filter(item => item.id !== reference.id))} style={{ position: 'absolute', top: -5, right: -5, width: 15, height: 15, border: 0, borderRadius: '50%', background: '#111827', color: '#fff', fontSize: 10, cursor: 'pointer' }}>×</button></div>)}
            <button type="button" onClick={() => document.getElementById('canvas-prompt-reference-input')?.click()} style={{ height: 42, padding: '0 10px', border: '1px dashed #c4b5fd', borderRadius: 7, background: '#faf5ff', color: '#7c3aed', fontSize: 10, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ 补充参考图</button>
            <input id="canvas-prompt-reference-input" type="file" accept="image/*" multiple hidden onChange={async event => { await handlePromptAddImages(event.target.files ? [...event.target.files] : []); event.target.value = ''; }} />
          </div>
          <button type="button" onClick={handlePromptRegenerate} disabled={promptLoading} style={{ marginTop: 10, width: '100%', border: 0, borderRadius: 8, padding: '10px 14px', background: '#1f2937', color: '#fff', fontWeight: 700, cursor: promptLoading ? 'wait' : 'pointer' }}>{promptLoading ? '正在生成…' : '按此方案生成'}</button>
        </div>
      )}

      {composerNodes.length > 0 && (
        <ReferenceComposer
          references={composerNodes}
          promptText={composerText}
          setPromptText={setComposerText}
          onRemoveReference={id => setComposerNodes(prev => prev.filter(node => node.id !== id))}
          onAddReferenceFiles={handleComposerAddImages}
          onGenerate={handleComposerGenerate}
          loading={promptLoading}
        />
      )}

      {cropNode && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10005, background: 'rgba(15,23,42,.40)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: 360, background: '#fff', borderRadius: 15, padding: 18, boxShadow: '0 24px 70px rgba(15,23,42,.22)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>裁切画幅</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 14 }}>用于适配平台主图、商品卡或详情模块</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
              {[['1:1', '方形主图'], ['3:4', '竖版详情'], ['9:16', '短视频封面'], ['长图', '详情长图']].map(([ratio, label]) => <button key={ratio} type="button" onClick={() => setCropRatio(ratio)} style={{ border: 0, borderRadius: 9, padding: '9px 10px', background: cropRatio === ratio ? '#1f2937' : '#f3f4f6', color: cropRatio === ratio ? '#fff' : '#4b5563', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{label}<span style={{ display: 'block', fontSize: 9, opacity: .7, marginTop: 2 }}>{ratio}</span></button>)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setCropNode(null)} style={{ border: 0, borderRadius: 8, padding: '9px 13px', background: '#f3f4f6', cursor: 'pointer' }}>取消</button><button type="button" onClick={handleSaveCrop} style={{ border: 0, borderRadius: 8, padding: '9px 15px', background: '#7c3aed', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>应用画幅</button></div>
          </div>
        </div>
      )}

      {annotationNode && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10005, background: 'rgba(15,23,42,.40)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: 420, background: '#fff', borderRadius: 15, padding: 18, boxShadow: '0 24px 70px rgba(15,23,42,.22)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>卖点 / 尺寸标注</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>适合添加“食品级材质”“容量 500ml”“防泼水”等购买决策信息</div>
            <textarea value={annotationText} onChange={e => setAnnotationText(e.target.value)} rows={4} placeholder="请输入一条简短标注，例如：食品级 304 不锈钢" style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, fontSize: 12, resize: 'vertical' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 13 }}><button type="button" onClick={() => setAnnotationNode(null)} style={{ border: 0, borderRadius: 8, padding: '9px 13px', background: '#f3f4f6', cursor: 'pointer' }}>取消</button><button type="button" onClick={handleSaveAnnotation} style={{ border: 0, borderRadius: 8, padding: '9px 15px', background: '#7c3aed', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>保存标注</button></div>
          </div>
        </div>
      )}

      {exportOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10005, background: 'rgba(15,23,42,.44)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: 'min(500px,100%)', background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 24px 70px rgba(15,23,42,.24)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div><div style={{ fontSize: 16, fontWeight: 800 }}>电商素材交付</div><div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>按平台交付习惯导出单图、详情长图或素材包</div></div><button type="button" onClick={() => setExportOpen(false)} style={{ border: 0, background: '#f3f4f6', borderRadius: 8, width: 30, height: 30, cursor: 'pointer' }}>×</button></div>
            <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
              {[['逐张导出', '每张图片按业务名称分别导出'], ['合并为详情长图', '将选中的详情图按顺序拼成长图'], ['素材包清单', '图片 + 分组 + 用途 + 方案来源一起打包']].map(([mode, desc]) => <button key={mode} type="button" onClick={() => setExportMode(mode)} style={{ textAlign: 'left', border: exportMode === mode ? '1.5px solid #7c3aed' : '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', background: exportMode === mode ? 'rgba(124,58,237,.06)' : '#fff', cursor: 'pointer' }}><div style={{ fontSize: 12, fontWeight: 800, color: '#374151' }}>{mode}</div><div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>{desc}</div></button>)}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 15 }}><span style={{ fontSize: 11, color: '#6b7280' }}>交付格式</span>{['PNG', 'JPG'].map(format => <button key={format} type="button" onClick={() => setExportFormat(format)} style={{ border: 0, borderRadius: 999, padding: '5px 10px', background: exportFormat === format ? '#1f2937' : '#f3f4f6', color: exportFormat === format ? '#fff' : '#666', fontSize: 10, cursor: 'pointer' }}>{format}</button>)}</div>
            {multiSelected.size > 1 && <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, marginBottom: 14 }}><div style={{ fontSize: 11, fontWeight: 800, color: '#374151', marginBottom: 7 }}>选中素材排版</div><div style={{ display: 'flex', gap: 5 }}>{[['left', '左对齐'], ['center', '水平居中'], ['right', '右对齐'], ['top', '顶对齐'], ['bottom', '底对齐']].map(([mode, label]) => <button key={mode} type="button" onClick={() => handleAlignSelected(mode)} style={{ border: 0, borderRadius: 7, padding: '6px 7px', background: alignMode === mode ? 'rgba(124,58,237,.12)' : '#f3f4f6', color: alignMode === mode ? '#7c3aed' : '#666', fontSize: 10, cursor: 'pointer' }}>{label}</button>)}</div></div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button type="button" onClick={() => setExportOpen(false)} style={{ border: 0, borderRadius: 8, padding: '9px 13px', background: '#f3f4f6', cursor: 'pointer' }}>取消</button><button type="button" onClick={handleExport} style={{ border: 0, borderRadius: 8, padding: '9px 16px', background: '#047857', color: '#fff', fontWeight: 800, cursor: 'pointer' }}><MdFileDownload size={14} /> 确认导出</button></div>
          </div>
        </div>
      )}

      {/* 图片放大预览 */}
      {zoomImg && (
        <div onClick={() => setZoomImg(null)} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <img src={proxyImg(zoomImg.url)} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} onClick={e => e.stopPropagation()} />
          <div onClick={() => setZoomImg(null)} style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 24, color: '#fff' }}>x</div>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 10003, background: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : '#7c3aed', color: '#fff', fontSize: 13, fontWeight: 600, padding: '10px 20px', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.2)', animation: 'toastIn 0.3s ease' }}>
          {toast.msg}
        </div>
      )}

      {/* B10: 全局键盘快捷键 */}

      <style>{`
        @keyframes skeletonShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
      `}</style>
    </div>
  );
}
