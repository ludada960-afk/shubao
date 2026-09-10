// test/workflow-templates-server.test.mjs
// P2 业务资产层 — 工作流模板 store / 内置模板 / 路由 零付费回归（in-memory better-sqlite3 + express）。
// 覆盖：建表幂等（含 legacy 缺列补齐）、seedBuiltIn 幂等、list public/mine/category、get、
//       instantiate -> usage_count 真数 +1、like 幂等（2x -> like_count 1）、
//       graph_json 喂给 P1 buildRunPlan 的契约（T1/T2/T3 可跑、T4/T5 诚实 P3 门控）。

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import Database from 'better-sqlite3';

import { createWorkflowTemplateStore, P3_GRAPH_KINDS } from '../server/templates/workflowTemplateStore.mjs';
import { BUILTIN_WORKFLOW_TEMPLATES } from '../server/templates/builtinTemplates.mjs';
import { mountWorkflowTemplateRoutes } from '../server/templates/workflowTemplateRoutes.mjs';
import { buildRunPlan } from '../server/canvas/graphRunPlan.mjs';

/* P3 门控的节点动作 kind（video/audio 家族；P1 SUPPORTED 白名单不含这些）。 */
const P3_ACTION_IDS = new Set(['video-composer', 'tts', 'lip-sync']);
const bySlug = Object.fromEntries(BUILTIN_WORKFLOW_TEMPLATES.map(t => [t.slug, t]));
const kindOf = node => node.actionId || node.kind;

function createSeededStore() {
  const db = new Database(':memory:');
  const store = createWorkflowTemplateStore(db);
  store.seedBuiltIn(BUILTIN_WORKFLOW_TEMPLATES);
  return { db, store };
}

function withFilledSlots(nodes) {
  return nodes.map(node => {
    const copy = { ...node };
    if (copy.slot) copy.url = 'https://cdn.test/filled-' + copy.id + '.png';
    if (copy.kind === 'text') copy.text = 'filled content';
    return copy;
  });
}

function startApp(store) {
  const app = express();
  app.use(express.json());
  mountWorkflowTemplateRoutes(app, {
    store,
    authorize: req => String(req.headers['x-test-email'] || ''),
  });
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}
const urlOf = (server, path) => 'http://127.0.0.1:' + server.address().port + path;

test('table init idempotent: re-running the constructor / guarded ALTER never duplicates', () => {
  const db = new Database(':memory:');
  createWorkflowTemplateStore(db);
  createWorkflowTemplateStore(db); // 第二次：CREATE IF NOT EXISTS + PRAGMA 守卫 ALTER 全 no-op
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'workflow_template%'").all().map(r => r.name).sort();
  assert.deepEqual(tables, ['workflow_template_likes', 'workflow_templates']);
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_workflow_templates%'").all().map(r => r.name).sort();
  assert.deepEqual(indexes, ['idx_workflow_templates_author', 'idx_workflow_templates_list']);
  const columns = db.prepare('PRAGMA table_info(workflow_templates)').all().map(c => c.name);
  for (const col of ['template_id', 'slug', 'name', 'category', 'description', 'author_email', 'is_built_in', 'is_public', 'graph_json', 'pricing_json', 'usage_count', 'like_count', 'created_at', 'updated_at']) {
    assert.ok(columns.includes(col), 'missing column ' + col);
  }
  // legacy 模拟：丢一列后重建 store -> 守卫 ALTER 补齐（老文档只读可用，迁移纯增量）
  db.exec('ALTER TABLE workflow_templates DROP COLUMN like_count');
  createWorkflowTemplateStore(db);
  const columns2 = db.prepare('PRAGMA table_info(workflow_templates)').all().map(c => c.name);
  assert.ok(columns2.includes('like_count'), 'guarded ALTER re-adds dropped legacy column');
});

