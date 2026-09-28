/* ═══ 批 CY-⑪ 探针：**"AI 结论框"点之前不该是输入框**（用户当面纠正）════════════════════════════════
   用户原话（逐字）：「下面这个一键解析风格，它应该是在这个**设计风格要求**这里的。也就是说设计风格要求
     它**不应该是一个提示词输入框**。他应该是一个一键解析风格的按钮**在中心**……只有当用户点击这个
     一键解析风格的按钮之后，他才会去解析，解析之后的**生成结果才会出现在这个输入框里面**。
     你看一下知鱼他们就是这样做的呀。……那个**自定义要求**他才是你现在的这个情况呀，就是用户可以
     自动输入他想要的各种各样的提示词。」
   验四件事（**上游全部走桩，不花真钱**；点的是"一键解析风格"，费用只在桩里）：
     ① AI推荐档（还没点）：那一格**没有输入框**，只有一颗**居中**的「一键解析风格」按钮；
     ② 点它之后：结论落进一个**可编辑的输入框**（出现且有内容）；
     ③ 自定义要求档：**有**用户可以自己写的「设计要求」框（这一档才是自由输入）；
     ④ 参考排版档：出现的是上传位（不受影响）。
   用法：node .qa/cy11-ai-conclusion-field.mjs
   ─────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const posts = [];
page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 160)));
page.on('request', r => { if (r.method() === 'POST' && /\/api\//.test(r.url())) posts.push(new URL(r.url()).pathname); });

await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/billing/quote') return json({ quote: { quoteId: 'quote-cy11', totalUnits: 200, currency: 'ec_points' } });
  if (path === '/api/billing/balance') return json({ ok: true, currency: 'ec_points', balance: 999, unlimited: false, credits: 999 });
  if (path === '/api/billing/catalog') return json({ ok: true, products: [] });
  /* 「一键解析风格」的上游（0.2 积分 = SKU ec_ai_assistant）—— 桩，零额度 */
  if (path === '/api/ecommerce/auto-recognize') return json({
    product: { name: '白瓷马克杯 350ml', category: '家居生活', material: '骨瓷', dimensions: '9x9x10 cm' },
    skus: [{ color: '月岩白', size: '350ml', capacity: '350ml', dimLabel: '9x9x10cm' }],
    style_skill: 'premium_minimal',
    maintenance: '可用洗碗机清洗',
  });
  /* 上传桩（上传位是必填，解析要读参考图）：与 e2e 同一形状 */
  if (path === '/api/ecommerce/assets') return json({ original: { assetId: 'a'.repeat(64) + '.png', url: '/api/generated-assets/' + 'a'.repeat(64) + '.png', role: 'product' }, preview: { url: '/api/generated-assets/' + 'a'.repeat(64) + '.png?variant=thumb' } });
  if (/skill/i.test(path)) return json({ ok: true, builtin: [], mine: [], groups: [], skills: [], items: [] });
  return json({ ok: true, items: [], draft: null, builtin: [], mine: [], groups: [], templates: [] });
});
await page.addInitScript(() => {
  const future = new Date(Date.now() + 3600 * 1000).toISOString();
  localStorage.setItem('sb-auth', JSON.stringify({ id: 'p@e.com', email: 'p@e.com', nickname: 'P', token: 't', expiresAt: future }));
});

