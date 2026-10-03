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

test('薯包出品/ 每张 PNG 都带隐式标识三要素（第五条）', () => {
  /* 这 118 张每张都带 Trufly CA 签名的 C2PA 凭证，内含
     digitalSourceType=.../trainedAlgorithmicMedia —— 「是 AI 生成的」已有行业标准声明。
     但第五条三要素里有一项 C2PA 没有：**服务提供者名称或编码**。
     C2PA 里写的是 "gpt-image"，没有「薯包AI」；我们是对用户交付生成服务的一方，
     这一条只有我们自己写得出。所以仍然要打。

     ⚠️ 已知且**未消除**的风险：插 iTXt 改变了文件字节布局，有可能让那份
     已签名的 C2PA 校验不再通过，而仓里没有 C2PA 验证器、本地无法证伪。
     下一条测试只保证 PNG 结构合法且 caBX 原样保留 —— **完整的签名校验
     需要官方 c2patool，属上线后应补做的一次性核验**。 */
  let checked = 0;
  const missing = [];
  for (const d of dirs) {
    const dp = path.join(ROOT, d.name);
    for (const f of fs.readdirSync(dp)) {
      if (!f.toLowerCase().endsWith('.png')) continue;
      checked++;
      const buf = fs.readFileSync(path.join(dp, f));
      const text = buf.toString('latin1');
      for (const key of Object.values(AIGC_METADATA_KEYS)) {
        if (!text.includes(key)) { missing.push(d.name + '/' + f + ' 缺 ' + key); break; }
      }
    }
  }
  assert.ok(checked > 0, '一张 PNG 都没找到');
  assert.equal(missing.length, 0, `${missing.length} 张缺隐式标识：\n  ` + missing.slice(0, 5).join('\n  '));
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

test('红线：产物**像素必须逐字节不变** —— 合规只走隐式，绝不画可见标识', async () => {
  /* 2026-10-03 产品决定：不做画面角标。实现曾存在
     （server/aigcVisibleLabel.mjs + AIGC_VISIBLE_LABEL 开关），已**整体删除**。
     这条测试是那句决定的守卫：隐式标识随便加，但**任何一个像素都不许因为
     合规而改变**。将来谁又想加可见标识，这里立刻红。 */
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
      '像素变了 —— 说明有人往产物上画了可见标识');
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test('红线：显式标识的实现已从仓库里彻底移除（不是"默认关"，是"没有"）', async () => {
  /* 留着开关等于留一颗随时能踩的雷：改个环境变量就能让全站产物带上角标。 */
  for (const gone of [
    '../server/aigcVisibleLabel.mjs',
    '../server/aigcLabelConfig.mjs',
  ]) {
    assert.equal(fs.existsSync(new URL(gone, import.meta.url)), false,
      gone + ' 还在 —— 显式标识的实现应当整体删除');
  }
  const storeSrc = fs.readFileSync(new URL('../server/generatedAssets.mjs', import.meta.url), 'utf8');
  /* ⚠️ 必须先剥注释再查：文件顶部那段注释**故意**写着这两个名字，
     用来记录「实现曾经存在、已整体删除」这件事。用原文查会自己把自己判红。 */
  const code = storeSrc
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
  for (const banned of ['applyVisibleLabel', 'AIGC_VISIBLE_LABEL', 'visibleLabelEnabled', 'aigcVisibleLabel']) {
    assert.ok(!code.includes(banned), 'generatedAssets.mjs 的**代码**里不该再出现 ' + banned);
  }
});
