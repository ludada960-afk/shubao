#!/usr/bin/env node
// scripts/build-skill-covers.mjs —— 封面产线：**由 skill 的案例排出封面**
// ═══════════════════════════════════════════════════════════════════════════
// 规则（2026-09-16 用户指正）：封面不是单独设计的一张图，而是把该 skill 的**案例**
// （也就是点进去能看到的「作品示例」）按版式排在一起。所以：
//   素材来源 = skill.cases[].cover（真实成品，public/ 下的静态资源）
//   版式     = skill.cover.template（case-3up / hero-single / poster-style / before-after）
//   烤不烤字 = 推荐位不烤字，专区烤字且字在上方（见 coverTemplates.coverShowTitle）
// 用法：
//   node scripts/build-skill-covers.mjs            # 出图 → public/skill-covers/cover-<skillId>.png
//   node scripts/build-skill-covers.mjs --sheet    # 顺带出对照表 .tmp/covers/sheet.png
//   node scripts/build-skill-covers.mjs --check    # 只核对：有案例的 skill 必须有封面产物
// ═══════════════════════════════════════════════════════════════════════════
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { COVER_ASSET_DIR, COVER_SIZE, coverJobsFor } from '../src/skills/coverTemplates.js';
import { IMAGE_SKILLS } from '../src/skills/imageSkills.js';
import { VIDEO_SKILLS } from '../src/skills/videoSkills.js';
import { renderCoverHtml } from './lib/cover-html.mjs';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const wantSheet = args.includes('--sheet');
const tmpDir = resolve('.tmp/covers');
const outDir = resolve(COVER_ASSET_DIR);
const publicDir = resolve('public');

/* 站点里的公开路径（/gallery/x.png）→ 磁盘路径（public/gallery/x.png） */
function assetPath(url) {
  const clean = String(url || '').split('?')[0];
  return clean.startsWith('/') ? resolve(publicDir, clean.slice(1)) : resolve(clean);
}

function toPosix(value) { return value.split('\\').join('/'); }
async function exists(path) { try { const info = await stat(path); return info.size > 0; } catch { return false; } }

const { jobs: rawJobs, blocked } = coverJobsFor([...IMAGE_SKILLS, ...VIDEO_SKILLS]);
const jobs = rawJobs.map(job => ({
  ...job,
  file: 'cover-' + job.skillId + '.png',
  tiles: job.tiles.map(assetPath),
}));

function htmlFor(job, baseDir) {
  return renderCoverHtml({
    layout: job.layout,
    accent: job.accent,
    title: job.title,
    showTitle: job.showTitle,
    tiles: job.tiles.map(path => toPosix(relative(baseDir, path))),
  });
}

