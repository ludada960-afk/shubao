import React, { useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { availabilityLabel, coverOf } from '../../skills/skillDirectory.js';
import './SkillEntryRow.css';

/* ═══ SkillEntryRow：技能入口按钮行（首页两个板块共用）════════════════════════════════
   用户 9-17 口径（原话）：「把它们做成案例给做进去，就是**按钮**的形式，然后鼠标放到这些按钮上，
   它就会有那种**预览框**，然后用户点击这些按钮就会直接进入到他们对应的 Skill 页面里面去。」

   所以这一条与总页面里的**卡片网格**是两种呈现、**同一份数据**（skillDirectory.featuredSkills）：
     · 卡片网格（Hub）：4:3 大卡、封面铺满、标题压在白渐变上 —— 用来"逛"；
     · 按钮行（首页）：一排药丸按钮 + 悬停预览浮层 —— 用来"快速挑一个开始"。
   两条都指向同一个地址（skillPath），点进去都是那条技能的子页面。

   ⚠️ 与竞品的差别只有一处、且是更省的做法：他们的按钮行只放**已经跑出案例**的技能；
      我们允许没有案例的技能也出现在按钮行里（悬停时如实写"案例补充中"）——
      否则视频板块在案例补齐之前会一条入口都没有（那才是真的不能看）。 */
export default function SkillEntryRow({
  board = 'image',
  title = '精选推荐',
  hint = '鼠标放上去看案例，点一下直接开始',
  skills = [],
  onOpenSkill = null,
  moreHref = '',
  moreLabel = '',
}) {
  const [activeId, setActiveId] = useState('');
  const list = Array.isArray(skills) ? skills : [];
  if (!list.length) return null;
  const active = list.find(skill => skill.id === activeId) || null;

  return (
    <section className="skill-entry-row" data-board={board} aria-label={title}>
      <header className="skill-entry-head">
        <h2>{title}</h2>
        <p>{hint}</p>
        {moreHref && <a className="skill-entry-more" href={moreHref}>{moreLabel || '查看全部'}<ArrowRight size={13} /></a>}
      </header>

      <div className="skill-entry-list">
        {list.map(skill => {
          const preview = coverOf(skill);
          const flag = availabilityLabel(skill);
          const open = activeId === skill.id;
          return (
            <div
              className="skill-entry-item"
              key={skill.id}
              onMouseEnter={() => setActiveId(skill.id)}
              onMouseLeave={() => setActiveId(current => (current === skill.id ? '' : current))}
            >
              <button
                type="button"
                className={`skill-entry-button${open ? ' is-open' : ''}`}
                aria-expanded={open}
                aria-describedby={open ? 'skill-entry-preview-' + skill.id : undefined}
                onFocus={() => setActiveId(skill.id)}
                onBlur={() => setActiveId(current => (current === skill.id ? '' : current))}
                onKeyDown={event => { if (event.key === 'Escape') setActiveId(''); }}
                onClick={() => onOpenSkill?.(skill)}
              >
                <span className="skill-entry-name">{skill.name}</span>
                {/* 可用性如实标注：跑不通的不许装作能用（声明源的 availability 就是判据） */}
                {flag && <span className="skill-entry-flag">{flag}</span>}
              </button>

              {open && (
                <div className="skill-entry-preview" id={'skill-entry-preview-' + skill.id} role="tooltip">
                  <span className="skill-entry-preview-media">
                    {preview.video
                      ? <video src={preview.video} poster={preview.poster || preview.cover || undefined} muted loop playsInline autoPlay preload="metadata" />
                      : preview.cover
                        ? <img src={preview.cover} alt={skill.name} loading="lazy" />
                        : <span className="skill-entry-preview-blank"><Play size={15} />案例补充中</span>}
                  </span>
                  <span className="skill-entry-preview-copy">
                    <strong>{skill.name}</strong>
                    <small>{skill.summary}</small>
                    <em>进入这条技能<ArrowRight size={12} /></em>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 移动端/触屏没有 hover：点到按钮就直接进子页面（预览只是桌面上的加速器，不是必经步骤） */}
      <p className="skill-entry-tip">{active ? active.name + ' · ' + active.summary : ''}</p>
    </section>
  );
}
