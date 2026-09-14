#!/usr/bin/env node
/**
 * scripts/migration-scope-audit.mjs
 * 批量迁移的**越界审计** —— 找出「迁移提交里改了、但本不该改」的行。
 * ─────────────────────────────────────────────────────────────────────────────
 * 为什么需要（两次真实事故）：
 *   ① D19 批 3 在改字号时，把 `.ec-canvas-bottom-dock` 的 `left: 50%` 改成 `50vw`
 *      并**删掉了 `min()` 回夹** —— 那是「用户提了 4 次」的问题的修复代码；
 *   ② D19 批 4 把推荐档价格 40px 落档到 32px，而普通档基准是 36px ——
 *      结果「推荐档比普通档还小」，主次做反。
 *   两次都是**契约测试**抓回来的；但契约测试只覆盖它断言到的那些点。
 *   本脚本补上系统性的一层：**把迁移声明的属性值抹平，看剩下的差异**。
 *
 * 原理：
 *   迁移只应改「尺度类属性」的**值**（font-size / border-radius / gap / padding / margin）。
 *   把这些值统一替换成占位符后，`-` 与 `+` 两侧应当**逐字相同**；
 *   若不同，说明这次迁移还改了别的东西 —— 那就是越界。
 *
 * 用法：
 *   node scripts/migration-scope-audit.mjs                       # 最近 40 个提交
 *   node scripts/migration-scope-audit.mjs --range=HEAD~80..HEAD
 *   node scripts/migration-scope-audit.mjs --staged             # 只审暂存区（提交前自检）
 *   node scripts/migration-scope-audit.mjs --worktree           # 只审工作区未提交改动
 *   exit 1 = 发现越界改动
 */
import { execFileSync } from 'node:child_process';

const SCALE_PROP = /(font-size|fontSize|border-radius|borderRadius|gap|row-gap|column-gap|padding|padding-top|padding-right|padding-bottom|padding-left|margin|margin-top|margin-right|margin-bottom|margin-left)\s*:\s*[^;}"']+/g;
const flat = s => s.replace(SCALE_PROP, (m, p) => p + ':·');

const args = process.argv.slice(2);
const rangeArg = args.find(a => a.startsWith('--range='));
const range = rangeArg ? rangeArg.slice(8) : 'HEAD~40..HEAD';

let patch;
if (args.includes('--staged')) patch = execFileSync('git', ['diff','--cached','-U0'], { encoding: 'utf8', maxBuffer: 1<<28 });
else if (args.includes('--worktree')) patch = execFileSync('git', ['diff','-U0'], { encoding: 'utf8', maxBuffer: 1<<28 });
else patch = execFileSync('git', ['log','-p','-U0','--no-color','--format=%h|%s', range], { encoding: 'utf8', maxBuffer: 1<<28 });

/* ⚠️ 配对必须**按选择器**，不能**按位置**。
   第一版按「下一条 + 行」配对，在「插入新规则」的 diff 里会整体错位，
   于是报了一堆「.canvas-library-card-body small ↔ input」这种**根本不是一对**的假阳性。
   现在：每个文件内，把 `-` 行与 `+` 行各自按**行的 key**（有 `{` 取选择器，否则取首个属性名）分桶，只在同 key 之间比较。
   找不到同 key 的伙伴 = 这一行是**新增/删除**，不是修改，跳过。 */
const keyOf = (raw) => {
  const s = raw.trim();
  const brace = s.indexOf('{');
  if (brace >= 0) return 'sel:' + s.slice(0, brace).trim();
  const decl = s.match(/^(-{0,2}[a-zA-Z-]+)\s*:/);
  return decl ? 'prop:' + decl[1] : 'raw:' + s.slice(0, 40);
};

const hits = [];
let hash = '', subject = '', file = '';
let removed = [], added = [];
const flush = () => {
  if (!removed.length || !added.length) { removed = []; added = []; return; }
  const addByKey = new Map();
  for (const a of added) { const k = keyOf(a); if (!addByKey.has(k)) addByKey.set(k, []); addByKey.get(k).push(a); }
  for (const m of removed) {
    const k = keyOf(m);
    const bucket = addByKey.get(k);
    if (!bucket || !bucket.length) continue;
    const p = bucket.shift();
    if (flat(m).trim() === flat(p).trim()) continue;
    hits.push({ hash, subject, file, minus: m.trim(), plus: p.trim() });
  }
  removed = []; added = [];
};
for (const line of patch.split('\n')) {
  const head = line.match(/^([0-9a-f]{7,})\|(.*)$/);
  if (head) { flush(); hash = head[1]; subject = head[2]; continue; }
  const fm = line.match(/^\+\+\+ b\/(\S+)/);
  if (fm) { flush(); file = fm[1]; continue; }
  if (line.startsWith('@@') || line.startsWith('diff --git')) { flush(); continue; }
  if (line.startsWith('-') && !line.startsWith('---')) { removed.push(line.slice(1)); continue; }
  if (line.startsWith('+') && !line.startsWith('+++')) { added.push(line.slice(1)); continue; }
}
flush();

if (!hits.length) { console.log('✅ 未发现越界改动（' + (rangeArg ? range : args.includes('--staged') ? '暂存区' : args.includes('--worktree') ? '工作区' : range) + '）'); process.exit(0); }
console.log('✖ 发现 ' + hits.length + ' 行**越界改动**（抹平尺度值后仍有差异）：\n');
for (const h of hits.slice(0, 30)) {
  console.log((h.hash ? h.hash + '  ' + h.subject.slice(0, 44) + '  ' : '') + h.file);
  console.log('   -  ' + h.minus.slice(0, 140));
  console.log('   +  ' + h.plus.slice(0, 140));
}
if (hits.length > 30) console.log('\n…还有 ' + (hits.length - 30) + ' 行');
console.log('\n判读：**只有尺度值变了**的行不会出现在这里。出现的行说明这次迁移还改了别的东西 ——');
console.log('可能是①误伤（改回去）②有意为之（在提交说明里写明）。两者都必须有交代。');
process.exit(1);
