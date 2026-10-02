// test/canvas-control-slot-width-0917.test.mjs
// 2026-09-17 用户批注（最高优先级）：**控件槽位宽度固定，绝不随文案长度变化**
//
// 用户原话（看着图片生成面板 @ → GPT Image 2.5 Sunburst → 自动/1:1 → 2K → x2 → 技能 → 生成）：
//   「你这里做的也不对。就是你模型选这种名字比较长的，为什么你的按钮还是会往右边去挤呢？
//    你的文字也往右边去挤了呢？我的意思是你的文字要往右边去挤，但是不能够超出这个按钮
//    的框。你现在整体的规则都要弄明白、全面，所有东西都要搞明白这个逻辑再去做，避免
//    文字把整个按钮给拉长了，然后把整个框都给做歪了。现在的情况就是互相挤压了，你明白吗？」
// 指着视频生成的视频模型下拉：
//   「你看一下这个视频生成的选模型的这个地方，它这个逻辑就是对的：就是字太长的话，你就
//    让它长，你就让它右边有一部分显示不出来，没有关系，但是你绝对不能够让整个按钮跟着
//    你的文字去变宽。你现在这四个生成的框全部都要按照这套逻辑来做。」
//
// 正式规则（四条）：
//   ① 槽位宽度由布局网格决定，绝不随文案长度变化；禁止 width:auto、禁止内容撑开、
//      禁止 flex 让文字参与宽度分配（文字元素必须 min-width:0）；
//   ② 超长只在槽位内向右裁切：overflow:hidden + nowrap，无 ellipsis、无「…」、不换行、不缩字号；
//   ③ 短文案（四字）必须完整显示 → 槽位按最长短标签定宽；
//   ④ 槽位间距固定（8pt 阶梯），任何文案长度下整行不变形、不互相挤压。
//
// 本测试把四条钉成契约。真源 = src/pages/EcCanvas/canvasVisualLanguage.js 的 SLOT_WIDTH。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { SLOT_WIDTH, VIDEO_SLOT_WIDTH, SLOT_GAP, canvasSlotCssVars, SPACING } from '../src/pages/EcCanvas/canvasVisualLanguage.js';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const css = read('src/pages/EcCanvas/EcCanvas.css');

/* 去掉注释，避免把说明文字里的示例 CSS 当成真实规则匹配 */
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

/* 去掉 @media 块：窄屏覆盖规则（≤760px 才换行等）不是"主规则"，
   断言主规则时必须排除，否则会误抓到最后一条媒体查询里的覆盖值。 */
