// test/image-backup-env-guard-0912.test.mjs
// 2026-09-12 事故回归：.env 里的 IMAGE_BACKUP_API_KEY 是空白值 → 装配了空凭据适配器 → 启动崩溃、全站 502。
// 约定：备用供应商的 env 值必须 trim，空白一律视为「未配置」。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8');

test('备用供应商 env 读取一律 trim（空白值 = 未配置）', () => {
  assert.match(index, /const IMG_BACKUP_BASE = String\(process\.env\.IMAGE_BACKUP_BASE_URL \|\| ''\)\.trim\(\)/);
  assert.match(index, /const IMG_BACKUP_KEY = String\(process\.env\.IMAGE_BACKUP_API_KEY \|\| ''\)\.trim\(\)/);
  assert.doesNotMatch(index, /const IMG_BACKUP_KEY = process\.env\.IMAGE_BACKUP_API_KEY \|\| ''/);
});

test('空凭据绝不进入适配器装配（两道闸）', () => {
  assert.match(index, /IMG_BACKUP_BASE && IMG_BACKUP_KEY/, '仍有非空判断才启用备用');
  const builder = index.match(/const createBackupImageAdapter = \(\) => createProviderAdapter\(\{([\s\S]*?)\}\);/);
  assert.ok(builder, '备用适配器工厂存在');
  assert.match(builder[1], /bearerToken: IMG_BACKUP_KEY/);
});
