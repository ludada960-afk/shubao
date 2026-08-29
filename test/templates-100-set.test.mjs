// test/templates-100-set.test.mjs
// 4c183cd4 续命 P-E 100 套模板 (9 类目 x 11 套, theme 12 套) 不变量
//
// 覆盖:
//   1) server/publicTemplates.mjs: PUBLIC_TEMPLATE_CATALOG = 100, 9 类目分布
//   2) server/publicTemplates.mjs: PUBLIC_TEMPLATE_BASE_USAGE = 100
//   3) server/publicTemplates.mjs: id 唯一, 连续 (tpl-001 ~ tpl-100)
//   4) server/publicTemplates.mjs: 类目 9 个, 11/11/11/11/11/11/11/11/12 = 100
//   5) server/publicTemplates.mjs: listPublicTemplates default limit 上限 = 100
//   6) server/publicTemplates.mjs: cat=video-hook 返回 11 项 (不再是 2 项)
//   7) server/publicTemplates.mjs: pagination - offset/limit 分页
//   8) server/publicTemplates.mjs: 404 模板 id 行为 (tpl-200)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  PUBLIC_TEMPLATE_CATALOG,
  PUBLIC_TEMPLATE_BASE_USAGE,
  PUBLIC_TEMPLATE_CATEGORIES,
  listPublicTemplates,
  getPublicTemplateWithUsage,
  clonePublicTemplate,
} from '../server/templates/publicTemplates.mjs';
import { loadUsageStats } from '../server/templates/usageStats.mjs';

function statsWithBase() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-100-'));
  return loadUsageStats({
    filePath: path.join(tmp, 'usage.json'),
    baseLikes: Object.fromEntries(Object.entries(PUBLIC_TEMPLATE_BASE_USAGE).map(([k, v]) => [k, v.likes])),
    baseDownloads: Object.fromEntries(Object.entries(PUBLIC_TEMPLATE_BASE_USAGE).map(([k, v]) => [k, v.downloads])),
  });
}

test('P-E 100 套: PUBLIC_TEMPLATE_CATALOG = 100 项', () => {
  assert.equal(PUBLIC_TEMPLATE_CATALOG.length, 100, 'catalog 应有 100 套');
});

test('P-E 100 套: id 唯一且连续 tpl-001 ~ tpl-100', () => {
  const ids = PUBLIC_TEMPLATE_CATALOG.map(t => t.id);
  const unique = new Set(ids);
  assert.equal(unique.size, 100, 'id 应唯一');
  for (let i = 1; i <= 100; i += 1) {
    const id = `tpl-${String(i).padStart(3, '0')}`;
    assert.ok(unique.has(id), `缺 ${id}`);
  }
});

