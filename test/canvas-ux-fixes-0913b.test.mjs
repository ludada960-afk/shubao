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


test('空画布不再自称电商画布：标题回落智能画布', () => {
  /* 用户 9-13：这个地方不叫电商画布 —— 视频/电商/自由创作都会进这个画布。
     根因：空画布 result 的 product_name 被写死成「电商画布」，顶部标题直接显示它。 */
  const context = read('src/store/AppContext.jsx');
  assert.ok(!context.includes("product_name: '" + '电商画布' + "'"), '空画布默认项目名不能再是电商画布');
  const chrome = read('src/pages/EcCanvas/components/CanvasChrome.jsx');
  assert.ok(chrome.includes("title || '" + '智能画布' + "'"), '标题缺省值 = 智能画布');
});
test('双击空白添加的是生成文案', () => {
  const canvas = read('src/pages/EcCanvas/index.jsx');
  assert.ok(/if \(kind === 'text'\) \{\s*setAddNodePanel\(null\);\s*addCanvasComposer\('text'\);/.test(canvas), '双击文本项改为生成文案');
});

test('品牌色标题图标用强调色，与其它标题一致', () => {
  const panel = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  /* 2026-09-15：分组标题统一收敛到 <GroupTitle> + groupTitleStyle（规范单一事实源），
     图标颜色由组件统一注入 var(--accent)，不再每个标题各写一份。 */
  assert.ok(panel.includes('<GroupTitle'), '标题走统一 GroupTitle 组件（不再各写一份）');
  assert.ok(/<GroupTitle icon=\{Palette\}>品牌主色调<\/GroupTitle>/.test(panel), '品牌主色调标题走统一 GroupTitle');
  /* 2026-09-15 V3：图标不再染色 —— 原则 6.1 明确「分组标签是层级信息，
     不是品牌动作」，彩色字只有三种合法场合（可点/当前/链接）。
     原断言要求 var(--accent,#7c3aed) 强调色，已被 V3 规范取代。
     现在的契约是：所有分组标题共用同一个 GroupTitle 组件（= 同色同字号），
     且不出现硬编码色值。 */
  /* ⚠️ 2026-09-15 更新：本面板私有的 GroupTitle 已删除，全站只剩一个实现
     （PanelPrimitives.jsx）—— 这是**加强**了本条契约，不是放宽：
     原先每个面板各写一份「统一样式」，现在连那一份也只有一处。 */
  assert.ok(
    /import \{ GroupTitle \} from '\.\/PanelPrimitives\.jsx';/.test(panel),
    'GroupTitle 必须来自全局唯一实现 PanelPrimitives.jsx',
  );
  assert.ok(
    /export function GroupTitle\(\{ icon: Icon, children \}\)/.test(read('src/pages/Home/ec/PanelPrimitives.jsx')),
    '全局 GroupTitle 必须存在并统一注入样式（字号/字重/墨色/图标尺寸档）',
  );
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(panel), '面板内不得再有硬编码色值');
});

test('生成设置面板用足高度且内部间距更紧', () => {
  const css = read('src/pages/Home/Home.css');
  assert.ok(/\.ec-config-panel \{[^}]*max-height: min\(88vh/.test(css), '面板加高到 88vh');
  /* 2026-08-14 用户批注：9-13 的「压缩间距」（padding 10/14/12 + gap 2）后来被用户否掉了 ——
     「这个面板又变形了呀，怎么压得这么矮啊」「基本没有间距了」。
     现在改为「高度按内容自然撑开 + 8pt 呼吸阶梯」：内边距 ≥16px、分区之间 16px。
     本条契约随之更新为校验新口径（细节见 test/modal-breathing-room-0814.test.mjs）。 */
  const panel = read('src/pages/Home/ec/GenSettingsPanel.jsx');
  /* 2026-09-15 V3：间距阶梯第二次上移 —— 从 panelVisualLanguage.SPACING
     进一步收敛到 design-tokens-v3.css 的 --sb-* 变量（全站唯一权威）。
     内边距/分组间距/字段间距现在走 --sb-panel-padding / --sb-group-gap / --sb-field-gap，
     它们是同一套 8pt 阶梯的语义别名，语义不变、事实源更靠上。 */
  assert.ok(panel.includes('--sb-panel-padding'), '面板内边距走统一 token');
  assert.ok(panel.includes('--sb-group-gap'), '分组间距走统一 token');
  assert.ok(panel.includes('--sb-field-gap'), '字段间距走统一 token');
  assert.ok(/\.ec-config-panel \{[^}]*height: auto !important/.test(css), '面板高度按内容自然撑开（不被压扁）');
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
  /* 9-13 修复：封面固定高度（aspect-ratio 在 button 上不稳，曾让卡片塌成细条） */
  assert.ok(/canvas-library-cover \{[^}]*height: 230px/.test(lib), '方形封面（固定高度）');
  assert.ok(/object-position: center center/.test(lib), '封面居中裁剪');
  assert.ok(/canvas-library-card-body \{[^}]*position: absolute/.test(lib), '信息是遮罩、不占容器');
  const modal = read('src/pages/EcCanvas/components/CanvasLibraryModal.jsx');
  assert.ok(modal.includes('LIBRARY_FILTERS'), '画布库有分类筛选');
});
