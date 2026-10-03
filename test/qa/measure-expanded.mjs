
import { chromium } from 'playwright';
const browser = await chromium.launch();
const out = {};
for (const vp of [{w:1440,h:900},{w:1280,h:800}]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(process.env.QA_BASE || 'http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const btn = page.locator('button', { hasText: /生成设置/ }).first();
  await btn.scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
  await btn.click(); await page.waitForTimeout(700);
  // expand the model list (the tallest realistic state)
  const toggle = page.locator('#ec-floating-panel button[aria-expanded]').first();
  await toggle.click(); await page.waitForTimeout(600);
  const info = await page.evaluate(() => {
    const p = document.querySelector('#ec-floating-panel');
    const r = p.getBoundingClientRect();
    return { top:+r.top.toFixed(1), bottom:+r.bottom.toFixed(1), h:+r.height.toFixed(1),
      scrollH:p.scrollHeight, clientH:p.clientHeight, scrollbar: p.scrollHeight > p.clientHeight + 1,
      onScreen: r.top >= 0 && r.bottom <= innerHeight,
      vh: innerHeight };
  });
  out[vp.w+'x'+vp.h] = info;
  await page.screenshot({ path: '.tmp/skillgen-qa/after-gensettings-expanded-'+vp.w+'x'+vp.h+'.png' });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 2));
await browser.close();