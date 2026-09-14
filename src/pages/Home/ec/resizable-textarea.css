import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TEXTAREA_RESIZE, resolveResizedHeight, SPACING, RADIUS, FONT_SIZE, CONTROL_HEIGHT } from './panelVisualLanguage.js';
import './resizable-textarea.css';

/**
 * ResizableTextarea —— 统一的多行输入框（右下角可拉伸）
 *
 * 2026-09-15 用户批注：
 *   「这些输入区都特别小……我觉得每一个输入框右下角还是得有一个可以拉伸的按钮，
 *     可以拉长当前这个框的高度，但这样就得往下面再做一些适配」
 *
 * 为什么不用 CSS `resize: vertical`（这是「一拉就直接往下面截断了」的根因）：
 *   技能库的文本域是 flex 弹性项（flex:1 1 clamp(...) + height:100%）。
 *   CSS resize 改的是元素的 inline height，随即被 flex 的 basis/stretch 覆写，
 *   用户看到的就是「拉一下立刻弹回去 / 直接被容器裁断」。
 *   所以这里改成受控组件：pointermove 直接改 state 里的高度值，
 *   高度是真值而非被覆写的建议值，容器再按内容自适应。
 *
 * 几何约束（用户批注「往下面再做一些适配」）：
 *   minHeight ≤ height ≤ min(maxHeight, 容器可视区剩余高度)
 *   到顶之后输入框内部滚动，而不是被面板/弹窗裁断。
 */
export default function ResizableTextarea({
  value,
  onChange,
  placeholder,
  minHeight = TEXTAREA_RESIZE.minHeight,
  maxHeight = TEXTAREA_RESIZE.maxHeight,
  /** 面板可视区内「还能给出多少高度」——由调用方实测传入，缺省不设容器上限 */
  available = null,
  rows,
  className = '',
  style,
  'aria-label': ariaLabel,
  ...rest
}) {
  const [height, setHeight] = useState(minHeight);
  const ref = useRef(null);
  const dragRef = useRef(null);

  /* 拖拽：pointerdown 抓取 → pointermove 改高度 → pointerup 释放。
     用 setPointerCapture 保证指针移出元素后依然跟随。 */
  const onPointerDown = useCallback((event) => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startHeight = ref.current?.getBoundingClientRect().height || height;
    dragRef.current = { startY: event.clientY, startHeight };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [height]);

  const onPointerMove = useCallback((event) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
    setHeight(resolveResizedHeight({
      startHeight: drag.startHeight,
      deltaY: event.clientY - drag.startY,
      minHeight,
      maxHeight,
      available,
    }));
  }, [minHeight, maxHeight, available]);

  const endDrag = useCallback((event) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }, []);

  /* 键盘可达：手柄是可聚焦的，上下方向键各调 8px（无障碍，不改变鼠标语义） */
  const onHandleKeyDown = useCallback((event) => {
    const step = event.key === 'ArrowUp' ? -SPACING.sp2 : event.key === 'ArrowDown' ? SPACING.sp2 : 0;
    if (!step) return;
    event.preventDefault();
    setHeight(current => resolveResizedHeight({
      startHeight: current, deltaY: step, minHeight, maxHeight, available,
    }));
  }, [minHeight, maxHeight, available]);

  /* 容器可视区变化（窗口缩放）后，可能已经超上限 → 立即收敛，避免被裁断 */
  useEffect(() => {
    if (!Number.isFinite(available) || available <= 0) return;
    setHeight(current => Math.max(minHeight, Math.min(current, Math.max(minHeight, Math.min(maxHeight, available)))));
  }, [available, minHeight, maxHeight]);

  return (
    <div
      className={`rsz-textarea ${className}`.trim()}
      style={{ '--rsz-height': `${height}px`, '--rsz-handle': `${TEXTAREA_RESIZE.handleSize}px` }}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        aria-label={ariaLabel}
        /* resize:none —— 真正的拉伸由右下角手柄接管（见文件头注释） */
        style={{
          width: '100%',
          boxSizing: 'border-box',
          height: 'var(--rsz-height)',
          minHeight,
          maxHeight: Number.isFinite(available) && available > 0 ? Math.min(maxHeight, available) : maxHeight,
          padding: `${SPACING.sp2}px ${SPACING.sp3}px`,
          paddingBottom: SPACING.sp5,
          borderRadius: RADIUS.control,
          border: '1px solid rgba(45,41,38,0.12)',
          background: '#fff',
          color: 'var(--text-primary)',
          fontSize: FONT_SIZE.body,
          lineHeight: 1.6,
          fontFamily: 'inherit',
          outline: 'none',
          /* 到顶后内部滚动，而不是被容器裁断 */
          overflowY: 'auto',
          ...style,
        }}
        {...rest}
      />
      <span
        role="separator"
        aria-orientation="horizontal"
        aria-label="拖拽调整高度"
        tabIndex={0}
        className="rsz-textarea-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onHandleKeyDown}
        style={{ minHeight: CONTROL_HEIGHT.compact }}
      />
    </div>
  );
}
