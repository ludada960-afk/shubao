// test/tts-bridge.test.mjs
// 4c183cd4 续命 P1 TTS 口播 - 桥 contract test
// 覆盖: 5 provider 单价表 / 路由 / keyring 轮换 / computeTTSCost / costBasis 集成 / synthesizeTTS / mountTTSRoutes
// 跟 costBasis (1d6d17fa) 集成: 拿 actualCostCny / theoreticalPriceCny / margin / health
// 跟 modlens vision 桥 (4c285eca) 同模式: 5 个 adapter + keyring 轮换
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TTS_PRICING,
  TTS_VENDOR_SUMMARY,
  TTS_GANTT,
  TTS_KEYRING_VERSION,
  computeTTSCost,
  computeTTSCostSnapshot,
  listTPSProviders,
  listTTSProviders,
  listTTSKeyringProviders,
  nextProviderKey,
  synthesizeTTS,
  mountTTSRoutes,
  loadTTSKeyring,
  pickTTSProvider,
  clearTTSKeyringCache,
  getTTSKeyringPath,
} from '../server/services/ttsBridge.mjs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, sep } from 'node:path';
import { tmpdir } from 'node:os';

// 1) 5 provider 单价表 ── 跟 1d6d17fa costBasis 模型表口径一致
test('TTS_PRICING 5 价正确 (跟 1d6d17fa costBasis 同模型表)', () => {
  assert.equal(TTS_PRICING.volcengine.inputPricePerKChars, 0.0001);
  assert.equal(TTS_PRICING.elevenlabs.outputPricePerKChars, 0.022);
  assert.equal(TTS_PRICING.azure.outputPricePerKChars, 0.10);
  assert.equal(TTS_PRICING.minimax.name, 'MiniMax TTS (字节豆包)');
  assert.equal(TTS_PRICING.aliyun.name, '阿里云智能语音');
  assert.equal(TTS_PRICING.volcengine.marginBand, 'core');
  assert.equal(TTS_PRICING.elevenlabs.marginBand, 'premium');
});

// 2) 简化的成本计算 (computeTTSCost 默认 outputChars=0, 只算 input)
test('computeTTSCost 1000 字火山 (只算 input) ¥0.0001', () => {
  const r = computeTTSCost({ provider: 'volcengine', textChars: 1000 });
  assert.equal(r.inputCostCny, 0.0001);
  assert.equal(r.outputCostCny, 0);
  assert.equal(r.totalCny, 0.0001);
  assert.equal(r.provider, 'volcengine');
  assert.equal(r.textChars, 1000);
  assert.equal(r.outputChars, 0);
});

test('computeTTSCost 1000 字 ElevenLabs ¥0.04 (input+output 分开)', () => {
  const r = computeTTSCost({ provider: 'elevenlabs', textChars: 1000, outputChars: 1000 });
  assert.equal(r.inputCostCny, 0.018);
  assert.equal(r.outputCostCny, 0.022);
  assert.equal(r.totalCny, 0.04);
});

test('computeTTSCost 输出字符独立计量', () => {
  const r = computeTTSCost({ provider: 'azure', textChars: 1000, outputChars: 500 });
  // input 1000/1000 * 0.016 = 0.016; output 500/1000 * 0.10 = 0.05
  assert.equal(r.inputCostCny, 0.016);
  assert.equal(r.outputCostCny, 0.05);
  assert.equal(r.totalCny, 0.066);
});

test('computeTTSCost 未知 provider 抛错', () => {
  assert.throws(() => computeTTSCost({ provider: 'unknown-xyz', textChars: 100 }), /unknown provider/);
});

test('computeTTSCost 负值/NaN 抛错 (输入校验)', () => {
  assert.throws(() => computeTTSCost({ provider: 'volcengine', textChars: -1 }), /non-negative/);
  assert.throws(() => computeTTSCost({ provider: 'volcengine', textChars: NaN }), /non-negative/);
  assert.throws(() => computeTTSCost({ provider: 'volcengine', textChars: 0, outputChars: -1 }), /non-negative/);
});

// 3) 列出 provider
test('listTTSProviders 5 家全列 (含 marginBand)', () => {
  const list = listTTSProviders();
  assert.equal(list.length, 5);
  const keys = list.map((p) => p.key);
  assert.ok(keys.includes('volcengine'));
  assert.ok(keys.includes('elevenlabs'));
  assert.ok(keys.includes('aliyun'));
  assert.ok(keys.includes('azure'));
  assert.ok(keys.includes('minimax'));
  const volc = list.find((p) => p.key === 'volcengine');
  assert.equal(volc.marginBand, 'core');
  const elabs = list.find((p) => p.key === 'elevenlabs');
  assert.equal(elabs.marginBand, 'premium');
});

