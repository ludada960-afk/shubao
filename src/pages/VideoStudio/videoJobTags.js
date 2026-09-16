/* ═══ 视频任务的「来自哪条技能」标记（本机）══════════════════════════════════════
   用户 9-17 口径：「如果他们是在子页面的这些工作台，生成的结果就会在各自的子页面历史记录里面。」
   视频任务是服务端的一张表（video_jobs），**没有技能字段**，服务端也不该为了展示去改表
   （那是计费链路，改它的收益远小于风险）。所以「这个任务是从哪条技能发起的」记在本机：
     · 只是**展示用的标签**，不参与任何计费、幂等、重试判断；
     · 缺了标记不会丢东西 —— 视频工作台顶部的「生成记录」永远是服务端的**全量**任务，
       子页面的历史只是"按技能筛过的一份视图"。
   ⚠️ 绝不能因为少了这个标记就让用户看不到自己的任务：拿不到标记时按「未分类」处理，
      历史区的空态文案要如实说清楚"全部任务在上方生成记录里"。 */
const STORAGE_KEY = 'shubao:video-job-skills:v1';
const MAX_ENTRIES = 300;

function readAll() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    /* 隐私模式 / 存储被禁用：标记功能降级为不可用，绝不让它把页面带崩 */
    return {};
  }
}

function writeAll(map) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* 同上：写不进去就算了，任务本身不受影响 */
  }
}

export function tagVideoJob(jobId, skillId) {
  const id = String(jobId || '').trim();
  const skill = String(skillId || '').trim();
  if (!id || !skill) return;
  const all = readAll();
  all[id] = skill;
  const ids = Object.keys(all);
  if (ids.length > MAX_ENTRIES) {
    /* 只留最近的若干条：这是展示用的旁路信息，不需要无限增长 */
    const trimmed = {};
    ids.slice(-MAX_ENTRIES).forEach(key => { trimmed[key] = all[key]; });
    writeAll(trimmed);
    return;
  }
  writeAll(all);
}

export function videoJobSkill(jobId) {
  const id = String(jobId || '').trim();
  if (!id) return '';
  return String(readAll()[id] || '');
}

/* 把服务端返回的任务列表按技能筛成子页面历史用的一份视图。
   传入的 jobs 不被修改（服务端那一份仍然是全量）。 */
export function videoJobsOfSkill(jobs, skillId) {
  const skill = String(skillId || '').trim();
  const list = Array.isArray(jobs) ? jobs : [];
  if (!skill) return [];
  return list.filter(job => videoJobSkill(job && job.id) === skill);
}
