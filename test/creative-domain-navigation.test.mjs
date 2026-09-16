import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CREATIVE_NAV_GROUPS,
  getNavigationItem,
  getNavigationTarget,
  isNavigationGroupActive,
  navigationGroupForSkill,
} from '../src/components/layout/creativeDomainNavigation.js';
import { getImageSkill } from '../src/skills/imageSkills.js';
import { getVideoSkill } from '../src/skills/videoSkills.js';

/* ═══ 左侧一级导航的契约（2026-09-17 架构收敛后）═════════════════════════════════
   用户拍板：一级入口只有两个总页面（/image-creation、/video-creation），
   具体能力都是**那条技能的子页面**（?id=<skillId>）。
   所以导航每一项的去处只有一种正确答案：它自己的技能子页面。
   ⚠️ 这一条以前断言的是 "SET_MODE 切首页内联模块" —— 那是被用户否掉的旧形态，
      改的是**口径**，不是放水：新断言比旧断言更严（每一项还必须指向真实存在的技能）。 */

test('navigation exposes the four confirmed creation domains in product order', () => {
  assert.deepEqual(CREATIVE_NAV_GROUPS.map(group => group.id), [
    'commerce', 'video', 'content', 'visual',
  ]);
  assert.deepEqual(CREATIVE_NAV_GROUPS.map(group => group.label), [
    '电商生图', '视频生成', '小红书图文', '自由创作',
  ]);
});

test('video remains a single undivided creation entry', () => {
  const video = CREATIVE_NAV_GROUPS.find(group => group.id === 'video');
  assert.equal(video.items.length, 1);
  assert.equal(video.items[0].id, 'video-studio');
  assert.equal(video.items.some(item => item.id.includes('frame') || item.id.includes('reconstruction')), false);
});

test('free visual navigation names the supported visual skills', () => {
  const visual = CREATIVE_NAV_GROUPS.find(group => group.id === 'visual');
  assert.deepEqual(visual.items.map(item => item.id), [
    'visual-free', 'visual-poster', 'visual-social-cover', 'visual-brand-kv',
  ]);
});

test('每一个导航项都直达它自己的技能子页面，且指向的技能真实存在', () => {
  const seen = new Set();
  for (const group of CREATIVE_NAV_GROUPS) {
    for (const item of group.items) {
      const target = getNavigationTarget(group.id, item.id);
      assert.equal(target.type, 'OPEN_SKILL', group.id + '/' + item.id + ' 必须打开技能子页面');
      assert.match(target.skillId, /^(image|video)\./, group.id + '/' + item.id + ' 的 skillId 形状不对');
      assert.equal(target.page, target.board === 'video' ? 'video-creation' : 'image-creation');
      /* 指向的技能必须真的在声明源里 —— 否则点进去是"没有找到这个技能" */
      const skill = target.board === 'video' ? getVideoSkill(target.skillId) : getImageSkill(target.skillId);
      assert.ok(skill, group.id + '/' + item.id + ' 指向了不存在的技能：' + target.skillId);
      assert.equal(skill.board, target.board, target.skillId + ' 的板块要与导航一致');
      seen.add(target.skillId);
    }
  }
  assert.ok(seen.size >= 8, '至少覆盖 8 条技能，实际 ' + seen.size);
});

test('领域名（而不是某个具体能力）进的是这个领域的 Hub', () => {
  assert.deepEqual(getNavigationTarget('commerce'), { type: 'NAVIGATE', page: 'image-creation' });
  assert.deepEqual(getNavigationTarget('content'), { type: 'NAVIGATE', page: 'image-creation' });
  assert.deepEqual(getNavigationTarget('visual'), { type: 'NAVIGATE', page: 'image-creation' });
  assert.deepEqual(getNavigationTarget('video'), { type: 'NAVIGATE', page: 'video-creation' });
});

test('导航不再携带旧的首页内联启动参数（launch 已经没人消费）', () => {
  for (const group of CREATIVE_NAV_GROUPS) {
    for (const item of group.items) {
      assert.equal(item.launch, undefined, group.id + '/' + item.id + ' 不该再有 launch（去子页面就够了）');
      assert.equal(item.action, undefined, group.id + '/' + item.id + ' 的去处由 skillId 决定，不再手写 action');
    }
  }
  /* Plog 与种草共用同一个图文工作台 → 同一条技能（进去在工作台里切发布形态） */
  assert.equal(getNavigationItem('content', 'content-plog').skillId, getNavigationItem('content', 'content-xhs').skillId);
});

test('点亮规则：人在哪条技能的子页面上，就点亮它所属的领域', () => {
  /* ① 子页面（地址栏带 ?id=）优先 */
  assert.equal(isNavigationGroupActive('commerce', {}, 'image.product_suite'), true);
  assert.equal(isNavigationGroupActive('visual', {}, 'image.poster'), true);
  assert.equal(isNavigationGroupActive('content', {}, 'image.xhs_note'), true);
  assert.equal(isNavigationGroupActive('video', {}, 'video.smart'), true);
  assert.equal(isNavigationGroupActive('visual', {}, 'image.product_suite'), false, '商品套图不该点亮自由创作');
  /* ② 站在 Hub 上（没有具体技能）：四个领域都不点亮 —— Hub 不属于任何单一领域 */
  for (const groupId of ['commerce', 'video', 'content', 'visual']) {
    assert.equal(isNavigationGroupActive(groupId, { page: 'image-creation' }, ''), false);
    assert.equal(isNavigationGroupActive(groupId, { page: 'video-creation' }, ''), false);
  }
  /* ③ 旧入口（首页内联模块 / 独立视频页 / 画布）仍然按页面与模式点亮，行为不变 */
  assert.equal(isNavigationGroupActive('video', { page: 'video-studio', mode: 'ecommerce' }, ''), true);
  assert.equal(isNavigationGroupActive('content', { page: 'home', mode: 'content' }, ''), true);
  assert.equal(isNavigationGroupActive('visual', { page: 'home', mode: 'visual' }, ''), true);
  assert.equal(isNavigationGroupActive('commerce', { page: 'home', mode: 'ecommerce' }, ''), true);
  assert.equal(isNavigationGroupActive('workspace', { page: 'ec-canvas' }, ''), true);
});

test('技能 → 领域 的对照表不许指向不存在的技能（改名/下线时必须同步）', () => {
  for (const skillId of ['image.product_suite', 'image.try_on', 'video.smart', 'image.xhs_note',
    'image.free', 'image.poster', 'image.social_cover', 'image.brand_kv']) {
    assert.ok(navigationGroupForSkill(skillId), skillId + ' 没有归属领域');
  }
  assert.equal(navigationGroupForSkill('image.white_bg'), '', '没在表里的技能返回空串（不猜）');
  assert.equal(navigationGroupForSkill(''), '');
});
