
import { chromium } from 'playwright';
const BASE = process.env.QA_BASE || 'http://127.0.0.1:5173/';
const browser = await chromium.launch();
for (const vp of [{w:1440,h:900},{w:1280,h:800}]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const btn = page.locator('button', { hasText: /生成设置/ }).first();
  await btn.scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
  const g = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /生成设置/.test(x.innerText));
    const r = b.getBoundingClientRect();
    const nav = document.querySelector('header') || document.querySelector('.app-header') || document.querySelector('nav');
    const navR = nav ? nav.getBoundingClientRect() : null;
    return { btnTop:+r.top.toFixed(1), btnH:+r.height.toFixed(1), vh: innerHeight,
      navBottom: navR ? +navR.bottom.toFixed(1) : null,
      available: +(r.top - (navR ? navR.bottom : 0)).toFixed(1) };
  });
  console.log(vp.w+'x'+vp.h, JSON.stringify(g));
  await ctx.close();
}
await browser.close();