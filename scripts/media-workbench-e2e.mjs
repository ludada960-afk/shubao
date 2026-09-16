#!/usr/bin/env node
// scripts/media-workbench-e2e.mjs —— 技能工作台的**端到端**验证（不打桩在做假，打桩在上游）
// ═══════════════════════════════════════════════════════════════════════════
// 为什么要有它：工作台的产物是「一次真实出图」，而真实出图要花积分。
//   于是把**上游**打桩（/api/* 按服务端真实契约应答），用真浏览器把工作台跑一遍：
//   上传 → 生成 → 断言请求体与契约逐字一致 → 结果落屏 → 存作品 → 失败态与只重试失败项。
//   这样验证的是**我们这一半**（字段翻译、上传、状态机、错误与重试），零额度消耗。
// 不能替代的：真实上游的出图质量与端到端时延 —— 那需要一次付费验收。
// 用法：node scripts/media-workbench-e2e.mjs [--keep]
// 退出码：0 = 全绿；1 = 有断言失败（失败项会逐条打印）。
// ═══════════════════════════════════════════════════════════════════════════
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const PORT = 4197;
const ROOT = resolve('dist');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
};

const failures = [];
const notes = [];
const check = (ok, label, detail = '') => {
  if (ok) notes.push('✔ ' + label);
  else failures.push('✖ ' + label + (detail ? ' —— ' + detail : ''));
};

/* ── 打桩：只实现工作台真正会打到的接口，其余 /api/* 一律 200 {}（让页面能起来）── */
const calls = { assets: [], regenerate: [], quote: [], saveWork: [], session: 0 };
/* 生成结果按服务端真实形状返回：/api/generated-assets/<64hex>.png
   （前端 isPersistentEcommerceImageUrl 只认这个形状或绝对 http(s) 地址；
     返回普通相对路径的话，存作品那一步会被正确拒收 —— 打桩必须贴近真实契约。） */
const RESULT_ASSET = 'b'.repeat(64) + '.png';
const RESULT_IMAGE = '/api/generated-assets/' + RESULT_ASSET;
const RESULT_FILE = 'public/images/visual-recipes/cases/free-glass-whale.png';
let regeneratePlan = 'ok';   /* ok | fail */

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function fileOrNull(path) {
  try { const info = await stat(path); return info.isFile() ? path : null; } catch { return null; }
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const path = url.pathname;

  if (path.startsWith('/api/')) {
    const raw = await readBody(req).catch(() => Buffer.alloc(0));
    const parse = () => { try { return JSON.parse(raw.toString('utf8') || '{}'); } catch { return {}; } };

    if (path === '/api/session') { calls.session += 1; return json(res, 200, { ok: true, email: 'e2e@example.com', nickname: 'E2E' }); }
    if (path === '/api/billing/quote') { const body = parse(); calls.quote.push(body); return json(res, 200, { quote: { quoteId: 'quote-e2e-1', totalUnits: 1000, currency: 'credits' } }); }
    if (path === '/api/billing/balance') return json(res, 200, { ok: true, currency: 'credits', balance: 999, unlimited: false, credits: 999 });
    if (path === '/api/billing/catalog') return json(res, 200, { ok: true, products: [] });
    if (path === '/api/ecommerce/assets') {
      calls.assets.push({ role: req.headers['x-ecommerce-asset-role'] || '', bytes: raw.length });
      const assetId = 'a'.repeat(64) + '.png';
      return json(res, 200, {
        original: { assetId, url: '/api/generated-assets/' + assetId, role: req.headers['x-ecommerce-asset-role'] || 'product' },
        preview: { url: '/api/generated-assets/' + assetId + '?variant=thumb' },
      });
    }
    if (path === '/api/canvas/regenerate') {
      const body = parse();
      calls.regenerate.push(body);
      if (regeneratePlan === 'fail') return json(res, 400, { error: '模拟上游失败：产品图不清晰' });
      return json(res, 200, { url: RESULT_IMAGE, taskId: 'task-e2e-1', ratio: body.ratio, resolution: body.resolution });
    }
    if (path === '/api/canvas/regenerate/status') return json(res, 404, { status: 'missing' });
    if (path === '/api/save-work') { calls.saveWork.push(parse()); return json(res, 200, { ok: true, _saveKey: 'e2e-work-1' }); }
    if (path === '/api/auth/logout') return json(res, 200, { ok: true });
    return json(res, 200, { ok: true });
  }

  /* /api/generated-assets/*：这是"已生成资产"的读取口，直接把本地真图发出去 */
  if (path.startsWith('/api/generated-assets/')) {
    const file = await fileOrNull(resolve(RESULT_FILE));
    if (!file) { res.writeHead(404).end('missing'); return; }
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
    res.end(await readFile(file));
    return;
  }

  const safe = normalize(decodeURIComponent(path)).replace(/^([/\\])+/, '');
  let file = await fileOrNull(join(ROOT, safe));
  if (!file && !extname(safe)) file = await fileOrNull(join(ROOT, 'index.html'));
  if (!file) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(await readFile(file));
});

