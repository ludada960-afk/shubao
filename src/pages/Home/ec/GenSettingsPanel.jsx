import React, { useRef, useState } from 'react';
import { Check, ChevronDown, Monitor, Palette, Sparkles } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import AnchoredPortal from '../../../components/ui/AnchoredPortal.jsx';
import { IMAGE_MODELS, SELECTABLE_IMAGE_MODELS, imageModelResolutions, normalizeImageModel } from '../../../services/imageModelCatalog.js';
import { brandLogo } from '../../../services/modelLogos.js';
import ModelLogo from '../../../components/ModelLogo.jsx';
import { GroupTitle } from './PanelPrimitives.jsx';
/* 未锁定态的唯一事实源（D8：同一语义只允许一处定义，禁止各面板内联同一组值）。 */
import { ICON_SIZE, NEUTRAL_UNLOCKED, SPACING } from './panelVisualLanguage.js';

/* ══════════════════════════════════════════════════════════════════════
   2026-09-15 总统筹 V3 改造（用户点名「最丑」的面板）

   取值来源：src/styles/design-tokens-v3.css（--sb-*，唯一权威）
   原则来源：docs/design/00-principles.md
   问题来源：docs/design/31-current-ui-audit.md §1.3 / §Q5
   ──────────────────────────────────────────────────────────────────────
   本文件按原则逐条落地，**不再自己发明取值**（含颜色、间距、圆角、字号）：

   ▌原则 3.2（面板内禁止套白卡）
     旧实现：分组套「纯白卡 + 极淡黑描边」，再套进 L1 半透明白面板。
     两者色差 ≈0，那条 1px 边框成了唯一分界 → 面板看起来像「一堆小方框拼的表格」，
     正是「又丑又 low」的视觉来源。
     新实现：分组改用 **留白 + 分组标题** 分区，不套白卡；
     选项控件底 = --sb-surface-tint（L3），默认**不画边框**。

   ▌原则 3.3（分层二选一，禁止「弱色差 + 弱边框」）
     旧实现正是被禁止的 C 方案。现在默认态零边框，只有 hover/selected 才出现描边。

   ▌原则 4.3 与 1.2（hover 与 selected 必须走不同视觉通道）
     hover    ：**只**改底色 → --sb-state-hover-bg（中性灰，绝不发紫）
     selected ：底 --sb-state-selected-bg + 描边 --sb-state-selected-line
                + 文字/图标 --sb-state-selected-ink（品牌紫，持久不随鼠标移开消失）
     旧实现 hover 与 selected 都往「紫渐变 + 紫阴影」走，用户分不清
     「鼠标停在这」和「这个面板是开着的」。

   ▌原则 6.1（彩色字只有三种合法场合）
     分组标签是**层级信息**，不是品牌动作 → 图标与文字一律中性色。
     旧实现把「分辨率/品质/品牌色」等普通分组标签的图标染紫，属明确禁止项。

   ▌原则 6.3（默认必须处于未锁定 / 中性态）
     默认态零品牌紫；品牌紫只在选中/锁定时出现。

   ▌原则 3.4（嵌套圆角公式：内层 = 外层 − 内边距）
     面板 20 → 内层 12（--sb-radius-card）→ 更内层 8（--sb-radius-control）。

   ▌原则 2.3 / 2.1（面板内边距 20、组内:组间 = 1:2）
     --sb-panel-padding(20) / --sb-group-gap(20) / --sb-field-gap(8)
   ══════════════════════════════════════════════════════════════════════ */

/* 取色器起始色的兜底值：SSR / 无 document 时才用到，正常路径一律从
   --sb-text-primary 读取（见组件内 neutralInk）。 */
const FALLBACK_NEUTRAL_INK = 'rgb(26, 22, 20)';

const RESOLUTIONS = [
  { key: '1K', label: '1K', ratio: '标准', desc: '试方向' },
  { key: '2K', label: '2K', ratio: '高清', desc: '推荐' },
  { key: '4K', label: '4K', ratio: '超清', desc: '看细节' },
];

