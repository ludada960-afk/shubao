import React from 'react';
import { Captions, FileVideo, Film, FolderInput, ImagePlay, ImageUp, Mic, WandSparkles } from 'lucide-react';

/* Hero glyph set v6 — 4c183cd4 续命 画布中央深度重构 v2 (5+4=9 个动作)
   5 原有 (image / video / works / suite / film, 用户硬性要求保留)
   + 4 新增 (流影AI LibTV 风格, 用户硬性指定):
     1-click 套图 (oneclick, Grid2X2 在右面板, Film 在中央) / 1-click 视频模板 (oneclick) /
     TTS 配音 (voiceover) / 字幕动效 (captions)
   沿用 v4 的 split motion channel 设计 — 解决 hover-off 重新触发入场动画的 bug. */

const FAMILY = {
  /* 5 原有 (用户硬性要求保留) */
  image: { Icon: ImageUp, cls: 'ec-glyph-bring' },
  video: { Icon: FileVideo, cls: 'ec-glyph-bring' },
  works: { Icon: FolderInput, cls: 'ec-glyph-pull' },
  suite: { Icon: WandSparkles, cls: 'ec-glyph-magic' },
  film: { Icon: ImagePlay, cls: 'ec-glyph-magic' },
  /* 4 新增 (流影AI LibTV 风格, 用户硬性指定 1-click 套图 / 1-click 视频模板 / TTS 配音 / 字幕动效) */
  oneclick: { Icon: Film, cls: 'ec-glyph-oneclick' },        /* 1-click 套图 / 1-click 视频模板: 胶片 */
  voiceover: { Icon: Mic, cls: 'ec-glyph-voiceover' },         /* TTS 配音: 麦克风 */
  captions: { Icon: Captions, cls: 'ec-glyph-storyboard' },    /* 字幕动效: 字幕 */
};

export function HeroGlyph({ kind }) {
  const family = FAMILY[kind] || FAMILY.image;
  const { Icon, cls } = family;
  return <span className="ec-hero-glyph-slot"><Icon size={18} strokeWidth={1.75} className={'ec-hero-glyph ' + cls} /></span>;
}
