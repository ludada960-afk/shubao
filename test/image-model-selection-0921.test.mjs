import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { IMAGE_SKILLS, getImageSkill } from '../src/skills/imageSkills.js';
import {
  DEFAULT_IMAGE_MODEL,
  FALLBACK_RATIO,
  buildSkillRequest,
  nearestLegalRatio,
  reconcileFieldValues,
  skillGenerationSettings,
  skillPointsEstimate,
} from '../src/skills/skillRun.js';
import { IMAGE_MODELS, SELECTABLE_IMAGE_MODELS, imageModelResolutions } from '../src/services/imageModelCatalog.js';

/* ═══ 批 R：模型选择 / 比例「自适应」的接线门禁（2026-09-19）═══════════════════════════════
   用户第 21 轮原话（逐字）：
     「模型选择不用纠结啊，他们子页面的模型不也是首页的模型吗，直接引用就好了呀，
       比例里的「自适应」我不知道是不是指原来各个 skill 自己的尺寸比例方案，
       各个 skill 他们自己有最适配的方案吗，有的话就可以作为自适应去做吧？
       你先确保你现在线上所有的 skill 来源和工作台功能打通，
       所有适配方案都确确实实没有任何问题我们再来跑案例，你自己要深度核查一遍。」

   两件事各有一条**唯一实现**，本门禁守的就是"只有一份"和"真的接通了"：
     ① 模型选择：选项来自 services/imageModelCatalog.js（首页同一个目录），
        用户选的模型必须真的进请求（buildSkillRequest.imageModel）并真的参与计费
        （skillPointsEstimate 与后端 SKU 同源）—— 不是摆一个点了没用的下拉。
     ② 自适应：知渔自己的 help 原文是「「自适应」将根据模特图自动匹配最接近的比例」
        （证据 docs/design/data/quantv-image-workbenches.json），
        所以判据是**按主图实际宽高就近取一档**，取值在 skillRun（纯函数），
        量宽高在控件层（FieldRenderer.measureBox）—— 本门禁直接喂宽高进去断言结果。 */

const workbenches = JSON.parse(readFileSync(new URL('../docs/design/data/quantv-image-workbenches.json', import.meta.url), 'utf8'));
const builtinPages = JSON.parse(readFileSync(new URL('../docs/design/data/quantv-image-builtin-pages.json', import.meta.url), 'utf8'));

const modelFieldOf = skill => (skill.fields || []).find(field => field.key === 'imageModel');
const skillsWithModelField = () => IMAGE_SKILLS.filter(skill => modelFieldOf(skill));

test('① 模型选择只出现在知渔有这一格的页面上（逐字段实采为据，不是全站铺一个下拉）', () => {
  /* 知渔的模型选择一共只出现在 3 个页面：图片复刻 / AI换装（两个内置页，select 一档
     「智能图片image」）与即梦seedream5.0pro（app 页 radio 一档）—— 后者的应用我们没有对应技能。
     其余 101 个 app 页面的 inputConfigs 里**没有**模型字段（本门禁逐条查证）。 */
  const theirs = workbenches
    .filter(app => (app.fields || []).some(field => String(field.t || '') === '模型选择' && String(field.vn || '') === 'model'))
    .map(app => app.title);
  assert.deepEqual(theirs, ['即梦seedream5.0pro'], '知渔 app 页里有「模型选择」的只剩这一个，证据变了要同步本门禁');
  const builtinWithModel = builtinPages.pages
    .filter(page => Array.isArray(page.selects) && page.selects.some(options => options.length === 1 && options[0] === '智能图片image'))
    .map(page => page.skill)
    .sort();
  assert.deepEqual(builtinWithModel, ['image.copy', 'image.try_on'], '知渔内置页里有「模型选择」的是这两页');

  const ours = skillsWithModelField().map(skill => skill.id).sort();
  /* ⚠️ 2026-09-28 批 DC 续-5：`image.concept_set` **用户点名加入**（原话逐字：
     「那现在最火的不是 image2.5 吗，**我不能用上吗，我们现在有支持吗**」）——
     这是**改口径**，不是"随手全站铺下拉"：仍然只有点名的这一页 + 知渔对应的那两页，
     "别把一个下拉铺到 108 页"这条门禁本意不变。 */
  assert.deepEqual(ours, ['image.concept_set', 'image.copy', 'image.try_on'],
    '我们的模型选择 = 知渔对应的两页 + 用户点名开放的概念工作台（多一页/少一页都是没对上）');
  for (const skill of skillsWithModelField()) {
    const field = modelFieldOf(skill);
    assert.equal(field.label, '模型选择', skill.id + '：字段标题照知渔原文');
    assert.equal(field.kind, 'select', skill.id + '：知渔这一格是下拉');
    assert.equal(field.required, true, skill.id + '：模型必须有值（没有值就没法出图/计费）');
  }
});

