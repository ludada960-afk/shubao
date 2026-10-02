/* 验证显式标识（画面角标）：
   ① 确实**改了像素** —— 这是它与隐式标识的本质区别；
   ② 落在左下角、且**不遮挡画面主体**（电商主图要能直接用）；
   ③ 失败时降级为原字节，不阻断生成；
   ④ **用户上传绝不能被打标** —— 那是虚假标识，本身也违规。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

import { applyVisibleLabel, badgeGeometry } from '../server/aigcVisibleLabel.mjs';
import { createGeneratedAssetStore } from '../server/generatedAssets.mjs';
import { AIGC_METADATA_KEYS } from '../server/aigcStamp.mjs';

const W = 400;
const H = 300;

async function whitePng(width = W, height = H) {
  return sharp({ create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .png().toBuffer();
}

/** 取区域平均亮度。 */
async function meanBrightness(buffer, left, top, width, height) {
  const { data, info } = await sharp(buffer)
    .extract({ left, top, width, height })
    .raw().toBuffer({ resolveWithObject: true });
  let sum = 0;
  for (let i = 0; i < data.length; i += info.channels) sum += data[i] + data[i + 1] + data[i + 2];
  return sum / (data.length / info.channels) / 3;
}

test('显式标识：像素**确实被改动**（与隐式标识的根本区别）', async () => {
  const before = await whitePng();
  const after = await applyVisibleLabel(before, { contentType: 'image/png', sharp });
  assert.notDeepEqual(after, before, '显式标识必须画进像素 —— 什么都没变就是没做');
  const meta = await sharp(after).metadata();
  assert.equal(meta.format, 'png', '画完仍须是合法 PNG');
  assert.equal(meta.width, W);
  assert.equal(meta.height, H);
});

test('显式标识：角标落在左下角，且不遮挡画面主体', async () => {
  const before = await whitePng();
  const after = await applyVisibleLabel(before, { contentType: 'image/png', sharp });

  const bottomLeft = await meanBrightness(after, 0, H - 40, 90, 30);
  const topRight = await meanBrightness(after, W - 90, 10, 80, 30);
  const centre = await meanBrightness(after, W / 2 - 40, H / 2 - 20, 80, 40);

  assert.ok(bottomLeft < 200, `左下角应被角标压暗，实际亮度 ${bottomLeft.toFixed(1)}`);
  assert.ok(topRight > 245, `右上角不该有角标，实际亮度 ${topRight.toFixed(1)}`);
  /* 电商产物要能直接上架：画面中心必须保持干净 */
  assert.ok(centre > 245, `画面中心被角标遮挡了（亮度 ${centre.toFixed(1)}）—— 商品主体会被压住`);
});

test('显式标识：四个角位都能放，且都只影响自己那一角', async () => {
  const before = await whitePng();
  const probes = {
    'bottom-left': [0, H - 40, 90, 30, W - 90, 10, 80, 30],
    'bottom-right': [W - 90, H - 40, 90, 30, 10, 10, 80, 30],
    'top-left': [0, 10, 90, 30, W - 90, H - 40, 80, 30],
    'top-right': [W - 90, 10, 90, 30, 0, H - 40, 80, 30],
  };
  for (const [position, [al, at, aw, ah, cl, ct, cw, ch]] of Object.entries(probes)) {
    const after = await applyVisibleLabel(before, { contentType: 'image/png', sharp, position });
    const here = await meanBrightness(after, al, at, aw, ah);
    const elsewhere = await meanBrightness(after, cl, ct, cw, ch);
    assert.ok(here < 200, `${position}：该有角标的位置没变暗（${here.toFixed(1)}）`);
    assert.ok(elsewhere > 245, `${position}：角标跑到对角去了（${elsewhere.toFixed(1)}）`);
  }
});

test('显式标识：小图也不会被角标糊满（角标尺寸按比例且有上限）', async () => {
  const before = await whitePng(48, 32);
  const after = await applyVisibleLabel(before, { contentType: 'image/png', sharp });
  const meta = await sharp(after).metadata();
  assert.equal(meta.width, 48);
  assert.equal(meta.height, 32);
  /* 角标不能盖住整张图 —— 中心必须还看得见 */
  const centre = await meanBrightness(after, 18, 12, 12, 8);
  assert.ok(centre > 245, `小图被角标盖死了（中心亮度 ${centre.toFixed(1)}）`);
});

