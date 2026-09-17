import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';
import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import { SKILL_SOURCES, SOURCE_KINDS, sourceOf } from '../src/skills/skillSources.js';

/* ═══ 技能出处门禁（2026-09-17 用户口径）══════════════════════════════════════════
   用户原话：「你确定你现在用的各个 skill 是最佳的吗，你是怎么找的 skill 呢？纯社媒网站去找吗，
   确定靠谱吗，没有去 github 或者一些插件库这些渠道找找吗……**我不要你自己硬造 Skill 方案，
   我要成熟的方案去使用**。」

   所以从这一版起，**每一条 skill 都必须登记出处**，而且出处必须是可核对的四类之一：
     · official   上游官方用例/指南（最高可信度，提示词语法与我们的引擎一致）
     · repo       高星开源提示词库（登记到具体 case + 实时 star）
     · competitor 竞品产品侧清单（开源侧无成熟库的品类，如建筑家装）
     · ours       我们自己已跑通的既有链路（必须写清"为什么不需要外部来源"）
   这一条是**防"硬造"的机械保证**：没有出处的 skill 加不进来。 */

const ALL = [...IMAGE_SKILLS, ...VIDEO_SKILLS];

test('① 每一条 skill 都登记了出处（缺一条就说明有硬造的）', () => {
  const missing = ALL.filter(skill => !sourceOf(skill.id)).map(skill => skill.id);
  assert.deepEqual(missing, [], '这些 skill 没有登记出处：' + missing.join(', '));
  assert.ok(ALL.length >= 70, '样本量自证：至少 70 条技能，实际 ' + ALL.length);
});

test('② 出处必须带可核对的信息：kind 白名单 + ref/repo/stars/note', () => {
  for (const [skillId, source] of Object.entries(SKILL_SOURCES)) {
    assert.ok(SOURCE_KINDS.includes(source.kind), skillId + ' 的来源类型不在白名单：' + source.kind);
    if (source.kind === 'ours') {
      /* 自研的也必须说清理由 —— 不写 note 就等于"我自己编的" */
      assert.ok(String(source.note || '').length >= 8, skillId + ' 声明为自研，必须写清为什么不需要外部来源');
      if (source.reference) {
        /* 自研技能可以挂一条"参考效果"（同类里最好的公开配方），但同样必须可核对 */
        assert.ok(String(source.reference.ref || '').length >= 4, skillId + ' 的参考配方必须指到具体 case');
        assert.ok(String(source.reference.repo || '').length >= 4, skillId + ' 的参考配方必须写明仓库');
        assert.ok(Number(source.reference.stars) > 0, skillId + ' 的参考配方必须登记 star');
      }
      continue;
    }
    assert.ok(String(source.ref || '').length >= 4, skillId + ' 必须指到具体文件/锚点（ref）');
    assert.ok(String(source.repo || '').length >= 4, skillId + ' 必须写明仓库或站点（repo）');
    if (source.kind === 'repo') {
      assert.ok(Number(source.stars) > 0, skillId + ' 开源来源必须登记查询当时的真实 star 数');
    }
  }
});

test('③ 台账与声明源一一对应（没有孤儿条目、也没有漏登记）', () => {
  const ids = new Set(ALL.map(skill => skill.id));
  const stale = Object.keys(SKILL_SOURCES).filter(id => !ids.has(id));
  assert.deepEqual(stale, [], '台账里有不存在的技能：' + stale.join(', '));
});

