/**
 * 第三次重写抠图：BFS 洪水填充从边缘向内扩散，只删连续背景区域
 * 角色身上的白色眼睛/高光/衣物细节全部保留
 * 运行：node scripts/remove-bg.mjs
 */
import fs from 'fs';
import { createCanvas, loadImage } from 'canvas';

const JSX_FILE = 'shubao-final.jsx';
let content = fs.readFileSync(JSX_FILE, 'utf8');

function findDataUrl(content, key) {
  const startMarker = `${key}: "data:image/png;base64,`;
  const start = content.indexOf(startMarker);
  if (start === -1) return null;
  const valueStart = start + startMarker.length;
  const endQuote = content.indexOf('"', valueStart);
  if (endQuote === -1) return null;
  return { start, end: endQuote + 1, dataUrl: `data:image/png;base64,${content.substring(valueStart, endQuote)}`, raw: content.substring(start, endQuote + 1) };
}

// BFS 洪水填充：从边缘出发，只删与边缘相连的纯色背景
function floodFillRemoveBg(d, W, H, bg, threshold) {
  const visited = new Uint8Array(W * H);
  const queue = [];

  // 1. 把边缘上接近背景色的像素作为种子
  const enqueue = (x, y) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const idx = y * W + x;
    if (visited[idx]) return;
    const pi = idx * 4;
    const dr = d[pi] - bg[0], dg = d[pi + 1] - bg[1], db = d[pi + 2] - bg[2];
    if (Math.sqrt(dr * dr + dg * dg + db * db) < threshold) {
      visited[idx] = 1;
      queue.push(idx);
    }
  };

  for (let x = 0; x < W; x++) { enqueue(x, 0); enqueue(x, H - 1); }
  for (let y = 1; y < H - 1; y++) { enqueue(0, y); enqueue(W - 1, y); }

  // 2. BFS 扩散
  const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const y = Math.floor(idx / W), x = idx % W;
    // 删掉这个背景像素
    const pi = idx * 4;
    d[pi + 3] = 0;
    // 检查四邻域
    for (const [dx, dy] of neighbors) {
      enqueue(x + dx, y + dy);
    }
  }
  return head; // processed count
}

const keys = ['s1', 's2', 's3', 's4', 's5', 'wave', 'stand', 'excited', 'logo', 'appicon', 'welcome', 'upgrade'];

for (const key of keys) {
  const found = findDataUrl(content, key);
  if (!found) { console.log(`[${key}] MISSING`); continue; }

  try {
    const img = await loadImage(found.dataUrl);
    const W = img.width, H = img.height;
    const c = createCanvas(W, H);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, W, H);
    const d = imageData.data;

    // —— 检测背景色（边缘众数）——
    const buckets = {};
    const quantize = (v) => Math.round(v / 8) * 8;
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < 4; y++) {
        const i = (y * W + x) * 4; const k = `${quantize(d[i])},${quantize(d[i+1])},${quantize(d[i+2])}`;
        buckets[k] = (buckets[k] || 0) + 1;
      }
      for (let y = H - 4; y < H; y++) {
        const i = (y * W + x) * 4; const k = `${quantize(d[i])},${quantize(d[i+1])},${quantize(d[i+2])}`;
        buckets[k] = (buckets[k] || 0) + 1;
      }
    }
    for (let y = 4; y < H - 4; y++) {
      for (let x = 0; x < 4; x++) {
        const i = (y * W + x) * 4; const k = `${quantize(d[i])},${quantize(d[i+1])},${quantize(d[i+2])}`;
        buckets[k] = (buckets[k] || 0) + 1;
      }
      for (let x = W - 4; x < W; x++) {
        const i = (y * W + x) * 4; const k = `${quantize(d[i])},${quantize(d[i+1])},${quantize(d[i+2])}`;
        buckets[k] = (buckets[k] || 0) + 1;
      }
    }
    const topColor = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0][0];
    const bg = topColor.split(',').map(v => parseInt(v) + 4);
    const isWhiteBg = bg[0] >= 250 && bg[1] >= 250 && bg[2] >= 250;

    console.log(`[${key}] ${W}x${H} bg=rgb(${bg[0]},${bg[1]},${bg[2]}) isWhite=${isWhiteBg}`);

    if (isWhiteBg) {
      // BFS flood fill: threshold 38, 从边缘向内扩散
      const processed = floodFillRemoveBg(d, W, H, bg, 38);
      ctx.putImageData(imageData, 0, 0);
      const newUrl = c.toDataURL('image/png');
      const totalPx = W * H;
      console.log(`  → flood fill removed ${processed} seed pixels, 透明率 ${(processed * 100 / totalPx).toFixed(0)}%`);
      const oldEntry = found.raw;
      const newEntry = `${key}: "${newUrl}"`;
      content = content.replace(oldEntry, newEntry);
    } else {
      console.log(`  ⚠️ 非白色背景，跳过`);
    }
  } catch (err) {
    console.error(`  ✗ ${err.message}`);
  }
}

fs.writeFileSync(JSX_FILE, content);
console.log(`\n✅ Done!`);
