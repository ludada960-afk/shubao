/* ═══════════════════════════════════════════════════════════════════════
   画布 · 统一视觉语言（对齐首页规范，不另发明一套）
   ═══════════════════════════════════════════════════════════════════════

   2026-09-17 用户要求：「首页面板刚刚定稿的统一视觉语言规范，请你在画布侧对齐
   —— 同一维度必须同一套视觉语言」。

   规范真源在 src/pages/Home/ec/panelVisualLanguage.js。**本文件只做转出与画布侧
   的取值收敛，绝不重新定义数值** —— 首页改一处，画布跟着变，不会再出现两条线各调各的。

   ── 收口前实测（画布侧偏离项） ─────────────────────────────────────
     · 面板宽度：右侧功能栏 360 / 派生浮层 432 / 套图面板 min(400,…) /
                参数弹层各写各行 —— 与首页统一的 480 不一致。
     · 字号：EcCanvas.css 里有 **57 处 < 11px**（9px / 9.5px / 10px / 10.5px），
       右侧面板与派生菜单各有 10 / 10.5px —— 正是首页已经废掉的档位
       （用户批注「清晰度这些模块做得特别小」，9-10px 在 2K 屏不可读）。
     · 间距：1/2/3/4/5/6/8/10/12/14/16 混用，没有 4pt 阶梯。
     · 控件高度：22/24/26/27/28/30/32/34/38 混杂，点击区低于 32px 的有好几处。

   ── 本文件的用法 ─────────────────────────────────────────────────
     · JS 侧：直接复用首页那几个常量对象（SPACING / FONT_SIZE / …），本文件转出；
     · CSS 侧：由 canvasVisualLanguageCssVars() 产出 CSS 变量，
       在画布根节点 inline 注入，CSS 里只写 var(--cvl-*)，不再写魔法数字。
     · 面板宽度：CSS 用 var(--cvl-panel-width)（= resolvePanelWidth(视口宽)），
       由 useCanvasPanelWidth() 在 resize 时更新，保证窄屏也不横向溢出。
   ═══════════════════════════════════════════════════════════════════════ */

/* 钩子必须显式引入 —— 画布有专门的守卫测试（canvas-hook-import-guard-0913）
   挡这一类"esbuild 不报错但运行时 useXxx is not defined"的事故。
   注意：注释里不要出现 "import ... from 'react';" 的字样，
   否则会串进守卫测试的匹配窗口。 */
import { useEffect, useState } from 'react';
import {
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  CONTROL_HEIGHT,
  RADIUS,
  PANEL_WIDTH,
  TEXTAREA_RESIZE,
  resolvePanelWidth,
} from '../Home/ec/panelVisualLanguage.js';

/* ── 直接转出首页规范（唯一真源，画布不覆盖） ── */
export {
  SPACING,
  FONT_SIZE,
  FONT_WEIGHT,
  CONTROL_HEIGHT,
  RADIUS,
  PANEL_WIDTH,
  TEXTAREA_RESIZE,
  resolvePanelWidth,
};

/** 点击区下限：任何可点元素都不低于 32px（首页 control.compact） */
export const MIN_HIT_AREA = CONTROL_HEIGHT.compact;

