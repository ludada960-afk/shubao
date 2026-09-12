// test/provider-backup-routes-0912.test.mjs
// 2026-09-12 用户要求：nano / 视频也要有备用供应商 —— 同模型换供应商、用户无感、只切一次。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8');
const video = readFileSync(new URL('../server/videoGeneration.mjs', import.meta.url), 'utf8');
const providers = readFileSync(new URL('../server/videoProviders.mjs', import.meta.url), 'utf8');
const adapter = readFileSync(new URL('../server/ecommerceEngine/providerAdapter.mjs', import.meta.url), 'utf8');

test('视频注册表支持备用网关，且未配置时不启用', () => {
  assert.match(providers, /backup = null/);
  assert.match(providers, /alternate\(productId\)/);
  assert.match(providers, /hasBackup: alternateAdapters\.size > 0/);
  assert.match(providers, /const backupModel = clean\(backup\?\.models\?\.\[product\.routeId\], 200\)/, '备用模型名按 routeId 映射');
  assert.match(providers, /if \(backupToken && backupModel\)/, '没有映射就不挂备用（绝不把不支持的模型名发过去）');
});

test('视频执行器：任务失败切备用一次，只切一次', () => {
  assert.match(video, /const alternate = job\.provider_source === 'backup' \? null : registry\.alternate\(job\.product_id\)/);
  assert.match(video, /provider_source: 'backup'/);
  assert.match(video, /const resubmitted = await alternate\.submit\(providerPayload, nextAttempt\.submission_key\)/);
  assert.match(video, /provider = alternate/);
});

test('视频备用 env 一律 trim（空白 = 未配置），且默认关闭', () => {
  assert.match(index, /backupBaseUrl: String\(process\.env\.VIDEO_BACKUP_BASE_URL \|\| ''\)\.trim\(\)/);
  assert.match(index, /backupApiKey: String\(process\.env\.VIDEO_BACKUP_API_KEY \|\| ''\)\.trim\(\)/);
  assert.match(video, /backup: backupBaseUrl\s*\?/);
});

test('nano：主 Change2Pro + 备 IP233，包成主备路由器', () => {
  assert.match(index, /const nanoBananaProviderAdapter = NANO_BANANA_KEY \? createProviderRouter\(\{/);
  assert.match(index, /primary: createNanoPrimaryAdapter\(\)/);
  assert.match(index, /NANO_BACKUP_BASE && NANO_BACKUP_KEY \? \{ overflow: createNanoBackupAdapter\(\) \}/);
  assert.match(index, /'nano-banana-pro:2K': process\.env\.NANO_BACKUP_MODEL_PRO_2K \|\| 'nano-banana-pro-2k'/);
  assert.match(adapter, /MODEL_MAP\[`\$\{model\}:\$\{resolution\}`\]/, '模型+分辨率映射');
});

test('视频用户可见文案不含「上游」等内部字样（红线）', () => {
  /* 只看「面向用户的中文文案」（含汉字的字符串字面量）；错误码/导入路径是内部标识，不算泄漏 */
  const strings = (video.match(/'[^'\n]*'/g) || []).filter(text => /[\u4e00-\u9fa5]/.test(text));
  const leaked = strings.filter(text => /上游|供应商|provider|api/i.test(text));
  assert.deepEqual(leaked, [], '用户可见文案不得出现内部字样: ' + leaked.slice(0, 3).join(' | '));
});
