import { readFileSync, writeFileSync } from 'node:fs';

/* ═══ 生成「技能来源与配方」汇总文档 ══════════════════════════════════════════════
   用户 9-17 的交付要求（原话）：
   「你要确保所有的 skill 都是能够出最好效果的……全部都要把它们的来源记录下来，以便我们后续
    可以找到这些 skill 的来源去跟踪他们的情况。还有如果说他们的来源里面是自带案例的，
    你最好把他们的案例的生成提示词以及相关的素材也给记下来，最终能够汇总成一份文档给到我。」

   数据来源（都在仓库里，可追踪、可重跑）：
     · src/skills/imageSkills.js / videoSkills.js —— 技能声明（子页面字段与我们的配方提示词）
     · src/skills/skillSources.js            —— 出处台账（四类来源，门禁强制）
     · src/skills/coverTemplates.js          —— 封面出图配方
     · docs/design/skill-recipe-library.json —— 上游 case 的原文提示词与自带素材快照
   用法：node scripts/build-skill-source-doc.mjs
   ══════════════════════════════════════════════════════════════════════════════ */
import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';
import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import { SKILL_SOURCES, sourceOf } from '../src/skills/skillSources.js';
import { getCoverPlan } from '../src/skills/coverTemplates.js';
import { skillPath } from '../src/skills/skillDirectory.js';

const LIB = JSON.parse(readFileSync(new URL('../docs/design/skill-recipe-library.json', import.meta.url), 'utf8'));
const KIND_LABEL = { official: '上游官方用例', repo: '高星开源库', competitor: '竞品产品侧', ours: '我们自研链路' };
const boardLabel = board => (board === 'video' ? '视频' : '图片');
const sourceLink = source => {
  if (!source || !source.repo) return '';
  const ref = source.ref ? source.ref.split('#')[0] : '';
  if (source.kind === 'competitor') return 'https://' + source.repo;
  return 'https://github.com/' + source.repo + (ref ? '/blob/main/' + ref : '');
};
const lines = [];
lines.push('# 技能来源与配方总表（自动生成，勿手工编辑）');
lines.push('');
lines.push('> 生成命令：`node scripts/build-skill-source-doc.mjs`。数据来自 `src/skills/*`（声明与出处台账）与 `docs/design/skill-recipe-library.json`（上游原文快照）。');
lines.push('');
lines.push('## 怎么用这份文档');
lines.push('');
lines.push('1. 每条技能下面有 **子页面地址**（线上直接打开，就是你验收时要进的那一页）；');
lines.push('2. **我们的配方提示词** = 子页面里预填给用户的那段（进页面就能看到，可直接改）；');
lines.push('3. **来源原文提示词** = 上游那条成熟配方**原封不动**的原文 —— 你要生成案例时照它填；');
lines.push('4. **来源自带案例素材** = 上游那条配方自己的参考图/成片链接，用来对齐效果与做参照；');
lines.push('5. **封面出图配方** = 出这张卡封面时用的版式/色相/标题/主体描述。');
lines.push('');
lines.push('来源四类：**official** 上游官方用例（最可信，提示词语法与我们的引擎一致）· **repo** 高星开源库（登记真实 star）· **competitor** 竞品产品侧（开源侧无成熟库的品类，如建筑家装）· **ours** 我们自己跑通的链路。');
lines.push('');

const ALL = [...IMAGE_SKILLS, ...VIDEO_SKILLS];
const byKind = {};
for (const skill of ALL) { const kind = sourceOf(skill.id)?.kind || 'none'; byKind[kind] = (byKind[kind] || 0) + 1; }
lines.push('## 总览');
lines.push('');
lines.push('| 板块 | 条数 | 官方 | 高星库 | 竞品 | 自研 |');
lines.push('|---|---|---|---|---|---|');
for (const board of ['image', 'video']) {
  const list = board === 'video' ? VIDEO_SKILLS : IMAGE_SKILLS;
  const count = kind => list.filter(s => (sourceOf(s.id)?.kind || 'none') === kind).length;
  lines.push('| ' + boardLabel(board) + ' | ' + list.length + ' | ' + count('official') + ' | ' + count('repo') + ' | ' + count('competitor') + ' | ' + count('ours') + ' |');
}
lines.push('');
lines.push('来源渠道（登记时查询的真实 star）：');
lines.push('');
lines.push('- Seedance 2.5 **官方 use-cases（10 类约 50 条）+ 官方 guide** —— EvoLinkAI/awesome-seedance-2.5-guide（403★）');
lines.push('- Seedance 2.0 提示词合集 · 九大商用玩法 —— ZeroLu/awesome-seedance（2,415★）');
lines.push('- Seedance 2.0 提示词 2000+ 条（备查） —— YouMind-OpenLab/awesome-seedance-2-prompts（1,998★）');
lines.push('- 图片配方库（电商 35 / 广告创意 54 / 海报 / 人像 / 对比，每条带成品图与出处） —— EvoLinkAI/awesome-gpt-image-2-API-and-Prompts（17,199★）');
lines.push('- 竞品产品侧实测清单（图片 110 / 视频 32） —— 知渔 AI（laoyu.quantv.com）');
lines.push('');

