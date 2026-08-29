import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import {
  CANVAS_CREATION_OPTIONS,
  getCanvasFocusIds,
  getContextMenuPosition,
} from '../src/pages/EcCanvas/canvasInteractionModel.js';
import {
  CANVAS_ACTIONS,
  getCanvasAction,
  actionsForSurface,
} from '../src/pages/EcCanvas/canvasActionRegistry.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const cssPath = resolve(repoRoot, 'src/styles/canvas-derive-menu.css');
const ecCanvasCssPath = resolve(repoRoot, 'src/pages/EcCanvas/EcCanvas.css');
const ecCanvasIndexPath = resolve(repoRoot, 'src/pages/EcCanvas/index.jsx');
const canvasStudioPath = resolve(repoRoot, 'src/pages/EcCanvas/components/CanvasStudio.jsx');
const heroIconsPath = resolve(repoRoot, 'src/pages/EcCanvas/components/HeroIcons.jsx');

/* 4c183cd4 续命 P-Canvas 派生菜单 14-action 契约测试 (3 大类共 14 测试)
   1) 14 action 数据契约 (5 原有 + 9 新增, group 分桶, 顺序, label/description 完整)
   2) 独立 CSS 资产契约 (src/styles/canvas-derive-menu.css 存在, 关键字匹配, EcCanvas.css 抽离干净)
   3) 14 action 视觉/集成契约 (CanvasStudio 14 icon, HeroIcons 3 glyph, onSelect 14 路由) */

/* 1) 14 action 数据契约 */

test('derive menu exposes exactly 14 actions (5 原有 + 9 新增, 4c183cd4 续命 硬性要求)', () => {
  assert.equal(CANVAS_CREATION_OPTIONS.length, 14, '14 个 action: 5 原有 + 9 新增');
  const ids = CANVAS_CREATION_OPTIONS.map(option => option.id);
  for (const legacyId of ['text-generation', 'image-edit', 'ecommerce-suite', 'video-upload', 'video-generation']) {
    assert.ok(ids.includes(legacyId), '5 原有 action 缺 ' + legacyId);
  }
  for (const newId of [
    'ai-storyboard', 'one-click-suite', 'tts-voiceover', 'caption-motion',
    'similar-recommend', 'one-click-video', 'bg-removal', 'color-grade', 'derive-1click',
  ]) {
    assert.ok(ids.includes(newId), '9 新增 action 缺 ' + newId);
  }
});

test('14 actions are bucketed into 3 groups (core 5 / magic 5 / expand 4)', () => {
  const buckets = { core: [], magic: [], expand: [], other: [] };
  for (const option of CANVAS_CREATION_OPTIONS) {
    const g = option.group || 'other';
    (buckets[g] || buckets.other).push(option.id);
  }
  assert.deepEqual(buckets.core.sort(), ['ecommerce-suite', 'image-edit', 'text-generation', 'video-generation', 'video-upload'], 'core 5 = 5 原有');
  assert.deepEqual(buckets.magic.sort(), ['ai-storyboard', 'caption-motion', 'one-click-suite', 'similar-recommend', 'tts-voiceover'], 'magic 5 = AI 智能 (流影AI 风格)');
  assert.deepEqual(buckets.expand.sort(), ['bg-removal', 'color-grade', 'derive-1click', 'one-click-video'], 'expand 4 = 扩展工具');
  assert.equal(buckets.other.length, 0, '所有 action 必须分桶, 不允许 ungrouped');
});

test('14 actions preserve display order (core 先, magic 中, expand 后)', () => {
  const groupOrder = CANVAS_CREATION_OPTIONS.map(option => option.group);
  assert.deepEqual(groupOrder, [
    'core', 'core', 'core', 'core', 'core',
    'magic', 'magic', 'magic', 'magic', 'magic',
    'expand', 'expand', 'expand', 'expand',
  ], '顺序必须按 core(5) -> magic(5) -> expand(4)');
});

test('every derive action exposes label, description, and Object.freeze (immutable)', () => {
  for (const option of CANVAS_CREATION_OPTIONS) {
    assert.equal(typeof option.label, 'string', 'action ' + option.id + ' 必须有 label');
    assert.ok(option.label.length > 0, 'action ' + option.id + ' label 不能为空');
    assert.equal(typeof option.description, 'string', 'action ' + option.id + ' 必须有 description');
    assert.ok(option.description.length > 0, 'action ' + option.id + ' description 不能为空');
    assert.equal(Object.isFrozen(option), true, 'action ' + option.id + ' 必须 Object.freeze');
  }
});

