import React from 'react';

/* ═══ HotSkillStrip：首页的「热门技能」条 ═══════════════════════════════════════
   用户 9-17 定的最终形态（原话）：
   「首页的提示词输入区下面，我们是会放一些热门 skill 在那的，然后点击那些 skill
     就会直接进入到这些子页面里面去。」
   所以这张条的每一张卡 = 一个 skill 的入口，点进去就是它的工作台（?id= 单页渲染）。
   数据全部来自声明源（skillDirectory）；没有封面的 skill 不进条 —— 首页上摆一排空卡
   比少放几张更糟。案例由用户自己产出，产出后这张条会自动变长，这里不用改。 */
import CaseCard from './CaseCard.jsx';
import { coverOf, hotSkills } from '../../skills/skillDirectory.js';
import './GalleryGrid.css';
import './HotSkillStrip.css';

export default function HotSkillStrip({
  limit = 10,
  title = '热门技能',
  hint = '挑一个开始，配置已经替你调好',
  onOpenSkill = null,
}) {
  const skills = hotSkills({ limit });
  if (!skills.length) return null;

  return (
    <section className="hot-skill-strip" aria-label={title}>
      <header className="hot-skill-strip-head">
        <h2>{title}</h2>
        <p>{hint}</p>
      </header>
      <div className="media-gallery-grid">
        {skills.map(skill => {
          const media = coverOf(skill);
          return (
            <CaseCard
              key={skill.id}
              title={skill.name}
              subtitle={skill.summary}
              cover={media.cover}
              video={media.video}
              poster={media.poster}
              badge={skill.board === 'video' ? '视频' : ''}
              onOpen={() => onOpenSkill?.(skill)}
            />
          );
        })}
      </div>
    </section>
  );
}
