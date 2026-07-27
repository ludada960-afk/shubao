import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeCss = readFileSync(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');

test('mobile ecommerce workbench reserves space above the fixed navigation', () => {
  const mobileRules = homeCss.match(/@media \(max-width: 639px\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(mobileRules, /\.ec-main-card \{[^}]*padding-bottom:\s*max\(84px, calc\(72px \+ env\(safe-area-inset-bottom\)\)\)/);
  assert.match(mobileRules, /\.app-side-nav \{[^}]*bottom:\s*max\(10px, env\(safe-area-inset-bottom\)\)/);
});
