// test/canvas-entry-policy-0912.test.mjs
// 2026-09-12 用户确认的路由策略：
//   电商生图 / 视频生成 / 自由创作  → 进画布（素材与结果成为画布节点，可继续加工）
//   小红书图文                    → 不进画布，保留「9 图 + 配文」同屏弹窗的原有体验
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('电商生图 → 画布：发射 payload + 导航', () => {
  const ecMode = read('src/pages/Home/EcMode.jsx');
  assert.match(ecMode, /dispatch\(\{ type: 'SET_CREATION_LAUNCH'/);
  assert.match(ecMode, /dispatch\(\{ type: 'NAVIGATE', page: 'ec-canvas' \}\)/);
});

test('视频生成 → 画布：完成即自动进入，并带上视频结果与项目资产引用', () => {
  const video = read('src/pages/VideoStudio/index.jsx');
  assert.match(video, /if \(job\?\.status !== 'completed' \|\| !job\.resultUrl \|\| openedJobRef\.current === job\.id\) return;/);
  assert.match(video, /openJobInCanvas\(job\)/);
  assert.match(video, /video: \{ url: videoJob\.resultUrl/);
  assert.match(video, /dispatch\(\{ type: 'NAVIGATE', page: 'ec-canvas' \}\)/);
});

test('自由创作 → 画布：作品作为 result 进入画布', () => {
  const visual = read('src/pages/Home/VisualCreationMode.jsx');
  assert.match(visual, /buildVisualCanvasResult\(work\)/);
  assert.match(visual, /dispatch\(\{ type: 'NAVIGATE', page: 'ec-canvas' \}\)/);
  const model = read('src/pages/Home/visualCreationModel.js');
  assert.match(model, /export function buildVisualCanvasResult\(work, \{ importId \} = \{\}\)/);
  assert.match(model, /canvasImportId:/, '必须带画布导入标识，画布据此识别为一次新作品');
});

test('小红书图文 → 不进画布（保留 9 图 + 配文弹窗体验）', () => {
  const xhs = read('src/pages/Home/XhsContentMode.jsx');
  assert.doesNotMatch(xhs, /page:\s*'ec-canvas'/, '小红书不得跳画布');
  assert.match(xhs, /page:\s*'ec-studio'/);
  const home = read('src/pages/Home/index.jsx');
  assert.match(home, /<XhsContentMode compactMode/);
});
