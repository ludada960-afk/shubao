import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCanvasGenerationPrompt,
  normalizeCreationIntent,
  normalizeVisualSkillId,
} from '../server/visualCreationSkills.mjs';

test('creation intent and visual skill ids are server allowlisted', () => {
  assert.equal(normalizeCreationIntent('visual'), 'visual');
  assert.equal(normalizeCreationIntent('anything-else'), 'ecommerce');
  assert.equal(normalizeVisualSkillId('poster'), 'poster');
  assert.equal(normalizeVisualSkillId('private-system-prompt'), 'free');
});

test('visual prompts are generic, skill-aware and preserve reference identity without ecommerce leakage', () => {
  const prompt = buildCanvasGenerationPrompt({
    creationIntent: 'visual',
    skillId: 'poster',
    userPrompt: '夏日音乐节，标题为 SUNSET LIVE',
    hasImageInputs: true,
    referenceNote: ' Reference images are indexed.',
    mentionNote: ' Resolve @主图.',
  });
  assert.match(prompt, /poster/i);
  assert.match(prompt, /SUNSET LIVE/);
  assert.match(prompt, /Preserve the recognizable identity/);
  assert.match(prompt, /visual hierarchy/i);
  assert.doesNotMatch(prompt, /ecommerce/i);
  assert.match(prompt, /typography/i);
  assert.match(prompt, /exactly as supplied/i);
});

test('social and brand recipes encode their distinct production constraints', () => {
  const social = buildCanvasGenerationPrompt({ creationIntent: 'visual', skillId: 'social-cover', userPrompt: '小红书：周末露营清单', hasImageInputs: false });
  const brand = buildCanvasGenerationPrompt({ creationIntent: 'visual', skillId: 'brand-kv', userPrompt: '护肤新品春季主视觉', hasImageInputs: true });
  assert.match(social, /mobile thumbnail/i);
  assert.match(social, /render requested title text/i);
  assert.match(social, /platform/i);
  assert.match(brand, /campaign system/i);
  assert.match(brand, /product geometry/i);
});

test('visual generation size registry supports social and brand native wide formats', async () => {
  const { resolveGenerationSize } = await import('../server/ecommerceEngine/modelCatalog.mjs');
  assert.equal(resolveGenerationSize({ resolution: '2K', ratio: '16:9' }).size, '2048x1152');
  assert.equal(resolveGenerationSize({ resolution: '2K', ratio: '21:9' }).size, '2048x864');
});

test('default Canvas prompts retain the existing ecommerce contract', () => {
  const prompt = buildCanvasGenerationPrompt({
    creationIntent: 'ecommerce',
    userPrompt: '换成夏日场景',
    hasImageInputs: true,
  });
  assert.match(prompt, /polished ecommerce product visual/i);
  assert.match(prompt, /Preserve the supplied product identity and structure/);
});
