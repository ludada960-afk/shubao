import React from 'react';

/* ═══ WorkbenchShell：Skill 工作台骨架（图片/视频两板块共用）═══════════════════════
   来源：docs/design/43-media-architecture.md §3.1 与 §10.2（知渔实测结构）。
   实测结构（小红书爆款复刻那一页）：左「参数配置」+右「作品示例」，
   左栏底部一个 CTA（✨ 立即生成）；字段名极简（「比例」「清晰度」），必填打 *。
   用户批注（图 #13）：右侧案例 hover 放大、**点击必须能弹窗放大并左右切换**
   （他们做不到，明确要求我们做到）；右侧除了示例还要有「历史」页签。
   本组件是工作台的**唯一骨架**：两个板块的 skill 页都必须用它，
   字段一律经 FieldRenderer 渲染，页面里不许再手写控件。 */
export default function WorkbenchShell({
  title = '',
  subtitle = '',
  category = '',
  onBack = null,
  fields = [],
  values = {},
  onFieldChange = () => {},
  disabled = false,
  ctaLabel = '立即生成',
  ctaPoints = null,
  ctaDisabled = false,
  /* 按钮为什么不能点，要写在按钮旁边（就近），而不是让用户自己猜 */
  ctaHint = '',
  onCta = null,
  tabs = null,
  activeTab = 'cases',
  onTabChange = () => {},
  children = null,
  historyEmpty = '还没有生成记录',
  /* 运行态（进度 / 结果 / 就近错误）挂在右栏页签**上方**：
     生成是这个页面最主要的动作，结果不能藏在页签里。 */
  status = null,
  /* 一键解析（照竞品做法）：付费前置动作，放在字段区**上方** —— 用户先上传商品图，
     解析完字段自动填好，再改细节。价格必须写在按钮上（扣费动作不许让人猜多少钱）。
     ⚠️ 只能由用户手势触发：这里是 onClick，页面侧那条链路也必须挂在手势上
        （由 test/charge-requires-confirmation 守着）。 */
  parseAction = null,
  /* ═══ panel：整块嵌入的既有工作台（小红书图文 / 视频）═══════════════════════════
     用户 9-17 口径：「生成结果直接在工作台里面展示，不必像之前一样生成完就一定要跳进去画布」。
     小红书图文与视频这两条链路**各自已有跑通的完整工作台**（分步确认、方案弹窗、任务轮询），
     重写一遍只会做出半成品，所以做法是**把那个组件整块搬进这一页** ——
     本组件因此多出一个「通栏」形态：
       · 不再渲染通用字段栏（该链路的参数控件就在它自己的工作台里，重复一套只会互相打架）；
       · 也不再渲染通用 CTA（生成按钮同样在它自己的工作台里，两个 CTA 会让人不知道按哪个）；
       · 只保留页头（返回 + 技能名）、被嵌入的工作台、以及右侧状态与「示例 / 历史」页签。
     panel 为空时布局与从前**完全一致**（两个板块的其余技能都走那条路）。 */
  panel = null,
}) {
  const tabList = tabs || [{ key: 'cases', label: '示例' }, { key: 'history', label: '历史' }];
  const embedded = Boolean(panel);
  return (
    <section className={`media-workbench${embedded ? ' is-embedded-flow' : ''}`}>
      {embedded ? (
        <>
          <div className="media-workbench-left is-head-only">
            {onBack && <button type="button" className="media-workbench-back" onClick={onBack}>← 返回创作</button>}
            {(category || title) && (
              <header className="media-workbench-head">
                {category && <span className="media-workbench-category">{category}</span>}
                {title && <h2>{title}</h2>}
                {subtitle && <p>{subtitle}</p>}
              </header>
            )}
          </div>
          <div className="media-workbench-panel">{panel}</div>
        </>
      ) : (
        <div className="media-workbench-left">
          {onBack && <button type="button" className="media-workbench-back" onClick={onBack}>← 返回创作</button>}
          {(category || title) && (
            <header className="media-workbench-head">
              {category && <span className="media-workbench-category">{category}</span>}
              {title && <h2>{title}</h2>}
              {subtitle && <p>{subtitle}</p>}
            </header>
          )}
          {parseAction && (
            <button
              type="button"
              className={`media-workbench-parse${parseAction.busy ? ' is-busy' : ''}`}
              disabled={disabled || parseAction.busy || parseAction.disabled}
              onClick={() => parseAction.onRun?.()}
            >
              <span>{parseAction.busy ? '正在解析…' : (parseAction.label || '一键解析')}</span>
              {parseAction.points != null && <em>{parseAction.points} 积分</em>}
            </button>
          )}
          {parseAction?.hint && <p className="media-workbench-parse-hint">{parseAction.hint}</p>}
          <div className="media-workbench-fields">
            {fields.map(field => (
              <FieldSlot key={field.key} field={field} value={values[field.key]} onChange={onFieldChange} disabled={disabled} />
            ))}
          </div>
          <div className="media-workbench-cta">
            <button type="button" className="media-workbench-submit" disabled={disabled || ctaDisabled} onClick={() => onCta?.()}>
              {ctaLabel}
            </button>
            {ctaPoints != null && <span className="media-workbench-points">{ctaPoints} 积分</span>}
          </div>
          {ctaHint && <p className="media-workbench-cta-hint">{ctaHint}</p>}
        </div>
      )}
      <div className="media-workbench-right">
        {status}
        <div className="media-workbench-tabs" role="tablist">
          {tabList.map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={activeTab === tab.key ? 'is-active' : ''}
              onClick={() => onTabChange(tab.key)}
            >{tab.label}</button>
          ))}
        </div>
        <div className="media-workbench-pane" role="tabpanel">
          {activeTab === 'history' && !children ? <p className="media-workbench-empty">{historyEmpty}</p> : children}
        </div>
      </div>
    </section>
  );
}

/* 字段走统一渲染器（同目录 FieldRenderer）；这里单独包一层只是为了少一次 import 往返。 */
import FieldRenderer from './FieldRenderer.jsx';
function FieldSlot({ field, value, onChange, disabled }) {
  return <FieldRenderer field={field} value={value} disabled={disabled} onChange={next => onChange(field.key, next)} />;
}
