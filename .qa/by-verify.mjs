/* 批 BY 复验：视频子页面 ①不再有重复的「生成记录」②生成按钮贴栏底 ③右栏示例/历史仍在 */
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
  const cta = document.querySelector('.video-submit-row');
  const composer = document.querySelector('.video-composer.is-workbench');
  const col = document.querySelector('.media-workbench-left');
  const box = node => (node ? node.getBoundingClientRect() : null);
  const cb = box(cta);
  const kb = box(composer);
  const lb = box(col);
  return {
    historyBlocks: document.querySelectorAll('.video-history').length,
    hasTabsRow: Boolean(document.querySelector('.media-workbench-tabs-row')),
    hasCasesTab: Boolean(document.querySelector('.media-workbench-tabs')),
    ctaBottom: cb ? Math.round(cb.bottom) : null,
    composerBottom: kb ? Math.round(kb.bottom) : null,
    columnBottom: lb ? Math.round(lb.bottom) : null,
    ctaGapToComposerBottom: cb && kb ? Math.round(kb.bottom - cb.bottom) : null,
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
