import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONTENT_REFERENCE_LIMITS,
  normalizeReferenceGroups,
  referenceUsageLabel,
  selectSourceInputs,
} from '../server/contentReferenceRouter.mjs';

const style = ['style-a', 'style-b', 'style-c', 'style-d'];
const source = ['source-a', 'source-b', 'source-c', 'source-d', 'source-e', 'source-f', 'source-g'];

test('reference groups keep style and source semantics with bounded limits', () => {
  const groups = normalizeReferenceGroups({ style, source });
  assert.equal(CONTENT_REFERENCE_LIMITS.style, 3);
  assert.equal(CONTENT_REFERENCE_LIMITS.source, 6);
  assert.deepEqual(groups.style, style.slice(0, 3));
  assert.deepEqual(groups.source, source.slice(0, 6));
});

test('legacy reference ids remain style references', () => {
  assert.deepEqual(normalizeReferenceGroups({ referenceAssetIds: ['legacy-a', 'legacy-b'] }), {
    style: ['legacy-a', 'legacy-b'],
    source: [],
  });
});

test('style-only tasks never receive source inputs', () => {
  const groups = { style, source };
  assert.deepEqual(selectSourceInputs({ groups, task: { id: 'p1', reference_use: 'none' } }), []);
  assert.deepEqual(selectSourceInputs({ groups, task: { id: 'p2', reference_use: 'style' } }), []);
});

test('one source can be reused for subject continuity and a cover can use a small source set', () => {
  const groups = { style: [], source: ['source-a'] };
  assert.deepEqual(selectSourceInputs({ groups, task: { id: 'cover', reference_use: 'subject' } }), ['source-a']);
  assert.deepEqual(selectSourceInputs({ groups, task: { id: 'p1', reference_use: 'subject' } }), ['source-a']);
});

test('multiple sources are selected per task and only comparison tasks receive two', () => {
  const groups = { style: [], source: ['source-a', 'source-b', 'source-c'] };
  assert.deepEqual(selectSourceInputs({ groups, task: { id: 'cover', reference_use: 'subject' } }), ['source-a', 'source-b', 'source-c']);
  assert.deepEqual(selectSourceInputs({ groups, task: { id: 'p1', index: 1, reference_use: 'subject' } }), ['source-a']);
  assert.deepEqual(selectSourceInputs({ groups, task: { id: 'p2', index: 2, reference_use: 'comparison' } }), ['source-b', 'source-c']);
});

test('usage label explains the actual generation path', () => {
  assert.equal(referenceUsageLabel({ style: ['s'], source: [] }), '借鉴风格参考的色调、光线和构图；本组按主题自由生成');
  assert.equal(referenceUsageLabel({ style: ['s'], source: ['m'] }), '保留我的素材主体，并借鉴风格参考的色调、光线和构图');
  assert.equal(referenceUsageLabel({ style: [], source: ['m'] }), '保留我的素材主体，按主题生成不同场景和镜头');
});
