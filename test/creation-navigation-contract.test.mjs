import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { creationNavigationContract } from '../src/pages/Home/creationShowcaseModel.js';

test('left navigation keeps video, canvas, and works on distinct destinations', () => {
  const contract = creationNavigationContract();
  assert.equal(contract.primary, 'home');
  assert.equal(contract.video, 'video-studio');
  assert.equal(contract.canvas, 'ec-canvas');
  assert.deepEqual(contract.works, { page: 'ec-canvas', tab: 'works' });
});

test('source routing keeps video on the second nav and canvas on the third nav', async () => {
  const source = await fs.readFile(new URL('../src/components/layout/creativeDomainNavigation.js', import.meta.url), 'utf8');
  assert.match(source, /id: 'video-studio'[\s\S]*?page: 'video-studio'/);
  assert.match(source, /id: 'canvas'[\s\S]*?OPEN_CANVAS/);
});

test('home keeps the four creation modes in the primary creation hub', async () => {
  const source = await fs.readFile(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /mode: 'ecommerce'/);
  assert.match(source, /mode: 'video'/);
  assert.match(source, /mode: 'content'/);
  assert.match(source, /mode: 'visual'/);
});
