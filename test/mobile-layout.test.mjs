import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeCss = readFileSync(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const homeSource = readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
const ecommerceModeSource = readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');

test('mobile ecommerce workbench reserves space above the fixed navigation', () => {
  const mobileRules = homeCss.match(/@media \(max-width: 639px\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(mobileRules, /\.ec-main-card \{[^}]*padding-bottom:\s*max\(84px, calc\(72px \+ env\(safe-area-inset-bottom\)\)\)/);
  assert.match(mobileRules, /\.app-side-nav \{[^}]*bottom:\s*max\(10px, env\(safe-area-inset-bottom\)\)/);
});

test('mobile ecommerce actions stay compact and sticky above the fixed navigation', () => {
  const mobileRules = homeCss.match(/@media \(max-width: 639px\) \{([\s\S]*?)\n\}/)?.[1] || '';

  assert.match(ecommerceModeSource, /className="ec-workbench-actions"/);
  assert.match(ecommerceModeSource, /className="ec-workbench-tools"/);
  assert.match(ecommerceModeSource, /className="ec-workbench-next"/);
  assert.match(mobileRules, /\.ec-workbench-actions \{[^}]*position:\s*sticky[^}]*bottom:\s*max\(74px, calc\(64px \+ env\(safe-area-inset-bottom\)\)\)/);
  assert.match(mobileRules, /\.ec-workbench-actions \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(mobileRules, /\.ec-workbench-tools \{[^}]*overflow-x:\s*auto[^}]*flex-wrap:\s*nowrap/);
});

test('homepage clips only horizontal decoration so sticky mobile actions can follow vertical scrolling', () => {
  assert.match(homeSource, /overflowX:\s*'clip'/);
  assert.doesNotMatch(homeSource, /overflow:\s*'hidden'/);
});

test('mobile top bar keeps the product brand on one line without crowding account actions', () => {
  const mobileRules = homeCss.match(/@media \(max-width: 639px\) \{([\s\S]*?)\n\}/)?.[1] || '';

  assert.match(appSource, /className="app-topbar"/);
  assert.match(appSource, /className="topbar-row"/);
  assert.match(appSource, /className="topbar-brand"/);
  assert.match(appSource, /className="topbar-actions"/);
  assert.match(mobileRules, /\.topbar-logo \{[^}]*white-space:\s*nowrap/);
  assert.match(mobileRules, /\.topbar-row \{[^}]*padding-inline:\s*14px/);
  assert.match(mobileRules, /\.topbar-actions button \{[^}]*padding-inline:\s*12px/);
});
