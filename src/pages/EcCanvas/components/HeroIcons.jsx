import React from 'react';
import { Captions, Clapperboard, FileVideo, Film, FolderInput, ImagePlay, ImageUp, Mic, MicVocal, Pencil, WandSparkles } from 'lucide-react';

/* Hero glyph set v7 — 9-07 空态按钮个性化图标修复 + 4 个 AI 生成入口独特视觉
   原来 text/sparkles/clapperboard/mic 四个 kind 在 FAMILY 中不存在 → 全部 fallback 到 image 图标 (Bug)。
   现在每个动词都有独立图标 + 独立动效 channel, 符合资深美工/产品经理视角的差异化设计。 */

const FAMILY = {
  /* 添加素材行 (实体感: 带入感 bob) */
  image: { Icon: ImageUp, cls: 'ec-glyph-bring' },
  video: { Icon: FileVideo, cls: 'ec-glyph-bring' },
  works: { Icon: FolderInput, cls: 'ec-glyph-pull' },
  /* AI 生成行 (每个独特图标 + 独特动效) */
  text: { Icon: Pencil, cls: 'ec-glyph-write' },          /* 新建文本: 铅笔 (书写感) */
  sparkles: { Icon: WandSparkles, cls: 'ec-glyph-magic' }, /* 生成图片: 魔棒火花 (AI 魔法) */
  clapperboard: { Icon: Clapperboard, cls: 'ec-glyph-cinema' }, /* 生成视频: 场记板 (电影感) */
  mic: { Icon: MicVocal, cls: 'ec-glyph-voice' },         /* 添加音频: 收音麦克风 (声音感) */
  /* 保留 (右面板 / 1-click) */
  suite: { Icon: WandSparkles, cls: 'ec-glyph-magic' },
  film: { Icon: ImagePlay, cls: 'ec-glyph-magic' },
  oneclick: { Icon: Film, cls: 'ec-glyph-oneclick' },
  voiceover: { Icon: Mic, cls: 'ec-glyph-voiceover' },
  captions: { Icon: Captions, cls: 'ec-glyph-storyboard' },
};

export function HeroGlyph({ kind }) {
  const family = FAMILY[kind] || FAMILY.image;
  const { Icon, cls } = family;
  return <span className="ec-hero-glyph-slot"><Icon size={18} strokeWidth={1.75} className={'ec-hero-glyph ' + cls} /></span>;
}
