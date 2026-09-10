// test/canvas-graph-run-executor.test.mjs
// P1 hardening: prove the REAL free white-bg chain (source -> remove-bg -> upscale)
// end-to-end with ZERO upstream cost: in-memory sqlite + real segmentUniformBackground + real sharp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import { segmentUniformBackground } from '../server/canvasSegmentation.mjs';
import { createCanvasGraphRunStore } from '../server/canvas/graphRunSchema.mjs';
import { createCanvasGraphRunService } from '../server/canvas/graphRunService.mjs';
import { createCanvasGraphRunExecutor } from '../server/canvas/graphRunExecutor.mjs';
import { createCanvasBilledActionStore } from '../server/billing/canvasBilledActionStore.mjs';

async function makeSynthProduct() {
  const white = await sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
  const red = await sharp({ create: { width: 100, height: 100, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 1 } } }).png().toBuffer();
  return sharp(white).composite([{ input: red, left: 50, top: 50 }]).png().toBuffer();
}

test('segmentUniformBackground extracts a solid subject from a synthetic white-bg product', async () => {
  const sourcePng = await makeSynthProduct();
  const split = await segmentUniformBackground(sourcePng);
  const subject = await split.subject; // subject is a Promise<Buffer> (sharp toBuffer), mirror index.mjs await
  assert.equal(split.segmented, true, 'expected a reliable uniform white background');
  assert.ok(Buffer.isBuffer(subject) && subject.length > 0, 'subject must be a non-empty png buffer');
  assert.ok(split.backgroundCoverage > 0.02 && split.backgroundCoverage < 0.99, 'background coverage in a sensible band');
});

test('P1 free white-bg chain (source -> remove-bg -> upscale) runs end-to-end with zero charge', async () => {
  const sourcePng = await makeSynthProduct();
  const split = await segmentUniformBackground(sourcePng);
  const subject = await split.subject; // real remove-bg output (Buffer), feeds upscale
  const readBy = { 'synth:source': sourcePng, 'out:remove-bg': subject };
  const fakeInputReader = { read: async (url) => ({ buffer: readBy[url] || sourcePng }) };
  const fakeAsset = { persistBuffer: async (arg) => ({ url: arg.url }) };

  const executor = createCanvasGraphRunExecutor({
    removeBackground: async ({ imageUrl }) => {
      const { buffer } = await fakeInputReader.read(imageUrl);
      const s = await segmentUniformBackground(buffer);
      if (!s.segmented) return { ok: false, error: 'not segmented' };
      const asset = await fakeAsset.persistBuffer({ url: 'out:remove-bg' });
      return { ok: true, outputUrl: asset.url };
    },
    upscale: async ({ imageUrl }) => {
      const { buffer } = await fakeInputReader.read(imageUrl);
      const up = await sharp(buffer).resize(400, 400, { fit: 'inside' }).png().toBuffer();
      assert.ok(Buffer.isBuffer(up) && up.length > 0, 'upscale produced a buffer');
      const asset = await fakeAsset.persistBuffer({ url: 'out:upscale' });
      return { ok: true, outputUrl: asset.url };
    },
  });

  const db = new Database(':memory:');
  const store = createCanvasGraphRunStore(db);
  const billActions = createCanvasBilledActionStore(db);
  const service = createCanvasGraphRunService({ store, billActions, executeNode: executor });

  const nodes = [
    { id: 'src', kind: 'image', url: 'synth:source', sourceNodeIds: [] },
    { id: 'rb', actionId: 'remove-bg', sourceNodeIds: ['src'] },
    { id: 'up', actionId: 'upscale', sourceNodeIds: ['rb'] },
  ];
  const connections = [
    { fromNodeId: 'src', toNodeId: 'rb', relation: 'reference' },
    { fromNodeId: 'rb', toNodeId: 'up', relation: 'reference' },
  ];

  const result = await service.startRun({ ownerEmail: 'owner@shubao.test', docId: 'synth-doc', nodes, connections });
  assert.equal(result.status, 'completed', 'free chain must complete');
  assert.equal(result.settledUnits, 0, 'the free chain settles zero units');
  const byId = new Map(result.steps.map(s => [s.nodeId, s]));
  assert.equal(byId.get('src').state, 'completed', 'source node completes as a no-op');
  assert.equal(byId.get('rb').state, 'completed');
  assert.equal(byId.get('up').state, 'completed');
  assert.equal(byId.get('rb').chargedUnits, 0, 'remove-bg is free');
  assert.equal(byId.get('up').chargedUnits, 0, 'upscale is free');
  assert.equal(byId.get('rb').outputUrl, 'out:remove-bg', 'downstream input is the upstream output');
});