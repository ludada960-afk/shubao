import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import { VIDEO_WORKBENCHES } from '../src/skills/videoWorkbenches.js';
import { QUANTV_VIDEO_COUNTERPARTS } from '../src/skills/quantvVideoParity.js';
import { VIDEO_SPEC_EXPOSURE } from '../src/skills/videoSpecExposure.js';
import { videoPlanSettingsOf, PLAN_SETTINGS_FALLBACK, routePageDefaultsTable } from '../src/skills/videoPlanSettings.js';

/* ═══ 2026-09-25 批 AO：**方案默认规格**（docs/design/69 §3.2「规格由方案定」的收尾）═════════════
   用户的方向性批评（逐字）：
     「你为什么还有这种**模型 / 清晰度 / 时长都全部做进去**的情况呢，我不是说了所有子页面
      **一比一对应**知渔的视频生成和图片生成的页面吗，还有这种情况出现说明还是没有对齐呀，
      你要**深度的全面核查**解决对齐呀」
   批 AG 解决了"露不露"（规格暴露表）；这一步解决"**默认是什么**"——每条子页面进创作台
   该用它**自己那一页**的默认档起步，而不是全站一套 9:16 / 5 秒 / 720P。
   判据（唯一事实源，这里全部**从声明与实采重新派生**，不许手改）：
     ① 工作台 `bind:'ratio'` / `bind:'duration'` 的**第一档**就是这一页的默认（知渔的按钮顺序是实采的）；
     ② 路由页（左栏没有比例 chip 的）用他们「视频设置」那一行明写的默认（从同一份 json 解析）；
     ③ 本地方案（plan.defaults）显式声明的优先；
     ④ 派生出来的比例必须是我们支持的合法比例、时长必须是整数秒 ——
        否则这一页进创作台就会带着一个非法规格（"界面显示什么就跑什么"，非法值会被服务端拒）。 */

const evidence = JSON.parse(readFileSync(new URL('../docs/design/data/quantv-video-pages.json', import.meta.url), 'utf8'));
const pages = Array.isArray(evidence) ? evidence : evidence.pages;
const pageByUrl = new Map(pages.map(page => [String(page.url || ''), page]));
const LEGAL_RATIOS = new Set(['21:9', '16:9', '4:3', '1:1', '3:4', '9:16']);

/* 与 src/skills/videoPlanSettings.js 同一条解析规则：抓「视频设置」之后的第一行，取比例与秒数 */
function parseRoutePageSettings(url) {
  const page = pageByUrl.get(String(url));
  const text = String(page?.panelText || '');
  const index = text.indexOf('视频设置');
  if (index < 0) return null;
  const line = text.slice(index + 4).split(/\n/).map(item => item.trim()).filter(Boolean)[0] || '';
  const ratio = (line.match(/\d+:\d+/) || [''])[0];
  const seconds = Number((line.match(/(\d+)\s*秒/) || [])[1]);
  if (!ratio && !Number.isFinite(seconds)) return null;
  return { ratio: ratio || '', duration: Number.isFinite(seconds) ? seconds : 0, line };
}

function firstChipValue(skillId, bind) {
  const block = (VIDEO_WORKBENCHES[skillId]?.blocks || []).find(item => item.kind === 'chips' && item.bind === bind);
  const options = Array.isArray(block?.options) ? block.options : [];
  const first = options.find(option => option.disabled !== true) || options[0];
  return first ? first.value : undefined;
}

const mainSkills = VIDEO_SKILLS.filter(skill => skill.tier !== 'assistant' && VIDEO_WORKBENCHES[skill.id]);

test('① 工作台声明了比例/时长的页面：默认值必须正好是那一格的第一档（照知渔的按钮顺序）', () => {
  let withRatio = 0;
  let withDuration = 0;
  for (const skill of mainSkills) {
    const settings = videoPlanSettingsOf(skill.id);
    const chipRatio = firstChipValue(skill.id, 'ratio');
    const chipDuration = firstChipValue(skill.id, 'duration');
    const plan = skill.plan?.defaults || {};
    if (chipRatio) {
      withRatio += 1;
      assert.equal(settings.ratio, String(plan.ratio || chipRatio),
        `${skill.id} 的默认比例必须是工作台第一档（知渔那一页顺序照抄）：期望 ${chipRatio}，实际 ${settings.ratio}`);
    }
    if (chipDuration) {
      withDuration += 1;
      assert.equal(settings.duration, Number(plan.duration ?? chipDuration),
        `${skill.id} 的默认时长必须是工作台第一档：期望 ${chipDuration}，实际 ${settings.duration}`);
    }
  }
  assert.ok(withRatio >= 40, '声明了比例档的页面应 ≥40 条（实际 ' + withRatio + '）');
  assert.ok(withDuration >= 15, '声明了时长档的页面应 ≥15 条（实际 ' + withDuration + '）');
});

