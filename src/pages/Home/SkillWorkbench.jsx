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
import { groupHistoryByDay } from './mediaHistoryModel.js';
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
  /* 2026-09-28 批 DC 续-7：清单价与总额（`6 张 × 2 + 文案 0.5 = 12.5 积分`，见 skillBatchQuote） */
  ctaPriceNote = '',
  /* 主按钮上方的自定义控件区（2026-09-28 批 DC 续-7：放「同时出文案」那颗开关） */
  ctaExtra = null,
  ctaLabel = '立即生成',
  ctaDisabled = false,
  ctaHint = '',
  status = null,
  onGenerate = null,
  history = [],
  onHistoryDelete = null,
  onHistoryReuse = null,
  /* 批 BZ：下载（图片整组 / 视频成片）。没传就不渲染那颗按钮。 */
  onHistoryDownload = null,
  /* 批 CD：存到我的资产（把这条记录里的生成图收进资产库）。没传就不渲染那颗按钮。 */
  onHistorySaveAssets = null,
  /* 正在存的那条（页面传下来；组内每项据此显示"存入中…"并禁用，防连点） */
  historySavingId = '',
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
  /* 批 J-⑭：教学示例（弹窗三段式）。页面算好传下来，这里只做**透传** ——
     ⚠️ 这一层是**显式列 props** 的，漏一行就等于没传（本轮就踩了：按钮不出现）。 */
  tutorial = null,
  /* 只读清单块（照竞品「包含模块 已选 0/16」的形态，见 WorkbenchShell.sections 的说明）。
     它与 deliverables 分工不同：deliverables 进**右栏**（编号清单，替代还没有案例的示例区），
     sections 进**左栏**（是配置的一部分，比如 A+ 的 16 个模块）。 */
  sections = [],
  /* 一键解析（付费前置动作，见 WorkbenchShell 的说明） */
  parseAction = null,
  /* 字段旁的付费动作（AI生成卖点 / AI推荐风格分析…），见 WorkbenchShell.paidActions */
  paidActions = [],
  /* 单组标题：应用市场来的 app 页传「参数配置」（知渔那边左栏只有一个组头），内置页不传 */
  groupTitle = '',
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
  /* 批 CB：分页 + 按天分组。**分页先切、再分组**（不然"显示更多"会把某一整天的组切开跑掉）。
     ⚠️ `__index` 是这条记录在**完整历史里的下标** —— 灯箱（`shown`）与 `setLightbox` 都按它取图，
        分组之后如果改用组内下标，点第 2 组的第一张会打开第 1 组的图（图文不符那种坑）。 */
  const visibleHistory = useMemo(
    () => historyList.slice(0, historyLimit).map((item, index) => ({
      ...item,
      __index: index,
      /* 批 CD：这一条是否正在存进资产库（按钮显示"存入中…"并禁用） */
      saving: Boolean(historySavingId) && String(item.id || '') === String(historySavingId),
    })),
    [historyList, historyLimit, historySavingId],
  );
  const historyGroups = useMemo(() => groupHistoryByDay(visibleHistory), [visibleHistory]);
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
        ctaPriceNote={ctaPriceNote}
        ctaExtra={ctaExtra}
        ctaDisabled={ctaDisabled}
        ctaHint={ctaHint}
        status={status}
        onCta={() => onGenerate?.({ skillId: skill.id, values: current })}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        panel={panel}
        tutorial={tutorial}
        groupTitle={groupTitle}
        sections={sections}
        parseAction={parseAction}
        paidActions={paidActions}
      >
        {/* ═══ 示例页签：**先给编号交付清单，再给案例图** ═══════════════════════════════
           2026-09-18 批 F（用户批注 17）：「示例区是一份**编号清单**（01 白底主图 02 品牌主视觉海报…），
           不是一堆没出处的图。」
           我们改前是"有案例就只给图、没案例才给清单" —— 于是最该说清"这一套交什么"的
           套图（有 3 张案例）反而看不到清单。现在两样都给：清单在上（它是**交付契约**），
           案例图在下（案例是"长什么样"，不是"交什么"）。
           ⚠️ 2026-09-19 批 G 修：这里原来写的是**裸的块注释**（没有花括号包起来）——
              在 JSX children 位置上，裸块注释不是注释，是**文本节点**，会被原样渲染出来。
              实测：工作台右栏「示例」页签顶部直接显示了一整段 「/，—— 示例页签：……」的源码。
              现在包进表达式容器，才真的是注释。判据见 test/workbench-subpage-parity-0918 的 ⑤。 */}
        {activeTab === 'cases'
          ? <>
              {Array.isArray(deliverables) && deliverables.length > 0 && (
                <>
                  <p className="skill-deliverable-lead">
                    {cases.length ? '这一套按顺序交付以下几样（示例图在下面）：' : '这个技能交付以下几样（示例图等你的案例补上）：'}
                  </p>
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
              )}
              {/* ═══ 2026-09-19 批 Q-⑧：案例图改成**知渔那一档的方形示例卡** ═══════════════════════
                  CDP 实测知渔 skill 子页面的示例区（.tmp/qy-right-col.mjs）：
                    · 四列网格，每格 **247×247（正方形）**、间距 13；
                    · 每格左上角一枚**半透明白底胶囊角标**：编号 + 名称，字号 **12.576px/500**、
                      内边距 4.192px 8.384px、圆角 8；
                    · 卡片底色是浅灰（没图时就是一块干净的浅灰，不是"加载失败"的样子）。
                  我们原来是 4:3 卡 + 标题压在底部渐变上（那是**总页面**的卡片语言，用户已确认）。
                  子页面里的示例是"这一套交付长什么样"，形态跟知渔走：方卡 + 左上角角标。
                  ⚠️ 没有案例图的那几条仍然如实写「示例补充中」，不放假图。 */}
              {cases.length
                ? <ol className="skill-example-grid">{cases.map((item, index) => (
                    <li key={item.id || index}>
                      <button type="button" className="skill-example-tile" onClick={() => setLightbox(index)}>
                        {item.cover || item.video
                          ? <span className="skill-example-media">
                              {item.video ? <video src={item.video} poster={item.poster || ''} muted loop playsInline preload="metadata" /> : <img src={item.cover} alt="" loading="lazy" />}
                            </span>
                          : <span className="skill-example-media is-empty">示例补充中</span>}
                        <span className="skill-example-tag">{item.title || '示例'}</span>
                      </button>
                    </li>
                  ))}</ol>
                : (!deliverables.length ? <p className="media-workbench-empty">示例正在补充，先直接生成试试。</p> : null)}
            </>
          : (historyList.length
            ? <>
                {/* ═══ 2026-09-26 批 BZ：保留期说在**看得见这条流的地方** ═══════════════════════
                    用户问过："作品保留 7 天"这条现在只写在「我的作品」工作区里，
                    而生成结果真正被翻看的地方是**这条技能的历史** —— 两边不一致，
                    用户在这里看到记录消失会不知道发生了什么。服务端保留期就是 7 天（ASSET_RETENTION_DAYS）。
                    ⚠️ 这句是**事实陈述**，不是我编的口号：改了服务端保留期就得改这里（门禁钉着）。 */}
                <p className="skill-history-retention" role="note">生成记录保留 7 天，要留的请及时下载。</p>
                {/* ═══ 批 CB：按天分组（今天 / 昨天 / 更早）═══════════════════════════════════════════
                    用户口径：「它的**排版**……是不是也得加进去呢？我们现在这个我的资产还有画布里面的
                    新建画布功能他们那里其实已经做过很多相关的一些 UI 或者交互方面的设计了」——
                    分组照**画布库**来（它是站内已经做过的那一套），组标题在网格里跨列。
                    ⚠️ **不做"全部/图片/视频"的类型筛选**：这条历史是按技能筛的，单类型列表里没意义
                      （用户上一轮点出来的正是这一点）。 */}
                {historyGroups.map(group => (
                  <React.Fragment key={group.key}>
                    <p className="skill-history-date">{group.label}</p>
                    <div className="skill-workbench-grid">
                      {group.items.map(row => (
                        <div className={'skill-history-item' + (row.expired ? ' is-expired' : '')} key={row.id || row.__index}>
                          {/* ═══ 批 CA：到期墓碑 = **灰卡** ═══════════════════════════════════════════
                              用户口径：「你留下一张灰卡 + 已过期这个会影响服务器内存吗」——
                              成本已经量过（一条 <1KB 的记录，图片文件早被回收），这里就按"灰卡"渲染：
                              说清"它过期了、文件已清理"，并且**不给**还原/下载/看大图（点了没反应就是坑）。
                              有成品的老记录走原来的 CaseCard，一个字都没动。 */}
                          {row.expired ? (
                            <div className="skill-history-tombstone" role="note">
                              <span className="skill-history-tombstone-mark" aria-hidden="true">已过期</span>
                              <strong>{row.title || '生成记录'}</strong>
                              <small>{row.expiredNote || '这条记录已过期，图片文件已清理。'}</small>
                            </div>
                          ) : (
                            <CaseCard
                              title={row.title || ''}
                              subtitle={row.subtitle || ''}
                              cover={row.cover || ''}
                              video={row.video || ''}
                              poster={row.poster || ''}
                              before={row.before || ''}
                              /* 还没出片的视频任务：角标写状态，别让人对着一张空卡猜 */
                              badge={row.badge || ''}
                              /* ⚠️ 没有可看的画面就不要开大图 —— 点开只有一张空白，
                                 那是给用户挖坑（用户 9-17：「你自己先把坑踩完」）。 */
                              onOpen={(row.cover || row.video) ? () => setLightbox(row.__index) : null}
                            />
                          )}
                          {/* ═══ 2026-09-27 批 DC（M2）：**篇标记** ═══════════════════════════════════
                              一次生成 = 一篇（这一篇的 N 张都在同一张卡里，下载/存到资产也是整篇一起）。
                              这行写出这一篇的手法骨架：用户一眼认得出"这是我那篇出海的"，
                              而不是一堆只写着"3 张 · 时间"的同款卡。
                              ⚠️ 只有带篇标记的记录才有这一行（其余技能的历史一个字没变）。 */}
                          {row.piece && (
                            <p className="skill-history-piece">
                              本篇 {row.piece.size} 种手法 · {row.piece.shots.join(' / ')}
                            </p>
                          )}
                          {/* 历史条目要有操作：不然用户只能看着，删不掉、也回不到那组参数 */}
                          <div className="skill-history-actions">
                            {/* ⚠️ 没有可还原的参数就别放这个按钮：点了只会弹一句"无法还原"，
                                那不是操作，是坑（用户 9-17：「你自己先把坑踩完」）。
                                values / restore 二者有一个才认为这条记录能还原。 */}
                            {(row.values || row.restore) && <button type="button" className="skill-history-reuse" onClick={() => onHistoryReuse?.(row)}>用这组参数</button>}
                            {/* ⚠️ 批 BZ：**没有可下载的东西就不放这颗按钮**（同一条规矩）——
                                出片失败/还没有结果的那种记录，放一个点了没反应的下载是坑。 */}
                            {(row.cover || row.video || (Array.isArray(row.downloads) && row.downloads.length))
                              && <button type="button" className="skill-history-download" onClick={() => onHistoryDownload?.(row)}>下载</button>}
                            {/* ═══ 批 CD：存到我的资产 ═══════════════════════════════════════════════
                                用户问的「是不是会有……**导入到我的资产**里面的功能？」。
                                ⚠️ 只对**有生成图**的记录给（存的是一张张图）；过期墓碑不给（文件已回收）；
                                   正在存的那条显示"存入中…"并禁用，防连点堆重复素材。 */}
                            {!row.expired && (row.cover || (Array.isArray(row.downloads) && row.downloads.some(Boolean)))
                              && <button type="button" className="skill-history-save" disabled={row.saving === true}
                                onClick={() => onHistorySaveAssets?.(row)}>{row.saving === true ? '存入中…' : '存到资产'}</button>}
                            <button type="button" className="skill-history-delete" onClick={() => onHistoryDelete?.(row)}>删除</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </React.Fragment>
                ))}
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