test('seedBuiltIn idempotent: built-ins present once, second seed skips everything, usage starts at 0 (real counts)', () => {
  const { db, store } = createSeededStore();
  const first = store.seedBuiltIn(BUILTIN_WORKFLOW_TEMPLATES);
  assert.deepEqual(first.seeded, []); // 构造函数里已播过（createSeededStore）
  assert.equal(first.skipped.length, 5);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM workflow_templates').get().c, 5);
  const rows = store.list({});
  assert.equal(rows.length, 5);
  assert.ok(rows.every(t => t.isBuiltIn === true && t.isPublic === true));
  assert.ok(rows.every(t => t.usageCount === 0), 'builtin usage counts must be REAL (start 0, no placeholder)');
  assert.equal(rows.filter(t => t.requiresAudioVideo === true).length, 2); // T4/T5
  // 全新库：播种一次 seeded=5，二次全 skip
  const db2 = new Database(':memory:');
  const store2 = createWorkflowTemplateStore(db2);
  const seedA = store2.seedBuiltIn(BUILTIN_WORKFLOW_TEMPLATES);
  assert.equal(seedA.seeded.length, 5);
  assert.equal(seedA.skipped.length, 0);
  const seedB = store2.seedBuiltIn(BUILTIN_WORKFLOW_TEMPLATES);
  assert.deepEqual(seedB.seeded, []);
  assert.equal(seedB.skipped.length, 5);
  assert.equal(db2.prepare('SELECT COUNT(*) AS c FROM workflow_templates').get().c, 5);
});

test('list public/mine/category + get by slug or template_id', () => {
  const { store } = createSeededStore();
  assert.equal(store.list({}).length, 5); // 匿名口径 = 仅公开
  const created = store.create({ name: '我的链路', category: 'custom', graph: { nodes: [{ id: 'n1', kind: 'image', url: 'https://x/a.png' }], connections: [] }, authorEmail: 'user@x.com' });
  assert.equal(created.isPublic, false);
  assert.equal(store.list({}).length, 5); // 私有不进公开列表
  const mine = store.list({ ownerEmail: 'USER@X.COM', public: false }); // 邮箱大小写归一
  assert.equal(mine.length, 1);
  assert.equal(mine[0].name, '我的链路');
  assert.equal(mine[0].slug, created.slug);
  assert.equal(store.list({ category: 'image' }).length, 3); // T1/T2/T3
  assert.equal(store.list({ category: 'video' }).length, 2); // T4/T5
  const t = store.get('white-bg-main');
  assert.equal(t.name, '白底主图');
  assert.equal(store.get(t.templateId)?.slug, 'white-bg-main'); // get 接受 template_id
  assert.equal(store.get('no-such-slug'), null);
});

test('instantiate -> usage_count +1 (by slug and by template_id)', () => {
  const { store } = createSeededStore();
  assert.equal(store.get('white-bg-main').usageCount, 0);
  assert.equal(store.incrementUsage('white-bg-main').usageCount, 1);
  assert.equal(store.get('white-bg-main').usageCount, 1);
  const id = store.get('white-bg-main').templateId;
  assert.equal(store.incrementUsage(id).usageCount, 2);
  assert.throws(() => store.incrementUsage('ghost-slug'), /workflow template not found/);
});

test('like is idempotent: two toggles keep like_count=1; multi-user counts; unlike decrements', () => {
  const { store } = createSeededStore();
  const first = store.toggleLike('model-try-on', 'user@x.com');
  assert.deepEqual(first, { liked: true, likeCount: 1 });
  const second = store.toggleLike('model-try-on', 'user@x.com');
  assert.deepEqual(second, { liked: true, likeCount: 1 }); // 双击不重复计数
  assert.equal(store.get('model-try-on').likeCount, 1);
  assert.equal(store.toggleLike('model-try-on', 'other@x.com').likeCount, 2);
  assert.equal(store.unlike('model-try-on', 'user@x.com').likeCount, 1);
  assert.equal(store.get('model-try-on').likeCount, 1);
});

