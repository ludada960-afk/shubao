import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const shellCssPath = new URL('../src/styles/app-shell.css', import.meta.url);
const shellCss = existsSync(shellCssPath) ? readFileSync(shellCssPath, 'utf8') : '';
const desktopShellCss = shellCss.split('@media (max-width: 639px)')[0];
const topBarBlock = app.match(/className="app-topbar"[\s\S]*?style=\{\{([\s\S]*?)\}\}/)?.[1] || '';

test('app shell uses the global header and navigation contract', () => {
  assert.match(app, /import '\.\/styles\/app-shell\.css'/);
  assert.doesNotMatch(topBarBlock, /position:\s*'sticky'|top:\s*0/);
  assert.match(app, /className=\{`app-side-nav-item/);
  assert.match(app, /className="app-side-nav-tooltip"/);
  assert.match(app, /data-nav-icon=\{item\.motion\}/);
  assert.match(app, /Sparkles, LayoutGrid, SquarePlay, FolderOpen/);
  assert.doesNotMatch(app, /onMouseEnter=|onMouseLeave=/);
  assert.match(shellCss, /\.app-side-nav-item \{[\s\S]*?width:\s*44px[\s\S]*?height:\s*44px/);
  assert.doesNotMatch(desktopShellCss, /\.app-side-nav-item:hover\s*\{[^}]*width:/);
  assert.doesNotMatch(desktopShellCss, /\.app-side-nav-item:focus-visible\s*\{[^}]*width:/);
  assert.match(shellCss, /\.app-side-nav-item:focus-visible/);
  assert.match(shellCss, /\.app-side-nav-icon svg > \*[\s\S]*?420ms cubic-bezier\(0\.34,\s*1\.56,\s*0\.64,\s*1\)/);
  assert.match(shellCss, /\.app-side-nav-icon svg > :nth-child\(2\)[^}]*transition-delay:\s*55ms/);
  assert.match(shellCss, /\.app-side-nav-icon svg > :nth-child\(3\)[^}]*transition-delay:\s*80ms/);
  assert.match(shellCss, /\.app-side-nav-icon svg > :nth-child\(4\)[^}]*transition-delay:\s*110ms/);
  assert.match(shellCss, /\.app-side-nav-item:is\(:hover,\s*:focus-visible\) \.motion-grid/);
  assert.match(shellCss, /@media \(max-width:\s*639px\)[\s\S]*?\.app-side-nav-tooltip[\s\S]*?display:\s*none/);
  assert.match(shellCss, /@media \(prefers-reduced-motion:\s*reduce\)/);
});
