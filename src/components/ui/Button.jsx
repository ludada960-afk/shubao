import React, { useState } from 'react';

export default function Button({
  children, onClick, disabled, primary, small, full, ghost, className = '', style = {},
}) {
  const [hover, setHover] = useState(false);
  /* D11 键盘可达：原实现抑制 UA 轮廓后没有任何替代焦点样式 → 键盘用户看不到焦点。
     这里补 focus 态，并把焦点环叠加在原有阴影之上（不覆盖、不改尺寸）。 */
  const [focused, setFocused] = useState(false);

  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: small ? 5 : 7,
    padding: small ? '7px 14px' : '12px 24px',
    borderRadius: small ? 'var(--radius-md)' : 'var(--radius-lg)',
    fontSize: small ? 'var(--text-sm)' : 'var(--text-base)',
    fontWeight: 'var(--weight-semibold)',
    fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: `all var(--duration-normal) var(--ease)`,
    transform: hover && !disabled ? 'translateY(-1px)' : 'none',
    width: full ? '100%' : 'auto',
    border: 'none',
    outline: '0 solid transparent',
    /* 焦点环用 box-shadow（不参与盒模型 → 零布局抖动） */
    ...(focused ? { boxShadow: 'var(--sb-shadow-ring)' } : null),
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    ...style,
  };

  if (primary) {
    Object.assign(base, {
      background: disabled ? '#FFB3BD' : 'var(--red)',
      color: 'var(--sb-neutral-0)',
      /* 焦点优先于 hover 阴影：两者叠加时仍保证焦点环可见 */
      boxShadow: focused
        ? 'var(--sb-shadow-ring)'
        : (hover && !disabled ? 'var(--shadow-red-lg)' : 'none'),
    });
  } else if (ghost) {
    Object.assign(base, {
      background: 'transparent',
      color: 'var(--text-muted)',
      border: 'none',
    });
    if (hover) base.background = 'var(--border-light)';
  } else {
    Object.assign(base, {
      background: hover ? '#f8f8f8' : 'var(--sb-neutral-0)',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border)',
    });
  }

  return (
    <button
      style={base}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={className}
    >
      {children}
    </button>
  );
}
