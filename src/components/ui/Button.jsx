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
    /* D29（2026-09-15 裁定，结清 D24 第 3 条）：V2 --radius-lg = 30px **归入胶囊档**。
       依据是几何事实而非偏好：本按钮实测高 43.6px（padding 12px 24px + 14px × line-height 1.4），
       而 CSS 规定「一侧两个圆角之和超过边长时，全部圆角按同一比例缩放」——
       30+30=60 > 43.6 → 实际渲染半径被缩到 h/2 = 21.8px，**本来就是胶囊**。
       故改用 --sb-radius-pill 是**零观感变更**（只要高度 ≤ 60px；改高度需重算）。 */
    borderRadius: small ? 'var(--sb-radius-xl)' : 'var(--sb-radius-pill)',
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
      background: disabled ? 'var(--sb-state-disabled-bg)' : 'var(--sb-danger)',
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
      background: hover ? 'var(--sb-hover-bg)' : 'var(--sb-neutral-0)',
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
