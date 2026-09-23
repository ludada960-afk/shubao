/* ═══ 视频技能的**方案默认规格**（2026-09-25 批 AO）══════════════════════════════════════════════
   用户的方向性批评（docs/design/69 §3.2 的原话）：
     「你为什么还有这种**模型 / 清晰度 / 时长都全部做进去**的情况呢，我不是说了所有子页面
      **一比一对应**知渔的视频生成和图片生成的页面吗，还有这种情况出现说明还是没有对齐呀」
   批 AG 解决了"**露不露**"（规格暴露表：模型只在 5 页、时长只在 3 页、清晰度 0 页）；
   这一步解决"**默认是什么**"——
     现状：每条视频子页面进创作台都用同一套全局初值（比例 9:16 / 时长 5 秒 / 720P），
           于是「建筑图转视频」和「豪门恩怨短剧」进去长得一样，用户还得自己改一遍。
     目标（docs/design/69 §3.2）：**规格由方案定** —— 每页用**它自己那一页**的默认档起步。

   判据（唯一事实源，不许再写第二份名单）：
     · 工作台声明里 `bind: 'ratio'` 的第一档 = 这一页的默认比例；
     · 工作台声明里 `bind: 'duration'` 的第一档 = 这一页的默认时长；
     · 本地方案（skill.plan.defaults）显式声明的以它为准（它是"方案"那一层的东西）。
   为什么取"第一档"：知渔那些页的比例/时长按钮顺序是实采的（docs/design/data/quantv-video-pages.json），
   各页顺序不同（电商带货 9:16 打头、建筑室内 1:1 打头、短剧 10/15、建筑 5/10/15）——
   实采里**没有记录选中态**（只有按钮文本与坐标），第一档是唯一可推且可核的档。
   ⚠️ 这个默认值只是"进页面时的初值"：用户在创作台里改过的值一律优先（改完不会被这里覆盖）。
   ⚠️ 产品白名单最后再夹一次（创作台已有的 snapVideoDuration）：方案默认 10 秒碰上只认 5/10/15 的档位也不会发错。 */
import { VIDEO_WORKBENCHES } from './videoWorkbenches.js';
import { QUANTV_VIDEO_COUNTERPARTS } from './quantvVideoParity.js';
import { videoSkillPlanOf } from './videoSkills.js';

export const PLAN_SETTINGS_FALLBACK = Object.freeze({ ratio: '9:16', duration: 5, resolution: '720p' });

/* ═══ 路由页的「视频设置」默认值（知渔实采原文，按**对照页 URL** 索引）═══════════════════════════
   来源：docs/design/data/quantv-video-pages.json 的 panelText —— 路由型页面（视频创作 / 爆款复刻 /
   内容替换）左栏没有比例 chip，但它们的「视频设置」按钮上明写了默认档：
     · /ai-video           「16:9 · 15秒 · 720p」   → video.smart 与三条"脚本型"shape 技能
     · /video-recreation   「16:9 · 4秒 · 720p」    → video.remake
     · /content-replace    「16:9 · 720p · 4秒」    → video.content_swap
   为什么必须有这一份：没有它，这几页会回退到全局 9:16 —— 而**知渔那一页是 16:9**（横屏）。
   「视频创作」是首页那一条主入口，默认比例反了是肉眼可见的不对齐。
   ⚠️ 表由实采派生，**不许手改**：门禁 test/video-plan-settings-0925 会拿同一份 json 重新解析
      「视频设置」行并逐条比对（与 VIDEO_SPEC_EXPOSURE 同一条纪律：名单写两处必然漂移）。
   ⚠️ 时长 4 秒**不在**我们产品的白名单里（5/10/15）——那是知渔的档位。这里如实照抄 4，
      创作台最后会按产品契约吸附到最近的合法档（5 秒），吸附那一层是既有的 snapVideoDuration。 */
const ROUTE_PAGE_DEFAULTS = Object.freeze({
  'https://laoyu.quantv.com/ai-video': { ratio: '16:9', duration: 15 },
  'https://laoyu.quantv.com/video-recreation': { ratio: '16:9', duration: 4 },
  'https://laoyu.quantv.com/content-replace': { ratio: '16:9', duration: 4 },
});

export function routePageDefaultsOf(skillId) {
  const counterpart = QUANTV_VIDEO_COUNTERPARTS[skillId]?.counterpart || '';
  return ROUTE_PAGE_DEFAULTS[counterpart] || null;
}

/* 门禁与诊断用：把上面那张表整份读出来（含出处 URL），便于对着实采逐条核对 */
export function routePageDefaultsTable() {
  return { ...ROUTE_PAGE_DEFAULTS };
}

function firstChipValue(blocks, bind) {
  const block = (blocks || []).find(item => item.kind === 'chips' && item.bind === bind);
  const options = Array.isArray(block?.options) ? block.options : [];
  const first = options.find(option => option.disabled !== true) || options[0];
  return first ? first.value : undefined;
}

/**
 * 这条视频技能进创作台时的**方案默认规格**。
 * @param {string} skillId
 * @returns {{ ratio: string, duration: number, resolution: string, source: string }}
 *   source 说明这份默认是哪来的（诊断 + 门禁可读）：
 *     'plan'（方案显式声明）/ 'workbench'（工作台第一档）/ 'route-page'（知渔那一页的「视频设置」）/ 'fallback'
 */
export function videoPlanSettingsOf(skillId) {
  const id = typeof skillId === 'string' ? skillId.trim() : '';
  const spec = id ? VIDEO_WORKBENCHES[id] : null;
  const plan = id ? videoSkillPlanOf(id) : null;
  const blocks = spec?.blocks || [];
  const routeDefaults = id ? routePageDefaultsOf(id) : null;

  const chipRatio = firstChipValue(blocks, 'ratio');
  const chipDuration = firstChipValue(blocks, 'duration');
  const chipResolution = firstChipValue(blocks, 'resolution');
  const planRatio = plan?.defaults?.ratio;
  const planDuration = plan?.defaults?.duration;
  const planResolution = plan?.defaults?.resolution;

  const ratio = String(planRatio || chipRatio || routeDefaults?.ratio || PLAN_SETTINGS_FALLBACK.ratio);
  const durationValue = planDuration ?? chipDuration ?? routeDefaults?.duration;
  const duration = Number.isFinite(Number(durationValue)) && Number(durationValue) > 0
    ? Math.round(Number(durationValue))
    : PLAN_SETTINGS_FALLBACK.duration;
  const resolution = String(planResolution || chipResolution || PLAN_SETTINGS_FALLBACK.resolution);

  let source = 'fallback';
  if (planRatio || planDuration || planResolution) source = 'plan';
  else if (chipRatio || chipDuration || chipResolution) source = 'workbench';
  else if (routeDefaults) source = 'route-page';

  return { ratio, duration, resolution, source };
}

/* 这一页**有没有**自己声明过默认（诊断用：门禁拿它区分"派生出来的"和"回退到全局的"） */
export function hasPlanSettings(skillId) {
  return videoPlanSettingsOf(skillId).source !== 'fallback';
}
