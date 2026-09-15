#!/usr/bin/env node
/**
 * scripts/space-ratchet.mjs
 * 尺度棘轮 —— 锁住「间距 / 字号 / 圆角」的**解析后像素值**，
 * 让 token 化可以随便做，但**值一个都不许变**。
 * ─────────────────────────────────────────────────────────────────────────────
 * 为什么需要（真实事故）：
 *   第九批把非阶梯值硬套到最近阶梯：`12px → var(--sb-space-5)`(=20px)、`4px → 8px`、`6px → 8px`…
 *   一次审计抓出 85 处。间距是**布局**，改 1px 就可能换行 / 错位 / 卡片高度变化，
 *   而**没有任何测试会变红**（全站没有断言锁间距）。
 *
 * 口径（这是本脚本存在的全部意义）：
 *   **token 名可以变，解析出来的像素值不许变。**
 *   所以基线记的是「解析后的值」，不是「源码文本」——
 *     `gap: 12px`  → `gap: var(--sb-space-3)`  ✅ 绿（值仍是 12）
 *     `gap: 12px`  → `gap: var(--sb-space-5)`  ✖ 红（值变成 20）
 *
 * 阶梯真值**从 design-tokens-v3.css 现读**，不在这里抄一份（抄一份就一定会漂）。
 *
 * 用法（默认基准 = HEAD，也就是回答「**我这次改动**把哪些尺度值改了」）：
 *   node scripts/space-ratchet.mjs                  # 工作区 vs HEAD，exit 1 = 有值变化
 *   node scripts/space-ratchet.mjs --base=<commit>  # 与任意历史版本比（查整场迁移波的净效果）
 *   node scripts/space-ratchet.mjs --update         # 可选：重锁基线文件
 *
 * ⚠️ 判定在**整棵树的合计**上做：样式在文件之间搬动（零观感重构）会被合计抵消，
 *    只有真的把值改掉才会浮出来。（逐文件判定会把这些搬动误报成变化，实测 161 条假阳性。）
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const BASELINE = path.join(ROOT, 'test/fixtures/space-baseline.json');
const TOKENS = path.join(SRC, 'styles/design-tokens-v3.css');
const EXT = new Set(['.css', '.jsx', '.js']);

/* ── 阶梯真值：从 token 文件现读（`--sb-space-3: 12px` / `--sb-text-sm: 12px` …）── */
/* ⚠️ 必须把**全仓所有**的 px 变量都解出来，不能只解 `--sb-space/text/radius`：
   老代码大量写 `var(--text-sm)` / `var(--radius)` / `var(--space-2)` 这类 **V2 变量**，
   只认 V3 前缀会把它们当成「解析不出来」直接丢掉 ——
   于是 `fontSize: 12` 变成 `fontSize: var(--text-sm)` 会被误报成「值从 12 变成没有」。
   （这个假阳性我实测踩到过：一跑就报 161 条，其中大部分是解析不到的老 var。）
   ⚠️⚠️ 2026-09-15 修正（第 81 轮实测，**本文件此前与自己的声明相反**）：
   上面这段注释自初版就写着「全仓所有 px 变量」，但 `resolve()` 里的正则写的是
   `/^var\((--sb-[a-z0-9-]+)/` —— **只认 V3**。DEFS 老老实实收了 V2 变量，
   resolve 却从不查它们，于是 **全部 V2 声明被静默丢弃**（解析不到 = 不算，不报错）。
   后果：本脚本对「V2 → V3 的 token 迁移」**结构性失明** —— 而 D24 的迁移正是当前主线，
   也就是说这条「值一个都不许变」的棘轮，在最需要它的那条线上一直看不见。
   实测例：`border-radius: var(--radius-full)`（9999px）改写成 `var(--sb-radius-pill)`（9999px）
   是**零观感变更**，本脚本却报「border-radius=9999 88 → 90」——
   真相是「2 处从看不见变成看得见」，不是「值变了」。
   修法：正则放宽到任意 `var(--x)`，由 DEFS/别名链判定是不是 px；
   解不出来（calc/min/%/颜色/字体/缓动）依旧返回 null 跳过，行为不变。
   教训同 D11：**指标必须反映行为，不能靠「解不出来就跳过」把盲区伪装成达标。** */
