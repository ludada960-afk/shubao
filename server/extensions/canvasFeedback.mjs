// server/extensions/canvasFeedback.mjs
// 4c183cd4 续命 P-F 数据回流画布 — 薯包独门 3/3
//
// 设计目标: 把用户在画布上的行为 (拖入 / 删除 / 替换 / 评分 / 分享 / 下载) 沉淀成孪生体迭代信号,
// 让孪生体矩阵 (twinMatrix) 后续执行时能根据"哪些画布资产被高频使用 / 哪些被拒绝"自我调优.
//
// 关键设计:
//   - 内存 ring buffer (容量 10000 条), 进程重启清空 (跟 telemetry / feedback 同模式, 不持久化)
//   - 行为事件 5 类: drop / remove / replace / rate / share
//   - 聚合 3 视图: by-asset (哪些资产被高频使用), by-user (哪些用户最多动作), by-capability (哪个孪生体能力被最多用)
//   - 不依赖任何外部 SDK / DB; 纯函数 + 内存状态
//   - mount 路由 3 个: POST /api/canvas/feedback/event, GET /api/canvas/feedback/aggregate, GET /api/canvas/feedback/summary
//
// 关联:
//   - twinMatrix.mjs (孪生体矩阵) 在 execute 完成后会异步 push 一条 rate 事件
//   - src/components/business/AIComplianceWatermark.jsx (3 强制法律勾选) 合规勾选状态会进入 complianceCheck 字段
//   - canvasGenerationService.mjs (画布套图) 出件后会 push 一条 rate 事件 (后续 P-G 续命接)

const FEEDBACK_KINDS = Object.freeze(['drop', 'remove', 'replace', 'rate', 'share', 'download']);

const FEEDBACK_RING_CAPACITY = 10000;

let _ringBuffer = [];
let _counters = {
  totalEvents: 0,
  byKind: Object.fromEntries(FEEDBACK_KINDS.map(k => [k, 0])),
  byCapability: Object.create(null),
  byUser: Object.create(null),
  byAsset: Object.create(null),
  startedAt: new Date().toISOString(),
};

function nowIso() {
  return new Date().toISOString();
}

function cleanString(value, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function codedError(code, message, status = 422, details = {}) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  Object.assign(err, details);
  return err;
}

function hashString(input) {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = ((h << 5) - h) + input.charCodeAt(i);
    h |= 0;
  }
  return 'fb-' + Math.abs(h).toString(36);
}

// 单条事件入 ring (容量满后弹掉最老的)
export function recordFeedbackEvent({
  kind,
  userEmail = null,
  assetId = null,
  assetSource = null,
  capability = null,
  rating = null,
  channel = 'web',
  complianceCheck = null,
  meta = null,
  ts = null,
} = {}) {
  if (!FEEDBACK_KINDS.includes(kind)) {
    throw codedError('CANVAS_FEEDBACK_KIND_UNKNOWN', 'unknown kind: ' + kind, 400, { kind });
  }
  const event = {
    eventId: hashString((userEmail || 'anon') + ':' + Date.now() + ':' + Math.random().toString(36).slice(2, 8)),
    kind,
    userEmail: userEmail ? cleanString(userEmail, 200) : null,
    assetId: assetId ? cleanString(assetId, 200) : null,
    assetSource: assetSource ? cleanString(assetSource, 100) : null,
    capability: capability ? cleanString(capability, 50) : null,
    rating: rating === null || rating === undefined ? null : Number(rating),
    channel: cleanString(channel, 30) || 'web',
    complianceCheck: complianceCheck && typeof complianceCheck === 'object' ? {
      generative_ai_interim: !!complianceCheck.generative_ai_interim,
      deep_synthesis: !!complianceCheck.deep_synthesis,
      content_labeling: !!complianceCheck.content_labeling,
    } : null,
    meta: meta && typeof meta === 'object' ? meta : null,
    ts: ts || nowIso(),
  };
  _ringBuffer.push(event);
  if (_ringBuffer.length > FEEDBACK_RING_CAPACITY) {
    _ringBuffer.shift();
  }
  _counters.totalEvents += 1;
  _counters.byKind[kind] = (_counters.byKind[kind] || 0) + 1;
  if (capability) _counters.byCapability[capability] = (_counters.byCapability[capability] || 0) + 1;
  if (userEmail) _counters.byUser[userEmail] = (_counters.byUser[userEmail] || 0) + 1;
  if (assetId) {
    const k = assetId;
    if (!_counters.byAsset[k]) _counters.byAsset[k] = { count: 0, kinds: {}, ratingSum: 0, ratingCount: 0 };
    _counters.byAsset[k].count += 1;
    _counters.byAsset[k].kinds[kind] = (_counters.byAsset[k].kinds[kind] || 0) + 1;
    if (kind === 'rate' && Number.isFinite(event.rating)) {
      _counters.byAsset[k].ratingSum += event.rating;
      _counters.byAsset[k].ratingCount += 1;
    }
  }
  return event;
}

