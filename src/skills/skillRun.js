/* ═══ Skill 运行模型：把「工作台上的字段」翻译成「引擎认识的参数」══════════════════
   这一层是工作台能不能真的出图的关键，也是唯一允许做这个翻译的地方
   （页面里不许再拼请求、不许再判断字段）。

   服务端契约（2026-09-17 调研，见 RTK 批次二十三）：
     · 单图链路 = POST /api/canvas/regenerate（经 services/api.js 的 regenerateCanvasImage）
       - prompt 必填；image_url 有值即图生图、无值即文生图（同一个路由）
       - reference_images ≤ 9；reference_metadata ≤ 9
       - ratio ∈ 1:1 | 3:4 | 4:3 | 9:16 | 16:9 | 21:9（非法值静默回落 1:1）
       - resolution ∈ 1K | 2K | 4K（非法值静默降级 2K）
       - creation_intent='visual' + skill_id ∈ free | poster | social-cover | brand-kv
         （服务端白名单只有这四个；非法值静默回落 free —— 所以我们**只映射到这四个**）
       - 计费：先报价再带 billing_quote_id（在 regenerateCanvasImage 内部完成）
       - 断线自愈：网络异常或 409/502/503/504/524 会自动转 status 轮询，不重复扣费
     · 模型：**只传 image2**。它是唯一有真实出图记录的档位（RTK 多次验收任务号）；
       9-13 新增的五档在目录里可选但零真实出图记录，写进来就会重演 9-16「假模型」事故。
       模型该由路由层按 capability 注入（43 §5.3），在台账补齐之前这里只认 image2。

   ⚠️ 本文件是纯函数：不碰 DOM、不发请求，便于门禁直接断言。 */

import { generationUnits, imageModelResolutions, normalizeImageModel, DEFAULT_IMAGE_MODEL } from '../services/imageModelCatalog.js';
/* 套图方案（张数 / 各图比例 / 报价请求）**只有这一份实现**：面板、画布、首页都用它。
   我们要就地跑套图，就必须用同一份 —— 自己另算一套张数会和服务端的方案对不上，
   而服务端在建 hold 之前会校验报价（数量对不上直接报错），对不上就是白跑一趟。 */
import { resolveEcommercePlan } from '../pages/Home/ec/ecommercePlanModel.js';

/* 服务端唯一认得的四个视觉方向（server/visualCreationSkills.mjs:1） */
export const SERVER_VISUAL_SKILL_IDS = Object.freeze(['free', 'poster', 'social-cover', 'brand-kv']);

/* 全站默认图片模型。**真源在 `services/imageModelCatalog.js`**（2026-09-30 起：
   用户拍板「把默认都换成 2.5，这是长期比较好的做法」）—— 这里只做**再导出**，
   免得几十个 import 点各改一遍、也免得两处常量将来走岔。
   ⚠️ 历史：这一行原来写死 `image2`，理由是"唯一有真实出图记录的模型"。
     那个理由 2026-09-30 不再成立 —— `image2-5-sunburst` 早在 9-13 就接通了
     （上游 `gpt-image-2.5-sunburst-*`、计费 SKU `ec_image25_sunburst_*` 齐全，
     一直可选，只是没当默认）。 */
export { DEFAULT_IMAGE_MODEL };
export const DEFAULT_RESOLUTION = '2K';

/* 字段 key → 服务端 ratio 的合法值（服务端不认的写法在这里就拦住，不让它静默回落） */
/* 批 O-⑦：加 2:3 / 3:2 —— 与服务端 modelCatalog.LEGAL_IMAGE_SIZES 的键**逐值一致**
   （必须同时加：界面能给的恰好是引擎认得的，多一档就是"选了被静默回落成 1:1"） */
/* 批 P：加 4:5 / 5:4（知渔「批量出图电商图」的 10 档比例里有这两档）—— 与引擎尺寸表同批。 */
const LEGAL_RATIOS = new Set(['1:1', '3:4', '4:3', '9:16', '16:9', '21:9', '2:3', '3:2', '4:5', '5:4', '9:21', '2:1', '1:2']);
const LEGAL_RESOLUTIONS = new Set(['1K', '2K', '4K']);

/* ═══ 2026-09-19 批 R：比例里的「自适应」——**唯一实现** ═════════════════════════════════════
   用户第 21 轮原话：「比例里的「自适应」我不知道是不是指原来各个 skill 自己的尺寸比例方案，
   各个 skill 他们自己有最适配的方案吗，有的话就可以作为自适应去做吧？」
   去知渔自己的文案里查了（不能靠猜）：他们「出图比例」那一格的 help 原文是
     「选择生成图片的宽高比例，「自适应」将根据模特图自动匹配最接近的比例」
   （证据：docs/design/data/quantv-image-workbenches.json 的 help 字段）
   ⇒ 不是"每个技能配一个固定比例"，而是**拿上传的那张主图的实际宽高，就近取我们支持的一档**。
   声明侧只写字面量 ADAPTIVE_RATIO（照知渔原文），取值在这里做：
   量宽高在控件层完成（上传就绪时读一次 naturalWidth/Height，写进条目的 width/height），
   本文件只做纯计算 —— 不碰 DOM，门禁可以直接断言。 */
export const ADAPTIVE_RATIO = '自适应';
/* 没有主图宽高时回落到 1:1（与 ratioField 的默认档口径一致：界面显示什么，就跑什么） */
export const FALLBACK_RATIO = '1:1';

/** 就近取一档合法比例：按**对数距离**比（2:3 与 3:2 到 1:1 的距离相同，
 *  线性比会把"扁"和"长"算得不对称）。相同距离取声明顺序靠前的那个。 */
export function nearestLegalRatio(width, height) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (!(w > 0) || !(h > 0)) return '';
  const target = Math.log(w / h);
  let best = '';
  let bestDistance = Infinity;
  for (const ratio of LEGAL_RATIOS) {
    const [a, b] = ratio.split(':').map(Number);
    if (!(a > 0) || !(b > 0)) continue;
    const distance = Math.abs(Math.log(a / b) - target);
    if (distance < bestDistance - 1e-9) { bestDistance = distance; best = ratio; }
  }
  return best;
}

/* 比例字段的默认档（声明里的 default，取不到就是 1:1）。 */
function defaultSkillRatio(skill) {
  const field = ((skill && skill.fields) || []).find(item => item.key === 'ratio');
  const declared = text(field && field.default);
  return LEGAL_RATIOS.has(declared) ? declared : FALLBACK_RATIO;
}

function text(value) {
  /* 多选字段的值是**数组**（知渔「选择视角（多选）」那一格，2026-09-19 批 P）——
     拼进提示词时按「、」连起来；其余类型行为一个字没变。 */
  if (Array.isArray(value)) return value.map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean).join('、');
  return typeof value === 'string' ? value.trim() : '';
}

/* 上传字段的值形状由 FieldRenderer 定义：只有 ready 且带 url 的条目才算数 */
export function readyUploads(value) {
  return (Array.isArray(value) ? value : []).filter(item => item && item.status === 'ready' && text(item.url));
}

/* ── ⓪ 初始值：声明里的默认值在这里落地 ──
   ⚠️ 唯一事实源。工作台的显示值、必填校验、下发参数全部基于它 ——
      三处各算一次的结果就是「按钮写着 2K、跑的是 1K」这类最难查的 bug。 */
export function initialSkillValues(skill) {
  const seed = {};
  for (const field of (skill && skill.fields) || []) {
    if (field.kind === 'stepper') { seed[field.key] = Number(field.min || 1); continue; }
    /* ═══ 2026-09-25 批 BL：**cards 也走"默认选中第一档/声明里的 default"** ═══════════════════════
       用户原话（图5-⑤）：「你这两个配置的按钮为什么**没有默认打勾**呢？知渔他们是有的呀。」
       根因：这个函数**没有 cards 分支** ⇒ 落到最后一行 `seed = ''` ⇒ 套图结构那两张卡
       （智能匹配 / 自定义配置）一个都不选中 —— 用户看到的"没有默认打勾"不是样式问题，是值根本没种进去。
       （连带影响：`structureCounts` 的 visibleWhen 依赖它 === '自定义配置'，值恒为空。） */
    if (field.kind === 'cards') {
      seed[field.key] = field.default ?? (field.options?.[0]?.value ?? '');
      continue;
    }
    if (field.kind === 'segmented' || field.kind === 'select') {
      /* 多选（multiple）：值是数组。默认给第一档选中 —— 与单选同一口径（"界面显示什么就跑什么"），
         用户再按需加选；不预选的话必填校验会直接把 CTA 卡住，那不是他们的样子。 */
      if (field.multiple) {
        seed[field.key] = Array.isArray(field.default) ? field.default.slice() : [field.options?.[0]?.value ?? ''].filter(Boolean);
        continue;
      }
      seed[field.key] = field.default ?? (field.options?.[0]?.value ?? '');
      continue;
    }
    /* ═══ counts（按类型配张数，套图「自定义配置」那一组）═══════════════════════════
       ⚠️ 2026-09-19 批 G：这里原来没有 counts 分支 —— 于是它被当成字符串初始化成 ''，
          步进器从 0 起步、合计 0 张，用户点开「自定义配置」看到的是一排 0。 */
    if (field.kind === 'counts') {
      seed[field.key] = Object.fromEntries(
        (Array.isArray(field.rows) ? field.rows : []).map(row => [row.key, Math.max(0, Number(row.default) || 0)]),
      );
      continue;
    }
    seed[field.key] = field.kind === 'upload' ? [] : '';
  }
  return seed;
}

