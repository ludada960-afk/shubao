/* ═══ 「代写这一篇的文案」：把 41 篇实测的文案语法做成**服务端骨架库**（2026-09-28 批 DC 续-6）═══
   用户口径（逐字）：「文案这块怎么办呢，我们文案要另外生成吗，统一一起生成的话，会不会更适配呢？
   还有就是，我们生成的文案能不能实现他们的那种风格呢，我们要**避免文案千篇一律**，但是也要
   **成功模仿他们的风格**，该怎么做会比较好呢」。

   架构（与用户确认过的方案一致）：**文案与图分开，但共享上下文** ——
     他的 402 张图里几乎没有需要读的文字（英文文案条是拼版后期加的），文案全部活在**发布层**
     （标题 + 正文 + 标签）。所以不是把字烤进图里，而是：生成文案时带上这一篇的全部要素
     （母体/色板、手法清单、人物形态、补充栏里的道具场景），读起来才像同一次策划。

   防千篇一律的四条机制（每一处都对着 41 篇原文的证据）：
     ① **句式轮换**：标题句式库 = 从 41 篇标题里归纳的六种语法（见 TITLE_PATTERNS，每条带实测原句）；
        一次生成 3 个标题必须来自**三种不同句式**，且连续两次生成用**不同的句式组合**（rotatePatterns）。
     ② **意象取自本篇**：提示词里带这一篇的意象清单（补充栏 + 母体），并**要求至少 2 个具体名词**；
        万金油词（氛围感/松弛/高级感…）全篇各最多 1 次 —— 他像真人的原因恰恰是具体名词多、形容词少。
     ③ **判重**：服务端留一份本账号最近标题的日志（concept_copy_log），生成时带进"避免与这些重复"，
        出来后用标题相似度（CJK 二元组 Dice）过滤一遍，太像的直接不发。
     ④ **纪律复核**：输出后跑一遍 disciplineCheck（密度/长度/禁词/感叹号），不过就**同一单内**带
        修正指令重试一次 —— 不加钱。

   文件结构：纯函数（句式库/轮换/相似度/密度/解析）+ 一份提示词构造 —— 全部可被门禁直接测。 */

/* ── 标题句式库：六种，全部带 41 篇里的实测原句（descs.txt 逐字）────────────────────────── */
export const TITLE_PATTERNS = Object.freeze([
  { id: 'ba', label: '「把」字句', example: '把偏爱，攥在掌心', rule: '以「把 + 意象/情感 + 动作结果」收束，15 字内，中间可用一个逗号换气' },
  { id: 'definition', label: '定义宣言句', example: '时髦，即率先成为自己', rule: '「X，即 Y」或「X，是 Y」的宣言式定义，15 字内' },
  { id: 'declaration', label: '状态宣言', example: '无论什么颜色，都是我的时髦底色', rule: '以「无论…都…」或「我更喜欢…」的第一人称口吻，18 字内' },
  { id: 'question', label: '疑问钩子', example: '你还能分清AI和摄影吗？', rule: '一个让人停下来的问题，14 字内，以？结尾' },
  { id: 'event', label: '母题｜事件', example: 'VALENTINO｜一场盛夏雨，心动到站', rule: '「母题词｜一句话场景」，中间用｜分隔，16 字内' },
  { id: 'emoji', label: 'emoji 环绕', example: '🌊橘子海岸的夏日发香假期🍊', rule: '首尾各一枚与母体相关的 emoji，中间 10~14 字' },
]);

/* ── 正文三段式（41 篇正文的公共骨架）────────────────────────────────────────────────── */
export const BODY_SKELETON = Object.freeze([
  '① 场景开场（1~2 行）：一个具体瞬间或感官细节，必须从本篇意象清单里取材',
  '② 产品入镜（2~4 行短句）：产品名 + 质感/颜色/使用感受；可以选一组「emoji 行」（每行「emoji 色号名：短描述」）',
  '③ 宣言收尾（1 行）：一句克制的自我宣言（不是叫卖，不说"快买"）',
].join('\n'));

/* 万金油词：全篇各最多出现 1 次 —— 他像真人的原因恰恰是具体名词多、形容词少 */
export const GILDED_WORDS = Object.freeze(['氛围感', '松弛', '高级感', '时髦']);
/* 禁词：品牌是用户自己的事；AI 署名按平台要求由用户发布时自己处理，文案里不代写 */
export const FORBIDDEN_IN_COPY = Object.freeze(['AI', 'AIGC', '人工智能', '生成于', 'AI生成']);