test('every derive action with a priceLabel follows the 积分/积分起 format', () => {
  for (const option of CANVAS_CREATION_OPTIONS) {
    if (option.priceLabel) {
      assert.match(
        option.priceLabel,
        /^(\d+(\.\d+)?积分|免费|\d+积分起)$/,
        'action ' + option.id + ' priceLabel=' + option.priceLabel + ' 格式必须为 <数字>积分 或 <数字>积分起 或 免费',
      );
    }
  }
  const video = CANVAS_CREATION_OPTIONS.find(o => o.id === 'video-generation');
  assert.equal(video.priceLabel, '32积分起', 'video-generation 必须标价 32积分起');
  const storyboard = CANVAS_CREATION_OPTIONS.find(o => o.id === 'ai-storyboard');
  assert.equal(storyboard.priceLabel, '18积分', 'ai-storyboard 必须标价 18积分');
  const tts = CANVAS_CREATION_OPTIONS.find(o => o.id === 'tts-voiceover');
  assert.equal(tts.priceLabel, '8积分', 'tts-voiceover 必须标价 8积分');
});

/* 2) 独立 CSS 资产契约 */

test('canvas-derive-menu.css exists as a standalone asset in src/styles/', () => {
  assert.ok(existsSync(cssPath), 'src/styles/canvas-derive-menu.css 必须存在 (用户硬性要求)');
  const css = readFileSync(cssPath, 'utf8');
  assert.ok(css.length > 1000, 'CSS 文件 > 1KB (含 14-action grid 全部规则)');
});

test('canvas-derive-menu.css contains 14-action grid + 3 bucket markers + glass + dark mode', () => {
  const css = readFileSync(cssPath, 'utf8');
  assert.match(css, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/, '桌面 3 列 grid 必填');
  assert.match(css, /@media \(max-width: 960px\)[\s\S]*grid-template-columns:\s*repeat\(2,/, '平板 2 列 grid 必填');
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*grid-template-columns:\s*1fr/, '移动 1 列 grid 必填');
  for (const b of ['is-core', 'is-magic', 'is-expand']) {
    assert.ok(css.indexOf('.ec-canvas-derive-bucket.' + b) !== -1, b + ' 桶标记必填');
  }
  assert.match(css, /backdrop-filter:\s*blur\(18px\) saturate\(160%\)/, '毛玻璃 backdrop-filter 必填');
  assert.match(css, /\[data-theme="dark"\]\s*\.ec-canvas-derive-tile/, '暗色模式适配必填');
});

