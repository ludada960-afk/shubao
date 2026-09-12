// test/image-provider-failover-0912.test.mjs
// 2026-09-12 用户批注：生图/生视频要有备用供应商；模型不变、用户无感、最多切一次。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adapter = readFileSync(new URL('../server/ecommerceEngine/providerAdapter.mjs', import.meta.url), 'utf8');
const router = readFileSync(new URL('../server/ecommerceEngine/providerRouter.mjs', import.meta.url), 'utf8');
const service = readFileSync(new URL('../server/canvasGenerationService.mjs', import.meta.url), 'utf8');
const index = readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8');

test('适配器支持同步图片协议（备用供应商多为同步接口）', () => {
  assert.match(adapter, /'openai-images'/);
  assert.match(adapter, /async function submitSyncImages\(request\)/);
  assert.match(adapter, /MODEL_MAP\[resolution\]/, '按分辨率映射上游模型名');
});

test('路由器把「任务失败」也纳入可切备用（原来的 canOverflow 只覆盖提交失败）', () => {
  assert.match(router, /hasOverflow: Boolean\(adapters\.overflow\)/);
  assert.match(router, /async failover\(request\)/);
});

test('执行器只切一次：备用任务带 overflow: 前缀后不再切，不无限轮换', () => {
  assert.match(service, /const alreadyOnOverflow = String\(job\.providerJobId \|\| ''\)\.startsWith\('overflow:'\)/);
  assert.match(service, /failedTerminally && alreadyOnOverflow === false/);
  /* 不按时间切断：正常慢任务不能被误判失败 */
  assert.doesNotMatch(service, /pollUntilReady\(job\.providerJobId, \{ maxPolls: 1[0-9] \}\)/);
});

test('切换过程对用户零信息（技术细节只进日志）', () => {
  assert.match(service, /console\.warn\('\[canvas-generation\] provider failover'/);
  /* 只检查「字符串字面量」——注释里出现这些词不算泄漏 */
  assert.doesNotMatch(service, /'[^'\n]*(已切换|已尝试多家|备用供应商|上游)[^'\n]*'/);
});

test('备用供应商按环境变量装配（未配置则不启用）', () => {
  assert.match(index, /IMAGE_BACKUP_BASE_URL/);
  assert.match(index, /IMG_BACKUP_BASE && IMG_BACKUP_KEY/);
  assert.match(index, /modelMap: IMG_BACKUP_MODELS/);
});
