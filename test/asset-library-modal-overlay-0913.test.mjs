// test/asset-library-modal-overlay-0913.test.mjs
// 2026-09-14 用户投诉「资产库弹窗不像竞品」，照竞品重做：
//   ① 卡片是方形（近正方形），封面 object-fit: cover 填满容器（不再被内联 object-fit: contain 挤成
//      上下灰条）；② 名称/文案是压在图片底部的半透明渐变遮罩（不占容器空间、不把图片挤扁）；
//   ③ 删除（垃圾桶）按钮默认不可见，hover / focus-within 才浮现到右上角。
//   全部用「基础选择器」（不带 .is-page / .is-selected 之类作用域），任何上下文下都成立。
//   已用真实浏览器（QA 通道 + 接口 mock）与「静态 HTML + 真实 CSS」实测：卡片 165×165（方形）、
//   图片 object-fit cover、遮罩贴底、垃圾桶默认 opacity 0 → hover 1。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const pickerCss = read('src/pages/EcCanvas/components/canvas-asset-picker.css');
const supervisorCss = read('src/styles/canvas-supervisor.css');

test('资产库弹窗卡片：方形 + 缩略图 1:1（基础规则，不依赖作用域）', () => {
  const card = pickerCss.match(/\.canvas-asset-picker-card \{[^}]*\}/)[0];
  assert.ok(/aspect-ratio: 1 \/ 1/.test(card), '卡片按 1:1 方形（近正方形）');
  assert.ok(/min-height: 148px/.test(card), '方形带 min-height 兜底（防塌陷成细条）');
  const thumb = pickerCss.match(/\.canvas-asset-picker-thumb \{[^}]*\}/)[0];
  assert.ok(/aspect-ratio: 1 \/ 1/.test(thumb), '缩略图容器 1:1');
  assert.ok(/min-height: 148px/.test(thumb), '缩略图也有最小高度兜底');
});

test('封面填满容器：object-fit cover（!important 压过组件内联 contain）', () => {
  const fill = pickerCss.match(/\.canvas-asset-picker-thumb img, \.canvas-asset-picker-thumb video \{[^}]*\}/)[0];
  assert.ok(/object-fit: cover !important/.test(fill), 'cover 用 !important 覆盖内联样式（真实渲染曾为 contain，图片四周露灰条）');
  assert.ok(/object-position: center center/.test(fill), '居中裁剪（长图取中间）');
});

test('名称遮罩层存在（基础规则）：压在图片底部的半透明渐变遮罩', () => {
  const name = pickerCss.match(/\.canvas-asset-picker-name \{[^}]*\}/)[0];
  assert.ok(/position: absolute/.test(name), '遮罩是绝对定位（不占容器空间）');
  assert.ok(/bottom: 0/.test(name), '贴容器底部');
  assert.ok(/linear-gradient/.test(name), '底部渐变半透明遮罩');
  assert.ok(/pointer-events: none/.test(name), '不挡卡片点击');
});

test('垃圾桶按钮：默认 opacity:0，hover / focus-within 才显示（右上角）', () => {
  const del = pickerCss.match(/\.canvas-asset-picker-delete \{[^}]*\}/)[0];
  assert.ok(/opacity: 0/.test(del), '默认隐藏');
  assert.ok(/top: 8px/.test(del) && /right: 8px/.test(del), '出现在右上角');
  assert.ok(pickerCss.includes('.canvas-asset-picker-card:hover .canvas-asset-picker-delete'), '鼠标悬停显示');
  assert.ok(pickerCss.includes('.canvas-asset-picker-card:focus-within .canvas-asset-picker-delete'), '键盘聚焦显示');
});

test('资产库管理弹窗（canvas-supervisor.css）：卡片方形化 + 封面填满 + 垃圾桶悬停浮现', () => {
  assert.ok(/\.canvas-asset-library-modal article \{[^}]*aspect-ratio: 1 \/ 1 !important/.test(supervisorCss), '弹窗卡片方形（近正方形）');
  assert.ok(/\.canvas-asset-library-modal article > div:first-child > div:first-child \{[^}]*height: 100% !important/.test(supervisorCss), '封面填满整卡');
  assert.ok(/\.canvas-asset-library-modal article img, \.canvas-asset-library-modal article video \{[^}]*object-fit: cover/.test(supervisorCss), '封面 cover 裁剪');
  assert.ok(/\.canvas-asset-library-modal article > div:first-child > div:nth-child\(2\) \{[^}]*linear-gradient/.test(supervisorCss), '名称/文案是渐变遮罩');
  assert.ok(/\.canvas-asset-library-modal \.ec-asset-card-delete \{[^}]*opacity: 0/.test(supervisorCss), '垃圾桶默认隐藏');
  assert.ok(supervisorCss.includes('.canvas-asset-library-modal article:hover .ec-asset-card-delete'), 'hover 显示');
  assert.ok(supervisorCss.includes('.canvas-asset-library-modal article:focus-within .ec-asset-card-delete'), 'focus-within 显示');
});
