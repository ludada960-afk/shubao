/* ═══ 门禁：「概念视觉方案」工作台（2026-09-25 批 BP，用户点名要做）══════════════════════════
   用户原话：「你要不就直接做个这种子页面出来，后续我们可以长期用这个子页面来生成内容，
     最好是把我们刚刚说的这些策略你去定制一个**专门为我这个账号风格和审美服务的工作台**，
     **对外就是展示一个正常的子页面类型，只是对内其实是我日常要去生产内容的一个子页面工作台而已**。」

   ── 这一组断言守什么（每一条都对应一个"会静默坏掉"的点）─────────────────────
     ① 声明形状合法（id 前缀 / 名称长度 / 分类 / 复杂度 / pipeline / 封面）——
        与 `skill-declaration-contract-0916` 同口径，但**这一条是它自己的**：
        新增技能删了/改名了，这组断言必须能自己发现；
     ② **账号级签名写死在 brief 里**（不出现正脸 / 无品牌 / 留白 / 统一调色）——
        这是"对外是个正常子页面"的关键：用户不该每次手粘纪律；
        ⚠️ 2026-09-27 批 DB（M1）：「不露脸」按实测从这一层**撤下**，
           改成第 ⑨ 条那个六档可选变量（**用户改口径**：他说"这条太绝对"，
           而 402 张的实测里身体局部在场 34.8%、正面脸只有 0.2%）；
     ③ **色板与概念同源**：每个「主题意象」选项的 value 里都必须带**实测色簇的 hex** ——
        因为 `buildSkillBrief` 只做纯替换、没有查表能力，value 带色板才能保证两者永不对不上；
     ④ **十种画面手法**都来自一手实测（docs/design/82），且**互不重复**；
     ⑤ 必填项**都必须有默认值**：否则进子页面 CTA 直接被卡住（e2e 的自动配齐只填
        textarea/text，不会点 segmented/select —— 没默认值就必红）；
     ⑥ 比例默认 3:4（本账号签名是竖版，而 ratioField() 的兜底默认是 1:1）；
     ⑦ 出处已登记（skillSources 写 ours）且对照表已登记（counterpart: null + reason）；
     ⑧ **自证**：把 brief 里的无品牌纪律删掉必须被判红（否则第 ② 条测的是别的东西）；
     ⑨ **人物形态**（批 DB / M1，替换那条绝对禁令；批 DC 续-3 加第七档）：必填、
        默认 = 实测最高频的「空镜」、每一档的 value 都是可执行的整句、**没有正脸档**（1/402 是意外不是手法），
        第七档「画中画」（脸只以画面里的照片/杂志页/广告牌出现，7/402 = 1.7%）。 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { getImageSkill, IMAGE_SKILL_CATEGORIES, FIELD_KINDS, SKILL_COMPLEXITIES, IMAGE_PIPELINES } from '../src/skills/imageSkills.js';
import { buildSkillBrief, initialSkillValues, skillGenerationSettings } from '../src/skills/skillRun.js';
import { SKILL_SOURCES, SOURCE_KINDS } from '../src/skills/skillSources.js';
import { QUANTV_IMAGE_COUNTERPARTS } from '../src/skills/quantvImageParity.js';
import { COVER_TEMPLATES, COVER_ACCENTS } from '../src/skills/coverTemplates.js';

const ID = 'image.concept_set';
const skill = getImageSkill(ID);

test('① 声明形状合法（对外是个正常子页面）', () => {
  assert.ok(skill, '技能不存在：' + ID);
  assert.match(skill.id, /^image\.[a-z0-9_]+$/);
  assert.equal(skill.board, 'image');
  assert.ok(skill.name.length <= 12, '名称要短（卡片上只放封面+标题）：' + skill.name);
  assert.ok(IMAGE_SKILL_CATEGORIES.includes(skill.category), '分类不在白名单：' + skill.category);
  assert.ok(SKILL_COMPLEXITIES.includes(skill.complexity));
  assert.ok(IMAGE_PIPELINES.includes(skill.pipeline), 'pipeline 必须指向既有引擎');
  /* 一期只有电商套图是 heavy（`skill-declaration-contract-0916` 第 70 行全等断言），
     所以新技能不许用 heavy —— 这条在这里再守一次，免得那边先红、这边看不出原因。 */
  assert.notEqual(skill.complexity, 'heavy', 'heavy 档被声明契约钉给了 image.product_suite 一条');
  assert.ok(COVER_TEMPLATES.some(t => t.id === skill.cover.template), '封面模板不在白名单：' + skill.cover.template);
  assert.ok(COVER_ACCENTS[skill.cover.accent], '封面色相不在白名单：' + skill.cover.accent);
  for (const field of skill.fields) {
    assert.ok(FIELD_KINDS.includes(field.kind), '未登记的字段档位：' + field.key + '=' + field.kind);
    assert.ok(String(field.label).length <= 6, '字段名要极简：' + field.key + '=' + field.label);
  }
});

