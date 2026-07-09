import React from "react";

export interface SwitchProps {
  checked?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  /** @default "md" */
  size?: "sm" | "md";
  style?: React.CSSProperties;
}

/** Pill toggle with springy knob and coral gradient track. */
export function Switch(props: SwitchProps): JSX.Element;
