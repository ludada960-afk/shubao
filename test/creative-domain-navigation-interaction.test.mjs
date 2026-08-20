import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { CREATIVE_NAV_GROUPS } from '../src/components/layout/creativeDomainNavigation.js';

const component = fs.readFileSync(new URL('../src/components/layout/CreativeDomainNav.jsx', import.meta.url), 'utf8');
const shellCss = fs.readFileSync(new URL('../src/styles/app-shell.css', import.meta.url), 'utf8');

test('desktop creative navigation renders its panel in a fixed body-level viewport', () => {
  assert.match(component, /createPortal/);
  assert.match(component, /document\.body/);
  assert.match(component, /creative-nav-viewport/);
  assert.match(component, /creative-nav-mobile-backdrop[\s\S]*document\.body/);
  assert.match(shellCss, /\.creative-nav-viewport\s*\{[\s\S]*position:\s*fixed/);
  assert.match(shellCss, /\.creative-nav-viewport-bridge\s*\{/);
  assert.doesNotMatch(component, /creative-nav-panel-heading/);
  assert.match(component, /creative-nav-item-icon/);
  assert.match(component, /creative-nav-glyph-part/);
  assert.doesNotMatch(component, /creative-nav-domain-mark/);
  assert.doesNotMatch(component, /creative-nav-link-index/);
  assert.doesNotMatch(component, /is-single-destination/);
  assert.match(component, /creative-nav-arrow-left/);
  assert.match(shellCss, /\.creative-nav-panel--items-4/);
  assert.match(shellCss, /\.creative-nav-item-icon\s*\{/);
  assert.doesNotMatch(shellCss, /\.creative-nav-link-index\s*\{/);
  assert.doesNotMatch(shellCss, /\.creative-nav-panel-intro\s*\{/);
});

test('every destination has semantic icon and motion metadata while video stays a single entry', () => {
  const items = CREATIVE_NAV_GROUPS.flatMap(group => group.items);
  assert.equal(CREATIVE_NAV_GROUPS.find(group => group.id === 'video')?.items.length, 1);
  assert.ok(items.length >= 12);
  for (const item of items) {
    assert.match(item.icon, /^[a-z-]+$/);
    assert.match(item.motion, /^[a-z-]+$/);
  }
  assert.equal(new Set(items.map(item => item.motion)).size, items.length);
});

test('top-level domain clicks pin the menu instead of launching the first child', () => {
  assert.match(component, /toggleDesktopGroup/);
  assert.match(component, /onClick=\{\(\) => toggleDesktopGroup\(group\.id\)\}/);
  const triggerBlock = component.match(/className=\{`creative-nav-trigger[\s\S]*?onKeyDown=\{event => handleTriggerKeyDown\(event, group\.id\)\}/)?.[0] || '';
  assert.doesNotMatch(triggerBlock, /runTarget\(group\.id, group\.items\[0\]\.id\)/);
});

test('pointer transitions and outside interaction keep the viewport usable', () => {
  assert.match(component, /onPointerEnter=\{clearCloseTimer\}/);
  assert.match(component, /onPointerLeave=\{scheduleDesktopClose\}/);
  assert.match(component, /pointerdown/);
  assert.match(component, /focusin/);
  assert.match(component, /clearCloseTimer/);
});

test('destination motion is explicit, pointer-safe, and supports reduced motion', () => {
  assert.match(component, /creative-nav-glyph-part/);
  assert.match(component, /item\.motion/);
  assert.match(shellCss, /creative-nav-fragment-assemble/);
  assert.match(shellCss, /creative-nav-orbit-pulse/);
  assert.match(shellCss, /@media \(hover:\s*hover\) and \(pointer:\s*fine\)/);
  assert.match(shellCss, /prefers-reduced-motion/);
});
