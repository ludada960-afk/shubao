// test/twin-matrix.test.mjs
// 4c183cd4 续命 P-F 孪生体 2.0 矩阵 + 中文 AI 合规 + 数据回流画布
// 覆盖: TWIN_CAPABILITIES 5 cap / TWIN_CHANNELS 3 channel / evaluateChineseAiCompliance 3 法律
//       executeTwin 5 cap × 3 channel 路由 / costBasis 集成 / mountTwinMatrixRoutes 6 路由 (含 3 处真实现)
//       recordFeedbackEvent 6 kind / aggregateFeedback 3 视图 / mountCanvasFeedbackRoutes 3 路由
// 跟 ttsBridge (9c5d01d5) / visionBridge (4c285eca) / chainService (b015edb8) / costBasis (1d6d17fa) 集成
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import {
  TWIN_CAPABILITIES,
  TWIN_CHANNELS,
  listTwinCapabilities,
  listTwinChannels,
  buildTwinMatrixHealth,
  executeTwin,
  mountTwinMatrixRoutes,
} from '../server/services/twinMatrix.mjs';
import {
  CHINESE_AI_COMPLIANCE_LEGALS,
  evaluateChineseAiCompliance,
  summarizeChineseAiCompliance,
} from '../server/components/aiCompliance.mjs';
import {
  recordFeedbackEvent,
  getRecentFeedbackEvents,
  aggregateFeedback,
  summarizeFeedback,
  clearFeedbackRing,
  mountCanvasFeedbackRoutes,
} from '../server/extensions/canvasFeedback.mjs';

const FULL_COMPLIANCE = Object.freeze({
  generative_ai_interim: true,
  deep_synthesis: true,
  content_labeling: true,
});

// ════════════════════════════════════════════════════
// 区块 1: 中文 AI 合规水印 (薯包独门 2/3) — 3 强制法律勾选
// ════════════════════════════════════════════════════

test('CHINESE_AI_COMPLIANCE_LEGALS 3 强制法律 (生成式 AI / 深度合成 / 标识办法)', () => {
  assert.equal(CHINESE_AI_COMPLIANCE_LEGALS.length, 3);
  const keys = CHINESE_AI_COMPLIANCE_LEGALS.map(l => l.key);
  assert.deepEqual(keys, ['generative_ai_interim', 'deep_synthesis', 'content_labeling']);
  assert.ok(CHINESE_AI_COMPLIANCE_LEGALS[0].fullName.includes('生成式人工智能'));
  assert.ok(CHINESE_AI_COMPLIANCE_LEGALS[1].fullName.includes('深度合成'));
  assert.ok(CHINESE_AI_COMPLIANCE_LEGALS[2].fullName.includes('生成合成内容标识'));
  for (const l of CHINESE_AI_COMPLIANCE_LEGALS) {
    assert.ok(l.authority && l.authority.length > 0, l.key + ' 必须有 authority');
    assert.ok(l.effectiveDate && l.effectiveDate.length > 0, l.key + ' 必须有 effectiveDate');
    assert.ok(l.summary && l.summary.length > 0, l.key + ' 必须有 summary');
  }
});

test('evaluateChineseAiCompliance 全勾 = passed', () => {
  const r = evaluateChineseAiCompliance(FULL_COMPLIANCE);
  assert.equal(r.passed, true);
  assert.deepEqual(r.missing, []);
  assert.equal(r.evaluated.generative_ai_interim.passed, true);
  assert.equal(r.evaluated.deep_synthesis.passed, true);
  assert.equal(r.evaluated.content_labeling.passed, true);
});

test('evaluateChineseAiCompliance 缺 1 = 列出 missing', () => {
  const r = evaluateChineseAiCompliance({
    generative_ai_interim: true,
    deep_synthesis: true,
    content_labeling: false,
  });
  assert.equal(r.passed, false);
  assert.deepEqual(r.missing, ['content_labeling']);
});

test('evaluateChineseAiCompliance 全空 = 3 missing', () => {
  const r = evaluateChineseAiCompliance({});
  assert.equal(r.passed, false);
  assert.equal(r.missing.length, 3);
});

test('evaluateChineseAiCompliance null 入参 = 3 missing', () => {
  const r = evaluateChineseAiCompliance(null);
  assert.equal(r.passed, false);
  assert.equal(r.missing.length, 3);
});

