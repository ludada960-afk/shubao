import React from "react";

/**
 * 薯包AI Mascot — renders the brand potato-bag character illustration
 * with a soft drop-shadow and optional idle animation.
 *
 * Provide an explicit `src`, OR a `pose` name + `base` directory.
 * Pose names map to files like `assets/mascot-<pose>.webp`.
 */
const POSES = [
  "wave", "jump", "superhero", "welcome", "empty", "ready", "walk", "sit",
  "writing", "meditate", "surf", "analyze", "upgrade", "lookup", "done",
  "crash", "approve", "photographer", "inspect", "lift", "curator", "cook",
  "sleep", "paint", "dance", "error",
];

export function Mascot({
  src,
  pose = "wave",
  base = "assets",
  size = 120,
  anim = "float",
  glow = true,
  alt = "小薯包",
  style = {},
  ...rest
}) {
  const url = src || `${base}/mascot-${pose}.webp`;
  const animations = {
    float: "sb-float 3s ease-in-out infinite",
    bob: "sb-bob 2.4s ease-in-out infinite",
    twinkle: "sb-wobble 2.6s ease-in-out infinite",
    none: "none",
  };
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      style={{
        width: size,
        height: "auto",
        display: "block",
        objectFit: "contain",
        filter: glow ? "drop-shadow(0 10px 22px rgba(255,71,87,.22))" : "none",
        animation: animations[anim] || animations.float,
        ...style,
      }}
      {...rest}
    />
  );
}

Mascot.POSES = POSES;
