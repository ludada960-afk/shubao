import React, { useEffect, useMemo, useState } from 'react';
import {
  buildWatermarkTiles,
  normalizeWatermark,
  watermarkFontSizePx,
  watermarkLogoWidthPx,
  watermarkMotionAnimation,
} from '../canvasWatermarkModel.js';

/**
 * 素材水印渲染层 (2026-09-08)
 * 画布节点与面板预览共用同一组件 —— 保证「预览 == 素材」所见即所得。
 * 位置用相对百分比；字号/Logo 按素材宽度换算；动态水印走独立 motion 层，
 * 与定位层（transform: translate(-50%,-50%)）和旋转层互不干扰。
 */
export default function WatermarkLayer({
  config,
  material = 'image',
  width = 1000,
  height = 1000,
  className = '',
}) {
  const normalized = useMemo(() => normalizeWatermark(config, { material }), [config, material]);
  const tiles = useMemo(() => buildWatermarkTiles(normalized, { width, height }), [normalized, width, height]);
  const animation = useMemo(
    () => watermarkMotionAnimation(normalized, { material, width, height }),
    [normalized, material, width, height],
  );
  const [traceText, setTraceText] = useState('');

  useEffect(() => {
    if (material !== 'video' || normalized.motion.mode !== 'trace') return undefined;
    const tick = () => {
      const now = new Date();
      setTraceText(now.toLocaleString('zh-CN', { hour12: false }));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [material, normalized.motion.mode]);

  if (!normalized.enabled) return null;
  const isLogo = normalized.type === 'logo' && Boolean(normalized.logoUrl);
  const content = material === 'video' && normalized.motion.mode === 'trace'
    ? (traceText || normalized.text)
    : normalized.text;
  const fontSize = watermarkFontSizePx(normalized, width);
  const logoWidth = watermarkLogoWidthPx(normalized, width);
  const strokeWidth = normalized.strokeOpacity > 0 ? Math.max(1, fontSize * 0.055) : 0;
  const travel = Math.max(40, Number(width) || 0);
  const motionStyle = animation
    ? {
      ...animation,
      '--ec-wm-travel': travel + 'px',
      /* 安全边距控制动态水印的位移幅度：边距越大，漂移/跳位离边缘越远 */
      '--ec-wm-drift': Math.round(travel * Math.max(0.02, normalized.motion.safePaddingPercent / 100) * 1.4) + 'px',
    }
    : null;

  return (
    <div
      className={'ec-wm-layer' + (className ? ' ' + className : '') + (normalized.tile ? ' is-tiled' : '')}
      aria-hidden="true"
      data-watermark-material={material}
    >
      {tiles.map(tile => (
        <span
          key={tile.id}
          className="ec-wm-anchor"
          style={{ left: tile.xPercent + '%', top: tile.yPercent + '%' }}
        >
          <span className="ec-wm-rotate" style={{ transform: 'rotate(' + normalized.rotation + 'deg)' }}>
            <span className="ec-wm-motion" style={motionStyle || undefined}>
              {isLogo ? (
                <img
                  className="ec-wm-logo"
                  src={normalized.logoUrl}
                  alt=""
                  draggable="false"
                  style={{ width: logoWidth + 'px', opacity: normalized.opacity }}
                />
              ) : (
                <span
                  className="ec-wm-text"
                  style={{
                    color: normalized.color,
                    opacity: normalized.opacity,
                    fontFamily: normalized.fontFamily,
                    fontSize: fontSize + 'px',
                    fontWeight: normalized.fontWeight,
                    WebkitTextStroke: strokeWidth ? strokeWidth + 'px ' + normalized.strokeColor : undefined,
                    WebkitTextStrokeOpacity: strokeWidth ? normalized.strokeOpacity : undefined,
                  }}
                >
                  {content}
                </span>
              )}
            </span>
          </span>
        </span>
      ))}
    </div>
  );
}
