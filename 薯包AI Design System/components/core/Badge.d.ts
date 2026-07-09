import React from "react";

export interface BadgeProps {
  children?: React.ReactNode;
  /** @default "coral" */
  tone?: "coral" | "sprout" | "sun" | "grape" | "neutral";
  /** soft = tinted bg, solid = filled gradient. @default "soft" */
  variant?: "soft" | "solid";
  icon?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Small status / category pill. Soft tinted by default; solid for emphasis. */
export function Badge(props: BadgeProps): JSX.Element;