/* 字段当前**可不可见**（visibleWhen 的唯一定义处）。
   校验、取值、渲染三处都问这一份，避免「界面上没显示但被算进必填」或反过来。 */
export function skillFieldVisible(field, values = {}) {
  const rule = field && field.visibleWhen;
  if (!rule || !rule.key) return true;
  return values[rule.key] === rule.equals;
}

/* ═══ 2026-09-27 批 DC（M2）：字段被**锁住**吗（disabledWhen 的唯一定义处）══════════════════════
   真事（「构图方向」那一格）：实测「左→右 / 右→左 只在有人物、有手伸入画面、或人物在行走的
   镜头里才允许出现」（docs/research/2026-09-27-aura-composition-direction.md §五-1）——
   而 63.7% 的图根本没有横向引导。所以选了「空镜」之后，方向那一格不该还能点。
   两条一起才成立（缺一条就是"看着是 A、跑的是 B"）：
     · 渲染：控件禁用 + 就地说明它为什么锁着（FieldRenderer 问这一份）；
     · 取值：reconcileFieldValues 把它夹回**声明里的默认档**，提示词里不会再带旧方向。 */
export function skillFieldLocked(field, values = {}) {
  const rule = field && field.disabledWhen;
  /* ⚠️ values 可能是 null（渲染器允许不传）—— 那时一律当成"没锁"，
     与 visibleWhen 的行为一致（取不到依赖值时不做判断）。 */
  if (!rule || !rule.key || !values || typeof values !== 'object') return false;
  return String(values[rule.key] ?? '') === String(rule.equals ?? '');
}

/* counts 的合计（声明里的 minTotal 是**下限**，与界面末尾那行「当前共 N 张」同源） */
export function skillCountsTotal(field, values = {}) {
  const value = values[field && field.key];
  const rows = Array.isArray(field && field.rows) ? field.rows : [];
  return rows.reduce((sum, row) => sum + Math.max(0, Number(value && value[row.key]) || 0), 0);
}

/* ═══ 2026-09-27 批 DC（M2）：**「一篇」= 勾 N 种手法 → 逐张出 N 张**（唯一实现）═════════════
   用户口径（docs/design/90 §6.5，逐字）：「「一套」= 一张一张计价（N 张 = N 张的钱），
   按钮上写清单价与总额」「用户勾几张就是几张」「两者都不做"自动批量扣费"」。
   这条技能的手法是**可勾选清单**（skill.modules，每项带 `value` = 进提示词的那句定义），
   于是「一篇」由三个纯函数构成：
     · skillShotValues   勾中的那几种 → 这一篇每一张的提示词变量（顺序 = 声明顺序，稳定可复现）
     · skillValuesForShot 第 i 张的取值：`shots` 收窄成第 i 种，其余字段全同
     · skillPieceMark    篇标记：这一篇是谁、勾了哪几种（写进作品，历史据此按篇展示/还原）
   张数与报价**不需要**在这里另算一份：勾选数由页面注入 effectiveValues.count（与 A+ 的
   「勾几个出几个」同一条链），skillGenerationSettings / skillPointsEstimate 读的就是它。 */
function moduleNameOf(module) {
  return text(module && module.name);
}

/* 「居中/无方向」那一档的**逐字值**。空镜的行要夹回它 —— 见 skillValuesForShot。
   ⚠️ 这是 `CONCEPT_DIRECTION_OPTIONS()[0].value` 的副本：skillRun 不 import imageSkills
   （那边 import 本文件，反向依赖会成环，而 esbuild 不查循环依赖、只在运行期炸）。 */
const DIRECTION_CENTERED = '画面不做方向引导（主体居中、左右留白平衡）';

export function skillShotValues(skill, selectedModules = []) {
  const modules = Array.isArray(skill && skill.modules) ? skill.modules : [];
  const picked = new Set((Array.isArray(selectedModules) ? selectedModules : []).map(moduleNameOf));
  /* 认不出的模块名不会凭空造出一条手法；没有 `value` 的清单（A+ 那种纯说明型模块）返回空数组，
     所以这一次改动对其它技能**一个字都不影响**。 */
  return modules.filter(module => picked.has(moduleNameOf(module))).map(module => text(module.value)).filter(Boolean);
}

/* ═══ 2026-09-29 批 DC 续-16：**逐张的人物形态**（这一篇不再十张一个样）════════════════════════════
   用户 2026-09-29 逐字：
     「我不太明白你为什么图片的张数你要把它限定死呢？……**那是不是它出来的所有内容都会包含这些
       人物形态，构图方向，版式组等等的选好的选项呢？那出来的作品岂不都千篇一律了？**
       这个问题你没有深度思考过吗？你没有去看竞争对手的账号，他们怎么做吗？」

   **他是对的，而且旧实现比他说的还死**：改前的 brief 模板原文就是
   「整篇纪律，每一张都遵守：人物形态：{{person}}；构图方向：{{direction}}」——
   十张就是十张**一模一样**的人物形态。

   实测依据 —— ⚠️ **数字全部能在已入库的调研文档里逐条核对**（这是本批新立的纪律：
   注释里声称的"实测"必须指到一个**别人打得开**的地方，不能只指一个本地临时目录）：
     · 逐张分布：`docs/research/2026-09-27-aura-deep-dive.md:346-359` 的判定表
       （空镜 206 = 51.2% / 躯干与腿 74 = 18.4% / 只有手 66 = 16.4% / 下半脸 17 = 4.2%
        / 戴墨镜 13 = 3.2% / 被物遮挡 8 = 2.0% / 背影 8 = 2.0% / 画中画 7 = 1.7%）；
     · 「人物形态按**图片顺序**给出」的逐篇序列：同一份文档 :113-158 的表格
       （我按那 39 条序列重算，与文档**逐字核对 39/39 一致**）；
     · 原始逐张标注脚本是 `.tmp/xhs/aura-deep-2026-09-27/classify.cjs`（**不入库**，
       原始素材同理；该脚本已登记在同一份 deep-dive 的脚本表 :486，与姊妹篇惯例一致）。
     由此得到：
     · **39 篇多图笔记里 34 篇篇内混用 = 87.2%**；
     · 剩下 5 篇统一的，**全部是 100% 空镜的纯静物篇**（n21/n37/n38/n39/n40）——
       也就是说**没有任何一篇是"每张都同一种人物形态"**。
   ⚠️ 反过来，**构图方向篇内基本不变**（只有 3/41 篇同时出现左→右与右→左），
     所以方向**不做逐张化**，仍然是全篇一档 —— 逐张化它反而是在造实测里不存在的形态。

   分配算法：**最大余额法**（largest remainder）按权重把 N 个名额分给各档，再**交错**排开。
   交错是必要的：不交错的话 6 张会排成「空镜 空镜 空镜 躯干 手 下半脸」，
   前三行一模一样，用户看着像坏了。
   ⚠️ 尾部**仍可能出现相邻重复**，而且这是**应该的**：6 张只分到 4 个档位时，
   数学上必然有两张挨着。真实语料里也一样（n24 是 `手,手,身,身,身,空,空,空,空,身,手,手`）。
   门禁只钉「分布对得上 + 确定」，**不钉"零重复"** —— 那是个做不到的断言。
   ⚠️ **必须确定性**：同样的 N 永远给同样的结果 —— 历史还原、断线补跑、门禁都靠它。 */

/** 按权重把 count 个名额分给各档（最大余额法），返回 { 档位: 个数 }。
 *  权重是**百分比**（来自实测），不要求加起来正好 100 —— 会按总和归一。 */
