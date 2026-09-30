/* ══════════════════════════════════════════════════════════════════════════════
   画布「真正看得见的」视口尺寸（批 CY-㉚）

   用户 2026-09-30 逐字：
     「当地图上出现右边的派生面板时，你小地图这里显示的当前视窗的这个锁定框。
       他右边就会缩小一点点。然后当我关掉这个派生面板的话，他这个框的右边就会再多出一点点。」

   根因（本地真浏览器量，2000x1000 窗口、右面板开着）：
     `.ec-canvas-stage` 的 `clientWidth` = **1524**
     而右侧面板是靠 stage 上的 `margin-right` 让位的（批 CY-⑱ 那条 `min(…, 38vw)`）
     ⇒ 用户**实际能看到的画布只有 1524 − 476 = 1048**

   改前把 `clientWidth`（1524）直接当"视口尺寸"喂给 CanvasMinimap
   ⇒ 视窗框被高估 **45.4%**；关掉面板时 margin 归零、clientWidth 变 2000，框又涨回去
   ⇒ 用户看到的正是「右边缩小一点点 / 再多出一点点」。

   ⚠️ 关键区别：`clientWidth` 是**布局宽度**（不含 margin 的视觉让位），
   而视窗框要表达的是「我现在**看得见**多大一片画布」—— 两者差的就是那些 margin。
   这与批 CY-㉖/㉗ 踩的坑同源：**别把"布局尺寸"当成"用户可见尺寸"**。
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * @param {object|null} element      画布容器（通常是 .ec-canvas-stage）
 * @param {object} [fallback]        取不到元素时的兜底
 * @param {(el: Element) => CSSStyleDeclaration|null} [readStyle] 便于测试注入
 */
export function readCanvasVisibleViewport(element, fallback = { width: 1440, height: 900 }, readStyle) {
  if (!element) return { width: fallback.width, height: fallback.height };
  const style = readStyle || (el => (globalThis.getComputedStyle ? globalThis.getComputedStyle(el) : null));
  const cs = style(element);
  const num = (name) => Math.max(0, parseFloat(cs && cs[name]) || 0);
  const width = (element.clientWidth || 0) - num('marginLeft') - num('marginRight');
  const height = (element.clientHeight || 0) - num('marginTop') - num('marginBottom');
  return {
    // 兜底到 fallback：拿不到有效值时宁可给一个保守值，也不要给 0（0 会让视窗框消失）
    width: width > 0 ? width : fallback.width,
    height: height > 0 ? height : fallback.height,
  };
}