test('summarizeChineseAiCompliance 给前端的 3 法律摘要 + 强制勾选', () => {
  const s = summarizeChineseAiCompliance();
  assert.equal(s.legals.length, 3);
  for (const l of s.legals) {
    assert.equal(l.required, true);
    assert.ok(l.label && l.label.length > 0, l.key + ' 必须有 label');
  }
  assert.ok(s.note.includes('3 强制法律'));
  assert.equal(s.version, 1);
});

// ════════════════════════════════════════════════════
// 区块 2: 孪生体矩阵 — 5 capability × 3 channel
// ════════════════════════════════════════════════════

test('TWIN_CAPABILITIES 5 cap 全部到位 (TTS / Vision / Chain / MultiModal / Composition)', () => {
  assert.equal(TWIN_CAPABILITIES.length, 5);
  const keys = TWIN_CAPABILITIES.map(c => c.key);
  assert.deepEqual(keys, ['tts', 'vision', 'chain', 'multi_modal', 'composition']);
  for (const c of TWIN_CAPABILITIES) {
    assert.ok(c.label && c.label.length > 0, c.key + ' 必须有 label');
    assert.ok(c.description && c.description.length > 0, c.key + ' 必须有 description');
  }
});

test('TWIN_CHANNELS 3 入口真实现 (Web / 小program / API)', () => {
  assert.equal(TWIN_CHANNELS.length, 3);
  const keys = TWIN_CHANNELS.map(c => c.key);
  assert.deepEqual(keys, ['web', 'miniprogram', 'api']);
  // miniprogram 同步入口 syncOnly=true
  const mp = TWIN_CHANNELS.find(c => c.key === 'miniprogram');
  assert.equal(mp.syncOnly, true);
  // api fullAudit=true
  const api = TWIN_CHANNELS.find(c => c.key === 'api');
  assert.equal(api.fullAudit, true);
  // web syncOnly=false fullAudit=false
  const web = TWIN_CHANNELS.find(c => c.key === 'web');
  assert.equal(web.syncOnly, false);
  assert.equal(web.fullAudit, false);
});

test('listTwinCapabilities 把 provider 列表 (TTS + Vision) 拼好', () => {
  const caps = listTwinCapabilities();
  assert.equal(caps.length, 5);
  const ttsCap = caps.find(c => c.key === 'tts');
  assert.ok(Array.isArray(ttsCap.providers) && ttsCap.providers.length >= 1, 'tts 必须列 provider');
  const visionCap = caps.find(c => c.key === 'vision');
  assert.ok(visionCap.providers && visionCap.providers.length >= 0);
  const chainCap = caps.find(c => c.key === 'chain');
  assert.ok(Array.isArray(chainCap.subtitleStyles) && chainCap.subtitleStyles.length >= 1);
});

test('listTwinChannels 3 入口', () => {
  const chs = listTwinChannels();
  assert.equal(chs.length, 3);
});

test('buildTwinMatrixHealth 5x3 矩阵 — miniprogram chain/multi_modal 不支持', () => {
  const h = buildTwinMatrixHealth();
  assert.equal(h.capabilities.length, 5);
  assert.equal(h.channels.length, 3);
  assert.equal(h.matrix.length, 5);
  for (const row of h.matrix) {
    assert.equal(row.channels.web.supported, true);
    assert.equal(row.channels.api.supported, true);
    if (row.capability === 'chain' || row.capability === 'multi_modal') {
      assert.equal(row.channels.miniprogram.supported, false);
      assert.ok(row.channels.miniprogram.reason && row.channels.miniprogram.reason.length > 0);
    } else {
      assert.equal(row.channels.miniprogram.supported, true);
    }
  }
});

// ════════════════════════════════════════════════════
// 区块 3: executeTwin 主入口 — 5 capability × 3 channel
// ════════════════════════════════════════════════════

test('executeTwin tts (web) 走 ttsBridge, 出 costCny + costSnapshot', async () => {
  const r = await executeTwin({
    capability: 'tts',
    channel: 'web',
    input: { text: '薯包孪生体 2.0 矩阵测试', voiceId: 'default', lang: 'zh-CN' },
    compliance: FULL_COMPLIANCE,
  });
  assert.equal(r.ok, true);
  assert.equal(r.twin.capability, 'tts');
  assert.equal(r.twin.channel, 'web');
  assert.equal(r.twin.compliance.passed, true);
  assert.ok(r.twin.result.tts);
  assert.ok(r.twin.costCny >= 0);
  assert.ok(r.twin.costSnapshot);
});