/* ═══════════════════════════════════════════════════════════════════════════
   控件槽位宽度规范（2026-09-17 用户批注 · 最高优先级，四个生成框全部适用）
   ═══════════════════════════════════════════════════════════════════════════

   用户原话（看着图片生成面板 @ → GPT Image 2.5 Sunburst → 自动/1:1 → 2K → x2 → 技能 → 生成）：
     「你这里做的也不对。就是你模型选这种名字比较长的，为什么你的按钮还是会往右边去
      挤呢？你的文字也往右边去挤了呢？我的意思是你的文字要往右边去挤，但是不能够
      超出这个按钮的框。你现在整体的规则都要弄明白、全面，所有东西都要搞明白这个
      逻辑再去做，避免文字把整个按钮给拉长了，然后把整个框都给做歪了。现在的情况
      就是互相挤压了，你明白吗？」

   并且指着**视频生成的视频模型下拉**说：「你看一下这个视频生成的选模型的这个地方，
   它这个逻辑就是对的：就是字太长的话，你就让它长，你就让它右边有一部分显示不出来，
   没有关系，但是你绝对不能够让整个按钮跟着你的文字去变宽。」
   → 「你现在这四个生成的框全部都要按照这套逻辑来做。」

   ── 定死的规则（四条，缺一不可） ─────────────────────────────────────
    ① **槽位宽度固定**：每个控件位（模型 / 比例 / 分辨率 / 张数 / 技能 / 套图方案 /
       SKU / 商品信息 / 内容规范 / 时长 / 画幅 …）的宽度由布局网格给定，
       **绝不随文案长度变化**。禁止 width:auto、禁止内容撑开、
       禁止 flex 里让文字参与宽度分配（文字所在元素必须 min-width:0 可收缩）。
       → CSS 实现：flex: 0 1 <固定basis>（视频面板用的就是这个，是唯一正确写法）。
         绝不能用 flex: 0 0 auto（= 内容自适应，正是"文字把按钮拉长"的根因）。
    ② **只在槽位内部向右溢出裁切**：overflow:hidden + white-space:nowrap，
       **不要** text-overflow: ellipsis、**不要**省略号字符、**不要**换行、**不要**缩小字号。
       右边看不全没关系。
    ③ **短文案（四字）必须完整显示**：固定槽位宽度按最长的短标签来定，
       保证四字/五字标签不被裁；只有模型名这种长文案才被裁。
    ④ **控件之间固定间距**（8pt 阶梯）：任何文案长度下整行布局不变形、
       不互相挤压、不把面板撑歪。

   ── 收口前实测（图片生成框，1440 视口，同一面板） ──────────────────────
     模型从「MDKJ Super」换成「GPT Image 2.5 Sunburst」，**其余控件跟着变形**：
       · 生图模型槽  77.57px → 105.22px   （+27.65，文字把按钮拉长了）
       · 自动/1:1    63.45px →  52.23px   （-11.22，被挤窄）
       · 2K          36.35px →  29.92px   （-6.43）
       · x1          35.23px →  29.01px   （-6.22）
       · 技能        54.40px →  54.40px
       · 整行 offsetWidth 425 → 416，最右内容右缘在动 = 「互相挤压」。
     这正是用户看到的症状。修法：四个框全部改成固定槽位。

   ── 槽位宽度取值依据 ────────────────────────────────────────────────
     图片框底栏实测可用宽度 = 生成框 640 - 面板内边距；视频框 = 434。
     槽位按「最长短标签 + 图标 + 内边距」定宽，四字标签一律放得下：
       四字标签 4×13px = 52px 文字 + 图标 14 + 间距 6 + 内边距 20 ≈ 92px → 取 96px。
     模型槽是唯一长文案槽，给最大固定位（详见下面 SLOT_WIDTH.model）。 */

/** 槽位宽度（px）：固定值，与文案长度无关。四个生成框共用同一张表。
 *
 *  取值依据 = 实测「最长短标签完整显示」所需宽度：
 *    槽位 = 左内边距 10 + 图标 12 + 图标与文字间距 6 + 文字宽 + ChevronDown 12 + 右内边距 10
 *    文字按 --cvl-font-body = 12px 中文（1 字 ≈ 13px、ASCII ≈ 7px）实测：
 *      「自动 / 1:1」= 50px → 88
 *      「2K」/「4K」 = 23px → 64   （图片框清晰度只有 1K/2K/4K）
 *      「x4」        = 22px → 64
 *      四字标签（智能套图/SKU变体/商品信息/内容规范） = 52px → 104
 *        （104 = 文字 52 + 图标 14 + 图标间距 5 + 左右内边距 18 + ChevronDown 12 + 余量 3
 *          —— 90px 会把这几个四字标签裁成「智能套」「商品信」，实测过，不行）
 *  校验：套图参数行内容盒 = 638 - 2×18 = 602；
 *        6 格（@44 + 5×104）+ 5×8 gap = 604 ≈ 602 —— 刚好落满且四字全显。
 *  视频框行宽不同（它的控件是「标题在上控件在下」两行结构），见下面 videoSlots()。 */
