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
import { buildSkillBrief, buildSkillRequest, initialSkillValues, skillGenerationSettings, skillPointsEstimate, skillShotMix } from '../src/skills/skillRun.js';
import { readFileSync } from 'node:fs';
/** 读源码（剥掉注释，避免"断言的字符串出现在我自己的解释里"那种空判）。 */
const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
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
  /* ⚠️ 2026-09-29 批 DC 续-16：`person` 不再是**字段**（逐张了），所以
     `initialSkillValues` 里没有它，`{{person}}` 拼出来是空串。
     ⇒ 这一条改成验**逐张**那条链：给一份 shotPerson，提示词里必须真的带上那一档。
     原来的「默认档要真的拼进提示词」守的是"全篇一档"，而那正是用户推翻掉的东西。 */
  assert.doesNotMatch(filled, /人物形态：；/, '没有逐张人物形态时那一段是空的（由下面那条补上真实判据）');
  const oneShot = buildSkillBrief(skill, { ...initialSkillValues(skill), person: '人物只出现手或手臂，头部与其余身体全部出画' });
  assert.match(oneShot, /人物形态：人物只出现手或手臂/, 'brief 拼装认 {{person}}（逐张那一档要真的进提示词）');
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
  /* ═══ 2026-09-29 批 DC 续-16：`person` **不再是字段**，改成清单里逐张一档 ═══════════════════════
     用户 2026-09-29 逐字：「那是不是它出来的所有内容都会包含这些人物形态……**那出来的作品岂不都
     千篇一律了？**」—— 改前这条守的正是相反的东西（`kind:'segmented'` + `required` 的全篇一档）。
     实测：39 篇多图笔记里 **34 篇（87.2%）篇内混用**人物形态，
     剩下 5 篇统一的**全部是 100% 空镜的纯静物篇** —— 没有任何一篇是"每张同一种"。
     ⇒ 七档本身一个字没改（还是那七档、还是那个顺序），改的是**它住在哪**：
        住在每一行清单里，由 `shotMix` 权重自动分配、用户可逐行改。 */
  const field = skill.fields.find(f => f.key === 'person');
  assert.equal(field, undefined,
    '「人物形态」不许再是 `fields` 里的一格 —— 一进 fields 就被 groupFields 排成全篇共用的控件');
  assert.equal(skill.modulesPerson, true, '要声明 modulesPerson（清单每行加那颗下拉）');
  assert.ok(skill.shotMix && skill.shotMix.person, '要声明 shotMix.person 的实测权重');
  assert.equal(skill.modulesSeries, true, '连拍那颗药丸仍然在（批 DC 续-15）');

  /* 七档的**内容**校验改到 `shotMix` 的键上（选项文案仍取 CONCEPT_PERSON_OPTIONS 那一个真源）。 */
  const PAGE = read('src/pages/MediaCreation/index.jsx');
  assert.match(PAGE, /options: CONCEPT_PERSON_OPTIONS\(\)/, '行内那颗下拉的选项仍取那一个真源，不复制一份档位文案');
  const mixKeys = Object.keys(skill.shotMix.person);
  const personOptions = (PAGE.match(/CONCEPT_PERSON_OPTIONS\(\)/g) || []).length;
  assert.ok(personOptions >= 1, '页面确实用了 CONCEPT_PERSON_OPTIONS');
  /* 权重和 = 那一档的实测占比；合计 97.1（侧脸 0.5 + 正脸 0.2 我们不做那两档） */
  const total = Object.values(skill.shotMix.person).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 97.1) < 0.05, '权重合计应约等于 97.1%（= 100 减去我们不做的侧脸 0.5 与正脸 0.2），实测 ' + total);
  assert.equal(mixKeys.length, 7, '七档都要有实测权重，实际 ' + mixKeys.length);
  assert.equal(new Set(mixKeys).size, 7, '各档的权重键不许重复');
  const EMPTY = '画面里不出现任何人物（空镜或纯静物）';
  assert.equal(skill.shotMix.person[EMPTY], 51.2, '空镜 = 206/402 = 51.2%（实测最高频那一档）');
  for (const [value, weight] of Object.entries(skill.shotMix.person)) {
    assert.ok(weight > 0 && weight < 60, '权重必须落在实测占比上，不许凭感觉写：' + value + ' = ' + weight);
    assert.ok(value.length >= 12, '每一档的 value 都要是能执行的整句（模型靠它知道人怎么出现）：' + value);
    assert.doesNotMatch(value, /(可以|允许|要)(出现)?正脸|正面脸/, '正脸档不许有 —— 实测只有 1/402（0.2%），那是意外不是手法');
  }
  /* 逐张分配：必须确定性、必须按权重、必须逐张不同（这是本条门禁真正要守的东西）。 */
  const names = skill.modules.map(m => m.name);
  for (const n of [4, 6, 10]) {
    const first = skillShotMix(skill, names.slice(0, n));
    const again = skillShotMix(skill, names.slice(0, n));
    assert.deepEqual(first, again, 'N=' + n + '：同样的输入必须给逐字相同的结果（历史还原/断线补跑靠它）');
    assert.equal(first.length, n, 'N=' + n + '：要分出 ' + n + ' 档');
    assert.ok(first.every(row => row.person), 'N=' + n + '：每一行都要分到一档，不许有空串');
    assert.ok(new Set(first.map(row => row.person)).size >= 3,
      'N=' + n + '：至少要出现 3 种不同形态（实测 87.2% 的篇是混用的）');
  }
  /* 逐张真的进了提示词（brief 认 {{person}}，而它按第几张取）。
     ⚠️ 用 4 张而不是 3 张：N=3 时按实测权重正确分配出来是「空镜 躯干 空镜」，
     只有两种 —— 断言"三张各不相同"会把**正确的**分配判红。要判的是"不是全篇一档"。 */
  const perShot = skillShotMix(skill, names.slice(0, 4));
  const prompts = perShot.map(row => buildSkillBrief(skill, { ...initialSkillValues(skill), person: row.person }));
  assert.ok(prompts.every(p => /人物形态：/.test(p)), '每一张都要真的带上「人物形态：」');
  assert.ok(new Set(prompts).size >= 2,
    '逐张分配必须产出**不止一种**形态（全篇一档就是用户说的"千篇一律"）：' + perShot.map(r => r.person.slice(0, 6)).join(' / '));
});

