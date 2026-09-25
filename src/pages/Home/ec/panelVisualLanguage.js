/* ═══════════════════════════════════════════════════════════════════════
   首页参数面板 · 统一视觉语言规范（Single Source of Truth）
   ═══════════════════════════════════════════════════════════════════════

   2026-09-15 用户批注：「没有视觉逻辑、小气、主次不分、像硬塞进来的」
   「你要有整体规划思维：一个面板塞好几个项目，但每个项目之间没有主次、
     标题和内容挤在一块，大小和交互都没有统一视觉语言，感觉是硬塞进来的。
     我需要你重新设计它们的布局、大小、呼吸感、整体视觉语言、间隙。」

   根因（实测确认，不是感觉）：
     · 六个浮层面板宽度各写各的 —— 实测 settings 460 / sizing 480 /
       sku 540 / params 520 / copy 620，同一个触发条弹出来的东西宽度全不一样，
       所以「有的宽有的窄」；copy 620 太宽 → 信息被拉散。
     · 每个面板各自定义字号（9/10/11/12/13/14px 六档混用）与间距
       （1/2/3/4/5/6/8/10/12/14/16px 十档混用），没有阶梯 → 「挤在一块」。
     · 控件高度 26/28/30/32/38/42 混杂 → 「控件特别小、没有统一视觉语言」。

   本模块是「唯一事实源」：所有面板必须从这里取值，禁止在面板里写魔法数字。
   改这里 = 六个面板同时改，不会出现「逐个瞎调」。

   ── 1. 间距阶梯（4pt 栅格上的 6 个语义档） ──────────────────────────
     sp1  4   图标 ↔ 文字；不可再分的行内微调
     sp2  8   标签 ↔ 控件（Label → Control）；同排控件互间
     sp3 12   控件 ↔ 控件（上下相邻字段）；组内并列项
     sp4 16   分组 ↔ 分组（Section → Section）
     sp5 20   分组标题 ↔ 内容（Group title → content）
     sp6 24   面板内边距（Panel padding）；面板 ↔ 视口安全边距
   全部落在 4pt 栅格上（4 的倍数），且刻意只保留这 6 档：
   4/8 用于行内与「标签↔控件」，12/16/20/24 用于层级递进。
   改造前是 1/2/3/4/5/6/8/10/12/14/16 十档混用 —— 那才是「挤在一块」的来源。

   ── 2. 字号层级（4 档，每档语义唯一） ─────────────────────────────────
     fontSize.groupTitle 13 / 700   分组标题（「图片类型」「避免出现的元素」）
     fontSize.fieldLabel 12 / 600   字段标签（「目标平台」「产品尺寸」「核心卖点」）
     fontSize.body       12 / 400   正文、输入框内容、选项说明
     fontSize.helper     11 / 400   辅助说明、徽标、脚注
   刻意不留 9px/10px：用户批注「清晰度这些模块做得特别小」——
   9-10px 在 2K 屏上不可读，全部并入 11px 辅助档。

   ⚠️ 2026-09-15 二次对齐（用户批注图5-②）：本表一直写着 fieldLabel = 12，
      但 TEXT_ROLE.fieldLabel 实际是 **11** —— **文档与代码互相打架**，
      上一轮我就是照着这份错文档以为已经统一了。现已把代码对齐到真值 12，
      并补契约测试锁死「FONT_SIZE.fieldLabel === TEXT_ROLE.fieldLabel.size」。

   ── 3. 控件高度（点击区 ≥32px，用户批注「输入区都特别小」） ────────────
     control.compact 32  紧凑控件（分段控件、比例选择器、SKU 行内输入）
     control.base    36  标准单行输入 / 下拉 / 次级按钮
     control.large   40  主按钮、主 CTA
   实测基线：改造前清晰度分段控件只有 30px、比例选择器 26px、
   SKU 行内输入 32px —— 混杂且偏小，统一抬高到上面三档。

   ── 4. 圆角 ──────────────────────────────────────────────────────────
     radius.control 8    输入框 / 按钮 / 色块
     radius.card   12    卡片、分组容器
     radius.panel  20    浮层面板本体

   ── 5. 面板宽度（用户批注「宽度都是统一的，不能太宽…也不能粗暴匹配」） ──
     panelWidth.standard 480   六个面板的统一宽度（≥360 且 ≤560 口径内）
     panelWidth.min      360   窄屏下限
     panelWidth.max      560   宽屏上限
   为什么是 480：面板内是「标签↔控件」的单列/双列表单，480px 时双列每列
   约 220px，中文标签 + 输入内容都在舒适阅读宽度内；620（改造前的 copy）
   会把双列拉到每列 292px，眼睛要在两个远点之间来回跳 → 「信息被分散掉」。
   窄屏兜底：min(480, 视口宽 - 32)，再夹到 ≥360；视口 <392 时才允许低于 360。

   ── 6. 多行输入框拉伸交互（用户批注「每一个输入框右下角还是得有一个
        可以拉伸的按钮，可以拉长当前这个框的高度」） ────────────────────
     手柄    右下角 12×12 抓取区（斜纹 SE 角标），hover/focus 变实心
     方式    pointerdown 抓取 → pointermove 改高度 → pointerup 释放
             （不用 CSS resize:vertical —— 见下）
     下限    minHeight（默认 72，即约 4 行）
     上限    容器可视区剩余高度（= 面板可视高 - 已用高度 - 留白），
             再夹到 maxHeight（默认 320）；到顶后内部滚动，不裁切
     记忆    拖过的值写回 state，面板重开仍生效
   为什么不用 CSS resize:vertical：实测技能库文本域是 flex 弹性项
   （flex:1 1 clamp(...) + height:100%），CSS resize 改的是 inline height，
   被 flex 的 basis/stretch 立刻覆写 → 「一拉就直接往下面截断了，
   根本没有办法拉动」。所以改为受控组件：拖拽直接改 state 里的高度值。

   ── 7. 六面板宽度/间距对照（改造前 → 改造后） ────────────────────────
     面板       改造前宽  改造后宽  内边距      分区间距
     生成设置    460       480      24/20      16
     套图方案    480       480      24/20      16
     SKU变体     540       480      24/20      16
     商品信息    520       480      24/20      16
     内容规范    620       480      24/20      16
   ═══════════════════════════════════════════════════════════════════════ */