export const SLOT_WIDTH = Object.freeze({
  /* @ 引用：只有一个圆形按钮，固定窄位 */
  mention: 44,
  /* ═══ 模型槽：2026-09-28 批 CY-⑫ **75 → 132**（用户原话，逐字）══════════════════════════════════
     用户原话：「我之前不是跟你说过了吗？就是如果名称太长的话，你后面就可以截断的，用户是不会在意的。
       但是你不能像这样**粗暴的去截断**呀。你这个阶段应该得是比如说你现在其他的按钮，它**后面不是有一个
       箭头的符号吗？那你这里为什么没有符号呢**？还有就是你为什么这个按钮做的**这么的小**呢？
       它不是**模型选择按钮**吗？模型选择按钮不应该这么小呀。」
     ⇒ 75 是**不要用省略号、右边看不全没关系**那个时代的取值（见文件顶部那段历史）：它把模型名裁到
       只剩「GPT Image…」，**连后面那个箭头也一起裁掉了** —— 那是粗暴，用户点名了。
     新口径：模型是**选择按钮**，槽位给足（132 = 「GPT Image 2」完整 + 图标 + 间距 + 箭头 + 内边距），
       更长的名字仍然在这槽内**向右裁切**（保持不写省略号那条老规矩），但**箭头永远在**。 */
  model: 132,
  /* ═══ 2026-09-28 批 CY-⑬ 新增：**「生成配置」合并槽** ══════════════════════════════════════════════
     用户原话（逐字）：「然后你这几块按钮**明明可以合成一块按钮**啊。什么尺寸，清晰度，数量
       这些都是可以放在同一个**生成配置**里面去呀。」
     ⇒ 比例(88) + 清晰度(64) + 数量(64) 三格共 216px + 2 个 8px 间距 = 232px，
       收成**一颗**两行摘要触发器后，槽位必须一次给足，否则「2K · 1:1 · x4」这种摘要会被裁
       —— 那就又回到"看不全"的老问题，等于把三颗小药丸的毛病搬到一颗大按钮上。
     128 的构成：左内边距 8 + 标记图标 18 + 间距 5 + 摘要文字 ≈70 + ChevronDown 12 + 右内边距 8 + 余量 7。
     改后图片/文案框底栏合计：@44+8+模型132+8+配置128+8+技能104 = **432 ≤ 434**（行内容盒，实测值）。 */
  config: 128,
  /* 比例 / 画幅：最长「自动 / 21:9」 */
  ratio: 88,
  /* 清晰度：最长「4K」/「2K」 */
  resolution: 64,
  /* 张数：最长「x4」 */
  count: 64,
  /* 时长：最长「12 秒」 */
  duration: 80,
  /* 技能 / 智能套图 / SKU变体 / 商品信息 / 内容规范：四字标签位
     （必须 ≥104，否则四字标签会被裁成三字 —— 实测 90 会裁） */
  label: 104,
  /* 声音开关：固定窄位 */
  toggle: 72,
});

/** 视频框专用槽位：它的每个控件是「标题在上 + 控件在下」，标题占位更宽。
 *  行宽 = 434 - 2×12(padding) = 410；@44 + 声音72 固定 → 参数 294 可分配。
 *  实测取值保证「视频模型 / 清晰度 / 画幅 / 时长 / 技能」五个标题都不折行。 */
export const VIDEO_SLOT_WIDTH = Object.freeze({
  model: 112,
  /* 批 CY-⑬：视频框原来的「清晰度 / 画幅 / 时长」三颗原生 `<select>` 收成一颗「生成配置」
     （62+52+56+2×8 = 186 → 一颗）。摘要最坏是「720P · 16:9 · 12 秒」≈ 96px，
     148 = 内边距 16 + 标记 18 + 间距 5 + 摘要 96 + ChevronDown 12 + 余量 1。
     视频行是 flex-wrap（批 CU 已定），加宽不会溢出，只会让第二行更整齐。 */
  config: 148,
  resolution: 62,
  ratio: 52,
  duration: 56,
  label: 56,
});

