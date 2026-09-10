// 契约: 四个创作域统一在首页模块内切换 (用户 9-10 反馈: 点"视频生成"跳去打不开的独立视频创作页)
import assert from 'node:assert/strict';
import test from 'node:test';
import { CREATIVE_NAV_GROUPS } from '../src/components/layout/creativeDomainNavigation.js';

const EXPECTED_MODE = { commerce: 'ecommerce', video: 'video', content: 'content', visual: 'visual' };

test('every creation domain switches the home module instead of jumping to a standalone page', () => {
  for (const group of CREATIVE_NAV_GROUPS) {
    assert.equal(group.primaryAction?.type, 'SET_MODE', group.id + ' primaryAction must be SET_MODE');
    assert.equal(group.primaryAction?.mode, EXPECTED_MODE[group.id], group.id + ' must switch to its own home mode');
    for (const item of group.items) {
      assert.notEqual(item.action?.type, 'NAVIGATE', group.id + '/' + item.id + ' must not navigate away from the home module');
    }
  }
});

test('the video domain no longer points at the standalone video-studio page', () => {
  const video = CREATIVE_NAV_GROUPS.find(group => group.id === 'video');
  assert.equal(video.primaryAction.type, 'SET_MODE');
  assert.equal(video.primaryAction.mode, 'video');
  assert.equal(video.items[0].action.type, 'SET_MODE');
  assert.equal(video.items[0].action.mode, 'video');
});