test('⑩ 模型选择：8 档来自目录、默认 GPT Image 2，价格随模型走、分辨率随模型夹取（0928 开放）', () => {
  /* 用户原话（逐字）：「**那现在最火的不是 image2.5 吗，我不能用上吗，我们现在有支持吗**」。
     GPT Image 2.5（Sunburst/Flare）9-13 就接通了（上游 gpt-image-2.5-sunburst/flare-*、
     计费 SKU/账目标签齐全），此前只在别的页面可选 —— 对这一页是"做出来了却不给用"。
     现在**开放**：默认仍是 GPT Image 2（通用主力 + 全场最便宜），选 2.5 时 CTA 积分自动变。 */
  const field = skill.fields.find(item => item.key === 'imageModel');
  assert.ok(field, '缺「模型选择」这一格');
  assert.equal(field.kind, 'select', '模型是长清单，用下拉（不新造控件）');
  assert.equal(field.required, true, '它是必填（有默认值，不会卡 CTA）');
  assert.equal(field.default, 'image2', '默认仍是 GPT Image 2（通用主力 + 全场最便宜的那一档）');
  assert.ok(field.options.some(option => option.value === 'image2-5-sunburst'), '2.5 旗舰（Sunburst）必须在场');
  assert.ok(field.options.some(option => option.value === 'image2-5-flare'), '2.5 极速（Flare）必须在场');
  assert.equal(field.options.length, 8, '选项 = 目录里的全部可选拍档（不许手写第二份名单）');
  /* 价格随模型走：skillPointsEstimate 读的就是 settings.imageModel（与 CTA 同一份） */
  const base = { ...initialSkillValues(skill), count: 1 };
  const gpt2 = skillPointsEstimate(skill, base);
  const sunburst = skillPointsEstimate(skill, { ...base, imageModel: 'image2-5-sunburst' });
  assert.equal(gpt2, 1, 'GPT Image 2 @2K = 1 积分/张');
  assert.equal(sunburst, 1.5, '2.5 Sunburst @2K = 1.5 积分/张（目录价，按钮上的数自动跟着变）');
  /* 分辨率随模型夹取：Midjourney 只有 1K/2K —— optionsFrom 指向目录那张映射表 */
  const clarity = skill.fields.find(item => item.key === 'clarity');
  assert.deepEqual(clarity.optionsFrom, { key: 'imageModel', map: { midjourney: ['1K', '2K'] } },
    '分辨率档必须跟着模型夹取（否则会给出"显示 4K、按 2K 跑"的账实不符）');
  /* 模型不进提示词（它是工程参数；混模型才是要防的事 —— 由"一篇同模型"保证） */
  const brief = buildSkillRequest(skill, { ...base, imageModel: 'image2-5-sunburst' }, { runId: 'r' }).prompt;
  assert.doesNotMatch(brief, /Sunburst|Flare|模型/, '模型名不许漏进提示词');
  /* 请求里带的是选中的模型（服务端按它路由到 gpt-image-2.5-*）—— buildSkillRequest 把它放在顶层 */
  assert.equal(buildSkillRequest(skill, { ...base, imageModel: 'image2-5-sunburst' }, { runId: 'r' })
    .imageModel, 'image2-5-sunburst', '选中的模型要真的下发');
});
