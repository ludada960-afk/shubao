// test/legacy-token-family.test.mjs
// 门禁（棘轮）：**第二套 token 语言不许再长** —— V2 变量家族只能减、不能增。
// ─────────────────────────────────────────────────────────────────────────────
// 背景（本轮实测，之前没人量化过）：仓库里并存**两套 token 语言**
//   ① V3（权威）：`--sb-*`，定义在 src/styles/design-tokens-v3.css
//   ② V2（历史遗留）：`--text-* / --radius-* / --border* / --red / --green / --weight-* /
//      --shadow-* / --duration-* / --bg-* …`，定义在 src/styles/design-tokens.css 与 theme.css
//
// ⚠️ **最危险的一点：两套同名不同值** ——
//   `--radius-md: 16px`（V2）  vs  `--sb-radius-md: 8px`（V3）
//   `--radius-lg` / `--radius-xl` / `--radius-full` 同理。
//   这与「`--sb-brand-gradient` 被定义两次」是**同一族**的静默缺陷：
//   读代码的人看到 `radius-md` 以为是 8px，实际渲染 16px。
//
// 口径（依裁定 1「不允许两套并存」与原则 §12）：
//   ① 本门禁**不要求立刻为 0**（610 处 / 48 个名字，需要分批迁移），但**绝不许增长**；
//   ② 迁移时**禁止逐值相等式机械替换**（两套阶梯不同），必须逐处给出
//      「V2 值 → 新 `--sb-*` token → 观感影响」；能取到**逐值相等**的映射时零观感变更（例：V2 16px → `--sb-radius-xl`）；
//   ③ **在迁移完成前，禁止把 `var(--radius-md)` 这类用法当作「16px 档位」去归并** ——
//      那是**命名冲突**，不是档位（D24）。
// ─────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** V2 家族的名字特征：var(--x) 且不是 --sb-* / --cvl-* / --max-width* */
export const LEGACY_RE = /var\(--(?!sb-|cvl-|max-width)([a-zA-Z0-9-]+)\)/g;

/** 从文本里数出 V2 用法（导出以便自证） */
export function countLegacy(text) {
  const names = new Map();
  let total = 0;
  for (const m of text.matchAll(LEGACY_RE)) { total++; names.set(m[1], (names.get(m[1]) || 0) + 1); }
  return { total, names };
}

function grepLegacy() {
  let out = '';
  try {
    out = execFileSync('git', ['grep', '-h', '-E', 'var\\(--(radius|text|weight|shadow|duration|border|red|green|bg|surface|ease)[a-z0-9-]*\\)', '--', 'src'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) { out = String(e.stdout || ''); }
  return out;
}

/* 棘轮基线：只许减不许增。迁移一批就把这两个数改小（并说明减了哪些名字）。 */
/* 基线口径 = 本文件 countLegacy 的计数（**逐个匹配**，不是逐行）：
   实测 2026-09-20 初测 = 744 处 / 52 个名字；DS 层迁移启动后降至 709 / 51，基线**同步收紧**。
   ⚠️ 不要用「行数」估：一行里可能有两三个 V2 用法（实测按行数会少算 134 处）。
   ⚠️ 棘轮只许向下：实测降了就把基线改小 —— 否则回退会落在"合法空间"里，门禁等于没长牙。 */
const BASELINE_TOTAL = 709;
const BASELINE_NAMES = 51;

test('① 检测器自证：能数出 V2 用法，且不误判 V3 的 --sb-*', () => {
  const s = 'color: var(--text-muted); border-radius: var(--radius-md); background: var(--sb-surface-card); gap: var(--sb-space-2);';
  const r = countLegacy(s);
  assert.equal(r.total, 2, '两个 V2 用法必须被数出来（--sb-* 不算）');
  assert.equal(r.names.get('text-muted'), 1);
  assert.equal(r.names.get('radius-md'), 1);
  assert.equal(countLegacy('var(--cvl-z-toast) var(--max-width-narrow)').total, 0, 'cvl/max-width 家族不该被算作 V2');
});

test('② V2 家族用法不得增长（棘轮：只许减）', () => {
  const { total, names } = countLegacy(grepLegacy());
  assert.ok(total > 100, '只数到 ' + total + ' 处，样本量异常（grep 口径可能失效）');
  assert.ok(total <= BASELINE_TOTAL,
    'V2 变量用法从基线 ' + BASELINE_TOTAL + ' 涨到 ' + total + ' —— 又有人写了第二套 token 语言。\n' +
    '  正确做法：用 --sb-* 的对应档位（0..48 的取值表见 docs/design/41-scales-and-snapping.md）。\n' +
    '  迁移做完了就把本文件里的 BASELINE_TOTAL 改小。');
  assert.ok(names.size <= BASELINE_NAMES,
    'V2 变量**名字种类**从 ' + BASELINE_NAMES + ' 涨到 ' + names.size + ' —— 出现了新的遗留名，请直接用 --sb-*。');
});

test('③ 两套 token 同名不同值这件事必须写在裁定里（防下一个人踩）', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs/design/40-decisions.md'), 'utf8');
  assert.match(doc, /D24/, 'D24（V2/V3 同名不同值的处置口径）必须写进 40-decisions.md');
  assert.match(doc, /--radius-md[\s\S]{0,200}--sb-radius-md|--sb-radius-md[\s\S]{0,200}--radius-md/,
    'D24 里必须点明「--radius-md(16px) vs --sb-radius-md(8px)」这个具体陷阱');
});
