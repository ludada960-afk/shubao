import assert from 'node:assert/strict';
import test from 'node:test';

import {
  VISUAL_CREATION_SKILLS,
  buildVisualCanvasResult,
  buildVisualWorkRecord,
  createVisualRun,
  resolveVisualSkillRatio,
  visualGenerationEstimate,
  updateVisualRunSlot,
  visualRetryIndexes,
} from '../src/pages/Home/visualCreationModel.js';
import { IMAGE_RATIOS } from '../src/services/imageSizeCatalog.js';
import { buildGalleryRemixCheckpoint } from '../src/pages/Home/galleryRemixModel.js';

const stableUrl = seed => `/api/generated-assets/${seed.repeat(64).slice(0, 64)}.png`;

test('visual skills explain the transformation before the user selects one', () => {
  assert.deepEqual(VISUAL_CREATION_SKILLS.map(skill => skill.id), [
    'free',
    'poster',
    'social-cover',
    'brand-kv',
  ]);
  for (const skill of VISUAL_CREATION_SKILLS) {
    assert.ok(skill.title);
    assert.ok(skill.outcome);
    assert.ok(skill.preserves);
    assert.ok(skill.bestFor);
    assert.match(skill.preview, /^\/images\/visual-recipes\/(?:free|poster|social-cover|brand-kv)\.png$/);
    assert.doesNotMatch(skill.preview, /reference-card-/);
    assert.equal(skill.showcases.length, 2);
    assert.ok(skill.showcases.every(showcase => showcase.title && showcase.description));
    assert.ok(skill.showcases.every(showcase => showcase.assets?.length >= 3));
    assert.ok(skill.showcases.every(showcase => showcase.layout?.type));
    assert.ok(skill.showcases.every(showcase => showcase.assets.every(asset => asset.src && asset.ratio)));
    assert.ok(skill.control?.label);
    assert.ok(skill.control?.options?.length >= 2);
  }
  assert.equal(VISUAL_CREATION_SKILLS.some(skill => 'persona' in skill), false);
});

test('visual recipes expose platform-native ratios and a reusable generation snapshot', () => {
  const social = VISUAL_CREATION_SKILLS.find(skill => skill.id === 'social-cover');
  assert.deepEqual(social.control.options, ['小红书', '公众号', 'B站', '抖音']);
  /* ⚠️ 2026-09-19 批 J-⑪：画面尺寸给满六档（用户批注 #7-4「你只有这四个吗？」）。
     该技能**最合适的四档仍然排在前面**（第一档是它的默认值，visualSkillDefaultRatio 取 [0]，
     切技能时的默认行为一个字没变），后面补全到能生成的六档。
     敢补全的依据：test/image-size-catalog-parity 第 ② 条逐个跑过服务端的 resolveGenerationSize，
     确认六档全都真的照做（不在表里的比例服务端会**静默回落成 1:1**）。 */
  assert.deepEqual(social.ratios.slice(0, 4), ['3:4', '21:9', '16:9', '9:16'], '最合适的几档仍在前面');
  assert.deepEqual([...social.ratios].sort(), [...IMAGE_RATIOS].sort(), '其余补全到能生成的六档');
  assert.ok(social.panels.some(panel => panel.id === 'platform'));
  assert.ok(social.panels.some(panel => panel.id === 'headline'));

  let run = createVisualRun({ runId: 'visual-remix-1', count: 1 });
  run = updateVisualRunSlot(run, 0, {
    status: 'completed',
    url: stableUrl('a'),
    taskId: 'task-remix-1',
    replay: { requestKey: 'visual-remix-1:1', prompt: '平台原生封面', ratio: '21:9', resolution: '2K', imageModel: 'image2', skillId: 'social-cover' },
  });
  const work = buildVisualWorkRecord({
    run,
    prompt: '平台原生封面',
    skillId: 'social-cover',
    model: 'image2',
    ratio: '21:9',
    resolution: '2K',
    referenceAssets: [{ assetId: 'ref-1', url: '/api/generated-assets/ref-1.png' }],
    skillControl: '公众号',
    panelValues: { headline: '一篇文章的核心观点' },
  });
  assert.equal(work.replay.skillId, 'social-cover');
  assert.equal(work.replay.ratio, '21:9');
  assert.equal(work.replay.skillControl, '公众号');
  assert.deepEqual(work.replay.referenceAssets, [{ assetId: 'ref-1', url: '/api/generated-assets/ref-1.png' }]);
  assert.equal(work.images[0].taskId, 'task-remix-1');
});

