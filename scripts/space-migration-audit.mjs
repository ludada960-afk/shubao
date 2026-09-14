#!/usr/bin/env node
/**
 * scripts/space-migration-audit.mjs
 * 尺度类 token 迁移的**等价性审计** —— 防止「把 12px 换成 var(--sb-space-5)=20px」
 * 这类**静默改观感**的迁移。覆盖三族属性：间距 / 字号 / 圆角。
 * ─────────────────────────────────────────────────────────────────────────────
 * 为什么会需要（真实事故，一次抓出 85 处）：
 *   第九批「gap 非阶梯 56% → 0%」的指令写明「必须给出像素级 diff 证明观感零变化」，
 *   实际执行成了「非阶梯值硬套最近阶梯」：
 *       12px → var(--sb-space-5) = 20px (Δ+8px)      4px → var(--sb-space-2) = 8px  (Δ+4px)
 *        6px → var(--sb-space-2) =  8px (Δ+2px) ×7   5px → var(--sb-space-2) = 8px  (Δ+3px) ×4
 *   间距是**布局**：改 1px 就可能让文案换行、按钮错位、卡片高度变化。
 *   这类回归**不会让任何测试变红**（全站没有断言锁间距），只能靠等价性审计抓。
 *
 * 口径（依 D15）：
 *   · 间距(gap/padding/margin) —— 只能替换**逐值相等**的字面量。
 *   · 字号(font-size)         —— 同上（没有任何决策授权改字号）。
 *   · 圆角(border-radius)     —— D6 **授权**把 10px 按场景归入 8/12、把 7px 归入 6/8，
 *                               这些属「有意变更」，本脚本放行；其余仍须逐值相等。
 *
 * 用法：
 *   node scripts/space-migration-audit.mjs                    # 默认窗口：最近 12 小时
 *   node scripts/space-migration-audit.mjs --since="1 day ago"
 *   node scripts/space-migration-audit.mjs --base=<commit>
 *   exit 1 = 发现不等价迁移；exit 2 = 脚本内阶梯真值与 token 文件漂移（脚本自己失准）
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** 真值表 —— 与 src/styles/design-tokens-v3.css 保持同步（下面会逐条自检） */
const LADDER = {
  '--sb-space-0': 0, '--sb-space-0-5': 2, '--sb-space-1': 4, '--sb-space-1-5': 6,
  '--sb-space-2': 8, '--sb-space-2-5': 10, '--sb-space-3': 12, '--sb-space-4': 16,
  '--sb-space-5': 20, '--sb-space-6': 24, '--sb-space-8': 32, '--sb-space-10': 40,
  '--sb-space-12': 48, '--sb-space-16': 64,
  '--sb-text-2xs': 10, '--sb-text-xs': 11, '--sb-text-sm': 12, '--sb-text-md': 13,
  '--sb-text-base': 14, '--sb-text-lg': 16, '--sb-text-xl': 18, '--sb-text-xl-plus': 20,
  '--sb-text-2xl': 24,
  '--sb-text-3xl': 32, '--sb-text-4xl': 48,
  '--sb-radius-xs': 4, '--sb-radius-sm': 6, '--sb-radius-md': 8, '--sb-radius-lg': 12,
  '--sb-radius-xl': 16, '--sb-radius-2xl': 20, '--sb-radius-3xl': 24,
};

const css = readFileSync(new URL('../src/styles/design-tokens-v3.css', import.meta.url), 'utf8');
const drift = [];
for (const [name, px] of Object.entries(LADDER)) {
  const m = css.match(new RegExp('--' + name.slice(2) + ':\\s*([0-9.]+)(px)?'));
  if (!m) drift.push(name + ' 在 token 文件里找不到');
  else if (parseFloat(m[1]) !== px) drift.push(name + ' 脚本写 ' + px + 'px，实际 ' + m[1] + 'px');
}
if (drift.length) {
  console.error('✖ 真值表漂移，先修脚本再看结果：\n  ' + drift.join('\n  '));
  process.exit(2);
}

/** D6 授权的圆角归并（有意变更，放行）—— 左值 → 允许去往的 token 集合 */
const RADIUS_SANCTIONED = { 10: ['--sb-radius-md', '--sb-radius-lg'], 7: ['--sb-radius-sm', '--sb-radius-md'] };

