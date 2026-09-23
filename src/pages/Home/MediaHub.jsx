import React, { useMemo, useState } from 'react';

/* ═══ MediaHub：图片 / 视频两个板块共用的 Hub 页面 ═══════════════════════════════
   依据 docs/design/43-media-architecture.md §3（信息架构）与 §10（知渔实测）。
   实测口径：Hub = 分组标题 + 案例卡网格（统一 4:3 封面 + 标题），点卡进对应 Skill 的工作台。
   实测机制：他们是一个页面按 id 渲染全部 Skill（/image-creation?id=<skillId>），
   所以我们这里也只有一个 Hub 组件：board='image' 或 'video' 决定读哪份声明源。
   本组件**只做渲染**：不写死任何 Skill，不写模型名，配置与文案全部来自声明源
   （src/skills/imageSkills.js / videoSkills.js）——新增 Skill 只加声明，不改这里。 */
import { IMAGE_SKILLS } from '../../skills/imageSkills.js';
import { VIDEO_SKILLS } from '../../skills/videoSkills.js';
import CaseCard from '../../components/media/CaseCard.jsx';
import { coverOf, fusionLabel } from '../../skills/skillDirectory.js';
import '../../components/media/CaseCard.css';
import '../../components/media/GalleryGrid.css';
import './MediaHub.css';

const BOARDS = {
  image: { skills: IMAGE_SKILLS, title: '图片生成', hint: '选一个方向开始，配置已经替你调好' },
  video: { skills: VIDEO_SKILLS, title: '视频生成', hint: '选一个玩法开始，素材与时长按玩法预设' },
};