/** 槽位之间的固定间距：8pt 阶梯的 sp2（= 8px），任何文案长度都不变。 */
export const SLOT_GAP = SPACING.sp2;

/* ═══════════════════════════════════════════════════════════════════════════
   画布层叠阶梯（2026-09-18 用户批注 · 第 N 次同类复发）
   ═══════════════════════════════════════════════════════════════════════════

   用户原话（打开「工作流模板」弹窗，左下角小地图卡片亮着浮在它上面）：
     「为什么我打开工作流模板，你左下角的这个地图会跟着一起进来呢？你这又是什么奇怪的
      逻辑呀？」

   根因：画布浮动层**各写各的 z-index**，没有统一的层叠权威 ——
   实测 EcCanvas.css 里有 47 处 z-index，取值 1/2/3/4/5/7/8/9/10/11/15/30/35/40/42/
   58/70/72/80/82/90/95/100/130/140/1900/2000/10000/10002/10003 全是就地拍脑袋，
   所以每加一个弹窗就漏一个 HUD。

   本阶梯是**唯一权威**：新增浮层必须从 Z 取值，不得再写裸数字。
   层级从低到高：
     canvas      画布内容（节点、连线、参考底图）
     overlay     节点选择框 / 框选 / 缩放手柄（浮在内容上，但仍在内容层内）
     panel       右侧结果面板
     hud         浮动 HUD：小地图 / 缩放条 / 底部操作栏 / 节点计数卡
     popover     弹出层：引用素材 / 模型 / 技能 / @ / 派生菜单 / 参数弹层
     toolbar    节点上的悬浮工具条（对象工具条 / 文本工具条 / 多选工具条）
     composer    节点生成框（独立编辑面板，浮在弹出层之上）
     modalScrim  弹窗遮罩
     modal       画布内弹窗本体（工作流模板 / 模板广场 / 画布库 / 资产库 / 技能库 / 图片预览 / 二次确认）
     globalToast 全局 toast / 待处理提示（永远最上层，不受弹窗影响）

   —— 关于 HUD：**打开画布内任何弹窗时，HUD 一律隐藏（display:none），不是只压暗**，
      即窗口打开期间 hud 这一档整体不渲染。由下面 canvasHudHidden() 一处判定，
      调用方（index.jsx）用同一个 "是否有弹窗打开" 状态驱动，避免下次再加弹窗又漏。 */
export const CANVAS_Z = Object.freeze({
  canvas: 1,
  overlay: 10,
  panel: 20,
  hud: 30,
  popover: 40,
  toolbar: 50,
  composer: 60,
  modalScrim: 70,
  modal: 71,
  globalToast: 90,
});

/** 层叠阶梯 → CSS 变量（注入画布根节点，CSS 里只写 var(--cvl-z-*)） */
export function canvasZCssVars() {
  return Object.fromEntries(Object.entries(CANVAS_Z).map(([k, v]) => [`--cvl-z-${k}`, String(v)]));
}

/** 画布内「是否有弹窗打开」—— **单一判定**，HUD 显隐全部由它驱动。
 *  传入各弹窗的当前状态，返回是否应当隐藏 HUD。
 *  ⚠️ 新增弹窗时：把它的开关加进这里，HUD 自动跟着隐藏，不会漏。 */
