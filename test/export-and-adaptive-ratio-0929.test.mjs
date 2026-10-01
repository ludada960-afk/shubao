// test/export-and-adaptive-ratio-0929.test.mjs
// 2026-09-29 批 CY-⑭。两条用户点名的事，各自一个纯函数 + 门禁：
//
//   ① 导出弹窗的文案与文件名
//      「为什么叫**导出整套图片**呀？……他明明只是对一张图片去进行操作呀，那肯定就是导出一张图片呀。」
//      「图片的名字是一堆乱码。」「这个左上角的标题命名为什么是**电商图片交付**呢……
//        我们现在是面向的是通用的用户，什么图片都可以在我们这里生成并且导出的。」
//   ② 尺寸里的「自适应」
//      「是不是应该在尺寸的**最前面**加入一个？**自适应**的一个选项，我看他们的竞品他们都是有这个选项的。」
//      竞品证据（用户自己截的图）：**图片生成有、视频生成没有**。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { exportDialogCopy } from '../src/pages/EcCanvas/exportCopyModel.js';
import { deliveryNameFor, looksLikeContentHash } from '../src/pages/EcCanvas/deliveryNameModel.js';
import { resolveAdaptiveRatio, resolveProtocolRatio, ADAPTIVE_RATIO, withAdaptiveRatioOption } from '../src/pages/EcCanvas/canvasAdaptiveRatio.js';
import { safeDeliveryName } from '../src/pages/EcCanvas/browserFileDelivery.js';
import { VISUAL_RATIO_OPTIONS } from '../src/pages/Home/visualCreationModel.js';
import { IMAGE_RATIOS } from '../src/services/imageSizeCatalog.js';
import { skillGenerationSettings, ADAPTIVE_RATIO as SKILL_ADAPTIVE } from '../src/skills/skillRun.js';
import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const canvasPage = read('src/pages/EcCanvas/index.jsx');
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '');

/* ═══ ① 导出文案：按**实际可交付张数**决定，不按入口 ═════════════════════════════ */

test('只有一张可交付时，主选项必须说"导出这张图片"，不许说"导出整套"', () => {
  /* 事故：文案由 `exportIntent`（**入口标记**）决定，只有逐图入口会置成 'single'；
     从顶栏「导出」进来哪怕最后只剩 1 张，标题仍是「电商图片交付」+「导出整套图片」。 */
  const one = exportDialogCopy({ count: 1 });
  assert.equal(one.single, true);
  assert.equal(one.title, '导出这张图片');
  assert.ok(!JSON.stringify(one).includes('整套'), '单图场景一个字都不许出现「整套」');
});

test('单图场景**整块隐藏**长图选项（不是渲染出来置灰 —— 用户照样会读到它）', () => {
  const one = exportDialogCopy({ count: 1, canLongDetail: true });
  assert.equal(one.longDetailVisible, false);
  assert.deepEqual(one.options.map(o => o.mode), ['images'], '单图只给一个选项');
  const many = exportDialogCopy({ count: 5, canLongDetail: true });
  assert.equal(many.longDetailVisible, true);
  assert.deepEqual(many.options.map(o => o.mode), ['images', 'long-detail']);
});

test('多张时标题写清张数，且不再出现「电商」二字', () => {
  const many = exportDialogCopy({ count: 6, excludedCount: 2 });
  assert.equal(many.title, '导出 6 张图片');
  assert.match(many.subtitle, /已排除 2 张原始素材/);
  assert.ok(!JSON.stringify(many).includes('电商'), '我们是通用创作平台，弹窗标题不许再自称「电商图片交付」');
});

test('一张都没有时要说实话，不要显示「导出 0 张」', () => {
  /* ⚠️ 2026-09-30 批 CY-㊴：这条门禁**加强**了。
     原版只断言了 title 与 subtitle，漏掉了真正被用户看见的那句 ——
     `options[0].label` 在 count=0 时被拼成了「导出 0 张图片」，就显示在弹窗里
     （用户 9-30 截图里就是它）。本条现在把 options 一并钉住：零张时**一条选项都不给**。 */
  const none = exportDialogCopy({ count: 0 });
  assert.equal(none.title, '没有可导出的图片');
  assert.match(none.subtitle, /没有可导出的生成结果/);
  assert.deepEqual(none.options, [], '零张时不渲染任何选项按钮（否则就会出现「导出 0 张图片」）');
  assert.ok(!JSON.stringify(none).includes('0 张图片'), '整个返回值里都不许出现「0 张图片」');
  /* 零张时正确的做法是告诉用户"怎么才能导出"，而不是留一个点不动的按钮 */
  assert.ok(none.hints.length > 0, '零张时要给出下一步指引');
  assert.match(none.hints.join('\n'), /选中|框选/, '指引必须说清楚怎么才能导出');
});

