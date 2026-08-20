import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const component = fs.readFileSync(new URL('../src/components/layout/CreativeDomainNav.jsx', import.meta.url), 'utf8');
const shellCss = fs.readFileSync(new URL('../src/styles/app-shell.css', import.meta.url), 'utf8');

test('desktop creative navigation renders its panel in a fixed body-level viewport', () => {
  assert.match(component, /createPortal/);
  assert.match(component, /document\.body/);
  assert.match(component, /creative-nav-viewport/);
  assert.match(component, /creative-nav-mobile-backdrop[\s\S]*document\.body/);
  assert.match(shellCss, /\.creative-nav-viewport\s*\{[\s\S]*position:\s*fixed/);
  assert.match(shellCss, /\.creative-nav-viewport-bridge\s*\{/);
  assert.match(component, /creative-nav-domain-mark/);
  assert.match(component, /creative-nav-link-index/);
  assert.match(component, /is-single-destination/);
  assert.match(component, /creative-nav-arrow-left/);
  assert.match(shellCss, /\.creative-nav-link-index\s*\{/);
  assert.match(shellCss, /\.creative-nav-panel\.is-single-destination/);
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

test('panel motion stays on the visual anchor and supports reduced motion', () => {
  assert.match(component, /handlePanelVisualPointerMove/);
  assert.match(component, /--nav-pointer-x/);
  assert.match(shellCss, /\.creative-nav-panel-icon[\s\S]*translate\(calc\(var\(--nav-pointer-x\)/);
  assert.match(shellCss, /prefers-reduced-motion/);
});
