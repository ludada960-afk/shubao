// test/video-canvas-audio-actions-mock-0917.test.mjs
// W4 音频节点动作的**离线打桩**验收（playwright route interception）。
//
// ── 为什么打桩而不是真实后端 ────────────────────────────────────────────────
// 这些动作的失败模式**不在网络层**，而在「点击 → 走到哪个 handler → 发出什么请求体」：
//   · L347 的 setPositions 箭头函数**没闭合**，把 L350-414 吞进表达式，
//     三个 handler 被遮住 → 点击报 ReferenceError（见 video-canvas-audio-fn-scope.test.mjs）；
//   · `audio-tracks-drawer`（新）与 `audio-tracks-panel`（旧）曾**同时渲染**，
//     旧结构里的死 handler 与 live handler 同名 → 改错一份也能"看起来在跑"。
// 这两类 bug 用真实后端**照样测不出来**（请求根本没发出去）；
// 打桩反而看得更准：能对请求体逐字段断言 —— 真实后端只回 200，看不到 patch 语义。
//
// ── 本测试证明什么 / **不**证明什么（边界）──────────────────────────────────
//   ✅ 证明：点击真实 DOM → 调**正确的** handler → 发**正确方法/路径/请求体**的请求。
//   ❌ 不证明：真实后端往返可用、乐观 revision 冲突处理、服务端落库结果。
// 路由级契约由 test/video-workbench-routes.test.mjs 等覆盖。
//
// ── 覆盖范围以**实际存在的动作**为准（不是拍脑袋定的 4 个）──────────────────
// 经核对源码 + server/videoWorkbenchRoutes.mjs，画布工作台**只有 3 个**音频动作：
//   ① 加入音轨  .vcb-add-audio-track      → POST   audio-tracks
//   ② 静音切换  .vcb-audio-mute           → PATCH  audio-tracks/:id  patch.muted
//   ③ 音量调节  input[type=range]         → PATCH  audio-tracks/:id  patch.volume
// **没有"删除音轨"动作**：src 内无 deleteVideoAudioTrack，服务端也无 DELETE 路由
// （只有 POST + PATCH，见 server/videoWorkbenchRoutes.mjs:605/622）。
// 本测试**不发明**第 4 个动作；若将来加了删除，应在此文件补第 4 条并同步服务端路由。
//
// ── 与既有约定一致（不另起一套）──────────────────────────────────────────────
// 共享 test/helpers/live-browser.mjs：自起独立端口 + 健康判据重试 +
// 拿不到环境**显式 skip 带原因**（绝不静默变绿）。打桩只替换网络出站。
// 另见 test/canvas-direction-billing-chain-0917.test.mjs：打桩只允许出现在
// test/ 离线单测内，验收脚本不得打桩。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { startDevServer, stopDevServer, gotoHealthy, skipLive } from './helpers/live-browser.mjs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/* 健康判据：工作台重排版（vcb-topbar）出现即算应用健康。
   注意**不能**直接用音轨抽屉当判据 —— 它在「时间线」抽屉里，默认是关的
   （见 VideoCanvasWorkbench.jsx 的 vcb-drawer-toggle / timelineOpen 状态），
   拿它当 READY 会让健康检查永远失败。 */
const READY = '.vcb-topbar';
const QA_EMAIL = 'qa@local';

const PROJECT_ID = 'proj-mock-0917';
const TRACK_ID = 'track-mock-1';
const ASSET_ID = 'audio-asset-1';
const ASSET_VERSION_ID = 'audio-asset-1-v1';
const BASE_REVISION = 7;
/* 第二个音频资产：**故意不在 audioTracks 里**。
   「加入音轨」按钮的 disabled 条件是
     busy || audioTracks.some(t => t.assetId === node.sourceAssetId)
   （见 VideoCanvasWorkbench.jsx 该按钮的 disabled 表达式）——
   若复用已在时间线上的那个资产，按钮**正确地**是禁用的，测试就测不到点击。 */
const ADD_ASSET_ID = 'audio-asset-new';
const ADD_ASSET_VERSION_ID = 'audio-asset-new-v1';

