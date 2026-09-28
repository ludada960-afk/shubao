// test/canvas-generation-config-0929.test.mjs
// 2026-09-28 批 CY-⑬。用户在画布标注里点了两件事，本文件把两件事都钉成契约：
//
//   ① 「你这个阶段应该得是比如说你现在其他的按钮，它后面不是有一个**箭头的符号吗**？
//       那你这里为什么没有符号呢？还有就是你为什么这个按钮做的**这么的小**呢？
//       它不是**模型选择按钮**吗？**模型选择按钮不应该这么小呀**。」
//   ② 「然后你这几块按钮**明明可以合成一块按钮**啊。什么尺寸，清晰度，数量
//       这些都是可以放在同一个**生成配置**里面去呀。」
//
// 并且 ① 的元要求是全局的：「我觉得你应该**全局都要去查看一下**，肯定有很多这种生成面板，
// 他们的配置这里都是存在同等问题的。你要**全部去考虑明白，然后全部去重新规划，重新设计**。」
//   ⇒ 四个生成框（图片 / 文案 / 视频 / 电商套图）都在本文件的检查范围内，
//     少改一个框，本测试就红。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SLOT_WIDTH, canvasSlotCssVars } from '../src/pages/EcCanvas/canvasVisualLanguage.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const canvasCss = read('src/pages/EcCanvas/EcCanvas.css');
const canvasStudio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
const canvasPage = read('src/pages/EcCanvas/index.jsx');

