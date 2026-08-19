import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { parseVideoRange, sendVideoAsset } from '../server/videoGeneration.mjs';

function createResponse() {
  const response = new PassThrough();
  response.headers = new Map();
  response.statusCode = 200;
  response.setHeader = (name, value) => response.headers.set(String(name).toLowerCase(), String(value));
  response.getHeader = name => response.headers.get(String(name).toLowerCase());
  response.status = code => { response.statusCode = code; return response; };
  response.bodyChunks = [];
  response.on('data', chunk => response.bodyChunks.push(Buffer.from(chunk)));
  return response;
}

async function deliver(request, asset) {
  const response = createResponse();
  const finished = once(response, 'finish');
  sendVideoAsset(request, response, asset);
  await finished;
  return {
    status: response.statusCode,
    headers: Object.fromEntries(response.headers),
    body: Buffer.concat(response.bodyChunks),
  };
}

test('parses an explicit byte range without changing its bounds', () => {
  assert.deepEqual(parseVideoRange('bytes=2-5', 10), { start: 2, end: 5 });
});

test('parses an open-ended byte range through the end of the asset', () => {
  assert.deepEqual(parseVideoRange('bytes=6-', 10), { start: 6, end: 9 });
});

test('parses a suffix byte range from the end of the asset', () => {
  assert.deepEqual(parseVideoRange('bytes=-3', 10), { start: 7, end: 9 });
});

test('clamps a suffix byte range larger than the asset to the full asset', () => {
  assert.deepEqual(parseVideoRange('bytes=-99', 10), { start: 0, end: 9 });
});

test('distinguishes a missing range from an invalid or unsatisfiable range', () => {
  assert.equal(parseVideoRange('', 10), null);
  assert.equal(parseVideoRange('bytes=', 10), false);
  assert.equal(parseVideoRange('bytes=10-10', 10), false);
  assert.equal(parseVideoRange('bytes=4-2', 10), false);
});

test('delivers a media asset with stable validators and byte-range support', async t => {
  const root = mkdtempSync(join(tmpdir(), 'video-asset-delivery-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const filePath = join(root, 'asset.mp4');
  const bytes = Buffer.from('0123456789');
  writeFileSync(filePath, bytes);
  const sha256 = 'a'.repeat(64);
  const asset = {
    row: { id: 'asset.mp4', kind: 'output', content_type: 'video/mp4', sha256, created_at: '2026-08-19 00:00:00' },
    filePath,
    size: bytes.length,
    mtimeMs: Date.parse('2026-08-19T00:00:00.000Z'),
  };

  const full = await deliver({ method: 'GET', headers: {} }, asset);
  assert.equal(full.status, 200);
  assert.equal(full.body.toString(), '0123456789');
  assert.equal(full.headers.etag, `"${sha256}"`);
  assert.equal(full.headers['accept-ranges'], 'bytes');
  assert.equal(full.headers['content-length'], '10');
  assert.equal(Date.parse(full.headers['last-modified']), asset.mtimeMs);

  const ranged = await deliver({
    method: 'GET',
    headers: { range: 'bytes=2-5', 'if-range': `"${sha256}"` },
  }, asset);
  assert.equal(ranged.status, 206);
  assert.equal(ranged.body.toString(), '2345');
  assert.equal(ranged.headers['content-range'], 'bytes 2-5/10');

  const mismatchedIfRange = await deliver({
    method: 'GET',
    headers: { range: 'bytes=2-5', 'if-range': '"different"' },
  }, asset);
  assert.equal(mismatchedIfRange.status, 200);
  assert.equal(mismatchedIfRange.body.toString(), '0123456789');
});

test('supports conditional requests and HEAD without opening a response body', async t => {
  const root = mkdtempSync(join(tmpdir(), 'video-asset-conditional-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const filePath = join(root, 'asset.png');
  writeFileSync(filePath, Buffer.from('image'));
  const asset = {
    row: { id: 'asset.png', kind: 'image', content_type: 'image/png', sha256: 'b'.repeat(64) },
    filePath,
    size: 5,
    mtimeMs: Date.parse('2026-08-19T00:00:00.000Z'),
  };

  const head = await deliver({ method: 'HEAD', headers: {} }, asset);
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  assert.equal(head.headers['content-length'], '5');

  const notModified = await deliver({
    method: 'GET',
    headers: { 'if-none-match': `W/"${asset.row.sha256}"` },
  }, asset);
  assert.equal(notModified.status, 304);
  assert.equal(notModified.body.length, 0);

  const rangedNotModified = await deliver({
    method: 'GET',
    headers: { range: 'bytes=1-2', 'if-none-match': `"${asset.row.sha256}"` },
  }, asset);
  assert.equal(rangedNotModified.status, 304);
  assert.equal(rangedNotModified.body.length, 0);

  const unsatisfiable = await deliver({ method: 'GET', headers: { range: 'bytes=99-' } }, asset);
  assert.equal(unsatisfiable.status, 416);
  assert.equal(unsatisfiable.headers['content-range'], 'bytes */5');
  assert.equal(unsatisfiable.body.length, 0);
});
