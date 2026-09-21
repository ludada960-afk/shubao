import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { stripComments } from '../scripts/lib/token-scope.mjs';
import { planToContextText } from '../src/pages/VideoStudio/cameraMoves.js';
import { VIDEO_WORKBENCHES } from '../src/skills/videoWorkbenches.js';

/* ═══ 批 U（2026-09-21）门禁：用户本轮 8 张截图里的几条硬要求 ═════════════════════════════════
   用户原话（逐字，逐条对应下面的用例）：
     · 「首页左上角 LOGO 和右上角的登录按钮都会向上面挤压，你这个是**绝对不对的**」
     · 「鼠标放上去的**试一试是变形的**，你要抄图三（flova）的做法呀」
     · 「你现在这个视频模型的面板是**会脱离你的这个按钮的**，一定是要**吸附在上面**的」
     · 「他们右边都有一个……**滚动条**，问题是他们根本没有那么多信息可以去滚动呀……很多余啊」
     · 「视频生成和图片生成……**规格、色彩、UI、交互都应该保持一致**」「按照图片生成这边的规格去做」
     · 「视频生成这边你现在的这个暖黄色输入框的周边……**那边是没有那么多留白的呀**」
     · 「**代为撰写首页这边是不需要的**，我们的竞争对手他们也没有这个呀」
     · 「『产品卖点与设计风格，一键解析商品信息，0.2 积分』这个**也是多余的**……各个子页面应该都有这个问题」
     · 「**可以吧，让它自动落进去**」（AI 分析结论落进「门店信息」那一格） */

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const shellCss = read('src/styles/app-shell.css');
const rowCss = read('src/components/media/SkillEntryRow.css');
const videoCss = read('src/pages/VideoStudio/VideoStudio.css');
const videoPage = stripComments(read('src/pages/VideoStudio/index.jsx'));
const creation = stripComments(read('src/pages/MediaCreation/index.jsx'));
const visualCss = read('src/pages/Home/VisualCreationMode.css');

test('① 顶栏滚动时不再压缩（头部不跳）', () => {
  assert.doesNotMatch(shellCss, /\.app-topbar\.is-compact \{[^}]*padding-top/, '紧凑态不得再改内边距');
  assert.doesNotMatch(shellCss, /\.app-topbar\.is-compact \.topbar-brand-mark/, '紧凑态不得再缩品牌标');
  assert.doesNotMatch(shellCss, /\.app-topbar\.is-compact \.topbar-row \{[^}]*padding-block/, '紧凑态不得再压行高');
  /* 但毛玻璃底与描边保留（滚动时视觉上仍然是"浮在上面的一条"） */
  assert.match(shellCss, /\.app-topbar\.is-compact \{[^}]*backdrop-filter/, '紧凑态保留毛玻璃底');
});

test('② 悬停 = 内容隐藏 + 原地「试一试」（不再压毛玻璃）', () => {
  assert.match(rowCss, /\.skill-entry-button:hover \.skill-entry-glyph,[\s\S]{0,400}visibility: hidden;/, '图标悬停隐藏');
  assert.match(rowCss, /\.skill-entry-button:hover \.skill-entry-name,[\s\S]{0,400}visibility: hidden;/, '名字悬停隐藏');
  assert.doesNotMatch(rowCss, /\.skill-entry-try \{[^}]*backdrop-filter/, '不再有毛玻璃遮罩');
});

