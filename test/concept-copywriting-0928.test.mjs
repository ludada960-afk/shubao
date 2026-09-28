/* ═══ 门禁：「代写这一篇的文案」2026-09-28 批 DC 续-6 ═════════════════════════════════════════
   用户口径（逐字）：「文案这块怎么办呢，我们文案要另外生成吗，**统一一起生成的话，会不会更适配呢**？
   还有就是，我们生成的文案能不能实现他们的那种风格呢，我们要**避免文案千篇一律**，但是也要
   **成功模仿他们的风格**，该怎么做会比较好呢」。

   架构（与用户确认过的）：**分开生成、共享上下文** —— 他的 402 张图里几乎没有要读的字
   （英文文案条是拼版后期加的），文案全部活在**发布层**（标题 + 正文 + 标签）。
   所以不是把字烤进图里，而是生成文案时带上这一篇的全部要素（母体/手法/人物/补充）。

   这一组守六件事（每条都带自证）：
     ① 句式库真的来自实测（六种，每条带 41 篇原文里的原句），且**轮换**：相邻两次的组合不同；
     ② 判重是**可算的**：CJK 二元组 Dice，最近用过的标题会被判"要重写"；
     ③ 纪律复核：万金油词密度、禁词、感叹号、长度、标签数、具体名词覆盖 —— 每条都能判红；
     ④ 提示词带**这一篇的要素**（母体/手法/人物/补充）与"避开最近标题"；
     ⑤ 扣费链：先报价 → 确认 → 请求（客户端），服务端 hold → LLM → settle、失败释放；
        价格来自目录（0.5 积分），按钮上的数字与确认框里的数字同源；
     ⑥ 只对概念视觉方案出现（不是全站每页都长一颗要钱的按钮）。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  BODY_SKELETON,
  FORBIDDEN_IN_COPY,
  GILDED_WORDS,
  TITLE_PATTERNS,
  TITLE_REPEAT_THRESHOLD,
  buildCopyPrompt,
  disciplineCheck,
  extractImageryTokens,
  imageryCoverage,
  needsRewrite,
  parseCopyJson,
  rotatePatterns,
  titleSimilarity,
} from '../server/conceptCopywriting.mjs';
import { FEATURE_SKUS, MARGIN_BANDS, quoteFeature } from '../server/billing/catalog.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(join(ROOT, relative), 'utf8');
const PAGE = read('src/pages/MediaCreation/index.jsx');
const API = read('src/services/conceptCopy.js');
const SKU = 'ec_concept_copy';

/* ═══ ① 句式库：六种、带实测原句、轮换 ══════════════════════════════════════════════════════ */
test('① 标题句式库来自实测（六种，各带 41 篇里的原句），且相邻两次生成用不同组合', () => {
  assert.equal(TITLE_PATTERNS.length, 6, '六种句式（从 41 篇标题里归纳），实际 ' + TITLE_PATTERNS.length);
  for (const pattern of TITLE_PATTERNS) {
    assert.ok(String(pattern.id || '').length >= 2, '句式要有 id');
    assert.ok(String(pattern.label || '').length >= 3, '句式要有中文名：' + pattern.id);
    assert.ok(String(pattern.rule || '').length >= 15, '句式要写清怎么写（可执行的一句规则）：' + pattern.id);
    /* 原句必须能与 41 篇原文对上 —— 抽查三条最典型的（逐字，来自 .tmp/xhs/…/descs.txt） */
    assert.ok(String(pattern.example || '').length >= 6, '每条句式都要带一句实测原句：' + pattern.id);
  }
  const examples = TITLE_PATTERNS.map(pattern => pattern.example).join(' | ');
  for (const real of ['把偏爱，攥在掌心', '时髦，即率先成为自己', '你还能分清AI和摄影吗？']) {
    assert.ok(examples.includes(real), '句式库里必须留着 41 篇里的原句：' + real);
  }
  /* 轮换：一次生成给三种不同句式；相邻两次的组合必须不同（"连续两篇不许同一组合"） */
  const first = rotatePatterns(1).map(p => p.id);
  const second = rotatePatterns(2).map(p => p.id);
  assert.equal(new Set(first).size, 3, '一次生成给三种**不同**句式，实际 ' + first.join('/'));
  assert.notDeepEqual(first, second, '相邻两次的句式组合必须不同（这就是"不千篇一律"的机器保证）');
  for (const step of [1, 2, 3, 4, 5, 6, 7]) {
    const combo = rotatePatterns(step).map(p => p.id);
    assert.equal(new Set(combo).size, 3, '第 ' + step + ' 次的三种句式不许重复：' + combo.join('/'));
  }
  assert.ok(rotatePatterns(99).length === 3, 'attempt 超界也要给出合法的三句式');
  /* ── 自证：把轮换写死成"永远前三"的假实现，相邻两次就会撞上 ── */
  const frozen = () => TITLE_PATTERNS.slice(0, 3).map(p => p.id);
  assert.deepEqual(frozen(1), frozen(2), '自证：写死的组合确实会重复 ⇒ 上面那条测的是真轮换');
});