test('P-E 100 套: 9 类目 (11/11/11/11/11/11/11/11/12 = 100)', () => {
  assert.equal(PUBLIC_TEMPLATE_CATEGORIES.length, 9, '9 个类目');
  const expected = {
    "product-main": 11,
    "product-scene": 11,
    "video-hook": 11,
    "video-camera": 11,
    "video-end": 11,
    "tts": 11,
    "caption": 11,
    "font": 11,
    "theme": 12,
  };
  const counts = {};
  for (const t of PUBLIC_TEMPLATE_CATALOG) counts[t.cat] = (counts[t.cat] || 0) + 1;
  for (const [k, v] of Object.entries(expected)) {
    assert.equal(counts[k], v, `${k} 应有 ${v} 套, 实际 ${counts[k] || 0}`);
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.equal(total, 100, `总数应 100, 实际 ${total}`);
});

test('P-E 100 套: PUBLIC_TEMPLATE_BASE_USAGE = 100 项 (likes/downloads)', () => {
  assert.equal(Object.keys(PUBLIC_TEMPLATE_BASE_USAGE).length, 100);
  for (const [id, u] of Object.entries(PUBLIC_TEMPLATE_BASE_USAGE)) {
    assert.equal(typeof u.likes, 'number', `${id} likes 应为 number`);
    assert.equal(typeof u.downloads, 'number', `${id} downloads 应为 number`);
    assert.ok(u.likes > 0, `${id} likes 应 > 0`);
    assert.ok(u.downloads > 0, `${id} downloads 应 > 0`);
  }
});

test('P-E 100 套: listPublicTemplates 默认 limit = 50 (覆盖 18 套历史)', () => {
  const stats = statsWithBase();
  const out = listPublicTemplates({ stats });
  assert.equal(out.total, 100, 'total 应为 100');
  assert.equal(out.items.length, 50, '默认 limit 应为 50');
  assert.equal(out.limit, 50, 'limit 字段应为 50');
});

test('P-E 100 套: limit=100 可一次拿全', () => {
  const stats = statsWithBase();
  const out = listPublicTemplates({ stats, limit: 100 });
  assert.equal(out.items.length, 100);
  assert.equal(out.total, 100);
});

test('P-E 100 套: cat=video-hook 返回 11 项 (不再是 2 项)', () => {
  const stats = statsWithBase();
  const out = listPublicTemplates({ stats, cat: 'video-hook' });
  assert.equal(out.total, 11, 'video-hook 应有 11 套');
  assert.equal(out.items.length, 11);
  for (const item of out.items) {
    assert.equal(item.cat, 'video-hook');
  }
});

test('P-E 100 套: cat=theme 返回 12 套', () => {
  const stats = statsWithBase();
  const out = listPublicTemplates({ stats, cat: 'theme' });
  assert.equal(out.total, 12);
  for (const item of out.items) assert.equal(item.cat, 'theme');
});

test('P-E 100 套: 分页 - offset=50&limit=50 返回后 50 项', () => {
  const stats = statsWithBase();
  const out = listPublicTemplates({ stats, sort: 'newest', limit: 50, offset: 50 });
  assert.equal(out.items.length, 50);
  // newest = id desc: 第 51 ~ 100 名 -> tpl-050 ... tpl-001
  assert.equal(out.items[0].id, 'tpl-050');
  assert.equal(out.items[49].id, 'tpl-001');
});

test('P-E 100 套: likes 排序 - 第一名 tpl-005 (145 likes)', () => {
  const stats = statsWithBase();
  const out = listPublicTemplates({ stats, sort: 'likes' });
  assert.equal(out.items[0].id, 'tpl-005');
  assert.equal(out.items[0].likes, 145);
  for (let i = 1; i < out.items.length; i += 1) {
    assert.ok(out.items[i - 1].likes >= out.items[i].likes, 'likes 排序应递减');
  }
});

test('P-E 100 套: getPublicTemplateWithUsage - 头部 18 套 base 计数', () => {
  const stats = statsWithBase();
  const t5 = getPublicTemplateWithUsage({ stats, tplId: 'tpl-005' });
  assert.equal(t5.id, 'tpl-005');
  // 4c183cd4 P-E: tpl-001~tpl-011 = product-main (id 连续分组), tpl-005 = "高对比黑白主图"
  assert.equal(t5.cat, 'product-main');
  assert.equal(t5.likes, 145);
});

test('P-E 100 套: 100 套 id 范围 = tpl-001..tpl-100', () => {
  const ids = PUBLIC_TEMPLATE_CATALOG.map(t => t.id);
  assert.equal(ids[0], 'tpl-001');
  assert.equal(ids[99], 'tpl-100');
});

test('P-E 100 套: 复制未知 tplId 抛 TEMPLATE_NOT_FOUND', async () => {
  const { createProjectStore } = await import('../server/projects/projectStore.mjs');
  const { ensureProjectSchema } = await import('../server/projects/schema.mjs');
  const Database = (await import('better-sqlite3')).default;
  const db = new Database(':memory:');
  ensureProjectSchema(db);
  let seq = 0;
  const projectStore = createProjectStore(db, {
    randomUUID: () => `clone-${++seq}-${Date.now()}`,
    now: () => new Date('2026-08-29T00:00:00.000Z'),
  });
  const stats = statsWithBase();
  await assert.rejects(
    clonePublicTemplate({
      stats,
      projectStore,
      ownerEmail: 'tester@shubao.cn',
      tplId: 'tpl-200',
    }),
    err => err.code === 'TEMPLATE_NOT_FOUND',
  );
});
