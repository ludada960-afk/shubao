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
    audioTracks: [],
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

test('replay manifest preserves a registered template id without runtime identity', () => {
  const manifest = buildReplayManifest({
    workbench: graph(),
    skillId: 'product-advertisement',
    skillVersion: 1,
    rightsConfirmations: ['asset-1'],
    skillRun: {
      id: 'run-template',
      ownerEmail: 'owner@example.com',
      projectId: 'project-1',
      skillId: 'product-advertisement',
      skillVersion: 1,
      templateId: 'product-ad-v1',
      input: { prompt: '制作商品广告' },
      plan: {
        steps: [{ id: 'brief', kind: 'brief', label: '整理目标', requires: [] }],
        checkpoints: [],
        modelPolicy: { strategy: 'capability-fit' },
        outputContract: { maxDurationSeconds: 30 },
      },
      executionPlan: { completedStepIds: [], status: 'ready' },
    },
  });
  assert.equal(manifest.skillRun.templateId, 'product-ad-v1');
  assert.equal(JSON.stringify(manifest.skillRun).includes('run-template'), false);
  assert.equal(JSON.stringify(manifest.skillRun).includes('ownerEmail'), false);
});

test('replay manifest carries sanitized active project memory and omits deleted facts', () => {
  const manifest = buildReplayManifest({
    workbench: graph(),
    skillId: 'commerce-trailer',
    skillVersion: 3,
    rightsConfirmations: ['asset-1'],
    memory: [
      {
        id: 'fact-1', key: 'heroMood', value: { tone: 'warm' }, source: 'user',
        assetRefs: [{ assetId: 'asset-1', assetVersionId: 'version-1' }],
        status: 'active', revision: 2,
        ownerEmail: 'owner@example.com', playbackUrl: 'https://signed.test/secret',
      },
      { id: 'fact-2', key: 'old', value: 'remove', source: 'user', status: 'deleted', revision: 2 },
    ],
  });
  assert.deepEqual(manifest.memory, [{
    key: 'heroMood', value: { tone: 'warm' }, source: 'user',
    assetRefs: [{ assetId: 'asset-1', assetVersionId: 'version-1' }], revision: 2,
  }]);
  assert.equal(JSON.stringify(manifest.memory).includes('ownerEmail'), false);
  assert.equal(JSON.stringify(manifest.memory).includes('signed.test'), false);
});

test('replay manifest carries bounded audio continuity metadata without playback URLs', () => {
  const manifest = buildReplayManifest({
    workbench: graph({ audioTracks: [{
      id: 'track-1', kind: 'voice', assetId: 'asset-1', assetVersionId: 'version-1',
      startMs: 250, durationMs: 4200, volume: 0.8, muted: false, language: 'zh-CN',
      voiceAnchor: '温和近讲', beatMarkers: [0, 1200],
      subtitleCues: [{ startMs: 250, endMs: 1000, text: '你好' }],
      playbackUrl: 'https://signed.test/audio',
    }] }),
    skillId: 'commerce-trailer', skillVersion: 3, rightsConfirmations: ['asset-1'],
  });
  assert.deepEqual(manifest.audioTracks, [{
    id: 'track-1', kind: 'voice', assetId: 'asset-1', assetVersionId: 'version-1',
    startMs: 250, durationMs: 4200, volume: 0.8, muted: false, language: 'zh-CN',
    voiceAnchor: '温和近讲', beatMarkers: [0, 1200],
    subtitleCues: [{ startMs: 250, endMs: 1000, text: '你好' }],
  }]);
  assert.equal(JSON.stringify(manifest.audioTracks).includes('signed.test'), false);
});