/* ── 打桩 fixture：形状必须与客户端**读取点**一致 ─────────────────────────────
   client: createVideoAudioTrack → requireValue(response, 'track')
           updateVideoAudioTrack → requireValue(response, 'track')
   少一个 track 字段，客户端抛「视频音轨暂时不可用」→ 动作看起来失败，
   而真实原因只是 stub 形状不对 —— 这种**假红必须避免**。 */
const trackFixture = (over = {}) => ({
  id: TRACK_ID,
  kind: 'music',
  name: 'BGM',
  assetId: ASSET_ID,
  assetVersionId: ASSET_VERSION_ID,
  startMs: 0,
  durationMs: 8000,
  volume: 1,
  muted: false,
  revision: BASE_REVISION,
  ...over,
});

/* ⚠️ 工作台响应是**扁平**结构（project / assets / shots / timelineClips），
   不是 { workbench: {...} }。形状契约见 src/services/videoWorkbench.js:96-103 ——
   少了 project.id 或任一数组，客户端会抛「视频项目数据暂时不可用」，
   表现为「工作台渲染了但一个音轨都没有」的**假失败**。 */
const workbenchFixture = () => ({
  project: { id: PROJECT_ID, title: '音频动作打桩项目', revision: BASE_REVISION },
  assets: [
    {
      id: ASSET_ID,
      kind: 'music',
      name: 'BGM',
      approvedVersionId: ASSET_VERSION_ID,
      versions: [{ id: ASSET_VERSION_ID, stableUrl: '/mock/bgm.mp3', durationMs: 8000 }],
    },
    /* 未上时间线的音频资产 → 渲染出**可点**的「加入音轨」按钮 */
    {
      id: ADD_ASSET_ID,
      kind: 'music',
      name: '待加入 BGM',
      approvedVersionId: ADD_ASSET_VERSION_ID,
      versions: [{ id: ADD_ASSET_VERSION_ID, stableUrl: '/mock/bgm-2.mp3', durationMs: 12000 }],
    },
  ],
  shots: [],
  timelineClips: [],
  audioTracks: [trackFixture()],
});

/* ── 静态契约（不需要 dev server，永远强制）──────────────────────────────── */

test('三个音频 handler 都在**组件作用域**内，且都有真实 JSX 调用点', () => {
  const src = read('src/pages/VideoStudio/VideoCanvasWorkbench.jsx');
  /* 必须是 function 声明（提升到组件作用域），而不是被 setPositions 表达式吞掉的 const */
  for (const name of ['handleAddAudioTrack', 'handleToggleAudioMute', 'handleChangeAudioVolume']) {
    assert.match(src, new RegExp('^  function ' + name + '\\(', 'm'),
      name + ' 必须是组件作用域内的 function 声明');
  }
  /* 有定义没调用 = 死代码，用户点不动 */
  assert.match(src, /onClick=\{\(\) => void handleAddAudioTrack\(node\)\}/, '「加入音轨」必须有调用点');
  assert.match(src, /onClick=\{\(\) => handleToggleAudioMute\(track\)\}/, '静音必须有调用点');
  assert.match(src, /handleChangeAudioVolume\(track, Number\(event\.target\.value\)\)/, '音量必须有调用点');
});

test('只有一套音频 UI：旧的 audio-tracks-panel 已删除', () => {
  const src = read('src/pages/VideoStudio/VideoCanvasWorkbench.jsx');
  assert.ok(!src.includes('audio-tracks-panel'),
    '旧 audio-tracks-panel 结构必须已删除；两套并存会造成"改错一份也在跑"');
  assert.ok(src.includes('data-testid="audio-tracks-drawer"'), 'live 抽屉必须存在');
});