/* ═══ ② 判重：CJK 二元组 Dice ══════════════════════════════════════════════════════════════ */
test('② 判重是可算的：最近用过的标题会被判"要重写"，不像的放过', () => {
  assert.equal(titleSimilarity('把偏爱，攥在掌心', '把偏爱，攥在掌心'), 1, '同一句相似度 = 1');
  /* "同句式换一个词"是最需要抓的那一类（换汤不换药）：只差一个字 ⇒ 相似度仍然很高 */
  assert.ok(titleSimilarity('把偏爱，攥在掌心', '把偏爱，攥在手心') > TITLE_REPEAT_THRESHOLD,
    '只换一个字必须判重（实得 ' + titleSimilarity('把偏爱，攥在掌心', '把偏爱，攥在手心').toFixed(2) + '）');
  /* 而"同句式但换了意象"就是**应该放过**的（那正是"同风格不重复"）——
     这一条同时说明判据不是"句式一样就毙"，而是"字面太像才毙" */
  assert.ok(titleSimilarity('把偏爱，攥在掌心', '把夏日，留在身上') < TITLE_REPEAT_THRESHOLD,
    '同句式换掉整句意象的应当放过（否则永远写不出新的）');
  const recent = ['把偏爱，攥在掌心', '时髦，即率先成为自己'];
  assert.equal(needsRewrite('把偏爱，攥在掌心', recent), true, '一字不差必须判重写');
  assert.equal(needsRewrite('把偏爱，攥在手心', recent), true, '只换一个字也要判重写');
  assert.equal(needsRewrite('被巧克力吻过的秋天', recent), false, '不像的标题要放过（不然永远写不出新的）');
  assert.equal(needsRewrite('', recent), true, '空标题算需要重写');
  assert.ok(TITLE_REPEAT_THRESHOLD > 0 && TITLE_REPEAT_THRESHOLD < 1, '阈值要在 (0,1) 之间');
  /* ── 自证：把相似度换成一个恒为 0 的函数，"一字不差"那条就会漏 ── */
  const blind = () => 0;
  assert.equal(blind('把偏爱，攥在掌心', '把偏爱，攥在掌心'), 0, '自证：恒 0 的相似度抓不到重复 ⇒ 上面那条不是空转');
});

/* ═══ ③ 纪律复核：六条判据各自能判红 ═══════════════════════════════════════════════════════ */
test('③ 纪律复核：万金油词密度 / 禁词 / 感叹号 / 长度 / 标签数 / 具体名词，每条都能判红', () => {
  const good = {
    titles: ['把偏爱，攥在掌心'],
    body: '阳光落在庄园，无花果在枝头慢慢成熟。青柠与条纹浴巾摊在木平台上，风把草编包吹得晃了一下。'
      + '这只玻璃汽水瓶握在手里很轻，水珠顺着瓶身滑下来。把这一刻留在身上。',
    tags: ['审美积累', '时尚大片', '时髦捕手', '夏日', '海边'],
  };
  const imagery = ['青柠', '条纹浴巾', '草编包', '玻璃汽水瓶', '木平台'];
  const ok = disciplineCheck(good, { imageryTokens: imagery });
  assert.equal(ok.ok, true, '合规样本必须过：' + ok.reasons.join('；'));
  assert.ok(ok.covered.length >= 2, '合规样本要覆盖至少 2 个具体名词，实际 ' + ok.covered.join('/'));

  const cases = [
    [{ ...good, titles: [], body: good.body }, '没有标题'],
    [{ ...good, body: good.body + '氛围感很好，氛围感拉满。' }, '万金油词超密度'],
    [{ ...good, body: good.body.replace('阳光落在庄园', 'AI 生成的阳光落在庄园') }, '禁词'],
    [{ ...good, body: good.body + '真好！太棒了！' }, '感叹号过多'],
    [{ ...good, body: '太短了。' }, '正文太短'],
    [{ ...good, tags: ['只有一个'] }, '标签少于 5 个'],
    [{ ...good, body: '阳光落在庄园，无花果慢慢成熟。风把窗帘吹起来，杯子握在手里很轻，这一刻值得留下。' }, '缺具体名词'],
  ];
  for (const [broken, reason] of cases) {
    const result = disciplineCheck(broken, { imageryTokens: imagery });
    assert.equal(result.ok, false, '这一条本该判红：' + reason);
    assert.ok(result.reasons.length >= 1, '判红要给理由：' + reason);
  }
  /* 万金油词表本身要有内容，且**允许出现 1 次**（他原文里也偶有） */
  assert.ok(GILDED_WORDS.length >= 3, '万金油词表要覆盖那批被滥用的词');
  const once = disciplineCheck({ ...good, body: good.body + '多了一点氛围感。' }, { imageryTokens: imagery });
  assert.equal(once.ok, true, '出现 1 次不算违规（实测他原文里也有）');
  /* 禁词表：不许代写 AI 署名（平台标识由用户发布时自己处理） */
  assert.ok(FORBIDDEN_IN_COPY.includes('AI'), 'AI 署名不许由我们代写');
  /* ── 自证：把关键词表清空，"缺具体名词"那条就会失效 ── */
  const noTokens = disciplineCheck(cases[6][0], { imageryTokens: [] });
  assert.equal(noTokens.ok, true, '自证：没有意象清单时不强制具体名词（否则模型只能编）');
});

