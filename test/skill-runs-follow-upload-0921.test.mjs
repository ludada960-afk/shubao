import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { IMAGE_SKILLS, getImageSkill } from '../src/skills/imageSkills.js';
import {
  buildSkillRequest,
  skillGenerationSettings,
  skillImages,
  skillPointsEstimate,
  skillRunsFollow,
} from '../src/skills/skillRun.js';
import { generationUnits, DEFAULT_IMAGE_MODEL } from '../src/services/imageModelCatalog.js';

/* ═══ 「上传几张就出几张」的接线门禁（2026-09-21，用户第 22 轮）════════════════════════════
   用户原话（逐字）：
     「图片复刻是否固定出 6 张（钱路）这个肯定不对啊，他这里的案例指的是上面 3 张原图分别
       对应下面 3 张的复刻结果啊，用户上传一张肯定就复刻一张，上传两张就复刻两张，
       上传 3 张就复刻 3 张不是吗？」
   我们上一批把示例区那张 3+3 的配对图读成"固定出 6 张"，是错的 —— 本门禁把正确口径钉住：
     ① 张数 = 参考图那一格**已就绪的张数**（没有就 1 张，不是 0、也不是固定 6）；
     ② 第 i 次运行只带**第 i 张**参考图（否则 N 次请求会出 N 张一模一样的图 = 装出来的功能）；
     ③ 报价按张数走（N 张 = N × 单价），点之前就能看到；
     ④ 商品图始终是主图（image_url），且主图位里**除第一张以外**的也进参考图（不静默丢）。
   依据是知渔自己的示例区原文（本文件会从证据文件里复查这句话还在不在）：
     「上传风格参考图与商品图包，AI 按参考图数量批量输出风格高度一致的商品主图。」 */

const builtin = JSON.parse(readFileSync(new URL('../docs/design/data/quantv-image-builtin-pages.json', import.meta.url), 'utf8'));
const clonePage = builtin.pages.find(page => page.skill === 'image.copy');

const upload = (url, extra = {}) => ({ url, status: 'ready', assetId: 'a'.repeat(64), name: url, ...extra });
const refs = count => Array.from({ length: count }, (_, i) => upload('https://example.com/ref-' + i + '.png'));
const products = count => Array.from({ length: count }, (_, i) => upload('https://example.com/product-' + i + '.png'));

test('① 只有声明了 runsFollow 的技能才逐张跑，且声明指向一个真实的上传位', () => {
  const withRuns = IMAGE_SKILLS.filter(skill => skill.runsFollow);
  assert.deepEqual(withRuns.map(skill => skill.id), ['image.copy'],
    '逐张跑的技能清单变了：多一条少一条都要有实测依据（知渔示例区原文/用户原话）');
  for (const skill of withRuns) {
    const field = (skill.fields || []).find(item => item.key === skill.runsFollow);
    assert.ok(field && field.kind === 'upload', skill.id + '：runsFollow 必须指向一个上传位');
  }
  /* 反向自证：指向不存在的字段时必须**当作没有声明**（不许静默变成"永远 1 张"） */
  assert.equal(skillRunsFollow({ runsFollow: 'nope', fields: [{ key: 'source', kind: 'upload' }] }), '');
  assert.equal(skillRunsFollow(getImageSkill('image.copy')), 'source');
  /* 知渔自己的原文就是判据：这句要一直在证据文件里 */
  assert.match(String(clonePage.exampleText || ''), /按参考图数量批量输出/,
    '知渔示例区的原文变了，这条实现口径要重新核');
});

