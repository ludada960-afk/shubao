import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { stripComments } from '../scripts/lib/token-scope.mjs';
import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';
import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import { availabilityLabel, featuredSkills } from '../src/skills/skillDirectory.js';

/* ═══ 首页「精选推荐」按钮行（2026-09-19 批 G 重写，依据用户批注 #3 / #4）══════════════
   用户原话（三条，缺一条都做不对）：
     · 「把他们做成像那家竞品一样。https://flova.tv/zh-CN/ 他们是按钮的形式去展示。
        然后鼠标放上去这些按钮，他们会有这个试一试的按钮出来。」
     · 「这里的 skill 他们本身只是个按钮。它是像这样子排列成 9 个 skill 的按钮作为入口。
        然后鼠标放上去的话，他们就会有下面的这个预览窗出来。」
     · 「预览窗里面你就直接拿我们现成的、我刚刚跟你说的左边是介绍、右边是图片的那个样式
        过来用就好了。」

   ⚠️ 判据为什么整条换掉（不是为了让测试变绿而回退 UI）：
   这一条原来守的是**上一版**的形态 —— 小封面大卡片 + 毛玻璃遮罩（.skill-entry-veil）+
     卡片内自动播放的封面视频 + 6 条精选。用户看过之后把形态整个否掉了：
     「这三个框你是要重做的」「鼠标放上去，它们会有这个试一试的按钮出来」。
     所以旧判据守的东西**已被产品决定删除**，继续守等于逼着下一轮把卡片加回来。
   ⚠️ 2026-09-19 批 J-⑦ 二次修正（用户批注 #3-3，翻案在明处）：
    上一版把 flova 的热门 skill 读成"一行横排、挤不下横向滑"。用户这一轮把数说清楚了：
      「你又确实是没有看明白**他们是有两行的。他们上面是5个按钮，下面是三个按钮**。
       然后他们的样式是采用什么样的技术，比如说**毛玻璃**，然后他们的交互这些东西
       你都没有抄明白呀，你最好是自己**挪一下鼠标**去看一下。」
    以及「他们是**左边有图片，右边是文字**，然后鼠标放上去才会出现那个**遮罩**，
    遮罩上面是**试一试**」。
    所以：条数 9 → **8**（5 + 3）、排布改成**五列栅格**（删掉横向滚动），
    「试一试」从右侧小药丸改成**覆盖整块按钮的毛玻璃遮罩**。这是产品决定，不是为了让测试变绿。

   新判据守的是 flova 实测出来的那套机制（docs/design/52-flova-nav-and-skill-buttons.md）：
     ① 8 个**按钮**作为入口，五列栅格 ⇒ 上 5 下 3；
     ② 「试一试」长在**按钮自己**的覆盖层上（实测 flova 就在按钮上，不在浮窗里）；
     ③ 悬停 → 按钮**正下方**浮出预览窗，移开有 ~300ms 延迟才关；
     ④ 按钮**悬停零位移**（浮窗按按钮位置算，按钮一动浮窗就抖）；
     ⑤ 预览窗内容 = 左介绍 + 右案例图（用户指定的版式）。 */

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const row = read('src/components/media/SkillEntryRow.jsx');
const rowCss = read('src/components/media/SkillEntryRow.css');
const home = read('src/pages/Home/index.jsx');
const hub = read('src/pages/Home/MediaHub.jsx');

