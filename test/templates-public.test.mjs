// test/templates-public.test.mjs
// 4c183cd4 续命 P3 模板社区测试
// 覆盖:
//   1) usageStats 纯函数: 加载/增量/快照/列表
//   2) listPublicTemplates: 类目筛选 + 排序(popular/likes/downloads/newest) + 分页
//   3) clonePublicTemplate: 调 projectStore.createProjectIdempotent 复制到画布 (kind='video')
//   4) clone 计数 (downloads) 真持久化
//   5) GET /api/templates/public 路由: 默认 + 类目 + 排序 + 分页
//   6) GET /api/templates/public/:tplId 详情
//   7) POST /api/templates/public/:tplId/clone 鉴权 + 成功 + 404

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { ensureProjectSchema } from '../server/projects/schema.mjs';
import { createProjectStore } from '../server/projects/projectStore.mjs';
import {
  PUBLIC_TEMPLATE_CATALOG,
  PUBLIC_TEMPLATE_BASE_USAGE,
  PUBLIC_TEMPLATE_CATEGORIES,
  listPublicTemplates,
  getPublicTemplateWithUsage,
  clonePublicTemplate,
  mountPublicTemplateRoutes,
} from '../server/templates/publicTemplates.mjs';
import { loadUsageStats } from '../server/templates/usageStats.mjs';

// ─── 1) usageStats 纯函数 ─────────────────────────────────────────

test('loadUsageStats returns base + zeros, incrementLike persists, snapshot sums', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-usage-'));
  const fp = path.join(tmp, 'usage.json');
  const stats = loadUsageStats({
    filePath: fp,
    baseLikes: { 'tpl-001': 100 },
    baseDownloads: { 'tpl-001': 50 },
  });
  // base 初始化
  const before = stats.snapshot('tpl-001');
  assert.equal(before.likes, 100);
  assert.equal(before.downloads, 50);
  // 增量 + 持久化
  await stats.incrementLike('tpl-001');
  await stats.incrementLike('tpl-001');
  await stats.incrementDownload('tpl-001');
  const after = stats.snapshot('tpl-001');
  assert.equal(after.likes, 102);
  assert.equal(after.downloads, 51);
  // 重新载入后计数保留
  const reloaded = loadUsageStats({
    filePath: fp,
    baseLikes: { 'tpl-001': 100 },
    baseDownloads: { 'tpl-001': 50 },
  });
  const reloadedSnapshot = reloaded.snapshot('tpl-001');
  assert.equal(reloadedSnapshot.likes, 102);
  assert.equal(reloadedSnapshot.downloads, 51);
});

test('loadUsageStats list() returns all tplIds from baseLikes/baseDownloads/counters', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-usage-'));
  const stats = loadUsageStats({
    filePath: path.join(tmp, 'usage.json'),
    baseLikes: { 'tpl-001': 10, 'tpl-002': 20 },
    baseDownloads: { 'tpl-002': 5, 'tpl-003': 7 },
  });
  await stats.incrementLike('tpl-099');
  const list = stats.list();
  assert.ok(list['tpl-001']);
  assert.ok(list['tpl-002']);
  assert.ok(list['tpl-003']);
  assert.ok(list['tpl-099']);
  assert.equal(list['tpl-001'].likes, 10);
  assert.equal(list['tpl-002'].downloads, 5);
  assert.equal(list['tpl-099'].likes, 1);
});

test('loadUsageStats tolerates missing/corrupt file by resetting counters', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-usage-'));
  const fp = path.join(tmp, 'usage.json');
  fs.writeFileSync(fp, '{ this is not valid json');
  const stats = loadUsageStats({
    filePath: fp,
    baseLikes: { 'tpl-001': 5 },
  });
  const snap = stats.snapshot('tpl-001');
  assert.equal(snap.likes, 5);
  assert.equal(snap.downloads, 0);
});

// ─── 2) listPublicTemplates 类目 + 排序 + 分页 ──────────────────

function statsWithBase() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-base-'));
  return loadUsageStats({
    filePath: path.join(tmp, 'usage.json'),
    baseLikes: Object.fromEntries(Object.entries(PUBLIC_TEMPLATE_BASE_USAGE).map(([k, v]) => [k, v.likes])),
    baseDownloads: Object.fromEntries(Object.entries(PUBLIC_TEMPLATE_BASE_USAGE).map(([k, v]) => [k, v.downloads])),
  });
}

