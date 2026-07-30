import React, { useEffect, useMemo, useState } from 'react';
import { responsiveImageCandidates } from './responsiveImageModel.js';

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
  ratio = '1:1',
  className,
  style,
  imgStyle,
  onLoad,
  onError,
}) {
  const [failed, setFailed] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const candidates = useMemo(() => responsiveImageCandidates(src, variant), [src, variant]);
  const imageSrc = candidates[candidateIndex] || '';

  useEffect(() => {
    setFailed(false);
    setCandidateIndex(0);
  }, [src, variant]);
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#f4f4f5',
        aspectRatio: normalizedRatio(ratio),
        ...style,
      }}
    >
      {imageSrc && !failed && (
        <img
          src={imageSrc}
          alt={alt}
          draggable="false"
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchpriority={priority ? 'high' : 'auto'}
          onLoad={onLoad}
          onError={event => {
            if (candidateIndex + 1 < candidates.length) {
              setCandidateIndex(index => index + 1);
              return;
            }
            setFailed(true);
            onError?.(event);
          }}
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', ...imgStyle }}
        />
      )}
    </div>
  );
}
