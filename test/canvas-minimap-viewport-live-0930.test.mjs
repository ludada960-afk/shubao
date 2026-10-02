// test/canvas-minimap-viewport-live-0930.test.mjs
// 小地图「视窗框」= 用户当前**真正看得见**的那一块画布（批 CY-㊴ / 用户 2026-09-30 图4-②）
// ─────────────────────────────────────────────────────────────────────────────
// 为什么必须是实机测试（静态断言守不住这个判据）：
//   这个 bug 的两个缺陷**都不在源码里**，只有真实布局能回答：
//     ① `clientWidth − marginRight` 的双重扣减 —— 要看 flex 到底把 border box 排成多宽；
//     ② 在 render 期间读 DOM 量到**上一次提交**的布局 —— 要看提交前后两帧的差。
//   实测（1600×1000、右栏开，stage 真宽 1124、margin-right 476、小地图画布 178）：
//     修复前：面板开 → 框宽 65.44px（=按 1600 算，真值应 45.97）
//             面板关 → 框宽 26.50px（=按  648 算，真值应 65.44）
//     修复后：面板开 → 45.97 ／ 面板关 → 65.44，与 stage 比例 1124/1600 完全一致（误差 0.00%）
//
// 两条判据（缺一不可）：
//   ① **比例不变量**：视窗框宽(开)/视窗框宽(关)  ===  stage 可见宽(开)/stage 可见宽(关)。
//      这条与 worldBounds、画布缩放、小地图尺寸全部无关（它们在两次测量之间不变，会约掉），
//      所以它只可能因为"喂进去的数不对"而红 —— 正好是本 bug 的判据。
//   ② **看得见的节点必须落在框内**（用户逐字：「当前我们用户能够看到的所有内容，
//      它都应该成为这个视窗」）。这条把"框画窄了"直接翻译成用户能看见的症状。
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { startDevServer, stopDevServer, gotoHealthy, skipLive } from './helpers/live-browser.mjs';

const READY = '.ec-canvas-page';
const WIDTH = 1600;
const HEIGHT = 1000;
/* 比例判据容差：3%。实测修复前 42.35%、修复后 0.00%，离阈值很远，不会 flaky。 */
const RATIO_TOLERANCE = 0.03;
/* 框内判定容差（小地图坐标系 1px ≈ 53 个屏幕 px，1.0 已经很松，只为吸收 sub-pixel 舍入） */
const BOX_TOLERANCE_PX = 1;

/* 本机常有多条会话并行跑 dev server，而 `startDevServer` 会**优先复用 5173**。
   那 5173 未必是本工作树的 —— 拿别人分支的代码量出来的数字是没有意义的。
   源文件里埋了一个签名；取不到签名就自己起一个端口，宁可慢也不量错树。 */
async function sharedServesThisWorktree(base) {
  try {
    const res = await fetch(new URL('/src/pages/EcCanvas/canvasVisibleViewport.js', base), { cache: 'no-store' });
    if (!res.ok) return false;
    return (await res.text()).includes('shubao-canvas-visible-viewport-sig-v2');
  } catch {
    return false;
  }
}

