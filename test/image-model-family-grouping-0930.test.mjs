import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { IMAGE_MODELS, SELECTABLE_IMAGE_MODELS, sortImageModelsByFamily } from '../src/services/imageModelCatalog.js';

/* ═══ 批 CY-㊲（2026-09-30，用户批注 图3）：**同厂商的生图模型必须排在一起** ══════════════
   用户原话：「你为什么没有把同类型的模型给排在一起呢？你现在把**不同厂商的模型都打混乱了**呀。
   你应该跟视频生成那边的模型面板一样……然后这个问题**肯定不只是首页这边存在**。
   你像现在各个 skill 的子页面以及**画布里面的模型选择器**里面肯定也存在同样的问题的。」

   为什么门禁守在**目录**这一层：用户点名了三个地方（首页 / skill 子页 / 画布），
   而它们全都 `import { SELECTABLE_IMAGE_MODELS }` —— 也就是说
   **一处排序，三处同时生效**。若改成"每个面板各排一次"，这道门禁就守不住了，
   而那种做法早晚会漂回去（这正是本仓反复吃过的亏）。 */

const brandOf = m => m.brand || m.family || 'other';

/** 把序列切成「同 brand 的连续段」 */
function familyRuns(models) {
  const runs = [];
  for (const m of models) {
    const b = brandOf(m);
    if (runs.length && runs[runs.length - 1].brand === b) runs[runs.length - 1].count += 1;
    else runs.push({ brand: b, count: 1 });
  }
  return runs;
}

test('① 页面上真正渲染的那份清单里，每个厂商只占一段（不再交错）', () => {
  const runs = familyRuns(SELECTABLE_IMAGE_MODELS);
  const distinct = new Set(runs.map(r => r.brand));
  assert.equal(
    distinct.size, runs.length,
    `同厂商必须相邻。实得分段：${runs.map(r => `${r.brand}×${r.count}`).join(' → ')}（出现了交错）`,
  );
  assert.ok(SELECTABLE_IMAGE_MODELS.length >= 2, '样本量要够，否则这条断言是空转');
});

test('② 排序**不丢模型、也不改内容**（只动顺序）', () => {
  assert.equal(SELECTABLE_IMAGE_MODELS.length, IMAGE_MODELS.length, '不能因为排序少掉/多掉档位');
  const key = m => m.id;
  assert.deepEqual(
    SELECTABLE_IMAGE_MODELS.map(key).slice().sort(),
    IMAGE_MODELS.map(key).slice().sort(),
    '排序前后的 id 集合必须完全一致',
  );
  for (const m of SELECTABLE_IMAGE_MODELS) {
    const src = IMAGE_MODELS.find(x => x.id === m.id);
    assert.equal(m.label, src.label, `${m.id} 的文案不许被排序顺手改掉`);
    assert.equal(m.brand, src.brand, `${m.id} 的 brand 不许被排序改写`);
  }
});

test('③ 同厂商内部**保持目录里的原序**（稳定排序，不能重排档位）', () => {
  for (const b of new Set(SELECTABLE_IMAGE_MODELS.map(brandOf))) {
    const inCatalog = IMAGE_MODELS.filter(m => brandOf(m) === b).map(m => m.id);
    const onScreen = SELECTABLE_IMAGE_MODELS.filter(m => brandOf(m) === b).map(m => m.id);
    assert.deepEqual(onScreen, inCatalog, `厂商 ${b} 内部的顺序被改动了`);
  }
});

test('④ 判据自证：故意打乱的样本**必须**被判红（否则这条门禁恒真）', () => {
  const shuffled = [
    { id: 'a', brand: 'x' }, { id: 'b', brand: 'y' },
    { id: 'c', brand: 'x' }, { id: 'd', brand: 'y' },
  ];
  const runs = familyRuns(sortImageModelsByFamily(shuffled));
  const distinct = new Set(runs.map(r => r.brand));
  assert.equal(distinct.size, runs.length, '排序函数没有把 x/y 归拢');

  // 反向自证：**未排序**的那份确实是交错的
  const raw = familyRuns(shuffled);
  assert.ok(new Set(raw.map(r => r.brand)).size < raw.length, '样本本身应当是交错的（否则上面那条是空转）');
});

test('⑤ 三个消费点都读这一份清单（不许谁自己另排一份）', () => {
  /* 用户明说这个问题遍布「首页 / skill 子页面 / 画布模型选择器」。
     这里把那三个文件钉住：它们必须从目录 import，而不是各自维护一张名单。 */
  const surfaces = [
    ['首页图片板块', 'src/components/media/ModelOptionRows.jsx'],
    ['skill 子页面', 'src/components/media/FieldRenderer.jsx'],
    ['画布模型选择器', 'src/pages/EcCanvas/components/CanvasStudio.jsx'],
  ];
  for (const [label, file] of surfaces) {
    const src = readFileSync(file, 'utf8');
    assert.match(
      src, /SELECTABLE_IMAGE_MODELS/,
      `${label}（${file}）必须读目录那份清单，否则排序在那一处会失效`,
    );
  }
  /* 顺序也钉住：目录里冻结的**必须已经是归拢后的**那份，
     否则有人把 SELECTABLE 改回 IMAGE_MODELS.filter(...) 就会静默退回交错。 */
  const catalog = readFileSync('src/services/imageModelCatalog.js', 'utf8');
  assert.match(
    catalog, /SELECTABLE_IMAGE_MODELS\s*=\s*Object\.freeze\(\s*sortImageModelsByFamily\(/,
    'SELECTABLE_IMAGE_MODELS 必须在冻结前先过一遍 sortImageModelsByFamily',
  );
});
