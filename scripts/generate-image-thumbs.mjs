#!/usr/bin/env node
// 压缩管线：为 public/images 下的位图生成 .thumbs/<相对路径>.webp 预览版。
// - 默认只处理被 src/ 引用的图片（避免为遗留素材制造仓库噪声）
// - --all 处理全部；--force 跳过新鲜度检查强制重生成
// 幂等：缩略图已存在且不旧于源图时跳过。
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const IMAGES_DIR = path.join(ROOT, 'public', 'images');
const THUMBS_DIR = path.join(IMAGES_DIR, '.thumbs');
const SRC_DIR = path.join(ROOT, 'src');
const MAX_WIDTH = 720;
const WEBP_QUALITY = 82;
const SOURCE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
const argv = new Set(process.argv.slice(2));
const force = argv.has('--force');
const referencedOnly = !argv.has('--all');

function walkFiles(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.thumbs') continue;
    const child = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(child, visit);
    else visit(child);
  }
}

function referencedImageRelPaths() {
  const refs = new Set();
  walkFiles(SRC_DIR, filePath => {
    if (!/\.(jsx?|tsx?|mjs|css)$/.test(filePath)) return;
    const text = fs.readFileSync(filePath, 'utf8');
    for (const match of text.matchAll(/\/images\/[A-Za-z0-9_@\-.\/]+?\.(?:png|jpe?g)/gi)) {
      refs.add(match[0].slice('/images/'.length));
    }
  });
  return refs;
}

function thumbPathFor(relativePath) {
  const withoutExtension = relativePath.replace(/\.(png|jpe?g)$/i, '');
  return path.join(THUMBS_DIR, `${withoutExtension}.webp`);
}

async function main() {
  const referenced = referencedOnly ? referencedImageRelPaths() : null;
  const sources = [];
  walkFiles(IMAGES_DIR, filePath => {
    const extension = path.extname(filePath).toLowerCase();
    if (!SOURCE_EXTENSIONS.has(extension)) return;
    const relativePath = path.relative(IMAGES_DIR, filePath).replaceAll('\\', '/');
    if (referenced && !referenced.has(relativePath)) return;
    sources.push({ relativePath, filePath });
  });
  sources.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

  let generatedBytes = 0;
  let sourceBytes = 0;
  let skipped = 0;
  let failed = 0;
  const rows = [];

  for (const source of sources) {
    const stat = fs.statSync(source.filePath);
    const thumbPath = thumbPathFor(source.relativePath);
    if (!force && fs.existsSync(thumbPath) && fs.statSync(thumbPath).mtimeMs >= stat.mtimeMs) {
      skipped += 1;
      continue;
    }
    try {
      const rendered = await sharp(source.filePath)
        .rotate()
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toBuffer();
      fs.mkdirSync(path.dirname(thumbPath), { recursive: true });
      const temporaryPath = `${thumbPath}.tmp`;
      fs.writeFileSync(temporaryPath, rendered);
      fs.renameSync(temporaryPath, thumbPath);
      sourceBytes += stat.size;
      generatedBytes += rendered.byteLength;
      rows.push({
        path: source.relativePath,
        beforeKb: Math.round(stat.size / 1024),
        afterKb: Math.round(rendered.byteLength / 1024),
      });
    } catch (error) {
      failed += 1;
      console.error(`[image-thumbs] FAILED ${source.relativePath}: ${error.message}`);
    }
  }

  rows.sort((left, right) => right.beforeKb - left.beforeKb);
  for (const row of rows) {
    console.log(`${String(row.beforeKb).padStart(6)} KB -> ${String(row.afterKb).padStart(5)} KB  ${row.path}`);
  }
  console.log(`---`);
  console.log(
    `sources=${sources.length} generated=${rows.length} skipped(fresh)=${skipped} failed=${failed}` +
      (rows.length ? ` payload=${Math.round(sourceBytes / 1024)}KB -> ${Math.round(generatedBytes / 1024)}KB` : ''),
  );
  if (failed > 0) process.exitCode = 1;
}

main();
