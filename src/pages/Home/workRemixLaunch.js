/* ═══ 「回到生成它的工作台」——把一条作品变回一次可编辑的配置（2026-09-27 批 CB）══════════════════
   用户口径（逐字）：
   「如果说我现在在其他的工作台里面点开这个历史按钮，然后在里面看到一些其他工作台生成的作品。
     我想要进行重新生成。正确的逻辑在我看来也许应该是他点击这个作品的话，这个作品会把它**带到原来的
     生成时的工作台**里面，然后**把之前生成时的那些提示词和素材和配置都一起展示在工作台里**，
     这样他就可以去继续调整，然后**重新去生成**。然后它重新生成出来的结果**可以是一个新的结果，
     而不是覆盖掉它原来生成的那个作品**。」
   ⇒ 这一条就是"把作品变成一次可编辑的配置、并且落到**它当初那条技能的子页面**上"。
     实现**复用站内已有的那条路**（首页案例「做同款」走的就是它：`creationLaunch` → 落到对应技能 →
     预填素材与提示词 → **不触发生成**），不另写一套。

   ── 为什么放在这里 ─────────────────────────────────────────────────────────
     · 纯函数：门禁能直接跑（"什么作品能回去、回去带什么"是有判据的，不该只靠肉眼）；
     · 页面（画布工作区 / 子页面历史）只负责"发一个 launch"，不各写一套还原逻辑。

   ── 边界（宁可少给，不给点了没反应的按钮）──────────────────────────────────
     · 只认**图片侧**技能（`image.` 前缀）：视频任务的素材还原还没做（见 docs/design/86 §六），
       所以视频记录**不给**这颗按钮 —— 给了就是"点了只回去一半"的坑；
     · 作品里必须真的存着那次的面板值（`replay.panelValues`，与子页面历史同一个判据）；
     · **过期墓碑**（`_expired`）不给：面板值早被清空了。 */
const IMAGE_SKILL_PREFIX = 'image.';

export function workRemixLaunchOf(work) {
  if (!work || typeof work !== 'object') return null;
  if (work._expired === true || String(work.expired_at || '').trim()) return null;
  const skillId = String(work.mediaSkillId || work.media_skill_id || '').trim();
  if (!skillId.startsWith(IMAGE_SKILL_PREFIX)) return null;
  const replay = work.replay && typeof work.replay === 'object' ? work.replay : null;
  const panelValues = replay && replay.mediaSkillId === skillId && replay.panelValues && typeof replay.panelValues === 'object'
    ? replay.panelValues
    : null;
  if (!panelValues || !Object.keys(panelValues).length) return null;
  return {
    kind: 'work-remix',
    skillId,
    panelValues,
    /* 这条记录当时说了什么（图文类只有一句话，图片类可能为空）—— 提示语里要用到 */
    prompt: String(work._inputText || '').trim(),
    title: String(work.title || work.product_name || '').trim(),
  };
}

export function canRemixWork(work) {
  return workRemixLaunchOf(work) !== null;
}