await new Promise(r => server.listen(PORT, '127.0.0.1', r));
await mkdir('.tmp/e2e', { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
/* 种一个有效会话：工作台的生成入口要求已登录 */
await context.addInitScript(() => {
  const future = new Date(Date.now() + 3600 * 1000).toISOString();
  localStorage.setItem('sb-auth', JSON.stringify({ id: 'e2e@example.com', email: 'e2e@example.com', nickname: 'E2E', token: 'e2e-token', expiresAt: future }));
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error?.message || error)));

try {
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation?id=image.white_bg', { waitUntil: 'load', timeout: 40000 });
  await page.waitForTimeout(1500);

  /* ① 未填必填项时，CTA 必须禁用并说明缺什么 */
  const gate = await page.evaluate(() => ({
    disabled: document.querySelector('.media-workbench-submit')?.disabled ?? null,
    hint: document.querySelector('.media-workbench-cta-hint')?.textContent || '',
    points: document.querySelector('.media-workbench-points')?.textContent || '',
  }));
  check(gate.disabled === true, '缺素材时「立即生成」禁用', JSON.stringify(gate));
  check(gate.hint.includes('素材'), '禁用原因就写在按钮旁（还差：素材）', gate.hint);
  check(gate.points.includes('1'), '积分按后端单价预估（image2 2K = 1 积分）', gate.points);

  /* ② 上传素材：真文件 → 打桩的 /api/ecommerce/assets → 缩略图就绪 */
  await page.setInputFiles('.media-field-upload input[type=file]', 'public/gallery/ecommerce/baby-bottle-product-suite/01.webp');
  await page.waitForSelector('.media-asset-card', { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('.media-asset-card-progress'), null, { timeout: 15000 });
  check(calls.assets.length === 1, '素材确实走了既有上传接口', JSON.stringify(calls.assets));
  check(calls.assets[0]?.role === 'product', '上传角色按声明下发（product）', JSON.stringify(calls.assets[0]));
  const enabled = await page.evaluate(() => document.querySelector('.media-workbench-submit')?.disabled === false);
  check(enabled, '素材就绪后 CTA 解禁');

  /* ③ 生成：断言请求体与服务端契约逐字一致 */
  await page.click('.media-workbench-submit');
  await page.waitForFunction(() => document.querySelectorAll('.media-run-slot img').length > 0, null, { timeout: 20000 });
  const body = calls.regenerate[0] || {};
  check(calls.regenerate.length === 1, '只发起 1 次生成（数量=1）', String(calls.regenerate.length));
  check(body.prompt && body.prompt.includes('白底') && !body.prompt.includes('{{'), '提示词由 brief 真实拼出且无残留占位符', String(body.prompt).slice(0, 80));
  /* image_url 经 normalizeCanvasImageUrl 会转成绝对地址（服务端要的就是绝对地址） */
  check(/\/api\/generated-assets\/[a-f0-9]{64}\.png$/.test(String(body.image_url)), '主素材进入 image_url（图生图）', String(body.image_url));
  check(body.ratio === '1:1' && body.resolution === '2K', '比例/清晰度取声明默认值', body.ratio + '/' + body.resolution);
  check(body.image_model === 'image2', '模型是唯一有出图记录的 image2', String(body.image_model));
  check(body.creation_intent === 'visual' && body.skill_id === 'free', 'creation_intent/skill_id 在服务端白名单内', body.creation_intent + '/' + body.skill_id);
  /* request_key 由客户端对「run:slot + 参数」做稳定哈希（stableCanvasActionId）——
     判据是"稳定可复现"，不是某个固定字面量；重试必须沿用同一个值（下面对比） */
  check(/^canvas-[0-9a-f]+$/.test(String(body.request_key || '')), 'request_key 是稳定幂等键', String(body.request_key));
  check(Boolean(body.billing_quote_id && body.billing_action_id), '带上了报价（先报价后扣费）', String(body.billing_quote_id));
  check(calls.quote.length === 1 && calls.quote[0].sku, '报价 SKU 由模型+清晰度推出', JSON.stringify(calls.quote[0]));

  /* ④ 结果落屏 + 自动存作品 */
  await page.waitForFunction(() => /作品已保存|云端保存暂时失败/.test(document.querySelector('.media-run-notice')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
  const saved = calls.saveWork[0] || {};
  const work = saved.work || {};
  check(Boolean(calls.saveWork.length), '完成后自动保存作品', JSON.stringify(Object.keys(work).slice(0, 8)));
  check(work.mediaSkillId === 'image.white_bg', '作品归到这条技能名下（mediaSkillId）', String(work.mediaSkillId));
  check(Array.isArray(work.images) && work.images.length === 1, '作品里带着这次生成的图', String((work.images || []).length));
  await page.screenshot({ path: '.tmp/e2e/01-generated.png' });

  /* ⑤ 失败态：上游 400 → 就近错误 + 只重试失败项 */
  regeneratePlan = 'fail';
  await page.click('.media-run-again');
  await page.waitForSelector('.media-run-retry', { timeout: 20000 });
  const failState = await page.evaluate(() => ({
    errors: Array.from(document.querySelectorAll('.media-run-error')).map(n => n.textContent),
    retry: document.querySelector('.media-run-retry')?.textContent || '',
  }));
  check(failState.errors.some(text => text.includes('模拟上游失败')), '失败原因就近显示在对应槽位上', JSON.stringify(failState.errors));
  check(failState.retry.includes('只重试失败项'), '提供 deliberate retry（只重试失败项）', failState.retry);
  await page.screenshot({ path: '.tmp/e2e/02-failed.png' });

  /* ⑥ 重试：只重跑失败槽位，且沿用同一个 request_key（幂等，不重复扣费） */
  const before = calls.regenerate.length;
  regeneratePlan = 'ok';
  await page.click('.media-run-retry');
  await page.waitForFunction(count => document.querySelectorAll('.media-run-slot img').length > 0 && count < 0, null, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const retried = calls.regenerate[calls.regenerate.length - 1] || {};
  check(calls.regenerate.length === before + 1, '重试只补跑失败的那一张', before + '→' + calls.regenerate.length);
  check(retried.request_key === calls.regenerate[before - 1]?.request_key, '重试沿用同一 request_key（服务端幂等，不会重复扣费）', String(retried.request_key));
} catch (error) {
  failures.push('✖ 端到端脚本自身失败：' + (error?.message || error));
} finally {
  check(pageErrors.length === 0, '页面无运行时异常', pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
}

for (const line of notes) console.log(line);
if (failures.length) {
  console.error('\n[media-e2e] 失败：');
  for (const line of failures) console.error('  ' + line);
  process.exit(1);
}
console.log('\n[media-e2e] 通过：工作台的字段→参数→结果→存作品→失败重试全链路符合契约（上游为打桩，零额度消耗）。');