/* 对照表：同一张封面在「原图 / 卡片尺寸（274×205）/ 卡片含遮罩标题」三种用法下的样子 */
function sheetHtml(list, prefix) {
  const cells = list.map(job => `
    <section class="cell">
      <h2>${job.title} <small>${job.layout} · ${job.accent} · ${job.showTitle ? '封面带字' : '封面不带字'} · ${job.skillId}</small></h2>
      <img class="big" src="${prefix}${job.file}" alt="">
      <div class="row">
        <div class="fake-card">
          <img class="fake-img" src="${prefix}${job.file}" alt="">
          <div class="fake-veil"></div>
          <div class="fake-caption">
            <div class="fake-titles"><strong>${job.title}</strong><span>${job.subtitle || job.skillId}</span></div>
            <i>›</i>
          </div>
        </div>
        <img class="small" src="${prefix}${job.file}" alt="">
      </div>
    </section>`).join('');
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>封面样张对照</title>
  <style>
    body { margin: 0; padding: 48px; background: #0F0D14; color: #EDEAF4;
           font-family: 'PingFang SC','Microsoft YaHei',system-ui,sans-serif; width: 1120px; }
    h1 { font-size: 30px; margin: 0 0 10px; font-weight: 900; }
    p.lead { margin: 0 0 36px; color: #A79FC0; font-size: 15px; line-height: 1.75; }
    .cell { margin-bottom: 56px; padding-bottom: 40px; border-bottom: 1px solid #2A2536; }
    h2 { font-size: 22px; margin: 0 0 18px; font-weight: 800; }
    h2 small { font-size: 13px; font-weight: 500; color: #8E86A8; margin-left: 10px; }
    img.big { width: 1024px; border-radius: 20px; display: block; box-shadow: 0 24px 60px rgba(0,0,0,0.5); }
    .row { display: flex; align-items: flex-start; gap: 32px; margin-top: 26px; }
    /* 真实卡片用法：4:3、圆角 16、封面铺满、自下而上白色渐变、底部标题+副标题+箭头 */
    .fake-card { position: relative; width: 274px; aspect-ratio: 4 / 3; border-radius: 16px; overflow: hidden;
                 border: 1px solid rgba(255,255,255,0.14); background: #fff; }
    .fake-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
    .fake-veil { position: absolute; inset: 0; background: linear-gradient(to top, #fff 0%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0) 78%); }
    .fake-caption { position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: flex-end;
                    justify-content: space-between; gap: 12px; padding: 12px 14px; }
    .fake-titles { min-width: 0; flex: 1; }
    .fake-titles strong { display: block; font-size: 14px; font-weight: 600; line-height: 1.25; color: #111; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fake-titles span { display: block; margin-top: 2px; font-size: 11px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fake-caption i { font-style: normal; color: #333; font-size: 13px; }
    img.small { width: 274px; height: 205px; object-fit: cover; border-radius: 14px; display: block; }
    .note { margin-top: 8px; font-size: 12px; color: #8E86A8; }
  </style></head><body>
  <h1>封面样张 · 每个类型一张</h1>
  <p class="lead">上＝1600×1200 原图；下左＝卡片真实用法（274×205 封面 ＋ 底部遮罩标题/副标题）；下右＝缩到卡片尺寸的封面本身。<br>
  判据：缩到卡片尺寸后主体还认不认得出、四张放一起像不像一套、封面与"点进去看到的案例"是不是同一批素材。</p>
  ${cells}
  </body></html>`;
}

if (!jobs.length) {
  console.error('[covers] 没有任何 skill 的案例够用，先给 skill 补 cases。');
  process.exit(1);
}

if (checkOnly) {
  const absent = [];
  for (const job of jobs) if (!(await exists(join(outDir, job.file)))) absent.push(job.file);
  if (absent.length) {
    console.error('[covers] 缺封面产物：' + absent.join(', ') + '（跑 node scripts/build-skill-covers.mjs 重出）');
    process.exit(1);
  }
  console.log('[covers] 通过：' + jobs.length + ' 条封面与案例一致（' + COVER_SIZE.width + '×' + COVER_SIZE.height + '）。');
  if (blocked.length) console.log('[covers] 待补案例（暂不出封面）：' + blocked.map(item => item.skillId + '(' + item.have + '/' + item.need + ')').join(', '));
  process.exit(0);
}

await mkdir(tmpDir, { recursive: true });
await mkdir(outDir, { recursive: true });

const { chromium } = await import('playwright').catch(() => {
  throw new Error('缺少无头浏览器 playwright —— 先跑 npm install，再跑 npx playwright install chromium');
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: COVER_SIZE.width, height: COVER_SIZE.height }, deviceScaleFactor: 1 });
const written = [];
try {
  for (const job of jobs) {
    const htmlPath = join(tmpDir, job.skillId + '.html');
    await writeFile(htmlPath, htmlFor(job, dirname(htmlPath)), 'utf8');
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {}))));
    const box = await page.locator('#cover').boundingBox();
    if (!box || Math.round(box.width) !== COVER_SIZE.width || Math.round(box.height) !== COVER_SIZE.height) {
      throw new Error(job.skillId + ' 版式尺寸不对：' + JSON.stringify(box));
    }
    await page.locator('#cover').screenshot({ path: join(outDir, job.file) });
    written.push(job.file);
    console.log('  ✔ ' + job.file + '  ' + job.layout + '/' + job.accent + (job.showTitle ? ' +字' : ' 不带字') + '  ← ' + job.tiles.length + ' 张案例');
  }

  if (wantSheet) {
    const sheetPath = join(tmpDir, 'sheet.html');
    const prefix = toPosix(relative(tmpDir, outDir)) + '/';
    await writeFile(sheetPath, sheetHtml(jobs, prefix), 'utf8');
    const sheetPage = await browser.newPage({ viewport: { width: 1120, height: 1200 }, deviceScaleFactor: 1 });
    await sheetPage.goto(pathToFileURL(sheetPath).href, { waitUntil: 'load', timeout: 30000 });
    await sheetPage.evaluate(() => Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {}))));
    await sheetPage.screenshot({ path: join(tmpDir, 'sheet.png'), fullPage: true });
    await sheetPage.close();
    console.log('  ✔ 对照表 .tmp/covers/sheet.png');
  }
} finally {
  await browser.close();
}
console.log('[covers] 完成：' + written.length + ' 张 → ' + COVER_ASSET_DIR);
if (blocked.length) console.log('[covers] 待补案例（暂不出封面）：' + blocked.map(item => item.skillId + '(' + item.have + '/' + item.need + ')').join(', '));