const DEFS = new Map();
const CSS_FILES = [];
(function collect(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) collect(full);
    else if (name.endsWith('.css')) CSS_FILES.push(full);
  }
})(SRC);
for (const f of CSS_FILES) {
  const t = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  for (const m of t.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([0-9.]+)px\s*(?:;|\n|\})/g)) {
    if (!DEFS.has(m[1])) DEFS.set(m[1], parseFloat(m[2]));
  }
  for (const m of t.matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*var\((--[a-zA-Z0-9-]+)/g)) {
    if (!DEFS.has(m[1])) DEFS.set(m[1], { alias: m[2] });
  }
}
/** 解析一个变量的 px 值；解不出来返回 undefined（别名链最多跟 8 跳，防环） */
function varPx(name, depth = 0) {
  if (depth > 8) return undefined;
  const v = DEFS.get(name);
  if (v == null) return undefined;
  return typeof v === 'number' ? v : varPx(v.alias, depth + 1);
}
if (DEFS.size < 50) { console.error('✖ 变量表读取失败（只读到 ' + DEFS.size + ' 个），检查 ' + SRC); process.exit(2); }
const LADDER = { get: (k) => varPx(k), has: (k) => varPx(k) !== undefined };

/* ── 受管属性：间距 / 字号 / 圆角（含 JSX 驼峰与 CSS 短横两种写法）── */
const PROPS = [
  'gap', 'row-gap', 'rowGap', 'column-gap', 'columnGap',
  'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'font-size', 'fontSize', 'border-radius', 'borderRadius',
];
const PROP_RE = new RegExp('(?:^|[;{\\s\'"`])(' + PROPS.join('|') + ')\\s*:\\s*([^;,\'"`}]+)', 'g');

/** 把一个声明值解析成像素数字数组；解析不出来返回 null（calc/%/auto/em… 一律跳过） */
function resolve(raw) {
  const val = String(raw).replace(/!important/gi, '').trim();
  if (!val) return null;
  const parts = val.split(/\s+/);
  const out = [];
  for (const part of parts) {
    const tok = part.match(/^var\((--[a-z0-9-]+)/);
    if (tok) { if (!LADDER.has(tok[1])) return null; out.push(LADDER.get(tok[1])); continue; }
    const px = part.match(/^(-?[0-9.]+)px$/);
    if (px) { out.push(parseFloat(px[1])); continue; }
    const bare = part.match(/^(-?[0-9.]+)$/);
    if (bare) { out.push(parseFloat(bare[1])); continue; }   /* React 会给数字补 px */
    return null;
  }
  return out.length ? out : null;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (EXT.has(path.extname(name))) out.push(full);
  }
  return out;
}

