#!/usr/bin/env node
/**
 * scripts/space-migration-audit.mjs
 * 间距 token 迁移的**等价性审计** —— 防止「把 12px 换成 var(--sb-space-5)=20px」这类
 * 静默改观感的迁移。
 * ─────────────────────────────────────────────────────────────────────────────
 * 为什么会需要（真实事故）：
 *   第九批「gap 非阶梯 56% → 0%」的指令里写的是「必须给出像素级 diff 证明观感零变化」，
 *   但实际执行时出现了把**非阶梯值硬套到最近阶梯**的做法：
 *       12px → var(--sb-space-5)   = 20px   (Δ+8px)
 *        4px → var(--sb-space-2)   =  8px   (Δ+4px)
 *        6px → var(--sb-space-2)   =  8px   (Δ+2px)   ×7
 *   一次审计就找出 48 处。间距是**布局**，改 1px 就可能让文案换行、按钮错位、
 *   卡片高度变化 —— 这类回归不会让任何测试变红，只能靠等价性审计抓。
 *
 * 口径：token 只能替换**与之逐值相等**的字面量。
 *   阶梯里没有的值（1,2,3,5,6,7,9,10,11,13,14,18,22,26…）**必须保持字面量**，
 *   除非先由设计裁定把该值加进阶梯（加阶梯条目本身是零观感变更的）。
 *
 * 用法：
 *   node scripts/space-migration-audit.mjs                 # 审计最近 12 小时 src/ 的全部提交
 *   node scripts/space-migration-audit.mjs --since="1 day ago"
 *   node scripts/space-migration-audit.mjs --base=<commit>  # 审计 base..HEAD
 *   exit 1 = 发现不等价迁移
 */
import { execFileSync } from 'node:child_process';

/** 阶梯真值 —— 与 src/styles/design-tokens-v3.css §9 保持同步（本脚本会在运行时校验） */
const LADDER = {
  '--sb-space-0': 0, '--sb-space-1': 4, '--sb-space-2': 8, '--sb-space-3': 12,
  '--sb-space-4': 16, '--sb-space-5': 20, '--sb-space-6': 24, '--sb-space-8': 32,
  '--sb-space-10': 40, '--sb-space-12': 48, '--sb-space-16': 64,
};

/** 先自检阶梯真值与 token 文件一致 —— 否则审计本身就是错的 */
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../src/styles/design-tokens-v3.css', import.meta.url), 'utf8');
const drift = [];
for (const [name, px] of Object.entries(LADDER)) {
  const m = css.match(new RegExp(name + ':\\s*([0-9.]+)(px)?'));
  if (!m) drift.push(name + ' 在 token 文件里找不到');
  else if (parseFloat(m[1]) !== px) drift.push(name + ' 脚本写 ' + px + 'px，实际 ' + m[1] + 'px');
}
if (drift.length) {
  console.error('✖ 阶梯真值漂移，先修脚本再看结果：\n  ' + drift.join('\n  '));
  process.exit(2);
}

const args = process.argv.slice(2);
const sinceArg = args.find(a => a.startsWith('--since='));
const baseArg = args.find(a => a.startsWith('--base='));
const range = baseArg ? [baseArg.slice(7) + '..HEAD'] : ['--since=' + (sinceArg ? sinceArg.slice(8) : '12 hours ago')];

const log = execFileSync('git', ['log', '-p', '-U0', '--no-color', ...range, '--', 'src'], { encoding: 'utf8', maxBuffer: 1 << 28 });
const files = log.split(/^diff --git /m).slice(1);
const bad = [];
const PROPS = /(?:^|[;{\s])(gap|row-gap|column-gap|padding|padding-top|padding-right|padding-bottom|padding-left|margin|margin-top|margin-right|margin-bottom|margin-left)\s*:\s*([^;]+);/;

for (const chunk of files) {
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
      const m = ln.slice(1).match(PROPS);
      if (m) pending.push({ prop: m[1], raw: m[2].trim() });
      continue;
    }
    if (ln.startsWith('+')) {
      const m = ln.slice(1).match(PROPS);
      if (!m) continue;
      const tokM = m[2].match(/^var\((--sb-space-[0-9.]+)\)$/);
      if (tokM) {
        const tokPx = LADDER[tokM[1]];
        const prev = pending.find(p => p.prop === m[1]);
        const numM = prev && prev.raw.match(/^([0-9.]+)px$/);
        if (numM && tokPx != null) {
          const before = parseFloat(numM[1]);
          if (Math.abs(before - tokPx) > 0.001) {
            bad.push({ file, commit, prop: m[1], from: before + 'px', to: tokM[1] + '=' + tokPx + 'px', delta: tokPx - before });
          }
        }
        pending = [];
      }
      continue;
    }
  }
}

if (!bad.length) {
  console.log('✅ 间距 token 迁移全部等价（' + (baseArg ? baseArg.slice(7) + '..HEAD' : '窗口 ' + (sinceArg || '--since=12 hours ago')) + '）');
  process.exit(0);
}
console.log('✖ 发现 ' + bad.length + ' 处**不等价**的间距 token 迁移（会把 1px 的差别放大成布局变化）：\n');
const byFile = new Map();
for (const b of bad) { if (!byFile.has(b.file)) byFile.set(b.file, []); byFile.get(b.file).push(b); }
for (const [f, list] of [...byFile].sort()) {
  console.log('  ' + f);
  for (const b of list) console.log('    ' + b.commit + '  ' + b.prop + ': ' + b.from + ' → ' + b.to + '  (Δ' + (b.delta > 0 ? '+' : '') + b.delta + 'px)');
}
console.log('\n修法：阶梯里没有的值**保持字面量**；要收编就先由设计裁定把该值加进阶梯（加条目本身零观感变更）。');
process.exit(1);
