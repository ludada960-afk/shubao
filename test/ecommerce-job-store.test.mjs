import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { createEcommerceJobStore } from '../server/ecommerceEngine/jobStore.mjs';

function createHarness(t, options = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'shubao-ecommerce-job-'));
  const dbPath = join(directory, 'jobs.db');
  const db = new Database(dbPath);
  const store = createEcommerceJobStore(db, options);
  t.after(() => {
    try { db.close(); } catch {}
    rmSync(directory, { recursive: true, force: true });
  });
  return { directory, dbPath, db, store };
}

test('persists provider state and recovers active assets without resetting completed assets', t => {
  const { dbPath, db, store } = createHarness(t);
  store.createAsset({
    jobId: 'job-one',
    assetId: 'main',
    requestSnapshot: {
      model: 'gpt-image-2',
      apiKey: 'must-not-persist',
      image: Buffer.from('raw-image'),
      localPath: 'C:\\private\\product.png',
      nested: { Authorization: 'Bearer secret', prompt: 'safe prompt' },
    },
  });
  const claimed = store.claimAsset('job-one', 'main', { leaseMs: 60_000 });
  store.markSubmitted('job-one', 'main', {
    providerJobId: 'provider-one',
    leaseToken: claimed.leaseToken,
  });
  store.transitionAsset('job-one', 'main', 'polling', {
    outputUrl: 'https://provider.example.test/pending.png',
    attemptCount: 1,
    leaseToken: claimed.leaseToken,
  });

  store.createAsset({ jobId: 'job-one', assetId: 'done', requestSnapshot: { prompt: 'done' } });
  const completedLease = store.claimAsset('job-one', 'done', { leaseMs: 60_000 });
  store.transitionAsset('job-one', 'done', 'submitted', {
    providerJobId: 'provider-done',
    leaseToken: completedLease.leaseToken,
  });
  store.transitionAsset('job-one', 'done', 'polling', { leaseToken: completedLease.leaseToken });
  store.transitionAsset('job-one', 'done', 'downloading', {
    outputUrl: 'https://provider.example.test/done.png',
    leaseToken: completedLease.leaseToken,
  });
  store.transitionAsset('job-one', 'done', 'quality_check', {
    stableUrl: '/api/generated-assets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png',
    leaseToken: completedLease.leaseToken,
  });
  store.transitionAsset('job-one', 'done', 'completed', { leaseToken: completedLease.leaseToken });

  const snapshot = store.getAsset('job-one', 'main').requestSnapshot;
  assert.deepEqual(snapshot, { model: 'gpt-image-2', nested: { prompt: 'safe prompt' } });
  db.close();

  const reopened = new Database(dbPath);
  const restarted = createEcommerceJobStore(reopened);
  const recoverable = restarted.recoverInterrupted();

  assert.deepEqual(recoverable.map(item => [item.assetId, item.state]), [['main', 'polling']]);
  assert.equal(restarted.getAsset('job-one', 'main').providerJobId, 'provider-one');
  assert.equal(restarted.getAsset('job-one', 'main').attemptCount, 1);
  assert.equal(restarted.getAsset('job-one', 'done').state, 'completed');
  reopened.close();
});

test('keeps submitted provider ids idempotent and rejects accidental resubmission', t => {
  const { store } = createHarness(t);
  store.createAsset({ jobId: 'job-two', assetId: 'main' });
  const lease = store.claimAsset('job-two', 'main');

  const first = store.markSubmitted('job-two', 'main', {
    providerJobId: 'provider-two',
    requestSnapshot: { prompt: 'safe' },
    leaseToken: lease.leaseToken,
  });
  const repeated = store.markSubmitted('job-two', 'main', {
    providerJobId: 'provider-two',
    requestSnapshot: { prompt: 'safe' },
    leaseToken: lease.leaseToken,
  });

  assert.deepEqual(repeated, first);
  assert.throws(() => store.markSubmitted('job-two', 'main', {
    providerJobId: 'provider-other',
    leaseToken: lease.leaseToken,
  }), /already submitted|provider job/i);
});

