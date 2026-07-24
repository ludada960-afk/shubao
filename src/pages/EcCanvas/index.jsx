import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MdArrowBack, MdDownload, MdGridOn, MdCollections, MdAdd, MdDelete, MdOpenInNew, MdZoomIn, MdZoomOut, MdFitScreen, MdClose, MdLink, MdAutoFixHigh, MdImageSearch, MdEdit, MdCategory, MdMergeType, MdCheckBoxOutlineBlank, MdCheckBox } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import { saveWork, loadWorks, proxyImg, deleteWork as softDeleteWork, loadTrash, restoreWork, reversePrompt, stitchLongImage, regenerateCanvasImage } from '../../services/api';
import {
  ASSET_GROUPS,
  addConnection,
  canStitch,
  fitViewport,
  getAssetMeta,
  moveSelectedNodes,
  normalizeAsset,
  removeConnectionsForNodes,
  selectNodesInRect,
  zoomAroundCursor,
} from './canvasState';

function parseImages(images, platform) {
  if (!images || typeof images !== 'object') return [];
  const entries = Array.isArray(images)
    ? images.map(i => ({ ...i, sourceKey: i.key || i.label || '' }))
    : Object.entries(images).map(([key, value]) => ({ sourceKey: key, ...(typeof value === 'object' ? value : { url: value }) }));
  const counters = {};
  return entries.map((input, i) => {
    const asset = normalizeAsset(input, i, counters);
    const info = getAssetMeta(asset.sourceKey);
    return { ...asset, title: info.name, platform };
  });
}

const NODE_W = 200;
const GAP = 28;

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
    <div style={{ width: w, height: h + 60, borderRadius: 12, background: 'rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div style={{ width: '100%', height: h, background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'skeletonShimmer 1.4s infinite' }} />
      <div style={{ padding: '8px 10px' }}><div style={{ height: 10, width: '60%', borderRadius: 5, background: '#e8e8e8', marginBottom: 6 }} /><div style={{ height: 8, width: '80%', borderRadius: 4, background: '#f0f0f0' }} /></div>
    </div>
  );
}

