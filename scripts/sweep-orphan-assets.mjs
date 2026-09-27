#!/usr/bin/env node
/* ═══ 孤儿生成图清理（2026-09-27 批 CF）════════════════════════════════════════════════════════
   为什么要有它：生产实测（2026-09-27）—— `server/generated-assets` 有 **2072 个文件 ≈ 6.81 GB**，
   而数据库里**任何记录都引用不到**的有 **1973 个 ≈ 6.47 GB**。也就是说：占了 95% 空间的文件
   是早期生成后**没有被任何作品 / 资产 / 画布快照留着**的。保留期清理（按 7 天给作品立墓碑）
   回收不了这些 —— 它们本来就不挂在任何作品上。

   ── 判据（宁可少删，绝不误删）──────────────────────────────────────────────
   ① **全库引用扫描**：把数据库里**每一张表的每一个文本列**都扫一遍，抽出 64 位十六进制的生成图名。
      不是只查 works —— 画布快照、合成文档、项目资产、视频任务（含 refs_json）、商品档案、
      版本快照……凡是可能存着 URL 的地方都算"有人用"。
   ② **年龄下限**（默认 30 天）：正在生成/刚生成还没落库的文件、以及用户浏览器上开着的页面，
      都不可能超过这个岁数 ⇒ 不会误删"正在被用但还没写进库"的东西。
   ③ **只碰 generated-assets 目录**里、名字逐字匹配 `[a-f0-9]{64}\.(jpg|png|webp)` 的文件。
   ④ **默认 dry-run**：不传 `--apply` 只打印"会删什么、多少字节"，一个字都不删。
   ⑤ **审计日志**：真正删除时把每个文件名写进 `删除清单`（默认 `/tmp/orphan-sweep-<时间>.log`），
      事后能逐条对账。

   用法（在生产机上）：
     node scripts/sweep-orphan-assets.mjs                 # dry-run：只报告
     node scripts/sweep-orphan-assets.mjs --apply         # 真删（默认 30 天门槛）
     node scripts/sweep-orphan-assets.mjs --apply --min-age-days=60
*/
import Database from 'better-sqlite3';
import { readdirSync, readFileSync, statSync, unlinkSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ASSET_NAME_RE = /^[a-f0-9]{64}\.(?:jpg|png|webp)$/i;
const NAME_IN_TEXT_RE = /[a-f0-9]{64}\.(?:jpg|png|webp)/gi;

export const SWEEP_DEFAULT_MIN_AGE_DAYS = 30;

/* 纯函数：一批候选文件里，哪些能删（没有任何引用 + 够老）。
   ⚠️ 单独抽出来是为了能拿门禁直接跑 —— "可删判定"是这件事里唯一需要绝对正确的地方。 */
export function pickDeletable({ files = [], referenced = new Set(), now = Date.now(), minAgeDays = SWEEP_DEFAULT_MIN_AGE_DAYS } = {}) {
  const deletable = [];
  const young = [];
  for (const file of files) {
    if (referenced.has(String(file.name).toLowerCase())) continue;
    const ageDays = (now - Number(file.mtimeMs || 0)) / 86400000;
    if (!(ageDays >= minAgeDays)) { young.push(file.name); continue; }
    deletable.push(file);
  }
  return { deletable, young };
}

/* 全库引用扫描：每一张表、每一个文本列。 */
export function collectReferencedNames(db) {
  const referenced = new Set();
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);
  for (const table of tables) {
    if (/^sqlite_/.test(table)) continue;
    const columns = db.prepare(`PRAGMA table_info(${JSON.stringify(table)})`).all()
      .filter(column => /TEXT|CLOB|BLOB|JSON/i.test(String(column.type || '')) || column.type === '')
      .map(column => column.name);
    for (const column of columns) {
      let rows = [];
      try { rows = db.prepare(`SELECT ${JSON.stringify(column)} AS v FROM ${JSON.stringify(table)}`).all(); } catch { continue; }
      for (const row of rows) {
        const text = row?.v;
        if (typeof text === 'string' && text.length) {
          const matched = text.match(NAME_IN_TEXT_RE);
          if (matched) for (const name of matched) referenced.add(name.toLowerCase());
        }
      }
    }
  }
  return referenced;
}

/* ═══ 磁盘上的引用扫描（**数据库之外**的引用者）═══════════════════════════════════════════════
   ⚠️ 这一条是**实测差点出事**才加的：站里的「灵感发现 / 做同款」案例是**仓库里的静态 JSON**
   （`public/gallery/…/case.json`，构建后进 `dist/gallery/…`），里面直接写着生成图地址 ——
   它们**不在数据库里**，只扫库会把那 12 张案例图当成孤儿删掉，前台案例页就裂了。
   ⇒ 真删之前必须把**部署出去的静态目录**也扫一遍（`--scan-dir=/var/www/shubao/current`）。
   ⚠️ 注释里不要写「星号紧跟斜杠」——那会**提前闭合块注释**，本文件第一版就是这么炸的。 */
