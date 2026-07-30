import assert from 'node:assert/strict';
import test from 'node:test';

import { canvasDraftKey, loadCanvasDraft, saveCanvasDraft } from '../src/pages/EcCanvas/canvasDraftRepository.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('canvas drafts restore a complete snapshot under a stable work key', () => {
  const storage = memoryStorage();
  const key = canvasDraftKey({ _saveKey: 'work / one' });
  const snapshot = { nodes: [{ id: 'a', x: 4 }], connections: [], viewport: { x: 1, y: 2, scale: 1 } };
  assert.equal(saveCanvasDraft(key, snapshot, storage), true);
  assert.deepEqual(loadCanvasDraft(key, storage), { ...snapshot, savedAt: loadCanvasDraft(key, storage).savedAt });
  assert.equal(key, 'sb.canvas.draft.work-one');
});
