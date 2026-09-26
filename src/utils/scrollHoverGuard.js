/* ══════════════════════════════════════════════════════════════════════════════════════════════
   2026-09-26 批 BT：**滚动期间的"假悬停"防护**

   用户批注（逐字）：「这你看不出来吗，就是我鼠标放在这块区域，他**默认第一个按钮会有亮起来的交互**，
   但是我鼠标明明没放在第一个按钮上呀」

   实测（用户截图逐像素 + 实机 `:hover` 判定，脚本 .qa/bt-hover-diag.mjs / .tmp/bt-shot-measure.mjs）：
     · 截图里「1:1 方图」底色 `#f1f1f0` = `--sb-surface-tint-strong`（**悬停态**的底色），
       而「3:4 竖版海报」才是选中态 ⇒ 浏览器确实把 1:1 判成 hovered；
     · 实机在组内 6 个采样点问浏览器"谁 :hover"：**只有真正在光标下的那颗**命中，缝隙/空白都不命中。
   两者合起来只指向一个经典现象：**滚轮滚动不产生鼠标事件**，浏览器不会重新计算光标下是谁 ——
   滚动前停在光标下的那颗按钮，**滚动后仍然保持 :hover 的高亮**（内容已经移走，视觉上就成了
   "我没指它，它却亮着"）。

   ⇒ 修法：滚动期间**整体关闭悬停态**。
     · 这里只做"状态标记"：滚动中给 <html> 加 data-scrolling，停下 150ms 后清掉；鼠标一动也立刻清掉。
     · 样式侧把悬停规则加一道 `html:not([data-scrolling])` 前缀（见各控件 CSS），
       于是滚动那一下悬停态**回到静止**，松手后鼠标一动又恢复 —— 不需要重写任何静止态数值。
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

const SCROLLING_ATTR = 'scrolling';
const IDLE_MS = 150;

let installed = false;

export function installScrollHoverGuard(doc = globalThis.document, win = globalThis.window) {
  if (installed || !doc || !win) return () => {};
  installed = true;

  const root = doc.documentElement;
  let timer = 0;

  const stop = () => {
    if (timer) { win.clearTimeout(timer); timer = 0; }
    root.removeAttribute(`data-${SCROLLING_ATTR}`);
  };
  const markScrolling = () => {
    root.setAttribute(`data-${SCROLLING_ATTR}`, '1');
    if (timer) win.clearTimeout(timer);
    /* 停下 150ms 后清掉：这段时间里若用户把鼠标移到别的按钮上，浏览器会重新算 hover，
       而那时 data-scrolling 已经摘掉，悬停态正常出现。 */
    timer = win.setTimeout(stop, IDLE_MS);
  };

  /* capture: true —— 页面里很多滚动发生在内层容器（左栏、下拉、时间线），
     冒泡阶段的 window 监听拿不到这些滚动事件。 */
  win.addEventListener('scroll', markScrolling, { passive: true, capture: true });
  /* 鼠标一动就立刻结束"滚动中"状态：用户真的把光标移到某颗按钮上时，悬停必须马上可用。 */
  win.addEventListener('mousemove', stop, { passive: true });
  win.addEventListener('pointerdown', stop, { passive: true });

  return () => {
    win.removeEventListener('scroll', markScrolling, { capture: true });
    win.removeEventListener('mousemove', stop);
    win.removeEventListener('pointerdown', stop);
    if (timer) win.clearTimeout(timer);
    root.removeAttribute(`data-${SCROLLING_ATTR}`);
    installed = false;
  };
}
