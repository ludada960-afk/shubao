import React from 'react';

/**
 * 统一的模型品牌标识（9-11 用户批注：模型选项 LOGO 不对，照竞品那套）。
 * - 有官方 SVG 的渲染 img；没有可公开取件的品牌（OpenAI / Midjourney）渲染同尺寸品牌色字标。
 * - size 默认 18px，与竞品小方标一致；style 可覆盖。
 */
export default function ModelLogo({ logo, size = 18, radius = 5, style, alt = '' }) {
  if (!logo) return null;
  if (logo.src) {
    return React.createElement('img', {
      src: logo.src,
      alt,
      width: size,
      height: size,
      loading: 'lazy',
      decoding: 'async',
      style: { width: size, height: size, borderRadius: radius, flexShrink: 0, objectFit: 'contain', ...style },
    });
  }
  return React.createElement('span', {
    'aria-hidden': 'true',
    style: {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size, borderRadius: radius, flexShrink: 0,
      background: `${logo.color}14`, color: logo.color,
      fontSize: Math.max(8, Math.round(size * 0.44)), fontWeight: 800, letterSpacing: '-0.02em',
      ...style,
    },
  }, logo.chip || '');
}
