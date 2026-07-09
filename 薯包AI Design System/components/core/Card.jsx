import React, { useState } from "react";

/**
 * 薯包AI Card — soft clay-raised surface with optional hover-lift
 * and a gradient header band (for Xiaohongshu-style note covers).
 * variant: plain | raised | gradient
 */
export function Card({
  children,
  variant = "raised",
  hover = false,
  gradient = "var(--grad-brand)",
  header = null,
  headerHeight = 150,
  pad = 20,
  onClick,
  style = {},
  ...rest
}) {
  const [h, setH] = useState(false);

  const base = {
    position: "relative",
    background: "var(--surface-card)",
    borderRadius: "var(--r-lg)",
    border: "var(--bw) solid var(--border-soft)",
    overflow: "hidden",
    transition: "transform .28s var(--ease-spring), box-shadow .28s var(--ease-out)",
    cursor: hover || onClick ? "pointer" : "default",
  };
  const shadows = {
    plain: "var(--sh-sm)",
    raised: "var(--clay-raised)",
    gradient: "var(--sh-md)",
  };
  const lift = (hover || onClick) && h;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        ...base,
        boxShadow: lift ? "var(--sh-lg)" : (shadows[variant] || shadows.raised),
        transform: lift ? "translateY(-6px)" : "translateY(0)",
        ...style,
      }}
      {...rest}
    >
      {header !== null && (
        <div
          style={{
            height: headerHeight,
            background: gradient,
            position: "relative",
            display: "flex",
            alignItems: "flex-end",
            padding: 16,
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(transparent 45%, rgba(0,0,0,.42))" }} />
          <div style={{ position: "absolute", inset: 0, background: "var(--gloss)", opacity: .6, pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1 }}>{header}</div>
        </div>
      )}
      {children != null && <div style={{ padding: pad }}>{children}</div>}
    </div>
  );
}
