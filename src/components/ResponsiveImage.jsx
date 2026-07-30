import React, { useState } from 'react';
import { proxyImg } from '../services/api.js';

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
  const imageSrc = proxyImg(src, variant);
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
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          onLoad={onLoad}
          onError={event => {
            setFailed(true);
            onError?.(event);
          }}
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain', ...imgStyle }}
        />
      )}
    </div>
  );
}
