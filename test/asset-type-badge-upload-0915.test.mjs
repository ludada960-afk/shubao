// test/asset-type-badge-upload-0915.test.mjs
// 2026-09-15 用户批注（资产库照竞品收口）：
//   ① 卡片左上角必须**常显**素材类型角标（图片/视频/音频，图标 + 文字小胶囊，不依赖 hover）；
//   ② 角标不得与打勾圈重叠 —— 打勾圈移到角标正下方（CSS top: 38px），悬停实测两框不相交；
//   ③ 管理弹窗上传按钮明显（高度 ≥ 36px、图标+文字、主色实心）、搜索框与分类 tab 同高、
//      分类 tab 胶囊按钮、选中态深色实心、卡片间距 12~16px；
//   ④ 空态/说明文案写清素材来源（你上传的文件 · 从画布加入 · 从作品加入）；
//   ⑤ 防回归：165×165 方卡、封面 cover 填满、名称底部渐变遮罩、悬停垃圾桶全部保留。
// 真实渲染走 QA 通道（http://localhost:5173/?qa=ec-canvas）+ 接口 mock；dev server 不可用时跳过浏览器断言。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const modal = read('src/pages/EcCanvas/components/CanvasAssetPickerModal.jsx');
const pickerCss = read('src/pages/EcCanvas/components/canvas-asset-picker.css');
const supervisorCss = read('src/styles/canvas-supervisor.css');
/* D5 token 迁移后，颜色可能以 --sb-* 变量表达；断言「解析后的值」时需要真源。 */
const tokensV3 = read('src/styles/design-tokens-v3.css');

const SHOTS_DIR = fileURLToPath(new URL('../.playwright-shots/asset-type-badge-0915/', import.meta.url));
mkdirSync(SHOTS_DIR, { recursive: true });

/* ═══════════════ 静态断言（不依赖浏览器，任何环境都跑） ═══════════════ */

test('① 选择弹窗：卡片左上角类型角标常显 —— JSX 有 TYPE_BADGES 映射 + 角标元素（图标 + 文字）', () => {
  assert.ok(modal.includes('const TYPE_BADGES = Object.freeze({'), '类型角标映射存在');
  assert.ok(modal.includes("image: { label: '图片', Icon: ImageIcon }"), '图片 → 图片角标');
  assert.ok(modal.includes("video: { label: '视频', Icon: VideoIcon }"), '视频 → 视频角标');
  assert.ok(modal.includes("audio: { label: '音频', Icon: Music }"), '音频 → 音频角标');
  assert.ok(modal.includes('className="canvas-asset-picker-type"'), '角标元素存在（span.canvas-asset-picker-type）');
  assert.ok(modal.includes('aria-hidden="true"'), '角标是装饰性元素（不干扰读屏）');
  assert.ok(modal.includes('<TypeIcon size={11} strokeWidth={2.2} />'), '角标带图标');
  assert.ok(modal.includes('{typeBadge.label}'), '角标带文字');
});

test('① 选择弹窗：角标 CSS 常显 —— 左上角、不设 opacity:0、不挡点卡', () => {
  const badge = pickerCss.match(/\.canvas-asset-picker-type \{([^}]*)\}/);
  assert.ok(badge, '角标样式存在');
  assert.ok(badge[1].includes('position: absolute'), '绝对定位');
  assert.ok(badge[1].includes('top: 8px') && badge[1].includes('left: 8px'), '左上角');
  assert.ok(!badge[1].includes('opacity: 0'), '不做任何隐藏（默认透明度即可见，常显）');
  assert.ok(badge[1].includes('pointer-events: none'), '不挡卡片点击');
  assert.ok(badge[1].includes('border-radius: 999px'), '小胶囊');
  assert.ok(badge[1].includes('rgba(20,18,16,.62)'), '半透明深色底');
  /* 2026-09-14 §18 灰阶迁移：白字改用 token --sb-neutral-0（值不变）。
     断言改为「白字语义」：字面量或 V3 token 均可。 */
  assert.ok(/color:\s*(#fff\b|var\(--sb-neutral-0\))/.test(badge[1]), '白字');
});

test('② 角标与打勾圈不重叠 —— 打勾圈下移到角标正下方（top: 38px = 8 + 角标高 22 + 8 间距）', () => {
  const check = pickerCss.match(/\.canvas-asset-picker-check \{([^}]*)\}/);
  assert.ok(check, '打勾圈样式存在');
  assert.ok(check[1].includes('top: 38px'), '打勾圈 top 移到 38px（角标 22px 高下方）');
  const badge = pickerCss.match(/\.canvas-asset-picker-type \{([^}]*)\}/);
  const badgeTop = Number.parseFloat(badge[1].match(/top: (\d+)px/)[1]);
  const badgeH = Number.parseFloat(badge[1].match(/height: (\d+)px/)[1]);
  const checkTop = Number.parseFloat(check[1].match(/top: (\d+)px/)[1]);
  assert.ok(checkTop >= badgeTop + badgeH, '打勾圈 top ≥ 角标底边（盒模型永不相叠），实际 ' + badgeTop + '+' + badgeH + ' vs ' + checkTop);
});