test('不存在"删除音轨"动作（本轮验收范围 = 实际存在的 3 个）', () => {
  /* 这条不是废话断言：它把「验收范围」钉在事实之上。
     若有人把删除动作加上，这里会红，提醒同步补第 4 条实机用例 + 服务端 DELETE 路由。 */
  const client = read('src/services/videoWorkbench.js');
  const routes = read('server/videoWorkbenchRoutes.mjs');
  assert.ok(!client.includes('deleteVideoAudioTrack'), '客户端尚无删除音轨 API');
  assert.ok(!/app\.delete\('\/api\/video\/projects\/:projectId\/workbench\/audio-tracks/.test(routes),
    '服务端尚无删除音轨路由');
});

/* ── 实机 + 打桩 ─────────────────────────────────────────────────────────── */

/**
 * 用 route 拦截注册出站桩，登录种子，并打开画布工作台。
 *
 * ⚠️ 两个**必须**遵守的 playwright 事实（都是本文件踩过的坑）：
 *   ① **后注册的 route 优先**（last-registered wins）。若先注册具体 route、
 *      再注册一条通配兜底，兜底会把具体 route **整个吃掉** ——
 *      表现为"打桩写了但没生效"，且不报错。故此处**兜底最先注册**。
 *   ② **登录种子必须在 origin 就绪之后**：addInitScript 在首次导航时
 *      origin 还不存在，localStorage 写入会被丢弃 → 表现为"种了没种上"。
 *      故先用一次导航落地，再 evaluate 写入，最后再进工作台 URL。
 *
 * 另一处**形状契约**：/api/session 的响应必须带 `ok:true` + `email`。
 * 少了它，src/services/auth.js 的 finalizeVerifiedSession 会走 clearSession()
 * 把登录态清掉（见 auth.js:456-461）—— 页面就永远停在未登录的引导页。
 */
async function installStubs(page, base) {
  const calls = [];
  let hits = 0;

  /* ⓪ 兜底（**必须最先注册**，见上文 ①）：把所有未显式打桩的 API 收敛成合法空壳，
      避免真实 401 把登录态清掉，也避免页面因未打桩接口报错白屏。 */
  await page.route('**/api/**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: '{}',
  }));

  /* ① 登录校验（形状见上文） */
  await page.route('**/api/session', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, email: QA_EMAIL }),
  }));

  /* ② 视频能力：工作台的挂载闸门是 capabilities.workbenchEnabled && state.logged
      （见 src/pages/VideoStudio/index.jsx:1024）。不打这个桩，工作台根本不渲染。 */
  await page.route('**/api/video/capabilities', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      loading: false,
      workbenchEnabled: true,
      workbenchMode: 'canvas',
      workbenchPlanningOnly: false,
      directorUi: false,
      models: [],
      products: [],
    }),
  }));

  /* ③ 项目列表：端点是 /api/projects（**不是** /api/video/projects），
     且行必须带 kind:'video' —— 组件会用 item?.kind === 'video' 过滤
     （见 VideoCanvasWorkbench.jsx 的 listProjects().then）。漏了 kind 就只剩空下拉框。 */
  await page.route('**/api/projects', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ projects: [{ id: PROJECT_ID, kind: 'video', title: '音频动作打桩项目', updatedAt: Date.now() }] }),
  }));

  /* ④ 工作台本体 GET */
  await page.route('**/api/video/projects/*/workbench', route => {
    hits += 1;
    if (route.request().method() !== 'GET') return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      /* 注意：workbenchFixture() 直接就是顶层响应（扁平结构），**不要**再包一层 workbench */
      body: JSON.stringify(workbenchFixture()),
    });
  });

  /* ⑤ 音轨写操作（最具体，**最后注册** → 优先级最高） */
  await page.route('**/api/video/projects/*/workbench/audio-tracks**', route => {
    hits += 1;
    const req = route.request();
    let body = null;
    try { body = req.postDataJSON(); } catch { /* 无 body 或非 JSON */ }
    calls.push({ method: req.method(), url: req.url(), body });

    const isPatch = req.method() === 'PATCH';
    return route.fulfill({
      status: req.method() === 'POST' ? 201 : 200,
      contentType: 'application/json',
      /* 回显 patch，贴近真实后端语义（客户端会 loadWorkbench 刷新） */
      body: JSON.stringify({ track: trackFixture({ ...(isPatch ? body?.patch : body) }) }),
    });
  });

  /* 登录种子：先落地 origin（见上文 ②），再写 localStorage，最后进工作台。 */
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(email => {
    localStorage.setItem('sb-auth', JSON.stringify({
      id: email, email, token: 'qa-token',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    }));
  }, QA_EMAIL);

  /* url 必须传完整 deep-link：本仓路由由 **pathname** 驱动（见 store/AppContext.jsx
     的 PATHNAME_PAGE_MAP），gotoHealthy 内部重试会 goto 该 url —— 只传 base 会退回首页。 */
  const workbenchUrl = base + 'video-studio';
  const health = await gotoHealthy(page, base, READY, { attempts: 2, perAttemptMs: 9000, url: workbenchUrl });
  if (health.ok) {
    /* 音轨抽屉**嵌在时间线抽屉里**，默认关闭 —— 必须先点开「时间线」，
       否则 .vcb-audio-* 全都不在 DOM 里，后续选择器一律找不到。
       这一步是"环境准备"，不是断言；开不出来由各自的用例显式失败。 */
    const timelineToggle = await page.$('.vcb-drawer-toggle:has-text("时间线")');
    if (timelineToggle) {
      await timelineToggle.click();
      await page.waitForSelector('[data-testid="audio-tracks-drawer"]', { timeout: 8000 }).catch(() => {});
    }
  }
  return { health, calls, hits };
}

