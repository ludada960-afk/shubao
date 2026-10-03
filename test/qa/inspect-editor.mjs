
import { chromium } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(process.env.QA_BASE || 'http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const btn = page.locator('button', { hasText: /技能库/ }).first();
await btn.scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
await btn.click(); await page.waitForTimeout(1800);
console.log(JSON.stringify(await page.evaluate(() => {
  const ed = document.querySelector('.skill-column.is-editor');
  const cs = getComputedStyle(ed);
  const kids = [...ed.children];
  const boxes = kids.map(k => { const r=k.getBoundingClientRect(); const s=getComputedStyle(k); return {cls:String(k.className).slice(0,26), top:+r.top.toFixed(1), bottom:+r.bottom.toFixed(1), h:+r.height.toFixed(1), mt:s.marginTop, mb:s.marginBottom, pb:s.paddingBottom}; });
  const gaps=[]; for(let i=1;i<boxes.length;i++) gaps.push(+(boxes[i].top - boxes[i-1].bottom).toFixed(1));
  return { display: cs.display, gap: cs.gap, rowGap: cs.rowGap, padBottom: cs.paddingBottom, boxes, gaps, colH: cs.height, boxSizing: cs.boxSizing };
}), null, 2));
await browser.close();
