/* ═══ 批 CY-④ 探针：首页两个「模型」面板的**行内边距与间距**是否逐值一致 ═══════════════════════════
   用户原话（逐字，7 张批注图第 5 条）：
   「你现在**生图模型**这边的张开面板，左右两边的间距，上下的间距，我觉得做的也还行吧，可是你
     **视频生成那边的模型选择面板**似乎是不一样的。」「你看很明显视频生成这边的模型选择的面板。
     他这些按钮**左右两边的空白间距是跟图片生成那边不一样的**。这个你也得去**对齐**一下。」
   ⇒ 量法：把首页三个模式的配置面板**都打开**，逐个量（面板内边距 / 每段的内边距与段间距 /
      第一行按钮相对面板左右边缘的**空白**），然后按「图片侧 = 基准」比对视频侧。
   用法：node .qa/cy2-model-panels.mjs
   ─────────────────────────────────────────────────────────────────────────────────────────── */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const errors = [];

const mock = async page => page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/video/capabilities') return json({
    loading: false, generationEnabled: true, workbenchEnabled: false, directorUi: false,
    uploadMode: 'tus', defaultProductId: 'seedance_standard',
    resolutions: ['720p', '1080p'], durations: { min: 5, max: 10 }, aspectRatios: ['9:16', '16:9', '1:1'],
    products: [
      { id: 'seedance_standard', label: 'Seedance 2.0', tierLabel: '标准', providerLabel: 'Seedance', description: '写实、动作自然的通用视频模型', default: true,
        modes: ['script', 'reference', 'frame', 'remake'], resolutions: ['720p', '1080p'], durationOptions: [5, 10], durations: { min: 5, max: 10 },
        quotes: { short: { sku: 'v7205', units: 92000, points: 92 }, long: { sku: 'v7210', units: 184000, points: 184 } } },
      { id: 'seedance_fast', label: 'Seedance 2.0 Fast', tierLabel: '快速', providerLabel: 'Seedance', description: '更快出片，适合批量',
        modes: ['script', 'reference'], resolutions: ['720p'], durationOptions: [5], durations: { min: 5, max: 5 },
        quotes: { short: { sku: 'vf7205', units: 46000, points: 46 }, long: { sku: 'vf7210', units: 92000, points: 92 } } },
      { id: 'kling_pro', label: 'Kling Pro', tierLabel: '专业', providerLabel: 'Kling', description: '镜头运动更稳',
        modes: ['script', 'frame'], resolutions: ['720p', '1080p'], durationOptions: [5, 10], durations: { min: 5, max: 10 },
        quotes: { short: { sku: 'kp7205', units: 120000, points: 120 }, long: { kp: 'kp7210', units: 240000, points: 240 } } },
    ],
  });
  if (/skills/.test(path)) return json({ ok: true, builtin: [], mine: [], groups: [] });
  return json({ ok: true, items: [], draft: null, templates: [] });
});

/* 面板全景：面板本身 + 一级子段 + 段内第一行按钮相对面板的左右空白 */
const DUMP = (panelSel) => `(() => {
  const R = el => { const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) }; };
  const desc = el => el.tagName.toLowerCase() + '.' + (String(el.className || '').split(/\s+/).filter(Boolean).join('.') || '—').slice(0, 46);
  const panel = document.querySelector(${JSON.stringify(panelSel)});
  if (!panel) return { found: false };
  const cs = getComputedStyle(panel);
  const pr = panel.getBoundingClientRect();
  const kids = [];
  const walk = (parent, depth, path) => {
    Array.from(parent.children).forEach((el, i) => {
      const c = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      const btns = Array.from(el.querySelectorAll('button')).filter(b => b.getBoundingClientRect().width > 0);
      const inner = btns.length ? { left: Math.round(Math.min(...btns.map(b => b.getBoundingClientRect().left))), right: Math.round(Math.max(...btns.map(b => b.getBoundingClientRect().right))) } : null;
      kids.push({ depth, path: path + '/' + (i + 1), el: desc(el), rect: R(el),
        pad: [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].join(' '),
        marginTop: c.marginTop, gap: c.gap, btns: btns.length, inner,
        insetL: inner ? inner.left - Math.round(pr.left) : null, insetR: inner ? Math.round(pr.right) - inner.right : null });
      if (depth < 3) walk(el, depth + 1, path + '/' + (i + 1));
    });
  };
  walk(panel, 1, '');
  /* 行级：面板里每一颗"选项按钮"的 y/h 与相邻行间距（左右内缩来自上面 kids） */
  const rows = Array.from(panel.querySelectorAll('button')).filter(b => { const r = b.getBoundingClientRect(); return r.width > 120 && r.height > 20; })
    .map(b => { const c = getComputedStyle(b); return { y: Math.round(b.getBoundingClientRect().y), h: Math.round(b.getBoundingClientRect().height),
                 left: Math.round(b.getBoundingClientRect().left), right: Math.round(b.getBoundingClientRect().right),
                 pad: [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft].join(' '), radius: c.borderTopLeftRadius, gap: c.gap,
                 text: (b.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 18) }; });
  const gaps = rows.slice(1).map((r, i) => r.y - (rows[i].y + rows[i].h));
  /* 标题类节点（分组标题 / 面板头）——用来量"顶 → 标题 → 首行"的上下节奏 */
  const heads = Array.from(panel.querySelectorAll('h1,h2,h3,h4,strong,b,span,div'))
    .filter(el => el.children.length === 0 && (el.textContent || '').trim().length > 1 && el.getBoundingClientRect().height > 0)
    .filter(el => { const r = el.getBoundingClientRect(); return r.width > 20 && r.height < 40 && r.top >= panel.getBoundingClientRect().top - 1; })
    .slice(0, 6)
    .map(el => ({ y: Math.round(el.getBoundingClientRect().y), h: Math.round(el.getBoundingClientRect().height),
                  left: Math.round(el.getBoundingClientRect().left), text: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 16) }));
  const inner = { top: Math.round(pr.top), bottom: Math.round(pr.bottom), left: Math.round(pr.left), right: Math.round(pr.right) };
  const rhythm = rows.length ? {
    顶到首行: rows[0].y - inner.top,
    末行到面板底: inner.bottom - (rows[rows.length - 1].y + rows[rows.length - 1].h),
    首行左内缩: rows[0].left - inner.left,
    首行右内缩: inner.right - rows[0].right,
  } : null;
  return {
    found: true,
    panel: { el: desc(panel), rect: R(panel), pad: cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft,
             width: cs.width, maxH: cs.maxHeight, radius: cs.borderTopLeftRadius, overflow: cs.overflowY, density: panel.dataset ? (panel.dataset.density || '') : '' },
    kids, rows, gaps, heads, rhythm,
  };
})()`;

