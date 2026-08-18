import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isDirectCreationMode,
  normalizeShowcase,
} from '../src/pages/Home/creationShowcaseModel.js';

test('content and visual are direct creation modes while ecommerce and video remain confirmed flows', () => {
  assert.equal(isDirectCreationMode('content'), true);
  assert.equal(isDirectCreationMode('visual'), true);
  assert.equal(isDirectCreationMode('ecommerce'), false);
  assert.equal(isDirectCreationMode('video'), false);
});

test('showcase normalization gives content submodes stable kinds and filters invalid assets', () => {
  const content = normalizeShowcase({ mode: 'content', subMode: 'content' });
  const plog = normalizeShowcase({ mode: 'content', subMode: 'plog' });
  const normalized = normalizeShowcase({
    mode: 'content',
    subMode: 'plog',
    entry: {
      id: 'plog-demo',
      title: '生活碎片',
      assets: [{ src: '/one.png' }, null, { url: '' }, { url: '/two.png' }],
    },
  });

  assert.equal(content.kind, 'content-set');
  assert.equal(plog.kind, 'plog-set');
  assert.deepEqual(normalized.assets, [{ src: '/one.png' }, { url: '/two.png' }]);
  assert.equal(normalized.title, '生活碎片');
});

test('invalid modes fall back to content without mutating supplied entry data', () => {
  const entry = { id: 'demo', kind: 'content-set', assets: [{ src: '/cover.png' }] };
  const normalized = normalizeShowcase({ mode: 'unknown', entry });

  assert.equal(normalized.mode, 'content');
  assert.equal(normalized.id, 'demo');
  assert.deepEqual(entry, { id: 'demo', kind: 'content-set', assets: [{ src: '/cover.png' }] });
});

