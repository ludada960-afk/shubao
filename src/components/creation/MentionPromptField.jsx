import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { insertImageMentionAt } from './imageMentionModel.js';
import { extractPastedMediaFiles } from './promptPaste.js';
import './MentionPromptField.css';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function renderMentionMarkup(value = '', mentions = []) {
  let html = escapeHtml(value);
  const labels = [...new Set((Array.isArray(mentions) ? mentions : [])
    .map(image => String(image?.label || image?.name || '').trim())
    .filter(Boolean))]
    .sort((left, right) => right.length - left.length);
  for (const label of labels) {
    html = html.replace(new RegExp(escapeRegExp(label), 'g'), `<span class="mention-prompt-token" data-mention-label="${escapeHtml(label)}">${escapeHtml(label)}</span>`);
  }
  return html;
}

function selectionOffsets(field) {
  const selection = globalThis.getSelection?.();
  if (!field || !selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!field.contains(range.commonAncestorContainer)) return null;
  const start = range.cloneRange();
  start.selectNodeContents(field);
  start.setEnd(range.startContainer, range.startOffset);
  const end = range.cloneRange();
  end.selectNodeContents(field);
  end.setEnd(range.endContainer, range.endOffset);
  return { start: start.toString().length, end: end.toString().length };
}

function restoreCaret(field, offset) {
  if (!field || !globalThis.document?.createRange || !globalThis.getSelection) return;
  const walker = document.createTreeWalker(field, globalThis.NodeFilter?.SHOW_TEXT || 4);
  let remaining = Math.max(0, Number(offset) || 0);
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length || 0;
    if (remaining <= length) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      const selection = globalThis.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= length;
    node = walker.nextNode();
  }
  const range = document.createRange();
  range.setStart(field, field.childNodes.length);
  range.collapse(true);
  const selection = globalThis.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

const MentionPromptField = forwardRef(function MentionPromptField({
  value = '',
  mentions = [],
  onChange,
  onFilesPasted,
  placeholder = '描述你想生成的内容',
  className = '',
  ...props
}, ref) {
  const fieldRef = useRef(null);
  const selectionRangeRef = useRef(null);
  const pendingCaretRef = useRef(null);
  const composingRef = useRef(false);
  const markup = useMemo(() => renderMentionMarkup(value, mentions), [value, mentions]);
  const syncKey = `${value}\u0000${mentions.map(image => image?.sourceNodeId || image?.id || image?.label).join('|')}`;
  const lastSyncKey = useRef('');

  const rememberSelection = useCallback(() => {
    const offsets = selectionOffsets(fieldRef.current);
    if (offsets) selectionRangeRef.current = offsets;
  }, []);

  useImperativeHandle(ref, () => ({
    focus() {
      fieldRef.current?.focus();
    },
    insertMention(label) {
      const field = fieldRef.current;
      const current = field?.textContent ?? String(value || '');
      const saved = selectionRangeRef.current || { start: current.length, end: current.length };
      const result = insertImageMentionAt(current, label, saved.start, saved.end);
      if (result.value === current) return result;
      pendingCaretRef.current = result.caret;
      selectionRangeRef.current = { start: result.caret, end: result.caret };
      lastSyncKey.current = '';
      onChange?.(result.value);
      return result;
    },
  }), [onChange, value]);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field || composingRef.current || lastSyncKey.current === syncKey) return;
    if (field.innerHTML !== markup) {
      const savedCaret = pendingCaretRef.current !== null
        ? pendingCaretRef.current
        : (selectionRangeRef.current ? selectionRangeRef.current.start : null);
      field.innerHTML = markup;
      if (savedCaret !== null && globalThis.document && globalThis.document.activeElement === field) {
        const maxLen = (field.textContent || "").length;
        restoreCaret(field, Math.min(savedCaret, maxLen));
      }
    }
    lastSyncKey.current = syncKey;
    pendingCaretRef.current = null;
  }, [markup, syncKey]);

  return <div
    ref={fieldRef}
    className={`mention-prompt-field ${className}`.trim()}
    contentEditable
    suppressContentEditableWarning
    role="textbox"
    aria-multiline="true"
    data-placeholder={placeholder}
    onInput={event => {
      rememberSelection();
      lastSyncKey.current = '';
      if (!composingRef.current && !event.nativeEvent?.isComposing) onChange?.(event.currentTarget.textContent || '');
    }}
    onPaste={event => {
      const files = extractPastedMediaFiles(event.clipboardData);
      if (!files.length) return;
      event.preventDefault();
      onFilesPasted?.(files);
    }}
    onBeforeInput={rememberSelection}
    onCompositionStart={() => { composingRef.current = true; }}
    onCompositionEnd={event => {
      composingRef.current = false;
      rememberSelection();
      lastSyncKey.current = '';
      onChange?.(event.currentTarget.textContent || '');
    }}
    onKeyUp={rememberSelection}
    onMouseUp={rememberSelection}
    onSelect={rememberSelection}
    onBlur={rememberSelection}
    {...props}
  />;
});

export default MentionPromptField;