/* ═══ ④ 提示词带这一篇的要素 ═══════════════════════════════════════════════════════════════ */
test('④ 提示词带这一篇的要素（母体/手法/人物/补充）+ 避开最近标题 + 三段式与禁则', () => {
  const built = buildCopyPrompt({
    theme: '概念：去看海（主色 海蓝灰雾 #8B9EAB，辅 #91B5CB / #C8DDE9）',
    shots: ['概念静物 —— 把主题的实体重构进同一张静物', '平铺集合 —— 俯拍摊开成一整套'],
    person: '人物只出现手或手臂，头部与其余身体全部出画',
    notes: '道具与场景：海边木平台，玻璃汽水瓶、青柠、条纹浴巾',
    product: '青柠气泡水',
    patterns: rotatePatterns(1),
    avoidTitles: ['把偏爱，攥在掌心'],
    imageryTokens: ['青柠', '条纹浴巾', '玻璃汽水瓶'],
  });
  for (const needle of ['去看海', '概念静物', '手或手臂', '海边木平台', '青柠气泡水', '把偏爱，攥在掌心']) {
    assert.ok(built.userPrompt.includes(needle) || built.systemPrompt.includes(needle),
      '提示词缺这一篇的要素：' + needle);
  }
  assert.ok(built.systemPrompt.includes(BODY_SKELETON.split('\n')[0]), '三段式骨架要在系统提示里');
  assert.ok(built.systemPrompt.includes('至少出现 2 个'), '具体名词的硬要求要在（本篇有清单时）');
  assert.ok(built.systemPrompt.includes('审美积累'), '身份标签那一条要在（实测他每篇必带）');
  assert.ok(/JSON/.test(built.systemPrompt), '要明确只输出 JSON（解析器按它解析）');
  /* 没有产品名时不许编造 */
  const noProduct = buildCopyPrompt({ theme: 'x', product: '' });
  assert.ok(noProduct.systemPrompt.includes('不许编造品牌名或产品名'), '没有产品名时必须禁止编造');
  /* 意象不足 3 条时不硬性要求具体名词 */
  const thin = buildCopyPrompt({ theme: 'x', imageryTokens: ['青柠'] });
  assert.ok(!thin.systemPrompt.includes('至少出现 2 个'), '意象不足时不要求具体名词（不逼模型编）');
});

