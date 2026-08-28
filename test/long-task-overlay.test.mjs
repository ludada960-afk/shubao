// V4 P0-3 (D2) 长任务进度条 + 全屏 overlay 契约测试
//
// 覆盖:
// 1. LongTaskProvider 文件存在, 导出 LongTaskProvider + useLongTask
// 2. LongTaskOverlay 文件存在, 导出 LongTaskOverlay, 全屏 z-index 1500
// 3. LongTaskOverlay.css 包含 progress bar 动画 + prefers-reduced-motion 兼容
// 4. App.jsx 接入 LongTaskProvider + 渲染 LongTaskOverlay
// 5. VideoCanvasWorkbench.jsx 调用 useLongTask, handleCreateExportManifest 启动/停止长任务
// 6. aria-busy / aria-label 中文化, 顶部 progress bar 0% → 100% 平滑过渡
//
// 用 fs.readFileSync + 正则匹配, 避开 .jsx 解析 (node 不能直接 import)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const providerPath = resolve(root, 'src', 'components', 'ui', 'LongTaskProvider.jsx');
const overlayPath = resolve(root, 'src', 'components', 'ui', 'LongTaskOverlay.jsx');
const overlayCssPath = resolve(root, 'src', 'components', 'ui', 'LongTaskOverlay.css');
const appPath = resolve(root, 'src', 'App.jsx');
const workbenchPath = resolve(root, 'src', 'pages', 'VideoStudio', 'VideoCanvasWorkbench.jsx');

test('LongTaskProvider.jsx 文件存在, 导出 LongTaskProvider + useLongTask', () => {
  assert.equal(existsSync(providerPath), true, 'LongTaskProvider.jsx 缺失');
  const src = readFileSync(providerPath, 'utf-8');
  assert.match(src, /export function LongTaskProvider/);
  assert.match(src, /export function useLongTask/);
  // 状态机三件套
  assert.match(src, /startLongTask/);
  assert.match(src, /updateLongTask/);
  assert.match(src, /stopLongTask/);
});

test('LongTaskProvider 进度钳位 0..100 + Map<id, task> 多任务并发', () => {
  const src = readFileSync(providerPath, 'utf-8');
  assert.match(src, /Math\.max\(0, Math\.min\(100, next\.progress\)\)/, 'progress 必须钳位 0..100');
  assert.match(src, /useState\(\{\}\)/, 'activeTasks 应为对象 (Map 形式)');
  assert.match(src, /orderRef/, '需要 orderRef 记录开始顺序');
});

test('LongTaskOverlay.jsx 文件存在, 导出 LongTaskOverlay, 顶部 progress bar 0%→100%', () => {
  assert.equal(existsSync(overlayPath), true, 'LongTaskOverlay.jsx 缺失');
  const src = readFileSync(overlayPath, 'utf-8');
  assert.match(src, /export function LongTaskOverlay/);
  // 顶部进度条: width 由 style 驱动
  assert.match(src, /long-task-overlay-progress/);
  assert.match(src, /width: `\$\{percent\}%`/);
  // aria-busy + aria-label 中文
  assert.match(src, /aria-busy="true"/);
  assert.match(src, /aria-label=\{`长任务: /);
  // 中央卡片: spinner + 任务名 + 步骤
  assert.match(src, /LoaderCircle/);
  assert.match(src, /long-task-overlay-title/);
  assert.match(src, /long-task-overlay-stage/);
});

test('LongTaskOverlay.css 全屏 z-index 1500 + 玻璃 backdrop-filter + 进度条平滑', () => {
  assert.equal(existsSync(overlayCssPath), true, 'LongTaskOverlay.css 缺失');
  const css = readFileSync(overlayCssPath, 'utf-8');
  // z-index 1500 (在 NoteModal 9998 之上, 电商全屏 9999 之下)
  assert.match(css, /z-index: 1500/);
  // 全屏 fixed inset:0
  assert.match(css, /position: fixed/);
  assert.match(css, /inset: 0/);
  // 玻璃感 backdrop-filter
  assert.match(css, /backdrop-filter: blur\(6px\) saturate\(1\.1\)/);
  // 进度条平滑过渡
  assert.match(css, /transition: width 360ms cubic-bezier/);
  // prefers-reduced-motion 兼容
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('App.jsx 接入 LongTaskProvider + 渲染 LongTaskOverlay', () => {
  const src = readFileSync(appPath, 'utf-8');
  // 引入 Provider + Overlay
  assert.match(src, /import \{ LongTaskProvider \} from '\.\/components\/ui\/LongTaskProvider\.jsx'/);
  assert.match(src, /import \{ LongTaskOverlay \} from '\.\/components\/ui\/LongTaskOverlay\.jsx'/);
  // Provider 包裹 (在 ErrorBoundary 外层, 保证 overlay 在所有错误边界之上)
  const providerWrapPattern = new RegExp('<LongTaskProvider>[\\s\\S]*?<ErrorBoundary>');
  assert.match(src, providerWrapPattern);
  // 渲染 overlay
  assert.match(src, /<LongTaskOverlay \/>/);
});

test('VideoCanvasWorkbench.jsx 接入 useLongTask + handleCreateExportManifest 启动/停止', () => {
  const src = readFileSync(workbenchPath, 'utf-8');
  // import useLongTask
  assert.match(src, /import \{ useLongTask \} from '\.\.\/\.\.\/components\/ui\/LongTaskProvider\.jsx'/);
  // hook 解构 (V2 P0-3 增量允许额外字段如 markStep, 只要前 3 个都在)
  assert.match(src, /const \{ startLongTask, updateLongTask, stopLongTask[\s\S]*?\} = useLongTask\(\)/);
  // handleCreateExportManifest 内启动长任务
  const handlerMatch = src.match(/async function handleCreateExportManifest\(\)[\s\S]*?\n  \}/);
  assert.ok(handlerMatch, 'handleCreateExportManifest 函数未找到');
  const handler = handlerMatch[0];
  assert.match(handler, /startLongTask\(/, 'handler 内必须调用 startLongTask');
  assert.match(handler, /updateLongTask\(/, 'handler 内必须调用 updateLongTask 推进进度');
  assert.match(handler, /stopLongTask\(/, 'handler 内必须调用 stopLongTask 收尾');
  // 任务标题 + 步骤数
  assert.match(handler, /title: '生成导出清单'/);
  assert.match(handler, /totalSteps: 3/);
});

test('LongTaskOverlay 中文 a11y + 测试钩子 (data-testid)', () => {
  const src = readFileSync(overlayPath, 'utf-8');
  // aria-label 中文
  assert.match(src, /aria-label=\{`长任务: \$\{title\}, 当前 \$\{percent\}%`\}/);
  // 测试钩子
  assert.match(src, /data-testid="long-task-overlay"/);
  assert.match(src, /data-testid="long-task-overlay-percent"/);
  // activeCount 数据属性 (供调试用)
  assert.match(src, /data-active-count=\{activeCount\}/);
});
