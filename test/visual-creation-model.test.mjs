import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VISUAL_CREATION_SKILLS,
  buildVisualCanvasResult,
  buildVisualWorkRecord,
  createVisualRun,
  updateVisualRunSlot,
  visualRetryIndexes,
} from '../src/pages/Home/visualCreationModel.js';

const stableUrl = seed => `/api/generated-assets/${seed.repeat(64).slice(0, 64)}.png`;

test('visual skills explain the transformation before the user selects one', () => {
  assert.deepEqual(VISUAL_CREATION_SKILLS.map(skill => skill.id), [
    'free',
    'poster',
    'social-cover',
    'brand-kv',
  ]);
  for (const skill of VISUAL_CREATION_SKILLS) {
    assert.ok(skill.title);
    assert.ok(skill.outcome);
    assert.ok(skill.preserves);
    assert.ok(skill.bestFor);
    assert.ok(Array.isArray(skill.previews));
    assert.ok(skill.previews.length >= 2);
    assert.ok(skill.previews.every(preview => /^\/images\//.test(preview)));
  }
  assert.equal(VISUAL_CREATION_SKILLS.some(skill => 'persona' in skill), false);
});

test('visual runs keep stable slot request keys and retry only failed slots', () => {
  const initial = createVisualRun({ runId: 'visual-run-1', count: 3, createdAt: 100 });
  assert.deepEqual(initial.slots.map(slot => slot.requestKey), [
    'visual-run-1:1',
    'visual-run-1:2',
    'visual-run-1:3',
  ]);

  const firstDone = updateVisualRunSlot(initial, 0, { status: 'completed', url: stableUrl('a') });
  const secondFailed = updateVisualRunSlot(firstDone, 1, { status: 'failed', error: 'network' });
  const thirdDone = updateVisualRunSlot(secondFailed, 2, { status: 'completed', url: stableUrl('c') });

  assert.equal(initial.slots[0].status, 'pending');
  assert.deepEqual(visualRetryIndexes(thirdDone), [1]);
  assert.equal(thirdDone.slots[0].requestKey, 'visual-run-1:1');
  assert.equal(thirdDone.slots[1].requestKey, 'visual-run-1:2');
});

test('partial success becomes one reviewable visual work and Canvas result', () => {
  let run = createVisualRun({ runId: 'visual-run-2', count: 3, createdAt: 200 });
  run = updateVisualRunSlot(run, 0, { status: 'completed', url: stableUrl('d'), taskId: 'canvas-d' });
  run = updateVisualRunSlot(run, 1, { status: 'failed', error: 'provider unavailable' });
  run = updateVisualRunSlot(run, 2, { status: 'completed', url: stableUrl('e'), taskId: 'canvas-e' });

  const work = buildVisualWorkRecord({
    run,
    prompt: '为夏日音乐节制作一张海报',
    skillId: 'poster',
    model: 'image2',
    ratio: '3:4',
    resolution: '2K',
  });
  assert.equal(work.workType, 'visual');
  assert.equal(work._ecResult, true);
  assert.equal(work._saveKey, 'visual-run-2');
  assert.equal(work.generationStatus, 'needs_review');
  assert.equal(work.images.length, 2);
  assert.ok(work.images.every(image => image.url.startsWith('/api/generated-assets/')));

  const canvas = buildVisualCanvasResult(work, { importId: 'visual-import-1' });
  assert.equal(canvas.workType, 'visual');
  assert.equal(canvas.canvasImportId, 'visual-import-1');
  assert.equal(canvas.imageRecords.length, 2);
  assert.deepEqual(Object.values(canvas.images), work.images.map(image => image.url));
});

test('a visual work cannot persist temporary or data image outputs', () => {
  let run = createVisualRun({ runId: 'visual-run-unsafe', count: 2 });
  run = updateVisualRunSlot(run, 0, { status: 'completed', url: 'blob:https://example.test/unsafe' });
  run = updateVisualRunSlot(run, 1, { status: 'completed', url: 'data:image/png;base64,unsafe' });
  assert.throws(() => buildVisualWorkRecord({ run, prompt: 'unsafe' }), /稳定图片/);
});
