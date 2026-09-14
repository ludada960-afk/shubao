// test/canvas-bottom-dock-live-centered-0920.test.mjs
// 底部操作栏「居中且不被裁」的**真实渲染契约**。
// ─────────────────────────────────────────────────────────────────────────────
// 为什么必须是实机测试（静态断言守不住这个判据）：
//   静态断言只能守「写法」（left: 50vw / 有没有 min()），
//   而本轮事故恰恰是**写法看着对、渲染结果错**：
//     · 旧实现 left: min(50vw, calc(100% - 120px)) 在 1024px + 右侧面板打开时，
//       min() 取了后者（428px），而窗口中心是 512px → **实测偏左 84px**；
//     · 1280/1440/1920 三档都在阈值以上，**只测大屏就永远发现不了**。
//   更关键的是：**裁剪与否只有真实布局能回答**（overflow 的传递、包含块、缩放层都不在源码里）。
// ─────────────────────────────────────────────────────────────────────────────
// 两个判据（本轮用户口径，必须同时成立）：
//   ① 居中：dock 中心 vs **视口中心** 偏差 ≤ 1px（不是「画布可视区中心」——那是旧口径的病根）
//   ② 不被裁：沿工具条横向逐点 hit-test，全部命中工具条自身（9/9）
// 覆盖：4 档宽度 × 右侧面板开/合 = 8 组。
//   历史证明「只测一档」必然漏 —— 故障只在 1024px 复现。
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startDevServer, stopDevServer, gotoHealthy, skipLive } from './helpers/live-browser.mjs';

const READY = '.ec-canvas-page';
const WIDTHS = [1024, 1280, 1440, 1920];
/* 判据阈值：用户要求 ≤1px（实测为 0px，留 1px 吸收 sub-pixel 舍入） */
const CENTER_TOLERANCE_PX = 1;
/* 横向探针比例：覆盖工具条全长，两端也要探（裁切总是从边缘开始） */
const PROBE_FRACTIONS = [0.02, 0.14, 0.26, 0.38, 0.5, 0.62, 0.74, 0.86, 0.98];

async function measure(page) {
  return page.evaluate((fractions) => {
    const dock = document.querySelector('.ec-canvas-bottom-dock');
    const bar = document.querySelector('.ec-canvas-bottom-toolbar');
    if (!dock || !bar) return { ok: false, reason: 'dock/toolbar 不存在' };
    const dr = dock.getBoundingClientRect();
    const br = bar.getBoundingClientRect();
    const probes = fractions.map(f => {
      const x = br.left + br.width * f;
      const y = br.top + br.height / 2;
      const el = document.elementFromPoint(x, y);
      return { f, x: Math.round(x), hit: !!(el && (bar.contains(el) || dock.contains(el))) };
    });
    return {
      ok: true,
      dockCenterX: dr.left + dr.width / 2,
      viewportCenterX: window.innerWidth / 2,
      dockSpan: [Math.round(dr.left), Math.round(dr.right)],
      probeHits: probes.filter(p => p.hit).length,
      probeTotal: probes.length,
      panelOpen: !!document.querySelector('.ec-canvas-stage.has-right-panel'),
    };
  }, PROBE_FRACTIONS);
}

test('实机：底部操作栏在 4 档宽度 × 面板开关下都「居中于视口 且 不被裁」', async t => {
  const server = await startDevServer();
  if (!server.ok) { skipLive(t, '无法启动独立 dev server：' + server.reason); return; }

  const browser = await chromium.launch();
  const failures = [];
  const measured = [];
  try {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        const health = await gotoHealthy(page, server.base + '?qa=ec-canvas', READY);
        if (!health.ok) { skipLive(t, '[' + width + 'px] 应用未进入健康态：' + health.reason); return; }
        await page.waitForTimeout(700);

        for (const withPanel of [false, true]) {
          if (withPanel) {
            /* 选中一个节点 → 右侧功能栏打开 → 画布区让位（这正是旧实现在窄屏翻车的条件） */
            await page.evaluate(() => {
              const n = document.querySelector('[data-canvas-node-id]');
              if (!n) return;
              n.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0 }));
              n.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0 }));
              n.click();
            });
            await page.waitForTimeout(1100);
          }
          const m = await measure(page);
          if (!m.ok) { failures.push(width + 'px panel=' + withPanel + '：' + m.reason); continue; }
          const delta = Math.abs(m.dockCenterX - m.viewportCenterX);
          measured.push({ width, withPanel, delta: +delta.toFixed(2), hits: m.probeHits, total: m.probeTotal, span: m.dockSpan });
          /* ① 居中（判据：视口中心，不是画布可视区中心） */
          if (delta > CENTER_TOLERANCE_PX) {
            failures.push(width + 'px panel=' + withPanel + '：中心偏差 ' + delta.toFixed(2) + 'px > ' + CENTER_TOLERANCE_PX + 'px（dock 中心 ' + m.dockCenterX.toFixed(1) + ' vs 视口中心 ' + m.viewportCenterX.toFixed(1) + '）');
          }
          /* ② 不被裁（判据：逐点 hit-test；旧 min() 版正是「不裁但偏 84px」） */
          if (m.probeHits !== m.probeTotal) {
            failures.push(width + 'px panel=' + withPanel + '：探针仅 ' + m.probeHits + '/' + m.probeTotal + ' 命中 → 工具条被裁剪');
          }
        }
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    stopDevServer(server.proc, { owned: server.owned });
  }

  /* 实测矩阵打印出来 —— 出问题时一眼能看出哪一档坏了 */
  console.log('  ── 底部操作栏实测（8 组）──');
  for (const r of measured) {
    console.log('    ' + String(r.width).padStart(4) + 'px  面板' + (r.withPanel ? '开' : '关') +
      '   中心偏差 ' + String(r.delta).padStart(5) + 'px   探针 ' + r.hits + '/' + r.total +
      '   跨度 [' + r.span[0] + ',' + r.span[1] + ']');
  }
  /* 必须真的测到了全部 8 组；少测 = 假绿（本仓已发生多次「本应测到却没测到」） */
  assert.equal(measured.length, WIDTHS.length * 2, '必须完成全部 ' + (WIDTHS.length * 2) + ' 组实测');
  assert.deepEqual(failures, [], '居中/不裁判据未全部满足： ' + failures.join(' | '));
});