for (const board of ['image', 'video']) {
  lines.push('## ' + boardLabel(board) + '板块');
  lines.push('');
  const list = board === 'video' ? VIDEO_SKILLS : IMAGE_SKILLS;
  const categories = [...new Set(list.map(s => s.category))];
  for (const category of categories) {
    lines.push('### ' + category);
    lines.push('');
    for (const skill of list.filter(s => s.category === category)) {
      const source = sourceOf(skill.id);
      const plan = getCoverPlan(skill.id);
      const recipe = LIB.bySkill[skill.id];
      lines.push('#### ' + skill.name + ' · `' + skill.id + '`');
      lines.push('');
      lines.push('- **一句话**：' + skill.summary);
      lines.push('- **子页面**：`' + skillPath(skill) + '`');
      lines.push('- **可用性**：' + skill.availability + (skill.availability === 'ready' ? '（现有链路可跑）' : skill.availability === 'needs_ref' ? '（需要参考素材路由，声明支持但未实测出片）' : '（上游能力暂缺，上架前必须转 ready）'));
      lines.push('- **来源**：' + (KIND_LABEL[source.kind] || source.kind) + ' · ' + (source.name || '') + (source.stars ? '（' + source.stars + '★）' : ''));
      if (source.ref) lines.push('  - 具体位置：`' + source.ref + '`');
      const link = sourceLink(source);
      if (link) lines.push('  - 跟踪链接：' + link);
      if (source.note) lines.push('  - 说明：' + source.note);
      lines.push('- **我们的配方提示词**（子页面里预填）：');
      lines.push('');
      lines.push('  > ' + String(skill.brief || '（这条技能没有 brief）').replace(/\n/g, ' '));
      lines.push('');
      if (recipe && recipe.via === 'reference') {
        lines.push('- **参考效果配方**（这条技能是我们自研/以竞品为准，没有公开配方可抄；下面这条是同类里最好的公开效果，用它当出案例的基准）：');
        lines.push('');
        lines.push('  > ' + String(recipe.prompt).slice(0, 1200));
        lines.push('');
        if (recipe.assets.length) {
          lines.push('- **参考案例素材**（' + recipe.assets.length + ' 个）：');
          for (const url of recipe.assets) lines.push('  - ' + url);
          lines.push('');
        }
      } else if (recipe) {
        lines.push('- **来源原文提示词**（照它生成案例）：');
        lines.push('');
        lines.push('  > ' + String(recipe.prompt).slice(0, 1200));
        lines.push('');
        if (recipe.assets.length) {
          lines.push('- **来源自带案例素材**（' + recipe.assets.length + ' 个）：');
          for (const url of recipe.assets) lines.push('  - ' + url);
          lines.push('');
        }
      } else {
        lines.push('- **来源原文提示词**：暂无（该来源是竞品产品侧或我们自研链路，没有公开配方可抄；需要时以竞品子页面的实际做法为准）');
        lines.push('');
      }
      if (plan) {
        lines.push('- **封面出图配方**：版式 `' + plan.template + '` · 色相 `' + plan.accent + '` · 标题「' + plan.title + '」 · 主体：' + plan.subject);
        lines.push('');
      }
    }
  }
}
const out = new URL('../docs/design/46-skill-sources-and-recipes.md', import.meta.url);
writeFileSync(out, lines.join('\n'));
console.log('WROTE ' + out.pathname);
console.log('SKILLS=' + ALL.length + ' WITH_RECIPE=' + Object.keys(LIB.bySkill).length);