export const SPACING = Object.freeze({
  /** 4 图标 ↔ 文字（唯一允许的半档） */
  sp1: 4,
  /** 8 字段标签 ↔ 它的控件；同排控件互间 */
  sp2: 8,
  /** 12 控件 ↔ 控件；分组标题 ↔ 它的内容 */
  sp3: 12,
  /** 16 分组 ↔ 分组 */
  sp4: 16,
  /** 20 面板左右内边距 */
  sp5: 20,
  /** 24 面板上下内边距 */
  sp6: 24,
});

export const FONT_SIZE = Object.freeze({
  groupTitle: 13,
  fieldLabel: 12,
  body: 12,
  helper: 11,
});

/* ═══════ 主次阶梯（2026-09-15 用户批注：图3-②）═══════
   用户原话：「你像这个目标平台、目标语言，它这 8 个字跟下面的这个淘宝还有这个中文这几个字的
   选项框，他们的字好像是一样大的，对吧？你为什么要这样去设计呢？这样搞得就真的没有任何主次
   之分了……但是你至少得让用户知道这是一个选项吧，这是一个可以被操作的一个部分吧。」

   实测根因：标签 12px/600，控件值 11px/600 —— **标签比它还大**，两者同级，于是整片糊在一起。

   规则（只有一条，够用且可判）：
     · **控件值（value）永远比它的字段标签（fieldLabel）更重**：更大 + 更深的墨色；
     · 标签回答「这格叫什么」，值回答「这格现在是什么」—— 用户要读的是值；
     · 未选中的控件也必须看得出「可以操作」（有边、有底、带箭头），只是不抢眼。
   判据（可写进契约）：value.size > fieldLabel.size，且 value 的墨色比 fieldLabel 深。 */
