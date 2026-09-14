// test/canvas-prompt-authority-0917.test.mjs
// 2026-09-17 统筹定下的「电商生图信息源权威性排序」唯一规则，逐条钉住：
//   1 硬约束层（配置面板）＝ 永远最高优先，提示词不能覆盖；冲突不静默，要显式提示
//   2 产出结构层（套图方案 + SKU 变体）＝ 决定出什么/几张/什么比例；提示词不能改
//   3 内容意图层（提示词 + skill + 其它补充 + 变体说明）＝ 提示词优先于 skill
//   4 设计方案（确认后）＝ 唯一事实源，参数回写节点配置；硬约束继续生效
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  PROMPT_LAYER,
  HARD_CONSTRAINT_KEYS,
  isStructuralIntent,
  detectHardConstraintConflicts,
  compileSupplementSegments,
  resolvePromptAuthority,
  applyPlanToConfiguration,
} from '../src/pages/EcCanvas/canvasPromptAuthority.js';

test('层级定义：硬约束 1 < 产出结构 2 < 内容意图 3 < 设计方案 4', () => {
  assert.equal(PROMPT_LAYER.HARD_CONSTRAINT, 1);
  assert.equal(PROMPT_LAYER.OUTPUT_STRUCTURE, 2);
  assert.equal(PROMPT_LAYER.CONTENT_INTENT, 3);
  assert.equal(PROMPT_LAYER.DESIGN_PLAN, 4);
  assert.ok(PROMPT_LAYER.HARD_CONSTRAINT < PROMPT_LAYER.OUTPUT_STRUCTURE, '硬约束必须最权威');
});

/* ── 第 2 层：提示词不能改结构 ── */
test('张数意图被识别为越权（结构层说了算）', () => {
  for (const text of ['给我出 6 张图', '生成 3 张', '一共 12 张', '出8张']) {
    const r = isStructuralIntent(text);
    assert.equal(r.structural, true, text + ' 应被识别为结构意图');
    assert.ok(r.reason.includes('张数'), '原因要说明是张数');
  }
});

test('比例意图被识别为越权', () => {
  for (const text of ['改成 3:4', '用 9:16 比例', '16:9 横版']) {
    assert.equal(isStructuralIntent(text).structural, true, text + ' 应被识别为结构意图');
  }
});

test('图类型意图被识别为越权', () => {
  for (const text of ['再来一张白底图', '多出几张详情图', '补个 SKU 图']) {
    assert.equal(isStructuralIntent(text).structural, true, text + ' 应被识别为结构意图');
  }
});

test('纯内容意图不算越权（画面/风格/卖点/场景）', () => {
  for (const text of ['换成夏日清新风格', '突出轻薄与续航', '背景用木质桌面', '让模特自然微笑']) {
    assert.equal(isStructuralIntent(text).structural, false, text + ' 不应被判为结构意图');
  }
  assert.equal(isStructuralIntent('').structural, false, '空提示词不算');
});

/* ── 第 1 层：硬约束胜出且不静默 ── */
test('提示词要求的内容与「避免出现的元素」相撞时被检出', () => {
  const r = detectHardConstraintConflicts({ prompt: '画面加上文字水印和促销角标', negative: '文字水印，促销角标' });
  assert.deepEqual(r.conflicts, ['文字水印', '促销角标']);
  assert.ok(r.reason.length > 0, '必须给出可展示的原因');
});

test('没有冲突时不误报', () => {
  assert.deepEqual(detectHardConstraintConflicts({ prompt: '夏日清新风格', negative: '文字水印' }).conflicts, []);
  assert.deepEqual(detectHardConstraintConflicts({ prompt: '', negative: '文字水印' }).conflicts, []);
  assert.deepEqual(detectHardConstraintConflicts({ prompt: '夏日', negative: '' }).conflicts, []);
});

/* ── 第 3 层：补充信息进 prompt 编译 ── */
test('「其它补充」与「变体说明」编译进补充说明段', () => {
  const r = compileSupplementSegments({
    extraNotes: '礼盒装，含 Type-C 线',
    skus: [{ color: '月岩白', size: 'M', note: '哑光表面' }, { color: '曜石黑', note: '亮面' }, { color: '无说明' }],
  });
  assert.equal(r.segments.length, 3, '1 条其它补充 + 2 条有效变体说明');
  assert.ok(r.text.includes('补充说明：礼盒装，含 Type-C 线'));
  assert.ok(r.text.includes('变体说明（月岩白/M）：哑光表面'));
  assert.ok(!r.text.includes('无说明'), '空说明不得产生空段');
  assert.deepEqual(r.sources, ['extraNotes', 'skuNotes']);
});

test('没有补充信息时不产生空段', () => {
  const r = compileSupplementSegments({ extraNotes: '  ', skus: [{ color: 'x' }] });
  assert.deepEqual(r.segments, []);
  assert.equal(r.text, '');
});

