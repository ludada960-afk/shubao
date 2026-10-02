/* 洞③ 回归：插件仿图链路必须落到 generatedAssetStore，不能把上游 URL 直接返给前端。

   修之前的现状（extensionRoutes.mjs runGeneration）：
       const imageUrl = await callImageGeneration(prompt, env);   // 上游 CDN 临时地址
       generated.push({ ..., url: imageUrl })                      // ← 直接进响应
   后果有两个，都是实质问题：
     · 产物从不经过我们的服务器 ⇒ 一个字节的 AIGC 隐式标识都没有，而这功能**收费**；
     · 上游地址原样暴露给前端，可被第三方拿去做二次分发。

   这个测试走真实链路：真起一个本地上游（生成接口 + CDN），
   让 runGeneration 真的下载、真的打标识、真的落盘。
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { mountOnApp } from '../server/extensionRoutes.mjs';
import { createGeneratedAssetStore } from '../server/generatedAssets.mjs';
import { createTask, updateTask } from '../server/extensionTaskManager.mjs';
import { AIGC_METADATA_KEYS } from '../server/aigcStamp.mjs';

const UPSTREAM_HOST_MARK = 'upstream-cdn.invalid';

/* 本地假上游：POST /v1/images/generations 返一个指向自己的 CDN URL，
   GET /cdn/x.png 返真 PNG 字节。
   ⚠️ 每次生成返回**不同**的字节 —— 资产库是内容寻址的（文件名 = sha256），
   若桩上游永远返回同一张图，3 次生成会去重成 1 个文件，测的就不是真实场景了。 */
async function startFakeUpstream() {
  let calls = 0;

  const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/v1/images/generations') {
      req.resume();
      await new Promise(r => req.on('end', r));
      calls += 1;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ data: [{ url: `http://127.0.0.1:${server.address().port}/cdn/x.png?n=${calls}` }] }));
      return;
    }
    if (req.url?.startsWith('/cdn/x.png')) {
      const n = Number(new URL(req.url, 'http://x').searchParams.get('n') || 1);
      const png = await sharp({
        create: { width: 32, height: 32, channels: 3, background: { r: n * 10, g: 20, b: 30 } },
      }).png().toBuffer();
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end(png);
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, port: server.address().port };
}

/* 极简 express 替身：只提供 mountOnApp 用到的 post/get。 */
function fakeApp() {
  const routes = {};
  return {
    routes,
    post(p, h) { routes['POST ' + p] = h; },
    get(p, h) { routes['GET ' + p] = h; },
  };
}

function fakeRes() {
  const res = { statusCode: 200, payload: null };
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.payload = body; return res; };
  res.end = () => res;
  return res;
}

/* 造一个已分析完的任务。 */
function seedAnalyzedTask() {
  const taskId = createTask({ images: ['https://example.com/a.png'], title: '测试商品', platform: '淘宝' });
  updateTask(taskId, {
    status: 'analyzed',
    analysis: {
      images: [
        { url: 'https://example.com/a.png', index: 0, layout: '居中', lighting: '柔光', background: '白底', colors: ['white'], mood: '干净' },
      ],
    },
  });
  return taskId;
}

