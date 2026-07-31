import React, { useEffect, useMemo, useState } from 'react';
import { responsiveImageCandidates, responsiveImageSrcSet } from './responsiveImageModel.js';

function normalizedRatio(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return String(value);
  if (typeof value !== 'string') return '1 / 1';
  const match = value.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if (!match) return '1 / 1';
  return `${match[1]} / ${match[2]}`;
}

export default function ResponsiveImage({
  src,
  alt = '',
  variant = 'thumb',
  priority = false,
  sizes = variant === 'display'
    ? 'min(100vw, 1600px)'
    : variant === 'canvas'
      ? '960px'
      : '320px',
  ratio = '1:1',
  className,
  style,
  imgStyle,
  onClick,
  onLoad,
  onError,
}) {
  const [failed, setFailed] = useState(false);
  const [optimizedFailed, setOptimizedFailed] = useState(false);
  const [decoded, setDecoded] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const candidates = useMemo(() => responsiveImageCandidates(src, variant), [src, variant]);
  const fallbacks = useMemo(() => responsiveImageCandidates(src, 'full'), [src]);
  const avifSrcSet = useMemo(() => responsiveImageSrcSet(src, 'avif'), [src]);
  const webpSrcSet = useMemo(() => responsiveImageSrcSet(src, 'webp'), [src]);
  const imageSrc = optimizedFailed
    ? (fallbacks[candidateIndex] || '')
    : (candidates[0] || fallbacks[0] || '');

  useEffect(() => {
    setFailed(false);
    setOptimizedFailed(false);
    setDecoded(false);
    setCandidateIndex(0);
  }, [src, variant]);
  return (
    <div
      className={className}
      aria-busy={Boolean(imageSrc) && !decoded}
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#f4f4f5',
        aspectRatio: normalizedRatio(ratio),
        ...style,
      }}
    >
      {imageSrc && !failed && (
        <picture style={{ display: 'contents' }}>
          {!optimizedFailed && avifSrcSet && <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} />}
          {!optimizedFailed && webpSrcSet && <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} />}
          <img
            src={imageSrc}
            alt={alt}
            draggable="false"
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            fetchpriority={priority ? 'high' : 'auto'}
            sizes={sizes}
            onLoad={event => {
              const image = event.currentTarget;
              const decode = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
              decode.catch(() => {}).finally(() => {
                setDecoded(true);
                onLoad?.(event);
              });
            }}
            onError={event => {
              setDecoded(false);
              if (!optimizedFailed) {
                setOptimizedFailed(true);
                setCandidateIndex(0);
                return;
              }
              if (candidateIndex + 1 < fallbacks.length) {
                setCandidateIndex(index => index + 1);
                return;
              }
              setFailed(true);
              onError?.(event);
            }}
            style={{
              width: '100%', height: '100%', display: 'block', objectFit: 'contain',
              ...imgStyle,
              opacity: decoded ? (imgStyle?.opacity ?? 1) : 0,
              transition: imgStyle?.transition || 'opacity 120ms ease',
            }}
          />
        </picture>
      )}
    </div>
  );
}
