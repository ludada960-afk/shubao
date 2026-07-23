import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeDB, getAllWorks, getDeletedWorks, initDB, restoreWork, softDeleteWork, upsertWork } from '../server/db.mjs';

test('persists ecommerce work metadata and stable generated asset URLs in SQLite', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'shubao-ec-work-test-'));
  t.after(async () => { closeDB(); await rm(dir, { recursive: true, force: true }); });
  initDB(join(dir, 'works.db'));

  upsertWork({
    _saveKey: 'ec-work-1',
    product_name: '保温杯',
    _ecResult: true,
    platform: '淘宝',
    images: [{ key: 'main_1', url: '/api/generated-assets/abc.png' }],
  });

  assert.deepEqual(getAllWorks()[0], {
    _saveKey: 'ec-work-1',
    title: '',
    body_text: '',
    hashtags: [],
    category: '',
    pages: [],
    cover_url: '',
    image_urls: [],
    image_count: 0,
    _inputText: '',
    visual_system: '',
    cover_prompt: '',
    image_prompts: [],
    tags: [],
    error: '',
    product_name: '保温杯',
    _ecResult: true,
    platform: '淘宝',
    images: [{ key: 'main_1', url: '/api/generated-assets/abc.png' }],
    at: getAllWorks()[0].at,
    created_at: getAllWorks()[0].created_at,
    updated_at: getAllWorks()[0].updated_at,
  });
});

test('moves works to a recoverable trash state instead of deleting data', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'shubao-ec-trash-test-'));
  t.after(async () => { closeDB(); await rm(dir, { recursive: true, force: true }); });
  initDB(join(dir, 'works.db'));
  upsertWork({ _saveKey: 'trash-work-1', title: '可恢复作品', _ecResult: true, images: [{ url: '/api/generated-assets/a.png' }] });

  softDeleteWork('trash-work-1');
  assert.equal(getAllWorks().some(work => work._saveKey === 'trash-work-1'), false);
  assert.equal(getDeletedWorks()[0]._deleted, true);

  restoreWork('trash-work-1');
  assert.equal(getAllWorks()[0]._saveKey, 'trash-work-1');
  assert.equal(getDeletedWorks().length, 0);
});
