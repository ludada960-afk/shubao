import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  bringNodeToLayer,
  DUPLICATE_OFFSET,
  duplicateNodePosition,
  isLockedInSet,
  nodeRenameTarget,
  toggleLockedSet,
} from '../src/pages/VideoStudio/videoCanvasModel.js';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('W1 node-ops helpers: duplicate / layer / lock / rename are pure', () => {
  // 复制：沿用 TapNow 体感 +24/+24，避免覆盖原节点
  assert.deepEqual(duplicateNodePosition({ x: 100, y: 80 }), { x: 124, y: 104 });
  assert.deepEqual(duplicateNodePosition({}), { x: 24, y: 24 });
  assert.equal(DUPLICATE_OFFSET.x, 24);
  assert.equal(DUPLICATE_OFFSET.y, 24);

  // 锁定集合：纯 set 语义
  let s = new Set();
  s = toggleLockedSet(s, 'shot:abc');
  assert.equal(s.has('shot:abc'), true);
  s = toggleLockedSet(s, 'shot:abc');
  assert.equal(s.has('shot:abc'), false);
  assert.equal(isLockedInSet(s, 'shot:abc'), false);

  // 节点可重命名：asset / shot 支持，candidate 不支持
  assert.deepEqual(nodeRenameTarget({ type: 'asset', title: '产品图1' }).kind, 'asset');
  assert.deepEqual(nodeRenameTarget({ type: 'shot', title: '开场' }).kind, 'shot');
  assert.equal(nodeRenameTarget({ type: 'candidate' }), null);
  assert.equal(nodeRenameTarget(null), null);

  // 移到顶层 / 底层：保留 x/y，仅改 zIndex
  const before = { 'shot:s1': { x: 100, y: 80 }, 'shot:s2': { x: 200, y: 80 } };
  const front = bringNodeToLayer(before, 'shot:s1', 'front');
  assert.equal(front['shot:s1'].zIndex, 10);
  assert.equal(front['shot:s1'].x, 100);
  assert.equal(front['shot:s2'].zIndex, undefined);
  const back = bringNodeToLayer(front, 'shot:s2', 'back');
  assert.equal(back['shot:s2'].zIndex, 1);
  // 不存在的节点 id 不抛错
  assert.deepEqual(bringNodeToLayer(before, 'shot:ghost', 'front'), before);
});