test('listPublicTemplates has 18 entries in default sort', () => {
  const stats = statsWithBase();
  const out = listPublicTemplates({ stats });
  assert.equal(out.total, 18);
  assert.equal(out.items.length, 18);
  // 排序 = popular, 第一个 likes 最高 (tpl-005 145)
  assert.equal(out.items[0].id, 'tpl-005');
  assert.equal(out.sort, 'popular');
});

test('listPublicTemplates filters by category', () => {
  const stats = statsWithBase();
  const out = listPublicTemplates({ stats, cat: 'video-hook' });
  assert.equal(out.total, 2);
  for (const item of out.items) assert.equal(item.cat, 'video-hook');
  assert.equal(out.cat, 'video-hook');
});

test('listPublicTemplates sorts by likes descending', () => {
  const stats = statsWithBase();
  const out = listPublicTemplates({ stats, sort: 'likes' });
  for (let i = 1; i < out.items.length; i += 1) {
    assert.ok(out.items[i - 1].likes >= out.items[i].likes);
  }
  // tpl-005 145 最高
  assert.equal(out.items[0].id, 'tpl-005');
});

test('listPublicTemplates sorts by downloads descending', () => {
  const stats = statsWithBase();
  const out = listPublicTemplates({ stats, sort: 'downloads' });
  for (let i = 1; i < out.items.length; i += 1) {
    assert.ok(out.items[i - 1].downloads >= out.items[i].downloads);
  }
  // tpl-005 102 最高
  assert.equal(out.items[0].id, 'tpl-005');
});

test('listPublicTemplates sorts by newest (id desc) and paginates', () => {
  const stats = statsWithBase();
  const out = listPublicTemplates({ stats, sort: 'newest', limit: 5, offset: 2 });
  assert.equal(out.items.length, 5);
  // id 倒序: tpl-018, tpl-017, tpl-016, ...
  assert.equal(out.items[0].id, 'tpl-016');
  // 切片后, id 仍然单调递减
  for (let i = 1; i < out.items.length; i += 1) {
    assert.ok(String(out.items[i - 1].id) > String(out.items[i].id));
  }
});

test('listPublicTemplates reflects incrementDownload as live downloads', async () => {
  const stats = statsWithBase();
  const before = getPublicTemplateWithUsage({ stats, tplId: 'tpl-001' });
  assert.equal(before.downloads, 89);
  await stats.incrementDownload('tpl-001');
  await stats.incrementDownload('tpl-001');
  const after = getPublicTemplateWithUsage({ stats, tplId: 'tpl-001' });
  assert.equal(after.downloads, 91);
  assert.equal(after.likes, 142);
});

test('PUBLIC_TEMPLATE_CATALOG has 18 unique entries across 9 categories', () => {
  assert.equal(PUBLIC_TEMPLATE_CATALOG.length, 18);
  const ids = new Set(PUBLIC_TEMPLATE_CATALOG.map(t => t.id));
  assert.equal(ids.size, 18);
  const cats = new Set(PUBLIC_TEMPLATE_CATALOG.map(t => t.cat));
  assert.equal(cats.size, 9);
  assert.equal(PUBLIC_TEMPLATE_CATEGORIES.length, 9);
});

// ─── 3) clonePublicTemplate 调 projectStore ──────────────────────

function createHarness() {
  const db = new Database(':memory:');
  ensureProjectSchema(db);
  let seq = 0;
  const projectStore = createProjectStore(db, {
    randomUUID: () => `clone-${++seq}-${Date.now()}`,
    now: () => new Date('2026-08-29T00:00:00.000Z'),
  });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-clone-'));
  const stats = loadUsageStats({
    filePath: path.join(tmp, 'usage.json'),
    baseLikes: Object.fromEntries(Object.entries(PUBLIC_TEMPLATE_BASE_USAGE).map(([k, v]) => [k, v.likes])),
    baseDownloads: Object.fromEntries(Object.entries(PUBLIC_TEMPLATE_BASE_USAGE).map(([k, v]) => [k, v.downloads])),
  });
  return { db, projectStore, stats };
}

