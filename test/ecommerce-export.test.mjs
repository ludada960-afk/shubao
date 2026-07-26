import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import Database from 'better-sqlite3';
import sharp from 'sharp';

import { createGeneratedAssetStore } from '../server/generatedAssets.mjs';
import { buildAssetPlan } from '../server/ecommerceEngine/assetPlanner.mjs';
import { createEcommerceAssetUploadService } from '../server/ecommerceEngine/assetUpload.mjs';
import {
  EXPORT_TRANSFORM_VERSION,
  createEcommerceExportRouteHandlers,
  createEcommerceExportService,
} from '../server/ecommerceEngine/exportService.mjs';

async function fixture({
  width = 120,
  height = 80,
  alpha = false,
  background = alpha
    ? { r: 220, g: 20, b: 20, alpha: 0 }
    : { r: 220, g: 20, b: 20 },
  format = 'png',
} = {}) {
  let image = sharp({
    create: {
      width,
      height,
      channels: alpha ? 4 : 3,
      background,
    },
  });
  if (alpha) {
    const overlay = Buffer.from(
      `<svg width="${width}" height="${height}"><rect x="${Math.floor(width / 4)}" y="${Math.floor(height / 4)}" width="${Math.floor(width / 2)}" height="${Math.floor(height / 2)}" fill="#dc1414"/></svg>`,
    );
    image = image.composite([{ input: overlay }]);
  }
  return format === 'jpeg'
    ? image.jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer()
    : image.png({ compressionLevel: 9 }).toBuffer();
}

async function harness(t, { platformPolicyResolver, generatedSource = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'shubao-ecommerce-export-'));
  t.after(async () => {
    await rm(directory, { recursive: true, force: true });
  });
  const db = new Database(':memory:');
  t.after(() => db.close());
  const stableStore = createGeneratedAssetStore({ directory });
  let persistBufferCalls = 0;
  const generatedAssetStore = {
    ...stableStore,
    async persistBuffer(input) {
      persistBufferCalls += 1;
      return stableStore.persistBuffer(input);
    },
  };
  const assetUploadService = createEcommerceAssetUploadService({
    db,
    generatedAssetStore,
  });
  if (generatedSource) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ecommerce_jobs (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        progress TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS ecommerce_job_assets (
        job_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        stable_url TEXT NOT NULL
      );
    `);
  }
  const exportService = createEcommerceExportService({
    db,
    generatedAssetStore,
    assetUploadService,
    ...(platformPolicyResolver ? { platformPolicyResolver } : {}),
  });
  return {
    assetUploadService,
    db,
    exportService,
    generatedAssetStore,
    getPersistBufferCalls: () => persistBufferCalls,
  };
}

async function uploadSource(assetUploadService, bytes, ownerEmail = 'owner@example.com') {
  return assetUploadService.upload({
    ownerEmail,
    body: {
      role: 'product',
      data: bytes.toString('base64'),
    },
  });
}

async function whiteProductFixture({
  width = 120,
  height = 120,
  background = '#ffffff',
  product = '#dc1414',
} = {}) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background,
    },
  }).composite([{
    input: Buffer.from(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${Math.round(width * 0.25)}" y="${Math.round(height * 0.2)}"
          width="${Math.round(width * 0.5)}" height="${Math.round(height * 0.6)}"
          rx="8" fill="${product}"/>
      </svg>
    `),
  }]).png({ compressionLevel: 9 }).toBuffer();
}

function realAssetPlan(platform = 'taobao') {
  return buildAssetPlan({
    productTruth: {
      category: '数码3C',
      productName: 'Plan-bound product',
      sourceAssetIds: [],
      confirmedFacts: {},
    },
    campaignBible: {
      directionId: 'plan-bound',
      title: 'Plan bound',
      confirmed: true,
      referenceAssetIds: [],
    },
    platform,
    sizing: { resolution: '1K' },
  });
}

