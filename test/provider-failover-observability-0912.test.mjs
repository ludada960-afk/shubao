// test/provider-failover-observability-0912.test.mjs
// 2026-09-12 用户澄清：用户侧永远不能知道「有备用」这回事；
// 失败只说产品级原因；真实原因与切换逻辑必须留在我们后台，自己能查。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const video = readFileSync(new URL('../server/videoGeneration.mjs', import.meta.url), 'utf8');
const canvas = readFileSync(new URL('../server/canvasGenerationService.mjs', import.meta.url), 'utf8');

test('用户可见文案绝不含「备用 / 供应商 / 上游」等内部概念', () => {
  for (const [name, source] of [['videoGeneration', video], ['canvasGenerationService', canvas]]) {
    const strings = (source.match(/'[^'\n]*'/g) || []).filter(text => /[\u4e00-\u9fa5]/.test(text));
    const leaked = strings.filter(text => /备用|供应商|上游|备份通道/.test(text));
    assert.deepEqual(leaked, [], name + ' 用户可见文案泄漏: ' + leaked.slice(0, 3).join(' | '));
  }
});

test('先主后备：只在失败之后才切换（主通道永远先跑）', () => {
  /* 切换只出现在「状态失败」分支内，且判定条件基于失败结果 */
  const branch = video.match(/if \(\['failed', 'cancelled', 'canceled', 'error'\]\.includes\(status\)\) \{([\s\S]*?)\n        \}/);
  assert.ok(branch, '失败分支存在');
  assert.match(branch[1], /registry\.alternate\(job\.product_id\)/);
  assert.match(branch[1], /throw httpError\(502, 'VIDEO_PROVIDER_FAILED'/);
});

test('后台可查：视频把主通道失败原因记进尝试历史 + 标记已切备用', () => {
  assert.match(video, /console\.warn\('\[video-generation\] provider failover'/);
  assert.match(video, /attemptStore\.markFailed\(job\.current_attempt_id, \{\s*\n\s*code: 'VIDEO_PROVIDER_FAILED'/);
  assert.match(video, /provider_source: 'backup'/);
});

test('后台可查：画布任务用 jobId 前缀标明是备用通道出的图', () => {
  assert.match(canvas, /console\.warn\('\[canvas-generation\] provider failover'/);
  assert.match(canvas, /startsWith\('overflow:'\)/);
});
