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

   ── 1. 间距阶梯（8pt 栅格，4 为唯一允许的半档：图标↔文字） ─────────────
     sp1  4   图标 ↔ 文字；不可再分的行内微调
     sp2  8   标签 ↔ 控件（Label → Control）；同排控件互间
     sp3 12   控件 ↔ 控件（上下相邻字段）；组内并列项
     sp4 16   分组 ↔ 分组（Section → Section）
     sp5 20   分组标题 ↔ 内容（Group title → content）
     sp6 24   面板内边距（Panel padding）；面板 ↔ 视口安全边距

   ── 2. 字号层级（4 档，每档语义唯一） ─────────────────────────────────
     fontSize.groupTitle 13 / 700   分组标题（「生图模型」「清晰度」）
     fontSize.fieldLabel 12 / 600   字段标签（「产品尺寸」「核心卖点」）
     fontSize.body       12 / 400   正文、输入框内容、选项说明
     fontSize.helper     11 / 400   辅助说明、徽标、脚注
   刻意不留 9px/10px：用户批注「清晰度这些模块做得特别小」——
   9-10px 在 2K 屏上不可读，全部并入 11px 辅助档。

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
  /** 8 标签 ↔ 控件；同排控件互间 */
  sp2: 8,
  /** 12 控件 ↔ 控件（上下相邻字段） */
  sp3: 12,
  /** 16 分组 ↔ 分组 */
  sp4: 16,
  /** 20 分组标题 ↔ 内容 */
  sp5: 20,
  /** 24 面板内边距 */
  sp6: 24,
});

export const FONT_SIZE = Object.freeze({
  groupTitle: 13,
  fieldLabel: 12,
  body: 12,
  helper: 11,
});

export const FONT_WEIGHT = Object.freeze({
  groupTitle: 700,
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

/** 分组标题：13/700，与内容 20px */
export const groupTitleStyle = Object.freeze({
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.sp1,
  fontSize: FONT_SIZE.groupTitle,
  fontWeight: FONT_WEIGHT.groupTitle,
  color: 'var(--text-primary)',
  lineHeight: 1.4,
});

/** 字段标签：12/600，与控件 8px */
export const fieldLabelStyle = Object.freeze({
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.sp1,
  fontSize: FONT_SIZE.fieldLabel,
  fontWeight: FONT_WEIGHT.fieldLabel,
  color: 'var(--text-secondary)',
  lineHeight: 1.4,
});

/** 辅助说明：11/400 */
export const helperTextStyle = Object.freeze({
  fontSize: FONT_SIZE.helper,
  fontWeight: FONT_WEIGHT.helper,
  color: 'var(--text-muted)',
  lineHeight: 1.5,
});

/** 输入框：36 高 / 8 圆角 / 12 字号 */
export const inputStyle = Object.freeze({
  width: '100%',
  boxSizing: 'border-box',
  height: CONTROL_HEIGHT.base,
  padding: '0 12px',
  borderRadius: RADIUS.control,
  border: '1px solid rgba(45,41,38,0.12)',
  background: '#fff',
  color: 'var(--text-primary)',
  fontSize: FONT_SIZE.body,
  fontFamily: 'inherit',
  outline: 'none',
});

/** 分组容器：标题 ↔ 内容 20px，分组 ↔ 分组 16px（由父级 gap 提供） */
export const sectionStyle = Object.freeze({
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.sp5,
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
   （否则用户会以为「你已经帮他选了紫色」）。 */
export const NEUTRAL_UNLOCKED = Object.freeze({
  border: '1.5px dashed rgba(45,41,38,0.28)',
  background: 'repeating-conic-gradient(rgba(0,0,0,0.06) 0% 25%, transparent 0% 50%) 50% / 8px 8px',
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
