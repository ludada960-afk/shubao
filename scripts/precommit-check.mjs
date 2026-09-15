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
const adv = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...ADVISORY], { stdio: 'pipe', encoding: 'utf8' });
const m = (String(adv.stdout || '') + String(adv.stderr || '')).match(/fail\s+(\d+)/);
if (adv.status !== 0) console.log('  ↳ 仍有未完成量（fail=' + (m ? m[1] : '?') + '）—— 属任务清单，见 docs/design/34-status-and-handover.md §8.14');

if (failed.length) {
  console.error('');
  console.error('✖ precommit 未通过：' + failed.join(' / '));
  console.error('  → 不要提交。先修，再重跑一次。');
  console.error('  → 红在别人路径内的文件：不要代修，报告给对应线（RTK §3.1-4）。');
  process.exit(1);
}
console.log('');
console.log('✅ precommit 通过：构建 exit 0 + BLOCKING 门禁全绿 —— 可以提交。');
