import React from "react";

export interface ButtonProps {
  children?: React.ReactNode;
  /** Visual style. @default "primary" */
  variant?: "primary" | "secondary" | "ghost" | "sun" | "sprout";
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  /** Full-width block button. @default false */
  block?: boolean;
  disabled?: boolean;
  /** Icon node rendered before the label */
  icon?: React.ReactNode;
  /** Icon node rendered after the label */
  iconRight?: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  style?: React.CSSProperties;
}

/**
 * Chunky 3D "jelly" button — the brand's primary call-to-action.
 * Springy press depresses the bottom edge; coral gradient by default.
 *
 * @startingPoint section="Core" subtitle="3D springy call-to-action" viewport="700x220"
 */
export function Button(props: ButtonProps): JSX.Element;
