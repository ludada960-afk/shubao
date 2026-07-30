import React from 'react';
import { MdAutoFixHigh } from 'react-icons/md';
import { proxyImg } from '../../../../../services/api.js';
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
  prompt = '',
  ratio = '',
  requirements = {},
  onPromptChange,
  onRatioChange,
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
      <div className={styles.compactPreview}>{preview ? <img src={proxyImg(preview, 'thumb')} loading="lazy" decoding="async" alt={title} /> : <MdAutoFixHigh size={26} />}</div>
      {requirements.ratio && <>
        <label className={styles.fieldLabel} htmlFor={`process-ratio-${title}`}>目标比例</label>
        <select id={`process-ratio-${title}`} className={styles.textarea} value={ratio} onChange={event => onRatioChange?.(event.target.value)}>
          <option value="">请选择比例</option>
          <option value="1:1">1:1</option>
          <option value="3:4">3:4</option>
          <option value="4:3">4:3</option>
          <option value="9:16">9:16</option>
        </select>
      </>}
      {requirements.prompt && <>
        <label className={styles.fieldLabel} htmlFor={`process-prompt-${title}`}>处理要求</label>
        <textarea id={`process-prompt-${title}`} className={styles.textarea} value={prompt} onChange={event => onPromptChange?.(event.target.value)} rows={3} placeholder="说明需要保留和调整的内容" />
      </>}
      {status === 'running' && <div className={styles.progress}><span style={{ width: `${Math.max(5, Math.min(100, progress))}%` }} /></div>}
      {error && <div className={styles.errorBox}><span>{error}</span><button type="button" onClick={onRetry}>重试</button></div>}
      <button type="button" className={`${styles.primaryButton} ${styles.fullButton}`} onClick={onRun} disabled={status === 'running' || (requirements.ratio && !ratio) || (requirements.prompt && !prompt.trim())}>{status === 'running' ? '处理中…' : resultImage ? '再次处理' : '开始处理'}</button>
    </div>
  </CanvasNodeShell>;
}
