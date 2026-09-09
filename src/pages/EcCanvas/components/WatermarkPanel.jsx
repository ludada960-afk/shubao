import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Upload, Trash2, Eraser, Loader2, Hand, Check } from 'lucide-react';
import {
  WATERMARK_MATERIALS,
  WATERMARK_MOTION_MODES,
  WATERMARK_TYPES,
  normalizeWatermark,
} from '../canvasWatermarkModel.js';
import { removeSolidBackground } from '../watermarkBackgroundRemoval.js';
import WatermarkLayer from './WatermarkLayer.jsx';

const clamp01 = n => Math.min(1, Math.max(0, n));

/**
 * 水印面板 (2026-09-08 重构 · 单面板)
 * 用户批注要点：
 *  1. 图片/视频只用一个面板，用「素材类型」切换按钮区分（不再是两套一模一样的面板）
 *  2. 水印位置可拖拽，拖动时实时同步到画布素材
 *  3. 面板停靠在底部按钮区上方，绝不遮挡底部按钮
 *  4. 图片水印支持上传 + 去纯色背景
 *  5. 铺满图片按网格重复填充
 *  6. 视频水印提供调研后的动态方案（定时跳位/漂移/跑马灯/脉冲/闪烁/溯源）
 */
export default function WatermarkPanel({
  open,
  material = 'image',
  onMaterialChange,
  config,
  previewUrl = '',
  previewKind = 'image',
  previewAspect = 1,
  onPreview,
  onCommit,
  onCancel,
  onClose,
}) {
  const [draft, setDraft] = useState(() => normalizeWatermark(config, { material }));
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [mediaAspect, setMediaAspect] = useState(0);
  const [previewSize, setPreviewSize] = useState(200);
  const previewBoxRef = useRef(null);
  const fileRef = useRef(null);
  const draggingRef = useRef(false);
  const previewCallbackRef = useRef(onPreview);

  useEffect(() => { previewCallbackRef.current = onPreview; }, [onPreview]);

  // 测量预览方块实际像素宽，用于等比缩放水印（素材宽≈200px，预览也要≈200px）
  useEffect(() => {
    const node = previewBoxRef.current;
    if (!node) return undefined;
    const measure = () => {
      const w2 = node.clientWidth;
      if (w2 > 0) setPreviewSize(w2);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const obs = new ResizeObserver(measure);
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    setDraft(normalizeWatermark(config, { material }));
    setNotice('');
  }, [open, config, material]);

  const patch = useCallback((next) => {
    setDraft(prev => normalizeWatermark({
      ...prev,
      ...next,
      motion: { ...prev.motion, ...(next.motion || {}) },
    }, { material }));
  }, [material]);

  const patchMotion = useCallback((next) => {
    setDraft(prev => normalizeWatermark({ ...prev, motion: { ...prev.motion, ...next } }, { material }));
  }, [material]);

  const moveTo = useCallback((clientX, clientY) => {
    const box = previewBoxRef.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return;
    patch({
      xPercent: Math.round(clamp01((clientX - box.left) / box.width) * 100),
      yPercent: Math.round(clamp01((clientY - box.top) / box.height) * 100),
    });
  }, [patch]);

  const handlePointerDown = (event) => {
    if (!draft.enabled) return;
    event.preventDefault();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    moveTo(event.clientX, event.clientY);
  };
  const handlePointerMove = (event) => {
    if (!draggingRef.current) return;
    moveTo(event.clientX, event.clientY);
  };
  const handlePointerUp = (event) => {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      patch({ type: 'logo', logoUrl: String(reader.result || '') });
      setNotice('');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBackground = async () => {
    if (!draft.logoUrl) return;
    setBusy('bg');
    setNotice('');
    try {
      const result = await removeSolidBackground(draft.logoUrl, { tolerance: 36, feather: 18 });
      patch({ logoUrl: result.dataUrl });
      setNotice(result.removedRatio > 0.02
        ? '已按边缘纯色去除背景（保留主体）'
        : '几乎没有检测到纯色背景，已保留原图');
    } catch (error) {
      setNotice(error?.message || '去背景失败，请换一张图片');
    }
    setBusy('');
  };

  /* 预览按素材真实比例渲染：媒体加载完成后用自然尺寸覆盖估算值，保证水印百分比映射一致 */
  useEffect(() => { setMediaAspect(0); }, [previewUrl]);
  const aspect = useMemo(() => {
    if (mediaAspect > 0.1 && mediaAspect < 10) return mediaAspect;
    const value = Number(previewAspect);
    return Number.isFinite(value) && value > 0.1 && value < 10 ? value : 1;
  }, [mediaAspect, previewAspect]);

  if (!open) return null;

  const isLogo = draft.type === 'logo';
  const isVideo = material === 'video';

  return (
    <aside className="ec-wm-panel" aria-label="水印面板" data-canvas-control="true" onWheel={e => e.stopPropagation()}>
      <header className="ec-wm-panel-head">
        <div className="ec-wm-panel-title">
          <strong>水印面板</strong>
          <span>{WATERMARK_MATERIALS.find(m => m.value === material)?.hint}</span>
        </div>
        <button type="button" className="ec-wm-icon-btn" onClick={onClose} aria-label="关闭水印面板">
          <X size={15} />
        </button>
      </header>

      <div className="ec-wm-panel-body">
        <label className="ec-wm-switch">
          <input type="checkbox" checked={draft.enabled} onChange={e => patch({ enabled: e.target.checked })} />
          <span>水印开关</span>
          <em>{draft.enabled ? '已启用' : '未启用'}</em>
        </label>

        {/* 开关关闭时下方全部控件置灰且不可操作 */}
        <fieldset className="ec-wm-gate" disabled={!draft.enabled}>

        <div className="ec-wm-field">
          <span className="ec-wm-label">素材类型</span>
          <div className="ec-wm-seg" role="group" aria-label="素材类型">
            {WATERMARK_MATERIALS.map(option => (
              <button
                key={option.value}
                type="button"
                className={material === option.value ? 'is-active' : ''}
                aria-pressed={material === option.value}
                onClick={() => onMaterialChange?.(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ec-wm-field">
          <span className="ec-wm-label">水印类型</span>
          <div className="ec-wm-seg" role="group" aria-label="水印类型">
            {WATERMARK_TYPES.map(option => (
              <button
                key={option.value}
                type="button"
                className={draft.type === option.value ? 'is-active' : ''}
                aria-pressed={draft.type === option.value}
                onClick={() => patch({ type: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ec-wm-preview-wrap">
          <div className="ec-wm-label-row">
            <span className="ec-wm-label">位置预览</span>
            <span className="ec-wm-hint"><Hand size={12} /> 拖动水印调整位置</span>
          </div>
          <div
            ref={previewBoxRef}
            className={'ec-wm-preview' + (draft.enabled ? ' is-live' : '')}
            style={{ aspectRatio: 1 }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <WatermarkLayer
              config={draft}
              material={material}
              width={previewSize || 200}
              height={previewSize || 200}
              className="ec-wm-layer-preview"
            />
          </div>
          <p className="ec-wm-tip">预览是 1:1 示意区，点「确定」后才会应用到素材，位置与大小保持一致。</p>
        </div>

        <label className="ec-wm-switch">
          <input type="checkbox" checked={draft.tile} onChange={e => patch({ tile: e.target.checked })} />
          <span>铺满图片</span>
          <em>按网格重复填充（文字与图片水印都支持）</em>
        </label>

        <div className="ec-wm-field">
          <span className="ec-wm-label">相对位置（%）</span>
          <div className="ec-wm-row">
            <label className="ec-wm-num">X
              <input type="number" min="0" max="100" value={draft.xPercent}
                onChange={e => patch({ xPercent: Number(e.target.value) })} />
            </label>
            <label className="ec-wm-num">Y
              <input type="number" min="0" max="100" value={draft.yPercent}
                onChange={e => patch({ yPercent: Number(e.target.value) })} />
            </label>
            {draft.tile && (
              <>
                <label className="ec-wm-num">横向间距
                  <input type="number" min="6" max="60" value={Math.round(draft.tileGapXPercent)}
                    onChange={e => patch({ tileGapXPercent: Number(e.target.value) })} />
                </label>
                <label className="ec-wm-num">纵向间距
                  <input type="number" min="6" max="60" value={Math.round(draft.tileGapYPercent)}
                    onChange={e => patch({ tileGapYPercent: Number(e.target.value) })} />
                </label>
              </>
            )}
          </div>
        </div>

        {!isLogo && (
          <>
            <label className="ec-wm-field">
              <span className="ec-wm-label">水印文字</span>
              <input className="ec-wm-input" type="text" value={draft.text} maxLength={40}
                onChange={e => patch({ text: e.target.value })} />
            </label>
            <div className="ec-wm-field">
              <span className="ec-wm-label">文字大小 <em>{draft.fontSize}</em></span>
              <input type="range" min="10" max="140" value={draft.fontSize}
                onChange={e => patch({ fontSize: Number(e.target.value) })} />
            </div>
            <div className="ec-wm-field">
              <span className="ec-wm-label">文字颜色</span>
              <div className="ec-wm-row">
                <input type="color" value={draft.color} onChange={e => patch({ color: e.target.value })} />
                <span className="ec-wm-label">透明度 <em>{Math.round(draft.opacity * 100)}%</em></span>
                <input type="range" min="0" max="100" value={Math.round(draft.opacity * 100)}
                  onChange={e => patch({ opacity: Number(e.target.value) / 100 })} />
              </div>
            </div>
            <div className="ec-wm-field">
              <span className="ec-wm-label">描边颜色</span>
              <div className="ec-wm-row">
                <input type="color" value={draft.strokeColor} onChange={e => patch({ strokeColor: e.target.value })} />
                <span className="ec-wm-label">透明度 <em>{Math.round(draft.strokeOpacity * 100)}%</em></span>
                <input type="range" min="0" max="100" value={Math.round(draft.strokeOpacity * 100)}
                  onChange={e => patch({ strokeOpacity: Number(e.target.value) / 100 })} />
              </div>
            </div>
            <div className="ec-wm-field">
              <span className="ec-wm-label">旋转角度 <em>{draft.rotation}°</em></span>
              <input type="range" min="-180" max="180" value={draft.rotation}
                onChange={e => patch({ rotation: Number(e.target.value) })} />
            </div>
          </>
        )}

        {isLogo && (
          <>
            <div className="ec-wm-field">
              <span className="ec-wm-label">图片水印</span>
              <div className="ec-wm-row">
                <button type="button" className="ec-wm-btn" onClick={() => fileRef.current?.click()}>
                  <Upload size={13} /> 上传图片
                </button>
                <button type="button" className="ec-wm-btn" onClick={handleRemoveBackground}
                  disabled={!draft.logoUrl || busy === 'bg'}>
                  {busy === 'bg' ? <Loader2 size={13} className="is-spin" /> : <Eraser size={13} />} 去纯色背景
                </button>
                <button type="button" className="ec-wm-btn is-ghost" onClick={() => patch({ logoUrl: '' })} disabled={!draft.logoUrl}>
                  <Trash2 size={13} /> 移除
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleLogoUpload} />
            </div>
            <div className="ec-wm-field">
              <span className="ec-wm-label">图片水印大小 <em>{Math.round(draft.logoScale * 100)}%</em></span>
              <input type="range" min="2" max="80" value={Math.round(draft.logoScale * 100)}
                onChange={e => patch({ logoScale: Number(e.target.value) / 100 })} />
            </div>
            <div className="ec-wm-field">
              <span className="ec-wm-label">透明度 <em>{Math.round(draft.opacity * 100)}%</em></span>
              <input type="range" min="0" max="100" value={Math.round(draft.opacity * 100)}
                onChange={e => patch({ opacity: Number(e.target.value) / 100 })} />
            </div>
            <div className="ec-wm-field">
              <span className="ec-wm-label">旋转角度 <em>{draft.rotation}°</em></span>
              <input type="range" min="-180" max="180" value={draft.rotation}
                onChange={e => patch({ rotation: Number(e.target.value) })} />
            </div>
          </>
        )}

        {isVideo && (
          <div className="ec-wm-motion">
            <span className="ec-wm-label">动态水印（视频）</span>
            <div className="ec-wm-modes">
              {WATERMARK_MOTION_MODES.map(mode => (
                <button
                  key={mode.value}
                  type="button"
                  title={mode.hint}
                  className={draft.motion.mode === mode.value ? 'is-active' : ''}
                  aria-pressed={draft.motion.mode === mode.value}
                  onClick={() => patchMotion({ mode: mode.value })}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            {draft.motion.mode !== 'static' && (
              <>
                <div className="ec-wm-field">
                  <span className="ec-wm-label">速度 <em>{draft.motion.speed.toFixed(1)}x</em></span>
                  <input type="range" min="2" max="40" value={Math.round(draft.motion.speed * 10)}
                    onChange={e => patchMotion({ speed: Number(e.target.value) / 10 })} />
                </div>
                {draft.motion.mode === 'rotate' && (
                  <div className="ec-wm-field">
                    <span className="ec-wm-label">跳位间隔 <em>{draft.motion.intervalSec}s</em></span>
                    <input type="range" min="2" max="60" value={draft.motion.intervalSec}
                      onChange={e => patchMotion({ intervalSec: Number(e.target.value) })} />
                  </div>
                )}
                {draft.motion.mode === 'marquee' && (
                  <div className="ec-wm-field">
                    <span className="ec-wm-label">方向</span>
                    <div className="ec-wm-seg">
                      {[['horizontal', '横向'], ['vertical', '纵向'], ['diagonal', '对角']].map(([value, label]) => (
                        <button key={value} type="button"
                          className={draft.motion.direction === value ? 'is-active' : ''}
                          aria-pressed={draft.motion.direction === value}
                          onClick={() => patchMotion({ direction: value })}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="ec-wm-field">
                  <span className="ec-wm-label">安全边距 <em>{Math.round(draft.motion.safePaddingPercent)}%</em></span>
                  <input type="range" min="0" max="25" value={Math.round(draft.motion.safePaddingPercent)}
                    onChange={e => patchMotion({ safePaddingPercent: Number(e.target.value) })} />
                </div>
                <p className="ec-wm-tip">动态水印只在视频预览/成片中移动，导出静态帧时按当前帧位置落盘。</p>
              </>
            )}
          </div>
        )}

        </fieldset>

        {notice && <p className="ec-wm-notice">{notice}</p>}
      </div>

      <footer className="ec-wm-panel-foot">
        <button type="button" className="ec-wm-btn is-ghost" onClick={() => { onCancel?.(); onClose?.(); }}>取消</button>
        <button type="button" className="ec-wm-btn is-primary" onClick={() => { onCommit?.(draft); onClose?.(); }}>
          <Check size={14} /> 确定
        </button>
      </footer>
    </aside>
  );
}
