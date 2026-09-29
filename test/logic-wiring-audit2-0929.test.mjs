// test/logic-wiring-audit2-0929.test.mjs
// 2026-09-29 批 CY-⑯。CY-⑮ 的审计还有一批没动，这一批收掉其中「用户能看见/能被静默改写」的那几条。
//
// ⚠️ 本文件最重要的内容其实是**两条"核过之后决定不修"**：
//   审计把 `onDeriveSelect` 列为 P0、把视频「生成同期声音」列为 P0，
//   查下来**两个都是用户自己的决定**（9-05「生成类入口只在素材右侧 + 里」、9-16「撤下这个开关」）。
//   门禁把这两条钉住，是为了让下一个人**别再"修"它们**。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SUITE_PLATFORMS, SUITE_DEFAULT_PLATFORM, SUITE_PLATFORM_LABELS, normalizeSuitePlatform, buildSuiteRun } from '../src/skills/skillRun.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const code = p => strip(read(p));

/* ═══ ① 平台不许被静默改写成别的平台（钱：按 A 收、活按 B 干）══════════════════════════════════════
   事故：EcStudio 给的是 ['淘宝','京东','拼多多','小红书电商','抖音电商','亚马逊']，
   而 buildSuiteRun 用的是 `SUITE_PLATFORMS.includes(x) ? x : 默认`，
   SUITE_PLATFORMS 当时只有 5 个（无后缀、无亚马逊）
   ⇒ 用户选「亚马逊」，**界面不报错、不提示，实际跑淘宝规则，照常计费**。 */
test('平台名单是**一份真源**，任何入口传的合法值都不会被改写', () => {
  assert.ok(SUITE_PLATFORMS.includes('亚马逊'),
    '亚马逊已经是两个界面真实在提供的平台，SUITE_PLATFORMS 里必须有它（藏起来不是修复）');
  /* 归一化：同平台别名必须能落到规范名上 */
  assert.equal(normalizeSuitePlatform('小红书电商').value, '小红书');
  assert.equal(normalizeSuitePlatform('抖音电商').value, '抖音');
  assert.equal(normalizeSuitePlatform('天猫').value, '淘宝');
  assert.equal(normalizeSuitePlatform('Amazon').value, '亚马逊');
  /* 规范名原样通过 */
  for (const p of SUITE_PLATFORMS) {
    assert.equal(normalizeSuitePlatform(p).value, p);
    assert.equal(normalizeSuitePlatform(p).matched, true, p + ' 必须被认出来');
  }
  /* 真正认不出来的仍回落默认，但**如实报告没匹配** —— 静默换平台比报错更难发现 */
  const unknown = normalizeSuitePlatform('某个不存在的站位');
  assert.equal(unknown.value, SUITE_DEFAULT_PLATFORM);
  assert.equal(unknown.matched, false, '认不出来必须如实说没匹配上，而不是假装成功');
});

test('buildSuiteRun 发出去的 platform 是用户选的那个（自证：真源之外的值不再被吞）', () => {
  /* EcStudio 现在直接用 SUITE_PLATFORMS 渲染，所以每个可选值都必须原样到达请求 */
  for (const p of SUITE_PLATFORMS) {
    const run = buildSuiteRun({ fields: [] }, { platform: p, productParams: '测试商品' });
    assert.equal(run.platform, p, p + ' 必须原样发出去');
  }
  /* 别名也必须被归一，而不是变成默认平台 */
  assert.equal(buildSuiteRun({ fields: [] }, { platform: '小红书电商', productParams: 'x' }).platform, '小红书');
});

