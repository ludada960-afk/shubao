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
  if (mergeTitle) return [{ name: mergeTitle, fields: dropCoveredFields(fields) }];
  const order = [];
  const map = new Map();
  for (const field of fields) {
    const name = field.group || '';
    if (!map.has(name)) { map.set(name, []); order.push(name); }
    map.get(name).push(field);
  }
  return order.map(name => ({ name, fields: dropCoveredFields(map.get(name)) }));
}

/* ═══ 2026-09-29 批 DC 续-8：**`kind: 'config'` 那一格收起的字段，从网格里剔掉** ═══════════════════
   用户 2026-09-29：「你就只排两个按钮进去子页面里面不就好了吗？……你为什么要把子页面的规划搞得乱七八糟呢？」
   ⇒ 声明里写 `{ kind: 'config', covers: ['imageModel', 'ratio', 'clarity'] }`，
     那三格**从左栏的网格里拿掉**（不是隐藏 —— 藏起来用户就找不到、去哪儿改都不知道），
     改由 `ConfigTriggers` 的面板承载；面板里那几格仍是 FieldRenderer 渲染原来那一份声明。
   ⚠️ 为什么在**分组之后**做：被收起的字段大多属于「生成设置」那一组，若在分组前剔，
     整组会消失、连组标题都没了 —— 用户在那一页就找不到"生成设置"这几个字。
     现在是"组还在、组里只剩那一行触发器"，读起来是"这一组的配置收起来了"。
   ⚠️ 剔不掉的情况要说出来：若某一组**全部**字段都被收走，就不渲染那个空 `<section>`。 */
function dropCoveredFields(list) {
  const covered = new Set();
  for (const field of list) {
    if (field && field.kind === 'config' && Array.isArray(field.covers)) {
      for (const key of field.covers) covered.add(key);
    }
  }
  if (!covered.size) return list;
  return list.filter(field => !(field && covered.has(field.key)));
}

/* ═══ 2026-09-28 批 CY-⑥：「分段档位」字段的付费动作，还要在**这一档的内容框下面**再给一颗整颗按钮 ═════
   用户原话（逐字，7 张批注图第 3 条）：
     「你看一下**人家 AI 推荐风格**，它这里是有个按钮的。他点击这个按钮才会生成结果在这里啊。
       他这个按钮其实就跟右上角那个 AI 推荐应该是同一个按钮的。」「你这里为什么跟他不一样呢？
       **不是说要照抄吗**？照抄你为什么抄着抄着又抄的不对呢？」
   知渔实测（CDP 只读：`.qa/cy5-quantv-style.mjs` + `cy5-quantv-style-frame.mjs`，
   `?tool=product-listing-set`，1440 视口）——这一格自上而下是：
     section.mt-8「产品卖点与设计风格」
      └ div.mt-6（设计风格那一格）
          └ div.rounded-xl.bg-gray-50（灰底圆角容器，padding 9.92）
              ├ 三档芯片「AI推荐 / 参考排版 / 自定义要求」各 **160×45**
              ├ 结论区（99px，空着等结论；点了分析才填）—— 我们这边就是「设计风格要求」那个 textarea
              └ button「AI推荐风格分析 · 0.10 积分」**272×45**，父层 `justify-content: center` ⇒ **居中**
                  h-9 = 45px、min-w-[180px]、px-5(19.84)、rounded-lg(9.92)、margin-top 19.84
   他们**标签行右端**另有一颗小胶囊「AI推荐 · 0.10 积分」177×35 —— 那正是我们行内那颗的对应物。
   ⇒ 用户那句"同一个按钮"= 这两颗调的是同一件事；我们缺的是**芯片下面那颗整颗的**，本批补上。
   ⚠️ 价钱一个字没动（0.2 积分，且必须写在按钮上）；文案沿用我们自己的「一键解析风格」
      （批 Q 时用户认可过我们的命名法，知渔叫「AI推荐风格分析」）—— 要逐字照抄文案只需改声明源那一处。
   ⚠️ 只对 **kind === 'segmented'** 的字段生效（风格三档这一族）；其余字段渲染一个字不变。 */
