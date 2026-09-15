// test/llm-channel-fallback.test.mjs
// 门禁：**「去掉失效的 LLM 配置」不得让功能静默降级，也不得让两台机器分叉**。
// ─────────────────────────────────────────────────────────────────────────────
// 起因（2026-09-15，真实事故链）：
//   用户指示去掉已 401 失效的 DeepSeek 配置 → .env 里的 LLM_API_KEY / LLM_BASE_URL /
//   LLM_MODEL 被删除。但**删这三行不是无害清理**：
//
//   ① 删之前 `if (LLM_KEY && LLM_BASE)` 是 **true**（指向一个必失败的通道）。
//      直接留空会把判断变成 false，从而静默改变两条调用链的行为。
//   ② 更麻烦的是两台机器会**分叉**：旧机的 server/.env 里还留着一份 LLM_*
//      （与 MINI_* 逐字相同），新机没有 —— 切流后同一个功能行为不一致，
//      而**切流的前提就是新机与旧机行为一致**。
//   ③ 实测旧机解析出的 LLM_* 与 MINI_* 是**同一套值**（同 sha、同主机），
//      说明「LLM 通道」在本项目里本来就等于 MINI 网关。
//
// 判据（锁规则本身，不锁某个文件里写了什么）：
//   · LLM_* 未配置 → **整组**回退到 MINI_*；
//   · LLM_* 齐全 → 优先 LLM_*；
//   · 键与地址**整组二选一**，绝不拼出「甲家 key + 乙家地址」这种必 401 的组合；
//   · 空白视为未配置；全空时不得伪造可用通道。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveLlmChannel, DEFAULT_LLM_MODEL } from '../server/llmChannel.mjs';

const MINI = { MINI_API_KEY: 'mk', MINI_BASE_URL: 'https://mini.example/', MINI_MODEL: 'gpt-5.6-luna' };

test('判据①：LLM_* 未配置时整组回退到 MINI_*（不得静默降级为「没有通道」）', () => {
  const r = resolveLlmChannel({ ...MINI });
  assert.equal(r.source, 'mini');
  assert.equal(r.key, 'mk');
  assert.equal(r.base, 'https://mini.example'); // 尾部斜杠去掉，避免拼出双斜杠 URL
  assert.equal(r.model, 'gpt-5.6-luna');
  // 反证：这里最容易犯的错是「回退了一半」或「干脆不回退」
  assert.notEqual(r.key, '');
  assert.notEqual(r.base, '');
});

test('判据②：LLM_* 齐全时优先用 LLM_*（不得被 MINI 抢走）', () => {
  const r = resolveLlmChannel({
    LLM_API_KEY: 'lk', LLM_BASE_URL: 'https://llm.example', LLM_MODEL: 'm-1', ...MINI,
  });
  assert.equal(r.source, 'llm');
  assert.equal(r.key, 'lk');
  assert.equal(r.base, 'https://llm.example');
  assert.equal(r.model, 'm-1');
});

test('判据③：键与地址整组二选一 —— 绝不拼出「甲家 key + 乙家地址」', () => {
  // 有 LLM 的 key、没有 LLM 的地址 → 必须整组用 MINI，而不是 LLM 的 key 配 MINI 的地址
  const halfKey = resolveLlmChannel({ LLM_API_KEY: 'lk', ...MINI });
  assert.equal(halfKey.source, 'mini');
  assert.equal(halfKey.key, 'mk');
  assert.equal(halfKey.base, 'https://mini.example');

  // 有 LLM 的地址、没有 LLM 的 key → 同样整组用 MINI
  const halfBase = resolveLlmChannel({ LLM_BASE_URL: 'https://llm.example', ...MINI });
  assert.equal(halfBase.source, 'mini');
  assert.equal(halfBase.key, 'mk');
  assert.equal(halfBase.base, 'https://mini.example');
});

test('判据④：空白一律视为未配置', () => {
  const r = resolveLlmChannel({ LLM_API_KEY: '   ', LLM_BASE_URL: '\t', ...MINI });
  assert.equal(r.source, 'mini');
  assert.equal(r.key, 'mk');
});

test('判据⑤：全空时不得伪造出可用通道，且模型名有确定默认值', () => {
  const r = resolveLlmChannel({});
  assert.equal(r.source, 'none');
  assert.equal(r.key, '');
  assert.equal(r.base, '');
  assert.equal(r.model, DEFAULT_LLM_MODEL);
  assert.ok(DEFAULT_LLM_MODEL.length > 0, '默认模型名不许是空串（否则调用方会拿空 model 去请求）');
});

test('接线：两个入口共用同一份解析，且不得再各自直接读 process.env.LLM_*', () => {
  const idx = readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8');
  const ext = readFileSync(new URL('../server/extensionRoutes.mjs', import.meta.url), 'utf8');

  assert.match(idx, /resolveLlmChannel\(/, 'index.mjs 必须用 resolveLlmChannel');
  assert.match(ext, /resolveLlmChannel\(/, 'extensionRoutes.mjs 必须用 resolveLlmChannel');

  // 反证：这三个常量不许再各自直读环境变量 —— 那正是「两台机器解析结果分叉」的成因
  assert.ok(!/const LLM_KEY = process\.env\.LLM_API_KEY/.test(idx), 'index.mjs 不得再直接读 LLM_API_KEY');
  assert.ok(!/const LLM_BASE = \(process\.env\.LLM_BASE_URL/.test(idx), 'index.mjs 不得再直接读 LLM_BASE_URL');
  assert.ok(!/LLM_MODEL: process\.env\.LLM_MODEL \|\|/.test(ext), 'loadEnv 不得再直接读 LLM_MODEL');
});
