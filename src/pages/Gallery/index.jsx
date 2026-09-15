import React, { useState } from 'react';
import { MdAutoAwesome, MdVisibility } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import { GALLERY } from '../../constants/data';
import Footer from '../../components/layout/Footer';
import ResponsiveImage from '../../components/ResponsiveImage.jsx';

export default function GalleryPage() {
  const { dispatch } = useApp();

  const viewItem = (g) => {
    if (!g.cover_url) return;
    dispatch({
      type: 'SET_RESULT',
      result: {
        ...g, body_text: g.body, hashtags: g.tags,
        category: g.cat, _inputText: g.hint, _galleryItem: true,
      },
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 'var(--max-width)', margin: '0 auto', padding: '48px 28px' }}>
        <h1 style={{
          fontSize: 'var(--text-3xl)', fontWeight: 'var(--sb-weight-heavy)',
          textAlign: 'center', margin: '0 0 6px', letterSpacing: '1px',
        }}>
          薯包出品
        </h1>
        <p style={{ fontSize: 'var(--sb-text-md)', color: 'var(--sb-ink-4)', textAlign: 'center', margin: '0 0 36px' }}>
          以下内容全部由薯包AI一键生成，点击任意作品查看完整图文
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22,
        }}>
          {GALLERY.map(g => (
            <GCard key={g.id} data-gallery-card={g.id} item={g} onClick={() => viewItem(g)}
              onSameStyle={() => {
                dispatch({ type: 'SET_INPUT', text: g.hint || g.title });
                dispatch({ type: 'NAVIGATE', page: 'home' });
                window.scrollTo(0, 0);
              }}
            />
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
}

function GCard({ item, onClick, onSameStyle }) {
  const [h, setH] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  /* 原则 4.1：可点卡片必须键盘可达。
     此处**不能用 <button>**：卡片内含「查看全套内容 / 一键同款」两个独立动作按钮，
     HTML 禁止嵌套交互元素（button 嵌 button 属非法结构，会破坏两层语义与焦点行为）。
     采用规范允许的替代：role="button" + tabIndex + onKeyDown（Enter/Space 均可触发），
     已登记进 test/fixtures/clickable-div-whitelist.json。
     类名与内联 style 不动 → 视觉零变化。 */
  const handleCardKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    // 焦点在内层动作按钮上时由它们自行处理，不重复触发卡片
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    onClick?.();
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`查看作品：${item.title || item.cat || ''}`}
      onKeyDown={handleCardKeyDown}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: 'relative', aspectRatio: '3/4', borderRadius: 'var(--radius-lg)',
        overflow: 'hidden', cursor: 'pointer',
        background: item.grad || 'var(--sb-border-subtle)',
        boxShadow: 'var(--sb-shadow-md)',
        transition: 'all var(--sb-dur-normal)',
        transform: h ? 'translateY(-4px)' : 'none',
      }}
    >
      {item.cover_url && !imgErr && (
        <ResponsiveImage src={item.cover_url} alt="" variant="thumb" ratio="3:4"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          imgStyle={{ objectFit: 'cover' }} onError={() => setImgErr(true)} />
      )}

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
        background: 'linear-gradient(transparent, rgba(12,10,9,0.5))', pointerEvents: 'none',
      }} />

      {/* Category */}
      <span style={{
        position: 'absolute', top: 10, left: 10, zIndex: 2,
        fontSize: 'var(--sb-text-xs)', background: 'rgba(12,10,9,0.72)', color: 'var(--sb-neutral-0)',
        padding: '3px 10px', borderRadius: 'var(--sb-radius-xl)',
        fontWeight: 'var(--sb-weight-semibold)',
      }}>
        {item.cat}
      </span>

      {/* Title */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 2,
        fontSize: 13, fontWeight: 'var(--sb-weight-bold)', color: 'var(--sb-neutral-0)',
        lineHeight: 1.5, textShadow: '0 1px 4px rgba(12,10,9,0.4)',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {item.title}
      </div>

      {/* Hover overlay */}
      {h && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(12,10,9,0.4)', zIndex: 3,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 'var(--sb-space-2-5)',
        }} className="animate-fade-in">
          <button type="button" className="a11y-reset" style={{
            background: 'rgba(255,255,255,0.95)', color: 'var(--sb-danger)',
            fontSize: 'var(--sb-text-md)', fontWeight: 'var(--sb-weight-semibold)',
            padding: '8px 18px', borderRadius: 'var(--sb-radius-xl)',
            display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: 'var(--sb-shadow-md)',
          }} onClick={(e) => { e.stopPropagation(); onClick(); }}>
            <MdVisibility size={13} /> 查看全套内容
          </button>
          <button type="button" className="a11y-reset" style={{
            background: 'var(--sb-danger)', color: 'var(--sb-neutral-0)',
            fontSize: 'var(--sb-text-md)', fontWeight: 'var(--sb-weight-semibold)',
            padding: '8px 18px', borderRadius: 'var(--sb-radius-xl)',
            display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: 'var(--sb-shadow-md)',
          }} onClick={(e) => { e.stopPropagation(); onSameStyle?.(); }}>
            <MdAutoAwesome size={13} /> 一键同款
          </button>
        </div>
      )}
    </div>
  );
}
