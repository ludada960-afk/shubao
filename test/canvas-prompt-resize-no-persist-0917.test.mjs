// test/canvas-prompt-resize-no-persist-0917.test.mjs
// 2026-09-17 用户决定（输入框拉伸不持久化）：
//   「你为什么要记住他拖动的高度呢？用户是在输入太长的时候才会去拖。
//    正常情况下他不需要每次打开都看到非常大的输入框。你一开始做小一些没问题，
//    但要有可以拖动的功能。他在真正需要输入大片文字时觉得框小了才会去拖。
//    所以没必要保存上一次拖动的高度。」
// → 保持：默认小 / 可拖 / 不记忆 / 不持久化。本测试把这条产品决定钉住，
//   防止后续有人"顺手优化"成持久化。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const studio = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasStudio.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/pages/EcCanvas/EcCanvas.css', import.meta.url), 'utf8');
const limits = readFileSync(new URL('../src/constants/promptLimits.js', import.meta.url), 'utf8');

function promptFieldBody() {
  const start = studio.indexOf('const CanvasPromptField = forwardRef(');
  const end = studio.indexOf('/* 9-13 用户批注：四个生成框要**共用同一个技能入口**', start);
  return studio.slice(start, end > start ? end : start + 12000);
}

test('拉伸高度必须是组件内 state，不得持久化（产品明确决定）', () => {
  const body = promptFieldBody();
  assert.ok(/const \[height, setHeight\] = useState\(/.test(body), '高度必须是组件内 useState');
  assert.ok(!/localStorage/.test(body), '不得写 localStorage');
  assert.ok(!/sessionStorage/.test(body), '不得写 sessionStorage');
  assert.ok(!/indexedDB/.test(body), '不得写 indexedDB');
});

test('高度不得写回节点数据（否则会因为节点保存而被间接持久化）', () => {
  const body = promptFieldBody();
  /* onChange 只能传用户真正编辑的内容键，不许出现 promptHeight / resizeHeight 这类字段 */
  assert.ok(!/promptHeight|resizeHeight|fieldHeight/.test(studio), '不得有任何"记住高度"的字段');
});

test('代码里写明这是产品决定（避免后人误以为是漏做）', () => {
  assert.ok(/产品决定：拉伸高度\*\*不记忆、不持久化\*\*/.test(studio), '必须留下产品决定注释');
  assert.ok(/请勿"优化"成持久化/.test(studio), '必须明确劝阻后续改成持久化');
});

test('默认高度 = 规范下限（3 行），且上限 12 行（到顶内部滚动）', () => {
  assert.ok(/PROMPT_MIN_ROWS = 3/.test(limits), '下限 3 行');
  assert.ok(/PROMPT_MAX_ROWS = 12/.test(limits), '上限 12 行');
  /* CSS：默认取 --ec-prompt-min-h；到顶后输入框自身 overflow:auto */
  const boxRule = css.match(/\.ec-canvas-prompt-resize \{[^}]*\}/s)?.[0] || '';
  assert.ok(boxRule.includes('height: var(--ec-prompt-height, var(--ec-prompt-min-h, 102px))'),
    '默认高度必须回落到下限（小），而不是上限');
  const fieldRule = css.match(/\.ec-canvas-prompt-resize > \.mention-prompt-field \{[^}]*\}/s)?.[0] || '';
  assert.ok(fieldRule.includes('overflow: auto'), '到顶后必须内部滚动');
  assert.ok(fieldRule.includes('resize: none'), '不得依赖 CSS 原生 resize');
});

test('消费端不得把输入框下限压成 0（会让"默认 3 行"失效）', () => {
  /* 实测踩过的坑：.ec-canvas-context-composer > .ec-canvas-prompt-resize 原写
     min-height: 0 + flex: 0 1 auto，把输入框压到 69px（3 行下限失效），
     且拖动上限被压到 219px（应到 322px）。 */
  const override = css.match(/\.ec-canvas-context-composer > \.ec-canvas-prompt-resize \{[^}]*\}/s)?.[0] || '';
  assert.ok(override, '必须存在该覆盖规则');
  assert.ok(!/min-height:\s*0\b/.test(override), '不得把 min-height 压成 0');
  assert.ok(override.includes('min-height: var(--ec-prompt-min-h'), '必须保留输入框自身下限');
  assert.ok(/flex:\s*0 0 auto/.test(override), '必须不可收缩，否则内容自适应面板会把它压小');
});
