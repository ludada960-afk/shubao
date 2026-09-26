/* ═══ 门禁：历史列表的**分组 / 悬停动作 / 回到工作台**（2026-09-27 批 CB）════════════════════════
   用户口径（逐字）：
   「图片，视频你要做一个**分类的选项**，可是你又跟我说生成的作品会进入到对应的子页面里面去，
     你的意思是对应的子页面，他只能看到自己当前这个子页面生成的作品吗？……如果是这样的话，
     那你这个分类还有什么意义呢？」⇒ **类型筛选不做了**（见下 ①）；
   「它的**排版**，它的**时间**这些东西是不是也得加进去呢？我们现在这个我的资产还有画布里面的
     新建画布功能他们那里其实已经做过很多相关的一些 UI 或者交互方面的设计了」⇒ 分组与悬停动作照画布库；
   「他点击这个作品的话，这个作品会把它**带到原来的生成时的工作台**里面，然后把之前生成时的那些
     提示词和素材和配置都一起展示在工作台里……重新生成出来的结果**可以是一个新的结果**，而不是
     覆盖掉它原来生成的那个作品。」

   这一组守四件事：
     ① **不做类型筛选**是有判据的（历史按技能筛 ⇒ 单类型列表里筛选没意义），并且这一点写在代码注释里；
     ② 按天分组：**分页先切、再分组**，且组内每项仍带着它在完整历史里的下标（否则灯箱取错图）；
     ③ 悬停才出动作：三条规矩缺一不可（hover + focus-within + hover:none 触屏常显），且**只改透明度**；
     ④ 「回到工作台」：纯函数决定"哪些作品能回去"，落点复用站内已有的 launch（不另写一套还原）。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { groupHistoryByDay } from '../src/pages/Home/mediaHistoryModel.js';
import { canRemixWork, workRemixLaunchOf } from '../src/pages/Home/workRemixLaunch.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(join(ROOT, relative), 'utf8');

test('① 类型筛选**不做**：判据（按技能筛 ⇒ 单类型列表）写在代码里，且没有半成品的选择器', () => {
  const model = read('src/pages/Home/mediaHistoryModel.js');
  assert.match(model, /不做"全部\/图片\/视频"的类型筛选/, '要把"为什么不做"写在代码里（免得下一轮又有人加回来）');
  /* ⚠️ 判据要看**代码**，不能看注释 —— 解释"为什么不做"的那句话本身就会提到"类型筛选"
     （第一版就是这么红的：注释里的字被当成了半成品 UI）。 */
  const workbench = read('src/pages/Home/SkillWorkbench.jsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(workbench, /历史全部|historyTypeFilter|类型筛选/, '没做就别留半成品的选择器');
});

