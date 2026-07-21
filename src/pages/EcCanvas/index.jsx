import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  MdArrowBack, MdDownload, MdGridOn, MdCollections, MdAdd, MdDelete,
  MdOpenInNew, MdZoomIn, MdZoomOut, MdFitScreen, MdClose,
  MdAddPhotoAlternate,
} from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import { saveWork, loadWorks, polishECText, reversePrompt, removeBg } from '../../services/api';

/* ═══ 标签映射（含商用释义）═══ */
const LABEL_MAP = {
  white_bg:            { title: '白底主图',    group: '主图',   ratio: '1:1', usage: '搜索结果首图，平台必备，白底突出产品，提升点击率' },
  main_text:           { title: '场景主图 1:1', group: '主图',  ratio: '1:1', usage: '搜索展示主力图，场景+卖点文案，吸引买家点击' },
  main_3x4:            { title: '竖版主图 3:4', group: '主图',  ratio: '3:4', usage: '抖音/小红书竖版流量，竖版构图更沉浸，利于转化' },
  transparent:         { title: '透明PNG素材',  group: '素材',  ratio: '1:1', usage: '二次合成素材，可自由叠加任意背景，设计师必备' },
  sku:                 { title: 'SKU规格图',    group: '规格',  ratio: '1:1', usage: '颜色/尺码选择器展示图，降低买家决策成本，减少退货' },
  detail_slice_size:   { title: '尺寸标注图',  group: '详情',  ratio: '3:4', usage: '详情页尺寸背书，精准尺码参考，降低因尺码不符退货率' },
  detail_slice_scene:  { title: '场景使用图',  group: '详情',  ratio: '3:4', usage: '真实使用场景展示，帮助买家代入使用感，提升购买欲' },
  detail_slice_qc:     { title: '质检报告图',  group: '详情',  ratio: '3:4', usage: '品质信任背书，降低买家疑虑，适用于食品/母婴/医疗类' },
  detail_slice_compare:{ title: '优势对比图',  group: '详情',  ratio: '3:4', usage: '与竞品直观对比，突出差异化卖点，提升转化' },
  detail_slice_feature:{ title: '细节功能图',  group: '详情',  ratio: '3:4', usage: '产品细节/工艺放大展示，建立品质感知，支撑定价溢价' },
  detail_slice_care:   { title: '保养维护图',  group: '详情',  ratio: '3:4', usage: '使用注意事项说明，减少因误用导致的差评和退货' },
};

const PLATFORM_SIZES = {
  '淘宝':   { '1:1': '1440×1440', '3:4': '1440×1920' },
  '京东':   { '1:1': '1440×1440', '3:4': '1440×1920' },
  '拼多多': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '小红书': { '1:1': '1440×1440', '3:4': '1440×1920' },
  '抖音':   { '1:1': '1440×1440', '3:4': '1440×1920' },
  '亚马逊': { '1:1': '1000×1000', '3:4': '1500×2000' },
};

/* ═══ 解析图片列表 ═══ */
function parseImages(images, platform) {
  if (!images || typeof images !== 'object') return [];
  const entries = Array.isArray(images)
    ? images.map(i => [i.key || i.label || '', i.url])
    : Object.entries(images);
  return entries.map(([label, url], i) => {
    const baseKey = label.replace(/_\d+$/, '');
    const info = LABEL_MAP[baseKey] || { title: label, group: '其他', ratio: '1:1', usage: '' };
    const size = (PLATFORM_SIZES[platform] || PLATFORM_SIZES['淘宝'])[info.ratio] || '1440×1440';
    return { label, url, title: info.title, group: info.group, ratio: info.ratio,
      size, usage: info.usage,
      displayLabel: info.title + (label !== baseKey ? ` ${label.replace(baseKey + '_', '#')}` : '') };
  });
}

