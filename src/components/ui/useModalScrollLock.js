import { useEffect } from 'react';

/**
 * 页面滚动锁（共享计数版）。
 * 2026-09-10 会员中心：弹窗打开期间锁住 html/body 滚动。
 * 2026-09-11 二轮用户批注（"关掉弹层后首页滚不动了"）：多个锁实例各自记录"打开前"的值,
 * 叠开时后关者会把别人锁出来的 hidden 当成原值还原 → 页面永久锁死。
 * 现在改为：首次加锁时快照一次真实原值, 计数归零时还原这份快照; 任何嵌套/叠加都安全。
 */
let lockCount = 0;
let originalSnapshot = null;

function applyLock() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const body = document.body;
  originalSnapshot = {
    rootOverflow: root.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyOverscroll: body.style.overscrollBehavior,
    bodyPaddingRight: body.style.paddingRight,
  };
  const scrollbarGap = Math.max(0, window.innerWidth - root.clientWidth);
  root.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  body.style.overscrollBehavior = 'none';
  if (scrollbarGap > 0) body.style.paddingRight = `${scrollbarGap}px`;
}

function releaseLock() {
  if (typeof document === 'undefined' || !originalSnapshot) return;
  const root = document.documentElement;
  const body = document.body;
  root.style.overflow = originalSnapshot.rootOverflow;
  body.style.overflow = originalSnapshot.bodyOverflow;
  body.style.overscrollBehavior = originalSnapshot.bodyOverscroll;
  body.style.paddingRight = originalSnapshot.bodyPaddingRight;
  originalSnapshot = null;
}

/** 手动加锁/解锁 (面板类组件用, 与弹窗共用同一份计数, 不会互相锁死) */
export function acquirePageScrollLock() {
  if (typeof document === 'undefined') return () => {};
  if (lockCount === 0) applyLock();
  lockCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) releaseLock();
  };
}

export function useModalScrollLock(active) {
  useEffect(() => {
    if (!active) return undefined;
    return acquirePageScrollLock();
  }, [active]);
}

export default useModalScrollLock;
