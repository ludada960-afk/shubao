import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MdArrowForward, MdAutoAwesome, MdEdit, MdPalette, MdShoppingCart } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import { GALLERY } from '../../constants/data';
import ResponsiveImage from '../../components/ResponsiveImage.jsx';
import { predecodeResponsiveImage } from '../../components/responsiveImageModel.js';
import { buildGalleryRemixCheckpoint } from './galleryRemixModel.js';
import { PRODUCTION_CASE_CATALOG } from './productionCaseCatalog.js';
import { productionGalleryItems, stableGalleryItems } from './galleryModel.js';

const INITIAL_VISIBLE = 16;
const PAGE_SIZE = 12;

function galleryType(item) {
  if (item?.type === 'ecommerce') return 'ecommerce';
  if (item?.type === 'visual' || item?.workType === 'visual' || item?.visualSkillId) return 'visual';
  return 'xiaohongshu';
}

function galleryTypeLabel(type, item) {
  if (type === 'ecommerce') return '电商套图';
  if (type === 'visual') {
    const labels = { free: '自由创作', poster: '海报设计', 'social-cover': '社媒封面', 'brand-kv': '品牌主视觉', anything_tryon: '万物上身' };
    return labels[item.visualSkillId] || labels[item.skillId] || '视觉案例';
  }
  return '小红书图文';
}

function galleryTypeIcon(type) {
  if (type === 'ecommerce') return <MdShoppingCart size={13} />;
  if (type === 'visual') return <MdPalette size={13} />;
  return <MdEdit size={13} />;
}

function itemRatio(item) {
  if (item?.ratio) return item.ratio;
  const first = item?.images?.[0];
  if (first?.width && first?.height) return `${first.width}:${first.height}`;
  return '3:4';
}

