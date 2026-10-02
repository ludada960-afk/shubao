/* 验证 WebP 的零重编码标识：像素逐字节不变、仍是合法 webp、XMP 真的写进去了。

   为什么这组断言要紧：往 webp 里塞一个解码器会忽略的 chunk，等于做了个**假标识** ——
   字节在文件里，但谁也读不出来。所以除了查像素不变，还必须自己把 RIFF 解回来，
   确认 XMP chunk 真的在位、三个要素的值都在。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { stampImage, contentIdFor, AIGC_METADATA_KEYS } from '../server/aigcStamp.mjs';

async function sampleWebp({ width = 96, height = 64, alpha = false } = {}) {
  return sharp({
    create: { width, height, channels: alpha ? 4 : 3, background: alpha ? { r: 5, g: 9, b: 13, alpha: 0.5 } : { r: 120, g: 30, b: 200 } },
  }).webp({ quality: 90 }).toBuffer();
}

/** 自己解 RIFF，不依赖任何库 —— 顺带证明 chunk 结构是我们以为的那样。 */
function readXmp(buffer) {
  assert.equal(buffer.toString('latin1', 0, 4), 'RIFF');
  assert.equal(buffer.toString('latin1', 8, 12), 'WEBP');
  const declared = buffer.readUInt32LE(4) + 8;
  assert.equal(declared, buffer.length, 'RIFF 声明的长度必须与实际一致，否则解码器会拒绝');

  const found = {};
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const fourCC = buffer.toString('latin1', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const dataStart = offset + 8;
    found[fourCC] = buffer.subarray(dataStart, dataStart + size);
    offset = dataStart + size + (size % 2);
  }
  return found;
}

test('WebP 标识：像素逐字节不变（零重编码）', async () => {
  const before = await sampleWebp();
  const contentId = contentIdFor('task-webp-1', 'seed-a');
  const after = await stampImage(before, { contentType: 'image/webp', contentId });

  assert.notDeepEqual(after, before, '应该写入了东西');
  const rawBefore = await sharp(before).raw().toBuffer();
  const rawAfter = await sharp(after).raw().toBuffer();
  assert.equal(Buffer.compare(rawBefore, rawAfter), 0, '像素被改动了 —— 那就不是零重编码');
  const meta = await sharp(after).metadata();
  assert.equal(meta.format, 'webp', '写完仍须是合法 webp');
  assert.equal(meta.width, 96);
  assert.equal(meta.height, 64);
});

test('WebP 标识：XMP chunk 真的在位且三要素齐全（不是塞了个读不出来的空壳）', async () => {
  const before = await sampleWebp();
  const contentId = contentIdFor('task-webp-2', 'seed-b');
  const after = await stampImage(before, { contentType: 'image/webp', contentId });

  const chunks = readXmp(after);
  assert.ok(chunks.VP8X, '必须有 VP8X —— 没有它解码器会忽略 XMP，标识就成了摆设');
  assert.ok(chunks['XMP '], '必须有 XMP chunk');

  const xmp = chunks['XMP '].toString('utf8');
  assert.ok(xmp.includes('<?xpacket'), 'XMP packet 头');
  assert.ok(xmp.includes('<?xpacket end='), 'XMP packet 尾（补齐后必须有结束标记）');
  for (const key of Object.values(AIGC_METADATA_KEYS)) {
    assert.ok(xmp.includes(key), `XMP 里缺 ${key}`);
  }
  assert.ok(xmp.includes(contentId), '内容编号的值没写进去');
  assert.ok(xmp.includes('SHUBAO-CN'), '提供者编码没写进去');
  assert.ok(xmp.includes('薯包AI'), '提供者名称没写进去');
});

test('WebP 标识：VP8X 里的画布尺寸要和原图一致', async () => {
  const before = await sampleWebp({ width: 333, height: 217 });
  const after = await stampImage(before, { contentType: 'image/webp', contentId: 'AIGC-size' });
  const vp8x = readXmp(after).VP8X;
  assert.equal(vp8x.length, 10, 'VP8X 固定 10 字节');
  const width = vp8x.readUIntLE(4, 3) + 1;
  const height = vp8x.readUIntLE(7, 3) + 1;
  assert.equal(width, 333, 'VP8X 画布宽度写错了 —— 尺寸错了浏览器会按错误尺寸渲染');
  assert.equal(height, 217);
  assert.equal(vp8x[0] & 0x04, 0x04, 'VP8X flags 的 XMP 位必须置上');
});

test('WebP 标识：无损（VP8L）也能处理', async () => {
  const before = await sharp({
    create: { width: 40, height: 24, channels: 3, background: { r: 1, g: 2, b: 3 } },
  }).webp({ lossless: true }).toBuffer();
  assert.equal(before.toString('latin1', 12, 16), 'VP8L', '样本应是无损 webp');

  const after = await stampImage(before, { contentType: 'image/webp', contentId: 'AIGC-lossless' });
  const chunks = readXmp(after);
  assert.ok(chunks.VP8X, '无损 webp 也要能写标识');
  assert.ok(chunks['XMP '], '无损 webp 也要能写 XMP');
  const meta = await sharp(after).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 40);
});

test('WebP 标识：带 alpha 的图保留 ALPH 且仍能解码', async () => {
  const before = await sampleWebp({ alpha: true, width: 48, height: 48 });
  const after = await stampImage(before, { contentType: 'image/webp', contentId: 'AIGC-alpha' });
  const chunks = readXmp(after);
  assert.ok(chunks.ALPH, 'ALPH chunk 必须保留 —— 丢了 alpha 就成了不透明图');
  assert.equal(chunks.VP8X[0] & 0x10, 0x10, 'VP8X 的 ALPHA 位必须置上');
  const meta = await sharp(after).metadata();
  assert.equal(meta.format, 'webp');
  assert.equal(meta.width, 48);
  assert.equal(meta.hasAlpha, true);
});

test('WebP 标识：按字节嗅探，不信 content-type（上游给的类型未必准）', async () => {
  const before = await sampleWebp();
  /* 故意给一个**错误**的 content-type（上游常见） */
  const after = await stampImage(before, { contentType: 'application/octet-stream', contentId: 'AIGC-sniff' });
  assert.ok(readXmp(after)['XMP '], '实际是 webp 就该写标识，不能只认声明');
});

test('WebP 标识：重复写入不叠加，第二块的 XMP 覆盖第一块', async () => {
  const before = await sampleWebp();
  const once = await stampImage(before, { contentType: 'image/webp', contentId: contentIdFor('t', 'one') });
  const twice = await stampImage(once, { contentType: 'image/webp', contentId: contentIdFor('t', 'two') });

  const chunks = readXmp(twice);
  assert.equal(
    Object.keys(chunks).filter(k => k === 'XMP ').length, 1,
    '只能有一个 XMP chunk，重复写会把它撑成非法的 RIFF',
  );
  const xmp = chunks['XMP '].toString('utf8');
  assert.ok(xmp.includes(contentIdFor('t', 'two')), '应保留最后一次的内容编号');
  assert.ok(!xmp.includes(contentIdFor('t', 'one')), '旧的内容编号不该残留');
});

test('WebP 标识：非图片字节原样透传，不抛错', async () => {
  const junk = Buffer.from('not an image at all');
  const out = await stampImage(junk, { contentType: 'image/webp', contentId: 'AIGC-junk' });
  assert.equal(Buffer.compare(out, junk), 0, '无法处理的输入应原样返回');
});