/* ⚠️ 这里曾经有一个**本面板私有**的 GroupTitle：10px / bold / --sb-text-hint（灰）。
   它正是用户批注图6-⑧「所有面板的标题设计方式参差不齐」的最大来源 ——
   同一档「分组标题」，套图方案是 13/700/--sb-ink-1（近黑），这里是 10px 灰，
   面板换一个、标题就换一种长相，用户当然觉得「没有体系」。
   2026-09-15 删除，改用 PanelPrimitives.GroupTitle（全站唯一实现）。
   原则 6.1（分组标签不染品牌色）仍然成立：GroupTitle 的墨色是中性 --sb-ink-1。 */

/* hideResolution：把「清晰度」这一段让给调用方自己渲染。
   2026-09-19 用户批注 #5-①/#6：「首页图片只要两个面板，一个是选模型的，另一个把尺寸、数量、
   清晰度集合在一起，打开就能看到分辨率和尺寸」。所以首页把清晰度挪进「画面规格」面板，
   模型面板只留模型 —— 选项值与回落逻辑仍由本组件的 imageModelResolutions 提供，不另写一份。 */
/* ═══ 2026-09-25 批 BJ：onPickModel（用户原话，逐字）══════════════════════════════════════════
   「我现在选择任意一个模型，你**为什么会弹出一个空白窗**呢？这个窗不能有呀。我都说了很多次了，
     就是点击这个模型按钮的时候，就是要那个**全部模型的那个面板弹出来**，用户选择完就**直接默认配置到
     你的按钮里面**就可以了，就这么简单的一个逻辑而已。」
   实测复现：选完模型后 panel 仍在、内容只剩标题「生图模型」、列表 0 行、面板 480×74 —— 就是那个空白窗。
   根因：selectModel 里 setModelListOpen(false) 收起列表，而首页那一档（openModelList）**不渲染触发行**
   ⇒ 面板里什么都不剩。⇒ 首页那一档选完让**调用方关掉整个面板**（onPickModel）。 */
