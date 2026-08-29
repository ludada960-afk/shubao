// V2 P0-3 真进度条 (4c183cd4 续命) 契约测试
//
// 覆盖:
// 1. LongTaskProvider 暴露 markStep API + 200ms 心跳常量
// 2. markStep 计算 progress = (stepIdx+1)/totalSteps * 90 (末步 = 100)
// 3. VideoCanvasWorkbench handleCreateExportManifest 通过 useWorkflowSteps 触发至少 3 步 (V2 P3 自动化)
//
// 用 fs.readFileSync + 正则匹配, 避开 .jsx 解析

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const providerPath = resolve(root, 'src', 'components', 'ui', 'LongTaskProvider.jsx');
const workbenchPath = resolve(root, 'src', 'pages', 'VideoStudio', 'VideoCanvasWorkbench.jsx');

test('V2 P0-3: LongTaskProvider 暴露 markStep + 200ms 心跳常量', () => {
  const src = readFileSync(providerPath, 'utf-8');
  // markStep API
  assert.match(src, /const markStep = useCallback/, '需提供 markStep 事件驱动 API');
  // 心跳常量
  assert.match(src, /HEARTBEAT_MS\s*=\s*200/, '心跳间隔必须是 200ms');
  // 心跳自启动 (startLongTask 内部 setInterval, 允许跨行)
  assert.match(src, /setInterval\([\s\S]*?tickProgress/, 'startLongTask 必须 setInterval 心跳');
  // 心跳清理 (stopLongTask clearInterval)
  assert.match(src, /clearInterval\(heartbeatRef\.current\[id\]\)/, 'stopLongTask 必须 clearInterval');
});

test('V2 P0-3: markStep 中间步 90 封顶, 末步 100', () => {
  const src = readFileSync(providerPath, 'utf-8');
  // 中间步 floor((idx+1)/total * 90)
  assert.match(src, /Math\.floor\(\(idx\s*\+\s*1\)\s*\/\s*total\s*\*\s*90\)/, '中间步必须 90 封顶 floor');
  // 末步 100
  assert.match(src, /idx === total - 1 \? 100/, '末步必须 100');
  // 钳位 0..100
  assert.match(src, /Math\.max\(0, Math\.min\(100, Math\.round/, 'clampProgress 必须 round + 钳位 0..100');
});

test('V2 P0-3: VideoCanvasWorkbench 解构 markStep', () => {
  const src = readFileSync(workbenchPath, 'utf-8');
  assert.match(
    src,
    /const \{ startLongTask, updateLongTask, stopLongTask, markStep \} = useLongTask\(\)/,
    'hook 解构必须包含 markStep',
  );
});

test('V2 P0-3: handleCreateExportManifest 调用 markStep 至少 3 次 (3 步)', () => {
  const src = readFileSync(workbenchPath, 'utf-8');
  const handlerMatch = src.match(/async function handleCreateExportManifest\(\)[\s\S]*?\n  \}/);
  assert.ok(handlerMatch, 'handleCreateExportManifest 函数未找到');
  const handler = handlerMatch[0];
  // 必须出现 3 次 markStep 调用
  const stepMatches = handler.match(/markStep\(/g) || [];
  assert.ok(
    stepMatches.length >= 3,
    'handleCreateExportManifest 必须调用 markStep 至少 3 次 (实际 ' + stepMatches.length + ')',
  );
  // 三个步骤 stepIdx 0/1/2
  assert.match(handler, /markStep\(taskId,\s*0,/);
  assert.match(handler, /markStep\(taskId,\s*1,/);
  assert.match(handler, /markStep\(taskId,\s*2,/);
});

test('V2 P0-3: handleCreateExportManifest 保留 overlay 完成态 (stop 延迟 >= 300ms)', () => {
  const src = readFileSync(workbenchPath, 'utf-8');
  const handlerMatch = src.match(/async function handleCreateExportManifest\(\)[\s\S]*?\n  \}/);
  assert.ok(handlerMatch);
  const handler = handlerMatch[0];
  // setTimeout 延迟 stop, 让用户感知 100% 完成态
  assert.match(handler, /setTimeout\(\s*\(\)\s*=>\s*stopLongTask\(taskId\),\s*(\d+)\s*\)/);
});
