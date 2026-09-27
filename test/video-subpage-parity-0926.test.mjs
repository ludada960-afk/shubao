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
     在左侧预留的空槽。⇒ 退回 `stable`（只保右槽），代价是右边多 11px 的滚动条宽（两者不可兼得，
     真正的对称要把内边距挪到内层包裹元素上，记在 RTK）。 */
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
  assert.match(jsx, /className="media-field-expand"/, '放大按钮必须复用图片侧那颗的类名（同一套样式）');
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
