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

test('四个生成框共用同一枚渐变 CTA，并在按钮里显示动态积分', () => {
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
  assert.ok(body.includes('<MentionPromptField'), '视频框缺少 @ 引用输入框');
  assert.ok(body.includes('<ComposerMention'), '视频框底栏缺少 @ 按钮');
  assert.ok(body.includes('insertMention'), '@ 选完要能插进输入框');
  const canvasIndex = read('src/pages/EcCanvas/index.jsx');
  assert.ok(canvasIndex.includes('mentionSources={selectedComposerMentions}'), '画布要把 @ 候选素材传给视频框');
});

test('从节点「+」打开的生成面板居中吸附在按钮正上方', () => {
  const model = read('src/pages/EcCanvas/nodeWorkflow.js');
  assert.ok(model.includes("anchor === 'above'"), '缺少 above 锚点分支');
  assert.ok(model.includes("placement: 'above'"), '缺少 above 布局标记');
  const menuCss = read('src/styles/canvas-derive-menu.css');
  assert.ok(menuCss.includes('.ec-canvas-derive-menu.is-above'), '缺少居中吸附样式');
  assert.ok(menuCss.includes('translate(-50%, calc(-100% - 14px))'), '面板要水平居中并贴到按钮上方');
  assert.ok(studio.includes("placement === 'above' ? ' is-above' : ''"), '面板要按布局标记挂 is-above');
  const canvasIndex = read('src/pages/EcCanvas/index.jsx');
  assert.ok(canvasIndex.includes("anchor: 'above'"), '画布要把派生菜单按 above 锚点定位');
  /* 高度是渲染后才知道的：实测放不下要翻到下方，且**仍然水平居中**（宁可换边也不歪） */
  assert.ok(studio.includes("setFlipped(true)"), '面板要按真实渲染高度复测并翻边');
  assert.ok(studio.includes("is-flipped"), '翻边要有样式钩子');
  assert.ok(menuCss.includes('.ec-canvas-derive-menu.is-above.is-flipped'), '翻边样式缺失');
});