/* 取一个组件的源码片段（从 function 起到下一个顶层 `function ` / `export function ` 之前） */
function componentBody(name) {
  const start = canvasStudio.indexOf(`function ${name}(`);
  if (start < 0) return '';
  const rest = canvasStudio.slice(start + 1);
  const next = rest.slice(1).search(/\n(function |export function )/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}

/* 去掉块注释与 { /* JSX 注释 *\/ }。
   必要：CY-⑬ 的源码里到处都写着「改前这一行是 4 个原生 `<select>`」，
   不剥注释就会把**说明**当成**代码**来断言（第一版就是这么误报的）。 */
const stripComments = src => src.replace(/\/\*[\s\S]*?\*\//g, '');

/* 取函数**自己的**花括号体（不是"从它开始到文件末尾"）——
   少了这一步，后面那个函数会把它底下所有别的组件都算成自己的代码，
   判据就变成了"文件里后面出现过就算"。 */
function functionBody(code, name) {
  const at = code.indexOf(`function ${name}(`);
  if (at < 0) return '';
  let i = code.indexOf('{', at);
  if (i < 0) return '';
  let depth = 0;
  for (; i < code.length; i += 1) {
    if (code[i] === '{') depth += 1;
    else if (code[i] === '}') { depth -= 1; if (depth === 0) return code.slice(code.indexOf('{', at), i + 1); }
  }
  return '';
}

/* 取一个 JSX 片段：从标记起向后 n 行 */

/* ═══ ① 形制：三颗参数小药丸收成「模型 + 生成配置」两颗两行摘要触发器 ═══════════════════════════ */

test('图片 / 文案框：三颗参数小药丸已消失，只剩模型 + 生成配置两颗触发器', () => {
  const body = componentBody('CanvasParameterControls');
  assert.ok(body, '必须找得到 CanvasParameterControls');
  /* 改造前这一行是 5 颗 27px 高的单行药丸：生图模型 / 图片比例 / 清晰度 / 生成数量 / 技能。
     比例、清晰度、数量三颗**已经不在触发行里**了，它们搬进了「生成配置」面板。 */
  for (const gone of ['aria-label="图片比例"', 'aria-label="清晰度"', 'aria-label="生成数量"']) {
    assert.ok(!body.includes(gone), `触发行里不该再有独立小药丸 ${gone}（用户：这些「可以放在同一个生成配置里面去」）`);
  }
  assert.equal((body.match(/CanvasConfigTrigger/g) || []).length, 2,
    '触发行里正好两颗触发器：模型 + 生成配置（技能那颗是 CanvasSkillControl，不算）');
});

test('视频框：4 个原生 <select> 已全部退役', () => {
  const body = componentBody('CanvasVideoComposer');
  assert.ok(body, '必须找得到 CanvasVideoComposer');
  /* 用户点名的是「按钮做得太小 / 没有箭头」，但根因是这一行当时是**系统控件**：
     22px 高、没有站内箭头、hover/展开都不跟站内一致。 */
  assert.ok(!/<select[\s>]/.test(stripComments(body)), '视频框里不许再出现原生 <select>（22px 高、无箭头、系统外观）');
  assert.equal((body.match(/CanvasConfigTrigger/g) || []).length, 2,
    '视频框也是两颗：视频模型 + 生成配置（清晰度 · 画幅 · 时长）');
  /* 原生 select 免费给的「点外面收起」，换成 portal 弹层后必须自己补上 */
  assert.ok(/videoControlsRef/.test(body) && /addEventListener\('pointerdown', close\)/.test(body),
    '视频框必须自己实现点外面收起（原生 select 换掉后这份行为会丢）');
});

test('电商套图框：单行「GPT Image 2·2K」改成两行「生成配置」', () => {
  const body = componentBody('CanvasSuiteSettingsControl');
  assert.ok(body, '必须找得到 CanvasSuiteSettingsControl');
  assert.ok(/<CanvasConfigTrigger/.test(body), '套图框的「生成设置」必须走同一套两行摘要触发器');
  assert.ok(/title="生成配置"/.test(body), '小标题写「生成配置」，与另外三个框同名');
  /* 面板内容一字未动（仍是 GenSettingsPanel：模型 · 清晰度 · 品牌色 · 负面提示词） */
  assert.ok(/<GenSettingsPanel/.test(body), '面板内容保持 GenSettingsPanel，不许在并块时顺手改契约');
});

test('套图方案 / SKU变体 也换成两行触发器（同一行里 27px 药丸不能和 40px 触发器混排）', () => {
  const body = componentBody('CanvasSuiteControls');
  assert.ok(body, '必须找得到 CanvasSuiteControls');
  /* 原来这一行是：智能套图 71 / SKU变体 71 / 技能 71 / 生成设置 90（画布 0.68 缩放下的实测值），
     前三颗是 27px 单行药丸、最后一颗是单行「GPT Image 2·2K」。改后整行统一成两行摘要。 */
  assert.ok(/surface=\{`suite-\$\{item\.key\}`\}/.test(body), '套图方案 / SKU变体 必须走同一套触发器');
  assert.ok(/title=\{item\.label\}/.test(body), '小标题取该项的正式名（套图方案 / SKU变体）');
  /* 「已调整」角标折进值里，信息不能丢 */
  assert.ok(/已调整/.test(body), '「已调整」状态必须仍然可见（折进触发器的值里）');
  assert.ok(!/is-adjusted/.test(stripComments(body)), '旧的角标 class 写法必须整条拿掉，不许两套并存');
});

/* ═══ ② 形制细节：用户逐字点名的「箭头」和「不能太小」 ═══════════════════════════════════════ */

test('触发器自带下拉箭头（用户：「它后面不是有一个箭头的符号吗？那你这里为什么没有符号呢？」）', () => {
  const body = componentBody('CanvasConfigTrigger');
  assert.ok(/className="ec-canvas-config-trigger-chevron"/.test(body), '触发器必须渲染那颗下拉箭头');
  /* CY-⑫ 的老毛病就是模型槽把**箭头一起裁掉**了（槽位 75px，值先被裁、箭头跟着没）。
     现在箭头用 margin-left:auto 顶到右缘 + flex:0 0 auto，谁都不许把它裁掉。 */
  const css = canvasCss.match(/\.ec-canvas-config-trigger-chevron \{[^}]*\}/)?.[0] || '';
  assert.ok(/flex:\s*0 0 auto/.test(css), '箭头必须固定宽度，不参与文字的收缩');
  assert.ok(/margin-left:\s*auto/.test(css), '箭头必须顶到右缘（不能跟在文字后面被一起推走）');
  assert.ok(/\.ec-canvas-config-trigger\.is-open \.ec-canvas-config-trigger-chevron \{[^}]*rotate\(180deg\)/.test(canvasCss),
    '展开时箭头旋转 180°（首页那一档，用户 2026-07-27 批 BJ 定的）');
});

test('触发器是两行摘要：小标题 + 当前值（照首页已拍板形态）', () => {
  const body = componentBody('CanvasConfigTrigger');
  assert.ok(/<small>\{title\}<\/small>/.test(body), '第一行是小标题');
  assert.ok(/<strong>\{value\}<\/strong>/.test(body), '第二行是当前值');
  const css = canvasCss.match(/\.ec-canvas-config-trigger \{[^}]*\}/)?.[0] || '';
  assert.ok(/height:\s*40px/.test(css), '触发器高度固定 40px（首页 52px，画布一行只放得下 434px）');
  /* 2026-09-17 用户逐字定过：「真的不要用省略号」「显示不全也没关系，但是真的不要用省略号」。
     这一条对**新**组件同样成立 —— 首页那颗写了 ellipsis，画布这边不许跟。 */
  const triggerBlock = canvasCss.slice(canvasCss.indexOf('.ec-canvas-config-trigger {'), canvasCss.indexOf('.ec-canvas-config-popover'));
  assert.ok(!/text-overflow:\s*ellipsis/.test(stripComments(triggerBlock)),
    '画布触发器里一个字都不能出现省略号（用户 2026-09-17 定过）');
});

