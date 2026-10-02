import React from 'react';
/* 2026-10-01：图层面板的几何改由 CSS 说了算（照水印面板 `.ec-wm-panel`），
   于是这里曾用到的 `resolveAnchoredRight` / `CANVAS_Z` / `LAYERS_PANEL_WIDTH`
   全部成了死代码 —— 一并删掉。留着会让人以为"定位还在 JS 里"，
   下一个人照着 `resolveAnchoredRight` 改半天，改的却是一条已经不再生效的内联样式。 */
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
  Workflow,
  X,
} from 'lucide-react';
import AccountEntitlementControl from '../../../components/billing/AccountEntitlementControl.jsx';
/* 2026-09-28 批 CX（CV-0）：删掉 `PUBLIC_TEMPLATES` 的 import —— 它只被下面那个
   `hasTemplates`（一个**从未被使用**的常量）引用；而"模板为空就隐藏入口"的初衷已经不需要了：
   入口只剩顶栏那一颗，指向服务端驱动的 `WorkflowTemplateGallery`（空库时它自己有空状态）。 */

function IconButton({ label, children, active = false, disabled = false, onClick, className = '', ...rest }) {
  return <button
    type="button"
    className={`ec-canvas-icon-button ${active ? 'is-active' : ''} ${className}`}
    aria-label={label}
    title={label}
    {...rest}
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
  onOpenWorkflowGallery,
  saving = false,
  canRestore = false,
  entitlement,
}) {
  /* 4c183cd4 空态守卫（已随 CV-0 移除）：这里原有一个 `hasTemplates` 常量用于"模板为空就隐藏入口"，
     但它**从未被任何 JSX 使用**（死变量），且假模板广场拿掉后入口只剩服务端驱动的那一颗。 */
  return <header className="ec-canvas-topbar">
    <div className="ec-canvas-topbar-leading">
      {/* data-canvas-leave-guard：显式标注「这是真正离开画布的入口」。
          离开守卫只认两类目标 —— 这个标记，或指向非 /ec-canvas 的 <a href>。
          顶栏里的弹窗按钮（模板广场/画布库/导出…）都没有这个标记、也不是链接，
          所以打开它们**不会**触发「保存这张画布？」询问（2026-09-18 用户批注修复）。 */}
      <IconButton label="返回" className="ec-canvas-topbar-surface" data-canvas-leave-guard="true" onClick={onBack}><ArrowLeft size={18} /></IconButton>
      <div className="ec-canvas-project-title">
        <strong>{title || '智能画布'}</strong>
        <span><i className={saving ? 'is-saving' : ''} />{saving ? '正在保存' : meta}</span>
      </div>
      <nav className="ec-canvas-tabs ec-canvas-topbar-surface" aria-label="画布视图">
        {/* 9-13 用户批注：回收站是死状态（删掉的东西其实没进去）→ 撤掉；删除即删除。 */}
        {[['canvas', '当前画布'], ['assets', '资产库'], ['works', '作品集']].map(([id, label]) => <button
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
        {/* 4c183cd4 续命 2026-08-30 画布总统筹重审: 拿掉顶部 [1-click 视频] 入口
            用户原话 8-30: "你必须把这些重复的东西都给拿掉"
            1-click 视频改走节点串联: 图片 → 应用节点 → 视频 → 音频 (Quantv §10.2 风格) */}
        {/* 2026-09-01 用户反对多模态串联: 拿掉多模态串联 入口按钮, 视频/音频走节点串联 */}
        {/* 9-11 三轮用户批注: 「模板广场」与「工作流模板」是同一个东西 (模板就是工作流) ——
            两个入口合并为一个「模板广场」, 内容 = 可一键铺开的工作流模板库。 */}
        {tab === 'canvas' && <button type="button" className="ec-canvas-command ec-canvas-topbar-surface" onClick={onOpenWorkflowGallery} aria-label="打开模板广场（工作流模板）">
          <Workflow size={16} />模板广场
        </button>}
        {/* 9-15 用户批注：「顶栏的导出按钮哪去了，之前不是有的吗」→ 找回，与模板广场/恢复已保存画布同一组 */}
        {tab === 'canvas' && <button type="button" className="ec-canvas-command ec-canvas-topbar-surface" onClick={onExport} aria-label="导出画布">
          <Download size={16} />导出
        </button>}
        <IconButton label="恢复已保存画布" className="ec-canvas-topbar-surface" disabled={!canRestore || saving} onClick={onRestore}><RotateCcw size={17} /></IconButton>
      </>}
      {/* 9-02 用户反馈: "新建生图"命名不清. 此按钮新建画布会话, 改名"新建画布" */}
      <button type="button" className="ec-canvas-command ec-canvas-topbar-surface is-dark" onClick={onNew}><Plus size={16} />新建画布</button>
    </div>
  </header>;
}

export function CanvasLeftRail({ addMenuOpen = false, onAddMenuToggle }) {
  return <aside className="ec-canvas-left-rail" aria-label="添加内容">
    <IconButton label={addMenuOpen ? '关闭添加菜单' : '添加节点'} active={addMenuOpen} onClick={onAddMenuToggle} className="ec-canvas-rail-add"><Plus size={22} /></IconButton>
  </aside>;
}

export function CanvasBottomToolbar({ activeTool, onToolChange, onImage, onText }) {
  const tools = [
    { id: 'select', label: '选择工具：拖拽框选 / Shift+点击多选', icon: MousePointer2 },
    { id: 'hand', label: '抓手', icon: Hand },
    { id: 'image', label: '添加图片', icon: ImageUp, onClick: onImage },
    { id: 'text', label: '添加文本', icon: Type, onClick: onText },
    /* ⚠️ 2026-10-01 用户批注：「你这个图层为什么点击之后会弹到上面去呀？我感觉其实这个按钮
       放到中间的下面这里会不会其实不太好？因为他打开的那个面板在中间其实不怎么好。
       你还不如把它放到左下角的那个栏里面。」
       ⇒ 「图层」从底部 dock 移出，改挂在**左下角缩放条**的 trailing 槽（见 index.jsx），
         面板锚点也换成那颗按钮 ⇒ 面板落在左下角这一带，不再跑到画面中间。 */
  ];
  return <div className="ec-canvas-bottom-dock">
    <div className="ec-canvas-bottom-toolbar" role="toolbar" aria-label="画布工具">
      {tools.map(tool => <IconButton
        key={tool.id}
        label={tool.label}
        active={activeTool === tool.id}
        onClick={() => { onToolChange?.(tool.id); tool.onClick?.(); }}
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
  /* 触发元素（底部「图层」按钮）的**视口矩形** —— 弹层据此向右展开。
     由 index.jsx 在打开时量出并下传（见 resolveAnchoredRight）。 */
  anchorRect = null,
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
  /* ⚠️ 2026-10-01 用户批注（这一段原来是「弹层锚在触发元素上向右展开」那套）：
       「你这个图层按钮为什么打开之后的面板是这么高呀？……它整体应该是**吸附在图层这个按钮上面**的，
         而不是悬空的……为什么没有往左边靠呢？……你看一下下面不是有一个**水印面板**吗？他是比较靠左
         一些的，你要照他那样子往左边靠一些」

     ⇒ **几何交给 CSS**（`.ec-canvas-layers-panel` 已照抄水印面板 `.ec-wm-panel`：
       left:60px + bottom:底栏偏移 + 只有 max-height ⇒ 高度随内容、贴底、靠左）。

     为什么之前会「悬空」：这里算出的 `position:fixed + left + bottom` 是**内联样式**，
     优先级高于 EcCanvas.css 那条 class 规则 —— 而 CSS 那边其实一直是贴底的（left:72/bottom:70）。
     两套几何同时存在，内联那套赢，看起来就成了悬在画面中间。
     ⚠️ 同一段还有个副作用：它写死了 `height: max(240, …)`，于是**一个素材也撑出 240px 高**，
     与「有多少素材就张开多少」直接冲突。

     `anchorRect` 保留：它仍用于 aria 定位与将来的「贴着按钮」微调，但**不再驱动几何**。 */
  return <aside className="ec-canvas-layers-panel" data-canvas-control="true" aria-label="图层"
    data-anchored-bottom="true"
    data-anchor-width={anchorRect ? Math.round(anchorRect.width || 0) || undefined : undefined}>
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

export function CanvasZoomControls({ scale, onZoomOut, onZoomIn, onFit, trailing = null }) {
  return <div className="ec-canvas-zoom-controls" role="group" aria-label="画布缩放">
    <IconButton label="缩小" onClick={onZoomOut}><Minus size={15} /></IconButton>
    <span aria-live="polite">{Math.round((Number(scale) || 1) * 100)}%</span>
    <IconButton label="放大" onClick={onZoomIn}><Plus size={15} /></IconButton>
    <IconButton label="适配画布" onClick={onFit}><Maximize2 size={15} /></IconButton>
    {trailing}
  </div>;
}
