// test/canvas-video-controls-layout-0917.test.mjs
// 2026-09-17 用户批注（视频生成面板）：
//   ①「技能的这个按钮是歪的，直接歪上去了，而且它跟其他那四个按钮的规则都不一样：
//     其他那四个按钮的规则都是上面有标题、下面是一个选项，你这个都没有这个逻辑在。」
//   ②「@ 键不如直接放在最前面，就放在视频模型的前面。其他那些按钮都做得太宽了，
//     你要尽量再缩一下；那个技能又做得特别窄。你全部要重新再适配一遍。」
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studio = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');

function videoControlsBlock() {
  const start = studio.indexOf('className="ec-canvas-video-controls"');
  const end = studio.indexOf('ec-canvas-video-plan', start);
  return studio.slice(start, end > start ? end : start + 6000);
}

test('① 六项统一「标题在上 + 控件在下」两行结构（技能不再是没有标题的光板按钮）', () => {
  const block = videoControlsBlock();
  for (const label of ['视频模型', '清晰度', '画幅', '时长', '技能']) {
    assert.ok(new RegExp('<label[^>]*>' + label).test(block), label + ' 必须有标题并置于 label 内');
  }
  /* 技能必须是 <label>技能<CanvasSkillControl/></label> 结构，而不是裸的 CanvasSkillControl */
  assert.ok(/<label className="[^"]*">技能<CanvasSkillControl/.test(block),
    '技能必须包在带标题的 label 里（与其余项同结构）');
  assert.ok(!/(^|\n)\s*<CanvasSkillControl/.test(block), '技能不得再以裸组件形式直接排在进行里');
});

test('① 六个 label 共用同一条样式规则（同基线才会对齐）', () => {
  assert.ok(/\.ec-canvas-video-controls > label,\s*\n?\.ec-canvas-video-controls > \.ec-canvas-parameter-item \{/.test(css),
    'label 与技能容器必须共用同一条 grid/gap 规则');
  const rule = css.match(/\.ec-canvas-video-controls > label,[\s\S]{0,200}?\{([^}]*)\}/);
  assert.ok(rule, '必须能找到共用规则');
  assert.ok(/display:\s*grid/.test(rule[1]), '必须是 grid（标题行 + 控件行）');
  assert.ok(/gap:/.test(rule[1]), '标题与控件之间必须有统一步进');
});

test('② @ 键在参数行**最前面**（视频模型之前）', () => {
  const block = videoControlsBlock();
  /* 只看 JSX 标签顺序：@ 的 <label …is-mention…> 必须出现在「视频模型」这个 label 之前 */
  const mentionIdx = block.search(/<label[^>]*is-mention/);
  const modelIdx = block.indexOf('>视频模型<');
  assert.ok(mentionIdx > 0, '@ 必须作为 label 出现在参数行内');
  assert.ok(modelIdx > 0, '视频模型必须作为 label 出现在参数行内');
  assert.ok(mentionIdx < modelIdx, '@ 必须在视频模型之前（实测渲染顺序 引用 → 视频模型 → …）');
  /* 底栏不得再保留第二个 @（参数行里已经有一个了）。
     注意要定位**视频框自己的**底栏：文件里前面还有图片/文案框的 footer，
     直接 indexOf 会命中别人的。 */
  const videoStart = studio.indexOf('export function CanvasVideoComposer');
  const videoEnd = studio.indexOf('export function CanvasEcommerceComposer', videoStart);
  const videoOnly = studio.slice(videoStart, videoEnd > videoStart ? videoEnd : videoStart + 20000);
  const footerStart = videoOnly.indexOf('ec-canvas-composer-footer');
  assert.ok(footerStart > 0, '必须能找到视频框底栏');
  const footer = videoOnly.slice(footerStart, footerStart + 1200);
  assert.ok(!/<ComposerMention/.test(footer), '视频框底栏不得再有第二个 @');
});

