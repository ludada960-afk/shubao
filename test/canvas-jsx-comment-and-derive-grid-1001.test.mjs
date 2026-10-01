// test/canvas-jsx-comment-and-derive-grid-1001.test.mjs
// 批 CY-㊴（2026-10-01）：① 防"JSX 里的裸注释"这种线上事故
//                      ② 右栏去掉「生成文案」后剩 4 项，布局按 2×2 适配
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const studio = read('src/pages/EcCanvas/components/CanvasStudio.jsx');
const page = read('src/pages/EcCanvas/index.jsx');
const deriveCss = read('src/styles/canvas-derive-menu.css');

test('① JSX 里不许出现裸的块注释（会被当文本渲染 —— 我就是这么把注释显示到线上的）', () => {
  /* 线上事故（2026-10-01）：批 CY-㊴ 把一段说明直接写在 JSX 的 return 表达式里，
     用的不是 JSX 注释语法，于是**注释原文被当成文本渲染**，
     派生菜单的卡片标题上直接显示了我的注释，用户截图里一眼就能看到。
     构建通过、别的门禁也骗过去了（它们都在剥注释后匹配）。
     ⇒ 判据取**精确形状**：一条裸注释，它上一条非空行以 `>` 结尾、下一条非空行以 `<` 开头
       —— 这正是 JSX 元素之间的位置。组件体内的普通 JS 注释不在这个形状里，不会被误伤。 */
  const lines = studio.split('\n');
  const prevMeaningful = i => {
    for (let k = i - 1; k >= 0; k--) if (lines[k].trim()) return lines[k].trim();
    return '';
  };
  const nextMeaningful = i => {
    for (let k = i + 1; k < lines.length; k++) if (lines[k].trim()) return lines[k].trim();
    return '';
  };
  const offenders = [];
  lines.forEach((line, i) => {
    if (!/^\s*\/\*/.test(line)) return;
    if (/^\s*\/\* eslint/.test(line)) return;
    const before = prevMeaningful(i);
    const after = nextMeaningful(i);
    if (/[>}]$/.test(before) && /^</.test(after)) {
      offenders.push((i + 1) + ': ' + line.trim().slice(0, 60));
    }
  });
  assert.deepEqual(offenders, [],
    'JSX 元素之间发现裸块注释（会被渲染成文本）。要写注释就用花括号包起来的 JSX 注释形式。命中：' + JSON.stringify(offenders));
});

test('② 右栏派生菜单不再有「生成文案」，核心项恰好 4 个', () => {
  /* 用户逐字：「"反推提示词"和"生成文案"我觉得只保留反推提示词就好，你把生成文案去掉吧，
     然后右边的面板就只有4个核心常用功能了」
     ⚠️ 只收**右栏这一个入口**；画布上的「生成文案」节点（双击空白那一项）照旧。 */
  assert.match(page, /DERIVE_MENU_HIDDEN_IDS/, '右栏要有明确的隐藏清单（别在 CANVAS_CREATION_OPTIONS 里删，那会连节点一起删掉）');
  assert.match(page, /new Set\(\['text-generation'\]\)/, '隐藏项是 text-generation');
  const options = read('src/pages/EcCanvas/canvasInteractionModel.js');
  assert.match(options, /id: 'text-generation'/,
    'CANVAS_CREATION_OPTIONS 里必须还留着 text-generation —— 画布上的「生成文案」节点还要用');
  for (const keep of ['image-edit', 'ecommerce-suite', 'video-upload', 'video-generation']) {
    assert.match(page, new RegExp('CANVAS_CREATION_OPTIONS'), '兜底');
    assert.ok(options.includes(`id: '${keep}'`), `核心项 ${keep} 必须保留`);
  }
});

test('③ 4 项用 2 列排（3 列会排成 3+1，右边空一格像缺了一块）', () => {
  const grid = deriveCss.match(/\.ec-canvas-derive-grid \{([^}]*)\}/);
  assert.ok(grid, '找不到 .ec-canvas-derive-grid');
  assert.match(grid[1], /grid-template-columns:\s*repeat\(2,/,
    '核心项 4 个 ⇒ 桌面 2 列（2×2 方阵），每格也更宽');
  assert.doesNotMatch(grid[1], /repeat\(3,/, '不许再是 3 列');
});