test('必须告诉用户：除了单张，还能多选导出、还能拼长图（用户 9-30 逐字点名）', () => {
  /* 用户原话：「只有一个导出按钮，我觉得也是可以的，但是你得告诉用户，
     除了导出单张之外，我们还可以导出多张，并且我们还可以导出合成的长图。」 */
  const one = exportDialogCopy({ count: 1 });
  const hints = one.hints.join('\n');
  assert.match(hints, /Shift|框选/, '单张场景必须告诉用户怎么一次导出多张');
  assert.match(hints, /长图/, '单张场景必须告诉用户能拼长图（长图选项在这一档是隐藏的）');
  /* 凑得齐长图时，长图本身就是可点的选项 ⇒ 不必再重复提示 */
  const stitchable = exportDialogCopy({ count: 4, canLongDetail: true });
  assert.equal(stitchable.hints.filter(h => /长图/.test(h)).length, 0, '长图已经是可点选项了，不要再重复提示');
  assert.ok(stitchable.hints.some(h => /选中|框选/.test(h)), '但仍然要说明可以只导出其中几张');
  /* 在长图那一档里就别再推销"怎么拼长图"了 —— 用户已经在里面了 */
  const inLong = exportDialogCopy({ count: 4, canLongDetail: true, longDetail: true });
  assert.deepEqual(inLong.hints, [], '长图档内不再给提示');
});

test('画布里那句「电商图片交付 / 导出整套图片」必须真的删干净了', () => {
  const code = stripComments(canvasPage);
  assert.ok(!code.includes('电商图片交付'), '「电商图片交付」必须消失');
  assert.ok(!code.includes('导出整套图片'), '「导出整套图片」必须消失');
  assert.match(code, /exportDialogCopy\(\{/, '弹窗文案必须来自 exportDialogCopy');
  /* 遮罩的 z-index 也一并回归权威（用户 ③：层级搞错了） */
  assert.ok(!/zIndex:\s*1000\d/.test(code), '画布里不许再有 1000x 的裸 z-index');
});

/* ═══ ② 导出文件名：64 位哈希不许落到磁盘上 ═══════════════════════════════════ */

test('长得像内容哈希的名字一律判为无效（这就是"图片名字是一堆乱码"的判据）', () => {
  assert.equal(looksLikeContentHash('a9f2e9cd0b3922a2e7f2a96f50458a832657d1797825c88de65546ca8deb5e1'), true);
  assert.equal(looksLikeContentHash('白底图'), false);
  assert.equal(looksLikeContentHash('20260928123456'), false, '纯数字是日期，不是哈希');
  assert.equal(looksLikeContentHash('abc'), false, '太短，不足以判定');
});

test('导出文件名按「用户起的名 → 业务角色 → 提示词首句 → 图片-NN」取', () => {
  assert.equal(deliveryNameFor({ name: '主图 01' }, 0, 1), '主图 01', '用户自己起的名字最优先');
  assert.equal(deliveryNameFor({ name: 'a9f2e9cd0b3922a2e7f2a96f50458a832657d179', role: '白底图' }, 0, 1), '白底图',
    '哈希名要跳过，落到业务角色');
  assert.equal(deliveryNameFor({ prompt: '一只橘猫趴在窗台上。暖色调。' }, 0, 1), '一只橘猫趴在窗台上',
    '没有角色就用提示词首句（取到第一个句号为止）');
  assert.equal(deliveryNameFor({}, 2, 5), '图片-03', '什么都没有时保底编号');
  assert.equal(deliveryNameFor({ name: '主图' }, 1, 4), '主图-02', '多张时才加序号');
});

test('落盘文件名经过非法字符清洗，且不再以 hash 结尾', () => {
  const name = safeDeliveryName(deliveryNameFor({ name: '主图/详情:图*' }, 0, 1), 'PNG');
  assert.equal(name, '主图-详情-图.png');
  const hashed = safeDeliveryName(deliveryNameFor({ name: 'b'.repeat(64) }, 0, 1), 'PNG');
  assert.ok(!/^[0-9a-f]{60,}\.png$/.test(hashed), '绝不允许 hash 直接当文件名');
});

test('打包名与 alt 兜底名也不许自称「电商」（线上复验抓到的漏网）', () => {
  /* 服务器侧读已部署产物时抓到：弹窗标题改了「电商图片交付」，但多张打包的兜底文件名
     仍然是 `电商图片.zip` —— 通用用户导出自己做的图，文件名却自称电商，等于只改了一半。
     同样收掉 alt 的兜底名（用户看不见，但读屏软件会念出来）。 */
  const delivery = read('src/pages/EcCanvas/browserFileDelivery.js').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!delivery.includes('电商图片.zip'), '打包兜底名不许再叫「电商图片.zip」');
  assert.ok(!delivery.includes("|| '电商图片'"), '落盘兜底名不许再是「电商图片」');
  const studioCode = read('src/pages/EcCanvas/components/CanvasStudio.jsx').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!studioCode.includes("|| '电商图片'"), 'alt 兜底名不许再是「电商图片」');
  /* 有商品名时保留商品名 —— 那是用户自己填的，不该动 */
  assert.match(delivery, /request\.productName/, '有商品名时打包名仍应带上它');
});