/* A8: 图片加载骨架屏 + 错误重试 + C3: proxyImg 代理显示 */
function ImageNode({ node, selected, multiSelected, onPointerDown, onContextMenu, onToggleSelect, onPortPointerDown, onPortPointerUp }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const displayUrl = proxyImg(node.url);

  return (
    <div
      onPointerDown={e => onPointerDown(e, node.id)}
      onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, node); }}
      style={{
        position: 'absolute', left: node.x, top: node.y, width: node.w,
        cursor: 'grab', userSelect: 'none', borderRadius: 12,
        boxShadow: selected ? '0 0 0 2.5px #7c3aed, 0 8px 32px rgba(124,58,237,0.25)' : '0 4px 16px rgba(0,0,0,0.10)',
        background: '#fff', transition: 'box-shadow 0.15s', touchAction: 'none',
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
      {selected && <div style={{ position: 'absolute', zIndex: 2, left: -7, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#fff', border: '2px solid #7c3aed', cursor: 'crosshair' }} onPointerDown={e => { e.stopPropagation(); onPortPointerDown?.(e, node.id, 'in'); }} onPointerUp={e => { e.stopPropagation(); onPortPointerUp?.(e, node.id, 'in'); }} />}
      {selected && <div style={{ position: 'absolute', zIndex: 2, right: -7, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: '50%', background: '#7c3aed', border: '2px solid #fff', cursor: 'crosshair' }} onPointerDown={e => { e.stopPropagation(); onPortPointerDown?.(e, node.id, 'out'); }} onPointerUp={e => { e.stopPropagation(); onPortPointerUp?.(e, node.id, 'out'); }} />}
      <div style={{ position: 'relative', width: '100%', borderRadius: '12px 12px 0 0', overflow: 'hidden', background: '#f5f5f5' }}>
        {!loaded && !error && <SkeletonCard w={node.w} h={node.h} />}
        {error && (
          <div style={{ width: '100%', height: node.h, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#fef2f2' }}>
            <div style={{ fontSize: 28, opacity: 0.3 }}>😵‍💫</div>
            <div style={{ fontSize: 11, color: '#ef4444' }}>加载失败</div>
            <div onClick={() => { setError(false); setLoaded(false); setRetryKey(k => k + 1); }} style={{ fontSize: 11, color: '#7c3aed', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, background: 'rgba(124,58,237,0.08)' }}>点击重试</div>
          </div>
        )}
        <img
          key={retryKey}
          src={displayUrl}
          alt={node.label}
          draggable={false}
          crossOrigin="anonymous"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{ width: '100%', height: node.h, objectFit: 'cover', display: 'block', borderRadius: '12px 12px 0 0', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
        />
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name || node.displayLabel}</div>
          <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 700, color: '#7c3aed', background: 'rgba(124,58,237,.08)', borderRadius: 999, padding: '2px 5px' }}>{node.group}</span>
        </div>
        <div style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>{node.ratio}{node.size ? ` · ${node.size}` : ''}</div>
        {node.usage && <div style={{ fontSize: 9, color: '#b45309', marginTop: 5, lineHeight: 1.5, background: 'rgba(180,83,9,0.06)', borderRadius: 5, padding: '3px 6px' }}>{node.usage}</div>}
      </div>
    </div>
  );
}

/* A6: 右键上下文菜单 */
function ContextMenu({ x, y, node, onClose, onAction }) {
  const menuRef = useRef(null);
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [onClose]);

  const items = [
    { icon: <MdDownload size={14} />, label: '下载图片', action: 'download' },
    { icon: <MdEdit size={14} />, label: '重命名', action: 'rename' },
    { icon: <MdCategory size={14} />, label: '修改分类', action: 'classify' },
    { icon: <MdAutoFixHigh size={14} />, label: 'AI 抠图去背', action: 'remove-bg' },
    { icon: <MdImageSearch size={14} />, label: 'AI 反向提示词', action: 'reverse-prompt' },
    { icon: <MdMergeType size={14} />, label: '再次编辑方案', action: 'edit-direction' },
    { icon: <MdLink size={14} />, label: '复制图片链接', action: 'copy-url' },
    { icon: <MdDelete size={14} />, label: '删除节点', action: 'delete', danger: true },
  ];

  return (
      <div ref={menuRef} style={{ position: 'fixed', left: x, top: y, zIndex: 10002, background: '#fff', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.16)', border: '1px solid rgba(0,0,0,0.06)', padding: 4, minWidth: 190 }}>
      <div style={{ padding: '6px 10px', fontSize: 10, color: '#999', borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: 4 }}>{node?.name || node?.displayLabel || '节点'}</div>
      {items.map(item => (
        <div
          key={item.action}
          onClick={() => { onAction(item.action, node); onClose(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: item.danger ? '#ef4444' : '#333', transition: 'background 0.1s', ':hover': { background: 'rgba(0,0,0,0.04)' } }}
          onMouseEnter={e => e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.06)' : 'rgba(124,58,237,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {item.icon} {item.label}
        </div>
      ))}
    </div>
  );
}

/* A6: 连线 SVG 层 */
function ConnectionLines({ connections, nodes, viewport, onRemove }) {
  if (!connections?.length) return null;
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const styles = {
    reference: { stroke: '#7c3aed', dash: undefined, label: '引用素材' },
    variant: { stroke: '#2563eb', dash: '6 4', label: '生成变体' },
    merge: { stroke: '#374151', dash: undefined, label: '合并产物' },
  };
  return (
    <svg style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'auto', overflow: 'visible' }}>
      {connections.map((conn, i) => {
        const from = nodeMap.get(conn.from);
        const to = nodeMap.get(conn.to);
        if (!from || !to) return null;
        const x1 = (from.x + from.w) * viewport.scale + viewport.x;
        const y1 = (from.y + from.h / 2) * viewport.scale + viewport.y;
        const x2 = to.x * viewport.scale + viewport.x;
        const y2 = (to.y + to.h / 2) * viewport.scale + viewport.y;
        const mx = (x1 + x2) / 2;
        const style = styles[conn.type] || styles.reference;
        return (
          <g key={i}>
            <path d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} stroke={style.stroke} strokeWidth={2.4} fill="none" strokeDasharray={style.dash} opacity={0.75} onDoubleClick={() => onRemove?.(conn)} style={{ cursor: 'pointer' }} />
            <circle cx={x2} cy={y2} r={4} fill={style.stroke} opacity={0.8} />
            <text x={mx} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize="10" fill={style.stroke} style={{ pointerEvents: 'none' }}>{style.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function EcCanvas() {
  const { state, dispatch } = useApp();
  const result = state.result || {};
  const phone = state.phone || '';
  const [viewport, setViewport] = useState({ x: 80, y: 40, scale: 1 });
  const [nodes, setNodes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [multiSelected, setMultiSelected] = useState(new Set());
  const [connections, setConnections] = useState([]);
  const [pointerMode, setPointerMode] = useState(null);
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
  const [contextMenu, setContextMenu] = useState(null);     // A6: 右键菜单
  const [tab, setTab] = useState('canvas');
  const [pastWorks, setPastWorks] = useState([]);
  const [trashWorks, setTrashWorks] = useState([]);
  const [zoomImg, setZoomImg] = useState(null);
  const [toast, setToast] = useState(null);
  const [promptPanel, setPromptPanel] = useState(null);
  const [promptText, setPromptText] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const containerRef = useRef(null);

  const imageList = parseImages(result.images || {}, result.platform || '淘宝');
  const hasCurrent = imageList.length > 0;
  const visibleNodes = activeFilter === '全部' ? nodes : nodes.filter(node => node.group === activeFilter);

  // toast helper
  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    if (!hasCurrent) return;
    const newNodes = autoLayout(imageList);
    setNodes(newNodes);
    requestAnimationFrame(() => {
      const next = fitViewport(newNodes, containerRef.current?.getBoundingClientRect());
      if (next) setViewport(next);
    });
  }, [result.product_name, imageList.length]);

  useEffect(() => {
    const load = async () => {
      const local = [];
      try { 
        local.push(...JSON.parse(localStorage.getItem('shubao_ec_works') || '[]')); 
      } catch {}
      try { 
        const server = await loadWorks(''); 
        const ec = server.filter(w => w._ecResult); 
        const names = new Set(local.map(w => w.name)); 
        for (const w of ec) { 
          if (!names.has(w.product_name)) { 
            local.push({ 
              id: w.id || Date.now(), 
              name: w.product_name, 
              images: Array.isArray(w.images)
                ? w.images.map(i => ({ url: i.url || i.src || i.image_url, key: i.key, label: i.label || i.style || i.key }))
                : Object.entries(w.images || {}).map(([key, value]) => ({ url: typeof value === 'object' ? (value.url || value.src || value.image_url) : value, key, label: key })),
              createdAt: w.at || '',
              _saveKey: w._saveKey || '',
            }); 
          } 
        } 
      } catch {}
      setPastWorks(local);
      setTrashWorks(await loadTrash(''));
    };
    load();
  }, []);

  // B10: 全局键盘快捷键（使用 ref 避免循环依赖）
  // 注意：ref 初始值为空函数，在下面的 useEffect 中更新
  const handleDeleteRef = useRef(() => {});
  const fitViewRef = useRef(() => {});

  useEffect(() => {
    const handleKeyDown = (e) => {
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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    const point = toWorldPoint(e);
    const additive = e.ctrlKey || e.metaKey;
    const panRequested = e.button === 1 || e.altKey || e.getModifierState?.(' ') || e.shiftKey === false && e.target?.dataset?.canvasPan === 'true';
    if (!panRequested) {
      setPointerMode({ kind: 'marquee', start: point, additive });
      setMarquee({ x: point.x, y: point.y, w: 0, h: 0 });
    } else {
      setPointerMode({ kind: 'pan', startX: e.clientX, startY: e.clientY, vpX: viewport.x, vpY: viewport.y });
      setSelected(null);
      setMultiSelected(new Set());
    }
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
  }, [toWorldPoint, viewport.x, viewport.y]);

  const handlePointerMove = useCallback((e) => {
    if (!pointerMode) return;
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
      const dx = point.x - pointerMode.start.x;
      const dy = point.y - pointerMode.start.y;
      setNodes(ns => moveSelectedNodes(ns, pointerMode.ids, dx, dy));
      setPointerMode(prev => ({ ...prev, start: point }));
    }
  }, [pointerMode, toWorldPoint]);

  const handlePointerUp = useCallback(() => {
    if (pointerMode?.kind === 'marquee' && marquee) {
      const ids = new Set(selectNodesInRect(nodes, marquee));
      setMultiSelected(pointerMode.additive ? new Set([...multiSelected, ...ids]) : ids);
      setSelected(null);
    }
    setPointerMode(null);
    setMarquee(null);
  }, [pointerMode, marquee, nodes, multiSelected]);

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
    setPointerMode({ kind: 'drag', ids, start: toWorldPoint(e) });
  }, [multiSelected, toWorldPoint]);

  const handleToggleSelect = useCallback((e, id) => {
    const next = new Set(multiSelected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setMultiSelected(next);
    setSelected(next.size === 1 ? [...next][0] : null);
  }, [multiSelected]);

  const handlePortPointerDown = useCallback((e, nodeId, side) => {
    if (side !== 'out') return;
    setConnectionDraft({ from: nodeId, type: 'reference' });
    setPointerMode({ kind: 'connect', from: nodeId });
  }, []);

  const handlePortPointerUp = useCallback((e, nodeId, side) => {
    if (side !== 'in' || !connectionDraft || connectionDraft.from === nodeId) return;
    setConnections(prev => addConnection(prev, connectionDraft.from, nodeId, connectionDraft.type));
    setConnectionDraft(null);
    setPointerMode(null);
    showToast('已建立素材关系', 'success');
  }, [connectionDraft, showToast]);

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
    switch (action) {
      case 'download':
        handleDownload(node.id);
        break;
      case 'rename': {
        const next = window.prompt('为这张电商图命名', node.name || node.displayLabel || '');
        if (next?.trim()) {
          setNodes(ns => ns.map(n => n.id === node.id ? { ...n, name: next.trim(), displayLabel: next.trim() } : n));
          showToast('已更新图片名称', 'success');
        }
        break;
      }
      case 'classify': {
        const next = window.prompt(`修改分类：${ASSET_GROUPS.join(' / ')}`, node.group);
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
          const res = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/remove-bg`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_url: node.url }),
          });
          if (res.ok) {
            const data = await res.json();
            const resultUrl = data.result_url || data.url;
            if (resultUrl) {
              setNodes(ns => ns.map(n => n.id === node.id ? { ...n, url: resultUrl, loaded: false } : n));
              showToast('抠图完成！', 'success');
            } else {
              showToast(data.error || '抠图返回为空', 'error');
            }
          } else {
            showToast('抠图服务暂不可用', 'error');
          }
        } catch (e) {
          showToast('抠图请求失败: ' + e.message, 'error');
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
          showToast('已生成可编辑提示词', 'success');
        } catch (e) {
          showToast('请求失败: ' + e.message, 'error');
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
    }
  };

  const handleNew = () => dispatch({ type: 'NEW_WORK' });
  const handleBack = () => dispatch({ type: 'NAVIGATE', page: 'home' });
  const openWork = (work) => {
    let images = {};
    if (Array.isArray(work.images)) {
      work.images.forEach((img, index) => {
        const url = typeof img === 'string' ? img : (img?.url || img?.src || img?.image_url || img?.cover_url);
        if (url) images[img?.key || img?.label || `image_${index + 1}`] = url;
      });
    } else {
      images = Object.fromEntries(Object.entries(work.images || {}).map(([key, value]) => [
        key,
        typeof value === 'string' ? value : (value?.url || value?.src || value?.image_url || ''),
      ]).filter(([, value]) => value));
    }
    dispatch({ type: 'SET_RESULT', result: { images, product_name: work.name || '历史作品', _ecResult: true, platform: '淘宝' } });
    setTab('canvas');
  };
  const deleteWork = async (id) => {
    const work = pastWorks.find(x => x.id === id);
    if (!work) return;
    if (work._saveKey) await softDeleteWork(work._saveKey);
    const next = pastWorks.filter(x => x.id !== id);
    setPastWorks(next);
    localStorage.setItem('shubao_ec_works', JSON.stringify(next));
    showToast('已移入回收站，可恢复', 'success');
  };

  const restoreDeletedWork = async (work) => {
    if (!work?._saveKey) return;
    const ok = await restoreWork(work._saveKey);
    if (!ok) return showToast('恢复失败，请重试', 'error');
    setPastWorks(prev => [...prev, {
      id: work.id,
      name: work.product_name || work.name || '历史作品',
      images: Array.isArray(work.images) ? work.images : Object.entries(work.images || {}).map(([key, url]) => ({ url, key, label: key })),
      createdAt: work.at || '',
      _saveKey: work._saveKey,
    }]);
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
      const url = await regenerateCanvasImage({ prompt: promptText, imageUrl: promptPanel.url, ratio: promptPanel.ratio, sourceDirectionId: direction?.id });
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

  // 更新 ref（在函数定义之后）
  useEffect(() => { handleDeleteRef.current = handleDelete; }, [handleDelete]);
  useEffect(() => { fitViewRef.current = fitView; }, [fitView]);

  // 选中状态（单选 or 多选）
  const isNodeSelected = (id) => selected === id || multiSelected.has(id);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#F0EEE9', display: 'flex', flexDirection: 'column' }}>
      {/* ── 顶部工具栏 ── */}
      <div style={{ height: 58, flexShrink: 0, background: 'rgba(255,255,255,0.94)', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, zIndex: 100 }}>
        <div onClick={handleBack} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><MdArrowBack size={16} color="#666" /></div>
        <div style={{ flexShrink: 0, marginLeft: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{tab === 'canvas' ? (result.product_name || '画布') : tab === 'trash' ? '回收站' : '我的作品集'}</div>
          <div style={{ fontSize: 11, color: '#999' }}>{tab === 'canvas' ? `${nodes.length} 张资产${multiSelected.size > 0 ? ` · ${multiSelected.size} 已选中` : ''}` : `${tab === 'trash' ? trashWorks.length : pastWorks.length} 个作品`}</div>
        </div>
        <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'rgba(0,0,0,0.05)', marginLeft: 12, flexShrink: 0 }}>
          {[['canvas','当前画布'],['works','作品集'],['trash','回收站']].map(([id,label]) => (
            <div key={id} onClick={() => setTab(id)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: tab===id ? '#fff' : 'transparent', color: tab===id ? '#1a1a1a' : '#999', boxShadow: tab===id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{label}</div>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {tab === 'canvas' && (
            <>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginRight: 6 }}>
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
              {(selected || multiSelected.size > 0) && (
                <div onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  <MdDelete size={14} /> 删除
                </div>
              )}
            </>
          )}
          <div onClick={handleNew} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 12px rgba(124,58,237,0.30)' }}>
            <MdAdd size={14} /> 新建生图
          </div>
        </div>
      </div>

      {tab === 'canvas' ? (
        <div
          ref={containerRef}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#f6f5f2', backgroundImage: 'radial-gradient(rgba(58, 50, 39, .16) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
        >
          {!hasCurrent && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.15 }}>🎨</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#999', marginBottom: 8 }}>画布是空的</div>
              <div style={{ fontSize: 13, color: '#bbb', marginBottom: 24 }}>去首页生成一套电商图，图片会自动出现在这里</div>
              <div onClick={handleNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                <MdAdd size={16} /> 去生成
              </div>
            </div>
          )}

          <ConnectionLines connections={connections} nodes={nodes} viewport={viewport} onRemove={handleRemoveConnection} />

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
            {visibleNodes.map(node => (
              <ImageNode
                key={node.id}
                node={node}
                selected={isNodeSelected(node.id)}
                multiSelected={multiSelected.has(node.id)}
                onPointerDown={handleNodeDown}
                onToggleSelect={handleToggleSelect}
                onPortPointerDown={handlePortPointerDown}
                onPortPointerUp={handlePortPointerUp}
                onContextMenu={(e, n) => setContextMenu({ x: e.clientX, y: e.clientY, node: n })}
              />
            ))}
          </div>

          {marquee && (
            <div style={{ position: 'absolute', left: marquee.x * viewport.scale + viewport.x, top: marquee.y * viewport.scale + viewport.y, width: Math.abs(marquee.w) * viewport.scale, height: Math.abs(marquee.h) * viewport.scale, transform: `translate(${marquee.w < 0 ? marquee.w * viewport.scale : 0}px,${marquee.h < 0 ? marquee.h * viewport.scale : 0})`, border: '1px solid #7c3aed', background: 'rgba(124,58,237,.10)', pointerEvents: 'none', zIndex: 20 }} />
          )}

          {connectionDraft && (
            <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, background: '#1f2937', color: '#fff', padding: '7px 12px', borderRadius: 9, fontSize: 11, zIndex: 40 }}>
              <span>正在连接素材</span>
              {['reference', 'variant', 'merge'].map(type => (
                <button key={type} type="button" onClick={() => setConnectionDraft(prev => ({ ...prev, type }))} style={{ border: 0, borderRadius: 999, padding: '4px 8px', background: connectionDraft.type === type ? '#a78bfa' : 'rgba(255,255,255,.12)', color: '#fff', fontSize: 10, cursor: 'pointer' }}>{type === 'reference' ? '引用' : type === 'variant' ? '变体' : '合并'}</button>
              ))}
              <span style={{ opacity: .65 }}>点击目标节点左端口完成</span>
            </div>
          )}

          {/* 操作提示 */}
          <div style={{ position: 'absolute', bottom: 16, right: 16, fontSize: 11, color: 'rgba(0,0,0,0.28)', pointerEvents: 'none', textAlign: 'right', lineHeight: 1.6 }}>
            空白拖拽框选 · Space/Alt 拖拽平移 · 滚轮缩放<br/>
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
          onClose={() => setContextMenu(null)}
          onAction={handleContextAction}
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
            <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 5 }}>方案名称<input value={directionTitle} onChange={e => setDirectionTitle(e.target.value)} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 10px', fontSize: 12 }} /></label>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}><strong style={{ fontSize: 14 }}>编辑后重新生成</strong><button type="button" onClick={() => setPromptPanel(null)} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 18 }}>×</button></div>
          <div style={{ fontSize: 11, color: '#777', marginBottom: 8 }}>以当前图片为参考，保留商品本体，按你的修改生成新图。</div>
          <textarea value={promptText} onChange={e => setPromptText(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', minHeight: 140, resize: 'vertical', padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,.15)', font: '12px/1.6 inherit' }} />
          <button type="button" onClick={handlePromptRegenerate} disabled={promptLoading} style={{ marginTop: 10, width: '100%', border: 0, borderRadius: 8, padding: '10px 14px', background: '#1f2937', color: '#fff', fontWeight: 700, cursor: promptLoading ? 'wait' : 'pointer' }}>{promptLoading ? '正在生成…' : '按此方案生成'}</button>
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