test('free creation visual language options explain their output with example imagery', () => {
  const free = VISUAL_CREATION_SKILLS.find(skill => skill.id === 'free');
  assert.deepEqual(free.control.options, ['智能匹配', '写实摄影', '风格插画']);
  assert.deepEqual(free.control.optionMeta.map(option => option.value), free.control.options);
  assert.ok(free.control.optionMeta.every(option => option.image && option.description));
  assert.ok(free.control.optionMeta.every(option => option.image.startsWith('/images/visual-recipes/cases/')));
});

test('primary visual controls use an example image for every choice', () => {
  for (const skill of VISUAL_CREATION_SKILLS) {
    const options = skill.control.options;
    assert.deepEqual(skill.control.optionMeta?.map(option => option.value), options, `${skill.id} options need visual examples`);
    assert.ok(skill.control.optionMeta.every(option => option.image && option.description));
    assert.ok(skill.control.optionMeta.every(option => option.image.startsWith('/images/visual-recipes/cases/')));
  }
  const poster = VISUAL_CREATION_SKILLS.find(skill => skill.id === 'poster');
  assert.deepEqual(poster.control.optionMeta.map(option => option.image), [
    '/images/visual-recipes/cases/poster-theatre.png',
    '/images/visual-recipes/cases/poster-farmers-market.png',
    '/images/visual-recipes/cases/poster-night-ride.png',
  ]);
});

test('visual generation estimate follows the same model and resolution units as billing', () => {
  assert.deepEqual(visualGenerationEstimate({ imageModel: 'image2', resolution: '2K', count: 1 }), {
    points: 1,
    unitsPerImage: 1000,
    quantity: 1,
  });
  assert.deepEqual(visualGenerationEstimate({ imageModel: 'image2', resolution: '4K', count: 3 }), {
    points: 6,
    unitsPerImage: 2000,
    quantity: 3,
  });
});

test('visual skill ratio falls back to a ratio supported by the selected recipe', () => {
  assert.equal(resolveVisualSkillRatio('social-cover', '21:9'), '21:9');
  assert.equal(resolveVisualSkillRatio('poster', '21:9'), '21:9', '六档之间可以自由切换（用户 #7-4：「很多很多个尺寸」）');
  assert.equal(resolveVisualSkillRatio('brand-kv', '4:3'), '4:3');
  /* 合法档位之外的比例仍然回落到该技能的第一档（默认值语义没变）
     ⚠️ 2026-09-19 批 P：用来举例的非法值从 '5:4' 换成 '9:21' —— 判据没变，
        变的是"哪些比例合法"这个事实：4:5 / 5:4 本批**已经进引擎**（知渔「批量出图电商图」的
        10 档比例里有它们，用户第 20 轮：「要选项的地方要选项……抄到位」），
        所以 5:4 现在**应该**原样返回（上面的 poster 断言也印证了）。
        '9:21' 是知渔「图片复刻」页有、我们**故意不抄**的那一档（引擎没有对应尺寸，
        抄进界面就是"选了被静默回落成 1:1"），拿它当非法值举例才站得住。 */
  assert.equal(resolveVisualSkillRatio('poster', '5:4'), '5:4', '5:4 已是合法档位（批 P 新增）');
  /* ⚠️ 批 X：'9:21' 现在是**合法档**了（本批补进引擎尺寸表），所以非法值举例换成 '5:3'
     —— 判据没变（"非法比例回落该技能第一档"），变的是事实。 */
  assert.equal(resolveVisualSkillRatio('poster', '5:3'), '3:4', '非法比例回落该技能第一档');
  assert.equal(resolveVisualSkillRatio('brand-kv', 'nope'), '16:9');
});

