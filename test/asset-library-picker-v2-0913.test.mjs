// test/asset-library-picker-v2-0913.test.mjs
// 2026-09-13 用户五条批注的回归测试（画布「从资产库选择」弹窗）：
//   ① 卡片行与行必须留出空隙 —— 真实渲染实测相邻两行 boundingRect：row2.top - row1.bottom ≥ 14px；
//   ② 不要一次性全量加载 —— 首批 24 条 + IntersectionObserver 底部哨兵无限滚动，每批 24，
//      加载中「正在加载更多…」、到底「已经到底了」，搜索/切分类重置回第一批；
//   ③ 左上角打勾圆圈必须可点 —— 真正可点的多选按钮（onClick + stopPropagation），选中不触发删除；
//   ④ 垃圾桶删除必须二次确认 —— 复用项目统一确认弹窗（useDialog），未确认前不调 deleteProjectAsset，
//      删除中忙碌态防连点；
//   ⑤ 保留：方卡/cover/名称遮罩/悬停出现垃圾桶与打勾/遮罩关闭。
// 真实渲染走 QA 通道（http://localhost:5173/?qa=ec-canvas）+ 接口 mock；dev server 不可用时跳过浏览器断言。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const modal = read('src/pages/EcCanvas/components/CanvasAssetPickerModal.jsx');
const css = read('src/pages/EcCanvas/components/canvas-asset-picker.css');

const SHOTS_DIR = fileURLToPath(new URL('../.playwright-shots/asset-modal-v2/', import.meta.url));
mkdirSync(SHOTS_DIR, { recursive: true });

/* ═══════════════ 静态断言（不依赖浏览器，任何环境都跑） ═══════════════ */

test('首批 24 条：分页常量 PAGE_SIZE=24，首屏请求 limit 用 PAGE_SIZE（不再一次拉 500）', () => {
  assert.ok(modal.includes('const PAGE_SIZE = 24;'), '分页常量 PAGE_SIZE = 24');
  assert.ok(modal.includes('const CATALOG_LIMIT = 500;'), '全量快照上限 CATALOG_LIMIT = 500');
  assert.ok(modal.includes('listProjectAssetLibrary({ mediaKind: mediaFilter, query, limit: PAGE_SIZE })'), '首屏请求使用每批 24 的 limit');
  const firstLoad = modal.split('首屏 / 搜索 / 切分类')[1].split('同步「已经渲染')[0] || '';
  assert.ok(!firstLoad.includes('limit: 500'), '首屏 effect 里不得出现 limit: 500（24 条第 1 批）');
});

test('无限滚动：IntersectionObserver 观察栅格底部哨兵 + 批次状态文案', () => {
  assert.ok(modal.includes('new IntersectionObserver('), '使用 IntersectionObserver');
  assert.ok(modal.includes('sentinelRef'), '底部哨兵 ref');
  assert.ok(modal.includes('canvas-asset-picker-sentinel'), '哨兵元素');
  assert.ok(modal.includes("rootMargin: '0px 0px 160px 0px'"), '提前 160px 触发');
  assert.ok(modal.includes('正在加载更多…'), '批次加载中提示');
  assert.ok(modal.includes('已经到底了'), '全部加载完提示');
});

test('打勾圆圈 = 真正可点的多选按钮（onClick + stopPropagation，不触发删除）', () => {
  assert.ok(modal.includes('className="canvas-asset-picker-check"'), '圆圈元素存在');
  assert.ok(modal.includes('aria-pressed={isSelected}'), '圆圈带选中态 aria');
  assert.ok(modal.includes('event.stopPropagation(); toggle(item);'), '圆圈点击 stopPropagation + 只切选中');
  assert.ok(modal.includes('取消选中 '), '圆圈有取消选中语义');
  /* 9-16 文案收短后，圆圈 tooltip 只描述动作（不再出现交互机制说明）——见本文件下方同名断言。 */
assert.ok(!modal.includes('选中后可一次加入画布'), '圆圈 tooltip 不再含机制说明');
  const m = css.match(/\.canvas-asset-picker-check \{([^}]*)\}/);
  assert.ok(m, '打勾圆圈样式存在');
  assert.ok(m[1].includes('cursor: pointer'), '圆圈可点');
  assert.ok(css.includes('.canvas-asset-picker-card.is-selected .canvas-asset-picker-check { opacity: 1; background: #7c3aed;'), '选中态实心紫底');
});

