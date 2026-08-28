// src/components/layout/ThemeSwitcher.jsx — P3 双主题切换按钮 (4c183cd4 续命)
//
// 行为:
// - 三态循环 light → dark → auto → light
// - 当前 mode='auto' 且系统为 dark 时显示"月亮"图标 (跟用户最终看到的视觉一致)
// - 切换时调用 setThemeMode, 自动写 localStorage + 触发 <html> 过渡动画
// - 系统 prefers-color-scheme 变化时, 如果 mode='auto' 实时同步
//
// 无障碍:
// - aria-label 在三态之间动态切换 ("切换到深色" / "切换到浅色" / "切换到跟随系统")
// - title 同步
// - keyboard 可聚焦 (button 元素), focus-visible 描边

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import {
  normalizeThemeMode,
  resolveEffectiveTheme,
  setThemeMode,
  THEME_MODES,
  THEME_DOM_ATTRIBUTE,
} from '../../utils/themeMode.js';

function getStoredOrDomMode() {
  if (typeof window === 'undefined') return 'auto';
  const fromDom = document.documentElement.getAttribute(THEME_DOM_ATTRIBUTE);
  if (fromDom && THEME_MODES.includes(fromDom)) return fromDom;
  return 'auto';
}

function nextMode(current) {
  const i = THEME_MODES.indexOf(normalizeThemeMode(current));
  return THEME_MODES[(i + 1) % THEME_MODES.length];
}

function labelForMode(mode, effective) {
  if (mode === 'auto') return '跟随系统';
  if (mode === 'dark') return '深色';
  return '浅色';
}

function ariaForMode(mode) {
  if (mode === 'light') return '切换到深色主题';
  if (mode === 'dark') return '切换到跟随系统';
  return '切换到浅色主题';
}

export default function ThemeSwitcher({ className = '' }) {
  // SSR 友好: 首次渲染直接读 <html data-theme> 而不是 localStorage,
  // 因为 initThemeMode 已经在 main.jsx 把 DOM 同步好了.
  const [mode, setMode] = useState(() => getStoredOrDomMode());
  const [systemPref, setSystemPref] = useState(() =>
    typeof window === 'undefined' || !window.matchMedia
      ? 'light'
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );

  // 跟随 system 变化
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (ev) => setSystemPref(ev.matches ? 'dark' : 'light');
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else if (mql.addListener) mql.addListener(handler); // older Safari
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', handler);
      else if (mql.removeListener) mql.removeListener(handler);
    };
  }, []);

  const effective = useMemo(() => {
    if (mode === 'auto') return systemPref;
    return mode;
  }, [mode, systemPref]);

  const onClick = useCallback(() => {
    const next = nextMode(mode);
    setMode(next);
    setThemeMode(next);
  }, [mode]);

  // 图标选择: auto 模式用 Monitor (清晰传达"跟随系统");
  //          显式 light/dark 用 Sun/Moon (跟最终视觉一致)
  const Icon = useMemo(() => {
    if (mode === 'auto') return Monitor;
    return effective === 'dark' ? Moon : Sun;
  }, [mode, effective]);

  const ariaLabel = useMemo(() => ariaForMode(mode), [mode]);
  const title = useMemo(
    () => `当前: ${labelForMode(mode, effective)} — 点击切换`,
    [mode, effective]
  );

  return (
    <button
      type="button"
      className={`theme-switcher ${className}`.trim()}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      data-theme-mode={mode}
      data-theme-effective={effective}
    >
      <span className="theme-switcher-icon" aria-hidden="true">
        <Icon size={18} strokeWidth={2.1} />
      </span>
    </button>
  );
}