test('① 9 个按钮作为入口（上 5 下 4），且只显示当前板块的技能（视频模式下不许出现图片技能）', () => {
  const video = featuredSkills({ board: 'video', limit: 9 });
  const image = featuredSkills({ board: 'image', limit: 9 });
  assert.ok(video.every(skill => skill.board === 'video'), '视频板块只能有视频技能');
  assert.ok(image.every(skill => skill.board === 'image'), '图片板块只能有图片技能');
  assert.equal(video.length, 9, '视频板块要能凑满 9 个按钮（批 M：上 5 下 4）');
  assert.equal(image.length, 9, '图片板块要能凑满 9 个按钮（批 M：上 5 下 4）');
  /* 首页必须按当前模式算出板块再传下去 —— 这一条是防"又把两个板块混起来" */
  const stripped = stripComments(home);
  assert.match(stripped, /const skillBoard = isVideo \? 'video' : 'image';/);
  assert.match(stripped, /board=\{skillBoard\}/);
  /* 「上面是5个按钮，下面是三个按钮」—— 条数是**写死的 8**，不是凑出来的默认值 */
  assert.match(stripped, /const SKILL_ENTRY_LIMIT = 9;/);
  assert.match(stripped, /limit: SKILL_ENTRY_LIMIT/);
});

