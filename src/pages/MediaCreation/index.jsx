import React, { useCallback, useEffect, useMemo, useState } from 'react';

/* ═══ 媒体板块页（图片 / 视频共用一个页面）═══════════════════════════════════════
   做法参照竞品实测：**一个页面按 ?id= 渲染全部技能**（他们也是 /image-creation?id=<skillId>），
   而不是"一个技能一个页面文件" —— 这是能不能批量做到 40+ 个技能的前提。
   但表达是我们自己的：分组、卡片、文案、配色全部来自我们的声明源与 --sb-* token。

   两个视图：
     · 没有 ?id= → Hub（分组 + 案例卡网格）
     · 有   ?id= → Skill 工作台（左配置 + 右「示例 / 历史」）
   URL 是唯一事实源：点卡进工作台、返回键、前进键都靠它同步（可直接分享链接）。 */
import { useApp } from '../../store/AppContext';
import MediaHub from '../Home/MediaHub.jsx';
import SkillWorkbench from '../Home/SkillWorkbench.jsx';
import { getImageSkill } from '../../skills/imageSkills.js';
import { getVideoSkill } from '../../skills/videoSkills.js';
import '../Home/MediaHub.css';
import '../Home/SkillWorkbench.css';
import './MediaCreation.css';

const BOARD_BY_PAGE = { 'image-creation': 'image', 'video-creation': 'video' };

/* 生成不在这里重写：工作台只负责"带着选好的配置进对应板块"，真正出图仍走既有引擎。 */
const LAUNCH_BY_PIPELINE = {
  visualCreation: { mode: 'visual' },
  ecommerceSuite: { mode: 'ecommerce', recipeId: 'product_suite' },
  builtinSkill: { mode: 'ecommerce' },
  xhsNote: { mode: 'content', subMode: 'content' },
  videoSmart: { mode: 'video' },
  videoFrame: { mode: 'video' },
  videoRemake: { mode: 'video' },
  videoReference: { mode: 'video' },
};
/* 自由创作这条链路认识自己的四个子方向，其余新技能先落在「自由创作」里。 */
const VISUAL_SKILL_IDS = {
  'image.free': 'free',
  'image.poster': 'poster',
  'image.social_cover': 'social-cover',
  'image.brand_kv': 'brand-kv',
};

function skillFromUrl(board) {
  const params = new URLSearchParams(window.location.search);
  const id = (params.get('id') || '').trim();
  if (!id) return '';
  return board === 'video' ? (getVideoSkill(id) ? id : '') : (getImageSkill(id) ? id : '');
}

export default function MediaCreationPage() {
  const { state, dispatch } = useApp();
  const board = BOARD_BY_PAGE[state.page] || 'image';
  const basePath = board === 'video' ? '/video-creation' : '/image-creation';
  const [skillId, setSkillId] = useState(() => skillFromUrl(board));
  const [values, setValues] = useState({});

  useEffect(() => {
    const sync = () => setSkillId(skillFromUrl(board));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [board]);

  const openSkill = useCallback(id => {
    window.history.pushState({}, '', basePath + '?id=' + encodeURIComponent(id));
    setSkillId(id);
    setValues({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [basePath]);

  const backToHub = useCallback(() => {
    window.history.pushState({}, '', basePath);
    setSkillId('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [basePath]);

  const skill = useMemo(
    () => (skillId ? (board === 'video' ? getVideoSkill(skillId) : getImageSkill(skillId)) : null),
    [board, skillId],
  );

  const onGenerate = useCallback(({ skillId: id }) => {
    const target = board === 'video' ? getVideoSkill(id) : getImageSkill(id);
    if (!target) return;
    const plan = LAUNCH_BY_PIPELINE[target.pipeline] || { mode: 'visual' };
    const visualSkill = VISUAL_SKILL_IDS[target.id];
    dispatch({ type: 'NAVIGATE', page: 'home' });
    dispatch({ type: 'SET_MODE', mode: plan.mode });
    dispatch({
      type: 'SET_CREATION_LAUNCH',
      launch: {
        mode: plan.mode,
        nonce: Date.now() + '-' + target.id,
        ...(plan.recipeId ? { recipeId: plan.recipeId } : {}),
        ...(plan.subMode ? { subMode: plan.subMode } : {}),
        ...(visualSkill ? { skillId: visualSkill } : {}),
      },
    });
  }, [board, dispatch]);

  return (
    <div className="media-creation">
      {skill
        ? <SkillWorkbench
            board={board}
            skillId={skill.id}
            values={values}
            onFieldChange={(key, value) => setValues(prev => ({ ...prev, [key]: value }))}
            onBack={backToHub}
            onGenerate={onGenerate}
            history={[]}
          />
        : <MediaHub board={board} onOpenSkill={openSkill} />}
    </div>
  );
}
