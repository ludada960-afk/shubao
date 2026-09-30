import { useEffect } from 'react';

import { acquirePageScrollLock } from './useModalScrollLock.js';

/* ═══ 2026-09-29 批 DC 续-18：这一整个文件的行为被**推翻**了** ═══════════════════════════════════
   原来（2026-09-11 用户批注那一版）干的是**相反**的事：
   > 「面板打开期间页面不得滚动，滚轮滚到哪里都只滚『当前面板』」
   > —— 面板外：`preventDefault()` 并把 `deltaY` **累加到面板 scrollTop**（原 handleWheel 29-32 行）。

   那正是用户 2026-09-29 逐字要改掉的东西：
   > 「他们好像全局都是把这种按钮张开面板的时候，如果用户去滚动鼠标滚轮的话，**面板就会自动关闭**。
   >   我们现在的情况是……这个面板只要是张开的状态，**它会跟着滚动**，这其实可能会造成很多的 bug。
   >   我觉得还不如就照他那种做法，就是当张开面板的时候，用户滚动鼠标滚轮这个面板就会自己关掉。
   >   **你全局都要去实现这个方案。**」

   ⇒ 这个 hook 现在**只做一件事**：面板开着时把**页面**锁住（底下别跟着滚）。
     "滚一下就关"由各调用方自己接 `useDismissOverlay(open, close)` ——
     那一侧才知道**怎么关**（首页是 setActiveConfigPanel(null)、子页面是 setOpen(null)），
     在这里猜是没有意义的。
   ⚠️ **不再** `preventDefault`、**不再**把滚轮喂给面板 —— 那两行是"面板跟着滚"的全部来源，
     也是用户说"可能会造成很多的 bug"里最直接的一条。
   ⚠️ 名字、导出签名、`DEFAULT_PANEL_SELECTOR` 全部保持不变：
     `EcMode.jsx:538` 与 `VisualCreationMode.jsx:403` 两处调用点**不用动**
     （`panelSelector` 仍进依赖，签名兼容）。 */
export const DEFAULT_PANEL_SELECTOR = '.ec-config-panel, .visual-config-panel, [data-wheel-scroll-panel="true"]';

export function usePanelScrollLock(open, { panelSelector = DEFAULT_PANEL_SELECTOR } = {}) {
  useEffect(() => {
    if (!open) return undefined;
    if (typeof document === 'undefined' || typeof window === 'undefined') return undefined;
    /* 面板开着时底下别跟着滚（共享计数，与弹窗叠加也安全，不会把页面锁死）。 */
    const release = acquirePageScrollLock();
    return () => release();
  }, [open, panelSelector]);
}

export default usePanelScrollLock;
