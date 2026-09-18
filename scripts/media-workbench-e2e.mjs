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
const calls = { assets: 0, assetRole: '', regenerate: [], status: 0, quote: [], saveWork: [], session: 0, suite: [], suitePoll: 0, deleteWork: [], videoJob: 0, recognize: [] };

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
    /* 一键解析（付费前置动作，0.2 积分 = SKU ec_ai_assistant）。上游打桩，零额度。 */
    if (path === '/api/ecommerce/auto-recognize') {
      const body = parse();
      calls.recognize.push(body);
      return json(res, 200, {
        product: { name: '白瓷马克杯 350ml', category: '家居生活', material: '骨瓷', dimensions: '9x9x10 cm' },
        skus: [{ color: '月岩白', size: '350ml', capacity: '350ml', dimLabel: '9x9x10cm' }],
        style_skill: 'premium_minimal',
        maintenance: '可用洗碗机清洗',
      });
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
/* ═══ 2026-09-19 批 I-9：端到端跑在 prefers-reduced-motion: reduce 下 ═══════════════════════
   症状：场景里点「示例 / 历史」页签偶发 `page.click: element is not stable`，30 秒超时
   （同一版本独立跑两次能过、在 precommit 里又红 —— 典型的时序型 flake，不是功能坏了）。
   根因是页面里有**持续运行**的动效：案例区的视频预览在播、出图槽位在陆续落图、
   首页模式卡有入场动画 —— Playwright 的"元素稳定"判据要求连续两帧位置不变，
   在这种页面上可能永远不成立。
   改法：端到端统一按「减少动效」跑（站点本来就实现了这套覆盖，见各处 prefers-reduced-motion），
   动效停下来，稳定性判据自然成立 —— 这是**关掉噪声**，不是**跳过检查**：
   元素可见性、可点性、是否被别的元素挡住（那正是之前粘顶栏那个真 bug 的抓手）一条都没绕过。 */
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
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
    /* 视频提示词是 contentEditable 的 div（mention-prompt-field），读 textContent */
    prompt: document.querySelector('.video-prompt-mentions')?.textContent || '',
  }));
  check(videoState.composer, '视频工作台整块嵌进了子页面（不是又写一个壳）');
  /* 用户口径：skill = 一个具体玩法，进子页面就该看到"这条玩法该怎么拍"，
     而不是一个空白输入框 + 一个名字。所以每条视频技能的配方提示词必须被预填进创作台。 */
  check(videoState.prompt.includes('开场 1 秒'), '进子页面就把这条玩法的配方提示词预填进创作台', videoState.prompt.slice(0, 40));
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
    /* ⚠️ 2026-09-19 批 I-⑦：素材区标题那行文字被用户**整行删除**了
       （批注 #1-3「不要冲突啊」+ #1-7「这里也不该有文字啊，上面选中切换区就好了呀」），
       所以判据不能再读那句提示。换成读**首尾帧那两格本身** ——
       这比原来更强：原来只看一句文案有没有跟着换，现在看的是界面结构真的换成了两格。 */
    frameDeck: document.querySelector('.video-media-deck.is-frame')?.textContent || '',
    prompt: document.querySelector('.video-prompt-mentions')?.textContent || '',
  }));
  check(frameMode.active.includes('首尾帧'), '另一条视频技能落在自己的页签上', frameMode.active);
  check(frameMode.frameDeck.includes('首帧') && frameMode.frameDeck.includes('尾帧'), '素材区跟着这条链路走（真的换成首帧 + 尾帧两格，不是只换一句文案）', frameMode.frameDeck.slice(0, 60));
  check(frameMode.prompt.includes('第一张图作为镜头起点'), '换一条技能，预填的配方提示词也跟着换（不是一句写死的话）', frameMode.prompt.slice(0, 40));

  /* 建筑家装（用户 9-17 明确要求做的一档）：子页面 + 工作台 + 配方提示词都要在 */
  await openVideoSkill('video.floorplan_grow');
  const archMode = await page.evaluate(() => ({
    title: document.querySelector('.media-workbench-head h2')?.textContent || '',
    prompt: document.querySelector('.video-prompt-mentions')?.textContent || '',
    composer: Boolean(document.querySelector('.media-workbench-panel .video-studio-page')),
  }));
  check(archMode.title.includes('户型生长'), '建筑家装技能有自己的子页面', archMode.title);
  check(archMode.composer, '建筑家装技能的工作台就是嵌进来的创作台', String(archMode.composer));
  check(archMode.prompt.includes('户型图开始生长出三维空间'), '建筑家装技能预填自己的配方提示词', archMode.prompt.slice(0, 40));

  /* ═══ 视频侧的融合控件：运镜 / 只改一个元素（辅助能力长在创作台里）═══
     这两条在技能库里的身份是"辅助能力"（video.camera_move / video.scene_edit）——
     它们不是一个独立的活儿，而是创作时的两个控制项，所以必须长在这个创作台上。 */
  await openVideoSkill('video.smart');
  const cameraRow = await page.evaluate(() => ({
    row: Boolean(document.querySelector('.video-fuse-row')),
    group: Array.from(document.querySelectorAll('.video-fuse-group')).map(node => node.getAttribute('aria-label')),
    moves: Array.from(document.querySelectorAll('.video-fuse-group[aria-label="运镜"] button')).map(node => node.textContent.trim()),
  }));
  check(cameraRow.row, '创作台里有融合控件行（辅助能力长在这里，不占技能入口）', String(cameraRow.row));
  check(cameraRow.group.includes('运镜'), '「运镜」是一个控制项（不是一条要单独进子页面的玩法）', cameraRow.group.join('/'));
  check(cameraRow.moves.includes('推近') && cameraRow.moves.includes('环绕'), '运镜给的是具体镜头走法（推近/拉远/环绕/平移/固定机位）', cameraRow.moves.join('/'));
  await page.click('.video-fuse-group[aria-label="运镜"] button:has-text("推近")');
  await page.waitForSelector('.video-fuse-note', { timeout: 10000 });
  const cameraNote = await page.evaluate(() => document.querySelector('.video-fuse-note')?.textContent || '');
  check(cameraNote.includes('镜头缓慢推近主体'), '选中后**照实显示**会被追加进提示词的那句话（不偷偷改用户的提示词）', cameraNote.slice(0, 40));
  check(cameraRow.group.filter(label => label === '只改一个元素').length === 0, '智能成片档不出现「只改一个元素」（没有原片可改，不给用不了的控件）');

  /* 爆款复刻/产品植入这一档才有"只改一个元素"（它的输入本来就是一条参考视频） */
  await openVideoSkill('video.product_placement');
  const editRow = await page.evaluate(() => ({
    group: Array.from(document.querySelectorAll('.video-fuse-group')).map(node => node.getAttribute('aria-label')),
    edits: Array.from(document.querySelectorAll('.video-fuse-group[aria-label="只改一个元素"] button')).map(node => node.textContent.trim()),
  }));
  check(editRow.group.includes('只改一个元素'), '基于已有成片的档位（产品植入）出现「只改一个元素」', editRow.group.join('/'));
  check(editRow.edits.includes('换发色') && editRow.edits.includes('去杂物'), '给的是具体的编辑意图（换发色/加背景物/去杂物）', editRow.edits.join('/'));

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
    head: document.querySelector('.skill-entry-nav')?.textContent || '',
    /* ⚠️ 取按钮里那行**技能名**（.skill-entry-name）。按钮里还包着图标磁贴与「试一试」
       浮层，整块 textContent 会把 CTA 文案混进技能名里。 */
    buttons: Array.from(document.querySelectorAll('.skill-entry-button .skill-entry-name')).map(node => node.textContent.replace(/\s+/g, ' ').trim()),
    more: document.querySelector('.skill-entry-more')?.textContent || '',
  }));
  check(videoRow.board === 'video', '视频模式下按钮行是**视频板块**的', videoRow.board + ' / ' + videoRow.head);
  /* ⚠️ 2026-09-19 批 J-⑦：条数 9 → **8**。用户批注 #3-3 把 flova 的热门 skill 数清楚了：
     「他们是有两行的。他们**上面是5个按钮，下面是三个按钮**。」5 + 3 = 8。 */
  check(videoRow.buttons.length === 8, '视频板块给满 8 个按钮入口（上 5 下 3）', JSON.stringify(videoRow.buttons));
  check(!videoRow.buttons.some(text => /海报设计|白底商品图|电商商品套图/.test(text)), '视频板块下面**不许**出现图片技能', JSON.stringify(videoRow.buttons));
  check(videoRow.more.includes('查看全部'), '右侧有「查看全部」进总页面', videoRow.more);

  /* ── 批 J-⑦⑧：**两行（上 5 下 3）** + 「更多 skill」在分类页签那一行的右边 ───────────
     用户批注 #3-3：「你又确实是没有看明白**他们是有两行的。他们上面是5个按钮，
     下面是三个按钮**。」批注 #4-3：「flova 是放在 **skill 的分类这个地方的右边**有个
     更多 skill 的按钮。」 */
  const rowShape = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('.skill-entry-button'));
    const byTop = new Map();
    btns.forEach(btn => {
      const top = Math.round(btn.getBoundingClientRect().top);
      byTop.set(top, (byTop.get(top) || 0) + 1);
    });
    const grid = document.querySelector('.skill-entry-buttons');
    const cats = document.querySelector('.skill-entry-categories');
    const more = document.querySelector('.skill-entry-more');
    const cr = cats?.getBoundingClientRect();
    const mr = more?.getBoundingClientRect();
    return {
      rows: Array.from(byTop.values()),
      gridDisplay: grid ? getComputedStyle(grid).display : '',
      overflowX: grid ? getComputedStyle(grid).overflowX : '',
      scrolls: grid ? grid.scrollWidth > grid.clientWidth + 1 : false,
      sameLineAsCategories: Boolean(cr && mr && Math.abs(cr.top - mr.top) < 14),
      moreRightOfCategories: Boolean(cr && mr && mr.left > cr.right - 4),
    };
  });
  check(rowShape.rows.length === 2 && rowShape.rows[0] === 5 && rowShape.rows[1] === 3,
    '热门 skill 是**两行：上 5 下 3**', JSON.stringify(rowShape.rows));
  check(rowShape.gridDisplay === 'grid' && !rowShape.scrolls && rowShape.overflowX !== 'auto',
    '折行不横滑（横向滑会把第二行藏起来）', rowShape.gridDisplay + ' overflowX=' + rowShape.overflowX);
  check(rowShape.sameLineAsCategories && rowShape.moreRightOfCategories,
    '「更多 skill」在分类页签**那一行的右边**', JSON.stringify(rowShape));

  /* ── 悬停出**预览窗**（用户批注 #3 / #4 的形态）────────────────────────────────
     ⚠️ 这里的判据整段换过：旧契约是「封面上盖毛玻璃遮罩 + 一个大按钮」——
        那是上一版的卡片形态，用户看过之后明确否掉了（原话：「鼠标放上去这些按钮，
        他们会有这个试一试的按钮出来」「鼠标放上去的话，他们就会有下面的这个预览窗出来」）。
     新契约：
       ① 悬停按钮 → 按钮下方浮出 .skill-preview（portal 到 body，fixed 定位）；
       ② 预览窗里是**左介绍 + 右案例图**（.skill-preview-copy / .skill-preview-art）；
       ③ 「试一试」长在**按钮自己**身上（.skill-entry-try），不在浮窗里；
       ④ 没有案例的技能，预览窗右栏给满 3 格并如实写「案例补充中」。 */
  const firstButton = await page.evaluate(() => {
    const btn = document.querySelector('.skill-entry-button');
    const r = btn.getBoundingClientRect();
    return { name: btn.querySelector('.skill-entry-name')?.textContent.trim() || '', height: Math.round(r.height) };
  });
  await page.hover('.skill-entry-button');
  await page.waitForTimeout(500);
  const hoverPreview = await page.evaluate(() => {
    const btn = document.querySelector('.skill-entry-button');
    const panel = document.querySelector('.skill-preview');
    const rect = panel?.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const tryNode = btn.querySelector('.skill-entry-try');
    return {
      present: Boolean(panel),
      inBody: Boolean(panel && panel.parentElement === document.body),
      position: panel ? getComputedStyle(panel).position : '',
      followBelow: rect ? Math.round(rect.top - btnRect.bottom) : null,
      hasCopy: Boolean(panel?.querySelector('.skill-preview-copy strong')),
      shots: panel ? panel.querySelectorAll('.skill-preview-shot').length : 0,
      copyText: panel?.querySelector('.skill-preview-copy p')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) || '',
      tryOnButton: Boolean(tryNode),
      tryOpacity: tryNode ? Number(getComputedStyle(tryNode).opacity) : -1,
      insidePanel: Boolean(panel?.querySelector('.skill-entry-try')),
      buttonHeight: Math.round(btnRect.height),
    };
  });
  check(hoverPreview.present, '鼠标放到按钮上浮出预览窗', JSON.stringify(hoverPreview));
  check(hoverPreview.inBody, '预览窗挂在 body 下（不被祖先的 overflow 裁掉）');
  check(hoverPreview.position === 'fixed', '预览窗是 fixed 定位', hoverPreview.position);
  check(hoverPreview.followBelow !== null && hoverPreview.followBelow >= 4 && hoverPreview.followBelow <= 18,
    '预览窗贴在按钮**正下方**（间隙 10 上下）', String(hoverPreview.followBelow));
  check(hoverPreview.hasCopy && hoverPreview.copyText.length > 4, '预览窗左栏是这条技能的介绍', hoverPreview.copyText);
  check(hoverPreview.shots === 3, '预览窗右栏是**三格**案例位（没有案例也给满三格维持版式）', String(hoverPreview.shots));
  check(hoverPreview.tryOnButton && hoverPreview.tryOpacity > 0.9 && !hoverPreview.insidePanel,
    '「试一试」长在按钮自己身上、悬停时浮出来（不在浮窗里）', 'opacity=' + hoverPreview.tryOpacity + ' inPanel=' + hoverPreview.insidePanel);
  /* 按钮是**窄按钮**不是宽卡片：高 60 上下（flova 实测 60），一整行横排 */
  check(hoverPreview.buttonHeight >= 54 && hoverPreview.buttonHeight <= 68, '按钮是窄按钮（高 60 上下）', String(hoverPreview.buttonHeight));

  /* 移开 → 有 ~300ms 的关闭延迟（flova 实测同款），不是立刻消失 */
  await page.mouse.move(6, 500);
  await page.waitForTimeout(120);
  const stillOpen = await page.evaluate(() => Boolean(document.querySelector('.skill-preview')));
  check(stillOpen, '鼠标移开后预览窗**不立刻**消失（有 ~300ms 延迟，够用户把鼠标移进去）');
  await page.waitForTimeout(900);
  const closedNow = await page.evaluate(() => Boolean(document.querySelector('.skill-preview')));
  check(!closedNow, '延迟过后预览窗自己收起来');

  /* 点按钮 → 进它的子页面（地址、标题、返回都要对） */
  const firstVideo = firstButton.name.replace(/需参考素材|即将上线/g, '').trim();
  await page.click('.skill-entry-button');
  await page.waitForSelector('.media-workbench-head h2', { timeout: 20000 });
  const landed = await page.evaluate(() => ({
    url: location.pathname + location.search,
    title: document.querySelector('.media-workbench-head h2')?.textContent || '',
    back: Boolean(document.querySelector('.topbar-back')),
    hub: Boolean(document.querySelector('.media-hub')),
  }));
  check(/^\/(image|video)-creation\?id=/.test(landed.url), '点精选按钮进的是**它自己的子页面**（不是画布、不是别的板块）', landed.url);
  check(landed.url.startsWith('/video-creation?id='), '视频板块的按钮进的是视频子页面', landed.url);
  check(landed.title === firstVideo, '进去的就是点的那一条技能', landed.title + ' vs ' + firstVideo);
  check(!landed.hub, '不会掉回 Hub');
  check(landed.back, '子页面顶栏有「返回」，能回到 Hub（批 H-8：返回控件从工作台左栏搬到顶栏，用户批注 #12）');

  /* 切到图片板块：按钮必须跟着换成图片技能（同一条规则，两个板块） */
  await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.skill-entry-row .skill-entry-button', { timeout: 20000 });
  await page.click('.homepage-mode-card.card-2');
  await page.waitForTimeout(1200);
  const imageRow = await page.evaluate(() => ({
    board: document.querySelector('.skill-entry-row')?.dataset.board || '',
    buttons: Array.from(document.querySelectorAll('.skill-entry-button .skill-entry-name')).map(node => node.textContent.replace(/\s+/g, ' ').trim()),
  }));
  check(imageRow.board === 'image', '图片模式下按钮行是**图片板块**的', imageRow.board);
  check(imageRow.buttons.length === 8, '图片板块同样给满 8 个按钮入口（上 5 下 3）', String(imageRow.buttons.length));
  check(imageRow.buttons.some(text => /商品套图|图片复刻|去除背景/.test(text)), '图片板块下面是图片技能', JSON.stringify(imageRow.buttons));
  check(!imageRow.buttons.some(text => /智能成片|首尾帧|图生视频/.test(text)), '图片板块下面**不许**出现视频技能', JSON.stringify(imageRow.buttons));
  /* 悬停一个**真的有案例封面**的技能 → 预览窗右栏必须真的取到那张图（不是空框）。
     ⚠️ 必须先**挑出有封面的那一张**再悬停：多数技能还没有案例图，
        悬停第一张往往命中的是没有封面的那张 —— 那是「测的是运气不是判据」。 */
  const coveredIndex = await page.evaluate(() => Array.from(document.querySelectorAll('.skill-entry-button'))
    .findIndex(btn => Boolean(btn.querySelector('.skill-entry-glyph img'))));
  check(coveredIndex >= 0, '图片板块的精选里至少有一条带案例（否则下面这条断言无从谈起）', String(coveredIndex));
  if (coveredIndex >= 0) {
    await page.hover('.skill-entry-button:nth-child(' + (coveredIndex + 1) + ')');
    await page.waitForTimeout(500);
    const covered = await page.evaluate(() => {
      const panel = document.querySelector('.skill-preview');
      const img = panel?.querySelector('.skill-preview-shot img');
      return { src: img?.getAttribute('src') || '', shots: panel?.querySelectorAll('.skill-preview-shot').length || 0 };
    });
    check(Boolean(covered.src) && covered.src.startsWith('/'), '有案例的技能，预览窗右栏就是它自己的案例图', JSON.stringify(covered));
  }

  /* ═══ ⑬b 两个总页面顶部的分类页签（照竞品结构：点一档只看那一档） ═══ */
  scenario('⑬b 总页面分类页签（按声明自动成档，点一档只看那一档）');
  for (const [board, pagePath] of [['image', '/image-creation'], ['video', '/video-creation']]) {
    await page.goto('http://127.0.0.1:' + PORT + pagePath, { waitUntil: 'load', timeout: 40000 });
    await page.waitForSelector('.media-hub-tabs button', { timeout: 20000 });
    await page.waitForTimeout(500);
    const all = await page.evaluate(() => ({
      tabs: Array.from(document.querySelectorAll('.media-hub-tabs button')).map(node => node.textContent.replace(/\s+/g, ' ').trim()),
      active: document.querySelector('.media-hub-tabs button.is-active')?.textContent.replace(/\s+/g, ' ').trim() || '',
      cards: document.querySelectorAll('.media-hub .media-case-card').length,
      groups: Array.from(document.querySelectorAll('.media-gallery-group h2')).map(node => node.textContent),
    }));
    check(all.tabs[0].startsWith('全部'), board + ' Hub 第一档是「全部」', all.tabs[0]);
    check(all.active === all.tabs[0], board + ' Hub 默认停在「全部」', all.active);
    check(all.tabs.length >= 3, board + ' Hub 至少有 3 档分类', JSON.stringify(all.tabs));
    /* 「全部」档的卡片数必须等于各档之和（页签不是手写清单，是声明源算出来的） */
    /* ⚠️ 条数写在档名**后面**（"精品推荐4"），所以要剥掉前导非数字 —— 剥尾部只会得到 NaN */
    const countOf = label => Number(String(label).replace(/^\D+/, '')) || 0;
    const sum = all.tabs.slice(1).reduce((total, label) => total + countOf(label), 0);
    check(sum === all.cards, board + ' Hub 各档条数之和 = 全部条数（页签由声明源算出）', sum + ' vs ' + all.cards);
    /* 点第二档 → 只剩那一组，且卡片数与该档条数一致 */
    const second = all.tabs[1];
    await page.click('.media-hub-tabs button:nth-child(2)');
    await page.waitForTimeout(350);
    const one = await page.evaluate(() => ({
      active: document.querySelector('.media-hub-tabs button.is-active')?.textContent.replace(/\s+/g, ' ').trim() || '',
      groups: Array.from(document.querySelectorAll('.media-gallery-group h2')).map(node => node.textContent),
      cards: document.querySelectorAll('.media-hub .media-case-card').length,
    }));
    check(one.active === second, board + ' Hub 点一档之后当前档正确', one.active + ' vs ' + second);
    check(one.groups.length === 1 && one.cards === countOf(second),
      board + ' Hub 只显示那一档的技能', JSON.stringify(one));
  }

  /* ═══ ⑳ 一键解析（付费前置动作，照竞品做法）═══
     竞品实测：他们的商品套图 / A+ / 详情图页都有一个「一键解析 · 0.20 积分」，
     上传商品图后点它，商品名/卖点自动填好。我们用的是现成的
     /api/ecommerce/auto-recognize（视觉识别 + LLM 结构化），计费 SKU 是既有的
     ec_ai_assistant = 200 units = 0.2 积分 —— 与竞品同价。 */
  scenario('⑳ 一键解析（0.2 积分，先报价再解析，未登录不发请求）');
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation?id=image.product_suite', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-workbench-parse', { timeout: 20000 });
  const parseButton = await page.evaluate(() => document.querySelector('.media-workbench-parse')?.textContent.replace(/\s+/g, ' ').trim() || '');
  check(parseButton.includes('一键解析') && parseButton.includes('0.2 积分'), '解析按钮上写着它要多少钱（扣费动作不许让人猜）', parseButton);
  /* 没上传就点：就地提醒，不发任何请求（更不扣费） */
  const recognizeBefore = calls.recognize.length;
  await page.click('.media-workbench-parse');
  await page.waitForTimeout(500);
  const noUpload = await page.evaluate(() => document.querySelector('.media-run-global')?.textContent || '');
  check(calls.recognize.length === recognizeBefore, '没上传商品图时点了也不发请求（不扣费）', String(calls.recognize.length - recognizeBefore));
  check(noUpload.includes('先上传'), '就地告诉用户缺什么', noUpload.slice(0, 30));

  /* 上传之后点：先报价（ec_ai_assistant）→ 再解析 → 字段自动填好 */
  await page.setInputFiles('.media-field-upload input[type=file]', UPLOAD_FILE);
  await page.waitForFunction(() => !document.querySelector('.media-asset-card-progress'), null, { timeout: 15000 });
  const quoteBefore = calls.quote.length;
  await page.click('.media-workbench-parse');
  await page.waitForFunction(() => {
    const box = document.querySelector('.media-workbench-fields textarea');
    return box && /白瓷马克杯/.test(box.value || '');
  }, null, { timeout: 20000 }).catch(() => {});
  const parsed = await page.evaluate(() => {
    const box = document.querySelector('.media-workbench-fields textarea');
    return { value: box?.value || '', notice: document.querySelector('.media-run-notice')?.textContent || '' };
  });
  const parseQuote = calls.quote[calls.quote.length - 1] || {};
  check(calls.quote.length > quoteBefore && parseQuote.sku === 'ec_ai_assistant', '解析前先报价（SKU = ec_ai_assistant）', JSON.stringify(parseQuote));
  check(calls.recognize.length === recognizeBefore + 1, '只发一次解析请求', String(calls.recognize.length - recognizeBefore));
  check(Array.isArray(calls.recognize[0]?.refShots) && calls.recognize[0].refShots.length === 1, '解析请求带上了上传的商品图', JSON.stringify(calls.recognize[0]?.refShots || []));
  check(Boolean(calls.recognize[0]?.billing_quote_id && calls.recognize[0]?.billing_action_id), '解析请求带上了报价（先报价后扣费）');
  check(parsed.value.includes('白瓷马克杯') && parsed.value.includes('家居生活'), '解析结果回填进「商品信息」字段', parsed.value.slice(0, 40));
  check(parsed.notice.includes('0.2 积分'), '告诉用户这次解析花了多少积分', parsed.notice.slice(0, 40));

  /* 未登录：只弹登录，不发解析请求（钱规矩） */
  /* ⚠️ 与场景 ⑥ 同一套做法：既阻止 initScript 再种会话，也要把已有的 sb-auth 删掉 ——
     只种 no-session 标记的话，上一页留下的会话还在，页面其实**仍然是登录态**。 */
  await page.evaluate(SUPPRESS_SEED);
  await page.evaluate(() => localStorage.removeItem('sb-auth'));
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation?id=image.product_suite', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-workbench-parse', { timeout: 20000 });
  const recognizeBeforeLogin = calls.recognize.length;
  await page.click('.media-workbench-parse');
  await page.waitForTimeout(600);
  check(calls.recognize.length === recognizeBeforeLogin, '未登录点解析：不发请求（不会偷偷扣费）');
  /* 与场景 ⑥ 用同一个选择器（登录弹窗是既有的 .ld-overlay / .ld-card，不另造一个） */
  check(await page.evaluate(() => Boolean(document.querySelector('.ld-overlay, .ld-card'))), '未登录时引导去登录');
  await page.evaluate(ALLOW_SEED);

  /* ═══ ㉑ 结果区的融合动作（辅助能力"长在主技能里"，点了不扣费）═══
     用户 9-17 口径：「有些 skill 其实是辅助作用的……融合在一些主 skill 里面，
     你自己要先深度思考他们的作用呀。」这条场景就验证"融合"是真的：
     ① 效果图类主技能出完图，结果区长出「提升质感」「再来一张相似的」；
     ② 点它**不生成、不报价**，只是把这张结果落到目标技能的素材位上；
     ③ 落位之后 CTA 立刻可点（用户只需再点一次「立即生成」，那一次才计费）。 */
  scenario('㉑ 结果区的融合动作（辅助能力长在主技能里，点了不扣费）');
  fx.regenerateMode = 'ok';
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation?id=image.interior_3d', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-workbench-submit', { timeout: 20000 });
  await upload();
  const fuseCharges = calls.regenerate.length;
  const fuseQuotes = calls.quote.length;
  await clickGenerate();
  await page.waitForSelector('.media-run-next-btn', { timeout: 20000 });
  const fuseLabels = await page.evaluate(() => Array.from(document.querySelectorAll('.media-run-next-btn')).map(node => node.textContent.replace(/\s+/g, '').trim()));
  check(fuseLabels.includes('提升质感'), '效果图类主技能的结果区长出「提升质感」（辅助能力不占独立入口，长在这里）', fuseLabels.join('/'));
  check(fuseLabels.includes('再来一张相似的'), '任何出图结果都能「再来一张相似的」', fuseLabels.join('/'));
  check(calls.regenerate.length === fuseCharges + 1, '这一步只跑了用户点的那一次生成', String(calls.regenerate.length - fuseCharges));

  await page.click('.media-run-next-btn:has-text("提升质感")');
  /* ⚠️ 等真实渲染，不等地址栏：pushState 是同步的，地址一变就断言会读到**还没重渲染**的 DOM
     （这是本脚本踩过的"假失败"老毛病：断言跑在 React 提交之前）。 */
  await page.waitForSelector('.media-run-carry', { timeout: 15000 });
  await page.waitForFunction(() => (document.querySelector('.media-workbench-head h2')?.textContent || '').includes('效果图质感提升'), null, { timeout: 15000 });
  const fused = await page.evaluate(() => ({
    title: document.querySelector('.media-workbench-head h2')?.textContent || '',
    filled: document.querySelectorAll('.media-asset-card').length,
    notice: document.querySelector('.media-run-carry')?.textContent || '',
    url: location.pathname + location.search,
  }));
  check(fused.title.includes('效果图质感提升'), '跳到了这条辅助能力的子页面（地址栏同步）', fused.url);
  check(fused.filled === 1, '刚才那张结果已经落在它的素材位上（用户不用再传一次）', String(fused.filled));
  check(fused.notice.includes('会重新计费'), '说清下一步点生成会重新计费', fused.notice.slice(0, 46));
  check(calls.regenerate.length === fuseCharges + 1, '点融合动作**没有发起生成**（钱还在用户手里）', String(calls.regenerate.length - fuseCharges));
  check(calls.quote.length === fuseQuotes + 1, '点融合动作也不额外报价（报价只跟着那次生成）', String(calls.quote.length - fuseQuotes));
  check(await ctaDisabled() === false, '素材位已就绪，用户只要再点一次「立即生成」');

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
  await page.click('.topbar-back');
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
  /* 2026-09-18 批 F：字段名照竞品改成「目标平台」（他们那一栏就叫这个）。
     判据仍然咬住**这个字段存在且在选项池里**，只是名字跟着竞品走。 */
  check(suiteBefore.labels.some(label => label.startsWith('目标平台')), '套图有「目标平台」字段（它决定套图结构与张数）', JSON.stringify(suiteBefore.labels));
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
      /* 字段名照竞品从「清晰度」改成「分辨率」（他们那一栏叫分辨率）。
         ⚠️ 这里必须同时认两种写法：这条断言守的是"还原回那次的值"，不是"字段叫什么"。 */
      clarity: (pick('分辨率') || pick('清晰度'))?.querySelector('.media-field-segmented button.is-active')?.textContent || '',
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

  /* ═══ ⑱ 左侧一级导航直达技能子页面（不是切回首页内联模块）═══
     ⚠️ 2026-09-19 批 G：域从 4 个收敛成 2 个（图片生成 / 视频生成），
        所以这里点的是 #creative-nav-trigger-image，而不是已撤掉的 …-visual / …-commerce；
        图片域的第 0 条就是「商品套图」（image.product_suite）。
        判据本身没变：点导航项要落到**它自己的技能子页面**，而不是切回首页内联模块。 */
  scenario('⑱ 左侧导航直达技能子页面');
  /* ⚠️ 2026-09-19 批 H-4：起点从首页改成图片总页面 —— 域导航（板块切换条）现在只挂在
     两个总页面/子页面上，首页有自己的两张入口卡，不再被这条用不上的导航占位。
     所以"点域导航"这件事在首页已经不存在，要先落到某个总页面。 */
  /* ⚠️ 2026-09-19 批 J-①：**板块切换条整条删除了**（用户批注 #2-1：「他们的上面……也没有那两个导航栏的」）。
     所以「点域导航第一条进子页面」这个入口不存在了 —— 现在的真实路径是：
     左导航点「图片生成」→ 落到总页面 → 点总页面上的第一条技能卡 → 进它的子页面。
     判据守的东西没变：**点进去要落到它自己的技能子页面**，不是切回首页内联模块。 */
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-case-card-hit', { timeout: 20000 });
  await page.click('.media-case-card-hit');
  await page.waitForSelector('.media-workbench-head h2', { timeout: 20000 });
  await page.waitForTimeout(500);
  const suiteLanding = await page.evaluate(() => ({
    url: location.pathname + location.search,
    title: document.querySelector('.media-workbench-head h2')?.textContent || '',
    back: Boolean(document.querySelector('.topbar-back')),
    cta: document.querySelector('.media-workbench-submit')?.textContent || '',
  }));
  check(suiteLanding.url === '/image-creation?id=image.product_suite', '点图片域第一条进的是**它自己的子页面**', suiteLanding.url);
  check(suiteLanding.title.includes('商品套图'), '进去的就是点的那条技能', suiteLanding.title);
  check(suiteLanding.back, '子页面顶栏能返回创作');
  /* ⚠️ 2026-09-19 批 I-11：按钮文案从通用的「立即生成」改成**说的是真发生的事**：
     技能自带 ctaLabel（去除背景那条就是「去除背景」）→ 否则「生成图片」。
     这条断言守的是「**CTA 就在这一页**、点下去就地出图」（不是"文案必须叫立即生成"），
     所以判据跟着改成"有一颗能点的主按钮、且它不叫『去工作台继续』"——那才是"就地"的反面。 */
  check(/生成图片|去除背景|生成预览/.test(suiteLanding.cta), '图片技能就地生成（CTA 就在这一页）', suiteLanding.cta);

  /* 视频域：点进去要落在**嵌好的视频工作台**上，而不是首页的视频模块 */
  /* 批 J-①：同上 —— 视频域从**左导航**进去，再点总页面上的第一条技能卡。 */
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation', { waitUntil: 'load', timeout: 40000 });
  await page.click('.app-sidebar-cell[title="视频生成"]');
  await page.waitForSelector('.media-case-card-hit', { timeout: 20000 });
  await page.click('.media-case-card-hit');
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
     收敛架构时一并保留 —— 所以这里断言的是「点了它不会把人带走」。 */
  /* ⚠️ 2026-09-19 批 J-①：这一小节原来压的是「点领域名只展开面板、不把人带走」。
     板块切换条整条删除之后，那个 trigger 在页面上已经不存在了 —— 再断言它等于断言一个不存在的东西。
     换成的判据**比原来更贴用户口径**：总页面上**只有一条**横条（顶栏），没有第二条导航条；
     而导航能力并没有丢 —— 两个板块的入口在左导航里（下面两条断言就是点它）。 */
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-creation', { timeout: 20000 });
  const headerState = await page.evaluate(() => ({
    url: location.pathname + location.search,
    boardBar: Boolean(document.querySelector('.app-board-bar')),
    topbarBrand: Boolean(document.querySelector('.topbar-brand')),
    sidebarBoards: Array.from(document.querySelectorAll('.app-sidebar-cell')).map(n => n.getAttribute('title')).filter(t => t === '图片生成' || t === '视频生成'),
    actionsRight: (() => { const a = document.querySelector('.topbar-actions')?.getBoundingClientRect(); return a ? Math.round(a.x) : 0; })(),
    halfWidth: Math.round(window.innerWidth / 2),
  }));
  check(headerState.url === '/image-creation', '停在图片总页面', headerState.url);
  check(!headerState.boardBar, '总页面没有第二条导航条（用户 #2-1：也没有那两个导航栏的）', String(headerState.boardBar));
  check(!headerState.topbarBrand, '总页面顶栏没有 LOGO（用户 #2-1：上面是没有左上角这个薯包AI的）', String(headerState.topbarBrand));
  check(headerState.sidebarBoards.length === 2, '两个板块的入口都在左导航里（导航能力没丢）', JSON.stringify(headerState.sidebarBoards));
  /* 判据用**相对位置**（视口的一半）而不是写死 1200 —— 断言在不同视口下都要成立。 */
  check(headerState.actionsRight > headerState.halfWidth, '积分/账户拉到右边（用户 #3-2）', headerState.actionsRight + ' vs ' + headerState.halfWidth);

  /* ═══ ⑱b 已经在媒体页上时，导航还要把人带到**正确的技能**上 ═══
     两个总页面共用同一个组件（App.pageMap 两处指向 MediaCreationPage，key 是 _workVersion
     而不是 page），所以跨板块跳转时组件**不会重挂载**，skillId 会停在上一块的值。
     症状极具迷惑性：地址栏已经是 /video-creation?id=video.smart，页面却显示视频 Hub，
     而且没有返回按钮可点 —— 用户只会说"点了没反应"。

     ⚠️ 2026-09-19 批 I-③：**分类切换条现在只在总页面上出现**（用户批注 #12 把子页面顶栏
     写死成「左 返回 / 中 名称 / 右 积分账户」，没有第三格给分类）。
     所以跨板块导航的真实用户路径变成「子页面 → 点返回 → 总页面 → 切板块」，
     navTo() 跟着走这条路径；本场景压的仍然是**跨板块跳转不重挂载**，与入口位置无关。 */
  scenario('⑱b 媒体页之间跳转：地址栏与页面内容必须一致');
  /* ⚠️ 2026-09-19 批 G：起点从 image.poster（自由创作，一级入口被用户撤掉）
     改成图片域第一条 image.product_suite。这条压的是**跨板块跳转不重挂载**，与具体技能无关。 */
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation?id=image.product_suite', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-workbench-head h2', { timeout: 20000 });
  await page.waitForTimeout(400);
  const navTo = async (group, index) => {
    /* 子页面里没有分类切换条 —— 先按顶栏的「返回」回总页面（批 I-③，见上面的说明）。 */
    if (await page.$('.topbar-back')) {
      await page.click('.topbar-back');
      /* 批 J-①：板块切换条已删，回总页面之后等的是**总页面本体**，不再是那条导航。 */
      await page.waitForSelector('.media-hub', { timeout: 15000 });
      await page.waitForTimeout(400);
    }
    /* 批 J-①：板块切换条已删 —— 跨板块从现在起走**左导航**（它本来就有这两个入口）。 */
    await page.click('.app-sidebar-cell[title="' + (group === 'video' ? '视频生成' : '图片生成') + '"]');
    await page.waitForSelector('.media-case-card-hit', { timeout: 20000 });
    await page.click('.media-case-card-hit');
    await page.waitForTimeout(1100);
  };
  const pageState = () => page.evaluate(() => ({
    url: location.pathname + location.search,
    title: document.querySelector('.media-workbench-head h2')?.textContent || '',
    hub: Boolean(document.querySelector('.media-hub')),
    videoComposer: Boolean(document.querySelector('.media-workbench-panel .video-studio-page')),
    missing: document.querySelector('.media-workbench-missing')?.textContent || '',
  }));
  const suiteState = await pageState();
  check(suiteState.title.includes('商品套图'), '起点确实是商品套图子页面', suiteState.title);

  /* 跨板块：图片 → 视频（组件不重挂载的那条路） */
  await navTo('video', 0);
  const crossBoard = await pageState();
  check(crossBoard.url === '/video-creation?id=video.smart', '跨板块跳转后地址栏是视频技能', crossBoard.url);
  check(!crossBoard.hub, '页面**不能**停在 Hub（地址栏说是技能、页面却是 Hub 就是自相矛盾）', JSON.stringify(crossBoard));
  check(crossBoard.title.includes('智能成片'), '落到的是那条视频技能的子页面', crossBoard.title);
  check(crossBoard.videoComposer, '并且视频工作台真的嵌进来了');

  /* 同板块：视频 → 图片的另一条技能（图片域第 0 条 = 商品套图） */
  await navTo('image', 0);
  const backToImage = await pageState();
  check(backToImage.url === '/image-creation?id=image.product_suite', '同板块内换技能后地址栏正确', backToImage.url);
  check(backToImage.title.includes('商品套图'), '页面跟着换到那条技能', backToImage.title);
  check(!backToImage.hub, '同板块换技能也不会掉回 Hub');

  /* 脏链接：地址栏里是一个不属于这个板块的技能 id → 地址栏要改回 Hub（不留矛盾状态） */
  await page.goto('http://127.0.0.1:' + PORT + '/video-creation?id=image.product_suite', { waitUntil: 'load', timeout: 40000 });
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
      /* ⚠️ 不许用固定 sleep 等页面：技能字段一多，650ms 就会在"标题还没渲染"时断言，
         于是出现"标题对不上"的假失败（实测踩到：5 条新技能全被判红，人工一看页面是好好的）。 */
      await page.waitForSelector('.media-workbench-head h2, .media-workbench-panel, .media-hub', { timeout: 20000 });
      await page.waitForTimeout(200);
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
      /* 通用配齐：上传位放图、输入位写字、下拉选第一项、分段控件没选中就点第一个。
         ⚠️ 每个上传位的 input 是**独立的**（accept 不同、位次不同），
            只给第一个放图会让"多个上传位都是必填"的技能（AI换装：模特图 + 衣服图）配不齐 ——
            setInputFiles 传选择器时只会命中**第一个**元素。逐位放图才叫"通用配齐"。 */
      if (shape.uploads) {
        const inputs = await page.$$('.media-field-upload input[type=file]');
        for (const input of inputs) await input.setInputFiles(UPLOAD_FILE).catch(() => {});
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
      /* ═══ 2026-09-19 批 I-9：判据从「一次点击 = 一次请求」改成「请求数 = 按钮上写的张数」══════
         原来这条压的是就地生成那条单图链路（一次点击出一张）。
         「包含模块」打通之后，A+ 内容是**勾几个模块出几张**（用户批注 #3-2：
         「选中多少个模块就是多少张」），于是一次点击会发 N 次请求 —— 这是**对的**行为，
         旧判据把它当成了错。
         ⚠️ 新判据比旧判据**更强**：旧判据只看是不是 1 次（不看钱），
            新判据要求「实际请求数」与「按钮上写的积分数」对得上 ——
            这才咬住勾几个出几张、收几张的钱这条链。 */
      const expected = Math.max(1, Number.parseInt(String(shape.points).match(/(\d+)\s*积分/)?.[1] || '1', 10));
      const fired = calls.regenerate.length - before;
      if (fired !== expected) { result.problem = '请求数 ' + fired + ' 与按钮上的积分 ' + expected + ' 对不上（勾几个出几张、收几张的钱）'; return result; }
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