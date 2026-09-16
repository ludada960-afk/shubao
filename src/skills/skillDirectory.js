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

export function hasCover(skill) {
  const media = coverOf(skill);
  return Boolean(media.cover || media.video);
}

/* 首页热门技能条：精品推荐优先，然后按声明顺序补齐；**没有封面的一律不进条**
   （首页上出现一排空卡比少放几张更糟）。案例由用户自己产出，产出后这张条会自动变长。 */
export function hotSkills({ limit = 10 } = {}) {
  const all = [
    ...IMAGE_SKILLS.filter(hasCover),
    ...VIDEO_SKILLS.filter(hasCover),
  ];
  const preferred = all.filter(skill => skill.category === '精品推荐');
  const rest = all.filter(skill => skill.category !== '精品推荐');
  return [...preferred, ...rest].slice(0, Math.max(1, limit));
}