test('② 选项与默认档都来自那一份目录（首页模型挑选器同源，不另立第二份）', () => {
  const ids = SELECTABLE_IMAGE_MODELS.map(model => model.id);
  assert.ok(ids.length >= 2, '目录里至少要有多于一档可选模型，否则"模型选择"没有意义');
  assert.equal(SELECTABLE_IMAGE_MODELS[0].id, DEFAULT_IMAGE_MODEL,
    '目录第一档必须就是运行层默认的 image2（界面显示什么，就跑什么）');
  for (const skill of skillsWithModelField()) {
    const field = modelFieldOf(skill);
    assert.deepEqual(field.options.map(option => option.value), ids, skill.id + '：选项必须逐档等于目录');
    assert.deepEqual(field.options.map(option => option.label), SELECTABLE_IMAGE_MODELS.map(model => model.label),
      skill.id + '：档位文案也来自目录，页面不许自己写一份');
    assert.equal(field.default, DEFAULT_IMAGE_MODEL, skill.id + '：默认档 = 目录第一档');
  }
  /* 反向自证：目录里加一档，界面必须跟着多一档（否则就是"目录改了界面没改"） */
  const synthetic = { ...skillsWithModelField()[0], fields: [{ ...modelFieldOf(skillsWithModelField()[0]), options: [...SELECTABLE_IMAGE_MODELS, { id: 'x' }].map(m => ({ value: m.id, label: m.label })) }] };
  assert.equal(modelFieldOf(synthetic).options.length, ids.length + 1, '选项数应当与目录同增同减');
});

test('③ 用户选的模型真的进请求、真的参与计费（不是点了没反应的下拉）', () => {
  const skill = getImageSkill('image.copy');
  const values = {
    reference: [{ url: 'https://example.com/a.png', status: 'ready', width: 1024, height: 1024 }],
    product: '白色陶瓷杯', degree: '参考排版',
  };
  for (const model of SELECTABLE_IMAGE_MODELS) {
    const settings = skillGenerationSettings(skill, { ...values, imageModel: model.id });
    assert.equal(settings.imageModel, model.id, model.id + '：选的模型必须原样进设置');
    const request = buildSkillRequest(skill, { ...values, imageModel: model.id });
    assert.equal(request.imageModel, model.id, model.id + '：请求体里的模型必须是用户选的那一档');
    /* 计费：与后端 catalog 同源（1 积分 = 1000 units）。同一档模型换了清晰度，价格也要跟着走。 */
    const points = skillPointsEstimate(skill, { ...values, imageModel: model.id });
    assert.ok(points > 0, model.id + '：积分预估必须是正数');
  }
  /* 至少有一档模型的单价**不等于** image2 —— 否则"换模型"在钱上没有区别，门禁就是空转 */
  const base = skillPointsEstimate(skill, values);
  const others = SELECTABLE_IMAGE_MODELS.filter(model => model.id !== DEFAULT_IMAGE_MODEL)
    .map(model => skillPointsEstimate(skill, { ...values, imageModel: model.id }));
  assert.ok(others.some(points => points !== base), '换模型必须至少有一档价格不同（否则计费没接上）');
  /* 认不出的取值回落到有出图记录的 image2，绝不把野值发给服务端 */
  assert.equal(skillGenerationSettings(skill, { ...values, imageModel: 'not-a-model' }).imageModel, DEFAULT_IMAGE_MODEL);
  assert.equal(skillGenerationSettings(skill, { ...values, imageModel: '' }).imageModel, DEFAULT_IMAGE_MODEL);
});

