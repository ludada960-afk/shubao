import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { PRODUCTION_VISUAL_CASES, productionVisualCaseById } from '../scripts/production-visual-case-manifest.mjs';
import { SELECTABLE_IMAGE_MODELS } from '../src/services/imageModelCatalog.js';

const SKILLS = new Set(['free', 'poster', 'social-cover', 'brand-kv']);
const RATIOS = new Set(['1:1', '3:4', '4:3', '9:16', '16:9', '21:9']);
const SELECTABLE_MODEL_IDS = new Set(SELECTABLE_IMAGE_MODELS.map(model => model.id));

test('formal visual case manifest covers six distinct showcases per Skill plus the production source asset', () => {
  assert.equal(PRODUCTION_VISUAL_CASES.length, 25);
  for (const skillId of SKILLS) {
    const cases = PRODUCTION_VISUAL_CASES.filter(item => item.skillId === skillId);
    const expectedCount = skillId === 'free' ? 7 : 6;
    assert.equal(cases.length, expectedCount);
    assert.equal(new Set(cases.map(item => item.topic)).size, expectedCount);
    assert.equal(new Set(cases.map(item => item.prompt)).size, expectedCount);
    assert.equal(new Set(cases.map(item => item.requestKey)).size, expectedCount);
  }
});

test('formal visual cases use supported production dimensions and durable identities', () => {
  assert.equal(new Set(PRODUCTION_VISUAL_CASES.map(item => item.id)).size, PRODUCTION_VISUAL_CASES.length);
  for (const item of PRODUCTION_VISUAL_CASES) {
    assert.ok(SKILLS.has(item.skillId));
    assert.ok(RATIOS.has(item.ratio));
    assert.equal(item.resolution, '2K');
    /* ⚠️ 这里断言的是"每条案例都显式写了自己用哪个模型，且那是个真能跑的模型"，
       **不是**"它们都是 image2" —— 后者是数据，重新生成一次就会变，写进判据等于
       把一次数据变更伪装成一次回归（用户 2026-09-30 纠正的正是这类"写死"）。
       案例与目录两边不许走岔，由 test/production-case-catalog.test.mjs 钉住。 */
    assert.ok(SELECTABLE_MODEL_IDS.has(item.imageModel),
      `${item.id} 记的出图模型 ${item.imageModel} 不在可选目录里（做同款会跑不起来）`);
    assert.match(item.requestKey, /^showcase-20260813-[a-z0-9-]+$/);
    assert.ok(item.prompt.length >= 80);
    assert.equal(productionVisualCaseById(item.id), item);
  }
});

test('imageModel 是必填项：新增案例漏写必须报错，而不是静默套用旧模型', async () => {
  /* 真做一次对照实验：把源码里第一条案例的 imageModel 删掉再求值 —— 必须抛错。
     只看源码里有没有那行 throw 判据太弱，改个措辞就绕过去了。 */
  const file = new URL('../scripts/production-visual-case-manifest.mjs', import.meta.url);
  const source = readFileSync(file, 'utf8');
  assert.match(source, /imageModel is required for production visual case/);
  const stripped = source.replace('imageModel: SHOWCASE_IMAGE_MODEL, ', '');
  assert.notEqual(stripped, source, '没找到可删的 imageModel 声明，判据本身该更新了');
  const broken = `data:text/javascript;charset=utf-8,${encodeURIComponent(stripped)}`;
  await assert.rejects(() => import(broken), /imageModel is required/,
    '漏写 imageModel 的案例必须让整个模块加载失败，而不是继承上一个案例的模型');
});

test('social cases cover platform-native shapes instead of one topic cropped repeatedly', () => {
  const cases = PRODUCTION_VISUAL_CASES.filter(item => item.skillId === 'social-cover');
  assert.deepEqual(new Set(cases.map(item => item.platform)), new Set(['小红书', '公众号', 'B站', '抖音']));
  assert.ok(cases.some(item => item.platform === '小红书' && item.ratio === '3:4'));
  assert.ok(cases.some(item => item.platform === '公众号' && item.ratio === '21:9'));
  assert.ok(cases.some(item => item.platform === 'B站' && item.ratio === '16:9'));
  assert.ok(cases.some(item => item.platform === '抖音' && item.ratio === '9:16'));
});
