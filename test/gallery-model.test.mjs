import assert from 'node:assert/strict';
import test from 'node:test';

import { appendGalleryItemsWithoutReordering, dedupeGalleryItems, stableGalleryColumns, tryOnWorkflowCards } from '../src/pages/Home/galleryModel.js';

test('gallery removes duplicate covers even when records use different ids and intents', () => {
  const items = dedupeGalleryItems([
    { id: 'a', intent: 'poster', cover_url: '/images/example.png?variant=thumb' },
    { id: 'b', intent: 'free', cover_url: '/images/example.png?variant=display' },
    { id: 'c', intent: 'free', cover_url: '/images/another.png' },
  ]);
  assert.deepEqual(items.map(item => item.id), ['a', 'c']);
});

test('gallery column assignment is stable when later items become visible', () => {
  const items = Array.from({ length: 32 }, (_, index) => ({ id: `case-${index}`, ratio: index % 3 === 0 ? '16:9' : '3:4' }));
  const columns = stableGalleryColumns(items, 4);
  const initialAssignments = new Map(columns.flatMap((column, columnIndex) => column
    .filter(entry => entry.index < 16)
    .map(entry => [entry.item.id, columnIndex])));
  const afterScrollAssignments = new Map(columns.flatMap((column, columnIndex) => column
    .filter(entry => entry.index < 28)
    .map(entry => [entry.item.id, columnIndex])));
  for (const [id, columnIndex] of initialAssignments) assert.equal(afterScrollAssignments.get(id), columnIndex);
});

test('late gallery data appends without moving cases the user has already seen', () => {
  const initial = [{ id: 'a', type: 'visual' }, { id: 'b', type: 'ecommerce' }];
  const merged = appendGalleryItemsWithoutReordering(initial, [
    { id: 'late', type: 'xiaohongshu' },
    { id: 'a', type: 'visual', title: 'updated' },
  ]);
  assert.deepEqual(merged.map(item => item.id), ['a', 'b', 'late']);
  assert.equal(merged[0].title, 'updated');
});

test('try-on workflow cards do not duplicate a result when no reference model is present', () => {
  const cards = tryOnWorkflowCards({
    assets: [
      { id: 'source', role: 'source', url: '/images/source.webp' },
      { id: 'result', role: 'result', url: '/images/result.webp' },
    ],
  });
  assert.deepEqual(cards.map(card => card.id), ['source', 'result']);
});
