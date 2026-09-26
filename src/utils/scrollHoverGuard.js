/* ═══ 批 BU：把"假悬停"的**第二条触发路径**也堵上 —— 内容在鼠标底下移动（不只是滚动）══════════════
   用户第二次反馈（逐字）：「还是有啊，我鼠标没放上去，只是放在这个区域而已，第一个按钮还是会亮啊」
   我做的事：
     ① 用户截图像素级判定（.tmp/bu-shot-borders.mjs）：出问题那颗「1:1 方图」的描边是 #ccccca
        （= --sb-border-strong，**悬停态**描边）、底色 #f1f1f0（悬停 token）；
        而真正选中的「3:4 竖版海报」描边是 #1a1614（近黑，选中态）⇒ 浏览器确实把它判成 hovered。
     ② 三种视口（1600/1920/1280，含用户的 DPR=2）逐点问浏览器"谁 :hover"——**都复现不出**
        "只把鼠标放在区域里就命中第一颗"。⇒ 触发条件不在"位置"，而在"**内容动过**"：
        滚动**或布局变化**（图片加载、面板展开、分数行变化）之后，浏览器不会重算光标下是谁，
        上次落在光标下的那颗按钮就一直保持 :hover（Chromium 只在鼠标事件/部分布局事件上重算）。
   ⇒ 上一批只堵了 scroll；这一批把 resize 与"文档尺寸变化"（ResizeObserver）也纳入同一套抑制。 */

const SCROLLING_ATTR = 'scrolling';
const IDLE_MS = 200;

let installed = false;

export function installScrollHoverGuard(doc = globalThis.document, win = globalThis.window) {
  if (installed || !doc || !win) return () => {};
  installed = true;

  const root = doc.documentElement;
  let timer = 0;
  let observer = null;

  const stop = () => {
    if (timer) { win.clearTimeout(timer); timer = 0; }
    root.removeAttribute(`data-${SCROLLING_ATTR}`);
  };
  /* 任何"内容在鼠标底下移动"的信号都走这里：压制悬停态 IDLE_MS，然后自动恢复。
     ⚠️ 用 200ms 而不是更长：用户真正把鼠标移到某颗按钮上时（那会触发 mousemove ⇒ 立刻 stop），
        悬停必须马上可用；而这段窗口只覆盖"移动刚发生、鼠标还没动"的那一瞬。 */
  const markMoving = () => {
    root.setAttribute(`data-${SCROLLING_ATTR}`, '1');
    if (timer) win.clearTimeout(timer);
    timer = win.setTimeout(stop, IDLE_MS);
  };

  /* ① 滚动：capture —— 页面里大量滚动发生在内层容器（左栏 / 下拉 / 时间线），不冒泡到 window。 */
  win.addEventListener('scroll', markMoving, { passive: true, capture: true });
  /* ② 视口变化 */
  win.addEventListener('resize', markMoving, { passive: true });
  /* ③ **文档尺寸变化**：图片加载完、面板展开/收起、字段行增减都会改文档高度 ——
        这类"布局位移"同样会把别的元素挪到光标底下。只观察文档根，避免打字时的常规重渲染
        把悬停一路压死（那会让 hover 感觉"坏了"）。 */
  if (typeof win.ResizeObserver === 'function') {
    observer = new win.ResizeObserver(() => markMoving());
    observer.observe(root);
  }
  /* ④ 鼠标一动 / 一按下：立刻结束抑制（用户真的指向某颗按钮时，悬停必须马上出现）。 */
  win.addEventListener('mousemove', stop, { passive: true });
  win.addEventListener('pointerdown', stop, { passive: true });

  return () => {
    win.removeEventListener('scroll', markMoving, { capture: true });
    win.removeEventListener('resize', markMoving);
    win.removeEventListener('mousemove', stop);
    win.removeEventListener('pointerdown', stop);
    observer?.disconnect();
    if (timer) win.clearTimeout(timer);
    root.removeAttribute(`data-${SCROLLING_ATTR}`);
    installed = false;
  };
}
