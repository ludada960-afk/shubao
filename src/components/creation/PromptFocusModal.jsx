import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import MentionPromptField from './MentionPromptField.jsx';

/* ══════════════════════════════════════════════════════════════════════════════
   提示词「放大输入」弹窗（批 CY-㉞）

   用户 2026-09-30 逐字（图8）：
     「然后我点击输入框这里的全屏按钮，为什么你会是这样的一个展现方式呀？
       你难道没有搞明白全屏按钮是干什么的吗？
       **他是把你当前这个输入框他的输入区给放大呀。**
       你其实只需要做一个弹窗，然后这个弹窗跟我们现在的这个区域是一样的。
       只是他的**输入框会变得更大**。让用户可以一次性看到更多的文字。
       因为正常来说用户输入的提示词是会很多的，但是我们的首页并没有办法一次性看全
       那么多的文字，这个全屏按钮的目的就是想让用户能够**快速地看到尽可能多的提示词**。」

   改前的行为：`VisualCreationMode` 与 `VideoStudio` 的那颗按钮都走**浏览器原生
   Fullscreen API**（`node.requestFullscreen()`）。
   ⇒ 用户看到的是**操作系统级的全屏**：浏览器自己的「若要退出全屏模式，请按 Esc」
   提示条压在最上面，而输入框**并没有变大**（只是整页被撑满了）。
   也就是说：按钮叫「全屏」，做出来也真是全屏，但**不是用户要的那个东西**。

   ⇒ 改成一个页内弹窗：内容与当前那块区域**一致**（同一套 @ 引用、同一份文字、
   同一套上限），**只有输入框变大**，一次能看到更多提示词。
   ⚠️ **不再调用 requestFullscreen** —— 用户要的是「看得更多」，不是「占满显示器」；
     原生全屏还会吞掉浏览器的工具栏与 Esc 提示，是操作系统层面的东西。
   ══════════════════════════════════════════════════════════════════════════════ */

export default function PromptFocusModal({
  open = false,
  onClose,
  value = '',
  mentions = [],
  onChange,
  onFilesPasted,
  maxLength = 0,
  title = '编辑提示词',
  emptyHint = '还没写提示词 —— 直接在这里写就行，改完自动带回下面。',
}) {
  const fieldRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    /* 打开就把光标放进输入区：这是"快速改几个字"的入口，不是"先看一眼"的弹窗 */
    const timer = setTimeout(() => fieldRef.current?.focus?.(), 30);
    const onKey = event => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="prompt-focus-backdrop"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="prompt-focus-card" role="dialog" aria-modal="true" aria-label={title}>
        <header className="prompt-focus-head">
          <strong>{title}</strong>
          <button type="button" className="prompt-focus-close" onClick={() => onClose?.()} aria-label="关闭">
            <X size={15} />
          </button>
        </header>
        {String(value || '').trim() ? (
          /* 与页面里那一个**同一个组件**（不是另写一个 textarea）：
             这样 @ 提及的蓝色高亮、字数上限、粘贴上传图片全都自动一致。 */
          <MentionPromptField
            ref={fieldRef}
            id="prompt-focus-field"
            value={value}
            mentions={mentions}
            onChange={onChange}
            onFilesPasted={onFilesPasted}
            maxLength={maxLength}
            placeholder="在这里修改提示词……"
            className="prompt-focus-field"
          />
        ) : (
          <p className="prompt-focus-empty">{emptyHint}</p>
        )}
        <footer className="prompt-focus-foot">
          <small>改完会自动带回下面的输入区，不需要再点一次保存。</small>
          <button type="button" className="prompt-focus-done" onClick={() => onClose?.()}>完成</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
