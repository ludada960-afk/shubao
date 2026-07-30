import React from 'react';
import styles from './CanvasWorkflowNodes.module.css';

export default function CanvasPortHandle({
  side = 'right',
  role = 'output',
  label,
  visible = true,
  active = false,
  connected = false,
  disabled = false,
  onPointerDown,
  onPointerUp,
  onClick,
}) {
  const defaultLabel = role === 'output' ? '从此处派生电商任务' : '连接到此节点';
  return (
    <button
      type="button"
      className={`${styles.port} ${styles[`port${side[0].toUpperCase()}${side.slice(1)}`]} ${visible ? styles.portVisible : ''} ${active ? styles.portActive : ''} ${connected ? styles.portConnected : ''}`}
      aria-label={label || defaultLabel}
      title={label || defaultLabel}
      disabled={disabled}
      data-canvas-control="true"
      data-canvas-port-role={role}
      onPointerDown={event => {
        event.stopPropagation();
        onPointerDown?.(event);
      }}
      onPointerUp={event => {
        event.stopPropagation();
        onPointerUp?.(event);
      }}
      onClick={event => {
        event.stopPropagation();
        onClick?.(event);
      }}
    >
      <span className={styles.portDot} aria-hidden="true" />
      {role === 'output' && <span className={styles.portPlus} aria-hidden="true">+</span>}
    </button>
  );
}
