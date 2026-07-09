import React, { useState } from "react";

/**
 * 薯包AI Input — clay-inset field. Renders <input> or <textarea>.
 * Coral focus ring + lift.
 */
export function Input({
  as = "input",
  value,
  onChange,
  placeholder = "",
  label = null,
  icon = null,
  rows = 4,
  disabled = false,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = useState(false);
  const Tag = as === "textarea" ? "textarea" : "input";

  const field = (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: as === "textarea" ? "flex-start" : "center",
        gap: 10,
        background: "var(--surface-card)",
        borderRadius: "var(--r-md)",
        border: `var(--bw) solid ${focus ? "var(--coral-400)" : "var(--border-soft)"}`,
        boxShadow: focus ? "var(--ring-brand)" : "var(--clay-inset)",
        padding: as === "textarea" ? "14px 16px" : "0 16px",
        transition: "border-color .18s, box-shadow .2s",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon && <span style={{ color: focus ? "var(--coral-500)" : "var(--text-faint)", display: "flex", marginTop: as === "textarea" ? 2 : 0 }}>{icon}</span>}
      <Tag
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={as === "textarea" ? rows : undefined}
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          flex: 1,
          width: "100%",
          border: "none",
          outline: "none",
          background: "transparent",
          fontFamily: "var(--font-body)",
          fontSize: "var(--fs-body)",
          lineHeight: as === "textarea" ? 1.75 : 1,
          color: "var(--text-strong)",
          resize: as === "textarea" ? "vertical" : "none",
          padding: as === "textarea" ? 0 : "13px 0",
          ...style,
        }}
        {...rest}
      />
    </div>
  );

  if (!label) return field;
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: "var(--fs-sm)", fontWeight: 700, color: "var(--text-body)", marginBottom: 8 }}>{label}</span>
      {field}
    </label>
  );
}
