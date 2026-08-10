import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const shellCssPath = new URL('../src/styles/app-shell.css', import.meta.url);
const shellCss = existsSync(shellCssPath) ? readFileSync(shellCssPath, 'utf8') : '';
const topBarBlock = app.match(/className="app-topbar"[\s\S]*?style=\{\{([\s\S]*?)\}\}/)?.[1] || '';

test('app shell uses the global header and navigation contract', () => {
  assert.match(app, /import '\.\/styles\/app-shell\.css'/);
  assert.doesNotMatch(topBarBlock, /position:\s*'sticky'|top:\s*0/);
  assert.match(app, /className=\{`app-side-nav-item/);
  assert.match(app, /className="app-side-nav-label"/);
  assert.doesNotMatch(app, /onMouseEnter=|onMouseLeave=/);
  assert.match(shellCss, /\.app-side-nav-item:hover[\s\S]*?width:\s*118px/);
  assert.match(shellCss, /\.app-side-nav-item:focus-visible/);
  assert.match(shellCss, /@media \(max-width:\s*639px\)[\s\S]*?\.app-side-nav-label[\s\S]*?display:\s*none/);
  assert.match(shellCss, /@media \(prefers-reduced-motion:\s*reduce\)/);
});