export function collectReferencedNamesFromDirs(dirs = []) {
  const referenced = new Set();
  const walk = dir => {
    let entries = [];
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      /* ⚠️ **必须跟着符号链接走**：部署目录里的 `gallery` 是链接（部署脚本单独搬运它），
         `entry.isDirectory()` 对链接一律返回 false ⇒ 第一版磁盘扫描**一个名字都没扫到**
         （实测：diskNames=0，于是 12 张案例图被当成孤儿）——这就是差点删掉前台案例的那一步。 */
      let isDir = entry.isDirectory();
      if (!isDir) { try { isDir = statSync(full).isDirectory(); } catch { isDir = false; } }
      if (isDir) { if (!/node_modules|\.git/.test(entry.name)) walk(full); continue; }
      if (!/\.(json|js|mjs|cjs|md|html|txt|css)$/i.test(entry.name)) continue;
      let text = '';
      try { text = readFileSync(full, 'utf8'); } catch { continue; }
      const matched = text.match(NAME_IN_TEXT_RE);
      if (matched) for (const name of matched) referenced.add(name.toLowerCase());
    }
  };
  for (const dir of dirs) walk(dir);
  return referenced;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  /* 静态目录里的引用也要算（案例 JSON 在仓库里、数据库里没有）—— 不传默认扫部署目录 */
  const scanDirs = args.filter(arg => arg.startsWith('--scan-dir=')).map(arg => arg.slice('--scan-dir='.length));
  /* ⚠️ **仓库侧的引用要显式给**：站里的「灵感发现 / 做同款」案例 JSON（`public/gallery/…/case.json`）
     里直接写着生成图地址，但它们**不在服务器上**（实测 find 一个都没有）⇒ 服务器侧的目录扫描看不见它们。
     所以由仓库生成一份名单（`scripts/data/gallery-asset-refs.txt`），运行时 `--refs-file=` 带上。 */
  const refsFileArg = args.find(arg => arg.startsWith('--refs-file='));
  const refsFile = refsFileArg ? refsFileArg.slice('--refs-file='.length) : '';
  const minAgeArg = args.find(arg => arg.startsWith('--min-age-days='));
  const minAgeDays = minAgeArg ? Number(minAgeArg.split('=')[1]) : SWEEP_DEFAULT_MIN_AGE_DAYS;
  const dbPath = process.env.SHUBO_DB || 'server/works.db';
  const assetDir = process.env.SHUBO_ASSET_DIR || 'server/generated-assets';

  if (!existsSync(dbPath) || !existsSync(assetDir)) {
    console.error('找不到数据库或资产目录：' + dbPath + ' / ' + assetDir);
    process.exit(1);
  }
  const db = new Database(dbPath, { readonly: true });
  /* 引用者 = 数据库里 + **部署出去的静态目录里**（案例 JSON 那种仓库侧引用，数据库里没有） */
  const referenced = collectReferencedNames(db);
  for (const name of collectReferencedNamesFromDirs(scanDirs.length ? scanDirs : ['/var/www/shubao/current'])) {
    referenced.add(name);
  }
  if (refsFile) {
    for (const line of readFileSync(refsFile, 'utf8').split(/\r?\n/)) {
      const name = line.trim().toLowerCase();
      if (name && ASSET_NAME_RE.test(name)) referenced.add(name);
    }
  }
  const files = [];
  let totalBytes = 0;
  for (const name of readdirSync(assetDir)) {
    if (!ASSET_NAME_RE.test(name)) continue;
    const file = join(assetDir, name);
    let info = null;
    try { info = statSync(file); } catch { continue; }
    totalBytes += info.size;
    files.push({ name, path: file, size: info.size, mtimeMs: info.mtimeMs });
  }
  const { deletable, young } = pickDeletable({ files, referenced, minAgeDays });
  const bytes = deletable.reduce((sum, file) => sum + file.size, 0);
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    minAgeDays,
    referencedNames: referenced.size,
    files: files.length,
    totalMb: Math.round(totalBytes / 1048576),
    deletableFiles: deletable.length,
    deletableMb: Math.round(bytes / 1048576),
    skippedYoung: young.length,
  }));

  if (!apply) {
    console.log('（dry-run：没有删除任何文件。要真删加 --apply）');
    return;
  }
  const logPath = process.env.SHUBO_SWEEP_LOG || ('/tmp/orphan-sweep-' + new Date().toISOString().replace(/[:.]/g, '-') + '.log');
  const lines = ['# 孤儿生成图清理 ' + new Date().toISOString() + ' 门槛 ' + minAgeDays + ' 天'];
  let deleted = 0;
  let deletedBytes = 0;
  for (const file of deletable) {
    try {
      unlinkSync(file.path);
      deleted += 1;
      deletedBytes += file.size;
      lines.push(file.name + '\t' + file.size);
    } catch (error) {
      lines.push('# 删除失败 ' + file.name + ' :: ' + String(error?.message || error));
    }
  }
  writeFileSync(logPath, lines.join('\n') + '\n', 'utf8');
  console.log(JSON.stringify({ deleted, deletedMb: Math.round(deletedBytes / 1048576), log: logPath }));
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1].replace(/\\/g, '/')).href) {
  main().catch(error => { console.error(error); process.exit(1); });
}
