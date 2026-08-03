import React from 'react';
import { CircleAlert, Eraser, Layers3, LoaderCircle, RotateCcw, X } from 'lucide-react';

import ResponsiveImage from '../../../components/ResponsiveImage.jsx';

export default function CanvasSegmentationProgress({ job, onCancel, onRetry, onClose }) {
  const progress = job?.progress || {};
  const failed = Boolean(job?.error);
  const Icon = job?.action === 'smart-layer' ? Layers3 : Eraser;
  const percent = Math.max(0, Math.min(100, Number(progress.percent) || 0));
  return <section
    className={`ec-canvas-segmentation-progress ${failed ? 'is-error' : ''}`}
    style={{ left: job.x, top: job.y }}
    data-canvas-control="true"
    onPointerDown={event => event.stopPropagation()}
  >
    <header>
      <span className="ec-canvas-segmentation-progress-icon"><Icon size={16} /></span>
      <div>
        <strong>{job.action === 'smart-layer' ? '智能分层' : '去除背景'}</strong>
        <small>{failed ? '处理未完成' : progress.label || '准备处理'}</small>
      </div>
      {failed ? <button type="button" aria-label="关闭" title="关闭" onClick={() => onClose?.(job)}><X size={15} /></button>
        : <button type="button" aria-label="取消处理" title="取消处理" onClick={() => onCancel?.(job)}><X size={15} /></button>}
    </header>
    <div className="ec-canvas-segmentation-progress-body">
      <span className="ec-canvas-segmentation-progress-thumb">
        {job.sourceUrl ? <ResponsiveImage
          src={job.sourceUrl}
          alt="正在处理的商品图"
          variant="thumb"
          ratio="1:1"
          style={{ width: '100%', height: '100%' }}
          imgStyle={{ objectFit: 'contain' }}
        /> : <Icon size={20} />}
      </span>
      <div className="ec-canvas-segmentation-progress-copy">
        {failed ? <><span className="is-error"><CircleAlert size={13} />{job.error}</span><button type="button" aria-label="重试" onClick={() => onRetry?.(job)}><RotateCcw size={13} />重试</button></>
          : <><span><LoaderCircle className="is-spinning" size={13} />{progress.detail || (progress.coldStart ? '首次准备完成后会自动缓存' : '正在本地处理图片')}</span><b>{percent}%</b></>}
      </div>
    </div>
    {!failed && <div
      className="ec-canvas-segmentation-progress-track"
      role="progressbar"
      aria-label={progress.label || '智能抠图进度'}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={percent}
    ><i style={{ width: `${percent}%` }} /></div>}
  </section>;
}
