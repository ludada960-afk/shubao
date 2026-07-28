import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPTY_ECOMMERCE_EDITOR,
  beginDurableProject,
  completeCreationCycle,
  discardLegacyDraftState,
  freshEditorState,
  restoreCheckpointIntoEditor,
  selectInitialEditor,
} from '../src/pages/Home/ec/projectLifecycleModel.js';

test('fresh visits and completed runs always start with the empty ecommerce editor', () => {
  assert.deepEqual(freshEditorState({
    legacySnapshot: { description: '昨天的商品', platform: '淘宝' },
    completedRunId: 'run-1',
  }), EMPTY_ECOMMERCE_EDITOR);
});

test('durable creation records the source input before generation begins', async () => {
  const calls = [];
  const result = await beginDurableProject({
    kind: 'ecommerce',
    title: '陶瓷杯套图',
    inputSnapshot: { description: '陶瓷杯' },
    idempotencyKey: 'draft-1',
    createProject: async input => {
      calls.push(['project', input]);
      return { project: { id: 'project-1' } };
    },
    createVersion: async (projectId, input) => {
      calls.push(['version', { projectId, ...input }]);
      return { version: { id: 'version-1' } };
    },
  });

  assert.equal(result.project.id, 'project-1');
  assert.equal(result.version.id, 'version-1');
  assert.deepEqual(calls.map(([type]) => type), ['project', 'version']);
  assert.deepEqual(calls[1][1].inputSnapshot, { description: '陶瓷杯' });
});

test('completed creation archives output, clears recovery state and returns a fresh editor', async () => {
  const calls = [];
  const result = await completeCreationCycle({
    output: { id: 'work-1' },
    archiveOutput: async output => calls.push(['archive', output.id]),
    clearRecovery: async () => calls.push(['clear']),
  });

  assert.deepEqual(calls, [['archive', 'work-1'], ['clear']]);
  assert.deepEqual(result.editor, EMPTY_ECOMMERCE_EDITOR);
});

test('legacy cleanup runs every registered cleanup without stopping after one failure', async () => {
  const calls = [];
  const result = await discardLegacyDraftState([
    async () => calls.push('first'),
    async () => { calls.push('failed'); throw new Error('old cache unavailable'); },
    async () => calls.push('last'),
  ]);

  assert.deepEqual(calls, ['first', 'failed', 'last']);
  assert.equal(result.cleared, 2);
  assert.equal(result.failed, 1);
});

test('unfinished checkpoints are listed but are not injected into a new editor', () => {
  const checkpoint = {
    id: 'checkpoint-1',
    payload: {
      description: '保留的提示词',
      productParams: { category: '家居百货' },
      platform: '抖音',
    },
  };

  assert.deepEqual(selectInitialEditor({ checkpoints: [checkpoint] }), EMPTY_ECOMMERCE_EDITOR);
  assert.deepEqual(restoreCheckpointIntoEditor(checkpoint), {
    ...EMPTY_ECOMMERCE_EDITOR,
    description: '保留的提示词',
    productParams: { category: '家居百货' },
    platform: '抖音',
  });
});