export const TEXT_ROLE = Object.freeze({
  /** 分组标题：一组内容的名字，最重
   *  ═══ 2026-09-25 批 BK：**13/700 → 14/800**（用户改向，逐字）══════════════════════════════════
   *  「不管视频生成还是图片生成，你这些面板里面的标题……标题你可以**加粗，再大一点用黑色**的，
   *    我觉得就可以了。」（另一句：「标题就应该是被加粗的呀，不加粗的话，它能叫标题吗？
   *    你可能所有页面都存在这些问题。」） */
  groupTitle: Object.freeze({ size: 14, weight: 800, tone: 'var(--sb-ink-1)' }),
  /** 控件值：用户真正要读、要改的东西。必须比字段标签重 */
  value: Object.freeze({ size: 13, weight: 600, tone: 'var(--sb-text-primary)' }),
  /** 字段标签：「这格叫什么」。比控件值轻一档，但不许「素」。
   *
   *  2026-09-15 用户批注两句话一起改这里（图4-① / 图5-②）：
   *    · 「你的这些小标题都太素了。就是太简单了，感觉就像个demo一样。」 → 11 抬到 **12**；
   *    · 「避免出现的元素……又大又加深，这些东西都跟他们不一样。」 →
   *      根因不是那个标题太大，而是**标签太小太浅**，落差被放大成「参差不齐」。
   *      所以标签抬到 12/ink-2，分组标题保持 13/ink-1，两档只差 1px + 一个字重，
   *      层级靠**图标 + 间距（分组标题上方 sp4）**区分，而不是靠悬殊字号。 */
  fieldLabel: Object.freeze({ size: 12, weight: 600, tone: 'var(--sb-ink-2)' }),
  /** 辅助说明：描述/单位/提示，最轻 */
  helper: Object.freeze({ size: 11, weight: 400, tone: 'var(--sb-ink-3)' }),
});

/** 把 TEXT_ROLE 展开成内联样式，避免每个面板各写一份 size/weight/tone。 */
export function textRoleStyle(role) {
  const spec = TEXT_ROLE[role] || TEXT_ROLE.value;
  return { fontSize: spec.size, fontWeight: spec.weight, color: spec.tone };
}

/* ═══════ 图标尺寸档（2026-09-15 用户批注图3-③ / 图4-③）═══════
   用户两轮都在说同一件事：
     · 「现在这 5 个图标他们都有点太老土了，完全就是那种很简单的那种 demo 版的东西」；
     · 「你这个图标跟你的这个打钩的框怎么是一样大的？」
   所以图标必须**成体系**：每一档只有一个用途，且「说明性图标」与「状态标记」永远不同尺寸。

     分组标题图标 14   跟着 13px 分组标题走（图标略大于字号，视觉才配重）
     字段标签图标 12   跟着 12px 字段标签走
     行内提示图标 12   辅助说明条 / 状态提示
     类型徽章图形 22   图片类型那种「这是什么」的徽章里的图形
     类型徽章底   36   徽章底板边长（= 勾选框 16 的 2.25 倍）

   最后一条是**判据**：「这是什么」（徽章 36）与「选中了没有」（勾选框 16）
   必须差到不可能看错。上一轮我做的是 28 vs 18（1.56 倍），用户复核时仍然
   认为一样大 —— 1.5 倍在这个尺寸下不够，改到 2.25 倍。
   下一轮如果再被说「一样大」，改的是**形态**（方形 vs 圆形），不是继续放大。 */
/* ═══════ 内容识别色族（2026-09-16 用户批注图3-②）═══════
   用户原话：「你现在这些框都是都是紫色的也很单一啊……你好歹要有一些动效和交互效果和配色差异啊，
   主色次色和主次都要深度的处理啊」。
   实测根因：图片类型那四个 tile 全都用**同一个** --sb-state-selected-bg（品牌浅紫）当底，
   四个一样 → 用户看到的自然是「全部是紫色」「很单一」。
   规则：**识别色（这是哪一类东西）与状态色（选中了没有）是两套颜色**，不许混用：
     · 状态色 = 品牌紫（选中/当前），全站唯一，见 --sb-state-selected-*；
     · 识别色 = 下面这五族，按「这一类东西是什么」分配，**同一类永远同一个色**。
   取值全部来自既有语义色族（brand / info / success / warning / danger），不新造颜色。
   ⚠️ 不给中性灰之外的新色值；改动只在 accent 键与 tile 的映射上。 */