export default function MediaHub({ board = 'image', onOpenSkill = null, emptyHint = '' }) {
  const config = BOARDS[board] || BOARDS.image;
  const groups = useMemo(() => {
    const order = [];
    const map = new Map();
    /* 辅助能力单独收在最后一组：它们是被主技能调用的「一步」，
       混在正常分类里会让人以为那是一个能独立干完的活儿。 */
    const assistants = config.skills.filter(skill => skill.tier === 'assistant');
    for (const skill of config.skills) {
      if (skill.tier === 'assistant') continue;
      if (!map.has(skill.category)) { map.set(skill.category, []); order.push(skill.category); }
      map.get(skill.category).push(skill);
    }
    /* ═══ 2026-09-19 用户批注 #10：「你的精品推荐为什么在下面呢？它不是应该在最上面吗？」═══
       实测确认：改前按**声明顺序**出组，精品推荐（featuredRank 那几条）夹在中间甚至靠后。
       推荐位的作用就是**第一眼看见** —— 放下面等于没推荐。
       实现：分组照旧从声明源算（不手写清单），只是把「精品推荐」这一组提到最前。 */
    const list = order.map(category => ({ category, skills: map.get(category) }));
    const FEATURED = '精品推荐';
    const featuredIndex = list.findIndex(group => group.category === FEATURED);
    if (featuredIndex > 0) list.unshift(list.splice(featuredIndex, 1)[0]);
    if (assistants.length) list.push({ category: '辅助能力', skills: assistants, assistantGroup: true });
    return list;
  }, [config]);

  /* ═══ 顶部快捷筛选页签（照竞品实测结构）═══════════════════════════════════════
     竞品两个总页面顶部都有一排分类页签（实测：图片页 8 档、视频页 4 档），
     点一下就只看那一档 —— 我们的分类本来就声明在技能里（skill.category），
     所以这排页签**不是一份手写清单**：技能增删/换组，页签自己跟着走。
     ⚠️ 「全部」是默认档：先让人看见"这里有多少东西"，再让他收窄。 */
  const [activeCategory, setActiveCategory] = useState('');
  const shown = activeCategory ? groups.filter(group => group.category === activeCategory) : groups;

  return (
    <section className="media-hub" data-board={board}>
      <header className="media-hub-head">
        <div>
          <h1>{config.title}</h1>
          <p>{config.hint}</p>
        </div>
      </header>
      {groups.length > 0 && (
        <div className="media-hub-tabs" role="tablist" aria-label={config.title + '技能分类'}>
          <button
            type="button"
            role="tab"
            aria-selected={!activeCategory}
            className={!activeCategory ? 'is-active' : ''}
            onClick={() => setActiveCategory('')}
          >全部<span>{config.skills.length}</span></button>
          {groups.map(group => (
            <button
              key={group.category}
              type="button"
              role="tab"
              aria-selected={activeCategory === group.category}
              className={activeCategory === group.category ? 'is-active' : ''}
              onClick={() => setActiveCategory(group.category)}
            >{group.category}<span>{group.skills.length}</span></button>
          ))}
        </div>
      )}
      {groups.length === 0 && <p className="media-hub-empty">{emptyHint || '暂时没有可用的技能'}</p>}
      {shown.map(group => (
        <section className="media-gallery-group" key={group.category}>
          <h2>{group.category}</h2>
          {/* 辅助能力说清它是什么：不是让你从这里开始，而是它会在主技能里被用到。
              ═══ 2026-09-23 批 AD：这句话的**后半句原来是错的** ═══════════════════════════════
              旧文案：「…也可以直接点开单独用。」—— 但这 3 条按设计**没有自己的工作台**
              （门禁 test/video-skill-workbench-declaration-0919 ① 反而要求它们不许有）：
              它们是"长在别的技能创作台上的控件 / 动作"（运镜是创作台里的一个控件、延长续写是结果区的动作）。
              点自己 = 落进通用的视频创作台，而那个台子上根本没有这个能力 —— 是死胡同。
              所以文案改成如实说清"点开去哪"，跳转也跟着改（见下面 onOpen）。 */}
          {group.assistantGroup && (
            <p className="media-hub-group-note">这些是某个主技能流程里的一步，不是独立入口 —— 点开直接进它所属技能的工作台，在那里用它。</p>
          )}
          <div className="media-gallery-grid">
            {group.skills.map(skill => {
              /* 封面取法与首页热门条**同一份实现**（skillDirectory.coverOf）：
                 视频卡优先用视频（真实在播），cover 当 poster。 */
              const media = coverOf(skill);
              /* 没有案例图时的字标位：色系取 skill 自己声明的 cover.accent（唯一真源），
                 字标取名字前两字（去掉空格，中英混排也不会取到空白）。 */
              const monogram = String(skill.name || '').replace(/\s+/g, '').slice(0, 2);
              return (
                <CaseCard
                  key={skill.id}
                  title={skill.name}
                  /* 辅助能力卡片：副标题说清"它长在谁身上"（fusionLabel 与文档同源），
                     而不是再抄一遍 summary —— 用户看这一组时最想知道的就是它从哪进去。 */
                  subtitle={skill.tier === 'assistant' ? (fusionLabel(skill) || skill.summary) : skill.summary}
                  cover={media.cover}
                  video={media.video}
                  poster={media.poster}
                  /* ═══ 2026-09-24：**角标整块去掉**（用户本轮原话：「Hub『需参考素材』角标一起去掉」）═══
                     上一批（批 T）只按那句话的**范围**（首页那排 9 个案例按钮）删了首页那一处，
                     Hub 卡片上的这颗角标被留了下来 —— 现在按用户口径**一起删**。
                     ⚠️ 删的只是**卡片上的角标**：availability 这个**声明字段一个字没动**
                        （它仍是"跑不通的技能不许装作能用"的依据，也是台账/门禁读的那份数据）；
                        availabilityLabel() 这个取词函数与它的单测也保留（谁以后再要显示还能用）。 */
                  accent={skill.cover?.accent || 'neutral'}
                  monogram={monogram}
                  /* 批 M：**按钮预览窗**右栏的案例图 —— 取这条 skill 自己声明的案例封面，最多 3 张。
                     一条都没有就传空数组，预览窗会**三格占位**并如实写「案例补充中」（不许放假图）。
                     ⚠️ 只取这条 skill 自己的案例：不拿本板块别的技能的图来冒充（首页那边也守同一条）。 */
                  previewShots={(Array.isArray(skill.cases) ? skill.cases : [])
                    .map(item => item && item.cover)
                    .filter(Boolean)
                    .slice(0, 3)}
                  /* ═══ 2026-09-23 批 AD：辅助能力点开**进它所属技能的工作台** ═══════════════════
                     它们没有自己的工作台（按设计，见上面那句文案的批注），所以点自己 =
                     落进通用创作台 = 死胡同。按 belongsTo 跳到真正能用到它的那个技能：
                       运镜控制 → 智能成片（运镜控件在那个创作台上，对所有视频技能生效）
                       延长续写 → 智能成片（结果区的动作）
                       画面修改 → 产品植入（它声明归属的那条）
                     没有 belongsTo 的才回退到自己（门禁 ⑥ 要求 assistant 必须声明融合形态，
                     所以正常都有；回退只是防御）。 */
                  onOpen={() => onOpenSkill?.(skill.tier === 'assistant' && skill.belongsTo ? skill.belongsTo : skill.id)}
                />
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
}
