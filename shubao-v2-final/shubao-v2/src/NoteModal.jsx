import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Check, RefreshCw, Download, X, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { proxyImg, regenerateImage, downloadZip } from './services/api';
import { IMAGES } from './constants/images';

export default function NoteModal({ item, onClose, textRegen, onDownload, onItemUpdate, onRegenStart, onUnlock }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [rgIdx, setRgIdx] = useState(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editTags, setEditTags] = useState('');

  const imgs = useMemo(() => {
    const a = [];
    if (item?.cover_url) a.push(proxyImg(item.cover_url));
    if (item?.image_urls?.length) item.image_urls.forEach(u => { if (u) a.push(proxyImg(u)); });
    return a;
  }, [item]);

  const isPreview = item?._preview || item?.preview;
  // 预览模式：只有封面，其余8张用占位
  const totalSlots = isPreview ? 9 : imgs.length;
  const displayImgs = isPreview
    ? [...imgs, ...Array(Math.max(0, 9 - imgs.length)).fill(null)]
    : imgs;

  const bodyText = item?.body_text || '';
  const tagStr = (item?.hashtags || []).join(' ');
  const maxI = displayImgs.length || 1;

  // 键盘导航
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft' && maxI > 1) { setImgIdx(i => Math.max(0, i - 1)); e.preventDefault(); }
      if (e.key === 'ArrowRight' && maxI > 1) { setImgIdx(i => Math.min(maxI - 1, i + 1)); e.preventDefault(); }
      if (e.key === 'Escape') { if (zoom) setZoom(false); else onClose(); e.preventDefault(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [maxI, zoom, onClose]);

  // 滚轮切图
  const handleWheel = (e) => {
    if (e.deltaY > 0 && imgIdx < maxI - 1) setImgIdx(i => i + 1);
    if (e.deltaY < 0 && imgIdx > 0) setImgIdx(i => i - 1);
  };

  // 单图重生成
  const regenSingle = async (i) => {
    if (item?._galleryItem) { alert('这是薯包出品的展示内容，请先自己生成作品后再使用此功能'); return; }
    if (!confirm('重新生成这张图片将消耗1次额度，确定？')) return;
    setRgIdx(i);
    if (typeof onRegenStart === 'function') onRegenStart(i);
    try {
      let prompt = '';
      if (i === 0 && item?.cover_prompt) prompt = item.cover_prompt;
      else if (i > 0 && item?.image_prompts) {
        const pi = item.image_prompts.find(pp => pp.page_id === i);
        if (pi) prompt = pi.prompt;
      }
      if (!prompt) throw new Error('未找到该页的图片描述');
      const url = await regenerateImage(prompt, item?.category || '');
      if (typeof onItemUpdate === 'function') onItemUpdate(i, url, item?._inputText || '');
    } catch (e) { alert('图片生成失败：' + e.message); }
    setRgIdx(null);
  };

  // 复制全文（使用最新内容）
  const copyAll = () => {
    const title = editing ? editTitle : (item.title || '');
    const body = editing ? editBody : bodyText;
    const tags = editing ? editTags : tagStr;
    const tx = `${title}\n\n${body}\n\n${tags}`;
    navigator.clipboard?.writeText(tx).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  // 导出
  const handleExport = async () => {
    if (item?._galleryItem) { alert('这是薯包出品的展示内容，请先自己生成作品后再使用此功能'); return; }
    setExporting(true);
    try {
      if (typeof onDownload === 'function') await onDownload(item.cover_url, item.image_urls, item.title, item.body_text, item.hashtags);
      else await downloadZip(item.cover_url, item.image_urls, item.title, item.body_text, item.hashtags);
    } catch (e) { /* ignore */ }
    setExporting(false);
  };

  if (!item) return null;

  return (
    <>
      {/* ── 背景遮罩 ── */}
      <div style={S.overlay} onClick={onClose} className="animate-fade-in">
        {/* ── Zoom 大图 ── */}
        {zoom && (
          <div style={S.zoomBg} onClick={(e) => { e.stopPropagation(); setZoom(false); }}>
            {imgIdx > 0 && (
              <button style={{ ...S.zoomNav, left: 12 }} onClick={(e) => { e.stopPropagation(); setImgIdx(i => Math.max(0, i - 1)); }}>
                <ArrowLeft size={18} />
              </button>
            )}
            <img src={imgs[imgIdx]} alt="" style={S.zoomImg} onClick={e => e.stopPropagation()} />
            {imgIdx < maxI - 1 && (
              <button style={{ ...S.zoomNav, right: 12 }} onClick={(e) => { e.stopPropagation(); setImgIdx(i => Math.min(maxI - 1, i + 1)); }}>
                <ArrowRight size={18} />
              </button>
            )}
            <div style={S.zoomCounter}>{imgIdx + 1}/{maxI} · ← → 切换 · ESC 关闭</div>
          </div>
        )}

        {/* ── 主弹窗 ── */}
        <div style={S.modal} onClick={e => e.stopPropagation()} className="animate-scale-in">
          <div style={S.main}>

            {/* LEFT: 图片区 */}
            <div style={S.imagePanel}>
              <div style={S.imageView} onWheel={handleWheel}
                onMouseEnter={e => e.currentTarget.querySelectorAll('.nhb').forEach(b => b.style.opacity = '1')}
                onMouseLeave={e => e.currentTarget.querySelectorAll('.nhb').forEach(b => b.style.opacity = '0')}
              >
                {displayImgs[imgIdx] ? (
                  <img src={displayImgs[imgIdx]} alt="" style={S.mainImg} onClick={() => setZoom(true)} />
                ) : isPreview ? (
                  /* 锁定占位 */
                  <div style={{
                    width: '100%', height: '100%', minHeight: 300,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg, #f8f8f8 0%, #e8e8e8 100%)',
                    gap: 12, padding: 32,
                  }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%',
                      background: 'rgba(255,71,87,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24,
                    }}>🔒</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#555' }}>
                      第 {imgIdx + 1} 张配图
                    </div>
                    <div style={{ fontSize: 12, color: '#999', textAlign: 'center', lineHeight: 1.6 }}>
                      购买套餐后解锁完整 9 张精美配图
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (onUnlock) onUnlock(); }}
                      style={{
                        marginTop: 4, padding: '9px 24px', border: 'none',
                        borderRadius: 10, fontSize: 13, fontWeight: 600,
                        background: 'var(--red, #FF4757)', color: '#fff',
                        cursor: 'pointer', fontFamily: 'inherit',
                        boxShadow: '0 4px 16px rgba(255,71,87,0.2)',
                      }}
                    >
                      解锁全部配图
                    </button>
                  </div>
                ) : (
                  <div style={{ color: '#ccc', fontSize: 13 }}>暂无图片</div>
                )}

                {/* 重生成按钮 - 预览模式不显示 */}
                {!isPreview && (
                  <button className="nhb" style={S.regenBtn} onClick={() => regenSingle(imgIdx)}>
                    {rgIdx === imgIdx ? <><Loader2 size={11} className="animate-spin" /> 刷新中...</> : <><RefreshCw size={11} /> 重生成此图</>}
                  </button>
                )}

                {/* 左右导航 */}
                {maxI > 1 && imgIdx > 0 && (
                  <button className="nhb" style={{ ...S.imgNav, left: 6 }} onClick={e => { e.stopPropagation(); setImgIdx(i => i - 1); }}>‹</button>
                )}
                {maxI > 1 && imgIdx < maxI - 1 && (
                  <button className="nhb" style={{ ...S.imgNav, right: 6 }} onClick={e => { e.stopPropagation(); setImgIdx(i => i + 1); }}>›</button>
                )}
              </div>

              {/* 缩略图条 */}
              {maxI > 1 && (
                <div style={S.thumbStrip}>
                  {displayImgs.map((url, i) => (
                    <div key={i} onClick={() => setImgIdx(i)} style={{
                      ...S.thumb,
                      border: i === imgIdx ? '2px solid #333' : '2px solid transparent',
                      opacity: i === imgIdx ? 1 : 0.35,
                      background: url ? 'transparent' : '#f0f0f0',
                    }}>
                      {url ? (
                        <img src={url} alt="" style={S.thumbImg} loading="lazy" />
                      ) : (
                        <div style={{
                          width: '100%', height: '100%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, color: '#ccc',
                        }}>🔒</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: 文字区 */}
            <div style={S.textPanel}>
              <div style={S.textScroll}>
                {/* 头部 */}
                <div style={S.header}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img src={IMAGES.appicon} alt="" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#222' }}>薯包AI</div>
                      <div style={{ fontSize: 12, color: '#999' }}>AI创作 · 一键生成</div>
                    </div>
                  </div>
                  <button onClick={onClose} style={S.closeBtn}>
                    <X size={18} />
                  </button>
                </div>

                {/* 预览模式提示 */}
                {isPreview && (
                  <div style={{
                    background: 'linear-gradient(135deg, #FFF7ED, #FFF1F3)',
                    border: '1px solid #FED7AA',
                    borderRadius: 10, padding: '10px 14px', marginBottom: 14,
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12.5, color: '#9A3412', lineHeight: 1.5,
                  }}>
                    <span style={{ fontSize: 16 }}>🎁</span>
                    <div>
                      <strong>免费预览</strong> — 文案已完整生成，配图仅展示封面。
                      <span onClick={() => { if (onUnlock) onUnlock(); }}
                        style={{ color: '#FF4757', cursor: 'pointer', fontWeight: 600, marginLeft: 4 }}>
                        购买套餐解锁全部 9 张配图 →
                      </span>
                    </div>
                  </div>
                )}

                {/* 标题 */}
                {editing ? (
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    style={{ ...S.title, border: '2px solid #f0f0f0', borderRadius: 10, padding: '8px 12px', width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit' }} />
                ) : (
                  <h1 style={S.title}>{item.title || ''}</h1>
                )}

                {/* 正文 */}
                {editing ? (
                  <textarea value={editBody} onChange={e => setEditBody(e.target.value)}
                    style={{ ...S.body, border: '2px solid #f0f0f0', borderRadius: 10, padding: '12px', width: '100%', minHeight: 200, boxSizing: 'border-box', outline: 'none', resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }} />
                ) : (
                  <div style={S.body}>
                    {bodyText.split('\n').map((line, i) => (
                      <div key={i} style={{ marginBottom: line.trim() ? 6 : 0, lineHeight: 1.85 }}>
                        {line || ' '}
                      </div>
                    ))}
                  </div>
                )}

                {/* 标签 */}
                {editing ? (
                  <input value={editTags} onChange={e => setEditTags(e.target.value)}
                    placeholder="标签，用空格分隔"
                    style={{ fontSize: 12, border: '2px solid #f0f0f0', borderRadius: 10, padding: '8px 12px', width: '100%', boxSizing: 'border-box', outline: 'none', marginBottom: 10, fontFamily: 'inherit', color: '#888' }} />
                ) : (item.hashtags || []).length > 0 && (
                  <div style={S.tags}>
                    {item.hashtags.map((t, i) => (
                      <span key={i} style={S.tag}>{t}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* 底部操作栏 */}
              <div style={S.actionBar}>
                {/* 编辑/保存 */}
                {!item._galleryItem && (
                  <button style={{ ...S.actionBtn, background: editing ? '#e3f2fd' : '#f5f5f5', color: editing ? '#1565c0' : '#333' }}
                    onClick={() => {
                      if (editing) {
                        // 保存编辑
                        if (typeof onItemUpdate === 'function') {
                          // 通过 dispatch 更新 result
                        }
                        // 直接修改 item 引用（因为是同一个对象）
                        item.title = editTitle;
                        item.body_text = editBody;
                        item.hashtags = editTags.split(/\s+/).filter(Boolean);
                        setEditing(false);
                      } else {
                        // 进入编辑
                        setEditTitle(item.title || '');
                        setEditBody(item.body_text || '');
                        setEditTags((item.hashtags || []).join(' '));
                        setEditing(true);
                      }
                    }}>
                    {editing ? <><Check size={13} /> 保存修改</> : <>✏️ 编辑文案</>}
                  </button>
                )}

                {/* 复制 */}
                <button style={{ ...S.actionBtn, background: copied ? '#e8f5e9' : '#f5f5f5', color: copied ? '#2e7d32' : '#333' }} onClick={copyAll}>
                  {copied ? <><Check size={13} /> 已复制</> : <><Copy size={13} /> 复制全文</>}
                </button>
                {textRegen && !editing && (
                  <button style={S.actionBtn} onClick={() => {
                    if (item._galleryItem) { alert('这是薯包出品的展示内容，请先自己生成作品后再使用此功能'); return; }
                    textRegen();
                  }}>
                    <RefreshCw size={13} /> 重新生成
                  </button>
                )}
                {!editing && (
                  isPreview ? (
                    <button style={{ ...S.actionBtn, background: 'var(--red, #FF4757)', color: '#fff' }}
                      onClick={() => { if (onUnlock) onUnlock(); }}>
                      🔓 解锁完整图文
                    </button>
                  ) : (
                    <button style={S.actionBtn} onClick={handleExport}>
                      {exporting ? <><Loader2 size={13} className="animate-spin" /> 打包中...</> : <><Download size={13} /> 导出图文</>}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── 样式常量 ── */
const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 900,
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: '#fff', borderRadius: 14, width: '94vw', maxWidth: 1100,
    height: '90vh', display: 'flex', flexDirection: 'column',
    overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  main: { display: 'flex', flex: 1, overflow: 'hidden' },

  // Image panel
  imagePanel: { flex: '0 0 60%', background: '#f5f5f5', display: 'flex', flexDirection: 'column' },
  imageView: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', overflow: 'hidden',
  },
  mainImg: {
    maxWidth: '100%', maxHeight: 'calc(90vh - 90px)', objectFit: 'contain',
    cursor: 'pointer', display: 'block',
  },
  regenBtn: {
    position: 'absolute', left: 8, bottom: 8,
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
    border: 'none', borderRadius: 6, padding: '5px 10px',
    color: '#fff', fontSize: 11, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4,
    zIndex: 5, opacity: 0, transition: 'opacity 0.15s', fontFamily: 'inherit',
  },
  imgNav: {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: 32, height: 32, borderRadius: '50%',
    background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, zIndex: 5, opacity: 0, transition: 'opacity 0.15s', lineHeight: 1,
  },
  thumbStrip: {
    display: 'flex', gap: 4, padding: '8px 12px', borderTop: '1px solid #eee',
    justifyContent: 'center', overflowX: 'auto',
  },
  thumb: {
    flex: '0 0 auto', width: 36, height: 48, borderRadius: 4,
    overflow: 'hidden', cursor: 'pointer', transition: 'all 0.12s',
  },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },

  // Text panel
  textPanel: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  textScroll: { flex: 1, overflowY: 'auto', padding: '16px 22px 0' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #f0f0f0',
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#999', cursor: 'pointer', padding: 4,
    borderRadius: 6, display: 'flex',
  },
  title: {
    fontSize: 18, fontWeight: 700, lineHeight: 1.4, color: '#222',
    margin: '0 0 12px',
  },
  body: { fontSize: 14.5, lineHeight: 1.85, color: '#444', marginBottom: 14 },
  tags: { display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 },
  tag: {
    fontSize: 12, color: '#888', background: '#f5f5f5',
    padding: '4px 12px', borderRadius: 20,
  },

  // Action bar
  actionBar: {
    padding: '14px 22px', borderTop: '1px solid #f0f0f0',
    background: '#fff', display: 'flex', gap: 10,
  },
  actionBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    background: '#f5f5f5', border: 'none', borderRadius: 10,
    fontSize: 13, fontWeight: 500, color: '#333',
    padding: '12px 6px', cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.15s',
  },

  // Zoom
  zoomBg: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  zoomImg: { maxWidth: '88%', maxHeight: '92vh', objectFit: 'contain', borderRadius: 8 },
  zoomNav: {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)',
    width: 42, height: 42, borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 10, transition: 'background 0.2s',
  },
  zoomCounter: {
    position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
    color: 'rgba(255,255,255,0.5)', fontSize: 12,
  },
};
