#!/usr/bin/env node
// 首屏图片优化管线（可复现）：
//  1) 生成/校核 4 张登录卡 .thumbs WebP（720px，必须 <=200KB）；
//  2) 生成电商套图 finalComposite 的 1600px WebP 详情图（替换 6.3MB 源 PNG 的首屏引用）+ 其 720px 缩略；
//  3) 校验首屏关键资产（登录卡/套图成片/两套多角度 selector+workflow）的缩略链路全部落盘且 <=200KB。
// 工具：单依赖 sharp（项目 devDependencies ^0.35.2，node:fs 标准库）。幂等：目标已存在且不旧于源图时跳过。
// 用法：node scripts/optimize-home-images.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const IMAGES_DIR = path.join(ROOT, 'public', 'images');
const THUMBS_DIR = path.join(IMAGES_DIR, '.thumbs');
const MAX_THUMB_WIDTH = 720;
const THUMB_QUALITY = 82;
const DETAIL_MAX_WIDTH = 1600;
const DETAIL_QUALITY = 82;
const SIZE_BUDGET_BYTES = 200 * 1024; // 单张 <=200KB（任务红线）
const force = process.argv.includes('--force');

// ── 首屏关键资产清单（与 src/pages/Home 渲染路径一一对应）──────────────────
const MODE_CARDS = [
  { rel: 'home/entry-ecommerce.png', thumbRel: 'home/entry-ecommerce.webp' },
  { rel: 'home/entry-video.png', thumbRel: 'home/entry-video.webp' },
  { rel: 'home/entry-xhs.png', thumbRel: 'home/entry-xhs.webp' },
  { rel: 'home/entry-visual.png', thumbRel: 'home/entry-visual.webp' },
];

// finalComposite 详情图：1600px WebP 替代 6.3MB 源 PNG（源 PNG 保留不删，供回滚/下载）
const COMPOSITE_DETAIL_REL = 'home/ecommerce-showcase/earbuds-suite-composite-v3-1600.webp';
const COMPOSITE_SOURCE_REL = 'home/ecommerce-showcase/earbuds-suite-composite-v3.png';

const TRYON_PREVIEW_SRCS = [
  'home/tryon-showcase/editorial-multi-angle-fan-v7.webp',
  'home/tryon-showcase/editorial-multi-angle-workflow-v7.png',
];

function shouldGenerate(outPath, srcPath) {
  if (!fs.existsSync(outPath)) return true;
  if (force) return true;
  return fs.statSync(outPath).mtimeMs < fs.statSync(srcPath).mtimeMs;
}

async function webpOf(srcPath, width, quality, outPath) {
  const buf = await sharp(srcPath)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
  return buf.byteLength;
}

