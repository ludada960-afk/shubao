import React, { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 6 位分段验证码输入 (2026-09-08 登录重构)
 * - 单输入源 + 分段展示: 天然支持粘贴、退格、长按删除、输入法
 * - inputMode=numeric + autoComplete=one-time-code: 移动端数字键盘 & iOS 短信/邮件验证码自动填充
 * - 填满自动回调 onComplete (父级做提交, 自身不发起请求)
 */
export default function OtpCodeInput({
  value = '',
  onChange,
  onComplete,
  onEnter,
  length = 6,
  autoFocus = false,
  disabled = false,
  invalid = false,
  label = '验证码',
  describedBy,
}) {
  const inputRef = useRef(null);
  const completeRef = useRef(false);
  const [focused, setFocused] = useState(false);
  const digits = String(value || '').replace(/\D/g, '').slice(0, length);
  const activeIndex = Math.min(digits.length, length - 1);
  const boxes = Array.from({ length }, (_, index) => digits[index] || '');

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (digits.length < length) completeRef.current = false;
  }, [digits.length, length]);

  const focusInput = useCallback((position) => {
    const node = inputRef.current;
    if (!node) return;
    node.focus();
    const target = typeof position === 'number' ? position : node.value.length;
    try { node.setSelectionRange(target, target); } catch { /* 非文本输入忽略 */ }
  }, []);

  // 显式粘贴处理：从任意文本（含空格/横线/整段邮件）中提取数字验证码
  const handlePaste = (event) => {
    const text = event.clipboardData?.getData('text') || '';
    const next = text.replace(/\D/g, '').slice(0, length);
    if (!next) return;
    event.preventDefault();
    completeRef.current = false;
    onChange?.(next);
    if (next.length === length) {
      completeRef.current = true;
      onComplete?.(next);
    }
  };

  const handleChange = (event) => {
    const next = event.target.value.replace(/\D/g, '').slice(0, length);
    onChange?.(next);
    if (next.length === length && !completeRef.current) {
      completeRef.current = true;
      onComplete?.(next);
    }
  };

  return (
    <div
      className={'ld-otp' + (invalid ? ' is-invalid' : '')}
      onClick={() => focusInput()}
      role="group"
      aria-label={label}
    >
      {boxes.map((digit, index) => {
        const isActive = focused && index === activeIndex && !disabled;
        return (
          <span
            key={index}
            className={
              'ld-otp-box' +
              (digit ? ' is-filled' : '') +
              (isActive ? ' is-active' : '') +
              (invalid && digit ? ' is-error' : '')
            }
            aria-hidden="true"
          >
            {digit || (isActive ? <span className="ld-otp-caret" /> : '')}
          </span>
        );
      })}
      <input
        ref={inputRef}
        className="ld-otp-input"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        value={digits}
        disabled={disabled}
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={handleChange}
        onPaste={handlePaste}
        onFocus={() => { setFocused(true); focusInput(digits.length); }}
        onBlur={() => setFocused(false)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); onEnter?.(); }
        }}
      />
    </div>
  );
}
