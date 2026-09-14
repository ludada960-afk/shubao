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
import { startDevServer, stopDevServer, gotoHealthy, skipLive } from './helpers/live-browser.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/* 关键节点：首页必须出现配置触发条才算「应用健康」 */
const READY = '.ec-config-trigger';

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

test('实机：改清晰度后，主 CTA 上的积分数确实变化（动态跟随）', async t => {
  /* ── 自起独立端口 + 健康网关（修「全量并发 flaky」，实测曾 48.9s 超时）──
     旧写法直接打 localhost:5173：全量跑时该端口可能被别人占着，
     或本 worktree 的服务被并发写入打成瞬时白屏 → 30~60s 慢红。
     现在改为**本测试专用端口**，且带健康判据重试。 */
  const server = await startDevServer();
  if (!server.ok) { skipLive(t, '无法启动独立 dev server：' + server.reason); return; }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    const health = await gotoHealthy(page, server.base, READY);
    /* 重试耗尽 → **跳过并打印明确原因**，而不是把整条 npm test 打红。
       取舍依据（用户明确要求）：本机可能被其它 agent 占满 CPU / 服务未起，
       此时对正确实现报红会污染所有人的判断（本仓已因此误报多次）。
       但**绝不静默**：skip 一定带 reason，且醒目打印。 */
    if (!health.ok) {
      console.log('\n⚠️ [SKIP-LIVE] 等待应用健康失败（' + health.attempts + ' 次重试耗尽）：' + health.reason);
      console.log('⚠️  source=' + server.source + '（本机是否被其它 agent 占满 CPU / 服务是否已起？）\n');
      t.skip('SKIP-LIVE: ' + health.reason);
      return;
    }
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
    stopDevServer(server.proc, { owned: server.owned });
  }
});