async function measure(page) {
  /* page.evaluate 不能闭包引用 Node 侧变量，容差必须传进去 */
  return page.evaluate((tol) => {
    const stage = document.querySelector('.ec-canvas-stage');
    const box = document.querySelector('.ec-canvas-minimap-viewport');
    const map = document.querySelector('.ec-canvas-minimap-canvas');
    if (!stage) return { ok: false, reason: 'stage 不存在' };
    if (!box) return { ok: false, reason: '小地图视窗框不存在（小地图没开？）' };
    if (!map) return { ok: false, reason: '小地图画布不存在' };
    const sr = stage.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    const mr = map.getBoundingClientRect();
    const cs = getComputedStyle(stage);
    /* 画布上每个节点的屏幕矩形 —— 用来判断"哪些是用户看得见的"。
       ⚠️ 同一个 id 在画布上不止一个元素（节点卡 / 工具条 / 最外层定位盒都带这个属性），
       量错元素就会得出假结论（本轮第一版就栽在这）。取**同一 id 下最外层**的那个：
       它才是那个按 node.x/node.y 绝对定位的节点盒，中心即世界中心。 */
    const byId = new Map();
    for (const n of document.querySelectorAll('[data-canvas-node-id]')) {
      if (n.closest('.ec-canvas-minimap')) continue;
      const id = n.getAttribute('data-canvas-node-id');
      if (!id || n.parentElement?.closest('[data-canvas-node-id]')) continue;
      const r = n.getBoundingClientRect();
      if (!(r.width > 0 && r.height > 0)) continue;
      byId.set(id, r);
    }
    const nodes = [...byId.entries()].map(([id, r]) => ({
      id, cx: r.left + r.width / 2, cy: r.top + r.height / 2,
      left: r.left, right: r.right, top: r.top, bottom: r.bottom,
    }));
    /* 小地图里每个节点的标记矩形（靠同一个 id 配对，不靠顺序猜） */
    const marks = {};
    for (const m of document.querySelectorAll('.ec-canvas-minimap-node[data-canvas-node-id]')) {
      const r = m.getBoundingClientRect();
      marks[m.getAttribute('data-canvas-node-id')] = { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    }
    /* 「看得见」= 节点**中心**落在画布可视区内。
       不用"矩形相交"：贴在画布底边只探进来 13px、中心还在画布外的那个节点，
       会被算成看得见，而它在小地图里的标记本来就该画在框外 —— 那是诚实的，不是 bug。
       （实测踩过：output-asset_sku-01_3 屏幕矩形 t=987/b=1154，stage 底边只有 1000。） */
    const visible = nodes.filter(n => n.cx > sr.left && n.cx < sr.right && n.cy > sr.top && n.cy < sr.bottom);
    /* 批 CY-㊴ 第二版：视窗框是**一个盒子**，宽度 = 看得见的 + 被右侧面板遮住的。
       被遮住那一段的宽度由 CSS 变量 --covered-w 给出（同一层背景的斜纹），
       所以"看得见的那部分" = 总宽 − covered-w。 */
    const coveredW = parseFloat(getComputedStyle(box).getPropertyValue('--covered-w')) || 0;
    return {
      ok: true,
      panelOpen: stage.classList.contains('has-right-panel'),
      stageW: sr.width,
      marginRight: parseFloat(cs.marginRight) || 0,
      boxW: br.width,
      coveredW,
      visibleBoxW: br.width - coveredW,
      box: { left: br.left, right: br.right, top: br.top, bottom: br.bottom },
      map: { left: mr.left, right: mr.right },
      marks,
      visibleCount: visible.length,
      totalNodes: nodes.length,
      outsideBox: visible
        .filter(n => marks[n.id])
        .filter(n => marks[n.id].cx < br.left + tol || marks[n.id].cx > br.right - tol
          || marks[n.id].cy < br.top + tol || marks[n.id].cy > br.bottom - tol)
        .map(n => ({ id: n.id, mark: marks[n.id], box: { left: br.left, right: br.right, top: br.top, bottom: br.bottom } })),
      unmapped: visible.filter(n => !marks[n.id]).map(n => n.id),
    };
  }, BOX_TOLERANCE_PX);
}

async function selectFirstNode(page) {
  await page.evaluate(() => {
    const n = document.querySelector('.ec-canvas-stage [data-canvas-node-id]');
    if (!n) return;
    n.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0 }));
    n.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, button: 0 }));
    n.click();
  });
  /* 右栏是 CSS transition（220ms）推开的，且小地图尺寸靠 ResizeObserver 跟进 —— 等它落定 */
  await page.waitForTimeout(1400);
}