/* ── 句式轮换：连续两次生成不许同一组合 ─────────────────────────────────────────────────
   ⚠️ 2026-09-28 批 DC 续-7：attempt **从 0 计**（原来从 1 计）。因为文案并进了出图那一次提交，
   随篇首发那一版就是第 0 版，「再来一版」是 1、2…  —— 起点直接取 attempt 本身。
   （原来那条 `((attempt || 1) - 1)` 会把 0 吞成 1，于是"随篇首发"与"第一版重做"拿到**同一组句式**，
     用户点「再来一版」拿回来的标题句式一模一样 —— 恰好是这一版要消灭的现象。）
   组合 = 从起点取三条**不同**句式；自证见门禁：相邻两次 attempt 的组合必须不同。 */
export function rotatePatterns(attempt) {
  const total = TITLE_PATTERNS.length;
  const start = (Number(attempt) || 0) % total;
  return [0, 2, 4].map(step => TITLE_PATTERNS[(start + step) % total]);
}

/* ── 标题相似度：CJK 二元组 Dice 系数（0~1）────────────────────────────────────────────── */
export function cjkBigrams(value) {
  const text = String(value || '').replace(/\s+/g, '');
  const grams = new Set();
  for (let index = 0; index < text.length - 1; index += 1) grams.add(text.slice(index, index + 2));
  return grams;
}

export function titleSimilarity(left, right) {
  const a = cjkBigrams(left);
  const b = cjkBigrams(right);
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared += 1;
  return (2 * shared) / (a.size + b.size);
}

/* 最近 N 篇里有一条例子太像（> 阈值）⇒ 这个标题不发（在提示词里已提前避开，这里是保险丝） */
export const TITLE_REPEAT_THRESHOLD = 0.55;
export function needsRewrite(title, recentTitles = [], threshold = TITLE_REPEAT_THRESHOLD) {
  const text = String(title || '').trim();
  if (!text) return true;
  return (Array.isArray(recentTitles) ? recentTitles : [])
    .some(recent => titleSimilarity(text, recent) > threshold);
}

/* ── 万金油词密度 + 禁词 + 感叹号 + 具体名词覆盖 ───────────────────────────────────────── */
export function countGildedWords(text) {
  const value = String(text || '');
  return GILDED_WORDS.map(word => ({ word, count: value.split(word).length - 1 }));
}

/* 结构标签词：抽取意象时要把它们剔掉（用户写「道具与场景：青柠、条纹浴巾」时，
   前半截是**标签**不是意象 —— 把它当意象塞进提示词，模型会去画"一个叫道具与场景的东西"）。 */
const IMAGERY_LABEL_WORDS = new Set(['道具', '场景', '道具与场景', '补充', '色调', '概念', '主题', '氛围', '参考', '画面']);

