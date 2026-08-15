import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createVideoUploadService } from '../server/videoUploadService.mjs';
import { createImmediateMediaPreview } from '../src/services/videoUploadClient.js';

const TUS_VERSION = '1.0.0';

test('local media preview is available immediately and revoked exactly once', () => {
  const revoked = [];
  const preview = createImmediateMediaPreview(new Blob(['preview']), {
    createObjectURL: () => 'blob:video-preview',
    revokeObjectURL: url => revoked.push(url),
  });
  assert.equal(preview.url, 'blob:video-preview');
  assert.ok(preview.elapsedMs < 300, `preview took ${preview.elapsedMs}ms`);
  preview.revoke();
  preview.revoke();
  assert.deepEqual(revoked, ['blob:video-preview']);
});

function encodeMetadata(values) {
  return Object.entries(values)
    .map(([key, value]) => `${key} ${Buffer.from(String(value)).toString('base64')}`)
    .join(',');
}

async function createHarness(t, overrides = {}) {
  const db = new Database(':memory:');
  const directory = mkdtempSync(join(tmpdir(), 'video-upload-test-'));
  const imported = [];
  let clock = Date.UTC(2026, 7, 15, 0, 0, 0);
  const service = createVideoUploadService({
    db,
    directory,
    expirationMs: 60 * 60 * 1000,
    now: () => clock,
    importAsset: async input => {
      imported.push({ ...input, content: readFileSync(input.sourcePath) });
      return {
        id: `asset-${imported.length}`,
        kind: input.kind,
        contentType: input.contentType,
        bytes: input.bytes,
        sha256: input.sha256,
        url: `https://example.test/api/video/media/asset-${imported.length}`,
      };
    },
    ...overrides,
  });
  const server = http.createServer((req, res) => {
    req._userEmail = String(req.headers['x-test-owner'] || '');
    void service.handle(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    service.close?.();
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    db,
    service,
    imported,
    baseUrl,
    advance(ms) { clock += ms; },
  };
}

async function createUpload(baseUrl, owner, content, metadata = {}) {
  return fetch(`${baseUrl}/api/video/uploads`, {
    method: 'POST',
    headers: {
      'Tus-Resumable': TUS_VERSION,
      'Upload-Length': String(content.length),
      'Upload-Metadata': encodeMetadata(metadata),
      ...(owner ? { 'X-Test-Owner': owner } : {}),
    },
  });
}

async function patchUpload(url, owner, offset, body) {
  return fetch(url, {
    method: 'PATCH',
    headers: {
      'Tus-Resumable': TUS_VERSION,
      'Upload-Offset': String(offset),
      'Content-Type': 'application/offset+octet-stream',
      ...(owner ? { 'X-Test-Owner': owner } : {}),
    },
    body,
  });
}

test('resumable upload preserves offsets and is invisible to another owner', async t => {
  const { baseUrl, imported } = await createHarness(t);
  const owner = 'owner@example.com';
  const content = Buffer.from('resumable-video-asset');
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  const created = await createUpload(baseUrl, owner, content, {
    filename: 'campaign.mp4',
    filetype: 'video/mp4',
    kind: 'video',
    sha256,
  });
  assert.equal(created.status, 201);
  const location = new URL(created.headers.get('location'), baseUrl).href;

  const first = await patchUpload(location, owner, 0, content.subarray(0, 8));
  assert.equal(first.status, 204);
  assert.equal(first.headers.get('upload-offset'), '8');

  const ownedHead = await fetch(location, { method: 'HEAD', headers: { 'Tus-Resumable': TUS_VERSION, 'X-Test-Owner': owner } });
  assert.equal(ownedHead.status, 200);
  assert.equal(ownedHead.headers.get('upload-offset'), '8');
  const foreignHead = await fetch(location, { method: 'HEAD', headers: { 'Tus-Resumable': TUS_VERSION, 'X-Test-Owner': 'other@example.com' } });
  assert.equal(foreignHead.status, 404);
  const foreignPatch = await patchUpload(location, 'other@example.com', 8, content.subarray(8));
  assert.equal(foreignPatch.status, 404);

  const finished = await patchUpload(location, owner, 8, content.subarray(8));
  assert.equal(finished.status, 204);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].content.toString(), content.toString());
  assert.equal(imported[0].sha256, sha256);

  const uploadId = new URL(location).pathname.split('/').pop();
  const result = await fetch(`${baseUrl}/api/video/upload-results/${uploadId}`, { headers: { 'X-Test-Owner': owner } });
  assert.equal(result.status, 200);
  const payload = await result.json();
  assert.equal(payload.upload.status, 'completed');
  assert.equal(payload.asset.id, 'asset-1');
  const foreignResult = await fetch(`${baseUrl}/api/video/upload-results/${uploadId}`, { headers: { 'X-Test-Owner': 'other@example.com' } });
  assert.equal(foreignResult.status, 404);
});

