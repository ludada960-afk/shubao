import React from 'react';
import { FileVideo, FolderInput, ImagePlay, ImageUp, WandSparkles } from 'lucide-react';

/* Hero glyph set v4 — per the frontier research (docs/superpowers/research/
   2026-08-25-icon-library-micro-interaction-research.md), the base stays
   Lucide (shadcn/Vercel-grade geometry); what makes them alive is the
   verb-family ambient motion wired in EcCanvas.css:

     · bring family (upload image / upload video): slow bob while hovered
       — the asset is being lifted in.
     · magic family (suite / video generation): twinkle pulse — AI at work.
     · import (works): horizontal nudge toward the canvas — pulling in.

   Each glyph rises into place once its host button lands, so the row reads
   as drawn-on-demand rather than stamped. Reduced-motion overrides
   neutralize every layer.

   Motion channels are SPLIT across two elements so hover can never replay
   the entrance: the wrapper span owns ecGlyphIn (runs exactly once on
   mount), the svg owns only the transform-only ambient loops. Replacing
   the shorthand on the same element made hover-off restart ecGlyphIn,
   whose backwards fill paints opacity 0 through its delay — the "icon
   vanishes when the pointer leaves" bug. With separate channels, unhover
   merely stops a loop that never touches visibility. */

const FAMILY = {
  image: { Icon: ImageUp, cls: 'ec-glyph-bring' },
  video: { Icon: FileVideo, cls: 'ec-glyph-bring' },
  works: { Icon: FolderInput, cls: 'ec-glyph-pull' },
  suite: { Icon: WandSparkles, cls: 'ec-glyph-magic' },
  film: { Icon: ImagePlay, cls: 'ec-glyph-magic' },
};

export function HeroGlyph({ kind }) {
  const { Icon, cls } = FAMILY[kind];
  return <span className="ec-hero-glyph-slot"><Icon size={18} strokeWidth={1.75} className={'ec-hero-glyph ' + cls} /></span>;
}
