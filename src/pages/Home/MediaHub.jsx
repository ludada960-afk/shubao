import React, { useMemo, useState } from 'react';

/* ═══ MediaHub：图片 / 视频两个板块共用的 Hub 页面 ═══════════════════════════════
   依据 docs/design/43-media-architecture.md §3（信息架构）与 §10（知渔实测）。
   实测口径：Hub = 分组标题 + 案例卡网格（统一 4:3 封面 + 标题），点卡进对应 Skill 的工作台。
   实测机制：他们是一个页面按 id 渲染全部 Skill（/image-creation?id=<skillId>），
   所以我们这里也只有一个 Hub 组件：board='image' 或 'video' 决定读哪份声明源。
   本组件**只做渲染**：不写死任何 Skill，不写模型名，配置与文案全部来自声明源
   （src/skills/imageSkills.js / videoSkills.js）——新增 Skill 只加声明，不改这里。 */
import { IMAGE_SKILLS } from '../../skills/imageSkills.js';
import { VIDEO_SKILLS } from '../../skills/videoSkills.js';
import CaseCard from '../../components/media/CaseCard.jsx';
import { availabilityLabel, coverOf, fusionLabel } from '../../skills/skillDirectory.js';
import '../../components/media/CaseCard.css';
import '../../components/media/GalleryGrid.css';
import './MediaHub.css';

const BOARDS = {
  image: { skills: IMAGE_SKILLS, title: '图片生成', hint: '选一个方向开始，配置已经替你调好' },
  video: { skills: VIDEO_SKILLS, title: '视频生成', hint: '选一个玩法开始，素材与时长按玩法预设' },
};

export default function MediaHub({ board = 'image', onOpenSkill = null, emptyHint = '' }) {
  const config = BOARDS[board] || BOARDS.image;
  const groups = useMemo(() => {
    const order = [];
    const map = new Map();
    /* 辅助能力单独收在最后一组：它们是被主技能调用的「一步」，
       混在正常分类里会让人以为那是一个能独立干完的活儿。 */
    const assistants = config.skills.filter(skill => skill.tier === 'assistant');
    for (const skill of config.skills) {
      if (skill.tier === 'assistant') continue;
      if (!map.has(skill.category)) { map.set(skill.category, []); order.push(skill.category); }
      map.get(skill.category).push(skill);
    }
    const list = order.map(category => ({ category, skills: map.get(category) }));
    if (assistants.length) list.push({ category: '辅助能力', skills: assistants, assistantGroup: true });
    return list;
  }, [config]);

  /* ═══ 顶部快捷筛选页签（照竞品实测结构）═══════════════════════════════════════
     竞品两个总页面顶部都有一排分类页签（实测：图片页 8 档、视频页 4 档），
     点一下就只看那一档 —— 我们的分类本来就声明在技能里（skill.category），
     所以这排页签**不是一份手写清单**：技能增删/换组，页签自己跟着走。
     ⚠️ 「全部」是默认档：先让人看见"这里有多少东西"，再让他收窄。 */
  const [activeCategory, setActiveCategory] = useState('');
  const shown = activeCategory ? groups.filter(group => group.category === activeCategory) : groups;

  return (
    <section className="media-hub" data-board={board}>
      <header className="media-hub-head">
        <div>
          <h1>{config.title}</h1>
          <p>{config.hint}</p>
        </div>
      </header>
      {groups.length > 0 && (
        <div className="media-hub-tabs" role="tablist" aria-label={config.title + '技能分类'}>
          <button
            type="button"
            role="tab"
            aria-selected={!activeCategory}
            className={!activeCategory ? 'is-active' : ''}
            onClick={() => setActiveCategory('')}
          >全部<span>{config.skills.length}</span></button>
          {groups.map(group => (
            <button
              key={group.category}
              type="button"
              role="tab"
              aria-selected={activeCategory === group.category}
              className={activeCategory === group.category ? 'is-active' : ''}
              onClick={() => setActiveCategory(group.category)}
            >{group.category}<span>{group.skills.length}</span></button>
          ))}
        </div>
      )}
      {groups.length === 0 && <p className="media-hub-empty">{emptyHint || '暂时没有可用的技能'}</p>}
      {shown.map(group => (
        <section className="media-gallery-group" key={group.category}>
          <h2>{group.category}</h2>
          {/* 辅助能力说清它是什么：不是让你从这里开始，而是它会在主技能里被用到 */}
          {group.assistantGroup && (
            <p className="media-hub-group-note">这些是某个主技能流程里的一步（不是独立入口），也可以直接点开单独用。</p>
          )}
          <div className="media-gallery-grid">
            {group.skills.map(skill => {
              /* 封面取法与首页热门条**同一份实现**（skillDirectory.coverOf）：
                 视频卡优先用视频（真实在播），cover 当 poster。 */
              const media = coverOf(skill);
              return (
                <CaseCard
                  key={skill.id}
                  title={skill.name}
                  /* 辅助能力卡片：副标题说清"它长在谁身上"（fusionLabel 与文档同源），
                     而不是再抄一遍 summary —— 用户看这一组时最想知道的就是它从哪进去。 */
                  subtitle={skill.tier === 'assistant' ? (fusionLabel(skill) || skill.summary) : skill.summary}
                  cover={media.cover}
                  video={media.video}
                  poster={media.poster}
                  badge={availabilityLabel(skill)}
                  onOpen={() => onOpenSkill?.(skill.id)}
                />
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
}