test('checkpoints a sanitized submission intent without changing state or losing its fenced lease', t => {
  const { store } = createHarness(t);
  store.createAsset({ jobId: 'job-intent', assetId: 'main', requestSnapshot: { assetPlanItem: { id: 'main' } } });
  const lease = store.claimAsset('job-intent', 'main');

  const checkpointed = store.checkpointAsset('job-intent', 'main', {
    requestSnapshot: {
      assetPlanItem: { id: 'main' },
      submissionIntents: [{
        assetId: 'main',
        ordinal: 0,
        kind: 'initial',
        idempotencyKey: 'ecommerce:fixed-intent',
        status: 'intent',
        apiKey: 'must-not-persist',
      }],
    },
    leaseToken: lease.leaseToken,
  });

  assert.equal(checkpointed.state, 'queued');
  assert.equal(checkpointed.leaseToken, lease.leaseToken);
  assert.deepEqual(checkpointed.requestSnapshot.submissionIntents, [{
    assetId: 'main',
    ordinal: 0,
    kind: 'initial',
    idempotencyKey: 'ecommerce:fixed-intent',
    status: 'intent',
  }]);
});

test('uses fenced leases so an expired worker cannot mutate a reclaimed asset', t => {
  let now = Date.parse('2026-07-26T00:00:00.000Z');
  let uuid = 0;
  const { store } = createHarness(t, {
    now: () => now,
    randomUUID: () => `lease-${++uuid}`,
  });
  store.createAsset({ jobId: 'job-three', assetId: 'main' });

  const first = store.claimAsset('job-three', 'main', { leaseMs: 100 });
  now += 101;
  const second = store.claimAsset('job-three', 'main', { leaseMs: 100 });

  assert.notEqual(first.leaseToken, second.leaseToken);
  assert.throws(() => store.transitionAsset('job-three', 'main', 'submitted', {
    providerJobId: 'stale-provider',
    leaseToken: first.leaseToken,
  }), /lease/i);
  assert.equal(store.transitionAsset('job-three', 'main', 'submitted', {
    providerJobId: 'fresh-provider',
    leaseToken: second.leaseToken,
  }).providerJobId, 'fresh-provider');
});

test('preserves polling downloading and quality-check states as restart recovery work', t => {
  const { store } = createHarness(t);
  for (const [index, state] of ['submitted', 'polling', 'downloading', 'quality_check'].entries()) {
    const assetId = `asset-${index}`;
    store.createAsset({ jobId: 'job-four', assetId });
    const lease = store.claimAsset('job-four', assetId);
    store.transitionAsset('job-four', assetId, 'submitted', {
      providerJobId: `provider-${index}`,
      leaseToken: lease.leaseToken,
    });
    if (state === 'polling' || state === 'downloading' || state === 'quality_check') {
      store.transitionAsset('job-four', assetId, 'polling', { leaseToken: lease.leaseToken });
    }
    if (state === 'downloading' || state === 'quality_check') {
      store.transitionAsset('job-four', assetId, 'downloading', {
        outputUrl: `https://provider.example.test/${index}.png`,
        leaseToken: lease.leaseToken,
      });
    }
    if (state === 'quality_check') {
      store.transitionAsset('job-four', assetId, 'quality_check', {
        stableUrl: `/api/generated-assets/${String(index).padStart(64, '0')}.png`,
        leaseToken: lease.leaseToken,
      });
    }
  }

  assert.deepEqual(
    store.recoverInterrupted().map(item => item.state).sort(),
    ['downloading', 'polling', 'quality_check', 'submitted'],
  );
});

test('keeps a quality-approved asset verified and recoverable until the full suite is settled', t => {
  const { store } = createHarness(t);
  store.createAsset({ jobId: 'job-verified', assetId: 'main' });
  const lease = store.claimAsset('job-verified', 'main');
  store.transitionAsset('job-verified', 'main', 'submitted', {
    providerJobId: 'provider-verified',
    leaseToken: lease.leaseToken,
  });
  store.transitionAsset('job-verified', 'main', 'polling', { leaseToken: lease.leaseToken });
  store.transitionAsset('job-verified', 'main', 'downloading', {
    outputUrl: 'https://provider.example.test/verified.png',
    leaseToken: lease.leaseToken,
  });
  store.transitionAsset('job-verified', 'main', 'quality_check', {
    stableUrl: '/api/generated-assets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png',
    leaseToken: lease.leaseToken,
  });
  const verified = store.transitionAsset('job-verified', 'main', 'verified', {
    leaseToken: lease.leaseToken,
  });

  assert.equal(verified.state, 'verified');
  assert.equal(verified.leaseToken, null);
  assert.deepEqual(store.recoverInterrupted().map(item => item.state), ['verified']);
  const settlementLease = store.claimAsset('job-verified', 'main');
  assert.equal(store.transitionAsset('job-verified', 'main', 'settling', {
    leaseToken: settlementLease.leaseToken,
  }).state, 'settling');
});

