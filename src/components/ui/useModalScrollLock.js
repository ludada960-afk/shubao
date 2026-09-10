import { useEffect } from 'react';

/**
 * 弹窗滚动锁（2026-09-10 用户反馈：会员中心打开后滚动会把弹窗顶上去/截断）。
 * 打开期间锁住 html/body 滚动，关闭时精确还原；多个弹窗叠开时计数安全
 * （每个实例恢复自己打开前的值，后关的实例不会把先开的锁提前解除——因为每个实例
 * 都保存了自己挂载时的 overflow，而叠开场景下后开者的"打开前的值"本身就是被前者锁住的 hidden）。
 */
let lockCount = 0;

export function useModalScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    const root = document.documentElement;
    const body = document.body;
    const previous = {
      rootOverflow: root.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    lockCount += 1;
    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.overscrollBehavior = 'none';
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        root.style.overflow = previous.rootOverflow;
        body.style.overflow = previous.bodyOverflow;
        body.style.overscrollBehavior = previous.bodyOverscroll;
      }
    };
  }, [active]);
}