/* ═══ 节点宽高计算 ═══ */
const NODE_W = 200;
function nodeHeight(ratio) {
  if (ratio === '3:4') return Math.round(NODE_W * 4 / 3);
  if (ratio === '2:3') return Math.round(NODE_W * 3 / 2);
  if (ratio === '9:16') return Math.round(NODE_W * 16 / 9);
  return NODE_W; // 1:1
}
const LABEL_H = 60; // 标签区高度
const GAP = 28;     // 节点间距

/* ═══ 自动布局：按组排列，瀑布流 ═══ */
function autoLayout(imageList) {
  const cols = Math.min(Math.ceil(Math.sqrt(imageList.length)), 5);
  return imageList.map((img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const h = nodeHeight(img.ratio);
    return {
      id: `node_${img.label}_${i}`,
      url: img.url,
      x: col * (NODE_W + GAP),
      y: row * (NODE_W + LABEL_H + GAP), // use square height for row to keep rows even
      w: NODE_W,
      h,
      rotation: 0,
      label: img.label,
      displayLabel: img.displayLabel,
      group: img.group,
      ratio: img.ratio,
      usage: img.usage,
      size: img.size,
      loaded: false,
    };
  });
}

/* ═══ 骨架屏卡片 ═══ */
function SkeletonCard({ w, h }) {
  return (
    <div style={{
      width: w, height: h + LABEL_H, borderRadius: 12,
      background: 'rgba(0,0,0,0.05)',
      overflow: 'hidden',
    }}>
      <div style={{
        width: '100%', height: h,
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeletonShimmer 1.4s infinite',
      }} />
      <div style={{ padding: '8px 10px' }}>
        <div style={{ height: 10, width: '60%', borderRadius: 5, background: '#e8e8e8', marginBottom: 6 }} />
        <div style={{ height: 8, width: '80%', borderRadius: 4, background: '#f0f0f0' }} />
      </div>
    </div>
  );
}

