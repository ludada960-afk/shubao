import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createExportDeliveryState,
  exportDeliveryReducer,
} from '../src/pages/EcCanvas/exportDeliveryModel.js';

test('export delivery waits for an explicit start after destination selection', () => {
  const initial = createExportDeliveryState();
  const ready = exportDeliveryReducer(initial, {
    type: 'destination-ready',
    destination: { strategy: 'directory', name: '交付目录' },
  });
  assert.equal(ready.status, 'destination-ready');
  assert.equal(ready.destination.name, '交付目录');
  assert.equal(ready.progress.completed, 0);

  const preparing = exportDeliveryReducer(ready, { type: 'preparing', total: 3 });
  assert.equal(preparing.status, 'preparing');
  assert.deepEqual(preparing.progress, { completed: 0, total: 3 });
});
test('export delivery preserves configuration and destination across errors and repeat export', () => {
  const configured = createExportDeliveryState({ mode: 'long-detail', format: 'PNG' });
  const ready = exportDeliveryReducer(configured, {
    type: 'destination-ready',
    destination: { strategy: 'save-file', name: '详情长图.png' },
  });
  const failed = exportDeliveryReducer(ready, { type: 'error', error: '磁盘空间不足' });
  assert.equal(failed.status, 'error');
  assert.equal(failed.config.mode, 'long-detail');
  assert.equal(failed.destination.name, '详情长图.png');

  const retry = exportDeliveryReducer(failed, { type: 'destination-ready', destination: failed.destination });
  assert.equal(retry.status, 'destination-ready');
  assert.equal(retry.error, '');
});

test('writing progress success cancellation and reset are explicit terminal states', () => {
  let state = createExportDeliveryState();
  state = exportDeliveryReducer(state, { type: 'writing', total: 2 });
  state = exportDeliveryReducer(state, { type: 'progress', completed: 1, total: 2 });
  assert.equal(state.status, 'writing');
  assert.deepEqual(state.progress, { completed: 1, total: 2 });
  state = exportDeliveryReducer(state, { type: 'success', count: 2 });
  assert.equal(state.status, 'success');
  assert.equal(state.result.count, 2);
  state = exportDeliveryReducer(state, { type: 'cancelled' });
  assert.equal(state.status, 'cancelled');
  state = exportDeliveryReducer(state, { type: 'reset', config: { mode: 'images', format: 'JPG' } });
  assert.equal(state.status, 'configuring');
  assert.equal(state.config.format, 'JPG');
});