/** 把一份「文件 → 源码文本」的来源解析成「文件 → { prop=值: 次数 }」 */
function multiset(readSource) {
  const out = {};
  for (const rel of readSource.files) {
    if (rel === 'src/styles/design-tokens-v3.css') continue;   /* 阶梯自己的定义不算 */
    const text = readSource.read(rel).replace(/\/\*[\s\S]*?\*\//g, ' ');
    const counts = {};
    for (const m of text.matchAll(PROP_RE)) {
      const px = resolve(m[2]);
      if (!px) continue;
      /* 圆角「胶囊」等价：任何 ≥999px 的值在真实元素上都是「完全圆头」——
         `999 → 9999` 这类迁移是零观感的（只有元素尺寸超过 2000px 才会看出差别），
         所以统一归到 9999，避免它每轮都刷屏掩盖真变化。 */
      const vals = /radius/i.test(m[1]) ? px.map(v => (v >= 999 ? 9999 : v)) : px;
      const key = m[1] + '=' + vals.join(',');
      counts[key] = (counts[key] || 0) + 1;
    }
    if (Object.keys(counts).length) out[rel] = counts;
  }
  return out;
}

const worktreeSource = {
  files: walk(SRC).map(f => path.relative(ROOT, f).split(path.sep).join('/')),
  read: rel => readFileSync(path.join(ROOT, rel), 'utf8'),
};
const current = multiset(worktreeSource);

/* ── --base=<commit>：直接和某个历史版本的**解析值**比 —— 这是最有用的用法，
   因为迁移期间最容易回答的问题就是「我这一轮到底有没有把间距改掉」。
   不需要维护基线文件。 ── */
/* 默认基准 = HEAD —— 也就是回答「**我这次改动**把哪些尺度值改了」。
   这是日常最有用的问题：迁移时你要证明「只换 token 名、没动值」。 */
const baseArg = process.argv.find(a => a.startsWith('--base=')) || '--base=HEAD';
if (baseArg) {
  const base = baseArg.slice(7);
  const list = execFileSync('git', ['ls-tree', '-r', '--name-only', base, '--', 'src'], { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean).filter(f => EXT.has(path.extname(f)));
  const baseSource = { files: list, read: rel => execFileSync('git', ['show', base + ':' + rel], { encoding: 'utf8', maxBuffer: 1 << 26 }) };
  const before = multiset(baseSource);
  /* ⚠️ 判定必须在**整棵树的合计**上做，不能逐文件判。
     反例（实测踩到）：把 NoteModal.jsx 里那一大段内联 `.ec-gallery-*` 样式挪到 .css 文件，
     是完全的**零观感重构**，但逐文件看会报「fontSize=12 9 → 0 / borderRadius=14 2 → 0」等 161 条假变化。
     合计之后「搬走的 + 搬来的」互相抵消，只有**真的把值改掉**才会浮出来。
     逐文件明细仍会打印，只作**定位线索**，不参与判定。 */
  const agg = (m) => { const o = {}; for (const f of Object.keys(m)) for (const [k, n] of Object.entries(m[f])) o[k] = (o[k] || 0) + n; return o; };
  const A = agg(before), B = agg(current);
  const keys = new Set([...Object.keys(A), ...Object.keys(B)]);
  const diffs = [];
  for (const key of keys) {
    const x = A[key] || 0, y = B[key] || 0;
    if (x === y) continue;
    const where = [];
    for (const f of new Set([...Object.keys(before), ...Object.keys(current)])) {
      const d = ((current[f] || {})[key] || 0) - ((before[f] || {})[key] || 0);
      if (d) where.push(f.replace('src/', '') + (d > 0 ? ' +' + d : ' ' + d));
    }
    diffs.push({ key, before: x, after: y, where: where.slice(0, 4).join('  ') });
  }
  if (!diffs.length) {
    const totalNow = Object.values(B).reduce((a, b) => a + b, 0);
    console.log('✅ 与 ' + base.slice(0, 8) + ' 相比，全站尺度**解析值**零变化（token 名可变、样式可在文件间搬动，值未变）');
    console.log('   受管声明 ' + totalNow + ' 条 · 变量表 ' + DEFS.size + ' 个（含 V2 老变量，已解别名链）');
    process.exit(0);
  }
  console.log('✖ 与 ' + base.slice(0, 8) + ' 相比，有 ' + diffs.length + ' 类尺度值发生变化：\n');
  for (const d of diffs.sort((a, b) => a.key.localeCompare(b.key))) {
    console.log('  ' + d.key.padEnd(24) + d.before + ' → ' + d.after + '    ' + (d.where ? '（' + d.where + '）' : ''));
  }
  console.log('\n注：「全站条数变化」也可能是**新增/删除 UI** 造成的，那属正常；请逐条确认是不是无意的间距改动。');
  process.exit(1);
}

const total = Object.values(current).reduce((a, c) => a + Object.values(c).reduce((x, y) => x + y, 0), 0);

if (process.argv.includes('--update')) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + '\n');
  console.log('已重锁基线：' + Object.keys(current).length + ' 个文件 / ' + total + ' 条声明');
  process.exit(0);
}

if (!existsSync(BASELINE)) { console.error('✖ 基线不存在，先跑 --update'); process.exit(2); }
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

const changes = [];
for (const file of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
  const b = baseline[file] || {}, c = current[file] || {};
  for (const key of new Set([...Object.keys(b), ...Object.keys(c)])) {
    const before = b[key] || 0, after = c[key] || 0;
    if (before !== after) changes.push({ file, key, before, after });
  }
}

if (!changes.length) {
  console.log('✅ 尺度棘轮正常 —— ' + Object.keys(current).length + ' 个文件 / ' + total + ' 条声明，解析后的像素值与基线完全一致');
  process.exit(0);
}
console.log('✖ 尺度值发生变化（token 名可以变，值不许变）：' + changes.length + ' 条\n');
const byFile = new Map();
for (const ch of changes) { if (!byFile.has(ch.file)) byFile.set(ch.file, []); byFile.get(ch.file).push(ch); }
for (const [f, list] of [...byFile].sort()) {
  console.log('  ' + f);
  for (const ch of list) console.log('    ' + ch.key + '   ' + ch.before + ' → ' + ch.after);
}
console.log('\n若这是**有意变更**：在提交说明里写明依据（哪条决策 / 为什么要改），再跑 --update 重锁；');
console.log('若这是**迁移副作用**：说明你把非阶梯值硬套到阶梯上了 —— 改回逐值相等的 token 或保留字面量。');
process.exit(1);