test('② 悬停预览窗：按钮正下方、上图下文；没有案例时如实写"案例补充中"', () => {
  /* ②-a 预览窗本体：portal 到 body + fixed 定位（不能被祖先的 overflow 裁掉） */
  assert.match(row, /createPortal/);
  assert.match(row, /className="skill-preview"/);
  assert.match(rowCss, /\.skill-preview \{[^}]*position: fixed;/);
  /* ②-b **上图下文**（用户图七原话：「上面一张图、下面**一句话**说明 + 少量标签」，
     要精简、整块更高级）。判据由"左介绍 + 右三图"改为：
       · 单列（两栏的 grid-template-columns: minmax(0,1fr) minmax(0,1.15fr) 那版式本轮作废）；
       · DOM 顺序必须是 art 在前、body 在后（写成 body 在前就是"上文下图"，与原话反了）；
       · 图只留**一张**（原来三格 3:4 竖图是给两栏撑版式用的）。 */
  assert.match(row, /skill-preview-art/);
  assert.match(row, /skill-preview-body/);
  assert.match(row, /skill-preview-art[\s\S]*?skill-preview-body/, '上图下文：图必须在文案之前');
  assert.match(rowCss, /\.skill-preview \{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.doesNotMatch(rowCss, /\.skill-preview \{[^}]*minmax\(0, 1\.15fr\)/, '两栏版式已按用户口径作废');
  assert.equal((row.match(/skill-preview-shot/g) || []).length, 1, '主图只留一张（三格是旧版式）');
  assert.match(rowCss, /\.skill-preview-shot \{[^}]*aspect-ratio: 16 \/ 9/);
  /* ═══ 2026-09-24 批 AV：**标签行与入口那两行整块删掉**（判据跟着用户的新口径改）═════════════
     批 Z-② 当时照的是用户图七那句「上面一张图、下面**一句话**说明 + 少量标签」；
     本轮用户在图一/图五上**再次改向**，原话逐字：
       「这个部分完全不需要有啊。已经说了很多遍了就是。**预览窗里面只需要展示它是一个什么 Skill
        的名字。还有他这张图片的主题就可以了**。」
     ⇒ 判据由"必须有标签行"改成"**不许再有标签行与入口行**"：
        留下的是 技能名（eyebrow）+ 这张图的主题（strong）两行。
     ⚠️ 这是**用户改向**，不是放宽：改前后都是"预览窗必须精简到能一眼看完"，变的是"多少算精简"。 */
  assert.doesNotMatch(row, /skill-preview-tags/, '预览窗里不再有标签行（用户图一/图五批注）');
  assert.doesNotMatch(row, /skill-preview-cta/, '预览窗里不再有「进入「XX」工作台」那一行');
  assert.match(row, /skill-preview-eyebrow/, '要有技能名那一行（用户："展示它是一个什么 Skill 的名字"）');
  assert.match(row, /skill-preview-body[\s\S]{0,400}?<strong>/, '要有"这张图片的主题"那一行');
  /* ②-b3 图**不裁**：object-fit 必须是 contain（用户图一："正方形的图片下面会被截断"） */
  /* 判据先**剥掉注释**再比（这条规则上面挂了一段说明，见 CaseCard 那份的同一条注记） */
  assert.match(rowCss.replace(/\/\*[\s\S]*?\*\//g, ''), /\.skill-preview-shot img \{[^}]*object-fit: contain/,
    '预览图用 contain + 居中（方形图不再被上下截断）');
  /* ②-c 位置：贴在按钮**下方**、间隙 10（flova 实测 10.2），下方放不下才翻到上面 */
  assert.match(row, /rect\.bottom \+ 10/);
  assert.match(row, /globalThis\.innerHeight - rect\.top \+ 10/);
  /* ②-d 移开不立刻消失（flova 实测仍有 ~300ms 的 closeDelay） */
  assert.match(row, /const CLOSE_DELAY_MS = 300;/);
  assert.match(row, /setTimeout\(\(\) => setActiveId\(''\), CLOSE_DELAY_MS\)/);
  /* ②-e 没有案例的技能照旧出现，预览里如实写「案例补充中」（一格，不再凑三格） */
  assert.match(row, /案例补充中/);
  assert.match(row, /previewAssets/);
  /* ②-f 封面取法只有一份实现
     ⚠️ 2026-09-21 批 T：这条断言里的 `availabilityLabel` **本轮按用户口径删掉了**
        （「这 9 个案例按钮……不需要写这个，需参考素材这几个字」），所以 import 少一个名字。
        判据没变（"封面取法只有一份实现、来自声明源"），变的是那个组件不再需要 availabilityLabel。 */
  assert.match(row, /import \{ coverOf \} from '\.\.\/\.\.\/skills\/skillDirectory\.js'/);
  /* ⚠️ 这条负向断言必须**先剥注释**：我在那个位置留了一段解释（"availabilityLabel 没有删，
     总页面的卡片还在用它"）—— 直接比字符串会把知识当成用法（本仓栽过好几次的同一个坑）。 */
  assert.doesNotMatch(stripComments(row), /availabilityLabel/, '按钮行不再消费 availabilityLabel（角标已删）');
});

test('③ 「试一试」长在按钮自己的覆盖层上，且按钮悬停零位移', () => {
  assert.match(row, /skill-entry-try/);
  assert.match(row, /试一试/);
  /* ⚠️ 这条是全篇最容易做错的一条：浮窗位置按按钮 rect 算，按钮一 transform 浮窗就跟着抖。 */
  /* 「试一试」默认隐形，悬停 / 聚焦 / 已展开时才浮上来 */
  assert.match(rowCss, /\.skill-entry-button:hover \.skill-entry-try/);
  assert.match(rowCss, /\.skill-entry-button:focus-visible \.skill-entry-try/);
  assert.match(rowCss, /\.skill-entry-try \{[^}]*position: absolute;/);
  /* ⚠️ 必须在**剥掉注释**的样式上比：按钮自己那条声明旁边就写着一行
     「悬停不改 transform」的说明注释，带注释比会把解释本身当成命中。 */
  const rowCssCode = stripComments(rowCss);
  const buttonBlock = rowCssCode.slice(rowCssCode.indexOf('.skill-entry-button {'), rowCssCode.indexOf('.skill-entry-glyph {'));
  assert.doesNotMatch(buttonBlock, /transform/, '按钮本体悬停不许位移/缩放');
  /* 按钮的 hover / is-open / focus-visible 三个态都在上面那段 slice 里，
     所以"零位移"这一条已经覆盖到位 —— 不需要再单独扫一遍全文件：
     .skill-entry-button:hover .skill-entry-try 是**里面的「试一试」**要动（那是它出现的动作），
     拿全文件扫会把它误判成按钮本体位移。 */
  /* 按钮是"窄按钮"不是"宽卡片"：高度有明确档位，宽度由内容决定（flex: 0 0 auto） */
  assert.match(rowCss, /\.skill-entry-button \{[^}]*flex: 0 0 auto;/);
  /* 批 M：60 → **54**（flova 实测胶囊高 54，逐值对齐） */
  assert.match(rowCss, /\.skill-entry-button \{[^}]*min-height: 54px;/);
  assert.match(rowCss, /\.skill-entry-button \{[^}]*border-radius: 14px;/);
  /* 批 M：图标 44 → **40**（flova 实测内嵌图标 40×40） */
  assert.match(rowCss, /\.skill-entry-glyph \{[^}]*width: 40px;[^}]*height: 40px;/);
  /* ═══ 2026-09-19 批 L-4 **改判**（有授权的改判，依据 docs/design/63-batch-L-annotations.md 图1-④）═══
     用户第 17 轮原话：「下面这些按钮区域的样式你做的也不对（flova.tv/zh-CN）。你现在这些**字左右
     两边留白都特别多**。而且你**为什么不居中**呢？人家是 **9 个案例**的按钮。但是人家是**有居中**的呀。」
     ⇒ 批 J-⑦ 的「五列等宽栅格」正是「字左边一小截、右边全是空」的来源（按钮被拉到列宽）。
       用户现在要的是 flova 那种**内容宽 + 整排居中**，所以改成 flex 折行 + justify-content: center。
     ⚠️ 但 J-⑦ 数过的「上面 5 个、下面 3 个」**仍然成立**：靠按钮 min-width 200 保证一排正好 5 颗
       （5×200 + 4×11 = 1044 ≤ 1240 容器；6 颗要 1255 就折行）。实测两行各 5 / 3，且**两行同心**（中心都在 1070）。 */
  assert.match(rowCss, /\.skill-entry-buttons \{[^}]*display: flex;[^}]*flex-wrap: wrap;[^}]*justify-content: center;/,
    '热门 skill 必须折行 + 居中（L-4：人家是有居中的）');
  /* ═══ 2026-09-21 批 T **改判**（依据本轮用户原话，逐字）════════════════════════════════════
     用户原话：「然后你这些设置面板下面的这 9 个案例按钮。他们不需要写这个，需参考素材这几个字呀，
     而且他们这些按钮里面的样式做的也不够好。左边是图片，右边是文字，我觉得虽然这个布局是可以，
     但是你应该**再做的紧凑些**呀，就是你右边的这些文字，他们的**左右两边都有大量的空白**，
     你要**再做挤一些**呀。」
     ⇒ 上一版用 `min-width: 200px` 保证"一排正好 5 颗"—— 那 200px 正是用户看到的两片空白
       （四个汉字的技能名约 56px，却要占满 200px 宽的胶囊）。本轮判据改成**宽度随内容**，
       与 flova 实测的 170–242 同一个做法；折行 + 整排居中不变。
     ⚠️ 代价说清楚：一排不一定还是 5 颗（实测 6+3）—— 用户本轮要的是"挤一些"，
        行内颗数由文案长度决定，这是内容宽的必然结果，不再用最小宽度去凑数。 */
  assert.doesNotMatch(rowCss, /\.skill-entry-button \{[^}]*min-width: 200px;/,
    '不再用 min-width 200 撑宽按钮（那正是用户说的"左右两边大量的空白"）');
  assert.doesNotMatch(rowCss, /\.skill-entry-buttons \{[^}]*overflow-x: auto;/,
    '折行之后不能再横向滑（滑动会把第二行藏起来）');
  assert.doesNotMatch(rowCss, /\.skill-entry-button \{[^}]*width: 100%;/,
    '按钮不许再被拉到列宽（那正是「字左右两边留白特别多」的根因）');
  /* 批 T 新增：悬停特效照 liuyingai.cn 那张卡片（充能条 / 图标放大 / 文字变色）—— 见 CSS 里的实测表 */
  assert.match(rowCss, /\.skill-entry-button::after \{[^}]*width: 0;/,
    '充能条常态宽度 0（悬停才长满）');
  assert.match(rowCss, /\.skill-entry-button:hover::after,[\s\S]{0,80}\{[^}]*width: 100%;/,
    '悬停时充能条长满（liuyingai 实测 700ms）');
  assert.match(rowCss, /\.skill-entry-button:hover \.skill-entry-glyph,[\s\S]{0,120}\.skill-entry-glyph \{[^}]*transform: scale\(1\.05\);/,
    '图标磁贴悬停放大 1.05（liuyingai 逐值）');
});