test('模型槽不再是 75px 小按钮（用户：「模型选择按钮不应该这么小呀」）', () => {
  assert.equal(SLOT_WIDTH.model, 132, '模型槽固定 132px（CY-⑫ 已从 75 提到 132）');
  const vars = canvasSlotCssVars();
  assert.equal(vars['--cvl-slot-model'], '132px');
  /* 槽位由**语义标记**决定，不由「在第几位」决定 —— CY-⑫ 之前是 aria-label，
     CY-⑬ 把三颗小药丸删掉之后那条表已经匹配不到元素了。 */
  assert.ok(/\.ec-canvas-parameter-controls > \.ec-canvas-parameter-item:has\(> \[data-canvas-config-trigger="model"\]\)/.test(canvasCss),
    '图片/文案框的模型槽必须按 data-canvas-config-trigger 定宽');
  assert.ok(/\.ec-canvas-parameter-controls > \.ec-canvas-parameter-item:has\(> \[data-canvas-config-trigger="config"\]\)/.test(canvasCss),
    '「生成配置」槽必须按 data-canvas-config-trigger 定宽');
});

test('「生成配置」槽一次给足三颗小药丸合并后的宽度（不让摘要被裁）', () => {
  /* 合并前：比例 88 + 清晰度 64 + 数量 64 + 2×8 间距 = 232px 三个槽位。
     合并后是一颗触发器，槽位不能还按 64 算 —— 否则「2K · 1:1 · x4」会被裁，
     那等于把三颗小药丸的毛病原样搬到一颗大按钮上。 */
  assert.ok(SLOT_WIDTH.config >= 128, `生成配置槽至少 128px，实际 ${SLOT_WIDTH.config}`);
  const total = SLOT_WIDTH.mention + SLOT_WIDTH.model + SLOT_WIDTH.config + SLOT_WIDTH.label + 3 * 8;
  assert.ok(total <= 434,
    `改后图片框底栏合计 ${total}px 必须放得进 434px 的行内容盒（超了最右的「技能」会被裁掉）`);
});

/* ═══ ③ 面板：三项必须真的在同一块里 ═══════════════════════════════════════════════════════ */

test('「生成配置」面板里同时有分辨率 / 画面尺寸 / 生成数量三组', () => {
  const body = componentBody('CanvasImageConfigPanel');
  assert.ok(body, '必须找得到 CanvasImageConfigPanel');
  for (const group of ['<CanvasConfigGroup title="分辨率">', '<CanvasConfigGroup title="画面尺寸">', '<CanvasConfigGroup title="生成数量">']) {
    assert.ok(body.includes(group), `面板里必须有 ${group}`);
  }
  /* 清晰度仍按**当前模型支持的档位**过滤（切换到不支持 4K 的模型会落到它的最高档） */
  assert.ok(/imageModelResolutions\(imageModel\)\.includes\(value\)/.test(body),
    '分辨率必须随模型夹取，不能给用户选了会被上游拒收的档位');
  /* 文案框不传数量（includeCount=false → countOptions=[]），那一组整组不渲染，
     摘要相应只有两项 —— 两边必须一致，不能出现"面板里有数量但摘要不写"的错位。 */
  assert.ok(/countOptions\.length > 1 && <CanvasConfigGroup title="生成数量">/.test(body),
    '数量组必须随 countOptions 一起收放，不能在文案框里也显示');
});

test('三个参数值都体现在触发器的摘要上（合并不能丢信息）', () => {
  assert.ok(/const configSummary = includeCount \? `\$\{resolution\} · \$\{ratio\} · x\$\{count\}` : `\$\{resolution\} · \$\{ratio\}`;/.test(canvasStudio),
    '摘要必须把 分辨率 · 画面尺寸 · 生成数量 三项都写出来，否则合并之后用户看不出当前配置');
  /* 文案框不显示数量（includeCount=false），那摘要就是两项 —— 两个框都要覆盖到 */
  assert.ok(/<CanvasConfigTrigger\s+surface="model"/.test(canvasStudio), '模型触发器必须带 surface 标记');
  assert.ok(/<CanvasConfigTrigger\s+surface="config"/.test(canvasStudio), '生成配置触发器必须带 surface 标记');
});