test('④ 空态文案写清素材来源，且够短（9-16 收短为一句面向用户的话）', () => {
  /* 9-16 用户批注：面向用户文案要短、说结果不说机制。 */
  assert.ok(modal.includes('资产库还没有素材'), '空态说明"没有素材"这一事实');
  assert.ok(modal.includes('上传文件') && modal.includes('画布') && modal.includes('作品'), '空态写清素材从哪来');
  const copy = modal.match(/资产库还没有素材[^<]*/)[0];
  assert.ok(copy.length <= 40, '空态文案要短（≤40 字），实际 ' + copy.length + ' 字：' + copy);
});

test('③ 管理弹窗：上传按钮 ≥ 36px、图标+文字、主色实心（canvas-supervisor.css）', () => {
  const upload = supervisorCss.match(/\.ec-asset-upload \{([^}]*)\}/);
  assert.ok(upload, '上传按钮样式存在');
  const h = Number.parseFloat(upload[1].match(/height: (\d+)px/)?.[1] || '0');
  assert.ok(h >= 36, '上传按钮高度 ≥ 36px，实际 ' + h + 'px');
  assert.ok(upload[1].includes('linear-gradient(135deg, #7454f3, #d14db5)'), '主色实心渐变');
  /* 处置：b) 规范被取代（docs/design/40-decisions.md D5「全局 token 迁移」）。
     品牌紫硬编码迁移批次把 color:#fff 换成了 color: var(--sb-neutral-0)
     （见 commit a9eb14c7「品牌紫硬编码迁移 批 1/4」），而 --sb-neutral-0 = #FFFFFF，
     渲染结果不变。故这里断言**解析后的值是白色**，而不是字面量 #fff。 */
  const colorDecl = upload[1].match(/color:\s*([^;]+)/)?.[1]?.trim() || '';
  const NEUTRAL_0 = tokensV3.match(/--sb-neutral-0:\s*([^;]+)/)?.[1]?.trim();
  const isWhite = /^#fff(fff)?$/i.test(colorDecl) || colorDecl === 'white';
  const isWhiteToken = colorDecl.includes('--sb-neutral-0') && /^#fff(fff)?$/i.test(NEUTRAL_0 || '');
  assert.ok(isWhite || isWhiteToken, '文字解析后为白色（字面量或 --sb-neutral-0），实际 ' + colorDecl);
  assert.ok(upload[1].includes('gap: 6px'), '图标+文字并排');
});

test('③ 管理弹窗：搜索框 36px 同高 + 分类 tab 胶囊、选中态深色实心 + 卡片间距 16px', () => {
  assert.ok(supervisorCss.includes('.canvas-asset-library-modal input[type="search"] { height: 36px !important;'), '搜索框 36px');
  assert.ok(supervisorCss.includes('.canvas-asset-library-modal [role="tablist"] > button {') , 'tablist 覆盖规则存在');
  assert.ok(supervisorCss.includes('.canvas-asset-library-modal [role="tablist"] > button[aria-selected="true"] { background: #202226 !important;'), '选中态深色实心');
  /* 9-16 用户批注「东西全堆在一起，没有间距」→ 卡片间距 12 → 16px。 */
  assert.ok(/gap: 16px 16px !important/.test(supervisorCss), '卡片间距 16px');
});