export const ACCENT = Object.freeze({
  violet: Object.freeze({ ink: 'var(--sb-brand-700)', soft: 'var(--sb-brand-50)', line: 'var(--sb-brand-200)' }),
  blue: Object.freeze({ ink: 'var(--sb-ink-info)', soft: 'var(--sb-info-soft)', line: 'var(--sb-info-border)' }),
  green: Object.freeze({ ink: 'var(--sb-ink-success)', soft: 'var(--sb-success-soft)', line: 'var(--sb-success-border)' }),
  amber: Object.freeze({ ink: 'var(--sb-ink-warning)', soft: 'var(--sb-warning-soft)', line: 'var(--sb-warning-border)' }),
  rose: Object.freeze({ ink: 'var(--sb-ink-danger)', soft: 'var(--sb-danger-soft)', line: 'var(--sb-danger-border)' }),
  neutral: Object.freeze({ ink: 'var(--sb-ink-2)', soft: 'var(--sb-surface-tint)', line: 'var(--sb-border-subtle)' }),
});

/** 取一族识别色的内联样式（tile 用 soft 底 + ink 图形 + line 描边）。 */
export function accentStyle(name, { filled = false } = {}) {
  const accent = ACCENT[name] || ACCENT.neutral;
  return {
    color: filled ? 'var(--sb-brand-ink)' : accent.ink,
    background: filled ? accent.ink : accent.soft,
    borderColor: filled ? accent.ink : accent.line,
  };
}

export const ICON_SIZE = Object.freeze({
  groupTitle: 14,
  fieldLabel: 12,
  inline: 12,
  typeGlyph: 22,
  typeTile: 36,
  /** 图片类型行的勾选框边长 —— 与 typeTile 是「状态」vs「身份」两种语义，不许同大 */
  typeCheckbox: 16,
  /* 生图模型下拉里的品牌图标底座（用户批注图6-⑨：「图标做大」）。
     22/24 → 28/32：上一版图标在 44px 高的整行里只占 22，四周全是空，观感偏弱，
     而这一行是面板里最重要的选择（选错模型 = 整批图重出）。 */
  modelTrigger: 28,
  modelOption: 32,
});

export const FONT_WEIGHT = Object.freeze({
  groupTitle: 800,   /* 批 BK：700 → 800（用户："标题就应该是被加粗的"） */
  fieldLabel: 600,
  body: 400,
  helper: 400,
});

export const CONTROL_HEIGHT = Object.freeze({
  compact: 32,
  base: 36,
  large: 40,
});

export const RADIUS = Object.freeze({
  control: 8,
  card: 12,
  panel: 20,
});

/* 面板宽度：统一档 + 窄屏夹逼。
   夹逼顺序很重要：先按「视口宽 - 32」压，再夹到 [min, max]，
   但视口本身小于 min 时不能把面板夹到比视口还宽（否则出现横向滚动）。 */
export const PANEL_WIDTH = Object.freeze({ standard: 480, min: 360, max: 560 });

/**
 * 计算某个面板的实际像素宽度。
 * @param {number} viewportWidth 视口宽（window.innerWidth）
 * @returns {number} 面板宽度，保证 ≤ 视口宽 - 32，且尽量落在 [360, 560]
 */
export function resolvePanelWidth(viewportWidth) {
  const vw = Number(viewportWidth);
  if (!Number.isFinite(vw) || vw <= 0) return PANEL_WIDTH.standard;
  const available = vw - 32;
  /* 视口比下限还窄（<392px）：直接吃满可用宽度，不强行撑到 360 造成横向滚动 */
  if (available <= PANEL_WIDTH.min) return Math.max(240, available);
  return Math.min(PANEL_WIDTH.standard, available, PANEL_WIDTH.max);
}

