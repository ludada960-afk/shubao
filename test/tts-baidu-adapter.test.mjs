// test/tts-baidu-adapter.test.mjs
// 用户 9-10: 接入百度智能云「语音合成 2.0(大模型)」—— 契约测试（零付费, 不发外部请求）。
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TTS_PRICING,
  listTTSProviders,
  synthesizeTTS,
  buildBaiduTtsRequest,
  isRealTtsCredential,
} from '../server/services/ttsBridge.mjs';

test('百度语音已进 provider 价格表与列表', () => {
  assert.ok(TTS_PRICING.baidu, 'baidu must be in the pricing table');
  assert.equal(TTS_PRICING.baidu.marginBand, 'core');
  assert.ok(TTS_PRICING.baidu.voiceCount >= 1);
  assert.ok(listTTSProviders().some(p => p.key === 'baidu'), 'baidu must be listed');
  assert.ok(TTS_PRICING.baidu.inputPricePerKChars <= 0.0005, '价格应在核心档(<=¥0.0005/千字)');
});

test('百度 TTS 请求构造（纯函数, 不发网络）', () => {
  const req = buildBaiduTtsRequest({ text: '你好薯包', token: 'tok-1', voiceId: '5003', speed: 1, lang: 'zh-CN' });
  assert.equal(req.url, 'https://tsn.baidu.com/text2audio');
  const body = new URLSearchParams(req.body);
  assert.equal(body.get('tex'), '你好薯包');
  assert.equal(body.get('tok'), 'tok-1');
  assert.equal(body.get('per'), '5003');
  assert.equal(body.get('aue'), '3', 'mp3 输出');
  assert.equal(body.get('ctp'), '1');
  assert.equal(body.get('lan'), 'zh');
  assert.equal(body.get('cuid'), 'shubao-canvas');
  /* 非数字 voiceId 回落默认大模型音色; 英文 -> lan=en; 语速映射到 0..15 */
  assert.equal(buildBaiduTtsRequest({ text: 'x', token: 't', voiceId: 'default' }).per, '5003');
  assert.equal(new URLSearchParams(buildBaiduTtsRequest({ text: 'x', token: 't', lang: 'en-US' }).body).get('lan'), 'en');
  assert.equal(buildBaiduTtsRequest({ text: 'x', token: 't', speed: 2 }).spd, 10);
  assert.equal(buildBaiduTtsRequest({ text: 'x', token: 't', speed: 99 }).spd, 15, '语速上限夹紧');
});

test('凭据判定: mock 占位不算真凭据', () => {
  assert.equal(isRealTtsCredential('mock-key'), false);
  assert.equal(isRealTtsCredential('mock-secret'), false);
  assert.equal(isRealTtsCredential(''), false);
  assert.equal(isRealTtsCredential('24ca47c5-c7bd-4500-9cb7-0926bef9667b'), true);
});

test('未配置真实凭据 -> 保持 mock（诚实门控, 不发外部请求）', async () => {
  const out = await synthesizeTTS({
    text: '薯包口播测试文案',
    provider: 'baidu',
    apiKey: 'mock-key',
    apiSecret: 'mock-secret',
  });
  assert.equal(out.provider, 'baidu');
  assert.equal(out.mockAudio, true, '未配置时必须是 mock, 不能假装走过');
  assert.match(out.audioUrl, /^data:audio\//);
  assert.ok(Number(out.costCny) >= 0);
  assert.ok(Number(out.durationMs) > 0);
});