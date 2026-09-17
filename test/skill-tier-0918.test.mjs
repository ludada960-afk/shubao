import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { IMAGE_SKILLS, getImageSkill } from '../src/skills/imageSkills.js';
import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import { featuredSkills } from '../src/skills/skillDirectory.js';

/* ═══ 技能分层：主技能 vs 辅助能力（2026-09-17 用户口径）══════════════════════════
   用户原话：「有些功能我觉得不一定是真正给用户单独用的，你要知道，有些 skill 其实是**辅助作用**的，
   真正能解决用户实际需求的 skill 才是我们要做成子页面工作台给他们直接使用的，
   有些辅助类的 skill 其实是**融合在一些主 skill 里面**的呀，你自己要先深度思考他们的作用呀。」

   判据（写下来，免得下次又靠感觉）：
     · 主技能（tier 为空 / 'primary'）：用户带着一个「活儿」进来，能独立交付一个完整结果
       → 给它独立的子页面工作台，进首页精选与 Hub 主档；
     · 辅助能力（tier === 'assistant'）：它的输入往往是**已有成片/已有图**，
       或者它只是主技能里的**一种运行方式 / 一个控制项**（批量、相似图、提质感、延长、改画面、运镜）
       → 不占入口，融进主技能，必要时可直达（放在 Hub 的「辅助能力」组里并说明用途）。

   这一条守：辅助能力必须写明归属主技能、不许进精选推荐、也不许出现在 Hub 的正常分类里。 */

const ALL = [...IMAGE_SKILLS, ...VIDEO_SKILLS];
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('① 辅助能力必须写明归属哪个主技能，且归属必须真实存在', () => {
  const assistants = ALL.filter(skill => skill.tier === 'assistant');
  assert.ok(assistants.length >= 5, '辅助能力至少 5 条（批量/相似图/提质感/延长/改画面/运镜），实际 ' + assistants.length);
  for (const skill of assistants) {
    const owner = ALL.find(item => item.id === skill.belongsTo);
    assert.ok(owner, skill.id + ' 的 belongsTo 指向了不存在的技能：' + skill.belongsTo);
    assert.notEqual(owner.tier, 'assistant', skill.id + ' 不能挂在另一条辅助能力下面（辅助要挂在主技能上）');
  }
});

test('② 辅助能力不许进精选推荐（首页那一排只放能独立干完活儿的）', () => {
  for (const board of ['image', 'video']) {
    const list = featuredSkills({ board, limit: 99 });
    const leaked = list.filter(skill => skill.tier === 'assistant').map(skill => skill.id);
    assert.deepEqual(leaked, [], board + ' 板块的精选里混进了辅助能力：' + leaked.join(', '));
  }
  const home = featuredSkills({ limit: 99 });
  assert.equal(home.some(skill => skill.tier === 'assistant'), false, '全量精选里也不许有辅助能力');
});

test('③ Hub 把辅助能力单独成组并说明用途（不许混进正常分类）', () => {
  const hub = read('src/pages/Home/MediaHub.jsx');
  assert.match(hub, /skill\.tier === 'assistant'/);
  assert.match(hub, /category: '辅助能力'/);
  assert.match(hub, /不是独立入口/);
  assert.match(hub, /assistantGroup/);
});

test('④ 自证：每条辅助能力都能说清「它属于哪一步」', () => {
  /* 判据不靠感觉：辅助能力的输入要么是已有成片/已有图，要么是一种运行方式/控制项。
     这里用一句话自证：它的 summary 或 brief 里必须能看出「加工/批量/再生成/控制」的语义。 */
  const KEYWORDS = ['沿用', '再来', '再生成', '批量', '延长', '改', '修', '提升', '指定', '参考图', '已有'];
  for (const skill of ALL.filter(item => item.tier === 'assistant')) {
    const text = String(skill.summary || '') + String(skill.brief || '');
    assert.ok(KEYWORDS.some(word => text.includes(word)), skill.id + ' 看不出它是辅助能力（summary/brief 里没有加工或运行方式的语义）');
  }
});

test('⑤ 装饰：图片技能里「成品类」的仍然是主技能（不许把能独立交付的降级）', () => {
  for (const id of ['image.white_bg', 'image.remove_bg', 'image.multi_angle', 'image.try_on', 'image.callout_diagram']) {
    assert.notEqual(getImageSkill(id).tier, 'assistant', id + ' 能独立交付成品，不该被降级为辅助');
  }
  const videoPrimary = VIDEO_SKILLS.filter(skill => skill.tier !== 'assistant').map(skill => skill.id);
  for (const id of ['video.smart', 'video.frame', 'video.product_placement', 'video.content_swap']) {
    assert.ok(videoPrimary.includes(id), id + ' 是主技能，不该被降级');
  }
});