import React from 'react';
import { MdColorLens, MdDownload, MdEdit, MdLayers, MdLock, MdLockOpen, MdOpenWith, MdOutlineVisibility, MdVisibilityOff } from 'react-icons/md';
import CanvasNodeShell from './CanvasNodeShell';
import { getLayerCapabilities, normalizeLayers } from './workflowNodeViewModel';
import styles from './CanvasWorkflowNodes.module.css';

export default function LayerWorkbenchNodeCard({
  layers = [],
  selectedLayerId,
  status = 'draft',
  selected = false,
  capabilities = {},
  error,
  onRetry,
  onSelectLayer,
  onToggleVisibility,
  onToggleLock,
  onMoveLayer,
  onExportPng,
  onAddToCanvas,
  onCreatePixelLayers,
  onExportPsd,
  onPointerDown,
  onContextMenu,
  onPortPointerDown,
  onPortPointerUp,
  showOutput = false,
}) {
  const normalizedLayers = normalizeLayers(layers);
  const selectedLayer = normalizedLayers.find(layer => layer.id === selectedLayerId) || normalizedLayers[0];
  const layerCapabilities = getLayerCapabilities(capabilities);
  return <CanvasNodeShell title="图文分层" subtitle="识别商品、背景与文案结构" icon={MdLayers} status={status} selected={selected} showOutput={showOutput} onRetry={onRetry} onPointerDown={onPointerDown} onContextMenu={onContextMenu} onPortPointerDown={onPortPointerDown} onPortPointerUp={onPortPointerUp}>
    <div className={styles.nodeBody}>
      {status === 'analyzing' ? <div className={styles.layerSkeleton}><span /><span /><span /></div> : <>
        <div className={styles.layerList} role="listbox" aria-label="图层列表">
          {normalizedLayers.map(layer => <div role="option" aria-selected={layer.id === selectedLayer?.id} tabIndex={0} className={`${styles.layerRow} ${layer.id === selectedLayer?.id ? styles.layerSelected : ''}`} key={layer.id} onClick={() => onSelectLayer?.(layer.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onSelectLayer?.(layer.id); }}>
            {layer.previewUrl ? <img src={layer.previewUrl} alt="" /> : <span className={styles.layerThumb}><MdLayers size={15} /></span>}
            <span className={styles.layerName}><strong>{layer.name}</strong><small>{layer.kind}</small></span>
            {layerCapabilities.pixelLayers && <span className={styles.layerActions}>
              <button type="button" aria-label={layer.visible ? '隐藏图层' : '显示图层'} onClick={event => { event.stopPropagation(); onToggleVisibility?.(layer); }}>{layer.visible ? <MdOutlineVisibility size={15} /> : <MdVisibilityOff size={15} />}</button>
              <button type="button" aria-label={layer.locked ? '解锁图层' : '锁定图层'} onClick={event => { event.stopPropagation(); onToggleLock?.(layer); }}>{layer.locked ? <MdLock size={15} /> : <MdLockOpen size={15} />}</button>
            </span>}
          </div>)}
          {!normalizedLayers.length && <div className={styles.emptyState}>分析完成后会显示可识别的图层</div>}
        </div>
        {layerCapabilities.pixelLayers && selectedLayer && <div className={styles.layerInspector}>
          <div className={styles.sectionLabel}><strong>{selectedLayer.name}</strong><span>当前图层</span></div>
          <div className={styles.quickActions}><button type="button" onClick={() => onMoveLayer?.(selectedLayer, 'up')}>上移</button><button type="button" onClick={() => onMoveLayer?.(selectedLayer, 'down')}>下移</button><button type="button" onClick={() => onAddToCanvas?.(selectedLayer)} disabled={!selectedLayer.url}>放到画布</button></div>
          <div className={styles.capabilityList}><span><MdOpenWith size={14} /> 可移动</span><span><MdColorLens size={14} /> 可调色</span>{selectedLayer.kind === 'text' && <span><MdEdit size={14} /> 可编辑文字</span>}</div>
        </div>}
        <div className={styles.footerRow}>
          {layerCapabilities.pixelLayers && <button type="button" className={styles.secondaryButton} onClick={() => onExportPng?.(selectedLayer)} disabled={!selectedLayer}><MdDownload size={15} /> 导出当前层</button>}
          {!layerCapabilities.pixelLayers && <button type="button" className={styles.secondaryButton} onClick={onCreatePixelLayers} disabled={!onCreatePixelLayers} title={onCreatePixelLayers ? '从真实合成图层生成透明位图和掩码' : '先在文字编辑中保存真实图层'}><MdLayers size={15} /> 生成像素分层</button>}
          <button type="button" className={styles.primaryButton} onClick={onExportPsd} disabled={!layerCapabilities.psdExport} title={layerCapabilities.psdExport ? '下载多图层 PSD' : '完成像素分层后可导出 PSD'}><MdDownload size={15} /> 下载 PSD</button>
        </div>
        {error && <div className={styles.errorBox}><span>{error}</span></div>}
      </>}
    </div>
  </CanvasNodeShell>;
}