test('实机：视窗框宽度与画布可见宽同比例，且**看得见的每个节点都落在框内**（面板开/合两态）', async t => {
  const shared = 'http://127.0.0.1:5173/';
  if (!(await sharedServesThisWorktree(shared))) process.env.SB_LIVE_NO_SHARED = '1';
  const server = await startDevServer();
  if (!server.ok) { skipLive(t, '无法启动独立 dev server：' + server.reason); return; }

  const browser = await chromium.launch();
  const failures = [];
  const measured = [];
  let closed = null;
  let opened = null;
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });
    const health = await gotoHealthy(page, server.base + '?qa=ec-canvas', READY);
    if (!health.ok) { skipLive(t, '应用未进入健康态：' + health.reason); return; }
    await page.waitForTimeout(900);

    closed = await measure(page);
    if (!closed.ok) failures.push('面板关：' + closed.reason);
    else {
      if (closed.panelOpen) failures.push('面板关态却量到 has-right-panel');
      if (closed.visibleCount < 1) failures.push('面板关态没有任何"看得见的节点" ⇒ 判据②空转');
      if (closed.box.right > closed.map.right + 0.5) failures.push('面板关态框超出小地图画布右缘（被 clamp，比例判据不可用）');
      measured.push({ state: '面板关', stageW: closed.stageW, boxW: closed.boxW, visibleBoxW: closed.visibleBoxW, coveredW: closed.coveredW, visible: closed.visibleCount, outside: closed.outsideBox.length });
    }

    await selectFirstNode(page);
    opened = await measure(page);
    if (!opened.ok) failures.push('面板开：' + opened.reason);
    else {
      if (!opened.panelOpen) failures.push('点了节点但右侧面板没打开（这一步没量到目标状态）');
      if (opened.marginRight <= 0) failures.push('面板开态 margin-right 为 0 —— 让位没生效，这条测的不是目标场景');
      if (opened.visibleCount < 1) failures.push('面板开态没有任何"看得见的节点" ⇒ 判据②空转');
      if (opened.unmapped.length) failures.push('有 ' + opened.unmapped.length + ' 个可见节点在小地图里找不到对应标记');
      if (opened.box.right > opened.map.right + 0.5) failures.push('面板开态框超出小地图画布右缘（被 clamp，比例判据不可用）');
      measured.push({ state: '面板开', stageW: opened.stageW, boxW: opened.boxW, visibleBoxW: opened.visibleBoxW, coveredW: opened.coveredW, visible: opened.visibleCount, outside: opened.outsideBox.length });
    }

    /* ① 两条不变量（批 CY-㊴ 第二版：框是**一个盒子**）
       ①-A 总宽恒定：看得见的 + 被遮住的 = 画布的**完整**宽度，
             面板开关都不该改变它（实测两态都是 65.44）。
       ①-B 看得见的那一段随面板变：visibleBoxW ∝ stageW。 */
    if (closed?.ok && opened?.ok) {
      /* ①-A */
      const totalRel = Math.abs(opened.boxW - closed.boxW) / closed.boxW;
      if (!(totalRel <= RATIO_TOLERANCE)) {
        failures.push('视窗框**总宽**在两态下不等：关 ' + closed.boxW.toFixed(2)
          + ' vs 开 ' + opened.boxW.toFixed(2) + '，相对差 ' + (totalRel * 100).toFixed(2) + '%'
          + '（总宽应恒为画布完整宽度）');
      }
      /* ①-B */
      const boxRatio = opened.visibleBoxW / closed.visibleBoxW;
      const stageRatio = opened.stageW / closed.stageW;
      const rel = Math.abs(boxRatio - stageRatio) / stageRatio;
      if (!(rel <= RATIO_TOLERANCE)) {
        failures.push('视窗框「看得见的那段」 开/关 = ' + boxRatio.toFixed(4)
          + '，而画布可见宽 开/关 = ' + stageRatio.toFixed(4)
          + '，相对差 ' + (rel * 100).toFixed(2) + '% > ' + (RATIO_TOLERANCE * 100) + '%');
      }
      /* 面板开着时，被遮住的那段必须**真的画出来了**（--covered-w ≈ 0 说明没画） */
      if (opened.coveredW < 1) {
        failures.push('面板开着，但被遮住的那一段宽度 = ' + opened.coveredW.toFixed(2)
          + '（应为 margin-right = ' + opened.marginRight + ' 折算后的值）——'
          + '「画布右边被面板盖住」在小地图里就看不见，正是用户连着三次反馈的那件事');
      }
    }
    /* ② 看得见的节点都落在「看得见的那段」内 */
    for (const m of [closed, opened]) {
      if (!m?.ok) continue;
      for (const o of m.outsideBox) {
        failures.push((m.panelOpen ? '面板开' : '面板关') + '：节点 ' + o.id
          + ' 的中心在画布可视区内，但它在小地图里的中心落在可见段之外（标记中心 x=' + o.mark.cx.toFixed(2)
          + ' y=' + o.mark.cy.toFixed(2) + '，框 = [' + o.box.left.toFixed(2) + ',' + o.box.right.toFixed(2)
          + ']×[' + o.box.top.toFixed(2) + ',' + o.box.bottom.toFixed(2) + ']）');
      }
    }

    console.log('  ── 视窗框实测（' + WIDTH + '×' + HEIGHT + '）──');
    for (const r of measured) {
      console.log('    ' + r.state + '  画布可见宽=' + r.stageW.toFixed(1).padStart(7)
        + '  框总宽=' + r.boxW.toFixed(2).padStart(6)
        + '  其中看得见=' + r.visibleBoxW.toFixed(2).padStart(6)
        + '  被遮住=' + r.coveredW.toFixed(2).padStart(5)
        + '  看得见的节点=' + r.visible
        + '  落在框外的=' + r.outside);
    }
    if (closed?.ok && opened?.ok) {
      console.log('    框宽 开/关 = ' + (opened.boxW / closed.boxW).toFixed(4)
        + '   画布可见宽 开/关 = ' + (opened.stageW / closed.stageW).toFixed(4));
    }
    /* 必须真的测到了两态；少测 = 假绿（本仓已发生多次「本应测到却没测到」） */
    assert.equal(measured.length, 2, '必须完成面板开/合两组实测');
    assert.deepEqual(failures, [], '视窗框判据未满足：\n    - ' + failures.join('\n    - '));
  } finally {
    await browser.close();
    stopDevServer(server.proc, { owned: server.owned });
  }
});