test('executeTwin vision (web) 走 visionBridge modlens, 暴露 modlensBridge 字段', async () => {
  const r = await executeTwin({
    capability: 'vision',
    channel: 'web',
    input: { prompt: '测试视觉理解', imagePath: '/tmp/test.png' },
    compliance: FULL_COMPLIANCE,
  });
  assert.equal(r.ok, true);
  assert.equal(r.twin.capability, 'vision');
  assert.equal(r.twin.result.kind, 'vision');
  assert.equal(r.twin.result.modlensBridge, 'visionBridge');
});

test('executeTwin chain (web) 走 chainService executeChain, 4 步状态机', async () => {
  const r = await executeTwin({
    capability: 'chain',
    channel: 'web',
    input: { text: '薯包孪生体 2.0 矩阵 1-click chain 测试' },
    compliance: FULL_COMPLIANCE,
  });
  assert.equal(r.ok, true);
  assert.equal(r.twin.capability, 'chain');
  assert.ok(r.twin.result.chain);
  // chain.cost 累计 4 步
  assert.ok(r.twin.costSnapshot);
});

test('executeTwin multi_modal (web) 暴露 intent + cost 估算', async () => {
  const r = await executeTwin({
    capability: 'multi_modal',
    channel: 'web',
    input: { text: '三方多模态串联' },
    compliance: FULL_COMPLIANCE,
  });
  assert.equal(r.ok, true);
  assert.equal(r.twin.capability, 'multi_modal');
  assert.ok(r.twin.costCny > 0);
});

test('executeTwin composition (web) 暴露 intent + cost 估算', async () => {
  const r = await executeTwin({
    capability: 'composition',
    channel: 'web',
    input: { productId: 'prod-001', count: 3 },
    compliance: FULL_COMPLIANCE,
  });
  assert.equal(r.ok, true);
  assert.equal(r.twin.capability, 'composition');
});

test('executeTwin 缺 compliance = 451 + TWIN_COMPLIANCE_FAILED', async () => {
  await assert.rejects(
    () => executeTwin({
      capability: 'tts',
      channel: 'web',
      input: { text: '薯包' },
      compliance: null,
    }),
    err => err.code === 'TWIN_COMPLIANCE_FAILED' && err.status === 451
  );
});

test('executeTwin 缺 1 法律勾选 = 451 + 列出 missing', async () => {
  await assert.rejects(
    () => executeTwin({
      capability: 'tts',
      channel: 'web',
      input: { text: '薯包' },
      compliance: { generative_ai_interim: true, deep_synthesis: true, content_labeling: false },
    }),
    err => err.code === 'TWIN_COMPLIANCE_FAILED' && err.missing.includes('content_labeling')
  );
});

test('executeTwin miniprogram 跑 chain = 400 + TWIN_CHANNEL_UNSUPPORTED', async () => {
  await assert.rejects(
    () => executeTwin({
      capability: 'chain',
      channel: 'miniprogram',
      input: { text: '薯包' },
      compliance: FULL_COMPLIANCE,
    }),
    err => err.code === 'TWIN_CHANNEL_UNSUPPORTED' && err.status === 400
  );
});

test('executeTwin miniprogram 跑 tts = ok (同步支持)', async () => {
  const r = await executeTwin({
    capability: 'tts',
    channel: 'miniprogram',
    input: { text: '小程序同步 tts' },
    compliance: FULL_COMPLIANCE,
  });
  assert.equal(r.ok, true);
  assert.equal(r.twin.channel, 'miniprogram');
});

test('executeTwin api 跑 chain = ok + fullAudit=true', async () => {
  const r = await executeTwin({
    capability: 'chain',
    channel: 'api',
    input: { text: 'API 入口全功能 chain' },
    compliance: FULL_COMPLIANCE,
  });
  assert.equal(r.ok, true);
  assert.equal(r.twin.channel, 'api');
  assert.equal(r.twin.fullAudit, true);
});

test('executeTwin 未知 capability = 400 + TWIN_CAPABILITY_UNKNOWN', async () => {
  await assert.rejects(
    () => executeTwin({
      capability: 'unknown_cap',
      channel: 'web',
      input: {},
      compliance: FULL_COMPLIANCE,
    }),
    err => err.code === 'TWIN_CAPABILITY_UNKNOWN' && err.status === 400
  );
});

// ════════════════════════════════════════════════════
// 区块 4: mountTwinMatrixRoutes 3 处真实现 + 公共端点
// ════════════════════════════════════════════════════

