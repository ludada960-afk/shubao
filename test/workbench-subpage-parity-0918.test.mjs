import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { stripComments } from '../scripts/lib/token-scope.mjs';
import { getImageSkill } from '../src/skills/imageSkills.js';

/* ═══ 子页面工作台 1:1 对齐（批 F，2026-09-18）════════════════════════════════════════
   用户批注 15 / 16 / 17 原话：
     「他们里面那些工作台都是可以下拉的，做的很长，里面其实是很复杂的，也有各种可以切换的按钮，
       各种可以去深度调参数的配置的地方。」
     「你要真的去抓他们的字段名、全部选项、上传位数、按钮价格、编号交付清单，然后照着做，
       不要凭想象。」
   取证：docs/design/50-quantv-subpage-field-spec.md（CDP 实访，一次一标签、抓完即关）。

   本文件守四件**照着做了**才成立的事（每一条以前都真的缺）：
     ① 字段分组：工作台按区块排（上传图片 / 基础信息 / 复刻设置…），组名与顺序照竞品；
     ② 跨境字段的**全部选项**照原文（市场 9/13 档、语言 14 档）；
     ③ 编号交付清单照原文（套图 8 条 / A+ 6 条 / 详情图 4 条 / 复刻 6 条成对）；
     ④ 上传位数照原文（套图 6 / 复刻商品图 4 + 参考图 20 / 换装 1+1+1+1 / 去背景 5）。
   ⚠️ 有意不照抄的两处（钱路原因）写在 test/workbench-quantv-parity-0918 第 ④ 条，
      以及 __docs/design/47__ 的「明确不照抄」一节；本文件**不**重复守它们。 */

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const spec = read('docs/design/50-quantv-subpage-field-spec.md');
const shell = read('src/components/media/WorkbenchShell.jsx');

const fieldsOf = id => getImageSkill(id).fields;
const byLabel = (id, label) => fieldsOf(id).find(field => field.label === label);

test('① 工作台按区块分组，组名与顺序照竞品实测', () => {
  /* 骨架支持分组：按**字段出现的先后**决定组的先后（不是另写一张顺序表 —— 那会有第二份真相） */
  assert.match(shell, /function groupFields\(fields\)/);
  assert.match(shell, /media-workbench-group-title/);

  const groupNames = id => {
    const order = [];
    for (const field of fieldsOf(id)) if (field.group && !order.includes(field.group)) order.push(field.group);
    return order;
  };
  /* ═══ 2026-09-19 批 O-⑨：这条断言改了**事实**（区块列表），判据一个字没动 ═══════════════
     判据仍是「区块名与顺序必须与竞品一致」。
     变的是"竞品的套图页到底有哪几块"这个事实：
       原判据写的是 ['上传图片', '基础信息', '产品卖点与设计风格', '套图结构配置']（4 块），
       而用户第 19 轮实测复核（CDP 全文，docs/design/67 §2）看到的是
         「基础信息」【上传图片 0/6 → 目标市场 → 目标平台 → 文案语言】
         →「产品卖点与设计风格」→「套图结构配置」 —— **上传位在基础信息组里面**，只有 3 块。
     依据：用户原话「你**抄的完全就没有对上**」「你也要**全部去把这些子页面 1:1 的去把它们抄过来**」。
     ⇒ 我们原来把上传位单独拎成第一组，等于凭空多了一个区块头。现在并回去，与竞品逐块相同。 */
  assert.deepEqual(groupNames('image.product_suite'),
    ['基础信息', '产品卖点与设计风格', '套图结构配置'], '商品套图的区块顺序照竞品（上传位在基础信息组内）');
  /* ═══ 2026-09-19 批 I-10：A+ 的区块列表**按用户批注 #3-2 与竞品实访各删掉「生成设置」** ═══
     用户原话：「而且这个**生成设置又是什么鬼**啊，**人家没有这个呀**，选中多少个模块就是多少张……
       比例的话我不懂，这个你要深度对比竞品和自己的skill去决定吧。」
     按用户要求去对比了，**证据就在我们自己的拆解文档里**（docs/design/50 第 214 行，CDP 实访竞品 A+ 页）：
     竞品 A+ 的字段只有「目标市场 13 档 · 输出语言 14 档 · 包含模块 已选 0/16 · 爆款风格两档」
     —— **没有比例，也没有生成数量**，所以那整块在 A+ 上本来就不该有。
     ⚠️ 这条断言守的东西没变（**区块名与顺序必须与竞品一致**），改的是"竞品的 A+ 到底有哪几块"这个事实。
     ⚠️ 只改 A+：详情图那条（下面一行）仍然是四块含「生成设置」—— 竞品别的页面确实有比例，
        见 50 号文档 144 / 183 行。按页面分开看，不能一刀切。 */
  /* ═══ 2026-09-19 批 Q：A+ / 详情图的区块列表把「上传图片」并回「基础信息」 ══════════════
     判据仍然一个字没变（**区块名与顺序必须与竞品一致**），变的是"竞品那两页到底有哪几块"这个事实：
     CDP 逐页实采（.tmp/qy-deepclick-theirs3.mjs）A+ 与详情图的左栏都是
       「基础信息」【上传图片 0/6 → 目标市场 → 目标平台 → 输出语言】→「产品卖点与设计风格」→「包含模块」
     —— 上传位在**基础信息组里面**，与商品套图同一口径（用户第 19 轮就是拿这一条纠正过套图）。
     我们上一版让 A+/详情图单独有一个「上传图片」组头，等于凭空多出一个区块。 */
  assert.deepEqual(groupNames('image.aplus'),
    ['基础信息', '产品卖点与设计风格'], 'A+ 的区块顺序照竞品（上传位在基础信息组内；竞品 A+ 页也没有生成设置）');
  assert.deepEqual(groupNames('image.detail_page'),
    ['基础信息', '产品卖点与设计风格', '生成设置'], '详情图的区块顺序照竞品（上传位在基础信息组内）');
  assert.deepEqual(groupNames('image.copy'),
    ['商品信息', '参考图', '复刻设置', '基础信息', '生成设置'], '图片复刻的区块顺序照竞品');
  assert.deepEqual(groupNames('image.try_on'),
    ['模特选择', '服装选择', 'Pose 参考（可选）', '背景参考（可选）', '生成设置'], 'AI换装的区块顺序照竞品');
  /* 每个字段都要有组 —— 漏一个就会在页面上冒出一个没有标题的孤儿块 */
  for (const id of ['image.product_suite', 'image.aplus', 'image.detail_page', 'image.copy', 'image.try_on', 'image.remove_bg']) {
    for (const field of fieldsOf(id)) assert.ok(field.group, id + ' / ' + field.key + ' 没有分组');
  }
});

