import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { createCanvasBrowserQaState } from '../src/pages/EcCanvas/canvasBrowserQaState.js';

const canvasPage = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');

test('canvas browser QA state is unavailable outside local development', () => {
  assert.equal(createCanvasBrowserQaState({ enabled: false, search: '?qa=ec-canvas' }), null);
  assert.equal(createCanvasBrowserQaState({ enabled: true, search: '' }), null);
});

test('canvas browser QA state supplies one source and all commerce asset lanes', () => {
  const state = createCanvasBrowserQaState({ enabled: true, search: '?qa=ec-canvas' });

  assert.equal(state.page, 'ec-canvas');
  assert.equal(state.logged, true);
  assert.equal(state.result.browserQa, true);
  assert.equal(state.result.productAssets.length, 1);
  assert.deepEqual(
    state.result.images.map(image => image.key),
    [
      'white-background-01',
      'main-text-01',
      'detail-feature-01',
      'sku-01',
      'transparent-01',
    ],
  );
  assert.deepEqual(
    state.result.images.map(image => image.ratio),
    ['1:1', '1:1', '3:4', '1:1', '1:1'],
  );
});

test('canvas browser QA fixture does not make unauthorized works requests', () => {
  assert.match(canvasPage, /if \(result\?\.browserQa\) \{/);
  assert.match(canvasPage, /setPastWorks\(\[\]\);\s*setTrashWorks\(\[\]\);\s*return;/);
});

test('visual browser QA state opens the visual workbench with a replayable gallery work', () => {
  const state = createCanvasBrowserQaState({ enabled: true, search: '?qa=visual' });

  assert.equal(state.page, 'home');
  assert.equal(state.mode, 'visual');
  assert.equal(state.logged, false);
  assert.equal(state.phone, '');
  assert.equal(state.works.length, 1);
  assert.equal(state.works[0].workType, 'visual');
  assert.equal(state.works[0].replay.skillId, 'social-cover');
  assert.equal(state.works[0].replay.skillControl, '公众号');
  assert.equal(state.works[0].replay.ratio, '21:9');
  assert.equal(state.works[0].replay.referenceAssets.length, 1);
});
