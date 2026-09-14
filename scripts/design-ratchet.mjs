#!/usr/bin/env node
/**
 * 设计 token 棘轮（Token Ratchet）—— 防止「一边迁移、一边新种硬编码」
 * ─────────────────────────────────────────────────────────────────────
 * 背景：实测发现迁移在推进的同时，新代码仍在引入硬编码色值（hex 硬编码一度从 5789 涨到 5850）。
 * 只靠「迁移」永远追不上「新增」。本脚本给每个文件记录一个**基线**，
 * 任何文件**超过基线**就失败；基线只允许下调，不允许上调（除非人工评审后 --update 并说明理由）。
 *
 * 用法：
 *   node scripts/design-ratchet.mjs            检查（CI / 测试用，失败退出码 1）
 *   node scripts/design-ratchet.mjs --update   重新写基线（仅在下调或经批准时使用）
 *   node scripts/design-ratchet.mjs --json     输出 JSON（给测试断言用）
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.join(ROOT, 'src');
const BASELINE_PATH = path.join(ROOT, 'docs', 'design', 'token-ratchet-baseline.json');
const EXT = new Set(['.js', '.jsx', '.css']);
/** 允许存在硬编码的文件（业务内容数据/品牌资产定义），但仍受基线约束、不得增长 */
const ALLOW_DATA_FILES = [
  'src/constants/data.js',
  'src/styles/design-tokens.css',
  'src/styles/design-tokens-v3.css',
];

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(name))) out.push(full);
  }
  return out;
}

function countHex(text) {
  const m = text.match(HEX_RE);
  return m ? m.length : 0;
}

const files = walk(SRC);
const current = {};
for (const f of files) {
  const rel = path.relative(ROOT, f).split(path.sep).join('/');
  const n = countHex(readFileSync(f, 'utf8'));
  if (n > 0) current[rel] = n;
}

const args = process.argv.slice(2);
const wantJson = args.includes('--json');

if (args.includes('--update')) {
  const merged = { ...(existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {}) };
  for (const [k, v] of Object.entries(current)) merged[k] = v;
  writeFileSync(BASELINE_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  const total = Object.values(merged).reduce((a, b) => a + b, 0);
  console.log('[ratchet] 基线已更新：' + Object.keys(merged).length + ' 个文件 / ' + total + ' 处硬编码色值');
  console.log('[ratchet] 数据文件白名单（仍受基线约束）：' + ALLOW_DATA_FILES.join(', '));
  process.exit(0);
}

const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {};
const regressions = [];
const newDebt = [];
for (const [rel, n] of Object.entries(current)) {
  const base = baseline[rel];
  if (base === undefined) newDebt.push({ file: rel, now: n });
  else if (n > base) regressions.push({ file: rel, base, now: n, delta: n - base });
}
const improvements = Object.entries(baseline)
  .filter(([rel, base]) => (current[rel] || 0) < base)
  .map(([rel, base]) => ({ file: rel, base, now: current[rel] || 0 }))
  .sort((a, b) => (a.now - a.base) - (b.now - b.base));

const totalNow = Object.values(current).reduce((a, b) => a + b, 0);
const totalBase = Object.values(baseline).reduce((a, b) => a + b, 0);

if (wantJson) {
  console.log(JSON.stringify({ totalNow, totalBase, regressions, newDebt, improvements }, null, 2));
} else {
  console.log('设计 token 棘轮 — 硬编码色值（hex）');
  console.log('  当前合计: ' + totalNow + ' 处 / ' + Object.keys(current).length + ' 个文件');
  console.log('  基线合计: ' + totalBase + ' 处 / ' + Object.keys(baseline).length + ' 个文件');
  if (improvements.length) {
    console.log('  已下降: ' + improvements.length + ' 个文件（最大降幅 ' + (improvements[0].base - improvements[0].now) + ' 处：' + improvements[0].file + '）');
  }
  if (newDebt.length) {
    console.log('  ❌ 新增硬编码（基线里没有的文件）:');
    for (const d of newDebt.slice(0, 20)) console.log('     + ' + d.now + '  ' + d.file);
  }
  if (regressions.length) {
    console.log('  ❌ 超过基线（在已有文件里又种了新硬编码）:');
    for (const d of regressions.slice(0, 20)) console.log('     +' + d.delta + '  ' + d.file + '  (' + d.base + ' → ' + d.now + ')');
  }
  if (!newDebt.length && !regressions.length) console.log('  ✅ 没有新增硬编码，棘轮正常');
}

process.exit(newDebt.length || regressions.length ? 1 : 0);
