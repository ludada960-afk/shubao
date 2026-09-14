// test/canvas-suite-plan-gate-0917.test.mjs
// 2026-09-17 用户确认口径（产品决定），逐条钉住：
//   ① 商品套图：**必须确认方案才能生成**（未确认时按钮禁用 + 提示「请先确认方案」）；
//   ② 方案生成后状态为「方案待确认」，可编辑、可「重新生成方案」（旧方案保留可对比、不删除）；
//   ③ 方案未确认 = 什么都不发生（不生成、不扣费、不替他决定）；
//   ④ 结果排版规则（图片/视频横向一排、文案纵向一列、套图按类别各自成排、默认全选）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
const canvas = read('src/pages/EcCanvas/index.jsx');
const model = read('src/pages/EcCanvas/canvasStudioModel.js');

test('① 套图节点默认是「方案待确认」（存在不等于确认）', () => {
  assert.ok(/planConfirmed: false/.test(model), '新建套图节点必须默认未确认');
  assert.ok(/planConfirmed 是显式字段/.test(model) || /不是靠"有没有方案"推断/.test(model),
    '必须写明为什么不能靠 suitePlan 存在与否推断');
});

test('① 未确认时生成按钮禁用，并给「请先确认方案」', () => {
  /* 套图 composer 的 CTA：它同时带 planning/planReady/planConfirmed 三个条件，
     用这三个特征定位（图片/文案/视频框的 CTA 不含 planning）。 */
  const cta = studio.match(/disabled=\{loading \|\| \(!planning[\s\S]*?\}/);
  assert.ok(cta, '必须能找到套图生成按钮的 disabled 表达式');
  assert.ok(/planning && !planConfirmed/.test(cta[0]), 'disabled 必须包含「方案未确认」这一条');
  assert.ok(/planning && !planReady/.test(cta[0]), '无方案时同样禁用（两个条件都要）');
  assert.ok(studio.includes('请先确认方案'), '必须给出简短提示');
  /* 提示语纪律：短、说结果不说机制 */
  assert.ok(!/层级|优先级|结构层/.test(studio.match(/请先确认方案[^<]*/)?.[0] || '请先确认方案'),
    '提示语不得带内部术语');
});

test('③ 未确认时 handler 也必须拦住（按钮 disabled 只是表现层）', () => {
  assert.ok(/composer\.suiteStep === 'directions' && composer\.planConfirmed !== true/.test(canvas),
    'handler 必须有第二道闸门');
  const guard = canvas.slice(canvas.indexOf("composer.planConfirmed !== true"), canvas.indexOf("composer.planConfirmed !== true") + 320);
  assert.ok(/return;/.test(guard), '未确认时必须直接 return（不生成）');
  assert.ok(!/generateEcommerceSuite|holdBilling|dispatch\(/.test(guard), 'return 之前不得发起生成或扣费调用');
});

test('② 方案待确认/已确认两态可见，并支持「重新生成方案」', () => {
  assert.ok(studio.includes('方案待确认') && studio.includes('方案已确认'), '两种状态文案都要有');
  assert.ok(studio.includes('重新生成方案'), '必须有重新生成方案的入口');
  assert.ok(/previousSuitePlans: \[\.\.\.\(node\.previousSuitePlans \|\| \[\]\), \.\.\.\(current/.test(studio),
    '旧方案必须被压进 previousSuitePlans 保留（不删除）');
  assert.ok(/planConfirmed: false,\s*\n?\s*suiteStep: 'directions'/.test(studio), '重新生成必须复位为待确认');
});

test('② 方案确认状态随节点进快照（走既有画布保存链路落盘）', () => {
  const snapshot = read('src/pages/EcCanvas/canvasSessionModel.js');
  assert.ok(/nodes/.test(snapshot), '快照必须包含 nodes');
  /* planConfirmed 是节点字段 → 随 nodes 一起持久化，无需额外落盘代码 */
  assert.ok(!/planConfirmed/.test(snapshot), '不需要在快照层特判（节点字段自然随行）');
});

test('④ 排版规则：图片/视频横向一排、间距=节点宽+24、超过 4 张换行', () => {
  assert.ok(/const CANVAS_RESULT_ROW_GAP = 24;/.test(model), '间距 = 24');
  assert.ok(/const CANVAS_RESULT_PER_ROW = 4;/.test(model), '每排 4 张');
  assert.ok(/图片生成结果：\*\*横向一排\*\*/.test(model), '图片横向一排必须写进注释');
  assert.ok(/视频生成结果：\*\*横向一排\*\*/.test(model), '视频横向一排必须写进注释');
  assert.ok(/文案生成结果：\*\*纵向一列\*\*/.test(model), '文案纵向一列必须写进注释');
});

test('④ 排版规则：电商套图按类别各自成排（含 SKU）', () => {
  const rowMatch = canvas.match(/const roleRows = \{([^}]*)\}/);
  assert.ok(rowMatch, 'roleRows 必须存在');
  for (const group of ['白底图', '主图', '详情图', 'SKU', '素材']) {
    assert.ok(rowMatch[1].includes(group), '套图必须给「' + group + '」独立一排');
  }
  assert.ok(/\*\*按类别各自成排\*\*/.test(model), '这条规则要写进注释');
});

test('④ 所有结果生成后默认全部多选', () => {
  /* 各生成路径末尾都要把「本次产出的全部结果节点」整体设为多选：
       套图 → receivedNodeIds；图片/文案/其它 → resultNodeIds / outputs.map(id) */
  assert.ok(/setMultiSelected\(new Set\(receivedNodeIds\)\)/.test(canvas), '套图结果必须默认全选');
  const resultSets = canvas.match(/setMultiSelected\(new Set\(resultNodeIds\)\)/g) || [];
  assert.ok(resultSets.length >= 2, '其它生成路径也要默认全选，实际命中 ' + resultSets.length);
  assert.ok(/setMultiSelected\(new Set\(outputs\.map\(output => output\.id\)\)\)/.test(canvas),
    '多张输出路径也要整体选中');
});

test('④ 结果节点左右都有加号（可继续派生/接入）', () => {
  /* 9-15 用户决定：生成前无加号、生成结果必须有加号 —— 结果节点走 canDerive */
  assert.ok(/canvasGenerationBoxHasResult/.test(model), '结果判定必须存在');
  assert.ok(/canDeriveFromCanvasSource\(node\)|canDerive=\{/.test(canvas), '结果节点必须能派生（有加号）');
});

test('③ 方案未确认不得有任何自动生成/自动扣费路径', () => {
  /* 方案未确认时不存在「自动开跑」的效应：只有用户点 CTA 才会进入 generate 分支 */
  assert.ok(!/planConfirmed[\s\S]{0,200}generateEcommerceSuite/.test(canvas.replace(/[\s\S]*handleSuiteComposerGenerate/, '')),
    '不得在别处凭 planConfirmed 自动触发生成');
  /* 自动开跑只允许发生在「带设计方案发射」这条既有路径（生成的是方案，不是出图） */
  assert.ok(/autoPlanNodeRef\.current = graph\.targetId/.test(canvas), '自动跑的只能是设计方案的生成');
  assert.ok(!/autoPlanNodeRef\.current[\s\S]{0,120}generateEcommerceSuite/.test(canvas), '自动跑不得直接出图');
});

test('③ 离开画布的保存规则未被本次改动影响', () => {
  assert.ok(/if \(openedFromLibraryRef\.current\) \{[\s\S]{0,120}handleCanvasSessionSaveRef\.current\?\.\(\)/.test(canvas),
    '从画布库打开 → 静默保存');
  assert.ok(canvas.includes("confirmLabel: '保存到画布库'") && canvas.includes("cancelLabel: '不保存'"),
    '新建有内容 → 询问保存（两个选项）');
  assert.ok(canvas.includes('if (!nodesRef.current.length) return;'), '空画布不打扰');
  assert.ok(!/planConfirmed[\s\S]{0,200}title: '保存这张画布/.test(canvas), '方案不得额外弹窗');
});
