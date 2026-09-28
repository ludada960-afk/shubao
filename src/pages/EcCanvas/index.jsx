import React, { useState, useEffect, useRef, useCallback, useMemo, useReducer } from 'react';
import { ArrowDown, ArrowUp, Bookmark, Crop, Download, Eraser, ExternalLink, FileDown, FolderPlus, Grid3x3, Image as ImageIcon, ImagePlus, Images, Info, Languages, Map as MapIcon, Maximize2, Music, Pencil, Pin, Play, Plus, Ratio, RefreshCw, Shuffle, SlidersHorizontal, Square, SquareCheck, SquarePen, Stamp, Trash2,
  Upload, Type, Video, Wand2, X } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { flushSync } from 'react-dom';
import { HeroGlyph } from './components/HeroIcons';
import { loadCachedWorks, loadWorks, saveWork, proxyImg, deleteWork as softDeleteWork, loadTrash, restoreWork, reversePrompt, removeBg, stitchLongImage, regenerateCanvasImage, regenerateCanvasText, synthesizeCanvasTts, synthesizeCanvasCaption, generateEcommerceSuite, getDesignDirections, transformCanvasImage, analyzeCanvasLayers, createCanvasSegmentationPlan, recognizeCanvasText, replaceCanvasText, uploadEcommerceAssets, createTextComposition, listTextCompositions, saveTextCompositionRevision, createCanvasPixelLayers, exportCanvasPsd, quoteCanvasAction, stableCanvasActionId } from '../../services/api';
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
import WatermarkPanel from './components/WatermarkPanel.jsx';
import { DEFAULT_IMAGE_WATERMARK, DEFAULT_VIDEO_WATERMARK, normalizeWatermark } from './canvasWatermarkModel.js';
import { normalizeCommerceContext } from '../Home/ec/internationalCommerceRegistry.js';
import {
  CanvasAddMenu,
  CanvasAudioNode,
  CanvasDeriveMenu,
  CanvasDirectionNode,
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
import CanvasLibraryModal from './components/CanvasLibraryModal.jsx';
import CanvasAssetPickerModal from './components/CanvasAssetPickerModal.jsx';
import { createCanvasSession, createProject, createProjectVersion, getProjectAsset, getProjectAssetLineage, fetchAssetUsage, deleteProjectAsset, deleteCanvas,  importImageAssetToProject, importVideoAssetToProject, listProjectAssetLibrary, loadCanvasSession, registerGeneratedAssetToProject, saveCanvasSession, setProjectAssetProductionState, setProjectAssetRetention, addToProjectAssetLibrary } from '../../services/projects.js';
import { useDialog } from '../../components/ui/DialogProvider.jsx';
import ContextMenu from './ContextMenu.jsx';
import { actionsForSurface, getCanvasAction, stableActionsForSurface } from './canvasActionRegistry.js';
import { createPlanLaunchGraph, isPlanLaunch } from './canvasPlanLaunch.js';
import { canvasNodeSeedValues, canvasWorkbenchTargetOf } from './canvasWorkbenchBridge.js';
import { isWorkbenchInbound, workbenchInboundNodesOf } from './canvasWorkbenchInbound.js';
import SkillLibraryModal from '../Home/ec/SkillLibraryModal.jsx';
import { canvasMediaAssetRefs, createCanvasSnapshot, createFreshCanvasSession, importProjectAssetToCanvas, normalizePendingProjectAssetImports, restoreCanvasMediaPlayback, restoreCanvasSnapshot } from './canvasSessionModel.js';
import { collectCanvasProjectAssetRefs } from './canvasAssetReferenceModel.js';
import { canRemixWork, workRemixLaunchOf } from '../Home/workRemixLaunch.js';
import { buildCanvasImportResult, canvasOutputImages, canvasVideoAsset, canvasVideoResultPatch, canvasWorkCategory, canvasWorkOutputFingerprint, collectCanvasMediaAssets, collectCanvasWorkImages, durableCanvasMediaAssets, filterCanvasWorks, normalizeCanvasWorkPanel } from './canvasWorkModel.js';
import { cleanupLegacyCanvasStorage } from '../Works/retentionModel.js';
import { canReuseProjectAsset, filterProjectAssetLibrary, normalizeProjectAssetLibrary, normalizeProjectAssetSelection, projectAssetProductionOptions, projectAssetProductionStatus, projectAssetRetentionStatus, projectAssetSelectionKey, PROJECT_ASSET_PRODUCTION_FILTERS, PROJECT_ASSET_PRODUCTION_STATES, PROJECT_ASSET_RETENTION_FILTERS, toggleProjectAssetSelection } from '../Works/projectAssetLibraryModel.js';
import TextLayerInspector from './components/TextLayerInspector.jsx';
import ResponsiveImage from '../../components/ResponsiveImage.jsx';
import { canvasDraftKey, loadCanvasDraft, saveCanvasDraft } from './canvasDraftRepository.js';
import { applyCanvasGroupAction, applyMultiSelectionAction, CANVAS_CREATION_OPTIONS, canvasGroupFrames, canvasSelectionGroupState, expandCanvasDragSelection, expandCanvasGroupDragIds, expandCanvasLayerGroup, getCanvasFocusIds, isCanvasConnectionVisible, pickCanvasLayerAtPoint, replaceCanvasNodeWithLayerResult, selectedCanvasBounds } from './canvasInteractionModel.js';
import { createCanvasImageComposerNode, createCanvasShotNamer, createCanvasSuiteComposerNode, createCanvasTextComposerNode, createCanvasTextNode, createCanvasVideoComposerNode, createUploadedImageNodes, createUploadedVideoNodes,
  resolveSourceStackPlacement, getCanvasComposerPresentation, layoutCanvasGeneratedResults, normalizeCanvasSelection, ratioValue, resizeCanvasNodeByHandle, applyCanvasSkill } from './canvasStudioModel.js';
/* P0-1 派生即执行 (9-06): 生成文案自动请求 + P0-2 视频 composer 上游文案引用 + P0-3 TTS 配音执行链 + P0-4 字幕动效执行链 */
import { buildCanvasCaptionRequest, buildCanvasCopywritingRequest, buildCanvasTtsRequest, findUpstreamCanvasCopy, normalizeCanvasAudioNodeFromTts, normalizeCanvasCopywritingResult, normalizeCanvasSubtitleNodes, resolveDerivedVideoPrompt } from './canvasDerivedAutoRun.js';
import { collectNodeInputsFromEdges } from './canvasGraphInputs.js';
import { markStaleDownstream } from './canvasGraphEngine.js';
import { buildRunPlan, buildTransitiveDownstream, createGraphRunner, createTerminalAwaiter } from './canvasGraphRunController.js';
/* P2 工作流模板一键铺开: 模板 API (铺开/点赞) + 连线@引用合一的纯函数（无入边节点回退旧并集, 与 P0 无图契约逐字节一致）*/
import { collectRunInputs, instantiateWorkflowTemplate, legacyComposerSourceIds, markP3PendingNodes, mergeGraphMentionSources } from './workflowTemplates.js';
import { migrateMentionsToEdges } from './mentionEdgeMigration.js';
import WorkflowTemplateGallery from './WorkflowTemplateGallery.jsx';
/* P0.5 分组"运行整链"：能安全映射到既有单节点执行器的 kind（文本/视频/音频 走 P1，这里先跳过） */
const GRAPH_RUN_KINDS = {
  'image-composer': 'generate',
  'smart-remix': 'generate',
  'suite-composer': 'generate',
  'remove-bg': 'process',
  extend: 'process',
  inpaint: 'process',
  translate: 'process',
  upscale: 'process',
  'layer-workbench': 'process',
};
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
import { analyzeVideoPlan, createVideoJob, fetchVideoCapabilities, getVideoJob, uploadVideoAsset } from '../../services/video.js';
import { inspectVideoPlanningFiles } from '../VideoStudio/videoAssetAnalysis.js';
import { resolveVideoApiMode, hasRequiredVideoInputs, snapVideoDuration } from '../VideoStudio/videoStudioModel.js';
import VideoProjectDeliveryDialog from '../VideoStudio/VideoProjectDeliveryDialog.jsx';
import { DELIVERY_SOURCE_SURFACES, deliverableRefsFromNodes } from '../VideoStudio/videoDeliveryModel.js';
/* 4c183cd4 续命 P-G 画布 1-click chain 客户端 (用户 8-29 硬性反馈 3): 下面 3 智能按钮走 chainService
   跟上面 5 原有按钮 (单步 addCanvasComposer) 完全区分, 真实差异化. */
import { executeChain as executeChainService, normalizeChainResponse, CHAIN_STEP_LABELS } from '../../services/chain.js';
import './EcCanvas.css';
import '../../styles/canvas-derive-menu.css';
import '../../styles/canvas-empty-actions.css';
import '../../styles/canvas-right-panel.css';
import '../../styles/canvas-watermark-panel.css';
/* 2026-09-18 去重：canvas-minimap.css 与 canvas-supervisor.css 曾各定义一份
   .ec-canvas-minimap*（position absolute/fixed、z-index 50/5000、暗色/白色 完全相反），
   后者因加载顺序靠后而生效，导致「minimap 黑」反复出现 + 小地图浮在弹窗遮罩之上。
   现合并为唯一权威 = canvas-supervisor.css（与渲染入口 CanvasContextMenuPanel 配套），
   遗留副本已删除。 */
/* 4c183cd4 续命 画布总监督 2026-08-30 - Quantv 功能 UI */
import '../../styles/canvas-supervisor.css';
import { EcCanvasRightPanel } from './components/EcCanvasRightPanel.jsx';
/* 4c183cd4 续命 P-G/P-A/P-E/P-H 画布完整集成 (8 大新规划 5/8 落地) */
/* 4c183cd4 续命 2026-08-30 画布总统筹重审: 拿掉 CanvasChainOverlay import (1-click 视频 overlay 重复入口, 改走节点串联) */
/* 2026-09-01 用户反对多模态串联: 移除该浮层 import, 视频/音频收敛到节点串联 */
/* 2026-09-28 批 CX（CV-0）：`import CanvasTemplateMarketplace` 删除（组件文件已删）——
   它是那个"点选只弹 toast、没有任何入口调用"的假模板广场；模板入口只剩顶栏那一颗
   → `WorkflowTemplateGallery`（真图结构 + 一键铺开）。 */
/* 4c183cd4 续命 画布总监督 2026-08-30 - Quantv 功能 UI 组件
   CanvasContextMenuPanel.jsx 内含: CanvasContextMenuPanel / CanvasAddNodePanel /
   CanvasShortcutHelp / CanvasMinimap / CanvasTaskLogPanel / SaveStatusIndicator / CanvasSticker */
import CanvasNodeActionBar from './components/CanvasNodeActionBar.jsx';
/* CanvasContextMenuPanel 是 default export, 其余是 named exports */
import CanvasContextMenuPanel, {
  CanvasAddNodePanel,
  CanvasShortcutHelp,
  CanvasMinimap,
  CanvasTaskLogPanel,
  SaveStatusIndicator,
} from './components/CanvasContextMenuPanel.jsx';
/* 4c183cd4 续命 画布总监督 2026-08-30 - Quantv 核心扩展逻辑 */
import {
  isEdgeInvalid,
  autoCanvasShotName,
  createCanvasGroup,
  dissolveCanvasGroup,
  autoArrangeCanvasNodes,
  estimateNodeCost,
} from './canvasQuantvExtensions.js';
import {
  copyNodesToClipboard,
  readClipboardNodes,
  createCanvasHistory,
  isCanvasEditingTarget,
  shouldHandleCanvasPaste,
} from './canvasKeyboardHooks.js';
/* 2026-09-17：画布统一视觉语言 —— 直接复用首页刚定稿的规范（不另发明一套），
   值经 CSS 变量注入画布根节点，CSS 侧不再写魔法数字。 */
import {
  canvasVisualLanguageCssVars,
  canvasHudHidden,
  canvasRightPanelReserved,
  resolveAnchoredRight,
  useCanvasPanelWidth,
} from './canvasVisualLanguage.js';
/* 2026-09-17 三层权威性排序（硬约束 > 产出结构 > 内容意图 > 设计方案）—— 唯一规则实现。 */
import { applyPlanToConfiguration, resolvePromptAuthority } from './canvasPromptAuthority.js';
/* 4c183cd4 续命 2026-08-30 画布总统筹重审: 拿掉 1-click 拖入面板 import (整个组件重复, 已被 tab=assets + 底部"添加图片/视频" 替代) */

/* 添加菜单的尺寸 —— 用于 `resolveAnchoredRight` 算「放不放得下」。
   宽度必须与 CSS `.ec-canvas-add-menu` 一致（当前 286px）。
   高度**不做估算**：这个菜单的行数随内容变化（实测 680px），靠猜会把 top 算歪 ——
   实测过一次：猜 460 时 top 被放到 428，而真实高度 680 → 底边 1108 溢出屏幕。
   正解是直接采用 CSS 自己的高度预算（`max-height: min(760px, calc(100vh - 32px))`），
   让规则按「最多能占多少」来纵向回夹；超出部分由 CSS 的 overflow-y 滚动，不会溢出。 */
const ADD_MENU_WIDTH = 286;
const addMenuHeightBudget = () => Math.min(760, Math.max(240, window.innerHeight - 32));

/* 9-12 资产库额度：字节 → 可读大小 */
function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${Math.round(bytes)} B`;
}

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

/* 画布视频合成器的合法时长：取所选产品声明的时长档位后吸附。
   上游按秒档位校验（seedance 2.0 只认 5/10/15），原来的 `|| 8` 兜底正好落在被拒收的秒数上；
   报价 SKU、幂等键、真实请求体必须共用这一个值，否则三者会对不上。 */
function composerDurationFor(composer, videoProducts = []) {
  const product = videoProducts.find(item => item.id === (composer?.modelProductId || 'seedance_standard'))
    || videoProducts[0]
    || null;
  return snapVideoDuration(product, composer?.duration || 5);
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
  'edit-text': Pencil, /* 9-09: 编辑文字工具图标 */
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
  /* 用「加入库」语义的图标，不用兜底的星标/魔法棒 */
  'save-to-assets': FolderPlus,
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
        boxShadow: selected ? '0 0 0 2.5px var(--sb-brand-600), 0 8px 32px rgba(124,58,237,0.25)' : '0 4px 16px rgba(12,10,9,0.10)',
        background: '#fff', opacity: dimmed ? 0.34 : 1, transition: 'box-shadow 0.15s, opacity 0.16s', touchAction: 'none',
      }}
    >
      <button
        type="button"
        data-canvas-node-check="true"
        aria-label={selected ? '取消选择' : '选择节点'}
        onPointerDown={e => { e.stopPropagation(); onToggleSelect?.(e, node.id); }}
        style={{ position: 'absolute', zIndex: 3, left: 8, top: 8, width: 22, height: 22, border: 0, borderRadius: 6, background: 'rgba(255,255,255,.92)', color: selected ? 'var(--sb-brand-600)' : '#777', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 7px rgba(12,10,9,.16)' }}
      >
        {selected ? <SquareCheck /> : <Square />}
      </button>
      {hovered && hoverActions.length > 0 && <div style={{ position: 'absolute', zIndex: 4, top: 8, right: 8, display: 'flex', gap: 5 }}>
        {hoverActions.map(action => {
          const Icon = ACTION_ICONS[action.id] || Sparkles;
          return <button key={action.id} type="button" data-canvas-control="true" aria-label={action.label} title={action.label} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onAction?.(action.id, node); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: 0, borderRadius: 8, padding: '5px 7px', color: '#fff', background: 'rgba(17,24,39,.82)', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}><Icon size={13} />{action.label}</button>;
        })}
      </div>}
      <div data-canvas-port-role="input" style={{ position: 'absolute', zIndex: 2, left: -7, top: node.h / 2, transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#fff', border: '2px solid var(--sb-brand-600)', cursor: 'crosshair', opacity: selected ? 1 : 0, pointerEvents: selected ? 'auto' : 'none' }} onPointerDown={e => { e.stopPropagation(); onPortPointerDown?.(e, node.id, 'in'); }} onPointerUp={e => { e.stopPropagation(); onPortPointerUp?.(e, node.id, 'in'); }} />
      <div data-canvas-port-role="output" style={{ position: 'absolute', zIndex: 2, right: -7, top: node.h / 2, transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: 'var(--sb-brand-600)', border: '2px solid #fff', cursor: 'crosshair', opacity: selected ? 1 : 0, pointerEvents: selected ? 'auto' : 'none' }} onPointerDown={e => { e.stopPropagation(); onPortPointerDown?.(e, node.id, 'out'); }} onPointerUp={e => onPortPointerUp?.(e, node.id, 'out')} />
      <div style={{ position: 'relative', width: '100%', borderRadius: '8px 8px 0 0', overflow: 'hidden', background: '#f5f5f5' }}>
        {!loaded && !error && <SkeletonCard w={node.w} h={node.h} />}
        {error && (
          <div style={{ width: '100%', height: node.h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#fef2f2' }}>
            <div style={{ fontSize: 24, opacity: 0.45 }}>!</div>
            <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>原图已失效</div>
            <div style={{ fontSize: 10, color: '#9f1239', textAlign: 'center', padding: '0 12px' }}>可用右键“再次生成”创建稳定新图</div>
            <div
              /* 键盘可达三件套：「点击重试」是真按钮（cursor:pointer 已声明可点）。 */
              role="button"
              tabIndex={0}
              onClick={() => { setError(false); setLoaded(false); setRetryKey(k => k + 1); }}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setError(false); setLoaded(false); setRetryKey(k => k + 1); } }}
              style={{ fontSize: 11, color: 'var(--sb-brand-600)', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, background: 'rgba(124,58,237,0.08)' }}>点击重试</div>
          </div>
        )}
        <ResponsiveImage
          key={retryKey}
          src={node.localPreviewUrl || node.url}
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
        {node.annotations?.length > 0 && <div style={{ position: 'absolute', right: 8, bottom: 8, maxWidth: '82%', padding: '4px 6px', borderRadius: 6, background: 'rgba(17,24,39,.78)', color: '#fff', fontSize: 10, lineHeight: 1.4 }}>{node.annotations[0].text}</div>}
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name || node.displayLabel}</div>
          <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: 'var(--sb-brand-600)', background: 'rgba(124,58,237,.08)', borderRadius: 'var(--sb-radius-pill)', padding: '2px 5px' }}>{node.group}</span>
        </div>
        <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{node.ratio}{node.size ? ` · ${node.size}` : ''}</div>
        {node.usage && <div style={{ fontSize: 10, color: 'var(--sb-credit-spend)', marginTop: 5, lineHeight: 1.5, background: 'rgba(180,83,9,0.06)', borderRadius: 6, padding: '3px 6px' }}>{node.usage}</div>}
        {node.layerStatus && <div style={{ fontSize: 10, color: 'var(--sb-info-solid-600)', marginTop: 5 }}>▦ {node.layerStatus} · {node.layers?.length || 0} 层</div>}
      </div>
    </div>
  );
}

function SourceGroupNode({ node, selected, dimmed, onPointerDown, onContextMenu, onPortPointerDown, onPortPointerUp, onInspect, onHoverChange }) {
  const previewAsset = node.assets?.find(asset => asset?.url);
  return <section data-canvas-node-id={node.id} onPointerDown={event => onPointerDown(event, node.id)} onDoubleClick={event => { event.stopPropagation(); if (previewAsset) onInspect?.({ ...node, url: previewAsset.url, label: previewAsset.name || node.name }); }} onContextMenu={event => { event.preventDefault(); onContextMenu?.(event, node); }} onMouseEnter={() => onHoverChange?.(node.id)} onMouseLeave={() => onHoverChange?.(null)} style={{ position: 'absolute', left: node.x, top: node.y, width: node.w, minHeight: node.h, boxSizing: 'border-box', padding: 13, border: selected ? '2px solid var(--sb-info-solid-600)' : '1px solid #d8dde5', borderRadius: 8, color: '#1f2937', background: '#fff', boxShadow: selected ? '0 0 0 2px rgba(37,99,235,.12), 0 4px 8px rgba(15,23,42,.12)' : '0 3px 8px rgba(15,23,42,.09)', cursor: 'grab', userSelect: 'none', opacity: dimmed ? 0.34 : 1, transition: 'opacity 0.16s, box-shadow 0.15s' }}>
    <CanvasPortHandle side="right" role="output" visible={selected} disabled={!canDeriveFromNode(node)} label="从产品素材派生工作流" onPointerDown={event => onPortPointerDown?.(event, node.id, 'out')} onPointerUp={event => onPortPointerUp?.(event, node.id, 'out')} />
    <div style={{ fontSize: 10, fontWeight: 800, color: '#6558e8', letterSpacing: '.05em' }}>产品素材组</div>
    <div style={{ marginTop: 4, fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name || '产品母图'}</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 7, marginTop: 11 }}>
      {(node.assets || []).slice(0, 4).map((asset, index) => <ResponsiveImage key={asset.assetId || asset.id || index} src={asset.url} alt={asset.name || '产品素材'} variant="thumb" ratio="1:1" sizes="120px" style={{ width: '100%', borderRadius: 8, background: '#e8eaf2' }} imgStyle={{ objectFit: 'contain' }} />)}
      {!node.assets?.length && <div style={{ gridColumn: '1 / -1', padding: '15px 8px', borderRadius: 8, color: '#8a93a4', background: '#f0f2f8', fontSize: 11, textAlign: 'center' }}>未找到产品原图</div>}
    </div>
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
        /* 4c183cd4 续命 画布总监督 2026-08-30 - 边类型校验 (Quantv isEdgeInvalid) */
        const validity = isEdgeInvalid(conn, nodes);
        const isInvalid = validity.invalid;
        const style = isInvalid
          ? { stroke: '#EF4444', dash: '4 4' }
          : isProcessing
            ? { stroke: 'var(--sb-brand-600)', dash: '8 6' }
            : styles[conn.relation || conn.type] || styles.reference;
        const isFocused = !focusNodeIds || (focusNodeIds.has(from.id) && focusNodeIds.has(to.id));
        /* 9-11: 全部连线带 .ec-canvas-edge-line (端点=加号中心重叠); 进行中边常驻流动, hover 边流动加粗 */
        const edgeClass = ['ec-canvas-edge-line', isInvalid ? 'ec-canvas-edge-invalid' : null, isProcessing ? 'ec-canvas-edge-processing is-animated' : null].filter(Boolean).join(' ');
        return (
          <g key={i}>
            <path className={edgeClass} data-canvas-edge-id={conn.id || `edge-${i}`} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke={style.stroke} strokeWidth={isFocused ? 2.8 : 2.1} fill="none" strokeDasharray={style.dash} opacity={isFocused ? 0.9 : 0.14} onDoubleClick={() => onRemove?.(conn)} style={{ cursor: 'pointer', pointerEvents: 'stroke' }} />
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
      <path className="ec-canvas-edge-line ec-canvas-edge-draft" d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke="#7f8792" strokeWidth="2.5" strokeDasharray="7 5" fill="none" />
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

/* 9-16 用户批注（图20）：「我点击图片上的『添加到资产库』，它为什么提示『这不是一个有效的素材』？」
   根因：这个函数把**画布节点**当成待上传的本地文件直接丢给 uploadEcommerceAssets——
   但节点对象既不是 File 也没有 data: URL（节点只有 /api/generated-assets/… 或远程 url），
   uploadEcommerceAsset 走到 imageToDataUrl(file) 就抛「请选择 JPEG 或 PNG 原图后重试」，
   对用户就是一句和「素材无效」一样的黑话。

   9-17 用户批注（图8）：「点击加入资产库还是不对啊，我点击之后它为什么还是说不能加入资产库呢」
   —— 上一轮的修复**只覆盖了生成物**（/api/generated-assets/），上传物、资产库导入物、
   带有本地预览地址的素材仍然全都被判成「待上传」，然后拿一个既不是 File 也没有
   data: URL 的**假素材对象**去调上传接口，于是用户再次看到「请选择 JPEG 或 PNG 原图后重试」。
   实测复现（Playwright 真登录态）：点「加入资产库」→ toast 就是这句，
   而且**根本没有任何上传请求发出**（只有 projects/versions/save-work 这几个自动保存请求）。

   修法：判据从「是不是 /api/generated-assets/」改成「**有没有可上传的原始数据**」：
     · 有 File/Blob                → 走上传链路（真正的本地上传）；
     · 有 data:image/ 数据 URL      → 走上传链路；
     · 其余（已经是任何服务端可寻址的 url，含 /api/generated-assets/、/api/gallery-image、
       远程 http(s) 地址、以及已入库回填的 stableUrl）→ 原样透传，不做二次上传。
   这样「加入资产库」在任何一条素材来源路径上都不会再抛上传错误。 */
/* 服务端素材 ID 就藏在稳定地址里：/api/generated-assets/<64位hex>.(jpg|png|webp)。
   画布节点上的 assetId 有时是**画布自己的** upload_… id（不是服务端素材 ID），
   拿它去调 import-media 只会得到 404「图片素材不存在或不属于当前账号」。
   所以入库前统一从稳定地址里把真正的素材 ID 解出来，解不出再退回节点字段。 */
const CANVAS_STABLE_ASSET_URL_RE = /^\/api\/generated-assets\/([a-f0-9]{64}\.(?:jpg|png|webp))$/i;

function canvasServerAssetIdFromUrl(url) {
  const match = CANVAS_STABLE_ASSET_URL_RE.exec(String(url || '').split('?')[0].trim());
  return match ? match[1] : '';
}

/* 素材角色必须落在服务端允许的取值里（server/ecommerceEngine/assetUpload.mjs：
   product | reference | style | proof | person | scene）。画布侧原来传的是 'user-saved'，
   服务端直接 400「素材角色无效」—— 于是「加入资产库」在**真实登录态**下从未成功过一次。
   实测：t+1s toast「素材角色无效」，请求 400 POST /api/ecommerce/assets
        {"error":"素材角色无效","code":"ASSET_REQUEST_INVALID"}。
   这里把画布的业务语义（用户主动收藏 / 视频 / 音频）收敛到服务端允许的取值：
     「加入资产库」= 用户把自己的素材收进资产库 → 语义上是参考素材，映射为 'reference'。 */
const CANVAS_ASSET_UPLOAD_ROLES = Object.freeze({
  'user-saved': 'reference',
  'user-saved-video': 'reference',
  'user-saved-audio': 'reference',
  product: 'product',
  reference: 'reference',
  style: 'style',
  proof: 'proof',
  person: 'person',
  scene: 'scene',
});

function normalizeCanvasAssetRole(role) {
  const key = String(role || '').trim().toLowerCase();
  return CANVAS_ASSET_UPLOAD_ROLES[key] || 'reference';
}

function canvasAssetUploadSource(asset = {}) {
  const file = asset.file || asset.rawFile || asset.blob || null;
  if (file) return file;
  const url = String(asset.url || asset.previewUrl || asset.localPreviewUrl || '').trim();
  if (/^data:image\//i.test(url)) return url;
  return null;
}

async function persistCanvasUploadAssets(assets = [], { role = 'product' } = {}) {
  const list = Array.isArray(assets) ? assets : [];
  const uploadable = list.filter(asset => canvasAssetUploadSource(asset));
  const persisted = uploadable.length ? await uploadEcommerceAssets(uploadable, normalizeCanvasAssetRole(role)) : [];
  if (persisted.length !== uploadable.length || persisted.some(asset => !asset?.url)) {
    throw new Error('图片上传结果不完整，请重试');
  }
  let cursor = 0;
  return list.map(asset => (canvasAssetUploadSource(asset) ? { ...asset, ...persisted[cursor++] } : { ...asset }));
}

/* 素材水印适用的节点类型（提交时只回写对应类型） */
const WATERMARK_IMAGE_KINDS = Object.freeze(['image', 'output', 'image-composer', 'layer-group']);
const WATERMARK_VIDEO_KINDS = Object.freeze(['video', 'video-composer']);

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
  /* P0.5 分组"运行整链"的二次确认弹窗数据（预估为 0 时不弹，直接跑） */
  const [graphRunConfirm, setGraphRunConfirm] = useState(null);
  /* P2 工作流模板库: 库浮层 + 铺开后顶部的运行 offer（运行仍走 P0.5 二次确认; T4/T5 呈 P3 灰态、不提供扣费运行）*/
  const [workflowGalleryOpen, setWorkflowGalleryOpen] = useState(false);
  /* ═══ 2026-09-28 批 CX（CV-0/CV-3）：**模板广场可以直达**（`?page=ec-canvas&tab=templates`）═══════
     用户原话（逐字，他在问入口形态时说的）：「你也可以任意的在他这个画布页面上
     https://laoyu.quantv.com/canvas?tab=featured **点击任意一个工作流也可以创建进入画布里面**。
     这就是我说的两种方式，你自己帮我考虑一下，到底怎么做会更好？」
     结论（docs/design/89 §9.2）：**主入口是画布**，但"先挑模板再干活"这条路径要在**链接层面**成立
     —— 这样它能被分享、被投放、被记进收藏夹，也让"模板墙"以后能独立挂到任何入口上。
     `tab` 取值接受 `templates` / `template` / `workflows`（三个写法都认，避免用户/外部链接拼错就静默失效）。 */
  useEffect(() => {
    let requested = '';
    try {
      requested = String(new URLSearchParams(globalThis.location?.search || '').get('tab') || '').toLowerCase();
    } catch { requested = ''; }
    if (['templates', 'template', 'workflows', 'workflow'].includes(requested)) setWorkflowGalleryOpen(true);
  }, []);
  const [workflowRunOffer, setWorkflowRunOffer] = useState(null);
  /* 9-11 用户批注: 视频模型与首页同源 —— 拉 /api/video/capabilities (与 VideoStudio 同一 API),
     首页上新模型, 画布视频生成器同步出现; 拉取失败回落内置两档 (不阻塞画布)。 */
  const [videoProducts, setVideoProducts] = useState([]);
  useEffect(() => {
    let cancelled = false;
    fetchVideoCapabilities().then(data => {
      if (cancelled) return;
      const products = Array.isArray(data?.products) ? data.products.filter(product => product?.public !== false) : [];
      if (products.length) setVideoProducts(products);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const [connections, setConnections] = useState([]);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { pendingProjectAssetImportsRef.current = pendingProjectAssetImports; }, [pendingProjectAssetImports]);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [pointerMode, setPointerMode] = useState(null);
  const [activeTool, setActiveTool] = useState('select');
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  /* 9-12 用户批注：画布要能「从资产库选择」把素材放上来（此前没有任何入口） */
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  /* 9-13 用户批注：左侧「+」菜单在用户去点别的节点/空白、切换选择时必须自动收起 */
  useEffect(() => {
    if (!addMenuOpen) return;
    setAddMenuOpen(false);
  }, [selected, multiSelected.size]);
  /* 2026-09-20 收口：添加菜单原来自写 anchor（`Math.round(rect.right + 12)` 自己拼 style）。
     行为恰好正确（实测已在触发右侧），但**口径是自己一套** —— 四条约定里第 ④ 条要求
     「所有画布弹层走同一个权威」。现在改用 canvasVisualLanguage.resolveAnchoredRight，
     与派生菜单 / 图层面板共用同一份「锚触发元素向右展开、放不下向下、绝不向左翻」的规则。
     锚点仍是**触发按钮的视口矩形**（CSS 居中会随顶栏/侧栏度量漂移，所以必须实测量）。 */
  const [addMenuAnchor, setAddMenuAnchor] = useState(null);
  const syncAddMenuAnchor = useCallback(() => {
    const rect = containerRef.current?.querySelector('.ec-canvas-rail-add')?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    const solved = resolveAnchoredRight({
      anchor: { x: rect.left, y: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom },
      width: ADD_MENU_WIDTH,
      height: addMenuHeightBudget(),
      gap: 12,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
    setAddMenuAnchor({ position: 'fixed', left: solved.left, top: solved.top, transform: 'none' });
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
  /* 4c183cd4 续命 画布深度重构 (用户 8-29 硬性反馈 3): 下面 3 智能按钮的 chain 进度状态.
     chainRun = { title, mode: 'one-click-suite' | 'one-click-video' | 'tts-voiceover',
                  steps: [''|'pending'|'running'|'ok'|'failed', ...], totalCost, error, running, finishedAt } */
  const [chainRun, setChainRun] = useState(null);
  /* 4c183cd4 续命 2026-08-30 画布总统筹重审: 拿掉 chainOverlayOpen state
      2026-09-01 用户反对多模态串联: 移除该浮层开关状态
      1-click 视频改走节点串联 (Quantv §10.2) */
  /* 2026-09-28 批 CX：`templateMarketplaceOpen` 随那个"假模板广场"一起删除（见下方渲染处的批注）。 */
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
  /* 4c183cd4 续命 画布总监督 2026-08-30 - Quantv 功能状态 */
  const [saveStatus, setSaveStatus] = useState('saved');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [taskLogOpen, setTaskLogOpen] = useState(false);
  const [taskLogEntries, setTaskLogEntries] = useState([]);
  /* 9-12 用户批注：任务日志一直是空的、而且纯黑不像我们的风格。
     数据源改为**画布真实任务**（节点生命周期），并支持按状态/类型筛选。 */
  const [dismissedTaskIds, setDismissedTaskIds] = useState(() => new Set());
  /* 9-12 资产库：额度用量 + 正在删除的素材 */
  const [assetUsage, setAssetUsage] = useState(null);
  const [projectAssetDeleteBusy, setProjectAssetDeleteBusy] = useState('');
  const [projectAssetUploadBusy, setProjectAssetUploadBusy] = useState(false);
  const projectAssetUploadRef = useRef(null);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
const [minimapOpen, setMinimapOpen] = useState(true);
  /* 9-08 素材水印系统（用户批注重构）: 单面板 + 素材类型切换 + 拖拽定位 + 实时预览 */
  const [imageWatermark, setImageWatermark] = useState(DEFAULT_IMAGE_WATERMARK);
  const [videoWatermark, setVideoWatermark] = useState(DEFAULT_VIDEO_WATERMARK);
  const [watermarkPanelOpen, setWatermarkPanelOpen] = useState(false);
  const [watermarkMaterial, setWatermarkMaterial] = useState('image');
  const [watermarkPreview, setWatermarkPreview] = useState(null);

  const handleWatermarkPreview = useCallback((config) => {
    setWatermarkPreview({ nodeId: selected || '', material: watermarkMaterial, config });
  }, [selected, watermarkMaterial]);

  const handleWatermarkCommit = useCallback((config) => {
    const normalized = normalizeWatermark(config, { material: watermarkMaterial });
    if (watermarkMaterial === 'video') {
      setVideoWatermark(normalized);
      setNodes(previous => previous.map(node => node.id === selected && WATERMARK_VIDEO_KINDS.includes(node.kind)
        ? { ...node, videoWatermark: normalized }
        : node));
    } else {
      setImageWatermark(normalized);
      setNodes(previous => previous.map(node => node.id === selected && WATERMARK_IMAGE_KINDS.includes(node.kind)
        ? { ...node, imageWatermark: normalized }
        : node));
    }
    setWatermarkPreview(null);
  }, [selected, watermarkMaterial]);

  const handleWatermarkCancel = useCallback(() => { setWatermarkPreview(null); }, []);

  /* 用户批注: 点击水印/其它面板时小地图应自动收起, 不能永远张开 */
  const handleToggleWatermarkPanel = useCallback(() => {
    setWatermarkPanelOpen(open => {
      if (open) { setWatermarkPreview(null); return false; }
      setMinimapOpen(false);
      const selectedKind = nodes.find(node => node.id === selected)?.kind;
      setWatermarkMaterial(WATERMARK_VIDEO_KINDS.includes(selectedKind) ? 'video' : 'image');
      return true;
    });
  }, [nodes, selected]);
  /* 用户 9-05 反馈: 小地图必须展示"我们处于大画布的哪个部分" —
     固定一个大世界窗口 (以世界原点为中心 ±4200x±3000), 节点与当前视口框
     都映射进去, 当前位置一目了然; 不再随内容收缩导致视口框占满整张地图。 */
  /* 9-06: 世界窗中心对准默认视口中心 (720,450) — 新用户视口框落在地图正中 */
  const minimapWorldBounds = useMemo(() => ({
    width: 6400,
    height: 4800,
    offsetX: 720 - 3200,
    offsetY: 450 - 2400,
  }), []);
  const [addNodePanel, setAddNodePanel] = useState(null);
  const [canvasContextPanel, setCanvasContextPanel] = useState(null);
  const [nodeActionBar, setNodeActionBar] = useState(null);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [themeMode, setThemeMode] = useState('auto');

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
  /* 9-12 画布库弹窗（点「新建画布」进入） */
  const [canvasLibraryOpen, setCanvasLibraryOpen] = useState(false);
  const [canvasSessionBusy, setCanvasSessionBusy] = useState(false);
  const containerRef = useRef(null);
  const previewDialogRef = useRef(null);
  const canvasSaveKeyRef = useRef(null);
  const touchPointsRef = useRef(new Map());
  const dragFrameRef = useRef(null);
  const pendingDragRef = useRef(null);
  const draftReadyRef = useRef(false);
  /* 9-12：清空 launch 会触发同一效应重跑，用这个标记跳过一次，避免把刚铺好的画布清空 */
  const launchJustAppliedRef = useRef(false);
  /* 首页发射进来的图（素材 + 方案节点）：常驻，避免被后续重建清空 */
  const planLaunchGraphRef = useRef(null);
  /* 9-12 用户批注：带设计方案进来后应**自动生成方案**（不用再点一次）；这里记下待自动生成的方案节点 id */
  const autoPlanNodeRef = useRef('');
  const segmentationAbortRef = useRef(new Map());
  const workflowProcessRef = useRef(null);
  const workflowGenerateRef = useRef(null);
  const graphRunAbortRef = useRef(null);
  const sourceUploadRef = useRef(null);
  const videoUploadRef = useRef(null);
  /* 用户 9-10: 「替换」素材的目标节点 id（置位后, 下一次上传套到它身上而不是新建节点） */
  const mediaReplaceTargetRef = useRef(null);
  /* 4c183cd4 续命 画布总监督 2026-08-30 - 音频上传 ref + 撤销/重做 history */
  const audioUploadRef = useRef(null);
  const historyRef = useRef(null);
  if (!historyRef.current) historyRef.current = createCanvasHistory();
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
  /* 4c183cd4 续命 P-B 电影分镜命名 (Enclosure/Breakthrough/Framing/Voice 等)
     一个 session 维持独立计数器, 保证单调递增, 跟 videoCanvasModel 同源 */
  const canvasShotNamerRef = useRef(null);
  if (!canvasShotNamerRef.current) canvasShotNamerRef.current = createCanvasShotNamer();
  /* 9-16 用户批注（图14）：四个生成框的落点必须统一 —— 见 createComposerPlacement 的说明 */
  const preferredComposerAnchorRef = useRef(null);

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
  /* 9-08 事故修复: 水印改动误删了 selectedNode 定义, 但下方 20+ 处仍在引用它 → 渲染期 ReferenceError 整页白屏 ("画布打不开") */
  const selectedNode = selected ? nodes.find(node => node.id === selected) : null;

  /* 选中回收器 (用户 9-10 反馈: 节点删掉后功能栏还在): 任何让选中 id 脱离 nodes 的路径
     (删除/隐藏/整张画布被替换/恢复会话/模板铺开/换作品) 都在这里立即回收选中态,
     使工具栏与右面板永远不可能比节点活得久。返回同引用即无变化, 不触发额外渲染。
     9-11 扩展 (用户反馈: 中央弹窗上传后删节点, 右侧派生菜单仍在): 所有以节点为锚点的
     浮层态 (派生菜单/连线草稿/聚焦编辑器/文字检查器/水印预览) 一并在此回收——
     它们的源节点一旦不在 nodes 里, 浮层立即关闭, 面板永远不可能比节点活得久。 */
  useEffect(() => {
    if (selected && !nodes.some(node => node.id === selected)) setSelected(null);
    setMultiSelected(previous => {
      if (!previous.size) return previous;
      const next = new Set([...previous].filter(id => nodes.some(node => node.id === id)));
      return next.size === previous.size ? previous : next;
    });
    setConnectionPicker(previous => (
      previous?.sourceNodeId && !nodes.some(node => node.id === previous.sourceNodeId)
      ? null : previous
    ));
    setConnectionDraft(previous => {
      const source = previous?.sourceNodeId || previous?.from;
      return (source && !nodes.some(node => node.id === source)) ? null : previous;
    });
    setFocusedEditor(previous => (
      previous?.nodeId && !nodes.some(node => node.id === previous.nodeId)
      ? null : previous
    ));
    setTextInspectorNodeId(previous => (
      previous && !nodes.some(node => node.id === previous)
      ? null : previous
    ));
    setWatermarkPreview(previous => {
      if (!previous?.nodeId) return previous;
      return nodes.some(node => node.id === previous.nodeId) ? previous : null;
    });
  }, [nodes, selected]);
  /* 9-11 用户批注: 铺开 offer 常驻顶部不行 → 并入底部提示, 8s 自动关闭 */
  useEffect(() => {
    if (!workflowRunOffer) return undefined;
    const timer = setTimeout(() => setWorkflowRunOffer(null), 8000);
    return () => clearTimeout(timer);
  }, [workflowRunOffer]);
  const selectedImageWatermark = selectedNode?.imageWatermark || imageWatermark;
  const selectedVideoWatermark = selectedNode?.videoWatermark || videoWatermark;
  /* 面板实时预览优先：拖动水印时素材上的水印同步位移（未确定前不写回节点） */
  const nodeWatermark = useCallback((node, kind) => {
    if (watermarkPreview && watermarkPreview.nodeId === node.id && watermarkPreview.material === kind) return watermarkPreview.config;
    return kind === 'video'
      ? (node.videoWatermark || (node.id === selected ? videoWatermark : null))
      : (node.imageWatermark || (node.id === selected ? imageWatermark : null));
  }, [watermarkPreview, selected, imageWatermark, videoWatermark]);
  const panelWatermarkConfig = watermarkMaterial === 'video' ? selectedVideoWatermark : selectedImageWatermark;
  const panelPreviewUrl = selectedNode?.url || selectedNode?.sourceUrl || '';
  const panelPreviewKind = WATERMARK_VIDEO_KINDS.includes(selectedNode?.kind) ? 'video' : 'image';
  const panelPreviewAspect = Number(selectedNode?.mediaAspect) > 0
    ? Number(selectedNode.mediaAspect)
    : (Number(selectedNode?.naturalWidth) > 0 && Number(selectedNode?.naturalHeight) > 0
      ? Number(selectedNode.naturalWidth) / Number(selectedNode.naturalHeight)
      : (Number(selectedNode?.w) > 0 && Number(selectedNode?.h) > 0 ? Number(selectedNode.w) / Number(selectedNode.h) : 1));
  const exportScope = selectDeliverableNodes(nodes, exportSelectionIds);
  const orderedDetailNodes = (detailOrderIds.length
    ? detailOrderIds.map(id => exportScope.deliverables.find(node => node.id === id)).filter(Boolean)
    : orderDetailNodes(exportScope.deliverables));
  const canExportLongDetail = orderedDetailNodes.length >= 2;

  /* 用户批注: 打开任何浮动面板时小地图自动收起, 避免互相遮挡 */
  const floatingCanvasPanelOpen = Boolean(addNodePanel)
    || Boolean(canvasContextPanel)
    || taskLogOpen
    || layersPanelOpen
    || exportOpen
    || shortcutHelpOpen
    || watermarkPanelOpen;
  useEffect(() => {
    if (floatingCanvasPanelOpen) setMinimapOpen(false);
  }, [floatingCanvasPanelOpen]);

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
    ? mergeGraphMentionSources(selectedNode, connections).map(id => availableComposerSources.find(node => node.id === id) || nodes.find(node => node.id === id)).filter(node => node?.url)
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

  /* P7 方案入画布：发射图的装配并入下面「从草稿/会话重建」的同一个效应。
     9-12 三次反馈后的真因（本地 QA 通道实测）：本函数原先声明在 showToast 之前，
     却在依赖里引用 showToast → 进画布瞬间 TDZ 抛错（Cannot access 'showToast' before initialization），
     整个画布崩掉、用户只看到空画布 + toast。声明位置必须在 showToast 之后。 */
  const applyPlanLaunch = useCallback(launch => {
    const graph = createPlanLaunchGraph({ launch, now: Date.now() });
    if (!graph.nodes.length) return false;
    /* 发射图必须**常驻**：进画布后 result 还会再变，重建效应会反复跑，只靠「跳过一跳」挡不住 */
    planLaunchGraphRef.current = {
      nodes: graph.nodes.map(normalizeCanvasNode),
      connections: graph.connections.map(normalizeCanvasConnection),
      targetId: graph.targetId,
    };
    setNodes(graph.nodes.map(normalizeCanvasNode));
    setConnections(graph.connections.map(normalizeCanvasConnection));
    setSelected(graph.targetId);
    setMultiSelected(new Set([graph.targetId]));
    const launchRect = containerRef.current?.getBoundingClientRect();
    if (launchRect && launchRect.width > 0) {
      const widths = graph.nodes.map(node => Number(node.w) || 240);
      const heights = graph.nodes.map(node => Number(node.h) || 240);
      const minX = Math.min(...graph.nodes.map(node => Number(node.x) || 0));
      const minY = Math.min(...graph.nodes.map(node => Number(node.y) || 0));
      const maxX = Math.max(...graph.nodes.map((node, index) => (Number(node.x) || 0) + (widths[index] || 240)));
      const maxY = Math.max(...graph.nodes.map((node, index) => (Number(node.y) || 0) + (heights[index] || 240)));
      const padding = 96;
      const graphW = Math.max(1, maxX - minX);
      const graphH = Math.max(1, maxY - minY);
      const fitScale = Math.min((launchRect.width - padding * 2) / graphW, (launchRect.height - padding * 2) / graphH, 1);
      const scale = Math.max(0.35, Number.isFinite(fitScale) ? fitScale : 1);
      setViewport({
        scale,
        x: (launchRect.width - graphW * scale) / 2 - minX * scale,
        y: (launchRect.height - graphH * scale) / 2 - minY * scale,
      });
    }
    if (graph.targetKind === 'suite-composer') {
      /* 快速通道：跳过设计分析，不自动跑方案 */
      autoPlanNodeRef.current = '';
      showToast('素材已进入画布，确认方案后即可生成', 'success');
    } else {
      /* 带设计方案：进画布后自动生成方案（报价→扣费在 handleDirectionGenerate 内完成，计费不变式不变） */
      autoPlanNodeRef.current = graph.targetId;
      showToast('素材与方案节点已进入画布 · 正在自动生成设计方案 (1 积分)', 'success');
    }
    return true;
  }, [showToast]);


  /* 9-11 二轮批注: 技能按钮 → 打开既有技能库管理界面 (SkillLibraryModal, 与首页/视频页同一个),
     选中技能回写节点: prompt 空才预填技能正文, skill/skillLabel 记名 (showToast 之后声明, 避免 TDZ)。 */
  const [skillLibraryTarget, setSkillLibraryTarget] = useState(null);
  const openSkillLibrary = useCallback((nodeId, domain) => {
    setSkillLibraryTarget({ nodeId, domain: domain || 'image' });
  }, []);
  /* ═══ 2026-09-28 批 CX（CV-1）：**「按技能开始」**——技能库不只服务"已有节点"，也能"起一个新节点" ═══
     为什么要有（docs/design/89 §5 第 1 步"一份声明三处复用"）：同一条技能声明现在只在**子页面工作台**里
     能选（画布上是"先建生成框、再点技能按钮"）。用户对画布的定位是"工作流生产地"，
     所以"我要做爆款复刻"这件事应该能**一步**落在画布上 —— 选一条技能 → 直接建出带这条技能的节点。
     ⚠️ `addCanvasComposer` 定义在本文件第 4109 行（远在下面），**不能**进这个 handler 的 deps 数组
     （deps 在渲染期求值 → TDZ 白屏，本仓踩过）。用 ref 拿最新实现，见下面 addCanvasComposer 之后的 effect。 */
  const addCanvasComposerRef = useRef(null);
  const openSkillLibraryForNew = useCallback((domain = 'image') => {
    setSkillLibraryTarget({ nodeId: null, domain, create: true });
  }, []);
  const handleSkillLibraryPick = useCallback(skill => {
    const target = skillLibraryTarget;
    setSkillLibraryTarget(null);
    if (!skill) return;
    const body = String(skill.body || skill.skillPrompt || '').trim();
    /* 起一个新节点（"按技能开始"）：按技能所属板块建对应生成框，并把技能打在它身上 */
    if (target?.create) {
      const kind = target.domain === 'video' ? 'video' : 'image';
      const composer = addCanvasComposerRef.current?.(kind, body ? { prompt: body } : {});
      if (!composer?.id) { showToast('新建节点失败，请重试', 'error'); return; }
      const applied = applyCanvasSkill({ prompt: body, skill: skill.slug || skill.name, skillBody: body });
      /* 批 CY-⑨（CV-2）：把**子页面坐标**一并记在节点上 —— 「在完整工作台里编辑」靠它才找得到那一页；
         只记技能名的话，将来改了名字就再也回不去了（名字匹配只是给更早的节点兜底）。 */
      setNodes(previous => previous.map(node => node.id === composer.id
        ? { ...node, ...applied, skillLabel: applied.skillLabel || skill.name, subpageSkillId: skill.id || '', subpageDomain: target.domain === 'video' ? 'video' : 'image' }
        : node));
      showToast(`已按「${skill.name}」新建节点，可以直接改参数生成`, 'success');
      return;
    }
    if (!target?.nodeId) return;
    setNodes(previous => previous.map(node => node.id === target.nodeId ? (() => {
      const next = applyCanvasSkill({ prompt: node.prompt || '', skill: skill.slug || skill.name, skillBody: body });
      /* 同 CV-2：换技能时**一并换掉子页面坐标**（否则节点会继续指向旧技能的那一页）。 */
      return { ...node, ...next, skillLabel: next.skillLabel || skill.name, subpageSkillId: skill.id || '', subpageDomain: target.domain === 'video' ? 'video' : 'image' };
    })() : node));
    if (body) showToast('技能已应用，提示词可继续修改', 'success');
  }, [applyCanvasSkill, skillLibraryTarget, showToast]);

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
    if (!projectContext || !state.logged || result.browserQa) return { assets, failed: assets.map(asset => ({ asset, error: new Error('图片项目处理不可用') })) };
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
      showToast('请登录后再重试', 'info');
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
      if (!projectContext) throw new Error('项目暂时不可用，请稍后重试');
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
      /* 9-11 用户批注②: 「重试扫描点了没反应」— 永远失败的记录会卡死待处理清单。
         改为: 每条记录累计失败次数, 连续 2 次失败即移出清单 (不再反复重试死记录)。 */
      const failedKeys = new Set(failed.map(item => pendingProjectAssetImportKey(item.record)));
      let droppedStale = 0;
      setPendingProjectAssetImports(previous => previous.map(record => {
        const key = pendingProjectAssetImportKey(record);
        if (completedKeys.has(key)) return null;
        if (failedKeys.has(key)) {
          const attempts = Number(record.attempts || 0) + 1;
          if (attempts >= 2) { droppedStale += 1; return null; }
          return { ...record, attempts };
        }
        return record;
      }).filter(Boolean));
      if (failed.length) {
        showToast(
          failed.length && droppedStale
            ? `${completed.length ? `已处理 ${completed.length} 个素材，` : ''}已跳过 ${droppedStale} 个反复失败的素材`
            : `${completed.length ? `已处理 ${completed.length} 个素材，` : ''}还有 ${failed.length} 个素材未处理完，请稍后重试`,
          'info',
        );
      } else if (completed.length) {
        showToast(`已处理 ${completed.length} 个素材，可继续引用生成`, 'success');
      }
    } catch (error) {
      showToast(error.message || '处理失败，请稍后重试', 'error');
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
      /* 9-12 用户批注：资产库只放**用户手动加入**的东西。上传进来的（provenance='source'）
         绝不能被自动登记进项目素材 —— 之前的自动登记把上传图也收进去了，用户看到「资产库」被塞满。
         生成物仍照旧自动归集（作品集口径不变）。 */
      if (node?.provenance === 'source') return false;
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
    /* 9-12 用户批注根治：首页发射图必须在这里装配，且**装配后不再被草稿/会话重建覆盖**。
       之前是独立效应，本效应随后跑一次就把它盖掉了 —— 用户看到「只跳画布、没有方案、没有素材」。 */
    const pendingLaunch = state.creationLaunch;
    /* ═══ 2026-09-28 批 CY-⑩（CV-2 第 2 步·反向）：**子页面 → 画布**（「送到画布」）══════════════════
       与首页"发射器"（ec-plan-launch）语义**不同**，别照抄那一段的处理：
         · 发射器 = 发来**一整套方案** ⇒ 整张图换成新方案（`applyPlanLaunch` 会 setNodes 覆盖）；
         · 「送到画布」 = 把**这一张成品**拿到画布上继续做 ⇒ **追加**一个节点，
           绝不覆盖用户已有的画布（他画布上可能正有活儿在干）。
       其余（清 launch、跳过"清空后那一跳"、标记草稿就绪）与发射器同一套写法 —— 那三条是必备的，
       少一条就会看到"toast 还在、画布却被重建清空"（上面那段注释记着这个坑）。 */
    if (isWorkbenchInbound(pendingLaunch)) {
      try {
        /* ⚠️ 落点要用**最新的** nodes 算（不能把 nodes 塞进本效应的依赖数组：那会让整段草稿逻辑
           每次改节点都重跑）。所以：id 先按时间戳定死，落点在 setNodes 的函数式更新里算 —— 两处
           用的是同一个 stamp，节点 id 因此可预测（选中/连线都指得准）。 */
        const stamp = Date.now();
        const items = (Array.isArray(pendingLaunch.images) ? pendingLaunch.images : []).filter(item => String(item?.url || '').trim());
        if (items.length) {
          const firstId = 'wb_inbound_' + stamp + '_1';
          setNodes(previous => [
            ...previous,
            ...workbenchInboundNodesOf({ launch: pendingLaunch, existing: previous, now: stamp }).map(normalizeCanvasNode),
          ]);
          setSelected(firstId);
          setMultiSelected(new Set([firstId]));
          showToast(`已把 ${items.length} 张结果放到画布上（落在现有内容右侧）`, 'success');
        } else {
          showToast('这一条没有可用的成图，没往画布上放东西', 'error');
        }
      } catch (error) {
        showToast(error?.message || '放到画布失败', 'error');
      } finally {
        dispatch({ type: 'SET_CREATION_LAUNCH', launch: null });
        launchJustAppliedRef.current = true;
      }
      draftReadyRef.current = true;
      return () => { cancelled = true; };
    }
    if (isPlanLaunch(pendingLaunch)) {
      try {
        applyPlanLaunch(pendingLaunch);
      } catch (error) {
        showToast(error?.message || '设计方案载入画布失败', 'error');
      } finally {
        dispatch({ type: 'SET_CREATION_LAUNCH', launch: null });
        /* 关键：launch 在依赖数组里，清空它会立刻让本效应再跑一次；
           不跳过那一跳，第二次会走正常重建分支，把刚铺好的节点全清空 ——
           用户看到的就是「toast 还在、画布全空」。 */
        launchJustAppliedRef.current = true;
      }
      draftReadyRef.current = true;
      return () => { cancelled = true; };
    }
    if (launchJustAppliedRef.current) {
      launchJustAppliedRef.current = false;
      draftReadyRef.current = true;
      return () => { cancelled = true; };
    }
    if (!hasCurrent) {
      const launchGraph = planLaunchGraphRef.current;
      if (launchGraph?.nodes?.length) {
        /* 本次会话是从首页发射进来的：画布内容 = 发射图，任何后续重建都还原它 */
        setNodes(launchGraph.nodes);
        setConnections(launchGraph.connections);
        draftReadyRef.current = true;
        return () => { cancelled = true; };
      }
      setNodes([]);
      setConnections([]);
      return () => { cancelled = true; };
    }
    /* 打开的是别的作品（有真实 result）：发射图让位，避免旧发射图复活 */
    planLaunchGraphRef.current = null;
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
          namer: canvasShotNamerRef.current,
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
    const rawInitialSnapshot = draft ? restoreCanvasSnapshot(draft) : null;
    /* P2 老文档迁移（不变式②）: mention -> reference 边（纯增量+幂等）, 老文档照常加载、只读可用 */
    const initialSnapshot = rawInitialSnapshot
      ? { ...rawInitialSnapshot, ...migrateMentionsToEdges(rawInitialSnapshot.nodes, rawInitialSnapshot.connections) }
      : null;
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
        const rawRemoteSnapshot = restoreCanvasSnapshot(remoteSession.snapshot);
        const remoteMigration = migrateMentionsToEdges(rawRemoteSnapshot.nodes, rawRemoteSnapshot.connections);
        setPendingProjectAssetImports(normalizePendingProjectAssetImports(rawRemoteSnapshot.pendingProjectAssetImports));
        setNodes(remoteMigration.nodes.map(normalizeCanvasNode));
        setConnections(remoteMigration.connections.map(normalizeCanvasConnection));
        setViewport(rawRemoteSnapshot.viewport);
        setCanvasSession(remoteSession);
        const remoteMediaRefs = canvasMediaAssetRefs(rawRemoteSnapshot.nodes);
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
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [result.id, result._saveKey, state.creationLaunch]);

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

  const canvasTaskLogEntries = useMemo(() => {
    const KIND_TYPE = { image: 'image', output: 'image', 'image-composer': 'image', 'text-composer': 'text', text: 'text', video: 'video', 'video-composer': 'video', audio: 'audio' };
    const KIND_LABEL = { image: '图片生成', output: '图片生成', 'image-composer': '图片生成', 'text-composer': '文案生成', text: '文本节点', video: '视频生成', 'video-composer': '视频生成', audio: '音频生成' };
    const entries = [];
    for (const node of nodes) {
      const kind = String(node?.kind || '');
      if (!KIND_TYPE[kind]) continue;
      const raw = String(node?.status || 'ready');
      const status = ['error', 'upload-error'].includes(raw) ? 'failed' : ['processing', 'uploading'].includes(raw) ? 'processing' : 'completed';
      entries.push({
        id: node.id,
        title: node.name || node.displayLabel || KIND_LABEL[kind] || '画布任务',
        type: KIND_TYPE[kind],
        status,
        message: node.error || node.progressLabel || '',
        at: node.updatedAt || node.createdAt || '',
      });
    }
    return entries
      .filter(entry => !dismissedTaskIds.has(entry.id))
      .sort((left, right) => {
        const order = { processing: 0, failed: 1, completed: 2 };
        return (order[left.status] - order[right.status]) || String(right.at).localeCompare(String(left.at));
      });
  }, [nodes, dismissedTaskIds]);
  useEffect(() => {
    setSelectedProjectAssetKeys(current => normalizeProjectAssetSelection(current, projectAssetLibrary));
  }, [projectAssetLibrary]);

  // B10: 全局键盘快捷键（使用 ref 避免循环依赖）
  // 注意：ref 初始值为空函数，在下面的 useEffect 中更新
  const handleDeleteRef = useRef(() => {});
  const fitViewRef = useRef(() => {});
  const handleAddTextRef = useRef(() => {});
  const handleCanvasSessionSaveRef = useRef(() => {});

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
        setAddNodePanel(null);
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
      // Delete/Backspace: 删除选中节点 (输入框/contenteditable 内不抢, 否则编辑文字时退格会删掉整个节点)
      if (!isTyping && (e.key === 'Delete' || e.key === 'Backspace') && (selected || multiSelected.size > 0)) {
        e.preventDefault();
        handleDeleteRef.current?.();
        return;
      }
      // Ctrl+A / Cmd+A: 全选 (输入框内保留原生全选)
      if (!isTyping && (e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        setMultiSelected(new Set(nodes.map(n => n.id)));
        setSelected(null);
        return;
      }
      // Ctrl+D / Cmd+D: 取消全选
      if (!isTyping && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setSelected(null);
        setMultiSelected(new Set());
        return;
      }
      // F: 适配视口 (输入文字时不能拦截 f 字符)
      if (!isTyping && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        fitViewRef.current?.();
        return;
      }
      /* 4c183cd4 续命 画布总监督 2026-08-30 - Quantv 完整快捷键 */
      // Ctrl+C / Cmd+C: 复制选中节点到剪贴板
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && (selected || multiSelected.size > 0)) {
        e.preventDefault();
        const ids = selected ? new Set([selected]) : multiSelected;
        const toCopy = (nodes || []).filter(n => ids.has(n.id));
        if (toCopy.length) {
          copyNodesToClipboard(toCopy).then(({ ok }) => {
            if (ok) console.info('[canvas] 已复制', toCopy.length, '个节点到剪贴板');
          });
        }
        return;
      }
      /* Ctrl+V / Cmd+V: 从剪贴板粘贴。
         9-17 用户批注（图7）：粘贴**必须区分"粘文本"和"粘节点"** ——
         用户从提示词区复制一段文字再粘贴，不能变成把整个生成节点复制出来。
         规则：输入态一律不拦（交还浏览器原生粘贴）；剪贴板不是画布节点载荷也不拦；
         只有「不在输入态 + 确实是画布节点载荷」才粘贴节点。 */
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (isCanvasEditingTarget(e.target) || isTyping || isCanvasEditingTarget(document.activeElement)) return;
        readClipboardNodes().then(payload => {
          /* 读回来之后再判一次：不是节点载荷 → 不 preventDefault（此处已 prevent），
             所以这里只在确实是节点载荷时才落节点，其余情况静默放行。 */
          if (!shouldHandleCanvasPaste({ typing: false, payload })) return;
          // 偏移位置避免覆盖
          const offset = 36;
          const now = Date.now();
          const newNodes = payload.nodes.map((n, i) => ({
            ...n,
            id: `pasted_${now}_${i}_${n.id}`,
            x: (n.x || 100) + offset + i * offset,
            y: (n.y || 100) + offset + i * offset,
            userRenamed: false,
          }));
          setNodes(prev => [...prev, ...newNodes]);
        });
        return;
      }
      // Ctrl+D / Cmd+D: 复制选中节点 (复用 Ctrl+V 机制, 不清空选中)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && (selected || multiSelected.size > 0)) {
        // 上面 Ctrl+D 已绑到取消全选, 改成单独的 Cmd+D 复制
        if (e.metaKey && (selected || multiSelected.size > 0)) {
          e.preventDefault();
          const ids = selected ? new Set([selected]) : multiSelected;
          const toDup = (nodes || []).filter(n => ids.has(n.id));
          if (toDup.length) {
            const offset = 36;
            const now = Date.now();
            const newNodes = toDup.map((n, i) => ({
              ...n,
              id: `dup_${now}_${i}`,
              x: (n.x || 100) + offset + i * offset,
              y: (n.y || 100) + offset + i * offset,
            }));
            setNodes(prev => [...prev, ...newNodes]);
          }
          return;
        }
        return;
      }
      // Ctrl+Z / Cmd+Z: 撤销
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        const current = { nodes };
        const previous = historyRef.current.undo(current);
        if (previous !== current && previous.nodes) {
          setNodes(previous.nodes);
          historyRef.current.push(current);
        }
        return;
      }
      // Ctrl+Shift+Z / Cmd+Shift+Z: 重做
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && e.shiftKey) {
        e.preventDefault();
        const current = { nodes };
        const next = historyRef.current.redo(current);
        if (next !== current && next.nodes) {
          setNodes(next.nodes);
        }
        return;
      }
      // Ctrl+G / Cmd+G: 打组
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g' && (selected || multiSelected.size > 0)) {
        e.preventDefault();
        const ids = selected ? new Set([selected]) : multiSelected;
        if (ids.size >= 2) {
          setNodes(prev => createCanvasGroup(prev, ids));
        }
        return;
      }
      // Ctrl+Shift+G / Cmd+Shift+G: 取消分组
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g' && (selected || multiSelected.size > 0)) {
        e.preventDefault();
        const ids = selected ? new Set([selected]) : multiSelected;
        setNodes(prev => dissolveCanvasGroup(prev, ids));
        return;
      }
      // Ctrl+S / Cmd+S: 手动保存
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setSaveStatus('saving');
        // 触发持久化 (debounce 200ms 模拟)
        setTimeout(() => {
          setSaveStatus('saved');
          setLastSavedAt(Date.now());
        }, 220);
        return;
      }
      // ?: 帮助面板
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShortcutHelpOpen(true);
        return;
      }
      // 方向键移动选中节点
      if (!isTyping && (selected || multiSelected.size > 0)) {
        const step = e.shiftKey ? 10 : 1;
        let dx = 0, dy = 0;
        if (e.key === 'ArrowLeft') dx = -step;
        else if (e.key === 'ArrowRight') dx = step;
        else if (e.key === 'ArrowUp') dy = -step;
        else if (e.key === 'ArrowDown') dy = step;
        if (dx || dy) {
          e.preventDefault();
          const ids = selected ? new Set([selected]) : multiSelected;
          setNodes(prev => prev.map(n => ids.has(n.id) && !n.locked
            ? { ...n, x: (n.x || 0) + dx, y: (n.y || 0) + dy }
            : n));
          return;
        }
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

  /* ═══ 2026-09-27 批 CU：**世界坐标 → 视口像素**（`toWorldPoint` 的反函数）═════════════════════
     为什么必须有这一个（用户本批批注的原话，逐字）：
       「你现在画布进来的话，随便上传一个素材，**右边的这个加号里面的选项都不见了**呀。
        怎么丢失了呀？之前不是跟你说了吗？我们进来之后随便上传一个素材，
        **它应该自动张开右边的这个加号的选项区**呀。然后我刚刚试了一下**右边的加号一拉动。
        鼠标停下来，它依然没有出现选项区**呀。」
     根因（读代码 + 探针实测，见 `.qa/cu-derive-menu.mjs`）：派生菜单是
     `CanvasStudio.jsx` 的 `CanvasPopoverPortal` 渲染的，而它第一行就是
       `if (!open || !anchor) return null;`
     —— **没有锚点就整块不渲染**。三条入口里只有"点一下加号"（`handlePortClick`）会带
     `anchorRect`（取自触发按钮的视口矩形），另外两条**都没带**：
       · 上传素材后的自动张开（`openConnectionPickerForNode(node)` 不传 triggerEl）⇒ anchor=null；
       · 拖动加号、在空白处松手（`handlePointerUp` 的 connect 分支只给了 world 坐标）⇒ anchor=null。
     于是这两条路径**静默什么都不显示**（既不报错也不渲染），用户看到的就是"选项区不见了"。
     ⇒ 修法：凡是给菜单设锚点的入口都必须给得出**视口矩形** —— 节点锚点用这条函数换算
       （世界坐标 × scale + 容器原点 + viewport 偏移），拖动落点直接用落点像素。 */
  const toViewportPoint = useCallback((point) => {
    const rect = containerRef.current?.getBoundingClientRect();
    return {
      x: (rect?.left || 0) + viewport.x + (Number(point?.x) || 0) * viewport.scale,
      y: (rect?.top || 0) + viewport.y + (Number(point?.y) || 0) * viewport.scale,
    };
  }, [viewport.x, viewport.y, viewport.scale]);

  /** 节点在世界坐标里的矩形 → 视口像素矩形（派生菜单按"锚点右缘 + 12px 向右展开"用它）。 */
  const viewportRectForNode = useCallback((node) => {
    if (!node) return null;
    const scale = viewport.scale || 1;
    const topLeft = toViewportPoint({ x: node.x, y: node.y });
    const width = Math.max(0, (Number(node.w) || 0) * scale);
    const height = Math.max(0, (Number(node.h) || 0) * scale);
    return { x: topLeft.x, y: topLeft.y, width, height, right: topLeft.x + width, bottom: topLeft.y + height };
  }, [toViewportPoint, viewport.scale]);

  /** 指针落点（clientX/clientY，已是视口像素）→ 零尺寸锚点矩形（菜单从落点右侧展开）。 */
  const viewportRectForEvent = useCallback((event) => {
    const x = Number(event?.clientX) || 0;
    const y = Number(event?.clientY) || 0;
    return { x, y, width: 0, height: 0, right: x, bottom: y };
  }, []);

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
      /* 9-11 用户批注③: 点空白 = 收起全部功能栏 — 右栏(派生菜单/图片编辑器)随顶栏一起关闭 */
      setConnectionPicker(null);
      setConnectionDraft(null);
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

  const openConnectionPickerForNode = useCallback((node, triggerEl = null) => {
    if (!canDeriveFromCanvasSource(node)) return;
    /* 2026-09-20：改用**触发元素的视口矩形**作为弹层锚点（原来是节点的世界坐标）。
       世界坐标要经过缩放层换算，实测在面板打开时会算飞（left=-717 → 屏幕 x=10）。
       视口像素只有一套坐标系，交给 CanvasPopoverPortal(place='right') 统一处理。
       ⚠️ 2026-09-27 批 CU：**没有触发元素时不能给 null** —— portal 的 `if (!open || !anchor) return null`
       会让整块菜单不渲染（上传素材后的自动张开就是这么消失的）。退化为"节点自身的视口矩形"：
       菜单仍从素材右缘 +12px 展开，与"绝不盖住源素材"的口径一致。 */
    const rect = triggerEl?.getBoundingClientRect?.();
    const anchorRect = rect
      ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }
      : viewportRectForNode(node);
    setConnectionPicker({
      sourceNodeId: node.id,
      anchorRect,
      world: {
        x: Number(node.x) + Number(node.w) + 42,
        y: Number(node.y) + Number(node.h) / 2,
      },
    });
    setConnectionDraft(null);
    /* ⚠️ deps 里**只能放 viewportRectForNode**（它定义在本函数之前）。
       把它上面的 `canDeriveFromCanvasSource` 放进 deps 会立刻 TDZ 白屏 ——
       实测（.qa/cu-derive-menu.mjs）：
         PAGEERR Cannot access 'canDeriveFromCanvasSource' before initialization
       原因：deps 数组在**渲染期**求值，而那个 useCallback 声明在本函数之后（本仓 09-04 踩过同一个坑）。
       它本身 deps 为空、身份稳定，不进 deps 数组也安全。 */
  }, [viewportRectForNode]);

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
        /* ⚠️ 2026-09-27 批 CU：**必须带 anchorRect** —— 原来只给 world 坐标，
           而 CanvasPopoverPortal 是 `if (!open || !anchor) return null`（视口像素定位），
           于是"拖加号 → 松手"这条路径**整块菜单不渲染**（用户原话：「我刚刚试了一下右边的加号
           一拉动。鼠标停下来，它依然没有出现选项区呀」）。落点已经是视口像素，直接用。 */
        anchorRect: viewportRectForEvent(e),
        world: point,
      });
      /* 这一条已经被 stage 处理过 ⇒ window 兜底那次要跳过（见 handlePortPointerDown） */
      connectReleaseSettledRef.current = true;
      setConnectionDraft(null);
      setPointerMode(null);
      return;
    }
    /* 用户 9-05 定稿的面板出现逻辑:
       - 上传素材落画布: 工具栏 + 派生菜单同时开 (见上传完成处理)
       - 单击已选中素材: 只开顶部工具栏
       - 点素材右侧 + / 拖线松开: 才打开派生菜单
       因此单击这里不再自动弹派生菜单。 */
    if (pointerMode?.kind === 'marquee' && marquee) {
      const ids = new Set(selectNodesInRect(nodes, marquee));
      setMultiSelected(pointerMode.additive ? new Set([...multiSelected, ...ids]) : ids);
      setSelected(null);
    }
    setPointerMode(null);
    setMarquee(null);
  }, [connectionDraft, flushDragFrame, marquee, multiSelected, nodes, openConnectionPickerForNode, pointerMode, toWorldPoint, viewportRectForEvent]);

  // B3: 使用 requestAnimationFrame 节流 wheel 事件
  const wheelRafRef = useRef(null);
  const handleWheel = useCallback((e) => {
    // 面板/控件内的滚轮只滚动面板自身，不缩放画布
    if (e.target?.closest?.('[data-canvas-control="true"]')) return;
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
      /* 用户 9-04 反馈: 选择工具下节点完全拖不动 — 旧逻辑在这里只选中就 return。
         改为: 选中并继续走下方统一的 drag 初始化 (可拖动); 松手时若没有位移,
         对图片/输出节点打开"引用当前素材生成"派生菜单 (保留单击派生入口)。 */
      setSelected(id);
      setMultiSelected(new Set([id]));
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
    /* 9-16 用户批注（图15~19）：打组/绑定之后「一起移动」——
       拖其中任意一个，同组（含绑定）的其它节点跟着走。 */
    const groupIds = expandCanvasGroupDragIds(nodes, id);
    groupIds.forEach(memberId => ids.add(memberId));
    setSelected(ids.size === 1 ? id : null);
    setMultiSelected(ids);
    setPointerMode({ kind: 'drag', ids, start: toWorldPoint(e), clickNodeId: id });
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

  /* 9-11 用户批注#2: 持久化图片解码成功才清本地预览 (data URI), 消除替换后空白/闪屏 */
  /* 9-15 用户批注：图片上传后 1~3 秒突然不显示 —— 根因是本地预览在「持久 url 尚未证明可用」时就被
     清掉：img 的 onLoad 先于上传持久化触发，localPreviewUrl 被立刻清除，随后 src 切到持久 url；
     若此时持久 url 加载失败（后端一致性问题 / 临时失败），ResponsiveImage 重试后直接把图片整个隐藏，
     节点变成一个空框。修复：本地预览只在两种安全时机清除 ——
     ① url 与 localPreviewUrl 相同（切换无风险）；② swapNodeToDurableUrl 预载成功后再清。 */
  const handleImagePreviewReady = useCallback(nodeId => {
    setNodes(previous => previous.map(node => (node.id === nodeId && node.localPreviewUrl && node.url === node.localPreviewUrl && node.status !== 'uploading')
      ? { ...node, localPreviewUrl: '' }
      : node));
  }, []);

  /* 9-15 上传图片 1 秒后消失的根治：持久 url 先回写（草稿保存稳定地址、派生立即可用），
     但 localPreviewUrl 只在「持久 url 真的解码成功」后才清除 —— 预载失败则保留本地预览，
     节点永远不出现空框。预载重试两轮（900ms/1800ms），彻底失败则以后台本地预览兜底。 */
  const swapNodeToDurableUrl = useCallback((nodeId, durableUrl, fallbackNode) => {
    const url = String(durableUrl || '');
    if (!url) return;
    const attemptRef = { current: 0 };
    let settled = false;
    setNodes(previous => previous.map(node => node.id === nodeId ? { ...node, url, status: 'ready', uploadError: '' } : node));
    const finish = ok => {
      if (settled) return;
      settled = true;
      if (ok) {
        setNodes(previous => previous.map(node => (node.id === nodeId && node.localPreviewUrl)
          ? { ...node, localPreviewUrl: '' }
          : node));
      } else if (fallbackNode) {
        /* 持久 url 彻底不可用：本地预览继续可见，不空框；状态仍 ready 便于继续派生 */
        setNodes(previous => previous.map(node => node.id === nodeId
          ? { ...node, status: 'ready', uploadError: fallbackNode.uploadError || '' }
          : node));
      }
    };
    const probe = new Image();
    probe.onload = () => finish(true);
    probe.onerror = () => {
      if (attemptRef.current < 2) {
        attemptRef.current += 1;
        const busted = url.includes('?') ? `${url}&preload_retry=${attemptRef.current}` : `${url}?preload_retry=${attemptRef.current}`;
        setTimeout(() => { probe.src = busted; }, 900 * attemptRef.current);
      } else {
        finish(false);
      }
    };
    probe.src = url;
  }, []);

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

  /* 9-15 用户决定（复核 9-13）：**生成前无加号、生成结果必须有加号** ——
     生成框（图片/视频/文案/套图）生成前不挂加号；生成后结果落框时，框仍从加号继续派生；
     文案结果节点可派生「生成图片 / 生成视频」。
     派生判定：普通素材沿用 canDeriveFromNode；四个生成框在「结果已落框或仍在生成中」时放行，
     这样生成多张时框与结果之间的派生连线也画得出来。 */
  const canDeriveFromCanvasSource = useCallback(node => {
    if (!node) return false;
    if (canDeriveFromNode(node)) return true;
    if (!['image-composer', 'text-composer', 'video-composer', 'suite-composer'].includes(String(node.kind || ''))) return false;
    return Boolean(node.url) || ['processing', 'success', 'completed', 'generating'].includes(String(node.status || ''));
  }, []);

  /* ═══ 2026-09-27 批 CU：拖派生线时**在哪里松手都能收尾** ═════════════════════════════════════
     为什么要补这一条：`handlePointerUp` 是挂在**画布 stage** 上的，所以「拖着加号把鼠标移到
     右侧面板 / 顶栏上松手」这一类操作 stage 收不到 pointerup ⇒ ① 派生菜单不出现；
     ② `connectionDraft` / `pointerMode='connect'` 留在原地（历史上这个残留状态的表现是
     「加号没反应 + 之后所有素材拖不动」，用户 9-04 报过）。
     ⇒ 在端口 pointerdown 时挂一个**一次性 window 兜底**；stage 已经处理过的话（同一事件冒泡到 window）
     用 settled 标记跳过，绝不重复处理。
     ⚠️ 这里只放 ref（不把 handlePointerUp 写进任何 deps）—— 本文件 09-04 就是因为 deps 数组在渲染期
     求值引用了后面才声明的 useCallback，整页 TDZ 白屏。 */
  const pointerUpHandlerRef = useRef(null);
  const connectReleaseSettledRef = useRef(false);
  useEffect(() => { pointerUpHandlerRef.current = handlePointerUp; }, [handlePointerUp]);

  const handlePortPointerDown = useCallback((e, nodeId, side) => {
    if (side !== 'out') return;
    const source = nodes.find(node => node.id === nodeId);
    if (!canDeriveFromCanvasSource(source)) {
      showToast('完成当前处理后，可从生成结果继续派生', 'info');
      return;
    }
    // 输出端口不能捕获指针，否则空白处松手时 pointerup 仍会落在端口上，
    // 画布就无法打开“从素材派生”的任务选择器。
    setConnectionPicker(null);
    setConnectionDraft({ from: nodeId, sourceNodeId: nodeId, type: 'reference', pointer: toWorldPoint(e) });
    setPointerMode({ kind: 'connect', from: nodeId });
    connectReleaseSettledRef.current = false;
    const onWindowUp = event => {
      /* stage 已经处理过（事件继续冒泡到 window）⇒ 跳过，不要重复开菜单 */
      if (connectReleaseSettledRef.current) return;
      connectReleaseSettledRef.current = true;
      pointerUpHandlerRef.current?.(event);
    };
    window.addEventListener('pointerup', onWindowUp, { once: true });
    window.addEventListener('pointercancel', onWindowUp, { once: true });
  }, [nodes, showToast, toWorldPoint]);

  const handlePortClick = useCallback((event, nodeId) => {
    const source = nodes.find(node => node.id === nodeId);
    if (!canDeriveFromCanvasSource(source)) return;
    /* 2026-09-20：锚点改用**触发按钮的视口矩形**（原来用 toWorldPoint(event) 的世界坐标）。
       世界坐标要经缩放层换算，实测面板打开时算飞（世界 -717 → 屏幕 x=10，甩到最左且被裁）。
       视口 px 只有一套口径，配合 CanvasPopoverPortal(place='right') 锚在按钮右侧展开。 */
    const portEl = event?.currentTarget?.closest?.('button') || event?.currentTarget;
    const rect = portEl?.getBoundingClientRect?.();
    setConnectionPicker({
      sourceNodeId: nodeId,
      anchorRect: rect
        ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }
        : null,
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
    /* 用户 9-04 反馈"死按钮": 以前这里直接静默 return, 用户点了没任何反应。 */
    if (!source) { showToast('素材已被删除，无法继续派生', 'info'); return; }
    if (!actionSpec?.execute?.nodeKind) { showToast('该功能暂时不可用', 'info'); return; }
    if (!canDeriveFromCanvasSource(source)) {
      showToast(source.status === 'processing' || source.status === 'uploading' || source.status === 'analyzing'
        ? '素材还在处理中，完成后即可派生'
        : '当前素材暂不支持派生，请先完成生成', 'info');
      return;
    }
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
      imageWatermark: source.imageWatermark || (['image', 'output', 'image-composer', 'layer-group'].includes(source.kind) ? imageWatermark : undefined),
      videoWatermark: source.videoWatermark || (['video', 'video-composer'].includes(source.kind) ? videoWatermark : undefined),
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
    /* [canvas-graph-inputs:generate] */
    /* 边 = 数据通道 (能力地图 N2): 先按入边收集上游产物, 无入边时下面每个 || 都原样落回老逻辑
       (sourceNodeIds[0]), 老图行为不变。编号规则见 canvasGraphInputs.js: 入边顺序 = @图片1/@图片2。*/
    const edgeInputs = collectNodeInputsFromEdges(node, connections, nodes);
    const source = nodes.find(item => item.id === node.sourceNodeIds?.[0]);
    const sourceUrl = edgeInputs.images[0]?.url || node.inputs?.sourceUrl || source?.url || source?.assets?.find(asset => asset?.url)?.url || '';
    const prompt = String(node.inputs?.prompt || edgeInputs.texts[0]?.content || '').trim();
    /* [/canvas-graph-inputs:generate] */
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
      /* [canvas-graph-inputs:generate-refs] */
      /* 入边第 2 张起 = @图片2..@图片N (第 1 张已是主输入 imageUrl), 与已有参考图去重。*/
      for (const url of edgeInputs.images.slice(1).map(image => image.url)) {
        if (url && !referenceImages.includes(url)) referenceImages.push(url);
      }
      /* [/canvas-graph-inputs:generate-refs] */
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
  }, [connections, nodes, promptLoading, showToast, updateWorkflowNode, handleCanvasActionError]);

  useEffect(() => { workflowGenerateRef.current = handleWorkflowGenerate; }, [handleWorkflowGenerate]);

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
    /* [canvas-graph-inputs:process] */
    /* 边 = 数据通道 (能力地图 N2): 入边优先, 无入边回退老逻辑; source 也兜底到入边首个上游
       (下游读 source.ratio/name/几何, 缺了会炸)。*/
    const edgeInputs = collectNodeInputsFromEdges(node, connections, nodes);
    const edgeSourceNode = edgeInputs.sources.length ? nodes.find(item => item.id === edgeInputs.sources[0]) : null;
    const source = nodes.find(item => item.id === node.sourceNodeIds?.[0]) || edgeSourceNode || undefined;
    const sourceUrl = edgeInputs.images[0]?.url || node.inputs?.sourceUrl || source?.url || source?.assets?.find(asset => asset?.url)?.url || '';
    /* [/canvas-graph-inputs:process] */
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
  }, [connections, executeBrowserSegmentation, nodes, promptLoading, showToast, updateWorkflowNode, handleCanvasActionError]);

  useEffect(() => {
    workflowProcessRef.current = handleWorkflowProcess;
  }, [handleWorkflowProcess]);

  /* ── P0.5 分组"运行整链"（B站教程核心动作：选中→设为分组→运行）──
     只在用户显式点击且（预估>0 时）二次确认后执行；失败只阻塞下游，不扣无关分支的钱。 */
  function startGraphChainRun(plan, runnable) {
    const downstream = buildTransitiveDownstream(nodes, connections);
    const controller = new AbortController();
    graphRunAbortRef.current = controller;
    const supported = new Set(Object.keys(GRAPH_RUN_KINDS));
    createGraphRunner({
      plan,
      downstream,
      supportedKinds: supported,
      runNode: async (nodeId) => {
        const node = nodesRef.current.find((n) => String(n.id) === String(nodeId));
        if (!node) return;
        const action = GRAPH_RUN_KINDS[node.actionId || node.kind];
        const fn = action === 'process' ? workflowProcessRef.current : workflowGenerateRef.current;
        if (typeof fn === 'function') { await fn(node); }
      },
      awaitTerminal: createTerminalAwaiter(() => nodesRef.current, { pollMs: 300, timeoutMs: 120000 }),
      onStatus: (id, status) => { updateWorkflowNode(id, { status }); },
      signal: controller.signal,
    }).then((res) => {
      if (res.aborted) { showToast('已停止运行整链', 'info'); return; }
      showToast('整链运行完成：成功 ' + res.succeeded.length + ' · 失败 ' + res.failed.length + ' · 跳过 ' + res.skipped.length, res.failed.length ? 'info' : 'success');
    });
  }

  function runGraphChain(explicitTargets) {
    const targets = (explicitTargets && explicitTargets.length) ? explicitTargets : ([...multiSelected, selected].filter(Boolean));
    if (!targets.length) { showToast('先选中要运行的节点（可框选多个）', 'info'); return; }
    const supported = new Set(Object.keys(GRAPH_RUN_KINDS));
    const plan = buildRunPlan({ nodes, connections, targetNodeIds: targets, supportedKinds: supported, costOf: (n) => estimateNodeCost(n) });
    if (!plan.ok) { showToast('存在循环连线，无法运行整链', 'info'); return; }
    const runnable = plan.executableNodeIds;
    if (!runnable.length) { showToast('选中的节点暂时不能运行整链', 'info'); return; }
    if (plan.estimatedUnits <= 0) { startGraphChainRun(plan, runnable); return; }
    setGraphRunConfirm({ plan, runnable });
  }

  /* ── P2 工作流模板"一键铺开": instantiate（服务端 usage+1, 铺开本身不扣费）-> 按相对坐标铺开图
     -> [槽] 节点琥珀高亮（node.isSlot 数据真源, CanvasStudio 渲染）-> 顶部浮出运行 offer,
     运行复用 P0.5 "预览 -> 二次确认"（不变式①）; T4/T5 requiresAudioVideo 呈 P3 灰态、不提供扣费运行。 */
  async function handleInstantiateWorkflowTemplate(template) {
    if (!template?.slug) return;
    try {
      const res = await instantiateWorkflowTemplate(template.slug);
      const snapshot = createCanvasSnapshot(res.snapshot || { nodes: [], connections: [] });
      const migrated = migrateMentionsToEdges(snapshot.nodes, snapshot.connections);
      const p3Nodes = markP3PendingNodes(migrated.nodes, res.requiresAudioVideo === true);
      setNodes(p3Nodes.map(normalizeCanvasNode));
      setConnections(migrated.connections.map(normalizeCanvasConnection));
      setViewport(snapshot.viewport);
      setSelected(null);
      setMultiSelected(new Set());
      /* P2: 铺开后是全新画布会话（spec §1: createCanvasSnapshot(template.graph) -> createCanvasSession）,
         用户此前的画布留在旧会话, 顶栏"恢复"可回到旧版。*/
      const nextProjectId = String(result.projectId || '').trim();
      const nextBaseVersionId = String(result.resultVersionId || result.sourceVersionId || '').trim();
      if (nextProjectId && nextBaseVersionId) {
        try {
          const created = await createCanvasSession({ projectId: nextProjectId, baseVersionId: nextBaseVersionId, snapshot });
          canvasSessionRef.current = created;
          setCanvasSession(created);
          remoteSnapshotRef.current = JSON.stringify(snapshot);
          dispatch({ type: 'SET_RESULT', result: { ...result, canvasSession: created, canvasSessionId: created.id, canvasSessionRevision: created.revision } });
        } catch {
          showToast('画布已铺开', 'info');
        }
      }
      setWorkflowRunOffer({
        name: res.name || template.name,
        estimatedUnits: Number(res.estimatedUnits) || 0,
        requiresAudioVideo: res.requiresAudioVideo === true,
        gateNote: res.gateNote || '',
        targetNodeIds: p3Nodes.map(node => String(node.id)),
      });
      /* 9-11: 文案随 P4 对齐 —— 不再有琥珀[槽], 素材节点是真实上传节点(占位图 + 「替换」角标) */
      showToast(res.requiresAudioVideo === true
        ? '已铺开 "' + (res.name || template.name) + '" · 视频节点能力接入中，可先替换素材运行图片部分'
        : '已铺开 "' + (res.name || template.name) + '" · 点素材节点「替换」换成你的图，选中节点运行整链', 'success');
    } catch (error) {
      showToast(error?.message || '模板铺开失败，请稍后重试', 'error');
    }
  }

  const updateWorkflowLayers = useCallback((nodeId, updater) => {
    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId) return node;
      const layers = updater(node.inputs?.layers || []);
      return { ...node, inputs: { ...(node.inputs || {}), layers } };
    }));
  }, []);

  const handleWorkflowLayerExport = useCallback((layer) => {
    if (!layer?.preview_url) {
      showToast('像素图层导出暂未开放', 'info');
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
      if (!canDeriveFromCanvasSource(source)) {
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
    /* 用户 9-10: 「替换」素材 —— 记住目标节点后走既有上传通道(图片走 source 输入, 视频走 video 输入),
       上传完成后把素材套回该节点, 位置/尺寸/连线/派生关系全部不变。 */
    if (handler === 'replace-media') {
      mediaReplaceTargetRef.current = node.id;
      if (node.kind === 'video') videoUploadRef.current?.click();
      else sourceUploadRef.current?.click();
      return;
    }
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
    if (handler === 'save-to-assets') {
      /* 9-11 用户批注①: 资产库 = 用户显式定义 — 只有用户点「加入资产库」的节点才进资产库,
         上传/替换不再自动处理。生成物仍由 register-generated 自动归集到作品。
         9-12 用户批注：**再点一次要能取消**（原来只进不出：「只许我点进去，不许我点出来」）。 */
      if (!state.logged) { showToast('登录后才能收藏到资产库', 'info'); return; }
      const existingProjectAssetId = String(node.projectAssetId || node.assetRef?.projectAssetId || '').trim();
      if (existingProjectAssetId) {
        try {
          const existingProjectId = String(node.projectId || node.assetRef?.projectId || result.projectId || '').trim();
          if (!existingProjectId) throw new Error('资产库暂不可用，请稍后重试');
          await deleteProjectAsset(existingProjectId, existingProjectAssetId);
          setNodes(previous => previous.map(item => item.id === node.id
            ? { ...item, projectAssetId: '', assetRef: null }
            : item));
          showToast('已从资产库移除', 'success');
        } catch (error) {
          showToast(error?.message || '移除失败，请稍后重试', 'error');
        }
        return;
      }
      try {
        const isMedia = ['video', 'audio'].includes(node.kind);
        /* 9-16（图20）：先判有没有可收藏的内容，再建项目——不然空节点会先去建一个项目再失败。
           提示按「说结果不说机制」收短。 */
        const stableUrl = String(node.url || '');
        if (!stableUrl) { showToast('这个素材还没生成好', 'info'); return; }
        const projectContext = await ensureCanvasMediaProject(isMedia ? 'Canvas 媒体素材项目' : 'Canvas 图片素材项目', isMedia ? 'video' : 'ecommerce');
        if (!projectContext) throw new Error('资产库暂时不可用，请稍后再试');
        let sourceAsset = { url: stableUrl, name: node.name || node.displayLabel || '画布素材' };
        /* 只要素材还不是「服务端稳定地址」，就必须先落成一个真正的服务端素材：
           上传接口返回的 assetId 才是入库（import-media）认得的 ID。
           画布节点自己的 id（upload_…）不是服务端素材 ID，直接拿去入库会被判 404
           「图片素材不存在或不属于当前账号」—— 这正是用户反复看到的「不能加入资产库」。 */
        if (!/^\/api\/generated-assets\//i.test(stableUrl)) {
          const persisted = await persistCanvasUploadAssets(
            [{ assetId: node.assetId || node.id, name: sourceAsset.name, url: stableUrl }],
            { role: 'user-saved' },
          );
          const uploaded = persisted?.[0];
          if (!uploaded?.url) throw new Error('这个素材暂时无法加入资产库');
          sourceAsset = { ...sourceAsset, ...uploaded, name: sourceAsset.name };
        }
        if (!sourceAsset?.url) throw new Error('这个素材暂时无法加入资产库');
        /* 把真正的服务端素材 ID 补齐（节点上的 assetId 可能还是画布内部 id）。 */
        if (!sourceAsset.assetId) sourceAsset = { ...sourceAsset, assetId: canvasServerAssetIdFromUrl(stableUrl) };
        const imported = isMedia
          ? await importCanvasMediaAssets([sourceAsset], projectContext, node.kind === 'video' ? 'user-saved-video' : 'user-saved-audio')
          : await importCanvasImageAssets([sourceAsset], projectContext, 'user-saved');
        if (imported?.failed?.length) throw new Error('这个素材暂时无法加入资产库');
        /* 9-17 用户批注（图8）：「已入库高亮 + 再点一次移除」原来两头都断的：
           入库成功后**没有把 projectAssetId 写回节点**，于是
             ① 按钮不会高亮（看不出已经入库）；
             ② 再点一次时 existingProjectAssetId 仍为空 → 又走一遍入库，永远退不出来。
           这里把服务端回来的入库凭据写回节点，两个状态才有据可依。 */
        const storedAsset = imported?.assets?.[0] || {};
        const storedProjectAssetId = String(storedAsset.projectAssetId || storedAsset.asset?.projectAssetId || '').trim();
        if (storedProjectAssetId) {
          const storedProjectId = String(storedAsset.projectId || projectContext.projectId || '').trim();
          setNodes(previous => previous.map(item => item.id === node.id
            ? {
              ...item,
              projectId: storedProjectId,
              projectAssetId: storedProjectAssetId,
              assetRef: { projectId: storedProjectId, projectAssetId: storedProjectAssetId },
            }
            : item));
        }
        dispatch({ type: 'SET_RESULT', result: { ...result, projectId: projectContext.projectId, sourceVersionId: projectContext.baseVersionId } });
        showToast('已加入资产库', 'success');
      } catch (error) {
        showToast(error?.message || '加入资产库失败，请稍后重试', 'error');
      }
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
      /* 用户主动删除后，发射图不再作为本次会话的内容源（否则重建时会被“复活”） */
      planLaunchGraphRef.current = null;
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
      /* 9-16 用户批注（图15~19）：「打组与绑定元素行为一样、不能取消、按钮不高亮、
         组内节点还带加号、组框样式与普通选中一样」——
         现在走 applyCanvasGroupAction：打组/绑定各自独立前缀，再点一次解除，
         解除后 groupId 清空、组框消失、加号回来。 */
      const wanted = actionId === 'bind-elements' ? 'bind' : 'group';
      const current = canvasSelectionGroupState(nodes, multiSelected);
      setNodes(previous => applyCanvasGroupAction(previous, multiSelected, actionId));
      /* 提示只讲结果，不讲机制（用户：提示要简短、面向用户目的） */
      const releasing = current.kind === wanted;
      showToast(
        wanted === 'bind'
          ? (releasing ? '已解除绑定' : '已绑定，拖动会一起移动')
          : (releasing ? '已解除打组' : '已打组'),
        'success',
      );
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

  /* 9-12 用户批注：点「新建画布」应该进入**画布库**（管理已创建过的画布），
     库里再点「+ 新建画布」才真正开一张空白画布。 */
  const handleNew = useCallback(async () => {
    if (!state.logged) {
      dispatch({ type: 'SHOW_LOGIN', show: true });
      return;
    }
    setCanvasLibraryOpen(true);
  }, [dispatch, state.logged]);

  const createBlankCanvas = useCallback(async () => {
    // 9-06: 新建前自动保存旧画布, 用户可在作品集找回 (防数据丢失)
    if (nodes.length > 0 && handleCanvasSessionSaveRef.current) {
      try {
        await handleCanvasSessionSaveRef.current();
        showToast('旧画布已保存，可在作品集中找回');
      } catch { /* 保存失败不阻塞新建 */ }
    }
    setSelected(null);
    setMultiSelected(new Set());
    setEditingTextNodeId(null);
    setConnectionDraft(null);
    setConnectionPicker(null);
    setNodes([]);
    setConnections([]);
    setViewport({ x: 80, y: 40, scale: 1 });
    canvasSessionRef.current = null;
    setCanvasSession(null);
    if (remoteSaveTimerRef.current) clearTimeout(remoteSaveTimerRef.current);
    remoteSaveTimerRef.current = null;
    remoteSnapshotRef.current = '';
    // 空画布也必须带 _ecResult 标记：否则回到首页时它会被当成"图文结果"，
    // 自动弹出空白的结果弹窗（2026-09-10 用户反馈），并且此后保存的画布作品会被误分类为 xhs。
    dispatch({ type: 'SET_RESULT', result: { _ecResult: true, _emptyCanvas: true } });
    showToast('已新建空白画布，双击画布或从左侧添加素材开始创作');
    setCanvasLibraryOpen(false);
  }, [dispatch, showToast]);

  /* 打开画布库里已有的画布：先保存当前画布，再载入目标会话快照 */
  const openCanvasFromLibrary = useCallback(async item => {
    if (!item?.id) return;
    if (nodes.length > 0 && handleCanvasSessionSaveRef.current) {
      try { await handleCanvasSessionSaveRef.current(); } catch { /* 保存失败不阻塞打开 */ }
    }
    try {
      const session = await loadCanvasSession(item.id);
      const snapshot = restoreCanvasSnapshot(session?.snapshot || {});
      setNodes((snapshot.nodes || []).map(normalizeCanvasNode));
      setConnections((snapshot.connections || []).map(normalizeCanvasConnection));
      if (snapshot.viewport) setViewport(snapshot.viewport);
      pendingProjectAssetImportsRef.current = normalizePendingProjectAssetImports(snapshot.pendingProjectAssetImports);
      setPendingProjectAssetImports(pendingProjectAssetImportsRef.current);
      canvasSessionRef.current = { id: session.id, revision: session.revision };
      setCanvasSession({ id: session.id, revision: session.revision });
      openedFromLibraryRef.current = true;
      setSelected(null);
      setMultiSelected(new Set());
      setCanvasLibraryOpen(false);
      showToast(`已打开画布「${item.title || '未命名画布'}」`, 'success');
    } catch (error) {
      showToast(error?.message || '打开画布失败，请稍后重试', 'error');
    }
  }, [loadCanvasSession, normalizeCanvasConnection, showToast]);

  const createComposerPlacement = useCallback((width, height, placement = {}) => {
    const source = placement.sourceNodeId ? nodes.find(node => node.id === placement.sourceNodeId) : undefined;
    const bounds = containerRef.current?.getBoundingClientRect();
    const scale = Math.max(0.05, Number(viewport.scale) || 1);
    /* 9-16 用户批注（图14）：「视频生成点击后还是出现在画布最左上方，没有统一处理」。
       根因：四个框共用同一个候选算法，但「视口中心」候选被已有节点占住时，
       算法会退回**视口左上角的第一个空位** —— 于是中心被占的框（文案/视频）飞到左上角，
       中心空着的框（图片/套图）才留在中间，四个框表现分裂。
       修法：优先围绕**上一次成功落点**（首个框 = 视口内容中心）继续找空位，
       保证打开后一定落在画布可视区中间/当前视口中心附近，且不与已有节点重叠。 */
    const viewportCenter = {
      x: -(Number(viewport.x) || 0) / scale + ((Number(bounds?.width) || 960) / scale - width) / 2,
      y: -(Number(viewport.y) || 0) / scale + ((Number(bounds?.height) || 640) / scale - height) / 2,
    };
    const anchor = preferredComposerAnchorRef.current || viewportCenter;
    const preferred = Number.isFinite(placement.x) && Number.isFinite(placement.y)
      ? { x: placement.x, y: placement.y }
      : anchor;
    const position = findCanvasBlankPlacement({
      width,
      height,
      viewport,
      bounds,
      nodes,
      sourceNode: source,
      preferred,
      gap: 16,
    });
    /* 显式落点（派生/右侧菜单给了 world 坐标）不改变锚点；
       其余情况记下这次落点，下一个框从它旁边继续展开。 */
    if (position && !(Number.isFinite(placement.x) && Number.isFinite(placement.y))) {
      preferredComposerAnchorRef.current = position;
    }
    return position;
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
    /* 9-13 用户批注：从左侧「+」菜单新建的生成框，点完必须**直接把生成面板打开**
       （原来无源素材时不选中 → 面板不出现，用户点「生成图片」后只看到一个空框，以为坏了）。 */
    setSelected(composer.id);
    setMultiSelected(new Set([composer.id]));
    setActiveTool('select');
    return composer;
  }, [createComposerPlacement, nodes, result.platform]);

  /* 2026-09-28 批 CX（CV-1）：「按技能开始」要用到 `addCanvasComposer`，而它定义在本文件**更靠后**的地方
     （`handleSkillLibraryPick` 在前面）—— 把引用挂到 ref 上（本 effect 在它之后求值），
     这样既避开 deps 求值期的 TDZ 白屏，也不会拿到过期闭包。 */
  useEffect(() => { addCanvasComposerRef.current = addCanvasComposer; }, [addCanvasComposer]);

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

  /* ── P7 方案入画布: 设计方案节点的三个动作 (生成/刷新都先报价后调用, 不变式①) ── */
  const directionNodeRequestParams = (node) => ({
    ...node.ecParams,
    prompt: node.prompt || node.ecParams?.description || '',
  });
  const applyDirectionResponse = (node, res) => {
    const directions = Array.isArray(res?.directions) ? res.directions : [];
    updateComposerNode(node.id, {
      status: 'ready',
      error: '',
      directions: directions.map(direction => ({
        ...direction,
        analysis: res.analysis || null,
        productName: node.productName || direction.productName || '',
      })),
    });
  };
  /* 同步的「正在处理」闸门（ref 而非 state）：
     React 的 setState 是异步的，连点 3 次时 3 个 handler 都会在
     status 变成 processing **之前**跑进来，state 判重形同虚设 ——
     实测连点 3 次 = 3 次报价 + 3 次 design-directions（3 倍扣费暴露）。
     ref 在同一 tick 内即写入，第二次点击直接 return。 */
  const directionBusyRef = useRef({});
  const handleDirectionGenerate = useCallback(async node => {
    if (!node || node.status === 'processing') return;
    if (directionBusyRef.current[node.id]) return;
    directionBusyRef.current[node.id] = true;
    updateComposerNode(node.id, { status: 'processing', error: '', progressLabel: '正在分析商品并设计方案' });
    try {
      /* 2026-09-17 修两件事：
         ① 原来用 quoteBillingAction，只拿 quoteId、没有 actionId，
            服务端 executeOnce 判「收费动作请求无效」→ 方案链 100% 失败（实测 400）。
            改走 quoteCanvasAction（= 报价 + 生成 actionId）。
         ② 幂等：actionId 必须是**稳定键**（同一节点 + 同一轮方案 = 同一个 actionId），
            否则连点 N 次会拿到 N 个不同 UUID，服务端去重失效 ——
            实测连点 3 次 = 3 次报价 + 3 次 design-directions（3 倍扣费暴露）。
            稳定键让服务端 executeOnce 命中已完成记录并 replay，第 2、3 次不再扣费。 */
      const { quoteId, actionId } = await quoteCanvasAction('ec_direction_analysis', `direction-analysis:${node.id}`);
      const res = await getDesignDirections({ ...directionNodeRequestParams(node), billingQuoteId: quoteId, billingActionId: actionId });
      applyDirectionResponse(node, res);
      showToast('设计方案已生成，可「应用到画布」继续', 'success');
    } catch (error) {
      updateComposerNode(node.id, { status: 'error', error: error?.message || '设计方案生成失败' });
      /* 9-12 修潜伏 bug：这个助手签名是 (error, dispatch, options)，原来只传了 error，
         一旦走到错误分支就会抛 dispatch is not a function（本地实跑被自动生成踩出来）。 */
      handleCanvasActionError?.(error, { type: 'canvas-direction-generate', nodeId: node.id });
    } finally {
      delete directionBusyRef.current[node.id];
    }
  }, [updateComposerNode, handleCanvasActionError]);
  const handleDirectionRefresh = useCallback(async node => {
    if (!node || node.status === 'processing') return;
    if (directionBusyRef.current[node.id]) return;
    directionBusyRef.current[node.id] = true;
    updateComposerNode(node.id, { status: 'processing', error: '', progressLabel: '正在换一套创意路线' });
    try {
      /* 同上：刷新方案同样必须带 actionId。
         「换一套」是**有意重复**的用户动作 → 每次都要新的 actionId，
         否则第二次刷新会被判为 replay、拿回旧方案。所以这里用时间戳。 */
      const { quoteId, actionId } = await quoteCanvasAction('ec_direction_refresh', `direction-refresh:${node.id}:${Date.now()}`);
      const res = await getDesignDirections({ ...directionNodeRequestParams(node), refresh: true, billingQuoteId: quoteId, billingActionId: actionId });
      applyDirectionResponse(node, res);
      showToast('已换一套设计方案', 'success');
    } catch (error) {
      updateComposerNode(node.id, { status: 'error', error: error?.message || '方案刷新失败' });
      handleCanvasActionError?.(error, { type: 'canvas-direction-refresh', nodeId: node.id });
    } finally {
      delete directionBusyRef.current[node.id];
    }
  }, [updateComposerNode, handleCanvasActionError]);

  /* 9-12 用户批注：带设计方案进画布后**自动生成方案**。
     注意声明位置必须在 handleDirectionGenerate 之后 —— 否则和 showToast 一样会踩 TDZ，
     进画布即崩（这个坑今天刚踩过一次，见 test/canvas-tdz-guard-0912.test.mjs）。 */
  useEffect(() => {
    const targetId = autoPlanNodeRef.current;
    if (!targetId) return;
    /* 本地验收通道 (?qa=...) 没有登录态与积分，自动生成会走计费失败分支；
       这里跳过自动生成，让 QA 能安静地验证「发射后的画布布局」。线上不受影响。 */
    if (state.browserQa) { autoPlanNodeRef.current = ''; return; }
    const node = nodes.find(item => item.id === targetId);
    if (!node || node.kind !== 'design-direction') return;
    const alreadyHasPlan = Array.isArray(node.directions) && node.directions.length > 0;
    if (node.status === 'processing' || alreadyHasPlan) {
      autoPlanNodeRef.current = '';
      return;
    }
    autoPlanNodeRef.current = '';
    void handleDirectionGenerate(node);
  }, [handleDirectionGenerate, nodes]);

  const handleDirectionApply = useCallback(node => {
    if (!node || !Array.isArray(node.directions) || !node.directions.length) {
      showToast('先生成设计方案，再应用到画布', 'info');
      return;
    }
    const now = Date.now();
    const suite = createCanvasSuiteComposerNode({
      x: node.x + node.w + 48,
      y: node.y,
      platform: node.ecParams?.platform || 'taobao',
      commerceContext: node.ecParams?.commerceContext,
      now,
    });
    /* ═══ 2026-09-16 用户批注（图4-①）：「你确定现在所有的这些逻辑都是打通的情况吗？都是确确实实
       能够带入到设计方案里面，然后去激活生成逻辑的吗？」—— 审计结论：**没有打通**。
       根因就在上面那几行：新建的套图节点只拿到 platform + commerceContext，
       而 createCanvasSuiteComposerNode 的默认 configuration 里 productParams / skus / copywriting
       全是**空值**。于是用户在第 1 步填的商品信息、内容规范、SKU 变体、品牌色、清晰度，
       到了「应用到画布」这一步被**静默换成默认空值**，一路空到生成。
       修法：把第 1 步的整份配置原样带过来。方案回写（applyPlanToConfiguration）在后面执行，
       该由方案赢的地方仍然由方案赢，硬约束仍然独立生效。 */
    const launchParams = node.ecParams || {};
    suite.configuration = {
      ...suite.configuration,
      ...(launchParams.sizing ? { sizing: launchParams.sizing } : {}),
      ...(launchParams.genSettings
        ? { genSettings: { ...suite.configuration.genSettings, ...launchParams.genSettings } }
        : {}),
      ...(launchParams.productParams
        ? { productParams: { ...suite.configuration.productParams, ...launchParams.productParams } }
        : {}),
      ...(launchParams.copywriting
        ? { copywriting: { ...suite.configuration.copywriting, ...launchParams.copywriting } }
        : {}),
      ...(Array.isArray(launchParams.skus) && launchParams.skus.length ? { skus: launchParams.skus } : {}),
      ...(Array.isArray(launchParams.customColors) && launchParams.customColors.length
        ? { customColors: launchParams.customColors }
        : {}),
    };
    suite.directions = node.directions;
    suite.selectedDirection = 0;
    suite.prompt = node.prompt || '';
    suite.sourceNodeIds = node.sourceNodeIds;
    /* 2026-09-17 第 4 层（设计方案 = 确认后唯一事实源）：
       用户「应用到画布」即视为确认方案 —— 把方案参数（比例/张数/文案/风格/方向）
       **回写到套图节点的配置**，此后生成只依据方案。
       目的：不允许「配置 A + 方案 B」两个真相并存。
       注意：硬约束层（避免出现的元素 / 品牌色 / 清晰度 / 平台合规）**不参与回写**，
       由 applyPlanToConfiguration 内部挡掉，继续独立生效。 */
    const appliedPlan = {
      ...buildCanvasSuitePlan(node.directions[0], node.prompt || ''),
      confirmed: true,
      ratio: node.directions[0]?.ratio,
      count: node.count,
    };
    const nextConfiguration = applyPlanToConfiguration({
      configuration: suite.configuration || {},
      plan: appliedPlan,
    });
    if (nextConfiguration !== suite.configuration) suite.configuration = nextConfiguration;
    setNodes(previous => previous.map(item => (item.id === node.id ? { ...item, status: 'ready' } : item)).concat(suite));
    setConnections(previous => previous.concat(createChildConnection(node.id, suite.id, 'design-plan')));
    setSelected(suite.id);
    setMultiSelected(new Set([suite.id]));
    showToast('方案已应用到画布 · 在「电商套图」节点里编辑方案与素材，然后生成', 'success');
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
      const composerDuration = composerDurationFor(composer, videoProducts);
      const sku = videoSku(composerDuration, composer.modelProductId);
      const quote = (await quoteBillingAction({ sku, quantity: 1 })).quote;
      const urls = Object.fromEntries(uploaded.map(item => [item.asset.id, item.asset.url]));
      const response = await createVideoJob({
        productId: composer.modelProductId || 'seedance_standard',
        mode: resolveVideoApiMode(mode, files),
        prompt: String(composer.prompt).trim(),
        negativePrompt: '',
        duration: composerDuration,
        aspectRatio: composer.aspectRatio || '9:16',
        resolution: composer.resolution || '720p',
        generateAudio: composer.generateAudio !== false,
        seed: 0,
        billingQuoteId: quote.quoteId,
        /* ═══ 方案进生成（2026-09-18 总统筹拍板）═══════════════════════════════════
           改动前：videoPlan 只存在 composer 上、用 planReviewed 拦生成，
           但**请求体里根本没有 videoPlan** —— 用户花 1 积分买的方案对成片零影响。
           现在把结构化方案 + 确认标记一起发上去；编译在**服务端**做（权威），
           客户端只负责传，绕过客户端也无效。 */
        videoPlan: composer.videoPlan || null,
        planConfirmed: composer.planReviewed === true,
        references: {
          firstImage: firstImage?.id || '',
          lastImage: lastImage?.id || '',
          images: mode === 'frame' ? [] : imageAssets.map(asset => asset.id),
          videos: mode === 'frame' ? [] : videoAssets.map(asset => asset.id),
          audios: audioAssets.map(asset => asset.id),
          urls,
        },
      }, 
      /* 2026-09-17 第六批：幂等键原来每次点击新随机 UUID →
         服务端 videoGeneration.createJob 按 (owner_email, idempotency_key) 查重**永不命中**。
         实测（真实接口、无打桩）：连点 3 次 = 2 个真实视频任务、92,000 积分被真实占用；
         同键连点 3 次 = 1 个任务、replay:true、额外扣费 0。
         稳定键按「同一节点 + 同一提示词 + 同一规格 + 同一素材」计算：
         素材或提示词改了 = 另一次生成，键随之改变（这是用户有意重复，应该计费）。 */
      stableCanvasActionId([
        'video-job',
        composer.id,
        composer.modelProductId || 'seedance_standard',
        resolveVideoApiMode(mode, files),
        String(composer.prompt).trim(),
        composerDuration,
        composer.aspectRatio || '9:16',
        composer.resolution || '720p',
        composer.generateAudio !== false ? 'audio' : 'silent',
        uploaded.map(item => item.asset.id).join(','),
        /* 方案也算进幂等键：换了方案 = 另一次生成（用户有意重复，应计费） */
        JSON.stringify(composer.videoPlan?.beats || []),
      ].join('\u0000')));
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
        /* P-B 电影分镜命名: 视频走 Breakthrough */
        name: canvasShotNamerRef.current.next('video'),
        displayLabel: canvasShotNamerRef.current.next('video'),
        progress: 100,
        progressLabel: '成片已交付',
      });
      /* 9-15 用户决定：视频结果即落在框内，左右必须有加号（canvasGenerationBoxHasResult）；
         生成完成默认选中该结果 */
      setSelected(composer.id);
      setMultiSelected(new Set([composer.id]));
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
      /* 2026-09-17 第六批（收费链路真实端到端验收）：
         原来 actionId 用 globalThis.crypto.randomUUID() —— 每点一次一个新 UUID，
         服务端 oneShotBilling 按 actionId 去重**彻底失效**。
         实测（真实接口、无打桩）：连点 3 次 = 4000 积分（4× 方案分析费）。
         改成**稳定键**：同一节点 + 同一份素材/提示词/规格 = 同一个 actionId，
         第 2、3 次点击服务端命中已完成记录直接 replay，不再扣费。
         素材或提示词变了就是「另一次分析」，键随之改变（用户有意重复 → 应重新计费）。 */
      const analysisActionKey = stableCanvasActionId([
        'video-plan',
        composer.id,
        mode,
        String(composer.prompt || '').trim(),
        composerDurationFor(composer, videoProducts),
        composer.aspectRatio || '9:16',
        composer.resolution || '720p',
        composer.modelProductId || 'seedance_standard',
        imageIds.join(','),
        uploaded.map(item => item.asset.id).join(','),
      ].join('\u0000'));
      const response = await analyzeVideoPlan({
        billingQuoteId: analysisQuote.quoteId,
        billingActionId: analysisActionKey,
        productId: composer.modelProductId || 'seedance_standard',
        mode,
        prompt: String(composer.prompt).trim(),
        negativePrompt: '',
        duration: composerDurationFor(composer, videoProducts),
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
    /* P2 连线@引用合一: 执行输入只读图边（入边顺序 = @图片N）; 无入边回退旧并集（P0 无图契约逐字节一致）*/
    const runInputs = collectRunInputs(composer.id, connections, nodes);
    const composerSourceIds = runInputs.sources.length ? runInputs.sources : legacyComposerSourceIds(composer);
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
      /* 9-15 用户决定：多张结果自动排版 —— 生成框本身是第一张，其余结果横向一排
         （同一 y，间距 = 节点宽 + 24px，超过 4 张换行），复用套图「右侧锚定 + 派生连线」约定。 */
      const outputs = layoutCanvasGeneratedResults({
        anchor: composer,
        mode: 'row',
        items: urls.slice(1).map((url, index) => normalizeCanvasNode({
          id: `image_generated_${createdAt}_${index + 1}`,
          assetId: `asset_generated_${createdAt}_${index + 1}`,
          kind: 'image',
          status: 'ready',
          url,
          /* P-B 电影分镜命名: Enclosure-001 替代 '图片生成结果 1' */
          name: canvasShotNamerRef.current.next('image'),
          displayLabel: canvasShotNamerRef.current.next('image'),
          group: '素材',
          role: '创作图片',
          imageModel: composer.imageModel || sourceNodes[0]?.imageModel || 'image2',
          resolution: composer.resolution || '2K',
          ratio,
          sourceNodeIds: [composer.id],
          w: 230,
          h: Math.round(230 / ratioNumber),
          showMeta: true,
        })),
      });
      const resultNodeIds = [composer.id, ...outputs.map(output => output.id)];
      setNodes(previous => previous.map(node => node.id === composer.id ? {
        ...node,
        status: 'success',
        url: urls[0],
        /* P-B 电影分镜命名: composer 主图走 Enclosure */
        name: canvasShotNamerRef.current.next('image'),
        displayLabel: canvasShotNamerRef.current.next('image'),
        ratio,
        h: Math.round(node.w / ratioNumber),
        outputNodeIds: resultNodeIds,
      } : node).concat(outputs));
      setConnections(previous => outputs.reduce((edges, output) => addConnection(edges, composer.id, output.id, 'generated'), previous));
      /* 9-15 用户决定：生成完成后默认多选全部结果（含生成框这张主图），多选工具条随即出现 */
      setSelected(composer.id);
      setMultiSelected(new Set(resultNodeIds));
      showToast(`已生成 ${urls.length} 张图片`, 'success');
    } catch (error) {
      updateComposerNode(composer.id, { status: 'error', error: error.message || '图片生成失败' });
      handleCanvasActionError(error, { type: 'image-generation', nodeId: composer.id });
    }
  }, [connections, handleCanvasActionError, nodes, result.category, showToast, updateComposerNode]);

  const handleSuiteComposerGenerate = useCallback(async composer => {
    if (!composer || composer.status === 'processing') return;
    /* P2 连线@引用合一: 执行输入只读图边（入边顺序 = @图片N）; 无入边回退旧并集（P0 无图契约逐字节一致）*/
    const runInputs = collectRunInputs(composer.id, connections, nodes);
    const composerSourceIds = runInputs.sources.length ? runInputs.sources : legacyComposerSourceIds(composer);
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
    /* 2026-09-17 产品决定：**方案未确认时什么都不发生**（不生成、不扣费、不替他决定）。
       这里是与 UI 无关的第二道闸门 —— 按钮 disabled 只是表现层，
       任何其它入口（快捷键/程序化调用/将来新增的按钮）走到这里都必须被挡住。
       此时既不发起请求、也不改节点状态，只给一句短提示。 */
    if (composer.suiteStep === 'directions' && composer.planConfirmed !== true) {
      showToast('请先确认方案', 'info');
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
    /* 2026-09-17 三层权威性排序（唯一规则见 canvasPromptAuthority.js）：
       硬约束(配置面板) > 产出结构(套图方案+SKU) > 内容意图(提示词+skill+补充) > 设计方案。
       生成前先算一次：结构越权 / 硬约束冲突都要**显式告知用户**（绝不静默改变他的意图），
       同时把「其它补充 + 变体说明」编译成补充说明段送进提示词。 */
    const authority = resolvePromptAuthority({
      prompt: composer.prompt || '',
      skill: configuration.styleSkill || composer.styleSkill || '',
      configuration,
      plan: composer.suitePlan,
    });
    authority.notices.forEach(notice => showToast(notice, 'info'));
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
    const receivedNodeIds = [];
    const roleRows = { 白底图: 0, 主图: 1, 详情图: 2, SKU: 3, 素材: 4 };
    /* ═══ 用户在第 1 步填的**结构化事实**：审计确认此前只到「设计方案」就断了 ═══
       服务端真正读进提示词的字段是 **direction.editableBrief**
       （orchestrator.campaignOverrides → campaignBible → promptCompiler「brief」），
       而 body.selling_points / product_name 在 direction 是对象时**根本不生效**。
       所以这里把用户填的每一项都并进 editableBrief —— 这是唯一真正到得了模型的通道。
       变体说明**逐条绑定到变体**（不是只取第一个，也不是糊成一段）。 */
    const userBriefLines = (() => {
      const pp = configuration.productParams || {};
      const cw = configuration.copywriting || {};
      const skuLines = (Array.isArray(configuration.skus) ? configuration.skus : [])
        .map((sku, index) => {
          const label = [sku?.color, sku?.size, sku?.capacity, sku?.dimLabel]
            .map(value => String(value || '').trim()).filter(Boolean).join(' / ') || ('变体' + (index + 1));
          const note = String(sku?.note || '').trim();
          return note ? '变体「' + label + '」的差异说明：' + note : '';
        })
        .filter(Boolean);
      const negative = String(configuration.genSettings?.negativePrompt || '').trim();
      return [
        pp.category && '品类：' + pp.category,
        pp.size && '产品尺寸：' + pp.size,
        pp.material && '商品材质：' + pp.material,
        pp.baseColor && '底色/主色：' + pp.baseColor,
        pp.accentColor && '点缀色：' + pp.accentColor,
        pp.craft && '工艺说明：' + pp.craft,
        cw.sellingPoints && '核心卖点：' + cw.sellingPoints,
        cw.qc && '质检报告：' + cw.qc,
        cw.details && '细节特写：' + cw.details,
        cw.maintenance && '保养维护：' + cw.maintenance,
        ...skuLines,
        negative && '禁止出现（用户明确排除）：' + negative,
      ].filter(Boolean);
    })();
    /* 把用户事实并进 direction.editableBrief（保留方案原有的执行说明，不覆盖它）。 */
    const directionPayload = (() => {
      const base = applyCanvasSuitePlanToDirection(suitePlan, directionSource);
      if (!userBriefLines.length) return base;
      const block = '用户填写的商品与内容事实（与画面风格冲突时以此为准）：\n' + userBriefLines.join('\n');
      const existing = [base.editableBrief, base.executionGuide, base.execution_guide, base.brief, base.description]
        .find(value => typeof value === 'string' && value.trim()) || '';
      return { ...base, editableBrief: existing ? existing + '\n\n' + block : block };
    })();
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
          /* 第 3 层补充信息（其它补充 + 各变体说明）接进 prompt 编译。
             见 canvasPromptAuthority：它们与硬约束冲突时以硬约束为准，并给用户显式提示。 */
          authority.supplement.text,
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
        /* 2026-09-17：SKU 变体与套图方案同维度 —— 必须一起进生成，结果才会进 SKU 排。
           服务端 assetPlanner 会按 normalizeSkus 为每个变体产出一张 role:'sku' 的图，
           交付时带 group:'SKU'（deliveryMetadata.ecommerceGroupForRole），
           画布 onImage 再按 group 落到 roleRows.SKU = 第 3 排。 */
        skus: Array.isArray(configuration.skus) ? configuration.skus : [],
        direction: directionPayload,
        /* 品类与品牌色有**现成的服务端字段**，走结构化通道（不塞进散文）：
           category → campaignOverrides.category → campaignBible
           customColors → body.custom_colors → paletteLock（品牌色锁定真正生效的地方） */
        category: String(configuration.productParams?.category || '').trim(),
        customColors: Array.isArray(configuration.customColors) ? configuration.customColors : [],
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
          receivedNodeIds.push(output.id);
          updateComposerNode(composer.id, { generatedCount: receivedUrls.size });
        },
      });
      updateComposerNode(composer.id, { status: 'success', progress: 100, progressLabel: `已完成 ${receivedUrls.size} 张` });
      /* 9-15 用户决定：套图结果生成完成后默认多选全部结果节点（套图框是控制台，不参与多选） */
      if (receivedNodeIds.length) {
        setSelected(receivedNodeIds[0]);
        setMultiSelected(new Set(receivedNodeIds));
      }
      showToast(`电商套图已完成 ${receivedUrls.size} 张`, 'success');
    } catch (error) {
      updateComposerNode(composer.id, { status: 'error', error: error.message || '套图生成失败' });
      handleCanvasActionError(error, { type: 'ecommerce-suite', nodeId: composer.id });
    } finally {
      suiteGenerationInFlightRef.current.delete(composer.id);
    }
  }, [connections, getDesignDirections, handleCanvasActionError, nodes, phone, result.category, result.platform, result.product_name, showToast, updateComposerNode]);

  const handleSuiteDirectionSelect = useCallback((composerId, direction, index) => {
    updateComposerNode(composerId, { selectedDirection: index, selectedDirectionData: direction });
  }, [updateComposerNode]);

  const handleTextGenerationGenerate = useCallback(async composer => {
    const boardText = String(composer?.text || '').trim();
    const promptText = String(composer?.prompt || '').trim();
    if ((!boardText && !promptText) || composer.status === 'processing') return;
    updateComposerNode(composer.id, { status: 'processing', error: '' });
    try {
      /* P2 连线@引用合一: 执行输入只读图边（入边顺序 = @图片N）; 无入边回退旧并集（P0 无图契约逐字节一致）*/
      const runInputs = collectRunInputs(composer.id, connections, nodes);
      const composerSourceIds = runInputs.sources.length ? runInputs.sources : legacyComposerSourceIds(composer);
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
      /* 9-15 用户决定：文案结果纵向一列（文案是长条，竖排更可读），
         复用套图「右侧锚定 + 派生连线」约定；结果节点左右都有加号。 */
      const outputs = layoutCanvasGeneratedResults({
        anchor: composer,
        mode: 'column',
        items: urls.map((url, index) => normalizeCanvasNode({
          id: `text_generation_output_${createdAt}_${index + 1}`,
          assetId: `text_generation_asset_${createdAt}_${index + 1}`,
          kind: 'image',
          status: 'ready',
          url,
          /* P-B 电影分镜命名: 文本驱动画面走 Enclosure */
          name: canvasShotNamerRef.current.next('image'),
          displayLabel: canvasShotNamerRef.current.next('image'),
          group: '素材',
          role: '创作图片',
          imageModel: composer.imageModel || sourceNodes[0]?.imageModel || 'image2',
          resolution: composer.resolution || '2K',
          ratio,
          sourceNodeIds: [composer.id],
          w: 230,
          h: Math.round(230 / ratioNumber),
          showMeta: true,
        })),
      });
      const resultNodeIds = outputs.map(output => output.id);
      setNodes(previous => previous.map(node => node.id === composer.id ? {
        ...node,
        status: 'success',
        generatedCount: outputs.length,
        outputNodeIds: resultNodeIds,
        progress: 100,
      } : node).concat(outputs));
      setConnections(previous => outputs.reduce((edges, output) => addConnection(edges, composer.id, output.id, 'generated'), previous));
      /* 9-15 用户决定：文案生成完成后默认多选全部结果 */
      setSelected(outputs[0]?.id || composer.id);
      setMultiSelected(new Set(resultNodeIds));
      showToast(`已生成 ${outputs.length} 张画面`, 'success');
    } catch (error) {
      updateComposerNode(composer.id, { status: 'error', error: error.message || '画面生成失败' });
      handleCanvasActionError(error, { type: 'image-generation-from-text', nodeId: composer.id });
    }
  }, [connections, handleCanvasActionError, nodes, result.category, showToast, updateComposerNode]);

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

  /* P0-1 派生即执行 (master-plan §4, 9-06): "生成文案"点完即自动发起请求。
     旧流程: 建空 composer 让用户手填 prompt 手动点生成 (G1 缺口)。
     新流程: 上传图 → 点+ → 生成文案 → 文本节点立即以 running 态落位 (呼吸动画),
     自动带源图 referenceImages 调 /api/canvas/regenerate-text, 产出直接写入节点。
     无需手动点; 失败时节点保留 error 态, toast 提示原因。 */
  const handleDerivedTextGeneration = useCallback(async (sourceNodeId, world = {}) => {
    const source = nodes.find(node => node.id === sourceNodeId);
    if (!source) { showToast('素材已被删除，无法继续派生', 'info'); return; }
    if (['processing', 'uploading', 'analyzing'].includes(source.status)) {
      showToast('素材还在处理中，完成后即可派生', 'info');
      return;
    }
    const request = buildCanvasCopywritingRequest({ source });
    const bounds = containerRef.current?.getBoundingClientRect();
    const position = findCanvasBlankPlacement({
      width: 420,
      height: 84,
      viewport,
      bounds,
      nodes,
      sourceNode: source,
      preferred: Number.isFinite(world?.x) && Number.isFinite(world?.y) ? { x: world.x, y: world.y } : undefined,
      gap: 16,
    }) || { x: source.x + source.w + 28, y: source.y };
    const textNode = {
      ...createCanvasTextNode({ ...position, sourceNodeId: source.id }),
      status: 'running',
      progressLabel: '正在提炼卖点文案',
      text: '正在提炼卖点文案…',
      actionId: 'text-generation',
    };
    setNodes(previous => [...previous, textNode]);
    setConnections(previous => addConnection(previous, source.id, textNode.id, 'derived'));
    setSelected(textNode.id);
    setMultiSelected(new Set([textNode.id]));
    setActiveTool('select');
    showToast('文案生成中，完成后自动写入节点', 'info');
    try {
      const data = await regenerateCanvasText({
        prompt: request.prompt,
        referenceImages: request.referenceImages,
        references: request.references,
        count: 1,
      });
      const text = normalizeCanvasCopywritingResult(data);
      setNodes(previous => previous.map(node => node.id === textNode.id ? {
        ...node,
        text,
        status: 'ready',
        error: null,
        progressLabel: '',
      } : node));
      showToast('卖点文案已生成，可继续派生图片或视频', 'success');
    } catch (error) {
      setNodes(previous => previous.map(node => node.id === textNode.id ? {
        ...node,
        text: '',
        status: 'error',
        error: error?.message || '文案生成失败',
        progressLabel: '',
      } : node));
      if (error?.name !== 'AbortError') handleCanvasActionError(error, { type: 'text-generation', nodeId: textNode.id });
    }
  }, [handleCanvasActionError, nodes, showToast, viewport]);

  /* P0-3 TTS 配音执行链 (master-plan §4, 9-06): 视频节点派生 TTS 不再落空壳 application 节点,
     点完即创建 audio 节点并自动调 /api/tts/synthesize (ttsBridge: 5 provider 轮换 + 服务端计费),
     合成出的音频 URL 直接写入节点, <audio> 原生可播放。
     口播文本优先取上游 ready 文案 (图→文案→视频→TTS 链的正源), 回退视频 prompt。 */
  const handleDerivedTtsGeneration = useCallback(async (sourceNodeId, world = {}) => {
    const source = nodes.find(node => node.id === sourceNodeId);
    if (!source) { showToast('素材已被删除，无法继续派生', 'info'); return; }
    if (['processing', 'uploading', 'analyzing'].includes(source.status)) {
      showToast('视频还在处理中，完成后即可派生', 'info');
      return;
    }
    const upstream = findUpstreamCanvasCopy({ nodes, connections, nodeId: source.id });
    const request = buildCanvasTtsRequest({ source, upstream });
    const bounds = containerRef.current?.getBoundingClientRect();
    const position = findCanvasBlankPlacement({
      width: 264,
      height: 72,
      viewport,
      bounds,
      nodes,
      sourceNode: source,
      preferred: Number.isFinite(world?.x) && Number.isFinite(world?.y) ? { x: world.x, y: world.y } : undefined,
      gap: 16,
    }) || { x: source.x + source.w + 28, y: source.y };
    const audioNodeId = `audio_tts_${Date.now()}`;
    const audioNode = {
      id: audioNodeId,
      kind: 'audio',
      provenance: 'derived',
      status: 'running',
      progressLabel: '正在合成配音',
      url: '',
      name: 'TTS 配音',
      displayLabel: 'TTS 配音',
      group: source.group || '音频',
      role: '配音',
      ...position,
      w: 264,
      h: 72,
      sourceNodeIds: [source.id],
      editable: true,
      showMeta: true,
      actionId: 'application-tts',
      mediaPlaybackStatus: 'unavailable',
      mediaPlaybackError: '正在合成配音…',
    };
    setNodes(previous => [...previous, audioNode]);
    setConnections(previous => addConnection(previous, source.id, audioNodeId, 'derived'));
    setSelected(audioNodeId);
    setMultiSelected(new Set([audioNodeId]));
    setActiveTool('select');
    showToast(upstream ? '正在用上游文案合成配音' : '正在合成配音', 'info');
    try {
      const tts = await synthesizeCanvasTts({ text: request.text });
      const settled = normalizeCanvasAudioNodeFromTts({
        tts,
        sourceNode: source,
        position,
        nodeId: audioNodeId,
      });
      setNodes(previous => previous.map(node => node.id === audioNodeId ? {
        ...node,
        ...settled,
        mediaPlaybackStatus: null,
        mediaPlaybackError: '',
        progressLabel: '',
      } : node));
      showToast('配音已生成，点击音频节点即可试听', 'success');
    } catch (error) {
      setNodes(previous => previous.map(node => node.id === audioNodeId ? {
        ...node,
        status: 'error',
        error: error?.message || '配音合成失败',
        progressLabel: '',
        mediaPlaybackError: error?.message || '配音合成失败',
      } : node));
      if (error?.name !== 'AbortError') handleCanvasActionError(error, { type: 'application-tts', nodeId: audioNodeId });
    }
  }, [connections, handleCanvasActionError, nodes, showToast, viewport]);

  /* P0-4 字幕动效执行链 (master-plan §4, 9-06): 视频节点派生字幕不再落空壳 application 节点,
     点完即创建 subtitle 节点并自动调 /api/canvas/caption (chainService generateCaption),
     生成按 sceneCount 等分的字幕分段配置, 直接写入节点可展示。
     文本优先取上游 ready 文案(口播稿正源), 回退视频 prompt。 */
  const handleDerivedCaptionGeneration = useCallback(async (sourceNodeId, world = {}) => {
    const source = nodes.find(node => node.id === sourceNodeId);
    if (!source) { showToast('素材已被删除，无法继续派生', 'info'); return; }
    if (['processing', 'uploading', 'analyzing'].includes(source.status)) {
      showToast('视频还在处理中，完成后即可派生', 'info');
      return;
    }
    const upstream = findUpstreamCanvasCopy({ nodes, connections, nodeId: source.id });
    const request = buildCanvasCaptionRequest({ source, upstream });
    if (!request.text) {
      showToast('请先给视频配一段文案或描述，再生成字幕', 'info');
      return;
    }
    const bounds = containerRef.current?.getBoundingClientRect();
    const position = findCanvasBlankPlacement({
      width: 280,
      height: 120,
      viewport,
      bounds,
      nodes,
      sourceNode: source,
      preferred: Number.isFinite(world?.x) && Number.isFinite(world?.y) ? { x: world.x, y: world.y } : undefined,
      gap: 16,
    }) || { x: source.x + source.w + 28, y: source.y + (source.h || 240) + 16 };
    const subtitleNodeId = `subtitle_${Date.now()}`;
    const baseNode = {
      id: subtitleNodeId,
      kind: 'subtitle',
      provenance: 'derived',
      status: 'running',
      progressLabel: '正在生成字幕动效',
      name: '字幕动效',
      displayLabel: '字幕动效',
      group: source.group || '应用节点',
      role: '字幕',
      ...position,
      w: 280,
      h: 80,
      sourceNodeIds: [source.id],
      editable: true,
      showMeta: true,
      actionId: 'application-caption',
    };
    setNodes(previous => [...previous, baseNode]);
    setConnections(previous => addConnection(previous, source.id, subtitleNodeId, 'derived'));
    setSelected(subtitleNodeId);
    setMultiSelected(new Set([subtitleNodeId]));
    setActiveTool('select');
    showToast('字幕生成中，完成后自动写入节点', 'info');
    try {
      const caption = await synthesizeCanvasCaption({
        text: request.text,
        sceneCount: request.scene_count,
        style: request.style,
        durationMs: request.duration_ms,
      });
      const settled = normalizeCanvasSubtitleNodes({
        caption,
        sourceNode: source,
        position,
        nodeId: subtitleNodeId,
      });
      setNodes(previous => previous.map(node => node.id === subtitleNodeId ? {
        ...node,
        ...settled,
        progressLabel: '',
      } : node));
      showToast(`字幕已生成 ${caption.subtitles.length} 段，点击节点可查看`, 'success');
    } catch (error) {
      setNodes(previous => previous.map(node => node.id === subtitleNodeId ? {
        ...node,
        status: 'error',
        error: error?.message || '字幕生成失败',
        progressLabel: '',
      } : node));
      if (error?.name !== 'AbortError') handleCanvasActionError(error, { type: 'application-caption', nodeId: subtitleNodeId });
    }
  }, [connections, handleCanvasActionError, nodes, showToast, viewport]);

  useEffect(() => {
    handleAddTextRef.current = handleAddTextNode;
  }, [handleAddTextNode]);

  const handleTextNodeChange = useCallback((nodeId, text) => {
    setNodes(previous => {
      const target = previous.find(node => node.id === nodeId);
      if (!target || target.text === text) return previous; // 文本没变，不标脏
      const updated = previous.map(node => node.id === nodeId ? { ...node, text } : node);
      // 文本 = 上游产物，改了 → 沿出边把下游标 stale（P0 引擎，不越过 running/failed）
      return markStaleDownstream({ nodes: updated, connections, changedNodeId: nodeId }).nodes;
    });
  }, [connections]);
  /* 文字框高度自适应 (用户 9-04 反馈: 打字超过两行框不跟着变大) */
  const handleTextNodeAutoHeight = useCallback((nodeId, height) => {
    setNodes(previous => previous.map(node => node.id === nodeId && Number.isFinite(height) ? { ...node, h: Math.max(84, Math.round(height)) } : node));
  }, []);
  const handleCanvasSourceUpload = async event => {
    const files = [...(event.target?.files || [])].filter(file => file.type.startsWith('image/')).slice(0, 8);
    event.target.value = '';
    if (!files.length) return;
    const uploadStartedAt = Date.now();
    /* 「替换」: 把新素材套到目标节点上（位置/尺寸/连线不变），不新建节点。 */
    if (mediaReplaceTargetRef.current) {
      const targetId = mediaReplaceTargetRef.current;
      mediaReplaceTargetRef.current = null;
      const replaceStartedAt = Date.now();
      try {
        const localAssets = await readCanvasImageFiles([files[0]], replaceStartedAt);
        const local = localAssets[0];
        if (!local?.url) { showToast('读取素材失败，请重试', 'error'); return; }
        setNodes(previous => previous.map(node => node.id === targetId ? (() => {
          /* 9-11 用户批注#2: 节点框随新素材动态适配 — 高度不变, 宽度按新素材宽高比重算 */
          const baseH = Math.max(96, Number(node.h) || 240);
          const fitW = local.width && local.height ? Math.min(720, Math.max(160, Math.round(baseH * local.width / local.height))) : (Number(node.w) || baseH);
          return {
            ...node,
            kind: 'image',
            url: local.url,
            /* 本地 data URI 预览保留到持久化图片真正解码完成 (onImageReady 清理), 防止空白闪屏 */
            localPreviewUrl: local.url,
            name: files[0].name,
            displayLabel: files[0].name,
            w: fitW,
            ratio: local.width && local.height ? `${local.width}:${local.height}` : node.ratio,
            size: local.width && local.height ? `${local.width}×${local.height}` : node.size,
            naturalWidth: local.width || node.naturalWidth,
            naturalHeight: local.height || node.naturalHeight,
            status: 'uploading',
            templatePlaceholder: false,
          };
        })() : node));
        setSelected(targetId);
        /* 9-11 用户批注①: 替换不做自动处理 — 原图/新图都留在画布草稿, 资产库只收「用户显式收藏」与「生成物自动归集」 */
        showToast('素材已替换', 'success');
        void persistCanvasUploadAssets(localAssets, { role: 'product' }).then(persisted => {
          const durable = persisted?.[0];
          if (!durable?.url) return;
          /* 9-17：替换同样要把服务端素材 ID 落回节点，否则替换后的素材无法加入资产库。 */
          if (durable.assetId) setNodes(previous => previous.map(node => node.id === targetId ? { ...node, assetId: durable.assetId } : node));
          /* 9-15 只切持久 url；localPreviewUrl 由 swapNodeToDurableUrl 在「持久图解码成功」后才清，
             替换后不再出现空白闪屏 / 1 秒后图片消失。 */
          swapNodeToDurableUrl(targetId, durable.url);
        }).catch(() => {
          /* 持久化失败: 本地预览继续可用 (localPreviewUrl), 仅标 ready 避免卡在处理中 */
          setNodes(previous => previous.map(node => node.id === targetId ? { ...node, status: 'ready' } : node));
        });
      } catch (error) {
        showToast(error?.message || '替换素材失败，请重试', 'error');
      }
      return;
    }
    setPromptLoading(true);
    try {
      const assets = await readCanvasImageFiles(files, uploadStartedAt);
      const bounds = containerRef.current?.getBoundingClientRect();
      const baseX = ((bounds?.width || 960) * 0.4 - viewport.x) / viewport.scale;
      const baseY = ((bounds?.height || 640) * 0.35 - viewport.y) / viewport.scale;
      /* 4c183cd4 续命 画布拖拽bug修复: 多次上传曾落在同一固定坐标, 完全重叠,
         上层节点盖住下层节点, 导致"上传第二个素材后拖不动" (下层节点无法被点选/拖动).
         改用 findCanvasBlankPlacement 在已有节点旁找空白位置错开排放. */
      const blank = findCanvasBlankPlacement({
        width: 200,
        height: 200,
        viewport,
        bounds: { width: bounds?.width || 1200, height: bounds?.height || 800 },
        nodes,
        preferred: { x: baseX, y: baseY },
        gap: 28,
      }) || { x: baseX, y: baseY };
      const uploadedNodes = createUploadedImageNodes({ assets, x: blank.x, y: blank.y, now: uploadStartedAt, namer: canvasShotNamerRef.current })
        .map(node => ({ ...node, status: 'uploading', localPreviewUrl: node.url }));
      const persistenceGeneration = canvasPersistenceGenerationRef.current;
      draftReadyRef.current = true;
      canvasSaveKeyRef.current ||= canvasDraftKey({ ...result, canvasImportId: `upload-${uploadStartedAt}` });
      setNodes(previous => [...previous, ...uploadedNodes]);
      setSelected(uploadedNodes[0]?.id || null);
      setMultiSelected(new Set(uploadedNodes.map(node => node.id)));
      /* 用户 9-05: 上传素材落画布 → 顶部工具栏 + 右侧派生菜单同时展开 */
      if (uploadedNodes[0]) openConnectionPickerForNode(uploadedNodes[0]);
      /* 9-11 用户批注①: 上传不自动进资产库 — 只做草稿持久化 (刷新不丢),
         资产库 = 生成物自动归集(作品) + 用户显式「收藏为素材」; 替换/上传不再「后台处理原图」。 */
      showToast(`已加入 ${uploadedNodes.length} 张图片`, 'success');
      void persistCanvasUploadAssets(assets, { role: 'product' }).then(persistedAssets => {
        if (canvasPersistenceGenerationRef.current !== persistenceGeneration) return;
        const persistedById = new Map(uploadedNodes.map((node, index) => [node.id, persistedAssets[index]]));
        const fallbackById = new Map(uploadedNodes.map(node => [node.id, node]));
        setNodes(previous => previous.map(node => {
          const persisted = persistedById.get(node.id);
          if (!persisted?.url) return node;
          /* 9-15 本地预览保留到「持久 url 解码成功」才清 (swapNodeToDurableUrl 预载)；
             持久 url 失败时保留本地预览不再空框 —— 修复上传 1 秒后图片消失。
             9-17：把**服务端素材 ID** 一起落在节点上（node.assetId 原来是画布自己的
             upload_… id，不是服务端认得的素材 ID）。少了这一步，「加入资产库」拿这个 id
             去 import-media 只会拿到 404「图片素材不存在或不属于当前账号」——
             用户看到的就是「点击加入资产库还是说不能加入资产库」。 */
          return { ...node, url: persisted.url, assetId: persisted.assetId || node.assetId, status: 'ready', uploadError: '' };
        }));
        uploadedNodes.forEach(node => {
          const persisted = persistedById.get(node.id);
          if (persisted?.url) swapNodeToDurableUrl(node.id, persisted.url, fallbackById.get(node.id));
        });
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
    /* 「替换」视频素材: 套到目标节点上（位置/连线不变）。 */
    if (mediaReplaceTargetRef.current) {
      const targetId = mediaReplaceTargetRef.current;
      mediaReplaceTargetRef.current = null;
      setPromptLoading(true);
      try {
        const asset = { ...(await uploadVideoAsset(files[0], 'video')), name: files[0].name };
        if (!asset?.url) { showToast('视频上传结果为空，请重试', 'error'); return; }
        setNodes(previous => previous.map(node => node.id === targetId ? {
          ...node,
          kind: 'video',
          url: asset.url,
          videoAssetId: asset.id || asset.videoAssetId || node.videoAssetId || '',
          name: files[0].name,
          displayLabel: files[0].name,
          aspectRatio: asset.aspectRatio || node.aspectRatio || '16:9',
          duration: Number(asset.duration) || node.duration || 0,
          resolution: asset.resolution || node.resolution || '',
          status: 'ready',
          mediaPlaybackStatus: undefined,
          mediaPlaybackError: '',
          templatePlaceholder: false,
        } : node));
        setSelected(targetId);
        showToast('已替换视频素材', 'success');
      } catch (error) {
        showToast(error?.message || '替换视频素材失败，请重试', 'error');
      } finally {
        setPromptLoading(false);
      }
      return;
    }
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
      const baseX = ((bounds?.width || 960) * 0.4 - viewport.x) / viewport.scale;
      const baseY = ((bounds?.height || 640) * 0.35 - viewport.y) / viewport.scale;
      /* 4c183cd4 续命 画布拖拽bug修复: 与图片上传一致, 用空白位置错开, 避免节点堆叠遮挡. */
      const blank = findCanvasBlankPlacement({
        width: 320,
        height: 240,
        viewport,
        bounds: { width: bounds?.width || 1200, height: bounds?.height || 800 },
        nodes,
        preferred: { x: baseX, y: baseY },
        gap: 28,
      }) || { x: baseX, y: baseY };
      const uploadedNodes = createUploadedVideoNodes({ assets: imported.assets, x: blank.x, y: blank.y, now: uploadStartedAt, namer: canvasShotNamerRef.current });
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
        ? `已加入 ${uploadedNodes.length} 个视频，但 ${failedCount} 个素材未处理完，可稍后重试`
        : `已加入 ${uploadedNodes.length} 个视频，可继续引用生成`, failedCount ? 'info' : 'success');
    } catch (error) {
      showToast(error.message || '视频上传失败，请重试', 'error');
    } finally {
      setPromptLoading(false);
    }
  };

  /* 4c183cd4 续命 画布总监督 2026-08-30 - 音频上传 (Quantv 5 种基础节点: audio) */
  const handleCanvasAudioUpload = async event => {
    const files = [...(event.target?.files || [])].filter(file => file.type.startsWith('audio/')).slice(0, 4);
    event.target.value = '';
    if (!files.length) return;
    const uploadStartedAt = Date.now();
    canvasSaveKeyRef.current ||= canvasDraftKey({ ...result, canvasImportId: `audio-upload-${uploadStartedAt}` });
    setPromptLoading(true);
    try {
      const assets = [];
      for (const file of files) assets.push({ ...(await uploadVideoAsset(file, 'audio')), name: file.name });
      const bounds = containerRef.current?.getBoundingClientRect();
      const worldX = ((bounds?.width || 960) * 0.4 - viewport.x) / viewport.scale;
      const worldY = ((bounds?.height || 640) * 0.35 - viewport.y) / viewport.scale;
      const width = 320;
      const gap = 42;
      const safeN = (v, fb) => Number.isFinite(Number(v)) ? Number(v) : fb;
      const audioNodes = assets.map((asset, index) => ({
        id: `audio_upload_${uploadStartedAt}_${index}`,
        kind: 'audio',
        provenance: 'source',
        status: 'ready',
        url: asset.url || asset.stableUrl,
        name: asset.name || `音频 ${index + 1}`,
        displayLabel: asset.name || `音频 ${index + 1}`,
        group: '音频',
        role: '配音',
        duration: Number(asset.duration) || 0,
        editable: true,
        showMeta: true,
        x: safeN(worldX, 200) + index * (width + gap),
        y: safeN(worldY, 200),
        w: width,
        h: 120,
        rotation: 0,
        locked: false,
        hidden: false,
      })).filter(node => node.url);
      draftReadyRef.current = true;
      setNodes(previous => [...previous, ...audioNodes]);
      if (audioNodes.length) {
        setSelected(audioNodes[0].id || null);
        setMultiSelected(new Set(audioNodes.map(n => n.id)));
      }
      showToast(audioNodes.length ? `已加入 ${audioNodes.length} 个音频` : '没有可用的音频', audioNodes.length ? 'success' : 'error');
    } catch (error) {
      showToast(error.message || '音频上传失败，请重试', 'error');
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
      /* 9-12 用户批注（二次）：只做「固定左侧一列」还不够 —— 必须**放在已有来源下面、且任何节点都不重叠**。
         统一走 resolveSourceStackPlacement：先按真实尺寸生成草稿节点，再做矩形避让排版（逐格向下找空位）。 */
      const existingSourceNodes = (composer.sourceNodeIds || [])
        .map(id => nodes.find(node => node.id === id))
        .filter(Boolean);
      const draftImageNodes = createUploadedImageNodes({
        assets: importedImages.assets,
        x: 0,
        y: 0,
        now: uploadStartedAt,
        namer: canvasShotNamerRef.current,
      }).map(node => ({ ...node, role }));
      const draftVideoNodes = createUploadedVideoNodes({
        assets: importedVideos.assets,
        x: 0,
        y: 0,
        now: uploadStartedAt,
        namer: canvasShotNamerRef.current,
      }).map(node => ({ ...node, role }));
      const draftAudioNodes = importedAudios.assets.map((asset, index) => attachCanvasProjectAssetRef({
        id: `audio_upload_${uploadStartedAt}_${index}`, assetId: asset.id, videoAssetId: asset.id, kind: 'audio', provenance: 'source', status: 'ready',
        url: asset.url || asset.stableUrl, name: asset.name || `参考音频 ${index + 1}`, displayLabel: asset.name || `参考音频 ${index + 1}`, group: '音频', role,
        x: 0, y: 0, w: 264, h: 72, sourceNodeIds: [], editable: true, showMeta: true,
      }, asset));
      const draftUploadedNodes = [...draftImageNodes, ...draftVideoNodes, ...draftAudioNodes];
      const placements = resolveSourceStackPlacement({
        anchor: composer,
        existingSourceNodes,
        existingNodes: nodes.filter(node => node.id !== composerId),
        entries: draftUploadedNodes.map(node => ({ w: node.w || 240, h: node.h || 240 })),
      });
      const uploadedNodes = draftUploadedNodes.map((node, index) => ({
        ...node,
        x: placements[index]?.x ?? node.x,
        y: placements[index]?.y ?? node.y,
      }));
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
      /* 9-12 用户批注：不要再对用户谈「处理」——素材要不要入库由用户自己点「加入资产库」决定。 */
      showToast(`已连接 ${uploadedNodes.length} 个素材`, 'success');
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
    /* P2 连线@引用合一: @ 选一个上游自动补一条 reference 边（同 from->to 去重, 已有线不重复拉）*/
    setConnections(previous => {
      const hasEdge = previous.some(edge => (edge.fromNodeId || edge.from) === sourceId && (edge.toNodeId || edge.to) === composerId);
      return hasEdge ? previous : addConnection(previous, sourceId, composerId, 'reference');
    });
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
  /* ═══ 批 CB：回到生成它的工作台（带上素材与配置，不自动生成）══════════════════════════════
     这条链路**只发一个 launch**，落地全在 MediaCreation 里（与首页「做同款」同一段代码）——
     免得"从作品回去"和"从案例回去"各写一套还原逻辑，两边迟早走岔。 */
  const remixWorkInWorkbench = work => {
    const launch = workRemixLaunchOf(work);
    if (!launch) return;
    dispatch({ type: 'SET_CREATION_LAUNCH', launch });
    dispatch({ type: 'NAVIGATE', page: 'image-creation' });
  };
  /* ═══ 2026-09-28 批 CY-⑨（CV-2 第 2 步）：**节点 → 子页面工作台**（docs/design/89 §5 第 2 步）════
     用户已拍板入口位置＝节点上（§7 第 3 条）。走的是与「做同款 / 回到生成它的工作台」**同一条**
     `creationLaunch` 通道：只发一个 launch，落地逻辑全在 MediaCreation 里（那里已有 work-remix 那一段，
     本批只是让它也认 `canvas-node-edit` 这个 kind）——不另写一套还原。
     ⚠️ 只带**这条技能真的声明的字段**（canvasNodeSeedValues 逐条核对），提示词由子页面按
        planPreviewTargetKey 决定写进哪个字段；**不自动生成**（钱只发生在按报价确认之后）。
     ⚠️ 解析不出子页面坐标（含视频技能）⇒ `onOpenWorkbench` 传 null ⇒ 那颗按钮根本不渲染，
        见 canvasWorkbenchBridge.js 顶部。 */
  const openNodeInWorkbench = useCallback(node => {
    const target = canvasWorkbenchTargetOf(node);
    if (!target) return;
    dispatch({
      type: 'SET_CREATION_LAUNCH',
      launch: {
        kind: 'canvas-node-edit',
        skillId: target.skillId,
        panelValues: canvasNodeSeedValues(node, target.skill),
        prompt: String(node?.prompt || ''),
        title: String(node?.skillLabel || target.skill.name || '画布节点'),
      },
    });
    dispatch({ type: 'NAVIGATE', page: 'image-creation' });
  }, [dispatch]);
  /* 当前选中的节点能不能"去完整工作台" —— **在这里算一次**，往下只传 null 或一个函数：
     子组件据此决定渲不渲染那颗按钮（单一真相，不让每个 composer 各判一次）。 */
  const selectedWorkbenchOpen = useMemo(
    () => (canvasWorkbenchTargetOf(selectedNode) ? () => openNodeInWorkbench(selectedNode) : null),
    [selectedNode, openNodeInWorkbench],
  );
  /* 9-15 用户批注：从左侧「+」把资产库素材放进画布时提示「素材已到期或待清理」——
     后端保留清扫会把用户自己的素材标记为 attention，界面却在导入前用本地快照直接拦截。
     修复：登录态下以服务端为准（reuse 校验）；若素材被保留策略标记为待清理，
     自动把它「长期保留」后再重试一次 —— 用户自己刚上传/刚加入的素材不会被误判为不可用。 */
  const ensureReusableProjectAsset = useCallback(async (asset) => {
    if (!state.logged || result.browserQa || !asset?.projectId || !asset?.projectAssetId) return asset;
    try {
      return await getProjectAsset(asset.projectId, asset.projectAssetId, 'reuse');
    } catch (error) {
      if (error?.code !== 'PROJECT_ASSET_NOT_REUSABLE') throw error;
      try {
        const pinned = await setProjectAssetRetention(asset.projectId, asset.projectAssetId, true);
        if (!pinned?.retentionPinned) throw error;
        return await getProjectAsset(asset.projectId, asset.projectAssetId, 'reuse');
      } catch {
        throw error;
      }
    }
  }, [result.browserQa, state.logged]);

  const handleImportProjectAsset = useCallback(async (asset) => {
    if (projectAssetImportBusyRef.current) return;
    /* 9-15 本地快照的 canReuseProjectAsset 仅用于未登录/浏览器 QA 兜底；
       登录态交给 ensureReusableProjectAsset 以服务端为准，避免把用户自己的素材误判为待清理。 */
    if ((!state.logged || result.browserQa) && !canReuseProjectAsset(asset)) {
      showToast('素材已到期或待清理，请先长期保留后再使用', 'info');
      return;
    }
    projectAssetImportBusyRef.current = true;
    setProjectAssetBatchBusy(true);
    try {
      let reusableAsset = asset;
      if (state.logged && !result.browserQa && asset?.projectId && asset?.projectAssetId) {
        try {
          reusableAsset = await ensureReusableProjectAsset(asset);
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
  }, [canvasWorkMediaFields, connections, dispatch, ensureCanvasMediaProject, ensureReusableProjectAsset, handleTabChange, nodes, phone, result, showToast, state.logged, viewport]);
  const handleImportProjectAssets = useCallback(async (assets = []) => {
    if (projectAssetImportBusyRef.current) return;
    /* 9-15 同单素材导入：本地快照的 canReuseProjectAsset 仅用于未登录/浏览器 QA 兜底；
       登录态逐项走 ensureReusableProjectAsset（服务端为准 + 用户素材自动长期保留）。 */
    const candidates = (!state.logged || result.browserQa)
      ? (Array.isArray(assets) ? assets : []).filter(asset => canReuseProjectAsset(asset))
      : (Array.isArray(assets) ? assets : []);
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
            reusableAsset = await ensureReusableProjectAsset(asset);
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
  }, [canvasWorkMediaFields, connections, dispatch, ensureCanvasMediaProject, ensureReusableProjectAsset, handleTabChange, nodes, phone, result, showToast, state.logged, viewport]);
  const handleToggleProjectAssetSelection = useCallback(asset => {
    setSelectedProjectAssetKeys(current => toggleProjectAssetSelection(current, asset));
  }, []);
  /* 9-12 资产库：额度刷新 + 删除素材 */
  useEffect(() => {
    if (tab !== 'assets' || !state.logged) return undefined;
    let cancelled = false;
    fetchAssetUsage()
      .then(usage => { if (!cancelled) setAssetUsage(usage); })
      .catch(() => { if (!cancelled) setAssetUsage(null); });
    return () => { cancelled = true; };
  }, [tab, state.logged, projectAssetLibrary.length]);

  /* 9-12 用户批注：资产库要能直接上传素材进来（上传 → 入库 → 刷新列表与额度）。
     复用画布已有的上传链路（readCanvasImageFiles → persistCanvasUploadAssets → importImageAssetToProject），不另造一套。 */
  const handleAssetLibraryUpload = useCallback(async event => {
    const picked = [...(event.target?.files || [])].filter(file => String(file.type || '').startsWith('image/'));
    const files = picked.slice(0, 8);
    event.target.value = '';
    if (!files.length) {
      showToast('请选择 JPEG、PNG 或 WebP 图片', 'error');
      return;
    }
    setProjectAssetUploadBusy(true);
    try {
      const localAssets = await readCanvasImageFiles(files, Date.now());
      const persisted = await persistCanvasUploadAssets(localAssets, { role: 'reference' });
      const context = await ensureCanvasMediaProject('资产库上传', 'ecommerce');
      if (!context?.projectId) throw new Error('暂时无法准备项目，请稍后重试');
      for (const asset of persisted) {
        await importImageAssetToProject(context.projectId, {
          imageAssetId: asset.assetId,
          role: 'reference',
          metadata: { displayName: asset.name || '资产库上传' },
        });
      }
      const library = await listProjectAssetLibrary({ mediaKind: projectAssetMediaFilter, query: projectAssetQuery, limit: 500 });
      setProjectAssetLibrary(normalizeProjectAssetLibrary(library, { currentProjectId: context.projectId }));
      showToast(`已上传 ${persisted.length} 个素材到资产库`, 'success');
    } catch (error) {
      showToast(error?.message || '上传失败，请重试', 'error');
    } finally {
      setProjectAssetUploadBusy(false);
    }
  }, [ensureCanvasMediaProject, projectAssetMediaFilter, projectAssetQuery, showToast]);

  const handleDeleteProjectAsset = useCallback(async asset => {
    if (!asset?.projectId || !asset?.projectAssetId) return;
    /* 9-14 用户批注：「垃圾桶是删除键没错，但你要弹窗询问是否删除啊，不能我误点你就直接删呀」
       —— 资产库管理弹窗的删除必须先确认；文案与「从资产库选择」弹窗保持一致（9-16 收短）。 */
    const confirmed = await dialog.confirm({
      title: '删除这个素材？',
      message: '删除后不可恢复。',
      confirmLabel: '删除',
    });
    if (!confirmed) return;
    const key = `${asset.projectId}:${asset.projectAssetId}`;
    setProjectAssetDeleteBusy(key);
    try {
      await deleteProjectAsset(asset.projectId, asset.projectAssetId);
      setProjectAssetLibrary(current => current.filter(item => projectAssetSelectionKey(item) !== projectAssetSelectionKey(asset)));
      showToast('已从资产库删除', 'success');
    } catch (error) {
      showToast(error?.message || '删除失败，请稍后重试', 'error');
    } finally {
      setProjectAssetDeleteBusy('');
    }
  }, [dialog, showToast]);

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
    if (!refs.length) return showToast('该作品暂无可加入资产库的项目素材', 'info');
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
      showToast(failed ? `已加入 ${added} 个素材，${failed} 个失败` : `已加入 ${added} 个素材到资产库`, 'success');
    } else {
      showToast(failed ? '素材加入资产库失败，请重试' : '作品素材已全部在资产库中', failed ? 'error' : 'info');
    }
  }, [showToast]);
  // P2 跨域投递入口 a：选中套图产物/节点 → 「发往视频项目」。
  const selectedNodeVideoDelivery = useMemo(() => deliverableRefsFromNodes(selectedNode ? [selectedNode] : []), [selectedNode]);
  const handleSendSelectedToVideoProject = useCallback(node => {
    const refs = deliverableRefsFromNodes(node ? [node] : []);
    if (!refs.length) return showToast('这个素材还不能发往视频项目', 'info');
    setVideoDelivery({ refs, surface: DELIVERY_SOURCE_SURFACES.ecCanvas });
  }, [showToast]);
  /* 4c183cd4 续命 画布深度重构 (用户 8-29 硬性反馈 1): 右面板"调整参数" patch.
     用户在右面板拖 opacity / volume / duration, 同步到 node.opacity / node.volume / node.duration.
     商业化视角: AI 积分消耗 (selectedNodeBillingCost) 也跟着 deriveActions 第一个 action 的 priceLabel 走. */
  const handleRightPanelPatch = useCallback(patch => {
    if (!selected || !patch || typeof patch !== 'object') return;
    setNodes(prev => prev.map(node => node.id === selected ? { ...node, ...patch } : node));
  }, [selected]);
  // 4c183cd4 续命 全站真浏览器测修复: 把 portCreationActions 声明提前到这里,
  // 否则 L4143 useMemo deps 引用 portCreationActions 时它还在 TDZ,
  // 触发 "Cannot access 'portCreationActions' before initialization".
  // 原来 4c183cd4 时代声明在 L4510 (本函数体末尾), 画布页打不开时这 bug 不暴露;
  // 主线程修好 /canvas deep link 后画布真渲染, TDZ 立刻爆, 必须前置.
  /* 4c183cd4 续命 画布深度重构 (用户 8-29 硬性反馈 1) 修复:
     CANVAS_CREATION_OPTIONS 每项已带 group ('core' 5 原有 / 'magic' 4 流影AI),
     但这里曾统一覆盖成 group: '继续创作' 使 CanvasDeriveMenu 按 group 分桶时
     core/magic 桶全空 → 右面板只剩标题"从当前素材继续创作 9 项"、动作按钮全部不渲染,
     用户看不到任何派生动作 (即"右面板怎么东西都不见了").
     去掉覆盖, 保留各动作自身 group, 9 项按 5 core + 4 magic 正确分桶渲染. */
  const portCreationActions = CANVAS_CREATION_OPTIONS
    .filter(option => !(option.videoOnly && selectedNode?.kind !== 'video'))
    .map(option => {
      const imageAction = option.id === 'image-edit' ? getCanvasAction('product-remix') : null;
      return {
        ...(imageAction || {}),
        ...option,
        priceLabel: option.priceLabel || imageAction?.priceLabel || '免费',
      };
    });
  const selectedNodeBillingCost = useMemo(() => {
    if (!selectedNode) return 0;
    /* 优先取 node 自身的 billing 字段, 否则按第一个可用 action 的 priceLabel 估算. */
    const directCost = Number(selectedNode.billingCost ?? selectedNode.cost ?? selectedNode.estimatedCost ?? 0);
    if (directCost > 0) return directCost;
    const firstPriced = portCreationActions.find(action => action.priceLabel && action.priceLabel !== '免费' && action.priceLabel !== '0');
    if (!firstPriced) return 0;
    /* priceLabel 形如 "1 积分" / "1.5 积分" / "0.2 积分" — 提取数字. */
    const match = String(firstPriced.priceLabel).match(/([\d.]+)/);
    return match ? Number(match[1]) : 0;
  }, [selectedNode, portCreationActions]);

  /* 右面板"派生结果"看板: 从当前选中素材派生出去的子节点 (用户 9-04 反馈:
     右面板应该展示"我派生了什么", 而不是把派生入口再重复一遍) */
  const selectedDerivedChildren = useMemo(() => {
    if (!selectedNode) return [];
    const childIds = connections
      .filter(conn => (conn.fromNodeId || conn.from) === selectedNode.id)
      .map(conn => conn.toNodeId || conn.to);
    return childIds
      .map(id => nodes.find(node => node.id === id))
      .filter(Boolean)
      .map(node => ({
        id: node.id,
        name: node.name || node.displayLabel || '未命名节点',
        kind: node.kind,
        status: node.status || (node.url ? 'ready' : 'draft'),
        thumb: node.url || node.assets?.find(asset => asset?.url)?.url || '',
      }));
  }, [connections, nodes, selectedNode]);
  /* 右面板"派生链累计消耗": 母节点 + 全部子节点的直录消耗求和
     (用户 9-05 反馈: 展示母节点和它派生链的整体积分消耗) */
  const chainCostTotal = useMemo(() => {
    if (!selectedNode) return 0;
    const direct = node => Number(node?.billingCost ?? node?.cost ?? node?.estimatedCost ?? 0);
    let total = direct(selectedNode);
    for (const child of selectedDerivedChildren) {
      total += direct(nodes.find(node => node.id === child.id));
    }
    return total;
  }, [selectedDerivedChildren, selectedNode, nodes]);
  /* 4c183cd4 续命 画布深度重构 (用户 8-29 硬性反馈 3): 下面 3 智能按钮差异化 handler
     mode: 'one-click-suite' (1-click 套图, 走 chainService 4 步: 文案->首帧->视频->音轨+字幕)
           'one-click-video' (1-click 视频模板, 同上 4 步 chain)
           'tts-voiceover'   (TTS 配音, 走 chainService 单步 audio, 跟上面 5 原有 完全不同)
     跟 addCanvasComposer (单步) 完全区分: 这里真调 chainService.executeChain. */
  const handleSmartChainAction = useCallback(async (mode) => {
    const titles = {
      'one-click-suite': '1-click 套图',
      'one-click-video': '1-click 视频模板',
      'tts-voiceover': 'TTS 配音',
    };
    const defaultTexts = {
      'one-click-suite': '把当前素材一键派生电商 5 宫格 (主图+场景+细节+白底+详情图)',
      'one-click-video': '把当前素材一键生成营销视频 (分镜脚本 + 首帧 + 成片 + 口播)',
      'tts-voiceover': '把当前文案/脚本一键合成专业口播配音 (5 provider 美式播客感)',
    };
    /* 找 source 节点 (优先 selectedNode, 否则第一张图) */
    const sourceNode = selectedNode || nodes.find(n => ['image', 'output', 'video', 'source_group'].includes(n.kind)) || null;
    const referenceImage = sourceNode?.url ? proxyImg(sourceNode.url) : null;
    const text = defaultTexts[mode] || titles[mode] || '薯包 1-click 创作';
    setChainRun({
      title: titles[mode],
      mode,
      steps: ['running', 'pending', 'pending', 'pending'],
      totalCost: 0,
      error: '',
      running: true,
      finishedAt: 0,
    });
    try {
      const payload = await executeChainService({
        text,
        referenceImage: referenceImage || null,
        audioSourceId: null,
        subtitleStyle: 'simple',
      });
      const normalized = normalizeChainResponse(payload);
      const finalSteps = normalized.stepStatuses.map((status, idx) => {
        if (status === 'ok') return 'ok';
        if (status === 'failed') return 'failed';
        return idx <= normalized.stepLabels.length - 1 ? 'ok' : 'pending';
      });
      setChainRun(prev => ({
        ...(prev || {}),
        steps: finalSteps,
        totalCost: normalized.totalCost || 0,
        ok: normalized.ok,
        failedStep: normalized.failedStep,
        error: normalized.ok ? '' : (normalized.failedStep ? `第 ${normalized.failedStep} 步失败` : '链式生成失败'),
        running: false,
        finishedAt: Date.now(),
      }));
      showToast(normalized.ok ? `${titles[mode]} 完成 (累计 ¥${(normalized.totalCost || 0).toFixed(4)})` : `${titles[mode]} 中途失败`, normalized.ok ? 'success' : 'error');
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      setChainRun(prev => ({
        ...(prev || {}),
        steps: ['failed', 'pending', 'pending', 'pending'],
        error: msg || '网络错误',
        running: false,
        finishedAt: Date.now(),
      }));
      showToast(`${titles[mode]} 失败: ${msg}`, 'error');
    }
  }, [selectedNode, nodes, showToast]);

  /* 空壳"应用节点"已下架 (用户 9-04 反馈): 派生一律走素材端口菜单 */
  const handleVideoDelivered = useCallback(({ projectId }) => {
    setVideoDelivery(null);
    showToast('已发往视频创作', 'success');
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
    /* 9-11 与 removeCanvasNode 同款回收: 删掉的节点若正锚定派生菜单/连线草稿/聚焦编辑器/
       文字检查器/水印预览, 立即一并关闭, 不允许任何浮层比被删节点活得久 (删除键路径即时生效)。 */
    setConnectionPicker(previous => (previous?.sourceNodeId && ids.has(previous.sourceNodeId)) ? null : previous);
    setConnectionDraft(previous => {
      const source = previous?.sourceNodeId || previous?.from;
      return (source && ids.has(source)) ? null : previous;
    });
    setFocusedEditor(previous => (previous?.nodeId && ids.has(previous.nodeId)) ? null : previous);
    setTextInspectorNodeId(previous => (previous && ids.has(previous)) ? null : previous);
    setWatermarkPreview(previous => (previous?.nodeId && ids.has(previous.nodeId)) ? null : previous);
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
    /* 9-17 用户批注（图10 第3点）：「新建一个新的画布并在其中做了生成或上传，离开时要询问是否保存
       （保存 = 在画布库新建一个画布保存起来）」。
       实测漏洞：这里一上来就要求 result.projectId + versionId，而**刚新建的画布本来就没有项目**
       （项目是上传/生成时才建的），于是用户在离开时点了「保存到画布库」，
       实际什么都没发生 —— 没有画布会话请求、没有落库，画布照样丢了。
       修法：缺项目就按画布既有口径**先建一个**（复用 ensureCanvasMediaProject，
       它自己做的就是 createProject + createProjectVersion + 回写 result），再存会话。 */
    let projectId = result.projectId;
    let baseVersionId = result.resultVersionId || result.sourceVersionId;
    if (!projectId || !baseVersionId) {
      const created = await ensureCanvasMediaProject('Canvas 画布', 'ecommerce');
      if (!created?.projectId || !created?.baseVersionId) {
        showToast('画布暂时无法保存，请稍后重试', 'error');
        return;
      }
      projectId = created.projectId;
      baseVersionId = created.baseVersionId;
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
  }, [canvasSession, canvasWorkMediaFields, connections, dispatch, ensureCanvasMediaProject, nodes, pendingProjectAssetImports, phone, result, showToast, viewport]);
  useEffect(() => { handleCanvasSessionSaveRef.current = handleCanvasSessionSave; }, [handleCanvasSessionSave]);

  /* ── 9-13 用户批注：离开画布时的保存流程 ──
     规则（用户口述）：
       ① 画布是「从画布库打开」的 → 离开时不再打扰，**直接静默保存**（它本来就已经在库里）；
       ② 画布是新建/临时工作的 → 离开时**询问是否保存到画布库**：
          选「保存」→ 保存会话（于是它会出现在画布库里）；
          选「不保存」→ 直接丢弃（不占用户资源，也不进画布库）。 */
  const leaveGuardBypassRef = useRef(false);
  /* 从画布库打开的画布 → 离开时静默保存, 不再询问(用户口述规则①) */
  const openedFromLibraryRef = useRef(false);
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    /* ═══ 触发判据（2026-09-18 用户批注重写）══════════════════════════════════
       用户原话：「我刚刚是点击画布上面的那个模板广场，你为什么就会提出来这个是否保存这张
       画布呢？应该是我离开这张画布的时候，你才要问我这个问题呀。我打开模板广场它不是
       一个弹窗吗？你为什么也要问我这个问题呢？」

       旧实现的病根：用「点击目标是否命中一个选择器」当判据，而选择器含 .ec-canvas-topbar ——
       模板广场/画布库/导出 这些**弹窗按钮全在顶栏里**，于是「打开一个弹窗」被误判成
       「离开画布」。这正是这个问题反复复发的根因。

       新判据（必须**是真正的导航**才算离开）：
         · 点击的是 <a href> 且目标 pathname 确实不是 /ec-canvas；或
         · 点击的元素带 data-canvas-leave-guard（画布自己的「返回」按钮显式标注）。
       任何弹窗按钮都是 <button>、不导航 → 天然不满足 → 一律不弹。 */
    const CANVAS_PATHNAME = '/ec-canvas';
    const isLeavingNavigation = target => {
      if (target.closest('[data-canvas-leave-guard]')) return true;
      const anchor = target.closest('a[href]');
      if (!anchor) return false;
      const href = anchor.getAttribute('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return false;
      let path = '';
      try { path = new URL(anchor.href, globalThis.location?.origin || 'http://localhost').pathname; }
      catch { return false; }
      return path !== CANVAS_PATHNAME;
    };
    const handleCapture = async event => {
      if (leaveGuardBypassRef.current) return;
      const target = event.target instanceof Element ? event.target.closest('a,button') : null;
      if (!target) return;
      /* 弹窗 / 切节点 / 关弹窗 / 开菜单 → 都不是导航 → 放行，绝不打扰 */
      if (!isLeavingNavigation(target)) return;
      if (!nodesRef.current.length) return;           /* 空画布不打扰 */
      if (openedFromLibraryRef.current) {              /* ① 来自画布库 → 静默保存 */
        void handleCanvasSessionSaveRef.current?.().catch(() => {});
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      /* ═══ 文案（2026-09-18 用户批注重写）══════════════════════════════════════
         用户原话：「你下面应该给的两个选项应该是不保存和保存吧？取消又是什么意思呢？
         取消在你现在逻辑里面是不保存的意思吗？你很容易让用户误解为点击取消的意思是
         取消这个选项呀。」
         → 只有两个明确选项：左「不保存」（次要）/ 右「保存」（主）。
         → 右上角 X 同样有歧义 → hideClose 不显示它。
         → 点遮罩 / 按 ESC = 留在画布继续编辑（什么都不发生）→ dismissBackdrop: false。
         → 说明文案一句结果导向，删掉「不占用空间」这类内部话术。 */
      const save = await dialog.confirm({
        title: '保存这张画布？',
        message: '保存后可以在「我的画布」里继续编辑。',
        confirmLabel: '保存',
        cancelLabel: '不保存',
        hideClose: true,
        dismissBackdrop: false,
      });
      try {
        if (save) {
          await handleCanvasSessionSaveRef.current?.();
        } else if (canvasSessionRef.current?.id) {
          /* 复用画布库删除接口(服务端即 discard 语义), 不新增接口 */
          await deleteCanvas(canvasSessionRef.current.id);
          canvasSessionRef.current = null;
          setCanvasSession(null);
        }
      } catch { /* 保存/丢弃失败也放行，避免把用户困在画布里 */ }
      leaveGuardBypassRef.current = true;
      target.click();
    };
    document.addEventListener('click', handleCapture, true);
    return () => document.removeEventListener('click', handleCapture, true);
  }, [dialog]);

  /* 9-17 用户批注（图10 第3点）：除了画布内的「返回」，直接关标签页 / 刷新也要守住。
     新建且没保存过的画布有内容时弹系统确认（beforeunload 只能用浏览器原生文案）；
     从画布库打开的画布静默保存，不打扰。空画布不打扰。 */
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleBeforeUnload = event => {
      if (!nodesRef.current.length) return undefined;
      if (openedFromLibraryRef.current) {
        void handleCanvasSessionSaveRef.current?.().catch(() => {});
        return undefined;
      }
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);


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
      const rawSnapshot = restoreCanvasSnapshot(session.snapshot);
      const migrated = migrateMentionsToEdges(rawSnapshot.nodes, rawSnapshot.connections);
      setNodes(migrated.nodes.map(normalizeCanvasNode));
      setConnections(migrated.connections.map(normalizeCanvasConnection));
      setPendingProjectAssetImports(normalizePendingProjectAssetImports(rawSnapshot.pendingProjectAssetImports));
      setViewport(rawSnapshot.viewport);
      setSelected(null);
      setMultiSelected(new Set());
      setCanvasSession(session);
      const restoredMediaRefs = canvasMediaAssetRefs(rawSnapshot.nodes);
      if (restoredMediaRefs.length) {
        const resolvedAssets = (await Promise.all(restoredMediaRefs.map(ref => getProjectAsset(ref.projectId, ref.projectAssetId).catch(() => null))))
          .filter(Boolean);
        if (canvasPersistenceGenerationRef.current !== persistenceGeneration) return;
        setNodes(restoreCanvasMediaPlayback(rawSnapshot.nodes, resolvedAssets).map(normalizeCanvasNode));
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
  // 4c183cd4 续命: portCreationActions 声明已上移到 useMemo 之前 (避免 TDZ), 这里只保留注释.
  /* 契约：派生菜单与对象工具条共享同一选中谓词——"选中即双面板齐张"。
     两个面板各自内部再决定渲染什么内容（工具条动作不足时自行收窄），
     但出现/消失必须永远同步。 */
  /* 用户 9-05 反馈: 上传素材后顶部工具栏 + 右侧派生菜单要同时出现,
     点 + 再看派生菜单时工具栏也不能消失 → 去掉 !connectionPicker 条件 */
  const selectionPanelsVisible = !focusedEditor && multiSelected.size <= 1
    && Boolean(selectedNode)
    /* 用户 9-10 反馈: 节点消失后右侧功能栏还在 → 面板绝不能比节点活得久。
       selectedNode 由 nodes 派生(删掉即 falsy) + 这里再排除 hidden, 双保险。 */
    && !selectedNode.hidden
    && selectedNode.kind !== 'text'
    && !['image-composer', 'text-composer', 'suite-composer', 'video-composer'].includes(selectedNode.kind);
  /* 2026-09-17 统一视觉语言：面板宽度由首页规范推导（统一 480，
     窄屏 min(480, 视口-32) 且 ≥360），窄屏不再横向溢出。
     浮层避让与画布让位共用同一个值，右侧面板不会再与浮层/节点打架。 */
  const panelWidth = useCanvasPanelWidth();
  const rightPanelReservedPx = canvasRightPanelReserved(panelWidth);
  /* ═══ 单一状态驱动 HUD 显隐（2026-09-18 用户批注：打开弹窗时 HUD 不许浮在弹窗上）═══
     用户原话：「为什么我打开工作流模板，你左下角的这个地图会跟着一起进来呢？」
     根因是各浮动层各写各的 z-index + HUD 从不感知"弹窗是否打开"。
     这里把「画布内是否有弹窗」收敛成**一个** 布尔量，并写到根节点 class 上；
     CSS 侧只用 .is-dialog-open 一个开关隐藏整档 HUD。
     新增弹窗时只需把开关加进 canvasHudHidden()，HUD 自动跟着隐藏 —— 不会再漏。 */
  const dialogOpen = canvasHudHidden({
    workflowGalleryOpen,
    canvasLibraryOpen,
    assetPickerOpen,
    skillLibraryOpen: Boolean(skillLibraryTarget),
    imageInfoOpen: Boolean(imageInfoNode),
    imagePreviewOpen: Boolean(zoomImg),
    /* 资产库是页签式全屏弹窗，同样算"弹窗打开" */
    assetLibraryTab: tab === 'assets' && state.logged,
  });
  const visibleWorks = filterCanvasWorks(pastWorks, workCategory);
  const workCategoryCounts = Object.fromEntries(WORK_CATEGORY_OPTIONS.map(option => [
    option.id,
    filterCanvasWorks(pastWorks, option.id).length,
  ]));

  return (
    <div className={`ec-canvas-page${dialogOpen ? ' is-dialog-open' : ''}`} style={canvasVisualLanguageCssVars(panelWidth)}>
      {/* 9-12 画布库：点「新建画布」打开，可改名/复制/收藏/删除/打开已有画布 */}
      {/* 9-12 用户批注：画布库做成整页（不是弹窗） */}
      <CanvasLibraryModal
        open={canvasLibraryOpen}
        variant="page"
        onClose={() => setCanvasLibraryOpen(false)}
        onCreate={createBlankCanvas}
        onOpenCanvas={openCanvasFromLibrary}
      />
      <CanvasTopBar
        /* 9-13 用户批注：标题不要再叫「电商画布」——画布服务所有项目，不是只服务电商。
           （上游导航入口里的「电商画布」也已撤掉；这里只保留真实项目名，否则统一叫「智能画布」） */
        title={tab === 'canvas' ? (result.product_name || '智能画布') : tab === 'assets' ? '资产库' : '我的作品集'}
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
        /* 4c183cd4 续命 2026-08-30 画布总统筹重审: 拿掉顶部 [1-click 视频] overlay 入口
           用户原话 8-30: "你必须把这些重复的东西都给拿掉"
           2026-09-01 用户反对多模态串联: 拿掉 入口回调 prop
           2026-09-28 批 CX（CV-0）: 再拿掉 `onOpenTemplateMarketplace` —— 它驱动的那个
           "假模板广场"实测**无任何按钮调用**（死代码），入口只剩顶栏那一颗 →工作流模板库。 */
        onOpenWorkflowGallery={() => setWorkflowGalleryOpen(true)}
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

      {/* 4c183cd4 续命 画布总监督 2026-08-30 - 保存状态指示器 (顶栏) + 任务日志入口 */}
      <div className="ec-canvas-supervisor-bar" aria-label="画布监督状态栏">
        <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
        <button
          type="button"
          className="ec-canvas-supervisor-button"
          aria-label="任务日志"
          onClick={() => setTaskLogOpen(true)}
        >
          任务日志 {taskLogEntries.length > 0 && <span className="ec-canvas-supervisor-badge">{taskLogEntries.length}</span>}
        </button>
        <button
          type="button"
          className="ec-canvas-supervisor-button"
          aria-label="快捷键面板"
          onClick={() => setShortcutHelpOpen(true)}
        >
          快捷键 (?)
        </button>
      </div>

      {tab === 'canvas' ? (
        /* 9-15 用户批注：右侧功能栏顶部盖住黑色栏目 → 引入 .ec-canvas-workbench
           作为右侧面板的绝对定位基准（从画布区顶部开始、占满整行），
           面板 top=12px 即「画布区顶部 + 12px」，right=14px 即「视口右边 - 14px」。
           9-15 用户批注：点画布空地收起右侧功能栏 → 命中工作区自身（右侧让位空隙）时清空选中。 */
        <div className="ec-canvas-workbench" onPointerDown={event => {
          /* 9-17 用户批注（图10）：「我点击空地之后它还是不会自动关掉」。
             原来只判 event.target === event.currentTarget —— 只覆盖「画布让位后露出的那条空隙本体」，
             一旦点到空隙里的任何子元素（或右侧面板之外的空白容器）就漏掉了。
             实测漏网的两条路径：
               · 点右侧让位留出的空隙（x=1070）→ 面板不关；
               · 点底部工具区外沿（x=200,y=860）→ 面板不关。
             改成「只要命中的不是交互元素，就当作点了画布空地」：
             节点、按钮、输入框、面板自身一律排除，其余空白（含空隙内子元素）都收起面板。 */
          const target = event.target;
          if (!(target instanceof Element)) return;
          if (target.closest('[data-canvas-node-id], button, input, textarea, select, a, [contenteditable="true"], .ec-canvas-right-panel, .ec-canvas-object-toolbar, .ec-canvas-multi-toolbar, .ec-canvas-bottom-dock, .ec-canvas-left-rail, .ec-canvas-zoom-controls, .ec-canvas-minimap, .ec-canvas-layers-panel, .ec-canvas-context-composer, .ec-canvas-derive-menu, .ec-canvas-add-menu, [role="menu"], [role="dialog"]')) return;
          setSelected(null);
          setMultiSelected(new Set());
        }}>
        <div
          ref={containerRef}
          /* 9-13 用户批注：「我随便上传一张图片，右边这个功能栏为什么整个盖上来？之前是在右边展示功能栏。」
             —— 右侧面板不再浮在画布上盖住内容：面板打开时画布区**让出右侧空间**（.has-right-panel），
             节点不会被面板压住，画布中心与底部工具栏也跟着这条边界走。 */
          className={`ec-canvas-stage${selectionPanelsVisible ? ' has-right-panel' : ''}`}
          style={{ cursor: canvasCursorForState({ tool: activeTool, pointerKind: pointerMode?.kind, spaceKey: spacePressed }) }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={event => {
            /* 4c183cd4 续命 画布总监督 2026-08-30 - 画布空白处右键菜单 */
            if (event.target?.closest?.('[data-canvas-node-id],button,input,textarea,select,a')) return;
            event.preventDefault();
            const rect = containerRef.current?.getBoundingClientRect();
            const world = toWorldPoint ? toWorldPoint(event) : { x: event.clientX, y: event.clientY };
            setCanvasContextPanel({
              x: event.clientX,
              y: event.clientY,
              world,
            });
          }}
          onDoubleClick={event => {
            /* 4c183cd4 续命 画布总监督 2026-08-30 - 双击空白处弹添加节点面板 (Quantv §10.2) */
            if (!event.target?.closest?.('[data-canvas-node-id],button,input,textarea,select,a')) {
              event.preventDefault();
              const rect = containerRef.current?.getBoundingClientRect();
              const world = toWorldPoint ? toWorldPoint(event) : { x: event.clientX - (rect?.left || 0), y: event.clientY - (rect?.top || 0) };
              setAddNodePanel({
                x: event.clientX,
                y: event.clientY,
                world,
              });
            }
          }}
        >
          <input ref={sourceUploadRef} type="file" accept="image/*" multiple onChange={handleCanvasSourceUpload} style={{ display: 'none' }} />
          <input ref={videoUploadRef} type="file" accept="video/mp4,video/webm,video/quicktime" multiple onChange={handleCanvasVideoUpload} style={{ display: 'none' }} />
          {/* 9-13 用户批注：音频入口点了没反应 —— 根因是这个 input 从来没渲染过（只有 ref 没有元素） */}
          <input ref={audioUploadRef} type="file" accept="audio/mpeg,audio/mp3,audio/wav,audio/mp4,audio/aac,audio/ogg,audio/webm" multiple onChange={handleCanvasAudioUpload} style={{ display: 'none' }} />
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
              else if (actionId === 'asset-library') setAssetPickerOpen(true);
              else if (actionId === 'upload-audio') audioUploadRef.current?.click();
              /* 2026-09-28 批 CX（CV-1）：「按技能开始」→ 技能库（与首页/视频页同一个 modal）→
                 选中后建一个带这条技能的节点（见 handleSkillLibraryPick 的 create 分支）。 */
              else if (actionId === 'by-skill') openSkillLibraryForNew('image');
              /* 应用类：需要先在画布上选中一个素材；未选中时给提示，不做隐式动作 */
              else if (['application-tts', 'application-caption', 'application-1click-suite', 'application-1click-video'].includes(actionId)) {
                /* 9-13 用户批注：应用有**适用对象**，不能任意节点都能点——
                   语音合成只服务文案，智能字幕只服务视频。 */
                if (!selectedNode) { showToast('请先在画布上选中要处理的节点', 'info'); return; }
                const appKind = String(selectedNode.kind || '');
                const isTextNode = ['text', 'text-composer', 'text-generation'].includes(appKind);
                const isVideoNode = ['video', 'video-composer'].includes(appKind);
                if (actionId === 'application-tts' && !isTextNode) {
                  showToast('语音合成只作用于文案节点，请先选中一个文案', 'info');
                  return;
                }
                if (actionId === 'application-caption' && !isVideoNode) {
                  showToast('智能字幕只作用于视频节点，请先选中一个视频', 'info');
                  return;
                }
                const world = { x: selectedNode.x + selectedNode.w + 28, y: selectedNode.y };
                if (actionId === 'application-tts') handleDerivedTtsGeneration(selectedNode.id, world);
                else if (actionId === 'application-caption') handleDerivedCaptionGeneration(selectedNode.id, world);
                else handleCreateDerivedNode(selectedNode.id, getCanvasAction(actionId) || { id: actionId }, world);
              }
              else if (actionId === 'text-generation') addCanvasComposer('text');
              else if (actionId === 'image') addCanvasComposer('image');
              else if (actionId === 'ecommerce') addCanvasComposer('suite');
              else if (actionId === 'video') addCanvasComposer('video');
            }}
          />
          {/* 从资产库选择：选中后直接加进当前画布（复用既有的 handleImportProjectAssets） */}
          <CanvasAssetPickerModal
            open={assetPickerOpen}
            onClose={() => setAssetPickerOpen(false)}
            onConfirm={async picked => {
              setAssetPickerOpen(false);
              await handleImportProjectAssets(picked);
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
          {/* 4c183cd4 续命 2026-08-30 画布总统筹重审: 拿掉 1-click 拖入面板 (整个面板跟 tab=assets + 底部"添加图片/视频" 完全重复)
              用户原话 8-30: "你必须把这些重复的东西都给拿掉"
              原 3 按钮 (商品档案/公共资产库/本地上传) 跟:
                - tab=assets 完整项目资产库面板 (重复)
                - 底部"添加图片/视频" 工具 (重复)
              改后: 用户从底部"添加图片/添加视频" 入口 + tab=assets 完整面板 进入素材, 不再走 1-click 拖入 */}
          {/* 2026-09-20 用户口径：弹层必须**锚在触发元素上向右展开**，不得钉在画布左缘。
              旧实现 CSS 写死 `left:72px`，实测面板左缘 72 而触发按钮（图层）在 775 ——
              面板出现在离触发元素 700px 外的画布左边，属「各写各的绝对定位」的典型。
              这里把触发按钮的**视口矩形**量出来交给面板，由面板按同一口径定位。 */}
          <CanvasLayersPanel
            open={layersPanelOpen}
            anchorRect={layersPanelOpen ? (() => {
              const btn = containerRef.current?.querySelector('.ec-canvas-bottom-toolbar button[aria-label*="图层"]');
              const r = btn?.getBoundingClientRect?.();
              return r ? { x: r.left, y: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom } : null;
            })() : null}
            nodes={nodes}
            selectedIds={multiSelected}
            onSelect={handleLayerSelect}
            onToggleVisibility={handleLayerVisibilityToggle}
            onToggleLock={handleLayerLockToggle}
            onClose={() => setLayersPanelOpen(false)}
          />
          {/* 画布控制按钮组: 小地图 + 水印（水印只有一个入口，图片/视频在面板内切换 —— 用户 9-08 批注） */}
          <CanvasZoomControls
            scale={viewport.scale}
            onZoomOut={() => zoomTo(viewport.scale * 0.8)}
            onZoomIn={() => zoomTo(viewport.scale * 1.25)}
            onFit={fitView}
            trailing={<>
              {/* 9-11 用户批注: 与其他图标按钮同款 —— 纯图标 + 悬停提示, 不显示「运行」文字;
                  未就绪(单选)不高亮, 多选成链才 is-active; 提示告知「选中 2 个以上节点」。 */}
              {multiSelected.size >= 1 && (
                <button
                  type="button"
                  className={`ec-canvas-icon-button ${multiSelected.size >= 2 ? 'is-active' : ''}`}
                  aria-label="运行整链"
                  title={multiSelected.size >= 2 ? '运行整链（按拓扑顺序执行选中的节点）' : '选中 2 个以上节点可运行整链；当前单选将运行该节点及其下游'}
                  onClick={() => runGraphChain()}
                ><Play size={15} aria-hidden="true" /></button>
              )}
              <button
                type="button"
                className={`ec-canvas-icon-button ${minimapOpen ? 'is-active' : ''}`}
                aria-label="小地图"
                title="小地图"
                aria-pressed={minimapOpen || undefined}
                onClick={() => setMinimapOpen(!minimapOpen)}
              ><MapIcon size={15} /></button>
              <button
                type="button"
                className={`ec-canvas-icon-button ${watermarkPanelOpen ? 'is-active' : ''}`}
                aria-label="水印"
                title="水印"
                aria-pressed={watermarkPanelOpen || undefined}
                onClick={handleToggleWatermarkPanel}
              ><ImageIcon size={15} /></button>
            </>}
          />
          {/* 9-11 用户批注: 确认弹窗太简陋 → 卡片化: 头部标题/预估 + 节点清单 + 主/次按钮 (不变式①: 确认后才扣费) */}
          {graphRunConfirm && (() => {
            const confirmNames = (graphRunConfirm.plan.executableNodeIds || [])
              .map(id => { const n = nodes.find(item => item.id === id); return n ? (n.name || n.displayLabel || id) : null; })
              .filter(Boolean).slice(0, 6);
            const moreCount = (graphRunConfirm.plan.executableNodeIds || []).length - confirmNames.length;
            return (
            <div className="ec-canvas-graphrun-confirm" role="dialog" aria-label="运行整链确认">
              <div className="ec-canvas-graphrun-confirm__head">
                <strong>运行 {graphRunConfirm.plan.nodeCount} 个节点</strong>
                <small>{graphRunConfirm.plan.estimatedUnits > 0
                  ? `预计消耗 ${graphRunConfirm.plan.estimatedUnits} 积分 · 确认后开始扣费`
                  : '该链运行不扣积分 · 确认后开始'}</small>
              </div>
              {confirmNames.length > 0 && (
                <ol className="ec-canvas-graphrun-confirm__nodes">
                  {confirmNames.map((name, i) => <li key={i}>{name}</li>)}
                  {moreCount > 0 && <li className="is-more">… 等共 {(graphRunConfirm.plan.executableNodeIds || []).length} 个节点</li>}
                </ol>
              )}
              <div className="ec-canvas-graphrun-confirm__actions">
                <button type="button" className="is-primary" onClick={() => { const p = graphRunConfirm; setGraphRunConfirm(null); setWorkflowRunOffer(null); startGraphChainRun(p.plan, p.runnable); }}><Play size={13} aria-hidden="true" />运行</button>
                <button type="button" onClick={() => setGraphRunConfirm(null)}>取消</button>
              </div>
            </div>
            );
          })()}
          {/* P2 铺开后底部运行 offer (9-11 用户批注: 顶部常驻条不行 → 并入底部提示区, 8s 自动关闭,
              确认弹窗打开时收起避免叠影): 预计积分读 pricing（展示口径, 结算以目录为准）;
              运行按钮走 P0.5 runGraphChain 二次确认（不变式①）; T4/T5 P3 灰态、不提供扣费运行 */}
          {workflowRunOffer && !graphRunConfirm && (
            <div
              className={`ec-canvas-workflow-offer${workflowRunOffer.requiresAudioVideo ? ' is-p3' : ''}`}
              role="region"
              aria-label="工作流模板铺开结果"
            >
              <span className="ec-canvas-workflow-offer__title"><strong>{workflowRunOffer.name}</strong>已进入画布</span>
              {workflowRunOffer.requiresAudioVideo
                ? <span className="ec-canvas-workflow-offer__note">含视频/音频节点 · 能力接入中，暂不可运行（未运行即不产生费用）</span>
                : <span className="ec-canvas-workflow-offer__cost">预计 {workflowRunOffer.estimatedUnits} 积分</span>}
              {!workflowRunOffer.requiresAudioVideo && (
                <button
                  type="button"
                  className="ec-canvas-workflow-offer__run"
                  onClick={() => { const offer = workflowRunOffer; setWorkflowRunOffer(null); runGraphChain(offer.targetNodeIds); }}
                >运行整链</button>
              )}
              <button type="button" aria-label="关闭铺开提示" className="ec-canvas-workflow-offer__close" onClick={() => setWorkflowRunOffer(null)}>×</button>
            </div>
          )}
          {/* 素材水印面板: 单面板 + 素材类型切换 + 拖拽定位 + 实时预览 (停靠在底栏之上, 不遮挡按钮区) */}
          <WatermarkPanel
            open={watermarkPanelOpen && tab === 'canvas'}
            material={watermarkMaterial}
            onMaterialChange={(next) => { setWatermarkMaterial(next); setWatermarkPreview(null); }}
            config={panelWatermarkConfig}
            previewUrl={panelPreviewUrl}
            previewKind={panelPreviewKind}
            previewAspect={panelPreviewAspect}
            onPreview={handleWatermarkPreview}
            onCommit={handleWatermarkCommit}
            onCancel={handleWatermarkCancel}
            onClose={() => { setWatermarkPanelOpen(false); setWatermarkPreview(null); }}
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
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 16px', borderRadius: 'var(--sb-radius-pill)', background: 'rgba(15,23,42,0.04)', border: '1px solid rgba(15,23,42,0.06)', fontSize: 13, color: '#6b7280' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22a10 10 0 1 1 10-10" /><path d="M22 6 12 16l-3-3" /></svg>
                  双击屏幕，画布自由创作
                </span>
                {/* 3 行分层: 添加素材 (3 入口) + AI 生成 (2 入口) + 智能 (4 入口)
                   资深美工 + 产品经理视角: 3 行而非 1 行 9 按钮, 视觉密度分层, 认知路径清晰
                   智能行 4 入口走 addCanvasComposer (开 prompt 节点), 不是 handleCreateDerivedNode (需要 source 节点),
                   修复 v2 bug: 空画布时 4 智能按钮无反应 (因为 nodes.length === 0) */}
                <div className="ec-canvas-empty-actions">
                  {/* 4c183cd4 续命 2026-08-30 画布总统筹重审: 拿掉重复, 改按节点串联方案
                     用户原话 8-30: "你必须把这些重复的东西都给拿掉" / "你不能够残留那些做错的东西, 拿掉之后你就完整的去复刻他这个AI产品整体的这些东西进来"
                     原 3 行分层 (8 入口) -> 1 行 4 入口:
                       - Row 1 上传图片 / 上传视频 / 从我的作品导入 (3 入口, 保留)
                       - 应用节点入口已下架 (9-04)
                     派生一律走素材端口菜单
                     音频字幕仅在视频节点端口菜单出现
                     智能操作不再是"独立按钮", 是"节点串联"的一部分 */}
                  {/* Row 1 - 添加素材 (3 入口) */}
                  <div className="ec-canvas-empty-row is-primary-row" role="group" aria-label="添加素材">
                    <button type="button" className="is-primary" onClick={() => sourceUploadRef.current?.click()}><HeroGlyph kind="image" />上传图片</button>
                    <button type="button" onClick={() => videoUploadRef.current?.click()}><HeroGlyph kind="video" />上传视频</button>
                    <button type="button" onClick={() => handleTabChange('works')}><HeroGlyph kind="works" />从我的作品导入</button>
                    {/* 9-12 用户批注：资产库必须有入口把素材放到画布上 */}
                    <button type="button" onClick={() => setAssetPickerOpen(true)}><HeroGlyph kind="image" />从资产库选择</button>
                  </div>
                  {/* 9-09: AI 生成行 — 对齐主流画布 (流影/Quantv) 的丰富空态入口 */}
                  <div className="ec-canvas-empty-row is-generate-row" role="group" aria-label="AI 创作">
                    {/* 9-13 用户批注：这里是 AI 生成入口 → 应为「生成文案」；
                        纯文本注解只在底部工具栏的 T（不常用，不要到处放入口） */}
                    <button type="button" onClick={() => addCanvasComposer('text')}><HeroGlyph kind="text" />生成文案</button>
                    <button type="button" onClick={() => addCanvasComposer('image')}><HeroGlyph kind="sparkles" />生成图片</button>
                    <button type="button" onClick={() => addCanvasComposer('video')}><HeroGlyph kind="clapperboard" />生成视频</button>
                    <button type="button" onClick={() => audioUploadRef.current?.click()}><HeroGlyph kind="mic" />添加音频</button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 2026-09-20：**裁剪边界从这里开始，不再由 .ec-canvas-stage 承担**。
              原因：stage 还装着 HUD（底部操作栏 / 缩放条 / 小地图 / 左工具栏），
              stage 一旦 overflow:clip，窄屏（实测 1024px + 右侧面板打开）会把 HUD 切掉一块；
              而把 HUD 回夹进 stage 又会造成 −84px 的居中偏移 —— 两个都不对。
              正确做法：**内容层自己裁，HUD 不裁**（实测 8 组宽度×面板开关：中心偏差 0、探针 9/9 可命中）。 */}
          <div style={{ '--canvas-overlay-scale': 1 / Math.max(0.1, viewport.scale), position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'clip', transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`, transformOrigin: '0 0', willChange: 'transform' }}>
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
                  imageWatermark={nodeWatermark(node, 'image')}
                  videoWatermark={nodeWatermark(node, 'video')}
                  selected={selectedNodeState}
                  dimmed={Boolean(focusedNodeIds && !focusedNodeIds.has(node.id))}
                  onPointerDown={handleNodeDown}
                  onResizeStart={(event, corner) => handleNodeResizeStart(event, node.id, corner)}
                  onNaturalSize={handleImageNaturalSize}
                  onHoverChange={setHoveredNodeId}
                  onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
                  onDoubleClick={node => (node.localPreviewUrl || node.url) && openImagePreview({ url: node.localPreviewUrl || node.url, label: '图片预览' })}
                />;
              }
              if (node.kind === 'design-direction') {
                return <CanvasDirectionNode
                  key={node.id}
                  node={node}
                  selected={selectedNodeState}
                  dimmed={Boolean(focusedNodeIds && !focusedNodeIds.has(node.id))}
                  onPointerDown={handleNodeDown}
                  onHoverChange={setHoveredNodeId}
                  onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
                  /* 内容撑高后把实高同步回 node.h —— 否则加号与连线端点会错开 */
                  onAutoHeight={handleTextNodeAutoHeight}
                  onGenerate={() => handleDirectionGenerate(node)}
                  onRefresh={() => handleDirectionRefresh(node)}
                  onApply={() => handleDirectionApply(node)}
                />;
              }
              if (node.kind === 'image' || node.kind === 'output') {
                const replaceAction = getCanvasAction('replace-media');
                return <StudioImageNode
                  key={node.id}
                  node={node}
                  imageWatermark={nodeWatermark(node, 'image')}
                  selected={selectedNodeState}
                  hovered={hoveredNodeId === node.id}
                  focusActive={Boolean(focusedNodeIds)}
                  related={Boolean(focusedNodeIds?.has(node.id))}
                  onPointerDown={handleNodeDown}
                  onPortPointerDown={event => handlePortPointerDown(event, node.id, 'out')}
                  onPortPointerUp={event => handlePortPointerUp(event, node.id, 'out')}
                  onPortClick={event => handlePortClick(event, node.id)}
                  onResizeStart={(event, corner) => handleNodeResizeStart(event, node.id, corner)}
                  canDerive={canDeriveFromCanvasSource(node)}
                  onHoverChange={setHoveredNodeId}
                  onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
                  onDoubleClick={node => openImagePreview({ url: node.localPreviewUrl || node.url, label: node.name || node.displayLabel || '图片预览' })}
                  onReplace={replaceAction.canRun(node) ? () => handleToolAction(replaceAction, node) : null}
                  onImageReady={handleImagePreviewReady}
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
                  onAutoHeight={handleTextNodeAutoHeight}
                  onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
                />;
              }
              if (node.kind === 'video' || node.kind === 'image-composer' || node.kind === 'text-composer' || node.kind === 'suite-composer' || node.kind === 'video-composer') {
                const replaceGenAction = getCanvasAction('replace-media');
                return <CanvasGenerationNode
                  key={node.id}
                  node={node}
                  imageWatermark={nodeWatermark(node, 'image')}
                  videoWatermark={nodeWatermark(node, 'video')}
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
                  onAutoHeight={handleTextNodeAutoHeight}
                  onDoubleClick={node => node.url && openImagePreview({ url: node.url, label: node.name || '图片预览' })}
                  onReplace={replaceGenAction.canRun(node) ? () => handleToolAction(replaceGenAction, node) : null}
                  canDerive={canDeriveFromCanvasSource(node)}
                  onPortPointerDown={event => handlePortPointerDown(event, node.id, 'out')}
                  onPortPointerUp={event => handlePortPointerUp(event, node.id, 'out')}
                  onPortClick={event => handlePortClick(event, node.id)}
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
                  canDerive={canDeriveFromCanvasSource(node)}
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
            {/* 9-16 用户批注（图15~19）：打组 = 一个**组容器**（虚线 + 四角留白 + 四周呼吸感，
                组框样式与普通选中明确不同）；绑定元素 = 只是「一起移动」的关联（另一种细框）。
                组内节点不再显示左右加号（见 CanvasGenerationNode / CanvasMediaNode 的 canDerive）。 */}
            {!focusedEditor && canvasGroupFrames(nodes).map(frame => <div
              key={frame.groupId}
              className={`ec-canvas-node-group is-${frame.kind}${multiSelectionBounds && frame.kind === 'group' && nodes.some(node => multiSelected.has(node.id) && node.groupId === frame.groupId) ? ' is-selected' : ''}`}
              aria-hidden="true"
              data-canvas-group-id={frame.groupId}
              style={{ left: frame.bounds.x, top: frame.bounds.y, width: frame.bounds.w, height: frame.bounds.h }}
            ><b>{frame.kind === 'group' ? `组 · ${frame.bounds.count}` : `绑定 · ${frame.bounds.count}`}</b></div>)}
            {!focusedEditor && multiSelected.size > 1 && multiSelectionBounds && <div
              className="ec-canvas-multi-selection-box"
              aria-hidden="true"
              style={{ left: multiSelectionBounds.x, top: multiSelectionBounds.y, width: multiSelectionBounds.w, height: multiSelectionBounds.h }}
            />}
            {!focusedEditor && <CanvasMultiSelectionToolbar nodes={nodes} selectedIds={multiSelected} viewport={viewport} bounds={containerRef.current?.getBoundingClientRect()} onAction={handleMultiSelectionAction} />}


            {!focusedEditor && multiSelected.size <= 1 && ['text', 'text-composer'].includes(selectedNode?.kind) && <CanvasTextToolbar
              node={selectedNode}
              viewport={viewport}
              bounds={containerRef.current?.getBoundingClientRect()}
              onStyleChange={change => setNodes(previous => previous.map(node => node.id === selectedNode.id ? { ...node, textStyle: { ...(node.textStyle || {}), ...change } } : node))}
              onDuplicate={() => handleToolAction(getCanvasAction('duplicate'), selectedNode)}
              onFullscreen={() => setTextInspectorNodeId(selectedNode.id)}
              onDelete={() => handleToolAction(getCanvasAction('delete'), selectedNode)}
            />}
            {selectionPanelsVisible && <CanvasObjectToolbar node={selectedNode} viewport={viewport} bounds={containerRef.current?.getBoundingClientRect()} actions={stableActionsForSurface({ surface: 'selection', node: selectedNode })} onAction={handleToolAction} videoDelivery={{ enabled: false }} />}
            {/* 9-11 三轮用户批注: 画布节点只留一个素材动作 (「加入资产库」) —
                「发往视频项目」与资产库语义冲突, 已从节点工具条移除 (视频路径走 生成视频 节点 / 首页视频模块)。 */}
            {!focusedEditor && selectedComposerPosition && selectedNode?.kind === 'image-composer' && <CanvasImageComposer
              node={selectedNode}
              position={selectedComposerPosition}
              handlesVisible
              onPortPointerDown={event => handlePortPointerDown(event, selectedNode.id, 'out')}
              onPortPointerUp={() => handlePortPointerUp?.(event, selectedNode.id, 'out')}
              onPortClick={event => handlePortClick(event, selectedNode.id)}
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
              onOpenSkillLibrary={() => openSkillLibrary(selectedNode.id, 'image')}
              onOpenWorkbench={selectedWorkbenchOpen}
            />}
            {!focusedEditor && selectedComposerPosition && selectedNode?.kind === 'text-composer' && <CanvasTextGenerationComposer
              node={selectedNode}
              position={selectedComposerPosition}
              handlesVisible
              onPortPointerDown={event => handlePortPointerDown(event, selectedNode.id, 'out')}
              onPortPointerUp={() => handlePortPointerUp?.(event, selectedNode.id, 'out')}
              onPortClick={event => handlePortClick(event, selectedNode.id)}
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
              onOpenSkillLibrary={() => openSkillLibrary(selectedNode.id, 'image')}
             onOpenWorkbench={selectedWorkbenchOpen}
            />}
            {!focusedEditor && selectedComposerPosition && selectedNode?.kind === 'suite-composer' && <CanvasEcommerceComposer
              node={selectedNode}
              position={selectedComposerPosition}
              handlesVisible
              onPortPointerDown={event => handlePortPointerDown(event, selectedNode.id, 'out')}
              onPortPointerUp={() => handlePortPointerUp?.(event, selectedNode.id, 'out')}
              onPortClick={event => handlePortClick(event, selectedNode.id)}
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
               /* 「重新生成方案」= 重新走一次设计分析（1 积分，先报价后扣费不变）。
                  旧方案由组件侧压进 previousSuitePlans 保留可对比，并把 planConfirmed 复位。 */
               onRegenerateSuitePlan={() => handleSuiteComposerGenerate({ ...selectedNode, suiteStep: undefined, planConfirmed: false })}
               onOpenSkillLibrary={() => openSkillLibrary(selectedNode.id, 'image')}
               onOpenWorkbench={selectedWorkbenchOpen}
             />}
            {!focusedEditor && selectedComposerPosition && selectedNode?.kind === 'video-composer' && <CanvasVideoComposer
              node={selectedNode}
              position={selectedComposerPosition}
              handlesVisible
              onPortPointerDown={event => handlePortPointerDown(event, selectedNode.id, 'out')}
              onPortPointerUp={() => handlePortPointerUp?.(event, selectedNode.id, 'out')}
              onPortClick={event => handlePortClick(event, selectedNode.id)}
              sources={selectedComposerSources}
              mentionSources={selectedComposerMentions}
              availableSources={availableComposerSources}
              loading={selectedNode.status === 'processing'}
              activeSurface={activeComposerSurface}
              onSurfaceChange={setActiveComposerSurface}
              onChange={change => updateComposerNode(selectedNode.id, change)}
              onAddSources={(files, role) => handleComposerSourceUpload(selectedNode.id, files, role)}
              onRemoveSource={sourceId => removeComposerSource(selectedNode.id, sourceId)}
              onToggleSource={(source, options) => toggleComposerSource(selectedNode.id, source, 'reference', options)}
              onAnalyze={() => handleVideoComposerAnalyze(selectedNode)}
              onGenerate={() => handleVideoComposerGenerate(selectedNode)}
              videoProducts={videoProducts}
              onOpenSkillLibrary={() => openSkillLibrary(selectedNode.id, 'video')}
            />}
            {connectionPicker && <CanvasDeriveMenu
              actions={connectionPicker.mode === 'image-editor'
                ? actionsForSurface({ surface: 'image-editor', node: nodes.find(node => node.id === connectionPicker.sourceNodeId) })
                : portCreationActions}
              /* 2026-09-20：不再自算世界坐标（clampCanvasPickerPosition 的世界/像素混用
                 会在右侧面板打开时把面板甩到最左，实测屏幕 x=10，触发按钮在 683）。
                 改由统一权威按**视口矩形**定位：锚在触发元素向右展开、绝不左翻。 */
              anchorRect={connectionPicker.anchorRect}
              title={connectionPicker.mode === 'image-editor' ? '图片生成与编辑' : '引用当前素材生成'}
              onBack={connectionPicker.mode === 'image-editor' ? () => setConnectionPicker(previous => ({ ...previous, mode: '' })) : undefined}
              onClose={() => { setConnectionPicker(null); setConnectionDraft(null); }}
              onSelect={action => {
                if (action.id === 'text-generation') {
                  /* P0-1 派生即执行: 点完即自动发起文案请求, 不再打开空 composer */
                  handleDerivedTextGeneration(connectionPicker.sourceNodeId, connectionPicker.world);
                } else if (action.id === 'ecommerce-suite') {
                  addCanvasComposer('suite', { ...connectionPicker.world, sourceNodeId: connectionPicker.sourceNodeId });
                } else if (action.id === 'video-upload') {
                  videoUploadRef.current?.click();
                } else if (action.id === 'video-generation') {
                  /* P0-2: prompt 自动引用上游文案节点 (若链条里有), 用户仍可在 composer 修改后确认生成 */
                  addCanvasComposer('video', {
                    ...connectionPicker.world,
                    sourceNodeId: connectionPicker.sourceNodeId,
                    prompt: resolveDerivedVideoPrompt({ nodes, connections, sourceNodeId: connectionPicker.sourceNodeId }),
                  });
                } else if (action.id === 'image-edit' && connectionPicker.mode !== 'image-editor') {
                  // The right-side image action is the same generation node as
                  // the left rail. Its only extra behavior is carrying the
                  // selected image into the prompt/reference context.
                  addCanvasComposer('image', { ...connectionPicker.world, sourceNodeId: connectionPicker.sourceNodeId });
                } else if (connectionPicker.mode === 'image-editor' && ['product-remix', 'outpaint', 'inpaint', 'translate', 'upscale'].includes(action.id)) {
                  addCanvasComposer('image', { ...connectionPicker.world, sourceNodeId: connectionPicker.sourceNodeId, actionId: action.id === 'outpaint' ? 'extend' : action.id, selection: action.id === 'inpaint' ? { mode: 'whole' } : undefined });
                } else if (action.id === 'application-tts') {
                  /* P0-3 派生即执行: TTS 点完即合成, 不再落空壳 application 节点 */
                  handleDerivedTtsGeneration(connectionPicker.sourceNodeId, connectionPicker.world);
                } else if (action.id === 'application-caption') {
                  /* P0-4 派生即执行: 字幕点完即生成字幕配置, 不再落空壳 application 节点 */
                  handleDerivedCaptionGeneration(connectionPicker.sourceNodeId, connectionPicker.world);
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
            <div style={{ position: 'absolute', left: marquee.x * viewport.scale + viewport.x, top: marquee.y * viewport.scale + viewport.y, width: marquee.w * viewport.scale, height: marquee.h * viewport.scale, border: '1px solid var(--sb-brand-600)', background: 'rgba(124,58,237,.10)', pointerEvents: 'none', zIndex: 20 }} />
          )}

        </div>
            {/* 4c183cd4 续命 画布深度重构: 工具栏移到 transform 层内，跟随节点移动 */}
            {selectionPanelsVisible && <EcCanvasRightPanel
              node={selectedNode}
              derivedChildren={selectedDerivedChildren}
              onOpenChild={childId => {
                setSelected(childId);
                setMultiSelected(new Set([childId]));
                const child = nodes.find(node => node.id === childId);
                if (child) {
                  const viewW = (containerRef.current?.clientWidth || window.innerWidth) / viewport.scale;
                  const viewH = (containerRef.current?.clientHeight || window.innerHeight) / viewport.scale;
                  setViewport(current => ({ ...current, x: viewW / 2 - (child.x + child.w / 2) * current.scale, y: viewH / 2 - (child.y + child.h / 2) * current.scale }));
                }
              }}
              onClose={() => setSelected(null)}
              onPatch={handleRightPanelPatch}
              billingCost={chainCostTotal}
              onDeriveSelect={action => {
                const world = { x: selectedNode.x + selectedNode.w + 28, y: selectedNode.y };
                if (action.id === 'text-generation') handleDerivedTextGeneration(selectedNode.id, world);
                else if (action.id === 'ecommerce-suite') addCanvasComposer('suite', { ...world, sourceNodeId: selectedNode.id });
                else if (action.id === 'video-upload') videoUploadRef.current?.click();
                else if (action.id === 'video-generation') addCanvasComposer('video', { ...world, sourceNodeId: selectedNode.id, prompt: resolveDerivedVideoPrompt({ nodes, connections, sourceNodeId: selectedNode.id }) });
                else if (action.id === 'image-edit') addCanvasComposer('image', { ...world, sourceNodeId: selectedNode.id });
                else if (action.id === 'application-tts') handleDerivedTtsGeneration(selectedNode.id, world);
                else if (action.id === 'application-caption') handleDerivedCaptionGeneration(selectedNode.id, world);
                else if (action.id === 'application-1click-suite') handleCreateDerivedNode(selectedNode.id, getCanvasAction(action.id) || action, world);
                else if (action.id === 'application-1click-video') handleCreateDerivedNode(selectedNode.id, getCanvasAction(action.id) || action, world);
                else handleCreateDerivedNode(selectedNode.id, getCanvasAction(action.id) || action, world);
              }}
            />}
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 20px 72px' }}>
          {/* 9-12 用户批注：作品只保留 7 天，要明确告知用户及时下载 */}
          {/* 9-17 提示语纪律（用户图8 相关）：短、说结果不说机制 ——
             去掉"在服务器/自动清理"这类机制措辞，只留用户要做的动作。 */}
          {tab === 'works' && <div className="ec-canvas-work-retention" role="note">作品保留 7 天，请及时下载。</div>}
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
          {/* 9-12 用户批注：资产库改成像竞品那样的**弹窗**（不再是整页 + 一堆标题/副标题） */}
          {tab === 'assets' && state.logged && (
            <div className="canvas-asset-library-overlay" onMouseDown={event => { if (event.target === event.currentTarget) handleTabChange('canvas'); }}>
              <section className="canvas-asset-library-modal" role="dialog" aria-modal="true" aria-label="资产库管理">
            {/* 9-16 用户批注：「右边这个滑动条也超出了界面」——弹窗自身不再滚动，
                改由这个内层滚动视口承担（overflow-y:auto + scrollbar-gutter:stable +
                右侧 6px 留白），滚动条落在容器**内缘**，永不出界、也不压住卡片。 */}
            <div className="ec-asset-library-scroll">
            <section aria-labelledby="canvas-project-assets-title" style={{ marginBottom: 0 }}>
              {/* 9-16 呼吸感：标题与额度之间 12px（≥10），标题块与工具栏之间 18px（≥16）。
                  额度是次要信息，弱化并与标题左对齐分两行，不再和标题挤在同一基线上。 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
                <div>
                  <h2 id="canvas-project-assets-title" style={{ margin: 0, fontSize: 20, lineHeight: 1.3, color: '#1f2937' }}>资产库管理</h2>
                <div className="ec-asset-quota" role="status" aria-live="polite" style={{ marginTop: 12 }}>
                  <div className="ec-asset-quota-text">
                    <strong>已用 {formatBytes(assetUsage?.usedBytes)} / {formatBytes(assetUsage?.quotaBytes || 100 * 1024 * 1024)}</strong>
                    <span>可用 {formatBytes(assetUsage?.availableBytes ?? (assetUsage?.quotaBytes || 100 * 1024 * 1024))}</span>
                  </div>
                  <div className="ec-asset-quota-bar" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.round(((assetUsage?.usedBytes || 0) / Math.max(1, assetUsage?.quotaBytes || 100 * 1024 * 1024)) * 100))}%` }} /></div>
                </div>
                </div>
              </div>
              {/* 9-16 用户批注（资产库弹窗的呼吸感与主次）：
                  ①「上传按钮为什么放到最右上方呢？下面一大堆空白，为什么放这么远？」→ 上传按钮紧挨
                     **工具栏那一行**（搜索框右侧 / 分类 tab 右侧），不再孤零零挂在最右上角；
                  ②「信息密度特别大，没有主次之分和呼吸感」→ 搜索与分类并成一行工具栏，
                     工具栏与素材网格之间留 16px；搜索框自适应拉宽（原来固定 320px，右侧一大片空白）。 */}
              <div className="ec-asset-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <label style={{ position: 'relative', flex: '1 1 240px', minWidth: 200 }}>
                  <span className="sr-only">搜索项目素材</span>
                  <input
                    type="search"
                    value={projectAssetQuery}
                    onChange={event => setProjectAssetQuery(event.target.value)}
                    placeholder="搜索素材名称、项目或角色"
                    aria-label="搜索项目素材"
                    style={{ width: '100%', height: 36, boxSizing: 'border-box', padding: '0 10px', border: '1px solid #e1e5eb', borderRadius: 8, outline: 0, color: '#334155', fontSize: 12, background: '#fff' }}
                  />
                </label>
                <div role="tablist" aria-label="项目素材类型" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: '0 0 auto' }}>
                  {[['', '全部'], ['image', '图片'], ['video', '视频'], ['audio', '音频']].map(([value, label]) => <button
                    key={value || 'all'}
                    type="button"
                    role="tab"
                    aria-selected={projectAssetMediaFilter === value}
                    onClick={() => setProjectAssetMediaFilter(value)}
                    style={{ padding: '5px 10px', border: `1px solid ${projectAssetMediaFilter === value ? '#cbd5e1' : '#edf0f3'}`, borderRadius: 'var(--sb-radius-pill)', background: projectAssetMediaFilter === value ? '#f1f5f9' : '#fff', color: '#475569', fontSize: 11, cursor: 'pointer' }}
                  >{label}</button>)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto', marginLeft: 'auto' }}>
                  {/* 9-12 用户批注：资产库直接支持上传（查询=同一行的搜索框） */}
                  <input ref={projectAssetUploadRef} type="file" accept="image/*" multiple hidden onChange={handleAssetLibraryUpload} />
                  <button
                    type="button"
                    className="ec-asset-upload"
                    disabled={projectAssetUploadBusy}
                    onClick={() => projectAssetUploadRef.current?.click()}
                    aria-label="上传素材到资产库"
                  ><Upload size={14} />{projectAssetUploadBusy ? '上传中…' : '上传'}</button>
                  {selectedProjectAssetKeys.size > 0 && <button
                    type="button"
                    disabled={projectAssetBatchBusy || projectAssetImportBusyRef.current}
                    onClick={handleBatchImportProjectAssets}
                    aria-label={`加入所选 ${selectedProjectAssetKeys.size} 个素材到画布`}
                    title="加入所选素材到画布"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px', border: '1px solid #bfdbfe', borderRadius: 8, background: '#eff6ff', color: 'var(--sb-info-solid-600)', fontSize: 11, cursor: 'pointer' }}
                  ><Plus size={14} />加入所选 {selectedProjectAssetKeys.size}</button>}
                </div>
              </div>
              {projectAssetLibraryLoading ? (
                <div style={{ padding: '18px 16px', border: '1px solid #edf0f3', borderRadius: 8, background: '#fff', color: '#8a929d', fontSize: 12 }}>正在读取素材</div>
              ) : projectAssetLibraryError ? (
                <div role="alert" style={{ padding: '14px 16px', border: '1px solid #fecaca', borderRadius: 8, background: '#fff7f7', color: '#b42318', fontSize: 12 }}>{projectAssetLibraryError}</div>
              ) : visibleProjectAssetLibrary.length ? (
                <div className="ec-asset-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 16 }}>
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
                      style={{ minWidth: 0, padding: 0, overflow: 'hidden', textAlign: 'left', border: '1px solid #e7eaee', borderRadius: 8, background: '#fff', color: '#26313c', cursor: 'pointer' }}
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
                        </div>
                      </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '4px 8px 8px' }}>
                          {/* 9-12 用户批注：卡片上只需一个「删除」，悬停才出现；其余按钮全部去掉 */}
                          <button
                            type="button"
                            className="ec-asset-card-delete"
                            aria-label={`删除${label}`}
                            title="删除该素材"
                            disabled={projectAssetDeleteBusy === `${asset.projectId}:${asset.projectAssetId}`}
                            onClick={() => handleDeleteProjectAsset(asset)}
                          ><Trash2 size={14} /></button>
                        </div>
                    </article>;
                  })}
                </div>
              ) : (
                <div style={{ padding: '18px 16px', border: '1px solid #edf0f3', borderRadius: 8, background: '#fff', color: '#8a929d', fontSize: 12 }}>{projectAssetLibrary.length ? '没有符合筛选条件的素材' : '资产库还没有素材，点右上角「上传」加进来。'}</div>
              )}
            </section>
              </div>
              </section>
            </div>
          )}
          {tab === 'assets' && !state.logged && (
            <div className="ec-canvas-work-empty">
              <Grid3x3 size={42} />
              <strong>登录后查看资产库</strong>
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
              <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.15 }}>{tab === 'trash' ? '🗑️' : '📁'}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#999' }}>{tab === 'trash' ? '回收站是空的' : workCategory === 'all' ? '还没有作品' : '这个分类还没有作品'}</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
              {(tab === 'trash' ? trashWorks : visibleWorks).map(work => (
                <div key={work.id} style={{ borderRadius: 16, overflow: 'hidden', background: '#fff', border: '1px solid rgba(12,10,9,0.06)', boxShadow: '0 2px 8px rgba(12,10,9,0.04)' }}>
                  {/* ═══ 批 CH：到期墓碑在这里也要**看得见**（灰卡），不许凭空消失 ═══════════════════
                      用户口径：「子页面生成的作品不仅会进子页面右边的历史区，还应该进我的作品里面」
                      ——那么"过期了"这件事两处就得说同一种话：子页面是灰卡 + 已过期，这里原来直接没了
                      （整理逻辑要求有图/视频/素材引用，墓碑被清空了就被丢掉）。现在同款灰卡。 */}
                  {work.expired ? (
                    <div role="note" style={{ display: 'grid', gap: 6, padding: '14px', background: 'var(--sb-surface-sunken)' }}>
                      <span style={{ justifySelf: 'start', padding: '2px 8px', borderRadius: 999, background: 'var(--sb-surface-tint-strong)', color: 'var(--sb-ink-3)', fontSize: 11 }}>已过期</span>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--sb-ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{work.name}</div>
                      <div style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--sb-ink-3)' }}>这条记录已过期（作品保留 7 天），图片文件已清理，无法再打开或下载。</div>
                      <div style={{ display: 'flex', gap: 4, justifySelf: 'end' }}>
                        <button type="button" aria-label="移入回收站" title="移入回收站" onClick={() => deleteWork(work.id)} style={{ width: 30, height: 30, padding: 0, border: 0, borderRadius: 8, background: 'rgba(239,68,68,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ) : (
                  <>
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
                      <button type="button" aria-label={`打开${work.name}`} title="打开作品" onClick={() => openWork(work)} style={{ width: 30, height: 30, padding: 0, border: 0, borderRadius: 8, background: 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--sb-brand-600)' }}><ExternalLink size={14} /></button>
                      {/* ═══ 批 CB：**回到生成它的工作台**（用户口径，逐字）═══════════════════════════
                          「他点击这个作品的话，这个作品会把它带到**原来的生成时的工作台**里面，然后把
                           之前生成时的那些**提示词和素材和配置都一起展示在工作台里**……重新生成出来的
                           结果可以是一个**新的结果**，而不是覆盖掉它原来生成的那个作品。」
                          所以这里不是"再打开一次这张图"，而是**回到那条技能的子页面 + 预填**：
                          走的是与首页「做同款」同一条 `creationLaunch`（落到对应技能 → 预填 → 不生成）。
                          ⚠️ 只对"真的存过面板值"的作品给出这颗按钮（判据在 workRemixLaunch.js 的纯函数里，
                             视频任务暂不给 —— 素材还原还没做，给了就是只回去一半的坑）。 */}
                      {canRemixWork(work) && (
                        <button type="button" aria-label={`回到生成${work.name}的工作台`} title="回到工作台（带上素材与配置，不自动生成）" onClick={() => remixWorkInWorkbench(work)} style={{ width: 30, height: 30, padding: 0, border: 0, borderRadius: 8, background: 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--sb-brand-600)' }}><Wand2 size={14} /></button>
                      )}
                      <button type="button" aria-label={`将${work.name}加入资产库`} title="加入资产库" onClick={() => handleAddWorkToLibrary(work)} style={{ width: 30, height: 30, padding: 0, border: 0, borderRadius: 8, background: 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--sb-brand-600)' }}><FolderPlus size={14} /></button>
                      {tab === 'trash' ? (
                        <button type="button" aria-label="恢复作品" onClick={() => restoreDeletedWork(work)} title="恢复作品" style={{ width: 30, height: 30, padding: 0, border: 0, borderRadius: 8, background: 'rgba(16,185,129,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#059669', fontSize: 11, fontWeight: 700 }}>恢复</button>
                      ) : (
                        <button type="button" aria-label="移入回收站" onClick={() => deleteWork(work.id)} title="移入回收站" style={{ width: 30, height: 30, padding: 0, border: 0, borderRadius: 8, background: 'rgba(239,68,68,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, padding: '0 14px 12px', overflowX: 'auto' }}>
                    {canvasWorkCategory(work) === 'video' && work.videoUrl ? <video src={work.videoUrl} controls playsInline preload="metadata" style={{ width: '100%', height: 180, objectFit: 'contain', borderRadius: 8, background: '#111827' }} /> : (work.images || []).slice(0, 6).map((img, i) => (
                      <button key={i} type="button" onClick={() => openImagePreview({ url: proxyImg(img), label: img.label || '' })} style={{ width: 72, height: 72, padding: 0, overflow: 'hidden', borderRadius: 8, border: '1px solid rgba(12,10,9,0.06)', flexShrink: 0, cursor: 'zoom-in', background: '#f3f4f6' }}>
                        <ResponsiveImage src={img} variant="thumb" ratio="1:1" alt={img.label || `作品图片 ${i + 1}`} style={{ width: '100%', height: '100%' }} imgStyle={{ objectFit: 'cover' }} />
                      </button>
                    ))}
                    {!work.videoUrl && !work.images?.length && work.productAssets?.length ? work.productAssets.map((asset, index) => (
                      <button key={`${asset.projectAssetId || asset.assetId || index}`} type="button" onClick={() => openImagePreview({ url: proxyImg(asset.url || asset.stableUrl), label: asset.name || asset.label || `项目图片 ${index + 1}` })} style={{ width: 180, height: 72, padding: 0, overflow: 'hidden', border: '1px solid rgba(12,10,9,0.06)', borderRadius: 8, flexShrink: 0, cursor: 'zoom-in', background: '#f3f4f6' }}>
                        <ResponsiveImage src={proxyImg(asset.url || asset.stableUrl)} variant="thumb" ratio="1:1" alt={asset.name || asset.label || `项目图片 ${index + 1}`} style={{ width: '100%', height: '100%' }} imgStyle={{ objectFit: 'cover' }} />
                      </button>
                    )) : null}
                    {(work.mediaAssets || []).map((asset, index) => {
                      const mediaUrl = asset.playbackUrl || asset.url || asset.stableUrl;
                      if (!mediaUrl || (asset.mediaKind === 'video' && work.videoUrl)) return null;
                      const label = asset.name || asset.displayName || asset.role || `${asset.mediaKind === 'video' ? '视频' : '音频'}素材 ${index + 1}`;
                      return asset.mediaKind === 'video' ? <video key={`media-${asset.projectAssetId || asset.assetId || index}`} src={mediaUrl} controls playsInline preload="metadata" aria-label={label} style={{ width: 220, height: 124, objectFit: 'contain', borderRadius: 8, background: '#111827', flexShrink: 0 }} /> : asset.mediaKind === 'audio' ? (
                        <div key={`media-${asset.projectAssetId || asset.assetId || index}`} style={{ minWidth: 240, height: 72, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5, padding: '0 10px', boxSizing: 'border-box', border: '1px solid rgba(12,10,9,0.06)', borderRadius: 8, background: '#f8fafc', color: '#475569', flexShrink: 0 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}><Music size={20} />{label}</span>
                          <audio src={mediaUrl} controls preload="metadata" aria-label={label} style={{ width: '100%', height: 30 }} />
                        </div>
                      ) : null;
                    })}
                  </div>
                  </>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* A6: 右键上下文菜单 (节点级) */}
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

      {/* 4c183cd4 续命 画布总监督 2026-08-30 - Quantv 节点操作条 (NodeActionBar) */}
      {nodeActionBar && (
        <CanvasNodeActionBar
          node={nodeActionBar.node}
          position={nodeActionBar.position}
          onAction={(actionId, node) => {
            /* 转发到对应的 canvas action */
            handleToolAction({ id: actionId, execute: { handler: actionId } }, node);
            if (actionId !== 'preview' && actionId !== 'add-asset') {
              setNodeActionBar(null);
            }
          }}
          onClose={() => setNodeActionBar(null)}
          saveStatus={saveStatus}
        />
      )}

      {/* 4c183cd4 续命 画布总监督 2026-08-30 - Quantv 画布右键菜单 (空白处) */}
      {canvasContextPanel && (
        <CanvasContextMenuPanel
          x={canvasContextPanel.x}
          y={canvasContextPanel.y}
          onAction={(actionId) => {
            switch (actionId) {
              case 'add-text': handleAddTextRef.current?.({ x: canvasContextPanel.world?.x, y: canvasContextPanel.world?.y }); break;
              case 'add-image': sourceUploadRef.current?.click?.(); break;
              case 'add-video': videoUploadRef.current?.click?.(); break;
              case 'add-audio': audioUploadRef.current?.click?.(); break;
              case 'add-application':
                /* 空壳应用节点已下架 (用户 9-04 反馈) */
                showToast('请先选中要处理的素材', 'info');
                break;
              case 'paste':
                readClipboardNodes().then(payload => {
                  /* 9-17（图7）：右键菜单的「粘贴」同样只在剪贴板确实是画布节点时才落节点；
                     普通文本绝不在这里变成节点。 */
                  if (!shouldHandleCanvasPaste({ typing: false, payload })) return;
                  const now = Date.now();
                  const newNodes = payload.nodes.map((n, i) => ({
                    ...n,
                    id: `pasted_${now}_${i}`,
                    x: (n.x || 100) + i * 36,
                    y: (n.y || 100) + i * 36,
                  }));
                  setNodes(prev => [...prev, ...newNodes]);
                });
                break;
              case 'select-all':
                setMultiSelected(new Set((nodes || []).map(n => n.id)));
                setSelected(null);
                break;
              case 'fit-view': fitViewRef.current?.(); break;
              case 'auto-arrange':
                setNodes(prev => autoArrangeCanvasNodes(prev, connections || []));
                break;
              case 'toggle-snap': setSnapEnabled(v => !v); break;
              case 'toggle-theme': setThemeMode(prev => prev === 'dark' ? 'light' : prev === 'light' ? 'auto' : 'dark'); break;
              case 'undo': {
                const current = { nodes };
                const previous = historyRef.current.undo(current);
                if (previous !== current && previous.nodes) setNodes(previous.nodes);
                break;
              }
              case 'redo': {
                const current = { nodes };
                const next = historyRef.current.redo(current);
                if (next !== current && next.nodes) setNodes(next.nodes);
                break;
              }
              default: break;
            }
          }}
          onClose={() => setCanvasContextPanel(null)}
          viewportWidth={typeof window !== 'undefined' ? window.innerWidth : 1440}
          viewportHeight={typeof window !== 'undefined' ? window.innerHeight : 900}
        />
      )}

      {/* 4c183cd4 续命 画布总监督 2026-08-30 - Quantv 双击添加节点面板 */}
      {addNodePanel && (
        <CanvasAddNodePanel
          x={addNodePanel.x}
          y={addNodePanel.y}
          onAdd={(kind, id) => {
            const world = addNodePanel.world || {
              x: Math.max(40, Math.round((-viewport.x + (containerRef.current?.clientWidth || window.innerWidth) * 0.5) / viewport.scale)),
              y: Math.max(40, Math.round((-viewport.y + (containerRef.current?.clientHeight || window.innerHeight) * 0.5) / viewport.scale)),
            };
            /* 9-13 用户批注：双击空白处添加的应该是**生成文案（AI）**，不是纯文本节点；
               纯文本注解只从底部工具栏的 T 进入。 */
            if (kind === 'text') {
              setAddNodePanel(null);
              addCanvasComposer('text');
              return;
            }
            if (kind === 'image') {
              sourceUploadRef.current?.click?.();
            } else if (kind === 'video') {
              videoUploadRef.current?.click?.();
            } else if (kind === 'audio') {
              audioUploadRef.current?.click?.();
            }
          }}
          onUpload={() => sourceUploadRef.current?.click?.()}
          onPickFromLibrary={() => { setActiveFilter && setActiveFilter('资产库'); }}
          /* 2026-09-28 批 CX（CV-1）：「按技能开始」→ 打开技能库（与首页/视频页同一个 modal），
             选中后由 handleSkillLibraryPick 的 create 分支建出带这条技能的节点。 */
          onStartFromSkill={() => { setAddNodePanel(null); openSkillLibraryForNew('image'); }}
          onClose={() => setAddNodePanel(null)}
          viewportWidth={typeof window !== 'undefined' ? window.innerWidth : 1440}
          viewportHeight={typeof window !== 'undefined' ? window.innerHeight : 900}
        />
      )}

      {/* 4c183cd4 续命 画布总监督 2026-08-30 - 快捷键帮助面板 (按 ?  弹出) */}
      {shortcutHelpOpen && (
        <CanvasShortcutHelp onClose={() => setShortcutHelpOpen(false)} />
      )}

      {/* 4c183cd4 续命 画布总监督 2026-08-30 - 任务日志面板 (Quantv §1.6 CanvasTaskLogPanel) */}
      {taskLogOpen && (
        <CanvasTaskLogPanel
          tasks={canvasTaskLogEntries}
          onClose={() => setTaskLogOpen(false)}
          onRetry={(task) => console.info('[task] 重试', task.id)}
          onDismiss={(task) => setDismissedTaskIds(prev => new Set([...prev, task.id]))}
          onRefund={(task) => console.info('[task] 退款', task.id)}
        />
      )}

      {/* 4c183cd4 续命 画布总监督 2026-08-30 - 小地图 (Quantv CanvasMinimap) */}
      {tab === 'canvas' && minimapOpen && <CanvasMinimap
        nodes={nodes}
        connections={connections}
        viewport={viewport}
        worldBounds={minimapWorldBounds}
        viewportSize={{
          width: containerRef.current?.clientWidth || globalThis.innerWidth || 1440,
          height: containerRef.current?.clientHeight || globalThis.innerHeight || 900,
        }}
        onViewportChange={(v) => setViewport(current => ({ ...current, x: v.x, y: v.y }))}
        onWheelZoom={(deltaY) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          setViewport(current => zoomAroundCursor(current, { x: rect.width / 2, y: rect.height / 2 }, deltaY > 0 ? 0.92 : 1.09));
        }}
        onClose={() => setMinimapOpen(false)}
      />}
      {/* 小地图重开入口已并入左下角缩放条 (用户 9-04 反馈: 不再压住缩小按钮) */}

      {/* P2: 跨域投递对话框（EcCanvas → 视频项目） */}
      <VideoProjectDeliveryDialog
        open={Boolean(videoDelivery)}
        refs={videoDelivery?.refs || []}
        surface={videoDelivery?.surface || ''}
        onClose={() => setVideoDelivery(null)}
        onDelivered={handleVideoDelivered}
      />

      {/* 4c183cd4 续命 画布深度重构 (用户 8-29 硬性反馈 3): 下面 3 智能按钮的 chainService 进度弹窗
          资深美工视角: 4 步进度条 + 完成态对比 + AI 积分消耗, 不用 AI 默认色
          产品经理视角: 4 步 = 文案 -> 首帧 -> 视频 -> 音轨+字幕 (跟 chainService 4 步 100% 一致)
          总统筹视角: TapNow 旗舰模式 Agent progress UI, 不写 (流影AI 风格) */}
      {chainRun && (
        <div role="dialog" aria-modal="true" aria-label={`${chainRun.title} 进度`} style={{ position: 'fixed', inset: 0, zIndex: 10006, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(15,23,42,.42)', backdropFilter: 'blur(6px)' }}>
          <section style={{ width: 'min(440px, 100%)', background: 'var(--sb-surface-card, #fff)', border: '1px solid var(--sb-border-default, rgba(15,23,42,.08))', borderRadius: 16, boxShadow: '0 24px 70px rgba(15,23,42,.24)', padding: 22 }}>
            <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0, color: 'var(--sb-ink-1, #111827)', fontSize: 16, fontWeight: 800 }}>{chainRun.title}</h2>
                <div style={{ marginTop: 4, color: 'var(--sb-ink-4, #6b7280)', fontSize: 11 }}>chainService 4 步 (文案→首帧→视频→音轨+字幕)</div>
              </div>
              <button type="button" aria-label="关闭进度" title="关闭" disabled={chainRun.running} onClick={() => setChainRun(null)} style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, border: 0, borderRadius: 6, background: 'var(--sb-state-hover-bg, #f3f4f6)', color: 'var(--sb-ink-5, #4b5563)', cursor: chainRun.running ? 'not-allowed' : 'pointer', opacity: chainRun.running ? .5 : 1 }}>×</button>
            </header>
            <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'grid', gap: 8 }}>
              {CHAIN_STEP_LABELS.map((label, idx) => {
                const status = chainRun.steps?.[idx] || 'pending';
                const statusColor = status === 'ok' ? '#10b981' : status === 'failed' ? '#ef4444' : status === 'running' ? 'var(--sb-brand-600)' : '#9ca3af';
                const statusLabel = status === 'ok' ? '✓ 完成' : status === 'failed' ? '✕ 失败' : status === 'running' ? '⋯ 进行中' : '○ 等待';
                return <li key={label} style={{ display: 'grid', gridTemplateColumns: '22px 1fr auto', alignItems: 'center', gap: 10, padding: '8px 11px', border: '1px solid var(--sb-border-subtle, #e5e7eb)', borderRadius: 8, background: status === 'running' ? 'rgba(124,58,237,.05)' : 'transparent' }}>
                  <span style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 'var(--sb-radius-pill)', fontSize: 11, fontWeight: 800, color: '#fff', background: statusColor }}>{idx + 1}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--sb-ink-1, #111827)' }}>{label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, letterSpacing: '.02em' }}>{statusLabel}</span>
                </li>;
              })}
            </ol>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: chainRun.ok ? 'rgba(16,185,129,.08)' : chainRun.error ? 'rgba(239,68,68,.08)' : 'rgba(124,58,237,.06)', marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--sb-ink-4, #6b7280)' }}>累计 AI 成本</span>
              <strong style={{ fontSize: 14, color: 'var(--sb-ink-1, #111827)', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: 'tnum' }}>¥{(chainRun.totalCost || 0).toFixed(4)}</strong>
            </div>
            {chainRun.error && <div role="alert" style={{ padding: '9px 11px', borderRadius: 8, background: 'rgba(239,68,68,.06)', color: '#b91c1c', fontSize: 12, marginBottom: 12 }}>{chainRun.error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" disabled={chainRun.running} onClick={() => setChainRun(null)} style={{ border: 0, borderRadius: 8, padding: '8px 14px', background: 'var(--sb-state-hover-bg, #f3f4f6)', color: 'var(--sb-ink-3, #4b5563)', fontSize: 12, fontWeight: 700, cursor: chainRun.running ? 'not-allowed' : 'pointer' }}>{chainRun.ok ? '完成' : '关闭'}</button>
            </div>
          </section>
        </div>
      )}

      {imageInfoNode && (
        <div role="dialog" aria-modal="true" aria-labelledby="canvas-image-info-title" style={{ position: 'fixed', inset: 0, zIndex: 10005, background: 'rgba(15,23,42,.38)', display: 'grid', placeItems: 'center', padding: 20 }}>
          <div style={{ width: 'min(430px, 100%)', boxSizing: 'border-box', background: '#fff', borderRadius: 8, boxShadow: '0 24px 70px rgba(15,23,42,.24)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div id="canvas-image-info-title" style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>图片信息</div>
                <div style={{ marginTop: 3, fontSize: 11, color: '#6b7280' }}>名称与用途会显示在画布和交付信息中</div>
              </div>
              <button type="button" aria-label="关闭图片信息" onClick={() => setImageInfoNode(null)} style={{ width: 30, height: 30, border: 0, borderRadius: 8, background: '#f3f4f6', color: '#4b5563', cursor: 'pointer' }}><X size={17} /></button>
            </div>
            <label style={{ display: 'block', marginBottom: 12, fontSize: 11, fontWeight: 700, color: '#4b5563' }}>
              图片名称
              <input autoFocus value={imageInfoName} maxLength={80} onChange={event => setImageInfoName(event.target.value)} style={{ display: 'block', width: '100%', height: 38, boxSizing: 'border-box', marginTop: 6, padding: '0 10px', border: '1px solid #d1d5db', borderRadius: 8, font: '12px inherit' }} />
            </label>
            <label style={{ display: 'block', marginBottom: 12, fontSize: 11, fontWeight: 700, color: '#4b5563' }}>
              图片类型
              <select value={imageInfoGroup} onChange={event => setImageInfoGroup(event.target.value)} style={{ display: 'block', width: '100%', height: 38, boxSizing: 'border-box', marginTop: 6, padding: '0 10px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', font: '12px inherit' }}>
                {ASSET_GROUPS.map(group => <option key={group} value={group}>{group}</option>)}
              </select>
            </label>
            <label style={{ display: 'block', marginBottom: 16, fontSize: 11, fontWeight: 700, color: '#4b5563' }}>
              展示用途
              <textarea value={imageInfoUsage} maxLength={240} rows={3} onChange={event => setImageInfoUsage(event.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: 8, resize: 'vertical', font: '12px/1.55 inherit' }} />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setImageInfoNode(null)} style={{ border: 0, borderRadius: 8, padding: '9px 14px', background: '#f3f4f6', color: '#4b5563', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>取消</button>
              <button type="button" disabled={!imageInfoName.trim()} onClick={handleImageInfoSave} style={{ border: 0, borderRadius: 8, padding: '9px 16px', background: imageInfoName.trim() ? 'var(--sb-info-solid-600)' : '#9ca3af', color: '#fff', fontSize: 12, fontWeight: 700, cursor: imageInfoName.trim() ? 'pointer' : 'not-allowed' }}>保存</button>
            </div>
          </div>
        </div>
      )}

      {inspectorOpen && multiSelected.size > 0 && (
        <div style={{ position: 'fixed', top: 70, right: 18, zIndex: 10003, width: 220, background: '#fff', border: '1px solid rgba(12,10,9,.08)', borderRadius: 12, boxShadow: '0 12px 36px rgba(12,10,9,.16)', padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#1f2937', marginBottom: 8 }}>批量修改分类</div>
          <div style={{ fontSize: 11, color: '#777', marginBottom: 10 }}>已选 {multiSelected.size} 张资产</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {ASSET_GROUPS.map(group => <button key={group} type="button" onClick={() => handleBatchClassify(group)} style={{ border: 0, borderRadius: 8, padding: '8px 6px', background: groupDraft === group ? 'rgba(124,58,237,.12)' : 'rgba(12,10,9,.04)', color: groupDraft === group ? 'var(--sb-brand-600)' : '#555', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{group}</button>)}
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
              <button type="button" onClick={() => setDirectionDraft(null)} style={{ border: 0, background: 'rgba(12,10,9,.05)', borderRadius: 8, width: 30, height: 30, cursor: 'pointer' }}>×</button>
            </div>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 5 }}>方案名称<input value={directionTitle} readOnly aria-readonly="true" style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 10px', fontSize: 12, background: '#f7f7f8', color: '#6b7280', cursor: 'default' }} /></label>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 5 }}>电商用途<textarea value={directionPurpose} onChange={e => setDirectionPurpose(e.target.value)} rows={2} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 10px', fontSize: 12, resize: 'vertical' }} /></label>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 5 }}>构图与视觉<textarea value={directionComposition} onChange={e => setDirectionComposition(e.target.value)} rows={3} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 10px', fontSize: 12, resize: 'vertical' }} /></label>
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 10 }}>文案要求<textarea value={directionCopy} onChange={e => setDirectionCopy(e.target.value)} rows={2} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 10px', fontSize: 12, resize: 'vertical' }} /></label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: '#6b7280' }}>画面比例</span>
              {['1:1', '3:4', '9:16', '长图'].map(ratio => <button key={ratio} type="button" onClick={() => setDirectionRatio(ratio)} style={{ border: 0, borderRadius: 'var(--sb-radius-pill)', padding: '5px 9px', background: directionRatio === ratio ? '#1f2937' : 'rgba(12,10,9,.05)', color: directionRatio === ratio ? '#fff' : '#666', fontSize: 10, cursor: 'pointer' }}>{ratio}</button>)}
            </div>
            {/* 9-16 同款收口：底部操作区对齐全站规范（间距 12px、按钮 36px 高、最小宽 88px、圆角 10px）。 */}
            <div className="ui-modal-footer" style={{ marginTop: 0, padding: 0, borderTop: 0 }}>
              <div className="ui-modal-footer-actions">
                <button type="button" className="ui-btn ui-btn-secondary" onClick={() => setDirectionDraft(null)}>取消</button>
                <button type="button" className="ui-btn ui-btn-primary" onClick={handleDirectionSave}>保存方案并继续编辑</button>
              </div>
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
                return <button key={mode} type="button" disabled={disabled} onClick={() => { configureExport(mode); setExportIntent(mode === 'long-detail' ? 'long-detail' : exportIntent); }} style={{ textAlign: 'left', border: exportMode === mode ? '1.5px solid var(--sb-info-solid-600)' : '1px solid #dfe3e8', borderRadius: 8, padding: '9px 11px', background: exportMode === mode ? '#eff5ff' : '#fff', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .52 : 1 }}><div style={{ fontSize: 13, fontWeight: 750, color: '#303640' }}>{label}</div><div style={{ fontSize: 11, color: '#7b8490', marginTop: 2 }}>{desc}</div></button>;
              })}
            </div>
            {exportMode === 'long-detail' && <div style={{ borderTop: '1px solid #edf0f3', paddingTop: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><strong style={{ fontSize: 12 }}>长图顺序</strong><span style={{ fontSize: 11, color: '#7b8490' }}>从上到下拼接</span></div>
              <div style={{ display: 'grid', gap: 6 }}>
                {orderedDetailNodes.map((node, index) => <div key={node.id} style={{ minHeight: 44, display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) 30px 30px', alignItems: 'center', gap: 7, padding: '5px 6px', border: '1px solid #e4e7eb', borderRadius: 8, background: '#fafbfc' }}>
                  <img src={proxyImg(node.url)} alt="" style={{ width: 34, height: 34, objectFit: 'cover', borderRadius: 4, background: '#eef0f2' }} />
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: '#343a43' }}>{index + 1}. {node.name || node.role || '详情图'}</span>
                  <button type="button" aria-label={`上移${node.name || '详情图'}`} title="上移" disabled={index === 0} onClick={() => setDetailOrderIds(ids => moveDetailItem(ids, index, index - 1))} style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', border: 0, borderRadius: 6, background: '#eef1f4', color: '#4f5864', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? .35 : 1 }}><ArrowUp size={15} /></button>
                  <button type="button" aria-label={`下移${node.name || '详情图'}`} title="下移" disabled={index === orderedDetailNodes.length - 1} onClick={() => setDetailOrderIds(ids => moveDetailItem(ids, index, index + 1))} style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', border: 0, borderRadius: 6, background: '#eef1f4', color: '#4f5864', cursor: index === orderedDetailNodes.length - 1 ? 'not-allowed' : 'pointer', opacity: index === orderedDetailNodes.length - 1 ? .35 : 1 }}><ArrowDown size={15} /></button>
                </div>)}
                {orderedDetailNodes.length < 2 && <div style={{ padding: '10px 11px', borderRadius: 8, background: '#fff7ed', color: '#9a5b13', fontSize: 12 }}>请至少选择 2 张已生成的详情图。</div>}
              </div>
            </div>}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 15 }}><span style={{ fontSize: 11, color: '#6b7280' }}>交付格式</span>{['PNG', 'JPG'].map(format => <button key={format} type="button" disabled={isExportDeliveryBusy(exportDelivery)} onClick={() => configureExport(exportMode, format)} style={{ border: 0, borderRadius: 'var(--sb-radius-pill)', padding: '5px 10px', background: exportFormat === format ? '#1f2937' : '#f3f4f6', color: exportFormat === format ? '#fff' : '#666', fontSize: 10, cursor: isExportDeliveryBusy(exportDelivery) ? 'not-allowed' : 'pointer', opacity: isExportDeliveryBusy(exportDelivery) ? .5 : 1 }}>{format}</button>)}</div>
            {exportDelivery.destination && <div style={{ marginBottom: 12, padding: '9px 11px', border: '1px solid #dbe4ee', borderRadius: 8, background: '#f8fafc', fontSize: 12, color: '#475569' }}><strong style={{ color: '#1f2937' }}>保存位置：</strong>{exportDelivery.destination.name}</div>}
            {(exportDelivery.status === 'preparing' || exportDelivery.status === 'writing') && <div style={{ marginBottom: 12, fontSize: 12, color: '#475569' }}>{exportDelivery.status === 'preparing' ? '正在校验图片' : '正在写入文件'} · {exportDelivery.progress.completed}/{exportDelivery.progress.total}</div>}
            {exportDelivery.status === 'success' && <div style={{ marginBottom: 12, padding: '9px 11px', borderRadius: 8, background: '#ecfdf5', color: '#047857', fontSize: 12, fontWeight: 700 }}>{exportDelivery.result?.verification === 'filesystem' ? '已验证写入' : '已开始下载'} {exportDelivery.result?.count || 0} 张图片{exportDelivery.result?.verification === 'filesystem' ? `到 ${exportDelivery.destination?.name || '所选位置'}` : '，请在浏览器下载列表确认'}</div>}
            {exportDelivery.status === 'cancelled' && <div style={{ marginBottom: 12, padding: '9px 11px', borderRadius: 8, background: '#f8fafc', color: '#64748b', fontSize: 12 }}>已取消选择保存位置，导出配置仍保留。</div>}
            {exportDelivery.status === 'error' && <div role="alert" style={{ marginBottom: 12, padding: '9px 11px', borderRadius: 8, background: '#fef2f2', color: '#b91c1c', fontSize: 12 }}>{exportDelivery.error}</div>}
            {/* 9-16 对齐全站底部操作区规范（--footer-actions-*）：
                 按钮间距 8 → 12px；三个按钮原来 padding 13/13/16 不一致、无固定高度，
                 现在统一 36px 高 / 最小宽 88px / 圆角 10px（主次视觉等重）；
                 禁用态原来是 opacity 变灰，改走 .ui-btn:disabled 的明确底色 + 文字色 + not-allowed。
                 导出主按钮保留本弹窗的绿色语义（.is-export）。 */}
            <div className="ui-modal-footer" style={{ marginTop: 0, padding: 0, borderTop: 0 }}>
              <div className="ui-modal-footer-actions">
                <button type="button" className="ui-btn ui-btn-secondary" disabled={isExportDeliveryBusy(exportDelivery)} onClick={() => setExportOpen(false)}>{exportDelivery.status === 'success' ? '完成' : '取消'}</button>
                <button type="button" className="ui-btn ui-btn-secondary" disabled={isExportDeliveryBusy(exportDelivery) || !exportScope.deliverables.length || (exportMode === 'long-detail' && !canExportLongDetail)} onClick={handleChooseExportDestination}>{exportDelivery.destination ? '更改保存位置' : '选择保存位置'}</button>
                {exportDelivery.destination && <button type="button" className="ui-btn ui-btn-primary is-export" disabled={isExportDeliveryBusy(exportDelivery)} onClick={handleStartExport}><FileDown size={14} /> {exportDelivery.status === 'success' ? '再次导出' : '开始导出'}</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {projectAssetLineage && (
        <div role="presentation" onMouseDown={() => setProjectAssetLineage(null)} style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(15,23,42,.42)', backdropFilter: 'blur(6px)' }}>
          <section role="dialog" aria-modal="true" aria-labelledby="project-asset-lineage-title" onMouseDown={event => event.stopPropagation()} style={{ width: 'min(520px, 100%)', maxHeight: 'min(680px, 92vh)', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 20, background: '#fff', boxShadow: '0 24px 80px rgba(15,23,42,.24)' }}>
            <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 20px 14px', borderBottom: '1px solid #eef0f2' }}>
              <div style={{ minWidth: 0 }}>
                <h2 id="project-asset-lineage-title" style={{ margin: 0, color: '#1f2937', fontSize: 20 }}>素材关系</h2>
                <div style={{ marginTop: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#667085', fontSize: 12 }}>{projectAssetLineage.asset?.metadata?.displayName || projectAssetLineage.asset?.assetId || '项目素材'}</div>
              </div>
              <button type="button" aria-label="关闭素材关系" title="关闭" onClick={() => setProjectAssetLineage(null)} style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, flex: '0 0 auto', border: 0, borderRadius: 8, background: '#f3f4f6', color: '#4b5563', cursor: 'pointer' }}><X size={17} /></button>
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
        <div ref={previewDialogRef} role="dialog" aria-modal="true" aria-label={`${zoomImg.label || '图片'}大图预览`} onClick={closeImagePreview} style={{ position: 'fixed', inset: 0, zIndex: 10001, overflow: 'hidden', background: 'rgba(12,10,9,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <img src={proxyImg(zoomImg.url)} alt={zoomImg.label || '图片预览'} draggable="false" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, transform: `scale(${previewScale})`, transformOrigin: 'center', transition: 'transform 120ms ease-out', willChange: 'transform', cursor: previewScale > 1 ? 'zoom-out' : 'zoom-in' }} onClick={e => e.stopPropagation()} />
          <button type="button" aria-label="关闭大图预览" onClick={closeImagePreview} style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, border: 0, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 24, color: '#fff' }}>x</button>
        </div>
      )}

      <SkillLibraryModal
        open={Boolean(skillLibraryTarget)}
        initialKind={skillLibraryTarget?.domain === 'video' ? 'video' : 'image'}
        onClose={() => setSkillLibraryTarget(null)}
        onPick={handleSkillLibraryPick}
      />

      {pendingProjectAssetImports.length > 0 && (
        <div className="ec-canvas-pending-imports" role="status" aria-live="polite">
          <span>有 {pendingProjectAssetImports.length} 个素材待处理</span>
          <button
            type="button"
            className="ec-canvas-pending-imports-action"
            onClick={retryPendingProjectAssetImports}
            disabled={pendingProjectAssetImportsBusy}
            title="重试处理待处理素材"
          >
            <RefreshCw size={15} aria-hidden="true" />
            {pendingProjectAssetImportsBusy ? '处理中' : '重试处理'}
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

      {/* ═══ 2026-09-28 批 CX（CV-0）：**「模板广场」收敛成一套真的** ═══════════════════════════════
         这里原来还渲染着第二个模板广场 `CanvasTemplateMarketplace`（100 套、缩略图是按 id 生成的 SVG），
         它的 `onPickTemplate` 只做 `showToast('已应用模板 X')`、**不铺任何节点** —— 一颗"点了会骗人"的按钮。
         实测（批 CW）：它的开合状态只由 prop `onOpenTemplateMarketplace` 驱动，而 CanvasChrome 里
         **没有任何按钮调用它**（全仓只有"解构 1 处 + 传参 1 处 + 定义 1 处"，无 onClick）
         ⇒ 它是**不可达的死代码**；用户真正点到的顶栏「模板广场」打开的是
         `WorkflowTemplateGallery`（真图结构 + 一键铺开 + 服务端真实计数）。
         用户口径（逐字，画布那条）：「像这个**商品信息**AI规划这些按钮现在其实都是**失效的状态**……
         那我觉得这些东西**可以不要了，你就直接拿掉吧**。」—— 同一条铁律：**不许留着假按钮等人接**。
         ⇒ 整个组件与它的状态/prop 一并删除；100 套那份目录仍服务于公开页 `?page=public-templates`，不受影响。 */}

      {/* P2 图工作流模板库（一键铺开层）: 铺开免费、点赞幂等真数、T4/T5 P3 灰态门控 */}
      <WorkflowTemplateGallery
        open={workflowGalleryOpen}
        email={phone}
        onNotify={showToast}
        onClose={() => setWorkflowGalleryOpen(false)}
        onInstantiate={template => { setWorkflowGalleryOpen(false); return handleInstantiateWorkflowTemplate(template); }}
        /* 2026-09-28 批 CX（CV-3）：集合页里的「新建空白画布」（用户点名要的那颗按钮）——
           走的就是顶栏「新建画布」同一条链路（就地清空成空白画布）。 */
        onNewBlank={() => { setWorkflowGalleryOpen(false); void handleNew(); }}
      />

      <style>{`
        @keyframes skeletonShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
      `}</style>
    </div>
  );
}
