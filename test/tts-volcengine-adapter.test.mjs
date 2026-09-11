// test/tts-volcengine-adapter.test.mjs
// 用户 9-10 纠正: TTS 供应商是火山引擎(豆包语音), 鉴权仅需 X-Api-Key。契约测试(零付费, 不发外部请求)。
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TTS_PRICING,
  listTTSProviders,
  synthesizeTTS,
  buildVolcengineTtsRequest,
  isRealTtsCredential,
  volcengineServiceNotGrantedHint,
} from '../server/services/ttsBridge.mjs';

test('火山引擎在 provider 价格表与列表里(tier=core)', () => {
  assert.ok(TTS_PRICING.volcengine, 'volcengine must be in the pricing table');
  assert.equal(TTS_PRICING.volcengine.marginBand, 'core');
  assert.ok(listTTSProviders().some(p => p.key === 'volcengine'));
  assert.ok(TTS_PRICING.volcengine.inputPricePerKChars <= 0.0005, '核心档(<=¥0.0005/千字)');
});

test('火山 Seed-TTS 2.0 请求构造（纯函数, 不发网络）: v3 端点 + req_params + 资源头', () => {
  const req = buildVolcengineTtsRequest({ text: '你好薯包', voiceId: 'zh_female_vv_uranus_bigtts', speed: 1.2 });
  assert.equal(req.url, 'https://openspeech.bytedance.com/api/v3/tts/unidirectional');
  assert.equal(req.resourceId, 'seed-tts-2.0');
  assert.equal(req.body.req_params.text, '你好薯包');
  assert.equal(req.body.req_params.speaker, 'zh_female_vv_uranus_bigtts');
  assert.equal(req.body.req_params.audio_params.format, 'mp3');
  assert.equal(req.body.req_params.audio_params.sample_rate, 24000);
  assert.equal(req.body.req_params.audio_params.bit_rate, 64000);
  /* speed(倍速) 映射 speech_rate(-50..100): 1.2 -> 20 */
  assert.equal(req.body.req_params.audio_params.speech_rate, 20);
  /* 不传音色 / voiceId 为占位 'default' 时回落默认 Seed-TTS 2.0 音色; 不传 model 时不带 model 字段 */
  const bare = buildVolcengineTtsRequest({ text: 'x' });
  assert.ok(bare.body.req_params.speaker.length > 0);
  assert.equal(bare.body.req_params.model, undefined);
  assert.equal(buildVolcengineTtsRequest({ text: 'x', voiceId: 'default' }).body.req_params.speaker, bare.body.req_params.speaker);
  /* 克隆音色需要 model 透传 */
  assert.equal(buildVolcengineTtsRequest({ text: 'x', voiceId: 'spk-abc', model: 'seed-icl-2.0' }).body.req_params.model, 'seed-icl-2.0');
});

test('凭据判定 + 未开通服务的错误提示', () => {
  assert.equal(isRealTtsCredential('mock-key'), false);
  assert.equal(isRealTtsCredential('mock'), false);
  assert.equal(isRealTtsCredential('24ca47c5-c7bd-4500-9cb7-0926bef9667b'), true);
  /* 实测: 服务未开通时火山返回 code 3001 + 'requested resource not granted' → 提示用户去控制台开通 */
  const hint = volcengineServiceNotGrantedHint('[resource_id=volc.service_type.10029] requested resource not granted');
  assert.match(hint, /语音合成 2\.0/);
  assert.equal(volcengineServiceNotGrantedHint('some other error'), '');
});

test('未配置真实凭据 -> 保持 mock（诚实门控, 不发外部请求）', async () => {
  const out = await synthesizeTTS({
    text: '薯包口播测试文案',
    provider: 'volcengine',
    apiKey: 'mock-key',
    apiSecret: 'mock-secret',
  });
  assert.equal(out.provider, 'volcengine');
  assert.equal(out.mockAudio, true, '未配置时必须是 mock, 不能假装走过');
  assert.match(out.audioUrl, /^data:audio\//);
  assert.ok(Number(out.costCny) >= 0);
  assert.ok(Number(out.durationMs) > 0);
});