import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldShowNoteModal } from '../src/routing/resultRouting.js';

test('never opens the generic result modal for an ecommerce result after leaving canvas', () => {
  assert.equal(shouldShowNoteModal({ page: 'home', result: { _ecResult: true } }), false);
  assert.equal(shouldShowNoteModal({ page: 'ec-canvas', result: { _ecResult: true } }), false);
});

test('keeps the generic modal for regular content results', () => {
  assert.equal(shouldShowNoteModal({ page: 'home', result: { title: '普通图文结果' } }), true);
  assert.equal(shouldShowNoteModal({ page: 'home', result: null }), false);
});

test('never auto-opens an empty result modal (blank popup regression)', () => {
  // 画布"新建画布"曾把 result 置为 {}，回首页会弹出只有"暂无图片"的空白弹窗
  assert.equal(shouldShowNoteModal({ page: 'home', result: {} }), false);
  assert.equal(shouldShowNoteModal({ page: 'home', result: { _ecResult: false } }), false);
  assert.equal(shouldShowNoteModal({ page: 'home', result: { _saveKey: 'x', projectId: 'p', canvasSessionId: 's' } }), false);
  assert.equal(shouldShowNoteModal({ page: 'home', result: { image_urls: [], images: [], imageRecords: [] } }), false);
  assert.equal(shouldShowNoteModal({ page: 'home', result: { cover_url: '   ' } }), false);
  assert.equal(shouldShowNoteModal({ page: 'home', result: { title: '   ' } }), false);
  assert.equal(shouldShowNoteModal({ page: 'home', result: 'not-an-object' }), false);
});

test('opens the result modal as soon as there is something to show', () => {
  assert.equal(shouldShowNoteModal({ page: 'home', result: { cover_url: 'https://cdn/a.png' } }), true);
  assert.equal(shouldShowNoteModal({ page: 'home', result: { image_urls: ['https://cdn/a.png'] } }), true);
  assert.equal(shouldShowNoteModal({ page: 'home', result: { images: [{ url: 'https://cdn/a.png' }] } }), true);
  assert.equal(shouldShowNoteModal({ page: 'home', result: { imageRecords: [{ src: 'https://cdn/a.png' }] } }), true);
  assert.equal(shouldShowNoteModal({ page: 'home', result: { body_text: '可直接发布的正文' } }), true);
});

test('the blank-canvas result is marked as an ecommerce result', () => {
  const canvas = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  assert.match(canvas, /dispatch\(\{ type: 'SET_RESULT', result: \{ _ecResult: true, _emptyCanvas: true \} \}\)/);
  assert.doesNotMatch(canvas, /dispatch\(\{ type: 'SET_RESULT', result: \{\} \}\)/);
});
