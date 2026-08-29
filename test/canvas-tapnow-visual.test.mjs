import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const cssPath = resolve(repoRoot, 'src/styles/canvas-empty-actions.css');
const ecCanvasCssPath = resolve(repoRoot, 'src/pages/EcCanvas/EcCanvas.css');
const ecCanvasIndexPath = resolve(repoRoot, 'src/pages/EcCanvas/index.jsx');

/* 4c183cd4 续命 P-Canvas 中央弹窗 v4 视觉契约测试 (1 张参考图 + 1 句 prompt, 8 按钮)
   用户 8-29 原话 (硬性):
   - "5 原有 + 3 新增" (3 行分层 8 按钮, 用户硬性指定)
   - "你直接去抄别人的面板是怎么做的呀? 就是进入画布的第一版视觉是怎么做的呀?" (用 TapNow 第一版视觉重做)
   - "我之前不是也一直跟你说, 你这个面板不能搞得这么宽吗?" (改窄)
   - "你为什么要展示这些告诉我的东西呢? ... 用户为什么要知道这个呢?" (不写内部术语)
   - "你下面这几个新添加的功能 ... 我现在点击了都是没有反应的, 任何反应都没有啊" (修智能按钮 bug, 空画布时也能开 composer)

   3 行分层 (资深美工 + 产品经理 + TapNow 调研 3 视角合一):
   - Row 1 添加素材 (3 入口, 5 原有): 上传图片 / 上传视频 / 从我的作品导入 — primary row
   - Row 2 AI 生成 (2 入口, 5 原有): 生成电商套图 / 生成视频 — generate row
   - Row 3 智能 (3 入口, 3 新增): 1-click 套图 / 1-click 视频 / TTS 配音 — smart row */

/* 1) 独立 CSS 资产契约 (2 测试) */

test('canvas-empty-actions.css exists as a standalone asset in src/styles/ (用户硬性要求)', () => {
  assert.ok(existsSync(cssPath), 'src/styles/canvas-empty-actions.css 必须存在 (用户 8-29 硬性要求独立 CSS 资产)');
  const css = readFileSync(cssPath, 'utf8');
  assert.ok(css.length > 1000, 'CSS 文件 > 1KB (含 3 行分层全部规则)');
});

test('canvas-empty-actions.css declares the 3-row layered visual + glass + dark + responsive (4 子契约)', () => {
  const css = readFileSync(cssPath, 'utf8');
  // 3 行分层 CSS
  assert.ok(css.indexOf('.ec-canvas-empty-row.is-primary-row') !== -1, 'Row 1 添加素材 必填 (3 入口)');
  assert.ok(css.indexOf('.ec-canvas-empty-row.is-generate-row') !== -1, 'Row 2 AI 生成 必填 (2 入口)');
  assert.ok(css.indexOf('.ec-canvas-empty-row.is-smart-row') !== -1, 'Row 3 智能 必填 (3 入口)');
  // grid 配置
  assert.match(css, /\.is-primary-row\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,/, 'Row 1 = 桌面 3 列');
  assert.match(css, /\.is-generate-row\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,/, 'Row 2 = 桌面 2 列');
  assert.match(css, /\.is-smart-row\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,/, 'Row 3 = 桌面 3 列');
  // 毛玻璃
  assert.match(css, /backdrop-filter:\s*blur\(8px\) saturate\(140%\)/, '毛玻璃 backdrop-filter 必填');
  // 暗色模式
  assert.match(css, /\[data-theme="dark"\][\s\S]*\.ec-canvas-empty-actions button/, '暗色模式 button 适配必填');
  // 响应式
  assert.match(css, /@media \(max-width: 540px\)/, '移动端响应式断点 540px 必填');
  // 减少动效
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, '减少动效系统设置必填');
});

/* 2) 3 行分层集成契约 (3 测试) */

