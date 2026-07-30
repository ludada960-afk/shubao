import assert from 'node:assert/strict';
import test from 'node:test';
import { canCreateWorkflowFromNode } from '../src/pages/EcCanvas/canvasActionRegistry.js';

test('only a declared product original can start a commerce workflow from a source group', () => {
  const base = { kind: 'source_group', status: 'ready', assets: [{ url: 'https://cdn.example.com/product.jpg' }] };
  assert.equal(canCreateWorkflowFromNode({ ...base, sourceRole: 'product_original' }), true);
  assert.equal(canCreateWorkflowFromNode({ ...base, sourceRole: 'style_reference' }), false);
  assert.equal(canCreateWorkflowFromNode({ ...base, sourceRole: 'general_material' }), false);
});
