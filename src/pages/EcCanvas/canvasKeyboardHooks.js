/* ═══════ 4c183cd4 续命 画布总监督 - 快捷键 hooks (2026-08-30) ═══════
   Quantv Qoe 函数全量快捷键: Ctrl+A/C/V/Z/D/G/Delete/Esc/方向键/F/T/Space/Shift
   用户原话 8-30: "你必须做到最成品, 最面向市场, 最高级的一个体验和流畅度" */

import { useEffect, useRef } from 'react';

export function isTypingInField(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

/* 解析快捷键事件, 返回 { matches, key, ctrl, shift, alt, meta }
   用法: matchesKey(e, 'Ctrl+A') / 'Cmd+C' / 'Delete' / 'Escape' */
export function matchesKey(event, keySpec = '') {
  if (!event || !keySpec) return false;
  const parts = String(keySpec).split('+').map(p => p.trim().toLowerCase());
  const key = String(event.key || '').toLowerCase();
  let needsCtrl = false;
  let needsShift = false;
  let needsAlt = false;
  let needsMeta = false;
  let mainKey = '';
  for (const part of parts) {
    if (part === 'ctrl') needsCtrl = true;
    else if (part === 'cmd' || part === 'meta') needsMeta = true;
    else if (part === 'shift') needsShift = true;
    else if (part === 'alt') needsAlt = true;
    else mainKey = part;
  }
  if (needsCtrl && !event.ctrlKey) return false;
  if (needsMeta && !event.metaKey) return false;
  if (needsShift && !event.shiftKey) return false;
  if (needsAlt && !event.altKey) return false;
  // Ctrl 或 Cmd 之一即可 (Mac 习惯)
  const modifierOk = (needsCtrl || needsMeta)
    ? (event.ctrlKey || event.metaKey)
    : !(event.ctrlKey || event.metaKey);
  if (!modifierOk) return false;
  // 特殊键 (delete/backspace/escape/space/tab)
  const specialKeys = {
    'delete': ['delete'],
    'backspace': ['backspace'],
    'escape': ['escape'],
    'esc': ['escape'],
    'space': [' ', 'spacebar'],
    'tab': ['tab'],
    'enter': ['enter'],
    'arrowup': ['arrowup'],
    'arrowdown': ['arrowdown'],
    'arrowleft': ['arrowleft'],
    'arrowright': ['arrowright'],
  };
  if (specialKeys[mainKey]) return specialKeys[mainKey].includes(key);
  // 单字符
  return key === mainKey || key.startsWith(mainKey);
}

/* ═══════ useCanvasShortcuts - 完整快捷键 hook ═══════
   handlers: {
     onSelectAll, onCopy, onPaste, onDuplicate, onUndo, onRedo,
     onGroup, onUngroup, onDelete, onEscape, onFitView, onAddText,
     onArrowMove, onToggleHelp, onSave
   }
   tab: 'canvas' | other (只在 canvas tab 响应)
   enabled: boolean (默认 true) */
export function useCanvasShortcuts(handlers = {}, options = {}) {
  const { tab = 'canvas', enabled = true } = options;
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return undefined;
    const handleKeyDown = (event) => {
      const target = event.target;
      const typing = isTypingInField(target);
      // Esc 全局响应 (即使在输入框也允许, 用于关闭菜单)
      if (matchesKey(event, 'Escape')) {
        const fn = handlersRef.current.onEscape;
        if (fn) {
          event.preventDefault();
          fn(event);
        }
        return;
      }
      // 输入框中不抢快捷键
      if (typing) return;
      // Space 按住 = pan 模式
      if (event.code === 'Space' && tab === 'canvas') {
        event.preventDefault();
        handlersRef.current.onSpaceDown?.(event);
        return;
      }
      // Shift 按住 = 多选模式
      if (event.key === 'Shift' && tab === 'canvas') {
        handlersRef.current.onShiftDown?.(event);
        return;
      }
      // 只在画布 tab 处理其余快捷键
      if (tab !== 'canvas') return;

      // 删除
      if (matchesKey(event, 'Delete') || matchesKey(event, 'Backspace')) {
        if (handlersRef.current.onDelete) {
          event.preventDefault();
          handlersRef.current.onDelete(event);
        }
        return;
      }
      // 全选 / 复制 / 粘贴 / 复制节点 / 撤销 / 重做 / 打组 / 拆组 / 保存
      if (matchesKey(event, 'Ctrl+A') || matchesKey(event, 'Cmd+A')) {
        event.preventDefault();
        handlersRef.current.onSelectAll?.(event);
        return;
      }
      if (matchesKey(event, 'Ctrl+C') || matchesKey(event, 'Cmd+C')) {
        event.preventDefault();
        handlersRef.current.onCopy?.(event);
        return;
      }
      if (matchesKey(event, 'Ctrl+V') || matchesKey(event, 'Cmd+V')) {
        event.preventDefault();
        handlersRef.current.onPaste?.(event);
        return;
      }
      if (matchesKey(event, 'Ctrl+D') || matchesKey(event, 'Cmd+D')) {
        event.preventDefault();
        handlersRef.current.onDuplicate?.(event);
        return;
      }
      if (matchesKey(event, 'Ctrl+Z') || matchesKey(event, 'Cmd+Z')) {
        event.preventDefault();
        if (event.shiftKey) handlersRef.current.onRedo?.(event);
        else handlersRef.current.onUndo?.(event);
        return;
      }
      if (matchesKey(event, 'Ctrl+G') || matchesKey(event, 'Cmd+G')) {
        event.preventDefault();
        if (event.shiftKey) handlersRef.current.onUngroup?.(event);
        else handlersRef.current.onGroup?.(event);
        return;
      }
      if (matchesKey(event, 'Ctrl+S') || matchesKey(event, 'Cmd+S')) {
        event.preventDefault();
        handlersRef.current.onSave?.(event);
        return;
      }
      // F 适配视口
      if (matchesKey(event, 'F')) {
        event.preventDefault();
        handlersRef.current.onFitView?.(event);
        return;
      }
      // T 添加文本
      if (matchesKey(event, 'T')) {
        event.preventDefault();
        handlersRef.current.onAddText?.(event);
        return;
      }
      // ? 帮助面板
      if (matchesKey(event, '?')) {
        event.preventDefault();
        handlersRef.current.onToggleHelp?.(event);
        return;
      }
      // 方向键移动
      if (matchesKey(event, 'ArrowUp') || matchesKey(event, 'ArrowDown')
        || matchesKey(event, 'ArrowLeft') || matchesKey(event, 'ArrowRight')) {
        event.preventDefault();
        handlersRef.current.onArrowMove?.(event);
        return;
      }
    };

    const handleKeyUp = (event) => {
      if (event.code === 'Space') handlersRef.current.onSpaceUp?.(event);
      if (event.key === 'Shift') handlersRef.current.onShiftUp?.(event);
    };

    const handleBlur = () => {
      handlersRef.current.onSpaceUp?.();
      handlersRef.current.onShiftUp?.();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [tab, enabled]);
}

/* ═══════ useCanvasHistory - 撤销/重做 history ═══════
   语义: past 存「走过的状态」, future 存「撤销之后能重做的状态」
   - push(stateBeforeChange): 保存之前的状态 (用户改 state 之前调用)
   - undo(currentState): 返回过去的状态, 并把 current 推到 future
   - redo(currentState): 返回 future 顶端, 并把 current 推到 past

   典型用法:
     history.push(state)  // state 是「之前」状态
     const newState = applyChange(state)
     // ... 用户按 Ctrl+Z
     const previous = history.undo(newState)
     // previous = state
*/
export function createCanvasHistory({ limit = 50 } = {}) {
  const past = [];
  const future = [];
  function snapshot(state) {
    return JSON.parse(JSON.stringify(state));
  }
  return {
    push(state) {
      past.push(snapshot(state));
      if (past.length > limit) past.shift();
      future.length = 0;
    },
    undo(currentState) {
      if (!past.length) return currentState;
      const previous = past.pop();
      future.push(snapshot(currentState));
      return previous;
    },
    redo(currentState) {
      if (!future.length) return currentState;
      const next = future.pop();
      past.push(snapshot(currentState));
      return next;
    },
    canUndo() { return past.length > 0; },
    canRedo() { return future.length > 0; },
    clear() { past.length = 0; future.length = 0; },
    size() { return { past: past.length, future: future.length }; },
  };
}

/* ═══════ 复制/粘贴: 用剪贴板 API + 内存备份 ═══════ */
export function serializeNodesForClipboard(nodes = []) {
  return {
    __canvasClipboard: 'da-ai-canvas-clipboard',
    version: 2,
    timestamp: Date.now(),
    nodes: nodes.map(n => ({ ...n, id: `${n.id}_copy_${Date.now()}` })),
  };
}

export async function copyNodesToClipboard(nodes = []) {
  const payload = serializeNodesForClipboard(nodes);
  try {
    await navigator.clipboard?.writeText(JSON.stringify(payload));
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, payload, error: e.message };
  }
}

