
import { chromium } from 'playwright';
const BASE = process.env.QA_BASE || 'http://[::1]:5173/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const btn = page.locator('button', { hasText: /生成设置/ }).first();
await btn.scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
const geom = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(x => /生成设置/.test(x.innerText));
  const r = b.getBoundingClientRect();
  return { top:+r.top.toFixed(1), bottom:+r.bottom.toFixed(1), h:+r.height.toFixed(1), vh: window.innerHeight };
});
console.log('trigger btn', JSON.stringify(geom));
await btn.click(); await page.waitForTimeout(700);
const info = await page.evaluate(() => {
  const p = document.querySelector('#ec-floating-panel');
  const cs = getComputedStyle(p);
  return {
    inlineStyle: p.getAttribute('style'),
    computed: { height: cs.height, maxHeight: cs.maxHeight, bottom: cs.bottom, top: cs.top, overflowY: cs.overflowY },
    box: (()=>{const r=p.getBoundingClientRect();return {top:+r.top.toFixed(1),bottom:+r.bottom.toFixed(1),h:+r.height.toFixed(1)};})(),
    scrollH: p.scrollHeight, clientH: p.clientHeight,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