/* 量"设计风格那一格"：档位 / 输入框数 / 那一格的按钮（含它是否居中） */
const MEASURE = `(() => {
  const txt = el => (el.textContent || '').replace(/\\s+/g, ' ').trim();
  const chips = Array.from(document.querySelectorAll('.media-field-segmented button')).filter(b => ['AI推荐', '参考排版', '自定义要求'].includes(txt(b)));
  const active = chips.find(b => /is-active/.test(b.className));
  /* 设计风格那一格 = 含"设计风格"标题的 .media-field 往后到下一个同名之前的兄弟 */
  const labels = Array.from(document.querySelectorAll('.media-field-label'));
  const styleLabel = labels.find(el => txt(el).startsWith('设计风格'));
  const field = styleLabel?.closest('.media-field');
  const siblings = [];
  if (field) {
    let node = field.nextElementSibling;
    while (node && !node.querySelector?.('.media-field-label')) { siblings.push(node); node = node.nextElementSibling; }
    if (node) siblings.push(node);
  }
  const boxes = siblings.flatMap(n => Array.from(n.querySelectorAll('textarea, input[type="text"]')));
  const action = document.querySelector('.media-workbench-field-action');
  const actionBtn = action?.querySelector('button, .media-workbench-paid');
  const ar = action?.getBoundingClientRect(), br = actionBtn?.getBoundingClientRect();
  const fields = Array.from(document.querySelectorAll('.media-field')).map(el => (el.querySelector('.media-field-label')?.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 12)).filter(Boolean);
  return {
    active: active ? txt(active) : '',
    textareas: boxes.map(b => ({ ph: (b.getAttribute('placeholder') || '').slice(0, 22), val: (b.value || '').slice(0, 24) })),
    actionText: actionBtn ? txt(actionBtn).slice(0, 24) : '',
    actionCentered: (ar && br) ? Math.round((br.left + br.width / 2) - (ar.left + ar.width / 2)) : null,
    uploads: siblings.flatMap(n => Array.from(n.querySelectorAll('.media-field-upload-box'))).length,
    fields,
  };
})()`;

await page.goto(base + '/image-creation?id=image.product_suite', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.media-workbench-submit', { timeout: 30000 });
await page.waitForTimeout(1500);

const before = await page.evaluate(MEASURE);
console.log('① AI推荐档（还没点）：档位=「' + before.active + '」  那一格的输入框=' + before.textareas.length + ' 个  ' +
  JSON.stringify(before.textareas));
console.log('   那一格的按钮：「' + before.actionText + '」居中偏差=' + before.actionCentered + 'px');
console.log('   ⇒ 点之前是"没有输入框、只有一颗居中按钮"吗：' +
  ((before.textareas.length === 0 && before.actionText && Math.abs(before.actionCentered) <= 1) ? '是 ✓' : '⚠️ 否'));

/* ② 点它（上游走桩）→ 结论应落进一个可编辑输入框 */
/* ⚠️ 必须先上传商品图：上游要读参考图，没图时点了**不发请求**（那正是 e2e 场景 ⑳ 守的行为）。 */
await page.setInputFiles('.media-field-upload input[type=file]', 'public/gallery/ecommerce/baby-bottle-product-suite/01.webp');
await page.waitForTimeout(2000);
const uploaded = await page.evaluate(() => document.querySelectorAll('.media-asset-card, .media-field-upload-box img').length);
console.log('   （已上传商品图：' + uploaded + ' 张）');
const postsBefore = posts.length;
await page.evaluate(() => document.querySelector('.media-workbench-field-action button')?.click());
await page.waitForTimeout(2500);
const after = await page.evaluate(MEASURE);
console.log('② 点完：输入框=' + after.textareas.length + ' 个  ' + JSON.stringify(after.textareas));
console.log('   ⇒ 结论是否落进输入框（有框且有内容）：' +
  ((after.textareas.length >= 1 && after.textareas.some(t => t.val.length > 0)) ? '是 ✓' : '⚠️ 否'));
console.log('   这一段发过的 POST：' + (posts.slice(postsBefore).join(', ') || '（无）'));

/* ③ 自定义要求档：用户自己写的框必须还在 */
const chip = (label) => page.locator('.media-field-segmented button', { hasText: new RegExp('^' + label + '$') }).first();
await chip('自定义要求').click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(900);
const custom = await page.evaluate(MEASURE);
console.log('③ 自定义要求档：档位=「' + custom.active + '」  输入框=' + custom.textareas.length + ' 个  ' + JSON.stringify(custom.textareas));
console.log('   ⇒ 自由输入框在吗（用户原话：这一档才是"用户可以自己输入"）：' + (custom.textareas.length >= 1 ? '在 ✓' : '⚠️ 不在'));

/* ④ 参考排版档：上传位 */
await chip('参考排版').click({ timeout: 8000 }).catch(() => {});
await page.waitForTimeout(900);
const ref = await page.evaluate(MEASURE);
console.log('④ 参考排版档：档位=「' + ref.active + '」  上传位=' + ref.uploads + ' 个');
console.log('   ⇒ 出现的是上传位（不受本批影响）：' + (ref.uploads >= 1 ? '是 ✓' : '⚠️ 否'));

console.log('\n页面错误：' + (errors.length ? errors.join(' | ') : '无'));
await browser.close();
await stopDevServer(server.proc, { owned: true });