/* 9-17 用户批注（图7）：「我复制这些提示词区里面的文字，然后粘贴的话，
   它会直接把整个生成的节点复制出来」。
   根因（两层叠在一起）：
     ① 画布把「节点」也用**纯文本**写进系统剪贴板（serializeNodesForClipboard → JSON 字符串），
        节点数据与普通文本共用同一个剪贴板；
     ② Ctrl+V 的处理**只判断"剪贴板里是不是我们的 JSON"，不判断用户此刻是不是在输入**，
        也不判断剪贴板里到底是文本还是对象。
   于是用户从提示词区复制一段文字、再粘贴时，只要剪贴板里恰好（还）是我们的 JSON
   ——或者用户先复制过节点——就会被当成"粘贴节点"，直接把整个生成节点复制出来。
   修法（把"这次粘贴到底该干什么"抽成一个可测的纯函数，输入框/编辑态优先）：
     · 任何输入态（input / textarea / contentEditable / 节点内编辑）→ 交还浏览器原生粘贴，
       画布**一律不拦截**；
     · 剪贴板里不是画布节点载荷（普通文本、图片、外部内容）→ 同样不拦截，让它正常粘贴成文本；
     · 只有「不在输入态 + 剪贴板确实是画布节点载荷」时，才执行粘贴节点。 */
export function shouldHandleCanvasPaste({ typing = false, payload = null } = {}) {
  if (typing) return false;
  return Boolean(payload?.__canvasClipboard === 'da-ai-canvas-clipboard' && Array.isArray(payload.nodes) && payload.nodes.length);
}

/* 是不是"当前处于输入/编辑态"——画布自己的判断口径，与键盘 hook 的 isTypingInField 一致，
   额外涵盖 contentEditable 与正在编辑的节点文本。 */
export function isCanvasEditingTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest?.('[contenteditable="true"], .mention-prompt-field, [data-canvas-editing="true"]'));
}

export async function readClipboardNodes() {
  try {
    const text = await navigator.clipboard?.readText();
    if (!text) return null;
    const parsed = JSON.parse(text);
    if (parsed?.__canvasClipboard === 'da-ai-canvas-clipboard') return parsed;
    return null;
  } catch (e) {
    return null;
  }
}
