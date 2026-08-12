import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MdContentCopy, MdCheck, MdRefresh, MdDownload, MdClose, MdAutorenew, MdArrowBack, MdArrowForward, MdFullscreen, MdGridOn } from 'react-icons/md';
import { proxyImg, regenerateImage, downloadZip } from './services/api';
import { IMAGES } from './constants/images';
import { EC_PLATFORM_SPECS } from './constants/data';
import { useDialog } from './components/ui/DialogProvider.jsx';
import ResponsiveImage from './components/ResponsiveImage.jsx';
import { predecodeResponsiveImage } from './components/responsiveImageModel.js';

function ecommerceGallerySlides(item) {
  const raw = Array.isArray(item?.images) ? item.images : Object.entries(item?.images || {});
  const images = raw.map((image, index) => Array.isArray(image)
    ? { url: image[1], label: image[0] || '商品展示图 ' + (index + 1), description: '展示本套方案中的商品视觉内容' }
    : { url: image.url, label: image.label || image.style || image.role || '商品展示图 ' + (index + 1), description: image.description || image.sellingPoint || image.purpose || '展示本套方案中的商品视觉内容', width: image.width, height: image.height, size: image.size }
  ).filter(image => image.url);
  const cover = item?.cover_mosaic_url || item?.cover_url;
  return [
    ...(cover ? [{ url: cover, label: '套图总览', description: '把主图、场景、卖点与细节集中呈现，便于快速判断整套方案。', isCover: true }] : []),
    ...images.filter(image => image.url !== cover),
  ];
}

