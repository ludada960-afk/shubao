import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer } from 'react';
import { ArrowDown, ArrowUp, Crop, Download, Eraser, ExternalLink, FileDown, FolderPlus, Grid3x3, ImagePlus, Images, Info, Languages, Maximize2, Music, Pencil, Pin, Plus, Ratio, RefreshCw, Shuffle, SlidersHorizontal, Square, SquareCheck, SquarePen, Trash2, Type, X } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { flushSync } from 'react-dom';
import { HeroGlyph } from './components/HeroIcons';
import { loadCachedWorks, loadWorks, saveWork, proxyImg, deleteWork as softDeleteWork, loadTrash, restoreWork, reversePrompt, removeBg, stitchLongImage, regenerateCanvasImage, generateEcommerceSuite, getDesignDirections, transformCanvasImage, analyzeCanvasLayers, createCanvasSegmentationPlan, recognizeCanvasText, replaceCanvasText, uploadEcommerceAssets, createTextComposition, listTextCompositions, saveTextCompositionRevision, createCanvasPixelLayers, exportCanvasPsd } from '../../services/api';
import {
  ASSET_GROUPS,
  addConnection,
  bindNonPassiveWheel,
  canvasCursorForState,
  fitViewport,
  getCanvasPointerIntent,
  getNodePointerIntent,
  getAssetMeta,
  moveSelectedNodes,
  normalizeAsset,
  readableInitialViewport,
  removeConnectionsForNodes,
  selectNodesInRect,
  zoomAroundCursor,
  zoomPreviewByWheel,
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
import { normalizeCommerceContext } from '../Home/ec/internationalCommerceRegistry.js';
import {
  CanvasAddMenu,
  CanvasAudioNode,
  CanvasDeriveMenu,
  CanvasEcommerceComposer,
  CanvasFocusedEditor,
  CanvasGenerationNode,
  CanvasImageComposer,
  CanvasImageNode as StudioImageNode,
  CanvasMultiSelectionToolbar,
  CanvasObjectToolbar,
  CanvasSourceNode as StudioSourceNode,
  CanvasTextGenerationComposer,
  CanvasVideoComposer,
  CanvasTextNode as StudioTextNode,
  CanvasTextToolbar,
} from './components/CanvasStudio.jsx';
import { normalizeWorkImages } from '../../utils/workImages.js';
import { stripTransientWorkPlayback } from '../../utils/workRecords.js';
import { handleGenerationAccessError } from '../../utils/generationAccess.js';
import { createCanvasSession, createProject, createProjectVersion, getProjectAsset, getProjectAssetLineage, importImageAssetToProject, importVideoAssetToProject, listProjectAssetLibrary, loadCanvasSession, registerGeneratedAssetToProject, saveCanvasSession, setProjectAssetProductionState, setProjectAssetRetention, addToProjectAssetLibrary } from '../../services/projects.js';
import { useDialog } from '../../components/ui/DialogProvider.jsx';
import ContextMenu from './ContextMenu.jsx';
import { actionsForSurface, getCanvasAction } from './canvasActionRegistry.js';
import { canvasMediaAssetRefs, createCanvasSnapshot, createFreshCanvasSession, importProjectAssetToCanvas, normalizePendingProjectAssetImports, restoreCanvasMediaPlayback, restoreCanvasSnapshot } from './canvasSessionModel.js';
import { collectCanvasProjectAssetRefs } from './canvasAssetReferenceModel.js';
import { buildCanvasImportResult, canvasOutputImages, canvasVideoAsset, canvasVideoResultPatch, canvasWorkCategory, canvasWorkOutputFingerprint, collectCanvasMediaAssets, collectCanvasWorkImages, durableCanvasMediaAssets, filterCanvasWorks, normalizeCanvasWorkPanel } from './canvasWorkModel.js';
import { cleanupLegacyCanvasStorage } from '../Works/retentionModel.js';
import { canReuseProjectAsset, filterProjectAssetLibrary, normalizeProjectAssetLibrary, normalizeProjectAssetSelection, projectAssetProductionOptions, projectAssetProductionStatus, projectAssetRetentionStatus, projectAssetSelectionKey, PROJECT_ASSET_PRODUCTION_FILTERS, PROJECT_ASSET_PRODUCTION_STATES, PROJECT_ASSET_RETENTION_FILTERS, toggleProjectAssetSelection } from '../Works/projectAssetLibraryModel.js';
import TextLayerInspector from './components/TextLayerInspector.jsx';
import ResponsiveImage from '../../components/ResponsiveImage.jsx';
import { canvasDraftKey, loadCanvasDraft, saveCanvasDraft } from './canvasDraftRepository.js';
import { applyMultiSelectionAction, CANVAS_CREATION_OPTIONS, expandCanvasDragSelection, expandCanvasLayerGroup, getCanvasFocusIds, isCanvasConnectionVisible, pickCanvasLayerAtPoint, replaceCanvasNodeWithLayerResult, selectedCanvasBounds } from './canvasInteractionModel.js';
import { createCanvasImageComposerNode, createCanvasSuiteComposerNode, createCanvasTextComposerNode, createCanvasTextNode, createCanvasVideoComposerNode, createUploadedImageNodes, createUploadedVideoNodes, getCanvasComposerPresentation, normalizeCanvasSelection, ratioValue, resizeCanvasNodeByHandle } from './canvasStudioModel.js';
import { attachCanvasProjectAssetRef } from './canvasAssetReferenceModel.js';
import { applyCanvasSuitePlanToDirection, buildCanvasSuitePlan } from './canvasSuitePlanModel.js';
import { findCanvasBlankPlacement } from './canvasInlineEditorModel.js';
import { canvasImageResultGeometry, materializeCanvasLayers } from './canvasLayerMaterialization.js';
import { readCanvasTextRecognitionCache, writeCanvasTextRecognitionCache } from './canvasTextRecognitionModel.js';
import { reduceSegmentationProgress } from './canvasSegmentationModel.js';
import { canvasSegmentationRuntime, segmentationMasksToApi } from './canvasSegmentationRuntime.js';
import { appendImageMention, buildCanvasImageReferencePayload, buildImageMentions, buildRoleAwareImagePayload, removeImageMention } from '../../components/creation/imageMentionModel.js';
import { selectDeliverableNodes } from './canvasAssetProvenance.js';
import { moveDetailItem, orderDetailNodes } from './detailCompositionModel.js';
import { placeDerivedRightOfSources } from './canvasDerivedPlacement.js';
import { chooseDeliveryDestination, prepareImageDeliverables, safeDeliveryName, writePreparedDeliverables } from './browserFileDelivery.js';
import { createExportDeliveryState, exportDeliveryReducer, isExportDeliveryBusy } from './exportDeliveryModel.js';
import { quoteBillingAction } from '../../services/billing.js';
import { analyzeVideoPlan, createVideoJob, getVideoJob, uploadVideoAsset } from '../../services/video.js';
import { inspectVideoPlanningFiles } from '../VideoStudio/videoAssetAnalysis.js';
import { resolveVideoApiMode, hasRequiredVideoInputs } from '../VideoStudio/videoStudioModel.js';
import VideoProjectDeliveryDialog from '../VideoStudio/VideoProjectDeliveryDialog.jsx';
import { DELIVERY_SOURCE_SURFACES, deliverableRefsFromNodes } from '../VideoStudio/videoDeliveryModel.js';
import './EcCanvas.css';
import '../../styles/canvas-derive-menu.css';
import '../../styles/canvas-empty-actions.css';

const WORK_CATEGORY_OPTIONS = Object.freeze([
  { id: 'all', label: '全部作品' },
  { id: 'ecommerce', label: '电商商品图' },
  { id: 'xhs', label: '小红书图文' },
  { id: 'video', label: 'AI 视频' },
  { id: 'visual', label: '自由创作' },
]);

const VIDEO_FINAL_STATUSES = new Set(['completed', 'failed', 'needs_review']);

function videoSku(duration, productId = 'seedance_standard') {
  const model = productId === 'seedance_fast' ? 'seedance_fast' : 'seedance_standard';
  return `video_${model}_${Number(duration) <= 8 ? 'short' : 'long'}`;
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function canvasVideoInputFiles(composer = {}, sourceNodes = []) {
  const mode = composer.mode || 'smart';
  const roleFor = node => composer.sourceRoles?.[node.id] || node.role || 'reference';
  const images = sourceNodes.filter(node => !['video', 'audio'].includes(node.kind) && (mode === 'smart' || !['first', 'last'].includes(roleFor(node))));
  const videos = sourceNodes.filter(node => node.kind === 'video');
  const audios = sourceNodes.filter(node => node.kind === 'audio');
  const first = sourceNodes.filter(node => !['video', 'audio'].includes(node.kind) && roleFor(node) === 'first');
  const last = sourceNodes.filter(node => !['video', 'audio'].includes(node.kind) && roleFor(node) === 'last');
  return { images, videos, audios, first, last };
}

function generatedAssetIdFromUrl(url = '') {
  return String(url).match(/\/api\/generated-assets\/([a-f0-9]{64}\.(?:jpg|png|webp))(?:[?#]|$)/i)?.[1] || '';
}

function canvasImportSourceId(kind, asset = {}) {
  return String(kind === 'image'
    ? asset.assetId || asset.id || ''
    : asset.id || asset.videoAssetId || asset.assetId || '').trim();
}

function pendingProjectAssetImportKey(record = {}) {
  return `${record.operation || 'import-source'}:${record.kind || 'media'}:${record.sourceAssetId || canvasImportSourceId(record.kind, record.asset)}`;
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

function createCanvasGenerationRunId() {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeLayerItems(layers, nodeId) {
  return (layers || []).map((layer, index) => ({
    id: layer.id || `layer_${nodeId}_${index + 1}`,
    name: layer.name || `图层 ${index + 1}`,
    kind: layer.kind || '元素',
    description: layer.description || '',
    visible: layer.visible !== false,
    locked: Boolean(layer.locked),
    url: layer.url || layer.preview_url || '',
    preview_url: layer.preview_url || layer.url || '',
  }));
}

const ACTION_ICONS = {
  'add-text': Type,
  'adjust-requirements': Pencil,
  regenerate: RefreshCw,
  download: Download,
  'image-info': Info,
  'add-reference': ImagePlus,
  delete: Trash2,
  'product-remix': Shuffle,
  outpaint: Ratio,
  inpaint: SlidersHorizontal,
  'remove-background': Eraser,
  'layer-edit': SquarePen,
  translate: Languages,
  upscale: Maximize2,
  crop: Crop,
  'grid-split': Grid3x3,
  annotation: Type,
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
      const h = img.ratio === '3:4' ? Math.round(NODE_W * 4 / 3) : img.ratio === '9:16' ? Math.round(NODE_W * 16 / 9) : NODE_W;
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
        data-canvas-node-check="true"
        aria-label={selected ? '取消选择' : '选择节点'}
        onPointerDown={e => { e.stopPropagation(); onToggleSelect?.(e, node.id); }}
        style={{ position: 'absolute', zIndex: 3, left: 8, top: 8, width: 22, height: 22, border: 0, borderRadius: 6, background: 'rgba(255,255,255,.92)', color: selected ? '#7c3aed' : '#777', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 7px rgba(0,0,0,.16)' }}
      >
        {selected ? <SquareCheck /> : <Square />}
      </button>
      {hovered && hoverActions.length > 0 && <div style={{ position: 'absolute', zIndex: 4, top: 8, right: 8, display: 'flex', gap: 5 }}>
        {hoverActions.map(action => {
          const Icon = ACTION_ICONS[action.id] || Sparkles;
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
        const isProcessing = from.status === 'processing' || to.status === 'processing';
        const style = isProcessing
          ? { stroke: '#7c3aed', dash: '8 6' }
          : styles[conn.relation || conn.type] || styles.reference;
        const isFocused = !focusNodeIds || (focusNodeIds.has(from.id) && focusNodeIds.has(to.id));
        return (
          <g key={i}>
            <path className={isProcessing ? 'ec-canvas-edge-processing' : undefined} data-canvas-edge-id={conn.id || `edge-${i}`} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke={style.stroke} strokeWidth={isFocused ? 2.8 : 2.1} fill="none" strokeDasharray={style.dash} opacity={isFocused ? 0.9 : 0.14} onDoubleClick={() => onRemove?.(conn)} style={{ cursor: 'pointer', pointerEvents: 'stroke', transition: 'opacity 0.16s, stroke-width 0.16s' }} />
            <circle cx={x2} cy={y2} r={4} fill={style.stroke} opacity={isFocused ? 0.9 : 0.14} />
          </g>
        );
      })}
    </svg>
  );
}

function ConnectionDraftLine({ draft, nodes }) {
  const pointer = draft?.pointer || draft?.world;
  if (!draft?.sourceNodeId || !pointer) return null;
  const source = nodes.find(node => node.id === draft.sourceNodeId);
  if (!source) return null;
  const sourcePort = getCanvasPortCenter(source, 'output');
  const x1 = sourcePort.x;
  const y1 = sourcePort.y;
  const x2 = pointer.x;
  const y2 = pointer.y;
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

async function persistCanvasUploadAssets(assets = [], { role = 'product' } = {}) {
  const persisted = await uploadEcommerceAssets(assets, role);
  if (persisted.length !== assets.length || persisted.some(asset => !asset?.url || !/^\/api\/generated-assets\//i.test(asset.url))) {
    throw new Error('图片上传结果不完整，请重试');
  }
  return assets.map((asset, index) => ({ ...asset, ...persisted[index] }));
}

export default function EcCanvas() {
  const { state, dispatch, refreshBillingBalance } = useApp();
  const dialog = useDialog();
  const result = state.result || {};
  const phone = state.phone || '';

  useEffect(() => {
    if (state.logged && !state.browserQa) refreshBillingBalance().catch(() => {});
  }, [state.logged, state.browserQa, refreshBillingBalance]);
  const [viewport, setViewport] = useState({ x: 80, y: 40, scale: 1 });
  const [nodes, setNodes] = useState([]);
  const nodesRef = useRef([]);
  const [pendingProjectAssetImports, setPendingProjectAssetImports] = useState([]);
  const [pendingProjectAssetImportsBusy, setPendingProjectAssetImportsBusy] = useState(false);
  const pendingProjectAssetImportsRef = useRef([]);
  const pendingProjectAssetImportsBusyRef = useRef(false);
  const [selected, setSelected] = useState(null);
  const [multiSelected, setMultiSelected] = useState(new Set());
  const [connections, setConnections] = useState([]);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { pendingProjectAssetImportsRef.current = pendingProjectAssetImports; }, [pendingProjectAssetImports]);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [pointerMode, setPointerMode] = useState(null);
  const [activeTool, setActiveTool] = useState('select');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  // JS anchoring for the add-node menu: measured from the rail button's live
  // rect (CSS centering drifts once the topbar/rail metrics change).
  const [addMenuAnchor, setAddMenuAnchor] = useState(null);
  const syncAddMenuAnchor = useCallback(() => {
    const rect = containerRef.current?.querySelector('.ec-canvas-rail-add')?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    setAddMenuAnchor({ position: 'fixed', left: Math.round(rect.right + 12), top: Math.round(rect.top + rect.height / 2), transform: 'translateY(-50%)' });
  }, []);
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
  const [exportMode, setExportMode] = useState('images');
  const [exportIntent, setExportIntent] = useState('suite');
  const [exportSelectionIds, setExportSelectionIds] = useState(new Set());
  const [exportDelivery, dispatchExportDelivery] = useReducer(exportDeliveryReducer, undefined, createExportDeliveryState);
  const composedLongExportRef = useRef(null);
  const [detailOrderIds, setDetailOrderIds] = useState([]);
  const [connectionPicker, setConnectionPicker] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);     // A6: 右键菜单
  const [videoDelivery, setVideoDelivery] = useState(null); // P2: 发往视频项目对话框状态 {refs, surface}
  const [tab, setTab] = useState(state.canvasEntryTab || 'canvas');
  const [workCategory, setWorkCategory] = useState('all');
  const [pastWorks, setPastWorks] = useState([]);
  const [trashWorks, setTrashWorks] = useState([]);
  const [worksLoading, setWorksLoading] = useState(false);
  const [projectAssetLibrary, setProjectAssetLibrary] = useState([]);
  const [projectAssetMediaFilter, setProjectAssetMediaFilter] = useState('');
  const [projectAssetLibraryLoading, setProjectAssetLibraryLoading] = useState(false);
  const [projectAssetLibraryError, setProjectAssetLibraryError] = useState('');
  const [projectAssetRetentionBusy, setProjectAssetRetentionBusy] = useState('');
  const [projectAssetProductionBusy, setProjectAssetProductionBusy] = useState('');
  const [projectAssetQuery, setProjectAssetQuery] = useState('');
  const [projectAssetRetentionFilter, setProjectAssetRetentionFilter] = useState('all');
  const [projectAssetProductionFilter, setProjectAssetProductionFilter] = useState('all');
  const [selectedProjectAssetKeys, setSelectedProjectAssetKeys] = useState(() => new Set());
  const [projectAssetBatchBusy, setProjectAssetBatchBusy] = useState(false);
  const [projectAssetLineage, setProjectAssetLineage] = useState(null);
  const [zoomImg, setZoomImg] = useState(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const requestedTab = state.canvasEntryTab;
    if (requestedTab && requestedTab !== tab) setTab(requestedTab);
  }, [state.canvasEntryTab, tab]);
  const [promptLoading, setPromptLoading] = useState(false);
  const [editingTextNodeId, setEditingTextNodeId] = useState(null);
  const [activeComposerSurface, setActiveComposerSurface] = useState('');
  const [focusedEditor, setFocusedEditor] = useState(null);
  const [imageInfoNode, setImageInfoNode] = useState(null);
  const [imageInfoName, setImageInfoName] = useState('');
  const [imageInfoGroup, setImageInfoGroup] = useState('其他');
  const [imageInfoUsage, setImageInfoUsage] = useState('');
  const [outpaintDraft, setOutpaintDraft] = useState(null);
  const [textInspectorNodeId, setTextInspectorNodeId] = useState(null);
  const [textCompositionSaving, setTextCompositionSaving] = useState(false);
  const [textCompositionError, setTextCompositionError] = useState('');
  const [textOcrBlocks, setTextOcrBlocks] = useState(null);
  const [textOcrLoading, setTextOcrLoading] = useState(false);
  const [canvasSession, setCanvasSession] = useState(null);
  const [canvasSessionBusy, setCanvasSessionBusy] = useState(false);
  const containerRef = useRef(null);
  const previewDialogRef = useRef(null);
  const canvasSaveKeyRef = useRef(null);
  const touchPointsRef = useRef(new Map());
  const dragFrameRef = useRef(null);
  const pendingDragRef = useRef(null);
  const draftReadyRef = useRef(false);
  const segmentationAbortRef = useRef(new Map());
  const workflowProcessRef = useRef(null);
  const sourceUploadRef = useRef(null);
  const videoUploadRef = useRef(null);
  const objectClipboardRef = useRef(null);
  const canvasSessionRef = useRef(null);
  const projectAssetImportBusyRef = useRef(false);
  const generatedAssetRegistrationRef = useRef(new Map());
  const generatedProjectEnsureRef = useRef(null);
  const canvasPersistenceGenerationRef = useRef(0);
  const remoteSaveTimerRef = useRef(null);
  const remoteSnapshotRef = useRef('');
  const workOutputFingerprintRef = useRef('');
  const canvasGeneratedWorkKeyRef = useRef(result._saveKey || '');
  const suiteGenerationInFlightRef = useRef(new Set());
  const toastTimerRef = useRef(null);
  const textOcrCacheRef = useRef(new Map());

  useEffect(() => {
    setActiveComposerSurface('');
  }, [selected]);

  useEffect(() => {
    canvasGeneratedWorkKeyRef.current = result._saveKey || '';
    workOutputFingerprintRef.current = '';
    remoteSnapshotRef.current = '';
    canvasPersistenceGenerationRef.current += 1;
    setPendingProjectAssetImports([]);
    pendingProjectAssetImportsBusyRef.current = false;
    setPendingProjectAssetImportsBusy(false);
  }, [result.id, result._saveKey, result.canvasImportId]);

  useEffect(() => {
    if (!activeComposerSurface) return undefined;
    const closeOnEscape = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setActiveComposerSurface('');
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [activeComposerSurface]);
  const imageList = parseImages(canvasOutputImages(result), result.platform || '淘宝');
  const resultVideoUrl = String(result.video_url || result.videoUrl || result.video?.url || result._videoResult?.url || '').trim();
  const resultMediaAssets = collectCanvasMediaAssets(result);
  const hasCurrent = imageList.length > 0 || Boolean(resultVideoUrl) || resultMediaAssets.length > 0;
  const visibleNodes = activeFilter === '全部' ? nodes : nodes.filter(node => node.group === activeFilter);
  const selectedNode = selected ? nodes.find(node => node.id === selected) : null;
  const exportScope = selectDeliverableNodes(nodes, exportSelectionIds);
  const orderedDetailNodes = (detailOrderIds.length
    ? detailOrderIds.map(id => exportScope.deliverables.find(node => node.id === id)).filter(Boolean)
    : orderDetailNodes(exportScope.deliverables));
  const canExportLongDetail = orderedDetailNodes.length >= 2;

  useEffect(() => {
    if (!exportOpen) return;
    setDetailOrderIds(orderDetailNodes(selectDeliverableNodes(nodes, exportSelectionIds).deliverables).map(node => node.id));
    composedLongExportRef.current = null;
    dispatchExportDelivery({ type: 'reset', config: { mode: exportMode, format: exportFormat } });
  }, [exportOpen]);
  const multiSelectionBounds = selectedCanvasBounds(nodes, multiSelected);
  const focusedEditorNode = focusedEditor ? nodes.find(node => node.id === focusedEditor.nodeId) : null;
  const textInspectorNode = textInspectorNodeId ? nodes.find(node => node.id === textInspectorNodeId) : null;
  const connectionNodes = nodes;
  const focusedNodeIds = hoveredNodeId ? getCanvasFocusIds(hoveredNodeId, connections) : null;
  const rawAvailableComposerSources = nodes.filter(node => node?.url && ['image', 'output', 'image-composer', 'layer-group'].includes(node.kind) && node.id !== selectedNode?.id);
  const availableComposerSources = buildImageMentions(rawAvailableComposerSources).map(mention => ({
    ...rawAvailableComposerSources.find(node => node.id === mention.sourceNodeId),
    ...mention,
  }));
  const selectedComposerSources = selectedNode
    ? (selectedNode.sourceNodeIds || []).map(id => availableComposerSources.find(node => node.id === id) || nodes.find(node => node.id === id)).filter(node => node?.url)
    : [];
  const selectedComposerMentions = selectedNode
    ? (selectedNode.mentionSourceNodeIds || []).map(id => availableComposerSources.find(node => node.id === id) || nodes.find(node => node.id === id)).filter(node => node?.url)
    : [];
  const selectedComposerPosition = getCanvasComposerPresentation({
    node: selectedNode,
    selectedId: selected,
    selectedCount: multiSelected.size,
    viewportBounds: containerRef.current?.getBoundingClientRect(),
    viewport,
    avoidNodes: nodes,
    height: selectedNode?.kind === 'suite-composer' ? 420 : selectedNode?.kind === 'image-composer' ? 320 : selectedNode?.kind === 'video-composer' ? 330 : 300,
  }).position;

  // toast helper
  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    setToast(null);
  }, []);

  const showToast = useCallback((msg, type = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, type });
    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = null;
      setToast(null);
    }, 3000);
  }, []);

  const ensureCanvasMediaProject = useCallback(async (title = 'Canvas 媒体项目', kind = 'video') => {
    if (!state.logged) return null;
    const existingProjectId = String(result.projectId || '').trim();
    const existingVersionId = String(result.resultVersionId || result.sourceVersionId || '').trim();
    if (existingProjectId && existingVersionId) return {
      projectId: existingProjectId,
      baseVersionId: existingVersionId,
    };

    canvasSaveKeyRef.current ||= canvasDraftKey({
      ...result,
      canvasImportId: `media-upload-${Date.now()}`,
    });
    canvasGeneratedWorkKeyRef.current ||= canvasSaveKeyRef.current;
    let projectId = existingProjectId;
    if (!projectId) {
      const project = await createProject({
        kind: kind === 'ecommerce' ? 'ecommerce' : 'video',
        title: String(title || '').trim() || 'Canvas 媒体项目',
        idempotencyKey: `canvas-media:${canvasSaveKeyRef.current}`,
      });
      projectId = project.id;
    }
    let baseVersionId = existingVersionId;
    if (!baseVersionId) {
      const version = await createProjectVersion(projectId, {
        reason: 'manual_save',
        inputSnapshot: { surface: 'canvas', mediaImport: true },
        planSnapshot: { surface: 'canvas', mediaImport: true },
        idempotencyKey: `canvas-media-version:${canvasSaveKeyRef.current}`,
      });
      baseVersionId = version.id;
    }
    dispatch({
      type: 'SET_RESULT',
      result: {
        ...result,
        projectId,
        sourceVersionId: baseVersionId,
      },
    });
    return { projectId, baseVersionId };
  }, [dispatch, result, state.logged]);

  const importCanvasMediaAsset = useCallback(async (asset, projectContext, role, displayName = '') => {
    if (!projectContext || !asset?.id) return { asset, imported: false };
    const canonical = await importVideoAssetToProject(projectContext.projectId, {
      videoAssetId: asset.id,
      role,
      metadata: displayName ? { displayName } : {},
    });
    const playbackUrl = canonical.playbackUrl || canonical.stableUrl || asset.url || '';
    return {
      imported: true,
      asset: {
        ...asset,
        ...canonical,
        id: asset.id,
        videoAssetId: asset.id,
        url: playbackUrl,
        playbackUrl,
      },
    };
  }, []);

  const importCanvasMediaAssets = useCallback(async (assets, projectContext, role) => {
    const imported = [];
    const failed = [];
    for (const asset of assets) {
      try {
        imported.push(await importCanvasMediaAsset(asset, projectContext, role, asset.name || 'Canvas 媒体素材'));
      } catch (error) {
        imported.push({ asset, imported: false });
        failed.push({ asset, error });
      }
    }
    return {
      assets: imported.map(item => item.asset),
      failed,
    };
  }, [importCanvasMediaAsset]);

  const importCanvasImageAssets = useCallback(async (assets, projectContext, role) => {
    if (!projectContext || !state.logged || result.browserQa) return { assets, failed: assets.map(asset => ({ asset, error: new Error('图片项目归档不可用') })) };
    const imported = [];
    const failed = [];
    for (const asset of assets) {
      try {
        const canonical = await importImageAssetToProject(projectContext.projectId, {
          imageAssetId: asset.assetId,
          role,
          metadata: { displayName: asset.name || 'Canvas 图片素材' },
        });
        imported.push({
          ...asset,
          ...canonical,
          assetId: asset.assetId,
          url: canonical.playbackUrl || canonical.stableUrl || asset.url,
          stableUrl: canonical.stableUrl || asset.url,
        });
      } catch (error) {
        imported.push(asset);
        failed.push({ asset, error });
      }
    }
    return { assets: imported, failed };
  }, [result.browserQa, state.logged]);

  const canvasMediaFields = useCallback((work, currentNodes) => {
    const mediaAssets = collectCanvasMediaAssets(work, currentNodes);
    const projectAssetRefs = collectCanvasProjectAssetRefs({
      work: { ...work, mediaAssets },
      nodes: currentNodes,
    });
    return {
      ...(mediaAssets.length ? { mediaAssets } : {}),
      ...(projectAssetRefs.length ? { projectAssetRefs } : {}),
    };
  }, []);

  const canvasWorkMediaFields = useCallback((work, currentNodes) => {
    const fields = canvasMediaFields(work, currentNodes);
    if (!fields.mediaAssets?.length) return fields;
    return {
      ...fields,
      mediaAssets: durableCanvasMediaAssets(work, currentNodes),
    };
  }, [canvasMediaFields]);

  const enqueuePendingProjectAssetImports = useCallback(records => {
    const nextRecords = (Array.isArray(records) ? records : []).filter(record => (
      ['image', 'video', 'audio'].includes(record?.kind)
      && record?.asset
      && canvasImportSourceId(record.kind, record.asset)
      && Array.isArray(record.nodeIds)
      && record.nodeIds.length
    ));
    if (!nextRecords.length) return;
    setPendingProjectAssetImports(previous => {
      const byKey = new Map(previous.map(record => [pendingProjectAssetImportKey(record), record]));
      nextRecords.forEach(record => {
        const key = pendingProjectAssetImportKey(record);
        const existing = byKey.get(key);
        byKey.set(key, existing
          ? { ...existing, ...record, nodeIds: [...new Set([...(existing.nodeIds || []), ...(record.nodeIds || [])])] }
          : { ...record, sourceAssetId: canvasImportSourceId(record.kind, record.asset) });
      });
      return [...byKey.values()];
    });
  }, []);

  const retryPendingProjectAssetImports = useCallback(async () => {
    if (pendingProjectAssetImportsBusyRef.current) return;
    const pending = pendingProjectAssetImportsRef.current;
    if (!pending.length) return;
    if (!state.logged || result.browserQa) {
      showToast('请登录后再归档待处理素材', 'info');
      return;
    }
    pendingProjectAssetImportsBusyRef.current = true;
    setPendingProjectAssetImportsBusy(true);
    try {
      const hasVideo = pending.some(record => ['video', 'audio'].includes(record.kind));
      const projectContext = await ensureCanvasMediaProject(
        hasVideo ? 'Canvas 媒体素材项目' : 'Canvas 图片素材项目',
        hasVideo ? 'video' : 'ecommerce',
      );
      if (!projectContext) throw new Error('项目归档不可用，请稍后重试');
      const completed = [];
      const failed = [];
      for (const record of pending) {
        try {
          const canonical = record.operation === 'register-generated'
            ? await registerGeneratedAssetToProject(projectContext.projectId, {
              versionId: projectContext.baseVersionId,
              assetId: record.sourceAssetId,
              stableUrl: record.asset?.stableUrl || record.asset?.url,
              role: record.role || 'canvas-output',
              metadata: {
                source: 'canvas',
                displayName: record.displayName || 'Canvas 图片',
              },
            })
            : record.kind === 'image'
            ? await importImageAssetToProject(projectContext.projectId, {
              imageAssetId: record.sourceAssetId,
              role: record.role || 'reference',
              metadata: { displayName: record.displayName || 'Canvas 图片素材' },
            })
            : await importVideoAssetToProject(projectContext.projectId, {
              videoAssetId: record.sourceAssetId,
              role: record.role || 'reference-video',
              metadata: { displayName: record.displayName || 'Canvas 媒体素材' },
            });
          const sourceAssetId = record.sourceAssetId || canvasImportSourceId(record.kind, record.asset);
          const playbackUrl = canonical.playbackUrl || canonical.stableUrl || record.asset.url || record.asset.stableUrl || '';
          completed.push({
            record,
            asset: {
              ...record.asset,
              ...canonical,
              ...(record.kind === 'image'
                ? { assetId: sourceAssetId, url: playbackUrl, stableUrl: canonical.stableUrl || record.asset.stableUrl || record.asset.url }
                : { id: sourceAssetId, videoAssetId: sourceAssetId, url: playbackUrl, playbackUrl }),
            },
          });
        } catch (error) {
          failed.push({ record, error });
        }
      }
      if (completed.length) {
        const completedByNodeId = new Map();
        completed.forEach(item => (item.record.nodeIds || []).forEach(nodeId => completedByNodeId.set(nodeId, item.asset)));
        setNodes(previous => previous.map(node => {
          const asset = completedByNodeId.get(node.id);
          if (!asset) return node;
          return attachCanvasProjectAssetRef({
            ...node,
            ...asset,
            url: asset.url || asset.playbackUrl || asset.stableUrl || node.url,
            status: 'ready',
            uploadError: '',
          }, asset);
        }));
        const projectAssetRefs = collectCanvasProjectAssetRefs({
          work: result,
          nodes: [...nodesRef.current, ...completed.map(item => item.asset)],
        });
        dispatch({
          type: 'SET_RESULT',
          result: {
            ...result,
            projectId: projectContext.projectId,
            sourceVersionId: projectContext.baseVersionId,
            ...(projectAssetRefs.length ? { projectAssetRefs } : {}),
          },
        });
      }
      const completedKeys = new Set(completed.map(item => pendingProjectAssetImportKey(item.record)));
      setPendingProjectAssetImports(previous => previous.filter(record => !completedKeys.has(pendingProjectAssetImportKey(record))));
      if (failed.length) {
        showToast(`${completed.length ? `已归档 ${completed.length} 个素材，` : ''}${failed.length} 个素材仍待归档，请稍后重试`, 'info');
      } else if (completed.length) {
        showToast(`已归档 ${completed.length} 个待处理素材，可继续引用生成`, 'success');
      }
    } catch (error) {
      showToast(error.message || '项目归档失败，请稍后重试', 'error');
    } finally {
      pendingProjectAssetImportsBusyRef.current = false;
      setPendingProjectAssetImportsBusy(false);
    }
  }, [dispatch, ensureCanvasMediaProject, result, showToast, state.logged]);

  useEffect(() => {
    if (!state.logged || result.browserQa) return undefined;
    const candidates = nodes.filter(node => {
      if (!['image', 'output', 'image-composer'].includes(node?.kind)) return false;
      if (!['ready', 'success'].includes(node?.status)) return false;
      if (node?.projectAssetId || node?.assetRef || node?.projectAssetRef) return false;
      return Boolean(generatedAssetIdFromUrl(node?.url));
    });
    if (!candidates.length) return undefined;

    const projectId = String(result.projectId || '').trim();
    const versionId = String(result.resultVersionId || result.sourceVersionId || '').trim();
    if (!projectId || !versionId) {
      if (!generatedProjectEnsureRef.current) {
        generatedProjectEnsureRef.current = ensureCanvasMediaProject('Canvas 图片创作项目', 'ecommerce')
          .catch(() => null)
          .finally(() => { generatedProjectEnsureRef.current = null; });
      }
      return undefined;
    }

    for (const node of candidates) {
      const assetId = generatedAssetIdFromUrl(node.url);
      const key = `${projectId}:${versionId}:${assetId}`;
      const existing = generatedAssetRegistrationRef.current.get(key);
      if (existing?.asset) {
        setNodes(previous => previous.map(candidate => candidate.url === node.url && !candidate.assetRef
          ? attachCanvasProjectAssetRef(candidate, existing.asset)
          : candidate));
        continue;
      }
      if (existing?.pending || existing?.queued) continue;
      generatedAssetRegistrationRef.current.set(key, { pending: true });
      void registerGeneratedAssetToProject(projectId, {
        versionId,
        assetId,
        stableUrl: node.url,
        role: node.role || 'canvas-output',
        metadata: {
          source: 'canvas',
          displayName: node.name || node.displayLabel || 'Canvas 图片',
        },
      }).then(asset => {
        generatedAssetRegistrationRef.current.set(key, { asset });
        setNodes(previous => previous.map(candidate => candidate.url === node.url && !candidate.assetRef
          ? attachCanvasProjectAssetRef(candidate, asset)
          : candidate));
      }).catch(() => {
        generatedAssetRegistrationRef.current.set(key, { queued: true });
        enqueuePendingProjectAssetImports([{
          operation: 'register-generated',
          kind: 'image',
          sourceAssetId: assetId,
          role: node.role || 'canvas-output',
          displayName: node.name || node.displayLabel || 'Canvas 图片',
          nodeIds: [node.id],
          asset: {
            assetId,
            url: node.url,
            stableUrl: node.url,
            name: node.name || node.displayLabel || 'Canvas 图片',
          },
        }]);
      });
    }
    return undefined;
  }, [enqueuePendingProjectAssetImports, ensureCanvasMediaProject, nodes, result.browserQa, result.projectId, result.resultVersionId, result.sourceVersionId, state.logged]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!hasCurrent) {
      setNodes([]);
      setConnections([]);
      return () => { cancelled = true; };
    }
    draftReadyRef.current = false;
    const videoAsset = canvasVideoAsset(result);
    const session = imageList.length > 0
      ? createFreshCanvasSession({
        work: result,
        productAssets: productAssetsForCanvas(result),
        outputs: imageList,
        mediaAssets: resultMediaAssets,
      })
      : resultMediaAssets.length
        ? createFreshCanvasSession({ work: result, mediaAssets: resultMediaAssets })
      : {
        nodes: createUploadedVideoNodes({
          assets: [videoAsset || {
            id: result.id || result.taskId || `video-${Date.now()}`,
            name: result.product_name || result.prompt || '视频作品',
            url: resultVideoUrl,
          }],
          x: 80,
          y: 80,
          now: Date.now(),
        }),
        connections: [],
      };
    const draftKey = canvasDraftKey(result);
    canvasSaveKeyRef.current = result.browserQa ? null : draftKey;
    const draft = result.browserQa ? null : loadCanvasDraft(draftKey);
    const initialSnapshot = draft ? restoreCanvasSnapshot(draft) : null;
    const newNodes = (initialSnapshot?.nodes?.length ? initialSnapshot.nodes : session.nodes).map(normalizeCanvasNode);
    setPendingProjectAssetImports(normalizePendingProjectAssetImports(initialSnapshot?.pendingProjectAssetImports));
    setNodes(newNodes);
    setConnections((initialSnapshot?.connections?.length ? initialSnapshot.connections : session.connections).map(normalizeCanvasConnection));
    // Keep-selection rebuild: re-entering the canvas replays this session
    // effect; dropping selection here unmounts the floating toolbars and
    // flashes their icons. Preserve only ids that survive the rebuild.
    const rebuiltNodeIds = new Set(newNodes.map(node => node.id));
    setSelected(previous => (previous && rebuiltNodeIds.has(previous)) ? previous : null);
    setMultiSelected(previous => {
      if (!previous.size) return previous;
      const next = new Set([...previous].filter(id => rebuiltNodeIds.has(id)));
      return next.size === previous.size ? previous : next;
    });
    setConnectionDraft(null);
    setConnectionPicker(null);
    const nextCanvasSession = result.canvasSession?.id
      ? result.canvasSession
      : result.canvasSessionId ? { id: result.canvasSessionId, revision: result.canvasSessionRevision || 1 } : null;
    if (remoteSaveTimerRef.current) clearTimeout(remoteSaveTimerRef.current);
    remoteSaveTimerRef.current = null;
    remoteSnapshotRef.current = '';
    canvasSessionRef.current = nextCanvasSession;
    setCanvasSession(nextCanvasSession);
    const mediaRefs = canvasMediaAssetRefs(newNodes);
    if (!result.browserQa && mediaRefs.length) {
      void Promise.all(mediaRefs.map(ref => getProjectAsset(ref.projectId, ref.projectAssetId).catch(() => null))).then(assets => {
        if (cancelled) return;
        const resolvedAssets = assets.filter(Boolean);
        setNodes(previous => restoreCanvasMediaPlayback(previous, resolvedAssets).map(normalizeCanvasNode));
      });
    }
    const persistedSessionId = result.canvasSession?.id || result.canvasSessionId;
    if (!draft && persistedSessionId) {
      void loadCanvasSession(persistedSessionId).then(remoteSession => {
        if (cancelled) return;
        const remoteSnapshot = restoreCanvasSnapshot(remoteSession.snapshot);
        setPendingProjectAssetImports(normalizePendingProjectAssetImports(remoteSnapshot.pendingProjectAssetImports));
        setNodes(remoteSnapshot.nodes.map(normalizeCanvasNode));
        setConnections(remoteSnapshot.connections.map(normalizeCanvasConnection));
        setViewport(remoteSnapshot.viewport);
        setCanvasSession(remoteSession);
        const remoteMediaRefs = canvasMediaAssetRefs(remoteSnapshot.nodes);
        if (remoteMediaRefs.length) {
          void Promise.all(remoteMediaRefs.map(ref => getProjectAsset(ref.projectId, ref.projectAssetId).catch(() => null)))
            .then(assets => {
              if (cancelled) return;
              const resolvedAssets = assets.filter(Boolean);
              setNodes(previous => restoreCanvasMediaPlayback(previous, resolvedAssets).map(normalizeCanvasNode));
            });
        }
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
  }, [result.id, result._saveKey]);

  useEffect(() => {
    if (!draftReadyRef.current || !canvasSaveKeyRef.current || ['drag', 'resize', 'layer-extract'].includes(pointerMode?.kind)) return undefined;
    const snapshot = createCanvasSnapshot({ nodes, connections, viewport, pendingProjectAssetImports });
    const timer = setTimeout(() => saveCanvasDraft(canvasSaveKeyRef.current, snapshot), 350);
    return () => clearTimeout(timer);
  }, [connections, nodes, pendingProjectAssetImports, pointerMode?.kind, viewport]);

  useEffect(() => {
    if (!draftReadyRef.current || result.browserQa || ['drag', 'resize', 'layer-extract'].includes(pointerMode?.kind)) return undefined;
    const fingerprint = canvasWorkOutputFingerprint(nodes);
    if (!fingerprint || fingerprint === workOutputFingerprintRef.current) return undefined;
    const baseImages = canvasOutputImages(result);
    const imageRecords = collectCanvasWorkImages({ baseImages, nodes });
    if (imageRecords.length <= baseImages.length) {
      workOutputFingerprintRef.current = fingerprint;
      return undefined;
    }
    const persistenceGeneration = canvasPersistenceGenerationRef.current;
    const timer = setTimeout(async () => {
      if (canvasPersistenceGenerationRef.current !== persistenceGeneration) return;
      canvasGeneratedWorkKeyRef.current ||= `canvas-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
      const workResult = {
        ...result,
        _saveKey: canvasGeneratedWorkKeyRef.current,
        product_name: result.product_name || '画布创作',
        workType: result.workType || 'ecommerce',
        images: imageRecords,
        imageRecords,
        ...canvasWorkMediaFields(result, nodes),
      };
      const saved = await saveWork(workResult, phone);
      if (!saved || canvasPersistenceGenerationRef.current !== persistenceGeneration) return;
      if (saved._saveKey) canvasGeneratedWorkKeyRef.current = saved._saveKey;
      workOutputFingerprintRef.current = fingerprint;
      setPastWorks(previous => normalizeCanvasWorkPanel({
        serverWorks: [workResult, ...previous],
        ownerEmail: phone,
      }));
    }, 900);
    return () => clearTimeout(timer);
  }, [canvasWorkMediaFields, nodes, phone, pointerMode?.kind, result]);

  useEffect(() => {
    canvasSessionRef.current = canvasSession;
  }, [canvasSession]);

  useEffect(() => {
    if (!draftReadyRef.current || canvasSessionBusy || ['drag', 'resize', 'layer-extract'].includes(pointerMode?.kind)) return undefined;
    const projectId = result.projectId;
    const baseVersionId = result.resultVersionId || result.sourceVersionId;
    if (!projectId || !baseVersionId) return undefined;
    const snapshot = createCanvasSnapshot({ nodes, connections, viewport, pendingProjectAssetImports });
    const fingerprint = JSON.stringify(snapshot);
    if (fingerprint === remoteSnapshotRef.current) return undefined;

    remoteSaveTimerRef.current = setTimeout(async () => {
      const persistenceGeneration = canvasPersistenceGenerationRef.current;
      setCanvasSessionBusy(true);
      try {
        const currentSession = canvasSessionRef.current;
        const session = currentSession?.id
          ? await saveCanvasSession(currentSession.id, { expectedRevision: currentSession.revision, snapshot })
          : await createCanvasSession({ projectId, baseVersionId, snapshot });
        if (canvasPersistenceGenerationRef.current !== persistenceGeneration) return;
        remoteSnapshotRef.current = fingerprint;
        canvasSessionRef.current = session;
        setCanvasSession(session);
        const saveKey = result._saveKey || canvasGeneratedWorkKeyRef.current;
        if (saveKey) {
          const workResult = {
            ...result,
            _saveKey: saveKey,
            imageRecords: collectCanvasWorkImages({ baseImages: canvasOutputImages(result), nodes }),
            ...canvasWorkMediaFields(result, nodes),
          };
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
  }, [canvasSessionBusy, canvasWorkMediaFields, connections, dispatch, nodes, pendingProjectAssetImports, phone, pointerMode?.kind, result, viewport]);

  useEffect(() => {
    cleanupLegacyCanvasStorage(localStorage);
  }, []);

  useEffect(() => {
    if (result.browserQa || globalThis.navigator?.connection?.saveData) return undefined;
    const controller = new AbortController();
    const prewarm = () => {
      void canvasSegmentationRuntime.prewarm({ signal: controller.signal }).catch(() => {});
    };
    const idleId = typeof globalThis.requestIdleCallback === 'function'
      ? globalThis.requestIdleCallback(prewarm, { timeout: 1800 })
      : globalThis.setTimeout(prewarm, 900);
    return () => {
      controller.abort();
      if (typeof globalThis.cancelIdleCallback === 'function') globalThis.cancelIdleCallback(idleId);
      else globalThis.clearTimeout(idleId);
    };
  }, [result.id, result.browserQa]);

  useEffect(() => () => {
    for (const controller of segmentationAbortRef.current.values()) controller.abort();
    segmentationAbortRef.current.clear();
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
    let cancelled = false;
    setWorksLoading(true);
    const load = async () => {
      try {
        if (result?.browserQa) {
          setPastWorks([]);
          setTrashWorks([]);
          return;
        }
        let localWorks = [];
        let serverWorks = [];
        try {
          const parsed = JSON.parse(localStorage.getItem('shubao_ec_works') || '[]');
          localWorks = Array.isArray(parsed) ? parsed.map(stripTransientWorkPlayback) : [];
        } catch {}
        const cachedWorks = loadCachedWorks(phone);
        if (!cancelled && cachedWorks.length) {
          setPastWorks(normalizeCanvasWorkPanel({ localWorks, serverWorks: cachedWorks, ownerEmail: phone }));
        }
        try {
          serverWorks = await loadWorks(phone);
        } catch {}
        if (cancelled) return;
        const localTrash = (() => {
          try {
            const parsed = JSON.parse(localStorage.getItem('shubao_ec_trash') || '[]');
            return Array.isArray(parsed) ? parsed.map(stripTransientWorkPlayback) : [];
          } catch { return []; }
        })();
        const serverTrash = await loadTrash(phone);
        if (cancelled) return;
        setPastWorks(normalizeCanvasWorkPanel({ localWorks, serverWorks, ownerEmail: phone }));
        setTrashWorks(normalizeCanvasWorkPanel({ localWorks: localTrash, serverWorks: serverTrash, ownerEmail: phone }));
      } finally {
        if (!cancelled) setWorksLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [phone, result?.browserQa]);

  useEffect(() => {
    if (tab !== 'assets' || !state.logged || result?.browserQa) {
      setProjectAssetLibrary([]);
      setSelectedProjectAssetKeys(new Set());
      setProjectAssetLibraryError('');
      setProjectAssetLibraryLoading(false);
      return undefined;
    }
    let cancelled = false;
    setProjectAssetLibrary([]);
    setSelectedProjectAssetKeys(new Set());
    setProjectAssetLibraryLoading(true);
    setProjectAssetLibraryError('');
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const library = await listProjectAssetLibrary({ mediaKind: projectAssetMediaFilter, query: projectAssetQuery, limit: 500 });
          if (cancelled) return;
          setProjectAssetLibrary(normalizeProjectAssetLibrary(library, { currentProjectId: result.projectId }));
        } catch (error) {
          if (cancelled) return;
          setProjectAssetLibrary([]);
          setProjectAssetLibraryError(error?.message || '项目素材暂时无法读取');
        } finally {
          if (!cancelled) setProjectAssetLibraryLoading(false);
        }
      })();
    }, 180);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [phone, projectAssetMediaFilter, projectAssetQuery, result?.browserQa, result?.projectId, state.logged, tab]);

  const visibleProjectAssetLibrary = useMemo(() => filterProjectAssetLibrary(projectAssetLibrary, {
    query: projectAssetQuery,
    retentionFilter: projectAssetRetentionFilter,
    productionFilter: projectAssetProductionFilter,
  }), [projectAssetLibrary, projectAssetProductionFilter, projectAssetQuery, projectAssetRetentionFilter]);
  useEffect(() => {
    setSelectedProjectAssetKeys(current => normalizeProjectAssetSelection(current, projectAssetLibrary));
  }, [projectAssetLibrary]);

  // B10: 全局键盘快捷键（使用 ref 避免循环依赖）
  // 注意：ref 初始值为空函数，在下面的 useEffect 中更新
  const handleDeleteRef = useRef(() => {});
  const fitViewRef = useRef(() => {});
  const handleAddTextRef = useRef(() => {});

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
        setEditingTextNodeId(null);
        setSelected(null);
        setMultiSelected(new Set());
        return;
      }
      // 只在画布 tab 处理
      if (tab !== 'canvas') return;
      // T: 创建普通可编辑文本对象；输入框和 contenteditable 内不抢快捷键
      if (!isTyping && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleAddTextRef.current?.();
        return;
      }
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
    setPointerMode(previous => ['drag', 'layer-extract'].includes(previous?.kind) ? { ...previous, start: pending.point } : previous);
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
      tool: activeTool,
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
      setPointerMode({ kind: 'marquee', start: point, additive: e.shiftKey || e.ctrlKey || e.metaKey });
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
      setMarquee({
        x: Math.min(pointerMode.start.x, point.x),
        y: Math.min(pointerMode.start.y, point.y),
        w: Math.abs(point.x - pointerMode.start.x),
        h: Math.abs(point.y - pointerMode.start.y),
      });
      return;
    }
    if (pointerMode.kind === 'resize') {
      const dx = (e.clientX - pointerMode.startX) / Math.max(0.01, viewport.scale);
      const dy = (e.clientY - pointerMode.startY) / Math.max(0.01, viewport.scale);
      const resized = resizeCanvasNodeByHandle(pointerMode.original, {
        handle: pointerMode.handle,
        dx,
        dy,
        preserveAspect: pointerMode.preserveAspect,
      });
      setNodes(previous => previous.map(node => node.id === pointerMode.nodeId ? resized : node));
      return;
    }
    if (pointerMode.kind === 'layer-extract') {
      const point = toWorldPoint(e);
      if (Math.hypot(point.x - pointerMode.start.x, point.y - pointerMode.start.y) <= 2) return;
      setNodes(previous => expandCanvasLayerGroup(previous, pointerMode.sourceNodeId));
      setSelected(pointerMode.targetNodeId);
      setMultiSelected(new Set([pointerMode.targetNodeId]));
      pendingDragRef.current = { ids: new Set([pointerMode.targetNodeId]), start: pointerMode.start, point };
      if (!dragFrameRef.current) dragFrameRef.current = requestAnimationFrame(flushDragFrame);
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

  const openImagePreview = useCallback((image) => {
    setPreviewScale(1);
    setZoomImg(image);
  }, []);

  const closeImagePreview = useCallback(() => {
    setZoomImg(null);
    setPreviewScale(1);
  }, []);

  const handlePreviewWheel = useCallback((e) => {
    e.preventDefault();
    setPreviewScale(scale => zoomPreviewByWheel(scale, e.deltaY));
  }, []);

  useEffect(() => bindNonPassiveWheel(previewDialogRef.current, handlePreviewWheel), [handlePreviewWheel, zoomImg]);

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

  const openConnectionPickerForNode = useCallback(node => {
    if (!canDeriveFromNode(node)) return;
    setConnectionPicker({
      sourceNodeId: node.id,
      world: {
        x: Number(node.x) + Number(node.w) + 42,
        y: Number(node.y) + Number(node.h) / 2,
      },
    });
    setConnectionDraft(null);
  }, []);

  // 节点点击：Ctrl/Cmd 切换多选，拖动已选节点会批量移动
  const handleNodeDown = useCallback((e, id) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setEditingTextNodeId(null);
    setContextMenu(null);
    setConnectionPicker(null);
    setAddMenuOpen(false);
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      setMultiSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
      return next;
      });
      setSelected(null);
      return;
    }
    if (getNodePointerIntent({ tool: activeTool, button: e.button }) === 'select') {
      setSelected(id);
      setMultiSelected(new Set([id]));
      const node = nodes.find(item => item.id === id);
      if (node && ['image', 'output'].includes(node.kind)) openConnectionPickerForNode(node);
      return;
    }
    const baseIds = multiSelected.has(id) ? multiSelected : new Set([id]);
    const activeNode = nodes.find(node => node.id === id);
    if (activeNode?.kind === 'layer-group') {
      const point = toWorldPoint(e);
      const targetLayer = pickCanvasLayerAtPoint(nodes, id, point);
      if (targetLayer) {
        setSelected(id);
        setMultiSelected(new Set([id]));
        setPointerMode({ kind: 'layer-extract', sourceNodeId: id, targetNodeId: targetLayer.id, start: point });
        try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
        return;
      }
    }
    const ids = expandCanvasDragSelection(nodes, id, baseIds);
    setSelected(ids.size === 1 ? id : null);
    setMultiSelected(ids);
    setPointerMode({ kind: 'drag', ids, start: toWorldPoint(e) });
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
  }, [activeTool, multiSelected, nodes, openConnectionPickerForNode, toWorldPoint]);

  const handleNodeResizeStart = useCallback((event, nodeId, handle) => {
    const node = nodes.find(candidate => candidate.id === nodeId);
    if (!node || node.locked || event.button !== 0) return;
    setEditingTextNodeId(null);
    setSelected(nodeId);
    setMultiSelected(new Set([nodeId]));
    setPointerMode({
      kind: 'resize',
      nodeId,
      handle,
      startX: event.clientX,
      startY: event.clientY,
      original: { ...node },
      // Completed image assets keep their pixel ratio; generation boards and
      // editable text/suite nodes are layout objects and stay freely resizable.
      preserveAspect: ['image', 'output'].includes(node.kind),
    });
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch {}
  }, [nodes]);

  const handleImageNaturalSize = useCallback((nodeId, { naturalWidth, naturalHeight }) => {
    setNodes(previous => previous.map(node => {
      if (node.id !== nodeId || naturalWidth <= 0 || naturalHeight <= 0) return node;
      if (node.naturalWidth === naturalWidth && node.naturalHeight === naturalHeight) return node;
      const width = Math.max(1, Number(node.w) || 240);
      const height = Math.max(1, Math.round(width * naturalHeight / naturalWidth));
      return {
        ...node,
        h: height,
        ratio: `${naturalWidth}:${naturalHeight}`,
        size: `${naturalWidth}×${naturalHeight}`,
        naturalWidth,
        naturalHeight,
      };
    }));
  }, []);

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

  const handlePortClick = useCallback((event, nodeId) => {
    const source = nodes.find(node => node.id === nodeId);
    if (!canDeriveFromNode(source)) return;
    setConnectionPicker({
      sourceNodeId: nodeId,
      world: toWorldPoint(event),
    });
    setConnectionDraft(null);
    setPointerMode(null);
  }, [nodes, toWorldPoint]);

  const handlePortPointerUp = useCallback((e, nodeId, side) => {
    const sourceNodeId = connectionDraft?.sourceNodeId || connectionDraft?.from;
    if (side !== 'in' || !sourceNodeId || sourceNodeId === nodeId) return;
    setConnections(prev => addConnection(prev, sourceNodeId, nodeId, connectionDraft.type));
    setConnectionDraft(null);
    setConnectionPicker(null);
    setPointerMode(null);
    showToast('已建立素材关系', 'success');
  }, [connectionDraft, showToast]);

  const executeBrowserSegmentation = useCallback(async ({
    source,
    action,
    placement = {},
    replaceNodeId = '',
    workflowNodeId = '',
  }) => {
    const sourceUrl = source?.url || source?.assets?.find(asset => asset?.url)?.url || '';
    if (!source?.id || !sourceUrl) throw new Error('源图片暂不可用');
    const jobId = `canvas-segmentation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const controller = new AbortController();
    segmentationAbortRef.current.set(jobId, controller);
    let currentProgress = reduceSegmentationProgress(null, { stage: 'preparing' });
    const updateProgress = event => {
      currentProgress = reduceSegmentationProgress(currentProgress, event);
      const progress = currentProgress;
      if (workflowNodeId) {
        setNodes(previous => previous.map(node => node.id === workflowNodeId
          ? { ...node, status: 'processing', progress: progress.percent, progressLabel: progress.detail || progress.label || '正在处理图片' }
          : node));
      }
    };
    try {
      if (canvasSegmentationRuntime.isWarm()) updateProgress({ stage: 'detecting' });
      const planRequest = createCanvasSegmentationPlan(sourceUrl, { signal: controller.signal });
      const warmRequest = canvasSegmentationRuntime.prewarm({
        signal: controller.signal,
        onProgress: updateProgress,
      });
      const [plan] = await Promise.all([planRequest, warmRequest]);
      updateProgress({ stage: 'detecting' });
      const workerMasks = await canvasSegmentationRuntime.segment({
        imageUrl: proxyImg(sourceUrl),
        prompts: plan.prompts,
        signal: controller.signal,
        onProgress: updateProgress,
      });
      updateProgress({ stage: 'materializing' });
      const masks = await segmentationMasksToApi(workerMasks);
      const data = action === 'smart-layer'
        ? await analyzeCanvasLayers(sourceUrl, { planToken: plan.plan_token, masks, signal: controller.signal })
        : await removeBg({
          image_url: sourceUrl,
          segmentation_plan_token: plan.plan_token,
          segmentation_masks: masks,
          signal: controller.signal,
        });
      updateProgress({ stage: 'complete' });
      return data;
    } catch (error) {
      throw error;
    } finally {
      segmentationAbortRef.current.delete(jobId);
    }
  }, []);

  const handleSmartLayerMaterialization = useCallback(async (source, anchor = {}, { replaceNodeId = '' } = {}) => {
    const sourceUrl = source?.url || source?.assets?.find(asset => asset?.url)?.url || '';
    if (!source?.id || !sourceUrl || promptLoading) return;
    const pendingId = replaceNodeId || `layer_group_pending_${Date.now()}`;
    const pendingNode = {
      id: pendingId,
      kind: 'layer-group',
      status: 'processing',
      progressLabel: '正在识别商品、背景和文字',
      x: Number.isFinite(anchor.x) ? anchor.x : source.x,
      y: Number.isFinite(anchor.y) ? anchor.y : source.y,
      w: Math.max(220, source.w || 240),
      h: Math.max(120, source.h || 240),
      ratio: source.ratio || '1:1',
      sourceNodeIds: [source.id],
      actionId: 'layer-edit',
      layerExpanded: false,
      layerChildIds: [],
      showMeta: false,
    };
    setConnectionDraft(null);
    setConnectionPicker(null);
    setPointerMode(null);
    setPromptLoading(true);
    setNodes(previous => [...previous.filter(node => node.id !== pendingId), pendingNode]);
    setConnections(previous => [...removeConnectionsForNodes(previous, new Set([pendingId])), createChildConnection(source.id, pendingId, 'layer-edit')]);
    setSelected(pendingId);
    setMultiSelected(new Set([pendingId]));
    try {
      const data = await executeBrowserSegmentation({
        source,
        action: 'smart-layer',
        placement: anchor,
        replaceNodeId,
        workflowNodeId: pendingId,
      });
      const result = materializeCanvasLayers({
        sourceNode: source,
        layers: data.layers,
        anchor,
        runId: createCanvasGenerationRunId(),
      });
      const groupNode = {
        ...result.groupNode,
        layerStatus: data.status || 'complete',
        layerCapabilities: data.capabilities || {},
      };
      setNodes(previous => replaceCanvasNodeWithLayerResult({
        nodes: previous,
        sourceNodeId: result.replacedSourceNodeId,
        pendingNodeId: pendingId,
        groupNode,
        childNodes: result.nodes,
      }).nodes);
      setConnections(previous => replaceCanvasNodeWithLayerResult({
        connections: previous,
        sourceNodeId: result.replacedSourceNodeId,
        pendingNodeId: pendingId,
        groupNode,
        resultConnections: result.connections,
      }).connections);
      const groupNodeId = result.groupNode.id;
      setSelected(groupNodeId);
      setMultiSelected(new Set([groupNodeId]));
      const warning = Array.isArray(data.warnings) && data.warnings.length
        ? `；${data.warnings.join('、')}`
        : '';
      showToast(`已生成 ${result.nodes.length} 个可独立拖动图层${warning}`, data.status === 'partial' ? 'info' : 'success');
    } catch (error) {
      setNodes(previous => previous.filter(node => node.id !== pendingId));
      setConnections(previous => removeConnectionsForNodes(previous, new Set([pendingId])));
      if (error?.name !== 'AbortError') handleCanvasActionError(error, { type: 'layer-edit', nodeId: source.id });
    } finally {
      setPromptLoading(false);
    }
  }, [executeBrowserSegmentation, handleCanvasActionError, promptLoading, showToast]);

  const handleDirectRemoveBackground = useCallback(async (source, placement = {}) => {
    if (!source?.url || promptLoading) return;
    const pendingId = `remove_bg_pending_${Date.now()}`;
    const pendingNode = {
      id: pendingId,
      kind: 'layer-group',
      status: 'processing',
      progressLabel: '正在识别商品主体',
      x: Number.isFinite(placement.x) ? placement.x : source.x + source.w + GAP * 2,
      y: Number.isFinite(placement.y) ? placement.y : source.y,
      w: Math.max(220, source.w || 240),
      h: Math.max(120, source.h || 240),
      ratio: source.ratio || '1:1',
      sourceNodeIds: [source.id],
      actionId: 'remove-bg',
      showMeta: false,
    };
    setPromptLoading(true);
    setNodes(previous => [...previous, pendingNode]);
    setConnections(previous => [...previous, createChildConnection(source.id, pendingId, 'remove-bg')]);
    setSelected(pendingId);
    setMultiSelected(new Set([pendingId]));
    try {
      const data = await executeBrowserSegmentation({ source, action: 'remove-bg', placement, workflowNodeId: pendingId });
      const resultUrl = data.result_url || data.url;
      if (!resultUrl) throw new Error(data.error || '去背结果为空');
      const output = normalizeCanvasNode({
        ...source,
        id: `node_remove_bg_${Date.now()}`,
        kind: 'image',
        status: 'ready',
        url: resultUrl,
        ...canvasImageResultGeometry(data, source),
        x: Number.isFinite(placement.x) ? placement.x : source.x + source.w + GAP * 2,
        y: Number.isFinite(placement.y) ? placement.y : source.y,
        name: '',
        displayLabel: '',
        sourceNodeIds: [source.id],
        showMeta: false,
      });
      setNodes(previous => [...previous.filter(node => node.id !== pendingId), output]);
      setConnections(previous => [...removeConnectionsForNodes(previous, new Set([pendingId])), createChildConnection(source.id, output.id, 'remove-bg-output')]);
      setSelected(output.id);
      setMultiSelected(new Set([output.id]));
      showToast('去背完成，已生成可继续编辑的透明底图片', 'success');
    } catch (error) {
      setNodes(previous => previous.filter(node => node.id !== pendingId));
      setConnections(previous => removeConnectionsForNodes(previous, new Set([pendingId])));
      if (error?.name !== 'AbortError') handleCanvasActionError(error, { type: 'remove-bg', nodeId: source.id });
    } finally {
      setPromptLoading(false);
    }
  }, [executeBrowserSegmentation, handleCanvasActionError, promptLoading, showToast]);

  const handleCreateDerivedNode = useCallback((sourceNodeId, action, world, initialInputs = {}) => {
    const source = nodes.find(node => node.id === sourceNodeId);
    const actionSpec = getCanvasAction(action?.id || action);
    if (!source || !actionSpec?.execute?.nodeKind || !canDeriveFromNode(source)) return;
    const sourceUrl = source.url || source.assets?.find(asset => asset?.url)?.url || null;
    const nodeActionId = actionSpec.execute.nodeActionId;
    if (nodeActionId === 'remove-bg') {
      void handleDirectRemoveBackground({ ...source, url: sourceUrl }, world);
      return;
    }
    if (nodeActionId === 'layer-edit') {
      void handleSmartLayerMaterialization({ ...source, url: sourceUrl }, world);
      return;
    }
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
  }, [handleSmartLayerMaterialization, nodes, showToast]);

  const updateWorkflowNode = useCallback((nodeId, patch) => {
    setNodes(prev => prev.map(node => node.id === nodeId ? { ...node, ...patch } : node));
  }, []);

  const updateWorkflowInputs = useCallback((nodeId, patch) => {
    setNodes(prev => prev.map(node => node.id === nodeId ? { ...node, inputs: { ...(node.inputs || {}), ...patch } } : node));
  }, []);

  const handleWorkflowGenerate = useCallback(async (node) => {
    const source = nodes.find(item => item.id === node.sourceNodeIds?.[0]);
    const sourceUrl = node.inputs?.sourceUrl || source?.url || source?.assets?.find(asset => asset?.url)?.url || '';
    const prompt = String(node.inputs?.prompt || '').trim();
    if (!sourceUrl || !prompt || promptLoading) {
      showToast('请先补充可编辑的画面描述', 'info');
      return;
    }
    const generationRunId = String(node.inputs?.generationRunId || createCanvasGenerationRunId());
    updateWorkflowNode(node.id, {
      status: 'running',
      error: null,
      inputs: { ...(node.inputs || {}), generationRunId },
    });
    setPromptLoading(true);
    try {
      const count = Math.max(1, Math.min(4, Number(node.inputs?.outputCount) || 1));
      const requestedOutputIndexes = Array.isArray(node.inputs?.pendingOutputIndexes)
        ? [...new Set(node.inputs.pendingOutputIndexes.filter(index => Number.isInteger(index) && index >= 0 && index < count))]
        : [];
      const pendingOutputIndexes = requestedOutputIndexes.length
        ? requestedOutputIndexes
        : Array.from({ length: count }, (_, index) => index);
      const referenceImages = [
        ...(node.inputs?.productImages || []),
        ...(node.inputs?.referenceImages || []),
      ].map(image => image?.url || image?.src || image?.image_url).filter(Boolean);
      const settled = await Promise.allSettled(pendingOutputIndexes.map(index => regenerateCanvasImage({
        prompt,
        imageUrl: sourceUrl,
        referenceImages,
        ratio: node.inputs?.ratio || source.ratio,
        resolution: node.inputs?.resolution || source.resolution || '2K',
        imageModel: node.inputs?.imageModel || source.imageModel || 'image2',
        requestKey: `${generationRunId}:${index + 1}`,
      })));
      const successful = settled.flatMap((result, resultIndex) => result.status === 'fulfilled'
        ? [{ index: pendingOutputIndexes[resultIndex], url: result.value }]
        : []);
      const failed = settled.flatMap((result, resultIndex) => result.status === 'rejected'
        ? [{ index: pendingOutputIndexes[resultIndex], error: result.reason }]
        : []);
      const outputs = successful.map(({ index, url }) => normalizeCanvasNode({
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
      const previousOutput = node.output || {};
      const outputNodeIds = [...new Set([...(previousOutput.nodeIds || []), ...outputs.map(output => output.id)])];
      const remainingIndexes = failed.map(item => item.index);
      setNodes(prev => prev.map(item => item.id === node.id ? {
        ...item,
        status: remainingIndexes.length ? 'error' : 'success',
        error: remainingIndexes.length ? (failed[0]?.error?.message || '部分图片生成失败，请重试失败项') : null,
        inputs: { ...(item.inputs || {}), generationRunId: remainingIndexes.length ? generationRunId : null, pendingOutputIndexes: remainingIndexes },
        output: { nodeIds: outputNodeIds, urls: [...(previousOutput.urls || []), ...outputs.map(output => output.url)] },
      } : item).concat(outputs));
      setConnections(prev => outputs.reduce((edges, output) => [...edges, createChildConnection(node.id, output.id, 'smart-remix-output')], prev));
      if (outputs.length) {
        setSelected(outputs[0].id);
        setMultiSelected(new Set(outputs.map(output => output.id)));
      }
      if (remainingIndexes.length) {
        handleCanvasActionError(failed[0]?.error || new Error('部分图片生成失败，请重试失败项'), { type: 'smart-remix', nodeId: node.id });
        showToast(`已生成 ${outputs.length} 张，${remainingIndexes.length} 张失败，可只重试失败项`, 'info');
      } else {
        showToast(`已生成 ${outputs.length} 张新的电商图`, 'success');
      }
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
      if (String(node.inputs?.prompt || '').trim()) {
        void handleWorkflowGenerate({ ...node, status: 'draft', error: null });
        return;
      }
      updateWorkflowNode(node.id, { status: 'analyzing' });
      reversePrompt({ image_url: sourceUrl, product_name: source.name || source.displayLabel || '电商图片' })
        .then(data => updateWorkflowNode(node.id, { status: 'ready', inputs: { ...(node.inputs || {}), prompt: data.prompt || '' } }))
        .catch(error => updateWorkflowNode(node.id, { status: 'error', error: error.message || '画面描述生成失败' }));
    } else if (node.actionId === 'layer-edit') {
      void handleSmartLayerMaterialization(source, { x: node.x, y: node.y }, { replaceNodeId: node.id });
    } else {
      void workflowProcessRef.current?.({ ...node, status: 'draft', error: null });
    }
  }, [handleSmartLayerMaterialization, handleWorkflowGenerate, nodes, updateWorkflowNode]);

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
      const assets = await uploadEcommerceAssets(dataUrls, 'reference');
      const images = assets.map((asset, index) => ({ ...asset, id: `workflow_ref_${Date.now()}_${index}`, name: files[index]?.name || '追加素材' }));
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
      const prompt = String(node.inputs?.prompt || '').trim();
      let url = '';
      let resultGeometry = {};
      if (actionId === 'remove-bg') {
        const data = await executeBrowserSegmentation({
          source: { ...source, url: sourceUrl },
          action: 'remove-bg',
          placement: { x: node.x + node.w + GAP * 2, y: node.y },
          workflowNodeId: node.id,
        });
        url = data.result_url || data.url || '';
        resultGeometry = canvasImageResultGeometry(data, source);
      } else if (actionId === 'inpaint') {
        url = await regenerateCanvasImage({ prompt, imageUrl: sourceUrl, ratio: node.inputs?.ratio || source.ratio, resolution: node.inputs?.resolution || source.resolution || '2K', imageModel: node.inputs?.imageModel || source.imageModel || 'image2' });
      } else {
        const data = await transformCanvasImage({ action: actionId, prompt, imageUrl: sourceUrl, ratio: node.inputs?.ratio || source.ratio, resolution: node.inputs?.resolution || source.resolution || '2K', imageModel: node.inputs?.imageModel || source.imageModel || 'image2' });
        url = data.url || data.result_url || '';
      }
      if (!url) throw new Error('处理结果为空');
      const output = normalizeCanvasNode({
        ...source,
        id: `node_output_${Date.now()}`,
        kind: 'image',
        status: 'ready',
        url,
        ...resultGeometry,
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
  }, [executeBrowserSegmentation, nodes, promptLoading, showToast, updateWorkflowNode, handleCanvasActionError]);

  useEffect(() => {
    workflowProcessRef.current = handleWorkflowProcess;
  }, [handleWorkflowProcess]);

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

  const handleWorkflowLayerAddToCanvas = useCallback((node, layer) => {
    const url = layer?.url || layer?.preview_url;
    if (!url) {
      showToast('这一层没有可编辑的像素资源', 'info');
      return;
    }
    const output = normalizeCanvasNode({
      id: `node_layer_${Date.now()}`,
      kind: 'image',
      status: 'ready',
      url,
      x: node.x + node.w + GAP * 2,
      y: node.y,
      w: 220,
      h: 220,
      ratio: '1:1',
      name: layer.name || '独立图层',
      displayLabel: layer.name || '独立图层',
      sourceNodeIds: [node.id],
      group: '素材',
      showMeta: false,
      layerRole: /背景|底色|氛围/.test(String(layer.name || '')) ? 'background' : 'foreground',
      zIndex: /背景|底色|氛围/.test(String(layer.name || '')) ? 10 : 20,
    });
    setNodes(previous => [...previous, output]);
    setConnections(previous => [...previous, createChildConnection(node.id, output.id, 'layer-output')]);
    setSelected(output.id);
    setMultiSelected(new Set([output.id]));
    showToast(`${layer.name || '图层'}已放到画布，可单独移动`, 'success');
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
      setExportSelectionIds(new Set([n.id]));
      setExportMode('images');
      setExportIntent('single');
      setExportOpen(true);
    }
  };

  const handleMultiDownload = () => {
    setExportSelectionIds(new Set(multiSelected));
    setExportMode('images');
    setExportIntent('selection');
    setExportOpen(true);
  };

  // A6: 右键菜单动作
  const handleContextAction = async (action, node) => {
    if (action?.startsWith('create:')) {
      const actionId = action.slice('create:'.length);
      const source = nodes.find(item => item.id === node?.id) || node;
      if (!canDeriveFromNode(source)) {
        showToast('完成当前处理后，可从生成结果继续派生', 'info');
        return;
      }
      const actionSpec = getCanvasAction(actionId);
      if (!actionSpec) return;
      handleCreateDerivedNode(source.id, actionSpec, {
        x: source.x + source.w + GAP * 2,
        y: source.y,
      });
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
        await handleDirectRemoveBackground(node, { x: node.x + node.w + GAP * 2, y: node.y });
        break;
      case 'reverse-prompt':
        await handleToolAction('reverse-prompt', node);
        break;
      case 'copy-url':
        navigator.clipboard?.writeText(node.url);
        showToast('链接已复制', 'success');
        break;
      case 'delete':
        removeCanvasNode(node.id);
        break;
      default:
        // 裁切、宫格切图、卖点标注、引用生成等统一复用顶部工具条的真实处理链路。
        await handleToolAction(action, node);
        break;
    }
  };

  const handleRecognizeCanvasText = useCallback(async (node) => {
    if (!node?.url || textOcrLoading) return;
    const cachedBlocks = readCanvasTextRecognitionCache(textOcrCacheRef.current, node);
    if (cachedBlocks !== undefined) {
      setTextOcrBlocks(cachedBlocks);
      setTextCompositionError(cachedBlocks.length ? '' : '没有识别到图片内文字');
      return;
    }
    setTextOcrLoading(true);
    setTextCompositionError('');
    try {
      const response = await recognizeCanvasText({ image_url: node.url });
      const blocks = Array.isArray(response.blocks) ? response.blocks : [];
      writeCanvasTextRecognitionCache(textOcrCacheRef.current, node, blocks);
      setTextOcrBlocks(blocks);
      if (!blocks.length) setTextCompositionError('没有识别到图片内文字');
    } catch (error) {
      setTextOcrBlocks([]);
      setTextCompositionError(error?.message || '图片文字识别失败');
    } finally {
      setTextOcrLoading(false);
    }
  }, [textOcrLoading]);

  const handleToolAction = async (action, node) => {
    if (!node) return;
    const actionSpec = getCanvasAction(action?.id || action);
    const actionId = actionSpec?.id || String(action || '');
    const handler = actionSpec?.execute?.handler || actionId;
    if (handler === 'edit-text') {
      setTextInspectorNodeId(node.id);
      const cachedBlocks = node.kind === 'image' || node.kind === 'output'
        ? readCanvasTextRecognitionCache(textOcrCacheRef.current, node)
        : undefined;
      setTextOcrBlocks(cachedBlocks === undefined ? null : cachedBlocks);
      setTextCompositionError('');
      if ((node.kind === 'image' || node.kind === 'output') && cachedBlocks === undefined) void handleRecognizeCanvasText(node);
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
              : { moveStage: 'drawing', sourceRect: null, targetRect: null, rotation: 0 },
      });
      return;
    }
    if (handler.startsWith('create:')) {
      if (actionSpec) handleCreateDerivedNode(node.id, actionSpec, { x: node.x + node.w + GAP * 2, y: node.y });
      return;
    }
    if (handler === 'add-text') {
      // 添加文字：复用 handleAddTextNode 在选中图片右侧落一个真实可编辑文本节点。
      handleAddTextNode({ x: node.x + node.w + 28, y: node.y });
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
        const url = await regenerateCanvasImage({ prompt, imageUrl: node.url, ratio: node.ratio, resolution: node.resolution || '2K', imageModel: node.imageModel || 'image2' });
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
      const textNode = createCanvasTextComposerNode({ x: node.x + node.w + 56, y: node.y, sourceNodeId: node.id });
      textNode.status = 'processing';
      textNode.text = '正在分析画面内容...';
      setNodes(previous => [...previous, textNode]);
      setConnections(previous => addConnection(previous, node.id, textNode.id, 'derived'));
      setSelected(textNode.id);
      setMultiSelected(new Set([textNode.id]));
      try {
        const data = await reversePrompt({ image_url: node.url, product_name: node.name || node.displayLabel || node.label });
        if (!data.prompt) throw new Error('未得到可编辑的提示词');
        setNodes(previous => previous.map(item => item.id === textNode.id ? {
          ...item,
          status: 'ready',
          text: data.prompt,
          prompt: '',
          name: '画面提示词',
        } : item));
      } catch (error) {
        setNodes(previous => previous.map(item => item.id === textNode.id ? { ...item, status: 'error', text: '画面分析暂时不可用，请稍后重试' } : item));
        handleCanvasActionError(error, { type: 'reverse-prompt', nodeId: node.id });
      }
      return;
    }
    if (handler === 'grid-split') {
      setPromptLoading(true);
      try {
        const data = await transformCanvasImage({ action: actionId, imageUrl: node.url, resolution: node.resolution || '2K', imageModel: node.imageModel || 'image2' });
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
      await handleSmartLayerMaterialization(node, { x: node.x, y: node.y });
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
    if (!focusedEditor || promptLoading) return;
    const source = nodes.find(node => node.id === focusedEditor.nodeId);
    if (!source) {
      setFocusedEditor(null);
      return;
    }
    if (focusedEditor.mode === 'move-scale') {
      const { sourceRect, targetRect } = focusedEditor.options || {};
      if (!sourceRect || !targetRect || sourceRect.w < 0.03 || sourceRect.h < 0.03 || targetRect.w < 0.03 || targetRect.h < 0.03) {
        showToast('请先框选对象，并确认它的新位置和大小', 'info');
        return;
      }
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
        gridVertical: options.gridVertical,
        gridHorizontal: options.gridHorizontal,
        sourceBox: options.sourceRect,
        targetBox: options.targetRect,
        rotation: options.rotation,
      });
      const urls = [response?.url, ...(response?.urls || []).map(item => typeof item === 'string' ? item : item?.url)].filter(Boolean);
      if (!urls.length) throw new Error('图片处理没有返回结果');
      if (!nodesRef.current.some(node => node.id === source.id)) {
        setFocusedEditor(null);
        return;
      }
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
          showMeta: false,
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
      handleMultiDownload();
      return;
    }
    if (actionId === 'stitch-details') {
      setExportSelectionIds(new Set(multiSelected));
      setExportMode('long-detail');
      setExportFormat('JPG');
      setExportIntent('long-detail');
      setExportOpen(true);
      return;
    }
    if (actionId === 'bind-elements' || actionId === 'group-elements') {
      const groupId = `group_${Date.now()}`;
      setNodes(previous => previous.map(node => multiSelected.has(node.id) ? { ...node, groupId, bound: actionId === 'bind-elements' } : node));
      showToast(actionId === 'bind-elements' ? '所选对象已绑定' : '所选对象已打组', 'success');
    }
  };

  const configureExport = (nextMode, nextFormat) => {
    const resolvedFormat = nextFormat || (nextMode === 'long-detail' ? 'JPG' : 'PNG');
    setExportMode(nextMode);
    setExportFormat(resolvedFormat);
    composedLongExportRef.current = null;
    dispatchExportDelivery({ type: 'configure', config: { mode: nextMode, format: resolvedFormat } });
  };

  const handleChooseExportDestination = async () => {
    const { deliverables: exportNodes, excludedSources } = exportScope;
    if (!exportNodes.length) {
      showToast(excludedSources.length ? '所选内容只有原始素材，请选择生成结果' : '没有可交付的生成图片', 'info');
      return;
    }
    try {
      const longDetail = exportMode === 'long-detail';
      const single = !longDetail && exportNodes.length === 1;
      const destination = await chooseDeliveryDestination({
        mode: longDetail ? 'long-detail' : single ? 'single' : 'images',
        fileCount: longDetail ? 1 : exportNodes.length,
        format: exportFormat,
        productName: result.product_name || '商品',
        filename: single ? safeDeliveryName(exportNodes[0].name || exportNodes[0].id, exportFormat) : undefined,
      });
      if (destination.cancelled) {
        dispatchExportDelivery({ type: 'cancelled' });
        return;
      }
      dispatchExportDelivery({ type: 'destination-ready', destination });
    } catch (error) {
      dispatchExportDelivery({ type: 'error', error: error.message || '无法选择保存位置' });
    }
  };

  const handleStartExport = async () => {
    const { deliverables: exportNodes, excludedSources } = exportScope;
    if (!exportDelivery.destination) {
      dispatchExportDelivery({ type: 'error', error: '请先选择保存位置' });
      return;
    }
    try {
      const longDetail = exportMode === 'long-detail';
      dispatchExportDelivery({ type: 'preparing', total: longDetail ? 1 : exportNodes.length });
      let deliveryItems = exportNodes;
      if (longDetail) {
        const detailNodes = orderedDetailNodes.length ? orderedDetailNodes : orderDetailNodes(exportNodes);
        if (detailNodes.length < 2) throw new Error('请至少选择 2 张详情图再合并');
        if (!composedLongExportRef.current) {
          const data = await stitchLongImage(
            detailNodes.map(node => node.url),
            exportFormat.toLowerCase(),
            detailNodes.map(node => node.id),
          );
          if (!data.url) throw new Error('详情长图合成失败');
          const createdAt = Date.now();
          const counter = nodes.filter(node => node.role === '详情长图').length + 1;
          const longName = `详情长图-${String(counter).padStart(2, '0')}`;
          const displayWidth = 240;
          const displayHeight = Math.round(displayWidth * ((data.height || 1200) / (data.width || 800)));
          const placement = placeDerivedRightOfSources({
            sources: detailNodes,
            occupied: nodes,
            width: displayWidth,
            height: displayHeight,
            gap: 80,
          });
          const merged = {
            ...normalizeAsset({
              id: `node_long_${createdAt}`,
              assetId: `asset_long_${createdAt}`,
              url: data.url,
              sourceKey: 'detail_long',
              name: longName,
              group: '详情图',
              role: '详情长图',
              ratio: '长图',
              w: displayWidth,
              h: displayHeight,
              ...placement,
            }, nodes.length),
            kind: 'image',
            status: 'ready',
            provenance: 'derived',
            derivedFromIds: data.sourceIds?.length ? data.sourceIds : detailNodes.map(node => node.id),
            sourceNodeIds: data.sourceIds?.length ? data.sourceIds : detailNodes.map(node => node.id),
            sequence: detailNodes.length + 1,
          };
          composedLongExportRef.current = merged;
          setNodes(previous => [...previous, merged]);
          setConnections(previous => detailNodes.reduce((current, source) => addConnection(current, source.id, merged.id, 'long-detail'), previous));
          setSelected(merged.id);
          setMultiSelected(new Set([merged.id]));
        }
        deliveryItems = [{
          id: composedLongExportRef.current.id,
          url: composedLongExportRef.current.url,
          name: `${result.product_name || '商品'}-详情长图`,
          format: exportFormat,
        }];
      }
      const prepared = await prepareImageDeliverables(deliveryItems, {
        format: exportFormat,
        proxyUrl: proxyImg,
        onProgress: progress => dispatchExportDelivery({ type: 'progress', ...progress }),
      });
      dispatchExportDelivery({ type: 'writing', total: prepared.length });
      const saved = await writePreparedDeliverables(exportDelivery.destination, prepared, {
        onProgress: progress => dispatchExportDelivery({ type: 'progress', ...progress }),
      });
      dispatchExportDelivery({ type: 'success', count: saved.count, verification: saved.verification });
      const verified = saved.verification === 'filesystem';
      showToast(longDetail
        ? (verified ? '详情长图已加入画布，并已验证写入' : '详情长图已加入画布，已开始下载')
        : (verified
          ? `已验证写入 ${saved.count} 张生成图片${excludedSources.length ? `，已排除 ${excludedSources.length} 张原始素材` : ''}`
          : `已开始下载 ${saved.count} 张生成图片，请在浏览器下载列表确认`),
      'success');
    } catch (error) {
      dispatchExportDelivery({ type: 'error', error: error.message || '导出失败' });
      showToast(error.message || '导出失败', 'error');
    }
  };

  const handleNew = () => {
    dispatch({ type: 'SET_MODE', mode: 'ecommerce' });
    dispatch({ type: 'NAVIGATE', page: 'home' });
  };

  const createComposerPlacement = useCallback((width, height, placement = {}) => {
    const source = placement.sourceNodeId ? nodes.find(node => node.id === placement.sourceNodeId) : undefined;
    const bounds = containerRef.current?.getBoundingClientRect();
    const scale = Math.max(0.05, Number(viewport.scale) || 1);
    const preferred = Number.isFinite(placement.x) && Number.isFinite(placement.y)
      ? { x: placement.x, y: placement.y }
      : {
        x: -(Number(viewport.x) || 0) / scale + ((Number(bounds?.width) || 960) / scale - width) / 2,
        y: -(Number(viewport.y) || 0) / scale + ((Number(bounds?.height) || 640) / scale - height) / 2,
      };
    return findCanvasBlankPlacement({
      width,
      height,
      viewport,
      bounds,
      nodes,
      sourceNode: source,
      preferred,
      gap: 16,
    });
  }, [nodes, viewport]);

  const addCanvasComposer = useCallback((kind, placement = {}) => {
    // 左侧添加是独立节点；只有图片右侧派生或显式传入 sourceNodeId 才建立引用关系。
    const sourceNodeId = placement.sourceNodeId || '';
    const sourceNodeIds = [...new Set([...(placement.sourceNodeIds || []), sourceNodeId].filter(Boolean))];
    const size = kind === 'suite' ? { w: 640, h: 420 } : kind === 'text' ? { w: 480, h: 220 } : kind === 'video' ? { w: 360, h: 240 } : { w: 280, h: 280 };
    const position = createComposerPlacement(size.w, size.h, { ...placement, sourceNodeId });
    const baseComposer = kind === 'suite'
      ? createCanvasSuiteComposerNode({ ...position, sourceNodeId, platform: result.commerceContext?.platform || result.platform || 'taobao', commerceContext: result.commerceContext })
      : kind === 'text'
        ? createCanvasTextComposerNode({ ...position, sourceNodeId })
        : kind === 'video'
          ? createCanvasVideoComposerNode({ ...position, sourceNodeId })
          : createCanvasImageComposerNode({ ...position, sourceNodeId });
    const composer = {
      ...baseComposer,
      sourceNodeIds,
      sourceRoles: Object.fromEntries(sourceNodeIds.map(id => [id, kind === 'suite' ? 'product' : 'reference'])),
      ...(placement.prompt ? { prompt: String(placement.prompt) } : {}),
      ...(placement.actionId ? { actionId: placement.actionId } : {}),
      ...(placement.selection ? { selection: normalizeCanvasSelection(placement.selection) } : {}),
    };
    setNodes(previous => [...previous, composer]);
    if (sourceNodeIds.length) {
      setConnections(previous => sourceNodeIds.reduce((edges, id) => addConnection(edges, id, composer.id, 'derived'), previous));
    }
    setSelected(sourceNodeIds.length ? composer.id : null);
    setMultiSelected(sourceNodeIds.length ? new Set([composer.id]) : new Set());
    setActiveTool('select');
    return composer;
  }, [createComposerPlacement, nodes, result.platform]);

  const updateComposerNode = useCallback((nodeId, change) => {
    setNodes(previous => previous.map(node => node.id === nodeId ? { ...node, ...change } : node));
  }, []);

  const ensureVideoAsset = useCallback(async node => {
    const existingId = node?.videoAssetId || String(node?.url || '').match(/\/api\/video\/assets\/([^/?#]+)/)?.[1];
    if (existingId) return { id: existingId, url: node.url, kind: ['video', 'audio'].includes(node.kind) ? node.kind : 'image' };
    if (!node?.url) throw new Error('参考素材缺少可用地址');
    const kind = node.kind === 'video' ? 'video' : node.kind === 'audio' ? 'audio' : 'image';
    const response = await fetch(kind === 'image' ? proxyImg(node.url) : node.url);
    if (!response.ok) throw new Error('参考素材读取失败');
    const blob = await response.blob();
    const extension = kind === 'video' ? 'mp4' : kind === 'audio' ? 'mp3' : (blob.type.split('/')[1] || 'png');
    const file = new File([blob], `${node.name || kind}.${extension}`, { type: blob.type || (kind === 'video' ? 'video/mp4' : kind === 'audio' ? 'audio/mpeg' : 'image/png') });
    return uploadVideoAsset(file, kind);
  }, []);

  const handleVideoComposerGenerate = useCallback(async composer => {
    if (!String(composer?.prompt || '').trim() || composer.status === 'processing') return;
    if (!composer.planReviewed) {
      updateComposerNode(composer.id, { status: 'ready', error: '请先预览并确认生成方案' });
      return;
    }
    const sourceNodes = [...new Set(composer.sourceNodeIds || [])].map(id => nodes.find(node => node.id === id)).filter(node => node?.url);
    const files = canvasVideoInputFiles(composer, sourceNodes);
    const mode = composer.mode || 'smart';
    if (!hasRequiredVideoInputs(mode, files)) {
      updateComposerNode(composer.id, { status: 'ready', error: mode === 'frame' ? '首尾帧需要同时连接首帧和尾帧图片' : '爆款重构需要同时连接替换图片和参考视频' });
      return;
    }
    updateComposerNode(composer.id, { mode: composer.mode || 'smart', status: 'processing', error: '', progress: 2, progressLabel: '正在准备参考素材' });
    try {
      const reusableAssets = composer.plannedVideoAssets || {};
      const uploaded = [];
      for (const source of sourceNodes.slice(0, 9)) uploaded.push({ source, asset: reusableAssets[source.id] || await ensureVideoAsset(source) });
      const roleFor = source => composer.sourceRoles?.[source.id] || source.role || 'reference';
      const firstImage = uploaded.find(item => !['video', 'audio'].includes(item.source.kind) && roleFor(item.source) === 'first')?.asset;
      const lastImage = uploaded.find(item => !['video', 'audio'].includes(item.source.kind) && roleFor(item.source) === 'last')?.asset;
      const imageAssets = uploaded.filter(item => !['video', 'audio'].includes(item.source.kind) && (mode === 'smart' || !['first', 'last'].includes(roleFor(item.source)))).map(item => item.asset);
      const videoAssets = uploaded.filter(item => item.source.kind === 'video').map(item => item.asset);
      const audioAssets = uploaded.filter(item => item.source.kind === 'audio').map(item => item.asset);
      const sku = videoSku(composer.duration || 8, composer.modelProductId);
      const quote = (await quoteBillingAction({ sku, quantity: 1 })).quote;
      const urls = Object.fromEntries(uploaded.map(item => [item.asset.id, item.asset.url]));
      const response = await createVideoJob({
        productId: composer.modelProductId || 'seedance_standard',
        mode: resolveVideoApiMode(mode, files),
        prompt: String(composer.prompt).trim(),
        negativePrompt: '',
        duration: Number(composer.duration) || 8,
        aspectRatio: composer.aspectRatio || '9:16',
        resolution: composer.resolution || '720p',
        generateAudio: composer.generateAudio !== false,
        seed: 0,
        billingQuoteId: quote.quoteId,
        references: {
          firstImage: firstImage?.id || '',
          lastImage: lastImage?.id || '',
          images: mode === 'frame' ? [] : imageAssets.map(asset => asset.id),
          videos: mode === 'frame' ? [] : videoAssets.map(asset => asset.id),
          audios: audioAssets.map(asset => asset.id),
          urls,
        },
      }, globalThis.crypto?.randomUUID?.() || `canvas-video-${Date.now()}`);
      let job = response.job;
      while (!VIDEO_FINAL_STATUSES.has(job.status)) {
        await delay(5000);
        job = (await getVideoJob(job.id)).job;
        updateComposerNode(composer.id, { progress: job.progress || 3, progressLabel: `视频生成中 ${job.progress || 0}%`, videoJobId: job.id });
      }
      if (job.status !== 'completed' || !job.resultUrl) throw new Error(job.error || '本次视频没有交付成片，积分已退回');
      const videoResultPatch = canvasVideoResultPatch(job);
      updateComposerNode(composer.id, {
        status: 'success',
        ...(videoResultPatch || { url: job.resultUrl, videoAssetId: job.resultAssetId || '' }),
        videoJobId: job.id,
        name: String(composer.prompt).trim().slice(0, 32) || 'AI 视频',
        displayLabel: 'AI 视频成片',
        progress: 100,
        progressLabel: '成片已交付',
      });
      await refreshBillingBalance?.({ force: true }).catch(() => {});
      showToast('视频成片已交付，并保存到作品集', 'success');
    } catch (error) {
      updateComposerNode(composer.id, { status: 'error', error: error.message || '视频生成失败', progressLabel: '' });
      if (error?.status === 402) dispatch({ type: 'OPEN_PAYWALL', reason: 'INSUFFICIENT_CREDITS' });
      else showToast(error.message || '视频生成失败', 'error');
    }
  }, [dispatch, ensureVideoAsset, nodes, refreshBillingBalance, showToast, updateComposerNode]);

  const handleVideoComposerAnalyze = useCallback(async composer => {
    if (!String(composer?.prompt || '').trim() || composer.status === 'processing') return null;
    const sourceNodes = [...new Set(composer.sourceNodeIds || [])].map(id => nodes.find(node => node.id === id)).filter(node => node?.url);
    const files = canvasVideoInputFiles(composer, sourceNodes);
    const mode = composer.mode || 'smart';
    if (!hasRequiredVideoInputs(mode, files)) {
      const message = mode === 'frame' ? '首尾帧需要同时连接首帧和尾帧图片' : mode === 'remake' ? '爆款重构需要同时连接替换图片和参考视频' : '请先补充可分析的素材或完整提示词';
      updateComposerNode(composer.id, { error: message, planReviewed: false });
      return null;
    }
    updateComposerNode(composer.id, { error: '', progressLabel: '正在读取素材并生成方案' });
    try {
      const uploaded = [];
      const localGroups = { first: [], last: [], images: [], videos: [], audios: [] };
      const roleFor = source => composer.sourceRoles?.[source.id] || source.role || 'reference';
      for (const source of sourceNodes.slice(0, 9)) {
        const asset = await ensureVideoAsset(source);
        uploaded.push({ source, asset });
        const kind = source.kind === 'video' ? 'video' : source.kind === 'audio' ? 'audio' : 'image';
        const response = await fetch(asset.url);
        if (!response.ok) throw new Error('参考素材读取失败');
        const blob = await response.blob();
        const file = new File([blob], source.name || `${kind}-${source.id}`, { type: blob.type || (kind === 'video' ? 'video/mp4' : 'image/png') });
        const role = roleFor(source);
        if (kind === 'video') localGroups.videos.push(file);
        else if (kind === 'audio') localGroups.audios.push(file);
        else if (mode === 'frame' && role === 'first') localGroups.first.push(file);
        else if (mode === 'frame' && role === 'last') localGroups.last.push(file);
        else localGroups.images.push(file);
      }
      const inspected = await inspectVideoPlanningFiles(localGroups);
      const originalImageCount = localGroups.first.length + localGroups.last.length + localGroups.images.length;
      const analysisFrames = inspected.frames.slice(0, Math.max(0, 9 - originalImageCount));
      const frameAssets = [];
      for (const frame of analysisFrames) frameAssets.push(await uploadVideoAsset(frame, 'image'));
      const analysisQuote = (await quoteBillingAction({ sku: 'video_plan_analysis', quantity: 1 })).quote;
      const imageIds = uploaded.filter(item => !['video', 'audio'].includes(item.source.kind)).map(item => item.asset.id);
      const response = await analyzeVideoPlan({
        billingQuoteId: analysisQuote.quoteId,
        billingActionId: globalThis.crypto?.randomUUID?.() || `canvas-video-plan-${Date.now()}`,
        productId: composer.modelProductId || 'seedance_standard',
        mode,
        prompt: String(composer.prompt).trim(),
        negativePrompt: '',
        duration: Number(composer.duration) || 8,
        ratio: composer.aspectRatio || '9:16',
        resolution: composer.resolution || '720p',
        sound: composer.generateAudio !== false,
        manifest: inspected.manifest,
        analysisImageIds: [...imageIds, ...frameAssets.map(asset => asset.id)],
      });
      const plannedVideoAssets = Object.fromEntries(uploaded.map(item => [item.source.id, item.asset]));
      updateComposerNode(composer.id, {
        videoPlan: response.plan,
        plannedVideoAssets,
        planReviewed: false,
        error: '',
        progressLabel: '',
      });
      await refreshBillingBalance?.({ force: true }).catch(() => {});
      return response.plan;
    } catch (error) {
      updateComposerNode(composer.id, { error: error.message || '素材分析暂时失败，请稍后重试', progressLabel: '', planReviewed: false });
      if (error?.status === 402 || error?.code === 'BILLING_INSUFFICIENT_CREDITS') dispatch({ type: 'OPEN_PAYWALL', reason: 'INSUFFICIENT_CREDITS' });
      return null;
    }
  }, [dispatch, ensureVideoAsset, nodes, refreshBillingBalance, updateComposerNode]);

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
    setConnectionPicker(previous => previous?.sourceNodeId === nodeId ? null : previous);
    setConnectionDraft(previous => previous?.sourceNodeId === nodeId ? null : previous);
  }, []);

  const handleImageComposerGenerate = useCallback(async composer => {
    if (!composer?.prompt?.trim() || composer.status === 'processing') return;
    const composerSourceIds = [...new Set([...(composer.sourceNodeIds || []), ...(composer.mentionSourceNodeIds || [])])];
    const sourceNodes = composerSourceIds.map(id => nodes.find(node => node.id === id)).filter(node => node?.url);
    const sourceReferences = buildCanvasImageReferencePayload(buildImageMentions(sourceNodes.map(node => ({
      ...node,
      role: composer.sourceRoles?.[node.id] || (node.id === composer.sourceNodeIds?.[0] ? 'product' : 'reference'),
    }))));
    updateComposerNode(composer.id, { status: 'processing', error: '' });
    try {
      const count = Math.max(1, Math.min(10, Number(composer.count) || 1));
      const selection = normalizeCanvasSelection(composer.selection);
      const selectionPrompt = selection.mode === 'rectangle'
        ? `仅修改图片中归一化区域 x=${selection.rect.x.toFixed(3)}, y=${selection.rect.y.toFixed(3)}, w=${selection.rect.w.toFixed(3)}, h=${selection.rect.h.toFixed(3)}，区域外内容保持不变。`
        : selection.mode === 'subject'
          ? '仅修改图片中被识别的商品主体区域，背景、版式和其他内容保持不变。'
          : '';
      const prompt = [
        composer.prompt.trim(),
        ...(['product-remix', 'inpaint'].includes(composer.actionId) ? [] : [selectionPrompt]),
      ].filter(Boolean).join('\n');
      const urls = await Promise.all(Array.from({ length: count }, async () => {
        if (composer.actionId === 'inpaint' || composer.actionId === 'product-remix') {
          if (!sourceNodes.length) throw new Error('局部编辑需要先连接一张图片');
          const response = await regenerateCanvasImage({
            prompt,
            imageUrl: sourceNodes[0].url,
            referenceImages: sourceNodes.slice(1).map(node => node.url),
            references: sourceReferences.references,
            ratio: composer.ratio || sourceNodes[0].ratio || '1:1',
            resolution: composer.resolution || '2K',
            imageModel: composer.imageModel || sourceNodes[0]?.imageModel || 'image2',
            selection,
          });
          return response;
        }
        if (composer.actionId && sourceNodes.length) {
          const response = await transformCanvasImage({
            action: composer.actionId,
            prompt,
            imageUrl: sourceNodes[0].url,
            ratio: composer.ratio || sourceNodes[0].ratio || '1:1',
            resolution: composer.resolution || '2K',
            imageModel: composer.imageModel || sourceNodes[0]?.imageModel || 'image2',
          });
          const url = response?.url || response?.result_url;
          if (!url) throw new Error('图片处理没有返回结果');
          return url;
        }
        return sourceNodes.length
          ? regenerateCanvasImage({
            prompt,
            imageUrl: sourceNodes[0].url,
            referenceImages: sourceNodes.slice(1).map(node => node.url),
            references: sourceReferences.references,
            ratio: composer.ratio || '1:1',
            resolution: composer.resolution || '2K',
            imageModel: composer.imageModel || sourceNodes[0]?.imageModel || 'image2',
          })
          : regenerateCanvasImage({
            prompt: composer.prompt.trim(),
            imageUrl: '',
            ratio: composer.ratio || '1:1',
            resolution: composer.resolution || '2K',
            imageModel: composer.imageModel || 'image2',
          });
      }));
      const createdAt = Date.now();
      const ratio = composer.ratio || '1:1';
      const ratioNumber = ratioValue(ratio);
      const outputs = urls.slice(1).map((url, index) => normalizeCanvasNode({
        id: `image_generated_${createdAt}_${index + 1}`,
        assetId: `asset_generated_${createdAt}_${index + 1}`,
        kind: 'image',
        status: 'ready',
        url,
        name: `图片生成结果 ${index + 2}`,
        displayLabel: `图片生成结果 ${index + 2}`,
        group: '素材',
        role: '创作图片',
        imageModel: composer.imageModel || sourceNodes[0]?.imageModel || 'image2',
        resolution: composer.resolution || '2K',
        ratio,
        sourceNodeIds: [composer.id],
        x: composer.x + composer.w + 56 + index * 268,
        y: composer.y,
        w: 230,
        h: Math.round(230 / ratioNumber),
        showMeta: true,
      }));
      setNodes(previous => previous.map(node => node.id === composer.id ? {
        ...node,
        status: 'success',
        url: urls[0],
        name: '图片生成结果',
        displayLabel: '图片生成结果',
        ratio,
        h: Math.round(node.w / ratioNumber),
        outputNodeIds: [composer.id, ...outputs.map(output => output.id)],
      } : node).concat(outputs));
      setConnections(previous => outputs.reduce((edges, output) => addConnection(edges, composer.id, output.id, 'generated'), previous));
      setSelected(composer.id);
      setMultiSelected(new Set([composer.id]));
      showToast(`已生成 ${urls.length} 张图片`, 'success');
    } catch (error) {
      updateComposerNode(composer.id, { status: 'error', error: error.message || '图片生成失败' });
      handleCanvasActionError(error, { type: 'image-generation', nodeId: composer.id });
    }
  }, [handleCanvasActionError, nodes, result.category, showToast, updateComposerNode]);

  const handleSuiteComposerGenerate = useCallback(async composer => {
    if (!composer || composer.status === 'processing') return;
    const composerSourceIds = [...new Set([...(composer.sourceNodeIds || []), ...(composer.mentionSourceNodeIds || [])])];
    const sourceNodes = composerSourceIds.map(id => nodes.find(node => node.id === id)).filter(node => node?.url);
    const productNodes = sourceNodes.filter(node => (composer.sourceRoles?.[node.id] || 'product') === 'product');
    const referenceNodes = sourceNodes.filter(node => (composer.sourceRoles?.[node.id] || 'product') === 'reference');
    const sourceMentions = buildImageMentions(sourceNodes.map(node => ({
      ...node,
      role: composer.sourceRoles?.[node.id] || 'product',
    })));
    const roleAwareSources = buildRoleAwareImagePayload(sourceMentions);
    const configuration = composer.configuration || {};
    const commerceContext = normalizeCommerceContext({
      ...(result.commerceContext || {}),
      ...(composer.commerceContext || {}),
      ...(configuration.commerceContext || {}),
      platform: configuration.commerceContext?.platform || configuration.platform || composer.commerceContext?.platform || composer.platform || result.commerceContext?.platform || result.platform,
    });
    const sizingImages = Array.isArray(configuration.sizing?.images) ? configuration.sizing.images : [];
    if (!productNodes.length) {
      showToast('请先连接或选中一张清晰商品图', 'info');
      return;
    }
    if (composer.suiteStep !== 'directions') {
      updateComposerNode(composer.id, { status: 'processing', error: '' });
      try {
        const response = await getDesignDirections({
          product_name: result.product_name || productNodes[0].name || '商品',
          description: composer.prompt?.trim() || '请根据商品图规划完整电商视觉方案',
          category: result.category || '其他',
          real_shots: productNodes.slice(0, 6).map(node => node.url),
          ref_shots: referenceNodes.slice(0, 6).map(node => node.url),
          asset_mentions: roleAwareSources.assets,
          platform: commerceContext.platform,
          content_type: commerceContext.contentType,
          target_language: commerceContext.targetLanguage,
          commerce_context: commerceContext,
          style_skill: configuration.styleSkill || composer.styleSkill || 'smart',
          product_params: configuration.productParams || {},
          skus: configuration.skus || [],
          copywriting: configuration.copywriting || {},
          requested_images: sizingImages.length
            ? sizingImages
            : composer.suiteType === '主图'
            ? [{ key: 'main_text', count: 3 }]
            : [{ key: 'main_text', count: 3 }, { key: 'detail_slice_feature', count: 3 }],
        });
        const directions = Array.isArray(response?.directions) && response.directions.length
          ? response.directions.map(direction => ({
            ...direction,
            analysis: response.analysis || null,
            productName: result.product_name || productNodes[0].name || '商品',
            category: result.category || '其他',
            commerce_context: commerceContext,
          }))
          : [{
            title: '商品主视觉方案',
            hook: '保留商品主体，围绕平台和使用场景生成完整套图。',
            description: composer.prompt?.trim() || '',
            analysis: response?.analysis || null,
            productName: result.product_name || productNodes[0].name || '商品',
            category: result.category || '其他',
          }];
        const suitePlan = buildCanvasSuitePlan(directions[0], composer.prompt);
        setNodes(previous => previous.map(node => node.id === composer.id
          ? { ...node, status: 'ready', suiteStep: 'directions', directions, suitePlan, selectedDirection: 0 }
          : node));
        showToast('整体设计规范与逐图计划已生成', 'success');
      } catch (error) {
        updateComposerNode(composer.id, { status: 'error', error: error.message || '设计方案生成失败' });
        handleCanvasActionError(error, { type: 'ecommerce-directions', nodeId: composer.id });
      }
      return;
    }
    if (suiteGenerationInFlightRef.current.has(composer.id)) return;
    suiteGenerationInFlightRef.current.add(composer.id);
    updateComposerNode(composer.id, { status: 'processing', error: '', generatedCount: 0 });
    const suitePlan = buildCanvasSuitePlan(composer.suitePlan || composer.directions?.[0], composer.prompt);
    const directionSource = composer.directions?.[0] || {};
    const desiredCount = Math.max(3, Math.min(12, Number(composer.count) || 6));
    const mainCount = Math.min(3, Math.max(1, Math.floor((desiredCount - 1) / 2)));
    const detailCount = Math.max(1, desiredCount - 1 - mainCount);
    const imageSelections = sizingImages.length ? sizingImages : [
      { key: 'white_bg', count: 1, ratio: composer.ratio || '1:1' },
      { key: 'main_text', count: mainCount, ratio: composer.ratio || '1:1' },
      { key: 'detail_slice_feature', count: detailCount, ratio: composer.ratio || '1:1' },
    ];
    const rowCounters = new Map();
    const receivedUrls = new Set();
    const roleRows = { 白底图: 0, 主图: 1, 详情图: 2, SKU: 3, 素材: 4 };
    try {
      await generateEcommerceSuite({
        productImages: productNodes.map(node => ({ assetId: node.assetId, url: node.url, previewUrl: node.url, name: node.name || node.displayLabel, role: 'product' })),
        referenceImages: referenceNodes.map(node => ({ assetId: node.assetId, url: node.url, previewUrl: node.url, name: node.name || node.displayLabel, role: 'reference' })),
        assetMentions: roleAwareSources.assets,
        sceneStyle: [
          suitePlan.brief,
          `视觉方向：${suitePlan.visualDirection}`,
          `商品策略：${suitePlan.productStrategy}`,
          `目标人群：${suitePlan.audience}`,
          `构图与光线：${suitePlan.composition}`,
          `文案规则：${suitePlan.copyRules}`,
          `一致性与风险：${suitePlan.qualityRisks}`,
          composer.prompt?.trim(),
          `输出语言：${commerceContext.targetLanguage === 'visual' ? '无文字（纯视觉）' : commerceContext.locale}`,
          `套图类型：${composer.suiteType || '完整套图'}`,
          `商品信息模式：${composer.productInfoMode === 'prompt' ? '优先使用描述' : '自动识别'}`,
          `文案策划：${composer.copywritingMode === 'none' ? '不生成文案' : 'AI规划文案'}`,
        ].filter(Boolean).join('\n') || result.product_name || '专业电商视觉',
        platform: commerceContext.platform,
        contentType: commerceContext.contentType,
        targetLanguage: commerceContext.targetLanguage,
        commerceContext,
        batchPlan: { imageSelections },
        generationSettings: {
          ...(configuration.genSettings || {}),
          resolution: configuration.genSettings?.resolution || composer.resolution || '2K',
          imageModel: configuration.genSettings?.imageModel || composer.imageModel || 'image2',
          suiteType: composer.suiteType || '完整套图',
          skuMode: composer.skuMode || '默认SKU',
          styleSkill: configuration.styleSkill || composer.styleSkill || 'smart',
          productInfoMode: composer.productInfoMode || 'auto',
          copywritingMode: composer.copywritingMode || 'smart',
        },
        sizing: { ...(configuration.sizing || {}), smart: configuration.sizing?.smart ?? false, contentType: commerceContext.contentType, resolution: configuration.genSettings?.resolution || composer.resolution || '2K', images: imageSelections },
        direction: applyCanvasSuitePlanToDirection(suitePlan, directionSource),
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
          const ratioNumber = ratioValue(ratio);
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
            imageModel: configuration.genSettings?.imageModel || composer.imageModel || 'image2',
            resolution: configuration.genSettings?.resolution || composer.resolution || '2K',
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
    } finally {
      suiteGenerationInFlightRef.current.delete(composer.id);
    }
  }, [getDesignDirections, handleCanvasActionError, nodes, phone, result.category, result.platform, result.product_name, showToast, updateComposerNode]);

  const handleSuiteDirectionSelect = useCallback((composerId, direction, index) => {
    updateComposerNode(composerId, { selectedDirection: index, selectedDirectionData: direction });
  }, [updateComposerNode]);

  const handleTextGenerationGenerate = useCallback(async composer => {
    const boardText = String(composer?.text || '').trim();
    const promptText = String(composer?.prompt || '').trim();
    if ((!boardText && !promptText) || composer.status === 'processing') return;
    updateComposerNode(composer.id, { status: 'processing', error: '' });
    try {
      const composerSourceIds = [...new Set([...(composer.sourceNodeIds || []), ...(composer.mentionSourceNodeIds || [])])];
      const sourceNodes = composerSourceIds
        .map(id => nodes.find(node => node.id === id))
        .filter(node => node?.url);
      const sourceReferences = buildCanvasImageReferencePayload(buildImageMentions(sourceNodes.map((node, index) => ({
        ...node,
        role: index === 0 ? 'product' : 'reference',
      }))));
      const prompt = [
        boardText ? `请在生成画面中准确呈现以下文字内容，保持字面、顺序和可读性：${boardText}` : '',
        promptText,
      ].filter(Boolean).join('\n');
      const count = Math.max(1, Math.min(10, Number(composer.count) || 1));
      const urls = await Promise.all(Array.from({ length: count }, () => sourceNodes.length
        ? regenerateCanvasImage({
          prompt,
          imageUrl: sourceNodes[0].url,
          referenceImages: sourceNodes.slice(1).map(node => node.url),
          references: sourceReferences.references,
          ratio: composer.ratio || sourceNodes[0].ratio || '1:1',
          resolution: composer.resolution || '2K',
          imageModel: composer.imageModel || sourceNodes[0]?.imageModel || 'image2',
        })
        : regenerateCanvasImage({
          prompt,
          imageUrl: '',
          ratio: composer.ratio || '1:1',
          resolution: composer.resolution || '2K',
          imageModel: composer.imageModel || 'image2',
        })));
      const createdAt = Date.now();
      const ratio = composer.ratio || '1:1';
      const ratioNumber = ratioValue(ratio);
      const outputs = urls.map((url, index) => normalizeCanvasNode({
        id: `text_generation_output_${createdAt}_${index + 1}`,
        assetId: `text_generation_asset_${createdAt}_${index + 1}`,
        kind: 'image',
        status: 'ready',
        url,
        name: `画面生成结果 ${index + 1}`,
        displayLabel: `画面生成结果 ${index + 1}`,
        group: '素材',
        role: '创作图片',
        imageModel: composer.imageModel || sourceNodes[0]?.imageModel || 'image2',
        resolution: composer.resolution || '2K',
        ratio,
        sourceNodeIds: [composer.id],
        x: composer.x + composer.w + 56 + index * 268,
        y: composer.y,
        w: 230,
        h: Math.round(230 / ratioNumber),
        showMeta: true,
      }));
      setNodes(previous => previous.map(node => node.id === composer.id ? {
        ...node,
        status: 'success',
        generatedCount: outputs.length,
        outputNodeIds: outputs.map(output => output.id),
        progress: 100,
      } : node).concat(outputs));
      setConnections(previous => outputs.reduce((edges, output) => addConnection(edges, composer.id, output.id, 'generated'), previous));
      setSelected(composer.id);
      setMultiSelected(new Set([composer.id]));
      showToast(`已生成 ${outputs.length} 张画面`, 'success');
    } catch (error) {
      updateComposerNode(composer.id, { status: 'error', error: error.message || '画面生成失败' });
      handleCanvasActionError(error, { type: 'image-generation-from-text', nodeId: composer.id });
    }
  }, [handleCanvasActionError, nodes, result.category, showToast, updateComposerNode]);

  const handleAddTextNode = useCallback((placement = {}) => {
    if (placement?.openComposer) {
      return addCanvasComposer('text', placement);
    }
    const bounds = containerRef.current?.getBoundingClientRect();
    const width = 420;
    const height = 84;
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
      gap: 16,
    });
    const textNode = createCanvasTextNode({
      ...position,
      sourceNodeId: placement?.sourceNodeId,
    });
    setNodes(previous => [...previous, textNode]);
    setSelected(textNode.id);
    setMultiSelected(new Set([textNode.id]));
    if (placement?.sourceNodeId) {
      setConnections(previous => addConnection(previous, placement.sourceNodeId, textNode.id, 'derived'));
    }
    setActiveTool('select');
    return textNode;
  }, [addCanvasComposer, nodes, viewport]);

  useEffect(() => {
    handleAddTextRef.current = handleAddTextNode;
  }, [handleAddTextNode]);

  const handleTextNodeChange = useCallback((nodeId, text) => {
    setNodes(previous => previous.map(node => node.id === nodeId ? { ...node, text } : node));
  }, []);
  const handleCanvasSourceUpload = async event => {
    const files = [...(event.target?.files || [])].filter(file => file.type.startsWith('image/')).slice(0, 8);
    event.target.value = '';
    if (!files.length) return;
    const uploadStartedAt = Date.now();
    setPromptLoading(true);
    try {
      const assets = await readCanvasImageFiles(files, uploadStartedAt);
      const bounds = containerRef.current?.getBoundingClientRect();
      const worldX = ((bounds?.width || 960) * 0.4 - viewport.x) / viewport.scale;
      const worldY = ((bounds?.height || 640) * 0.35 - viewport.y) / viewport.scale;
      const uploadedNodes = createUploadedImageNodes({ assets, x: worldX, y: worldY, now: uploadStartedAt })
        .map(node => ({ ...node, status: 'uploading', localPreviewUrl: node.url }));
      const persistenceGeneration = canvasPersistenceGenerationRef.current;
      draftReadyRef.current = true;
      canvasSaveKeyRef.current ||= canvasDraftKey({ ...result, canvasImportId: `upload-${uploadStartedAt}` });
      setNodes(previous => [...previous, ...uploadedNodes]);
      setSelected(uploadedNodes[0]?.id || null);
      setMultiSelected(new Set(uploadedNodes.map(node => node.id)));
      showToast(`已加入 ${uploadedNodes.length} 张图片，正在后台保存原图`, 'success');
      void persistCanvasUploadAssets(assets, { role: 'product' }).then(async persistedAssets => {
        if (canvasPersistenceGenerationRef.current !== persistenceGeneration) return;
        let projectContext = null;
        if (state.logged && !result.browserQa) {
          try {
            projectContext = await ensureCanvasMediaProject(files[0]?.name || 'Canvas 图片项目', 'ecommerce');
          } catch {}
        }
        const imported = await importCanvasImageAssets(persistedAssets, projectContext, 'product');
        if (canvasPersistenceGenerationRef.current !== persistenceGeneration) return;
        const persistedById = new Map(uploadedNodes.map((node, index) => [node.id, imported.assets[index]]));
        const canonicalNodes = uploadedNodes.map(node => {
          const persisted = persistedById.get(node.id);
          return persisted
            ? attachCanvasProjectAssetRef({ ...node, ...persisted, url: persisted.url, status: 'ready', uploadError: '' }, persisted)
            : node;
        });
        if (projectContext) {
          const projectAssetRefs = collectCanvasProjectAssetRefs({ work: result, nodes: canonicalNodes });
          dispatch({
            type: 'SET_RESULT',
            result: {
              ...result,
              projectId: projectContext.projectId,
              sourceVersionId: projectContext.baseVersionId,
              ...(projectAssetRefs.length ? { projectAssetRefs } : {}),
            },
          });
        }
        setNodes(previous => previous.map(node => canonicalNodes.find(next => next.id === node.id) || node));
        const failedImageIds = new Set(imported.failed.map(item => canvasImportSourceId('image', item.asset)));
        enqueuePendingProjectAssetImports(persistedAssets.map((asset, index) => ({
          asset,
          kind: 'image',
          role: 'product',
          displayName: asset.name || 'Canvas 图片素材',
          nodeIds: failedImageIds.has(canvasImportSourceId('image', asset)) || !projectContext ? [uploadedNodes[index]?.id].filter(Boolean) : [],
        })));
        if (imported.failed.length || !projectContext) {
          showToast(`图片已保存，但 ${imported.failed.length || persistedAssets.length} 张尚未归档到项目`, 'info');
        }
      }).catch(error => {
        const uploadedIds = new Set(uploadedNodes.map(node => node.id));
        setNodes(previous => previous.map(node => uploadedIds.has(node.id)
          ? { ...node, status: 'upload-error', uploadError: error.message || '原图保存失败' }
          : node));
        showToast(error.message || '原图保存失败，本地预览仍可使用', 'error');
      });
    } catch (error) {
      showToast(error.message || '图片上传失败，请重试', 'error');
    } finally {
      setPromptLoading(false);
    }
  };

  const handleCanvasVideoUpload = async event => {
    const files = [...(event.target?.files || [])].filter(file => file.type.startsWith('video/')).slice(0, 4);
    event.target.value = '';
    if (!files.length) return;
    const uploadStartedAt = Date.now();
    canvasSaveKeyRef.current ||= canvasDraftKey({ ...result, canvasImportId: `video-upload-${uploadStartedAt}` });
    setPromptLoading(true);
    try {
      const assets = [];
      for (const file of files) assets.push({ ...(await uploadVideoAsset(file, 'video')), name: file.name });
      let projectContext = null;
      try {
        projectContext = await ensureCanvasMediaProject(files[0]?.name || 'Canvas 视频项目');
      } catch {}
      const imported = await importCanvasMediaAssets(assets, projectContext, 'reference-video');
      const bounds = containerRef.current?.getBoundingClientRect();
      const worldX = ((bounds?.width || 960) * 0.4 - viewport.x) / viewport.scale;
      const worldY = ((bounds?.height || 640) * 0.35 - viewport.y) / viewport.scale;
      const uploadedNodes = createUploadedVideoNodes({ assets: imported.assets, x: worldX, y: worldY, now: uploadStartedAt });
      draftReadyRef.current = true;
      const mediaFields = canvasMediaFields(result, uploadedNodes);
      if (projectContext || Object.keys(mediaFields).length) {
        dispatch({
          type: 'SET_RESULT',
          result: {
            ...result,
            ...(projectContext ? { projectId: projectContext.projectId, sourceVersionId: projectContext.baseVersionId } : {}),
            ...mediaFields,
          },
        });
      }
      setNodes(previous => [...previous, ...uploadedNodes]);
      setSelected(uploadedNodes[0]?.id || null);
      setMultiSelected(new Set(uploadedNodes.map(node => node.id)));
      const failedVideoIds = new Set(imported.failed.map(item => canvasImportSourceId('video', item.asset)));
      enqueuePendingProjectAssetImports(assets.map((asset, index) => ({
        asset,
        kind: 'video',
        role: 'reference-video',
        displayName: asset.name || 'Canvas 视频素材',
        nodeIds: failedVideoIds.has(canvasImportSourceId('video', asset)) || !projectContext ? [uploadedNodes[index]?.id].filter(Boolean) : [],
      })));
      const failedCount = imported.failed.length + (!projectContext ? assets.length : 0);
      showToast(failedCount
        ? `已加入 ${uploadedNodes.length} 个视频，但 ${failedCount} 个素材尚未归档到项目，可稍后重试`
        : `已加入 ${uploadedNodes.length} 个视频，已归档到项目，可继续引用生成`, failedCount ? 'info' : 'success');
    } catch (error) {
      showToast(error.message || '视频上传失败，请重试', 'error');
    } finally {
      setPromptLoading(false);
    }
  };

  const handleComposerSourceUpload = useCallback(async (composerId, files = [], role = 'reference') => {
    const composer = nodes.find(node => node.id === composerId && ['image-composer', 'text-composer', 'suite-composer', 'video-composer'].includes(node.kind));
    const accepted = composer?.kind === 'video-composer'
      ? files.filter(file => file?.type?.startsWith('image/') || file?.type?.startsWith('video/') || file?.type?.startsWith('audio/')).slice(0, 8)
      : files.filter(file => file?.type?.startsWith('image/')).slice(0, 8);
    if (!accepted.length || !composer) return;
    const uploadStartedAt = Date.now();
    const persistenceGeneration = canvasPersistenceGenerationRef.current;
    canvasSaveKeyRef.current ||= canvasDraftKey({ ...result, canvasImportId: `upload-${uploadStartedAt}` });
    try {
      const imageFiles = accepted.filter(file => file.type.startsWith('image/'));
      const videoFiles = accepted.filter(file => file.type.startsWith('video/'));
      const audioFiles = accepted.filter(file => file.type.startsWith('audio/'));
      const assets = imageFiles.length ? await readCanvasImageFiles(imageFiles, uploadStartedAt) : [];
      const persistedAssets = assets.length ? await persistCanvasUploadAssets(assets, { role }) : [];
      const videoAssets = [];
      for (const file of videoFiles) videoAssets.push({ ...(await uploadVideoAsset(file, 'video')), name: file.name });
      const audioAssets = [];
      for (const file of audioFiles) audioAssets.push({ ...(await uploadVideoAsset(file, 'audio')), name: file.name });
      let projectContext = null;
      if (persistedAssets.length || videoAssets.length || audioAssets.length) {
        try {
          projectContext = await ensureCanvasMediaProject(
            composer.prompt || (videoAssets.length || audioAssets.length ? 'Canvas 视频素材项目' : 'Canvas 图片素材项目'),
            videoAssets.length || audioAssets.length ? 'video' : 'ecommerce',
          );
        } catch {}
      }
      const importedImages = await importCanvasImageAssets(persistedAssets, projectContext, role);
      const importedVideos = await importCanvasMediaAssets(videoAssets, projectContext, 'reference-video');
      const importedAudios = await importCanvasMediaAssets(audioAssets, projectContext, 'reference-audio');
      if (canvasPersistenceGenerationRef.current !== persistenceGeneration) return;
      const imageNodes = createUploadedImageNodes({
        assets: importedImages.assets,
        x: composer.x - importedImages.assets.length * 278 - 36,
        y: composer.y,
        now: uploadStartedAt,
      }).map(node => ({ ...node, role }));
      const videoNodes = createUploadedVideoNodes({
        assets: importedVideos.assets,
        x: composer.x - Math.max(1, importedVideos.assets.length) * 360 - 36,
        y: composer.y + (imageNodes.length ? 112 : 0),
        now: uploadStartedAt,
      }).map(node => ({ ...node, role }));
      const audioNodes = importedAudios.assets.map((asset, index) => attachCanvasProjectAssetRef({
        id: `audio_upload_${uploadStartedAt}_${index}`, assetId: asset.id, videoAssetId: asset.id, kind: 'audio', provenance: 'source', status: 'ready',
        url: asset.url || asset.stableUrl, name: asset.name || `参考音频 ${index + 1}`, displayLabel: asset.name || `参考音频 ${index + 1}`, group: '音频', role,
        x: composer.x - 300, y: composer.y + 150 + index * 92, w: 264, h: 72, sourceNodeIds: [], editable: true, showMeta: true,
      }, asset));
      const uploadedNodes = [...imageNodes, ...videoNodes, ...audioNodes];
      const uploadedIds = uploadedNodes.map(node => node.id);
      draftReadyRef.current = true;
      const mediaFields = canvasMediaFields(result, uploadedNodes);
      if (projectContext || Object.keys(mediaFields).length) {
        dispatch({
          type: 'SET_RESULT',
          result: {
            ...result,
            ...(projectContext ? { projectId: projectContext.projectId, sourceVersionId: projectContext.baseVersionId } : {}),
            ...mediaFields,
          },
        });
      }
      setNodes(previous => previous
        .map(node => node.id === composerId
          ? {
            ...node,
            sourceNodeIds: [...new Set([...(node.sourceNodeIds || []), ...uploadedIds])],
            sourceRoles: { ...(node.sourceRoles || {}), ...Object.fromEntries(uploadedIds.map(id => [id, role])) },
          }
          : node)
        .concat(uploadedNodes));
      setConnections(previous => uploadedIds.reduce((edges, id) => addConnection(edges, id, composerId, 'derived'), previous));
      setSelected(composerId);
      setMultiSelected(new Set([composerId]));
      const failedImageIds = new Set(importedImages.failed.map(item => canvasImportSourceId('image', item.asset)));
      const failedVideoIds = new Set(importedVideos.failed.map(item => canvasImportSourceId('video', item.asset)));
      const failedAudioIds = new Set(importedAudios.failed.map(item => canvasImportSourceId('audio', item.asset)));
      enqueuePendingProjectAssetImports([
        ...persistedAssets.map((asset, index) => ({
          asset,
          kind: 'image',
          role,
          displayName: asset.name || 'Canvas 图片素材',
          nodeIds: failedImageIds.has(canvasImportSourceId('image', asset)) || !projectContext ? [imageNodes[index]?.id].filter(Boolean) : [],
        })),
        ...videoAssets.map((asset, index) => ({
          asset,
          kind: 'video',
          role: 'reference-video',
          displayName: asset.name || 'Canvas 视频素材',
          nodeIds: failedVideoIds.has(canvasImportSourceId('video', asset)) || !projectContext ? [videoNodes[index]?.id].filter(Boolean) : [],
        })),
        ...audioAssets.map((asset, index) => ({
          asset,
          kind: 'audio',
          role: 'reference-audio',
          displayName: asset.name || 'Canvas 音频素材',
          nodeIds: failedAudioIds.has(canvasImportSourceId('audio', asset)) || !projectContext ? [audioNodes[index]?.id].filter(Boolean) : [],
        })),
      ]);
      const durableImportFailures = importedImages.failed.length + importedVideos.failed.length + importedAudios.failed.length;
      const unarchivedCount = durableImportFailures + (!projectContext ? persistedAssets.length + videoAssets.length + audioAssets.length : 0);
      showToast(unarchivedCount
        ? `已连接 ${uploadedNodes.length} 个素材，但 ${unarchivedCount} 个素材尚未归档到项目，可稍后重试`
        : `已连接 ${uploadedNodes.length} 个素材，图片和媒体已归档到项目`, unarchivedCount ? 'info' : 'success');
    } catch (error) {
      showToast(error.message || '参考图读取失败', 'error');
    }
  }, [canvasMediaFields, dispatch, enqueuePendingProjectAssetImports, ensureCanvasMediaProject, importCanvasImageAssets, importCanvasMediaAssets, nodes, result, showToast]);

  const removeComposerSource = useCallback((composerId, sourceId) => {
    const mention = buildImageMentions(nodes.filter(node => node?.url)).find(image => image.sourceNodeId === sourceId);
    setNodes(previous => previous.map(node => node.id === composerId
      ? {
        ...node,
        sourceNodeIds: (node.sourceNodeIds || []).filter(id => id !== sourceId),
        mentionSourceNodeIds: (node.mentionSourceNodeIds || []).filter(id => id !== sourceId),
        sourceRoles: Object.fromEntries(Object.entries(node.sourceRoles || {}).filter(([id]) => id !== sourceId)),
        prompt: mention?.label ? removeImageMention(node.prompt, mention.label) : node.prompt,
      }
      : node));
    setConnections(previous => previous.filter(edge => !(edge.from === sourceId && edge.to === composerId)));
  }, [nodes]);

  const toggleComposerSource = useCallback((composerId, image, role = 'reference', options = {}) => {
    const sourceId = String(image?.sourceNodeId || image?.id || '');
    if (!sourceId) return;
    setNodes(previous => previous.map(node => node.id === composerId ? {
      ...node,
      mentionSourceNodeIds: (node.mentionSourceNodeIds || []).includes(sourceId)
        ? (node.mentionSourceNodeIds || []).filter(id => id !== sourceId)
        : [...new Set([...(node.mentionSourceNodeIds || []), sourceId])],
      prompt: options.skipPromptInsert
        ? node.prompt
        : (node.mentionSourceNodeIds || []).includes(sourceId)
          ? removeImageMention(node.prompt, image?.label)
          : appendImageMention(node.prompt, image?.label),
    } : node));
  }, []);
  const handleTabChange = useCallback(nextTab => {
    // Cross-fade canvas tabs through the View Transitions API when the
    // browser offers it; reduced-motion users get an instant swap instead.
    const apply = () => {
      setTab(nextTab);
      dispatch({ type: 'SET_CANVAS_ENTRY_TAB', tab: nextTab });
    };
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion && typeof document !== 'undefined' && typeof document.startViewTransition === 'function') {
      document.startViewTransition(() => flushSync(apply));
      return;
    }
    apply();
  }, [dispatch]);
  const handleBack = () => dispatch({ type: 'NAVIGATE', page: 'home' });
  const openWork = (work) => {
    dispatch({ type: 'SET_RESULT', result: buildCanvasImportResult(work) });
    handleTabChange('canvas');
  };
  const handleImportProjectAsset = useCallback(async (asset) => {
    if (projectAssetImportBusyRef.current) return;
    if (!canReuseProjectAsset(asset)) {
      showToast('素材已到期或待清理，请先长期保留后再使用', 'info');
      return;
    }
    projectAssetImportBusyRef.current = true;
    setProjectAssetBatchBusy(true);
    try {
      let reusableAsset = asset;
      if (state.logged && !result.browserQa && asset?.projectId && asset?.projectAssetId) {
        try {
          reusableAsset = await getProjectAsset(asset.projectId, asset.projectAssetId, 'reuse');
        } catch (error) {
          showToast(error?.code === 'PROJECT_ASSET_NOT_REUSABLE'
            ? '素材已到期或待清理，请先长期保留后再使用'
            : (error?.message || '素材暂时无法加入画布，请稍后重试'), 'info');
          return;
        }
      }
      const imported = importProjectAssetToCanvas({
        asset: reusableAsset,
        source: 'project-library',
        session: { nodes, connections, viewport },
      });
      if (!imported.added) {
        showToast(imported.reason === 'already-imported' ? '这个素材已经在当前画布中' : '项目素材缺少可验证的稳定引用', 'info');
        if (imported.nodeId) setSelected(imported.nodeId);
        return;
      }
      const mediaKind = String(reusableAsset?.mediaKind || reusableAsset?.media_kind || '').toLowerCase();
      const label = reusableAsset?.metadata?.displayName || reusableAsset?.assetId || reusableAsset?.role || '项目素材';
      let projectContext = null;
      if (state.logged && !result.browserQa) {
        try {
          projectContext = await ensureCanvasMediaProject(`${label} Canvas 项目`, mediaKind === 'image' ? 'ecommerce' : 'video');
        } catch {
          projectContext = null;
        }
      }
      draftReadyRef.current = true;
      canvasSaveKeyRef.current ||= canvasDraftKey({ ...result, canvasImportId: `project-asset-${Date.now()}` });
      canvasGeneratedWorkKeyRef.current ||= canvasSaveKeyRef.current;
      const nextResult = {
        ...result,
        ...(projectContext ? { projectId: projectContext.projectId, sourceVersionId: projectContext.baseVersionId } : {}),
        _saveKey: result._saveKey || canvasGeneratedWorkKeyRef.current,
      };
      if (projectContext) dispatch({ type: 'SET_RESULT', result: nextResult });
      setNodes(imported.session.nodes);
      setConnections(imported.session.connections);
      setSelected(imported.node.id);
      setMultiSelected(new Set([imported.node.id]));
      let savedWork = null;
      if (state.logged) {
        const workResult = {
          ...nextResult,
          product_name: nextResult.product_name || label,
          images: collectCanvasWorkImages({ baseImages: canvasOutputImages(nextResult), nodes: imported.session.nodes }),
          imageRecords: collectCanvasWorkImages({ baseImages: canvasOutputImages(nextResult), nodes: imported.session.nodes }),
          ...canvasWorkMediaFields(nextResult, imported.session.nodes),
        };
        try {
          savedWork = await saveWork(workResult, phone);
        } catch {
          savedWork = null;
        }
      }
      handleTabChange('canvas');
      const remoteArchived = Boolean(savedWork?._saveKey);
      showToast(
        projectContext && remoteArchived
          ? '项目素材已加入画布并保存，不会产生生成或扣费'
          : projectContext
            ? '项目素材已加入画布，本地草稿已保留，云端作品暂未保存'
            : '项目素材已加入画布，本地草稿已保留',
        projectContext && remoteArchived ? 'success' : 'info',
      );
    } finally {
      projectAssetImportBusyRef.current = false;
      setProjectAssetBatchBusy(false);
    }
  }, [canvasWorkMediaFields, connections, dispatch, ensureCanvasMediaProject, handleTabChange, nodes, phone, result, showToast, state.logged, viewport]);
  const handleImportProjectAssets = useCallback(async (assets = []) => {
    if (projectAssetImportBusyRef.current) return;
    const candidates = (Array.isArray(assets) ? assets : []).filter(asset => canReuseProjectAsset(asset));
    if (!candidates.length) {
      showToast('素材已到期或待清理，请先长期保留后再使用', 'info');
      return;
    }
    projectAssetImportBusyRef.current = true;
    setProjectAssetBatchBusy(true);
    try {
      let session = { nodes, connections, viewport };
      const importedNodes = [];
      let skipped = 0;
      let failed = 0;
      for (const asset of candidates) {
        let reusableAsset = asset;
        if (state.logged && !result.browserQa && asset?.projectId && asset?.projectAssetId) {
          try {
            reusableAsset = await getProjectAsset(asset.projectId, asset.projectAssetId, 'reuse');
          } catch {
            failed += 1;
            continue;
          }
        }
        const imported = importProjectAssetToCanvas({ asset: reusableAsset, source: 'project-library', session });
        if (!imported.added) {
          if (imported.nodeId) setSelected(imported.nodeId);
          skipped += 1;
          continue;
        }
        session = imported.session;
        importedNodes.push(imported.node);
      }
      if (!importedNodes.length) {
        showToast(failed ? '所选素材暂时无法加入画布，请刷新后重试' : '所选素材已经在当前画布中', 'info');
        return;
      }
      const firstAsset = candidates[0];
      const mediaKind = candidates.some(asset => ['video', 'audio'].includes(String(asset?.mediaKind || asset?.media_kind || '').toLowerCase()))
        ? 'video'
        : 'image';
      const label = firstAsset?.metadata?.displayName || firstAsset?.assetId || firstAsset?.role || '项目素材';
      let projectContext = null;
      if (state.logged && !result.browserQa) {
        try {
          projectContext = await ensureCanvasMediaProject(`${label} Canvas 项目`, mediaKind === 'image' ? 'ecommerce' : 'video');
        } catch {
          projectContext = null;
        }
      }
      draftReadyRef.current = true;
      canvasSaveKeyRef.current ||= canvasDraftKey({ ...result, canvasImportId: `project-assets-${Date.now()}` });
      canvasGeneratedWorkKeyRef.current ||= canvasSaveKeyRef.current;
      const nextResult = {
        ...result,
        ...(projectContext ? { projectId: projectContext.projectId, sourceVersionId: projectContext.baseVersionId } : {}),
        _saveKey: result._saveKey || canvasGeneratedWorkKeyRef.current,
      };
      if (projectContext) dispatch({ type: 'SET_RESULT', result: nextResult });
      setNodes(session.nodes);
      setConnections(session.connections);
      const importedIds = importedNodes.map(node => node.id).filter(Boolean);
      setSelected(importedIds[importedIds.length - 1] || null);
      setMultiSelected(new Set(importedIds));
      let savedWork = null;
      if (state.logged) {
        const workResult = {
          ...nextResult,
          product_name: nextResult.product_name || label,
          images: collectCanvasWorkImages({ baseImages: canvasOutputImages(nextResult), nodes: session.nodes }),
          imageRecords: collectCanvasWorkImages({ baseImages: canvasOutputImages(nextResult), nodes: session.nodes }),
          ...canvasWorkMediaFields(nextResult, session.nodes),
        };
        try { savedWork = await saveWork(workResult, phone); } catch { savedWork = null; }
      }
      setSelectedProjectAssetKeys(new Set());
      handleTabChange('canvas');
      const skippedSummary = skipped || failed ? `（跳过 ${skipped + failed} 个）` : '';
      const batchSummary = importedNodes.length > 1 ? `已加入 ${importedNodes.length} 个项目素材` : '项目素材已加入画布';
      showToast(
        projectContext && savedWork?._saveKey
          ? `${batchSummary}${skippedSummary}并保存，不会产生生成或扣费`
          : projectContext
            ? `${batchSummary}${skippedSummary}，本地草稿已保留，云端作品暂未保存`
            : `${batchSummary}${skippedSummary}，本地草稿已保留`,
        projectContext && savedWork?._saveKey ? 'success' : 'info',
      );
    } finally {
      projectAssetImportBusyRef.current = false;
      setProjectAssetBatchBusy(false);
    }
  }, [canvasWorkMediaFields, connections, dispatch, ensureCanvasMediaProject, handleTabChange, nodes, phone, result, showToast, state.logged, viewport]);
  const handleToggleProjectAssetSelection = useCallback(asset => {
    setSelectedProjectAssetKeys(current => toggleProjectAssetSelection(current, asset));
  }, []);
  const handleBatchImportProjectAssets = useCallback(() => {
    const selected = projectAssetLibrary.filter(asset => selectedProjectAssetKeys.has(projectAssetSelectionKey(asset)));
    void handleImportProjectAssets(selected);
  }, [handleImportProjectAssets, projectAssetLibrary, selectedProjectAssetKeys]);
  const handleInspectProjectAsset = useCallback(async (asset) => {
    if (!asset?.projectId || !asset?.projectAssetId) return;
    setProjectAssetLineage({ asset, loading: true, error: '', data: null });
    try {
      const data = await getProjectAssetLineage(asset.projectId, asset.projectAssetId);
      setProjectAssetLineage(current => current?.asset?.projectAssetId === asset.projectAssetId
        ? { asset, loading: false, error: '', data } : current);
    } catch (error) {
      setProjectAssetLineage(current => current?.asset?.projectAssetId === asset.projectAssetId
        ? { asset, loading: false, error: error?.message || '素材关系暂时无法读取', data: null } : current);
    }
  }, []);
  const handleToggleProjectAssetRetention = useCallback(async (asset) => {
    if (!asset?.projectId || !asset?.projectAssetId || projectAssetRetentionBusy) return;
    const key = `${asset.projectId}:${asset.projectAssetId}`;
    setProjectAssetRetentionBusy(key);
    try {
      const updated = await setProjectAssetRetention(asset.projectId, asset.projectAssetId, !asset.retentionPinned);
      setProjectAssetLibrary(current => current.map(item => (
        item.projectId === updated.projectId && item.projectAssetId === updated.projectAssetId
          ? { ...item, ...updated }
          : item
      )));
      showToast(updated.retentionPinned ? '已长期保留此素材' : '已恢复按项目策略保留', 'success');
    } catch (error) {
      showToast(error?.message || '素材保留设置失败，请重试', 'error');
    } finally {
      setProjectAssetRetentionBusy('');
    }
  }, [projectAssetRetentionBusy, showToast]);
  const handleSetProjectAssetProductionState = useCallback(async (asset, productionState) => {
    if (!asset?.projectId || !asset?.projectAssetId || !productionState || projectAssetProductionBusy) return;
    const key = `${asset.projectId}:${asset.projectAssetId}`;
    setProjectAssetProductionBusy(key);
    try {
      const updated = await setProjectAssetProductionState(asset.projectId, asset.projectAssetId, productionState);
      setProjectAssetLibrary(current => current.map(item => (
        item.projectId === updated.projectId && item.projectAssetId === updated.projectAssetId
          ? { ...item, ...updated }
          : item
      )));
      showToast(`已标记为${projectAssetProductionStatus(updated).label}`, 'success');
    } catch (error) {
      showToast(error?.message || '素材生产状态更新失败，请重试', 'error');
    } finally {
      setProjectAssetProductionBusy('');
    }
  }, [projectAssetProductionBusy, showToast]);
  const handleAddWorkToLibrary = useCallback(async (work) => {
    const refs = Array.isArray(work?.projectAssetRefs) ? work.projectAssetRefs : [];
    if (!refs.length) return showToast('该作品暂无可加入素材库的项目素材', 'info');
    let added = 0;
    let failed = 0;
    const seen = new Set();
    for (const ref of refs) {
      const projectId = ref?.projectId || ref?.project_id;
      const projectAssetId = ref?.projectAssetId || ref?.project_asset_id;
      const key = `${projectId}:${projectAssetId}`;
      if (!projectId || !projectAssetId || seen.has(key)) continue;
      seen.add(key);
      try {
        await addToProjectAssetLibrary(projectId, projectAssetId, true);
        added += 1;
      } catch (error) {
        failed += 1;
      }
    }
    if (added) {
      showToast(failed ? `已加入 ${added} 个素材，${failed} 个失败` : `已加入 ${added} 个素材到素材库`, 'success');
    } else {
      showToast(failed ? '素材加入素材库失败，请重试' : '作品素材已全部在素材库中', failed ? 'error' : 'info');
    }
  }, [showToast]);
  // P2 跨域投递入口 a：选中套图产物/节点 → 「发往视频项目」。
  const selectedNodeVideoDelivery = useMemo(() => deliverableRefsFromNodes(selectedNode ? [selectedNode] : []), [selectedNode]);
  const handleSendSelectedToVideoProject = useCallback(node => {
    const refs = deliverableRefsFromNodes(node ? [node] : []);
    if (!refs.length) return showToast('该节点尚未登记为项目素材，暂不能跨域投递', 'info');
    setVideoDelivery({ refs, surface: DELIVERY_SOURCE_SURFACES.ecCanvas });
  }, [showToast]);
  const handleVideoDelivered = useCallback(({ projectId }) => {
    setVideoDelivery(null);
    showToast(`已发往视频项目，可在视频创作工作台「从画布发来」查看（项目 ${String(projectId).slice(-6)}）`, 'success');
  }, [showToast]);
  const deleteWork = async (id) => {
    const work = pastWorks.find(x => x.id === id);
    if (!work) return;
    const deleted = work._saveKey ? await softDeleteWork(work._saveKey) : true;
    if (!deleted) return showToast('移入回收站失败，请重试', 'error');
    const trashItem = stripTransientWorkPlayback({ ...work, deletedAt: Date.now() });
    const next = pastWorks.filter(x => x.id !== id);
    setPastWorks(next);
    setTrashWorks(prev => [trashItem, ...prev.filter(item => String(item._saveKey || item.id) !== String(work._saveKey || work.id))]);
    localStorage.setItem('shubao_ec_works', JSON.stringify(next.map(stripTransientWorkPlayback)));
    try {
      const localTrash = JSON.parse(localStorage.getItem('shubao_ec_trash') || '[]');
      const durableTrash = Array.isArray(localTrash) ? localTrash.map(stripTransientWorkPlayback) : [];
      localStorage.setItem('shubao_ec_trash', JSON.stringify([trashItem, ...durableTrash.filter(item => String(item._saveKey || item.id) !== String(work._saveKey || work.id))]));
    } catch {}
    showToast('已移入回收站，可恢复', 'success');
  };

  const restoreDeletedWork = async (work) => {
    if (!work) return;
    if (work._saveKey) {
      const ok = await restoreWork(work._saveKey);
      if (!ok) return showToast('恢复失败，请重试', 'error');
    }
    setPastWorks(prev => normalizeCanvasWorkPanel({ serverWorks: [work, ...prev], ownerEmail: phone }));
    setTrashWorks(prev => prev.filter(item => String(item._saveKey || item.id) !== String(work._saveKey || work.id)));
    try {
      const localTrash = JSON.parse(localStorage.getItem('shubao_ec_trash') || '[]');
      const durableTrash = Array.isArray(localTrash) ? localTrash.map(stripTransientWorkPlayback) : [];
      localStorage.setItem('shubao_ec_trash', JSON.stringify(durableTrash.filter(item => String(item._saveKey || item.id) !== String(work._saveKey || work.id))));
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
    if (Array.isArray(layer?.ocrBlocks)) {
      setTextCompositionSaving(true);
      setTextCompositionError('');
      try {
        const response = await replaceCanvasText({ image_url: node.url, blocks: layer.ocrBlocks });
        const url = response.result_url || response.url;
        if (!url) throw new Error('文字替换结果为空');
        const output = normalizeCanvasNode({
          ...node,
          id: `node_text_edit_${Date.now()}`,
          kind: 'image',
          status: 'ready',
          url,
          x: node.x + node.w + GAP * 2,
          y: node.y,
          name: `${node.name || node.displayLabel || '电商图'}-文字已替换`,
          displayLabel: `${node.name || node.displayLabel || '电商图'}-文字已替换`,
          sourceNodeIds: [node.id],
        });
        setNodes(previous => [...previous, output]);
        setConnections(previous => [...previous, createChildConnection(node.id, output.id, 'text-edit-output')]);
        setSelected(output.id);
        setMultiSelected(new Set([output.id]));
        showToast('图片文字已替换，原图仍保留', 'success');
      } catch (error) {
        setTextCompositionError(error?.message || '图片文字替换失败');
      } finally {
        setTextCompositionSaving(false);
      }
      return;
    }
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
    const persistenceGeneration = canvasPersistenceGenerationRef.current;
    setCanvasSessionBusy(true);
    try {
      const snapshot = createCanvasSnapshot({ nodes, connections, viewport, pendingProjectAssetImports });
      const session = canvasSession?.id
        ? await saveCanvasSession(canvasSession.id, { expectedRevision: canvasSession.revision, snapshot })
        : await createCanvasSession({ projectId, baseVersionId, snapshot });
      if (canvasPersistenceGenerationRef.current !== persistenceGeneration) return;
      canvasSessionRef.current = session;
      setCanvasSession(session);
      remoteSnapshotRef.current = JSON.stringify(snapshot);
      const saveKey = result._saveKey || canvasGeneratedWorkKeyRef.current;
      let savedWork = null;
      if (saveKey) {
        const workResult = {
          ...result,
          _saveKey: saveKey,
          imageRecords: collectCanvasWorkImages({ baseImages: canvasOutputImages(result), nodes }),
          ...canvasWorkMediaFields(result, nodes),
        };
        delete workResult.canvasSession;
        try {
          savedWork = await saveWork({
            ...workResult,
            canvasSessionId: session.id,
            canvasSessionRevision: session.revision,
          }, phone);
        } catch {
          savedWork = null;
        }
      }
      if (canvasPersistenceGenerationRef.current !== persistenceGeneration) return;
      dispatch({
        type: 'SET_RESULT',
        result: { ...result, canvasSession: session, canvasSessionId: session.id, canvasSessionRevision: session.revision },
      });
      const archiveSucceeded = !saveKey || Boolean(savedWork);
      showToast(
        archiveSucceeded ? '画布已保存' : '画布已保存，本地草稿已保留，云端作品暂未保存',
        archiveSucceeded ? 'success' : 'info',
      );
    } catch (error) {
      showToast(error?.message || '画布保存失败', 'error');
    } finally {
      setCanvasSessionBusy(false);
    }
  }, [canvasSession, canvasWorkMediaFields, connections, dispatch, nodes, pendingProjectAssetImports, phone, result, showToast, viewport]);

  const handleCanvasSessionRestore = useCallback(async () => {
    const sessionId = canvasSession?.id || result.canvasSessionId;
    if (!sessionId) {
      showToast('请先保存画布，再使用恢复命令', 'info');
      return;
    }
    const persistenceGeneration = canvasPersistenceGenerationRef.current;
    setCanvasSessionBusy(true);
    try {
      const session = await loadCanvasSession(sessionId);
      if (canvasPersistenceGenerationRef.current !== persistenceGeneration) return;
      const snapshot = restoreCanvasSnapshot(session.snapshot);
      setNodes(snapshot.nodes.map(normalizeCanvasNode));
      setConnections(snapshot.connections.map(normalizeCanvasConnection));
      setPendingProjectAssetImports(normalizePendingProjectAssetImports(snapshot.pendingProjectAssetImports));
      setViewport(snapshot.viewport);
      setSelected(null);
      setMultiSelected(new Set());
      setCanvasSession(session);
      const restoredMediaRefs = canvasMediaAssetRefs(snapshot.nodes);
      if (restoredMediaRefs.length) {
        const resolvedAssets = (await Promise.all(restoredMediaRefs.map(ref => getProjectAsset(ref.projectId, ref.projectAssetId).catch(() => null))))
          .filter(Boolean);
        if (canvasPersistenceGenerationRef.current !== persistenceGeneration) return;
        setNodes(restoreCanvasMediaPlayback(snapshot.nodes, resolvedAssets).map(normalizeCanvasNode));
      }
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
      priceLabel: option.priceLabel || imageAction?.priceLabel || '免费',
    };
  });
  /* 契约：派生菜单与对象工具条共享同一选中谓词——"选中即双面板齐张"。
     两个面板各自内部再决定渲染什么内容（工具条动作不足时自行收窄），
     但出现/消失必须永远同步。 */
  const selectionPanelsVisible = !focusedEditor && !connectionPicker && multiSelected.size <= 1
    && Boolean(selectedNode)
    && selectedNode.kind !== 'text'
    && !['image-composer', 'text-composer', 'suite-composer', 'video-composer'].includes(selectedNode.kind);
  const visibleWorks = filterCanvasWorks(pastWorks, workCategory);
  const workCategoryCounts = Object.fromEntries(WORK_CATEGORY_OPTIONS.map(option => [
    option.id,
    filterCanvasWorks(pastWorks, option.id).length,
  ]));

  return (
    <div className="ec-canvas-page">
      <CanvasTopBar
        title={tab === 'canvas' ? (result.product_name || '电商画布') : tab === 'assets' ? '项目素材库' : tab === 'trash' ? '回收站' : '我的作品集'}
        meta={tab === 'canvas' ? `${nodes.length} 个资产${multiSelected.size ? ` · ${multiSelected.size} 已选中` : ''}` : tab === 'assets' ? `${visibleProjectAssetLibrary.length} 个可用素材` : `${tab === 'trash' ? trashWorks.length : visibleWorks.length} 个作品`}
        tab={tab}
        onTabChange={handleTabChange}
        activeFilter={activeFilter}
        filters={['全部', ...ASSET_GROUPS]}
        onFilterChange={setActiveFilter}
        onBack={handleBack}
        onExport={() => {
          setExportSelectionIds(new Set());
          setExportMode('images');
          setExportFormat('PNG');
          setExportIntent('suite');
          setExportOpen(true);
        }}
        onRestore={handleCanvasSessionRestore}
        onNew={handleNew}
        saving={canvasSessionBusy}
        canRestore={Boolean(canvasSession?.id || result.canvasSessionId)}
        entitlement={{
          logged: state.logged,
          ecPoints: state.ecPoints,
          unlimited: state.unlimited,
          refreshStatus: state.balanceRefreshStatus,
          onPurchase: () => dispatch({ type: 'SHOW_PRICE', show: true }),
          onLogin: () => dispatch({ type: 'SHOW_LOGIN', show: true }),
        }}
      />

      {tab === 'canvas' ? (
        <div
          ref={containerRef}
          className="ec-canvas-stage"
          style={{ cursor: canvasCursorForState({ tool: activeTool, pointerKind: pointerMode?.kind, spaceKey: spacePressed }) }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={event => {
            if (!event.target?.closest?.('[data-canvas-node-id],button,input,textarea,select,a')) sourceUploadRef.current?.click();
          }}
        >
          <input ref={sourceUploadRef} type="file" accept="image/*" multiple onChange={handleCanvasSourceUpload} style={{ display: 'none' }} />
          <input ref={videoUploadRef} type="file" accept="video/mp4,video/webm,video/quicktime" multiple onChange={handleCanvasVideoUpload} style={{ display: 'none' }} />
          <CanvasLeftRail
            addMenuOpen={addMenuOpen}
            onAddMenuToggle={() => { syncAddMenuAnchor(); setAddMenuOpen(open => !open); }}
          />
          <CanvasAddMenu
            open={addMenuOpen}
            position={addMenuAnchor || { position: 'fixed', left: 68, top: '50%', transform: 'translateY(-50%)' }}
            onClose={() => setAddMenuOpen(false)}
            onSelect={actionId => {
              setAddMenuOpen(false);
              if (actionId === 'upload') sourceUploadRef.current?.click();
              else if (actionId === 'upload-video') videoUploadRef.current?.click();
              else if (actionId === 'works') handleTabChange('works');
              else if (actionId === 'text-generation') addCanvasComposer('text');
              else if (actionId === 'image') addCanvasComposer('image');
              else if (actionId === 'ecommerce') addCanvasComposer('suite');
              else if (actionId === 'video') addCanvasComposer('video');
            }}
          />
          <CanvasBottomToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            onImage={() => { sourceUploadRef.current?.click(); setActiveTool('select'); }}
            onText={() => handleAddTextNode()}
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
              <div
                className="ec-canvas-hero-panel"
                onMouseMove={(event) => {
                  // Cursor spotlight: the glow follows the pointer via CSS
                  // custom properties; pure paint, no layout, no listeners.
                  const el = event.currentTarget;
                  const rect = el.getBoundingClientRect();
                  el.style.setProperty('--ec-spot-x', (((event.clientX - rect.left) / Math.max(1, rect.width)) * 100).toFixed(2) + '%');
                  el.style.setProperty('--ec-spot-y', (((event.clientY - rect.top) / Math.max(1, rect.height)) * 100).toFixed(2) + '%');
                }}
              >
                <strong>从一个素材开始，继续完成整套视觉内容</strong>
                <p>从商品素材开始，AI 帮你完成后续视觉</p>
                {/* 3 行分层: 添加素材 (3 入口) + AI 生成 (2 入口) + 智能 (4 入口)
                   资深美工 + 产品经理视角: 3 行而非 1 行 9 按钮, 视觉密度分层, 认知路径清晰
                   智能行 4 入口走 addCanvasComposer (开 prompt 节点), 不是 handleCreateDerivedNode (需要 source 节点),
                   修复 v2 bug: 空画布时 4 智能按钮无反应 (因为 nodes.length === 0) */}
                <div className="ec-canvas-empty-actions">
                  {/* Row 1 - 添加素材 (3 入口) */}
                  <div className="ec-canvas-empty-row is-primary-row" role="group" aria-label="添加素材">
                    <button type="button" className="is-primary" onClick={() => sourceUploadRef.current?.click()}><HeroGlyph kind="image" />上传图片</button>
                    <button type="button" onClick={() => videoUploadRef.current?.click()}><HeroGlyph kind="video" />上传视频</button>
                    <button type="button" onClick={() => handleTabChange('works')}><HeroGlyph kind="works" />从我的作品导入</button>
                  </div>
                  {/* Row 2 - AI 生成 (2 入口) */}
                  <div className="ec-canvas-empty-row is-generate-row" role="group" aria-label="AI 生成">
                    <button type="button" onClick={() => addCanvasComposer('suite')}><HeroGlyph kind="suite" />生成电商套图</button>
                    <button type="button" onClick={() => addCanvasComposer('video')}><HeroGlyph kind="film" />生成视频</button>
                  </div>
                  {/* Row 3 - 智能 (4 入口) — 不写来源 (用户 8-29 原话: "你为什么要告诉用户这个呢?") */}
                  <div className="ec-canvas-empty-row is-smart-row" role="group" aria-label="智能生成">
                    <button type="button" onClick={() => addCanvasComposer('suite', { actionId: 'one-click-suite' })}><HeroGlyph kind="oneclick" />1-click 套图</button>
                    <button type="button" onClick={() => addCanvasComposer('video', { actionId: 'one-click-video' })}><HeroGlyph kind="oneclick" />1-click 视频</button>
                    <button type="button" onClick={() => addCanvasComposer('text', { actionId: 'tts-voiceover' })}><HeroGlyph kind="voiceover" />TTS 配音</button>
                    <button type="button" onClick={() => addCanvasComposer('text', { actionId: 'caption-motion' })}><HeroGlyph kind="captions" />字幕动效</button>
                  </div>
                </div>

              </div>
            </div>
          )}

          <div style={{ '--canvas-overlay-scale': 1 / Math.max(0.1, viewport.scale), position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`, transformOrigin: '0 0', willChange: 'transform' }}>
            <ConnectionLines connections={connections} nodes={connectionNodes} onRemove={handleRemoveConnection} focusNodeIds={focusedNodeIds} />
            <ConnectionDraftLine draft={connectionDraft || connectionPicker} nodes={connectionNodes} />
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
                  onPortClick={event => handlePortClick(event, node.id)}
                  onHoverChange={setHoveredNodeId}
                  onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
                  onDoubleClick={preview => openImagePreview({ url: preview.url, label: node.name || '商品素材' })}
                />;
              }
              if (node.kind === 'layer-group') {
                return <CanvasGenerationNode
                  key={node.id}
                  node={node}
                  layerChildren={nodes.filter(child => child.parentLayerGroupId === node.id)}
                  selected={selectedNodeState}
                  dimmed={Boolean(focusedNodeIds && !focusedNodeIds.has(node.id))}
                  onPointerDown={handleNodeDown}
                  onResizeStart={(event, corner) => handleNodeResizeStart(event, node.id, corner)}
                  onNaturalSize={handleImageNaturalSize}
                  onHoverChange={setHoveredNodeId}
                  onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
                  onDoubleClick={node => node.url && openImagePreview({ url: node.url, label: '图片预览' })}
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
                  onPortClick={event => handlePortClick(event, node.id)}
                  onResizeStart={(event, corner) => handleNodeResizeStart(event, node.id, corner)}
                  canDerive={canDeriveFromNode(node)}
                  onHoverChange={setHoveredNodeId}
                  onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
                  onDoubleClick={node => openImagePreview({ url: node.url, label: node.name || node.displayLabel || '图片预览' })}
                />;
              }
              if (node.kind === 'audio') {
                return <CanvasAudioNode
                  key={node.id}
                  node={node}
                  selected={selectedNodeState}
                  dimmed={Boolean(focusedNodeIds && !focusedNodeIds.has(node.id))}
                  onPointerDown={handleNodeDown}
                  onResizeStart={(event, corner) => handleNodeResizeStart(event, node.id, corner)}
                  onHoverChange={setHoveredNodeId}
                  onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
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
                  onResizeStart={(event, handle) => handleNodeResizeStart(event, node.id, handle)}
                  onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
                />;
              }
              if (node.kind === 'video' || node.kind === 'image-composer' || node.kind === 'text-composer' || node.kind === 'suite-composer' || node.kind === 'video-composer') {
                return <CanvasGenerationNode
                  key={node.id}
                  node={node}
                  selected={selectedNodeState}
                  dimmed={Boolean(focusedNodeIds && !focusedNodeIds.has(node.id))}
                  onPointerDown={handleNodeDown}
                  onResizeStart={(event, corner) => handleNodeResizeStart(event, node.id, corner)}
                  onHoverChange={setHoveredNodeId}
                  onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
                  onTextChange={handleTextNodeChange}
                  onTextSelect={nodeId => { setSelected(nodeId); setMultiSelected(new Set([nodeId])); }}
                  editing={editingTextNodeId === node.id}
                  onTextDoubleClick={nodeId => { setSelected(nodeId); setMultiSelected(new Set([nodeId])); setEditingTextNodeId(nodeId); }}
                  onTextBlur={nodeId => setEditingTextNodeId(current => current === nodeId ? null : current)}
                  onDoubleClick={node => node.url && openImagePreview({ url: node.url, label: node.name || '图片预览' })}
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
                    outputCount: node.inputs?.outputCount || 1,
                    error: node.error,
                    onPromptChange: value => updateWorkflowInputs(node.id, { prompt: value }),
                    onAddProductImages: files => handleWorkflowAddImages(node.id, 'productImages', files),
                    onRemoveProductImage: image => updateWorkflowInputs(node.id, { productImages: (node.inputs?.productImages || []).filter(item => item.id !== image.id) }),
                    onAddReferenceImages: files => handleWorkflowAddImages(node.id, 'referenceImages', files),
                    onRemoveReferenceImage: image => updateWorkflowInputs(node.id, { referenceImages: (node.inputs?.referenceImages || []).filter(item => item.id !== image.id) }),
                    onOutputCountChange: value => updateWorkflowInputs(node.id, { outputCount: value, generationRunId: null, pendingOutputIndexes: [] }),
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
                    onAddToCanvas: layer => handleWorkflowLayerAddToCanvas(node, layer),
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
            {selectionPanelsVisible && <CanvasObjectToolbar node={selectedNode} viewport={viewport} bounds={containerRef.current?.getBoundingClientRect()} actions={actionsForSurface({ surface: 'selection', node: selectedNode })} onAction={handleToolAction} videoDelivery={selectedNodeVideoDelivery.length ? { enabled: true, onSend: handleSendSelectedToVideoProject } : { enabled: false }} />}
            {selectionPanelsVisible && <CanvasDeriveMenu
              actions={portCreationActions}
              position={clampCanvasPickerPosition({ world: { x: selectedNode.x + selectedNode.w + 28, y: selectedNode.y }, viewport, bounds: containerRef.current?.getBoundingClientRect() })}
              title="引用当前素材生成"
              onClose={() => setSelected(null)}
              onSelect={action => {
                const world = { x: selectedNode.x + selectedNode.w + 28, y: selectedNode.y };
                /* 9 个动作路由 (5 原有 + 4 流影AI LibTV 新增, 用户硬性指定).
                   用户 8-29 原话: "这些功能都是要保留的, 只是之前其中几个功能做的不够好"
                   5 原有走 addCanvasComposer 短路径, 4 流影AI 走 handleCreateDerivedNode 通用派生. */
                if (action.id === 'text-generation') handleAddTextNode({ ...world, sourceNodeId: selectedNode.id, openComposer: true });
                else if (action.id === 'ecommerce-suite') addCanvasComposer('suite', { ...world, sourceNodeId: selectedNode.id });
                else if (action.id === 'video-upload') videoUploadRef.current?.click();
                else if (action.id === 'video-generation') addCanvasComposer('video', { ...world, sourceNodeId: selectedNode.id });
                else if (action.id === 'image-edit') addCanvasComposer('image', { ...world, sourceNodeId: selectedNode.id });
                else if (action.id === 'tts-voiceover') handleCreateDerivedNode(selectedNode.id, getCanvasAction(action.id) || action, world);
                else if (action.id === 'caption-motion') handleCreateDerivedNode(selectedNode.id, getCanvasAction(action.id) || action, world);
                else if (action.id === 'one-click-suite') handleCreateDerivedNode(selectedNode.id, getCanvasAction(action.id) || action, world);
                else if (action.id === 'one-click-video') handleCreateDerivedNode(selectedNode.id, getCanvasAction(action.id) || action, world);
                else handleCreateDerivedNode(selectedNode.id, getCanvasAction(action.id) || action, world);
              }}
            />}
            {!focusedEditor && multiSelected.size <= 1 && ['text', 'text-composer'].includes(selectedNode?.kind) && <CanvasTextToolbar
              node={selectedNode}
              viewport={viewport}
              bounds={containerRef.current?.getBoundingClientRect()}
              onStyleChange={change => setNodes(previous => previous.map(node => node.id === selectedNode.id ? { ...node, textStyle: { ...(node.textStyle || {}), ...change } } : node))}
              onDuplicate={() => handleToolAction(getCanvasAction('duplicate'), selectedNode)}
              onFullscreen={() => setTextInspectorNodeId(selectedNode.id)}
              onDelete={() => handleToolAction(getCanvasAction('delete'), selectedNode)}
            />}
            {!focusedEditor && selectedComposerPosition && selectedNode?.kind === 'image-composer' && <CanvasImageComposer
              node={selectedNode}
              position={selectedComposerPosition}
               sources={selectedComposerSources}
               mentionSources={selectedComposerMentions}
               availableSources={availableComposerSources}
               loading={selectedNode.status === 'processing'}
               activeSurface={activeComposerSurface}
               onSurfaceChange={setActiveComposerSurface}
               onChange={change => updateComposerNode(selectedNode.id, change)}
              onAddSources={files => handleComposerSourceUpload(selectedNode.id, files, 'reference')}
              onRemoveSource={sourceId => removeComposerSource(selectedNode.id, sourceId)}
              onToggleSource={(source, options) => toggleComposerSource(selectedNode.id, source, 'reference', options)}
              onGenerate={() => handleImageComposerGenerate(selectedNode)}
            />}
            {!focusedEditor && selectedComposerPosition && selectedNode?.kind === 'text-composer' && <CanvasTextGenerationComposer
              node={selectedNode}
              position={selectedComposerPosition}
               sources={selectedComposerSources}
               mentionSources={selectedComposerMentions}
               availableSources={availableComposerSources}
               loading={selectedNode.status === 'processing'}
               activeSurface={activeComposerSurface}
               onSurfaceChange={setActiveComposerSurface}
               onChange={change => updateComposerNode(selectedNode.id, change)}
              onAddSources={files => handleComposerSourceUpload(selectedNode.id, files, 'reference')}
              onRemoveSource={sourceId => removeComposerSource(selectedNode.id, sourceId)}
              onToggleSource={(source, options) => toggleComposerSource(selectedNode.id, source, 'reference', options)}
              onGenerate={() => handleTextGenerationGenerate(selectedNode)}
            />}
            {!focusedEditor && selectedComposerPosition && selectedNode?.kind === 'suite-composer' && <CanvasEcommerceComposer
              node={selectedNode}
              position={selectedComposerPosition}
               sources={selectedComposerSources}
               mentionSources={selectedComposerMentions}
               availableSources={availableComposerSources}
               loading={selectedNode.status === 'processing'}
               activeSurface={activeComposerSurface}
               onSurfaceChange={setActiveComposerSurface}
               onChange={change => updateComposerNode(selectedNode.id, change)}
              onAddSources={(files, role) => handleComposerSourceUpload(selectedNode.id, files, role)}
               onRemoveSource={sourceId => removeComposerSource(selectedNode.id, sourceId)}
               onToggleSource={(source, role, options) => toggleComposerSource(selectedNode.id, source, role, options)}
               onGenerate={() => handleSuiteComposerGenerate(selectedNode)}
             />}
            {!focusedEditor && selectedComposerPosition && selectedNode?.kind === 'video-composer' && <CanvasVideoComposer
              node={selectedNode}
              position={selectedComposerPosition}
              sources={selectedComposerSources}
              loading={selectedNode.status === 'processing'}
              onChange={change => updateComposerNode(selectedNode.id, change)}
              onAddSources={(files, role) => handleComposerSourceUpload(selectedNode.id, files, role)}
              onRemoveSource={sourceId => removeComposerSource(selectedNode.id, sourceId)}
              onAnalyze={() => handleVideoComposerAnalyze(selectedNode)}
              onGenerate={() => handleVideoComposerGenerate(selectedNode)}
            />}
            {connectionPicker && <CanvasDeriveMenu
              actions={connectionPicker.mode === 'image-editor'
                ? actionsForSurface({ surface: 'image-editor', node: nodes.find(node => node.id === connectionPicker.sourceNodeId) })
                : portCreationActions}
              position={clampCanvasPickerPosition({
                world: connectionPicker.world,
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
                } else if (action.id === 'video-upload') {
                  videoUploadRef.current?.click();
                } else if (action.id === 'video-generation') {
                  addCanvasComposer('video', { ...connectionPicker.world, sourceNodeId: connectionPicker.sourceNodeId });
                } else if (action.id === 'image-edit' && connectionPicker.mode !== 'image-editor') {
                  // The right-side image action is the same generation node as
                  // the left rail. Its only extra behavior is carrying the
                  // selected image into the prompt/reference context.
                  addCanvasComposer('image', { ...connectionPicker.world, sourceNodeId: connectionPicker.sourceNodeId });
                } else if (connectionPicker.mode === 'image-editor' && ['product-remix', 'outpaint', 'inpaint', 'translate', 'upscale'].includes(action.id)) {
                  addCanvasComposer('image', { ...connectionPicker.world, sourceNodeId: connectionPicker.sourceNodeId, actionId: action.id === 'outpaint' ? 'extend' : action.id, selection: action.id === 'inpaint' ? { mode: 'whole' } : undefined });
                } else {
                  handleCreateDerivedNode(connectionPicker.sourceNodeId, getCanvasAction(action.id) || action, connectionPicker.world);
                }
                setConnectionPicker(null);
                setConnectionDraft(null);
              }}
            />}
            {textInspectorNode && (
              <TextLayerInspector
                layer={defaultTextLayerForNode(textInspectorNode)}
                ocrMode={textInspectorNode.kind === 'image' || textInspectorNode.kind === 'output'}
                ocrBlocks={textInspectorNode.kind === 'image' || textInspectorNode.kind === 'output' ? textOcrBlocks : null}
                ocrLoading={textOcrLoading}
                position={{
                  left: textInspectorNode.x + textInspectorNode.w + 12 / Math.max(0.15, viewport.scale || 1),
                  top: textInspectorNode.y,
                }}
                saving={textCompositionSaving}
                error={textCompositionError}
                onRecognize={() => handleRecognizeCanvasText(textInspectorNode)}
                onSave={handleSaveTextLayer}
                onClose={() => { setTextInspectorNodeId(null); setTextCompositionError(''); }}
              />
            )}
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
            <div style={{ position: 'absolute', left: marquee.x * viewport.scale + viewport.x, top: marquee.y * viewport.scale + viewport.y, width: marquee.w * viewport.scale, height: marquee.h * viewport.scale, border: '1px solid #7c3aed', background: 'rgba(124,58,237,.10)', pointerEvents: 'none', zIndex: 20 }} />
          )}

        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 20px 72px' }}>
          {tab === 'works' && <div className="ec-canvas-work-filters" role="tablist" aria-label="作品分类">
            {WORK_CATEGORY_OPTIONS.map(option => <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={workCategory === option.id}
              className={workCategory === option.id ? 'is-active' : ''}
              onClick={() => setWorkCategory(option.id)}
            >{option.label}<span>{workCategoryCounts[option.id]}</span></button>)}
          </div>}
          {tab === 'assets' && state.logged && (
            <section aria-labelledby="canvas-project-assets-title" style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <div>
                  <h2 id="canvas-project-assets-title" style={{ margin: 0, fontSize: 16, lineHeight: 1.3, color: '#1f2937' }}>项目素材</h2>
                  <div style={{ marginTop: 4, color: '#8a929d', fontSize: 11 }}>图片、视频和音频 · 可搜索、可长期保留、可继续使用</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#9aa1aa', fontSize: 11 }}>{visibleProjectAssetLibrary.length}{visibleProjectAssetLibrary.length !== projectAssetLibrary.length ? ` / ${projectAssetLibrary.length}` : ''} 个</span>
                  {selectedProjectAssetKeys.size > 0 && <button
                    type="button"
                    disabled={projectAssetBatchBusy || projectAssetImportBusyRef.current}
                    onClick={handleBatchImportProjectAssets}
                    aria-label={`加入所选 ${selectedProjectAssetKeys.size} 个素材到画布`}
                    title="加入所选素材到画布"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 28, padding: '0 8px', border: '1px solid #bfdbfe', borderRadius: 7, background: '#eff6ff', color: '#2563eb', fontSize: 11, cursor: 'pointer' }}
                  ><Plus size={14} />加入所选 {selectedProjectAssetKeys.size}</button>}
                </div>
              </div>
              <div className="ec-project-asset-filters" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) auto auto', gap: 8, marginBottom: 9 }}>
                <label style={{ position: 'relative', minWidth: 0 }}>
                  <span className="sr-only">搜索项目素材</span>
                  <input
                    type="search"
                    value={projectAssetQuery}
                    onChange={event => setProjectAssetQuery(event.target.value)}
                    placeholder="搜索素材名称、项目或角色"
                    aria-label="搜索项目素材"
                    style={{ width: '100%', height: 32, boxSizing: 'border-box', padding: '0 10px', border: '1px solid #e1e5eb', borderRadius: 8, outline: 0, color: '#334155', fontSize: 11, background: '#fff' }}
                  />
                </label>
                <select
                  aria-label="筛选素材保留状态"
                  value={projectAssetRetentionFilter}
                  onChange={event => setProjectAssetRetentionFilter(event.target.value)}
                  style={{ height: 32, minWidth: 112, padding: '0 8px', border: '1px solid #e1e5eb', borderRadius: 8, background: '#fff', color: '#475569', fontSize: 11 }}
                >
                  {PROJECT_ASSET_RETENTION_FILTERS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <select
                  aria-label="筛选素材生产状态"
                  value={projectAssetProductionFilter}
                  onChange={event => setProjectAssetProductionFilter(event.target.value)}
                  style={{ height: 32, minWidth: 112, padding: '0 8px', border: '1px solid #e1e5eb', borderRadius: 8, background: '#fff', color: '#475569', fontSize: 11 }}
                >
                  {PROJECT_ASSET_PRODUCTION_FILTERS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </div>
              <div role="tablist" aria-label="项目素材类型" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {[['', '全部'], ['image', '图片'], ['video', '视频'], ['audio', '音频']].map(([value, label]) => <button
                  key={value || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={projectAssetMediaFilter === value}
                  onClick={() => setProjectAssetMediaFilter(value)}
                  style={{ padding: '5px 10px', border: `1px solid ${projectAssetMediaFilter === value ? '#cbd5e1' : '#edf0f3'}`, borderRadius: 999, background: projectAssetMediaFilter === value ? '#f1f5f9' : '#fff', color: '#475569', fontSize: 11, cursor: 'pointer' }}
                >{label}</button>)}
              </div>
              {projectAssetLibraryLoading ? (
                <div style={{ padding: '18px 16px', border: '1px solid #edf0f3', borderRadius: 10, background: '#fff', color: '#8a929d', fontSize: 12 }}>正在读取素材</div>
              ) : projectAssetLibraryError ? (
                <div role="alert" style={{ padding: '14px 16px', border: '1px solid #fecaca', borderRadius: 10, background: '#fff7f7', color: '#b42318', fontSize: 12 }}>{projectAssetLibraryError}</div>
              ) : visibleProjectAssetLibrary.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10 }}>
                  {visibleProjectAssetLibrary.map(asset => {
                    const mediaKind = String(asset.mediaKind || '').toLowerCase();
                    const label = asset.metadata?.displayName || asset.assetId || asset.role || (mediaKind === 'video' ? '项目视频' : mediaKind === 'audio' ? '项目音频' : '项目图片');
                    const projectTitle = asset.project?.title || asset.projectTitle || '未命名项目';
                    const retention = projectAssetRetentionStatus(asset);
                    const production = projectAssetProductionStatus(asset);
                    const reusable = canReuseProjectAsset(asset);
                    const selectionKey = projectAssetSelectionKey(asset);
                    const selectedForBatch = selectedProjectAssetKeys.has(selectionKey);
                    return <article
                      key={`${asset.projectId}:${asset.projectAssetId}:${asset.contentHash}`}
                      style={{ minWidth: 0, padding: 0, overflow: 'hidden', textAlign: 'left', border: '1px solid #e7eaee', borderRadius: 10, background: '#fff', color: '#26313c', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'block', width: '100%', color: 'inherit', textAlign: 'left' }}>
                        <div style={{ height: 104, display: 'grid', placeItems: 'center', overflow: 'hidden', background: mediaKind === 'video' ? '#111827' : '#f4f5f7' }}>
                        {mediaKind === 'image' ? <ResponsiveImage src={proxyImg(asset.stableUrl)} variant="thumb" ratio="1:1" alt="" style={{ width: '100%', height: '100%' }} imgStyle={{ objectFit: 'cover' }} />
                          : mediaKind === 'video' ? <video src={asset.playbackUrl || asset.stableUrl} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : mediaKind === 'audio' ? <audio src={asset.playbackUrl || asset.stableUrl} controls preload="metadata" aria-label={label} style={{ width: 'calc(100% - 16px)', height: 36 }} />
                              : <Music size={28} color="#64748b" />}
                        </div>
                        <div style={{ padding: '8px 9px 4px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700 }}>{label}</div>
                        <div style={{ marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: '#8a929d' }}>{projectTitle}</div>
                        <div title={retention.detail} style={{ display: 'inline-flex', maxWidth: '100%', marginTop: 6, padding: '2px 5px', borderRadius: 4, background: retention.tone === 'pinned' ? '#eff6ff' : retention.tone === 'attention' ? '#fff7ed' : '#f8fafc', color: retention.tone === 'pinned' ? '#2563eb' : retention.tone === 'attention' ? '#b45309' : '#64748b', fontSize: 9, lineHeight: 1.3 }}>{retention.label}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 5 }}>
                          <span title={production.detail} style={{ display: 'inline-flex', padding: '2px 5px', borderRadius: 4, background: production.tone === 'delivered' ? '#ecfdf3' : production.tone === 'candidate' ? '#eff6ff' : production.tone === 'archived' ? '#f3f4f6' : '#fff7ed', color: production.tone === 'delivered' ? '#047857' : production.tone === 'candidate' ? '#2563eb' : production.tone === 'archived' ? '#6b7280' : '#b45309', fontSize: 9, lineHeight: 1.3 }}>{production.label}</span>
                          <select
                            aria-label={`更新${label}的生产状态`}
                            value={production.id}
                            disabled={projectAssetProductionBusy === `${asset.projectId}:${asset.projectAssetId}`}
                            onChange={event => handleSetProjectAssetProductionState(asset, event.target.value)}
                            style={{ minWidth: 0, maxWidth: '100%', height: 22, padding: '0 3px', border: '1px solid #edf0f3', borderRadius: 4, color: '#64748b', background: '#fff', fontSize: 9 }}
                          >
                            {projectAssetProductionOptions(asset).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                          </select>
                        </div>
                        </div>
                      </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 8px 8px', borderTop: '1px solid #f1f3f5' }}>
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: '#9aa1aa' }}>{asset.role || '稳定引用'}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
                          <button
                            type="button"
                            disabled={!reusable || !selectionKey || projectAssetBatchBusy}
                            aria-label={selectedForBatch ? `取消选择${label}` : `选择${label}`}
                            aria-pressed={selectedForBatch}
                            title={selectedForBatch ? '取消选择' : reusable ? '选择加入批次' : '素材已到期或待清理'}
                            onClick={() => handleToggleProjectAssetSelection(asset)}
                            style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: `1px solid ${selectedForBatch ? '#93c5fd' : '#e5e7eb'}`, borderRadius: 6, background: selectedForBatch ? '#dbeafe' : '#fff', color: selectedForBatch ? '#2563eb' : reusable ? '#94a3b8' : '#d1d5db', cursor: reusable ? 'pointer' : 'not-allowed' }}
                          >{selectedForBatch ? <SquareCheck size={16} /> : <Square size={16} />}</button>
                          <button type="button" aria-label={asset.retentionPinned ? `取消长期保留${label}` : `长期保留${label}`} aria-pressed={Boolean(asset.retentionPinned)} title={asset.retentionPinned ? '取消长期保留' : '长期保留'} disabled={projectAssetRetentionBusy === `${asset.projectId}:${asset.projectAssetId}`} onClick={() => handleToggleProjectAssetRetention(asset)} style={{ width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: `1px solid ${asset.retentionPinned ? '#bfdbfe' : '#e5e7eb'}`, borderRadius: 6, background: asset.retentionPinned ? '#eff6ff' : '#fff', color: asset.retentionPinned ? '#2563eb' : '#94a3b8', cursor: 'pointer' }}><Pin size={13} /></button>
                          <button type="button" disabled={!reusable} aria-label={reusable ? `加入当前画布${label}` : `先长期保留${label}`} title={reusable ? '加入当前画布' : '素材已到期或待清理，请先长期保留'} onClick={() => handleImportProjectAsset(asset)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 6px', border: `1px solid ${reusable ? '#dbeafe' : '#e5e7eb'}`, borderRadius: 6, background: reusable ? '#eff6ff' : '#f8fafc', color: reusable ? '#2563eb' : '#98a2b3', fontSize: 10, cursor: reusable ? 'pointer' : 'not-allowed' }}>{reusable ? '加入' : '先保留'}</button>
                          <button type="button" aria-label={`查看${label}的来源和派生关系`} title="查看来源和派生关系" onClick={() => handleInspectProjectAsset(asset)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 6px', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#64748b', fontSize: 10, cursor: 'pointer' }}>关系</button>
                        </div>
                      </div>
                    </article>;
                  })}
                </div>
              ) : (
                <div style={{ padding: '18px 16px', border: '1px solid #edf0f3', borderRadius: 10, background: '#fff', color: '#8a929d', fontSize: 12 }}>{projectAssetLibrary.length ? '没有符合当前搜索或筛选条件的素材' : '暂无可用项目素材'}</div>
              )}
            </section>
          )}
          {tab === 'assets' && !state.logged && (
            <div className="ec-canvas-work-empty">
              <Grid3x3 size={42} />
              <strong>登录后查看素材库</strong>
              <span>登录后管理图片、视频和音频素材，并继续用于新的创作。</span>
              <button type="button" onClick={() => dispatch({ type: 'SHOW_LOGIN', show: true })}>立即登录</button>
            </div>
          )}
          {(tab === 'works' || tab === 'trash') && (!state.logged ? (
            <div className="ec-canvas-work-empty">
              <Images size={42} />
              <strong>登录后查看作品</strong>
              <span>你的电商套图、小红书图文、AI 视频、自由创作和画布内容都会保存在这里</span>
              <button type="button" onClick={() => dispatch({ type: 'SHOW_LOGIN', show: true })}>立即登录</button>
            </div>
          ) : worksLoading ? (
            <div role="status" style={{ textAlign: 'center', padding: '80px 20px', color: '#8a929d', fontSize: 13 }}>正在读取作品</div>
          ) : ((tab === 'trash' ? trashWorks : visibleWorks).length === 0) ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.15 }}>{tab === 'trash' ? '🗑️' : '📁'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#999' }}>{tab === 'trash' ? '回收站是空的' : workCategory === 'all' ? '还没有作品' : '这个分类还没有作品'}</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
              {(tab === 'trash' ? trashWorks : visibleWorks).map(work => (
                <div key={work.id} style={{ borderRadius: 16, overflow: 'hidden', background: '#fff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{work.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#999', marginTop: 3 }}>
                        <span className={`ec-canvas-work-kind is-${canvasWorkCategory(work)}`}>{canvasWorkCategory(work) === 'ecommerce' ? '电商' : canvasWorkCategory(work) === 'xhs' ? '小红书' : canvasWorkCategory(work) === 'video' ? '视频' : canvasWorkCategory(work)}</span>
                        <span>{canvasWorkCategory(work) === 'video'
                          ? work.video?.duration
                            ? `${work.video.duration} 秒 · ${String(work.video?.resolution || '').toUpperCase()}`
                            : `${work.mediaAssets?.length || 0} 个媒体素材`
                          : `${work.images?.length || 0} 张图片`}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button type="button" aria-label={`打开${work.name}`} title="打开作品" onClick={() => openWork(work)} style={{ width: 30, height: 30, padding: 0, border: 0, borderRadius: 8, background: 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7c3aed' }}><ExternalLink size={14} /></button>
                      <button type="button" aria-label={`将${work.name}加入素材库`} title="加入素材库" onClick={() => handleAddWorkToLibrary(work)} style={{ width: 30, height: 30, padding: 0, border: 0, borderRadius: 8, background: 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7c3aed' }}><FolderPlus size={14} /></button>
                      {tab === 'trash' ? (
                        <button type="button" aria-label="恢复作品" onClick={() => restoreDeletedWork(work)} title="恢复作品" style={{ width: 30, height: 30, padding: 0, border: 0, borderRadius: 8, background: 'rgba(16,185,129,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#059669', fontSize: 11, fontWeight: 700 }}>恢复</button>
                      ) : (
                        <button type="button" aria-label="移入回收站" onClick={() => deleteWork(work.id)} title="移入回收站" style={{ width: 30, height: 30, padding: 0, border: 0, borderRadius: 8, background: 'rgba(239,68,68,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, padding: '0 14px 12px', overflowX: 'auto' }}>
                    {canvasWorkCategory(work) === 'video' && work.videoUrl ? <video src={work.videoUrl} controls playsInline preload="metadata" style={{ width: '100%', height: 180, objectFit: 'contain', borderRadius: 8, background: '#111827' }} /> : (work.images || []).slice(0, 6).map((img, i) => (
                      <button key={i} type="button" onClick={() => openImagePreview({ url: proxyImg(img), label: img.label || '' })} style={{ width: 72, height: 72, padding: 0, overflow: 'hidden', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)', flexShrink: 0, cursor: 'zoom-in', background: '#f3f4f6' }}>
                        <ResponsiveImage src={img} variant="thumb" ratio="1:1" alt={img.label || `作品图片 ${i + 1}`} style={{ width: '100%', height: '100%' }} imgStyle={{ objectFit: 'cover' }} />
                      </button>
                    ))}
                    {!work.videoUrl && !work.images?.length && work.productAssets?.length ? work.productAssets.map((asset, index) => (
                      <button key={`${asset.projectAssetId || asset.assetId || index}`} type="button" onClick={() => openImagePreview({ url: proxyImg(asset.url || asset.stableUrl), label: asset.name || asset.label || `项目图片 ${index + 1}` })} style={{ width: 180, height: 72, padding: 0, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8, flexShrink: 0, cursor: 'zoom-in', background: '#f3f4f6' }}>
                        <ResponsiveImage src={proxyImg(asset.url || asset.stableUrl)} variant="thumb" ratio="1:1" alt={asset.name || asset.label || `项目图片 ${index + 1}`} style={{ width: '100%', height: '100%' }} imgStyle={{ objectFit: 'cover' }} />
                      </button>
                    )) : null}
                    {(work.mediaAssets || []).map((asset, index) => {
                      const mediaUrl = asset.playbackUrl || asset.url || asset.stableUrl;
                      if (!mediaUrl || (asset.mediaKind === 'video' && work.videoUrl)) return null;
                      const label = asset.name || asset.displayName || asset.role || `${asset.mediaKind === 'video' ? '视频' : '音频'}素材 ${index + 1}`;
                      return asset.mediaKind === 'video' ? <video key={`media-${asset.projectAssetId || asset.assetId || index}`} src={mediaUrl} controls playsInline preload="metadata" aria-label={label} style={{ width: 220, height: 124, objectFit: 'contain', borderRadius: 8, background: '#111827', flexShrink: 0 }} /> : asset.mediaKind === 'audio' ? (
                        <div key={`media-${asset.projectAssetId || asset.assetId || index}`} style={{ minWidth: 240, height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, padding: '0 10px', boxSizing: 'border-box', border: '1px solid rgba(0,0,0,0.06)', borderRadius: 8, background: '#f8fafc', color: '#475569', flexShrink: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}><Music size={20} />{label}</span>
                          <audio src={mediaUrl} controls preload="metadata" aria-label={label} style={{ width: '100%', height: 30 }} />
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
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

      {/* P2: 跨域投递对话框（EcCanvas → 视频项目） */}
      <VideoProjectDeliveryDialog
        open={Boolean(videoDelivery)}
        refs={videoDelivery?.refs || []}
        surface={videoDelivery?.surface || ''}
        onClose={() => setVideoDelivery(null)}
        onDelivered={handleVideoDelivered}
      />

      {imageInfoNode && (
        <div role="dialog" aria-modal="true" aria-labelledby="canvas-image-info-title" style={{ position: 'fixed', inset: 0, zIndex: 10005, background: 'rgba(15,23,42,.38)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <div style={{ width: 'min(430px, 100%)', boxSizing: 'border-box', background: '#fff', borderRadius: 8, boxShadow: '0 24px 70px rgba(15,23,42,.24)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div id="canvas-image-info-title" style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>图片信息</div>
                <div style={{ marginTop: 3, fontSize: 11, color: '#6b7280' }}>名称与用途会显示在画布和交付信息中</div>
              </div>
              <button type="button" aria-label="关闭图片信息" onClick={() => setImageInfoNode(null)} style={{ width: 30, height: 30, border: 0, borderRadius: 7, background: '#f3f4f6', color: '#4b5563', cursor: 'pointer' }}><X size={17} /></button>
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
          <div style={{ width: 'min(520px,100%)', maxHeight: 'min(760px, calc(100vh - 40px))', overflow: 'auto', background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 24px 70px rgba(15,23,42,.24)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}><div><div style={{ fontSize: 16, fontWeight: 800 }}>{exportIntent === 'single' ? '图片另存为' : '电商图片交付'}</div><div style={{ fontSize: 12, color: '#68717d', marginTop: 3 }}>将交付 {exportMode === 'long-detail' ? 1 : exportScope.deliverables.length} 张生成结果{exportScope.excludedSources.length ? `，已排除 ${exportScope.excludedSources.length} 张原始素材` : ''}</div></div><button type="button" aria-label="关闭导出" title="关闭" disabled={isExportDeliveryBusy(exportDelivery)} onClick={() => setExportOpen(false)} style={{ border: 0, background: '#f3f4f6', borderRadius: 8, width: 30, height: 30, cursor: isExportDeliveryBusy(exportDelivery) ? 'not-allowed' : 'pointer', opacity: isExportDeliveryBusy(exportDelivery) ? .45 : 1 }}>×</button></div>
            <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
              {[['images', exportIntent === 'single' ? '另存为' : '导出整套图片', exportIntent === 'single' ? '选择文件名后，再确认开始导出' : '选择文件夹后，只导出生成图片'], ['long-detail', '合成并导出详情长图', canExportLongDetail ? '按下方顺序无缝拼接为一张长图' : '至少需要 2 张已生成的详情图']].map(([mode, label, desc]) => {
                const disabled = (mode === 'long-detail' && !canExportLongDetail) || isExportDeliveryBusy(exportDelivery) || exportIntent === 'single' && mode === 'long-detail';
                return <button key={mode} type="button" disabled={disabled} onClick={() => { configureExport(mode); setExportIntent(mode === 'long-detail' ? 'long-detail' : exportIntent); }} style={{ textAlign: 'left', border: exportMode === mode ? '1.5px solid #2563eb' : '1px solid #dfe3e8', borderRadius: 8, padding: '9px 11px', background: exportMode === mode ? '#eff5ff' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .52 : 1 }}><div style={{ fontSize: 13, fontWeight: 750, color: '#303640' }}>{label}</div><div style={{ fontSize: 11, color: '#7b8490', marginTop: 2 }}>{desc}</div></button>;
              })}
            </div>
            {exportMode === 'long-detail' && <div style={{ borderTop: '1px solid #edf0f3', paddingTop: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><strong style={{ fontSize: 12 }}>长图顺序</strong><span style={{ fontSize: 11, color: '#7b8490' }}>从上到下拼接</span></div>
              <div style={{ display: 'grid', gap: 6 }}>
                {orderedDetailNodes.map((node, index) => <div key={node.id} style={{ minHeight: 44, display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) 30px 30px', alignItems: 'center', gap: 7, padding: '5px 6px', border: '1px solid #e4e7eb', borderRadius: 7, background: '#fafbfc' }}>
                  <img src={proxyImg(node.url)} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 4, background: '#eef0f2' }} />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: '#343a43' }}>{index + 1}. {node.name || node.role || '详情图'}</span>
                  <button type="button" aria-label={`上移${node.name || '详情图'}`} title="上移" disabled={index === 0} onClick={() => setDetailOrderIds(ids => moveDetailItem(ids, index, index - 1))} style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', border: 0, borderRadius: 6, background: '#eef1f4', color: '#4f5864', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? .35 : 1 }}><ArrowUp size={15} /></button>
                  <button type="button" aria-label={`下移${node.name || '详情图'}`} title="下移" disabled={index === orderedDetailNodes.length - 1} onClick={() => setDetailOrderIds(ids => moveDetailItem(ids, index, index + 1))} style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', border: 0, borderRadius: 6, background: '#eef1f4', color: '#4f5864', cursor: index === orderedDetailNodes.length - 1 ? 'not-allowed' : 'pointer', opacity: index === orderedDetailNodes.length - 1 ? .35 : 1 }}><ArrowDown size={15} /></button>
                </div>)}
                {orderedDetailNodes.length < 2 && <div style={{ padding: '10px 11px', borderRadius: 7, background: '#fff7ed', color: '#9a5b13', fontSize: 12 }}>请至少选择 2 张已生成的详情图。</div>}
              </div>
            </div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 15 }}><span style={{ fontSize: 11, color: '#6b7280' }}>交付格式</span>{['PNG', 'JPG'].map(format => <button key={format} type="button" disabled={isExportDeliveryBusy(exportDelivery)} onClick={() => configureExport(exportMode, format)} style={{ border: 0, borderRadius: 999, padding: '5px 10px', background: exportFormat === format ? '#1f2937' : '#f3f4f6', color: exportFormat === format ? '#fff' : '#666', fontSize: 10, cursor: isExportDeliveryBusy(exportDelivery) ? 'not-allowed' : 'pointer', opacity: isExportDeliveryBusy(exportDelivery) ? .5 : 1 }}>{format}</button>)}</div>
            {exportDelivery.destination && <div style={{ marginBottom: 12, padding: '9px 11px', border: '1px solid #dbe4ee', borderRadius: 8, background: '#f8fafc', fontSize: 12, color: '#475569' }}><strong style={{ color: '#1f2937' }}>保存位置：</strong>{exportDelivery.destination.name}</div>}
            {(exportDelivery.status === 'preparing' || exportDelivery.status === 'writing') && <div style={{ marginBottom: 12, fontSize: 12, color: '#475569' }}>{exportDelivery.status === 'preparing' ? '正在校验图片' : '正在写入文件'} · {exportDelivery.progress.completed}/{exportDelivery.progress.total}</div>}
            {exportDelivery.status === 'success' && <div style={{ marginBottom: 12, padding: '9px 11px', borderRadius: 8, background: '#ecfdf5', color: '#047857', fontSize: 12, fontWeight: 700 }}>{exportDelivery.result?.verification === 'filesystem' ? '已验证写入' : '已开始下载'} {exportDelivery.result?.count || 0} 张图片{exportDelivery.result?.verification === 'filesystem' ? `到 ${exportDelivery.destination?.name || '所选位置'}` : '，请在浏览器下载列表确认'}</div>}
            {exportDelivery.status === 'cancelled' && <div style={{ marginBottom: 12, padding: '9px 11px', borderRadius: 8, background: '#f8fafc', color: '#64748b', fontSize: 12 }}>已取消选择保存位置，导出配置仍保留。</div>}
            {exportDelivery.status === 'error' && <div role="alert" style={{ marginBottom: 12, padding: '9px 11px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 12 }}>{exportDelivery.error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" disabled={isExportDeliveryBusy(exportDelivery)} onClick={() => setExportOpen(false)} style={{ border: 0, borderRadius: 8, padding: '9px 13px', background: '#f3f4f6', cursor: isExportDeliveryBusy(exportDelivery) ? 'not-allowed' : 'pointer', opacity: isExportDeliveryBusy(exportDelivery) ? .45 : 1 }}>{exportDelivery.status === 'success' ? '完成' : '取消'}</button>
              <button type="button" disabled={isExportDeliveryBusy(exportDelivery) || !exportScope.deliverables.length || (exportMode === 'long-detail' && !canExportLongDetail)} onClick={handleChooseExportDestination} style={{ border: '1px solid #d7dde5', borderRadius: 8, padding: '9px 13px', background: '#fff', color: '#374151', fontWeight: 700, cursor: isExportDeliveryBusy(exportDelivery) ? 'not-allowed' : 'pointer' }}>{exportDelivery.destination ? '更改保存位置' : '选择保存位置'}</button>
              {exportDelivery.destination && <button type="button" disabled={isExportDeliveryBusy(exportDelivery)} onClick={handleStartExport} style={{ border: 0, borderRadius: 8, padding: '9px 16px', display: 'inline-flex', alignItems: 'center', gap: 6, background: '#047857', color: '#fff', fontWeight: 800, cursor: isExportDeliveryBusy(exportDelivery) ? 'not-allowed' : 'pointer', opacity: isExportDeliveryBusy(exportDelivery) ? .55 : 1 }}><FileDown size={14} /> {exportDelivery.status === 'success' ? '再次导出' : '开始导出'}</button>}
            </div>
          </div>
        </div>
      )}

      {projectAssetLineage && (
        <div role="presentation" onMouseDown={() => setProjectAssetLineage(null)} style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(15,23,42,.42)', backdropFilter: 'blur(6px)' }}>
          <section role="dialog" aria-modal="true" aria-labelledby="project-asset-lineage-title" onMouseDown={event => event.stopPropagation()} style={{ width: 'min(520px, 100%)', maxHeight: 'min(680px, 92vh)', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff', boxShadow: '0 24px 80px rgba(15,23,42,.24)' }}>
            <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 20px 14px', borderBottom: '1px solid #eef0f2' }}>
              <div style={{ minWidth: 0 }}>
                <h2 id="project-asset-lineage-title" style={{ margin: 0, color: '#1f2937', fontSize: 17 }}>素材关系</h2>
                <div style={{ marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#667085', fontSize: 12 }}>{projectAssetLineage.asset?.metadata?.displayName || projectAssetLineage.asset?.assetId || '项目素材'}</div>
              </div>
              <button type="button" aria-label="关闭素材关系" title="关闭" onClick={() => setProjectAssetLineage(null)} style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, flex: '0 0 auto', border: 0, borderRadius: 7, background: '#f3f4f6', color: '#4b5563', cursor: 'pointer' }}><X size={17} /></button>
            </header>
            <div style={{ padding: '16px 20px 20px' }}>
              {projectAssetLineage.loading ? <div style={{ color: '#667085', fontSize: 13 }}>正在读取素材关系</div> : projectAssetLineage.error ? <div role="alert" style={{ padding: 12, border: '1px solid #fecaca', borderRadius: 8, background: '#fff7f7', color: '#b42318', fontSize: 12 }}>{projectAssetLineage.error}</div> : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginBottom: 16 }}>
                    <div style={{ padding: '10px 11px', borderRadius: 8, background: '#f8fafc' }}><strong style={{ display: 'block', color: '#334155', fontSize: 12 }}>当前项目</strong><span style={{ display: 'block', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b', fontSize: 11 }}>{projectAssetLineage.data?.asset?.project?.title || '未命名项目'}</span></div>
                    <div style={{ padding: '10px 11px', borderRadius: 8, background: '#f8fafc' }}><strong style={{ display: 'block', color: '#334155', fontSize: 12 }}>内容指纹</strong><span style={{ display: 'block', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b', fontSize: 11 }}>{String(projectAssetLineage.data?.asset?.contentHash || '').slice(0, 16) || '无'}</span></div>
                  </div>
                  {[['来源素材', projectAssetLineage.data?.parents || [], '暂无同项目来源'], ['派生结果', projectAssetLineage.data?.children || [], '暂无同项目派生']].map(([title, items, empty]) => <section key={title} style={{ marginTop: 14 }}>
                    <h3 style={{ margin: '0 0 8px', color: '#334155', fontSize: 13 }}>{title}<span style={{ marginLeft: 6, color: '#94a3b8', fontWeight: 500 }}>{items.length}</span></h3>
                    {items.length ? <div style={{ display: 'grid', gap: 7 }}>{items.map(item => <div key={`${item.projectAssetId}:${item.relation}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 10px', border: '1px solid #eef0f2', borderRadius: 8 }}><div style={{ minWidth: 0 }}><strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#475569', fontSize: 12 }}>{item.assetId || '项目素材'}</strong><span style={{ display: 'block', marginTop: 3, color: '#94a3b8', fontSize: 10 }}>{item.project?.title || '当前项目'} · {item.relation || '关联'}</span></div><span style={{ flex: '0 0 auto', color: '#94a3b8', fontSize: 10 }}>{String(item.contentHash || '').slice(0, 10)}</span></div>)}</div> : <div style={{ color: '#94a3b8', fontSize: 12 }}>{empty}</div>}
                  </section>)}
                  {!!projectAssetLineage.data?.sourceReferences?.length && <section style={{ marginTop: 18 }}><h3 style={{ margin: '0 0 8px', color: '#334155', fontSize: 13 }}>跨项目引用<span style={{ marginLeft: 6, color: '#94a3b8', fontWeight: 500 }}>{projectAssetLineage.data.sourceReferences.length}</span></h3><div style={{ display: 'grid', gap: 7 }}>{projectAssetLineage.data.sourceReferences.map(reference => <div key={`${reference.projectId}:${reference.projectAssetId}`} style={{ padding: '9px 10px', border: '1px solid #e0e7ff', borderRadius: 8, background: '#f8faff' }}><strong style={{ display: 'block', color: '#475569', fontSize: 12 }}>{reference.project?.title || '来源项目'}</strong><span style={{ display: 'block', marginTop: 3, color: '#64748b', fontSize: 10 }}>{reference.projectAssetId} · {reference.role}</span></div>)}</div></section>}
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {/* 图片放大预览 */}
      {zoomImg && (
        <div ref={previewDialogRef} role="dialog" aria-modal="true" aria-label={`${zoomImg.label || '图片'}大图预览`} onClick={closeImagePreview} style={{ position: 'fixed', inset: 0, zIndex: 10001, overflow: 'hidden', background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <img src={proxyImg(zoomImg.url)} alt={zoomImg.label || '图片预览'} draggable="false" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, transform: `scale(${previewScale})`, transformOrigin: 'center', transition: 'transform 120ms ease-out', willChange: 'transform', cursor: previewScale > 1 ? 'zoom-out' : 'zoom-in' }} onClick={e => e.stopPropagation()} />
          <button type="button" aria-label="关闭大图预览" onClick={closeImagePreview} style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, border: 0, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 24, color: '#fff' }}>x</button>
        </div>
      )}

      {pendingProjectAssetImports.length > 0 && (
        <div className="ec-canvas-pending-imports" role="status" aria-live="polite">
          <span>有 {pendingProjectAssetImports.length} 个待归档素材</span>
          <button
            type="button"
            className="ec-canvas-pending-imports-action"
            onClick={retryPendingProjectAssetImports}
            disabled={pendingProjectAssetImportsBusy}
            title="重试归档待处理素材"
          >
            <RefreshCw size={15} aria-hidden="true" />
            {pendingProjectAssetImportsBusy ? '归档中' : '重试归档'}
          </button>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && (
        <div className={`ec-canvas-toast is-${toast.type || 'info'}`} role="status">
          <span>{toast.msg}</span>
          <button type="button" aria-label="关闭提示" title="关闭" onClick={dismissToast}>×</button>
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
