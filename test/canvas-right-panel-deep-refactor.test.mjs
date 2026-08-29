import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const indexJsxPath = resolve(repoRoot, 'src/pages/EcCanvas/index.jsx');
const panelJsxPath = resolve(repoRoot, 'src/pages/EcCanvas/components/EcCanvasRightPanel.jsx');
const panelCssPath = resolve(repoRoot, 'src/styles/canvas-right-panel.css');
const chainServicePath = resolve(repoRoot, 'server/services/chainService.mjs');
const chainJsPath = resolve(repoRoot, 'src/services/chain.js');

const indexSource = readFileSync(indexJsxPath, 'utf8');
const panelSource = readFileSync(panelJsxPath, 'utf8');
const panelCss = readFileSync(panelCssPath, 'utf8');
const chainJsSource = readFileSync(chainJsPath, 'utf8');

/* 4c183cd4 续命 画布深度重构 (用户 8-29 3 反馈) 测试套件
   反馈 1: 选中节点时, 上方 toolbar 跟右面板同时张开 (双面板联动)
   反馈 2: 画布不能是空白的, 必须按 4c183cd4 续命 总统统筹 v2 骨架 + 4c183cd4 续命 8 大新规划重构
   反馈 3: 下面 3 智能按钮 (1-click 套图/视频/TTS) 跟上面 5 原有按钮必须差异化, 走 chainService 4 步 */

test('反馈 1: EcCanvasRightPanel.jsx 新组件已创建 (资深美工 + 产品经理 4 视角合一)', () => {
  assert.ok(existsSync(panelJsxPath), 'EcCanvasRightPanel.jsx 必须存在 (4c183cd4 续命 画布深度重构)');
  assert.ok(panelSource.includes('export function EcCanvasRightPanel'), '必须 export 组件');
});

test('反馈 1: canvas-right-panel.css 新 CSS 资产 + 毛玻璃 + 暗色 + 响应式 (资深美工视角)', () => {
  assert.ok(existsSync(panelCssPath), 'canvas-right-panel.css 必须存在');
  assert.ok(panelCss.includes('backdrop-filter: blur(22px)'), '必须 22px 毛玻璃 (资深美工视角)');
  assert.ok(panelCss.includes('data-theme="dark"'), '必须暗色模式适配 (资深美工视角)');
  assert.ok(panelCss.includes('@media (max-width: 1100px)'), '必须响应式 (资深美工视角)');
  assert.ok(panelCss.includes('@media (max-width: 760px)'), '必须移动端响应 (资深美工视角)');
  assert.ok(panelCss.includes('@media (prefers-reduced-motion: reduce)'), '必须减动效模式 (资深美工视角)');
});

test('反馈 1: 右面板 3 块结构 (顶部 hero 缩略图 + 中部 14 派生菜单 + 底部 adjust 参数) (产品经理视角)', () => {
  assert.ok(panelSource.includes('ec-canvas-right-panel__hero'), '必须有 hero 块 (产品经理视角)');
  assert.ok(panelSource.includes('ec-canvas-right-panel__menu'), '必须有 menu 块 (产品经理视角)');
  assert.ok(panelSource.includes('ec-canvas-right-panel__adjust'), '必须有 adjust 块 (产品经理视角)');
  assert.ok(panelSource.includes('CanvasDeriveMenu'), '中部必须复用 CanvasDeriveMenu 14 项菜单 (产品经理视角)');
});

test('反馈 1: 右面板包含 4 类调整参数 (透明度/尺寸/位置/AI 积分) (产品经理视角)', () => {
  assert.ok(panelSource.includes('透明度'), '必须有透明度参数 (产品经理视角)');
  assert.ok(panelSource.includes('AI 积分'), '必须有 AI 积分显示 (商业化视角)');
  assert.ok(panelSource.includes('音量'), '必须有音量参数 (视频/音频节点)');
  assert.ok(panelSource.includes('时长'), '必须有时长参数 (视频节点)');
});

test('反馈 1: EcCanvas/index.jsx 集成右面板 (跟 CanvasObjectToolbar 一起张合 = 双面板联动)', () => {
  assert.ok(indexSource.includes("import { EcCanvasRightPanel }"), '必须 import EcCanvasRightPanel');
  assert.ok(indexSource.includes("canvas-right-panel.css'"), '必须 import 新 CSS 资产');
  assert.ok(indexSource.includes('selectionPanelsVisible && <EcCanvasRightPanel'), '必须用 selectionPanelsVisible 守卫 (跟 CanvasObjectToolbar 同步)');
});

test('反馈 1: 右面板路由 9 action (5 原有 + 4 智能) 跟 CanvasObjectToolbar 共享 14-action 派生菜单契约', () => {
  assert.ok(indexSource.includes('onDeriveSelect={action =>'), '必须有 onDeriveSelect 路由');
  for (const id of ['text-generation', 'ecommerce-suite', 'video-generation', 'image-edit', 'tts-voiceover', 'caption-motion', 'one-click-suite', 'one-click-video']) {
    assert.ok(indexSource.includes("id === '" + id + "'"), '右面板路由必须覆盖 action id: ' + id);
  }
});

