import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSkillRunExecutionPlan, normalizeSkillRunSpec } from '../server/videoSkillRun.mjs';

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

test('rejects cyclic step dependencies', () => {
  assert.throws(() => normalizeSkillRunSpec({
    skillId: 'cycle',
    skillVersion: 1,
    steps: [
      { id: 'a', kind: 'plan', label: 'A', requires: ['b'] },
      { id: 'b', kind: 'plan', label: 'B', requires: ['a'] },
    ],
  }), error => error.code === 'INVALID_SKILL_RUN');
});

test('builds a deterministic DAG execution plan', () => {
  const spec = normalizeSkillRunSpec({
    skillId: 'trailer',
    skillVersion: 1,
    steps: [
      { id: 'plan', kind: 'plan', label: 'Plan' },
      { id: 'assets', kind: 'assets', label: 'Assets', requires: ['plan'] },
      { id: 'shots', kind: 'shots', label: 'Shots', requires: ['assets'] },
      { id: 'export', kind: 'export', label: 'Export', requires: ['shots'] },
    ],
  });
  assert.deepEqual(buildSkillRunExecutionPlan(spec), {
    completedStepIds: [],
    readyStepIds: ['plan'],
    blockedStepIds: ['assets', 'shots', 'export'],
    status: 'ready',
  });
  assert.deepEqual(buildSkillRunExecutionPlan(spec, { completedStepIds: ['plan', 'assets'] }), {
    completedStepIds: ['plan', 'assets'],
    readyStepIds: ['shots'],
    blockedStepIds: ['export'],
    status: 'ready',
  });
  assert.deepEqual(buildSkillRunExecutionPlan(spec, { completedStepIds: ['plan', 'assets', 'shots', 'export'] }), {
    completedStepIds: ['plan', 'assets', 'shots', 'export'],
    readyStepIds: [],
    blockedStepIds: [],
    status: 'complete',
  });
});

test('rejects unknown completed steps', () => {
  const spec = normalizeSkillRunSpec({
    skillId: 'bounded',
    skillVersion: 1,
    steps: [{ id: 'plan', kind: 'plan', label: 'Plan' }],
  });
  assert.throws(() => buildSkillRunExecutionPlan(spec, { completedStepIds: ['missing'] }),
    error => error.code === 'INVALID_SKILL_RUN_STATE');
});
