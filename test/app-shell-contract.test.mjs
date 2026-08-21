import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const shellCssPath = new URL('../src/styles/app-shell.css', import.meta.url);
const shellCss = existsSync(shellCssPath) ? readFileSync(shellCssPath, 'utf8') : '';
const desktopShellCss = shellCss.split('@media (max-width: 639px)')[0];
const topBarBlock = app.match(/className="app-topbar"[\s\S]*?style=\{\{([\s\S]*?)\}\}/)?.[1] || '';

test('app shell uses the creative domain navigation contract', () => {
  assert.match(app, /import '\.\/styles\/app-shell\.css'/);
  assert.doesNotMatch(topBarBlock, /position:\s*'sticky'|top:\s*0/);
  assert.match(app, /CreativeDomainNav/);
  assert.match(app, /function SideNav\(\)/);
  assert.match(app, /className="app-side-nav"/);
  assert.match(app, /page !== 'ec-canvas' && <SideNav \/>/);
  assert.match(app, /const canAdmin = state\.accountAccess\?\.role === 'owner'/);
  assert.match(shellCss, /\.creative-nav-desktop \{/);
  assert.match(shellCss, /\.creative-nav-panel \{/);
  assert.match(shellCss, /\.creative-nav-panel\s*\{[\s\S]*?width:\s*100%/);
  assert.match(shellCss, /\.creative-nav-panel-links\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(shellCss, /\.creative-nav-panel-links\s*\{[\s\S]*?border-left:\s*0/);
  assert.doesNotMatch(shellCss, /\.creative-nav-signature\s*\{/);
  assert.doesNotMatch(shellCss, /\.creative-nav-panel-intro\s*\{/);
  assert.doesNotMatch(shellCss, /\.creative-nav-link-index\s*\{/);
  assert.match(shellCss, /\.creative-nav-mobile-drawer \{/);
  assert.match(shellCss, /\.creative-nav-trigger:focus-visible/);
  assert.match(shellCss, /@media \(max-width:\s*639px\)[\s\S]*?\.creative-nav-mobile-trigger/);
  assert.match(shellCss, /@media \(prefers-reduced-motion:\s*reduce\)/);
});
