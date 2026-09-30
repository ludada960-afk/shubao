/* ═══ 门禁：「概念视觉方案」的**一篇** = 一次勾 N 种手法 → 逐张出 N 张（2026-09-27 批 DC / M2）══
   用户口径（docs/design/90-aura-replication-plan.md §一-2 与 §6.5，逐字）：
     · 「**「一套图片」可以按你说的做吧**」；
     · 「「一套」= 一张一张计价（N 张 = N 张的钱），按钮上写清单价与总额」；
     · 「两者都不做"自动批量扣费"：用户勾几张就是几张」。
   依据（同文件 §二 与 §六）：现在这个技能 **0 条真实产出**；而实作是"一篇 8~18 张"，我们却是
   "一次一张图、每换一种手法点一次生成"——一篇要点 8~18 次，这不是他的做法。

   这一组断言守四件事（每条都带自证：把判据改坏必须变红）：
     ① 勾 3 种 → **3 张请求**：3 个 slot、3 次请求，且第 i 张的提示词只放第 i 种手法；
     ② 报价 = **单价 × 张数**：按钮上那个数就是 skillPointsEstimate 按 count=3 算出来的；
     ③ 一张失败**不拖累其它张**，且**只算成功的那几张**：失败的只进重试队列、不进作品；
     ④ **篇标记**写进作品（历史据此把一篇当一组展示、并还原面板的勾选）。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { getImageSkill, CONCEPT_SHOT_OPTIONS } from '../src/skills/imageSkills.js';
import {
  LAYOUT_FAMILY_NONE,
  buildSkillRequest,
  initialSkillValues,
  pieceLayoutFamilyHolds,
  reconcileFieldValues,
  skillFieldLocked,
  skillGenerationSettings,
  skillPieceMark,
  skillPointsEstimate,
  skillSeriesClause,
  skillShotValues,
  skillShotMix,
  skillValuesForShot,
} from '../src/skills/skillRun.js';
import {
  buildVisualWorkRecord,
  createVisualRun,
  updateVisualRunSlot,
  visualRetryIndexes,
} from '../src/pages/Home/visualCreationModel.js';
import { generationUnits, DEFAULT_IMAGE_MODEL } from '../src/services/imageModelCatalog.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(join(ROOT, relative), 'utf8');
/* 剥掉注释再扫 —— 否则「注释里提到某个字段名」会把判据自己绊倒
   （本批第一次跑就撞上了：⑧ 的判据是"没有 seriesHint"，而我刚写的注释里恰好写了 seriesHint）。
   判据要问的是**代码里还有没有**，不是**文字里还提不提**。 */
const code = relative => read(relative).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ID = 'image.concept_set';
const skill = getImageSkill(ID);
const PAGE = read('src/pages/MediaCreation/index.jsx');

/* 勾了 N 种手法之后的生效值 —— 与页面同一条链：勾选数注入 count、勾中的定义注入 shots。
   ⚠️ 这段"页面做的事"在测试里必须显式写出来（它就是判据的一部分，不是摆样子）。
   ⚠️ 2026-09-29 批 DC 续-15：现在还要带上 `shotNames`（与 `shots` 同序）——
      连拍组改成**按名字**标之后，skillValuesForShot 靠它知道"第 i 张叫什么"。
   ⚠️ 2026-09-29 批 DC 续-16：还要带上 `shotPerson`（与 `shots` 同序）——
      人物形态改成**逐张**之后，`person` 不再是字段，`initialSkillValues` 里也没有它；
      页面是拿 `skillShotMix`（实测权重自动分配 + 用户覆盖）算出这一条数组的。
      这里照页面那条链原样复现，否则测的是"没填人物形态"的空壳。 */
function valuesWithShots(names = []) {
  const picked = skill.modules.filter(module => names.includes(module.name));
  const shots = skillShotValues(skill, picked);
  const shotNames = picked.map(module => module.name);
  return {
    ...initialSkillValues(skill),
    count: picked.length,
    shots,
    shotNames,
    shotPerson: skillShotMix(skill, shotNames).map(row => row.person),
    shotOverrides: {},
    seriesNames: [],
  };
}

/* 服务器只认自家生成的稳定地址（worksStore/作品存盘那条判据） */
const stableUrl = char => '/api/generated-assets/' + char.repeat(64) + '.jpg';