function allocateByWeight(weights, count) {
  const entries = Object.entries(weights || {})
    .map(([key, value]) => [key, Number(value)])
    .filter(([, weight]) => Number.isFinite(weight) && weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const out = new Map();
  if (!entries.length || count <= 0 || total <= 0) return out;
  const remainders = [];
  let assigned = 0;
  for (const [key, weight] of entries) {
    const exact = (weight / total) * count;
    const floor = Math.floor(exact);
    out.set(key, floor);
    assigned += floor;
    remainders.push([key, exact - floor]);
  }
  /* 余下的名额按小数部分从大到小补齐；同小数时按声明顺序（稳定，不引入随机）。 */
  remainders.sort((a, b) => b[1] - a[1]);
  for (let i = 0; assigned < count && remainders.length; i += 1, assigned += 1) {
    const key = remainders[i % remainders.length][0];
    out.set(key, (out.get(key) || 0) + 1);
  }
  return out;
}

/** 把「档位 → 个数」摊成一条**相邻不重复**的序列。
 *  做法：按个数从多到少轮流发牌（每轮每个还有剩余的档各发一张），
 *  于是高频档天然被均匀撒开，不会连着排。
 *  ⚠️ 总数必须在循环**外面**算一次：循环里 `bucket.left` 会被减掉，
 *     拿它现求和当终止条件会越减越小、提前退出 —— 第一版就栽在这，
 *     表现为「N=6 时第 5、6 张分不到任何形态（空串）」且相邻出现重复。 */
function spreadAcross(counts) {
  const buckets = [...counts.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, n]) => ({ key, left: n }));
  const total = buckets.reduce((sum, b) => sum + b.left, 0);
  const out = [];
  let guard = 0;
  while (out.length < total && guard < total + buckets.length + 1) {
    guard += 1;
    for (const bucket of buckets) {
      if (bucket.left <= 0) continue;
      out.push(bucket.key);
      bucket.left -= 1;
    }
  }
  return out;
}

/** 这一篇每一张的**自动分配**人物形态。与 `names` 同序同长。
 *  没有 `shotMix` 声明的技能返回空数组 —— 别的技能一个字都不受影响。 */
export function skillShotMix(skill, names = []) {
  const mix = skill && skill.shotMix;
  if (!mix || typeof mix !== 'object') return [];
  const list = (Array.isArray(names) ? names : []).map(text).filter(Boolean);
  if (!list.length) return [];
  const pool = spreadAcross(allocateByWeight(mix.person, list.length));
  return list.map((name, index) => ({ name, person: pool[index] || '' }));
}

/** 名字 → 生效的人物形态：**用户覆盖优先于自动分配**。
 *  ⚠️ 覆盖按**名字**存而不是按行号（`values.shotOverrides`）—— 改「本篇张数」时
 *     用户已经调过的那几行不会错位。 */
export function skillShotPerson(values, name, fallback = '') {
  const overrides = values && values.shotOverrides;
  const own = overrides && typeof overrides === 'object' ? overrides[name] : null;
  const picked = own && typeof own === 'object' ? text(own.person) : '';
  return picked || text(fallback);
}

/* 第 i 张的取值。0/1 种时没有可收窄的（提示词照原样），所以直接把原值还回去 —— 这样
   "只勾一种"跑出来的请求与改前逐字相同（老参数、老历史还原都不会变味）。
   ⚠️ `series`（同机位连拍）**也要逐张给** —— 见 skillSeriesClause。
   ⚠️ 判断「第 i 张在不在连拍组里」必须按**名字**判，所以取值里带了 `shotNames`
   （与 `shots` 同序）：页面上每一张对应的名字，由页面按勾选顺序给出。
   ⚠️ 2026-09-29 批 DC 续-16：`person`（人物形态）**也是逐张的**。取值走
     `values.shotPerson`（页面按 `shotNames` 算好的一条同序数组：自动分配 + 用户覆盖），
     拿不到就退回全篇的 `values.person`（老数据 / 手工构造的请求逐字不变）。 */
export function skillValuesForShot(values = {}, index = 0) {
  const shots = (Array.isArray(values && values.shots) ? values.shots : []).map(text).filter(Boolean);
  const names = Array.isArray(values && values.shotNames) ? values.shotNames.map(text) : [];
  const at = Math.min(Math.max(Number(index) || 0, 0), Math.max(0, shots.length - 1));
  const scoped = shots.length < 2 ? values : { ...values, shots: [shots[at]] };
  /* ⚠️ 这一段必须写在 `return` 上、**放到上面那个三元之外**：
     只有 1 张时 `scoped === values`，如果把逐张的活放进三元的另一支，单张的篇会静默失效。 */
  const perShotPerson = Array.isArray(values && values.shotPerson) ? values.shotPerson.map(text) : [];
  const person = perShotPerson[at] || text(values && values.person);
  /* ═══ 空镜 ⇒ 方向夹回「居中/无方向」═════════════════════════════════════════════════════
     改前这条规则挂在**字段**上（`direction.disabledWhen = {key:'person'}`），
     而 `person` 现在逐张了 —— 字段级判据接不上，**这条规则会直接断掉**。
     挪到这里逐张判：这一张是空镜就没有横向引导可言（实测 63.7%~86.1% 的图无方向）。
     ⚠️ 只在 `direction` 真的存在时夹，别给别的技能凭空造一个键。 */
  const isEmptyShot = person === '画面里不出现任何人物（空镜或纯静物）';
  const direction = isEmptyShot && values && values.direction
    ? (text(values.directionDefault) || DIRECTION_CENTERED)
    : text(values && values.direction);
  return { ...scoped, ...(person ? { person } : {}), ...(direction ? { direction } : {}), series: skillSeriesClause(values, names[at]) };
}

/* ═══ 同机位连拍（"这一篇里哪几张是同一次拍摄连按的"）══════════════════════════════════════════════
   依据（402 张实测，报告原话）：「他的篇级做法是**一个版式/机位连着用几张，每张换道具/换材质/换文案**，
   而不是"每张都换构图"」—— 74/402（18.4%）落在 21 篇的同机位簇里。

   ⚠️⚠️ 2026-09-29 批 DC 续-15（用户 2026-09-29 当面指出，推翻批 DC 续-3 的「取最前面 N 张」）：
     「这个连拍组为什么**一定要前两张三张**呢，这样生成不就**一定会占用到封面第一张图**吗，
       **我们模仿的那个账号也是这样做的吗？**」

     **重算了那份原始聚类数据，答案是「不是」**：
       · 23 个簇里只有 **5 个**含首图（n4:1/7/8/10、n15:1/8、n29:1/4/5/6/7/8/10、n31:1/2/3/6/7、n36:1/5）；
       · **21 篇里 16 篇（76%）的封面根本不在连拍簇里**；按张数算，**74 张里 54 张（73%）**所在簇
         **不含**首图；
       · 簇**不是开头连续段**，多是中段连着（n19: 3/4/5/7/10/11、n23: 4/5/9/11、n40: 2/3|4/5）；
       · 那 5 篇里首图在簇中时，它本身是**拼版页**而不是静物。
     批 DC 续-3 那行注释「实测里连拍簇**本来就是从第一张开始连着**的」**与数据不符**，已删。

   ⚠️⚠️ 2026-09-29 批 DC 续-17（用户 2026-09-29 第三次当面追问，**整个交互被改掉**）：
     「就比如说有一个用户，他点了第一张图的这个连拍按钮，然后他又点了第 5 张图的这个连拍按钮。
       那第一张和第 5 张会形成连拍吗？那最后这套图片岂不是就变成第一张跟第 5 张是连拍，
       **但是中间又插了第二第三第四张**？他又不跟他们是连拍。」

     ⇒ **改成「这张 + 下一张」成对**。这一轮把那 27 个簇的**位置结构**重算了：
       · 只有 **4/27（15%）**是完整连成一段；**随机打乱对照**（2 万次）实测 55 段 vs
         随机均值 56.9，**p ≈ 0.19** ⇒ 簇**没有位置信号**，"1 和 5 是一组"那种形状
         在数据里确实常见，**但它与随机不可区分**，所以不能当成一种"设计"来照抄；
       · 但**尺寸**非常明确：**中位数 2 张、70% 恰好 2 张**、48.8% 的篇一个簇都没有；
       · 真实摄影里连拍本来就是**相邻帧**（同机位连按），中途插一张别的画面在物理上不成立。
     ⇒ 结论：**成对**（点第 N 行 = 与第 N+1 行一组），一下点完、**不可能跨空档**。
       代价是表达不了 3~4 张的连拍 —— 而那只占 30%。
     ⚠️ 顺带更正一个我引用了三批的**脆弱数字**：「74/402 = 18.4%」**随阈值剧烈变化**
       （TH 0.12 → 11.7%，TH 0.16 → 26.9%；脚本默认 TH=0.06 时只有 4 张 2 簇）。
       ⇒ 引用一律写「**12%–27%**」，不许再把 18.4% 当成一个确定值说。

   ⚠️ 口径也改了（同一轮）：原句「只更换画面里的实体（道具/材质/动作/服装细节）」与
     **逐张人物形态**直接矛盾 —— 同一组里一行空镜、一行躯干，那就不是"只换道具"了。
     实测：簇内人物形态**并不恒定**（表面 63% 是假象，因为 64.9% 的簇内成员本来就是空镜；
     排除"双双空镜"的对之后，簇内一致性 35.0% **低于**随机基线 38.6%）。
     ⇒ 改成锁**机位与布光**、放行**画面里的人与物** —— 那才是实测里真正被锁住的东西
       （前景密度签名锁死、背景亮度组内差 18.7 vs 整篇 62.8、主体占幅锁死；
       变的恰恰是"画面里摆了什么"和对比度）。

   ⇒ 它**进提示词**（`{{series}}`），且**只在被标中的那几张里出现**：组外的张拿不到这句话
     （空串，被 buildSkillBrief 的清理逻辑吃掉），所以"没标连拍组"的篇与改前逐字相同。
   ⚠️ 组内不足 2 张时**不出这句话** —— 「一组 1 张」不成立。 */
