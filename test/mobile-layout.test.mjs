import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeCss = readFileSync(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');
const shellCss = readFileSync(new URL('../src/styles/app-shell.css', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const homeSource = readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
const ecommerceModeSource = readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
const shellMobileRules = shellCss.match(/@media \(max-width: 639px\) \{([\s\S]*?)\n\}/)?.[1] || '';

test('mobile ecommerce workbench reserves space above the fixed navigation', () => {
  const mobileRules = homeCss.match(/@media \(max-width: 639px\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(mobileRules, /\.ec-main-card \{[^}]*padding-bottom:\s*max\(84px, calc\(72px \+ env\(safe-area-inset-bottom\)\)\)/);
  assert.match(shellMobileRules, /\.app-side-nav \{[^}]*bottom:\s*max\(10px, env\(safe-area-inset-bottom\)\)/);
});

test('mobile ecommerce actions stay compact and remain in flow below the composer', () => {
  const mobileRules = homeCss.match(/@media \(max-width: 639px\) \{([\s\S]*?)\n\}/)?.[1] || '';

  assert.match(ecommerceModeSource, /className="ec-workbench-actions(?:\s|\")/);
  assert.match(ecommerceModeSource, /className="ec-workbench-tools"/);
  assert.match(ecommerceModeSource, /className="ec-workbench-next"/);
  assert.match(mobileRules, /\.ec-workbench-actions \{[^}]*position:\s*relative[^}]*bottom:\s*auto/);
  assert.match(mobileRules, /\.ec-workbench-actions \{[^}]*flex-direction:\s*column/);
  assert.match(mobileRules, /\.ec-workbench-primary-row \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/);
  assert.match(mobileRules, /\.ec-workbench-submit-actions \{[^}]*gap:\s*6px/);
  assert.match(mobileRules, /\.ec-workbench-tools \{[^}]*overflow-x:\s*auto[^}]*flex-wrap:\s*nowrap/);
});

test('homepage clips only horizontal decoration so sticky mobile actions can follow vertical scrolling', () => {
  assert.match(homeSource, /overflowX:\s*'clip'/);
  assert.doesNotMatch(homeSource, /overflow:\s*'hidden'/);
});

test('mobile top bar keeps the product brand on one line without crowding account actions', () => {
  assert.match(appSource, /app-topbar/);
  assert.match(appSource, /className="topbar-row"/);
  assert.match(appSource, /className="topbar-brand"/);
  assert.match(appSource, /className="topbar-actions"/);
  assert.match(shellMobileRules, /\.topbar-logo \{[^}]*white-space:\s*nowrap/);
  assert.match(shellMobileRules, /\.topbar-row \{[^}]*padding-inline:\s*14px/);
  assert.match(shellMobileRules, /\.topbar-actions button \{[^}]*padding-inline:\s*12px/);
});

test('global task dock uses a stable accessible button instead of an eight pixel hover strip', () => {
  const source = readFileSync(new URL('../src/components/task/TaskSidebar.jsx', import.meta.url), 'utf8');
  assert.match(source, /aria-label="打开任务列表"/);
  assert.match(source, /aria-expanded=\{open\}/);
  assert.match(source, /onClick=\{\(\) => setOpen/);
  assert.doesNotMatch(source, /SIDEBAR_WIDTH_COLLAPSED\s*=\s*8/);
});

test('mobile Canvas action picker remains in transformed world coordinates', () => {
  const workflowCss = readFileSync(new URL('../src/pages/EcCanvas/components/workflowNodes/workflowNodes.css', import.meta.url), 'utf8');
  const mobileBlock = workflowCss.match(/@media \(max-width: 700px\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(mobileBlock, /\.workflow-action-picker\s*\{[\s\S]*?position:\s*fixed/);
  assert.match(workflowCss, /\.workflow-picker-list\s*\{[^}]*overflow-y:\s*auto/);
});