test('graph_json validity: P1 buildRunPlan contract — T1/T2/T3 runnable, T4/T5 honestly P3-gated (no mock)', () => {
  for (const template of BUILTIN_WORKFLOW_TEMPLATES) {
    const plan = buildRunPlan({ nodes: template.graph.nodes, connections: template.graph.connections });
    assert.equal(plan.ok, true, template.slug + ': acyclic');
    // 无任何 P3 kind 混进 executable
    assert.ok(plan.executableNodeIds.every(id => {
      const node = template.graph.nodes.find(n => n.id === id);
      return !P3_ACTION_IDS.has(node?.actionId);
    }), template.slug + ': executable set must not contain P3 kinds');
  }
  // T1 白底主图
  const t1 = buildRunPlan({ nodes: bySlug['white-bg-main'].graph.nodes, connections: bySlug['white-bg-main'].graph.connections });
  assert.equal(t1.ok, true);
  assert.deepEqual(t1.executableNodeIds, ['main-image']);
  assert.deepEqual(t1.unsupportedNodeIds.sort(), ['reverse-prompt', 'slot-product']);
  const t1Filled = buildRunPlan({ nodes: withFilledSlots(bySlug['white-bg-main'].graph.nodes), connections: bySlug['white-bg-main'].graph.connections });
  assert.deepEqual(t1Filled.sourceNodeIds, ['slot-product', 'reverse-prompt']); // 填槽后入 source 集
  assert.deepEqual(t1Filled.executableNodeIds, ['main-image']);
  assert.equal(t1Filled.unsupportedNodeIds.length, 0);
  // T2 模特试穿（双入边 + 并行分支）
  const t2 = buildRunPlan({ nodes: bySlug['model-try-on'].graph.nodes, connections: bySlug['model-try-on'].graph.connections });
  assert.equal(t2.ok, true);
  assert.deepEqual(t2.executableNodeIds, ['try-on', 'three-view']);
  const t2Filled = buildRunPlan({ nodes: withFilledSlots(bySlug['model-try-on'].graph.nodes), connections: bySlug['model-try-on'].graph.connections });
  assert.deepEqual(t2Filled.sourceNodeIds, ['slot-garment', 'slot-model']);
  // T3 场景详情（N 张；splice 本地免费动作但不在 P1 白名单 -> 无产物前 unsupported，诚实）
  const t3 = buildRunPlan({ nodes: bySlug['scene-detail'].graph.nodes, connections: bySlug['scene-detail'].graph.connections });
  assert.equal(t3.ok, true);
  assert.deepEqual(t3.executableNodeIds, ['scene']);
  assert.ok(t3.unsupportedNodeIds.includes('detail-splice'));
  // T4 换装短视频：video-composer 诚实门控
  const t4 = buildRunPlan({ nodes: bySlug['outfit-video'].graph.nodes, connections: bySlug['outfit-video'].graph.connections });
  assert.equal(t4.ok, true);
  assert.deepEqual(t4.executableNodeIds, ['try-on']);
  const p3Ids4 = bySlug['outfit-video'].graph.nodes.filter(n => P3_ACTION_IDS.has(n.actionId)).map(n => n.id);
  assert.ok(p3Ids4.includes('final-video'));
  for (const id of p3Ids4) assert.ok(t4.unsupportedNodeIds.includes(id), 'P3 node ' + id + ' must be unsupported');
  assert.ok(t4.unsupportedNodeIds.includes('storyboard'));
  // T5 口播带货：tts / lip-sync 诚实门控
  const t5 = buildRunPlan({ nodes: bySlug['voiceover'].graph.nodes, connections: bySlug['voiceover'].graph.connections });
  assert.equal(t5.ok, true);
  assert.deepEqual(t5.executableNodeIds, ['host-image']);
  const p3Ids5 = bySlug['voiceover'].graph.nodes.filter(n => P3_ACTION_IDS.has(n.actionId)).map(n => n.id);
  assert.deepEqual(p3Ids5.sort(), ['lip-sync', 'tts']);
  for (const id of p3Ids5) assert.ok(t5.unsupportedNodeIds.includes(id), 'P3 node ' + id + ' must be unsupported');
  // 落库的 graph_json 解析后与内存常量同口径（防御性解析不丢结构）
  const { store } = createSeededStore();
  const persisted = store.get('white-bg-main');
  const persistedPlan = buildRunPlan({ nodes: persisted.graph.nodes, connections: persisted.graph.connections });
  assert.deepEqual(persistedPlan.executableNodeIds, t1.executableNodeIds);
  assert.deepEqual(persistedPlan.unsupportedNodeIds.sort(), t1.unsupportedNodeIds.sort());
  // P3_GRAPH_KINDS 覆盖 video/audio 裸 kind（槽位 motion 视频）
  assert.ok(P3_GRAPH_KINDS.includes('video') && P3_GRAPH_KINDS.includes('audio'));
});

