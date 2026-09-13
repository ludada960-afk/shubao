// test/canvas-ux-fixes-0913b.test.mjs
// 2026-09-13 用户批注（第二批）：
//  ① 撤掉重复的「电商画布」导航入口（画布服务所有项目，不是只服务电商）
//  ② 撤掉「回收站」（死状态，删除即删除）
//  ③ 双击空白添加的应是「生成文案」，不是纯文本节点
//  ④ 品牌色标题图标颜色要与其他标题一致
//  ⑤ 生成设置面板要一打开就看全（加高 + 压缩间距）
//  ⑥ 视频生成按钮：无素材无文字必须禁用（根因：hasRequiredVideoInputs 在智能模式恒为 true）
//  ⑦ 资产库弹窗 / 画布库：照竞品（悬停放大、垃圾桶、方形容器、遮罩信息、分类）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('导航不再有「电商画布」，画布页签不再有「回收站」', () => {
  const nav = read('src/components/layout/creativeDomainNavigation.js');
  assert.ok(!nav.includes("id: 'commerce-canvas'"), '重复入口已撤');
  const chrome = read('src/pages/EcCanvas/components/CanvasChrome.jsx');
  assert.ok(!chrome.includes("['trash', '回收站']"), '回收站页签已撤');
});

test('双击空白添加的是生成文案', () => {
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.ok(/if \(kind === 'text'\) \{\s*setAddNodePanel\(null\);\s*addCanvasComposer\('text'\);/.test(canvas), '双击文本项改为生成文案');
});

test('品牌色标题图标用强调色，与其它标题一致', () => {
  const panel = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  assert.ok(panel.includes('<Palette size={13} color="#7c3aed" /> 锁定品牌主色调'), '图标颜色一致');
});

test('生成设置面板用足高度且内部间距更紧', () => {
  const css = read('src/pages/Home/Home.css');
  assert.ok(/\.ec-config-panel \{[^}]*max-height: min\(88vh/.test(css), '面板加高到 88vh');
  const panel = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  assert.ok(panel.includes("padding: '10px 14px 12px'"), '内部间距压缩');
});

test('视频按钮按真实输入判定（不再因 requires 恒真而常亮）', () => {
  const video = read('src/pages/VideoStudio/index.jsx');
  assert.ok(video.includes('const uploadedFileCount ='), '按素材数统计');
  assert.ok(video.includes("const hasAnyInput = uploadedFileCount > 0 || Boolean(String(prompt || '').trim());"), '有素材或有文字才算有输入');
  assert.ok(!/const hasAnyInput = Boolean\(requires\)/.test(video), '不再用恒真的 requires 判定');
});

test('资产库弹窗与画布库照竞品（悬停放大 / 垃圾桶 / 方形容器 / 遮罩 / 分类）', () => {
  const sup = read('src/styles/canvas-supervisor.css');
  assert.ok(/canvas-asset-library-modal article:hover \{[^}]*scale\(1\.035\)/.test(sup), '资产卡悬停放大');
  assert.ok(/canvas-asset-library-modal \.ec-asset-card-delete \{[^}]*opacity: 0/.test(sup), '删除按钮默认隐藏');
  const lib = read('src/pages/EcCanvas/components/canvas-library.css');
  assert.ok(/canvas-library-cover \{[^}]*aspect-ratio: 1 \/ 1/.test(lib), '方形容器');
  assert.ok(/object-position: center center/.test(lib), '封面居中裁剪');
  assert.ok(/canvas-library-card-body \{[^}]*position: absolute/.test(lib), '信息是遮罩、不占容器');
  const modal = read('src/pages/EcCanvas/components/CanvasLibraryModal.jsx');
  assert.ok(modal.includes('LIBRARY_FILTERS'), '画布库有分类筛选');
});
