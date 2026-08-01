import React, { useEffect, useRef } from 'react';
import {
  ArrowDown, ArrowUp, ClipboardPaste, Copy, Download, Eye, EyeOff,
  FlipHorizontal2, FlipVertical2, Layers2, Lock, LockOpen, Trash2,
} from 'lucide-react';
import { getContextMenuPosition } from './canvasInteractionModel.js';

const ICONS = {
  copy: Copy,
  paste: ClipboardPaste,
  duplicate: Layers2,
  'bring-forward': ArrowUp,
  'send-backward': ArrowDown,
  'bring-front': ArrowUp,
  'send-back': ArrowDown,
  'toggle-visibility': Eye,
  'toggle-lock': Lock,
  'flip-horizontal': FlipHorizontal2,
  'flip-vertical': FlipVertical2,
  'export-object': Download,
  delete: Trash2,
};

const SEPARATOR_BEFORE = new Set(['bring-forward', 'toggle-visibility', 'flip-horizontal', 'export-object', 'delete']);

export default function ContextMenu({ x, y, node, actions = [], onClose, onAction }) {
  const ref = useRef(null);
  const position = getContextMenuPosition({
    x,
    y,
    viewportWidth: globalThis.innerWidth,
    viewportHeight: globalThis.innerHeight,
    width: 240,
    height: Math.min(420, 48 + actions.length * 42),
  });

  useEffect(() => {
    const handler = event => {
      if (ref.current && !ref.current.contains(event.target)) onClose?.();
    };
    window.addEventListener('pointerdown', handler);
    return () => window.removeEventListener('pointerdown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="ec-canvas-context-menu" role="menu" aria-label={`${node?.name || node?.displayLabel || '对象'}操作`} style={{ left: position.x, top: position.y }}>
      {actions.map(action => {
        const Icon = action.id === 'toggle-visibility' && node?.hidden
          ? EyeOff
          : action.id === 'toggle-lock' && node?.locked
            ? LockOpen
            : ICONS[action.id] || Copy;
        const label = action.id === 'toggle-visibility'
          ? node?.hidden ? '显示' : '隐藏'
          : action.id === 'toggle-lock'
            ? node?.locked ? '解锁' : '锁定'
            : action.label;
        return <React.Fragment key={action.id}>
          {SEPARATOR_BEFORE.has(action.id) && <i className="ec-canvas-context-separator" aria-hidden="true" />}
          <button className={action.id === 'delete' ? 'is-danger' : ''} type="button" role="menuitem" onClick={() => { onAction?.(action, node); onClose?.(); }}>
          <Icon size={16} /><span>{label}</span>
          </button>
        </React.Fragment>;
      })}
    </div>
  );
}
