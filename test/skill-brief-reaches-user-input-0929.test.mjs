import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSkillBrief } from '../src/skills/skillRun.js';
import { getImageSkill } from '../src/skills/imageSkills.js';

/* ══════════════════════════════════════════════════════════════════════════════
   这条门禁盯的是**本仓最贵的一类 bug**：界面上给用户一个能打字/能选的控件，
   值也收进了 state、也走了提交，但**提示词模板里没有它** ⇒ 模型从头到尾没看见。
   用户写完、生成、扣了钱，图与他写的东西毫无关系 —— 而**没有任何报错**。

   怎么被发现的：用户一句「风格选择不会影响出图效果吗？那风格选择还有什么意义呢」。
   我第一反应是去核对界面，核对完发现是**提示词线路**的问题 ——
   `buildSkillBrief` 只认模板里写出来的 `{{key}}`，
   没写进模板的字段，值再对也会被静默丢弃（`skillRun.js` 的 template.replace）。

   批 CY-㉓ 修掉的四处（**这四条是全量扫出来的，不是逐个猜的**）：
     image.product_suite   少了 style / styleBrief / styleNote（三段全丢）
     image.aplus           少了 styleBrief / styleNote
     image.detail_page     少了 styleBrief / styleNote
     image.render_quality  少了 focus —— 而它是 **required: true**，
                           用户**必须**填才能提交，填完被丢掉（最严重的一种）

   为什么 `render_quality` 那个不是可选段：它本来就必填，标签留着是对的。
   另外三个都是可选的，所以用新语法 `{{?key}}…{{/key}}` ——
   没填就**整段连标签一起消失**，否则提示词里会多出「风格要求：」这种空话。
   ══════════════════════════════════════════════════════════════════════════════ */

const FIELDS_OWNED_BY_OTHER_CHANNELS = new Set([
  /* upload —— 走 image_url / reference_images，不进 brief 文本，这是对的 */
  'assets', 'model', 'top', 'bottom', 'pose', 'backdrop', 'styleRef', 'structure',
  /* 走各自的下发参数，不进 brief 文本 —— 核过 skillRun.js:433/454：
     clarity 会被读成 resolution、imageModel 会被读成模型，两者都是**API 参数**，
     不是提示词文本。放进 brief 反而是错的（模型名/档位不该塞进自然语言里）。 */
  'model', 'ratio', 'clarity', 'imageModel', 'resolution', 'count', 'structureCounts', 'mode',
  'market', 'platform', 'language', 'quality', 'format',
]);

function fieldsOf(skill) {
  return (skill.fields || []).map(f => f.key);
}
function briefTokens(skill) {
  const brief = String(skill.brief || '');
  return new Set([...brief.matchAll(/\{\{\??\s*(\w+)\s*\}?\}/g)].map(m => m[1]));
}

function declaredBriefKeys(skill) {
  const keys = briefTokens(skill);
  for (const k of skill.injectedBriefKeys || []) keys.add(k);
  for (const f of (skill.genConfig && skill.genConfig.specFields) || []) {
    if (f && typeof f === 'object' && f.key) keys.add(f.key);
  }
  /* `shotPreset`（本篇张数）不是提示词内容，是**运行期编排**：
     skillRun.js:569 `SKILL_MODULES_PRESET_KEY = 'shotPreset'`，
     :584 拿它去展开「勾几种就出几张」那份模块清单 ⇒ 它决定**跑几次**，不决定说什么。 */
  if (skill.fields && skill.fields.some(f => f.key === 'shotPreset')) keys.add('shotPreset');
  /* `layout`（版式族）同样不是提示词内容：skillRun.js:231-233 把它塞进 run 的
     `layout` 载荷（换图时换版式），走的是另一个参数而不是 brief 文本。 */
  if (skill.fields && skill.fields.some(f => f.key === 'layout' && f.kind === 'cards')) keys.add('layout');
  return keys;
}

/* 会渲染成「用户可输入」控件的 kind —— 这些才可能「内容丢失」 */
const USER_INPUT_KINDS = new Set(['textarea', 'text', 'input', 'segmented', 'chips', 'select', 'cards']);

const TARGETS = [
  ['image.product_suite', ['style', 'styleBrief', 'styleNote']],
  ['image.aplus', ['styleBrief', 'styleNote']],
  ['image.detail_page', ['styleBrief', 'styleNote']],
  ['image.render_quality', ['focus']],
  ['image.sku_series', ['layout']],
];

test('① 四个技能的这些字段现在真的进了 brief 模板', () => {
  for (const [id, keys] of TARGETS) {
    const skill = getImageSkill(id);
    assert.ok(skill, `技能 ${id} 必须存在`);
    const tokens = briefTokens(skill);
    for (const key of keys) {
      assert.ok(tokens.has(key), `${id} 的 brief 模板里必须有 {{${key}}}（否则用户填了也不会发给模型）`);
    }
  }
});

test('② 界面上这些控件确实存在（防止只改了模板、控件其实没渲染）', () => {
  for (const [id, keys] of TARGETS) {
    const skill = getImageSkill(id);
    const declared = (skill.fields || []).filter(f => keys.includes(f.key));
    for (const key of keys) {
      assert.ok(declared.length > 0, `${id} 必须真的声明了字段 ${key} —— 否则改了模板也没意义`);
    }
  }
});

