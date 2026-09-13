// test/visual-subpages-and-add-menu-0913.test.mjs
// 2026-09-13 用户批注：
//  ① 自由创作四个子页面要各自适配文案（素材提示 + 提示词引导）
//  ② 画布左侧「+」菜单要补「应用」分类（并把「添加音频」纳入资源组）
//  ③ 资产库弹窗内多余的标题/副标题/说明要去掉
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('四个子页面各自有素材提示与提示词引导', () => {
  const model = read('src/pages/Home/visualCreationModel.js');
  for (const id of ["id: 'free'", "id: 'poster'", "id: 'social-cover'", "id: 'brand-kv'"]) {
    assert.ok(model.includes(id), '缺少子页面 ' + id);
  }
  assert.equal((model.match(/materialHint:/g) || []).length, 4, '四个子页面都要有素材提示');
  assert.equal((model.match(/promptHint:/g) || []).length, 4, '四个子页面都要有提示词引导');
  const mode = read('src/pages/Home/VisualCreationMode.jsx');
  assert.ok(mode.includes('selectedSkill.materialHint'), '素材区使用子页面文案');
  assert.ok(mode.includes('selectedSkill.promptHint'), '提示词框使用子页面文案');
});

test('左侧「+」菜单有「应用」分类且音频进资源组', () => {
  const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
  assert.ok(studio.includes("'upload-audio'"), '音频归入资源组');
  assert.ok(studio.includes('APPLICATION_ACTION_IDS'), '应用分组定义');
  for (const id of ['application-tts', 'application-caption', 'application-1click-suite', 'application-1click-video']) {
    assert.ok(studio.includes(id), '缺少应用 ' + id);
  }
  assert.ok(studio.includes('aria-label="应用"'), '应用分组标题');
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.ok(canvas.includes("else if (actionId === 'upload-audio') audioUploadRef.current?.click();"), '音频入口已接');
  assert.ok(canvas.includes('请先在画布上选中一个素材，再使用这个应用'), '未选中素材时有明确提示');
});

test('资产库弹窗里不再堆标题/副标题', () => {
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.ok(!canvas.includes("asset.projectTitle || ''"), '卡片不再重复显示项目名');
  assert.ok(!canvas.includes('图片、视频和音频 · 可搜索'), '去掉冗余副标题');
});