export default function GenSettingsPanel({ value, onChange, showHeader = true, brandColors = null, onBrandColorsChange = null, hideResolution = false, openModelList = false, onPickModel = null }) {
  const safeValue = value || {};
  const selectedModel = normalizeImageModel(safeValue.imageModel);
  const currentDef = IMAGE_MODELS.find(model => model.id === selectedModel);
  const set = (key, val) => onChange?.({ ...safeValue, [key]: val });
  /* 清晰度选项跟着模型能力走 —— Midjourney 上游只有 1K/2K（既有契约，不许破坏）。 */
  const availableResolutions = imageModelResolutions(selectedModel);
  const resolutionChoices = RESOLUTIONS.filter(r => availableResolutions.includes(r.key));
  /* 展开列表里要展示的「其它可选项」：过滤掉当前已选的那个。
     用户批注图6-⑨：「去掉模型下拉顶部重复的『当前模型』项」—— 当前模型就在正上方的
     触发按钮里，展开后它又出现在列表第一行，用户看到的是同一个名字写了两遍。
     兜底：万一过滤后为空（账号只有一款可用模型），退回完整列表 —— 不能点开一个空面板。 */
  /* ═══ 2026-09-25 批 BG：首页那一档的清单**含当前项**（用户图3 原话，逐字）══════════════════════
     「我再去点击这个生图模型的这个按钮的话，它张开来的是你选中的那个模型，必须再点一次这个选中的
       模型，它才会再张开这张列表，你这个是完全不对的。我认为不需要有中间那个步骤，就是**每次点击
       生图模型，它必须完全张开所有的模型**才是对的，你中间设置的那个选完模型之后变成一个独立模型的
       面板那个环节完全不需要。」
     ⇒ 首页（openModelList）时 otherModels = **全部可选模型**（含当前项，它带勾 aria-pressed）；
       其它面板（六面板那一套）仍旧只列"当前之外的候补"，行为与从前完全一致。
       ⚠️ 这一行是门禁 test/gen-settings-panel-model-copy-0914 钉住的派生入口，前缀保持原样。 */
  const otherModels = SELECTABLE_IMAGE_MODELS.filter(model => openModelList || model.id !== selectedModel);
  const listModels = otherModels.length > 0 ? otherModels : SELECTABLE_IMAGE_MODELS;

  /* 原则 6.3：默认「未锁定任何颜色」；锁定态只由外部 brandColors 推导。 */
  const brandLocked = Array.isArray(brandColors) && brandColors.length > 0;
  /* 未锁定时取色器的起始色 = 中性墨色（--sb-text-primary），**不是品牌紫**。
     从 token 读，避免再引入硬编码 hex（铁律：组件里禁止硬编码色值）。 */
  const neutralInk = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--sb-text-primary').trim()
    : '';
  const [pickerColor, setPickerColor] = useState(() => (brandLocked && brandColors[0] ? brandColors[0] : (neutralInk || FALLBACK_NEUTRAL_INK)));
  const [pickerOpen, setPickerOpen] = useState(false);
  /* 取色器的定位锚点 = 整行（色块 + 色值输入框 + 锁定按钮）。
     取整行而不是取色块按钮：AnchoredPortal 的「点外部即关闭」只认锚点子树，
     若只锚色块，用户点色值输入框调整数值时会被判成「点了外面」而把色盘关掉。 */
  const pickerRowRef = useRef(null);
  /* ⚠️ 2026-09-19 批 H-4（用户批注 #3-① / #9）：
     「你这里模型为什么不是自动张开的呢？点击这个按钮之后就应该是默认往下拉选模型呀。」
     根因：这一层列表默认是关的 —— 用户点开「生图模型」那颗按钮之后，还要**再点一次**
     面板里的下一级按钮才能看到模型清单（两步）。首页那颗触发按钮本来就只有一个用途
     （选模型），所以把列表的初始开合交给调用方决定：首页传 openModelList，
     一打开面板就是清单本身；电商生图那边的通用「生成设置」面板不传，保持原样（那里一屏有多个分组）。 */
  const [modelListOpen, setModelListOpen] = useState(openModelList === true);
  /* 注：本组件不再自管 hover 状态 —— .sb-opt 用 CSS 伪类表达 hover，
     既满足 D2「hover 只做底色」，又避免内联 style 覆盖声明式伪类。 */

  const toggleBrand = () => onBrandColorsChange?.(brandLocked ? [] : [pickerColor, pickerColor]);

  const selectModel = model => {
    const nextResolutions = imageModelResolutions(model.id);
    const currentResolution = safeValue.resolution || '2K';
    const nextResolution = nextResolutions.includes(currentResolution) ? currentResolution : nextResolutions[nextResolutions.length - 1];
    onChange?.({ ...safeValue, imageModel: model.id, resolution: nextResolution });
    /* 批 BJ：首页那一档选完**关整个面板**（不要留一个只剩标题的空窗）；其它面板维持"收起列表"的原行为。 */
    if (openModelList && onPickModel) onPickModel(model);
    else setModelListOpen(false);
  };

  /* ── 选项卡：改用预置类 .sb-opt（20-components.md §0.4 明示优先用它） ──
     决策依据：20-components.md「实现方式：优先用 .sb-opt 及 .sb-opt__icon 等预置类，
     而不是手写内联 style。**内联 style 会覆盖声明式伪类**，这正是改前
     「hover 与选中长得一样」的成因之一。」

     .sb-opt 已经把 D2 全套写进 CSS（见 design-tokens-v3.css §18）：
       default        : 底 --sb-l3-option，边框 1.5px transparent（占位防位移）
       hover          : 只换 --sb-l3-option-hover 中性灰，**不变字色、不发紫**
       selected       : 三件套（--sb-sel-bg / --sb-sel-line / --sb-sel-ink）+ --sb-shadow-ring
       selected+hover : 只加深底色（--sb-sel-bg-hover），ring 与字色保持 → 持久性
       active/disabled: 均已定义
     本组件不再自造 hover 状态，也不需要 hoverKey（伪类由 CSS 承担）。 */
  const optionClass = 'sb-opt';

  /* 模型名过长时的规则不变（用户已拍板）：槽位宽固定、内部溢出裁切、**不要省略号** */
  const modelRow = (model, active, showDesc = true) => (
    <span style={{ minWidth: 0, flex: 1 }}>
      {/* ═══ 2026-09-19 批 J-⑩（用户批注 #5-2）══════════════════════════════════════════
          原话：「这里我都跟你说过了，**右边不要留白这么多**呀，你现在这些模型的选项看起来
          就很不突出，因为你右边留白的部分实在太过于多了。」
          ⚠️ 这一行**保持**名字与徽章挨着（图6-⑨「消除按钮内两侧大片空白」的修法不动）：
             本条投诉的真正落点是**第一行（触发行）几乎整行空白** + 它没有副标题 ——
             见下面触发行的 showDesc。把徽章顶到行尾会让"名字与徽章中间空一片"回来，
             那正是图6-⑨ 已经修掉的毛病，不能为了这一条把它放回去。 */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sb-space-2)', minWidth: 0 }}>
        <strong style={{
          fontSize: 'var(--sb-text-xs)',
          fontWeight: 'var(--sb-weight-semibold)',
          color: active ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-primary)',
          /* 模型名过长时的规则不变（用户已拍板）：槽位宽固定、内部溢出裁切、**不要省略号** */
          overflow: 'hidden', whiteSpace: 'nowrap',
        }}>{model.label}</strong>
        <span style={{
          fontSize: 'var(--sb-text-2xs)',
          color: active ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-hint)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>{model.badge}</span>
      </span>
      {/* ═══ 2026-09-25 批 BG：描述两档（用户图3 原话，逐字）══════════════════════════════════════
         「你左边有一个图标，然后是一个标题，然后下面是描述，但是你**右边为什么会有大量的空白**呢？
           你留这么多空白在视觉上看起来就很不平衡呀。」
         短描述（≤22 字，门禁钉着）只占行宽的三分之一，右侧必然空一片；视频侧的行本来就是两行完整描述。
         ⇒ 首页那一档传 'full'：显示**完整描述**（自动换行、铺满行宽），与视频侧的行结构一致；
           其它面板（六面板那套，宽度/环境不同）保持原来的一行短描述。 */}
      {showDesc && (
        <span style={{
          display: 'block',
          marginTop: 'var(--sb-space-1)',
          fontSize: 'var(--sb-text-2xs)',
          color: 'var(--sb-text-muted)',
          whiteSpace: showDesc === 'full' ? 'normal' : 'nowrap',
          lineHeight: showDesc === 'full' ? 1.45 : undefined,
          overflow: 'hidden',
        }}>{showDesc === 'full' ? (model.description || model.shortDescription) : (model.shortDescription || model.description)}</span>
      )}
    </span>
  );

  /* ═══ 模型图标：一层，不是两层（2026-09-16 用户批注图1-①）═══
     用户原话：「我觉得你这些模型图标是有两个边缘的啊，就是图标本身是有一层边缘的，
     你的外面还加了一层边缘，好像除了 gemini 以外的模型都有这个问题，图标有多层框，
     这个问题导致图标看起来很小啊」。
     根因：这里原本套着一个 --sb-surface-tint 的方底（第一层框），
     里面 ModelLogo 自己又是一个带圆角/自带底色的方标（第二层框）；
     两层框叠起来，真正有内容的图形只剩 0.72 倍 —— 于是「看起来很小」。
     Gemini 之所以没被点名：它的标是异形/无底，外框看不出来。
     修法：**去掉外层底**，让品牌标自己就是那一层（文字标 OpenAI/MJ 自带浅底，
     图片标自带圆角），尺寸也不再打 0.72 折。一行一个图标，一眼一个品牌。 */
  /* hover 时轻微放大（2026-09-16 用户批注图1-①/图2-①）：「当鼠标放上去的时候，它会自动放大，
     动一下，这样子我觉得会更好一些」「鼠标放到哪一个选项上，它的这个图标应该会自动放大一点。
     你现在的情况好像是图标已经占满了整个的框。我觉得你不用完全占满，就是你应该在鼠标放上去的
     时候再让他占满」—— 所以**常态收一点、hover 满格**：常态 0.88 倍，hover 回到 1 倍。 */
  const modelIcon = (model, size) => (
    <span className="ec-model-mark" style={{ width: size, height: size }}>
      <ModelLogo
        logo={brandLogo(model.brand)}
        size={size}
        radius={Math.round(size * 0.28)}
        style={{ display: 'block' }}
      />
    </span>
  );

  return (
    <div style={{ padding: 0 }}>
      {/* 内边距与分区间距改走**六面板统一的间距阶梯**（panelVisualLanguage.SPACING），
          不再用 V3 的 --sb-panel-padding(20) / --sb-group-gap(20)：
          那套值让「生成设置」的内边距与分组间距和另外五个面板（24/20 与 16）对不上，
          属于用户批注图6-⑧「都参差不齐」的一部分。
          节奏：面板上下 sp6(24) / 左右 sp5(20)；分组 ↔ 分组 sp4(16)；
                分组标题 ↔ 内容 sp3(12)；字段标签 ↔ 控件 sp2(8)。 */}
      <div style={{
        padding: `${SPACING.sp6}px ${SPACING.sp5}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.sp4,
      }}>

        {/* ── 分组 1：生图模型 ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sp3 }}>
          <GroupTitle icon={Sparkles}>生图模型</GroupTitle>
          {/* 批 BG：首页那一档**不渲染这一行**（见上面 otherModels 那段批注：用户不要"先一行当前模型、
              再点一次才展开"的中间步骤）。其它面板保留这行折叠开关。 */}
          {!openModelList && <button
            type="button"
            className={optionClass}
            onClick={() => setModelListOpen(open => !open)}
            aria-expanded={modelListOpen}
            /* 行高 ≥44px（用户「点击区不许缩水」）：V3 阶梯 28/32/36/44 中取 44。 */
            style={{ minHeight: 'var(--sb-control-touch)' }}
          >
            {modelIcon(currentDef || { brand: 'openai' }, ICON_SIZE.modelTrigger)}
            {/* ═══ 批 J-⑩（用户批注 #5-2 后半句）═══════════════════════════════════════════
                原话：「然后**为什么你的第一个模型下面没有副标题呢？**其他的模型都有一行描述呀，
                为什么就它没有呢？」
                根因：面板一打开（openModelList）清单是张开的，**触发行就是清单的第一行** ——
                而它当时是 showDesc=false，于是用户在"第一个模型"下面看到的是一片空，
                下面七个却都有一行描述。
                改后：触发行照样带描述。它本来显示的就是"当前这个模型"，和下面那几行是同一件事，
                没有任何理由长得不一样。 */}
            {modelRow(currentDef || { id: selectedModel, label: '智能推荐', badge: '', description: '' }, false, true)}
            <ChevronDown size={15} aria-hidden="true" style={{
              flexShrink: 0,
              marginLeft: 'auto',
              color: modelListOpen ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-hint)',
              transform: modelListOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform var(--sb-duration-fast) var(--sb-ease-out)',
            }} />
          </button>}
          {modelListOpen && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--sb-space-2)' }}>
              {listModels.map(model => {
                const active = selectedModel === model.id;
                const key = 'model-' + model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    className={optionClass}
                    aria-pressed={active}
                    onClick={() => selectModel(model)}
                    style={{ minHeight: 'var(--sb-control-touch)' }}
                  >
                    {modelIcon(model, ICON_SIZE.modelOption)}
                    {modelRow(model, active, openModelList ? 'full' : false)}
                    {/* ═══ 2026-09-19 批 I-②（用户批注 #5）══════════════════════════════════════
                        原话：「点了哪个模型就是哪个模型作为按钮完全替代上去显示在按钮上啊，
                        你为什么这里还是有个向下的箭头呀，不是应该打钩吗，
                        而且右边这么多留白干什么，应该紧凑一些呀。」
                        ① 选中项的右侧指示器从"什么都没有"改成**打钩**（之前只有底色变化，
                           列表里根本看不出哪一个是当前生效的）；
                        ② 打钩同时吃掉右侧那片留白（它顶到行尾，行就不再是"左边一撮字 +
                           右边一大片空"）。未选中项保留**同宽占位**，避免选中时整行宽度跳动。 */}
                    {active
                      ? <Check size={15} aria-hidden="true" style={{ flexShrink: 0, marginLeft: 'auto', color: 'var(--sb-state-selected-ink)' }} />
                      : <span aria-hidden="true" style={{ flexShrink: 0, marginLeft: 'auto', width: 15, height: 15 }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── 分组 2：清晰度（hideResolution 时整段不渲染，改由调用方的「画面规格」面板承担） ── */}
        {!hideResolution && <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sp3 }}>
          <GroupTitle icon={Monitor}>清晰度</GroupTitle>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${resolutionChoices.length}, minmax(0, 1fr))`, gap: 'var(--sb-space-2)' }}>
            {resolutionChoices.map(r => {
              const active = (safeValue.resolution || '2K') === r.key;
              const key = 'res-' + r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  className={optionClass}
                  aria-pressed={active}
                  onClick={() => set('resolution', r.key)}
                  style={{
                    /* 用户明确要求：清晰度等分段控件的点击区必须放大（≥40px，改造前仅 30px）。
                       V3 阶梯里 36(--sb-control-lg) 不满足，取 44(--sb-control-h-xl)——只会更大，不会缩水。 */
                    height: 'var(--sb-control-h-xl)',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--sb-space-1)',
                  }}
                >
                  <span style={{
                    fontSize: 'var(--sb-text-xs)',
                    fontWeight: 'var(--sb-weight-bold)',
                    lineHeight: 'var(--sb-leading-tight)',
                    color: active ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-primary)',
                  }}>{r.label}</span>
                  <span style={{
                    fontSize: 'var(--sb-text-2xs)',
                    lineHeight: 'var(--sb-leading-tight)',
                    color: active ? 'var(--sb-state-selected-ink)' : 'var(--sb-text-muted)',
                  }}>{r.ratio}·{r.desc}</span>
                </button>
              );
            })}
          </div>
        </div>}

        {/* ── 分组 3：品牌主色调（默认未锁定） ── */}
        {onBrandColorsChange && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sp3 }}>
            <GroupTitle icon={Palette}>品牌主色调</GroupTitle>
            <div ref={pickerRowRef} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sb-space-2)' }}>
              {/* 未锁定 = 中性灰虚线、零品牌紫（原则 6.3）；锁定 = 描边跟随所选颜色本身 */}
              <button
                type="button"
                aria-label="选择品牌主色"
                aria-pressed={brandLocked}
                onClick={() => setPickerOpen(open => !open)}
                style={{
                  position: 'relative',
                  /* 用户明确要求：点击区不许变小。色块/锁定按钮 ≥36px
                     （改造前 30px）→ --sb-control-lg(36)。 */
                  width: 'var(--sb-control-lg)',
                  height: 'var(--sb-control-lg)',
                  flexShrink: 0,
                  borderRadius: 'var(--sb-radius-control)',
                  cursor: 'pointer',
                  padding: 0,
                  /* D2：锁定/未锁定**边框宽度恒定 2px**（此前 2px↔1.5px 会抖动）；
                     锁定态额外叠 ring，且描边跟随所选颜色本身（不是固定紫）。
                     未锁定态的两条声明引用 NEUTRAL_UNLOCKED 常量（唯一事实源），
                     不再内联同一组值 —— 等价写法，但消除了「多套真相」（D8）。 */
                  border: brandLocked ? `2px solid ${pickerColor}` : NEUTRAL_UNLOCKED.border,
                  boxShadow: brandLocked ? 'var(--sb-shadow-ring)' : 'none',
                  background: brandLocked ? pickerColor : NEUTRAL_UNLOCKED.background,
                }}
              />
              <input
                aria-label="品牌主色色值"
                value={brandLocked || pickerOpen ? pickerColor : ''}
                onChange={event => { setPickerColor(event.target.value); if (brandLocked) onBrandColorsChange?.([event.target.value, event.target.value]); }}
                onFocus={() => setPickerOpen(true)}
                placeholder="未锁定"
                style={{
                  flex: 1, minWidth: 0,
                  /* 与同排色块/锁定按钮同高，保证一行基线一致 */
                  height: 'var(--sb-control-lg)',
                  boxSizing: 'border-box',
                  padding: '0 var(--sb-space-3)',
                  borderRadius: 'var(--sb-radius-control)',
                  border: '1px solid var(--sb-border-default)',
                  background: 'var(--sb-surface-card)',
                  color: 'var(--sb-text-primary)',
                  fontSize: 'var(--sb-text-xs)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={toggleBrand}
                style={{
                  flexShrink: 0,
                  /* 与色块同档 ≥36px（用户「点击区不许变小」） */
                  height: 'var(--sb-control-lg)',
                  minWidth: 'var(--sb-control-min-w)',
                  padding: '0 var(--sb-space-3)',
                  borderRadius: 'var(--sb-radius-control)',
                  fontFamily: 'inherit',
                  fontSize: 'var(--sb-text-xs)',
                  fontWeight: 'var(--sb-weight-semibold)',
                  cursor: 'pointer',
                  border: brandLocked ? '1px solid var(--sb-brand)' : '1px solid var(--sb-border-default)',
                  background: brandLocked ? 'var(--sb-brand)' : 'var(--sb-surface-card)',
                  color: brandLocked ? 'var(--sb-brand-ink)' : 'var(--sb-text-secondary)',
                  transition: 'background-color var(--sb-duration-fast) var(--sb-ease-out)',
                }}
              >
                {brandLocked ? '已锁定' : '锁定'}
              </button>
            </div>
            {/* ⚠️ 这里原先写的是 `brandLocked && pickerOpen` —— 于是**未锁定状态下点色块什么都不会出现**：
                按钮把 pickerOpen 置了 true，但渲染条件还要求 brandLocked，用户看到的就是「点了没反应」。
                （2026-09-15 用户批注图1-②：「我点击之后它是没有弹出那个真正的色盘，好像卡住了」。）
                现在只看 pickerOpen：打开就能调；调色即通过 onChange 写入 brandColors（= 锁定），
                与「锁定」按钮的语义一致，不需要先点锁定再调色。 */}
            {/* 取色器走 AnchoredPortal（与平台下拉同一套定位机制）——
                2026-09-15 用户批注（图6-⑩）：「调色盘展开不得被可视区截断」。
                内联渲染时它是面板文档流里的最后一块，面板一旦靠近视口底部就会被裁掉；
                AnchoredPortal 在下方放不下时会**自动翻到上方**，并夹在视口安全边距内，
                随滚动/resize 重新定位。高度 128 → 168，取色更从容。 */}
            <AnchoredPortal
              anchorRef={pickerRowRef}
              open={pickerOpen}
              onDismiss={() => setPickerOpen(false)}
              align="start"
              minWidth={240}
              maxWidth={260}
            >
              <div style={{ borderRadius: 'var(--sb-radius-card)', overflow: 'hidden', border: '1px solid var(--sb-border-subtle)', background: 'var(--sb-surface-card)' }}>
                <HexColorPicker color={pickerColor} onChange={color => { setPickerColor(color); onBrandColorsChange?.([color, color]); }} style={{ width: '100%', height: 168 }} />
              </div>
            </AnchoredPortal>
          </div>
        )}
      </div>
    </div>
  );
}
