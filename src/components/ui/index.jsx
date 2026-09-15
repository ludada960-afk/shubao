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
          background: 'var(--sb-neutral-0)',
          /* D29（结清 D24 第 3 条）：弹窗主体按 D18 角色表归到 --sb-radius-2xl(20px)，
             原 V2 --radius-xl = 40px。**这是有意观感变更**（Δ−20px），依据是角色而非数值最近。 */
          borderRadius: 'var(--sb-radius-2xl)',
          padding: '32px 28px', width, maxWidth: '92vw',
          maxHeight: '90vh', overflow: 'auto',
          boxShadow: 'var(--sb-shadow-xl)',
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
        color: ok ? 'var(--sb-success)' : 'var(--sb-ink-4)',
        background: ok ? 'var(--sb-success-soft)' : 'var(--sb-hover-bg)',
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
      filter: 'drop-shadow(0 4px 12px var(--sb-danger-shadow-color))',
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
        borderRadius: 'var(--sb-radius-pill)',
        fontSize: 'var(--sb-text-md)',
        fontWeight: active ? 'var(--sb-weight-semibold)' : 'var(--sb-weight-regular)',
        background: active ? 'var(--sb-danger)' : (h ? 'var(--sb-neutral-100)' : 'var(--sb-border-subtle)'),
        color: active ? 'var(--sb-neutral-0)' : 'var(--sb-ink-2)',
        cursor: onClick ? 'pointer' : 'default',
        transition: `all var(--sb-duration-fast) var(--sb-ease-in-out)`,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </Root>
  );
}

/* ═══════ Spinner ═══════ */
export function Spinner({ size = 20, color = 'var(--sb-danger)' }) {
  return (
    <div style={{
      width: size, height: size,
      border: `3px solid var(--sb-border-default)`,
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
      {/* 有意变更 Δ−1px：V2 --text-lg = 17px，D19 落档到 --sb-text-lg = 16px。 */}
      {title && <div style={{ fontSize: 'var(--sb-text-lg)', fontWeight: 'var(--sb-weight-bold)', marginTop: 16, color: 'var(--sb-ink-1)' }}>{title}</div>}
      {desc && <p style={{ fontSize: 'var(--sb-text-md)', color: 'var(--sb-ink-4)', marginTop: 6 }}>{desc}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}
