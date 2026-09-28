// 批 CY-⑭ 线上复验（UTF-8 安全版）。
// ⚠️ 第一版用 shell + grep 查中文，**远端 locale 不是 UTF-8**，
//    脚本里的中文常量被读坏 ⇒ 查「自适应」得到 0（假阴性）。改用 node。
const fs = require('fs');
const path = require('path');
const ROOT = '/var/www/shubao/current';
const ASSETS = path.join(ROOT, 'assets');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const entryCss = (html.match(/assets\/[^"]+\.css/) || [])[0];
const css = fs.readFileSync(path.join(ROOT, entryCss), 'utf8');

/* 本次部署写入的文件：按 mtime 筛（部署脚本 40 分钟内写完） */
const now = Date.now();
const recent = fs.readdirSync(ASSETS)
  .filter(n => n.endsWith('.js'))
  .map(n => ({ n, m: fs.statSync(path.join(ASSETS, n)).mtimeMs }))
  .filter(f => now - f.m < 90 * 60 * 1000)
  .map(f => path.join(ASSETS, f.n));

const out = [];
out.push(`release: ${fs.realpathSync(ROOT)}`);
out.push(`入口 css: ${entryCss}   本次部署新写的 js: ${recent.length} 个`);

/* 画布 chunk = 本次新写、且含 data-canvas-config-trigger 的那个 */
const canvasChunk = recent
  .map(p => ({ p, t: fs.readFileSync(p, 'utf8') }))
  .find(x => x.t.includes('data-canvas-config-trigger'));
const canvas = canvasChunk ? canvasChunk.t : '';
out.push(`画布 chunk: ${canvasChunk ? path.basename(canvasChunk.p) : '(未找到)'}`);
out.push('');

const count = (hay, needle) => hay.split(needle).length - 1;

out.push('── 必须在线上的（应 ≥1）──');
for (const k of ['自适应', '导出这张图片', 'data-canvas-config-trigger', 'ec-canvas-config-trigger', '至少需要']) {
  out.push(`  ${k.padEnd(28)} js=${canvas ? count(canvas, k) : '?'}  css=${count(css, k)}`);
}
out.push('');
out.push('── 必须已经消失的（应 0）──');
for (const k of ['导出整套图片', '电商图片交付', 'ec-canvas-count-popover', 'ec-canvas-ratio-popover', 'ec-canvas-resolution-popover']) {
  out.push(`  ${k.padEnd(28)} js=${canvas ? count(canvas, k) : '?'}  css=${count(css, k)}`);
}
out.push('');

/* 「电商」这个词还剩在哪些**字符串字面量**里（编译后没有注释了，剩下的都是真文案/alt） */
out.push('── 画布 chunk 里剩下的「电商」字面量（这些是 alt / 兜底名，用户看得到）──');
const re = /['"`]([^'"`\n]{0,40}电商[^'"`\n]{0,40})['"`]/g;
const hits = [...canvas.matchAll(re)].map(m => m[1]);
out.push(hits.length ? [...new Set(hits)].map(h => '  ' + h).join('\n') : '  (无)');

fs.writeFileSync('/tmp/cy14-live.txt', out.join('\n'), 'utf8');
console.log(out.join('\n'));