test('② 张数 = 参考图张数（0 张 → 1 张，3 张 → 3 张；不是固定 6）', () => {
  const skill = getImageSkill('image.copy');
  const countOf = n => skillGenerationSettings(skill, { reference: products(1), source: refs(n) }).count;
  assert.equal(countOf(0), 1, '一张参考图都没有时仍然出 1 张（参考图是选填，不能变成 0 张订单）');
  assert.equal(countOf(1), 1);
  assert.equal(countOf(2), 2);
  assert.equal(countOf(3), 3, '用户原话：上传 3 张就复刻 3 张');
  assert.equal(countOf(20), 20, '上限跟着那一格自己的 maxImages 走（他们那一格是 0/20）');
  /* 报价与张数同源。⚠️ 2026-09-30 换默认模型后单价从 1 积分变成 1.5（2.5 Sunburst @2K），
     3 张因此是 **4.5** 积分。这里从计费表取默认档单价，换默认时自动跟着走。 */
  const unit = generationUnits(DEFAULT_IMAGE_MODEL, '2K') / 1000;
  const points = skillPointsEstimate(skill, { reference: products(1), source: refs(3) });
  assert.equal(points, Number((unit * 3).toFixed(2)), '按钮上的积分必须按张数算（点之前就看得到要花多少）');
  assert.equal(skillPointsEstimate(skill, { reference: products(1), source: refs(1) }), unit);
  /* 没声明的技能一个字不变：张数仍走自己的 count 控件 */
  const other = getImageSkill('image.style_swap');
  assert.equal(skillGenerationSettings(other, { assets: products(1) }).count, 1);
});

test('③ 第 i 次运行只带第 i 张参考图（否则 N 次请求 = N 张一样的图）', () => {
  const skill = getImageSkill('image.copy');
  const values = { reference: products(1), source: refs(3), product: '白色陶瓷杯', degree: '参考排版' };
  const images = [0, 1, 2].map(index => skillImages(skill, values, { slotIndex: index }));
  assert.deepEqual(images.map(item => item.referenceImages), [
    ['https://example.com/ref-0.png'],
    ['https://example.com/ref-1.png'],
    ['https://example.com/ref-2.png'],
  ], '每一次运行必须带**不同的**那一张参考图');
  for (const item of images) assert.equal(item.imageUrl, 'https://example.com/product-0.png', '商品图始终是主图');
  /* 请求体层面同样成立（页面调的就是它） */
  const requests = [0, 1, 2].map(index => buildSkillRequest(skill, values, { runId: 'r1', slotIndex: index }));
  assert.deepEqual(requests.map(item => item.referenceImages[0]), [
    'https://example.com/ref-0.png', 'https://example.com/ref-1.png', 'https://example.com/ref-2.png',
  ]);
  assert.deepEqual([...new Set(requests.map(item => item.requestKey))].length, 3, '三次运行的幂等键必须互不相同');
  /* 单张参考图时，每次运行带的就是那一张（不会越界、不会变空） */
  const single = { ...values, source: refs(1) };
  assert.deepEqual(skillImages(skill, single, { slotIndex: 0 }).referenceImages, ['https://example.com/ref-0.png']);
  assert.deepEqual(skillImages(skill, single, { slotIndex: 5 }).referenceImages, ['https://example.com/ref-0.png']);
});

test('④ 主图位里除第一张以外的也进参考图（不许静默丢）', () => {
  const skill = getImageSkill('image.copy');
  /* 知渔那一格的原文：「商品图会作为一组打包参考，最多 4 张」—— 传满 4 张就得用上 4 张 */
  assert.match(String(clonePage.panelText || ''), /商品图会作为一组打包参考，最多 4 张/);
  const images = skillImages(skill, { reference: products(4), source: [], product: 'x', degree: '参考排版' });
  assert.equal(images.imageUrl, 'https://example.com/product-0.png');
  assert.deepEqual(images.referenceImages, [
    'https://example.com/product-1.png',
    'https://example.com/product-2.png',
    'https://example.com/product-3.png',
  ], '主图位第 2-4 张必须进参考图（原来只发第一张，另外三张静默丢掉）');
  /* 参考图那一格也照旧进（逐张跑时只带当次那一张） */
  const mixed = skillImages(skill, { reference: products(2), source: refs(2) }, { slotIndex: 1 });
  assert.deepEqual(mixed.referenceImages, ['https://example.com/product-1.png', 'https://example.com/ref-1.png']);
});