test('clonePublicTemplate creates a video project and increments download', async () => {
  const { projectStore, stats } = createHarness();
  const beforeDownloads = stats.snapshot('tpl-005').downloads;
  const result = await clonePublicTemplate({
    stats,
    projectStore,
    ownerEmail: 'tester@shubao.cn',
    tplId: 'tpl-005',
    idempotencyKey: 'idem-1',
  });
  assert.ok(result.projectId);
  assert.equal(result.templateId, 'tpl-005');
  assert.equal(result.templateName, '文字飞入开场');
  assert.equal(result.projectKind, 'video');
  assert.equal(result.replayed, false);
  assert.equal(result.downloads, beforeDownloads + 1);
  // 验证 projects 表有这条
  const projects = projectStore.listProjects({ ownerEmail: 'tester@shubao.cn' });
  const cloned = projects.find(p => p.id === result.projectId);
  assert.ok(cloned);
  assert.equal(cloned.kind, 'video');
  assert.ok(cloned.title.includes('文字飞入开场'));
});

test('clonePublicTemplate with same idempotency key replays instead of creating new', async () => {
  const { projectStore, stats } = createHarness();
  const first = await clonePublicTemplate({
    stats,
    projectStore,
    ownerEmail: 'tester2@shubao.cn',
    tplId: 'tpl-006',
    idempotencyKey: 'same-idem',
  });
  const second = await clonePublicTemplate({
    stats,
    projectStore,
    ownerEmail: 'tester2@shubao.cn',
    tplId: 'tpl-006',
    idempotencyKey: 'same-idem',
  });
  assert.equal(second.projectId, first.projectId);
  assert.equal(second.replayed, true);
  // 第二次不应该再增加下载计数
  assert.equal(second.downloads, first.downloads);
});

test('clonePublicTemplate rejects unknown template id', async () => {
  const { projectStore, stats } = createHarness();
  await assert.rejects(
    clonePublicTemplate({
      stats,
      projectStore,
      ownerEmail: 'tester@shubao.cn',
      tplId: 'tpl-999',
    }),
    err => err.code === 'TEMPLATE_NOT_FOUND',
  );
});

test('clonePublicTemplate requires owner', async () => {
  const { projectStore, stats } = createHarness();
  await assert.rejects(
    clonePublicTemplate({
      stats,
      projectStore,
      ownerEmail: '',
      tplId: 'tpl-001',
    }),
    err => err.code === 'AUTH_SESSION_INVALID',
  );
});

// ─── 4) 路由挂载 (in-process fake app) ──────────────────────────

function createFakeApp() {
  const routes = new Map();
  return {
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
    routes,
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
  };
}

function matchRoute(routesKey, method, path) {
  if (!routesKey.startsWith(`${method} `)) return null;
  const routePath = routesKey.slice(`${method} `.length);
  const routeParts = routePath.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (routeParts.length !== pathParts.length) return null;
  const params = {};
  for (let i = 0; i < routeParts.length; i += 1) {
    const r = routeParts[i];
    const p = pathParts[i];
    if (r.startsWith(':')) {
      params[r.slice(1)] = decodeURIComponent(p);
    } else if (r !== p) {
      return null;
    }
  }
  return params;
}

async function invoke(app, method, path, request = {}) {
  let handler = null;
  let resolvedParams = {};
  for (const [key, fn] of app.routes.entries()) {
    const params = matchRoute(key, method, path);
    if (params) {
      handler = fn;
      resolvedParams = params;
      break;
    }
  }
  if (!handler) throw new Error(`no handler for ${method} ${path}`);
  const res = createResponse();
  await handler({
    headers: request.headers || {},
    body: request.body || {},
    params: { ...resolvedParams, ...(request.params || {}) },
    query: request.query || {},
  }, res);
  return res;
}

function mountHarness() {
  const harness = createHarness();
  const app = createFakeApp();
  const authed = new Set(['alice@shubao.cn', 'owner@shubao.cn']);
  mountPublicTemplateRoutes(app, {
    projectStore: harness.projectStore,
    usageStats: harness.stats,
    authenticateOwner: req => {
      const auth = req.headers?.authorization || '';
      const match = /^Bearer\s+(\S+)/.exec(auth);
      if (match && authed.has(match[1])) return match[1];
      const err = new Error('auth required');
      err.code = 'AUTH_SESSION_INVALID';
      throw err;
    },
  });
  return { app, ...harness };
}

test('GET /api/templates/public returns 18 items + categories', async () => {
  const { app } = mountHarness();
  const res = await invoke(app, 'GET', '/api/templates/public');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.items.length, 18);
  assert.equal(res.body.total, 18);
  assert.equal(res.body.categories.length, 9);
  // 真使用率字段 (likes/downloads 是数字)
  for (const item of res.body.items) {
    assert.equal(typeof item.likes, 'number');
    assert.equal(typeof item.downloads, 'number');
  }
});

