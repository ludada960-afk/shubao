import React from "react";

export interface TagProps {
  children?: React.ReactNode;
  /** Highlighted/selected state. @default false */
  active?: boolean;
  onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
  style?: React.CSSProperties;
}

/** Xiaohongshu-style #hashtag chip. Auto-prefixes "#" for plain string labels. */
export function Tag(props: TagProps): JSX.Element;