test('② 整行不溢出（wrap + border-box + 宽度锁定）；换行不是溢出', () => {
  /* ═══ 2026-09-27 批 CU：**判据反转（用户改向）** ═════════════════════════════════════════════
     原来是「必须不换行（flex-wrap: nowrap）」——那是"槽位宽固定、放不下就整行溢出/被容器裁掉"的口径。
     用户原话（逐字）：「而且你这里现在这些**按钮区的适配现在也没有做好，很多部分，它现在都是
     **超出框的边界**的……像生成文案啊，生成图片啊，**生成视频**啊，他们那边应该也有这些类似的问题存在，
     那你都得去把他们给解决掉。」
     实测（`.qa/cu-overflow-diag.mjs`，面板压到 320px）：nowrap 下这一行最后三格分别**溢出 30 / 73 / 102px**。
     ⇒ 现在要求"**允许换行**"：空间够时一行不变（顺序与宽度都不动），不够时整格换到下一行。
       border-box / width:100% / min-width:0 三条不变（它们保证行宽 = 生成框宽、子项可收缩）。 */
  const rule = css.match(/\.ec-canvas-video-controls \{([^}]*)\}/);
  assert.ok(rule, '必须能找到参数行规则');
  const body = rule[1];
  assert.ok(/flex-wrap:\s*wrap/.test(body), '必须允许换行（用户：不要超出框的边界）');
  assert.ok(!/flex-wrap:\s*nowrap/.test(body), '不得再用 nowrap（实测窄面板下溢出 102px）');
  assert.ok(/box-sizing:\s*border-box/.test(body), '必须 border-box（否则 padding 会把行撑出容器）');
  assert.ok(/width:\s*100%/.test(body), '行宽必须等于生成框宽');
  assert.ok(/min-width:\s*0/.test(body), '必须允许子项收缩');
});

test('② 宽度固定（2026-09-17 用户批注：槽位宽绝不随文案变化）', () => {
  /* 用户看着图片生成面板说「模型名字一长按钮就往右挤、文字也往右挤」，
     并指着视频模型下拉说「这个逻辑就是对的：字太长就让它右边显示不出来，
     但绝对不能让整个按钮跟着文字去变宽。这四个框全部按这套逻辑做」。
     → 视频框槽位从「按内容收敛（flex: 0 1 <px>）」改为「固定槽位（flex: 0 0 <px>）」：
       grow 0 = 内容再长也不撑宽；shrink 0 = 邻居再长也不被压窄。 */
  for (const [nth, reason] of [['2', '视频模型'], ['3', '清晰度'], ['4', '画幅'], ['5', '时长'], ['6', '技能']]) {
    const re = new RegExp('\\.ec-canvas-video-controls > label:nth-of-type\\(' + nth + '\\) \\{[^}]*flex:\\s*0\\s+0\\s+var\\(--cvl-vslot-');
    assert.ok(re.test(css), reason + ' 必须是固定槽位（flex: 0 0 var(--cvl-vslot-*)）');
  }
  assert.ok(/\.ec-canvas-video-controls > label\.is-mention \{ flex: 0 0 auto; \}/.test(css), '@ 固定窄列不参与收缩');
  /* 技能必须给足宽度显示标题（用户批注「技能又做得特别窄」） */
  const skillRule = css.match(/\.ec-canvas-video-controls > label:nth-of-type\(6\) \{ flex: 0 0 var\(--cvl-vslot-label, (\d+)px\); \}/);
  assert.ok(skillRule, '技能必须有明确的固定 flex-basis');
  assert.ok(Number(skillRule && skillRule[1]) >= 48, '技能槽位不得过窄（要容得下「技能」标题），实际 ' + (skillRule && skillRule[1]));
});

test('② 声音开关与其余控件同结构同基线（原来是 flex+padding-top 硬顶）', () => {
  const block = videoControlsBlock();
  assert.ok(/<label className="is-toggle">声音<span/.test(block), '声音必须也有标题且控件独立成盒');
  assert.ok(/\.ec-canvas-video-controls > \.is-toggle > \.ec-canvas-video-toggle-control \{[\s\S]*?height: var\(--cvl-control-compact, 32px\)/.test(css),
    '声音控件盒必须与 select 同高（32）才可能同顶边');
});
