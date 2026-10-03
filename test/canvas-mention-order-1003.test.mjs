// test/canvas-mention-order-1003.test.mjs
// 「@ 参考图N」的编号必须只有**一份**顺序 —— 2026-10-03
//
// 起因是朋友账号的真实反馈：他在画布上用**连线**把素材节点接进生成框，然后
// 点 @ 面板里的「参考图1」，插进输入框的却是「参考图2」；面板的上下顺序也是颠倒的。
//
// 根因是编号用了两份不同的顺序：
//   · 面板每行**显示**的标签 = selectedMention.label，来自 selectedComposerMentions
//     ⇒ 顺序是 mergeGraphMentionSources（自身 mention 优先 + 入边顺序）
//   · 点击时 onToggle 传出的 image 来自 availableComposerSources
//     ⇒ 顺序是 nodes 数组顺序（buildImageMentions 按下标编号）
// 两份顺序不一致时，"参考图1" 这四个字在显示处和插入处指的不是同一张图。
// 传素材上传时两份顺序碰巧一致，所以本机上复现不出来 —— 只有连线接进来才会错位。
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mergeGraphMentionSources } from '../src/pages/EcCanvas/workflowTemplates.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(path.join(ROOT, 'src/pages/EcCanvas/index.jsx'), 'utf8');

test('① @ 面板的候选必须按 merge 顺序取，不能按 nodes 数组顺序', () => {
  /* 判据：候选 id 的**驱动源**必须是 mergeGraphMentionSources，
     一旦改回 nodes.filter(...) 当驱动，编号就会与显示标签错位。 */
  assert.match(
    source,
    /const composerCandidateIds = selectedNode[\s\S]{0,320}?mergeGraphMentionSources\(selectedNode, connections\)/,
    '候选 id 必须由 mergeGraphMentionSources 驱动（自己 + 一级上游，且顺序稳定）',
  );
  assert.match(
    source,
    /composerCandidateIds[\s\S]{0,160}?\.map\(id => nodes\.find/,
    '候选要按 composerCandidateIds 的顺序取节点，而不是遍历 nodes',
  );
  assert.doesNotMatch(
    source,
    /const rawAvailableComposerSources = nodes\.filter/,
    '不得再按 nodes 数组顺序取 @ 面板候选 —— 那是这次错位的直接原因',
  );
  /* 范围不能因为排序而缩水：merge 只读 mentionSourceNodeIds + 入边，
     而点上传写的是 sourceNodeIds（handleComposerSourceUpload 数组和边一起写）——
     两者并集才是改前的范围。 */
  assert.match(
    source,
    /composerCandidateIds = selectedNode[\s\S]{0,320}?selectedNode\.sourceNodeIds/,
    '候选范围必须并上自己的 sourceNodeIds，否则上传进来的素材会从 @ 菜单消失',
  );
});

test('② 面板显示的标签与点击插入的必须是同一份数据', () => {
  /* ImageMentionPicker 行内显示 selectedMention?.label，却把 available 里的 image
     交给 onToggle。只有当两者同源（同一顺序、同一 buildImageMentions 编号）时才对得上。 */
  assert.match(source, /mentionSources=\{selectedComposerMentions\}/);
  assert.match(source, /availableSources=\{availableComposerSources\}/);
  /* selectedComposerMentions 必须继续从 availableComposerSources 里取，
     这样它的编号与面板显示天然一致（而不是再从 nodes 里另编一次）。 */
  assert.match(
    source,
    /selectedComposerMentions = selectedNode\s*\n?\s*\? mergeGraphMentionSources\(selectedNode, connections\)\.map\(id => availableComposerSources\.find/,
    'selectedComposerMentions 必须复用 availableComposerSources，避免第二份编号',
  );
});

test('③ 死变量不许留下：composerScopeIds 已经没有消费者', () => {
  assert.doesNotMatch(source, /composerScopeIds/, '改用 merge 顺序做驱动后，这个集合没人用了');
});

test('④ 回归：merge 顺序本身仍然是自己 mention 优先、入边按数组顺序', () => {
  /* 上面两条约束的是"只有一份顺序"，不是要改 merge 的语义。 */
  const node = { id: 'composer', mentionSourceNodeIds: ['own'] };
  const connections = [{ fromNodeId: 'edgeA', toNodeId: 'composer' }, { fromNodeId: 'edgeB', toNodeId: 'composer' }];
  assert.deepEqual(
    mergeGraphMentionSources(node, connections),
    ['own', 'edgeA', 'edgeB'],
    '自身 mention 必须在入边之前，且入边保持连线数组顺序',
  );
});

test('⑤ 连线接进来的素材也必须进入 @ 菜单（这是用户唯一能看到的范围）', () => {
  /* 收窄到"自己的 + 一级上游"是对的行为（批 9-12 用户批注），不能被这次修复顺带削掉。 */
  assert.match(source, /\['image', 'output', 'image-composer', 'layer-group'\]\.includes\(node\.kind\)/,
    '@ 菜单仍应包含这四类节点');
  assert.match(source, /node\.id !== selectedNode\?\.id/, '仍要排除自己');
});
