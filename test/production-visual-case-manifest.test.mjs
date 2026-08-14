import test from 'node:test';
import assert from 'node:assert/strict';

import { PRODUCTION_VISUAL_CASES, productionVisualCaseById } from '../scripts/production-visual-case-manifest.mjs';

const SKILLS = new Set(['free', 'poster', 'social-cover', 'brand-kv']);
const RATIOS = new Set(['1:1', '3:4', '4:3', '9:16', '16:9', '21:9']);

test('formal visual case manifest covers six distinct showcases per Skill plus the production source asset', () => {
  assert.equal(PRODUCTION_VISUAL_CASES.length, 25);
  for (const skillId of SKILLS) {
    const cases = PRODUCTION_VISUAL_CASES.filter(item => item.skillId === skillId);
    const expectedCount = skillId === 'free' ? 7 : 6;
    assert.equal(cases.length, expectedCount);
    assert.equal(new Set(cases.map(item => item.topic)).size, expectedCount);
    assert.equal(new Set(cases.map(item => item.prompt)).size, expectedCount);
    assert.equal(new Set(cases.map(item => item.requestKey)).size, expectedCount);
  }
});

test('formal visual cases use supported production dimensions and durable identities', () => {
  assert.equal(new Set(PRODUCTION_VISUAL_CASES.map(item => item.id)).size, PRODUCTION_VISUAL_CASES.length);
  for (const item of PRODUCTION_VISUAL_CASES) {
    assert.ok(SKILLS.has(item.skillId));
    assert.ok(RATIOS.has(item.ratio));
    assert.equal(item.resolution, '2K');
    assert.equal(item.imageModel, 'image2');
    assert.match(item.requestKey, /^showcase-20260813-[a-z0-9-]+$/);
    assert.ok(item.prompt.length >= 80);
    assert.equal(productionVisualCaseById(item.id), item);
  }
});

test('social cases cover platform-native shapes instead of one topic cropped repeatedly', () => {
  const cases = PRODUCTION_VISUAL_CASES.filter(item => item.skillId === 'social-cover');
  assert.deepEqual(new Set(cases.map(item => item.platform)), new Set(['小红书', '公众号', 'B站', '抖音']));
  assert.ok(cases.some(item => item.platform === '小红书' && item.ratio === '3:4'));
  assert.ok(cases.some(item => item.platform === '公众号' && item.ratio === '21:9'));
  assert.ok(cases.some(item => item.platform === 'B站' && item.ratio === '16:9'));
  assert.ok(cases.some(item => item.platform === '抖音' && item.ratio === '9:16'));
});