export function skillSeriesClause(values = {}, shotName = '') {
  /* ⚠️ 2026-09-29 批 DC 续-18：输入从"一个摊平的名字数组"改成「**若干个连续段**」。
     摊平那个写法（批 DC 续-17）有个真错：一篇里同时有「1~3」与「6~8」两段时，
     它会把 4 张报成**一组**。现在按段查，各段各报各的。 */
  const groups = Array.isArray(values && values.seriesGroups) ? values.seriesGroups : [];
  const name = text(shotName);
  if (!name) return '';
  const group = groups
    .map(entry => (Array.isArray(entry) ? entry : []).map(text).filter(Boolean))
    .find(entry => entry.includes(name));
  if (!group || group.length < 2) return '';
  return '这一张属于本组的「同机位连拍」（本组共 ' + group.length + ' 张：' + group.join('、') + '）：'
    + '本组内**以本条为准** —— 机位、景别、焦段、光线与背景位置完全不变；'
    + '画面里的人与物可以换，但必须一眼能看出是**同一台机器、同一个位置**连着按下的。';
}

export function skillPieceMark(skill, { runId = '', selectedModules = [], values = {} } = {}) {
  const modules = Array.isArray(skill && skill.modules) ? skill.modules : [];
  const picked = new Set((Array.isArray(selectedModules) ? selectedModules : []).map(moduleNameOf));
  const shots = modules.filter(module => picked.has(moduleNameOf(module))).map(moduleNameOf).filter(Boolean);
  /* 没有"篇骨架"的技能不写这一笔（其余技能的作品形状一个字不变）。 */
  if (!shots.length) return null;
  /* 版式族一并记进这一篇：M3 的版式层要按它拼，历史里那条记录也要在**刷新之后**
     还记得自己该拼哪一种（不然"用这组参数"回来就不知道该拼宫格还是底片条）。
     ⚠️ 2026-09-28 批 DC 续-3：「不拼版」是**中性档**（默认），它不算"声明过一个族"——
        写进篇标记只会让历史那边多一个没有意义的字段，所以这一档**不记**（与"没选"同义）。 */
  const layout = text(values.layout);
  const hasFamily = Boolean(layout) && layout !== LAYOUT_FAMILY_NONE;
  return { id: text(runId), shots, size: shots.length, ...(hasFamily ? { layout } : {}) };
}

/* ═══ 「不拼版」这一档的取值（**中性档**，声明源与判据共用同一个字符串）══════════════════════
   2026-09-28 批 DC 续-3 用户口径（逐字）：「**版式族为什么一定要选呢，只有两个选项呀，是必须选吗**」
   ⇒ 复核 402 张之后确认他是对的：拼版只有 **60/402（14.9%）**，**85% 的图是纯粹的单图**；
     我上一版把"每篇必选 + 默认宫格"做成了主菜，既违反实测分布，也违反本仓自己对"默认档"的规矩
     （默认必须是中性档，不许拿一个具体取值冒充默认）。
   ⇒ 现在它是一栏**可选**的声明，默认落在这一档上（= 这一篇每张独立成图，不拼）。
   ⚠️ 这个字面量在 skillRun 里定义、由声明源引用（不是反过来）：imageSkills 已经 import 了
      skillRun（ADAPTIVE_RATIO），反向 import 会成环。 */
export const LAYOUT_FAMILY_NONE = '不拼版';

/* ═══ 版式层要成立，至少要有 2 张（**渲染下限**，2026-09-27 批 DC；判据依据在 0928 改过一次）══════
   ⚠️ 上一版这里写的是"同族至少复用 2 张"（依据：篇内同版式族反复用 74/402 落在 21 篇）——
      **那个依据用错了地方**：74 张量的是"拍摄时同一个机位连着用几张"，属于**出图侧**的规律，
     与"后期把几张拼进一张图"是两件事。用户 2026-09-28 当面点出这一条（原话：「你没有我忽略的
     排版和布局和构图方式呢……你自己调研之后你感觉我说的是不是对的呢」）。
   ⇒ 现在这条规则只表示**渲染下限**：1 张拼不出东西（拼版的意义就是"把几张放进一个版式"）。
     那条实测规律已经挪到它该在的地方 —— 出图侧的「连拍组」（见 skillSeriesClause）。 */
export function pieceLayoutFamilyHolds(family, imageCount = 0) {
  const name = text(family);
  if (!name || name === LAYOUT_FAMILY_NONE) return false;
  const count = Number(imageCount);
  return Number.isFinite(count) && count >= 2;
}

/* ── ① 必填校验：给工作台做「就近错误」，不是提交后才报错 ──
   校验对象是**生效值**（默认值 + 用户填的），否则带默认值的字段会被误判成没填。 */
export function validateSkillInput(skill, values = {}) {
  const effective = { ...initialSkillValues(skill), ...(values || {}) };
  values = effective;
  const missing = [];
  for (const field of (skill && skill.fields) || []) {
    /* 隐藏的字段不参与校验：套图的「各类型张数」只在选了「自定义配置」时才存在，
       拿它去拦「智能匹配」那条路是错的（用户根本没看见这一项）。 */
    if (!skillFieldVisible(field, values)) continue;
    if (!field.required) continue;
    if (field.kind === 'upload') {
      if (!readyUploads(values[field.key]).length) missing.push(field.label);
      continue;
    }
    if (field.kind === 'stepper') continue;   /* stepper 永远有值 */
    /* ⚠️ 2026-09-19 批 G：counts 的"填了没有"不是看字符串，而是看**合计张数** ——
       它决定这次出几张、报多少价，合计为 0 等于"零张订单"，必须拦住。 */
    if (field.kind === 'counts') {
      const min = Math.max(1, Number(field.minTotal) || 1);
      if (skillCountsTotal(field, values) < min) missing.push(field.label + '（至少 ' + min + ' 张）');
      continue;
    }
    if (!text(values[field.key])) missing.push(field.label);
  }
  return { ok: missing.length === 0, missing };
}

/* ═══ 2026-09-25 批 BL：**用户提示词优先于 skill 内置文案**（用户拍板，不是我的判断）══════════
   用户原话：「我觉得不行，你还是要**优先用户的提示词先**，内置的 skill 用户**根本看不到**，
             所以还是要提示词优先。」
   ── 为什么要加这一句（批 BK 查清的事实）──────────────────────────────────────
   `buildSkillBrief` 是**纯字符串替换**：模板里那些固定句子与用户填的内容被拼成**同一段文字**，
   两者之间**没有裁决者**。所以当模板自带的话与用户的要求相反时
   （实测例子：`image.brand_kv` 的模板写着"品牌标识与产品细节必须原样保留"，
     而用户要求"画面内不出现任何品牌标识"），模型会同时收到两句矛盾的话、自己权衡 ——
   而**用户看不见模板**（全仓没有提示词预览），所以他是"盲撞"，被搅了也不知道。
   ── 修法与边界 ────────────────────────────────────────────────────────────
   · 修法：拼好之后**显式声明优先级**，把用户填写的内容标成最高。
     **不改模板、也不删任何句子** —— 模板是这条技能的手艺（商品保真 / 不要水印 / 文字准确
     这些是它的价值），不能因为调整优先级就把它削掉；而"悄悄改写用户看不见的文本"比不改更坏。
   · 依据：站内已有同一原则的明文 —— `src/pages/EcCanvas/canvasPromptAuthority.js` 第 3 层
     「**提示词优先于 skill；skill 只在 prompt 为空时预填**」。
   · ⚠️ 边界：本函数只处理"画什么"（内容意图）这一层。
     **用户自己在配置里的意图仍然更硬** —— 避免出现的元素 / 品牌主色 / 尺寸清晰度 / 平台合规
     属"硬约束层"，画布线的规矩是它"永远最高优先，且冲突时绝不静默"。二者不矛盾：
     那本来就是用户更早、更明确的意图。 */
