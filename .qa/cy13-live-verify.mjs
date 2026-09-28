/* ═══ 批 CY-⑬ **线上复验**探针（只读，不改任何代码、不触发任何生成）══════════════════════════════════
   目的：确认「四个生成框的参数行统一成两行摘要触发器」真的**已经在生产环境生效**，
   而不是只在本地 dev server 上成立。

   与 `.qa/cy13-param-row-audit.mjs`（本地盘点）的关系：量法完全一样，区别只有两处 ——
     ① 打的是**线上** https://shuimg.cn，用的是线上真实构建产物（带 hash 的 assets/*.css|js）；
     ② `/api/**` 仍然在浏览器侧拦截成桩 —— 因为画布要登录才能进。
        ⚠️ 拦截的只是 API 响应，**静态资源是真线上那份**，所以"CSS/JS 有没有上线"这件事验的是真的。
        ⚠️ 全程不点任何"生成"按钮 ⇒ 真实上游花费 0。

   判据（用户逐字要求的那几条）：
     · 每一格都要有**下拉箭头**（「它后面不是有一个箭头的符号吗？那你这里为什么没有符号呢？」）
     · 模型那颗不再是**小药丸**（「模型选择按钮不应该这么小呀」）
     · 尺寸 / 清晰度 / 数量**并进同一块**（「可以放在同一个生成配置里面去呀」）
     · 不许出现**原生 <select>**（视频框改造前有 4 个）

   用法：node .qa/cy13-live-verify.mjs                                            */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = (process.env.SB_LIVE_BASE || 'https://shuimg.cn').replace(/\/$/, '');
const ROW_SELECTORS = [
  '.ec-canvas-parameter-controls',
  '.ec-canvas-video-controls',
  '.ec-canvas-suite-controls',
];
/** 必须并进「生成配置」的那三项 —— 线上复验要确认它们真的只剩一个入口。 */
const MERGED = ['图片比例', '清晰度', '生成数量', '时长'];

mkdirSync('.qa/shots', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e.message).slice(0, 200)));
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/video/capabilities') return json({ ok: true, items: [], draft: null });
  return json({ ok: true, items: [], draft: null });
});

const dumpRow = label => page.evaluate(({ label, ROW_SELECTORS }) => {
  const out = [];
  for (const sel of ROW_SELECTORS) {
    for (const row of document.querySelectorAll(sel)) {
      const buttons = Array.from(row.querySelectorAll(':scope > *, :scope > label')).map(item => {
        const btn = item.matches('button') ? item : item.querySelector('button, select');
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        const hasChevron = Boolean(btn.querySelector('svg.lucide-chevron-down, svg[class*="chevron"], .ec-canvas-config-trigger-chevron'));
        const copy = btn.querySelector('.ec-canvas-config-trigger-copy, .visual-config-trigger-copy');
        return {
          label: btn.getAttribute('aria-label') || (btn.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24),
          w: Math.round(r.width),
          h: Math.round(r.height),
          chevron: hasChevron,
          twoLine: Boolean(copy && copy.querySelector('small') && copy.querySelector('strong')),
          tag: btn.tagName.toLowerCase(),
        };
      }).filter(Boolean);
      if (!buttons.length) continue;
      const rr = row.getBoundingClientRect();
      out.push({ label, row: sel, rowW: Math.round(rr.width), over: row.scrollWidth - row.clientWidth, buttons });
    }
  }
  return out;
}, { label, ROW_SELECTORS });

const show = rows => {
  for (const r of rows) {
    console.log(`\n  【${r.label}】${r.row}  行宽 ${r.rowW}px${r.over > 1 ? `  ⚠️ 溢出 ${r.over}px` : ''}  ${r.buttons.length} 颗：`);
    for (const b of r.buttons) {
      const flags = [b.chevron ? '箭头✓' : '箭头✗', b.twoLine ? '两行摘要✓' : '两行摘要✗', b.tag === 'select' ? '原生select✗' : ''].filter(Boolean).join(' ');
      console.log(`     · ${String(b.w).padStart(4)}×${String(b.h).padStart(2)}  ${String(b.label).padEnd(20)} ${flags}`);
    }
  }
};

console.log('════════ 线上复验：' + BASE + ' ════════');
await page.goto(BASE + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);

const buildFromAddMenu = async match => {
  await page.click('.ec-canvas-left-rail button, .ec-canvas-left-rail [role="button"]').catch(() => {});
  await page.waitForTimeout(700);
  const ok = await page.evaluate(match => {
    const btns = Array.from(document.querySelectorAll('.ec-canvas-add-menu button, [class*="add-menu"] button'));
    const b = btns.find(x => (x.textContent || '').includes(match));
    if (!b) return false;
    b.click();
    return true;
  }, match);
  await page.waitForTimeout(2600);
  return ok;
};

let failures = 0;
const expect = (ok, why) => { if (!ok) { failures += 1; console.log('  ✗ ' + why); } else console.log('  ✓ ' + why); };

for (const [name, match] of [['图片生成', '生成图片'], ['生成文案', '生成文案'], ['生成视频', '生成视频'], ['电商套图', '生成电商套图']]) {
  console.log('\n──────── ' + name + ' ────────');
  if (!(await buildFromAddMenu(match))) { console.log('  ✗ 添加菜单里点不到「' + match + '」'); failures += 1; continue; }
  const rows = await dumpRow(name);
  show(rows);
  const all = rows.flatMap(r => r.buttons);
  if (!all.length) { console.log('  ✗ 这一行一颗按钮都没量到'); failures += 1; continue; }
  /* 引用（@）是圆形按钮，本来就没有箭头，不参与这两条 */
  const configs = all.filter(b => b.label !== '引用图片');
  expect(configs.every(b => b.chevron), '每一格都带下拉箭头（用户：「它后面不是有一个箭头的符号吗？」）');
  expect(configs.every(b => b.twoLine), '每一格都是两行摘要（小标题 + 当前值）');
  expect(all.every(b => b.tag !== 'select'), '没有原生 <select>（视频框改造前有 4 个）');
  const heights = [...new Set(configs.map(b => b.h))];
  expect(heights.length <= 2, '同一行内控件高度一致（实测档位 ' + heights.join('/') + '，画布 0.68 缩放）');
  for (const merged of MERGED) {
    expect(!all.some(b => b.label === merged), '「' + merged + '」已不再是一颗独立按钮（并进「生成配置」）');
  }
  const model = all.find(b => /模型/.test(b.label));
  expect(Boolean(model) && model.w >= 60, '模型那颗不是小药丸（实测 ' + (model ? model.w + 'px' : '缺失') + '，132÷0.68≈90）');
  expect(rows.every(r => r.over <= 1), '参数行不横向溢出');
  await page.screenshot({ path: '.qa/shots/cy13-live-' + name + '.png' }).catch(() => {});
}

/* P0 回归：文案生成框曾经渲染即崩（onOpenWorkbench 未解构）⇒ 那一格必须能建出来 */
expect(!pageErrors.some(m => /onOpenWorkbench is not defined/.test(m)),
  'P0 回归：没有 onOpenWorkbench is not defined（那个异常会让整个文案框渲染即崩）');
if (pageErrors.length) console.log('  页面错误（供参考）：' + pageErrors.slice(0, 5).join(' | '));

await browser.close();
console.log('\n' + (failures ? '✗ 线上复验有 ' + failures + ' 条不通过' : '✅ 线上复验全部通过'));
process.exit(failures ? 1 : 0);
