import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CREATIVE_NAV_GROUPS,
  getNavigationItem,
  getNavigationTarget,
  isNavigationGroupActive,
} from '../src/components/layout/creativeDomainNavigation.js';

test('navigation exposes the four confirmed creation domains in product order', () => {
  assert.deepEqual(CREATIVE_NAV_GROUPS.map(group => group.id), [
    'commerce', 'video', 'content', 'visual',
  ]);
  assert.deepEqual(CREATIVE_NAV_GROUPS.map(group => group.label), [
    '电商生图', '视频生成', '小红书图文', '自由创作',
  ]);
});

test('video remains a single undivided creation entry', () => {
  const video = CREATIVE_NAV_GROUPS.find(group => group.id === 'video');
  assert.equal(video.items.length, 1);
  assert.equal(video.items[0].id, 'video-studio');
  assert.equal(video.items.some(item => item.id.includes('frame') || item.id.includes('reconstruction')), false);
});

test('free visual navigation names the supported visual skills', () => {
  const visual = CREATIVE_NAV_GROUPS.find(group => group.id === 'visual');
  assert.deepEqual(visual.items.map(item => item.id), [
    'visual-free', 'visual-poster', 'visual-social-cover', 'visual-brand-kv',
  ]);
});

test('navigation targets reuse existing app actions', () => {
  assert.deepEqual(getNavigationTarget('video', 'video-studio'), { type: 'NAVIGATE', page: 'video-studio' });
  assert.deepEqual(getNavigationTarget('content', 'content-xhs'), { type: 'SET_MODE', mode: 'content' });
});

test('navigation items carry only client-side launch intent for nested workbench choices', () => {
  assert.deepEqual(getNavigationItem('commerce', 'commerce-tryon').launch, { mode: 'ecommerce', recipeId: 'anything_tryon' });
  assert.deepEqual(getNavigationItem('content', 'content-plog').launch, { mode: 'content', subMode: 'plog' });
  assert.deepEqual(getNavigationItem('visual', 'visual-poster').launch, { mode: 'visual', skillId: 'poster' });
});

test('active state follows the current page or creation mode', () => {
  assert.equal(isNavigationGroupActive('video', { page: 'video-studio', mode: 'ecommerce' }), true);
  assert.equal(isNavigationGroupActive('content', { page: 'home', mode: 'content' }), true);
  assert.equal(isNavigationGroupActive('visual', { page: 'home', mode: 'visual' }), true);
  assert.equal(isNavigationGroupActive('commerce', { page: 'home', mode: 'ecommerce' }), true);
});
