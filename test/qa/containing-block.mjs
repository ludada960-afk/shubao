
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto((process.env.QA_BASE || 'http://127.0.0.1:5173/'), { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const btn = page.locator('button', { hasText: /生成设置/ }).first();
await btn.scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
await btn.click(); await page.waitForTimeout(700);
const info = await page.evaluate(() => {
  const p = document.querySelector('#ec-floating-panel');
  const r = p.getBoundingClientRect();
  let el = p; const chain = [];
  while (el && el !== document.documentElement) {
    const cs = getComputedStyle(el);
    const rr = el.getBoundingClientRect();
    chain.push({ tag: el.tagName, cls: String(el.className).slice(0,40), pos: cs.position, transform: cs.transform, filter: cs.filter, contain: cs.contain, willChange: cs.willChange, h: +rr.height.toFixed(1), top: +rr.top.toFixed(1) });
    el = el.parentElement;
  }
  return { panel: { top:+r.top.toFixed(1), bottom:+r.bottom.toFixed(1), h:+r.height.toFixed(1) }, inlineBottom: getComputedStyle(p).bottom, chain: chain.slice(-4) };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();