/** 属性 → 家族 */
const FAMILY = (p) => {
  if (/^(gap|row-gap|column-gap|padding|padding-top|padding-right|padding-bottom|padding-left|margin|margin-top|margin-right|margin-bottom|margin-left)$/.test(p)) return 'space';
  if (p === 'font-size') return 'text';
  if (p === 'border-radius') return 'radius';
  return null;
};
const TEXT_TOKEN = /^--sb-(text|font-size)-/;
const PROP = /(?:^|[;{\s'"`])(gap|row-gap|column-gap|padding|padding-top|padding-right|padding-bottom|padding-left|margin|margin-top|margin-right|margin-bottom|margin-left|font-size|fontSize|border-radius|borderRadius)\s*:\s*([^;,'"`]+)/;

/* ⚠️ 口径（2026-09-20 修正）：必须看**净效果**，不能看「逐个 commit 的 diff」。
   原因：一笔提交把 `12px → --sb-space-5`（错），下一笔把它改回 `12px`（对）——
   逐 commit 看仍然会报错，**但当前代码是完全正确的**，那是假警报。
   反过来也一样：只看最后一笔会漏掉「改了一半」。
   所以这里一律把 `base..HEAD` 当成**一个 patch** 来看（`git diff`，不是 `git log -p`）。 */
const args = process.argv.slice(2);
const sinceArg = args.find(a => a.startsWith('--since='));
const baseArg = args.find(a => a.startsWith('--base='));
let base = baseArg ? baseArg.slice(7) : null;
if (!base) {
  /* 没给 base 就用时间窗里**最早那笔**的父提交当基准（同样看净效果） */
  const since = sinceArg ? sinceArg.slice(8) : '12 hours ago';
  const oldest = execFileSync('git', ['log', '--since=' + since, '--format=%H', '--', 'src'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).pop();
  base = oldest ? oldest + '^' : 'HEAD';
}

const log = execFileSync('git', ['diff', '-U0', '--no-color', base + '..HEAD', '--', 'src'], { encoding: 'utf8', maxBuffer: 1 << 28 });
const chunks = log.split(/^diff --git /m).slice(1);
const bad = [];
const sanctioned = [];

for (const chunk of chunks) {
  const fileM = chunk.match(/a\/(\S+) b\//);
  if (!fileM) continue;
  const file = fileM[1];
  const commitM = chunk.match(/^commit ([0-9a-f]{7,40})/m);
  const commit = commitM ? commitM[1].slice(0, 8) : '';
  let pending = [];
  for (const ln of chunk.split('\n')) {
    if (ln.startsWith('@@')) { pending = []; continue; }
    if (ln.startsWith('---') || ln.startsWith('+++')) continue;
    if (ln.startsWith('-')) {
      const m = ln.slice(1).match(PROP);
      if (m) pending.push({ prop: m[1], raw: m[2].trim() });
      continue;
    }
    if (!ln.startsWith('+')) continue;
    const m = ln.slice(1).match(PROP);
    if (!m) continue;
    const prop = m[1];
    const fam = FAMILY(prop);
    if (!fam) continue;
    const tokM = m[2].match(/^var\((--[a-z0-9-]+)\)$/);
    if (!tokM) continue;
    const tok = tokM[1];
    const prev = pending.find(p => p.prop === prop);
    pending = [];
    const numM = prev && prev.raw.match(/^([0-9.]+)px$/);
    if (!numM) continue;
    const before = parseFloat(numM[1]);
    // 家族与 token 前缀必须匹配，否则是**串族**（把间距 token 用在字号上）
    /* 只看**全局尺度阶梯**（--sb-*）。组件内部自建的局部变量（--sk-space-*、
       --footer-actions-gap 之类）不在阶梯内，值由组件自己定义，不参与等价性判定。 */
    if (!/^--sb-/.test(tok)) { continue; }
    const familyOk = fam === 'space' ? /^--sb-space-/.test(tok)
      : fam === 'text' ? TEXT_TOKEN.test(tok)
      : /^--sb-radius-/.test(tok);
    if (!familyOk) { bad.push({ file, commit, prop, from: before + 'px', to: tok, kind: '串族：' + fam + ' 属性用了 ' + tok }); continue; }
    const tokPx = LADDER[tok];
    if (tokPx == null) continue;
    if (Math.abs(before - tokPx) <= 0.001) continue;
    if (fam === 'radius' && RADIUS_SANCTIONED[before] && RADIUS_SANCTIONED[before].includes(tok)) {
      sanctioned.push({ file, commit, from: before + 'px', to: tok + '=' + tokPx + 'px' });
      continue;
    }
    bad.push({ file, commit, prop, from: before + 'px', to: tok + '=' + tokPx + 'px', delta: tokPx - before, kind: fam });
  }
}

const label = '净效果 ' + base.slice(0, 8) + '..HEAD';
if (sanctioned.length) {
  console.log('ℹ D6 授权的圆角归并（有意变更，需在提交说明里注明）：' + sanctioned.length + ' 处');
  for (const s of sanctioned.slice(0, 12)) console.log('    ' + s.file + '  ' + s.from + ' → ' + s.to);
  console.log('');
}
if (!bad.length) {
  console.log('✅ 尺度 token 迁移全部等价或已授权（' + label + '）');
  process.exit(0);
}
const byFile = new Map();
for (const b of bad) { if (!byFile.has(b.file)) byFile.set(b.file, []); byFile.get(b.file).push(b); }
const space = bad.filter(b => b.kind === 'space').length;
const text = bad.filter(b => b.kind === 'text').length;
const radius = bad.filter(b => b.kind === 'radius').length;
const cross = bad.filter(b => String(b.kind).startsWith('串族')).length;
console.log('✖ 发现 ' + bad.length + ' 处不等价迁移（间距 ' + space + ' / 字号 ' + text + ' / 圆角 ' + radius + ' / 串族 ' + cross + '）：\n');
for (const [f, list] of [...byFile].sort()) {
  console.log('  ' + f);
  for (const b of list) console.log('    ' + b.commit + '  ' + b.prop + ': ' + b.from + ' → ' + b.to + (b.delta != null ? '  (Δ' + (b.delta > 0 ? '+' : '') + b.delta + 'px)' : '  [' + b.kind + ']'));
}
console.log('\n修法：只能换**逐值相等**的 token；非阶梯值保持字面量，或先裁定把它加进阶梯（加档位本身零观感变更）。');
process.exit(1);
