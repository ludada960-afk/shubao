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
/* 注释行一律跳过：迁移时**补注释解释为什么**是好习惯，不该被当成越界。
   （不跳的话，`/* 字号 12.5px 归到 13 * /` 这类解释性注释会把报告刷满假阳性。） */
const isComment = s => { const t = s.trim(); return t.startsWith('/*') || t.startsWith('*') || t.startsWith('//'); };

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

/* ⚠️ 2026-09-20 改进（D18 线提报）：**从「行级」细化到「属性级」**。
   为什么必须改：同一行常常同时含尺度属性**与**非尺度属性
   （例：`padding: 6px 10px; border: 1px solid …; border-radius: 10px; background: #fff`）。
   原口径 flat() 抹平尺度值后行内仍有差异 → 整行报成「越界」，
   报告里只能看到一整行，**读者无法判断到底哪个属性变了**，
   于是真阳性被淹没在整行噪声里 —— 假阳性一多，门禁就会被无视（原则 §12 同源问题）。

   现在：抹平后仍不同时，再解析两行的 {prop: value}，
   只有**非尺度属性的值真的变了**才计入，并按「属性: 旧 → 新」列出。
   这样每一行报告都直接指出**是哪个属性被越界改了**。 */
const NONSCALE_PROP = /([a-zA-Z-]+)\s*:\s*('[^']*'|"[^"]*"|[^,;}]+)/g;
const nonScaleProps = (raw) => {
  const out = new Map();
  for (const m of raw.matchAll(NONSCALE_PROP)) {
    const p = m[1];
    if (/^(font-size|fontSize|border-radius|borderRadius|gap|row-gap|column-gap|padding|padding-top|padding-right|padding-bottom|padding-left|margin|margin-top|margin-right|margin-bottom|margin-left)$/.test(p)) continue;
    out.set(p, m[2].trim().replace(/^['"]|['"]$/g, ''));
  }
  return out;
};
const diffNonScale = (a, b) => {
  const A = nonScaleProps(a), B = nonScaleProps(b);
  const out = [];
  for (const [p, v] of A) if (B.has(p) && B.get(p) !== v) out.push(p + ': ' + v + ' → ' + B.get(p));
  return out;
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
    hits.push({ hash, subject, file, minus: m.trim(), plus: p.trim(), props: diffNonScale(m, p) });
  }
  removed = []; added = [];
};
for (const line of patch.split('\n')) {
  const head = line.match(/^([0-9a-f]{7,})\|(.*)$/);
  if (head) { flush(); hash = head[1]; subject = head[2]; continue; }
  const fm = line.match(/^\+\+\+ b\/(\S+)/);
  if (fm) {
    flush();
    file = fm[1];
    /* ⚠️ 只审**代码**文件。文档（.md）里写的统计数字会随迁移而变化，
       把文档算成「越界改动」是纯假阳性 —— 这类噪声会让门禁被无视。 */
    if (/\.(md|txt|json)$/i.test(file)) file = '';
    continue;
  }
  if (!file) continue;
  if (line.startsWith('@@') || line.startsWith('diff --git')) { flush(); continue; }
  if (line.startsWith('-') && !line.startsWith('---')) { if (!isComment(line.slice(1))) removed.push(line.slice(1)); continue; }
  if (line.startsWith('+') && !line.startsWith('+++')) { if (!isComment(line.slice(1))) added.push(line.slice(1)); continue; }
}
flush();

if (!hits.length) { console.log('✅ 未发现越界改动（' + (rangeArg ? range : args.includes('--staged') ? '暂存区' : args.includes('--worktree') ? '工作区' : range) + '）'); process.exit(0); }
console.log('✖ 发现 ' + hits.length + ' 行**越界改动**（抹平尺度值后仍有差异）：\n');
for (const h of hits.slice(0, 30)) {
  console.log((h.hash ? h.hash + '  ' + h.subject.slice(0, 44) + '  ' : '') + h.file);
  console.log('   -  ' + h.minus.slice(0, 140));
  console.log('   +  ' + h.plus.slice(0, 140));
  /* 属性级证据：直接说清"是哪个非尺度属性被改了"，而不是让人对着一整行找差异。 */
  if (h.props && h.props.length) console.log('   ⚠️ 越界属性: ' + h.props.join('  |  '));
}
if (hits.length > 30) console.log('\n…还有 ' + (hits.length - 30) + ' 行');
console.log('\n判读：**只有尺度值变了**的行不会出现在这里。出现的行说明这次迁移还改了别的东西 ——');
console.log('可能是①误伤（改回去）②有意为之（在提交说明里写明）。两者都必须有交代。');
process.exit(1);