test('canvas-derive-menu.css declares the 14-action tile hover lift + chip + meta contract', () => {
  const css = readFileSync(cssPath, 'utf8');
  assert.match(css, /\.ec-canvas-derive-tile\s*\{/, 'tile 必填');
  assert.match(css, /\.ec-canvas-derive-tile:hover\s*\{[^}]*transform:\s*translateY\(-2px\)/, 'hover lift -2px 必填');
  assert.match(css, /\.ec-canvas-derive-tile:hover\s*\{[^}]*box-shadow:\s*var\(--shadow-md\)/, 'hover shadow 必填');
  assert.match(css, /\.ec-canvas-derive-tile\s+\.ec-canvas-derive-chip/, 'chip 必填');
  assert.match(css, /\.ec-canvas-derive-tile:hover\s+\.ec-canvas-derive-chip\s*\{[^}]*background:\s*var\(--accent\)/, 'hover 时 chip 变 accent 必填');
  assert.match(css, /\.ec-canvas-derive-tile\s+\.ec-canvas-derive-meta/, 'meta 必填');
  assert.match(css, /\.ec-canvas-derive-tile\s+\.ec-canvas-derive-meta\s+em/, '价格徽标 em 必填');
});

test('EcCanvas.css no longer carries the 4c183cd4 derive block (extracted to canvas-derive-menu.css)', () => {
  const css = readFileSync(ecCanvasCssPath, 'utf8');
  assert.doesNotMatch(css, /14-action 深度重构/, 'EcCanvas.css 14-action 块必须已抽离');
  assert.ok(css.includes('.ec-canvas-derive-menu'), 'EcCanvas.css 仍可保留 .ec-canvas-derive-menu 兼容样式 (旧版 .ec-canvas-add-menu 共用选择器)');
});

/* 3) 14 action 视觉/集成契约 */

test('EcCanvas/index.jsx imports the new canvas-derive-menu.css asset', () => {
  const jsx = readFileSync(ecCanvasIndexPath, 'utf8');
  assert.match(jsx, /import\s+['"]\.\.\/\.\.\/styles\/canvas-derive-menu\.css['"]/, 'EcCanvas/index.jsx 必须 import canvas-derive-menu.css');
});

test('CanvasStudio.jsx ships the 14-action DERIVE_ICONS map (5 原有 + 9 新增)', () => {
  const studio = readFileSync(canvasStudioPath, 'utf8');
  for (const iconName of [
    'Theater', 'Grid2X2', 'Film', 'Mic', 'Captions',
    'Eraser', 'Palette', 'Eye', 'SlidersHorizontal',
  ]) {
    assert.ok(studio.includes(iconName), 'CanvasStudio.jsx 必须 import lucide-react ' + iconName);
  }
  for (const legacyIcon of ['MessageSquareText', 'Sparkles', 'WandSparkles', 'FileVideo', 'ImagePlay']) {
    assert.ok(studio.includes(legacyIcon), 'CanvasStudio.jsx 必须 import 5 原有 lucide-react ' + legacyIcon);
  }
});

test('CanvasDeriveMenu renders 3 buckets (core / magic / expand) and 14 grid tiles', () => {
  const studio = readFileSync(canvasStudioPath, 'utf8');
  for (const bucket of ['core', 'magic', 'expand']) {
    assert.ok(studio.indexOf("id: '" + bucket + "'") !== -1, 'CanvasDeriveMenu 必须定义 ' + bucket + ' 桶');
  }
  for (const label of ['核心常用', 'AI 智能', '扩展工具']) {
    assert.ok(studio.includes(label), 'CanvasDeriveMenu 必须有 ' + label + ' label');
  }
  for (const cls of ['ec-canvas-derive-grid', 'ec-canvas-derive-tile', 'ec-canvas-derive-bucket', 'ec-canvas-derive-scroll']) {
    assert.ok(studio.includes(cls), '必须使用 .' + cls + ' 类');
  }
});

test('HeroIcons.jsx ships the 3 new central modal glyphs (storyboard / voiceover / oneclick)', () => {
  const hero = readFileSync(heroIconsPath, 'utf8');
  for (const iconName of ['Theater', 'Mic', 'Film']) {
    assert.ok(hero.includes(iconName), 'HeroIcons.jsx 必须 import lucide-react ' + iconName);
  }
  for (const kind of ['storyboard', 'voiceover', 'oneclick']) {
    assert.ok(hero.indexOf(kind + ':') !== -1, 'HeroIcons.jsx 必须注册 kind=' + kind + ' glyph');
  }
});

test('right-side onSelect router handles all 14 derive action ids', () => {
  const jsx = readFileSync(ecCanvasIndexPath, 'utf8');
  for (const legacyId of ['text-generation', 'ecommerce-suite', 'video-upload', 'video-generation', 'image-edit']) {
    assert.ok(jsx.indexOf("action.id === '" + legacyId + "'") !== -1, '右面板 onSelect 必须路由 ' + legacyId);
  }
  for (const newId of [
    'bg-removal', 'color-grade', 'tts-voiceover', 'caption-motion', 'ai-storyboard',
    'one-click-suite', 'one-click-video', 'similar-recommend', 'derive-1click',
  ]) {
    assert.ok(jsx.indexOf("action.id === '" + newId + "'") !== -1, '右面板 onSelect 必须路由 ' + newId);
  }
  assert.ok(jsx.indexOf("actionId: 'remove-bg'") !== -1, 'bg-removal 必须复用 remove-bg 既有节点');
  assert.ok(jsx.indexOf("getCanvasAction('product-remix')") !== -1, 'derive-1click 必须复用 product-remix (Clone Project)');
});