test('套图节点的图位名跳过哈希（事故链：image.id 就是内容的 sha256）', () => {
  const code = stripComments(canvasPage);
  assert.ok(!/name: image\.displayName \|\| image\.label \|\| meta\.name/.test(code),
    '旧的「label 赢过 meta.name」写法必须拿掉 —— label 在没有名字时就是那串 sha');
  assert.match(code, /find\(value => value && !looksLikeContentHash\(value\)\)/,
    '取角色与名字时都必须跳过哈希');
  assert.match(code, /import \{ deliveryNameFor, looksLikeContentHash \}/, '必须真的 import 了判定函数');
});

/* ═══ ③ 尺寸里的「自适应」 ═════════════════════════════════════════════════════ */

test('自适应解析：提示词写了尺寸就听提示词的', () => {
  assert.equal(resolveAdaptiveRatio({ prompt: '做一张 16:9 的海报' }).ratio, '16:9');
  assert.equal(resolveAdaptiveRatio({ prompt: '竖版的手机壁纸' }).ratio, '9:16');
  assert.equal(resolveAdaptiveRatio({ prompt: '1920x1080 的封面' }).ratio, '16:9');
  const withSource = resolveAdaptiveRatio({ prompt: '横屏' });
  assert.equal(withSource.source, 'prompt', '来源必须可追溯（门禁要能区分是哪一级判出来的）');
});

test('自适应解析：提示词没说就看参考图实测宽高', () => {
  const r = resolveAdaptiveRatio({ prompt: '把这个图做得更好看', referenceBox: { width: 1200, height: 800 } });
  assert.equal(r.ratio, '3:2');
  assert.equal(r.source, 'reference');
});

test('自适应解析：都没有才回落 1:1', () => {
  const r = resolveAdaptiveRatio({ prompt: '随便来一张' });
  assert.equal(r.ratio, '1:1');
  assert.equal(r.source, 'fallback');
});

test('显式档位原样透传；「自适应」必须先解掉才发得出去', () => {
  assert.equal(resolveProtocolRatio({ ratio: '3:4', prompt: '做一张 16:9 的' }), '3:4',
    '用户明确选了档位时，提示词里的话不许覆盖它（结构化控件是硬参数的唯一事实源）');
  const adaptive = resolveProtocolRatio({ ratio: ADAPTIVE_RATIO, prompt: '做一张 16:9 的' });
  assert.equal(adaptive, '16:9');
  assert.ok(!IMAGE_RATIOS.includes(ADAPTIVE_RATIO), '「自适应」绝不能混进尺寸表（它不是尺寸）');
});

test('画布尺寸列表第一位是自适应', () => {
  const list = withAdaptiveRatioOption(['1:1', '3:4', '4:3']);
  assert.equal(list[0], ADAPTIVE_RATIO, '用户：「是不是应该在尺寸的最前面加入」');
  assert.equal(list.length, 4);
  assert.deepEqual(withAdaptiveRatioOption(list), list, '已经有的不许重复插');
});

test('首页图片侧也把自适应放在第一位（用户：不能只改画布）', () => {
  assert.equal(VISUAL_RATIO_OPTIONS[0].id, ADAPTIVE_RATIO);
  assert.equal(VISUAL_RATIO_OPTIONS[0].adaptive, true);
  /* 尺寸表本身一个字没动：13 档，还是那 13 档 */
  assert.equal(IMAGE_RATIOS.length, 13, 'IMAGE_RATIOS 是"能生成的唯一真源"，加一个选项不许动它');
});