test('visual runs keep stable slot request keys and retry only failed slots', () => {
  const initial = createVisualRun({ runId: 'visual-run-1', count: 3, createdAt: 100 });
  assert.deepEqual(initial.slots.map(slot => slot.requestKey), [
    'visual-run-1:1',
    'visual-run-1:2',
    'visual-run-1:3',
  ]);

  const firstDone = updateVisualRunSlot(initial, 0, { status: 'completed', url: stableUrl('a') });
  const secondFailed = updateVisualRunSlot(firstDone, 1, { status: 'failed', error: 'network' });
  const thirdDone = updateVisualRunSlot(secondFailed, 2, { status: 'completed', url: stableUrl('c') });

  assert.equal(initial.slots[0].status, 'pending');
  assert.deepEqual(visualRetryIndexes(thirdDone), [1]);
  assert.equal(thirdDone.slots[0].requestKey, 'visual-run-1:1');
  assert.equal(thirdDone.slots[1].requestKey, 'visual-run-1:2');
});

test('partial success becomes one reviewable visual work and Canvas result', () => {
  let run = createVisualRun({ runId: 'visual-run-2', count: 3, createdAt: 200 });
  run = updateVisualRunSlot(run, 0, { status: 'completed', url: stableUrl('d'), taskId: 'canvas-d' });
  run = updateVisualRunSlot(run, 1, { status: 'failed', error: 'provider unavailable' });
  run = updateVisualRunSlot(run, 2, { status: 'completed', url: stableUrl('e'), taskId: 'canvas-e' });

  const work = buildVisualWorkRecord({
    run,
    prompt: '为夏日音乐节制作一张海报',
    skillId: 'poster',
    model: 'image2',
    ratio: '3:4',
    resolution: '2K',
  });
  assert.equal(work.workType, 'visual');
  assert.equal(work._ecResult, true);
  assert.equal(work._saveKey, 'visual-run-2');
  assert.equal(work.generationStatus, 'needs_review');
  assert.equal(work.images.length, 2);
  assert.ok(work.images.every(image => image.url.startsWith('/api/generated-assets/')));

  const canvas = buildVisualCanvasResult(work, { importId: 'visual-import-1' });
  assert.equal(canvas.workType, 'visual');
  assert.equal(canvas.canvasImportId, 'visual-import-1');
  assert.equal(canvas.imageRecords.length, 2);
  assert.deepEqual(Object.values(canvas.images), work.images.map(image => image.url));
});

test('a visual work cannot persist temporary or data image outputs', () => {
  let run = createVisualRun({ runId: 'visual-run-unsafe', count: 2 });
  run = updateVisualRunSlot(run, 0, { status: 'completed', url: 'blob:https://example.test/unsafe' });
  run = updateVisualRunSlot(run, 1, { status: 'completed', url: 'data:image/png;base64,unsafe' });
  assert.throws(() => buildVisualWorkRecord({ run, prompt: 'unsafe' }), /稳定图片/);
});

test('visual work replay becomes a visual gallery checkpoint instead of an ecommerce remix', () => {
  const checkpoint = buildGalleryRemixCheckpoint({
    id: 'visual-gallery-1',
    type: 'visual',
    title: '平台原生封面',
    visualSkillId: 'social-cover',
    prompt: '为公众号制作横幅头图',
    ratio: '21:9',
    resolution: '2K',
    imageModel: 'image2',
    images: [{ url: '/api/generated-assets/gallery-1.png', ratio: '21:9' }],
    referenceAssets: [{ assetId: 'ref-1', url: '/api/generated-assets/ref-1.png' }],
    replay: { skillId: 'social-cover', skillControl: '公众号', panelValues: { headline: '结果先行' } },
  });
  assert.equal(checkpoint.project.kind, 'visual');
  assert.equal(checkpoint.version.inputSnapshot.skillId, 'social-cover');
  assert.equal(checkpoint.version.inputSnapshot.ratio, '21:9');
  assert.equal(checkpoint.version.inputSnapshot.skillControl, '公众号');
  assert.deepEqual(checkpoint.version.inputSnapshot.referenceAssets, [{ assetId: 'ref-1', url: '/api/generated-assets/ref-1.png' }]);
});
