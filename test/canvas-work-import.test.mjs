import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { closeDB, getAllWorks, initDB, upsertWork } from '../server/db.mjs';
import { buildEcommerceTaskWork } from '../server/ecommerceEngine/workPersistence.mjs';
import { canCreateWorkflowFromNode } from '../src/pages/EcCanvas/canvasActionRegistry.js';
import { createFreshCanvasSession } from '../src/pages/EcCanvas/canvasSessionModel.js';

const STABLE_URL = `/api/generated-assets/${'c'.repeat(64)}.png`;

test('a real owner-scoped ecommerce work restores product inputs into a derivable Canvas source group', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'shubao-canvas-work-import-'));
  t.after(async () => { closeDB(); await rm(dir, { recursive: true, force: true }); });
  initDB(join(dir, 'works.db'));

  const work = buildEcommerceTaskWork({
    job: {
      id: 'real-task-1',
      ownerEmail: 'owner@example.com',
      status: 'completed',
      progress: {
        projectId: 'project-1',
        sourceVersionId: 'version-source-1',
        resultVersionId: 'version-result-1',
        generationRunId: 'real-task-1',
      },
      payload: {
        product_name: '真实保温杯',
        category: '家居生活',
        platform: '天猫',
        selling_points: '316L 内胆',
        assets: {
          product: [{ assetId: 'owned-product-1', url: '/api/ecommerce-assets/owned-product-1', role: 'product', name: '杯身正面' }],
        },
      },
    },
    assets: [{
      assetId: 'main-1',
      state: 'completed',
      stableUrl: STABLE_URL,
      requestSnapshot: { assetPlanItem: { id: 'main-1', role: 'main_text', purpose: '商品识别主图', ratio: '1:1' } },
    }],
    status: 'completed',
  });
  upsertWork(work);

  const [persisted] = getAllWorks({ ownerEmail: 'owner@example.com' });
  assert.equal(getAllWorks({ ownerEmail: 'other@example.com' }).length, 0);
  const session = createFreshCanvasSession({
    work: persisted,
    productAssets: persisted.productAssets,
    outputs: persisted.images,
  });
  const source = session.nodes.find(node => node.kind === 'source_group');

  assert.equal(source.assets.length, 1);
  assert.equal(source.assets[0].assetId, 'owned-product-1');
  assert.equal(canCreateWorkflowFromNode(source), true);
  assert.equal(session.connections[0].from, source.id);
});
