/* ═══ 批 CY-⑨ 探针（CV-2 第 2 步）：**画布节点 → 子页面工作台**（「在完整工作台里编辑」）═══════════
   用户已拍板入口位置＝**节点上**（docs/design/89 §7 第 3 条）。这条探针验四件事：
     ① 带技能的节点上，技能弹层里**有**「在完整工作台里编辑」；
     ② 点它**真的落到那条技能的子页面**（URL + 技能 id 都对）；
     ③ **提示词跟着过去**（技能正文预填进该技能的提示词字段）；
     ④ **清掉技能之后那颗按钮消失**（解析不出子页面坐标就不渲染 —— 铁律：接不通的不给入口）。
   ⚠️ 全程**不点任何生成/扣费按钮**（建节点、切技能、跳页面都是免费的）。
   用法：node .qa/cy9-canvas-workbench-channel.mjs
   ─────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

/* 技能库喂的假数据：**id 用真实声明源里的 id** —— 这样节点上会记下 `subpageSkillId`，
   与"用户从技能库选真技能"是同一条路径（名字也照真技能写，兜底的名字匹配也一并覆盖）。 */
const SKILLS = [
  { id: 'image.product_suite', slug: 'product-suite', kind: 'image', name: '商品套图', summary: '一套多图', body: '按商品卖点出一套 listing 图。' },
];

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const calls = [];
page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 160)));
page.on('request', r => { if (r.method() === 'POST' && /\/api\//.test(r.url())) calls.push(r.method() + ' ' + new URL(r.url()).pathname); });
/* ⚠️ 动态 import 失败时，"点不动"和"模块 404/500"是两回事 —— 把模块请求的状态码读出来，
   免得把"dev server 的模块图坏了"误判成"我的接线坏了"（本批第一版就差点这么收场）。 */
const moduleStatus = [];
page.on('response', r => { if (/\/src\/pages\/(MediaCreation|EcCanvas)\//.test(r.url())) moduleStatus.push(r.status() + ' ' + new URL(r.url()).pathname); });

await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (/skill/i.test(path)) return json({ ok: true, builtin: SKILLS, mine: [], groups: [], skills: SKILLS, items: SKILLS });
  return json({ ok: true, items: [], draft: null, builtin: SKILLS, mine: [], groups: [], templates: [] });
});
await page.addInitScript(() => {
  const future = new Date(Date.now() + 3600 * 1000).toISOString();
  localStorage.setItem('sb-auth', JSON.stringify({ id: 'p@e.com', email: 'p@e.com', nickname: 'P', token: 't', expiresAt: future }));
});

const openSkillPopover = async () => {
  await page.evaluate(() => {
    const chip = Array.from(document.querySelectorAll('[data-canvas-control="true"]')).find(el => el.getAttribute('aria-label') === '技能');
    chip?.click();
  });
  await page.waitForTimeout(600);
};
const hasEntry = () => page.evaluate(() => Boolean(document.querySelector('.ec-canvas-skill-workbench')));

await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('.ec-canvas-topbar', { timeout: 45000 }).catch(() => {});
await page.waitForTimeout(2500);

/* ── 建一个带技能的节点（走 CV-1 那条真实入口，不直接改状态） ───────────────────────────── */
await page.click('.ec-canvas-left-rail button, .ec-canvas-left-rail [role="button"]').catch(() => {});
await page.waitForTimeout(700);
await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('.ec-canvas-add-menu button, [class*="add-menu"] button')).find(x => (x.textContent || '').includes('按技能开始'));
  b?.click();
});
await page.waitForTimeout(1600);
const before = await page.evaluate(() => document.querySelectorAll('[data-canvas-node-id]').length);
await page.evaluate(() => document.querySelector('.skill-mini-btn.is-primary')?.click());
await page.waitForTimeout(1600);
const after = await page.evaluate(() => document.querySelectorAll('[data-canvas-node-id]').length);
console.log('① 建节点：' + before + ' → ' + after + '（' + (after > before ? '多了 1 个 ✓' : '⚠️ 没多') + '）');

/* ── ① 带技能的节点上，技能弹层里有那颗按钮 ──────────────────────────────────────────── */
await openSkillPopover();
const entryOnSkilled = await hasEntry();
console.log('② 带技能节点上「在完整工作台里编辑」：' + (entryOnSkilled ? '有 ✓' : '⚠️ 没有'));

/* ── ② 点它 → 落到该技能的子页面 + ③ 提示词跟着过去 ─────────────────────────────────── */
const postsBefore = calls.length;
await page.evaluate(() => document.querySelector('.ec-canvas-skill-workbench')?.click());
await page.waitForTimeout(2200);
const landed = await page.evaluate(() => ({ url: location.pathname + location.search, hasWorkbench: Boolean(document.querySelector('.media-workbench-submit')) }));
console.log('③ 点击后落在：' + landed.url + '（工作台渲染=' + landed.hasWorkbench + '）');
const carried = await page.evaluate(() => {
  const boxes = Array.from(document.querySelectorAll('textarea, input[type="text"]'));
  const hit = boxes.find(box => /按商品卖点出一套 listing 图/.test(box.value || ''));
  const hint = document.querySelector('.media-run-global, .media-workbench-cta-hint')?.textContent || '';
  return { promptCarried: Boolean(hit), where: hit?.getAttribute('placeholder') || hit?.className || '', hint: hint.slice(0, 60) };
});
console.log('④ 提示词跟过去了吗：' + (carried.promptCarried ? '是 ✓' : '否 ⚠️') + '  落在字段：' + carried.where);
console.log('   就地提示：' + carried.hint);
console.log('⑤ 这一段有没有发 POST（应为 0）：' + (calls.length - postsBefore));

/* ── ④ 清掉技能 → 按钮消失（接不通就不给入口） ──────────────────────────────────────── */
await page.goBack().catch(() => {});
await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  const node = document.querySelector('[data-canvas-node-id]');
  node?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));
  node?.click?.();
});
await page.waitForTimeout(900);
await openSkillPopover();
const entryBeforeClear = await hasEntry();
if (entryBeforeClear) {
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.ec-canvas-skill-popover button')).find(x => (x.textContent || '').includes('清除技能'));
    b?.click();
  });
  await page.waitForTimeout(800);
  await openSkillPopover();
}
const entryAfterClear = await hasEntry();
console.log('⑥ 清掉技能后那颗按钮：' + (entryAfterClear ? '⚠️ 还在（不该）' : '消失 ✓'));

console.log('\n页面错误：' + (errors.length ? errors.join(' | ') : '无'));
console.log('模块请求状态：' + (moduleStatus.length ? [...new Set(moduleStatus)].join('  ') : '（没有拉到页面模块）'));
console.log('全程 POST：' + (calls.length ? calls.join(', ') : '0 次 ✓（没有点过任何生成）'));
await browser.close();
await stopDevServer(server.proc, { owned: true });