test('EcCanvas/index.jsx 画布中央弹窗有 3 行分层 (1 添加素材 + 2 AI 生成 + 3 智能) 8 个按钮 (用户 8-29 硬性 5+3=8)', () => {
  const jsx = readFileSync(ecCanvasIndexPath, 'utf8');
  assert.ok(jsx.indexOf('ec-canvas-empty-row is-primary-row') !== -1, 'Row 1 ec-canvas-empty-row is-primary-row 必填');
  assert.ok(jsx.indexOf('ec-canvas-empty-row is-generate-row') !== -1, 'Row 2 ec-canvas-empty-row is-generate-row 必填');
  assert.ok(jsx.indexOf('ec-canvas-empty-row is-smart-row') !== -1, 'Row 3 ec-canvas-empty-row is-smart-row 必填');
  // Row 1 - 3 入口 (5 原有 part 1)
  for (const kind of ['image', 'video', 'works']) {
    assert.ok(jsx.indexOf('HeroGlyph kind="' + kind + '"') !== -1, 'Row 1 HeroGlyph kind=' + kind + ' 必填');
  }
  // Row 2 - 2 入口 (5 原有 part 2)
  assert.ok(jsx.indexOf("addCanvasComposer('suite')") !== -1, 'Row 2 suite composer 必填');
  assert.ok(jsx.indexOf("addCanvasComposer('video')") !== -1, 'Row 2 video composer 必填');
  // Row 3 - 3 入口 (3 新增, 用户 8-29 硬性指定)
  assert.ok(jsx.indexOf("actionId: 'one-click-suite'") !== -1, 'Row 3 one-click-suite 必填');
  assert.ok(jsx.indexOf("actionId: 'one-click-video'") !== -1, 'Row 3 one-click-video 必填');
  assert.ok(jsx.indexOf("actionId: 'tts-voiceover'") !== -1, 'Row 3 tts-voiceover 必填');
  // v4: 字幕动效 已删 (5+3=8 严格 8 按钮)
  assert.equal(jsx.indexOf("actionId: 'caption-motion'"), -1, 'v4 已删 caption-motion (字幕动效), 用户 8-29 硬性 5+3=8');
});

