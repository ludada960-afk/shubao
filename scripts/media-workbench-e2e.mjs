#!/usr/bin/env node
// scripts/media-workbench-e2e.mjs —— 技能工作台的**端到端 + 踩坑**验证（上游打桩，零额度消耗）
// ═══════════════════════════════════════════════════════════════════════════
// 用户 9-17 口径：「**不要真实的去跑图或者跑视频**……你要在确保不这么做的前提之下，
//   最大限度的确保实实在在的能够 ok 的进行产出……你自己先把坑给踩完，不要让我去踩坑。」
// 所以：**上游 /api/* 全部按服务端真实契约打桩**，用真浏览器把工作台从各个角度跑一遍。
// 覆盖的坑：
//   ① 必填未填：CTA 禁用 + 就近说明缺什么
//   ② 上传：真文件 → 既有上传接口；失败**留在原地可重试**，重试成功才解禁 CTA
//   ③ 生成：请求体逐字符合契约（prompt/image_url/ratio/resolution/image2/visual/幂等键/报价）
//   ④ 结果**留在工作台**（不跳画布、不跳别处），并自动存作品且归属到该技能
//   ⑤ 失败：就近报错 + 只重试失败项 + **沿用同一幂等键**（不重复扣费）
//   ⑥ 未登录点生成：只弹登录，**不发请求、不扣费**
//   ⑦ 余额不足（402）：弹付费墙，**不发请求、不扣费**
//   ⑧ 上游 502：走服务端 status 轮询**自愈拿回结果**，不报假失败
//   ⑨ 数量 N：真的发 N 次、出 N 张
//   ⑩ 刷新后**历史还在**（走 /api/works，不是靠内存）
// 不能替代的：真实上游的出图质量与时延 —— 那需要一次**用户本人**的付费验收。
// 用法：node scripts/media-workbench-e2e.mjs
// 退出码：0 = 全绿；1 = 有断言失败（逐条打印）。
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
const UPLOAD_FILE = 'public/gallery/ecommerce/baby-bottle-product-suite/01.webp';
const RESULT_FILE = 'public/images/visual-recipes/cases/free-glass-whale.png';
const RESULT_ASSET = 'b'.repeat(64) + '.png';       /* 服务端"持久化资产"的真实形状 */
const RESULT_IMAGE = '/api/generated-assets/' + RESULT_ASSET;

/* ── 打桩开关：每个场景只改自己关心的那一项 ── */
const fx = {
  quoteStatus: 200,          /* 402 = 余额不足 */
  assetStatus: 200,          /* 500 = 上传失败 */
  regenerateMode: 'ok',      /* ok | fail400 | recover502 */
  statusRemaining: 0,        /* >0 时 status 先返回"处理中"，模拟出图还没结束 */
  suiteDelivered: 3,         /* 套图任务最终交付几张（< 方案张数 = 部分交付） */
  works: [],
};
const calls = { assets: 0, assetRole: '', regenerate: [], status: 0, quote: [], saveWork: [], session: 0, suite: [], suitePoll: 0, deleteWork: [] };

