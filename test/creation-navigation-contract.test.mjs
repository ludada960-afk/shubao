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
  const source = await fs.readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(source, /label: '视频创作'[\s\S]*?page: 'video-studio'/);
  assert.match(source, /label: '画布'[\s\S]*?page: 'ec-canvas'/);
});

test('home keeps the four creation modes in the primary creation hub', async () => {
  const source = await fs.readFile(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /mode: 'ecommerce'/);
  assert.match(source, /mode: 'video'/);
  assert.match(source, /mode: 'content'/);
  assert.match(source, /mode: 'visual'/);
});

