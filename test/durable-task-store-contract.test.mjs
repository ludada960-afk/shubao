import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/store/taskStore.jsx', import.meta.url), 'utf8');

test('task context hydrates signed server summaries and refreshes when the page becomes visible', () => {
  assert.match(source, /listEcommerceTasks/);
  assert.match(source, /normalizeDurableTask/);
  assert.match(source, /HYDRATE_DURABLE_TASKS/);
  assert.match(source, /visibilitychange/);
});

test('task context polls only while authenticated and uses active durable state to choose cadence', () => {
  assert.match(source, /hasActiveDurableTasks/);
  assert.match(source, /getSessionToken/);
  assert.match(source, /setInterval/);
  assert.match(source, /CLEAR_DURABLE_TASKS/);
});

test('local reducer updates cannot overwrite server-authoritative task state', () => {
  assert.match(source, /t\.source === 'server'/);
  assert.match(source, /return t;/);
});

test('failed task actions use a quoted server retry instead of resetting local reducer state', () => {
  const sidebar = readFileSync(new URL('../src/components/task/TaskSidebar.jsx', import.meta.url), 'utf8');
  assert.match(sidebar, /quoteFailedEcommerceTask/);
  assert.match(sidebar, /retryFailedEcommerceTask/);
  assert.doesNotMatch(sidebar, /retryTask\(task\.id\)/);
});

test('terminal server tasks use the owner-scoped dismissal API and leave active tasks protected', () => {
  const sidebar = readFileSync(new URL('../src/components/task/TaskSidebar.jsx', import.meta.url), 'utf8');
  assert.match(source, /dismissEcommerceTask/);
  assert.match(source, /DISMISS_DURABLE_TASK/);
  assert.match(sidebar, /task\.actions\?\.includes\('dismiss'\)/);
  assert.match(sidebar, /删除任务记录/);
  assert.doesNotMatch(sidebar, /ACTIVE_STATES\.has\(task\.status\)[\s\S]{0,120}dismissEcommerceTask/);
});