const failures = [];
const passed = [];
const check = (ok, label, detail = '') => {
  if (ok) passed.push('✔ ' + label);
  else failures.push('✖ ' + label + (detail ? ' —— ' + detail : ''));
};
const scenario = name => passed.push('\n── ' + name + ' ──');

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
async function fileOrNull(path) { try { const info = await stat(path); return info.isFile() ? path : null; } catch { return null; } }
async function readBody(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); return Buffer.concat(chunks); }

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const path = url.pathname;

  if (path.startsWith('/api/')) {
    const raw = await readBody(req).catch(() => Buffer.alloc(0));
    const parse = () => { try { return JSON.parse(raw.toString('utf8') || '{}'); } catch { return {}; } };

    if (path === '/api/session') { calls.session += 1; return json(res, 200, { ok: true, email: 'e2e@example.com', nickname: 'E2E' }); }
    if (path === '/api/billing/quote') {
      calls.quote.push(parse());
      if (fx.quoteStatus !== 200) return json(res, fx.quoteStatus, { code: 'BILLING_INSUFFICIENT_CREDITS', message: '积分不足' });
      return json(res, 200, { quote: { quoteId: 'quote-e2e-1', totalUnits: 1000, currency: 'ec_points' } });
    }
    if (path === '/api/billing/balance') return json(res, 200, { ok: true, currency: 'ec_points', balance: 999, unlimited: false, credits: 999 });
    if (path === '/api/billing/catalog') return json(res, 200, { ok: true, products: [] });
    if (path === '/api/works') return json(res, 200, fx.works);
    if (path === '/api/ecommerce/assets') {
      if (fx.assetStatus !== 200) return json(res, fx.assetStatus, { error: '原图上传失败' });
      calls.assets += 1;
      calls.assetRole = req.headers['x-ecommerce-asset-role'] || '';
      const assetId = 'a'.repeat(64) + '.png';
      return json(res, 200, {
        original: { assetId, url: '/api/generated-assets/' + assetId, role: req.headers['x-ecommerce-asset-role'] || 'product' },
        preview: { url: '/api/generated-assets/' + assetId + '?variant=thumb' },
      });
    }
    if (path === '/api/canvas/regenerate') {
      const body = parse();
      calls.regenerate.push(body);
      if (fx.regenerateMode === 'fail400') return json(res, 400, { error: '模拟上游失败：产品图不清晰' });
      /* 502：客户端应当转 /api/canvas/regenerate/status 轮询把结果找回来（断线自愈） */
      if (fx.regenerateMode === 'recover502') return json(res, 502, { error: '网关抖动' });
      return json(res, 200, { url: RESULT_IMAGE, taskId: 'task-e2e-1', ratio: body.ratio, resolution: body.resolution });
    }
    if (path === '/api/canvas/regenerate/status') {
      calls.status += 1;
      if (fx.statusRemaining > 0) {
        fx.statusRemaining -= 1;
        return json(res, 202, { status: 'processing', retryAfter: 1, taskId: 'task-e2e-1' });
      }
      return json(res, 200, { status: 'completed', url: RESULT_IMAGE, taskId: 'task-e2e-1' });
    }
    if (path === '/api/save-work') { calls.saveWork.push(parse()); return json(res, 200, { ok: true, _saveKey: 'e2e-work-1' }); }
    if (path === '/api/delete-work') { calls.deleteWork.push(parse()); return json(res, 200, { ok: true }); }
    /* ── 电商套图任务：提交 → 轮询 → 交付若干张 ── */
    if (path === '/api/generate-ecommerce') {
      const body = parse();
      calls.suite.push(body);
      return json(res, 202, { taskId: 'ec-e2e-1', status: 'queued' });
    }
    if (path === '/api/ecommerce/jobs/ec-e2e-1') {
      calls.suitePoll += 1;
      const assets = Array.from({ length: fx.suiteDelivered }, (_, index) => ({
        id: 'suite-' + index,
        stableUrl: '/api/generated-assets/' + String(index).padStart(2, '0').repeat(32) + '.png',
        state: 'completed',
        label: '套图成品 ' + (index + 1),
        role: index === 0 ? 'white_bg' : 'main_text',
      }));
      /* 先给一次 running（让"进度"真的走一遍），再给 completed */
      if (calls.suitePoll === 1) return json(res, 200, { ok: true, task: { id: 'ec-e2e-1', taskId: 'ec-e2e-1', status: 'running', assets: [] } });
      return json(res, 200, { ok: true, task: { id: 'ec-e2e-1', taskId: 'ec-e2e-1', status: 'completed', assets, output: { images: {} } } });
    }
    if (path === '/api/auth/logout') return json(res, 200, { ok: true });
    return json(res, 200, { ok: true });
  }

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

/* ⚠️ 先确认产物是新的：这个脚本跑的是 dist/，源码改了没重新构建的话，
   它会拿旧产物给你一个"假绿/假红"（实测踩过：新加的历史同步根本没进产物，
   于是历史用例判红，白查一轮）。宁可拒绝跑，也不要给出不可信的结论。 */
const newestSource = async dir => {
  const { readdir } = await import('node:fs/promises');
  let newest = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) newest = Math.max(newest, await newestSource(full));
    else if (/\.(jsx?|css)$/.test(entry.name)) newest = Math.max(newest, (await stat(full)).mtimeMs);
  }
  return newest;
};
const distBuiltAt = (await stat(join(ROOT, 'index.html'))).mtimeMs;
const srcChangedAt = await newestSource(resolve('src'));
if (srcChangedAt > distBuiltAt) {
  console.error('[media-e2e] 产物比源码旧 —— 先跑 npm run build 再跑本脚本（否则结论不可信）。');
  process.exit(1);
}

