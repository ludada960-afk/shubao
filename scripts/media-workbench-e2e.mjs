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
/* 全量扫描要用**声明源**里的技能清单（不是手抄一份 id）：
   技能上下线时这一条会自己跟着走，不会变成一份过期的名单。 */
import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';
import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import { skillVideoMode } from '../src/skills/skillRun.js';

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
  videoJobs: [],             /* 服务端 /api/video/jobs 返回的任务（嵌入的视频工作台用它渲染生成记录） */
};
const calls = { assets: 0, assetRole: '', regenerate: [], status: 0, quote: [], saveWork: [], session: 0, suite: [], suitePoll: 0, deleteWork: [], videoJob: 0 };

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
    /* ── 视频：能力 + 任务列表（子页面里嵌入的视频工作台要用）──
       ⚠️ 本轮**不许真实出片**，所以 POST /api/video/jobs 一律记下来并报错：
          真被调用到就是接线错了，要让它响，不能静默放过。 */
    if (path === '/api/video/capabilities') {
      return json(res, 200, {
        loading: false, generationEnabled: true, workbenchEnabled: false, directorUi: false,
        uploadMode: 'tus', defaultProductId: 'seedance_standard',
        resolutions: ['720p', '1080p'], durations: { min: 5, max: 10 },
        aspectRatios: ['9:16', '16:9', '1:1'],
        products: [{
          id: 'seedance_standard', label: 'Seedance 2.0', tierLabel: '标准', providerLabel: 'Seedance',
          description: '写实、动作自然的通用视频模型', default: true,
          modes: ['script', 'reference', 'frame', 'remake'],
          resolutions: ['720p', '1080p'], durationOptions: [5, 10],
          durations: { min: 5, max: 10 },
          quotes: {
            short: { sku: 'video_seedance_standard_720p_5s', units: 92000, points: 92 },
            long: { sku: 'video_seedance_standard_720p_10s', units: 184000, points: 184 },
          },
        }],
      });
    }
    if (path === '/api/video/jobs' && req.method === 'POST') {
      calls.videoJob += 1;
      return json(res, 500, { error: 'E2E：本轮不允许真实提交视频任务' });
    }
    if (path === '/api/video/jobs') return json(res, 200, { jobs: fx.videoJobs });
    /* 单条任务：点「生成记录」里的某一条时会拉它（缺这条路由会让任务状态被清成 undefined——
       已经踩过一次，见 VideoStudioPage.poll 里的防呆注释） */
    if (/^\/api\/video\/jobs\/[^/]+$/.test(path)) {
      const id = decodeURIComponent(path.split('/').pop());
      const job = fx.videoJobs.find(item => item.id === id);
      return job ? json(res, 200, { job }) : json(res, 404, { error: '任务不存在' });
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

  /* ═══ ⑫ 视频侧：把既有视频工作台**整块嵌进子页面**（用户 9-17 改口径）═══
     原来这里断言的是"点 CTA 跳去视频工作台"，用户明确否掉了：
     「生成结果直接在工作台里面展示，不必像之前一样生成完就一定要跳进去画布里面」。
     现在断言的是：工作台真的嵌进来了、创作方式按技能落位、**结果台在嵌入形态下也渲染**、
     并且打开这一页不产生任何扣费。 */
  scenario('⑫ 视频技能在子页面里就地跑完（既有视频工作台整块嵌入）');
  /* ⚠️ 判据是**扣费点**，不是报价：视频创作台一进页面就会为自己的 SKU 报价（quoteBillingAction），
     那是设计如此、不扣钱。真正会花钱的只有 regenerate（单图扣费点）与创建视频任务。 */
  const videoCharges = calls.regenerate.length + calls.videoJob;
  const openVideoSkill = async id => {
    await page.goto('http://127.0.0.1:' + PORT + '/video-creation?id=' + id, { waitUntil: 'load', timeout: 40000 });
    await page.waitForSelector('.media-workbench-panel .video-studio-page', { timeout: 20000 });
    await page.waitForTimeout(700);
  };
  await openVideoSkill('video.smart');
  const videoState = await page.evaluate(() => ({
    composer: Boolean(document.querySelector('.media-workbench-panel .video-composer')),
    activeMode: document.querySelector('.video-mode-tabs button.is-selected strong')?.textContent || '',
    /* 判成片台（.video-frame）而不是整段结果区：生成记录任何时候都要在 */
    resultStage: Boolean(document.querySelector('.video-frame')),
    genericCta: document.querySelectorAll('.media-workbench-submit').length,
    genericFields: document.querySelectorAll('.media-workbench-fields .media-field').length,
    tabs: Array.from(document.querySelectorAll('.media-workbench-tabs button')).map(node => node.textContent),
    url: location.pathname + location.search,
  }));
  check(videoState.composer, '视频工作台整块嵌进了子页面（不是又写一个壳）');
  check(videoState.activeMode.includes('智能成片'), '创作方式页签按技能落位（video.smart → 智能成片）', videoState.activeMode);
  /* 结果台：嵌入形态下没有任务时不占位置（否则创作台下面是 700px 空白），
     所以这里断言的是"还没生成时不渲染"，任务出现才渲染（见下面点历史记录那一段）。 */
  check(!videoState.resultStage, '没有任务时不铺那块空成片台（嵌入形态不留 700px 空白）', String(videoState.resultStage));
  check(await page.evaluate(() => Boolean(document.querySelector('.video-history'))), '但「生成记录」一定要在（它是全部视频任务的唯一入口）');
  check(videoState.genericCta === 0, '不再渲染通用 CTA（生成按钮在工作台里，两个 CTA 会让人不知道按哪个）', String(videoState.genericCta));
  check(videoState.genericFields === 0, '不再渲染通用字段栏（参数控件就在工作台里，重复一套只会打架）', String(videoState.genericFields));
  check(videoState.tabs.join(',') === '示例,历史', '示例 / 历史 页签都在', videoState.tabs.join(','));
  check(videoState.url === '/video-creation?id=video.smart', '打开这一页没有跳走', videoState.url);
  check(calls.regenerate.length + calls.videoJob === videoCharges, '光是打开这一页不产生任何扣费请求', String(calls.regenerate.length + calls.videoJob - videoCharges));
  check(calls.videoJob === 0, '没有偷偷提交视频任务（本轮不许真实出片）', String(calls.videoJob));

  /* 首尾帧技能：页签要落在「首尾帧」，而且素材区跟着变（不是永远停在智能成片） */
  await openVideoSkill('video.frame');
  const frameMode = await page.evaluate(() => ({
    active: document.querySelector('.video-mode-tabs button.is-selected strong')?.textContent || '',
    materialHint: document.querySelector('.video-materials header small')?.textContent || '',
  }));
  check(frameMode.active.includes('首尾帧'), '另一条视频技能落在自己的页签上', frameMode.active);
  check(frameMode.materialHint.includes('首尾帧'), '素材区跟着这条链路走（首尾帧用于控制起点与终点）', frameMode.materialHint);

  /* 历史：本机标记（videoJobTags）把任务按技能筛进子页面历史。
     标记缺失时也不能丢东西 —— 全量任务永远在嵌入工作台的「生成记录」里。 */
  scenario('⑫b 视频任务按技能进子页面历史（标记缺失时也不丢任务）');
  fx.videoJobs = [{
    id: 'job-e2e-video', status: 'completed', mode: 'script', sku: 'video_seedance_standard_720p_5s',
    prompt: '白底化妆水瓶缓慢旋转，柔光扫过瓶身', duration: 5, aspectRatio: '9:16', resolution: '720p',
    resultUrl: '/images/home/workspace-video.png', progress: 100,
  }];
  await page.goto('http://127.0.0.1:' + PORT + '/video-creation?id=video.smart', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-workbench-panel .video-studio-page', { timeout: 20000 });
  await page.waitForTimeout(600);
  /* 没有标记 → 子页面历史为空，但工作台的生成记录里有它（全量，不丢） */
  await page.click('.media-workbench-tabs button:nth-child(2)');
  await page.waitForTimeout(300);
  const untagged = await page.evaluate(() => ({
    empty: document.querySelector('.media-workbench-empty')?.textContent || '',
    record: Array.from(document.querySelectorAll('.video-history button span')).map(node => node.textContent),
  }));
  check(untagged.empty.includes('生成记录'), '历史为空时如实指向工作台里的全量「生成记录」', untagged.empty.slice(0, 40));
  check(untagged.record.some(text => text.includes('白底化妆水瓶')), '任务本身没有丢（生成记录里看得到）', JSON.stringify(untagged.record));
  /* 打上"这条任务属于 video.smart"的本机标记 → 它出现在这条技能的历史里 */
  await page.evaluate(() => localStorage.setItem('shubao:video-job-skills:v1', JSON.stringify({ 'job-e2e-video': 'video.smart' })));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.media-workbench-panel .video-studio-page', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.click('.media-workbench-tabs button:nth-child(2)');
  await page.waitForSelector('.skill-history-item', { timeout: 10000 });
  const tagged = await page.evaluate(() => ({
    title: document.querySelector('.skill-history-item .media-case-card-title')?.textContent || '',
    subtitle: document.querySelector('.skill-history-item .media-case-card-subtitle')?.textContent || '',
    hasVideo: Boolean(document.querySelector('.skill-history-item video')),
    actions: Array.from(document.querySelectorAll('.skill-history-item .skill-history-actions button')).map(node => node.textContent),
  }));
  check(tagged.title.includes('白底化妆水瓶'), '打了标记的任务进入这条技能的历史', tagged.title);
  check(tagged.subtitle.includes('5 秒'), '历史卡片带上规格（时长 / 清晰度 / 比例）', tagged.subtitle);
  check(tagged.hasVideo, '成片在历史卡里就是视频（不是一张死图）');
  /* 工作台自己的「生成记录」里点一条 → 结果台出现，成片就在这一页看（不必跳画布）。
     ⚠️ 子页面历史卡是**弹窗看大图**（我们自己的交互），点它不会切结果台 ——
        所以这里点的是嵌进来那个工作台的生成记录。 */
  await page.click('.video-history button');
  await page.waitForTimeout(600);
  const stageAfterPick = await page.evaluate(() => ({
    stage: Boolean(document.querySelector('.video-frame')),
    player: Boolean(document.querySelector('.video-frame video')),
  }));
  check(stageAfterPick.stage, '点生成记录后，结果台就在这一页出现（不必跳画布）');
  check(stageAfterPick.player, '结果台里是可播放的成片（不是一句"去画布看"）');
  check(tagged.actions.includes('用这组参数'), '历史条目能还原参数', JSON.stringify(tagged.actions));
  /* 还原是**只回填、不扣费**：点完不许出现任何生成请求 */
  const beforeReuse = calls.regenerate.length + calls.videoJob;
  await page.click('.skill-history-item .skill-history-reuse');
  await page.waitForTimeout(600);
  const videoRestored = await page.evaluate(() => ({
    /* ⚠️ 视频提示词是 contentEditable 的 div（mention-prompt-field），不是 textarea —— 读 textContent */
    prompt: document.querySelector('.video-prompt-mentions')?.textContent || '',
    notice: document.querySelector('.media-run-notice')?.textContent || '',
    active: document.querySelector('.video-mode-tabs button.is-selected strong')?.textContent || '',
  }));
  check(videoRestored.prompt.includes('白底化妆水瓶'), '提示词还原回创作台', videoRestored.prompt.slice(0, 40));
  check(videoRestored.notice.includes('重新计费'), '明确告诉用户"确认后才会重新计费"', videoRestored.notice.slice(0, 40));
  check(videoRestored.active.includes('智能成片'), '创作方式也跟着还原', videoRestored.active);
  check(calls.regenerate.length + calls.videoJob === beforeReuse, '「用这组参数」不产生任何扣费请求', String(calls.regenerate.length + calls.videoJob - beforeReuse));

  /* ═══ ⑫c 小红书图文：既有图文工作台整块嵌进子页面 ═══ */
  scenario('⑫c 小红书图文在子页面里就地跑完');
  const xhsCharges = calls.regenerate.length + calls.videoJob + calls.saveWork.length;
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation?id=image.xhs_note', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-workbench-panel .xhs-workbench-card, .media-workbench-panel .xhs-content-surface', { timeout: 20000 });
  await page.waitForTimeout(600);
  const xhsState = await page.evaluate(() => ({
    composer: Boolean(document.querySelector('.media-workbench-panel textarea')),
    generate: Array.from(document.querySelectorAll('.media-workbench-panel .shubao-gen-cta')).map(node => node.textContent).join('|'),
    genericCta: document.querySelectorAll('.media-workbench-submit').length,
    tabs: Array.from(document.querySelectorAll('.media-workbench-tabs button')).map(node => node.textContent),
    url: location.pathname + location.search,
  }));
  check(xhsState.composer, '图文工作台整块嵌进了子页面');
  check(xhsState.generate.includes('生成图文'), '生成按钮就在嵌进来的工作台里', xhsState.generate.slice(0, 30));
  check(xhsState.genericCta === 0, '不再渲染通用 CTA', String(xhsState.genericCta));
  check(xhsState.tabs.join(',') === '示例,历史', '示例 / 历史 页签都在', xhsState.tabs.join(','));
  check(xhsState.url === '/image-creation?id=image.xhs_note', '打开这一页没有跳走', xhsState.url);
  check(calls.regenerate.length + calls.videoJob + calls.saveWork.length === xhsCharges, '光是打开这一页不产生任何扣费/生成请求');
  /* 图文作品（cover_url / image_urls）必须出现在这条技能的历史里 —— 按 work.images 读会得到 0 张 */
  /* ⚠️ fx 在 Node 侧（打桩服务里），不能在 page.evaluate 里改它 —— 那是浏览器上下文。 */
  fx.works.unshift({
    _saveKey: 'xhs-e2e-1', type: 'xhs-content', _contentResult: true, mediaSkillId: 'image.xhs_note',
    title: '厦门 3 天 2 夜攻略', body_text: '第一天……', _inputText: '厦门 3 天 2 夜旅游攻略',
    cover_url: '/images/visual-recipes/cases/free-glass-whale.png',
    image_urls: ['/images/visual-recipes/cases/free-glass-whale.png'],
    createdAt: new Date().toISOString(),
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.media-workbench-panel textarea', { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.click('.media-workbench-tabs button:nth-child(2)');
  await page.waitForSelector('.skill-history-item', { timeout: 10000 });
  const xhsHistory = await page.evaluate(() => ({
    title: document.querySelector('.skill-history-item .media-case-card-title')?.textContent || '',
    cover: Boolean(document.querySelector('.skill-history-item .media-case-card-cover img')),
    actions: Array.from(document.querySelectorAll('.skill-history-item .skill-history-actions button')).map(node => node.textContent),
  }));
  check(xhsHistory.title.includes('厦门 3 天 2 夜'), '图文作品出现在这条技能的历史里', xhsHistory.title);
  check(xhsHistory.cover, '图文作品的封面真的取到了（cover_url / image_urls 解析正确）');
  check(xhsHistory.actions.includes('用这组参数'), '图文历史也能还原（还原的是那句话）', JSON.stringify(xhsHistory.actions));
  await page.click('.skill-history-item .skill-history-reuse');
  await page.waitForTimeout(400);
  const xhsRestored = await page.evaluate(() => ({
    text: document.querySelector('.media-workbench-panel textarea')?.value || '',
    notice: document.querySelector('.media-run-notice')?.textContent || '',
  }));
  check(xhsRestored.text.includes('厦门 3 天 2 夜'), '提示词还原回图文输入框', xhsRestored.text.slice(0, 30));
  check(xhsRestored.notice.includes('重新计费'), '明确告诉用户会重新计费', xhsRestored.notice.slice(0, 30));

  /* ═══ ⑬ 首页「精选推荐」按钮行：按板块给按钮、悬停出预览、点击进子页面 ═══
     用户 9-17 口径：「把它们做成案例给做进去，就是按钮的形式，然后鼠标放到这些按钮上，
     它就会有那种预览框，然后用户点击这些按钮就会直接进入到他们对应的 Skill 页面里面去。」
     ⚠️ 以前这里把图片与视频混在一条里 —— 视频模式下首页出现的是四张**图片**技能卡（实测抓到过）。 */
  scenario('⑬ 首页精选推荐按钮行（按板块 / 悬停预览 / 点击进子页面）');
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.skill-entry-row .skill-entry-button', { timeout: 20000 });
  await page.waitForTimeout(500);
  const videoRow = await page.evaluate(() => ({
    board: document.querySelector('.skill-entry-row')?.dataset.board || '',
    head: document.querySelector('.skill-entry-head h2')?.textContent || '',
    buttons: Array.from(document.querySelectorAll('.skill-entry-button')).map(node => node.textContent.replace(/\s+/g, ' ').trim()),
    more: document.querySelector('.skill-entry-more')?.textContent || '',
  }));
  check(videoRow.board === 'video', '视频模式下按钮行是**视频板块**的', videoRow.board + ' / ' + videoRow.head);
  check(videoRow.buttons.length >= 4, '视频板块下面有若干精选按钮（案例没到位也照样有入口）', JSON.stringify(videoRow.buttons));
  check(!videoRow.buttons.some(text => /海报设计|白底商品图|电商商品套图/.test(text)), '视频板块下面**不许**出现图片技能', JSON.stringify(videoRow.buttons));
  check(videoRow.more.includes('查看全部'), '右侧有「查看全部」进总页面', videoRow.more);

  /* 悬停出预览框：有案例的技能显示案例（视频优先），没有案例的如实写"案例补充中" */
  await page.hover('.skill-entry-button');
  await page.waitForTimeout(400);
  const hoverPreview = await page.evaluate(() => {
    const node = document.querySelector('.skill-entry-preview');
    return {
      present: Boolean(node),
      title: node?.querySelector('strong')?.textContent || '',
      media: node?.querySelector('video') ? 'video' : (node?.querySelector('img') ? 'img' : (node?.querySelector('.skill-entry-preview-blank') ? 'blank' : 'none')),
      cta: node?.querySelector('em')?.textContent || '',
    };
  });
  check(hoverPreview.present, '鼠标放上去出现预览框');
  check(hoverPreview.media !== 'none', '预览框里必须有明确下落（案例视频 / 案例图 / 案例补充中），不许空一块', hoverPreview.media);
  check(hoverPreview.cta.includes('进入'), '预览框里说清"点一下会发生什么"', hoverPreview.cta);

  /* 点第一个按钮 → 进它的子页面（地址、标题、返回都要对） */
  const firstVideo = videoRow.buttons[0].replace(/需参考素材|即将上线/g, '').trim();
  await page.click('.skill-entry-button');
  await page.waitForSelector('.media-workbench-head h2', { timeout: 20000 });
  const landed = await page.evaluate(() => ({
    url: location.pathname + location.search,
    title: document.querySelector('.media-workbench-head h2')?.textContent || '',
    back: Boolean(document.querySelector('.media-workbench-back')),
    hub: Boolean(document.querySelector('.media-hub')),
  }));
  check(/^\/(image|video)-creation\?id=/.test(landed.url), '点精选按钮进的是**它自己的子页面**（不是画布、不是别的板块）', landed.url);
  check(landed.url.startsWith('/video-creation?id='), '视频板块的按钮进的是视频子页面', landed.url);
  check(landed.title === firstVideo, '进去的就是点的那一条技能', landed.title + ' vs ' + firstVideo);
  check(!landed.hub, '不会掉回 Hub');
  check(landed.back, '子页面有"返回创作"，能回到 Hub');

  /* 切到图片板块：按钮必须跟着换成图片技能（同一条规则，两个板块） */
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.skill-entry-row .skill-entry-button', { timeout: 20000 });
  await page.click('.homepage-mode-card.card-2');
  await page.waitForTimeout(1200);
  const imageRow = await page.evaluate(() => ({
    board: document.querySelector('.skill-entry-row')?.dataset.board || '',
    buttons: Array.from(document.querySelectorAll('.skill-entry-button')).map(node => node.textContent.replace(/\s+/g, ' ').trim()),
  }));
  check(imageRow.board === 'image', '图片模式下按钮行是**图片板块**的', imageRow.board);
  check(imageRow.buttons.some(text => /自由创作|海报设计/.test(text)), '图片板块下面是图片技能', JSON.stringify(imageRow.buttons));
  check(!imageRow.buttons.some(text => /智能成片|首尾帧|图生视频/.test(text)), '图片板块下面**不许**出现视频技能', JSON.stringify(imageRow.buttons));
  /* 悬停一个**有案例封面**的技能 → 预览必须真的取到那张图（不是空框） */
  await page.hover('.skill-entry-item:nth-child(2) .skill-entry-button');
  await page.waitForTimeout(400);
  const covered = await page.evaluate(() => {
    const node = document.querySelector('.skill-entry-preview');
    const img = node?.querySelector('img');
    return { media: node?.querySelector('video') ? 'video' : (img ? 'img' : 'blank'), src: img?.getAttribute('src') || '' };
  });
  check(covered.media === 'img' && covered.src.startsWith('/images/'), '有案例的技能，预览框里就是那条技能的案例图', JSON.stringify(covered));

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

  /* ═══ ⑱ 左侧一级导航直达技能子页面（不是切回首页内联模块）═══ */
  scenario('⑱ 左侧导航直达技能子页面');
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('#creative-nav-trigger-visual', { timeout: 20000 });
  await page.click('#creative-nav-trigger-visual');
  await page.waitForSelector('#creative-nav-item-visual-1', { timeout: 10000 });
  await page.click('#creative-nav-item-visual-1');
  await page.waitForSelector('.media-workbench-head h2', { timeout: 20000 });
  await page.waitForTimeout(500);
  const posterLanding = await page.evaluate(() => ({
    url: location.pathname + location.search,
    title: document.querySelector('.media-workbench-head h2')?.textContent || '',
    back: Boolean(document.querySelector('.media-workbench-back')),
    cta: document.querySelector('.media-workbench-submit')?.textContent || '',
  }));
  check(posterLanding.url === '/image-creation?id=image.poster', '点「海报设计」进的是**它自己的子页面**', posterLanding.url);
  check(posterLanding.title.includes('海报'), '进去的就是点的那条技能', posterLanding.title);
  check(posterLanding.back, '子页面能返回创作');
  check(posterLanding.cta.includes('立即生成'), '图片技能就地生成（CTA 就在这一页）', posterLanding.cta);

  /* 视频域：点进去要落在**嵌好的视频工作台**上，而不是首页的视频模块 */
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'load', timeout: 40000 });
  await page.click('#creative-nav-trigger-video');
  await page.waitForSelector('#creative-nav-item-video-0', { timeout: 10000 });
  await page.click('#creative-nav-item-video-0');
  await page.waitForSelector('.media-workbench-panel .video-studio-page', { timeout: 20000 });
  await page.waitForTimeout(600);
  const videoLanding = await page.evaluate(() => ({
    url: location.pathname + location.search,
    mode: document.querySelector('.video-mode-tabs button.is-selected strong')?.textContent || '',
    resultStage: Boolean(document.querySelector('.video-result-workbench')),
  }));
  check(videoLanding.url === '/video-creation?id=video.smart', '点「视频生成」进的是视频子页面', videoLanding.url);
  check(videoLanding.mode.includes('智能成片'), '进去就落在对应的创作方式上', videoLanding.mode);
  check(videoLanding.resultStage, '结果台也在（生成完就地看，不跳画布）');

  /* 领域名本身仍然只负责**展开面板**（不下发、不跳转）：
     这条是用户 9-13 定的（点领域名就把菜单钉住，别自作主张启动第一个子项），
     收敛架构时一并保留 —— 所以这里断言"点了它不会把人带走"。 */
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'load', timeout: 40000 });
  await page.click('#creative-nav-trigger-commerce');
  await page.waitForSelector('.creative-nav-panel', { timeout: 10000 });
  await page.waitForTimeout(600);
  const triggerState = await page.evaluate(() => ({
    url: location.pathname + location.search,
    expanded: document.querySelector('#creative-nav-trigger-commerce')?.getAttribute('aria-expanded') || '',
    items: Array.from(document.querySelectorAll('#creative-nav-panel-commerce .creative-nav-link strong')).map(node => node.textContent),
  }));
  check(triggerState.url === '/', '点领域名只展开面板，不会把人带走', triggerState.url);
  check(triggerState.expanded === 'true', '面板确实展开了', triggerState.expanded);
  check(triggerState.items.length >= 2, '面板里列出这个领域的全部能力', JSON.stringify(triggerState.items));

  /* ═══ ⑱b 已经在媒体页上时，导航还要把人带到**正确的技能**上 ═══
     两个总页面共用同一个组件（App.pageMap 两处指向 MediaCreationPage，key 是 _workVersion
     而不是 page），所以跨板块跳转时组件**不会重挂载**，skillId 会停在上一块的值。
     症状极具迷惑性：地址栏已经是 /video-creation?id=video.smart，页面却显示视频 Hub，
     而且没有"返回创作"可点 —— 用户只会说"点了没反应"。 */
  scenario('⑱b 媒体页之间跳转：地址栏与页面内容必须一致');
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation?id=image.poster', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-workbench-head h2', { timeout: 20000 });
  await page.waitForTimeout(400);
  const navTo = async (group, index) => {
    await page.click('#creative-nav-trigger-' + group);
    await page.waitForSelector('#creative-nav-item-' + group + '-' + index, { timeout: 10000 });
    await page.click('#creative-nav-item-' + group + '-' + index);
    await page.waitForTimeout(1100);
  };
  const pageState = () => page.evaluate(() => ({
    url: location.pathname + location.search,
    title: document.querySelector('.media-workbench-head h2')?.textContent || '',
    hub: Boolean(document.querySelector('.media-hub')),
    videoComposer: Boolean(document.querySelector('.media-workbench-panel .video-studio-page')),
    missing: document.querySelector('.media-workbench-missing')?.textContent || '',
  }));
  const posterState = await pageState();
  check(posterState.title.includes('海报'), '起点确实是海报子页面', posterState.title);

  /* 跨板块：图片 → 视频（组件不重挂载的那条路） */
  await navTo('video', 0);
  const crossBoard = await pageState();
  check(crossBoard.url === '/video-creation?id=video.smart', '跨板块跳转后地址栏是视频技能', crossBoard.url);
  check(!crossBoard.hub, '页面**不能**停在 Hub（地址栏说是技能、页面却是 Hub 就是自相矛盾）', JSON.stringify(crossBoard));
  check(crossBoard.title.includes('智能成片'), '落到的是那条视频技能的子页面', crossBoard.title);
  check(crossBoard.videoComposer, '并且视频工作台真的嵌进来了');

  /* 同板块：视频 → 图片的另一条技能 */
  await navTo('visual', 0);
  const backToImage = await pageState();
  check(backToImage.url === '/image-creation?id=image.free', '同板块内换技能后地址栏正确', backToImage.url);
  check(backToImage.title.includes('自由创作'), '页面跟着换到那条技能', backToImage.title);
  check(!backToImage.hub, '同板块换技能也不会掉回 Hub');

  /* 脏链接：地址栏里是一个不属于这个板块的技能 id → 地址栏要改回 Hub（不留矛盾状态） */
  await page.goto('http://127.0.0.1:' + PORT + '/video-creation?id=image.poster', { waitUntil: 'load', timeout: 40000 });
  await page.waitForTimeout(1200);
  const dirty = await pageState();
  check(dirty.url === '/video-creation', '脏链接（技能不属于这个板块）会把地址栏改回 Hub', dirty.url);
  check(dirty.hub, '并且如实显示 Hub', String(dirty.hub));

  /* ═══ ⑲ 全量扫描：每一条技能都要能进子页面、能配齐、能发出**合法**请求 ═══
     为什么要有这一条：上面那些场景只压了 3 条技能（白底图 / 套图 / 图文）。
     其余 19 条图片技能如果字段→引擎的翻译写错了，静态断言看不出来
     （服务端对非法值是**静默回落**的：ratio→1:1、resolution→2K、skill_id→free，
      用户看到的是"生成成功但不是我选的东西"），只有真点一遍才知道。
     所以这里把**声明源里的每一条**都走一遍：进页面 → 通用配齐 → 点生成 → 校验请求体。
     仍然零额度：上游全部打桩。 */
  scenario('⑲ 全量扫描：22 条图片技能 + 7 条视频技能');
  const CONTRACT = {
    model: new Set(['image2']),
    ratio: new Set(['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3']),
    resolution: new Set(['1K', '2K', '4K']),
    skill: new Set(['free', 'poster', 'social-cover', 'brand-kv']),
  };
  /* 请求体合法性的**唯一判据**（下面还要拿反例自证它抓得住）——
     这些正是服务端会**静默回落**的字段：写错了不会报错，只会"生成成功但不是我选的东西"。 */
  const contractProblem = (body, { hasUpload = false } = {}) => {
    if (!CONTRACT.model.has(body.image_model)) return '模型不在白名单：' + body.image_model;
    if (!CONTRACT.ratio.has(body.ratio)) return '比例非法：' + body.ratio;
    if (!CONTRACT.resolution.has(body.resolution)) return '清晰度非法：' + body.resolution;
    if (body.creation_intent !== 'visual') return 'creation_intent 必须是 visual，实际 ' + body.creation_intent;
    if (!CONTRACT.skill.has(body.skill_id)) return 'skill_id 不在服务端白名单：' + body.skill_id;
    if (/\{\{/.test(String(body.prompt || ''))) return '提示词里残留占位符：' + String(body.prompt).slice(0, 80);
    if (!/^canvas-[0-9a-f]+$/.test(String(body.request_key || ''))) return 'request_key 形状不对：' + body.request_key;
    if (!body.billing_quote_id || !body.billing_action_id) return '没带报价（先报价后扣费）';
    if (hasUpload && !body.image_url) return '有上传位但 image_url 是空的';
    return '';
  };
  const sweep = async skill => {
    const before = calls.regenerate.length;
    const result = { id: skill.id, problem: '', sent: null };
    try {
      await page.goto('http://127.0.0.1:' + PORT + '/image-creation?id=' + encodeURIComponent(skill.id), { waitUntil: 'load', timeout: 40000 });
      await page.waitForTimeout(650);
      const shape = await page.evaluate(() => ({
        hub: Boolean(document.querySelector('.media-hub')),
        missing: document.querySelector('.media-workbench-missing')?.textContent || '',
        panel: Boolean(document.querySelector('.media-workbench-panel')),
        title: document.querySelector('.media-workbench-head h2')?.textContent || '',
        points: document.querySelector('.media-workbench-points')?.textContent || '',
        uploads: document.querySelectorAll('.media-field-upload input[type=file]').length,
      }));
      if (shape.hub) { result.problem = '落到了 Hub（技能没被解析出来）'; return result; }
      if (shape.missing) { result.problem = '页面说找不到这条技能：' + shape.missing; return result; }
      if (shape.title !== skill.name) { result.problem = '页面标题对不上：' + shape.title + ' ≠ ' + skill.name; return result; }
      if (shape.panel) { result.problem = ''; result.panel = true; return result; }
      /* 通用配齐：上传位放图、输入位写字、下拉选第一项、分段控件没选中就点第一个 */
      if (shape.uploads) {
        await page.setInputFiles('.media-field-upload input[type=file]', UPLOAD_FILE);
        await page.waitForFunction(() => !document.querySelector('.media-asset-card-progress'), null, { timeout: 15000 }).catch(() => {});
      }
      for (const input of await page.$$('.media-workbench-fields textarea[id^="field-"], .media-workbench-fields input[id^="field-"]')) {
        await input.fill('E2E 扫描：一件白色陶瓷杯，柔和棚拍光').catch(() => {});
      }
      for (const select of await page.$$('.media-workbench-fields select[id^="field-"]')) {
        const options = await select.$$eval('option', nodes => nodes.map(node => node.value).filter(Boolean));
        if (options.length) await select.selectOption(options[Math.min(1, options.length - 1)]).catch(() => {});
      }
      await page.evaluate(() => {
        document.querySelectorAll('.media-workbench-fields .media-field-segmented').forEach(group => {
          if (!group.querySelector('button.is-active')) group.querySelector('button')?.click();
        });
      });
      await page.waitForTimeout(220);
      const gate = await page.evaluate(() => ({
        disabled: document.querySelector('.media-workbench-submit')?.disabled ?? null,
        hint: document.querySelector('.media-workbench-cta-hint')?.textContent || '',
      }));
      if (gate.disabled) { result.problem = '配齐之后 CTA 仍然是禁用：' + (gate.hint || '(无提示)'); return result; }
      /* 套图是另一条钱路，已在 ⑯ 单独压过，这里只确认它报价正常 */
      if (skill.pipeline === 'ecommerceSuite') {
        result.suite = true;
        if (!/\d+ 积分/.test(shape.points)) result.problem = '套图没有显示按套总价：' + shape.points;
        return result;
      }
      await page.click('.media-workbench-submit');
      await page.waitForFunction(() => document.querySelectorAll('.media-run-slot img').length > 0, null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(300);
      const landed = await page.evaluate(() => document.querySelectorAll('.media-run-slot img').length);
      if (!landed) { result.problem = '请求发了但结果没落到工作台'; return result; }
      if (calls.regenerate.length !== before + 1) { result.problem = '这一次点击发了 ' + (calls.regenerate.length - before) + ' 次请求'; return result; }
      const body = calls.regenerate[calls.regenerate.length - 1] || {};
      result.sent = body;
      result.problem = contractProblem(body, { hasUpload: shape.uploads > 0 });
    } catch (error) {
      result.problem = '抛错：' + String(error?.message || error).slice(0, 120);
    }
    return result;
  };
  /* 自证：判据抓得住坏请求体，也不会误伤好请求体 ——
     否则"全绿"可能只是判据什么都没查（本项目已有过同类教训）。 */
  const good = { image_model: 'image2', ratio: '1:1', resolution: '2K', creation_intent: 'visual', skill_id: 'free', prompt: '一件白色陶瓷杯', request_key: 'canvas-abc123', billing_quote_id: 'q', billing_action_id: 'a' };
  check(contractProblem(good) === '', '自证：合法请求体被判通过');
  for (const [label, patch] of [
    ['模型写错', { image_model: 'image9' }],
    ['比例非法', { ratio: '1:5' }],
    ['skill_id 不在白名单', { skill_id: 'nope' }],
    ['提示词残留占位符', { prompt: '画一张 {{主题}}' }],
    ['没带报价', { billing_quote_id: '' }],
    ['有上传位却没有 image_url', { image_url: '' }],
  ]) {
    check(contractProblem({ ...good, ...patch }, { hasUpload: label.includes('image_url') }) !== '',
      '自证：' + label + '必须被判红');
  }
  const sweepRows = [];
  for (const skill of IMAGE_SKILLS) sweepRows.push(await sweep(skill));
  const broken = sweepRows.filter(row => row.problem);
  /* 覆盖面自证：每一条技能都必须落进三档之一（就地生成 / 嵌入工作台 / 按套报价），
     没有第四种"说不上来"的状态 —— 那正是以前 CTA 点了没反应的那一类。 */
  const classified = sweepRows.filter(row => row.sent || row.panel || row.suite);
  check(classified.length === IMAGE_SKILLS.length, '每条图片技能都归入了明确的一档（就地/嵌入/套图）',
    classified.length + '/' + IMAGE_SKILLS.length);
  check(broken.length === 0, '每条图片技能都能进子页面、配齐、发出合法请求并拿到结果',
    broken.map(row => row.id + '：' + row.problem).join(' ｜ ').slice(0, 400));
  const generated = sweepRows.filter(row => row.sent);
  check(generated.length >= IMAGE_SKILLS.length - 3, '绝大多数技能是**就地生成**（其余是套图与嵌进来的工作台）', String(generated.length));
  check(generated.every(row => row.sent.image_model === 'image2'), '所有请求都用有出图记录的 image2');
  check(sweepRows.filter(row => row.suite).length === 1, '套图那条仍然按套报价（没有掉进单图分支）');

  /* 视频侧同理：7 条视频技能都要能进自己的子页面、落在自己的创作方式上 */
  const videoSweep = [];
  for (const skill of VIDEO_SKILLS) {
    const row = { id: skill.id, problem: '' };
    try {
      await page.goto('http://127.0.0.1:' + PORT + '/video-creation?id=' + encodeURIComponent(skill.id), { waitUntil: 'load', timeout: 40000 });
      await page.waitForSelector('.media-workbench-panel .video-studio-page', { timeout: 20000 });
      await page.waitForTimeout(350);
      const shape = await page.evaluate(() => ({
        title: document.querySelector('.media-workbench-head h2')?.textContent || '',
        mode: document.querySelector('.video-mode-tabs button.is-selected strong')?.textContent || '',
      }));
      row.mode = shape.mode;
      if (shape.title !== skill.name) row.problem = '页面标题对不上：' + shape.title + ' ≠ ' + skill.name;
      else if (!shape.mode) row.problem = '创作方式页签没有选中项（initialMode 没落上）';
    } catch (error) {
      row.problem = '抛错：' + String(error?.message || error).slice(0, 100);
    }
    videoSweep.push(row);
  }
  const videoBroken = videoSweep.filter(row => row.problem);
  check(videoSweep.length === VIDEO_SKILLS.length, '扫描覆盖了声明源里的每一条视频技能', videoSweep.length + '/' + VIDEO_SKILLS.length);
  check(videoBroken.length === 0, '每条视频技能都能进子页面并落在自己的创作方式上',
    videoBroken.map(row => row.id + '：' + row.problem).join(' ｜ ').slice(0, 300));
  /* 映射本身由 skillRun 说了算：页面选中的页签必须就是 skillVideoMode 算出来的那个 */
  const expectedMode = new Map(VIDEO_SKILLS.map(skill => [skill.id, skillVideoMode(skill)]));
  const modeMismatch = videoSweep.filter(row => row.mode && expectedMode.get(row.id) &&
    !row.mode.includes({ smart: '智能成片', frame: '首尾帧', remake: '爆款重构' }[expectedMode.get(row.id)] || ''));
  check(modeMismatch.length === 0, '页签与 skillRun 的映射一致（不是各写一份）',
    modeMismatch.map(row => row.id + '→' + row.mode).join(' ｜ '));

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