import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { createCompositionStore } from '../server/projects/compositionStore.mjs';

test('composition revisions are immutable and reject stale optimistic revisions', t => {
  const db = new Database(':memory:');
  t.after(() => db.close());
  ensureProjectSchema(db);
  let sequence = 0;
  const randomUUID = () => `id-${++sequence}`;
  const now = () => new Date('2026-07-27T10:00:00.000Z');
  const projects = createProjectStore(db, { randomUUID, now });
  const compositions = createCompositionStore(db, { randomUUID, now });
  const ownerEmail = 'owner@example.com';
  const project = projects.createProject({ ownerEmail, kind: 'ecommerce' });
  const version = projects.createVersion({ ownerEmail, projectId: project.id, reason: 'generation' });

  const document = compositions.createDocument({
    ownerEmail,
    projectId: project.id,
    versionId: version.id,
    width: 1200,
    height: 1500,
    backgroundAssetId: 'background-1',
    layers: [],
  });
  const next = compositions.saveRevision({
    ownerEmail,
    documentId: document.id,
    expectedRevision: 1,
    layers: [{ id: 'title', kind: 'text', text: '轻盈保湿' }],
  });

  assert.equal(next.revision, 2);
  assert.equal(compositions.getDocument({ ownerEmail, documentId: document.id }).layers[0].text, '轻盈保湿');
  assert.equal(compositions.getDocument({ ownerEmail: 'other@example.com', documentId: document.id }), null);
  assert.throws(
    () => compositions.saveRevision({ ownerEmail, documentId: document.id, expectedRevision: 1, layers: [] }),
    error => error.code === 'VERSION_CONFLICT',
  );
  assert.equal(compositions.listRevisions({ ownerEmail, documentId: document.id }).length, 2);
});

test('links a rendered asset without mutating prior revisions', t => {
  const db = new Database(':memory:');
  t.after(() => db.close());
  ensureProjectSchema(db);
  let sequence = 0;
  const randomUUID = () => `asset-id-${++sequence}`;
  const now = () => new Date('2026-07-27T10:00:00.000Z');
  const projects = createProjectStore(db, { randomUUID, now });
  const compositions = createCompositionStore(db, { randomUUID, now });
  const ownerEmail = 'owner@example.com';
  const project = projects.createProject({ ownerEmail, kind: 'ecommerce' });
  const version = projects.createVersion({ ownerEmail, projectId: project.id, reason: 'generation' });
  const document = compositions.createDocument({ ownerEmail, projectId: project.id, versionId: version.id, width: 1000, height: 1000, layers: [] });

  const linked = compositions.linkRenderedAsset({ ownerEmail, documentId: document.id, revision: 1, renderedAssetId: 'rendered-1' });

  assert.equal(linked.renderedAssetId, 'rendered-1');
  assert.equal(compositions.listRevisions({ ownerEmail, documentId: document.id })[0].renderedAssetId, 'rendered-1');
});

test('atomically stores rendered assets and lists only owner project compositions', t => {
  const db = new Database(':memory:');
  t.after(() => db.close());
  ensureProjectSchema(db);
  let sequence = 0;
  const randomUUID = () => `atomic-id-${++sequence}`;
  const projects = createProjectStore(db, { randomUUID });
  const compositions = createCompositionStore(db, { randomUUID });
  const ownerEmail = 'owner@example.com';
  const project = projects.createProject({ ownerEmail, kind: 'ecommerce' });
  const version = projects.createVersion({ ownerEmail, projectId: project.id, reason: 'generation' });
  const document = compositions.createDocument({
    ownerEmail,
    projectId: project.id,
    versionId: version.id,
    width: 1000,
    height: 1000,
    backgroundAssetId: 'background-1',
    renderedAssetId: 'rendered-1',
    layers: [],
  });
  const next = compositions.saveRevision({
    ownerEmail,
    documentId: document.id,
    expectedRevision: 1,
    renderedAssetId: 'rendered-2',
    layers: [],
  });

  assert.equal(document.renderedAssetId, 'rendered-1');
  assert.equal(next.renderedAssetId, 'rendered-2');
  assert.deepEqual(
    compositions.listDocuments({ ownerEmail, projectId: project.id, versionId: version.id }).map(item => item.id),
    [document.id],
  );
  assert.deepEqual(compositions.listDocuments({ ownerEmail: 'other@example.com', projectId: project.id, versionId: version.id }), []);
});