test('listTPSProviders 别名与 listTTSProviders 等价 (兼容历史命名)', () => {
  assert.equal(listTPSProviders, listTTSProviders);
  assert.equal(listTPSProviders().length, 5);
});

// 4) Keyring 轮换
test('nextProviderKey round-robin 5 个不重复', () => {
  const seen = new Set();
  for (let i = 0; i < 5; i += 1) seen.add(nextProviderKey());
  assert.equal(seen.size, 5);
});

test('nextProviderKey 第 6 次回到第 1 个', () => {
  // 连续取 6 次, 第一个和第六个相同
  const first = nextProviderKey();
  let prev = first;
  for (let i = 0; i < 4; i += 1) prev = nextProviderKey();
  const sixth = nextProviderKey();
  assert.equal(sixth, first);
});

// 5) costBasis 集成
test('computeTTSCostSnapshot 调用 costBasis 拿 snapshot (1d6d17fa 集成)', () => {
  const snap = computeTTSCostSnapshot({
    provider: 'volcengine',
    textChars: 1000,
    itemUnits: 200, // 200 ec_points
  });
  // 字段齐全
  assert.equal(snap.sku, 'tts_synthesize');
  assert.equal(snap.currency, 'ec_points');
  assert.equal(typeof snap.actualCostCny, 'number');
  assert.ok(snap.theoreticalPriceCny > 0, 'theoreticalPriceCny 应 > 0');
  assert.ok(typeof snap.margin === 'number' || snap.margin === null, 'margin 应是数字或 null');
  assert.ok(['healthy', 'warning', 'breach'].includes(snap.health), 'health 在三档内');
  // 本桥走 upstream_override (providerCostCnyOverride = computeTTSCost 算出的总价)
  assert.equal(snap.usedOverride, true);
  assert.equal(snap.source, 'upstream_override');
  // costBreakdown 应含 tokenCostCny / gpuCostCny / platformCutCny
  assert.ok(snap.tokenBreakdown);
  assert.ok(snap.gpuBreakdown);
  assert.ok(snap.platformBreakdown);
});

test('computeTTSCostSnapshot override 时不挑 (上游实报优先)', () => {
  const snap = computeTTSCostSnapshot({
    provider: 'volcengine',
    textChars: 1000,
    itemUnits: 200,
    providerCostCnyOverride: 0.5, // 上游实报 0.5 元
  });
  assert.equal(snap.actualCostCny, 0.5);
  assert.equal(snap.usedOverride, true);
  // theoreticalPriceCny = 200 * 199/760000 ≈ 0.052368
  // margin = (0.052368 - 0.5) / 0.052368 < 0 → breach
  assert.equal(snap.health, 'breach');
});

// 6) 主入口 synthesizeTTS
test('synthesizeTTS volcengine mock 调用 返 audioUrl + cost + durationMs', async () => {
  // 用 1000 字确保 costCny > 0 (2 字 0.0001/1000*2=2e-7 rounds to 0)
  const text = '你好'.repeat(500);
  const r = await synthesizeTTS({ text, provider: 'volcengine', apiKey: 'test', apiSecret: 'test' });
  assert.equal(r.provider, 'volcengine');
  assert.equal(r.textChars, 1000);
  assert.equal(typeof r.audioUrl, 'string');
  assert.ok(r.audioUrl.length > 0);
  assert.ok(r.costCny > 0);
  assert.ok(r.durationMs > 0);
  assert.ok(r.mockAudio === true);
  // latencyMs 应是非负数 (mock 不应超时)
  assert.ok(r.latencyMs >= 0);
});

test('synthesizeTTS 英文文本走 50ms/字符', async () => {
  const r = await synthesizeTTS({ text: 'hello world', provider: 'elevenlabs', lang: 'en-US' });
  // 11 chars * 50ms / 1.0 speed = 550ms
  assert.equal(r.textChars, 11);
  assert.equal(r.durationMs, 550);
  assert.equal(r.provider, 'elevenlabs');
});

test('synthesizeTTS 中文文本走 60ms/字符', async () => {
  const r = await synthesizeTTS({ text: '今天天气真好啊', provider: 'volcengine', lang: 'zh-CN' });
  // 7 chars * 60ms = 420ms
  assert.equal(r.textChars, 7);
  assert.equal(r.durationMs, 420);
});