test('洞③：插件生成产物落到我们的资产库，响应里不再出现上游地址', async t => {
  const { server, port } = await startFakeUpstream();
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ext-asset-'));
  const prevBase = process.env.IMAGE_BASE_URL;
  const prevKey = process.env.IMAGE_API_KEY;
  const prevModel = process.env.IMAGE_MODEL;
  process.env.IMAGE_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.IMAGE_API_KEY = 'test-key';
  process.env.IMAGE_MODEL = 'gpt-image-2';
  t.after(async () => {
    server.close();
    await fs.rm(dir, { recursive: true, force: true });
    if (prevBase === undefined) delete process.env.IMAGE_BASE_URL; else process.env.IMAGE_BASE_URL = prevBase;
    if (prevKey === undefined) delete process.env.IMAGE_API_KEY; else process.env.IMAGE_API_KEY = prevKey;
    if (prevModel === undefined) delete process.env.IMAGE_MODEL; else process.env.IMAGE_MODEL = prevModel;
  });

  const store = createGeneratedAssetStore({ directory: dir });
  const app = fakeApp();
  mountOnApp(app, {
    billing: { async execute({ work }) { return { result: await work(), billing: { ok: true } }; } },
    generatedAssetStore: store,
  });

  const taskId = seedAnalyzedTask();
  const req = {
    body: { taskId, productName: '测试商品', category: '家居', sellingPoints: ['卖点一'], tier: 'basic', platform: '淘宝' },
    _userEmail: 'tester@example.com',
  };
  const res = fakeRes();
  await app.routes['POST /api/extension/regenerate'](req, res);

  assert.equal(res.statusCode, 200, '生成应成功：' + JSON.stringify(res.payload));
  const images = res.payload.generatedImages;
  assert.ok(images?.length, '应返回生成结果');

  for (const img of images) {
    assert.ok(
      img.url.startsWith('/api/generated-assets/'),
      `产物 URL 必须是我们的资产库地址，实际是 ${img.url}`,
    );
    assert.ok(
      !img.url.includes('127.0.0.1') && !img.url.includes(UPSTREAM_HOST_MARK),
      `上游地址泄漏给了前端：${img.url}`,
    );
  }

  /* 真正落盘了，而且文件里**确实有** AIGC 隐式标识 —— 这才是这个洞的意义。
     只断言 URL 前缀是不够的：改完可能只是把地址换了个样子，字节还是没标识。 */
  const files = await fs.readdir(dir);
  assert.equal(files.length, images.length, '每个产物都应有落盘文件');
  for (const f of files) {
    const bytes = await fs.readFile(path.join(dir, f));
    const text = bytes.toString('latin1');
    assert.ok(text.includes(AIGC_METADATA_KEYS.attribute), `落盘文件 ${f} 缺「生成合成内容属性信息」`);
    assert.ok(text.includes(AIGC_METADATA_KEYS.producer), `落盘文件 ${f} 缺「服务提供者名称或编码」`);
    assert.ok(text.includes(AIGC_METADATA_KEYS.contentId), `落盘文件 ${f} 缺「内容编号」`);
    /* 仍是合法 PNG —— 标识不能把图画坏 */
    const meta = await sharp(bytes).metadata();
    assert.equal(meta.format, 'png');
    assert.equal(meta.width, 32);
  }
});

test('洞③：落盘失败不得回退成上游地址（宁可少交付，不做无标识交付）', async t => {
  const { server, port } = await startFakeUpstream();
  const prevBase = process.env.IMAGE_BASE_URL;
  const prevKey = process.env.IMAGE_API_KEY;
  process.env.IMAGE_BASE_URL = `http://127.0.0.1:${port}`;
  process.env.IMAGE_API_KEY = 'test-key';
  t.after(async () => {
    server.close();
    if (prevBase === undefined) delete process.env.IMAGE_BASE_URL; else process.env.IMAGE_BASE_URL = prevBase;
    if (prevKey === undefined) delete process.env.IMAGE_API_KEY; else process.env.IMAGE_API_KEY = prevKey;
  });

  const app = fakeApp();
  /* store 的 persist 一律失败，模拟「生成了但存不下来」 */
  mountOnApp(app, {
    billing: { async execute({ work }) { return { result: await work(), billing: { ok: true } }; } },
    generatedAssetStore: { async persist() { throw new Error('磁盘满了'); } },
  });

  const taskId = seedAnalyzedTask();
  const res = fakeRes();
  await app.routes['POST /api/extension/regenerate']({
    body: { taskId, productName: '测试商品', tier: 'basic' },
    _userEmail: 'tester@example.com',
  }, res);

  const serialized = JSON.stringify(res.payload);
  assert.ok(!serialized.includes('127.0.0.1'), '落盘失败时绝不能把上游地址返出去：' + serialized);
  /* 生成数不足 → 整单失败，不交付半成品 */
  assert.equal(res.statusCode, 502);
});

test('洞③：没有 generatedAssetStore 时挂载即失败（而不是等到用户付费后才发现）', () => {
  const app = fakeApp();
  assert.throws(
    () => mountOnApp(app, { billing: { async execute() { return {}; } } }),
    /generatedAssetStore is required/,
  );
});

test('洞③：不再导出那个不收费的 router 副本（计费旁路）', async () => {
  const mod = await import('../server/extensionRoutes.mjs');
  assert.equal(mod.default, undefined, 'extensionRoutes 不应再有 default 导出的 router');
});
