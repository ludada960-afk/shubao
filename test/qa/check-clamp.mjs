
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
  // read the raw declaration from the stylesheet rule
  let rawBottom = null;
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules) {
      if (r.selectorText && r.selectorText.includes('.ec-config-panel') && r.style && r.style.bottom) rawBottom = r.style.bottom;
    }
  }
  return { csBottom: cs.bottom, csPriority: cs.getPropertyPriority('bottom'), rawBottom,
    supportsClamp: CSS.supports('bottom', 'clamp(84px, 436px, calc(100vh - 200px))'),
    testClamp: (()=>{ const d=document.createElement('div'); d.style.bottom='clamp(84px, 436px, calc(100vh - 200px))'; d.style.position='fixed'; document.body.appendChild(d); const v=getComputedStyle(d).bottom; d.remove(); return v; })() };
}));
await browser.close();