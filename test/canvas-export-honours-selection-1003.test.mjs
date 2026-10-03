// test/canvas-export-honours-selection-1003.test.mjs
// 门禁：**导出必须尊重当前选中**（2026-10-03 用户批注，紧急）。
//
// 用户原话：「你的导出功能似乎出现大问题，现在根本导出不了，选择了素材，但是没法导出呀」，
// 弹窗标题「没有可导出的图片」、正文「这张画布上没有可导出的生成结果」。
//
// 根因：顶栏那颗「导出」按钮原来是
//     setExportSelectionIds(new Set());   ← 每次都把用户选中清空
// 于是 `selectDeliverableNodes(nodes, new Set())` 走"整张画布"分支：
// 只认 generated / derived 的**生成结果**，用户手动多选的那几张
// （多半是上传的源图）被算进 `excludedSources`（"已排除的原始素材"）⇒ 列表为空。
//
// `selectDeliverableNodes` 本身是对的（明确选中就会导出它们）——
// 所以要钉的是**入口不许把选中丢掉**，而不是去改那个纯函数。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { selectDeliverableNodes } from '../src/pages/EcCanvas/canvasAssetProvenance.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'src/pages/EcCanvas/index.jsx'), 'utf8');
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('① 纯函数：明确选中的源图**也要导出**（这一侧本来就是对的）', () => {
  const nodes = [
    { id: 'src1', kind: 'image', status: 'ready', url: '/a.png', provenance: 'source' },
    { id: 'out1', kind: 'output', status: 'ready', url: '/b.png' },
  ];
  /* 整张画布：源图进 excludedSources */
  const whole = selectDeliverableNodes(nodes, new Set());
  assert.deepEqual(whole.deliverables.map(n => n.id), ['out1']);
  assert.deepEqual(whole.excludedSources.map(n => n.id), ['src1']);

  /* 明确选中源图 ⇒ 它进 deliverables */
  const picked = selectDeliverableNodes(nodes, new Set(['src1']));
  assert.deepEqual(picked.deliverables.map(n => n.id), ['src1'],
    '明确点名要导出的节点必须被导出 —— 否则用户选了也导不出');
});

test('② 顶栏「导出」入口不许清空选中', () => {
  const code = stripComments(INDEX);
  const entry = code.slice(code.indexOf('onExport={() =>'));
  const body = entry.slice(0, 600);

  assert.match(body, /liveSelection/, '导出入口必须先算出"当前选中"');
  assert.match(body, /multiSelected\.size[\s\S]{0,120}new Set\(multiSelected\)/,
    '多选时要按多选导出');
  assert.match(body, /selected \? new Set\(\[selected\]\) : new Set\(\)/,
    '单选时按单选导出');
  assert.doesNotMatch(body, /setExportSelectionIds\(new Set\(\)\)/,
    '旧写法每次都清空选中 ⇒ 用户选了素材也导不出（2026-10-03 线上故障）');
  assert.match(body, /setExportIntent\(liveSelection\.size \? 'selection' : 'suite'\)/,
    '有选中时导出意图必须是 selection，不能是整张画布的 suite');
});

test('③ 选中集合变化时，导出范围跟着变（不许缓存一份旧的）', () => {
  /* exportScope 每次都从 exportSelectionIds 现算，不是模块加载时算一次 */
  const code = stripComments(INDEX);
  assert.match(code, /const exportScope = selectDeliverableNodes\(nodes, exportSelectionIds\)/,
    '导出范围必须每次按当前 exportSelectionIds 现算');
});
