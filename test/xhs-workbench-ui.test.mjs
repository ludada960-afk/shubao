import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const deck = await readFile(new URL('../src/pages/Home/ec/components/SupplementAssetDeck.jsx', import.meta.url), 'utf8');
const ecommerceCards = await readFile(new URL('../src/pages/Home/ec/components/EcommerceAssetCards.jsx', import.meta.url), 'utf8');
const xhs = await readFile(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8');
const showcaseStyles = await readFile(new URL('../src/pages/Home/CreationShowcase.css', import.meta.url), 'utf8');

test('shared deck keeps ecommerce default and allows straight XHS rendering', () => {
  assert.match(deck, /tilted\s*=\s*true/);
  assert.match(xhs, /EcommerceImageCard/);
});

test('XHS controls use independent option keys and upward panel class', () => {
  assert.match(xhs, /activeOption/);
  assert.match(xhs, /onOptionToggle/);
  assert.match(xhs, /xhs-template-options--upward/);
});

test('XHS compact workbench puts content and Plog in the shared top selector', () => {
  assert.match(xhs, /function XhsModeSelector/);
  assert.match(xhs, /className="ec-ability-selector xhs-ability-selector"/);
  assert.match(xhs, /className=\{`ec-ability-selector-option/);
  assert.match(xhs, /aria-selected=\{selected\}/);
  assert.match(xhs, /<CreationShowcase mode="content" subMode=\{xhsSubMode\}/);
  assert.doesNotMatch(xhs, /className="xhs-mode-tabs"/);
});

test('XHS option trigger points upward while its panel is open', () => {
  assert.match(xhs, /activeOption === key \? <ChevronUp/);
  assert.match(xhs, /xhs-template-options--upward/);
});

test('XHS selector styles keep the fan cards and mobile panel inside the workbench', () => {
  assert.match(showcaseStyles, /\.xhs-ability-selector \.ec-ability-selector-fan\.is-empty/);
  assert.match(showcaseStyles, /\.xhs-workbench-card/);
  assert.match(showcaseStyles, /\.xhs-template-options--upward \{ left: 50%;/);
});

test('XHS reuses the ecommerce upload cards and localizes only the content labels', () => {
  assert.match(xhs, /EcommerceImageCard/);
  assert.match(xhs, /EcommerceAddCard/);
  assert.match(xhs, /我的素材/);
  assert.match(xhs, /生活素材/);
  assert.match(ecommerceCards, /ec-xhs-upload-card/);
});

test('XHS workbench keeps the ecommerce spacing and full article body', () => {
  assert.match(showcaseStyles, /\.xhs-input-template \.ec-xhs-composer \{ padding: 8px 10px 10px/);
  assert.match(showcaseStyles, /\.xhs-template-tools \{ display: grid/);
  assert.match(xhs, /9 张生活记录 \| 1 篇正文/);
});