test('② 账号级签名写死在 brief 里（用户不必每次手粘）', () => {
  const brief = skill.brief;
  assert.match(brief, /不出现正脸、不直视镜头/, '缺少签名纪律');
  assert.match(brief, /不出现任何品牌标识、包装文字或水印/, '缺少无品牌纪律（80 号已定为默认无品牌线）');
  assert.match(brief, /柔光/, '缺少光位纪律');
  assert.match(brief, /留白充足/, '缺少留白纪律（借 paper-signal 的数字约束思路）');
  assert.match(brief, /颗粒与饱和度/, '缺少统一调色的纪律');
  /* ═══ 2026-09-27 批 DB（M1）：**"不出现面部"这条绝对禁令已按实测撤掉**（用户改口径）══════════
     用户原话：「不要露脸这个对于大多数作品确实是这样，**可是他还是会有几个作品其实是有露脸的**，
       模特**有些戴墨镜、有些侧着脸**，他确实没有很正面地展示模特的脸」。
     实测（docs/research/2026-09-27-aura-deep-dive.md §4.3，402 张逐张）：完全没有头 346/402（86.1%），
       但身体局部在场 34.8%（躯干腿 18.4% + 手 16.4%），**正面脸只有 1 张（0.2%）**。
     ⇒ 旧禁令比真人账号更严（用户说的"太绝对"成立），换成**六档人物形态**（见第 ⑨ 条），
       brief 里只留唯一站得住的那条硬约束（不出现正脸、不直视镜头）。
     ⚠️ 这一条测的是"**改了口径**"，不是"删了纪律就不管了" —— 第 ⑨ 条把新的六档也钉住。 */
  assert.doesNotMatch(brief, /不出现面部/, '「不出现面部」这条绝对禁令已按实测撤掉（用户改口径），不该再出现');
  assert.match(brief, /人物形态：\{\{person\}\}/, '人物形态必须由 {{person}} 变量注入（不能写死一档）');
  /* 拼出来的提示词里也必须真的带上（brief 写了但拼装漏了，等于没写） */
  const filled = buildSkillBrief(skill, initialSkillValues(skill));
  assert.match(filled, /不出现任何品牌标识、包装文字或水印/);
  assert.match(filled, /不出现正脸、不直视镜头/);
  assert.match(filled, /画面里不出现任何人物（空镜或纯静物）/, '默认档要真的拼进提示词（界面显示什么就跑什么）');
});