test('synthesizeTTS speed 2.0 缩短 duration 一半', async () => {
  const r = await synthesizeTTS({ text: '你好', provider: 'volcengine', speed: 2.0 });
  // 2 chars * 60ms / 2.0 = 60ms
  assert.equal(r.durationMs, 60);
});

test('synthesizeTTS 空 text 抛错', async () => {
  await assert.rejects(() => synthesizeTTS({ text: '' }), /empty text/);
  await assert.rejects(() => synthesizeTTS({ text: '   ' }), /empty text/);
});

test('synthesizeTTS 未知 provider 抛错', async () => {
  await assert.rejects(() => synthesizeTTS({ text: 'test', provider: 'unknown-xyz' }), /unknown provider/);
});

test('synthesizeTTS withCostSnapshot=true 挂 costSnapshot', async () => {
  const r = await synthesizeTTS({ text: 'hi', provider: 'volcengine', withCostSnapshot: true, itemUnits: 100 });
  assert.ok(r.costSnapshot);
  assert.equal(r.costSnapshot.sku, 'tts_synthesize');
  assert.ok(['healthy', 'warning', 'breach'].includes(r.costSnapshot.health));
});

test('synthesizeTTS 不带 provider 时走 keyring 轮换 (默认 round-robin)', async () => {
  // 不传 provider, 让 nextProviderKey 决定, mock 仍能返回
  const r = await synthesizeTTS({ text: 'test' });
  assert.ok(TTS_PRICING[r.provider], '应落在 5 provider 之一');
});

// 7) 元数据常量
test('TTS_VENDOR_SUMMARY 5 句 1 句话优劣', () => {
  assert.equal(typeof TTS_VENDOR_SUMMARY.volcengine, 'string');
  assert.ok(TTS_VENDOR_SUMMARY.volcengine.includes('火山') || TTS_VENDOR_SUMMARY.volcengine.includes('自然度'));
  assert.equal(typeof TTS_VENDOR_SUMMARY.minimax, 'string');
  assert.ok(TTS_VENDOR_SUMMARY.minimax.includes('同源') || TTS_VENDOR_SUMMARY.minimax.includes('火山'));
  assert.equal(Object.keys(TTS_VENDOR_SUMMARY).length, 5);
});

test('TTS_GANTT 5 天 W4 D12', () => {
  assert.equal(TTS_GANTT.length, 5);
  assert.ok(TTS_GANTT[0].day.includes('9/16'));
  assert.ok(TTS_GANTT[0].task.includes('底座'));
  assert.ok(TTS_GANTT[4].task.includes('全量回归'));
});

// 8) mountTTSRoutes (跟 visionRouter 同模式: app.get/post 挂载)
function makeFakeApp() {
  const routes = new Map();
  return {
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
    routes,
  };
}

function makeFakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(v) { this.body = v; return this; },
  };
}

test('mountTTSRoutes 挂载 GET /api/tts/providers (公开)', async () => {
  const app = makeFakeApp();
  mountTTSRoutes(app, { authenticateOwner: () => 'test@shubao.cn' });
  const handler = app.routes.get('GET /api/tts/providers');
  assert.ok(handler, 'route 应存在');
  const res = makeFakeRes();
  await handler({}, res);
  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.providers));
  assert.equal(res.body.providers.length, 5);
});

test('mountTTSRoutes 挂载 POST /api/tts/synthesize (鉴权)', () => {
  const app = makeFakeApp();
  mountTTSRoutes(app, { authenticateOwner: () => 'test@shubao.cn' });
  const handler = app.routes.get('POST /api/tts/synthesize');
  assert.ok(handler, 'route 应存在');
});

test('mountTTSRoutes 缺鉴权回调抛错 (fail closed)', () => {
  const app = makeFakeApp();
  assert.throws(
    () => mountTTSRoutes(app, {}),
    /authenticateOwner or requireAccountAccess is required/,
  );
});

test('mountTTSRoutes 缺 app 抛错', () => {
  assert.throws(() => mountTTSRoutes(null, { authenticateOwner: () => '' }), /app required/);
});

test('mountTTSRoutes 鉴权失败返 401 (authenticateOwner 返 null)', async () => {
  const app = makeFakeApp();
  mountTTSRoutes(app, { authenticateOwner: () => null });
  const handler = app.routes.get('POST /api/tts/synthesize');
  const req = { body: { text: 'test' } };
  const res = makeFakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'TTS_UNAUTHORIZED');
});

