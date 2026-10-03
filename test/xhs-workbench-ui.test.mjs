import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const deck = await readFile(new URL('../src/pages/Home/ec/components/SupplementAssetDeck.jsx', import.meta.url), 'utf8');
const ecommerceCards = await readFile(new URL('../src/pages/Home/ec/components/EcommerceAssetCards.jsx', import.meta.url), 'utf8');
const xhs = await readFile(new URL('../src/pages/Home/XhsContentMode.jsx', import.meta.url), 'utf8');
const showcaseStyles = await readFile(new URL('../src/pages/Home/CreationShowcase.css', import.meta.url), 'utf8');

test('shared deck keeps ecommerce default and allows straight XHS rendering', () => {
  assert.match(deck, /tilted\s*=\s*true/);
  assert.match(xhs, /EcommerceImageCard/);
});

test('XHS controls use independent option keys and upward panel class', () => {
  assert.match(xhs, /activeOption/);
  assert.match(xhs, /onOptionToggle/);
  assert.match(xhs, /xhs-template-options--upward/);
});

test('XHS compact workbench puts content and Plog in the shared top selector', () => {
  assert.match(xhs, /function XhsModeSelector/);
  assert.match(xhs, /className="ec-ability-selector xhs-ability-selector"/);
  assert.match(xhs, /className=\{`ec-ability-selector-option/);
  assert.match(xhs, /aria-selected=\{selected\}/);
  /* 2026-10-03 批 1003（用户第三次表态）：旧版首页的案例表达区**子页面也不再挂**。
     「把它给删掉吧，避免后面会有一些互相引用或者互相映射导致的混乱」——
     这条断言原本要求它在，现在反转成不许它在。
     切换器本身与真功能控件（XhsInputTemplate）一个字不动。 */
  assert.doesNotMatch(xhs, /<CreationShowcase/,
    '子页面不得再渲染旧版首页的案例表达区');
  assert.match(xhs, /<XhsInputTemplate/,
    '真功能控件（上传 / 文案 / @提及 / 生成）必须保留');
  assert.doesNotMatch(xhs, /className="xhs-mode-tabs"/);
});

test('XHS option trigger points upward while its panel is open', () => {
  assert.match(xhs, /xhs-template-chevron/);
  assert.match(xhs, /activeOption === key \? ' is-open' : ''/);
  assert.match(xhs, /xhs-template-options--upward/);
});

test('XHS selector styles keep the fan cards and mobile panel inside the workbench', () => {
  assert.match(showcaseStyles, /\.xhs-ability-selector \.ec-ability-selector-fan\.is-empty/);
  assert.match(showcaseStyles, /\.xhs-workbench-card/);
  assert.match(showcaseStyles, /\.xhs-template-options--upward \{ left: 0;/);
});

test('XHS reuses the ecommerce upload cards and localizes only the content labels', () => {
  assert.match(xhs, /EcommerceImageCard/);
  assert.match(xhs, /EcommerceAddCard/);
  assert.match(xhs, /我的素材/);
  assert.match(xhs, /生活素材/);
  assert.match(ecommerceCards, /ec-xhs-upload-card/);
});

test('XHS workbench keeps the ecommerce spacing and full article body', () => {
  assert.match(showcaseStyles, /\.xhs-input-template \.ec-xhs-composer \{ padding: 8px 10px 10px/);
  assert.match(showcaseStyles, /\.xhs-input-template \.ec-xhs-prompt \{ display: flex; height: 92px; min-height: 92px;/);
  assert.match(showcaseStyles, /textarea\.xhs-prompt-field \{ display: block; width: 100%; min-height: 0; flex: 1 1 auto;/);
  assert.match(showcaseStyles, /\.xhs-template-tools \{ display: flex !important; justify-self: auto; width: auto; max-width: none; flex: 1 1 auto !important;/);
  assert.match(showcaseStyles, /\.xhs-template-actions \{ position: relative; margin: 0; padding: 0;/);
  assert.match(showcaseStyles, /\.xhs-template-actions \.ec-workbench-primary-row \{ display: flex; height: 52px; min-height: 52px; align-items: center; gap: 6px;/);
  assert.match(showcaseStyles, /\.xhs-template-actions \.ec-workbench-next \{ height: 38px; min-width: 0; padding: 0 22px;.*border-radius: 12px;/);
  assert.match(showcaseStyles, /\.xhs-template-option-slot \{ position: relative; display: flex; width: fit-content; height: 52px;/);
  assert.doesNotMatch(showcaseStyles, /\.xhs-input-template \.ec-xhs-prompt \{[^}]*min-height: 156px/);
  assert.doesNotMatch(showcaseStyles, /\.xhs-input-template \.ec-xhs-prompt textarea\.xhs-prompt-field \{[^}]*min-height: 116px/);
  assert.doesNotMatch(showcaseStyles, /min-height: 56px/);
  assert.doesNotMatch(showcaseStyles, /\.xhs-template-actions \.ec-workbench-next \{ min-width/);
  assert.match(showcaseStyles, /\.creation-showcase-content-image-media img/);
  assert.match(showcaseStyles, /\.xhs-ability-selector \.ec-ability-selector-fan-card \{ top: 50%; width: 56px; height: 74px/);
  assert.match(showcaseStyles, /\.xhs-workbench-card \{ margin: 0; padding: 0; border: 0/);
  assert.match(xhs, /\['style', '内容风格'/);
  assert.match(xhs, /\['topic', '热门主题'/);
  assert.doesNotMatch(xhs, /\['settings', '生成设置'/);
  assert.doesNotMatch(xhs, /\['structure', '发布方案'/);
  assert.doesNotMatch(xhs, /\['rules', '发布规范'/);
});

test('XHS prompt owns a visible native caret and focuses from its full surface', () => {
  /* 判据是「**整面可点即聚焦**」（点包裹层的任意处都把光标交给输入框），
     **不是**「必须用 onClick 事件」。事件名是实现的细节：
     用 onClick 时，mousedown 会先把焦点给到被点的内层元素、click 再抢回来 → **焦点闪一下、原生光标位置丢失**；
     用 onMouseDown 则一开始就不让焦点跑掉，跟手感更好。
     2026-09-20 依原则 §12「指标必须测量判据本身」：断言改为接受两种等价实现，
     这样两条线各自改事件名都不会把这条判据打成假红（此前 onMouseDown 版本在主干上是稳定红）。 */
  assert.match(
    xhs,
    /on(?:Click|MouseDown)=\{event => \{ if \(event\.target !== promptRef\.current\) promptRef\.current\?\.focus\(\); \}\}/,
    '点包裹层任意处都必须把焦点交给输入框（整面可点即聚焦）',
  );
  assert.match(xhs, /className="xhs-prompt-field"/);
  assert.match(xhs, /ec-xhs-prompt-hints/);
  assert.match(xhs, /aria-describedby=\{`xhs-prompt-placeholder-/);
  assert.doesNotMatch(xhs, /className=\{!text \? 'ec-empty' : ''\}/);
  assert.doesNotMatch(showcaseStyles, /textarea\.ec-empty\s*\{\s*caret-color/);
});

test('XHS publish showcase uses a bounded 3x3 contact sheet and clamps copy', () => {
  assert.match(showcaseStyles, /\.creation-showcase-content-images \{ display: grid; grid-template-columns: repeat\(3/);
  assert.match(showcaseStyles, /aspect-ratio: 1 \/ 1/);
  assert.match(showcaseStyles, /-webkit-line-clamp: 7/);
  assert.match(showcaseStyles, /\.xhs-case-showcase \.creation-showcase-content-images \{ width: 100%; min-height: 0/);
});