test('选中用途提示：底栏「已选 N 个」+ 主按钮计数（9-16 文案收短，去掉机制说明）', () => {
  /* 9-16 用户批注：「不要出现『选择之后会高亮』这种内部逻辑说明」。
     底栏与 tooltip 只留结果与计数，不再解释"确认后一起加入画布"这类交互机制。 */
  assert.ok(modal.includes('已选 {picked.length} 个'), '底栏左侧只留计数');
  assert.ok(modal.includes("title={isSelected ? '取消选中' : '选中'}"), '打勾圈 tooltip 只描述动作');
  assert.ok(modal.includes('加入画布'), '主按钮保留「加入画布」');
  /* 只在**渲染出来的文案**里断言：源码注释里出现这些词不算面向用户文案。
     先剥掉 JSX 注释与行注释，再检查用户可见文案。 */
  const rendered = modal
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  assert.ok(!rendered.includes('确认后一起加入画布'), '用户可见文案里不再有交互机制说明（正文）');
  assert.ok(!rendered.includes('选中后可一次加入画布'), '用户可见文案里不再有交互机制说明（tooltip）');
});

test('删除二次确认：复用项目统一确认弹窗（useDialog），确认前不调接口，删除中忙碌态', () => {
  assert.ok(modal.includes("import { useDialog } from '../../../components/ui/DialogProvider.jsx';"), '复用项目统一确认弹窗');
  assert.ok(modal.includes('const { confirm } = useDialog();'), 'useDialog -> confirm');
  assert.ok(modal.includes('const confirmed = await confirm({'), '异步确认');
  assert.ok(modal.includes("title: '删除这个素材？'"), '弹窗标题');
  assert.ok(modal.includes("message: '删除后不可恢复。'"), '弹窗正文（9-16 收短，只说结果）');
  assert.ok(modal.includes("confirmLabel: '删除'"), '确认按钮文案「删除」');
  assert.ok(modal.includes('if (!confirmed) return;'), '确认前直接 return（取消什么都不做）');
  const afterConfirm = modal.split('if (!confirmed) return;')[1] || '';
  assert.ok(afterConfirm.includes('deleteProjectAsset('), '确认后才调用 deleteProjectAsset');
  assert.ok(modal.includes("data-busy={busyKey === key ? 'true' : undefined}"), '删除中 busy 标记');
  assert.ok(modal.includes('disabled={busyKey === key}'), '删除中禁点防连发');
  assert.ok(modal.includes('canvas-asset-picker-delete-spinner'), '删除中转圈');
  assert.ok(css.includes('.canvas-asset-picker-delete[data-busy="true"] { opacity: 1;'), '忙碌态强制可见');
});

test('行距规则（CSS）：栅格 row gap ≥ 14px，行高按内容自适应 + align-content:start 防 stretch 压扁，卡片高度兜底 165px', () => {
  const m = css.match(/\.canvas-asset-picker-grid \{([^}]*)\}/);
  assert.ok(m, '栅格样式存在');
  const gapMatch = m[1].match(/gap: ([^;]+);/);
  const gap = gapMatch ? gapMatch[1].trim() : '';
  const rowGap = Number.parseFloat(gap.split(/\s+/)[0]);
  assert.ok(rowGap >= 14, '行距必须 ≥ 14px，实际 CSS 行距：' + gap);
  assert.ok(m[1].includes('grid-auto-rows: min-content'), '行高按内容自适应（min-content，不被容器高度压扁）');
  assert.ok(m[1].includes('align-content: start'), 'align-content: start，栅格行不被 stretch 压扁');
  const card = css.match(/\.canvas-asset-picker-card \{([^}]*)\}/);
  assert.ok(card, '卡片样式存在');
  assert.ok(card[1].includes('min-height: 165px'), '卡片高度兜底 165px（封面高 + 边框），任何情况下不塌成细条');
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

