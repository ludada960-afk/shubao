/* 契约（2026-09-17 架构收敛后）：四个创作域的每一项都直达**它自己的技能子页面**。
   用户 9-10 的原话是「点视频生成跳去打不开的独立视频创作页」——那次的问题不是"跳走"，
   而是**跳去一个打不开的页面**。9-17 用户拍板的新形态把这条说清楚了：
     · 一级入口只有两个总页面（图片 / 视频），它们必须能打开；
     · 每个具体能力都是那条技能的子页面，点进去就在那一页跑完；
     · 所以"不许离开首页"这条旧约束已经不成立 —— 成立的是"**去的地方必须存在**"：
       路径统一由 skills/skillDirectory.js 生成，且指向的技能必须在声明源里。
   本文件因此从"不许跳走"改成"必须跳对"（比原来更严：多了一条技能存在性校验）。 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CREATIVE_NAV_GROUPS, getNavigationTarget } from '../src/components/layout/creativeDomainNavigation.js';
import { skillPath } from '../src/skills/skillDirectory.js';
import { getImageSkill } from '../src/skills/imageSkills.js';
import { getVideoSkill } from '../src/skills/videoSkills.js';

const component = readFileSync(new URL('../src/components/layout/CreativeDomainNav.jsx', import.meta.url), 'utf8');

test('每个创作域都指向两个总页面之一（不再指向首页内联模块）', () => {
  for (const group of CREATIVE_NAV_GROUPS) {
    assert.equal(group.primaryAction?.type, 'NAVIGATE', group.id + ' 的领域入口应当是打开 Hub');
    assert.ok(['image-creation', 'video-creation'].includes(group.primaryAction?.page), group.id + ' 的 Hub 不在两个总页面里');
    for (const item of group.items) {
      const target = getNavigationTarget(group.id, item.id);
      assert.equal(target.type, 'OPEN_SKILL', group.id + '/' + item.id + ' 应当打开技能子页面');
      assert.notEqual(target.page, 'home', group.id + '/' + item.id + ' 不许再回首页内联模块');
    }
  }
});

test('每一条技能子页面地址都指向真实存在的技能', () => {
  for (const group of CREATIVE_NAV_GROUPS) {
    for (const item of group.items) {
      const target = getNavigationTarget(group.id, item.id);
      const skill = target.board === 'video' ? getVideoSkill(target.skillId) : getImageSkill(target.skillId);
      assert.ok(skill, group.id + '/' + item.id + ' 指向不存在的技能：' + target.skillId);
      /* 路径必须由 skillDirectory 生成（三处共用一份），且能对上技能 id */
      const path = skillPath({ id: target.skillId, board: target.board });
      assert.equal(path, '/' + target.page + '?id=' + encodeURIComponent(target.skillId));
    }
  }
});

test('导航不许自己拼地址：路径只在 skillDirectory 里实现一次', () => {
  assert.match(component, /import \{ skillPath \} from '\.\.\/\.\.\/skills\/skillDirectory\.js'/);
  assert.match(component, /skillPath\(\{ id: action\.skillId, board: action\.board \}\)/);
  assert.doesNotMatch(component, /'\/(image|video)-creation\?id='/);
});

test('视频域还是一个入口，不再立第二套页面', () => {
  const video = CREATIVE_NAV_GROUPS.find(group => group.id === 'video');
  assert.equal(video.items.length, 1);
  assert.equal(video.items[0].skillId, 'video.smart');
  assert.equal(video.primaryAction.page, 'video-creation');
});
