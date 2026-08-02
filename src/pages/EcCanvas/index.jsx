import React, { useState, useEffect, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import { MdArrowBack, MdDownload, MdGridOn, MdCollections, MdAdd, MdDelete, MdOpenInNew, MdZoomIn, MdZoomOut, MdFitScreen, MdClose, MdLink, MdAutoFixHigh, MdImageSearch, MdEdit, MdCategory, MdMergeType, MdCheckBoxOutlineBlank, MdCheckBox, MdCrop, MdTextFields, MdLayers, MdTune, MdTranslate, MdHighQuality, MdAspectRatio, MdFileDownload, MdAddPhotoAlternate, MdCenterFocusStrong, MdSave, MdRestore } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import { loadWorks, saveWork, proxyImg, deleteWork as softDeleteWork, loadTrash, restoreWork, reversePrompt, removeBg, stitchLongImage, regenerateCanvasImage, regenerateImage, regenerateText, generateEcommerceSuite, transformCanvasImage, analyzeCanvasLayers, uploadECTempImages, createTextComposition, listTextCompositions, saveTextCompositionRevision, createCanvasPixelLayers, exportCanvasPsd } from '../../services/api';
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
  readableInitialViewport,
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
import { CanvasPortHandle, CanvasWorkflowNode } from './components/workflowNodes';
import { CanvasBottomToolbar, CanvasLayersPanel, CanvasLeftRail, CanvasTopBar, CanvasZoomControls } from './components/CanvasChrome.jsx';
import {
  CanvasAddMenu,
  CanvasDeriveMenu,
  CanvasEcommerceComposer,
  CanvasFocusedEditor,
  CanvasImageComposer,
  CanvasImageNode as StudioImageNode,
  CanvasMultiSelectionToolbar,
  CanvasObjectToolbar,
  CanvasSourceNode as StudioSourceNode,
  CanvasTextComposer,
  CanvasTextNode as StudioTextNode,
  CanvasTextToolbar,
} from './components/CanvasStudio.jsx';
import { normalizeWorkImages } from '../../utils/workImages.js';
import { handleGenerationAccessError } from '../../utils/generationAccess.js';
import { createCanvasSession, loadCanvasSession, saveCanvasSession } from '../../services/projects.js';
import { useDialog } from '../../components/ui/DialogProvider.jsx';
import ContextMenu from './ContextMenu.jsx';
import { actionsForSurface, getCanvasAction } from './canvasActionRegistry.js';
import { createCanvasSnapshot, createFreshCanvasSession, restoreCanvasSnapshot } from './canvasSessionModel.js';
import { buildCanvasImportResult, canvasOutputImages, normalizeCanvasWorkPanel } from './canvasWorkModel.js';
import { cleanupLegacyCanvasStorage } from '../Works/retentionModel.js';
import TextLayerInspector from './components/TextLayerInspector.jsx';
import ResponsiveImage from '../../components/ResponsiveImage.jsx';
import { canvasDraftKey, loadCanvasDraft, saveCanvasDraft } from './canvasDraftRepository.js';
import { applyMultiSelectionAction, CANVAS_CREATION_OPTIONS, expandCanvasDragSelection, getCanvasFocusIds, getContextPanelPosition, isCanvasConnectionVisible, selectedCanvasBounds } from './canvasInteractionModel.js';
import { applyCanvasMoveScale, createCanvasImageComposerNode, createCanvasSuiteComposerNode, createCanvasTextNode, createUploadedImageNodes, resizeCanvasNode } from './canvasStudioModel.js';
import { findCanvasBlankPlacement } from './canvasInlineEditorModel.js';
import './EcCanvas.css';

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
  const sources = result.productAssets
    || result.product_assets
    || result.productImages
    || result.source_images
    || result.sourceImages
    || result.inputSnapshot?.productAssets
    || [];
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

const FOCUSED_OUTPUT_LABELS = Object.freeze({
  crop: '裁剪结果',
  'grid-split': '宫格切片',
  'split-image': '分割结果',
  annotation: '标注稿',
});

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
        cursor: 'grab', userSelect: 'none', borderRadius: 8,
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
      <div data-canvas-port-role="input" style={{ position: 'absolute', zIndex: 2, left: -7, top: node.h / 2, transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#fff', border: '2px solid #7c3aed', cursor: 'crosshair', opacity: selected ? 1 : 0, pointerEvents: selected ? 'auto' : 'none' }} onPointerDown={e => { e.stopPropagation(); onPortPointerDown?.(e, node.id, 'in'); }} onPointerUp={e => { e.stopPropagation(); onPortPointerUp?.(e, node.id, 'in'); }} />
      <div data-canvas-port-role="output" style={{ position: 'absolute', zIndex: 2, right: -7, top: node.h / 2, transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#7c3aed', border: '2px solid #fff', cursor: 'crosshair', opacity: selected ? 1 : 0, pointerEvents: selected ? 'auto' : 'none' }} onPointerDown={e => { e.stopPropagation(); onPortPointerDown?.(e, node.id, 'out'); }} onPointerUp={e => { e.stopPropagation(); onPortPointerUp?.(e, node.id, 'out'); }} />
      <div style={{ position: 'relative', width: '100%', borderRadius: '8px 8px 0 0', overflow: 'hidden', background: '#f5f5f5' }}>
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
          sizes={`${Math.ceil(node.w)}px`}
          ratio={node.ratio}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{ width: '100%', height: node.h, borderRadius: '8px 8px 0 0', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
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

function SourceGroupNode({ node, selected, dimmed, onPointerDown, onContextMenu, onPortPointerDown, onPortPointerUp, onInspect, onHoverChange }) {
  const previewAsset = node.assets?.find(asset => asset?.url);
  return <section data-canvas-node-id={node.id} onPointerDown={event => onPointerDown(event, node.id)} onDoubleClick={event => { event.stopPropagation(); if (previewAsset) onInspect?.({ ...node, url: previewAsset.url, label: previewAsset.name || node.name }); }} onContextMenu={event => { event.preventDefault(); onContextMenu?.(event, node); }} onMouseEnter={() => onHoverChange?.(node.id)} onMouseLeave={() => onHoverChange?.(null)} style={{ position: 'absolute', left: node.x, top: node.y, width: node.w, minHeight: node.h, boxSizing: 'border-box', padding: 13, border: selected ? '2px solid #2563eb' : '1px solid #d8dde5', borderRadius: 8, color: '#1f2937', background: '#fff', boxShadow: selected ? '0 0 0 2px rgba(37,99,235,.12), 0 4px 8px rgba(15,23,42,.12)' : '0 3px 8px rgba(15,23,42,.09)', cursor: 'grab', userSelect: 'none', opacity: dimmed ? 0.34 : 1, transition: 'opacity 0.16s, box-shadow 0.15s' }}>
    <CanvasPortHandle side="right" role="output" visible={selected} disabled={!canDeriveFromNode(node)} label="从产品素材派生工作流" onPointerDown={event => onPortPointerDown?.(event, node.id, 'out')} onPointerUp={event => onPortPointerUp?.(event, node.id, 'out')} />
    <div style={{ fontSize: 10, fontWeight: 800, color: '#6558e8', letterSpacing: '.05em' }}>产品素材组</div>
    <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name || '产品母图'}</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7, marginTop: 11 }}>
      {(node.assets || []).slice(0, 4).map((asset, index) => <ResponsiveImage key={asset.assetId || asset.id || index} src={asset.url} alt={asset.name || '产品素材'} variant="thumb" ratio="1:1" sizes="120px" style={{ width: '100%', borderRadius: 8, background: '#e8eaf2' }} imgStyle={{ objectFit: 'contain' }} />)}
      {!node.assets?.length && <div style={{ gridColumn: '1 / -1', padding: '15px 8px', borderRadius: 8, color: '#8a93a4', background: '#f0f2f8', fontSize: 11, textAlign: 'center' }}>未找到产品原图</div>}
    </div>
  </section>;
}

function CanvasTextNode({ node, selected, dimmed, onPointerDown, onChange, onContextMenu, onHoverChange, onPortPointerDown, onPortPointerUp }) {
  return <section
    data-canvas-node-id={node.id}
    onPointerDown={event => {
      if (event.target?.closest?.('textarea,input,button')) return;
      onPointerDown(event, node.id);
    }}
    onContextMenu={event => { event.preventDefault(); onContextMenu?.(event, node); }}
    onMouseEnter={() => onHoverChange?.(node.id)}
    onMouseLeave={() => onHoverChange?.(null)}
    className={`ec-canvas-text-node ${selected ? 'is-selected' : ''}`}
    style={{ left: node.x, top: node.y, width: node.w, minHeight: node.h, opacity: dimmed ? 0.34 : 1 }}
  >
    <CanvasPortHandle side="left" role="input" visible={selected} label="连接输入" onPointerUp={event => onPortPointerUp?.(event, node.id, 'in')} />
    <CanvasPortHandle side="right" role="output" visible={selected} label="从文本派生" onPointerDown={event => onPortPointerDown?.(event, node.id, 'out')} />
    <header>文本</header>
    <textarea
      data-canvas-control="true"
      value={node.text || ''}
      placeholder="输入标题、卖点或生成要求"
      onChange={event => onChange(node.id, event.target.value)}
    />
  </section>;
}

/* A6: 连线 SVG 层 */
function ConnectionLines({ connections, nodes, onRemove, focusNodeIds }) {
  if (!connections?.length) return null;
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const styles = {
    reference: { stroke: '#8b939e', dash: undefined },
    variant: { stroke: '#76808d', dash: '6 4' },
    merge: { stroke: '#59616c', dash: undefined },
    derived: { stroke: '#7f8792', dash: undefined },
  };
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
      {connections.map((conn, i) => {
        if (!isCanvasConnectionVisible(conn, nodes)) return null;
        const from = nodeMap.get(conn.fromNodeId || conn.from);
        const to = nodeMap.get(conn.toNodeId || conn.to);
        if (!from || !to) return null;
        const fromPort = getCanvasPortCenter(from, conn.fromPort || 'output');
        const toPort = getCanvasPortCenter(to, conn.toPort || 'input');
        const x1 = fromPort.x;
        const y1 = fromPort.y;
        const x2 = toPort.x;
        const y2 = toPort.y;
        const mx = (x1 + x2) / 2;
        const style = styles[conn.relation || conn.type] || styles.reference;
        const isFocused = !focusNodeIds || (focusNodeIds.has(from.id) && focusNodeIds.has(to.id));
        return (
          <g key={i}>
            <path data-canvas-edge-id={conn.id || `edge-${i}`} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke={style.stroke} strokeWidth={isFocused ? 2.8 : 2.1} fill="none" strokeDasharray={style.dash} opacity={isFocused ? 0.9 : 0.14} onDoubleClick={() => onRemove?.(conn)} style={{ cursor: 'pointer', pointerEvents: 'stroke', transition: 'opacity 0.16s, stroke-width 0.16s' }} />
            <circle cx={x2} cy={y2} r={4} fill={style.stroke} opacity={isFocused ? 0.9 : 0.14} />
          </g>
        );
      })}
    </svg>
  );
}

function ConnectionDraftLine({ draft, nodes }) {
  if (!draft?.sourceNodeId || !draft.pointer) return null;
  const source = nodes.find(node => node.id === draft.sourceNodeId);
  if (!source) return null;
  const sourcePort = getCanvasPortCenter(source, 'output');
  const x1 = sourcePort.x;
  const y1 = sourcePort.y;
  const x2 = draft.pointer.x;
  const y2 = draft.pointer.y;
  const mx = (x1 + x2) / 2;
  return (
    <svg aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 12 }}>
      <path d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke="#7f8792" strokeWidth="2.5" strokeDasharray="7 5" fill="none" />
      <circle cx={x2} cy={y2} r="5" fill="#7f8792" />
    </svg>
  );
}

