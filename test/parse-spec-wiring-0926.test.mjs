/* ═══ 门禁：解析方案**真的接进了界面与流水线**（2026-09-26 批 BW）════════════════════════════
   批 BV 只把 `parseSpecs` **入库**（数据 + 门禁），界面还是那三组全站共用的胶囊 ——
   用户看到的就是"一些标签而已"。这一批把它接上，于是要守住的不再是"表里有没有"，
   而是"**用户实际看到的、模型实际收到的**是不是这份表"：

     ① **默认档不许被继承改掉**：步② 一打开就默认选中每组第一档，所以解析后的第一档
        必须仍然是中性档或已声明的默认档（继承工作台档位只能往后接）；
     ② **概念视觉方案的步② 是它自己的工作台档位**（20 条母体 + 10 种手法），不是通用三组；
     ③ **模型收到的是"只解析这些"**：有 skillId 时提示词里逐项列出这条 skill 的解析项，
        并**明说不要解析清单之外的东西**（概念方案里不许出现卖点/人群/参数）；
     ④ **模型自己冒出来的键要被丢掉**（否则"这条 skill 不该解析卖点"会被自由发挥绕过）；
     ⑤ **没有 skillId 的入口不能空掉**：退回表面级通用档（首页那个入口本来就没有具体 skill）；
     ⑥ 客户端：改过的条目算**另一份方案**（另一个 actionId），应用时把修正并进正文。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';
import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import { parseSpecOf, parsePlanForSkill, resolveParseDirections, parseSpecIsNeutralFirst, skillById } from '../src/skills/parseSpecs.js';
import {
  buildLocalPlanPreview,
  buildPlanPreviewRequest,
  normalizePlanPreview,
  planPreviewDirections,
} from '../server/planPreview.mjs';
import {
  appliedPlanText,
  correctionsOf,
  customItemRow,
  itemRowsOf,
  planPreviewSpecFor,
  preselectedDirections,
} from '../src/components/plan-preview/planPreviewModel.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(join(ROOT, relative), 'utf8');
const ALL = [...IMAGE_SKILLS, ...VIDEO_SKILLS];

test('① 每条 skill 的步② 解析后，第一档仍是中性档或已声明的默认档（继承不许改掉默认档）', () => {
  const bad = [];
  let checked = 0;
  for (const skill of ALL) {
    const plan = parsePlanForSkill(skill.id);
    assert.ok(plan, skill.id + ' 没有解析方案');
    for (const group of plan.directions) {
      checked += 1;
      if (!group.options.length) { bad.push(skill.id + ' / ' + group.label + '：一个档位都没有'); continue; }
      if (!parseSpecIsNeutralFirst(group)) {
        bad.push(skill.id + ' / ' + group.label + '：解析后的第一档是「' + group.options[0].label + '」');
      }
    }
    /* 走**界面真正走的那条路**：按 id 在前端算（图片侧传 skill.id、视频侧传 workbenchSkillId）——
       只按对象取的话，调用点传错 id（比如少个下划线）在门禁里看不出来。 */
    const byId = planPreviewSpecFor(skill.id);
    assert.ok(byId, skill.id + ' 按 id 在前端取不到解析方案 ⇒ 界面上拿不到它自己的那份');
    assert.ok(byId.items.length >= 3, skill.id + ' 按 id 取到的解析项少于 3 条');
    assert.ok(byId.directions.length >= 1, skill.id + ' 按 id 取到的方向组为空');
  }
  assert.deepEqual(bad, [], '这些方向组的第一档既不中性、也没声明理由：\n' + bad.join('\n'));
  assert.ok(checked >= ALL.length, '样本量自证：方向组总数应当不少于技能数，实际 ' + checked + ' / ' + ALL.length);
  /* 自证：把第一档换成一个具体取值，同一个判据必须判红 */
  const broken = { key: 'x', label: 'x', options: [{ value: 'warm-earth', label: '灰调大地' }] };
  assert.equal(parseSpecIsNeutralFirst(broken), false, '默认档换成具体值没被判红 ⇒ 这条判据可以蒙过去');
  assert.equal(parseSpecIsNeutralFirst({ key: 'x', label: 'x', options: [{ value: 'warm', label: '暖', pinned: true, reason: '工作台里就是这么声明的' }] }), true);
});

