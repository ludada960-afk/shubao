import assert from 'node:assert/strict';
import test from 'node:test';

import { cleanupLegacyCanvasStorage, formatRetentionStatus } from '../src/pages/Works/retentionModel.js';

test('formats retention state with a market-facing label and available action', () => {
  assert.deepEqual(formatRetentionStatus({ preserved: true }, new Date('2026-07-30T00:00:00.000Z')), {
    label: '已长期保留', action: null, available: true,
  });
  assert.deepEqual(formatRetentionStatus({ expired: true }, new Date('2026-07-30T00:00:00.000Z')), {
    label: '原图已到期', action: '重新生成', available: false,
  });
  assert.deepEqual(formatRetentionStatus(null, new Date('2026-07-30T00:00:00.000Z')), {
    label: '已保存到作品集', action: null, available: true,
  });
});

test('cleans obsolete canvas draft state exactly once without removing durable work caches', () => {
  const store = new Map([
    ['shubao_ec_canvas_state', 'old'],
    ['shubao_ec_draft_indexes', 'old'],
    ['shubao_ec_works', 'durable'],
  ]);
  const storage = { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };

  assert.equal(cleanupLegacyCanvasStorage(storage), true);
  assert.equal(store.has('shubao_ec_canvas_state'), false);
  assert.equal(store.has('shubao_ec_draft_indexes'), false);
  assert.equal(store.get('shubao_ec_works'), 'durable');
  assert.equal(cleanupLegacyCanvasStorage(storage), false);
});