test('③ 视频侧两个面板照图片侧的规格（同一档宽度 / 圆角 / 底色 / 阴影）', () => {
  /* 容器：与 .visual-config-panel 同一组值（480 宽度在 JS 里设，见下一条断言）
     ⚠️ 用正则取规则块，不用 indexOf 切片 —— 上面的写法一旦换行/空格变了就切出空串（本轮踩到）。 */
  const block = (videoCss.match(/\.video-config-panel,\s*\.video-inline-menu \{[\s\S]*?\}/) || [''])[0];
  assert.ok(block.length > 40, '必须存在"两个视频面板同一组值"的规则块');
  assert.match(block, /border: 1px solid rgba\(255, 255, 255, \.86\)/, '描边照图片侧');
  assert.match(block, /border-radius: 8px/, '圆角照图片侧（8）');
  assert.match(block, /background: var\(--sb-surface-panel-solid\)/, '底色照图片侧（不透明面板底）');
  assert.match(block, /box-shadow: 0 28px 80px rgba\(37, 30, 24, \.18\), 0 2px 10px rgba\(37, 30, 24, \.06\)/, '阴影照图片侧');
  /* 两处宽度都是 480（生成设置面板 + 模型菜单） */
  assert.match(videoPage, /const preferred = key === 'settings' \? 480/, '生成设置面板宽度 = 480');
  assert.match(videoPage, /const width = Math\.min\(480, viewportWidth - 24\)/, '模型菜单宽度 = 480');
  /* 建模行照 .sb-opt 的规格 */
  assert.match(videoCss, /\.video-inline-menu > button \{[^}]*padding: 8px 12px;[^}]*border-radius: 12px;[^}]*background: #f4f4f4;/, '模型行照图片侧 .sb-opt 的规格');
});

test('④ 面板吸附按钮：滚动与缩放都重新定位（模型菜单补上了图片侧一直有的那两个监听）', () => {
  assert.match(videoPage, /const followButton = \(\) => positionModelMenu\(\)/, '模型菜单要有跟随函数');
  assert.match(videoPage, /window\.addEventListener\('scroll', followButton, true\)/, '滚动（捕获）时重新定位');
  assert.match(videoPage, /window\.addEventListener\('resize', followButton\)/, '缩放时重新定位');
  assert.match(videoPage, /window\.removeEventListener\('scroll', followButton, true\)/, '卸载时移除监听（不许泄漏）');
});

test('⑤ 去掉"没东西可滚"的滚动条：滚动权交给内层 body', () => {
  assert.match(visualCss, /\.visual-config-panel \{ overflow: visible; \}/, '图片侧面板自身不再滚（那条滚动条是小箭头溢出 8px 骗出来的）');
  assert.match(visualCss, /\.visual-config-panel-body \{ max-height: inherit; overflow-y: auto; \}/, '图片侧滚动权在 body');
  assert.match(videoCss, /\.video-config-panel-body \{ max-height: inherit; overflow-y: auto; \}/, '视频侧同一个口径');
  const cls = (videoCss.match(/\.video-config-panel,\s*\.video-inline-menu \{[\s\S]*?\}/) || [''])[0];
  assert.match(cls, /overflow: visible;/, '视频侧面板同样不再自己滚');
});