test('界面不再写死自己的平台名单（写死就是那次静默改写的来源）', () => {
  const studio = code('src/pages/EcStudio/index.jsx');
  assert.match(studio, /\{SUITE_PLATFORMS\.map\(/, 'EcStudio 必须直接用那份真源渲染');
  assert.match(studio, /import \{ SUITE_PLATFORMS, SUITE_PLATFORM_LABELS \}/, '展示名与协议值要分开 import');
  /* 显示名只是文案：协议值仍是短名 */
  assert.equal(SUITE_PLATFORM_LABELS['小红书'], '小红书电商', '界面文案保持原样，但值不发这个');
  assert.equal(SUITE_PLATFORM_LABELS['抖音'], '抖音电商');
});

/* ═══ ② 右面板的消耗数字不许永远是 0 ═══════════════════════════════════════════════════════════════
   事实：它读 `node.billingCost ?? node.cost ?? node.estimatedCost`，而全仓**零处写**这三个字段
   ⇒ 结构上恒为 0，界面上却挂着「派生链累计消耗」的名头。 */
test('右面板消耗：真实记账值优先，估算兜底，且**如实标注是估算**', () => {
  const page = code('src/pages/EcCanvas/index.jsx');
  assert.match(page, /estimateNodeCost\(/, '必须用仓库里已有的成本表兜底，不是继续读那三个没人写的字段');
  assert.match(page, /billingCostIsEstimate=\{!chainCost\.exact\}/, '估算与否必须传到面板');
  const panel = code('src/pages/EcCanvas/components/EcCanvasRightPanel.jsx');
  assert.match(panel, /billingCostIsEstimate = false/, '面板必须声明这个 prop');
  assert.match(panel, /派生链预计消耗/, '用估算时必须写「预计」，不能写「消耗」');
  assert.match(panel, /派生链累计消耗/, '有真实记账值时才写「累计消耗」');
});

/* ═══ ③ 右栏**刻意**没有派生菜单 —— 这是用户 9-05 的定稿，别"修" ═══════════════════════════════════
   审计把 `onDeriveSelect`（传了但组件签名里没有 ⇒ 13 行路由被静默丢弃）列为 P0。
   但 EcCanvasRightPanel.jsx:137 的注释写着「生成类入口只在素材右侧 + 里」，空态文案同一口径
   ⇒ 那段是定稿之前的残留，**删掉**才是对的（接上会推翻用户的定稿）。 */
test('右栏没有派生菜单（用户 9-05 定稿），残留的 onDeriveSelect 已删干净', () => {
  const page = code('src/pages/EcCanvas/index.jsx');
  assert.ok(!/onDeriveSelect=/.test(page), 'onDeriveSelect 必须删干净（它从未被接收）');
  /* 而同样的路由逻辑必须仍然活着（在节点右侧 + 的派生菜单里）*/
  assert.match(page, /handleDerivedTextGeneration\(/, '派生路由本身必须在 CanvasDeriveMenu 的 onSelect 里');
  assert.match(page, /\{connectionPicker && <CanvasDeriveMenu/, '节点右侧 + 的派生菜单仍然是活的');
  const panel = read('src/pages/EcCanvas/components/EcCanvasRightPanel.jsx');
  assert.match(panel, /9-05 定稿/, '这条用户决定要留在代码里（否则下一个人又会去"修"它）');
});

/* ═══ ④ 视频「生成同期声音」开关不可达 —— 也是用户 9-16 自己撤掉的 ═══════════════════════════════════
   审计列为 P0「设置无效」。查 TOOLBAR_ITEMS 上方的批注：
     「默认就是视频会生成声音的呀，为什么我们自己要做一个生成声音这样子的东西呢」
   ⇒ 撤下是用户决定，activePanel === 'sound' 只是随之失效的死分支。**不要接回去。** */
test('视频面板不提供「生成同期声音」开关（用户 9-16 亲自撤下），别接回去', () => {
  const video = read('src/pages/VideoStudio/index.jsx');
  const toolbar = video.slice(video.indexOf('const TOOLBAR_ITEMS'), video.indexOf('const VIDEO_MODE_ICONS'));
  assert.ok(!/key:\s*'sound'/.test(toolbar),
    '工具栏里不许有 sound 项（用户 9-16 明确要求撤下这个开关）');
  assert.match(video, /默认就是视频会生成声音的呀/,
    '用户当时为什么撤下这句话要留在代码里（否则下一个人会以为是漏做）');
});
