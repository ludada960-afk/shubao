/* ═══ 门禁：分类顺序只有一份实现，且「精品推荐」必须在最前（2026-09-25 批 BQ）══════════════
   用户原话：「**精品推荐应该在前面呀**，你现在怎么是创意应用在最前面呀？」

   ── 根因（真发生过）────────────────────────────────────────────────────────
   声明文件里**第一条技能是「创意应用」**（image.poster），所以"按声明顺序出分类"
   就会把创意应用排到精品推荐前面。总页面（MediaHub）早就把精品推荐提到最前了 ——
   它里面那段批注（「你的精品推荐为什么在下面呢？它不是应该在最上面吗？」）就是用户为这件事写的；
   但**首页那排分类页签自己另写了一遍"按声明顺序"**，于是两处不一致，用户看到的是反的。
   ⇒ 判据收进 `skillDirectory.categoryOrderOf`，两处共用。

   ── 这一组断言守什么 ────────────────────────────────────────────────────
     ① 两个调用点都**必须**调那个共享函数（不许谁再自己写一份顺序）；
     ② 首页那处**不许**再出现旧的"按声明顺序出分类"的写法（Map 插入序）；
     ③ 函数行为：精品推荐第一、辅助能力不参与、本来就在最前时不动序；
     ④ 自证：把精品推荐从声明里拿掉时必须**不报错也不乱序**（防"永远为真"的空断言）；
     ⑤ 真数据自证：图片板块的分类顺序里，精品推荐确实排在创意应用之前
        （这正是用户报的那条，用真声明源验一遍）。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { categoryOrderOf, FEATURED_CATEGORY } from '../src/skills/skillDirectory.js';
import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';
import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('① 首页与总页面都用同一份 categoryOrderOf（不许各写一份顺序）', () => {
  const home = read('src/pages/Home/index.jsx');
  const hub = read('src/pages/Home/MediaHub.jsx');
  assert.match(home, /import \{[^}]*categoryOrderOf[^}]*\} from '\.\.\/\.\.\/skills\/skillDirectory\.js'/,
    '首页没有引用共享的分类顺序实现');
  assert.match(home, /categoryOrderOf\(boardSkills\)/, '首页没有真的用它算页签顺序');
  assert.match(hub, /import \{[^}]*categoryOrderOf[^}]*\} from '\.\.\/\.\.\/skills\/skillDirectory\.js'/,
    '总页面没有引用共享的分类顺序实现');
  assert.match(hub, /categoryOrderOf\(config\.skills\)/, '总页面没有真的用它算分组顺序');
});

test('② 两处都不许再出现旧的"按声明顺序出分类"写法', () => {
  const home = read('src/pages/Home/index.jsx');
  const hub = read('src/pages/Home/MediaHub.jsx');
  /* 旧写法长这样：用 Map 的插入序当顺序。 */
  assert.doesNotMatch(home, /map\.set\(skill\.category, \(map\.get\(skill\.category\) \|\| 0\) \+ 1\)/,
    '首页又回到用 Map 插入序（= 声明顺序）当页签顺序了');
  assert.doesNotMatch(hub, /const FEATURED = '精品推荐';/,
    '总页面又自己写了一份"精品推荐提到最前"的判据');
});

test('③ 函数行为：精品推荐第一 / 辅助能力不参与 / 已在最前时不动序', () => {
  const fake = [
    { category: '创意应用' }, { category: '精品推荐' }, { category: '电商专区' },
    { category: '辅助能力', tier: 'assistant' },
  ];
  assert.deepEqual(categoryOrderOf(fake), ['精品推荐', '创意应用', '电商专区'],
    '精品推荐没有被提到最前，或辅助能力混进了分类');
  /* 本来就在最前：顺序一个字不该动 */
  const already = [{ category: '精品推荐' }, { category: '创意应用' }];
  assert.deepEqual(categoryOrderOf(already), ['精品推荐', '创意应用']);
  /* 没有精品位（视频板块可能没有）：顺序照旧，且不许抛错 */
  assert.deepEqual(categoryOrderOf([{ category: 'A' }, { category: 'B' }]), ['A', 'B']);
  assert.deepEqual(categoryOrderOf([]), []);
});

test('④ 自证：声明里没有精品推荐时不许报错也不许乱序（防"永远为真"的空断言）', () => {
  const noFeatured = [{ category: '创意应用' }, { category: '电商专区' }];
  assert.deepEqual(categoryOrderOf(noFeatured), ['创意应用', '电商专区']);
  assert.equal(categoryOrderOf(noFeatured).includes(FEATURED_CATEGORY), false);
});

test('⑤ 真数据自证：两个板块的分类顺序里，精品推荐都排在创意应用之前', () => {
  for (const [board, skills] of [['image', IMAGE_SKILLS], ['video', VIDEO_SKILLS]]) {
    const order = categoryOrderOf(skills);
    if (!order.includes(FEATURED_CATEGORY)) continue;   /* 该板块没有精品位就不适用 */
    assert.equal(order[0], FEATURED_CATEGORY, board + ' 板块的第一档分类不是精品推荐：' + order.join(' / '));
  }
  /* 用户是在图片板块看到这条的，所以这里必须**逐字**验一次图片板块 */
  const imageOrder = categoryOrderOf(IMAGE_SKILLS);
  assert.ok(imageOrder.indexOf(FEATURED_CATEGORY) < imageOrder.indexOf('创意应用'),
    '图片板块里创意应用又跑到精品推荐前面了：' + imageOrder.join(' / '));
  /* 顺带说明为什么需要这个函数：声明源里第一条**不是**精品推荐（否则这函数就白写了） */
  assert.notEqual(IMAGE_SKILLS[0].category, FEATURED_CATEGORY,
    '声明源第一条已经是精品推荐了 —— 那说明前提变了，这条断言的用途要重新说明');
});