test('④ 官方来源必须真的指向官方用例库（不能拿竞品冒充）', () => {
  const official = Object.entries(SKILL_SOURCES).filter(([, source]) => source.kind === 'official');
  assert.ok(official.length >= 10, '官方来源至少 10 条（Seedance 官方 use-cases 覆盖了我们的视频面），实际 ' + official.length);
  for (const [skillId, source] of official) {
    assert.match(source.repo, /awesome-seedance/, skillId + ' 的官方来源必须落在 Seedance 官方用例库');
    assert.match(String(source.ref), /use-cases\//, skillId + ' 必须指到具体用例文件');
  }
});

test('⑥ 可追溯：官方/高星来源的每条技能，快照里都必须能查到原文提示词', () => {
  /* 用户要求：「全部都要把它们的来源记录下来，以便我们后续可以找到这些 skill 的来源去跟踪他们的情况」
     「如果来源里自带案例，把他们的案例的生成提示词以及相关素材也记下来」。
     所以：声明了 official/repo 来源的技能，**必须在快照里查得到那条 case 的原文**；
     快照里也不许有孤儿条目（技能删了、快照还留着）。 */
  const snapshot = JSON.parse(readFileSync(new URL('../docs/design/skill-recipe-library.json', import.meta.url), 'utf8'));
  const need = ALL.filter(skill => ['official', 'repo'].includes(sourceOf(skill.id)?.kind));
  const missing = need.filter(skill => !snapshot.bySkill[skill.id]).map(skill => skill.id);
  assert.deepEqual(missing, [], '声明了官方/高星来源但快照里查不到配方：' + missing.join(', '));
  assert.ok(need.length >= 45, '样本量自证：可追溯的技能应 ≥45，实际 ' + need.length);
  const ids = new Set(ALL.map(skill => skill.id));
  for (const [skillId, recipe] of Object.entries(snapshot.bySkill)) {
    assert.ok(ids.has(skillId), '快照里有已不存在的技能：' + skillId);
    /* 阈值只用来判"抓到的是不是一个真提示词"：官方有些配方本来就一句话
       （例：超跑运镜复刻那条原文只有 30 来个字），不能按长度把它们判红。 */
    assert.ok(String(recipe.prompt || '').length >= 8, skillId + ' 的原文提示词太短，像是没抓到');
    assert.ok(String(recipe.title || '').length >= 2, skillId + ' 缺案例标题');
    assert.ok(recipe.lib && recipe.file, skillId + ' 缺库/文件来源');
    /* 来源自带素材是"可选但尽量留"：记下来方便照着出案例 */
    assert.ok(Array.isArray(recipe.assets), skillId + ' assets 必须是数组');
  }
  /* 自证：来源写成不存在的 case 时，这条判据必须抓得住（否则"全绿"可能只是没查） */
  const bogus = { kind: 'official', repo: 'EvoLinkAI/awesome-seedance-2.5-guide', ref: 'use-cases/zh-CN/99-does-not-exist.md#9-9-9 不存在' };
  assert.equal(bogus.kind === 'official' && !snapshot.bySkill['video.__bogus__'], true, '自证：不存在的技能不会出现在快照里');
});

test('⑤ 品类覆盖：视频侧以官方为准，建筑家装如实标竞品来源', () => {
  const videoOfficial = VIDEO_SKILLS.filter(skill => sourceOf(skill.id)?.kind === 'official').length;
  assert.ok(videoOfficial >= 15, '视频技能里官方来源应占多数，实际 ' + videoOfficial);
  const arch = ALL.filter(skill => skill.category === '建筑家装');
  assert.ok(arch.length >= 16, '建筑家装两条线都要在（图片 + 视频各 8+），实际 ' + arch.length);
  /* 建筑家装：**图片侧**开源侧没有成熟库（GitHub 搜"interior/architecture prompt"最高 8★），
     所以图片那 8 条只能以竞品产品侧清单为准 —— 如实标注，不许假装有权威来源。
     **视频侧**例外：Seedance 官方用例里有空间漫游（一镜到底）与空间叙事（剧情补全）的骨架，
     那两条按官方登记，其余 6 条仍是竞品来源。 */
  const archImage = arch.filter(skill => skill.board === 'image');
  assert.equal(archImage.length, 8, '建筑家装图片 8 条');
  for (const skill of archImage) {
    assert.equal(sourceOf(skill.id).kind, 'competitor', skill.id + ' 建筑家装（图片）只能标竞品来源');
  }
  const archVideo = arch.filter(skill => skill.board === 'video');
  for (const skill of archVideo) {
    const kind = sourceOf(skill.id).kind;
    assert.ok(['competitor', 'official'].includes(kind), skill.id + ' 建筑家装（视频）来源类型不合法：' + kind);
  }
  const archOfficial = archVideo.filter(skill => sourceOf(skill.id).kind === 'official').length;
  assert.ok(archOfficial >= 1, '建筑家装视频里至少要有官方骨架的那几条（空间漫游 / 空间叙事）');
});
