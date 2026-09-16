import React, { useMemo, useState } from 'react';

/* ═══ SkillWorkbench：Skill 工作台页面（图片 / 视频两个板块共用）═══════════════════
   依据 docs/design/43-media-architecture.md §3.1 / §5 与 §10.2（知渔实测结构）。
   实测结构：左「参数配置」+ 右「作品示例 / 历史」；左栏底部一个 CTA；字段名极简、必填打 *。
   用户批注（图 #13）：右侧案例 hover 放大、**点击必须能弹窗放大并左右切换**（他们做不到，我们要做到）。
   本组件**只做渲染与交互**：字段来自 Skill 声明，控件由 FieldRenderer 统一渲染，
   案例由 CaseCard 渲染 —— 页面里不许再手写任何配置控件。 */
import { getImageSkill } from '../../skills/imageSkills.js';
import { getVideoSkill } from '../../skills/videoSkills.js';
import { initialSkillValues } from '../../skills/skillRun.js';
import WorkbenchShell from '../../components/media/WorkbenchShell.jsx';
import CaseCard from '../../components/media/CaseCard.jsx';
import '../../components/media/WorkbenchShell.css';
import '../../components/media/CaseCard.css';
import './SkillWorkbench.css';

export default function SkillWorkbench({
  board = 'image',
  skillId = '',
  values = {},
  onFieldChange = () => {},
  onBack = null,
  ctaPoints = null,
  ctaLabel = '立即生成',
  ctaDisabled = false,
  ctaHint = '',
  status = null,
  onGenerate = null,
  history = [],
}) {
  const skill = board === 'video' ? getVideoSkill(skillId) : getImageSkill(skillId);
  const [activeTab, setActiveTab] = useState('cases');
  const [lightbox, setLightbox] = useState(null);

  /* 字段初始值来自声明源（skillRun.initialSkillValues）——与本页的下发参数同源 */
  const initial = useMemo(() => (skill ? initialSkillValues(skill) : {}), [skill]);
  const current = { ...initial, ...values };

  if (!skill) {
    return <section className="media-workbench-missing">没有找到这个技能（{board} / {skillId}）。</section>;
  }

  const cases = Array.isArray(skill.cases) ? skill.cases : [];
  const historyList = Array.isArray(history) ? history : [];
  /* ⚠️ 大图必须跟着**当前页签**取图：历史页签里点开"示例"的图，就是图文不符的 bug。 */
  const shown = activeTab === 'history' ? historyList : cases;

  return (
    <section className="skill-workbench" data-board={board}>
      <WorkbenchShell
        title={skill.name}
        subtitle={skill.summary}
        category={skill.category}
        onBack={onBack}
        fields={skill.fields}
        values={current}
        onFieldChange={onFieldChange}
        ctaLabel={ctaLabel}
        ctaPoints={ctaPoints}
        ctaDisabled={ctaDisabled}
        ctaHint={ctaHint}
        status={status}
        onCta={() => onGenerate?.({ skillId: skill.id, values: current })}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {activeTab === 'cases'
          ? (cases.length
            ? <div className="skill-workbench-grid">{cases.map((item, index) => (
                <CaseCard key={item.id || index} title={item.title || ''} cover={item.cover || ''} video={item.video || ''} onOpen={() => setLightbox(index)} />
              ))}</div>
            : <p className="media-workbench-empty">示例正在补充，先直接生成试试。</p>)
          : (historyList.length
            ? <div className="skill-workbench-grid">{historyList.map((item, index) => (
                <CaseCard key={item.id || index} title={item.title || ''} cover={item.cover || ''} video={item.video || ''} onOpen={() => setLightbox(index)} />
              ))}</div>
            : <p className="media-workbench-empty">还没有生成记录</p>)
        }
      </WorkbenchShell>
      {/* 用户批注：案例点击必须能放大查看并左右切换（他们做不到） */}
      {lightbox != null && (
        <div className="skill-workbench-lightbox" role="dialog" aria-modal="true" onMouseDown={event => { if (event.target === event.currentTarget) setLightbox(null); }}>
          <div className="skill-workbench-lightbox-body">
            <button type="button" className="skill-workbench-lightbox-nav is-prev" aria-label="上一张" onClick={() => setLightbox((lightbox - 1 + shown.length) % shown.length)}>‹</button>
            <figure>
              {shown[lightbox]?.video
                ? <video src={shown[lightbox].video} controls autoPlay muted />
                : <img src={shown[lightbox]?.cover || ''} alt={shown[lightbox]?.title || ''} />}
              <figcaption>{shown[lightbox]?.title || skill.name}</figcaption>
            </figure>
            <button type="button" className="skill-workbench-lightbox-nav is-next" aria-label="下一张" onClick={() => setLightbox((lightbox + 1) % shown.length)}>›</button>
            <button type="button" className="skill-workbench-lightbox-close" aria-label="关闭" onClick={() => setLightbox(null)}>×</button>
          </div>
        </div>
      )}
    </section>
  );
}
