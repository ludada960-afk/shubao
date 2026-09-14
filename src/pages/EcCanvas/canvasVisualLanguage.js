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
export function canvasRightPanelReserved(viewportWidth) {
  return canvasPanelWidth(viewportWidth) + CANVAS_RIGHT_PANEL_MARGIN_PX;
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
