import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowNoteModal } from '../src/routing/resultRouting.js';

test('never opens the generic result modal for an ecommerce result after leaving canvas', () => {
  assert.equal(shouldShowNoteModal({ page: 'home', result: { _ecResult: true } }), false);
  assert.equal(shouldShowNoteModal({ page: 'ec-canvas', result: { _ecResult: true } }), false);
});

test('keeps the generic modal for regular content results', () => {
  assert.equal(shouldShowNoteModal({ page: 'home', result: { title: '普通图文结果' } }), true);
  assert.equal(shouldShowNoteModal({ page: 'home', result: null }), false);
});
