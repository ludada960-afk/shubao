/* ═══ 2026-09-29 批 DC 续-8：子页面「生成配置」收成**两颗触发器** ══════════════════════════════════════
   用户 2026-09-29 逐字（指概念视觉方案那一页的左栏）：
     「你不可以像首页这样就是做成一个**生图模型的按钮和面板**，还有一个**画面规格的一个按钮和面板**吗？
       你就只排两个按钮进去子页面里面不就好了吗？然后用户他点击之后就可以在面板里面选中相应的配置。
       这样不是更干净简洁吗？**你为什么要把子页面的规划搞得乱七八糟呢？**」
     「当然你张开的面板，你也要好好的做好适配，因为**之前视频生成那边就存在过这个问题。就是相应的模型
       选择按钮打开之后，它的面板是会被左边导航栏截断的。**」

   门禁守四件事，每条都对应上面某一句原话：
     ① **声明驱动**：页面里不许手写这两颗按钮 —— 它是 `kind: 'config'` 的字段，由 FieldRenderer 渲染；
     ② **covers 真的生效**：被收起的字段从**渲染**里剔掉，但**仍留在声明里**（取值与报价的真源）；
     ③ **共用一份实现**：子页面与首页走**同一个组件 + 同一份样式**（不许出现第二套长得像的）；
     ④ **浮层不许被左侧导航栏压住**：z 高于 `--sb-z-sticky`（10,000,000），且 x 让开侧栏右缘
        —— 这正是视频侧那个一直没修好的 bug（`floatingLeftInset` 只让了 x、z 序是 90）。 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { IMAGE_SKILLS, FIELD_KINDS } from '../src/skills/imageSkills.js';

const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const code = rel => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const skill = IMAGE_SKILLS.find(item => item.id === 'image.concept_set');
const config = skill.fields.find(field => field.key === 'genConfig');

test('① 这一格是 kind:"config" 的**字段**，由 FieldRenderer 渲染（页面里不许手写控件）', () => {
  assert.ok(FIELD_KINDS.includes('config'), 'config 必须登记在 FIELD_KINDS 里（否则声明形状不合法）');
  assert.ok(config, '概念视觉方案要声明这一格');
  assert.equal(config.kind, 'config');
  assert.equal(config.group, '生成设置',
    '⚠️ 必须与被收起的两格同一组 —— 否则剔完那三格会连组标题一起消失，用户找不到"生成设置"这几个字');
  /* 页面不许手写：FieldRenderer 见到 config 就要走共用组件。 */
  const renderer = code('src/components/media/FieldRenderer.jsx');
  assert.match(renderer, /kind === 'config'\)[\s\S]{0,2000}?ConfigTriggers/, 'FieldRenderer 的 config 分支要渲染 ConfigTriggers');
  assert.doesNotMatch(code('src/pages/MediaCreation/index.jsx'), /visual-config-trigger/,
    '页面里不许自己写这两颗按钮（全站纪律：字段一律经 FieldRenderer）');
});

