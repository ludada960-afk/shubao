// test/home-skill-library-layout-0915.test.mjs
// 2026-09-15 用户批注①（图2）：
//  ① 「技能库应该再往上挪一些，上面和下面的间隙都没有保持一致，
//     上面空这么多，下面又那么少」
//  ② 「右下角确实有一个可以拉动的手柄，但我一拉就直接往下面截断了，
//     根本没有办法拉动。你这个逻辑是怎么设计的？」
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const rawCss = read('src/pages/Home/ec/skill-library.css');
const modal = read('src/pages/Home/ec/SkillLibraryModal.jsx');

/* 断言必须只针对「生效的样式」，不能被我自己的解释性注释误伤 ——
   注释里会引用旧写法（例如「搭配 textarea{height:100%; resize:vertical}」）
   作为根因说明，剥掉注释后再匹配才是真实规则。 */
const stripComments = source => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const css = stripComments(rawCss);

test('断言基线自检：注释剥离后规范字符串确实不在生效样式中', () => {
  assert.ok(!css.includes('/*'), '剥离后不应残留块注释');
  assert.ok(rawCss.includes('resize:vertical'), '原始文本里仍保留根因说明（供后人理解），属预期');
});

/* ── ① 上下留白对称 ── */
test('① 弹窗遮罩上下内边距取自同一档变量（实测 72/16 → 24/24）', () => {
  /* 根因：padding: 72px 24px 16px —— 顶部让开导航预留 72，底部只留 16，差 56px */
  assert.ok(!/padding:\s*72px 24px 16px/.test(css), '不得再出现 72/16 的不对称内边距');
  assert.ok(css.includes('--sk-gap: 24px'), '上下留白必须收敛到同一档 --sk-gap（24px）');
  assert.ok(
    /padding:\s*var\(--sk-gap\)\s*;/.test(css),
    '遮罩必须用同一变量控制四边（尤其上下必须同值）',
  );
  assert.ok(/place-items:\s*center/.test(css), '弹窗必须垂直居中（居中 + 对称内边距 = 上下等距）');
});

test('① 弹窗高度上限与对称内边距配套（100vh - 2*gap）', () => {
  assert.ok(
    /height:\s*calc\(100vh - var\(--sk-gap\) \* 2\)/.test(css),
    '弹窗高度上限必须是 100vh - 2*--sk-gap，才能保证上下各留同一档留白',
  );
  assert.ok(
    /max-height:\s*calc\(100vh - var\(--sk-gap\) \* 2\)/.test(css),
    'max-height 必须与 height 用同一口径',
  );
});

/* ── ② 拉伸手柄真正可用（不被截断） ── */
test('② 技能提示词改用受控 ResizableTextarea，不再依赖 CSS resize:vertical', () => {
  assert.ok(modal.includes('ResizableTextarea'), '必须改用受控组件');
  assert.ok(!/<textarea\b/.test(modal), '不得再直接用裸 <textarea>');
  /* 根因护栏：CSS resize + flex height:100% + 父级 overflow:hidden = 一拉就截断 */
  assert.ok(
    !/\.skill-column\.is-editor \.skill-field textarea \{ height: 100%/.test(css),
    '不得再让 flex 用 height:100% 覆写文本域高度（这正是「拉不动」的根因）',
  );
  assert.ok(
    !/resize:\s*vertical/.test(css),
    '不得保留 resize:vertical（inline height 会被 flex basis/stretch 覆写）',
  );
  assert.ok(
    !/\.skill-column\.is-editor \.skill-field:has\(textarea\)[^}]*overflow:\s*hidden/.test(css),
    '弹性字段容器不得再 overflow:hidden（会把拉出来的高度直接裁掉）',
  );
});

test('② 弹性字段选择器已跟进到 .rsz-textarea（否则让位逻辑失效）', () => {
  assert.ok(
    css.includes('.skill-column.is-editor .skill-field:has(.rsz-textarea)'),
    '必须用 :has(.rsz-textarea) 匹配新的包裹结构',
  );
  assert.ok(
    css.includes('.skill-column.is-editor .skill-field .rsz-textarea > textarea'),
    '受控文本域必须在弹性字段内可被压缩（min-height:0）',
  );
});

test('② 拉伸上限受栏内可视空间约束，按钮组始终可见', () => {
  assert.ok(modal.includes('available='), '必须传入可用高度上限');
  assert.ok(modal.includes('minHeight={132}'), '下限保持 132px（约 4-5 行，仍然好写）');
  assert.ok(modal.includes('maxHeight='), '必须有明确上限，避免把按钮组推出可视区');
  /* 上限必须是「视口高度的一个比例」（<100%），保证拉到顶时表单其余部分仍在弹窗内 */
  const maxExpr = modal.match(/maxHeight=\{([^}]*)\}/);
  assert.ok(maxExpr, 'maxHeight 必须由表达式计算，而不是写死像素');
  const factor = Number((maxExpr[1].match(/\*\s*0?\.(\d+)/) || [])[1]);
  assert.ok(factor > 0 && factor < 100, '上限必须是视口高度的一个小于 100% 的比例：' + maxExpr[1]);
  assert.ok(!/max-height:\s*46vh/.test(css), '旧的 46vh CSS 上限已被受控组件取代，避免双重约束打架');
});