export function canvasHudHidden(flags = {}) {
  return Boolean(
    flags.workflowGalleryOpen
    || flags.canvasLibraryOpen
    || flags.assetPickerOpen
    || flags.skillLibraryOpen
    || flags.imageInfoOpen
    || flags.imagePreviewOpen
    /* 2026-10-03 用户批注（截图：小地图面板 + 左下缩放条在弹窗打开时**照样全亮**，
       并且左侧那颗 ✨ 任务按钮也还是亮的）：
       智能去字幕的**区域框选器**此前没有算进"弹窗打开"，于是 `dialogOpen` 为假，
       整档 HUD 不隐藏 —— 这一档是 `display:none`（连命中测试都退出），
       所以它是"该消失却还在"，不是"该压暗却没压暗"。

       同一个假值还连累了那颗 ✨：它是 `TaskSidebar` 的浮动触发器，
       渲染在 `.ec-canvas-page` **之外**（是它的兄弟节点），
       所以 `.ec-canvas-page.is-dialog-open ...` 这条选择器**够不着它**；
       它靠的是同一个布尔复制到 `<html data-cvl-dialog-open>`（app-sidebar.css:442）。
       ⇒ 一处漏，两处坏。补上这一行，两条一起好。 */
    || flags.videoRegionPickerOpen
    /* 资产库：它是**页签**（切走画布）而不是叠加弹窗，但仍有一层全屏遮罩
       .canvas-asset-library-overlay —— 必须一并算作"弹窗打开"，
       否则它开着时 HUD 仍可能透出来（实测该遮罩原为硬编码 z-index: 9500）。 */
    || flags.assetLibraryTab,
  );
}

/** 槽位宽度 → CSS 变量（注入到画布根节点，CSS 里只写 var(--cvl-slot-*)） */
export function canvasSlotCssVars() {
  return {
    '--cvl-slot-mention': `${SLOT_WIDTH.mention}px`,
    '--cvl-slot-model': `${SLOT_WIDTH.model}px`,
    '--cvl-slot-config': `${SLOT_WIDTH.config}px`,
    '--cvl-slot-ratio': `${SLOT_WIDTH.ratio}px`,
    '--cvl-slot-resolution': `${SLOT_WIDTH.resolution}px`,
    '--cvl-slot-count': `${SLOT_WIDTH.count}px`,
    '--cvl-slot-duration': `${SLOT_WIDTH.duration}px`,
    '--cvl-slot-label': `${SLOT_WIDTH.label}px`,
    '--cvl-slot-toggle': `${SLOT_WIDTH.toggle}px`,
    '--cvl-slot-gap': `${SLOT_GAP}px`,
    '--cvl-vslot-model': `${VIDEO_SLOT_WIDTH.model}px`,
    '--cvl-vslot-config': `${VIDEO_SLOT_WIDTH.config}px`,
    '--cvl-vslot-resolution': `${VIDEO_SLOT_WIDTH.resolution}px`,
    '--cvl-vslot-ratio': `${VIDEO_SLOT_WIDTH.ratio}px`,
    '--cvl-vslot-duration': `${VIDEO_SLOT_WIDTH.duration}px`,
    '--cvl-vslot-label': `${VIDEO_SLOT_WIDTH.label}px`,
  };
}

/* ── 画布侧的面板宽度口径 ──────────────────────────────────────────────
   与首页同一套 resolvePanelWidth：统一 480，窄屏 min(480, 视口-32) 且 ≥360，
   视口 <392 时才允许低于 360（避免横向滚动）。 */
export function canvasPanelWidth(viewportWidth) {
  return resolvePanelWidth(viewportWidth);
}

/** 右侧功能栏：画布要按同一个宽度让位，所以面板与让位共用这一个值 */
export const CANVAS_RIGHT_PANEL_MARGIN_PX = 28;

/**
 * 右侧功能栏占用的整行宽度（面板 + 两侧边距）。
 * 画布让位（.has-right-panel 的 margin-right）与派生浮层避让共用它。
 */
export const CANVAS_RIGHT_PANEL_MAX_VIEWPORT_RATIO = 0.38;

