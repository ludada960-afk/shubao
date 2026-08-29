import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

import {
  CANVAS_CREATION_OPTIONS,
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

/* 4c183cd4 续命 P-Canvas 派生菜单 9-action 契约测试 (3 大类共 12 测试) v2
   用户 8-29 原话: "你看了吗? 你看我们现在线上的这个版本, 这些功能都是要保留的, 只是之前其中几个功能做的不够好"
   - 5 原有 全部保留 (text-generation / image-edit / ecommerce-suite / video-upload / video-generation)
   - 4 新增 (流影AI LibTV Agent 风格, 用户硬性指定):
     1-click 套图 / 1-click 视频模板 / TTS 配音 / 字幕动效
   - 总共 9 个 action (5 原有 + 4 流影AI), 用户认知路径, 资深美工+产品经理视角 */

/* 1) 9 action 数据契约 (4 测试) */

test('derive menu exposes exactly 9 actions (5 原有 + 4 流影AI, 4c183cd4 续命 硬性要求 v2)', () => {
  assert.equal(CANVAS_CREATION_OPTIONS.length, 9, '9 个 action: 5 原有 + 4 流影AI (用户硬性要求保留 5 原有)');
  const ids = CANVAS_CREATION_OPTIONS.map(option => option.id);
  /* 5 原有 (用户硬性要求全部保留) */
  for (const legacyId of ['text-generation', 'image-edit', 'ecommerce-suite', 'video-upload', 'video-generation']) {
    assert.ok(ids.includes(legacyId), '5 原有 action 缺 ' + legacyId);
  }
  /* 4 流影AI 新增 (用户硬性指定) */
  for (const newId of ['one-click-suite', 'one-click-video', 'tts-voiceover', 'caption-motion']) {
    assert.ok(ids.includes(newId), '4 流影AI 新增 action 缺 ' + newId);
  }
});

test('9 actions are bucketed into 2 groups (core 5 / magic 4)', () => {
  const buckets = { core: [], magic: [], other: [] };
  for (const option of CANVAS_CREATION_OPTIONS) {
    const g = option.group || 'other';
    (buckets[g] || buckets.other).push(option.id);
  }
  assert.deepEqual(buckets.core.sort(), ['ecommerce-suite', 'image-edit', 'text-generation', 'video-generation', 'video-upload'], 'core 5 = 5 原有 (用户硬性要求全部保留)');
  assert.deepEqual(buckets.magic.sort(), ['caption-motion', 'one-click-suite', 'one-click-video', 'tts-voiceover'], 'magic 4 = 4 流影AI LibTV Agent 风格 (用户硬性指定)');
  assert.equal(buckets.other.length, 0, '所有 action 必须分桶, 不允许 ungrouped');
});

test('9 actions preserve display order (core 先 5, magic 后 4)', () => {
  const groupOrder = CANVAS_CREATION_OPTIONS.map(option => option.group);
  assert.deepEqual(groupOrder, [
    'core', 'core', 'core', 'core', 'core',
    'magic', 'magic', 'magic', 'magic',
  ], '顺序必须按 core(5) -> magic(4)');
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

/* 2) 独立 CSS 资产契约 (3 测试) */

test('canvas-derive-menu.css exists as a standalone asset in src/styles/', () => {
  assert.ok(existsSync(cssPath), 'src/styles/canvas-derive-menu.css 必须存在 (用户硬性要求)');
  const css = readFileSync(cssPath, 'utf8');
  assert.ok(css.length > 1000, 'CSS 文件 > 1KB (含 9-action grid 全部规则)');
});

test('canvas-derive-menu.css contains 9-action grid + 2 bucket markers (core/magic) + glass + dark mode', () => {
  const css = readFileSync(cssPath, 'utf8');
  assert.match(css, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/, '桌面 3 列 grid 必填 (用户硬性要求 2-3 列)');
  assert.match(css, /@media \(max-width: 960px\)[\s\S]*grid-template-columns:\s*repeat\(2,/, '平板 2 列 grid 必填');
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*grid-template-columns:\s*1fr/, '移动 1 列 grid 必填');
  assert.ok(css.indexOf('.ec-canvas-derive-bucket.is-core') !== -1, 'core 桶标记必填 (5 原有)');
  assert.ok(css.indexOf('.ec-canvas-derive-bucket.is-magic') !== -1, 'magic 桶标记必填 (4 流影AI)');
  assert.match(css, /backdrop-filter:\s*blur\(18px\) saturate\(160%\)/, '毛玻璃 backdrop-filter 必填');
  assert.match(css, /\[data-theme="dark"\]\s*\.ec-canvas-derive-tile/, '暗色模式适配必填');
});

test('canvas-derive-menu.css declares the 9-action tile hover lift + chip + meta contract', () => {
  const css = readFileSync(cssPath, 'utf8');
  assert.match(css, /\.ec-canvas-derive-tile\s*\{/, 'tile 必填');
  assert.match(css, /\.ec-canvas-derive-tile:hover\s*\{[^}]*transform:\s*translateY\(-2px\)/, 'hover lift -2px 必填');
  assert.match(css, /\.ec-canvas-derive-tile:hover\s*\{[^}]*box-shadow:\s*var\(--shadow-md\)/, 'hover shadow 必填');
  assert.match(css, /\.ec-canvas-derive-tile\s+\.ec-canvas-derive-chip/, 'chip 必填');
  assert.match(css, /\.ec-canvas-derive-tile:hover\s+\.ec-canvas-derive-chip\s*\{[^}]*background:\s*var\(--accent\)/, 'hover 时 chip 变 accent 必填');
  assert.match(css, /\.ec-canvas-derive-tile\s+\.ec-canvas-derive-meta/, 'meta 必填');
  assert.match(css, /\.ec-canvas-derive-tile\s+\.ec-canvas-derive-meta\s+em/, '价格徽标 em 必填');
});

/* 3) 视觉/集成契约 (5 测试) */

test('EcCanvas/index.jsx imports the new canvas-derive-menu.css asset', () => {
  const jsx = readFileSync(ecCanvasIndexPath, 'utf8');
  assert.match(jsx, /import\s+['"]\.\.\/\.\.\/styles\/canvas-derive-menu\.css['"]/, 'EcCanvas/index.jsx 必须 import canvas-derive-menu.css');
});

test('CanvasStudio.jsx ships the 9-action DERIVE_ICONS map (5 原有 + 4 流影AI)', () => {
  const studio = readFileSync(canvasStudioPath, 'utf8');
  /* 4 流影AI icon 必须 import + 出现在 DERIVE_ICONS */
  for (const iconName of ['Grid2X2', 'Film', 'Mic', 'Captions']) {
    assert.ok(studio.includes(iconName), 'CanvasStudio.jsx 必须 import lucide-react ' + iconName);
  }
  /* 5 原有 (用户硬性要求保留) */
  for (const legacyIcon of ['MessageSquareText', 'Sparkles', 'WandSparkles', 'FileVideo', 'ImagePlay']) {
    assert.ok(studio.includes(legacyIcon), 'CanvasStudio.jsx 必须 import 5 原有 lucide-react ' + legacyIcon);
  }
});

test('CanvasDeriveMenu renders 2 buckets (core / magic) and 9 grid tiles', () => {
  const studio = readFileSync(canvasStudioPath, 'utf8');
  for (const bucket of ['core', 'magic']) {
    assert.ok(studio.indexOf("id: '" + bucket + "'") !== -1, 'CanvasDeriveMenu 必须定义 ' + bucket + ' 桶');
  }
  for (const label of ['核心常用', '流影AI 智能']) {
    assert.ok(studio.includes(label), 'CanvasDeriveMenu 必须有 ' + label + ' label');
  }
  for (const cls of ['ec-canvas-derive-grid', 'ec-canvas-derive-tile', 'ec-canvas-derive-bucket', 'ec-canvas-derive-scroll']) {
    assert.ok(studio.includes(cls), '必须使用 .' + cls + ' 类');
  }
});

test('HeroIcons.jsx ships the 4 new central modal glyphs (1-click 套图 / 1-click 视频 / TTS 配音 / 字幕动效)', () => {
  const hero = readFileSync(heroIconsPath, 'utf8');
  for (const iconName of ['Film', 'Mic', 'Captions']) {
    assert.ok(hero.includes(iconName), 'HeroIcons.jsx 必须 import lucide-react ' + iconName);
  }
  for (const kind of ['oneclick', 'voiceover', 'captions']) {
    assert.ok(hero.indexOf(kind + ':') !== -1, 'HeroIcons.jsx 必须注册 kind=' + kind + ' glyph');
  }
});

test('right-side onSelect router handles all 9 derive action ids (5 原有 + 4 流影AI)', () => {
  const jsx = readFileSync(ecCanvasIndexPath, 'utf8');
  /* 5 原有 (用户硬性要求保留) */
  for (const legacyId of ['text-generation', 'ecommerce-suite', 'video-upload', 'video-generation', 'image-edit']) {
    assert.ok(jsx.indexOf("action.id === '" + legacyId + "'") !== -1, '右面板 onSelect 必须路由 ' + legacyId);
  }
  /* 4 流影AI 新增 (用户硬性指定) */
  for (const newId of ['tts-voiceover', 'caption-motion', 'one-click-suite', 'one-click-video']) {
    assert.ok(jsx.indexOf("action.id === '" + newId + "'") !== -1, '右面板 onSelect 必须路由 ' + newId);
  }
});
