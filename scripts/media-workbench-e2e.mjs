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
import { normalizeVisualSkillId } from '../server/visualCreationSkills.mjs';
import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import { nearestLegalRatio, skillVideoMode } from '../src/skills/skillRun.js';
/* 模型白名单**从目录里来**（批 R）：页面上能选的每一档，都是请求里允许出现的那几档。
   手抄一份 ['image2'] 会在目录加档时变成"页面能选、请求判非法"的假红。 */
import { SELECTABLE_IMAGE_MODELS, generationUnits } from '../src/services/imageModelCatalog.js';

const PORT = 4197;
const ROOT = resolve('dist');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp4': 'video/mp4',
};
const UPLOAD_FILE = 'public/gallery/ecommerce/baby-bottle-product-suite/01.webp';
/* 「自适应」比例那一条要的是**非正方图**：这张是 2400x1792（2048x2048 的方图下，
   自适应与回落值都是 1:1，分不出"真的按图取档"还是"其实在回落"）。 */
const ADAPTIVE_UPLOAD_FILE = 'public/images/visual-recipes/cases/free-glass-whale.png';
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
const calls = { planPreview: [], assets: 0, assetRole: '', regenerate: [], status: 0, quote: [], saveWork: [], session: 0, suite: [], suitePoll: 0, deleteWork: [], videoJob: 0, recognize: [] };

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
    /* ── 批 K-C：三步方案预览（图片侧「生成预览」/ 视频侧「代为撰写」共用）──
       打桩返回一份**固定方案**，让 e2e 能像真实用户那样把三步走完；
       ⚠️ 这是桩数据，不是线上真跑出来的结果（本站铁律：生成结果不许伪造）。 */
    if (path === '/api/plan-preview/options') {
      const surface = url.searchParams.get('surface') === 'video' ? 'video' : 'image';
      return json(res, 200, {
        surface,
        directions: [
          { key: 'business', label: '业务场景', options: [{ value: 'ecommerce', label: '电商带货', prompt: '侧重商品卖点与下单引导。' }] },
          { key: 'content', label: surface === 'video' ? '内容类型' : '画面用途', options: [{ value: 'main', label: '主图', prompt: '干净利落的主图。' }] },
          { key: 'shot', label: '拍摄方式', options: [{ value: 'studio', label: '白底棚拍', prompt: '纯白底棚拍，柔和主光。' }] },
        ],
      });
    }
    if (path === '/api/plan-preview') {
      const body = parse();
      calls.planPreview.push(body);
      return json(res, 200, {
        plan: {
          surface: body.surface === 'video' ? 'video' : 'image',
          degraded: false,
          materials: [],
          plan: {
            title: 'E2E 打桩方案',
            summary: 'E2E 打桩：一段方案概述。',
            promptText: 'E2E 打桩方案正文：一件白色陶瓷杯，柔和棚拍光。',
            steps: [{ index: 1, title: '开场', detail: '特写' }],
            notes: ['E2E 打桩数据'],
          },
        },
        billing: { charged: true, units: 500 },
      });
    }
    if (path === '/api/works') return json(res, 200, fx.works);
    if (path === '/api/ecommerce/assets') {
      if (fx.assetStatus !== 200) return json(res, fx.assetStatus, { error: '原图上传失败' });
      calls.assets += 1;
      calls.assetRole = req.headers['x-ecommerce-asset-role'] || '';
      /* ⚠️ 2026-09-21：资产地址**每次上传都不一样**（原来是固定的 'a'*64）。
         固定的地址让"上传 3 张参考图"变成"3 张一模一样的图" —— 于是
         「第 i 次运行只带第 i 张参考图」这条断言在 e2e 里**永远分不出来**（实测踩到）。
         真实服务端每次上传本来就返回不同的持久化地址，这里照真实形状来（64 位十六进制）。 */
      const assetId = calls.assets.toString(16).padStart(64, '0') + '.png';
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

/* ═══ 2026-09-19 批 O-⑥：这条脚本的「标准工作台」换了锚点 ═══════════════════════════════
   原来是 image.white_bg —— 但本批按知渔 1:1 把它改成了
   「上传图片（最好是1：1的比例）+ 抠图模式」两格（知渔「提取电商白底图」的原文形态，
   那个页面**没有比例档**），于是脚本里"比例默认值已选中"这条断言失去了对象。
   ⚠️ 该改的是**锚点**，不是把 1:1 的修复退回去（用户第 19 轮：「你抄的完全就没有对上」
      「全部去把这些子页面 1:1 的去把它们抄过来」）。
   换成 **image.material（材质细节）**：它的字段是「素材 / 重点 / 比例 / 分辨率 / 数量」——
   与原锚点（素材 / 比例 / 分辨率 / 数量）**结构最接近**：有上传位、有比例、有分辨率，
   而且那格文字不是必填 —— 这条脚本原来那批断言（缺素材禁用 / 比例默认选中 / 上传重试解禁 /
   生成契约 / 作品归档）全部继续成立，不用为了迁就字段改动去改它们要验的行为。
   ⚠️ 第一版我换成了 image.scene，它多一格**必填**的「修图指令」，于是"只传图 → CTA 仍禁用"
      （那是正确行为）把三条断言打红了；换成 image.material 之后不需要为它补特例。 */
/* ═══ 2026-09-23 批 AB：锚点第三次更换（`image.material` 已下架）══════════════════════════════
   用户本轮原话：「**image.free（自由创作）、image.material（材质细节）这两个去掉**」。
   旧锚点 image.material 正是被下架的那条，脚本 20+ 个场景全靠它，所以换锚点 —— 这仍是
   **换锚点、不是把被删的东西要回来**（与批 O-⑥ 同一条处理原则）。
   选 **image.live_ui（直播带货主图）** 的理由：它是现存技能里唯一同时具备
   「上传位 + 必填文本 + 比例 + 清晰度 + **数量**」的一条 ——
     · 上传位 → 「缺素材禁用 / 传图解禁 / 上传重试」三个场景要它；
     · 数量 stepper → 场景⑨「数量 3 就真的发 3 次」与回放用例（count: 2）要它；
     · 比例 + 清晰度 → 「比例默认已选中」与回放用例（ratio/clarity）要它。
   ⚠️ 与 image.material 的差别只有一处：它的「商品名 / 品牌名」是**必填的单行输入**，
      而旧锚点那格文字不是必填 —— 处理办法见下面 fillRequiredText（让它也填单行输入），
      这正是脚本一贯的做法：**像真实用户那样把必填项填上**，而不是把页面改回去迁就脚本。 */
const ANCHOR_SKILL_ID = 'image.live_ui';
/* 锚点的两个派生值（批 AB）：视觉模式与技能名都**从声明源取**，不在断言里写死 ——
   否则换个锚点就要改一堆字面量，那是脆的（与下面 anchorBrief 同一条做法）。 */
const anchorVisual = IMAGE_SKILLS.find(s => s.id === ANCHOR_SKILL_ID)?.visual || 'free';
const anchorName = IMAGE_SKILLS.find(s => s.id === ANCHOR_SKILL_ID)?.name || '';
const WORKBENCH = '/image-creation?id=' + ANCHOR_SKILL_ID;
const url = () => 'http://127.0.0.1:' + PORT + WORKBENCH;
const open = async () => { await page.goto(url(), { waitUntil: 'load', timeout: 40000 }); await page.waitForSelector('.media-workbench-submit', { timeout: 20000 }); await page.waitForTimeout(400); };
/* ═══ 2026-09-19 批 O-⑥：上传之后还要把**必填的文字字段**填上 ═══════════════════════════
   锚点换成 image.scene 之后（知渔「商品场景展示」同款形态），工作台多了一格必填的「修图指令」
   —— 知渔那一页的 multiText 也是**必填**（他们的 inputConfigs 里 optional=false），
   所以"只传图不写指令 → CTA 仍然禁用"是**正确行为**，不是 bug。
   这条脚本于是要像**一个真实用户**那样把它填上：填了才允许生成。 */
const fillRequiredText = async () => {
  /* 直接定位 <textarea> 本体（.media-field-textarea 是外层容器，fill 用不了） */
  const boxes = await page.$$('.media-field textarea');
  for (const box of boxes) {
    const filled = await box.evaluate(node => Boolean((node.value || '').trim()));
    if (!filled) { await box.click(); await box.fill('测试用的修图指令：浅色背景，突出产品'); }
  }
  /* 2026-09-23 批 AB：单行必填输入也要填 —— 换锚点后（image.live_ui 的「商品名 / 品牌名」）
     必填项里有单行 text。真实用户做这一页本来就要写商品名，脚本照做即可；
     不填的后果是"只传图 → CTA 仍禁用"（那是正确行为），会把断言打红 —— 属于脚本没模拟到位。 */
  const inputs = await page.$$('.media-field input[type="text"]');
  for (const input of inputs) {
    const filled = await input.evaluate(node => Boolean((node.value || '').trim()));
    if (!filled) { await input.click(); await input.fill('测试商品'); }
  }
  await page.waitForTimeout(150);
};
const upload = async () => {
  await page.setInputFiles('.media-field-upload input[type=file]', UPLOAD_FILE);
  await page.waitForSelector('.media-asset-card', { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('.media-asset-card-progress'), null, { timeout: 15000 });
  await fillRequiredText();
};
/* ═══ 2026-09-19 批 J-⑭：主按钮后面多了一道**预览确认** ═══════════════════════════════════
   用户批注 image#1：「图片的话，他在生成的配置做好之后**进行预览，然后再去生成**」。
   所以 A+内容 / 详情图这两条**预览型**技能点下去先出预览对话框，确认之后才真发请求。
   这个助手把这两步一起做掉 —— 别在每个调用点各写一遍。
   ⚠️ 套图（suite）**不叠这一层**：它自己的流程本来就是"先出方案 + 报价、确认后才跑"，
      再叠一层就是让用户连点两次确认。 */
/* ═══ 2026-09-19 批 J：顶栏返回键改用 JS 点击（避开 Playwright 的稳定性误判）══════════════
   .topbar-back 长在一条 **sticky 顶栏**上。page.click 会先等元素稳定（连续两帧 boundingBox 不变），
   实测在子页面里它**连续 56 次判不稳定**、30s 超时；而探针直接读两次 getBoundingClientRect 是
   **逐字节相同**的（x266/y32，无任何 running animation）—— 也就是说这是**判定误报**，不是元素真的在动。
   用 JS 直接 click 绕过这一层，走的是**同一个 onClick**，被检验的行为一点没少。 */
const clickBack = async () => { await page.click('.topbar-back', { force: true }); };
const clickGenerate = async () => {
  await page.click('.media-workbench-submit');
  const preview = await page.waitForSelector('[role="dialog"] button', { timeout: 1200 }).catch(() => null);
  if (preview) {
    const confirmed = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][aria-labelledby="app-dialog-title"]');
      if (!dialog) return false;
      const button = [...dialog.querySelectorAll('button')].find(node => /确认生成/.test(node.textContent || ''));
      if (!button) return false;
      button.click();
      return true;
    });
    if (confirmed) await page.waitForTimeout(300);
  }
  /* ═══ 批 K-C：预览型技能（A+内容 / 详情图）现在先出**三步方案预览** ═══════════════════
     用户第 16 轮把图片侧的「预览」升级成了与知渔「代为撰写」同源的三步流水线：
     继续生成（0.5 积分/次，先弹计费确认）→ ① 素材理解 → ② 方向与偏好 → ③ 方案预览 → 确认并应用。
     这里就按**一个真实用户会做的动作**走完它，然后再点一次 CTA 才是真出图。
     ⚠️ 模型不可用时方案会走降级（不扣费），那时第三步给的是「跳过方案，直接生成」——
        对话框若没有这个出口就是死胡同（这一条是接线时实测卡住才发现的）。 */
  if (await page.$('.plan-preview-card')) {
    /* ⚠️ 用 Playwright 自己的 click，不用 page.evaluate 里手写按钮匹配：
       上一版手写匹配在 e2e 里点不动（实测卡在计费确认页），Playwright 的 click 会等元素可点。 */
    /* 三步都走**主按钮**：确认页=继续生成、第 1/2 步=下一步、第 3 步=确认方案并应用（降级时=跳过方案，直接生成）。
       ⚠️ 不要用 button:last-child 之类的结构选择器：底部还有「重新生成方案」，
          实测结构选择器会误命中它，把流程打回计费确认页（e2e 当场卡住才发现）。 */
    await page.click('.plan-preview-card .plan-preview-btn.is-primary', { timeout: 8000 }).catch(() => {});
    await page.waitForSelector('.plan-preview-steps, .plan-preview-confirm', { timeout: 25000 }).catch(() => {});
    for (let i = 0; i < 3; i += 1) {
      if (!(await page.$('.plan-preview-card'))) break;
      await page.click('.plan-preview-card .plan-preview-btn.is-primary', { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(200);
    /* 对话框已经关掉（方案已应用 / 已跳过）才点第二次；还开着就让它照原样失败，
       别用 catch 把「对话框堵死主流程」这种真问题吞掉。 */
    if (!(await page.$('.plan-preview-card'))) await page.click('.media-workbench-submit');
  }
};
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
  /* ⚠️ 批 O-⑥：判据是「**禁用原因就近写在按钮旁、并点名缺了什么**」，
     不是"必须出现「素材」这两个字"—— 标签照知渔改过之后（上传商品图 / 上传图片…）
     绑字面量会让这条断言变成"改个字段名就红"。改成：非空 + 点名当前上传字段的 label。 */
  /* ⚠️ 批 Q：上传位的计数（0/6）现在也在标签行里（照知渔：「上传图片 0/6」同一行），
     直接取 textContent 会把计数粘进字段名（实测拿到 "素材0/6"），断言就对不上了。
     这里只取**字段名本身**：去掉必填星号与计数。 */
  const uploadLabel = await page.evaluate(() => {
    const label = document.querySelector('.media-field-label');
    if (!label) return '';
    const clone = label.cloneNode(true);
    clone.querySelectorAll('b, .media-field-count').forEach(node => node.remove());
    return clone.textContent.trim();
  });
  check(gate.hint.trim().length > 0 && uploadLabel && gate.hint.includes(uploadLabel),
    '禁用原因就写在按钮旁，且点名缺的是哪个字段', gate.hint + ' | label=' + uploadLabel);
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
  /* ⚠️ 2026-09-23 批 AB：换锚点后这条路径也要补一次「把必填文本填上」——
     这条场景是**自己直接 setInputFiles** 的（没走 upload() 助手），而新锚点
     image.live_ui 有必填的「商品名 / 品牌名」。不填的话"重试成功后 CTA 解禁"永远不成立
     （那是**正确**行为：必填没填不许生成），属于脚本没模拟到位。 */
  await fillRequiredText();
  check(await ctaDisabled() === false, '重试成功后 CTA 解禁');
  check(calls.assetRole === 'product', '上传角色按声明下发（product）', calls.assetRole);

  /* ═══ ③④ 生成：契约 + 结果留在工作台 + 自动存作品 ═══ */
  scenario('③ 生成请求符合服务端契约');
  const urlBefore = page.url();
  await clickGenerate();
  await page.waitForFunction(() => document.querySelectorAll('.media-run-slot img').length > 0, null, { timeout: 20000 });
  const body = calls.regenerate[0] || {};
  check(calls.regenerate.length === 1, '只发起 1 次生成（数量=1）', String(calls.regenerate.length));
  /* ⚠️ 批 O-⑥：原来这里写死 '白底'（旧锚点 image.white_bg 的 brief 词）。
     判据是「**提示词由 brief 真实拼出、且没有残留占位符**」，不是"必须出现某个词"——
     绑死某个词会让"换个锚点技能"变成"改一处断言"，那是脆的。改成：非空 + 无 {{占位符}} + 与声明源里这条技能的 brief 对得上。 */
  const anchorBrief = IMAGE_SKILLS.find(s => s.id === ANCHOR_SKILL_ID)?.brief || '';
  check(body.prompt && !body.prompt.includes('{{') && anchorBrief.slice(0, 12).replace(/\{\{[^}]+\}\}/g, '') !== '' 
    && body.prompt.includes(anchorBrief.split('{{')[0].trim().slice(0, 8)),
    '提示词由 brief 真实拼出且无残留占位符', String(body.prompt).slice(0, 60));
  check(/\/api\/generated-assets\/[a-f0-9]{64}\.png$/.test(String(body.image_url)), '主素材进入 image_url（图生图）', String(body.image_url));
  check(body.ratio === '1:1' && body.resolution === '2K', '比例/清晰度取声明默认值', body.ratio + '/' + body.resolution);
  check(body.image_model === 'image2', '模型是唯一有出图记录的 image2', String(body.image_model));
  /* ⚠️ 2026-09-23 批 AB：原来这里写死 `skill_id === 'free'`（那是已下架的 image.free 的视觉模式）。
     判据是「**creation_intent / skill_id 必须落在服务端白名单里**」，不是"必须等于某个词" ——
     所以改成：与声明源里这条技能的 `visual` 一致，且**用服务端自己的 normalizeVisualSkillId
     归一化后不变**（不变 = 在白名单里；被归一化成 'free' = 传了个白名单外的值，判红）。 */
  check(body.creation_intent === 'visual'
    && body.skill_id === anchorVisual
    && normalizeVisualSkillId(body.skill_id) === body.skill_id,
    'creation_intent/skill_id 在服务端白名单内',
    body.creation_intent + '/' + body.skill_id + '（声明 visual=' + anchorVisual + '）');
  check(/^canvas-[0-9a-f]+$/.test(String(body.request_key || '')), 'request_key 是稳定幂等键', String(body.request_key));
  check(Boolean(body.billing_quote_id && body.billing_action_id), '带上了报价（先报价后扣费）');
  check(calls.quote.length === 1 && calls.quote[0].sku, '报价 SKU 由模型+清晰度推出', JSON.stringify(calls.quote[0]));

  scenario('④ 结果留在工作台（不跳画布）');
  check(page.url() === urlBefore, '生成后地址没变（没有跳去画布/别的页面）', page.url());
  check(await page.evaluate(() => document.querySelectorAll('.media-run-slot img').length) === 1, '结果图直接出现在工作台右栏');
  await page.waitForFunction(() => /作品已保存|云端保存暂时失败/.test(document.querySelector('.media-run-notice')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
  const work = (calls.saveWork[0] || {}).work || {};
  check(calls.saveWork.length === 1, '完成后自动保存作品');
  check(work.mediaSkillId === ANCHOR_SKILL_ID, '作品归到这条技能名下（历史按它筛）', String(work.mediaSkillId));
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
  /* ⚠️ 批 O-⑥：种子作品原来写死 image.white_bg（旧锚点）。判据是
     「**这条技能自己的历史里能看到已保存的作品**」—— 所以要跟着锚点走，不能写死 id。 */
  fx.works = [{
    id: 'e2e-work-1', _saveKey: 'e2e-work-1', _ecResult: true, title: '直播带货主图', mediaSkillId: ANCHOR_SKILL_ID,
    createdAt: Date.now(), images: [{ url: RESULT_IMAGE, label: '直播带货主图 1' }],
    replay: { mediaSkillId: ANCHOR_SKILL_ID, panelValues: { ratio: '4:3', clarity: '4K', count: 2 } },
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
  /* 判据是「历史条目**可辨认**（技能名 + 张数/时间）」，不是"必须含「材质」两个字"—— 跟着锚点走。 */
  check(historyInfo.title.includes(anchorName), '历史条目是可辨认的（技能名 + 张数/时间）', JSON.stringify(historyInfo));
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
  /* ═══ ⑪b 关掉弹窗不丢方案 + 离开子页面要问一声（批 BX）════════════════════════════════════
     用户口径（逐字）：「怎么还有「重新生成方案」的按钮啊……生成预览方案和生成脚本这种弹窗形式的，
     应该是用户可以关掉这个弹窗，但是**再点一次这个按钮可以回到这个弹窗里面**啊，用户**退出这个
     子页面时提示他确定退出吗**，这个方案或脚本会丢失。」
     ⚠️ 这条只能真在浏览器里验：它要的正是 **React 状态有没有活下来**（组件不卸载、方案与用户改过的
        东西都还在），静态门禁读源码是读不出来的。 */
  scenario('⑪b 关掉弹窗不丢方案：再点一次入口回到同一份方案（不重新请求）');
  /* ⚠️ 这条场景要**预览型**技能（`previewStep`）——锚点 `image.live_ui` 不是。
     实测踩到过：在锚点上点 CTA 不会出弹窗，断言当场红（`点入口按钮打开的是方案预览弹窗 —— …`）。
     预览型四条里挑「概念视觉方案」：它也是这条流水线**最重**的一页（解析条目 8 行 + 21/11/1 个档位），
     ⚠️ 它的必填是「主题意象（select）+ 手法（segmented）」，所以要像真用户那样把那两格配齐
        （用同一套通用配齐逻辑：下拉选第一项、分段控件没选中就点第一个）。 */
  const PREVIEW_SKILL_ID = 'image.concept_set';
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation?id=' + PREVIEW_SKILL_ID, { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-workbench-submit', { timeout: 20000 });
  await page.waitForTimeout(400);
  const themeSelect = await page.$('.media-workbench-fields select[id^="field-"]');
  if (themeSelect) {
    const themeOptions = await themeSelect.$$eval('option', nodes => nodes.map(node => node.value).filter(Boolean));
    if (themeOptions.length) await themeSelect.selectOption(themeOptions[0]).catch(() => {});
  }
  await page.evaluate(() => {
    document.querySelectorAll('.media-workbench-fields .media-field-segmented').forEach(group => {
      if (!group.querySelector('button.is-active')) group.querySelector('button')?.click();
    });
  });
  await fillRequiredText();
  const planCallsBefore = calls.planPreview.length;
  const ctaReady = await page.evaluate(() => ({ disabled: document.querySelector('.media-workbench-submit')?.disabled ?? null }));
  check(ctaReady.disabled === false, '配齐素材与必填文字后 CTA 可点', JSON.stringify(ctaReady));
  await page.click('.media-workbench-submit');
  await page.waitForSelector('.plan-preview-card', { timeout: 15000 }).catch(() => {});
  check(Boolean(await page.$('.plan-preview-card')), '点入口按钮打开的是方案预览弹窗', page.url().slice(-26));
  await page.click('.plan-preview-card .plan-preview-btn.is-primary').catch(() => {});   /* 继续生成 */
  await page.waitForSelector('.plan-preview-steps', { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(300);
  const afterFirstPlan = calls.planPreview.length;
  check(afterFirstPlan === planCallsBefore + 1, '第一次生成预览只发 1 次方案请求', String(afterFirstPlan - planCallsBefore));
  /* 弹窗里**不该再有**「重新生成方案」，也不该有那几句内部口吻的说明（批 BX/BY 用户口径） */
  const footerText = await page.evaluate(() => document.querySelector('.plan-preview-actions')?.textContent || '');
  check(!footerText.includes('重新生成方案'), '弹窗里不再有「重新生成方案」按钮（用户点名去掉）', footerText.slice(0, 60));
  check(footerText.includes('关闭'), '步① 左边那颗是「关闭」', footerText.slice(0, 60));
  const dialogCopy = await page.evaluate(() => document.querySelector('.plan-preview-card')?.textContent || '');
  for (const banned of ['关掉不会丢', '这些档位就是', '按这条技能自己的解析方案', '可以改、可以删、可以加']) {
    check(!dialogCopy.includes(banned), '内部口吻的说明不许出现在弹窗里：' + banned, banned);
  }
  /* 再进到第三步（方案正文），记下正文，然后关掉 */
  await page.click('.plan-preview-card .plan-preview-btn.is-primary', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(200);
  await page.click('.plan-preview-card .plan-preview-btn.is-primary', { timeout: 8000 }).catch(() => {});
  await page.waitForSelector('.plan-preview-text', { timeout: 8000 }).catch(() => {});
  const planBody = await page.evaluate(() => document.querySelector('.plan-preview-text')?.value || '');
  check(planBody.includes('E2E 打桩方案正文'), '第三步能看到方案正文', planBody.slice(0, 30));
  const reopenBase = calls.planPreview.length;
  /* 关掉用的是右上角那颗 ×（用户最常用的那个"关掉这个弹窗"）——
     ⚠️ 不要用 `:not(.is-primary)` 去点左下角那颗：**第三步那颗是「上一步」**，
        点了只会往回退一格（第一次就是栽在这里："点关闭后弹窗收起来了" 判红）。 */
  await page.click('.plan-preview-close');
  await page.waitForTimeout(400);
  check(!(await page.$('.plan-preview-card')), '点「关闭」后弹窗收起来了');
  check(calls.planPreview.length === reopenBase, '关闭本身不发任何请求', String(calls.planPreview.length - reopenBase));
  /* ═══ 离开子页面要问一声（此时手上正有一份没应用的方案）═══ */
  await page.click('.topbar-back', { force: true });
  await page.waitForSelector('[role="dialog"][aria-labelledby="app-dialog-title"]', { timeout: 8000 }).catch(() => {});
  const leaveAsk = await page.evaluate(() => {
    const box = document.querySelector('[role="dialog"][aria-labelledby="app-dialog-title"]');
    return { text: box?.textContent || '', buttons: [...(box?.querySelectorAll('button') || [])].map(node => node.textContent || '') };
  });
  check(leaveAsk.text.includes('还没应用'), '带着没应用的方案点「返回」会先问一声', leaveAsk.text.slice(0, 40));
  check(leaveAsk.buttons.includes('留在这页') && leaveAsk.buttons.includes('仍然离开'), '两个选项语义明确（留下 / 仍然离开）', JSON.stringify(leaveAsk.buttons));
  await page.evaluate(() => {
    const box = document.querySelector('[role="dialog"][aria-labelledby="app-dialog-title"]');
    [...(box?.querySelectorAll('button') || [])].find(node => (node.textContent || '') === '留在这页')?.click();
  });
  await page.waitForTimeout(400);
  check(page.url().includes('id=' + PREVIEW_SKILL_ID), '选「留在这页」就真的留下（没被导航走）', page.url().slice(-30));
  /* ═══ 再点一次入口按钮：**回到同一份方案**，不重新请求 ═══ */
  await page.click('.media-workbench-submit');
  await page.waitForTimeout(600);
  const reopened = await page.evaluate(() => ({
    card: Boolean(document.querySelector('.plan-preview-card')),
    steps: Boolean(document.querySelector('.plan-preview-steps')),
    confirm: Boolean(document.querySelector('.plan-preview-confirm')),
  }));
  check(reopened.card && reopened.steps && !reopened.confirm,
    '再点一次入口按钮直接回到方案（不是又走一遍计费确认）', JSON.stringify(reopened));
  check(calls.planPreview.length === reopenBase, '回到旧方案**不重新请求、不重复扣费**', String(calls.planPreview.length - reopenBase));
  /* 收尾：把它应用掉，免得影响后面的场景（此时 CTA 才是真出图） */
  await page.click('.plan-preview-card .plan-preview-btn.is-primary', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(200);
  await page.click('.plan-preview-card .plan-preview-btn.is-primary', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(200);
  await page.click('.plan-preview-card .plan-preview-btn.is-primary', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(400);
  check(!(await page.$('.plan-preview-card')), '应用之后弹窗关掉（方案已进工作台）');

  /* ═══ ⑫ 视频技能在子页面里就地跑完（既有视频工作台整块嵌入） ═══ */
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
    activeMode: (document.querySelector('.video-mode-tabs button.is-selected strong')?.textContent || document.querySelector('.video-studio-page')?.dataset.videoMode || ''),
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
  /* ⚠️ 批 N：子页面不再显示创作方式页签（依据见下面视频侧全量扫描那一段引用的用户原话），
     读的是 <main data-video-mode>。判据不变：这一页必须落在 video.smart 对应的那一档。 */
  check(videoState.activeMode.includes('智能成片') || videoState.activeMode.includes('smart'),
    '创作方式按技能落位（video.smart → 智能成片）', videoState.activeMode);
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
    active: (document.querySelector('.video-mode-tabs button.is-selected strong')?.textContent || document.querySelector('.video-studio-page')?.dataset.videoMode || ''),
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
    title: (document.querySelector('.topbar-title')?.textContent || document.querySelector('.media-workbench-head h2')?.textContent || ''),
    /* ═══ 2026-09-19 批 N：**判据不变，锚点换了一处** ═══════════════════════════════════
       判据一个字没动 ——「进子页面就带着**这条 skill 自己的配方提示词**（不是空白）」。
       换的是观测点：批 N 起，建筑室内那一档按知渔同款页面渲染
       （知渔 /apps?id=cmra7sgh… 淋浴展示实测：**只有「参考图（要求：X图）」+「比例」两块，
         没有补充说明框**，见 docs/design/64 §8.3），所以我们也不再给这一档一个输入框。
       ⇒ 配方改读 <main class="video-studio-page" data-video-recipe="…">（页面如实挂着的当前配方）；
         有补充说明框的那几档（探店 / 爆款复刻 / 脚本型）仍然优先读输入框里的内容 ——
         两种形态同一份断言。 */
    prompt: document.querySelector('.video-prompt-mentions')?.textContent
      || document.querySelector('.video-studio-page')?.dataset.videoRecipe
      || '',
    composer: Boolean(document.querySelector('.media-workbench-panel .video-studio-page')),
  }));
  check(archMode.title.includes('户型生长'), '建筑家装技能有自己的子页面', archMode.title);
  check(archMode.composer, '建筑家装技能的工作台就是嵌进来的创作台', String(archMode.composer));
  check(archMode.prompt.includes('户型图开始生长出三维空间'), '建筑家装技能预填自己的配方提示词', archMode.prompt.slice(0, 40));

  /* ═══ 视频侧的融合控件（运镜 / 只改一个元素）—— **批 W 整组删除**（用户原话，逐字）═══════════
     原话：「第 4 条**运镜这个没必要啊，这个没有什么意思，去掉**。」
     （第 4 条指的是我在 RTK 里报的"这两行知渔没有、与你批注 15 冲突"——用户判定：去掉。）
     ⇒ 这一组断言（控件行、六档镜头走法、追加说明、只改一个元素）**整组作废**：主体已经不在页面上了。
     ⚠️ 运行层的机制没动：`workbenchExtraInstructions` 仍然按"这一页真的渲染了哪些控件"决定追加什么，
        控件没了 ⇒ 恒不追加 —— 那条判据由批 S 的 test/video-route-subpage-parity-0921 继续守着。 */
  await openVideoSkill('video.smart');
  const fuseGone = await page.evaluate(() => ({
    row: Boolean(document.querySelector('.video-fuse-row')),
    note: Boolean(document.querySelector('.video-fuse-note')),
    groups: document.querySelectorAll('.video-fuse-group').length,
  }));
  check(!fuseGone.row && !fuseGone.note && fuseGone.groups === 0,
    '运镜 / 只改一个元素整组已下线（知渔 31 个子页面里一个都没有）', JSON.stringify(fuseGone));

  /* 历史：本机标记（videoJobTags）把任务按技能筛进子页面历史。
     标记缺失时也不能丢东西 —— 全量任务永远在嵌入工作台的「生成记录」里。 */
  scenario('⑫b 视频任务按技能进子页面历史（标记缺失时也不丢任务）');
  fx.videoJobs = [{
    id: 'job-e2e-video', status: 'completed', mode: 'script', sku: 'video_seedance_standard_720p_5s',
    prompt: '白底化妆水瓶缓慢旋转，柔光扫过瓶身', duration: 5, aspectRatio: '9:16', resolution: '720p',
    resultUrl: '/images/home/workspace-video.png', progress: 100,
    /* ⚠️ 批 BZ：**真机返回里有 createdAt**（server/videoGeneration.mjs 的 `createdAt: row.created_at`），
       桩里原来漏了它 —— 于是"历史卡要带时间"这条断言拿到空值判红。
       按本仓规矩：把桩补齐成与真机一致的形状，而不是把断言放宽。 */
    createdAt: '2026-09-26 14:05:00', updatedAt: '2026-09-26 14:06:00',
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
  /* ═══ 批 BZ：视频记录**也要有时间**（用户口径：「它的排版，它的时间这些东西是不是也得加进去呢？」）
     用户看得懂的形式 = `MM-DD HH:MM`（与图片那条同一个 formatWorkTime）。 */
  check(/\d{2}-\d{2} \d{2}:\d{2}/.test(tagged.subtitle), '视频记录的副标题里带时间（与图片记录同一口径）', tagged.subtitle);
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
  /* ═══ 批 BZ：出片的那条要有「下载」；保留期那句要写在**看得见这条流的地方** ═══════════════
     用户口径：「是不是会有……**下载**的功能？」「作品保留 7 天」这条以前只写在「我的作品」工作区里，
     而结果真正被翻看的地方是这条技能的历史 —— 这里也要说，且说的是**同一个数**（服务端保留期）。 */
  check(tagged.actions.includes('下载'), '出片的历史条目有「下载」', JSON.stringify(tagged.actions));
  const retentionNote = await page.evaluate(() => document.querySelector('.skill-history-retention')?.textContent || '');
  check(/保留 \d+ 天/.test(retentionNote), '历史面板顶部如实写清保留期', retentionNote.slice(0, 40));
  /* 还原是**只回填、不扣费**：点完不许出现任何生成请求 */
  const beforeReuse = calls.regenerate.length + calls.videoJob;
  await page.click('.skill-history-item .skill-history-reuse');
  await page.waitForTimeout(600);
  const videoRestored = await page.evaluate(() => ({
    /* ⚠️ 视频提示词是 contentEditable 的 div（mention-prompt-field），不是 textarea —— 读 textContent */
    prompt: document.querySelector('.video-prompt-mentions')?.textContent || '',
    notice: document.querySelector('.media-run-notice')?.textContent || '',
    active: (document.querySelector('.video-mode-tabs button.is-selected strong')?.textContent || document.querySelector('.video-studio-page')?.dataset.videoMode || ''),
  }));
  check(videoRestored.prompt.includes('白底化妆水瓶'), '提示词还原回创作台', videoRestored.prompt.slice(0, 40));
  check(videoRestored.notice.includes('重新计费'), '明确告诉用户"确认后才会重新计费"', videoRestored.notice.slice(0, 40));
  check(videoRestored.active.includes('智能成片') || videoRestored.active.includes('smart'),
    '创作方式也跟着还原', videoRestored.active);
  check(calls.regenerate.length + calls.videoJob === beforeReuse, '「用这组参数」不产生任何扣费请求', String(calls.regenerate.length + calls.videoJob - beforeReuse));

  /* ═══ ⑫d 视频侧「代为撰写」（批 BW）══════════════════════════════════════════════════════
     用户口径：「不止是概念视觉，我们现在**所有的图片生成和视频生成的代为撰写**是不是都应该
     这么做呢，**个性化做匹配方案**啊。」以及「我不知道你的**视频生成那边是不是也全部没解决**这种问题」。
     所以这条场景不验版式，验**接线**：视频侧点「代为撰写」要把**这条 skill 的 id** 带进请求
     （服务端据此取它自己的解析方案），并且三步能走完、结论写回脚本输入框。
     ⚠️ 两个入口在不同页面上（这是**先量过才写的**，不是我猜的）：
       · 首页 / 独立创作台：输入框旁的 `.video-dawei-entry`（`!homeComposer` 时渲染）；
       · **技能子页面 = 工作台形态**：那个输入框整块不渲染，入口在工作台的付费动作里
         —— `videoWorkbenches.js` 的 `SCRIPT_ACTION`（key='script'、label=「生成脚本」），
         点它走的是同一个 `runDawei()`。第一次我把这条场景按首页那个类名写，e2e 当场红在
         `waiting for locator('.video-dawei-entry')`（超时 25s）——就是"选错了入口"。
     ⚠️ 视频提示词是 contentEditable 的 div（工作台里那份带 `.video-wb-prompt`），
        不是 textarea（Playwright 的 fill 支持 contenteditable）。 */
  scenario('⑫d 视频「代为撰写」按这条 skill 的解析方案走完三步');
  await page.goto('http://127.0.0.1:' + PORT + '/video-creation?id=video.smart', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-workbench-paid', { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(600);
  await page.locator('.video-wb-prompt').first().fill('给这款陶土杯做一条 15 秒的口播').catch(() => {});
  await page.waitForTimeout(300);
  const typedPrompt = await page.evaluate(() => document.querySelector('.video-wb-prompt')?.textContent || '');
  check(typedPrompt.includes('陶土杯'), '视频脚本输入框能写进需求（contentEditable）', typedPrompt.slice(0, 30));
  const scriptEntry = page.locator('.media-workbench-paid', { hasText: '生成脚本' }).first();
  check(await scriptEntry.count() > 0, '工作台里有「生成脚本」这颗动作（视频侧「代为撰写」的入口）');
  const beforeDawei = calls.planPreview.length;
  const videoJobsBeforeDawei = calls.videoJob;
  await scriptEntry.click({ timeout: 8000 }).catch(() => {});
  await page.waitForSelector('.plan-preview-card', { timeout: 15000 }).catch(() => {});
  check(Boolean(await page.$('.plan-preview-card')), '视频侧「代为撰写」打开的是同一个三步对话框');
  await page.click('.plan-preview-card .plan-preview-btn.is-primary').catch(() => {});
  await page.waitForSelector('.plan-preview-steps', { timeout: 25000 }).catch(() => {});
  /* ⚠️ 先前进到**步②**再读档位 —— 步① 是素材/解析条目，DOM 里根本没有 `.plan-preview-options`，
     在步① 读会永远拿到空数组（第一次就是这么红的：`✖ … —— []`）。 */
  await page.click('.plan-preview-card .plan-preview-btn.is-primary', { timeout: 8000 }).catch(() => {});
  await page.waitForSelector('.plan-preview-options', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  /* 步② 一进来就该有默认选中的档位（服务端保证第一档是中性档 / 已声明的默认值）——
     判据是"不逼用户把每一组都点一遍"，不是"必须选中某一个具体档"。 */
  const directions = await page.evaluate(() => ({
    groups: document.querySelectorAll('.plan-preview-direction').length,
    selected: Array.from(document.querySelectorAll('.plan-preview-options button.is-selected')).map(node => node.textContent || ''),
  }));
  check(directions.groups >= 1, '步② 渲染出方向组（不是空面板）', String(directions.groups));
  check(directions.selected.length >= 1, '步② 打开就有默认选中的档位（不必逐组点一遍）', JSON.stringify(directions.selected).slice(0, 80));
  await page.click('.plan-preview-card .plan-preview-btn.is-primary', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.click('.plan-preview-card .plan-preview-btn.is-primary', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
  const daweiRequest = calls.planPreview[beforeDawei] || null;
  check(calls.planPreview.length === beforeDawei + 1, '视频侧只发起 1 次方案请求', String(calls.planPreview.length - beforeDawei));
  check(daweiRequest?.skillId === 'video.smart', '视频侧把**这条 skill 的 id** 带进了请求（服务端据此取它自己的解析方案）', String(daweiRequest?.skillId));
  /* ⚠️ 批 BW：解析方案**在前端算好随请求下发**（服务端读不到 src/，见
     test/server-shipping-boundary-0926）。所以这里验的是"声明真的跟着请求走了"：
     video.smart 属于 videoSmart 族 ⇒ 4 项解析（素材内容 / 卖点 / 场景 / 节奏）+ 2 组方向档。 */
  check(Array.isArray(daweiRequest?.specItems) && daweiRequest.specItems.length === 4,
    '请求里带上了这条 skill 的解析项声明（服务端据此只问该问的）', JSON.stringify((daweiRequest?.specItems || []).map(item => item?.key)));
  check(Array.isArray(daweiRequest?.directions) && daweiRequest.directions.length === 2,
    '请求里带上了这条 skill 的方向档位', String((daweiRequest?.directions || []).length));
  check(daweiRequest?.specKey === 'videoSmart', '请求里写明了用的是哪一套解析方案', String(daweiRequest?.specKey));
  const appliedScript = await page.evaluate(() => document.querySelector('.video-wb-prompt')?.textContent || '');
  check(appliedScript.includes('E2E 打桩方案正文'), '「确认脚本并应用」把方案正文写回脚本输入框', appliedScript.slice(0, 40));
  check(calls.videoJob === videoJobsBeforeDawei, '「确认脚本并应用」只写回输入框，不发起任何生成（不扣费）', String(calls.videoJob - videoJobsBeforeDawei));

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
  check(videoRow.buttons.length === 9, '视频板块给满 9 个按钮入口（批 M：上 5 下 4）', JSON.stringify(videoRow.buttons));
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
  check(rowShape.rows.length === 2 && rowShape.rows[0] === 5 && rowShape.rows[1] === 4,
    '热门 skill 是**两行：上 5 下 4**（批 M：用户明确说 9 个，flova 实测就是 5+4）', JSON.stringify(rowShape.rows));
  /* ⚠️ 批 L-4：容器从"五列栅格"改成"flex 折行 + 居中"（用户要的是 flova 那种居中）。
     判据的**本意**不变：**折行、且不横滑**（横滑会把第二行藏起来）。所以这里接受 grid/flex 两种排布，
     真正咬住的仍是上面那条「上 5 下 3」与下面的 scrolls / overflowX。 */
  check(['grid', 'flex'].includes(rowShape.gridDisplay) && !rowShape.scrolls && rowShape.overflowX !== 'auto',
    '折行不横滑（横向滑会把第二行藏起来）', rowShape.gridDisplay + ' overflowX=' + rowShape.overflowX);
  check(rowShape.sameLineAsCategories && rowShape.moreRightOfCategories,
    '「更多 skill」在分类页签**那一行的右边**', JSON.stringify(rowShape));

  /* ── 悬停出**预览窗**（用户批注 #3 / #4 的形态）────────────────────────────────
     ⚠️ 这里的判据整段换过：旧契约是「封面上盖毛玻璃遮罩 + 一个大按钮」——
        那是上一版的卡片形态，用户看过之后明确否掉了（原话：「鼠标放上去这些按钮，
        他们会有这个试一试的按钮出来」「鼠标放上去的话，他们就会有下面的这个预览窗出来」）。
     新契约：
       ① 悬停按钮 → 按钮下方浮出 .skill-preview（portal 到 body，fixed 定位）；
       ② 预览窗里是**上图下文**（.skill-preview-art 在上、.skill-preview-body 在下）——
          2026-09-23 批 Z-② 按用户图七改的：原话「上面一张图、下面**一句话**说明 + 少量标签」，
          所以"左介绍 + 右案例图"那版判据作废；图上只留**一张**主图（16:9）；
       ③ 「试一试」长在**按钮自己**身上（.skill-entry-try），不在浮窗里；
       ④ 没有案例的技能，预览窗上图如实写「案例补充中」（不再凑三格）。 */
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
    const art = panel?.querySelector('.skill-preview-art');
    const body = panel?.querySelector('.skill-preview-body');
    /* 上图下文：图的顶沿必须在文案的顶沿**之上**（写成"上文下图"就是与原话反了） */
    const artRect = art?.getBoundingClientRect();
    const bodyRect = body?.getBoundingClientRect();
    return {
      present: Boolean(panel),
      inBody: Boolean(panel && panel.parentElement === document.body),
      position: panel ? getComputedStyle(panel).position : '',
      followBelow: rect ? Math.round(rect.top - btnRect.bottom) : null,
      hasLine: Boolean(panel?.querySelector('.skill-preview-body strong')),
      hasTags: Boolean(panel?.querySelector('.skill-preview-tags .skill-preview-tag')),
      artAboveBody: Boolean(artRect && bodyRect && artRect.top <= bodyRect.top + 1),
      shots: panel ? panel.querySelectorAll('.skill-preview-shot').length : 0,
      /* 主图里**真的取到图**的格子数（空占位不算）——用户要的是"放入对应的那种界面" */
      shotImages: panel ? panel.querySelectorAll('.skill-preview-shot img').length : 0,
      lineText: panel?.querySelector('.skill-preview-body strong')?.textContent.replace(/\s+/g, ' ').trim().slice(0, 60) || '',
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
  check(hoverPreview.hasLine && hoverPreview.lineText.length > 4, '预览窗下面有一句话说明', hoverPreview.lineText);
  check(hoverPreview.artAboveBody, '预览窗是上图下文（图在文案之上）', JSON.stringify({ artAboveBody: hoverPreview.artAboveBody }));
  check(hoverPreview.shots === 1, '主图只留一张（三格是旧两栏版式，已按用户口径作废）', String(hoverPreview.shots));
  /* ═══ 2026-09-19 用户新批注（箭头从案例区指到预览窗）═════════════════════════════════════
     原话：「你这些**预览窗里面**，放入**对应的这种界面**，看我的箭头表示」——
     预览窗的主图要放**真实的案例图**（跟下面那块案例区同一个真源），不是空框。
     所以判据是「**有真图就显示真图，没有才退回如实占位**」：
       · 有图（≥1 张 img）→ 通过；
       · 一张图都没有 → 那一格必须**如实**写「案例补充中」（不许放假图）。 */
  const shots = hoverPreview.shots;
  const realImages = hoverPreview.shotImages;
  check(
    (realImages >= 1 && shots === 1) || (realImages === 0 && shots === 1),
    '预览窗主图是真实案例图（没有素材时那一格如实占位）',
    'shots=' + shots + ' imgs=' + realImages,
  );
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
  await page.waitForSelector('.topbar-title, .media-workbench-head h2', { timeout: 20000 });
  const landed = await page.evaluate(() => ({
    url: location.pathname + location.search,
    title: (document.querySelector('.topbar-title')?.textContent || document.querySelector('.media-workbench-head h2')?.textContent || ''),
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
  check(imageRow.buttons.length === 9, '图片板块同样给满 9 个按钮入口（批 M：上 5 下 4）', String(imageRow.buttons.length));
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
    check(Boolean(covered.src) && covered.src.startsWith('/'), '有案例的技能，预览窗那张主图就是它自己的案例图', JSON.stringify(covered));
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

  /* ═══ 2026-09-23 批 AD：**辅助能力卡片点开去哪**（真浏览器验证）═════════════════════════════
     运镜控制 / 延长续写 / 画面修改 这三条按设计**没有自己的工作台**
     （门禁 video-skill-workbench-declaration-0919 ① 反而要求它们不许有）：
     它们是长在别的技能创作台上的控件 / 动作。所以"点自己"会落进通用的视频创作台 = 死胡同，
     而文案却写着"也可以直接点开单独用"。本轮把跳转改成按 belongsTo 进它所属的主技能工作台，
     这条在真实浏览器里点一次，把这个行为钉住。 */
  scenario('⑬c 辅助能力卡片点开进的是它所属的工作台（不是它自己的空白页）');
  await page.goto('http://127.0.0.1:' + PORT + '/video-creation', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-hub-tabs button', { timeout: 20000 });
  await page.waitForTimeout(400);
  const assistantGroup = await page.evaluate(() => {
    const tab = Array.from(document.querySelectorAll('.media-hub-tabs button')).find(node => node.textContent.includes('辅助能力'));
    if (tab) tab.click();
    return Boolean(tab);
  });
  check(assistantGroup, '视频 Hub 有「辅助能力」这一档');
  await page.waitForTimeout(400);
  const assistantTitles = await page.evaluate(() => Array.from(document.querySelectorAll('.media-hub .media-case-card'))
    .map(card => card.querySelector('.media-case-card-title')?.textContent.trim() || ''));
  check(assistantTitles.length >= 3, '「辅助能力」档里能看到那 3 条', JSON.stringify(assistantTitles));
  const clickedAssistant = await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('.media-hub .media-case-card'))
      .find(node => (node.querySelector('.media-case-card-title')?.textContent || '').includes('运镜控制'));
    const hit = card?.querySelector('.media-case-card-hit');
    if (hit) hit.click();
    return Boolean(hit);
  });
  check(clickedAssistant, '点到了「运镜控制」这张卡');
  await page.waitForTimeout(900);
  const assistantLanded = await page.evaluate(() => ({ url: location.pathname + location.search, hub: Boolean(document.querySelector('.media-hub')) }));
  check(!assistantLanded.hub, '点辅助能力卡片会离开 Hub（进了工作台）', assistantLanded.url);
  check(assistantLanded.url.includes('video.smart'),
    '进的是它**所属**的主技能工作台（运镜控制 → 智能成片），不是它自己的空白页', assistantLanded.url);
  check(!assistantLanded.url.includes('video.camera_move'),
    '没有落进运镜控制自己的页面（那一页没有工作台，点了等于死胡同）', assistantLanded.url);

  /* ═══ ⑳ 付费前置动作（照竞品做法）—— 批 U 改判：目标从「一键解析商品信息」换成「一键解析风格」══
     竞品实测：他们的商品套图 / A+ / 详情图页都有一个「一键解析 · 0.20 积分」。
     我们用的是现成的 /api/ecommerce/auto-recognize（视觉识别 + LLM 结构化），
     计费 SKU 是既有的 ec_ai_assistant = 200 units = 0.2 积分 —— 与竞品同价。
     ⚠️ 2026-09-21 批 U **改判（判据没变，目标变了）**：用户本轮原话
       「『产品卖点与设计风格，一键解析商品信息，0.2 积分』这个**也是多余的**呀，下面不是都有
        一键润色卖点和一键解析风格吗，**各个子页面应该都有这个问题，你要去掉呀**。」
     ⇒ 组行那一颗（`.media-workbench-parse`）**不再渲染**，所以这条场景改点同页仍在的
       「一键解析风格」（`.media-workbench-inline-action`）——它调的是**同一条上游**、
       走**同一个 SKU**，而且现在**把商品字段一并回填**（原来那颗按钮的产物并进来了）。
       场景要守的东西一条没少：钱写在按钮上 / 没输入不发请求 / 先报价后扣费 / 未登录不发请求。 */
  scenario('⑳ 付费前置动作（0.2 积分，先报价再解析，未登录不发请求）');
  const ANALYZE_SELECTOR = 'button.media-workbench-inline-action:has-text("一键解析风格")';
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation?id=image.product_suite', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector(ANALYZE_SELECTOR, { timeout: 20000 });
  /* ⚠️ `:has-text()` 是 **Playwright 的选择器**，只能在 page.click / waitForSelector 里用；
     传给 page.evaluate 就落到浏览器的 querySelectorAll 上，会报 "not a valid selector"（本轮踩到）。
     所以取值这一处按文本在 JS 里筛。 */
  const parseButton = await page.evaluate(() => {
    const el = [...document.querySelectorAll('button.media-workbench-inline-action')].find(button => /一键解析风格/.test(button.textContent || ''));
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  });
  check(parseButton.includes('一键解析风格') && parseButton.includes('0.2 积分'), '解析按钮上写着它要多少钱（扣费动作不许让人猜）', parseButton);
  /* 没上传就点：就地提醒，不发任何请求（更不扣费） */
  const recognizeBefore = calls.recognize.length;
  await page.click(ANALYZE_SELECTOR);
  await page.waitForTimeout(500);
  const noUpload = await page.evaluate(() => document.querySelector('.media-run-global')?.textContent || '');
  check(calls.recognize.length === recognizeBefore, '没上传商品图时点了也不发请求（不扣费）', String(calls.recognize.length - recognizeBefore));
  check(noUpload.includes('先上传'), '就地告诉用户缺什么', noUpload.slice(0, 30));

  /* 上传之后点：先报价（ec_ai_assistant）→ 再解析 → 风格判定 + 商品字段一并填好 */
  await page.setInputFiles('.media-field-upload input[type=file]', UPLOAD_FILE);
  await page.waitForFunction(() => !document.querySelector('.media-asset-card-progress'), null, { timeout: 15000 });
  const quoteBefore = calls.quote.length;
  await page.click(ANALYZE_SELECTOR);
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
  check(parsed.value.includes('白瓷马克杯') && parsed.value.includes('家居生活'), '解析结果回填进「商品信息」字段（原来那颗按钮的产物并进了这一次点击）', parsed.value.slice(0, 40));
  check(parsed.notice.includes('0.2 积分'), '告诉用户这次解析花了多少积分', parsed.notice.slice(0, 40));

  /* 未登录：只弹登录，不发解析请求（钱规矩） */
  /* ⚠️ 与场景 ⑥ 同一套做法：既阻止 initScript 再种会话，也要把已有的 sb-auth 删掉 ——
     只种 no-session 标记的话，上一页留下的会话还在，页面其实**仍然是登录态**。 */
  await page.evaluate(SUPPRESS_SEED);
  await page.evaluate(() => localStorage.removeItem('sb-auth'));
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation?id=image.product_suite', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector(ANALYZE_SELECTOR, { timeout: 20000 });
  const recognizeBeforeLogin = calls.recognize.length;
  await page.click(ANALYZE_SELECTOR);
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
  /* ⚠️ 2026-09-19 批 O-⑪：**判据没变，锚点换了** ——
     判据仍是「跳到了这条辅助能力的子页面（标题对得上）」。
     换锚点的原因：本批按知渔把**技能名页头从左栏搬到了顶栏**（知渔那一页的技能名就是顶栏里那个 H1，
     左栏直接从「基础信息」开始 —— 用户批注②「你上面留白那么多，是要干嘛呢？」）。
     ⇒ 标题改从 `.topbar-title`（子页面顶栏中间那一格）读，兜底再读左栏 h2（嵌入形态仍在左栏）。 */
  await page.waitForFunction(() => {
    const t = document.querySelector('.topbar-title')?.textContent || document.querySelector('.media-workbench-head h2')?.textContent || '';
    return t.includes('效果图质感提升');
  }, null, { timeout: 15000 });
  const fused = await page.evaluate(() => ({
    title: document.querySelector('.topbar-title')?.textContent || document.querySelector('.media-workbench-head h2')?.textContent || '',
    filled: document.querySelectorAll('.media-asset-card').length,
    notice: document.querySelector('.media-run-carry')?.textContent || '',
    url: location.pathname + location.search,
  }));
  check(fused.title.includes('效果图质感提升'), '跳到了这条辅助能力的子页面（地址栏同步）', fused.url);
  check(fused.filled === 1, '刚才那张结果已经落在它的素材位上（用户不用再传一次）', String(fused.filled));
  check(fused.notice.includes('会重新计费'), '说清下一步点生成会重新计费', fused.notice.slice(0, 46));
  check(calls.regenerate.length === fuseCharges + 1, '点融合动作**没有发起生成**（钱还在用户手里）', String(calls.regenerate.length - fuseCharges));
  check(calls.quote.length === fuseQuotes + 1, '点融合动作也不额外报价（报价只跟着那次生成）', String(calls.quote.length - fuseQuotes));
  /* ⚠️ 批 O-⑥：目标技能（image.render_quality）的工作台按知渔 1:1 抄过来之后，
     多了一格**必填**的「后期指令」（知渔那一页的 multiText 也是必填）——
     素材带过来了但指令还没写时 CTA 仍禁用是**正确行为**。
     所以这里分两步：先确认真的是"只差指令"，再填上，最后才断言可点。 */
  check(await ctaDisabled() === true, '素材带过来了，但必填的后期指令还没写时仍然不允许生成');
  await fillRequiredText();
  check(await ctaDisabled() === false, '素材位已就绪 + 指令写完，用户只要再点一次「立即生成」');

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
  await clickBack();
  await page.waitForSelector('.media-hub', { timeout: 15000 });
  await page.click('.media-hub .media-case-card-hit');
  await page.waitForTimeout(1200);
  const afterSwitch = await page.evaluate(() => ({
    run: Boolean(document.querySelector('.media-run')),
    title: (document.querySelector('.topbar-title')?.textContent || document.querySelector('.media-workbench-head h2')?.textContent || ''),
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
  await clickGenerate();
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
  await page.waitForSelector('.topbar-title, .media-workbench-head h2', { timeout: 20000 });
  await page.waitForTimeout(500);
  const suiteLanding = await page.evaluate(() => ({
    url: location.pathname + location.search,
    title: (document.querySelector('.topbar-title')?.textContent || document.querySelector('.media-workbench-head h2')?.textContent || ''),
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
    mode: (document.querySelector('.video-mode-tabs button.is-selected strong')?.textContent || document.querySelector('.video-studio-page')?.dataset.videoMode || ''),
    resultStage: Boolean(document.querySelector('.video-result-workbench')),
  }));
  check(videoLanding.url === '/video-creation?id=video.smart', '点「视频生成」进的是视频子页面', videoLanding.url);
  check(videoLanding.mode.includes('智能成片') || videoLanding.mode.includes('smart'),
    '进去就落在对应的创作方式上', videoLanding.mode);
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
    brandLeft: (() => { const b = document.querySelector('.topbar-brand')?.getBoundingClientRect(); return b ? Math.round(b.x) : -1; })(),
    sidebarBoards: Array.from(document.querySelectorAll('.app-sidebar-cell')).map(n => n.getAttribute('title')).filter(t => t === '图片生成' || t === '视频生成'),
    actionsRight: (() => { const a = document.querySelector('.topbar-actions')?.getBoundingClientRect(); return a ? Math.round(a.x) : 0; })(),
    halfWidth: Math.round(window.innerWidth / 2),
  }));
  check(headerState.url === '/image-creation', '停在图片总页面', headerState.url);
  check(!headerState.boardBar, '总页面没有第二条导航条（用户 #2-1：也没有那两个导航栏的）', String(headerState.boardBar));
  /* ═══ 2026-09-24 批 AV：这条判据**反转**（用户在图五上明确要求把 LOGO 装回来）═══════════════
     原来钉的是「总页面顶栏**没有** LOGO」（依据是批 J-① 引的用户原话「上面是没有左上角这个
     薯包AI的」）。那件事此后被**自己推翻了两次**：
       ① 批 L-6 又把左导航顶上那颗品牌标也撤掉（理由：一屏两个品牌标）——
          于是总页面变成**一颗 LOGO 都没有**；
       ② 本轮用户看图后原话：「然后为什么我进来这个图片生成和视频生成的**总页面**这里
          左上角的 **LOGO 会不见了呢**。这个也很突兀啊，**你要搞进来啊**。」
     ⇒ 判据跟着改成"总页面顶栏**必须有** LOGO"，并且它落在左半边（不是跟账户组挤在一起）。 */
  check(headerState.topbarBrand, '总页面顶栏**有** LOGO（用户图五批注 3：不见了要装回来）', String(headerState.topbarBrand));
  check(headerState.brandLeft < headerState.halfWidth, 'LOGO 在左上角（不是被推到右边）', headerState.brandLeft + ' vs ' + headerState.halfWidth);
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
  await page.waitForSelector('.topbar-title, .media-workbench-head h2', { timeout: 20000 });
  await page.waitForTimeout(400);
  const navTo = async (group, index) => {
    /* 子页面里没有分类切换条 —— 先按顶栏的「返回」回总页面（批 I-③，见上面的说明）。 */
    if (await page.$('.topbar-back')) {
      await clickBack();
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
    title: (document.querySelector('.topbar-title')?.textContent || document.querySelector('.media-workbench-head h2')?.textContent || ''),
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
    /* ⚠️ 批 R：模型从"只有 image2"放开成**目录里可选的每一档** ——
       因为图片复刻 / AI换装这两页现在真的有「模型选择」了（用户第 21 轮口径：
       「他们子页面的模型不也是首页的模型吗，直接引用就好了呀」）。
       放开不等于放松：下面还多了一条更强的断言 —— 请求里的模型必须**等于页面上选中的那一档**。 */
    model: new Set(SELECTABLE_IMAGE_MODELS.map(model => model.id)),
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
      /* 批 O-⑪：技能名页头已按知渔搬到**顶栏**，扫描的"页面就绪"锚点同步加上 .topbar-title */
      await page.waitForSelector('.topbar-title, .media-workbench-head h2, .media-workbench-panel, .media-hub', { timeout: 20000 });
      await page.waitForTimeout(200);
      const shape = await page.evaluate(() => ({
        hub: Boolean(document.querySelector('.media-hub')),
        missing: document.querySelector('.media-workbench-missing')?.textContent || '',
        panel: Boolean(document.querySelector('.media-workbench-panel')),
        title: (document.querySelector('.topbar-title')?.textContent || document.querySelector('.media-workbench-head h2')?.textContent || ''),
        points: document.querySelector('.media-workbench-points')?.textContent || '',
        uploads: document.querySelectorAll('.media-field-upload input[type=file]').length,
      }));
      if (shape.hub) { result.problem = '落到了 Hub（技能没被解析出来）'; return result; }
      if (shape.missing) { result.problem = '页面说找不到这条技能：' + shape.missing; return result; }
      if (shape.title !== skill.name) { result.problem = '页面标题对不上：' + shape.title + ' ≠ ' + skill.name; return result; }
      if (shape.panel) { result.problem = ''; result.panel = true; return result; }
      /* ═══ 批 Q-⑦：**每一条"切换必须换出东西"的承诺都要真的换出来**（用户：「不能让一些按钮
         或者配置成为死的配置」）══════════════════════════════════════════════════════════
         声明源里写了 visibleWhen 的字段 = "选到这一档它才出现"。这条就逐个验证：
         点到那一档 → 它必须真的出现在 DOM 里；点不到、或点完不出现，都判红。
         与"纯取值型"切换（比例 / 分辨率，它们本来就不该改变字段）区分开：只查有 visibleWhen 的。 */
      const gates = (skill.fields || []).filter(field => field.visibleWhen && field.visibleWhen.key);
      for (const gate of gates) {
        const controller = (skill.fields || []).find(field => field.key === gate.visibleWhen.key);
        const option = (controller?.options || []).find(item => String(item.value) === String(gate.visibleWhen.equals));
        if (!option) { result.problem = gate.label + ' 的 visibleWhen 指向了一个不存在的档位：' + gate.visibleWhen.equals; return result; }
        const clicked = await page.evaluate(label => {
          const button = [...document.querySelectorAll('.media-field-segmented button, .media-field-cards button')]
            .find(node => (node.innerText || '').trim().startsWith(label));
          if (!button) return false;
          button.click();
          return true;
        }, option.label);
        await page.waitForTimeout(260);
        const revealed = await page.evaluate(label => [...document.querySelectorAll('.media-field')]
          .some(node => node.getBoundingClientRect().height > 0 && ((node.querySelector('.media-field-label') || {}).innerText || '').startsWith(label.slice(0, 6))), gate.label);
        if (!clicked) { result.problem = '切不到「' + option.label + '」（控制器里找不到这颗药丸）'; return result; }
        if (!revealed) { result.problem = '切到「' + option.label + '」之后「' + gate.label + '」没有出现（死配置）'; return result; }
      }
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
      /* ═══ 2026-09-24 批 AW：「包含模块」默认**一个都不勾**（照知渔 0/16，用户拍板）════════════
         所以"通用配齐"这一步要像真用户那样**勾一个模块** —— 不勾就不是"配齐"，
         CTA 会被如实拦住（那句提示就是本轮新加的 moduleGate）。
         ⚠️ 只勾第一个：够验证"勾选驱动张数"这条链，且不会把请求数放大（下面要数请求）。
         这条与 test/workbench-quantv-parity-0918 的判据是同一件事的两面，两边一起改。 */
      await page.evaluate(() => {
        const box = document.querySelector('.media-workbench-checklist.is-selectable .media-workbench-checklist-toggle');
        if (box && box.getAttribute('aria-checked') !== 'true') box.click();
      });
      await page.waitForTimeout(220);
      const gate = await page.evaluate(() => ({
        disabled: document.querySelector('.media-workbench-submit')?.disabled ?? null,
        hint: document.querySelector('.media-workbench-cta-hint')?.textContent || '',
        /* 页面上**当前选中**的模型（有这一格的技能才非空）——下面要断言请求里的模型与它一致 */
        modelShown: document.querySelector('.media-workbench-fields select[id="field-imageModel"]')?.value || '',
      }));
      result.modelShown = gate.modelShown;
      if (gate.disabled) { result.problem = '配齐之后 CTA 仍然是禁用：' + (gate.hint || '(无提示)'); return result; }
      /* 套图是另一条钱路，已在 ⑯ 单独压过，这里只确认它报价正常 */
      if (skill.pipeline === 'ecommerceSuite') {
        result.suite = true;
        if (!/\d+ 积分/.test(shape.points)) result.problem = '套图没有显示按套总价：' + shape.points;
        return result;
      }
      await clickGenerate();
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
      /* ═══ 批 Q（用户批注 #3-6）：**预览型技能的按钮价格变了** ═══════════════════════════
         用户原话：「我不明白为什么生成一下预览就要 7 点积分，我们的竞品他们就只有 0 点几的积分，
           你为什么不把那个生成预览的积分放上去呢？」
         ⇒ previewStep 那三条（商品套图 / A+ / 详情图）第一次点的是「生成预览」（0.5 积分/次，
           SKU ec_plan_preview），按钮上写的就是这一步的价格；**方案应用之后**按钮回到
           「生成图片」并显示真实出图报价。所以这条判据必须在**点完之后再读一次价格**，
           否则拿 0.5 去跟请求数比（实测报"请求数 16 与按钮上的积分 5 对不上"）。
         ⚠️ 判据本身没变，仍然咬「勾几个出几张、收几张的钱」。 */
      const pointsNow = await page.evaluate(() => document.querySelector('.media-workbench-points')?.textContent || '');
      /* ⚠️ 批 R：**单价不再是恒定的 1 积分/张**（页面上能选模型了，Midjourney 2K 是 3.5 积分/张），
         所以"请求数 == 按钮上的积分数"这条旧写法会把 1.5 积分读成 5（正则 \d+ 咬到了小数点后面）。
         判据换成**钱**本身，而且比旧判据更强：
           按钮上的积分  ==  请求数 × 该模型该清晰度的单价（单价来自模型目录，与后端 SKU 同源）。
         判据要守的东西一个字没变：勾几个出几张、收几张的钱。 */
      const points = Number.parseFloat(String(pointsNow).match(/(\d+(?:\.\d+)?)\s*积分/)?.[1] || '');
      const fired = calls.regenerate.length - before;
      const body = calls.regenerate[calls.regenerate.length - 1] || {};
      const unit = generationUnits(body.image_model, body.resolution) / 1000;
      if (!(points > 0)) { result.problem = '按钮上没有积分报价：' + pointsNow; return result; }
      if (!(unit > 0)) { result.problem = '算不出单价（模型 ' + body.image_model + ' / 清晰度 ' + body.resolution + '）'; return result; }
      if (Math.abs(fired * unit - points) > 0.001) {
        result.problem = '请求数 ' + fired + ' × 单价 ' + unit + ' = ' + (fired * unit) + '，与按钮上的 ' + points + ' 积分对不上（勾几个出几张、收几张的钱）';
        return result;
      }
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
  /* ⚠️ 批 R：判据从"所有请求都用 image2"升级成**"页面显示什么模型，请求就发什么模型"**——
     旧判据是"模型写死"时代的产物；现在有「模型选择」的页面上用户能换档，
     真正要咬的是"显示的和跑的是同一个"（本项目铁律：不许"看着是 A、跑的是 B"）。
     没有这一格的技能仍然必须是默认档 image2。 */
  const wrongModel = generated.filter(row => row.sent.image_model !== (row.modelShown || 'image2'));
  check(wrongModel.length === 0, '请求里的模型与页面上选中的那一档一致（没有这一格的技能用默认 image2）',
    wrongModel.map(row => row.id + '：显示 ' + (row.modelShown || 'image2') + ' 发了 ' + row.sent.image_model).join(' ｜ ').slice(0, 300));
  check(generated.some(row => row.modelShown && row.modelShown !== 'image2'),
    '扫描里真的覆盖到了"换成别的模型"的技能（否则这条断言是空转）',
    generated.filter(row => row.modelShown).map(row => row.id + '=' + row.modelShown).join(','));
  check(sweepRows.filter(row => row.suite).length === 1, '套图那条仍然按套报价（没有掉进单图分支）');

  /* ═══ ⑳ 模型选择 / 比例「自适应」：**真的点一遍**（批 R）═════════════════════════════════
     用户第 21 轮原话：「模型选择不用纠结啊，他们子页面的模型不也是首页的模型吗，直接引用就好了呀，
       比例里的「自适应」……各个 skill 他们自己有最适配的方案吗，有的话就可以作为自适应去做吧？
       你先确保你现在线上所有的 skill 来源和工作台功能打通，所有适配方案都确确实实没有任何问题
       我们再来跑案例，你自己要深度核查一遍。」
     判据三条，缺一条就是"装出来的功能"：
       ① 选中的模型真的进请求，且 CTA 上的积分跟着变（模型参与计费）；
       ② 分辨率不许超出模型档位：Midjourney 上游只有 1K/2K → 4K 那一颗消失，且请求是 2K；
       ③ 「自适应」按上传图就近取档：打桩资产是 2400x1792 的 PNG（RESULT_FILE）→ 请求比例 4:3，
          并且「自适应」这个**界面档位**不许出现在请求里。 */
  scenario('⑳ 模型选择与自适应比例（真点一遍）');
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation?id=image.copy', { waitUntil: 'load', timeout: 40000 });
  /* 等的是**这一页真的渲染出工作台**（.media-workbench-panel 是"嵌进来的工作台"那一支的选择器，
     图片复刻走的是普通工作台 —— 等错了选择器会 20s 超时，实测踩到）。 */
  await page.waitForSelector('.media-workbench-submit', { timeout: 20000 });
  /* ⚠️ 这一页有**两个**上传位（上传商品图 / 上传参考图）：setInputFiles 传选择器会命中多个，
     必须 .first() 明确指向第一个（否则 Playwright 的严格模式直接抛错）。 */
  await page.locator('.media-field-upload input[type=file]').first().setInputFiles(ADAPTIVE_UPLOAD_FILE);
  /* 等宽高量出来（异步 Image 加载）——等不到也要**留下现场**，不要抛出去变成"脚本自身失败" */
  const box = await page.waitForFunction(
    () => document.querySelector('.media-field-upload-item[data-box]')?.dataset.box || '',
    null, { timeout: 20000 },
  ).then(handle => handle.jsonValue()).catch(() => '');
  if (!/^\d+x\d+$/.test(box)) {
    /* 失败时把**现场**留下：条目状态 + 上传后那张图的地址 + 浏览器能不能把它读回来
       （自适应量不到宽高时，这三样就是全部可能的原因） */
    const state = await page.evaluate(async () => {
      const src = document.querySelector('.media-field-upload-item img')?.getAttribute('src') || '';
      const loaded = await new Promise(resolve => {
        if (!src) { resolve('no-src'); return; }
        const probe = new Image();
        probe.onload = () => resolve(probe.naturalWidth + 'x' + probe.naturalHeight);
        probe.onerror = () => resolve('load-error');
        probe.src = src;
      });
      return {
        fields: [...document.querySelectorAll('.media-field-upload')].map(node => ({
          empty: node.dataset.empty,
          items: [...node.querySelectorAll('.media-field-upload-item')].map(item => item.dataset.box || '(未量到)'),
          retry: node.querySelector('.media-field-upload-retry')?.textContent || '',
        })),
        src,
        loaded,
      };
    });
    check(false, '上传就绪后量到了实际宽高（「自适应」按它取档）', box + ' ｜ ' + JSON.stringify(state).slice(0, 260));
  } else {
    check(true, '上传就绪后量到了实际宽高（「自适应」按它取档）', box);
  }
  await page.fill('textarea[id="field-product"]', '白色陶瓷杯，350ml，家用').catch(() => {});
  const priceOf = () => page.evaluate(() => (document.querySelector('.media-workbench-points')?.textContent || '').trim());
  const clarityPills = () => page.evaluate(() => [...document.querySelectorAll('.media-field-segmented[aria-label="分辨率"] button')].map(node => node.textContent.trim()));
  const activeClarity = () => page.evaluate(() => document.querySelector('.media-field-segmented[aria-label="分辨率"] button.is-active')?.textContent.trim() || '');
  check((await clarityPills()).length === 3, '默认模型（GPT Image 2）分辨率是三档 1K/2K/4K', (await clarityPills()).join('/'));
  await page.click('.media-field-segmented[aria-label="分辨率"] button:nth-child(3)');
  await page.waitForTimeout(160);
  check((await activeClarity()).startsWith('4K'), '三档全支持的模型可以选 4K', await activeClarity());
  const priceBefore = await priceOf();
  await page.selectOption('select[id="field-imageModel"]', 'midjourney');
  await page.waitForTimeout(220);
  const priceAfter = await priceOf();
  check(priceBefore !== priceAfter && /积分/.test(priceAfter), '换模型后按钮上的积分跟着变（模型真的参与计费）', priceBefore + ' → ' + priceAfter);
  const pillsAfter = await clarityPills();
  check(pillsAfter.length === 2 && !pillsAfter.some(text => text.startsWith('4K')),
    '换成 Midjourney 后 4K 那一档消失（上游只有 1K/2K，不给做不到的档）', pillsAfter.join('/'));
  check((await activeClarity()).startsWith('2K'), '原来选中的 4K 被夹到 2K（不是显示 4K、按 2K 跑）', await activeClarity());
  await page.evaluate(() => {
    [...document.querySelectorAll('.media-field-segmented[aria-label="比例"] button')]
      .find(node => node.textContent.trim() === '自适应')?.click();
  });
  await page.waitForTimeout(160);
  const before20 = calls.regenerate.length;
  await clickGenerate();
  await page.waitForFunction(() => document.querySelectorAll('.media-run-slot img').length > 0, null, { timeout: 20000 }).catch(() => {});
  const body20 = calls.regenerate[calls.regenerate.length - 1] || {};
  check(calls.regenerate.length === before20 + 1, '这一次点击只发一次请求', String(calls.regenerate.length - before20));
  check(body20.image_model === 'midjourney', '请求里的模型 = 页面上选中的那一档', String(body20.image_model));
  check(body20.resolution === '2K', '请求里的清晰度落在模型支持的档位里', String(body20.resolution));
  const [boxW, boxH] = box.split('x').map(Number);
  check(body20.ratio === nearestLegalRatio(boxW, boxH) && body20.ratio !== '自适应',
    '「自适应」= 按上传图就近取一档，且界面档位不下发给引擎', String(body20.ratio) + '（上传图 ' + box + '）');
  check(body20.ratio === '4:3', '上传的是 2400x1792 的非方图 → 就近取 4:3（换了上传图这条期望值跟着变）', String(body20.ratio));

  /* ═══ ⑳b 图片复刻：**上传几张参考图就复刻几张**（2026-09-21 用户第 22 轮口径）══════════════
     用户原话：「他这里的案例指的是上面 3 张原图分别对应下面 3 张的复刻结果啊，用户上传一张肯定就复刻
       一张，上传两张就复刻两张，上传 3 张就复刻 3 张不是吗？」
     知渔示例区原文：「上传风格参考图与商品图包，AI 按参考图数量批量输出风格高度一致的商品主图。」
     这一条要真的点一遍才算数：3 张参考图 → 按钮上 3 积分 → 3 次请求 → **3 张不同的参考图**
     （如果 3 次请求带的是同一张，那就是"装出来的功能"）。 */
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation?id=image.copy', { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-workbench-submit', { timeout: 20000 });
  const uploads = page.locator('.media-field-upload input[type=file]');
  await uploads.nth(0).setInputFiles(ADAPTIVE_UPLOAD_FILE);
  await uploads.nth(1).setInputFiles([ADAPTIVE_UPLOAD_FILE, ADAPTIVE_UPLOAD_FILE, ADAPTIVE_UPLOAD_FILE]);
  await page.waitForFunction(() => document.querySelectorAll('.media-field-upload-item[data-box]').length >= 2, null, { timeout: 20000 }).catch(() => {});
  await page.fill('textarea[id="field-product"]', '白色陶瓷杯，350ml，家用').catch(() => {});
  await page.waitForTimeout(400);
  const points3 = await page.evaluate(() => (document.querySelector('.media-workbench-points')?.textContent || '').trim());
  check(/3\s*积分/.test(points3), '参考图 3 张 → 按钮上就是 3 积分（按张报价，点之前看得到）', points3);
  const before3 = calls.regenerate.length;
  await clickGenerate();
  await page.waitForFunction(count => document.querySelectorAll('.media-run-slot img').length >= count, 3, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(400);
  const fired3 = calls.regenerate.slice(before3);
  check(fired3.length === 3, '3 张参考图 → 真的发 3 次请求（上传几张就复刻几张）', String(fired3.length));
  const refs3 = fired3.map(body => (body.reference_images || [])[0] || '');
  check(new Set(refs3).size === 3, '3 次请求带的是**3 张不同的**参考图（否则就是 3 张一模一样的图）', refs3.join(' ｜ ').slice(0, 200));
  check(fired3.every(body => body.image_url === fired3[0].image_url), '商品图始终是主图（image_url 三次一致）');
  check(new Set(fired3.map(body => body.request_key)).size === 3, '三次运行的幂等键互不相同');


  /* 视频侧同理：7 条视频技能都要能进自己的子页面、落在自己的创作方式上。
     ═══ 2026-09-19 批 N：**判据不变，锚点换了一处** ═══════════════════════════════════════
     判据一个字没动 ——「进子页面就落在**它自己那一档**创作方式上」（initialMode 真的落上了）。
     换的是**观测点**：批 N 起，skill 子页面按声明源渲染自己的工作台，
     **不再显示**「智能成片 / 首尾帧 / 爆款重构」那排页签。
     依据是用户第 18 轮原话：
       「他们这些 skill 页面……**每个工作台都是不一样的呀**，你现在完全没抄，
         **用的依然是我们之前首页的视频生成版本糊弄我**……对应的一比一去抄啊」
     以及知渔 20 个视频 skill 页的实测（docs/design/64 §8）：**没有任何一页有创作方式切换** ——
     创作方式是**这条 skill 自带的属性**，不是让用户在页面上再选一次的东西。
     ⇒ 现在读的是 <main class="video-studio-page" data-video-mode="smart">（页面如实挂着的当前档位）；
        页签还在的形态（首页输入框 / 独立路由）仍然优先读页签 —— 两种形态同一份断言。 */
  const videoSweep = [];
  for (const skill of VIDEO_SKILLS) {
    const row = { id: skill.id, problem: '' };
    try {
      await page.goto('http://127.0.0.1:' + PORT + '/video-creation?id=' + encodeURIComponent(skill.id), { waitUntil: 'load', timeout: 40000 });
      await page.waitForSelector('.media-workbench-panel .video-studio-page', { timeout: 20000 });
      await page.waitForTimeout(350);
      const shape = await page.evaluate(() => ({
        title: (document.querySelector('.topbar-title')?.textContent || document.querySelector('.media-workbench-head h2')?.textContent || ''),
        mode: (document.querySelector('.video-mode-tabs button.is-selected strong')?.textContent || document.querySelector('.video-studio-page')?.dataset.videoMode || ''),
      }));
      row.mode = shape.mode;
      if (shape.title !== skill.name) row.problem = '页面标题对不上：' + shape.title + ' ≠ ' + skill.name;
      else if (!shape.mode) row.problem = '创作方式没有落上（initialMode 没生效 / data-video-mode 缺失）';
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
  /* 映射本身由 skillRun 说了算：页面落在的那一档必须就是 skillVideoMode 算出来的那个。
     ⚠️ 批 N：子页面不再显示页签（依据见上面那一段引用的用户原话），
        所以这里同时接受**档位 id**（data-video-mode）与**页签文案**（首页/独立路由仍读得到）——
        判据没变，变的只是"从哪儿读"。 */
  const MODE_LABEL = { smart: '智能成片', frame: '首尾帧', remake: '爆款重构' };
  const modeMismatch = videoSweep.filter(row => {
    const expected = expectedMode.get(row.id);
    if (!row.mode || !expected) return false;
    return !row.mode.includes(expected) && !row.mode.includes(MODE_LABEL[expected] || '');
  });
  check(modeMismatch.length === 0, '页签与 skillRun 的映射一致（不是各写一份）',
    modeMismatch.map(row => row.id + '→' + row.mode).join(' ｜ '));

  /* ═══ ⑳ 子页面版式契约：整块工作区锁在视口内 + 主 CTA 真的点得到 ═══════════════════════
     用户第 19 轮原话（逐字，docs/design/66）：
       「你这个工作台的左边，还有你右边的案例区的右边都有**大量的留白**，
        你为什么不能**直接适配他们拉满**呢？
        然后你**下面那个生成预览那个按钮，我现在也是点不到的**。就**完全是被截断一部分**了。」
     这两条都是**实机坐标**，静态断言守不住（RTK §3.1-10）——所以在这里用真浏览器量。
     ⚠️ 变异测试：把 WorkbenchShell.css 里 subpage 那段 height/overflow 注释掉，
        本场景立刻红（CTA 会落到视口外、elementFromPoint 返回 null），恢复后绿。 */
  scenario('㉑ 子页面：工作区锁视口 + 主 CTA 可点 + 左右拉满');
  await page.goto('http://127.0.0.1:' + PORT + '/image-creation?id=' + encodeURIComponent('image.product_suite'), { waitUntil: 'load', timeout: 40000 });
  await page.waitForSelector('.media-workbench-submit', { timeout: 20000 });
  await page.waitForTimeout(600);
  const layout = await page.evaluate(() => {
    const cta = document.querySelector('.media-workbench-submit');
    const r = cta.getBoundingClientRect();
    const probe = document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(r.height / 2, 20));
    const mc = document.querySelector('.media-creation');
    const wb = document.querySelector('.media-workbench');
    const mcr = mc.getBoundingClientRect();
    const wbr = wb.getBoundingClientRect();
    return {
      vh: window.innerHeight,
      docScroll: document.documentElement.scrollHeight,
      ctaBottom: Math.round(r.bottom),
      ctaInViewport: r.bottom <= window.innerHeight && r.top >= 0,
      ctaHittable: Boolean(probe && (probe === cta || cta.contains(probe))),
      gapLeft: Math.round(wbr.left - mcr.left),
      gapRight: Math.round((mcr.left + mcr.width) - (wbr.left + wbr.width)),
    };
  });
  check(layout.docScroll <= layout.vh + 2, '子页面本身不滚动（工作区锁在视口内，照知渔 main 的 h-[calc(100vh-56px)]）',
    'docH=' + layout.docScroll + ' vh=' + layout.vh);
  check(layout.ctaInViewport, '主 CTA 完整落在视口内（不是被截断一半）',
    'ctaBottom=' + layout.ctaBottom + ' vh=' + layout.vh);
  check(layout.ctaHittable, '主 CTA 中心点命中按钮本体（elementFromPoint —— 点得到才是能用）', String(layout.ctaHittable));
  check(layout.gapLeft <= 40 && layout.gapRight <= 40, '工作台左右拉满（与顶栏同一条线，不是各留 136px 的大片空白）',
    'left=' + layout.gapLeft + ' right=' + layout.gapRight);

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