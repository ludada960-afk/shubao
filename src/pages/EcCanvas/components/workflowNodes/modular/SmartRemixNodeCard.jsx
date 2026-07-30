import React, { useRef } from 'react';
import { MdClose, MdImageSearch, MdUpload } from 'react-icons/md';
import CanvasNodeShell from './CanvasNodeShell';
import { clampOutputCount } from './workflowNodeViewModel';
import styles from './CanvasWorkflowNodes.module.css';

function ImageRail({ label, hint, images = [], onAdd, onRemove }) {
  const inputRef = useRef(null);
  return <div className={styles.imageRail}>
    <div className={styles.sectionLabel}><strong>{label}</strong><span>{hint}</span></div>
    <div className={styles.imageRailScroll}>
      {images.map((image, index) => <div className={styles.railImage} key={image.id || image.url || index}>
        <img src={image.url || image.previewUrl} alt={image.name || label} />
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
  instruction = '',
  outputCount = 1,
  status = 'draft',
  selected = false,
  error,
  onPromptChange,
  onAddProductImages,
  onRemoveProductImage,
  onAddReferenceImages,
  onRemoveReferenceImage,
  onInstructionChange,
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
      {sourceImage && <div className={styles.sourcePreview}><img src={sourceImage.url || sourceImage.previewUrl} alt={sourceImage.name || '源图'} /><span>源图</span></div>}
      <label className={styles.fieldLabel} htmlFor={`remix-prompt-${node?.id || 'draft'}`}>画面描述 <em>可编辑</em></label>
      <textarea id={`remix-prompt-${node?.id || 'draft'}`} className={styles.promptEditor} value={prompt} onChange={event => onPromptChange?.(event.target.value)} placeholder="系统会根据源图生成画面描述，你可以直接修改" rows={5} />
      <ImageRail label="产品图" hint="补充不同角度，帮助保持商品一致" images={productImages} onAdd={onAddProductImages} onRemove={onRemoveProductImage} />
      <ImageRail label="参考图" hint="可选，用于补充风格和构图" images={referenceImages} onAdd={onAddReferenceImages} onRemove={onRemoveReferenceImage} />
      <label className={styles.fieldLabel} htmlFor={`remix-instruction-${node?.id || 'draft'}`}>补充调整</label>
      <textarea id={`remix-instruction-${node?.id || 'draft'}`} className={styles.textarea} value={instruction} onChange={event => onInstructionChange?.(event.target.value)} placeholder="例如：突出防水、便携和材质细节" rows={2} />
      <div className={styles.footerRow}>
        <label className={styles.countControl}>生成 <select value={outputCount} onChange={event => onOutputCountChange?.(clampOutputCount(event.target.value))}><option value={1}>1 张</option><option value={2}>2 张</option><option value={4}>4 张</option></select></label>
        <button type="button" className={styles.primaryButton} onClick={onGenerate} disabled={status === 'running' || !prompt.trim()}>{status === 'running' ? '生成中…' : '生成新方案'}</button>
      </div>
      {error && <div className={styles.errorBox}><span>{error}</span><button type="button" onClick={onRetry}>重试</button></div>}
    </div>
  </CanvasNodeShell>;
}
