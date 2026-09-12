// test/asset-library-upload-0912.test.mjs
// 2026-09-12 用户批注：资产库要能直接上传素材（上传 → 入库 → 刷新列表与额度）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const canvas = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/canvas-supervisor.css', import.meta.url), 'utf8');

test('资产库上传复用既有链路（读取 → 上传 → 入库 → 刷新）', () => {
  assert.ok(canvas.includes('const handleAssetLibraryUpload = useCallback(async event => {'), '上传处理器存在');
  assert.ok(canvas.includes('readCanvasImageFiles(files, Date.now())'), '复用本地读取');
  assert.ok(canvas.includes("persistCanvasUploadAssets(localAssets, { role: 'reference' })"), '复用上传服务');
  assert.ok(canvas.includes('importImageAssetToProject(context.projectId, {'), '入库到项目资产');
  assert.ok(canvas.includes('currentProjectId: context.projectId'), '入库后按新项目刷新列表');
  assert.ok(canvas.includes('个素材到资产库'), '成功提示');
});

test('上传入口只收图片、最多 8 个，失败给可读文案', () => {
  assert.ok(canvas.includes("String(file.type || '').startsWith('image/')"), '只收图片');
  assert.ok(canvas.includes('picked.slice(0, 8)'), '最多 8 个');
  assert.ok(canvas.includes('请选择 JPEG、PNG 或 WebP 图片'), '空选择提示');
  assert.ok(canvas.includes("'上传失败，请重试'"), '失败文案');
  assert.ok(canvas.includes('accept="image/*" multiple hidden onChange={handleAssetLibraryUpload}'), '隐藏文件输入已接上');
  assert.ok(css.includes('.ec-asset-upload {'), '上传按钮样式存在');
});
