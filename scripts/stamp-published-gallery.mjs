/* 一次性回填：给**已经发布**的案例图补上 AIGC 隐式标识。

   为什么要单独回填而不是重跑 import：import 会重新转码（画质再掉一次），
   而 WebP 走的是零重编码的 XMP 注入 —— 像素一个字节都不动，只在 RIFF 里加 chunk。

   ⚠️ cover.webp 的 URL 带 `?v=<sha1前12位>` 做缓存版本号。
      改了文件就必须同步改 JSON 里的版本号，否则浏览器/CDN 继续吐旧文件，
      标识等于没补上。这一步最容易漏。

   幂等：已带 AIGC 标识的文件会被跳过，可以重复运行。 */
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { stampImage, contentIdFor } from '../server/aigcStamp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GALLERY = path.join(ROOT, 'public', 'gallery', 'ecommerce');
const INDEX = path.join(GALLERY, 'cases.json');

const DRY = process.argv.includes('--dry-run');

function alreadyStamped(buffer) {
  return buffer.includes(Buffer.from('AIGCContentId', 'latin1'));
}

async function stampFile(filePath, contentId) {
  const before = await fs.readFile(filePath);
  if (alreadyStamped(before)) return { skipped: true, before, after: before };
  const after = await stampImage(before, { contentType: 'image/webp', contentId, sharp });
  if (Buffer.compare(before, after) === 0) {
    console.warn('  ⚠️ 未能写入标识：' + path.basename(filePath));
    return { skipped: true, before, after: before };
  }
  /* 自检：写完必须仍是合法图，否则宁可不写（页面裂图比缺标识更糟） */
  const meta = await sharp(after).metadata();
  if (meta.format !== 'webp') throw new Error('写入后不再是合法 webp：' + filePath);
  if (!alreadyStamped(after)) throw new Error('写入后仍读不到标识：' + filePath);
  return { skipped: false, before, after };
}

const summary = { stamped: 0, skipped: 0, covers: [] };

const caseDirs = (await fs.readdir(GALLERY, { withFileTypes: true }))
  .filter(e => e.isDirectory())
  .map(e => e.name);

for (const id of caseDirs) {
  const dir = path.join(GALLERY, id);
  const files = (await fs.readdir(dir)).filter(f => f.endsWith('.webp'));
  console.log('\n[' + id + ']');
  let coverBefore = null;
  let coverAfter = null;

  for (const file of files.sort()) {
    const isCover = file === 'cover.webp';
    /* 与 import-ecommerce-gallery-case.mjs 用同一套 contentId，
       这样以后重跑 import 得到的编号与现在一致（可复现 = 可取证）。 */
    const contentId = isCover
      ? contentIdFor('gallery-cover:' + id, 'mosaic')
      : contentIdFor('gallery:' + id, file);
    const r = await stampFile(path.join(dir, file), contentId);
    if (r.skipped) { summary.skipped += 1; console.log('  · ' + file + '（已有标识，跳过）'); }
    else {
      summary.stamped += 1;
      if (!DRY) await fs.writeFile(path.join(dir, file), r.after);
      console.log('  ✓ ' + file + '  ' + r.before.length + ' → ' + r.after.length + ' 字节');
    }
    if (isCover) { coverBefore = r.before; coverAfter = r.after; }
  }

  if (coverAfter) {
    /* ⚠️ **每次都重算并同步**，不是「改了才同步」。
       踩过的坑：上一轮脚本因为 stdout 管道断掉（EPIPE）在中途死了 —— 24 个 webp
       已经打好标，但只更新了第一个案例的 JSON。第二个案例的 cover 磁盘上已是带标识的
       新文件，JSON 里却还指着旧版本号 ⇒ 浏览器/CDN 继续吐**旧的没标识文件**，
       标识看着补了其实没生效。
       只在「本次有改动」时同步，中断后就再也补不回来了。 */
    const rev = createHash('sha1').update(coverAfter).digest('hex').slice(0, 12);
    summary.covers.push({ id, rev });
  }
}

/* ── 同步 cover 的 ?v= 缓存版本号 ───────────────────────────────────────────
   不做这步，浏览器和 CDN 会继续吐旧 cover.webp —— 标识看着补了，其实没生效。 */
let coverFixed = 0;
if (!DRY) {
  for (const { id, rev } of summary.covers) {
    for (const file of [path.join(GALLERY, id, 'case.json'), INDEX]) {
      let text;
      try { text = await fs.readFile(file, 'utf8'); } catch { continue; }
      /* 正则不带路径前缀，/images/gallery/… 与 /gallery/… 两种写法都能命中 */
      const updated = text.replace(
        new RegExp('(/gallery/ecommerce/' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/cover\\.webp)(\\?v=[0-9a-f]{12})?', 'g'),
        '$1?v=' + rev,
      );
      if (updated !== text) {
        await fs.writeFile(file, updated, 'utf8');
        coverFixed++;
        console.log('\n↻ ' + path.relative(ROOT, file) + ' 的 cover 版本号 → ?v=' + rev);
      }
    }
  }
}

console.log('\n' + (DRY ? '[试运行] ' : '') + '已打标 ' + summary.stamped + ' 张，跳过 ' + summary.skipped + ' 张');
if (coverFixed) console.log('cover 缓存版本号修正 ' + coverFixed + ' 处');
if (!DRY && summary.stamped === 0 && summary.skipped === 0) console.log('（没有找到案例图，确认路径：' + GALLERY + '）');
