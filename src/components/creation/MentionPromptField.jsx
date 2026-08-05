import React, { useEffect, useMemo, useRef } from 'react';
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

export default function MentionPromptField({
  value = '',
  mentions = [],
  onChange,
  placeholder = '描述你想生成的内容',
  className = '',
  ...props
}) {
  const fieldRef = useRef(null);
  const markup = useMemo(() => renderMentionMarkup(value, mentions), [value, mentions]);
  const syncKey = `${value}\u0000${mentions.map(image => image?.sourceNodeId || image?.id || image?.label).join('|')}`;
  const lastSyncKey = useRef('');

  useEffect(() => {
    const field = fieldRef.current;
    if (!field || lastSyncKey.current === syncKey) return;
    if (field.innerHTML !== markup) field.innerHTML = markup;
    lastSyncKey.current = syncKey;
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
      lastSyncKey.current = '';
      onChange?.(event.currentTarget.textContent || '');
    }}
    {...props}
  />;
}
