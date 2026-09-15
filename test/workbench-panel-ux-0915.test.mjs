// test/workbench-panel-ux-0915.test.mjs
// 2026-09-15 用户对电商工作台六个面板的批注 —— 逐条落成契约。
// ─────────────────────────────────────────────────────────────────────────────
// 每条都写明「用户原话 → 根因 → 判据」，避免下一个人只看到断言不知道为什么。
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { stripComments } from '../scripts/lib/token-scope.mjs';
/* ⑱ 是**行为**断言而不是字符串断言：直接把电商方案模型跑起来验算平台→比例。
   该模块在 Node 下可直接 import（只依赖纯数据模块），已实测可行。 */
import { IMAGE_TYPES, defaultRatioFor, migrateLegacySizingImages, resolveSizingImages } from '../src/pages/Home/ec/ecommercePlanModel.js';

/* ⚠️ 一律**先剥注释**再断言（复用 scripts/lib/token-scope.mjs 的同一份实现）。
   本文件第一条契约初版就栽在这上面：解释根因的注释里写了旧写法 `brandLocked && pickerOpen`，
   于是「不得再出现该写法」的断言被自己的注释顶红 —— 与 legacy-token-family、
   nano-model-single-source 是同一条教训：**注释是知识，不是用法**；
   门禁若把注释算进去，就是在惩罚「把来龙去脉写清楚」这件事。 */
const readRaw = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const read = rel => stripComments(readRaw(rel));
const GEN = 'src/pages/Home/ec/GenSettingsPanel.jsx';

test('① 点色块必须能打开取色器（未锁定状态下也要能开）', () => {
  const panel = read(GEN);
  /* 用户原话（图1-②）：「我点击左边这个色盘的这个按钮，我点击之后它是没有弹出那个真正的
     色盘调整的那个部分。他现在好像是卡住的一个状态。」
     根因：色块按钮把 pickerOpen 置 true，但取色器的渲染条件是 `brandLocked && pickerOpen`，
     而默认状态是**未锁定**（原则 6.3）→ 点了什么都不渲染，观感就是「卡住」。
     判据：取色器是否渲染只看 pickerOpen，不得再被 brandLocked 门控。 */
  assert.match(panel, /onClick=\{\(\) => setPickerOpen\(open => !open\)\}/, '色块点击切换 pickerOpen');
  /* ⚠️ 本契约初版这里断言的是 `{pickerOpen && (`（内联渲染）——
     用户随后批注（图6-⑩）「调色盘展开不得被可视区截断」：内联渲染在面板贴底时会被裁掉，
     所以取色器改走 AnchoredPortal。判据随之改为「开关仍然只看 pickerOpen」。 */
  assert.match(panel, /<AnchoredPortal[\s\S]{0,200}open=\{pickerOpen\}/,
    '取色器只由 pickerOpen 决定是否渲染（现在经 AnchoredPortal 的 open 传入）');
  assert.ok(!/brandLocked && pickerOpen/.test(panel),
    '取色器不得再被 brandLocked 门控 —— 否则未锁定时点开无任何反应（这就是用户报的 bug）');
  /* 检测器自证：旧写法必须能被上一条判据抓到。 */
  assert.ok(/brandLocked && pickerOpen/.test('{brandLocked && pickerOpen && ('),
    '自证：旧写法确实能被该判据命中，否则这条断言等于没写');
});
/* ═══ 图2 / 图3：套图方案面板（SizingPanel）═══ */
const SIZING = 'src/pages/Home/ec/SizingPanel.jsx';
const PLAN_MODEL = 'src/pages/Home/ec/ecommercePlanModel.js';

test('② 调「数量 / 尺寸」不得把整行取消选中（事件冒泡）', () => {
  const panel = read(SIZING);
  /* 用户原话（图3-①）：「我现在只要调整它们就会直接被取消选中，你这也是一个 bug。
     我觉得可能是你这个紫框现在是完全盖住了整个的选项，可是实际上这个数量和面板它是可以被
     点击被调整的，这个逻辑你可能没有把它想进去。」
     根因：整行 onClick=toggleType（为了让整行 ≥48px 可点），而行内的数量框/比例选择器
     是**行内部**的可交互元素 —— 事件冒泡到行上，于是「调数量」被当成「点这一行」。
     判据：行内交互区必须截断 click 与 keydown（在数字框里按空格同样会冒泡）。 */
  assert.match(panel, /onClick=\{event => event\.stopPropagation\(\)\}/,
    '行内交互区必须截断 click，否则调数量会被理解成切换选中');
  assert.match(panel, /onKeyDown=\{event => event\.stopPropagation\(\)\}/,
    '键盘事件同样要截断（数字框内按空格/回车会冒泡到行的 onKeyDown）');
  /* 自证：这组判据抓得住「只有整行 onClick」的旧写法。 */
  const legacy = 'onClick={() => toggleType(typeDef.key)}';
  assert.ok(!/stopPropagation/.test(legacy), '自证：旧写法确实不含 stopPropagation');
});