test('③ 色板与概念同源：每个主题意象的 value 都带实测色簇 hex', () => {
  const field = skill.fields.find(f => f.key === 'theme');
  assert.ok(field && field.kind === 'select', '主题意象必须是 select（value 要能带整句）');
  assert.ok(field.options.length >= 20, '母体库至少 20 条（81 号种子表），实际 ' + field.options.length);
  const seen = new Set();
  for (const option of field.options) {
    assert.match(option.value, /概念：/, '值里必须带「概念：」前缀（它是进提示词的那句话）：' + option.value);
    assert.match(option.value, /#[0-9A-Fa-f]{6}/, '值里必须带实测色簇的 hex：' + option.value);
    assert.equal(seen.has(option.value), false, '选项值重复：' + option.value);
    seen.add(option.value);
    assert.ok(String(option.label).trim(), '选项必须有给人看的短名');
  }
  /* 五个实测色簇都要被覆盖到（不能只写一两个色簇） */
  const clusters = ['#94847A', '#8B9EAB', '#BDB6BC', '#BF9A8B', '#765149'];
  const missing = clusters.filter(hex => !field.options.some(o => o.value.toUpperCase().includes(hex)));
  assert.deepEqual(missing, [], '这些实测色簇没有对应的母体：' + missing.join(', '));
});

test('④ 十种画面手法来自一手实测、互不重复，且是**可勾选清单**（批 DC / M2 用户改口径）', () => {
  /* ═══ 2026-09-27 批 DC（M2）：口径从"单选手法字段"改成"可勾选的本篇手法清单" ═════════════════
     用户原话（docs/design/90 §一-2）：「**「一套图片」可以按你说的做吧**」；
     §6.5：「「一套」= 一张一张计价（N 张 = N 张的钱），按钮上写清单价与总额」。
     改前是一次一张、每换一种手法点一次生成（一篇 8~18 张要点 8~18 次）；
     现在是勾 N 种 → 一次触发 N 次生成、按张计费、结果归为一篇。
     ⇒ 手法从 `fields` 里的单选格搬到 **skill.modules**（A+「包含模块」那**同一个**勾选清单控件），
       并且**不许**两处都有（两个手法控件会让人不知道该看哪个）。 */
  const field = skill.fields.find(f => f.key === 'shot');
  assert.equal(field, undefined, '手法不再是一个字段（也不再是单选）—— 它现在只有一份：本篇手法清单');
  assert.equal(skill.modulesTitle, '本篇手法', '清单的标题要说清它是什么（不能沿用"包含模块"）');
  assert.ok(String(skill.modulesNote || '').length >= 8, '清单那句说明要写清"勾几种出几张、按张计价"');
  assert.ok(String(skill.modulesGate || '').includes('勾选'), '一个都不勾时要有一句点名勾选的话');
  const modules = skill.modules;
  assert.ok(Array.isArray(modules) && modules.length >= 10, '手法至少 10 种，实际 ' + (modules ? modules.length : 0));
  const values = modules.map(o => o.value);
  assert.equal(new Set(values).size, values.length, '手法值有重复');
  assert.equal(new Set(modules.map(o => o.name)).size, modules.length, '清单里的名字必须能当勾选键（不许重名）');
  for (const option of modules) {
    /* value = 手法名 + 执行定义（定义要真的是一句话，否则模型不知道这一步怎么拍） */
    assert.match(option.value, /——/, '手法值必须是「名称 —— 执行定义」的形态：' + option.value);
    assert.ok(option.value.length >= 20, '手法定义太短，模型抓不到：' + option.value);
    assert.ok(String(option.name).length <= 6, '手法名要短（门禁要求 ≤6 字）：' + option.name);
    assert.ok(String(option.hint || '').length >= 6, '清单里每一行都要有说明（用户勾之前看得见它是什么）：' + option.name);
  }
});

test('⑤ 必填项都有默认值（否则进子页面 CTA 直接卡住）', () => {
  const seed = initialSkillValues(skill);
  for (const field of skill.fields) {
    if (!field.required) continue;
    const value = seed[field.key];
    const has = Array.isArray(value) ? value.length > 0 : Boolean(String(value || '').trim());
    assert.ok(has, '必填但没有默认值 → 用户一进页面 CTA 就是灰的：' + field.key);
  }
});

test('⑥ 比例默认 3:4（本账号签名是竖版，而 ratioField() 的兜底是 1:1）', () => {
  const seed = initialSkillValues(skill);
  assert.equal(seed.ratio, '3:4', '默认比例必须是 3:4');
  const settings = skillGenerationSettings(skill, seed);
  assert.equal(settings.ratio, '3:4', '下发的比例也必须真的是 3:4（界面显示与下发不许两套）');
  assert.equal(settings.visualSkillId, 'brand-kv', '成套口径要走服务端 brand-kv 那条配方');
});

test('⑦ 出处与对照表都已登记（有硬造的就会被这两条抓住）', () => {
  const source = SKILL_SOURCES[ID];
  assert.ok(source, '没有登记出处：' + ID);
  assert.ok(SOURCE_KINDS.includes(source.kind), '来源类型不在白名单：' + source.kind);
  assert.ok(String(source.note || '').length >= 8, '声明为自研必须写清为什么不需要外部来源');
  const parity = QUANTV_IMAGE_COUNTERPARTS[ID];
  assert.ok(parity, '对照表里没有登记：' + ID);
  assert.equal(parity.counterpart, null);
  assert.ok(String(parity.reason || '').length >= 8, '"没有对应页"也要是明确结论并写清原因');
});

test('⑧ 自证：去掉无品牌纪律必须被判红（否则第 ② 条测的不是它）', () => {
  const broken = skill.brief.replace('画面内不出现任何品牌标识、包装文字或水印；', '');
  assert.ok(!/不出现任何品牌标识、包装文字或水印/.test(broken), '替换没生效，这条自证无效');
  /* 模拟"有人把纪律删了"：此时第 ② 条里那条断言必须抓不到它 —— 证明它守的就是这句话本身 */
  let caught = false;
  try { assert.match(broken, /不出现任何品牌标识、包装文字或水印/); } catch { caught = true; }
  assert.equal(caught, true, '删掉纪律后没被判红 ⇒ 第 ② 条是空转');
});

test('⑨ 人物形态七档：默认 = 实测最高频那一档，且**不做正脸档**（批 DB / M1；0928 加画中画）', () => {
  /* ═══ 这一条守的东西（每条判据都对着一个实测数字）══════════════════════════════════════
     deep-dive §4.3（402 张逐张判定）：
       完全没有人物 206（51.2%）· 躯干/腿 74（18.4%）· 手/手臂 66（16.4%）· 下半脸 17（4.2%）
       · 戴墨镜 13（3.2%）· 背影/后脑 8（2.0%）· **照片里的脸 7（1.7%）**· 侧脸 2（0.5%）
       · **正面脸 1（0.2%）**
     ⇒ 各档 = 把这些形态**合并成可执行的几条**；默认取**唯一过半**的那一档（空镜 51.2%）；
       正脸不做（1/402 不是"手法"，是意外）。
     ⚠️ 2026-09-28 批 DC 续-3 加第七档「画中画」（脸只以画面里的照片/杂志页/广告牌出现）：
        它是"有人在场但不露脸"的**第三种解法**（前两种是身体局部与墨镜），
        与版式层的「宝丽来画中画」同源。 */
  const field = skill.fields.find(f => f.key === 'person');
  assert.ok(field, '缺「人物形态」这一格');
  assert.equal(field.kind, 'segmented', '各档是并列可选，用既有的药丸控件（不新造控件风格）');
  assert.equal(field.required, true, '它是每篇的必选项（不选就不知道该不该出人）');
  assert.equal(field.options.length, 7, '实测归纳出来的七档，实际 ' + field.options.length);
  const labels = field.options.map(option => option.label);
  assert.deepEqual(labels, ['空镜', '手或手臂', '躯干与腿', '下半脸', '戴墨镜', '背影或侧脸', '画中画'],
    '七档与实测归纳的顺序/命名要一致（顺序=频次从高到低；画中画是最后加的那一档）');
  assert.equal(new Set(field.options.map(option => option.value)).size, 7, '各档的值不许重复');
  for (const option of field.options) {
    assert.ok(String(option.label).length <= 6, '档位名要短（门禁 ① 要求 ≤6 字）：' + option.label);
    assert.ok(option.value.length >= 12, '每一档的 value 都要是能执行的整句（模型靠它知道人怎么出现）：' + option.value);
    /* 「不出现正脸」是**整篇纪律**里的硬约束（实测 1/402），所以各档 value 里出现"正脸"只能在
       这条禁令的语境里（`不出现正脸` / `未正对镜头`），不许出现"可以露正脸"这类档位。 */
    assert.doesNotMatch(option.value, /(可以|允许|要)(出现)?正脸|正面脸/, '正脸档不许有 —— 实测只有 1/402（0.2%），那是意外不是手法');
  }
  const seed = initialSkillValues(skill);
  assert.equal(seed.person, field.options[0].value, '默认档必须是实测最高频那一档（列表第一档 = 空镜 206/402）');
  const filled = buildSkillBrief(skill, seed);
  assert.match(filled, /人物形态：画面里不出现任何人物/, '默认档必须真的进提示词');
  /* 自证：把默认档换成一个不存在的值时，上面那条"默认进提示词"的判据必须抓到 */
  let caught = false;
  try { assert.match(buildSkillBrief(skill, { person: '' }), /人物形态：画面里不出现任何人物/); } catch { caught = true; }
  assert.equal(caught, true, '人物形态为空时没被判红 ⇒ 上面那条测的不是它');
});