test('① 管理弹窗：卡片左上角类型角标（无额外 DOM，:has() 按封面元素识别 + SVG 图标 + 文字）', () => {
  assert.ok(supervisorCss.includes('.canvas-asset-library-modal article::before {'), '角标基础规则（图片兜底）');
  assert.ok(supervisorCss.includes('content: url("data:image/svg+xml;utf8,<svg'), '角标带 SVG 图标');
  assert.ok(supervisorCss.includes('" 图片"'), '图片文案');
  assert.ok(supervisorCss.includes('.canvas-asset-library-modal article:has(video)::before'), '视频角标规则');
  assert.ok(supervisorCss.includes('" 视频"'), '视频文案');
  assert.ok(supervisorCss.includes('.canvas-asset-library-modal article:has(audio)::before'), '音频角标规则');
  assert.ok(supervisorCss.includes('" 音频"'), '音频文案');
  const before = supervisorCss.match(/\.canvas-asset-library-modal article::before \{([^}]*)\}/);
  assert.ok(before[1].includes('top: 8px') && before[1].includes('left: 8px'), '左上角');
  assert.ok(before[1].includes('rgba(20,18,16,.62)'), '半透明深色底');
});

/* ═══════════════ 真实渲染断言（QA 通道 + 接口 mock） ═══════════════ */

async function devServerUp() {
  try {
    const res = await fetch('http://localhost:5173/?qa=ec-canvas', { method: 'GET' });
    return res.ok;
  } catch { return false; }
}
const HAS_SERVER = await devServerUp();
const serverGate = HAS_SERVER ? {} : { skip: 'vite dev server (localhost:5173) 不可用，跳过真实渲染断言' };

const KINDS = ['image', 'image', 'image', 'image', 'video', 'audio'];
function makeAssets(total) {
  return Array.from({ length: total }, (_, i) => {
    const mediaKind = KINDS[i % KINDS.length];
    return {
      projectId: 'qa-p1',
      projectTitle: '测试项目',
      projectAssetId: 'qa-a' + (i + 1),
      assetId: 'asset-' + (i + 1),
      contentHash: 'hash-' + (i + 1),
      mediaKind,
      stableUrl: '/images/cropped_5.png',
      playbackUrl: mediaKind === 'video' ? '/images/cropped_5.png' : undefined,
      createdAt: '2026-09-10T08:' + String(i % 60).padStart(2, '0') + ':00Z',
      metadata: { displayName: '素材 ' + (i + 1) },
    };
  });
}

async function importPlaywright() {
  const { createRequire } = await import('node:module');
  const require = createRequire(new URL('../package.json', import.meta.url));
  return require('playwright');
}

