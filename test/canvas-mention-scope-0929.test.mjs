import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { mergeGraphMentionSources } from '../src/pages/EcCanvas/workflowTemplates.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const index = read('src/pages/EcCanvas/index.jsx');

/* ══════════════════════════════════════════════════════════════════════════════
   @ 菜单的范围（批 CY-㉙）

   用户 2026-09-30 逐字（电商套图那张）：
     「然后你这里为什么@ 按钮是能生效的呢……他现在能够艾特到一个完全跟当前节点不相关的
       一张图片。这个是完全不对的呀。他必须只能@ 到当前节点，有用户上传上来的图片或者
       视频等等的素材才对呀。」

   改前（index.jsx:1202）：
     rawAvailableComposerSources = nodes.filter(node => node?.url && [...].includes(node.kind)
                                                && node.id !== selectedNode?.id)
   ⇒ **画布上每一张图**都进了 @ 菜单。用户以为那些图会参与本次生成。

   正确的范围 = 当前节点自己的素材（sourceNodeIds） + 它的一级上游（连进来的）
   ══════════════════════════════════════════════════════════════════════════════ */

/** 把 index.jsx 里 @ 菜单候选的过滤条件复刻成可测的纯逻辑（只测判据，不测 React）。 */
function mentionCandidates({ nodes, selectedNode, connections }) {
  const scope = new Set([
    ...(selectedNode.sourceNodeIds || []),
    ...mergeGraphMentionSources(selectedNode, connections),
  ].map(id => String(id ?? '').trim()).filter(Boolean));
  return nodes.filter(node =>
    node?.url
    && ['image', 'output', 'image-composer', 'layer-group'].includes(node.kind)
    && node.id !== selectedNode?.id
    && scope.has(String(node.id)));
}

const N = (id, extra = {}) => ({ id, kind: 'image', url: `/u/${id}.png`, ...extra });

test('① 自己的素材可以被 @（用户在这个框里传进来的）', () => {
  const nodes = [N('img_a'), N('img_b')];
  const composer = { id: 'suite1', kind: 'suite-composer', sourceNodeIds: ['img_a'] };
  const got = mentionCandidates({ nodes, selectedNode: composer, connections: [] }).map(n => n.id);
  assert.deepEqual(got, ['img_a'], '用户自己传的图必须出现在 @ 菜单里');
});

test('② 完全不相关的画布素材**不得**出现在 @ 菜单里（这就是用户报的那条）', () => {
  const nodes = [N('img_a'), N('unrelated_1'), N('unrelated_2'), N('unrelated_3')];
  const composer = { id: 'suite1', kind: 'suite-composer', sourceNodeIds: ['img_a'] };
  const got = mentionCandidates({ nodes, selectedNode: composer, connections: [] }).map(n => n.id);
  assert.deepEqual(got, ['img_a'],
    '画布上其它无关素材不得进 @ 菜单 —— 改前它们全部会出现，这正是「能艾特到完全跟当前节点不相关的图」');
});

test('③ 一级上游（连进来的线）仍然可以被 @ —— 不能把范围收得过窄', () => {
  const nodes = [N('upstream'), N('stranger')];
  const composer = { id: 'video1', kind: 'video-composer', sourceNodeIds: [] };
  const connections = [{ fromNodeId: 'upstream', toNodeId: 'video1' }];
  const got = mentionCandidates({ nodes, selectedNode: composer, connections }).map(n => n.id);
  assert.deepEqual(got, ['upstream'], '连线来源是合法素材，必须保留');
});

test('④ 二级上游**不该**出现（只收一级：连线是有向的，隔一层就没关系了）', () => {
  const nodes = [N('far'), N('near')];
  const composer = { id: 'video1', kind: 'video-composer', sourceNodeIds: [] };
  const connections = [
    { fromNodeId: 'far', toNodeId: 'near' },
    { fromNodeId: 'near', toNodeId: 'video1' },
  ];
  const got = mentionCandidates({ nodes, selectedNode: composer, connections }).map(n => n.id);
  assert.deepEqual(got, ['near'], '只收一级上游；far 是 far→near→video1 的二级');
});

test('⑤ 自身节点永远不出现（不能 @ 自己）', () => {
  const nodes = [N('self', { kind: 'image-composer' })];
  const composer = { id: 'self', kind: 'image-composer', sourceNodeIds: ['self'] };
  const got = mentionCandidates({ nodes, selectedNode: composer, connections: [] });
  assert.deepEqual(got, [], '@ 菜单不得包含节点自己');
});

test('⑥ 代码里必须真的收窄了（防止有人把 filter 又放回全画布）', () => {
  assert.match(index, /composerScopeIds\.has\(String\(node\.id\)\)/,
    '@ 菜单候选必须受 composerScopeIds 约束');
  assert.match(index, /const composerScopeIds = selectedNode[\s\S]{0,200}mergeGraphMentionSources\(selectedNode, connections\)/,
    '范围 = 自己的 sourceNodeIds + 一级上游（mergeGraphMentionSources）');
  // 改前那行「除了自己全都进」不许再以任何形式出现
  assert.doesNotMatch(
    index,
    /nodes\.filter\(node => node\?\.url && \['image', 'output', 'image-composer', 'layer-group'\]\.includes\(node\.kind\) && node\.id !== selectedNode\?\.id\)/,
    '「整张画布的图都进 @ 菜单」这个写法必须已消失',
  );
});

test('⑦ mergeGraphMentionSources 本身不该被改（它是对的：自身优先、入边补位、去重）', () => {
  const node = { id: 'c1', mentionSourceNodeIds: ['m2', 'm1'] };
  const connections = [{ fromNodeId: 'e1', toNodeId: 'c1' }, { fromNodeId: 'm1', toNodeId: 'c1' }];
  assert.deepEqual(mergeGraphMentionSources(node, connections), ['m2', 'm1', 'e1'],
    '顺序语义：自身 mention 在前、入边按连接顺序补位、与自身去重');
});
