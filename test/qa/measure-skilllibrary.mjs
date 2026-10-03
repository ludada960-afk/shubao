
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
const browser = await chromium.launch();
const out = {};
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const btn = page.locator('button', { hasText: /技能库/ }).first();
  await btn.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
  await btn.click();
  await page.waitForTimeout(1800);
  const data = await page.evaluate(() => {
    const modal = document.querySelector('.skill-modal');
    if (!modal) return { missing: true };
    const R = el => (el ? +el.getBoundingClientRect().top.toFixed(1) : null);
    const B = el => (el ? +el.getBoundingClientRect().bottom.toFixed(1) : null);
    const W = el => (el ? +el.getBoundingClientRect().width.toFixed(1) : null);
    const H = el => (el ? +el.getBoundingClientRect().height.toFixed(1) : null);
    const D = (a,b) => (a != null && b != null) ? +(a - b).toFixed(1) : null;
    const G = (a,b) => (a != null && b != null) ? +(b - a).toFixed(1) : null;
    const head = document.querySelector('.skill-modal-head');
    const tabs = document.querySelector('.skill-kind-tabs');
    const bodyEl = document.querySelector('.skill-modal-body');
    const cols = [...document.querySelectorAll('.skill-column')];
    const editor = cols[2] || null;
    const list = document.querySelector('.skill-list');
    const cards = [...document.querySelectorAll('.skill-list .skill-card')];
    const fields = [...document.querySelectorAll('.skill-column.is-editor .skill-field')];
    const actions = document.querySelector('.skill-editor-actions');
    const hint = document.querySelector('.skill-hint');
    const ta = document.querySelector('.skill-field textarea');
    const cardGaps = [];
    for (let i=1;i<cards.length;i++) cardGaps.push(G(B(cards[i-1]), R(cards[i])));
    const fieldGaps = [];
    for (let i=1;i<fields.length;i++) fieldGaps.push({ from:(fields[i-1].innerText||'').split('\n')[0].slice(0,8), to:(fields[i].innerText||'').split('\n')[0].slice(0,8), gap: G(B(fields[i-1]), R(fields[i])) });
    const fieldDetail = fields.map(f=>{
      const sp=f.querySelector(':scope > span'); const inp=f.querySelector('input,textarea');
      const cs = getComputedStyle(f);
      return { label:(sp?.innerText||'').slice(0,12), fieldTop:R(f), fieldBottom:B(f), fieldH:H(f), gapCss:cs.gap,
        labelBottom:B(sp), inputTop:R(inp), labelToInputGap: G(B(sp), R(inp)) };
    });
    return {
      modal: { top:R(modal), bottom:B(modal), left:+(modal.getBoundingClientRect().left).toFixed(1), right:+(modal.getBoundingClientRect().right).toFixed(1), w:W(modal), h:H(modal) },
      head: { top:R(head), bottom:B(head), h:H(head), padding:getComputedStyle(head).padding },
      tabs: { top:R(tabs), bottom:B(tabs), h:H(tabs), padding:getComputedStyle(tabs).padding },
      body: { top:R(bodyEl), bottom:B(bodyEl), h:H(bodyEl), padding:getComputedStyle(bodyEl).padding, gap:getComputedStyle(bodyEl).gap, scrollH:bodyEl.scrollHeight, clientH:bodyEl.clientHeight, overflowing: bodyEl.scrollHeight > bodyEl.clientHeight + 1 },
      colHeights: cols.map(H), colTops: cols.map(R), colBottoms: cols.map(B),
      editorCol: { top:R(editor), bottom:B(editor), h:H(editor), padding:editor?getComputedStyle(editor).padding:null, gap:editor?getComputedStyle(editor).gap:null },
      listGap: list ? getComputedStyle(list).gap : null,
      cardCount: cards.length, cardGaps, cardHeights: cards.map(H),
      fieldGaps, fieldDetail,
      textareaH: H(ta),
      hintBox: { top:R(hint), bottom:B(hint), h:H(hint) },
      actionsBox: { top:R(actions), bottom:B(actions), h:H(actions) },
      hintToActions: G(B(hint), R(actions)),
      lastFieldToHint: G(B(fields[fields.length-1]), R(hint)),
      textareaToActions: (()=>{ const lastF = fields[fields.length-1]; return G(B(lastF), R(actions)); })(),
      actionsToEditorBottom: D(B(editor), B(actions)),
      editorBottomToModalBottom: D(B(modal), B(editor)),
      headToTabs: G(B(head), R(tabs)),
      tabsToBody: G(B(tabs), R(bodyEl)),
      headSubtitleGap: (()=>{const t=document.querySelector('.skill-modal-head strong');const s=document.querySelector('.skill-modal-head span');return G(B(t), R(s));})(),
      overlayPadding: getComputedStyle(document.querySelector('.skill-modal-overlay')).padding,
      modalMinH: getComputedStyle(modal).minHeight, modalMaxH: getComputedStyle(modal).maxHeight,
    };
  });
  out[vp.name] = data;
  await page.screenshot({ path: OUT + '/' + TAG + '-skilllibrary-' + vp.name + '.png' });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 2));
await browser.close();