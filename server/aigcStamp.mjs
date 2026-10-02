// server/aigcStamp.mjs
// AIGC 隐式标识写入 —— 2026-10-03
//
// 法条依据（逐字，见 docs/design/97-content-moderation-plan.md §二）：
//   《人工智能生成合成内容标识办法》（国信办通字〔2025〕2 号）第五条：
//     「服务提供者应当……在生成合成内容的**文件元数据**中添加隐式标识，隐式标识包含
//       **生成合成内容属性信息、服务提供者名称或者编码、内容编号**等制作要素信息。」
//   配套 **GB 45438-2025**《网络安全技术 人工智能生成合成内容标识方法》（强制性国标，
//     2025-09-01 实施）规定了元数据字段的**具体写法**。
//
// ⚠️⚠️ 必须先读这两句再上线
//   1. **本文写的字段名是按《标识办法》第五条的语义自拟的，不是从 GB 45438-2025 抄的。**
//      国标全文在 openstd.samr.gov.cn 需在线阅读，本次未逐条取得。
//      上线前必须由法务对着国标核字段名与编码规则，改 PRODUCER_CODE 的格式。
//   2. **不要对外声称「已符合 GB 45438-2025」**，只能说「已按《标识办法》第五条的
//      三要素写入元数据，字段待与国标对齐」。《用户协议》第七条已书面承诺了标识义务
//      （见 src/pages/Legal/index.jsx），代码此前一字节都没写，这里是补上。
//
// 写在哪：产物落盘的**唯一汇聚点** ——
//   图片 server/generatedAssets.mjs 的 downloadAndPersist / persistBuffer
//   视频 server/videoGeneration.mjs 的 persistOutput
// 在汇聚点打一次，覆盖图文/电商/画布/资产库/作品库/导出全部链路；在各业务路由打会漏。
//
// 零重编码：PNG 走「插入 iTXt chunk」，只改文件头不改像素；JPEG/WebP 用 sharp
//   的 withExif，那条**会重编码**（有 CPU 与画质代价，见 formatSupport）。

import crypto from 'crypto';
import fs from 'node:fs';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** ⚠️ 待与 GB 45438-2025 对齐。当前值只满足《标识办法》第五条的语义要求。 */
const PRODUCER_NAME = '薯包AI';
/** ⚠️ 编码规则待对齐网安秘字〔2025〕29 号《服务提供者编码规则》。 */
const PRODUCER_CODE = 'SHUBAO-CN';

export const AIGC_METADATA_KEYS = Object.freeze({
  attribute: 'AIGC',
  producer: 'AIGCProducer',
  contentId: 'AIGCContentId',
});

/** 内容编号：与 sha256(buffer) 不同 —— 注入后 buffer 会变，所以编号必须在注入前定。 */
export function contentIdFor(taskId, seed = '') {
  return 'AIGC-' + crypto.createHash('sha256')
    .update(String(taskId || '') + '|' + String(seed || ''))
    .digest('hex')
    .slice(0, 32);
}

function isPng(buffer) {
  return buffer.length > 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE);
}

function pngChunkType(buffer, offset) {
  return buffer.subarray(offset + 4, offset + 8).toString('latin1');
}

/**
 * 往 PNG 里插一个 iTXt（UTF-8 文本）chunk，**不改任何像素**。
 * iTXt 结构：length(4) | type(4)="iTXt" | keyword\0 | compressionFlag(1)=0
 *            | compressionMethod(1)=0 | languageTag\0 | translatedKeyword\0 | text
 */
