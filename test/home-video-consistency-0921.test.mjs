import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { stripComments } from '../scripts/lib/token-scope.mjs';
import { planToContextText } from '../src/pages/VideoStudio/cameraMoves.js';
import { VIDEO_WORKBENCHES } from '../src/skills/videoWorkbenches.js';

/* ═══ 批 U（2026-09-21）门禁：用户本轮 8 张截图里的几条硬要求 ═════════════════════════════════
   用户原话（逐字，逐条对应下面的用例）：
     · 「首页左上角 LOGO 和右上角的登录按钮都会向上面挤压，你这个是**绝对不对的**」
     · 「鼠标放上去的**试一试是变形的**，你要抄图三（flova）的做法呀」
     · 「你现在这个视频模型的面板是**会脱离你的这个按钮的**，一定是要**吸附在上面**的」
     · 「他们右边都有一个……**滚动条**，问题是他们根本没有那么多信息可以去滚动呀……很多余啊」
     · 「视频生成和图片生成……**规格、色彩、UI、交互都应该保持一致**」「按照图片生成这边的规格去做」
     · 「视频生成这边你现在的这个暖黄色输入框的周边……**那边是没有那么多留白的呀**」
     · 「**代为撰写首页这边是不需要的**，我们的竞争对手他们也没有这个呀」
     · 「『产品卖点与设计风格，一键解析商品信息，0.2 积分』这个**也是多余的**……各个子页面应该都有这个问题」
     · 「**可以吧，让它自动落进去**」（AI 分析结论落进「门店信息」那一格） */

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const shellCss = read('src/styles/app-shell.css');
const rowCss = read('src/components/media/SkillEntryRow.css');
const videoCss = read('src/pages/VideoStudio/VideoStudio.css');
const videoPage = stripComments(read('src/pages/VideoStudio/index.jsx'));
const creation = stripComments(read('src/pages/MediaCreation/index.jsx'));
/* ⚠️ 2026-09-29 批 DC 续-8：`.visual-config-panel` 的基础规则搬去了**共用组件**的样式表
   （技能子页面也要用同一份），所以这里两份一起读。取值一个字没改。 */
const visualCss = read('src/pages/Home/VisualCreationMode.css') + '\n'
  + read('src/components/media/ConfigTriggers.css');

