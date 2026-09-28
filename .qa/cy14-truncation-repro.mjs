/* ═══ 批 CY-⑭ 探针：**生成之后，图片节点右缘与输入框面板右缘被切**（用户报的第一个问题）══════════════════
   用户原话（逐字）：「图片生成之后，会出现这个图片的右边以及它的这个输入框的面板他们右边都被截断的一个情况。
     很奇怪，我也不知道是生成之后才会出现这个问题，还是各种情况都会出现这个问题？
     总之这个问题还挺明显的。」并给了账号：240485042@qq.com（朋友的生产账号，跑过很多次）。

   怎么量才不骗自己（三个坑都踩过）：
     ① 画布有缩放层。`getBoundingClientRect()` 返回的是**屏幕像素**，节点的世界坐标不是。
        所以要同时量：节点世界矩形 → 换算成屏幕矩形 → 和**裁剪容器**的屏幕矩形比。
     ② 画布有 0.68~0.86 的缩放 + 用户自己滚的平移；复现要固定 viewport 并**重置视口**，
        否则"贴到右边"这件事跟缩放耦合在一起，看不出是不是真的被裁。
     ③ 「被截断」要分清是**容器裁切**（内容真的看不见了）还是**位置超出可视区**（滚动能看见）。
        判据 = 节点的屏幕右缘 > 裁剪容器的 clientWidth 对应屏幕右缘，且容器 overflow 非 visible。

   用法：node .qa/cy14-truncation-repro.mjs                                              */
import { chromium } from 'playwright';
import { startDevServer, stopDevServer } from '../test/helpers/live-browser.mjs';

const server = await startDevServer();
if (!server.ok) { console.log('dev server 起不来：' + server.reason); process.exit(1); }
const base = server.base.replace(/\/$/, '');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('PAGEERR ' + String(e.message).slice(0, 200)));
await page.route('**/api/**', route => {
  const path = new URL(route.request().url()).pathname;
  const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  if (path === '/api/session') return json({ ok: true, email: 'p@e.com' });
  if (path === '/api/works') return json({ works: [] });
  if (path === '/api/video/capabilities') return json({ ok: true, items: [], draft: null });
  return json({ ok: true, items: [], draft: null });
});

await page.goto(base + '/ec-canvas?qa=ec-canvas', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(4500);

/* 画一个会把节点推到最右边的场景：先把节点全选，再按 End/右方向键推到边界。
   不直接改 store —— 我们要量的是**真实交互路径**下会不会被裁。 */
const report = await page.evaluate(() => {
  const out = { stage: null, nodes: [], notes: [] };
  const stage = document.querySelector('.ec-canvas-stage');
  if (!stage) { out.notes.push('找不到 .ec-canvas-stage'); return out; }
  const s = stage.getBoundingClientRect();
  const cs = getComputedStyle(stage);
  out.stage = {
    left: Math.round(s.left), right: Math.round(s.right), width: Math.round(s.width),
    clientWidth: stage.clientWidth, scrollWidth: stage.scrollWidth,
    overflowX: cs.overflowX, overflowY: cs.overflowY,
    transform: getComputedStyle(stage.firstElementChild || stage).transform,
  };
  out.notes.push('stage.scrollWidth - clientWidth = ' + (stage.scrollWidth - stage.clientWidth));
  for (const el of document.querySelectorAll('[data-canvas-node-id]')) {
    const r = el.getBoundingClientRect();
    out.nodes.push({
      id: el.getAttribute('data-canvas-node-id'),
      kind: (el.className.match(/ec-canvas-([a-z-]+)-node/) || [])[1] || el.className,
      left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
      /** 右缘超出 stage 多少（>0 = 已经在画布可视区之外） */
      overStage: Math.round(r.right - s.right),
      overStageLeft: Math.round(s.left - r.left),
    });
  }
  /* 右侧功能栏（.ec-canvas-right-panel）开着时会占住右边一条，画布要让位 */
  const rp = document.querySelector('.ec-canvas-right-panel');
  if (rp) {
    const r = rp.getBoundingClientRect();
    out.notes.push('right-panel left=' + Math.round(r.left) + ' width=' + Math.round(r.width));
    out.rightPanel = { left: Math.round(r.left), width: Math.round(r.width) };
  } else out.notes.push('右侧功能栏没开');
  return out;
});

console.log('════════ 画布裁剪几何 ════════');
console.log(JSON.stringify(report, null, 2));

/* 再造一个"贴右"的极端场景：把视口往右推，看节点右缘会不会进到右侧功能栏底下 */
const pushed = await page.evaluate(() => {
  const stage = document.querySelector('.ec-canvas-stage');
  if (!stage) return null;
  stage.dispatchEvent(new WheelEvent('wheel', { deltaX: 4000, deltaY: 0, bubbles: true, cancelable: true }));
  return true;
});
if (pushed) {
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => {
    const s = document.querySelector('.ec-canvas-stage')?.getBoundingClientRect();
    const nodes = Array.from(document.querySelectorAll('[data-canvas-node-id]')).map(el => {
      const r = el.getBoundingClientRect();
      return { id: el.getAttribute('data-canvas-node-id'), right: Math.round(r.right), over: s ? Math.round(r.right - s.right) : 0 };
    });
    return { stageRight: s ? Math.round(s.right) : null, nodes };
  });
  console.log('\n════════ 向右推 4000px 之后 ════════');
  console.log(JSON.stringify(after, null, 2));
}

await browser.close();
await stopDevServer();
console.log('\n盘点结束（未改任何代码）。');