function insertPngItxt(buffer, keyword, value) {
  const kw = Buffer.from(keyword, 'latin1');
  const val = Buffer.from(value, 'utf8');
  const payload = Buffer.concat([
    kw, Buffer.from([0]),
    Buffer.from([0, 0]),          // compressionFlag=0, compressionMethod=0
    Buffer.from([0]),             // languageTag (空)
    Buffer.from([0]),             // translatedKeyword (空)
    val,
  ]);
  const type = Buffer.from('iTXt', 'latin1');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(payload.length, 0);
  /* CRC 覆盖 type + payload */
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, payload])) >>> 0, 0);

  /* 插在第一个 IDAT 之前 —— 放在像素数据后面虽然也合法，但放前面更通用 */
  let offset = 8; // 跳过签名
  while (offset + 8 <= buffer.length) {
    const len4 = buffer.readUInt32BE(offset);
    const type = pngChunkType(buffer, offset);
    if (type === 'IEND') break;
    if (type === 'IDAT') break;
    offset += 12 + len4; // length(4) + type(4) + data + crc(4)
  }
  return Buffer.concat([
    buffer.subarray(0, offset),
    len, type, payload, crc,
    buffer.subarray(offset),
  ]);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

/* ── WebP：写 XMP chunk（零重编码）────────────────────────────────────────────
   为什么不能像 JPEG 那样直接用 sharp 重编码：
   · 已发布的案例图（public/gallery/**.webp）本身就是 webp q90，再编一次是
     **二次有损压缩**，首页/案例页的主视觉会肉眼可见地掉画质；
   · WebP 的 XMP/EXIF 只在**扩展格式（VP8X）**下才被解码器读取。往简单格式里
     塞一个 XMP chunk，解码器会直接忽略 —— 字节是写进去了，但**读不出来**，
     那等于做了个假的标识。所以这里顺带把简单格式升级成 VP8X。

   解码顺序（WebP 规范）：VP8X → ICCP → ANIM → ALPH → VP8/VP8L → EXIF → XMP
   ⚠️ 动图（ANIM/ANMF）不做 —— 帧结构复杂，改写风险大于收益，直接回退重编码。 */

function isWebp(buffer) {
  return buffer.length > 16
    && buffer.toString('latin1', 0, 4) === 'RIFF'
    && buffer.toString('latin1', 8, 12) === 'WEBP';
}

/** 解析 RIFF 顶层 chunk；返回 [{ fourCC, data }]，data 不含 padding。 */
function readWebpChunks(buffer) {
  const chunks = [];
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const fourCC = buffer.toString('latin1', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;
    if (dataEnd > buffer.length) break; // 截断文件，交给调用方回退
    chunks.push({ fourCC, data: buffer.subarray(dataStart, dataEnd) });
    offset = dataEnd + (size % 2); // 奇数长度的 chunk 有 1 字节 padding
  }
  return chunks;
}