async function openPickerOn(page, total) {
  await page.route('**/api/project-assets**', route => {
    const limit = Number(new URL(route.request().url()).searchParams.get('limit') || 0);
    const all = makeAssets(total);
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assets: all.slice(0, limit || all.length) }) });
  });
  await page.route('**/api/**usage**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ usage: { usedBytes: 1, quotaBytes: 104857600 } }) }));
  await page.route('**/api/**assets/**/delete**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
  await page.goto('http://localhost:5173/?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.ec-canvas-rail-add', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator('.ec-canvas-rail-add').first().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("从资产库选择")').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.canvas-asset-picker-card').length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(600);
}

test('真实渲染①：角标**常显**且文案按类型正确（图片/视频/音频），悬停后打勾圈与角标不相叠', serverGate, async t => {
  const { chromium } = await importPlaywright();
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await openPickerOn(page, 18);
  const cards = await page.locator('.canvas-asset-picker-card').evaluateAll(els => els.map(card => {
    const badge = card.querySelector('.canvas-asset-picker-type');
    const hasImg = !!card.querySelector('.canvas-asset-picker-thumb img');
    const hasVideo = !!card.querySelector('.canvas-asset-picker-thumb video');
    const expected = hasVideo ? '视频' : hasImg ? '图片' : '音频';
    return {
      expected,
      badgeText: badge ? badge.innerText.replace(/\s+/g, ' ').trim() : null,
      badgeOpacity: badge ? getComputedStyle(badge).opacity : null,
    };
  }));
  for (const card of cards) {
    assert.equal(card.badgeText, card.expected, '角标文案 = ' + card.expected + '（实际 ' + card.badgeText + '）');
    assert.equal(card.badgeOpacity, '1', '角标 opacity 1（常显，不需要 hover）');
  }
  assert.ok(cards.length >= 12, '至少 12 张卡带角标，实际 ' + cards.length);
  // 悬停第一张卡：打勾圈浮现，且与角标盒不相交
  const first = page.locator('.canvas-asset-picker-card').first();
  await first.hover();
  await page.waitForTimeout(450);
  const pos = await page.evaluate(() => {
    const card = document.querySelector('.canvas-asset-picker-card');
    const b = card.querySelector('.canvas-asset-picker-type').getBoundingClientRect();
    const c = card.querySelector('.canvas-asset-picker-check').getBoundingClientRect();
    const cs = getComputedStyle(card.querySelector('.canvas-asset-picker-check'));
    return { badgeBottom: b.bottom, checkTop: c.top, checkOpacity: cs.opacity };
  });
  assert.equal(pos.checkOpacity, '1', '悬停后打勾圈可见');
  assert.ok(pos.checkTop >= pos.badgeBottom - 0.5, '打勾圈 top ' + pos.checkTop + ' ≥ 角标底边 ' + pos.badgeBottom + '（两盒不相叠）');
  await page.screenshot({ path: SHOTS_DIR + '/picker-badges-hover.png' });
  t.diagnostic('角标常显 opacity=1、文案按类型正确；悬停打勾圈在角标下方不相叠');
});

test('真实渲染②：40 条素材 —— 卡片 165×165 方形 + 首屏相邻两行行距 ≥ 14px（39 条可见行不塌）', serverGate, async t => {
  const { chromium } = await importPlaywright();
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await openPickerOn(page, 40);
  const boxes = await page.locator('.canvas-asset-picker-card').evaluateAll(els => els.map(n => {
    const r = n.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, w: r.width, h: r.height };
  }));
  assert.equal(boxes.length, 24, '首批 24 张卡（40 条素材按批渲染）');
  const w = Math.round(boxes[0].w), h = Math.round(boxes[0].h);
  assert.ok(Math.abs(w - 165) <= 3 && Math.abs(h - 165) <= 3, '卡片方形 165×165（实际 ' + w + '×' + h + '）');
  const distinctHeights = [...new Set(boxes.map(b => Math.round(b.h * 10) / 10))];
  assert.equal(distinctHeights.length, 1, '所有卡片高度一致');
  const rowTops = [...new Set(boxes.map(b => Math.round(b.top)))].sort((a, b) => a - b);
  assert.ok(rowTops.length >= 2, '存在至少两行');
  const measured = [];
  for (let r = 0; r < rowTops.length - 1; r++) {
    const row = boxes.filter(b => Math.round(b.top) === rowTops[r]);
    const next = boxes.filter(b => Math.round(b.top) === rowTops[r + 1]);
    const gap = Math.min(...next.map(b => b.top)) - Math.max(...row.map(b => b.bottom));
    measured.push(Math.round(gap * 100) / 100);
    assert.ok(gap >= 14, '第 ' + (r + 1) + '→' + (r + 2) + ' 行间距 ' + gap + 'px 必须 ≥ 14px（卡片不得重叠）');
  }
  // 封面填满：缩略图 img/video 盒与卡片同宽
  const thumb = await page.locator('.canvas-asset-picker-thumb').first().evaluate(el => {
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  assert.ok(Math.abs(thumb.w - w) <= 2, '封面填满卡宽（thumb ' + thumb.w + ' vs card ' + w + '）');
  await page.screenshot({ path: SHOTS_DIR + '/picker-40items.png' });
  t.diagnostic('40 条素材：卡片 ' + w + '×' + h + '；实测相邻行距(px)：' + measured.join(', '));
});

test('真实渲染③：空态说明来源（无素材时展示来源文案）', serverGate, async t => {
  const { chromium } = await importPlaywright();
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route('**/api/project-assets**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assets: [] }) }));
  await page.route('**/api/**usage**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ usage: { usedBytes: 1, quotaBytes: 104857600 } }) }));
  await page.route('**/api/**assets/**/delete**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
  await page.goto('http://localhost:5173/?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.ec-canvas-rail-add', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator('.ec-canvas-rail-add').first().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("从资产库选择")').first().click();
  await page.waitForSelector('.canvas-asset-picker-empty', { timeout: 15000 });
  const text = (await page.locator('.canvas-asset-picker-empty').innerText()).replace(/\s+/g, ' ').trim();
  assert.ok(text.includes('上传文件') && text.includes('画布') && text.includes('作品'), '空态写清素材来源，实际：' + text);
  assert.ok(text.length <= 40, '空态文案要短（≤40 字），实际 ' + text.length + ' 字');
  await page.screenshot({ path: SHOTS_DIR + '/picker-empty.png' });
  t.diagnostic('空态文案：' + text);
});