test('⑥ 首页暖区留白照图片侧（8px 10px 10px），且首页不再渲染「代为撰写」', () => {
  assert.match(videoCss, /\.video-composer-surface \{\s*padding: 8px 10px 10px;/, '暖色面内边距照图片侧的 8/10/10');
  assert.match(videoPage, /\{!homeComposer && <button type="button" className="video-dawei-entry"/, '「代为撰写」只在非首页那一档渲染');
});

test('⑦ 各子页面里那颗重复的「一键解析商品信息」不再渲染', () => {
  assert.match(creation, /parseAction=\{null\}/, '调试点不再传 parseAction（那一颗按用户口径整块删除）');
  assert.doesNotMatch(creation, /parseAction=\{parseSpec \?/, '不许又把它接回去');
  /* 说明文案里也不许再指向一颗不存在的按钮 */
  const notices = creation.match(/[^\n]*一键解析商品信息[^\n]*/g) || [];
  assert.deepEqual(notices, [], '文案里不得再让用户去点「一键解析商品信息」：' + notices.join(' | '));
});

test('⑨ 视频子页面左栏照知渔的**卡片语言**（白卡 / 描边 / 圆角 / 浅灰子卡 / 虚线框）', () => {
  const wbCss = read('src/components/media/VideoWorkbench.css');
  /* 用户：「像我们这个爆款复刻的这个子页面……**这工作台是两回事**啊」——
     实测知渔 /video-recreation：每块是一张白卡（#fff / 0.8px #e5e7eb / 圆角 19.84 / 内边距 24.8），
     要求清单与只读胶囊再套一层 #f8fafc 浅灰子卡，上传框是 2.4px 虚线 #b8b8b8 圆角 14。 */
  assert.match(wbCss, /\.video-wb-block \{[^}]*border: 1px solid var\(--sb-border-default\);[^}]*border-radius: 16px;[^}]*background: var\(--sb-surface-card\);/,
    '每一块要是独立白卡（描边/圆角 16/白底）—— 色值走站内 token（不抄他们的 hex，见设 token 棘轮门禁）');
  assert.match(wbCss, /\.video-wb-block \{[^}]*padding: 20px;/, '卡内边距 20（他们 24.8 ÷ 1.24）');
  assert.match(wbCss, /\.video-workbench-blocks \{ display: grid; gap: 16px; \}/, '卡与卡之间 16 间距');
  assert.match(wbCss, /\.video-wb-notes, \.video-wb-tags \{[\s\S]{0,160}background: var\(--sb-surface-sunken\);/, '清单/胶囊套浅灰子卡（凹槽底 token）');
  assert.match(wbCss, /\.video-wb-upload \{[\s\S]{0,320}border: 2\.4px dashed var\(--sb-border-strong\);/, '上传框虚线照他们实测的形态（2.4px 粗虚线）');
  /* 左栏不再压一层暖色盒子（那是"两回事"最刺眼的一条） */
  assert.match(videoCss, /\.video-composer\.is-workbench \{[\s\S]{0,240}background: none;/, '子页面左栏不再有暖色底');
});

test('⑩ 上一批的四条判据仍然成立（回归）', () => {
  /* 顶栏不压缩 / 试一试无毛玻璃 / 面板同一档宽 / 面板吸附 —— 都是本轮用户点名过的 */
  assert.doesNotMatch(shellCss, /\.app-topbar\.is-compact \{[^}]*padding-top/);
  assert.doesNotMatch(rowCss, /\.skill-entry-try \{[^}]*backdrop-filter/);
  assert.match(videoPage, /const preferred = key === 'settings' \? 480/);
  assert.match(videoPage, /window\.addEventListener\('scroll', followButton, true\)/);
});

test('⑧ AI 分析结论自动落进「门店信息」那一格（用户：「可以吧，让它自动落进去」）', () => {
  /* 纯函数：喂一份 plan，断言该进四段的进了、空的不留空段 */
  const text = planToContextText({
    summary: '街边小店，暖光',
    creativeStrategy: '以货架与手作为主',
    assets: [{ name: '门店照', role: '环境', observations: ['木质货架', '暖黄灯'], use: '开场' }],
    beats: [{ time: '0-3s', label: '推门', detail: '镜头从门把手推进店内' }],
    optimizedPrompt: '（这一段不该出现在背景信息里）',
  });
  assert.match(text, /一、门店基础视觉信息/, '第一段照占位原文');
  assert.match(text, /街边小店，暖光/, 'summary 进第一段');
  assert.match(text, /二、空间环境细节[\s\S]*木质货架/, '素材观察进第二段');
  assert.match(text, /三、可复用探店镜头提示词素材库[\s\S]*推门/, '分镜进第三段');
  assert.match(text, /四、信息校验备注[\s\S]*可直接修改/, '第四段如实写"可直接改"');
  assert.doesNotMatch(text, /optimizedPrompt|这一段不该出现/, '提示词正文不进这一格（那是补充说明的活）');
  /* 空 plan：一个字都不写（不留空段） */
  assert.equal(planToContextText({}), '', '空 plan 不产出空壳文案');
  assert.equal(planToContextText(null), '');
  /* 接线：分析成功后写进那一格，且**只在为空时**写 */
  assert.match(videoPage, /const filled = planToContextText\(result\.plan\);/, '分析成功后调用它拼文本');
  assert.match(videoPage, /String\(current\[contextBlock\.key\] \|\| ''\)\.trim\(\) \? current : \{ \.\.\.current, \[contextBlock\.key\]: filled \}/,
    '只在那一格为空时写（绝不覆盖用户已写的内容）');
  /* 这一格必须是声明源里真实存在的块（不是页面里硬造的） */
  const tour = VIDEO_WORKBENCHES['video.store_tour'];
  const contextBlock = tour.blocks.find(block => block.kind === 'text' && block.key !== 'prompt');
  assert.ok(contextBlock, '探店漫游要有一个"非主文本格"作为落点');
  assert.match(contextBlock.placeholder, /一、门店基础视觉信息/, '占位照知渔那一页的四段式');
});
