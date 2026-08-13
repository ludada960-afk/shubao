import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  responsiveImageCandidates,
  responsiveImageSrcSet,
  retryImageSrcSet,
  retryImageUrl,
} from './responsiveImageModel.js';

const IMAGE_RETRY_DELAYS_MS = Object.freeze([750, 2_000, 5_000]);

function normalizedRatio(value) {
  if (value === 'auto') return null;
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
  const [loaded, setLoaded] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const sourceKeyRef = useRef(null);
  const candidates = useMemo(() => responsiveImageCandidates(src, variant), [src, variant]);
  const fallbacks = useMemo(() => responsiveImageCandidates(src, 'full'), [src]);
  const avifSrcSet = useMemo(() => responsiveImageSrcSet(src, 'avif'), [src]);
  const webpSrcSet = useMemo(() => responsiveImageSrcSet(src, 'webp'), [src]);
  const baseImageSrc = optimizedFailed
    ? (fallbacks[candidateIndex] || '')
    : (candidates[0] || fallbacks[0] || '');
  const imageSrc = retryImageUrl(baseImageSrc, retryCount);
  const retryAvifSrcSet = retryImageSrcSet(avifSrcSet, retryCount);
  const retryWebpSrcSet = retryImageSrcSet(webpSrcSet, retryCount);

  useEffect(() => {
    const nextKey = `${src || ''}\0${variant || ''}`;
    // A cached image can fire load before effects run. Do not erase that
    // successful state on the first mount; only reset when the source changes.
    if (sourceKeyRef.current === null) {
      sourceKeyRef.current = nextKey;
      return;
    }
    if (sourceKeyRef.current === nextKey) return;
    sourceKeyRef.current = nextKey;
    setFailed(false);
    setOptimizedFailed(false);
    setDecoded(false);
    setLoaded(false);
    setCandidateIndex(0);
    setRetryCount(0);
  }, [src, variant]);

  useEffect(() => {
    if (!failed || retryCount >= IMAGE_RETRY_DELAYS_MS.length) return undefined;
    const timer = setTimeout(() => {
      setOptimizedFailed(false);
      setCandidateIndex(0);
      setDecoded(false);
      setLoaded(false);
      setFailed(false);
      setRetryCount(count => count + 1);
    }, IMAGE_RETRY_DELAYS_MS[retryCount]);
    return () => clearTimeout(timer);
  }, [failed, retryCount]);
  return (
    <div
      className={className}
      aria-busy={Boolean(imageSrc) && !loaded}
      data-decoded={decoded ? 'true' : undefined}
      onClick={onClick}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#f4f4f5',
        ...(normalizedRatio(ratio) ? { aspectRatio: normalizedRatio(ratio) } : {}),
        ...style,
      }}
    >
      {imageSrc && !loaded && !failed && <span className="responsive-image-skeleton" aria-hidden="true" style={{ position: 'absolute', inset: 0, background: '#eceef1' }} />}
      {imageSrc && !failed && (
        <picture style={{ display: 'contents' }}>
          {!optimizedFailed && retryAvifSrcSet && <source type="image/avif" srcSet={retryAvifSrcSet} sizes={sizes} />}
          {!optimizedFailed && retryWebpSrcSet && <source type="image/webp" srcSet={retryWebpSrcSet} sizes={sizes} />}
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
              setLoaded(true);
              onLoad?.({ currentTarget: image, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight });
              const decode = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
              void decode.catch(() => {}).finally(() => setDecoded(true));
            }}
            onError={event => {
              setDecoded(false);
              setLoaded(false);
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
              if (retryCount >= IMAGE_RETRY_DELAYS_MS.length) onError?.(event);
            }}
            style={{
              width: '100%', height: ratio === 'auto' ? 'auto' : '100%', display: 'block', objectFit: 'contain',
              ...(ratio === 'auto' ? { objectFit: 'cover' } : {}),
              ...imgStyle,
              opacity: loaded ? (imgStyle?.opacity ?? 1) : 0,
              transition: imgStyle?.transition || 'opacity 120ms ease',
            }}
          />
        </picture>
      )}
    </div>
  );
}
