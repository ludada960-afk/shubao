import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeSkillRunSpec } from '../server/videoSkillRun.mjs';

test('normalizes a bounded declarative skill run spec', () => {
  const spec = normalizeSkillRunSpec({
    skillId: '  product-trailer  ',
    skillVersion: 2,
    input: { concept: '耳机广告', ignored: undefined },
    steps: [{ id: 'world', kind: 'plan', label: '建立世界观' }],
    checkpoints: [{ id: 'approve-assets', label: '确认素材' }],
    modelPolicy: { image: 'gpt-image-2' },
    outputContract: { kind: 'storyboard' },
  });
  assert.deepEqual(spec, {
    skillId: 'product-trailer',
    skillVersion: 2,
    input: { concept: '耳机广告' },
    steps: [{ id: 'world', kind: 'plan', label: '建立世界观', requires: [] }],
    checkpoints: [{ id: 'approve-assets', label: '确认素材' }],
    modelPolicy: { image: 'gpt-image-2' },
    outputContract: { kind: 'storyboard' },
  });
});

test('rejects invalid or oversized skill run specs', () => {
  assert.throws(() => normalizeSkillRunSpec({ skillId: '', skillVersion: 1 }),
    error => error.code === 'INVALID_SKILL_RUN');
  assert.throws(() => normalizeSkillRunSpec({ skillId: 'x', skillVersion: 1, steps: Array.from({ length: 33 }, (_, i) => ({ id: `s${i}`, kind: 'plan', label: 'x' })) }),
    error => error.code === 'INVALID_SKILL_RUN');
});
