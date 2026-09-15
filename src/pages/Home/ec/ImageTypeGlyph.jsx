import React from 'react';
import { ACCENT, ICON_SIZE } from './panelVisualLanguage.js';
import './imageTypeTile.css';

/* ═══════════════════════════════════════════════════════════════════════
   图片类型图标：一套自己画的 duotone 图形（2026-09-15）
   ═══════════════════════════════════════════════════════════════════════

   用户两轮批注，说的是同一件事：
     · 图3-③「现在这 5 个图标他们都有点太老土了，完全就是那种很简单的那种 demo 版
        的东西……你要知道要做的是一些比较先进的视觉方案，而不是说用一些 demo 的、
        用一些占位的东西放上去。」
     · 图4-③「你这个图标跟你的这个打钩的框怎么是一样大的？」

   ── 为什么不再用图标库（lucide）────
   上一版直接取 lucide 的 Square / Image / Scissors / Rows3 —— 问题不是 lucide 不好，
   而是**它们是通用图标**：Square 和 Scissors 放在一起既不构成一套，也和「白底首图 /
   透明 PNG」的真实语义对不上（剪刀 ≠ 去底）。用户说的「demo 感」正来自这里：
   通用图标 = 占位符的观感。

   ── 这一套的设计语言（四条，必须同时成立）────
     ① **同一块底板**：每个图形都有同一个圆角方底板（opacity .14）—— 这是「一套」的来源；
     ② **duotone**：全部用 currentColor + 两档透明度（.14 底 / 1 主体 / .3~.6 次体），
        所以自动跟随主题与选中态，**不需要也不允许写死颜色**（写死就必然在暗色主题下崩）；
     ③ **画的是版式，不是物件**：白底首图 = 板 + 居中主体 + 地面投影；商品主图 = 画面 + 两行
        卖点条；透明 PNG = 棋盘底 + 抠出的主体；详情切片 = 一页分段的长图。
        用户扫一眼就知道「这一行会给我什么版式」，而不是猜一个抽象符号；
     ④ **尺寸成体系**：图形 22、底板 36（ICON_SIZE），与勾选框 16 差 2.25 倍 ——
        「这是什么」（身份）与「选中了没有」（状态）不可能看错。

   ⚠️ 如果下一轮还被说「一样大」，要改的是**形态**（方形勾选框 vs 圆形状态点），
      不是继续放大尺寸 —— 继续放大会撞到 48px 行高上限。 */

/* ═══ 每类图片一个识别色（2026-09-16 用户批注图3-②）═══
   用户原话：「你现在这些框都是都是紫色的也很单一啊……你好歹要有一些动效和交互效果和配色差异啊，
   主色次色和主次都要深度的处理啊」。
   实测根因：四个 tile 原先**共用同一个品牌浅紫底** —— 四个一模一样，当然是「全部是紫色」「很单一」。
   分配依据是「这一类东西是什么」，不是装饰（同一类永远同一个色）：
     白底首图 = 蓝  → 中性、干净、货架感（平台白底图）
     商品主图 = 紫  → 品牌主色，最常用的一类
     透明 PNG = 绿  → 素材/再加工（去底后可二次使用）
     详情切片 = 琥珀 → 长图、信息密度高
     竖版主图 = 中性（legacy 项，不参与识别）
   色值全部取自既有语义色族（见 panelVisualLanguage.ACCENT），不新造任何颜色。 */
const TYPE_ACCENT = Object.freeze({
  whiteBg: 'blue',
  mainText: 'violet',
  transparent: 'green',
  detail: 'amber',
  mainPortrait: 'neutral',
});

/** 共用底板：整套图标「长得像一家人」的唯一来源。 */
const PLATE = <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="currentColor" opacity="0.14" />;

