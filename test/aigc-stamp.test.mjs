/* 验证 aigcStamp：PNG 插 chunk 后仍是**合法 PNG**、像素未被改动、三个要素都在。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { stampImage, contentIdFor, AIGC_METADATA_KEYS } from '../server/aigcStamp.mjs';

/* 造一张真实 PNG 当样本 */
async function samplePng() {
  const r = await sharp({
    create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 120, b: 60 } }
  }).png().toBuffer();
  return r;
}

test('aigcStamp：PNG 写入后仍是合法 PNG，像素逐字节不变（零重编码）', async () => {
  const before = await samplePng();
  const after = await stampImage(before, { contentType: 'image/png', contentId: 'AIGC-test-1' });

  assert.notDeepEqual(after, before, '应该写入了东西');
  /* 关键：像素数据必须完全一致 —— 这是「零重编码」的证明 */
  const rawBefore = await sharp(before).raw().toBuffer();
  const rawAfter = await sharp(after).raw().toBuffer();
  assert.deepEqual(Buffer.compare(rawBefore, rawAfter), 0, '像素数据被改动了 —— 那就不是零重编码');
  /* 两个文件都能被解码，说明结构合法 */
  const meta = await sharp(after).metadata();
  assert.equal(meta.format, 'png');
  assert.equal(meta.width, 64);
  assert.equal(meta.height, 48);
});

test('aigcStamp：三要素（属性/提供者/内容编号）都写进去了', async () => {
  const png = await samplePng();
  const contentId = contentIdFor('task-abc', 'seed-1');
  const after = await stampImage(png, { contentType: 'image/png', contentId });
  const text = after.toString('latin1');

  assert.ok(text.includes(AIGC_METADATA_KEYS.attribute), '缺「生成合成内容属性信息」');
  assert.ok(text.includes(AIGC_METADATA_KEYS.producer), '缺「服务提供者名称或编码」');
  assert.ok(text.includes(AIGC_METADATA_KEYS.contentId), '缺「内容编号」');
  assert.ok(text.includes(contentId), '内容编号的值没写进去');
  assert.ok(text.includes('SHUBAO-CN'), '提供者编码没写进去');
});

test('aigcStamp：多个 chunk 都要写进去（不是只写第一个）', async () => {
  const png = await samplePng();
  const after = await stampImage(png, { contentType: 'image/png', contentId: 'AIGC-multi' });
  let count = 0;
  const text = after.toString('latin1');
  for (const k of Object.values(AIGC_METADATA_KEYS)) if (text.includes(k)) count++;
  assert.equal(count, 3, '三个 key 都要在，实际写入 ' + count + ' 个');
});

test('aigcStamp：内容编号可复现（同 taskId+seed 必得同一个编号）', () => {
  const a = contentIdFor('task-1', 'seed-x');
  const b = contentIdFor('task-1', 'seed-x');
  const c = contentIdFor('task-1', 'seed-y');
  assert.equal(a, b, '同输入应得同编号 —— 这是可取证的基础');
  assert.notEqual(a, c, '不同 seed 应得不同编号');
  assert.match(a, /^AIGC-[0-9a-f]{32}$/);
});

test('aigcStamp：非 PNG 且没有 sharp 时原样返回，不阻断生成', async () => {
  const fake = Buffer.from('not-an-image');
  const out = await stampImage(fake, { contentType: 'application/octet-stream', contentId: 'x' });
  assert.equal(Buffer.compare(out, fake), 0, '不支持的格式应原样返回');
});

test('aigcStamp：标识失败不得阻断（抛错时降级为原字节）', async () => {
  const png = await samplePng();
  /* 故意传一个会炸的 sharp 桩，验证降级路径 */
  const badSharp = () => { throw new Error('boom'); };
  const jpeg = await sharp(png).jpeg().toBuffer();
  const out = await stampImage(jpeg, { contentType: 'image/jpeg', contentId: 'x', sharp: badSharp });
  assert.ok(Buffer.isBuffer(out), '必须返回 buffer 而不是抛错');
});