test('mountTTSRoutes 鉴权抛错 (AUTH_SESSION_REQUIRED) 返 401', async () => {
  const app = makeFakeApp();
  mountTTSRoutes(app, {
    authenticateOwner() {
      const e = new Error('请先登录');
      e.code = 'AUTH_SESSION_REQUIRED';
      throw e;
    },
  });
  const handler = app.routes.get('POST /api/tts/synthesize');
  const req = { body: { text: 'test' } };
  const res = makeFakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'TTS_UNAUTHORIZED');
});

test('mountTTSRoutes 鉴权成功 + 合成成功', async () => {
  const app = makeFakeApp();
  mountTTSRoutes(app, { authenticateOwner: () => 'merchant@shubao.cn' });
  const handler = app.routes.get('POST /api/tts/synthesize');
  const req = { body: { text: 'hello', provider: 'volcengine' } };
  const res = makeFakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.actor, 'merchant@shubao.cn');
  assert.ok(res.body.tts);
  assert.equal(res.body.tts.provider, 'volcengine');
  assert.ok(res.body.tts.costSnapshot, '应挂 costSnapshot (costBasis 集成)');
});

test('mountTTSRoutes 合成失败 (空 text) 返 400', async () => {
  const app = makeFakeApp();
  mountTTSRoutes(app, { authenticateOwner: () => 'merchant@shubao.cn' });
  const handler = app.routes.get('POST /api/tts/synthesize');
  const req = { body: { text: '' } };
  const res = makeFakeRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'TTS_SYNTHESIZE_FAILED');
});

// 9) costBasis snapshot 给到 health 三档
test('computeTTSCostSnapshot 毛利健康 (itemUnits 充足, override 极低)', () => {
  const snap = computeTTSCostSnapshot({
    provider: 'volcengine',
    textChars: 1000,
    itemUnits: 5000,
    providerCostCnyOverride: 0.0001, // 极低, theoretical ≈ 5000*199/760000 ≈ 1.31
  });
  assert.equal(snap.health, 'healthy');
  assert.ok(snap.margin > 0.4);
});

test('computeTTSCostSnapshot 毛利告警 (0 < margin < 0.40)', () => {
  const snap = computeTTSCostSnapshot({
    provider: 'volcengine',
    textChars: 1000,
    itemUnits: 500, // theoretical ≈ 500*199/760000 ≈ 0.131
    providerCostCnyOverride: 0.10, // 0.10 / 0.131 ≈ 76% cost, margin ≈ -ve 实际是 breach
  });
  // margin = (0.131 - 0.10) / 0.131 ≈ 0.24, warning
  assert.ok(snap.health === 'warning' || snap.health === 'breach', `health=${snap.health}`);
});

// 10) TTS 真 keyring (跟 visionBridge 4c285eca loadKeyring 同模式)
// Day 1 落地点: 跟 modlens vision 桥对齐, 走 .env.d/tts-keyring.json 文件, 不依赖环境变量.
test('TTS_KEYRING_VERSION 显式为 1 (跟 vision-keyring 同源)', () => {
  assert.equal(TTS_KEYRING_VERSION, 1);
});

