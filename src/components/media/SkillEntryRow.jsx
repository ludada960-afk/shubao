import React, { useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { availabilityLabel, coverOf } from '../../skills/skillDirectory.js';
import './SkillEntryRow.css';

/* ═══ SkillEntryRow：精选技能卡片行（首页两个板块共用）════════════════════════════════
   形态依据 = 用户 2026-09-18 批注 4 / 5（点名照抄 flova.tv 的 skill 卡）：
     原话「人家其实是前面有一个小封面，然后后面就是他的文字描述，然后他的按钮做的是很大的」
          「你看鼠标放上去，它是有一个试一试出现，然后后面有一个毛玻璃遮罩这样的动态UI变化」
          「下面的这些预览窗里面视频它是真的会自己加载动起来的……点击上面那个试一试那个按钮的时候，
            它是真的会进入到相关的子页面里面去」
   所以这一版把 9-17 那个「一排药丸按钮 + 悬停浮层」换成**大卡片**：
     · 封面（有视频就先播视频，静音循环、进视口即播）→ 名称 → 一句描述 → 大 CTA；
     · 悬停/聚焦：封面上盖一层毛玻璃遮罩 + 「试一试」大按钮（flova 同款交互）；
     · 点卡片任意处或 CTA 都进**同一条技能的子页面**（地址算法只有 skillDirectory.skillPath 一份）。
   ⚠️ 数据源与总页面网格、左侧导航完全同一份（featuredSkills / skillPath），三处不许各写一套。
   ⚠️ 没有案例的技能照旧出现在这里（封面上如实写"案例补充中"）——
      否则视频板块在用户跑出案例之前会一条入口都没有。 */
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
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
        {moreHref && <a className="skill-entry-more" href={moreHref}>{moreLabel || '查看全部'}<ArrowRight size={14} /></a>}
      </header>

      <div className="skill-entry-list">
        {list.map(skill => {
          const preview = coverOf(skill);
          const flag = availabilityLabel(skill);
          const open = activeId === skill.id;
          return (
            <article
              className={'skill-entry-card' + (open ? ' is-open' : '')}
              key={skill.id}
              onMouseEnter={() => setActiveId(skill.id)}
              onMouseLeave={() => setActiveId(current => (current === skill.id ? '' : current))}
            >
              <button
                type="button"
                className="skill-entry-open"
                aria-label={skill.name + ' · 试一试'}
                onFocus={() => setActiveId(skill.id)}
                onBlur={() => setActiveId(current => (current === skill.id ? '' : current))}
                onClick={() => onOpenSkill?.(skill)}
              >
                <span className="skill-entry-cover">
                  {preview.video ? (
                    <video
                      src={preview.video}
                      poster={preview.poster || preview.cover || undefined}
                      muted
                      loop
                      playsInline
                      autoPlay
                      preload="metadata"
                    />
                  ) : preview.cover ? (
                    <img src={preview.cover} alt="" loading="lazy" />
                  ) : (
                    <span className="skill-entry-blank"><Play size={16} />案例补充中</span>
                  )}
                  {/* 悬停毛玻璃遮罩 + 大按钮（flova 同款）：这是"试一试"的入口 */}
                  <span className="skill-entry-veil" aria-hidden="true">
                    <span className="skill-entry-try">试一试<ArrowRight size={15} /></span>
                  </span>
                  {flag && <span className="skill-entry-flag">{flag}</span>}
                </span>
                <span className="skill-entry-copy">
                  <strong>{skill.name}</strong>
                  <small>{skill.summary}</small>
                </span>
              </button>
            </article>
          );
        })}
      </div>

      {/* 触屏没有 hover：卡片本身就是入口（悬停只是桌面上的加速器，不是必经步骤） */}
      <p className="skill-entry-tip">{active ? active.name + ' · ' + active.summary : ''}</p>
    </section>
  );
}
