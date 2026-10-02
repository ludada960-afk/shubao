// test/canvas-ui-consistency-0911.test.mjs
// 用户 9-11 图片批注 8 项 UI 一致性修复的契约钉:
//   ① 替换按钮上节点 (node-capsule)  ② 运行按钮纯图标  ③ 左右加号+连线重叠+动态 UI
//   ④ 铺开 offer 底部自动消失  ⑤ skill 选项进生成器  ⑥ 视频节点不黑  ⑦ 模型图标与首页同源
// 风格: source-slice 契约测试 (项目既有模式), 不渲染整页。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { CANVAS_SKILLS, applyCanvasSkill } from '../src/pages/EcCanvas/canvasStudioModel.js';
import { CANVAS_PORT_CENTER_OFFSET } from '../src/pages/EcCanvas/canvasGeometry.js';

const pageSource = () => readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const studioSource = () => readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
const cssSource = () => readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');

test('① 替换按钮在节点上: node-capsule 角标胶囊, 工具条不再承载', () => {
  const studio = studioSource();
  assert.match(studio, /ec-canvas-node-replace/, '节点替换胶囊类名');
  assert.match(studio, /onReplace\(\);/, '胶囊点击走 onReplace');
  const page = pageSource();
  /* 2026-10-01（批 CY-㊴ 之十八）：图片节点的替换改走「按 node.id 缓存的稳定回调」，
     这里守的是"仍然接到 handleToolAction"这件事，而不是必须写成内联箭头
     —— 后者恰恰是会让 React.memo 失效的写法。 */
  assert.match(page, /onReplace=\{replaceAction\.canRun\(node\) \? h\.onReplaceMedia : null\}/, '图片节点接 onReplace');
  assert.match(page, /onReplaceMedia: nodeId => \{[\s\S]*?getCanvasAction\('replace-media'\)[\s\S]*?handleToolAction\(action, target\)/,
    'onReplaceMedia 必须仍然打到 handleToolAction');
  assert.match(page, /onReplace=\{replaceGenAction\.canRun\(node\)/, '生成节点接 onReplace');
});

test('② 运行按钮 = 纯图标 icon-button, 无「运行」文字, ≥2 选中才高亮', () => {
  const page = pageSource();
  assert.doesNotMatch(page, /ec-canvas-run-button/, '旧的紫色文字 pill 已移除');
  assert.match(page, /ec-canvas-icon-button \$\{multiSelected\.size >= 2 \? 'is-active' : ''\}/, '运行按钮回归 icon-button 体系, ≥2 选中才高亮');
  assert.doesNotMatch(page, /<Play size=\{13\} aria-hidden="true" \/><span>运行<\/span>/, '运行按钮不再显示「运行」文字');
  assert.match(page, /选中 2 个以上节点可运行整链/, '多选提示语');
});

test('③ 左右加号: 输入锚点 + 输出加号, 连线端点=加号中心 (17px 外偏) 重叠', () => {
  const studio = studioSource();
  /* 9-11 三轮: 左加号与右加号同功能 (点击即开派生菜单, 不再是死锚点) */
  /* 批 CY-㊴：判据不再锁整串字面量（多两个 prop 就会假红），只守意图：
     图片节点左侧有一个**输入**加号、右侧有一个**输出**加号，两者同功能。 */
  assert.match(studio, /<DerivePort side="input" visible=\{presentation\.handlesVisible \|\| connectActive\}/,
    '图片节点左侧输入加号存在，且拖线期间（connectActive）也会亮出来');
  assert.match(studio, /<DerivePort visible=\{presentation\.handlesVisible \|\| connectActive\}/,
    '图片节点右侧输出加号存在');
  assert.match(studio, /is-input/, '输入加号 CSS 定位类');
  const css = cssSource();
  assert.match(css, /\.ec-canvas-node-port\.is-input \{ right: auto; left: -32px/, '左加号镜像定位');
  assert.match(css, /\.ec-canvas-edge-line\.is-animated/, '进行中边常驻流动');
  assert.match(css, /\.ec-canvas-edge-line:hover \{ stroke-dasharray: 10 14/, 'hover 边流动加粗');
  assert.equal(CANVAS_PORT_CENTER_OFFSET, 17, '连线端点与加号中心重叠 (几何真源)');
});

test('④ 铺开 offer: 底部卡片 + 8s 自动关闭, 文案不再提琥珀[槽]', () => {
  const page = pageSource();
  assert.match(page, /setTimeout\(\(\) => setWorkflowRunOffer\(null\), 8000\)/, '8s 自动关闭');
  assert.doesNotMatch(page, /把商品图拖进琥珀描边的 \[槽\] 节点/, '旧琥珀槽文案已清');
  const css = cssSource();
  assert.match(css, /\.ec-canvas-workflow-offer \{[^}]*position: fixed/s, 'offer 是固定定位卡片');
  assert.match(css, /bottom: 152px/, '并入底部提示区');
  assert.doesNotMatch(css, /\.ec-canvas-media-node\.is-slot/, 'P4 后死掉的琥珀槽样式已移除');
});

test('⑤ skill 选项进生成器: P2 五技能 → 提示词预填 (不覆盖已写内容)', () => {
  const studio = studioSource();
  assert.match(studio, /ec-canvas-skill-popover/, '图片生成器 skill popover');
  assert.match(studio, /<label>技能<select value=\{node\.skill || ''\}/, '视频生成器 skill 下拉');
  assert.equal(CANVAS_SKILLS.length, 5, 'P2 五套内置技能');
  // 纯函数: 空 prompt 预填, 非空不覆盖
  const filled = applyCanvasSkill({ prompt: '', skill: 'white-bg-main' });
  assert.equal(filled.skill, 'white-bg-main');
  assert.match(filled.prompt, /白底/);
  /* 2026-09-16 判据更新（用户批注图5-①）：非空时**追加**，仍然绝不覆盖。 */
  const kept = applyCanvasSkill({ prompt: '我的自定义要求', skill: 'white-bg-main' });
  assert.ok(kept.prompt.startsWith('我的自定义要求'), '已有 prompt 必须保留（技能只能追加，不能覆盖）');
  assert.ok(kept.prompt.length > '我的自定义要求'.length, '技能正文必须真的进到输入框里');
  const cleared = applyCanvasSkill({ prompt: 'x', skill: null });
  assert.equal(cleared.skill, null);
});

test('⑥ 视频节点不黑: 卡片与其他节点同款浅色, 仅播放器 letterbox 深色', () => {
  const css = cssSource();
  const videoCard = css.slice(css.indexOf('.ec-canvas-generation-node.is-video {'), css.indexOf('.ec-canvas-generation-node.is-video.is-selected'));
  assert.match(videoCard, /background: #f6f7f9/, '视频节点卡片 = 其他生成节点同款浅色');
  assert.match(css, /\.ec-canvas-video-frame > video \{[^}]*background: #111827/s, '播放器 letterbox 保留深色 (视频显示规范)');
});

test('⑦ 模型与首页同源: 画布模型选项带首页同款缩略图; 视频模型读后端 catalog', () => {
  const studio = studioSource();
  /* 9-11 三轮: 模型选项改用真实品牌标 (ModelLogo + brandLogo), 与首页同源 */
  assert.match(studio, /<ModelLogo logo=\{brandLogo\(model\.brand\)\}/, '生图模型选项品牌标 (与首页同源)');
  assert.match(studio, /videoProducts\.length \? videoProducts/, '视频模型选项来自后端 catalog (首页同 API)');
  const page = pageSource();
  assert.match(page, /fetchVideoCapabilities\(\)/, '画布拉取视频 catalog');
  assert.match(page, /setVideoProducts\(products\)/, '拉取结果入 state 传给视频生成器');
});
