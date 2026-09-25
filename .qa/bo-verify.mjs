/* ══════════════════════════════════════════════════════════════════════════════════════════
   批 BO 实机复验（三项，都有数字）：
     ① 主 CTA 的**启用态**是 135° 渐变（留影AI 策略），hover 时渐变整体亮一档（不是死紫）
     ② 缺料提示说**人话**（「请先上传图片（至少 1 张）」而不是「还差：上传图片」）
     ③ 模型列表：MiniMax H3（480P/720P）与 **MiniMax H3 2K** 是两行（用户要的独立版本）
   落档 .tmp/bo/bo-verify.json；全程不真出片。
   ══════════════════════════════════════════════════════════════════════════════════════════ */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { startDevServer, stopDevServer, gotoHealthy } from '../test/helpers/live-browser.mjs';
import { publicVideoProducts } from '../server/videoCatalog.mjs';

const out = '.tmp/bo';
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
  if (path === '/api/session') return json(200, { ok: true, email: 'probe@example.com', nickname: 'BO' });
  if (path === '/api/video/capabilities') return json(200, CAPS);
  if (path === '/api/video/jobs' && req.method === 'POST') { videoJobs += 1; return json(500, { error: 'BO 探针：不许真实出片' }); }
  if (path === '/api/video/jobs') return json(200, { jobs: [] });
  if (path === '/api/billing/balance') return json(200, { ok: true, currency: 'ec_points', balance: 999, unlimited: false, credits: 999 });
  if (path === '/api/billing/quote') return json(200, { quote: { quoteId: 'bo-1', totalUnits: 1000, currency: 'ec_points' } });
  if (path === '/api/works') return json(200, { works: [] });
  return json(200, { ok: true });
});

/* ── ① 图片侧工作台：缺料提示 + 禁用态 + 悬停后的渐变 ── */
await page.goto(server.base + 'image-creation?id=image.product_suite', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.media-workbench-submit', { timeout: 30000 });
await page.waitForTimeout(1500);
const disabledState = await page.evaluate(() => {
  const submit = document.querySelector('.media-workbench-submit');
  const hint = document.querySelector('.media-workbench-cta-hint');
  const cs = getComputedStyle(submit);
  return {
    hintText: hint?.textContent || '',
    disabled: submit.disabled,
    backgroundImage: cs.backgroundImage,
    background: cs.backgroundColor,
    gradientVar: getComputedStyle(document.documentElement).getPropertyValue('--sb-cta-grad').trim(),
  };
});
await page.screenshot({ path: out + '/01-disabled-hint.png' });

const gradientSpec = await page.evaluate(() => {
  const root = getComputedStyle(document.documentElement);
  return {
    rest: root.getPropertyValue('--sb-cta-grad').trim(),
    hover: root.getPropertyValue('--sb-cta-grad-hover').trim(),
    brand500: root.getPropertyValue('--sb-brand-500').trim(),
    brand600: root.getPropertyValue('--sb-brand-600').trim(),
    brand700: root.getPropertyValue('--sb-brand-700').trim(),
  };
});

/* ── ③ 模型列表：MiniMax H3 与 MiniMax H3 2K 两行 ── */
await gotoHealthy(page, server.base, '.homepage-mode-card');
await page.waitForTimeout(1200);
/* ── ② 启用态：往创作台输入一句提示词，主 CTA 就会亮起来 —— 读它**真的渲染出来**的渐变 ── */
const enabledState = await (async () => {
  const box = await page.evaluate(() => {
    const node = document.querySelector('.video-composer textarea, .video-composer [contenteditable="true"]');
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  if (!box) return { found: false, note: '没找到输入框' };
  await page.mouse.click(box.x, box.y);
  await page.keyboard.type('一只猫在海边散步', { delay: 12 });
  await page.waitForTimeout(1400);
  const rest = await page.evaluate(() => {
    const cta = Array.from(document.querySelectorAll('.shubao-gen-cta')).find(node => !node.disabled);
    if (!cta) return { found: false, note: '页面上没有启用的主 CTA' };
    const cs = getComputedStyle(cta);
    return { found: true, text: cta.textContent.trim().slice(0, 30), backgroundImage: cs.backgroundImage };
  });
  const ctaBox = await page.evaluate(() => {
    const cta = Array.from(document.querySelectorAll('.shubao-gen-cta')).find(node => !node.disabled);
    if (!cta) return null;
    const r = cta.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  });
  let hover = '';
  if (ctaBox) {
    await page.mouse.move(ctaBox.x, ctaBox.y, { steps: 6 });
    await page.waitForTimeout(700);
    hover = await page.evaluate(() => {
      const cta = Array.from(document.querySelectorAll('.shubao-gen-cta')).find(node => !node.disabled);
      return cta ? getComputedStyle(cta).backgroundImage : '';
    });
    await page.mouse.move(40, 400);
    await page.waitForTimeout(300);
  }
  return { ...rest, hoverBackgroundImage: hover };
})();
await page.screenshot({ path: out + '/02-enabled-cta.png' });
await page.click('.video-config-trigger.is-model');
await page.waitForSelector('.video-inline-menu.is-model button', { timeout: 8000 });
await page.waitForTimeout(500);
const menu = await page.evaluate(() => {
  const panel = document.querySelector('.video-inline-menu.is-model');
  const labels = [];
  const rows = [];
  for (const child of panel.children) {
    if (child.classList.contains('video-model-group-label')) labels.push(child.textContent.trim());
    if (child.tagName === 'BUTTON') {
      const b = child.querySelector('b');
      rows.push({
        name: (b?.firstChild?.textContent || '').trim(),
        chip: (b?.querySelector('em')?.textContent || '').trim(),
      });
    }
  }
  return { labels, rows };
});
await page.screenshot({ path: out + '/03-model-menu.png' });

const report = { disabledState, enabledState, gradientSpec, menu, videoJobs };
writeFileSync(out + '/bo-verify.json', JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));

await browser.close();
stopDevServer(server.proc, { owned: server.owned });
