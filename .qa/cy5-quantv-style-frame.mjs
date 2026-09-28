/* 只读：① 知渔设计风格区里有没有 contenteditable 的"结论框" ② 大按钮的祖先链间距 */
import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => /image-creation\?tool=product-listing-set/.test(p.url())) || ctx.pages().find(p => /quantv\.com/.test(p.url()));

const out = await page.evaluate(() => {
  const txt = el => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30);
  const R = el => { const r = el.getBoundingClientRect(); return Math.round(r.top) + '..' + Math.round(r.bottom) + ' h' + Math.round(r.height) + ' x' + Math.round(r.left) + ' w' + Math.round(r.width); };
  /* ① 可编辑元素 */
  const editables = Array.from(document.querySelectorAll('[contenteditable], [contenteditable="true"], [role="textbox"]'))
    .map(el => ({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 40), rect: R(el),
                  editable: el.getAttribute('contenteditable'), text: txt(el) }))
    .filter(x => x.rect.split(' ')[2] !== 'h0');
  /* ② 大按钮的祖先链 + 每一层的 margin/padding */
  const big = Array.from(document.querySelectorAll('button')).find(b => /AI推荐风格分析/.test(txt(b)));
  const chain = [];
  if (big) {
    let n = big;
    for (let i = 0; i < 5 && n; i++) {
      const c = getComputedStyle(n);
      chain.push({ el: n.tagName.toLowerCase() + '.' + String(n.className || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.'),
                   rect: R(n), margin: c.margin, padding: c.padding, display: c.display, justify: c.justifyContent, gap: c.gap,
                   bg: c.backgroundColor, radius: c.borderTopLeftRadius });
      n = n.parentElement;
    }
  }
  return { editables, chain };
});
console.log('① 可编辑元素（可能是"结论框"）：' + (out.editables.length ? '' : '（无）'));
out.editables.forEach(e => console.log('   ' + e.tag + '.' + (e.cls || '—') + '  ' + e.rect + '  contenteditable=' + e.editable + '  「' + e.text + '」'));
console.log('\n② 大按钮祖先链（从按钮往上）：');
out.chain.forEach((c, i) => console.log('   '.repeat(i + 1) + c.el + '  ' + c.rect + '\n' + '   '.repeat(i + 1) +
  '    margin=' + c.margin + ' padding=' + c.padding + ' display=' + c.display + ' justify=' + c.justify + ' gap=' + c.gap + ' r=' + c.radius + ' bg=' + c.bg));
await browser.close().catch(() => {});
