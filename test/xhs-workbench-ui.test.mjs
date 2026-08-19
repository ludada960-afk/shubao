import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const deck = await readFile(new URL('../src/pages/Home/ec/components/SupplementAssetDeck.jsx', import.meta.url), 'utf8');
const xhs = await readFile(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8');
const showcaseStyles = await readFile(new URL('../src/pages/Home/CreationShowcase.css', import.meta.url), 'utf8');

test('shared deck keeps ecommerce default and allows straight XHS rendering', () => {
  assert.match(deck, /tilted\s*=\s*true/);
  assert.match(xhs, /tilted=\{false\}/);
});

test('XHS controls use independent option keys and upward panel class', () => {
  assert.match(xhs, /activeOption/);
  assert.match(xhs, /onOptionToggle/);
  assert.match(xhs, /xhs-template-options--upward/);
});

test('XHS compact workbench puts content and Plog in the shared top selector', () => {
  assert.match(xhs, /function XhsModeSelector/);
  assert.match(xhs, /className="xhs-mode-selector"/);
  assert.match(xhs, /className=\{`xhs-mode-card/);
  assert.match(xhs, /aria-selected=\{selected\}/);
  assert.match(xhs, /<CreationShowcase mode="content" subMode=\{xhsSubMode\}/);
  assert.doesNotMatch(xhs, /className="xhs-mode-tabs"/);
});

test('XHS option trigger points upward while its panel is open', () => {
  assert.match(xhs, /activeOption === key \? <ChevronUp/);
  assert.match(xhs, /xhs-template-options--upward/);
});

test('XHS selector styles keep the fan cards and mobile panel inside the workbench', () => {
  assert.match(showcaseStyles, /\.xhs-mode-fan-card\.fan-card-0/);
  assert.match(showcaseStyles, /\.xhs-mode-fan\.is-empty/);
  assert.match(showcaseStyles, /\.xhs-workbench-card/);
  assert.match(showcaseStyles, /\.xhs-template-option-slot \{ position: static; \}/);
  assert.match(showcaseStyles, /\.xhs-template-options--upward \{ left: 50%;/);
});

test('Plog localizes the shared upload deck without creating a second component', () => {
  assert.match(xhs, /productUploadLabel=\{plog \? '上传生活素材'/);
  assert.match(xhs, /productContinuationLabel=\{plog \? '继续添加生活素材'/);
});