/* ═══ 批 J-⑦ → 批 U（2026-09-21）**改判**：悬停时**内容隐藏 + 原地「试一试」**（照 flova 实测）═══
   上一版（批 J-⑦）守的是"整块毛玻璃遮罩，试一试落在遮罩上"，依据是用户批注 #3-3 那句
   「鼠标放上去才会出现那个遮罩，遮罩上面是试一试……他们的样式比如说毛玻璃」。
   用户本轮原话（逐字）：「我们现在的推荐 skill 这些按钮，鼠标放上去的**试一试是变形的**，
   你要抄图三的做法呀：https://flova.tv/zh-CN/ ，鼠标放上去的样式我也给你看了，你自己最好
   **操作个鼠标去看看**，不要仅凭我这样说去做判断。」
   实测 flova（真鼠标事件 + 读 DOM，落档 .tmp/flova-hover-report.txt）：
     按钮里那一层 `… md:group-hover:invisible …`（装着封面图 + 标题）**悬停时整层 visibility: hidden**，
     按钮自己的底与圆角不变、**没有第二层底**；「试一试」是原地换上去的纯文字。
   ⇒ 我们那层半透明毛玻璃会让底下的字透出来，与「试一试」叠在一起 —— 那正是"变形"。
     新判据：① 悬停时内容（图标 + 名字）**隐藏**；② 「试一试」仍是整块覆盖层、圆角继承；
             ③ **不再铺第二层底/毛玻璃**（底就是按钮自己那一层）。
   ⚠️ 预览窗（浮层）继续走毛玻璃 token —— 那是浮层，与按钮内的悬停态是两件事。 */
