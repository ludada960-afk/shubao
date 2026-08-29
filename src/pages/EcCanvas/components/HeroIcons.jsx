import React from 'react';
import { Captions, FileVideo, Film, FolderInput, ImagePlay, ImageUp, Mic, Theater, WandSparkles } from 'lucide-react';

/* Hero glyph set v5 — 4c183cd4 续命 画布中央深度重构 (5+3=8 个动作)
   5 原有 (image / video / works / suite / film) + 3 新增 (storyboard / voiceover / oneclick).
   新增 family: storyboard (戏剧, 慢旋转) / voiceover (麦克风, 律动) / oneclick (胶片, 推进感).
   沿用 v4 的 split motion channel 设计 — 解决 hover-off 重新触发入场动画的 bug. */

const FAMILY = {
  /* 5 原有 */
  image: { Icon: ImageUp, cls: 'ec-glyph-bring' },
  video: { Icon: FileVideo, cls: 'ec-glyph-bring' },
  works: { Icon: FolderInput, cls: 'ec-glyph-pull' },
  suite: { Icon: WandSparkles, cls: 'ec-glyph-magic' },
  film: { Icon: ImagePlay, cls: 'ec-glyph-magic' },
  /* 3 新增 (流影AI LibTV 风格) */
  storyboard: { Icon: Theater, cls: 'ec-glyph-storyboard' },
  voiceover: { Icon: Mic, cls: 'ec-glyph-voiceover' },
  oneclick: { Icon: Film, cls: 'ec-glyph-oneclick' },
  /* 字幕动效 (备选) */
  captions: { Icon: Captions, cls: 'ec-glyph-storyboard' },
};

export function HeroGlyph({ kind }) {
  const family = FAMILY[kind] || FAMILY.image;
  const { Icon, cls } = family;
  return <span className="ec-hero-glyph-slot"><Icon size={18} strokeWidth={1.75} className={'ec-hero-glyph ' + cls} /></span>;
}
