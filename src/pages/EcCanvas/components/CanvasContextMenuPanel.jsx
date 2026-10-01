/* ═══════ 4c183cd4 续命 画布总监督 - 画布右键菜单 + 双击添加 (2026-08-30) ═══════
   Quantv CanvasMenus.contextPoint 复刻: 空白处右键 → 上传/资产库/撤销/粘贴/全选/适配/排版/主题
   双击画布空白处 → 弹出 5 种基础节点添加面板
   用户原话 8-30: "最成品, 最面向市场, 最高级的一个体验和流畅度" */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Type, ImagePlus, Film, Music, Sparkles, Folder, ClipboardPaste, Undo2, Redo2,
  CheckSquare, Maximize, LayoutGrid, Grid3x3, Sun, Plus, Search,
} from 'lucide-react';
import { CANVAS_RIGHT_CLICK_ACTIONS, getKindLabel } from '../canvasQuantvExtensions.js';

const ICON_MAP = Object.freeze({
  type: Type,
  image: ImagePlus,
  film: Film,
  music: Music,
  sparkles: Sparkles,
  folder: Folder,
  clipboard: ClipboardPaste,
  undo: Undo2,
  redo: Redo2,
  'check-square': CheckSquare,
  maximize: Maximize,
  'layout-grid': LayoutGrid,
  grid: Grid3x3,
  sun: Sun,
});

const ACTION_GROUP_LABELS = Object.freeze({
  add: '添加节点',
  edit: '编辑',
  view: '视图',
});