export const USER_PRIORITY_CLAUSE =
  '【优先级】以上是这条技能的默认做法；用户填写的内容优先级更高 —— 两者冲突时，一律以用户填写的内容为准。';

/* ── ② 文案组装：把用户填的字段填进该 skill 自己的 brief 模板 ──
   brief 写在声明里（{{key}} 占位），所以新增 skill 仍然只需要加声明。 */
export function buildSkillBrief(skill, values = {}) {
  /* 批 CY-㉓：**可选段**语法 `{{?key}}……{{/key}}`。
     批 CY-㉓ 之前只有裸 `{{key}}`：占位符被替换成空串时，它前面那句标签会**留下来**
     （「商品信息：。」这种半截话喂给模型）。清理逻辑能压掉空标点、压不掉空标签。
     ⇒ 新语法让整段**连标签一起消失**：字段没填就当这段不存在。

     为什么现在才加：批 CY-㉓ 要把三个「从来没进过 brief」的用户输入框接进去
     （styleBrief / styleNote / focus）。它们都是**可选**的（用户不填就没有），
     用裸占位符接上去，空填时就会在提示词里多出三段「风格要求：」的空话 ——
     那是用一个新洞换掉旧洞。可选段就是为了让「接进去」这件事没有副作用。 */
  const template = text(skill && skill.brief).replace(
    /\{\{\?(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_match, key, body) => (text(values[key]) ? body : ''),
  );
  const filled = template.replace(/\{\{(\w+)\}\}/g, (_match, key) => text(values[key]));
  /* 未填的可选项会留下空档，压掉多余空白与空标点，避免把「主题：」这种半截话喂给模型 */
  const cleaned = filled
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*[，。；：]\s*(?=[，。；：])/g, '')
    .replace(/\s+([，。；：])/g, '$1')
    .replace(/^[\s，。；：]+|[\s，。；：]+$/g, '')
    .trim();
  /* 只有**用户真的往模板里填了内容**才加这句：
       ① 全空时加它是纯噪声（还白花 token）；
       ② 判据要按**模板里真实用到的占位符**取，不能看"有没有任意非空值" ——
          否则用户只选了比例/清晰度（那些不进提示词）也会被加上一句没有对象的优先级声明。 */
  if (!cleaned) return cleaned;
  const usedKeys = [...template.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]);
  if (!usedKeys.some(key => text(values[key]))) return cleaned;
  /* ⚠️ 拼接符不能用空格（批 BP 修）：模板末尾若是「细节补充」这类**没带标点的半截话**，
     空格会把优先级声明粘成「细节补充 【优先级】…」，读起来像同一句话的一部分。
     句末已有句号时不重复加，没有就补一个 —— 并且要在**清理之后**补，否则会被上面的
     标点压缩逻辑吃掉。 */
  return cleaned + (/[。！？…]$/.test(cleaned) ? '' : '。') + USER_PRIORITY_CLAUSE;
}

/* ── ③ 图片：第一个上传位当主图（image_url），其余当参考图（reference_images）──
   ⚠️ 2026-09-19 批 H：这里原来写 9，而服务端是 **8** ——
      server/index.mjs 的 /api/generate 明确「referenceImages.length > 8」直接 400。
      实测后果：用户传满 9 张参考图时，请求被服务端拒绝、生成失败，而前端的截断逻辑
      却以为自己已经处理好了。两边对齐到 8（服务端是唯一权威）。 */
export const MAX_REFERENCE_IMAGES = 8;

/* 条目的实际宽高：上传就绪时由控件量一次写进条目（FieldRenderer 的 measureBox）——
   批 R 的「自适应」比例要用它。没量到就返回 null（回落 1:1，不猜一个尺寸出来）。 */
function imageBox(item) {
  const width = Number(item && item.width) || 0;
  const height = Number(item && item.height) || 0;
  return width > 0 && height > 0 ? { width, height } : null;
}

/* 逐张跑：声明 skill.runsFollow = '<上传位 key>' 的技能，**一次运行只服务那一张参考图**
   （第 i 次运行只带第 i 张）。图片复刻就是这么回事 —— 见 skillRunsFollow 的注释。 */
export function skillRunsFollow(skill) {
  const key = text(skill && skill.runsFollow);
  if (!key) return '';
  return ((skill && skill.fields) || []).some(field => field.key === key && field.kind === 'upload') ? key : '';
}

export function skillImages(skill, values = {}, { slotIndex = 0 } = {}) {
  const slots = ((skill && skill.fields) || []).filter(field => field.kind === 'upload');
  const primary = slots[0] ? readyUploads(values[slots[0].key]) : [];
  /* fail-closed：主图没就绪就一张图都不给。
     半截素材只会生成出"看着像成功了、其实不是我要的"结果 —— 那是最难查的一类 bug。 */
  if (slots.length && slots[0].required && !primary.length) return { imageUrl: '', referenceImages: [], references: [], primaryBox: null };
  const imageUrl = primary.length ? text(primary[0].url) : '';
  const referenceImages = [];
  const references = [];
  /* 主图位里**除第一张以外**的也要当参考图发出去（2026-09-21 修）——
     知渔那一格的原文是「商品图会作为一组打包参考，最多 4 张」，我们却只发了第一张：
     用户传满 4 张时，计数写着 4/4、实际只用了 1 张，另外 3 张**静默丢掉**（最难查的那类 bug）。 */
  for (const item of primary.slice(1)) {
    if (referenceImages.length >= MAX_REFERENCE_IMAGES) break;
    referenceImages.push(text(item.url));
    references.push({
      url: text(item.url),
      assetId: text(item.assetId),
      displayName: text(item.name),
      role: slots[0].role || 'product',
      order: referenceImages.length - 1,
    });
  }
  const runsFollow = skillRunsFollow(skill);
  for (const field of slots.slice(1)) {
    let items = readyUploads(values[field.key]);
    /* 逐张跑的技能：这一次运行只带**第 slotIndex 张**（第 0 次带第 0 张…） */
    if (runsFollow === field.key && items.length) items = [items[slotIndex % items.length]];
    for (const item of items) {
      if (referenceImages.length >= MAX_REFERENCE_IMAGES) break;
      referenceImages.push(text(item.url));
      references.push({
        url: text(item.url),
        assetId: text(item.assetId),
        displayName: text(item.name),
        role: field.role || 'reference',
        order: referenceImages.length - 1,
      });
    }
  }
  /* 主图同时也是最有分量的参考图：把它放进 reference_metadata 让服务端知道来龙去脉 */
  if (imageUrl) {
    references.unshift({ url: imageUrl, assetId: text(primary[0].assetId), displayName: text(primary[0].name), role: slots[0].role || 'product', order: 0 });
  }
  return { imageUrl, referenceImages, references: references.slice(0, MAX_REFERENCE_IMAGES), primaryBox: imageBox(primary[0]) };
}

/* ── ④ 生成参数：比例 / 清晰度 / 数量 / 模型 / 服务端视觉方向 ──
   ⚠️ 批 R：**模型**从声明里来（field.key = 'imageModel'，选项引用
      services/imageModelCatalog.js 那一份目录，见 imageSkills 的 modelField）。
      从前这里写死 DEFAULT_IMAGE_MODEL —— 界面给不给模型是界面的事，
      但"用户选的模型必须真的进入请求、并且真的参与计费"是这一层的责任：
      skillPointsEstimate 读的就是同一个 settings，改模型 → 报价跟着变，不会各说各话。 */
