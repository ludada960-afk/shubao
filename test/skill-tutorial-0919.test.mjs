import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

/* ═══ 批 J-⑭ 后半句：教学示例（用户批注 image#1）════════════════════════════════════════════
   用户原话：「他视频制作这边的子页面**绝大部分是有教学示例的**，你要**结合教学示例做深度匹配**，
   按他的讲解 + 工作台里**真实有的按钮和功能**去做规划和设计。」
   竞品形态（docs/design/59 实测）：点开是弹窗三段式 —— ① 成片媒体 ② SOP 正文 ③ 操作条。
   契约：
     ① 结构照三段式（媒体 / 正文块 / 操作条），入口在工作台上；
     ② **内容一个字都不编**：媒体位只收这条技能真实存在的案例封面；
     ③ 没有素材时**如实说还在制作**，不许拿占位图/假视频充数（本站铁律）。 */

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const shell = read('src/components/media/WorkbenchShell.jsx');
const page = read('src/pages/MediaCreation/index.jsx');
const bridge = read('src/pages/Home/SkillWorkbench.jsx');
const css = read('src/components/media/WorkbenchShell.css');

test('J-⑭⑤ 教学示例：三段式结构 + 工作台入口', () => {
  assert.match(shell, /className="media-workbench-tutorial"/);
  assert.match(shell, /怎么用这条技能/);
  assert.match(shell, /className="media-tutorial-media"/, '① 媒体段');
  assert.match(shell, /className="media-tutorial-block"/, '② 正文段');
  assert.match(shell, /className="media-tutorial-actions"/, '③ 操作条');
  assert.match(shell, /role="dialog"/);
  assert.match(shell, /aria-modal="true"/);
  /* 键盘可达：关闭按钮与两个动作都是 button */
  assert.match(shell, /aria-label="关闭"/);
  assert.match(shell, /回去配置/);
  assert.match(shell, /开始生成/);
});

test('J-⑭⑤ 内容不许编：媒体位只收真实案例封面，没有就如实说', () => {
  assert.match(page, /\.map\(item => item && item\.cover\)/, '媒体来自 skill.cases 里真实的 cover');
  assert.match(page, /\.filter\(Boolean\)/, '没有封面就不占位');
  assert.match(shell, /这条技能的教学示例还在制作中/, '没有素材时的**如实空态**');
  /* 正文块全部来自声明源，不是手写死文案 */
  assert.match(page, /title: "要准备什么", lines: groups/, '准备什么 = 字段分组');
  assert.match(page, /title: "它会交出什么"/, '交出什么 = 交付清单');
  /* ⚠️ 不许可疑的占位素材 */
  assert.doesNotMatch(shell, /placeholder\.(mp4|png)|占位视频|示例视频\.mp4/, '不许放假素材');
});

test('J-⑭⑤ 透传链完整（本轮踩过的坑：中间那层显式列 props）', () => {
  assert.match(page, /tutorial=\{tutorial\}/, '页面 → SkillWorkbench');
  assert.match(bridge, /tutorial = null,/, 'SkillWorkbench 必须声明这个 prop');
  assert.match(bridge, /tutorial=\{tutorial\}/, 'SkillWorkbench → WorkbenchShell');
  assert.match(shell, /tutorial = null,/, 'WorkbenchShell 必须声明这个 prop');
});

test('J-⑭⑤ 样式走 token，且有减少动效分支', () => {
  assert.match(css, /\.media-tutorial-scrim \{[^}]*position: fixed/);
  assert.match(css, /\.media-tutorial-empty \{[^}]*border: 1px dashed/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ \.media-workbench-tutorial/);
  const start = css.indexOf('.media-tutorial {');
  assert.doesNotMatch(css.slice(start, css.indexOf('}', start)), /#[0-9a-fA-F]{3,6}/, '不许硬编码色值');
});
