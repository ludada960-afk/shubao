import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

/* ═══ 批 J-④：「生成过程」按钮搬进左侧导航栏（用户批注 #2-4）══════════════════════════════
   用户原话：「你这个生成过程的这个按钮不应该放在这里呀，我都说了你应该放到左边的导航栏里面去，
   你可以放在导航栏的下面这个位置啊。然后你要跟上面的那些按钮做同样的那种规划。」
   这里守三件事：① 它挂在侧栏里（不是浮在内容区左下角）；② 它**复用导航格那一个 class**
   （"同样的规划"落到实现上就是同一个 class，而不是另一套长得像的数值）；
   ③ 两条进度条**共用同一条过渡曲线**（width .7s cubic-bezier(.4,0,.2,1)）—— 那是设计语言。
   ⚠️ 2026-09-29 批 DC 续-8 修过一处**量纲混淆**：原来这里要求两条**同高（4px）**，
   因为那时装饰条也是 4px 且贴格底。批 DC 续-8 把装饰条改成"与磁贴同宽、紧贴磁贴正下方（3px）"
   之后，两条量纲就不同了（装饰条量的是磁贴，真进度条量的是格底），再强行同高只会让其中一条变形。
   ⇒ 判据改成：**曲线必须同源**（那是设计语言），**几何各自成立**（那是两件事）。 */

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
  /* ⚠️ 2026-09-29 批 DC 续-12：这一条又简化回来了 ——
     续-8 曾经把装饰条改成「与磁贴同宽、紧贴磁贴下方、3px」，续-12 已**全部做回原样**
     （贴格底、通栏、4px）。用户 2026-09-29 第五次指出：条不该贴在磁贴底下，
     那样它紧贴渐变方块、边缘对不上，读成「渐变层下面还有一个纯紫色的图层」。
     ⇒ 所以这条断言重新变回最初的形状：**两条进度条同源**（4px / 贴格底 / 同一条 width 过渡曲线）。
     另：原来按 `indexOf` **位置切片**，改一处选择器会让另一条断言静默取到空串，
     改用 `rule()` 按选择器逐字取（这个教训留着）。 */
  const cellBar = rule('.app-sidebar-cell::after');
  const taskBar = rule('.app-sidebar-task-bar');
  assert.match(cellBar, /width \.7s cubic-bezier\(\.4,0,\.2,1\)/, '导航格过渡按 docs/design/54 §1');
  assert.match(taskBar, /width \.7s cubic-bezier\(\.4,0,\.2,1\)/, '任务格过渡必须同一条曲线');
  assert.match(cellBar, /height:\s*4px/, '装饰充能条 4px（与真进度条同源，docs/design/83 实测值）');
  assert.match(taskBar, /height:\s*4px/, '真进度条也 4px');
  assert.match(cellBar, /bottom:\s*0/, '装饰条贴格底（在文字下面，用户 2026-09-29 明确要求的）');
  assert.match(taskBar, /bottom:\s*0/, '真进度条钉在格底');
  assert.match(css, /\.app-sidebar-task\.has-progress::after \{ display: none; \}/,
    '有真进度时要把装饰性的 hover 条藏掉，两条不许同时出现');
});

test('J-④ 窄栏与减少动效都覆盖到了新格', () => {
  const narrow = css.slice(css.indexOf('@media (max-width: 900px)'));
  assert.match(narrow, /\.app-sidebar-task-badge/, '窄栏要把角标跟着格子重新定位');
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /\.app-sidebar-task-bar/, '减少动效时必须关掉新进度条的过渡');
});