function makeAppWithAuth() {
  const app = express();
  app.use(express.json());
  return app;
}

test('mountTwinMatrixRoutes 公共端点 /api/twin/matrix/health 不需鉴权', async () => {
  const app = makeAppWithAuth();
  mountTwinMatrixRoutes(app, { authenticate: () => 'test@x.com' });
  const res = await new Promise((resolve) => {
    const req = {};
    const r = { json: (data) => resolve({ status: 200, body: data }) };
    // 直接调路由
    app._router.stack.forEach(l => {
      if (l.route && l.route.path === '/api/twin/matrix/health') {
        l.route.stack[0].handle(req, r);
      }
    });
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.matrix);
  assert.equal(res.body.matrix.length, 5);
});

test('mountTwinMatrixRoutes 公共端点 /api/twin/capabilities', async () => {
  const app = makeAppWithAuth();
  mountTwinMatrixRoutes(app, { authenticate: () => 'test@x.com' });
  const res = await new Promise((resolve) => {
    const r = { json: (data) => resolve({ status: 200, body: data }) };
    app._router.stack.forEach(l => {
      if (l.route && l.route.path === '/api/twin/capabilities') {
        l.route.stack[0].handle({}, r);
      }
    });
  });
  assert.equal(res.body.capabilities.length, 5);
  assert.equal(res.body.channels.length, 3);
});

test('mountTwinMatrixRoutes 公共端点 /api/twin/compliance/legals', async () => {
  const app = makeAppWithAuth();
  mountTwinMatrixRoutes(app, { authenticate: () => 'test@x.com' });
  const res = await new Promise((resolve) => {
    const r = { json: (data) => resolve({ status: 200, body: data }) };
    app._router.stack.forEach(l => {
      if (l.route && l.route.path === '/api/twin/compliance/legals') {
        l.route.stack[0].handle({}, r);
      }
    });
  });
  assert.equal(res.body.legals.length, 3);
  assert.equal(res.body.summary.legals.length, 3);
});

test('mountTwinMatrixRoutes 3 处真实现 (web / miniprogram / api) 鉴权失败 = 401', async () => {
  const app = makeAppWithAuth();
  mountTwinMatrixRoutes(app, { authenticate: () => null });
  for (const path of ['/api/twin/web/execute', '/api/twin/miniprogram/execute', '/api/twin/api/execute']) {
    const res = await new Promise((resolve) => {
      const r = {
        status(c) { this._status = c; return this; },
        json(data) { resolve({ status: this._status, body: data }); },
        _status: 200,
      };
      app._router.stack.forEach(l => {
        if (l.route && l.route.path === path) {
          l.route.stack[0].handle({ body: {} }, r);
        }
      });
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'TWIN_UNAUTHORIZED');
  }
});

test('mountTwinMatrixRoutes Web 入口 tts + 合规 = ok', async () => {
  const app = makeAppWithAuth();
  mountTwinMatrixRoutes(app, { authenticate: () => 'test@x.com' });
  const res = await new Promise((resolve) => {
    const r = {
      status(c) { this._status = c; return this; },
      json(data) { resolve({ status: this._status || 200, body: data }); },
      _status: 200,
    };
    app._router.stack.forEach(l => {
      if (l.route && l.route.path === '/api/twin/web/execute') {
        l.route.stack[0].handle({
          body: { capability: 'tts', input: { text: 'web tts' }, compliance: FULL_COMPLIANCE },
        }, r);
      }
    });
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.channel, 'web');
  assert.equal(res.body.actor, 'test@x.com');
});

test('mountTwinMatrixRoutes 小程序入口 chain = 400 (syncOnly 不支持)', async () => {
  const app = makeAppWithAuth();
  mountTwinMatrixRoutes(app, { authenticate: () => 'test@x.com' });
  const res = await new Promise((resolve) => {
    const r = {
      status(c) { this._status = c; return this; },
      json(data) { resolve({ status: this._status || 200, body: data }); },
      _status: 200,
    };
    app._router.stack.forEach(l => {
      if (l.route && l.route.path === '/api/twin/miniprogram/execute') {
        l.route.stack[0].handle({
          body: { capability: 'chain', input: { text: '小程序 chain' }, compliance: FULL_COMPLIANCE },
        }, r);
      }
    });
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'TWIN_MP_UNSUPPORTED');
});

test('mountTwinMatrixRoutes API 入口 chain + rawProvider + auditTrail = ok', async () => {
  const app = makeAppWithAuth();
  mountTwinMatrixRoutes(app, { authenticate: () => 'test@x.com' });
  const res = await new Promise((resolve) => {
    const r = {
      status(c) { this._status = c; return this; },
      json(data) { resolve({ status: this._status || 200, body: data }); },
      _status: 200,
    };
    app._router.stack.forEach(l => {
      if (l.route && l.route.path === '/api/twin/api/execute') {
        l.route.stack[0].handle({
          body: { capability: 'chain', input: { text: 'api chain' }, compliance: FULL_COMPLIANCE, rawProvider: 'volcengine' },
          originalUrl: '/api/twin/api/execute',
          get: (k) => k === 'user-agent' ? 'jest' : null,
        }, r);
      }
    });
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.fullAudit, true);
  assert.equal(res.body.rawProvider, 'volcengine');
  assert.ok(res.body.auditTrail && res.body.auditTrail.requestId);
});

test('mountTwinMatrixRoutes 缺 authenticate = throw', () => {
  const app = makeAppWithAuth();
  assert.throws(() => mountTwinMatrixRoutes(app, {}), /authenticate is required/);
  assert.throws(() => mountTwinMatrixRoutes(), /app required/);
});

// ════════════════════════════════════════════════════
// 区块 5: 数据回流画布 (薯包独门 3/3) — 6 kind + 3 视图
// ════════════════════════════════════════════════════

test('recordFeedbackEvent 6 kind 全部到位 (drop/remove/replace/rate/share/download)', () => {
  clearFeedbackRing();
  for (const kind of ['drop', 'remove', 'replace', 'rate', 'share', 'download']) {
    const e = recordFeedbackEvent({
      kind,
      userEmail: 'a@x.com',
      assetId: 'asset-1',
      assetSource: 'product_profile',
      capability: 'composition',
      rating: kind === 'rate' ? 5 : null,
    });
    assert.equal(e.kind, kind);
    assert.ok(e.eventId && e.eventId.startsWith('fb-'));
    assert.ok(e.ts);
  }
  const s = summarizeFeedback();
  assert.equal(s.totalEvents, 6);
  assert.equal(s.byKind.drop, 1);
  assert.equal(s.byKind.rate, 1);
});

test('recordFeedbackEvent 未知 kind = 400 + CANVAS_FEEDBACK_KIND_UNKNOWN', () => {
  assert.throws(
    () => recordFeedbackEvent({ kind: 'unknown_kind' }),
    err => err.code === 'CANVAS_FEEDBACK_KIND_UNKNOWN' && err.status === 400
  );
});

test('recordFeedbackEvent complianceCheck 字段快照成 3 法律 boolean', () => {
  clearFeedbackRing();
  const e = recordFeedbackEvent({
    kind: 'rate',
    userEmail: 'a@x.com',
    capability: 'tts',
    complianceCheck: FULL_COMPLIANCE,
  });
  assert.equal(e.complianceCheck.generative_ai_interim, true);
  assert.equal(e.complianceCheck.deep_synthesis, true);
  assert.equal(e.complianceCheck.content_labeling, true);
});

test('aggregateFeedback 3 视图 (assetTop / capabilityTop / userTop)', () => {
  clearFeedbackRing();
  for (let i = 0; i < 5; i += 1) {
    recordFeedbackEvent({ kind: 'drop', userEmail: 'u1@x.com', assetId: 'asset-A', capability: 'composition' });
  }
  for (let i = 0; i < 3; i += 1) {
    recordFeedbackEvent({ kind: 'rate', userEmail: 'u1@x.com', assetId: 'asset-B', capability: 'tts', rating: 4 });
  }
  recordFeedbackEvent({ kind: 'share', userEmail: 'u2@x.com', assetId: 'asset-A', capability: 'composition' });
  const agg = aggregateFeedback();
  assert.equal(agg.totalEvents, 9);
  assert.equal(agg.byKind.drop, 5);
  assert.equal(agg.byKind.rate, 3);
  assert.equal(agg.byKind.share, 1);
  // assetTop 排序
  assert.equal(agg.assetTop[0].assetId, 'asset-A');
  assert.equal(agg.assetTop[0].count, 6);
  // ratingAvg
  const assetB = agg.assetTop.find(a => a.assetId === 'asset-B');
  assert.equal(assetB.ratingAvg, 4);
  assert.equal(assetB.ratingCount, 3);
  // userTop
  assert.equal(agg.userTop[0].user, 'u1@x.com');
  assert.equal(agg.userTop[0].count, 8);
  // capabilityTop
  assert.equal(agg.capabilityTop[0].capability, 'composition');
});

test('getRecentFeedbackEvents 支持 limit / kind / capability 过滤', () => {
  clearFeedbackRing();
  for (let i = 0; i < 5; i += 1) {
    recordFeedbackEvent({ kind: i % 2 === 0 ? 'drop' : 'rate', userEmail: 'u@x.com', capability: 'tts', assetId: 'a' + i, rating: 3 });
  }
  const all = getRecentFeedbackEvents({ limit: 10 });
  assert.equal(all.length, 5);
  const dropsOnly = getRecentFeedbackEvents({ limit: 10, kind: 'drop' });
  assert.equal(dropsOnly.length, 3);
  const ttsOnly = getRecentFeedbackEvents({ limit: 10, capability: 'tts' });
  assert.equal(ttsOnly.length, 5);
});

test('summarizeFeedback 轻量摘要 (前端顶部展示)', () => {
  clearFeedbackRing();
  recordFeedbackEvent({ kind: 'drop', userEmail: 'u1@x.com', capability: 'tts' });
  recordFeedbackEvent({ kind: 'rate', userEmail: 'u1@x.com', capability: 'vision' });
  const s = summarizeFeedback();
  assert.equal(s.totalEvents, 2);
  assert.ok(Array.isArray(s.topCapabilities));
  assert.ok(s.note.includes('数据回流画布'));
});

test('mountCanvasFeedbackRoutes /api/canvas/feedback/summary 公共端点', async () => {
  const app = makeAppWithAuth();
  mountCanvasFeedbackRoutes(app, { authenticate: () => 'test@x.com' });
  const res = await new Promise((resolve) => {
    const r = { json: (data) => resolve({ status: 200, body: data }) };
    app._router.stack.forEach(l => {
      if (l.route && l.route.path === '/api/canvas/feedback/summary') {
        l.route.stack[0].handle({}, r);
      }
    });
  });
  assert.ok(res.body.summary || res.body.byKind);
});

test('mountCanvasFeedbackRoutes POST /event 鉴权失败 = 401', async () => {
  const app = makeAppWithAuth();
  mountCanvasFeedbackRoutes(app, { authenticate: () => null });
  const res = await new Promise((resolve) => {
    const r = {
      status(c) { this._status = c; return this; },
      json(data) { resolve({ status: this._status, body: data }); },
      _status: 200,
    };
    app._router.stack.forEach(l => {
      if (l.route && l.route.path === '/api/canvas/feedback/event') {
        l.route.stack[0].handle({ body: { kind: 'drop' } }, r);
      }
    });
  });
  assert.equal(res.status, 401);
});

test('mountCanvasFeedbackRoutes POST /event 鉴权通过 = 入 ring', async () => {
  const app = makeAppWithAuth();
  mountCanvasFeedbackRoutes(app, { authenticate: () => 'test@x.com' });
  const res = await new Promise((resolve) => {
    const r = {
      status(c) { this._status = c; return this; },
      json(data) { resolve({ status: this._status || 200, body: data }); },
      _status: 200,
    };
    app._router.stack.forEach(l => {
      if (l.route && l.route.path === '/api/canvas/feedback/event') {
        l.route.stack[0].handle({ body: { kind: 'drop', assetId: 'a-1', capability: 'tts' } }, r);
      }
    });
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.event.kind, 'drop');
  assert.equal(res.body.actor, 'test@x.com');
});

test('mountCanvasFeedbackRoutes /api/canvas/feedback/aggregate 鉴权通过', async () => {
  clearFeedbackRing();
  const app = makeAppWithAuth();
  mountCanvasFeedbackRoutes(app, { authenticate: () => 'test@x.com' });
  const res = await new Promise((resolve) => {
    const r = {
      status(c) { this._status = c; return this; },
      json(data) { resolve({ status: this._status || 200, body: data }); },
      _status: 200,
    };
    app._router.stack.forEach(l => {
      if (l.route && l.route.path === '/api/canvas/feedback/aggregate') {
        l.route.stack[0].handle({}, r);
      }
    });
  });
  assert.equal(res.status, 200);
  assert.ok(res.body.byKind);
  assert.ok(res.body.assetTop);
  assert.equal(res.body.actor, 'test@x.com');
});
