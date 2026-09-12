// test/asset-library-0912.test.mjs
// 2026-09-12 用户批注：资产库要照竞品做——顶部有存储额度、分类、卡片只留悬停删除、保留上传/查询。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('服务端：额度统计 + 素材软删接口', () => {
  const routes = read('server/projects/projectRoutes.mjs');
  assert.match(routes, /app\.get\('\/api\/assets\/usage'/);
  assert.match(routes, /app\.post\('\/api\/projects\/:projectId\/assets\/:assetId\/delete'/);
  assert.match(routes, /assetUsageProvider/);
  const store = read('server/projects/projectStore.mjs');
  assert.match(store, /softDeleteProjectAsset\(\{ ownerEmail, projectId, projectAssetId \}\)/);
  assert.match(store, /listOwnedAssetFiles\(\{ ownerEmail \} = \{}\)/);
  const index = read('server/index.mjs');
  assert.match(index, /assetUsageProvider: ownerEmail => \{/);
  assert.match(index, /generated-assets/);
});

test('客户端：额度与删除接口已接通', () => {
  const service = read('src/services/projects.js');
  assert.match(service, /export async function fetchAssetUsage\(\)/);
  assert.match(service, /export async function deleteProjectAsset\(projectId, projectAssetId\)/);
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.match(canvas, /fetchAssetUsage\(\)/);
  assert.match(canvas, /await deleteProjectAsset\(asset\.projectId, asset\.projectAssetId\)/);
});

test('样式：额度条 + 悬停才显示的删除按钮', () => {
  const css = read('src/styles/canvas-supervisor.css');
  assert.match(css, /\.ec-asset-quota-bar i \{/);
  const del = css.match(/\.ec-asset-card-delete \{([^}]*)\}/);
  assert.ok(del, '删除按钮样式存在');
  assert.match(del[1], /opacity: 0/);
  assert.match(css, /article:hover \.ec-asset-card-delete[^{]*\{ opacity: 1; \}/);
});