test('显式标识：失败时降级为原字节，不阻断生成', async () => {
  const before = await whitePng();
  const out = await applyVisibleLabel(before, { contentType: 'image/png', sharp: null });
  assert.equal(Buffer.compare(out, before), 0, '没有 sharp 时应原样返回');
});

/* ── 下面两条是**实测出来的**，不是拍脑袋 ──────────────────────────────────────
   拿样例图请视觉模型看过之后发现两个问题，用例原来正好都没覆盖到：
     ① 「深色图」那张样例的左下角其实是**浅色页边**，角标压根没碰到深色区域
        —— 那个用例什么都没测到；
     ② 角标按 4.5% 算出来的尺寸，缩到信息流缩略图（约 300px 宽）后字高只剩 5px，
        等于没有。而《标识办法》第四条要的是「**显著**」—— 原图 1:1 看得清不算数。 */

async function darkPng(width = W, height = H) {
  return sharp({ create: { width, height, channels: 3, background: { r: 20, g: 20, b: 24 } } })
    .png().toBuffer();
}

/** 区域内最亮与最暗像素的亮度差 —— 角标（深底白字）必须拉出这个跨度。 */
async function contrastSpan(buffer, left, top, width, height) {
  const { data } = await sharp(buffer).extract({ left, top, width, height }).raw().toBuffer({ resolveWithObject: true });
  let min = 255;
  let max = 0;
  for (let i = 0; i < data.length; i += 3) {
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (lum < min) min = lum;
    if (lum > max) max = lum;
  }
  return max - min;
}

test('显式标识：角标落在**深色**画面上仍然可辨（白字要能跳出来）', async () => {
  const before = await darkPng();
  const after = await applyVisibleLabel(before, { contentType: 'image/png', sharp });

  const g = badgeGeometry({ imageWidth: W, imageHeight: H });
  const span = await contrastSpan(after, g.left, g.top, g.boxWidth, g.boxHeight);
  assert.ok(span > 60, `深色底上角标没有拉出明暗跨度（${span.toFixed(0)}）—— 白字看不出来`);
});

/* 下面这条才是真正拦住「胶囊在深色底上隐形」的那条。
   上一版只量了区域内的明暗跨度 —— 白字很亮，跨度自然大，**断言通过了**，
   可胶囊本身跟深色背景的对比度只有 1.008:1，角标等于隐形。
   ⇒ 必须分别量「胶囊边缘」和「紧邻胶囊的背景」，两者必须拉得开。 */
async function pixelAt(buffer, x, y) {
  const { data } = await sharp(buffer)
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw().toBuffer({ resolveWithObject: true });
  return (data[0] + data[1] + data[2]) / 3;
}

test('显式标识：胶囊**本身**与背景分离（描边兜底，不靠半透明赌底色）', async () => {
  for (const [name, make] of [
    ['白底', () => whitePng()],
    ['深底', () => darkPng()],
  ]) {
    const after = await applyVisibleLabel(await make(), { contentType: 'image/png', sharp });
    const g = badgeGeometry({ imageWidth: W, imageHeight: H });
    const midY = g.top + Math.round(g.boxHeight / 2);

    /* 胶囊最左边缘 = 亮描边；胶囊中部 = 深色填充；紧邻外侧 = 原背景 */
    const edgeLum = await pixelAt(after, g.left + 1, midY);
    const fillLum = await pixelAt(after, g.left + Math.round(g.boxWidth / 2), midY);
    const bgLeftLum = await pixelAt(after, Math.max(0, g.left - 3), midY);
    const bgRightLum = await pixelAt(after, Math.min(W - 1, g.left + g.boxWidth + 3), midY);

    /* 白底靠深色填充分离，深底靠亮描边分离 —— 任一成立即可 */
    const byFill = Math.max(Math.abs(fillLum - bgLeftLum), Math.abs(fillLum - bgRightLum));
    const byStroke = Math.max(Math.abs(edgeLum - bgLeftLum), Math.abs(edgeLum - bgRightLum));
    assert.ok(
      Math.max(byFill, byStroke) > 40,
      `${name}：胶囊与背景没拉开（填充差 ${byFill.toFixed(0)}，描边差 ${byStroke.toFixed(0)}）—— 角标会隐形`,
    );
  }
});