test('③ 图片类型行的间距要够，相邻选中环不得贴成一条', () => {
  const panel = read(SIZING);
  /* 用户原话（图2-①）：「这 5 个类型，它们是边框这些紫色的边框已经完全重叠了。挤在一起了。
     我觉得你可以稍微留一些间距给他们吧。」
     根因：行距 sp1(4px) + 1.5px 边框 + ring 阴影 → 相邻两行都选中时两个环在视觉上相贴。 */
  assert.match(panel, /flexDirection: 'column', gap: SPACING\.sp2/, '行距必须 ≥ sp2(8px)');
  assert.ok(!/flexDirection: 'column', gap: SPACING\.sp1/.test(panel), '不得退回 sp1(4px)');
});

test('④ 面板内不得再重复渲染「当前方案」摘要（与底部按钮同一信息两处渲染）', () => {
  const panel = read(SIZING);
  /* 用户原话（图2-②）：「这个部分我觉得可以不要……因为实际上你这里调整了什么东西，
     下面的那个面板按钮它是会跟着显示跟着调整的。你没有必要在这个地方还写一套这个字，
     在这里是重复的功能。」 */
  assert.ok(!/当前方案：/.test(panel), '面板里不得再出现「当前方案：」摘要（底部按钮已实时显示）');
  assert.ok(!/planSummary/.test(panel), 'planSummary 已成死代码，不得再引用');
});

test('⑤ 图片类型图标必须是项目图标族里的语义图标，不得再用 emoji', () => {
  const model = readRaw(PLAN_MODEL);
  const panel = read(SIZING);
  /* 用户原话（图3-③）：「现在这 5 个图标他们都有点太老土了……完全就是那种很简单的那种
     demo 版的东西，我需要你……做一些相应的或者找一些相应的图标去给它换上。」
     实测原实现是 emoji（⬜🖼️📱🔲📋）—— 形状/配色随系统字体变，且自带占位感。 */
  assert.ok(!/\p{Extended_Pictographic}/u.test(read(PLAN_MODEL)),
     '图片类型定义里不得再出现 emoji（其形状与配色不可控，观感像占位）');
  assert.match(model, /iconKey:/, '图标改为语义键，由渲染层从项目图标族取');
  assert.match(panel, /from 'lucide-react'/, '渲染层必须用项目既有的 lucide 图标族');
  assert.ok(!/typeDef\.icon\b/.test(panel), '不得再直接渲染 emoji 字段');
});

test('⑥ 勾选框与图标徽章必须有大小差（状态 vs 这是什么）', () => {
  const panel = read(SIZING);
  /* 用户原话（图3-③）：「首先就是你这个打钩的框，它怎么跟你的图标是一样大的呀？
     我实在是不明白。你这样从视觉上看起来，他就又没有主次之分了呀。」
     ⚠️ 本契约初版锁死的是 28 vs 18（1.56 倍）—— 用户复核时**仍然**说「怎么还是一模一样大」，
     说明判据不该锁具体数字，而该锁**倍数关系**：两档必须差 2 倍以上。
     数字只在 ICON_SIZE 里定义一次，改尺寸不需要改这条断言。 */
  const ladder = read(LADDER);
  const tile = Number(/typeTile: (\d+)/.exec(ladder)[1]);
  const box = Number(/typeCheckbox: (\d+)/.exec(ladder)[1]);
  assert.ok(tile / box >= 2,
    '类型徽章(' + tile + ') 必须是勾选框(' + box + ') 的 2 倍以上，否则「状态」与「这是什么」又混成一团');
  assert.match(panel, /<ImageTypeBadge /, '徽章必须走统一实现（尺寸由 ICON_SIZE.typeTile 决定）');
  assert.match(panel, /width: ICON_SIZE\.typeCheckbox/, '勾选框尺寸同样只在一处定义');
});