export function skillGenerationSettings(skill, values = {}) {
  /* 比例：显式档位按原值；'自适应' 按**主图实际宽高**就近取一档
     （知渔的 help 原文口径，见文件上方 nearestLegalRatio）；量不到主图就回落声明里的默认档。 */
  const askedRatio = text(values.ratio);
  const box = askedRatio === ADAPTIVE_RATIO ? (skillImages(skill, values).primaryBox || null) : null;
  const adaptiveRatio = box ? nearestLegalRatio(box.width, box.height) : '';
  const ratio = askedRatio === ADAPTIVE_RATIO
    ? (adaptiveRatio || defaultSkillRatio(skill))
    : (LEGAL_RATIOS.has(askedRatio) ? askedRatio : defaultSkillRatio(skill));
  const askedResolution = (text(values.clarity) || DEFAULT_RESOLUTION).toUpperCase();
  /* ⚠️ 2026-09-19 批 I-9：上限从 **9 → 16**。
     原因是「包含模块」那条链：A+ 内容有 16 个模块，勾满就是 16 张，
     而这里一直夹在 9 —— 结果是"用户勾了 16 个，只出 9 张、也只收 9 张的钱"，
     一个**静默的错**（不报错、不提示，用户只会觉得少给了）。
     16 是当前声明源里模块数的上限（imageSkills 的 A+ 那 16 条），
     其它技能靠 countField(n) 自己声明上限（都 ≤ 9），所以抬这条不会放宽它们。 */
  /* ═══ 2026-09-21（用户第 22 轮）：逐张跑的技能，张数 = **上传了几张就出几张** ═══════════════
     用户原话（逐字）：「他这里的案例指的是上面 3 张原图分别对应下面 3 张的复刻结果啊，
       用户上传一张肯定就复刻一张，上传两张就复刻两张，上传 3 张就复刻 3 张不是吗？」
     知渔自己的示例区原文也是这么写的：「上传风格参考图与商品图包，AI **按参考图数量**批量输出
       风格高度一致的商品主图」（2026-09-21 CDP 实采，见 docs/design/data/quantv-image-builtin-pages.json）。
     ⇒ 声明 skill.runsFollow = '参考图那一格' 的技能：count = 那一格已就绪的张数（没有就 1 张）。
        ⚠️ 我们上一批按"固定 6 张"理解是**错的**（6 只是他们示例区 3 原图 + 3 复刻图的配对示意）。 */
  const runsFollow = skillRunsFollow(skill);
  const followed = runsFollow ? readyUploads(values[runsFollow]).length : 0;
  const count = runsFollow
    ? Math.max(1, followed)
    : Math.max(1, Math.min(16, Number.parseInt(values.count, 10) || 1));
  const visual = SERVER_VISUAL_SKILL_IDS.includes(skill && skill.visual) ? skill.visual : 'free';
  /* 模型：不认识的取值回落到有出图记录的 image2（normalizeImageModel 自带兜底） */
  const imageModel = normalizeImageModel(values.imageModel, DEFAULT_IMAGE_MODEL);
  /* 清晰度不能超出这个模型的档位（例：Midjourney 上游只有 1K/2K）。
     允许的档位来自**模型目录**（imageModelCatalog.imageModelResolutions），不另立一份。 */
  const allowedResolutions = imageModelResolutions(imageModel).filter(item => LEGAL_RESOLUTIONS.has(item));
  const resolution = allowedResolutions.includes(askedResolution)
    ? askedResolution
    : (allowedResolutions.includes(DEFAULT_RESOLUTION) ? DEFAULT_RESOLUTION : allowedResolutions[0]);
  return {
    ratio: LEGAL_RATIOS.has(ratio) ? ratio : FALLBACK_RATIO,
    resolution: resolution || DEFAULT_RESOLUTION,
    count,
    imageModel,
    visualSkillId: visual,
  };
}

/* ═══ 批 R：字段之间的联动夹取（声明源写 field.optionsFrom）════════════════════════════════
   真事：模型选了 Midjourney（上游只有 1K/2K）而清晰度停在 4K —— 界面显示 4K、
   请求按 2K 跑、也按 2K 计费。那正是"看着是 A、跑的是 B"。
   所以换模型的同一刻，把依赖它的字段夹回合法档（唯一判据 = 声明里的 optionsFrom.map）。 */
export function reconcileFieldValues(fields, values = {}) {
  const next = { ...values };
  /* ═══ 批 DC（M2）：disabledWhen —— 条件成立时把这一格夹回**它自己的默认档** ═══════════════════
     渲染层已经把控件禁掉了，但如果用户先选了"左→右"、再把人物形态换成"空镜"，
     旧值会留在生效值里 —— 那就是"界面锁着、提示词照旧带着方向"（看着是 A、跑的是 B）。
     ⚠️ 夹回的是**声明里的默认档**（不是空串）：界面上那一格仍然显示一个具体档位。 */
  for (const field of Array.isArray(fields) ? fields : []) {
    if (!skillFieldLocked(field, next)) continue;
    const fallback = field.default ?? (Array.isArray(field.options) && field.options[0] ? field.options[0].value : '');
    if (String(next[field.key] ?? '') !== String(fallback)) next[field.key] = fallback;
  }
  for (const field of Array.isArray(fields) ? fields : []) {
    const rule = field && field.optionsFrom;
    if (!rule || !rule.key || !rule.map) continue;
    const allowed = rule.map[String(next[rule.key] ?? '')];
    if (!Array.isArray(allowed) || !allowed.length) continue;
    const current = text(next[field.key]);
    /* 夹取给**该模型能给的最高的那一档**（allowed 按低→高声明）：
       用户原来选的是更高的档，被夹时不该被悄悄降到最低 —— 那是"少给了还不说"。 */
    if (current && !allowed.some(value => String(value) === current)) next[field.key] = allowed[allowed.length - 1];
  }
  return next;
}

/* ── ⑤ 积分预估：单位与后端 catalog 同源（1 积分 = 1000 units），只用于按钮上展示 ── */
export function skillPointsEstimate(skill, values = {}) {
  const { imageModel, resolution, count } = skillGenerationSettings(skill, values);
  const unitsPerImage = generationUnits(imageModel, resolution) || 0;
  return Number(((unitsPerImage * count) / 1000).toFixed(2));
}

/* ── ⑥ 组装成 regenerateCanvasImage 的入参（页面只调这一个函数）── */
export function buildSkillRequest(skill, values = {}, { runId = '', slotIndex = 0 } = {}) {
  const brief = buildSkillBrief(skill, values);
  /* slotIndex 一路传到 skillImages：逐张跑的技能靠它决定"这一次带哪一张参考图" */
  const images = skillImages(skill, values, { slotIndex });
  const settings = skillGenerationSettings(skill, values);
  return {
    prompt: brief,
    imageUrl: images.imageUrl,
    referenceImages: images.referenceImages,
    references: images.references,
    ratio: settings.ratio,
    resolution: settings.resolution,
    imageModel: settings.imageModel,
    creationIntent: 'visual',
    skillId: settings.visualSkillId,
    requestKey: runId ? runId + ':' + (slotIndex + 1) : '',
  };
}

/* ═══ 2026-09-28 批 DC 续-7 · 一：**文案与出图同源、但不是同一次请求** ═══════════════════════
   用户 2026-09-28 当面问的（逐字）：「如果你要产出的是一整套的小红书图文的话，那肯定是文案一起出的话
   会更加统一吧，因为如果把文案我们后面再单独去生成出来的话，他是不是跟你的图片其实又不在一个体系内呢？
   很有可能是你先去生成图片，然后再拿图片去生成文案，这样的话会很混乱。」
   ⇒ 结论：**一次下单 = N 张图 + 1 组文案**（一篇图文才是交付单元，小红书的发布单位本来就是一篇笔记），
     但两者**并行**发起、**各自计费**。
   ── 为什么请求体里**不能有图片 URL**（这一条是本批的判据，门禁逐字守着）──────────────────
     · 出图那跳的产物是像素。prompt 里没有一个像素能变成标题，硬塞进去只会挤占图像描述的 token，
       标题与正文反而变差。
     · 文案必须是「**同源的两个渲染**」——同一份 brief、两种输出。
     · 一旦改成"看图说话"，模型会退化成**图片说明**（「这是一张木桌上的白瓷器」），
       那是最烂的小红书文案：它只会描述已经看得见的东西。
     · 所以宁可让文案与图各自独立，也不要让文案去"读图"。 */

/** 这条技能要不要在出图的那一次提交里**顺带**出文案（默认跟、不重复问一次）。 */
export function skillCopyShouldRun(skill, values = {}) {
  const source = values && values.postCopyEnabled;
  /* 显式关掉就是关掉（用户在 CTA 旁边那一行关的）；没有这一项的技能一律不出文案。 */
  return skill && skill.id === 'image.concept_set' && source !== false;
}

