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

test('② 右栏派生菜单不再有「生成文案」，且 2026-10-03 起也不再有「上传视频」', () => {
  /* 用户逐字：「"反推提示词"和"生成文案"我觉得只保留反推提示词就好，你把生成文案去掉吧，
     然后右边的面板就只有4个核心常用功能了」
     ⚠️ 只收**右栏这一个入口**；画布上的「生成文案」节点（双击空白那一项）照旧。

     2026-10-03 用户再批注：「我不明白为什么这里会有个上传视频的选项，正常这里不是
       选择一个节点派生一个节点吗，下一个节点怎么会是上传视频呢？什么逻辑啊，你应该取消」
     ⇒ 这个菜单的语义是「从当前节点**派生**一个新节点」，
       而「上传视频」是**新增素材**（该走左侧「+」或直接拖进来），放在这里逻辑就是错的。
       同样只收右栏入口，`CANVAS_CREATION_OPTIONS` 里保留它给别的入口用。 */
  assert.match(page, /DERIVE_MENU_HIDDEN_IDS/, '右栏要有明确的隐藏清单（别在 CANVAS_CREATION_OPTIONS 里删，那会连节点一起删掉）');
  assert.match(page, /new Set\(\['text-generation', 'video-upload'\]\)/, '隐藏项是 text-generation + video-upload');
  const options = read('src/pages/EcCanvas/canvasInteractionModel.js');
  assert.match(options, /id: 'text-generation'/,
    'CANVAS_CREATION_OPTIONS 里必须还留着 text-generation —— 画布上的「生成文案」节点还要用');
  assert.match(options, /id: 'video-upload'/,
    'CANVAS_CREATION_OPTIONS 里必须还留着 video-upload —— 别的入口（左侧 + / 拖放）还要用');
  for (const keep of ['image-edit', 'ecommerce-suite', 'video-generation']) {
    assert.ok(options.includes(`id: '${keep}'`), `核心项 ${keep} 必须保留`);
  }
});

test('③ 核心项只剩 3 个 ⇒ 竖排一列（横排必然缺一块）', () => {
  const grid = deriveCss.match(/\.ec-canvas-derive-grid \{([^}]*)\}/);
  assert.ok(grid, '找不到 .ec-canvas-derive-grid');
  /* 用户原话：「既然要删掉一个选项，你就做成三个选项，然后变成竖着排版吧」
     3 个项横排（2 列）会留一个空格子，视觉上像缺了一块。 */
  assert.match(grid[1], /grid-template-columns:\s*minmax\(0, 1fr\)/,
    '三个核心项 ⇒ 竖排一列');
  assert.doesNotMatch(grid[1], /repeat\(2,|repeat\(3,/, '不许再横排');
});
