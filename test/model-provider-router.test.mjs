import assert from 'node:assert/strict';
import test from 'node:test';
import { createModelProviderRouter } from '../server/ecommerceEngine/modelProviderRouter.mjs';

function adapter(name) { return {
  async submitEdit() { return { jobId: `${name}-job`, status: 'submitted' }; },
  async poll(jobId) { return { jobId, status: 'completed', outputUrl: `${name}.png` }; },
  async pollUntilReady(jobId) { return { jobId, status: 'completed', outputUrl: `${name}.png` }; },
}; }

test('routes Nano jobs by provider metadata and preserves the provider across polling', async () => {
  const router = createModelProviderRouter({ image2: adapter('image2'), nanoBanana: adapter('nano') });
  const submitted = await router.submitEdit({ modelRoute: { provider: 'nano-banana' } });
  assert.equal(submitted.jobId, 'nano:nano-job');
  assert.equal((await router.pollUntilReady(submitted.jobId)).outputUrl, 'nano.png');
  assert.equal((await router.submitEdit({ modelRoute: { provider: 'image2' } })).jobId, 'image2:image2-job');
});