test('② 跨境字段的全部选项照竞品原文（一档不多、一档不少）', () => {
  const values = (id, label) => (byLabel(id, label)?.options || []).map(item => item.value);
  assert.deepEqual(values('image.product_suite', '目标市场'),
    ['中国', '美国', '欧洲', '东南亚', '日本', '韩国', '南非', '新加坡', '俄罗斯'], '套图目标市场 9 档');
  assert.deepEqual(values('image.aplus', '目标市场'),
    ['中国', '欧洲', '东南亚', '美国', '日本', '韩国', '南非', '新加坡', '巴西', '阿根廷', '智利', '墨西哥', '俄罗斯'], 'A+ 目标市场 13 档');
  assert.deepEqual(values('image.detail_page', '目标平台'),
    ['淘宝', '抖音', '小红书', '京东', '拼多多'], '详情图平台顺序：京东在拼多多前（照竞品）');
  assert.deepEqual(values('image.copy', '目标平台'),
    ['淘宝', '抖音', '小红书', '拼多多', '京东'], '复刻平台顺序：拼多多在京东前（照竞品）');
  const langs = values('image.aplus', '输出语言');
  assert.equal(langs.length, 13, 'A+ 输出语言 13 档');
  assert.ok(langs.includes('繁体中文'), '含「繁体中文（必须使用2K及以上）」这一档');
  assert.ok(!langs.includes('无文字'), 'A+ 的输出语言里没有「无文字」（照竞品）');
  const suiteLangs = values('image.product_suite', '文案语言');
  assert.equal(suiteLangs.length, 14, '套图文案语言 14 档（多一个「无文字」）');
  assert.ok(suiteLangs.includes('无文字'), '套图有「无文字」这一档（照竞品）');
  /* 字段顺序也要照竞品：市场 → 平台 → 语言 */
  const order = fieldsOf('image.product_suite').map(field => field.key);
  assert.ok(order.indexOf('market') < order.indexOf('platform'), '市场在平台之前');
  assert.ok(order.indexOf('platform') < order.indexOf('language'), '平台在语言之前');
});

