import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';

/* ═══ 2026-10-03 批 DE：图片复刻（?tool=image-clone）的「复刻程度」是**卡片选择器** ═══════════════════════
   实测（docs/design/data/quantv-image-tools-20261003.json 的 pages['image.copy']）：
     {"name":"复刻程度","control":"card selector ×2","options":"参考排版 / 高度复刻",
      "note":"卡片选择器，每张带说明文案"}
   我们原来是两颗药丸（`kind: 'segmented'`），那句"各带一句说明"只能挂在字段 hint 上浮在控件下面。
   ⇒ 换成既有的 `kind: 'cards'`（批 Q 已为知渔「套图结构配置」那两张 437×82 的卡落地）：
     说明进到**每张卡里**，整幅宽度，右上角一个 ✓。
   ⚠️ 字段的 `hint` 一字未删 —— 它进的是提示词与读屏，删了就是"少给了还不说"。 */

const raw = JSON.parse(readFileSync(new URL('../docs/design/data/quantv-image-tools-20261003.json', import.meta.url), 'utf8'));
const capture = raw.pages['image.copy'];
const skill = IMAGE_SKILLS.find(item => item.id === 'image.copy');
const degree = (skill.fields || []).find(item => item.key === 'degree');

test('① 实采里「复刻程度」确实是 card selector ×2、每张带说明', () => {
  const block = (capture.blocks || []).find(item => item.name === '复刻程度');
  assert.ok(block, '实采里没有「复刻程度」这一块');
  assert.match(block.control, /^card selector/, '知渔那一页这一格是卡片选择器');
  assert.match(block.options, /参考排版/);
  assert.match(block.options, /高度复刻/);
  assert.match(block.note, /每张带说明文案/, '实采写明每张卡带说明文案');
});

test('② 我们声明成 cards，两档都带自己的说明', () => {
  assert.equal(degree.kind, 'cards', '这一格应当是卡片选择器，不是药丸');
  assert.deepEqual(degree.options.map(option => option.value), ['参考排版', '高度复刻']);
  for (const option of degree.options) {
    assert.ok(String(option.note || '').trim().length > 4,
      `「${option.label}」那张卡必须带说明文案（实采 note：每张带说明文案）`);
  }
  /* 说明写进卡里之后，字段级 hint 仍在 —— 它进提示词与读屏，不是重复文案 */
  assert.ok(String(degree.hint || '').includes('参考排版'), '字段 hint 不能因为改了形态就删掉');
});
