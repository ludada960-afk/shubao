import { resolveFont } from './fontRegistry.mjs';

const ALIGNMENTS = new Set(['left', 'center', 'right']);
const COLOR_RE = /^#(?:[a-f0-9]{3}|[a-f0-9]{4}|[a-f0-9]{6}|[a-f0-9]{8})$/i;
const MAX_TEXT_LENGTH = 4000;

function positiveInteger(value, name, maximum) {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new TypeError(`${name} must be a positive integer no greater than ${maximum}`);
  }
  return value;
}

function finiteNumber(value, name, minimum, maximum) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} must be a finite number from ${minimum} to ${maximum}`);
  }
  return value;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function renderTextLayer({
  text,
  fontId = 'fallback-sans',
  fontSize,
  color,
  width,
  align = 'left',
  lineHeight = 1.2,
} = {}) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  if (text.length > MAX_TEXT_LENGTH) throw new TypeError(`text must not exceed ${MAX_TEXT_LENGTH} characters`);
  const safeFontSize = finiteNumber(fontSize, 'fontSize', 1, 512);
  const safeWidth = positiveInteger(width, 'width', 8192);
  const safeLineHeight = finiteNumber(lineHeight, 'lineHeight', 0.5, 3);
  if (typeof color !== 'string' || !COLOR_RE.test(color)) throw new TypeError('color must be a hexadecimal color');
  if (!ALIGNMENTS.has(align)) throw new TypeError('align must be left, center or right');

  const font = resolveFont({ fontId });
  const lines = text.split(/\r\n|\r|\n/);
  const lineAdvance = safeFontSize * safeLineHeight;
  const height = Math.max(1, Math.ceil(lineAdvance * lines.length));
  const x = align === 'center' ? safeWidth / 2 : align === 'right' ? safeWidth : 0;
  const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
  const tspans = lines.map((line, index) => (
    `<tspan x="${x}"${index === 0 ? '' : ` dy="${lineAdvance}"`}>${escapeXml(line)}</tspan>`
  )).join('');
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${height}" viewBox="0 0 ${safeWidth} ${height}">`
      + `<text x="${x}" y="${safeFontSize}" xml:space="preserve" fill="${color}" font-family="${escapeXml(font.family)}" font-size="${safeFontSize}" text-anchor="${anchor}">${tspans}</text>`
      + '</svg>',
    'utf8',
  );

  return {
    svg,
    font,
    metrics: {
      text,
      width: safeWidth,
      height,
      baseline: safeFontSize,
      lineCount: lines.length,
      lineAdvance,
    },
  };
}

export { escapeXml };
