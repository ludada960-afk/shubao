// test/home-cta-points-live.test.mjs
// 2026-09-15 用户需求（原话）：
//   「下面为什么要有『当前约 1 AI 积分/张』这一句？没必要，动态调整任何东西，
//    右下角积分跟着变就可以了。不需要说明。」
//
// 关键区分（这条曾被误读的风险）：
//   要删的是**静态说明文字**；**CTA 上的积分数必须保留，且随参数动态变化**。
//
// 本测试做实机验证：真实渲染首页 → 打开生成设置 → 改清晰度 →
// 断言主 CTA 上的积分数**确实变了**。这是「动态跟随」唯一可信的证据 ——
// 只扫源码无法证明「跟着变」，只能证明「有这段代码」。
//
// dev server 不可用时跳过浏览部分（与既有 asset-library 系列测试同一约定），
// 但**静态契约仍然强制**，不会静默全过。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const BASE = 'http://localhost:5173/';

/** dev server 不可用则返回 null，交由调用方决定跳过浏览断言。 */
async function openHome() {
  try {
    const res = await fetch(BASE, { method: 'GET' });
    if (!res.ok) return null;
  } catch {
    return null;
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(4500);
  return { browser, page };
}

const readCta = page => page.evaluate(() => {
  const b = document.querySelector('.ec-workbench-cta');
  if (!b) return null;
  const span = b.querySelector('.ec-workbench-cta-points');
  return {
    ctaText: b.textContent.replace(/\s+/g, ' ').trim(),
    points: span ? span.textContent.trim() : null,
  };
});

/* ── 静态契约（不依赖 dev server） ── */

test('CTA 积分绑定的是计算结果而非静态文案', () => {
  const ec = read('src/pages/Home/EcMode.jsx');
  assert.ok(ec.includes('ec-workbench-cta-points'), 'CTA 内必须有积分容器');
  assert.ok(
    /ec-workbench-cta-points">\{planPoints\.points\}/.test(ec),
    '积分文案必须绑定 planPoints.points（动态），不得是写死的字符串',
  );
  assert.ok(ec.includes('planPoints'), '积分必须由 planPoints 实时计算');
});

test('静态说明句已删除，但动态积分链路完好', () => {
  const panel = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  assert.ok(!panel.includes('当前约'), '生成设置面板不得再有「当前约 …」说明句');
  assert.ok(!panel.includes('AI 积分/张'), '该说明整句删除');
  const ec = read('src/pages/Home/EcMode.jsx');
  assert.ok(ec.includes('generationUnits'), '积分仍与后端 generationUnits 同源');
});

/* ── 实机契约：积分必须随参数变化 ── */

test('实机：改清晰度后，主 CTA 上的积分数确实变化（动态跟随）', async () => {
  const ctx = await openHome();
  if (!ctx) {
    console.log('[skip-browse] dev server 不可用，跳过实机断言（静态契约已在上面强制）');
    return;
  }
  const { browser, page } = ctx;
  try {
    const before = await readCta(page);
    assert.ok(before, '首页必须存在主 CTA');
    assert.ok(before.points, '主 CTA 上必须显示积分数（用户要求保留）');

    const triggers = await page.$$('.ec-config-trigger');
    assert.ok(triggers.length > 0, '必须存在配置触发条');
    await triggers[0].click();
    await page.waitForTimeout(800);

    const atRest = await readCta(page);
    /* 切到最高档清晰度：积分数应上升（4K 单价高于 2K） */
    const pick = async label => {
      const el = await page.$('#ec-floating-panel button:has-text("' + label + '")');
      if (el) { await el.click(); await page.waitForTimeout(600); }
      return readCta(page);
    };
    const high = await pick('4K');
    const low = await pick('1K');

    const series = [atRest.points, high.points, low.points];
    assert.ok(
      new Set(series).size > 1,
      '主 CTA 的积分数必须随清晰度变化，实测序列：' + series.join(' → '),
    );
    /* 说明句不得因为「积分保留」而被加回来 */
    const caption = await page.evaluate(() => {
      const p = document.getElementById('ec-floating-panel');
      return /当前约|AI 积分\/张/.test(p.textContent);
    });
    assert.equal(caption, false, '面板内不得重新出现「当前约 … AI 积分/张」说明句');
  } finally {
    await browser.close();
  }
});
