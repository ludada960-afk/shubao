/* 只读：知渔「设计风格」芯片(1044) 与 大按钮(1163) 之间那 119px 里是什么 */
import { chromium } from 'playwright';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => /image-creation\?tool=product-listing-set/.test(p.url())) || ctx.pages().find(p => /quantv\.com/.test(p.url()));
const out = await page.evaluate(() => {
  const txt = el => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 34);
  const rows = [];
  document.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.height < 4 || r.width < 40) return;
    if (r.top < 1030 || r.bottom > 1180) return;          /* 只看那一段 */
    if (r.height > 200) return;                            /* 排掉外层大容器 */
    const c = getComputedStyle(el);
    rows.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 46),
                y: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width), x: Math.round(r.left),
                bg: c.backgroundColor, bd: c.borderTopColor, bdW: c.borderTopWidth, r: c.borderTopLeftRadius,
                ph: el.getAttribute('placeholder') || '', text: txt(el) });
  });
  /* 按 top 排序，只看"最像实体"的那几层（有底色/描边/占位符/文字的） */
  rows.sort((a, b) => a.y - b.y || a.h - b.h);
  return rows.filter(x => x.bg !== 'rgba(0, 0, 0, 0)' || x.bdW !== '0px' || x.ph || x.text).slice(0, 18);
});
console.log('1030~1180 这一段里的实体元素（y 升序）：');
out.forEach(x => console.log('  ' + String(x.y).padStart(5) + ' h' + String(x.h).padStart(4) + ' w' + String(x.w).padStart(5) +
  ' x' + String(x.x).padStart(5) + '  ' + x.tag + '.' + x.cls.padEnd(44) + ' bg=' + x.bg.padEnd(22) + ' bd=' + x.bdW + '/' + x.bd +
  (x.r ? ' r=' + x.r : '') + (x.ph ? ' ph=「' + x.ph.slice(0, 24) + '」' : '') + (x.text ? ' 「' + x.text + '」' : '')));
await browser.close().catch(() => {});
