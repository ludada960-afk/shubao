// test/ec-plan-launch-wiring.test.mjs
// P7 接线契约 (source-slice): 首页发射器 → 画布物化 → 方案节点三个动作。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ecMode = () => readFileSync(new URL('../src/pages/Home/EcMode.jsx', import.meta.url), 'utf8');
const canvas = () => readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
const studio = () => readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');

test('首页「下一步」发射到画布: SET_CREATION_LAUNCH(ec-plan-launch) + NAVIGATE, 恒带设计方案 (quick=false)', () => {
  const source = ecMode();
  /* 9-14 用户决策: 电商生图 + 万物上身统一默认带设计方案, 不再二选一。
     quick 仍作为画布消费的契约字段保留, 但首页恒为 false（方案链路）。 */
  assert.match(source, /dispatch\(\{ type: 'SET_CREATION_LAUNCH', launch: \{ kind: 'ec-plan-launch', quick: false/);
  assert.match(source, /dispatch\(\{ type: 'NAVIGATE', page: 'ec-canvas' \}\)/);
  assert.doesNotMatch(source, /quick: quick === true/, '不再由用户选择决定 quick');
  // 旧整页保留可读 (不变式②): ecStep=2 的 DesignDirection 挂载仍在 Home/index.jsx
});

test('首页电商生图与万物上身都不再出现二选一浮层, 默认带方案', () => {
  const source = ecMode();
  const home = readFileSync(new URL('../src/pages/Home/index.jsx', import.meta.url), 'utf8');
  /* 两个入口都经由 EcMode 的同一个「下一步」: 电商生图 = product_suite, 万物上身 = anything_tryon */
  assert.match(source, /abilityRecipeId === 'anything_tryon'/, '万物上身入口在同一组件内');
  assert.doesNotMatch(source, /ec-mode-chooser/, '浮层 JSX 已删');
  assert.doesNotMatch(source, /快速生成/, '无「快速生成」选项文案');
  assert.doesNotMatch(source, /handleNext\(true\)/, '无 quick 快速通道调用');
  /* 「下一步」直接调 handleNext(), 不再先开浮层 */
  assert.match(source, /onClick=\{\(\) => handleNext\(\)\}/, '点击即进方案流程');
  assert.match(home, /<EcMode ecStep=\{ecStep\} setEcStep=\{setEcStep\}/, 'EcMode 仍是首页唯一电商/上身入口');
});

test('画布物化: 由「从草稿/会话重建」同一个效应消费 launch（不再被覆盖），物化即置空防重铺', () => {
  const source = canvas();
  /* 9-12 根治：原来发射在独立效应里，随后运行的重建效应会 setNodes 覆盖它 → 只跳画布、什么都没有 */
  assert.match(source, /const pendingLaunch = state\.creationLaunch;/);
  assert.match(source, /if \(isPlanLaunch\(pendingLaunch\)\) \{/);
  assert.match(source, /applyPlanLaunch\(pendingLaunch\)/);
  assert.match(source, /createPlanLaunchGraph\(\{ launch, now: Date\.now\(\) \}\)/);
  assert.match(source, /graph\.nodes\.map\(normalizeCanvasNode\)/);
  assert.match(source, /dispatch\(\{ type: 'SET_CREATION_LAUNCH', launch: null \}\)/, '物化后消费 launch, 防重渲染重复铺开');
  assert.match(source, /state\.creationLaunch\]\)/, '发射状态必须在依赖数组里');
});

test('方案节点三动作: 生成/刷新先报价 (不变式①), 刷新走 refresh 计费 SKU', () => {
  const source = canvas();
  /* 2026-09-17 修正：原来断言 quoteBillingAction —— 它只返回 { quote }（服务端 publicQuote
     不吐 actionId），于是 billingActionId 是 undefined，服务端判 400 CANVAS_BILLING_REQUEST_INVALID
     （不打桩实测出来的）。现改为 quoteCanvasAction（报价 + 生成 actionId）。
     详见 test/canvas-direction-billing-chain-0917.test.mjs。 */
  assert.match(source, /quoteCanvasAction\('ec_direction_analysis',/, '生成方案先报价（并拿 actionId）');
  assert.match(source, /quoteCanvasAction\('ec_direction_refresh',/, '刷新方案先报价（并拿 actionId）');
  assert.match(source, /getDesignDirections\(\{ \.*\.\.\.directionNodeRequestParams\(node\), billingQuoteId: quoteId, billingActionId: actionId \}\)/);
  assert.match(source, /createChildConnection\(node\.id, suite\.id, 'design-plan'\)/, '应用到画布 = 方案→套图生成器连线');
});

test('设计方案节点组件: 未生成给「生成方案」, 已生成给「换一套 + 应用到画布」', () => {
  const source = studio();
  /* 2026-10-01（批 CY-㊴ 之十八）：节点组件现在以 React.memo 导出（实现改名 *View）。 */
  assert.match(source, /export const CanvasDirectionNode = React\.memo\(/);
  assert.match(source, /生成方案 · 1 积分/);
  assert.match(source, /换一套 · 1 积分/);
  assert.match(source, /应用到画布/);
});
