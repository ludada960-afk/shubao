import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IMAGE_MODELS, SELECTABLE_IMAGE_MODELS, imageModelLabel, imageModelResolutions, DEFAULT_IMAGE_MODEL } from '../../../services/imageModelCatalog.js';
import WatermarkLayer from './WatermarkLayer.jsx';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  BookmarkPlus,
  Bold,
  Captions,
  Check,
  Clapperboard,
  Copy,
  Crop,
  Download,
  Eraser,
  FileText,
  FileVideo,
  Film,
  FolderInput,
  LibraryBig,
  AudioLines,
  FolderOpen,
  Grid2X2,
  ImagePlay,
  ImagePlus,
  ImageUp,
  Images,
  Info,
  Italic,
  Layers3,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  MessageSquareText,
  Mic,
  Move,
  Pencil,
  Plus,
  Redo2,
  RefreshCw,
  ScanText,
  Scissors,
  Square,
  Sparkles,
  Trash2,
  Type,
  SlidersHorizontal,
  Ungroup,
  Undo2,
  WandSparkles,
  Volume2,
  X,
  ArrowUpRight,
  ChevronDown,
  Music,
  Wand2,
  ListChecks,
} from 'lucide-react';
import ResponsiveImage from '../../../components/ResponsiveImage.jsx';
import ModelLogo from '../../../components/ModelLogo.jsx';
import { IMAGE_PROMPT_LIMIT, TEXT_PROMPT_LIMIT, VIDEO_PROMPT_LIMIT, PROMPT_MAX_ROWS, PROMPT_MIN_ROWS, promptFieldCssVars, promptLimitNotice } from '../../../constants/promptLimits.js';
/* 2026-09-17 统一视觉语言：拉伸几何与首页共用同一套规范与纯函数，不另发明 */
import { TEXTAREA_RESIZE, resolveResizedHeight } from '../../Home/ec/panelVisualLanguage.js';
import { brandLogo, imageModelLogo, videoProductLogo } from '../../../services/modelLogos.js';
import ImageMentionPicker from '../../../components/creation/ImageMentionPicker.jsx';
import MentionPromptField from '../../../components/creation/MentionPromptField.jsx';
import SizingPanel from '../../Home/ec/SizingPanel.jsx';
import SkuPanel from '../../Home/ec/SkuPanel.jsx';
/* 2026-09-27 批 CU：ParamsPanel / CopyPanel / GenerationConstraintsPanel 三个 import 随
   「商品信息」「内容规范(AI规划)」两颗按钮一起**删掉**（用户原话：「这些东西可以不要了，你就直接拿掉吧」）——
   它们原本只挂在 `.slice(0,2)` 那一支里、而那支的 item.key 永远命中不了 params/copy，
   等于三个面板从没在画布上打开过。首页 EcMode.jsx 仍在用它们，画布侧不再需要。 */
import GenSettingsPanel from '../../Home/ec/GenSettingsPanel.jsx';
import { createSmartConfiguration, deriveEffectiveSmartOverrides, summarizeCommerceConfiguration } from '../../Home/ec/workbenchState.js';
import { ADAPTIVE_RATIO, withAdaptiveRatioOption } from '../canvasAdaptiveRatio.js';
import { CANVAS_COUNT_OPTIONS, CANVAS_RATIO_OPTIONS, CANVAS_RESOLUTION_OPTIONS, CANVAS_SKILLS, applyCanvasSkill, canvasGenerationBoxHasResult, filterCanvasSkills, closeCanvasComposerSurface, getCanvasNodePresentation, getGridGuidePositions, moveGridGuide, toggleCanvasComposerSurface } from '../canvasStudioModel.js';
import { canvasGroupKindOf, canvasSelectionGroupState, getCanvasToolbarPosition, multiSelectionActionsForNodes, selectedCanvasBounds } from '../canvasInteractionModel.js';
import { createCanvasAnnotation, normalizeCanvasCropRect, normalizeCanvasPoint, updateCanvasAnnotation } from '../canvasInlineEditorModel.js';
import { buildCanvasSuitePlan } from '../canvasSuitePlanModel.js';
import { buildImageMentions } from '../../../components/creation/imageMentionModel.js';
import EcommerceDesignPlanEditor, { EcommerceDesignPlanPreview } from '../../Home/ec/EcommerceDesignPlanEditor.jsx';
import { normalizeCommerceContext } from '../../Home/ec/internationalCommerceRegistry.js';
import { VIDEO_CREATION_MODES, hasRequiredVideoInputs, snapVideoDuration, videoDurationChoices } from '../../VideoStudio/videoStudioModel.js';
/* 画布弹层定位的**单一真源**（2026-09-20 用户口径）：锚触发元素向右展开、放不下向下、绝不向左翻。 */
import { resolveAnchoredRight, CANVAS_Z } from '../canvasVisualLanguage.js';
import { buildVideoPlan } from '../../VideoStudio/videoPlanModel.js';
import { CANVAS_PLAN_ANALYSIS_POINTS, estimateImageComposerPoints, estimateSuiteComposerPoints, estimateTextComposerPoints, estimateVideoComposerPoints, formatCanvasPoints } from '../canvasPointsEstimate.js';

const ACTION_ICONS = {
  'add-text': Type,
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
  /* 9-15 用户批注：「加入资产库」不能是 AI 魔法棒图标 —— 换成语义明确的入库图标
     （BookmarkPlus = 收藏进入资产库），点过后高亮表示已在资产库（is-active 态已有）。 */
  'save-to-assets': BookmarkPlus,
};

/* Panel entrance gate: each floating-panel family plays its ecPanelIn spring
   once per page load; remounts (tab round-trips, selection churn) are stamped
   data-mounted in the ref callback (commit phase, pre-paint), so the intro
   never replays and the icons never flicker back in. */
const PANEL_INTRO_PLAYED = new Set();

function usePanelIntroGate(name) {
  const gateRef = useRef(null);
  if (!gateRef.current) {
    gateRef.current = element => {
      if (!element) return;
      if (PANEL_INTRO_PLAYED.has(name)) element.setAttribute('data-mounted', '');
      else PANEL_INTRO_PLAYED.add(name);
    };
  }
  return gateRef.current;
}

/* 「添加资源」分组的成员（本地上传 / 作品 / 资产库），其余归入「用 AI 生成」 */
const RESOURCE_ACTION_IDS = new Set(['upload', 'upload-video', 'upload-audio', 'works', 'asset-library']);
/* 「应用」组：把画布已有的派生能力提到一级入口（9-12 用户批注：照竞品补「应用」分类） */
/* 只保留真正独立的应用能力；「一键套图 / 一键成片」与「生成电商套图 / 生成视频」重复，
   9-13 用户批注「下面为什么还做一个啊，完全冲突啊」→ 从菜单撤掉，避免同屏两个同义入口 */
const APPLICATION_ACTION_IDS = new Set(['application-tts', 'application-caption']);

const ADD_ACTIONS = [
  { id: 'upload', label: '上传图片', description: '加入自己的商品图或参考图', icon: ImageUp },
  { id: 'upload-video', label: '上传视频', description: '加入已有成片或参考视频', icon: FileVideo },
  /* 9-13 用户批注：上面都是「上传 X」，这里却写「添加音频」，而且排在菜单最下面 ——
     改成「上传音频」并**紧跟在上传视频下面**（同类动作排在一起）。 */
  { id: 'upload-audio', label: '上传音频', description: '加入配音、旁白或背景音乐', icon: Music },
  { id: 'works', label: '从作品导入', description: '使用已生成的作品继续创作', icon: FolderInput },
  /* 9-12 用户批注：加「从资产库选择」——资产库的素材必须能放到画布上 */
  { id: 'asset-library', label: '从资产库选择', description: '把资产库里的素材直接放到画布', icon: LibraryBig },
  { id: 'application-tts', label: '语音合成', description: '把文案变成可用的配音音轨', icon: AudioLines },
  { id: 'application-caption', label: '智能字幕', description: '为视频自动生成并烧录字幕', icon: Captions },

  { id: 'image', label: '生成图片', description: '用提示词或引用素材创建新图片', icon: Sparkles },
  { id: 'text-generation', label: '生成文案', description: '结合提示词和参考图生成可编辑文案', icon: MessageSquareText },
  { id: 'ecommerce', label: '生成电商套图', description: '从商品素材创建完整套图', icon: WandSparkles },
  { id: 'video', label: '生成视频', description: '用提示词、图片或视频创建营销成片', icon: ImagePlay },
  /* ═══ 2026-09-28 批 CX（CV-1）：**「按技能开始」** ═══════════════════════════════════════════════
     docs/design/89 §5 第 1 步"一份声明三处复用"的第一处落地：同一条技能声明（`src/skills/*.js`）
     现在只在**子页面工作台**里能选，画布上得"先建生成框、再点技能按钮"两步。
     用户对画布的定位是工作流生产地（原话：「画布可能最终要走向像知渔AI他们那样……
     把各种各样的工作流**集合成模板**」）⇒ "我要做爆款复刻"应该能**一步**落到画布上。
     行为：关菜单 → 开技能库（与首页/视频页同一个 modal）→ 选中后建出带这条技能的节点
     （技能正文预填进提示词、`skill`/`skillLabel` 记名）。
     ⚠️ **建节点 0 收费**：跑生成仍走原来的"报价 → 用户确认 → 扣费"链路，这里不碰钱。 */
  { id: 'by-skill', label: '按技能开始', description: '从全部技能里挑一条，直接建一个带它的节点', icon: ListChecks },
  /* 9-06 恢复: 用户确认左侧 + 是"无素材起点"的完整创作菜单, 应包含全部生成入口;
     与派生菜单不冲突 — 派生带源素材引用, 这里是全新创建 */
];

// 宫格行列各自可独立选择的档位（与服务端 GRID 上界一致）。
const GRID_DIMENSION_CHOICES = [1, 2, 3, 4, 5, 6, 7, 8];

const LABELED_TOOLBAR_ACTIONS = new Set([
  'edit-text',
  'grid-split',
  'layer-edit',
  'remove-background',
  'move-scale',
  'reverse-prompt',
  'annotation',
]);

export function isCompactCanvasToolbarAction(actionId) {
  return !LABELED_TOOLBAR_ACTIONS.has(actionId);
}

export function CanvasAddMenu({ open, onClose, onSelect, position = {} }) {
  const introGateRef = usePanelIntroGate('add-menu');
  if (!open) return null;
  /* 9-12 用户批注：左侧「+」菜单要像竞品一样分两组 ——
     「添加资源」（本地上传 / 作品 / 资产库）与「添加节点」（用提示词生成各类内容）。 */
  const resourceActions = ADD_ACTIONS.filter(item => RESOURCE_ACTION_IDS.has(item.id));
  const applicationActions = ADD_ACTIONS.filter(item => APPLICATION_ACTION_IDS.has(item.id));
  const nodeActions = ADD_ACTIONS.filter(item => !RESOURCE_ACTION_IDS.has(item.id) && !APPLICATION_ACTION_IDS.has(item.id));
  const renderItem = item => <button key={item.id} type="button" role="menuitem" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onSelect?.(item.id); }}>
    <span><item.icon /></span>
    <span><strong>{item.label}</strong><small>{item.description}</small></span>
  </button>;
  return <div ref={introGateRef} className="ec-canvas-add-menu" style={position} role="menu" aria-label="添加节点">
    <div className="ec-canvas-menu-heading"><strong>添加节点</strong><button type="button" aria-label="关闭添加菜单" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onClose?.(); }}><X size={15} /></button></div>
    {resourceActions.length > 0 && <div className="ec-canvas-menu-group" role="group" aria-label="添加资源">
      <span className="ec-canvas-menu-group-title">添加资源</span>
      {resourceActions.map(renderItem)}
    </div>}
    {nodeActions.length > 0 && <div className="ec-canvas-menu-group" role="group" aria-label="添加节点入口">
      <span className="ec-canvas-menu-group-title">用 AI 生成</span>
      {nodeActions.map(renderItem)}
    </div>}
    {applicationActions.length > 0 && <div className="ec-canvas-menu-group" role="group" aria-label="应用">
      <span className="ec-canvas-menu-group-title">应用</span>
      {applicationActions.map(renderItem)}
    </div>}
  </div>;
}

export function CanvasObjectToolbar({ node, actions = [], viewport, bounds, onAction, videoDelivery = null }) {
  const introGateRef = usePanelIntroGate('object-toolbar');
  const toolbarRef = useRef(null);
  /* 用实测渲染宽度定位: 估算宽度偏小时 clamp 会把工具栏推出屏幕右缘,
     表现为"工具栏歪掉、不吸附居中" (用户 9-04 反馈)。测量后二次渲染收敛。

     ═══ 批 CY-㉔ 的一处**自我更正**（记下来免得下一个人跟着我错的方向走）═══════
     我第一反应是这里 `getBoundingClientRect().width` 量错了单位（以为拿到的是
     被祖先 scale 乘过的屏幕像素），于是改成了 `offsetWidth`。**那是错的** ——
     工具条自己带 `scale(var(--canvas-overlay-scale))` = `scale(1/s)`，
     与祖先的 `scale(s)` **两级抵消**，所以 `getBoundingClientRect().width` 与
     `offsetWidth` 在这里**数值相等**，改与不改一个样。

     真正的 bug 在 `getCanvasToolbarPosition`（canvasInteractionModel.js:250）：
     那里**高度除了 scale、宽度没除**。详见那里的注释。
     这里保留 `offsetWidth` 只是因为它不依赖 transform 语义、意图更直白，
     并**不**是这次修复的功劳。 */
  const [measuredWidth, setMeasuredWidth] = useState(0);
  useLayoutEffect(() => {
    const el = toolbarRef.current;
    if (!el) return undefined;
    const width = Math.round(el.offsetWidth);
    if (width > 0 && width !== measuredWidth) setMeasuredWidth(width);
    return undefined;
  }, [actions, measuredWidth, videoDelivery]);
  if (!node || !actions.length) return null;
  // P2 跨域投递：选中套图产物/节点 → 「发往视频项目」（唯一注入点，逻辑由 index 提供）。
  const delivery = videoDelivery && typeof videoDelivery.onSend === 'function' && videoDelivery.enabled !== false
    ? videoDelivery
    : null;
  /* 批 CY-㉔：估算式也一起修。原来按 `label.length * 13` 一刀切，
     可中文标签在 12px 字号下**一个字就接近 13px 宽**（不是「一个字符 13px」那么简单，
     拉丁字母只有 ~7px）。于是中文按钮被**系统性低估**约 10px/个 ——
     首帧（实测宽度回来之前）就偏窄，位置也就跟着偏。
     ⇒ 改成按字符实际宽度累加（中日韩全角 13、其余 7.5），宁可估大不估小。
     useLayoutEffect 会在首帧绘制前把精确值补上，所以这个估算只负责「别在第一眼就错」。 */
  const labelWidth = label => [...String(label || '')]
    .reduce((sum, ch) => sum + (/[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(ch) ? 13 : 7.5), 0);
  const estimatedWidth = measuredWidth || Math.min(820, 18 + actions.reduce((width, action) => (
    width + (isCompactCanvasToolbarAction(action.id) ? 38 : Math.max(72, labelWidth(action.label) + 42))
  ), 0) + (delivery ? 116 : 0));
  return <div
    ref={element => {
      toolbarRef.current = element;
      introGateRef.current = element;
    }}
    className="ec-canvas-object-toolbar"
    role="toolbar"
    aria-label={`${node.name || node.displayLabel || '对象'}工具`}
    style={getCanvasToolbarPosition({ node, viewport, bounds, width: estimatedWidth, height: 48 })}
    onPointerDown={event => {
      // 同文本工具栏: 点按钮不抢编辑框焦点
      if (event.target?.closest?.('button')) event.preventDefault();
      event.stopPropagation();
    }}
  >
    {actions.map(action => {
      const Icon = ACTION_ICONS[action.id] || WandSparkles;
      const compact = isCompactCanvasToolbarAction(action.id);
      const isDisabled = Boolean(action.disabled);
      /* 9-12 用户批注：点过「加入资产库」之后按钮要**高亮**，一眼看出这个节点已经是资产了。
         判断依据是节点已挂上项目资产引用（assetRef / projectAssetId）。 */
      const alreadyAsset = action.id === 'save-to-assets'
        && Boolean(node?.assetRef || node?.projectAssetId || node?.projectAssetRef);
      /* 9-12 用户批注：文案要说清「再点一次会移除」，否则用户不知道能不能取消 */
      const label = alreadyAsset ? '已在资产库 · 点击移除' : action.label;
      return <button
        key={action.id}
        type="button"
        className={[compact ? 'is-compact' : '', alreadyAsset ? 'is-active' : ''].filter(Boolean).join(' ')}
        data-added-to-assets={alreadyAsset ? 'true' : undefined}
        aria-pressed={action.id === 'save-to-assets' ? alreadyAsset : undefined}
        aria-label={label}
        aria-disabled={isDisabled || undefined}
        title={isDisabled ? (action.disabledHint || '暂时不可用') : (alreadyAsset ? '这个素材已在资产库中，再点一次即可移除' : (action.description || action.label))}
        disabled={isDisabled}
        onPointerDown={event => event.stopPropagation()}
        onClick={() => { if (!isDisabled) onAction?.(action, node); }}
      >
        <Icon size={16} />
        {!compact && <span>{label}</span>}
      </button>;
    })}
    {delivery && <button type="button" data-video-delivery="true" aria-label="发往视频项目" title={delivery.hint || '把该素材发往视频项目，可绑为镜头首帧'} onPointerDown={event => event.stopPropagation()} onClick={() => delivery.onSend?.(node)}>
      <Clapperboard size={16} /><span>发往视频项目</span>
    </button>}
  </div>;
}

/* 9 个动作图标 (5 原有 + 4 流影AI LibTV Agent 风格, 用户硬性指定).
   4 个流影AI 新增: one-click-suite (5 宫格) / one-click-video (胶片) / tts-voiceover (话筒) / caption-motion (字幕).
   选 icon: 跟流影AI LibTV Agent / TapNow 调研一致 — 动词型 chip, 圆形/方形几何平衡. */
const DERIVE_ICONS = Object.freeze({
  /* 5 原有 (用户硬性要求保留) */
  'text-generation': MessageSquareText,
  'image-edit': Sparkles,
  'ecommerce-suite': WandSparkles,
  'video-upload': FileVideo,
  'video-generation': ImagePlay,
  /* 音频与字幕 (仅视频节点, 用户 9-04 反馈后重构) */
  'application-tts': Mic,            /* TTS 配音: 话筒 */
  'application-caption': Captions,   /* 字幕动效: 字幕 */
});

/* 14-action grid derive menu (4c183cd4 续命 深度重构)
   资深美工视角: 3 列 grid 平衡感, 卡片圆角一致, hover lift + shadow + 边框颜色变化
   产品经理视角: group 标签 (核心/智能/扩展) 视觉分组, 避免一长串无层级
   流影AI 调研: LibTV Agent 风格 — 每个 action = 1 个可点卡片, 不堆文字
   毛玻璃 backdrop-filter, 暗色模式 token 化 */
/* ═══ 2026-09-20 用户批注：「面板依然是歪到左边去，然后依然是盖住了我们现在的素材」═══
   根因（Playwright 实测，1440 缩放 0.68，点节点右侧「+」）：
     · 本组件渲染在**缩放层内部**（祖先 transform = matrix(.68,0,0,.68,497.64,24.4)），
       left/top 因此是**世界坐标**；
     · 而 clampCanvasPickerPosition 里 bounds.width / reservedRight 是**像素**口径，
       却被除以 scale 当世界坐标用 —— 两套坐标系混用；
     · 右侧面板一开（reservedRight>0），可用宽度被砍到 ~197px，maxX 塌到锚点**左边极远处**，
       实测 left=-717（世界）= **屏幕 x=10**，而触发按钮在 x=683 → 面板被甩到最左并被裁掉半截。
   修法：**不再自算世界坐标**，改走画布唯一权威 CanvasPopoverPortal
   （portal 到 body + 视口像素定位 + place='right' 锚在触发元素向右展开）。
   这样坐标系只剩一套（视口 px），面板左缘恒在触发元素右侧 → 不可能盖住源素材。 */
export function CanvasDeriveMenu({ actions = [], anchorRect = null, title = '引用当前素材生成', onBack, onClose, onSelect }) {
  /* introGateRef 本身是 ref 回调（内部自带 effect），直接挂到元素上即可 ——
     这里不要额外套 useLayoutEffect：SSR 下会触发 React 的
     "useLayoutEffect does nothing on the server" 警告（本仓 canvas-debug 的 SSR 用例把它当失败）。 */
  const introGateRef = usePanelIntroGate('derive-menu');
  const menuRootRef = useRef(null);
  /* 按 group 分桶渲染: core 先 (5 原有), audio 后 (视频节点专属的音频与字幕).
     用户 9-04 反馈: 竞品名不能出现在用户界面 → bucket label 用功能描述;
     与 core 重复的 1-click 项已移除, 不再走"5+4 全堆一锅"的旧结构。 */
  const groups = [
    { id: 'core', label: '核心常用' },
    { id: 'audio', label: '音频与字幕' },
  ];
  const bucketMap = actions.reduce((acc, action) => {
    const group = action.group || 'core';
    if (!acc[group]) acc[group] = [];
    acc[group].push(action);
    return acc;
  }, {});
  /* 面板主体：内容与定位解耦，供 portal / SSR 两条路径复用。 */
  const menuBody = <>
    <div ref={menuRootRef} className="ec-canvas-derive-inner">
    <div className="ec-canvas-menu-heading">
      <span>{onBack && <button type="button" aria-label="返回创作类型" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onBack?.(); }}><ArrowLeft size={14} /></button>}{title}<small className="ec-canvas-derive-count">{actions.length} 项</small></span>
      <button type="button" aria-label="关闭派生菜单" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onClose?.(); }}><X size={15} /></button>
    </div>
    <div className="ec-canvas-derive-scroll">
      {groups.map(group => {
        const bucket = bucketMap[group.id];
        if (!bucket || !bucket.length) return null;
        return <div key={group.id} className={`ec-canvas-derive-bucket is-${group.id}`} role="group" aria-label={group.label}>
          {/* 批 CY-㊴（2026-10-01）：**去掉这一层的分组标题**。
             用户原话：「你上面已经有一个标题了呀，下面为什么还要加这个核心常用这四个字呢？
               干嘛要搞两个标题呀？我觉得没有必要呀。下面这个标题就不要了。」
             面板头已经有「引用当前素材生成 · N 项」+ aria-label 说明了分组含义，
             再来一个「核心常用」纯属重复。aria-label 保留（读屏仍能知道分组）。 */}
          <div className="ec-canvas-derive-grid">
            {bucket.map(action => {
              const Icon = DERIVE_ICONS[action.id] || Sparkles;
              const priceBadge = action.priceLabel && action.priceLabel !== '免费' ? action.priceLabel : '';
              return <button key={action.id} type="button" role="menuitem" data-derive-action={action.id} className="ec-canvas-derive-tile" title={action.description} onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onSelect?.(action); }}>
                <span className="ec-canvas-derive-chip"><Icon /></span>
                {/* ⚠️⚠️ 2026-10-01 用户批注：「什么情况啊，你为什么还是把这些暴露出来啊，
                    不是说鼠标放上去按钮再显示提示文案吗，你现在怎么还乱码了呀」
                    —— 这条注释原来写的是**裸的**斜杠星号。JSX 里那不是注释，
                    它被当成**文本子节点**渲染出来，于是整段内部批注变成了卡片上显示的文案，
                    看上去就是"乱码"。必须写成花括号包起来的形式。
                    门禁 `jsx-bare-comment-1001` 用 esbuild 扫 src 下全部 jsx：
                    它把「裸注释会变成字符串子节点」这件事变成可判定的，不再靠肉眼。

                    ⚠️ 描述**怎么藏**是批 CY-㊴ 的决定（保留 `<small aria-hidden>`、
                    由 CSS `display:none` 收起），门禁 canvas-right-panel-hint-1001 钉着它。
                    我第一版把 `<small>` 直接删了，那会让那条门禁变红 —— 已改回他们的做法：
                    元素留着（读屏仍拿得到）、界面上不显示、完整句子走 hover 的 `title`。 */}
                {/* 批 CY-㊴：描述默认不直接显示（两行截断读不全），hover 用原生提示给完整句子。
                   整条描述进 title，键盘/读屏也能拿到 —— 之前它是纯视觉的。 */}
                <span className="ec-canvas-derive-copy" title={action.description}><strong>{action.label}</strong><small aria-hidden="true">{action.description}</small></span>
                <span className="ec-canvas-derive-meta">{priceBadge ? <em>{priceBadge}</em> : null}<ArrowUpRight size={14} /></span>
              </button>;
            })}
          </div>
        </div>;
      })}
    </div>
    </div>
  </>;
  /* 走唯一权威：portal 到 body + 视口像素定位 + 锚在触发元素向右展开。
     面板左缘 = 触发元素右缘 + 12px，因此**不可能盖住触发元素所属的素材**；
     右侧空间不足时只向下移，绝不向左翻（place='right' 的口径）。
     SSR（无 document）时 portal 无处可挂，改为**内联渲染主体**：
     定位交给调用方/CSS，内容照常输出 —— 这样服务端与静态用例仍能拿到完整标记。 */
  if (typeof document === 'undefined' || !document.body) {
    return <div className="ec-canvas-derive-menu" role="menu" aria-label="从当前素材继续创作">{menuBody}</div>;
  }
  return <CanvasPopoverPortal open anchor={anchorRect} place="right" className="ec-canvas-derive-menu" label="从当前素材继续创作">{menuBody}</CanvasPopoverPortal>;
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
  return <div className="ec-canvas-text-toolbar" role="toolbar" aria-label="文本样式" style={getCanvasToolbarPosition({ node, viewport, bounds, width: 600, height: 48 })}
    onPointerDown={event => {
      // 编辑文字时点工具栏: preventDefault 阻止按钮抢焦点, 保住编辑框光标不退出
      if (event.target?.closest?.('button')) event.preventDefault();
      event.stopPropagation();
    }}
  >
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
  'stitch-details': Layers3,
  'delete-selection': Trash2,
};

