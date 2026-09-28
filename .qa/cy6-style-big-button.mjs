/* ═══ 批 CY-⑥ 探针：设计风格那一格的**整颗动作按钮**（照知渔：芯片下面那颗）═══════════════════════
   用户原话（逐字，批注图第 3 条）：
   「你看一下**人家 AI 推荐风格**，它这里是有个按钮的。他点击这个按钮才会生成结果在这里啊。他这个按钮
     其实就跟右上角那个 AI 推荐应该是同一个按钮的。」「你这里为什么跟他不一样呢？**不是说要照抄吗**？」
   量什么（**只量不点** —— 这是付费动作，点一下真扣 0.2 积分）：
     ① 按钮存在、文案与价钱在按钮上；
     ② 几何：高 / 最小宽 / 圆角 / 内边距 / 字号 —— 与知渔那颗（45 / 180 / 10 / 19.84 / 16.12）对照；
     ③ 位置：在「设计风格」三档芯片与**这一档的内容框**（AI推荐档 = 「设计风格要求」textarea）**下面**，
        且**相对字段列居中**；
     ④ 三档都在（点芯片是免费的）——且每档都落在该档可见内容的下面。
   用法：node .qa/cy6-style-big-button.mjs
   ─────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 140)));

await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/video/capabilities') return json({ loading: false, generationEnabled: true, workbenchEnabled: false, directorUi: false, uploadMode: 'tus', products: [] });
  if (/skills/.test(path)) return json({ ok: true, builtin: [], mine: [], groups: [] });
  return json({ ok: true, items: [], draft: null, templates: [] });
});
await page.addInitScript(() => {
  const future = new Date(Date.now() + 3600 * 1000).toISOString();
  localStorage.setItem('sb-auth', JSON.stringify({ id: 'p@e.com', email: 'p@e.com', nickname: 'P', token: 't', expiresAt: future }));
});

const MEASURE = `(() => {
  const R = el => { const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) }; };
  const txt = el => (el.textContent || '').replace(/\\s+/g, ' ').trim();
  const wrap = document.querySelector('.media-workbench-field-action');
  const btn = wrap ? wrap.querySelector('button, .media-workbench-paid') : null;
  const col = document.querySelector('.media-workbench-left') || document.querySelector('.media-workbench-fields');
  const chips = Array.from(document.querySelectorAll('.media-field-segmented button'));
  const styleChips = chips.filter(b => ['AI推荐', '参考排版', '自定义要求'].includes(txt(b)));
  const boxes = Array.from(document.querySelectorAll('.media-field textarea'));
  const cs = btn ? getComputedStyle(btn) : null;
  const cr = btn ? btn.getBoundingClientRect() : null;
  const wr = wrap ? wrap.getBoundingClientRect() : null;
  const colR = col ? col.getBoundingClientRect() : null;
  /* 谁在按钮"上面"（用来证"结果框在上、按钮在下"） */
  const above = cr ? Array.from(document.querySelectorAll('.media-field, .media-field-textarea, .media-field-segmented, textarea'))
    .filter(el => el.getBoundingClientRect().bottom <= cr.top + 2 && el.getBoundingClientRect().bottom > 0)
    .map(el => ({ el: el.className.split(/\\s+/).slice(0, 2).join('.'), bottom: Math.round(el.getBoundingClientRect().bottom),
                  text: (el.getAttribute('placeholder') || txt(el)).replace(/\\s+/g, ' ').slice(0, 22) }))
    .sort((a, b) => b.bottom - a.bottom).slice(0, 3) : [];
  return {
    hasWrap: Boolean(wrap), btnText: btn ? txt(btn).slice(0, 30) : '',
    btn: btn ? R(btn) : null,
    style: cs ? { h: cs.height, minW: cs.minWidth, radius: cs.borderTopLeftRadius, padX: cs.paddingLeft,
                  font: cs.fontSize + '/' + cs.fontWeight, border: cs.borderTopWidth + ' ' + cs.borderTopColor,
                  bg: cs.backgroundColor, image: cs.backgroundImage.slice(0, 46) } : null,
    wrap: wr ? { x: Math.round(wr.x), w: Math.round(wr.width) } : null,
    col: colR ? { x: Math.round(colR.x), w: Math.round(colR.width) } : null,
    centered: (cr && wr && colR) ? Math.round((cr.left + cr.width / 2) - (wr.left + wr.width / 2)) : null,
    chips: styleChips.map(b => ({ t: txt(b), rect: R(b), cls: String(b.className || '').slice(0, 40), pressed: b.getAttribute('aria-pressed') || '' })).slice(0, 3),
    textareas: boxes.map(b => ({ ph: (b.getAttribute('placeholder') || '').slice(0, 26), rect: R(b), val: (b.value || '').slice(0, 20) })),
    above,
    activeChip: (Array.from(document.querySelectorAll('.media-field-segmented button')).find(b => b.className.includes('is-selected'))?.textContent || '').trim(),
    visibleFields: Array.from(document.querySelectorAll('.media-field'))
      .map(el => (el.querySelector('.media-field-label')?.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 14)).filter(Boolean),
    uploads: document.querySelectorAll('.media-field-upload-box').length,
  };
})()`;

await page.goto(base + '/image-creation?id=image.product_suite', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);

const m = await page.evaluate(MEASURE);
console.log('=== AI推荐档（默认）===');
console.log('  容器存在=' + m.hasWrap + '  按钮=「' + m.btnText + '」  当前选中档=「' + m.activeChip + '」');
console.log('  可见字段：' + m.visibleFields.join(' / ') + '   上传框数=' + m.uploads);
console.log('  按钮 rect=' + JSON.stringify(m.btn));
console.log('  样式=' + JSON.stringify(m.style));
console.log('  容器 x' + m.wrap?.x + ' w' + m.wrap?.w + ' / 左栏 x' + m.col?.x + ' w' + m.col?.w + '  相对容器居中偏差=' + m.centered + 'px');
console.log('  三档芯片：' + m.chips.map(c => c.t + JSON.stringify(c.rect)).join('  '));
console.log('  按钮上方的字段/输入框（最近的 3 个）：');
m.above.forEach(a => console.log('     y_bottom=' + a.bottom + '  ' + a.el + '  「' + a.text + '」'));
console.log('  本页 textarea：' + m.textareas.map(t => JSON.stringify(t.rect) + ' ph「' + t.ph + '」').join('  '));

/* 三档都点一遍（点芯片免费），看按钮是否都在、且都落在该档可见内容下面。
   ⚠️ 必须走 locator.click（它会自动滚进视口）—— 裸坐标点击时芯片中心 y≈1006 已经掉出 1000 高的视口，
      点了等于没点，四次测量长得一模一样（第一版就栽在这儿）。 */
for (const chip of ['参考排版', '自定义要求', 'AI推荐']) {
  const chipBtn = page.locator('.media-field-segmented button', { hasText: new RegExp('^' + chip + '$') }).first();
  if (!(await chipBtn.count())) { console.log('\n=== ' + chip + ' 档：找不到芯片 ==='); continue; }
  await chipBtn.click({ timeout: 8000 }).catch(e => console.log('  芯片点不动：' + String(e.message).slice(0, 60)));
  await page.waitForTimeout(800);
  const mm = await page.evaluate(MEASURE);
  console.log('\n=== ' + chip + ' 档 ===');
  console.log('  按钮存在=' + mm.hasWrap + '  rect=' + JSON.stringify(mm.btn) + '  居中偏差=' + mm.centered + 'px');
  console.log('  芯片状态：' + mm.chips.map(c => c.t + '(' + (c.cls.includes('is-') ? c.cls.split(/\s+/).find(x => /^is-/.test(x)) : c.pressed || '-') + ')').join('  '));
  console.log('  可见字段：' + mm.visibleFields.join(' / ') + '   上传框数=' + mm.uploads);
  console.log('  按钮上方最近内容：' + mm.above.slice(0, 2).map(a => a.el + '(bottom ' + a.bottom + ')「' + a.text + '」').join('  '));
}

console.log('\n页面错误：' + (errors.length ? errors.join(' | ') : '无'));
await browser.close();
await stopDevServer(server.proc, { owned: true });
