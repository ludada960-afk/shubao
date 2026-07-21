import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MdArrowBack, MdDownload, MdGridOn, MdCollections, MdAdd, MdDelete, MdOpenInNew, MdZoomIn, MdZoomOut, MdFitScreen } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import { saveWork, loadWorks } from '../../services/api';

const LABEL_MAP = {
  white_bg: { title: '白底主图', group: '主图', ratio: '1:1', usage: '搜索结果首图，平台必备，白底突出产品，提升点击率' },
  main_text: { title: '场景主图 1:1', group: '主图', ratio: '1:1', usage: '搜索展示主力图，场景+卖点文案，吸引买家点击' },
  main_3x4: { title: '竖版主图 3:4', group: '主图', ratio: '3:4', usage: '抖音/小红书竖版流量，竖版构图更沉浸，利于转化' },
  transparent: { title: '透明PNG素材', group: '素材', ratio: '1:1', usage: '二次合成素材，可自由叠加任意背景，设计师必备' },
  sku: { title: 'SKU规格图', group: '规格', ratio: '1:1', usage: '颜色/尺码选择器展示图，降低买家决策成本，减少退货' },
  detail_slice_size: { title: '尺寸标注图', group: '详情', ratio: '3:4', usage: '详情页尺寸背书，精准尺码参考，降低因尺码不符退货率' },
  detail_slice_scene: { title: '场景使用图', group: '详情', ratio: '3:4', usage: '真实使用场景展示，帮助买家代入使用感，提升购买欲' },
  detail_slice_qc: { title: '质检报告图', group: '详情', ratio: '3:4', usage: '品质信任背书，降低买家疑虑，适用于食品/母婴/医疗类' },
  detail_slice_compare: { title: '优势对比图', group: '详情', ratio: '3:4', usage: '与竞品直观对比，突出差异化卖点，提升转化' },
  detail_slice_feature: { title: '细节功能图', group: '详情', ratio: '3:4', usage: '产品细节/工艺放大展示，建立品质感知，支撑定价溢价' },
  detail_slice_care: { title: '保养维护图', group: '详情', ratio: '3:4', usage: '使用注意事项说明，减少因误用导致的差评和退货' },
};

function parseImages(images, platform) {
  if (!images || typeof images !== 'object') return [];
  const entries = Array.isArray(images) ? images.map(i => [i.key || i.label || '', i.url]) : Object.entries(images);
  return entries.map(([label, url], i) => {
    const baseKey = label.replace(/_\d+$/, '');
    const info = LABEL_MAP[baseKey] || { title: label, group: '其他', ratio: '1:1', usage: '' };
    return { label, url, title: info.title, group: info.group, ratio: info.ratio, size: info.size, usage: info.usage, displayLabel: info.title + (label !== baseKey ? ` ${label.replace(baseKey + '_', '#')}` : '') };
  });
}

const NODE_W = 200;
const GAP = 28;

function autoLayout(imageList) {
  const cols = Math.min(Math.ceil(Math.sqrt(imageList.length)), 5);
  return imageList.map((img, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const h = img.ratio === '3:4' ? Math.round(NODE_W * 4 / 3) : NODE_W;
    return { id: `node_${img.label}_${i}`, url: img.url, x: col * (NODE_W + GAP), y: row * (h + 60 + GAP), w: NODE_W, h, rotation: 0, label: img.label, displayLabel: img.displayLabel, group: img.group, ratio: img.ratio, usage: img.usage, size: img.size, loaded: false };
  });
}

