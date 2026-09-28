/* ═══ 批 CY 探针：**@ 按钮全站统一**（用户点名最重的一条）═══════════════════════════════════════
   用户原话（逐字）：
   「这个@ 按钮为什么没有照首页那边的做法去做呢？真正的这种按钮，它是**向上张开面板**。然后要**映射你
    现在的这一个上传的素材的命名还有图标**等方案呀……我现在要求你把整个网站里面所有的这种 @ 按钮，
    就是不管是首页或者各种子页面或者画布里面涉及到的这个按钮，你都要**统一同一个类型的标准**。」
   「你看首页视频生成这边的 @ 按钮的张开面板这个逻辑其实做的已经挺好了……就是你**为什么没有映射到
    当前这个素材它的图片呢**？」
   「你看首页图片生成这边就是有的。他这个 @ 按钮的逻辑会更正确……包括张开的面板是**向上**的，
    然后这个**大小、宽度**这些东西你都要对齐呀。」
   量四个面（首页图片 / 首页视频 / 子页面 / 画布），每一项都量：
     · 触发按钮尺寸（统一标准 = 34×34 圆形）
     · 面板是否在**触发按钮上方**（upward=true）
     · 面板宽度（统一 = 260）
     · 菜单行里有没有 **<img> 缩略图**、每行文字（命名）
     · 没素材时触发按钮是否**禁用**
   用法：node .qa/cy-at-unify.mjs   （只读；上传用的是本地样例图，不触发任何生成）
────────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const UPLOAD_FILE = 'public/gallery/ecommerce/baby-bottle-product-suite/01.webp';
const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const errors = [];
/* 登录态：视频侧的上传**要求登录**（`if (!state.logged) return`）—— 不种会话的话，
   文件进了 files.images 但上传不发起 ⇒ 菜单行只有名字没有缩略图，
   看起来像"缩略图代码没生效"（本探针踩过）。键名与 scripts/media-workbench-e2e.mjs 一致。 */
const seedSession = async page => {
  await page.addInitScript(() => {
    const future = Date.now() + 86400 * 1000;
    localStorage.setItem('sb-auth', JSON.stringify({ id: 'e2e@example.com', email: 'e2e@example.com', nickname: 'E2E', token: 'e2e-token', expiresAt: future }));
  });
};

/* ⚠️ 路由注册顺序：Playwright 后注册的优先匹配 ⇒ 具体资源路由要写在通配的 api 路由 **之后**，
   否则会被泛化的那条吃掉（第一次跑探针就踩到：fixture 图 404 → 菜单行没有缩略图）。
   ⚠️ 写这类注释时别在注释里直接写通配符（形如 星号-斜杠-星号 的串会**提前闭合块注释**）。 */
const UPLOAD_ASSET_URL = '/api/e2e-fixture-thumb.webp';
const mock = async page => {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
    if (path === '/api/works') return json({ works: [] });
    if (path === '/api/video/capabilities') return json({
      loading: false, generationEnabled: true, workbenchEnabled: false, directorUi: false,
      uploadMode: 'direct', defaultProductId: 'seedance_standard', durations: { min: 5, max: 10 },
      products: [{ id: 'seedance_standard', label: 'Seedance 2.0', default: true, modes: ['script'], resolutions: ['720p'], durationOptions: [5], durations: { min: 5, max: 10 }, quotes: { short: { sku: 's', units: 1, points: 92 }, long: { sku: 'l', units: 1, points: 184 } } }],
    });
    /* 电商素材上传（子页面上传格走这条）：契约见 services/api.js parseEcommerceUploadResponse */
    if (path === '/api/ecommerce/assets' && route.request().method() === 'POST') {
      return json({ ok: true, original: { assetId: 'e2e-asset-1', url: UPLOAD_ASSET_URL, role: 'product' }, preview: { url: UPLOAD_ASSET_URL } });
    }
    /* 视频素材上传（首页视频侧的直接路径） */
    if (path === '/api/video/assets' && route.request().method() === 'POST') {
      return json({ ok: true, asset: { id: 'e2e-video-asset-1', url: UPLOAD_ASSET_URL, kind: 'image', name: 'e2e.webp' } });
    }
    if (/skills/.test(path)) return json({ ok: true, builtin: [], mine: [], groups: [] });
    return json({ ok: true, items: [], draft: null, templates: [] });
  });
  /* 真图：让缩略图有东西可显示（后注册 = 优先） */
  await page.route('**/api/e2e-fixture-thumb.webp', route => route.fulfill({ status: 200, contentType: 'image/webp', path: UPLOAD_FILE }));
};

