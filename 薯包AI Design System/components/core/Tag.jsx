import React, { useState } from "react";

/**
 * 薯包AI Tag — Xiaohongshu-style #hashtag chip.
 * Clickable; subtle coral tint with springy hover.
 */
export function Tag({ children, onClick, active = false, style = {}, ...rest }) {
  const [h, setH] = useState(false);
  const label = typeof children === "string" && !children.startsWith("#") ? "#" + children : children;
  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontFamily: "var(--font-body)",
        fontSize: "var(--fs-sm)",
        fontWeight: 500,
        lineHeight: 1,
        padding: "6px 13px",
        borderRadius: "var(--r-pill)",
        color: active ? "#fff" : "var(--coral-600)",
        background: active ? "var(--grad-coral)" : (h ? "var(--coral-100)" : "var(--coral-50)"),
        cursor: onClick ? "pointer" : "default",
        transform: h && onClick ? "translateY(-2px)" : "none",
        boxShadow: active ? "0 4px 12px rgba(255,71,87,.28)" : "none",
        transition: "transform .15s var(--ease-spring), background .18s",
        ...style,
      }}
      {...rest}
    >
      {label}
    </span>
  );
}
