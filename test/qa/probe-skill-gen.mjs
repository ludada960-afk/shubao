
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.QA_BASE || 'http://localhost:5173/';
const OUT = process.argv[2] || '.tmp/skillgen-qa';
const TAG = process.argv[3] || 'before';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
];

const rect = async (page, sel) => page.evaluate(s => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
    top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), left: +r.left.toFixed(1), right: +r.right.toFixed(1),
    scrollH: el.scrollHeight, clientH: el.clientHeight, scrollW: el.scrollWidth, clientW: el.clientWidth,
    overflowY: cs.overflowY, padding: cs.padding, gap: cs.gap,
    hasScrollbarY: el.scrollHeight > el.clientHeight + 1,
    hasScrollbarX: el.scrollWidth > el.clientWidth + 1,
  };
}, sel);

const out = { viewports: {} };
const browser = await chromium.launch();
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const info = { url: page.url(), title: await page.title() };
  // document-level scrollbar
  info.docScroll = await page.evaluate(() => ({
    scrollH: document.documentElement.scrollHeight,
    clientH: document.documentElement.clientHeight,
    overflow: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
  }));
  info.bodyText = (await page.evaluate(() => document.body.innerText.slice(0, 400)));
  info.buttons = await page.evaluate(() => [...document.querySelectorAll('button')].map(b => (b.innerText || b.getAttribute('aria-label') || '').trim()).filter(Boolean).slice(0, 60));
  out.viewports[vp.name] = info;
  await page.screenshot({ path: OUT + '/' + TAG + '-home-' + vp.name + '.png', fullPage: false });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 2));
await browser.close();
