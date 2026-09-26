/* 批 BW 复验：视频子页面 ①技能信息卡已消失 ②教学入口仍在（且已挪到右栏页签行）③左栏第一个字段贴顶 */
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
  if (path === '/api/video/capabilities') {
    return json({ loading: false, generationEnabled: true, workbenchEnabled: false, directorUi: false, uploadMode: 'tus', defaultProductId: 'seedance_standard', products: [] });
  }
  if (path === '/api/video/jobs') return json({ jobs: [] });
  return json({ ok: true });
});
await page.goto(server.base.replace(/\/$/, '') + '/video-creation?id=video.smart', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3500);
const out = await page.evaluate(() => {
  const left = document.querySelector('.media-workbench-left');
  const first = document.querySelector('.media-workbench-group, .media-field');
  const tutorials = Array.from(document.querySelectorAll('.media-workbench-tutorial'));
  return {
    hasSkillCard: Boolean(document.querySelector('.media-skill-card')),
    tutorialCount: tutorials.length,
    tutorialInsideTabsRow: tutorials.some(node => node.closest('.media-workbench-tabs-row')),
    hasTabsRow: Boolean(document.querySelector('.media-workbench-tabs-row')),
    leftTop: left ? Math.round(left.getBoundingClientRect().top) : null,
    firstFieldTop: first ? Math.round(first.getBoundingClientRect().top) : null,
  };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
