import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CREATIVE_NAV_GROUPS,
  getNavigationItem,
  getNavigationTarget,
  isNavigationGroupActive,
  navigationGroupForSkill,
} from '../src/components/layout/creativeDomainNavigation.js';
import { IMAGE_SKILLS, getImageSkill } from '../src/skills/imageSkills.js';
import { VIDEO_SKILLS, getVideoSkill } from '../src/skills/videoSkills.js';

/* ═══ 左侧一级导航的契约（2026-09-19 批 G：域从 4 个收敛成 2 个）═════════════════════
   用户拍板：一级入口只有两个总页面（/image-creation、/video-creation），
   具体能力都是**那条技能的子页面**（?id=<skillId>）。
   所以导航每一项的去处只有一种正确答案：它自己的技能子页面。

   ⚠️⚠️ 本文件有几条断言在 2026-09-19 批 G 被**整条换掉**，依据是用户批注 #7-① 的原话：
     「你现在这个逻辑也不是我说的逻辑呀，我说的逻辑就是电商生图、小红书图文、自由创作
      这些全部都不能有了。这些现在都是跟其他的 skill 是平级的东西。他们都会进入到各自的
      子页面里面去，然后入口就只有首页下面的这个推荐 skill 这里，或者是视频生成和图片生成的
      总页面那里。」
     「你目前来说就先做视频生成和电商生成的这两个总页面的入口就可以。」
   被换掉的是四条：域的清单（4→2）、"视频域只有一条技能"（现在是 6 条精品技能）、
   "自由创作域点名四条技能"（那个域已不存在）、"技能→域的手抄对照表"（改成从 id 前缀推导）。
   这不是放水：新断言仍在守更强的性质（每一项都必须指向**真实存在**的技能；
   域清单一字不差地等于两个总页面；推导规则必须与板块命名一致）。
   继续守旧的 4 域清单 = 逼着下一轮把那三个被撤掉的一级入口加回来。 */

test('一级导航只有两个域，且**就是**那两个总页面（图片生成 / 视频生成）', () => {
  assert.deepEqual(CREATIVE_NAV_GROUPS.map(group => group.id), ['image', 'video']);
  assert.deepEqual(CREATIVE_NAV_GROUPS.map(group => group.label), ['图片生成', '视频生成']);
  /* 用户批注 #7-① 点名撤掉的那三个一级入口，不许再作为域出现 */
  for (const gone of ['commerce', 'content', 'visual']) {
    assert.equal(CREATIVE_NAV_GROUPS.some(group => group.id === gone), false, gone + ' 这个一级域已被用户撤掉');
  }
  /* 两个域各自的主动作 = 打开自己的总页面（这是"域"而不是"某个能力"的定义） */
  assert.deepEqual(CREATIVE_NAV_GROUPS.map(group => group.primaryAction), [
    { type: 'NAVIGATE', page: 'image-creation' },
    { type: 'NAVIGATE', page: 'video-creation' },
  ]);
});

test('两个域各自列出本板块的精品推荐技能（数量一致、都是能跑的）', () => {
  /* ⚠️ 2026-09-19 批 G：这一条原来是「视频域只允许一条技能 video-studio」——
     那是"视频是一个未拆分的整体入口"时代的契约。现在视频域跟图片域一样是**总页面**，
     下拉里列的是本板块的精品推荐技能（用户批注 #2-①：「像这样子排列成 9 个 skill 的
     按钮作为入口」——同一份精选清单在首页按钮行与这里都出现）。
     新契约守三件事：① 两域条数一致（对称，不会一边长一边短）；
     ② 每条都指向自己板块的真实技能（下面那条测试逐条查）；③ 不含旧世界的 video-studio。 */
  const image = CREATIVE_NAV_GROUPS.find(group => group.id === 'image');
  const video = CREATIVE_NAV_GROUPS.find(group => group.id === 'video');
  assert.ok(image.items.length >= 6 && video.items.length >= 6, '每个总页面至少给 6 条精品入口');
  assert.equal(image.items.length, video.items.length, '两个域的入口条数要对齐');
  assert.equal(video.items.some(item => item.id === 'video-studio'), false, 'video-studio 是被否掉的旧入口');
  for (const item of [...image.items, ...video.items]) {
    assert.ok(item.skillId, item.id + ' 必须声明它去哪条技能的子页面');
  }
});

test('图片域把"商品/内容/自由创作"这三类技能**收进同一个总页面**（它们不再是平行一级入口）', () => {
  /* ⚠️ 2026-09-19 批 G：这一条原来叫「自由创作域点名四条技能」，守的是那个已撤掉的 visual 域。
     用户批注 #7-① 说的正是"电商生图 / 小红书图文 / 自由创作不能再有一级入口，
     它们是跟别的 skill 平级的、都进各自的子页面" —— 所以判据反过来了：
     这些能力现在必须**出现在图片域里**（作为技能），而不是各自另立一个域。 */
  const image = CREATIVE_NAV_GROUPS.find(group => group.id === 'image');
  const ids = image.items.map(item => item.id);
  assert.ok(ids.length >= 6, '图片总页面要列满精品入口，实际 ' + ids.length);
  assert.equal(new Set(ids).size, ids.length, '入口 id 不许重复');
  /* 每一条都是 ?id= 子页面，页面上不再有内联模式模块 */
  for (const item of image.items) {
    const target = getNavigationTarget('image', item.id);
    assert.equal(target.type, 'OPEN_SKILL');
    assert.equal(target.page, 'image-creation');
  }
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
  assert.deepEqual(getNavigationTarget('image'), { type: 'NAVIGATE', page: 'image-creation' });
  assert.deepEqual(getNavigationTarget('video'), { type: 'NAVIGATE', page: 'video-creation' });
  /* 被撤掉的三个旧域名**不再解析出任何去处**（返回 null 而不是"猜一个图片 Hub"）——
     猜的话，将来某处还引用着旧域名时会静默跳到一个看起来对、其实不是用户要的页面。 */
  for (const gone of ['commerce', 'content', 'visual']) {
    assert.equal(getNavigationTarget(gone), null, gone + ' 不该再解析出去处');
  }
});

