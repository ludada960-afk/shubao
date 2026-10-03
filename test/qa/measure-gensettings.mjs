
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.QA_BASE || 'http://127.0.0.1:5173/';
const OUT = process.argv[2] || '.tmp/skillgen-qa';
const TAG = process.argv[3] || 'before';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1280x800', width: 1280, height: 800 },
];

const box = async (page, sel) => page.evaluate(s => {
  const el = document.querySelector(s);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
    bottom: +r.bottom.toFixed(1), top: +r.top.toFixed(1),
    scrollH: el.scrollHeight, clientH: el.clientHeight,
    overflowingY: el.scrollHeight > el.clientHeight + 1,
    overflowY: cs.overflowY, padding: cs.padding, gap: cs.gap, maxHeight: cs.maxHeight,
  };
}, sel);

const out = { panels: {}, library: {} };
const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  /* ── 生成设置面板 ── */
  const btn = page.locator('button', { hasText: /生成设置/ }).first();
  await btn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await btn.click();
  await page.waitForTimeout(600);

  const panel = await box(page, '#ec-floating-panel');
  // measure spacing between direct children of the inner padding wrapper
  const inner = await page.evaluate(() => {
    const body = document.querySelector('#ec-floating-panel .ec-config-panel-body');
    if (!body) return null;
    const wrap = body.firstElementChild;
    const kids = [...wrap.children];
    const rects = kids.map(k => { const r = k.getBoundingClientRect(); return { tag: k.tagName, cls: k.className, top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), h: +r.height.toFixed(1), text: (k.innerText||'').slice(0,18) }; });
    const gaps = [];
    for (let i = 1; i < rects.length; i++) gaps.push({ from: rects[i-1].text, to: rects[i].text, gap: +(rects[i].top - rects[i-1].bottom).toFixed(1) });
    const cs = getComputedStyle(wrap);
    // label -> control gaps
    const labelGaps = [];
    for (const lab of wrap.querySelectorAll('label')) {
      const parent = lab.parentElement;
      const lr = lab.getBoundingClientRect();
      let ctrl = null;
      for (const c of parent.children) { if (c !== lab) { ctrl = c; break; } }
      if (ctrl) { const cr = ctrl.getBoundingClientRect(); labelGaps.push({ label: (lab.innerText||'').slice(0,16), gap: +(cr.top - lr.bottom).toFixed(1) }); }
    }
    return { wrapPadding: cs.padding, wrapGap: cs.gap, childCount: kids.length, rects, gaps, labelGaps };
  });
  const panelBottom = panel ? panel.bottom : null;
  const docInfo = await page.evaluate(() => ({
    docOverflow: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
    scrollH: document.documentElement.scrollHeight, clientH: document.documentElement.clientHeight,
  }));
  out.panels[vp.name] = { panel, inner, panelBottom, docInfo };
  await page.screenshot({ path: OUT + '/' + TAG + '-gensettings-' + vp.name + '.png' });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 2));
await browser.close();