/* 打开页面 + 打桩 + 健康检查的公共前奏；拿不到环境则 skip（绝不静默变绿）。 */
async function withPage(t, fn) {
  const server = await startDevServer();
  if (!server.ok) { skipLive(t, '无法启动独立 dev server：' + server.reason); return; }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    const ctx = await installStubs(page, server.base);
    if (!ctx.health.ok) {
      skipLive(t, '等待应用健康失败（' + ctx.health.attempts + ' 次重试耗尽）：' + ctx.health.reason
        + '（source=' + server.source + '）');
      return;
    }
    /* 打桩必须真的命中过 —— 否则下面的断言可能在对真实接口说话，那就不叫打桩验收 */
    assert.ok(ctx.hits > 0, '拦截必须至少命中一次；hits=0 说明 route 未生效，断言无意义');
    await fn(page, ctx);
  } finally {
    await browser.close();
    stopDevServer(server.proc, { owned: server.owned });
  }
}

test('实机+打桩①：点「加入音轨」→ POST audio-tracks，body 带 assetId/assetVersionId/kind', async t => {
  await withPage(t, async (page, ctx) => {
    /* 画布上会有两个音频节点；要点的那个是**尚未上时间线**的（见 ADD_ASSET_ID 注释） */
    const btns = await page.$$('.vcb-add-audio-track');
    assert.ok(btns.length > 0, '画布音频节点上必须渲染出 .vcb-add-audio-track（加入音轨）');
    let btn = null;
    for (const candidate of btns) {
      if (!(await candidate.isDisabled())) { btn = candidate; break; }
    }
    assert.ok(btn, '必须存在一个**可点**的「加入音轨」按钮（资产尚未在时间线上）');
    assert.equal(await btn.isDisabled(), false, '未 busy 时「加入音轨」必须可点');

    await btn.click();
    await page.waitForTimeout(800);

    const call = ctx.calls.find(c => c.method === 'POST');
    assert.ok(call, '点「加入音轨」必须发出 POST；实际调用：'
      + JSON.stringify(ctx.calls.map(c => c.method + ' ' + new URL(c.url).pathname)));
    assert.match(new URL(call.url).pathname, /\/workbench\/audio-tracks$/,
      'POST 必须打在 audio-tracks 资源集合上');
    assert.equal(call.body?.assetId, ADD_ASSET_ID, 'body.assetId 必须是画布节点的 sourceAssetId');
    assert.equal(call.body?.assetVersionId, ADD_ASSET_VERSION_ID, 'body.assetVersionId 必须透传');
    assert.ok(['music', 'voice'].includes(call.body?.kind),
      'body.kind 必须是 music|voice，实际=' + call.body?.kind);
    assert.equal(call.body?.muted, false, '新建音轨默认不静音');
    assert.equal(typeof call.body?.startMs, 'number', 'body.startMs 必须是数值（避免后端拼接失败）');
    assert.equal(typeof call.body?.durationMs, 'number', 'body.durationMs 必须是数值');
  });
});

