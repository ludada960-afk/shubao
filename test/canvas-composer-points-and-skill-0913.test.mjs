// test/canvas-composer-points-and-skill-0913.test.mjs
// 2026-09-13 用户批注（画布四个生成框）：
//  ① 四个框的生成按钮要和首页/小红书图文一样，并且**按钮里显示随配置实时变化的动态积分**
//     （原来视频框写死「62 AI 积分」、套图框不显示积分）；
//  ② 四个框共用同一个「技能」入口（最后一项进技能管理弹窗）；
//  ③ 视频框也要有 @ 引用键；
//  ④ 从节点「+」打开的生成面板要居中吸附在按钮正上方。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
const css = read('src/pages/EcCanvas/EcCanvas.css');

function composerBody(name) {
  const start = studio.indexOf('export function ' + name + '(');
  assert.ok(start > 0, '缺少组件 ' + name);
  const rest = studio.slice(start + 1);
  const end = rest.indexOf('\nexport function ');
  return rest.slice(0, end > 0 ? end : 12000);
}

/* ═══ 2026-09-18 口径更新（(b) 规范被取代）═══════════════════════════════════
   原断言标题要求「共用同一枚**渐变** CTA」。该口径已被品牌决策推翻：
     · docs/design/01-brand-decision.md:75 ——
       「品牌渐变（--sb-brand-gradient / -gradient-3）**只用于品牌时刻，禁止用于功能按钮**」；
     · docs/design/40-decisions.md · D1 —— 主色 = 品牌紫（不是近黑），交互主色为 --sb-brand-600；
       D1 补充裁定：品牌红只用于「品牌时刻」，交互仍用品牌紫。
   → 功能 CTA 应为一枚**纯色品牌紫**，不再要求渐变。**不把 CTA 改回渐变来迁就旧断言。**
   说明：现 .shubao-gen-cta 的 background 写作
     linear-gradient(135deg, var(--sb-brand-600) 0%, var(--sb-brand-600) 100%)
   两端同色 —— 视觉上等价于纯色品牌紫；本测试断言**渲染等价于纯色**（两端同色，
   且颜色取自 --sb-brand-*），这样既守住「不许渐变」的口径，也不强制改掉这行写法。 */
test('四个生成框共用同一枚 CTA（纯色品牌紫）+ 按钮内动态显示积分', () => {
  for (const name of ['CanvasImageComposer', 'CanvasTextGenerationComposer', 'CanvasVideoComposer', 'CanvasEcommerceComposer']) {
    const body = composerBody(name);
    assert.ok(body.includes('shubao-gen-cta ec-canvas-composer-cta'), name + ' 的生成按钮未统一为首页同款 CTA');
    assert.ok(body.includes('shubao-gen-cta-points'), name + ' 的生成按钮未显示动态积分');
    assert.ok(/estimate|suitePoints/.test(body), name + ' 未接动态积分口径');
  }
  // 写死的积分文案必须清干净（用户明确：积分要跟着配置动）
  assert.ok(!studio.includes('62 AI 积分'), '视频框不应再写死 62 AI 积分');
  assert.ok(!/\d+ AI 积分 \/ 次 · 确认方案后扣费/.test(studio), '不应再有写死的每次积分');
  assert.ok(css.includes('.ec-canvas-composer-cta'), 'CTA 需要画布侧样式，避免被画布基础按钮规则覆盖');
});

/* 新增：把「功能按钮不得用品牌渐变」这条决策钉进画布 CTA 契约。
   依据 docs/design/01-brand-decision.md:75 + 40-decisions.md D1。 */