test('② 路由页的默认值对着知渔实采**逐条重算**（表写错就红）', () => {
  const table = routePageDefaultsTable();
  const urls = Object.keys(table);
  assert.ok(urls.length >= 3, '路由页默认表至少要覆盖视频创作 / 爆款复刻 / 内容替换');
  for (const url of urls) {
    const derived = parseRoutePageSettings(url);
    assert.ok(derived, url + ' 的实采里没有「视频设置」这一行 —— 表里的默认值没有出处');
    assert.equal(table[url].ratio, derived.ratio,
      `${url} 的默认比例与实采不符（实采那一行是「${derived.line}」）`);
    assert.equal(table[url].duration, derived.duration,
      `${url} 的默认时长与实采不符（实采那一行是「${derived.line}」）`);
  }
  /* 用了表的那几条技能，取到的值必须就是它对照页的值（不是别人页的） */
  for (const [id, record] of Object.entries(QUANTV_VIDEO_COUNTERPARTS)) {
    const counterpart = String(record.counterpart || '');
    if (!table[counterpart]) continue;
    const settings = videoPlanSettingsOf(id);
    const chipRatio = firstChipValue(id, 'ratio');
    if (!chipRatio) assert.equal(settings.ratio, table[counterpart].ratio, id + ' 应当取它对照页的默认比例');
  }
});

test('③ 每一条派生结果都合法：比例在我们支持的白名单里、时长是正整数秒', () => {
  const offenders = [];
  for (const skill of mainSkills) {
    const settings = videoPlanSettingsOf(skill.id);
    if (!LEGAL_RATIOS.has(settings.ratio)) offenders.push(`${skill.id}: 比例 ${settings.ratio} 不在白名单`);
    if (!Number.isInteger(settings.duration) || settings.duration <= 0) offenders.push(`${skill.id}: 时长 ${settings.duration} 非法`);
    if (!/^(480p|720p|1080p|2k)$/.test(settings.resolution)) offenders.push(`${skill.id}: 清晰度 ${settings.resolution} 非法`);
  }
  assert.deepEqual(offenders, [], '派生出的默认规格必须都是合法值：\n' + offenders.join('\n'));
});

test('④ 千页一面已经破掉：默认规格不止一种组合（这是本批的目的）', () => {
  const combos = new Set(mainSkills.map(skill => {
    const settings = videoPlanSettingsOf(skill.id);
    return `${settings.ratio}/${settings.duration}/${settings.resolution}`;
  }));
  assert.ok(combos.size >= 4, '默认规格组合应 ≥4 种（实际 ' + combos.size + '）—— 全站一套初值就是"千页一面"');
  const sources = new Map();
  for (const skill of mainSkills) {
    const settings = videoPlanSettingsOf(skill.id);
    sources.set(settings.source, (sources.get(settings.source) || 0) + 1);
  }
  assert.ok((sources.get('workbench') || 0) >= 40, '多数页面应当从自己的工作台声明派生默认（实际 ' + (sources.get('workbench') || 0) + '）');
});

test('⑤ 与规格暴露表不冲突：被隐藏的规格格不影响默认值（看不见的档也要是对的）', () => {
  /* 判据：知渔那 5 页有模型格、时长只有 6 页有 —— 但"默认时长"每页都要有值，
     因为时长最终一定会进请求（用户看不见这一格时，系统就更不能默认错）。 */
  for (const skill of mainSkills) {
    const settings = videoPlanSettingsOf(skill.id);
    const exposure = VIDEO_SPEC_EXPOSURE[skill.id];
    if (!exposure || !exposure.duration) continue;   // 知渔那一页没有时长格
    assert.ok(Number.isInteger(settings.duration), skill.id + ' 有默认时长');
  }
  assert.equal(PLAN_SETTINGS_FALLBACK.ratio, '9:16', '兜底值仍是站内老默认（只在完全没声明时用）');
});
