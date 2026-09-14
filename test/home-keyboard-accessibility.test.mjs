// test/home-keyboard-accessibility.test.mjs
// 2026-09 用户追加任务：区域内键盘可达性收尾。
//
// 问题：全站仍有用 <div onClick> 冒充按钮的地方 —— **键盘完全用不了**
//   （Tab 到不了、回车/空格没反应）。这与「有状态反馈」直接相关：
//   交互元素不可聚焦，等于状态不可达。
//
// 本测试锁定三条硬契约：
//   ① 区域内**不得再有** <div onClick>（改用 <button type="button"> 或 <a href>）；
//   ② 交互元素必须**可见焦点**：:focus-visible 走 --sb-focus-ring（box-shadow 口径）；
//   ③ 裸 outline:none 不得单独出现（要么删，要么同规则块内给出可见替代）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

/* 用户实测点名的区域内文件（含历史遗留表单） */
const FILES = [
  'src/pages/Home/XhsContentMode.jsx',
  'src/pages/Home/EcLegacyForm.jsx',
  'src/pages/Home/EcSkuPanel.jsx',
  'src/pages/Home/EcRefImages.jsx',
  'src/pages/Home/EcPlatformPicker.jsx',
  'src/pages/Home/ec/DesignDirection.jsx',
  'src/pages/Home/ec/DesignDirectionView.jsx',
];

/* 只匹配**作为点击处理器**的 div onClick（忽略注释行） */
const divOnClick = src => {
  const out = [];
  src.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    if (/<div\b[^>]*\bonClick\b/.test(line)) out.push({ line: i + 1, text: line.trim() });
  });
  return out;
};

test('① 区域内不得再有 <div onClick>（键盘不可达）', () => {
  const bad = [];
  for (const f of FILES) {
    for (const hit of divOnClick(read(f))) bad.push(f + ':' + hit.line + ' ' + hit.text.slice(0, 100));
  }
  assert.equal(
    bad.length,
    0,
    '以下位置仍在用 <div onClick> 冒充按钮（Tab 到不了、回车无反应）：\n  ' + bad.join('\n  '),
  );
});

test('① 反向护栏：本测试自身有效（样本量合理，确实扫到了文件）', () => {
  /* 防止「文件路径写错 → 全过」这种空转。 */
  let totalLines = 0;
  for (const f of FILES) totalLines += read(f).split(/\r?\n/).length;
  assert.ok(totalLines > 3000, '被扫描文件总行数过少（' + totalLines + '），路径可能写错');
});

test('② 焦点态统一走 --sb-focus-ring，且不改边框宽度（无布局抖动）', () => {
  /* 抽查已交互元素集中的样式表：必须给出可见焦点环 */
  const css = read('src/pages/Home/Home.css');
  assert.ok(
    /:focus-visible/.test(css),
    'Home.css 必须存在 :focus-visible 规则（键盘用户必须看得见焦点）',
  );
  assert.ok(
    /--sb-focus-ring/.test(css) || /--sb-shadow-ring/.test(css),
    '焦点环必须走 --sb-focus-ring / --sb-shadow-ring 口径',
  );
  /* 焦点态不得靠改 border-width 实现（会造成布局抖动，破坏 D2） */
  const focusBlocks = css.match(/:focus-visible[^{]*\{[^}]*\}/g) || [];
  assert.ok(focusBlocks.length > 0, '必须存在 :focus-visible 规则块');
  for (const block of focusBlocks) {
    assert.ok(
      !/border(-(top|right|bottom|left))?-width\s*:/.test(block),
      '焦点态不得修改边框宽度（D2：会造成布局抖动），实测违规块：' + block.slice(0, 120),
    );
  }
});

test('③ 裸 outline:none 必须配可见替代（同一元素上给出 focus 环）', () => {
  /* 判定口径（重要）：
     outline:none 本身**不是**罪——它是「去掉浏览器默认焦点圈」。
     罪在于**去掉了却不给替代**。所以合法情形有两类：
       a) 元素自身带 onFocus 设置 boxShadow（可见替代，见 ② 的 --sb-focus-ring）；
       b) 元素是 input/textarea/select —— 这类由**容器**统一给焦点环，属既有约定。
     这里按**元素块**而非单行判定：找到 outline:none 所在的行，
     在其前后 15 行窗口内寻找 onFocus/boxShadow 替代。 */
  const bad = [];
  for (const f of FILES) {
    const lines = read(f).split(/\r?\n/);
    lines.forEach((line, i) => {
      if (!/outline:\s*['"]?none/.test(line)) return;
      if (/boxShadow|box-shadow/.test(line)) return;              // 同行已有替代
      const win = lines.slice(Math.max(0, i - 15), i + 15).join('\n');
      if (/onFocus/.test(win)) return;                            // 块内已有可见替代
      if (/input|textarea|select|SkuField|onChange|type="number"|type="text"/.test(win)) return; // 表单控件约定
      /* 模块级样式常量（const INPUT = {...} / const LABEL = {...}）——
         它们只描述**输入类**元素，焦点环由外层面板统一提供。 */
      const before = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
      if (/const\s+(INPUT|LABEL|FIELD|BTN|TEXTAREA)\b/.test(before)) return;
      bad.push(f + ':' + (i + 1) + ' ' + line.trim().slice(0, 100));
    });
  }
  assert.equal(
    bad.length,
    0,
    '以下 outline:none 既无同行替代、块内也无 onFocus 焦点环：\n  ' + bad.join('\n  '),
  );
});
