import React, { useMemo } from 'react';

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
import '../../components/media/CaseCard.css';
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
    for (const skill of config.skills) {
      if (!map.has(skill.category)) { map.set(skill.category, []); order.push(skill.category); }
      map.get(skill.category).push(skill);
    }
    return order.map(category => ({ category, skills: map.get(category) }));
  }, [config]);

  return (
    <section className="media-hub" data-board={board}>
      <header className="media-hub-head">
        <div>
          <h1>{config.title}</h1>
          <p>{config.hint}</p>
        </div>
      </header>
      {groups.length === 0 && <p className="media-hub-empty">{emptyHint || '暂时没有可用的技能'}</p>}
      {groups.map(group => (
        <section className="media-hub-group" key={group.category}>
          <h2>{group.category}</h2>
          <div className="media-hub-grid">
            {group.skills.map(skill => (
              <CaseCard
                key={skill.id}
                title={skill.name}
                cover={skill.cases?.[0]?.cover || ''}
                video={skill.cases?.[0]?.video || ''}
                badge={skill.availability === 'blocked' ? '即将上线' : (skill.availability === 'needs_ref' ? '需参考素材' : '')}
                onOpen={() => onOpenSkill?.(skill.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}
