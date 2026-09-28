/* ═══ 批 CY-⑥ 探针：知渔「商品套图」子页面 —— **设计风格**那一排与它下面那颗按钮 ═══════════════════
   用户原话（逐字，7 张批注图第 3 条）：
   「你看一下**人家 AI 推荐风格**，它这里是有个按钮的。他点击这个按钮才会生成结果在这里啊。他这个按钮
     其实就跟右上角那个 AI 推荐应该是同一个按钮的。」「你这里为什么跟他不一样呢？**不是说要照抄吗**？
     照抄你为什么抄着抄着又抄的不对呢？」
   ⇒ 要照抄的是：风格三档下面那颗**整颗按钮**（文案 / 尺寸 / 在谁下面）+ 点击后结论落到哪里。

   采法（照 2026-09-20 那次实采的既定办法）：
     1) 先 `node .qa/login-rig.mjs` 把登录台拉起来（独立 profile：%LOCALAPPDATA%\shubao-competitor-profile，
        CDP 口 9333）——**cookie 不进项目文件**；
     2) 本脚本 connectOverCDP 复用那个浏览器，**只读**它：切档 → 量几何 → 截图。
        ⚠️ 只点"档位芯片"，**绝不点任何带积分的按钮**（那会真花钱）。
   用法：node .qa/cy5-quantv-style.mjs
   ─────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const PORT = Number(process.env.SHUBO_CDP_PORT) > 0 ? Number(process.env.SHUBO_CDP_PORT) : 9333;
const URL_SUITE = 'https://laoyu.quantv.com/image-creation?tool=product-listing-set';
const OUT = '.tmp/laoyu2';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.connectOverCDP('http://127.0.0.1:' + PORT);
const ctx = browser.contexts()[0];
if (!ctx) { console.log('连上了但没有 context —— 登录台是不是没在跑？'); process.exit(1); }
const page = ctx.pages().find(p => /quantv\.com/.test(p.url())) || await ctx.newPage();
if (!/image-creation\?tool=product-listing-set/.test(page.url())) {
  await page.goto(URL_SUITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
}
await page.waitForTimeout(2500);

const login = await page.evaluate(() => ({ url: location.href, text: (document.body?.innerText || '').slice(0, 120), login: /登录|注册|扫码/.test(document.body?.innerText || '') }));
console.log('页面：' + login.url);
console.log('登录页特征：' + (login.login ? '**有**（需要用户重新登录）' : '无') + '  头部：' + login.text.replace(/\s+/g, ' ').slice(0, 80));

/* 找到「设计风格」那一格：从含这三个字的节点往上找容器，再量它周围的控件 */
const DUMP = `(() => {
  const R = el => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const txt = el => (el.textContent || '').replace(/\\s+/g, ' ').trim();
  const node = Array.from(document.querySelectorAll('*')).find(el => el.children.length === 0 && /设计风格/.test(txt(el)));
  if (!node) return { found: false };
  let box = node;
  for (let i = 0; i < 6 && box.parentElement; i++) { box = box.parentElement; if (box.querySelectorAll('button').length >= 2) break; }
  const br = box.getBoundingClientRect();
  const items = [];
  box.querySelectorAll('button, input, textarea, select, [role=button]').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    if (r.top < br.top - 40 || r.bottom > br.bottom + 420) return;      /* 只看这一格 + 下面一屏 */
    items.push({ tag: el.tagName.toLowerCase(), text: txt(el).slice(0, 26), rect: R(el),
                 font: getComputedStyle(el).fontSize + '/' + getComputedStyle(el).fontWeight,
                 pad: getComputedStyle(el).padding, radius: getComputedStyle(el).borderTopLeftRadius,
                 bg: getComputedStyle(el).backgroundColor, border: getComputedStyle(el).borderTopColor,
                 ph: el.getAttribute('placeholder') || '' });
  });
  return { found: true, box: R(box), label: txt(node).slice(0, 40), items };
})()`;

const dump1 = await page.evaluate(DUMP);
if (!dump1.found) { console.log('**没找到「设计风格」那一段** —— 页面结构可能变了，或没进去这一页'); }
else {
  console.log('\n设计风格那一格：' + JSON.stringify(dump1.box) + '  标题「' + dump1.label + '」');
  dump1.items.forEach(it => console.log('  ' + it.tag.padEnd(8) + JSON.stringify(it.rect).padEnd(40) + ' ' + it.font.padEnd(16) +
    ' pad=' + it.pad.padEnd(22) + ' r=' + it.radius.padEnd(7) + ' 「' + it.text + '」' + (it.ph ? ' ph=「' + it.ph + '」' : '') +
    '  bg=' + it.bg + ' bd=' + it.border));
}

/* 三档逐一点开（**只点芯片**），看下面换出什么 —— 与 imageSkills.js 里那次记录的对照 */
const CHIPS = ['AI推荐', '参考排版', '自定义要求'];
for (const chip of CHIPS) {
  const hit = await page.evaluate((label) => {
    const t = Array.from(document.querySelectorAll('button, [role=button], label, div'))
      .filter(el => el.children.length <= 1 && (el.textContent || '').replace(/\s+/g, ' ').trim() === label);
    if (!t.length) return false;
    const el = t[0]; const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
  }, chip);
  if (!hit) { console.log('\n「' + chip + '」这一档没找到芯片'); continue; }
  await page.mouse.click(hit.x, hit.y);           /* 只点芯片，不点任何带积分的按钮 */
  await page.waitForTimeout(1200);
  const after = await page.evaluate(DUMP);
  console.log('\n点「' + chip + '」之后，这一格里的控件：');
  if (after.found) after.items.forEach(it => console.log('  ' + it.tag.padEnd(8) + JSON.stringify(it.rect).padEnd(40) + ' 「' + it.text + '」' + (it.ph ? ' ph=「' + it.ph.slice(0, 40) + '」' : '')));
}

/* 截图留档（那一格 + 它下面 420px） */
if (dump1.found) {
  const b = dump1.box;
  await page.screenshot({ path: OUT + '/cy5-style-area.png',
    clip: { x: Math.max(0, b.x - 8), y: Math.max(0, b.y - 8), width: Math.min(b.w + 16, 1200), height: Math.min(b.h + 420, 900) } }).catch(() => {});
  console.log('\n截图：' + OUT + '/cy5-style-area.png');
}
writeFileSync(OUT + '/cy5-style-dump.json', JSON.stringify({ login, dump1 }, null, 2));
console.log('落档：' + OUT + '/cy5-style-dump.json');
await browser.close().catch(() => {});   /* 注意：这是"断开 CDP"，不会关用户的浏览器 */
