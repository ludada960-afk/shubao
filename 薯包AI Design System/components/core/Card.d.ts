import React from "react";

export interface CardProps {
  children?: React.ReactNode;
  /** @default "raised" */
  variant?: "plain" | "raised" | "gradient";
  /** Enable hover-lift interaction. @default false */
  hover?: boolean;
  /** CSS background for the header band (gradient or color). @default brand gradient */
  gradient?: string;
  /** Content rendered inside the colored header band (e.g. title overlay) */
  header?: React.ReactNode;
  /** Header band height in px. @default 150 */
  headerHeight?: number;
  /** Body padding in px. @default 20 */
  pad?: number;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  style?: React.CSSProperties;
}

/**
 * Soft clay-raised surface. The `header` + `gradient` props produce the
 * Xiaohongshu-style note cover (colored band with darkened gradient foot).
 *
 * @startingPoint section="Core" subtitle="Clay-raised surface / note cover" viewport="360x320"
 */
export function Card(props: CardProps): JSX.Element;