function responseHarness() {
  return {
    statusCode: 200,
    body: null,
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

test('selects a versioned platform target and deterministically crops, resizes, converts, and verifies output', async (t) => {
  const {
    assetUploadService,
    exportService,
    generatedAssetStore,
  } = await harness(t);
  const source = await uploadSource(assetUploadService, await fixture({ width: 120, height: 80 }));
  const targets = await exportService.listTargets({
    ownerEmail: 'owner@example.com',
    sourceAssetId: source.original.assetId,
    platform: 'taobao',
    role: 'main',
    category: 'all',
  });
  const target = targets.find(item => item.format === 'jpg');

  assert.ok(target);
  assert.match(target.targetId, /^et_[a-f0-9]{64}$/);
  assert.match(target.policyVersion, /^\d{4}\.\d{2}(?:\.\d{2})?$/);
  assert.match(target.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(target.fit, 'cover');
  const exported = await exportService.createExport({
    ownerEmail: 'owner@example.com',
    body: {
      sourceAssetId: source.original.assetId,
      targetId: target.targetId,
    },
  });

  assert.equal(exported.sourceAssetId, source.original.assetId);
  assert.equal(exported.targetId, target.targetId);
  assert.equal(exported.targetFingerprint, target.fingerprint);
  assert.equal(exported.transformVersion, EXPORT_TRANSFORM_VERSION);
  assert.equal(exported.width, 800);
  assert.equal(exported.height, 800);
  assert.equal(exported.format, 'jpeg');
  assert.equal(exported.mimeType, 'image/jpeg');
  assert.ok(exported.byteSize > 0 && exported.byteSize <= target.maxFileBytes);
  assert.match(exported.assetId, /^[a-f0-9]{64}\.jpg$/);
  assert.equal(exported.url, `/api/generated-assets/${exported.assetId}`);
  assert.equal(Object.hasOwn(exported, 'path'), false);
  assert.equal(Object.hasOwn(exported, 'filePath'), false);

  const stored = await generatedAssetStore.read(exported.assetId);
  const metadata = await sharp(stored.buffer).metadata();
  assert.equal(metadata.width, 800);
  assert.equal(metadata.height, 800);
  assert.equal(metadata.format, 'jpeg');
  const corner = await sharp(stored.buffer).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
  assert.ok(corner[0] > 180 && corner[1] < 80 && corner[2] < 80, 'cover crop should not add contain bars');
});

test('uses deterministic contain and role processing for white-background platform exports', async (t) => {
  const { assetUploadService, exportService, generatedAssetStore } = await harness(t);
  const source = await uploadSource(
    assetUploadService,
    await whiteProductFixture({ width: 80, height: 120 }),
  );
  const targets = await exportService.listTargets({
    ownerEmail: 'owner@example.com',
    sourceAssetId: source.original.assetId,
    platform: 'jd',
    role: 'white_background',
    category: 'all',
  });
  const target = targets.find(item => item.format === 'png');
  const exported = await exportService.createExport({
    ownerEmail: 'owner@example.com',
    body: { sourceAssetId: source.original.assetId, targetId: target.targetId },
  });
  const stored = await generatedAssetStore.read(exported.assetId);
  const metadata = await sharp(stored.buffer).metadata();
  const corner = await sharp(stored.buffer).extract({ left: 0, top: 0, width: 1, height: 1 }).removeAlpha().raw().toBuffer();

  assert.equal(target.fit, 'cover');
  assert.equal(exported.role, 'white_background');
  assert.equal(metadata.width, 800);
  assert.equal(metadata.height, 800);
  assert.deepEqual([...corner], [255, 255, 255]);
});

test('replays the same owner/source/target transform without writing another output', async (t) => {
  const {
    assetUploadService,
    exportService,
    getPersistBufferCalls,
  } = await harness(t);
  const source = await uploadSource(assetUploadService, await fixture());
  const [target] = await exportService.listTargets({
    ownerEmail: 'owner@example.com',
    sourceAssetId: source.original.assetId,
    platform: 'pdd',
    role: 'main',
    category: 'all',
  });
  const before = getPersistBufferCalls();

  const first = await exportService.createExport({
    ownerEmail: 'owner@example.com',
    body: { sourceAssetId: source.original.assetId, targetId: target.targetId },
  });
  const second = await exportService.createExport({
    ownerEmail: 'owner@example.com',
    body: { sourceAssetId: source.original.assetId, targetId: target.targetId },
  });

  assert.deepEqual(second, first);
  assert.equal(getPersistBufferCalls() - before, 1);
});

test('rejects owner mismatches, preview sources, traversal IDs, tampered targets, prices, paths, and Sharp parameters', async (t) => {
  const { assetUploadService, exportService } = await harness(t);
  const source = await uploadSource(assetUploadService, await fixture(), 'first@example.com');
  const [target] = await exportService.listTargets({
    ownerEmail: 'first@example.com',
    sourceAssetId: source.original.assetId,
    platform: 'taobao',
    role: 'main',
    category: 'all',
  });

  await assert.rejects(
    exportService.createExport({
      ownerEmail: 'second@example.com',
      body: { sourceAssetId: source.original.assetId, targetId: target.targetId },
    }),
    error => error?.status === 403 && error?.code === 'ASSET_OWNER_MISMATCH',
  );
  await assert.rejects(
    exportService.createExport({
      ownerEmail: 'first@example.com',
      body: { sourceAssetId: source.preview.assetId, targetId: target.targetId },
    }),
    error => error?.status === 400 && error?.code === 'EXPORT_SOURCE_INVALID',
  );
  for (const sourceAssetId of ['../secret.png', '%2e%2e%2fsecret.png']) {
    await assert.rejects(
      exportService.createExport({
        ownerEmail: 'first@example.com',
        body: { sourceAssetId, targetId: target.targetId },
      }),
      error => error?.status === 400 && error?.code === 'ASSET_ID_INVALID',
    );
  }
  await assert.rejects(
    exportService.createExport({
      ownerEmail: 'first@example.com',
      body: {
        sourceAssetId: source.original.assetId,
        targetId: `${target.targetId.slice(0, -1)}${target.targetId.endsWith('0') ? '1' : '0'}`,
      },
    }),
    error => error?.status === 400 && error?.code === 'EXPORT_TARGET_INVALID',
  );
  for (const body of [
    { sourceAssetId: source.original.assetId, targetId: target.targetId, price: 0.01 },
    { sourceAssetId: source.original.assetId, targetId: target.targetId, path: 'C:\\secret' },
    { sourceAssetId: source.original.assetId, targetId: target.targetId, quality: 1 },
    { sourceAssetId: source.original.assetId, target },
  ]) {
    await assert.rejects(
      exportService.createExport({ ownerEmail: 'first@example.com', body }),
      error => error?.status === 400 && error?.code === 'EXPORT_REQUEST_INVALID',
    );
  }
});

test('rejects an output that exceeds the server-owned platform byte limit', async (t) => {
  const platformPolicyResolver = (platform, role, category) => ({
    platform,
    categoryScope: category,
    role,
    allowedRatios: ['1:1'],
    exportSizes: [{ width: 64, height: 64 }],
    maxFileBytes: 20,
    formats: ['png'],
    sourceUrl: 'https://rules.example/',
    verifiedAt: '2026-07-26',
    confidence: 'high',
    enforcement: 'hard',
  });
  const { assetUploadService, exportService } = await harness(t, { platformPolicyResolver });
  const source = await uploadSource(assetUploadService, await fixture({ width: 64, height: 64 }));
  const [target] = await exportService.listTargets({
    ownerEmail: 'owner@example.com',
    sourceAssetId: source.original.assetId,
    platform: 'test-market',
    role: 'main',
    category: 'all',
  });

  await assert.rejects(
    exportService.createExport({
      ownerEmail: 'owner@example.com',
      body: { sourceAssetId: source.original.assetId, targetId: target.targetId },
    }),
    error => error?.status === 422 && error?.code === 'EXPORT_FILE_TOO_LARGE',
  );
});

test('exports stable generated job assets while preserving owner scope', async (t) => {
  const {
    db,
    exportService,
    generatedAssetStore,
  } = await harness(t, { generatedSource: true });
  const bytes = await fixture({ width: 80, height: 80, format: 'jpeg' });
  const stable = await generatedAssetStore.persistBuffer({
    buffer: bytes,
    contentType: 'image/jpeg',
    taskId: 'job-source',
    label: 'main',
  });
  db.prepare('INSERT INTO ecommerce_jobs (id, owner_email) VALUES (?, ?)').run('job-source', 'owner@example.com');
  db.prepare('INSERT INTO ecommerce_job_assets (job_id, asset_id, stable_url) VALUES (?, ?, ?)').run(
    'job-source',
    'main',
    stable.url,
  );

  const [target] = await exportService.listTargets({
    ownerEmail: 'owner@example.com',
    sourceAssetId: stable.id,
    platform: 'douyin',
    role: 'main',
    category: 'all',
  });
  const result = await exportService.createExport({
    ownerEmail: 'owner@example.com',
    body: { sourceAssetId: stable.id, targetId: target.targetId },
  });
  assert.equal(result.sourceKind, 'generated');

  await assert.rejects(
    exportService.listTargets({
      ownerEmail: 'other@example.com',
      sourceAssetId: stable.id,
      platform: 'douyin',
      role: 'main',
      category: 'all',
    }),
    error => error?.status === 403 && error?.code === 'ASSET_OWNER_MISMATCH',
  );
});

test('allows a generated owner when the same content hash was uploaded by another owner', async (t) => {
  const {
    assetUploadService,
    db,
    exportService,
    generatedAssetStore,
  } = await harness(t, { generatedSource: true });
  const bytes = await fixture({ width: 80, height: 80, format: 'jpeg' });
  const uploaded = await uploadSource(assetUploadService, bytes, 'uploader@example.com');
  const stable = await generatedAssetStore.persistBuffer({
    buffer: bytes,
    contentType: 'image/jpeg',
    taskId: 'generated-owner-source',
    label: 'main',
  });
  assert.equal(stable.id, uploaded.original.assetId);
  db.prepare('INSERT INTO ecommerce_jobs (id, owner_email) VALUES (?, ?)').run(
    'generated-owner-source',
    'generator@example.com',
  );
  db.prepare('INSERT INTO ecommerce_job_assets (job_id, asset_id, stable_url) VALUES (?, ?, ?)').run(
    'generated-owner-source',
    'main',
    stable.url,
  );

  const [target] = await exportService.listTargets({
    ownerEmail: 'generator@example.com',
    sourceAssetId: stable.id,
    platform: 'taobao',
    role: 'main',
    category: 'all',
  });
  const result = await exportService.createExport({
    ownerEmail: 'generator@example.com',
    body: { sourceAssetId: stable.id, targetId: target.targetId },
  });

  assert.equal(result.sourceKind, 'generated');
});

test('route exports a real persisted Asset Plan targetId and rejects tampering and cross-owner jobs', async (t) => {
  const {
    db,
    exportService,
    generatedAssetStore,
  } = await harness(t, { generatedSource: true });
  const stable = await generatedAssetStore.persistBuffer({
    buffer: await whiteProductFixture(),
    contentType: 'image/png',
    taskId: 'plan-job-owner',
    label: 'main',
  });
  const ownerPlan = realAssetPlan('taobao');
  const ownerItem = ownerPlan.find(item => item.role === 'main');
  const ownerTarget = ownerItem.exportTargets.find(target => target.format === 'png');
  assert.match(ownerTarget.targetId, /^et_[a-f0-9]{64}$/);
  db.prepare('INSERT INTO ecommerce_jobs (id, owner_email, progress) VALUES (?, ?, ?)').run(
    'plan-job-owner',
    'owner@example.com',
    JSON.stringify({ orchestrationSnapshot: { assetPlan: ownerPlan } }),
  );
  db.prepare('INSERT INTO ecommerce_job_assets (job_id, asset_id, stable_url) VALUES (?, ?, ?)').run(
    'plan-job-owner',
    ownerItem.id,
    stable.url,
  );

  const otherPlan = realAssetPlan('jd');
  const otherItem = otherPlan.find(item => item.role === 'main');
  const otherTarget = otherItem.exportTargets.find(target => target.format === 'png');
  db.prepare('INSERT INTO ecommerce_jobs (id, owner_email, progress) VALUES (?, ?, ?)').run(
    'plan-job-other',
    'other@example.com',
    JSON.stringify({ orchestrationSnapshot: { assetPlan: otherPlan } }),
  );
  db.prepare('INSERT INTO ecommerce_job_assets (job_id, asset_id, stable_url) VALUES (?, ?, ?)').run(
    'plan-job-other',
    otherItem.id,
    stable.url,
  );

  const handlers = createEcommerceExportRouteHandlers({ exportService });
  const ok = responseHarness();
  await handlers.create({
    _userEmail: 'owner@example.com',
    body: {
      jobId: 'plan-job-owner',
      sourceAssetId: stable.id,
      targetId: ownerTarget.targetId,
    },
  }, ok);
  assert.equal(ok.statusCode, 201);
  assert.equal(ok.body.targetId, ownerTarget.targetId);
  assert.equal(ok.body.platform, 'taobao');

  const tampered = responseHarness();
  await handlers.create({
    _userEmail: 'owner@example.com',
    body: {
      jobId: 'plan-job-owner',
      sourceAssetId: stable.id,
      targetId: `${ownerTarget.targetId.slice(0, -1)}${ownerTarget.targetId.endsWith('0') ? '1' : '0'}`,
    },
  }, tampered);
  assert.equal(tampered.statusCode, 400);
  assert.equal(tampered.body.code, 'EXPORT_TARGET_INVALID');

  const crossOwner = responseHarness();
  await handlers.create({
    _userEmail: 'owner@example.com',
    body: {
      jobId: 'plan-job-other',
      sourceAssetId: stable.id,
      targetId: otherTarget.targetId,
    },
  }, crossOwner);
  assert.equal(crossOwner.statusCode, 403);
  assert.equal(crossOwner.body.code, 'ASSET_OWNER_MISMATCH');
});

test('resolves duplicate-content job assets by the unique targetId instead of stable URL row order', async (t) => {
  const {
    db,
    exportService,
    generatedAssetStore,
  } = await harness(t, { generatedSource: true });
  const stable = await generatedAssetStore.persistBuffer({
    buffer: await whiteProductFixture(),
    contentType: 'image/png',
    taskId: 'duplicate-content-job',
    label: 'shared',
  });
  const plan = realAssetPlan('taobao');
  const mainItem = plan.find(item => item.role === 'main');
  const whiteItem = plan.find(item => item.role === 'white_background');
  const unrelatedItem = plan.find(item => item.role === 'detail_slice_feature');
  const mainTarget = mainItem.exportTargets.find(target => target.format === 'png');
  const whiteTarget = whiteItem.exportTargets.find(target => target.format === 'png');
  const unrelatedTarget = unrelatedItem.exportTargets.find(target => target.format === 'png');
  assert.notEqual(mainTarget.targetId, whiteTarget.targetId);

  db.prepare('INSERT INTO ecommerce_jobs (id, owner_email, progress) VALUES (?, ?, ?)').run(
    'duplicate-content-job',
    'owner@example.com',
    JSON.stringify({ orchestrationSnapshot: { assetPlan: plan } }),
  );
  const insertAsset = db.prepare(
    'INSERT INTO ecommerce_job_assets (job_id, asset_id, stable_url) VALUES (?, ?, ?)',
  );
  insertAsset.run('duplicate-content-job', mainItem.id, stable.url);
  insertAsset.run('duplicate-content-job', whiteItem.id, stable.url);

  const mainExport = await exportService.createExport({
    ownerEmail: 'owner@example.com',
    body: {
      jobId: 'duplicate-content-job',
      sourceAssetId: stable.id,
      targetId: mainTarget.targetId,
    },
  });
  const whiteExport = await exportService.createExport({
    ownerEmail: 'owner@example.com',
    body: {
      jobId: 'duplicate-content-job',
      sourceAssetId: stable.id,
      targetId: whiteTarget.targetId,
    },
  });

  assert.equal(mainExport.targetId, mainTarget.targetId);
  assert.equal(mainExport.role, 'main');
  assert.equal(whiteExport.targetId, whiteTarget.targetId);
  assert.equal(whiteExport.role, 'white_background');
  assert.notEqual(mainExport.transformFingerprint, whiteExport.transformFingerprint);
  assert.deepEqual(
    await exportService.createExport({
      ownerEmail: 'owner@example.com',
      body: {
        jobId: 'duplicate-content-job',
        sourceAssetId: stable.id,
        targetId: whiteTarget.targetId,
      },
    }),
    whiteExport,
  );

  await assert.rejects(
    exportService.createExport({
      ownerEmail: 'owner@example.com',
      body: {
        jobId: 'duplicate-content-job',
        sourceAssetId: stable.id,
        targetId: unrelatedTarget.targetId,
      },
    }),
    error => error?.status === 400 && error?.code === 'EXPORT_TARGET_INVALID',
  );
});

test('rejects an ambiguous targetId shared by duplicate-content plan items before persistence', async (t) => {
  const {
    db,
    exportService,
    generatedAssetStore,
    getPersistBufferCalls,
  } = await harness(t, { generatedSource: true });
  const stable = await generatedAssetStore.persistBuffer({
    buffer: await whiteProductFixture(),
    contentType: 'image/png',
    taskId: 'ambiguous-content-job',
    label: 'shared',
  });
  const plan = realAssetPlan('taobao');
  const firstItem = plan.find(item => item.role === 'detail_slice_feature');
  const secondItem = plan.find(item => item.role === 'detail_slice_usage');
  const sharedTarget = firstItem.exportTargets.find(target => target.format === 'png');
  assert.equal(
    secondItem.exportTargets.some(target => target.targetId === sharedTarget.targetId),
    true,
  );

  db.prepare('INSERT INTO ecommerce_jobs (id, owner_email, progress) VALUES (?, ?, ?)').run(
    'ambiguous-content-job',
    'owner@example.com',
    JSON.stringify({ orchestrationSnapshot: { assetPlan: plan } }),
  );
  const insertAsset = db.prepare(
    'INSERT INTO ecommerce_job_assets (job_id, asset_id, stable_url) VALUES (?, ?, ?)',
  );
  insertAsset.run('ambiguous-content-job', firstItem.id, stable.url);
  insertAsset.run('ambiguous-content-job', secondItem.id, stable.url);
  const before = getPersistBufferCalls();

  await assert.rejects(
    exportService.createExport({
      ownerEmail: 'owner@example.com',
      body: {
        jobId: 'ambiguous-content-job',
        sourceAssetId: stable.id,
        targetId: sharedTarget.targetId,
      },
    }),
    error => error?.status === 409 && error?.code === 'EXPORT_TARGET_AMBIGUOUS',
  );
  assert.equal(getPersistBufferCalls(), before);
});

test('rejects an opaque colored image for white_background without persisting an export', async (t) => {
  const {
    assetUploadService,
    exportService,
    getPersistBufferCalls,
  } = await harness(t);
  const source = await uploadSource(
    assetUploadService,
    await whiteProductFixture({ background: '#3f6f9f' }),
  );
  const target = (await exportService.listTargets({
    ownerEmail: 'owner@example.com',
    sourceAssetId: source.original.assetId,
    platform: 'jd',
    role: 'white_background',
    category: 'all',
  })).find(item => item.format === 'png');
  const before = getPersistBufferCalls();

  await assert.rejects(
    exportService.createExport({
      ownerEmail: 'owner@example.com',
      body: { sourceAssetId: source.original.assetId, targetId: target.targetId },
    }),
    error => error?.status === 422 && error?.code === 'EXPORT_WHITE_BACKGROUND_INVALID',
  );
  assert.equal(getPersistBufferCalls(), before);
});

test('thin export handler passes signed owner identity and production authenticates the endpoint', async () => {
  const calls = [];
  const handlers = createEcommerceExportRouteHandlers({
    exportService: {
      async createExport(input) {
        calls.push(input);
        return { assetId: `${'b'.repeat(64)}.jpg` };
      },
    },
  });
  const res = responseHarness();
  await handlers.create({
    _userEmail: 'signed@example.com',
    body: { sourceAssetId: `${'a'.repeat(64)}.png`, targetId: `et_${'b'.repeat(64)}` },
  }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(calls[0].ownerEmail, 'signed@example.com');

  const server = await fs.readFile(new URL('../server/index.mjs', import.meta.url), 'utf8');
  assert.match(
    server,
    /app\.post\('\/api\/ecommerce\/exports',\s*authenticateEcommerceRequest,\s*ecommerceExportRouteHandlers\.create\)/,
  );
});