test('anonymous, oversized, and unsupported uploads are rejected before storage', async t => {
  const { baseUrl, imported } = await createHarness(t);
  const content = Buffer.from('image');
  const anonymous = await createUpload(baseUrl, '', content, { filename: 'x.png', filetype: 'image/png', kind: 'image' });
  assert.equal(anonymous.status, 401);

  const unsupported = await createUpload(baseUrl, 'owner@example.com', content, { filename: 'x.svg', filetype: 'image/svg+xml', kind: 'image' });
  assert.equal(unsupported.status, 415);

  const oversized = await fetch(`${baseUrl}/api/video/uploads`, {
    method: 'POST',
    headers: {
      'Tus-Resumable': TUS_VERSION,
      'Upload-Length': String(10 * 1024 * 1024 + 1),
      'Upload-Metadata': encodeMetadata({ filename: 'huge.png', filetype: 'image/png', kind: 'image' }),
      'X-Test-Owner': 'owner@example.com',
    },
  });
  assert.equal(oversized.status, 413);
  assert.equal(imported.length, 0);
});

test('server checksum mismatch never creates a durable asset', async t => {
  const { baseUrl, imported } = await createHarness(t);
  const owner = 'owner@example.com';
  const content = Buffer.from('checksum-source');
  const created = await createUpload(baseUrl, owner, content, {
    filename: 'source.png',
    filetype: 'image/png',
    kind: 'image',
    sha256: '0'.repeat(64),
  });
  const location = new URL(created.headers.get('location'), baseUrl).href;
  const finished = await patchUpload(location, owner, 0, content);
  assert.equal(finished.status, 422);
  assert.equal(imported.length, 0);
  const uploadId = new URL(location).pathname.split('/').pop();
  const result = await fetch(`${baseUrl}/api/video/upload-results/${uploadId}`, { headers: { 'X-Test-Owner': owner } });
  assert.equal(result.status, 422);
  const payload = await result.json();
  assert.equal(payload.upload.status, 'checksum_failed');
});

test('expired incomplete uploads are removed and cannot be resumed', async t => {
  const { baseUrl, service, advance } = await createHarness(t);
  const owner = 'owner@example.com';
  const content = Buffer.from('expires');
  const created = await createUpload(baseUrl, owner, content, {
    filename: 'expires.webm',
    filetype: 'video/webm',
    kind: 'video',
  });
  const location = new URL(created.headers.get('location'), baseUrl).href;
  assert.equal((await patchUpload(location, owner, 0, content.subarray(0, 2))).status, 204);
  advance(2 * 60 * 60 * 1000);
  await service.cleanExpiredUploads();
  const head = await fetch(location, { method: 'HEAD', headers: { 'Tus-Resumable': TUS_VERSION, 'X-Test-Owner': owner } });
  assert.ok([404, 410].includes(head.status));
  const uploadId = new URL(location).pathname.split('/').pop();
  const result = await fetch(`${baseUrl}/api/video/upload-results/${uploadId}`, { headers: { 'X-Test-Owner': owner } });
  assert.equal(result.status, 410);
  assert.equal((await result.json()).upload.status, 'expired');
});