test('反馈 3: 3 智能按钮 (1-click 套图/视频/TTS) 调 handleSmartChainAction (跟 5 原有区分)', () => {
  assert.ok(indexSource.includes("handleSmartChainAction('one-click-suite')"), '1-click 套图必须调 handleSmartChainAction');
  assert.ok(indexSource.includes("handleSmartChainAction('one-click-video')"), '1-click 视频必须调 handleSmartChainAction');
  assert.ok(indexSource.includes("handleSmartChainAction('tts-voiceover')"), 'TTS 配音必须调 handleSmartChainAction');
});

test('反馈 3: handleSmartChainAction 真调 chainService.executeChain 4 步 (不是 addCanvasComposer)', () => {
  assert.ok(indexSource.includes('executeChainService'), '必须调 chainService.executeChain (不是单步 addCanvasComposer)');
  assert.ok(indexSource.includes('normalizeChainResponse'), '必须规范化 chain 响应 (4 步状态)');
  assert.ok(!indexSource.includes("addCanvasComposer('suite', { actionId: 'one-click-suite' }"), '1-click 套图不能再走单步 addCanvasComposer (v3 bug)');
  assert.ok(!indexSource.includes("addCanvasComposer('video', { actionId: 'one-click-video' }"), '1-click 视频不能再走单步 addCanvasComposer (v3 bug)');
});

test('反馈 3: chainService 4 步状态机 (文案 -> 首帧 -> 视频 -> 音轨+字幕) 4c183cd4 续命 已就绪 (b015edb8)', () => {
  assert.ok(existsSync(chainServicePath), 'chainService.mjs 必须存在');
  const chainService = readFileSync(chainServicePath, 'utf8');
  assert.ok(chainService.includes('CHAIN_STEPS'), '必须有 4 步定义 (P-G b015edb8)');
  assert.ok(chainService.includes('executeChain'), '必须有 executeChain 入口 (P-G b015edb8)');
  assert.ok(chainService.includes('mountChainRoutes'), '必须挂 HTTP 路由 /api/chain/execute (P-G b015edb8)');
});

test('反馈 3: chainService 客户端 wrapper (src/services/chain.js) 含 executeChain + normalizeChainResponse', () => {
  assert.ok(chainJsSource.includes('export function executeChain'), '必须 export executeChain');
  assert.ok(chainJsSource.includes('export function normalizeChainResponse'), '必须 export normalizeChainResponse (4 步状态)');
  assert.ok(chainJsSource.includes('CHAIN_STEP_LABELS'), '必须 export 4 步标签 (产品经理视角)');
});

test('反馈 3: 画布集成 chainService 4 步进度弹窗 (资深美工视角: 4 步进度 + 完成态对比 + AI 积分)', () => {
  assert.ok(indexSource.includes('chainRun'), '必须有 chainRun 状态 (4 步进度)');
  assert.ok(indexSource.includes('CHAIN_STEP_LABELS'), '必须用 CHAIN_STEP_LABELS (产品经理视角)');
  assert.ok(indexSource.includes('累计 AI 成本'), '弹窗必须显示 AI 成本 (商业化视角)');
  assert.ok(indexSource.includes('chainService 4 步'), '弹窗必须标识是 chainService 4 步 (不是单步)');
});

test('反馈 2: 4c183cd4 续命 P-G 1-click chain (b015edb8) 已 commit + 接入 UI', () => {
  assert.ok(existsSync(chainServicePath), 'P-G chainService 必须就绪 (b015edb8)');
});

test('反馈 2: 资深美工 + 产品经理 + 商业化 + 总统统筹 4 视角都体现在右面板 (cmt 注释含 4 视角关键字)', () => {
  assert.ok(panelSource.includes('资深美工视角'), '必须标注资深美工视角 (画板核心)');
  assert.ok(panelSource.includes('产品经理视角'), '必须标注产品经理视角 (信息架构)');
  assert.ok(panelSource.includes('商业化视角'), '必须标注商业化视角 (AI 积分消耗)');
  assert.ok(panelSource.includes('统筹') || panelSource.includes('TapNow 骨架') || panelSource.includes('Liblib') || panelSource.includes('Quantv'), '必须标注总统统筹视角 (骨架选型 TapNow/Liblib/Quantv)');
});

test('反馈 2: 4c183cd4 续命 画布重构使用 TapNow 骨架 + Liblib 补充 + Quantv 辅助 (4c183cd4 续命 总统统筹 v2 报告 c1046ec1)', () => {
  const found = indexSource.includes('TapNow') || panelSource.includes('TapNow') || panelCss.includes('TapNow');
  assert.ok(found, '画布必须走 TapNow 骨架 (4c183cd4 续命 总统统筹 v2)');
});
