import React, { useState, useEffect, useMemo } from 'react';
import { MdContentCopy, MdCheck, MdRefresh, MdDownload, MdClose, MdAutorenew, MdArrowBack, MdArrowForward, MdFullscreen } from 'react-icons/md';
import { proxyImg, regenerateImage, downloadZip } from './services/api';
import { IMAGES } from './constants/images';
import { EC_PLATFORM_SPECS } from './constants/data';

export default function NoteModal({ item, onClose, textRegen, onDownload, onItemUpdate, onRegenStart, onUnlock, onGallery }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [rgIdx, setRgIdx] = useState(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editTags, setEditTags] = useState('');
  const [ecZoom, setEcZoom] = useState(false);
  const [ecIdx, setEcIdx] = useState(0);

  const imgs = useMemo(() => {
    const a = [];
    if (item?.cover_url) a.push(proxyImg(item.cover_url));
    if (item?.image_urls?.length) item.image_urls.forEach(u => { if (u) a.push(proxyImg(u)); });
    return a;
  }, [item]);

  const isPreview = item?._preview || item?.preview;
  const isTrialLocked = item?._trialLocked;
  // 预览模式：只有封面，其余8张用占位
  // 试用模式：全量生成，只展示封面，其余图片模糊水印
  const maxSlots = 9;
  const displayImgs = isPreview
    ? [...imgs, ...Array(Math.max(0, maxSlots - imgs.length)).fill(null)]
    : imgs;

  const bodyText = item?.body_text || '';
  const tagStr = (item?.hashtags || []).join(' ');
  const maxI = displayImgs.length || 1;

  // 键盘导航
  useEffect(() => {
    const handler = (e) => {
      if (item?._ecResult) {
        if (e.key === 'ArrowLeft' && ecZoom) { setEcIdx(i => Math.max(0, i - 1)); e.preventDefault(); }
        if (e.key === 'ArrowRight' && ecZoom) { setEcIdx(i => Math.min(Object.keys(item.images || {}).length - 1, i + 1)); e.preventDefault(); }
        if (e.key === 'Escape') { if (ecZoom) { setEcZoom(false); e.preventDefault(); } else onClose(); }
      } else {
        if (e.key === 'ArrowLeft' && maxI > 1) { setImgIdx(i => Math.max(0, i - 1)); e.preventDefault(); }
        if (e.key === 'ArrowRight' && maxI > 1) { setImgIdx(i => Math.min(maxI - 1, i + 1)); e.preventDefault(); }
        if (e.key === 'Escape') { if (zoom) setZoom(false); else onClose(); e.preventDefault(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [maxI, zoom, ecZoom, item, onClose]);

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

  // ═══════ EC 结果展示 ═══════
  if (item._ecResult) {
    // 兼容新旧格式：新格式是数组[{role,style,url,...}]，旧格式是{style:url}
    const images = Array.isArray(item.images) ? item.images : Object.entries(item.images || {});
    const platform = item.platform || '淘宝';
    const specs = EC_PLATFORM_SPECS[platform] || EC_PLATFORM_SPECS['淘宝'];
    const styleIcon = (s) => {
      const icons = {
        '白底图':'⬜', '主图文案':'🖼️', '卖点解说图':'💬', '使用场景图':'🌄',
        '详情图':'📋', '材质特写':'🔍', '多规格展示':'🎨', '效果对比':'📊',
        '包装组合':'📦', '透明PNG素材':'🎯', '美妆分析报告':'📈',
        '卖点图①':'⭐', '卖点图②':'⭐', '卖点图③':'⭐',
      };
      return icons[s] || '🖼️';
    };

    // 获取图片的URL和标签（兼容新旧格式）
    const KEY_LABELS = {
      white_bg:'白底图', main_text:'主图文案', feature:'卖点解说图', scene:'使用场景图',
      detail:'详情图', macro:'材质特写', sku:'多规格展示', comparison:'效果对比',
      package:'包装组合', transparent:'透明PNG素材', beauty_report:'美妆分析报告',
      main_white:'白底图',
    };
    const getUrl = (img) => Array.isArray(img) ? img[1] : img.url;
    const getLabel = (img) => {
      const raw = Array.isArray(img) ? img[0] : (img.style || img.label || img.key || '商品图');
      return KEY_LABELS[raw] || raw;
    };
    // 从标签查平台规格尺寸（兼容新旧标签名）
    const specKeyMap = { '白底图':'白底主图', '主图文案':'白底主图' };
    const getSpec = (label) => specs.sizes[label] || specs.sizes[specKeyMap[label]] || '';
    const getSellingPoint = (img) => Array.isArray(img) ? '' : (img.sellingPoint || '');

    return (
      <div style={S.overlay} onClick={onClose} className="animate-fade-in">
        {/* ── EC Zoom 灯箱 — 试用模式阻止全屏放大 */}
        {!isTrialLocked && ecZoom && images[ecIdx] && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#000', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }} onClick={() => setEcZoom(false)}>
            {images.length > 1 && ecIdx > 0 && (
              <button style={{ ...S.zoomNav, left: 12, color: '#fff', background: 'rgba(255,255,255,0.15)' }}
                onClick={(e) => { e.stopPropagation(); setEcIdx(i => i - 1); }}>
                <MdArrowBack size={18} />
              </button>
            )}
            <img src={proxyImg(getUrl(images[ecIdx]))} alt="" style={S.zoomImg} onClick={e => e.stopPropagation()} />
            {images.length > 1 && ecIdx < images.length - 1 && (
              <button style={{ ...S.zoomNav, right: 12, color: '#fff', background: 'rgba(255,255,255,0.15)' }}
                onClick={(e) => { e.stopPropagation(); setEcIdx(i => i + 1); }}>
                <MdArrowForward size={18} />
              </button>
            )}
            <div style={{
              position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: 20, alignItems: 'center',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
              padding: '8px 20px', borderRadius: 20, color: 'rgba(255,255,255,0.85)',
              fontSize: 12,
            }}>
              <span>{styleIcon(getLabel(images[ecIdx]))} {getLabel(images[ecIdx])}{getSellingPoint(images[ecIdx]) ? ' · ' + getSellingPoint(images[ecIdx]) : ''}</span>
              <span style={{ opacity: 0.6 }}>|</span>
              <span style={{ opacity: 0.7 }}>{getSpec(getLabel(images[ecIdx]))}</span>
              <span style={{ opacity: 0.6 }}>|</span>
              <span>{ecIdx + 1}/{images.length}</span>
              <span style={{ opacity: 0.35, marginLeft: 4 }}>← → 切换 · ESC 关闭</span>
            </div>
          </div>
        )}

        {/* ── EC 弹窗 ── */}
        <div style={{
          background: '#fff', borderRadius: 14, width: '94vw', maxWidth: 780,
          maxHeight: '90vh', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        }} onClick={e => e.stopPropagation()} className="animate-scale-in">
          {/* Header */}
          <div style={{
            padding: '24px 28px 16px', borderBottom: '1px solid #eef0f5',
            background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
            position: 'sticky', top: 0, zIndex: 2,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1e1e2e', marginBottom: 6 }}>
                  🛍️ {item.product_name}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{
                    background: 'var(--blue-bg)', color: '#4338CA',
                    padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                  }}>{item.category}</span>
                  <span style={{
                    background: '#fff', color: '#555',
                    padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                    border: '1px solid #e0e0e0',
                  }}>{specs.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                    共 {images.length} 张 · 已适配 {platform}
                  </span>
                </div>
              </div>
              <button onClick={onClose} style={{
                background: 'rgba(255,255,255,0.8)', border: 'none', color: '#999',
                cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}>
                <MdClose size={16} />
              </button>
            </div>
          </div>

          {/* 平台规范提示 */}
          <div style={{
            padding: '10px 28px', background: '#f8f9fc',
            borderBottom: '1px solid #eef0f5',
            fontSize: 11, color: 'var(--text-hint)', lineHeight: 1.6,
          }}>
            <span style={{ fontWeight: 600, color: '#666' }}>📐 {specs.name} 规范:</span>
            {' '}{specs.rules}
          </div>

          {/* EC 试用锁定提示 */}
          {isTrialLocked && (
            <div style={{
              padding: '12px 28px',
              background: 'linear-gradient(135deg, #FFF7ED, #FFF1F3)',
              borderBottom: '1.5px solid #FED7AA',
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12.5, color: '#9A3412', lineHeight: 1.5,
            }}>
              <span style={{ fontSize: 16 }}>🎁</span>
              <div>
                <strong>免费试玩</strong> — 图片已完整生成，试玩版带水印遮挡。
                <span onClick={() => { if (onUnlock) onUnlock(); }}
                  style={{ color: '#FF4757', cursor: 'pointer', fontWeight: 600, marginLeft: 4 }}>
                  立即充值解锁高清原图 →
                </span>
              </div>
              <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                <span onClick={() => { if (onGallery) onGallery(); }}
                  style={{ color: '#4338CA', cursor: 'pointer', fontWeight: 500, fontSize: 11 }}>
                  👀 薯包出品
                </span>
              </div>
            </div>
          )}

          {/* Image Grid */}
          <div style={{ padding: 24 }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: 16,
            }}>
              {images.map((img, i) => {
                const style = getLabel(img);
                const url = getUrl(img);
                const size = getSpec(style);
                const isLocked = isTrialLocked;
                return (
                  <div key={style} className="ec-card" style={{
                    background: '#fff', borderRadius: 10, overflow: 'hidden',
                    border: isLocked ? '1.5px solid #fde68a' : '1px solid #f0f0f0',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                    transition: 'box-shadow 0.2s, transform 0.2s',
                  }}
                    onMouseEnter={e => {
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
                      e.currentTarget.style.transform = 'none';
                    }}
                  >
                    <div style={{
                      position: 'relative', width: '100%', aspectRatio: '1/1',
                      background: '#f8f8f8', overflow: 'hidden',
                      cursor: isLocked ? 'default' : 'pointer',
                    }} onClick={() => { if (!isLocked) { setEcIdx(i); setEcZoom(true); } }}>
                      <img src={proxyImg(url)} alt={style}
                        style={{
                          width: '100%', height: '100%', objectFit: 'contain',
                          display: 'block', background: '#fff',
                          transition: 'transform 0.3s',
                          filter: isLocked ? 'blur(12px)' : 'none',
                          opacity: isLocked ? 0.5 : 1,
                        }}
                        loading="lazy"
                      />
                      {isLocked ? (
                        <div style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 6, background: 'rgba(0,0,0,0.15)',
                        }}>
                          <div style={{ fontSize: 28 }}>🔒</div>
                          <div style={{ fontSize: 11, color: '#fff', fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                            充值解锁
                          </div>
                        </div>
                      ) : (
                        <div className="ec-card-overlay" style={{
                          position: 'absolute', inset: 0,
                          background: 'rgba(0,0,0,0)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          opacity: 0, transition: 'all 0.2s',
                          color: '#fff', fontSize: 12, fontWeight: 600, gap: 4,
                        }}>
                          <MdFullscreen size={14} /> 点击放大
                        </div>
                      )}
                      {size && (
                        <div style={{
                          position: 'absolute', bottom: 6, left: 6,
                          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                          padding: '2px 7px', borderRadius: 4,
                          fontSize: 9, color: '#fff', fontWeight: 500,
                        }}>
                          {isLocked ? '🔒 ' + size : size}
                        </div>
                      )}
                    </div>
                    <div style={{
                      padding: '10px 12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      borderTop: '1px solid #f5f5f5',
                    }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: isLocked ? '#999' : '#444' }}>
                        {styleIcon(style)} {style}
                      </span>
                      {isLocked ? (
                        <span style={{
                          fontSize: 10, color: '#999', padding: '4px 10px', borderRadius: 6,
                          background: '#f5f5f5', fontWeight: 500,
                        }}>🔒 已锁定</span>
                      ) : (
                        <button onClick={(e) => {
                          e.stopPropagation();
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${item.product_name}-${style}.png`;
                          a.click();
                        }} style={{
                          fontSize: 10, color: '#4338CA', cursor: 'pointer',
                          padding: '4px 10px', borderRadius: 6,
                          background: '#EEF2FF', border: 'none', fontWeight: 600, fontFamily: 'inherit',
                          transition: 'background 0.15s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.background = '#C7D2FE'}
                          onMouseLeave={e => e.currentTarget.style.background = '#EEF2FF'}
                        >
                          下载
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {images.length === 0 && !item.errors?.length && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-faint)', fontSize: 13 }}>
                暂无生成图片
              </div>
            )}

            {/* Errors */}
            {item.errors?.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {item.errors.map((e, i) => (
                  <div key={i} style={{
                    fontSize: 11, color: '#C53030', background: '#FFF5F5',
                    borderRadius: 8, padding: '8px 12px', lineHeight: 1.5,
                  }}>
                    ⚠️ <strong>{e.style}</strong> 生成失败: {e.error}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Action Bar */}
          <div style={{
            padding: '14px 28px', borderTop: '1px solid #eef0f5',
            background: '#f8f9fc', display: 'flex', gap: 10, alignItems: 'center',
            position: 'sticky', bottom: 0,
          }}>
            {isTrialLocked ? (
              <button onClick={() => { if (onUnlock) onUnlock(); }} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 600, padding: '12px 6px', cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 2px 8px rgba(255,71,87,0.3)',
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                🔓 解锁高清原图
              </button>
            ) : (
              <button onClick={() => {
                (Array.isArray(item.images) ? item.images : Object.entries(item.images || {})).forEach((img) => {
                  const url = Array.isArray(img) ? img[1] : img.url;
                  const label = Array.isArray(img) ? img[0] : (img.style || img.label || '商品图');
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${item.product_name || '商品'}-${label}.png`;
                  a.click();
                });
              }} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 600, padding: '12px 6px', cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 2px 8px rgba(102,126,234,0.3)',
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <MdDownload size={13} /> 下载全部图片
              </button>
            )}
            <button onClick={onClose} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              background: '#fff', color: '#666', border: '1px solid #e0e0e0', borderRadius: 10,
              fontSize: 13, fontWeight: 500, padding: '12px 20px', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.borderColor = '#ccc'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#e0e0e0'; }}
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── 背景遮罩 ── */}
      <div style={S.overlay} onClick={onClose} className="animate-fade-in">
        {/* ── Zoom 大图 ── */}
        {zoom && (
          <div style={S.zoomBg} onClick={(e) => { e.stopPropagation(); setZoom(false); }}>
            {imgIdx > 0 && (
              <button style={{ ...S.zoomNav, left: 12 }} onClick={(e) => { e.stopPropagation(); setImgIdx(i => Math.max(0, i - 1)); }}>
                <MdArrowBack size={18} />
              </button>
            )}
            <img src={imgs[imgIdx]} alt="" style={S.zoomImg} onClick={e => e.stopPropagation()} />
            {imgIdx < maxI - 1 && (
              <button style={{ ...S.zoomNav, right: 12 }} onClick={(e) => { e.stopPropagation(); setImgIdx(i => Math.min(maxI - 1, i + 1)); }}>
                <MdArrowForward size={18} />
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
                  isTrialLocked && imgIdx > 0 ? (
                    <div style={{
                      width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative', overflow: 'hidden',
                    }}>
                      <img src={displayImgs[imgIdx]} alt=""
                        style={{ maxWidth: '100%', maxHeight: 'calc(90vh - 90px)', objectFit: 'contain', display: 'block', filter: 'blur(16px)', opacity: 0.5, transform: 'scale(1.1)' }} />
                      {/* 遮罩层 */}
                      <div style={{
                        position: 'absolute', inset: 0,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 10, padding: 24, zIndex: 2,
                      }}>
                        <div style={{ fontSize: 36, filter: 'none' }}>🔒</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.5)', textAlign: 'center' }}>
                          充值解锁全套服务
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 6px rgba(0,0,0,0.4)', textAlign: 'center', maxWidth: 280 }}>
                          支付 ¥19 起 · 解锁所有配图 + 下载 + 保存至作品集
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 6, filter: 'none' }}>
                          <button onClick={(e) => { e.stopPropagation(); if (onUnlock) onUnlock(); }}
                            style={{
                              padding: '11px 28px', background: 'var(--red, #FF4757)', color: '#fff',
                              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
                              cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(255,71,87,0.35)',
                            }}>
                            立即充值
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); if (onGallery) onGallery(); }}
                            style={{
                              padding: '11px 20px', background: 'rgba(255,255,255,0.92)', color: '#333',
                              border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 500,
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                            👀 查看薯包出品
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <img src={displayImgs[imgIdx]} alt="" style={S.mainImg} onClick={() => setZoom(true)} />
                  )
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

                {/* 重生成按钮 - 预览/试用锁定模式不显示 */}
                {!isPreview && !(isTrialLocked && imgIdx > 0) && (
                  <button className="nhb" style={S.regenBtn} onClick={() => regenSingle(imgIdx)}>
                    {rgIdx === imgIdx ? <><MdAutorenew size={11} className="animate-spin" /> 刷新中...</> : <><MdRefresh size={11} /> 重生成此图</>}
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
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                      {url ? (
                        <img src={url} alt="" style={{
                          ...S.thumbImg,
                          filter: isTrialLocked && i > 0 ? 'blur(4px)' : 'none',
                          opacity: isTrialLocked && i > 0 ? 0.5 : 1,
                        }} loading="lazy" />
                      ) : (
                        <div style={{
                          width: '100%', height: '100%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, color: '#ccc',
                        }}>🔒</div>
                      )}
                      {isTrialLocked && i > 0 && (
                        <div style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.5)',
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
                    <MdClose size={18} />
                  </button>
                </div>

                {/* 试用锁定提示 */}
                {isTrialLocked && (
                  <div style={{
                    background: 'linear-gradient(135deg, #FFF7ED, #FFF1F3)',
                    border: '1.5px solid #FED7AA',
                    borderRadius: 10, padding: '12px 14px', marginBottom: 14,
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12.5, color: '#9A3412', lineHeight: 1.5,
                  }}>
                    <span style={{ fontSize: 18 }}>🎁</span>
                    <div>
                      <strong>免费试玩</strong> — 完整文案 + 9 张配图已生成，配图试玩版仅展示封面。
                      <span onClick={() => { if (onUnlock) onUnlock(); }}
                        style={{ color: '#FF4757', cursor: 'pointer', fontWeight: 600, marginLeft: 4 }}>
                        立即充值解锁全部 →
                      </span>
                    </div>
                    <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                      <span onClick={() => { if (onGallery) onGallery(); }}
                        style={{ color: '#4338CA', cursor: 'pointer', fontWeight: 500, fontSize: 11 }}>
                        👀 薯包出品
                      </span>
                    </div>
                  </div>
                )}

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
                    {editing ? <><MdCheck size={13} /> 保存修改</> : <>✏️ 编辑文案</>}
                  </button>
                )}

                {/* 复制 */}
                <button style={{ ...S.actionBtn, background: copied ? '#e8f5e9' : '#f5f5f5', color: copied ? '#2e7d32' : '#333' }} onClick={copyAll}>
                  {copied ? <><MdCheck size={13} /> 已复制</> : <><MdContentCopy size={13} /> 复制全文</>}
                </button>
                {textRegen && !editing && (
                  <button style={S.actionBtn} onClick={() => {
                    if (item._galleryItem) { alert('这是薯包出品的展示内容，请先自己生成作品后再使用此功能'); return; }
                    textRegen();
                  }}>
                    <MdRefresh size={13} /> 重新生成
                  </button>
                )}
                {!editing && (
                  isPreview || isTrialLocked ? (
                    <button style={{ ...S.actionBtn, background: 'var(--red, #FF4757)', color: '#fff', boxShadow: '0 2px 8px rgba(255,71,87,0.25)' }}
                      onClick={() => { if (onUnlock) onUnlock(); }}>
                      🔓 解锁完整图文
                    </button>
                  ) : (
                    <button style={S.actionBtn} onClick={handleExport}>
                      {exporting ? <><MdAutorenew size={13} className="animate-spin" /> 打包中...</> : <><MdDownload size={13} /> 导出图文</>}
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
  body: { fontSize: 14.5, lineHeight: 1.85, color: '#444', marginBottom: 14, whiteSpace: 'pre-wrap' },
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
