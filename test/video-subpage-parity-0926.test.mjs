/* ═══ 2026-09-26 批 CB 门禁：视频子页面工作台的"适配"与"对齐" ═════════════════════════════════
   用户本轮批注（逐字）：
   ① 「你这个框为什么会适配的这么差呀？就是你这个框左右两边都有一些留白呀，然后也没有做的很正。」
   ② 「你看你下面一大片的留白，我不是跟你说过你要调整吗？你也没去调整呀。」
      「然后你这个框也实在是太小了吧。」
   ③ 「你这两个按钮的适配也做的不好呀，还有你这个模型的选项的这个按钮为什么这么短呢？」
   ④ 「什么叫代为撰写呀？我们这里把代为撰写已经改了一个称呼了呀。你这里不是有一个叫生成脚本的
      按钮吗？…他们不是还有一个放大的按钮吗？你这个按钮也没有做上去呀？图片生成那边我记得是有的呀。」
   ⑤ 「你这个生成脚本按钮为什么要做的那么大呢？」
   数值来源：.qa/cb-diag.mjs（1440 视口 /video-creation?id=video.smart）实测。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const bare = css => css.replace(/\/\*[\s\S]*?\*\//g, '');
const ruleBody = (css, sel) => {
  const i = bare(css).indexOf(sel);
  return i < 0 ? null : bare(css).slice(i, bare(css).indexOf('}', i));
};

test('CB-① 左栏滚动槽位：只保右侧（判据 2026-09-27 批 CH 由用户改向推翻）', () => {
  /* 判据改判（用户改向，逐字）：
     原话「我不太明白你为什么现在工作区域的右边会有**两条这种上下拉的滑动轨道**呢？你里面这条
     滑动轨道，我不管怎么滑都发现**没有什么意义**呀。」—— 那条"没意义"的轨道就是 `both-edges`
     在左侧预留的空槽。⇒ 退回 `stable`（只保右槽），代价是右边多 11px 的滚动条宽（两者不可兼得）。
     ═══ 2026-09-28 批 CY-⑦：上一版在这里写着"真正的对称要把内边距挪到内层包裹元素上（记在 RTK）"，
     这句**本批撤回**（量过之后才敢下这个结论）：
       ① 那个结构性改动**不改变任何可见结果** —— 现在栏 120..557、滚动条占 546..557（在内边距之外）、
          滚动区 120..546、左右内边距各 20 ⇒ 内容 140..526；把内边距挪进内层包裹元素后内容**还是 140..526**。
       ② 照抄口径：知渔那一栏**滚动条同样占 11px**（`.qa/cy7-quantv-scrollbar.mjs`，CDP 只读实测：
          570 宽 / padding 19.84 / `scrollbar-width: thin` / `gutter: auto`）⇒ 这 11px 是竞品也这样。
     ⇒ `stable` 留着（换来"换技能时内容不跳"），11px 的差**不动**；`video-subpage-parity` 与
       `WorkbenchShell.css` 的注释都已同步。 */
  const css = read('src/components/media/WorkbenchShell.css');
  const hits = [...bare(css).matchAll(/scrollbar-gutter:\s*([^;]+);/g)].map(m => m[1].trim());
  assert.ok(hits.length >= 2, '左栏两种形态各有一条 scrollbar-gutter');
  hits.forEach(v => assert.equal(v, 'stable',
    `both-edges 会在左侧留一条"滑了没意义"的空槽（用户点名）；只保右槽：${v}`));
});

