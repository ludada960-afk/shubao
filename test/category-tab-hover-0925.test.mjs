/* ═══ 门禁：首页分类页签的悬停**只变色、不许有阴影**（2026-09-25 批 BR）══════════════════
   用户原话：「我现在鼠标放上去上面的这些标签，为什么这个阴影做的这么差呢？你现在这个阴影好像是
   每一个标签的**左边没有阴影，右边是有阴影的**，这样会导致有一部分**标签名字内容被阴影覆盖到**。
   你自己得想办法再调整一下。」

   ── 根因（CDP 的 CSS.getMatchedStylesForNode 实测出来的）────────────────────
   不是本地文件的规则，而是 `src/styles/design-tokens.css` 里那条**元素级兜底**：
     `button:hover:not(:disabled):not([aria-disabled='true']) { box-shadow: var(--sb-shadow-3) }`
   —— 它的本意是"给所有按钮一个悬停海拔信号"，对实色按钮成立；但页签是**纯文字**
   （无背景、无圆角），阴影底下没有形 → 一团脏雾；又长在 `overflow:auto` 的容器里 → 左右被裁得不均匀；
   而且画在 77×44 的按钮盒上 → 糊到相邻标签的字上。

   ── 这一组断言守什么 ────────────────────────────────────────────────────
     ① 那条全局兜底**仍然在**（它是有意的设计；这条断言是把依赖写在明面上，
        哪天它被删了，这里会提醒"本文件的复位可以一起清理"）；
     ② 本文件**必须**有那条复位，且选择器**权重必须高于**全局兜底 ——
        单纯写 `.skill-entry-categories button:hover` 只有 (0,2,1) **压不住** (0,3,1)，
        会让阴影静默回来（这正是本批差点漏掉的一点）；
     ③ 复位**必须用 `none`**，不许偷偷换成别的阴影；
     ④ 页签的悬停**仍有可见信号**（颜色变化）—— 不许为了去阴影把 hover 反馈一起删掉。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const row = readFileSync(new URL('../src/components/media/SkillEntryRow.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../src/styles/design-tokens.css', import.meta.url), 'utf8');

/* 粗略权重：类/属性/伪类各算 1，元素算 0.001 —— 够用来比"谁压得住谁"。 */
function specificity(selector) {
  const classes = (selector.match(/\.[a-zA-Z0-9_-]+/g) || []).length;
  const attrs = (selector.match(/\[[^\]]+\]/g) || []).length;
  const pseudoClasses = (selector.match(/:(?!:)[a-z-]+(\([^)]*\))?/g) || [])
    .filter(p => !/::/.test(p)).length;
  const elements = (selector.replace(/\[[^\]]+\]/g, '').match(/(^|[\s>+~])[a-z]+/g) || []).length;
  return classes + attrs + pseudoClasses + elements * 0.001;
}

test('① 全局兜底仍在（依赖写在明面上）', () => {
  assert.match(tokens, /button:hover:not\(:disabled\):not\(\[aria-disabled='true'\]\)\s*\{\s*box-shadow:/,
    '全局按钮悬停兜底没了 —— 若是有意删除，本文件的复位与这条断言可以一起清理');
});

test('② 本文件有复位，且权重高于全局兜底', () => {
  const globalSel = "button:hover:not(:disabled):not([aria-disabled='true'])";
  const resetBlock = row.match(/\.skill-entry-categories[^{]*\{[^}]*box-shadow:\s*none[^}]*\}/);
  assert.ok(resetBlock, '分类页签没有复位 box-shadow —— 悬停时会被全局兜底糊上一层雾');
  const resetSel = resetBlock[0].slice(0, resetBlock[0].indexOf('{')).trim();
  /* 复位里可能写了多组选择器（逗号分隔），取其中**最强**的那组来比 */
  const strongest = resetSel.split(',').map(s => s.trim())
    .reduce((best, s) => (specificity(s) > specificity(best) ? s : best), '');
  assert.ok(specificity(strongest) > specificity(globalSel),
    '复位选择器的权重压不住全局兜底：' + strongest + ' (' + specificity(strongest).toFixed(3) + ') vs ' +
    globalSel + ' (' + specificity(globalSel).toFixed(3) + ')');
});

test('③ 复位的值是 none（不许换成别的阴影）', () => {
  const resetBlock = row.match(/\.skill-entry-categories[^{]*\{[^}]*box-shadow:\s*none[^}]*\}/);
  assert.ok(resetBlock[0].includes('box-shadow: none'), '复位必须显式写 none');
});

test('④ 页签的悬停仍有可见信号（颜色变化没被一起删掉）', () => {
  assert.match(row, /\.skill-entry-categories button:hover\s*\{\s*color:/,
    '页签悬停只剩"没有阴影"了 —— 必须保留颜色变化，否则就是"可点却无反馈"');
});