test('② 按天分组：分页先切再分组，且组内保留"完整历史里的下标"（否则灯箱取错图）', () => {
  const now = new Date('2026-09-27T10:00:00');
  const groups = groupHistoryByDay([
    { id: 'today-1', createdAt: '2026-09-27 09:00:00' },
    { id: 'today-2', createdAt: '2026-09-27 08:00:00' },
    { id: 'yesterday', createdAt: '2026-09-26 21:00:00' },
    { id: 'old', createdAt: '2026-09-20 12:00:00' },
    { id: 'unknown', createdAt: '' },
  ], now);
  assert.deepEqual(groups.map(group => group.label), ['今天', '昨天', '09 月 20 日', '更早'], '分组顺序：近的在前，取不到时间的落到"更早"');
  assert.deepEqual(groups[0].items.map(item => item.id), ['today-1', 'today-2'], '同一天里的顺序按原列表（已是时间倒序）');
  assert.deepEqual(groups.at(-1).items.map(item => item.id), ['unknown']);
  /* 空输入不炸 */
  assert.deepEqual(groupHistoryByDay([], now), []);
  assert.deepEqual(groupHistoryByDay(undefined, now), []);
  const workbench = read('src/pages/Home/SkillWorkbench.jsx');
  assert.match(workbench, /const visibleHistory = useMemo\(\s*\n?\s*\(\) => historyList\.slice\(0, historyLimit\)\.map\(\(item, index\) => \(\{ \.\.\.item, __index: index \}\)\)/,
    '分页要先切（不然"显示更多"会把某一整天的组切开跑掉）');
  assert.match(workbench, /groupHistoryByDay\(visibleHistory\)/, '分组作用在切好的那一页上');
  assert.match(workbench, /setLightbox\(row\.__index\)/, '灯箱要用**完整历史里的下标**（组内下标会打开别人的图）');
});

test('③ 悬停才出动作：hover + 键盘 + 触屏三条一起给，且只改透明度（不动尺寸）', () => {
  const css = read('src/pages/Home/SkillWorkbench.css');
  const block = css.slice(css.indexOf('.skill-history-actions'));
  assert.match(block, /opacity: 0;/, '平时不显示');
  assert.match(block, /\.skill-history-item:hover \.skill-history-actions/, '鼠标悬停时出现');
  assert.match(block, /\.skill-history-item:focus-within \.skill-history-actions/, '键盘 Tab 进来也要出现（只认鼠标就是把键盘用户挡在外面）');
  assert.match(block, /@media \(hover: none\) \{\s*\.skill-history-actions \{ opacity: 1; \}/, '触屏没有 hover → 必须常显，否则手机上永远点不到');
  assert.match(block, /transition: opacity/, '只过渡透明度');
  assert.doesNotMatch(block.slice(0, block.indexOf('.skill-history-reuse')), /(display: none|visibility: hidden|height: 0|transform: scale)/,
    '不许用"收起尺寸/位移"那类做法（历史上把按钮收起来就是这么把排版搞塌的）');
});

test('④ 回到生成它的工作台：判据是纯函数，落点复用站内已有的 launch', () => {
  const workable = {
    mediaSkillId: 'image.concept_set',
    replay: { mediaSkillId: 'image.concept_set', panelValues: { theme: '概念：秋日限定', ratio: '3:4' } },
    _inputText: '秋天的无花果香',
    title: '概念视觉方案',
  };
  const launch = workRemixLaunchOf(workable);
  assert.equal(launch.kind, 'work-remix');
  assert.equal(launch.skillId, 'image.concept_set');
  assert.deepEqual(launch.panelValues, { theme: '概念：秋日限定', ratio: '3:4' }, '面板值要原样带上（里面有上传位素材）');
  assert.equal(canRemixWork(workable), true);
  /* 不该给的四种，一个都不给（给了就是"点了只回去一半"的坑） */
  assert.equal(workRemixLaunchOf({ ...workable, _expired: true }), null, '过期墓碑不给（面板值早清空了）');
  assert.equal(workRemixLaunchOf({ ...workable, replay: { mediaSkillId: 'image.other', panelValues: { a: 1 } } }), null, '不是这条技能的面板值不给');
  assert.equal(workRemixLaunchOf({ ...workable, replay: null }), null, '没存过面板值不给');
  assert.equal(workRemixLaunchOf({ ...workable, mediaSkillId: 'video.smart' }), null, '视频侧暂不给（素材还原还没做，见 docs/design/86）');
  /* 落点：页面只发一个 launch，别各写一套还原 */
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.match(canvas, /const remixWorkInWorkbench = work => \{[\s\S]{0,220}SET_CREATION_LAUNCH[\s\S]{0,120}NAVIGATE', page: 'image-creation'/,
    '画布工作区只负责发 launch + 跳转');
  const page = read('src/pages/MediaCreation/index.jsx');
  assert.match(page, /if \(launch\.kind === 'work-remix'\) \{[\s\S]{0,600}openSkill\(target\.id, seed\)/,
    '落地在子页面这一处（与首页「做同款」同一段代码）');
  assert.match(page, /生成结果是新的一条记录，不会覆盖原来那条/, '提示语要说清"不覆盖"（用户原话）');
});
