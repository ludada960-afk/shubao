// test/canvas-plan-launch-0912.test.mjs
// 2026-09-12 用户批注：点「带设计方案」进画布后，素材没带进来、也没看到生成节点。
// 排查结论：发射图其实建出来了（有 toast 为证），但**视口没有移动**，用户看到的是空画布。
// 本文件锁定两件事：① 发射图必须带素材节点并连到目标节点；② 发射后必须把视口对准新图。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPlanLaunchGraph, isPlanLaunch } from '../src/pages/EcCanvas/canvasPlanLaunch.js';

const page = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');

const launch = {
  kind: 'ec-plan-launch',
  draftId: 'draft-1',
  description: '保温杯主图，保留商品结构，换成夏日场景',
  productName: '保温杯',
  realShots: [{ assetId: 'a1', url: 'https://cdn.example.com/p1.png', name: '产品图 1' }],
  refShots: [{ assetId: 'a2', url: 'https://cdn.example.com/r1.png', name: '参考图 1' }],
  platform: 'taobao',
  sizing: { resolution: '2K' },
  genSettings: { imageModel: 'image2' },
};

test('带方案：素材按列排 + 提示词节点 + 设计方案节点，全部连到方案节点', () => {
  const graph = createPlanLaunchGraph({ launch, now: 1 });
  const materials = graph.nodes.filter(node => node.kind === 'image' && node.provenance === 'source');
  assert.equal(materials.length, 2, '两张素材都要进画布');
  /* 9-12 用户批注：产品图一列、参考图一列（列内竖排） */
  const products = materials.filter(node => node.role === 'product');
  const references = materials.filter(node => node.role === 'reference');
  assert.equal(products.length, 1);
  assert.equal(references.length, 1);
  assert.ok(references[0].x > products[0].x, '参考图列在产品图列右边');
  /* 同一列内多个素材要竖排（y 递增、x 相同） */
  const columnTest = createPlanLaunchGraph({ launch: { ...launch, realShots: [launch.realShots[0], { assetId: 'a3', url: 'https://cdn.example.com/p2.png', name: '产品图 2' }] }, now: 9 });
  const columnProducts = columnTest.nodes.filter(node => node.role === 'product');
  assert.equal(columnProducts.length, 2);
  assert.equal(columnProducts[0].x, columnProducts[1].x, '同列 x 相同');
  assert.ok(columnProducts[1].y > columnProducts[0].y, '同列竖排');
  /* 提示词也是一个节点，并且参与连线 */
  const promptNode = graph.nodes.find(node => node.id.startsWith('plan_prompt_'));
  assert.ok(promptNode, '提示词节点必须存在');
  assert.equal(promptNode.kind, 'text');
  assert.ok(promptNode.text.includes('保温杯'), '提示词内容要带过来');
  const target = graph.nodes.find(node => node.id === graph.targetId);
  assert.equal(target.kind, 'design-direction');
  assert.ok(target.sourceNodeIds.includes(promptNode.id), '方案节点要把提示词当来源');
  for (const node of materials) assert.ok(target.sourceNodeIds.includes(node.id), '方案节点要挂上素材作为来源');
  assert.equal(graph.connections.length, materials.length + 1, '每个素材 + 提示词各一条连线');
  assert.ok(promptNode.x > Math.max(...materials.map(node => node.x)), '提示词排在素材列右侧');
  assert.ok(target.x > promptNode.x, '方案节点排在提示词右侧');
});

test('快速生成：不建方案节点，直接套图生成器', () => {
  const graph = createPlanLaunchGraph({ launch: { ...launch, quick: true }, now: 2 });
  const target = graph.nodes.find(node => node.id === graph.targetId);
  assert.equal(target.kind, 'suite-composer');
});

test('没有可用素材时也不炸（只是图里没有素材节点）', () => {
  const graph = createPlanLaunchGraph({ launch: { ...launch, realShots: [], refShots: [] }, now: 3 });
  assert.equal(graph.nodes.filter(node => node.kind === 'image').length, 0);
  assert.ok(graph.nodes.find(node => node.id === graph.targetId));
});

test('isPlanLaunch 只认 ec-plan-launch', () => {
  assert.equal(isPlanLaunch(launch), true);
  assert.equal(isPlanLaunch({ kind: 'other' }), false);
  assert.equal(isPlanLaunch(null), false);
});

test('发射进画布后必须把视口对准新图（否则用户看到空画布）', () => {
  assert.match(page, /const launchRect = containerRef\.current\?\.getBoundingClientRect\(\)/);
  assert.match(page, /setViewport\(\{\s*\n\s*scale,/);
  assert.match(page, /x: \(launchRect\.width - graphW \* scale\) \/ 2 - minX \* scale/);
});

test('发射图与「从草稿/会话重建」在同一效应内装配（不再被覆盖）', () => {
  /* 根治①：发射如果放在独立效应里，会被随后运行的重建效应 setNodes 盖掉 */
  assert.match(page, /const pendingLaunch = state\.creationLaunch;/);
  assert.match(page, /if \(isPlanLaunch\(pendingLaunch\)\) \{\s*\n\s*try \{\s*\n\s*applyPlanLaunch\(pendingLaunch\);/);
  assert.match(page, /\}, \[result\.id, result\._saveKey, state\.creationLaunch\]\)/, '发射状态要进依赖数组');
  /* 独立效应必须已删除 */
  assert.doesNotMatch(page, /if \(!isPlanLaunch\(launch\)\) return;/);
});

test('根治②：清空 launch 触发的重跑必须被跳过（否则刚铺好的节点又被清空）', () => {
  assert.match(page, /const launchJustAppliedRef = useRef\(false\)/);
  assert.match(page, /dispatch\(\{ type: 'SET_CREATION_LAUNCH', launch: null \}\);\s*\n\s*\/\*[\s\S]*?\*\/\s*\n\s*launchJustAppliedRef\.current = true;/);
  assert.match(page, /if \(launchJustAppliedRef\.current\) \{\s*\n\s*launchJustAppliedRef\.current = false;\s*\n\s*draftReadyRef\.current = true;\s*\n\s*return \(\) => \{ cancelled = true; \};\s*\n\s*\}\s*\n\s*if \(!hasCurrent\) \{/, '跳过那一跳必须发生在「空画布清空」分支之前');
});
