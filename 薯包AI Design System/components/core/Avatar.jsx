import React from "react";

/**
 * 薯包AI Avatar — rounded user / creator avatar with optional ring.
 */
export function Avatar({ src, name = "", size = 40, ring = false, style = {}, ...rest }) {
  const initial = name ? name.trim().slice(0, 1) : "薯";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "var(--r-pill)",
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        background: src ? "var(--ink-100)" : "var(--grad-coral)",
        color: "#fff",
        fontFamily: "var(--font-display)",
        fontSize: size * 0.42,
        boxShadow: ring
          ? "0 0 0 2.5px var(--surface-card), 0 0 0 4.5px var(--coral-300), var(--sh-sm)"
          : "var(--sh-xs)",
        ...style,
      }}
      {...rest}
    >
      {src ? (
        <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initial
      )}
    </div>
  );
}