const GLYPHS = Object.freeze({
  /** 白底首图：浅底板 + 居中主体 + 地面投影 */
  whiteBg: (
    <>
      {PLATE}
      <rect x="8.8" y="6.4" width="6.4" height="10.4" rx="2.8" fill="currentColor" />
      <rect x="6.6" y="18.3" width="10.8" height="1.6" rx="0.8" fill="currentColor" opacity="0.38" />
    </>
  ),
  /** 商品主图：画面 + 两行卖点条（这一行是会带文字的） */
  mainText: (
    <>
      {PLATE}
      <rect x="5.6" y="5.6" width="7.6" height="7.6" rx="2.4" fill="currentColor" />
      <rect x="5.6" y="15.2" width="12.8" height="1.9" rx="0.95" fill="currentColor" opacity="0.6" />
      <rect x="5.6" y="18.2" width="8.2" height="1.9" rx="0.95" fill="currentColor" opacity="0.34" />
    </>
  ),
  /** 透明 PNG：棋盘格（透明的通用符号）+ 被抠出来的主体 */
  transparent: (
    <>
      <rect x="2.5" y="2.5" width="9.5" height="9.5" rx="3" fill="currentColor" opacity="0.22" />
      <rect x="12" y="2.5" width="9.5" height="9.5" rx="3" fill="currentColor" opacity="0.1" />
      <rect x="2.5" y="12" width="9.5" height="9.5" rx="3" fill="currentColor" opacity="0.1" />
      <rect x="12" y="12" width="9.5" height="9.5" rx="3" fill="currentColor" opacity="0.22" />
      <rect x="8.6" y="7.3" width="6.8" height="9.4" rx="3.4" fill="currentColor" />
    </>
  ),
  /** 详情切片：一页可以往下拼的长图（首段是图，其余是文字段） */
  detail: (
    <>
      {PLATE}
      <rect x="5.4" y="5.8" width="5.6" height="4.8" rx="1.6" fill="currentColor" />
      <rect x="12.2" y="5.8" width="6.4" height="1.9" rx="0.95" fill="currentColor" opacity="0.5" />
      <rect x="12.2" y="8.7" width="4.2" height="1.9" rx="0.95" fill="currentColor" opacity="0.3" />
      <rect x="5.4" y="12.4" width="13.2" height="1.9" rx="0.95" fill="currentColor" opacity="0.5" />
      <rect x="5.4" y="15.4" width="13.2" height="1.9" rx="0.95" fill="currentColor" opacity="0.3" />
    </>
  ),
  /** 竖版主图（3:4）。2026-09-15 起面板上不再有这一行（3:4 归平台管），
   *  但 main_3x4 这个角色仍在试穿链路里存在 —— 留着这个图形，别让它掉回通用图标。 */
  mainPortrait: (
    <>
      {PLATE}
      <rect x="7.4" y="4.6" width="9.2" height="14.8" rx="3" fill="currentColor" opacity="0.85" />
    </>
  ),
});

export const TYPE_GLYPH_KEYS = Object.freeze(Object.keys(GLYPHS));

/**
 * 单独的图形（无底板），必要时可嵌到别的地方。
 * @param {{iconKey: string, size?: number}} props
 */
export function ImageTypeGlyph({ iconKey, size = ICON_SIZE.typeGlyph }) {
  const glyph = GLYPHS[iconKey] || GLYPHS.whiteBg;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      aria-hidden="true" focusable="false" style={{ display: 'block' }}>
      {glyph}
    </svg>
  );
}

/**
 * 图片类型徽章 = 底板 + 图形。
 *
 *   底板同时回答两件事，**用的是两套颜色，不混用**：
 *     · 「这是哪一类」= 识别色（每类一个色，见 TYPE_ACCENT）；
 *     · 「选没选」    = 由**行**的品牌色三件套承担（见 SizingPanel 的行样式）。
 *   tile 自己的 on/off 只做「这道题有没有被勾上」的强弱差：
 *     未选 = 中性灰底 + 灰图形（身份暗下去）；选中 = 该类识别色的浅底 + 深墨图形。
 *   动效：进场轻微缩放淡入；hover 由 SizingPanel 传 hovered 触发 1.06 倍。
 *   ⚠️ 时间/easing 一律走 --sb-dur-* / --sb-ease-*，不写死 ms（RTK 教训：自造同义 token 会静默覆盖）。
 * @param {{iconKey: string, checked?: boolean, size?: number, hovered?: boolean}} props
 */
export function ImageTypeBadge({ iconKey, checked = false, size = ICON_SIZE.typeTile, hovered = false }) {
  const accent = ACCENT[TYPE_ACCENT[iconKey]] || ACCENT.neutral;
  return (
    <span aria-hidden="true" className="ec-type-tile" style={{
      width: size, height: size, flexShrink: 0,
      borderRadius: 'var(--sb-radius-lg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: checked ? accent.soft : 'var(--sb-surface-tint)',
      border: '1px solid ' + (checked ? accent.line : 'var(--sb-border-subtle)'),
      color: checked ? accent.ink : 'var(--sb-ink-4)',
      transform: hovered ? 'scale(1.06)' : 'scale(1)',
      transition: 'background-color var(--sb-dur-fast) var(--sb-ease-out), color var(--sb-dur-fast) var(--sb-ease-out), border-color var(--sb-dur-fast) var(--sb-ease-out), transform var(--sb-dur-fast) var(--sb-ease-out)',
    }}>
      <ImageTypeGlyph iconKey={iconKey} />
    </span>
  );
}

export default ImageTypeBadge;