/** 文案那一跳的入参。**只有这一篇的策划要素，没有任何一个图片地址。**
 *  ⚠️ shots 传的是**手法名 + 执行定义**（与出图时逐张用的是同一份字符串），
 *     不是"图 1 是静物、图 2 是场景"这种看图得来的描述。 */
export function buildSkillCopyRequest(skill, values = {}, { attempt = 0 } = {}) {
  const effective = { ...initialSkillValues(skill), ...(values || {}) };
  const shots = (Array.isArray(effective.shots) ? effective.shots : []).map(text).filter(Boolean);
  return {
    theme: text(effective.theme),
    shots,
    /* ⚠️ 2026-09-29 批 DC 续-16：人物形态**逐张**之后没有"这一篇的人物形态"了，
       而文案是**篇级**的那一跳（一份标题 + 一段正文 + 话题标签），它需要一个人物形态的概括。
       ⇒ 取 `shotPerson` 里的**众数**（这一篇出现最多的那一档）—— 那正是"这篇大致是什么调"；
       逐张各发各的，文案接不住也不该接。
       退化顺序：全篇 `person`（老数据 / 手工构造的请求）→ `shotPerson` 众数 → 空串。 */
    person: text(effective.person) || modalOf((Array.isArray(effective.shotPerson) ? effective.shotPerson : []).map(text)),
    notes: text(effective.notes),
    product: text(effective.product),
    /* 随篇首发 = batch:0；「再来一版」= 1,2…（幂等键不能撞，见 conceptCopyActionId）。 */
    attempt: Math.max(0, Number(attempt) || 0),
    /* ⚠️ 门禁 test/concept-set-post-0929 逐字断言：这两个键必须恒为空。
       一旦有人"顺手把图带上去"，这一版就变成看图说话 —— 那是最差的一版文案。 */
    imageUrl: '',
    referenceImages: [],
  };
}

/** 众数：出现最多且非空的那一个。同数时取**第一次出现**的 —— 确定，不引入随机。 */
function modalOf(list) {
  const counts = new Map();
  for (const item of list) {
    if (!item) continue;
    if (!counts.has(item)) counts.set(item, { n: 0, first: counts.size });
    counts.get(item).n += 1;
  }
  let best = '';
  let bestN = 0;
  let bestFirst = Infinity;
  for (const [key, { n, first }] of counts) {
    if (n > bestN || (n === bestN && first < bestFirst)) {
      best = key;
      bestN = n;
      bestFirst = first;
    }
  }
  return best;
}

/** 技能声明了规模预设时的那一格（`shotPreset`）。**只有这一格**能改清单的勾选规模 ——
 *  写在字面量上，页面里就不必再写一份"哪个字段管勾选"。 */
export const SKILL_MODULES_PRESET_KEY = 'shotPreset';

/** 进页面时的默认勾选（关掉的那几个 = moduleOff 的成员）。
 *
 *  ⚠️ 两种技能必须区别对待，这是两次不同的用户拍板，不能互相覆盖：
 *   · **声明了 `modulesPresets`**（现在只有「概念视觉方案」）：进页面就按默认档**勾好** ——
 *     用户 2026-09-28 当面问「**你这个工作台里面并没有给我张数呀。我根本就不知道你产出的到底是多少张**」，
 *     而默认全不勾 + 「已选 0/10」那行让人既看不出张数、又点不动按钮（批 DC 续-7 的根因）。
 *   · **没声明**（A+ 内容的 16 个内容模块等）：进页面**一个都不勾** ——
 *     批 AW 用户原话「而且好像他们也不是默认打勾的吧……跟他们一样做就好」，这一条不许被上面那条改掉。
 */
export function skillInitialModuleOff(skill, modules = []) {
  const list = Array.isArray(modules) ? modules : [];
  const presets = Array.isArray(skill && skill.modulesPresets) ? skill.modulesPresets : [];
  if (!presets.length) return new Set(list.map(module => text(module && module.name)));
  const field = ((skill && skill.fields) || []).find(item => item && item.key === SKILL_MODULES_PRESET_KEY);
  const wanted = text(field && field.default) || text(presets[0].value);
  const preset = presets.find(item => text(item && item.value) === wanted) || presets[0];
  const count = Math.max(0, Math.min(list.length, Number(preset.count) || 0));
  return new Set(list.slice(count).map(module => text(module && module.name)));
}

/* ═══ 2026-09-28 批 DC 续-7 · 二：按钮上**写清单价与总额**（docs/design/90 §6.5 的口径）════════
   原来按钮上只有一个孤零零的「12 积分」，用户看不出是"6 张 × 2"还是"一张 12"——
   而这一页恰恰是**按张计价**的（勾几张出几张），所以单价与张数必须一起出现。
   `copyPoints` 由调用方传进来（文案价是计费目录的事，skillRun 不去 import 服务层）。
   ⇒ 返回一个纯对象 + 一句人话，页面只负责把它放进按钮（不自己拼价）。 */
export function skillBatchQuote(skill, values = {}, { copyPoints = 0 } = {}) {
  const count = skillGenerationSettings(skill, values).count;
  const imagePoints = skillPointsEstimate(skill, values);
  const perImage = count > 0 ? Number((imagePoints / count).toFixed(2)) : 0;
  const copy = Math.max(0, Number(copyPoints) || 0);
  const total = Number((imagePoints + copy).toFixed(2));
  const parts = [`${count} 张 × ${perImage}`];
  if (copy) parts.push(`文案 ${copy}`);
  return {
    count, imagePoints, perImage, copyPoints: copy, total,
    detail: parts.join(' + ') + ` = ${total} 积分`,
  };
}

/* ── ⑦ 运行方式（决定 CTA 点了以后发生什么）────────────────────────────────
   用户 9-17 口径：「生成结果直接在工作台里面展示，不必像之前一样生成完就一定要跳进去画布
   里面……如果是在子页面的工作台生成的，就会在各自的子页面历史记录里面。」
   所以**能就地跑完的都必须就地跑完**，一条都不许把人踢出这一页。
     · 'inline'  单图链路（visualCreation / builtinSkill）—— 就地出图
     · 'suite'   电商套图 —— 就地跑既有套图引擎（多张、多分钟），结果留在工作台与历史
     · 'embed'   小红书图文 / 视频 —— 把它们**自己的既有工作台整块搬进子页面**
                 （见 skillEmbedOf；不是重写一遍，是把已经跑通的组件嵌进来）
     · 'handoff' 目前**没有技能该走这一态**，保留它是为了「确实没有组件可嵌」的将来留出口：
                 真出现这种情况时，宁可老实说"去某某工作台继续"，也不要在这里做个半成品。
   ⚠️ 判据只有一条：**这一页能不能把这条链路跑完并交出结果**。
      跑得完 = inline/suite/embed（结果与历史都留在本页）；跑不完才允许 handoff。 */
export function skillRunKind(skill) {
  const pipeline = skill && skill.pipeline;
  if (pipeline === 'ecommerceSuite') return 'suite';
  if (skillEmbedOf(skill)) return 'embed';
  return 'inline';
}

/* 可整块嵌入子页面的既有工作台：
     · xhsNote          → 小红书图文工作台（pages/Home/XhsContentMode，首页同一份组件）
     · videoSmart 等视频 → 视频工作台（pages/VideoStudio，首页同一份组件，embedded 形态）
   返回组件键（'xhs' | 'video'），页面据此决定嵌哪一块；返回 '' 表示没有可嵌的组件。 */
export function skillEmbedOf(skill) {
  const pipeline = skill && skill.pipeline;
  if (pipeline === 'xhsNote') return 'xhs';
  if (typeof pipeline === 'string' && pipeline.startsWith('video')) return 'video';
  return '';
}

export function isHandoffSkill(skill) {
  return skillRunKind(skill) === 'handoff';
}

/* 视频技能的 pipeline → 视频工作台的创作方式（composer 的 mode 页签）。
   ⚠️ 页签只有三档（videoStudioModel.VIDEO_CREATION_MODES = smart / frame / remake），
      「全能参考」不是一个页签 —— resolveVideoApiMode 是**按素材算**的：
      smart 档一旦带了图片/视频/音频，API 模式自己就变成 reference。
      所以 videoReference 系的技能要落在 smart 档（素材一上传就走参考链路），
      映射成 'reference' 反而会选中一个不存在的页签。
   认不出来 → 空串，交给工作台用它自己的默认值（不硬塞一个错的模式）。 */
