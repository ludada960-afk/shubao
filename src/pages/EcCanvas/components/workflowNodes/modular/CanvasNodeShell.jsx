import React from 'react';
import { MdAutoFixHigh, MdClose, MdRefresh } from 'react-icons/md';
import CanvasPortHandle from './CanvasPortHandle';
import { getStatusMeta } from './workflowNodeViewModel';
import styles from './CanvasWorkflowNodes.module.css';

export default function CanvasNodeShell({
  title,
  subtitle,
  icon: Icon = MdAutoFixHigh,
  status = 'draft',
  selected = false,
  showInput = true,
  showOutput = true,
  children,
  onClose,
  onRetry,
  onPointerDown,
  onContextMenu,
  onPortPointerDown,
  onPortPointerUp,
}) {
  const statusMeta = getStatusMeta(status);
  return (
    <section
      className={`${styles.node} ${selected ? styles.nodeSelected : ''}`}
      data-node-shell="true"
      onPointerDown={event => {
        if (event.target.closest?.('button,input,textarea,select,a,[contenteditable="true"],[data-canvas-control="true"]')) return;
        onPointerDown?.(event);
      }}
      onContextMenu={event => {
        event.preventDefault();
        onContextMenu?.(event);
      }}
    >
      {showInput && <CanvasPortHandle side="left" role="input" visible={selected} onPointerDown={event => onPortPointerDown?.(event, 'in')} onPointerUp={event => onPortPointerUp?.(event, 'in')} />}
      {showOutput && <CanvasPortHandle side="right" role="output" visible={selected} onPointerDown={event => onPortPointerDown?.(event, 'out')} onPointerUp={event => onPortPointerUp?.(event, 'out')} />}
      <header className={styles.nodeHeader}>
        <div className={styles.nodeTitleGroup}>
          <span className={styles.nodeIcon}><Icon /></span>
          <div>
            <h3 className={styles.nodeTitle}>{title}</h3>
            {subtitle && <p className={styles.nodeSubtitle}>{subtitle}</p>}
          </div>
        </div>
        <div className={styles.nodeHeaderActions}>
          <span className={`${styles.status} ${styles[`status${statusMeta.tone[0].toUpperCase()}${statusMeta.tone.slice(1)}`]}`}>{statusMeta.label}</span>
          {status === 'error' && <button type="button" className={styles.iconButton} aria-label="重试" title="重新执行当前处理" onClick={onRetry}><MdRefresh size={16} /></button>}
          {onClose && <button type="button" className={styles.iconButton} aria-label="关闭节点" title="关闭节点" onClick={onClose}><MdClose size={16} /></button>}
        </div>
      </header>
      {children}
    </section>
  );
}
