// test/canvas-mention-insert-0912.test.mjs
// 2026-09-12 用户批注：「@ 按钮选中之后没进入编辑区」。
// 根因：参考图已选中时，@ 菜单里点它会走「取消选中」分支 —— 既不插入 @提及，还把参考图删了。
// 约定：@ 菜单的语义 = 插入提及（未选中则同时选中），绝不在菜单里取消选中。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studio = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');

test('@ 菜单传 fromMention 语义给开关处理', () => {
  assert.match(studio, /onToggle=\{image => onToggleSource\?\.\(image, \{ fromMention: true \}\)\}/);
  assert.match(studio, /selectionMode="insert"/);
});

test('fromMention 分支：未选中则选中 + 总是插入提及，绝不取消选中', () => {
  const branches = studio.match(/if \(options\.fromMention === true\) \{[\s\S]*?\n\s*\}/g) || [];
  assert.ok(branches.length >= 3, '三处 composer 都处理 fromMention，实际 ' + branches.length);
  for (const branch of branches) {
    assert.match(branch, /insertMention\(/, '必须插入提及');
    assert.match(branch, /if \(!selected\)/, '只在未选中时补选中');
    assert.doesNotMatch(branch, /onRemoveSource|onToggleSource\?\.\([^)]*, [^)]*skipPromptInsert[^)]*\);\s*\n\s*\}/, '不得在菜单里移除来源');
  }
});

test('普通来源开关仍保留原有「选中即插入」行为', () => {
  assert.match(studio, /if \(!selected\) promptFieldRef\.current\?\.insertMention\(sourceImage\.label\)/);
});
