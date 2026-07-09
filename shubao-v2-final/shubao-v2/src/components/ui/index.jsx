import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import Button from './Button';

/* ═══════ Card ═══════ */
export function Card({ children, style = {}, hover, onClick }) {
  const [h, setH] = useState(false);
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        transition: `all var(--duration-normal) var(--ease)`,
        transform: h && hover ? 'translateY(-3px)' : 'none',
        boxShadow: h && hover ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
        cursor: hover ? 'pointer' : 'default',
        ...style,
      }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
    >
      {children}
    </div>
  );
}

/* ═══════ Modal ═══════ */
export function Modal({ children, onClose, width = 420 }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
      }}
      className="animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="animate-scale-in"
        style={{
          background: '#fff', borderRadius: 'var(--radius-xl)',
          padding: '32px 28px', width, maxWidth: '92vw',
          maxHeight: '90vh', overflow: 'auto',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ═══════ CopyButton ═══════ */
export function CopyButton({ text, label = '复制' }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      small
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      style={{
        color: ok ? 'var(--green)' : '#aaa',
        background: ok ? 'var(--green-bg)' : '#f8f8f8',
        border: 'none',
      }}
    >
      {ok ? <><Check size={12} /> 已复制</> : <><Copy size={12} /> {label}</>}
    </Button>
  );
}

/* ═══════ CharacterImage ═══════ */
export function CharImg({ src, alt = '', size = 120, float, style = {} }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      filter: 'drop-shadow(0 4px 12px rgba(255,71,87,0.12))',
      lineHeight: 0,
    }}>
      <img
        src={src}
        alt={alt}
        className={float ? 'animate-float' : ''}
        style={{
          height: size, display: 'block', maxWidth: '100%', objectFit: 'contain',
          ...style,
        }}
      />
    </div>
  );
}

/* ═══════ Tag (pill) ═══════ */
export function Tag({ children, active, onClick, style = {} }) {
  const [h, setH] = useState(false);
  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '5px 14px',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-sm)',
        fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-normal)',
        background: active ? 'var(--red)' : (h ? '#f0f0f0' : 'var(--border-light)'),
        color: active ? '#fff' : 'var(--text-secondary)',
        cursor: onClick ? 'pointer' : 'default',
        transition: `all var(--duration-fast) var(--ease)`,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ═══════ Spinner ═══════ */
export function Spinner({ size = 20, color = 'var(--red)' }) {
  return (
    <div style={{
      width: size, height: size,
      border: `3px solid var(--border)`,
      borderTopColor: color,
      borderRadius: '50%',
    }} className="animate-spin" />
  );
}

/* ═══════ Empty State ═══════ */
export function EmptyState({ image, title, desc, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px' }}>
      {image && <CharImg src={image} size={100} />}
      {title && <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', marginTop: 16, color: 'var(--text-primary)' }}>{title}</div>}
      {desc && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-hint)', marginTop: 6 }}>{desc}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