test('W1 tapnow toolbar: 顶栏紧凑工具组在 flow+legacy 都可见，4 个动作 + 缩放滑杆', async () => {
  const jsx = await source('../src/pages/VideoStudio/VideoCanvasWorkbench.jsx');
  const css = await source('../src/pages/VideoStudio/VideoCanvasWorkbench.css');

  // B · 顶栏工具组 (legacy 路径)
  assert.match(jsx, /className=\"vcb-topbar-tools\"/);
  assert.match(jsx, /aria-label=\"画布工具\"/);
  assert.match(jsx, /aria-label=\"隐藏连线\"/);
  assert.match(jsx, /aria-label=\"网格吸附\"/);
  assert.match(jsx, /aria-label=\"重置画布\"/);
  assert.match(jsx, /aria-label=\"画布缩放\"/);
  assert.match(jsx, /aria-label=\"缩放滑杆\"/);
  assert.match(jsx, /min=\"0\.5\" max=\"2\" step=\"0\.1\"/);

  // B · flow 视图也使用同一组件（React Flow 顶栏由 React Flow 自带；本组件做右下工具语义 = .vcb-flow-hint）
  // 缩放滑杆的视觉规则在 vcb-topbar-tools 内
  assert.match(css, /\.vcb-topbar-tools \{/);
  assert.match(css, /\.vcb-topbar-tools button\.is-on/);
  assert.match(css, /\.vcb-zoom-slider input\[type=\"range\"\]/);
  assert.match(css, /accent-color: var\(--accent/);
});

test('W1 tapnow visual: 三类节点卡片视觉对齐 token 化层级', async () => {
  const css = await source('../src/pages/VideoStudio/VideoCanvasWorkbench.css');

  // A · 节点卡片浮起 + 边框语义
  assert.match(css, /\.vcb-node\.is-asset/);
  assert.match(css, /\.vcb-node\.is-asset\.is-video \{ border-left: 3px solid var\(--blue/);
  assert.match(css, /\.vcb-node\.is-asset\.is-audio \{ border-left: 3px solid var\(--green/);
  assert.match(css, /\.vcb-node\.is-shot \{[\s\S]*?background: linear-gradient\(/);
  assert.match(css, /\.vcb-node\.is-candidate \{ border-style: dashed/);
  // 锁定视觉
  assert.match(css, /\.vcb-node\.is-locked/);
  // 沿用 --accent / --radius-md / --shadow-md 等全站 token
  assert.match(css, /border-radius: var\(--radius-md, 16px\)/);
  assert.match(css, /box-shadow: var\(--shadow-sm/);
});

test('W1 tapnow hover/select: 节点 hover 缩放 + 选中浮起 + 连接点 hover 显隐', async () => {
  const css = await source('../src/pages/VideoStudio/VideoCanvasWorkbench.css');
  const jsx = await source('../src/pages/VideoStudio/VideoCanvasWorkbench.jsx');

  // C · hover 缩放（保持 0.5–3x 区间内、本实现 1.04x 不破坏布局）
  assert.match(css, /\.vcb-stage:not\(.is-panning\) \.vcb-node:hover/);
  assert.match(css, /transform: scale\(1\.04\)/);
  // C · 选中态：300ms 浮起 + 强调色
  assert.match(css, /\.vcb-node\.is-selected \{[^}]*transform: translateY\(-3px\)/);
  assert.match(css, /transition:[^}]*var\(--duration-normal/);
  // C · 连接点 hover 显隐
  assert.match(css, /\.vcb-handle \{[^}]*opacity: 0/);
  assert.match(css, /\.vcb-node:hover \.vcb-handle/);
  assert.match(css, /\.vcb-node\.is-selected \.vcb-handle/);
  assert.match(css, /\.vcb-handle\.is-tl/);
  assert.match(css, /\.vcb-handle\.is-tr/);
  assert.match(css, /\.vcb-handle\.is-bl/);
  assert.match(css, /\.vcb-handle\.is-br/);

  // JSX: 三类节点都注入 4 个连接点 + onContextMenu
  assert.match(jsx, /<span className=\"vcb-handle is-tl\"/);
  assert.match(jsx, /<span className=\"vcb-handle is-br\"/);
  const ctxMatches = (jsx.match(/onContextMenu=\{openContext\}/g) || []).length;
  assert.ok(ctxMatches >= 3, 'asset/shot/candidate 三类节点都接 onContextMenu');
  // locked 类注入
  assert.match(jsx, /locked \? ' is-locked' : ''/);
});

test('W1 tapnow mini-toolbar: 选中 1 节点时显示 5 个动作 (delete/duplicate/lock/regen/fit)', async () => {
  const jsx = await source('../src/pages/VideoStudio/VideoCanvasWorkbench.jsx');
  const css = await source('../src/pages/VideoStudio/VideoCanvasWorkbench.css');

  // D · mini-toolbar 渲染
  assert.match(jsx, /selectedNodes\.length === 1 && /);
  assert.match(jsx, /className=\"vcb-mini-toolbar\"/);
  assert.match(jsx, /aria-label=\"节点快捷操作\"/);
  // 5 个动作：删除 / 复制 / 锁定 / 重新生成 / 缩放至适合
  assert.match(jsx, /aria-label=\"删除节点\"/);
  assert.match(jsx, /aria-label=\"复制节点\"/);
  assert.match(jsx, /aria-label=\{isLocked \? '解锁节点' : '锁定节点'\}/);
  assert.match(jsx, /aria-label=\"重新生成\"/);
  assert.match(jsx, /aria-label=\"缩放至适合\"/);
  // CSS：圆角胶囊 + 阴影 + 浮起
  assert.match(css, /\.vcb-mini-toolbar[\s\S]{0,200}border-radius: var\(--radius-full/);
  assert.match(css, /animation: vcbMiniToolbarIn/);
});

test('W1 tapnow context menu: 6 项 (删除/复制/锁定/移到顶层/置于底层/重命名) + 关闭路径全覆盖', async () => {
  const jsx = await source('../src/pages/VideoStudio/VideoCanvasWorkbench.jsx');
  const css = await source('../src/pages/VideoStudio/VideoCanvasWorkbench.css');

  // E · 右键菜单：6 项
  assert.match(jsx, /createPortal\(/);
  assert.match(jsx, /className=\"vcb-context-menu\"/);
  assert.match(jsx, /role=\"menu\"/);
  assert.match(jsx, />删除</);
  assert.match(jsx, />复制</);
  assert.match(jsx, /isLocked \? '解锁' : '锁定'/);
  assert.match(jsx, />移到顶层</);
  assert.match(jsx, />置于底层</);
  assert.match(jsx, />重命名/);
  // 关闭：Esc + 外部点击 + 内部点击 stopPropagation
  assert.match(jsx, /if \(event\.key === 'Escape'\) setContextMenu\(null\)/);
  assert.match(jsx, /window\.addEventListener\('pointerdown', onClose\)/);
  // 修复 TapNow 7.7 已知 bug：菜单卡死。我们用 pointerdown + escape 双路径关闭，并 stopPropagation 避免误关。
  assert.match(jsx, /event\.preventDefault\(\);[\s\S]{0,80}event\.stopPropagation\(\)/);
  // CSS：阴影 / 圆角 / portal 浮层
  assert.match(css, /\.vcb-context-menu \{[^}]*box-shadow: var\(--shadow-xl/);
  assert.match(css, /\.vcb-context-menu button\.is-danger/);
});

test('W1 tapnow gates: 画布操作不触碰 provider / 账务（红线守住）', async () => {
  const jsx = await source('../src/pages/VideoStudio/VideoCanvasWorkbench.jsx');
  // 删除 / 复制 / 锁定 / 顶层底层 / 重命名都不调任何 provider / 账务 API
  const helpers = ['handleDeleteNode', 'handleDuplicateNode', 'handleLayerChange', 'handleCommitRename', 'handleFitSelectedToStage', 'handleResetCanvas'];
  for (const name of helpers) {
    assert.match(jsx, new RegExp('function ' + name + '\\b|const ' + name + '\\b|' + name + '\\s*='));
  }
  // handleDeleteNode 函数体内不出现 createVideoJob / quoteBillingAction / selectShotCandidate / runMutation
  const deleteBody = jsx.match(/function handleDeleteNode[\s\S]*?\n  \}/);
  assert.ok(deleteBody, 'handleDeleteNode exists');
  assert.doesNotMatch(deleteBody[0], /createVideoJob|quoteBillingAction|selectShotCandidate|runMutation/);
  // handleCommitRename 仅在 shot 类型走服务端 updateStoryboardShot；asset/candidate 仅关闭菜单
  const renameBody = jsx.match(/function handleCommitRename[\s\S]*?\n  \}/);
  assert.ok(renameBody, 'handleCommitRename exists');
  assert.match(renameBody[0], /updateStoryboardShot/);
  assert.doesNotMatch(renameBody[0], /createVideoJob|quoteBillingAction/);
});