export const VIDEO_MODE_BY_PIPELINE = Object.freeze({
  videoSmart: 'smart',
  videoFrame: 'frame',
  videoRemake: 'remake',
  videoReference: 'smart',
});
export function skillVideoMode(skill) {
  return VIDEO_MODE_BY_PIPELINE[(skill && skill.pipeline) || ''] || '';
}

/* ── ⑧ 套图（suite）的就地运行参数 ──────────────────────────────────────────
   套图与单图是**两套引擎、两套计价**：
     · 单图：一次请求一张，按张计价（ec_image_2k = 1 积分/张）
     · 套图：一次任务一套 N 张，先按「方案张数」报价，服务端建 hold 之前会校验报价，
             数量对不上就干净报错、**不扣费**（fail-safe）
   所以这里必须用与面板同一份 resolveEcommercePlan 算出张数与报价请求。 */
/* ═══ 批 CY-⑯：平台名单收敛成**一份真源** + 加一个归一化 ═══════════════════════════════════════
   事故（可证伪）：EcStudio 的平台选择给的是
     ['淘宝','京东','拼多多','**小红书电商**','**抖音电商**','**亚马逊**']（6 档、带「电商」后缀、有亚马逊），
   而下面这一行是
     const platform = SUITE_PLATFORMS.includes(text(values.platform)) ? … : SUITE_DEFAULT_PLATFORM;
     SUITE_PLATFORMS = ['淘宝','抖音','小红书','拼多多','京东']（5 档、无后缀、**没有亚马逊**）
   ⇒ 用户在 EcStudio 选「亚马逊」或「小红书电商 / 抖音电商」，**被静默改写成淘宝**：
     他以为自己生成了亚马逊站位的图（1000×1000 纯白底 6 张无文字），实际跑的是淘宝规则，
     而且**照常计费**。界面上不报错、不提示。
   EcAuto 的平台 key 是 ['淘宝','京东','拼多多','抖音','**亚马逊**','小红书'] ⇒ 同样中招。

   两件事一起做：
     ① `SUITE_PLATFORMS` 补上**亚马逊**（它已经是两个界面真实在提供的平台，
        藏起来不是修复、是让用户选不到自己要的站位）；
     ② 加 `normalizeSuitePlatform`：把「小红书电商 / 抖音电商 / 小红书网店…」这类**同平台别名**
        归一到规范名。这样**任何**入口传进来的值都不会再被静默吞掉。
        归不出来的**仍然回落默认**（fail-safe），但会在 dev 下留一条 warn ——
        「静默改成别的平台」比「报错」更难被发现。 */
export const SUITE_PLATFORMS = Object.freeze(['淘宝', '抖音', '小红书', '拼多多', '京东', '亚马逊']);
export const SUITE_DEFAULT_PLATFORM = '淘宝';

/** 界面上显示的名字（**只是文案**，协议值仍是上面那六个规范短名）。
 *  以前 EcStudio 直接把「小红书电商 / 抖音电商」当**值**用，
 *  那两个值不在 SUITE_PLATFORMS 里 ⇒ 被静默改写成淘宝。现在值与文案分开。 */
export const SUITE_PLATFORM_LABELS = Object.freeze({
  淘宝: '淘宝/天猫',
  抖音: '抖音电商',
  小红书: '小红书电商',
  拼多多: '拼多多',
  京东: '京东',
  亚马逊: '亚马逊',
});

/** 平台别名 → 规范名（同平台的写法差异，不新增平台）。 */
const SUITE_PLATFORM_ALIASES = Object.freeze({
  '小红书电商': '小红书',
  '抖音电商': '抖音',
  '快手': '抖音',
  '淘宝天猫': '淘宝',
  '天猫': '淘宝',
  'amazon': '亚马逊',
  'amazon.com': '亚马逊',
  '拼多多多多': '拼多多',
});

/**
 * 把任意来源的平台值归一到 SUITE_PLATFORMS 里的规范名。
 * @returns {{ value: string, matched: boolean }} matched=false 表示**不认识**，调用方要留痕。
 */
export function normalizeSuitePlatform(input) {
  const raw = text(input);
  if (!raw) return { value: SUITE_DEFAULT_PLATFORM, matched: false };
  if (SUITE_PLATFORMS.includes(raw)) return { value: raw, matched: true };
  const alias = SUITE_PLATFORM_ALIASES[raw] || SUITE_PLATFORM_ALIASES[raw.toLowerCase()];
  if (alias && SUITE_PLATFORMS.includes(alias)) return { value: alias, matched: true };
  return { value: SUITE_DEFAULT_PLATFORM, matched: false };
}

/* 套图要的是"已拥有的资产引用"（assetId + /api/generated-assets/ 地址），
   服务端据此直接把素材挂进方案，不会再让我们把图片重传一遍。 */
export function suiteOwnedInputs(values = {}) {
  return readyUploads(values.assets)
    .filter(item => text(item.assetId) && /^\/api\/generated-assets\//i.test(text(item.url)))
    .map(item => ({ assetId: text(item.assetId), url: text(item.url), role: 'product' }))
    .slice(0, 6);
}

export function buildSuiteRun(skill, values = {}) {
  /* 批 CY-⑯：原来这里是 `SUITE_PLATFORMS.includes(…) ? … : SUITE_DEFAULT_PLATFORM` ——
     EcStudio 传的「小红书电商 / 抖音电商 / 亚马逊」三个值都不在那 5 个里，
     于是**静默变成淘宝**：用户以为生成了亚马逊站位的图，实际跑的是淘宝规则，还照常计费。
     现在走归一化：同平台别名归一（小红书电商→小红书），亚马逊是真平台（已在名单里），
     真正认不出来的仍回落默认，但**必须留痕** —— 静默换平台比报错更难被发现。 */
  const normalizedPlatform = normalizeSuitePlatform(values.platform);
  if (!normalizedPlatform.matched && text(values.platform)) {
    /* 只在开发期出声：生产环境静默 warn 反而是噪音，但这条路径必须能被测试看见，
       所以门禁直接断言 normalizeSuitePlatform 的返回值，不依赖 console。 */
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[suite] 不认识的平台值，已回落默认：', values.platform);
    }
  }
  const platform = normalizedPlatform.value;
  const productInputs = suiteOwnedInputs(values);
  /* 商品名是服务端必填项：取「商品信息」的第一行，没有就给一个中性占位（不编造品牌） */
  const productName = (text(values.productParams).split(/\r?\n/).map(line => line.trim()).filter(Boolean)[0] || '').slice(0, 40) || '商品';
  /* ═══ 2026-09-19 批 G（用户批注 #10）：「自定义配置选中之后，里面还有其他的配置可以做呀」═══
     那一组按类型配的张数（structureCounts）此前**只是显示** —— 没有任何地方消费它：
     用户把白底图从 1 调到 4，出图张数与报价一个字都不变。那正是"装出来的功能"。
     现在接上：选了「自定义配置」就把这组张数当成套图的图集来源（sizing.images），
     于是**张数、报价、服务端方案**三者同源（都走 resolveEcommercePlan 这一份计算）。
     ⚠️ 只在「自定义配置」时生效：选「智能匹配」时这张表根本不显示（visibleWhen），
        拿一个用户看不见的值去报价是错的。
     ⚠️ 合计为 0 时**不接管**（回落到平台预设）—— 零张订单没有任何意义，
        而且校验层（validateSkillInput）本来就会把它拦在 CTA 之前。 */
  const customCounts = values.structure === '自定义配置' && values.structureCounts && typeof values.structureCounts === 'object'
    ? Object.entries(values.structureCounts)
        .map(([key, count]) => ({ key, count: Math.max(0, Number(count) || 0) }))
        .filter(item => item.count > 0)
    : [];
  const sizing = {
    resolution: DEFAULT_RESOLUTION,
    imageModel: DEFAULT_IMAGE_MODEL,
    ...(customCounts.length ? { images: customCounts } : {}),
  };
  const plan = resolveEcommercePlan({ platform, sizing, resolution: DEFAULT_RESOLUTION, imageModel: DEFAULT_IMAGE_MODEL });
  const unitsPerImage = generationUnits(DEFAULT_IMAGE_MODEL, DEFAULT_RESOLUTION) || 0;
  return {
    platform,
    productName,
    productInputs,
    /* sizing.images 是服务端认的**唯一图集来源**（generateEcommerce 会把同值镜像到 image_selections）——
       必须把算出来的 plan.images 原样带过去，服务端才会算出同一套方案 */
    sizing: { ...sizing, images: plan.images },
    plan,
    points: Number(((plan.quantity * unitsPerImage) / 1000).toFixed(2)),
  };
}
