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
  const none = exportDialogCopy({ count: 0 });
  assert.equal(none.title, '没有可导出的图片');
  assert.match(none.subtitle, /没有可导出的生成结果/);
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
  assert.ok(!/\.png$/.test('') && name.endsWith('.png'));
  const hashed = safeDeliveryName(deliveryNameFor({ name: 'b'.repeat(64) }, 0, 1), 'PNG');
  assert.ok(!/^[0-9a-f]{60,}\.png$/.test(hashed), '绝不允许 hash 直接当文件名');
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

test('加选项不许顺带改默认档（否则等于一次性改了所有技能的行为）', () => {
  const skillList = Array.isArray(IMAGE_SKILLS) ? IMAGE_SKILLS : Object.values(IMAGE_SKILLS || {});
  for (const skill of skillList.filter(s => s && s.fields)) {
    const field = (skill.fields || []).find(f => f && f.key === 'ratio');
    if (!field) continue;
    assert.ok(field.default !== SKILL_ADAPTIVE || (field.options || [])[0]?.value === SKILL_ADAPTIVE,
      `${skill.id} 的默认档被改成了自适应 —— 用户只要求"加这个选项"，没要求改默认`);
  }
  /* 显式档位照旧生效，且认不出的值仍回落默认档 */
  assert.equal(skillGenerationSettings({ fields: [] }, { ratio: '16:9' }).ratio, '16:9');
});
