/**
 * 生成插件图标 PNG
 * 运行：node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const SIZES = [16, 48, 128];
const OUT_DIR = path.join(__dirname, '..', 'shubao-extension', 'icons');

// 薯包AI 品牌色
const BG_GRADIENT_START = '#7c3aed'; // 紫色
const BG_GRADIENT_END = '#6366f1';   // 靛蓝

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // 圆角矩形背景
  const r = size * 0.2;
  drawRoundedRect(ctx, 0, 0, size, size, r);
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, BG_GRADIENT_START);
  gradient.addColorStop(1, BG_GRADIENT_END);
  ctx.fillStyle = gradient;
  ctx.fill();

  // 购物袋图标 "🛍️" 的简化版本
  const iconSize = size * 0.55;
  const cx = size / 2;
  const cy = size / 2;

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = size * 0.08;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 购物袋主体（圆形底部 + 顶部提手）
  const bagW = iconSize;
  const bagH = iconSize * 1.05;
  const bx = cx - bagW / 2;
  const by = cy - bagH / 2 + size * 0.05;

  // 袋子主体
  ctx.beginPath();
  ctx.moveTo(bx, by + bagH * 0.2);
  ctx.lineTo(bx + bagW * 0.2, by);
  ctx.lineTo(bx + bagW * 0.8, by);
  ctx.lineTo(bx + bagW, by + bagH * 0.2);
  ctx.quadraticCurveTo(bx + bagW, by + bagH, bx + bagW / 2, by + bagH);
  ctx.quadraticCurveTo(bx, by + bagH, bx, by + bagH * 0.2);
  ctx.closePath();
  ctx.stroke();

  // 购物袋上的"AI"文字（仅 48 和 128 尺寸）
  if (size >= 48) {
    ctx.fillStyle = '#fff';
    const fontSize = size * 0.18;
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AI', cx, cy + size * 0.05);
  }

  // 底部高光小横线（代表商品）
  ctx.beginPath();
  ctx.moveTo(cx - bagW * 0.25, by + bagH * 0.65);
  ctx.lineTo(cx + bagW * 0.25, by + bagH * 0.65);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - bagW * 0.2, by + bagH * 0.8);
  ctx.lineTo(cx + bagW * 0.2, by + bagH * 0.8);
  ctx.stroke();

  return canvas.toBuffer('image/png');
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Main
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

for (const size of SIZES) {
  const buf = generateIcon(size);
  const outPath = path.join(OUT_DIR, `icon${size}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`✅ Generated ${outPath} (${buf.length} bytes)`);
}

console.log('\n✅ 所有图标生成完毕');
