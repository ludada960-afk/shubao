import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initDB, closeDB, createTask, startTask, updateTaskProgress, completeTask, getTask } from '../server/db.mjs';

test('persists an ecommerce task owner, progress and result in SQLite', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'shubao-task-test-'));
  t.after(async () => { closeDB(); await rm(dir, { recursive: true, force: true }); });
  initDB(join(dir, 'tasks.db'));

  createTask('job_001', '保温杯商品图', '867550189@qq.com');
  startTask('job_001');
  updateTaskProgress('job_001', { step: 'generating', current: 2, total: 6 });
  completeTask('job_001', { images: { main_text_1: '/generated/1.png' } });

  assert.deepEqual(getTask('job_001'), {
    id: 'job_001',
    status: 'done',
    text: '保温杯商品图',
    owner_email: '867550189@qq.com',
    progress: { step: 'generating', current: 2, total: 6 },
    result: { images: { main_text_1: '/generated/1.png' } },
    error: '',
    created_at: getTask('job_001').created_at,
    updated_at: getTask('job_001').updated_at,
  });
});
