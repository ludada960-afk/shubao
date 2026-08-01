import React, { useEffect, useRef } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { getContextMenuPosition } from './canvasInteractionModel.js';

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
        const Icon = action.id === 'delete' ? Trash2 : Copy;
        return <button key={action.id} className={action.id === 'delete' ? 'is-danger' : ''} type="button" role="menuitem" onClick={() => { onAction?.(action, node); onClose?.(); }}>
          <Icon size={16} /><span>{action.label}</span>
        </button>;
      })}
    </div>
  );
}
