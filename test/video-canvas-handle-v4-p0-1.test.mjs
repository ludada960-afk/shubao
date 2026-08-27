import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const cssPath = new URL('../src/pages/VideoStudio/VideoCanvasWorkbench.css', import.meta.url);
const canvasModelPath = new URL('../src/pages/VideoStudio/videoCanvasFlowModel.js', import.meta.url);
const canvasJsxPath = new URL('../src/pages/VideoStudio/VideoCanvasFlowCanvas.jsx', import.meta.url);

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('V4 P0-1 D4: handle 默认尺寸从 6px 提升到 12px, 解决鼠标偏 1px 失败 (A06 §6.8)', async () => {
  const css = await source(cssPath);
  // 主规则: 覆盖 xyflow/react@12 默认 6px
  assert.match(
    css,
    /\.vcb-flow-root \.react-flow__handle\s*\{[^}]*width:\s*12px[^}]*height:\s*12px/s,
    'should enlarge .vcb-flow-root .react-flow__handle to 12px x 12px (overrides xyflow default 6px)',
  );
  // 防止被 min-width: 5px 收缩 (xyflow 默认), 显式声明 12px 最小值
  assert.match(css, /min-width:\s*12px/);
  assert.match(css, /min-height:\s*12px/);
  // 显式 v4 p0-1 注释存在, 防止后续重构丢失意图
  assert.match(css, /V4 P0-1/);
});

test('V4 P0-1 D4: 无效释放红色反馈 (connectingfrom / connectingto / invalid)', async () => {
  const css = await source(cssPath);
  // 三态共享红色块, 确保 source / target / invalid 都给视觉信号
  assert.match(
    css,
    /\.vcb-flow-root \.react-flow__handle\.connectingfrom[\s\S]*?\.vcb-flow-root \.react-flow__handle\.connectingto[\s\S]*?\.vcb-flow-root \.react-flow__handle\.invalid\s*\{[^}]*#dc2626/s,
    'should mark connectingfrom / connectingto / invalid handle in red (#dc2626)',
  );
  // 红色用 #dc2626 (Tailwind red-600), 与全局错误色一致
  const invalidBlock = css.match(
    /\.vcb-flow-root \.react-flow__handle\.invalid\s*\{[^}]*\}/,
  );
  assert.ok(invalidBlock, 'should have dedicated .invalid block');
  assert.match(invalidBlock[0], /#dc2626/);
  assert.match(invalidBlock[0], /outline:\s*2px solid #dc2626/);
});

test('V4 P0-1 D4: 方向视觉分离 (bottom / top / left / right 2px solid border)', async () => {
  const css = await source(cssPath);
  // 四向 handle 都要有 2px solid 视觉分离
  for (const direction of ['bottom', 'top', 'left', 'right']) {
    const re = new RegExp(`\\.vcb-flow-root \\.react-flow__handle-${direction}\\b`);
    assert.match(css, re, `should reference .react-flow__handle-${direction} for visual separation`);
  }
  // 方向规则必须包含 2px solid 边框
  const directionBlock = css.match(
    /\.vcb-flow-root \.react-flow__handle-(?:bottom|top|left|right),[\s\S]*?\{[\s\S]*?2px solid[\s\S]*?\}/,
  );
  assert.ok(directionBlock, 'direction block should declare 2px solid border');
  // 红态叠加: 4 方向 × 3 状态 = 12 个选择器
  const connectingVariants = css.match(
    /\.vcb-flow-root \.react-flow__handle-(?:bottom|top|left|right)\.(?:connectingfrom|connectingto|invalid)/g,
  );
  assert.ok(connectingVariants, 'should have direction × state variant selectors');
  assert.ok(connectingVariants.length >= 12, `expected ≥12 direction×state selectors, got ${connectingVariants ? connectingVariants.length : 0}`);
});

test('V4 P0-1 D4: scope 限定 .vcb-flow-root, 不污染其他工作树的 React Flow 渲染', async () => {
  const css = await source(cssPath);
  // 抽取 .react-flow__handle 选择器（含行内空白 + 修饰符），用更稳健的 greedy match
  // 每个匹配代表一个 CSS rule 的 selector 部分（不含 { 后内容）
  const handleRules = css.match(/[.#:][^{}\n]*\.react-flow__handle[^{}\n]*\{/g) || [];
  assert.ok(handleRules.length >= 5, `should declare ≥5 handle rules, got ${handleRules.length}: ${JSON.stringify(handleRules)}`);
  for (const rule of handleRules) {
    assert.match(
      rule,
      /\.vcb-flow-root/,
      `handle rule should be scoped under .vcb-flow-root: ${rule}`,
    );
  }
});

test('V4 P0-1 D4: canvasIsValidConnection 维持原 4c183cd4 W1-W4 契约 (asset→shot, shot→shot, 禁 candidate)', async () => {
  const model = await source(canvasModelPath);
  // 已有函数签名稳定
  assert.match(model, /export function canvasIsValidConnection/);
  // 规则: candidate 不可作为 source/target
  assert.match(model, /sourceType === 'candidate'\)\s*return false/);
  assert.match(model, /targetType === 'candidate'\)\s*return false/);
  // 规则: asset → shot 允许, shot → shot 允许, asset → asset 禁止
  assert.match(model, /sourceType === 'asset' && targetType === 'shot'\)\s*return true/);
  assert.match(model, /sourceType === 'shot' && targetType === 'shot'\)\s*return true/);
  assert.match(model, /sourceType === 'asset' && targetType === 'asset'\)\s*return false/);
});

test('V4 P0-1 D4: VideoCanvasFlowCanvas.jsx 不动 (仅 CSS 改动, JSX 保持原样)', async () => {
  const jsx = await source(canvasJsxPath);
  // isValidConnection 仍然挂在 ReactFlow 上, 没改成 onConnectStart/End 监听
  assert.match(jsx, /isValidConnection=\{candidate => canvasIsValidConnection\(/);
  // 节点不显式 Handle (走 React Flow 默认 4 端口)
  assert.doesNotMatch(jsx, /<Handle\b/);
  // 不引入新 className prop 给 handle
  assert.doesNotMatch(jsx, /\.react-flow__handle\.invalid/);
});

test('V4 P0-1 D4: 不破坏 4b4ab2b W1 commit 的 .vcb-handle 缩放手柄 (8x8px)', async () => {
  const css = await source(cssPath);
  // .vcb-handle 是传统 DOM 缩放手柄 (tl/tr/bl/br), 不能被误改
  assert.match(css, /\.vcb-handle\s*\{[^}]*width:\s*8px[^}]*height:\s*8px/s);
  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    assert.match(css, new RegExp(`\\.vcb-handle\\.is-${corner}\\b`));
  }
  // .vcb-handle 和 .react-flow__handle 是两套独立体系, 互不影响
  const vcbHandleDecls = (css.match(/\.vcb-handle\b/g) || []).length;
  const rfHandleDecls = (css.match(/\.react-flow__handle\b/g) || []).length;
  assert.ok(vcbHandleDecls >= 5, 'should keep vcb-handle declarations intact');
  assert.ok(rfHandleDecls >= 5, 'should add new react-flow__handle declarations');
});
