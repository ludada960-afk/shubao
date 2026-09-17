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
import { fusionLabel } from '../../skills/skillDirectory.js';

/* 历史一页给几条：够看清最近几次，又不至于一屏几十张卡 */
const HISTORY_PAGE_SIZE = 12;
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
  onHistoryDelete = null,
  onHistoryReuse = null,
  /* 整块嵌入的既有工作台（小红书图文 / 视频）。见 WorkbenchShell.panel 的说明：
     非空时页面变成「通栏」形态 —— 不再渲染通用字段与通用 CTA。 */
  panel = null,
  /* 历史为空时那句话要跟着页面形态变：通栏页面的按钮在上方的工作台里，不是"左边" */
  emptyHistoryHint = '',
  /* 交付清单：这条技能最终会交出哪几样东西（编号 + 名称 + 一句说明）。
     竞品实测（9-17 复核）：他们每个 skill 的示例区都是这样一份编号清单
     （「01 白底主图 02 品牌主视觉海报 …」），而不是一堆没有出处的图。
     对我们的套图/详情图这类技能，这份清单**由方案真源算出来**（随平台变），不是手写死的。 */
  deliverables = [],
  /* 一键解析（付费前置动作，见 WorkbenchShell 的说明） */
  parseAction = null,
}) {
  const skill = board === 'video' ? getVideoSkill(skillId) : getImageSkill(skillId);
  const [activeTab, setActiveTab] = useState('cases');
  const [lightbox, setLightbox] = useState(null);
  /* 历史分页：一次先给 12 条，多的收在「显示更多」后面（避免一屏几十张卡把页面拖垮） */
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE);

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
        /* 辅助能力：副标题说清"它长在哪"（fusionLabel 与 Hub 卡片、文档同一份口径）——
           用户从直达链接进来时必须第一眼知道：这不是一个能独立干完的活儿，
           而是某条主技能流程里的一步。 */
        subtitle={skill.tier === 'assistant' ? (fusionLabel(skill) || skill.summary) : skill.summary}
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
        panel={panel}
        parseAction={parseAction}
      >
        {activeTab === 'cases'
          ? (cases.length
            ? <div className="skill-workbench-grid">{cases.map((item, index) => (
                <CaseCard key={item.id || index} title={item.title || ''} subtitle={item.subtitle || ''} cover={item.cover || ''} video={item.video || ''} poster={item.poster || ''} before={item.before || ''} onOpen={() => setLightbox(index)} />
              ))}</div>
            : (Array.isArray(deliverables) && deliverables.length
              ? <>
                  <p className="skill-deliverable-lead">这个技能交付以下几样（示例图等你的案例补上）：</p>
                  <ol className="skill-deliverable-list">
                    {deliverables.map((item, index) => (
                      <li key={(item && item.name) || index}>
                        <span className="skill-deliverable-no">{String(index + 1).padStart(2, '0')}</span>
                        <span className="skill-deliverable-copy">
                          <strong>{item.name}</strong>
                          {item.hint && <small>{item.hint}</small>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              : <p className="media-workbench-empty">示例正在补充，先直接生成试试。</p>))
          : (historyList.length
            ? <>
                <div className="skill-workbench-grid">
                  {historyList.slice(0, historyLimit).map((item, index) => (
                    <div className="skill-history-item" key={item.id || index}>
                      <CaseCard
                        title={item.title || ''}
                        subtitle={item.subtitle || ''}
                        cover={item.cover || ''}
                        video={item.video || ''}
                        poster={item.poster || ''}
                        before={item.before || ''}
                        /* 还没出片的视频任务：角标写状态，别让人对着一张空卡猜 */
                        badge={item.badge || ''}
                        /* ⚠️ 没有可看的画面就不要开大图 —— 点开只有一张空白，
                           那是给用户挖坑（用户 9-17：「你自己先把坑踩完」）。 */
                        onOpen={(item.cover || item.video) ? () => setLightbox(index) : null}
                      />
                      {/* 历史条目要有操作：不然用户只能看着，删不掉、也回不到那组参数 */}
                      <div className="skill-history-actions">
                        {/* ⚠️ 没有可还原的参数就别放这个按钮：点了只会弹一句"无法还原"，
                            那不是操作，是坑（用户 9-17：「你自己先把坑踩完」）。
                            values / restore 二者有一个才认为这条记录能还原。 */}
                        {(item.values || item.restore) && <button type="button" className="skill-history-reuse" onClick={() => onHistoryReuse?.(item)}>用这组参数</button>}
                        <button type="button" className="skill-history-delete" onClick={() => onHistoryDelete?.(item)}>删除</button>
                      </div>
                    </div>
                  ))}
                </div>
                {historyList.length > historyLimit && (
                  <button type="button" className="skill-history-more" onClick={() => setHistoryLimit(limit => limit + HISTORY_PAGE_SIZE)}>
                    显示更多（还有 {historyList.length - historyLimit} 条）
                  </button>
                )}
              </>
            : <p className="media-workbench-empty">{emptyHistoryHint || <>这个技能还没有生成记录，左边配置好点「{ctaLabel}」就会存在这里</>}</p>)
        }
      </WorkbenchShell>
      {/* 用户批注：案例点击必须能放大查看并左右切换（他们做不到） */}
      {lightbox != null && (
        <div className="skill-workbench-lightbox" role="dialog" aria-modal="true" onMouseDown={event => { if (event.target === event.currentTarget) setLightbox(null); }}>
          <div className="skill-workbench-lightbox-body">
            <button type="button" className="skill-workbench-lightbox-nav is-prev" aria-label="上一张" onClick={() => setLightbox((lightbox - 1 + shown.length) % shown.length)}>‹</button>
            <figure>
              {/* 对照类案例在大图里也要保持"原图 → 成品"的读法（不然放大之后反而看不懂了） */}
              {shown[lightbox]?.before && shown[lightbox]?.cover
                ? <span className="skill-workbench-lightbox-compare">
                    <span><img src={shown[lightbox].before} alt="原图" /><em>原图</em></span>
                    <span><img src={shown[lightbox].cover} alt="成品" /><em>成品</em></span>
                  </span>
                : shown[lightbox]?.video
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