// 获取 ring 最近 N 条 (默认 100)
export function getRecentFeedbackEvents({ limit = 100, kind = null, userEmail = null, capability = null } = {}) {
  const cap = Math.max(1, Math.min(Number(limit) || 100, FEEDBACK_RING_CAPACITY));
  let out = _ringBuffer.slice(-cap);
  if (kind) out = out.filter(e => e.kind === kind);
  if (userEmail) out = out.filter(e => e.userEmail === userEmail);
  if (capability) out = out.filter(e => e.capability === capability);
  return out;
}

// 聚合 3 视图 — 给孪生体调优用
export function aggregateFeedback() {
  const assetTop = Object.entries(_counters.byAsset)
    .map(([assetId, v]) => ({
      assetId,
      count: v.count,
      kinds: v.kinds,
      ratingAvg: v.ratingCount > 0 ? Number((v.ratingSum / v.ratingCount).toFixed(3)) : null,
      ratingCount: v.ratingCount,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  const capabilityTop = Object.entries(_counters.byCapability)
    .map(([cap, count]) => ({ capability: cap, count }))
    .sort((a, b) => b.count - a.count);

  const userTop = Object.entries(_counters.byUser)
    .map(([user, count]) => ({ user, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return {
    totalEvents: _counters.totalEvents,
    ringSize: _ringBuffer.length,
    ringCapacity: FEEDBACK_RING_CAPACITY,
    byKind: Object.assign({}, _counters.byKind),
    assetTop,
    capabilityTop,
    userTop,
    startedAt: _counters.startedAt,
    now: nowIso(),
  };
}

// 摘要 (轻量, 给前端顶部展示)
export function summarizeFeedback() {
  return {
    totalEvents: _counters.totalEvents,
    ringSize: _ringBuffer.length,
    ringCapacity: FEEDBACK_RING_CAPACITY,
    byKind: Object.assign({}, _counters.byKind),
    topCapabilities: Object.entries(_counters.byCapability)
      .map(([c, n]) => ({ capability: c, count: n }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    startedAt: _counters.startedAt,
    note: '数据回流画布: 画布行为 (drop/remove/replace/rate/share/download) 沉淀成孪生体迭代信号.',
  };
}

// 清空 ring + counters (测试用)
export function clearFeedbackRing() {
  _ringBuffer = [];
  _counters = {
    totalEvents: 0,
    byKind: Object.fromEntries(FEEDBACK_KINDS.map(k => [k, 0])),
    byCapability: Object.create(null),
    byUser: Object.create(null),
    byAsset: Object.create(null),
    startedAt: nowIso(),
  };
}

// 三处真实现 — 数据回流画布 API
export function mountCanvasFeedbackRoutes(app, { authenticate } = {}) {
  if (!app) throw new Error('app required');
  if (typeof authenticate !== 'function') throw new Error('authenticate is required');

  const auth = (handler) => async (req, res) => {
    try {
      const email = authenticate(req);
      if (!email) return res.status(401).json({ code: 'CANVAS_FEEDBACK_UNAUTHORIZED', error: '未登录' });
      return handler(req, res, email);
    } catch (e) {
      const message = e && e.message ? e.message : String(e);
      if (e && (e.code === 'AUTH_SESSION_REQUIRED' || e.code === 'AUTH_INVALID' || e.status === 401)) {
        return res.status(401).json({ code: 'CANVAS_FEEDBACK_UNAUTHORIZED', error: message });
      }
      if (e && e.status) {
        return res.status(e.status).json({ code: e.code || 'CANVAS_FEEDBACK_FAILED', error: message });
      }
      return res.status(500).json({ code: 'CANVAS_FEEDBACK_AUTH_ERROR', error: message });
    }
  };

  // 公共: 摘要 (无需鉴权, 给前端顶部展示)
  app.get('/api/canvas/feedback/summary', (_req, res) => {
    res.json(summarizeFeedback());
  });

  // 鉴权: 单事件入 ring
  app.post('/api/canvas/feedback/event', auth(async (req, res, email) => {
    const body = req.body || {};
    try {
      const event = recordFeedbackEvent({
        kind: body.kind,
        userEmail: email,
        assetId: body.assetId || null,
        assetSource: body.assetSource || null,
        capability: body.capability || null,
        rating: body.rating === undefined ? null : body.rating,
        channel: body.channel || 'web',
        complianceCheck: body.complianceCheck || null,
        meta: body.meta || null,
      });
      return res.json({ ok: true, event, actor: email });
    } catch (e) {
      return res.status(e?.status || 500).json({ code: e?.code || 'CANVAS_FEEDBACK_EVENT_FAILED', error: e?.message || String(e) });
    }
  }));

  // 鉴权: 聚合 (孪生体调优用)
  app.get('/api/canvas/feedback/aggregate', auth(async (_req, res, email) => {
    return res.json(Object.assign({ actor: email }, aggregateFeedback()));
  }));
}