function EcommerceGalleryPreview({ item, onClose }) {
  const slides = useMemo(() => ecommerceGallerySlides(item), [item]);
  const [index, setIndex] = useState(0);
  const wheelLockRef = useRef(0);
  const current = slides[index];
  useEffect(() => {
    if (!current?.url) return;
    void predecodeResponsiveImage(current.url, 'display').catch(() => {});
    if (slides[index + 1]?.url) void predecodeResponsiveImage(slides[index + 1].url, 'display').catch(() => {});
  }, [current?.url, index, slides]);
  const handleWheel = event => {
    event.preventDefault(); event.stopPropagation();
    if (Math.abs(event.deltaY) < 8 || Date.now() - wheelLockRef.current < 180) return;
    wheelLockRef.current = Date.now();
    setIndex(value => event.deltaY > 0 ? Math.min(slides.length - 1, value + 1) : Math.max(0, value - 1));
  };
  if (!current) return null;
  const dimensions = current.size || (current.width && current.height ? current.width + ' × ' + current.height : '');
  return <div className="ec-gallery-overlay animate-fade-in" onClick={onClose}>
    <div className="ec-gallery-modal animate-scale-in" onClick={event => event.stopPropagation()} onWheel={handleWheel}>
      <div className="ec-gallery-visual">
        <ResponsiveImage src={current.url} alt={current.label} variant="display" ratio="3:4" priority sizes="min(72vw, 980px)"
          style={{ width: '100%', height: '100%', background: '#f5f5f5' }} imgStyle={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        {index > 0 && <button className="ec-gallery-nav ec-gallery-prev" type="button" aria-label="上一张" onClick={() => setIndex(value => value - 1)}><MdArrowBack size={20} /></button>}
        {index < slides.length - 1 && <button className="ec-gallery-nav ec-gallery-next" type="button" aria-label="下一张" onClick={() => setIndex(value => value + 1)}><MdArrowForward size={20} /></button>}
        <div className="ec-gallery-progress">{index + 1} / {slides.length}</div>
      </div>
      <aside className="ec-gallery-details">
        <button className="ec-gallery-close" type="button" aria-label="关闭" onClick={onClose}><MdClose size={20} /></button>
        <span className="ec-gallery-kind">电商套图案例</span><h2>{item.title || item.product_name || '电商套图'}</h2>
        <div className="ec-gallery-meta">{item.platform || '电商平台'} · {Math.max(0, slides.length - 1)} 张成品图</div>
        <div className="ec-gallery-current"><span>{current.isCover ? '封面' : '第 ' + index + ' 张'}</span><h3>{current.label}</h3><p>{current.description}</p>{dimensions && <small>{dimensions}</small>}</div>
        <div className="ec-gallery-strip" aria-label="套图图片目录">{slides.map((slide, slideIndex) => <button key={slide.url + slideIndex} type="button" className={slideIndex === index ? 'active' : ''} onClick={() => setIndex(slideIndex)} aria-label={'查看' + slide.label}>
          <span>{String(slideIndex + 1).padStart(2, '0')}</span><strong>{slide.label}</strong>
        </button>)}</div><div className="ec-gallery-wheel-hint">滚动鼠标切换图片</div>
      </aside>
    </div>
    <style>{`
      .ec-gallery-overlay{position:fixed;inset:0;z-index:9998;display:grid;place-items:center;padding:24px;background:rgba(18,18,20,.78);overscroll-behavior:none;backdrop-filter:blur(10px)}.ec-gallery-modal{display:grid;width:min(1180px,94vw);height:min(780px,92vh);grid-template-columns:minmax(0,1fr) 340px;overflow:hidden;border:1px solid rgba(255,255,255,.2);border-radius:8px;background:#fff;box-shadow:0 28px 80px rgba(0,0,0,.32)}.ec-gallery-visual{position:relative;min-width:0;overflow:hidden;background:#f1f1f1}.ec-gallery-nav{position:absolute;top:50%;display:grid;width:42px;height:42px;place-items:center;border:0;border-radius:50%;background:rgba(25,25,27,.78);color:#fff;cursor:pointer;transform:translateY(-50%);backdrop-filter:blur(8px)}.ec-gallery-prev{left:16px}.ec-gallery-next{right:16px}.ec-gallery-progress{position:absolute;bottom:16px;left:50%;padding:6px 10px;border-radius:6px;background:rgba(25,25,27,.76);color:#fff;font-size:12px;font-weight:800;transform:translateX(-50%)}.ec-gallery-details{position:relative;display:flex;min-width:0;flex-direction:column;padding:30px 26px 22px;background:#fff}.ec-gallery-close{position:absolute;top:18px;right:18px;display:grid;width:34px;height:34px;place-items:center;border:0;border-radius:50%;background:#f2f2f3;color:#333;cursor:pointer}.ec-gallery-kind{align-self:flex-start;margin-bottom:14px;padding:5px 8px;border-radius:5px;background:#f1edff;color:#6545e7;font-size:11px;font-weight:800}.ec-gallery-details h2{margin:0 40px 7px 0;color:#202124;font-size:21px;line-height:1.35;letter-spacing:0}.ec-gallery-meta{color:#888b92;font-size:12px}.ec-gallery-current{margin-top:28px;padding-top:24px;border-top:1px solid #ececef}.ec-gallery-current>span{color:#7463d9;font-size:11px;font-weight:800}.ec-gallery-current h3{margin:7px 0 8px;color:#25262a;font-size:18px;letter-spacing:0}.ec-gallery-current p{margin:0;color:#656870;font-size:13px;line-height:1.75}.ec-gallery-current small{display:block;margin-top:10px;color:#9a9ca2;font-size:11px}.ec-gallery-strip{display:flex;margin-top:auto;flex-direction:column;gap:5px;max-height:174px;overflow-y:auto;padding:2px}.ec-gallery-strip button{display:flex;align-items:center;gap:8px;min-height:30px;padding:0 8px;border:1px solid transparent;border-radius:5px;background:#f5f5f6;color:#6c6e74;cursor:pointer;text-align:left}.ec-gallery-strip button span{font:700 10px/1 ui-monospace,monospace;color:#a2a3a8}.ec-gallery-strip button strong{overflow:hidden;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.ec-gallery-strip button.active{border-color:#cfc5ff;background:#f1edff;color:#563ee0}.ec-gallery-wheel-hint{margin-top:12px;color:#a1a2a8;font-size:11px;text-align:center}@media(max-width:760px){.ec-gallery-overlay{padding:0}.ec-gallery-modal{width:100vw;height:100dvh;grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto;border:0;border-radius:0}.ec-gallery-details{max-height:36dvh;padding:18px}.ec-gallery-details h2{font-size:17px}.ec-gallery-current{margin-top:12px;padding-top:12px}.ec-gallery-strip{margin-top:14px;flex-direction:row;overflow-x:auto;overflow-y:hidden}.ec-gallery-strip button{max-width:140px;flex:0 0 auto}.ec-gallery-wheel-hint{display:none}}
    `}</style>
  </div>;
}

export default function NoteModal({ item, onClose, textRegen, onDownload, onItemUpdate, onRegenStart, onUnlock, onGallery, onSendToCanvas }) {
  const dialog = useDialog();
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
  const wheelLockRef = useRef(0);

  const imgs = useMemo(() => {
    const a = [];
    if (item?.cover_url) a.push(item.cover_url);
    if (item?.image_urls?.length) item.image_urls.forEach(u => { if (u) a.push(u); });
    return a;
  }, [item]);

  const isPreview = item?._preview || item?.preview;
  const isTrialLocked = item?._trialLocked;
  // 预览模式：只有封面，其余8张用占位
  // 试用模式：全量生成，只展示封面，其余图片模糊水印
  const maxSlots = 9;
  const displayImgs = useMemo(() => (
    isPreview
      ? [...imgs, ...Array(Math.max(0, maxSlots - imgs.length)).fill(null)]
      : imgs
  ), [imgs, isPreview]);

  const bodyText = item?.body_text || '';
  const tagStr = (item?.hashtags || []).join(' ');
  const maxI = displayImgs.length || 1;

  useEffect(() => {
    if (!item) return undefined;
    const root = document.documentElement;
    const body = document.body;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousOverscroll = body.style.overscrollBehavior;
    document.documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    return () => {
      root.style.overflow = previousRootOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousOverscroll;
    };
  }, [item]);

  useEffect(() => {
    if (item?._ecResult || !displayImgs[imgIdx]) return;
    void predecodeResponsiveImage(displayImgs[imgIdx], 'display').catch(() => {});
    const next = displayImgs[imgIdx + 1];
    if (next) void predecodeResponsiveImage(next, 'display').catch(() => {});
  }, [displayImgs, imgIdx, item?._ecResult]);

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
    e.preventDefault();
    e.stopPropagation();
    if (Math.abs(e.deltaY) < 8) return;
    const now = Date.now();
    if (now - wheelLockRef.current < 180) return;
    wheelLockRef.current = now;
    if (e.deltaY > 0 && imgIdx < maxI - 1) setImgIdx(i => i + 1);
    if (e.deltaY < 0 && imgIdx > 0) setImgIdx(i => i - 1);
  };

  // 单图重生成
  const regenSingle = async (i) => {
    if (item?._galleryItem) { await dialog.notice({ title: '请先生成自己的作品', message: '案例用于查看效果，生成自己的作品后即可单独重刷图片。' }); return; }
    if (!await dialog.confirm({ title: '重新生成这张图片？', message: '本次操作会按页面显示的重刷规则扣除额度，其他图片和文案不会改变。', confirmLabel: '确认重刷' })) return;
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
    } catch (e) { await dialog.notice({ title: '图片生成失败', message: e.message || '请稍后重试。' }); }
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
    if (item?._galleryItem) { await dialog.notice({ title: '请先生成自己的作品', message: '案例用于查看效果，生成自己的作品后即可下载。' }); return; }
    setExporting(true);
    try {
      if (typeof onDownload === 'function') await onDownload(item.cover_url, item.image_urls, item.title, item.body_text, item.hashtags);
      else await downloadZip(item.cover_url, item.image_urls, item.title, item.body_text, item.hashtags);
    } catch (e) { /* ignore */ }
    setExporting(false);
  };

  if (!item) return null;

  if (item._galleryItem && item._galleryType === 'ecommerce') {
    return <EcommerceGalleryPreview item={item} onClose={onClose} />;
  }

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
      white_bg:'白底图', main_text:'主图 1:1', main_3x4:'主图 3:4',
      transparent:'透明PNG', sku:'SKU规格图',
      detail_slice_size:'尺寸标注', detail_slice_scene:'场景拍摄',
      detail_slice_qc:'质检报告', detail_slice_compare:'优势对比',
      detail_slice_feature:'细节功能', detail_slice_care:'保养维护',
      // 旧格式兼容
      feature:'卖点解说图', scene:'使用场景图',
      detail:'详情图', macro:'材质特写', comparison:'效果对比',
      package:'包装组合', beauty_report:'美妆分析报告',
      main_white:'白底图', main:'主图',
    };
    const getUrl = (img) => Array.isArray(img) ? img[1] : img.url;
    const getLabel = (img) => {
      const raw = Array.isArray(img) ? img[0] : (img.style || img.label || img.key || '商品图');
      return KEY_LABELS[raw] || raw;
    };
    const getSize = (img) => Array.isArray(img) ? '' : (img.size || '');
    // 从标签查平台规格尺寸（兼容新旧标签名）
    const specKeyMap = { '白底图':'白底主图', '主图文案':'白底主图', '白底首图':'白底主图', '商品主图 1:1':'白底主图' };
    const getSpec = (label, img) => {
      const fromImg = getSize(img);
      if (fromImg) return fromImg;
      return specs.sizes[label] || specs.sizes[specKeyMap[label]] || '';
    };
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
            <ResponsiveImage src={getUrl(images[ecIdx])} alt={getLabel(images[ecIdx])} variant="display" ratio="1:1" priority sizes="90vw"
              style={{ width: '90vw', height: '90vh', background: 'transparent' }} imgStyle={S.zoomImg} />
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
              <span style={{ opacity: 0.7 }}>{getSpec(getLabel(images[ecIdx]), images[ecIdx])}</span>
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
                const size = getSpec(style, img);
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
                      <ResponsiveImage src={url} alt={style} variant="thumb" ratio="1:1" sizes="220px"
                        style={{ width: '100%', height: '100%', background: '#fff' }}
                        imgStyle={{
                          objectFit: 'contain', background: '#fff', transition: 'transform 0.3s',
                          filter: isLocked ? 'blur(12px)' : 'none', opacity: isLocked ? 0.5 : 1,
                        }} />
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
            <ResponsiveImage src={imgs[imgIdx]} alt="" variant="display" ratio="3:4" priority sizes="90vw"
              style={{ width: '90vw', height: '90vh', background: 'transparent' }} imgStyle={S.zoomImg} />
            {imgIdx < maxI - 1 && (
              <button style={{ ...S.zoomNav, right: 12 }} onClick={(e) => { e.stopPropagation(); setImgIdx(i => Math.min(maxI - 1, i + 1)); }}>
                <MdArrowForward size={18} />
              </button>
            )}
            <div style={S.zoomCounter}>{imgIdx + 1}/{maxI} · ← → 切换 · ESC 关闭</div>
          </div>
        )}

        {/* ── 主弹窗 ── */}
        <div style={S.modal} onClick={e => e.stopPropagation()} className="animate-scale-in note-modal">
          <div style={S.main} className="note-modal-main">

            {/* LEFT: 图片区 */}
            <div style={S.imagePanel} className="note-modal-images">
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
                      <ResponsiveImage src={displayImgs[imgIdx]} alt="" variant="display" ratio="3:4" priority sizes="min(58vw, 920px)"
                        style={{ width: '100%', height: '100%', background: 'transparent' }}
                        imgStyle={{ maxWidth: '100%', maxHeight: 'calc(90vh - 90px)', objectFit: 'contain', filter: 'blur(16px)', opacity: 0.5, transform: 'scale(1.1)' }} />
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
                    <ResponsiveImage src={displayImgs[imgIdx]} alt="" variant="display" ratio="3:4" priority sizes="min(58vw, 920px)"
                      style={{ width: '100%', height: '100%', background: 'transparent', cursor: 'zoom-in' }} imgStyle={S.mainImg} onClick={() => setZoom(true)} />
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
                        <ResponsiveImage src={url} alt="" variant="thumb" ratio="3:4" sizes="56px"
                          style={{ width: '100%', height: '100%', background: 'transparent' }}
                          imgStyle={{
                            ...S.thumbImg,
                            filter: isTrialLocked && i > 0 ? 'blur(4px)' : 'none',
                            opacity: isTrialLocked && i > 0 ? 0.5 : 1,
                          }} />
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
            <div style={S.textPanel} className="note-modal-text">
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
              <div style={S.actionBar} className="note-modal-actions">
                {/* 编辑/保存 */}
                {!item._galleryItem && (
                  <button style={{ ...S.actionBtn, background: editing ? '#e3f2fd' : '#f5f5f5', color: editing ? '#1565c0' : '#333' }}
                    onClick={() => {
                      if (editing) {
                        // 保存编辑 — 通过 onItemUpdate 回调更新父组件状态，不直接修改 props
                        if (typeof onItemUpdate === 'function') {
                          onItemUpdate(0, editTitle); // 复用现有回调传递标题
                        }
                        // 使用浅拷贝创建新对象，避免直接修改 props 引用
                        const updatedItem = { ...item, title: editTitle, body_text: editBody, hashtags: editTags.split(/\s+/).filter(Boolean) };
// C6: 不再直接修改 props，完全依赖父组件回调更新全局状态
// 如果 onItemUpdate 不存在，仅退出编辑模式（本地 editTitle 等已保留）
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
                {!editing && !isPreview && !isTrialLocked && !item._galleryItem && onSendToCanvas && (
                  <button style={{ ...S.actionBtn, background: '#111827', color: '#fff' }} onClick={() => onSendToCanvas(item)}>
                    <MdGridOn size={13} /> 送入画板二创
                  </button>
                )}
                {textRegen && !editing && (
                  <button style={S.actionBtn} onClick={async () => {
                    if (item._galleryItem) { await dialog.notice({ title: '请先生成自己的作品', message: '案例用于查看效果，生成自己的作品后即可重新编辑文案。' }); return; }
                    await textRegen();
                  }}>
                    <MdRefresh size={13} /> 重新生成 · 0.2 AI 积分
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
