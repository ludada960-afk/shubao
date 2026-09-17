/* ═══ Skill 目录（图片 / 视频两个板块共用的一份索引）══════════════════════════════
   为什么要有它：首页热门技能条、Hub 网格、工作台返回、深链分享这几处都要回答同一个问题——
   「这个 skill 的地址是什么、它的封面在哪」。分散在各页面里写，迟早会出现
   "首页能点进去、Hub 点不进去"或"两个地方封面取法不一样"这类漂移。
   所以路径与封面的算法**只在这里实现一次**。

   两个板块 = 两个总页面（竞品实测：图片制作 /image-creation、视频制作 /apps）：
   我们的地址是 /image-creation 与 /video-creation，各自只列自己板块的 skill。 */
import { IMAGE_SKILLS } from './imageSkills.js';
import { VIDEO_SKILLS } from './videoSkills.js';

export const BOARD_PATH = Object.freeze({ image: '/image-creation', video: '/video-creation' });
export const PAGE_BOARD = Object.freeze({ 'image-creation': 'image', 'video-creation': 'video' });

export function boardOfPage(page) {
  return PAGE_BOARD[page] || 'image';
}

export function skillsOfBoard(board) {
  return board === 'video' ? VIDEO_SKILLS : IMAGE_SKILLS;
}

export function hubPath(board) {
  return BOARD_PATH[board === 'video' ? 'video' : 'image'];
}

export function skillPath(skill) {
  const board = skill && skill.board === 'video' ? 'video' : 'image';
  /* 没有 id 就退回它自己板块的总页面（不许拼出 ?id=undefined 这种地址） */
  if (!skill || !skill.id) return hubPath(board);
  return hubPath(board) + '?id=' + encodeURIComponent(skill.id);
}

/* 封面取法只有这一份：skill.cases[0] 就是这张卡的封面与预览视频。
   视频卡优先用视频（竞品实测：视频板块的封面就是真实在播的 <video>），
   同时保留 cover 当 poster —— 视频没就绪时不至于是一块黑。 */
export function coverOf(skill) {
  const first = Array.isArray(skill?.cases) ? skill.cases[0] : null;
  if (!first) return { cover: '', video: '', poster: '' };
  return {
    cover: String(first.cover || ''),
    video: String(first.video || ''),
    poster: String(first.poster || first.cover || ''),
  };
}

/* 可用性角标只有这一份实现（首页按钮行与 Hub 卡片网格共用同一句话）。
   ⚠️ 跑不通的技能**不许装作能用**：'blocked' 写"即将上线"、'needs_ref' 写"需参考素材"，
      'ready' 什么都不写（默认就是能用，不需要夸一句）。 */
export function availabilityLabel(skill) {
  const value = skill && skill.availability;
  if (value === 'blocked') return '即将上线';
  if (value === 'needs_ref') return '需参考素材';
  return '';
}

export function hasCover(skill) {
  const media = coverOf(skill);
  return Boolean(media.cover || media.video);
}

/* ═══ 首页/总页面的「精选推荐」技能（用户 9-17 口径）════════════════════════════
   原话：「它们的总页面会有一个精选推荐，跟竞品是一样的；这些精品推荐其实就是首页的那些按钮，
   作为它们的入口。鼠标放上去可以预览相关的案例，点击就进它们的子页面。」

   三条规矩（都与旧的 hotSkills 不同，逐条说清为什么）：
   ① **按板块过滤**（board）—— 旧实现把图片与视频混在一条里，
      于是"视频生成"模式下首页出现的是四张图片技能卡（实测就是这么错的）。
      图片板块下面只能有图片技能，视频板块下面只能有视频技能。
   ② **不按封面过滤** —— 旧实现"没有封面就不进条"（对**卡片网格**是对的，空卡很难看）；
      但**按钮**没有预览图也站得住：悬停时如实显示"案例补充中"，而不是干脆不出现。
      视频技能现在一条案例都没有，若继续按封面过滤，视频板块下面会**一条入口都没有**。
   ③ 精品推荐优先，其余按声明顺序补齐 —— 与竞品首页那一排的取法一致。 */
