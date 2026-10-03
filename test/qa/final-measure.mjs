
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = '.tmp/skillgen-qa';
mkdirSync(OUT, { recursive: true });
const VPS = [{ name:'1440x900', width:1440, height:900 }, { name:'1280x800', width:1280, height:800 }];
const browser = await chromium.launch();
const report = { genSettings: {}, skillLibrary: {} };

for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2600);

  /* ---- 生成设置面板 ---- */
  const btn = page.locator('button', { hasText: /生成设置/ }).first();
  await btn.scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
  await btn.click(); await page.waitForTimeout(800);
  report.genSettings[vp.name] = await page.evaluate(() => {
    const p = document.querySelector('#ec-floating-panel');
    const r = p.getBoundingClientRect();
    const wrap = p.querySelector('.ec-config-panel-body').firstElementChild;
    const cs = getComputedStyle(wrap);
    const kids = [...wrap.children];
    const rects = kids.map(k => { const b = k.getBoundingClientRect(); return { top:+b.top.toFixed(1), bottom:+b.bottom.toFixed(1) }; });
    const gaps = []; for (let i=1;i<rects.length;i++) gaps.push(+(rects[i].top-rects[i-1].bottom).toFixed(1));
    const labelGaps = [];
    for (const lab of wrap.querySelectorAll('label')) {
      const par = lab.parentElement; let ctrl=null;
      for (const c of par.children) if (c!==lab) { ctrl=c; break; }
      const t = (lab.innerText||'').trim();
      if (ctrl && t) labelGaps.push({ label:t, gap:+(ctrl.getBoundingClientRect().top - lab.getBoundingClientRect().bottom).toFixed(1) });
    }
    const docOverflow = document.documentElement.scrollHeight > document.documentElement.clientHeight + 1;
    return {
      panel: { w:+r.width.toFixed(1), h:+r.height.toFixed(1), top:+r.top.toFixed(1), bottom:+r.bottom.toFixed(1) },
      fullyOnScreen: r.top >= 60 && r.bottom <= innerHeight,
      panelScrollbar: p.scrollHeight > p.clientHeight + 1,
      padding: cs.padding, sectionGap: cs.gap,
      sectionGapsPx: gaps, labelGaps,
      docScrollbar: docOverflow,
    };
  });
  await page.screenshot({ path: OUT + '/FINAL-gensettings-' + vp.name + '.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  await page.evaluate(() => { const b=[...document.querySelectorAll('button')].find(x=>/生成设置/.test(x.innerText)); if(b) b.click(); });
  await page.waitForTimeout(500);

  /* ---- 技能库弹窗 ---- */
  const sk = page.locator('button', { hasText: /技能库/ }).first();
  await sk.scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
  await sk.click(); await page.waitForTimeout(2000);
  report.skillLibrary[vp.name] = await page.evaluate(() => {
    const modal = document.querySelector('.skill-modal');
    const m = modal.getBoundingClientRect();
    const map = (el) => { const b = el.getBoundingClientRect(); return { top:+b.top.toFixed(1), bottom:+b.bottom.toFixed(1), h:+b.height.toFixed(1) }; };
    const head = document.querySelector('.skill-modal-head');
    const tabs = document.querySelector('.skill-kind-tabs');
    const bodyEl = document.querySelector('.skill-modal-body');
    const cols = [...document.querySelectorAll('.skill-column')];
    const editor = document.querySelector('.skill-column.is-editor');
    const fields = [...document.querySelectorAll('.skill-column.is-editor .skill-field')];
    const actions = document.querySelector('.skill-editor-actions');
    const hint = document.querySelector('.skill-hint');
    const list = document.querySelector('.skill-list');
    const fGaps = []; for (let i=1;i<fields.length;i++) fGaps.push(+(fields[i].getBoundingClientRect().top - fields[i-1].getBoundingClientRect().bottom).toFixed(1));
    const lGaps = []; for (let i=1;i<list.children.length;i++) lGaps.push(+(list.children[i].getBoundingClientRect().top - list.children[i-1].getBoundingClientRect().bottom).toFixed(1));
    const ab = map(actions);
    return {
      modal: { w:+m.width.toFixed(1), h:+m.height.toFixed(1), top:+m.top.toFixed(1), bottom:+m.bottom.toFixed(1) },
      fullyOnScreen: m.top >= 0 && m.bottom <= innerHeight,
      headHeight: +head.getBoundingClientRect().height.toFixed(1),
      headPadding: getComputedStyle(head).padding,
      headToTabs: +(tabs.getBoundingClientRect().top - head.getBoundingClientRect().bottom).toFixed(1),
      bodyPadding: getComputedStyle(bodyEl).padding,
      bodyScrollbar: bodyEl.scrollHeight > bodyEl.clientHeight + 1,
      columnTops: cols.map(c=>+c.getBoundingClientRect().top.toFixed(1)),
      columnBottoms: cols.map(c=>+c.getBoundingClientRect().bottom.toFixed(1)),
      editorScrollbar: editor.scrollHeight > editor.clientHeight + 1,
      fieldGapsPx: fGaps,
      listGapsPx: lGaps,
      listGapCss: getComputedStyle(list).gap,
      actionsBottom: ab.bottom,
      actionsFullyVisible: ab.bottom <= editor.getBoundingClientRect().bottom + 0.5 && ab.bottom <= m.bottom,
      actionsToModalBottom: +(m.bottom - ab.bottom).toFixed(1),
      editorBottomToModalBottom: +(m.bottom - editor.getBoundingClientRect().bottom).toFixed(1),
      hintToActions: +(actions.getBoundingClientRect().top - hint.getBoundingClientRect().bottom).toFixed(1),
      docScrollbar: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
    };
  });
  await page.screenshot({ path: OUT + '/FINAL-skilllibrary-' + vp.name + '.png' });
  await ctx.close();
}
console.log(JSON.stringify(report, null, 2));
await browser.close();
