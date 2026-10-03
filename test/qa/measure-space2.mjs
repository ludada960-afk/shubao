
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
    // walk ancestors collecting fixed/sticky headers
    const fixed = [];
    document.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el);
      if ((cs.position === 'fixed' || cs.position === 'sticky') && el.getBoundingClientRect().height > 20 && el.getBoundingClientRect().top < 80) {
        const rr = el.getBoundingClientRect();
        fixed.push({ tag: el.tagName, cls: String(el.className).slice(0,40), top:+rr.top.toFixed(1), bottom:+rr.bottom.toFixed(1), h:+rr.height.toFixed(1), pos: cs.position, z: cs.zIndex });
      }
    });
    return { btnTop:+r.top.toFixed(1), vh: innerHeight, fixed: fixed.slice(0,10) };
  });
  console.log(vp.w+'x'+vp.h, JSON.stringify(g, null, 2));
  await ctx.close();
}
await browser.close();