test('中央弹窗 3 智能按钮 走 addCanvasComposer (修 v2 bug: 空画布时按钮无反应)', () => {
  /* 用户 8-29 原话: "你下面这几个新添加的功能, 什么智能分镜套图还有配音这些,
     我现在点击了都是没有反应的, 任何反应都没有啊"
     v2 用 handleCreateDerivedNode (需要 sourceNodeId, 空画布时 src=undefined 静默返回)
     v4 改用 addCanvasComposer (开 prompt 节点, 空画布时也能开)
     v4: 8 按钮 = 5 原有 (5 entry points) + 3 新增 (3 流影AI 风格智能)
     删除 v3 的 caption-motion (字幕动效) 保留 5+3=8 */
  const jsx = readFileSync(ecCanvasIndexPath, 'utf8');
  // 3 智能按钮 必须 addCanvasComposer 形式, 不准 handleCreateDerivedNode
  for (const actionId of ['one-click-suite', 'one-click-video', 'tts-voiceover']) {
    const hasPattern = jsx.indexOf("actionId: '" + actionId + "'") !== -1;
    assert.ok(hasPattern, '智能按钮 ' + actionId + ' 必须有 actionId 路由, 不准 handleCreateDerivedNode');
    // 同时必须 addCanvasComposer 形式
    const beforeActionId = jsx.indexOf("actionId: '" + actionId + "'");
    const sliceBefore = jsx.slice(Math.max(0, beforeActionId - 100), beforeActionId);
    assert.ok(sliceBefore.indexOf('addCanvasComposer') !== -1, '智能按钮 ' + actionId + ' 必须 addCanvasComposer 形式 (空画布时也能开 composer)');
  }
  // 反向断言: 中央 modal 内部 <button onClick={...handleCreateDerivedNode(...)}> 不准出现 (v2 bug)
  // 注释中可提及 (设计说明), 但不准在 onClick 调用
  const centralMarker = '{!nodes.length && (';
  const centralStart = jsx.indexOf(centralMarker);
  if (centralStart !== -1) {
    const heroPanelStart = jsx.indexOf('ec-canvas-empty-state', centralStart);
    const closingPattern = jsx.indexOf('\n          )}\n\n          <div', centralStart);
    if (heroPanelStart !== -1 && closingPattern !== -1) {
      const centralCode = jsx.slice(heroPanelStart, closingPattern);
      // Strip comments first
      const codeNoComments = centralCode.replace(/\/\*[\s\S]*?\*\//g, '');
      // <button onClick={() => handleCreateDerivedNode(...)}> pattern
      const buttonOnClickHCDN = codeNoComments.match(/<button[^>]*onClick=\{[^}]*handleCreateDerivedNode/);
      assert.equal(buttonOnClickHCDN, null, '中央 modal 内部 <button onClick={handleCreateDerivedNode}> 不准出现 (v2 bug: 空画布时静默返回)');
    }
  }
});

test('中央弹窗不写内部术语 (用户 8-29 硬性要求 "你为什么要告诉用户这个呢?")', () => {
  /* 用户 8-29 原话: "你为什么要展示这些告诉我的东西呢? ... 用户为什么要知道这个呢?
     你这些信息是直接在报告里面跟我说就好了呀, 你为什么要在网站上面体现这些东西呢?"
     内部术语: 流影AI / TapNow / Liblib / Quantv — 一律不准出现在 画布中央弹窗 任何
     可见文案 (含 aria-label, strong, p, button text) */
  const jsx = readFileSync(ecCanvasIndexPath, 'utf8');
  // Extract the central modal block (ec-canvas-empty-state)
  const centralMatch = jsx.match(/\{\/\*\s*nodes\.length\s*&&\s*\([\s\S]*?\{\/\*\s*3 行分层/);
  if (!centralMatch) {
    // try alternate match
    const altMatch = jsx.match(/ec-canvas-empty-state[\s\S]*?\)\s*\}/);
    if (altMatch) {
      const centralCode = altMatch[0];
      for (const forbidden of ['流影AI', 'TapNow', 'Liblib', 'LibTV', 'Quantv', '一站搞定']) {
        assert.ok(centralCode.indexOf(forbidden) === -1, '中央 modal 内部不准写内部术语 ' + forbidden);
      }
    } else {
      throw new Error('无法定位中央 modal 块');
    }
  } else {
    const centralCode = centralMatch[0];
    for (const forbidden of ['流影AI', 'TapNow', 'Liblib', 'LibTV', 'Quantv', '一站搞定']) {
      assert.ok(centralCode.indexOf(forbidden) === -1, '中央 modal 内部不准写内部术语 ' + forbidden);
    }
  }
});

/* 3) 窄面板 + 响应式契约 (2 测试) */

test('EcCanvas.css 中央弹窗容器 width < 720px (用户 8-29 硬性要求 "不能搞得这么宽")', () => {
  /* 用户 8-29 原话: "我之前不是也一直跟你说, 你这个面板不能搞得这么宽吗?"
     v1 EcCanvas.css 用 760px, v3 改窄 -> 640px (canvas-empty-actions.css) */
  const css = readFileSync(cssPath, 'utf8');
  assert.match(css, /width:\s*min\(640px/, '中央弹窗容器 640px 必填 (用户 8-29 硬性要求改窄)');
  // 反向断言: EcCanvas.css 不再有 min(760px)
  const ecCss = readFileSync(ecCanvasCssPath, 'utf8');
  assert.doesNotMatch(ecCss, /width:\s*min\(760px/, 'EcCanvas.css 不准保留 760px 旧宽度 (已抽离到独立文件)');
});

test('canvas-empty-actions.css 暗色模式 + 响应式 + 减少动效 媒体查询齐全', () => {
  const css = readFileSync(cssPath, 'utf8');
  // 暗色模式
  const darkMatches = css.match(/\[data-theme="dark"\][\s\S]*?\}/g) || [];
  assert.ok(darkMatches.length >= 4, '暗色模式至少 4 个 block (button / svg 3 种)');
  // 响应式
  assert.match(css, /@media \(max-width: 720px\)/, '平板响应式断点 720px 必填');
  assert.match(css, /@media \(max-width: 540px\)/, '移动响应式断点 540px 必填');
  // 减少动效
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, '减少动效必填');
  // 入场动画 keyframes
  assert.match(css, /@keyframes ecHeroRise/, '入场动画 ecHeroRise 必填');
});
