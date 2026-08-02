import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const VLM_CLIENT = new URL('../server/ecommerceEngine/vlmClient.mjs', import.meta.url);
const SERVER = new URL('../server/index.mjs', import.meta.url);
const ENV_EXAMPLE = new URL('../server/.env.example', import.meta.url);

test('uses the production-probed GPT-5.6 Luna route as the default visual analysis model', async () => {
  const [vlmClient, server, envExample] = await Promise.all([
    readFile(VLM_CLIENT, 'utf8'),
    readFile(SERVER, 'utf8'),
    readFile(ENV_EXAMPLE, 'utf8'),
  ]);

  assert.match(vlmClient, /model:\s*process\.env\.MINI_MODEL\s*\|\|\s*['"]gpt-5\.6-luna['"]/);
  assert.match(server, /const MINI_MODEL\s*=\s*process\.env\.MINI_MODEL\s*\|\|\s*['"]gpt-5\.6-luna['"]/);
  assert.match(envExample, /^MINI_MODEL=gpt-5\.6-luna$/m);
  assert.match(envExample, /^VISUAL_ANALYSIS_PROMPT_VERSION=visual-analysis-v3$/m);
  assert.match(server, /VISUAL_ANALYSIS_PROMPT_VERSION\s*\|\|\s*['"]visual-analysis-v3['"]/);
});