/* ── 面板共用视觉常量（供 inline style 直接展开） ── */

/** 分组标题：13/700，与内容 20px。
 *  ⚠️ 用法约束（2026-09-15 统一后）：分组标题**必须带 ICON_SIZE.groupTitle 的图标**。
 *     不带图标的散装 13/700 一出现，就会变成用户说的「标题的设计方式参差不齐」——
 *     上一轮「图片类型」就是这么裸着的，而「避免出现的元素」有图标，两者看起来像两套系统。
 *     判据：面板里不允许出现没有图标的裸 groupTitleStyle（契约测试 ⑩ 在守）。 */
export const groupTitleStyle = Object.freeze({
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.sp1,
  fontSize: FONT_SIZE.groupTitle,
  fontWeight: FONT_WEIGHT.groupTitle,
  color: 'var(--sb-ink-1)',
  lineHeight: 1.4,
});

/** 字段标签：走 TEXT_ROLE.fieldLabel（11/600/ink-3），与控件值 8px 间距。
 *  2026-09-15 起与主次阶梯对齐 —— 标签必须比它标注的控件值**轻一档**（用户批注图3-②）。 */
export const fieldLabelStyle = Object.freeze({
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.sp1,
  ...textRoleStyle('fieldLabel'),
  lineHeight: 1.4,
});

/** 辅助说明：11/400 */
export const helperTextStyle = Object.freeze({
  fontSize: FONT_SIZE.helper,
  fontWeight: FONT_WEIGHT.helper,
  color: 'var(--sb-ink-3)',
  lineHeight: 1.5,
});

/** 输入框：36 高 / 8 圆角 / 12 字号 */
/** 输入框：36 高 / 8 圆角 / 12 字号
 *
 * ⚠️ 2026-09-15 用户批注（图5-①）：「你这个信息面板怎么就变成一个极简风了呢？就是黑字白底
 * 这种极简风了呢。它是我们现在视觉语言的这种设计风格吗？」
 * 实测根因就在这两行：
 *   · `border: 1px solid rgba(45,41,38,0.12)` —— **硬编码冷灰**，不是 token，也不随主题变；
 *   · `background: var(--sb-neutral-0)` —— 纯白原色，而 `--sb-neutral-0` 是**不随主题翻转**的
 *     品牌原色（其它面板的控件用 --sb-surface-tint / --sb-surface-card）→ 暗色主题下这些
 *     输入框会变成**白框**，既割裂又刺眼。
 * 这正是「面板之间长得不像一套东西」的系统性来源：inputStyle 是全站面板共用的，
 * 所以在这里修一次，所有面板（商品信息 / SKU / 套图 / 内容规范）一起对齐。 */
export const inputStyle = Object.freeze({
  width: '100%',
  boxSizing: 'border-box',
  height: CONTROL_HEIGHT.base,
  padding: `0 ${SPACING.sp3}px`,
  borderRadius: RADIUS.control,
  border: '1px solid var(--sb-border-default)',
  background: 'var(--sb-surface-card)',
  color: 'var(--sb-ink-1)',
  fontSize: FONT_SIZE.body,
  fontFamily: 'inherit',
  outline: 'none',
});

/* ⚠️ 这里**曾经**有 sectionStyle（gap = sp5 20px），2026-09-15 删除。
   删它不是收拾，是修 bug：它被当成「字段标签 + 控件」的容器用了 5 处，
   于是同一个面板里出现两种「标签 ↔ 控件」间距 ——
     ParamsPanel 的「品类 → 输入框」是 20px，而紧挨着的「产品尺寸 → 输入框」是 8px。
   用户批注（图5-③）「品类与输入框间距过大」说的就是这一处；
   同一批批注里「标题设计方式参差不齐」也包含它。
   现在统一走 fieldStackStyle（sp2 = 8）。 */

/** 字段栈：字段标签 + 它的控件（以及控件下方的辅助说明）。
 *  间距 **sp2(8)** —— 标签必须紧贴它标注的控件，这是「谁标注谁」的视觉绑定。
 *  ⚠️ 别拿它当「分组容器」：分组标题 ↔ 内容走 sp3(12)，分组 ↔ 分组走 sp4(16)。
 *  ⚠️ 也不要用它去装「分组标题 + 整组内容」—— 那会让标题与内容的距离小于组与组的距离，
 *     层级在视觉上就塌了。 */
