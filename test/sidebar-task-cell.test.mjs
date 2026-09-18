import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

/* ═══ 批 J-④：「生成过程」按钮搬进左侧导航栏（用户批注 #2-4）══════════════════════════════
   用户原话：「你这个生成过程的这个按钮不应该放在这里呀，我都说了你应该放到左边的导航栏里面去，
   你可以放在导航栏的下面这个位置啊。然后你要跟上面的那些按钮做同样的那种规划。」
   这里守三件事：① 它挂在侧栏里（不是浮在内容区左下角）；② 它**复用导航格那一个 class**
   （"同样的规划"落到实现上就是同一个 class，而不是另一套长得像的数值）；
   ③ 底边进度条的几何与过渡跟导航格**同源**（4px / width .7s cubic-bezier(.4,0,.2,1)）。 */

const sidebarSrc = readFileSync(new URL('../src/components/layout/AppSidebar.jsx', import.meta.url), 'utf8');
const taskSrc = readFileSync(new URL('../src/components/task/TaskSidebar.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/app-sidebar.css', import.meta.url), 'utf8');

const rule = selector => css.slice(css.indexOf(selector + ' {'), css.indexOf('}', css.indexOf(selector + ' {')) + 1);

test('J-④ 生成过程挂在左导航底部插槽里，而不是内容区左下角的浮层', () => {
  assert.match(sidebarSrc, /id=\{'sb-task-dock-slot'\}/, '侧栏底部必须留出插槽');
  assert.match(sidebarSrc, /app-sidebar-foot/, '插槽必须是导航栏**下面**那一格（用户说的"下面这个位置"）');
  assert.match(taskSrc, /createPortal\(dock, slot\)/, '任务面板要 portal 进侧栏插槽');
  assert.match(taskSrc, /getElementById\('sb-task-dock-slot'\)/, '要按 id 取插槽节点');
  /* 画布页整屏排版、不渲染侧栏 —— 那时插槽不存在，必须回落到原来的浮按钮（不能凭空消失）。 */
  assert.match(taskSrc, /inline \? createPortal\(dock, slot\) : dock/, '没有侧栏时必须回落到浮按钮');
});

test('J-④ 「同样的那种规划」= 复用 .app-sidebar-cell，不是另做一套长得像的', () => {
  assert.match(taskSrc, /'app-sidebar-cell app-sidebar-task'/, '侧栏格必须挂导航格同一个 class');
  assert.match(taskSrc, /className="app-sidebar-tile"/, '图标磁贴同源');
  assert.match(taskSrc, /className="app-sidebar-label"/, '文字同源');
  assert.match(taskSrc, /生成过程/, '标签按用户原话叫「生成过程」');
});

test('J-④ 真进度条与导航格的 hover 充能条同源（同一门设计语言）', () => {
  const cellBar = css.slice(css.indexOf('.app-sidebar-cell::after'), css.indexOf('.app-sidebar-cell:hover::after'));
  const taskBar = rule('.app-sidebar-task-bar');
  assert.match(cellBar, /height:\s*4px/, '导航格进度条 4px');
  assert.match(taskBar, /height:\s*4px/, '任务格进度条也必须 4px');
  assert.match(cellBar, /width \.7s cubic-bezier\(\.4,0,\.2,1\)/, '导航格过渡按 docs/design/54 §1');
  assert.match(taskBar, /width \.7s cubic-bezier\(\.4,0,\.2,1\)/, '任务格过渡必须同一条曲线');
  assert.match(taskBar, /bottom:\s*0/, '两条都钉在底边');
  assert.match(css, /\.app-sidebar-task\.has-progress::after \{ display: none; \}/,
    '有真进度时要把装饰性的 hover 条藏掉，两条不许同时出现');
});

test('J-④ 窄栏与减少动效都覆盖到了新格', () => {
  const narrow = css.slice(css.indexOf('@media (max-width: 900px)'));
  assert.match(narrow, /\.app-sidebar-task-badge/, '窄栏要把角标跟着格子重新定位');
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /\.app-sidebar-task-bar/, '减少动效时必须关掉新进度条的过渡');
});
