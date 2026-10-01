// test/canvas-popover-live-anchored-0920.test.mjs
// 画布弹层「锚在触发元素、向右展开、与源节点零相交」的**真实渲染契约**。
// ─────────────────────────────────────────────────────────────────────────────
// 为什么必须是实机测试：
//   静态断言只能守「调用了权威」，守不住**渲染结果**。本轮问题 A 的根因正是
//   「写法看着对、坐标算飞了」：clampCanvasPickerPosition 把**像素**口径的
//   bounds.width / reservedRight 除以 scale 当**世界坐标**用，而弹层渲染在
//   缩放层内（transform: matrix(0.68,...)）—— 右侧面板一开，实测
//   menu.left = 屏幕 x=10，而触发按钮在 683：面板被甩到画布最左并被裁掉半截。
//   这条只能靠真实布局回答。
// ─────────────────────────────────────────────────────────────────────────────
// 判据（用户 2026-09-20 确认，不可协商）：
//   ① 锚在触发元素上**向右展开**（弹层左缘 ≥ 触发元素右缘）；
//   ② 与**源节点矩形零相交**（用户原话：「依然是盖住了我们现在的素材」）；
//   ③ 完全落在视口内（不被裁）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startDevServer, stopDevServer, gotoHealthy, skipLive } from './helpers/live-browser.mjs';

const READY = '.ec-canvas-page';

/* 逐个弹层：打开动作 + 选择器 + 触发元素选择器 */
/* 打开动作一律用**可序列化的选择器**（page.evaluate 不能传函数）。 */
const POPOVERS = [
  {
    name: '派生/引用素材菜单',
    clickSel: '.ec-canvas-node-port:not(.is-input)',
    popSel: '.ec-canvas-derive-menu',
    triggerSel: '.ec-canvas-node-port:not(.is-input)',
  },
  {
    /* ⚠️ 2026-10-01：「图层」入口从**底部 dock**搬到**左下角缩放条**（用户批注
       「你这个图层为什么点击之后会弹到上面去呀？……你还不如把它放到左下角的那个栏里面」），
       这条门禁钉的正是入口位置，必须跟着搬 —— 否则它会安静地少测一个浮层。 */
    name: '图层面板',
    clickSel: '.ec-canvas-zoom-controls button[aria-label*="图层"]',
    popSel: '.ec-canvas-layers-panel',
    triggerSel: '.ec-canvas-zoom-controls button[aria-label*="图层"]',
  },
];

async function closeAll(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  /* 关掉可能仍开着的面板：点画布空白 */
  await page.evaluate(() => {
    const stage = document.querySelector('.ec-canvas-stage');
    if (stage) stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 9, isPrimary: true, button: 0 }));
  });
  await page.waitForTimeout(400);
}

test('实机：画布弹层锚在触发元素向右展开、与源节点零相交、且在视口内', async t => {
  const server = await startDevServer();
  if (!server.ok) { skipLive(t, '无法启动独立 dev server：' + server.reason); return; }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const failures = [];
  const measured = [];
  try {
    const health = await gotoHealthy(page, server.base + '?qa=ec-canvas', READY);
    if (!health.ok) { skipLive(t, '应用未进入健康态：' + health.reason); return; }
    await page.waitForTimeout(700);

    /* 先选中一个节点（派生菜单与右侧面板都依赖选中） */
    await page.evaluate(() => {
      const n = document.querySelector('[data-canvas-node-id]');
      if (!n) return;
      n.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0 }));
      n.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0 }));
      n.click();
    });
    await page.waitForTimeout(1100);

    for (const spec of POPOVERS) {
      await closeAll(page);
      const opened = await page.evaluate((sel) => {
        const b = document.querySelector(sel);
        if (!b) return false;
        b.click();
        return true;
      }, spec.clickSel);
      if (!opened) { failures.push(spec.name + '：找不到触发元素 ' + spec.clickSel); continue; }
      await page.waitForTimeout(1100);

      const m = await page.evaluate(({ popSel, triggerSel }) => {
        const q = s => document.querySelector(s);
        const rect = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
        const inter = (a, b) => {
          if (!a || !b) return 0;
          const w = Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l));
          const h = Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
          return Math.round(w * h);
        };
        const pop = q(popSel), trig = q(triggerSel), node = q('[data-canvas-node-id]');
        const pr = rect(pop), tr = rect(trig), nr = rect(node);
        if (!pr) return { found: false };
        return {
          found: true,
          pop: pr, trig: tr, node: nr,
          anchoredRight: tr ? pr.l >= tr.r - 1 : null,
          intersectNode: inter(pr, nr),
          inViewport: pr.l >= -1 && pr.r <= window.innerWidth + 1 && pr.t >= -1 && pr.b <= window.innerHeight + 1,
        };
      }, spec);

      if (!m.found) { failures.push(spec.name + '：弹层未出现（' + spec.popSel + '）'); continue; }
      measured.push({ name: spec.name, ...m });
      /* ① 向右展开 */
      if (m.anchoredRight === false) {
        failures.push(spec.name + '：未锚在触发元素右侧（弹层左缘 ' + Math.round(m.pop.l) + ' < 触发右缘 ' + Math.round(m.trig.r) + '）');
      }
      /* ② 与源节点零相交 */
      if (m.intersectNode > 0) {
        failures.push(spec.name + '：与源节点相交 ' + m.intersectNode + 'px²（用户投诉「盖住了素材」）');
      }
      /* ③ 在视口内 */
      if (!m.inViewport) {
        failures.push(spec.name + '：超出视口 pop=[' + Math.round(m.pop.l) + ',' + Math.round(m.pop.r) + ',' + Math.round(m.pop.t) + ',' + Math.round(m.pop.b) + ']');
      }
    }
  } finally {
    await browser.close();
    stopDevServer(server.proc, { owned: server.owned });
  }

  console.log('  ── 弹层实测 ──');
  for (const r of measured) {
    console.log('    ' + r.name.padEnd(18) +
      ' 弹层=[' + Math.round(r.pop.l) + ',' + Math.round(r.pop.r) + ']' +
      ' 触发右缘=' + (r.trig ? Math.round(r.trig.r) : 'n/a') +
      ' 与节点相交=' + r.intersectNode + 'px²' +
      ' 在视口内=' + r.inViewport);
  }
  assert.equal(measured.length, POPOVERS.length, '必须真的测到全部 ' + POPOVERS.length + ' 个弹层（少测=假绿）');
  assert.deepEqual(failures, [], '弹层锚定判据未全部满足： ' + failures.join(' | '));
});