test('导航不再携带旧的首页内联启动参数（launch 已经没人消费）', () => {
  for (const group of CREATIVE_NAV_GROUPS) {
    for (const item of group.items) {
      assert.equal(item.launch, undefined, group.id + '/' + item.id + ' 不该再有 launch（去子页面就够了）');
      assert.equal(item.action, undefined, group.id + '/' + item.id + ' 的去处由 skillId 决定，不再手写 action');
    }
  }
  /* ⚠️ 2026-09-19 批 G：这里原来断言「content-plog 与 content-xhs 指向同一条技能」——
     content 域已被撤掉，那条断言没有宿主了。改守**still 成立**的那条性质：
     同一个域里不允许两条入口指向同一条技能（否则用户会看到两个名字进同一个页面）。 */
  for (const group of CREATIVE_NAV_GROUPS) {
    const skillIds = group.items.map(item => item.skillId);
    assert.equal(new Set(skillIds).size, skillIds.length, group.id + ' 域里有两条入口指向了同一条技能');
  }
});

test('点亮规则：人在哪条技能的子页面上，就点亮它所属的领域', () => {
  /* ① 子页面（地址栏带 ?id=）优先：图片技能点亮图片域，视频技能点亮视频域 */
  assert.equal(isNavigationGroupActive('image', {}, 'image.product_suite'), true);
  assert.equal(isNavigationGroupActive('image', {}, 'image.poster'), true);
  assert.equal(isNavigationGroupActive('image', {}, 'image.xhs_note'), true);
  assert.equal(isNavigationGroupActive('video', {}, 'video.smart'), true);
  assert.equal(isNavigationGroupActive('video', {}, 'image.product_suite'), false, '商品套图不该点亮视频域');
  assert.equal(isNavigationGroupActive('image', {}, 'video.smart'), false, '视频技能不该点亮图片域');
  /* ② 站在 Hub 上（没有具体技能）：两个域都不点亮 —— Hub 不属于任何单一领域 */
  for (const groupId of ['image', 'video']) {
    assert.equal(isNavigationGroupActive(groupId, { page: 'image-creation' }, ''), false);
    assert.equal(isNavigationGroupActive(groupId, { page: 'video-creation' }, ''), false);
  }
  /* ③ 首页上（state.mode 表达"我在做哪一类"）仍然点亮：图片那三类全落到图片域，
        视频落视频域，画布落工作台域 —— 用户看到的仍然"我在哪一类里"。 */
  assert.equal(isNavigationGroupActive('video', { page: 'video-studio', mode: 'ecommerce' }, ''), true);
  assert.equal(isNavigationGroupActive('image', { page: 'home', mode: 'content' }, ''), true);
  assert.equal(isNavigationGroupActive('image', { page: 'home', mode: 'visual' }, ''), true);
  assert.equal(isNavigationGroupActive('image', { page: 'home', mode: 'ecommerce' }, ''), true);
  assert.equal(isNavigationGroupActive('video', { page: 'home', mode: 'video' }, ''), true);
  assert.equal(isNavigationGroupActive('workspace', { page: 'ec-canvas' }, ''), true);
});

test('技能 → 总页面 的归属由 id 前缀推导，且与板块命名一致（不再手抄一张会漂移的表）', () => {
  /* ⚠️ 2026-09-19 批 G：这一条原来守的是那张**手抄的 8 条对照表**；
     表本身有两个毛病（旧域名已不存在 + 技能改名就会漂移），已改成从 id 前缀推导。
     新判据守的是推导规则本身，而且**与声明源逐条对账**： */
  for (const skill of IMAGE_SKILLS) {
    assert.equal(navigationGroupForSkill(skill.id), 'image', skill.id + ' 应归图片总页面');
  }
  for (const skill of VIDEO_SKILLS) {
    assert.equal(navigationGroupForSkill(skill.id), 'video', skill.id + ' 应归视频总页面');
  }
  /* 前缀规则与板块字段必须是同一件事 —— 两边不一致就说明有人改了命名约定没改这里 */
  for (const skill of VIDEO_SKILLS) {
    assert.ok(skill.id.startsWith('video.'), '视频技能的 id 必须以 video. 开头：' + skill.id);
  }
  assert.equal(navigationGroupForSkill(''), '');
  /* 推导出来的域必须真实存在（推错一个不存在的域会让导航永远不点亮） */
  const known = new Set(CREATIVE_NAV_GROUPS.map(group => group.id));
  for (const skill of [...IMAGE_SKILLS, ...VIDEO_SKILLS]) {
    assert.ok(known.has(navigationGroupForSkill(skill.id)), skill.id + ' 推导出的域不在导航里');
  }
});
