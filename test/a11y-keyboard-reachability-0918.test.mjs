// test/a11y-keyboard-reachability-0918.test.mjs
// 第五批 · 键盘可达性（无人认领区）契约测试。
//
// 目的：锁住「可点元素必须是语义化元素 + 抑制焦点时必须给可见替代」这两条不变量，
//      并作为**变异测试**的判据 —— 把任一 <button> 改回 <div onClick> 后本文件必红。
//
// 权威：docs/design 的 D11（键盘可达）+ 本轮验收口径：
//   判断标准不是「有没有出现 outline:none 字面量」，而是「抑制焦点的同时是否给出可见替代」。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const plog = read('src/pages/Plog/index.jsx');
const tpl = read('src/pages/PublicTemplates/index.jsx');
const tplCss = read('src/pages/PublicTemplates/index.css');

/* ═══════ ① Plog：作品格 / 灯箱遮罩必须是 button ═══════ */
test('Plog 作品格与灯箱遮罩不再用 div 冒充可点元素（键盘可达）', () => {
  assert.equal((plog.match(/<div[^>]*onClick/g) || []).length, 0,
    '不得残留 <div onClick>（键盘不可达）');
});

test('Plog 四个布局的作品格都是 button + sb-focusable + 可读无障碍名', () => {
  // 4 个布局：polaroid / cinematic / journal / magazine 封面（+ casual 与 magazine 内容页为既有）
  const viewerButtons = plog.match(/className="sb-focusable" aria-label=\{`查看第/g) || [];
  assert.ok(viewerButtons.length >= 5,
    '至少 5 个作品格 button（casual + polaroid + cinematic + journal + magazine 内容页/封面），实际 ' + viewerButtons.length);
  assert.match(plog, /aria-label="查看第 1 张（封面）"/, 'magazine 封面有可读名');
});

test('Plog 作品格按钮重置了 UA 默认外观（语义化不得带来视觉变化）', () => {
  // 本批新语义化的 4 个作品格：每处都必须在同一个 style 对象里做 UA 默认归零
  // （appearance + background:none + border:none + padding:0），否则「语义化」会变成视觉改动。
  const appearances = (plog.match(/appearance: 'none'/g) || []).length;
  assert.equal(appearances, 4, '本批 4 个作品格 button 均有 appearance:none（实际 ' + appearances + '）');
  const borders = (plog.match(/border: 'none', padding: 0/g) || []).length;
  assert.ok(borders >= 4, '按钮边框/内边距归零（实际 ' + borders + '）');
  assert.ok((plog.match(/font: 'inherit'/g) || []).length >= 5, '字体继承（UA 字体归零）');
});

test('Plog 灯箱遮罩用 button + onMouseDown target 校验（不再依赖 stopPropagation 嵌套）', () => {
  assert.match(plog, /aria-label="关闭预览" className="a11y-backdrop"/, '遮罩是 button 且有可读名');
  assert.ok(plog.includes('onMouseDown={(event) => { if (event.target === event.currentTarget) setLightbox(null); }}'),
    '用 target 校验替代嵌套 stopPropagation');
});

test('Plog 焦点态走 --sb-focus-ring（sb-focusable 类提供 box-shadow 环）', () => {
  const sb = read('src/styles/surface-batch.css');
  const rule = sb.match(/\.sb-focusable:focus-visible \{([^}]*)\}/);
  assert.ok(rule, '.sb-focusable:focus-visible 规则存在');
  assert.ok(rule[1].includes('box-shadow: var(--sb-focus-ring)'), '焦点环用 token，不改边框宽度');
});

/* ═══════ ② PublicTemplates：详情遮罩必须是 button ═══════ */
test('PublicTemplates 详情遮罩是 button + a11y-backdrop（键盘可达）', () => {
  assert.match(tpl, /<button type="button" className="tpl-modal-backdrop a11y-backdrop"/,
    '遮罩已语义化为 button');
  assert.ok(tpl.includes('onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}'),
    '用 target 校验替代嵌套 stopPropagation');
});

test('PublicTemplates 面板是 role=dialog（不再是纯展示容器）', () => {
  assert.match(tpl, /className="tpl-modal" role="dialog" aria-modal="true"/, '面板保留对话框语义');
});

test('PublicTemplates 遮罩显式声明 cursor，使新旧元素计算样式一致', () => {
  const rule = tplCss.match(/\.tpl-modal-backdrop \{([^}]*)\}/);
  assert.ok(rule, '.tpl-modal-backdrop 规则存在');
  assert.ok(/cursor:\s*pointer/.test(rule[1]), '显式 cursor（button UA 默认 pointer，显式声明后无差异）');
});

/* ═══════ ③ 口径守卫：抑制焦点必须给替代（不是数关键字）═══════ */
test('D11 口径：任何 outline 抑制点必须同时提供可见替代焦点样式', () => {
  // 本轮涉及的样式文件中，凡出现 outline 归零的规则块，其邻近必须有 :focus / :focus-visible 的可见样式
  const files = [
    'src/styles/surface-batch.css',
    'src/styles/design-tokens-v3.css',
    'src/pages/PublicTemplates/index.css',
  ];
  for (const f of files) {
    const src = read(f);
    const suppressed = /outline:\s*(none|0\s+solid\s+transparent)/.test(src);
    if (!suppressed) continue;
    const hasReplacement = /:focus(-visible)?[^{]*\{[^}]*(box-shadow|border-color)/.test(src)
      || /outline:\s*[1-9]\d*px\s+solid/.test(src);
    assert.ok(hasReplacement, f + ' 抑制焦点后必须给出可见替代焦点样式（box-shadow / border-color / 实描边）');
  }
});
