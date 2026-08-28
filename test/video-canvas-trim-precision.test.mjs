import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const jsxPath = new URL('../src/pages/VideoStudio/VideoCanvasWorkbench.jsx', import.meta.url);
const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('V2 P1 视频时间线 trim 0.1s 精修: 步进按钮组 5 元素 (<< / < / 0.1s / > / >>) 出现在 trim UI 区域', async () => {
  const jsx = await source(jsxPath);
  // 注释解释意图, 防止后续重构丢失 P1 意图
  assert.match(jsx, /V2 P1 视频时间线 trim 0\.1s 精修/, 'should mark P1 trim precision intent in comment');
  // 5 个步进元素必须同时存在于 trim UI 区域
  // 1) 4 个按钮: 入点 -1.0s / 入点 -0.1s / 出点 +0.1s / 出点 +1.0s
  assert.match(jsx, /入点 -1\.0 秒/, 'should label 入点 -1.0 秒 coarse step button');
  assert.match(jsx, /入点 -0\.1 秒/, 'should label 入点 -0.1 秒 fine step button');
  assert.match(jsx, /出点 \+0\.1 秒/, 'should label 出点 +0.1 秒 fine step button');
  assert.match(jsx, /出点 \+1\.0 秒/, 'should label 出点 +1.0 秒 coarse step button');
  // 2) 中间 readout 显示 "0.1s" 步长, 跟 YouTube Studio 微调类似
  assert.match(jsx, /\{TRIM_STEP_FINE\.toFixed\(1\)\}s/, 'should render 0.1s step readout between fine buttons');
  // 3) 4 个按钮全部走 handleStepClipTrim handler
  const stepHandlerHits = jsx.match(/handleStepClipTrim\(clip, '(?:start|end)', [+-]?TRIM_STEP_(?:FINE|COARSE)\)/g) || [];
  assert.equal(stepHandlerHits.length, 4, 'should wire 4 step buttons to handleStepClipTrim (expected 4, got ' + stepHandlerHits.length + ')');
  // 4) 字符显示与设计一致: « ‹ › »
  assert.match(jsx, />«</, 'should render « for 入点 -1.0s');
  assert.match(jsx, />‹</, 'should render ‹ for 入点 -0.1s');
  assert.match(jsx, />›</, 'should render › for 出点 +0.1s');
  assert.match(jsx, />»</, 'should render » for 出点 +1.0s');
});

test('V2 P1 trim 0.1s 精修: 步进常量与步进函数必须存在并符合设计', async () => {
  const jsx = await source(jsxPath);
  // 步长常量: 精修 0.1s / 粗调 1.0s
  assert.match(jsx, /const TRIM_STEP_FINE = 0\.1;/, 'should declare TRIM_STEP_FINE = 0.1');
  assert.match(jsx, /const TRIM_STEP_COARSE = 1\.0;/, 'should declare TRIM_STEP_COARSE = 1.0');
  // 最小间隔 0.2s 与 clampTrimPatch 一致
  assert.match(jsx, /const TRIM_MIN_GAP_SECONDS = 0\.2;/, 'should declare TRIM_MIN_GAP_SECONDS = 0.2 to match clampTrimPatch');
  // 0.1s 步进纯函数, 用 round 10 量化保证 0.1s 精度不漂移
  assert.match(jsx, /function stepClipDraftValue\([\s\S]*?Math\.round\([\s\S]*?\* 10\) \/ 10[\s\S]*?\}/, 'should quantize step result to 0.1s via Math.round(x * 10) / 10');
  // stepClipDraftValue 必须 clamp 入点到 [min, end-0.2] 区间
  const startClampBlock = jsx.match(/if \(field === 'start'\)[\s\S]*?return Math\.max\(minSec, Math\.min\(upper, next\)\);/);
  assert.ok(startClampBlock, 'should clamp start to [min, end-0.2] so 入点 不晚于 出点 - 0.2s');
  // stepClipDraftValue 必须 clamp 出点到 [start+0.2, max] 区间
  const endClampBlock = jsx.match(/if \(field === 'end'\)[\s\S]*?return Math\.max\(lower, Math\.min\(maxSec, next\)\);/);
  assert.ok(endClampBlock, 'should clamp end to [start+0.2, max] so 出点 不早于 入点 + 0.2s');
  // handleStepClipTrim handler 必须存在, 走 setClipDrafts / updateClipDraft
  assert.match(jsx, /function handleStepClipTrim\([\s\S]*?updateClipDraft\(clip, field, nextValue\);[\s\S]*?\}/, 'should call updateClipDraft with stepped value');
});

test('V2 P1 trim 0.1s 精修: 4 个步进按钮不绕过 "应用裁剪" 提交门 (不调 updateTimelineClip)', async () => {
  const jsx = await source(jsxPath);
  // 步进 handler 不直接调服务端, 只更新本地 draft, 让用户点 "应用裁剪" 才提交
  // 这是 YouTube Studio 模式: 微调 = 本地, 提交 = 显式
  const stepFnBlock = jsx.match(/function handleStepClipTrim\([\s\S]*?\n  \}/);
  assert.ok(stepFnBlock, 'should define handleStepClipTrim function');
  assert.doesNotMatch(stepFnBlock[0], /updateTimelineClip\(/, 'handleStepClipTrim must NOT call updateTimelineClip (only handleSaveClipTrim should)');
  assert.doesNotMatch(stepFnBlock[0], /runMutation\(/, 'handleStepClipTrim must NOT trigger runMutation (step is local, save is remote)');
});

test('V2 P1 trim 0.1s 精修: 步进按钮 data-no-drag 与 busy 禁用规则与现有 trim 按钮一致', async () => {
  const jsx = await source(jsxPath);
  // 4 个步进按钮都必须加 data-no-drag 防止拖拽, 与现有 "应用裁剪" 一致
  // 用更精确的匹配: 每个字符 (« ‹ › ») 在它自己的 button 块里, 且 data-no-drag 与 disabled 都在
  for (const glyph of ['«', '‹', '›', '»']) {
    // 抓取最近 200 字符作为按钮定义块
    const idx = jsx.indexOf('>' + glyph + '<');
    assert.ok(idx > 0, 'should find a step button rendering glyph ' + glyph);
    const start = Math.max(0, idx - 240);
    const end = Math.min(jsx.length, idx + 20);
    const block = jsx.slice(start, end);
    assert.match(block, /data-no-drag/, 'glyph ' + glyph + ' step button must carry data-no-drag');
    assert.match(block, /disabled=\{Boolean\(busy\)\}/, 'glyph ' + glyph + ' step button must disable on busy');
  }
});
