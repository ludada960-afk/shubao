
import { chromium } from 'playwright';
const BASE = process.env.QA_BASE || 'http://127.0.0.1:5173/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const btn = page.locator('button', { hasText: /生成设置/ }).first();
await btn.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
await btn.click(); await page.waitForTimeout(600);
const dump = await page.evaluate(() => {
  const panel = document.querySelector('#ec-floating-panel');
  const body = panel.querySelector('.ec-config-panel-body');
  const wrap = body.firstElementChild;
  const cs = getComputedStyle(wrap);
  const kids = [...wrap.children];
  const rects = kids.map(k => { const r = k.getBoundingClientRect(); return { tag: k.tagName, top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1), text: (k.innerText||'').replace(/\n/g,'|').slice(0,30) }; });
  const gaps = [];
  for (let i=1;i<rects.length;i++) gaps.push({ from: rects[i-1].text, to: rects[i].text, gap: +(rects[i].top-rects[i-1].bottom).toFixed(1) });
  // also effective on-screen gap accounting for inner label marginBottom
  const panelCs = getComputedStyle(panel);
  return {
    wrapPadding: cs.padding, wrapGap: cs.gap, wrapDisplay: cs.display,
    childCount: kids.length, rects, gaps,
    header: (()=>{const h=document.querySelector('.ec-config-panel-header'); const r=h.getBoundingClientRect(); return {h:+r.height.toFixed(1), top:+r.top.toFixed(1), bottom:+r.bottom.toFixed(1), padding:getComputedStyle(h).padding};})(),
    panelPadding: panelCs.padding, panelBorder: panelCs.borderWidth,
    bodyPadding: getComputedStyle(body).padding,
    firstChildTopGap: +(rects[0].top - document.querySelector('.ec-config-panel-header').getBoundingClientRect().bottom).toFixed(1),
    lastChildToPanelBottom: +(panel.getBoundingClientRect().bottom - rects[rects.length-1].bottom).toFixed(1),
  };
});
console.log(JSON.stringify(dump, null, 2));
await page.screenshot({ path: '.tmp/skillgen-qa/before-gensettings-detail.png' });
await browser.close();