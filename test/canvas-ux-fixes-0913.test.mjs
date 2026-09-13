// test/canvas-ux-fixes-0913.test.mjs
// 2026-09-13 用户批注：
//  ① 左侧「+」菜单分组后变形（根因：样式是直接子元素选择器）
//  ② 「一键套图/一键成片」与「生成电商套图/生成视频」重复 → 撤掉
//  ③ 空画布第一格应是「生成文案」而不是「新建文本」
//  ④ 左侧菜单在切换选择时必须自动收起
//  ⑤ 新建节点要落在视口中央（不能写死左上角）
//  ⑥ 音频入口点了没反应（input 从未渲染）
//  ⑦ 新建画布是独立页面（固定全屏，不被画布顶栏盖住）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('左侧「+」菜单样式不再依赖直接子元素（分组后不变形）', () => {
  const css = read('src/pages/EcCanvas/EcCanvas.css');
  assert.ok(css.includes('.ec-canvas-add-menu button,'), '按钮布局用后代选择器');
  assert.ok(!css.includes('.ec-canvas-add-menu > button'), '不再使用直接子元素选择器');
});

test('菜单不再出现重复的一键套图/一键成片', () => {
  const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
  assert.ok(!studio.includes("'application-1click-suite'"), '一键套图已撤（与生成电商套图重复）');
  assert.ok(!studio.includes("'application-1click-video'"), '一键成片已撤（与生成视频重复）');
  assert.ok(studio.includes('语音合成') && studio.includes('智能字幕'), '应用组保留语音合成/智能字幕');
});

test('空画布第一格是生成文案；新建节点走居中落点', () => {
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.ok(canvas.includes('<HeroGlyph kind="text" />生成文案'), '第一格为生成文案');
  assert.ok(!canvas.includes("addCanvasComposer('image', { x: 220, y: 120 })"), '不再写死左上角坐标');
  assert.ok(canvas.includes('addCanvasComposer(\'text\')'), '生成文案用默认居中落点');
});

test('左侧菜单在切换选择时自动收起', () => {
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.ok(/useEffect\(\(\) => \{\s*if \(!addMenuOpen\) return;\s*setAddMenuOpen\(false\);\s*\}, \[selected, multiSelected\.size\]\);/.test(canvas), '选择变化即收起菜单');
});

test('音频入口有真实 input 元素', () => {
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.ok(canvas.includes('ref={audioUploadRef}'), '音频 input 已渲染');
  assert.ok(canvas.includes('onChange={handleCanvasAudioUpload}'), '已接上传处理');
});

test('新建画布是独立整页（固定全屏）', () => {
  const css = read('src/pages/EcCanvas/components/canvas-library.css');
  const rule = css.match(/\.canvas-library-overlay\.is-page \{([^}]*)\}/);
  assert.ok(/position: fixed/.test(rule[1]), '固定全屏，而不是画布内的层');
  assert.ok(/z-index: 9000/.test(rule[1]), '层级高于画布顶栏/底栏');
});