test('⑦ 主次阶梯：控件值必须比字段标签更重（字号更大）', () => {
  const ladder = read('src/pages/Home/ec/panelVisualLanguage.js');
  const panel = read(SIZING);
  /* 用户原话（图3-②）：「这 8 个字跟下面的选项框的字好像是一样大的，对吧？你为什么要这样
     去设计呢？这样搞得就真的没有任何主次之分了。」
     实测根因：标签 12px/600，控件值 11px/600 —— **标签比值还大**，两者同级。 */
  assert.match(ladder, /value: Object\.freeze\(\{ size: (\d+)/, '阶梯里必须有 value 档');
  assert.match(ladder, /fieldLabel: Object\.freeze\(\{ size: (\d+)/, '阶梯里必须有 fieldLabel 档');
  const valueSize = Number(/value: Object\.freeze\(\{ size: (\d+)/.exec(ladder)[1]);
  const labelSize = Number(/fieldLabel: Object\.freeze\(\{ size: (\d+)/.exec(ladder)[1]);
  assert.ok(valueSize > labelSize,
    '控件值字号(' + valueSize + ') 必须大于字段标签(' + labelSize + ')，否则没有主次');
  assert.match(panel, /textRoleStyle\('value'\)/, '套图方案的下拉值必须走 value 档');
  assert.match(panel, /textRoleStyle\('fieldLabel'\)/, '套图方案的字段标签必须走 fieldLabel 档');
});
/* ═══ 图5 / 图6：商品信息 · 内容规范 ═══ */
const PARAMS = 'src/pages/Home/ec/ParamsPanel.jsx';
const COPY = 'src/pages/Home/ec/CopyPanel.jsx';
const CONSTRAINTS = 'src/pages/Home/ec/GenerationConstraintsPanel.jsx';
const TEXTAREA = 'src/pages/Home/ec/ResizableTextarea.jsx';
const LADDER = 'src/pages/Home/ec/panelVisualLanguage.js';

test('⑧ 输入框只能有一个拉伸入口：原生角标必须关掉', () => {
  const box = read(TEXTAREA);
  /* 用户原话（图6-④）：「你这些框的右下角有一个可以拉动的按钮是对的，但是你现在情况好像是
     重叠了……你好像是两个图标或者是两个按钮叠到了一起」。
     根因：文件注释一直写着「resize:none —— 真正的拉伸由右下角手柄接管」，
     但**样式里从来没有写过这一句** —— 浏览器原生 textarea 角标（默认 resize:both）与自绘手柄叠着。 */
  assert.match(box, /resize: 'none'/, 'textarea 必须显式关掉原生拉伸角标');
  assert.match(box, /rsz-textarea-handle/, '自绘手柄仍在（用户要的那个）');
});

test('⑨ 商品信息面板不再有分组大标题，也不再有「其它补充」', () => {
  const panel = read(PARAMS);
  /* 用户原话（图5-①）：「商品归类、外观与材质、工艺与其它，这几块我觉得没有太大必要，
     因为你其实下面已经有相关的这些选项是干什么的，你都已经给他们一个小标题了呀，
     上面再加一个大标题信息点是重复的。」
     （图5-②）：「而且你这里怎么还有一个其他补充呀？我觉得完全没有必要呀。」 */
  for (const title of ['商品归类', '外观与材质', '工艺与其它']) {
    assert.ok(!panel.includes(title), '不得再出现分组大标题：' + title);
  }
  assert.ok(!/其它补充/.test(panel), '「其它补充」整块删除（反向约束已由内容规范承接）');
  /* 意图保留：每个控件仍必须有名字 —— 原来的裸框（只有大标题没有标签）必须降级为字段标签。 */
  assert.match(panel, /<FieldLabel icon=\{Shapes\}>/, '品类必须有字段标签，不能变成匿名输入框');
});

test('⑩ 内容规范：创意思路整块不上屏，交付要点只去标题', () => {
  const panel = read(COPY);
  /* 用户原话（图6-⑦）：「我觉得你这个创意思路这一整块啊是不要的……它的创意思路肯定会在
     提示词里面写的，上面已经有提示词框了。」
     （图6-⑤）：「这种什么交付要点啊，也要去掉。」 */
  assert.ok(!/创意思路/.test(panel), '创意思路整块删除（它属于表达层，是提示词的地盘）');
  assert.ok(!/交付要点/.test(panel), '交付要点标题删除（保留下面 4 个字段）');
  for (const label of ['核心卖点', '质检报告', '细节特写', '保养维护']) {
    assert.ok(panel.includes(label), '字段必须保留：' + label);
  }
});

test('⑪ 避免出现的元素：只有手输入口，不得再有预置清单', () => {
  const panel = read(CONSTRAINTS);
  /* 用户原话（图6-②）：见 home-mode-cards.test.mjs 的同源断言。
     这里额外守「占位提示也不得再列那 5 个词」—— 删按钮却把清单留在占位里，引导作用是一样的。 */
  assert.ok(!/商品结构变形|异常手部|乱码文字|无关道具|多余水印/.test(panel),
    '按钮与占位提示都不得再列那 5 个通用禁忌词');
  assert.match(panel, /placeholder=/, '必须保留格式提示（教怎么写，而不是给现成清单）');
});

test('⑫ 输入框样式必须走 token：不得硬编码色值，也不得用不随主题翻转的原色做底', () => {
  const ladder = read(LADDER);
  /* 用户原话（图5-①）：「怎么就变成一个极简风了呢？就是黑字白底这种极简风了呢。
     它是我们现在视觉语言的这种设计风格吗？」
     根因：共享的 inputStyle 里 border 是硬编码 rgba(45,41,38,0.12)、
     background 是 --sb-neutral-0（品牌原色，**不随主题翻转** → 暗色下变白框）。 */
  const inputBlock = /export const inputStyle = Object\.freeze\(\{([\s\S]*?)\}\);/;
  const found = inputBlock.exec(ladder);
  assert.ok(found, 'inputStyle 必须存在（六个面板共用）');
  const body = found[1];
  assert.ok(!/rgba?\(/.test(body), 'inputStyle 里不得再有硬编码颜色');
  assert.ok(!/--sb-neutral-\d/.test(body), '不得用不随主题翻转的品牌原色做底（暗色下会变成白框）');
  assert.match(body, /--sb-border-default/, '边框走语义 token');
  assert.match(body, /--sb-surface-card/, '底色走会随主题翻转的语义 token');
});
/* ═══ ⑧ 配置面板 ↔ 提示词：谁说了算（用户批注图6-⑦ 的核心困惑）═══ */
const NOTE = 'src/pages/Home/ec/PromptAuthorityNote.jsx';
const ECMODE = 'src/pages/Home/EcMode.jsx';

test('⑬ 没撞车时一个字都不许出现（空提示词 + 只选了个技能，不得冒出提示）', () => {
  const note = read(NOTE);
  const ecMode = read(ECMODE);
  /* ⚠️ 本契约上一版写的是「必须常驻分工说明」——**已被用户实测推翻**。
     用户原话（本批返工）：「我提示词里面并没有写入任何东西啊，为什么我只是在面板里
     点个技能它就会出来这个呢。」
     根因：上一版把一条分工说明做成了**常驻句**（「配置面板里的设定……面板留空 = 不限制」），
     它无条件渲染 —— 用户提示词是空的、也没有任何冲突，它照样显示在提示词框下面。
     在用户眼里这不是「帮助」，是「我没干什么，它自己冒出来一条东西」。
     裁决（2026-09-15）：删掉常驻句，**只在真撞车时才说话**。
     判据：无冲突时必须直接 return null —— 提示词为空时本组件渲染 0 字节。 */
  assert.match(note, /if \(hard\.conflicts\.length === 0 && !structural\.structural\) return null;/,
    '无冲突必须直接不渲染（含「提示词为空」这一最常见情形）');
  assert.ok(!/配置面板里的设定/.test(note), '常驻说明句必须删除');
  assert.ok(!/留空\s*=\s*不限制/.test(note), '常驻说明句必须删除（第二句）');
  /* 自证：这两条判据抓得住「常驻句」的旧写法。 */
  assert.ok(/配置面板里的设定/.test('<span>配置面板里的设定（张数 / 比例）对每一张图都生效</span>'),
    '自证：旧常驻句确实能被该判据命中');
  /* ⚠️ 挂载点必须是**真正被渲染**的那一个（本契约更早一版挂错了地方，实测才发现）：
     第一版把说明挂在 EcMode.jsx 里，而那个分支并未被渲染 ——
     实测构建产物里它的文案在本次构建包中 0 命中，而 EcommerceWorkbench 命中 3 个。
     改动前请用产物验证：npm run build 后 grep dist 里该文案。 */
  const workbench = read('src/pages/Home/ec/EcommerceWorkbench.jsx');
  assert.match(workbench, /<PromptAuthorityNote[\s\S]{0,120}prompt=\{description\}[\s\S]{0,60}negative=\{negativePrompt\}/,
    '必须挂在真正在用的提示词输入区（EcommerceWorkbench），并接上 negative');
  assert.match(ecMode, /negativePrompt=\{genSettings\.negativePrompt\}/,
    '宿主必须把真实的 negative 透传进去（否则冲突判定没有输入）');
  assert.match(workbench, /negativePrompt = ''/,
    'EcommerceWorkbench 必须接收 negativePrompt 这个 prop');
});

test('⑭ 冲突必须当场显性化，而且要说人话：告诉用户下一步点哪里', () => {
  const note = read(NOTE);
  /* 判据：两类冲突都要提示 ——
     · 硬约束冲突（提示词要 X、面板禁止 X）→ 说明出图听哪边、以及**去哪一栏改**；
     · 结构性意图（提示词里写「3 张」「9:16」）→ 说明张数比例由「套图方案」定。
     实现上**复用既有判定**，不新造一套：canvasPromptAuthority 的两个纯函数。 */
  assert.match(note, /detectHardConstraintConflicts/, '硬约束冲突必须复用既有判定');
  assert.match(note, /isStructuralIntent/, '结构性意图必须复用既有判定');
  /* 文案判据（可判、不靠感觉）：
     用户原话：「你这个表达不够接地气呀，用户根本不知道这是什么意思，
     你这句像是在对我交代的，根本不是对用户交代的呀。」
     → 提示语里必须出现**用户能操作的东西的名字**，并且不得出现内部术语。 */
  assert.match(note, /避免出现的元素/, '冲突提示必须点名用户能改的那一栏，而不是说「硬约束」');
  assert.match(note, /套图方案/, '结构性意图必须指向真正的权威面板');
  assert.ok(!/硬约束|权威性|越权|优先级|结构层|判定层/.test(note),
    '对用户的提示语里不得出现内部术语（那是写给审核者的，不是写给用户的）');
  assert.ok(!/默默|静默替换/.test(note), '不得静默替换用户输入');
});
/* ═══ 本批（第二批批注，图3-④ / 图4-②③ / 图5-②③④ / 图6-⑧⑨⑩）新增契约 ═══
   三条返工（③④⑤ 是上一轮没做对的）也在这里锁死，避免再「改一半」。 */
const PRIMITIVES = 'src/pages/Home/ec/PanelPrimitives.jsx';
const GLYPH = 'src/pages/Home/ec/ImageTypeGlyph.jsx';
const REGISTRY = 'src/pages/Home/ec/ecommerceFormatRegistry.js';
const SKU = 'src/pages/Home/ec/SkuPanel.jsx';
/* 六个面板全在这张表里 —— 「统一」的判据必须覆盖全部六个，
   只查其中几个正是上一轮「改了一半」的成因。 */
const PANELS = [SIZING, GEN, CONSTRAINTS, COPY, SKU, PARAMS];

test('⑮ 六面板的分组标题必须是同一种长相（13/700/ink-1 + 14px 图标，唯一实现）', () => {
  /* 用户原话（图6-⑧）：「我感觉你现在好像整个这下面所有的面板啊，他们的标题的设计方式
     好像都参差不齐的……同一阶梯的东西，同一个维度的东西，那就应该把他们统一起来，
     同一套的设计语言，同一套的字体大小字体间距字体色彩字体的方案等等的体系呀。」
     实测「参差不齐」有四个来源，全部收口到 PanelPrimitives.GroupTitle：
       ① 生成设置自己实现了一套 10px/灰的分组标题（其它面板 13/700/近黑）；
       ② 套图方案的「图片类型」是**裸的** 13/700、没有图标（「避免出现的元素」有）；
       ③ CopyPanel / SkuPanel 各自复制了一份 GroupTitle（删标题后已零调用）；
       ④ SkuPanel 的 FieldLabel 自写死 12/600/ink-2，与 TEXT_ROLE 是两份真相。 */
  for (const rel of PANELS) {
    const src = read(rel);
    assert.ok(!/groupTitleStyle/.test(src),
      rel + '：分组标题不得直接使用 groupTitleStyle —— 只能走 PanelPrimitives.GroupTitle（它保证带图标）');
    assert.ok(!/function GroupTitle\(/.test(src),
      rel + '：不得再定义局部 GroupTitle（上一轮就是这样长出四套标题的）');
    assert.ok(!/function FieldLabel\(/.test(src),
      rel + '：不得再定义局部 FieldLabel（必须用 PanelPrimitives 的那一个）');
  }
  const primitives = read(PRIMITIVES);
  assert.match(primitives, /ICON_SIZE\.groupTitle/, 'GroupTitle 的图标必须取统一尺寸档，不许在调用点写字面量');
  assert.match(primitives, /ICON_SIZE\.fieldLabel/);
  /* 带图标是硬要求：上一轮「图片类型」就是因为没图标才与「避免出现的元素」看起来像两套系统。 */
  assert.match(read(SIZING), /<GroupTitle icon=\{Images\}>图片类型<\/GroupTitle>/,
    '「图片类型」必须带图标（上一轮它是裸标题）');
  assert.match(read(CONSTRAINTS), /<GroupTitle icon=\{ShieldAlert\}>避免出现的元素<\/GroupTitle>/);
  const genTitles = read(GEN).match(/<GroupTitle icon=\{[A-Za-z]+\}>/g) || [];
  assert.equal(genTitles.length, 3, '生成设置的三个分组标题都必须带图标');
});

test('⑯ 图标与勾选框必须差到不可能看错（36 vs 16），图形不得再取通用图标库', () => {
  /* 用户原话（图4-③）：「你这个图标跟你的这个打钩的框怎么是一样大的？」
     —— 上一轮我做的是 28 vs 18（1.56 倍），用户复核时仍然认为一样大。
     「这是什么」（身份）与「选中了没有」（状态）的尺寸差必须足够大，这里锁 2.25 倍。 */
  const ladder = read(LADDER);
  assert.match(ladder, /typeTile: 36/, '类型徽章底板 36');
  assert.match(ladder, /typeCheckbox: 16/, '勾选框 16');
  assert.match(ladder, /typeGlyph: 22/, '徽章内图形 22');
  const sizing = read(SIZING);
  assert.match(sizing, /width: ICON_SIZE\.typeCheckbox, height: ICON_SIZE\.typeCheckbox/,
    '勾选框尺寸必须取自 ICON_SIZE（不再写死 18）');
  assert.ok(!/width: 18, height: 18/.test(sizing), '不得退回 18（1.56 倍不够）');
  assert.match(sizing, /<ImageTypeBadge iconKey=\{typeDef\.iconKey\} checked=\{checked\} \/>/);
  /* 图形的设计语言判据：自绘（不引图标库）+ 一套共用底板 + duotone（只用 currentColor 与透明度）。 */
  const glyph = read(GLYPH);
  assert.ok(!/lucide-react|phosphor|heroicons/.test(glyph),
    '图片类型图形不得再来自通用图标库 —— 用户：「完全就是那种很简单的那种 demo 版的东西」');
  assert.match(glyph, /const PLATE =/, '必须有一套共用的底板（这是「一套图标」的来源）');
  for (const key of ['whiteBg', 'mainText', 'transparent', 'detail']) {
    assert.ok(glyph.includes(key + ':'), '缺图形：' + key);
  }
  assert.ok(!/#[0-9a-fA-F]{3,8}/.test(glyph), '图形里不得出现硬编码色值（必须靠 currentColor 跟随主题）');
});

test('⑰ 数量输入框不得再出现前导零（01），也不得显示超出上限的数字', () => {
  const sizing = read(SIZING);
  /* 用户原话（图3-④）：「数量这里会变成 01」。
     根因不是取值，而是**受控 input 的写回时机**：React 只比对「本次 value」与「上次 value」，
     两者相同就根本不写 DOM —— 光标停在 1 前面敲个 0 得到 "01"，parseInt("01") 还是 1，
     value 没变化，React 便不纠正，"01" 就留在框里了。
     判据：前导零与越界都必须在同一帧直接写回 e.target.value。 */
  assert.match(sizing, /if \(e\.target\.value !== String\(next\)\) e\.target\.value = String\(next\);/,
    '必须在同一帧把规范化后的值写回 DOM');
  assert.match(sizing, /replace\(\/\^0\+\(\?=\\d\)\//, '必须抹掉前导零');
  assert.ok(!/onChange=\{e => updateCount\(typeDef\.key, parseInt\(e\.target\.value\) \|\| 0\)\}/.test(sizing),
    '不得退回只靠 parseInt 的旧写法（这正是 01 的成因）');
});

test('⑱ 3:4 归平台管：面板不再有「商品主图 3:4」行，移动优先平台自动出 3:4', () => {
  /* 用户原话（图4-②）：「这个商品主图 3:4 这个不要了……因为你下面如果有那种移动端优先的平台，
     你就自动给他出 3:4 就行了，不用单独多一行出来。」
     判据（真的是行为断言，不是字符串断言 —— 直接跑模型）：
       · 面板类型列表里没有 main_3x4；
       · 移动优先平台的主图默认 3:4；货架型商城仍是 1:1（不能给用户一个平台不收的尺寸）；
       · **角色 key main_3x4 必须保留**（试穿链路与后端引擎仍在用）。 */
  assert.deepEqual(IMAGE_TYPES.map(t => t.key), ['white_bg', 'main_text', 'transparent', 'detail'],
    '套图方案只应有 4 种图片类型（「商品主图 3:4」整行删除）');
  for (const p of ['douyin', 'xiaohongshu', 'kuaishou', 'tiktok-shop', 'shein']) {
    assert.equal(defaultRatioFor('main_text', p), '3:4', p + ' 是移动优先平台，主图默认应为 3:4');
  }
  for (const p of ['taobao', 'jd', 'pinduoduo', 'amazon', 'temu', 'shopee']) {
    assert.equal(defaultRatioFor('main_text', p), '1:1', p + ' 是货架型商城，主图规格仍是 1:1');
  }
  assert.equal(defaultRatioFor('white_bg', 'douyin'), '1:1', '白底首图不受平台覆盖');
  const douyin = resolveSizingImages('douyin', { images: [] });
  assert.deepEqual(douyin.map(i => [i.key, i.count, i.targetRatio]),
    [['main_text', 3, '3:4'], ['transparent', 1, '1:1'], ['detail', 3, '9:16']],
    '抖音的推荐组合里，3:4 必须挂在 main_text 上（不再是一个独立类型）');
  /* 判据要精确到**推荐组合**这一块：解析层的旧类型登记表里当然还有 main_3x4
     （那是给历史数据用的，见 ㉓），但 PLATFORM_PRESETS 不该再引用它 ——
     否则那一行会在面板上消失、张数却还算着，用户完全看不到它。 */
  const model = read(PLAN_MODEL);
  const presetsStart = model.indexOf('export const PLATFORM_PRESETS');
  const presetsEnd = model.indexOf('const ALL_IMAGE_TYPES');
  assert.ok(presetsStart > 0 && presetsEnd > presetsStart, '必须能定位 PLATFORM_PRESETS 区块');
  assert.ok(!model.slice(presetsStart, presetsEnd).includes('main_3x4'),
    '推荐组合里不得再引用已下线的类型（它会在面板上消失，张数却还算着）');
  assert.match(read(REGISTRY), /'main_3x4'/,
    '⚠️ 角色 key main_3x4 不许删：试穿链路（穿搭成片）与后端出图引擎仍在用它');
});

test('⑲ 标签 ↔ 控件只有一种间距（sp2）：sectionStyle 已删除', () => {
  /* 用户原话（图5-③）：「品类与输入框间距过大」。
     根因：共享的 sectionStyle（gap = sp5 20px）被当成「字段标签 + 控件」的容器用了 5 处 ——
     于是同一个面板里，「品类 → 输入框」是 20px，而紧挨着的「产品尺寸 → 输入框」是 8px。 */
  const ladder = read(LADDER);
  assert.ok(!/sectionStyle/.test(ladder), 'sectionStyle 必须删除（它的间距语义是分组，不是字段）');
  assert.match(ladder, /export const fieldStackStyle = Object\.freeze\(\{[\s\S]{0,80}gap: SPACING\.sp2/,
    'fieldStackStyle 必须是 sp2(8)');
  for (const rel of [PARAMS, COPY]) {
    assert.ok(!/sectionStyle/.test(read(rel)), rel + ' 不得再使用 sectionStyle');
  }
  assert.match(read(PARAMS), /style=\{fieldStackStyle\}/, '商品信息面板必须走 fieldStackStyle');
});

test('⑳ 文档表与代码不得互相打架：FONT_SIZE.fieldLabel 必须等于 TEXT_ROLE.fieldLabel.size', () => {
  /* 本批返工的根因之一：视觉语言文件头一直写着 fieldLabel = 12，
     而 TEXT_ROLE.fieldLabel 实际是 11 —— 上一轮我照着那份错文档，以为已经统一了。
     判据：两处必须同值；这条断言的价值在于它同时守住「改一处忘另一处」。 */
  const ladder = read(LADDER);
  const fontBlock = /export const FONT_SIZE = Object\.freeze\(\{([\s\S]*?)\}/.exec(ladder);
  const roleBlock = /export const TEXT_ROLE = Object\.freeze\(\{([\s\S]*?)\n\}\);/.exec(ladder);
  assert.ok(fontBlock, 'FONT_SIZE 必须存在');
  assert.ok(roleBlock, 'TEXT_ROLE 必须存在');
  const fontLabel = Number(/fieldLabel:\s*(\d+)/.exec(fontBlock[1])[1]);
  const roleLabel = Number(/fieldLabel: Object\.freeze\(\{ size: (\d+)/.exec(roleBlock[1])[1]);
  assert.equal(fontLabel, roleLabel, 'FONT_SIZE 与 TEXT_ROLE 的 fieldLabel 必须同值');
  /* 用户批注图4-①「这些小标题都太素了……感觉就像个demo一样」→ 标签从 11 抬到 12。
     同时 ⑦ 的判据是「控件值必须比字段标签重」，13 > 12 仍然成立。 */
  assert.equal(roleLabel, 12, '字段标签档 = 12');
  const valueSize = Number(/value: Object\.freeze\(\{ size: (\d+)/.exec(roleBlock[1])[1]);
  assert.ok(valueSize > roleLabel, '控件值必须比字段标签更重（这条判据不许反转）');
});

test('㉑ 六个面板的内边距与分组节奏必须同源（不得一半 SPACING、一半 V3 token）', () => {
  /* 用户批注图6-⑧ 的「参差不齐」还包括：生成设置的面板内边距是 20/20、
     分组间距 20，而另外五个面板是 24/20、16 —— 同一个工作台里两套节奏。 */
  const gen = read(GEN);
  assert.ok(!/--sb-panel-padding|--sb-group-gap|--sb-field-gap/.test(gen),
    '生成设置必须改用六面板统一的 SPACING 阶梯');
  for (const rel of PANELS) {
    assert.match(read(rel), /padding: .\$\{SPACING\.sp6\}px \$\{SPACING\.sp5\}px./,
      rel + ' 的面板内边距必须同源（上下 sp6 / 左右 sp5）');
  }
});

test('㉒ 生成设置的模型下拉：不得重复当前模型、图标加大、按钮内不得留大片空白', () => {
  const gen = read(GEN);
  /* 用户原话（图6-⑨）：「去掉模型下拉顶部重复的『当前模型』项（改为点开即选、收起只显示选中项）、
     图标做大、消除按钮内两侧大片空白」。 */
  assert.match(gen, /const listModels = otherModels\.length > 0 \? otherModels : SELECTABLE_IMAGE_MODELS;/,
    '展开列表必须过滤掉当前已选模型，并留空列表兜底');
  assert.match(gen, /\{listModels\.map\(model => \{/, '列表只渲染「其它可选项」');
  assert.ok(!/SELECTABLE_IMAGE_MODELS\.map\(/.test(gen),
    '不得再渲染整个列表 —— 当前模型会在触发按钮上重复出现一次');
  assert.match(gen, /ICON_SIZE\.modelTrigger/, '触发按钮里的品牌图标必须走统一尺寸档（已加大）');
  assert.match(gen, /ICON_SIZE\.modelOption/, '列表里的品牌图标必须走统一尺寸档（已加大）');
  assert.ok(!/justifyContent: 'space-between'/.test(gen),
    '模型行不得再用 space-between —— 它把名字与徽章顶到两端，中间那片空就是用户说的「大片空白」');
  assert.match(gen, /marginLeft: 'auto'/, '整行末尾的空档交给 chevron 前的 auto margin');
});

test('㉓ 已下线类型不得静默丢图：历史 payload 仍可解析，面板不出现幽灵行', () => {
  /* 这条是「删掉商品主图 3:4 那一行」的安全网。全量测试当场抓到过一次真实事故：
     把 main_3x4 从 TYPE_BY_KEY 删掉之后，UI 计划变成 14 张、服务端仍然是 15 张 ——
     差的那 1 张就是被**静默丢弃**的 main_3x4。铁律③：旧数据必须仍然可读。
     所以分两层：解析层认得旧 key（不丢数据），面板显示层合并（不出现幽灵行）。 */
  const legacy = resolveSizingImages('taobao', { images: [{ key: 'main_3x4', count: 2, ratio: '3:4' }] });
  assert.equal(legacy.length, 1, '解析层必须仍然认得 main_3x4，否则历史 payload 会被丢掉');
  assert.equal(legacy[0].key, 'main_3x4');
  assert.equal(legacy[0].count, 2);
  /* 面板显示层：合并进当前类型，且**总张数不变**。 */
  const merged = migrateLegacySizingImages([
    { key: 'main_text', count: 3, ratio: '1:1' },
    { key: 'main_3x4', count: 2, ratio: '3:4' },
  ]);
  assert.deepEqual(merged.map(i => [i.key, i.count]), [['main_text', 5]], '面板里合并成一行且总张数不变');
  const onlyLegacy = migrateLegacySizingImages([{ key: 'main_3x4', count: 4, ratio: '3:4' }]);
  assert.deepEqual(onlyLegacy.map(i => [i.key, i.count]), [['main_text', 4]], '只有旧类型时转成当前类型');
  assert.match(read(SIZING), /migrateLegacySizingImages\(resolveSizingImages\(/,
    '面板必须在解析之后做显示层迁移（否则「共 N 张」会把看不见的行算进去）');
  /* ⚠️ 反向判据：迁移**不许**进公共解析层 —— 试穿链路（anything_tryon）仍以 main_3x4
     当角色 key，在公共层改 key 会改变服务端的出图规划，那是动生产、不是改显示。 */
  const model = read(PLAN_MODEL);
  const start = model.indexOf('export function resolveSizingImages');
  const end = model.indexOf('const LEGACY_SIZING_ALIASES');
  assert.ok(start >= 0 && end > start, '必须能定位到 resolveSizingImages 的函数体');
  assert.ok(!/LEGACY_SIZING_ALIASES|migrateLegacySizingImages/.test(model.slice(start, end)),
    'resolveSizingImages 里不得做类型迁移');
});

test('㉔ 取色器不得被视口底部截断', () => {
  const gen = read(GEN);
  /* 用户原话（图6-⑩）：「不要给用户这种截断感」。
     根因：取色器（168px 高的色盘）内联渲染在面板文档流的最后一块，
     面板一旦靠近视口底部就被裁掉一半。修法与平台下拉同源：走 AnchoredPortal。 */
  assert.match(gen, /<AnchoredPortal[\s\S]{0,240}anchorRef=\{pickerRowRef\}/,
    '取色器必须走 AnchoredPortal 定位（与平台下拉同一套机制）');
  assert.ok(!/\{pickerOpen && \(/.test(gen), '不得再内联渲染（内联时面板贴底就会被裁掉）');
  assert.match(gen, /const pickerRowRef = useRef\(null\)/, '必须有定位锚点');
  /* 自证：这条判据针对的「翻转到上方」能力确实由 AnchoredPortal 提供。 */
  assert.match(read('src/components/ui/AnchoredPortal.jsx'), /placeAbove/,
    'AnchoredPortal 必须支持向上翻转，否则这条判据等于没写');
});