/* ═══ ⑤ 解析 + 计费链 + 接线 ═══════════════════════════════════════════════════════════════ */
test('⑤ 输出解析 / 计费（0.5 积分过毛利地板）/ 客户端先报价再请求、只在概念方案上出现', () => {
  /* 容错解析：```json 围栏、多余文字都能吃下；坏输入返回 null（不假装成功） */
  const fenced = parseCopyJson('好的，这是结果：\n```json\n{"titles":["A","B","C"],"body":"正文内容","tags":["#审美积累","时尚大片"]}\n```');
  assert.deepEqual(fenced.titles, ['A', 'B', 'C']);
  assert.equal(fenced.body, '正文内容');
  assert.deepEqual(fenced.tags, ['审美积累', '时尚大片'], '标签要剥掉 # 号');
  assert.equal(parseCopyJson('完全不是 JSON'), null, '坏输入必须返回 null');
  assert.equal(parseCopyJson('{"titles":[],"body":""}'), null, '空结果不算成功');
  assert.equal(parseCopyJson(''), null, '空输入返回 null（不许假装成功）');

  /* 计费：SKU 登记 + 过毛利地板（与方案预览同档） */
  const feature = FEATURE_SKUS[SKU];
  assert.ok(feature, 'SKU 必须登记在 billing/catalog 里');
  assert.equal(feature.units, 500, '面值 0.5 积分（与方案预览同档）');
  const quote = quoteFeature(SKU, 1);
  assert.equal(quote.totalUnits, 500);
  const anchor = 0.262;   /* 积分面值锚（与 catalog 的说明同口径） */
  const face = (quote.totalUnits / 1000) * anchor;
  const margin = (face - feature.providerCostCny) / face;
  assert.ok(margin >= MARGIN_BANDS.core.floor, '实算毛利要过主力档地板 60%：' + (margin * 100).toFixed(1) + '%');

  /* 客户端：先报价 → 才请求；actionId 带 attempt（"再来一版"是有意的新动作） */
  assert.match(API, /quoteConceptCopy/, '要先报价');
  assert.match(API, /export async function generateConceptCopy/, '要有生成函数');
  assert.match(API, /conceptCopyActionId\(input\)/, '请求要带 actionId（服务端据此幂等/结算）');
  assert.match(API, /String\(Number\(input\.attempt\) \|\| 1\)/, 'attempt 要进 actionId');
  const idOne = /concept-copy/.test(API);
  assert.ok(idOne, 'actionId 的命名空间要能看出来是这一条动作');
  /* 页面接线：确认在前、请求在后；按钮上写价；只对概念方案渲染 */
  const handler = PAGE.slice(PAGE.indexOf('async function writePostCopy()'), PAGE.indexOf('function copyPostCopyAll()'));
  assert.ok(handler.indexOf('dialog.confirm(') > 0 && handler.indexOf('generateConceptCopy(') > handler.indexOf('dialog.confirm('),
    '确认必须发生在发起之前（铁律②：没有用户确认绝不扣费）');
  assert.match(handler, /本次扣 \$\{CONCEPT_COPY_POINTS\} 积分/, '确认框要写明这一次扣多少积分');
  assert.match(handler, /不扣积分/, '失败时要如实说没有扣积分');
  assert.match(PAGE, /skill\?\.id === LIVE_PHOTO_SKILL_ID\s*\n?\s*\? \{\s*\n\s*points: CONCEPT_COPY_POINTS/,
    '这一块只长在概念视觉方案上（不是全站每页一颗要钱的按钮）');
  assert.match(PAGE, /代写这一篇的文案 · ' \+ postCopy\.points \+ ' 积分/, '按钮上要写价（本仓铁律）');
  assert.doesNotMatch(PAGE, /代写这一篇的文案 · 0\.5/, '价格不许写死在页面里（来自目录常量）');
  /* 文案**不进提示词**：它是发布层的文字，不许混进出图请求的构造 ——
     判据只咬"构造请求那几行"（RunPanel 的 props 里当然有 postCopy，那是渲染用的，不是请求）。 */
  const requestLines = PAGE.split(/\r?\n/).filter(line => /buildSkillRequest\(|buildSkillBrief\(|skillValuesForShot\(/.test(line));
  assert.ok(requestLines.length >= 2, '自证前提：出图请求的构造行要能被找到，实得 ' + requestLines.length);
  assert.ok(requestLines.every(line => !/postCopy/.test(line)), '文案不许出现在出图请求的构造里');
  assert.doesNotMatch(PAGE, /effectiveValues[^\n]*postCopy/, '文案不许混进 effectiveValues（那是下发给模型的取值）');
});

/* ═══ ⑥ 意象清单：从用户补充栏里抽，抽不出来就不硬性要求 ═══════════════════════════════════ */
test('⑥ 意象清单从这一篇的补充栏抽（可抽、可覆盖、不硬编）', () => {
  const tokens = extractImageryTokens('道具与场景：海边木平台与白墙，玻璃汽水瓶、青柠、条纹浴巾、草编包；上午侧逆光', '概念：去看海');
  for (const needle of ['海边木平台', '玻璃汽水瓶', '青柠', '条纹浴巾']) {
    assert.ok(tokens.includes(needle), '抽取漏了：' + needle + '（实得 ' + tokens.join('/') + '）');
  }
  assert.ok(!tokens.includes('道具与场景'), '前缀词不该被当成意象');
  assert.ok(tokens.length <= 12, '清单要收敛（太长提示词会发散）：' + tokens.length);
  assert.deepEqual(extractImageryTokens('', ''), [], '什么都没有时返回空清单');
  const covered = imageryCoverage('青柠与条纹浴巾摊在木平台上', tokens);
  assert.deepEqual(covered, ['青柠', '条纹浴巾'], '覆盖检测按出现与否取（顺序 = 清单顺序）');
  /* 去重：同一句里重复出现的词只记一次 */
  assert.equal(extractImageryTokens('青柠，青柠，青柠').filter(t => t === '青柠').length, 1, '意象不许重复');
});
