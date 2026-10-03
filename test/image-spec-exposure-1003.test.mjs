import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';
import { IMAGE_SPEC_EXPOSURE, IMAGE_SPEC_EXPOSURE_FALLBACK, imageFieldExposed } from '../src/skills/imageSpecExposure.js';
import { QUANTV_IMAGE_COUNTERPARTS } from '../src/skills/quantvImageParity.js';
import { skillGenerationSettings } from '../src/skills/skillRun.js';

/* ═══ 2026-10-03 批 DE：图片子页面的「规格露不露」必须与知渔那一页一致 ═════════════════════════════
   起因：批 1003 把「生图模型 / 画面规格」两颗触发器**全局注入**了 45 条图片技能，
   可知渔那几个内建页**根本没有这几格** —— 实采逐页写进了
   docs/design/data/quantv-image-tools-20261003.json 的 `NOT_HAS`：
     商品套图 / A+内容 / 详情图 / 去除背景 都没有「模型选择 · 分辨率 · 比例」，
     图片复刻没有「生成张数」，只有 AI换装 与 概念视觉方案 四格齐全。
   ⇒ 门禁用**同一份实采数据重新派生**并逐条比对，所以手改表格必红
     （"名单写两处必然漂移"那条老教训，与 test/video-spec-exposure-0924 同一条纪律）。 */

const raw = JSON.parse(readFileSync(new URL('../docs/design/data/quantv-image-tools-20261003.json', import.meta.url), 'utf8'));
const captures = raw.pages || {};

function deriveFromEvidence() {
  const derived = {};
  for (const [id, capture] of Object.entries(captures)) {
    const missing = new Set(Array.isArray(capture.NOT_HAS) ? capture.NOT_HAS : []);
    derived[id] = {
      model: !missing.has('模型选择'),
      resolution: !missing.has('分辨率'),
      ratio: !missing.has('比例'),
      count: !missing.has('生成张数'),
    };
  }
  return derived;
}

test('① 规格暴露表与知渔实采一致（手改必红）', () => {
  const derived = deriveFromEvidence();
  assert.deepEqual(Object.keys(IMAGE_SPEC_EXPOSURE).sort(), Object.keys(derived).sort(),
    '有实采的那几条技能集合变了（对照表或实采数据动过）');
  for (const [id, want] of Object.entries(derived)) {
    assert.deepEqual(IMAGE_SPEC_EXPOSURE[id], want,
      `${id} 的规格暴露与知渔那一页不一致（我们应 ${JSON.stringify(want)}）`);
  }
});

test('② 收窄的那几页：面板里不画，网格里也不许残留', () => {
  for (const [id, exposure] of Object.entries(IMAGE_SPEC_EXPOSURE)) {
    const skill = IMAGE_SKILLS.find(item => item.id === id);
    assert.ok(skill, `${id} 不在 IMAGE_SKILLS 里`);
    const config = (skill.fields || []).find(field => field && field.kind === 'config');
    if (!config) {
      /* 一条规格字段都没声明的技能（商品套图 / 去除背景）本来就没有触发器 ——
         这一条**不约束暴露表**：知渔那一页有没有规格格，与我们有没有字段声明，是两件事。 */
      const declared = skill.fields.filter(f => f && ['imageModel', 'ratio', 'clarity'].includes(f.key));
      assert.deepEqual(declared, [], `${id} 既然没有 config 触发器，就不该还留着规格字段`);
      continue;
    }
    const specKeys = skill.fields.filter(f => f && ['imageModel', 'ratio', 'clarity'].includes(f.key)).map(f => f.key);
    const shown = [...(config.specKeys || []), ...(config.modelKey ? [config.modelKey] : [])];
    /* covers 必须是**全部**规格格 —— 它们要从网格里剔掉，但声明留着当取值与报价的真源 */
    assert.deepEqual([...(config.covers || [])].sort(), [...specKeys].sort(),
      `${id} 的 covers 必须盖住全部规格格，否则关掉的那一格还会平铺在左栏`);
    /* 面板里只画知渔真有的那几格 */
    for (const key of specKeys) {
      const slot = key === 'imageModel' ? 'model' : key === 'clarity' ? 'resolution' : 'ratio';
      assert.equal(shown.includes(key), exposure[slot] === true,
        `${id} 的「${key}」露不露与实采不一致`);
      assert.equal(imageFieldExposed(id, key), exposure[slot] === true);
    }
  }
});

test('③ 界面不画 ≠ 请求里没有：隐藏的那一格仍要进请求', () => {
  /* 详情图那一页知渔没有比例格，但请求里的 aspectRatio 仍然是**合法**的
     —— 删掉字段声明会让 skillGenerationSettings 取不到默认值（"少给了还不说"）。 */
  const skill = IMAGE_SKILLS.find(item => item.id === 'image.detail_page');
  assert.ok(skill, '详情图取不到');
  assert.ok(skill.fields.some(f => f && f.key === 'ratio'), 'ratio 声明必须留着（只是不画）');
  const settings = skillGenerationSettings(skill, { ratio: '9:16', market: '中国' });
  assert.match(String(settings.ratio), /^\d+:\d+$/, '请求里的比例必须是合法档');
  assert.ok(settings.resolution, '请求里的清晰度必须有值');
});

test('④ 默认是「全露」，只有实采写了 NOT_HAS 的才收', () => {
  assert.deepEqual(IMAGE_SPEC_EXPOSURE_FALLBACK, { model: true, resolution: true, ratio: true, count: true });
  const own = IMAGE_SKILLS.filter(skill => !QUANTV_IMAGE_COUNTERPARTS[skill.id]?.counterpart);
  assert.ok(own.length >= 10, '自有玩法（知渔没有对应页）应有 10+ 条，实际 ' + own.length);
  for (const skill of own) {
    for (const key of ['imageModel', 'ratio', 'clarity', 'count']) {
      assert.equal(imageFieldExposed(skill.id, key), true,
        `${skill.id} 是自有玩法（知渔没有对应页），规格该按全露处理`);
    }
  }
});

test('⑤ 关键三条的落点写死：详情图 / A+内容 / 商品套图 不给规格入口', () => {
  /* 这三条是用户 2026-10-03 截图里"我们做过头了"的具体位置，写死是为了让改动的人看见影响面。
     （去除背景不在其中：实采没记 NOT_HAS，而且我们那一条本来一条规格字段都没声明。） */
  for (const id of ['image.product_suite', 'image.aplus', 'image.detail_page']) {
    assert.equal(imageFieldExposed(id, 'ratio'), false, id + ' 不该露比例');
    assert.equal(imageFieldExposed(id, 'imageModel'), false, id + ' 不该露模型选择');
    assert.equal(imageFieldExposed(id, 'clarity'), false, id + ' 不该露分辨率');
  }
  for (const id of ['image.copy', 'image.try_on']) {
    assert.equal(imageFieldExposed(id, 'ratio'), true, id + ' 的比例是该给的');
    assert.equal(imageFieldExposed(id, 'clarity'), true, id + ' 的分辨率是该给的');
  }
});
