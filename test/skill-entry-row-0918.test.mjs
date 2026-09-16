import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { stripComments } from '../scripts/lib/token-scope.mjs';
import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';
import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import { availabilityLabel, featuredSkills } from '../src/skills/skillDirectory.js';

/* ═══ 首页「精选推荐」按钮行（2026-09-17 用户口径）═════════════════════════════════
   用户原话：「把它们做成案例给做进去，就是**按钮**的形式，然后鼠标放到这些按钮上，
   它就会有那种**预览框**，然后用户点击这些按钮就会直接进入到他们对应的 Skill 页面里面去。」
   「图片生成是图片生成，视频生成是视频生成……即便入口不一样，UI 设计、风格设计、视觉方案、
    整体交互，必须是同一套体系。」

   这一条守四件事（每一件以前都真的错过）：
     ① 按板块过滤 —— 旧实现把图片与视频混在一条里，视频模式下首页出现的是四张**图片**技能卡；
     ② 悬停有预览框，没有案例时**如实写"案例补充中"**（不是一块空白、也不是干脆不出现）；
     ③ 点击走 skillPath（与 Hub、总页面共用一份路径算法）；
     ④ 图片与视频**共用同一个组件**，不许各写一套按钮行。 */

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const row = read('src/components/media/SkillEntryRow.jsx');
const home = read('src/pages/Home/index.jsx');
const hub = read('src/pages/Home/MediaHub.jsx');

test('① 按钮行只显示当前板块的技能（视频模式下不许出现图片技能）', () => {
  const video = featuredSkills({ board: 'video', limit: 6 });
  const image = featuredSkills({ board: 'image', limit: 6 });
  assert.ok(video.every(skill => skill.board === 'video'), '视频板块只能有视频技能');
  assert.ok(image.every(skill => skill.board === 'image'), '图片板块只能有图片技能');
  assert.equal(video.length + image.length, 12, '两个板块各 6 条精选');
  /* 首页必须按当前模式算出板块再传下去 —— 这一条是防"又把两个板块混起来" */
  const stripped = stripComments(home);
  assert.match(stripped, /const skillBoard = isVideo \? 'video' : 'image';/);
  assert.match(stripped, /board=\{skillBoard\}/);
  assert.match(stripped, /skills=\{featuredSkills\(\{ board: skillBoard, limit: SKILL_ENTRY_LIMIT \}\)\}/);
});

test('② 有悬停预览框；没有案例时如实写"案例补充中"，不留一块空白', () => {
  assert.match(row, /className="skill-entry-preview"/);
  assert.match(row, /onMouseEnter=\{\(\) => setActiveId\(skill\.id\)\}/);
  assert.match(row, /onMouseLeave=\{\(\) => setActiveId/);
  /* 媒体三种情形都要有明确下落：视频 → <video>、图 → <img>、都没有 → 一句实话 */
  assert.match(row, /preview\.video[\s\S]{0,200}<video/);
  assert.match(row, /preview\.cover[\s\S]{0,200}<img/);
  assert.match(row, /案例补充中/);
  /* 预览媒体按 coverOf 取（封面取法只有一份实现） */
  assert.match(row, /import \{ availabilityLabel, coverOf \} from '\.\.\/\.\.\/skills\/skillDirectory\.js'/);
});

test('③ 点击进子页面，且键盘用户同样能用（按钮原生可达、Escape 能收起预览）', () => {
  assert.match(row, /onClick=\{\(\) => onOpenSkill\?\.\(skill\)\}/);
  assert.match(row, /onFocus=\{\(\) => setActiveId\(skill\.id\)\}/, '键盘聚焦也要出预览（不然键盘用户看不到案例）');
  assert.match(row, /event\.key === 'Escape'/, 'Escape 要能收起预览');
  assert.match(row, /aria-expanded=\{open\}/);
  /* 首页点击必须走 skillPath（与 Hub / 总页面同一份算法） */
  assert.match(stripComments(home), /window\.history\.pushState\(\{\}, '', skillPath\(skill\)\)/);
});

test('④ 图片与视频共用同一套按钮行（不许各写一份），旧的卡片条已删除', () => {
  assert.ok(!existsSync(new URL('../src/components/media/HotSkillStrip.jsx', import.meta.url)), '旧的卡片条必须删掉，避免两份实现');
  assert.doesNotMatch(home, /HotSkillStrip|hot-skill-strip/);
  /* 两个板块共用：组件不按 board 分支渲染两套 DOM，只换数据与文案 */
  assert.match(row, /data-board=\{board\}/);
  assert.equal((row.match(/<button/g) || []).length, 1, '按钮行只有一处按钮实现（一个 map 渲染全部）');
  /* 可用性角标也只有一份实现（Hub 卡片与首页按钮共用同一句话） */
  assert.match(hub, /badge=\{availabilityLabel\(skill\)\}/);
  assert.equal(availabilityLabel({ availability: 'blocked' }), '即将上线');
  assert.equal(availabilityLabel({ availability: 'needs_ref' }), '需参考素材');
  assert.equal(availabilityLabel({ availability: 'ready' }), '');
});

test('⑤ 精选推荐的取数只在声明源里做一次（两个板块都能给满 6 条，且都是能跑的）', () => {
  const video = featuredSkills({ board: 'video', limit: 6 });
  const image = featuredSkills({ board: 'image', limit: 6 });
  assert.equal(video.length, Math.min(6, VIDEO_SKILLS.length));
  assert.equal(image.length, Math.min(6, IMAGE_SKILLS.length));
  /* blocked 的技能不许进首页按钮行（跑不通的东西不该出现在一级入口上） */
  for (const skill of [...video, ...image]) {
    assert.notEqual(skill.availability, 'blocked', skill.id + ' 还没跑通，不该出现在首页精选里');
  }
});
