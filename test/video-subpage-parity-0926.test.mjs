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

test('CB-① 左栏两侧内缩必须相等（滚动条槽位两边都留）', () => {
  const css = read('src/components/media/WorkbenchShell.css');
  const hits = [...bare(css).matchAll(/scrollbar-gutter:\s*([^;]+);/g)].map(m => m[1].trim());
  assert.ok(hits.length >= 2, '左栏两种形态各有一条 scrollbar-gutter');
  hits.forEach(v => assert.match(v, /stable both-edges/, `只写 stable 会让右内缩多一条滚动条的宽：实测左 42 / 右 53（${v}）`));
});

test('CB-② 脚本框与区块同宽同边，且桌面上要够高（吃掉下方空白）', () => {
  const css = read('src/components/media/VideoWorkbench.css');
  const body = ruleBody(css, '.video-wb-block .video-wb-prompt');
  assert.ok(body, '工作台里必须把基类的 `margin: 0 16px 14px; width: calc(100% - 32px)` 归零');
  assert.match(body, /margin:\s*0/, '基类的左右 16 外边距会把框挤得左右留白还对不齐');
  assert.match(body, /width:\s*100%/);
  const media = ruleBody(css, '@media (min-width: 1024px)');
  assert.ok(media && /min-height:\s*2\d\dpx/.test(media), '桌面档要给一个 ≥200px 的 min-height —— 用户「框太小」与「下面一大片留白」是同一件事');
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

test('CD-① 已回退：右栏挂载点/portal 不在仓库里（原因见 RTK，别当成"没做过"）', () => {
  /* 2026-09-27：CD 把「生成记录」portal 进右栏的方案**做通过**（探针 + 门禁都绿），但提交时
     `src/pages/VideoStudio/index.jsx` 正被并行的另一条线改到一半（`setRestoredAssets` 的调用点已进、
     声明未进）⇒ 产物在视频子页面抛 ReferenceError、e2e 判红 ⇒ 已回退。等那个文件稳定后按 RTK 配方重落。
     所以这一条现在守的是**回退后的状态**，而不是"没做过"。 */
  const shell = read('src/components/media/WorkbenchShell.jsx');
  assert.doesNotMatch(shell, /data-history-host/, '回退后 shell 里不该还有挂载点');
  const page = read('src/pages/VideoStudio/index.jsx');
  assert.doesNotMatch(page, /videoHistoryBlock|historyHost/, '回退后不该还有 portal 变量');
  assert.match(page, /className="video-history"/, '原样内联渲染的那段必须还在（e2e 靠它认全量任务）');
  assert.match(page, /批 CD 曾把它 portal 进右栏历史区/, '回退的**原因**必须留在代码里，否则下一个人会以为从没做过');
});

test('CB-⑦ 站内叫法统一：独立创作台那颗入口也叫「生成脚本」（类名不变）', () => {
  const page = read('src/pages/VideoStudio/index.jsx');
  const entry = page.match(/video-dawei-entry[\s\S]{0,400}?<\/button>/);
  assert.ok(entry, '找不到 .video-dawei-entry 入口');
  assert.doesNotMatch(entry[0], /代为撰写/, '给用户看的字必须是站内叫法');
  assert.match(entry[0], /生成脚本/, '与工作台里那颗付费动作同名');
});
