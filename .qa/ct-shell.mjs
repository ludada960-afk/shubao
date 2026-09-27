/* 批 CT：把视频侧工作台那几层壳的**宽度/内边距/底色/描边**一次量清（决定"内容列 510 vs 554"该怎么对齐）。 */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const mock = async page => page.route('**/api/**', route => {
  const p = new URL(route.request().url()).pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (p === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (p === '/api/works') return json({ works: [] });
  if (p === '/api/video/capabilities') return json({ loading: false, generationEnabled: true, workbenchEnabled: false, directorUi: false, uploadMode: 'tus', products: [] });
  if (p === '/api/video/jobs') return json({ jobs: [] });
  return json({ ok: true });
});

for (const [label, url, sel] of [
  ['视频侧 video.image_to_video', '/video-creation?id=video.image_to_video', '.video-wb-block'],
  ['图片侧 image.product_suite', '/image-creation?id=image.product_suite', '.media-field'],
]) {
  const page = await browser.newPage({ viewport: { width: 1932, height: 1080 } });
  await mock(page);
  await page.goto(base + url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3400);
  const rows = await page.evaluate(sel => {
    const el = document.querySelector(sel);
    const out = [];
    let node = el;
    while (node) {
      const r = node.getBoundingClientRect();
      const cs = getComputedStyle(node);
      out.push({
        tag: node.tagName.toLowerCase() + '.' + String(node.className || '').split(' ').slice(0, 2).join('.'),
        x: Math.round(r.x), w: Math.round(r.width),
        pad: cs.paddingLeft + '/' + cs.paddingRight,
        bg: cs.backgroundImage && cs.backgroundImage !== 'none' ? 'gradient' : cs.backgroundColor,
        border: cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor,
        radius: cs.borderTopLeftRadius,
      });
      node = node.parentElement;
    }
    return out;
  }, sel);
  console.log('\n===== ' + label + ' （从字段块往上，全部祖先）=====');
  for (const r of rows) console.log('  ' + r.tag.padEnd(44) + ' x=' + String(r.x).padStart(4) + ' w=' + String(r.w).padStart(4) + ' pad=' + r.pad.padEnd(16) + ' bg=' + String(r.bg).slice(0, 30).padEnd(32) + ' border=' + r.border + ' r=' + r.radius);
  /* 页面白面/暖盒的视觉边界：把所有"有底色或描边"的祖先挑出来 */
  await page.close();
}
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
