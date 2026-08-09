import React, { useEffect, useMemo, useState } from 'react';
import { MdArrowForward, MdAutoAwesome, MdEdit, MdShoppingCart } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import { GALLERY } from '../../constants/data';
import ResponsiveImage from '../../components/ResponsiveImage.jsx';
import { predecodeResponsiveImage } from '../../components/responsiveImageModel.js';
import { buildGalleryRemixCheckpoint } from './galleryRemixModel.js';

function galleryType(item) { return item?.type === 'ecommerce' ? 'ecommerce' : 'xiaohongshu'; }
function galleryCount(item) {
  if (galleryType(item) === 'ecommerce') return Array.isArray(item.images) ? item.images.length : 0;
  return (item.cover_url ? 1 : 0) + (Array.isArray(item.image_urls) ? item.image_urls.length : 0);
}

export default function GallerySection({ maxItems = 24, showHeader = true, onUseSameStyle }) {
  const { dispatch } = useApp();
  const [ecommerceCases, setEcommerceCases] = useState([]);
  useEffect(() => {
    let active = true;
    fetch('/gallery/ecommerce/cases.json').then(response => response.ok ? response.json() : [])
      .then(items => { if (active && Array.isArray(items)) setEcommerceCases(items); }).catch(() => {});
    return () => { active = false; };
  }, []);
  const galleryItems = useMemo(() => [...ecommerceCases, ...GALLERY], [ecommerceCases]);
  const openItem = item => {
    const type = galleryType(item);
    dispatch({ type: 'VIEW_GALLERY_ITEM', item: {
      ...item,
      body_text: item.body_text || item.body || '', hashtags: item.hashtags || item.tags || [],
      category: item.category || item.cat || '', _inputText: item.hint || '', _galleryItem: true,
      _galleryType: type, _ecResult: type === 'ecommerce',
    } });
  };
  const useSameStyle = (event, item) => {
    event.stopPropagation();
    onUseSameStyle?.(buildGalleryRemixCheckpoint(item));
  };
  return (
    <section className="gallery-section">
      {showHeader && <div className="gallery-heading"><div><div className="gallery-eyebrow">精选案例</div><h2>灵感发现</h2></div><span>{galleryItems.length} 个案例</span></div>}
      <div className="gallery-masonry">
        {galleryItems.slice(0, maxItems).map(item => {
          const type = galleryType(item);
          return <article key={type + '-' + item.id} className="gallery-card"
            onMouseEnter={() => { void predecodeResponsiveImage(item.cover_url, 'display').catch(() => {}); }}>
            <button type="button" className="gallery-card-preview" aria-label={'查看案例：' + item.title}
              onClick={() => openItem(item)}
              onFocus={() => { void predecodeResponsiveImage(item.cover_url, 'display').catch(() => {}); }}>
              {item.cover_url ? <ResponsiveImage src={item.cover_url} alt={item.title} variant="thumb" ratio="3:4"
                sizes="(min-width: 1280px) 25vw, (min-width: 768px) 34vw, 50vw" className="gallery-img-scale"
                style={{ width: '100%' }} imgStyle={{ height: 'auto', objectFit: 'cover' }} />
                : <span className="gallery-card-placeholder">{item.title}</span>}
            </button>
            <div className="gallery-card-overlay">
              <span className="gallery-card-badge">{type === 'ecommerce' ? <MdShoppingCart size={13} /> : <MdEdit size={13} />}{type === 'ecommerce' ? '电商套图' : '小红书图文'}</span>
              <div className="gallery-card-copy">
                <strong>{item.title}</strong>
                <span>{galleryCount(item)} 张 · {item.category || item.cat || '精选案例'}</span>
              </div>
              <button className="gallery-card-remix" type="button" onClick={event => useSameStyle(event, item)}><MdAutoAwesome size={15} /> 做同款 <MdArrowForward size={14} /></button>
            </div>
          </article>;
        })}
      </div>
      <style>{`
        .gallery-section{margin:60px auto 0;max-width:var(--max-width-gallery);padding-inline:20px}.gallery-heading{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px}.gallery-heading h2{margin:0;font-size:28px;font-weight:900;color:var(--accent);line-height:1.1;letter-spacing:0}.gallery-heading>span{font-size:13px;font-weight:600;color:var(--text-muted)}.gallery-eyebrow{margin-bottom:4px;color:#c9482b;font-size:13px;font-weight:900;letter-spacing:0}.gallery-masonry{column-count:2;column-gap:12px}.gallery-card{position:relative;break-inside:avoid;margin-bottom:12px;overflow:hidden;border:1px solid rgba(30,31,35,.08);border-radius:8px;background:#f3f4f6;box-shadow:0 4px 16px rgba(24,24,27,.06);transition:transform .28s ease,box-shadow .28s ease}.gallery-card:hover{transform:translateY(-4px);box-shadow:0 14px 34px rgba(24,24,27,.14)}.gallery-card-preview{position:relative;display:block;width:100%;overflow:hidden;padding:0;border:0;background:#f3f4f6;color:inherit;cursor:pointer;text-align:left;line-height:0}.gallery-img-scale img{transform:scale(1);transition:transform .48s cubic-bezier(.2,.75,.2,1)}.gallery-card:hover .gallery-img-scale img,.gallery-card:focus-within .gallery-img-scale img{transform:scale(1.09)}.gallery-card-overlay{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;justify-content:flex-end;padding:12px;opacity:0;background:linear-gradient(to bottom,rgba(12,13,16,.08) 20%,rgba(12,13,16,.08) 48%,rgba(12,13,16,.82) 100%);pointer-events:none;transition:opacity .24s ease}.gallery-card:hover .gallery-card-overlay,.gallery-card:focus-within .gallery-card-overlay{opacity:1}.gallery-card-badge{position:absolute;top:10px;left:10px;display:inline-flex;align-items:center;gap:5px;padding:6px 8px;border-radius:6px;background:rgba(255,255,255,.92);box-shadow:0 3px 12px rgba(0,0,0,.12);color:#26272b;font-size:11px;font-weight:800;line-height:1;backdrop-filter:blur(10px)}.gallery-card-copy{display:flex;min-width:0;flex-direction:column;gap:4px;padding-right:96px;color:#fff;text-shadow:0 1px 5px rgba(0,0,0,.45)}.gallery-card-copy strong{display:-webkit-box;overflow:hidden;font-size:13px;font-weight:800;line-height:1.35;letter-spacing:0;-webkit-line-clamp:2;-webkit-box-orient:vertical}.gallery-card-copy span{overflow:hidden;font-size:10px;font-weight:600;line-height:1.3;text-overflow:ellipsis;white-space:nowrap;opacity:.78}.gallery-card-remix{position:absolute;right:10px;bottom:11px;display:inline-flex;align-items:center;gap:4px;min-height:32px;padding:0 10px;border:1px solid rgba(255,255,255,.7);border-radius:6px;background:rgba(255,255,255,.94);box-shadow:0 5px 18px rgba(0,0,0,.18);color:#29272f;font:800 11px/1 inherit;cursor:pointer;pointer-events:auto;transition:background .18s,color .18s,transform .18s}.gallery-card-remix:hover,.gallery-card-remix:focus-visible{background:#27272a;color:#fff;transform:translateY(-1px)}.gallery-card-placeholder{display:flex;width:100%;aspect-ratio:3/4;align-items:center;justify-content:center;padding:16px;color:var(--text-muted);font-size:14px;font-weight:700;line-height:1.4;text-align:center}@media(min-width:768px){.gallery-masonry{column-count:3}}@media(min-width:1280px){.gallery-masonry{column-count:4}}@media(max-width:520px){.gallery-section{padding-inline:12px}.gallery-card-overlay{padding:9px}.gallery-card-copy{padding-right:0;padding-bottom:40px}}@media(prefers-reduced-motion:reduce){.gallery-card,.gallery-img-scale img,.gallery-card-overlay,.gallery-card-remix{transition:none}}
      `}</style>
    </section>
  );
}