test('① 顶栏滚动时不再压缩（头部不跳）', () => {
  assert.doesNotMatch(shellCss, /\.app-topbar\.is-compact \{[^}]*padding-top/, '紧凑态不得再改内边距');
  /* ═══ 2026-09-25 批 BF：**判据反转**（用户改向，逐字）═════════════════════════════════════
     原来守的是"紧凑态不得再缩品牌标"—— 那是批 H/J 那会儿的裁定（顶栏滚动时不跳）。
     用户本轮把口径说清了，而且是**反过来的**：
       「我们之前的那个设计方案其实是比较好的，就是**正常的这个 LOGO 它是展示全部的**，
        然后当我**往下滚动**的时候，LOGO 才会**缩成这个比较小的这个样式**。
        你现在的情况是它**永远是这个比较小的样式**，这是不对的。」
     ⇒ 现在**要求**滚动后缩小（38 → 26 且文字收起），所以断言反过来：
       两态都必须存在，且缩小态围绕**同一条中线**（靠 --bb-mark-r 补偿，不左右跳）。
     ═══ 2026-09-25 批 BG：**口径再反一次**（用户改向，逐字）══════════════════════════════════════
     「用户进来的第一版 LOGO 是不能有这个薯包 AI 这几个字的。就是只有 LOGO 而已，然后 LOGO 必须要
       适配好左边的导航栏的规则。你起码应该把它**放大一些**吧。然后「薯包 AI」这四个字是**只有当用户
       滚动鼠标的时候**，也就是你的这个 LOGO 产生变化缩小的时候才能出现这几个字的。」
     ⇒ 默认 = **只有标**（38px，与左导航 38px 磁贴同档）；滚动后才缩到 26px **并出字标**。
       两态的中线仍锁在 x=48，只是"当前半径"这个变量提到了顶栏这一层（--bb-mark-r），
       标自己的居中补偿与子页面那一格的左移量都从它算。 */
  assert.match(shellCss, /\.app-topbar\.is-compact \.topbar-brand-mark \{ width: 26px; height: 26px;/, '滚动后标要缩小（用户明确要求的两态）');
  assert.match(shellCss, /\.app-topbar\.is-compact \{ --bb-mark-r: 13px; \}/, '缩小时要补偿中线（否则标会左右跳）');
  assert.match(shellCss, /\.app-topbar \{ --bb-mark-r: 19px; \}/, '默认态的中线变量 = 38px 标的一半（与导航磁贴同档）');
  assert.doesNotMatch(shellCss, /\.app-topbar\.is-compact \.topbar-row \{[^}]*padding-block/, '紧凑态不得再压行高');
  /* 但毛玻璃底与描边保留（滚动时视觉上仍然是"浮在上面的一条"） */
  assert.match(shellCss, /\.app-topbar\.is-compact \{[^}]*backdrop-filter/, '紧凑态保留毛玻璃底');
});

test('② 悬停 = 内容隐藏 + 原地「试一试」（不再压毛玻璃）', () => {
  assert.match(rowCss, /\.skill-entry-button:hover \.skill-entry-glyph,[\s\S]{0,400}visibility: hidden;/, '图标悬停隐藏');
  assert.match(rowCss, /\.skill-entry-button:hover \.skill-entry-name,[\s\S]{0,400}visibility: hidden;/, '名字悬停隐藏');
  assert.doesNotMatch(rowCss, /\.skill-entry-try \{[^}]*backdrop-filter/, '不再有毛玻璃遮罩');
});

test('③ 视频侧两个面板照图片侧的规格（同一档宽度 / 圆角 / 底色 / 阴影）', () => {
  /* 容器：与 .visual-config-panel 同一组值（480 宽度在 JS 里设，见下一条断言）
     ⚠️ 用正则取规则块，不用 indexOf 切片 —— 上面的写法一旦换行/空格变了就切出空串（本轮踩到）。 */
  const block = (videoCss.match(/\.video-config-panel,\s*\.video-inline-menu \{[\s\S]*?\}/) || [''])[0];
  assert.ok(block.length > 40, '必须存在"两个视频面板同一组值"的规则块');
  assert.match(block, /border: 1px solid rgba\(255, 255, 255, \.86\)/, '描边照图片侧');
  /* ═══ 2026-09-25 批 BF：**判据里的值改了，判据本身（两侧同一档）没改** ═══════════════════════
     用户本轮原话：「你深度思考一下能不能把视频生成和图片生成这边他们的这两个按钮，
     还有他们张开的面板**去重新设计**吧」—— 两个面板的圆角从 8 改成 20，是这次重设计的一部分：
       ① 站内规范 panelVisualLanguage.js 的「4. 圆角」写的是 radius.panel = 20，
          而图片侧实现一直是 8（文档与代码打架）；
       ② **嵌套圆角倒置**：面板里的选项控件圆角是 --sb-radius-card(12) > 面板 8，
          近看就是"按钮比面板还圆"（原则 3.4：内层圆角 = 外层 − 内边距）；
       ③ 知渔那张面板实测 19.84，取整 20。
     ⚠️ 两侧**同时**改（图片侧 .visual-config-panel 也在本轮改成 20），所以这条守的
        "视频侧照图片侧的规格"一字未变 —— 变的只是那个规格的取值。 */
  assert.match(block, /border-radius: 20px/, '圆角与图片侧同档（20）');
  assert.match(block, /background: var\(--sb-surface-panel-solid\)/, '底色照图片侧（不透明面板底）');
  assert.match(block, /box-shadow: 0 28px 80px rgba\(37, 30, 24, \.18\), 0 2px 10px rgba\(37, 30, 24, \.06\)/, '阴影照图片侧');
  /* 两处宽度都是 480（生成设置面板 + 模型菜单） */
  assert.match(videoPage, /const preferred = key === 'settings' \? 480/, '生成设置面板宽度 = 480');
  assert.match(videoPage, /const width = Math\.min\(480, viewportWidth - 24\)/, '模型菜单宽度 = 480');
  /* 建模行照 .sb-opt 的规格 —— ⚠️ 批 W 改判：底色换成站内那颗"凹槽底" token（设计 token 棘轮门禁
     不许新写 hex），并且**排布改成靠左**（用户图一：「视频生成的模型选择现在是乱码的情况了」——
     更宽的行里 space-between 把图标与文案拉到两端，看起来就是乱码）。 */
  /* ═══ 2026-09-24 批 AW：判据从"写死 8px 12px / 圆角 12 / --sb-surface-sunken"
     **改成与图片侧同一批 token** —— 起因是用户图四那句「你为什么会有个背景的暖色呢？…
     我要求你两边都要统一样式……你现在是两套东西在做呀」。
     批 W 当初是"照 .sb-opt 的数值手写一遍"（8/12、12px、凹槽底），写出来的**不是同一批值**：
     图片侧的默认底是 `--sb-l3-option`(#F4F4F4)，而 `--sb-surface-sunken` 是更深的 neutral-150
     —— 那就是用户看到的"暖色"。现在改成**逐个属性引用同一批 token**（内边距/圆角/默认底/hover底/
     选中底+描边+ring/按下底），并且断言就对着这批 token 比，不再对着手写数字比。
     守的东西变严了：以前只要求"看起来差不多"，现在要求"是同一批 token"。 */
  assert.match(videoCss, /\.video-inline-menu > button \{[\s\S]*?padding: var\(--sb-space-2\) var\(--sb-space-3\);/,
    '模型行内边距用图片侧那两颗间距 token（不再是手写的 8px 12px）');
  assert.match(videoCss, /\.video-inline-menu > button \{[\s\S]*?border-radius: var\(--sb-radius-card\);/,
    '模型行圆角用 --sb-radius-card（与 .sb-opt 同一颗）');
  assert.match(videoCss, /\.video-inline-menu > button \{[\s\S]*?background: var\(--sb-l3-option\);/,
    '模型行默认底用 --sb-l3-option（.sb-opt 的同一颗；改前用的 surface-sunken 更深、就是用户说的"暖色"）');
  assert.match(videoCss, /\.video-inline-menu > button \{[\s\S]*?border: 1\.5px solid transparent;/,
    '要有 1.5px 透明描边占位（否则选中加描边时整行会抖）');
  assert.match(videoCss, /\.video-inline-menu > button\.is-selected \{[\s\S]*?background: var\(--sb-sel-bg\);[\s\S]*?border-color: var\(--sb-sel-line\);[\s\S]*?box-shadow: var\(--sb-shadow-ring\);/,
    '选中态照 .sb-opt[aria-pressed=true]：底 + 描边 + ring（用户："按钮去跟着配置进行变化的逻辑的样式"）');
  assert.match(videoCss, /\.video-inline-menu > button:hover:not\(\.is-selected\) \{ background: var\(--sb-l3-option-hover\); \}/,
    'hover 底用 --sb-l3-option-hover（与图片侧同一颗）');
  assert.match(videoCss, /\.video-inline-menu\.is-model > button \{ justify-content: flex-start;/, '模型行必须靠左排布（否则图标与文案被拉到两端 = 用户说的"乱码"）');
});

test('④ 面板吸附按钮：滚动与缩放都重新定位（模型菜单补上了图片侧一直有的那两个监听）', () => {
  assert.match(videoPage, /const followButton = \(\) => positionModelMenu\(\)/, '模型菜单要有跟随函数');
  assert.match(videoPage, /window\.addEventListener\('scroll', followButton, true\)/, '滚动（捕获）时重新定位');
  assert.match(videoPage, /window\.addEventListener\('resize', followButton\)/, '缩放时重新定位');
  assert.match(videoPage, /window\.removeEventListener\('scroll', followButton, true\)/, '卸载时移除监听（不许泄漏）');
});

test('⑤ 面板不出现"没东西可滚"的滚动条，但**该滚的时候必须能滚**（批 W 改判）', () => {
  /* ═══ 批 U → 批 W 的改判链（两条用户口径直接冲突，后一条更严重）══════════════════════════════
     批 U：用户说「他们右边都有一个……滚动条，问题是他们根本没有那么多信息可以去滚动呀……很多余啊」
           ⇒ 我改成"面板自身不滚、滚动权交给内层 body"。
     批 W：用户图三「你图片生成这边的**画面尺寸下面是被截断的**呀」——
           那个写法里 `max-height: inherit` 继承的是面板的**像素值**，而面板当时 `overflow: visible`，
           内容一长就顶出视口、**下面被切掉且滚不到**（比一条多余的滚动条严重得多）。
     ⇒ 现在：**面板自己滚**（该滚的时候能滚），用"给面板补 6px 下内边距把那个小箭头收进内边距盒"
      的办法消掉假滚动条 —— 两个诉求同时满足，不需要二选一。 */
  /* ═══ 2026-09-25 批 BG：**判据随用户口径更新**（不是放宽）═════════════════════════════════════
     用户原话：「右边的两条**可以拉动的滚动条**，我一直叫你把它们删掉呀。因为你现在张开了这两个面板，
     已经能够展示出所有的信息点了，你为什么还要有这条滚动条呢？更何况你这条滚动条**还超框了**。」
     事实也变了：实测那条滚动条来自"面板底部 6px 内边距 + 探出的小箭头"造成的 **9px 溢出**
     （内容本身装得下），面板并不需要滚。
     ⇒ 判据改成：**仍然保留 overflow-y: auto**（真该滚的时候必须能滚，这条不许退）+
        **scrollbar-width: none**（不再画那根杠）。 */
  assert.match(visualCss, /\.visual-config-panel \{ overflow-y: auto; padding-bottom: 6px; scrollbar-width: none; \}/,
    '面板自己滚（该滚时必须能滚）+ 不显示滚动条（用户要求删掉那两条杠）');
  assert.doesNotMatch(visualCss, /\.visual-config-panel \{ overflow: visible; \}/, '不许再回到"面板不滚"的写法（内容会被截断）');
  assert.match(visualCss, /\.visual-config-panel-body \{ max-height: none; overflow-y: visible; \}/, '内层不再抢占滚动权');
  const cls = (videoCss.match(/\.video-config-panel,\s*\.video-inline-menu \{[\s\S]*?\}/) || [''])[0];
  assert.match(videoCss, /\.video-config-panel-body \{ max-height: inherit; overflow-y: auto; \}/, '视频侧面板仍按同一个口径处理内容滚动');
  /* ═══ 2026-09-24 批 BB：这一条**改判**（用户改向 + 事实变了），不是放宽 ══════════════════════════
     用户本轮原话：「你现在视频生成的配置面板的这个**模型选择这里完全是乱码的**。我都跟你说过
     要去解决啦，你为什么没有解决呢？」
     根因就在原来这条判据要的写法上：`.video-config-panel, .video-inline-menu { overflow: visible }`
     把上面 342 行那条 `max-height: min(58vh,460px)` 的滚动**关掉了** ——
     两者合起来 = "限高但不可滚"，模型 12 档一超过 460px 就整排画到白底面板外面（用户看到的乱码）。
     ⇒ 拆开：**配置面板**（它的箭头要溢出面外）继续 `visible`；**模型下拉**自己滚。
       守的东西没变：面板该滚时必须能滚、且不许把内容截断。 */
  /* 批 BF：同上一条 —— 两侧一起改成 20，守的仍是"同一条容器语言"。 */
  assert.match(cls, /border-radius: 20px;/, '视频侧浮层与图片侧同一条容器语言（圆角 20）');
  assert.match(videoCss, /\.video-config-panel \{ overflow: visible; \}/, '配置面板保持 visible（它的箭头要溢出面外）');
  assert.match(videoCss, /\.video-inline-menu \{\s*overflow-x: hidden;\s*overflow-y: auto;/,
    '模型下拉必须自己滚（限高不可滚 = 用户报的"乱码"）');
});

test('⑥ 首页暖区留白照图片侧（8px 10px 10px），且首页不再渲染「代为撰写」', () => {
  assert.match(videoCss, /\.video-composer-surface \{\s*padding: 8px 10px 10px;/, '暖色面内边距照图片侧的 8/10/10');
  assert.match(videoPage, /\{!homeComposer && <button type="button" className="video-dawei-entry"/, '「代为撰写」只在非首页那一档渲染');
});

/* ═══ 2026-09-25 批 BF：子页面顶栏的品牌标要**跟首页同一条中线**（用户原话，逐字）══════════════
   「我不明白你为什么这里的 LOGO 要放到右边去？你不能够**跟其他的页面一样，放到左边导航栏的
    左上角这里**吗？为什么他要区别对待呢？」
   实测改前：子页面标 x=38（中线 55）、首页 x=31（中线 48）—— 差 7px 的根因是
   `.topbar-brand` 自己那条"居中于图标栏"的 margin 与 `.topbar-subpage-lead` 的整体左移**叠加**了。 */
test('⑩ 子页面品牌标与首页同一条中线（不再叠加那 7px 补偿）', () => {
  assert.match(shellCss, /\.topbar-subpage-lead \.topbar-brand \{ margin-left: 0; \}/,
    '子页面那一格里的品牌标必须把自身的居中补偿清零');
  /* ═══ 2026-09-25 批 BL：**判据跟着实现改**（事实变了 + 用户改向，守的东西没变）══════════════════
     事实变了：批 BS 按用户新批注（「返回按钮为什么做的这么左呢？你应该跟工作台的最左边做一个对齐」）
     把这一格的做法换了 —— **品牌标改成绝对定位**（装饰节点、aria-hidden），**「返回」留在流里**
     自然落在工作台左沿；整格不再靠负 margin 左移。旧判据要的 `margin-left: calc(-1 * (...)) ` 写法
     已经不存在 ⇒ 它会让测试红（批 BS 自己的发版就是红在这一条）。
     守的东西一字未变：**标的中线锁在左导航列中线上**（= x 48）。只是改按新实现来验：
     绝对定位 + 左沿 = 侧栏中线 − **当前标半径**（两态都成立）。 */
  assert.match(shellCss, /\.topbar-row\.is-subpage \.topbar-subpage-lead \.topbar-brand \{[\s\S]*?left: calc\(var\(--sb-app-sidebar-w, 96px\) \/ 2 - var\(--bb-mark-r, 19px\)\);/,
    '子页面标钉在左导航列中线上（用当前半径算：默认 48−19、滚动后 48−13，两态中线都是 48）');
  assert.match(shellCss, /\.topbar-subpage-lead \{[\s\S]*?margin-left: 0;/,
    '「返回」留在文档流里（批 BS 的要求：与工作台左沿对齐 —— 实测 120 = 120）');
});

/* 批 BS 那条要求的判据（用户原话：「返回按钮为什么做的这么左呢？你是不是应该跟工作台的最左边
   做一个对齐呢？」）—— 补上它，免得实现又被改回去。 */
test('⑩b 子页面「返回」与工作台左沿对齐', () => {
  assert.match(shellCss, /\.topbar-subpage-lead \{[\s\S]*?margin-left: 0;/,
    '整格不再靠负 margin 左移（否则「返回」会被拖到工作台左边之外）');
  assert.match(shellCss, /\.topbar-row\.is-subpage \{ position: relative; \}/,
    '子页面这一行要定位上下文（品牌标绝对定位挂在它下面）');
});

test('⑦ 各子页面里那颗重复的「一键解析商品信息」不再渲染', () => {
  assert.match(creation, /parseAction=\{null\}/, '调试点不再传 parseAction（那一颗按用户口径整块删除）');
  assert.doesNotMatch(creation, /parseAction=\{parseSpec \?/, '不许又把它接回去');
  /* 说明文案里也不许再指向一颗不存在的按钮 */
  const notices = creation.match(/[^\n]*一键解析商品信息[^\n]*/g) || [];
  assert.deepEqual(notices, [], '文案里不得再让用户去点「一键解析商品信息」：' + notices.join(' | '));
});

test('⑨ 视频子页面左栏的**分区语言**（无嵌套白卡 / 浅灰子卡 / 虚线框）', () => {
  const wbCss = read('src/components/media/VideoWorkbench.css');
  /* 用户：「像我们这个爆款复刻的这个子页面……**这工作台是两回事**啊」——
     实测知渔 /video-recreation：每块是一张白卡（#fff / 0.8px #e5e7eb / 圆角 19.84 / 内边距 24.8），
     要求清单与只读胶囊再套一层 #f8fafc 浅灰子卡，上传框是 2.4px 虚线 #b8b8b8 圆角 14。 */
  /* ═══ 2026-09-26 批 BZ：这两条**改判为"不要白卡"**（用户改向，逐字）═══════════════════════════
     用户原话：「你这不还是**嵌了很多层的框**吗？为什么我叫叫你改你不改呢，是不是视频生成的各个工作台
     都有这个问题啊」——工作台左栏本身已经是一张白卡，块再各套一张白卡就是卡里套卡。
     ⇒ 判据翻成反向：**block 自己不许有描边/白底/圆角**，块间用发丝线 + 留白分隔（图片侧同一套）。
     ⚠️ 判据没有放宽：虚线框、浅灰子卡（.video-wb-notes/.video-wb-tags）、左栏无暖色底三条一个字没动。 */
  assert.match(wbCss, /\.video-wb-block \{\s*padding: 0;\s*border: 0;\s*border-radius: 0;\s*background: transparent;\s*\}/,
    'block 不许再是白卡（用户在批 BZ 明确否掉"嵌了很多层的框"）');
  assert.match(wbCss, /\.video-wb-block \+ \.video-wb-block \{\s*padding-top: 20px;\s*border-top: 1px solid var\(--sb-border-subtle\);\s*\}/,
    '块间用发丝线 + 留白分隔（不是整圈描边）');
  assert.match(wbCss, /\.video-workbench-blocks \{ display: grid; gap: 16px; \}/, '卡与卡之间 16 间距');
  assert.match(wbCss, /\.video-wb-notes, \.video-wb-tags \{[\s\S]{0,160}background: var\(--sb-surface-sunken\);/, '清单/胶囊套浅灰子卡（凹槽底 token）');
  assert.match(wbCss, /\.video-wb-upload \{[\s\S]{0,320}border: 2\.4px dashed var\(--sb-border-strong\);/, '上传框虚线照他们实测的形态（2.4px 粗虚线）');
  /* 左栏不再压一层暖色盒子（那是"两回事"最刺眼的一条） */
  assert.match(videoCss, /\.video-composer\.is-workbench \{[\s\S]{0,240}background: none;/, '子页面左栏不再有暖色底');
});

test('⑩ 上一批的四条判据仍然成立（回归）', () => {
  /* 顶栏不压缩 / 试一试无毛玻璃 / 面板同一档宽 / 面板吸附 —— 都是本轮用户点名过的 */
  assert.doesNotMatch(shellCss, /\.app-topbar\.is-compact \{[^}]*padding-top/);
  assert.doesNotMatch(rowCss, /\.skill-entry-try \{[^}]*backdrop-filter/);
  assert.match(videoPage, /const preferred = key === 'settings' \? 480/);
  assert.match(videoPage, /window\.addEventListener\('scroll', followButton, true\)/);
});

test('⑧ AI 分析结论自动落进「门店信息」那一格（用户：「可以吧，让它自动落进去」）', () => {
  /* 纯函数：喂一份 plan，断言该进四段的进了、空的不留空段 */
  const text = planToContextText({
    summary: '街边小店，暖光',
    creativeStrategy: '以货架与手作为主',
    assets: [{ name: '门店照', role: '环境', observations: ['木质货架', '暖黄灯'], use: '开场' }],
    beats: [{ time: '0-3s', label: '推门', detail: '镜头从门把手推进店内' }],
    optimizedPrompt: '（这一段不该出现在背景信息里）',
  });
  assert.match(text, /一、门店基础视觉信息/, '第一段照占位原文');
  assert.match(text, /街边小店，暖光/, 'summary 进第一段');
  assert.match(text, /二、空间环境细节[\s\S]*木质货架/, '素材观察进第二段');
  assert.match(text, /三、可复用探店镜头提示词素材库[\s\S]*推门/, '分镜进第三段');
  assert.match(text, /四、信息校验备注[\s\S]*可直接修改/, '第四段如实写"可直接改"');
  assert.doesNotMatch(text, /optimizedPrompt|这一段不该出现/, '提示词正文不进这一格（那是补充说明的活）');
  /* 空 plan：一个字都不写（不留空段） */
  assert.equal(planToContextText({}), '', '空 plan 不产出空壳文案');
  assert.equal(planToContextText(null), '');
  /* 接线：分析成功后写进那一格，且**只在为空时**写 */
  assert.match(videoPage, /const filled = planToContextText\(result\.plan\);/, '分析成功后调用它拼文本');
  assert.match(videoPage, /String\(current\[contextBlock\.key\] \|\| ''\)\.trim\(\) \? current : \{ \.\.\.current, \[contextBlock\.key\]: filled \}/,
    '只在那一格为空时写（绝不覆盖用户已写的内容）');
  /* 这一格必须是声明源里真实存在的块（不是页面里硬造的） */
  const tour = VIDEO_WORKBENCHES['video.store_tour'];
  const contextBlock = tour.blocks.find(block => block.kind === 'text' && block.key !== 'prompt');
  assert.ok(contextBlock, '探店漫游要有一个"非主文本格"作为落点');
  assert.match(contextBlock.placeholder, /一、门店基础视觉信息/, '占位照知渔那一页的四段式');
});
