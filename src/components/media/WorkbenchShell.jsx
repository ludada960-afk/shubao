import React from 'react';

/* ═══ WorkbenchShell：Skill 工作台骨架（图片/视频两板块共用）═══════════════════════
   来源：docs/design/43-media-architecture.md §3.1 与 §10.2（知渔实测结构）。
   实测结构（小红书爆款复刻那一页）：左「参数配置」+右「作品示例」，
   左栏底部一个 CTA（✨ 立即生成）；字段名极简（「比例」「清晰度」），必填打 *。
   用户批注（图 #13）：右侧案例 hover 放大、**点击必须能弹窗放大并左右切换**
   （他们做不到，明确要求我们做到）；右侧除了示例还要有「历史」页签。
   本组件是工作台的**唯一骨架**：两个板块的 skill 页都必须用它，
   字段一律经 FieldRenderer 渲染，页面里不许再手写控件。 */
/* ═══ 2026-09-18 批 F：左栏按**分组**排（照竞品实测结构）══════════════════════════════
   竞品工作台的左栏是分块的：基础信息 / 上传图片 → 目标市场 → 产品卖点与设计风格 →
   套图结构配置，每块有一个小标题，块与块之间一条浅分割线。
   我们原来是**一条平铺的字段流** —— 十几个字段从上排到底，用户看不出"这几格是一件事"。
   分组从哪来：声明源里每个 field 写一个 group 名（不写就落在"默认组"），
   本组件按**字段出现的先后**决定组的先后（不是另写一张顺序表 —— 那会有第二份真相）。 */
function groupFields(fields) {
  const order = [];
  const map = new Map();
  for (const field of fields) {
    const name = field.group || '';
    if (!map.has(name)) { map.set(name, []); order.push(name); }
    map.get(name).push(field);
  }
  return order.map(name => ({ name, fields: map.get(name) }));
}

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
  /* ═══ sections：只读清单块（照竞品「包含模块 已选 0/16」的形态）═════════════════
     竞品 A+ 页有一块 16 个**可勾选**模块；我们的张数与报价由方案算死，
     照抄成可勾选会让报价与产出对不上（RTK 批次三十六已定性）。
     所以同一份清单做成**只读**：每条前面一个勾，标题后面写「已选 N/N」——
     用户看到的是"这一套会交出哪几样、全都交"，而不是一个会改价钱的开关。
     形态：{ key, title, note, items: [{ name, hint }] } */
  sections = [],
  /* ═══ paidActions：字段旁的付费动作（照竞品实测）═════════════════════════════════
     竞品工作台里有三颗**明码标价**的按钮长在字段旁边：
       · 一键解析 · 0.20 积分（解析商品图 → 自动填卖点）
       · AI生成 · 0.10 积分/张（帮写卖点）
       · AI推荐风格分析 · 0.10 积分（分析参考图，推荐风格）
     他们的口径与我们一致：付费动作写清价钱、点一下才扣。所以这几颗按**同一形态**收进来，
     通过 actions 参数渲染（array of { key, label, points, onRun, runnable, reason, busy }）。
     ⚠️ 没接通的**不许渲染成按钮**：传 runnable:false + reason，界面如实写清为什么不能点 ——
        给一个点了没反应的付费按钮比不给更糟（本项目铁律）。 */
  paidActions = [],
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
          {paidActions.length > 0 && (
            <div className="media-workbench-paid-actions">
              {paidActions.map(action => (action.runnable ? (
                /* 2026-09-19 批 G：每颗按钮下面多一行 note —— 它写两件事：
                   这颗按钮**会做什么**（点之前就看得见），以及**买到手的结论**
                   （例如风格分析出的那个风格名，常驻在这里，不是一闪而过的 toast）。
                   付费动作的产物必须留在页面上，否则用户付了钱只看到一个 toast。 */
                <div className="media-workbench-paid-item" key={action.key || action.label}>
                  <button
                    type="button"
                    className={'media-workbench-paid' + (action.busy ? ' is-busy' : '')}
                    disabled={disabled || action.busy || action.disabled}
                    onClick={() => action.onRun?.()}
                  >
                    <span>{action.busy ? (action.busyLabel || '处理中…') : action.label}</span>
                    {action.points != null && <em>{action.points} 积分</em>}
                  </button>
                  {action.note && <small className="media-workbench-paid-note">{action.note}</small>}
                </div>
              ) : (
                <span className="media-workbench-paid is-off" key={action.key || action.label} title={action.reason || ''}>
                  <span>{action.label}</span>
                  {action.points != null && <em>{action.points} 积分</em>}
                  <small>{action.reason || '暂未开放'}</small>
                </span>
              )))}
            </div>
          )}
          {groupFields(fields).map(group => (
            <section className="media-workbench-group" key={group.name || 'default'}>
              {group.name && <h3 className="media-workbench-group-title">{group.name}</h3>}
              <div className="media-workbench-fields">
                {group.fields.map(field => (
                  <FieldSlot key={field.key} field={field} value={values[field.key]} values={values} onChange={onFieldChange} disabled={disabled} />
                ))}
              </div>
            </section>
          ))}
          {sections.map(section => {
            /* ═══ 可勾选的清单块（2026-09-19 批 I-9，用户批注 #10 / #3-2）═══════════════════════
               用户原话：「这些按钮都是不能点击的，完全是死按钮……你连按钮都没法交互，
                 那背后的生成逻辑肯定也是没打通的呀，要彻底的打通逻辑呀。」
               以及：「选中多少个模块就是多少张，并且对应他自己的模块主题不是吗，
                 为什么要自己写多少张的数量呢？」
               ⚠️ 只有调用方**显式声明 selectable** 才渲染成可勾选 ——
                  其余清单块（历史上那些真的只读的）行为一个字不变。 */
            const selectable = section.selectable === true;
            const checkedCount = selectable
              ? section.items.filter(item => item.checked !== false).length
              : section.items.length;
            return (
              <section className={'media-workbench-group media-workbench-checklist' + (selectable ? ' is-selectable' : '')} key={section.key || section.title}>
                <h3 className="media-workbench-group-title">
                  {section.title}
                  <span className="media-workbench-checklist-count">已选 {checkedCount}/{section.items.length}</span>
                </h3>
                {section.note && <p className="media-workbench-group-note">{section.note}</p>}
                <ul className="media-workbench-checklist-items">
                  {section.items.map(item => {
                    const on = item.checked !== false;
                    if (!selectable) {
                      return (
                        <li key={item.name}>
                          <span className="media-workbench-checklist-check" aria-hidden="true">✓</span>
                          <span className="media-workbench-checklist-copy">
                            <strong>{item.name}</strong>
                            {item.hint && <small>{item.hint}</small>}
                          </span>
                        </li>
                      );
                    }
                    return (
                      <li key={item.name}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          className={'media-workbench-checklist-toggle' + (on ? ' is-on' : '')}
                          onClick={() => section.onToggle?.(item.name)}
                        >
                          <span className="media-workbench-checklist-check" aria-hidden="true">{on ? '✓' : ''}</span>
                          <span className="media-workbench-checklist-copy">
                            <strong>{item.name}</strong>
                            {item.hint && <small>{item.hint}</small>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
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
function FieldSlot({ field, value, onChange, disabled, values }) {
  return <FieldRenderer field={field} value={value} values={values} disabled={disabled} onChange={next => onChange(field.key, next)} />;
}