const MODES = [
  { key: '图片生成（生图模型）', card: /图片生成/, trigger: '.visual-config-trigger', panel: '.visual-config-panel' },
  { key: '视频生成（视频模型）', card: /视频生成/, trigger: '.video-config-trigger.is-model', panel: '.video-inline-menu.is-model' },
  { key: '视频子页面工作台（视频模型）', url: '/video-creation?id=video.smart', trigger: '.video-config-trigger.is-model', panel: '.video-inline-menu.is-model' },
];

const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', e => errors.push('PAGEERR ' + String(e.message).slice(0, 140)));
await mock(page);
await page.addInitScript(() => {
  const future = new Date(Date.now() + 3600 * 1000).toISOString();
  localStorage.setItem('sb-auth', JSON.stringify({ id: 'p@e.com', email: 'p@e.com', nickname: 'P', token: 't', expiresAt: future }));
});

await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(1200);

for (const mode of MODES) {
  console.log('\n══════════ ' + mode.key + ' ══════════');
  if (mode.url) {                       /* 子页面：直接开这一页（没有模式卡） */
    await page.goto(base + mode.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);
  } else {
    const card = page.locator('.homepage-mode-card', { hasText: mode.card }).first();
    if (await card.count()) { await card.click({ timeout: 8000 }).catch(e => console.log('  卡片点不动：' + String(e.message).slice(0, 60))); }
    else console.log('  找不到模式卡：' + mode.card);
    await page.waitForTimeout(1000);
  }

  const trg = page.locator(mode.trigger).first();
  if (!(await trg.count())) { console.log('  找不到触发器 ' + mode.trigger); continue; }
  await trg.scrollIntoViewIfNeeded().catch(() => {});
  await trg.click({ timeout: 8000 }).catch(e => console.log('  触发器点不动：' + String(e.message).slice(0, 60)));
  await page.waitForSelector(mode.panel, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(450);

  const dump = await page.evaluate(DUMP(mode.panel));
  if (!dump.found) {
    console.log('  面板没张开 ' + mode.panel);
    const diag = await page.evaluate((sel) => {
      const t = document.querySelector(sel);
      if (!t) return { trigger: null };
      const r = t.getBoundingClientRect();
      return { trigger: { x: Math.round(r.x), w: Math.round(r.width), h: Math.round(r.height) }, expanded: t.getAttribute('aria-expanded'),
               panels: Array.from(document.querySelectorAll('[class*=config-panel],[class*=inline-menu]')).map(el => el.className).slice(0, 6) };
    }, mode.trigger);
    console.log('     诊断：' + JSON.stringify(diag));
    continue;
  }
  const p = dump.panel;
  console.log('  面板 ' + p.el + '  rect=' + JSON.stringify(p.rect));
  console.log('       pad=' + p.pad + '  宽=' + p.width + '  最大高=' + p.maxH + '  圆角=' + p.radius + '  overflowY=' + p.overflow + '  density=' + (p.density || '—'));
  dump.kids.forEach(k => console.log('     ' + '  '.repeat(k.depth - 1) + '└ ' + k.el.padEnd(32) + ' h=' + k.rect.h + ' y=' + k.rect.y +
    '  pad=' + k.pad.padEnd(26) + ' mt=' + k.marginTop + ' gap=' + k.gap + ' 按钮' + String(k.btns).padStart(2) + ' 内缩 左' + k.insetL + '/右' + k.insetR));
  console.log('  行级（y/h/左/右/间距）：');
  dump.rows.forEach((r, i) => console.log('     y=' + String(r.y).padStart(5) + ' h=' + String(r.h).padStart(3) + ' x[' + r.left + '..' + r.right + ']' +
    '  间距 ' + (i === 0 ? '—' : String(dump.gaps[i - 1]).padStart(3)) + '  按钮pad=' + String(r.pad).padEnd(24) + ' 圆角=' + r.radius + ' gap=' + r.gap + '  「' + r.text + '」'));
  console.log('  行间距序列：' + JSON.stringify(dump.gaps));
  console.log('  节奏：' + JSON.stringify(dump.rhythm));
  console.log('  标题类节点：' + dump.heads.map(h => h.y + '/' + h.h + '/x' + h.left + '「' + h.text + '」').join('  '));
  /* 关掉面板，避免影响下一个模式 */
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.click(5, 5).catch(() => {});
  await page.waitForTimeout(300);
}

console.log('\n页面错误：' + (errors.length ? errors.join(' | ') : '无'));
await browser.close();
await stopDevServer(server.proc, { owned: true });
