/* ═══ 批 CX 探针：模板入口收敛后的实测 ═══════════════════════════════════════════════════════════
   ① 画布能开（无错误边界 —— 改了 8000 行的 index.jsx，先跑这个再看端到端）
   ② 顶栏「模板广场」打开的是**真的那套**（WorkflowTemplateGallery：有图结构缩略图/铺开按钮）
   ③ 直达 URL `?page=ec-canvas&tab=templates` 能自动打开它（用户要的"先挑模板再干活"链接路径）
   ④ 「新建画布」按钮在（用户点名的「新建空白画布」）
   用法：node .qa/cx-template-entry.mjs
────────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const errors = [];
const TEMPLATES = [
  { templateId: 't1', slug: 'fake-suite', name: '商品套图五连拍', category: '电商套图', description: '主图→场景→细节', isBuiltIn: true, isPublic: true, usageCount: 209, likeCount: 77, pricing: { estimatedUnits: 5, note: '展示预估' }, graph: { nodes: [{ id: 'n1', kind: 'image', x: 0, y: 0, w: 200, h: 140, name: '产品图' }, { id: 'n2', kind: 'image', x: 260, y: 0, w: 200, h: 140, name: '结果' }], connections: [{ fromNodeId: 'n1', toNodeId: 'n2' }] } },
  { templateId: 't2', slug: 'fake-scene', name: '场景种草图', category: '电商套图', description: '换背景 + 加模特', isBuiltIn: false, isPublic: true, usageCount: 84, likeCount: 12, pricing: { estimatedUnits: 3 }, graph: { nodes: [{ id: 'a', kind: 'text', x: 0, y: 0, w: 200, h: 120, name: '文案' }], connections: [] } },
  { templateId: 't3', slug: 'fake-video', name: '15 秒带货成片', category: '视频成片', description: '脚本→图→视频', isBuiltIn: true, isPublic: true, usageCount: 1073, likeCount: 24, pricing: { estimatedUnits: 32 }, requiresAudioVideo: true, graph: { nodes: [{ id: 'v', kind: 'video', x: 0, y: 0, w: 220, h: 140, name: '成片' }], connections: [] } },
  { templateId: 't4', slug: 'fake-tvc', name: '品牌 TVC', category: '视频成片', description: '分镜 + 运镜', isBuiltIn: true, isPublic: true, usageCount: 350, likeCount: 9, pricing: { estimatedUnits: 12 }, graph: { nodes: [{ id: 'w', kind: 'image', x: 0, y: 0, w: 200, h: 140, name: '分镜' }], connections: [] } },
];
const mock = async page => page.route('**/api/**', route => {
  const url = new URL(route.request().url());
  const path = url.pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (/workflow-templates/.test(path)) {
    const category = url.searchParams.get('category');
    const mine = url.searchParams.get('mine');
    let list = TEMPLATES;
    if (category) list = list.filter(t => t.category === category || (category === 'image' && !t.requiresAudioVideo) || (category === 'video' && t.requiresAudioVideo));
    if (mine) list = [];
    return json({ ok: true, templates: list });
  }
  return json({ ok: true, items: [], draft: null, templates: [] });
});

const galleryState = page => page.evaluate(() => {
  const text = document.body.innerText || '';
  const overlay = Array.from(document.querySelectorAll('div')).find(el => /模板|工作流/.test(el.innerText || '') && getComputedStyle(el).position === 'fixed' && el.getBoundingClientRect().width > 400);
  return {
    errBoundary: /页面出了点问题|is not defined/.test(text),
    galleryText: overlay ? overlay.innerText.replace(/\s+/g, ' ').slice(0, 160) : '',
    hasGallery: Boolean(overlay),
    hasSpread: /铺开|使用|一键/.test(text),
  };
});

/* ① + ② 顶栏按钮 */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 160)));
  await mock(page);
  await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.ec-canvas-topbar', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);
  console.log('   页面正文前 110 字：' + await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 110)));
  const before = await galleryState(page);
  console.log('① 画布打开：错误边界=' + before.errBoundary + '  模板库已开=' + before.hasGallery);
  const btn = await page.$('button[aria-label*="模板广场"]');
  console.log('② 顶栏「模板广场」按钮：' + (btn ? '存在' : '⚠️ 不存在'));
  if (btn) {
    await btn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
    const after = await galleryState(page);
    console.log('   点击后：模板库已开=' + after.hasGallery + '  正文「' + after.galleryText + '」');
    /* 卡片形态核对（照知渔那一屏）：类目 chip / 共 N 套 / 真实计数 / 作者标记 / 一键铺开按钮 */
    const CHIP = '[role="group"][aria-label="按类目筛选模板"] button';
    const cardInfo = await page.evaluate(CHIP => {
      const text = document.body.innerText.replace(/\s+/g, ' ');
      const chips = Array.from(document.querySelectorAll(CHIP)).map(b => b.textContent.trim()).filter(Boolean);
      const spread = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => /铺开|同款/.test(t));
      const cards = Array.from(document.querySelectorAll('article')).filter(el => el.getBoundingClientRect().width > 100).length;
      return { chips, cards, spreadButtons: spread.slice(0, 3), hasCount: /共 \d+ 套/.test(text), hasUsage: /已使用 \d+ 次/.test(text), hasOfficial: /官方|自建/.test(text) };
    }, CHIP);
    console.log('   卡片形态：类目 chip=' + JSON.stringify(cardInfo.chips) + '  卡片数=' + cardInfo.cards + '  共N套=' + cardInfo.hasCount + '  已使用N次=' + cardInfo.hasUsage + '  官方/自建=' + cardInfo.hasOfficial);
    console.log('   铺开按钮：' + JSON.stringify(cardInfo.spreadButtons));
    /* 点第二个类目 chip → 列表应当被筛过（**必须点 chip 容器里的按钮**：点赞按钮也带 aria-pressed，
       第一次探针就是被它骗了，量出"共 4 套"没变还以为筛选没生效） */
    if (cardInfo.chips.length > 1) {
      const second = (await page.$$(CHIP))[1];
      if (second) {
        const target = await second.textContent();
        await second.click({ force: true }).catch(() => {});
        await page.waitForTimeout(900);
        const filtered = await page.evaluate(CHIP => ({
          count: (document.body.innerText || '').replace(/\s+/g, ' ').match(/共 \d+ 套/)?.[0] || '',
          cards: Array.from(document.querySelectorAll('article')).filter(el => el.getBoundingClientRect().width > 100).length,
          activeChip: Array.from(document.querySelectorAll(CHIP)).find(b => b.getAttribute('aria-pressed') === 'true')?.textContent?.trim() || '',
        }), CHIP);
        console.log('   点类目「' + String(target).trim() + '」后：' + filtered.count + '  卡片数=' + filtered.cards + '  当前选中 chip=' + filtered.activeChip);
      }
    }
    /* 点「新建空白画布」→ 集合页应关闭 */
    const blank = await page.$('button:has-text("新建空白画布")');
    if (blank) {
      await blank.click({ force: true }).catch(() => {});
      await page.waitForTimeout(1500);
      const closed = await galleryState(page);
      console.log('   点「新建空白画布」后：集合页已关=' + !closed.hasGallery);
    }
  }
  const newBtn = await page.$$('button:has-text("新建画布")');
  console.log('④ 顶栏「新建画布」按钮个数：' + newBtn.length);
  await page.close();
}

/* ③ 直达 URL */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 160)));
  await mock(page);
  await page.goto(base + '/ec-canvas?qa=ec-canvas&tab=templates', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.ec-canvas-topbar', { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const st = await galleryState(page);
  console.log('③ 直达 ?tab=templates：自动打开=' + st.hasGallery + '  错误边界=' + st.errBoundary + '  正文「' + st.galleryText + '」');
  await page.close();
}

console.log('\n运行时错误：' + (errors.length ? JSON.stringify(errors.slice(0, 5), null, 1) : '无'));
await browser.close();
stopDevServer(server.proc, { owned: server.owned });
