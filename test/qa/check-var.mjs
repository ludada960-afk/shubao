
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto((process.env.QA_BASE || 'http://127.0.0.1:5173/'), { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const btn = page.locator('button', { hasText: /生成设置/ }).first();
await btn.scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
await btn.click(); await page.waitForTimeout(700);
console.log(await page.evaluate(() => {
  const p = document.querySelector('#ec-floating-panel');
  const cs = getComputedStyle(p);
  return {
    varSafe: cs.getPropertyValue('--ec-panel-bottom-safe'),
    varX: cs.getPropertyValue('--ec-panel-anchor-x'),
    bottom: cs.bottom,
    inlineBottom: p.style.bottom,
  };
}));
await browser.close();