test('实机+打桩②：点「静音」→ PATCH audio-tracks/:id，patch.muted 取反且带 expectedRevision', async t => {
  await withPage(t, async (page, ctx) => {
    const btn = await page.$('.vcb-audio-mute');
    assert.ok(btn, '音轨行必须渲染出 .vcb-audio-mute（静音）');
    assert.equal((await btn.textContent()).trim(), '静音', '初始未静音时按钮文案应为「静音」');

    await btn.click();
    await page.waitForTimeout(600);

    const call = ctx.calls.find(c => c.method === 'PATCH');
    assert.ok(call, '点「静音」必须发出 PATCH；实际调用：'
      + JSON.stringify(ctx.calls.map(c => c.method + ' ' + new URL(c.url).pathname)));
    assert.match(new URL(call.url).pathname, new RegExp('/workbench/audio-tracks/' + TRACK_ID + '$'),
      'PATCH 必须打在**这一条**音轨资源上（trackId 要拼进路径）');
    assert.equal(call.body?.patch?.muted, true, '初始 muted=false → patch.muted 必须取反为 true');
    assert.equal(call.body?.expectedRevision, BASE_REVISION,
      '必须带 expectedRevision（乐观并发）；缺了会让并发编辑静默覆盖');
    /* 静音不应顺手改音量 —— 职责单一，否则一次点击动两个字段 */
    assert.ok(!('volume' in (call.body?.patch || {})), '静音请求不得夹带 volume 字段');
  });
});

test('实机+打桩③：拉音量滑杆 → PATCH audio-tracks/:id，patch.volume 是滑杆值', async t => {
  await withPage(t, async (page, ctx) => {
    const slider = await page.$('.vcb-audio-meter input[type="range"]');
    assert.ok(slider, '音轨行必须渲染出音量滑杆 .vcb-audio-meter input[type=range]');
    assert.equal(await slider.getAttribute('min'), '0', '音量下限 0');
    assert.equal(await slider.getAttribute('max'), '2', '音量上限 2（与 handler 内 clamp 一致）');

    /* 用 DOM 事件触发 React onChange（fill 对 range 在部分版本不触发 change） */
    await slider.evaluate(el => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, '0.5');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(600);

    const call = ctx.calls.find(c => c.method === 'PATCH');
    assert.ok(call, '拉音量必须发出 PATCH；实际调用：'
      + JSON.stringify(ctx.calls.map(c => c.method + ' ' + new URL(c.url).pathname)));
    assert.match(new URL(call.url).pathname, new RegExp('/workbench/audio-tracks/' + TRACK_ID + '$'));
    assert.equal(call.body?.patch?.volume, 0.5, 'patch.volume 必须等于滑杆值 0.5');
    assert.equal(typeof call.body?.expectedRevision, 'number', '必须带 expectedRevision');
    assert.ok(!('muted' in (call.body?.patch || {})), '调音量请求不得夹带 muted 字段');
  });
});

test('实机+打桩④：音量**没变**时不发请求（防抖/去重语义）', async t => {
  await withPage(t, async (page, ctx) => {
    const slider = await page.$('.vcb-audio-meter input[type="range"]');
    assert.ok(slider, '音量滑杆必须存在');
    const callsBefore = ctx.calls.length;

    /* 滑杆当前 = 1（fixture volume:1），再"设成 1" → handler 内 |clamped-current|<0.001 直接 return */
    await slider.evaluate(el => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, '1');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(600);

    const patches = ctx.calls.slice(callsBefore).filter(c => c.method === 'PATCH');
    assert.equal(patches.length, 0,
      '音量未变化时**不得**发 PATCH（否则拖动过程中的噪声会打满后端）；实际发了：'
      + JSON.stringify(patches.map(c => c.body)));
  });
});