/* 量一次 @：触发按钮 rect + 点开后菜单 rect / 缩略图数 / 行文字 */
const measureAt = async (page, label) => {
  const triggerInfo = await page.evaluate(() => {
    const t = document.querySelector('.image-mention-trigger');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), disabled: Boolean(t.disabled), top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left) };
  });
  if (!triggerInfo) { console.log(`  ${label}: ⚠️ 找不到 .image-mention-trigger`); return; }
  await page.evaluate(() => document.querySelector('.image-mention-trigger')?.click());
  await page.waitForTimeout(700);
  const menu = await page.evaluate(() => {
    const m = document.querySelector('.image-mention-menu');
    if (!m) return { present: false };
    const r = m.getBoundingClientRect();
    const rows = Array.from(m.querySelectorAll('button')).map(b => ({
      text: (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 22),
      thumb: Boolean(b.querySelector('img')),
    }));
    return { present: true, left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), rows };
  });
  if (!menu.present) {
    console.log(`  ${label}: 触发 ${triggerInfo.w}×${triggerInfo.h} disabled=${triggerInfo.disabled} → 面板没打开`);
    return;
  }
  const upward = menu.top < triggerInfo.top;
  console.log(`  ${label}: 触发 ${triggerInfo.w}×${triggerInfo.h} disabled=${triggerInfo.disabled} ｜ 面板 w=${menu.width} top=${menu.top}（触发 top=${triggerInfo.top}）⇒ **${upward ? '向上 ✓' : '向下 ✗'}** ｜ 行=${JSON.stringify(menu.rows)}`);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
};

/* ① 首页：图片生成 / 视频生成 */
{
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.on('pageerror', e => errors.push('HOME PAGEERR ' + String(e.message).slice(0, 140)));
  await seedSession(page);
  await mock(page);
  await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.homepage-mode-card', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1500);

  for (const [card, name] of [['.homepage-mode-card.card-1', '首页·视频生成'], ['.homepage-mode-card.card-2', '首页·图片生成']]) {
    await page.click(card).catch(() => {});
    await page.waitForTimeout(900);
    /* 把上传相关请求打出来：视频侧缩略图依赖"上传完成后的素材 URL"，看不到请求就说明上传压根没发起 */
    page.on('request', r => { if (/\/api\/(video|ecommerce)\//.test(r.url())) console.log(`      [req] ${r.method()} ${new URL(r.url()).pathname}`); });
    page.on('response', r => { if (/\/api\/(video|ecommerce)\//.test(r.url())) console.log(`      [res] ${r.status()} ${new URL(r.url()).pathname}`); });
    /* 先量"没素材"的状态 */
    await measureAt(page, name + '（无素材）');
    /* 上传一张，再量有素材的状态 */
    const inputs = await page.$$('input[type=file]');
    for (const input of inputs) {
      const accept = (await input.getAttribute('accept')) || '';
      if (/video|audio/.test(accept)) continue;
      await input.setInputFiles(UPLOAD_FILE).catch(() => {});
      break;
    }
    await page.waitForTimeout(2500);
    await measureAt(page, name + '（有素材）');
  }
  await page.close();
}

/* ② 子页面（图片 / 视频）——素材来源是"这条技能里已上传的字段"：
   先量**无素材**（应当禁用变暗），再**真上传一张**后量（应当能列出带缩略图的素材行） */
for (const [url, name] of [['/image-creation?id=image.product_suite', '子页面·图片生成'], ['/video-creation?id=video.smart', '子页面·视频生成']]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push(name + ' PAGEERR ' + String(e.message).slice(0, 140)));
  await seedSession(page);
  await mock(page);
  await page.goto(base + url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4200);
  await measureAt(page, name + '（无素材）');
  /* 往这一页的上传格里塞一张图 → 等上传完成 → 再量 @ */
  const inputs = await page.$$('input[type=file]');
  let uploaded = false;
  for (const input of inputs) {
    const accept = (await input.getAttribute('accept')) || '';
    if (/video|audio/.test(accept)) continue;
    await input.setInputFiles(UPLOAD_FILE).catch(() => {});
    uploaded = true;
    break;
  }
  await page.waitForTimeout(3000);
  console.log(`  （${name} 上传${uploaded ? '已投递' : '没找到输入框'}）`);
  await measureAt(page, name + '（有素材）');
  await page.close();
}

/* ③ 画布 */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => errors.push('CANVAS PAGEERR ' + String(e.message).slice(0, 140)));
  await seedSession(page);
  await mock(page);
  await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.ec-canvas-topbar', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2200);
  await measureAt(page, '画布（无素材）');
  await page.close();
}

console.log('\n运行时错误：' + (errors.length ? JSON.stringify(errors.slice(0, 6), null, 1) : '无'));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
