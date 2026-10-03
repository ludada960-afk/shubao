
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
  // descend: body -> div[style padding] (the inner wrapper found in JSX)
  const walk = (el, depth, acc) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    acc.push({ depth, tag: el.tagName, cls: String(el.className).slice(0,40), pad: cs.padding, gap: cs.gap, display: cs.display,
      top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1),
      text: (el.innerText||'').replace(/\n/g,'|').slice(0,26) });
    return acc;
  };
  // find the wrapper that has non-zero padding
  let node = body; const chain = [];
  while (node && chain.length < 6) {
    chain.push(walk(node, chain.length, []).pop());
    node = node.firstElementChild;
  }
  // the actual sections container
  const sect = body.querySelector('div[style*="flex-direction"], div');
  // find container whose children >= 3
  let container = null;
  const all = [body, ...body.querySelectorAll('div')];
  for (const d of all) {
    const cs = getComputedStyle(d);
    if (cs.display === 'flex' && cs.flexDirection === 'column' && d.children.length >= 3) { container = d; break; }
  }
  let sections = null;
  if (container) {
    const kids = [...container.children];
    const rects = kids.map(k => { const r = k.getBoundingClientRect(); return { tag: k.tagName, top:+r.top.toFixed(1), bottom:+r.bottom.toFixed(1), h:+r.height.toFixed(1), text:(k.innerText||'').replace(/\n/g,'|').slice(0,26) }; });
    const gaps=[]; for(let i=1;i<rects.length;i++) gaps.push({from:rects[i-1].text,to:rects[i].text,gap:+(rects[i].top-rects[i-1].bottom).toFixed(1)});
    const ccs = getComputedStyle(container);
    sections = { cls: String(container.className).slice(0,40), pad: ccs.padding, gap: ccs.gap, childCount: kids.length, rects, gaps,
      containerTop: +container.getBoundingClientRect().top.toFixed(1), containerBottom: +container.getBoundingClientRect().bottom.toFixed(1) };
  }
  // label->control gaps within each section
  const labelGaps = [];
  for (const lab of body.querySelectorAll('label')) {
    const p = lab.parentElement; const lr = lab.getBoundingClientRect();
    let ctrl=null; for (const c of p.children) if (c!==lab) { ctrl=c; break; }
    if (ctrl) labelGaps.push({ label:(lab.innerText||'').slice(0,16), gap:+(ctrl.getBoundingClientRect().top-lr.bottom).toFixed(1), labMarginBottom:getComputedStyle(lab).marginBottom });
  }
  return { chain, sections, labelGaps, panelBottom:+panel.getBoundingClientRect().bottom.toFixed(1) };
});
console.log(JSON.stringify(dump, null, 2));
await browser.close();