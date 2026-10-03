
import { chromium } from 'playwright';
const browser = await chromium.launch();
for (const vp of [{w:1440,h:900},{w:1280,h:800}]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(process.env.QA_BASE || 'http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const btn = page.locator('button', { hasText: /技能库/ }).first();
  await btn.scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
  await btn.click(); await page.waitForTimeout(1800);
  console.log(vp.w+'x'+vp.h, await page.evaluate(() => {
    const ed = document.querySelector('.skill-column.is-editor');
    const kids = [...ed.children];
    const total = kids.reduce((s,k)=> s + k.getBoundingClientRect().height, 0);
    const gap = parseFloat(getComputedStyle(ed).gap) || 0;
    const ta = ed.querySelector('textarea');
    return {
      editorClientH: ed.clientHeight, editorScrollH: ed.scrollHeight,
      overflows: ed.scrollHeight > ed.clientHeight + 1,
      contentSum: +total.toFixed(1), gaps: +((kids.length-1)*gap).toFixed(1),
      needed: +(total + (kids.length-1)*gap + 24).toFixed(1),
      textareaH: ta ? +ta.getBoundingClientRect().height.toFixed(1) : null,
      childHeights: kids.map(k=>({cls:String(k.className).slice(0,28), h:+k.getBoundingClientRect().height.toFixed(1)})),
    };
  }));
  await ctx.close();
}
await browser.close();
