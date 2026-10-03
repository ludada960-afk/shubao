/* 薯包出品/ 案例图的**隐式标识**覆盖 + 一条不可回退的红线。
 *
 * 红线：**默认不得有任何可见的 AIGC 标识**。
 * 2026-10-03 产品决定 —— 本站产物是电商商品图，用户要直接传平台/发社媒/做自媒体，
 * 画面角标会直接让产物不可用。显式标识改为 AIGC_VISIBLE_LABEL 环境变量控制、**默认关**。
 * 这条测试钉住「默认关」，防止以后有人"顺手补上"可见水印。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createGeneratedAssetStore } from '../server/generatedAssets.mjs';
import { AIGC_METADATA_KEYS } from '../server/aigcStamp.mjs';

const ROOT = path.resolve('薯包出品');
const exists = fs.existsSync(ROOT);
const dirs = exists ? fs.readdirSync(ROOT, { withFileTypes: true }).filter(e => e.isDirectory()) : [];

test('薯包出品/ 目录存在且非空（否则下面会假通过）', () => {
  assert.ok(exists, '找不到 ' + ROOT);
  assert.ok(dirs.length > 0, '没有子目录');
});

test('薯包出品/ 这批**不**打隐式标识（保持原样，见下）', () => {
  /* 2026-10-03 产品决定：这 118 张是演示素材，且每张都带 Trufly CA 签名的
     C2PA 凭证（内含 digitalSourceType=trainedAlgorithmicMedia，已声明「AI 生成」）。
     插入 iTXt 有可能让那个签名失效，而仓里没有 C2PA 验证器、无法验证 ——
     为一批演示素材去赌一个验不了的签名不划算。
     ⇒ 这批**保持原样**。用户实际生成的产物走 generatedAssetStore，
       全链路隐式标识照常生效（由下面那条红线测试守住）。
     这条测试的作用是**别再有人顺手给它们打标**：真打标了会在这里被发现，
     从而回头确认 C2PA 是否仍然有效，而不是默默引入一个验不了的变更。 */
  let checked = 0;
  const stamped = [];
  for (const d of dirs) {
    const dp = path.join(ROOT, d.name);
    for (const f of fs.readdirSync(dp)) {
      if (!f.toLowerCase().endsWith('.png')) continue;
      checked++;
      const buf = fs.readFileSync(path.join(dp, f));
      if (buf.includes(Buffer.from('AIGCContentId', 'latin1'))) stamped.push(f);
    }
  }
  assert.ok(checked > 0, '一张 PNG 都没找到');
  assert.equal(stamped.length, 0,
    `这批本应保持原样，但有 ${stamped.length} 张被打了标（如 ${stamped[0]}）—— C2PA 签名有效性未经验证`);
});

test('隐式标识不能破坏原有的 C2PA 凭证（caBX 仍在且 PNG 合法）', () => {
  let withC2pa = 0;
  const broken = [];
  for (const d of dirs) {
    const dp = path.join(ROOT, d.name);
    for (const f of fs.readdirSync(dp)) {
      if (!f.toLowerCase().endsWith('.png')) continue;
      const buf = fs.readFileSync(path.join(dp, f));
      const hasC2pa = buf.includes(Buffer.from('caBX', 'latin1'));
      if (!hasC2pa) continue;
      withC2pa++;
      // chunk 链必须完整走到 IEND
      let o = 8;
      let sawEnd = false;
      while (o + 8 <= buf.length) {
        const len = buf.readUInt32BE(o);
        const t = buf.toString('latin1', o + 4, o + 8);
        if (t === 'IEND') { sawEnd = true; break; }
        o += 12 + len;
      }
      if (!sawEnd) broken.push(f + '：PNG chunk 链不完整');
    }
  }
  assert.ok(withC2pa > 0, '没找到带 C2PA 的样本 —— 这批图的来源声明可能变了，需要重新评估');
  assert.equal(broken.length, 0, broken.slice(0, 5).join('\n'));
});

test('红线：默认（AIGC_VISIBLE_LABEL 未设）产物**像素必须不变**', async () => {
  const prev = process.env.AIGC_VISIBLE_LABEL;
  delete process.env.AIGC_VISIBLE_LABEL;
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'aigc-redline-'));
  try {
    const upstream = await sharp({
      create: { width: 120, height: 90, channels: 3, background: { r: 255, g: 255, b: 255 } },
    }).png().toBuffer();

    const store = createGeneratedAssetStore({
      directory: dir,
      fetchImpl: async () => ({
        ok: true,
        headers: { get: n => (n === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => new Uint8Array(upstream).buffer,
      }),
    });
    const asset = await store.persist({ sourceUrl: 'https://example.com/x.png', taskId: 'redline' });
    const written = await fsp.readFile(path.join(dir, asset.fileName));

    /* 隐式标识必须在（那是默认就该做的） */
    const text = written.toString('latin1');
    for (const key of Object.values(AIGC_METADATA_KEYS)) {
      assert.ok(text.includes(key), `缺隐式标识 ${key}`);
    }
    /* 但像素必须逐字节不变 —— 这就是红线 */
    const rawUp = await sharp(upstream).raw().toBuffer();
    const rawOut = await sharp(written).raw().toBuffer();
    assert.equal(Buffer.compare(rawUp, rawOut), 0,
      '默认态下像素变了 —— 说明有人把可见标识打开成默认了');
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
    if (prev === undefined) delete process.env.AIGC_VISIBLE_LABEL; else process.env.AIGC_VISIBLE_LABEL = prev;
  }
});