test('画布 CTA 不得使用品牌渐变（多色渐变），渲染须等价于纯色品牌紫', () => {
  const cta = read('src/styles/generate-cta.css');
  const block = cta.slice(cta.indexOf('.shubao-gen-cta {'), cta.indexOf('.shubao-gen-cta:hover'));
  assert.ok(block, '必须能找到 .shubao-gen-cta 主规则');
  /* 禁止引用品牌渐变 token（那是「品牌时刻」专用） */
  assert.doesNotMatch(block, /--sb-brand-gradient(-3)?/, 'CTA 不得引用 --sb-brand-gradient / -gradient-3（品牌时刻专用）');
  const bg = block.match(/background:\s*([^;]+);/);
  assert.ok(bg, 'CTA 必须有 background 声明');
  const value = bg[1].trim();
  if (value.includes('linear-gradient')) {
    /* 允许保留渐变语法，但**两端必须同色**（= 视觉纯色），且取自品牌 token */
    const stops = value.match(/var\(--sb-brand-[a-z0-9-]+\)/g) || [];
    assert.ok(stops.length >= 2, '若用渐变语法，两端颜色必须显式写出（便于校验同色）');
    assert.equal(new Set(stops).size, 1,
      '渐变两端必须同色（否则就是「多色渐变」，违反「功能按钮禁止品牌渐变」）：实际 ' + JSON.stringify([...new Set(stops)]));
  } else {
    /* 纯色写法：必须是品牌紫 token */
    assert.match(value, /var\(--sb-brand-/, '纯色 CTA 必须取自品牌紫 token');
  }
});

test('四个生成框共用同一个技能入口组件', () => {
  assert.ok(studio.includes('function CanvasSkillControl('), '技能入口必须抽成同一个组件');
  assert.ok(studio.includes('onOpenSkillLibrary(domain)'), '技能入口最后一项要进技能管理弹窗');
  /* 图片框与文案框共用 CanvasParameterControls（那里挂一次技能入口），视频框、套图框各挂一次。 */
  const usages = studio.match(/<CanvasSkillControl/g) || [];
  assert.ok(usages.length >= 3, '图片+文案 / 视频 / 套图都要用同一个技能入口，现在只有 ' + usages.length + ' 处');
  assert.ok(composerBody('CanvasImageComposer').includes('<CanvasParameterControls'), '图片框要带上技能入口');
  assert.ok(composerBody('CanvasTextGenerationComposer').includes('<CanvasParameterControls'), '文案框要带上技能入口');
  assert.ok(!studio.includes('<label>技能<select'), '视频框不应再用下拉框另做一套技能入口');
});

test('视频框补上 @ 引用键（四个框对等）', () => {
  const body = composerBody('CanvasVideoComposer');
  /* 9-16 用户批注（图4/图5）：四个框的输入框都要「右下角可拖拽调高 + 有上限 + 超限滚动」，
     统一换成 CanvasPromptField（内部仍渲染 MentionPromptField，@ 能力不变）。 */
  assert.ok(body.includes('<CanvasPromptField'), '视频框缺少可拉伸的 @ 引用输入框');
  assert.ok(body.includes('<ComposerMention'), '视频框底栏缺少 @ 按钮');
  assert.ok(body.includes('insertMention'), '@ 选完要能插进输入框');
  const canvasIndex = read('src/pages/EcCanvas/index.jsx');
  assert.ok(canvasIndex.includes('mentionSources={selectedComposerMentions}'), '画布要把 @ 候选素材传给视频框');
});

/* 2026-09-20 口径变更（用户原话：「面板依然是歪到左边去，然后依然是盖住了我们现在的素材」）：
   旧的「水平居中于触发按钮正上方」被**实测证明不可行** ——
   派生面板宽 329px > 源节点宽 163px，「居中」必然让面板左半盖回节点自身；
   叠加右侧面板打开时的世界/像素坐标混用，实测面板被甩到屏幕 x=10（触发按钮在 683）。
   新口径（用户确认，见 test/canvas-popover-anchor-authority-0920.test.mjs）：
     · 锚在触发元素上**向右展开**；右侧放不下**向下**，**绝不向左翻**；与源节点零相交。
   本用例随之改为断言**新口径**（不绑定旧的字面量写法）。 */
test('从节点「+」打开的生成面板锚在按钮右侧展开（2026-09-20 口径）', () => {
  const canvasIndex = read('src/pages/EcCanvas/index.jsx');
  assert.ok(studio.includes('place="right"'), '派生菜单必须声明向右展开');
  assert.ok(studio.includes('CanvasPopoverPortal'), '必须走统一权威（portal + 视口定位）');
  assert.ok(canvasIndex.includes('anchorRect={connectionPicker.anchorRect}'), '画布必须传触发元素的视口矩形');
  /* 权威侧必须有「右展开 + 视口下界回夹」两条实现（算法单一真源在 canvasVisualLanguage） */
  assert.ok(studio.includes("if (place === 'right')"), '权威必须实现 right 分支');
  assert.ok(studio.includes('resolveAnchoredRight('), '右展开算法必须复用共用规则（不得各写一套）');
  const vlang = read('src/pages/EcCanvas/canvasVisualLanguage.js');
  assert.ok(vlang.includes('anchor.right'), '共用规则左缘必须取锚点右缘（右展开）');
  /* 反向断言：不许再走世界坐标版本（那正是甩到左边的根因） */
  const callSite = canvasIndex.slice(canvasIndex.indexOf('<CanvasDeriveMenu'), canvasIndex.indexOf('<CanvasDeriveMenu') + 600);
  assert.ok(!callSite.includes('clampCanvasPickerPosition('), '派生菜单不得再自算世界坐标');
});