export function CanvasMultiSelectionToolbar({ nodes = [], selectedIds = new Set(), viewport, bounds: containerBounds, onAction }) {
  const introGateRef = usePanelIntroGate('multi-toolbar');
  const bounds = selectedCanvasBounds(nodes, selectedIds);
  const count = selectedIds instanceof Set ? selectedIds.size : (selectedIds || []).length;
  if (!bounds || count < 2) return null;
  const actions = multiSelectionActionsForNodes(nodes, selectedIds);
  /* 9-16 用户批注（图15~19）：「按钮不高亮」—— 已打组/已绑定时对应按钮要高亮，
     并且按钮文字/aria 变成「解除…」，再点一次就是解除（同一个按钮，不额外加一个入口）。 */
  const groupState = canvasSelectionGroupState(nodes, selectedIds);
  const estimatedWidth = 76 + actions.reduce((total, action) => total + Math.max(56, action.label.length * 12 + 34), 0);
  return <div ref={introGateRef} className="ec-canvas-multi-toolbar" role="toolbar" aria-label={`${count} 个对象操作`} style={getCanvasToolbarPosition({ node: bounds, viewport, bounds: containerBounds, width: estimatedWidth, height: 42 })}>
    <strong>{count} 个已选中</strong>
    {actions.map(action => {
      const Icon = MULTI_ICONS[action.id] || WandSparkles;
      const applied = (action.id === 'group-elements' && groupState.kind === 'group')
        || (action.id === 'bind-elements' && groupState.kind === 'bind');
      const label = applied ? (action.id === 'group-elements' ? '解除打组' : '解除绑定') : action.label;
      return <button key={action.id} type="button" className={`is-compact ${applied ? 'is-applied' : ''} ${action.id === 'delete-selection' ? 'is-danger' : ''}`} aria-label={label} aria-pressed={applied || undefined} title={label} onPointerDown={event => event.stopPropagation()} onClick={() => onAction?.(action.id)}><Icon size={15} /><span>{label}</span></button>;
    })}
  </div>;
}

function ComposerSources({ sources = [], role, onAddSources, onRemoveSource, uploadLabel = '上传图片', accept = 'image/*' }) {
  const normalizedSources = sources.map(source => ({ ...source, role: role || source.role }));
  const imageNames = new Map(buildImageMentions(normalizedSources.filter(source => !['video', 'audio'].includes(source.kind))).map(source => [source.sourceNodeId || source.id || source.url, source.name]));
  return <div className="ec-canvas-composer-sources" aria-label={`已引用 ${sources.length} 个素材`}>
    {normalizedSources.slice(0, 8).map((source, index) => {
      const sourceId = source.sourceNodeId || source.id || source.url || index;
      const sourceName = imageNames.get(sourceId) || source.name || source.displayLabel || (source.kind === 'video' ? '参考视频' : '参考素材');
      return <span className="ec-canvas-composer-source" key={sourceId} data-source-id={sourceId}>
      {source.kind === 'video'
        ? <div className="ec-canvas-composer-source-preview is-video"><video src={source.url} muted playsInline preload="metadata" /></div>
        : source.kind === 'audio'
          ? <div className="ec-canvas-composer-source-preview is-audio"><Volume2 size={20} /><span>音频</span></div>
        : <ResponsiveImage
          src={source.url}
          alt={sourceName}
          variant="canvas"
          ratio={source.ratio || '1:1'}
          sizes="64px"
          style={{ width: '100%', height: '100%' }}
          imgStyle={{ objectFit: 'contain' }}
        />}
      <b>{sourceName}</b>
      {onRemoveSource && <button type="button" data-canvas-control="true" aria-label={`移除${sourceName}`} onClick={event => { event.stopPropagation(); onRemoveSource(source.sourceNodeId || source.id); }}><X size={11} /></button>}
    </span>;
    })}
    {onAddSources && <label className="ec-canvas-composer-source-add" aria-label={`添加${uploadLabel}`} title={`添加${uploadLabel}`}>
      <span className="ec-canvas-composer-source-add-icon"><ImagePlus size={20} /></span><small>{uploadLabel}</small><input type="file" accept={accept} multiple hidden onChange={event => { onAddSources([...event.target.files]); event.target.value = ''; }} />
    </label>}
  </div>;
}

function ComposerMention({ availableSources = [], selectedSources = [], activeSurface = '', onSurfaceChange, onToggleSource }) {
  /* 9-12 用户批注：@ 选完没进输入框。根因——参考图已选中时，点 @ 列表里的它会走「取消选中」分支，
     既不插入 @提及 还把参考图删了。@ 菜单的语义应是「插入提及」（未选中则同时选中），绝不在此处取消选中。 */
  return <div className="ec-canvas-composer-mention" aria-label="引用图片"><ImageMentionPicker images={availableSources} selectedImages={selectedSources} open={activeSurface === 'mention'} onOpenChange={open => onSurfaceChange?.(open ? 'mention' : closeCanvasComposerSurface())} selectionMode="insert" onToggle={image => onToggleSource?.(image, { fromMention: true })} /></div>;
}


/* 9-17 用户批注（图6）：「我现在选择模型，它直接就不张开了」——**这是真 bug，不是样式问题**。
   实测根因（Playwright 逐层取证）：模型面板一直有渲染，getBoundingClientRect 也正常（171×332 @ 293,440），
   但把它所在链条上四个祖先的 overflow 依次改成 visible 之后，同一个像素点上
   elementFromPoint 立刻从 .ec-canvas-stage 变成 .ec-canvas-parameter-popover ——
   即面板被祖先的 overflow:hidden 物理裁掉了：
     .ec-canvas-parameter-controls（9-16 为「参数行不撑破底栏」加的 overflow:hidden）
     .ec-canvas-context-composer（9-16 加的 overflow:hidden）
     .ec-canvas-stage（画布自身 overflow:clip）
     .ec-canvas-page（整页 overflow:hidden）
   面板是「往上弹」的（bottom:100%），而生成框底栏贴着画布下沿 —— 弹出区整块落在裁剪框之外，
   于是用户看到的就是「点了没反应」。任何继续调 z-index / transform 的改法都不可能修好它。
   正解：面板必须**脱离裁剪上下文**——createPortal 到 body，再用锚点按钮的视口坐标定位。
   定位口径不变（仍是「水平居中于按钮正上方」，虚线口径：中心偏差 0px），
   外加视口内回夹（贴边时推回可视区，顶部放不下就翻到按钮下方）。
   四个框的模型/比例/清晰度/张数/技能/套图面板共用这一对 hook。 */