test('显式标识：深色底上胶囊轮廓可见（描边比背景亮）', async () => {
  const after = await applyVisibleLabel(await darkPng(), { contentType: 'image/png', sharp });
  const g = badgeGeometry({ imageWidth: W, imageHeight: H });
  const midY = g.top + Math.round(g.boxHeight / 2);
  const edgeLum = await pixelAt(after, g.left + 1, midY);
  const bgLum = await pixelAt(after, Math.max(0, g.left - 4), midY);
  assert.ok(edgeLum - bgLum > 40,
    `深色底上胶囊边缘没有亮起来（边缘 ${edgeLum.toFixed(0)} vs 背景 ${bgLum.toFixed(0)}）`);
});

test('显式标识：缩到信息流缩略图（约 300px 宽）后角标**仍可辨**', async () => {
  const before = await sharp({ create: { width: 1200, height: 900, channels: 3, background: { r: 255, g: 255, b: 255 } } })
    .png().toBuffer();
  const labeled = await applyVisibleLabel(before, { contentType: 'image/png', sharp });
  const thumb = await sharp(labeled).resize({ width: 300 }).png().toBuffer();
  const meta = await sharp(thumb).metadata();
  assert.equal(meta.width, 300);
  assert.equal(meta.height, 225);

  /* 缩略图左下角仍要拉得出明暗跨度，否则等于没标识 */
  const span = await contrastSpan(thumb, 0, meta.height - 40, 70, 36);
  assert.ok(span > 40, `缩略图上角标已不可辨（跨度仅 ${span.toFixed(0)}）—— 不满足第四条「显著」`);
});

/* ── 与资产库的衔接：显式 + 隐式都要在，且顺序是「先显式后隐式」─────────────── */

async function tmpStore(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'aigc-visible-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  return { dir, store: createGeneratedAssetStore({ directory: dir }) };
}

function hasImplicitLabel(buffer) {
  const text = buffer.toString('latin1');
  return Object.values(AIGC_METADATA_KEYS).every(k => text.includes(k));
}

test('downloadAndPersist：显式 + 隐式**两个**标识都在（并行义务，缺一不可）', async t => {
  const { dir } = await tmpStore(t);
  const upstream = await whitePng(200, 150);
  const store = createGeneratedAssetStore({
    directory: dir,
    fetchImpl: async () => ({
      ok: true,
      headers: { get: name => (name === 'content-type' ? 'image/png' : null) },
      arrayBuffer: async () => new Uint8Array(upstream).buffer,
    }),
  });

  const asset = await store.persist({ sourceUrl: 'https://example.com/a.png', taskId: 't-vis', label: 'x' });
  const written = await fs.readFile(path.join(dir, asset.fileName));

  /* 隐式：文件元数据里的三要素 */
  assert.ok(hasImplicitLabel(written), '缺隐式标识（元数据三要素）');
  /* 显式：像素被改过 —— 与上游字节不同 */
  assert.notDeepEqual(written, upstream, '缺显式标识（像素没变）');
  const meta = await sharp(written).metadata();
  assert.equal(meta.width, 200);
  assert.equal(meta.height, 150);
});

test('persistBuffer 不声明 generated：**用户上传**绝不能被打标', async t => {
  const { dir } = await tmpStore(t);
  const store = createGeneratedAssetStore({ directory: dir });
  const userUpload = await whitePng(120, 90);
  const asset = await store.persistBuffer({ buffer: userUpload, contentType: 'image/png', taskId: 'upload-1', label: 'ecommerce-original' });
  const written = await fs.readFile(path.join(dir, asset.fileName));

  assert.equal(Buffer.compare(written, userUpload), 0,
    '用户上传的字节必须逐字节不变 —— 打上 AIGC 是**虚假标识**，那本身也违规');
  assert.ok(!hasImplicitLabel(written), '用户上传不能有隐式标识');
});

test('persistBuffer 声明 generated: true：provider 直回的 base64 产物**要**打标', async t => {
  const { dir } = await tmpStore(t);
  const store = createGeneratedAssetStore({ directory: dir });
  const generated = await whitePng(120, 90);
  const asset = await store.persistBuffer({
    buffer: generated, contentType: 'image/png', taskId: 'gen-1', label: 'xhs-preview-cover', generated: true,
  });
  const written = await fs.readFile(path.join(dir, asset.fileName));

  assert.ok(hasImplicitLabel(written), '这批是真正的生成结果，必须有隐式标识');
  assert.notDeepEqual(written, generated, '必须有显式标识（像素要变）');
});
