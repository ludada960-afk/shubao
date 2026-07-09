import React from "react";

/**
 * 薯包AI Badge — small status / category pill.
 * tone: coral | sprout | sun | grape | neutral
 * variant: soft (tinted) | solid (filled gradient)
 */
export function Badge({ children, tone = "coral", variant = "soft", icon = null, style = {}, ...rest }) {
  const tones = {
    coral:  { soft: ["var(--coral-50)", "var(--coral-600)"], grad: "var(--grad-coral)" },
    sprout: { soft: ["var(--sprout-50)", "var(--sprout-700)"], grad: "var(--grad-sprout)" },
    sun:    { soft: ["var(--sun-100)", "var(--sun-600)"], grad: "var(--grad-sunset)" },
    grape:  { soft: ["#F1ECFE", "var(--grape-600)"], grad: "var(--grad-grape)" },
    neutral:{ soft: ["var(--ink-100)", "var(--ink-600)"], grad: "linear-gradient(135deg,#9C8488,#5A4145)" },
  };
  const t = tones[tone] || tones.coral;
  const solid = variant === "solid";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "var(--font-body)",
        fontSize: "var(--fs-xs)",
        fontWeight: 700,
        lineHeight: 1,
        padding: "5px 11px",
        borderRadius: "var(--r-pill)",
        color: solid ? "#fff" : t.soft[1],
        background: solid ? t.grad : t.soft[0],
        boxShadow: solid ? "0 4px 12px rgba(120,40,50,.18)" : "none",
        ...style,
      }}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}