await new Promise(r => server.listen(PORT, '127.0.0.1', r));
await mkdir('.tmp/e2e', { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const SEED_SESSION = () => {
  const future = new Date(Date.now() + 3600 * 1000).toISOString();
  localStorage.setItem('sb-auth', JSON.stringify({ id: 'e2e@example.com', email: 'e2e@example.com', nickname: 'E2E', token: 'e2e-token', expiresAt: future }));
};
/* initScript 每次导航都会跑；"未登录"场景要先让它闭嘴，否则删了会话又被种回来 */
const SUPPRESS_SEED = () => { localStorage.setItem('e2e-no-session', '1'); };
const ALLOW_SEED = () => { localStorage.removeItem('e2e-no-session'); };
await context.addInitScript(() => {
  if (localStorage.getItem('e2e-no-session')) return;   /* 未登录场景 */
  const future = new Date(Date.now() + 3600 * 1000).toISOString();
  localStorage.setItem('sb-auth', JSON.stringify({ id: 'e2e@example.com', email: 'e2e@example.com', nickname: 'E2E', token: 'e2e-token', expiresAt: future }));
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error?.message || error)));

const WORKBENCH = '/image-creation?id=image.white_bg';
const url = () => 'http://127.0.0.1:' + PORT + WORKBENCH;
const open = async () => { await page.goto(url(), { waitUntil: 'load', timeout: 40000 }); await page.waitForSelector('.media-workbench-submit', { timeout: 20000 }); await page.waitForTimeout(400); };
const upload = async () => {
  await page.setInputFiles('.media-field-upload input[type=file]', UPLOAD_FILE);
  await page.waitForSelector('.media-asset-card', { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('.media-asset-card-progress'), null, { timeout: 15000 });
};
const clickGenerate = async () => { await page.click('.media-workbench-submit'); };
const ctaDisabled = () => page.evaluate(() => document.querySelector('.media-workbench-submit')?.disabled ?? null);

try {
  /* ═══ ① 必填未填：CTA 禁用 + 就近说明 ═══ */
  scenario('① 必填未填');
  await open();
  check(await ctaDisabled() === true, '缺素材时「立即生成」禁用');
  const gate = await page.evaluate(() => ({
    hint: document.querySelector('.media-workbench-cta-hint')?.textContent || '',
    points: document.querySelector('.media-workbench-points')?.textContent || '',
    activeRatio: document.querySelector('.media-field-segmented button.is-active')?.textContent || '',
  }));
  check(gate.hint.includes('素材'), '禁用原因就写在按钮旁', gate.hint);
  check(gate.points.includes('1'), '积分按后端单价预估（image2 2K = 1 积分）', gate.points);
  check(gate.activeRatio.includes('1:1'), '比例默认值已选中（不逼用户把每个必填都点一遍）', gate.activeRatio);

  /* ═══ ② 上传失败 → 原地重试 → 成功才解禁 ═══ */
  scenario('② 上传失败可就地重试');
  fx.assetStatus = 500;
  await page.setInputFiles('.media-field-upload input[type=file]', UPLOAD_FILE);
  await page.waitForSelector('.media-field-upload-retry', { timeout: 15000 });
  check(true, '上传失败后**留在原地**给出重试按钮（不是转瞬即逝的 Toast）');
  check(await ctaDisabled() === true, '素材没就绪时仍然不允许生成');
  fx.assetStatus = 200;
  await page.click('.media-field-upload-retry');
  /* 等"上传中"真正结束（重试按钮在点下去的一瞬就消失了，等它不算数） */
  await page.waitForFunction(() => !document.querySelector('.media-asset-card-progress') && !document.querySelector('.media-field-upload-retry'), null, { timeout: 15000 });
  check(await ctaDisabled() === false, '重试成功后 CTA 解禁');
  check(calls.assetRole === 'product', '上传角色按声明下发（product）', calls.assetRole);

  /* ═══ ③④ 生成：契约 + 结果留在工作台 + 自动存作品 ═══ */
  scenario('③ 生成请求符合服务端契约');
  const urlBefore = page.url();
  await clickGenerate();
  await page.waitForFunction(() => document.querySelectorAll('.media-run-slot img').length > 0, null, { timeout: 20000 });
  const body = calls.regenerate[0] || {};
  check(calls.regenerate.length === 1, '只发起 1 次生成（数量=1）', String(calls.regenerate.length));
  check(body.prompt && body.prompt.includes('白底') && !body.prompt.includes('{{'), '提示词由 brief 真实拼出且无残留占位符', String(body.prompt).slice(0, 60));
  check(/\/api\/generated-assets\/[a-f0-9]{64}\.png$/.test(String(body.image_url)), '主素材进入 image_url（图生图）', String(body.image_url));
  check(body.ratio === '1:1' && body.resolution === '2K', '比例/清晰度取声明默认值', body.ratio + '/' + body.resolution);
  check(body.image_model === 'image2', '模型是唯一有出图记录的 image2', String(body.image_model));
  check(body.creation_intent === 'visual' && body.skill_id === 'free', 'creation_intent/skill_id 在服务端白名单内', body.creation_intent + '/' + body.skill_id);
  check(/^canvas-[0-9a-f]+$/.test(String(body.request_key || '')), 'request_key 是稳定幂等键', String(body.request_key));
  check(Boolean(body.billing_quote_id && body.billing_action_id), '带上了报价（先报价后扣费）');
  check(calls.quote.length === 1 && calls.quote[0].sku, '报价 SKU 由模型+清晰度推出', JSON.stringify(calls.quote[0]));

  scenario('④ 结果留在工作台（不跳画布）');
  check(page.url() === urlBefore, '生成后地址没变（没有跳去画布/别的页面）', page.url());
  check(await page.evaluate(() => document.querySelectorAll('.media-run-slot img').length) === 1, '结果图直接出现在工作台右栏');
  await page.waitForFunction(() => /作品已保存|云端保存暂时失败/.test(document.querySelector('.media-run-notice')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
  const work = (calls.saveWork[0] || {}).work || {};
  check(calls.saveWork.length === 1, '完成后自动保存作品');
  check(work.mediaSkillId === 'image.white_bg', '作品归到这条技能名下（历史按它筛）', String(work.mediaSkillId));
  check(Array.isArray(work.images) && work.images.length === 1, '作品里带着这次生成的图', String((work.images || []).length));

  /* ═══ ⑤ 失败 → 就近错误 + 只重试失败项 + 同一幂等键 ═══ */
  scenario('⑤ 失败可就地重试（且不重复扣费）');
  fx.regenerateMode = 'fail400';
  await page.click('.media-run-again');
  await page.waitForSelector('.media-run-retry', { timeout: 20000 });
  const failState = await page.evaluate(() => ({
    errors: Array.from(document.querySelectorAll('.media-run-error')).map(n => n.textContent),
    retry: document.querySelector('.media-run-retry')?.textContent || '',
  }));
  check(failState.errors.some(text => text.includes('模拟上游失败')), '失败原因就近显示在对应槽位上', JSON.stringify(failState.errors));
  check(failState.retry.includes('只重试失败项'), '提供 deliberate retry', failState.retry);
  const beforeRetry = calls.regenerate.length;
  fx.regenerateMode = 'ok';
  await page.click('.media-run-retry');
  await page.waitForTimeout(1500);
  const retried = calls.regenerate[calls.regenerate.length - 1] || {};
  check(calls.regenerate.length === beforeRetry + 1, '重试只补跑失败的那一张', beforeRetry + '→' + calls.regenerate.length);
  check(retried.request_key === calls.regenerate[beforeRetry - 1]?.request_key, '重试沿用同一 request_key（服务端幂等，不会重复扣费）', String(retried.request_key));

  /* ═══ ⑥ 未登录：只弹登录，不发请求 ═══ */
  scenario('⑥ 未登录点生成（不扣费）');
  await page.evaluate(SUPPRESS_SEED);
  await page.evaluate(() => localStorage.removeItem('sb-auth'));
  await open();
  await upload();
  const beforeGuest = calls.regenerate.length;
  await clickGenerate();
  await page.waitForTimeout(1200);
  check(calls.regenerate.length === beforeGuest, '未登录时不发任何生成请求（不会偷偷扣费）', String(calls.regenerate.length));
  check(await page.evaluate(() => Boolean(document.querySelector('.ld-overlay, .ld-card'))), '弹出登录弹窗引导登录');
  await page.evaluate(ALLOW_SEED);
  await open();

  /* ═══ ⑦ 余额不足：付费墙，不发请求 ═══ */
  scenario('⑦ 余额不足（402）');
  fx.quoteStatus = 402;
  await open();
  await upload();
  const beforePoor = calls.regenerate.length;
  await clickGenerate();
  await page.waitForTimeout(1500);
  check(calls.regenerate.length === beforePoor, '报价 402 时不发生成请求（不产生半截扣费）', String(calls.regenerate.length));
  check(await page.evaluate(() => Boolean(document.querySelector('.pricing-modal'))), '弹出付费墙而不是干巴巴报错');
  fx.quoteStatus = 200;

  /* ═══ ⑧ 上游 502：走 status 轮询自愈 ═══ */
  scenario('⑧ 上游抖动（502）自愈');
  fx.regenerateMode = 'recover502';
  const beforeRecover = calls.status;
  await open();
  await upload();
  await clickGenerate();
  await page.waitForFunction(() => document.querySelectorAll('.media-run-slot img').length > 0, null, { timeout: 25000 }).catch(() => {});
  check(calls.status > beforeRecover, '502 后自动转 /api/canvas/regenerate/status 轮询找回结果', 'status 调用 ' + (calls.status - beforeRecover) + ' 次');
  check(await page.evaluate(() => document.querySelectorAll('.media-run-slot img').length) === 1, '结果是拿回来了的（没报假失败）');
  fx.regenerateMode = 'ok';

  /* ═══ ⑨ 数量 N：真的发 N 次、出 N 张 ═══ */
  scenario('⑨ 数量 3');
  await open();
  await upload();
  const plusSelector = await page.evaluateHandle(() => {
    const label = Array.from(document.querySelectorAll('.media-field')).find(node => (node.querySelector('.media-field-label')?.textContent || '').startsWith('数量'));
    return label?.querySelectorAll('.media-field-stepper button')[1] || null;
  });
  await plusSelector.asElement().click();
  await plusSelector.asElement().click();
  const beforeBatch = calls.regenerate.length;
  await clickGenerate();
  await page.waitForFunction(() => document.querySelectorAll('.media-run-slot img').length === 3, null, { timeout: 30000 }).catch(() => {});
  check(calls.regenerate.length === beforeBatch + 3, '数量=3 就真的发 3 次', String(calls.regenerate.length - beforeBatch));
  check(await page.evaluate(() => document.querySelectorAll('.media-run-slot img').length) === 3, '出 3 张结果');
  const keys = calls.regenerate.slice(beforeBatch).map(item => item.request_key);
  check(new Set(keys).size === 3, '三张的幂等键互不相同（否则服务端会认为是同一次重放）', JSON.stringify(keys));

  /* ═══ ⑩ 刷新后历史还在（走 /api/works，不靠内存） ═══ */
  scenario('⑩ 刷新后历史还在');
  fx.works = [{
    id: 'e2e-work-1', _saveKey: 'e2e-work-1', _ecResult: true, title: '白底商品图', mediaSkillId: 'image.white_bg',
    createdAt: Date.now(), images: [{ url: RESULT_IMAGE, label: '白底商品图 1' }],
    replay: { mediaSkillId: 'image.white_bg', panelValues: { ratio: '4:3', clarity: '4K', count: 2 } },
  }];
  await page.evaluate(() => { localStorage.removeItem('sb-works'); });
  await open();
  await page.click('.media-workbench-tabs button:nth-child(2)');
  await page.waitForSelector('.skill-workbench-grid .media-case-card', { timeout: 15000 });
  const historyInfo = await page.evaluate(() => ({
    count: document.querySelectorAll('.skill-workbench-grid .media-case-card').length,
    title: document.querySelector('.media-case-card-title')?.textContent || '',
    subtitle: document.querySelector('.media-case-card-subtitle')?.textContent || '',
  }));
  check(historyInfo.count >= 1, '历史里能看到已保存的作品（/api/works 拉回来的）', JSON.stringify(historyInfo));
  check(historyInfo.title.includes('白底'), '历史条目是可辨认的（技能名 + 张数/时间）', JSON.stringify(historyInfo));
  await page.screenshot({ path: '.tmp/e2e/history.png' });

  /* ═══ ⑪ 生成中刷新页面：图不能丢（出图是要花钱的） ═══ */
  scenario('⑪ 生成中刷新，结果要能找回来');
  await open();
  await upload();
  const beforeRecover2 = calls.saveWork.length;
  calls.status = 0;
  fx.regenerateMode = 'recover502';   /* 502 → 客户端转 status 轮询（模拟出图还在跑） */
  fx.statusRemaining = 6;             /* 前面几次都还在处理中 */
  await clickGenerate();
  await page.waitForTimeout(1500);    /* 让它进入"生成中"并落盘 */
  const beforeReloadStatus = calls.status;
  await open();                       /* ← 用户刷新了页面 */
  await page.waitForSelector('.media-run', { timeout: 15000 }).catch(() => {});
  const restored = await page.evaluate(() => ({
    runVisible: Boolean(document.querySelector('.media-run')),
    notice: document.querySelector('.media-run-notice')?.textContent || '',
    slots: document.querySelectorAll('.media-run-slot').length,
  }));
  check(restored.runVisible && restored.slots === 1, '刷新后这一轮生成被恢复出来（不是一片空白）', JSON.stringify(restored));
  await page.waitForFunction(() => document.querySelectorAll('.media-run-slot img').length > 0, null, { timeout: 30000 }).catch(() => {});
  check(calls.status > beforeReloadStatus, '刷新后按同一请求体继续向服务端要结果（幂等键相同 → 不会重复扣费）', 'status ' + beforeReloadStatus + '→' + calls.status);
  check(await page.evaluate(() => document.querySelectorAll('.media-run-slot img').length) === 1, '结果最终落到了界面上');
  await page.waitForTimeout(1200);
  check(calls.saveWork.length > beforeRecover2, '找回的结果同样会存进作品（历史里看得到）', String(calls.saveWork.length - beforeRecover2));
  fx.regenerateMode = 'ok';
  fx.statusRemaining = 0;

  /* ═══ ⑫ 视频侧：工作台只做"带着配置回既有视频工作台"，绝不就地扣费 ═══ */
  scenario('⑫ 视频技能不就地生成（走既有链路）');
  const videoCharges = calls.regenerate.length + calls.quote.length;
  await page.goto('http://127.0.0.1:' + PORT + '/video-creation?id=video.smart', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-workbench-submit', { timeout: 20000 });
  await page.waitForTimeout(600);
  const videoState = await page.evaluate(() => ({
    cta: document.querySelector('.media-workbench-submit')?.textContent || '',
    points: document.querySelector('.media-workbench-points')?.textContent || '',
    uploads: document.querySelectorAll('.media-field-upload-add').length,
  }));
  check(videoState.cta.includes('去视频工作台'), '视频技能的 CTA 是"去视频工作台"（多分钟流水线不塞进单图工作台）', videoState.cta);
  check(videoState.points === '', '不显示单图积分（不假装能就地出视频）', videoState.points);
  await page.click('.media-workbench-submit');
  await page.waitForTimeout(1200);
  check(calls.regenerate.length + calls.quote.length === videoCharges, '点它**不产生任何扣费请求**', String(calls.regenerate.length + calls.quote.length - videoCharges));
  check(await page.evaluate(() => Boolean(document.querySelector('.homepage-mode-showcase, .surface-card'))), '落到首页既有视频入口（配置带过去）');

  /* ═══ ⑬ 首页热门技能 → 点一张直接进它的子页面（用户定的最终形态） ═══ */
  scenario('⑬ 首页热门技能条直达子页面');
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.hot-skill-strip .media-case-card', { timeout: 20000 });
  const strip = await page.evaluate(() => ({
    count: document.querySelectorAll('.hot-skill-strip .media-case-card').length,
    titles: Array.from(document.querySelectorAll('.hot-skill-strip .media-case-card-title')).map(n => n.textContent),
  }));
  check(strip.count > 0, '首页提示词输入区下面有热门技能', JSON.stringify(strip.titles));
  const firstTitle = strip.titles[0];
  await page.click('.hot-skill-strip .media-case-card-hit');
  await page.waitForSelector('.media-workbench-submit', { timeout: 20000 });
  const landed = await page.evaluate(() => ({
    url: location.pathname + location.search,
    title: document.querySelector('.media-workbench-head h2')?.textContent || '',
    back: Boolean(document.querySelector('.media-workbench-back')),
  }));
  check(/^\/(image|video)-creation\?id=/.test(landed.url), '点热门技能进的是**它自己的子页面**（不是画布、不是别的板块）', landed.url);
  check(landed.title === firstTitle, '进去的就是点的那一条技能', landed.title + ' vs ' + firstTitle);
  check(landed.back, '子页面有"返回创作"，能回到 Hub');

  /* ═══ ⑭ 连点「只重试失败项」不会重复扣费 ═══ */
  scenario('⑭ 重试连点');
  await open();
  await upload();
  fx.regenerateMode = 'fail400';
  await clickGenerate();
  await page.waitForSelector('.media-run-retry', { timeout: 20000 });
  const beforeDouble = calls.regenerate.length;
  fx.regenerateMode = 'ok';
  /* 同一 tick 里连点两次（比真实双击更苛刻）：第二次必须看到"已经没得重试了" */
  await page.evaluate(() => { const node = document.querySelector('.media-run-retry'); node?.click(); node?.click(); });
  await page.waitForTimeout(2500);
  check(calls.regenerate.length === beforeDouble + 1, '连点两次也只补跑一次（不会重复扣费）', beforeDouble + '→' + calls.regenerate.length);

  /* ═══ ⑮ 换技能/回 Hub 时上一轮结果不许残留 ═══ */
  scenario('⑮ 换技能清空上一轮');
  fx.regenerateMode = 'ok';
  await open();
  await upload();
  await clickGenerate();
  await page.waitForFunction(() => document.querySelectorAll('.media-run-slot img').length > 0, null, { timeout: 20000 });
  await page.click('.media-workbench-back');
  await page.waitForSelector('.media-hub', { timeout: 15000 });
  await page.click('.media-hub .media-case-card-hit');
  await page.waitForTimeout(1200);
  const afterSwitch = await page.evaluate(() => ({
    run: Boolean(document.querySelector('.media-run')),
    title: document.querySelector('.media-workbench-head h2')?.textContent || '',
  }));
  check(!afterSwitch.run, '换到别的技能后，上一轮的结果不会留在这一页上', JSON.stringify(afterSwitch));

  /* ═══ ⑯ 电商套图：就地跑完（按套计价的钱路） ═══ */
  scenario('⑯ 套图就地跑完');
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation?id=image.product_suite', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-workbench-submit', { timeout: 20000 });
  await page.waitForTimeout(500);
  const suiteBefore = await page.evaluate(() => ({
    cta: document.querySelector('.media-workbench-submit')?.textContent || '',
    points: document.querySelector('.media-workbench-points')?.textContent || '',
    hint: document.querySelector('.media-workbench-cta-hint')?.textContent || '',
    labels: Array.from(document.querySelectorAll('.media-field-label')).map(n => n.textContent),
  }));
  check(/\d+ 积分/.test(suiteBefore.points), '套图 CTA 显示的是**按套**的总价（不是单张价）', JSON.stringify(suiteBefore.points));
  check(suiteBefore.labels.some(label => label.startsWith('平台')), '套图有「平台」字段（它决定套图结构与张数）', JSON.stringify(suiteBefore.labels));
  check(!suiteBefore.labels.some(label => label.startsWith('数量')), '套图不该有"数量"（张数由平台结构决定，放了也没用）', JSON.stringify(suiteBefore.labels));

  await page.setInputFiles('.media-field-upload input[type=file]', UPLOAD_FILE);
  await page.waitForFunction(() => !document.querySelector('.media-asset-card-progress'), null, { timeout: 15000 });
  const suiteQuoteBefore = calls.quote.length;
  await page.click('.media-workbench-submit');
  await page.waitForFunction(() => document.querySelectorAll('.media-run-slot img').length > 0, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3500);
  const suiteBody = calls.suite[0] || {};
  const suiteQuote = calls.quote[calls.quote.length - 1] || {};
  const planQuantity = Number(suiteQuote.quantity || 0);
  check(calls.quote.length > suiteQuoteBefore, '先报价再提交（不报价不生成）', JSON.stringify(suiteQuote));
  check(planQuantity > 1, '套图按**方案张数**报价（不是 1 张）', String(planQuantity));
  check(Boolean(suiteBody.billing_quote_id), '提交时带上报价 id（服务端据此建 hold）');
  check(String(suiteBody.platform) === '淘宝', '平台进了请求体（它决定套图结构）', String(suiteBody.platform));
  check(Array.isArray(suiteBody.assets?.product) && suiteBody.assets.product.length === 1, '商品图以"已拥有资产"提交（服务端不用重传）', JSON.stringify(suiteBody.assets?.product?.length));
  check(Array.isArray(suiteBody.sizing?.images) && suiteBody.sizing.images.length > 1, 'sizing.images 带上了算好的图集（服务端据此算同一套方案）', JSON.stringify(suiteBody.sizing?.images?.length));
  check(calls.suite.length === 1, '只提交了一次套图任务（连点不会重复下单）', String(calls.suite.length));
  const suiteShots = await page.evaluate(() => document.querySelectorAll('.media-run-slot img').length);
  check(suiteShots === fx.suiteDelivered, '交付了几张就显示几张', suiteShots + ' vs ' + fx.suiteDelivered);
  const suiteNotice = await page.evaluate(() => document.querySelector('.media-run-notice')?.textContent || '');
  check(suiteNotice.includes('任务记录') && suiteNotice.includes(String(planQuantity)), '部分交付时**引导去任务记录补跑**，不提供整单重跑', suiteNotice.slice(0, 80));
  const suiteWork = ((calls.saveWork[calls.saveWork.length - 1] || {}).work) || {};
  check(suiteWork.mediaSkillId === 'image.product_suite', '套图作品归到这条技能名下（历史看得到）', String(suiteWork.mediaSkillId));
  check(String(suiteWork.taskId) === 'ec-e2e-1', '套图作品用服务端任务号当身份（不会在作品里出现两条）', String(suiteWork.taskId));

  /* ═══ ⑰ 历史条目的操作：用这组参数 / 删除 ═══ */
  scenario('⑰ 历史操作');
  await open();
  await page.click('.media-workbench-tabs button:nth-child(2)');
  await page.waitForSelector('.skill-history-item', { timeout: 15000 });
  check(true, '历史条目带操作行（不是只能看）');
  await page.click('.skill-history-reuse');
  await page.waitForTimeout(500);
  const reused = await page.evaluate(() => {
    const pick = prefix => Array.from(document.querySelectorAll('.media-field')).find(node => (node.querySelector('.media-field-label')?.textContent || '').startsWith(prefix));
    return {
      ratio: pick('比例')?.querySelector('.media-field-segmented button.is-active')?.textContent || '',
      clarity: pick('清晰度')?.querySelector('.media-field-segmented button.is-active')?.textContent || '',
      notice: document.querySelector('.media-run-notice')?.textContent || '',
    };
  });
  check(reused.ratio.includes('4:3') && reused.clarity.includes('4K'), '「用这组参数」把面板还原成那次的样子', JSON.stringify(reused));
  check(/计费/.test(reused.notice), '还原时明确告诉用户"确认后再点生成、会重新计费"（不偷偷扣费）', reused.notice.slice(0, 40));
  const beforeDelete = calls.deleteWork.length;
  await page.click('.skill-history-delete');
  await page.waitForTimeout(1200);
  check(calls.deleteWork.length === beforeDelete + 1, '删除走既有软删除接口', String(calls.deleteWork.length - beforeDelete));
  const afterDelete = await page.evaluate(() => document.querySelectorAll('.skill-history-item').length);
  check(afterDelete === 0, '删除后历史里立刻不显示它', String(afterDelete));

} catch (error) {
  failures.push('✖ 端到端脚本自身失败：' + (error?.message || error));
} finally {
  check(pageErrors.length === 0, '全程页面无运行时异常', pageErrors.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
}

for (const line of passed) console.log(line);
if (failures.length) {
  console.error('\n[media-e2e] 失败：');
  for (const line of failures) console.error('  ' + line);
  process.exit(1);
}
console.log('\n[media-e2e] 通过：' + passed.filter(line => line.startsWith('✔')).length + ' 条断言全绿 —— 契约、结果落地、历史、失败与重试、未登录、欠费、断线自愈、批量数量。');