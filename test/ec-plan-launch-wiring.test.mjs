// test/ec-plan-launch-wiring.test.mjs
// P7 接线契约 (source-slice): 首页发射器 → 画布物化 → 方案节点三个动作。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ecMode = () => readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
const canvas = () => readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const studio = () => readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');

test('首页「下一步」发射到画布: SET_CREATION_LAUNCH(ec-plan-launch) + NAVIGATE; 快速通道传 quick=true', () => {
  const source = ecMode();
  assert.match(source, /dispatch\(\{ type: 'SET_CREATION_LAUNCH', launch: \{ kind: 'ec-plan-launch', quick: quick === true/);
  assert.match(source, /dispatch\(\{ type: 'NAVIGATE', page: 'ec-canvas' \}\)/);
  /* 9-11 三轮: 一个「下一步」+ 二选一浮层, quick 通道仍是 handleNext(true) */
  assert.match(source, /setModeChooserOpen\(false\); handleNext\(true\); \}\}/, '快速生成项 = quick 通道');
  assert.match(source, /setModeChooserOpen\(false\); handleNext\(false\); \}\}/, '带设计方案项 = 方案发射');
  // 旧整页保留可读 (不变式②): ecStep=2 的 DesignDirection 挂载仍在 Home/index.jsx
});

test('画布物化: 挂载 effect 消费 launch payload, 物化即置空防重铺', () => {
  const source = canvas();
  assert.match(source, /if \(!isPlanLaunch\(launch\)\) return/);
  assert.match(source, /createPlanLaunchGraph\(\{ launch, now: Date\.now\(\) \}\)/);
  assert.match(source, /graph\.nodes\.map\(normalizeCanvasNode\)/);
  assert.match(source, /dispatch\(\{ type: 'SET_CREATION_LAUNCH', launch: null \}\)/, '物化后消费 launch, 防重渲染重复铺开');
});

test('方案节点三动作: 生成/刷新先报价 (不变式①), 刷新走 refresh 计费 SKU', () => {
  const source = canvas();
  assert.match(source, /quoteBillingAction\(\{ sku: 'ec_direction_analysis', quantity: 1 \}\)/, '生成方案先报价');
  assert.match(source, /quoteBillingAction\(\{ sku: 'ec_direction_refresh', quantity: 1 \}\)/, '刷新方案先报价');
  assert.match(source, /getDesignDirections\(\{ \.*\.\.\.directionNodeRequestParams\(node\), billingQuoteId: quote\.quoteId/);
  assert.match(source, /createChildConnection\(node\.id, suite\.id, 'design-plan'\)/, '应用到画布 = 方案→套图生成器连线');
});

test('设计方案节点组件: 未生成给「生成方案」, 已生成给「换一套 + 应用到画布」', () => {
  const source = studio();
  assert.match(source, /export function CanvasDirectionNode/);
  assert.match(source, /生成方案 · 1 积分/);
  assert.match(source, /换一套 · 1 积分/);
  assert.match(source, /应用到画布/);
});