test('⑦ 悬停：内容隐藏 + 原地「试一试」（照 flova，不再压毛玻璃）', () => {
  assert.match(rowCss, /\.skill-entry-try \{[^}]*position: absolute; inset: 0;/,
    '试一试仍是**整块**覆盖层（inset:0），不是右侧一颗小药丸');
  assert.match(rowCss, /\.skill-entry-try \{[^}]*border-radius: inherit;/,
    '覆盖层圆角要继承按钮（按钮不能加 overflow:hidden —— 会裁掉右上角的能力标签）');
  assert.match(rowCss, /\.skill-entry-button:hover \.skill-entry-name,[\s\S]{0,400}visibility: hidden;/,
    '悬停时名字要隐藏（flova 的 group-hover:invisible 就是这条）');
  assert.match(rowCss, /\.skill-entry-button:hover \.skill-entry-glyph,[\s\S]{0,400}visibility: hidden;/,
    '悬停时图标也要隐藏（否则会与「试一试」叠在一起 = 用户说的"变形"）');
  assert.doesNotMatch(rowCss, /\.skill-entry-try \{[^}]*backdrop-filter/,
    '不再压毛玻璃（用户：「试一试是变形的」，实测 flova 没有第二层底）');
  /* 那句话必须还能被读到一次 —— 按钮自己的 aria-label 里有「试一试」 */
  assert.match(row, /aria-label=\{skill\.name \+ ' · 试一试'\}/);
  assert.match(row, /className="skill-entry-try" aria-hidden="true"/,
    '覆盖层是纯装饰，别把「试一试」读两遍');
  /* 预览窗（浮层）仍走同一颗玻璃底 */
  const previewBlock = rowCss.slice(rowCss.indexOf('.skill-preview {'), rowCss.indexOf('.skill-preview-body'));
  assert.match(previewBlock, /background: var\(--sb-glass-panel\)/, '预览窗仍是毛玻璃（浮层与按钮悬停态是两件事）');
});