test('CB-② 脚本框与区块同宽同边，且高度与图片侧同一档（判据 2026-09-27 批 CH 由用户改向推翻）', () => {
  const css = read('src/components/media/VideoWorkbench.css');
  const body = ruleBody(css, '.video-wb-block .video-wb-prompt');
  assert.ok(body, '工作台里必须把基类的 `margin: 0 16px 14px; width: calc(100% - 32px)` 归零');
  assert.match(body, /margin:\s*0/, '基类的左右 16 外边距会把框挤得左右留白还对不齐');
  assert.match(body, /width:\s*100%/);
  /* 判据改判（用户改向）：原本要求"桌面档 ≥200px 把下方空白吃掉"，但用户随即问
     「你的提示词框你确定是这个大小吗？图片生成那边也是这个大小吗？」——
     ⇒ 与图片侧（`textarea.media-field-control` 的 150）统一为一档；要更高就两边一起提。 */
  assert.match(body, /min-height:\s*150px/, '与图片侧多行字段同一档 150（要更高必须两边一起提）');
  assert.doesNotMatch(bare(css), /min-height:\s*2\d\dpx/, '不许再单方面把视频侧抬到 200+（那正是两边不一致的来源）');
});

test('CB-③ 模型按钮：图标底座不许抢空间，名字必须完整显示', () => {
  const css = read('src/pages/VideoStudio/VideoStudio.css');
  const mark = ruleBody(css, '.video-config-trigger > .video-model-mark');
  const copy = ruleBody(css, '.video-config-trigger > .video-model-copy');
  assert.ok(mark && /flex:\s*0 0 auto/.test(mark), '图标底座是 `<span>`，会被 `.video-config-trigger > span { flex: 1 }` 拉走自由空间（实测 47px，图标只有 25）');
  assert.ok(copy && /flex:\s*1 1 auto/.test(copy) && /min-width:\s*0/.test(copy),
    '自由空间要明确交给文案层，否则「Seedance」被 ellipsis 成「Seedanc…」');
});