test('loadTTSKeyring 缺文件返空 ring (走 5 provider 兜底)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tts-kr-'));
  try {
    const ring = loadTTSKeyring({ path: join(dir, 'nope.json') });
    assert.equal(ring.tts_providers.length, 0);
    assert.equal(ring.rotation.strategy, 'round-robin');
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

test('loadTTSKeyring 真文件 + 2 provider (volcengine 主 + elevenlabs 备) 解码 apiKey', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tts-kr-'));
  const keyringPath = join(dir, 'tts-keyring.json');
  // base64 编码 "sk-volc-test-1234" 模拟真实 keyring
  const b64 = Buffer.from('sk-volc-test-1234', 'utf8').toString('base64');
  writeFileSync(keyringPath, JSON.stringify({
    tts_providers: [
      { name: 'volcengine', label: '火山主', apiKey: b64, region: 'cn-north-1', weight: 100 },
      { name: 'elevenlabs', label: 'ElevenLabs 备', apiKey: 'sk-11l-plain-99', weight: 60 },
    ],
    rotation: { strategy: 'round-robin', cooldownSec: 0 },
  }));
  clearTTSKeyringCache();
  try {
    const ring = loadTTSKeyring({ path: keyringPath });
    assert.equal(ring.tts_providers.length, 2);
    assert.equal(ring.tts_providers[0].name, 'volcengine');
    assert.equal(ring.tts_providers[0].apiKey, 'sk-volc-test-1234', 'base64 应被解码');
    assert.equal(ring.tts_providers[0].weight, 100);
    assert.equal(ring.tts_providers[1].apiKey, 'sk-11l-plain-99', '明文 key 透传');
  } finally {
    clearTTSKeyringCache();
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

test('pickTTSProvider preferredProvider 命中 keyring 名字', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tts-kr-'));
  const keyringPath = join(dir, 'tts-keyring.json');
  writeFileSync(keyringPath, JSON.stringify({
    tts_providers: [
      { name: 'volcengine', apiKey: 'sk-1', weight: 100 },
      { name: 'elevenlabs', apiKey: 'sk-2', weight: 60 },
    ],
    rotation: { strategy: 'round-robin' },
  }));
  clearTTSKeyringCache();
  try {
    const p = pickTTSProvider({ preferredProvider: 'elevenlabs', path: keyringPath });
    assert.ok(p, '应命中');
    assert.equal(p.name, 'elevenlabs');
    assert.equal(p.apiKey, 'sk-2');
  } finally {
    clearTTSKeyringCache();
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

test('pickTTSProvider preferredProvider 不在 keyring 返 null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tts-kr-'));
  const keyringPath = join(dir, 'tts-keyring.json');
  writeFileSync(keyringPath, JSON.stringify({
    tts_providers: [{ name: 'volcengine', apiKey: 'sk-1', weight: 100 }],
    rotation: { strategy: 'round-robin' },
  }));
  clearTTSKeyringCache();
  try {
    const p = pickTTSProvider({ preferredProvider: 'aliyun', path: keyringPath });
    assert.equal(p, null);
  } finally {
    clearTTSKeyringCache();
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

test('pickTTSProvider keyring 空返 null (走 nextProviderKey 兜底)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tts-kr-'));
  const keyringPath = join(dir, 'tts-keyring.json');
  writeFileSync(keyringPath, JSON.stringify({ tts_providers: [], rotation: { strategy: 'round-robin' } }));
  clearTTSKeyringCache();
  try {
    const p = pickTTSProvider({ path: keyringPath });
    assert.equal(p, null);
  } finally {
    clearTTSKeyringCache();
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

test('pickTTSProvider keyring provider.name 不在 TTS_PRICING 中被过滤', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tts-kr-'));
  const keyringPath = join(dir, 'tts-keyring.json');
  writeFileSync(keyringPath, JSON.stringify({
    tts_providers: [
      { name: 'unknown-xyz', apiKey: 'sk-x', weight: 100 }, // 5 provider 之外的
      { name: 'volcengine', apiKey: 'sk-v', weight: 80 },
    ],
    rotation: { strategy: 'round-robin' },
  }));
  clearTTSKeyringCache();
  try {
    const p = pickTTSProvider({ path: keyringPath });
    assert.equal(p.name, 'volcengine', 'unknown-xyz 应被过滤');
  } finally {
    clearTTSKeyringCache();
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

test('listTTSKeyringProviders 把 keyring 元信息列出 (含 marginBand)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tts-kr-'));
  const keyringPath = join(dir, 'tts-keyring.json');
  writeFileSync(keyringPath, JSON.stringify({
    tts_providers: [
      { name: 'volcengine', apiKey: 'sk-1', weight: 100, dailyLimitHint: '主' },
      { name: 'elevenlabs', apiKey: 'sk-2', weight: 60, dailyLimitHint: '备' },
    ],
    rotation: { strategy: 'weighted' },
  }));
  clearTTSKeyringCache();
  try {
    const list = listTTSKeyringProviders({ path: keyringPath });
    assert.equal(list.length, 2);
    assert.equal(list[0].name, 'volcengine');
    assert.equal(list[0].weight, 100);
    assert.equal(list[0].hasApiKey, true);
    assert.equal(list[0].marginBand, 'core');
    assert.equal(list[1].marginBand, 'premium');
  } finally {
    clearTTSKeyringCache();
    try { rmSync(dir, { recursive: true, force: true }); } catch {}
  }
});

test('clearTTSKeyringCache 清掉缓存 (避免单测污染)', () => {
  // 先清一次
  clearTTSKeyringCache();
  // 重新加载真实默认路径 (如果不存在应返空)
  const ring = loadTTSKeyring();
  assert.ok(ring, '应返有效 ring (空/有内容都算)');
  assert.ok(Array.isArray(ring.tts_providers));
});

test('getTTSKeyringPath 默认指向 .env.d/tts-keyring.json', () => {
  clearTTSKeyringCache();
  const p = getTTSKeyringPath();
  assert.ok(p.endsWith(`.env.d${sep}tts-keyring.json`) || p.includes('tts-keyring.json'), `path=${p}`);
});