test('④ 键盘可达 + 首页点击走 skillPath（与 Hub / 总页面共用一份算法）', () => {
  assert.match(row, /onClick=\{\(\) => onOpenSkill\?\.\(skill\)\}/);
  /* 键盘用户拿不到 hover：聚焦即开预览窗，Escape 关闭 */
  assert.match(row, /onFocus=\{event => openPreview\(event\.currentTarget, skill\)\}/);
  assert.match(row, /onBlur=\{scheduleClose\}/);
  assert.match(row, /event\.key === 'Escape'/);
  assert.match(stripComments(home), /window\.history\.pushState\(\{\}, '', skillPath\(skill\)\)/);
});

test('⑤ 图片与视频共用同一套按钮行（不许各写一份），旧的卡片条已删除', () => {
  assert.ok(!existsSync(new URL('../src/components/media/HotSkillStrip.jsx', import.meta.url)), '旧的卡片条必须删掉，避免两份实现');
  assert.doesNotMatch(home, /HotSkillStrip|hot-skill-strip/);
  /* 两个板块共用：组件不按 board 分支渲染两套 DOM，只换数据与文案 */
  assert.match(row, /data-board=\{board\}/);
  /* ═══ 2026-09-19 批 I-7：判据收窄到「skill 按钮只有一处实现」（用户批注 #2-6）═══════════
     原判据数的是文件里 <button 的出现次数 == 1。批 I-7 按用户批注 #2-6
     「你这里其实应该放的是像他们那样，**各个skill分类的切换区**和更多skill的按钮」
     加了一排**分类页签**（它当然是 button，而且一个 map 渲染 7 档）—— 于是这条从 1 变成 3，红了。
     ⚠️ 但这条门禁**要守的东西没变**：它守的是「图片与视频不许各写一份 **skill 按钮**」，
        不是「这个文件里只能有一个 button」。分类页签是**另一个控件**，不是第二份 skill 按钮实现。
     所以判据改成数 .skill-entry-button 这个类名的出现次数（仍然是 1 = 一个 map 渲染全部）。 */
  assert.equal((row.match(/className=\{'skill-entry-button'/g) || []).length, 1, 'skill 按钮只有一处实现（一个 map 渲染全部）');
  /* ═══ 2026-09-24：**角标从两个地方一起去掉**（判据反转，依据是用户本轮原话）═══════════════
     原判据守的是「可用性角标只有一份实现（Hub 卡片与首页按钮共用同一句话）」——
     上一批按用户那句话的**范围**（首页那排 9 个案例按钮）只删了首页那一处，Hub 卡片保留了角标。
     用户本轮原话：「**Hub「需参考素材」角标一起去掉**」⇒ 两处都不再显示角标。
     ⚠️ 变的只是**显示**：availability 声明字段、availabilityLabel 取词函数与下面的单测**全部保留**
        （"跑不通的技能不许装作能用"这条口径仍然由声明与台账守着）。负向断言先剥注释。 */
  assert.doesNotMatch(stripComments(hub), /badge=\{availabilityLabel/,
    'Hub 卡片不再显示可用性角标（用户：Hub「需参考素材」角标一起去掉）');
  assert.equal(availabilityLabel({ availability: 'blocked' }), '即将上线');
  assert.equal(availabilityLabel({ availability: 'needs_ref' }), '需参考素材');
  assert.equal(availabilityLabel({ availability: 'ready' }), '');
});

test('⑥ 精选推荐的取数只在声明源里做一次（两个板块都能给满 8 条，且都是能跑的）', () => {
  const video = featuredSkills({ board: 'video', limit: 8 });
  const image = featuredSkills({ board: 'image', limit: 8 });
  assert.equal(video.length, Math.min(8, VIDEO_SKILLS.length));
  assert.equal(image.length, Math.min(8, IMAGE_SKILLS.length));
  /* blocked 的技能不许进首页按钮行（跑不通的东西不该出现在一级入口上） */
  for (const skill of [...video, ...image]) {
    assert.notEqual(skill.availability, 'blocked', skill.id + ' 还没跑通，不该出现在首页精选里');
  }
});
