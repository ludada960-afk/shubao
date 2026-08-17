import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSkillRunExecutionPlan, normalizeSkillRunSpec } from '../server/videoSkillRun.mjs';
import {
  buildSkillRunSpecFromTemplate,
  getVideoSkillTemplate,
  listVideoSkillTemplates,
} from '../server/videoSkillTemplates.mjs';

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

test('lists the two proven templates with existing VideoStudio modes', () => {
  const templates = listVideoSkillTemplates();
  assert.deepEqual(templates.map(template => template.templateId), [
    'product-ad-v1',
    'reference-video-reconstruction-v1',
  ]);
  assert.equal(templates[0].mode, 'smart');
  assert.equal(templates[1].mode, 'remake');
  assert.equal(templates[0].sourceWorkflow, 'video-studio.smart');
  assert.equal(templates[1].sourceWorkflow, 'video-studio.remake');
  assert.equal('provider' in templates[0].modelPolicy, false);
  assert.equal('provider' in templates[1].modelPolicy, false);
  assert.notEqual(templates[0].steps.length, 0);
  assert.notEqual(templates[1].checkpoints.length, 0);
});

test('builds a bounded SkillRun spec from the product ad template', () => {
  const template = getVideoSkillTemplate('product-ad-v1');
  assert.deepEqual(template.inputContract.required, ['prompt']);
  const spec = buildSkillRunSpecFromTemplate('product-ad-v1', {
    input: { prompt: '为蓝牙耳机制作 15 秒商品广告', images: [{ assetId: 'asset-1' }] },
  });
  assert.equal(spec.skillId, 'product-advertisement');
  assert.equal(spec.skillVersion, 1);
  assert.equal(spec.templateId, 'product-ad-v1');
  assert.equal(spec.input.prompt, '为蓝牙耳机制作 15 秒商品广告');
  assert.equal(spec.steps.at(-1).id, 'timeline-ready');
  assert.ok(spec.checkpoints.some(checkpoint => checkpoint.id === 'approve-plan'));
});

test('rejects invalid template inputs without invoking providers', () => {
  assert.throws(() => buildSkillRunSpecFromTemplate('product-ad-v1', { input: {} }), /prompt/);
  assert.throws(() => buildSkillRunSpecFromTemplate('reference-video-reconstruction-v1', {
    input: { prompt: '重构', images: [{ assetId: 'image-1' }] },
  }), /reference video/);
  assert.throws(() => buildSkillRunSpecFromTemplate('missing-template', { input: { prompt: 'x' } }), /template/);
});
