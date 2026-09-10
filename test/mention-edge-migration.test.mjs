// test/mention-edge-migration.test.mjs
// P2 §3.5.2.1 后端半边 — mentionSourceNodeIds -> 图边 迁移（纯函数 + 幂等）单测。
// 目标：图 = 唯一真源；旧文档 mention 补边后与纯图等价，二次加载幂等。

import test from 'node:test';
import assert from 'node:assert/strict';

import { migrateMentionsToEdges } from '../server/templates/mentionEdgeMigration.mjs';

const edge = (fromNodeId, toNodeId, relation = 'reference') => ({ fromNodeId, toNodeId, relation });

test('mention -> edge: missing reference edges are added, converted mentions are stripped', () => {
  const nodes = [
    { id: 'a', kind: 'image', url: 'https://x/a.png' },
    { id: 'b', kind: 'image', mentionSourceNodeIds: ['a'] },
  ];
  const out = migrateMentionsToEdges(nodes, []);
  assert.deepEqual(out.connections, [edge('a', 'b')]);
  assert.equal(out.added, 1);
  assert.ok(!('mentionSourceNodeIds' in out.nodes[1]), 'converted mention must be stripped (graph = single source of truth)');
  assert.ok('mentionSourceNodeIds' in out.nodes[0] === false);
});

test('dedup: same from->to mention listed twice yields exactly one edge', () => {
  const nodes = [
    { id: 'a' },
    { id: 'b', mentionSourceNodeIds: ['a', 'a'] },
    { id: 'c', mentionSourceNodeIds: ['a'] },
  ];
  const out = migrateMentionsToEdges(nodes, [edge('a', 'b')]); // a->b 已有边：不重复补
  assert.deepEqual(out.connections.map(c => c.fromNodeId + '->' + c.toNodeId).sort(), ['a->b', 'a->c']);
  assert.equal(out.added, 1); // 只补了 a->c
});

test('idempotent: running the migration twice yields identical connections (second run adds nothing)', () => {
  const nodes = [
    { id: 'a' },
    { id: 'b', mentionSourceNodeIds: ['a'] },
    { id: 'c', mentionSourceNodeIds: ['a', 'b'] },
  ];
  const first = migrateMentionsToEdges(nodes, []);
  const second = migrateMentionsToEdges(first.nodes, first.connections);
  assert.equal(second.added, 0);
  assert.deepEqual(second.connections, first.connections);
  const third = migrateMentionsToEdges(nodes, []); // 原始输入再跑一遍 -> 与第一次完全一致
  assert.deepEqual(third.connections, first.connections);
});

test('existing edge not duplicated: node already connected by same from->to', () => {
  const nodes = [{ id: 'a' }, { id: 'b', mentionSourceNodeIds: ['a'] }];
  const existing = [edge('a', 'b')];
  const out = migrateMentionsToEdges(nodes, existing);
  assert.equal(out.added, 0);
  assert.equal(out.connections.length, 1);
  assert.deepEqual(out.connections[0], { fromNodeId: 'a', toNodeId: 'b', relation: 'reference' });
});

test('self and empty mentions are ignored (no dead edges, dropped from the array)', () => {
  const nodes = [{ id: 'a', mentionSourceNodeIds: ['a', '', '   '] }];
  const out = migrateMentionsToEdges(nodes, []);
  assert.deepEqual(out.connections, []);
  assert.equal(out.added, 0);
  assert.ok(!('mentionSourceNodeIds' in out.nodes[0]), 'junk mentions must be dropped');
});

test('unknown mention targets are deferred (kept flagged, no dead edges, stable across runs)', () => {
  const nodes = [
    { id: 'a' },
    { id: 'b', mentionSourceNodeIds: ['ghost', 'a', 'ghost'] },
  ];
  const out = migrateMentionsToEdges(nodes, []);
  assert.deepEqual(out.connections, [edge('a', 'b')]);
  assert.deepEqual(out.nodes[1].mentionSourceNodeIds, ['ghost']); // 去重后保留（延后补边）
  const again = migrateMentionsToEdges(out.nodes, out.connections);
  assert.equal(again.added, 0);
  assert.deepEqual(again.nodes[1].mentionSourceNodeIds, ['ghost']);
});

test('legacy edge notation from/to is normalized; duplicate edges collapsed to one', () => {
  const nodes = [{ id: 'a' }, { id: 'b' }];
  const legacy = [
    { from: 'a', to: 'b', relation: 'reference' },
    { fromNodeId: 'a', toNodeId: 'b' }, // 同 from->to 重复 -> 只留一条
  ];
  const out = migrateMentionsToEdges(nodes, legacy);
  assert.equal(out.connections.length, 1);
  assert.deepEqual(out.connections[0].fromNodeId, 'a');
  assert.deepEqual(out.connections[0].toNodeId, 'b');
  assert.equal(out.connections[0].relation, 'reference');
});

test('pure: input nodes/connections are not mutated', () => {
  const nodes = [{ id: 'a' }, { id: 'b', mentionSourceNodeIds: ['a'] }];
  const connections = [];
  const originalNodes = JSON.parse(JSON.stringify(nodes));
  migrateMentionsToEdges(nodes, connections);
  assert.deepEqual(nodes, originalNodes, 'input nodes must stay untouched');
  assert.equal(connections.length, 0, 'input connections must stay untouched');
});

test('no mention fields at all: pass-through graph, zero added', () => {
  const nodes = [{ id: 'a' }, { id: 'b' }];
  const connections = [edge('a', 'b')];
  const out = migrateMentionsToEdges(nodes, connections);
  assert.equal(out.added, 0);
  assert.deepEqual(out.connections, connections);
});