export function extractImageryTokens(notes, theme = '') {
  const source = String(notes || '') + '，' + String(theme || '');
  const tokens = [];
  /* ⚠️ 连词（与/和/及）也要切开：用户写「海边木平台与白墙」时，整串当成一个意象的话，
     文案里几乎不可能逐字出现 ⇒ "至少 2 个具体名词"就变成一条永远过不去的判据。 */
  for (const token of source.split(/[，。；：、（）()【】\[\]「」\s#！!？?\-—_/与和及]+/)) {
    const clean = token.replace(/^[道具与场景：:，,]+/, '').trim();
    if (IMAGERY_LABEL_WORDS.has(clean)) continue;
    if (clean.length >= 2 && clean.length <= 8 && !tokens.includes(clean)) tokens.push(clean);
    if (tokens.length >= 12) break;
  }
  return tokens;
}

export function imageryCoverage(text, tokens = []) {
  const value = String(text || '');
  return tokens.filter(token => value.includes(token));
}

/* ── 纪律复核：不过就同一单内带修正指令重试一次 ─────────────────────────────────────────── */
export function disciplineCheck({ titles = [], body = '', tags = [] } = {}, { imageryTokens = [] } = {}) {
  const reasons = [];
  if (!titles.length) reasons.push('没有标题');
  const merged = titles.join('\n') + '\n' + String(body || '');
  for (const { word, count } of countGildedWords(merged)) {
    if (count > 1) reasons.push(`「${word}」出现了 ${count} 次（全篇最多 1 次）`);
  }
  for (const word of FORBIDDEN_IN_COPY) {
    if (merged.includes(word)) reasons.push(`出现了禁词「${word}」`);
  }
  const exclamations = (String(body || '').match(/[！!]/g) || []).length;
  if (exclamations > 1) reasons.push(`感叹号 ${exclamations} 个（全篇最多 1 个）`);
  const bodyLength = String(body || '').replace(/\s+/g, '').length;
  if (bodyLength < 40) reasons.push(`正文太短（${bodyLength} 字，至少 40）`);
  if (bodyLength > 300) reasons.push(`正文太长（${bodyLength} 字，最多 300）`);
  if (!Array.isArray(tags) || tags.length < 5) reasons.push('话题标签少于 5 个');
  /* 具体名词：只有当本篇真的提供了意象清单（补充栏写了东西）时才要求 ——
     什么都没给还硬性要求"出现青柠"，模型只能编，那才是假内容 */
  if (imageryTokens.length >= 3) {
    const covered = imageryCoverage(titles.join(' ') + ' ' + body, imageryTokens);
    if (covered.length < 2) reasons.push(`具体名词不足（只出现 ${covered.length} 个本篇意象，至少 2 个）`);
  }
  return { ok: reasons.length === 0, reasons, covered: imageryTokens.length ? imageryCoverage(titles.join(' ') + ' ' + body, imageryTokens) : [] };
}

/* ── 模型输出解析：容忍 ```json 围栏，归一成 {titles, body, tags} ────────────────────────── */
export function parseCopyJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed;
  try { parsed = JSON.parse(body.slice(start, end + 1)); } catch { return null; }
  const titles = (Array.isArray(parsed.titles) ? parsed.titles : [])
    .map(item => String(item || '').trim()).filter(Boolean).slice(0, 3);
  const copyBody = String(parsed.body || parsed.bodyText || '').trim();
  const tags = (Array.isArray(parsed.tags) ? parsed.tags : [])
    .map(item => String(item || '').trim().replace(/^#/, '')).filter(Boolean).slice(0, 12);
  if (!titles.length || !copyBody) return null;
  return { titles, body: copyBody, tags };
}

/* ── 提示词构造：语法是骨架，变量是这一篇的真实差异 ───────────────────────────────────────── */
function clean(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

export function buildCopyPrompt({
  theme = '', shots = [], person = '', notes = '', product = '',
  patterns = [], avoidTitles = [], imageryTokens = [],
} = {}) {
  const patternLines = patterns.map(pattern => `- 句式「${pattern.label}」：${pattern.rule}（实测原句：${pattern.example}）`);
  const shotLines = shots.map(name => clean(name, 40));
  const avoidLines = avoidTitles.map(title => clean(title, 40));
  const imageryLines = imageryTokens.map(token => clean(token, 12));
  const systemPrompt = [
    '你为一个小红书审美类账号写发布文案（标题 + 正文 + 话题标签）。这个账号的风格是高端美妆/时尚品牌广告大片感：',
    '- 文案与图是两层：图里没有字，文案是发布时的标题与正文；',
    '- 句子极短，每行一个意象，逗号多、句号少，像诗行一样断行；',
    '- 克制、不叫卖：不说"快买""绝绝子""yyds"，不用网络烂梗；',
    '- 具体名词优先于形容词：写"青柠、条纹浴巾、旋转电话"，少写"氛围感、高级感"。',
    '',
    '标题：从下面几种句式里各写一个，三个标题必须来自三种**不同**句式：',
    ...patternLines,
    '',
    '正文：严格按三段式——',
    BODY_SKELETON,
    '全文 40~300 字（去空白计）。「氛围感」「松弛」「高级感」「时髦」这类词全篇各最多出现 1 次。',
    imageryLines.length >= 3
      ? `正文与标题里至少出现 2 个本篇意象清单里的具体名词：${imageryLines.join('、')}。`
      : '意象清单不足 3 条时不强制具体名词，但也不许编造画面里没有的东西。',
    product ? `产品名（用户提供的，可以出现在正文里）：${clean(product, 40)}` : '用户没有提供产品名：正文用「这一件」指代，不许编造品牌名或产品名。',
    '话题标签：5~10 个，不带 # 号；第一层是身份标签（审美积累/时尚大片/时髦捕手/审美提升 这一类），第二层是本篇主题相关，第三层是场景或节气。',
    FORBIDDEN_IN_COPY.length ? `禁词（一个都不许出现）：${FORBIDDEN_IN_COPY.join('、')}。` : '',
    '感叹号全篇最多 1 个。',
    avoidLines.length ? `以下标题是这个账号最近用过的，你的标题不许与它们相似：${avoidLines.join(' / ')}` : '',
    '',
    '只输出一个 JSON 对象（不要多余文字）：{"titles":["标题1","标题2","标题3"],"body":"正文（用\\n断行）","tags":["标签1","标签2"]}',
  ].filter(Boolean).join('\n');
  const userPrompt = [
    '这一篇的要素：',
    `- 母体（决定色调与主题）：${clean(theme, 120)}`,
    shotLines.length ? `- 本篇手法（逐张的画面手法，共 ${shotLines.length} 张）：${shotLines.join(' / ')}` : '',
    person ? `- 人物形态：${clean(person, 60)}` : '',
    notes ? `- 用户补充（道具与场景，意象清单的来源）：${clean(notes, 400)}` : '',
    '',
    '请按系统提示的句式与三段式，输出 JSON。',
  ].filter(Boolean).join('\n');
  return { systemPrompt, userPrompt };
}
