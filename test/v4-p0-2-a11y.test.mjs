// V4 P0-2 (D6) 中文 a11y contract test
// 验证 VideoCanvasFlowCanvas + EcCanvas CanvasPortHandle 都有中文 aria-label
// 用 fs.readFileSync + 正则匹配, 避开 .jsx 解析 (node 不能直接 import)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const flowPath = resolve(__dirname, '..', 'src', 'pages', 'VideoStudio', 'VideoCanvasFlowCanvas.jsx');
const portHandlePath = resolve(__dirname, '..', 'src', 'pages', 'EcCanvas', 'components', 'workflowNodes', 'index.jsx');

test('VideoCanvasFlowCanvas 顶层容器有中文 aria-label 描述连线操作', () => {
  const src = readFileSync(flowPath, 'utf-8');
  assert.match(src, /aria-label=["']React Flow 画布视图（实验）：拖动素材到此镜头连线["']/);
});

test('VideoCanvasFlowCanvas ShubaoAssetNode 中文 a11y + quantv 措辞', () => {
  const src = readFileSync(flowPath, 'utf-8');
  assert.match(src, /aria-label={a11yLabel}/);
  assert.match(src, /从此处拉出连线/);
});

test('VideoCanvasFlowCanvas ShubaoShotNode 中文 a11y 镜头节点', () => {
  const src = readFileSync(flowPath, 'utf-8');
  assert.match(src, /视频镜头/);
  assert.match(src, /连接素材入口/);
});

test('VideoCanvasFlowCanvas ShubaoCandidateNode 中文 a11y 候选节点', () => {
  const src = readFileSync(flowPath, 'utf-8');
  assert.match(src, /成片候选/);
});

test('EcCanvas CanvasPortHandle 默认中文 aria-label (output)', () => {
  const src = readFileSync(portHandlePath, 'utf-8');
  assert.match(src, /从此处派生电商任务/);
  assert.match(src, /aria-label={title}/);
});

test('EcCanvas CanvasPortHandle 默认中文 aria-label (input)', () => {
  const src = readFileSync(portHandlePath, 'utf-8');
  assert.match(src, /连接到此节点/);
});

test('CanvasPortHandle label prop 透传到 aria-label 优先于 default', () => {
  const src = readFileSync(portHandlePath, 'utf-8');
  assert.match(src, /const title = label || (role === 'output' ? '从此处派生电商任务' : '连接到此节点')/);
});
