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
    /* C 类保留（D24 第 3 条）：V2 --radius-lg = 30px 在 V3 阶梯里**没有对应档**
       （最近的 --sb-radius-3xl = 24px，Δ−6px 属观感变更），先留字面量、列清单待裁定。 */
    borderRadius: small ? 'var(--sb-radius-xl)' : 'var(--radius-lg)',
    /* 有意变更 Δ−1px：V2 --text-base = 15px，D17 判定 15px「夹心档」退役，
       归入 --sb-text-base = 14px（标准正文档）。见 D17/D19/D24。 */
    fontSize: small ? 'var(--sb-text-md)' : 'var(--sb-text-base)',
    fontWeight: 'var(--sb-weight-semibold)',
    fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: `all var(--sb-duration-normal) var(--sb-ease-in-out)`,
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
      background: disabled ? '#FFB3BD' : 'var(--sb-danger)',
      color: 'var(--sb-neutral-0)',
      /* 焦点优先于 hover 阴影：两者叠加时仍保证焦点环可见 */
      boxShadow: focused
        ? 'var(--sb-shadow-ring)'
        : (hover && !disabled ? 'var(--sb-danger-shadow)' : 'none'),
    });
  } else if (ghost) {
    Object.assign(base, {
      background: 'transparent',
      color: 'var(--sb-ink-3)',
      border: 'none',
    });
    if (hover) base.background = 'var(--sb-border-subtle)';
  } else {
    Object.assign(base, {
      background: hover ? '#f8f8f8' : 'var(--sb-neutral-0)',
      color: 'var(--sb-ink-2)',
      border: '1px solid var(--sb-border-default)',
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