/* ═══ 融合关系：辅助能力不是卡片，而是长在主技能身上的一次动作 ═══════════════════
   用户 9-17 口径：「有些 skill 其实是辅助作用的……融合在一些主 skill 里面，
   你自己要先深度思考他们的作用呀。」所以 tier === 'assistant' 的每一条**必须**声明
   它长在谁身上、以什么形态出现（fuses.slot）：
     · 'result' 主技能**结果区**里的一次动作 —— 拿刚才那张结果当输入，转到这条链路再跑一遍
     · 'field'  主技能**控件区**里的一个控制项 —— 数量 / 运镜 / 只改一个元素
     · 'none'   当前**不具备这个能力**：既不放按钮也不放控件，必须写明 reason（不许假装有）
   into 写 '*' 表示"同板块任何主技能都适用"（相似图 / 数量 / 运镜属于这一类）。
   ⚠️ 判据只有这一份：工作台的按钮、文档里的说明都从这里取，不许各自再写一套。 */
export const FUSE_SLOTS = Object.freeze(['result', 'field', 'none']);

export function skillFusion(skill) {
  return (skill && skill.fuses) || null;
}

/* 主技能该长出哪些辅助动作（默认取结果区那一类） */
export function fuseActionsOf(board, skillId, slot = 'result') {
  const id = String(skillId || '');
  if (!id) return [];
  return skillsOfBoard(board).filter(skill => {
    if (skill.tier !== 'assistant') return false;
    const fuses = skillFusion(skill);
    if (!fuses || fuses.slot !== slot) return false;
    const into = Array.isArray(fuses.into) ? fuses.into : [];
    return into.includes('*') || into.includes(id);
  }).map(skill => ({
    skillId: skill.id,
    name: skill.name,
    label: skillFusion(skill).label || skill.name,
    note: skillFusion(skill).note || '',
  }));
}

/* 辅助能力在界面上怎么解释"它长在哪" —— 口径只有这一份（Hub 卡片用它当副标题）。
   ⚠️ 用户看到一条辅助能力时最该知道的就是这个：它不是一个能独立干完的活儿，
      而是主技能里的一个按钮/控件。写"提质感/相似图"这种名字而不写落点，等于让人猜。 */
export function fusionLabel(skill) {
  const fuses = skillFusion(skill);
  if (!fuses) return '';
  if (fuses.slot === 'none') return '暂未开放：' + String(fuses.reason || '上游能力不具备');
  const into = Array.isArray(fuses.into) ? fuses.into : [];
  if (into.includes('*')) {
    return fuses.slot === 'result'
      ? '出图后在结果区点「' + fuses.label + '」'
      : '在各技能的「' + fuses.label + '」控件上选';
  }
  const names = into.map(id => {
    const hit = IMAGE_SKILLS.find(item => item.id === id) || VIDEO_SKILLS.find(item => item.id === id);
    return hit ? hit.name : id;
  });
  return '在「' + names.join('、') + '」的结果区点「' + fuses.label + '」';
}

/* 「刚才那张结果」能不能当下一步的输入。
   ⚠️ 镜像服务端 server/imageInput.mjs 的白名单（稳定作品地址 / 临时地址 / data URL / 外链）：
      服务端读不回来的地址就不给带 —— 否则用户会在下一页撞一句"图片地址无效"，
      而他根本不知道是自己上一步的结果不能复用。白名单由 test/skill-tier-0918 对着服务端源码守。 */
const STABLE_ASSET_RE = /^\/api\/generated-assets\/[a-f0-9]{64}\.(?:jpg|jpeg|png|webp)$/i;
const TEMP_IMAGE_RE = /^\/api\/ec-temp-img\/[^/]+$/i;
const DATA_IMAGE_RE = /^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i;
const REMOTE_IMAGE_RE = /^https?:\/\//i;

export function canCarryResultAsInput(url) {
  const value = String(url || '').trim();
  if (!value) return false;
  return STABLE_ASSET_RE.test(value) || TEMP_IMAGE_RE.test(value) || DATA_IMAGE_RE.test(value) || REMOTE_IMAGE_RE.test(value);
}

export function featuredSkills({ board = '', limit = 6 } = {}) {
  /* ⚠️ 辅助能力（tier === 'assistant'）**不进精选推荐**：
     它们是某个主技能流程里的一步（提质感 / 换材质 / 延长 / 改画面 / 批量 / 相似图），
     不是用户会专门进来干的一件活儿。放进入口只会让人点进去发现「这不是一个完整的活儿」。
     判据与归属写在声明源里（tier / belongsTo），由 test/skill-tier-0918 守着。 */
  const pool = (board === 'video' ? VIDEO_SKILLS : board === 'image' ? IMAGE_SKILLS : [...IMAGE_SKILLS, ...VIDEO_SKILLS])
    .filter(skill => skill.tier !== 'assistant');
  const preferred = pool.filter(skill => skill.category === '精品推荐');
  const rest = pool.filter(skill => skill.category !== '精品推荐');
  return [...preferred, ...rest].slice(0, Math.max(1, limit));
}
