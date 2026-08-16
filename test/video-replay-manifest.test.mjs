import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReplayManifest, canonicalReplayManifest } from '../server/videoReplayManifest.mjs';

function graph(overrides = {}) {
  return {
    project: { id: 'project-1', kind: 'video' },
    assets: [{
      id: 'asset-1', kind: 'scene', name: 'studio', status: 'approved', approvedVersionId: 'version-1',
      versions: [{
        id: 'version-1', sequence: 1, sourceProjectAssetId: 'source-1', stableUrl: 'https://cdn.test/a.mp4',
        playbackUrl: 'https://signed.test/secret', contentHash: 'hash-1', mimeType: 'video/mp4', metadata: { ratio: '16:9' },
      }],
    }],
    shots: [{
      id: 'shot-1', position: 1, purpose: 'opening', durationMs: 5000, cameraLanguage: 'wide', prompt: 'open',
      bindings: [{ assetId: 'asset-1', assetVersionId: 'version-1', role: 'scene' }], candidates: [],
    }],
    timelineClips: [],
    ...overrides,
  };
}

test('replay manifest canonical hash is stable and excludes playback URLs', () => {
  const one = buildReplayManifest({
    workbench: graph(), skillId: 'commerce-trailer', skillVersion: 3,
    modelCatalogSnapshot: { seedance: { version: '2.5' } }, rightsConfirmations: ['asset-1'],
  });
  const two = buildReplayManifest({
    workbench: graph({ assets: [{ ...graph().assets[0], versions: [{ ...graph().assets[0].versions[0], playbackUrl: 'different' }] }]}),
    skillId: 'commerce-trailer', skillVersion: 3,
    modelCatalogSnapshot: { seedance: { version: '2.5' } }, rightsConfirmations: [{ assetId: 'asset-1' }],
  });
  assert.equal(one.manifestHash, two.manifestHash);
  assert.equal(canonicalReplayManifest(one).includes('playbackUrl'), false);
  assert.equal(Object.isFrozen(one), true);
});

test('replay manifest requires rights for every asset and a valid graph', () => {
  assert.throws(() => buildReplayManifest({
    workbench: graph(), skillId: 'skill', skillVersion: 1, rightsConfirmations: [],
  }), error => error.code === 'REPLAY_MANIFEST_INVALID');
  assert.throws(() => buildReplayManifest({
    workbench: graph({ project: { id: 'p', kind: 'image' } }), skillId: 'skill', skillVersion: 1, rightsConfirmations: ['asset-1'],
  }), error => error.code === 'REPLAY_MANIFEST_INVALID');
});

test('replay manifest carries a bounded SkillRun recipe snapshot without runtime identity', () => {
  const manifest = buildReplayManifest({
    workbench: graph(),
    skillId: 'commerce-trailer',
    skillVersion: 3,
    rightsConfirmations: ['asset-1'],
    skillRun: {
      id: 'run-internal',
      ownerEmail: 'owner@example.com',
      projectId: 'project-1',
      skillId: 'commerce-trailer',
      skillVersion: 3,
      input: { concept: '耳机广告', ratio: '16:9' },
      plan: {
        steps: [{ id: 'plan', kind: 'plan', label: '拆解镜头', requires: [] }],
        checkpoints: [{ id: 'approve', label: '确认素材' }],
        modelPolicy: { video: 'seedance-2.5' },
        outputContract: { kind: 'storyboard' },
      },
      executionPlan: { completedStepIds: ['plan'], status: 'complete' },
      events: [{ type: 'step.completed', payload: { stepId: 'plan' } }],
    },
  });
  assert.deepEqual(manifest.skillRun, {
    skillId: 'commerce-trailer',
    skillVersion: 3,
    input: { concept: '耳机广告', ratio: '16:9' },
    plan: {
      steps: [{ id: 'plan', kind: 'plan', label: '拆解镜头', requires: [] }],
      checkpoints: [{ id: 'approve', label: '确认素材' }],
      modelPolicy: { video: 'seedance-2.5' },
      outputContract: { kind: 'storyboard' },
    },
    execution: { completedStepIds: ['plan'], status: 'complete' },
  });
  const serialized = JSON.stringify(manifest.skillRun);
  assert.equal(serialized.includes('ownerEmail'), false);
  assert.equal(serialized.includes('run-internal'), false);
  assert.equal(serialized.includes('step.completed'), false);
});
