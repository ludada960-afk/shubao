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
