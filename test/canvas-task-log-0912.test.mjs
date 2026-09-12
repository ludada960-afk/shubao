// test/canvas-task-log-0912.test.mjs
// 2026-09-12 用户批注：任务日志一直是空的、而且纯黑不像我们的风格 → 照竞品做筛选+列表，走浅色。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('任务日志数据来自画布真实任务（不再永远为空）', () => {
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.match(canvas, /const canvasTaskLogEntries = useMemo\(\(\) => \{/);
  assert.match(canvas, /for \(const node of nodes\)/);
  assert.match(canvas, /tasks=\{canvasTaskLogEntries\}/);
  assert.match(canvas, /onDismiss=\{\(?task\)? => setDismissedTaskIds/);
});

test('面板有状态与类型两组筛选 + 中文状态名', () => {
  const panel = read('src/pages/EcCanvas/components/CanvasContextMenuPanel.jsx');
  assert.match(panel, /const TASK_STATUS_FILTERS = \[/);
  assert.match(panel, /const TASK_TYPE_FILTERS = \[/);
  for (const label of ['全部状态', '进行中', '已完成', '失败', '全部类型', '文本', '图片', '视频', '音频']) {
    assert.ok(panel.includes(label), '缺少筛选项 ' + label);
  }
  assert.match(panel, /TASK_STATUS_LABEL\[status\]/, '状态要显示中文');
  assert.doesNotMatch(panel, /\{status\}\s*\n\s*<span>\(\{groupedByStatus/, '不得直接渲染英文状态');
});

test('样式改成浅色主题（不再是纯黑底）', () => {
  const css = read('src/styles/canvas-supervisor.css');
  const panelRule = css.match(/\.ec-canvas-task-log-panel \{([^}]*)\}/);
  assert.ok(panelRule, '面板样式存在');
  assert.match(panelRule[1], /background: #fffdfa/, '浅色底');
  assert.doesNotMatch(panelRule[1], /rgba\(13, 17, 23/, '不得再用深色底');
  assert.match(css, /\.ec-canvas-task-log-filter-row button\.is-active/, '筛选高亮样式');
});