function SkeletonCard({ w, h }) {
  return (
    <div style={{ width: w, height: h + 60, borderRadius: 12, background: 'rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div style={{ width: '100%', height: h, background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'skeletonShimmer 1.4s infinite' }} />
      <div style={{ padding: '8px 10px' }}><div style={{ height: 10, width: '60%', borderRadius: 5, background: '#e8e8e8', marginBottom: 6 }} /><div style={{ height: 8, width: '80%', borderRadius: 4, background: '#f0f0f0' }} /></div>
    </div>
  );
}

function ImageNode({ node, selected, onPointerDown, onContextMenu }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div onPointerDown={e => onPointerDown(e, node.id)} onContextMenu={e => { e.preventDefault(); onContextMenu?.(e, node); }}
      style={{ position: 'absolute', left: node.x, top: node.y, width: node.w, cursor: 'grab', userSelect: 'none', borderRadius: 12, boxShadow: selected ? '0 0 0 2.5px #7c3aed, 0 8px 32px rgba(124,58,237,0.25)' : '0 4px 16px rgba(0,0,0,0.10)', background: '#fff', transition: 'box-shadow 0.15s', touchAction: 'none' }}>
      <div style={{ position: 'relative', width: '100%', borderRadius: '12px 12px 0 0', overflow: 'hidden', background: '#f5f5f5' }}>
        {!loaded && <SkeletonCard w={node.w} h={node.h} />}
        <img src={node.url} alt={node.label} draggable={false} onLoad={() => setLoaded(true)}
          style={{ width: '100%', height: node.h, objectFit: 'cover', display: 'block', borderRadius: '12px 12px 0 0', opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }} />
      </div>
      <div style={{ padding: '8px 10px 10px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3 }}>{node.group} · {node.displayLabel}</div>
        <div style={{ fontSize: 9, color: '#aaa', marginTop: 2 }}>{node.size}</div>
        {node.usage && <div style={{ fontSize: 9, color: '#b45309', marginTop: 5, lineHeight: 1.5, background: 'rgba(180,83,9,0.06)', borderRadius: 5, padding: '3px 6px' }}>{node.usage}</div>}
      </div>
    </div>
  );
}

export default function EcCanvas() {
  const { state, dispatch } = useApp();
  const result = state.result || {};
  const phone = state.phone || '';
  const [viewport, setViewport] = useState({ x: 80, y: 40, scale: 1 });
  const [nodes, setNodes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [panning, setPanning] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [tab, setTab] = useState('canvas');
  const [pastWorks, setPastWorks] = useState([]);
  const [zoomImg, setZoomImg] = useState(null);
  const containerRef = useRef(null);

  const imageList = parseImages(result.images || {}, result.platform || '淘宝');
  const hasCurrent = imageList.length > 0;

  useEffect(() => {
    if (!hasCurrent) return;
    const newNodes = autoLayout(imageList);
    setNodes(newNodes);
  }, [result.product_name, imageList.length]);

  useEffect(() => {
    const load = async () => {
      const local = [];
      try { local.push(...JSON.parse(localStorage.getItem('shubao_ec_works') || '[]')); } catch {}
      try { const server = await loadWorks(''); const ec = server.filter(w => w._ecResult); const names = new Set(local.map(w => w.name)); for (const w of ec) { if (!names.has(w.product_name)) { local.push({ id: w.id || Date.now(), name: w.product_name, images: Array.isArray(w.images) ? w.images.map(i => ({ url: i.url, key: i.key, label: i.label || i.style || i.key })) : Object.entries(w.images || {}).map(([key, url]) => ({ url, key, label: key })), createdAt: w.at || '' }); } } } catch {}
      setPastWorks(local);
    };
    load();
  }, []);

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    setSelected(null);
    setPanning({ startX: e.clientX, startY: e.clientY, vpX: viewport.x, vpY: viewport.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [viewport.x, viewport.y]);

  const handlePointerMove = useCallback((e) => {
    if (panning) { setViewport(v => ({ ...v, x: panning.vpX + (e.clientX - panning.startX), y: panning.vpY + (e.clientY - panning.startY) })); return; }
    if (dragging) { const dx = (e.clientX - dragging.startX) / viewport.scale; const dy = (e.clientY - dragging.startY) / viewport.scale; setNodes(ns => ns.map(n => n.id === dragging.nodeId ? { ...n, x: dragging.nodeStartX + dx, y: dragging.nodeStartY + dy } : n)); }
  }, [panning, dragging, viewport.scale]);

  const handlePointerUp = useCallback(() => { setPanning(null); setDragging(null); }, []);

  const handleWheel = useCallback((e) => {
    try { e.preventDefault(); } catch {}
    try { const factor = e.deltaY > 0 ? 0.92 : 1.09; setViewport(v => { const ns = Math.max(0.15, Math.min(4, v.scale * factor)); const rect = e.currentTarget.getBoundingClientRect(); const cx = e.clientX - rect.left, cy = e.clientY - rect.top; return { x: (cx - v.x) * (1 - ns / v.scale) + v.x, y: (cy - v.y) * (1 - ns / v.scale) + v.y, scale: ns }; }); } catch {}
  }, []);

  const handleNodeDown = useCallback((e, id) => {
    e.stopPropagation(); if (e.button !== 0) return; setSelected(id); const node = nodes.find(n => n.id === id); if (!node) return; setDragging({ nodeId: id, startX: e.clientX, startY: e.clientY, nodeStartX: node.x, nodeStartY: node.y });
  }, [nodes]);

  const zoomTo = useCallback((s) => { setViewport(v => ({ ...v, scale: Math.max(0.15, Math.min(4, s)) })); }, []);
  const handleDownload = (id) => { const a = document.createElement('a'); const n = id ? nodes.find(n => n.id === id) : nodes.find(n => n.id === selected); if (n) { a.href = n.url; a.download = `${n.label}.png`; a.click(); } };
  const handleDelete = () => { setNodes(ns => ns.filter(n => n.id !== selected)); setSelected(null); };
  const handleNew = () => dispatch({ type: 'NEW_WORK' });
  const handleBack = () => dispatch({ type: 'NAVIGATE', page: 'home' });
  const openWork = (work) => { let images = {}; if (Array.isArray(work.images)) { work.images.forEach(img => { if (img.url) images[img.key || img.label || ''] = img.url; }); } else { images = work.images || {}; } dispatch({ type: 'SET_RESULT', result: { images, product_name: work.name || '历史作品', _ecResult: true, platform: '淘宝' } }); setTab('canvas'); };
  const deleteWork = (id) => { const w = pastWorks.filter(x => x.id !== id); setPastWorks(w); localStorage.setItem('shubao_ec_works', JSON.stringify(w)); };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#F0EEE9', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 52, flexShrink: 0, background: 'rgba(255,255,255,0.9)', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', padding: '0 16px 0 72px', gap: 10, zIndex: 100 }}>
        <div onClick={handleBack} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><MdArrowBack size={16} color="#666" /></div>
        <div style={{ flexShrink: 0, marginLeft: 4 }}><div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{tab === 'canvas' ? (result.product_name || '画布') : '我的作品集'}</div><div style={{ fontSize: 11, color: '#999' }}>{tab === 'canvas' ? `${nodes.length} 张图片` : `${pastWorks.length} 个作品`}</div></div>
        <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'rgba(0,0,0,0.05)', marginLeft: 12, flexShrink: 0 }}>
          {[['canvas','当前画布'],['works','作品集']].map(([id,label]) => (<div key={id} onClick={() => setTab(id)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: tab===id ? '#fff' : 'transparent', color: tab===id ? '#1a1a1a' : '#999', boxShadow: tab===id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{label}</div>))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {tab === 'canvas' && (<><div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 3, borderRadius: 8, background: 'rgba(0,0,0,0.05)' }}>
            <div onClick={() => zoomTo(viewport.scale * 0.8)} style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666' }}><MdZoomOut size={16} /></div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#666', minWidth: 38, textAlign: 'center' }}>{Math.round(viewport.scale * 100)}%</div>
            <div onClick={() => zoomTo(viewport.scale * 1.25)} style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#666' }}><MdZoomIn size={16} /></div>
          </div>
            <div onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><MdDelete size={14} /> 删除</div>
          </>)}
          <div onClick={handleNew} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 34, padding: '0 14px', borderRadius: 8, background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 12px rgba(124,58,237,0.30)' }}><MdAdd size={14} /> 新建生图</div>
        </div>
      </div>

      {tab === 'canvas' ? (
        <div ref={containerRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onWheel={handleWheel}>
          {!hasCurrent && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.15 }}>🎨</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#999', marginBottom: 8 }}>画布是空的</div>
              <div style={{ fontSize: 13, color: '#bbb', marginBottom: 24 }}>去首页生成一套电商图，图片会自动出现在这里</div>
              <div onClick={handleNew} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 24px', borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}><MdAdd size={16} /> 去生成</div>
            </div>
          )}
          <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`, transformOrigin: '0 0', willChange: 'transform' }}>
            {nodes.map(node => (<ImageNode key={node.id} node={node} selected={selected === node.id} onPointerDown={handleNodeDown} />))}
          </div>
          <div style={{ position: 'absolute', bottom: 16, right: 16, fontSize: 11, color: 'rgba(0,0,0,0.28)', pointerEvents: 'none' }}>拖拽平移 · 滚轮缩放 · 点击选中 · 顶部删除</div>
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 20px 72px' }}>
          {pastWorks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px' }}><div style={{ fontSize: 56, marginBottom: 16, opacity: 0.15 }}>📁</div><div style={{ fontSize: 18, fontWeight: 700, color: '#999' }}>还没有作品</div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16 }}>
              {pastWorks.map(work => (<div key={work.id} style={{ borderRadius: 16, overflow: 'hidden', background: '#fff', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' }}>
                  <div><div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{work.name}</div><div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{work.images?.length||0} 张图片</div></div>
                  <div style={{ display: 'flex', gap: 4 }}><div onClick={() => openWork(work)} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(124,58,237,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#7c3aed' }}><MdOpenInNew size={14} /></div><div onClick={() => deleteWork(work.id)} style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(239,68,68,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}><MdDelete size={14} /></div></div>
                </div>
                <div style={{ display: 'flex', gap: 6, padding: '0 14px 12px', overflowX: 'auto' }}>{(work.images||[]).slice(0,6).map((img,i) => (<img key={i} src={img.url} alt="" onClick={() => setZoomImg({url:img.url,label:img.label||''})} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(0,0,0,0.06)', flexShrink: 0, cursor: 'pointer' }} />))}</div>
              </div>))}
            </div>
          )}
        </div>
      )}

      {zoomImg && (
        <div onClick={() => setZoomImg(null)} style={{ position: 'fixed', inset: 0, zIndex: 10001, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <img src={zoomImg.url} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 12 }} onClick={e => e.stopPropagation()} />
          <div onClick={() => setZoomImg(null)} style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 24, color: '#fff' }}>x</div>
        </div>
      )}

      <style>{`@keyframes skeletonShimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  );
}