test('② 概念视觉方案的步② 是**它自己的工作台档位**，不是全站那三组通用胶囊', () => {
  const options = planPreviewSpecFor('image.concept_set');
  assert.equal(options.source, 'override');
  assert.deepEqual(options.directions.map(group => group.key), ['theme', 'shot', 'ratio']);
  const theme = options.directions[0];
  const shot = options.directions[1];
  /* 主题意象 = 工作台「主题意象」那一格的 20 条母体（+1 中性档）；手法 = 10 种（+1） */
  assert.equal(theme.options.length, 21, '主题意象没有继承工作台的 20 条母体');
  assert.equal(shot.options.length, 11, '手法没有继承工作台的 10 种手法');
  assert.match(theme.options[1].value, /概念：/, '母体选项要带"概念"与色板');
  assert.match(theme.options[1].value, /#[0-9A-Fa-f]{6}/, '母体选项要带实测主色值');
  assert.match(shot.options[1].value, /——/, '手法选项要带执行定义');
  /* 通用三组（业务场景/内容类型/拍摄方式）**不该**出现在这条 skill 的预览里 */
  assert.doesNotMatch(options.directions.map(group => group.label).join(' '), /业务场景|内容类型|拍摄方式/);
  /* 步① 的行 = 这条技能的 8 项解析（其中没有一条是卖点/人群/参数） */
  assert.equal(options.items.length, 8);
  assert.doesNotMatch(options.items.map(item => item.label).join(' '), /卖点|产品特点|适用人群|尺寸参数/);
  assert.match(options.items.map(item => item.label).join(' '), /色调归属/);
  /* 没有 skillId / 不存在的 id ⇒ null（界面据此退回服务端的表面级通用档，而不是编一份出来） */
  assert.equal(planPreviewSpecFor(''), null);
  assert.equal(planPreviewSpecFor('image.nope'), null);
  assert.equal(planPreviewSpecFor('__proto__'), null);
  assert.ok(skillById('video.smart'), '视频侧按 id 也要找得到（workbenchSkillId 走的就是它）');
});

test('③ 模型收到的是"只解析这些"：请求体按这条 skill 的解析项组织（声明由前端下发）', () => {
  const spec = planPreviewSpecFor('image.concept_set');
  const request = buildPlanPreviewRequest({
    surface: 'image', skillId: 'image.concept_set', skillName: '概念视觉方案', prompt: '秋天的无花果香',
    specItems: spec.items, directions: spec.directions, specKey: spec.key, specSource: spec.source,
  });
  assert.equal(request.skillKey, 'image.concept_set');
  for (const key of ['subject', 'material', 'palette', 'scene', 'light', 'avoid']) {
    assert.match(request.systemPrompt, new RegExp('\\b' + key + '（'), '解析项 ' + key + ' 没进提示词');
  }
  assert.match(request.systemPrompt, /不要\*\*解析这份清单之外的任何东西/, '必须明说"别解析清单外的东西"');
  assert.match(request.systemPrompt, /卖点、适用人群、价格、尺寸参数/, '要点名那几个不该解析的（用户原话：不可能概念 skill 还解析什么卖点）');
  assert.match(request.systemPrompt, /"items"/, '要模型按 items 结构回答');
  assert.match(request.userPrompt, /image\.concept_set：这条技能自己的解析方案/, 'userPrompt 要写明是哪一套方案');
  /* 方向档位进的是 userPrompt，且用的是这条 skill 继承来的档位 */
  const withDirection = buildPlanPreviewRequest({
    surface: 'image', skillId: 'image.concept_set', prompt: 'x',
    specItems: spec.items, directions: spec.directions, specKey: spec.key, specSource: spec.source,
    direction: { theme: '概念：秋日限定（主色 灰调大地 #94847A，辅 #8F8E93 / #CAB3AE）', ratio: '3:4' },
  });
  assert.match(withDirection.userPrompt, /概念：秋日限定/);
  assert.match(withDirection.userPrompt, /3:4 竖版/);
  /* 反过来：前端没下发声明时**不**要求 items（首页入口 / 老客户端的契约不变） */
  const generic = buildPlanPreviewRequest({ surface: 'image', prompt: 'x' });
  assert.equal(generic.skillKey, '');
  assert.doesNotMatch(generic.systemPrompt, /"items"/);
  assert.equal(generic.directions.length, 3, '没下发方向组时退回**服务端自己的**表面级通用三组');
  assert.deepEqual(generic.directions.map(group => group.key), ['business', 'content', 'shot']);
  /* 消毒：前端下发的形状再乱，也只收合法的那些（键去重、长度截断、组数/档位数封顶） */
  const messy = buildPlanPreviewRequest({
    surface: 'image', prompt: 'x',
    specItems: [{ key: 'a', label: '甲', hint: 'x' }, { key: 'a', label: '重复' }, { key: '' }, { key: 'b' }],
    directions: [
      { key: 'g', label: '组', options: [{ value: 'v1' }, { value: '' }, { value: 'v2', label: '二' }] },
      { key: '', options: [{ value: 'x' }] },
      { key: 'empty', options: [] },
    ],
  });
  assert.deepEqual(messy.items.map(item => item.key), ['a', 'b'], '重复/空键要清掉');
  assert.deepEqual(messy.directions.map(group => group.key), ['g'], '空组要清掉');
  assert.deepEqual(messy.directions[0].options.map(option => option.value), ['v1', 'v2'], '空档位要清掉');
});

test('④ 模型自己冒出来的解析键会被丢掉（不许用自由发挥绕过"这条 skill 不该解析卖点"）', () => {
  const spec = parseSpecOf(IMAGE_SKILLS.find(skill => skill.id === 'image.concept_set'));
  const normalized = normalizePlanPreview({
    items: [
      { key: 'subject', value: '一只陶土杯' },
      { key: 'sellingPoints', value: '容量大、保温 12 小时' },
      '乱写',
    ],
  }, { surface: 'image', items: spec.items });
  assert.deepEqual(normalized.items.map(item => item.key).filter(key => key === 'sellingPoints'), [],
    '模型编出来的"卖点"被收下了 —— 这条 skill 明确不该解析卖点');
  const subject = normalized.items.find(item => item.key === 'subject');
  assert.equal(subject.value, '一只陶土杯');
  assert.ok(subject.label, 'label 要来自声明源（模型只负责给 value）');
  assert.equal(normalized.items.filter(item => !item.value).length, spec.items.length - 1, '没答的项要留空行，不是消失');
  /* 也容忍模型回成 {key: value} 的对象形状 */
  const objectShape = normalizePlanPreview({ items: { subject: '一只玻璃杯' } }, { surface: 'image', items: spec.items });
  assert.equal(objectShape.items.find(item => item.key === 'subject').value, '一只玻璃杯');
});

test('⑤ 降级（模型没连上）时解析项的**行**照常给出，只是值为空 —— 不假装、也不藏', () => {
  const spec = planPreviewSpecFor('image.concept_set');
  const local = buildLocalPlanPreview(
    { surface: 'image', skillId: 'image.concept_set', specItems: spec.items },
    '模型超时',
  );
  assert.equal(local.degraded, true);
  assert.equal(local.items.length, 8, '降级时把"这条技能要解析什么"整块藏掉了');
  assert.deepEqual(local.items.map(item => item.value).filter(Boolean), [], '降级时不该有解析结论（那是假的）');
  assert.equal(local.plan.promptText, '');
  /* ⚠️ 服务端**不再自己查**这条 skill 的解析方案（它读不到 src/）：
     前端没下发声明时，它就**只有**那三组通用档、没有解析条目 —— 不编、也不假装知道。 */
  const noSpec = buildLocalPlanPreview({ surface: 'image', skillId: 'image.concept_set' }, '模型超时');
  assert.deepEqual(noSpec.items, [], '没下发声明时不该凭空长出解析条目');
  /* 没有 skillId 的入口：方向组退回原来那三组（首页入口不能因为接线而空掉） */
  const generic = planPreviewDirections('video');
  assert.deepEqual(generic.map(group => group.key), ['business', 'content', 'shot']);
  assert.deepEqual(preselectedDirections(generic), { business: 'ecommerce', content: 'selling', shot: 'tabletop' });
});

test('⑥ 客户端：行可增删、改过的条目算另一份方案、应用时并进正文', () => {
  const declared = [
    { key: 'subject', label: '主体物', hint: '素材里拍的是什么' },
    { key: 'palette', label: '色调归属', hint: '归到哪个色簇' },
  ];
  const answered = [{ key: 'subject', value: '一只陶土杯' }, { key: 'palette', value: '灰调大地' }];
  const rows = itemRowsOf(declared, answered);
  assert.deepEqual(rows.map(row => [row.key, row.value, row.custom]), [['subject', '一只陶土杯', false], ['palette', '灰调大地', false]]);
  /* 没答时行照样在（值空）—— "这条技能要解析什么"是看得见的 */
  assert.deepEqual(itemRowsOf(declared, []).map(row => row.value), ['', '']);
  /* 用户改一行 + 加一行 */
  const edited = rows.map(row => (row.key === 'subject' ? { ...row, value: '一只粗陶马克杯' } : row));
  const withCustom = [...edited, customItemRow(edited)];
  assert.equal(withCustom.at(-1).key, 'custom-1');
  assert.deepEqual(correctionsOf(withCustom, answered).map(item => [item.key, item.value]), [['subject', '一只粗陶马克杯']]);
  assert.equal(correctionsOf(rows, answered).length, 0, '一字没改就不该算修正');
  /* 再点一次「重新生成」：用户自己加的行要留着，服务端结论覆盖声明项 */
  const again = itemRowsOf(declared, [{ key: 'subject', value: '陶土杯' }], withCustom);
  assert.deepEqual(again.map(row => [row.key, row.value]), [['subject', '陶土杯'], ['palette', ''], ['custom-1', '']]);
  /* 应用：正文 + 只把他改过的那几条并进去 */
  assert.equal(appliedPlanText('正文一', rows, answered), '正文一', '没改就不该往正文后面拖解析');
  assert.match(appliedPlanText('正文一', withCustom, answered), /^正文一\n\n【按你的修正】\n- 主体物：一只粗陶马克杯$/);
  /* 两个入口都把 skill 带进去了（不带就等于没接线） */
  assert.match(read('src/pages/MediaCreation/index.jsx'), /skillId=\{skill\.id\}/, '图片侧没把 skill 带进预览');
  assert.match(read('src/pages/VideoStudio/index.jsx'), /skillId=\{workbenchSkillId\}/, '视频侧没把 skill 带进预览');
  const dialog = read('src/components/plan-preview/PlanPreviewDialog.jsx');
  assert.match(dialog, /planPreviewSpecFor\(skillId\)/, '解析方案要按 skill 在前端算（服务端读不到 src/）');
  assert.match(dialog, /specItems: localSpec\?\.items \|\| \[\]/, '要把这条 skill 的解析项声明下发给服务端');
  assert.match(dialog, /directions: localSpec\?\.directions \|\| \[\]/, '要把这条 skill 的档位下发给服务端');
  assert.match(dialog, /planPreviewActionId\(\{ surface, skillId, skillName, prompt, direction, materials, items: confirmedItems \}\)/,
    '改过的条目必须进 actionId —— 否则改了条目再点生成会被当成同一份方案（改了个寂寞）');
  assert.match(dialog, /preselectedDirections\(localSpec\.directions\)/, '步② 要默认选中中性档');
  assert.match(dialog, /className="plan-preview-item-add"/, '步① 要有"添加一条"');
  assert.match(dialog, /className="plan-preview-item-drop"/, '行尾要有删除');
});

test('⑦ 自证：各族第一档若被换成具体值，① 必须判红（防"继承"把判据架空）', () => {
  const fakeSkill = { id: 'image.fake', board: 'image', category: '建筑家装', fields: [{ key: 'style', options: [{ value: 'modern', label: '现代简约' }] }] };
  const fakeSpec = {
    source: 'family', key: '建筑家装',
    items: [{ key: 'a', label: 'a', hint: '' }],
    directions: [{ key: 'style', label: '装修风格', fromField: 'style', options: [{ value: 'modern', label: '现代简约' }] }],
  };
  const resolved = resolveParseDirections(fakeSkill, fakeSpec);
  assert.equal(resolved[0].options[0].value, 'modern', '这条自证要的是"确实继承/保留了具体档"');
  assert.equal(parseSpecIsNeutralFirst(resolved[0]), false, '第一档是具体取值时必须判红 —— 否则① 是空转');
  /* 声明里中性档在前时，继承来的档位只能往后接（第一档不许被继承顶掉） */
  const guarded = resolveParseDirections(fakeSkill, { ...fakeSpec, directions: [{ key: 'style', label: '装修风格', fromField: 'style', options: [{ value: 'auto', label: '智能匹配' }] }] });
  assert.deepEqual(guarded[0].options.map(option => option.value), ['auto', 'modern']);
  assert.equal(parseSpecIsNeutralFirst(guarded[0]), true);
});
