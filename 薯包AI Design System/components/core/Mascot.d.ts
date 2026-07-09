import React from "react";

export interface MascotProps {
  /** Explicit image URL (preferred). Overrides pose/base. */
  src?: string;
  /** Pose name → resolves to `<base>/mascot-<pose>.webp`. @default "wave" */
  pose?:
    | "wave" | "jump" | "superhero" | "welcome" | "empty" | "ready" | "walk"
    | "sit" | "writing" | "meditate" | "surf" | "analyze" | "upgrade"
    | "lookup" | "done" | "crash" | "approve" | "photographer" | "inspect"
    | "lift" | "curator" | "cook" | "sleep" | "paint" | "dance" | "error";
  /** Directory holding mascot-*.webp. @default "assets" */
  base?: string;
  /** Rendered width in px. @default 120 */
  size?: number;
  /** Idle animation. @default "float" */
  anim?: "float" | "bob" | "twinkle" | "none";
  /** Coral drop-shadow glow. @default true */
  glow?: boolean;
  alt?: string;
  style?: React.CSSProperties;
}

/**
 * The brand mascot illustration with idle motion. Copy the matching
 * `assets/mascot-*.webp` into the consuming project (or pass `src`).
 *
 * @startingPoint section="Brand" subtitle="Animated brand mascot" viewport="320x320"
 */
export function Mascot(props: MascotProps): JSX.Element;
