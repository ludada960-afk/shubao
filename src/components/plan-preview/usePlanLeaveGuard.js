/* ═══ 离开子页面时问一声「这份方案会丢」（2026-09-26 批 BX）═══════════════════════════════════
   用户口径（逐字）：「用户**退出这个子页面时提示他确定退出吗**，这个方案或脚本会丢失。」
   —— 方案/脚本是用户**花过 0.5 积分**拿到的东西；在它被"确认应用"回工作台之前直接走人，
      等于把这份钱和这份方案一起扔掉，而且**没有任何提示**。

   覆盖三条出口：顶栏「返回」、左侧导航、刷新/关标签页（`beforeunload`）。
   判据与文案在 `planPreviewModel.js`（纯函数，能单独验）；这里只负责挂事件、弹确认、放行。
   触发方式照 `EcCanvas` 那次"离开画布问一声"的做法：**捕获阶段**监听 document 的点击，
   拦截 → 问 → 确认后才用同一次点击继续导航。 */
import { useEffect, useRef } from 'react';

import { PLAN_LEAVE_CONFIRM, isLeavingSubpage } from './planPreviewModel.js';
import { useDialog } from '../ui/DialogProvider.jsx';

export { isLeavingSubpage };

/* active = "手上有一份没应用的方案/脚本"（弹窗里已经生成出来、还没写回工作台）。 */
export function usePlanLeaveGuard(active, { copy = {} } = {}) {
  const dialog = useDialog();
  const activeRef = useRef(active);
  activeRef.current = active;
  const bypassRef = useRef(false);
  const confirmingRef = useRef(false);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const handleCapture = async event => {
      if (bypassRef.current || !activeRef.current || confirmingRef.current) return;
      /* 只处理普通左键：新开标签页/新窗口那种走法本来就不算"离开这一页"。 */
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest('button, a') : null;
      if (!isLeavingSubpage(target)) return;
      event.preventDefault();
      event.stopPropagation();
      confirmingRef.current = true;
      let leave = false;
      try { leave = await dialog.confirm({ ...PLAN_LEAVE_CONFIRM, ...copy }); } catch { leave = false; }
      confirmingRef.current = false;
      if (!leave) return;
      bypassRef.current = true;
      target.click();
      /* 放行标记只对**这一次**点击有效：点完立刻复位，别把下一次也放过去。 */
      window.setTimeout(() => { bypassRef.current = false; }, 0);
    };
    const handleBeforeUnload = event => {
      if (!activeRef.current) return undefined;
      event.preventDefault();
      /* 现代浏览器忽略自定义文案，但仍要写 returnValue 才会出原生确认框 */
      event.returnValue = '';
      return '';
    };

    document.addEventListener('click', handleCapture, true);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('click', handleCapture, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dialog, copy]);
}
