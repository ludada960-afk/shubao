// test/canvas-live-p0-0929.test.mjs
// 2026-09-29 批 CY-⑱。用户在生产上跑图时当场报的两个问题（朋友账号 240485042@qq.com）：
//   ① 「Idempotency conflict for key: canvas-hold:canvas-5551b7fc」
//      —— 多个不同节点各报一次、频率很高，生成节点上直接写着这句英文。
//   ② 「画布的真实显示区域也特别的小，基本上其他地方都会被遮挡，不知道是什么原因造成的。」
//
// 两条都是**生产 P0**，判据要钉死"为什么"，不是钉死"改成了什么"：
//   ① 的成因是**指纹**里混进了每次都会变的字段（quoteId / expiresAt），
//      而幂等键是**稳定键** ⇒ 键相同、指纹必然不同 ⇒ 每次都判成"同键不同请求"。
//   ② 的成因是让位量**固定** 476px、不看视口 ⇒ 窄屏下画布被压到比面板还窄。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  canvasRightPanelReserved,
  canvasPanelWidth,
  CANVAS_RIGHT_PANEL_MARGIN_PX,
  CANVAS_RIGHT_PANEL_MAX_VIEWPORT_RATIO,
} from '../src/pages/EcCanvas/canvasVisualLanguage.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const code = p => strip(read(p));

/* ═══ ① 幂等冲突 ═════════════════════════════════════════════════════════════════════ */