test('CB-④ 付费动作按钮跟着文字走（不再是一条 342 宽的通栏）', () => {
  const css = read('src/components/media/WorkbenchShell.css');
  const item = ruleBody(css, '.media-workbench-paid-item');
  const paid = ruleBody(css, '.media-workbench-paid {');
  assert.ok(item && /flex:\s*0 0 auto/.test(item), '`flex: 1 1 220px` 会在任何 >220 的栏里拉满（实测 342x45）');
  assert.ok(paid && /width:\s*auto/.test(paid), '按钮宽度随内容，不再是 width: 100%');
  assert.ok(/\.media-workbench-paid-note\s*\{/.test(bare(css)), '下面那行说明的样式不能被顺手删掉');
});

test('CB-⑤ 占位文案用站内叫法（不许再出现「代为撰写」），且知渔锚点逐字保留', () => {
  const src = read('src/skills/videoWorkbenches.js');
  const placeholders = [...src.matchAll(/placeholder:\s*'([^']*)'/g)].map(m => m[1]);
  assert.ok(placeholders.length > 0, '扫不到占位文案 = 断言空转');
  placeholders.forEach(p => assert.doesNotMatch(p, /代为撰写/, `占位里还留着知渔的叫法：${p}`));
  const smart = placeholders.find(p => p.startsWith('输入视频脚本'));
  assert.ok(smart, '视频创作那一页的占位必须在');
  assert.match(smart, /^输入视频脚本，使用 @ 指定参考素材，或/,
    '前 22 个字是 quantv-video-parity-machine 逐字照抄知渔的锚点，不许动');
  assert.match(smart, /生成脚本/, '要指向站内那颗按钮的名字');
});

test('CB-⑥ 视频侧也要有「放大」（与图片侧同一形态、同一套类名）', () => {
  const jsx = read('src/components/media/VideoWorkbench.jsx');
  /* 批 CP 起：那颗按钮由共用组件 PromptMetaRow 渲染（类名 .media-field-meta-expand）——
     判据守的那件事没变：放大要在、要复用**同一套**类名/样式。 */
  assert.match(jsx, /<PromptMetaRow/, '放大按钮由共用那行渲染（批 CP 合并）');
  const shared = read('src/components/media/PromptMetaRow.jsx');
  assert.match(shared, /className="media-field-meta-expand"/, '放大按钮复用同一套类名（两边一份样式）');
  assert.match(jsx, /createPortal/, '放大框走 portal（与图片侧 TextareaControl 同法）');
  assert.match(jsx, /media-field-expand-modal/, '放大框的外层类名与图片侧一致');
  assert.match(jsx, /media-field-expand-body/, '放大框的内容类名与图片侧一致');
  assert.match(jsx, /is-expanded-field|media-field-expand-body[\s\S]{0,200}MentionPromptField/,
    '放大框里的编辑器仍走 MentionPromptField，不能换成裸 textarea（会把 @ 标记露出来）');
  const css = read('src/components/media/WorkbenchShell.css');
  assert.ok(ruleBody(css, '.media-field-expand-body .mention-prompt-field'),
    '放大框里的 contenteditable 也要有高度，否则比原框还矮');
});

test('CB-⑧ 底栏两颗控件在任何视口都必须同宽（模型那颗是弹性子项，basis 会顶掉 width）', () => {
  const css = read('src/pages/VideoStudio/VideoStudio.css');
  const wrap = ruleBody(css, '.video-composer.is-workbench .video-inline-control {');
  assert.ok(wrap && /width:\s*100%/.test(wrap),
    '包装层（.video-quick-tools 是 display:contents，真正的网格子项是它）必须撑满它那一格');
  const inner = ruleBody(css, '.video-composer.is-workbench .video-inline-control > .video-config-trigger');
  assert.ok(inner && /flex:\s*1 1 auto/.test(inner),
    '`.video-config-trigger` 的 `flex: 0 1 180px` 会让 flex-basis 顶掉 width：不 grow 就停在 180（实测 vw=900 时 180 vs 362）');
});

test('CB-⑨ 三步方案弹窗的视频侧抬头也是站内叫法（图片侧「生成预览」不动）', () => {
  const src = read('src/components/plan-preview/PlanPreviewDialog.jsx');
  const video = src.match(/video:\s*\{[\s\S]*?entry:\s*'([^']*)',\s*confirmTitle:\s*'([^']*)'/);
  assert.ok(video, '找不到 video 那份 COPY');
  assert.equal(video[1], '生成脚本', '入口抬头必须与那颗按钮同名（原来照抄知渔的「代为撰写」）');
  assert.match(video[2], /生成脚本/, '计费确认那一屏的标题同理');
  const image = src.match(/image:\s*\{[\s\S]*?entry:\s*'([^']*)'/);
  assert.ok(image && image[1] === '生成预览', '图片侧本来就是「生成预览」，不许被顺手改掉');
});

test('CG-① 「生成记录」在右栏历史区（不是删掉，是搬走）—— 批 CD 回退后于批 CG 重落', () => {
  const shell = read('src/components/media/WorkbenchShell.jsx');
  assert.match(shell, /data-history-host/, '右栏要有一个挂载点');
  assert.match(shell, /className="media-workbench-history-host"[^>]*hidden=\{activeTab !== 'history'\}/,
    '挂载点必须**常驻**（e2e 在默认「示例」页签下就断言 .video-history 存在），切页签才显示');
  const page = read('src/pages/VideoStudio/index.jsx');
  assert.match(page, /createPortal\(videoHistoryBlock, historyHost\)/, '视频侧要把同一段标记 portal 进右栏');
  assert.match(page, /const videoHistoryBlock = \(\s*<div className="video-history">/,
    '类名与结构不许改（e2e / 门禁按 .video-history 找；它是全部视频任务的唯一入口）');
  assert.match(page, /document\.querySelector\('\[data-history-host\]'\)/, '挂载点要在 effect 里取（首帧没有 DOM）');
  const css = read('src/pages/VideoStudio/VideoStudio.css');
  assert.ok(ruleBody(css, '.media-workbench-pane .video-history'),
    '搬进 pane 之后要把左栏那套外边距/分割线归零（否则右栏里飘着一条线和一层缩进）');
});

test('CP-① 那一行两个板块共用一份（图片侧从此也有 @ / 放大 / 字数）', () => {
  /* 用户原话（逐字）：「这个按钮图片生成那边应该是没有的，如果你这边要做的话，那边是不是也可以考虑
     做呢？」「同等级的东西，你应该**同等级的去进行设计**呀。」实测（.qa/cp-meta-row.mjs）：
     视频侧 `.media-field-meta` 三件套 = @ / expand / count，且在提示词框**下方**；
     旧的框内绝对定位放大按钮（`.media-field-expand`）两侧都不再渲染。
     ═══ 2026-09-28 批 CY：@ 那一颗**不再是本文件自己写的**，改成全站共用的 `ImageMentionPicker` ═══
     用户原话（逐字）：「我现在要求你把整个网站里面所有的这种 @ 按钮，就是不管是首页或者各种子页面
     或者画布里面涉及到的这个按钮，你都要**统一同一个类型的标准**。」「你看首页图片生成这边就是有的。
     他这个 @ 按钮的逻辑会更正确……包括张开的面板是**向上**的。」
     ⇒ 判据从"本组件里有 `.media-field-meta-at`"改成"本组件用的是共用件"（旧类名的 CSS 已删）。 */
  const shared = read('src/components/media/PromptMetaRow.jsx');
  assert.match(shared, /className="media-field-meta"/, '共用组件要有那一行');
  assert.match(shared, /import ImageMentionPicker from '\.\.\/creation\/ImageMentionPicker\.jsx'/, '@ 必须来自全站共用件（批 CY 统一）');
  assert.match(shared, /<ImageMentionPicker/, '@ 那一颗就是共用件本体（不是自己写的一套）');
  assert.match(shared, /media-field-meta-expand/, '放大按钮');
  assert.match(shared, /media-field-meta-count/, '字数');
  assert.doesNotMatch(shared.replace(/\/\*[\s\S]*?\*\//g, ''), /media-field-meta-at-menu/,
    '批 CY 起不许再自建 @ 菜单（往下开、纯文字的那套）—— 注释里留案底不算');
  const field = read('src/components/media/FieldRenderer.jsx');
  assert.match(field, /<PromptMetaRow/, '图片侧（多行字段）要用它');
  assert.match(field, /const uploadedAssets = Object\.values\(values \|\| \{\}\)/, '图片侧的素材来源＝这条技能里已上传的字段值');
  /* ⚠️ 2026-09-29 批 DC 续-16：TextareaControl 多收了一个 `surfaceAction`
     （锁住态时浮在框表面那颗付费动作，见 FieldRenderer 的 gated 判据）。
     这条断言守的是"素材一路传到 TextareaControl"，所以**只盯 assets 那一段**，
     不要再锚死到 ` />` —— 加任何一个 prop 都会把它判红，而那不是它要守的东西。 */
  assert.match(field, /disabled=\{disabled\} assets=\{assets\}/, '素材要一路传到 TextareaControl');
  assert.doesNotMatch(field, /className="media-field-expand"/, '图片侧框内那颗旧的放大按钮要退役（会压住首行文字）');
  const video = read('src/components/media/VideoWorkbench.jsx');
  assert.match(video, /<PromptMetaRow/, '视频侧也用它（不许两套）');
  assert.doesNotMatch(video, /className="video-wb-at"/, '视频侧自己那套 .video-wb-at 要退役');
  const shell = read('src/components/media/WorkbenchShell.css');
  assert.ok(ruleBody(shell, '.media-field-meta {'), '样式只有一份（在 WorkbenchShell.css）');
  assert.ok(ruleBody(shell, '.media-field-meta-expand {'), '放大按钮在这一行里是普通按钮（不绝对定位）');
});

test('CW-① 字数：**页面显示的数 = 真正能输入的数**（用户拍板）', () => {
  /* ═══ 2026-09-27 批 CW：**用户拍板**（原话逐字）═══════════════════════════════════════════════
     「字数上限既然只能8000，那就计数显示也只写8000呀。为什么你要走不一样的方式呢？
      **实际是多少就写多少呀**。」
     背景（批 CS 量的实测）：脚本块声明 `max: 10000`（照知渔页面上写的数），而真的截断在
     `VIDEO_PROMPT_MAX_LENGTH = 8000` ⇒ 页面写 `0 / 10000`、用户只能打到 8000，
     同一页放大弹窗分母还写 8000 —— **一处三样**；而声明 2000 的补充说明反过来（门槛 2000 就提示、
     实际能打到 8000）。用户口径：全页只认一个数。 */
  const video = read('src/components/media/VideoWorkbench.jsx');
  assert.match(video, /const limit = declaredLimit > 0 && globalLimit > 0[\s\S]{0,40}Math\.min\(declaredLimit, globalLimit\)/,
    '必须按 min(区块声明的 max, 全局上限) 算出**唯一**的那个数');
  assert.match(video, /<PromptMetaRow[\s\S]{0,220}maxLength=\{limit\}/, '框下那一行的分母 = limit');
  assert.match(video, /<MentionPromptField[\s\S]{0,200}maxLength=\{limit\}/, '输入框的截断 = limit（同一个数）');
  assert.match(video, /<span>\{text\.length\}\/\{limit\}<\/span>/, '放大弹窗的分母 = limit（不许再写 maxLength）');
  assert.ok(!/maxLength=\{counterMax \|\| maxLength\}/.test(video),
    '不许再出现 `counterMax || maxLength`（那正是"显示 10000、实际 8000"的写法）');
  /* 实测（.qa/cs-motion-and-counter.mjs）：video.smart 显示 0/8000、塞 9500 只剩 8000；
     video.product_motion 显示 0/2000、塞 3000 只剩 2000；图片侧三处都是 2000。 */
});

test('CO-① 脚本框右下角的拉高手柄（图片侧是原生手柄，视频侧自己做同位置同用途）', () => {
  /* 用户原话（逐字）：「你的提示词框的右下角在图片生成那边，它不是有一个可以**拉动高度**的一个按钮吗？
     为什么你图片生成这边又没有呢？……同等级的东西，你应该同等级的去进行设计呀。」
     实测（.qa/co-resize.mjs，1440 视口）：手柄 18×18 落在框的右下角内；
     拖 +120 ⇒ 框 244 → **364**；往上拖很多 ⇒ 夹在**下限 150**（与图片侧 min-height 同一档）。 */
  const jsx = read('src/components/media/VideoWorkbench.jsx');
  assert.match(jsx, /className="video-wb-resize"/, '右下角要有手柄元素');
  assert.match(jsx, /Math\.max\(150, Math\.min\(720, /, '拖动要有上下限（150 ~ 720）');
  assert.match(jsx, /onPointerDown=\{disabled \? undefined : startResize\}/, '禁用态不给拖');
  const css = read('src/components/media/VideoWorkbench.css');
  assert.match(ruleBody(css, '.video-wb-resize {') || css, /cursor:\s*ns-resize/, '光标要提示可上下拖');
  assert.match(css, /\.media-field-textarea\.is-resized \.video-wb-prompt \{ flex: 0 0 auto; height: var\(--video-prompt-h/, '拖动后要脱离"被撑满"那份伸缩、按设定高度走');
});

test('CN-① 脚本框吃掉尾部那段死空白（用户两次问「这块留白是要干什么呢？」）', () => {
  /* 实测（.qa/cn-blanks.mjs，1440 视口）：内容区 619 高、最后一个块只到 662 ⇒ 框下 **73px 死空白**
     （视频侧内容区是 flex 撑满的 —— 为了把 CTA 钉在最底部；图片侧是普通滚动流，没有这段）。
     ⇒ 规则：让带脚本框的那一块吃掉它（最小仍是与图片侧同档的 150px）。
     ⚠️ 第一次只写了 `.video-content-composer` 是够不着块的（真正的容器是 section.video-workbench-blocks
        与里面的 .media-workbench-fields）—— 块没长、空白反而从 73 变成 108；两层都接上才对。 */
  const css = read('src/components/media/VideoWorkbench.css');
  const need = [
    '.video-composer.is-workbench .video-content-composer',
    '.video-composer.is-workbench .video-workbench-blocks {',
    '.video-composer.is-workbench .video-workbench-blocks > .media-workbench-fields',
    '.video-composer.is-workbench .video-wb-block:has(.video-wb-prompt)',
    '.video-composer.is-workbench .video-wb-prompt { flex: 1 1 auto; }',
  ];
  need.forEach(sel => assert.ok(bare(css).includes(sel), `缺少这一层：${sel}（少一层块就吃不到那段空白）`));
  assert.match(ruleBody(css, '.video-wb-block .video-wb-prompt'), /min-height:\s*150px/,
    '伸缩的下限仍是与图片侧同一档 150px');
});

test('CY-① 「生成脚本」在**脚本字段标题行右端**（与图片侧「一键润色卖点」同位置同类名）', () => {
  /* ═══ 批 CY-①：**用户改向**（批 CM 的落点被推翻）═══════════════════════════════════════════════
     批 CM 的判据是"脚本块里不许渲染、搬到页面底部动作区"，依据是当时那句「跟图片生成里面那个一键分析的
     按钮是同等级的东西」；用户现在对着两页截图重新指定了位置（原话逐字）：
       「你看你图片生成这边的**一键润色**的按钮是在**这个位置**。可是你视频生成那边的**生成脚本**那个按钮
        为什么不是在这个位置呢？我已经跟你强调过很多次了，他们是**同个等级**的东西呀。」
     ⇒ 位置改成「**字段标题行右端**」（图片侧那颗由批 O-⑪ 定在字段标签右端），且**共用同一套类名**：
       `.media-field-inline-actions` 容器 + `.media-workbench-inline-action` 按钮 + `<em>` 价格。
     撤掉的只是**位置**，不是功能：点它仍然走同一条 `onRunAction('script')` → `runDawei`。
     实测（`.qa/cy-script-row.mjs`）：脚本块标题行 = 「脚本」+ 一颗「生成脚本 0.5 积分」；底栏那颗不再有。 */
  const wb = read('src/components/media/VideoWorkbench.jsx');
  assert.match(wb, /const headerAction = block\.action && block\.action\.key === 'script' \? block\.action : null/,
    'script 动作要被单独认出来（只有声明了它的技能页才渲染，别的技能页不该多一颗）');
  assert.match(wb, /<span className="media-field-inline-actions">/, '位置 = 字段标题行右端（图片侧同一套类名）');
  assert.match(wb, /className="media-workbench-inline-action"/, '按钮走图片侧那颗的样式类（不是另写一套）');
  assert.match(wb, /\{headerAction\.points != null && <em>\{headerAction\.points\} 积分<\/em>\}/, '价格用 <em>（与图片侧同一排版）');
  assert.match(wb, /onClick=\{\(\) => onRunAction\(headerAction\.key\)\}/, '点的还是原来那条链路');
  const page = read('src/pages/VideoStudio/index.jsx').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(page, /video-script-trigger/, '底栏那颗（批 CM 的落点）必须撤掉 —— 不许两处都在');
  assert.doesNotMatch(page, /const scriptAction = /, '为底栏那颗服务的 scriptAction 也要一起删（留着就是死变量）');
});

test('CL-① 配方提示词不再预填，但"用这组参数"的还原必须保留', () => {
  /* 用户改向（逐字）：「你现在这个提示词框里面依然是默认会有这段提示词出来…我现在只要一刷新页面，
     它这段提示词就会出现的。」⇒ 进子页面输入框必须是空的；历史还原那一份不受影响。
     实测（.qa/cl-prefill.mjs）：video.smart / video.product_motion / video.model_show 三条进去都是空框，
     而 data-video-recipe 仍带着各自的配方（断言锚点没丢）。 */
  const mc = read('src/pages/MediaCreation/index.jsx');
  assert.match(mc, /source: 'skill'/, '子页面传下去的那份配方 preset 必须带来源标记');
  const vs = read('src/pages/VideoStudio/index.jsx');
  assert.match(vs, /preset\.source !== 'skill'\) setPrompt\(preset\.prompt\)/,
    '只有**非配方**（历史还原 / 做同款）才允许写提示词');
  assert.match(vs, /data-video-recipe=\{preset\?\.prompt \|\| ''\}/, '配方仍要挂在页面上（断言锚点）');
});

test('CK-① 框下面那一行：@ / 放大 / 字数（同一行，且在框外面）', () => {
  /* 用户原话（逐字）：「你把 @ 和放大按钮，还有字数的限制是多少？这三个东西都**放到同一行**去，
     这样不是更好吗？」「你与其写这句描述，你不如跟首页那边的做法一样，就直接把它做成一个按钮，
     用户点击这个按钮就可以随时去 @ 我们现在上传的任意素材……变成蓝色的字体呀。」
     ⚠️ 批 CP 起，这一行由**共用组件 PromptMetaRow** 渲染（图片侧也要有同一行）——
        所以这里断言的是"视频侧用了共用组件 + 旧那句说明不再渲染"，具体三件套由 CP-① 守。 */
  const jsx = read('src/components/media/VideoWorkbench.jsx');
  assert.match(jsx, /<PromptMetaRow/, '框下面那一行要由共用组件渲染（批 CP 合并，不再各写一套）');
  assert.doesNotMatch(jsx, /video-wb-mention-hint\}>/, '旧那句「输入 @ 可引用 N 个素材」不再渲染');
  assert.doesNotMatch(jsx, /className="video-wb-at"/, '视频侧自己那套 .video-wb-at 已退役');
});

test('CI-① 按钮组的字段不许用 <label> 包（会把整格悬停转给第一颗按钮）', () => {
  /* 用户现场复现（逐字）：「我鼠标放到现在这个区域的右下角这块空白的地方，它第一个按钮的确会有一个
     灰色的显示……所有带按钮的区域只要我把鼠标放到这块区域的空地上，它的第一个按钮都会有这个灰色的
     交互出现。」复现路径 /image-creation?id=image.concept_set。
     实测（.qa/ci-hover-empty4.mjs）：空地点命中 `span.media-field-segmented`，而第一颗按钮
     `matches(':hover')===true`、底色由选中紫变悬停灰 ⇒ 根因是 `<button>` 是 labelable 元素，
     整格被 `<label>` 包住时浏览器把整格悬停转给第一个 labelable 后代。 */
  const jsx = read('src/components/media/FieldRenderer.jsx');
  assert.match(jsx, /const isOptionGroup = kind === 'segmented'/, '按钮组字段要单独识别出来');
  assert.match(jsx, /const Wrapper = isOptionGroup \? 'div' : 'label'/, '按钮组用 div，单控件字段继续用 label');
  assert.match(jsx, /role: 'group', 'aria-labelledby': labelId/, '换掉 label 之后语义要用 role=group + aria-labelledby 补回来');
  assert.match(jsx, /<span className="media-field-label" id=\{labelId\}>/, '标题要有 id 供 aria-labelledby 指过去');
});

test('CH-① 放大按钮与文字不再重叠（两个板块一起改）', () => {
  const css = read('src/components/media/WorkbenchShell.css');
  const body = ruleBody(css, '.media-field-textarea > .media-field-control');
  assert.ok(body, '带放大按钮的多行字段必须有这条通行空间规则');
  assert.match(body, /padding-right:\s*8\dpx/, '右侧要留出 ≥80px（按钮 63 + 内缩 10 + 余量）');
  assert.match(css, /\.media-field-textarea > \.mention-prompt-field/, '视频侧（contenteditable）用同一条，别只改一边');
  /* 实测（.qa/ch-diag.mjs）：改前视频侧字段 172,524/332 宽、按钮 431,534/63×30、文字可用右沿 489
     ⇒ 重叠=true；改后文字可用右沿 416 < 按钮左沿 431 ⇒ 重叠=false。图片侧同一颗粒子定位规则相同。 */
});

test('CB-⑦ 站内叫法统一：独立创作台那颗入口也叫「生成脚本」（类名不变）', () => {
  const page = read('src/pages/VideoStudio/index.jsx');
  const entry = page.match(/video-dawei-entry[\s\S]{0,400}?<\/button>/);
  assert.ok(entry, '找不到 .video-dawei-entry 入口');
  assert.doesNotMatch(entry[0], /代为撰写/, '给用户看的字必须是站内叫法');
  assert.match(entry[0], /生成脚本/, '与工作台里那颗付费动作同名');
});