test('② covers 真的生效：被收起的从**渲染**里剔掉，但仍留在**声明**里（取值与报价的真源）', () => {
  assert.deepEqual([...config.covers].sort(), ['clarity', 'imageModel', 'ratio']);
  for (const key of config.covers) {
    assert.ok(skill.fields.some(field => field.key === key),
      `⚠️ ${key} 必须仍在 fields 里 —— 它是默认值/张数/报价的真源，删了按钮上的积分就会算错`);
  }
  const shell = code('src/components/media/WorkbenchShell.jsx');
  assert.match(shell, /function dropCoveredFields\(/, 'WorkbenchShell 要有"剔掉被收起字段"这一步');
  assert.match(shell, /field\.kind === 'config' && Array\.isArray\(field\.covers\)/,
    '判据必须按 kind + covers 走（声明驱动，不是按字段名硬编码）');
  assert.match(shell, /covered\.has\(field\.key\)/, '被 covers 命中的字段要真的被剔掉');
  /* 剔的是**渲染**，不是声明 —— 这一条是 ② 的要害。
     ⚠️ 声明里**按 key 引用**，不嵌字段对象的副本：嵌副本会造成"同一个 key 在这条技能里声明两次"
     （`skill-declaration-contract-0916` ② 判的就是这个，那条是对的），
     而且改选项时会漏改一处、漏改的那一处**静默不生效**。 */
  assert.equal(config.modelKey, 'imageModel', '按 key 引用模型字段（不嵌副本）');
  assert.deepEqual([...config.specKeys], ['ratio', 'clarity'], '按 key 引用规格字段（不嵌副本）');
  assert.equal(config.modelField, undefined, '不许把整份字段对象塞进声明（会造成 key 重复声明）');
  assert.equal(config.specFields, undefined, '同上');
  /* 组件侧确实按 key 取回**那几条**（不是各写一份控件）。
     ⚠️ 取回动作在 **FieldRenderer** 那一侧（组件不能反向 import 它，见 ③），
        所以这里咬的是 FieldRenderer 里那两行 `byKey`。 */
  const comp = code('src/components/media/ConfigTriggers.jsx');
  const rendererCode = code('src/components/media/FieldRenderer.jsx');
  assert.match(rendererCode, /const byKey = key => \(allFields \|\| \[\]\)\.find\(item => item && item\.key === key\)/,
    '按 key 从 allFields 取回声明');
  assert.match(rendererCode, /const specDecls = \(field\.specKeys \|\| \[\]\)\.map\(byKey\)/, '规格面板按 specKeys 取回那几条');
  assert.ok(comp.length > 0);
});

test('③ 共用一份实现：子页面与首页走同一个组件 + 同一份样式', () => {
  const comp = read('src/components/media/ConfigTriggers.jsx');
  assert.match(comp, /className="visual-config-cluster[^"]*"/, '触发器那一行要走首页那个 class（不是另起一套）');
  assert.match(comp, /className={'visual-config-trigger'/, '两颗按钮走首页那颗的 class');
  assert.match(comp, /createPortal\(panel, document\.body\)/,
    '面板必须 portal 到 body —— 子页面左栏是 overflow-y:auto，不 portal 会被裁掉');
  assert.match(comp, /import '\.\/ConfigTriggers\.css'/, '组件自己带着它的样式');
  /* 首页那一侧也必须 import 同一份（不能各带一份） */
  assert.match(code('src/pages/Home/VisualCreationMode.jsx'), /import '\.\.\/\.\.\/components\/media\/ConfigTriggers\.css'/,
    '首页要 import 共用那份样式');
  const homeCss = code('src/pages/Home/VisualCreationMode.css');
  /* ⚠️ 判据要咬**基础规则**（带 min-width: 126px 的那条），不是"文件里不许出现这个选择器" ——
     `@media (max-width: 900px)` 里那条 154px 的窄屏覆盖**本来就该留在这儿**（它跟着首页的移动端规则走）。 */
  assert.doesNotMatch(homeCss, /\.visual-config-trigger \{[^}]*min-width: 126px/,
    '首页样式表里不许**留一份**触发器基础规则（搬走了就不能还留着，否则改一处漂一处）');
  assert.match(read('src/components/media/ConfigTriggers.css'), /\.visual-config-trigger\s*\{/, '共用那份里要有触发器规则');
  /* 面板里的比例/清晰度仍是 FieldRenderer 渲染原来那一份声明（不重写控件）。
     ⚠️ 第一版让 ConfigTriggers **自己 import FieldRenderer** 去渲染 —— 那会形成
     `FieldRenderer → ConfigTriggers → FieldRenderer` 的**循环依赖**，esbuild 只查语法查不出来，
     运行期直接 ReferenceError → 整页落错误边界（端到端里 `.media-workbench-submit` 20s 超时）。
     ⇒ 判据反过来咬：**组件不许 import FieldRenderer**，面板内容由 FieldRenderer 递归渲染好再传进来。 */
  assert.doesNotMatch(comp, /from '\.\/FieldRenderer/, '组件不许反向 import FieldRenderer（循环依赖 = 整页白屏）');
  const renderer = code('src/components/media/FieldRenderer.jsx');
  assert.match(renderer, /specNodes=\{specDecls\.map\(decl => \(\s*<FieldRenderer/,
    '规格面板里的药丸要由 FieldRenderer 递归渲染原来那一份声明（不另写一套控件）');
  assert.match(renderer, /modelNode=\{modelDecl\s*\? <ModelOptionRows/, '模型面板复用同一个 ModelOptionRows');
  /* ⚠️ 2026-09-29 批 DC 续-14：面板内容**必须有内边距**（用户 2026-09-29 逐字：
       「为什么张开的面板**灰色部分的周边间距那么窄**啊，很难看啊。」）
     根因：`.visual-config-panel-body { padding: 0 }`（首页那一档，首页把内边距放在**内层 section** 上），
     而子页面这版没有 section、直接把 `ModelOptionRows` 铺在 body 里 ⇒ 那一列灰块**左右贴边**。
     ⇒ 逐值照抄首页那一档（`.visual-panel-section`：0 20px + 首尾 24px；紧凑 0 16px + 16px）。
     ⚠️ 作用域必须限定 `[data-portal-host="workbench"]`：改共享那条会把首页面板的内边距撑成两倍。 */
  const ctCss = code('src/components/media/ConfigTriggers.css');
  assert.match(ctCss, /\.visual-config-panel\[data-portal-host="workbench"\] \.visual-config-panel-body \{ padding: 24px 20px; \}/,
    '面板内容要留出内边距（逐值照抄首页 .visual-panel-section 那一档）');
  assert.match(ctCss, /\[data-portal-host="workbench"\]\[data-density="compact"\] \.visual-config-panel-body \{ padding: 16px; \}/,
    '紧凑档也要有内边距 —— 八行模型列表在多数屏幕上都会落到紧凑档');
  assert.doesNotMatch(ctCss, /^\s*\.visual-config-panel-body \{[^}]*padding/m,
    '不许改共享的 .visual-config-panel-body（首页那边靠 section 承担内边距，改了会撑成两倍）');
  /* 面板里不许再出现我自己加的"教学/操作说明"（用户 2026-09-29 明确要求删掉）。
     ⚠️ 判据要用**剥掉注释**的那份：我在上面那段注释里**如实引了被删掉的那句原文**（说明为什么删），
     不剥就会把「说明」当成「代码」—— 这个坑本批已经踩到第三次。 */
  const compCode = code('src/components/media/ConfigTriggers.jsx');
  assert.doesNotMatch(compCode, /改完点面板外面收起/, '面板里那句操作说明要删（用户 2026-09-29：「这句不要有啊，删掉」）');
  assert.doesNotMatch(compCode, /coverLabels/, '那个只为渲染说明而存在的 prop 要一起删掉（不留半截）');
  const skills = code('src/skills/imageSkills.js');
  assert.doesNotMatch(skills, /模型与画面规格收在这里/, '触发器下面那句说明要删（同上，用户点名的那句）');
  /* ⚠️⚠️ 2026-09-29 批 DC 续-17：面板改成**吸附到触发按钮**（用户**第三次**当面纠正）。
     这一格先后被推翻过两次，三次的落点都记在这儿，因为它们错在同一个地方 —— **锚点选错**：
       · 批 DC 续-14「你把面板**居最上面**」⇒ 我改成"一律顶到视口上沿"（锚点＝顶栏下沿）；
       · 批 DC 续-15「滑动一下界面就**脱离**了」⇒ 我把 scroll 监听**整条删掉**（诊断错了：
         脱离的根因是顶栏 sticky、滚过 120px 加 `.is-compact` **高度会变**，不是"跟着滚"本身）；
       · 批 DC 续-17「**它必须吸附在按钮上呀，你这个又没有吸附住**」⇒ 锚点换成**按钮自己的视口矩形**，
         scroll 监听**加回来**。按钮在视口坐标系里"就是要跟着按钮走"，所以
         **"跟着按钮"与"不脱离"这两件事不矛盾** —— 上一批把它们当互斥才是错的。
     ⇒ 现在的判据：优先开在按钮**下方**；下方**放得下这一块**才用下方（第一版写"至少还有 160px"，
       于是在「生成设置」那个位置硬开在下方并被视口底边切掉）；放不下就翻到**上方**。 */
  assert.match(comp, /const rect = button\.getBoundingClientRect\(\);/,
    '锚点必须是**按钮自己**的视口矩形（不是顶栏 —— 顶栏 sticky、滚过去高度会变）');
  assert.match(comp, /roomBelow >= desiredHeight/,
    '下方要**放得下这一块**才开在下方（不是"还有 160px 就行"，那会被视口底边切掉）');
  assert.match(comp, /roomAbove >= Math\.min\(desiredHeight, 160\)/,
    '下方放不下就翻到上方');
  assert.match(comp, /bottom: Math\.max\(12, Math\.round\(viewportHeight - rect\.top \+ gap\)\)/,
    '翻到上方时必须按 **bottom** 定位（按 top 配 maxHeight 算会在内容比上限矮时脱离按钮 —— 实测差 162px）');
  assert.match(comp, /document\.querySelector\('\.app-topbar'\)/, '仍要量顶栏：面板不许压到顶栏上');
  /* ⚠️⚠️ 2026-09-29 批 DC 续-18：**"跟着按钮走"整条作废**。
     用户实测知渔后的全局口径是「**滚轮一滚，浮层就关**」（逐字：「他们好像全局都是把这种按钮
     张开面板的时候，如果用户去滚动鼠标滚轮的话，面板就会自动关闭……你全局都要去实现这个方案」）。
     ⇒ 面板**不再**跟着滚：scroll/wheel 一律收起，跟滚那套（重算坐标、翻上翻下）全部不需要。
     批 DC 续-15 与续-17 在这条上反复改了两版，根因是**问题问错了** ——
     在"怎么跟得稳"上找答案，而正确答案是"根本不用跟"。 */
  assert.doesNotMatch(comp, /addEventListener\('scroll'/,
    '面板不许再跟着滚（全局口径是"滚一下就关"）—— 这一行是"面板跟着滚动"的全部来源');
  assert.match(comp, /useDismissOverlay\(Boolean\(open\), \(\) => setOpen\(null\)\)/,
    '要接全局那个"滚一下就关"（实现见 useDismissOverlay.js，那里只有**一个** wheel 监听）');
  assert.match(comp, /\[OVERLAY_ROOT_ATTR\]/, '面板根要标成浮层根，否则在面板内部滚动会把自己关掉');
  assert.match(comp, /window\.addEventListener\('resize', onResize\)/, '视口尺寸变了要重量（这不是"跟滚"，是尺寸真变了）');
  /* 点外面 / ESC 要自己关掉（用户同一句里提的：「用户点击其他的东西，面板就要自己关掉」）。 */
  assert.match(comp, /document\.addEventListener\('mousedown', onDown, true\)/, '点外面要收起');
  assert.match(comp, /event\.key === 'Escape'/, 'ESC 也要能收起');
  /* 面板**内容**的内边距（用户：「灰色部分的周边间距那么窄」）。 */
  const ctCss2 = code('src/components/media/ConfigTriggers.css');
  assert.match(ctCss2, /\.visual-config-panel\[data-portal-host="workbench"\] \.visual-config-panel-body \{ padding: 24px 20px; \}/,
    '面板内容要留出内边距（逐值照抄首页 .visual-panel-section 那一档）');
  assert.match(ctCss2, /\[data-portal-host="workbench"\]\[data-density="compact"\] \.visual-config-panel-body \{ padding: 16px; \}/,
    '紧凑档也要有内边距 —— 八行模型列表在多数屏幕上都会落到紧凑档');
  assert.doesNotMatch(ctCss2, /^\s*\.visual-config-panel-body \{[^}]*padding/m,
    '不许改共享的 .visual-config-panel-body（首页那边靠 section 承担内边距，改了会撑成两倍）');
  /* LOGO 的落地阴影不许再有方向性大偏移（用户：「右边和下面有个黑色的阴影…很大很明显像一整块」）。 */
  const shellCss = code('src/styles/app-shell.css');
  const mark = shellCss.slice(shellCss.indexOf('.topbar-brand-mark {'));
  assert.doesNotMatch(mark.slice(0, mark.indexOf('}')), /box-shadow:\s*3px\s+6px\s+18px/,
    'LOGO 不许再有 3px/6px/18px 的偏移投影（它糊成一整块，用户 2026-09-29 明确要求优化）');
  assert.match(shellCss, /box-shadow:\s*0 2px 8px rgba\(160, 130, 220, 0\.22\)/,
    'LOGO 改成正下方的柔和落地影（保留一点品牌紫，去掉方向性大偏移）');
});

test('④ 浮层不许被左侧导航栏压住：z 高于 sticky，且 x 让开侧栏右缘', () => {
  const comp = code('src/components/media/ConfigTriggers.jsx');
  assert.match(comp, /function sidebarInset\(\)/, '必须有一份"侧栏让位"的计算');
  assert.match(comp, /const rect = nav\.getBoundingClientRect\(\);[\s\S]{0,200}?rect\.right/,
    '让位要按侧栏**实际右缘**算（窄屏它会变窄）');
  assert.match(comp, /rect\.width > window\.innerWidth \* 0\.5\) return 12;/,
    '侧栏变成**底栏**时不能让位（否则浮层会被推到屏幕外）');
  assert.match(comp, /Math\.max\(leftInset,/, 'left 必须夹到让位值之上（首页那份只夹到 16，在有侧栏的页面上会被压住）');
  const css = read('src/components/media/ConfigTriggers.css');
  assert.match(css, /\[data-portal-host="workbench"\][^}]*z-index:\s*var\(--sb-z-dropdown\)/,
    '浮层 z 必须用 --sb-z-dropdown（高于 --sb-z-sticky = 10,000,000）');
  /* 视频侧那个同款 bug：z 序当时是 90，被 10,000,000 的侧栏压住。 */
  const videoCss = code('src/pages/VideoStudio/VideoStudio.css');
  assert.doesNotMatch(videoCss, /\.video-inline-menu \{[^}]*z-index: 90;/,
    '视频侧模型菜单的 z-index 不许再是 90（用户 2026-09-29：「它的面板是会被左边导航栏截断的」）');
  assert.match(videoCss, /\.video-inline-menu \{[^}]*z-index: var\(--sb-z-dropdown\)/, '视频侧那一处也要抬到 dropdown 层');
});

test('⑤ 自证：把 covers 去掉必须判红（否则 ② 是空转）', () => {
  const broken = code('src/components/media/WorkbenchShell.jsx').replace('field.kind === \'config\'', 'false');
  assert.notEqual(broken, code('src/components/media/WorkbenchShell.jsx'), '替换没生效，这条自证无效');
  assert.doesNotMatch(broken, /field\.kind === 'config' && Array\.isArray\(field\.covers\)/, '去掉判据竟然没被抓到 ⇒ ② 是空转');
});
