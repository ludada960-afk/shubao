/* 批 BZ 复验：视频子页面左栏的"嵌套白卡"层数 —— 数一数每个 block 自己的描边/底色。
   判据：block 自己**没有**描边与白底（返回 transparent / 0px），块间靠发丝线分隔。 */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/video/capabilities') return json({ loading: false, generationEnabled: true, workbenchEnabled: false, directorUi: false, uploadMode: 'tus', defaultProductId: 'seedance_standard', products: [] });
  if (path === '/api/video/jobs') return json({ jobs: [] });
  return json({ ok: true });
});
await page.goto(server.base.replace(/\/$/, '') + '/video-creation?id=video.smart', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3500);
const out = await page.evaluate(() => {
  const blocks = Array.from(document.querySelectorAll('.video-wb-block'));
  return {
    blockCount: blocks.length,
    blocks: blocks.map((node, i) => {
      const cs = getComputedStyle(node);
      return {
        i,
        title: (node.querySelector('.media-workbench-group-title, strong')?.textContent || '').trim().slice(0, 10),
        padding: cs.paddingTop,
        border: cs.borderTopWidth + ' ' + cs.borderTopColor,
        radius: cs.borderTopLeftRadius,
        bg: cs.backgroundColor,
      };
    }),
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
