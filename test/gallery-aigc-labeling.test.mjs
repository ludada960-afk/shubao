/* 守住两条**发布态**的不变量 —— 这两条都真实翻过车：

   1. 案例图是我们生成的，公开发布在「灵感发现 / 做同款」页，必须带 AIGC 隐式标识。
      翻车原因：import 脚本把每张图 `.webp()` 重编码，sharp 默认丢弃全部元数据。

   2. cover.webp 的 URL 带 `?v=<sha1前12位>` 做缓存版本号，**必须与磁盘文件一致**。
      翻车原因：补标识的脚本中途死在一个断掉的 stdout 管道上（EPIPE），
      24 个 webp 打好标了，但只更新了第一个案例的 JSON —— 第二个案例的 cover
      磁盘上已是带标识的新文件，JSON 还指着旧版本号，浏览器/CDN 继续吐**旧文件**。
      标识看着补了，其实没生效。这个不变量就是为拦住它。

   新增案例时本测试会自动跟着覆盖 cases.json，不用改。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const GALLERY = path.resolve('public/gallery/ecommerce');
const INDEX = path.join(GALLERY, 'cases.json');
const exists = fs.existsSync(INDEX);
const cases = exists ? JSON.parse(fs.readFileSync(INDEX, 'utf8')) : [];

function readWebpChunks(buffer) {
  const chunks = {};
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const fourCC = buffer.toString('latin1', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    chunks[fourCC] = buffer.subarray(offset + 8, offset + 8 + size);
    offset = offset + 8 + size + (size % 2);
  }
  return chunks;
}

test('案例图目录存在且有内容（否则下面几条会假通过）', () => {
  assert.ok(exists, '找不到 ' + INDEX);
  assert.ok(cases.length > 0, 'cases.json 是空的');
});

for (const entry of cases) {
  test(`案例「${entry.id}」的每张图都带 AIGC 隐式标识`, () => {
    const dir = path.join(GALLERY, entry.id);
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.webp'));
    assert.ok(files.length > 0, '一个 webp 都没有');
    for (const file of files) {
      const buffer = fs.readFileSync(path.join(dir, file));
      const chunks = readWebpChunks(buffer);
      assert.ok(chunks.VP8X, `${file} 缺 VP8X —— 没有它解码器会忽略 XMP，标识形同虚设`);
      assert.ok(chunks['XMP '], `${file} 缺 XMP chunk`);
      const xmp = chunks['XMP '].toString('utf8');
      assert.ok(xmp.includes('AIGCContentId'), `${file} 的 XMP 里没有内容编号`);
      assert.ok(xmp.includes('AIGCProducer'), `${file} 的 XMP 里没有提供者`);
      assert.ok(xmp.includes('SHUBAO-CN'), `${file} 的 XMP 里没有提供者编码`);
    }
  });

  test(`案例「${entry.id}」的 cover 缓存版本号与磁盘文件一致`, () => {
    const coverPath = path.join(GALLERY, entry.id, 'cover.webp');
    const bytes = fs.readFileSync(coverPath);
    const realRev = createHash('sha1').update(bytes).digest('hex').slice(0, 12);

    const caseJson = JSON.parse(fs.readFileSync(path.join(GALLERY, entry.id, 'case.json'), 'utf8'));
    const references = [
      ['cases.json cover_url', entry.cover_url],
      ['cases.json cover_mosaic_url', entry.cover_mosaic_url],
      ['case.json cover_url', caseJson.cover_url],
      ['case.json cover_mosaic_url', caseJson.cover_mosaic_url],
    ].filter(([, url]) => url);

    for (const [label, url] of references) {
      const v = String(url).match(/\?v=([0-9a-f]{12})/)?.[1];
      assert.ok(v, `${label} 没有缓存版本号（${url}）—— 改了 cover 也不会生效`);
      assert.equal(v, realRev, `${label} 的 ?v=${v} 与实际文件 ${realRev} 不符，浏览器会拿到旧文件`);
    }
  });
}