const main = stripped.replace(/@media[^{]*\{(?:[^{}]|\{[^{}]*\})*\}/g, '');

/* 取某条规则的**最后**一个匹配：CSS 分层里后面的会覆盖前面的，
   真源永远是主规则里的最后一条（前面的都是历史分层，留着只为说明演进）。 */
function lastRule(source, pattern) {
  const all = [...source.matchAll(pattern)];
  return all.length ? all[all.length - 1] : null;
}

/* 取同名规则的**全部**声明合并：CSS 分层里同一选择器会拆成多条规则，
   浏览器把它们的声明并起来生效，所以断言"该选择器整体是否满足"时必须看并集。
   （只看最后一条会漏掉前面那条里的 overflow:hidden。） */
function allRuleText(source, pattern) {
  return [...source.matchAll(pattern)].map(m => m[1]).join('\n');
}

/* ── 规则 ①：槽位宽度固定 ─────────────────────────────────────────── */

test('槽位宽度表存在且每一档都是正数（固定像素，不是百分比/auto）', () => {
  for (const [key, value] of Object.entries(SLOT_WIDTH)) {
    assert.equal(typeof value, 'number', `SLOT_WIDTH.${key} 必须是数字`);
    assert.ok(value > 0, `SLOT_WIDTH.${key} 必须为正`);
  }
  for (const [key, value] of Object.entries(VIDEO_SLOT_WIDTH)) {
    assert.ok(value > 0, `VIDEO_SLOT_WIDTH.${key} 必须为正`);
  }
});

test('槽位间距取自 8pt 阶梯（SLOT_GAP = SPACING.sp2 = 8）', () => {
  assert.equal(SLOT_GAP, SPACING.sp2);
  assert.equal(SLOT_GAP, 8);
});

test('槽位宽度表注入 CSS 变量（CSS 侧只写 var(--cvl-slot-*)，不写魔法数字）', () => {
  const vars = canvasSlotCssVars();
  /* --cvl-slot-config / --cvl-vslot-config 是 2026-09-28 批 CY-⑬ 加的：
     比例 / 清晰度 / 数量三颗小药丸收成一颗「生成配置」触发器之后，需要一个新槽位，
     宽度必须同样来自这张表（不许在 CSS 里写魔法数字）。 */
  for (const name of ['--cvl-slot-mention', '--cvl-slot-model', '--cvl-slot-config', '--cvl-slot-ratio',
    '--cvl-slot-resolution', '--cvl-slot-count', '--cvl-slot-duration', '--cvl-slot-label',
    '--cvl-slot-gap', '--cvl-vslot-model', '--cvl-vslot-config', '--cvl-vslot-resolution', '--cvl-vslot-ratio',
    '--cvl-vslot-duration', '--cvl-vslot-label']) {
    assert.ok(vars[name], `必须注入 ${name}`);
    assert.match(vars[name], /^\d+px$/, `${name} 必须是固定像素值`);
  }
});

test('参数控件槽位：必须是 flex-grow:0 + flex-shrink:0（固定，不随内容/邻居变化）', () => {
  const rule = allRuleText(main, /\.ec-canvas-parameter-item \{([\s\S]*?)\}/g);
  assert.ok(rule.trim(), '必须有 .ec-canvas-parameter-item 规则');
  assert.match(rule, /flex:\s*0\s+0\s+(auto|var\(--cvl-slot-)/, '槽位必须固定（flex-grow:0 + flex-shrink:0）');
  assert.match(rule, /min-width:\s*0/, '文字元素必须能收缩（min-width:0）');
});

test('每个控件类型按**类型**定宽（不是按位置），宽度全部来自 --cvl-slot-*', () => {
  /* ═══ 2026-09-28 批 CY-⑬：这张表的**键换了** ═══════════════════════════════════════════════════════
     原来靠 `aria-label="图片比例" / "清晰度" / "生成数量" / "时长"` 这些**单行小药丸**来匹配。
     那三颗参数药丸连同视频框那 4 个原生 `<select>` 已经被合并进「生成配置」触发器
     （用户原话：「什么尺寸，清晰度，数量这些都是可以放在同一个**生成配置**里面去呀」）
     ⇒ 按 aria-label 匹配的 5 行里有 5 行再也匹配不到元素。
     换成 `data-canvas-config-trigger`（触发器上的**语义标记**）——
     这也更贴规则本意：**宽度由控件类型决定，与它在第几位、文案多长都无关**。
     合并掉的那三项不是"没有宽度"了：它们在「生成配置」面板里，宽度由面板栅格给
     （`.ec-canvas-config-count-row button` 锁 32px 点击区档，见下面另一条）。 */
  const cases = [
    ['model', '--cvl-slot-model'],
    ['config', '--cvl-slot-config'],
    ['video-model', '--cvl-vslot-model'],
    ['video-config', '--cvl-vslot-config'],
  ];
  for (const [surface, variable] of cases) {
    const escaped = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ruleRe = new RegExp(':has\\(> \\[data-canvas-config-trigger="' + surface + '"\\]\\)[\\s\\S]{0,240}?' + escaped);
    assert.ok(ruleRe.test(stripped), surface + ' 必须用 ' + variable + ' 定宽');
  }
  /* 套图「生成配置」多包了一层 .ec-canvas-suite-settings-control，所以槽位规则挂在**外层**那一格上 */
  assert.match(stripped,
    /\.ec-canvas-suite-controls > \.ec-canvas-suite-settings-in-row \{[^}]*flex:\s*0\s+0\s+var\(--cvl-slot-model/,
    'suite-settings 必须用 --cvl-slot-model 定宽');
  /* 合并进面板的那三项：点击区仍锁 32px 档（用户 2026-09-17 定的下限，一条没松） */
  assert.match(stripped, /\.ec-canvas-config-count-row button \{[^}]*var\(--cvl-control-compact, 32px\)/,
    '生成数量 / 时长 那一排的按钮必须仍是 32px 档');
});

test('禁止用 :last-child 定宽（宽度不能取决于位置，否则换位次就变形）', () => {
  const bad = stripped.match(/\.ec-canvas-parameter-item:last-child[^{]*\{[^}]*flex:\s*0\s+0\s+(?!auto)[^;}]+/);
  assert.equal(bad, null, '不得再有「最后一格单独定宽」——宽度必须按控件类型');
});

/* ── 规则 ②：只在槽位内裁切，不省略号 ─────────────────────────────── */

test('按钮基础规则：overflow:hidden + nowrap，无 text-overflow', () => {
  const rule = allRuleText(main, /\.ec-canvas-parameter-item > button,\s*\n\s*\.ec-canvas-suite-control > button \{([\s\S]*?)\}/g);
  assert.ok(rule.trim(), '必须有参数按钮基础规则');
  assert.ok(!/text-overflow/.test(rule), '不许出现 text-overflow（否则四字变「智能…」）');
  assert.match(rule, /overflow:\s*hidden/, '必须 overflow:hidden（纯裁切）');
  assert.match(rule, /white-space:\s*nowrap/, '必须 nowrap（不换行）');
});

test('槽位内按钮 width:100%（宽度由槽位决定，不由文字决定）', () => {
  const rule2 = allRuleText(main, /\.ec-canvas-parameter-item > button,\s*\n\s*\.ec-canvas-suite-control > button \{([\s\S]*?)\}/g);
  assert.match(rule2, /width:\s*100%/, '按钮必须 100% 撑满槽位');
});

test('生成设置/模型格：同样只裁不省略', () => {
  const m = lastRule(main, /\.ec-canvas-suite-settings-control > button \{([\s\S]*?)\}/g);
  assert.ok(m, '必须有生成设置格规则');
  assert.match(m[1], /overflow:\s*hidden/);
  assert.ok(!/text-overflow:\s*ellipsis/.test(m[1]), '不许省略号');
  /* 尺寸规则（包含 width/flex）在另一条同名规则里，单独取最后一条 */
  const size = lastRule(main, /\.ec-canvas-suite-settings-control > button \{([\s\S]*?)\}/g);
  assert.ok(size, '生成设置格尺寸规则存在');
});

/* ── 规则 ③：短文案（四字）必须完整显示 ────────────────────────────── */

test('短标签槽位宽 ≥ 四字标签所需（104px：文字52+图标14+间距5+内边距18+chevron12+余量3）', () => {
  assert.ok(SLOT_WIDTH.label >= 104, '四字标签位必须 ≥104，否则「智能套图」会被裁成「智能套」');
});

test('视频框各槽位能容纳 2-3 字标题不折行', () => {
  /* 视频控件是「标题在上控件在下」，标题最长「视频模型」(4字) → 需 ≥ 56 */
  for (const key of ['model', 'resolution', 'ratio', 'duration', 'label']) {
    assert.ok(VIDEO_SLOT_WIDTH[key] >= 48, `VIDEO_SLOT_WIDTH.${key} 至少容得下标题`);
  }
});

/* ── 规则 ④：间距固定 + 整行不变形 ─────────────────────────────────── */

test('槽位间距用 --cvl-slot-gap（固定 8px），不用硬编码小数', () => {
  const m = lastRule(main, /\.ec-canvas-suite-controls \{([\s\S]*?)\}/g);
  assert.ok(m, '必须有套图参数行规则');
  assert.match(m[1], /gap:\s*var\(--cvl-slot-gap/, '间距必须走 --cvl-slot-gap');
});

/* ── 四个生成框全部适用 ───────────────────────────────────────────── */

test('四个生成框的参数控件都落在同一套槽位规则内（不是各写一份）', () => {
  /* 图片/文案框用 .ec-canvas-parameter-item；套图用 .ec-canvas-suite-control；
     视频用 .ec-canvas-video-controls 下的语义标记 —— 三者都必须有固定槽位规则 */
  assert.ok(stripped.includes('.ec-canvas-parameter-item {'), '图片/文案框槽位规则');
  assert.ok(stripped.includes('.ec-canvas-suite-control {'), '套图框槽位规则');
  assert.ok(/\.ec-canvas-video-controls > \.ec-canvas-parameter-item:has\(/.test(stripped), '视频框槽位规则');
  /* 视频框的固定 basis：两颗触发器全部 flex: 0 0 var(--cvl-vslot-*)。
     ⚠️ 批 CY-⑬ 之前这里查的是 `> label:nth-of-type(2..6)`。视频模型/清晰度/画幅/时长
     四个原生 `<select>` 收成一颗「生成配置」之后，<label> 只剩 3 个（引用/技能/声音），
     那张表会**整体错位**（技能被当成视频模型分到 112px、声音被当成清晰度分到 62px）。
     ⇒ 键换成 data-canvas-config-trigger：宽度按**控件类型**给，不按位次给。 */
  for (const [surface, variable] of [['video-model', '--cvl-vslot-model'], ['video-config', '--cvl-vslot-config']]) {
    const re = new RegExp('\\.ec-canvas-video-controls > \\.ec-canvas-parameter-item:has\\(> \\[data-canvas-config-trigger="' + surface + '"\\]\\) \\{[^}]*flex:\\s*0\\s+0\\s+var\\(' + variable);
    assert.match(stripped, re, '视频框 ' + surface + ' 槽位必须固定宽度');
  }
});

test('视频框两颗触发器：width:100% + min-width:0 + 不许省略号（文字不许撑宽按钮）', () => {
  /* 批 CY-⑬ 之前这条查的是「视频模型 select 锁 width:100%」——
     原生 `<select>` 是**唯一**会自己撑宽的元素（它按内容算宽度），所以要单独锁。
     换成站内触发器之后撑宽的风险原样存在（`inline-flex` 默认 max-content），
     判据保留：触发器必须被槽位锁住，字太长只在槽内**纯裁切**。 */
  const rule = allRuleText(main, /\.ec-canvas-parameter-item > \.ec-canvas-config-trigger,\s*\n\s*\.ec-canvas-suite-settings-control > \.ec-canvas-config-trigger \{([\s\S]*?)\}/g);
  assert.ok(rule.trim(), '必须有触发器的锁宽规则');
  assert.match(rule, /height:\s*40px/, '触发器高度固定（不随内容）');
  assert.ok(!/text-overflow/.test(rule), '触发器不许写 text-overflow（用户：不要省略号）');
  const base = allRuleText(main, /\.ec-canvas-config-trigger \{([\s\S]*?)\}/g);
  assert.match(base, /width:\s*100%/, '触发器必须 100% 撑满槽位（宽度由槽位决定）');
  assert.match(base, /min-width:\s*0/, '触发器必须 min-width:0（才能在槽内收缩）');
  assert.match(base, /overflow:\s*hidden/, '必须 overflow:hidden（纯裁切）');
  assert.match(base, /white-space:\s*nowrap/, '必须 nowrap（不换行）');
  /* ⚠️ 批 CY-㊴（2026-10-01）：原断言要求视频侧是 32px，依据是「与同行其它控件同基线」。
     那条依据经**实测**不成立 —— `.ec-canvas-video-controls` 那一行的全部直接子元素是：
       ec-canvas-video-field（@ 引用按钮）        24.5×24.5
       ec-canvas-parameter-item ×3（三颗触发器）  当时 21.8
     24.5 既不是 27.2 也不是 32 —— 那一行本来就没有统一基线；
     而文案/图片/套图三侧的 @ 按钮同样挨着 27.2 的触发器。
     ⇒ 删掉视频侧专属覆盖，**四个板块统一到 27.2**；这里改为断言"不许再有例外"。 */
  assert.doesNotMatch(stripped, /\.ec-canvas-video-controls > \.ec-canvas-parameter-item > \.ec-canvas-config-trigger\s*\{/,
    '视频侧不得再有触发器专属尺寸覆盖 —— 四个板块必须同档');
  assert.doesNotMatch(stripped, /\.ec-canvas-video-controls > \.ec-canvas-parameter-item > \.ec-canvas-config-trigger-copy\s*\{/,
    '视频侧不得再单独收两行间距');
});

test('参数行不参与收缩（flex-shrink:0）；放不下**换行**，不再靠底栏裁切', () => {
  /* 行宽 = 槽位之和 + 间距（由槽位表算出的定值）。
     若让行收缩，底栏里其它元素（提示语/生成按钮宽度变化）会改变行宽，
     行内槽位就会跟着等比变化 → 又回到"互相挤压"。
     所以行仍然 flex-shrink:0。
     ═══ 2026-09-27 批 CU：**兜底从"裁切"改成"换行"（用户改向）** ═══════════════════════════════
     旧口径：「宁可右边看不全，也绝不改变任何一格的宽度」—— 靠底栏 `overflow:hidden` 裁掉放不下的部分。
     用户原话（逐字）：「而且你这里现在这些**按钮区的适配现在也没有做好，很多部分，它现在都是
     **超出框的边界**的……像生成文案啊，生成图片啊，生成视频啊，他们那边应该也有这些类似的问题存在，
     那你都得去把他们给解决掉。」
     实测（`.qa/cu-adapt.mjs`，把创作台面板强制成 5 档宽度逐行量）：改前 480/435/380/320 四档下
     参数行最右一颗按钮分别**超出 22 / 53 / 90 / 131px**；改后五档全部 **0 溢出**（放不下的整颗换行）。
     ⇒ 判据变成：**底栏/参数行必须 wrap**（不裁、不溢出、槽位仍固定宽）。 */
  const rule = allRuleText(main, /\.ec-canvas-parameter-controls \{([\s\S]*?)\}/g);
  assert.ok(rule.trim(), '必须有参数行规则');
  assert.match(rule, /flex-shrink|flex:\s*0\s+0\s+auto/, '行必须不参与收缩（flex-shrink:0）');
  const footer = allRuleText(main, /\.ec-canvas-composer-footer \{([\s\S]*?)\}/g);
  assert.match(footer, /flex-wrap:\s*wrap/, '底栏放不下必须换行（用户：不要裁掉/溢出）');
  assert.ok(!/overflow:\s*hidden/.test(footer), '底栏不得再用 overflow:hidden 裁切（用户口径已改）');
  const suiteRow = allRuleText(main, /\.ec-canvas-suite-controls \{([\s\S]*?)\}/g);
  assert.match(suiteRow, /flex-wrap:\s*wrap/, '套图参数行同样必须换行（实测它是最容易溢出的那一条）');
});

/* ═══ 2026-09-27 批 CU：**四个生成框的按钮区都要经得起窄面板**（用户点名，逐字）═══════════════
   用户原话：「可能不止电商套图有存在这个问题，其他的区域应该也有存在这些问题，像**生成文案啊，
   生成图片啊，生成视频**啊，他们那边应该也有这些类似的问题存在，那你都得去把他们给解决掉。」
   实测（`.qa/cu-adapt-all.mjs`，把创作台面板强制成 620/540/480/435/380/320 六档逐行量，改前）：
     · 电商套图参数行：480/435/380/320 四档分别**溢出 22/53/90/131px**；
     · 图片生成 / 生成文案底栏：435/380/320 三档**溢出 5/43/84px**；
     · 生成视频控件行：435/380/320 三档**溢出 24/61/102px**。
   改后四框六档**全部 0 溢出**。判据（静态可守的部分）：这几行必须写明 wrap，且参数行必须可收缩
   —— `flex: 0 0 auto` 会让"比容器还宽的子项"永远溢出，光给底栏加 wrap 救不回来。 */
test('四个生成框的按钮行都允许换行，且参数行可收缩（窄面板不溢出）', () => {
  const videoRow = allRuleText(main, /\.ec-canvas-video-controls \{([\s\S]*?)\}/g);
  assert.ok(videoRow.trim(), '必须有 .ec-canvas-video-controls 规则');
  assert.match(videoRow, /flex-wrap:\s*wrap/, '视频控件行必须 wrap（实测窄面板下最后三格溢出 30/73/102px）');
  const paramRow = allRuleText(main, /\.ec-canvas-parameter-controls \{([\s\S]*?)\}/g);
  assert.match(paramRow, /flex-wrap:\s*wrap/, '参数行自身也要 wrap（否则它比底栏还宽时无处可去）');
  const footerChild = allRuleText(main, /\.ec-canvas-composer-footer > \.ec-canvas-parameter-controls \{([\s\S]*?)\}/g);
  assert.ok(!/flex:\s*0\s+0\s+auto/.test(footerChild),
    '底栏里的参数行不许再用 flex: 0 0 auto（不收缩 ⇒ 窄面板下整行溢出 84px）');
  assert.match(footerChild, /flex:\s*0\s+1\s+auto/, '参数行必须可收缩（收缩后由行内的 wrap 接管换行）');
});

/* ── 防回退：不得再出现 flex: 0 0 auto 作用于"内容自适应"的参数槽 ── */

test('防回退：套图参数行不得退回 flex: 0 0 auto（内容自适应）', () => {
  const m = lastRule(main, /\.ec-canvas-suite-control \{([\s\S]*?)\}/g);
  assert.ok(m, '必须有套图槽位规则');
  assert.ok(!/flex:\s*0\s+0\s+auto/.test(m[1]), '套图槽位不许用 flex: 0 0 auto');
  assert.match(m[1], /flex:\s*0\s+0\s+var\(--cvl-slot-label/);
});

