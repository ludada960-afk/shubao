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

test('① 每一项都有标题（技能不再是没有标题的光板按钮）', () => {
  const block = videoControlsBlock();
  /* ═══ 2026-09-28 批 CY-⑬：这一行的**结构变了**，判据跟着变，但一个字的要求都没松 ═══════════════
     用户 ① 的原话是「其他那四个按钮的规则都是上面有标题、下面是一个选项，你这个都没有这个逻辑在」——
     要的是"每一项都必须有标题"，**不是**"每一项都必须写成 <label> + <select>"那个具体写法。
     批 CY-⑬ 把「视频模型 / 清晰度 / 画幅 / 时长」四个原生 <select> 换成
     ① 一颗「视频模型」两行摘要触发器（标题在按钮内）＋ ② 一颗「生成配置」触发器
        （清晰度 · 画幅 · 时长 收在这一块里 —— 用户原话：「什么尺寸，清晰度，数量这些都是可以放在
        同一个**生成配置**里面去呀」）。
     于是视频行现在是：@引用 → 视频模型 → 生成配置 → 技能 → 声音，
     技能/声音仍是「<label>标题 + 控件」两行，两颗触发器自带标题行。 */
  assert.ok(/title="视频模型"/.test(block), '视频模型必须有标题（两行摘要触发器的小标题）');
  assert.ok(/title="生成配置"/.test(block), '清晰度 / 画幅 / 时长 必须收进有标题的「生成配置」块');
  /* 这三项必须真的都在那块面板里，不许有一项漏在外面 */
  for (const group of ['清晰度', '画幅', '时长']) {
    assert.ok(new RegExp('<CanvasConfigGroup title="' + group + '">').test(block), group + ' 必须在生成配置面板里');
  }
  /* 技能必须有标题 —— ⚠️ 2026-09-30 批 CY-㊴：判据从"包在 <label> 里"改成"有标题"，
     理由就是本文件上方自己写的那句原则：「要的是『每一项都必须有标题』，
     **不是**『每一项都必须写成 <label> + <select>』那个具体写法」。
     用户 2026-09-30 逐字：「而且你这个技能的这个按钮上面怎么还有一个技能呀？」
     —— 9-17 加的那层 <label>技能</label>，和 CanvasSkillControl 触发器**自带的 title="技能"**
     叠在一起，渲染成「技能 / ⚡ 技能 ▾」，同一个词上下各一份。
     ⇒ 原则（有标题）仍然满足，删掉的是那个**重复**的外层文字。 */
  assert.ok(/<CanvasSkillControl/.test(block), '技能控件必须在（它自带标题行 + 当前值）');
  assert.ok(/title="技能"/.test(studio), 'CanvasSkillControl 的触发器标题必须是「技能」（这才是"有标题"的真身）');
  assert.ok(!/<label[^>]*>技能<CanvasSkillControl/.test(block),
    '不许再在外面套一层写死「技能」的 label —— 同一个词会显示两次');
  /* 这一行不许再出现原生 <select>（批 CY-⑬ 的根因：22px 高、无箭头、系统外观） */
  assert.ok(!/<select[\s>]/.test(block.replace(/\/\*[\s\S]*?\*\//g, '')), '视频行不许再有原生 <select>');
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
  /* 只看 JSX 标签顺序：@ 的 <label …is-mention…> 必须出现在「视频模型」这颗之前。
     批 CY-⑬ 之后「视频模型」不再是 <label>，是 <CanvasConfigTrigger title="视频模型">。 */
  const mentionIdx = block.search(/<label[^>]*is-mention/);
  const modelIdx = block.indexOf('title="视频模型"');
  assert.ok(mentionIdx > 0, '@ 必须作为 label 出现在参数行内');
  assert.ok(modelIdx > 0, '视频模型必须出现在参数行内');
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
       grow 0 = 内容再长也不撑宽；shrink 0 = 邻居再长也不被压窄。
     ═══ 批 CY-⑬：键从「第几个 <label>」换成 `data-canvas-config-trigger` 这个**语义标记** ═══════════
       改前是 `> label:nth-of-type(2..6)`，成立的前提是这一行有 6 个 <label>；
       三个原生 <select> 收成一颗触发器之后 <label> 只剩 3 个，那张表**整体错位**
       （技能被当成视频模型分到 112px、声音被当成清晰度分到 62px）。
       换成语义标记后，宽度重新由**控件类型**决定 —— 这才是 2026-09-17 那条规则的原意。 */
  for (const [surface, variable, reason] of [
    ['video-model', '--cvl-vslot-model', '视频模型'],
    ['video-config', '--cvl-vslot-config', '生成配置（清晰度·画幅·时长）'],
  ]) {
    const re = new RegExp('\\.ec-canvas-video-controls > \\.ec-canvas-parameter-item:has\\(> \\[data-canvas-config-trigger="' + surface + '"\\]\\) \\{[^}]*flex:\\s*0\\s+0\\s+var\\(' + variable);
    assert.ok(re.test(css), reason + ' 必须是固定槽位（flex: 0 0 var(' + variable + ', …)）');
  }
  assert.ok(/\.ec-canvas-video-controls > label\.is-mention \{ flex: 0 0 auto; \}/.test(css), '@ 固定窄列不参与收缩');
  /* 技能仍走「按内容收敛」那一档（它是短文案，不需要固定位），但必须收得到、不许塌成 0 */
  assert.match(css, /\.ec-canvas-video-controls > label:not\(\.is-mention\):not\(\.is-toggle\) \{ flex: 0 1 auto; \}/,
    '技能等短文案格必须可收缩且有最小内容宽');
  /* 触发器本体锁宽：width:100% + min-width:0 + overflow:hidden + nowrap —— 字长不撑宽按钮 */
  const trigger = css.match(/\.ec-canvas-config-trigger \{([^}]*)\}/);
  assert.ok(trigger, '必须能找到触发器基础规则');
  assert.match(trigger[1], /width:\s*100%/);
  assert.match(trigger[1], /min-width:\s*0/);
  assert.match(trigger[1], /overflow:\s*hidden/);
  assert.match(trigger[1], /white-space:\s*nowrap/);
});

test('② 声音开关已按用户要求移除（首页视频生成早已没有这个功能）', () => {
  /* 批 CY-㉘：用户 2026-09-30 逐字「最右边这个声音你要把它拿掉啊，我们现在首页的
     视频生成都早就没有这个功能了」。
     这条门禁原来是**反过来**要求「声音必须存在」的（它是 9-17 那轮排版对齐的产物），
     现在改成盯住「已移除」，并说明能力本身没删：
     `generateAudio` 缺省仍是 true，index.jsx:4613/4647/4749 照旧读它（`!== false`），
     所以不传就出带声成片 —— 删的只是那个首页已取消的开关。 */
  const block = videoControlsBlock();
  assert.doesNotMatch(block, /<label className="is-toggle">声音/, '声音开关必须已从视频框里拿掉');
  assert.doesNotMatch(block, /generateAudio: event\.target\.checked/,
    '不得再有把开关状态写回节点的处理器');
  assert.doesNotMatch(block, /ec-canvas-video-toggle-control/,
    '声音的控件盒也不该再出现在视频框里');
  // 能力仍在：字段仍会被读取，且缺省为 true（= 出带声成片）
  const canvas = readFileSync(new URL('../src/pages/EcCanvas/index.jsx', import.meta.url), 'utf8');
  assert.match(canvas, /generateAudio: composer\.generateAudio !== false/,
    '缺省必须仍是有声（!== false），删开关不得改变出片默认');
});