/* ═══ 右键菜单 ═══ */
function ContextMenu({ x, y, node, onClose, onAction }) {
  const menuRef = useRef(null);
  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) onClose(); };
    setTimeout(() => window.addEventListener('mousedown', close), 0);
    return () => window.removeEventListener('mousedown', close);
  }, [onClose]);

  const items = [
    { icon: '✨', label: '一键去除背景',   action: 'remove-bg' },
    { icon: '🔲', label: '宫格切分图片',   action: 'grid-cut' },
    { icon: '✂️', label: '裁剪图片',       action: 'crop' },
    { icon: '🔄', label: '重绘此图',       action: 'redraw', highlight: true },
    { icon: '🔍', label: '反推提示词',     action: 'reverse-prompt' },
    { divider: true },
    { icon: '⬇️', label: '导出图片',       action: 'export' },
    { icon: '🗑️', label: '删除',          action: 'delete', danger: true },
  ];

  // 边缘修正：防止菜单超出视口
  const vw = window.innerWidth, vh = window.innerHeight;
  const menuW = 200, menuH = items.length * 36 + 16;
  const adjustedX = x + menuW > vw ? x - menuW : x;
  const adjustedY = y + menuH > vh ? y - menuH : y;

  return createPortal(
    <div ref={menuRef} style={{
      position: 'fixed', left: adjustedX, top: adjustedY,
      zIndex: 20000, minWidth: menuW,
      background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(20px)',
      borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)',
      padding: '6px 0', userSelect: 'none',
    }}>
      {items.map((item, i) => item.divider ? (
        <div key={i} style={{ height: 1, background: 'rgba(0,0,0,0.06)', margin: '4px 0' }} />
      ) : (
        <div key={i}
          onClick={() => { onAction(item.action, node); onClose(); }}
          style={{
            padding: '7px 14px', fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 9,
            color: item.danger ? '#ef4444' : item.highlight ? '#7c3aed' : '#1a1a1a',
            fontWeight: item.highlight ? 700 : 500,
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.06)' : 'rgba(0,0,0,0.04)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <span style={{ fontSize: 15, lineHeight: 1, width: 20, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
          {item.label}
        </div>
      ))}
    </div>,
    document.body
  );
}

/* ═══ 重绘面板 ═══ */
function RedrawPanel({ node, params, onClose, onRedraw }) {
  const [prompt, setPrompt] = useState('');
  const [polishing, setPolishing] = useState(false);
  const [extraImages, setExtraImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);

  const handlePolish = async () => {
    if (!prompt.trim() || polishing) return;
    setPolishing(true);
    try {
      const res = await polishECText({ text: prompt, product_name: params?.productName || '商品', category: params?.category || '其他' });
      if (res?.polished) setPrompt(res.polished);
    } catch (e) { console.warn('[polish]', e.message); }
    setPolishing(false);
  };

  const handleExtraUpload = (e) => {
    const files = Array.from(e.target.files || []);
    setExtraImages(prev => [...prev, ...files.map(f => ({ url: URL.createObjectURL(f), file: f }))]);
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 15000,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 440, background: '#fff', borderRadius: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,0.20)', padding: '24px',
      }}>
        {/* 标题 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>重绘此图</div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{node.displayLabel} · {node.size}</div>
          </div>
          <div onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <MdClose size={16} color="#666" />
          </div>
        </div>

        {/* 原图缩略 */}
        <img src={node.url} style={{ width: '100%', maxHeight: 160, objectFit: 'contain', borderRadius: 10, background: '#f5f5f5', marginBottom: 14, display: 'block' }} />

        {/* 提示词编辑 */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#666', marginBottom: 6 }}>修改生图提示词</div>
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder={`描述调整方向，例：改为暖光场景，增加文字"限时特惠"`}
            style={{
              width: '100%', minHeight: 80, border: '1.5px solid rgba(0,0,0,0.10)',
              borderRadius: 10, padding: '10px 60px 10px 12px', fontSize: 13,
              lineHeight: 1.6, resize: 'none', outline: 'none', fontFamily: 'inherit',
              color: '#1a1a1a', background: '#fafafa', boxSizing: 'border-box',
            }}
          />
          <button onClick={handlePolish} disabled={polishing || !prompt.trim()}
            style={{
              position: 'absolute', right: 8, top: 8, height: 28,
              padding: '0 10px', borderRadius: 7, border: 'none',
              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              color: '#fff', fontSize: 11, fontWeight: 700, cursor: prompt.trim() ? 'pointer' : 'not-allowed',
              opacity: prompt.trim() ? 1 : 0.4, whiteSpace: 'nowrap',
            }}>
            {polishing ? '润色中…' : '✨ 润色'}
          </button>
        </div>

        {/* 追加参考图 */}
        <div style={{ fontSize: 12, fontWeight: 700, color: '#666', marginBottom: 8 }}>追加参考图（可选）</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {extraImages.map((img, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={img.url} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,0,0,0.08)', display: 'block' }} />
              <div onClick={() => setExtraImages(prev => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#1a1a1a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, cursor: 'pointer' }}>×</div>
            </div>
          ))}
          <div onClick={() => fileRef.current?.click()} style={{ width: 56, height: 56, borderRadius: 8, border: '2px dashed rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#999', flexShrink: 0 }}>
            <MdAdd size={20} />
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleExtraUpload} />
        </div>

        {/* 底部按钮 */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, height: 42, borderRadius: 10, border: '1.5px solid rgba(0,0,0,0.12)', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#666' }}>
            取消
          </button>
          <button onClick={() => onRedraw({ node, prompt, extraImages })} disabled={loading}
            style={{
              flex: 2, height: 42, borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #7c3aed 0%, #ec4899 60%, #f59e0b 100%)',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
            }}>
            {loading ? '生成中…' : '开始重绘 →'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ═══ 单个图片节点 ═══ */
function ImageNode({ node, selected, onPointerDown, onContextMenu }) {
  const [loaded, setLoaded] = useState(false);
  const isPortrait = node.ratio === '3:4' || node.ratio === '2:3' || node.ratio === '9:16';

  return (
    <div
      onPointerDown={e => onPointerDown(e, node.id)}
      onContextMenu={e => { e.preventDefault(); onContextMenu(e, node); }}
      style={{
        position: 'absolute',
        left: node.x, top: node.y,
        width: node.w,
        cursor: 'grab',
        userSelect: 'none',
        borderRadius: 12,
        boxShadow: selected
          ? '0 0 0 2.5px #7c3aed, 0 8px 32px rgba(124,58,237,0.25)'
          : '0 4px 16px rgba(0,0,0,0.10)',
        background: '#fff',
        transition: 'box-shadow 0.15s',
        touchAction: 'none',
      }}>
      {/* 图片区 */}
      <div style={{ position: 'relative', width: '100%', borderRadius: '12px 12px 0 0', overflow: 'hidden', background: '#f5f5f5' }}>
        {!loaded && <SkeletonCard w={node.w} h={node.h} />}
        <img
          src={node.url}
          alt={node.label}
          draggable={false}
          onLoad={() => setLoaded(true)}
          style={{
            width: '100%', height: node.h, objectFit: 'cover',
            display: 'block',
            borderRadius: '12px 12px 0 0',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s',
          }}
        />
        {/* 右上角快捷操作 */}
        {selected && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            display: 'flex', gap: 4,
          }}>
            <div title="下载" onClick={e => { e.stopPropagation(); const a=document.createElement('a'); a.href=node.url; a.download=`${node.label}.png`; a.click(); }}
              style={{ width: 26, height: 26, borderRadius: 7, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <MdDownload size={14} color="#fff" />
            </div>
          </div>
        )}
      </div>
      {/* 标签区 */}
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3 }}>{node.group} · {node.displayLabel}</div>
        <div style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>{node.size}</div>
        {node.usage && (
          <div style={{ fontSize: 9, color: '#b45309', marginTop: 5, lineHeight: 1.5, background: 'rgba(180,83,9,0.06)', borderRadius: 5, padding: '3px 6px' }}>
            {node.usage}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ 主画布 EcCanvas ═══ */
export default function EcCanvas() {
  const { state, dispatch } = useApp();
  const result = state.result || {};
  const phone = state.phone || '';

  /* ── 画布视口 ── */
  const [viewport, setViewport] = useState({ x: 80, y: 40, scale: 1 });

  /* ── 节点（图片）── */
  const [nodes, setNodes] = useState([]);
  const [selected, setSelected] = useState(null);     // 当前选中节点ID

  /* ── 交互状态 ── */
  const [dragging, setDragging] = useState(null);     // 拖拽节点
  const [panning, setPanning]   = useState(null);     // 平移画布

  /* ── 弹窗 ── */
  const [contextMenu, setContextMenu] = useState(null);   // { x, y, node }
  const [redrawPanel, setRedrawPanel] = useState(null);   // node

  /* ── 作品集 ── */
  const [tab, setTab] = useState('canvas');
  const [pastWorks, setPastWorks] = useState([]);
  const [zoomImg, setZoomImg] = useState(null);        // 灯箱

  const canvasRef = useRef(null);

  /* ── 当前作品图片列表 ── */
  const imageList = parseImages(result.images || {}, result.platform || '淘宝');
  const hasCurrent = imageList.length > 0;

  /* ── 加载作品后自动布局 ── */
  useEffect(() => {
    if (!hasCurrent) return;
    const newNodes = autoLayout(imageList);
    setNodes(newNodes);
    // 让节点组整体居中视口
    const cols = Math.min(Math.ceil(Math.sqrt(imageList.length)), 5);
    const totalW = cols * (NODE_W + GAP);
    const rows = Math.ceil(imageList.length / cols);
    const totalH = rows * (NODE_W + LABEL_H + GAP);
    const areaW = window.innerWidth - 64 - 16;
    const areaH = window.innerHeight - 52;
    setViewport({ x: (areaW - totalW) / 2 + 32, y: (areaH - totalH) / 2 + 52, scale: 1 });
  }, [result.product_name, imageList.length]); // eslint-disable-line

  /* ── 加载历史作品 ── */
  const refreshWorks = async () => {
    const local = [];
    try { local.push(...JSON.parse(localStorage.getItem('shubao_ec_works') || '[]')); } catch {}
    try {
      const server = await loadWorks('');
      const ecWorks = server.filter(w => w._ecResult);
      const names = new Set(local.map(w => w.name));
      for (const w of ecWorks) {
        if (!names.has(w.product_name)) {
          local.push({
            id: w.id || Date.now(), name: w.product_name,
            images: Array.isArray(w.images)
              ? w.images.map(i => ({ url: i.url, key: i.key, label: i.label || i.style || i.key }))
              : Object.entries(w.images || {}).map(([key, url]) => ({ url, key, label: key })),
            createdAt: w.at || '',
          });
        }
      }
    } catch (e) { console.error('[EC] 加载失败:', e.message); }
    setPastWorks(local);
  };
  useEffect(() => { refreshWorks(); }, []);

  /* ── 保存当前作品到本地/服务器 ── */
  useEffect(() => {
    if (!hasCurrent || !result.product_name) return;
    const local = [];
    try { local.push(...JSON.parse(localStorage.getItem('shubao_ec_works') || '[]')); } catch {}
    const isDupe = local.length > 0 && local[0].name === result.product_name && (Date.now() - (local[0].id || 0)) < 5000;
    if (!isDupe) {
      const newWork = { id: Date.now(), name: result.product_name,
        images: imageList.map(img => ({ url: img.url, key: img.label, label: img.displayLabel })),
        createdAt: new Date().toISOString() };
      local.unshift(newWork);
      localStorage.setItem('shubao_ec_works', JSON.stringify(local.slice(0, 50)));
    }
    if (phone) {
      const sw = { product_name: result.product_name, category: result.category || '其他',
        platform: result.platform || '淘宝', _ecResult: true, at: new Date().toLocaleDateString('zh-CN'),
        images: imageList.map(img => ({ url: img.url, key: img.label, label: img.displayLabel, style: img.title })) };
      saveWork(sw, phone).catch(() => {});
    }
    refreshWorks();
  }, [hasCurrent, result.product_name]); // eslint-disable-line

  /* ════ 交互：平移画布 ════ */
  const handleCanvasPointerDown = useCallback((e) => {
    // 节点会 stopPropagation，到达这里的都是画布背景点击 → 开始平移
    if (e.button !== 0) return;
    setSelected(null);
    setContextMenu(null);
    setPanning({ startX: e.clientX, startY: e.clientY, vpX: viewport.x, vpY: viewport.y });
    e.currentTarget.setPointerCapture(e.pointerId); // 捕获到外层容器，保证 move/up 持续响应
  }, [viewport.x, viewport.y]);

  const handleCanvasPointerMove = useCallback((e) => {
    if (panning) {
      setViewport(v => ({ ...v, x: panning.vpX + (e.clientX - panning.startX), y: panning.vpY + (e.clientY - panning.startY) }));
      return;
    }
    if (dragging) {
      const dx = (e.clientX - dragging.startX) / viewport.scale;
      const dy = (e.clientY - dragging.startY) / viewport.scale;
      setNodes(ns => ns.map(n => n.id === dragging.nodeId
        ? { ...n, x: dragging.nodeStartX + dx, y: dragging.nodeStartY + dy }
        : n));
    }
  }, [panning, dragging, viewport.scale]);

  const handleCanvasPointerUp = useCallback(() => {
    setPanning(null);
    setDragging(null);
  }, []);

  /* ════ 交互：滚轮缩放 ════ */
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.09;
    setViewport(v => {
      const newScale = Math.max(0.15, Math.min(4, v.scale * factor));
      // 以鼠标位置为缩放中心
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const dx = (cx - v.x) * (1 - newScale / v.scale);
      const dy = (cy - v.y) * (1 - newScale / v.scale);
      return { x: v.x + dx, y: v.y + dy, scale: newScale };
    });
  }, []);

  /* ════ 交互：拖拽节点 ════ */
  const handleNodePointerDown = useCallback((e, nodeId) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    setSelected(nodeId);
    setContextMenu(null);
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDragging({ nodeId, startX: e.clientX, startY: e.clientY, nodeStartX: node.x, nodeStartY: node.y });
    // 不使用 setPointerCapture，让 onPointerMove/Up 在外层 div 上处理
  }, [nodes]);

  /* ════ 右键菜单 ════ */
  const handleContextMenu = useCallback((e, node) => {
    e.preventDefault();
    setSelected(node.id);
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  /* ════ 右键菜单动作 ════ */
  const handleMenuAction = useCallback(async (action, node) => {
    if (action === 'delete') {
      setNodes(ns => ns.filter(n => n.id !== node.id));
      setSelected(null);
    } else if (action === 'export') {
      const a = document.createElement('a');
      a.href = node.url; a.download = `${node.label}.png`; a.click();
    } else if (action === 'redraw') {
      setRedrawPanel(node);
    } else if (action === 'remove-bg') {
      // 调用真实去背景 API
      const loadingId = node.id;
      setNodes(ns => ns.map(n => n.id === loadingId ? { ...n, removing: true } : n));
      try {
        const res = await removeBg({ image_url: node.url });
        if (res.result_url) {
          setNodes(ns => ns.map(n => n.id === loadingId ? { ...n, url: res.result_url, removing: false } : n));
        }
      } catch (e) {
        alert('去除背景：' + e.message);
        setNodes(ns => ns.map(n => n.id === loadingId ? { ...n, removing: false } : n));
      }
    } else if (action === 'grid-cut') {
      alert('宫格切分功能即将上线');
    } else if (action === 'reverse-prompt') {
      // 调用真实反推 API，结果显示在重绘面板
      try {
        const res = await reversePrompt({ image_url: node.url, product_name: result.product_name });
        if (res.prompt) {
          setRedrawPanel({ ...node, prefillPrompt: res.prompt });
        }
      } catch (e) {
        alert('反推失败：' + e.message);
      }
    } else if (action === 'crop') {
      alert('裁剪功能即将上线');
    }
  }, []);

  /* ════ 缩放控制 ════ */
  const zoomTo = useCallback((scale) => {
    setViewport(v => {
      const cx = (window.innerWidth - 64) / 2;
      const cy = (window.innerHeight - 52) / 2;
      const dx = (cx - v.x) * (1 - scale / v.scale);
      const dy = (cy - v.y) * (1 - scale / v.scale);
      return { x: v.x + dx, y: v.y + dy, scale };
    });
  }, []);

  const fitView = useCallback(() => {
    if (!nodes.length) return;
    const minX = Math.min(...nodes.map(n => n.x));
    const minY = Math.min(...nodes.map(n => n.y));
    const maxX = Math.max(...nodes.map(n => n.x + n.w));
    const maxY = Math.max(...nodes.map(n => n.y + n.h + LABEL_H));
    const areaW = window.innerWidth - 64 - 16;
    const areaH = window.innerHeight - 52;
    const scaleX = (areaW - 80) / (maxX - minX);
    const scaleY = (areaH - 80) / (maxY - minY);
    const scale = Math.min(scaleX, scaleY, 1.5);
    const x = 32 + (areaW - (maxX - minX) * scale) / 2 - minX * scale;
    const y = 52 + (areaH - (maxY - minY) * scale) / 2 - minY * scale;
    setViewport({ x, y, scale });
  }, [nodes]);

  /* ════ 下载全部 ════ */
  const downloadAll = () => {
    nodes.forEach((n, i) => {
      setTimeout(() => { const a=document.createElement('a'); a.href=n.url; a.download=`${result.product_name||'ec'}_${n.label}.png`; a.click(); }, i * 300);
    });
  };

  /* ════ 打开历史作品到画布 ════ */
  const openWork = (work) => {
    let images = {};
    if (Array.isArray(work.images)) {
      work.images.forEach(img => { if (img.url) images[img.key || img.label || ''] = img.url; });
    } else { images = work.images || {}; }
    dispatch({ type: 'SET_RESULT', result: { images, product_name: work.name || '历史作品', _ecResult: true, platform: '淘宝' } });
    setTab('canvas');
  };

  const deleteWork = (id) => {
    const works = pastWorks.filter(w => w.id !== id);
    setPastWorks(works);
    localStorage.setItem('shubao_ec_works', JSON.stringify(works));
  };

  /* ════ 注册 wheel 事件（passive:false，才能 preventDefault）════ */
  const wheelAreaRef = useRef(null);
  useEffect(() => {
    const el = wheelAreaRef.current;
    if (!el) return;
    const handler = (e) => handleWheel(e);
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [handleWheel]);


  /* ════════ RENDER ════════ */
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#F0EEE9', display: 'flex', flexDirection: 'column' }}>

      {/* topbar */}
      <div style={{
        height: 52, flexShrink: 0,
        background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        display: 'flex', alignItems: 'center', padding: '0 16px 0 72px', gap: 10, zIndex: 100,
      }}>
        <div onClick={() => dispatch({ type: 'NAVIGATE', page: 'home' })}
          style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <MdArrowBack size={16} color="#666" />
        </div>
        <div style={{ flexShrink: 0, marginLeft: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>{tab === 'canvas' ? (result.product_name || '画布') : '我的作品集'}</div>
          <div style={{ fontSize: 11, color: '#999' }}>{tab === 'canvas' ? `${nodes.length} 张图片` : `${pastWorks.length} 个作品`}</div>
        </div>
        <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'rgba(0,0,0,0.05)', marginLeft: 12, flexShrink: 0 }}>
          {[['canvas','当前画布'],['works','作品集']].map(([id,label]) => (
            <div key={id} onClick={() => setTab(id)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: tab===id ? '#fff' : 'transparent', color: tab===id ? '#1a1a1a' : '#999',
              boxShadow: tab===id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>{label}</div>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {tab === 'canvas' && (<>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 3, borderRadius: 8, background: 'rgba(0,0,0,0.05)' }}>
              <div onClick={() => zoomTo(Math.max(0.15, viewport.scale*0.8))} title="缩小"
                style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666' }}>
                <MdZoomOut size={16} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#666', minWidth: 38, textAlign: 'center' }}>{Math.round(viewport.scale*100)}%</div>
              <div onClick={() => zoomTo(Math.min(4, viewport.scale*1.25))} title="放大"
                style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666' }}>
                <MdZoomIn size={16} />
              </div>
              <div onClick={fitView} title="适应窗口"
                style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666' }}>
                <MdFitScreen size={15} />
              </div>
            </div>
            {hasCurrent && (
              <div onClick={downloadAll} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', borderRadius: 8, background: 'rgba(0,0,0,0.06)', color: '#1a1a1a', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <MdDownload size={14} /> 全部下载
              </div>
            )}
          </>)}
          <div onClick={() => dispatch({ type: 'NEW_WORK' })}
            style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', borderRadius: 8,
              background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              boxShadow: '0 3px 12px rgba(124,58,237,0.30)' }}>
            <MdAdd size={14} /> 新建生图
          </div>
        </div>
      </div>

      {/* main */}
      {tab === 'canvas' ? (
        <div ref={wheelAreaRef}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: panning ? 'grabbing' : 'default' }}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}>

          <div className="canvas-bg" style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'radial-gradient(circle,rgba(0,0,0,0.12) 1px,transparent 1px)',
            backgroundSize: `${20*viewport.scale}px ${20*viewport.scale}px`,
            backgroundPosition: `${viewport.x%(20*viewport.scale)}px ${viewport.y%(20*viewport.scale)}px`,
          }} />

          {!hasCurrent && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.15 }}>🎨</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#999', marginBottom: 8 }}>画布是空的</div>
              <div style={{ fontSize: 13, color: '#bbb', marginBottom: 24 }}>去首页生成一套电商图，图片会自动出现在这里</div>
              <div onClick={() => dispatch({ type: 'NEW_WORK' })}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 12,
                  background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer', pointerEvents: 'all' }}>
                <MdAdd size={16} /> 去生成
              </div>
            </div>
          )}

          <div ref={canvasRef} style={{
            position: 'absolute', left: 0, top: 0,
            transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`,
            transformOrigin: '0 0', willChange: 'transform',
          }}>
            {nodes.map(node => (
              <ImageNode key={node.id} node={node} selected={selected===node.id}
                onPointerDown={handleNodePointerDown} onContextMenu={handleContextMenu} />
            ))}
          </div>

          <div style={{ position: 'absolute', bottom: 16, right: 16, fontSize: 11, color: 'rgba(0,0,0,0.28)', pointerEvents: 'none', textAlign: 'right', lineHeight: 1.8 }}>
            滚轮缩放 · 空白处拖动平移 · 右键唤出菜单
          </div>
        </div>

      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 20px 72px' }}>
          {pastWorks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.15 }}>📁</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#999', marginBottom: 8 }}>还没有作品</div>
              <div style={{ fontSize: 13, color: '#bbb' }}>生成的电商图会自动保存到这里</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
              {pastWorks.map(work => (
                <div key={work.id} style={{ borderRadius: 16, overflow: 'hidden', background: '#fff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{work.name}</div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{work.images?.length||0} 张图片</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <div onClick={() => openWork(work)} title="在画布中打开" style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7c3aed' }}><MdOpenInNew size={14} /></div>
                      <div onClick={() => work.images?.forEach((img,i)=>setTimeout(()=>{const a=document.createElement('a');a.href=img.url;a.download=`${work.name}_${i+1}.png`;a.click();},i*300))} title="下载全部" style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666' }}><MdDownload size={14} /></div>
                      <div onClick={() => deleteWork(work.id)} title="删除" style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(239,68,68,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}><MdDelete size={14} /></div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, padding: '0 14px 12px', overflowX: 'auto' }}>
                    {(work.images||[]).slice(0,6).map((img,i) => (
                      <img key={i} src={img.url} alt="" onClick={() => setZoomImg({ url: img.url, label: img.label||'' })}
                        style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)', flexShrink: 0, cursor: 'pointer' }} />
                    ))}
                    {(work.images?.length||0) > 6 && (
                      <div style={{ width: 72, height: 72, borderRadius: 8, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#999', flexShrink: 0 }}>+{work.images.length-6}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} node={contextMenu.node}
          onClose={() => setContextMenu(null)} onAction={handleMenuAction} />
      )}
      {redrawPanel && (
        <RedrawPanel node={redrawPanel} params={{ productName: result.product_name, category: result.category }}
          onClose={() => setRedrawPanel(null)}
          onRedraw={() => { setRedrawPanel(null); }} />
      )}
      {zoomImg && (
        <div onClick={() => setZoomImg(null)} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <img src={zoomImg.url} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} onClick={e => e.stopPropagation()} />
          <div onClick={() => setZoomImg(null)} style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, color: '#fff' }}>x</div>
        </div>
      )}
      <style>{`@keyframes skeletonShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  );
}
