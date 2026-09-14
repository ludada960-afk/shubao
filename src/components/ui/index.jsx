import React, { useState } from 'react';
import { MdContentCopy, MdCheck } from 'react-icons/md';
import Button from './Button';
/* D7 / D9 / D11 的共享实现类（token 只来自 design-tokens-v3.css） */
import '../../styles/surface-batch.css';

/* ═══════ Card ═══════
   D9（docs/design/40-decisions.md）：hover 位移必须由容器预留空间，禁止默认被裁。
   原实现把 overflow:hidden 与 translateY(-3px) 写在**同一个** div 上 ——
   上移 3px 后顶部阴影与圆角一起被自身裁掉，而「一处受害 = 全站受害」。
   修法采用 D9 方案①：**位移容器与裁切容器分离**
     · 外层 .sb-card（位移 / 阴影 / 圆角 / 描边）
     · 内层 .sb-card-clip（overflow:hidden + 继承圆角，只负责裁切内容）
   位移发生在**外层**，裁切发生在**内层**，两者不再互相干涉。
   同时按 D6 圆角 4 档（--sb-radius-xl = 16px 卡片档）、D2 hover 只做底色变化，
   并补 D11 focus-visible。 */
export function Card({ children, style = {}, hover, onClick, className = '' }) {
  const [h, setH] = useState(false);
  const interactive = Boolean(onClick) || Boolean(hover);
  return (
    <div
      className={`sb-card${hover ? ' sb-card--hover' : ''}${className ? ' ' + className : ''}`}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={style}
      {...(interactive ? { role: onClick ? 'button' : undefined, tabIndex: onClick ? 0 : undefined } : {})}
      onKeyDown={onClick ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onClick(event); } } : undefined}
      data-hover={h ? 'true' : undefined}
    >
      <div className="sb-card-clip">{children}</div>
    </div>
  );
}

/* ═══════ Modal ═══════ */
export function Modal({ children, onClose, width = 420 }) {
  /* 原则 4.1：遮罩是可点关闭区，原为 <div onClick> 键盘不可达 → button + .a11y-backdrop
     （仓库既有重置类）。面板只是吞冒泡、不是可点元素 → 删掉重复 onMouseDown，
     改用 event.target === event.currentTarget 判定，去掉嵌套交互元素。 */
  return (
    <button
      type="button"
      aria-label="关闭"
      style={{
        position: 'fixed', inset: 0,
        background: 'var(--sb-scrim)',
        zIndex: 'var(--sb-z-modal)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      className="animate-fade-in a11y-backdrop"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="animate-scale-in"
        style={{
          background: 'var(--sb-neutral-0)', borderRadius: 'var(--radius-xl)',
          padding: '32px 28px', width, maxWidth: '92vw',
          maxHeight: '90vh', overflow: 'auto',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {children}
      </div>
    </button>
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
      {ok ? <><MdCheck size={12} /> 已复制</> : <><MdContentCopy size={12} /> {label}</>}
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
  /* 原则 4.1：可点元素必须键盘可达。
     仅当传了 onClick 时才渲染 <button>（无 onClick 的 Tag 是纯展示徽标，不应进 Tab 序列）。
     两分支除标签/type/重置类外属性完全一致 → 视觉零变化。 */
  const Root = onClick ? 'button' : 'span';
  return (
    <Root
      {...(onClick ? { type: 'button' } : {})}
      className={onClick ? 'a11y-reset' : undefined}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '5px 14px',
        borderRadius: 'var(--radius-full)',
        fontSize: 'var(--text-sm)',
        fontWeight: active ? 'var(--weight-semibold)' : 'var(--weight-normal)',
        background: active ? 'var(--red)' : (h ? 'var(--sb-neutral-100)' : 'var(--border-light)'),
        color: active ? 'var(--sb-neutral-0)' : 'var(--text-secondary)',
        cursor: onClick ? 'pointer' : 'default',
        transition: `all var(--duration-fast) var(--ease)`,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </Root>
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