/** 「档内容块」= 该字段本身 + 紧跟其后、`visibleWhen.key === 该字段.key` 的那一串
 *  （声明源里这串的语义就是"切这一档换出来的内容"）。
 *  ⚠️ FieldRenderer 对 visibleWhen 不满足的字段是**渲染 null**（数组槽位仍在），
 *     所以按声明算出"最后一个成员"即可 —— 当前档看不到的那些天然塌掉，按钮正好落在**可见内容**下面。 */
function bigActionAfter(groups, actions = []) {
  const out = new Map();
  for (const group of groups) {
    group.fields.forEach((field, index) => {
      if (field.kind !== 'segmented') return;
      const action = actions.find(a => a.anchor === field.key && a.runnable);
      if (!action) return;
      let last = index;
      while (last + 1 < group.fields.length && group.fields[last + 1].visibleWhen?.key === field.key) last += 1;
      out.set(group.fields[last].key, action);
    });
  }
  return out;
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
  /* 2026-09-28 批 DC 续-7：**清单价与总额**（`6 张 × 2 + 文案 0.5 = 12.5 积分`，见 skillBatchQuote）。
     给了它就替代 `ctaPoints` 那一行；不给的技能照旧（一句 `{ctaPoints} 积分`）。 */
  ctaPriceNote = '',
  /* 主按钮**上方**的自定义控件区（2026-09-28 批 DC 续-7 新增，用来放「同时出文案」那颗开关）。
     ⚠️ 只开一个口子、由调用方填内容，**不是新控件样式**：里面的东西仍然走既有类，
        页面里不许再手写一套。默认 null ⇒ 一行都不渲染（其余 40+ 个技能页面一个字不变）。 */
  ctaExtra = null,
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
  /* 分组与「档内容块末尾那颗整颗按钮」都先算好（原来 groupFields 是在 JSX 里现算的）。 */
  const groups = groupFields(fields, groupTitle);
  const bigActions = bigActionAfter(groups, paidActions);
  /* ═══ 2026-09-29 批 DC 续-16：清单块可以**声明自己排在哪个分组之后** ═══════════════════════════
     原来 `sections` 一律排在**所有**字段组之后（硬编码）。概念视觉方案那一页的「版式族」是
     四张长卡片，清单被压在它们底下 —— 用户滚到版式族与提交条之间就说「你的连拍组去哪了呢」。
     ⇒ 声明 `afterGroup: '本篇方案'` 的清单改在那个组后面就地渲染；没声明的**行为一个字不变**
     （A+ 那条 16 模块清单等仍然排在最后）。 */
  const anchored = new Map();
  const orphanSections = [];
  for (const section of sections) {
    if (!section) continue;
    if (!section.afterGroup) { orphanSections.push(section); continue; }
    /* ⚠️ `afterGroup` 写了一个**不存在的组名**时不能把这一块弄丢 ——
       声明写错（改名、组被挪了）不该让整块清单凭空消失、CTA 一直灰着。
       取不到就退回"排在最后"那条老路（= 批 DC 续-16 之前的行为）。 */
    if (groups.some(group => group.name === section.afterGroup)) anchored.set(section.afterGroup, renderSection(section));
    else orphanSections.push(section);
  }
  /* 清单块渲染器。两个调用点共用同一份实现 —— 抽出来是为了让"插在组后"与"排在最后"
     **逐字同款**，避免以后改一份忘一份（那正是 0917 端到端踩过的循环依赖/漏改坑）。 */
  function renderSection(section) {
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
      /* ⚠️ `is-person` 是**单列**那条规则的开关（`grid-template-columns: 1fr`）。
         漏了它这条 CSS 就是**死的** —— 而当前左栏 386px 本来就 < 480px 的两列阈值，
         `auto-fit minmax(min(240px,100%),1fr)` 照样给一列，**看起来完全正常**，
         要到左栏变宽（CSS 注释里量到过 570px）才会炸成两列、行被撑破。
         ⇒ 类名与 CSS 一起改，且下面 ⑬ 那条门禁守着它。 */
      <section className={'media-workbench-group media-workbench-checklist'
        + (selectable ? ' is-selectable' : '')
        + (section.personField ? ' is-person' : '')} key={section.key || section.title}>
        <h3 className="media-workbench-group-title">
          {section.title}
          {/* 2026-09-28 批 DC 续-7：**先把"这一篇几张"写出来**，再说"勾了几个"。
              用户 2026-09-28 当面问的原话：「**你这个工作台里面并没有给我张数呀**。
              我根本就不知道你产出的到底是多少张？」—— 原来这里只有「已选 6/10」，
              而那个 10 是清单**上限**，不是这一篇的张数（页面上再没有第二个数字）。 */}
          <span className="media-workbench-checklist-count">
            {selectable ? `这一篇 ${checkedCount} 张 · 已选 ${checkedCount}/${section.items.length}` : `已选 ${checkedCount}/${section.items.length}`}
          </span>
        </h3>
        {section.note && <p className="media-workbench-group-note">{section.note}</p>}
        {/* ⚠️ 批 DC 续-16 曾在这一行放过一句「右侧：这一张的人物形态（按实测分布自动分配，可逐张改）」，
            批 DC 续-17 **按用户要求删掉**（逐字：「像这两句描述说明我觉得没有太大必要，你可以删掉。」）
            —— 说明句压在清单上方、离它要解释的那一列很远，反而多此一举。
            逐行那颗下拉靠**控件自身的取值**（空镜 / 躯干与腿 / …）自解释，
            读屏用的 `aria-label` 仍在（FieldRenderer 一直传 `field.label`），不影响无障碍。 */}
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
                {/* ═══ 2026-09-29 批 DC 续-15：这一行额外的「连拍」标记 ════════════════════════
                    用户 2026-09-29 选定（逐字）：「改成清单里逐张勾『进连拍』」。
                    旧做法是一栏「前 2 张 / 前 3 张」按**位置**取清单最前面的 N 张 ——
                    ① 必然占用封面（第 1 项就是概念静物）；
                    ② 依据不成立（重算实测：76% 的篇封面根本不在连拍簇里，簇多是中段连着）。
                    ⚠️ 与上面那颗勾选**分开**是必须的：勾 = 这一篇出不出这张；
                       连拍 = 这张和哪几张同机位。点它不会改张数、也不会改价钱。
                    ⚠️ 本身没被勾进这一篇的那行置灰：清单里没有的那张不可能出现在组里。 */}
                {/* ═══ 2026-09-29 批 DC 续-17：连拍改成「这张 + 下一张」**成对** ══════════════════════
                    用户 2026-09-29 第三次追问（逐字）：
                    「他点了第一张图的这个连拍按钮，然后他又点了第 5 张图的这个连拍按钮。那第一张和
                      第 5 张会形成连拍吗？那最后这套图片岂不是就变成第一张跟第 5 张是连拍，
                      **但是中间又插了第二第三第四张**？他又不跟他们是连拍。」
                    ⇒ 改成"点一下＝这张和下一张一组"，**跨空档从根上不存在**。
                    `is-start` 标出"组的开头"那一张（深一档底色 + 一个小三角），
                    跟着来的那一张是普通 `is-on` —— 两张一眼能看出是一对。 */}
                {section.series && (
                  <button
                    type="button"
                    className={'media-workbench-checklist-series'
                      + (section.seriesNames?.includes(item.name) ? ' is-on' : '')
                      + (section.seriesStarts?.includes(item.name) ? ' is-start' : '')}
                    aria-pressed={section.seriesNames?.includes(item.name) || false}
                    disabled={!on}
                    title={on ? (section.seriesHint || '') : '先把这一张勾进这一篇，才能标它进连拍组'}
                    onClick={() => section.onToggleSeries?.(item.name)}
                  >
                    连拍
                  </button>
                )}
                {/* ═══ 2026-09-29 批 DC 续-16：**这一行自己的「人物形态」** ═════════════════════════
                    用户 2026-09-29 逐字：「那是不是它出来的所有内容都会包含这些人物形态……
                    **那出来的作品岂不都千篇一律了？**」—— 实测 39 篇多图笔记里 **34 篇（87.2%）
                    篇内混用**人物形态，所以逐张给、而不是全篇一档（依据与算法见 skillRun.skillShotMix）。
                    ⚠️ 值默认是**按实测分布自动分配**的（`skill.shotMix`），用户可以逐行改；
                       覆盖存在 `values.shotOverrides`（按**名字**存，改张数不错位）。
                    ⚠️ 控件**走 FieldRenderer**（不在这里手写 `<select>`）——
                       仓库铁律「字段一律经 FieldRenderer 渲染，页面里不许再手写控件」。
                    ⚠️⚠️ **只在勾进行的那几行渲染**：没勾进行本来就不在这一篇里，没有"它的人物形态"。
                       早先给未勾选的行也渲染了控件，`value` 是空串 → 原生 `<select>` 落到**第一档
                       （空镜）** —— 于是 10 行里有 4 行未勾选的行看上去"也是空镜"，
                       读起来就是"这一篇九张空镜"，与实际（勾 6 张、其中 3 张空镜）完全不符。
                       现在未勾选的行只有名称 + 那颗置灰的「连拍」。 */}
                {/* ⚠️ 批 DC 续-17：**这一格永远渲染**，即使里面是空的。
                    批 DC 续-16 只在 `on`（勾进行）时渲染那颗下拉 ⇒ 未勾进行少一个子元素，
                    flex 布局下那颗「连拍」药丸会**往左滑**，于是十行的药丸**不在一条竖线上**
                    （用户 2026-09-30 原话：「你的连拍和你的镜头选项，他们现在是不对齐的一个情况呀」）。
                    ⇒ 行改成三列 grid（手法名 / 连拍 / 镜头），空的那一列照样占位。 */}
                {section.personField && (
                  <div className="media-workbench-checklist-person">
                    {on && (
                      <FieldRenderer
                        field={section.personField}
                        value={item.person || ''}
                        values={values}
                        allFields={fields}
                        disabled={disabled}
                        onChange={next => section.onPersonChange?.(item.name, next)}
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    );
  }
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
            {groups.map((group, index) => (
            <React.Fragment key={group.name || 'default'}>
            <section className="media-workbench-group">
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
                  const bigAction = bigActions.get(field.key);
                  /* ═══ 2026-09-29 批 DC 续-16：**锁住态的按钮浮在框表面上**，不在框下面 ════════════════
                     用户 2026-09-29 逐字：「这个输入框平时它是一个被锁死的状态，然后这个一键解析的
                     按钮**出现在它的表面上**。」
                     ⚠️ 判据仍然是**同一个**「值是不是空」（与 FieldRenderer 里那份逐字一致）：
                       锁 ⇒ 表面有按钮、下面**不**再重复一颗；解锁 ⇒ 表面没了、下面那颗回来。
                     ⚠️ `gatedByAction` 里那个 key 是**真在用的**，不是装饰：它必须与这颗按钮的
                       `action.key` 对上，才允许把按钮搬到表面。对不上就退回"框下面"那条老路 ——
                       宁可不浮起来，也不要把**别的**动作浮到用户以为能解锁的框上。
                     ⚠️ 传下去的是**同一个 action 对象**，不是复制一份 ——
                        点表面那颗和点下面那颗是同一次调用、同一个价钱，只可能扣一次。 */
                  const gateMatches = Boolean(field.gatedByAction) && bigAction && bigAction.key === field.gatedByAction;
                  const gatedEmpty = gateMatches && !String(values[field.key] ?? '').trim();
                  const showBigBelow = Boolean(bigAction) && !gatedEmpty;
                  return (
                    /* ═══ 批 CY-⑥：字段本身 + （分段档位字段才有的）**档内容块末尾那颗整颗按钮** ═══════
                       它是一行独立的网格项（跨两列、居中），落在"这一档的内容框"下面 —— 与知渔同构：
                       芯片 → 该档内容（如「设计风格要求」框）→ 整颗按钮（结论就写进上面那个框）。
                       ⚠️ 与行内那颗小胶囊是**同一个 action 对象**（同一次调用、同一个价钱），
                          不是两份实现 —— 点哪颗都只扣一次。 */
                    <React.Fragment key={field.key}>
                      <FieldSlot
                        field={field}
                        value={values[field.key]}
                        values={values}
                        allFields={fields}
                        onChange={onFieldChange}
                        disabled={disabled}
                        labelOverride={anchored.length > 0 ? label : null}
                        surfaceAction={gatedEmpty ? bigAction : null}
                      />
                      {showBigBelow && (
                        <div className="media-workbench-field-action">
                          <button
                            type="button"
                            className={'media-workbench-paid' + (bigAction.busy ? ' is-busy' : '')}
                            disabled={disabled || bigAction.busy || bigAction.disabled}
                            onClick={() => bigAction.onRun?.()}
                          >
                            <span>{bigAction.busy ? (bigAction.busyLabel || '处理中…') : bigAction.label}</span>
                            {bigAction.points != null && <em>{bigAction.points} 积分</em>}
                          </button>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
              {/* 带 anchor 的动作已经渲染进字段行（见上面的 media-field-inline-actions） */}
            </section>
            {/* ═══ 2026-09-29 批 DC 续-16：清单可以**插在指定分组之后**（`section.afterGroup`）══════════
               用户 2026-09-29 逐字（对着概念视觉方案那页截图）：
                 「然后**你的连拍组去哪了呢？你是还没做进来吗？**」
               —— 它没丢，是被埋在下面了：`sections.map` 原来**硬编码在所有字段组之后**，
               而那一页的「版式族」是四张长卡片，清单（连拍药丸在里面）排在它们底下，
               滚过去才看得见。截图停在版式族与提交条之间，自然就"找不到"。
               ⇒ 声明 `afterGroup: '本篇方案'` 就落在主题意象下面、构图方向上面。
               ⚠️ 40px 分隔线由既有的 `.media-workbench-group + .media-workbench-group` 自动给上，
                  不用另写（清单 section 本来就带那个类名）。 */}
            {anchored.get(group.name) || null}
            </React.Fragment>
          ))}
          {orphanSections.map(renderSection)}
          {/* ═══ 2026-09-19 批 K-E：主按钮**整栏宽 + 价格写在按钮里面**（照竞品形态）═══════════
              60 号文档实测：竞品主按钮 510.1×54.5（= 整栏宽），文案两行「立即生成视频 / 预计 12.00 积分」。
              我们原来把积分**并排在按钮外面**，按钮只剩 458（实测），比规格窄 52px。
              视频侧的按钮早就是这个形态（「分析并生成方案 / 1 积分」两行）—— 图片侧这次跟上。 */}
          <div className="media-workbench-cta">
            {ctaExtra}
            {/* 2026-09-28 批 DC 续-7：副行优先显示 `ctaPriceNote`（**清单价与总额**，见 skillBatchQuote）。
                没给这一项的技能一个字不变（仍是 `{ctaPoints} 积分`）。 */}
            <button type="button" className="media-workbench-submit" disabled={disabled || ctaDisabled} onClick={() => onCta?.()}>
              <span className="media-workbench-submit-label">{ctaLabel}</span>
              {ctaPriceNote
                ? <small className="media-workbench-points">{ctaPriceNote}</small>
                : (ctaPoints != null && <small className="media-workbench-points">{ctaPoints} 积分</small>)}
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
function FieldSlot({ field, value, onChange, disabled, values, labelOverride = null, allFields = [], surfaceAction = null }) {
  /* `allFields` 透传：`kind:'config'` 那一格要按 key 取回被它收起的**声明**（values 里只有取值）。 */
  return <FieldRenderer field={field} value={value} values={values} allFields={allFields} disabled={disabled} labelOverride={labelOverride} surfaceAction={surfaceAction} onChange={next => onChange(field.key, next)} />;
}
