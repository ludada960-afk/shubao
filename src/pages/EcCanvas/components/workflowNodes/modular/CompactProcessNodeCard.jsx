import React from 'react';
import { MdAutoFixHigh } from 'react-icons/md';
import CanvasNodeShell from './CanvasNodeShell';
import styles from './CanvasWorkflowNodes.module.css';

export default function CompactProcessNodeCard({
  title,
  description,
  sourceImage,
  status = 'draft',
  selected = false,
  progress = 0,
  resultImage,
  error,
  onRun,
  onRetry,
  onPointerDown,
  onContextMenu,
  onPortPointerDown,
  onPortPointerUp,
  showOutput = false,
}) {
  const preview = resultImage || sourceImage;
  return <CanvasNodeShell title={title} subtitle={description} icon={MdAutoFixHigh} status={status} selected={selected} showOutput={showOutput} onRetry={onRetry} onPointerDown={onPointerDown} onContextMenu={onContextMenu} onPortPointerDown={onPortPointerDown} onPortPointerUp={onPortPointerUp}>
    <div className={`${styles.nodeBody} ${styles.compactBody}`}>
      <div className={styles.compactPreview}>{preview ? <img src={preview} alt={title} /> : <MdAutoFixHigh size={26} />}</div>
      {status === 'running' && <div className={styles.progress}><span style={{ width: `${Math.max(5, Math.min(100, progress))}%` }} /></div>}
      {error && <div className={styles.errorBox}><span>{error}</span><button type="button" onClick={onRetry}>重试</button></div>}
      <button type="button" className={`${styles.primaryButton} ${styles.fullButton}`} onClick={onRun} disabled={status === 'running'}>{status === 'running' ? '处理中…' : resultImage ? '再次处理' : '开始处理'}</button>
    </div>
  </CanvasNodeShell>;
}