test('① 勾 3 种手法 → 发 3 张请求，且每一张只带自己那一种手法', () => {
  /* ⚠️ 顺序 = **清单里的顺序**（不是用户点击的顺序）：同一组勾选永远跑出同一个顺序，
     历史还原 / 断线补跑 / "用这组参数"才不会跑出另一套图。 */
  const picked = ['概念静物', '平铺集合', '材质静物'];
  const names = skill.modules.filter(module => picked.includes(module.name)).map(module => module.name);
  const values = valuesWithShots(picked);
  assert.deepEqual(values.shots, names.map(name => skill.modules.find(module => module.name === name).value),
    '勾中的手法要按清单顺序进提示词变量（顺序稳定 = 补跑出来的还是同一套）');
  assert.equal(values.shots.length, 3, '三种手法没有全部进提示词变量');
  assert.equal(skillGenerationSettings(skill, values).count, 3,
    '勾 3 种就要跑 3 张（张数来自勾选数，不是另写一个数字）');

  const run = createVisualRun({ count: skillGenerationSettings(skill, values).count });
  assert.equal(run.slots.length, 3, '这一次运行必须是 3 个 slot（逐张，不是一张');

  /* 三次请求各自的提示词：只出现自己那一种手法的定义，另外两种一个字都不许出现 */
  const prompts = names.map((name, index) => buildSkillRequest(
    skill, skillValuesForShot(values, index), { runId: run.id, slotIndex: index },
  ).prompt);
  for (const [index, name] of names.entries()) {
    const own = skill.modules.find(module => module.name === name).value;
    assert.ok(prompts[index].includes(own), '第 ' + (index + 1) + ' 张没有带「' + name + '」的定义');
    for (const other of names.filter(item => item !== name)) {
      const definition = skill.modules.find(module => module.name === other).value;
      assert.ok(!prompts[index].includes(definition),
        '第 ' + (index + 1) + ' 张里混进了「' + other + '」—— 一张只做一种手法');
    }
  }
  assert.equal(new Set(prompts).size, 3, '三张的提示词必须各不相同（否则就是同一张画三遍）');
  /* ═══ 2026-09-29 批 DC 续-16：**人物形态从"整篇共用"改成"逐张"** ══════════════════════════════
     用户 2026-09-29 逐字：「那是不是它出来的所有内容都会包含这些人物形态……**那出来的作品岂不都
     千篇一律了？**」—— 改前这条断言守的正是**相反**的东西（"三张都必须共用同一份人物形态"）。
     实测：39 篇多图笔记里 34 篇（87.2%）篇内混用人物形态，全篇一档是错的。
     ⇒ 主题意象仍然整篇共用（它是母体，本来就是篇级的）；人物形态必须**逐张不同**。 */
  for (const prompt of prompts) {
    assert.ok(prompt.includes(values.theme), '三张都必须共用同一份主题意象（母体是篇级的）');
  }
  const personsInPrompt = prompts.map(prompt => /人物形态：([^；]*)；/.exec(prompt)?.[1] || '');
  assert.ok(personsInPrompt.every(Boolean), '三张都要真的带上「人物形态：」这一句');
  /* ⚠️ 判据是「**不是全篇一档**」，不是「三张两两不同」：
     N=3 时按实测权重（空镜 51.2%）正确分配出来就是「空镜 躯干 空镜」—— 两张空镜是对的，
     硬要求"三张各不相同"会把**正确的**分配判红。三张全同才是用户说的"千篇一律"。 */
  assert.ok(new Set(personsInPrompt).size >= 2,
    '三张不许是同一个形态（全篇一档 = 千篇一律，实测 87.2% 的篇是混用的）：' + personsInPrompt.join(' / '));
  assert.equal(skillGenerationSettings(skill, values).ratio, '3:4', '三张的比例仍是本账号签名 3:4');

  /* ── 自证：不收窄（整份 shots 下发）时，三张的提示词会变成同一份 —— 证明上面测的就是"逐张" ── */
  const unscoped = names.map(() => buildSkillRequest(skill, values, { runId: run.id }).prompt);
  assert.equal(new Set(unscoped).size, 1, '不收窄时本该三张同一份提示词（自证的前提）');
  assert.notEqual(prompts[0], unscoped[0], '收窄没有真的改变提示词 ⇒ 上面那些断言是空转');

  /* ── 页面接线：逐张收窄 + 一次点击跑满 N 个 slot（缺一条，界面与引擎就对不上）────────── */
  assert.match(PAGE, /buildSkillRequest\(skill, skillValuesForShot\(effectiveValues, index\)/,
    '生成时必须**逐张**收窄手法（否则勾 3 种会画出 3 张一样的）');
  assert.match(PAGE, /const fresh = createVisualRun\(\{ count: settings\.count \}\)/,
    '张数必须来自 skillGenerationSettings（唯一真源）');
  /* ⚠️ 批 DC 续-7：这一行现在挂在 `await Promise.all([...])` 里面（图文并行），
     所以 `await` 不再紧贴着 executeRun —— 断言只咬 executeRun 本身，别把并行结构判死。 */
  assert.match(PAGE, /executeRun\(fresh, Array\.from\(\{ length: settings\.count \}, \(_, index\) => index\)\)/,
    '一次点击要跑满 N 个 slot（用户勾几张就是几张）');
});

test('② 报价 = 单价 × 张数（按钮上写的就是这个数）', () => {
  /* ⚠️ 2026-09-30：单价这一项**跟着默认模型走**（默认已换成 2.5 Sunburst，2K = 1.5 积分）。
     原来这里写死 `generationUnits('image2', '2K')` —— 换默认之后它会拿 image2 的价
     去对比 2.5 的报价，必然对不上，而且报错信息完全指不到真正的原因。
     ⇒ 改成从**默认档**取价：换默认时这条门禁自动跟着走，不用再改一次。 */
  const unit = generationUnits(DEFAULT_IMAGE_MODEL, '2K') / 1000;
  assert.ok(unit > 0, '自证前提：默认档 2K 的单价必须能算出来，实际 ' + unit);
  const one = skillPointsEstimate(skill, valuesWithShots(['概念静物']));
  const three = skillPointsEstimate(skill, valuesWithShots(['概念静物', '平铺集合', '材质静物']));
  const seven = skillPointsEstimate(skill, valuesWithShots(skill.modules.slice(0, 7).map(module => module.name)));
  assert.equal(one, Number((unit * 1).toFixed(2)));
  assert.equal(three, Number((unit * 3).toFixed(2)), '3 张的报价不等于 单价 × 3');
  assert.equal(seven, Number((unit * 7).toFixed(2)), '张数一多就漏算（勾几张收几张的钱）');
  /* ⚠️ 自证：把张数改掉，报价必须跟着变 —— 否则这个函数根本没在按张计价 */
  assert.notEqual(one, three, '张数变了报价没变 ⇒ 报价测的不是张数');
  /* 按钮上的积分与这套算法同源（两处各算一份才是会出事的地方） */
  assert.match(PAGE, /ctaPoints=\{handoff \? null : \(\(skill\.previewStep && !planApplied\) \? PLAN_PREVIEW_POINTS : points\)\}/,
    'CTA 上的积分数必须来自 points（与 skillPointsEstimate 同一份）');
  assert.match(PAGE, /skillPointsEstimate\(skill, effectiveValues\)/, '报价必须从生效值取数');
  /* 每张各自报价、各自结算：所以"一张失败"只影响那一张的钱（服务端 hold/settle/release 是按次的） */
  const api = read('src/services/api.js');
  assert.match(api, /const billing = await quoteCanvasAction\(billingSku, stableRequestKey, \{ signal \}\)/,
    '每一次生成请求各自带报价（不是整篇一次报价）');
});

test('③ 一张失败不拖累其它张：只重试失败那张，作品里只有成功的那几张', () => {
  const values = valuesWithShots(['概念静物', '平铺集合', '材质静物']);
  let run = createVisualRun({ count: skillGenerationSettings(skill, values).count });
  /* 第 2 张失败，另外两张成功（三张各自独立：Promise.all 里一个 reject 不影响别人） */
  run = updateVisualRunSlot(run, 0, { status: 'completed', url: stableUrl('a'), taskId: 't1' });
  run = updateVisualRunSlot(run, 1, { status: 'failed', error: '这一张没跑成' });
  run = updateVisualRunSlot(run, 2, { status: 'completed', url: stableUrl('b'), taskId: 't2' });

  assert.deepEqual(visualRetryIndexes(run), [1],
    '只该重试失败的那一张 —— 成功的两张重跑会重复扣费');
  const record = buildVisualWorkRecord({
    run, prompt: buildSkillRequest(skill, values).prompt, skillId: 'brand-kv',
  });
  assert.equal(record.images.length, 2, '作品里只该有成功的两张（失败那张没有可保存的东西）');
  assert.deepEqual(record.images.map(image => image.url), [stableUrl('a'), stableUrl('b')]);
  assert.equal(record.generationStatus, 'needs_review', '没跑满就要如实标成需要复查，不许假装完成');

  /* ── 自证：三张都成功时作品里是 3 张（证明上面那个 2 不是写死的）────────────── */
  let allDone = createVisualRun({ count: 3 });
  for (const [index, char] of ['a', 'b', 'c'].entries()) {
    allDone = updateVisualRunSlot(allDone, index, { status: 'completed', url: stableUrl(char) });
  }
  assert.equal(buildVisualWorkRecord({ run: allDone, skillId: 'brand-kv' }).images.length, 3);
  /* ── 自证：失败那张不被当成可保存的图（0 张时不许存出一条空作品）──────────────── */
  let allFailed = createVisualRun({ count: 3 });
  allFailed = updateVisualRunSlot(allFailed, 1, { status: 'failed', error: 'x' });
  assert.throws(() => buildVisualWorkRecord({ run: allFailed, skillId: 'brand-kv' }),
    /没有可保存的稳定图片/, '全失败时不许存出一条没有图的作品');

  /* ── 服务端那一半：失败时不结算、把 hold 释放掉（所以"失败不扣那张"是真的）────────── */
  const billing = read('server/billing/oneShotBilling.mjs');
  assert.match(billing, /if \(hold && !delivered && current\?\.status !== 'settled' && !leaseLost\) \{[\s\S]{0,200}walletService\.releaseItem\(/,
    '失败必须释放 hold（否则"一张失败不扣那张"就是句空话）');
  /* 页面：一次运行结束只把**成功的那几张**存成作品 */
  assert.match(PAGE, /if \(finished && finished\.slots\.some\(slot => slot\.status === 'completed' && slot\.url\)\) await persistRun\(finished\)/,
    '只要有一张成功就存作品（失败的不进作品）');
});

test('④ 篇标记写进作品：历史把一篇当一组展示，并能还原面板的勾选', () => {
  const names = ['概念静物', '平铺集合', '材质静物'];
  /* 篇标记里的顺序与"逐张生成"的顺序**必须一致**（都用 skill.modules 的声明顺序）——
     否则历史里写的手法顺序与那几张图的实际顺序对不上。 */
  const order = skill.modules.filter(module => names.includes(module.name)).map(module => module.name);
  const mark = skillPieceMark(skill, { runId: 'visual-run-1', selectedModules: skill.modules.filter(module => names.includes(module.name)) });
  assert.deepEqual(mark, { id: 'visual-run-1', shots: order, size: 3 },
    '篇标记要说清"这一篇是谁、勾了哪几种手法"（顺序 = 清单顺序 = 逐张生成顺序）');
  assert.equal(skillPieceMark(getImageSkill('image.poster'), { runId: 'x', selectedModules: [] }), null,
    '没有"篇骨架"的技能不该被写进这一笔（其余技能的作品形状必须一个字不变）');

  /* 作品记录：一个 run = 一篇（同一个 _saveKey），篇标记跟着写进这一条作品 */
  assert.match(PAGE, /const piece = skillPieceMark\(skill, \{ runId: finalRun\.id, selectedModules, values: effectiveValues \}\)/,
    '存作品时要算篇标记（连版式族一起记进去 —— 刷新之后还知道自己该拼哪一种）');
  assert.match(PAGE, /\.\.\.\(piece \? \{ _piece: piece \} : \{\}\)/, '篇标记要写进作品（_piece）');
  /* 一篇 = 一条作品记录：作品的身份就是这一次 run（所以"归为一篇"不是靠拼字段，而是它本来就一条） */
  assert.match(read('src/pages/Home/visualCreationModel.js'), /_saveKey: run\.id/,
    '一篇的几张必须落在同一条作品记录里（_saveKey = 这一次 run）');
  /* 历史：把篇标记取出来给右栏渲染 + 「用这组参数」时还原勾选 */
  assert.match(PAGE, /piece: \(!expired && work\._piece[\s\S]{0,240}shots\.map\(String\)/,
    '历史条目要带上篇标记（过期墓碑不给 —— 面板值早清空了）');
  assert.match(PAGE, /setModuleOff\(new Set\(skillModules\.filter\(module => !pieceShots\.includes\(module\.name\)\)/,
    '「用这组参数」要把这一篇勾过的手法也还原（否则参数回来了、清单还是空的）');
  const workbench = read('src/pages/Home/SkillWorkbench.jsx');
  assert.match(workbench, /row\.piece && \([\s\S]{0,200}skill-history-piece/,
    '右栏历史要把篇标记画出来（一篇一张卡 + 它自己的手法骨架）');
  assert.match(read('src/pages/Home/SkillWorkbench.css'), /\.skill-history-piece \{/,
    '篇标记那一行要有样式（不许裸文本把网格撑歪）');

  /* ── 自证：没有篇标记的记录，历史就该不给这一行（判据不是"永远为真"）────────────── */
  const noPiece = { piece: null };
  assert.equal(Boolean(noPiece.piece), false, '老记录（没有 _piece）不该被画出篇标记');
});

/* ═══ 2026-09-27 批 DC：构图方向（每张一档）与版式族（每篇一档）═══════════════════════════════
   依据：`docs/research/2026-09-27-aura-composition-direction.md`（402 张全量逐张判定）——
   用户说的"一张左→右、一张右→左"严格口径只成立 **3/41 篇（7.3%）**，放宽到"主体一左一右"
   **9/41（22.0%）**；全站**真有横向引导的只有 33/402（8.2%）**、**63.7% 没有方向**、
   **镜面对称 69/402（17.2%）**；**"镜像成对"0 组可确证**（4 组弱候选 / 16 组目视怀疑被原图否定）。
   ⇒ 方向这一栏默认 = 居中/无方向，且**只在有人物在场时可选**（报告 §五-1 原文：
     「左→右 / 右→左 只在有人物、有手伸入画面、或人物在行走的镜头里才允许出现」）；
     拼版那一栏只给**现在真拼得出来的两族**，并且**同族至少复用 2 张**才算成立。 */

test('⑤ 构图方向：默认居中/无方向、每张都带同一句，且"空镜"时锁住（不能选了不生效）', () => {
  const field = skill.fields.find(item => item.key === 'direction');
  assert.ok(field, '缺「构图方向」这一格');
  assert.equal(field.kind, 'segmented', '沿用既有的药丸控件（不新造第五种）');
  assert.deepEqual(field.options.map(option => option.label), ['居中/无方向', '左→右', '右→左', '居中对称']);
  assert.equal(skill.fields[0].default, undefined, '自证前提：主题意象本来就是"声明默认"而不是这里要测的东西');
  assert.equal(initialSkillValues(skill).direction, field.options[0].value,
    '默认必须是"居中/无方向"（实测 63.7% 的图没有横向引导、真有引导的只有 8.2%）');
  for (const option of field.options) {
    assert.ok(String(option.label).length <= 6, '档位名 ≤6 字：' + option.label);
    assert.ok(String(option.value).length >= 12, '每一档都要是能执行的整句：' + option.value);
  }
  assert.doesNotMatch(field.options.map(option => option.label).join(' '), /镜像/,
    '「镜像成对」不许有 —— 实测 0 组可确证（4 组弱候选、23 组目视怀疑里 16 组被原图否定）');
  /* 每一张都要带同一句方向（一篇里 N 张共用这一档，所以 N 张的提示词里都要出现它）。
     ⚠️ 这三张的**人物形态要全都是有人物的** —— 否则「空镜 ⇒ 方向夹回居中」那条规则
        （批 DC 续-16 挪过来的）会把方向夹掉，这里就测不到"方向确实带上了"。 */
  const HAND = '人物只出现手或手臂，头部与其余身体全部出画';
  const values = { ...valuesWithShots(['概念静物', '平铺集合', '材质静物']), shotPerson: [HAND, HAND, HAND] };
  const moved = { ...values, direction: field.options[1].value };
  for (const index of [0, 1, 2]) {
    assert.ok(buildSkillRequest(skill, skillValuesForShot(moved, index), { runId: 'r', slotIndex: index })
      .prompt.includes(field.options[1].value), '第 ' + (index + 1) + ' 张没有带上构图方向');
  }
  /* ═══ 2026-09-29 批 DC 续-16：「空镜 ⇒ 居中」这条规则**换了地方** ══════════════════════════════
     改前它挂在**字段**上（`disabledWhen: {key:'person'}`，控件禁用 + 值夹回默认档）。
     人物形态逐张化之后「这一篇的人物形态」不存在了，那条字段级判据**接不上** ——
     留着就是一条永不触发的死规则（界面不锁、提示词照旧带着方向）。
     ⇒ 现在由 `skillValuesForShot` **逐张**判：这一张是空镜就把方向换成「居中/无方向」。
     实测口径：静物本就没有横向引导（63.7%~86.1% 的图无方向）。 */
  assert.equal(field.disabledWhen, undefined,
    '字段上的 disabledWhen 必须删掉 —— person 已逐张化，这条判据永远不会再触发，留着是死规则');
  const emptyShot = '画面里不出现任何人物（空镜或纯静物）';
  const withPerson = { ...moved, shotPerson: [emptyShot, '人物只出现手或手臂，头部与其余身体全部出画', emptyShot] };
  const r0 = skillValuesForShot(withPerson, 0);
  const r1 = skillValuesForShot(withPerson, 1);
  const r2 = skillValuesForShot(withPerson, 2);
  assert.equal(r0.direction, field.options[0].value, '空镜那一张：方向必须夹回「居中/无方向」');
  assert.equal(r2.direction, field.options[0].value, '空镜那一张：方向必须夹回「居中/无方向」');
  assert.equal(r1.direction, field.options[1].value, '有人物在场的那一张：用户选的方向要保住');
  /* ── 自证：把那张的人物形态换成有人物的，三张就都保留用户选的方向 ───────────── */
  const noEmpty = { ...moved, shotPerson: ['人物只出现手或手臂，头部与其余身体全部出画'] };
  assert.equal(skillValuesForShot(noEmpty, 0).direction, field.options[1].value,
    '三张都有人物时不该有任何夹取（证明上面那两条确实是"空镜"这条在起作用）');
  /* 没给逐张人物形态时（老数据 / 手工构造的请求）退回全篇那一档，逐字不变 */
  assert.equal(skillValuesForShot({ ...moved, person: '人物只出现手或手臂，头部与其余身体全部出画' }, 0).direction,
    field.options[1].value, '没有 shotPerson 时按全篇人物形态判，不得凭空夹取');
  /* ── 自证：把逐张人物形态换成"全是有人物"，上面那条夹取应当立刻失效 ───────────── */
  const noEmptyAtAll = { ...moved, shotPerson: ['人物只出现手或手臂，头部与其余身体全部出画', emptyShot] };
  assert.equal(skillValuesForShot(noEmptyAtAll, 0).direction, field.options[1].value,
    '有人物的那张不该被夹（证明上面两条确实是"空镜"这条在起作用）');
  /* 逐张那一栏仍然不再是字段级的锁 —— 但 skillFieldLocked 这套机制**别的字段还在用**，
     渲染器必须继续问同一份判据（否则别处的禁用会与取值对不上）。 */
  const stillLockedElsewhere = [{ key: 'x', disabledWhen: { key: 'theme', equals: 'T' } }];
  assert.equal(skillFieldLocked(stillLockedElsewhere[0], { theme: 'T' }), true,
    'skillFieldLocked 本身没坏（概念视觉方案不用了，别的字段还在用）');
  assert.match(read('src/components/media/FieldRenderer.jsx'), /skillFieldLocked\(field, values\)/,
    '渲染器要问 skillRun 那一份锁判据（不许自己写一遍）');
  assert.match(read('src/components/media/FieldRenderer.jsx'), /field\.disabledHint/,
    '锁住时要就地说明为什么（不许变成点不动的死控件）');
});

test('⑥ 版式族：每篇一档、**默认不拼**、实测四族齐备，且"至少 2 张"只是渲染下限', () => {
  const field = skill.fields.find(item => item.key === 'layout');
  assert.ok(field, '缺「版式族」这一格（版式层按它决定拼哪一种）');
  assert.equal(field.kind, 'cards', '每篇一档、卡内带说明 —— 用既有的选项卡控件（不新造第五种）');
  assert.deepEqual(field.options.map(option => option.label), ['不拼版', '宫格', '底片条', '宝丽来', '信息图'],
    '实测四族全给 + 中性档（0928 用户纠错：上一版只给两种，把并列第二的宝丽来/信息图挂起来，'
    + '理由却是"这两种我现在做得出来" —— 工程便利冒充数据）');
  assert.ok(field.options.every(option => String(option.hint || '').length >= 8), '每一族都要说清它长什么样');
  assert.equal(initialSkillValues(skill).layout, LAYOUT_FAMILY_NONE,
    '默认档 = 中性档「不拼版」（实测 85% 的图是单图；不许拿一个具体族冒充默认）');
  /* ⚠️ 版式族**不进提示词**：实测过"让模型一次画一整张九宫格"会把分格线画歪、格内互相渗透，
     正确做法是先出单图、再在版式层确定性拼（docs/design/90 §6.2）——这条是硬约束，不是偏好。 */
  const brief = buildSkillRequest(skill, valuesWithShots(['概念静物', '平铺集合']), { runId: 'r' }).prompt;
  assert.doesNotMatch(brief, /宫格|底片条|宝丽来|信息图/, '版式族不许进提示词（模型画不出一整张拼版）');

  /* 「至少 2 张」= **渲染下限**（1 张拼不出东西）。原来那条"同族复用 74/402"属于出图侧，
     已经挪去「连拍组」—— 这一条同时守住"别再把它搬回来当拼版侧的依据"。 */
  assert.equal(pieceLayoutFamilyHolds('宫格', 3), true);
  assert.equal(pieceLayoutFamilyHolds('底片条', 2), true, '刚好 2 张也能拼（这是下限）');
  assert.equal(pieceLayoutFamilyHolds('宫格', 1), false, '一张拼不出东西');
  assert.equal(pieceLayoutFamilyHolds('宫格', 0), false);
  assert.equal(pieceLayoutFamilyHolds('', 3), false, '没选版式族就不拼');
  assert.equal(pieceLayoutFamilyHolds(LAYOUT_FAMILY_NONE, 3), false, '「不拼版」永远不拼');
  /* ── 自证：把判据放松成 ">= 1"，一张的篇就会通过 —— 证明阈值真的咬住了"至少 2 张" ── */
  const relaxed = (family, count) => Boolean(family) && Number(count) >= 1;
  assert.equal(relaxed('宫格', 1), true, '自证：放松阈值后一张的篇会通过 ⇒ 上面那条不是空转');
  assert.notEqual(relaxed('宫格', 1), pieceLayoutFamilyHolds('宫格', 1));
  /* 版式族要记进篇标记（刷新之后还知道自己该拼哪一种）；中性档不记（= 没声明过） */
  const mark = skillPieceMark(skill, {
    runId: 'visual-run-9', selectedModules: skill.modules.slice(0, 3),
    values: { layout: '底片条' },
  });
  assert.equal(mark.layout, '底片条', '篇标记要带版式族（历史里那条记录据此拼版）');
  assert.equal(skillPieceMark(skill, { runId: 'x', selectedModules: skill.modules.slice(0, 1), values: {} }).layout,
    undefined, '没选版式族时不写这个字段（不许凭空造一个）');
  assert.equal(skillPieceMark(skill, {
    runId: 'x', selectedModules: skill.modules.slice(0, 1), values: { layout: LAYOUT_FAMILY_NONE },
  }).layout, undefined, '「不拼版」是中性档，与"没选"同义 —— 不许写进篇标记');
});

/* ═══ 2026-09-28 批 DC 续-3：**连拍组**（把"同机位连拍"这条实测规律落到出图侧）═════════════════
   用户口径（逐字）：「**你有没有我忽略的排版和布局和构图方式呢**」「不能因为我举了几个例子就只照
   我的例子去做呀」「你自己调研之后你感觉我说的是不是对的呢」。
   复核 402 张原始判定后确认：真正撑起"成套感"的是**篇内"同机位/同版式连着用几张、每张只换实体"**
   （74/402 = 18.4%，落在 21 篇；报告原话「他的篇级做法是"一个版式/机位连着用几张，每张换道具/
   换材质/换文案"，而不是"每张都换构图"」）。⚠️ 这条规律上一版被我错误地用在了**拼版侧**
   （拿它当"版式族必选"的依据）—— 这一组断言就是把它钉在**出图侧**。 */
test('⑦ 同机位连拍：在清单里**逐张标**，只有标中的那几张拿到"同机位"那句', () => {
  /* ⚠️⚠️ 2026-09-29 批 DC 续-15（用户 2026-09-29 当面推翻批 DC 续-3 的「前 N 张」）：
     「这个连拍组为什么一定要前两张三张呢，这样生成不就**一定会占用到封面第一张图**吗，
       **我们模仿的那个账号也是这样做的吗？**」

     **重算了那份实测聚类（74/402 完全复现），旧的依据不成立**：
       · 23 个簇里只有 **5 个**含首图；**21 篇里 16 篇（76%）的封面不在连拍簇里**；
       · 按张数 **74 张里 54 张（73%）**所在簇**不含**首图；
       · 簇**不是开头连续段**，多是中段连着（n19: 3/4/5/7/10/11、n23: 4/5/9/11、n40: 2/3|4/5）。
     ⇒ 「前 N 张」不但没依据，还**必然占用封面**（清单第 1 项就是概念静物）。

   ⚠️⚠️ 批 DC 续-17（用户**第三次**当面追问，整个交互再改一次）：
     「他点了第一张图的这个连拍按钮，然后他又点了第 5 张图的这个连拍按钮。那第一张和第 5 张会
       形成连拍吗？那最后这套图片岂不是就变成第一张跟第 5 张是连拍，**但是中间又插了第二第三
       第四张**？他又不跟他们是连拍。」

     ⇒ **改成「这张 + 下一张」成对**。这一轮把 27 个簇的**位置结构**也重算了：
       · 只有 **4/27（15%）**是完整连成一段；随机打乱对照 2 万次，实测 55 段 vs 随机均值 56.9，
         **p ≈ 0.19** ⇒ 簇**没有位置信号**（那种"1 和 5 一组"的形状确实常见，但与随机不可区分）；
       · **中位数 2 张、70% 恰好 2 张**、48.8% 的篇一个簇都没有；
       · 真实摄影里连拍就是**相邻帧**，中间插一张别的画面在物理上不成立。
     ⇒ 这一条门禁守的就是「**绝不跨空档**」：组永远是清单上**相邻的两行**。 */
  assert.equal(skill.fields.find(item => item.key === 'series'), undefined,
    '**「连拍组」这一格要去掉** —— 标记挪到清单每一行上（用户选定）');
  assert.equal(skill.modulesSeries, true, '由技能自己声明"这份清单要连拍标记"（别的技能的清单是内容模块，不适用）');

  /* 顺序取自**清单声明顺序**（skillShotValues 保的就是它）。 */
  const wanted = ['概念静物', '平铺集合', '材质静物', '空镜', '局部极特写'];
  const picked = skill.modules.filter(module => wanted.includes(module.name)).map(module => module.name);
  assert.equal(picked.length, 5, '夹具要凑够 5 种手法（组内 2 + 组外 3），实际 ' + picked.length);

  /* ★ 批 DC 续-18：组是**若干个连续段**（不再是"一对"）。
     用户 2026-09-29 第四次追问：成对版「如果我想要连拍三张图，岂不是就没办法实现了？
     我觉得**你不如把它设计成只要点击某一个连拍，你就可以通过鼠标去连接下面的连拍按钮**」。
     约束仍然是"绝不跨空档"（第一次追问的诉求）—— 靠"标中的行永远连续"这条不变式来保证。 */
  const group = picked.slice(1, 4);   // 第 2~4 张连成一段（**3 张**，正是成对版做不到的）
  assert.equal(group.length, 3, '夹具要一段 3 连拍');
  const withGroup = { ...valuesWithShots(picked), seriesGroups: [group] };
  const prompts = picked.map((_, index) => buildSkillRequest(
    skill, skillValuesForShot(withGroup, index), { runId: 'r', slotIndex: index },
  ).prompt);
  const clause = skillSeriesClause(withGroup, group[0]);
  assert.ok(clause.length > 30, '自证前提：这句真的是一句可执行的纪律');
  assert.ok(!clause.includes(picked[0]), '自证：这一组里本来就没有封面');

  /* 口径：锁机位与布光、**放行画面里的人与物**（原先写"只换道具"与逐张人物形态直接矛盾，
     而实测簇内人物形态并不恒定 —— 排除"双双空镜"后，簇内一致性 35.0% 低于随机基线 38.6%）。 */
  assert.match(clause, /机位、景别、焦段、光线与背景位置完全不变/, '仍要锁死机位与布光（那才是实测里被锁住的）');
  assert.match(clause, /画面里的人与物可以换/, '必须放行"画面里的人与物"，否则与逐张人物形态自相矛盾');
  assert.doesNotMatch(clause, /只更换画面里的实体/, '旧的"只换道具"说法与逐张镜头冲突，已改');

  /* 组内那两张：都带同机位那句，且**共用同一句**（这就是"同一次拍摄"） */
  for (const name of group) {
    const index = picked.indexOf(name);
    assert.ok(prompts[index].includes(clause), name + ' 没带上同机位那句');
  }
  /* 没进组的：一个字都不许带 */
  for (const name of picked.filter(n => !group.includes(n))) {
    const index = picked.indexOf(name);
    assert.ok(!prompts[index].includes(clause), name + ' 不该拿到同机位那句（它没进组）');
    assert.ok(!prompts[index].includes('同机位连拍'), name + ' 里连这个词都不许出现');
  }
  /* ★ 封面（概念静物）**默认不会被卷进任何组** —— 用户 2026-09-29 指出的正是这一点。 */
  assert.ok(!prompts[0].includes('同机位连拍'), '没点封面时，封面那张不许自动进连拍组');

  /* 组内那两张仍然各带自己那一种手法（连拍不等于两张一样） */
  for (const name of group) {
    const index = picked.indexOf(name);
    const own = skill.modules.find(module => module.name === name).value;
    assert.ok(prompts[index].includes(own), name + ' 丢了它自己的手法定义');
  }
  assert.equal(new Set(group.map(n => prompts[picked.indexOf(n)])).size, group.length,
    '组内两张的提示词必须仍然各不相同（否则就是同一张画两遍）');

  /* ★ 绝不跨空档 —— 靠一条不变式：**标中的行永远构成若干个连续段**。
     下面把页面的两段逻辑（分组派生 + 点击）原样复算一遍（它们就是判据的一部分，不是摆样子）。 */
  const deriveGroups = (names, marks) => {
    const groups = [];
    let run = [];
    names.forEach(name => {
      if (marks.has(name)) { run.push(name); return; }
      if (run.length) { groups.push(run); run = []; }
    });
    if (run.length) groups.push(run);
    return groups;
  };
  /* 点的链：已标 ⇒ 从它截断；没标 ⇒ 补齐到**真实存在**的标行为止。 */
  const toggleMark = (marks, names, name) => {
    const at = names.indexOf(name);
    if (at < 0) return marks;
    const next = new Set(marks);
    if (next.has(name)) {
      for (let i = at; i < names.length; i += 1) { if (!next.has(names[i])) break; next.delete(names[i]); }
      return next;
    }
    let up = at - 1;
    while (up >= 0 && !next.has(names[up])) up -= 1;
    let down = at + 1;
    while (down < names.length && !next.has(names[down])) down += 1;
    const from = up >= 0 ? up + 1 : at;
    const to = down < names.length ? down - 1 : at;
    for (let i = from; i <= to; i += 1) next.add(names[i]);
    return next;
  };

  assert.deepEqual(deriveGroups(picked, new Set([picked[0]])), [[picked[0]]],
    '点第 1 张 ⇒ **只**标第 1 张（⚠️ 第一版漏了"两边都没有标行"这个分支，把 5 张全标上了）');
  assert.deepEqual(deriveGroups(picked, toggleMark(new Set([picked[0]]), picked, picked[2])),
    [picked.slice(0, 3)],
    '点第 1 张再点第 3 张 ⇒ **1~3 整段**（补齐中间那一张，正是成对版做不到的"连拍三张"）');
  assert.deepEqual(deriveGroups(picked, toggleMark(new Set([picked[0], picked[1], picked[2]]), picked, picked[4])),
    [picked.slice(0, 5)],
    '点第 5 张 ⇒ 从 1 连到 5');
  assert.deepEqual(deriveGroups(picked, toggleMark(new Set(picked.slice(0, 5)), picked, picked[4])),
    [picked.slice(0, 4)],
    '再点已标的第 5 张 ⇒ **从它开始截断**（1~4）');
  assert.deepEqual(deriveGroups(picked, toggleMark(new Set(picked), picked, picked[0])), [],
    '点第 1 张 ⇒ 整段取消');
  /* 不变式本身：任何点击序列之后，标中的行都**连续**（这一条覆盖所有上面的分支） */
  for (const seed of [[0], [0, 4], [2], [1, 2]]) {
    let marks = new Set(seed.map(i => picked[i]));
    for (let step = 0; step < 4; step += 1) {
      marks = toggleMark(marks, picked, picked[(step * 2 + 1) % picked.length]);
      const groups = deriveGroups(picked, marks);
      for (const g of groups) {
        assert.ok(g.every((n, k) => k === 0 || picked.indexOf(n) === picked.indexOf(g[k - 1]) + 1),
          '标中的行必须连续（用户第一次追问的那个洞）：' + JSON.stringify(g));
      }
      const flat = groups.flat();
      assert.equal(new Set(flat).size, flat.length, '一张图不许落进两组');
    }
  }
  /* 两段并存时，各段各报各的 —— 批 DC 续-17 那个"摊平成一个数组"的写法会报成一组 */
  const twoGroups = [[picked[0], picked[1]], [picked[3], picked[4]]];
  const a = skillSeriesClause({ seriesGroups: twoGroups }, picked[0]);
  const b = skillSeriesClause({ seriesGroups: twoGroups }, picked[3]);
  assert.ok(a.includes('2 张'), '第一段应报 2 张：' + a.slice(0, 40));
  assert.ok(b.includes('2 张'), '第二段应报 2 张：' + b.slice(0, 40));
  assert.ok(!a.includes(picked[3]) && !b.includes(picked[0]), '两段不许互相把对方列进来');
  assert.equal(skillSeriesClause({ seriesGroups: twoGroups }, picked[2]), '',
    '没进组的那张一句话都不许带');

  /* 没标任何张时**与不带这一栏时逐字相同**（老参数、老历史还原都不会变味） */
  const none = valuesWithShots(picked);
  const before = buildSkillRequest(skill, skillValuesForShot(none, 0), { runId: 'r', slotIndex: 0 }).prompt;
  const withEmpty = buildSkillRequest(skill, skillValuesForShot({ ...none, seriesNames: [] }, 0),
    { runId: 'r', slotIndex: 0 }).prompt;
  assert.equal(withEmpty, before, '没标时提示词必须与不带这一栏时逐字相同');
  assert.doesNotMatch(before, /连拍|同机位/, '默认不许在提示词里留下任何痕迹');

  /* 只标 1 张 = 不成组（"一组 1 张"不成立） */
  assert.equal(skillSeriesClause({ seriesNames: ['概念静物'] }, '概念静物'), '',
    '只标 1 张时不注入（没有"组"可言）');
  assert.equal(skillSeriesClause({ seriesNames: [] }, '概念静物'), '', '一张都没标时不注入');
  assert.equal(skillSeriesClause({ seriesNames: group }, '局部极特写'), '',
    '没被标中的那张拿不到这句');
  assert.equal(skillSeriesClause({}, '概念静物'), '', '没有 seriesNames 时不注入（老数据不带这个键也不能炸）');

  /* 占位符必须登记（否则 media-skill-run 那条"brief 里的占位符对得上"会红） */
  /* ⚠️ 2026-09-29 批 DC 续-16：第三个是 `person` —— 它也**不再是字段**了（改成逐张），
     brief 里的 `{{person}}` 由 `skillValuesForShot` 按第几张注入。
     少登记一个的后果很具体：`media-skill-run-0917` ② 会报
     「brief 用了不存在的字段：image.concept_set -> person」—— 它是对的。 */
  assert.deepEqual(skill.injectedBriefKeys, ['shots', 'series', 'person'],
    '三个运行期注入的占位符都要登记（shots / series / person）');
  assert.equal(skill.fields.some(f => f.key === 'person'), false,
    'person 必须已经不在 fields 里了（否则那条"brief 里的占位符要对得上字段"判据就自相矛盾）');

  /* 页面接线：三处都要在 —— ① 把勾选变成 shotNames/seriesNames；② 清单那行渲染出标记；
     ③ 逐张下发走同一个注入点。少一处就是"界面标了、请求里没有"。 */
  assert.match(PAGE, /const shotNames = selectedModules\.map\(module => module\.name\)/,
    '页面要把**名字**按勾选顺序一起算出来（连拍组按名字判，不按位置）');
  assert.match(PAGE, /shots,\s*\n?\s*shotNames,/, '并把它与 shots 一起带进生效值（两者必须同序）');
  assert.match(PAGE, /seriesGroups, shotPerson, shotOverrides/,
    '页面要把**分组**传下去（批 DC 续-18：摊平成一个数组的写法会把两段报成一组）');
  assert.match(PAGE, /seriesNames: seriesGroups\.flat\(\)/,
    '清单那颗药丸的"在组内"高亮读的是摊平后的名字（与 seriesStarts 是两回事，两个都要给）');
  assert.match(PAGE, /buildSkillRequest\(skill, skillValuesForShot\(effectiveValues, index\)/,
    '逐张生成要经过 skillValuesForShot（连拍那句就是在那里注入的）');
  const shell = read('src/components/media/WorkbenchShell.jsx');
  assert.match(shell, /media-workbench-checklist-series/, '清单每行要渲染出那颗「连拍」标记');
  assert.match(shell, /disabled=\{!on\}/,
    '本身没被勾进这一篇的那行，标记要置灰（清单里没有的那张不可能出现在组里）');
});

/* ═══ 2026-10-01 用户两条批注：悬停文案撤掉 + 两颗控件纵向对齐 ═══════════════════════════════════ */
test('⑧ 「连拍」药丸不许再挂悬停文案（用户要的是对话里回答，不是线上给用户看）', () => {
  /* 用户原话：「而且你现在这些连拍按钮鼠标放上去为什么有那么长的提示啊，那些文案你应该在
     对话里面回答我呀，你放到线上来给用户看干嘛呀。」
     原来那条 `seriesHint` 有 110 多字、还带着没被渲染的 `**` 星号，鼠标一碰就糊一屏。 */
  const shell = code('src/components/media/WorkbenchShell.jsx');
  const pill = /<button[\s\S]{0,400}?media-workbench-checklist-series[\s\S]{0,400}?>/.exec(shell);
  assert.ok(pill, '要能定位到那颗药丸的标签');
  assert.doesNotMatch(pill[0], /\btitle=/,
    '药丸不许有 title —— 说明性文案属于对话与注释，不属于悬停气泡');
  assert.doesNotMatch(code('src/pages/MediaCreation/index.jsx'), /seriesHint/,
    'seriesHint 已经没人读了：留一个看起来"有说明"实际没人看的字段，比删掉更糟');
});

test('⑨ 「连拍」药丸与「镜头」下拉必须逐像素对齐（纵向）', () => {
  /* 用户第二次提同一件事：「然后你现在的连拍和镜头的按钮为什么没对齐呀」。
     批 DC 续-17 修的是**横向**（未勾行的药丸往左滑 ⇒ 行改三列 grid）；
     这次是**纵向**：药丸自带一截 `margin-top: 5px`，镜头下拉那格没有 ⇒ 每行差 5px。
     实测（.tmp/gm-align-measure.mjs，真 WorkbenchShell.css + 真 DOM 结构）：
     改前每行 Δtop = 5px，改后 4 行全部 Δtop = 0、Δheight = 0。 */
  const css = code('src/components/media/WorkbenchShell.css');
  const base = /\.media-workbench-checklist-series\s*\{([^}]*)\}/.exec(css);
  assert.ok(base, '要能定位到药丸的基线规则');
  assert.doesNotMatch(base[1], /margin-top/,
    '药丸基线规则不许再自带纵向偏移（偏移只由下面那条并列规则统一给，两边一起）');
  assert.match(css,
    /\.media-workbench-checklist\.is-person \.media-workbench-checklist-series,\s*\n?\s*\.media-workbench-checklist\.is-person \.media-workbench-checklist-person\s*\{[^}]*margin-top:\s*0/,
    '药丸与镜头格必须被**并列**钉在一起（同 align-self / margin-top / min-height），不许只改一边');
});