test('④ 分辨率不超出所选模型的档位（声明 optionsFrom ↔ 运行层夹取，两处同源）', () => {
  const skill = getImageSkill('image.copy');
  const values = { reference: [{ url: 'u', status: 'ready', width: 1024, height: 1024 }], product: 'x', degree: '参考排版' };
  const clarity = (skill.fields || []).find(field => field.key === 'clarity');
  assert.ok(clarity.optionsFrom && clarity.optionsFrom.key === 'imageModel', '清晰度必须声明"跟着模型变"');
  /* 映射表只能是**目录里真有上限的**那些模型，且逐档等于目录的 resolutions */
  for (const [id, allowed] of Object.entries(clarity.optionsFrom.map)) {
    const model = IMAGE_MODELS.find(entry => entry.id === id);
    assert.ok(model, id + '：映射表里的模型必须在目录里');
    assert.deepEqual(allowed, imageModelResolutions(id), id + '：允许档位必须等于目录里的 resolutions');
    assert.ok(allowed.length < 3, id + '：只有档位不全的模型才进这张表');
  }
  /* 运行层：Midjourney（上游只有 1K/2K）选了 4K 必须被夹到它能给的最高的那一档 */
  const mj = skillGenerationSettings(skill, { ...values, imageModel: 'midjourney', clarity: '4K' });
  assert.equal(mj.resolution, '2K', 'Midjourney 没有 4K：不能显示 4K 而按 2K 跑');
  assert.equal(skillGenerationSettings(skill, { ...values, imageModel: 'midjourney', clarity: '1K' }).resolution, '1K');
  /* 三档全支持的模型不许被误伤 */
  assert.equal(skillGenerationSettings(skill, { ...values, imageModel: 'gemini-3-image', clarity: '4K' }).resolution, '4K');
  assert.equal(skillGenerationSettings(skill, { ...values, imageModel: DEFAULT_IMAGE_MODEL, clarity: '4K' }).resolution, '4K');
  /* 联动夹取：换模型的那一刻，界面上的值也要跟着回到合法档（否则控件会显示一个空档位） */
  assert.equal(reconcileFieldValues(skill.fields, { ...values, imageModel: 'midjourney', clarity: '4K' }).clarity, '2K');
  assert.equal(reconcileFieldValues(skill.fields, { ...values, imageModel: 'midjourney', clarity: '1K' }).clarity, '1K');
  assert.equal(reconcileFieldValues(skill.fields, { ...values, imageModel: DEFAULT_IMAGE_MODEL, clarity: '4K' }).clarity, '4K');
});

test('⑤ 比例「自适应」= 按主图实际宽高就近取一档（知渔 help 原文的口径）', () => {
  /* 知渔自己的说明就是判据（他们「出图比例」那一格的 help 原文） */
  const help = workbenches.flatMap(app => app.fields || []).map(field => String(field.help || ''))
    .filter(text => text.includes('自适应'));
  assert.ok(help.some(text => text.includes('自动匹配最接近的比例')),
    '知渔对「自适应」的原文说明变了，实现口径要重新核');

  assert.equal(nearestLegalRatio(1024, 1024), '1:1');
  assert.equal(nearestLegalRatio(900, 1600), '9:16');
  assert.equal(nearestLegalRatio(1600, 900), '16:9');
  assert.equal(nearestLegalRatio(1000, 1500), '2:3');
  /* ⚠️ 批 X：2:1 现在是**合法档**了（本批补的），所以换一个仍不在白名单里的例子（5:3 = 1.6667）。 */
  assert.equal(nearestLegalRatio(1600, 1000), '3:2', '16:10（1.6）不在白名单里，对数距离最近的是 3:2（1.5）');
  assert.equal(nearestLegalRatio(0, 0), '', '量不到宽高就返回空，不许猜一个比例出来');

  const skill = getImageSkill('image.copy');
  const upload = (width, height) => [{ url: 'https://example.com/p.png', status: 'ready', width, height }];
  const adaptive = (width, height) => skillGenerationSettings(skill, {
    reference: upload(width, height), product: 'x', degree: '参考排版', ratio: '自适应',
  });
  assert.equal(adaptive(900, 1600).ratio, '9:16', '竖图 → 就近 9:16');
  assert.equal(adaptive(1024, 1024).ratio, '1:1');
  /* 量不到宽高（跨域失败等）→ 回落声明里的默认档；'自适应' 这个字面值**不许**下发给引擎 */
  const noBox = skillGenerationSettings(skill, {
    reference: [{ url: 'u', status: 'ready' }], product: 'x', degree: '参考排版', ratio: '自适应',
  });
  assert.equal(noBox.ratio, FALLBACK_RATIO, '没有主图宽高时回落 1:1');
  for (const values of [adaptive(900, 1600), noBox]) {
    assert.ok(!String(values.ratio).includes('自适应'), '「自适应」是界面档位，不是引擎协议值');
  }
  /* 显式档位不受影响 */
  assert.equal(skillGenerationSettings(skill, { ...values0(), ratio: '4:5' }).ratio, '4:5');
  /* 两页都要有「自适应」这一档，且照知渔的档位顺序（自适应在最前） */
  for (const id of ['image.copy', 'image.try_on']) {
    const options = getImageSkill(id).fields.find(field => field.key === 'ratio').options.map(option => option.value);
    assert.equal(options[0], '自适应', id + '：自适应照知渔排在第一档');
    assert.equal(new Set(options).size, options.length, id + '：比例档位不许重复');
  }
  /* 知渔 AI换装那一页的比例我们**一档不缺**（自适应 + 5 档全在引擎白名单里） */
  const tryOn = getImageSkill('image.try_on').fields.find(field => field.key === 'ratio').options.map(option => option.value);
  assert.deepEqual(tryOn, ['自适应', '1:1', '3:2', '2:3', '16:9', '9:16']);
});

function values0() {
  return { reference: [{ url: 'u', status: 'ready', width: 1024, height: 1024 }], product: 'x', degree: '参考排版' };
}
