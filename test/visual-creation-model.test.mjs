import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VISUAL_CREATION_SKILLS,
  buildVisualCanvasResult,
  buildVisualWorkRecord,
  createVisualRun,
  resolveVisualSkillRatio,
  updateVisualRunSlot,
  visualRetryIndexes,
} from '../src/pages/Home/visualCreationModel.js';
import { buildGalleryRemixCheckpoint } from '../src/pages/Home/galleryRemixModel.js';

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
    assert.match(skill.preview, /^\/images\/visual-recipes\/(?:free|poster|social-cover|brand-kv)\.png$/);
    assert.doesNotMatch(skill.preview, /reference-card-/);
    assert.equal(skill.showcases.length, 2);
    assert.ok(skill.showcases.every(showcase => showcase.title && showcase.description));
    assert.ok(skill.showcases.every(showcase => showcase.assets?.length >= 3));
    assert.ok(skill.showcases.every(showcase => showcase.layout?.type));
    assert.ok(skill.showcases.every(showcase => showcase.assets.every(asset => asset.src && asset.ratio)));
    assert.ok(skill.control?.label);
    assert.ok(skill.control?.options?.length >= 2);
  }
  assert.equal(VISUAL_CREATION_SKILLS.some(skill => 'persona' in skill), false);
});

test('visual recipes expose platform-native ratios and a reusable generation snapshot', () => {
  const social = VISUAL_CREATION_SKILLS.find(skill => skill.id === 'social-cover');
  assert.deepEqual(social.control.options, ['小红书', '公众号', 'B站', '抖音']);
  assert.deepEqual(social.ratios, ['3:4', '21:9', '16:9', '9:16']);
  assert.ok(social.panels.some(panel => panel.id === 'platform'));
  assert.ok(social.panels.some(panel => panel.id === 'headline'));

  let run = createVisualRun({ runId: 'visual-remix-1', count: 1 });
  run = updateVisualRunSlot(run, 0, {
    status: 'completed',
    url: stableUrl('a'),
    taskId: 'task-remix-1',
    replay: { requestKey: 'visual-remix-1:1', prompt: '平台原生封面', ratio: '21:9', resolution: '2K', imageModel: 'image2', skillId: 'social-cover' },
  });
  const work = buildVisualWorkRecord({
    run,
    prompt: '平台原生封面',
    skillId: 'social-cover',
    model: 'image2',
    ratio: '21:9',
    resolution: '2K',
    referenceAssets: [{ assetId: 'ref-1', url: '/api/generated-assets/ref-1.png' }],
    skillControl: '公众号',
    panelValues: { headline: '一篇文章的核心观点' },
  });
  assert.equal(work.replay.skillId, 'social-cover');
  assert.equal(work.replay.ratio, '21:9');
  assert.equal(work.replay.skillControl, '公众号');
  assert.deepEqual(work.replay.referenceAssets, [{ assetId: 'ref-1', url: '/api/generated-assets/ref-1.png' }]);
  assert.equal(work.images[0].taskId, 'task-remix-1');
});

test('visual skill ratio falls back to a ratio supported by the selected recipe', () => {
  assert.equal(resolveVisualSkillRatio('social-cover', '21:9'), '21:9');
  assert.equal(resolveVisualSkillRatio('poster', '21:9'), '3:4');
  assert.equal(resolveVisualSkillRatio('brand-kv', '4:3'), '16:9');
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

test('visual work replay becomes a visual gallery checkpoint instead of an ecommerce remix', () => {
  const checkpoint = buildGalleryRemixCheckpoint({
    id: 'visual-gallery-1',
    type: 'visual',
    title: '平台原生封面',
    visualSkillId: 'social-cover',
    prompt: '为公众号制作横幅头图',
    ratio: '21:9',
    resolution: '2K',
    imageModel: 'image2',
    images: [{ url: '/api/generated-assets/gallery-1.png', ratio: '21:9' }],
    referenceAssets: [{ assetId: 'ref-1', url: '/api/generated-assets/ref-1.png' }],
    replay: { skillId: 'social-cover', skillControl: '公众号', panelValues: { headline: '结果先行' } },
  });
  assert.equal(checkpoint.project.kind, 'visual');
  assert.equal(checkpoint.version.inputSnapshot.skillId, 'social-cover');
  assert.equal(checkpoint.version.inputSnapshot.ratio, '21:9');
  assert.equal(checkpoint.version.inputSnapshot.skillControl, '公众号');
  assert.deepEqual(checkpoint.version.inputSnapshot.referenceAssets, [{ assetId: 'ref-1', url: '/api/generated-assets/ref-1.png' }]);
});