test('③ 编号交付清单照竞品原文（套图 8 / A+ 6 / 详情图 4 / 复刻 6 成对）', () => {
  const names = id => (getImageSkill(id).deliverables || []).map(item => item.name);
  /* 套图的清单由**方案真源**算（随平台变），声明源里没有 deliverables —— 所以文档要是原文 */
  assert.match(spec, /01 白底主图/, '套图 8 条编号清单进文档');
  assert.match(spec, /08 收官价值视觉图/, '套图第 8 条也在');
  assert.deepEqual(names('image.aplus'),
    ['功能总览图', '技术细节图', '生活方式图', '品牌主视觉', '场景展示图', '品牌故事图'], 'A+ 6 条');
  assert.deepEqual(names('image.detail_page'),
    ['高效率销售转化详情页', '场景氛围与情感共鸣详情页', '成分 / 材质说明详情页', '产品规格参数图'], '详情图 4 条');
  assert.deepEqual(names('image.copy'), ['原图', '原图', '原图', '复刻图', '复刻图', '复刻图'], '复刻是成对的 3+3');
  /* 页面必须**两样都给**：清单在上（交付契约）、案例图在下（长什么样） */
  const workbench = read('src/pages/Home/SkillWorkbench.jsx');
  assert.match(workbench, /skill-deliverable-list/);
  assert.match(workbench, /String\(index \+ 1\)\.padStart\(2, '0'\)/, '编号必须 01/02 两位格式');
});

test('④ 上传位数照竞品原文（一条都不能少）', () => {
  const maxOf = (id, label) => byLabel(id, label)?.maxImages;
  /* ⚠️ 2026-09-19 批 Q：字段名从「素材」改成「上传图片」——照知渔原文（他们那一页的字段标题
     就是「上传图片」，0/6 的计数在标题行右端）。**判据与数值都没变**（还是 0/6 六张）。 */
  assert.equal(maxOf('image.product_suite', '上传图片'), 6, '套图 0/6');
  assert.equal(maxOf('image.copy', '上传商品图'), 4, '复刻商品图 0/4（成组打包）');
  assert.equal(maxOf('image.copy', '上传参考图'), 20, '复刻参考图 0/20');
  assert.equal(maxOf('image.try_on', '上传模特图'), 1, '换装模特图 0/1');
  assert.equal(maxOf('image.try_on', '上传衣服图'), 1, '换装衣服图 0/1');
  assert.equal(maxOf('image.try_on', '上传姿势参考图'), 1, 'Pose 参考 0/1（可选）');
  assert.equal(maxOf('image.try_on', '上传背景参考图'), 1, '背景参考 0/1（可选）');
  assert.equal(maxOf('image.remove_bg', '素材'), 5, '去除背景「最多上传 5 张图片」');
  assert.equal(maxOf('image.aplus', '素材'), 6, 'A+ 0/6');
  assert.equal(maxOf('image.detail_page', '素材'), 6, '详情图 0/6');
  /* 可选位必须**真的可选**（不是必填）——「可选素材，不上传也可生成」写在哪就得做到哪 */
  assert.ok(!byLabel('image.try_on', '上传姿势参考图').required, 'Pose 参考不许是必填');
  assert.ok(!byLabel('image.try_on', '上传背景参考图').required, '背景参考不许是必填');
  /* 换装：模特图必须是**第一个** upload 位（skillImages 取第一位当主图 = 底图） */
  const uploads = fieldsOf('image.try_on').filter(field => field.kind === 'upload').map(field => field.key);
  assert.equal(uploads[0], 'model', '换装的主图必须是模特图（衣服穿到这张图上的人身上）');
  /* 复刻：商品图必须 required —— 不然"只填了卖点就能生成"会跑成文生图 */
  assert.ok(byLabel('image.copy', '上传商品图').required, '复刻的商品图必须必填（否则会跑成文生图）');
});

test('⑤ 只读「包含模块」清单：内容照抄，但**不可勾选**（钱路约束）', () => {
  const modules = getImageSkill('image.aplus').modules || [];
  assert.equal(modules.length, 16, 'A+ 的 16 个模块一条不少');
  assert.equal(modules[0].name, '首屏主视觉');
  assert.equal(modules[0].hint, '传递核心价值');
  assert.equal(modules[15].name, '使用建议图');
  assert.equal(modules[15].hint, '商品使用的注意事项');
  /* 只读：渲染成静态 li，不是按钮；且不许带勾选/张数字段 */
  assert.match(shell, /media-workbench-checklist-items/);
  for (const item of modules) {
    assert.equal(item.checked, undefined, '模块不许带勾选状态');
    assert.equal(item.quantity, undefined, '模块不许带张数');
  }
  /* 文档里也要如实写清"我们做成只读"的理由 */
  assert.match(spec, /我们不照抄的地方/, '文档要写明哪一处没照抄、为什么');
  assert.match(spec, /可勾选/, '并写清"可勾选"这一处的处理方式');
});
