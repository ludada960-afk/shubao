/* ═══ 批 CX（CV-1）探针：**「按技能开始」** —— 从技能库一步建出带技能的画布节点 ═════════════════════
   用户对画布的定位（原话）：「画布可能最终要走向像知渔AI他们那样……把各种各样的工作流集合成模板」；
   docs/design/89 §5 第 1 步 = "一份声明三处复用"。这条探针验三件事：
     ① 左栏「+」菜单里有「按技能开始」；
     ② 点它打开的是**同一个技能库**（SkillLibraryModal，与首页/视频页共用）；
     ③ 选中一条技能后**画布上真的多了一个节点**，且节点带 skillLabel / 提示词被预填（= 技能声明落到画布）。
   ⚠️ 只读 + 只点"选中技能"：不点任何生成/扣费按钮（建节点 0 收费，但本探针连生成按钮都不碰）。
   用法：node .qa/cx-skill-node.mjs
────────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const SKILLS = [
  { id: 's1', slug: 'hot-remake', kind: 'image', name: '爆款复刻', summary: '照一条爆款片子的分镜复刻商品图', body: '把参考视频里的分镜逐帧复刻成商品图。' },
  { id: 's2', slug: 'white-bg', kind: 'image', name: '白底商品图', summary: '纯白背景、无阴影', body: '纯白背景、无阴影、商品居中。' },
];

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 160)));
await page.route('**/api/**', route => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (/\/api\/skills/.test(path)) return json({ ok: true, builtin: SKILLS, mine: [], groups: [] });
  if (/skill/.test(path)) return json({ ok: true, builtin: SKILLS, mine: [], groups: [], skills: SKILLS, items: SKILLS });
  return json({ ok: true, items: [], draft: null, builtin: SKILLS, mine: [], groups: [], templates: [] });
});
await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.ec-canvas-topbar', { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(2500);

/* ① 左栏「+」菜单 */
await page.click('.ec-canvas-left-rail button, .ec-canvas-left-rail [role="button"]').catch(() => {});
await page.waitForTimeout(800);
const menuItems = await page.evaluate(() => Array.from(document.querySelectorAll('.ec-canvas-add-menu button, [class*="add-menu"] button')).map(b => (b.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 20)).filter(Boolean));
console.log('① 左栏菜单项：' + JSON.stringify(menuItems));
console.log('   有「按技能开始」吗：' + (menuItems.some(t => t.includes('按技能开始')) ? '有 ✓' : '⚠️ 没有'));

/* ② 点它 → 技能库 */
const before = await page.evaluate(() => document.querySelectorAll('[data-canvas-node-id]').length);
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('.ec-canvas-add-menu button, [class*="add-menu"] button')).find(x => (x.textContent || '').includes('按技能开始'));
  if (b) b.click();
});
await page.waitForTimeout(1800);
const libState = await page.evaluate(() => {
  const text = (document.body.innerText || '').replace(/\s+/g, ' ');
  const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).map(el => (el.getAttribute('aria-label') || '') + '|' + (el.innerText || '').replace(/\s+/g, ' ').slice(0, 60)).filter(Boolean);
  return { dialogs: dialog.slice(0, 4), hasSkillWord: /技能/.test(text) };
});
console.log('② 点击后：弹窗=' + JSON.stringify(libState.dialogs));
console.log('   画布节点数（点之前）：' + before);

/* ③ 选中一条技能 → 画布上应多一个节点（选中按钮的真实类名：.skill-mini-btn.is-primary，文案「使用」） */
const pickButtons = await page.$$('.skill-mini-btn.is-primary');
console.log('③ 技能库里的「使用」按钮个数：' + pickButtons.length);
let picked = null;
if (pickButtons.length) {
  picked = await page.evaluate(() => {
    const b = document.querySelector('.skill-mini-btn.is-primary');
    const card = b?.closest('.skill-card');
    const label = (card?.querySelector('strong')?.textContent || b?.textContent || '').trim().slice(0, 16);
    b?.click();
    return label;
  });
}
await page.waitForTimeout(2200);
const after = await page.evaluate(() => {
  const nodes = Array.from(document.querySelectorAll('[data-canvas-node-id]')).map(el => ({ id: el.getAttribute('data-canvas-node-id'), cls: String(el.className).slice(0, 40) }));
  const text = (document.body.innerText || '').replace(/\s+/g, ' ');
  return { count: nodes.length, nodes: nodes.slice(-3), hasToast: /已按「/.test(text), toastText: (text.match(/已按「[^」]{1,12}」新建节点[^ ]*/) || [''])[0] };
});
console.log('③ 点了「' + picked + '」之后：画布节点数=' + after.count + '（之前 ' + before + '）  提示=' + JSON.stringify(after.toastText));

console.log('\n运行时错误：' + (errors.length ? JSON.stringify(errors.slice(0, 5), null, 1) : '无'));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
