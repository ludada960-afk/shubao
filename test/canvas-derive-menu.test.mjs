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

/* 1) 7 action 数据契约 (4 测试) — 用户 9-04 反馈:
   1-click 套图/1-click 视频 与 core 5 重复 → 移除;
   TTS/字幕只在视频节点出现 (videoOnly), 竞品名不进 UI → bucket 改名"音频与字幕" */

test('derive menu exposes exactly 7 actions (5 原有 + 2 音频字幕, 9-04 反馈精简版)', () => {
  assert.equal(CANVAS_CREATION_OPTIONS.length, 7, '7 个 action: 5 原有 + 2 音频字幕 (用户 9-04 反馈去重)');
  const ids = CANVAS_CREATION_OPTIONS.map(option => option.id);
  /* 5 原有 (用户硬性要求全部保留) */
  for (const legacyId of ['text-generation', 'image-edit', 'ecommerce-suite', 'video-upload', 'video-generation']) {
    assert.ok(ids.includes(legacyId), '5 原有 action 缺 ' + legacyId);
  }
  /* 2 音频字幕 (只对视频节点) */
  for (const audioId of ['application-tts', 'application-caption']) {
    assert.ok(ids.includes(audioId), '音频字幕 action 缺 ' + audioId);
  }
  /* 与 core 重复的 1-click 项已移除 (用户 9-04 反馈) */
  for (const removedId of ['one-click-suite', 'one-click-video', 'tts-voiceover', 'caption-motion']) {
    assert.ok(!ids.includes(removedId), '旧 action ' + removedId + ' 应已移除/更名');
  }
});

test('7 actions are bucketed into 2 groups (core 5 / audio 2, videoOnly)', () => {
  const buckets = { core: [], audio: [], other: [] };
  for (const option of CANVAS_CREATION_OPTIONS) {
    const g = option.group || 'other';
    (buckets[g] || buckets.other).push(option.id);
  }
  assert.deepEqual(buckets.core.sort(), ['ecommerce-suite', 'image-edit', 'text-generation', 'video-generation', 'video-upload'], 'core 5 = 5 原有 (用户硬性要求全部保留)');
  assert.deepEqual(buckets.audio.sort(), ['application-caption', 'application-tts'], 'audio 2 = TTS 配音 + 字幕动效 (仅视频节点)');
  assert.equal(buckets.other.length, 0, '所有 action 必须分桶, 不允许 ungrouped');
  for (const option of CANVAS_CREATION_OPTIONS) {
    if (option.group === 'audio') assert.equal(option.videoOnly, true, option.id + ' 必须 videoOnly (图片节点不显示配音)');
  }
});