test('hold 的身份指纹**原样包含报价与有效期**（这条守卫是对的，别放松它）', () => {
  /* ⚠️ 这一条是本批的**一次自我否决**，写进门禁免得下一个人再犯：
     线上 P0 报 `Idempotency conflict for key: canvas-hold:…`，我第一反应是
     「指纹里混进了每次都变的 quoteId / expiresAt，踢出去就修好了」——
     改完 **27 条计费门禁立刻红了**，其中 test/billing-wallet.test.mjs:196 白纸黑字：
       assert.throws(() => service.createHold({ ...holdInput, quoteId: 'different-quote' }),
                      /idempotency.*conflict/i);
     **那条守卫是有意的、也是对的**：同一个键配一个**不同的报价**就不可能是同一次扣费请求 ——
     拿旧报价的 hold 去结算一笔按新报价干的活，会少收或多收。
     ⇒ 指纹必须**保持原样**。真正要修的是**调用方**：画布那条幂等键没跟着内容走。 */
  const src = read('server/billing/walletService.mjs');
  const at = src.indexOf('function normalizeHoldInput');
  assert.ok(at > 0, '找得到 normalizeHoldInput');
  const body = src.slice(at, src.indexOf('\n}', at));
  const operationInput = body.slice(body.indexOf('const operationInput'), body.indexOf('};', body.indexOf('const operationInput')));
  for (const field of ['ownerEmail', 'currency', 'quoteId', 'idempotencyKey', 'expiresAt', 'items', 'metadata']) {
    assert.ok(operationInput.includes(field), '身份指纹必须含 ' + field);
  }
  assert.match(body, /fingerprint: fingerprint\(operationInput\)/,
    '指纹必须仍从完整 operationInput 算 —— 把 quoteId 踢出去会让 27 条计费门禁变红');
  /* 而调用方必须把内容编进键（这才是真正的修法） */
  const canvas = code('src/pages/EcCanvas/index.jsx');
  assert.ok(/requestKey: \[/.test(canvas) || /requestKey: \[/.test(canvas),
    '画布侧必须有一个把内容编进键的 requestKey');
  assert.match(canvas, /generationRunId,\s*\n\s*index \+ 1,\s*\n\s*prompt,/,
    '键里必须同时含 runId / 位次 / 提示词（改了提示词 ⇒ 键变 ⇒ 当作另一次生成、正常计费）');
  assert.match(canvas, /ratio \|\| '',\s*\n\s*resolution,\s*\n\s*imageModel,/,
    '比例 / 清晰度 / 模型也必须进键（它们同样改变报价）');
  assert.match(canvas, /sourceUrl,\s*\n\s*referenceImages\.join\(','\),/,
    '来源图与参考图也必须进键（换素材 = 另一次生成）');
});

test('这个错误说的是人话（它会原样显示在节点上、右下角还会弹一条 toast）', () => {
  const src = read('server/billing/walletService.mjs');
  const at = src.indexOf('function idempotencyConflict');
  const body = src.slice(at, src.indexOf('\n}', at));
  assert.ok(/这次扣费|请稍后/.test(body), '必须先说人话（用户看到的就是这句话）');
  assert.ok(/idempotency conflict/i.test(body), '保留英文技术标记：日志要能搜、既有门禁也按它认');
  assert.ok(body.includes('BILLING_IDEMPOTENCY_CONFLICT'), 'code 必须保留（调用方按它分流）');
});

/* ═══ ② 画布可视区 ════════════════════════════════════════════════════════════════════ */

test('右栏让位在 CSS 侧**封顶在视口的 38%**（窄屏下画布必须仍是主体）', () => {
  /* 封顶放在 CSS 而不是 JS：离真实渲染最近，也不会和 JS 里的第二个数字打架。
     （第一版改成"JS 注入一个变量"，结果宽屏反而少了 32px —— 运行时面板渲染宽 448、
       而纯函数按 480 算；那是既有的一处口径不齐，不该由这一批顺手改掉。）
     判据钉在**真正生效的那条 CSS** 上。 */
  const css = read('src/pages/EcCanvas/EcCanvas.css');
  const rule = css.match(/\.ec-canvas-stage\.has-right-panel \{[\s\S]*?\}/);
  assert.ok(rule, '找得到 .has-right-panel 的让位规则');
  assert.match(rule[0], /min\(/, '让位必须被 min 封顶（否则窄屏上画布被压没）');
  assert.match(rule[0], /38vw/, '封顶是视口的 38%');
  assert.match(rule[0], /var\(--canvas-right-panel-width/, '封顶的**另一侧**仍是完整让位（宽屏口径不变）');
  assert.ok(!/--canvas-right-panel-reserved/.test(css),
    '不要引入第二个让位数字（JS 注入版会让宽屏少 32px，见上面的说明）');
  assert.ok(!/--canvas-right-panel-reserved/.test(code('src/pages/EcCanvas/index.jsx')),
    'JS 侧也不要注入那个变量');
});

test('纯函数那层仍然自洽（它被浮层避让用着，不是让位）', () => {
  /* canvasRightPanelReserved 仍然被 index.jsx 用于**派生浮层避让**，那一路要的是视口量级。
     它的两个形参语义不同（第一参视口宽、第二参面板宽），这里钉住"两者都不为负、封顶生效"。 */
  assert.ok(CANVAS_RIGHT_PANEL_MAX_VIEWPORT_RATIO <= 0.4, '封顶比例不能超过 40%');
  for (const vw of [1920, 1440, 1280, 1000, 900, 800]) {
    const reserved = canvasRightPanelReserved(vw);
    assert.ok(reserved > 0, `视口 ${vw}：让位量必须为正`);
    assert.ok(reserved <= Math.max(canvasPanelWidth(vw) + CANVAS_RIGHT_PANEL_MARGIN_PX, Math.round(vw * CANVAS_RIGHT_PANEL_MAX_VIEWPORT_RATIO)),
      `视口 ${vw}：让位 ${reserved}px 不该超过「完整让位」与「38% 视口」两者中的较小者`);
  }
  /* 显式传面板宽时，让位必须以**它**为准（不再自己按视口推一次，那会漂 32px） */
  const a = canvasRightPanelReserved(1920, 448);
  assert.equal(a, 448 + CANVAS_RIGHT_PANEL_MARGIN_PX, '显式给面板宽时，让位 = 该宽 + 边距');
});
