import test from 'node:test';
import assert from 'node:assert/strict';

import { compileCampaignBible } from '../server/ecommerceEngine/campaignBible.mjs';

test('retains the selected direction title while applying the editable second-step brief', () => {
  const bible = compileCampaignBible({
    id: 'premium-minimal',
    title: 'Premium minimal',
    brief: 'Soft studio restraint',
    objective: 'premium conversion',
    audience: 'design-conscious buyers',
    visualKeywords: [' clean ', 'luxury', 'clean'],
    palette: [' #f5f0eb ', '#333333'],
    lighting: 'softbox',
    composition: 'centered product',
    backgroundLanguage: 'warm white',
    typographyIntent: 'quiet editorial',
    copyTone: 'confident',
    consistencyLocks: ['soft shadow'],
    prohibitedStyles: ['neon'],
  }, {
    title: 'An invented title',
    editableBrief: 'Keep the product hero and leave copy room.',
  });

  assert.equal(bible.directionId, 'premium-minimal');
  assert.equal(bible.title, 'Premium minimal');
  assert.equal(bible.editableBrief, 'Keep the product hero and leave copy room.');
  assert.equal(bible.commercialObjective, 'premium conversion');
  assert.deepEqual(bible.visualKeywords, ['clean', 'luxury']);
  assert.deepEqual(bible.palette, ['#f5f0eb', '#333333']);
  assert.equal(Object.hasOwn(bible, 'role'), false);
});

test('uses custom colors as an immutable palette and adds an explicit palette consistency lock', () => {
  const colors = [' #1155cc ', '#ffffff', '#1155cc'];
  const bible = compileCampaignBible({
    id: 'tech',
    title: 'Precision tech',
    palette: ['#000000'],
    consistencyLocks: ['lighting: cool', 'palette: #1155cc, #ffffff'],
  }, { customColors: colors });

  assert.deepEqual(bible.palette, ['#1155cc', '#ffffff']);
  assert.ok(bible.consistencyLocks.includes('palette: #1155cc, #ffffff'));
  assert.equal(bible.consistencyLocks.filter((lock) => lock === 'palette: #1155cc, #ffffff').length, 1);
  assert.deepEqual(colors, [' #1155cc ', '#ffffff', '#1155cc']);
});

test('replaces every existing palette or color consistency lock for custom colors', () => {
  const bible = compileCampaignBible({
    consistencyLocks: [
      'lighting: cool studio',
      'palette: #000000',
      'colors: muted neutrals',
      'color consistency: avoid warm tones',
    ],
  }, { customColors: ['#1155cc', '#ffffff'] });

  assert.deepEqual(bible.consistencyLocks, [
    'lighting: cool studio',
    'palette: #1155cc, #ffffff',
  ]);
});

test('honors an empty own editable brief override and otherwise falls back to the direction', () => {
  const direction = { brief: 'Keep the product centered.' };

  assert.equal(compileCampaignBible(direction, { editableBrief: '' }).editableBrief, '');
  assert.equal(compileCampaignBible(direction, { editable_brief: '' }).editableBrief, '');
  assert.equal(compileCampaignBible(direction, {}).editableBrief, 'Keep the product centered.');
});

test('returns defensive normalized data without inherited or prototype-polluting fields', () => {
  const direction = JSON.parse(`{
    "id":" editorial ",
    "title":" Editorial ",
    "visualKeywords":[" bold ","bold", ""],
    "referenceAssetIds":[" ref-1 ","ref-1"],
    "__proto__":{"polluted":true}
  }`);
  const overrides = Object.create({ editableBrief: 'inherited brief', referenceAssetIds: ['inherited'] });
  overrides.editableBrief = '  Real editable brief  ';
  overrides.referenceAssetIds = [' ref-2 ', 'ref-2'];
  overrides.constructor = 'unsafe';

  const first = compileCampaignBible(direction, overrides);
  const second = compileCampaignBible(direction, overrides);
  first.visualKeywords.push('mutated');
  first.referenceAssetIds.push('mutated');

  assert.equal(first.directionId, 'editorial');
  assert.equal(first.editableBrief, 'Real editable brief');
  assert.deepEqual(second.visualKeywords, ['bold']);
  assert.deepEqual(second.referenceAssetIds, ['ref-2']);
  assert.equal(Object.hasOwn(second, '__proto__'), false);
  assert.equal({}.polluted, undefined);
});
