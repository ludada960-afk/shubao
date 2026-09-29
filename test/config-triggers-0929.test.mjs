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
