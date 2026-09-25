/* ══════════════════════════════════════════════════════════════════════════════════════════
   批 BN 实机复验：工作台底部生成按钮
     ① 图片侧（商品套图，缺素材）——按钮**通栏**（宽度 ≈ 左栏内容宽）、禁用态**灰**、提示在**按钮下方居中**
     ② 视频侧（首页创作台，没输入）——同样的提示类（.shubao-gen-cta-hint）出现在 CTA 下面
   数字全部落档 .tmp/bn/bn-verify.json。全程不真出片（/api/video/jobs 打桩成 500）。
   ══════════════════════════════════════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startDevServer, stopDevServer, gotoHealthy } from '../test/helpers/live-browser.mjs';
import { publicVideoProducts } from '../server/videoCatalog.mjs';

const out = '.tmp/bn';
mkdirSync(out, { recursive: true });

const CAPS = {
  loading: false, generationEnabled: true, workbenchEnabled: false, directorUi: false,
  uploadMode: 'tus', defaultProductId: 'seedance_standard', products: publicVideoProducts(),
};
let videoJobs = 0;

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on('pageerror', error => console.log('PAGEERROR: ' + error.message));

await page.route('**/api/**', route => {
  const req = route.request();
  const path = new URL(req.url()).pathname;
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json(200, { ok: true, email: 'probe@example.com', nickname: 'BN' });
  if (path === '/api/video/capabilities') return json(200, CAPS);
  if (path === '/api/video/jobs' && req.method === 'POST') { videoJobs += 1; return json(500, { error: 'BN 探针：不许真实出片' }); }
  if (path === '/api/video/jobs') return json(200, { jobs: [] });
  if (path === '/api/billing/balance') return json(200, { ok: true, currency: 'ec_points', balance: 999, unlimited: false, credits: 999 });
  if (path === '/api/billing/quote') return json(200, { quote: { quoteId: 'bn-1', totalUnits: 1000, currency: 'ec_points' } });
  if (path === '/api/works') return json(200, { works: [] });
  return json(200, { ok: true });
});

/* ── ① 图片侧工作台：商品套图（缺素材 ⇒ 禁用 + 提示）── */
await page.goto(server.base + 'image-creation?id=image.product_suite', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.media-workbench-submit', { timeout: 30000 });
await page.waitForTimeout(1500);
const imageSide = await page.evaluate(() => {
  const submit = document.querySelector('.media-workbench-submit');
  const left = document.querySelector('.media-workbench-left');
  const cta = document.querySelector('.media-workbench-cta');
  const hint = document.querySelector('.media-workbench-cta-hint');
  const cs = getComputedStyle(submit);
  const leftCs = getComputedStyle(left);
  const ctaCs = getComputedStyle(cta);
  const box = node => { const b = node.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const contentWidth = Math.round(left.clientWidth - parseFloat(leftCs.paddingLeft) - parseFloat(leftCs.paddingRight));
  return {
    disabled: submit.disabled,
    points: submit.querySelector('.media-workbench-points')?.textContent || '',
    hintText: hint?.textContent || '',
    submit: box(submit),
    leftContentWidth: contentWidth,
    fillRatio: +(box(submit).w / contentWidth).toFixed(3),
    ctaDirection: ctaCs.flexDirection,
    hintBox: hint ? box(hint) : null,
    hintCenter: hint ? Math.round(box(hint).x + box(hint).w / 2) : null,
    submitCenter: Math.round(box(submit).x + box(submit).w / 2),
    submitBg: cs.backgroundColor,
    submitColor: cs.color,
    submitShadow: cs.boxShadow,
    pointsBg: submit.querySelector('.media-workbench-points') ? getComputedStyle(submit.querySelector('.media-workbench-points')).backgroundColor : '',
  };
});
await page.screenshot({ path: out + '/01-image-workbench-cta.png' });

/* ── ② 视频侧：首页创作台（没输入 ⇒ CTA 禁用 + 提示在下面）── */
await gotoHealthy(page, server.base, '.homepage-mode-card');
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const boxes = Array.from(document.querySelectorAll('.video-submit-actions'));
  return boxes.length;
});
const videoSide = await page.evaluate(() => {
  const hint = document.querySelector('.shubao-gen-cta-hint');
  const actions = hint ? hint.closest('.video-submit-actions') : null;
  const cta = document.querySelector('.video-submit-actions .shubao-gen-cta');
  const cs = cta ? getComputedStyle(cta) : null;
  const box = node => { if (!node) return null; const b = node.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  return {
    hintText: hint?.textContent || '',
    hintBox: box(hint),
    actionsIsColumn: actions ? getComputedStyle(actions).flexDirection : '',
    ctaDisabled: cta ? cta.disabled : null,
    ctaBg: cs ? cs.backgroundColor : '',
    ctaBox: box(cta),
    hintCenter: hint ? Math.round(box(hint).x + box(hint).w / 2) : null,
    ctaCenter: cta ? Math.round(box(cta).x + box(cta).w / 2) : null,
  };
});
await page.screenshot({ path: out + '/02-video-composer-cta.png' });

const report = { imageSide, videoSide, videoJobs };
writeFileSync(out + '/bn-verify.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));

await browser.close();
stopDevServer(server.proc, { owned: server.owned });
