import React from 'react';
import { FileVideo, FolderInput, ImagePlay, ImageUp, WandSparkles } from 'lucide-react';

/* Hero glyph set v3 — per the frontier research (docs/superpowers/research/
   2026-08-25-icon-library-micro-interaction-research.md), the base stays
   Lucide (shadcn/Vercel-grade geometry); what makes them alive is the
   verb-family ambient motion wired in EcCanvas.css:

     · bring family (upload image / upload video): slow bob while hovered
       — the asset is being lifted in.
     · magic family (suite / video generation): twinkle pulse — AI at work.
     · import (works): horizontal nudge toward the canvas — pulling in.

   Each glyph also fades/rises into place once the host button has landed,
   so the row reads as drawn-on-demand rather than stamped. Reduced-motion
   overrides neutralize every layer. */

const FAMILY = {
  image: { Icon: ImageUp, cls: 'ec-glyph-bring' },
  video: { Icon: FileVideo, cls: 'ec-glyph-bring' },
  works: { Icon: FolderInput, cls: 'ec-glyph-pull' },
  suite: { Icon: WandSparkles, cls: 'ec-glyph-magic' },
  film: { Icon: ImagePlay, cls: 'ec-glyph-magic' },
};

export function HeroGlyph({ kind }) {
  const { Icon, cls } = FAMILY[kind];
  return <Icon size={18} strokeWidth={1.75} className={'ec-hero-glyph ' + cls} />;
}
