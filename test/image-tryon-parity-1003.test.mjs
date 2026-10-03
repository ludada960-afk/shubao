import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';

/* ═══ 2026-10-03 批 DE：AI换装（?tool=ai-outfit）的**形态**必须与知渔那一页一致 ═══════════════════════════
   实测来源：docs/design/data/quantv-image-tools-20261003.json 的 pages['image.try_on']，
   逐条照抄（字段与文案早就对齐了，这一门禁只管**形态**那三处）：

     · 模特选择 / 服装选择 / Pose 参考（可选）/ 背景参考（可选）
         → 四组的 `control` 全是 `accordion`、`default` 全是 `展开`（我们原来是四个平铺组）
     · 模型选择     → `select`，**单选下拉**（我们本来就是 select）
     · 分辨率       → `select`，1K/2K/4K（我们画成了药丸）
     · 比例         → `pills`，6 档（我们的 segmented 就是这一档形态，14 档那页同样成立）
     · 生成张数     → `select`，1/2/3/4（我们画的是步进器）

   ⚠️ **模型选择的档位数不在这一门禁的范围里**：知渔那一页只有 1 项（「智能图片image」），
      我们有 8 项（引用自己的模型目录，与首页同一份）。那是**能力差**不是形态差 ——
      为了"看着一样"把 7 个能用的模型删掉是砍功能，不是对齐。形态（单选下拉）已经一致。 */

const raw = JSON.parse(readFileSync(new URL('../docs/design/data/quantv-image-tools-20261003.json', import.meta.url), 'utf8'));
const capture = raw.pages['image.try_on'];
const skill = IMAGE_SKILLS.find(item => item.id === 'image.try_on');
const field = key => (skill.fields || []).find(item => item.key === key);

test('① 实采里那四组确实是手风琴、且默认展开（门禁的事实源不是我们的注释）', () => {
  assert.ok(capture, '实采里没有 image.try_on 那一页');
  const accordions = (capture.blocks || []).filter(block => block.control === 'accordion');
  assert.equal(accordions.length, 4, '知渔那一页应当有 4 个手风琴组');
  for (const block of accordions) assert.equal(block.default, '展开', block.name + ' 应当默认展开');
  assert.deepEqual(
    accordions.map(block => block.name),
    ['模特选择', '服装选择', 'Pose 参考（可选）', '背景参考（可选）'],
    '四组的顺序与名称变了（实采数据动过）',
  );
});

test('② 我们那四组声明成 accordion（其余组不动）', () => {
  const layouts = (skill.workbench && skill.workbench.groupLayouts) || {};
  assert.deepEqual(layouts, {
    模特选择: 'accordion',
    服装选择: 'accordion',
    'Pose 参考（可选）': 'accordion',
    '背景参考（可选）': 'accordion',
  });
  /* 「生成设置」那一组**不**声明 ⇒ 仍平铺（知渔那一组本就是折线以下的普通配置区） */
  assert.equal(layouts['生成设置'], undefined);
  /* 声明手风琴的组必须真的存在 —— 写一个不存在的组名等于给空气加了个开关 */
  const groups = [...new Set((skill.fields || []).map(item => item.group).filter(Boolean))];
  for (const name of Object.keys(layouts)) assert.ok(groups.includes(name), `声明了不存在的组：${name}`);
});

test('③ 分辨率 / 生成张数是**下拉**，不是药丸 / 步进器', () => {
  const clarity = field('clarity');
  assert.ok(clarity, '缺 clarity 字段');
  assert.equal(clarity.kind, 'select', '知渔那一页的分辨率是原生下拉');
  assert.deepEqual((clarity.options || []).map(option => option.label), ['1K', '2K', '4K']);

  const count = field('count');
  assert.ok(count, '缺 count 字段');
  assert.equal(count.kind, 'select', '知渔那一页的生成张数是原生下拉');
  assert.deepEqual((count.options || []).map(option => option.value), ['1', '2', '3', '4']);
  assert.equal(count.max, 4, 'max 仍要与知渔那一页的档数一致（报价与上限都读它）');

  const ratio = field('ratio');
  assert.equal(ratio.kind, 'segmented', '比例那一档知渔是药丸形态 —— 我们这一族就是药丸，不改');
  assert.equal((ratio.options || []).length, 6);

  assert.equal(field('imageModel').kind, 'select', '模型选择本来就是单选下拉，形态已一致');
});

test('④ 收敛态要把内容从 DOM 里拿掉（本仓老教训：藏起来不算）', () => {
  const shell = readFileSync(new URL('../src/components/media/WorkbenchShell.jsx', import.meta.url), 'utf8');
  assert.match(shell, /const open = !collapsible \|\| !collapsedGroups\.includes\(group\.name\)/);
  assert.match(shell, /\{open && <div/, '折叠时整块 .media-workbench-fields 不渲染');
  assert.match(shell, /aria-expated|aria-expanded=\{open\}/, '收放是交互，得能被读屏读到');
  assert.match(shell, /media-workbench-accordion-head/, '组头本身是收放按钮（知渔那张卡的形态）');
});
