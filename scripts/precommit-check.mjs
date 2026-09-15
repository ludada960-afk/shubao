#!/usr/bin/env node
// scripts/precommit-check.mjs —— 提交前必跑（npm run precommit）
// ═══════════════════════════════════════════════════════════════════════════
// 为什么存在：本工作树由多条线共用，本轮已发生三次本可被一次检查挡下的事故：
//   ① 离线 patch 上下文过期 → 37 个文件被当删除应用（Home.css 3585→935、EcStudio 1404→1 行）
//      → 构建全红、单测全绿，站点起不来；
//   ② 一次文案修复把 8 个插件文件整体改成 CRLF → 1646/1486 假 diff，真改动被淹没；
//   ③ 单文件半改状态挂了 4 轮 → 9 条线的验证结论全部不可信。
// 三条都能被同一次检查拦住：构建 + 源码完整性 + 门禁套件。
//
// ⚠️ 两类必须分开，否则进度条会让谁都提交不了，工具就没人用了：
//   BLOCKING = 断言「必须为 0 / 不得回退」→ 红了是**回归**，停下修；
//   ADVISORY = 记录**已知未完成量**（进度条）→ 红了只提示，不拦提交。
// 并发提示：若报红先重跑一次再定性（别人正在保存的瞬时态很常见，RTK §3.1-6）。
// ═══════════════════════════════════════════════════════════════════════════
import { spawnSync } from 'node:child_process';

const BLOCKING = [
  'test/source-syntax-integrity.test.mjs',
  'test/interactive-state-coverage.test.mjs',
  'test/focus-visible-baseline.test.mjs',
  'test/token-no-duplicate-definitions.test.mjs',
  'test/token-vars-defined.test.mjs',
  'test/legacy-token-family.test.mjs',
  'test/design-system-layer.test.mjs',
  'test/ink-contrast.test.mjs',
  'test/no-upstream-leakage.test.mjs',
  'test/charge-requires-confirmation.test.mjs',
  'test/pricing-single-source.test.mjs',
  /* 键盘不可达回归：2026-09-20 起**已归零**（79 → 0），因此从"进度条"升为**硬门禁**。 */
  'test/no-clickable-div.test.mjs',
  /* CSS 注释完整性：2026-09-15 起为**硬门禁**。
     起因是一次 P0 —— token 权威文件里一条注释**自己写了一个注释结束符**，
     导致注释提前闭合、紧随其后的 :root（兼容别名层）被并进非法选择器**整条丢弃**，
     35 条别名 token、240 个引用点静默失效（首页品牌主色色块渲染成 4px）。
     幽灵变量 / 同作用域重复定义 / 源码完整性三条门禁**都看不见**这一类，
     只有实机契约抓到了它 —— 本门禁把它变成静态可查。 */
  'test/css-comment-integrity.test.mjs',
  /* 第三套 token 语言防复发：2026-09-15 起为**硬门禁**。
     起因是真实事故 —— 仓库里除 V2 / V3 外还躺着第三个 token 文件 semanticTokens.css，
     10 个 token 里 7 个全仓零引用，且在 main.jsx 里排在 theme.css 之后 import，
     于是它的 :root 值**静默压过** theme.css 的回退值：.theme-switcher 的焦点描边
     实测渲染 rgb(37,99,235)，而作者写在文件里的回退值是 --sb-info 的 #5275CC。
     口径是**棘轮**（主题作用域内非 --sb-* 定义 177 处 / 105 名不许再涨），
     不是「必须为 0」—— 现存 177 处都属已登记待迁的 V2 / 已判合法的组件自有家族。
     幽灵变量 / 重复定义 / 家族棘轮 / DS 层四条门禁**都看不见**这一类。 */
  'test/token-root-scope-language.test.mjs',
  /* 断言「token 拼写」的契约文件：2026-09-15 起为**硬门禁**。
     起因是本轮 D26 迁移（--accent → --sb-surface-inverse 等）改了 token 名，
     这四份契约里有 8 条断言在做**逐字匹配**，于是集体失效 ——
     而 precommit 的 14 条门禁里**没有**它们，逐文件 precommit 全绿，
     直到**部署的 npm test 步骤**才把它们挡下来（部署 exit 1）。
     把这类文件挂进 BLOCKING 之后，同类失效会在 precommit 阶段就暴露。
     （另注：dsh 的部署脚本自带 npm test，是当前唯一能覆盖全量契约的关卡。） */
  'test/footer-actions-contract.test.mjs',
  'test/canvas-derive-menu.test.mjs',
  'test/video-canvas-tapnow-w1.test.mjs',
  'test/visual-system-contract.test.mjs',
];

/* 当前没有进度条类门禁（键盘可达已归零）。将来若有"已知未完成量"，加在这里，不要塞进 BLOCKING。 */
const ADVISORY = [];

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const failed = [];

console.log('[1/3] npm run build …');
if (spawnSync(npm, ['run', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' }).status !== 0) failed.push('npm run build');

console.log('[2/3] BLOCKING 门禁（' + BLOCKING.length + ' 个）…');
if (spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...BLOCKING], { stdio: 'inherit' }).status !== 0) failed.push('BLOCKING 门禁');

console.log('[3/3] ADVISORY 进度条（' + ADVISORY.length + ' 个，不拦提交）…');
/* ⚠️ 本格曾经**对开发者说假话**（2026-09-15 修正）：ADVISORY 为空时，
   `node --test` 不带文件参数会走**默认发现** —— 于是它把 test/ 之外的东西也跑了：
   实测 fail=20 = **15 个 test/qa/ 浏览器探针脚本**（未纳入 git 的临时件，需要 dev server 才能跑）
   + **5 条 npm test 有意跳过的用例**（--test-skip-pattern）。
   然后本格把它们报成「仍有未完成量……属任务清单，见 §8.14」——
   而 §8.14 与这 20 条**毫无关系**。每次 precommit 都在给下一个人一条错误的线索。
   （与 legacy-token-family 那条「承诺了不存在的 ⑤」同族：**指标测的是判据的代理**。）
   修正：**没有 ADVISORY 就明确说没有，不要跑任何东西**。
   要恢复这条线，就老老实实往 ADVISORY 里填**契约文件名**。 */
if (ADVISORY.length === 0) {
  console.log('  ↳ 当前没有进度条类门禁（键盘可达已归零）。');
} else {
  const adv = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...ADVISORY], { stdio: 'pipe', encoding: 'utf8' });
  const m = (String(adv.stdout || '') + String(adv.stderr || '')).match(/fail\s+(\d+)/);
  if (adv.status !== 0) console.log('  ↳ 仍有未完成量（fail=' + (m ? m[1] : '?') + '）—— 属任务清单，见 docs/design/34-status-and-handover.md §8.14');
}

if (failed.length) {
  console.error('');
  console.error('✖ precommit 未通过：' + failed.join(' / '));
  console.error('  → 不要提交。先修，再重跑一次。');
  console.error('  → 红在别人路径内的文件：不要代修，报告给对应线（RTK §3.1-4）。');
  process.exit(1);
}
console.log('');
console.log('✅ precommit 通过：构建 exit 0 + BLOCKING 门禁全绿 —— 可以提交。');