function makeAssets(total) {
  return Array.from({ length: total }, (_, i) => ({
    projectId: 'qa-p1',
    projectTitle: '测试项目',
    projectAssetId: 'qa-a' + (i + 1),
    assetId: 'asset-' + (i + 1),
    contentHash: 'hash-' + (i + 1),
    mediaKind: 'image',
    stableUrl: '/images/cropped_5.png',
    createdAt: '2026-09-10T08:' + String(i % 60).padStart(2, '0') + ':00Z',
    metadata: { displayName: '素材 ' + (i + 1) },
  }));
}

async function openPickerOn(page, total, { catalogDelayMs = 0 } = {}) {
  const requests = [];
  await page.route('**/api/project-assets**', async route => {
    const url = route.request().url();
    requests.push(url);
    const limit = Number(new URL(url).searchParams.get('limit') || 0);
    const all = makeAssets(total);
    const body = JSON.stringify({ assets: all.slice(0, limit || all.length) });
    if (catalogDelayMs && limit > 24) {
      await new Promise(resolve => setTimeout(resolve, catalogDelayMs));
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body });
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
  return requests;
}

async function importPlaywright() {
  const { createRequire } = await import('node:module');
  const require = createRequire(new URL('../package.json', import.meta.url));
  return require('playwright');
}

test('真实渲染①行距：拦截 /api/project-assets 返回 12 条，实测相邻两行 row2.top - row1.bottom ≥ 14px', serverGate, async t => {
  const { chromium } = await importPlaywright();
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await openPickerOn(page, 12);
  const boxes = await page.locator('.canvas-asset-picker-card').evaluateAll(els => els.map(n => {
    const r = n.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, h: r.height };
  }));
  assert.ok(boxes.length >= 10, '至少两行卡片可见，实际 ' + boxes.length);
  const distinctHeights = [...new Set(boxes.map(b => Math.round(b.h * 10) / 10))];
  assert.equal(distinctHeights.length, 1, '所有卡片高度一致（distinctHeights 单值，行高不被压扁），实际 ' + JSON.stringify(distinctHeights));
  const rowTops = [...new Set(boxes.map(b => Math.round(b.top)))].sort((a, b) => a - b);
  assert.ok(rowTops.length >= 2, '存在至少两行，实际 ' + rowTops.length);
  const measured = [];
  for (let r = 0; r < rowTops.length - 1; r++) {
    const row = boxes.filter(b => Math.round(b.top) === rowTops[r]);
    const next = boxes.filter(b => Math.round(b.top) === rowTops[r + 1]);
    const gap = Math.min(...next.map(b => b.top)) - Math.max(...row.map(b => b.bottom));
    measured.push(Math.round(gap * 100) / 100);
    assert.ok(gap >= 14, '第 ' + (r + 1) + '→' + (r + 2) + ' 行间距 ' + gap + 'px 必须 ≥ 14px（卡片不得重叠）');
  }
  await page.screenshot({ path: SHOTS_DIR + '/test-1-row-gap-12-items.png' });
  assert.ok((await page.locator('.canvas-asset-picker-more.is-end').innerText()).includes('已经到底了'), '12 条全部加载完显示已到底');
  t.diagnostic('实测相邻行距(px)：' + measured.join(', '));
});

