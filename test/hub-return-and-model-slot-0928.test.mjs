/* ══════════════════════════════════════════════════════════════════════════════════════════════
   2026-09-28 批 CY-⑫ 门禁：两条用户当面批注
     A. 「从哪儿进来的，返回就退回哪儿」（Hub 的滚动位置）
     B. 画布模型按钮：不能粗暴截断（**箭头要在**）、不能做那么小

   用户原话（逐字）
     A.「我现在在图片生成和视频生成的任意一个子页面去点击进去访问之后，当我点击左上角的返回按钮之后，
        它出来好像一直都会出现在这两个总页面的**最上方**，这肯定是不对的呀。我在哪个页面点进去的？
        那我退出来，当然是在这个刚点击进去的时候的这个地方呀。」
     B.「我之前不是跟你说过了吗？就是如果名称太长的话，你后面就可以截断的，用户是不会在意的。但是你不能
        像这样**粗暴的去截断**呀。你这个阶段应该得是比如说你现在其他的按钮，它后面不是有一个**箭头的符号**
        吗？那你这里为什么没有符号呢？还有就是你为什么这个按钮做的**这么的小**呢？它不是**模型选择按钮**吗？
        模型选择按钮不应该这么小呀。」
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = rel => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');
const code = rel => read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('⑫A 返回回到"刚点进去时的那个地方"：进子页面前记位置、回 Hub 后恢复', () => {
  const page = code('src/pages/MediaCreation/index.jsx');
  /* ① 从 Hub 点卡片时记下当时的滚动位置 */
  assert.match(page, /const hubScrollRef = useRef\(0\)/, '要有一个"来的时候的位置"');
  assert.match(page, /const openSkillFromHub = useCallback\(id => \{[\s\S]{0,160}hubScrollRef\.current = \(typeof window !== 'undefined' \? window\.scrollY : 0\) \|\| 0/,
    '从 Hub 进子页面时记下 scrollY');
  assert.match(page, /<MediaHub board=\{board\} onOpenSkill=\{openSkillFromHub\}/, 'Hub 的入口要换成这个包装过的');
  /* ② backToHub 不再自己滚到顶（否则会先跳 0 再被拉回来） */
  const back = page.slice(page.indexOf('const backToHub = useCallback'), page.indexOf('const skill = useMemo'));
  assert.doesNotMatch(back, /window\.scrollTo\(/, 'backToHub 里不许再写死 scrollTo(0)（归位交给恢复效应）');
  /* ③ 回到 Hub（skillId 为空）之后恢复：用 rAF 等 Hub 撑起来再滚，没记过就回 0 */
  assert.match(page, /useEffect\(\(\) => \{\s*if \(skillId\) return undefined;[\s\S]{0,300}window\.requestAnimationFrame\(\(\) => window\.scrollTo\(\{ top, behavior: 'auto' \}\)\)/,
    '回 Hub 之后要在下一帧恢复位置（直接滚会被"页面还没长高"裁到 0）');
  assert.match(page, /const top = hubScrollRef\.current \|\| 0;/, '没记过（深链/换板块）= 0，与从前一致');
});

test('⑫B 画布模型槽：给足宽度（75 → 132），名字长了先裁字、**箭头永远在**', () => {
  const lang = read('src/pages/EcCanvas/canvasVisualLanguage.js');
  const model = Number((lang.match(/model:\s*(\d+)/) || [])[1]);
  assert.equal(model, 132, '模型槽 = 132（75 那个值会连箭头一起裁掉 —— 用户点名"为什么没有符号"）');
  assert.match(lang, /它不是\*\*模型选择按钮\*\*吗？模型选择按钮不应该这么小呀/, '为什么改要写在注释里（用户原话）');

  const studio = code('src/pages/EcCanvas/components/CanvasStudio.jsx');
  assert.match(studio, /aria-label="生图模型"[\s\S]{0,200}<span>\{imageModelLabel\(imageModel\)\}<\/span><ChevronDown size=\{12\} \/>/,
    '模型名要包进 span（可收缩），箭头在 span 之后 ⇒ 裁的是字、不是箭头');
  /* 老规矩不许回退：参数行按钮**不写省略号**（9-17 用户口径：「真的不要用省略号」）。
     ⚠️ 切片要精确：本文件里同名选择器有多条，整段截取会扫到别处的规则（第一版就这么红的）。 */
  const css = read('src/pages/EcCanvas/EcCanvas.css');
  const clampRule = (css.match(/\.ec-canvas-parameter-item > button,\s*\.ec-canvas-suite-control > button \{[^}]*white-space: nowrap;[^}]*\}/) || [''])[0];
  assert.ok(clampRule, '要能找到"超长只在槽位内向右裁切"那条规则');
  assert.match(clampRule, /overflow: hidden;/, '仍然是 overflow:hidden 纯裁切');
  assert.doesNotMatch(clampRule, /ellipsis/, '仍然不许用省略号（老规矩，用户 9-17 点名过）');
});
