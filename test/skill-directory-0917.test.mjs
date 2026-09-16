import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';
import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import {
  BOARD_PATH,
  availabilityLabel,
  boardOfPage,
  coverOf,
  featuredSkills,
  hasCover,
  hubPath,
  skillPath,
} from '../src/skills/skillDirectory.js';

/* ═══ Skill 目录契约（2026-09-17）═══════════════════════════════════════════════
   守三件事：
     ① **两个板块是两个总页面**（用户明确要求：别把视频和图片塞进同一个总页面）。
        竞品实测也是这样：图片制作 /image-creation、视频制作 /apps。
     ② 首页热门技能条、Hub 网格、工作台返回、深链分享**用的是同一份路径与封面算法**
        （分散写迟早漂移成"首页点得进去、Hub 点不进去"）。
     ③ 封面取法唯一：视频卡优先用视频（真实在播），cover 当 poster。 */

test('① 图片与视频是两个总页面，不是同一个页面', () => {
  assert.notEqual(BOARD_PATH.image, BOARD_PATH.video, '两个板块必须落在两个地址上');
  assert.equal(boardOfPage('image-creation'), 'image');
  assert.equal(boardOfPage('video-creation'), 'video');
  assert.equal(hubPath('image'), '/image-creation');
  assert.equal(hubPath('video'), '/video-creation');
  /* 未知 page 一律回落到图片侧，不许抛错（深链被改坏时仍要能开） */
  assert.equal(boardOfPage('nope'), 'image');
});

test('② 每个 skill 都能生成指向自己总页面的深链', () => {
  for (const skill of [...IMAGE_SKILLS, ...VIDEO_SKILLS]) {
    const link = skillPath(skill);
    const expectedHub = skill.board === 'video' ? '/video-creation' : '/image-creation';
    assert.ok(link.startsWith(expectedHub + '?id='), '深链必须落在自己的总页面：' + link);
    assert.ok(link.endsWith(encodeURIComponent(skill.id)));
  }
  /* 缺 id 不许拼出 'undefined' 这种地址 */
  assert.equal(skillPath({ board: 'video' }), '/video-creation');
});

test('③ 封面取法唯一：视频优先，cover 兜底当 poster', () => {
  assert.deepEqual(coverOf({ cases: [] }), { cover: '', video: '', poster: '' });
  assert.deepEqual(
    coverOf({ cases: [{ cover: '/a.png', video: '/a.mp4' }] }),
    { cover: '/a.png', video: '/a.mp4', poster: '/a.png' },
  );
  /* 只给视频没给封面时，poster 不许是 undefined（否则卡片可能是一块黑） */
  assert.deepEqual(coverOf({ cases: [{ video: '/b.mp4' }] }), { cover: '', video: '/b.mp4', poster: '' });
  assert.equal(hasCover({ cases: [{ video: '/b.mp4' }] }), true);
  assert.equal(hasCover({ cases: [] }), false);
});

test('④ 精选推荐按板块给，且精品推荐优先（旧的"没封面就不进条"已改口径）', () => {
  /* 2026-09-17 用户口径：「总页面会有一个精选推荐，跟竞品是一样的；这些精品推荐其实就是
     首页的那些按钮，作为它们的入口。」所以取数规则变成两条硬约束：
       ① **按板块过滤** —— 视频板块下面只能是视频技能（旧实现混着放，实测视频模式下
          首页出现的是四张图片技能卡）；
       ② **不按封面过滤** —— 视频技能现在一条案例都没有，若继续按封面过滤，
          视频板块下面会一条入口都没有。没有案例时按钮照样在，悬停如实写"案例补充中"。 */
  const video = featuredSkills({ board: 'video', limit: 6 });
  assert.ok(video.length > 0, '视频板块必须有入口（哪怕还没有案例）');
  for (const skill of video) assert.equal(skill.board, 'video', '视频板块里混进了图片技能：' + skill.id);
  const image = featuredSkills({ board: 'image', limit: 6 });
  for (const skill of image) assert.equal(skill.board, 'image', '图片板块里混进了视频技能：' + skill.id);
  /* 精品推荐必须排在前面（竞品首页那一排就是这个取法） */
  for (const list of [video, image]) {
    const firstNonPreferred = list.findIndex(skill => skill.category !== '精品推荐');
    if (firstNonPreferred >= 0) {
      assert.equal(list.slice(firstNonPreferred).some(skill => skill.category === '精品推荐'), false, '精品推荐必须排在前面');
    }
  }
  assert.ok(featuredSkills({ board: 'video', limit: 2 }).length <= 2, 'limit 必须生效');
  /* 不传板块时给全量（总页面的"全部"视图用），且仍然是精品推荐优先 */
  assert.ok(featuredSkills({ limit: 60 }).length > image.length, '不传板块要给全量');
});

test('⑤ 首页入口与媒体页用的是同一份路径算法（不许各写一份）', () => {
  const home = readFileSync('src/pages/Home/index.jsx', 'utf8');
  const page = readFileSync('src/pages/MediaCreation/index.jsx', 'utf8');
  const strip = readFileSync('src/components/media/SkillEntryRow.jsx', 'utf8');
  assert.match(home, /from '\.\.\/\.\.\/skills\/skillDirectory\.js'/, '首页必须用 skillDirectory 的路径');
  assert.match(home, /skillPath\(skill\)/, '首页入口点击必须走 skillPath');
  assert.match(page, /boardOfPage\(state\.page\)/, '媒体页的板块必须由目录函数判定');
  assert.match(strip, /from '\.\.\/\.\.\/skills\/skillDirectory\.js'/);
  /* 两处都不许再自己拼 '/image-creation?id=' 这种字面量 */
  assert.doesNotMatch(home, /'\/image-creation\?id='/);
  assert.doesNotMatch(strip, /'\/image-creation\?id='/);
});

/* 2026-09-17：首页那块从"卡片网格"改成了"按钮行 + 悬停预览"（用户口径），
   所以网格的共用方只剩两个 Hub（都走 MediaHub）；按钮行是**另一种呈现**、不共用网格，
   但共用同一份数据与同一份封面取法（由 test/skill-entry-row-0918 守着）。
   判据因此从"必须有两个使用者"改成"**用它的地方必须引同一份样式，且不许再自写一套**"——
   写死使用者数量会在每次改版式时变成绊脚石，而它真正要守的是"只有一份实现"。 */
test('⑥ 卡片网格只有一份实现：用到共用网格的文件必须引共用样式', () => {
  const css = readFileSync('src/components/media/GalleryGrid.css', 'utf8');
  assert.match(css, /\.media-gallery-grid \{/);
  const sourceFiles = [];
  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.jsx?$/.test(entry.name)) sourceFiles.push(full.replace(/\\/g, '/'));
    }
  };
  walk('src');
  const users = sourceFiles.filter(file => readFileSync(file, 'utf8').includes('media-gallery-grid'));
  assert.ok(users.length >= 1, '至少有 Hub 在用共用网格');
  for (const file of users) {
    assert.match(readFileSync(file, 'utf8'), /GalleryGrid\.css/, file + ' 必须引共用网格样式');
  }
  assert.ok(users.some(file => file.endsWith('MediaHub.jsx')), '两个 Hub 都走 MediaHub，它必须在用共用网格');
  /* 旧的私有网格类不许复活（复活就意味着又有一份独立实现） */
  assert.doesNotMatch(readFileSync('src/pages/Home/MediaHub.jsx', 'utf8'), /media-hub-grid/);
});