test('真实渲染②无限滚动：首批 24 条 + 滚动每批追加 24 + 到底提示 + 切分类重置第一批', serverGate, async t => {
  const { chromium } = await importPlaywright();
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const requests = await openPickerOn(page, 60, { catalogDelayMs: 600 });
  assert.ok(requests[0].includes('limit=24'), '首屏请求必须是每批 24 条，实际 ' + requests[0]);
  assert.equal(await page.locator('.canvas-asset-picker-card').count(), 24, '首批恰好 24 张卡');
  const grid = page.locator('.canvas-asset-picker-grid');
  await grid.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const moreText = page.locator('.canvas-asset-picker-more:not(.is-end)');
  await moreText.waitFor({ state: 'visible', timeout: 3000 });
  assert.ok((await moreText.innerText()).includes('正在加载更多…'), '批次加载中提示');
  await page.waitForFunction(() => document.querySelectorAll('.canvas-asset-picker-card').length === 48, null, { timeout: 5000 });
  await grid.evaluate(el => { el.scrollTop = el.scrollHeight; });
  await page.waitForFunction(() => document.querySelectorAll('.canvas-asset-picker-card').length === 60, null, { timeout: 5000 });
  await page.waitForSelector('.canvas-asset-picker-more.is-end', { timeout: 3000 });
  assert.ok((await page.locator('.canvas-asset-picker-more.is-end').innerText()).includes('已经到底了'), '60 条全部加载完显示已到底');
  const limits = requests.map(u => { const m = u.match(/limit=(\d+)/); return m ? m[1] : ''; });
  assert.deepEqual(limits, ['24', '500'], '请求序列应为首批 24 + 一次 500 全量快照，实际 ' + JSON.stringify(limits));
  await page.screenshot({ path: SHOTS_DIR + '/test-2-infinite-scroll-60.png' });
  await page.locator('.canvas-asset-picker-tabs button').filter({ hasText: '图片' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.canvas-asset-picker-card').length === 24, null, { timeout: 5000 });
  assert.equal(await page.locator('.canvas-asset-picker-card').count(), 24, '切分类后重置回第一批 24 张');
  assert.ok(requests[requests.length - 1].includes('limit=24'), '重置后请求又是每批 24');
  t.diagnostic('首批 24 → 滚动 +24 → 48 → 滚动 +12 → 60；请求序列 limit=' + limits.join(', ') + '；切分类回到 24');
});

test('真实渲染③圆圈可点：点圆圈=选中（stopPropagation 不触发删除），点卡片其它地方同样选中', serverGate, async t => {
  const { chromium } = await importPlaywright();
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let deleteHits = 0;
  await page.route('**/api/project-assets**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assets: makeAssets(12) }) }));
  await page.route('**/api/**usage**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ usage: { usedBytes: 1, quotaBytes: 104857600 } }) }));
  await page.route('**/api/**assets/**/delete**', route => { deleteHits += 1; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }); });
  await page.goto('http://localhost:5173/?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.ec-canvas-rail-add', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator('.ec-canvas-rail-add').first().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("从资产库选择")').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.canvas-asset-picker-card').length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  const card0 = page.locator('.canvas-asset-picker-card').first();
  const card1 = page.locator('.canvas-asset-picker-card').nth(1);
  await card0.hover();
  await card0.locator('.canvas-asset-picker-check').click();
  await page.waitForTimeout(250);
  assert.ok((await card0.getAttribute('class')).includes('is-selected'), '点圆圈后卡片进入选中态');
  assert.equal(await card0.locator('.canvas-asset-picker-check').getAttribute('aria-pressed'), 'true');
  assert.equal(deleteHits, 0, '点圆圈不得触发删除');
  const box1 = await card1.boundingBox();
  await page.mouse.click(box1.x + box1.width / 2, box1.y + box1.height / 2);
  await page.waitForTimeout(250);
  assert.ok((await card1.getAttribute('class')).includes('is-selected'), '点卡片正文也会选中');
  assert.equal(deleteHits, 0, '点卡片正文不得触发删除');
  /* 处置：b) 规范被取代（docs/design/40-decisions.md D 系列 · 底部操作区唯一真源）。
     原断言用**元素选择器** `.canvas-asset-picker footer`，但契约要求底栏一律改挂
     `.ui-modal-footer`（本弹窗已按 P0 批次迁移，自写 <footer> + .is-primary 已退役）。
     被验证的行为不变（底栏计数 / 主按钮计数），只把定位方式换成契约类。 */
  assert.ok((await page.locator('.canvas-asset-picker .ui-modal-footer .ui-modal-footer-meta').innerText()).includes('已选 2 个'), '底栏计数');
  assert.ok((await page.locator('.canvas-asset-picker .ui-modal-footer .ui-btn-primary').innerText()).includes('加入画布 (2)'), '主按钮计数');
  await card1.hover();
  await card1.locator('.canvas-asset-picker-check').click();
  await page.waitForTimeout(250);
  assert.ok(!(await card1.getAttribute('class')).includes('is-selected'), '再点圆圈取消选中');
  assert.ok((await page.locator('.canvas-asset-picker .ui-modal-footer .ui-modal-footer-meta').innerText()).includes('已选 1 个'), '取消后计数回退');
  await page.screenshot({ path: SHOTS_DIR + '/test-3-circle-clickable.png' });
  t.diagnostic('圆圈点击选中/取消均生效，delete 请求 0 次');
});

test('真实渲染④删除二次确认：先弹「删除这个素材？」确认弹窗，取消不删、确认才删且忙碌态防连点', serverGate, async t => {
  const { chromium } = await importPlaywright();
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let deleteHits = 0;
  await page.route('**/api/project-assets**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assets: makeAssets(12) }) }));
  await page.route('**/api/**usage**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ usage: { usedBytes: 1, quotaBytes: 104857600 } }) }));
  await page.route('**/api/**assets/**/delete**', async route => {
    deleteHits += 1;
    await new Promise(resolve => setTimeout(resolve, 450));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.goto('http://localhost:5173/?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.ec-canvas-rail-add', { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.locator('.ec-canvas-rail-add').first().click();
  await page.waitForTimeout(400);
  await page.locator('button:has-text("从资产库选择")').first().click();
  await page.waitForFunction(() => document.querySelectorAll('.canvas-asset-picker-card').length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  const card1 = page.locator('.canvas-asset-picker-card').nth(1);
  const dlg = page.locator('section[role="dialog"]:has-text("删除这个素材？")');
  await card1.hover();
  await card1.locator('.canvas-asset-picker-delete').click();
  await dlg.waitFor({ state: 'visible', timeout: 3000 });
  const dlgText = (await dlg.innerText()).replace(/\s+/g, ' ').trim();
  assert.ok(dlgText.includes('删除这个素材？'), '确认弹窗标题');
  assert.ok(dlgText.includes('删除后不可恢复。'), '确认弹窗正文（9-16 收短）');
  assert.ok(dlgText.includes('取消'), '取消按钮');
  assert.ok(dlgText.includes('删除'), '确认按钮');
  assert.equal(deleteHits, 0, '弹窗出现但未确认前不得调用删除接口');
  await page.screenshot({ path: SHOTS_DIR + '/test-4-delete-confirm.png' });
  await dlg.locator('button:has-text("取消")').click();
  await page.waitForTimeout(300);
  assert.equal(await dlg.count(), 0, '取消后确认弹窗关闭');
  assert.equal(await page.locator('.canvas-asset-picker-card').count(), 12, '取消不删，卡片仍在');
  assert.equal(deleteHits, 0, '取消后依然没有删除请求');
  await card1.hover();
  await card1.locator('.canvas-asset-picker-delete').click();
  await dlg.waitFor({ state: 'visible', timeout: 3000 });
  await dlg.locator('button:has-text("删除")').click();
  await page.waitForTimeout(180);
  assert.equal(await card1.locator('.canvas-asset-picker-delete').getAttribute('data-busy'), 'true', '删除中忙碌态');
  assert.equal(await card1.locator('.canvas-asset-picker-delete').isDisabled(), true, '删除中禁点防连发');
  assert.equal(await card1.locator('.canvas-asset-picker-delete-spinner').count(), 1, '删除中显示转圈');
  await page.waitForFunction(() => document.querySelectorAll('.canvas-asset-picker-card').length === 11, null, { timeout: 5000 });
  assert.equal(deleteHits, 1, '确认后恰好一次删除请求');
  await page.screenshot({ path: SHOTS_DIR + '/test-4-after-delete.png' });
  t.diagnostic('确认弹窗文案与按钮、取消/确认两条路径、忙碌态均验证通过');
});
