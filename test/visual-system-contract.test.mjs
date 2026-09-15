// test/visual-system-contract.test.mjs
// 门禁：**语义色与画布命令色的单一权威**
// ─────────────────────────────────────────────────────────────────────────────
// 本文件原先锁的是「拼写」而不是「判据」，本轮（删除第三套 token 语言时）修正：
//
//   ① 旧断言：src/styles/semanticTokens.css 里**写出了** 9 个 token
//      （--command / --success / --warning / --danger / --neutral-surface /
//        --focus-ring / --image-loading / --image-error / --image-selected）。
//      实测：其中 7 个**全仓零引用**，剩下 3 个只被 theme.css 与 EcCanvas.css 各引用一次。
//      也就是说它锁着一个**没人用的文件的拼写** —— 既没保护任何行为，还掩盖了
//      那个文件其实是仓库里**第三套 token 语言**。
//   ② 旧断言把 --canvas-command 的取值逐字锁成 var(--command)，于是**无法迁移**。
//
// 现在的口径（RTK §3.1-10「契约锁判据，不锁拼写」）：
//   · 语义族必须由**唯一权威** design-tokens-v3.css 提供；
//   · 画布的 command / hover / focus 三个别名必须指向**权威 --sb-* token**。
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { stripComments } from '../scripts/lib/token-scope.mjs';

const strip = (p) => stripComments(readFileSync(new URL(p, import.meta.url), 'utf8'));
const tokens = strip('../src/styles/design-tokens-v3.css');
const canvasCss = strip('../src/pages/EcCanvas/EcCanvas.css');
const canvasChrome = readFileSync(new URL('../src/pages/EcCanvas/components/CanvasChrome.jsx', import.meta.url), 'utf8');

test('语义色族由 V3 权威单一提供（success / warning / danger / info 各五档 + 焦点环三件套）', () => {
  const required = [];
  for (const family of ['success', 'warning', 'danger', 'info']) {
    for (const tier of ['', '-hover', '-soft', '-border', '-ink']) required.push(`--sb-sem-${family}${tier}:`);
  }
  required.push('--sb-focus-ring-color:', '--sb-focus-ring-w:', '--sb-focus-ring-offset:');

  // 样本量自证：防止 required 被误删成空数组后「无脑通过」
  assert.equal(required.length, 23, `判据样本量应为 23，实际 ${required.length}`);

  const missing = required.filter((t) => !tokens.includes(t));
  assert.deepEqual(missing, [], `V3 权威缺少语义 token：${missing.join(', ')}`);
});

test('画布的 command / hover / focus 别名必须指向权威 --sb-* token', () => {
  assert.match(canvasChrome, /ec-canvas-command/);
  for (const alias of ['--canvas-command', '--canvas-command-hover', '--canvas-focus']) {
    const m = new RegExp(`${alias}:\\s*var\\((--sb-[a-z0-9-]+)\\)`).exec(canvasCss);
    assert.ok(m, `${alias} 必须直接指向一个 --sb-* token（不得再指向 legacy / 第三套 token）`);
    assert.ok(tokens.includes(`${m[1]}:`), `${alias} 指向的 ${m[1]} 必须在 V3 权威里有定义`);
  }
  assert.match(canvasCss, /outline:\s*2px solid var\(--canvas-focus\)/);
});

test('画布命令色的消费点真实存在（别名不是死声明）', () => {
  assert.match(canvasCss, /var\(--canvas-command\)/);
  assert.match(canvasCss, /var\(--canvas-focus\)/);
  assert.match(canvasCss, /var\(--canvas-command-hover\)/);
});
