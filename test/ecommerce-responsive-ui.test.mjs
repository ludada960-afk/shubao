import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const ecMode = await readFile(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
const homeStyles = await readFile(new URL('../src/pages/Home/Home.css', import.meta.url), 'utf8');

test('ecommerce mobile controls use a bounded grid instead of hiding configuration actions off-screen', () => {
  assert.match(ecMode, /className="ec-workbench-actions ec-commerce-workbench-actions"/);
  assert.match(homeStyles, /\.ec-commerce-workbench-actions \.ec-workbench-tools\s*\{[\s\S]*?display:\s*grid/);
  assert.match(homeStyles, /\.ec-commerce-workbench-actions \.ec-workbench-tools\s*\{[\s\S]*?overflow:\s*visible/);
  assert.match(homeStyles, /\.ec-commerce-workbench-actions \.ec-workbench-primary-row\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(homeStyles, /\.ec-commerce-workbench-actions \.ec-workbench-submit-actions\s*\{[\s\S]*?justify-content:\s*flex-end/);
});
