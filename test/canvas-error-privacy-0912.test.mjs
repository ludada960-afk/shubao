// test/canvas-error-privacy-0912.test.mjs
// 2026-09-12 用户批注：上游 / 供应商属于内部信息，用户层面不得感知；
// 用户只看到产品级提示，技术细节（上游任务号、上游原文）只留服务端日志与 provider_job_id 列。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../server/canvasGenerationService.mjs', import.meta.url), 'utf8');

test('用户可见文案里不出现上游/供应商/任务号等内部信息', () => {
  const map = source.match(/USER_FACING_GENERATION_MESSAGES = Object\.freeze\(\{([\s\S]*?)\}\);/);
  assert.ok(map, '用户文案表存在');
  /* 只看「用户可见的文案值」——左侧 key 是内部错误码，不面向用户 */
  const messages = [...map[1].matchAll(/:\s*'([^']+)'/g)].map(match => match[1]);
  assert.ok(messages.length >= 3, '至少有 3 条用户文案');
  for (const message of messages) {
    for (const forbidden of ['upstream', 'provider', 'supplier', 'task', 'img_', 'HTTP', '5xx', '接口', '上游']) {
      assert.equal(new RegExp(forbidden, 'i').test(message), false, '用户文案不得出现 ' + forbidden + '：' + message);
    }
  }
  assert.ok(messages.includes('生成失败，请重试'));
  assert.ok(messages.includes('生成服务暂时繁忙，请稍后重试'));
});

test('serializedError 不再把上游任务号外泄给客户端', () => {
  const fn = source.match(/function serializedError\(error\) \{([\s\S]*?)\n\}/);
  assert.ok(fn, 'serializedError 存在');
  const body = fn[1];
  assert.doesNotMatch(body, /jobId: cleanString\(error\?\.jobId\)/, '不再回传 jobId');
  assert.match(body, /message: userFacingGenerationMessage\(error\)/, 'message 走用户文案映射');
  assert.match(body, /retryable: error\?\.retryable === true \|\| transient/, '上游抖动标记为可重试');
});

test('技术细节只进服务端日志', () => {
  assert.match(source, /console\.warn\('\[canvas-generation\] provider failure'/);
  assert.match(source, /const TRANSIENT_ERROR_PATTERN = \/upstream_5xx/);
});
