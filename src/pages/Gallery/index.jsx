import React, { useState } from 'react';
import { MdAutoAwesome, MdVisibility } from 'react-icons/md';
import { useApp } from '../../store/AppContext';
import { GALLERY } from '../../constants/data';
import { proxyImg } from '../../services/api';
import Footer from '../../components/layout/Footer';

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
          fontSize: 'var(--text-3xl)', fontWeight: 'var(--weight-heavy)',
          textAlign: 'center', margin: '0 0 6px', letterSpacing: '1px',
        }}>
          薯包出品
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-hint)', textAlign: 'center', margin: '0 0 36px' }}>
          以下内容全部由薯包AI一键生成，点击任意作品查看完整图文
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22,
        }}>
          {GALLERY.map(g => (
            <GCard key={g.id} item={g} onClick={() => viewItem(g)}
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

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: 'relative', aspectRatio: '3/4', borderRadius: 'var(--radius-lg)',
        overflow: 'hidden', cursor: 'pointer',
        background: item.grad || 'var(--border-light)',
        boxShadow: 'var(--shadow-md)',
        transition: 'all var(--duration-normal)',
        transform: h ? 'translateY(-4px)' : 'none',
      }}
    >
      {item.cover_url && !imgErr && (
        <img src={proxyImg(item.cover_url)} alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setImgErr(true)} />
      )}

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '40%',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.5))', pointerEvents: 'none',
      }} />

      {/* Category */}
      <span style={{
        position: 'absolute', top: 10, left: 10, zIndex: 2,
        fontSize: 'var(--text-xs)', background: 'rgba(0,0,0,0.45)', color: '#fff',
        padding: '3px 10px', borderRadius: 'var(--radius-md)',
        backdropFilter: 'blur(4px)', fontWeight: 'var(--weight-semibold)',
      }}>
        {item.cat}
      </span>

      {/* Title */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12, right: 12, zIndex: 2,
        fontSize: 13, fontWeight: 'var(--weight-bold)', color: '#fff',
        lineHeight: 1.5, textShadow: '0 1px 4px rgba(0,0,0,0.4)',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>
        {item.title}
      </div>

      {/* Hover overlay */}
      {h && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 3,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10,
        }} className="animate-fade-in">
          <span style={{
            background: 'rgba(255,255,255,0.95)', color: 'var(--red)',
            fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
            padding: '8px 18px', borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: 'var(--shadow-md)',
          }} onClick={(e) => { e.stopPropagation(); onClick(); }}>
            <MdVisibility size={13} /> 查看全套内容
          </span>
          <span style={{
            background: 'var(--red)', color: '#fff',
            fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
            padding: '8px 18px', borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', gap: 5,
            boxShadow: 'var(--shadow-md)',
          }} onClick={(e) => { e.stopPropagation(); onSameStyle?.(); }}>
            <MdAutoAwesome size={13} /> 一键同款
          </span>
        </div>
      )}
    </div>
  );
}
