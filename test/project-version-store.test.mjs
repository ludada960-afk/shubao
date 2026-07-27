import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';

function ids(...values) {
  let index = 0;
  return () => values[index++] || `id-${index}`;
}

function createHarness() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  ensureProjectSchema(db);
  const store = createProjectStore(db, {
    randomUUID: ids('project-1', 'version-1', 'checkpoint-1', 'canvas-1', 'run-link-1', 'version-2'),
    now: () => new Date('2026-07-27T10:00:00.000Z'),
  });
  return { db, store };
}

test('creates immutable owner-scoped project versions', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());

  const project = store.createProject({ ownerEmail: 'Owner@Example.com', kind: 'ecommerce', title: '夏季水杯' });
  const version = store.createVersion({
    ownerEmail: 'owner@example.com',
    projectId: project.id,
    reason: 'generation',
    inputSnapshot: { prompt: '清爽夏季水杯' },
    planSnapshot: { platform: 'taobao' },
  });

  assert.equal(project.ownerEmail, 'owner@example.com');
  assert.equal(version.sequence, 1);
  assert.equal(store.getProject({ ownerEmail: 'owner@example.com', projectId: project.id }).headVersionId, version.id);
  assert.equal(store.getProject({ ownerEmail: 'other@example.com', projectId: project.id }), null);
  assert.throws(
    () => store.createVersion({ ownerEmail: 'other@example.com', projectId: project.id, reason: 'manual_save' }),
    error => error.code === 'PROJECT_NOT_FOUND',
  );
  assert.deepEqual(version.inputSnapshot, { prompt: '清爽夏季水杯' });
});

test('lists recovery checkpoints without injecting another owner records', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const project = store.createProject({ ownerEmail: 'owner@example.com', kind: 'ecommerce' });
  const version = store.createVersion({ ownerEmail: 'owner@example.com', projectId: project.id, reason: 'generation' });
  const checkpoint = store.createCheckpoint({
    ownerEmail: 'owner@example.com',
    projectId: project.id,
    versionId: version.id,
    reason: 'payment_required',
  });

  assert.equal(store.listCheckpoints({ ownerEmail: 'owner@example.com' })[0].id, checkpoint.id);
  assert.deepEqual(store.listCheckpoints({ ownerEmail: 'other@example.com' }), []);
  assert.equal(store.consumeCheckpoint({ ownerEmail: 'other@example.com', checkpointId: checkpoint.id }), null);
  assert.equal(store.consumeCheckpoint({ ownerEmail: 'owner@example.com', checkpointId: checkpoint.id }).status, 'consumed');
  assert.deepEqual(store.listCheckpoints({ ownerEmail: 'owner@example.com' }), []);
});

test('saves canvas sessions with optimistic revisions and supports explicit discard', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const project = store.createProject({ ownerEmail: 'owner@example.com', kind: 'ecommerce' });
  const version = store.createVersion({ ownerEmail: 'owner@example.com', projectId: project.id, reason: 'canvas_save' });
  const session = store.createCanvasSession({
    ownerEmail: 'owner@example.com',
    projectId: project.id,
    baseVersionId: version.id,
    snapshot: { nodes: [{ id: 'source-1' }], connections: [] },
  });

  const saved = store.saveCanvasSession({
    ownerEmail: 'owner@example.com',
    sessionId: session.id,
    expectedRevision: 1,
    snapshot: { nodes: [{ id: 'source-1' }, { id: 'result-1' }], connections: [{ from: 'source-1', to: 'result-1' }] },
  });
  assert.equal(saved.revision, 2);
  assert.throws(
    () => store.saveCanvasSession({ ownerEmail: 'owner@example.com', sessionId: session.id, expectedRevision: 1, snapshot: {} }),
    error => error.code === 'VERSION_CONFLICT',
  );
  assert.equal(store.discardCanvasSession({ ownerEmail: 'owner@example.com', sessionId: session.id }).status, 'discarded');
});

test('links a generation run and completes a project with an accepted result version', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'owner@example.com';
  const project = store.createProject({ ownerEmail, kind: 'ecommerce' });
  const source = store.createVersion({ ownerEmail, projectId: project.id, reason: 'generation' });
  const run = store.linkGenerationRun({
    ownerEmail,
    projectId: project.id,
    sourceVersionId: source.id,
    generationRunId: 'generation-1',
    kind: 'ecommerce',
    quoteId: 'quote-1',
    holdId: 'hold-1',
  });
  const result = store.createVersion({ ownerEmail, projectId: project.id, parentVersionId: source.id, reason: 'accepted_result' });
  const completed = store.completeProject({ ownerEmail, projectId: project.id, acceptedVersionId: result.id, generationRunId: run.id });

  assert.equal(run.status, 'queued');
  assert.equal(completed.status, 'completed');
  assert.equal(completed.acceptedVersionId, result.id);
  assert.equal(store.listProjects({ ownerEmail })[0].id, project.id);
  assert.deepEqual(store.listProjects({ ownerEmail: 'other@example.com' }), []);
});

test('dismisses an available checkpoint and excludes expired checkpoints', t => {
  const { db, store } = createHarness();
  t.after(() => db.close());
  const ownerEmail = 'owner@example.com';
  const project = store.createProject({ ownerEmail, kind: 'ecommerce' });
  const version = store.createVersion({ ownerEmail, projectId: project.id, reason: 'generation' });
  const checkpoint = store.createCheckpoint({ ownerEmail, projectId: project.id, versionId: version.id, reason: 'session_interrupted' });

  assert.equal(store.dismissCheckpoint({ ownerEmail, checkpointId: checkpoint.id }).status, 'dismissed');
  assert.deepEqual(store.listCheckpoints({ ownerEmail }), []);
});