function TryOnWorkflowCard({ item, priority }) {
  const assets = (item.assets || item.images || []).filter(asset => asset?.url || asset?.src);
  const product = assets.find(asset => asset.role === 'source') || assets[0];
  const model = assets.find(asset => asset.role === 'reference') || assets[1];
  const result = assets.find(asset => asset.role === 'result') || assets.at(-1);
  const cards = [product, model, result].filter(Boolean);
  return <div className="gallery-tryon-flow" aria-hidden="true">
    {cards.map((asset, assetIndex) => <React.Fragment key={asset.id || asset.url || assetIndex}>
      {assetIndex > 0 && <span className={`gallery-tryon-symbol symbol-${assetIndex}`}>{assetIndex === 1 ? '+' : '→'}</span>}
      <ResponsiveImage src={asset.url || asset.src} alt="" variant="thumb" ratio={asset.ratio || '3:4'} priority={priority}
        sizes="(min-width:1280px) 10vw, 18vw" className={`gallery-tryon-card role-${asset.role || assetIndex}`}
        imgStyle={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </React.Fragment>)}
  </div>;
}

export default function GallerySection({ maxItems = 200, showHeader = true, onUseSameStyle }) {
  const { state, dispatch } = useApp();
  const [ecommerceCases, setEcommerceCases] = useState(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const loadMoreRef = useRef(null);

  useEffect(() => {
    let active = true;
    fetch('/gallery/ecommerce/cases.json')
      .then(response => response.ok ? response.json() : [])
      .then(items => { if (active && Array.isArray(items)) setEcommerceCases(items); })
      .catch(() => { if (active) setEcommerceCases([]); });
    return () => { active = false; };
  }, []);

  const visualWorks = useMemo(() => (Array.isArray(state.works) ? state.works : [])
    .filter(work => work?.workType === 'visual' || work?.visualSkillId)
    .map(work => ({
      ...work,
      id: work.id || work._saveKey || work.taskId,
      type: 'visual',
      title: work.title || work.product_name || '自由创作案例',
      prompt: work.prompt || work.replay?.prompt || '',
      cover_url: work.cover_url || work.images?.[0]?.url || work.imageRecords?.[0]?.url || '',
      image_urls: (work.images || work.imageRecords || []).map(image => typeof image === 'string' ? image : image?.url).filter(Boolean),
    })), [state.works]);

  const galleryItems = useMemo(() => stableGalleryItems([
    ecommerceCases || [],
    GALLERY,
    productionGalleryItems(PRODUCTION_CASE_CATALOG),
    visualWorks,
  ]), [ecommerceCases, visualWorks]);

  const itemLimit = Math.min(maxItems, galleryItems.length);
  const visibleItems = galleryItems.slice(0, Math.min(visibleCount, itemLimit));
  const hasMore = visibleItems.length < itemLimit;

  useEffect(() => {
    if (!hasMore || !loadMoreRef.current || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setVisibleCount(current => Math.min(current + PAGE_SIZE, itemLimit));
    }, { rootMargin: '640px 0px' });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, itemLimit]);

  const openItem = item => {
    const type = galleryType(item);
    const promptText = item.prompt || item.replay?.prompt || item.replay?.originalPrompt || '';
    dispatch({ type: 'VIEW_GALLERY_ITEM', item: {
      ...item,
      body_text: item.body_text || item.body || promptText,
      hashtags: item.hashtags || item.tags || [],
      category: item.category || item.cat || '',
      _inputText: item.hint || promptText,
      _galleryItem: true,
      _galleryType: type,
      _ecResult: type === 'ecommerce',
    } });
  };

  const useSameStyle = (event, item) => {
    event.stopPropagation();
    onUseSameStyle?.(buildGalleryRemixCheckpoint(item));
  };

  return (
    <section className="gallery-section">
      {showHeader && <div className="gallery-heading"><div><div className="gallery-eyebrow">精选案例</div><h2>灵感发现</h2></div><span>{ecommerceCases === null ? '正在载入案例' : `${galleryItems.length} 个案例`}</span></div>}
      {ecommerceCases === null ? <div className="gallery-masonry gallery-masonry-skeleton" aria-label="正在载入案例">
        {Array.from({ length: INITIAL_VISIBLE }, (_, index) => <div key={index} className="gallery-card gallery-card-skeleton" style={{ aspectRatio: index % 4 === 1 ? '4 / 3' : index % 4 === 2 ? '1 / 1' : '3 / 4' }} />)}
      </div> : <div className="gallery-masonry">
        {visibleItems.map((item, index) => {
          const type = galleryType(item);
          const ratio = itemRatio(item);
          const priority = index < 8;
          return (
            <article key={`${type}-${item.id}`} className="gallery-card" onMouseEnter={() => { void predecodeResponsiveImage(item.cover_url, 'display').catch(() => {}); }}>
              <button type="button" className="gallery-card-preview" aria-label={`查看案例：${item.title}`} onClick={() => openItem(item)} onFocus={() => { void predecodeResponsiveImage(item.cover_url, 'display').catch(() => {}); }}>
                {item.intent === 'anything_tryon'
                  ? <TryOnWorkflowCard item={item} priority={priority} />
                  : item.cover_url ? <ResponsiveImage src={item.cover_url} alt={item.title} variant="thumb" ratio={ratio} priority={priority} sizes="(min-width: 1280px) 25vw, (min-width: 768px) 34vw, 50vw" className="gallery-img-scale" style={{ width: '100%' }} imgStyle={{ height: '100%', objectFit: 'contain' }} /> : <span className="gallery-card-placeholder">{item.title}</span>}
              </button>
              <div className="gallery-card-overlay" aria-hidden="true">
                <span className="gallery-card-badge">{galleryTypeIcon(type)}{galleryTypeLabel(type, item)}</span>
                <button className="gallery-card-remix" type="button" onClick={event => useSameStyle(event, item)}><MdAutoAwesome size={15} /> 做同款 <MdArrowForward size={14} /></button>
              </div>
            </article>
          );
        })}
      </div>}
      {hasMore && <div ref={loadMoreRef} className="gallery-load-more" aria-live="polite">继续探索更多案例</div>}
      <style>{`
        .gallery-section{margin:60px auto 0;max-width:var(--max-width-gallery);padding-inline:20px}.gallery-heading{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:20px}.gallery-heading h2{margin:0;font-size:28px;font-weight:900;color:var(--accent);line-height:1.1;letter-spacing:0}.gallery-heading>span{font-size:13px;font-weight:600;color:var(--text-muted)}.gallery-eyebrow{margin-bottom:4px;color:#c9482b;font-size:13px;font-weight:900}.gallery-masonry{column-count:2;column-gap:12px}.gallery-card{position:relative;break-inside:avoid;margin:0 0 12px;overflow:hidden;border:1px solid rgba(30,31,35,.08);border-radius:8px;background:#f3f4f6;box-shadow:0 4px 16px rgba(24,24,27,.05);transition:transform .28s ease,box-shadow .28s ease}.gallery-card:hover,.gallery-card:focus-within{transform:translateY(-4px);box-shadow:0 18px 42px rgba(24,24,27,.15)}.gallery-card-preview{position:relative;display:block;width:100%;overflow:hidden;padding:0;border:0;background:#f3f4f6;color:inherit;cursor:pointer;text-align:left;line-height:0}.gallery-img-scale img{transform:scale(1);transition:transform .45s ease}.gallery-card:hover .gallery-img-scale img,.gallery-card:focus-within .gallery-img-scale img{transform:scale(1.025)}.gallery-card-overlay{position:absolute;inset:0;z-index:2;opacity:0;background:linear-gradient(180deg,rgba(10,10,12,.3),transparent 32%,transparent 55%,rgba(10,10,12,.5));pointer-events:none;transition:opacity .2s ease}.gallery-card:hover .gallery-card-overlay,.gallery-card:focus-within .gallery-card-overlay{opacity:1}.gallery-card-badge{position:absolute;top:10px;left:10px;display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border:1px solid rgba(255,255,255,.4);border-radius:7px;background:rgba(20,20,24,.58);color:#fff;font-size:11px;font-weight:800;line-height:1;backdrop-filter:blur(10px)}.gallery-card-remix{position:absolute;right:12px;bottom:12px;display:flex;align-items:center;justify-content:center;gap:7px;min-height:40px;padding:0 18px;border:0;border-radius:10px;background:rgba(255,255,255,.96);box-shadow:0 6px 22px rgba(0,0,0,.22);color:#1a1a1e;font:800 13px/1 inherit;cursor:pointer;pointer-events:auto;transform:translateY(8px);transition:background .18s,color .18s,transform .2s ease}.gallery-card:hover .gallery-card-remix,.gallery-card:focus-within .gallery-card-remix{transform:translateY(0)}.gallery-card-remix:hover,.gallery-card-remix:focus-visible{background:#c9482b;color:#fff}.gallery-card-placeholder{display:flex;width:100%;aspect-ratio:3/4;align-items:center;justify-content:center;padding:16px;color:var(--text-muted);font-size:14px;font-weight:700;text-align:center}.gallery-load-more{min-height:42px;padding:18px;color:var(--text-muted);font-size:12px;text-align:center}@media(min-width:768px){.gallery-masonry{column-count:3}}@media(min-width:1280px){.gallery-masonry{column-count:4}}@media(max-width:520px){.gallery-section{padding-inline:12px}.gallery-card-badge{top:8px;left:8px}.gallery-card-remix{right:8px;bottom:8px;min-height:38px}}@media(hover:none){.gallery-card-overlay{opacity:1;background:linear-gradient(180deg,rgba(10,10,12,.16),transparent 28%,transparent 72%,rgba(10,10,12,.36))}.gallery-card-remix{transform:none}}@media(prefers-reduced-motion:reduce){.gallery-card,.gallery-img-scale img,.gallery-card-overlay,.gallery-card-remix{transition:none}}
        .gallery-card-skeleton{min-height:180px;border-color:rgba(30,31,35,.05);background:#eceef1;animation:gallerySkeleton 1.2s ease-in-out infinite alternate}@keyframes gallerySkeleton{to{background:#f7f7f8}}
        .gallery-tryon-flow{display:flex;width:100%;aspect-ratio:4/3;align-items:center;justify-content:center;gap:5px;padding:14px 9px;background:linear-gradient(115deg,#fff8ec 0%,#fbf8ff 70%,#f2faf8 100%)}.gallery-tryon-card{height:86%;width:auto;flex:0 1 auto;border:3px solid #fff;border-radius:6px;background:#f7f3ee;box-shadow:0 6px 18px rgba(52,42,36,.13);transform:rotate(-2deg)}.gallery-tryon-card.role-reference{height:80%;transform:rotate(2deg)}.gallery-tryon-card.role-result{height:92%;transform:rotate(1deg)}.gallery-tryon-symbol{display:grid;width:22px;height:22px;flex:0 0 22px;place-items:center;border:1px solid rgba(104,78,201,.16);border-radius:50%;background:rgba(255,255,255,.92);color:#674dc9;font:900 14px/1 inherit;box-shadow:0 4px 12px rgba(76,53,150,.1)}.gallery-card:hover .gallery-tryon-card{transform:translateY(-3px) rotate(-1deg)}.gallery-card:hover .gallery-tryon-card.role-reference{transform:translateY(-3px) rotate(1deg)}.gallery-card:hover .gallery-tryon-card.role-result{transform:translateY(-4px) rotate(0)}
      `}</style>
    </section>
  );
}