test('③ 填了就会进去（不是只把占位符摆在那儿）', () => {
  const cases = [
    ['image.product_suite', { style: '奶油白ins风', styleBrief: '柔和侧光', styleNote: '右上角留白' },
      ['风格取向：奶油白ins风', '风格要求：柔和侧光', '设计要求：右上角留白']],
    ['image.aplus', { styleBrief: '冷调', styleNote: '不要logo' }, ['风格要求：冷调', '设计要求：不要logo']],
    ['image.detail_page', { styleBrief: '竖版清透', styleNote: '标注清晰' }, ['风格要求：竖版清透', '设计要求：标注清晰']],
    ['image.render_quality', { focus: '增强金属反射' }, ['后期指令：增强金属反射']],
    ['image.sku_series', { layout: '两行网格' }, ['排列方式：两行网格']],
  ];
  for (const [id, values, expected] of cases) {
    const skill = getImageSkill(id);
    const brief = buildSkillBrief(skill, values);
    for (const fragment of expected) {
      assert.ok(brief.includes(fragment), `${id}：填了之后提示词里必须有「${fragment}」\n实际：${brief}`);
    }
  }
});

test('④ 没填就整段消失 —— 不许留下「风格要求：」这种空标签喂给模型', () => {
  for (const [id, keys] of TARGETS) {
    const skill = getImageSkill(id);
    const brief = buildSkillBrief(skill, {});
    for (const label of ['风格取向：', '风格要求：', '设计要求：', '后期指令：']) {
      assert.ok(!brief.includes(label),
        `${id}：一个可选段都没填，提示词里不该残留空标签「${label}」\n实际：${brief}`);
    }
  }
});

test('⑤ 可选段对「没填」的场景零影响（改完与改前的提示词逐字相同）', () => {
  /* 这是本批最重要的安全属性：用户没碰风格框 ⇒ 提示词必须与改动前一模一样，
     不然就是「为了让一个框生效，把所有不出框的用户也弄坏了」。 */
  const ps = getImageSkill('image.product_suite');
  const brief = buildSkillBrief(ps, {
    productParams: 'X', market: 'M', language: 'L', platform: 'P',
  });
  assert.ok(
    brief.startsWith('围绕商品生成一套电商图。商品信息：X。目标市场：M；画面内文案语言：L。'
      + '要求：先确保商品本身的结构、颜色、材质与文字被完整保留，再谈场景与氛围；'
      + '符合P的图片规范与目标市场的审美习惯。'),
    `不填风格时，提示词开头必须与改动前逐字相同。实际：${brief}`,
  );
});

test('⑥ 可选段语法本身：{{?key}}…{{/key}} 按值决定去留', () => {
  const skill = { brief: '开头。{{?note}}说明：{{note}}。{{/note}}结尾。' };
  // 填了：整段保留（末尾会追加既有的 USER_PRIORITY_CLAUSE，所以比前缀）
  const filled = buildSkillBrief(skill, { note: '要柔光' });
  assert.ok(filled.startsWith('开头。说明：要柔光。结尾。'), filled);
  assert.ok(filled.includes('优先级'), '填了内容就该追加「用户填写优先」那句（既有规则）');
  // 没填：整段连标签一起消失，一个字都不留
  for (const empty of [{ note: '' }, { note: '   ' }, {}]) {
    const brief = buildSkillBrief(skill, empty);
    assert.ok(!brief.includes('说明'), `没填就不该残留「说明：」—— ${JSON.stringify(empty)} ⇒ ${brief}`);
    assert.ok(brief.startsWith('开头。'), brief);
    assert.ok(brief.includes('结尾'), brief);
  }
  // 没填时不追加优先级声明（模板里没有任何占位符有值 ⇒ 既有的 usedKeys 规则）
  assert.equal(buildSkillBrief(skill, {}).includes('优先级'), false);
});

test('⑦ 全量扫描：任何技能都不得再声明「用户能输入、模板却不读」的字段', () => {
  /* 这条是本批的核心护栏 —— 上面的四条是「已修好的」，这条保证「以后新加的」也会被抓住。 */
  const problems = [];
  for (const skill of ALL_IMAGE_SKILLS()) {
    const keys = declaredBriefKeys(skill);
    for (const field of skill.fields || []) {
      if (!USER_INPUT_KINDS.has(field.kind)) continue;
      if (FIELDS_OWNED_BY_OTHER_CHANNELS.has(field.key)) continue;
      if (keys.has(field.key)) continue;
      problems.push(`${skill.id} :: ${field.key}(${field.kind})`);
    }
  }
  assert.deepEqual(problems, [],
    '这些控件界面上能填，brief 模板却不读它 ⇒ 用户填的内容从未发给模型：\n  ' + problems.join('\n  '));
});

/* 拿全部内置技能（imageSkills 的导出结构在批 CY-㉓ 之后按 boards 分组） */
function ALL_IMAGE_SKILLS() {
  // eslint-disable-next-line import/no-dynamic-require
  const mod = require_imageSkills();
  const list = [];
  const push = value => {
    if (Array.isArray(value)) value.forEach(push);
    else if (value && typeof value === 'object' && value.id) list.push(value);
  };
  for (const key of Object.keys(mod)) {
    const v = mod[key];
    if (Array.isArray(v)) push(v);
  }
  return list;
}

function require_imageSkills() {
  // 这个文件是 ESM；测试本身也是 ESM，所以用静态 import 的结果即可。
  return IMAGE_SKILLS_MODULE;
}

import * as IMAGE_SKILLS_MODULE from '../src/skills/imageSkills.js';
