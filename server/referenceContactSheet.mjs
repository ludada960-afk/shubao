import sharp from 'sharp';

function dataUriToBuffer(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,([\s\S]+)$/);
  if (!match) return null;
  try { return Buffer.from(match[1], 'base64'); } catch { return null; }
}

/**
 * 将有限数量的产品实拍/风格参考压为一张有标尺的视觉锚点。
 * 当前兼容的图片网关只接收一个 image 字段；拼图比只取第 1 张能保留更多角度与风格信息。
 */
export async function buildReferenceContactSheet(images, { maxImages = 8, cellSize = 512 } = {}) {
  const buffers = (Array.isArray(images) ? images : [])
    .map(dataUriToBuffer)
    .filter(Boolean)
    .slice(0, maxImages);
  if (!buffers.length) return null;

  const prepared = [];
  for (const buffer of buffers) {
    try {
      prepared.push(await sharp(buffer)
        .rotate()
        .resize(cellSize, cellSize, { fit: 'contain', background: '#f8f8f8' })
        .jpeg({ quality: 88 })
        .toBuffer());
    } catch {
      // 单张损坏图不应让整次商品图任务失败。
    }
  }
  if (!prepared.length) return null;

  const cols = Math.min(4, Math.ceil(Math.sqrt(prepared.length)));
  const rows = Math.ceil(prepared.length / cols);
  const composites = prepared.map((input, index) => ({
    input,
    left: (index % cols) * cellSize,
    top: Math.floor(index / cols) * cellSize,
  }));
  const sheet = await sharp({
    create: {
      width: cols * cellSize,
      height: rows * cellSize,
      channels: 3,
      background: '#f8f8f8',
    },
  }).composite(composites).jpeg({ quality: 88 }).toBuffer();

  return `data:image/jpeg;base64,${sheet.toString('base64')}`;
}
