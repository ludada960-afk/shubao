import React, { useState } from "react";

/**
 * 薯包AI Button — chunky 3D "jelly" button with springy press.
 * variant: primary | secondary | ghost | sun | sprout
 * size: sm | md | lg
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  block = false,
  disabled = false,
  icon = null,
  iconRight = null,
  onClick,
  style = {},
  ...rest
}) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);

  const sizes = {
    sm: { padding: "8px 16px", fontSize: 13, radius: "var(--r-sm)", gap: 6, h: 0 },
    md: { padding: "13px 26px", fontSize: 15, radius: "var(--r-md)", gap: 8, h: 0 },
    lg: { padding: "17px 38px", fontSize: 18, radius: "var(--r-lg)", gap: 10, h: 0 },
  };
  const sz = sizes[size] || sizes.md;

  const palettes = {
    primary: {
      bg: "var(--grad-brand)", color: "#fff",
      rest: "var(--btn-3d-coral)", down: "var(--btn-3d-coral-press)",
    },
    sun: {
      bg: "var(--grad-sunset)", color: "#fff",
      rest: "0 1px 0 rgba(255,255,255,.5) inset, 0 6px 0 #C98A00, 0 12px 22px rgba(255,160,0,.4)",
      down: "0 1px 0 rgba(255,255,255,.5) inset, 0 2px 0 #C98A00, 0 6px 14px rgba(255,160,0,.35)",
    },
    sprout: {
      bg: "var(--grad-sprout)", color: "#fff",
      rest: "0 1px 0 rgba(255,255,255,.5) inset, 0 6px 0 var(--sprout-700), 0 12px 22px rgba(92,201,122,.4)",
      down: "0 1px 0 rgba(255,255,255,.5) inset, 0 2px 0 var(--sprout-700), 0 6px 14px rgba(92,201,122,.35)",
    },
    secondary: {
      bg: "#fff", color: "var(--coral-600)",
      rest: "var(--btn-3d-white)", down: "0 1px 0 rgba(255,255,255,.9) inset, 0 2px 0 #F0DADA, 0 6px 14px rgba(120,40,50,.12)",
      border: "var(--bw) solid var(--coral-200)",
    },
    ghost: {
      bg: "transparent", color: "var(--coral-600)",
      rest: "none", down: "none", flat: true,
    },
  };
  const p = palettes[variant] || palettes.primary;

  const lift = press ? 4 : hover ? -2 : 0;
  const boxShadow = disabled ? "none" : (press ? p.down : p.rest);

  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      disabled={disabled}
      style={{
        display: block ? "flex" : "inline-flex",
        width: block ? "100%" : "auto",
        alignItems: "center",
        justifyContent: "center",
        gap: sz.gap,
        fontFamily: "var(--font-body)",
        fontWeight: 700,
        fontSize: sz.fontSize,
        lineHeight: 1,
        letterSpacing: ".01em",
        padding: sz.padding,
        borderRadius: sz.radius,
        border: p.border || "none",
        cursor: disabled ? "not-allowed" : "pointer",
        color: p.color,
        background: p.bg,
        boxShadow,
        opacity: disabled ? 0.5 : 1,
        transform: p.flat
          ? (hover && !disabled ? "scale(1.04)" : "scale(1)")
          : `translateY(${lift}px)`,
        transition: "transform .14s var(--ease-spring), box-shadow .14s var(--ease-out), background .2s",
        WebkitTapHighlightColor: "transparent",
        ...(variant === "ghost" && hover && !disabled ? { background: "var(--coral-50)" } : {}),
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}
