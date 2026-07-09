import React, { useState } from 'react';

export default function Button({
  children, onClick, disabled, primary, small, full, ghost, className = '', style = {},
}) {
  const [hover, setHover] = useState(false);

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
    outline: 'none',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    ...style,
  };

  if (primary) {
    Object.assign(base, {
      background: disabled ? '#FFB3BD' : 'var(--red)',
      color: '#fff',
      boxShadow: hover && !disabled ? 'var(--shadow-red-lg)' : 'none',
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
      background: hover ? '#f8f8f8' : '#fff',
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
      className={className}
    >
      {children}
    </button>
  );
}