/** 从 VP8(有损)/VP8L(无损) 帧头读画布尺寸 —— VP8X 必须填这个。 */
function webpCanvasSize(frame) {
  if (frame.length < 10) return null;
  // 有损 VP8：3 字节帧标记 + 起始码 9d 01 2a + 2 字节宽 + 2 字节高（各 14 位有效）
  if (frame.toString('latin1', 3, 6) === '\x9d\x01\x2a') {
    return { width: frame.readUInt16LE(6) & 0x3fff, height: frame.readUInt16LE(8) & 0x3fff };
  }
  // 无损 VP8L：1 字节签名 0x2f + 14 位(width-1) + 14 位(height-1)
  if (frame[0] === 0x2f && frame.length >= 5) {
    const bits = frame.readUInt32LE(1);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** 构造 XMP packet。字段名同样待与 GB 45438-2025 对齐（见文件顶部）。 */
function buildXmpPacket(values) {
  const attrs = Object.entries(values)
    .map(([k, v]) => `\n      aigc:${k}="${xmlEscape(v)}"`)
    .join('');
  const head = `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:aigc="https://shubao.cn/ns/aigc/1.0/"${attrs} />
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="`;
  const tail = '"?>';
  /* Adobe 约定：用空格补齐到 4 字节倍数，再补 end 标记 */
  const pad = (4 - ((Buffer.byteLength(head, 'utf8') + Buffer.byteLength(tail, 'utf8')) % 4)) % 4;
  return Buffer.from(head + ' '.repeat(pad) + tail, 'utf8');
}

function riffChunk(fourCC, data) {
  const head = Buffer.alloc(8);
  head.write(fourCC, 0, 'latin1');
  head.writeUInt32LE(data.length, 4);
  return Buffer.concat([head, data, data.length % 2 ? Buffer.from([0]) : Buffer.alloc(0)]);
}

/**
 * 往 WebP 里写 XMP，**不改任何像素**。
 * @returns {Buffer|null} null = 这个文件处理不了（动图/截断/未知帧），调用方应回退重编码
 */
function insertWebpXmp(buffer, values) {
  const chunks = readWebpChunks(buffer);
  const frame = chunks.find(c => c.fourCC === 'VP8 ' || c.fourCC === 'VP8L');
  if (!frame) return null;
  /* 动图：帧结构是 ANMF/ANMF…，改写代价大，直接放弃零重编码 */
  if (chunks.some(c => c.fourCC === 'ANIM' || c.fourCC === 'ANMF')) return null;

  const size = webpCanvasSize(frame.data);
  if (!size || !size.width || !size.height) return null;

  const alpha = chunks.find(c => c.fourCC === 'ALPH') || null;
  const iccp = chunks.find(c => c.fourCC === 'ICCP') || null;
  const existingExif = chunks.find(c => c.fourCC === 'EXIF') || null;
  const xmp = buildXmpPacket(values);

  /* VP8X 首字节位序（Rsv,Rsv,ICC,ALPHA,EXIF,XMP,ANIM,Rsv） */
  let flags = 0;
  if (iccp) flags |= 0x20;
  if (alpha) flags |= 0x10;
  if (existingExif) flags |= 0x08;
  flags |= 0x04; // XMP

  const vp8x = Buffer.alloc(10);
  vp8x[0] = flags;
  vp8x.writeUIntLE(size.width - 1, 4, 3);
  vp8x.writeUIntLE(size.height - 1, 7, 3);

  const parts = [
    riffChunk('VP8X', vp8x),
    ...(iccp ? [riffChunk('ICCP', iccp.data)] : []),
    ...(alpha ? [riffChunk('ALPH', alpha.data)] : []),
    riffChunk(frame.fourCC, frame.data),
    ...(existingExif ? [riffChunk('EXIF', existingExif.data)] : []),
    riffChunk('XMP ', xmp),
  ];
  const body = Buffer.concat(parts);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(body.length + 4, 4); // +4 = 'WEBP' 四字节
  header.write('WEBP', 8, 'latin1');
  return Buffer.concat([header, body]);
}

/**
 * 给图片 buffer 写入隐式标识。
 * @param {Buffer} buffer 原始字节
 * @param {{contentType?: string, contentId: string, sharp?: Function}} options
 * @returns {Promise<Buffer>} 带标识的字节；失败时**原样返回**（标识失败不能阻断生成）
 */
export async function stampImage(buffer, { contentType = 'image/png', contentId, sharp } = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) return buffer;
  if (!contentId) throw new Error('stampImage 需要 contentId');
  const values = {
    [AIGC_METADATA_KEYS.attribute]: '1',
    [AIGC_METADATA_KEYS.producer]: `${PRODUCER_NAME}(${PRODUCER_CODE})`,
    [AIGC_METADATA_KEYS.contentId]: String(contentId),
  };

  try {
    /* PNG：零重编码，直接插 chunk */
    if (isPng(buffer)) {
      let out = buffer;
      for (const [k, v] of Object.entries(values)) out = insertPngItxt(out, k, v);
      return out;
    }
    /* WebP：零重编码，升级成 VP8X 后写 XMP chunk。
       ⚠️ 按**字节嗅探**而不是只信 content-type —— 上游给的 content-type 未必准，
       只认声明的话，一批实际是 webp 的产物会静默漏掉标识。 */
    if (isWebp(buffer)) {
      const out = insertWebpXmp(buffer, values);
      if (out) return out;
    }
    /* JPEG：sharp 的 withExif 需要重编码。失败就原样返回，不阻断。 */
    if (sharp && /jpeg|webp/i.test(contentType)) {
      const exif = {
        IFD0: {
          ImageDescription: 'AI generated content',
          Software: `${PRODUCER_NAME}(${PRODUCER_CODE})`,
          Copyright: `ContentID=${contentId}`,
        },
      };
      const pipeline = sharp(buffer, { failOn: 'none' });
      const out = /webp/i.test(contentType)
        ? await pipeline.withExif(exif).webp().toBuffer()
        : await pipeline.withExif(exif).jpeg({ quality: 92 }).toBuffer();
      return out;
    }
    return buffer;
  } catch (error) {
    /* ⚠️ 静默降级：不因为标识写失败就阻断用户生成。
       但这意味着那一次产物**没有标识** —— 所以要记一条，便于事后发现缺口。 */
    try {
      console.warn('[aigcStamp] 标识写入失败，返回原字节:', error?.message);
    } catch { /* ignore */ }
    return buffer;
  }
}

/* ── 视频：写 mp4 容器 metadata（零重编码）───────────────────────────────────
   《标识办法》第四条(四)要求「在视频起始画面和视频播放周边的适当位置添加显著的
   提示标识」（= 显式），第五条的隐式标识同样适用于视频。
   这里的隐式部分落在容器 metadata（comment / title / description）。

   ⚠️ 调用顺序铁律：**必须在 persistOutput 校验上游 x-content-sha256 之后**才调。
      提前调会改字节，让上游完整性校验失效。 */
function ffmpegAvailable() {
  return Boolean(process.env.FFMPEG_PATH || 'ffmpeg');
}

/**
 * @param {string} filePath 输入视频路径（原地替换为带标识的副本）
 * @param {{contentId: string, timeoutMs?: number}} options
 * @returns {Promise<boolean>} true=已写入；false=跳过或失败（原文件未动）
 */
export async function stampVideoFile(filePath, { contentId, timeoutMs = 20000 } = {}) {
  if (!contentId) return false;
  const bin = process.env.FFMPEG_PATH || 'ffmpeg';
  const tmpPath = filePath + '.aigc.tmp.mp4';
  const values = {
    comment: `AIGC=1; Producer=${PRODUCER_NAME}(${PRODUCER_CODE}); ContentID=${contentId}`,
    title: 'AI generated content',
  };
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', filePath,
    '-c', 'copy',                     // ← 关键：不重编码，只换容器
    '-metadata', `comment=${values.comment}`,
    '-metadata', `title=${values.title}`,
    '-movflags', '+faststart', tmpPath];
  try {
    const { spawn } = await import('node:child_process');
    const code = await new Promise(resolve => {
      const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'ignore'] });
      const timer = setTimeout(() => { try { child.kill(); } catch { /* ignore */ } }, timeoutMs);
      child.on('error', () => { clearTimeout(timer); resolve(-1); });
      child.on('close', c => { clearTimeout(timer); resolve(c); });
    });
    if (code !== 0) return false;
    const staged = fs.statSync(tmpPath);
    if (!staged.size) return false;
    fs.copyFileSync(tmpPath, filePath);
    return true;
  } catch {
    return false;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch { /* 没生成就算了 */ }
  }
}

export function videoFormatSupport() {
  return { mp4: 'ffmpeg -c copy 写容器 metadata（零重编码）', 其它: '未处理' };
}

export function formatSupport() {
  return {
    png: '零重编码（插 iTXt chunk）',
    webp: '零重编码（升级 VP8X + 写 XMP chunk；动图回退重编码）',
    jpeg: '重编码（sharp withExif，quality 92）',
    其它: '不处理，原样透传',
  };
}