test('所有**有尺寸选择**的图片技能子页都有自适应；没有尺寸格的那几页写死在门禁里', () => {
  const skillList = Array.isArray(IMAGE_SKILLS) ? IMAGE_SKILLS : Object.values(IMAGE_SKILLS || {});
  const withFields = skillList.filter(s => s && s.fields);
  assert.ok(withFields.length > 20, `图片技能子页数量对不上：${withFields.length}`);

  /* 判据只覆盖**本来就有 ratio 字段**的那些页。
     ⚠️ 有 5 个页压根没有尺寸选择器（product_suite / aplus / tropical_poster / white_bg /
        remove_bg）—— 那是「这一页不给用户选尺寸」的产品决定，不是「漏了自适应」。
        给它们**新增**一个尺寸选择器是另一件事（会改协议、改计费口径），用户没有要求，
        所以这里如实列出，而不是悄悄放过。 */
  const NO_SIZE_PAGES = ['image.product_suite', 'image.aplus', 'image.tropical_poster', 'image.white_bg', 'image.remove_bg'];
  const withRatio = withFields.filter(s => (s.fields || []).some(f => f && f.key === 'ratio'));
  const withoutRatio = withFields.filter(s => !(s.fields || []).some(f => f && f.key === 'ratio'));
  assert.deepEqual(withoutRatio.map(s => s.id).sort(), [...NO_SIZE_PAGES].sort(),
    '「没有尺寸选择器」的页面白名单变了 —— 要么补上自适应，要么明确它为什么不需要');

  const missing = withRatio.filter(skill => {
    const field = (skill.fields || []).find(f => f && f.key === 'ratio');
    return !(field.options || []).some(o => o && o.value === SKILL_ADAPTIVE);
  });
  assert.deepEqual(missing.map(s => s.id), [], '每一个有尺寸选择的图片技能子页都必须有自适应');
});

/* ═══ 2026-09-29 批 DC 续-8：默认档**改成自适应**（推翻批 CY-⑪ 那条「只加选项、不改默认」）══════════
   用户 2026-09-29 逐字：
     「然后比例这里我不是已经让你做了这个自适应吗？我觉得正常来说，你现在应该各种各样的子页面啊，
       首页的生图模型配置啊，还有画布里面的生图配置啊这些地方。**自适应应该是它默认的一个选项呀。**
       除非像这个**概念视觉方案**这里它是对于小红书这边做的一个标准适配，那这个 **3:4 就可以成为它的默认选项**。」

   ⚠️⚠️ 旧的那条判据是**空判**，本批一并说明（它从来没抓得住任何东西）：
     `field.default !== ADAPTIVE || options[0] === ADAPTIVE` ——
     而 `ratioField` **总是**把自适应放在 options[0]，所以右边恒真，整条恒真。
     也就是说"把默认档悄悄翻成别的"这件事，旧门禁一直是绿的。
   ⇒ 换成**正向规则 + 具名例外表**：默认必须是自适应；例外只有表里那几条，且必须是技能**自己显式声明**的
     （不是由 ratioField 内部偷偷判断"谁是特例"）—— 例外要**可见、可数**。 */
const FIXED_RATIO_DEFAULTS = Object.freeze({
  /* 小红书竖版签名：实测竞品 41 篇封面全是竖版（docs/research/2026-09-27-aura-deep-dive.md），
     概念视觉方案的 brief 也把"留白充足 / 主体不超过 40%"写进签名纪律。 */
  'image.concept_set': '3:4',
  /* 巨型产品广告 3:2 —— **全站唯一一条比例被收窄到 3 档**的技能（3:2/4:3/16:9），
     而那 3 档是知渔那一页的逐字实采（imageSkills 里那段注释是原文）。
     brief 要的是「巨型装置 + 尺度反差 + 镜面地板」的横版商业广告，竖版装不下这种空间关系。
     用户 2026-09-29：「giant_product 的 3:2 … 有实测依据，就不要自适应呀。」 */
  'image.giant_product': '3:2',
  /* 详情图 9:16 —— 依据是**本仓电商侧**：
       ecommercePlanModel.js:67 `defaultRatio: '9:16'`，:159 起每个详情图模块都是 9:16；
       EcCanvas/canvasState.js:48-53 六个 detail_slice_* 逐个 9:16；
       promptSizeConflict.js:17 把「竖版|长图|手机全屏」直接判成 9:16。
     改自适应会让这一页的默认档与它自己 brief 产出的那套方案**互相矛盾**（页面 1:1 / 方案全 9:16）
     —— 那正是「看着是 A、跑的是 B」。
     用户 2026-09-29：「detail_page 的竖版都有实测依据，就不要自适应呀。」 */
  'image.detail_page': '9:16',
});

