import React from "react";

/**
 * 薯包AI Switch — pill toggle with springy knob and coral gradient track.
 */
export function Switch({ checked = false, onChange, disabled = false, size = "md", style = {}, ...rest }) {
  const dims = size === "sm" ? { w: 40, h: 24, k: 18 } : { w: 52, h: 30, k: 24 };
  const pad = (dims.h - dims.k) / 2;
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange && onChange(!checked)}
      style={{
        width: dims.w,
        height: dims.h,
        borderRadius: "var(--r-pill)",
        border: "none",
        padding: 0,
        position: "relative",
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "var(--grad-coral)" : "var(--ink-200)",
        boxShadow: checked ? "inset 0 1px 3px rgba(200,30,55,.3), 0 4px 10px rgba(255,71,87,.3)" : "var(--clay-inset)",
        opacity: disabled ? 0.5 : 1,
        transition: "background .25s var(--ease-out)",
        ...style,
      }}
      {...rest}
    >
      <span
        style={{
          position: "absolute",
          top: pad,
          left: checked ? dims.w - dims.k - pad : pad,
          width: dims.k,
          height: dims.k,
          borderRadius: "var(--r-pill)",
          background: "#fff",
          boxShadow: "0 2px 6px rgba(120,40,50,.3)",
          transition: "left .26s var(--ease-spring)",
        }}
      />
    </button>
  );
}
