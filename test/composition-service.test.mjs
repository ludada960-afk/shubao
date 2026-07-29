import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import Database from 'better-sqlite3';
import sharp from 'sharp';

import { createCompositionService } from '../server/composition/compositionService.mjs';
import { createCompositionStore } from '../server/projects/compositionStore.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import { ensureProjectSchema } from '../server/projects/schema.mjs';

function createMemoryAssetStore(seed = {}) {
  const assets = new Map(Object.entries(seed));
  const persisted = [];
  return {
    persisted,
    async persistBuffer({ buffer, contentType, taskId, label }) {
      assert.ok(Buffer.isBuffer(buffer));
      const id = `${crypto.createHash('sha256').update(buffer).digest('hex')}.png`;
      assets.set(id, { buffer: Buffer.from(buffer), contentType });
      persisted.push({ id, buffer: Buffer.from(buffer), contentType, taskId, label });
      return { id, url: `/api/generated-assets/${id}`, contentType, taskId, label };
    },
    async read(assetId) {
      const asset = assets.get(assetId);
      return asset ? { buffer: Buffer.from(asset.buffer), contentType: asset.contentType } : null;
    },
  };
}

async function setup(t) {
  const db = new Database(':memory:');
  t.after(() => db.close());
  ensureProjectSchema(db);
  let sequence = 0;
  const randomUUID = () => `composition-id-${++sequence}`;
  const now = () => new Date('2026-07-29T09:00:00.000Z');
  const projectStore = createProjectStore(db, { randomUUID, now });
  const compositionStore = createCompositionStore(db, { randomUUID, now });
  const ownerEmail = 'owner@example.com';
  const project = projectStore.createProject({ ownerEmail, kind: 'ecommerce' });
  const version = projectStore.createVersion({
    ownerEmail,
    projectId: project.id,
    reason: 'generation',
  });
  const background = await sharp({
    create: { width: 800, height: 600, channels: 4, background: '#f4f1ea' },
  }).png().toBuffer();
  const product = await sharp({
    create: { width: 240, height: 300, channels: 4, background: '#cc3344' },
  }).png().toBuffer();
  const generatedAssetStore = createMemoryAssetStore({
    'background.png': { buffer: background, contentType: 'image/png' },
    'product.png': { buffer: product, contentType: 'image/png' },
  });
  let billingCalls = 0;
  const service = createCompositionService({
    compositionStore,
    generatedAssetStore,
    billing: { charge: () => { billingCalls += 1; } },
  });
  return {
    service,
    compositionStore,
    generatedAssetStore,
    ownerEmail,
    project,
    version,
    billingCalls: () => billingCalls,
  };
}

function layers(text) {
  return [
    {
      id: 'product',
      kind: 'image',
      assetId: 'product.png',
      x: 280,
      y: 210,
      width: 240,
      height: 300,
    },
    {
      id: 'title',
      kind: 'text',
      text,
      fontId: 'fallback-sans',
      fontSize: 64,
      color: '#111111',
      width: 640,
      align: 'center',
      lineHeight: 1.2,
      x: 80,
      y: 72,
    },
  ];
}

test('composition edits create immutable revisions and stable PNG assets without AI billing', async t => {
  const context = await setup(t);
  const created = await context.service.createDocument({
    ownerEmail: context.ownerEmail,
    projectId: context.project.id,
    versionId: context.version.id,
    width: 800,
    height: 600,
    backgroundAssetId: 'background.png',
    layers: layers('初稿'),
  });
  const updated = await context.service.saveRevision({
    ownerEmail: context.ownerEmail,
    documentId: created.document.id,
    expectedRevision: 1,
    layers: layers('轻盈保湿'),
  });

  const revisions = context.compositionStore.listRevisions({
    ownerEmail: context.ownerEmail,
    documentId: created.document.id,
  });
  assert.equal(created.document.revision, 1);
  assert.equal(updated.document.revision, 2);
  assert.equal(revisions.length, 2);
  assert.equal(revisions[0].layers[1].text, '初稿');
  assert.equal(revisions[1].layers[1].text, '轻盈保湿');
  assert.notEqual(revisions[0].renderedAssetId, revisions[1].renderedAssetId);
  assert.equal(context.billingCalls(), 0);
  assert.equal(context.generatedAssetStore.persisted.length, 2);
  for (const output of context.generatedAssetStore.persisted) {
    assert.equal(output.contentType, 'image/png');
    const metadata = await sharp(output.buffer).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.width, 800);
    assert.equal(metadata.height, 600);
  }
});

test('composition service enforces owner scope and validates document and layer numbers', async t => {
  const context = await setup(t);
  const created = await context.service.createDocument({
    ownerEmail: context.ownerEmail,
    projectId: context.project.id,
    versionId: context.version.id,
    width: 800,
    height: 600,
    layers: layers('仅所有者可编辑'),
  });

  assert.equal(context.service.getDocument({
    ownerEmail: 'other@example.com',
    documentId: created.document.id,
  }), null);
  await assert.rejects(
    () => context.service.saveRevision({
      ownerEmail: 'other@example.com',
      documentId: created.document.id,
      expectedRevision: 1,
      layers: layers('越权编辑'),
    }),
    error => error.code === 'DOCUMENT_NOT_FOUND',
  );
  await assert.rejects(
    () => context.service.createDocument({
      ownerEmail: context.ownerEmail,
      projectId: context.project.id,
      versionId: context.version.id,
      width: '800',
      height: 600,
      layers: [],
    }),
    /width/,
  );
  await assert.rejects(
    () => context.service.saveRevision({
      ownerEmail: context.ownerEmail,
      documentId: created.document.id,
      expectedRevision: 1,
      layers: [{ ...layers('坏尺寸')[0], x: Number.POSITIVE_INFINITY }],
    }),
    /x/,
  );
  await assert.rejects(
    () => context.service.saveRevision({
      ownerEmail: context.ownerEmail,
      documentId: created.document.id,
      expectedRevision: 1,
      layers: layers('越界文字').map(layer => layer.kind === 'text' ? { ...layer, y: 590 } : layer),
    }),
    /height/,
  );
  assert.equal(context.compositionStore.listRevisions({
    ownerEmail: context.ownerEmail,
    documentId: created.document.id,
  }).length, 1);
  await assert.rejects(
    () => context.service.saveRevision({
      ownerEmail: context.ownerEmail,
      documentId: created.document.id,
      expectedRevision: 1,
      layers: layers('无效颜色').map(layer => layer.kind === 'text' ? { ...layer, color: 'not-a-color' } : layer),
    }),
    /color/,
  );
  assert.equal(context.compositionStore.listRevisions({
    ownerEmail: context.ownerEmail,
    documentId: created.document.id,
  }).length, 1);
});