/**
 * 右侧功能栏占用的整行宽度（面板 + 两侧边距）。
 * 画布让位（.has-right-panel 的 margin-right）与派生浮层避让共用它。
 *
 * ═══ 批 CY-⑱：让位量**封顶在视口的 38%** ═══════════════════════════════════════════════════════
 *   用户原话（逐字）：「然后画布的真实显示区域也特别的小，基本上其他地方都会被遮挡，
 *     不知道是什么原因造成的。」
 *   实测（.qa/cy18-stage-width.mjs，真实 DOM，三档视口各量两遍）：
 *     视口 1920 → 右栏开：stage 1444（75%）
 *     视口 1440 → 右栏开：stage  964（67%）
 *     视口 1280 → 右栏开：stage  804（63%）
 *   根因：这里之前是「面板宽 + 28px 固定相加」，**不看视口多宽**。
 *   面板 448 + 28 = 476 —— 在 1280 的窗口上就是 37%；再窄一点（用户截图那个窗口
 *   实际不到 1000px）就**过半**，画布被压到比面板还窄，"其他地方被遮挡"就是这个。
 *   ⇒ 窄屏下宁可面板**盖住**画布右侧一小块（画布可以平移），也不能把画布本体压到失去主导。
 *   ⚠️ 9-13「面板不盖住画布内容」那条初衷**没有作废**：宽屏下让位量仍是完整的 476px、口径不变；
 *     只有当"完整让位"会吃掉超过 38% 时才收窄。
 */
export function canvasRightPanelReserved(viewportWidth, panelWidthOverride) {
  const viewport = Number(viewportWidth) || 0;
  /* ⚠️ 第二个参数是**布局真实用的那个面板宽**。
     不传就自己按视口推一次 —— 但那会与运行时对不上（实测：布局注入的 var 是 448，
     这里按 1920 推出来是 480，差 32px）。让位量必须等于「面板真实多宽 + 边距」，
     所以调用方把**它已经算好的那个面板宽**原样传进来，两个数字从此不可能再漂。 */
  const panel = Number(panelWidthOverride) > 0 ? Number(panelWidthOverride) : canvasPanelWidth(viewport);
  const full = panel + CANVAS_RIGHT_PANEL_MARGIN_PX;
  if (viewport <= 0) return full;
  return Math.min(full, Math.round(viewport * CANVAS_RIGHT_PANEL_MAX_VIEWPORT_RATIO));
}

/**
 * 画布弹层的**统一定位口径**（2026-09-20 用户确认，不可协商）。
 *
 * 用户原话：「面板依然是歪到左边去，然后依然是盖住了我们现在的素材」。
 * 实测根因：各弹层自算坐标，且部分实现把**像素**当**世界坐标**用（画布有 0.68 缩放层），
 * 右侧面板一开就把面板算到屏幕外/最左。
 *
 * 约定：
 *   ① 锚在触发元素上**向右展开**（左缘 = 锚点右缘 + gap）；
 *   ② 右侧放不下时**向下**展开（其实就是把 top 往下挪），**绝不向左翻**；
 *   ③ 面板矩形与源节点矩形**零相交**（由 ① 天然保证）。
 *
 * 返回**视口像素**的 { left, top }，调用方一律用 position:fixed 落位。
 * 纯函数、无 DOM 依赖（SSR 安全），供 portal 与内联两条路径共用同一套规则。
 */
