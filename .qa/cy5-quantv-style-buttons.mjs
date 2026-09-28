/* 只读核对：知渔「设计风格」区那两颗按钮到底是不是同一件事（不点任何带积分的按钮） */
import { chromium } from 'playwright';

const PORT = 9333;
const browser = await chromium.connectOverCDP('http://127.0.0.1:' + PORT);
const ctx = browser.contexts()[0];
const page = ctx.pages().find(p => /image-creation\?tool=product-listing-set/.test(p.url())) || ctx.pages().find(p => /quantv\.com/.test(p.url()));

const info = await page.evaluate(() => {
  const txt = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const btns = Array.from(document.querySelectorAll('button')).filter(b => /AI推荐|解析风格|风格分析/.test(txt(b)) && b.getBoundingClientRect().height > 20);
  return btns.map(b => {
    const r = b.getBoundingClientRect();
    /* 往上找两层，看它挂在谁下面 */
    const up = [];
    let n = b.parentElement;
    for (let i = 0; i < 3 && n; i++) { up.push(n.tagName.toLowerCase() + '.' + String(n.className || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.')); n = n.parentElement; }
    return {
      text: txt(b).slice(0, 30),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      cls: String(b.className || '').slice(0, 80),
      title: b.getAttribute('title') || '',
      aria: b.getAttribute('aria-label') || '',
      disabled: b.disabled,
      parentChain: up.join('  <  '),
      /* 有没有 data-* 之类的身份标记（判断是不是同一个组件/同一档 SKU） */
      data: Array.from(b.attributes).filter(a => /^data-/.test(a.name)).map(a => a.name + '=' + a.value).join(' ').slice(0, 160),
      /* 兄弟里有没有同款（用来判断"两颗是不是孪生"） */
      siblings: Array.from(b.parentElement?.children || []).filter(el => el.tagName === 'BUTTON').length,
    };
  });
});
console.log('知渔 设计风格 区里带 AI推荐/分析 字样的按钮：');
info.forEach((b, i) => {
  console.log('\n【' + (i + 1) + '】「' + b.text + '」 ' + JSON.stringify(b.rect) + (b.disabled ? ' [禁用]' : ''));
  console.log('     class=' + b.cls);
  console.log('     挂在：' + b.parentChain + '   同级按钮数=' + b.siblings);
  if (b.data) console.log('     data: ' + b.data);
  if (b.title || b.aria) console.log('     title/aria: ' + b.title + ' / ' + b.aria);
});
await browser.close().catch(() => {});
