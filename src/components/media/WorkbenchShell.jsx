import React, { useState } from 'react';
import { createPortal } from 'react-dom';
/* ⚠️ 批 Y：这一行是必须的 —— 组件原来一个 lucide 图标都没用（全是内联 SVG），
   加「怎么用这条技能」的图标入口时**差点漏掉 import**（漏了就是渲染期 ReferenceError → 整页白屏，
   正是本项目出过的 P0 那一类）。esbuild 只查语法、查不出这个，所以改完必跑渲染冒烟。 */
import { HelpCircle } from 'lucide-react';

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
function groupFields(fields, mergeTitle = '') {
  /* mergeTitle：把全部字段并进**一个**组（知渔的应用市场 app 页就是这样：左栏只有一个「参数配置」）。
     内置 ?tool= 页保持各自的分组名（基础信息 / 产品卖点与设计风格 / 套图结构配置 …）。 */
  if (mergeTitle) return [{ name: mergeTitle, fields }];
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
  /* 单组标题：应用市场来的那 28 条页面传「参数配置」（照知渔），内置页不传 */
  groupTitle = '',
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
  /* ═══ tutorial：教学示例（用户批注 image#1 的后半句）═══════════════════════════════════════
     用户原话：「他视频制作这边的子页面**绝大部分是有教学示例的**，你要**结合教学示例做深度匹配**，
     按他的讲解 + 工作台里真实有的按钮和功能去做规划和设计。」
     竞品实测形态（docs/design/59）：弹窗三段式 —— ① 顶部成片视频 ② 中部 SOP 全文 ③ 底部操作条。
     ⚠️ 我们**只放真东西**：媒体位只接受这条技能**真实存在的案例封面**；没有就如实写
        「教学示例还在制作中」，绝不放占位假视频/假图（本站铁律：生成结果一律不许伪造）。
     ⚠️ 文字块也不是编的：全部来自声明源（字段分组 / 交付清单 / 能力说明）。 */
  tutorial = null,
}) {
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const tabList = tabs || [{ key: 'cases', label: '示例' }, { key: 'history', label: '历史' }];
  const embedded = Boolean(panel);
  return (
    <section className={`media-workbench${embedded ? ' is-embedded-flow' : ''}`}>
      {embedded ? (
        <>
          {/* ═══ 2026-09-19 批 Q-⑥：嵌入形态（视频子页面）顶上的那一大块**照知渔收成一张紧凑信息卡** ═══
              用户批注（本轮，对着视频子页面）：「你不能把整体的东西往上面顶上去吗？」
                以及前面那轮：「这个就是他们没有的，你为什么会有这个部分呢？这部分要拿掉呀。」
              CDP 实测知渔的视频子页面（/apps?id=… 光线变化）左栏结构：
                ① 返回广场（一行，34 高）
                ② **信息卡 411x128**：缩略图 + 技能名 + 一句话说明 + 分类标签
                ③ 「参数配置」组（字段从这里开始）—— 内容区**从 y=73 就开始**，没有任何营销大标题。
              我们原来这一块是：怎么用这条技能 + 分类 + 24px 大标题 + 副标题 + 视频生成角标 +
                「把创意素材变成吸引人的短片」大标题 + 一句说明（实测把第一个字段推到了 **y=329**）。
              ⇒ 收成知渔那张卡（标题 + 一句说明 + 分类标签；我们**没有**技能缩略图，就不放假图），
                教学示例入口并进卡片右上角（门禁 test/skill-tutorial-0919 要求它必须存在）。 */}
          <div className="media-workbench-left is-head-only">
            {/* 2026-09-26 批 BW：**技能信息卡整块删除**（用户原话：「工作台它就是用来配置、
                用来输入提示词、用来删删改改的一个平台，不是用来写教程搞说明的」）。
                原来的三样（技能名 / 一句话说明 / 分类标签）在**顶栏**已经有 —— 技能名就是居中 H1，
                分类也在顶栏；这里不再重复一遍、也不再占一行高度。教学入口挪到右栏页签那一行。 */}
            <div className="media-workbench-panel">{panel}</div>
          </div>
        </>
      ) : (
        <div className="media-workbench-left">
          {/* ═══ 2026-09-19 批 O-⑪：**左栏顶部这一整块搬走**（照知渔）══════════════════════════
             用户第 19 轮批注（对着我们的商品套图页）：
               「然后你这两个为什么不是在上面呢？**你上面留白那么多，是要干嘛呢？**」
             实测：我们左栏从 y=92 开始，第一个内容块却在 **y=484** —— 上方空了 **392px**，
             被「技能名页头(82) + 怎么用这条技能(32) + 一键解析(39) + 解析说明(20) + 两块付费大卡(85)」占掉。
             知渔那一页左栏**直接从「基础信息」y=107 开始**（几乎贴顶），
               · 技能名在他们那儿是**顶栏里那个 H1**（居中，16.8px/500）；
               · 「怎么用这条技能」不在左栏，是独立入口；
               · 付费动作全部是**行内胶囊**（见上面 anchor 那段）。
             ⇒ 技能名/分类/一句话搬去顶栏（由 MediaCreation 的 subpage 顶栏承担，已是既有实现）。
                ⚠️ 「怎么用这条技能」这个**入口必须留着**（不是装饰）——
                   test/skill-tutorial-0919 守的就是"教学示例必须有工作台入口"；
                   我第一版把它跟页头一起删了，门禁当场报红。现在保留入口、只去掉页头。 */}
          {/* ═══ 2026-09-19 批 O-⑫：**「怎么用这条技能」从左栏移到顶栏那一行** ═══════════════════
             实测（50 条图片技能逐页量，.tmp/laoyu2/image-page-sweep.json）：
               左栏顶部空白 **gap=78px 全站统一** = padding-top 24 + 教学按钮 32 + grid gap 22；
               而知渔 ?tool=product-listing-set 是 **21px**（左栏 py-5 = 20px，内容紧跟其后）。
             根因就是这颗按钮占了一整行。知渔那一页它也不在左栏（是独立入口）。
             ⚠️ 门禁 test/skill-tutorial-0919 只要求**入口存在**（className + 文案 + 三段式弹层），
                没规定位置 —— 所以移动是合规的，功能一点没少：按钮与弹层仍在同一个组件里，
                只是渲染位置由 MediaCreation 的顶栏那一行承担（见那里的 media-workbench-tutorial is-topbar）。
             剩下 24+22 = **46px** 就是知渔那 20px 内边距 + 一个分组间距的同口径，不再压缩。 */}
          {/* ═══ 2026-09-19 批 O-⑪：「一键解析」不再独立成行 ═══════════════════════════════════
             用户第 19 轮批注：「你这些按钮的布局还有规划都完全不一样呀。」
             实测知渔：这颗是**行内小胶囊**，落在「产品卖点与设计风格」这一组的**标题行右端**
               （「一键解析 · 0.20 积分」，190×34，描边 0.8、透明底、胶囊圆角），
               而不是像我们原来那样：一整行按钮 + 一整行说明 + 两条 85 高的大卡，把左栏顶上撑出 390px 空白。
             下面 renderGroupTitle() 会把它渲染进对应分组的标题行。 */}
          {paidActions.filter(a => !a.anchor).length > 0 && (
            <div className="media-workbench-paid-actions">
              {paidActions.filter(a => !a.anchor).map(action => (action.runnable ? (
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
          {groupFields(fields, groupTitle).map((group, index) => (
            <section className="media-workbench-group" key={group.name || 'default'}>
              {/* ⚠️ 批 O-⑫：标题行在**第一组**即使没有组名也要渲染 ——
                  教学示例入口与一键解析都落在这里；若挂在 group.name 条件里，
                  第一条技能（如「中文海报」的第一个分组没有组名）就会**两颗按钮都不出现**。
                  实测踩到：按钮从 DOM 里彻底消失，skill-tutorial-0919 门禁当场报红。 */}
              {(group.name || index === 0) && (
                <h3 className="media-workbench-group-title">
                  {group.name && <span>{group.name}</span>}
                  {/* ═══ 批 O-⑫：**第一组的标题行右端**放两颗动作 ═══════════════════════════════════
                      · 教学示例入口（从左栏顶部搬来 —— 它原来占一整行，实测全站统一多出 54px 空白：
                        按钮 32 + grid gap 22；知渔那页左栏内容几乎贴顶，是 21px）
                      · 一键解析（批 O-⑪ 从"整行按钮+整行说明"搬来）
                      ⚠️ 门禁 test/skill-tutorial-0919 只要求入口存在（类名 + 文案 + 三段式弹层），
                         不规定位置；弹层与数据一个字没动，只是渲染位置变了。 */}
                  {/* ═══ 2026-09-19 批 Q：**左栏第一行只留组名**（照知渔）══════════════════════════
                      用户批注 #2-4（框选我们左栏顶上那一行）：「你看这个就是他们没有的，你为什么会有这个部分呢？
                        这部分要拿掉呀。」
                      知渔实测：左栏第一行就是「基础信息」四个字，没有任何按钮（一键解析在**产品卖点与设计风格**
                        那一行，教学示例不在左栏）。
                      ⇒ 「怎么用这条技能」不再渲染进左栏（它在**顶栏**那一行已经是既有实现：
                        MediaCreation 的 media-workbench-tutorial is-topbar，功能一点没少，
                        门禁 test/skill-tutorial-0919 只要求入口存在）；
                        一键解析落到**它声明的那个分组**（parseAction.group），不再一律挤在第一组。 */}
                  {tutorial && index === 0 && null}
                  {parseAction && (parseAction.group ? group.name === parseAction.group : index === 0) && (
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
                </h3>
              )}
              <div className="media-workbench-fields">
                {group.fields.map(field => {
                  /* ═══ 2026-09-19 批 O-⑪：付费动作**贴着字段标签右端**（照知渔的形态）═══════════
                     用户第 19 轮批注（对着我们的商品套图页）原话：
                       「你这些按钮的布局还有规划都完全不一样呀。」
                       「然后你这两个为什么不是在上面呢？你上面留白那么多，是要干嘛呢？」
                     实测知渔 ?tool=product-listing-set：
                       「产品卖点」这一行的**右端**并排两颗**行内小胶囊**「放大」「AI生成 · 0.10 积分/张」
                       （y 与字段标签同高，167×29，透明底、无边框、字号 12.6）。
                     我们原来把付费动作做成**两块 254×85 的大卡**、独立成行、离字段很远 —— 就是"布局完全不一样"。
                     ⇒ 动作声明里带 anchor（字段 key）时，渲染进那个字段的标签行；
                        不带 anchor 的仍旧走下面那条老路（其余页面行为不变）。 */
                  const anchored = paidActions.filter(a => a.anchor === field.key);
                  const label = (
                    <span className="media-field-label">
                      {field.label}{field.required && <b aria-hidden="true">*</b>}
                      {anchored.length > 0 && (
                        <span className="media-field-inline-actions">
                          {anchored.map(action => (action.runnable ? (
                            <button
                              key={action.key || action.label}
                              type="button"
                              className={'media-workbench-inline-action' + (action.busy ? ' is-busy' : '')}
                              disabled={disabled || action.busy || action.disabled}
                              onClick={() => action.onRun?.()}
                            >
                              {action.busy ? (action.busyLabel || '处理中…') : action.label}
                              {action.points != null && <em>{action.points} 积分</em>}
                            </button>
                          ) : (
                            <span className="media-workbench-inline-action is-off" key={action.key || action.label} title={action.reason || ''}>
                              {action.label}{action.points != null && <em>{action.points} 积分</em>}
                            </span>
                          )))}
                        </span>
                      )}
                    </span>
                  );
                  return (
                    <FieldSlot
                      key={field.key}
                      field={field}
                      value={values[field.key]}
                      values={values}
                      onChange={onFieldChange}
                      disabled={disabled}
                      labelOverride={anchored.length > 0 ? label : null}
                    />
                  );
                })}
              </div>
              {/* 带 anchor 的动作已经渲染进字段行（见上面的 media-field-inline-actions） */}
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
          {/* ═══ 2026-09-19 批 K-E：主按钮**整栏宽 + 价格写在按钮里面**（照竞品形态）═══════════
              60 号文档实测：竞品主按钮 510.1×54.5（= 整栏宽），文案两行「立即生成视频 / 预计 12.00 积分」。
              我们原来把积分**并排在按钮外面**，按钮只剩 458（实测），比规格窄 52px。
              视频侧的按钮早就是这个形态（「分析并生成方案 / 1 积分」两行）—— 图片侧这次跟上。 */}
          <div className="media-workbench-cta">
            <button type="button" className="media-workbench-submit" disabled={disabled || ctaDisabled} onClick={() => onCta?.()}>
              <span className="media-workbench-submit-label">{ctaLabel}</span>
              {ctaPoints != null && <small className="media-workbench-points">{ctaPoints} 积分</small>}
            </button>
            {/* ═══ 批 BF：两句话在这一格上打过架，结论写在这里，免得下一轮再翻烧饼 ═══════════════════
                用户原话（对着这一格）：「为什么每做一个东西你都要加一句解释呢？你这样会导致画面里
                多了很多不关紧要的文字。用户他当然看得懂你这个按钮的意思啊，你按钮上已经写好了功能，
                **为什么下面还要再加一句描述呢？**」
                ⇒ 这句被删过一次，但**删错了一件事**：`ctaHint` 里装的是**状态**（「还差：素材」
                   「请至少勾选一个模块」），不是解释这个按钮是干什么的。用户要一直能知道
                   "按钮为什么是灰的、还缺哪一格" —— 这正是批 O-⑥ 立下的判据
                   （`scripts/media-workbench-e2e.mjs` 的 ① 场景：禁用原因必须就近写着、并点名缺哪个字段），
                   也是"不许放点了必失败的东西"那条铁律的一部分：灰按钮不说明原因 = 用户卡死。
                现在：**状态留、解释删** —— 只留最短的一句状态（见 MediaCreation 侧的 moduleGate 文案，
                连括号里的解释都去掉了），不给它任何"说明文"的写法。 */}
            {ctaHint && <p className="media-workbench-cta-hint shubao-gen-cta-hint">{ctaHint}</p>}
          </div>
        </div>
      )}
      <div className="media-workbench-right">
        {status}
        <div className="media-workbench-tabs-row">
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
          {/* 2026-09-26 批 BW：「怎么用这条技能」从被删掉的信息卡搬到这里（页签行右端）——
              功能不能丢（门禁 test/skill-tutorial-0919 守的就是"教学示例必须有入口"），
              但也不再占左栏一整行。 */}
          {tutorial && (
            <button
              type="button"
              className="media-workbench-tutorial is-head is-icon"
              onClick={() => setTutorialOpen(true)}
              title="怎么用这条技能"
              aria-label="怎么用这条技能"
            >
              <HelpCircle size={15} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="media-workbench-pane" role="tabpanel">
          {/* ═══ 2026-09-27 批 CG：「生成记录」在右栏的**常驻挂载点**（用户原话，逐字）════════════
               「你看你下面还是有这个生成结果的一个展示区，为什么还会有呢？我都跟你说了很多遍了，
                你这个生成结果**必须在右边的历史区里面**呀。这个地方一定是要删掉的呀。」
              视频侧那颗 `.video-history`（全部视频任务的唯一入口）由 portal 渲染进这里；左栏不再渲染。
              ⚠️ **常驻挂载**（不是 `activeTab === 'history'` 才建）：e2e 在**默认「示例」页签**下就断言
                `document.querySelector('.video-history')` 必须存在；切到「历史」才显示（`hidden` ⇒
                不在屏上，但仍在 DOM 里，切页签 / 读 textContent / 点按钮都照旧）。 */}
          <div className="media-workbench-history-host" data-history-host hidden={activeTab !== 'history'} />
          {activeTab === 'history' && !children ? <p className="media-workbench-empty">{historyEmpty}</p> : children}
        </div>
      </div>
      {/* ═══ 教学示例（三段式，照竞品 59 号实测的形态）══════════════════════════════════════ */}
      {tutorialOpen && tutorial && createPortal(
        <div className="media-tutorial-scrim" role="presentation" onMouseDown={() => setTutorialOpen(false)}>
          <section
            className="media-tutorial"
            role="dialog"
            aria-modal="true"
            aria-label={(title || '这条技能') + ' 怎么用'}
            onMouseDown={event => event.stopPropagation()}
          >
            <header className="media-tutorial-head">
              <div>
                <strong>{(title || '这条技能') + ' · 怎么用'}</strong>
                <span>先把这条技能要做的事看清楚，再动手配</span>
              </div>
              <button type="button" aria-label="关闭" onClick={() => setTutorialOpen(false)}>关闭</button>
            </header>
            <div className="media-tutorial-body">
              <div className="media-tutorial-media">
                {tutorial.media.length > 0
                  ? tutorial.media.map(src => <img key={src} src={src} alt="" loading="lazy" />)
                  : <p className="media-tutorial-empty">这条技能的教学示例还在制作中 —— 等第一条真实成片出来，这里就会换成它。</p>}
              </div>
              {tutorial.blocks.map(block => (
                <div className="media-tutorial-block" key={block.title}>
                  <strong>{block.title}</strong>
                  <ul>{block.lines.map(line => <li key={line}>{line}</li>)}</ul>
                </div>
              ))}
            </div>
            <footer className="media-tutorial-actions">
              <button type="button" onClick={() => setTutorialOpen(false)}>回去配置</button>
              <button
                type="button"
                className="is-primary"
                onClick={() => { setTutorialOpen(false); globalThis.document.querySelector('.media-workbench-submit')?.focus(); }}
              >开始生成</button>
            </footer>
          </section>
        </div>,
        globalThis.document.body,
      )}
    </section>
  );
}

/* 字段走统一渲染器（同目录 FieldRenderer）；这里单独包一层只是为了少一次 import 往返。 */
import FieldRenderer from './FieldRenderer.jsx';
function FieldSlot({ field, value, onChange, disabled, values, labelOverride = null }) {
  return <FieldRenderer field={field} value={value} values={values} disabled={disabled} labelOverride={labelOverride} onChange={next => onChange(field.key, next)} />;
}
