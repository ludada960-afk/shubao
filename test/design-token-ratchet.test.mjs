// test/design-token-ratchet.test.mjs
// 设计 token 棘轮：迁移只能「降」，不许「升」——防止一边迁移一边在别处新种硬编码。
// 背景：实测发现 hex 硬编码在迁移推进的同时从 5789 涨到 5850，说明只做迁移追不上新增。
// 基线文件：docs/design/token-ratchet-baseline.json（由 scripts/design-ratchet.mjs --update 生成）
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const BASELINE_PATH = path.join(ROOT, 'docs', 'design', 'token-ratchet-baseline.json');
const EXT = new Set(['.js', '.jsx', '.css']);
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(name))) out.push(full);
  }
  return out;
}

test('设计 token 棘轮：任何文件都不得新增硬编码色值（迁移只能降不能升）', () => {
  assert.ok(existsSync(BASELINE_PATH), '缺少基线文件 docs/design/token-ratchet-baseline.json');
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const regressions = [];
  const newDebt = [];
  for (const file of walk(SRC)) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    const found = readFileSync(file, 'utf8').match(HEX_RE);
    const now = found ? found.length : 0;
    const base = baseline[rel];
    if (now === 0) continue;
    if (base === undefined) newDebt.push(rel + ' (+' + now + ')');
    else if (now > base) regressions.push(rel + ' (' + base + ' → ' + now + ')');
  }
  assert.deepEqual(
    { newDebt, regressions },
    { newDebt: [], regressions: [] },
    '出现新增硬编码色值。请改用 --sb-* token；确属业务内容数据（如风格渐变、作品渲染色）请走人工评审后用'
      + ' node scripts/design-ratchet.mjs --update 下调/登记基线，并在 commit 说明理由。\n'
      + '新增: ' + newDebt.join(', ') + '\n超基线: ' + regressions.join(', '),
  );
});

test('设计 token 棘轮：基线文件本身必须存在且包含设计系统相关文件', () => {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const files = Object.keys(baseline);
  assert.ok(files.length > 50, '基线应覆盖全部有硬编码的文件，实际 ' + files.length);
  for (const must of ['src/styles/design-tokens.css', 'src/styles/design-tokens-v3.css']) {
    assert.ok(files.includes(must), '基线应包含 ' + must);
  }
});