test('7 actions preserve display order (core 先 5, audio 后 2)', () => {
  const groupOrder = CANVAS_CREATION_OPTIONS.map(option => option.group);
  assert.deepEqual(groupOrder, [
    'core', 'core', 'core', 'core', 'core',
    'audio', 'audio',
  ], '顺序必须按 core(5) -> audio(2)');
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

test('canvas-derive-menu.css contains 7-action grid + 2 bucket markers (core/audio) + glass + dark mode', () => {
  const css = readFileSync(cssPath, 'utf8');
  /* 批 CY-㊴（2026-10-01）：桌面由 3 列改 **2 列**。
     用户逐字：「"反推提示词"和"生成文案"我觉得只保留反推提示词就好，你把生成文案去掉吧，
       然后右边的面板就只有4个核心常用功能了，你就把他们重新适配一下，让UI整体更舒服一点」
     ⇒ 核心项 5 → **4**，而 3 列会排成「3 + 1」：右边空一格、视觉上像缺了一块。
       2 列正好 2×2 方阵，每格也从约 1/3 宽变成 1/2 宽（实测 228px）。
     平板本来就是 2 列、移动 1 列，都不变。 */
  assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/, '桌面 2 列（4 项排成 2×2；3 列会排成 3+1 缺一块）');
  assert.match(css, /@media \(max-width: 960px\)[\s\S]*grid-template-columns:\s*repeat\(2,/, '平板 2 列 grid 必填');
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*grid-template-columns:\s*1fr/, '移动 1 列 grid 必填');
  assert.ok(css.indexOf('.ec-canvas-derive-bucket.is-core') !== -1, 'core 桶标记必填 (5 原有)');
  assert.ok(css.indexOf('.ec-canvas-derive-bucket.is-core') !== -1, 'core 桶标记必填');
  assert.ok(css.indexOf('.ec-canvas-derive-bucket.is-audio') !== -1 || css.indexOf('.ec-canvas-derive-bucket.is-magic') !== -1, 'audio 桶标记必填 (magic 样式可复用)');
  assert.match(css, /backdrop-filter:\s*blur\(18px\) saturate\(160%\)/, '毛玻璃 backdrop-filter 必填');
  assert.match(css, /\[data-theme="dark"\]\s*\.ec-canvas-derive-tile/, '暗色模式适配必填');
});

test('canvas-derive-menu.css declares the 9-action tile hover lift + chip + meta contract', () => {
  const css = readFileSync(cssPath, 'utf8');
  assert.match(css, /\.ec-canvas-derive-tile\s*\{/, 'tile 必填');
  assert.match(css, /\.ec-canvas-derive-tile:hover\s*\{[^}]*transform:\s*translateY\(-2px\)/, 'hover lift -2px 必填');
  /* RTK §3.1-10：**契约锁判据，不锁写法**。判据 =「hover 时给一层海拔阴影」，
     不是「必须写成 var(--shadow-md) 这个 V2 拼写」。
     D20-A 已把 V2 阴影族迁到 V3 海拔别名层（--shadow-md → --sb-shadow-md，见提交 3eacb8e8），
     旧断言从那一刻起就在保护一个**已经过时的写法** —— 表达式可以换，判据不能换。 */
  assert.match(css, /\.ec-canvas-derive-tile:hover\s*\{[^}]*box-shadow:\s*var\((--sb-)?shadow-(sm|md|lg|xl|[1-5])\)/, 'hover 必须给一层海拔阴影（V3 海拔 token）');
  assert.match(css, /\.ec-canvas-derive-tile\s+\.ec-canvas-derive-chip/, 'chip 必填');
  /* D26：--accent 已迁到权威 token --sb-surface-inverse（亮 #0C0A09 / 暗 #F5EFE4，逐值相等）。
     断言仍锁「hover 时 chip 底色取那个强对比 token」，只是名字换成权威名。 */
  assert.match(css, /\.ec-canvas-derive-tile:hover\s+\.ec-canvas-derive-chip\s*\{[^}]*background:\s*var\(--sb-surface-inverse\)/, 'hover 时 chip 取强对比色 token 必填');
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

test('CanvasDeriveMenu renders 2 buckets (core / audio) and 7 grid tiles', () => {
  const studio = readFileSync(canvasStudioPath, 'utf8');
  for (const bucket of ['core', 'audio']) {
    assert.ok(studio.indexOf("id: '" + bucket + "'") !== -1, 'CanvasDeriveMenu 必须定义 ' + bucket + ' 桶');
  }
  for (const label of ['核心常用', '音频与字幕']) { // 用户 9-04 反馈: 竞品名不入UI, 音频桶叫'音频与字幕'
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

test('派生路由覆盖全部 9 个 action id（5 原有 + 4 应用节点）——在**活的**那个路由里', () => {
  const jsx = readFileSync(ecCanvasIndexPath, 'utf8');
  /* ═══ 批 CY-⑯ 修判据本身 ══════════════════════════════════════════════════════════════════════════════
     这条门禁原来叫「right-side onSelect router …」，但它只是**在整个 index.jsx 里 grep**
     `action.id === 'xxx'` —— 而那 9 个分支在 **CanvasDeriveMenu 的 onSelect**（节点右侧 + 的菜单）
     里本来就全都在。⇒ 这条门禁**从来没有检查过右面板**，却在"看着绿"，
     于是 `onDeriveSelect`（传给右面板、组件签名里根本没有）被丢弃了很久都没人发现。
     这类"看着在管、其实没管"的门禁比没有更坏。

     现在两条事实都钉住：
       ① 9 个 action 必须由**活的**派生菜单路由覆盖（这才是用户 8-29 那句「都要保留」的落点）；
       ② 右面板**不许**再带一份派生路由 —— 用户 2026-09-05 定稿：
          「右面板只展示"这个素材派生了什么"…**生成类入口只在素材右侧 + 里**」。 */
  const liveStart = jsx.indexOf('{connectionPicker && <CanvasDeriveMenu');
  assert.ok(liveStart > 0, '找得到 CanvasDeriveMenu 的渲染处');
  /* 花括号配对取这一段 JSX 表达式（不依赖某个具体结束标签 —— 它是自闭合的 `/>}`）*/
  let depth = 0;
  let end = -1;
  for (let i = jsx.indexOf('{', liveStart); i < jsx.length; i += 1) {
    if (jsx[i] === '{') depth += 1;
    else if (jsx[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
  }
  assert.ok(end > 0, '派生菜单的 JSX 表达式配对失败');
  const router = jsx.slice(liveStart, end);
  /* 5 原有 + 2 个应用节点：都有**专属**分支 */
  for (const id of ['text-generation', 'ecommerce-suite', 'video-upload', 'video-generation', 'image-edit', 'application-tts', 'application-caption']) {
    assert.ok(router.includes("action.id === '" + id + "'"), '派生菜单的 onSelect 必须专属路由 ' + id);
  }
  /* 剩下 2 个（1-click 套图 / 1-click 视频模板）走**通用派生**分支 ——
     以前它们只出现在右面板那份**从未被接收**的死路由里，靠那堆死代码才让门禁变绿。
     现在明确断言它们落到 handleCreateDerivedNode。 */
  for (const id of ['application-1click-suite', 'application-1click-video']) {
    assert.ok(router.includes('handleCreateDerivedNode('), id + ' 必须走通用派生分支 handleCreateDerivedNode');
  }
  /* 右面板那份是 9-05 定稿之前的残留，已删 */
  assert.ok(!jsx.includes('onDeriveSelect={'),
    '右面板不许再带一份派生路由（用户 9-05 定稿：生成类入口只在素材右侧 + 里）');
});