async function main() {
  const rows = [];
  let failures = 0;

  // 1) 登录卡缩略
  for (const card of MODE_CARDS) {
    const srcPath = path.join(IMAGES_DIR, card.rel);
    const outPath = path.join(THUMBS_DIR, card.thumbRel);
    if (!fs.existsSync(srcPath)) { console.error('MISSING SOURCE ' + card.rel); failures += 1; continue; }
    const before = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;
    if (shouldGenerate(outPath, srcPath)) {
      const bytes = await webpOf(srcPath, MAX_THUMB_WIDTH, THUMB_QUALITY, outPath);
      rows.push({ kind: 'thumb', rel: card.thumbRel, beforeKb: Math.round(before/1024), afterKb: Math.round(bytes/1024) });
      if (bytes > SIZE_BUDGET_BYTES) { console.error('OVER BUDGET ' + card.thumbRel); failures += 1; }
    } else {
      const bytes = fs.statSync(outPath).size;
      rows.push({ kind: 'thumb', rel: card.thumbRel, beforeKb: Math.round(before/1024), afterKb: Math.round(bytes/1024), skipped: true });
      if (bytes > SIZE_BUDGET_BYTES) { console.error('OVER BUDGET ' + card.thumbRel); failures += 1; }
    }
  }

  // 2) 套图成片：1600px 详情 WebP + 720px 缩略
  const compositeSrc = path.join(IMAGES_DIR, COMPOSITE_SOURCE_REL);
  const compositeDetail = path.join(IMAGES_DIR, COMPOSITE_DETAIL_REL);
  if (fs.existsSync(compositeSrc)) {
    if (shouldGenerate(compositeDetail, compositeSrc)) {
      const bytes = await webpOf(compositeSrc, DETAIL_MAX_WIDTH, DETAIL_QUALITY, compositeDetail);
      rows.push({ kind: 'detail', rel: COMPOSITE_DETAIL_REL, beforeKb: Math.round(fs.statSync(compositeSrc).size/1024), afterKb: Math.round(bytes/1024) });
      if (bytes > SIZE_BUDGET_BYTES) {
        // 预算内收紧：降到 1280px 重出一次
        const retry = await webpOf(compositeSrc, 1280, 78, compositeDetail);
        console.warn('composite detail over 200KB at 1600px -> regenerated at 1280px: ' + Math.round(retry/1024) + 'KB');
        if (retry > SIZE_BUDGET_BYTES) failures += 1;
      }
    }
    const detailBuf = await sharp(compositeDetail).metadata();
    const thumbOut = path.join(THUMBS_DIR, 'home/ecommerce-showcase/earbuds-suite-composite-v3-1600.webp');
    if (shouldGenerate(thumbOut, compositeDetail)) {
      const bytes = await webpOf(compositeDetail, MAX_THUMB_WIDTH, THUMB_QUALITY, thumbOut);
      rows.push({ kind: 'thumb', rel: 'home/ecommerce-showcase/earbuds-suite-composite-v3-1600.webp', beforeKb: 0, afterKb: Math.round(bytes/1024) });
    }
  }

  // 2.5) 电商案例卡封面：/gallery/ 路径不走 /images/ 缩略管线，把封面复制到
  // public/images/gallery/ecommerce/<id>/cover.webp（URL=/images/gallery/... 可走 .thumbs 路由）
  // 并生成 720px 缩略；cases.json 的 cover_url 指向该副本（见本脚本末尾的覆盖修正）。
  const ECOMMERCE_COVER_IDS = ['baby-bottle-product-suite', 'stainless-steel-sauce-container'];
  for (const id of ECOMMERCE_COVER_IDS) {
    const coverSrc = path.join(ROOT, 'public', 'gallery', 'ecommerce', id, 'cover.webp');
    const routedSrc = path.join(IMAGES_DIR, 'gallery', 'ecommerce', id, 'cover.webp');
    if (!fs.existsSync(coverSrc)) { console.error('MISSING COVER ' + coverSrc); failures += 1; continue; }
    const srcStat = fs.statSync(coverSrc);
    if (shouldGenerate(routedSrc, coverSrc)) {
      fs.mkdirSync(path.dirname(routedSrc), { recursive: true });
      fs.copyFileSync(coverSrc, routedSrc);
    }
    const thumbOut = path.join(THUMBS_DIR, 'gallery', 'ecommerce', id, 'cover.webp');
    if (shouldGenerate(thumbOut, routedSrc)) {
      const bytes = await webpOf(routedSrc, MAX_THUMB_WIDTH, THUMB_QUALITY, thumbOut);
      rows.push({ kind: 'thumb', rel: 'gallery/ecommerce/' + id + '/cover.webp', beforeKb: Math.round(srcStat.size/1024), afterKb: Math.round(bytes/1024) });
      if (bytes > SIZE_BUDGET_BYTES) { console.error('OVER BUDGET gallery/ecommerce/' + id + '/cover.webp'); failures += 1; }
    }
    const thumbSize = fs.statSync(thumbOut).size;
    if (thumbSize > SIZE_BUDGET_BYTES) { console.error('OVER BUDGET gallery/ecommerce/' + id + '/cover.webp thumb'); failures += 1; }
    rows.push({ kind: 'verify', rel: 'gallery/ecommerce/' + id + '/cover.webp (thumb ' + Math.round(thumbSize/1024) + 'KB)' });
  }

  // 3) 校验：两套 tryon 资产在 .thumbs 必须有落盘缩略且 <=200KB
  for (const srcRel of TRYON_PREVIEW_SRCS) {
    const stem = srcRel.replace(/\.(png|jpe?g|webp)$/i, '');
    const thumbRel = stem + '.webp';
    const thumbPath = path.join(THUMBS_DIR, thumbRel);
    if (!fs.existsSync(thumbPath)) { console.error('MISSING THUMB for ' + srcRel + ' -> /images/.thumbs/' + thumbRel); failures += 1; continue; }
    const size = fs.statSync(thumbPath).size;
    if (size > SIZE_BUDGET_BYTES) { console.error('OVER BUDGET /images/.thumbs/' + thumbRel); failures += 1; }
    rows.push({ kind: 'verify', rel: thumbRel, beforeKb: 0, afterKb: Math.round(size/1024) });
  }

  // 3.5) cases.json 封面改指 /images/ 副本（去掉 ?v= 指纹后缀，路径本身就是版本）
  const casesJsonPath = path.join(ROOT, 'public', 'gallery', 'ecommerce', 'cases.json');
  if (fs.existsSync(casesJsonPath)) {
    const cases = JSON.parse(fs.readFileSync(casesJsonPath, 'utf8'));
    let changed = 0;
    for (const item of cases) {
      if (typeof item?.cover_url !== 'string') continue;
      const match = item.cover_url.match(/^\/gallery\/ecommerce\/([^\/?#]+)\/cover\.webp(?:\?v=[a-f0-9]+)?$/);
      if (!match) continue;
      const next = '/images/gallery/ecommerce/' + match[1] + '/cover.webp';
      if (item.cover_url !== next) { item.cover_url = next; changed += 1; }
    }
    if (changed > 0) {
      fs.writeFileSync(casesJsonPath, JSON.stringify(cases, null, 2) + '\n');
      console.log('cases.json cover_url updated: ' + changed + ' -> /images/gallery/ecommerce/<id>/cover.webp');
    }
  }

  rows.sort((a, b) => b.afterKb - a.afterKb);
  for (const row of rows) {
    console.log(`${(row.beforeKb + 'KB').padStart(9)} -> ${String(row.afterKb).padStart(4)}KB  ${row.kind.padEnd(6)} ${row.rel}${row.skipped ? ' (fresh)' : ''}`);
  }
  console.log('---');
  console.log(rows.length + ' assets checked, ' + failures + ' over-budget/missing failure(s)');
  if (failures > 0) process.exitCode = 1;
}

main();