test('ignores inherited identifiers and rejects unsafe state transitions', t => {
  const { store } = createHarness(t);
  const inherited = Object.create({ jobId: 'prototype-job', assetId: 'prototype-asset' });
  assert.throws(() => store.createAsset(inherited), /jobId|assetId/i);

  store.createAsset({ jobId: 'job-five', assetId: 'main' });
  const lease = store.claimAsset('job-five', 'main');
  assert.throws(() => store.transitionAsset('job-five', 'main', 'completed', {
    leaseToken: lease.leaseToken,
  }), /invalid transition/i);
});

test('fences a transition when the persisted state changes after it was read', t => {
  const { db, store } = createHarness(t);
  store.createAsset({ jobId: 'job-six', assetId: 'main' });
  const lease = store.claimAsset('job-six', 'main');
  const patch = {
    leaseToken: lease.leaseToken,
    get providerJobId() {
      db.prepare(`
        UPDATE ecommerce_job_assets
        SET state = 'failed'
        WHERE job_id = 'job-six' AND asset_id = 'main'
      `).run();
      return 'provider-six';
    },
  };

  assert.throws(() => store.transitionAsset('job-six', 'main', 'submitted', patch), /state|lease changed/i);
  assert.equal(store.getAsset('job-six', 'main').state, 'failed');
});

test('allows a needs-review asset to be reclaimed for an explicit repair', t => {
  const { store } = createHarness(t);
  store.createAsset({ jobId: 'job-seven', assetId: 'main' });
  const first = store.claimAsset('job-seven', 'main');
  store.transitionAsset('job-seven', 'main', 'submitted', {
    providerJobId: 'provider-seven',
    leaseToken: first.leaseToken,
  });
  store.transitionAsset('job-seven', 'main', 'polling', { leaseToken: first.leaseToken });
  store.transitionAsset('job-seven', 'main', 'downloading', {
    outputUrl: 'https://provider.example.test/seven.png',
    leaseToken: first.leaseToken,
  });
  store.transitionAsset('job-seven', 'main', 'quality_check', {
    stableUrl: '/api/generated-assets/7777777777777777777777777777777777777777777777777777777777777777.png',
    leaseToken: first.leaseToken,
  });
  const needsReview = store.transitionAsset('job-seven', 'main', 'needs_review', {
    leaseToken: first.leaseToken,
  });
  assert.equal(needsReview.leaseToken, null);

  const second = store.claimAsset('job-seven', 'main');
  assert.ok(second?.leaseToken);
  assert.equal(store.transitionAsset('job-seven', 'main', 'repairing', {
    leaseToken: second.leaseToken,
  }).state, 'repairing');
});

test('allows a repairing asset to persist a new provider job without duplicate resubmission', t => {
  const { store } = createHarness(t);
  store.createAsset({ jobId: 'job-eight', assetId: 'main' });
  const lease = store.claimAsset('job-eight', 'main');
  store.markSubmitted('job-eight', 'main', {
    providerJobId: 'provider-eight-first',
    leaseToken: lease.leaseToken,
  });
  store.transitionAsset('job-eight', 'main', 'polling', { leaseToken: lease.leaseToken });
  store.transitionAsset('job-eight', 'main', 'downloading', {
    outputUrl: 'https://provider.example.test/eight-first.png',
    leaseToken: lease.leaseToken,
  });
  store.transitionAsset('job-eight', 'main', 'quality_check', {
    stableUrl: '/api/generated-assets/8888888888888888888888888888888888888888888888888888888888888888.png',
    leaseToken: lease.leaseToken,
  });
  store.transitionAsset('job-eight', 'main', 'repairing', { leaseToken: lease.leaseToken });

  const repaired = store.markSubmitted('job-eight', 'main', {
    providerJobId: 'provider-eight-second',
    requestSnapshot: { prompt: 'targeted repair' },
    leaseToken: lease.leaseToken,
  });
  assert.equal(repaired.providerJobId, 'provider-eight-second');
  assert.equal(repaired.attemptCount, 1);
  assert.deepEqual(repaired.requestSnapshot, { prompt: 'targeted repair' });
  assert.throws(() => store.markSubmitted('job-eight', 'main', {
    providerJobId: 'provider-eight-third',
    leaseToken: lease.leaseToken,
  }), /already submitted|provider job/i);
});


test('includes still-queued assets in restart recovery so abandoned jobs resume', t => {
  const { store } = createHarness(t);
  store.createAsset({ jobId: 'job-queued', assetId: 'main', requestSnapshot: { prompt: 'p' } });

  const restarted = store.recoverInterrupted();
  assert.deepEqual(restarted.map(item => [item.assetId, item.state]), [['main', 'queued']]);
});