function readCanvasImageFiles(files = [], startedAt = Date.now()) {
  return Promise.all(files.map((file, index) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      const image = new Image();
      const asset = {
        assetId: `upload-${startedAt}-${index}`,
        name: file.name || `图片 ${index + 1}`,
        url,
      };
      image.onload = () => resolve({ ...asset, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve(asset);
      image.src = url;
    };
    reader.onerror = () => reject(new Error('图片读取失败'));
    reader.readAsDataURL(file);
  })));
}

async function persistCanvasUploadAssets(assets = []) {
  const urls = await uploadECTempImages(assets.map(asset => asset.url));
  if (urls.length !== assets.length || urls.some(url => !url)) {
    throw new Error('图片上传失败，请重试');
  }
  return assets.map((asset, index) => ({
    ...asset,
    url: urls[index],
    previewUrl: urls[index],
  }));
}

function loadMergeImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('合并图层时有图片加载失败'));
    image.src = proxyImg(url);
  });
}

async function renderMergedCanvasImage(selectedNodes = []) {
  const ids = new Set(selectedNodes.map(node => node.id));
  const bounds = selectedCanvasBounds(selectedNodes, ids);
  if (!bounds || selectedNodes.length < 2) throw new Error('请至少选择两张图片');
  const outputScale = Math.min(1, 2048 / Math.max(1, bounds.w), 2048 / Math.max(1, bounds.h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bounds.w * outputScale));
  canvas.height = Math.max(1, Math.round(bounds.h * outputScale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器无法合并图层');
  context.scale(outputScale, outputScale);
  for (const node of selectedNodes) {
    const image = await loadMergeImage(node.url);
    const frameWidth = Math.max(1, Number(node.w) || image.naturalWidth);
    const frameHeight = Math.max(1, Number(node.h) || image.naturalHeight);
    const fit = Math.min(frameWidth / image.naturalWidth, frameHeight / image.naturalHeight);
    const drawWidth = image.naturalWidth * fit;
    const drawHeight = image.naturalHeight * fit;
    const drawX = Number(node.x) - bounds.x + (frameWidth - drawWidth) / 2;
    const drawY = Number(node.y) - bounds.y + (frameHeight - drawHeight) / 2;
    context.save();
    context.translate(drawX + drawWidth / 2, drawY + drawHeight / 2);
    context.scale(node.flipX ? -1 : 1, node.flipY ? -1 : 1);
    context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    context.restore();
  }
  return { dataUrl: canvas.toDataURL('image/png'), bounds };
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
  const [activeTool, setActiveTool] = useState('select');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
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
  const [promptLoading, setPromptLoading] = useState(false);
  const [textComposerNodeId, setTextComposerNodeId] = useState(null);
  const [textComposerValue, setTextComposerValue] = useState('');
  const [editingTextNodeId, setEditingTextNodeId] = useState(null);
  const [focusedEditor, setFocusedEditor] = useState(null);
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
  const objectClipboardRef = useRef(null);
  const canvasSessionRef = useRef(null);
  const remoteSaveTimerRef = useRef(null);
  const remoteSnapshotRef = useRef('');
  const imageList = parseImages(canvasOutputImages(result), result.platform || '淘宝');
  const hasCurrent = imageList.length > 0;
  const visibleNodes = activeFilter === '全部' ? nodes : nodes.filter(node => node.group === activeFilter);
  const selectedNode = selected ? nodes.find(node => node.id === selected) : null;
  const multiSelectionBounds = selectedCanvasBounds(nodes, multiSelected);
  const focusedEditorNode = focusedEditor ? nodes.find(node => node.id === focusedEditor.nodeId) : null;
  const textComposerNode = textComposerNodeId ? nodes.find(node => node.id === textComposerNodeId) : null;
  const textInspectorNode = textInspectorNodeId ? nodes.find(node => node.id === textInspectorNodeId) : null;
  const connectionNodes = nodes;
  const focusedNodeIds = hoveredNodeId ? getCanvasFocusIds(hoveredNodeId, connections) : null;

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
    canvasSaveKeyRef.current = result.browserQa ? null : draftKey;
    const draft = result.browserQa ? null : loadCanvasDraft(draftKey);
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
      const next = initialSnapshot?.viewport || readableInitialViewport(newNodes, containerRef.current?.getBoundingClientRect());
      if (next) setViewport(next);
      draftReadyRef.current = true;
    });
    return () => { cancelled = true; };
  }, [result.id, result._saveKey, result.taskId, result.product_name, result.canvasImportId, result.browserQa, imageList.length]);

  useEffect(() => {
    if (!draftReadyRef.current || !canvasSaveKeyRef.current || pointerMode?.kind === 'drag') return undefined;
    const snapshot = createCanvasSnapshot({ nodes, connections, viewport });
    const timer = setTimeout(() => saveCanvasDraft(canvasSaveKeyRef.current, snapshot), 350);
    return () => clearTimeout(timer);
  }, [connections, nodes, pointerMode?.kind, viewport]);

  useEffect(() => {
    canvasSessionRef.current = canvasSession;
  }, [canvasSession]);

  useEffect(() => {
    if (!draftReadyRef.current || canvasSessionBusy || pointerMode?.kind === 'drag') return undefined;
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
  }, [canvasSessionBusy, connections, dispatch, nodes, phone, pointerMode?.kind, result, viewport]);

  useEffect(() => {
    cleanupLegacyCanvasStorage(localStorage);
  }, []);

  useEffect(() => {
    if (!editingTextNodeId) return undefined;
    const frame = requestAnimationFrame(() => {
      containerRef.current
        ?.querySelector(`[data-canvas-node-id="${editingTextNodeId}"] [contenteditable="true"]`)
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [editingTextNodeId]);

  const handleLayerSelect = useCallback(nodeId => {
    setNodes(previous => previous.map(node => node.id === nodeId && node.hidden
      ? { ...node, hidden: false }
      : node));
    setSelected(nodeId);
    setMultiSelected(new Set([nodeId]));
  }, []);

  const handleLayerVisibilityToggle = useCallback(nodeId => {
    setNodes(previous => previous.map(node => node.id === nodeId ? { ...node, hidden: !node.hidden } : node));
    setSelected(current => current === nodeId ? null : current);
    setMultiSelected(previous => {
      if (!previous.has(nodeId)) return previous;
      const next = new Set(previous);
      next.delete(nodeId);
      return next;
    });
  }, []);

  const handleLayerLockToggle = useCallback(nodeId => {
    setNodes(previous => previous.map(node => node.id === nodeId ? { ...node, locked: !node.locked } : node));
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
    if (!interactiveTarget && editingTextNodeId) setEditingTextNodeId(null);
    const intent = getCanvasPointerIntent({
      button: e.button,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      spaceKey: spacePressed || activeTool === 'hand',
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
      setContextMenu(null);
      setAddMenuOpen(false);
    }
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
  }, [activeTool, editingTextNodeId, spacePressed, toWorldPoint, viewport.x, viewport.y]);

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
    if (pointerMode.kind === 'resize') {
      const dx = (e.clientX - pointerMode.startX) / Math.max(0.01, viewport.scale);
      const width = pointerMode.corner.includes('w')
        ? pointerMode.original.w - dx
        : pointerMode.original.w + dx;
      const resized = resizeCanvasNode(pointerMode.original, { width });
      if (pointerMode.corner.includes('w')) resized.x = pointerMode.original.x + pointerMode.original.w - resized.w;
      if (pointerMode.corner.includes('n')) resized.y = pointerMode.original.y + pointerMode.original.h - resized.h;
      setNodes(previous => previous.map(node => node.id === pointerMode.nodeId ? resized : node));
      return;
    }
    if (pointerMode.kind === 'drag') {
      const point = toWorldPoint(e);
      pendingDragRef.current = { ids: pointerMode.ids, start: pointerMode.start, point };
      if (!dragFrameRef.current) dragFrameRef.current = requestAnimationFrame(flushDragFrame);
    }
  }, [flushDragFrame, pointerMode, toWorldPoint, viewport.scale]);

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
    const rawMessage = String(error?.message || '');
    const isUpstreamCredentialError = /(?:401|403|authentication|api\s*key|invalid[_\s-]*(?:key|token)|credential)/i.test(rawMessage);
    showToast(isUpstreamCredentialError ? 'AI 服务暂时不可用，请稍后重试' : (rawMessage || '处理失败，请重试'), 'error');
    return false;
  }, [dispatch, result.product_name, showToast, state.phone]);

  useEffect(() => bindNonPassiveWheel(containerRef.current, handleWheel), [handleWheel, tab]);

  // 节点点击：Ctrl/Cmd 切换多选，拖动已选节点会批量移动
  const handleNodeDown = useCallback((e, id) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setContextMenu(null);
    setConnectionPicker(null);
    setAddMenuOpen(false);
    if (activeTool === 'hand') {
      setPointerMode({ kind: 'pan', startX: e.clientX, startY: e.clientY, vpX: viewport.x, vpY: viewport.y });
      return;
    }
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      setMultiSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
      return next;
      });
      setSelected(null);
      return;
    }
    const baseIds = multiSelected.has(id) ? multiSelected : new Set([id]);
    const ids = expandCanvasDragSelection(nodes, id, baseIds);
    setSelected(ids.size === 1 ? id : null);
    setMultiSelected(ids);
    setPointerMode({ kind: 'drag', ids, start: toWorldPoint(e) });
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
  }, [activeTool, multiSelected, nodes, toWorldPoint, viewport.x, viewport.y]);

  const handleNodeResizeStart = useCallback((event, nodeId, corner) => {
    const node = nodes.find(candidate => candidate.id === nodeId);
    if (!node || node.locked || event.button !== 0) return;
    setSelected(nodeId);
    setMultiSelected(new Set([nodeId]));
    setPointerMode({
      kind: 'resize',
      nodeId,
      corner,
      startX: event.clientX,
      original: { ...node },
    });
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch {}
  }, [nodes]);

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
        x: node.x + node.w + GAP * 2 + index * (source.w + GAP),
        y: node.y,
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
        await handleToolAction('reverse-prompt', node);
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
    if (handler === 'edit-text') {
      setTextInspectorNodeId(node.id);
      setTextCompositionError('');
      return;
    }
    if (['crop', 'annotation', 'grid-split', 'split-image', 'move-scale'].includes(handler)) {
      setFocusedEditor({
        mode: handler,
        nodeId: node.id,
        options: handler === 'crop'
          ? { ratio: '原比例', cropRect: { x: 0, y: 0, w: 1, h: 1 } }
          : handler === 'grid-split' ? { grid: 3 }
            : handler === 'split-image' ? { direction: 'vertical', splitPosition: 0.5 }
              : handler === 'annotation' ? {
                annotationTool: 'pen',
                annotationColor: '#ef4444',
                annotationWidth: 3,
                annotation: '',
                annotations: [],
                annotationHistory: [],
                annotationFuture: [],
              }
              : {},
      });
      return;
    }
    if (handler.startsWith('create:')) {
      if (actionSpec) handleCreateDerivedNode(node.id, actionSpec, { x: node.x + node.w + GAP * 2, y: node.y });
      return;
    }
    if (handler === 'copy-url') {
      navigator.clipboard?.writeText(node.url);
      showToast('图片链接已复制', 'success');
      return;
    }
    if (handler === 'copy') {
      objectClipboardRef.current = { ...node };
      showToast('对象已复制', 'success');
      return;
    }
    if (handler === 'paste' && !objectClipboardRef.current) {
      showToast('剪贴板中还没有画布对象', 'info');
      return;
    }
    if (handler === 'paste' || handler === 'duplicate') {
      const source = handler === 'paste' && objectClipboardRef.current ? objectClipboardRef.current : node;
      const duplicateId = `${node.kind || 'node'}_${Date.now()}`;
      const duplicate = normalizeCanvasNode({
        ...source,
        id: duplicateId,
        assetId: source.assetId ? `asset_${duplicateId}` : source.assetId,
        name: source.name ? `${source.name} 副本` : source.name,
        displayLabel: source.displayLabel ? `${source.displayLabel} 副本` : source.displayLabel,
        x: node.x + 36,
        y: node.y + 36,
      });
      setNodes(previous => [...previous, duplicate]);
      setSelected(duplicate.id);
      setMultiSelected(new Set([duplicate.id]));
      showToast('已复制到画布', 'success');
      return;
    }
    if (['bring-forward', 'send-backward', 'bring-front', 'send-back'].includes(handler)) {
      setNodes(previous => {
        const index = previous.findIndex(item => item.id === node.id);
        if (index < 0) return previous;
        const next = [...previous];
        const [item] = next.splice(index, 1);
        const target = handler === 'bring-front' ? next.length
          : handler === 'send-back' ? 0
            : handler === 'bring-forward' ? Math.min(next.length, index + 1)
              : Math.max(0, index - 1);
        next.splice(target, 0, item);
        return next;
      });
      return;
    }
    if (handler === 'toggle-visibility' || handler === 'toggle-lock' || handler === 'flip-horizontal' || handler === 'flip-vertical') {
      setNodes(previous => previous.map(item => item.id === node.id ? {
        ...item,
        ...(handler === 'toggle-visibility' ? { hidden: !item.hidden } : {}),
        ...(handler === 'toggle-lock' ? { locked: !item.locked } : {}),
        ...(handler === 'flip-horizontal' ? { flipX: !item.flipX } : {}),
        ...(handler === 'flip-vertical' ? { flipY: !item.flipY } : {}),
      } : item));
      if (handler === 'toggle-visibility' && !node.hidden) {
        setSelected(current => current === node.id ? null : current);
        setMultiSelected(previous => {
          if (!previous.has(node.id)) return previous;
          const next = new Set(previous);
          next.delete(node.id);
          return next;
        });
      }
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
      addCanvasComposer('image', {
        sourceNodeId: node.id,
        prompt: [node.direction?.purpose, node.direction?.composition, node.direction?.copy]
          .filter(Boolean).join('\n') || '保留商品主体与品牌信息，调整画面表达：',
      });
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
    if (handler === 'reverse-prompt') {
      const textNode = createCanvasTextNode({ x: node.x + node.w + 56, y: node.y, sourceNodeId: node.id });
      textNode.status = 'processing';
      textNode.text = '正在分析画面内容...';
      setNodes(previous => [...previous, textNode]);
      setConnections(previous => addConnection(previous, node.id, textNode.id, 'derived'));
      setSelected(textNode.id);
      setMultiSelected(new Set([textNode.id]));
      try {
        const data = await reversePrompt({ image_url: node.url, product_name: node.name || node.displayLabel || node.label });
        if (!data.prompt) throw new Error('未得到可编辑的提示词');
        setNodes(previous => previous.map(item => item.id === textNode.id ? { ...item, status: 'ready', text: data.prompt, name: '画面提示词' } : item));
      } catch (error) {
        setNodes(previous => previous.map(item => item.id === textNode.id ? { ...item, status: 'error', text: '画面分析暂时不可用，请稍后重试' } : item));
        handleCanvasActionError(error, { type: 'reverse-prompt', nodeId: node.id });
      }
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
        showToast('图层分析暂时不可用，请稍后重试', 'error');
      } finally {
        setPromptLoading(false);
      }
      return;
    }
    if (handler === 'add-reference') {
      addCanvasComposer('image', { sourceNodeId: node.id });
      showToast('已创建图片生成节点，可继续添加参考图', 'success');
      return;
    }
    const prompts = {
      translate: '把画面中的文案翻译成目标语言，保持字体层级、版式和商品主体不变：',
      upscale: '输出一张高清电商交付图，提升细节和清晰度，不改变商品外观：',
    };
    if (prompts[actionId]) {
      addCanvasComposer('image', { sourceNodeId: node.id, prompt: prompts[actionId], actionId });
      showToast(`已进入${actionSpec?.label || '图片编辑'}流程`, 'info');
    }
  };

  const handleFocusedEditorConfirm = async () => {
    if (!focusedEditor) return;
    const source = nodes.find(node => node.id === focusedEditor.nodeId);
    if (!source) {
      setFocusedEditor(null);
      return;
    }
    if (focusedEditor.mode === 'move-scale') {
      const options = focusedEditor.options || {};
      setNodes(previous => previous.map(node => node.id === source.id
        ? applyCanvasMoveScale(node, options)
        : node));
      setFocusedEditor(null);
      showToast('位置与尺寸已更新', 'success');
      return;
    }
    setPromptLoading(true);
    try {
      const options = focusedEditor.options || {};
      const action = focusedEditor.mode === 'split-image' ? 'split-image' : focusedEditor.mode;
      const response = await transformCanvasImage({
        action,
        imageUrl: source.url,
        ratio: options.ratio === '原比例' ? source.ratio : options.ratio,
        grid: options.grid,
        direction: options.direction,
        annotation: options.annotation,
        annotations: options.annotations,
        cropRect: options.cropRect,
        splitPosition: options.splitPosition,
      });
      const urls = [response?.url, ...(response?.urls || []).map(item => typeof item === 'string' ? item : item?.url)].filter(Boolean);
      if (!urls.length) throw new Error('图片处理没有返回结果');
      const createdAt = Date.now();
      const occupied = [...nodes];
      const bounds = containerRef.current?.getBoundingClientRect();
      const children = urls.map((url, index) => {
        const position = findCanvasBlankPlacement({
          width: source.w,
          height: source.h,
          viewport,
          bounds,
          nodes: occupied,
          sourceNode: index === 0 ? source : occupied.at(-1),
          gap: 28,
        });
        const child = normalizeCanvasNode({
          ...source,
          id: `node_${action}_${createdAt}_${index + 1}`,
          assetId: `asset_${action}_${createdAt}_${index + 1}`,
          kind: 'image',
          status: 'ready',
          url,
          ...position,
          ratio: options.ratio && options.ratio !== '原比例' ? options.ratio : source.ratio,
          name: `${source.name || '图片'}-${FOCUSED_OUTPUT_LABELS[action] || '处理结果'}${urls.length > 1 ? index + 1 : ''}`,
          displayLabel: `${source.name || '图片'}-${FOCUSED_OUTPUT_LABELS[action] || '处理结果'}${urls.length > 1 ? index + 1 : ''}`,
          sourceNodeIds: [source.id],
          showMeta: true,
        });
        occupied.push(child);
        return child;
      });
      setNodes(previous => [...previous, ...children]);
      setConnections(previous => children.reduce((current, child) => addConnection(current, source.id, child.id, action), previous));
      setSelected(children[0].id);
      setMultiSelected(new Set(children.map(child => child.id)));
      setFocusedEditor(null);
      showToast(`已生成 ${children.length} 个可独立编辑的结果`, 'success');
    } catch (error) {
      handleCanvasActionError(error, { type: focusedEditor.mode, nodeId: source.id });
    } finally {
      setPromptLoading(false);
    }
  };

  const handleMultiSelectionAction = async actionId => {
    if (['align-left', 'align-center', 'align-right', 'auto-layout'].includes(actionId)) {
      setNodes(previous => applyMultiSelectionAction(previous, multiSelected, actionId));
      showToast('已更新所选对象排版', 'success');
      return;
    }
    if (actionId === 'delete-selection') {
      setNodes(previous => previous.filter(node => !multiSelected.has(node.id)));
      setConnections(previous => removeConnectionsForNodes(previous, multiSelected));
      setMultiSelected(new Set());
      setSelected(null);
      return;
    }
    if (actionId === 'export-selection') {
      setExportOpen(true);
      return;
    }
    if (actionId === 'merge-layers') {
      const selectedNodes = nodes.filter(node => multiSelected.has(node.id) && node.url && ['image', 'output'].includes(node.kind));
      if (selectedNodes.length !== multiSelected.size || selectedNodes.length < 2) {
        showToast('合并图层仅支持两张或以上图片', 'info');
        return;
      }
      setPromptLoading(true);
      try {
        const { dataUrl, bounds } = await renderMergedCanvasImage(selectedNodes);
        const [url] = await uploadECTempImages([dataUrl]);
        if (!url) throw new Error('合并图层上传失败');
        const createdAt = Date.now();
        const merged = normalizeCanvasNode({
          id: `node_merged_${createdAt}`,
          kind: 'image',
          status: 'ready',
          url,
          x: bounds.x,
          y: bounds.y,
          w: bounds.w,
          h: bounds.h,
          ratio: bounds.w === bounds.h ? '1:1' : `${Math.round(bounds.w)}:${Math.round(bounds.h)}`,
          name: '合并图层',
          displayLabel: '合并图层',
          group: selectedNodes[0].group || '素材',
          sourceNodeIds: selectedNodes.map(node => node.id),
          showMeta: true,
        });
        setNodes(previous => [...previous, merged]);
        setConnections(previous => selectedNodes.reduce((current, source) => addConnection(current, source.id, merged.id, 'merge'), previous));
        setSelected(merged.id);
        setMultiSelected(new Set([merged.id]));
        showToast('已生成合并图层，原对象仍然保留', 'success');
      } catch (error) {
        showToast(error.message || '合并图层失败', 'error');
      } finally {
        setPromptLoading(false);
      }
      return;
    }
    if (actionId === 'bind-elements' || actionId === 'group-elements') {
      const groupId = `group_${Date.now()}`;
      setNodes(previous => previous.map(node => multiSelected.has(node.id) ? { ...node, groupId, bound: actionId === 'bind-elements' } : node));
      showToast(actionId === 'bind-elements' ? '所选对象已绑定' : '所选对象已打组', 'success');
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
    const exportNodes = nodes.filter(node => node.url && (multiSelected.size ? multiSelected.has(node.id) : true));
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

  const handleNew = () => {
    dispatch({ type: 'SET_MODE', mode: 'ecommerce' });
    dispatch({ type: 'NAVIGATE', page: 'home' });
  };

  const createComposerPlacement = useCallback((width, height, placement = {}) => {
    const source = placement.sourceNodeId ? nodes.find(node => node.id === placement.sourceNodeId) : selectedNode;
    const bounds = containerRef.current?.getBoundingClientRect();
    return findCanvasBlankPlacement({
      width,
      height,
      viewport,
      bounds,
      nodes,
      sourceNode: source,
      preferred: Number.isFinite(placement.x) && Number.isFinite(placement.y)
        ? { x: placement.x, y: placement.y }
        : undefined,
      gap: 32,
    });
  }, [nodes, selectedNode, viewport]);

  const addCanvasComposer = useCallback((kind, placement = {}) => {
    const sourceNodeId = placement.sourceNodeId || selectedNode?.id || '';
    const sourceNodeIds = [...new Set([...(placement.sourceNodeIds || []), sourceNodeId].filter(Boolean))];
    const size = kind === 'suite' ? { w: 560, h: 356 } : { w: 520, h: 278 };
    const position = createComposerPlacement(size.w, size.h, { ...placement, sourceNodeId });
    const baseComposer = kind === 'suite'
      ? createCanvasSuiteComposerNode({ ...position, sourceNodeId, platform: result.platform || '淘宝' })
      : createCanvasImageComposerNode({ ...position, sourceNodeId });
    const composer = {
      ...baseComposer,
      sourceNodeIds,
      ...(placement.prompt ? { prompt: placement.prompt } : {}),
      ...(placement.actionId ? { actionId: placement.actionId } : {}),
    };
    setNodes(previous => [...previous, composer]);
    if (sourceNodeIds.length) {
      setConnections(previous => sourceNodeIds.reduce((edges, id) => addConnection(edges, id, composer.id, 'derived'), previous));
    }
    setSelected(composer.id);
    setMultiSelected(new Set([composer.id]));
    setActiveTool('select');
    return composer;
  }, [createComposerPlacement, result.platform, selectedNode?.id]);

  const updateComposerNode = useCallback((nodeId, change) => {
    setNodes(previous => previous.map(node => node.id === nodeId ? { ...node, ...change } : node));
  }, []);

  const removeCanvasNode = useCallback(nodeId => {
    const ids = new Set([nodeId]);
    setNodes(previous => previous.filter(node => node.id !== nodeId));
    setConnections(previous => removeConnectionsForNodes(previous, ids));
    setSelected(previous => previous === nodeId ? null : previous);
    setMultiSelected(previous => {
      const next = new Set(previous);
      next.delete(nodeId);
      return next;
    });
  }, []);

  const handleImageComposerGenerate = useCallback(async composer => {
    if (!composer?.prompt?.trim() || composer.status === 'processing') return;
    const sourceNodes = (composer.sourceNodeIds || []).map(id => nodes.find(node => node.id === id)).filter(node => node?.url);
    updateComposerNode(composer.id, { status: 'processing', error: '' });
    try {
      const count = Math.max(1, Math.min(4, Number(composer.count) || 1));
      const urls = await Promise.all(Array.from({ length: count }, async () => {
        if (composer.actionId && sourceNodes.length) {
          const response = await transformCanvasImage({
            action: composer.actionId,
            prompt: composer.prompt.trim(),
            imageUrl: sourceNodes[0].url,
            ratio: composer.ratio || sourceNodes[0].ratio || '1:1',
          });
          const url = response?.url || response?.result_url;
          if (!url) throw new Error('图片处理没有返回结果');
          return url;
        }
        return sourceNodes.length
          ? regenerateCanvasImage({
            prompt: composer.prompt.trim(),
            imageUrl: sourceNodes[0].url,
            referenceImages: sourceNodes.slice(1).map(node => node.url),
            ratio: composer.ratio || '1:1',
          })
          : regenerateImage(composer.prompt.trim(), result.category || '电商图片');
      }));
      const createdAt = Date.now();
      const ratio = composer.ratio || '1:1';
      const ratioNumber = ratio === '3:4' ? 3 / 4 : ratio === '4:3' ? 4 / 3 : ratio === '9:16' ? 9 / 16 : 1;
      const outputs = urls.map((url, index) => normalizeCanvasNode({
        id: `image_generated_${createdAt}_${index + 1}`,
        assetId: `asset_generated_${createdAt}_${index + 1}`,
        kind: 'image',
        status: 'ready',
        url,
        name: `图片生成结果${count > 1 ? ` ${index + 1}` : ''}`,
        displayLabel: `图片生成结果${count > 1 ? ` ${index + 1}` : ''}`,
        group: '素材',
        role: '创作图片',
        ratio,
        sourceNodeIds: [composer.id],
        x: composer.x + composer.w + 56 + index * 268,
        y: composer.y,
        w: 230,
        h: Math.round(230 / ratioNumber),
        showMeta: true,
      }));
      setNodes(previous => previous.map(node => node.id === composer.id ? { ...node, status: 'success', outputNodeIds: outputs.map(output => output.id) } : node).concat(outputs));
      setConnections(previous => outputs.reduce((edges, output) => addConnection(edges, composer.id, output.id, 'generated'), previous));
      setSelected(outputs[0]?.id || composer.id);
      setMultiSelected(new Set(outputs.map(output => output.id)));
      showToast(`已生成 ${outputs.length} 张图片`, 'success');
    } catch (error) {
      updateComposerNode(composer.id, { status: 'error', error: error.message || '图片生成失败' });
      handleCanvasActionError(error, { type: 'image-generation', nodeId: composer.id });
    }
  }, [handleCanvasActionError, nodes, result.category, showToast, updateComposerNode]);

  const handleSuiteComposerGenerate = useCallback(async composer => {
    if (!composer || composer.status === 'processing') return;
    const sourceNodes = (composer.sourceNodeIds || []).map(id => nodes.find(node => node.id === id)).filter(node => node?.url);
    if (!sourceNodes.length) {
      showToast('请先连接或选中一张清晰商品图', 'info');
      return;
    }
    updateComposerNode(composer.id, { status: 'processing', error: '', generatedCount: 0 });
    const desiredCount = Math.max(3, Math.min(12, Number(composer.count) || 6));
    const mainCount = Math.min(3, Math.max(1, Math.floor((desiredCount - 1) / 2)));
    const detailCount = Math.max(1, desiredCount - 1 - mainCount);
    const rowCounters = new Map();
    const receivedUrls = new Set();
    const roleRows = { 白底图: 0, 主图: 1, 详情图: 2, SKU: 3, 素材: 4 };
    try {
      await generateEcommerceSuite({
        productImages: sourceNodes.map(node => ({ assetId: node.assetId, url: node.url, previewUrl: node.url, role: 'product' })),
        referenceImages: [],
        sceneStyle: composer.prompt?.trim() || result.product_name || '专业电商视觉',
        platform: composer.platform || result.platform || '淘宝',
        batchPlan: { imageSelections: [
          { key: 'white_bg', count: 1 },
          { key: 'main_text', count: mainCount },
          { key: 'detail_slice_feature', count: detailCount },
        ] },
        email: phone,
        onProgress: progress => updateComposerNode(composer.id, { progress: progress?.progress || progress?.percent || 0, progressLabel: progress?.message || progress?.label || '正在生成套图' }),
        onImage: image => {
          const url = image?.stableUrl || image?.url;
          if (!url || receivedUrls.has(url)) return;
          receivedUrls.add(url);
          const role = image.role || image.id || image.key || 'main_text';
          const meta = getAssetMeta(role);
          const group = image.group || meta.group || '素材';
          const column = rowCounters.get(group) || 0;
          rowCounters.set(group, column + 1);
          const ratio = image.ratio || meta.ratio || composer.ratio || '1:1';
          const ratioNumber = ratio === '3:4' ? 3 / 4 : ratio === '4:3' ? 4 / 3 : ratio === '9:16' ? 9 / 16 : 1;
          const output = normalizeCanvasNode({
            id: `suite_output_${composer.id}_${Date.now()}_${column}`,
            assetId: image.assetId || image.id || `suite_asset_${Date.now()}_${column}`,
            kind: 'output',
            status: 'ready',
            url,
            name: image.displayName || image.label || meta.name || '电商图',
            displayLabel: image.displayName || image.label || meta.name || '电商图',
            group,
            role,
            ratio,
            size: image.size || '',
            sourceNodeIds: [composer.id],
            x: composer.x + composer.w + 80 + column * 268,
            y: composer.y + (roleRows[group] ?? 4) * 390,
            w: 230,
            h: Math.round(230 / ratioNumber),
            showMeta: true,
          });
          setNodes(previous => previous.some(node => node.url === url) ? previous : [...previous, output]);
          setConnections(previous => addConnection(previous, composer.id, output.id, 'suite-output'));
          updateComposerNode(composer.id, { generatedCount: receivedUrls.size });
        },
      });
      updateComposerNode(composer.id, { status: 'success', progress: 100, progressLabel: `已完成 ${receivedUrls.size} 张` });
      showToast(`电商套图已完成 ${receivedUrls.size} 张`, 'success');
    } catch (error) {
      updateComposerNode(composer.id, { status: 'error', error: error.message || '套图生成失败' });
      handleCanvasActionError(error, { type: 'ecommerce-suite', nodeId: composer.id });
    }
  }, [handleCanvasActionError, nodes, phone, result.platform, result.product_name, showToast, updateComposerNode]);

  const handleAddTextNode = useCallback((placement = {}) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    const width = 420;
    const height = 180;
    const source = placement?.sourceNodeId ? nodes.find(node => node.id === placement.sourceNodeId) : undefined;
    const position = findCanvasBlankPlacement({
      width,
      height,
      viewport,
      bounds,
      nodes,
      sourceNode: source,
      preferred: Number.isFinite(placement?.x) && Number.isFinite(placement?.y)
        ? { x: placement.x, y: placement.y }
        : undefined,
      gap: 32,
    });
    const textNode = createCanvasTextNode({
      ...position,
      sourceNodeId: placement?.sourceNodeId,
    });
    setNodes(previous => [...previous, textNode]);
    setSelected(textNode.id);
    setMultiSelected(new Set([textNode.id]));
    if (placement?.openComposer) {
      setTextComposerNodeId(textNode.id);
      setTextComposerValue('');
    } else {
      setEditingTextNodeId(textNode.id);
    }
    if (placement?.sourceNodeId) {
      setConnections(previous => addConnection(previous, placement.sourceNodeId, textNode.id, 'derived'));
    }
    setActiveTool('select');
    return textNode;
  }, [nodes, viewport]);

  const handleTextNodeChange = useCallback((nodeId, text) => {
    setNodes(previous => previous.map(node => node.id === nodeId ? { ...node, text, name: text.trim().split(/\r?\n/)[0]?.slice(0, 32) || '文本' } : node));
  }, []);
  const handleTextComposerSubmit = useCallback(async () => {
    if (!textComposerNodeId || !textComposerValue.trim() || promptLoading) return;
    setPromptLoading(true);
    try {
      const response = await regenerateText(textComposerValue.trim(), result.category || result.product_name || '电商文案');
      const text = String(response?.text || response?.content || response?.result || textComposerValue).trim();
      handleTextNodeChange(textComposerNodeId, text);
      setTextComposerValue('');
      showToast('文案已生成，可直接编辑和拖动', 'success');
    } catch (error) {
      handleCanvasActionError(error, { type: 'text-generation', nodeId: textComposerNodeId });
    } finally {
      setPromptLoading(false);
    }
  }, [handleTextNodeChange, promptLoading, result.category, result.product_name, showToast, textComposerNodeId, textComposerValue]);
  const handleCanvasSourceUpload = async event => {
    const files = [...(event.target?.files || [])].filter(file => file.type.startsWith('image/')).slice(0, 8);
    event.target.value = '';
    if (!files.length) return;
    const uploadStartedAt = Date.now();
    setPromptLoading(true);
    try {
      const assets = await readCanvasImageFiles(files, uploadStartedAt);
      const persistedAssets = await persistCanvasUploadAssets(assets);
      const bounds = containerRef.current?.getBoundingClientRect();
      const worldX = ((bounds?.width || 960) * 0.4 - viewport.x) / viewport.scale;
      const worldY = ((bounds?.height || 640) * 0.35 - viewport.y) / viewport.scale;
      const uploadedNodes = createUploadedImageNodes({ assets: persistedAssets, x: worldX, y: worldY, now: uploadStartedAt });
      draftReadyRef.current = true;
      canvasSaveKeyRef.current ||= canvasDraftKey({ ...result, canvasImportId: `upload-${uploadStartedAt}` });
      setNodes(previous => [...previous, ...uploadedNodes]);
      setSelected(uploadedNodes[0]?.id || null);
      setMultiSelected(new Set(uploadedNodes.map(node => node.id)));
      showToast(`已加入 ${uploadedNodes.length} 张图片，可直接拖动、编辑或继续生成`, 'success');
    } catch (error) {
      showToast(error.message || '图片上传失败，请重试', 'error');
    } finally {
      setPromptLoading(false);
    }
  };

  const handleComposerSourceUpload = useCallback(async (composerId, files = []) => {
    const accepted = files.filter(file => file?.type?.startsWith('image/')).slice(0, 6);
    const composer = nodes.find(node => node.id === composerId && ['image-composer', 'suite-composer'].includes(node.kind));
    if (!accepted.length || !composer) return;
    const uploadStartedAt = Date.now();
    try {
      const assets = await readCanvasImageFiles(accepted, uploadStartedAt);
      const persistedAssets = await persistCanvasUploadAssets(assets);
      const uploadedNodes = createUploadedImageNodes({
        assets: persistedAssets,
        x: composer.x - persistedAssets.length * 278 - 36,
        y: composer.y,
        now: uploadStartedAt,
      });
      const uploadedIds = uploadedNodes.map(node => node.id);
      draftReadyRef.current = true;
      canvasSaveKeyRef.current ||= canvasDraftKey({ ...result, canvasImportId: `upload-${uploadStartedAt}` });
      setNodes(previous => previous
        .map(node => node.id === composerId
          ? { ...node, sourceNodeIds: [...new Set([...(node.sourceNodeIds || []), ...uploadedIds])] }
          : node)
        .concat(uploadedNodes));
      setConnections(previous => uploadedIds.reduce((edges, id) => addConnection(edges, id, composerId, 'derived'), previous));
      setSelected(composerId);
      setMultiSelected(new Set([composerId]));
      showToast(`已连接 ${uploadedNodes.length} 张参考图`, 'success');
    } catch (error) {
      showToast(error.message || '参考图读取失败', 'error');
    }
  }, [nodes, result, showToast]);

  const removeComposerSource = useCallback((composerId, sourceId) => {
    setNodes(previous => previous.map(node => node.id === composerId
      ? { ...node, sourceNodeIds: (node.sourceNodeIds || []).filter(id => id !== sourceId) }
      : node));
    setConnections(previous => previous.filter(edge => !(edge.from === sourceId && edge.to === composerId)));
  }, []);
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
    const updatedNode = { ...directionDraft, direction, ratio: direction.ratio };
    setNodes(prev => prev.map(node => node.id === directionDraft.id ? updatedNode : node));
    setDirectionDraft(null);
    addCanvasComposer('image', {
      sourceNodeId: updatedNode.id,
      prompt: [direction.purpose, direction.composition, direction.copy].filter(Boolean).join('\n'),
    });
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
  const portCreationActions = CANVAS_CREATION_OPTIONS.map(option => {
    const imageAction = option.id === 'image-edit' ? getCanvasAction('product-remix') : null;
    return {
      ...(imageAction || {}),
      ...option,
      group: '继续创作',
      priceLabel: imageAction?.priceLabel || '免费',
    };
  });

  return (
    <div className="ec-canvas-page">
      <CanvasTopBar
        title={tab === 'canvas' ? (result.product_name || '电商画布') : tab === 'trash' ? '回收站' : '我的作品集'}
        meta={tab === 'canvas' ? `${nodes.length} 个资产${multiSelected.size ? ` · ${multiSelected.size} 已选中` : ''}` : `${tab === 'trash' ? trashWorks.length : pastWorks.length} 个作品`}
        tab={tab}
        onTabChange={setTab}
        activeFilter={activeFilter}
        filters={['全部', ...ASSET_GROUPS]}
        onFilterChange={setActiveFilter}
        onBack={handleBack}
        onExport={() => setExportOpen(true)}
        onSave={handleCanvasSessionSave}
        onRestore={handleCanvasSessionRestore}
        onNew={handleNew}
        saving={canvasSessionBusy}
        canRestore={Boolean(canvasSession?.id || result.canvasSessionId)}
      />

      {tab === 'canvas' ? (
        <div
          ref={containerRef}
          className="ec-canvas-stage"
          style={{ cursor: pointerMode?.kind === 'pan' ? 'grabbing' : activeTool === 'hand' ? 'grab' : canvasCursorForState({ pointerKind: pointerMode?.kind, shiftKey: shiftPressed }) }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={event => {
            if (!event.target?.closest?.('[data-canvas-node-id],button,input,textarea,select,a')) sourceUploadRef.current?.click();
          }}
        >
          <input ref={sourceUploadRef} type="file" accept="image/*" multiple onChange={handleCanvasSourceUpload} style={{ display: 'none' }} />
          <CanvasLeftRail
            addMenuOpen={addMenuOpen}
            onAddMenuToggle={() => setAddMenuOpen(open => !open)}
          />
          <CanvasAddMenu
            open={addMenuOpen}
            position={{ position: 'fixed', left: 68, top: '50%', transform: 'translateY(-50%)' }}
            onClose={() => setAddMenuOpen(false)}
            onSelect={actionId => {
              setAddMenuOpen(false);
              if (actionId === 'upload') sourceUploadRef.current?.click();
              else if (actionId === 'works') setTab('works');
              else if (actionId === 'text') handleAddTextNode();
              else if (actionId === 'image') addCanvasComposer('image');
              else if (actionId === 'ecommerce') addCanvasComposer('suite');
            }}
          />
          <CanvasBottomToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onImage={() => { sourceUploadRef.current?.click(); setActiveTool('select'); }}
            onText={handleAddTextNode}
            layersOpen={layersPanelOpen}
            onLayers={() => setLayersPanelOpen(open => !open)}
          />
          <CanvasLayersPanel
            open={layersPanelOpen}
            nodes={nodes}
            selectedIds={multiSelected}
            onSelect={handleLayerSelect}
            onToggleVisibility={handleLayerVisibilityToggle}
            onToggleLock={handleLayerLockToggle}
            onClose={() => setLayersPanelOpen(false)}
          />
          <CanvasZoomControls
            scale={viewport.scale}
            onZoomOut={() => zoomTo(viewport.scale * 0.8)}
            onZoomIn={() => zoomTo(viewport.scale * 1.25)}
            onFit={fitView}
          />
          {!nodes.length && (
            <div className="ec-canvas-empty-state">
              <div>
                <strong>双击画布导入商品素材</strong>
                <p>从商品原图开始，继续生成主图、详情图、SKU 和透明素材</p>
                <div className="ec-canvas-empty-actions">
                  <button type="button" className="is-primary" onClick={() => sourceUploadRef.current?.click()}><MdAddPhotoAlternate size={15} />上传图片</button>
                  <button type="button" onClick={() => setTab('works')}><MdCollections size={15} />从我的作品导入</button>
                  <button type="button" onClick={() => addCanvasComposer('suite')}><MdAutoFixHigh size={15} />生成电商套图</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ '--canvas-overlay-scale': 1 / Math.max(0.1, viewport.scale), position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`, transformOrigin: '0 0', willChange: 'transform' }}>
            <ConnectionLines connections={connections} nodes={connectionNodes} onRemove={handleRemoveConnection} focusNodeIds={focusedNodeIds} />
            <ConnectionDraftLine draft={connectionDraft} nodes={connectionNodes} />
            {visibleNodes.map(node => {
              const selectedNodeState = isNodeSelected(node.id);
              const nodeSource = nodes.find(source => source.id === node.sourceNodeIds?.[0]);
              const sourcePreviewUrl = nodeSource?.url || nodeSource?.assets?.find(asset => asset?.url)?.url || '';
              const sourcePreview = sourcePreviewUrl ? { ...nodeSource, url: proxyImg(sourcePreviewUrl) } : null;
              const workflowPortDown = (event, side) => handlePortPointerDown(event, node.id, side);
              const workflowPortUp = (event, side) => handlePortPointerUp(event, node.id, side);
              const workflowContext = event => setContextMenu({ x: event.clientX, y: event.clientY, node });
              if (node.kind === 'source_group') {
                return <StudioSourceNode
                  key={node.id}
                  node={node}
                  selected={selectedNodeState}
                  dimmed={Boolean(focusedNodeIds && !focusedNodeIds.has(node.id))}
                  onPointerDown={handleNodeDown}
                  onPortPointerDown={event => handlePortPointerDown(event, node.id, 'out')}
                  onHoverChange={setHoveredNodeId}
                  onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
                  onDoubleClick={preview => setZoomImg({ url: preview.url, label: node.name || '商品素材' })}
                />;
              }
              if (node.kind === 'image' || node.kind === 'output') {
                return <StudioImageNode
                  key={node.id}
                  node={node}
                  selected={selectedNodeState}
                  hovered={hoveredNodeId === node.id}
                  focusActive={Boolean(focusedNodeIds)}
                  related={Boolean(focusedNodeIds?.has(node.id))}
                  onPointerDown={handleNodeDown}
                  onPortPointerDown={event => handlePortPointerDown(event, node.id, 'out')}
                  onPortPointerUp={event => handlePortPointerUp(event, node.id, 'out')}
                  onResizeStart={(event, corner) => handleNodeResizeStart(event, node.id, corner)}
                  onHoverChange={setHoveredNodeId}
                  onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
                  onDoubleClick={node => setZoomImg({ url: node.url, label: node.name || node.displayLabel || '图片预览' })}
                />;
              }
              if (node.kind === 'text') {
                return <StudioTextNode
                  key={node.id}
                  node={node}
                  selected={selectedNodeState}
                  editing={editingTextNodeId === node.id}
                  dimmed={Boolean(focusedNodeIds && !focusedNodeIds.has(node.id))}
                  onPointerDown={handleNodeDown}
                  onChange={handleTextNodeChange}
                  onSelect={nodeId => { setSelected(nodeId); setMultiSelected(new Set([nodeId])); }}
                  onDoubleClick={nodeId => { setSelected(nodeId); setMultiSelected(new Set([nodeId])); setEditingTextNodeId(nodeId); }}
                  onBlur={nodeId => setEditingTextNodeId(current => current === nodeId ? null : current)}
                  onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
                />;
              }
              if (node.kind === 'image-composer') {
                const sources = (node.sourceNodeIds || []).map(id => nodes.find(item => item.id === id)).filter(item => item?.url);
                return <CanvasImageComposer
                  key={node.id}
                  node={node}
                  sources={sources}
                  loading={node.status === 'processing'}
                  onPointerDown={handleNodeDown}
                  onChange={change => updateComposerNode(node.id, change)}
                  onAddSources={files => handleComposerSourceUpload(node.id, files)}
                  onRemoveSource={sourceId => removeComposerSource(node.id, sourceId)}
                  onGenerate={() => handleImageComposerGenerate(node)}
                  onClose={() => removeCanvasNode(node.id)}
                />;
              }
              if (node.kind === 'suite-composer') {
                const sources = (node.sourceNodeIds || []).map(id => nodes.find(item => item.id === id)).filter(item => item?.url);
                return <CanvasEcommerceComposer
                  key={node.id}
                  node={node}
                  sources={sources}
                  loading={node.status === 'processing'}
                  onPointerDown={handleNodeDown}
                  onChange={change => updateComposerNode(node.id, change)}
                  onAddSources={files => handleComposerSourceUpload(node.id, files)}
                  onRemoveSource={sourceId => removeComposerSource(node.id, sourceId)}
                  onGenerate={() => handleSuiteComposerGenerate(node)}
                  onClose={() => removeCanvasNode(node.id)}
                />;
              }
              const productImages = (node.inputs?.productImages || []).map(image => ({ ...image, url: proxyImg(image.url) }));
              const referenceImages = (node.inputs?.referenceImages || []).map(image => ({ ...image, url: proxyImg(image.url) }));
              const workflowAction = getCanvasAction(node.actionId);
              return <div key={node.id} data-canvas-node-id={node.id} onMouseEnter={() => setHoveredNodeId(node.id)} onMouseLeave={() => setHoveredNodeId(null)} style={{ position: 'absolute', left: node.x, top: node.y, width: node.w, minHeight: node.h, opacity: focusedNodeIds && !focusedNodeIds.has(node.id) ? 0.34 : 1, visibility: node.hidden ? 'hidden' : 'visible', transition: 'opacity 0.16s' }}>
                <CanvasWorkflowNode
                  node={node}
                  sourceNode={sourcePreview}
                  actions={actionsForSurface({ surface: 'image-editor', node })}
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
            {!focusedEditor && multiSelected.size > 1 && multiSelectionBounds && <div
              className="ec-canvas-multi-selection-box"
              aria-hidden="true"
              style={{ left: multiSelectionBounds.x, top: multiSelectionBounds.y, width: multiSelectionBounds.w, height: multiSelectionBounds.h }}
            />}
            {!focusedEditor && <CanvasMultiSelectionToolbar nodes={nodes} selectedIds={multiSelected} viewport={viewport} bounds={containerRef.current?.getBoundingClientRect()} onAction={handleMultiSelectionAction} />}
            {!focusedEditor && multiSelected.size <= 1 && selectedNode && !['text', 'image-composer', 'suite-composer'].includes(selectedNode.kind) && <CanvasObjectToolbar node={selectedNode} viewport={viewport} bounds={containerRef.current?.getBoundingClientRect()} actions={actionsForSurface({ surface: 'selection', node: selectedNode })} onAction={handleToolAction} />}
            {!focusedEditor && multiSelected.size <= 1 && selectedNode?.kind === 'text' && <CanvasTextToolbar
              node={selectedNode}
              viewport={viewport}
              bounds={containerRef.current?.getBoundingClientRect()}
              onStyleChange={change => setNodes(previous => previous.map(node => node.id === selectedNode.id ? { ...node, textStyle: { ...(node.textStyle || {}), ...change } } : node))}
              onDuplicate={() => handleToolAction(getCanvasAction('duplicate'), selectedNode)}
              onFullscreen={() => setTextInspectorNodeId(selectedNode.id)}
              onDelete={() => handleToolAction(getCanvasAction('delete'), selectedNode)}
            />}
            {textComposerNode && (() => {
              const position = getContextPanelPosition({
                node: textComposerNode,
                viewport,
                bounds: containerRef.current?.getBoundingClientRect(),
                panel: { width: 520, height: 218 },
              });
              return <CanvasTextComposer
                node={textComposerNode}
                position={position}
                value={textComposerValue}
                loading={promptLoading}
                onChange={setTextComposerValue}
                onSubmit={handleTextComposerSubmit}
                onClose={() => { setTextComposerNodeId(null); setTextComposerValue(''); }}
              />;
            })()}
            {connectionPicker && <CanvasDeriveMenu
              actions={connectionPicker.mode === 'image-editor'
                ? actionsForSurface({ surface: 'image-editor', node: nodes.find(node => node.id === connectionPicker.sourceNodeId) })
                : portCreationActions}
              position={clampCanvasPickerPosition({
                world: { x: connectionPicker.world.x + 14, y: connectionPicker.world.y + 14 },
                viewport,
                bounds: containerRef.current?.getBoundingClientRect(),
              })}
              title={connectionPicker.mode === 'image-editor' ? '图片生成与编辑' : '引用当前素材生成'}
              onBack={connectionPicker.mode === 'image-editor' ? () => setConnectionPicker(previous => ({ ...previous, mode: '' })) : undefined}
              onClose={() => { setConnectionPicker(null); setConnectionDraft(null); }}
              onSelect={action => {
                if (action.id === 'text-generation') {
                  handleAddTextNode({ ...connectionPicker.world, sourceNodeId: connectionPicker.sourceNodeId, openComposer: true });
                } else if (action.id === 'ecommerce-suite') {
                  addCanvasComposer('suite', { ...connectionPicker.world, sourceNodeId: connectionPicker.sourceNodeId });
                } else if (action.id === 'image-edit' && connectionPicker.mode !== 'image-editor') {
                  setConnectionPicker(previous => ({ ...previous, mode: 'image-editor' }));
                  return;
                } else if (action.id === 'image-edit') {
                  addCanvasComposer('image', { ...connectionPicker.world, sourceNodeId: connectionPicker.sourceNodeId });
                } else {
                  handleCreateDerivedNode(connectionPicker.sourceNodeId, getCanvasAction(action.id) || action, connectionPicker.world);
                }
                setConnectionPicker(null);
                setConnectionDraft(null);
              }}
            />}
            <CanvasFocusedEditor
              mode={focusedEditor?.mode}
              node={focusedEditorNode}
              options={focusedEditor?.options}
              onOptionChange={options => setFocusedEditor(previous => previous ? { ...previous, options } : previous)}
              onCancel={() => setFocusedEditor(null)}
              onConfirm={handleFocusedEditorConfirm}
            />
          </div>

          {marquee && (
            <div style={{ position: 'absolute', left: marquee.x * viewport.scale + viewport.x, top: marquee.y * viewport.scale + viewport.y, width: Math.abs(marquee.w) * viewport.scale, height: Math.abs(marquee.h) * viewport.scale, transform: `translate(${marquee.w < 0 ? marquee.w * viewport.scale : 0}px,${marquee.h < 0 ? marquee.h * viewport.scale : 0})`, border: '1px solid #7c3aed', background: 'rgba(124,58,237,.10)', pointerEvents: 'none', zIndex: 20 }} />
          )}

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
                      <button key={i} type="button" onClick={() => setZoomImg({ url: proxyImg(img), label: img.label || '' })} style={{ width: 72, height: 72, padding: 0, overflow: 'hidden', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)', flexShrink: 0, cursor: 'zoom-in', background: '#f3f4f6' }}>
                        <ResponsiveImage src={img} variant="thumb" ratio="1:1" alt={img.label || `作品图片 ${i + 1}`} style={{ width: '100%', height: '100%' }} imgStyle={{ objectFit: 'cover' }} />
                      </button>
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
        <div role="dialog" aria-modal="true" aria-label={`${zoomImg.label || '图片'}大图预览`} onClick={() => setZoomImg(null)} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <img src={proxyImg(zoomImg.url)} alt={zoomImg.label || '图片预览'} draggable="false" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }} onClick={e => e.stopPropagation()} />
          <button type="button" aria-label="关闭大图预览" onClick={() => setZoomImg(null)} style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, border: 0, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 24, color: '#fff' }}>x</button>
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