export function useCanvasPopoverAnchor(openKey = '') {
  const anchorRef = useRef(null);
  const [anchor, setAnchor] = useState(null);
  useLayoutEffect(() => {
    if (!openKey) return undefined;
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setAnchor(previous => (previous && Math.abs(previous.x - rect.left) < 0.5 && Math.abs(previous.y - rect.top) < 0.5 && Math.abs(previous.width - rect.width) < 0.5)
        ? previous
        : { x: rect.left, y: rect.top, width: rect.width, bottom: rect.bottom });
    };
    place();
    window.addEventListener('resize', place);
    /* ═══ 批 CY-⑭：**锚点必须跟着素材走**（用户 2026-09-28 原话，逐字）══════════════════════════════
       「而且现在他们张开面板之后，我拖动我当前这块素材的话，你这个面板是没有跟着一起吸附在选项上面的。
         我不是说了很多遍了吗你的面板是必须要吸附在当前这个按钮的上面的。
         **不管用户怎么拖动素材，张开的面板都必须如影随形。**」
       改前这里只监听 `window.resize` —— 拖动画布 / 拖节点时锚点一动不动，
       面板留在原地、节点走远了它还挂在原处。
       ⇒ rAF 轮询：只要弹层开着就一直对齐。为什么用轮询而不是事件：触发源可能是
         拖拽（每帧变）、平移、缩放、节点高度自适应，共同点是「DOM 在动但没有任何
         我们能订阅的尺寸事件」—— `ResizeObserver` 只管尺寸不管位置。

       ⚠️⚠️ 批 DC 续-18 **一度把它删掉**，因为它看起来像"面板死死粘在节点上"。
         **那是误判，已撤回**：① 它服务的是**另一个**用户要求（2026-09-28 的"如影随形"），
         删掉会静默回退那条；② **画布平移是 pointer 驱动的，不是 `scroll` 事件** ——
         新的全局口径「滚一滚就关」根本不会因为拖动画布而触发，所以"删掉跟随就能自动关"
         这个推理**不成立**。
         真正的"粘住"是另一回事：滚轮/滚动现在会由 EcCanvas/index.jsx 那一次全局订阅
         （登记册 `scroll` 列）把面板**整个收掉**。两者不冲突。
         代价要说清：弹层开着时有一条 rAF 常驻，关闭时 effect return、随之停止
         —— 是"开着才有"的开销，不是常驻烧 CPU。 */
    let frame = 0;
    const follow = () => {
      place();
      frame = window.requestAnimationFrame(follow);
    };
    frame = window.requestAnimationFrame(follow);
    return () => {
      window.removeEventListener('resize', place);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [openKey]);
  return [anchorRef, anchor];
}

/* 面板本体：portal 到 body 之后，位置自己算（不再依赖祖先的包含块）。
   口径：水平中心 = 按钮水平中心；竖直 = 按钮上方 9px；视口上下都放不下时才翻到下方。 */
export function CanvasPopoverPortal({ open = false, anchor = null, className = '', label = '', place = 'above', children }) {
  const popoverRef = useRef(null);
  const [placement, setPlacement] = useState(null);
  useLayoutEffect(() => {
    if (!open || !anchor) { setPlacement(null); return undefined; }
    const node = popoverRef.current;
    const measure = () => {
      const box = node?.getBoundingClientRect();
      const width = Math.max(120, Math.round(box?.width || 200));
      const height = Math.max(40, Math.round(box?.height || 200));
      const gutter = 12;
      /* ── place='right'：画布弹层的**唯一权威口径**（2026-09-20 用户口径）─────
         用户原话：「面板依然是歪到左边去，然后依然是盖住了我们现在的素材」。
         约定（不可协商）：
           ① **锚在触发元素上向右展开**（左缘 = 锚点右缘 + 间距）；
           ② 右侧空间不足时**向下展开**（顶部下移），**绝不向左翻**；
           ③ 面板矩形与源节点矩形**零相交**；
           ④ 面板左缘恒在锚点右侧 → 天然不会盖住锚点所属的素材。
         为什么不用『水平居中于锚点』：居中会让面板左半盖回触发元素本身
         （派生面板宽 329 > 节点宽 163，必然压住）。 */
      if (place === 'right') {
        /* 单一真源：canvasVisualLanguage.resolveAnchoredRight（与图层面板等共用同一套规则）。 */
        const solved = resolveAnchoredRight({
          anchor, width, height, gap: 12, gutter,
          viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
        });
        setPlacement(previous => (previous && previous.left === solved.left && previous.top === solved.top && previous.width === width && previous.mode === 'right')
          ? previous
          : { left: solved.left, top: solved.top, width, mode: 'right', flipped: false });
        return;
      }
      const center = anchor.x + anchor.width / 2;
      const left = Math.min(Math.max(center - width / 2, gutter), Math.max(gutter, window.innerWidth - width - gutter));
      const anchorTop = anchor.y;
      const above = anchorTop - height - 9;
      const below = anchor.bottom + 9;
      const top = above >= gutter ? above : (below + height <= window.innerHeight - gutter ? below : Math.max(gutter, Math.min(above, window.innerHeight - height - gutter)));
      setPlacement(previous => (previous && previous.left === left && previous.top === top && previous.width === width && previous.mode !== 'right')
        ? previous
        : { left, top, width, mode: 'above', flipped: above < gutter });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    if (node) observer.observe(node);
    return () => observer.disconnect();
  }, [open, anchor]);
  if (!open || !anchor) return null;
  /* SSR 守卫：createPortal 需要一个真实的 document.body。
     无 document（服务端渲染 / 测试里 renderToString）时直接不渲染 —— 弹层本来就是纯客户端交互，
     服务端没有它的位置；这样 SSR 不会因为 portal 抛错（本仓 canvas-debug 有单独 SSR 用例）。 */
  const canPortal = typeof document !== 'undefined' && document.body;
  if (!canPortal) return null;
  /* ═══ 批 CY-⑭：z-index 回归 `CANVAS_Z` 权威（这里原来写死 **10004**）════════════════════════════════
     用户原话：「然后你这个生成过程的按钮因为之前有让你调整过它的高度。然后你好像就把他的层级给搞错了。
       现在我好像点击其他的有弹窗的功能……**只要有任意的弹窗功能，你这个按钮会一起跟着弹出来。
       就是其他的窗弹出来的话，它会跟着变成弹窗的那一层。会一起高亮起来。这个肯定是不对的。**」
     根因不在按钮本身：这段是 **inline style**，写在 style 属性里 —— 它**压过 EcCanvas.css 里
     任何一条 z-index 规则**，包括文件末尾那段专门用来收口 47 个历史裸值的 `CANVAS_Z` 权威块。
     于是每一个 portal 弹层都在 10004，而画布里最高的一层是 `modal: 71`。
     ⇒ 改成 `CANVAS_Z.popover`（40）。portal 到 body 之后它仍然高于画布内部所有层
       （画布内部最高是 composer 60 —— 见下），但**不再越权到模态之上**。
     ⚠️ 同时把 `composer(60)` 压回 `toolbar(50)` 之下需要另说：生成框里的参数弹层 portal 出去是 40，
       会在生成框（60）**之下**吗？不会 —— portal 元素挂在 body 下，不再受 `.ec-canvas-node-composer`
       的层叠上下文约束；40 与 60 只在**同为 body 直属**时才比较，而节点本身在 stage 内部、
       其 z-index 只在 stage 这个层叠上下文里生效。所以两套数字互不干扰，但**必须同源**，
       否则下次又会有人拿"实测能看见"当依据把数字再抬一次。 */
  const style = placement
    ? { position: 'fixed', left: placement.left, right: 'auto', bottom: 'auto', top: placement.top, transform: 'none', zIndex: CANVAS_Z.popover, maxHeight: `calc(100vh - ${Math.round(placement.top)}px - 12px)`, overflowY: 'auto' }
    : { position: 'fixed', left: 0, top: 0, visibility: 'hidden', zIndex: CANVAS_Z.popover };
  return createPortal(
    /* ⚠️ `data-overlay-root`（批 DC 续-18）：画布弹层**自身可滚**
       （上面 style 里的 `maxHeight: calc(100vh - …)` + `overflowY:auto`）。
       不打这个标记，用户在弹层里滚一下就把它自己关了。
       "关"本身由 EcCanvas/index.jsx 那一次全局订阅统一做（登记册 `scroll` 列，13 个浮层一次到位），
       这里只负责声明"我内部滚动不算"。 */
    <div ref={popoverRef} data-overlay-root="true" className={`ec-canvas-parameter-popover is-portaled${placement?.mode === 'right' ? ' is-anchored-right' : ''}${placement?.flipped ? ' is-flipped' : ''} ${className}`} style={style} role="menu" aria-label={label}>{children}</div>,
    document.body,
  );
}

/* 9-16 用户批注（图4/图5）：「这四个文字输入框本身不大，用户输入几千字要一直滑动」、
   「文字输入框右下角不是应该有一个可以拉动的按钮吗（resize 手柄），这样才一次性看全」、
   「拉完之后如果字还是超出，还是要有滚动条」。

   2026-09-17 对齐首页规范（用户：「同一维度必须同一套视觉语言」）：
   .mention-prompt-field 是 contentEditable，用不了首页 ResizableTextarea 的 <textarea>，
   所以这里保留自研手柄，但**几何口径完全复用首页的 TEXTAREA_RESIZE / resolveResizedHeight**：
     · 下限 = TEXTAREA_RESIZE.minHeight（72，≈4 行）
     · 上限 = min(TEXTAREA_RESIZE.maxHeight(320), 容器可视区剩余高度 - bottomSafeGap)
       —— 首页踩过的坑：上限若不减去容器剩余空间，一拉就顶出面板被 overflow 裁断；
     · 到顶后由输入框自身 overflow:auto 出滚动条，而不是被裁掉。
   四个生成框（图片 / 文案 / 视频 / 套图）全部走这个组件，保证口径一致。

   ── 2026-09-17 产品决定：拉伸高度**不记忆、不持久化** ──────────────────
   用户原话：「你为什么要记住他拖动的高度呢？用户是在输入太长的时候才会去拖。
   正常情况下他不需要每次打开都看到非常大的输入框。你一开始做小一些没问题，
   但要有可以拖动的功能。他在真正需要输入大片文字时觉得框小了才会去拖。
   所以没必要保存上一次拖动的高度。」
   → 因此这里刻意**只用组件内 useState**：不写 localStorage / sessionStorage，
     不写进节点数据，也不随面板重开复原。每次打开都是规范下限的「小」尺寸，
     用户需要时再拖；拖到上限后由输入框自身出滚动条。
     请勿"优化"成持久化 —— 那是被产品明确否掉的行为。 */
const CanvasPromptField = forwardRef(function CanvasPromptField({ maxLength = IMAGE_PROMPT_LIMIT, value = '', onResize, className = '', ...props }, ref) {
  const boxRef = useRef(null);
  const dragRef = useRef(null);
  const [height, setHeight] = useState(0);
  const [overflowing, setOverflowing] = useState(false);
  const styleVars = useMemo(() => promptFieldCssVars(), []);
  const textLength = String(value || '').length;
  const atLimit = maxLength > 0 && textLength >= maxLength;
  /* 上限同时受「规范上限」与「容器可视区剩余」约束（首页 resolveResizedHeight 同一口径）。
     2026-09-17 修 bug：这里的 available 原来写成
         siblingHeight = hostHeight - boxHeight; available = hostHeight - siblingHeight
     化简后 available ≡ boxHeight（输入框自己的当前高度），于是上限永远等于当前高度，
     **手柄按下去拖不动**（实测 69px 拖了 90px 仍是 69px）。正确口径是
     「容器里除输入框与留白之外，还剩下多少可以给输入框」——
     即 host 的可用高度减去输入框上下**其它**兄弟节点（参考区/底栏）与面板内边距。 */
  const readBounds = () => {
    const box = boxRef.current;
    const fallbackMin = TEXTAREA_RESIZE.minHeight;
    const fallbackMax = TEXTAREA_RESIZE.maxHeight;
    if (!box) return { min: fallbackMin, max: fallbackMax, available: NaN };
    const styles = getComputedStyle(box);
    const cssMin = Math.round(Number.parseFloat(styles.getPropertyValue('--ec-prompt-min-h')) || fallbackMin);
    const cssMax = Math.round(Number.parseFloat(styles.getPropertyValue('--ec-prompt-max-h')) || fallbackMax);
    const min = Math.max(fallbackMin, Math.min(cssMin, cssMax));
    const max = Math.max(min, Math.min(cssMax, Math.max(cssMax, fallbackMax)));
    /* 容器（生成框）能给输入框的最大高度。host 自身可能已接近视口上限（.ec-canvas-context-composer
       有 max-height: calc(100vh - 200px)），所以用「host 上限 − 其它内容占用」而不是当前 host 实高，
       否则输入框一长高、host 跟着长高，剩余量又会把上限拉回当前值 —— 同一个死循环。 */
    const host = box.closest('.ec-canvas-context-composer') || box.parentElement;
    let available = NaN;
    if (host) {
      const hostStyles = getComputedStyle(host);
      const declaredMax = Number.parseFloat(hostStyles.maxHeight);
      const hostMax = Number.isFinite(declaredMax) && declaredMax > 0
        ? Math.min(declaredMax, window.innerHeight)
        : Math.max(host.getBoundingClientRect().height, max);
      /* 除输入框之外的所有子元素 + 上下内边距 = 不可让出的高度 */
      const padding = (Number.parseFloat(hostStyles.paddingTop) || 0) + (Number.parseFloat(hostStyles.paddingBottom) || 0);
      const others = [...host.children]
        .filter(child => child !== box)
        .reduce((sum, child) => sum + child.getBoundingClientRect().height, 0);
      available = hostMax - padding - others - TEXTAREA_RESIZE.bottomSafeGap;
    }
    return { min, max, available };
  };
  const measureOverflow = () => {
    const field = boxRef.current?.querySelector('.mention-prompt-field');
    const next = Boolean(field) && field.scrollHeight > field.clientHeight + 1;
    setOverflowing(previous => (previous === next ? previous : next));
  };
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return undefined;
    const field = box.querySelector('.mention-prompt-field');
    const observer = new ResizeObserver(measureOverflow);
    observer.observe(box);
    if (field) observer.observe(field);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measureOverflow);
    observer.observe(box);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);
  const beginResize = event => {
    const box = boxRef.current;
    if (!box || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = readBounds();
    dragRef.current = {
      startY: event.clientY,
      startHeight: box.getBoundingClientRect().height,
      min: bounds.min,
      max: bounds.max,
      available: bounds.available,
    };
    setHeight(previous => (previous || Math.round(dragRef.current.startHeight)));
    const move = moveEvent => {
      const drag = dragRef.current;
      if (!drag) return;
      /* 与首页 ResizableTextarea 共用同一个纯函数：上限取
         min(配置上限, 容器可视区剩余)（首页踩过的「一拉就截断」根因）。 */
      setHeight(resolveResizedHeight({
        startHeight: drag.startHeight,
        deltaY: moveEvent.clientY - drag.startY,
        minHeight: drag.min,
        maxHeight: drag.max,
        available: drag.available,
      }));
    };
    const end = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.requestAnimationFrame(measureOverflow);
      onResize?.();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };
  return <div
    className="ec-canvas-prompt-resize"
    ref={boxRef}
    data-canvas-control="true"
    style={{ ...styleVars, ...(height ? { '--ec-prompt-height': `${height}px` } : {}) }}
    onPointerDown={event => event.stopPropagation()}
  >
    <MentionPromptField ref={ref} value={value} maxLength={maxLength} className={className} {...props} />
    {overflowing && atLimit && <span className="ec-canvas-prompt-overflow-hint" role="status">{promptLimitNotice(maxLength)}</span>}
    <button
      type="button"
      className="ec-canvas-prompt-resize-handle"
      data-canvas-control="true"
      aria-label={`调整输入框高度（${PROMPT_MIN_ROWS}-${PROMPT_MAX_ROWS} 行，超过后内部滚动）`}
      title={`拖动调整高度（${PROMPT_MIN_ROWS}-${PROMPT_MAX_ROWS} 行）`}
      onPointerDown={beginResize}
    />
  </div>;
});

/* 9-13 用户批注：四个生成框要**共用同一个技能入口**（点开同一套技能，最后一项进「技能管理」弹窗）。
   所以把「技能按钮 + 技能弹层」抽成一个组件，图片 / 文案 / 视频 / 套图四处都用它，不再各写一套。 */
function CanvasSkillControl({ node, onChange, activeSurface = '', onSurfaceChange, onOpenSkillLibrary = null, onOpenWorkbench = null, domain = 'image' }) {
  const open = activeSurface.startsWith('parameter:') ? activeSurface.slice('parameter:'.length) : '';
  /* 9-17（图6）：面板走 portal 脱离裁剪上下文；锚点口径仍是「水平居中于按钮正上方」 */
  const [skillAnchorRef, skillAnchor] = useCanvasPopoverAnchor(open === 'skill' ? 'skill' : '');
  const skills = filterCanvasSkills(domain);
  const activeLabel = node?.skillLabel || skills.find(item => item.slug === node?.skill)?.name || '未选择';
  return <div className="ec-canvas-parameter-item">
    {/* ═══ 批 CY-⑬：技能也换成**两行摘要**触发器 ══════════════════════════════════════════════════
        理由不是"顺手统一"，是它和模型/生成配置**在同一行**：
        27px 的单行小药丸夹在两颗 40px 触发器中间，整行基线会明显歪 —— 这正是用户 9-17 在视频面板
        批注过的那一类（「技能按钮没有和其它项同一套结构，于是它歪上去了、高低也和别人对不齐」，
        当时只对齐了结构、没换形制，这一批把形制也换掉）。
        值用 `activeLabel`（已选技能名），未选时显示「未选择」——不再拿「技能」二字当值，
        那会让标题和值一模一样，看着像没填。 */}
    <CanvasConfigTrigger
      surface="skill"
      title="技能"
      value={activeLabel}
      icon={<WandSparkles size={14} />}
      open={open === 'skill'}
      anchorRef={skillAnchorRef}
      onToggle={() => onSurfaceChange?.(toggleCanvasComposerSurface(activeSurface, 'parameter:skill'))}
      ariaLabel="技能"
    />
    <CanvasPopoverPortal open={open === 'skill'} anchor={skillAnchor} className="ec-canvas-skill-popover" label="技能选项">
      {skills.map(skill => <button key={skill.slug} type="button" className={skill.slug === node?.skill ? 'is-active' : ''} onClick={() => { const next = applyCanvasSkill({ prompt: node?.prompt || '', skill: skill.slug }); onChange?.({ prompt: next.prompt, skill: next.skill, skillLabel: next.skillLabel }); onSurfaceChange?.(closeCanvasComposerSurface()); }}>
        <strong>{skill.name}</strong><small>{skill.skillPrompt}</small>
      </button>)}
      {onOpenSkillLibrary && <button type="button" className="ec-canvas-skill-more" onClick={() => { onSurfaceChange?.(closeCanvasComposerSurface()); onOpenSkillLibrary(domain); }}>更多技能…<ChevronDown size={11} style={{ transform: 'rotate(90deg)' }} /></button>}
      {/* ═══ 2026-09-28 批 CY-⑨（CV-2 第 2 步）：**节点 → 子页面工作台** ══════════════════════════════
          用户已拍板入口位置＝**节点上**（docs/design/89 §7 第 3 条：竞品都是节点级、顶栏只留模板广场）。
          为什么放在「技能」这一格里：它表达的正是"这条技能 → 去它的完整工作台里继续编辑"，
          与「更多技能…/清除技能」同属这一格 ⇒ 不需要在参数行或顶栏再造一个新入口
          （用户历史上反复点过名：「一个页面只能有一个主入口」）。
          ⚠️ `onOpenWorkbench` 为 null ⇒ **不渲染**：解析不出子页面坐标的节点、以及视频技能都落在这一类
             （视频侧还没接 `creationLaunch` 落地链路 —— 见 canvasWorkbenchBridge.js 顶部那段）。 */}
      {onOpenWorkbench && <button type="button" className="ec-canvas-skill-workbench" onClick={() => { onSurfaceChange?.(closeCanvasComposerSurface()); onOpenWorkbench(); }}>在完整工作台里编辑<ArrowUpRight size={11} /></button>}
      {node?.skill && <button type="button" onClick={() => { onChange?.({ skill: null, skillLabel: null }); onSurfaceChange?.(closeCanvasComposerSurface()); }}>清除技能</button>}
    </CanvasPopoverPortal>
  </div>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   批 CY-⑬（2026-09-28）：画布参数行 = **模型 + 生成配置 + 技能** 三颗触发器
   ═══════════════════════════════════════════════════════════════════════════

   用户原话（逐字，图片批注第 2 条）：
   「然后你这几块按钮**明明可以合成一块按钮**啊。什么**尺寸，清晰度，数量**这些都是可以放在同一个
     **生成配置**里面去呀。你为什么没有把这些问题都考虑清楚呢？然后我说的只是其中一个部分，我觉得
     你应该**全局都要去查看一下**，肯定有很多这种生成面板，他们的配置这里都是存在同等问题的。
     你要全部去考虑明白，然后全部去重新规划，重新设计。」
   加上第 1 条（同一张图）：
   「如果名称太长的话，你后面就可以截断的，用户是不会在意的。但是你不能像这样**粗暴的去截断**呀……
     你现在其他的按钮，它后面不是有一个**箭头的符号**吗？那你这里为什么没有符号呢？还有就是**你为什么
     这个按钮做的这么的小呢**？它不是**模型选择按钮**吗？模型选择按钮不应该这么小呀。」

   ── 改造前的实测盘点（`.qa/cy13-param-row-audit.mjs`，1440 视口）────────────
     位置            现状                                                        判定
     首页图片/视频   2 颗**两行摘要**触发器（180×52，logo + 小标题 + 值 + 箭头）  ✅ 目标形态
     画布图片/文案   5 颗**单行** 27px 高小药丸：模型 90 / 比例 60 / 清晰度 44 /
                    数量 44 / 技能 71                                          ✗ 三颗参数散着
     画布视频        6 颗，其中 4 个是**原生 `<select>`**（22px 高、无箭头）        ✗ 与站内全不一样
     画布套图        智能套图 / SKU变体 / 技能 / 「GPT Image 2·2K」单行          ✗ 已有合并块但无标题
   ⇒ **首页那两颗就是用户早就拍过板的目标版式**（2026-07-19 批注 #5-① 原话：「一个是选模型的
     面板，另一个就是把这些**尺寸啊、数量啊、清晰度啊集合到同一个面板**里面的就可以了」），
     画布三个框都还没跟上 ⇒ 本批把画布对齐到首页，不新发明第三种形态。

   ── 两条不许破的老规矩（2026-09-17 用户批注，仍然有效）────────────────────
     · 槽位宽度**固定**，长文案只在槽内**向右裁切**，绝不写省略号、绝不换行、绝不缩字号；
     · 控件之间固定 8pt 间距，任何文案长度下整行不变形。
   本批的「两行摘要」正好让**摘要本身变短**（`2K · 1:1 · x2` 而不是三颗各写一遍），
   两件事一起成立。 */

/** 参数行触发器（两行摘要）—— 照首页 `.visual-config-trigger` 的形态：
 *  左侧图标/品牌标 + 中间「小标题 + 当前值」+ 右侧下拉箭头（张开时转 180°）。
 *  ⚠️ 值必须包在可收缩的元素里（min-width:0 + overflow:hidden）：否则名字一长，
 *     整颗按钮溢出、`overflow:hidden` 会把**右边的箭头一起裁掉**（CY-⑫ 用户点名的现象）。 */
function CanvasConfigTrigger({ title, value, icon = null, open = false, anchorRef, onToggle, ariaLabel, surface }) {
  return <button
    ref={anchorRef}
    type="button"
    data-canvas-control="true"
    data-canvas-config-trigger={surface || ''}
    aria-label={ariaLabel}
    aria-haspopup="menu"
    aria-expanded={open}
    className={'ec-canvas-config-trigger' + (open ? ' is-open' : '')}
    onClick={onToggle}
  >
    {icon ? <span className="ec-canvas-config-trigger-mark" aria-hidden="true">{icon}</span> : null}
    <span className="ec-canvas-config-trigger-copy"><small>{title}</small><strong>{value}</strong></span>
    <ChevronDown className="ec-canvas-config-trigger-chevron" size={12} aria-hidden="true" />
  </button>;
}

/* 视频侧「生成配置」的选项表 —— **值与改前那三个原生 `<select>` 逐字相同**，
   只是从系统下拉搬进了站内弹层（批 CY-⑬）。清晰度只有 720P 一档是上游契约，不许在这里加档。 */
const VIDEO_RESOLUTION_OPTIONS = Object.freeze(['720p']);
const VIDEO_ASPECT_OPTIONS = Object.freeze(['9:16', '16:9', '1:1', '4:3', '3:4', '21:9']);

/** 「生成配置」面板里的一组：标题 + 一行选项（照首页 VisualSpecsPanel 的分组写法）。 */
function CanvasConfigGroup({ title, children }) {
  return <section className="ec-canvas-config-group">
    <h4 className="ec-canvas-config-group-title">{title}</h4>
    {children}
  </section>;
}

/* 图片/文案框的「生成配置」：**分辨率 · 画面尺寸 · 生成数量** 三组收在这一块里。
   清晰度选项跟着模型能力走（Midjourney 上游只有 1K/2K）—— 与合并前那条契约完全一致。 */
function CanvasImageConfigPanel({ ratio, resolution, imageModel, count, countOptions, onRatio, onResolution, onCount, onClose }) {
  const resolutions = CANVAS_RESOLUTION_OPTIONS.filter(value => imageModelResolutions(imageModel).includes(value));
  return <div className="ec-canvas-config-panel-body">
    <CanvasConfigGroup title="分辨率">
      <div className="ec-canvas-config-resolution-row">
        {resolutions.map(value => <button key={value} type="button" className={value === resolution ? 'is-active' : ''} aria-pressed={value === resolution} onClick={() => onResolution(value)}><strong>{value}</strong><small>{value === '1K' ? '标准' : value === '2K' ? '高清' : '超清'}</small></button>)}
      </div>
    </CanvasConfigGroup>
    <CanvasConfigGroup title="画面尺寸">
      <div className="ec-canvas-config-ratio-row">
        {/* 批 CY-⑭：**「自适应」排在尺寸第一位**（用户：「是不是应该在尺寸的最前面加入一个自适应
            的一个选项，我看我们的竞品他们都是有这个选项的」）。
            它的图标不是比例方块，而是「不锁形状」的意思 —— 见下方 is-adaptive 的 CSS。
            选中它时摘要写「自适应」，实际比例由 canvasAdaptiveRatio 解析（提示词 → 参考图 → 1:1），
            结果回来后节点会按**真实**比例改写（handleMediaNaturalSize），于是那一档会自己落定。 */}
        {withAdaptiveRatioOption(CANVAS_RATIO_OPTIONS).map(value => {
          const adaptive = value === ADAPTIVE_RATIO;
          return <button key={value} type="button" className={`ec-canvas-ratio-option${adaptive ? ' is-adaptive' : ''}${value === ratio ? ' is-active' : ''}`} aria-pressed={value === ratio} onClick={() => onRatio(value)}>
            {adaptive ? <i className="ec-canvas-ratio-shape is-adaptive" /> : <i className={`ec-canvas-ratio-shape is-${value.replace(':', '-')}`} />}
            <span>{value}</span>
          </button>;
        })}
      </div>
    </CanvasConfigGroup>
    {countOptions.length > 1 && <CanvasConfigGroup title="生成数量">
      <div className="ec-canvas-config-count-row">
        {countOptions.map(value => <button key={value} type="button" className={Number(value) === Number(count) ? 'is-active' : ''} aria-pressed={Number(value) === Number(count)} onClick={() => onCount(value)}>x{value}</button>)}
      </div>
    </CanvasConfigGroup>}
  </div>;
}

function CanvasParameterControls({ node, onChange, countOptions = CANVAS_COUNT_OPTIONS, includeCount = true, activeSurface = '', onSurfaceChange, onOpenSkillLibrary = null, onOpenWorkbench = null }) {
  const rootRef = useRef(null);
  useEffect(() => {
    if (!activeSurface?.startsWith('parameter:')) return undefined;
    const close = event => {
      if (!rootRef.current?.contains(event.target)) onSurfaceChange?.(closeCanvasComposerSurface());
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [activeSurface, onSurfaceChange]);
  const open = activeSurface.startsWith('parameter:') ? activeSurface.slice('parameter:'.length) : '';
  const ratio = node?.ratio || '1:1';
  const resolution = node?.resolution || '2K';
  const imageModel = node?.imageModel || DEFAULT_IMAGE_MODEL;
  const count = Number(node?.count) || countOptions[0] || 1;
  const toggle = key => onSurfaceChange?.(toggleCanvasComposerSurface(activeSurface, `parameter:${key}`));
  /* 9-17（图6）：「张开的面板必须居中于按钮的正上方」+ 必须真的能张开（portal 脱离裁剪） */
  const [modelAnchorRef, modelAnchor] = useCanvasPopoverAnchor(open === 'model' ? 'model' : '');
  /* ═══ 批 CY-⑬：比例 / 清晰度 / 数量**三块并成一块「生成配置」**（用户原话见本文件上方那段）═══
     改前是三颗并排的小药丸，各带一个箭头；改后一颗触发器，摘要写「2K · 1:1 · x2」，
     三项在同一个面板里 —— 与首页「画面规格」那颗（2026-07-19 用户批注 #5-①）同一个口径。
     键名沿用 `parameter:config`（不是新造一套 activeSurface 语义）。 */
  const [configAnchorRef, configAnchor] = useCanvasPopoverAnchor(open === 'config' ? 'config' : '');
  const modelDef = IMAGE_MODELS.find(model => model.id === imageModel);
  /* 品牌标用 `imageModelLogo`（按 id 反查品牌，认不出也回落到 openai），不用 `brandLogo(modelDef?.brand)`：
     后者在 modelDef 为空时返回 null ⇒ `ModelLogo` 整颗返回 null ⇒ 图标位空着，触发器左边少一块。 */
  const configSummary = includeCount ? `${resolution} · ${ratio} · x${count}` : `${resolution} · ${ratio}`;
  return <div className="ec-canvas-parameter-controls" ref={rootRef} onPointerDown={event => event.stopPropagation()}>
    <div className="ec-canvas-parameter-item">
      {/* ═══ 批 CY-⑬：模型按钮改成**两行摘要**（小标题 + 当前值 + 箭头），照首页 `.visual-config-trigger`
          —— 用户原话：「它不是**模型选择按钮**吗？模型选择按钮不应该这么小呀。」
          ⚠️ 值仍然必须可收缩（`.ec-canvas-config-trigger-copy` 有 min-width:0 + overflow:hidden）：
             名字一长先裁字，**箭头永远在**（CY-⑫ 那条老规矩，本批继续成立，仍不写省略号）。 */}
      <CanvasConfigTrigger
        surface="model"
        title="生图模型"
        value={imageModelLabel(imageModel)}
        icon={<ModelLogo logo={imageModelLogo(imageModel)} size={18} radius={5} />}
        open={open === 'model'}
        anchorRef={modelAnchorRef}
        onToggle={() => toggle('model')}
        ariaLabel="生图模型"
      />
      <CanvasPopoverPortal open={open === 'model'} anchor={modelAnchor} className="ec-canvas-model-popover" label="生图模型选项">
        {/* 9-11 用户批注: 模型与首页同源 (IMAGE_MODELS), 选项也带首页同款图标 */}
        {SELECTABLE_IMAGE_MODELS.map(model => <button key={model.id} type="button" className={model.id === imageModel ? 'is-active' : ''} onClick={() => {
          /* 切到不支持当前清晰度的模型时，顺手落到它支持的档位（画布上不会留下无效的 4K） */
          const supported = imageModelResolutions(model.id);
          onChange?.(supported.includes(resolution) ? { imageModel: model.id } : { imageModel: model.id, resolution: supported[supported.length - 1] });
          onSurfaceChange?.(closeCanvasComposerSurface());
        }}>
          <ModelLogo logo={brandLogo(model.brand)} size={20} style={{ marginRight: 2 }} />
          <span className="ec-canvas-model-copy"><strong>{model.label}</strong><small>{model.badge}</small></span>
        </button>)}
      </CanvasPopoverPortal>
    </div>
    <div className="ec-canvas-parameter-item">
      <CanvasConfigTrigger
        surface="config"
        title="生成配置"
        value={configSummary}
        icon={<SlidersHorizontal size={14} />}
        open={open === 'config'}
        anchorRef={configAnchorRef}
        onToggle={() => toggle('config')}
        ariaLabel="生成配置"
      />
      <CanvasPopoverPortal open={open === 'config'} anchor={configAnchor} className="ec-canvas-config-popover" label="生成配置选项">
        <CanvasImageConfigPanel
          ratio={ratio}
          resolution={resolution}
          imageModel={imageModel}
          count={count}
          countOptions={includeCount ? countOptions : []}
          onRatio={value => { onChange?.({ ratio: value }); onSurfaceChange?.(closeCanvasComposerSurface()); }}
          onResolution={value => { onChange?.({ resolution: value }); onSurfaceChange?.(closeCanvasComposerSurface()); }}
          onCount={value => { onChange?.({ count: value }); onSurfaceChange?.(closeCanvasComposerSurface()); }}
        />
      </CanvasPopoverPortal>
    </div>
    {/* 9-11 用户批注: skill 选项进生成器 (对标流影AI) —— 技能 = P2 五套内置技能,
        选择即把技能提示词预填进 prompt (空 prompt 才填, 不覆盖已写内容), 用户可改可清除。
        9-13: 抽成 CanvasSkillControl, 与视频/套图框共用同一个入口。 */}
    <CanvasSkillControl node={node} onChange={onChange} activeSurface={activeSurface} onSurfaceChange={onSurfaceChange} onOpenSkillLibrary={onOpenSkillLibrary} onOpenWorkbench={onOpenWorkbench} domain="image" />
  </div>;
}

/* 9-16 用户批注（图9）：「我们首页不是已经把智能风格给拿掉了吗？替换成了技能呀，
   你这里为什么没有跟着一起改？首页改了什么，你要一起跟着改。」
   首页电商生图的参数行口径（README）是：生图模型 / 清晰度 / 锁定品牌主色调 / 避免出现的元素。
   画布套图框原来多一个「视觉方向 = 智能风格」入口，与首页不一致，已撤掉 ——
   风格统一走「技能」入口（CanvasSkillControl：与图片/文案/视频同一个按钮、同一套技能、同一个技能库弹窗）。
   保留的按钮与首页一一对应：
     套图方案(SizingPanel) / SKU变体 / 商品信息(ParamsPanel) / 内容规范(CopyPanel) / 生成设置(GenSettingsPanel，
     内含生图模型·清晰度·负面提示词=避免出现的元素)。 */
const SUITE_PANEL_BUTTONS = Object.freeze([
  { key: 'settings', label: '生成设置', icon: SlidersHorizontal },
  { key: 'sizing', label: '套图方案', icon: Grid2X2 },
  { key: 'sku', label: '商品规格', icon: Layers3 },
  { key: 'params', label: '商品信息', icon: Info },
  { key: 'copy', label: '内容规范', icon: FileText },
]);

/* 参数行（.ec-canvas-suite-controls，画布上的**独立一行**）。
   顺序照抄首页 src/pages/Home/EcMode.jsx 的 DEFAULT_BUTTONS：
     生成设置 → 套图方案 → SKU变体 → 技能库 → 商品信息 → 内容规范
   其中「技能库」由 CanvasSkillControl 在组件里插在对应位置，不在此数组内。

   ═══ 2026-09-27 批 CU：**「商品信息」与「内容规范(AI规划)」两颗整块拿掉** + 生成设置**拿上来** ═══
   用户原话（逐字）：「像这个**商品信息**AI规划这些按钮现在其实都是**失效的状态**。我点击了是没有反应的，
   那我觉得这些东西**可以不要了，你就直接拿掉吧**。然后**模型的选择和生成配置的那些按钮，
   你看是不是应该拿上来呢**？」
   实测（`.qa/cu-suite-diag5.mjs` —— DOM 级 click 逐颗点，绕开层叠/命中测试，每颗点两次看开关）：
     智能套图 ✅ `ec-canvas-parameter-popover:480×463` ／ SKU变体 ✅480×214 ／ 技能 ✅248×290
     生成设置（GPT Image 2·2K）✅480×248
     **商品信息 ❌** is-active 翻转了、**但没有任何 popover**；**内容规范「AI规划」❌** 同样
   根因：这两颗在 `.slice(2)` 那一支里**只渲染了按钮，没有渲染 `CanvasPopoverPortal`** ——
   面板 JSX（ParamsPanel / CopyPanel / GenerationConstraintsPanel）只写在 `.slice(0,2)` 那一支里，
   而那一支的 `open={activePanel === item.key}` 只可能命中 sizing / sku ⇒ 这两颗永远打不开。
   ⇒ 按用户口径**拿掉**（它们引用的首页电商入口本身也已经不存在了）。
   ⇒ 「生成设置」从底栏**拿上来**放回这一行（首页顺序里它本来就是第一位）；
     宽度复核：@ 24 + 生成设置 116 + 套图方案 73 + 商品规格 74 + 技能 54 = 341，+4 个 8px 间距 = 373 ≤ 398 ✓
     （行本身 `flex-wrap: wrap`，再窄也不会被裁，只会换行）。 */
const SUITE_PARAM_BUTTONS = Object.freeze([
  { key: 'sizing', label: '套图方案', icon: Grid2X2 },
  { key: 'sku', label: '商品规格', icon: Layers3 },
]);

function suiteConfiguration(node = {}) {
  const defaults = createSmartConfiguration();
  const value = node.configuration || {};
  const commerceContext = normalizeCommerceContext({
    ...(defaults.commerceContext || {}),
    ...(node.commerceContext || {}),
    ...(value.commerceContext || {}),
    platform: value.commerceContext?.platform || value.platform || node.commerceContext?.platform || node.platform,
  });
  return {
    ...defaults,
    ...value,
    platform: commerceContext.platform,
    commerceContext,
    sizing: { ...defaults.sizing, ...(value.sizing || {}) },
    productParams: { ...defaults.productParams, ...(value.productParams || {}) },
    copywriting: { ...defaults.copywriting, ...(value.copywriting || {}) },
    genSettings: { ...defaults.genSettings, ...(value.genSettings || {}), resolution: value.genSettings?.resolution || node.resolution || '2K', imageModel: value.genSettings?.imageModel || node.imageModel || DEFAULT_IMAGE_MODEL },
  };
}

function CanvasSuiteControls({ node, onChange, activeSurface = '', onSurfaceChange, availableSources = [], mentionSources = [], onToggleSource, promptFieldRef = null, onOpenSkillLibrary = null, onOpenWorkbench = null }) {
  const rootRef = useRef(null);
  const configuration = suiteConfiguration(node);
  const adjustedPanels = deriveEffectiveSmartOverrides(configuration);
  useEffect(() => {
    if (!activeSurface?.startsWith('suite:')) return undefined;
    const close = event => {
      if (!rootRef.current?.contains(event.target)) onSurfaceChange?.(closeCanvasComposerSurface());
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [activeSurface, onSurfaceChange]);
  const activePanel = activeSurface.startsWith('suite:') ? activeSurface.slice('suite:'.length) : '';
  /* 9-17（图6）：套图方案/SKU/商品信息/内容规范/生成设置 五个面板同样走 portal，
     口径不变 —— 水平居中于各自按钮正上方，且不再被生成框 / 画布 / 整页的 overflow 裁掉。 */
  const [suiteAnchorRef, suiteAnchor] = useCanvasPopoverAnchor(activePanel);
  const update = (key, value, legacy = {}) => onChange?.({
    ...legacy,
    configuration: { ...configuration, [key]: value },
  });
  const summary = key => {
    if (key === 'sizing') return summarizeCommerceConfiguration('sizing', configuration.sizing);
    if (key === 'sku') return summarizeCommerceConfiguration('sku', configuration);
    if (key === 'params') return summarizeCommerceConfiguration('params', configuration);
    /* 9-16：'style'（视觉方向/智能风格）入口已撤掉，风格统一走「技能」，与首页一致 */
    if (key === 'copy') return Object.values(configuration.copywriting || {}).some(Boolean) ? '已配置' : 'AI规划';
    return `${imageModelLabel(configuration.genSettings?.imageModel)}·${configuration.genSettings?.resolution || '2K'}`;
  };
  return <div className="ec-canvas-suite-controls" role="group" aria-label="套图参数" ref={rootRef}>
    {/* 2026-09-17 用户批注：@ 键「做到最前面去，做到那个智能…的前面」——
        与首页一致（首页 @ 引用也在参数行首位），规格与视频框同一套 ComposerMention。 */}
    <div className="ec-canvas-suite-control ec-canvas-suite-mention" key="mention">
      <ComposerMention
        availableSources={availableSources}
        selectedSources={mentionSources}
        activeSurface={activeSurface}
        onSurfaceChange={onSurfaceChange}
        onToggleSource={(sourceImage, options = {}) => {
          const hasProductSource = sources.some(source => (node.sourceRoles?.[source.id] || source.role) === 'product');
          const role = hasProductSource ? 'reference' : 'product';
          const selected = mentionSources.some(item => (item.sourceNodeId || item.id) === (sourceImage.sourceNodeId || sourceImage.id));
          /* 来自 @ 菜单：只插入提及（未选中则顺带选中），绝不在菜单里取消选中 */
          if (options.fromMention === true) {
            if (!selected) onToggleSource?.(sourceImage, role, { skipPromptInsert: true });
            promptFieldRef.current?.insertMention(sourceImage.label);
            return;
          }
          onToggleSource?.(sourceImage, role, { skipPromptInsert: true });
          if (!selected) promptFieldRef.current?.insertMention(sourceImage.label);
        }}
      />
      {/* 批 CY-㉘：删掉这行「引用」标签（用户 2026-09-30 逐字：
          「@ 按钮的后面怎么还是有引用两个字？你要把它去掉呀」）。
          上面那张 `CanvasSuiteSourceStrip` 已经把 @ 钮画出来了，这行是纯重复文案。 */}
    </div>
    {/* 参数行只放**短文案**四字按钮（首页同序）：套图方案 → SKU变体 → 技能 → 商品信息 → 内容规范。
        「生成设置」不在这里 —— 它是「模型·清晰度」，是长文案、允许被裁的那一格，
        与图片框的模型按钮同级，位置在**底栏**（与 @ / 技能 / 生成 同一行）。 */}
    {SUITE_PARAM_BUTTONS.slice(0, 2).map(item => <div className={`ec-canvas-suite-control ec-canvas-suite-param-${item.key}`} key={item.key}>
      {/* ═══ 批 CY-⑬：这两格也换成**两行摘要**触发器（原来也是 27px 单行药丸）══════════════════════
          与「技能 / 生成配置」并排放在同一行，高度必须一致 ——
          27px 的药丸夹在 40px 触发器中间，整行基线会歪，这正是用户反复报的那一类。
          「已调整」那个角标折进**值**里（`（已调整）`），信息一点没丢，
          但不再额外占一行高度；角标原本是 `is-adjusted` 类的视觉态，现在由值本身表达。 */}
      <CanvasConfigTrigger
        surface={`suite-${item.key}`}
        title={item.label}
        value={`${summary(item.key)}${adjustedPanels[item.key] ? '（已调整）' : ''}`}
        icon={<item.icon size={14} />}
        open={activePanel === item.key}
        anchorRef={activePanel === item.key ? suiteAnchorRef : undefined}
        onToggle={() => onSurfaceChange?.(toggleCanvasComposerSurface(activeSurface, `suite:${item.key}`))}
        ariaLabel={item.label}
      />
      <CanvasPopoverPortal open={activePanel === item.key} anchor={suiteAnchor} className="ec-canvas-suite-panel-popover" label={`${item.label}设置`}>
        {item.key === 'sizing' && <SizingPanel
          platform={configuration.platform}
          targetLanguage={configuration.commerceContext.targetLanguage}
          onPlatformSizingChange={(platform, sizing) => {
            const commerceContext = normalizeCommerceContext({ ...configuration.commerceContext, platform });
            onChange?.({ platform: commerceContext.platform, commerceContext, configuration: { ...configuration, platform: commerceContext.platform, commerceContext, sizing } });
          }}
          onTargetLanguageChange={targetLanguage => {
            const commerceContext = normalizeCommerceContext({ ...configuration.commerceContext, targetLanguage });
            onChange?.({ commerceContext, language: commerceContext.targetLanguage, configuration: { ...configuration, commerceContext } });
          }}
          sizing={configuration.sizing}
          onSizingChange={value => update('sizing', value, { count: (value.images || []).reduce((total, image) => total + (Number(image.count) || 0), 0) || node.count })}
          resolution={configuration.genSettings.resolution}
        />}
        {item.key === 'sku' && <SkuPanel skus={configuration.skus} onChange={value => update('skus', value)} sizing={configuration.sizing} onSizingChange={value => update('sizing', value)} />}
        {/* ═══ 2026-09-27 批 CU：这里原来还挂着三支**永远打不开**的面板（params / copy / settings）═══
            它们的选择器命中的是 `item.key`，而本支 `.map()` 只会遍历 SUITE_PARAM_BUTTONS 的前两项
            （sizing / sku）⇒ 三支都不可达；用户看到的却是「商品信息」「AI规划」两颗按钮**点了没反应**
            （按钮在另一支 `.slice(2)` 里渲染、面板却写在这里）。
            用户原话（逐字）：「像这个商品信息AI规划这些按钮现在其实都是**失效的状态**。我点击了是没有反应的，
            那我觉得这些东西**可以不要了，你就直接拿掉吧**。」
            ⇒ 按钮与这三支死面板**一起拿掉**（面板本身在首页 EcMode.jsx 里仍是活的，不受影响）；
              「生成设置」改由 CanvasSuiteSettingsControl 渲染在参数行（见 CanvasSuiteControls 末尾）。 */}
      </CanvasPopoverPortal>
    </div>)}
    {/* 技能：位置与首页一致（Home/EcMode.jsx DEFAULT_BUTTONS 第 4 位 = skills）—— 不再丢到最下面 */}
    <div className="ec-canvas-suite-control ec-canvas-suite-skill-control" key="skill">
      <CanvasSkillControl node={node} onChange={onChange} activeSurface={activeSurface} onSurfaceChange={onSurfaceChange} onOpenSkillLibrary={onOpenSkillLibrary} onOpenWorkbench={onOpenWorkbench} domain="image" />
    </div>
    {/* ═══ 2026-09-27 批 CU：「生成设置」（= 模型 · 清晰度）**从底栏拿上来**，放回这一行的末尾 ═══════
        用户原话（逐字）：「然后**模型的选择和生成配置的那些按钮，你看是不是应该拿上来呢**？」
        原来它在 `.ec-canvas-composer-footer`（底栏，与 @ / 技能 / 生成按钮同一行）——
        那是"参数行塞了 6 格会裁掉内容规范"时的取舍；现在那两颗（商品信息 / 内容规范）已按用户口径拿掉，
        这一行空出来了，模型与生成配置就该回到"参数"该在的地方（与首页 DEFAULT_BUTTONS 的"生成设置"同位）。
        ⚠️ 位置在**技能之后**：这样"技能库"仍夹在 生成设置/套图方案/商品规格 与 生成按钮 之间，
        与用户 9-16 定下的那一版顺序不冲突。 */}
    <div className="ec-canvas-suite-control ec-canvas-suite-settings-in-row" key="settings-row">
      <CanvasSuiteSettingsControl node={node} onChange={onChange} activeSurface={activeSurface} onSurfaceChange={onSurfaceChange} />
    </div>
  </div>;
}

/* 「生成设置」独立成格：模型 · 清晰度。
   它与 CanvasSuiteControls 共用同一套 popover 锚点机制与 GenSettingsPanel。
   ═══ 批 CY-⑬：触发器改成与另外三个框**同一套两行摘要**（小标题「生成配置」+ 当前值 + 箭头）——
       改前是一颗单行药丸「GPT Image 2·2K」，既没有标题、也看不出这颗是什么。
       面板内容一字未动（仍是 GenSettingsPanel：模型 · 清晰度 · 品牌色 · 负面提示词）。 */
function CanvasSuiteSettingsControl({ node, onChange, activeSurface = '', onSurfaceChange }) {
  const configuration = suiteConfiguration(node);
  const activePanel = activeSurface.startsWith('suite:') ? activeSurface.slice('suite:'.length) : '';
  const [anchorRef, anchor] = useCanvasPopoverAnchor(activePanel === 'settings' ? 'settings' : '');
  const suiteModel = configuration.genSettings?.imageModel || DEFAULT_IMAGE_MODEL;
  return <div className="ec-canvas-suite-settings-control">
    <CanvasConfigTrigger
      surface="suite-settings"
      title="生成配置"
      value={`${imageModelLabel(suiteModel)} · ${configuration.genSettings?.resolution || '2K'}`}
      icon={<ModelLogo logo={imageModelLogo(suiteModel)} size={18} radius={5} />}
      open={activePanel === 'settings'}
      anchorRef={activePanel === 'settings' ? anchorRef : undefined}
      onToggle={() => onSurfaceChange?.(toggleCanvasComposerSurface(activeSurface, 'suite:settings'))}
      ariaLabel="生成配置"
    />
    <CanvasPopoverPortal open={activePanel === 'settings'} anchor={anchor} className="ec-canvas-suite-panel-popover" label="生成配置">
      <GenSettingsPanel value={configuration.genSettings} onChange={value => onChange?.({ resolution: value.resolution || node.resolution, configuration: { ...configuration, genSettings: value } })} />
    </CanvasPopoverPortal>
  </div>;
}

/* 2026-09-17 用户确认口径：方案是**待确认资产**，不是一个"存在即生效"的中间态。
   用户需要能：① 继续编辑方案；② 明确「确认方案」（此后生成只依据方案）；
   ③ 「重新生成方案」—— 旧方案**保留、可对比、不删除**（写进 previousSuitePlans）。 */
function CanvasSuitePlanEditor({ plan = {}, onChange, confirmed = false, onConfirm, onRegenerate, regenerating = false }) {
  return <div className="ec-canvas-suite-plan-editor">
    <EcommerceDesignPlanEditor direction={plan} prompt={plan.brief} onChange={onChange} />
    {/* 9-18（P0）改用契约类（原为自写 .ec-canvas-suite-plan-actions + 自写按钮外观）。 */}
    <div className="ec-canvas-suite-plan-actions ui-modal-footer-actions">
      {/* 状态文案：短、说结果不说机制 */}
      <span className={`ec-canvas-suite-plan-state${confirmed ? ' is-confirmed' : ''}`} role="status">
        {confirmed ? '方案已确认' : '方案待确认'}
      </span>
      {onRegenerate && <button
        type="button"
        data-canvas-control="true"
        className="ui-btn ui-btn-secondary ec-canvas-suite-plan-secondary"
        disabled={regenerating}
        onClick={event => { event.stopPropagation(); onRegenerate(); }}
      >{regenerating ? '正在重新生成' : '重新生成方案'}</button>}
      {/* 已确认后不再重复给「确认方案」—— 避免用户以为自己要再点一次 */}
      {!confirmed && onConfirm && <button
        type="button"
        data-canvas-control="true"
        className="ui-btn ui-btn-primary ec-canvas-suite-plan-confirm"
        onClick={event => { event.stopPropagation(); onConfirm(); }}
      ><Check size={15} />确认方案</button>}
    </div>
  </div>;
}

function layerCompositeStyle(layer = {}, group = {}) {
  const bounds = layer.layerBounds;
  const normalized = bounds && ['x', 'y', 'width', 'height']
    .every(key => Number.isFinite(Number(bounds[key])));
  if (normalized) {
    return {
      left: `${Number(bounds.x) * 100}%`,
      top: `${Number(bounds.y) * 100}%`,
      width: `${Number(bounds.width) * 100}%`,
      height: `${Number(bounds.height) * 100}%`,
    };
  }
  const width = Math.max(1, Number(group.w) || 1);
  const height = Math.max(1, Number(group.h) || 1);
  return {
    left: `${((Number(layer.x) || Number(group.x) || 0) - (Number(group.x) || 0)) / width * 100}%`,
    top: `${((Number(layer.y) || Number(group.y) || 0) - (Number(group.y) || 0)) / height * 100}%`,
    width: `${Math.max(0, Number(layer.w) || width) / width * 100}%`,
    height: `${Math.max(0, Number(layer.h) || height) / height * 100}%`,
  };
}

function layerCompositeOrder(layer = {}) {
  if (layer.semanticType === 'background') return 0;
  if (layer.kind === 'text' || layer.semanticType === 'text') return 3;
  if (layer.semanticType === 'product-group') return 1;
  return 2;
}

/* 批 CY-⑭：`onNaturalSize` 以前**根本没有这个 prop** ——
   `index.jsx` 从 2026-08-13 起就一直往这里传，组件签名不接、也不往下传，于是图片框
   永远按「请求里的比例」画，真实比例被丢掉（用户看到的上下/左右白边与「被截断」）。
   现在补上，并且给视频补一条 `onLoadedMetadata` 通路（以前全仓没有一处读 videoWidth）。 */
function CanvasGenerationNodeView({ node, layerChildren = [], selected = false, dimmed = false, editing = false, imageWatermark, videoWatermark, onPointerDown, onContextMenu, onDoubleClick, onTextDoubleClick, onTextBlur, onHoverChange, onResizeStart, onTextChange, onTextSelect, onAutoHeight, onReplace = null, onPortPointerDown, onPortPointerUp, onPortClick, onNaturalSize = null, canDerive = false, connectActive = false, snapActive = false }) {
  const isLayerGroup = node.kind === 'layer-group';
  const isText = node.kind === 'text-composer';
  const isImage = node.kind === 'image-composer' || isLayerGroup;
  const isSuite = node.kind === 'suite-composer';
  const isVideo = node.kind === 'video' || node.kind === 'video-composer';
  const direction = node.directions?.[node.selectedDirection || 0];
  const directions = Array.isArray(node.directions) ? node.directions : [];
  const suitePlan = isSuite && directions.length ? buildCanvasSuitePlan(node.suitePlan || direction, node.prompt) : null;
  /* 9-15 用户决定（复核 9-13）：**生成前无加号、生成结果必须有加号** ——
     框内还没有结果（未生成 / 失败）时不渲染左右加号；结果落入框内（有 url）时
     左右才出现输入锚点 + 输出加号。text-composer / suite-composer 的框是控制台，
     结果以独立节点出现，框本体始终不挂加号。 */
  /* 9-16 用户批注（图15~19）：「组内节点还带加号」—— 打组（groupId 前缀 #group_）之后，
     组内节点不再显示左右加号（打组 = 一个整体，加减号会破坏"这是一个组"的认知）。
     绑定元素（#bind_）只是"一起移动"，不改变节点自身能力，加号保留。 */
  const inCanvasGroup = canvasGroupKindOf(node.groupId) === 'group';
  const nodeHasResult = canvasGenerationBoxHasResult(node) && !inCanvasGroup;
  const textBoardRef = useRef(null);
  const textComposingRef = useRef(false);
  /* 2026-10-02 用户批注（照知渔）：「他目前的情况是鼠标只要挪动到这块区域，他的视频就会自动播放，
     然后他的鼠标只要挪开这块播放的区域的话，视频就会停下来。我觉得你也可以照他这个模式去做。」
     ⚠️ `play()` 返回 Promise 且可能被浏览器自动播放策略拒绝 ⇒ 必须 catch，
        否则控制台会留一条 unhandled rejection（而且表现为"点了没反应又不知道原因"）。 */
  const hoverVideoRef = useRef(null);
  const playOnHover = useCallback(() => {
    const el = hoverVideoRef.current;
    if (!el) return;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => { /* 被策略拒绝：保持暂停，不报错 */ });
  }, []);
  const pauseOnLeave = useCallback(() => {
    const el = hoverVideoRef.current;
    if (!el) return;
    el.pause();
    /* 回到开头，下次移回来从头播 —— 否则每次悬停都从上次停的位置接着播，很怪 */
    try { el.currentTime = 0; } catch { /* 元数据未就绪，忽略 */ }
  }, []);
  const textEditSeedRef = useRef('');
  /* 文案板高度跟随内容 (与 CanvasTextNode 同策略) */
  const syncTextBoardHeight = () => {
    const el = textBoardRef.current;
    if (!el || typeof onAutoHeight !== 'function') return;
    const next = Math.max(84, Math.ceil(el.scrollHeight) + 10);
    if (Math.abs(next - (Number(node.h) || 84)) > 2) onAutoHeight(node.id, next);
  };
  /* 与 CanvasTextNode 相同的非受控编辑策略: 编辑期间 React 不回写 DOM,
     保住光标位置和中文 IME 组合输入 */
  useEffect(() => {
    if (!editing || node.status === 'processing') return undefined;
    textEditSeedRef.current = node.text || '';
    const el = textBoardRef.current;
    if (el) {
      if (el.textContent !== textEditSeedRef.current) el.textContent = textEditSeedRef.current;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    syncTextBoardHeight();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);
  return <article
    data-canvas-node-id={node.id}
    className={`ec-canvas-generation-node is-${isVideo ? 'video' : isImage ? 'image' : isText ? 'text' : 'suite'} ${node.status === 'processing' ? 'is-processing' : ''} ${isLayerGroup ? 'is-layer-group' : ''} ${selected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''} ${node.p3Pending ? 'is-p3-pending' : ''}`}
    style={{ left: node.x, top: node.y, width: node.w, height: node.h, visibility: node.hidden ? 'hidden' : 'visible', opacity: typeof node.opacity === 'number' ? node.opacity : 1 }}
    onPointerDown={event => onPointerDown?.(event, node.id)}
    onContextMenu={event => { event.preventDefault(); onContextMenu?.(event, node); }}
    onDoubleClick={event => { event.stopPropagation(); if (isText) onTextDoubleClick?.(node.id); else if (!isVideo && node.url) onDoubleClick?.(node); }}
    onMouseEnter={() => onHoverChange?.(node.id)}
    onMouseLeave={() => onHoverChange?.(null)}
  >
    {isText ? <div
      ref={textBoardRef}
      className="ec-canvas-generation-text-board"
      contentEditable={editing && node.status !== 'processing'}
      suppressContentEditableWarning
      role="textbox"
      aria-label="生成文案编辑区"
      aria-multiline="true"
      data-placeholder={node.placeholder || '双击开始编辑...'}
      style={node.textStyle || undefined}
      onPointerDown={event => { event.stopPropagation(); if (!editing) onPointerDown?.(event, node.id); }}
      onDoubleClick={event => { event.stopPropagation(); onTextDoubleClick?.(node.id); }}
      onFocus={() => { if (!textComposingRef.current) onTextSelect?.(node.id); }}
      onCompositionStart={() => { textComposingRef.current = true; }}
      onCompositionEnd={event => {
        textComposingRef.current = false;
        onTextChange?.(node.id, event.currentTarget.textContent || '');
        syncTextBoardHeight();
      }}
      onInput={event => {
        if (textComposingRef.current) return;
        onTextChange?.(node.id, event.currentTarget.textContent || '');
        syncTextBoardHeight();
      }}
      onBlur={() => { if (!textComposingRef.current) onTextBlur?.(node.id); }}
    >{editing ? textEditSeedRef.current : (node.text || '')}</div> : isVideo && node.url && node.mediaPlaybackStatus !== 'unavailable' ? <div className="ec-canvas-video-frame" onPointerEnter={playOnHover} onPointerLeave={pauseOnLeave}><video ref={hoverVideoRef} src={node.url} controls playsInline preload="metadata" onPointerDown={event => event.stopPropagation()} onLoadedMetadata={event => { const media = event.currentTarget; onNaturalSize?.(node.id, { naturalWidth: Number(media?.videoWidth) || 0, naturalHeight: Number(media?.videoHeight) || 0 }); /* 首帧拨一下，否则没播过之前是黑的（用户：「为什么这里是个黑图呀」） */ if (!media.currentTime) { try { media.currentTime = 0.05; } catch { /* 元数据未就绪 */ } } }} /></div> : isLayerGroup && node.status !== 'processing' && layerChildren.length ? <div className="ec-canvas-layer-composite" aria-label="智能分层合成预览">
      {[...layerChildren].sort((left, right) => layerCompositeOrder(left) - layerCompositeOrder(right)).map(layer => <div key={layer.id} className={`ec-canvas-layer-composite-item is-${layer.kind}`} style={layerCompositeStyle(layer, node)}>
        {layer.kind === 'text'
          ? <span style={layer.textStyle || undefined}>{layer.text}</span>
          : <ResponsiveImage src={layer.url} alt="" variant="canvas" ratio={layer.ratio || '1:1'} style={{ width: '100%', height: '100%' }} imgStyle={{ objectFit: 'contain' }} />}
      </div>)}
    </div> : isImage && node.url ? <ResponsiveImage src={node.url} alt={node.name || '生成图片'} variant="canvas" ratio={node.ratio || '1:1'} style={{ width: '100%', height: '100%' }} imgStyle={{ objectFit: 'contain' }} onLoad={event => { const measuredWidth = Number(event.naturalWidth || event.currentTarget?.naturalWidth) || 0; const measuredHeight = Number(event.naturalHeight || event.currentTarget?.naturalHeight) || 0; if (measuredWidth > 0 && measuredHeight > 0) onNaturalSize?.(node.id, { naturalWidth: measuredWidth, naturalHeight: measuredHeight }); }} /> : isSuite && directions.length ? <EcommerceDesignPlanPreview direction={suitePlan} prompt={node.prompt} /> : <div className="ec-canvas-generation-placeholder">
      {isVideo ? <Clapperboard size={28} /> : isLayerGroup ? <Layers3 size={28} /> : isImage ? <ImagePlus size={28} /> : <Sparkles size={25} />}
      <strong>{isVideo ? (node.kind === 'video' ? '视频素材' : '视频生成') : isLayerGroup ? '智能分层' : isImage ? (node.actionId ? '图片生成（编辑）' : '图片生成') : '电商套图'}</strong>
      {(isSuite || isLayerGroup) && <span>{isLayerGroup ? '识别商品、背景和文字，拖动后展开图层' : direction?.title || '在下方输入需求并发送，生成整体设计规范与图片规划'}</span>}
      {node.status === 'processing' && <small>{node.progressLabel || '正在处理...'}</small>}
      {/* ⚠️ 2026-10-02：上传进度**长在素材自己身上**（用户照知渔提的：「他上传的进度是在
          整个素材里面的……我们现在是在整个画布的最下方，我觉得可能不太对」）。
          `uploadPercent` 由 index.jsx 的 makeUploadReporter 直接写到占位节点上 ——
          能这么写的前提是**节点先于上传存在**（原来节点是传完才建的，进度无处可挂，
          只能做成画布底部那条全局横条）。 */}
      {node.status === 'uploading' && (
        <div className="ec-canvas-node-upload-progress">
          <div className="ec-canvas-node-upload-progress-track">
            <div
              className="ec-canvas-node-upload-progress-fill"
              style={{ width: `${Math.max(2, node.uploadPercent || 0)}%` }}
            />
          </div>
          <small>上传中 {node.uploadPercentText || `${Math.round(node.uploadPercent || 0)}%`}</small>
        </div>
      )}
      {node.mediaPlaybackError && <small className="is-error">{node.mediaPlaybackError}</small>}
      {node.error && <small className="is-error">{node.error}</small>}
    </div>}
    {isVideo && <MaterialWatermarkOverlay kind="video" watermark={videoWatermark} width={node.w || 1} height={node.h || 1} />}
    {isImage && <MaterialWatermarkOverlay kind="image" watermark={imageWatermark} width={node.w || 1} height={node.h || 1} />}
    {/* 9-11: 视频/分层节点与图片同款「替换」角标胶囊 (选中即现, 对标流影AI) */}
    {(isVideo || isLayerGroup) && selected && onReplace && <button
      type="button"
      className="ec-canvas-node-replace"
      data-canvas-control="true"
      aria-label="替换素材"
      title="上传新素材替换当前内容，位置与连线不变"
      onPointerDown={event => event.stopPropagation()}
      onClick={(event) => { event.stopPropagation(); onReplace(); }}
    ><ImagePlus size={13} />替换</button>}
    {/* 9-15（复核 9-13）用户决定：**输出加号等结果，入加号随时可接**。
        右侧输出加号（"从这张图继续派生"）仍然只在结果落框后出现（canvasGenerationBoxHasResult），
        这个判断本身没错 —— 没有结果确实无从派生。
        ⚠️ 2026-09-30 批 CY-㊴ 修正的是**左侧输入加号**：它被同一道 `nodeHasResult` 门控住了，
        而 text-composer / suite-composer 更是恒为 false ⇒ 这两类框**永远**没有任何端口。
        用户 9-30 实测：「他为什么不能够跟我们当前的任意节点创建连接呢？」
        —— 他要的就是往一个**还没出结果的生成框**里再送一份素材共同创作。
        ⇒ 输入锚点无条件渲染（它表达的是"上游可以接进来"，与本框有没有结果无关）；
           输出加号维持原语义。两条判据各司其职，不再共用一个门。 */}
    <DerivePort side="input" visible={selected || connectActive} active={snapActive} disabled={!canDerive} onPointerDown={onPortPointerDown} onPointerUp={onPortPointerUp} onClick={onPortClick} />
    {nodeHasResult && <DerivePort visible={selected || connectActive} disabled={!canDerive} onPointerDown={onPortPointerDown} onPointerUp={onPortPointerUp} onClick={onPortClick} />}
    <ResizeHandles visible={selected && !node.locked} onResizeStart={onResizeStart} />
  </article>;
}

/* P7 方案入画布: 设计方案 = 画布对象 (可生成/可换一套/可应用到画布), 不是独立整页。
   计费不变式①: 生成/刷新方案都走 ec_direction_analysis / ec_direction_refresh 报价扣费 (handler 在 index.jsx)。 */
function CanvasDirectionNodeView({ node, selected = false, dimmed = false, onPointerDown, onContextMenu, onHoverChange, onAutoHeight, onGenerate, onRefresh, onApply }) {
  const directions = Array.isArray(node.directions) ? node.directions : [];
  const hasPlan = directions.length > 0;
  const busy = node.status === 'processing';
  const plan = hasPlan ? buildCanvasSuitePlan(directions[0], node.prompt || '') : null;
  const totalShots = plan?.shots?.length || 0;
  /* 9-12 用户批注：这个节点的内容是「撑高」的（height:auto + minHeight），但 node.h 从不回写，
     于是加号手柄（按实高 50%）与连线端点（按 node.h/2）会错开。
     与 CanvasGenerationNode/CanvasTextNode 同样策略：把实高同步回 node.h。 */
  const directionRootRef = useRef(null);
  useEffect(() => {
    const el = directionRootRef.current;
    if (!el || typeof onAutoHeight !== 'function') return;
    const next = Math.max(120, Math.ceil(el.scrollHeight) + 10);
    if (Math.abs(next - (Number(node.h) || 260)) > 2) onAutoHeight(node.id, next);
  }, [node.id, node.h, node.status, directions.length, onAutoHeight]);
  return <article
    ref={directionRootRef}
    data-canvas-node-id={node.id}
    className={`ec-canvas-generation-node is-direction ${node.status === 'processing' ? 'is-processing' : ''} ${selected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''}`}
    style={{ left: node.x, top: node.y, width: node.w, height: 'auto', minHeight: node.h, visibility: node.hidden ? 'hidden' : 'visible' }}
    onPointerDown={event => onPointerDown?.(event, node.id)}
    onContextMenu={event => { event.preventDefault(); onContextMenu?.(event, node); }}
    onMouseEnter={() => onHoverChange?.(node.id)}
    onMouseLeave={() => onHoverChange?.(null)}
  >
    <div className="ec-canvas-direction-body">
      <div className="ec-canvas-direction-head">
        <strong>设计方案{node.productName ? ` · ${node.productName}` : ''}</strong>
        <small>{busy ? '正在生成…' : hasPlan ? `${directions.length} 套方向 · ${totalShots} 张图规划` : '未生成 · 分析 1 积分'}</small>
      </div>
      {hasPlan && !busy && <div className="ec-canvas-direction-items" aria-label="方向预览">
        {directions.slice(0, 3).map((direction, index) => {
          const label = direction.title || direction.name || direction.brief || `方向 ${index + 1}`;
          return <span key={index} className="ec-canvas-direction-chip"><i>{index + 1}</i>{label}</span>;
        })}
        {directions.length > 3 && <span className="ec-canvas-direction-chip is-more">+{directions.length - 3}</span>}
      </div>}
      {node.error && <small className="is-error">{node.error}</small>}
      {/* 9-18（P0）改用契约类（原为自写 .ec-canvas-direction-actions + 自写按钮外观）。 */}
      <div className="ec-canvas-direction-actions ui-modal-footer-actions">
        {!hasPlan ? <button type="button" className="ui-btn ui-btn-primary" data-canvas-control="true" disabled={busy} onClick={event => { event.stopPropagation(); onGenerate?.(); }}><WandSparkles size={13} />生成方案 · 1 积分</button>
          : <>
            <button type="button" className="ui-btn ui-btn-secondary" data-canvas-control="true" disabled={busy} onClick={event => { event.stopPropagation(); onRefresh?.(); }}><RefreshCw size={13} />换一套 · 1 积分</button>
            <button type="button" className="ui-btn ui-btn-primary" data-canvas-control="true" disabled={busy} onClick={event => { event.stopPropagation(); onApply?.(); }}><ImagePlus size={13} />应用到画布</button>
          </>}
      </div>
    </div>
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

export function CanvasImageComposer({ node, position,  sources = [], mentionSources = [], availableSources = [], loading = false, activeSurface = '', onSurfaceChange, onChange, onAddSources, onRemoveSource, onToggleSource, onGenerate, onOpenSkillLibrary = null, onOpenWorkbench = null }) {
  const promptFieldRef = useRef(null);
  if (!node) return null;
  const source = sources[0];
  const isLocalEdit = node.actionId === 'inpaint';
  /* 9-13 用户批注：生成按钮上必须像首页一样直接显示动态积分（换模型/清晰度/张数实时变） */
  const estimate = estimateImageComposerPoints({ imageModel: node.imageModel, resolution: node.resolution, count: node.count });
  /* 角色口径：@ 引用进来的素材，若画布里**已经有产品图**就当参考图用，
     否则第一张就是产品图本身（与首页"产品图 / 参考图"两个坑位同义）。 */
  const hasProductSource = sources.some(source => (node.sourceRoles?.[source.id] || source.role) === 'product');
  const handleToggleSource = (source, options = {}) => {
    const role = hasProductSource ? 'reference' : 'product';
    const selected = mentionSources.some(item => (item.sourceNodeId || item.id) === (source.sourceNodeId || source.id));
    /* 来自 @ 菜单：只插入提及（未选中则顺带选中），绝不在菜单里取消选中 */
    if (options.fromMention === true) {
      if (!selected) onToggleSource?.(source, role, { skipPromptInsert: true });
      promptFieldRef.current?.insertMention(source.label);
      return;
    }
    onToggleSource?.(source, role, { skipPromptInsert: true });
    if (!selected) promptFieldRef.current?.insertMention(source.label);
  };
  return <section className="ec-canvas-node-composer ec-canvas-context-composer ec-canvas-image-composer" style={position} aria-label={isLocalEdit ? '局部改图操作台' : '图片生成操作台'} onPointerDown={event => event.stopPropagation()}>
      {isLocalEdit && <ComposerPreview node={node} source={source} label="局部改图" selection={node.selection} onSelectionChange={selection => onChange?.({ selection })} />}
      <ComposerSources sources={sources} role="reference" onAddSources={onAddSources} onRemoveSource={onRemoveSource} uploadLabel={isLocalEdit ? '上传目标图' : '上传参考图'} />
      {isLocalEdit && <div className="ec-canvas-selection-mode" role="group" aria-label="局部目标">
        <span>局部目标</span>
        {['whole', 'rectangle', 'subject'].map(mode => <button key={mode} type="button" className={node.selection?.mode === mode || (!node.selection && mode === 'whole') ? 'is-active' : ''} data-canvas-control="true" onClick={event => { event.stopPropagation(); onChange?.({ selection: { mode } }); }}>{mode === 'whole' ? '整图' : mode === 'rectangle' ? '框选' : '主体'}</button>)}
      </div>}
      <CanvasPromptField
        ref={promptFieldRef}
        data-canvas-control="true"
        value={node.prompt || ''}
        mentions={mentionSources}
        maxLength={IMAGE_PROMPT_LIMIT}
        contentEditable={!loading}
        className={loading ? 'is-disabled' : ''}
        placeholder={isLocalEdit ? '描述要保留和修改的内容，可选框选或主体目标' : '描述你想生成的画面，商品结构、品牌和文字会优先保持一致'}
        onChange={value => onChange?.({ prompt: value })}
      />
      <div className="ec-canvas-composer-footer">
        <ComposerMention availableSources={availableSources} selectedSources={mentionSources} activeSurface={activeSurface} onSurfaceChange={onSurfaceChange} onToggleSource={handleToggleSource} />
        <CanvasParameterControls node={node} onChange={onChange} activeSurface={activeSurface} onSurfaceChange={onSurfaceChange} onOpenSkillLibrary={onOpenSkillLibrary} onOpenWorkbench={onOpenWorkbench} />
        {/* 9-18（P0）说明：本行容器 .ec-canvas-composer-footer 是**复合工具条**（@ 引用 + 参数控件 + CTA），
            不属于「弹窗底部操作区」，故其 CTA 保留画布侧既有契约类 shubao-gen-cta
            （test/canvas-composer-points-and-skill-0913 要求四个生成框共用同一枚 CTA），
            不强行改挂 .ui-btn，避免破坏既有画布契约。 */}
        <button type="button" data-canvas-control="true" className="shubao-gen-cta ec-canvas-composer-cta" disabled={loading || !String(node.prompt || '').trim() || (isLocalEdit && !sources.length)} onClick={event => { event.stopPropagation(); onGenerate?.(); }}>
          {loading ? '生成中' : <><Sparkles size={15} />生成<span className="shubao-gen-cta-points">{formatCanvasPoints(estimate.points)} 积分</span></>}
        </button>
      </div>

  </section>;
}

/* ⚠️ 2026-09-28 批 CY-⑬ **`onOpenWorkbench` 必须在这个签名里**（CY-⑨ 留下的真崩溃）。
   现象（`.qa/cy13-param-row-audit.mjs` 实测）：从左侧「+」建出**文案生成**节点时抛
   `ReferenceError: onOpenWorkbench is not defined` —— 组件体第 1371 行把它传给了
   `CanvasParameterControls`，而签名里没有解构 ⇒ 整个文案框**渲染即崩**（已上线，d8e38798 起）。
   ⇒ ① 签名补上（默认 null，语义同另两个框：解析不出子页面坐标就不给入口）；② 父组件也把它接上，
      这样"有技能的文案节点"同样能在技能层里"去完整工作台里编辑"（用户元要求：同型的一起改）。 */
export function CanvasTextGenerationComposer({ node, position,  sources = [], mentionSources = [], availableSources = [], loading = false, activeSurface = '', onSurfaceChange, onChange, onAddSources, onRemoveSource, onToggleSource, onGenerate, onOpenSkillLibrary = null, onOpenWorkbench = null }) {
  const promptFieldRef = useRef(null);
  if (!node) return null;
  /* 9-13: 文案按次计费（后端 ec_ai_assistant），与首页同样的动态积分展示 */
  const estimate = estimateTextComposerPoints();
  const handleToggleSource = (sourceImage, options = {}) => {
    const selected = mentionSources.some(item => (item.sourceNodeId || item.id) === (sourceImage.sourceNodeId || sourceImage.id));
    /* 来自 @ 菜单：只插入提及（未选中则顺带选中），绝不在菜单里取消选中 */
    if (options.fromMention === true) {
      if (!selected) onToggleSource?.(sourceImage, { skipPromptInsert: true });
      promptFieldRef.current?.insertMention(sourceImage.label);
      return;
    }
    onToggleSource?.(sourceImage, { skipPromptInsert: true });
    if (!selected) promptFieldRef.current?.insertMention(sourceImage.label);
  };
  return <section className="ec-canvas-node-composer ec-canvas-context-composer ec-canvas-text-generation-composer" style={position} aria-label="文案生成操作台" onPointerDown={event => event.stopPropagation()}>
    <ComposerSources sources={sources} role="reference" onAddSources={onAddSources} onRemoveSource={onRemoveSource} uploadLabel="上传参考图" />
    <CanvasPromptField ref={promptFieldRef} data-canvas-control="true" value={node.prompt || ''} mentions={mentionSources} maxLength={TEXT_PROMPT_LIMIT} contentEditable={!loading} className={loading ? 'is-disabled' : ''} placeholder="描述你想生成的画面；看板中的文字会作为画面文字要求" onChange={value => onChange?.({ prompt: value })} />
    <div className="ec-canvas-composer-footer">
      <ComposerMention availableSources={availableSources} selectedSources={mentionSources} activeSurface={activeSurface} onSurfaceChange={onSurfaceChange} onToggleSource={handleToggleSource} />
      <CanvasParameterControls node={node} onChange={onChange} activeSurface={activeSurface} onSurfaceChange={onSurfaceChange} onOpenSkillLibrary={onOpenSkillLibrary} onOpenWorkbench={onOpenWorkbench} />
      <button type="button" data-canvas-control="true" className="shubao-gen-cta ec-canvas-composer-cta" disabled={loading || (!String(node.prompt || '').trim() && !String(node.text || '').trim() && !sources.length)} onClick={event => { event.stopPropagation(); onGenerate?.(); }}>{loading ? '生成中' : <><Sparkles size={15} />生成<span className="shubao-gen-cta-points">{formatCanvasPoints(estimate.points)} 积分</span></>}</button>
    </div>

  </section>;
}

export function CanvasVideoComposer({ node, position,  sources = [], mentionSources = [], availableSources = [], loading = false, activeSurface = '', onSurfaceChange, onChange, onAddSources, onRemoveSource, onToggleSource, onAnalyze, onGenerate, videoProducts = [], onOpenSkillLibrary = null }) {
  const promptFieldRef = useRef(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [previewPlan, setPreviewPlan] = useState(null);
  /* ═══ 批 CY-⑬：把「点外面关掉」接到 `video:*` 键上 ═══════════════════════════════════════════════
     改前这一行是 4 个原生 `<select>` —— 点外面自动收起是**浏览器免费给**的，
     换成站内弹层（CanvasPopoverPortal portal 到 body）之后这份免费午餐就没了：
     不补这个 effect，点画布空白处面板会一直挂着。
     做法与 CanvasParameterControls（`parameter:*`）逐字同源，只有键前缀不同。 */
  const videoControlsRef = useRef(null);
  useEffect(() => {
    if (!activeSurface?.startsWith('video:')) return undefined;
    const close = event => {
      if (!videoControlsRef.current?.contains(event.target)) onSurfaceChange?.(closeCanvasComposerSurface());
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [activeSurface, onSurfaceChange]);
  if (!node) return null;
  const mode = node.mode || 'smart';
  const imageSources = sources.filter(source => source.kind !== 'video' && source.kind !== 'audio');
  const videoSources = sources.filter(source => source.kind === 'video');
  const audioSources = sources.filter(source => source.kind === 'audio');
  const roleFor = source => node.sourceRoles?.[source.id] || source.role || 'reference';
  const firstSources = imageSources.filter(source => roleFor(source) === 'first');
  const lastSources = imageSources.filter(source => roleFor(source) === 'last');
  const referenceImages = mode === 'smart' ? imageSources : imageSources.filter(source => !['first', 'last'].includes(roleFor(source)));
  const mixedReferenceSources = mode === 'smart'
    ? sources
    : sources.filter(source => !['first', 'last'].includes(roleFor(source)));
  const videoFiles = { images: referenceImages, videos: videoSources, first: firstSources, last: lastSources };
  const materialsReady = hasRequiredVideoInputs(mode, videoFiles);
  const planFiles = {
    images: referenceImages.map(source => ({ type: 'image/png', name: source.name || '参考图片' })),
    videos: videoSources.map(source => ({ type: 'video/mp4', name: source.name || '参考视频' })),
    audios: audioSources.map(source => ({ type: 'audio/mpeg', name: source.name || '参考音频' })),
    first: firstSources.map(source => ({ type: 'image/png', name: source.name || '首帧图' })),
    last: lastSources.map(source => ({ type: 'image/png', name: source.name || '尾帧图' })),
  };
  /* 时长档位来自产品契约：上游按秒档位校验（seedance 2.0 只认 5/10/15），
     原先把 4~15 秒全列成可选项、兜底写死 8 秒，用户选中就会被上游拒收。
     方案、报价、请求体统一用吸附后的 durationValue。 */
  const selectedVideoProduct = videoProducts.find(item => item.id === (node.modelProductId || 'seedance_standard')) || videoProducts[0] || null;
  const durationChoices = videoDurationChoices(selectedVideoProduct);
  const durationValue = snapVideoDuration(selectedVideoProduct, node.duration);
  /* ═══ 批 CY-⑬：视频框的两颗触发器（视频模型 / 生成配置）—— 键名带 `video:` 前缀，
     与图片/文案框的 `parameter:*` 分开；技能那格仍走 `parameter:skill`（CanvasSkillControl 的老键名），
     两套互不干扰，Escape / 点画布空白仍能一起关掉（index.jsx 那一处是全局的）。
     选项表从 `<select>` 里**原样搬过来**，值一字未改，只是从"系统下拉"变成"站内弹层"。 */
  const videoProductChoices = videoProducts.length ? videoProducts : [
    { id: 'seedance_standard', label: 'Seedance 2.0 标准', tierLabel: '正式交付' },
    { id: 'seedance_fast', label: 'Seedance 2.0 Fast', tierLabel: '快速成片' },
  ];
  const videoOpen = activeSurface.startsWith('video:') ? activeSurface.slice('video:'.length) : '';
  const toggleVideoSurface = key => onSurfaceChange?.(toggleCanvasComposerSurface(activeSurface, `video:${key}`));
  /* 触发器上那行「当前值」= 选中的视频模型名。取的是**兜底后**的 choices，
     这样在产品表还没加载完（videoProducts 为空）的那一帧，摘要也照常显示 Seedance 2.0 标准，
     不会闪一下空白。 */
  const activeVideoProduct = videoProductChoices.find(item => item.id === (node.modelProductId || 'seedance_standard')) || videoProductChoices[0] || null;
  const [videoModelAnchorRef, videoModelAnchor] = useCanvasPopoverAnchor(videoOpen === 'model' ? 'model' : '');
  const [videoConfigAnchorRef, videoConfigAnchor] = useCanvasPopoverAnchor(videoOpen === 'config' ? 'config' : '');
  const videoAspect = node.aspectRatio || '9:16';
  const videoResolutionLabel = String(node.resolution || '720p').toUpperCase();
  const localPlan = buildVideoPlan({ mode, prompt: node.prompt, files: planFiles, duration: durationValue, ratio: node.aspectRatio || '9:16', resolution: node.resolution || '720p', sound: node.generateAudio !== false });
  const analyzedPlan = previewPlan || node.videoPlan;
  const plan = analyzedPlan ? { ...localPlan, ...analyzedPlan, assets: analyzedPlan.assets?.length ? analyzedPlan.assets : localPlan.assets, beats: analyzedPlan.beats?.length ? analyzedPlan.beats : localPlan.beats, analyzed: true } : { ...localPlan, analyzed: false };
  /* 9-13 用户批注：把「62 积分」这种写死的数字换成随模型/时长变化的真实报价 */
  const estimate = estimateVideoComposerPoints({ products: videoProducts, modelProductId: node.modelProductId || 'seedance_standard', duration: durationValue });
  /* @ 引用：与图片/文案框同一套语义（插入提及，不在菜单里取消选中） */
  const handleToggleSource = (sourceImage, options = {}) => {
    const selected = mentionSources.some(item => (item.sourceNodeId || item.id) === (sourceImage.sourceNodeId || sourceImage.id));
    if (options.fromMention === true) {
      if (!selected) onToggleSource?.(sourceImage, { skipPromptInsert: true });
      promptFieldRef.current?.insertMention(sourceImage.label);
      return;
    }
    onToggleSource?.(sourceImage, { skipPromptInsert: true });
    if (!selected) promptFieldRef.current?.insertMention(sourceImage.label);
  };
  const change = next => { setPreviewPlan(null); onChange?.({ ...next, planReviewed: false, videoPlan: null, plannedVideoAssets: null }); };
  const confirmPlan = () => { onChange?.({ planReviewed: true, error: '' }); setPlanOpen(false); };
  const openPlan = async event => {
    event.stopPropagation();
    if (!localPlan.ready || analyzedPlan) {
      setPlanOpen(true);
      return;
    }
    if (planning) return;
    setPlanning(true);
    try {
      const next = await onAnalyze?.();
      if (next) {
        setPreviewPlan(next);
        setPlanOpen(true);
      }
    } finally {
      setPlanning(false);
    }
  };
  return <section className="ec-canvas-node-composer ec-canvas-context-composer ec-canvas-video-composer" style={position} aria-label="视频生成操作台" onPointerDown={event => event.stopPropagation()}>
    <div className="ec-canvas-video-mode-tabs" role="tablist" aria-label="视频创作模式">
      {VIDEO_CREATION_MODES.map(option => <button key={option.id} type="button" role="tab" aria-selected={mode === option.id} className={mode === option.id ? 'is-active' : ''} onClick={() => change({ mode: option.id, error: '' })}>
        <strong>{option.label}</strong><small>{option.hint}</small>
      </button>)}
    </div>
    {mode === 'frame' ? <div className="ec-canvas-video-material-grid">
      <ComposerSources sources={firstSources} role="first" onAddSources={files => { change({}); onAddSources?.(files, 'first'); }} onRemoveSource={sourceId => { change({}); onRemoveSource?.(sourceId); }} uploadLabel="上传首帧" />
      <ComposerSources sources={lastSources} role="last" onAddSources={files => { change({}); onAddSources?.(files, 'last'); }} onRemoveSource={sourceId => { change({}); onRemoveSource?.(sourceId); }} uploadLabel="上传尾帧" />
    </div> : <div className="ec-canvas-video-material-grid">
      <ComposerSources
        sources={mixedReferenceSources}
        role="reference"
        accept="image/*,video/*,audio/*"
        onAddSources={files => { change({}); onAddSources?.(files, 'reference'); }}
        onRemoveSource={sourceId => { change({}); onRemoveSource?.(sourceId); }}
        uploadLabel={mode === 'remake' ? '添加素材' : '上传素材'}
      />
    </div>}
    {/* 9-13 用户批注：四个框统一要有 @ 键 —— 视频框原来只有 textarea，没有 @ 引用 */}
    <CanvasPromptField ref={promptFieldRef} data-canvas-control="true" value={node.prompt || ''} mentions={mentionSources} maxLength={VIDEO_PROMPT_LIMIT} contentEditable={!loading} className={loading ? 'is-disabled' : ''} placeholder="描述主体、动作、镜头、场景和节奏" onChange={value => change({ prompt: value })} />
    <div className="ec-canvas-video-controls" ref={videoControlsRef}>
      {/* 2026-09-17 用户批注：@ 键放到**最前面**（视频模型之前）。 */}
      {/* 批 CY-㉘：去掉包裹的「引用」二字（用户 2026-09-30 逐字：
          「@ 按钮的上面还有个引用，你要把它拿掉」）。
          `ComposerMention` 内部**只渲染那颗 @ 圆钮**（CanvasStudio.jsx:494 自带
          `aria-label="引用图片"`，无可见文字）⇒ 这个 <span> 是纯多余的一截，
          删掉后 @ 钮仍是第一个，位置与 aria 都不变。 */}
      <label className="ec-canvas-video-field is-mention"><ComposerMention availableSources={availableSources} selectedSources={mentionSources} activeSurface={activeSurface} onSurfaceChange={onSurfaceChange} onToggleSource={handleToggleSource} /></label>
      {/* ═══ 批 CY-⑬：视频框原来这一行是 **4 个原生 `<select>`**（22px 高、无箭头、系统外观，
          与站内其它三个框完全不是一套语言 —— 盘点见文件上方那张表）。现在换成与图片框**同一套**
          两行摘要触发器：视频模型一颗 + 「生成配置」一颗（清晰度 · 画幅 · 时长）。
          ⚠️ 契约一字未改：时长仍走 `videoDurationChoices` + `snapVideoDuration`（换模型时自动夹取），
             清晰度仍只有 720P 一档，选项值与改前逐字相同。 */}
      <div className="ec-canvas-parameter-item">
        <CanvasConfigTrigger
          surface="video-model"
          title="视频模型"
          value={activeVideoProduct?.label || 'Seedance 2.0 标准'}
          icon={<Film size={14} />}
          open={videoOpen === 'model'}
          anchorRef={videoModelAnchorRef}
          onToggle={() => toggleVideoSurface('model')}
          ariaLabel="视频模型"
        />
        <CanvasPopoverPortal open={videoOpen === 'model'} anchor={videoModelAnchor} className="ec-canvas-model-popover" label="视频模型选项">
          {videoProductChoices.map(product => <button key={product.id} type="button" className={product.id === (node.modelProductId || 'seedance_standard') ? 'is-active' : ''} onClick={() => {
            const nextProduct = videoProducts.find(item => item.id === product.id) || null;
            change({ modelProductId: product.id, duration: snapVideoDuration(nextProduct, node.duration) });
            onSurfaceChange?.(closeCanvasComposerSurface());
          }}>
            <span className="ec-canvas-model-copy"><strong>{product.label}</strong><small>{[product.tierLabel, product.quotes?.short?.points ? `${product.quotes.short.points}-${product.quotes?.long?.points || product.quotes.short.points} 积分/次` : ''].filter(Boolean).join(' · ')}</small></span>
          </button>)}
        </CanvasPopoverPortal>
      </div>
      <div className="ec-canvas-parameter-item">
        <CanvasConfigTrigger
          surface="video-config"
          title="生成配置"
          value={`${videoResolutionLabel} · ${videoAspect} · ${durationValue} 秒`}
          icon={<SlidersHorizontal size={14} />}
          open={videoOpen === 'config'}
          anchorRef={videoConfigAnchorRef}
          onToggle={() => toggleVideoSurface('config')}
          ariaLabel="生成配置"
        />
        <CanvasPopoverPortal open={videoOpen === 'config'} anchor={videoConfigAnchor} className="ec-canvas-config-popover" label="生成配置选项">
          <div className="ec-canvas-config-panel-body">
            <CanvasConfigGroup title="清晰度">
              <div className="ec-canvas-config-resolution-row">
                {VIDEO_RESOLUTION_OPTIONS.map(value => <button key={value} type="button" className={value === (node.resolution || '720p') ? 'is-active' : ''} aria-pressed={value === (node.resolution || '720p')} onClick={() => { change({ resolution: value }); onSurfaceChange?.(closeCanvasComposerSurface()); }}><strong>{value}</strong><small>成片</small></button>)}
              </div>
            </CanvasConfigGroup>
            <CanvasConfigGroup title="画幅">
              <div className="ec-canvas-config-ratio-row">
                {VIDEO_ASPECT_OPTIONS.map(value => <button key={value} type="button" className={value === videoAspect ? 'is-active' : ''} aria-pressed={value === videoAspect} onClick={() => { change({ aspectRatio: value }); onSurfaceChange?.(closeCanvasComposerSurface()); }}><i className={`ec-canvas-ratio-shape is-${value.replace(':', '-')}`} /><span>{value}</span></button>)}
              </div>
            </CanvasConfigGroup>
            <CanvasConfigGroup title="时长">
              <div className="ec-canvas-config-count-row">
                {durationChoices.map(value => <button key={value} type="button" className={Number(value) === Number(durationValue) ? 'is-active' : ''} aria-pressed={Number(value) === Number(durationValue)} onClick={() => { change({ duration: Number(value) }); onSurfaceChange?.(closeCanvasComposerSurface()); }}>{value} 秒</button>)}
              </div>
            </CanvasConfigGroup>
          </div>
        </CanvasPopoverPortal>
      </div>
      {/* 9-11: skill 选项 (与图片生成器同源 CANVAS_SKILLS, 预填提示词不覆盖已写内容)
          9-13 用户批注：技能入口要和另外三个框**长得一模一样**（同一个组件 + 同一个「更多技能…」进技能管理）。
          2026-09-17 用户批注（图：视频面板）：技能按钮**没有和其它四项同一套结构** ——
          视频模型/清晰度/画幅/时长都是「上面标题 + 下面控件」两行，
          只有技能是一个光板按钮，于是它「歪上去了」、高低也和别人对不齐
          （实测：其余四项标题顶 825，技能内容顶 852，差 27px）。
          修法：把技能放进**同一结构**的 <label> 里（标题「技能」在上、控件在下），
          与其余四项共用同一套 label/select 样式，不再单独排版。 */}
      {/* ═══ 批 CY-㊴（2026-09-30）：去掉外面那层「技能」文字 ═══════
          用户原话：「而且你这个技能的这个按钮上面怎么还有一个技能呀？」
          9-17 那批把技能包进 <label> 是为了和另外四项同一结构（标题在上、控件在下），
          但另外四项是**裸 select**、没有自带标题，而 CanvasSkillControl 的触发器
          title 本身就是「技能」——于是渲染成「技能 / ⚡ 技能 ▾」，同一个词上下各一份。
          图片侧（:1019 / :1188）一直是直接渲染控件、没有这层 label，所以只有视频面板中招。
          ⇒ 与图片侧对齐：控件自带标题与值，这里不再重复写一遍。 */}
      <CanvasSkillControl node={node} onChange={change} activeSurface={activeSurface} onSurfaceChange={onSurfaceChange} onOpenSkillLibrary={onOpenSkillLibrary} domain="video" />
      {/* ═══ 批 CY-㉘：删掉「声音」开关（用户 2026-09-30 逐字：「最右边这个声音你要把它拿掉啊，
          我们现在首页的视频生成都早就没有这个功能了」）。
          删的是**开关**，不是能力：`generateAudio` 缺省仍是 true，
          index.jsx:4613/4647/4749 三处照旧读它（`!== false`）⇒ 不传就出带声成片，
          行为与改动前默认一致，只是不再给用户一个首页已经取消的选项。 ═══ */}
    </div>
    {planOpen && <section className="ec-canvas-video-plan" aria-label="生成前方案"><header><div><strong>素材分析与生成前方案</strong><small>{plan.analyzed ? '真实素材分析已完成 · 已结算 1 AI 积分' : '补齐输入后进行真实分析'}</small></div><button type="button" data-canvas-control="true" aria-label="关闭生成方案" onClick={() => setPlanOpen(false)}><X size={14} /></button></header><div className="ec-canvas-video-plan-summary"><strong>{plan.laneLabel}</strong><span>{plan.output.ratio} · {plan.output.duration} 秒 · {plan.output.resolution.toUpperCase()}</span></div><div className="ec-canvas-video-plan-beats">{plan.beats.map(beat => <article key={`${beat.time}-${beat.label}`}><span>{beat.time}</span><strong>{beat.label}</strong><small>{beat.detail}</small></article>)}</div>{plan.risks?.length > 0 && <div className="ec-canvas-video-plan-errors">{plan.risks.map((item, index) => <span key={`${item}-${index}`}>风险：{item}</span>)}</div>}{plan.blockers.length > 0 && <div className="ec-canvas-video-plan-errors">{plan.blockers.map(item => <span key={item.code}>{item.title}：{item.detail}</span>)}</div>}<button type="button" data-canvas-control="true" className="ec-canvas-video-plan-confirm" disabled={!plan.ready || !plan.analyzed} onClick={confirmPlan}><Check size={14} />确认方案</button></section>}
    <div className="ec-canvas-composer-footer">
      {node.error ? <div className="ec-canvas-composer-error" role="alert"><span>{node.error}</span></div> : <span>{node.progressLabel || (estimate ? `${formatCanvasPoints(estimate.points)} 积分 / 次 · 确认方案后扣费` : `生成前方案 ${CANVAS_PLAN_ANALYSIS_POINTS} 积分 · 确认方案后扣费`)}</span>}
      <div className="ec-canvas-video-actions">
        {/* ═══ 批 CY-㊴（2026-09-30）：两个生成按钮改为**互斥**，与首页同一口径 ═══════
            用户原话：「为什么会有两个生成按钮呢？一个是分析并生成方案，一个是生成视频。
              你首页那边生成视频的这个板块明明只有一个按钮呀。」
            改前：两个按钮**无条件同时渲染**，第二个只是被 disabled 置灰 ——
            用户看到的是「两个都摆在那儿，其中一个点不动」，读出来的就是「有两个生成按钮」，
            而且置灰按钮不解释为什么灰（他没确认方案），用户只会当成坏了。
            首页（VideoStudio/index.jsx:2569）早就是互斥的：
              未确认方案 → 只有「分析并生成方案」
              已确认方案 → 「查看方案」（次）+「开始生成」（主）
            ⇒ 这里照首页同一口径改：**任何时刻只有一个主按钮**。
                右侧那个「生成视频」在没有已确认方案时压根不渲染（不是置灰）。 ═══ */}
        {!node.planReviewed
          ? <button type="button" data-canvas-control="true" className="ec-canvas-video-plan-trigger" disabled={planning} onClick={openPlan}>
            {planning ? '正在分析素材' : analyzedPlan ? '查看生成方案' : `分析并生成方案 · ${CANVAS_PLAN_ANALYSIS_POINTS} 积分`}
          </button>
          : <>
            <button type="button" data-canvas-control="true" className="ec-canvas-video-plan-trigger" disabled={planning} onClick={openPlan}>
              {planning ? '正在分析素材' : analyzedPlan ? '查看生成方案' : '方案已确认'}
            </button>
            <button type="button" data-canvas-control="true" className="shubao-gen-cta ec-canvas-composer-cta" disabled={loading || planning || !String(node.prompt || '').trim() || !materialsReady || !node.videoPlan} onClick={event => { event.stopPropagation(); onGenerate?.(); }}>
              {loading ? '生成中' : <><Clapperboard size={15} />开始生成{estimate && <span className="shubao-gen-cta-points">{formatCanvasPoints(estimate.points)} 积分</span>}</>}
            </button>
          </>
        }
      </div>
    </div>

  </section>;
}

export function CanvasEcommerceComposer({ node, position,  sources = [], mentionSources = [], availableSources = [], loading = false, activeSurface = '', onSurfaceChange, onChange, onAddSources, onRemoveSource, onToggleSource, onGenerate, onOpenSkillLibrary = null, onRegenerateSuitePlan = null, onOpenWorkbench = null }) {
  const promptFieldRef = useRef(null);
  if (!node) return null;
  const directions = Array.isArray(node.directions) ? node.directions : [];
  const planning = node.suiteStep === 'directions';
  const planReady = Boolean(node.suitePlan || directions.length);
  /* 2026-09-17 产品决定：**方案未确认时什么都不发生**。
     planConfirmed 是显式字段（不是"有方案就算确认"）——
     否则用户只点了一次「生成设计方案」、还没看没点头，第二次点击就已经扣费出图。 */
  const planConfirmed = node.planConfirmed === true;
  /* 9-13 用户批注：套图框也要像首页一样显示动态积分（整套张数 × 单价，改方案/模型/清晰度实时变） */
  const suiteConfig = suiteConfiguration(node);
  const suiteEstimate = estimateSuiteComposerPoints({
    platform: suiteConfig.platform,
    sizing: suiteConfig.sizing,
    resolution: suiteConfig.genSettings?.resolution || node.resolution,
    imageModel: suiteConfig.genSettings?.imageModel || node.imageModel,
    /* 2026-09-17：SKU 变体各出一张图，报价必须算进去（与后端 quantity 同口径） */
    skus: suiteConfig.skus,
  });
  const suitePoints = planning ? suiteEstimate.points : CANVAS_PLAN_ANALYSIS_POINTS;
  return <section data-canvas-control="true" className="ec-canvas-node-composer ec-canvas-context-composer ec-canvas-suite-composer" style={position} aria-label={planning ? '编辑整体设计方案' : '电商套图操作台'} onPointerDown={event => event.stopPropagation()}>
    {!planning && <div className="ec-canvas-suite-source-rows">
      <ComposerSources sources={sources.filter(source => (node.sourceRoles?.[source.id] || source.role) === 'product')} role="product" onAddSources={files => onAddSources?.(files, 'product')} onRemoveSource={onRemoveSource} uploadLabel="上传产品图" />
      <ComposerSources sources={sources.filter(source => (node.sourceRoles?.[source.id] || source.role) !== 'product')} role="reference" onAddSources={files => onAddSources?.(files, 'reference')} onRemoveSource={onRemoveSource} uploadLabel="上传参考图" />
    </div>}
    {!planning ? <>
      <CanvasPromptField ref={promptFieldRef} data-canvas-control="true" value={node.prompt || ''} mentions={mentionSources} maxLength={IMAGE_PROMPT_LIMIT} contentEditable={!loading} className={loading ? 'is-disabled' : ''} placeholder="补充商品卖点、目标人群、使用场景或想要的视觉方向" onChange={value => onChange?.({ prompt: value })} />
    </> : <CanvasSuitePlanEditor
        plan={buildCanvasSuitePlan(node.suitePlan || directions[0], node.prompt)}
        onChange={plan => onChange?.({ suitePlan: plan })}
        confirmed={planConfirmed}
        /* 确认方案 = 方案成为唯一事实源；此后生成按钮才可用 */
        onConfirm={() => onChange?.({ planConfirmed: true, error: '' })}
        /* 重新生成方案：旧方案保留可对比、不删除（压进 previousSuitePlans），
           并复位为「待确认」—— 换了方案就必须重新确认，否则又变成存在即生效。 */
        onRegenerate={onRegenerateSuitePlan ? () => {
          const current = node.suitePlan || directions[0];
          onChange?.({
            planConfirmed: false,
            suiteStep: 'directions',
            previousSuitePlans: [...(node.previousSuitePlans || []), ...(current ? [{ plan: current, replacedAt: Date.now() }] : [])],
            error: '',
          });
          onRegenerateSuitePlan();
        } : undefined}
        regenerating={loading}
      />}
    {/* 9-16（图8/图9）：四个框统一顺序 @ → 参数 → 技能 → 生成。
        套图的参数行（套图方案/SKU/商品信息/内容规范/生成设置）就是这一步的「参数」，
        放在底栏之上单独一行（它需要整行宽度，挤进底栏会把技能和生成按钮压变形）；
        底栏保持 @ → 技能 → 生成 的同一位置。 */}
    <CanvasSuiteControls
      node={node}
      onChange={onChange}
      activeSurface={activeSurface}
      onSurfaceChange={onSurfaceChange}
      availableSources={availableSources}
      mentionSources={mentionSources}
      onToggleSource={onToggleSource}
        promptFieldRef={promptFieldRef}
        onOpenSkillLibrary={onOpenSkillLibrary}
        onOpenWorkbench={onOpenWorkbench}
      />
    <div className="ec-canvas-composer-footer">
      {node.error ? <div className="ec-canvas-composer-error" role="alert">
        <span>{node.error}</span>
        <button type="button" data-canvas-control="true" disabled={loading} onClick={event => { event.stopPropagation(); onGenerate?.(); }}>重新生成</button>
      </div> : <>
        <span>{planning
          ? (planConfirmed
            ? `方案已确认 · 共 ${suiteEstimate.count} 张`
            : `方案待确认 · 共 ${suiteEstimate.count} 张`)
          : '先分析商品与参考图，再进入整体设计方案'}</span>
        {/* ⚠️ 2026-09-27 批 CU：「生成设置」（模型 · 清晰度）**已从底栏挪到参数行**（见 CanvasSuiteControls 末尾）——
            用户原话：「模型的选择和生成配置的那些按钮，你看是不是应该拿上来呢？」。
            这一行现在只剩：状态说明 + 可选门槛提示 + 主 CTA（与图片/视频框的底栏同一套）。 */}
        {/* 提示语纪律：短、说结果不说机制。方案待确认时按钮禁用并直接说「请先确认方案」。 */}
        {planning && !planConfirmed && <span className="ec-canvas-suite-plan-gate" role="status">请先确认方案</span>}
        <button type="button" data-canvas-control="true" className="shubao-gen-cta ec-canvas-composer-cta" disabled={loading || (!planning && !sources.length) || (!planning && !String(node.prompt || '').trim()) || (planning && !planReady) || (planning && !planConfirmed)} title={planning && !planConfirmed ? '请先确认方案' : undefined} onClick={event => { event.stopPropagation(); onGenerate?.(); }}>{loading ? '处理中' : <><Sparkles size={15} />{planning ? '开始生成' : '生成设计方案'}<span className="shubao-gen-cta-points">{formatCanvasPoints(suitePoints)} 积分</span></>}</button>
      </>}
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
  const stageRef = useRef(null);
  const [annotationTextDraft, setAnnotationTextDraft] = useState(null);
  // 草稿双写：state 驱动输入框渲染，ref 保证「点完成」等离散事件能同步读到最新文字。
  const annotationTextDraftRef = useRef(null);
  const [customGridOpen, setCustomGridOpen] = useState(false);
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
  const grid = Number(options.grid) || 3;
  const gridRows = Number(options.gridRows ?? grid);
  const gridCols = Number(options.gridCols ?? grid);
  const verticalGuides = getGridGuidePositions(gridCols, options.gridVertical);
  const horizontalGuides = getGridGuidePositions(gridRows, options.gridHorizontal);
  const ratios = mode === 'crop' ? ['原比例', '自由', '1:1', '3:4', '4:3', '9:16'] : [];
  const annotations = options.annotations || [];
  const cropRect = normalizeCanvasCropRect(options.cropRect || { x: 0.08, y: 0.08, w: 0.84, h: 0.84 });
  const moveSourceRect = options.sourceRect ? normalizeCanvasCropRect(options.sourceRect) : null;
  const moveTargetRect = options.targetRect ? normalizeCanvasCropRect(options.targetRect) : null;
  const hasMoveSource = Boolean(moveSourceRect && moveSourceRect.w >= 0.03 && moveSourceRect.h >= 0.03);
  const hasMoveTarget = Boolean(moveTargetRect && moveTargetRect.w >= 0.03 && moveTargetRect.h >= 0.03);
  const pointFromEvent = event => {
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
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
  const commitAnnotationText = () => {
    // flush 兜底：先清 ref 再提交，保证 blur / Enter / 点完成 多路触发时只落一次笔迹。
    const draft = annotationTextDraftRef.current;
    annotationTextDraftRef.current = null;
    setAnnotationTextDraft(null);
    if (!draft) return;
    const text = String(draft.text || '').trim();
    if (!text) return;
    const shape = createCanvasAnnotation('text', draft, {
      color: options.annotationColor,
      width: options.annotationWidth,
      text,
    });
    commitAnnotations([...annotations, shape]);
  };
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
  // 宫格行列拆分：预设保持 N×N，自定义时行列各自独立（1~8），分割线拖拽复用 moveGridGuide。
  const gridIsPreset = [2, 3, 4, 5].includes(gridRows) && gridRows === gridCols;
  const applyGridPreset = value => {
    setCustomGridOpen(false);
    onOptionChange?.({
      ...options,
      grid: value,
      gridRows: value,
      gridCols: value,
      gridVertical: getGridGuidePositions(value),
      gridHorizontal: getGridGuidePositions(value),
    });
  };
  const applyGridDimension = (axis, value) => {
    const rows = axis === 'rows' ? value : gridRows;
    const cols = axis === 'cols' ? value : gridCols;
    onOptionChange?.({
      ...options,
      grid: Math.max(rows, cols),
      gridRows: rows,
      gridCols: cols,
      gridVertical: getGridGuidePositions(cols, options.gridVertical),
      gridHorizontal: getGridGuidePositions(rows, options.gridHorizontal),
    });
  };
  const onStagePointerDown = event => {
    event.stopPropagation();
    const point = pointFromEvent(event);
    if (isAnnotation) {
      const tool = options.annotationTool || 'pen';
      if (tool === 'text') {
        const draft = { ...point, text: '' };
        annotationTextDraftRef.current = draft;
        setAnnotationTextDraft(draft);
      } else {
        const shape = createCanvasAnnotation(tool, point, { color: options.annotationColor, width: options.annotationWidth });
        commitAnnotations([...annotations, shape]);
        gestureRef.current = { kind: 'annotation', id: shape.id };
      }
    } else if (isSplit) {
      const splitPosition = (options.direction || 'vertical') === 'vertical' ? point.x : point.y;
      onOptionChange?.({ ...options, splitPosition });
      gestureRef.current = { kind: 'split' };
    } else if (isGrid) {
      return;
    } else if (mode === 'crop') {
      onOptionChange?.({ ...options, ratio: '自由', cropRect: { x: point.x, y: point.y, w: 0, h: 0 } });
      gestureRef.current = { kind: 'crop', start: point };
    } else if (isMoveScale) {
      if (options.moveStage === 'target-adjust') return;
      onOptionChange?.({ ...options, moveStage: 'drawing', sourceRect: { x: point.x, y: point.y, w: 0, h: 0 }, targetRect: null });
      gestureRef.current = { kind: 'move-source-draw', start: point };
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onGridGuidePointerDown = (event, axis, index) => {
    event.stopPropagation();
    gestureRef.current = { kind: 'grid', axis, index };
    stageRef.current?.setPointerCapture?.(event.pointerId);
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
    } else if (gesture.kind === 'grid') {
      const current = gesture.axis === 'vertical' ? verticalGuides : horizontalGuides;
      const next = moveGridGuide(current, gesture.index, gesture.axis === 'vertical' ? point.x : point.y);
      onOptionChange?.({
        ...options,
        [gesture.axis === 'vertical' ? 'gridVertical' : 'gridHorizontal']: next,
      });
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
    } else if (gesture.kind === 'move-source-draw') {
      onOptionChange?.({
        ...options,
        moveStage: 'drawing',
        sourceRect: normalizeCanvasCropRect({
          x: Math.min(gesture.start.x, point.x),
          y: Math.min(gesture.start.y, point.y),
          w: Math.abs(point.x - gesture.start.x),
          h: Math.abs(point.y - gesture.start.y),
        }),
        targetRect: null,
      });
    } else if (gesture.kind === 'move-target') {
      const dx = point.x - gesture.start.x;
      const dy = point.y - gesture.start.y;
      onOptionChange?.({
        ...options,
        targetRect: normalizeCanvasCropRect({
          ...gesture.rect,
          x: Math.max(0, Math.min(1 - gesture.rect.w, gesture.rect.x + dx)),
          y: Math.max(0, Math.min(1 - gesture.rect.h, gesture.rect.y + dy)),
        }),
      });
    } else if (gesture.kind === 'resize-target') {
      const rect = gesture.rect;
      const left = gesture.handle.includes('w') ? point.x : rect.x;
      const right = gesture.handle.includes('e') ? point.x : rect.x + rect.w;
      const top = gesture.handle.includes('n') ? point.y : rect.y;
      const bottom = gesture.handle.includes('s') ? point.y : rect.y + rect.h;
      onOptionChange?.({
        ...options,
        targetRect: normalizeCanvasCropRect({
          x: Math.min(left, right),
          y: Math.min(top, bottom),
          w: Math.max(0.03, Math.abs(right - left)),
          h: Math.max(0.03, Math.abs(bottom - top)),
        }),
      });
    }
  };
  const beginMoveTarget = event => {
    if (!moveTargetRect) return;
    event.stopPropagation();
    gestureRef.current = { kind: 'move-target', start: pointFromEvent(event), rect: moveTargetRect };
    stageRef.current?.setPointerCapture?.(event.pointerId);
  };
  const beginResizeMoveTarget = (event, handle) => {
    if (!moveTargetRect) return;
    event.stopPropagation();
    gestureRef.current = { kind: 'resize-target', handle, rect: moveTargetRect };
    stageRef.current?.setPointerCapture?.(event.pointerId);
  };
  const finishGesture = event => {
    event.stopPropagation();
    gestureRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };
  return <div className={`ec-canvas-focused-editor is-${mode}`} aria-label={FOCUSED_EDITOR_LABELS[mode] || '图片编辑'} style={{ left: node.x, top: node.y, width: node.w, height: node.h }} onPointerDown={event => event.stopPropagation()}>
    <div ref={stageRef} className="ec-canvas-focused-stage" onPointerDown={onStagePointerDown} onPointerMove={onStagePointerMove} onPointerUp={finishGesture} onPointerCancel={finishGesture}>
      <ResponsiveImage src={node.localPreviewUrl || node.url} alt={node.name || '待编辑图片'} variant="canvas" sizes={`${Math.ceil(node.w)}px`} style={{ width: '100%', height: '100%' }} imgStyle={{ objectFit: 'contain' }} />
      {isMoveScale && !hasMoveSource && <span className="ec-canvas-move-scale-hint">在要移动的对象上拖拽画框</span>}
      {isMoveScale && hasMoveSource && <div className="ec-canvas-move-scale-source" style={{ left: `${moveSourceRect.x * 100}%`, top: `${moveSourceRect.y * 100}%`, width: `${moveSourceRect.w * 100}%`, height: `${moveSourceRect.h * 100}%` }}><span>原位置</span></div>}
      {isMoveScale && hasMoveTarget && <div
        className="ec-canvas-move-scale-target"
        style={{ left: `${moveTargetRect.x * 100}%`, top: `${moveTargetRect.y * 100}%`, width: `${moveTargetRect.w * 100}%`, height: `${moveTargetRect.h * 100}%`, transform: `rotate(${Number(options.rotation) || 0}deg)` }}
        onPointerDown={beginMoveTarget}
      >
        <span>新位置</span>
        {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(handle => <button key={handle} type="button" aria-label={`从${handle}调整目标大小`} className={`ec-canvas-move-scale-handle is-${handle}`} onPointerDown={event => beginResizeMoveTarget(event, handle)} />)}
      </div>}
      {mode === 'crop' && <div className="ec-canvas-crop-frame" style={{ left: `${cropRect.x * 100}%`, top: `${cropRect.y * 100}%`, width: `${cropRect.w * 100}%`, height: `${cropRect.h * 100}%` }}><i /><i /><i /><i /></div>}
      {isSplit && <span className={`ec-canvas-split-guide is-${options.direction || 'vertical'}`} style={(options.direction || 'vertical') === 'vertical' ? { left: `${(options.splitPosition ?? 0.5) * 100}%` } : { top: `${(options.splitPosition ?? 0.5) * 100}%` }} />}
      {isGrid && <>
        <span className="ec-canvas-grid-guide" />
        <div className="ec-canvas-grid-guides" aria-label="宫格分割线">
          {verticalGuides.map((position, index) => <button key={`vertical-${index}`} type="button" aria-label={`拖动第${index + 1}条竖向分割线`} className="ec-canvas-grid-guide-line is-vertical" style={{ left: `${position * 100}%` }} onPointerDown={event => onGridGuidePointerDown(event, 'vertical', index)} />)}
          {horizontalGuides.map((position, index) => <button key={`horizontal-${index}`} type="button" aria-label={`拖动第${index + 1}条横向分割线`} className="ec-canvas-grid-guide-line is-horizontal" style={{ top: `${position * 100}%` }} onPointerDown={event => onGridGuidePointerDown(event, 'horizontal', index)} />)}
        </div>
      </>}
      {isAnnotation && <svg className={`ec-canvas-annotation-layer is-${options.annotationTool || 'pen'}`} aria-label="标注区域" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        {annotations.map(shape => {
          const strokeWidth = Math.max(2, Number(shape.width || 3) * 2);
          if (shape.tool === 'pen') return <polyline key={shape.id} points={(shape.points || []).map(point => `${point.x * 1000},${point.y * 1000}`).join(' ')} fill="none" stroke={shape.color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />;
          if (shape.tool === 'rectangle') return <rect key={shape.id} x={shape.x * 1000} y={shape.y * 1000} width={shape.w * 1000} height={shape.h * 1000} fill="none" stroke={shape.color} strokeWidth={strokeWidth} />;
          if (shape.tool === 'arrow') {
            /* 9-11 用户批注#3: 箭头要完整 (线 + 箭尾) — 箭尾用三角 V 形手算 (与线同色同粗),
               不依赖 SVG marker 箭头 (主流浏览器对 marker fill 的样式继承支持不一致) */
            const ax = shape.x1 * 1000, ay = shape.y1 * 1000, bx = shape.x2 * 1000, by = shape.y2 * 1000;
            const angle = Math.atan2(by - ay, bx - ax);
            const head = Math.max(34, strokeWidth * 4);
            const h1 = `${bx - head * Math.cos(angle - 0.48)},${by - head * Math.sin(angle - 0.48)}`;
            const h2 = `${bx - head * Math.cos(angle + 0.48)},${by - head * Math.sin(angle + 0.48)}`;
            return <g key={shape.id}>
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke={shape.color} strokeWidth={strokeWidth} strokeLinecap="round" />
              <polyline points={`${h1} ${bx},${by} ${h2}`} fill="none" stroke={shape.color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            </g>;
          }
          return <text key={shape.id} x={shape.x * 1000} y={shape.y * 1000} fill={shape.color} fontSize={Math.max(32, strokeWidth * 8)} fontWeight="700">{shape.text}</text>;
        })}
      </svg>}
      {isAnnotation && annotationTextDraft && <input
        className="ec-canvas-annotation-text-input"
        type="text"
        autoFocus
        aria-label="在图片上输入文字"
        value={annotationTextDraft.text}
        style={{ left: `${annotationTextDraft.x * 100}%`, top: `${annotationTextDraft.y * 100}%`, color: options.annotationColor || '#ef4444' }}
        onPointerDown={event => event.stopPropagation()}
        onChange={event => {
          const next = { ...(annotationTextDraftRef.current || {}), text: event.target.value };
          annotationTextDraftRef.current = next;
          setAnnotationTextDraft(next);
        }}
        onBlur={commitAnnotationText}
        onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); commitAnnotationText(); }
          if (event.key === 'Escape') { event.preventDefault(); setAnnotationTextDraft(null); }
        }}
      />}
    </div>
    <div className="ec-canvas-focused-toolbar" role="toolbar" aria-label={FOCUSED_EDITOR_LABELS[mode]}>
      <strong>{FOCUSED_EDITOR_LABELS[mode]}</strong>
      {ratios.map(ratio => <button key={ratio} type="button" className={(options.ratio || '原比例') === ratio ? 'is-active' : ''} onClick={() => setCropRatio(ratio)}>{ratio}</button>)}
      {isGrid && [2, 3, 4, 5].map(value => <button key={value} type="button" className={!customGridOpen && gridIsPreset && gridRows === value ? 'is-active' : ''} onClick={() => applyGridPreset(value)}>{value} x {value}</button>)}
      {isGrid && <button type="button" className={!gridIsPreset || customGridOpen ? 'is-active' : ''} onClick={() => setCustomGridOpen(true)}>自定义</button>}
      {isGrid && (customGridOpen || !gridIsPreset) && <>
        <label className="ec-canvas-focused-field"><span>行</span><select aria-label="宫格行数" value={gridRows} onChange={event => applyGridDimension('rows', Number(event.target.value))}>{GRID_DIMENSION_CHOICES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="ec-canvas-focused-field"><span>列</span><select aria-label="宫格列数" value={gridCols} onChange={event => applyGridDimension('cols', Number(event.target.value))}>{GRID_DIMENSION_CHOICES.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      </>}
      {isSplit && ['vertical', 'horizontal'].map(direction => <button key={direction} type="button" className={(options.direction || 'vertical') === direction ? 'is-active' : ''} onClick={() => onOptionChange?.({ ...options, direction })}>{direction === 'vertical' ? '垂直分割' : '水平分割'}</button>)}
      {isAnnotation && <>
        {[
          ['pen', '画笔', Pencil],
          ['rectangle', '矩形', Square],
          ['arrow', '箭头', ArrowUpRight],
          ['text', '文字', FileText],
        ].map(([tool, label, Icon]) => <button key={tool} type="button" title={label} aria-label={label} className={(options.annotationTool || 'pen') === tool ? 'is-active' : ''} onClick={() => onOptionChange?.({ ...options, annotationTool: tool })}><Icon size={15} /></button>)}
        <label className="ec-canvas-focused-field is-icon-only" title="标注颜色"><span className="sr-only">颜色</span><input type="color" aria-label="标注颜色" value={options.annotationColor || '#ef4444'} onChange={event => onOptionChange?.({ ...options, annotationColor: event.target.value })} /></label>
        <label className="ec-canvas-focused-field" title={`标注粗细 ${options.annotationWidth || 3}px`}><span>粗细</span><input type="range" aria-label="标注粗细" min="1" max="12" value={options.annotationWidth || 3} onChange={event => onOptionChange?.({ ...options, annotationWidth: Number(event.target.value) })} /><output>{options.annotationWidth || 3}px</output></label>
        <button type="button" title="撤销" aria-label="撤销" disabled={!options.annotationHistory?.length} onClick={undoAnnotation}><Undo2 size={15} /></button>
        <button type="button" title="重做" aria-label="重做" disabled={!options.annotationFuture?.length} onClick={redoAnnotation}><Redo2 size={15} /></button>
        <button type="button" title="清除标注" aria-label="清除标注" onClick={() => commitAnnotations([])}><Eraser size={15} /></button>
      </>}
      {isMoveScale && <>
        {!hasMoveTarget && <button type="button" className="is-active" disabled={!hasMoveSource} onClick={() => onOptionChange?.({ ...options, moveStage: 'target-adjust', targetRect: moveSourceRect, rotation: 0 })}>确认原位置</button>}
        {hasMoveTarget && <>
          <span className="ec-canvas-focused-status">拖动蓝框调整位置，拖动控制点缩放</span>
          <label className="ec-canvas-focused-field is-wide"><span>旋转</span><input type="range" aria-label="目标旋转角度" min="-180" max="180" step="1" value={options.rotation || 0} onChange={event => onOptionChange?.({ ...options, rotation: Number(event.target.value) })} /><output>{Math.round(options.rotation || 0)}°</output></label>
          <button type="button" onClick={() => onOptionChange?.({ ...options, moveStage: 'drawing', sourceRect: null, targetRect: null, rotation: 0 })}>重新框选</button>
        </>}
      </>}
      <i />
      <button type="button" onClick={onCancel}><X size={15} />取消</button>
      <button type="button" className="is-primary" disabled={isMoveScale && (!hasMoveSource || !hasMoveTarget)} onPointerDown={() => { if (isAnnotation && annotationTextDraftRef.current) commitAnnotationText(); }} onClick={onConfirm}><Check size={15} />完成</button>
    </div>
  </div>;
}

function DerivePort({ visible, disabled, onPointerDown, onPointerUp, onClick, side = 'output', active = false }) {
  /* disabled 不再真正禁用 (禁用按钮点了毫无反馈 = 用户眼中的"死按钮"),
     改为 data-disabled 半透明, 点击时由 handler 弹出原因提示。
     9-11 用户批注: 节点左右都要有加号 — side='input' 是左侧输入锚点 (上游素材从此接入,
     连线端点与加号中心重叠, 见 canvasGeometry.CANVAS_PORT_CENTER_OFFSET)。 */
  const isInput = side === 'input';
  /* ═══ 2026-09-30 批 CY-㊴：side 必须**透传**给 handler ═══════════════════════
     事故：两侧的 `onPointerUp` 都被父组件写死成 `'out'`，于是
     `handlePortPointerUp` 的 `if (side !== 'in') return;` 直接把它丢掉 ——
     用户看到的现象是「左边也有个加号，但把线拉过去连不上」。
     这里把 side 按 handler 认的口径（'in' / 'out'）传出去。 */
  const handlerSide = isInput ? 'in' : 'out';
  /* active = 拖线时"吸附候选"高亮（批 CY-㊴，用户要的是"拉到加号上吸附上去"）。 */
  return <button
    type="button"
    className={isInput ? 'ec-canvas-node-port is-input' : 'ec-canvas-node-port'}
    data-canvas-control="true"
    data-canvas-port-role={isInput ? 'input' : 'output'}
    data-port-active={active ? 'true' : undefined}
    aria-label={isInput ? '从当前素材继续创作' : '从当前素材继续创作'}
    title={disabled ? '素材处理完成后可继续创作' : '继续创作'}
    data-disabled={disabled ? true : undefined}
    tabIndex={visible ? 0 : -1}
    style={{ opacity: visible || active ? 1 : 0, pointerEvents: visible || active ? 'auto' : 'none' }}
    onPointerDown={event => { event.stopPropagation(); onPointerDown?.(event, handlerSide); }}
    /* pointerup 必须冒泡到 stage: 否则连接草稿残留, 画布卡在 connect 模式,
       表现为"加号没反应 + 之后所有素材拖不动" (用户 9-04 反馈) */
    onPointerUp={event => onPointerUp?.(event, handlerSide)}
    onClick={event => { event.stopPropagation(); onClick?.(event, handlerSide); }}
  ><Plus size={16} /></button>;
}

function ResizeHandles({ visible, onResizeStart }) {
  if (!visible) return null;
  return ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(corner => <button
    key={corner}
    type="button"
    aria-label={`从${corner}调整尺寸`}
    className={`ec-canvas-resize-handle is-${corner}`}
    data-canvas-control="true"
    onPointerDown={event => { event.stopPropagation(); onResizeStart?.(event, corner); }}
  />);
}

/* 素材水印预览层：与面板预览共用 WatermarkLayer，保证「预览 == 素材」 */
function MaterialWatermarkOverlay({ kind, watermark, width = 1, height = 1 }) {
  return <WatermarkLayer config={watermark} material={kind} width={width} height={height} className="ec-wm-on-node" />;
}

export { MaterialWatermarkOverlay };

/* ═══ 批 CY-㊴ 之十八（2026-10-01）：节点组件一律 React.memo ═══════════════════════
   画布上动一个节点会重渲染**整棵树**；没有 memo 的话，画布上每一个节点都会跟着
   重新执行一遍（实测每节点约 47 个元素）。

   ⚠️ memo 只在 props 引用**都没变**时才跳过渲染。所以 index.jsx 那边必须同时
   把内联箭头换成"按 node.id 缓存的稳定回调"（canvasNodeHandlers.js）——
   只包 memo 而不换箭头，等于白包（每次渲染 props 里的函数都是新的）。

   这里把函数改名成 *View，导出的是 memo 包装版；这样**导出名不变**，
   index.jsx 的 import 与既有的契约门禁都不用动。 */
function CanvasImageNodeView({
  node,
  imageWatermark,
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
  onNaturalSize,
  canDerive = true,
  onReplace = null,
  onImageReady = null,
  /* 批 CY-㊴：拖线期间的端口可见性与吸附高亮。
     · connectActive：正在从别处拉线 ⇒ **所有**节点的输入加号都要亮出来可点，
       否则未选中节点的端口是 pointer-events:none，线根本落不上去（用户 9-30 实测）。
     · snapActive：本节点的输入端口正是当前吸附候选。 */
  connectActive = false,
  snapActive = false,
}) {
  /* 批 CY-㊴（2026-10-01）：图片加载失败要有**可见、可恢复**的落点。
     之前这张图没有 onError —— 失败时界面上什么都不渲染，就是一个白框，
     用户分不清"还在加载"还是"加载失败"，也没法恢复（他只能刷新或重传）。
     retryKey 用来给 src 加 cache-busting，点「重试」重新拉一次。 */
  const [imgFailed, setImgFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const mediaSrcBase = node.localPreviewUrl || node.url || '';
  const mediaSrc = `${mediaSrcBase}${retryKey ? `?retry=${retryKey}` : ''}`;
  /* 换图（替换素材 / 换 url）要把失败态清掉，否则会一直停在"加载失败"上。 */
  const lastSrcRef = useRef(mediaSrc);
  if (lastSrcRef.current !== mediaSrc) {
    lastSrcRef.current = mediaSrc;
    if (imgFailed) { setImgFailed(false); setRetryKey(0); }
  }
  /* 9-16（图15~19）：打组后的组内节点不显示左右加号（绑定元素不改变这一点） */
  const inCanvasGroup = canvasGroupKindOf(node.groupId) === 'group';
  const presentation = getCanvasNodePresentation({ selected, hovered, focusActive, related });
  if (inCanvasGroup) presentation.handlesVisible = false;
  /* 用户 9-10 反馈: 模板素材节点必须与真实上传素材完全同款 —— 不再有自造"槽位"描边与提示文案。 */
  return <article
    data-canvas-node-id={node.id}
    className={`ec-canvas-media-node is-${presentation.state} ${presentation.dimmed ? 'is-dimmed' : ''}`}
    style={{ left: node.x, top: node.y, width: node.w, zIndex: Number.isFinite(node.zIndex) ? node.zIndex : undefined, visibility: node.hidden ? 'hidden' : 'visible', opacity: typeof node.opacity === 'number' ? node.opacity : 1 }}
    onPointerDown={event => onPointerDown?.(event, node.id)}
    onContextMenu={event => { event.preventDefault(); onContextMenu?.(event, node); }}
    onDoubleClick={event => { event.stopPropagation(); onDoubleClick?.(node); }}
    onMouseEnter={() => onHoverChange?.(node.id)}
    onMouseLeave={() => onHoverChange?.(null)}
  >
    <div className="ec-canvas-media-frame" style={{ height: node.h }}>
      {/* ═══ 2026-10-01（批 CY-㊴ 之十五）：没有地址时要说人话 ═══════════════════
          本地草稿不再存 base64（见 canvasDraftRepository 顶部注释：8 张以上图会撑爆
          localStorage 配额，而且那个失败是**静默**的）。于是刷新之后，
          「当时还没传完」的那个节点会**没有任何地址**。

          原来这里会渲染一个 \`<img src="">\` —— 浏览器显示裂图，用户分不清
          「素材坏了」还是「加载中」，也没法补救。

          ⚠️ 这个占位**曾经加错了地方**：第一版加在 index.jsx 里的 \`ImageNode\`
          上，而那个组件在 index.jsx 里**一次都没被用到**（真正渲染的是本文件的
          \`CanvasImageNode\`，被 import 成 \`StudioImageNode\`）。所以那段文案
          连构建产物都没进去 —— 是靠「在 dist 里 grep 中文却找不到」发现的。 */ }
      {!mediaSrcBase && (
        <div className="ec-canvas-media-failed">
          <strong>这张素材当时没传完</strong>
          <span>重新上传原图即可继续使用</span>
        </div>
      )}
      {!imgFailed && mediaSrcBase && <ResponsiveImage
        /* 9-11 用户批注#2: 本地预览优先 — 持久 url 尚未解码成功前用本地 data URI 兜底, 不再空白闪屏 */
        src={mediaSrc}
        alt={node.name || node.displayLabel || '图片'}
        variant="canvas"
        sizes={`${Math.ceil(node.w)}px`}
        ratio={node.ratio}
        style={{ width: '100%', height: '100%' }}
        imgStyle={{ objectFit: 'contain', objectPosition: 'center', transform: `rotate(${Number(node.rotation) || 0}deg) ${node.flipX ? 'scaleX(-1)' : ''} ${node.flipY ? 'scaleY(-1)' : ''}`.trim() }}
        onError={() => setImgFailed(true)}
        onLoad={event => {
          setImgFailed(false);
          const naturalWidth = Number(event.naturalWidth || event.currentTarget?.naturalWidth);
          const naturalHeight = Number(event.naturalHeight || event.currentTarget?.naturalHeight);
          if (naturalWidth > 0 && naturalHeight > 0) onNaturalSize?.(node.id, { naturalWidth, naturalHeight });
          onImageReady?.(node.id);
        }}
      />}
      {imgFailed && (
        /* ═══ 批 CY-㊴（2026-10-01）：图片加载失败**必须有可见、可恢复的落点** ═══════
           用户原话：「有时候图片上传上去就是显示不出来呀。偶尔会出现这种情况。
             这是你的问题呀，你要去解决」
           事故：`<ResponsiveImage>` 之前**没有 onError** —— 加载失败时界面上什么都不渲染，
           就是一个白框：既分不清是"还在加载"还是"加载失败"，也没有任何办法恢复。
           "偶尔"尤其糟：草稿重载时持久图可能还没可读，之后就一直空着。
           ⇒ 失败时显示「加载失败 + 文件名 + 重试」，重试用 cache-busting 换 src 重新拉。 */
        <div className="ec-canvas-media-failed" role="alert">
          <strong>图片加载失败</strong>
          <span>{node.name || node.displayLabel || '未命名素材'}</span>
          <button
            type="button"
            data-canvas-control="true"
            onPointerDown={event => event.stopPropagation()}
            onClick={event => { event.stopPropagation(); setImgFailed(false); setRetryKey(value => value + 1); }}
          >重试</button>
        </div>
      )}
      <MaterialWatermarkOverlay kind="image" watermark={imageWatermark} width={node.w || 1} height={node.h || 1} />
    </div>
    {node.showMeta !== false && <footer>
      <strong>{node.name || node.displayLabel || '未命名图片'}</strong>
      <span>{[node.group, node.ratio, node.size].filter(Boolean).join(' · ')}</span>
    </footer>}
    {/* 9-11 用户批注: 「替换」不放顶部工具条, 放节点本身 (对标流影AI): 选中即现的角标胶囊,
        点选新素材套回本节点, 位置/尺寸/连线/派生关系不变。 */}
    {selected && onReplace && <button
      type="button"
      className="ec-canvas-node-replace"
      data-canvas-control="true"
      aria-label="替换素材"
      title="上传新素材替换当前图片，位置与连线不变"
      onPointerDown={event => event.stopPropagation()}
      onClick={(event) => { event.stopPropagation(); onReplace(); }}
    ><ImagePlus size={13} />替换</button>}
    <ResizeHandles visible={selected && !node.locked} onResizeStart={onResizeStart} />
    {/* 9-11 用户批注: 左右都有加号 — 左侧 = 输入锚点 (上游接入), 右侧 = 输出加号 (继续创作/拉线) */}
    <DerivePort side="input" visible={presentation.handlesVisible || connectActive} active={snapActive} disabled={!node.url || !canDerive} onPointerDown={onPortPointerDown} onPointerUp={onPortPointerUp} onClick={onPortClick} />
    <DerivePort visible={presentation.handlesVisible || connectActive} disabled={!node.url || !canDerive} onPointerDown={onPortPointerDown} onPointerUp={onPortPointerUp} onClick={onPortClick} />
  </article>;
}

function CanvasSourceNodeView({
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
    {/* 9-11: 左右都有加号 (左 = 输入锚点, 右 = 输出加号) */}
    <DerivePort side="input" visible={selected} disabled={!assets.length} onPointerDown={onPortPointerDown} onClick={onPortClick} />
    <DerivePort visible={selected} disabled={!assets.length} onPointerDown={onPortPointerDown} onClick={onPortClick} />
  </article>;
}

function CanvasTextNodeView({ node, selected = false, editing = false, dimmed = false, onPointerDown, onContextMenu, onChange, onSelect, onDoubleClick, onBlur, onResizeStart, onAutoHeight }) {
  const isComposing = useRef(false);
  const boardRef = useRef(null);
  const editSeedRef = useRef('');
  /* 文字框高度跟随内容: 输入超过两行时框体自动长高, 删减时回落 (最小 84) */
  const syncAutoHeight = () => {
    const el = boardRef.current;
    if (!el || typeof onAutoHeight !== 'function') return;
    const next = Math.max(84, Math.ceil(el.scrollHeight) + 10);
    if (Math.abs(next - (Number(node.h) || 84)) > 2) onAutoHeight(node.id, next);
  };
  /* 编辑期间内容走非受控: React 不回写 DOM, 否则每次 onInput 触发 re-render
     都会把光标打回开头, 中文 IME 组合中的字也会被吞掉 */
  useEffect(() => {
    if (!editing) return undefined;
    let seed = node.text || '';
    if (seed === '双击编辑文字') seed = '';
    editSeedRef.current = seed;
    const el = boardRef.current;
    if (el) {
      if (el.textContent !== seed) el.textContent = seed;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    syncAutoHeight();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);
  return <article
    data-canvas-node-id={node.id}
    className={`ec-canvas-copy-node ${node.status === 'running' ? 'is-running' : ''} ${selected ? 'is-selected' : ''} ${dimmed ? 'is-dimmed' : ''}`}
    style={{ left: node.x, top: node.y, width: node.w, height: node.h, opacity: typeof node.opacity === 'number' ? node.opacity : 1 }}
    onPointerDown={event => { event.stopPropagation(); if (!editing) onPointerDown?.(event, node.id); }}
    onDoubleClick={event => { event.stopPropagation(); onDoubleClick?.(node.id); }}
    onContextMenu={event => { event.preventDefault(); onContextMenu?.(event, node); }}
  >
    <div
      ref={boardRef}
      contentEditable={editing}
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder={node.placeholder || '输入文字'}
      style={node.textStyle || undefined}
      onFocus={() => {
        if (!isComposing.current) onSelect?.(node.id);
      }}
      onCompositionStart={() => { isComposing.current = true; }}
      onCompositionEnd={(event) => {
        isComposing.current = false;
        const text = event.currentTarget.textContent || '';
        onChange?.(node.id, text);
        syncAutoHeight();
      }}
      onInput={event => {
        if (isComposing.current) return;
        onChange?.(node.id, event.currentTarget.textContent || '');
        syncAutoHeight();
      }}
      onBlur={() => {
        if (!isComposing.current) onBlur?.(node.id);
      }}
    >{editing ? editSeedRef.current : (node.text || '')}</div>
    <ResizeHandles visible={selected && !editing && !node.locked} onResizeStart={onResizeStart} />
  </article>;
}

function CanvasAudioNodeView({
  node,
  selected = false,
  dimmed = false,
  onPointerDown,
  onContextMenu,
  onHoverChange,
  onResizeStart,
}) {
  return <article
    data-canvas-node-id={node.id}
    className={`ec-canvas-media-node is-${selected ? 'selected' : 'idle'} ${dimmed ? 'is-dimmed' : ''}`}
    style={{ left: node.x, top: node.y, width: node.w, zIndex: Number.isFinite(node.zIndex) ? node.zIndex : undefined, visibility: node.hidden ? 'hidden' : 'visible', opacity: typeof node.opacity === 'number' ? node.opacity : 1 }}
    onPointerDown={event => onPointerDown?.(event, node.id)}
    onContextMenu={event => { event.preventDefault(); onContextMenu?.(event, node); }}
    onMouseEnter={() => onHoverChange?.(node.id)}
    onMouseLeave={() => onHoverChange?.(null)}
  >
    <div className="ec-canvas-media-frame" style={{ height: node.h, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, padding: 14, boxSizing: 'border-box', background: '#f8fafc' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: 12, fontWeight: 750 }}>
        <Volume2 size={18} aria-hidden="true" />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name || node.displayLabel || '项目音频'}</span>
      </div>
      {node.mediaPlaybackStatus === 'unavailable' ? <div role="status" style={{ color: 'var(--sb-credit-spend)', fontSize: 11, lineHeight: 1.5 }}>{node.mediaPlaybackError || '音频播放地址暂时不可用，请稍后重试'}</div> : <audio
        controls
        preload="metadata"
        src={node.url}
        aria-label={node.name || node.displayLabel || '项目音频'}
        style={{ width: '100%', height: 32 }}
        onPointerDown={event => event.stopPropagation()}
      />}
    </div>
    {node.showMeta !== false && <footer><strong>{node.name || node.displayLabel || '项目音频'}</strong><span>{[node.group, node.role].filter(Boolean).join(' · ')}</span></footer>}
    <ResizeHandles visible={selected && !node.locked} onResizeStart={onResizeStart} />
  </article>;
}

/* ═══ 批 CY-㊴ 之十八（2026-10-01）：节点组件一律 React.memo ═════════════════════
   画布上动一个节点会重渲染**整棵树**；没有 memo，画布上每个节点都会跟着重新执行一遍
   （实测每节点约 47 个元素）。
   ⚠️ memo 只在 props 引用都没变时才跳过渲染，所以 index.jsx 那边必须同时把内联箭头
     换成「按 node.id 缓存的稳定回调」（canvasNodeHandlers.js）—— 只包 memo 而不换箭头
     等于白包：每次渲染 props 里的函数都是新的。
   函数改名成 *View、导出 memo 包装版 ⇒ **导出名不变**，index.jsx 的 import 与既有
   契约门禁都不用动。 */
export const CanvasGenerationNode = React.memo(CanvasGenerationNodeView);
export const CanvasDirectionNode = React.memo(CanvasDirectionNodeView);
export const CanvasImageNode = React.memo(CanvasImageNodeView);
export const CanvasSourceNode = React.memo(CanvasSourceNodeView);
export const CanvasTextNode = React.memo(CanvasTextNodeView);
export const CanvasAudioNode = React.memo(CanvasAudioNodeView);
