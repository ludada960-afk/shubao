import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';
import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import {
  BOARD_PATH,
  boardOfPage,
  coverOf,
  hasCover,
  hotSkills,
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

test('④ 首页热门条只放有封面的 skill，且精品推荐优先', () => {
  const hot = hotSkills({ limit: 6 });
  assert.ok(hot.length > 0, '至少有已备封面的 skill');
  for (const skill of hot) assert.ok(hasCover(skill), '热门条里不许出现没有封面的空卡：' + skill.id);
  const firstNonPreferred = hot.findIndex(skill => skill.category !== '精品推荐');
  if (firstNonPreferred >= 0) {
    assert.equal(hot.slice(firstNonPreferred).some(skill => skill.category === '精品推荐'), false, '精品推荐必须排在前面');
  }
  assert.ok(hotSkills({ limit: 2 }).length <= 2, 'limit 必须生效');
});

test('⑤ 首页热门条与媒体页用的是同一份路径算法（不许各写一份）', () => {
  const home = readFileSync('src/pages/Home/index.jsx', 'utf8');
  const page = readFileSync('src/pages/MediaCreation/index.jsx', 'utf8');
  const strip = readFileSync('src/components/media/HotSkillStrip.jsx', 'utf8');
  assert.match(home, /from '\.\.\/\.\.\/skills\/skillDirectory\.js'/, '首页必须用 skillDirectory 的路径');
  assert.match(home, /skillPath\(skill\)/, '首页热门条点击必须走 skillPath');
  assert.match(page, /boardOfPage\(state\.page\)/, '媒体页的板块必须由目录函数判定');
  assert.match(strip, /from '\.\.\/\.\.\/skills\/skillDirectory\.js'/);
  /* 两处都不许再自己拼 '/image-creation?id=' 这种字面量 */
  assert.doesNotMatch(home, /'\/image-creation\?id='/);
  assert.doesNotMatch(strip, /'\/image-creation\?id='/);
});

test('⑥ 卡片网格只有一份实现（首页热门条 / 图片 Hub / 视频 Hub 共用）', () => {
  const css = readFileSync('src/components/media/GalleryGrid.css', 'utf8');
  assert.match(css, /\.media-gallery-grid \{/);
  for (const file of ['src/pages/Home/MediaHub.jsx', 'src/components/media/HotSkillStrip.jsx']) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /media-gallery-grid/, file + ' 必须用共用网格');
    assert.match(source, /GalleryGrid\.css/, file + ' 必须引共用网格样式');
  }
  /* 旧的私有网格类不许复活（复活就意味着又有一份独立实现） */
  assert.doesNotMatch(readFileSync('src/pages/Home/MediaHub.jsx', 'utf8'), /media-hub-grid/);
});