/* ═══ ④ P0 回归：onOpenWorkbench 未解构 = 整个文案生成框渲染即崩 ═════════════════════════════ */

test('P0 回归：任何用到 onOpenWorkbench 的组件，签名里必须解构它（CY-⑨ 漏了，已上线崩过一次）', () => {
  /* 事故原文（CY-⑬ 探针实测线上抓到的）：
       PAGEERR ReferenceError: onOpenWorkbench is not defined
     成因：CY-⑨ 在组件体里加了 `onOpenWorkbench={onOpenWorkbench}`，却没在签名里解构。
     后果不是"按钮不工作"，而是**整个组件渲染即抛** —— 从左侧「+」建出文案节点直接白屏，
     而且因为异常发生在 add 菜单的渲染里，那个菜单随后**整块失灵**，图片/视频也建不出来。

     判据写成"用了就必须在签名里解构"，而不是白名单组件列表：
     白名单只挡住这一次，判据挡住**下一次**任何一个新组件踩同一个坑。 */
  const code = stripComments(canvasStudio);
  const components = [...code.matchAll(/(?:export )?function (\w+)\(([^)]*)\)\s*\{/g)];
  assert.ok(components.length > 20, '组件扫描本身要能跑通（防止正则悄悄失配变成"零违规即通过"）');
  let checked = 0;
  for (const [, name, signature] of components) {
    if (!/\bonOpenWorkbench\b/.test(functionBody(code, name))) continue;
    checked += 1;
    assert.ok(/onOpenWorkbench\s*=\s*null/.test(signature),
      `${name} 用到了 onOpenWorkbench，签名里必须解构（默认值 null = 解析不出子页面坐标就不给入口）`);
  }
  assert.ok(checked >= 4, `实际检查到的组件数 ${checked} 偏少，正则可能失配`);
  /* 这次修的正是文案生成框；有技能的节点要真的能拿到这个入口，
     否则修了签名也只是让按钮永远不出现。 */
  const textAt = canvasStudio.indexOf('function CanvasTextGenerationComposer(');
  assert.ok(/onOpenWorkbench\s*=\s*null/.test(canvasStudio.slice(textAt, canvasStudio.indexOf(') {', textAt))),
    'CanvasTextGenerationComposer 的签名必须补上 onOpenWorkbench = null（本次修复点）');
  assert.ok(/onOpenWorkbench=\{selectedWorkbenchOpen\}/.test(canvasPage),
    'index.jsx 必须把 selectedWorkbenchOpen 接给文案生成框（与另外几个框同一口径）');
});

/* ═══ ⑤ 全局性：这一批不许只改画布一个框 ════════════════════════════════════════════════════ */

test('全局性：四个生成框都换成了同一套触发器，没有一个是漏网的', () => {
  const triggers = (canvasStudio.match(/data-canvas-config-trigger=\{surface \|\| ''\}/g) || []).length;
  assert.equal(triggers, 1, '触发器只有一个实现（CanvasConfigTrigger），四个框共用它');
  /* 每个 surface 各出现一次，缺一个就说明那一格没换 */
  for (const surface of ['"model"', '"config"', '"video-model"', '"video-config"', '"suite-settings"', '"skill"']) {
    assert.ok(canvasStudio.includes(`surface=${surface}`), `缺少 surface=${surface}（有一格没换）`);
  }
  assert.ok(canvasStudio.includes('surface={`suite-${item.key}`}'), '套图方案 / SKU变体 两格也必须换成触发器');
});

test('技能也换成两行触发器（否则 27px 小药丸夹在两颗 40px 中间，整行基线会歪）', () => {
  const body = componentBody('CanvasSkillControl');
  assert.ok(/<CanvasConfigTrigger/.test(body), '技能格必须走同一套两行摘要触发器');
  assert.ok(/title="技能"/.test(body), '小标题写「技能」');
  /* 2026-09-17 用户在视频面板批注过这一条：
       「技能按钮没有和其它四项同一套结构，于是它歪上去了、高低也和别人对不齐」
     当时只把**结构**（<label> 两行）对齐，形制还是单行药丸；这一批把形制也换掉。 */
  assert.ok(!/\{activeLabel\}<WandSparkles/.test(body), '旧的单行写法必须整条拿掉，不许两套并存');
  /* 未选技能时不能拿「技能」二字当值 —— 标题和值一模一样，看着像没填 */
  assert.ok(/\|\| '未选择'/.test(body), '未选技能时值应显示「未选择」');
});