export const fieldStackStyle = Object.freeze({
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.sp2,
});

/** 面板根容器：内边距 24 上下 / 20 左右，分组之间 16px */
export const panelBodyStyle = Object.freeze({
  padding: `${SPACING.sp6}px ${SPACING.sp5}px`,
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.sp4,
});

/* 中性「未锁定」态：用户批注「默认肯定是没有锁定任何颜色的」。
   未锁定 = 中性灰虚线描边 + 棋盘底，绝不能用紫色描边
   （否则用户会以为「你已经帮他选了紫色」）。

   2026-09-15 V3 更新：
     · 描边宽度 1.5px → **2px**，与锁定态（2px solid）**等宽** ——
       D2（40-decisions）要求「不改变边框宽度」，否则切换锁定态会抖动布局；
     · 颜色改用 V3 token（--sb-border-strong = 暖中性），不再硬编码 rgba；
     · 棋盘底同样走 token（--sb-surface-tint）。
   本常量是「未锁定态」的**唯一事实源**：面板必须引用它，不得各自内联同一组值
   （否则又是一处「多套真相」，正是 D8 要治的病）。 */
export const NEUTRAL_UNLOCKED = Object.freeze({
  border: '2px dashed var(--sb-border-strong)',
  /* 棋盘格：无颜色填充，纯中性底纹 */
  background: 'repeating-conic-gradient(var(--sb-surface-tint) 0% 25%, transparent 0% 50%) 50% / 8px 8px',
});

/** 锁定态：描边跟随所选颜色本身（不是固定紫色） */
export function lockedSwatchStyle(color) {
  return { border: `2px solid ${color}`, background: color };
}

/* ── 多行输入框拉伸规格 ── */
export const TEXTAREA_RESIZE = Object.freeze({
  /** 手柄抓取区边长 */
  handleSize: 12,
  /** 默认下限（≈4 行正文） */
  minHeight: 72,
  /** 默认上限 */
  maxHeight: 320,
  /** 面板底部留白：上限计算时扣掉，保证不被截断 */
  bottomSafeGap: 16,
});

/**
 * 计算多行输入框拉伸时的新高度（受控组件用）。
 * 关键约束：不超过「容器可视区」—— 用户批注「一拉就直接往下面截断了」。
 * @param {object} p
 * @param {number} p.startHeight 按下时的高度
 * @param {number} p.deltaY      指针纵向位移（向下为正）
 * @param {number} p.minHeight   下限
 * @param {number} p.maxHeight   上限
 * @param {number} p.available   容器可视区里还能给出的最大高度（可选）
 * @returns {number} 夹逼后的高度（整数）
 */
export function resolveResizedHeight({ startHeight, deltaY, minHeight, maxHeight, available }) {
  const min = Number.isFinite(minHeight) ? minHeight : TEXTAREA_RESIZE.minHeight;
  /* 上限取三者最小：配置上限、容器可用高度、绝不低于下限 */
  const configuredMax = Number.isFinite(maxHeight) ? maxHeight : TEXTAREA_RESIZE.maxHeight;
  const containerMax = Number.isFinite(available) && available > 0 ? available : Infinity;
  const max = Math.max(min, Math.min(configuredMax, containerMax));
  const raw = (Number.isFinite(startHeight) ? startHeight : min) + (Number.isFinite(deltaY) ? deltaY : 0);
  return Math.round(Math.min(max, Math.max(min, raw)));
}

/** 六个面板的统一宽度（像素）—— 供测试与画布侧对照 */
export const PANEL_WIDTH_TABLE = Object.freeze({
  settings: PANEL_WIDTH.standard,
  sizing: PANEL_WIDTH.standard,
  sku: PANEL_WIDTH.standard,
  params: PANEL_WIDTH.standard,
  copy: PANEL_WIDTH.standard,
});
