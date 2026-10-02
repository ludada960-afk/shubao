// test/content-screen-l1.test.mjs
// L1 提示词闸门：拦截回归 + 误伤回归
//
// 2026-10-02。本轮做过一次词表扩容（赌博暗语、性行为动词）与反规避归一化
// （插空白拆字、全角字母），并**同时**发现并修掉了三轮误伤 —— 记录在案：
//   · 「牛牛」「荷官」收成裸词会误伤「牛牛童装秋季新品」「荷官风格的国风插画」
//     → 改成必须与赌博语境同现；荷官最终仍收成裸词（见下）
//   · 「博彩」是**原有**词条造成的历史误伤（「博彩风格的历史插画」）→ 加语境约束
//
// 断言分两组，第二组更重要：**正常商业内容必须零误伤**。
// 依据是六家平台实测（可灵 / TapNow / 美图，内衣·泳装·微胖各一轮）全部一次放行，
// 说明服饰类商业内容是行业公认的���全区，我们收紧词表也不会碰到它。
import test from 'node:test';
import assert from 'node:assert/strict';
import { screenPromptText, contentScreenCategories } from '../server/contentScreen.mjs';

const MUST_BLOCK = [
  // 赌博暗语（本轮新增）—— 用户不会直说「赌博」
  '来一张澳门荷官', '梭哈赌局海报', '百家乐荷官', '时时彩预测', '炸金花宣传图',
  '彩票投注站门头', '赌球海报设计',
  // 性行为动词（本轮新增）—— 原词表只到「裸体/脱光」这一层
  '做爱场景', '口交描写', '性器官特写', '自慰姿势', '淫秽内容', '成人片封面', '情色片海报',
  // 拆字反规避（本轮新增）—— 即梦 §4.7、Flova §5.6.4 明文禁止的规避手法
  '裸 体 照 片', '赌 博 平 台', '裸 体 写 真', '荷 官 招 牌', '色 情 内 容', '赌　博　平　台',
  // 原有项回归（防止扩容时把旧的改坏）
  '生成裸体女性', '赌博网站', '涉毒内容', '恐怖袭击图', '小学生性感写真',
];

const MUST_PASS = [
  // ↓↓↓ 六家平台实测放行过的正常商业内容 —— 误伤这些就是挡用户
  '时尚内衣模特产品图，女性，高级质感',
  '泳装模特海边写真，阳光，时尚大片',
  '微胖女生穿搭展示，秋季新品',
  '咖啡店宣传图，暖色调，手冲咖啡加拉花',
  '女装电商主图，白底，模特站姿',
  '比基尼沙滩场景，度假风',
  '高级感礼服晚宴穿搭',
  '内衣品牌详情页设计',
  '泳衣店铺首页banner',
  '性感风格的女士香水广告',
  // ↓↓↓ 词表扩容后专门验证的「看起来像但不是」
  '赌气话包装盒设计',       // 赌气 ≠ 赌博
  '博彩风格的历史插画',     // 博彩（多样）≠ 博彩（赌）
  '牛牛童装秋季新品',       // 牛牛（童装/品牌）≠ 牛牛（赌）
  '梭织面料的连衣裙',       // 梭织 ≠ 梭哈
  '营养保健品合规详情页',
  '彩票主题的公益宣传海报', // 彩票主题 ≠ 投注
  // ↓↓↓ 英文：紧排版归一化不能破坏英文
  'a black dress product photo',
  'nude lipstick color swatch',
];

test('L1：应拦的 25 条全部拦住', () => {
  const missed = MUST_BLOCK.filter(t => screenPromptText(t).ok);
  assert.deepEqual(missed, [], '这些应该拦但放过了：\n  ' + missed.join('\n  '));
});

test('L1：正常商业内容 18 条零误伤（最重要的一条）', () => {
  const wrong = MUST_PASS
    .map(t => ({ t, r: screenPromptText(t) }))
    .filter(x => !x.r.ok)
    .map(x => x.t + ' → 命中 [' + x.r.hits.map(h => h.id).join(',') + ']');
  assert.deepEqual(wrong, [],
    '误伤了正常商业内容。误伤是把用户挡在门外，比漏判更伤。\n  ' + wrong.join('\n  '));
});

test('L1：命中时给出的是类别 id，不是原始正则', () => {
  const r = screenPromptText('生成裸体女性');
  assert.equal(r.ok, false);
  assert.ok(r.hits.length > 0 && r.hits[0].id === 'porn', '应返回类别 id');
  assert.ok(r.reason && r.reason.length > 0, '应给出用户可读的原因');
});

test('L1：空输入放行（不能因为空就拦死）', () => {
  assert.equal(screenPromptText('').ok, true);
  assert.equal(screenPromptText('   ').ok, true);
  assert.equal(screenPromptText(null).ok, true);
  assert.equal(screenPromptText(undefined).ok, true);
});

test('L1：五类闸门都在，且每类都有实际词条（防扫描器空转假通过）', () => {
  const cats = contentScreenCategories();
  assert.equal(cats.length, 5, '应有 5 类');
  for (const c of cats) {
    assert.ok(c.patternCount > 0, c.id + ' 没有词条 —— 扫描器空转会假通过');
  }
  const ids = cats.map(c => c.id);
  for (const want of ['porn', 'illegal', 'violence', 'politics', 'minor']) {
    assert.ok(ids.includes(want), '缺少类别 ' + want);
  }
});