export default function CanvasContextMenuPanel({
  x = 0,
  y = 0,
  onAction,
  onClose,
  onAddNode,
  viewportWidth = 1440,
  viewportHeight = 900,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose?.();
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('pointerdown', handler);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // 计算位置避免溢出
  const width = 240;
  const itemHeight = 36;
  const groupGap = 24;
  const estimatedHeight = CANVAS_RIGHT_CLICK_ACTIONS.length * itemHeight + groupGap * 3 + 40;
  const left = Math.min(viewportWidth - width - 12, Math.max(12, x));
  const top = Math.min(viewportHeight - estimatedHeight - 12, Math.max(12, y));

  // 按 group 分组
  const groupedActions = useMemo(() => {
    const groups = new Map();
    CANVAS_RIGHT_CLICK_ACTIONS.forEach(action => {
      if (!groups.has(action.group)) groups.set(action.group, []);
      groups.get(action.group).push(action);
    });
    return groups;
  }, []);

  return (
    <div
      ref={ref}
      className="ec-canvas-context-panel"
      role="menu"
      aria-label="画布操作菜单"
      style={{ left, top, width }}
    >
      <div className="ec-canvas-context-panel-header">
        <strong>画布操作</strong>
        <span>右键菜单</span>
      </div>
      <div className="ec-canvas-context-panel-list">
        {Array.from(groupedActions.entries()).map(([groupKey, actions]) => (
          <div key={groupKey} className="ec-canvas-context-panel-group">
            <div className="ec-canvas-context-panel-group-label">{ACTION_GROUP_LABELS[groupKey] || groupKey}</div>
            {actions.map(action => {
              const Icon = ICON_MAP[action.icon] || Sparkles;
              return (
                <button
                  key={action.id}
                  type="button"
                  className="ec-canvas-context-panel-item"
                  role="menuitem"
                  onClick={(event) => {
                    event.stopPropagation();
                    onAction?.(action.id);
                    onClose?.();
                  }}
                >
                  <span className="ec-canvas-context-panel-item-icon"><Icon size={14} strokeWidth={1.75} /></span>
                  <span className="ec-canvas-context-panel-item-label">{action.label}</span>
                  {action.shortcut && <span className="ec-canvas-context-panel-item-shortcut">{action.shortcut}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════ CanvasAddNodePanel - 双击空白处弹出的添加节点面板 ═══════
   Quantv §10.2 实测: 5 个类型 + 2 资源入口 */
export function CanvasAddNodePanel({
  x = 0,
  y = 0,
  onAdd,
  onUpload,
  onPickFromLibrary,
  onStartFromSkill = null,
  onClose,
  viewportWidth = 1440,
  viewportHeight = 900,
}) {
  const ref = useRef(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose?.();
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('pointerdown', handler);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // 4 种基础节点 (用户 9-04 反馈: "应用"节点是空壳死功能, 已下架 —
  // 应用类工作流走素材端口派生菜单, 那里有真实执行链路)
  const nodeTypes = [
    { id: 'text', label: '文本', kind: 'text', icon: Type, hint: '提示词 / 镜头脚本' },
    { id: 'image', label: '图片', kind: 'image', icon: ImagePlus, hint: '上传或生成图片' },
    { id: 'video', label: '视频', kind: 'video', icon: Film, hint: '上传或生成视频' },
    { id: 'audio', label: '音频', kind: 'audio', icon: Music, hint: '上传或录制音频' },
  ];

  // 资源入口
  const resourceTypes = [
    { id: 'upload-local', label: '本地上传', icon: ImagePlus, onClick: onUpload },
    { id: 'from-library', label: '从资产库选择', icon: Folder, onClick: onPickFromLibrary },
    /* ═══ 2026-09-28 批 CX（CV-1）：**「按技能开始」**（docs/design/89 §5 第 1 步"一份声明三处复用"）═══
       同一条技能声明现在只在**子页面工作台**里能选；画布上得"先建生成框、再点技能按钮"两步。
       用户对画布的定位是"工作流生产地"（他原话：「画布可能最终要走向像知渔AI他们那样……
       把各种各样的工作流集合成模板」），所以"我要做爆款复刻"应该能**一步**落到画布上：
       挑一条技能 → 直接建出带这条技能的节点（技能正文预填进提示词、skill/skillLabel 记名）。
       ⚠️ 这里是**选中技能后才建节点**，不是"点了就扣费"：建节点 0 收费，跑生成仍走原来的报价→确认链路。 */
    ...(onStartFromSkill ? [{ id: 'by-skill', label: '按技能开始', icon: Sparkles, hint: '从全部技能里挑一条，直接建一个带它的节点', onClick: onStartFromSkill }] : []),
  ];

  const filtered = nodeTypes.filter(n => !query || n.label.includes(query) || n.hint.includes(query));

  // 位置计算
  const width = 320;
  const itemHeight = 56;
  const headerHeight = 80;
  const footerHeight = 60;
  const estimatedHeight = headerHeight + filtered.length * itemHeight + resourceTypes.length * itemHeight + footerHeight + 40;
  const left = Math.min(viewportWidth - width - 12, Math.max(12, x));
  const top = Math.min(viewportHeight - estimatedHeight - 12, Math.max(12, y));

  return (
    <div
      ref={ref}
      className="ec-canvas-add-node-panel"
      role="dialog"
      aria-label="添加节点"
      style={{ left, top, width }}
    >
      <header className="ec-canvas-add-node-panel-header">
        <div>
          <strong>添加节点</strong>
          <span>双击画布空白处</span>
        </div>
      </header>
      <div className="ec-canvas-add-node-panel-search">
        <Search size={14} strokeWidth={1.75} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索节点类型..."
          autoFocus
        />
      </div>
      <div className="ec-canvas-add-node-panel-section">
        <div className="ec-canvas-add-node-panel-section-label">节点类型</div>
        <div className="ec-canvas-add-node-panel-grid">
          {filtered.map(node => {
            const Icon = node.icon;
            return (
              <button
                key={node.id}
                type="button"
                className="ec-canvas-add-node-panel-card"
                onClick={() => {
                  onAdd?.(node.kind, node.id);
                  onClose?.();
                }}
              >
                <span className="ec-canvas-add-node-panel-card-icon"><Icon size={20} strokeWidth={1.6} /></span>
                <span className="ec-canvas-add-node-panel-card-text">
                  <strong>{node.label}</strong>
                  <small>{node.hint}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="ec-canvas-add-node-panel-section">
        <div className="ec-canvas-add-node-panel-section-label">添加资源</div>
        <div className="ec-canvas-add-node-panel-grid">
          {resourceTypes.map(res => {
            const Icon = res.icon;
            return (
              <button
                key={res.id}
                type="button"
                className="ec-canvas-add-node-panel-card is-resource"
                onClick={() => {
                  res.onClick?.();
                  onClose?.();
                }}
              >
                <span className="ec-canvas-add-node-panel-card-icon"><Icon size={20} strokeWidth={1.6} /></span>
                <span className="ec-canvas-add-node-panel-card-text">
                  <strong>{res.label}</strong>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════ CanvasShortcutHelp - 快捷键帮助面板 (按 ? 键弹出) ═══════ */
export function CanvasShortcutHelp({ onClose }) {
  const ref = useRef(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose?.();
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('pointerdown', handler);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // 9-02 修复: 动态 import 已 resolve 为 CANVAS_SHORTCUTS 数组, 直接使用, 不再二次访问 .CANVAS_SHORTCUTS (会导致列表恒空)
  const [shortcutsList, setShortcutsList] = useState([]);
  useEffect(() => {
    import('../canvasQuantvExtensions.js')
      .then((m) => setShortcutsList(m.CANVAS_SHORTCUTS || []))
      .catch(() => setShortcutsList([]));
  }, []);

  const filtered = shortcutsList.filter(s =>
    !query || s.description.includes(query) || s.keys.some(k => k.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="ec-canvas-shortcut-help-overlay" role="dialog" aria-label="快捷键面板">
      <div ref={ref} className="ec-canvas-shortcut-help" style={{ width: 540 }}>
        <header>
          <strong>快捷键面板</strong>
          <button type="button" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <div className="ec-canvas-shortcut-help-search">
          <Search size={14} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索快捷键..."
            autoFocus
          />
        </div>
        <div className="ec-canvas-shortcut-help-list">
          {filtered.map(s => (
            <div key={s.id} className="ec-canvas-shortcut-help-row">
              <span className="ec-canvas-shortcut-help-keys">
                {s.keys.map((k, i) => (
                  <React.Fragment key={i}>
                    <kbd>{k}</kbd>
                    {i < s.keys.length - 1 && <span className="or-divider">/</span>}
                  </React.Fragment>
                ))}
              </span>
              <span className="ec-canvas-shortcut-help-desc">{s.description}</span>
            </div>
          ))}
          {!filtered.length && <div className="ec-canvas-shortcut-help-empty">没有匹配的快捷键</div>}
        </div>
      </div>
    </div>
  );
}

/* ═══════ CanvasMinimap - 小地图 (Quantv §1.6) ═══════ */
export function CanvasMinimap({
  nodes = [],
  connections = [],
  viewport = { x: 0, y: 0, scale: 1 },
  worldBounds = { width: 2400, height: 1600 },
  onViewportChange,
  onWheelZoom,
  onClose,
  minimapWidth = 200,
  minimapHeight = 180,
  viewportSize = null,
}) {
  const ref = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);
  /* 实测内容区尺寸（而不是拿外层尺寸减魔法数字）：外框 padding / 标题栏 / margin 全部由 CSS 决定 */
  const [box, setBox] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const measure = () => {
      const width = node.clientWidth;
      const height = node.clientHeight;
      setBox(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // 世界 → 小地图：等比缩放 + 内容居中（用户批注：内容与默认视角都必须居中，不能歪向右下）
  const offsetX = Number.isFinite(worldBounds.offsetX) ? worldBounds.offsetX : 0;
  const offsetY = Number.isFinite(worldBounds.offsetY) ? worldBounds.offsetY : 0;
  const canvasWidth = Math.max(1, box.width || (minimapWidth - 22));
  const canvasHeight = Math.max(1, box.height || (minimapHeight - 44));
  const scale = Math.min(
    canvasWidth / Math.max(1, worldBounds.width),
    canvasHeight / Math.max(1, worldBounds.height),
  );
  const padX = (canvasWidth - worldBounds.width * scale) / 2;
  const padY = (canvasHeight - worldBounds.height * scale) / 2;
  const toMapX = worldX => padX + (Number(worldX) - offsetX) * scale;
  const toMapY = worldY => padY + (Number(worldY) - offsetY) * scale;

  const stage = viewportSize && Number(viewportSize.width) > 0 && Number(viewportSize.height) > 0
    ? { width: Number(viewportSize.width), height: Number(viewportSize.height) }
    : { width: globalThis.innerWidth || 1440, height: globalThis.innerHeight || 900 };
  /* ═══ 批 CY-㊴（2026-10-01）：把「被右侧面板遮住的那一条」**画出来** ══════════════
     用户连续三次反馈（逐字）：
       「感觉还是一样啊，小地图依然会被派生框遮住一部分呀，素材图的右边为什么还是比较窄呢」
       「这个派生面板在你的小地图里依然是被遮蔽的元素呀，你根本没解决呀」
     我前面两次都搞错了方向：一直在把实心框**改窄**（让它等于看得见的部分），
     还加了一层"框外压暗"的遮罩 —— 那等于把"被遮住"画成了"窗外"。
     用户要的是：画布右边被面板盖住的那一段**在框里要看得见，并且看得出它是被遮住的**。
     ⇒ 实心框 = 看得见的部分；紧接在它右边再画一段**斜纹**的"被面板压住"，
       两段合起来正好是画布的完整宽度。 */
  const coveredWidth = Math.max(0, Number(viewportSize?.coveredWidth) || 0);
  const safeScale = Math.max(0.01, Number(viewport.scale) || 1);
  const rawVisibleRect = {
    x: toMapX(-viewport.x / safeScale),
    y: toMapY(-viewport.y / safeScale),
    w: (stage.width / safeScale) * scale,
    h: (stage.height / safeScale) * scale,
  };
  const visibleW = Math.min(canvasWidth, Math.max(3, rawVisibleRect.w));
  const visibleH = Math.min(canvasHeight, Math.max(3, rawVisibleRect.h));
  const visibleRect = {
    w: visibleW,
    h: visibleH,
    x: Math.min(canvasWidth - visibleW, Math.max(0, rawVisibleRect.x)),
    y: Math.min(canvasHeight - visibleH, Math.max(0, rawVisibleRect.y)),
  };
  /* 被面板压住的那一段：紧接在实心框右边，宽度按同样的世界→小地图比例换算 */
  const coveredW = coveredWidth > 0
    ? Math.max(0, Math.min(canvasWidth - (visibleRect.x + visibleW), (coveredWidth / safeScale) * scale))
    : 0;

  function handlePointerDown(event) {
    setIsDragging(true);
    handlePointerMove(event);
  }
  function handlePointerMove(event) {
    if (!onViewportChange) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    // 小地图上的点 → 世界点 → 让视口中心对准它 (点击任意素材即导航过去)
    const worldX = offsetX + (event.clientX - rect.left - padX) / scale;
    const worldY = offsetY + (event.clientY - rect.top - padY) / scale;
    onViewportChange({
      x: stage.width / 2 - worldX * safeScale,
      y: stage.height / 2 - worldY * safeScale,
    });
  }
  function handlePointerUp() {
    setIsDragging(false);
  }

  useEffect(() => {
    if (!isDragging) return undefined;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  return (
    <div
      className="ec-canvas-minimap"
      style={{ width: minimapWidth, height: minimapHeight }}
      onWheel={event => {
        /* 用户 9-04 反馈: 小地图开着时滚轮不能缩放画布 → 转发为画布中心缩放 */
        event.preventDefault();
        onWheelZoom?.(event.deltaY);
      }}
    >
      <header className="ec-canvas-minimap-header">
        <strong>小地图</strong>
        <span>{nodes.length} 节点</span>
        <button type="button" aria-label="关闭小地图" title="关闭小地图" className="ec-canvas-minimap-close" onClick={() => onClose?.()}>×</button>
      </header>
      <div
        ref={ref}
        className="ec-canvas-minimap-canvas"
        style={{ width: canvasWidth, height: canvasHeight }}
        onPointerDown={handlePointerDown}
      >
        {/* 连线简化渲染 */}
        <svg viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} width={canvasWidth} height={canvasHeight}>
          {connections.map((conn, i) => {
            const from = nodes.find(n => n.id === (conn.fromNodeId || conn.from));
            const to = nodes.find(n => n.id === (conn.toNodeId || conn.to));
            if (!from || !to) return null;
            const x1 = toMapX(from.x + (from.w || 0) / 2);
            const y1 = toMapY(from.y + (from.h || 0) / 2);
            const x2 = toMapX(to.x + (to.w || 0) / 2);
            const y2 = toMapY(to.y + (to.h || 0) / 2);
            return <line key={conn.id || i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.18)" strokeWidth="0.6" />;
          })}
        </svg>
        {nodes.map(node => {
          return (
            <div
              key={node.id}
              className="ec-canvas-minimap-node"
              /* 批 CY-㊴：与画布上的节点元素用同一个 id 挂钩，好让实机门禁逐个核对
                 「用户看得见的每个节点都必须落在视窗框内」（用户 9-30 逐字：
                 「当前我们用户能够看到的所有内容，它都应该成为这个视窗」）。
                 纯属性、无视觉影响；缺了它那条判据只能靠顺序猜映射。 */
              data-canvas-node-id={node.id}
              data-kind={node.kind}
              style={{
                left: toMapX(node.x),
                top: toMapY(node.y),
                width: Math.max(2, (node.w || 100) * scale),
                height: Math.max(2, (node.h || 60) * scale),
                background: getStaticNodeColor(node.kind),
                border: hoveredNode === node.id ? '1px solid rgba(255,255,255,0.9)' : '1px solid rgba(255,255,255,0.15)',
              }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              title={node.name || node.displayLabel || node.kind}
            />
          );
        })}
        <div
          className="ec-canvas-minimap-viewport"
          style={{
            left: Math.max(0, visibleRect.x),
            top: Math.max(0, visibleRect.y),
            width: visibleRect.w,
            height: visibleRect.h,
          }}
        />
        {/* 被右侧面板压住的那一段：和实心框同高、紧接其右，斜纹填充。
            画出来之后，"画布右边被面板盖住" 在小地图里是**看得见的**，
            而不是"框忽然变窄了"（用户连着三次反馈的就是这个观感）。 */}
        {coveredW > 0 && (
          <div
            className="ec-canvas-minimap-covered"
            aria-hidden="true"
            style={{
              left: Math.max(0, visibleRect.x) + visibleW,
              top: Math.max(0, visibleRect.y),
              width: coveredW,
              height: visibleRect.h,
            }}
          />
        )}
      </div>
    </div>
  );
}

/* 同步静态颜色映射 (避免动态 import) */
function getStaticNodeColor(kind = '') {
  const map = {
    text: '#FFE66D',
    image: '#4ECDC4',
    output: '#4ECDC4',
    video: '#FF6B6B',
    audio: 'var(--sb-brand-400)',
    application: '#FFA500',
    source_group: '#94A3B8',
    'layer-group': '#94A3B8',
    'image-composer': '#06B6D4',
    'text-composer': '#FFE66D',
    'video-composer': '#FF6B6B',
    'suite-composer': '#F97316',
    'smart-remix': '#EC4899',
    'layer-workbench': '#10B981',
    'remove-bg': '#22C55E',
    extend: 'var(--sb-info-solid-500)',
    inpaint: 'var(--sb-brand-500)',
    translate: '#F59E0B',
    upscale: '#0EA5E9',
    sticker: '#FACC15',
  };
  return map[kind] || '#888888';
}

/* ═══════ CanvasTaskLogPanel - 任务日志面板 (Quantv §1.6) ═══════ */
/* ═══════ CanvasTaskLogPanel - 任务日志面板 (9-12 用户批注：照竞品做筛选+列表，配色走我们的浅色风格) ═══════ */
const TASK_STATUS_FILTERS = [
  { id: 'all', label: '全部状态' },
  { id: 'processing', label: '进行中' },
  { id: 'completed', label: '已完成' },
  { id: 'failed', label: '失败' },
];
const TASK_TYPE_FILTERS = [
  { id: 'all', label: '全部类型' },
  { id: 'text', label: '文本' },
  { id: 'image', label: '图片' },
  { id: 'video', label: '视频' },
  { id: 'audio', label: '音频' },
];
const TASK_STATUS_LABEL = { waiting: '等待中', queued: '排队中', processing: '进行中', transferring: '传输中', completed: '已完成', failed: '失败', refunding: '退款中', refunded: '已退款' };
const TASK_STATUS_ORDER = ['processing', 'queued', 'waiting', 'transferring', 'failed', 'refunding', 'refunded', 'completed'];

/* 批 CY-⑳：签名里原来有 `onRefund`，但整个组件**从来没渲染过任何退款按钮**
   （每行只有「重试」和「清除」），而调用处还传了一个 `console.info` 进来 ——
   一个永远不会被调用的 prop，纯粹误导下一个人以为这里存在退款流程。删掉。 */
export function CanvasTaskLogPanel({ tasks = [], onClose, onRetry, onDismiss }) {
  const ref = useRef(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose?.();
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('pointerdown', handler);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const visibleTasks = useMemo(() => tasks.filter(task => {
    if (statusFilter !== 'all' && String(task.status || '') !== statusFilter) return false;
    if (typeFilter !== 'all' && String(task.type || '') !== typeFilter) return false;
    return true;
  }), [tasks, statusFilter, typeFilter]);

  const groupedByStatus = useMemo(() => {
    const groups = new Map();
    visibleTasks.forEach(task => {
      const status = task.status || 'waiting';
      if (!groups.has(status)) groups.set(status, []);
      groups.get(status).push(task);
    });
    return groups;
  }, [visibleTasks]);

  return (
    <div className="ec-canvas-task-log-overlay" role="dialog" aria-label="任务日志">
      <div ref={ref} className="ec-canvas-task-log-panel">
        <header>
          <strong>任务日志</strong>
          <span>{visibleTasks.length} / {tasks.length} 个任务</span>
          <button type="button" onClick={onClose} aria-label="关闭">×</button>
        </header>
        <div className="ec-canvas-task-log-filters" role="group" aria-label="任务筛选">
          <div className="ec-canvas-task-log-filter-row">
            {TASK_STATUS_FILTERS.map(option => <button
              key={option.id}
              type="button"
              className={statusFilter === option.id ? 'is-active' : ''}
              aria-pressed={statusFilter === option.id}
              onClick={() => setStatusFilter(option.id)}
            >{option.label}</button>)}
          </div>
          <div className="ec-canvas-task-log-filter-row">
            {TASK_TYPE_FILTERS.map(option => <button
              key={option.id}
              type="button"
              className={typeFilter === option.id ? 'is-active' : ''}
              aria-pressed={typeFilter === option.id}
              onClick={() => setTypeFilter(option.id)}
            >{option.label}</button>)}
          </div>
        </div>
        <div className="ec-canvas-task-log-list">
          {TASK_STATUS_ORDER.filter(status => groupedByStatus.has(status)).map(status => (
            <div key={status} className="ec-canvas-task-log-group">
              <div className={`ec-canvas-task-log-group-header status-${status}`}>
                {TASK_STATUS_LABEL[status] || status}
                <span>({groupedByStatus.get(status).length})</span>
              </div>
              {groupedByStatus.get(status).map(task => (
                <div key={task.id} className="ec-canvas-task-log-row">
                  <div className="ec-canvas-task-log-row-main">
                    <strong>{task.title || task.name || task.id}</strong>
                    {task.message && <small>{task.message}</small>}
                  </div>
                  <div className="ec-canvas-task-log-row-actions">
                    {task.status === 'failed' && <button type="button" onClick={() => onRetry?.(task)}>重试</button>}
                    <button type="button" onClick={() => onDismiss?.(task)} aria-label={`移除${task.title || task.id}`}>清除</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
          {!visibleTasks.length && (
            <div className="ec-canvas-task-log-empty">{tasks.length ? '当前筛选下没有任务' : '暂无任务，生成或上传素材后这里会记录每一步'}</div>
          )}
        </div>
      </div>
    </div>
  );
}


/* ═══════ SaveStatusIndicator - 保存状态指示器 (顶栏) ═══════ */
export function SaveStatusIndicator({ status = 'saved', lastSavedAt = null }) {
  const label = { saved: '已保存', saving: '保存中', 'local-only': '本地未同步', conflict: '冲突' }[status] || status;
  const dotColor = { saved: '#22C55E', saving: '#F59E0B', 'local-only': '#94A3B8', conflict: '#EF4444' }[status] || '#888';
  return (
    <span className={`ec-canvas-save-indicator status-${status}`} title={lastSavedAt ? `最近保存: ${new Date(lastSavedAt).toLocaleString()}` : label}>
      <span className="ec-canvas-save-indicator-dot" style={{ background: dotColor }} />
      <span className="ec-canvas-save-indicator-label">{label}</span>
    </span>
  );
}

/* ═══════ CanvasSticker - 便签 (Quantv CanvasStickerLayer) ═══════ */
export function CanvasSticker({ sticker = {}, onChange, onDelete, onPointerDown }) {
  const colorMap = {
    yellow: { bg: 'rgba(255, 235, 59, 0.92)', text: '#1a1a1a' },
    pink: { bg: 'rgba(255, 138, 176, 0.92)', text: '#1a1a1a' },
    blue: { bg: 'rgba(100, 181, 246, 0.92)', text: '#0d1117' },
    green: { bg: 'rgba(129, 199, 132, 0.92)', text: '#0d1117' },
    purple: { bg: 'rgba(186, 104, 200, 0.92)', text: 'var(--sb-neutral-0)' },
  };
  const colors = colorMap[sticker.color] || colorMap.yellow;
  return (
    <div
      className="ec-canvas-sticker"
      onPointerDown={onPointerDown}
      style={{
        left: sticker.x,
        top: sticker.y,
        width: sticker.w,
        minHeight: sticker.h,
        background: colors.bg,
        color: colors.text,
        transform: `rotate(${sticker.rotation || 0}deg)`,
      }}
    >
      <textarea
        className="ec-canvas-sticker-text"
        value={sticker.text || ''}
        onChange={(e) => onChange?.({ ...sticker, text: e.target.value })}
        onPointerDown={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        className="ec-canvas-sticker-delete"
        aria-label="删除便签"
        onClick={(e) => { e.stopPropagation(); onDelete?.(sticker); }}
      >×</button>
    </div>
  );
}
