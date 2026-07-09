import React from "react";

export interface AvatarProps {
  /** Image URL. Falls back to the name initial on a coral gradient. */
  src?: string;
  /** Display name (used for the fallback initial + alt). */
  name?: string;
  /** Diameter in px. @default 40 */
  size?: number;
  /** Show a coral highlight ring. @default false */
  ring?: boolean;
  style?: React.CSSProperties;
}

/** Rounded creator/user avatar with gradient initial fallback. */
export function Avatar(props: AvatarProps): JSX.Element;