test('默认档 = 自适应；固定默认只有具名例外，且必须由技能自己显式声明', () => {
  const skillList = Array.isArray(IMAGE_SKILLS) ? IMAGE_SKILLS : Object.values(IMAGE_SKILLS || {});
  const withRatio = skillList.filter(s => s && s.fields && (s.fields || []).some(f => f && f.key === 'ratio'));
  assert.ok(withRatio.length > 30, '自证：带比例的技能有三十条以上，实得 ' + withRatio.length);
  const wrong = [];
  for (const skill of withRatio) {
    const field = (skill.fields || []).find(f => f && f.key === 'ratio');
    const expected = Object.prototype.hasOwnProperty.call(FIXED_RATIO_DEFAULTS, skill.id)
      ? FIXED_RATIO_DEFAULTS[skill.id]
      : SKILL_ADAPTIVE;
    if (field.default !== expected) wrong.push(`${skill.id} 默认 ${field.default}，应为 ${expected}`);
  }
  assert.deepEqual(wrong, [], '默认档必须与「自适应 + 具名例外」完全一致');
  /* ⚠️ 例外表本身也要被看住：不许往里加东西而不写理由 ——
     每加一条都要回答"这条技能有什么实测依据，非自适应不可"。 */
  for (const [id, ratio] of Object.entries(FIXED_RATIO_DEFAULTS)) {
    const skill = withRatio.find(s => s.id === id);
    assert.ok(skill, `例外表里的 ${id} 在声明源里不存在（技能改名/下线后要一起删）`);
    const field = (skill.fields || []).find(f => f && f.key === 'ratio');
    assert.equal(field.default, ratio, `${id} 的固定默认被改动 —— 例外表与声明必须一致`);
  }
  /* 显式档位照旧生效，且认不出的值仍回落默认档 */
  assert.equal(skillGenerationSettings({ fields: [] }, { ratio: '16:9' }).ratio, '16:9');
});

test('首页与画布的默认档同步是「自适应」（跨入口不一致就是"看着是 A、跑的是 B"）', () => {
  const home = read('src/pages/Home/VisualCreationMode.jsx');
  const model = read('src/pages/Home/visualCreationModel.js');
  const studio = read('src/pages/EcCanvas/canvasStudioModel.js');
  /* 首页：初始 state + 切技能时的回落，两处都必须是自适应。 */
  assert.match(home, /useState\(HOME_ADAPTIVE_RATIO\)/, '首页初始比例必须是自适应');
  assert.match(home, /snapshot\.ratio \|\| HOME_ADAPTIVE_RATIO/, '切技能/还原时无值也要回落自适应');
  assert.match(model, /export const HOME_ADAPTIVE_RATIO = '自适应'/, '自适应这个值要收成一处常量（三处引用同一个值）');
  assert.match(model, /if \(requestedRatio === HOME_ADAPTIVE_RATIO\) return HOME_ADAPTIVE_RATIO;/,
    'resolveVisualSkillRatio 必须把自适应判为"永远受支持" —— 否则它会按该技能的尺寸名单回落成别的比例');
  /* 画布：三处新建节点的默认值。 */
  const studioCode = studio.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal((studioCode.match(/ratio: ADAPTIVE_RATIO,/g) || []).length, 3,
    '图片 / 文本 / 套图 三个新建节点的默认比例都要是自适应');
  assert.doesNotMatch(studioCode, /ratio: '1:1',/, '画布不许再写死 1:1 作为默认');
  /* ⚠️ 视频侧**故意**不跟：服务端对非法比例是硬 400（server/videoGeneration.mjs），
     给视频加自适应会直接打断请求。那是另一件事、另一批。 */
  const video = read('src/skills/videoSkills.js');
  assert.doesNotMatch(video, /ADAPTIVE_RATIO/, '视频侧不加自适应（上游硬 400），这一条不许被"全站统一"顺手改掉');
});
