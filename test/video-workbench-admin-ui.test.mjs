import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/pages/AdminConsole/index.jsx', import.meta.url), 'utf8');

test('admin console exposes the owner pilot funnel and operation SLOs', () => {
  assert.match(source, /videoWorkbench/);
  assert.match(source, /storyboardReadyProjects/);
  assert.match(source, /operations24h/);
  assert.match(source, /p95LatencyMs/);
  assert.match(source, /视频工作台 · 站长试运行/);
});