/* ── 总判定：冲突提示「说结果不说机制」 ── */
test('结构越权 + 硬约束冲突 → 两条显式提示，且不暴露内部术语', () => {
  const r = resolvePromptAuthority({
    prompt: '出 6 张图，加文字水印',
    configuration: { negative: '文字水印', genSettings: { resolution: '2K' } },
  });
  assert.equal(r.structuralOverridden, true);
  assert.deepEqual(r.hardConstraintConflicts, ['文字水印']);
  assert.equal(r.notices.length, 2);
  assert.ok(r.notices.some(n => n.includes('已按套图方案出图')), '结构提示要说结果');
  /* 提示语不得出现嵌套括号（实测踩过「（张数（出 6 张）以方案为准）」这种难读写法） */
  for (const notice of r.notices) {
    assert.ok(!/\([^)]*\(/.test(notice), '提示语不得嵌套括号：' + notice);
  }
  assert.ok(r.notices.some(n => n.includes('已按你的约束忽略提示词中的「文字水印」')), '硬约束提示要显式点名');
  for (const notice of r.notices) {
    assert.ok(!/结构层|内容意图层|优先级|层级/.test(notice), '提示里不得出现内部层级术语：' + notice);
  }
});

test('无冲突时不给多余提示（不打扰）', () => {
  const r = resolvePromptAuthority({ prompt: '夏日清新风格', configuration: { negative: '文字水印' } });
  assert.deepEqual(r.notices, []);
  assert.equal(r.structuralOverridden, false);
});

/* ── 第 4 层：方案回写配置 ── */
test('确认方案后，方案参数回写到节点配置（不允许配置 A + 方案 B 并存）', () => {
  const next = applyPlanToConfiguration({
    configuration: { ratio: '1:1', count: 4, genSettings: { resolution: '2K', imageModel: 'image2' }, copywriting: { headline: '旧' } },
    plan: { ratio: '3:4', count: 9, style: 'lifestyle', direction: '夏日', copywriting: { headline: '新' }, genSettings: { resolution: '4K', imageModel: 'nano-banana-2' } },
  });
  assert.equal(next.ratio, '3:4', '比例以方案为准');
  assert.equal(next.count, 9, '张数以方案为准');
  assert.equal(next.genSettings.imageModel, 'nano-banana-2', '非硬约束的生成设置以方案为准');
  assert.equal(next.copywriting.headline, '新', '文案以方案为准');
  assert.equal(next.styleSkill, 'lifestyle');
  assert.equal(next.direction, '夏日');
});

test('方案回写不得覆盖硬约束层（硬约束继续独立生效）', () => {
  const next = applyPlanToConfiguration({
    configuration: { genSettings: { resolution: '2K', negative: '文字水印' } },
    /* 方案**试图**改清晰度 —— 清晰度是硬约束键，必须被挡住 */
    plan: { genSettings: { resolution: '4K' } },
  });
  assert.equal(next.genSettings.resolution, '2K', '清晰度属硬约束，方案不得覆盖');
  assert.ok(HARD_CONSTRAINT_KEYS.includes('resolution'), 'resolution 必须在硬约束清单里');
  assert.ok(HARD_CONSTRAINT_KEYS.includes('negative'), 'negative 必须在硬约束清单里');
  assert.ok(HARD_CONSTRAINT_KEYS.includes('platform'), '平台合规必须在硬约束清单里');
});

test('回写是纯函数：不修改入参', () => {
  const configuration = { ratio: '1:1', genSettings: { resolution: '2K' } };
  const snapshot = JSON.stringify(configuration);
  applyPlanToConfiguration({ configuration, plan: { ratio: '3:4', genSettings: { resolution: '4K' } } });
  assert.equal(JSON.stringify(configuration), snapshot, '入参不得被修改');
});

test('skill 只在 prompt 为空时预填（保持既有 applyCanvasSkill 行为）', () => {
  const studio = readFileSync(new URL('../src/pages/EcCanvas/canvasStudioModel.js', import.meta.url), 'utf8');
  assert.ok(/String\(prompt \|\| ''\)\.trim\(\) \? String\(prompt\) : found\.skillPrompt/.test(studio),
    'applyCanvasSkill 必须保持「prompt 非空则不覆盖」');
  /* 权威性模块本身不得去改 skill 的行为：只允许在注释里说明"不改"，
     不得真的 import / 调用（去掉注释后再断言，避免把说明文字误判成实现）。 */
  const authority = readFileSync(new URL('../src/pages/EcCanvas/canvasPromptAuthority.js', import.meta.url), 'utf8');
  const withoutComments = authority.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/applyCanvasSkill/.test(withoutComments), '权威性模块不得 import/调用 applyCanvasSkill');
});
