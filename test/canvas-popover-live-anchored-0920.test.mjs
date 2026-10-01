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

/* 逐个弹层：打开动作 + 选择器 + 触发元素选择器 + **各自的判据** */
/* 打开动作一律用**可序列化的选择器**（page.evaluate 不能传函数）。

   ⚠️ 2026-10-01：判据**不再是全员同一条**。
   原来两个弹层共用「必须锚在触发元素右侧展开」这一条 —— 那条对派生菜单是对的
   （它是 portal 到 body、锚在节点端口上），但对图层面板**已经不成立**了：

   用户 2026-10-01 原话：「它整体应该是**吸附在图层这个按钮上面**的，而不是悬空的。
     ……你看一下下面不是有一个**水印面板**吗？他是比较靠左一些的，
     你要照他那样子往左边靠一些，然后**只要不遮住那个加号和生成进度那两个按钮就行了**。」

   ⇒ 图层面板改成「停靠左下」判据，并且**把用户那句约束变成可执行的断言**：
     ① 左缘与水印面板同源（left:60）；② 底边贴在缩放条那一行之上（吸附在按钮上面，不是悬空）；
     ③ **不许遮住左侧那颗「加号」**；④ 仍不许与源节点相交；⑤ 仍在视口内。

   把两个弹层判据混成一条，结果就是「改对了红的、改错了也红」——
   与 `canvas-popover-anchor-authority-0920` ⑥ 是同一个病，已在那边一并反转。 */
const POPOVERS = [
  {
    name: '派生/引用素材菜单',
    clickSel: '.ec-canvas-node-port:not(.is-input)',
    popSel: '.ec-canvas-derive-menu',
    triggerSel: '.ec-canvas-node-port:not(.is-input)',
    mode: 'anchor-right',
  },
  {
    /* ⚠️ 2026-10-01：「图层」入口从**底部 dock**搬到**左下角缩放条**（用户批注
       「你这个图层为什么点击之后会弹到上面去呀？……你还不如把它放到左下角的那个栏里面」），
       这条门禁钉的正是入口位置，必须跟着搬 —— 否则它会安静地少测一个浮层。 */
    name: '图层面板',
    clickSel: '.ec-canvas-zoom-controls button[aria-label*="图层"]',
    popSel: '.ec-canvas-layers-panel',
    triggerSel: '.ec-canvas-zoom-controls button[aria-label*="图层"]',
    mode: 'dock-bottom-left',
    /* 与水印面板 `.ec-wm-panel` 同一个 left（EcCanvas.css 里写死的那个数） */
    dockLeft: 60,
    /* 用户原话：「只要不遮住那个加号和生成进度那两个按钮就行了」 */
    mustNotCover: ['.ec-canvas-rail-add'],
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

      const m = await page.evaluate(({ popSel, triggerSel, mode, dockLeft, mustNotCover }) => {
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

        const out = {
          found: true,
          pop: pr, trig: tr, node: nr,
          intersectNode: inter(pr, nr),
          inViewport: pr.l >= -1 && pr.r <= window.innerWidth + 1 && pr.t >= -1 && pr.b <= window.innerHeight + 1,
        };

        if (mode === 'anchor-right') {
          out.anchoredRight = tr ? pr.l >= tr.r - 1 : null;
        } else {
          /* 停靠左下：① 左缘与水印面板同源；② 底边贴在缩放条那一行**之上**（吸附，不是悬空） */
          out.dockLeftDelta = dockLeft == null ? null : Math.round(pr.l - dockLeft);
          const zoomRow = rect(q('.ec-canvas-zoom-controls'));
          out.aboveZoomRow = zoomRow ? pr.b <= zoomRow.t + 1 : null;
          out.zoomRowBottom = zoomRow ? Math.round(zoomRow.b) : null;
          out.covered = (mustNotCover || []).map(sel => ({ sel, area: inter(pr, rect(q(sel))) }))
            .filter(x => x.area > 0);
        }
        return out;
      }, spec);

      if (!m.found) { failures.push(spec.name + '：弹层未出现（' + spec.popSel + '）'); continue; }
      measured.push({ name: spec.name, ...m });

      if (spec.mode === 'anchor-right') {
        /* ① 向右展开 */
        if (m.anchoredRight === false) {
          failures.push(spec.name + '：未锚在触发元素右侧（弹层左缘 ' + Math.round(m.pop.l) + ' < 触发右缘 ' + Math.round(m.trig.r) + '）');
        }
      } else {
        /* ① 左缘与水印面板同源（用户：「照他那样子往左边靠一些」） */
        if (m.dockLeftDelta !== 0) {
          failures.push(spec.name + '：左缘 ' + Math.round(m.pop.l) + ' 与水印面板的 ' + spec.dockLeft + ' 差 ' + m.dockLeftDelta + 'px');
        }
        /* ② 吸附在缩放条之上，不是悬空（用户：「整体应该是吸附在图层这个按钮上面的，而不是悬空的」） */
        if (m.aboveZoomRow === false) {
          failures.push(spec.name + '：底边 ' + Math.round(m.pop.b) + ' 没有停在缩放条顶边之上（缩放条顶 ' + (m.zoomRowBottom == null ? '?' : m.zoomRowBottom) + '）—— 那是「悬空」');
        }
        /* ③ 不许遮住用户点名的那几颗按钮 */
        for (const c of m.covered) {
          failures.push(spec.name + '：遮住了 ' + c.sel + '（相交 ' + c.area + 'px²，用户原话「只要不遮住那个加号…就行了」）');
        }
      }
      /* 与源节点零相交（两个弹层都适用，用户原话「盖住了我们现在的素材」） */
      if (m.intersectNode > 0) {
        failures.push(spec.name + '：与源节点相交 ' + m.intersectNode + 'px²（用户投诉「盖住了素材」）');
      }
      /* 在视口内 */
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
      ' 在视口内=' + r.inViewport +
      (r.dockLeftDelta === undefined ? ''
        : ' | 停靠左缘差=' + r.dockLeftDelta + ' 底边不越过缩放条=' + r.aboveZoomRow +
          ' 遮住=' + (r.covered.length ? r.covered.map(c => c.sel + ':' + c.area).join(',') : '无')));
  }
  assert.equal(measured.length, POPOVERS.length, '必须真的测到全部 ' + POPOVERS.length + ' 个弹层（少测=假绿）');
  assert.deepEqual(failures, [], '弹层锚定判据未全部满足： ' + failures.join(' | '));
});