test('GET /api/templates/public with cat=video-hook returns 2 items', async () => {
  const { app } = mountHarness();
  const res = await invoke(app, 'GET', '/api/templates/public', { query: { cat: 'video-hook' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items.length, 2);
  for (const item of res.body.items) assert.equal(item.cat, 'video-hook');
});

test('GET /api/templates/public rejects invalid cat', async () => {
  const { app } = mountHarness();
  const res = await invoke(app, 'GET', '/api/templates/public', { query: { cat: 'unknown-cat' } });
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, 'TEMPLATE_CAT_INVALID');
});

test('GET /api/templates/public?sort=downloads&limit=5 paginates', async () => {
  const { app } = mountHarness();
  const res = await invoke(app, 'GET', '/api/templates/public', { query: { sort: 'downloads', limit: '5', offset: '0' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items.length, 5);
  assert.equal(res.body.limit, 5);
  assert.equal(res.body.sort, 'downloads');
  for (let i = 1; i < res.body.items.length; i += 1) {
    assert.ok(res.body.items[i - 1].downloads >= res.body.items[i].downloads);
  }
});

test('GET /api/templates/public/:tplId returns single template', async () => {
  const { app } = mountHarness();
  const res = await invoke(app, 'GET', '/api/templates/public/tpl-005', { params: { tplId: 'tpl-005' } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.template.id, 'tpl-005');
  assert.equal(res.body.template.likes, 145);
});

test('GET /api/templates/public/:tplId 404 for unknown id', async () => {
  const { app } = mountHarness();
  const res = await invoke(app, 'GET', '/api/templates/public/tpl-999', { params: { tplId: 'tpl-999' } });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.code, 'TEMPLATE_NOT_FOUND');
});

test('POST /api/templates/public/:tplId/clone without auth returns 401', async () => {
  const { app } = mountHarness();
  const res = await invoke(app, 'POST', '/api/templates/public/tpl-001/clone', { params: { tplId: 'tpl-001' }, body: {} });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'AUTH_SESSION_INVALID');
});

test('POST /api/templates/public/:tplId/clone with auth creates project', async () => {
  const { app, projectStore, stats } = mountHarness();
  const before = stats.snapshot('tpl-001').downloads;
  const res = await invoke(app, 'POST', '/api/templates/public/tpl-001/clone', {
    params: { tplId: 'tpl-001' },
    body: {},
    headers: { authorization: 'Bearer alice@shubao.cn' },
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.ok, true);
  assert.ok(res.body.projectId);
  assert.equal(res.body.templateId, 'tpl-001');
  assert.equal(res.body.projectKind, 'video');
  assert.equal(res.body.downloads, before + 1);
  // project 真实存在
  const projects = projectStore.listProjects({ ownerEmail: 'alice@shubao.cn' });
  assert.ok(projects.find(p => p.id === res.body.projectId));
});

test('POST clone 404 for unknown tpl', async () => {
  const { app } = mountHarness();
  const res = await invoke(app, 'POST', '/api/templates/public/tpl-999/clone', {
    params: { tplId: 'tpl-999' },
    body: {},
    headers: { authorization: 'Bearer alice@shubao.cn' },
  });
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.code, 'TEMPLATE_NOT_FOUND');
});

test('POST clone replays with same idempotency key', async () => {
  const { app, stats } = mountHarness();
  const idem = 'idem-test-replay';
  const headers = { authorization: 'Bearer alice@shubao.cn', 'idempotency-key': idem };
  const first = await invoke(app, 'POST', '/api/templates/public/tpl-002/clone', {
    params: { tplId: 'tpl-002' },
    body: { idempotencyKey: idem },
    headers,
  });
  const before = stats.snapshot('tpl-002').downloads;
  const second = await invoke(app, 'POST', '/api/templates/public/tpl-002/clone', {
    params: { tplId: 'tpl-002' },
    body: { idempotencyKey: idem },
    headers,
  });
  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 200);
  assert.equal(first.body.projectId, second.body.projectId);
  assert.equal(second.body.replayed, true);
  // replayed 路径不增加 downloads
  const after = stats.snapshot('tpl-002').downloads;
  assert.equal(after, before);
});