export function resolveAnchoredRight({ anchor = null, width = 320, height = 400, gap = 12, gutter = 12, viewportWidth = 0, viewportHeight = 0, alignVertical = 'top' } = {}) {
  if (!anchor) return null;
  const vw = Number(viewportWidth) || 0;
  const vh = Number(viewportHeight) || 0;
  /* ① 向右展开：左缘贴锚点右缘。空间不足也只允许「左移到不出屏」，绝不越过锚点左缘。 */
  const wanted = (Number.isFinite(anchor.right) ? anchor.right : anchor.x + (anchor.width || 0)) + gap;
  const maxLeft = Math.max(gutter, vw - width - gutter);
  const left = Math.max(gutter, Math.min(wanted, maxLeft));
  /* ② 竖直。两种口径：
        alignVertical: 'center'（批 CY-㉛ 新增）
            面板**竖直居中于锚点**。左侧「+」在屏幕中间偏下（实测 y=533/1000），
            而面板高 728 —— 改前按「顶对齐 + 放不下就上移」算出来 top=228，
            面板中心落在 y=592、锚点中心在 y=553，看着就"偏上了 40px"，
            底部还压到 y=956（贴近视口底）。用户 2026-09-30 说的正是这个：
            「这块面板它似乎是有些偏下的，甚至是有点盖到了左下角的这个功能栏的」
        alignVertical: 'top'（**默认值，旧行为，一字未改**）
            与锚点顶对齐，放不下就上移。派生菜单 / 图层面板等沿用它，避免影响别处。 */
  const maxTop = Math.max(gutter, vh - height - gutter);
  const anchorTop = Number(anchor.y) || 0;
  const top = alignVertical === 'center'
    ? Math.max(gutter, Math.min(anchorTop + ((anchor.height || 0) - height) / 2, maxTop))
    : Math.max(gutter, Math.min(anchorTop, maxTop));
  /* ③ 报告是否发生了回夹 —— 供测试断言「没有向左翻」 */
  return { left, top, clampedRight: wanted > maxLeft };
}

/** 画布根节点的 CSS 变量（一处注入，全画布可用） */
export function canvasVisualLanguageCssVars(viewportWidth) {
  const panelWidth = canvasPanelWidth(viewportWidth);
  return {
    '--cvl-sp1': `${SPACING.sp1}px`,
    '--cvl-sp2': `${SPACING.sp2}px`,
    '--cvl-sp3': `${SPACING.sp3}px`,
    '--cvl-sp4': `${SPACING.sp4}px`,
    '--cvl-sp5': `${SPACING.sp5}px`,
    '--cvl-sp6': `${SPACING.sp6}px`,
    '--cvl-font-group-title': `${FONT_SIZE.groupTitle}px`,
    '--cvl-font-field-label': `${FONT_SIZE.fieldLabel}px`,
    '--cvl-font-body': `${FONT_SIZE.body}px`,
    '--cvl-font-helper': `${FONT_SIZE.helper}px`,
    '--cvl-weight-group-title': String(FONT_WEIGHT.groupTitle),
    '--cvl-weight-field-label': String(FONT_WEIGHT.fieldLabel),
    '--cvl-weight-body': String(FONT_WEIGHT.body),
    '--cvl-control-compact': `${CONTROL_HEIGHT.compact}px`,
    '--cvl-control-base': `${CONTROL_HEIGHT.base}px`,
    '--cvl-control-large': `${CONTROL_HEIGHT.large}px`,
    '--cvl-radius-control': `${RADIUS.control}px`,
    '--cvl-radius-card': `${RADIUS.card}px`,
    '--cvl-radius-panel': `${RADIUS.panel}px`,
    '--cvl-panel-width': `${panelWidth}px`,
    /* 兼容既有变量名（画布让位一直用它），值改由规范推导 */
    '--canvas-right-panel-width': `${panelWidth}px`,
    '--cvl-right-panel-margin': `${CANVAS_RIGHT_PANEL_MARGIN_PX}px`,
    /* 控件槽位（固定宽度，与文案长度无关） */
    ...canvasSlotCssVars(),
    /* 层叠阶梯（唯一权威） */
    ...canvasZCssVars(),
  };
}

/** 视口宽（SSR/测试环境下回落到 1440，保证取值稳定可测） */
export function readViewportWidth() {
  const width = Number(globalThis.innerWidth);
  return Number.isFinite(width) && width > 0 ? width : 1440;
}

/** 面板宽度随视口变化（窄屏不横向溢出），画布根节点用它注入变量 */
export function useCanvasPanelWidth() {
  const [width, setWidth] = useState(() => canvasPanelWidth(readViewportWidth()));
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const next = canvasPanelWidth(readViewportWidth());
      setWidth(current => (current === next ? current : next));
    };
    const onResize = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    window.addEventListener('resize', onResize);
    /* 首次挂载也校准一次：SSR/预渲染宽度可能与真实视口不同 */
    update();
    return () => {
      window.removeEventListener('resize', onResize);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return width;
}
