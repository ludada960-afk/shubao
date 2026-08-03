import React, { useRef } from 'react';
import { MdClose, MdImageSearch, MdUpload } from 'react-icons/md';
import { proxyImg } from '../../../../../services/api.js';
import CanvasNodeShell from './CanvasNodeShell';
import { clampOutputCount } from './workflowNodeViewModel';
import styles from './CanvasWorkflowNodes.module.css';

function ImageRail({ label, hint, images = [], onAdd, onRemove }) {
  const inputRef = useRef(null);
  return <div className={styles.imageRail}>
    <div className={styles.sectionLabel}><strong>{label}</strong><span>{hint}</span></div>
    <div className={styles.imageRailScroll}>
      {images.map((image, index) => <div className={styles.railImage} key={image.id || image.url || index}>
        <img src={proxyImg(image.url || image.previewUrl, 'thumb')} loading="lazy" decoding="async" alt={image.name || label} />
        <button type="button" aria-label={`移除${label}`} onClick={() => onRemove?.(image, index)}><MdClose size={12} /></button>
      </div>)}
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={event => { onAdd?.([...event.target.files]); event.target.value = ''; }} />
      <button type="button" className={styles.uploadTile} onClick={() => inputRef.current?.click()}><MdUpload size={17} /><span>添加</span></button>
    </div>
  </div>;
}

export default function SmartRemixNodeCard({
  node,
  action,
  sourceImage,
  prompt = '',
  productImages = [],
  referenceImages = [],
  outputCount = 1,
  status = 'draft',
  selected = false,
  error,
  onPromptChange,
  onAddProductImages,
  onRemoveProductImage,
  onAddReferenceImages,
  onRemoveReferenceImage,
  onOutputCountChange,
  onGenerate,
  onRetry,
  onPointerDown,
  onContextMenu,
  onPortPointerDown,
  onPortPointerUp,
  showOutput = false,
}) {
  return <CanvasNodeShell title={action?.label} subtitle={action?.description} icon={MdImageSearch} status={status} selected={selected} showOutput={showOutput} onRetry={onRetry} onPointerDown={onPointerDown} onContextMenu={onContextMenu} onPortPointerDown={onPortPointerDown} onPortPointerUp={onPortPointerUp}>
    <div className={styles.nodeBody}>
      {sourceImage && <div className={styles.sourcePreview}><img src={proxyImg(sourceImage.url || sourceImage.previewUrl, 'thumb')} loading="lazy" decoding="async" alt={sourceImage.name || '源图'} /><span>源图</span></div>}
      <label className={styles.fieldLabel} htmlFor={`remix-prompt-${node?.id || 'draft'}`}>生成要求 <em>可编辑</em></label>
      <textarea id={`remix-prompt-${node?.id || 'draft'}`} className={styles.promptEditor} value={prompt} onChange={event => onPromptChange?.(event.target.value)} placeholder="写清楚这次要怎么改、突出什么，系统会保留商品主体" rows={4} />
      <ImageRail label="产品图" hint="补充不同角度，帮助保持商品一致" images={productImages} onAdd={onAddProductImages} onRemove={onRemoveProductImage} />
      <ImageRail label="参考图" hint="可选，用于补充风格和构图" images={referenceImages} onAdd={onAddReferenceImages} onRemove={onRemoveReferenceImage} />
      <div className={styles.footerRow}>
        <label className={styles.countControl}>生成 <select value={outputCount} onChange={event => onOutputCountChange?.(clampOutputCount(event.target.value))}><option value={1}>1 张</option><option value={2}>2 张</option><option value={4}>4 张</option></select></label>
        <button type="button" className={styles.primaryButton} onClick={onGenerate} disabled={status === 'running' || !prompt.trim()}>{status === 'running' ? '生成中…' : '生成新方案'}</button>
      </div>
      {error && <div className={styles.errorBox}><span>{error}</span><button type="button" onClick={onRetry}>重试</button></div>}
    </div>
  </CanvasNodeShell>;
}