test('routes: anonymous list / private visibility / instantiate usage+1 / like idempotent / user create', async () => {
  const { store } = createSeededStore();
  store.create({ slug: 'secret-flow', name: '私有链路', category: 'custom', graph: { nodes: [], connections: [] }, authorEmail: 'owner@x.com' });
  const server = await startApp(store);
  try {
    // 匿名列表 = 仅公开 5 套；匿名 public=0 也拉不到私有（防越权）
    let res = await fetch(urlOf(server, '/api/workflow-templates'));
    assert.equal(res.status, 200);
    let body = await res.json();
    assert.equal(body.templates.length, 5);
    assert.ok(body.templates.every(t => t.isPublic));
    res = await fetch(urlOf(server, '/api/workflow-templates?public=0'));
    body = await res.json();
    assert.equal(body.templates.length, 5);
    assert.ok(!body.templates.some(t => t.slug === 'secret-flow'));
    // GET 单个：公开 200 + graph/pricing 齐全；私有对匿名/他人 404、对 owner 200
    res = await fetch(urlOf(server, '/api/workflow-templates/outfit-video'));
    assert.equal(res.status, 200);
    body = await res.json();
    assert.equal(body.template.graph.nodes.length, 6);
    assert.equal(body.template.pricing.estimatedUnits, 29);
    assert.equal(body.template.requiresAudioVideo, true);
    assert.equal((await fetch(urlOf(server, '/api/workflow-templates/secret-flow'))).status, 404);
    assert.equal((await fetch(urlOf(server, '/api/workflow-templates/secret-flow'), { headers: { 'x-test-email': 'owner@x.com' } })).status, 200);
    assert.equal((await fetch(urlOf(server, '/api/workflow-templates/secret-flow'), { headers: { 'x-test-email': 'other@x.com' } })).status, 404);
    // instantiate：匿名 401；登录 -> usage 真数 +1，snapshot 可直接喂 createCanvasSnapshot
    res = await fetch(urlOf(server, '/api/workflow-templates/white-bg-main/instantiate'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 401);
    res = await fetch(urlOf(server, '/api/workflow-templates/white-bg-main/instantiate'), { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-email': 'user@x.com' }, body: '{}' });
    assert.equal(res.status, 200);
    body = await res.json();
    assert.equal(body.usageCount, 1);
    assert.equal(store.get('white-bg-main').usageCount, 1);
    assert.equal(body.snapshot.nodes.length, 3);
    assert.deepEqual(body.snapshot.connections[0], { fromNodeId: 'slot-product', toNodeId: 'reverse-prompt', relation: 'reference' });
    assert.equal(body.snapshot.viewport.scale, 1);
    // like 幂等：两次 -> likeCount 保持 1
    res = await fetch(urlOf(server, '/api/workflow-templates/white-bg-main/like'), { method: 'POST', headers: { 'x-test-email': 'user@x.com' } });
    body = await res.json();
    assert.deepEqual([body.liked, body.likeCount], [true, 1]);
    res = await fetch(urlOf(server, '/api/workflow-templates/white-bg-main/like'), { method: 'POST', headers: { 'x-test-email': 'user@x.com' } });
    body = await res.json();
    assert.deepEqual([body.liked, body.likeCount], [true, 1]);
    // 用户自建：201 + isPublic=false + author_email=登录邮箱
    res = await fetch(urlOf(server, '/api/workflow-templates'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-email': 'user@x.com' },
      body: JSON.stringify({ name: '我的链路', category: 'custom', graph: { nodes: [{ id: 'n1', kind: 'image', url: 'https://x/a.png' }], connections: [] } }),
    });
    assert.equal(res.status, 201);
    body = await res.json();
    assert.equal(body.template.isPublic, false);
    assert.equal(body.template.isBuiltIn, false);
    assert.equal(body.template.authorEmail, 'user@x.com');
    // mine 列表：只能查自己（他人 -> 403）；匿名 -> 401
    res = await fetch(urlOf(server, '/api/workflow-templates?mine=user@x.com'), { headers: { 'x-test-email': 'user@x.com' } });
    body = await res.json();
    assert.ok(body.templates.some(t => t.name === '我的链路'));
    assert.ok(body.templates.every(t => t.authorEmail === 'user@x.com'));
    assert.equal((await fetch(urlOf(server, '/api/workflow-templates?mine=owner@x.com'), { headers: { 'x-test-email': 'user@x.com' } })).status, 403);
    assert.equal((await fetch(urlOf(server, '/api/workflow-templates?mine=user@x.com'))).status, 401);
  } finally {
    server.close();
  }
});
